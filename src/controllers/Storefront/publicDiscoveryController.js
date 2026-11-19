'use strict';

const { query } = require('../../models/db');
const { normalizeImageUrl, DEFAULT_PRODUCT_SERVICE_IMAGE } = require('../../utils/imageUtils');
const { maskAccountNumber, getVendorPaymentEligibility } = require('../../services/paymentEligibilityService');
const { resolveSocietyId } = require('../../utils/societyContext');

/**
 * Builds a direct WhatsApp order/inquiry URL for a product or service.
 */
function buildWhatsAppUrl(merchantPhone, storeName, itemOrServiceName, type = 'product') {
  if (!merchantPhone) return null;
  const digits = String(merchantPhone).replace(/\D/g, '');
  if (!digits || digits.length < 10) return null;
  const intlPhone = digits.length === 10 ? `91${digits}` : digits;

  const action = type === 'service' ? 'book / enquire about' : 'order';
  const text = `Hi ${storeName || 'Store'}, I would like to ${action} "${itemOrServiceName}" via InPinch.`;
  return `https://wa.me/${intlPhone}?text=${encodeURIComponent(text)}`;
}

/**
 * Helper to resolve city record from ID or slug or name.
 */
async function resolveCityRecord(cityParam) {
  if (!cityParam) return null;
  const val = String(cityParam).trim();

  // If numeric ID
  if (/^\d+$/.test(val)) {
    const res = await query(
      `SELECT city_id, name, slug, state, state_code, country, image_url, is_active, sort_order 
       FROM cities WHERE city_id = ? LIMIT 1`,
      [parseInt(val, 10)]
    ).catch(() => ({ rows: [] }));
    if (res.rows && res.rows.length > 0) return res.rows[0];
  }

  // Look up by slug or lowercase name
  const res = await query(
    `SELECT city_id, name, slug, state, state_code, country, image_url, is_active, sort_order 
     FROM cities 
     WHERE LOWER(slug) = LOWER(?) OR LOWER(name) = LOWER(?) 
     ORDER BY sort_order ASC LIMIT 1`,
    [val, val]
  ).catch(() => ({ rows: [] }));

  if (res.rows && res.rows.length > 0) return res.rows[0];

  // Fallback: check if active vendor exists with this city name directly
  const vendorCityRes = await query(
    `SELECT city FROM vendors 
     WHERE LOWER(TRIM(city)) = LOWER(TRIM(?)) AND UPPER(status) = 'ACTIVE' LIMIT 1`,
    [val]
  ).catch(() => ({ rows: [] }));

  if (vendorCityRes.rows && vendorCityRes.rows.length > 0) {
    const vCity = vendorCityRes.rows[0].city;
    return {
      city_id: null,
      name: vCity,
      slug: vCity.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      state: 'India',
      state_code: 'IN',
      country: 'India',
      is_active: true
    };
  }

  return null;
}

/**
 * Helper to resolve category record from ID or slug or name.
 */
async function resolveCategoryRecord(categoryParam) {
  if (!categoryParam) return null;
  const val = String(categoryParam).trim();

  if (/^\d+$/.test(val)) {
    const res = await query(
      `SELECT category_id, name, slug, type, parent_id, icon_url, image_url, display_order, is_active 
       FROM categories WHERE category_id = ? LIMIT 1`,
      [parseInt(val, 10)]
    ).catch(() => ({ rows: [] }));
    if (res.rows && res.rows.length > 0) return res.rows[0];
  }

  const res = await query(
    `SELECT category_id, name, slug, type, parent_id, icon_url, image_url, display_order, is_active 
     FROM categories 
     WHERE LOWER(slug) = LOWER(?) OR LOWER(name) = LOWER(?) 
     LIMIT 1`,
    [val, val]
  ).catch(() => ({ rows: [] }));

  return res.rows && res.rows.length > 0 ? res.rows[0] : null;
}

/**
 * 1. GET /api/public/cities
 * Returns the complete list of Indian cities across all 28 states & 8 UTs.
 * Unfiltered by merchant availability as required.
 */
async function getCities(req, res) {
  try {
    const { search, q, state, page, limit, all } = req.query;
    const searchTerm = (search || q || '').trim();
    const stateFilter = (state || '').trim();
    const returnAll = all === 'true' || all === '1';

    const pageNum = Math.max(1, parseInt(page || 1, 10));
    const limitNum = Math.min(500, Math.max(1, parseInt(limit || 50, 10)));
    const offset = (pageNum - 1) * limitNum;

    let whereConditions = ['is_active = TRUE'];
    let params = [];

    if (searchTerm) {
      whereConditions.push('(LOWER(name) LIKE ? OR LOWER(state) LIKE ? OR LOWER(slug) LIKE ?)');
      const pattern = `%${searchTerm.toLowerCase()}%`;
      params.push(pattern, pattern, pattern);
    }

    if (stateFilter) {
      whereConditions.push('(LOWER(state) = LOWER(?) OR LOWER(state_code) = LOWER(?))');
      params.push(stateFilter, stateFilter);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Total records count
    const countRes = await query(`SELECT COUNT(*) AS total FROM cities ${whereClause}`, params);
    const total_records = parseInt(countRes.rows[0]?.total || 0, 10);

    // Main query
    let sql = `
      SELECT city_id, name, slug, state, state_code, country, image_url, sort_order, is_active 
      FROM cities 
      ${whereClause} 
      ORDER BY sort_order ASC, name ASC
    `;

    if (!returnAll) {
      sql += ` LIMIT ${limitNum} OFFSET ${offset}`;
    }

    const result = await query(sql, params);

    const formattedCities = (result.rows || []).map(c => ({
      city_id: Number(c.city_id),
      id: Number(c.city_id),
      name: c.name,
      slug: c.slug,
      state: c.state,
      state_code: c.state_code,
      country: c.country || 'India',
      image_url: c.image_url || null,
      sort_order: c.sort_order,
      is_active: Boolean(c.is_active)
    }));

    const total_pages = returnAll ? 1 : (Math.ceil(total_records / limitNum) || 1);

    return res.status(200).json({
      success: true,
      message: 'Cities retrieved successfully',
      data: formattedCities,
      meta: {
        total_records,
        total_pages,
        current_page: returnAll ? 1 : pageNum,
        limit: returnAll ? total_records : limitNum
      }
    });
  } catch (error) {
    console.error('[getCities Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve cities list',
      error: error.message
    });
  }
}

/**
 * 2. GET /api/public/cities/search
 * Fast autocomplete search for cities by name or state.
 */
async function searchCities(req, res) {
  try {
    const q = (req.query.q || req.query.query || req.query.search || '').trim();
    const limitNum = Math.min(50, Math.max(1, parseInt(req.query.limit || 15, 10)));

    if (!q) {
      // Return top priority cities when no query is provided
      const topCitiesRes = await query(`
        SELECT city_id, name, slug, state, state_code, country, image_url, sort_order 
        FROM cities 
        WHERE is_active = TRUE 
        ORDER BY sort_order ASC, name ASC 
        LIMIT ?
      `, [limitNum]);

      return res.status(200).json({
        success: true,
        data: (topCitiesRes.rows || []).map(c => ({
          city_id: Number(c.city_id),
          id: Number(c.city_id),
          name: c.name,
          slug: c.slug,
          state: c.state,
          state_code: c.state_code,
          country: c.country || 'India',
          image_url: c.image_url || null
        }))
      });
    }

    const pattern = `%${q.toLowerCase()}%`;
    const prefixPattern = `${q.toLowerCase()}%`;

    const result = await query(`
      SELECT city_id, name, slug, state, state_code, country, image_url, sort_order,
             CASE 
               WHEN LOWER(name) = LOWER(?) THEN 0
               WHEN LOWER(name) LIKE ? THEN 1
               WHEN LOWER(state) LIKE ? THEN 2
               ELSE 3
             END AS match_priority
      FROM cities 
      WHERE is_active = TRUE 
        AND (LOWER(name) LIKE ? OR LOWER(state) LIKE ? OR LOWER(slug) LIKE ?)
      ORDER BY match_priority ASC, sort_order ASC, name ASC 
      LIMIT ?
    `, [q, prefixPattern, prefixPattern, pattern, pattern, pattern, limitNum]);

    const formatted = (result.rows || []).map(c => ({
      city_id: Number(c.city_id),
      id: Number(c.city_id),
      name: c.name,
      slug: c.slug,
      state: c.state,
      state_code: c.state_code,
      country: c.country || 'India',
      image_url: c.image_url || null
    }));

    return res.status(200).json({
      success: true,
      data: formatted
    });
  } catch (error) {
    console.error('[searchCities Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search cities',
      error: error.message
    });
  }
}

