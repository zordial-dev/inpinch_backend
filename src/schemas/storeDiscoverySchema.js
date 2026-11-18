'use strict';

const z = require('../utils/zod');

/**
 * Zod validation schema for Category -> Stores browsing endpoint:
 * GET /api/public/categories/:categoryId/stores
 * Enforces pagination with a strict maximum limit of 50 per requirement.
 */
const categoryStoresQuerySchema = {
  params: z.object({
    categoryId: z.union([
      z.coerce.number().int().positive('categoryId must be a positive integer'),
      z.string().trim().min(1, 'categoryId is required')
    ])
  }).passthrough(),
  query: z.object({
    page: z.coerce.number().int('page must be an integer').min(1, 'page must be at least 1').optional().default(1),
    limit: z.coerce.number().int('limit must be an integer').min(1, 'limit must be at least 1').max(50, 'limit cannot exceed 50').optional().default(20),
    search: z.string().trim().max(100, 'search term must not exceed 100 characters').optional(),
    q: z.string().trim().max(100, 'search query must not exceed 100 characters').optional(),
    city: z.string().trim().max(100, 'city must not exceed 100 characters').optional(),
    sort: z.enum(['rating', 'name', 'newest']).optional().default('rating')
  }).passthrough()
};

/**
 * Zod validation schema for Category Detail endpoint:
 * GET /api/public/categories/:categoryId
 */
const categoryDetailParamSchema = {
  params: z.object({
    categoryId: z.union([
      z.coerce.number().int().positive('categoryId must be a positive integer'),
      z.string().trim().min(1, 'categoryId is required')
    ])
  }).passthrough()
};

/**
 * Zod validation schema for Store Products endpoint:
 * GET /api/public/stores/:storeId/products
 */
const storeProductsQuerySchema = {
  params: z.object({
    id: z.union([
      z.coerce.number().int().positive('storeId must be a positive integer'),
      z.string().trim().min(1, 'storeId is required')
    ]).optional(),
    storeId: z.union([
      z.coerce.number().int().positive('storeId must be a positive integer'),
      z.string().trim().min(1, 'storeId is required')
    ]).optional()
  }).passthrough(),
  query: z.object({
    page: z.coerce.number().int('page must be an integer').min(1, 'page must be at least 1').optional().default(1),
    limit: z.coerce.number().int('limit must be an integer').min(1, 'limit must be at least 1').max(50, 'limit cannot exceed 50').optional().default(20),
    category: z.string().trim().max(100, 'category must not exceed 100 characters').optional(),
    search: z.string().trim().max(100, 'search term must not exceed 100 characters').optional(),
    q: z.string().trim().max(100, 'search query must not exceed 100 characters').optional()
  }).passthrough()
};

/**
 * Zod validation schema for Store Services endpoint:
 * GET /api/public/stores/:storeId/services
 */
const storeServicesQuerySchema = {
  params: z.object({
    id: z.union([
      z.coerce.number().int().positive('storeId must be a positive integer'),
      z.string().trim().min(1, 'storeId is required')
    ]).optional(),
    storeId: z.union([
      z.coerce.number().int().positive('storeId must be a positive integer'),
      z.string().trim().min(1, 'storeId is required')
    ]).optional()
  }).passthrough(),
  query: z.object({
    page: z.coerce.number().int('page must be an integer').min(1, 'page must be at least 1').optional().default(1),
    limit: z.coerce.number().int('limit must be an integer').min(1, 'limit must be at least 1').max(50, 'limit cannot exceed 50').optional().default(20),
    category: z.string().trim().max(100, 'category must not exceed 100 characters').optional(),
    search: z.string().trim().max(100, 'search term must not exceed 100 characters').optional(),
    q: z.string().trim().max(100, 'search query must not exceed 100 characters').optional()
  }).passthrough()
};

module.exports = {
  categoryStoresQuerySchema,
  categoryDetailParamSchema,
  storeProductsQuerySchema,
  storeServicesQuerySchema
};
