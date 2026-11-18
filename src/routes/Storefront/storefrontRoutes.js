const express = require('express');
const router = express.Router();
const storefrontController = require('../../controllers/Storefront/storefrontController');
const publicDiscoveryController = require('../../controllers/Storefront/publicDiscoveryController');
const { validateRequest } = require('../../middleware/validate');
const {
    categoryStoresQuerySchema,
    categoryDetailParamSchema,
    storeProductsQuerySchema,
    storeServicesQuerySchema
} = require('../../schemas/storeDiscoverySchema');

// ── Category to Store Browsing Aliases (Public) ─────────────
router.get('/categories/:categoryId/stores', validateRequest(categoryStoresQuerySchema), publicDiscoveryController.getStoresByCategory);
router.get('/categories/:categoryId', validateRequest(categoryDetailParamSchema), publicDiscoveryController.getCategoryById);

// ── Store Catalog Endpoints (Paginated, max limit 50) ─────────
router.get([
    '/stores/:id/products',
    '/stores/:id/items',
    '/vendors/:id/products',
    '/vendors/:id/items',
    '/merchants/:id/products',
    '/merchants/:id/items'
], validateRequest(storeProductsQuerySchema), publicDiscoveryController.getStoreProducts);

router.get([
    '/stores/:id/services',
    '/vendors/:id/services',
    '/merchants/:id/services'
], validateRequest(storeServicesQuerySchema), publicDiscoveryController.getStoreServices);

// GET /api/vendors/search - Location-aware storefront vendor discovery & search
router.get('/vendors/search', storefrontController.searchVendorsLocationAware);
router.get('/stores/search', storefrontController.searchVendorsLocationAware);

// GET /api/societies/:societyId/vendors - List ACTIVE vendors in a society
router.get('/societies/:societyId/vendors', storefrontController.getSocietyVendorsStorefront);

// GET /api/vendors/:vendorId - Vendor storefront details, services & items (Public)
router.get([
    '/vendors/:vendorId',
    '/vendors/:vendorId/details',
    '/stores/:vendorId',
    '/stores/:vendorId/details',
    '/merchants/:vendorId',
    '/merchants/:vendorId/details'
], (req, res, next) => {
    if (['pending', 'search', 'categories', 'locations'].includes(req.params.vendorId)) return next();
    return storefrontController.getVendorStorefront(req, res, next);
});

// GET /api/locations - Fetch available locations / areas / cities
router.get('/locations', storefrontController.getLocations);
router.get('/locations/suggestions', storefrontController.getLocations);
router.get('/locations/search', storefrontController.getLocations);
router.get('/locations/autocomplete', storefrontController.getLocations);

module.exports = router;