/**
 * 3. GET /api/public/cities/:cityId
 * Get specific city by numeric ID or slug.
 */
async function getCityById(req, res) {
  try {
    const { cityId } = req.params;
    const city = await resolveCityRecord(cityId);

    if (!city) {
      return res.status(404).json({
        success: false,
        message: `City '${cityId}' not found`
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        city_id: Number(city.city_id),
        id: Number(city.city_id),
        name: city.name,
        slug: city.slug,
        state: city.state,
        state_code: city.state_code,
        country: city.country || 'India',
        image_url: city.image_url || null,
        sort_order: city.sort_order,
        is_active: Boolean(city.is_active)
      }
    });
  } catch (error) {
    console.error('[getCityById Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve city details',
      error: error.message
    });
  }
}

/**
 * 4. GET /api/public/categories
 * Returns all root public categories with subcategory counts.
 */
async function getCategories(req, res) {
  try {
    const { type, include_subcategories } = req.query;
    const withSubs = include_subcategories === 'true' || include_subcategories === '1';

    let sql = `
      SELECT c.category_id, c.name, c.slug, c.type, c.icon_url, c.image_url, c.display_order, c.is_active,
             (SELECT COUNT(*) FROM categories sub WHERE sub.parent_id = c.category_id AND sub.is_active = TRUE) AS subcategories_count
      FROM categories c
      WHERE c.parent_id IS NULL AND c.is_active = TRUE
    `;
    const params = [];

    if (type && ['product', 'service'].includes(type.toLowerCase())) {
      sql += ` AND (c.type = ? OR c.type = 'all')`;
      params.push(type.toLowerCase());
    }

    sql += ` ORDER BY c.display_order ASC, c.name ASC`;

    const result = await query(sql, params);
    let categoriesList = result.rows || [];

    if (withSubs && categoriesList.length > 0) {
      const subRes = await query(`
        SELECT category_id, name, slug, type, parent_id, icon_url, image_url, display_order 
        FROM categories 
        WHERE parent_id IS NOT NULL AND is_active = TRUE 
        ORDER BY display_order ASC, name ASC
      `);
      const subsByParent = {};
      (subRes.rows || []).forEach(sub => {
        if (!subsByParent[sub.parent_id]) subsByParent[sub.parent_id] = [];
        subsByParent[sub.parent_id].push({
          category_id: Number(sub.category_id),
          id: Number(sub.category_id),
          name: sub.name,
          slug: sub.slug,
          type: sub.type,
          parent_id: Number(sub.parent_id)
        });
      });

      categoriesList = categoriesList.map(cat => ({
        ...cat,
        subcategories: subsByParent[cat.category_id] || []
      }));
    }

    const formatted = categoriesList.map(cat => ({
      category_id: Number(cat.category_id),
      id: Number(cat.category_id),
      name: cat.name,
      slug: cat.slug,
      type: cat.type || 'all',
      icon_url: cat.icon_url || null,
      image_url: cat.image_url || null,
      display_order: cat.display_order || 0,
      subcategories_count: parseInt(cat.subcategories_count || 0, 10),
      ...(withSubs ? { subcategories: cat.subcategories || [] } : {})
    }));

    return res.status(200).json({
      success: true,
      message: 'Categories retrieved successfully',
      data: formatted
    });
  } catch (error) {
    console.error('[getCategories Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve categories',
      error: error.message
    });
  }
}

/**
 * 5. GET /api/public/categories/:categoryId/subcategories
 * Returns subcategories for a given root category.
 */
async function getSubcategories(req, res) {
  try {
    const { categoryId } = req.params;
    const parent = await resolveCategoryRecord(categoryId);

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: `Category '${categoryId}' not found`
      });
    }

    const subRes = await query(`
      SELECT category_id, name, slug, type, parent_id, icon_url, image_url, display_order, is_active 
      FROM categories 
      WHERE parent_id = ? AND is_active = TRUE 
      ORDER BY display_order ASC, name ASC
    `, [parent.category_id]);

    const formattedSubs = (subRes.rows || []).map(sub => ({
      category_id: Number(sub.category_id),
      id: Number(sub.category_id),
      name: sub.name,
      slug: sub.slug,
      type: sub.type || 'all',
      parent_id: Number(sub.parent_id),
      icon_url: sub.icon_url || null,
      image_url: sub.image_url || null
    }));

    return res.status(200).json({
      success: true,
      category: {
        category_id: Number(parent.category_id),
        id: Number(parent.category_id),
        name: parent.name,
        slug: parent.slug,
        type: parent.type || 'all',
        icon_url: parent.icon_url || null,
        image_url: parent.image_url || null
      },
      data: formattedSubs
    });
  } catch (error) {
    console.error('[getSubcategories Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve subcategories',
      error: error.message
    });
  }
}

/**
 * 5b. GET /api/public/categories/:categoryId
 * Get complete details of a single category by ID, slug, or name,
 * including subcategories and active store count.
 */
async function getCategoryById(req, res) {
  try {
    const { categoryId } = req.params;
    const cat = await resolveCategoryRecord(categoryId);

    if (!cat || !cat.is_active) {
      return res.status(404).json({
        success: false,
        message: `Category '${categoryId}' not found`,
        data: null
      });
    }

    // Get active child subcategories
    const subRes = await query(
      `SELECT category_id, name, slug, type, parent_id, icon_url, image_url, display_order, is_active 
       FROM categories 
       WHERE parent_id = ? AND is_active = TRUE 
       ORDER BY display_order ASC, name ASC`,
      [cat.category_id]
    ).catch(() => ({ rows: [] }));

    const subcategories = (subRes.rows || []).map(s => ({
      category_id: Number(s.category_id),
      id: Number(s.category_id),
      name: s.name,
      slug: s.slug,
      type: s.type || 'all',
      parent_id: Number(s.parent_id),
      icon_url: s.icon_url || null,
      image_url: s.image_url || null,
      display_order: s.display_order || 0
    }));

    // Collect all matching category names (category + subcategories)
    const eligibleNames = [cat.name.toLowerCase(), cat.slug.toLowerCase()];
    subcategories.forEach(s => {
      eligibleNames.push(s.name.toLowerCase(), s.slug.toLowerCase());
    });

    const catPlaceholders = eligibleNames.map(() => '?').join(', ');

    // Count eligible active stores in this category
    const countSql = `
      SELECT COUNT(DISTINCT v.vendor_id) AS total_stores
      FROM vendors v
      WHERE UPPER(v.status) = 'ACTIVE'
        AND (
          LOWER(TRIM(COALESCE(v.category, ''))) IN (${catPlaceholders})
          OR EXISTS (
            SELECT 1 FROM items i 
            WHERE i.vendor_id = v.vendor_id 
              AND (i.in_stock = TRUE OR i.is_available = TRUE)
              AND LOWER(TRIM(COALESCE(i.category, ''))) IN (${catPlaceholders})
          )
          OR EXISTS (
            SELECT 1 FROM services srv 
            WHERE srv.vendor_id = v.vendor_id 
              AND COALESCE(srv.is_available, TRUE) = TRUE
              AND LOWER(TRIM(COALESCE(srv.category, ''))) IN (${catPlaceholders})
          )
        )
    `;

    const countRes = await query(countSql, [...eligibleNames, ...eligibleNames, ...eligibleNames]).catch(() => ({ rows: [{ total_stores: 0 }] }));
    const storesCount = parseInt(countRes.rows[0]?.total_stores || 0, 10);

    return res.status(200).json({
      success: true,
      message: 'Category retrieved successfully',
      data: {
        category_id: Number(cat.category_id),
        id: Number(cat.category_id),
        name: cat.name,
        slug: cat.slug,
        type: cat.type || 'all',
        parent_id: cat.parent_id ? Number(cat.parent_id) : null,
        icon_url: cat.icon_url || null,
        image_url: cat.image_url || null,
        display_order: cat.display_order || 0,
        subcategories_count: subcategories.length,
        stores_count: storesCount,
        subcategories
      }
    });
  } catch (error) {
    console.error('[getCategoryById Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve category details',
      error: error.message
    });
  }
}

