const { withTransaction, query } = require('../models/db');

/**
 * Enterprise Order Management Service.
 * Handles server-side price calculation, stock verification, atomic stock deduction,
 * ACID database transactions, and status management.
 */
class OrderService {
  /**
   * Creates a customer order inside an ACID database transaction.
   */
  async createOrder({ customer_name, phone_number, address, vendor_id, items, remarks = '' }) {
    const orderResult = await withTransaction(async (txQuery) => {
      // 1. Verify Vendor exists and is ACTIVE
      const vendorRes = await txQuery(`SELECT vendor_id, status, store_name FROM vendors WHERE vendor_id = ?`, [vendor_id]);
      if (vendorRes.rows.length === 0) {
        throw new Error('Vendor not found');
      }
      if (vendorRes.rows[0].status && String(vendorRes.rows[0].status).toUpperCase() !== 'ACTIVE') {
        throw new Error('Vendor is currently not active');
      }

      // 1b. Verify Vendor has an ACTIVE subscription
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
      const subRes = await txQuery(
        `SELECT subscription_id FROM subscriptions 
         WHERE vendor_id = ? AND UPPER(status) = 'ACTIVE' AND end_date >= ?
         LIMIT 1`,
        [vendor_id, todayStr]
      );
      if (!subRes.rows || subRes.rows.length === 0) {
        const err = new Error('Merchant is not eligible to receive orders: Subscription is inactive, expired, or pending');
        err.code = 'MERCHANT_SUBSCRIPTION_INACTIVE';
        throw err;
      }

      // 2. Fetch all requested items from DB to perform authoritative price calculation & stock checks
      const itemIds = items.map(i => i.item_id);
      const placeholders = itemIds.map(() => '?').join(',');

      const dbItemsRes = await txQuery(
        `SELECT item_id, item_name, price, stock, is_available FROM items WHERE item_id IN (${placeholders}) AND vendor_id = ?`,
        [...itemIds, vendor_id]
      );

      const dbItemMap = new Map();
      dbItemsRes.rows.forEach(item => dbItemMap.set(item.item_id, item));

      // 3. Authoritative Price Calculation & Stock Validation
      let computedTotalAmount = 0;
      const verifiedLineItems = [];

      for (const reqItem of items) {
        const dbItem = dbItemMap.get(reqItem.item_id);

        if (!dbItem) {
          throw new Error(`Item ID ${reqItem.item_id} not found in vendor store`);
        }

        if (dbItem.is_available === 0 || dbItem.is_available === false) {
          throw new Error(`Item '${dbItem.item_name}' is currently unavailable`);
        }

        if (dbItem.stock < reqItem.quantity) {
          throw new Error(`Insufficient stock for '${dbItem.item_name}'. Available: ${dbItem.stock}, Requested: ${reqItem.quantity}`);
        }

        const authoritativePrice = parseFloat(dbItem.price);
        const itemTotal = authoritativePrice * reqItem.quantity;
        computedTotalAmount += itemTotal;

        verifiedLineItems.push({
          item_id: reqItem.item_id,
          item_name: dbItem.item_name,
          quantity: reqItem.quantity,
          unit_price: authoritativePrice,
          item_total: itemTotal
        });
      }

      // 4. Duplicate Order Protection (Prevent double-submission within 10 seconds)
      const duplicateCheck = await txQuery(`
        SELECT o.order_id 
        FROM orders o 
        WHERE o.vendor_id = ? AND o.customer_phone = ? AND o.total_amount = ? 
          AND o.order_timestamp >= CURRENT_TIMESTAMP - INTERVAL '10 seconds'
      `, [vendor_id, phone_number, computedTotalAmount]).catch(() => ({ rows: [] })); // Fallback if INTERVAL syntax differs

      if (duplicateCheck.rows && duplicateCheck.rows.length > 0) {
        throw new Error('Duplicate order detected. Please wait a moment before submitting again.');
      }

      // 5. Look up User record by phone
      let user_id = null;
      const userCheck = await txQuery(`SELECT user_id FROM users WHERE phone = ?`, [phone_number]).catch(() => ({ rows: [] }));
      if (userCheck.rows && userCheck.rows.length > 0) {
        user_id = userCheck.rows[0].user_id;
        await txQuery(`UPDATE users SET name = COALESCE(NULLIF(?, ''), name), address = COALESCE(NULLIF(?, ''), address) WHERE user_id = ?`, [customer_name, address, user_id]).catch(() => {});
      }

      // 6. Atomically deduct item stock & prevent negative stock race conditions
      for (const lineItem of verifiedLineItems) {
        const stockUpdate = await txQuery(
          `UPDATE items SET stock = stock - ? WHERE item_id = ? AND stock >= ?`,
          [lineItem.quantity, lineItem.item_id, lineItem.quantity]
        );

        if (stockUpdate.rowCount === 0) {
          throw new Error(`Race condition detected: Stock for '${lineItem.item_name}' changed during checkout.`);
        }
      }

      // 7. Insert Order Record with Authoritative Server-Calculated Total
      const orderRes = await txQuery(
        `INSERT INTO orders (vendor_id, user_id, customer_name, customer_phone, delivery_address, status, total_amount, remarks) VALUES (?, ?, ?, ?, ?, 'PLACED', ?, ?)`,
        [vendor_id, user_id, customer_name, phone_number, address, computedTotalAmount, String(remarks || '').trim()]
      ).catch(async () => {
        return txQuery(
          `INSERT INTO orders (vendor_id, user_id, customer_name, customer_phone, delivery_address, status, total_amount) VALUES (?, ?, ?, ?, ?, 'PLACED', ?)`,
          [vendor_id, user_id, customer_name, phone_number, address, computedTotalAmount]
        );
      });
      const order_id = orderRes.insertId;

      // 8. Insert Order Line Items
      for (const lineItem of verifiedLineItems) {
        await txQuery(
          `INSERT INTO order_details (order_id, item_id, quantity, unit_price, item_total) VALUES (?, ?, ?, ?, ?)`,
          [order_id, lineItem.item_id, lineItem.quantity, lineItem.unit_price, lineItem.item_total]
        );
      }

      // 9. Dispatch Zomato-style high-priority Push Notification & Socket Alert to Vendor
      const notificationService = require('./notificationService');
      notificationService.notifyVendorNewOrder({
        vendor_id,
        order_id,
        total_amount: computedTotalAmount,
        customer_name,
        items_count: verifiedLineItems.length,
        items: verifiedLineItems,
        remarks: String(remarks || '').trim(),
        delivery_address: address
      }).catch(err => console.error('[Order Notification Error]', err.message));

      return {
        order_id,
        total_amount: computedTotalAmount,
        status: 'PLACED',
        store_name: vendorRes.rows[0]?.store_name || 'Merchant Store',
        items: verifiedLineItems
      };
    });

    // ── Dispatch WhatsApp Order Confirmation to Customer (AFTER DB COMMIT) ──
    if (phone_number && orderResult?.order_id) {
      const { sendOrderReceivedCustomerWhatsApp } = require('./whatsappService');
      (async () => {
        try {
          // Check DB-level idempotency
          const checkNotified = await query(
            `SELECT wa_order_notified FROM orders WHERE order_id = ?`,
            [orderResult.order_id]
          ).catch(() => ({ rows: [] }));

          if (checkNotified.rows?.[0]?.wa_order_notified === true) {
            console.log(`ℹ️ [WHATSAPP DEDUP] Order received WhatsApp already sent for order #${orderResult.order_id}. Bypassing.`);
            return;
          }

          const waResult = await sendOrderReceivedCustomerWhatsApp({
            customerPhone: phone_number,
            customerName: customer_name,
            orderId: orderResult.order_id,
            storeName: orderResult.store_name,
            totalAmount: orderResult.total_amount,
            items: orderResult.items || items,
            orderTime: new Date(),
            paymentStatus: 'COD',
            deliveryAddress: address
          });

          if (waResult && waResult.success) {
            await query(`UPDATE orders SET wa_order_notified = TRUE WHERE order_id = ?`, [orderResult.order_id]).catch(() => {});
          }
        } catch (waErr) {
          console.error(`❌ [WHATSAPP ORDER NOTIFICATION ERROR] Order #${orderResult.order_id}:`, waErr.message);
        }
      })();
    }

    return orderResult;
  }

