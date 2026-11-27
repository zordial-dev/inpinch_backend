'use strict';
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();
const axios = require('axios');
const crypto = require('crypto');

/**
 * Meta WhatsApp Cloud API Service for InPinch
 * Follows official Meta WhatsApp Business Platform Cloud API specifications:
 * https://developers.facebook.com/documentation/business-messaging/whatsapp/overview
 *
 * Uses pre-approved Authentication template: connexon_auth_code (en_US)
 */

/**
 * Masks phone number to preserve privacy in logs (e.g., "******1234")
 */
function maskPhone(phone) {
  if (!phone) return 'unknown';
  const str = String(phone).replace(/\D/g, '');
  if (str.length <= 4) return '****';
  return `${'*'.repeat(Math.max(0, str.length - 4))}${str.slice(-4)}`;
}

/**
 * Normalizes phone number to Meta's expected international E.164 format without '+'
 * E.g., Indian mobile 9876543210 -> 919876543210
 */
function normalizeWhatsAppPhone(rawPhone, countryCode = '91') {
  if (!rawPhone) return '';
  const digits = String(rawPhone).replace(/\D/g, '');
  const cleanCc = String(countryCode || '91').replace(/\D/g, '') || '91';

  // If 10 digits (standard Indian number), prefix country code
  if (digits.length === 10) {
    return `${cleanCc}${digits}`;
  }
  // If already starts with country code (e.g. 919876543210 where cc is 91)
  if (digits.length === 10 + cleanCc.length && digits.startsWith(cleanCc)) {
    return digits;
  }
  // If 11 digits starting with 0 (e.g. 09876543210)
  if (digits.length === 11 && digits.startsWith('0')) {
    return `${cleanCc}${digits.slice(1)}`;
  }
  return digits;
}

/**
 * Custom Error for WhatsApp Cloud API errors
 */