/**
 * 5c. GET /api/public/categories/:categoryId/stores
 * Category Detail Page: Stores belonging to the selected category.
 * Enforces strict maximum pagination limit of 50.
 * Returns public store info: ID, name, logo, description, address, rating, active subscription, etc.
 */
async function getStoresByCategory(req, res) {
  try {
    const { categoryId } = req.params;
    const cat = await resolveCategoryRecord(categoryId);

    if (!cat || !cat.is_active) {
      return res.status(404).json({
        success: false,
        message: `Category '${categoryId}' not found`,
        data: []
      });
    }

    const {
      page = 1,
      limit = 20,
      search,
      q,
      city,
      sort = 'rating'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    // Enforce strict maximum page size of 50 per requirement
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;
    const searchTerm = (search || q || '').trim();
    const cityFilter = (city || '').trim();

    // Gather child subcategories
    const subRes = await query(
      `SELECT category_id, name, slug FROM categories WHERE parent_id = ? AND is_active = TRUE`,
      [cat.category_id]
    ).catch(() => ({ rows: [] }));

    const eligibleNames = [cat.name.toLowerCase(), cat.slug.toLowerCase()];
    (subRes.rows || []).forEach(s => {
      eligibleNames.push(s.name.toLowerCase(), s.slug.toLowerCase());
    });

    const catPlaceholders = eligibleNames.map(() => '?').join(', ');

    let whereConditions = [
      "UPPER(v.status) = 'ACTIVE'",
      `(
        LOWER(TRIM(COALESCE(v.category, ''))) IN (${catPlaceholders})
        OR EXISTS (
          SELECT 1 FROM items i 
          WHERE i.vendor_id = v.vendor_id 
            AND (i.in_stock = TRUE OR i.is_available = TRUE)
            AND LOWER(TRIM(COALESCE(i.category, ''))) IN (${catPlaceholders})
        )
        OR EXISTS (
          SELECT 1 FROM services srv 
          WHERE srv.vendor_id = v.vendor_id 
            AND COALESCE(srv.is_available, TRUE) = TRUE
            AND LOWER(TRIM(COALESCE(srv.category, ''))) IN (${catPlaceholders})
        )
      )`
    ];
    let queryParams = [...eligibleNames, ...eligibleNames, ...eligibleNames];

    const targetSocId = await resolveSocietyId(req);
    if (targetSocId) {
      whereConditions.push('v.society_id = ?');
      queryParams.push(targetSocId);
    }

    if (cityFilter) {
      whereConditions.push(`(
        LOWER(TRIM(COALESCE(v.city, ''))) = LOWER(TRIM(?))
        OR LOWER(TRIM(COALESCE(s.city, ''))) = LOWER(TRIM(?))
      )`);
      queryParams.push(cityFilter, cityFilter);
    }

    if (searchTerm) {
      whereConditions.push(`(
        LOWER(v.store_name) LIKE ?
        OR LOWER(v.vendor_name) LIKE ?
        OR LOWER(COALESCE(v.description, '')) LIKE ?
        OR LOWER(COALESCE(v.area, '')) LIKE ?
        OR LOWER(COALESCE(v.address, '')) LIKE ?
      )`);
      const searchPattern = `%${searchTerm.toLowerCase()}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const whereClause = whereConditions.join(' AND ');

    // Total count of matching eligible stores
    const countSql = `
      SELECT COUNT(DISTINCT v.vendor_id) AS total
      FROM vendors v
      LEFT JOIN societies s ON v.society_id = s.society_id
      WHERE ${whereClause}
    `;
    const countRes = await query(countSql, queryParams);
    const total_records = parseInt(countRes.rows[0]?.total || 0, 10);

    // Sorting
    let orderBy = 'ORDER BY v.avg_rating DESC, v.rating_count DESC, v.store_name ASC';
    if (sort === 'name') {
      orderBy = 'ORDER BY v.store_name ASC';
    } else if (sort === 'newest') {
      orderBy = 'ORDER BY v.vendor_id DESC';
    }

    // Stores select query
    const selectSql = `
      SELECT v.vendor_id, v.public_id, v.store_name, v.vendor_name, v.owner_name,
             v.category, v.vendor_type, v.description, v.logo, v.shop_image,
             v.address, v.area, v.city, v.state, v.pincode,
             v.phone_number, v.whatsapp_number, v.opening_time, v.closing_time,
             v.avg_rating, v.rating_count, v.status,
             s.society_name, s.city AS society_city,
             EXISTS (
               SELECT 1 FROM subscriptions sub 
               WHERE sub.vendor_id = v.vendor_id 
                 AND UPPER(sub.status) = 'ACTIVE' 
                 AND sub.end_date >= CURRENT_DATE
             ) AS is_subscription_active
      FROM vendors v
      LEFT JOIN societies s ON v.society_id = s.society_id
      WHERE ${whereClause}
      ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const selectParams = [...queryParams, limitNum, offset];
    const result = await query(selectSql, selectParams);

    const stores = (result.rows || []).map(v => {
      const rawImage = v.logo || v.shop_image || null;
      const finalImage = rawImage
        ? (typeof normalizeImageUrl === 'function' ? normalizeImageUrl(rawImage) : rawImage)
        : null;
      const isSubActive = Boolean(v.is_subscription_active);
      const rating = parseFloat(v.avg_rating || 0);
      const ratingCount = parseInt(v.rating_count || 0, 10);

      return {
        store_id: Number(v.vendor_id),
        id: Number(v.vendor_id),
        vendor_id: Number(v.vendor_id),
        public_id: v.public_id || ('vnd@' + String(v.vendor_id).padStart(4, '0')),
        store_name: v.store_name || v.vendor_name || 'Store',
        vendor_name: v.vendor_name || v.store_name || 'Store Manager',
        owner_name: v.owner_name || v.vendor_name || '',
        category: v.category || cat.name,
        vendor_type: v.vendor_type || 'product',
        description: v.description || '',
        logo: finalImage,
        shop_image: finalImage,
        image_url: finalImage,
        image: finalImage,
        address: v.address || '',
        area: v.area || '',
        city: v.city || v.society_city || '',
        state: v.state || '',
        pincode: v.pincode || '',
        phone: v.phone_number || '',
        phone_number: v.phone_number || '',
        whatsapp_number: v.whatsapp_number || null,
        opening_time: v.opening_time || null,
        closing_time: v.closing_time || null,
        rating: rating,
        avg_rating: rating,
        rating_count: ratingCount,
        reviews_count: ratingCount,
        is_subscription_active: isSubActive,
        subscription_active: isSubActive,
        is_order_eligible: isSubActive,
        can_accept_orders: isSubActive,
        status: String(v.status || 'ACTIVE').toLowerCase()
      };
    });

    const total_pages = Math.ceil(total_records / limitNum) || 1;

    return res.status(200).json({
      success: true,
      message: 'Stores retrieved successfully',
      category: {
        category_id: Number(cat.category_id),
        id: Number(cat.category_id),
        name: cat.name,
        slug: cat.slug,
        type: cat.type || 'all',
        icon_url: cat.icon_url || null,
        image_url: cat.image_url || null
      },
      data: stores,
      pagination: {
        total_records,
        total_pages,
        current_page: pageNum,
        page_size: limitNum,
        has_next: pageNum < total_pages,
        has_prev: pageNum > 1
      }
    });
  } catch (error) {
    console.error('[getStoresByCategory Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve stores for category',
      error: error.message
    });
  }
}

/**
 * 6. GET /api/public/cities/:cityId/categories
 * CRITICAL REQUIREMENT:
 * Returns ONLY categories that actually have eligible products, services, or merchants in the selected city.
 * Categories with 0 active listings in that city are excluded.
 */
async function getCityAvailableCategories(req, res) {
  try {
    const { cityId } = req.params;
    const city = await resolveCityRecord(cityId);

    if (!city) {
      return res.status(404).json({
        success: false,
        message: `City '${cityId}' not found`,
        data: []
      });
    }

    const cityName = city.name;

    // CTE query: collects all distinct category names/slugs present in active vendors, items, and services in this city
    const sql = `
      WITH city_listings AS (
        -- Category from active vendors in this city
        SELECT DISTINCT LOWER(TRIM(v.category)) AS cat_name, v.vendor_id, 'vendor' AS source
        FROM vendors v
        LEFT JOIN societies soc ON v.society_id = soc.society_id
        WHERE UPPER(v.status) = 'ACTIVE'
          AND (LOWER(TRIM(COALESCE(v.city, ''))) = LOWER(TRIM($1))
               OR LOWER(TRIM(COALESCE(soc.city, ''))) = LOWER(TRIM($1)))
          AND v.category IS NOT NULL AND TRIM(v.category) != ''

        UNION ALL

        -- Category from active items of vendors in this city
        SELECT DISTINCT LOWER(TRIM(i.category)) AS cat_name, i.vendor_id, 'item' AS source
        FROM items i
        JOIN vendors v ON i.vendor_id = v.vendor_id
        LEFT JOIN societies soc ON v.society_id = soc.society_id
        WHERE UPPER(v.status) = 'ACTIVE'
          AND (LOWER(TRIM(COALESCE(v.city, ''))) = LOWER(TRIM($1))
               OR LOWER(TRIM(COALESCE(soc.city, ''))) = LOWER(TRIM($1)))
          AND i.category IS NOT NULL AND TRIM(i.category) != ''

        UNION ALL

        -- Category from active services of vendors in this city
        SELECT DISTINCT LOWER(TRIM(srv.category)) AS cat_name, srv.vendor_id, 'service' AS source
        FROM services srv
        JOIN vendors v ON srv.vendor_id = v.vendor_id
        LEFT JOIN societies soc ON v.society_id = soc.society_id
        WHERE UPPER(v.status) = 'ACTIVE'
          AND (LOWER(TRIM(COALESCE(v.city, ''))) = LOWER(TRIM($1))
               OR LOWER(TRIM(COALESCE(soc.city, ''))) = LOWER(TRIM($1)))
          AND srv.category IS NOT NULL AND TRIM(srv.category) != ''
      )
      SELECT c.category_id, c.name, c.slug, c.type, c.icon_url, c.image_url, c.display_order,
             (SELECT COUNT(*) FROM categories sub WHERE sub.parent_id = c.category_id AND sub.is_active = TRUE) AS subcategories_count,
             COUNT(DISTINCT cl.vendor_id) AS available_merchants_count,
             COUNT(cl.source) AS available_listings_count
      FROM categories c
      JOIN city_listings cl ON (
        LOWER(TRIM(c.name)) = cl.cat_name
        OR LOWER(TRIM(c.slug)) = cl.cat_name
        OR EXISTS (
          SELECT 1 FROM categories sub
          WHERE sub.parent_id = c.category_id
            AND (LOWER(TRIM(sub.name)) = cl.cat_name OR LOWER(TRIM(sub.slug)) = cl.cat_name)
        )
      )
      WHERE c.parent_id IS NULL AND c.is_active = TRUE
      GROUP BY c.category_id, c.name, c.slug, c.type, c.icon_url, c.image_url, c.display_order
      HAVING COUNT(cl.vendor_id) > 0
      ORDER BY c.display_order ASC, c.name ASC
    `;

    const result = await query(sql, [cityName]);

    const formattedCategories = (result.rows || []).map(cat => ({
      category_id: Number(cat.category_id),
      id: Number(cat.category_id),
      name: cat.name,
      slug: cat.slug,
      type: cat.type || 'all',
      icon_url: cat.icon_url || null,
      image_url: cat.image_url || null,
      display_order: cat.display_order || 0,
      subcategories_count: parseInt(cat.subcategories_count || 0, 10),
      available_merchants_count: parseInt(cat.available_merchants_count || 0, 10),
      available_listings_count: parseInt(cat.available_listings_count || 0, 10)
    }));

    return res.status(200).json({
      success: true,
      city: {
        city_id: city.city_id ? Number(city.city_id) : null,
        name: city.name,
        slug: city.slug,
        state: city.state
      },
      data: formattedCategories
    });
  } catch (error) {
    console.error('[getCityAvailableCategories Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve available categories for city',
      error: error.message
    });
  }
}

