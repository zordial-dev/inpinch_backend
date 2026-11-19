'use strict';

const { query } = require('../models/db');

/**
 * Society Context Utility
 * Provides unified extraction, validation, and resolution of society ID
 * across query params, request headers, route params, and authenticated user context.
 */

/**
 * Extracts raw society identifier from query, headers, route params, or user context.
 * Returns an integer if numeric (> 0), a trimmed string if alphanumeric/slug, or null.
 * Rejects 'all', '0', 0, null, undefined, or empty strings.
 */
function extractSocietyId(req) {
  if (!req) return null;

  const raw = req.query?.society_id ?? 
              req.query?.societyId ?? 
              req.headers?.['x-society-id'] ?? 
              req.headers?.['x-society'] ?? 
              req.headers?.['X-Society-ID'] ?? 
              req.headers?.['X-Society'] ?? 
              req.params?.societyId ?? 
              req.params?.society_id ?? 
              req.user?.society_id;

  if (raw === undefined || raw === null || raw === '') return null;
  const str = String(raw).trim();
  if (str.toLowerCase() === 'all' || str === '0') return null;

  if (/^\d+$/.test(str)) {
    const num = parseInt(str, 10);
    return num > 0 ? num : null;
  }
  return str;
}

/**
 * Resolves society to a validated integer society_id.
 * If extracted value is an integer, returns it directly.
 * If extracted value is a slug or public_id, resolves it against the societies table.
 * Returns null if missing or invalid.
 */
async function resolveSocietyId(req) {
  const extracted = extractSocietyId(req);
  if (!extracted) return null;

  if (typeof extracted === 'number') return extracted;

  const str = String(extracted).trim();
  if (/^\d+$/.test(str)) {
    const num = parseInt(str, 10);
    return num > 0 ? num : null;
  }

  // Lookup by public_id or society_name
  try {
    const res = await query(
      `SELECT society_id FROM societies WHERE (UPPER(public_id) = UPPER(?) OR LOWER(society_name) = LOWER(?)) AND status = 'active' LIMIT 1`,
      [str, str]
    );
    if (res.rows && res.rows.length > 0) {
      return Number(res.rows[0].society_id);
    }
  } catch (_) {}

  return null;
}

/**
 * Determines whether the request is from a public / resident user / storefront client,
 * as opposed to an internal admin dashboard session.
 */
function isStorefrontCustomerRequest(req) {
  if (!req) return true;
  const reqUrl = String(req.originalUrl || req.baseUrl || req.url || '');
  const isAdminPath = reqUrl.includes('/api/admin') || reqUrl.includes('/api/v1/admin');
  const isAdminClient = req.headers?.['x-platform-client'] === 'admin_dashboard';
  const isAdminAuth = req.user && ['super_admin', 'admin', 'sub_admin'].includes(String(req.user.role || '').toLowerCase());
  return !(isAdminPath || isAdminClient || isAdminAuth);
}

module.exports = {
  extractSocietyId,
  resolveSocietyId,
  isStorefrontCustomerRequest
};
