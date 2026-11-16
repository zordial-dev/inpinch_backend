const z = require('../utils/zod');

function normalizeSupportPayload(data = {}) {
  const normalized = { ...data };
  if (normalized.title !== undefined && normalized.subject === undefined) normalized.subject = normalized.title;
  if (normalized.description !== undefined && normalized.message === undefined) normalized.message = normalized.description;
  if (normalized.orderId !== undefined && normalized.order_id === undefined) normalized.order_id = normalized.orderId;
  return normalized;
}

const createTicketSchema = {
  body: z.object({
    subject: z.string().trim().min(3, 'Subject must be at least 3 characters').max(200, 'Subject must not exceed 200 characters'),
    message: z.string().trim().min(5, 'Message must be at least 5 characters').max(3000, 'Message must not exceed 3000 characters'),
    category: z.enum(['order', 'payment', 'account', 'general', 'technical'], 'Invalid support category').optional().default('general'),
    priority: z.enum(['urgent', 'high', 'medium', 'low'], 'Invalid priority level').optional().default('medium'),
    order_id: z.union([z.string(), z.number()]).optional(),
    user_id: z.union([z.string(), z.number()]).optional(),
    user_email: z.string().trim().email('Invalid email address format').optional(),
    user_phone: z.string().trim().max(20).optional()
  }).passthrough().preprocess(normalizeSupportPayload)
};

module.exports = {
  createTicketSchema,
  normalizeSupportPayload
};