/**
 * 7. GET /api/public/discover
 * Unified Discovery API for Products and Services:
 * Filters by city, category, subcategory, search keywords, type (product/service/all), sorting and pagination.
 */
async function discover(req, res) {
  try {
    const {
      city_id,
      city,
      category_id,
      category,
      subcategory_id,
      subcategory,
      type = 'all',
      q,
      search,
      page = 1,
      limit = 20,
      sort = 'recommended'
    } = req.query;

    const searchTerm = (search || q || '').trim();
    const listingType = String(type).toLowerCase(); // 'product', 'service', 'all'
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    // Resolve City if provided
    let cityRecord = null;
    const cityInput = city_id || city;
    if (cityInput) {
      cityRecord = await resolveCityRecord(cityInput);
    }

    // Resolve Category / Subcategory if provided
    let categoryRecord = null;
    const catInput = subcategory_id || subcategory || category_id || category;
    if (catInput) {
      categoryRecord = await resolveCategoryRecord(catInput);
    }

    // Gather eligible category names / slugs for query matching
    let eligibleCatNames = [];
    if (categoryRecord) {
      eligibleCatNames.push(categoryRecord.name.toLowerCase(), categoryRecord.slug.toLowerCase());
      // If it's a root category, include all its child subcategories
      if (!categoryRecord.parent_id) {
        const childCats = await query(
          `SELECT name, slug FROM categories WHERE parent_id = ? AND is_active = TRUE`,
          [categoryRecord.category_id]
        ).catch(() => ({ rows: [] }));
        childCats.rows.forEach(c => {
          eligibleCatNames.push(c.name.toLowerCase(), c.slug.toLowerCase());
        });
      }
    }

    const cityName = cityRecord?.name || null;
    const targetSocId = await resolveSocietyId(req);

    // Build Product Query
    const shouldFetchProducts = listingType === 'all' || listingType === 'product';
    const shouldFetchServices = listingType === 'all' || listingType === 'service';

    let productSql = '';
    let productParams = [];
    if (shouldFetchProducts) {
      let pWhere = ["UPPER(v.status) = 'ACTIVE'"];
      if (targetSocId) {
        pWhere.push(`v.society_id = $${productParams.length + 1}`);
        productParams.push(targetSocId);
      }
      if (cityName) {
        pWhere.push(`(LOWER(TRIM(COALESCE(v.city, ''))) = LOWER(TRIM($${productParams.length + 1})) OR LOWER(TRIM(COALESCE(soc.city, ''))) = LOWER(TRIM($${productParams.length + 1})))`);
        productParams.push(cityName);
      }
      if (eligibleCatNames.length > 0) {
        const placeholders = eligibleCatNames.map((_, i) => `$${productParams.length + i + 1}`).join(', ');
        pWhere.push(`(LOWER(TRIM(COALESCE(i.category, ''))) IN (${placeholders}) OR LOWER(TRIM(COALESCE(v.category, ''))) IN (${placeholders}))`);
        productParams.push(...eligibleCatNames);
      }
      if (searchTerm) {
        const searchIdx = productParams.length + 1;
        pWhere.push(`(
          LOWER(i.item_name) LIKE $${searchIdx}
          OR LOWER(COALESCE(i.description, '')) LIKE $${searchIdx}
          OR LOWER(v.store_name) LIKE $${searchIdx}
          OR LOWER(COALESCE(i.category, '')) LIKE $${searchIdx}
        )`);
        productParams.push(`%${searchTerm.toLowerCase()}%`);
      }

      productSql = `
        SELECT 
          i.item_id AS id,
          'product' AS type,
          i.item_name AS name,
          i.description,
          i.price,
          0.00 AS visiting_charge,
          NULL AS estimated_duration,
          i.image_url,
          i.category,
          (COALESCE(i.in_stock, TRUE) AND COALESCE(i.is_available, TRUE)) AS is_available,
          i.created_at,
          v.vendor_id,
          v.store_name,
          v.vendor_name,
          COALESCE(v.city, soc.city, '') AS merchant_city,
          v.area AS merchant_area,
          v.address AS merchant_address,
          v.phone_number AS merchant_phone,
          v.whatsapp_number AS merchant_whatsapp,
          v.shop_image AS merchant_image,
          v.status AS merchant_status
        FROM items i
        JOIN vendors v ON i.vendor_id = v.vendor_id
        LEFT JOIN societies soc ON v.society_id = soc.society_id
        WHERE ${pWhere.join(' AND ')}
      `;
    }

    // Build Service Query
    let serviceSql = '';
    let serviceParams = [];
    if (shouldFetchServices) {
      let sWhere = ["UPPER(v.status) = 'ACTIVE'"];
      if (targetSocId) {
        sWhere.push(`v.society_id = $${serviceParams.length + 1}`);
        serviceParams.push(targetSocId);
      }
      if (cityName) {
        sWhere.push(`(LOWER(TRIM(COALESCE(v.city, ''))) = LOWER(TRIM($${serviceParams.length + 1})) OR LOWER(TRIM(COALESCE(soc.city, ''))) = LOWER(TRIM($${serviceParams.length + 1})))`);
        serviceParams.push(cityName);
      }
      if (eligibleCatNames.length > 0) {
        const placeholders = eligibleCatNames.map((_, i) => `$${serviceParams.length + i + 1}`).join(', ');
        sWhere.push(`(LOWER(TRIM(COALESCE(srv.category, ''))) IN (${placeholders}) OR LOWER(TRIM(COALESCE(v.category, ''))) IN (${placeholders}))`);
        serviceParams.push(...eligibleCatNames);
      }
      if (searchTerm) {
        const searchIdx = serviceParams.length + 1;
        sWhere.push(`(
          LOWER(srv.service_name) LIKE $${searchIdx}
          OR LOWER(COALESCE(srv.description, '')) LIKE $${searchIdx}
          OR LOWER(v.store_name) LIKE $${searchIdx}
          OR LOWER(COALESCE(srv.category, '')) LIKE $${searchIdx}
        )`);
        serviceParams.push(`%${searchTerm.toLowerCase()}%`);
      }

      serviceSql = `
        SELECT 
          srv.service_id AS id,
          'service' AS type,
          srv.service_name AS name,
          srv.description,
          srv.price,
          COALESCE(srv.visiting_charge, 0.00) AS visiting_charge,
          srv.estimated_duration,
          srv.image_url,
          srv.category,
          COALESCE(srv.is_available, TRUE) AS is_available,
          srv.created_at,
          v.vendor_id,
          v.store_name,
          v.vendor_name,
          COALESCE(v.city, soc.city, '') AS merchant_city,
          v.area AS merchant_area,
          v.address AS merchant_address,
          v.phone_number AS merchant_phone,
          v.whatsapp_number AS merchant_whatsapp,
          v.shop_image AS merchant_image,
          v.status AS merchant_status
        FROM services srv
        JOIN vendors v ON srv.vendor_id = v.vendor_id
        LEFT JOIN societies soc ON v.society_id = soc.society_id
        WHERE ${sWhere.join(' AND ')}
      `;
    }

    // Execute queries
    let allRows = [];
    if (shouldFetchProducts && shouldFetchServices) {
      const [prodRes, servRes] = await Promise.all([
        query(productSql, productParams),
        query(serviceSql, serviceParams)
      ]);
      allRows = [...(prodRes.rows || []), ...(servRes.rows || [])];
    } else if (shouldFetchProducts) {
      const prodRes = await query(productSql, productParams);
      allRows = prodRes.rows || [];
    } else if (shouldFetchServices) {
      const servRes = await query(serviceSql, serviceParams);
      allRows = servRes.rows || [];
    }

    // Sorting
    if (sort === 'price_asc') {
      allRows.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (sort === 'price_desc') {
      allRows.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    } else if (sort === 'newest') {
      allRows.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else {
      // 'recommended' or default: sort by created_at DESC
      allRows.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    const total_records = allRows.length;
    const paginatedRows = allRows.slice(offset, offset + limitNum);

    const formattedResults = paginatedRows.map(row => {
      const finalImage = typeof normalizeImageUrl === 'function'
        ? normalizeImageUrl(row.image_url, DEFAULT_PRODUCT_SERVICE_IMAGE)
        : (row.image_url || DEFAULT_PRODUCT_SERVICE_IMAGE);

      const merchantImg = typeof normalizeImageUrl === 'function'
        ? normalizeImageUrl(row.merchant_image)
        : row.merchant_image;

      const waPhone = row.merchant_whatsapp || row.merchant_phone;
      const waUrl = buildWhatsAppUrl(waPhone, row.store_name, row.name, row.type);

      return {
        id: Number(row.id),
        type: row.type, // 'product' | 'service'
        name: row.name,
        description: row.description || '',
        price: parseFloat(row.price || 0),
        visiting_charge: parseFloat(row.visiting_charge || 0),
        estimated_duration: row.estimated_duration || (row.type === 'service' ? '1 hour' : null),
        image_url: finalImage,
        image: finalImage,
        category: row.category || 'General',
        is_available: Boolean(row.is_available),
        whatsapp_order_url: waUrl,
        merchant: {
          vendor_id: Number(row.vendor_id),
          id: Number(row.vendor_id),
          store_name: row.store_name,
          vendor_name: row.vendor_name,
          city: row.merchant_city,
          area: row.merchant_area,
          address: row.merchant_address,
          phone: row.merchant_phone,
          whatsapp_number: row.merchant_whatsapp || null,
          image: merchantImg,
          shop_image: merchantImg,
          status: row.merchant_status
        }
      };
    });

    const total_pages = Math.ceil(total_records / limitNum) || 1;

    return res.status(200).json({
      success: true,
      city: cityRecord ? {
        city_id: cityRecord.city_id ? Number(cityRecord.city_id) : null,
        name: cityRecord.name,
        slug: cityRecord.slug,
        state: cityRecord.state
      } : null,
      category: categoryRecord ? {
        category_id: Number(categoryRecord.category_id),
        name: categoryRecord.name,
        slug: categoryRecord.slug,
        type: categoryRecord.type
      } : null,
      type: listingType,
      data: formattedResults,
      meta: {
        total_records,
        total_pages,
        current_page: pageNum,
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('[discover Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to discover listings',
      error: error.message
    });
  }
}

/**
 * 8. GET /api/public/products/:id
 * Public product details with merchant info and WhatsApp deep link.
 */
async function getProductById(req, res) {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT 
        i.item_id, i.vendor_id, i.item_name, i.price, i.category, i.description, 
        i.image_url, i.in_stock, i.stock, i.unit, i.is_available, i.created_at,
        v.store_name, v.vendor_name, v.owner_name, v.phone_number, v.whatsapp_number,
        v.city AS merchant_city, v.area AS merchant_area, v.address AS merchant_address,
        v.shop_image, v.opening_time, v.closing_time, v.status AS merchant_status,
        v.society_id, soc.society_name, soc.city AS society_city
      FROM items i
      JOIN vendors v ON i.vendor_id = v.vendor_id
      LEFT JOIN societies soc ON v.society_id = soc.society_id
      WHERE i.item_id = ? AND UPPER(v.status) = 'ACTIVE'
      LIMIT 1
    `, [id]);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Product #${id} not found or merchant is not active`
      });
    }

    const row = result.rows[0];

    // Strict society isolation: Reject if requested under a different society context
    const targetSocId = await resolveSocietyId(req);
    if (targetSocId && Number(row.society_id) !== targetSocId) {
      return res.status(404).json({
        success: false,
        message: `Product #${id} not found in the selected society`,
        data: null
      });
    }
    const finalImage = typeof normalizeImageUrl === 'function'
      ? normalizeImageUrl(row.image_url, DEFAULT_PRODUCT_SERVICE_IMAGE)
      : (row.image_url || DEFAULT_PRODUCT_SERVICE_IMAGE);

    const merchantImg = typeof normalizeImageUrl === 'function'
      ? normalizeImageUrl(row.shop_image)
      : row.shop_image;

    const waPhone = row.whatsapp_number || row.phone_number;
    const waUrl = buildWhatsAppUrl(waPhone, row.store_name, row.item_name, 'product');
    const inStock = Boolean(row.in_stock) && (row.is_available === null || Boolean(row.is_available));

    return res.status(200).json({
      success: true,
      data: {
        product_id: Number(row.item_id),
        id: Number(row.item_id),
        name: row.item_name,
        price: parseFloat(row.price || 0),
        category: row.category || 'General',
        description: row.description || '',
        image_url: finalImage,
        image: finalImage,
        images: finalImage ? [finalImage] : [],
        unit: row.unit || 'piece',
        in_stock: inStock,
        is_available: inStock,
        whatsapp_order_url: waUrl,
        created_at: row.created_at,
        merchant: {
          vendor_id: Number(row.vendor_id),
          id: Number(row.vendor_id),
          store_name: row.store_name,
          vendor_name: row.vendor_name,
          city: row.merchant_city || row.society_city,
          area: row.merchant_area,
          address: row.merchant_address,
          society_name: row.society_name || null,
          phone: row.phone_number,
          whatsapp_number: row.whatsapp_number || null,
          opening_time: row.opening_time,
          closing_time: row.closing_time,
          image: merchantImg,
          shop_image: merchantImg,
          status: row.merchant_status
        }
      }
    });
  } catch (error) {
    console.error('[getProductById Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve product details',
      error: error.message
    });
  }
}

