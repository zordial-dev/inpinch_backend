const z = require('../utils/zod');

/**
 * Preprocessor to normalize incoming service catalog field aliases
 */
function normalizeServicePayload(data = {}) {
  const normalized = { ...data };

  if (normalized.serviceName !== undefined && normalized.service_name === undefined) normalized.service_name = normalized.serviceName;
  if (normalized.name !== undefined && normalized.service_name === undefined) normalized.service_name = normalized.name;
  if (normalized.title !== undefined && normalized.service_name === undefined) normalized.service_name = normalized.title;

  if (normalized.service_price !== undefined && normalized.price === undefined) normalized.price = normalized.service_price;
  if (normalized.base_price !== undefined && normalized.price === undefined) normalized.price = normalized.base_price;

  if (normalized.visitingCharge !== undefined && normalized.visiting_charge === undefined) normalized.visiting_charge = normalized.visitingCharge;
  if (normalized.visiting_fee !== undefined && normalized.visiting_charge === undefined) normalized.visiting_charge = normalized.visiting_fee;
  if (normalized.inspection_charge !== undefined && normalized.visiting_charge === undefined) normalized.visiting_charge = normalized.inspection_charge;

  if (normalized.estimatedDuration !== undefined && normalized.estimated_duration === undefined) normalized.estimated_duration = normalized.estimatedDuration;
  if (normalized.duration !== undefined && normalized.estimated_duration === undefined) normalized.estimated_duration = normalized.duration;

  if (normalized.serviceLocation !== undefined && normalized.service_location === undefined) normalized.service_location = normalized.serviceLocation;
  if (normalized.location !== undefined && normalized.service_location === undefined) normalized.service_location = normalized.location;

  if (normalized.service_description !== undefined && normalized.description === undefined) normalized.description = normalized.service_description;
  if (normalized.serviceDescription !== undefined && normalized.description === undefined) normalized.description = normalized.serviceDescription;

  if (normalized.imageUrl !== undefined && normalized.image_url === undefined) normalized.image_url = normalized.imageUrl;
  if (normalized.image !== undefined && normalized.image_url === undefined) normalized.image_url = normalized.image;
  if (normalized.photo !== undefined && normalized.image_url === undefined) normalized.image_url = normalized.photo;

  return normalized;
}

const createServiceSchema = {
  params: z.object({
    vendorId: z.coerce.number().int().positive('vendorId must be a positive integer').optional()
  }).passthrough(),
  body: z.object({
    service_name: z.string().trim().min(2, 'Service name must be at least 2 characters').max(255, 'Service name must not exceed 255 characters'),
    price: z.coerce.number()
      .min(0, 'Price must be non-negative')
      .maxDigitsBeforeDecimal(6, 'Price cannot exceed 6 digits before decimal')
      .maxDecimals(2, 'Price cannot have more than 2 decimal places')
      .max(999999.99, 'Price cannot exceed ₹999,999.99')
      .optional()
      .default(0),
    visiting_charge: z.coerce.number()
      .min(0, 'Visiting charge must be non-negative')
      .maxDigitsBeforeDecimal(5, 'Visiting charge cannot exceed 5 digits before decimal')
      .maxDecimals(2, 'Visiting charge cannot have more than 2 decimal places')
      .max(99999.99, 'Visiting charge cannot exceed ₹99,999.99')
      .optional()
      .default(0),
    category: z.string().trim().max(100, 'Category must not exceed 100 characters').optional().default('Electrician & Repairs'),
    estimated_duration: z.string().trim().max(100, 'Estimated duration must not exceed 100 characters').optional().default('1 hour'),
    service_location: z.string().trim().max(100, 'Service location must not exceed 100 characters').optional().default('at_home'),
    description: z.string().trim().max(3000, 'Description must not exceed 3000 characters').optional(),
    is_available: z.coerce.boolean().optional().default(true),
    image_url: z.string().trim().max(2048, 'Image URL must not exceed 2048 characters').optional()
  }).passthrough().preprocess(normalizeServicePayload)
};

const updateServiceSchema = {
  params: z.object({
    vendorId: z.coerce.number().int().positive('vendorId must be a positive integer').optional(),
    serviceId: z.coerce.number().int().positive('serviceId must be a positive integer').optional()
  }).passthrough(),
  body: z.object({
    service_name: z.string().trim().min(2, 'Service name must be at least 2 characters').max(255, 'Service name must not exceed 255 characters').optional(),
    price: z.coerce.number()
      .min(0, 'Price must be non-negative')
      .maxDigitsBeforeDecimal(6, 'Price cannot exceed 6 digits before decimal')
      .maxDecimals(2, 'Price cannot have more than 2 decimal places')
      .max(999999.99, 'Price cannot exceed ₹999,999.99')
      .optional(),
    visiting_charge: z.coerce.number()
      .min(0, 'Visiting charge must be non-negative')
      .maxDigitsBeforeDecimal(5, 'Visiting charge cannot exceed 5 digits before decimal')
      .maxDecimals(2, 'Visiting charge cannot have more than 2 decimal places')
      .max(99999.99, 'Visiting charge cannot exceed ₹99,999.99')
      .optional(),
    category: z.string().trim().max(100, 'Category must not exceed 100 characters').optional(),
    estimated_duration: z.string().trim().max(100, 'Estimated duration must not exceed 100 characters').optional(),
    service_location: z.string().trim().max(100, 'Service location must not exceed 100 characters').optional(),
    description: z.string().trim().max(3000, 'Description must not exceed 3000 characters').optional(),
    is_available: z.coerce.boolean().optional(),
    image_url: z.string().trim().max(2048, 'Image URL must not exceed 2048 characters').optional()
  }).passthrough().preprocess(normalizeServicePayload)
};

module.exports = {
  createServiceSchema,
  updateServiceSchema,
  normalizeServicePayload
};
