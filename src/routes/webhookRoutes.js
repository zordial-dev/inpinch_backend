'use strict';
const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

/**
 * Meta WhatsApp Cloud API Webhook Routes
 * Supports verification challenge (GET) and real-time events (POST).
 */
router.get(['/whatsapp', '/whatsapp/webhook'], webhookController.verifyWhatsAppWebhook);
router.post(['/whatsapp', '/whatsapp/webhook'], webhookController.handleWhatsAppWebhook);

module.exports = router;
