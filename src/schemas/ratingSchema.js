const z = require('../utils/zod');

function normalizeRatingPayload(data = {}) {
  const normalized = { ...data };
  if (normalized.reviewText !== undefined && normalized.review_text === undefined) normalized.review_text = normalized.reviewText;
  if (normalized.orderId !== undefined && normalized.order_id === undefined) normalized.order_id = normalized.orderId;
  if (normalized.userId !== undefined && normalized.user_id === undefined) normalized.user_id = normalized.userId;
  if (normalized.userName !== undefined && normalized.user_name === undefined) normalized.user_name = normalized.userName;
  if (normalized.vendorId !== undefined && normalized.vendor_id === undefined) normalized.vendor_id = normalized.vendorId;
  return normalized;
}

const submitRatingSchema = {
  params: z.object({
    vendorId: z.union([z.string(), z.number()]).optional(),
    venderId: z.union([z.string(), z.number()]).optional(),
    id: z.union([z.string(), z.number()]).optional()
  }).passthrough(),
  body: z.object({
    rating: z.coerce.number()
      .min(1.0, 'Rating must be a number between 1.0 and 5.0 stars')
      .max(5.0, 'Rating must be a number between 1.0 and 5.0 stars')
      .maxDecimals(1, 'Rating can have at most 1 decimal place'),
    review_text: z.string().trim().max(1000, 'Review text must not exceed 1000 characters').optional(),
    order_id: z.union([z.string(), z.number()]).optional(),
    vendor_id: z.union([z.string(), z.number()]).optional(),
    user_id: z.union([z.string(), z.number()]).optional(),
    user_name: z.string().trim().max(100).optional()
  }).passthrough().preprocess(normalizeRatingPayload)
};

const replyRatingSchema = {
  params: z.object({
    ratingId: z.union([z.string(), z.number()]).optional()
  }).passthrough(),
  body: z.object({
    reply: z.string().trim().min(1, 'Reply is required').max(1000, 'Reply must not exceed 1000 characters')
  }).passthrough()
};

module.exports = {
  submitRatingSchema,
  replyRatingSchema,
  normalizeRatingPayload
};
