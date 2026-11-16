const z = require('../utils/zod');

function normalizePaymentPayload(data = {}) {
  const normalized = { ...data };
  if (normalized.merchant_id !== undefined && normalized.vendor_id === undefined) normalized.vendor_id = normalized.merchant_id;
  if (normalized.merchantId !== undefined && normalized.vendor_id === undefined) normalized.vendor_id = normalized.merchantId;
  if (normalized.vendorId !== undefined && normalized.vendor_id === undefined) normalized.vendor_id = normalized.vendorId;

  if (normalized.order_amount !== undefined && normalized.amount === undefined) normalized.amount = normalized.order_amount;
  if (normalized.orderAmount !== undefined && normalized.amount === undefined) normalized.amount = normalized.orderAmount;

  if (normalized.orderId !== undefined && normalized.order_id === undefined) normalized.order_id = normalized.orderId;
  if (normalized.customerPhone !== undefined && normalized.customer_phone === undefined) normalized.customer_phone = normalized.customerPhone;
  if (normalized.phone !== undefined && normalized.customer_phone === undefined) normalized.customer_phone = normalized.phone;

  return normalized;
}

const orderPaymentSessionSchema = {
  body: z.object({
    order_id: z.string().trim().max(100, 'order_id must not exceed 100 characters').optional(),
    amount: z.coerce.number()
      .positive('Amount must be greater than 0')
      .maxDigitsBeforeDecimal(6, 'Amount cannot exceed 6 digits before decimal')
      .maxDecimals(2, 'Amount cannot exceed 2 decimal places')
      .max(999999.99, 'Amount cannot exceed ₹999,999.99')
      .optional(),
    vendor_id: z.coerce.number().int().positive('vendor_id must be a positive integer').optional(),
    customer_id: z.union([z.string(), z.number()]).optional(),
    customer_name: z.string().trim().max(100).optional(),
    customer_phone: z.string().trim().max(20).optional(),
    customer_email: z.string().trim().max(100).optional(),
    return_url: z.string().trim().max(2048).optional(),
    notify_url: z.string().trim().max(2048).optional(),
    note: z.string().trim().max(500).optional()
  }).passthrough().preprocess(normalizePaymentPayload)
};

const directPaySchema = {
  body: z.object({
    vendor_id: z.union([z.number(), z.string()], 'vendor_id or merchant_id is required'),
    amount: z.coerce.number()
      .positive('Direct payment amount must be greater than 0')
      .maxDigitsBeforeDecimal(6, 'Amount cannot exceed 6 digits before decimal')
      .maxDecimals(2, 'Amount cannot have more than 2 decimal places')
      .max(999999.99, 'Direct payment amount cannot exceed ₹999,999.99'),
    customer_name: z.string().trim().max(100).optional(),
    customer_phone: z.string().trim().max(20).optional(),
    customer_email: z.string().trim().max(100).optional(),
    return_url: z.string().trim().max(2048).optional(),
    notify_url: z.string().trim().max(2048).optional(),
    notes: z.any().optional()
  }).passthrough().preprocess(normalizePaymentPayload)
};

const verifyPaymentSchema = {
  body: z.object({
    order_id: z.string().trim().min(1, 'order_id is required for payment verification').max(100)
  }).passthrough().preprocess(normalizePaymentPayload)
};

module.exports = {
  orderPaymentSessionSchema,
  directPaySchema,
  verifyPaymentSchema,
  normalizePaymentPayload
};
