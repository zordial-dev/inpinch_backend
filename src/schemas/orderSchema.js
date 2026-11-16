const z = require('../utils/zod');

/**
 * Preprocessor for cart item addition
 */
function normalizeCartItem(data = {}) {
  const normalized = { ...data };
  if (normalized.itemId !== undefined && normalized.item_id === undefined) normalized.item_id = normalized.itemId;
  if (normalized.id !== undefined && normalized.item_id === undefined) normalized.item_id = normalized.id;

  if (normalized.merchant_id !== undefined && normalized.vendor_id === undefined) normalized.vendor_id = normalized.merchant_id;
  if (normalized.merchantId !== undefined && normalized.vendor_id === undefined) normalized.vendor_id = normalized.merchantId;
  if (normalized.vendorId !== undefined && normalized.vendor_id === undefined) normalized.vendor_id = normalized.vendorId;

  if (normalized.qty !== undefined && normalized.quantity === undefined) normalized.quantity = normalized.qty;
  return normalized;
}

/**
 * Preprocessor for order creation payload
 */
function normalizeOrderPayload(data = {}) {
  const normalized = { ...data };

  if (normalized.merchant_id !== undefined && normalized.vendor_id === undefined) normalized.vendor_id = normalized.merchant_id;
  if (normalized.merchantId !== undefined && normalized.vendor_id === undefined) normalized.vendor_id = normalized.merchantId;
  if (normalized.vendorId !== undefined && normalized.vendor_id === undefined) normalized.vendor_id = normalized.vendorId;

  if (normalized.deliveryAddress !== undefined && normalized.delivery_address === undefined) normalized.delivery_address = normalized.deliveryAddress;
  if (normalized.address !== undefined && normalized.delivery_address === undefined) normalized.delivery_address = normalized.address;
  if (normalized.full_address !== undefined && normalized.delivery_address === undefined) normalized.delivery_address = normalized.full_address;
  if (normalized.shipping_address !== undefined && normalized.delivery_address === undefined) normalized.delivery_address = normalized.shipping_address;

  if (normalized.customerName !== undefined && normalized.customer_name === undefined) normalized.customer_name = normalized.customerName;
  if (normalized.name !== undefined && normalized.customer_name === undefined) normalized.customer_name = normalized.name;
  if (normalized.user_name !== undefined && normalized.customer_name === undefined) normalized.customer_name = normalized.user_name;
  if (normalized.userName !== undefined && normalized.customer_name === undefined) normalized.customer_name = normalized.userName;

  if (normalized.phone !== undefined && normalized.customer_phone === undefined) normalized.customer_phone = normalized.phone;
  if (normalized.mobile !== undefined && normalized.customer_phone === undefined) normalized.customer_phone = normalized.mobile;
  if (normalized.phone_number !== undefined && normalized.customer_phone === undefined) normalized.customer_phone = normalized.phone_number;
  if (normalized.user_phone !== undefined && normalized.customer_phone === undefined) normalized.customer_phone = normalized.user_phone;

  if (normalized.order_items !== undefined && normalized.items === undefined) normalized.items = normalized.order_items;

  if (normalized.notes !== undefined && normalized.remarks === undefined) normalized.remarks = normalized.notes;
  if (normalized.note !== undefined && normalized.remarks === undefined) normalized.remarks = normalized.note;
  if (normalized.instructions !== undefined && normalized.remarks === undefined) normalized.remarks = normalized.instructions;
  if (normalized.delivery_instructions !== undefined && normalized.remarks === undefined) normalized.remarks = normalized.delivery_instructions;
  if (normalized.order_notes !== undefined && normalized.remarks === undefined) normalized.remarks = normalized.order_notes;

  if (Array.isArray(normalized.items)) {
    normalized.items = normalized.items.map(item => {
      const itm = { ...item };
      if (itm.itemId !== undefined && itm.item_id === undefined) itm.item_id = itm.itemId;
      if (itm.id !== undefined && itm.item_id === undefined) itm.item_id = itm.id;
      if (itm.qty !== undefined && itm.quantity === undefined) itm.quantity = itm.qty;
      return itm;
    });
  }

  return normalized;
}

const cartItemSchema = z.object({
  item_id: z.coerce.number().int().positive('item_id must be a positive integer'),
  quantity: z.coerce.number().int('Quantity must be an integer').min(1, 'Quantity must be at least 1').max(1000, 'Quantity cannot exceed 1000').optional().default(1),
  unit_price: z.coerce.number().optional()
}).passthrough();

const cartAddSchema = {
  body: z.object({
    item_id: z.coerce.number().int().positive('item_id must be a positive integer'),
    vendor_id: z.coerce.number().int().positive('vendor_id must be a positive integer').optional(),
    quantity: z.coerce.number().int('Quantity must be an integer').min(1, 'Quantity must be at least 1').max(1000, 'Quantity cannot exceed 1000').optional().default(1)
  }).passthrough().preprocess(normalizeCartItem)
};

const createOrderSchema = {
  body: z.object({
    vendor_id: z.coerce.number().int().positive('vendor_id is required and must be a positive integer'),
    items: z.array(cartItemSchema).min(1, 'Order must contain at least one item').max(100, 'Order cannot exceed 100 items'),
    customer_name: z.string().trim().max(100, 'Customer name must not exceed 100 characters').optional(),
    customer_phone: z.string().trim().max(20, 'Customer phone must not exceed 20 characters').optional(),
    delivery_address: z.string().trim().max(1000, 'Delivery address must not exceed 1000 characters').optional(),
    society_id: z.union([z.number(), z.string()]).optional(),
    payment_method: z.string().trim().max(50).optional(),
    remarks: z.string().trim().max(500, 'Remarks must not exceed 500 characters').optional()
  }).passthrough().preprocess(normalizeOrderPayload)
};

const updateOrderStatusSchema = {
  params: z.object({
    id: z.union([z.string(), z.number()]).optional(),
    orderId: z.union([z.string(), z.number()]).optional()
  }).passthrough(),
  body: z.object({
    status: z.enum([
      'PLACED', 'PENDING', 'CONFIRMED', 'ACCEPTED', 'IN_PROGRESS',
      'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED',
      'COMPLETE', 'CANCELLED', 'CANCELED', 'REJECTED'
    ], 'Invalid order status value'),
    remarks: z.string().trim().max(500, 'Remarks must not exceed 500 characters').optional()
  }).passthrough()
};

module.exports = {
  cartAddSchema,
  createOrderSchema,
  updateOrderStatusSchema,
  normalizeCartItem,
  normalizeOrderPayload
};
