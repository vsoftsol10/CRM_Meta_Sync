// require('dotenv').config();

// const express = require('express');
// const axios = require('axios');
// const bodyParser = require('body-parser');

// const app = express();
// const PORT = process.env.PORT || 3001;
// const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
// const CRM_API_URL = process.env.CRM_API_URL;

// app.use((req, res, next) => {
//   console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
//   next();
// });

// app.use(bodyParser.json({ limit: '2mb' }));

// app.get('/', (req, res) => {
//   res.status(200).send('Webhook service running');
// });

// app.get('/webhooks/meta', (req, res) => {
//   const mode = req.query['hub.mode'];
//   const verifyToken = req.query['hub.verify_token'];
//   const challenge = req.query['hub.challenge'];

//   if (mode === 'subscribe' && verifyToken === META_VERIFY_TOKEN) {
//     return res.status(200).type('text/plain').send(challenge);
//   }

//   return res.sendStatus(403);
// });

// app.post('/webhooks/meta', (req, res) => {
//   const payload = req.body;

//   console.log('Received Meta webhook payload:', JSON.stringify(payload, null, 2));

//   // Meta expects webhook receivers to acknowledge quickly. Process CRM forwarding
//   // after the 200 response so a slow CRM API does not make Meta retry the event.
//   res.sendStatus(200);

//   setImmediate(async () => {
//     try {
//       const messages = extractMessages(payload);

//       if (!messages.length) {
//         console.log('No supported inbound messages found in payload.');
//         return;
//       }

//       await Promise.all(messages.map(forwardLeadToCrm));
//     } catch (error) {
//       console.error('Failed to process Meta webhook payload:', error.message);
//     }
//   });
// });

// function extractMessages(payload) {
//   if (!payload || !Array.isArray(payload.entry)) {
//     return [];
//   }

//   if (payload.object === 'whatsapp_business_account') {
//     return extractWhatsAppMessages(payload);
//   }

//   if (payload.object === 'page') {
//     return extractMessagingMessages(payload, 'Facebook');
//   }

//   if (payload.object === 'instagram') {
//     return extractMessagingMessages(payload, 'Instagram');
//   }

//   console.log(`Unsupported Meta webhook object: ${payload.object || 'unknown'}`);
//   return [];
// }

// function extractWhatsAppMessages(payload) {
//   const extractedMessages = [];

//   // WhatsApp payloads are nested under entry[].changes[].value.messages[].
//   // Sender profile data, when present, lives beside messages in value.contacts[].
//   for (const entry of payload.entry || []) {
//     for (const change of entry.changes || []) {
//       const value = change.value || {};
//       const contactsByWaId = new Map(
//         (value.contacts || []).map((contact) => [contact.wa_id, contact])
//       );

//       for (const message of value.messages || []) {
//         const contact = contactsByWaId.get(message.from) || {};
//         const messageText = getWhatsAppMessageText(message);

//         if (!messageText) {
//           continue;
//         }

//         extractedMessages.push({
//           channel: 'WhatsApp',
//           senderName: contact.profile && contact.profile.name,
//           senderId: message.from || contact.wa_id || '',
//           phone: normalizePhone(message.from || contact.wa_id || ''),
//           messageText,
//           timestamp: toIsoTimestamp(message.timestamp, true)
//         });
//       }
//     }
//   }

//   return extractedMessages;
// }

// function extractMessagingMessages(payload, channel) {
//   const extractedMessages = [];

//   // Facebook Messenger and Instagram messaging share entry[].messaging[].
//   // The sender identifier is a PSID for Facebook and an IGSID for Instagram.
//   for (const entry of payload.entry || []) {
//     for (const event of entry.messaging || []) {
//       const senderId = event.sender && event.sender.id;
//       const messageText = event.message && event.message.text;

//       if (!senderId || !messageText) {
//         continue;
//       }

//       extractedMessages.push({
//         channel,
//         senderName: '',
//         senderId,
//         phone: '',
//         messageText,
//         timestamp: toIsoTimestamp(event.timestamp, false)
//       });
//     }
//   }

//   return extractedMessages;
// }

// function getWhatsAppMessageText(message) {
//   if (message.text && message.text.body) {
//     return message.text.body;
//   }

//   if (message.button && message.button.text) {
//     return message.button.text;
//   }

//   if (message.interactive && message.interactive.button_reply) {
//     return message.interactive.button_reply.title;
//   }

//   if (message.interactive && message.interactive.list_reply) {
//     return message.interactive.list_reply.title;
//   }

//   return '';
// }

// function normalizePhone(value) {
//   const digitsOnly = String(value || '').replace(/\D/g, '');

//   if (!digitsOnly) {
//     return '';
//   }

//   return digitsOnly.slice(-10);
// }

// function toIsoTimestamp(value, isUnixSeconds) {
//   if (!value) {
//     return new Date().toISOString();
//   }

//   const numericValue = Number(value);

//   if (!Number.isNaN(numericValue)) {
//     return new Date(isUnixSeconds ? numericValue * 1000 : numericValue).toISOString();
//   }

//   return new Date(value).toISOString();
// }

// async function forwardLeadToCrm(message) {
//   if (!CRM_API_URL) {
//     console.error('CRM_API_URL is not configured. Lead was not forwarded.');
//     return;
//   }

//   const lead = {
//     fullName: message.senderName || `Unknown - ${message.channel}`,
//     company: 'Not Provided',
//     phone: message.channel === 'WhatsApp' ? message.phone : '0000000000',
//     email: 'not-provided@placeholder.com',
//     status: 'New',
//     plan: 'Free',
//     channel: message.channel,
//     date: new Date().toISOString().slice(0, 10)
//   };