/**
 * 9. GET /api/public/services/:id
 * Public service details with merchant info and WhatsApp deep link.
 */
async function getServiceById(req, res) {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT 
        srv.service_id, srv.vendor_id, srv.service_name, srv.price, srv.visiting_charge,
        srv.estimated_duration, srv.service_location, srv.description, srv.image_url,
        srv.is_available, srv.category, srv.created_at, srv.updated_at,
        v.store_name, v.vendor_name, v.phone_number, v.whatsapp_number,
        v.city AS merchant_city, v.area AS merchant_area, v.address AS merchant_address,
        v.shop_image, v.opening_time, v.closing_time, v.status AS merchant_status,
        v.society_id, soc.society_name, soc.city AS society_city
      FROM services srv
      JOIN vendors v ON srv.vendor_id = v.vendor_id
      LEFT JOIN societies soc ON v.society_id = soc.society_id
      WHERE srv.service_id = ? AND UPPER(v.status) = 'ACTIVE'
      LIMIT 1
    `, [id]);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Service #${id} not found or merchant is not active`
      });
    }

    const row = result.rows[0];

    // Strict society isolation: Reject if requested under a different society context
    const targetSocId = await resolveSocietyId(req);
    if (targetSocId && Number(row.society_id) !== targetSocId) {
      return res.status(404).json({
        success: false,
        message: `Service #${id} not found in the selected society`,
        data: null
      });
    }
    const finalImage = typeof normalizeImageUrl === 'function'
      ? normalizeImageUrl(row.image_url, DEFAULT_PRODUCT_SERVICE_IMAGE)
      : (row.image_url || DEFAULT_PRODUCT_SERVICE_IMAGE);

    const merchantImg = typeof normalizeImageUrl === 'function'
      ? normalizeImageUrl(row.shop_image)
      : row.shop_image;

    const waPhone = row.whatsapp_number || row.phone_number;
    const waUrl = buildWhatsAppUrl(waPhone, row.store_name, row.service_name, 'service');

    return res.status(200).json({
      success: true,
      data: {
        service_id: Number(row.service_id),
        id: Number(row.service_id),
        name: row.service_name,
        price: parseFloat(row.price || 0),
        visiting_charge: parseFloat(row.visiting_charge || 0),
        estimated_duration: row.estimated_duration || '1 hour',
        service_location: row.service_location || "At Customer's Doorstep",
        category: row.category || 'General Services',
        description: row.description || '',
        image_url: finalImage,
        image: finalImage,
        images: finalImage ? [finalImage] : [],
        is_available: Boolean(row.is_available),
        whatsapp_order_url: waUrl,
        created_at: row.created_at,
        merchant: {
          vendor_id: Number(row.vendor_id),
          id: Number(row.vendor_id),
          store_name: row.store_name,
          vendor_name: row.vendor_name,
          city: row.merchant_city || row.society_city,
          area: row.merchant_area,
          address: row.merchant_address,
          society_name: row.society_name || null,
          phone: row.phone_number,
          whatsapp_number: row.whatsapp_number || null,
          opening_time: row.opening_time,
          closing_time: row.closing_time,
          image: merchantImg,
          shop_image: merchantImg,
          status: row.merchant_status
        }
      }
    });
  } catch (error) {
    console.error('[getServiceById Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve service details',
      error: error.message
    });
  }
}

