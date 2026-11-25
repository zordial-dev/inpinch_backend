'use strict';
const { verifyWebhookSignature, getConfig } = require('../services/whatsappService');

/**
 * Controller for Meta WhatsApp Cloud API Webhooks
 * Follows Meta official webhook specification:
 * https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/
 */

/**
 * GET /api/webhooks/whatsapp
 * Verifies webhook subscription challenge from Meta Graph API.
 */
function verifyWhatsAppWebhook(req, res) {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const config = getConfig();
    const expectedToken = config.webhookVerifyToken;

    if (mode === 'subscribe' && token === expectedToken) {
      console.log('✅ [WHATSAPP WEBHOOK VERIFIED] Meta challenge confirmed successfully.');
      return res.status(200).send(challenge);
    }

    console.warn('⚠️ [WHATSAPP WEBHOOK VERIFICATION FAILED] Token mismatch or invalid mode:', {
      mode,
      receivedToken: token ? `${token.slice(0, 4)}***` : 'none'
    });
    return res.status(403).json({ error: 'Verification token mismatch' });
  } catch (error) {
    console.error('Error in verifyWhatsAppWebhook:', error);
    return res.status(500).json({ error: 'Internal server error during webhook verification' });
  }
}

/**
 * POST /api/webhooks/whatsapp
 * Receives and processes real-time delivery status updates and messages from Meta WhatsApp.
 */
function handleWhatsAppWebhook(req, res) {
  try {
    const signature = req.headers['x-hub-signature-256'];
    const rawBody = req.rawBody || JSON.stringify(req.body);

    // Verify signature if app secret is configured
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.warn('⚠️ [WHATSAPP WEBHOOK] Invalid signature detected. Rejecting payload.');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const body = req.body;

    // Check if this is an event from a WhatsApp Business Account
    if (body.object === 'whatsapp_business_account') {
      const entries = body.entry || [];

      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const value = change.value;
          if (!value) continue;

          // Process status updates (sent, delivered, read, failed)
          if (value.statuses && Array.isArray(value.statuses)) {
            for (const status of value.statuses) {
              const msgId = status.id;
              const deliveryStatus = status.status;
              const recipientId = status.recipient_id;
              const timestamp = status.timestamp;

              if (deliveryStatus === 'failed') {
                const errors = status.errors || [];
                console.error(`❌ [WHATSAPP DELIVERY FAILED] Msg ID: ${msgId} to recipient ${recipientId}. Errors:`, errors);
              } else {
                console.log(`🔔 [WHATSAPP DELIVERY STATUS] Msg ID: ${msgId} | Status: ${deliveryStatus} | Timestamp: ${timestamp}`);
              }
            }
          }

          // Process incoming messages (if user replies)
          if (value.messages && Array.isArray(value.messages)) {
            for (const msg of value.messages) {
              console.log(`📩 [WHATSAPP INCOMING MSG] From: ${msg.from} | Type: ${msg.type} | ID: ${msg.id}`);
            }
          }
        }
      }

      // Return a 200 OK to all notifications from Meta
      return res.status(200).send('EVENT_RECEIVED');
    }

    return res.status(404).send();
  } catch (error) {
    console.error('Error handling WhatsApp webhook notification:', error);
    // Always return 200 to acknowledge Meta and avoid webhook retry spam
    return res.status(200).send('EVENT_RECEIVED');
  }
}

module.exports = {
  verifyWhatsAppWebhook,
  handleWhatsAppWebhook
};
