const z = require('../utils/zod');
const { createItemSchema, updateItemSchema } = require('./itemSchema');
const { createServiceSchema, updateServiceSchema } = require('./serviceSchema');

const addItemSchema = createItemSchema;
const addServiceSchema = createServiceSchema;

const updateSettingsSchema = {
  params: z.object({
    vendorId: z.union([z.string(), z.number()]).optional()
  }).passthrough(),
  body: z.object({
    store_name: z.string().trim().min(2, 'Store name must be at least 2 characters').max(100).optional(),
    vendor_name: z.string().trim().min(2, 'Vendor name must be at least 2 characters').max(100).optional(),
    contact_person: z.string().trim().max(100).optional(),
    merchant_name: z.string().trim().max(100).optional(),
    owner_name: z.string().trim().max(100).optional(),
    email: z.string().trim().email('Invalid email address format').max(100).optional(),
    logo: z.string().trim().optional(),
    logo_url: z.string().trim().optional(),
    store_logo: z.string().trim().optional(),
    shop_image: z.string().trim().optional(),
    image_url: z.string().trim().optional(),
    image: z.string().trim().optional(),
    photo: z.string().trim().optional(),
    avatar: z.string().trim().optional(),
    avatar_url: z.string().trim().optional(),
    description: z.string().trim().max(3000).optional(),
    phone_number: z.string().trim().max(20).optional(),
    phone: z.string().trim().max(20).optional(),
    whatsapp_number: z.string().trim().max(20).optional(),
    gst_number: z.string().trim().max(20).optional(),
    gstin: z.string().trim().max(20).optional(),
    gst: z.string().trim().max(20).optional(),
    gstNumber: z.string().trim().max(20).optional(),
    pan_number: z.string().trim().max(15).optional(),
    pan: z.string().trim().max(15).optional(),
    panNumber: z.string().trim().max(15).optional(),
    opening_time: z.string().trim().max(30).optional(),
    closing_time: z.string().trim().max(30).optional(),
    working_days: z.string().trim().max(100).optional(),
    business_type: z.string().trim().max(100).optional(),
    category: z.string().trim().max(100).optional(),
    address: z.string().trim().max(1000).optional(),
    area: z.string().trim().max(150).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    pincode: z.string().trim().max(10).optional(),
    location: z.string().trim().max(150).optional(),
    shop_number: z.string().trim().max(100).optional(),
    shop_no: z.string().trim().max(100).optional(),
    bank_name: z.string().trim().max(100).optional(),
    account_number: z.string().trim().max(50).optional(),
    bank_account_number: z.string().trim().max(50).optional(),
    ifsc_code: z.string().trim().max(20).optional(),
    ifsc: z.string().trim().max(20).optional(),
    ifscCode: z.string().trim().max(20).optional(),
    account_holder_name: z.string().trim().max(100).optional(),
    upi_id: z.string().trim().max(100).optional(),
    upi: z.string().trim().max(100).optional(),
    qr_code: z.string().trim().optional(),
    qr_code_url: z.string().trim().optional(),
    payment_details: z.any().optional(),
    tax_details: z.any().optional(),
    business_details: z.any().optional(),
    min_order_value: z.coerce.number()
      .min(0, 'min_order_value cannot be negative')
      .maxDigitsBeforeDecimal(6, 'min_order_value cannot exceed 6 digits before decimal')
      .maxDecimals(2)
      .max(999999.99)
      .optional(),
    max_quantity_limit: z.coerce.number().int().min(1).optional(),
    delivery_charge: z.coerce.number()
      .min(0, 'delivery_charge cannot be negative')
      .maxDigitsBeforeDecimal(5, 'delivery_charge cannot exceed 5 digits before decimal')
      .maxDecimals(2)
      .max(99999.99)
      .optional(),
    gst_percentage: z.coerce.number().min(0).max(28).optional(),
    service_charge_percentage: z.coerce.number().min(0).max(100).optional(),
    vendor_type: z.enum(['product', 'service']).optional(),
    location_type: z.enum(['society', 'area_sector']).optional(),
    is_global_coverage: z.coerce.boolean().optional(),
    delivery_radius_km: z.coerce.number().min(0).max(1000).optional(),
    selected_zones: z.array(z.any()).optional()
  }).passthrough()
};

const updateCoverageSchema = {
  params: z.object({
    vendorId: z.union([z.string(), z.number()]).optional()
  }).passthrough(),
  body: z.object({
    location_type: z.enum(['society', 'area_sector']).optional(),
    is_global_coverage: z.coerce.boolean().optional(),
    delivery_radius_km: z.coerce.number().min(0).max(1000).optional(),
    selected_zones: z.array(z.object({
      zone_id: z.union([z.string(), z.number()]).optional(),
      name: z.string().trim().min(1),
      type: z.enum(['society', 'sector', 'sub_area']).optional(),
      is_active: z.coerce.boolean().default(true)
    })).optional()
  }).passthrough()
};

const checkCoverageSchema = {
  body: z.object({
    latitude: z.coerce.number().optional(),
    longitude: z.coerce.number().optional(),
    radius_km: z.coerce.number().min(0.1).default(3),
    sector: z.string().trim().optional(),
    location_type: z.enum(['society', 'area_sector']).optional()
  }).passthrough()
};

module.exports = {
  addItemSchema,
  updateItemSchema,
  addServiceSchema,
  updateServiceSchema,
  updateSettingsSchema,
  updateCoverageSchema,
  checkCoverageSchema
};