/**
 * 10. GET /api/public/merchants/:id, GET /api/public/stores/:id
 * Public store/merchant detail endpoint (products + services + store info).
 * Supports pagination for embedded items with maximum limit 50.
 * Strips sensitive financial, authentication, and internal merchant data.
 */
async function getMerchantById(req, res) {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT 
        v.vendor_id, v.public_id, v.society_id, v.vendor_name, v.store_name, v.owner_name,
        v.email, v.phone_number, v.whatsapp_number, v.shop_number, v.shop_image, v.logo,
        v.category, v.address, v.city, v.state, v.pincode, v.area, v.description,
        v.opening_time, v.closing_time, v.status, v.vendor_type,
        v.avg_rating, v.rating_count,
        s.society_name, s.city AS society_city,
        EXISTS (
          SELECT 1 FROM subscriptions sub 
          WHERE sub.vendor_id = v.vendor_id 
            AND UPPER(sub.status) = 'ACTIVE' 
            AND sub.end_date >= CURRENT_DATE
        ) AS is_subscription_active
      FROM vendors v
      LEFT JOIN societies s ON v.society_id = s.society_id
      WHERE (CAST(v.vendor_id AS TEXT) = ? OR v.public_id = ? OR LOWER(v.store_name) = LOWER(?))
        AND UPPER(v.status) = 'ACTIVE'
      LIMIT 1
    `, [String(id), String(id), String(id)]);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Store '${id}' not found or inactive`
      });
    }

    const vendor = result.rows[0];

    // Strict society isolation: Reject if requested under a different society context
    const targetSocId = await resolveSocietyId(req);
    if (targetSocId && Number(vendor.society_id) !== targetSocId) {
      return res.status(404).json({
        success: false,
        message: `Store '${id}' not found in the selected society`,
        data: null
      });
    }
    const rawImage = vendor.logo || vendor.shop_image || null;
    const finalImage = rawImage
      ? (typeof normalizeImageUrl === 'function' ? normalizeImageUrl(rawImage) : rawImage)
      : null;

    const isSubActive = Boolean(vendor.is_subscription_active);
    const rating = parseFloat(vendor.avg_rating || 0);
    const ratingCount = parseInt(vendor.rating_count || 0, 10);

    // Pagination & filter query parameters for items
    const { page, limit, category, search, q } = req.query;
    const isPaginated = page !== undefined || limit !== undefined;
    const pageNum = Math.max(1, parseInt(page || 1, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit || 20, 10)));
    const offset = (pageNum - 1) * limitNum;
    const itemCategory = (category || '').trim();
    const itemSearch = (search || q || '').trim();

    let itemWhere = ['vendor_id = ?'];
    let itemParams = [vendor.vendor_id];

    if (itemCategory) {
      itemWhere.push('LOWER(TRIM(category)) = LOWER(TRIM(?))');
      itemParams.push(itemCategory);
    }

    if (itemSearch) {
      itemWhere.push('(LOWER(item_name) LIKE ? OR LOWER(COALESCE(description, \'\')) LIKE ?)');
      const pattern = `%${itemSearch.toLowerCase()}%`;
      itemParams.push(pattern, pattern);
    }

    const itemWhereClause = itemWhere.join(' AND ');

    // Count total items
    const itemCountRes = await query(
      `SELECT COUNT(*) AS total FROM items WHERE ${itemWhereClause}`,
      itemParams
    ).catch(() => ({ rows: [{ total: 0 }] }));
    const total_items = parseInt(itemCountRes.rows[0]?.total || 0, 10);

    // Fetch items with optional pagination
    let itemSql = `
      SELECT item_id, vendor_id, item_name, price, category, description, image_url, in_stock, stock, unit, is_available, created_at 
      FROM items 
      WHERE ${itemWhereClause} 
      ORDER BY created_at DESC
    `;
    let execParams = [...itemParams];

    if (isPaginated) {
      itemSql += ` LIMIT ? OFFSET ?`;
      execParams.push(limitNum, offset);
    }

    const itemsRes = await query(itemSql, execParams).catch(() => ({ rows: [] }));

    const waPhone = vendor.whatsapp_number || vendor.phone_number;

    const items = (itemsRes.rows || []).map(i => {
      const img = typeof normalizeImageUrl === 'function'
        ? normalizeImageUrl(i.image_url, DEFAULT_PRODUCT_SERVICE_IMAGE)
        : (i.image_url || DEFAULT_PRODUCT_SERVICE_IMAGE);
      const isAvail = Boolean(i.in_stock) && (i.is_available === null || Boolean(i.is_available));
      return {
        item_id: Number(i.item_id),
        id: Number(i.item_id),
        name: i.item_name,
        price: parseFloat(i.price || 0),
        category: i.category || 'General',
        description: i.description || '',
        image_url: img,
        image: img,
        images: img ? [img] : [],
        unit: i.unit || 'piece',
        in_stock: isAvail,
        is_available: isAvail,
        whatsapp_order_url: buildWhatsAppUrl(waPhone, vendor.store_name, i.item_name, 'product'),
        created_at: i.created_at
      };
    });

    // Fetch services
    const servicesRes = await query(`
      SELECT service_id, vendor_id, service_name, price, visiting_charge, estimated_duration, service_location, description, image_url, is_available, category, created_at 
      FROM services 
      WHERE vendor_id = ? 
      ORDER BY service_id ASC
    `, [vendor.vendor_id]).catch(() => ({ rows: [] }));

    const services = (servicesRes.rows || []).map(s => {
      const img = typeof normalizeImageUrl === 'function'
        ? normalizeImageUrl(s.image_url, DEFAULT_PRODUCT_SERVICE_IMAGE)
        : (s.image_url || DEFAULT_PRODUCT_SERVICE_IMAGE);
      return {
        service_id: Number(s.service_id),
        id: Number(s.service_id),
        name: s.service_name,
        service_name: s.service_name,
        price: parseFloat(s.price || 0),
        visiting_charge: parseFloat(s.visiting_charge || 0),
        estimated_duration: s.estimated_duration || '1 hour',
        service_location: s.service_location || "At Customer's Doorstep",
        category: s.category || 'General Services',
        description: s.description || '',
        image_url: img,
        image: img,
        images: img ? [img] : [],
        is_available: Boolean(s.is_available),
        whatsapp_order_url: buildWhatsAppUrl(waPhone, vendor.store_name, s.service_name, 'service'),
        created_at: s.created_at
      };
    });

    const storeObj = {
      store_id: Number(vendor.vendor_id),
      id: Number(vendor.vendor_id),
      vendor_id: Number(vendor.vendor_id),
      public_id: vendor.public_id || ('vnd@' + String(vendor.vendor_id).padStart(4, '0')),
      store_name: vendor.store_name,
      vendor_name: vendor.vendor_name,
      owner_name: vendor.owner_name || vendor.vendor_name,
      category: vendor.category,
      vendor_type: vendor.vendor_type || 'product',
      description: vendor.description || '',
      city: vendor.city || vendor.society_city || '',
      state: vendor.state || '',
      area: vendor.area || '',
      address: vendor.address || '',
      pincode: vendor.pincode || '',
      society_name: vendor.society_name || null,
      phone: vendor.phone_number,
      phone_number: vendor.phone_number,
      whatsapp_number: vendor.whatsapp_number || null,
      logo: finalImage,
      shop_image: finalImage,
      image: finalImage,
      image_url: finalImage,
      opening_time: vendor.opening_time,
      closing_time: vendor.closing_time,
      rating: rating,
      avg_rating: rating,
      rating_count: ratingCount,
      reviews_count: ratingCount,
      is_subscription_active: isSubActive,
      subscription_active: isSubActive,
      is_order_eligible: isSubActive,
      can_accept_orders: isSubActive,
      status: String(vendor.status || 'ACTIVE').toLowerCase()
    };

    const total_pages = Math.ceil(total_items / limitNum) || 1;

    return res.status(200).json({
      success: true,
      message: 'Store details retrieved successfully',
      data: {
        store: storeObj,
        merchant: storeObj,
        items,
        products: items,
        services,
        ...(isPaginated ? {
          products_pagination: {
            total_records: total_items,
            total_pages,
            current_page: pageNum,
            page_size: limitNum,
            has_next: pageNum < total_pages,
            has_prev: pageNum > 1
          }
        } : {})
      }
    });
  } catch (error) {
    console.error('[getMerchantById Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve store details',
      error: error.message
    });
  }
}

