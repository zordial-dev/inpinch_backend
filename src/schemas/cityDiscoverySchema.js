const z = require('../utils/zod');

const citySearchSchema = {
  query: z.object({
    q: z.string().trim().max(100, 'Search query must not exceed 100 characters').optional(),
    search: z.string().trim().max(100, 'Search query must not exceed 100 characters').optional(),
    limit: z.coerce.number().int().min(1).max(500).optional().default(50)
  }).passthrough()
};

const discoverQuerySchema = {
  query: z.object({
    city: z.string().trim().max(100).optional(),
    city_id: z.union([z.string(), z.number()]).optional(),
    category: z.string().trim().max(100).optional(),
    category_id: z.union([z.string(), z.number()]).optional(),
    subcategory: z.string().trim().max(100).optional(),
    q: z.string().trim().max(100, 'Search query must not exceed 100 characters').optional(),
    type: z.enum(['product', 'service', 'all']).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20)
  }).passthrough()
};

module.exports = {
  citySearchSchema,
  discoverQuerySchema
};
