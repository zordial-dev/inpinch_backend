const z = require('../utils/zod');

function normalizeAuthPayload(data = {}) {
  const normalized = { ...data };

  if (normalized.merchant_name !== undefined && normalized.vendor_name === undefined) normalized.vendor_name = normalized.merchant_name;
  if (normalized.owner_name !== undefined && normalized.vendor_name === undefined) normalized.vendor_name = normalized.owner_name;
  if (normalized.name !== undefined && normalized.vendor_name === undefined) normalized.vendor_name = normalized.name;

  if (normalized.shop_name !== undefined && normalized.store_name === undefined) normalized.store_name = normalized.shop_name;
  if (normalized.business_name !== undefined && normalized.store_name === undefined) normalized.store_name = normalized.business_name;

  if (normalized.mobile !== undefined && normalized.phone_number === undefined) normalized.phone_number = normalized.mobile;
  if (normalized.phone !== undefined && normalized.phone_number === undefined) normalized.phone_number = normalized.phone;
  if (normalized.mobile_number !== undefined && normalized.phone_number === undefined) normalized.phone_number = normalized.mobile_number;

  if (normalized.shop_address !== undefined && normalized.address === undefined) normalized.address = normalized.shop_address;
  if (normalized.full_address !== undefined && normalized.address === undefined) normalized.address = normalized.full_address;

  if (normalized.pin_code !== undefined && normalized.pincode === undefined) normalized.pincode = normalized.pin_code;
  if (normalized.pinCode !== undefined && normalized.pincode === undefined) normalized.pincode = normalized.pinCode;

  if (normalized.gst_number !== undefined && normalized.gstin === undefined) normalized.gstin = normalized.gst_number;
  if (normalized.pan_number !== undefined && normalized.pan === undefined) normalized.pan = normalized.pan_number;

  if (normalized.lat !== undefined && normalized.latitude === undefined) normalized.latitude = normalized.lat;
  if (normalized.lng !== undefined && normalized.longitude === undefined) normalized.longitude = normalized.lng;
  if (normalized.lon !== undefined && normalized.longitude === undefined) normalized.longitude = normalized.lon;

  return normalized;
}

const registerSchema = {
  body: z.object({
    vendor_name: z.string().trim().max(100, 'Vendor name must not exceed 100 characters').optional(),
    store_name: z.string().trim().max(100, 'Store name must not exceed 100 characters').optional(),
    email: z.string().trim().max(100, 'Email must not exceed 100 characters').optional(),
    password: z.string().max(128, 'Password must not exceed 128 characters').optional(),
    phone_number: z.string().trim().max(20, 'Phone number must not exceed 20 characters').optional(),
    whatsapp_number: z.string().trim().max(20, 'WhatsApp number must not exceed 20 characters').optional(),
    address: z.string().trim().max(1000, 'Address must not exceed 1000 characters').optional(),
    area: z.string().trim().max(150, 'Area must not exceed 150 characters').optional(),
    city: z.string().trim().max(100, 'City must not exceed 100 characters').optional(),
    state: z.string().trim().max(100, 'State must not exceed 100 characters').optional(),
    pincode: z.union([z.number(), z.string()]).optional(),
    shop_number: z.string().trim().max(100, 'Shop number must not exceed 100 characters').optional(),
    gstin: z.string().trim().max(20, 'GSTIN must not exceed 20 characters').optional(),
    pan: z.string().trim().max(15, 'PAN must not exceed 15 characters').optional(),
    account_number: z.union([z.number(), z.string()]).optional(),
    ifsc_code: z.string().trim().max(20, 'IFSC code must not exceed 20 characters').optional(),
    bank_name: z.string().trim().max(100, 'Bank name must not exceed 100 characters').optional(),
    account_holder_name: z.string().trim().max(100, 'Account holder name must not exceed 100 characters').optional(),
    society_id: z.union([z.number(), z.string()]).optional(),
    latitude: z.union([z.number(), z.string()]).optional().nullable(),
    longitude: z.union([z.number(), z.string()]).optional().nullable()
  }).passthrough().preprocess(normalizeAuthPayload)
};

const loginSchema = {
  body: z.object({
    email: z.string().trim().max(100).optional(),
    phone: z.string().trim().max(20).optional(),
    mobile: z.string().trim().max(20).optional(),
    identifier: z.string().trim().max(100).optional(),
    password: z.string().max(128).optional(),
    otp: z.string().trim().max(10).optional()
  }).passthrough()
};

const forgotPasswordSchema = {
  body: z.object({
    email: z.string().trim().max(100).optional(),
    phone: z.string().trim().max(20).optional(),
    mobile: z.string().trim().max(20).optional(),
    identifier: z.string().trim().max(100).optional()
  }).passthrough()
};

const verifyOtpSchema = {
  body: z.object({
    email: z.string().trim().max(100).optional(),
    phone: z.string().trim().max(20).optional(),
    mobile: z.string().trim().max(20).optional(),
    identifier: z.string().trim().max(100).optional(),
    otp: z.string().trim().max(10).optional(),
    verification_id: z.string().trim().max(200).optional(),
    verificationId: z.string().trim().max(200).optional()
  }).passthrough()
};

const resetPasswordSchema = {
  body: z.object({
    email: z.string().trim().max(100).optional(),
    phone: z.string().trim().max(20).optional(),
    mobile: z.string().trim().max(20).optional(),
    identifier: z.string().trim().max(100).optional(),
    otp: z.string().trim().max(10).optional(),
    newPassword: z.string().min(6).max(128).optional(),
    new_password: z.string().min(6).max(128).optional()
  }).passthrough()
};

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordSchema,
  normalizeAuthPayload
};
