const z = require('../utils/zod');

function normalizeUserPayload(data = {}) {
  const normalized = { ...data };

  if (normalized.user_name !== undefined && normalized.name === undefined) normalized.name = normalized.user_name;
  if (normalized.fullName !== undefined && normalized.name === undefined) normalized.name = normalized.fullName;
  if (normalized.userName !== undefined && normalized.name === undefined) normalized.name = normalized.userName;

  if (normalized.mobile !== undefined && normalized.phone === undefined) normalized.phone = normalized.mobile;
  if (normalized.phone_number !== undefined && normalized.phone === undefined) normalized.phone = normalized.phone_number;
  if (normalized.mobile_number !== undefined && normalized.phone === undefined) normalized.phone = normalized.mobile_number;
  if (normalized.identifier !== undefined && normalized.phone === undefined) normalized.phone = normalized.identifier;

  if (normalized.code !== undefined && normalized.otp === undefined) normalized.otp = normalized.code;
  if (normalized.otp_code !== undefined && normalized.otp === undefined) normalized.otp = normalized.otp_code;

  if (normalized.house_number !== undefined && normalized.flat === undefined) normalized.flat = normalized.house_number;
  if (normalized.unit !== undefined && normalized.flat === undefined) normalized.flat = normalized.unit;

  if (normalized.society_name !== undefined && normalized.area === undefined) normalized.area = normalized.society_name;
  if (normalized.location !== undefined && normalized.area === undefined) normalized.area = normalized.location;

  if (normalized.pin_code !== undefined && normalized.pincode === undefined) normalized.pincode = normalized.pin_code;
  if (normalized.pinCode !== undefined && normalized.pincode === undefined) normalized.pincode = normalized.pinCode;

  if (normalized.full_address !== undefined && normalized.address === undefined) normalized.address = normalized.full_address;

  return normalized;
}

const registerUserSchema = {
  body: z.object({
    phone: z.string().trim().min(10, 'Mobile phone number must be at least 10 digits').max(15, 'Mobile phone number must not exceed 15 digits'),
    name: z.string().trim().max(100, 'Name must not exceed 100 characters').optional().default('Resident User'),
    email: z.string().trim().email('Invalid email address format').max(255).optional(),
    password: z.string().min(6, 'Password must be at least 6 characters').max(128).optional(),
    society_id: z.union([z.number(), z.string()]).optional(),
    flat: z.string().trim().max(50, 'Flat/house number must not exceed 50 characters').optional(),
    area: z.string().trim().max(150, 'Area/society name must not exceed 150 characters').optional(),
    city: z.string().trim().max(100, 'City must not exceed 100 characters').optional(),
    state: z.string().trim().max(100, 'State must not exceed 100 characters').optional(),
    pincode: z.string().trim().max(10, 'Pincode must not exceed 10 characters').optional(),
    address: z.string().trim().max(1000, 'Address must not exceed 1000 characters').optional(),
    otp: z.string().trim().max(10).optional()
  }).passthrough().preprocess(normalizeUserPayload)
};

const updateProfileSchema = {
  params: z.object({
    userId: z.union([z.string(), z.number()]).optional(),
    id: z.union([z.string(), z.number()]).optional()
  }).passthrough(),
  body: z.object({
    name: z.string().trim().max(100, 'Name must not exceed 100 characters').optional(),
    email: z.string().trim().email('Invalid email address format').max(255).optional(),
    flat: z.string().trim().max(50, 'Flat/house number must not exceed 50 characters').optional(),
    area: z.string().trim().max(150, 'Area/society name must not exceed 150 characters').optional(),
    city: z.string().trim().max(100, 'City must not exceed 100 characters').optional(),
    state: z.string().trim().max(100, 'State must not exceed 100 characters').optional(),
    pincode: z.string().trim().max(10, 'Pincode must not exceed 10 characters').optional(),
    address: z.string().trim().max(1000, 'Address must not exceed 1000 characters').optional()
  }).passthrough().preprocess(normalizeUserPayload)
};

module.exports = {
  registerUserSchema,
  updateProfileSchema,
  normalizeUserPayload
};