  /**
   * Fetches full order details including line items.
   */
  async getOrderDetails(orderId) {
    const orderRes = await query(`
      SELECT o.*, v.store_name, v.phone_number as vendor_phone, 
             COALESCE(NULLIF(o.customer_name, ''), u.name, 'Customer') as customer_name, 
             COALESCE(NULLIF(o.customer_phone, ''), u.phone, '') as customer_phone, 
             COALESCE(NULLIF(o.delivery_address, ''), u.address, '') as address
      FROM orders o
      JOIN vendors v ON o.vendor_id = v.vendor_id
      LEFT JOIN users u ON o.user_id = u.user_id
      WHERE o.order_id = ?
    `, [orderId]);

    if (orderRes.rows.length === 0) {
      return null;
    }

    const itemsRes = await query(`
      SELECT od.*, i.item_name, i.unit 
      FROM order_details od
      JOIN items i ON od.item_id = i.item_id
      WHERE od.order_id = ?
    `, [orderId]);

    return {
      order: orderRes.rows[0],
      items: itemsRes.rows
    };
  }

  /**
   * Updates order status.
   */
  async updateOrderStatus(orderId, status) {
    await query(`UPDATE orders SET status = ? WHERE order_id = ?`, [status, orderId]);
    return { status };
  }
}

module.exports = new OrderService();
