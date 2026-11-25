'use strict';
require('dotenv').config();
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
 * Retrieves configuration values from environment
 */
function getConfig() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v22.0';
  const templateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME || 'connexon_auth_code';
  const webhookVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'connexon_agent_token_2026';
  const appSecret = process.env.WHATSAPP_APP_SECRET || '';

  return {
    phoneNumberId,
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
  normalizeWhatsAppPhone,
  maskPhone,
  verifyWebhookSignature,
  formatWhatsAppErrorResponse,
  WhatsAppApiError,
  getConfig
};