//   try {
//     const response = await axios.post(CRM_API_URL, lead);
//     const leadId =
//       response.data && (response.data.id || response.data._id || response.data.leadId);

//     console.log(
//       `Lead forwarded to CRM successfully${leadId ? ` with id ${leadId}` : ''}.`
//     );
//   } catch (error) {
//     const messageText =
//       (error.response && JSON.stringify(error.response.data)) || error.message;

//     console.error(`Failed to forward lead to CRM: ${messageText}`);
//   }
// }

// app.listen(PORT, () => {
//   console.log(`Meta webhook service listening on port ${PORT}`);
// });

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { findOrCreateLead, listLeads } = require('./services/leadService');
const { sendMessage } = require('./services/sendMessage');
const { saveMessage, getMessages } = require('./services/messageStore');

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;

// ---------------------------------------------------------------------------
// Webhook verification (GET) — Meta calls this once when you save the
// callback URL in the App Dashboard. Same URL/endpoint is reused for all
// three products (Messenger, Instagram, WhatsApp) since they all verify the
// same way.
// ---------------------------------------------------------------------------
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ---------------------------------------------------------------------------
// Unified event receiver (POST) — Meta posts every message/status event here.
// `body.object` tells you which product it came from.
// ---------------------------------------------------------------------------
app.post('/webhook', async (req, res) => {
  // Ack immediately. Meta retries with backoff if it doesn't get a fast 200,
  // and retries can duplicate events, so do the real work after responding.
  res.sendStatus(200);

  const body = req.body;

  try {
    if (body.object === 'page') {
      await handleMessenger(body);
    } else if (body.object === 'instagram') {
      await handleInstagram(body);
    } else if (body.object === 'whatsapp_business_account') {
      await handleWhatsApp(body);
    } else {
      console.log('Unhandled webhook object type:', body.object);
    }
  } catch (err) {
    console.error('Webhook processing error:', err.message);
  }
});

async function handleMessenger(body) {
  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      if (!event.message || event.message.is_echo) continue; // skip echoes of our own replies
      const senderId = event.sender.id;
      const text = event.message.text || '';

      const profile = await getMessengerProfile(senderId, process.env.PAGE_ACCESS_TOKEN);

      const lead = await findOrCreateLead({
        channel: 'Facebook',
        channelUserId: senderId,
        fullName: profile.name || 'Unknown',
      });

      await saveMessage({ leadId: lead.id, channel: 'Facebook', channelUserId: senderId, direction: 'in', text });
    }
  }
}

async function handleInstagram(body) {
  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      if (!event.message || event.message.is_echo) continue;
      const senderId = event.sender.id;
      const text = event.message.text || '';

      const lead = await findOrCreateLead({
        channel: 'Instagram',
        channelUserId: senderId,
        // IG's Send API doesn't hand you a display name without extra
        // permissions/review — leaving it generic until you fetch it another way.
        fullName: 'Instagram User',
      });

      await saveMessage({ leadId: lead.id, channel: 'Instagram', channelUserId: senderId, direction: 'in', text });
    }
  }
}

async function handleWhatsApp(body) {
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value.messages) continue; // delivery/read status updates land here too — ignore them

      for (const msg of value.messages) {
        const from = msg.from; // e.g. "919876543210", no '+'
        const text = msg.text ? msg.text.body : '';
        const contact = (value.contacts || [])[0];
        const name = contact ? contact.profile.name : 'Unknown';

        const lead = await findOrCreateLead({
          channel: 'WhatsApp',
          channelUserId: from,
          fullName: name,
          phoneRaw: from,
        });

        await saveMessage({ leadId: lead.id, channel: 'WhatsApp', channelUserId: from, direction: 'in', text });
      }
    }
  }
}

async function getMessengerProfile(psid, pageToken) {
  try {
    const { data } = await axios.get(`https://graph.facebook.com/v20.0/${psid}`, {
      params: { fields: 'first_name,last_name', access_token: pageToken },
    });
    return { name: `${data.first_name || ''} ${data.last_name || ''}`.trim() };
  } catch {
    return { name: 'Unknown' };
  }
}

// ---------------------------------------------------------------------------
// Small API surface for the React inbox (not part of Meta's contract — these
// are just endpoints on your own server).
// ---------------------------------------------------------------------------
app.get('/api/local-leads', (req, res) => res.json(listLeads()));

app.get('/api/test-lead', async (req, res) => {
  const lead = await findOrCreateLead({
    channel: 'WhatsApp',
    channelUserId: `test-${Date.now()}`,
    fullName: 'Test Lead',
    phoneRaw: '919999999999',
  });

  await saveMessage({
    leadId: lead.id,
    channel: 'WhatsApp',
    channelUserId: lead.channelUserId || 'test-user',
    direction: 'in',
    text: 'Hi, I am interested',
  });

  res.json({ ok: true, lead });
});

app.get('/api/leads/:id/messages', async (req, res) => {
  res.json(await getMessages(req.params.id));
});

app.post('/api/reply', async (req, res) => {
  const { leadId, channel, channelUserId, text } = req.body;
  try {
    await sendMessage({ channel, channelUserId, text });
    await saveMessage({ leadId, channel, channelUserId, direction: 'out', text });
    res.json({ ok: true });
  } catch (err) {
    console.error('Reply failed:', err.response?.data || err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Webhook receiver listening on ${PORT}`));
