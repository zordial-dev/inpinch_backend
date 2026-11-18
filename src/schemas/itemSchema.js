const z = require('../utils/zod');

/**
 * Preprocessor to normalize incoming product item field aliases
 */
function normalizeItemPayload(data = {}) {
  const normalized = { ...data };

  if (normalized.name !== undefined && normalized.item_name === undefined) normalized.item_name = normalized.name;
  if (normalized.title !== undefined && normalized.item_name === undefined) normalized.item_name = normalized.title;
  if (normalized.product_name !== undefined && normalized.item_name === undefined) normalized.item_name = normalized.product_name;

  if (normalized.unit_price !== undefined && normalized.price === undefined) normalized.price = normalized.unit_price;
  if (normalized.item_price !== undefined && normalized.price === undefined) normalized.price = normalized.item_price;

  if (normalized.quantity !== undefined && normalized.stock === undefined) normalized.stock = normalized.quantity;
  if (normalized.qty !== undefined && normalized.stock === undefined) normalized.stock = normalized.qty;

  if (normalized.imageUrl !== undefined && normalized.image_url === undefined) normalized.image_url = normalized.imageUrl;
  if (normalized.image !== undefined && normalized.image_url === undefined) normalized.image_url = normalized.image;
  if (normalized.item_image !== undefined && normalized.image_url === undefined) normalized.image_url = normalized.item_image;
  if (normalized.photo !== undefined && normalized.image_url === undefined) normalized.image_url = normalized.photo;

  return normalized;
}

const createItemSchema = {
  params: z.object({
    vendorId: z.coerce.number().int().positive('vendorId must be a positive integer').optional()
  }).passthrough(),
  body: z.object({
    item_name: z.string().trim().min(2, 'Item name must be at least 2 characters').max(100, 'Item name must not exceed 100 characters'),
    price: z.coerce.number()
      .positive('Price must be greater than 0')
      .maxDigitsBeforeDecimal(6, 'Price cannot exceed 6 digits before decimal')
      .maxDecimals(2, 'Price cannot have more than 2 decimal places')
      .max(999999.99, 'Price cannot exceed ₹999,999.99'),
    stock: z.coerce.number().int('Stock must be an integer').min(0, 'Stock cannot be negative').max(1000000, 'Stock cannot exceed 1,000,000').optional().default(0),
    description: z.string().trim().max(2000, 'Description must not exceed 2000 characters').optional(),
    category: z.string().trim().max(50, 'Category must not exceed 50 characters').optional(),
    unit: z.string().trim().max(20, 'Unit must not exceed 20 characters').optional(),
    is_available: z.coerce.boolean().optional().default(true),
    image_url: z.string().trim().max(2048, 'Image URL must not exceed 2048 characters').refine(val => val === undefined || val.length > 0, 'Product image is required.').optional()
  }).passthrough().preprocess(normalizeItemPayload)
};

const updateItemSchema = {
  params: z.object({
    vendorId: z.coerce.number().int().positive('vendorId must be a positive integer').optional(),
    itemId: z.coerce.number().int().positive('itemId must be a positive integer').optional()
  }).passthrough(),
  body: z.object({
    item_name: z.string().trim().min(2, 'Item name must be at least 2 characters').max(100, 'Item name must not exceed 100 characters').optional(),
    price: z.coerce.number()
      .positive('Price must be greater than 0')
      .maxDigitsBeforeDecimal(6, 'Price cannot exceed 6 digits before decimal')
      .maxDecimals(2, 'Price cannot have more than 2 decimal places')
      .max(999999.99, 'Price cannot exceed ₹999,999.99')
      .optional(),
    stock: z.coerce.number().int('Stock must be an integer').min(0, 'Stock cannot be negative').max(1000000, 'Stock cannot exceed 1,000,000').optional(),
    description: z.string().trim().max(2000, 'Description must not exceed 2000 characters').optional(),
    category: z.string().trim().max(50, 'Category must not exceed 50 characters').optional(),
    unit: z.string().trim().max(20, 'Unit must not exceed 20 characters').optional(),
    is_available: z.coerce.boolean().optional(),
    image_url: z.string().trim().max(2048, 'Image URL must not exceed 2048 characters').optional()
  }).passthrough().preprocess(normalizeItemPayload)
};

const updateItemStockSchema = {
  params: z.object({
    vendorId: z.coerce.number().int().positive('vendorId must be a positive integer').optional(),
    itemId: z.coerce.number().int().positive('itemId must be a positive integer').optional()
  }).passthrough(),
  body: z.object({
    stock: z.coerce.number().int('Stock must be an integer').min(0, 'Stock cannot be negative').max(1000000, 'Stock cannot exceed 1,000,000')
  }).passthrough().preprocess(normalizeItemPayload)
};

module.exports = {
  createItemSchema,
  addItemSchema: createItemSchema,
  updateItemSchema,
  updateItemStockSchema,
  normalizeItemPayload
};