class WhatsAppApiError extends Error {
  constructor(message, statusCode = 502, errorCode = 'WHATSAPP_API_ERROR', details = null) {
    super(message);
    this.name = 'WhatsAppApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

/**
 * Retrieves configuration values from environment with approved defaults
 */
function getConfig() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
    || process.env.WHATSAPP_PHONE_ID
    || process.env.PHONE_NUMBER_ID
    || '1369647369576088';
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
    || process.env.WHATSAPP_WABA_ID
    || process.env.WABA_ID
    || '2282318752550657';
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
    || process.env.WHATSAPP_TOKEN
    || process.env.META_ACCESS_TOKEN
    || process.env.META_WHATSAPP_TOKEN;
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v22.0';
  const templateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME || 'connexon_auth_code';
  const webhookVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'connexon_agent_token_2026';
  const appSecret = process.env.WHATSAPP_APP_SECRET || '';

  return {
    phoneNumberId,
    businessAccountId,
    accessToken,
    apiVersion,
    templateName,
    webhookVerifyToken,
    appSecret
  };
}

/**
 * Sends a transactional Authentication OTP message via Meta WhatsApp Cloud API
 *
 * @param {string} phone - Recipient phone number
 * @param {string|number} otpCode - 4 to 8 digit numeric OTP code
 * @param {object} [options] - Optional overrides (countryCode, templateName, language)
 * @returns {Promise<{ success: boolean, messageId: string, recipient: string, provider: string }>}
 */
async function sendWhatsAppOtp(phone, otpCode, options = {}) {
  const config = getConfig();

  if (!config.phoneNumberId) {
    throw new WhatsAppApiError(
      'WhatsApp Cloud API is not configured: WHATSAPP_PHONE_NUMBER_ID is missing. Please set WHATSAPP_PHONE_NUMBER_ID=1369647369576088 in your server environment.',
      503,
      'WHATSAPP_CONFIG_MISSING'
    );
  }

  if (!config.accessToken) {
    throw new WhatsAppApiError(
      'WhatsApp Cloud API is not configured: WHATSAPP_ACCESS_TOKEN is missing. Please set WHATSAPP_ACCESS_TOKEN in your server environment.',
      503,
      'WHATSAPP_CONFIG_MISSING'
    );
  }

  if (!phone) {
    throw new WhatsAppApiError('Phone number is required for WhatsApp OTP delivery.', 400, 'INVALID_PHONE');
  }

  if (!otpCode) {
    throw new WhatsAppApiError('OTP code is required for WhatsApp OTP delivery.', 400, 'INVALID_OTP');
  }

  const cleanPhone = normalizeWhatsAppPhone(phone, options.countryCode);
  if (cleanPhone.length < 10) {
    throw new WhatsAppApiError('Invalid phone number format for WhatsApp delivery.', 400, 'INVALID_PHONE_FORMAT');
  }

  const templateName = options.templateName || config.templateName;
  const languageCode = options.language || 'en_US';
  const codeStr = String(otpCode).trim();

  const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;

  // Payload for approved Authentication template "connexon_auth_code"
  // Positional parameters:
  // - Body: {{1}} = otpCode
  // - Button (sub_type: url, index: "0"): parameter {{1}} = otpCode for the Copy Code dynamic URL
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanPhone,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode
      },
      components: [
        {
          type: 'body',
          parameters: [
            {
              type: 'text',
              text: codeStr
            }
          ]
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [
            {
              type: 'text',
              text: codeStr
            }
          ]
        }
      ]
    }
  };

  const masked = maskPhone(cleanPhone);
  console.log(`📱 [WHATSAPP OTP DISPATCH] Sending template "${templateName}" to ${masked}...`);

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    const data = response.data;
    const messageId = data?.messages?.[0]?.id || 'unknown';

    console.log(`✅ [WHATSAPP OTP SUCCESS] Message sent to ${masked}. Message ID: ${messageId}`);

    return {
      success: true,
      messageId,
      recipient: cleanPhone,
      provider: 'whatsapp_cloud_api',
      maskedPhone: masked
    };
  } catch (error) {
    const status = error.response?.status || 502;
    const errorData = error.response?.data?.error;
    const fbMessage = errorData?.message || error.message || 'WhatsApp Cloud API request failed';
    const fbCode = errorData?.code || 'UNKNOWN';
    const fbSubcode = errorData?.error_subcode;

    // Secure logging: Never log the access token or full auth header
    console.error(`❌ [WHATSAPP OTP ERROR] Status: ${status}, Code: ${fbCode}, Subcode: ${fbSubcode}, Msg: ${fbMessage}`);

    // Map Meta API error codes to user-friendly messages
    let userMessage = 'Failed to deliver OTP via WhatsApp. Please try SMS delivery.';
    if (fbCode === 131026) {
      userMessage = 'Receiver is incapable of receiving WhatsApp messages or number is not on WhatsApp.';
    } else if (fbCode === 131047 || fbCode === 131051) {
      userMessage = 'WhatsApp message could not be sent due to rate limits. Please try again shortly or use SMS.';
    } else if (fbCode === 190) {
      userMessage = 'WhatsApp service is undergoing maintenance. Please use SMS OTP.';
    }

    throw new WhatsAppApiError(
      userMessage,
      status >= 400 && status < 500 ? (status === 401 ? 503 : 400) : 502,
      `WHATSAPP_${fbCode}`,
      { fbCode, fbSubcode, fbMessage }
    );
  }
}

/**
 * Validates Meta webhook payload signature against WHATSAPP_APP_SECRET
 *
 * @param {string|Buffer} rawBody - Raw unparsed HTTP request body
 * @param {string} signatureHeader - Value of x-hub-signature-256 header
 * @returns {boolean} True if signature is valid or if secret is not configured
 */
