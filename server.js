require('dotenv').config();

const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3001;
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
const CRM_API_URL = process.env.CRM_API_URL;

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

app.use(bodyParser.json({ limit: '2mb' }));

app.get('/', (req, res) => {
  res.status(200).send('Webhook service running');
});

app.get('/webhooks/meta', (req, res) => {
  const mode = req.query['hub.mode'];
  const verifyToken = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && verifyToken === META_VERIFY_TOKEN) {
    return res.status(200).type('text/plain').send(challenge);
  }

  return res.sendStatus(403);
});

app.post('/webhooks/meta', (req, res) => {
  const payload = req.body;

  console.log('Received Meta webhook payload:', JSON.stringify(payload, null, 2));

  // Meta expects webhook receivers to acknowledge quickly. Process CRM forwarding
  // after the 200 response so a slow CRM API does not make Meta retry the event.
  res.sendStatus(200);

  setImmediate(async () => {
    try {
      const messages = extractMessages(payload);

      if (!messages.length) {
        console.log('No supported inbound messages found in payload.');
        return;
      }

      await Promise.all(messages.map(forwardLeadToCrm));
    } catch (error) {
      console.error('Failed to process Meta webhook payload:', error.message);
    }
  });
});

function extractMessages(payload) {
  if (!payload || !Array.isArray(payload.entry)) {
    return [];
  }

  if (payload.object === 'whatsapp_business_account') {
    return extractWhatsAppMessages(payload);
  }

  if (payload.object === 'page') {
    return extractMessagingMessages(payload, 'Facebook');
  }

  if (payload.object === 'instagram') {
    return extractMessagingMessages(payload, 'Instagram');
  }

  console.log(`Unsupported Meta webhook object: ${payload.object || 'unknown'}`);
  return [];
}

function extractWhatsAppMessages(payload) {
  const extractedMessages = [];

  // WhatsApp payloads are nested under entry[].changes[].value.messages[].
  // Sender profile data, when present, lives beside messages in value.contacts[].
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const contactsByWaId = new Map(
        (value.contacts || []).map((contact) => [contact.wa_id, contact])
      );

      for (const message of value.messages || []) {
        const contact = contactsByWaId.get(message.from) || {};
        const messageText = getWhatsAppMessageText(message);

        if (!messageText) {
          continue;
        }

        extractedMessages.push({
          channel: 'WhatsApp',
          senderName: contact.profile && contact.profile.name,
          senderId: message.from || contact.wa_id || '',
          phone: normalizePhone(message.from || contact.wa_id || ''),
          messageText,
          timestamp: toIsoTimestamp(message.timestamp, true)
        });
      }
    }
  }

  return extractedMessages;
}

function extractMessagingMessages(payload, channel) {
  const extractedMessages = [];

  // Facebook Messenger and Instagram messaging share entry[].messaging[].
  // The sender identifier is a PSID for Facebook and an IGSID for Instagram.
  for (const entry of payload.entry || []) {
    for (const event of entry.messaging || []) {
      const senderId = event.sender && event.sender.id;
      const messageText = event.message && event.message.text;

      if (!senderId || !messageText) {
        continue;
      }

      extractedMessages.push({
        channel,
        senderName: '',
        senderId,
        phone: '',
        messageText,
        timestamp: toIsoTimestamp(event.timestamp, false)
      });
    }
  }

  return extractedMessages;
}

function getWhatsAppMessageText(message) {
  if (message.text && message.text.body) {
    return message.text.body;
  }

  if (message.button && message.button.text) {
    return message.button.text;
  }

  if (message.interactive && message.interactive.button_reply) {
    return message.interactive.button_reply.title;
  }

  if (message.interactive && message.interactive.list_reply) {
    return message.interactive.list_reply.title;
  }

  return '';
}

function normalizePhone(value) {
  const digitsOnly = String(value || '').replace(/\D/g, '');

  if (!digitsOnly) {
    return '';
  }

  return digitsOnly.slice(-10);
}

function toIsoTimestamp(value, isUnixSeconds) {
  if (!value) {
    return new Date().toISOString();
  }

  const numericValue = Number(value);

  if (!Number.isNaN(numericValue)) {
    return new Date(isUnixSeconds ? numericValue * 1000 : numericValue).toISOString();
  }

  return new Date(value).toISOString();
}

async function forwardLeadToCrm(message) {
  if (!CRM_API_URL) {
    console.error('CRM_API_URL is not configured. Lead was not forwarded.');
    return;
  }

  const lead = {
    fullName: message.senderName || `Unknown - ${message.channel}`,
    company: 'Not Provided',
    phone: message.channel === 'WhatsApp' ? message.phone : '0000000000',
    email: 'not-provided@placeholder.com',
    status: 'New',
    plan: 'Free',
    channel: message.channel,
    date: new Date().toISOString().slice(0, 10)
  };

  try {
    const response = await axios.post(CRM_API_URL, lead);
    const leadId =
      response.data && (response.data.id || response.data._id || response.data.leadId);

    console.log(
      `Lead forwarded to CRM successfully${leadId ? ` with id ${leadId}` : ''}.`
    );
  } catch (error) {
    const messageText =
      (error.response && JSON.stringify(error.response.data)) || error.message;

    console.error(`Failed to forward lead to CRM: ${messageText}`);
  }
}

app.listen(PORT, () => {
  console.log(`Meta webhook service listening on port ${PORT}`);
});
