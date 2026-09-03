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
const { createLead, findOrCreateLead, listLeads } = require('./services/leadService');
const { sendMessage } = require('./services/sendMessage');
const { saveMessage, getMessages } = require('./services/messageStore');
const {
  completeRegistration,
  createRegistration,
  getRegistration,
} = require('./services/registrationStore');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || 'https://crm-meta-sync.onrender.com').replace(/\/$/, '');

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
  console.log('Webhook POST received:', JSON.stringify(body, null, 2));

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
    console.error('Webhook processing error:', err.response?.data || err.message);
  }
});

async function sendRegistrationLink({ channel, channelUserId, fullName, initialMessage }) {
  const registration = createRegistration({
    channel,
    channelUserId,
    fullName,
    initialMessage,
  });
  const link = `${PUBLIC_BASE_URL}/register/${registration.token}`;
  const text = `Thanks for messaging us. Please complete this registration form so our team can help you: ${link}`;

  await sendMessage({ channel, channelUserId, text });
  console.log(`${channel} registration link sent: ${link}`);
}

async function handleMessenger(body) {
  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      if (event.message?.is_echo) {
        console.log('Skipping Facebook echo of our own outbound message.');
        continue;
      }

      if (!event.message) {
        console.log('Skipping Facebook event without inbound message.');
        continue;
      }

      const senderId = event.sender.id;
      const text = event.message.text || '';

      const profile = await getMessengerProfile(senderId, process.env.PAGE_ACCESS_TOKEN);

      await sendRegistrationLink({
        channel: 'Facebook',
        channelUserId: senderId,
        fullName: profile.name || 'Unknown',
        initialMessage: text,
      });
    }
  }
}

async function handleInstagram(body) {
  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      if (event.message?.is_echo) {
        console.log('Skipping Instagram echo of our own outbound message.');
        continue;
      }

      if (!event.message) {
        console.log('Skipping Instagram event without inbound message.');
        continue;
      }

      const senderId = event.sender.id;
      const text = event.message.text || '';

      await sendRegistrationLink({
        channel: 'Instagram',
        channelUserId: senderId,
        // IG's Send API doesn't hand you a display name without extra
        // permissions/review — leaving it generic until you fetch it another way.
        fullName: 'Instagram User',
        initialMessage: text,
      });
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
        console.log(`WhatsApp lead saved: ${lead.id}`);
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
function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderRegistrationForm(registration, error = '') {
  const fullName = registration.fullName === 'Unknown' ? '' : registration.fullName;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Lead Registration</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #f6f7f9; color: #17202a; }
    main { max-width: 560px; margin: 32px auto; padding: 24px; background: #fff; border: 1px solid #dfe3e8; border-radius: 8px; }
    h1 { margin: 0 0 20px; font-size: 24px; }
    label { display: block; margin-top: 14px; font-weight: 700; }
    input, textarea, select { box-sizing: border-box; width: 100%; margin-top: 6px; padding: 11px; border: 1px solid #c9d1d9; border-radius: 6px; font-size: 15px; }
    textarea { min-height: 92px; resize: vertical; }
    button { margin-top: 20px; width: 100%; padding: 12px; border: 0; border-radius: 6px; background: #1769aa; color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; }
    .error { padding: 10px 12px; margin-bottom: 16px; color: #8a1f11; background: #fff0ed; border: 1px solid #ffc9bf; border-radius: 6px; }
  </style>
</head>
<body>
  <main>
    <h1>Registration Form</h1>
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
    <form method="post">
      <label>Full name
        <input name="fullName" value="${escapeHtml(fullName)}" required>
      </label>
      <label>Company
        <input name="company" required>
      </label>
      <label>Mobile number
        <input name="phone" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" required>
      </label>
      <label>Email
        <input name="email" type="email" required>
      </label>
      <label>Requirements
        <textarea name="requirements" placeholder="Tell us what you need"></textarea>
      </label>
      <button type="submit">Submit</button>
    </form>
  </main>
</body>
</html>`;
}

function renderRegistrationCompletePage({ alreadySubmitted = false } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Registration Submitted</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Arial, sans-serif; background: #f6f7f9; color: #17202a; }
    main { width: min(560px, calc(100% - 32px)); padding: 28px; box-sizing: border-box; background: #fff; border: 1px solid #dfe3e8; border-radius: 8px; text-align: center; }
    .icon { display: inline-grid; place-items: center; width: 56px; height: 56px; margin-bottom: 18px; border-radius: 50%; background: #e7f6ee; color: #168144; font-size: 30px; font-weight: 700; }
    h1 { margin: 0; font-size: 25px; line-height: 1.25; }
    p { margin: 12px 0 0; color: #52616f; font-size: 16px; line-height: 1.5; }
  </style>
</head>
<body>
  <main>
    <div class="icon">✓</div>
    <h1>${alreadySubmitted ? 'Registration already submitted' : 'Registration submitted'}</h1>
    <p>${alreadySubmitted ? 'We already have your details. Our team will contact you soon.' : 'Thank you. We have received your details and our team will contact you soon.'}</p>
  </main>
</body>
</html>`;
}

app.get('/register/:token', (req, res) => {
  const registration = getRegistration(req.params.token);

  if (!registration) {
    return res.status(404).send('Registration link not found.');
  }

  if (registration.status === 'completed') {
    return res.type('html').send(renderRegistrationCompletePage({ alreadySubmitted: true }));
  }

  return res.type('html').send(renderRegistrationForm(registration));
});

app.post('/register/:token', async (req, res) => {
  const registration = getRegistration(req.params.token);

  if (!registration) {
    return res.status(404).send('Registration link not found.');
  }

  if (registration.status === 'completed') {
    return res.type('html').send(renderRegistrationCompletePage({ alreadySubmitted: true }));
  }

  const phone = String(req.body.phone || '').replace(/\D/g, '');
  if (phone.length !== 10) {
    return res.status(400).type('html').send(renderRegistrationForm(registration, 'Enter a valid 10-digit mobile number.'));
  }

  const lead = await createLead({
    channel: registration.channel,
    channelUserId: registration.channelUserId,
    fullName: req.body.fullName,
    company: req.body.company,
    phone,
    email: req.body.email,
    plan: 'none',
    requirements: req.body.requirements,
  });

  await saveMessage({
    leadId: lead.id,
    channel: registration.channel,
    channelUserId: registration.channelUserId,
    direction: 'in',
    text: registration.initialMessage || '',
  });

  completeRegistration(req.params.token, lead);
  return res.type('html').send(renderRegistrationCompletePage());
});

app.get('/api/local-leads', (req, res) => res.json(listLeads()));

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
