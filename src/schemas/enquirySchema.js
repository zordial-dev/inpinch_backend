const z = require('../utils/zod');

function normalizeEnquiryPayload(data = {}) {
  const normalized = { ...data };
  if (normalized.user_name !== undefined && normalized.name === undefined) normalized.name = normalized.user_name;
  if (normalized.userName !== undefined && normalized.name === undefined) normalized.name = normalized.userName;

  if (normalized.user_phone !== undefined && normalized.phone === undefined) normalized.phone = normalized.user_phone;
  if (normalized.userPhone !== undefined && normalized.phone === undefined) normalized.phone = normalized.userPhone;
  if (normalized.mobile !== undefined && normalized.phone === undefined) normalized.phone = normalized.mobile;

  if (normalized.serviceType !== undefined && normalized.service_type === undefined) normalized.service_type = normalized.serviceType;
  if (normalized.subject !== undefined && normalized.service_type === undefined) normalized.service_type = normalized.subject;

  if (normalized.preferredTime !== undefined && normalized.preferred_time === undefined) normalized.preferred_time = normalized.preferredTime;
  if (normalized.time_slot !== undefined && normalized.preferred_time === undefined) normalized.preferred_time = normalized.time_slot;

  if (normalized.notes !== undefined && normalized.description === undefined) normalized.description = normalized.notes;
  if (normalized.issue !== undefined && normalized.description === undefined) normalized.description = normalized.issue;

  return normalized;
}

const createEnquirySchema = {
  params: z.object({
    vendorId: z.union([z.string(), z.number()]).optional()
  }).passthrough(),
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name must not exceed 100 characters'),
    phone: z.string().trim().min(10, 'Phone must be at least 10 digits').max(15, 'Phone must not exceed 15 digits'),
    vendor_id: z.union([z.string(), z.number()]).optional(),
    service_type: z.string().trim().max(100, 'Service type must not exceed 100 characters').optional().default('General Service Request'),
    preferred_time: z.string().trim().max(100, 'Preferred time must not exceed 100 characters').optional().default('As soon as possible'),
    description: z.string().trim().max(1000, 'Description must not exceed 1000 characters').optional(),
    society_id: z.union([z.string(), z.number()]).optional(),
    society_name: z.string().trim().max(150).optional()
  }).passthrough().preprocess(normalizeEnquiryPayload)
};

const updateEnquiryStatusSchema = {
  params: z.object({
    enquiryId: z.union([z.string(), z.number()]).optional(),
    id: z.union([z.string(), z.number()]).optional()
  }).passthrough(),
  body: z.object({
    status: z.enum([
      'PENDING', 'ACCEPTED', 'CONFIRMED', 'IN_PROGRESS',
      'COMPLETED', 'CANCELLED', 'REJECTED'
    ], 'Invalid enquiry status value'),
    notes: z.string().trim().max(500, 'Notes must not exceed 500 characters').optional()
  }).passthrough()
};

module.exports = {
  createEnquirySchema,
  updateEnquiryStatusSchema,
  normalizeEnquiryPayload
};
