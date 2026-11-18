'use strict';

const express = require('express');
const router = express.Router();
const publicDiscoveryController = require('../../controllers/Storefront/publicDiscoveryController');
const { validateRequest } = require('../../middleware/validate');
const { citySearchSchema, discoverQuerySchema } = require('../../schemas/cityDiscoverySchema');
const {
  categoryStoresQuerySchema,
  categoryDetailParamSchema,
  storeProductsQuerySchema,
  storeServicesQuerySchema
} = require('../../schemas/storeDiscoverySchema');

// ── City Selection Endpoints ─────────────────────────────────
// GET /api/public/cities - Complete list of Indian cities across all 28 states & 8 UTs
router.get('/cities', publicDiscoveryController.getCities);

// GET /api/public/cities/search - Autocomplete city search
router.get('/cities/search', validateRequest(citySearchSchema), publicDiscoveryController.searchCities);

// GET /api/public/cities/:cityId/categories - Dynamic categories with active listings in this city
router.get('/cities/:cityId/categories', publicDiscoveryController.getCityAvailableCategories);

// GET /api/public/cities/:cityId - Individual city info by ID or slug
router.get('/cities/:cityId', (req, res, next) => {
  if (req.params.cityId === 'search') return publicDiscoveryController.searchCities(req, res, next);
  return publicDiscoveryController.getCityById(req, res, next);
});

// ── Category Discovery Endpoints ─────────────────────────────
// GET /api/public/categories - All root categories
router.get('/categories', publicDiscoveryController.getCategories);

// GET /api/public/categories/:categoryId/subcategories - Child subcategories
router.get('/categories/:categoryId/subcategories', publicDiscoveryController.getSubcategories);

// GET /api/public/categories/:categoryId/stores - Stores in category (Paginated, max limit 50)
router.get('/categories/:categoryId/stores', validateRequest(categoryStoresQuerySchema), publicDiscoveryController.getStoresByCategory);

// GET /api/public/categories/:categoryId - Category details by ID or slug
router.get('/categories/:categoryId', validateRequest(categoryDetailParamSchema), publicDiscoveryController.getCategoryById);

// ── Unified Discovery Endpoints ──────────────────────────────
// GET /api/public/discover - Search and filter products & services by city, category, subcategory, keyword
router.get('/discover', validateRequest(discoverQuerySchema), publicDiscoveryController.discover);

// ── Public Store Catalog Endpoints (Paginated, max limit 50) ──
// GET /api/public/stores/:id/products & /items - Paginated catalog items
router.get([
  '/stores/:id/products',
  '/stores/:id/items',
  '/merchants/:id/products',
  '/merchants/:id/items',
  '/vendors/:id/products',
  '/vendors/:id/items'
], validateRequest(storeProductsQuerySchema), publicDiscoveryController.getStoreProducts);

// GET /api/public/stores/:id/services - Paginated services
router.get([
  '/stores/:id/services',
  '/merchants/:id/services',
  '/vendors/:id/services'
], validateRequest(storeServicesQuerySchema), publicDiscoveryController.getStoreServices);

// ── Public Detail Endpoints ──────────────────────────────────
// GET /api/public/products/:id - Product details with merchant and WhatsApp inquiry
router.get(['/products/:id', '/items/:id'], publicDiscoveryController.getProductById);

// GET /api/public/services/:id - Service details with merchant and WhatsApp inquiry
router.get('/services/:id', publicDiscoveryController.getServiceById);

// GET /api/public/merchants/:id - Merchant storefront with items, services, contacts
router.get(['/merchants/:id', '/vendors/:id', '/stores/:id'], publicDiscoveryController.getMerchantById);

module.exports = router;