/**
 * 11. GET /api/public/stores/:id/products (or /items)
 * Dedicated paginated endpoint for store products/items.
 * Supports maximum page size of 50.
 */
async function getStoreProducts(req, res) {
  try {
    const storeIdParam = req.params.id || req.params.storeId;
    const {
      page = 1,
      limit = 20,
      category,
      search,
      q
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    // Enforce strict maximum limit of 50
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;
    const searchTerm = (search || q || '').trim();
    const categoryFilter = (category || '').trim();

    // Verify store exists and is ACTIVE
    const storeRes = await query(
      `SELECT vendor_id, store_name, vendor_name, status, phone_number, whatsapp_number, society_id 
       FROM vendors 
       WHERE (CAST(vendor_id AS TEXT) = ? OR LOWER(store_name) = LOWER(?)) 
         AND UPPER(status) = 'ACTIVE' 
       LIMIT 1`,
      [String(storeIdParam), String(storeIdParam)]
    );

    if (!storeRes.rows || storeRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Store '${storeIdParam}' not found or is inactive`,
        data: []
      });
    }

    const store = storeRes.rows[0];

    // Strict society isolation: Reject if requested under a different society context
    const targetSocId = await resolveSocietyId(req);
    if (targetSocId && store.society_id && Number(store.society_id) !== targetSocId) {
      return res.status(404).json({
        success: false,
        message: `Store '${storeIdParam}' not found in the selected society`,
        data: []
      });
    }
    const vendorId = store.vendor_id;

    let whereConditions = ['vendor_id = ?'];
    let params = [vendorId];

    if (categoryFilter) {
      whereConditions.push('LOWER(TRIM(category)) = LOWER(TRIM(?))');
      params.push(categoryFilter);
    }

    if (searchTerm) {
      whereConditions.push('(LOWER(item_name) LIKE ? OR LOWER(COALESCE(description, \'\')) LIKE ?)');
      const pattern = `%${searchTerm.toLowerCase()}%`;
      params.push(pattern, pattern);
    }

    const whereClause = whereConditions.join(' AND ');

    // Total count
    const countRes = await query(`SELECT COUNT(*) AS total FROM items WHERE ${whereClause}`, params);
    const total_records = parseInt(countRes.rows[0]?.total || 0, 10);

    // Items query
    const itemsRes = await query(`
      SELECT item_id, vendor_id, item_name, price, category, description, image_url, in_stock, stock, unit, is_available, created_at 
      FROM items 
      WHERE ${whereClause} 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    const waPhone = store.whatsapp_number || store.phone_number;

    const products = (itemsRes.rows || []).map(i => {
      const img = typeof normalizeImageUrl === 'function'
        ? normalizeImageUrl(i.image_url, DEFAULT_PRODUCT_SERVICE_IMAGE)
        : (i.image_url || DEFAULT_PRODUCT_SERVICE_IMAGE);
      const isAvail = Boolean(i.in_stock) && (i.is_available === null || Boolean(i.is_available));

      return {
        item_id: Number(i.item_id),
        id: Number(i.item_id),
        name: i.item_name,
        price: parseFloat(i.price || 0),
        category: i.category || 'General',
        description: i.description || '',
        image_url: img,
        image: img,
        images: img ? [img] : [],
        unit: i.unit || 'piece',
        in_stock: isAvail,
        is_available: isAvail,
        whatsapp_order_url: buildWhatsAppUrl(waPhone, store.store_name, i.item_name, 'product'),
        created_at: i.created_at
      };
    });

    const total_pages = Math.ceil(total_records / limitNum) || 1;

    return res.status(200).json({
      success: true,
      message: 'Store products retrieved successfully',
      store: {
        store_id: Number(store.vendor_id),
        id: Number(store.vendor_id),
        store_name: store.store_name,
        status: store.status
      },
      data: products,
      pagination: {
        total_records,
        total_pages,
        current_page: pageNum,
        page_size: limitNum,
        has_next: pageNum < total_pages,
        has_prev: pageNum > 1
      }
    });
  } catch (error) {
    console.error('[getStoreProducts Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve store products',
      error: error.message
    });
  }
}

/**
 * 12. GET /api/public/stores/:id/services
 * Dedicated paginated endpoint for store services.
 * Supports maximum page size of 50.
 */
async function getStoreServices(req, res) {
  try {
    const storeIdParam = req.params.id || req.params.storeId;
    const {
      page = 1,
      limit = 20,
      category,
      search,
      q
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    // Enforce strict maximum limit of 50
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;
    const searchTerm = (search || q || '').trim();
    const categoryFilter = (category || '').trim();

    // Verify store exists and is ACTIVE
    const storeRes = await query(
      `SELECT vendor_id, store_name, vendor_name, status, phone_number, whatsapp_number, society_id 
       FROM vendors 
       WHERE (CAST(vendor_id AS TEXT) = ? OR LOWER(store_name) = LOWER(?)) 
         AND UPPER(status) = 'ACTIVE' 
       LIMIT 1`,
      [String(storeIdParam), String(storeIdParam)]
    );

    if (!storeRes.rows || storeRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Store '${storeIdParam}' not found or is inactive`,
        data: []
      });
    }

    const store = storeRes.rows[0];

    // Strict society isolation: Reject if requested under a different society context
    const targetSocId = await resolveSocietyId(req);
    if (targetSocId && store.society_id && Number(store.society_id) !== targetSocId) {
      return res.status(404).json({
        success: false,
        message: `Store '${storeIdParam}' not found in the selected society`,
        data: []
      });
    }
    const vendorId = store.vendor_id;

    let whereConditions = ['vendor_id = ?'];
    let params = [vendorId];

    if (categoryFilter) {
      whereConditions.push('LOWER(TRIM(category)) = LOWER(TRIM(?))');
      params.push(categoryFilter);
    }

    if (searchTerm) {
      whereConditions.push('(LOWER(service_name) LIKE ? OR LOWER(COALESCE(description, \'\')) LIKE ?)');
      const pattern = `%${searchTerm.toLowerCase()}%`;
      params.push(pattern, pattern);
    }

    const whereClause = whereConditions.join(' AND ');

    // Total count
    const countRes = await query(`SELECT COUNT(*) AS total FROM services WHERE ${whereClause}`, params);
    const total_records = parseInt(countRes.rows[0]?.total || 0, 10);

    // Services query
    const servicesRes = await query(`
      SELECT service_id, vendor_id, service_name, price, visiting_charge, estimated_duration, service_location, description, image_url, is_available, category, created_at 
      FROM services 
      WHERE ${whereClause} 
      ORDER BY service_id ASC 
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    const waPhone = store.whatsapp_number || store.phone_number;

    const services = (servicesRes.rows || []).map(s => {
      const img = typeof normalizeImageUrl === 'function'
        ? normalizeImageUrl(s.image_url, DEFAULT_PRODUCT_SERVICE_IMAGE)
        : (s.image_url || DEFAULT_PRODUCT_SERVICE_IMAGE);

      return {
        service_id: Number(s.service_id),
        id: Number(s.service_id),
        name: s.service_name,
        service_name: s.service_name,
        price: parseFloat(s.price || 0),
        visiting_charge: parseFloat(s.visiting_charge || 0),
        estimated_duration: s.estimated_duration || '1 hour',
        service_location: s.service_location || "At Customer's Doorstep",
        category: s.category || 'General Services',
        description: s.description || '',
        image_url: img,
        image: img,
        images: img ? [img] : [],
        is_available: Boolean(s.is_available),
        whatsapp_order_url: buildWhatsAppUrl(waPhone, store.store_name, s.service_name, 'service'),
        created_at: s.created_at
      };
    });

    const total_pages = Math.ceil(total_records / limitNum) || 1;

    return res.status(200).json({
      success: true,
      message: 'Store services retrieved successfully',
      store: {
        store_id: Number(store.vendor_id),
        id: Number(store.vendor_id),
        store_name: store.store_name,
        status: store.status
      },
      data: services,
      pagination: {
        total_records,
        total_pages,
        current_page: pageNum,
        page_size: limitNum,
        has_next: pageNum < total_pages,
        has_prev: pageNum > 1
      }
    });
  } catch (error) {
    console.error('[getStoreServices Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve store services',
      error: error.message
    });
  }
}

module.exports = {
  getCities,
  searchCities,
  getCityById,
  getCategories,
  getCategoryById,
  getSubcategories,
  getStoresByCategory,
  getCityAvailableCategories,
  discover,
  getProductById,
  getServiceById,
  getMerchantById,
  getStoreProducts,
  getStoreServices
};