function verifyWebhookSignature(rawBody, signatureHeader) {
  const config = getConfig();
  if (!config.appSecret) {
    // If app secret is not configured, signature verification is bypassed
    return true;
  }

  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', config.appSecret)
    .update(rawBody)
    .digest('hex');

  const incomingHash = signatureHeader.slice(7); // remove 'sha256='
  try {
    return crypto.timingSafeEqual(
      Buffer.from(incomingHash, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (_) {
    return false;
  }
}

/**
 * Formats order ID consistently (e.g. 3981 -> "#ORD-3981", "ORD-3981" -> "#ORD-3981", "#ORD-3981" -> "#ORD-3981")
 */
function formatOrderId(orderId) {
  if (!orderId) return '#ORD';
  const clean = String(orderId).trim().replace(/^#/, '');
  if (/^\d+$/.test(clean)) {
    return `#ORD-${clean}`;
  }
  return `#${clean}`;
}

/**
 * Formats numeric amount to Indian Rupee representation (e.g. "₹450.00")
 */
function formatCurrency(amount) {
  const num = Number(amount || 0);
  return `₹${num.toFixed(2)}`;
}

/**
 * Formats a Date object or timestamp into standard IST string: "26 Nov 2026, 03:00 PM"
 */
function formatDateTimeIST(dateInput) {
  const d = dateInput ? new Date(dateInput) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;
  const pad = n => String(n).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Convert to IST offset (+05:30)
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
  const ist = new Date(validDate.getTime() + istOffsetMs);

  const day = pad(ist.getUTCDate());
  const month = months[ist.getUTCMonth()];
  const year = ist.getUTCFullYear();
  let hours = ist.getUTCHours();
  const minutes = pad(ist.getUTCMinutes());
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = pad(hours);

  return `${day} ${month} ${year}, ${hoursStr}:${minutes} ${ampm}`;
}

/**
 * Builds a concise items summary string for WhatsApp templates (e.g. "2x Milk, 1x Bread")
 */
function formatItemsSummary(items) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return 'Order items';
  }
  const summary = items.map(it => {
    const qty = it.quantity || it.qty || 1;
    const name = it.item_name || it.itemName || it.name || 'Item';
    return `${qty}x ${name}`;
  }).join(', ');

  // Keep within reasonable length for Meta variable text
  if (summary.length > 120) {
    return summary.slice(0, 117) + '...';
  }
  return summary;
}

/**
 * Formats and truncates delivery address for WhatsApp template
 */
function formatAddressSummary(address) {
  if (!address || !String(address).trim()) return 'Customer Address';
  const clean = String(address).trim();
  if (clean.length > 120) {
    return clean.slice(0, 117) + '...';
  }
  return clean;
}

/**
 * Check whether subscription expiry template is enabled for live delivery.
 * Both v1 and v2 are now approved on Meta (v2 ID: 2669792136780865).
 */
function isSubscriptionExpiryTemplateApproved() {
  if (process.env.WHATSAPP_TEMPLATE_SUB_EXPIRY_DISABLED === 'true') {
    return false;
  }
  return true;
}

/**
 * Resolves active template names with support for environment overrides and version switches.
 * Defaults to the approved v2 structured line-by-line templates.
 */
function getActiveTemplateNames() {
  const useV1 = process.env.WHATSAPP_USE_V1_TEMPLATES === 'true';
  return {
    orderReceived: process.env.WHATSAPP_TEMPLATE_ORDER_RECEIVED || (useV1 ? 'inpinch_order_received_customer' : 'inpinch_order_received_v2'),
    paymentSuccess: process.env.WHATSAPP_TEMPLATE_PAYMENT_SUCCESS || (useV1 ? 'inpinch_payment_success' : 'inpinch_payment_success_v2'),
    subscriptionExpiry: process.env.WHATSAPP_TEMPLATE_SUBSCRIPTION_EXPIRY || (useV1 ? 'inpinch_subscription_expiry' : 'inpinch_subscription_expiry_v2')
  };
}

/**
 * Sends a generic template message via Meta WhatsApp Cloud API
 *
 * @param {string} phone - Recipient phone number
 * @param {string} templateName - Meta registered template name
 * @param {Array} components - Meta template components array
 * @param {object} [options] - Optional overrides (countryCode, language, dryRun)
 * @returns {Promise<{ success: boolean, messageId: string, recipient: string, provider: string, payload?: object, bypassed?: boolean }>}
 */
async function sendWhatsAppTemplate(phone, templateName, components, options = {}) {
  const config = getConfig();

  if (!config.phoneNumberId) {
    throw new WhatsAppApiError(
      'WhatsApp Cloud API is not configured: WHATSAPP_PHONE_NUMBER_ID is missing.',
      503,
      'WHATSAPP_CONFIG_MISSING'
    );
  }

  if (!config.accessToken) {
    throw new WhatsAppApiError(
      'WhatsApp Cloud API is not configured: WHATSAPP_ACCESS_TOKEN is missing.',
      503,
      'WHATSAPP_CONFIG_MISSING'
    );
  }

  if (!phone) {
    throw new WhatsAppApiError('Phone number is required for WhatsApp template delivery.', 400, 'INVALID_PHONE');
  }

  const cleanPhone = normalizeWhatsAppPhone(phone, options.countryCode);
  if (cleanPhone.length < 10) {
    throw new WhatsAppApiError('Invalid phone number format for WhatsApp delivery.', 400, 'INVALID_PHONE_FORMAT');
  }

  const languageCode = options.language || 'en_US';
  const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanPhone,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode
      },
      components: components
    }
  };

  const masked = maskPhone(cleanPhone);

  // Dry-run mode for development and testing without hitting Meta API or sending real messages
  if (options.dryRun || process.env.WHATSAPP_DRY_RUN === 'true') {
    const mockId = `mock_wa_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    console.log(`🧪 [WHATSAPP DRY-RUN] Template "${templateName}" dispatched to ${masked} (dry-run). ID: ${mockId}`);
    return {
      success: true,
      dryRun: true,
      messageId: mockId,
      recipient: cleanPhone,
      provider: 'whatsapp_cloud_api',
      maskedPhone: masked,
      payload
    };
  }

  console.log(`📱 [WHATSAPP TEMPLATE DISPATCH] Sending template "${templateName}" to ${masked}...`);

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const data = response.data;
    const messageId = data?.messages?.[0]?.id || 'unknown';

    console.log(`✅ [WHATSAPP TEMPLATE SUCCESS] Message sent to ${masked}. Message ID: ${messageId}`);

    return {
      success: true,
      messageId,
      recipient: cleanPhone,
      provider: 'whatsapp_cloud_api',
      maskedPhone: masked,
      payload
    };
  } catch (error) {
    const status = error.response?.status || 502;
    const errorData = error.response?.data?.error;
    const fbMessage = errorData?.message || error.message || 'WhatsApp Cloud API request failed';
    const fbCode = errorData?.code || 'UNKNOWN';
    const fbSubcode = errorData?.error_subcode;

    console.error(`❌ [WHATSAPP TEMPLATE ERROR] Status: ${status}, Code: ${fbCode}, Subcode: ${fbSubcode}, Msg: ${fbMessage}`);

    throw new WhatsAppApiError(
      fbMessage,
      status >= 400 && status < 500 ? (status === 401 ? 503 : 400) : 502,
      `WHATSAPP_${fbCode}`,
      { fbCode, fbSubcode, fbMessage }
    );
  }
}

/**
 * Template A: Payment Confirmation – Customer (Status: APPROVED)
 * Template: inpinch_payment_success (UTILITY, en_US)
 * Message: "Hi {{1}}, we have received your payment of {{2}} for order {{3}}. Transaction Reference: {{4}}. Payment Time: {{5}}. Your order is now confirmed with the merchant."
 */
async function sendPaymentSuccessCustomerWhatsApp({
  customerPhone,
  customerName,
  totalAmount,
  orderId,
  transactionId,
  paymentTime,
  options = {}
}) {
  const activeTemplates = getActiveTemplateNames();
  const templateName = options.templateName || activeTemplates.paymentSuccess;
  const name = String(customerName || 'Customer').trim();
  const amountStr = formatCurrency(totalAmount);
  const ordIdStr = formatOrderId(orderId);
  const txRef = String(transactionId || 'cf_pay_confirmed').trim();
  const timeStr = formatDateTimeIST(paymentTime);

  const components = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: name },
        { type: 'text', text: amountStr },
        { type: 'text', text: ordIdStr },
        { type: 'text', text: txRef },
        { type: 'text', text: timeStr }
      ]
    }
  ];

  return sendWhatsAppTemplate(customerPhone, templateName, components, options);
}

/**
 * Template B: Order Received Confirmation – Customer (Status: APPROVED)
 * Template: inpinch_order_received_customer (UTILITY, en_US)
 * Message: "Hi {{1}}, your order {{2}} has been placed with {{3}} for {{4}}. Summary: {{5}}. Order Time: {{6}}. Payment Status: {{7}}. Delivery Address: {{8}}. Thank you for ordering with InPinch!"
 */
async function sendOrderReceivedCustomerWhatsApp({
  customerPhone,
  customerName,
  orderId,
  storeName,
  totalAmount,
  items,
  orderTime,
  paymentStatus,
  deliveryAddress,
  options = {}
}) {
  const activeTemplates = getActiveTemplateNames();
  const templateName = options.templateName || activeTemplates.orderReceived;
  const name = String(customerName || 'Customer').trim();
  const ordIdStr = formatOrderId(orderId);
  const store = String(storeName || 'InPinch Store').trim();
  const amountStr = formatCurrency(totalAmount);
  const itemsStr = formatItemsSummary(items);
  const timeStr = formatDateTimeIST(orderTime);
  const payStatusStr = String(paymentStatus || 'PENDING').trim().toUpperCase();
  const addressStr = formatAddressSummary(deliveryAddress);

  const components = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: name },
        { type: 'text', text: ordIdStr },
        { type: 'text', text: store },
        { type: 'text', text: amountStr },
        { type: 'text', text: itemsStr },
        { type: 'text', text: timeStr },
        { type: 'text', text: payStatusStr },
        { type: 'text', text: addressStr }
      ]
    }
  ];

  return sendWhatsAppTemplate(customerPhone, templateName, components, options);
}

/**
 * Template C: Subscription Expiry Reminder – Merchant (Status: PENDING)
 * Template: inpinch_subscription_expiry (UTILITY, en_US)
 * Message: "Hello {{1}}, this is an important update regarding your store {{2}} on InPinch. Your merchant subscription plan for {{3}} is currently {{4}}. The scheduled expiry date for your plan is {{5}}. Please note: {{6}}. Thank you for partnering with InPinch!"
 *
 * Guarded: Stays bypassed and disabled until Meta approval is confirmed (WHATSAPP_TEMPLATE_SUB_EXPIRY_APPROVED=true).
 */
async function sendSubscriptionExpiryMerchantWhatsApp({
  merchantPhone,
  vendorName,
  storeName,
  planName,
  status,
  endDate,
  dynamicText,
  options = {}
}) {
  const activeTemplates = getActiveTemplateNames();
  const templateName = options.templateName || activeTemplates.subscriptionExpiry;
  if (!isSubscriptionExpiryTemplateApproved()) {
    console.log(`ℹ️ [WHATSAPP GUARD] Template "${templateName}" is currently PENDING Meta approval. WhatsApp dispatch safely bypassed.`);
    return {
      success: false,
      bypassed: true,
      reason: 'TEMPLATE_PENDING_APPROVAL',
      template: templateName
    };
  }
  const name = String(vendorName || 'Merchant').trim();
  const store = String(storeName || 'Store').trim();
  const plan = String(planName || 'Monthly Merchant Plan').trim();
  const subStatus = String(status || 'ACTIVE').trim().toUpperCase();
  const expDate = String(endDate || 'Upcoming').trim();
  const note = String(dynamicText || 'Please renew on your merchant portal to avoid store deactivation.').trim();

  const components = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: name },
        { type: 'text', text: store },
        { type: 'text', text: plan },
        { type: 'text', text: subStatus },
        { type: 'text', text: expDate },
        { type: 'text', text: note }
      ]
    }
  ];

  return sendWhatsAppTemplate(merchantPhone, templateName, components, options);
}

/**
 * Helper to format WhatsApp errors into standard JSON responses
 */
function formatWhatsAppErrorResponse(error) {
  if (error instanceof WhatsAppApiError) {
    return {
      statusCode: error.statusCode,
      body: {
        success: false,
        error: error.message,
        message: error.message,
        errorCode: error.errorCode,
        provider: 'whatsapp_cloud_api'
      }
    };
  }

  return {
    statusCode: 500,
    body: {
      success: false,
      error: error.message || 'Internal error in WhatsApp service',
      message: error.message || 'Internal error in WhatsApp service',
      provider: 'whatsapp_cloud_api'
    }
  };
}

module.exports = {
  sendWhatsAppOtp,
  sendWhatsAppTemplate,
  sendPaymentSuccessCustomerWhatsApp,
  sendOrderReceivedCustomerWhatsApp,
  sendSubscriptionExpiryMerchantWhatsApp,
  isSubscriptionExpiryTemplateApproved,
  getActiveTemplateNames,
  normalizeWhatsAppPhone,
  maskPhone,
  formatOrderId,
  formatCurrency,
  formatDateTimeIST,
  formatItemsSummary,
  formatAddressSummary,
  verifyWebhookSignature,
  formatWhatsAppErrorResponse,
  WhatsAppApiError,
  getConfig
};
