const axios = require('axios');

async function sendMessage({ channel, channelUserId, text }) {
  if (channel === 'WhatsApp') {
    // Only works inside the 24-hour customer service window (i.e. within 24h
    // of the user's last inbound message). Outside that window WhatsApp
    // rejects free-form text and you must send a pre-approved template
    // message instead — those are configured in Business Manager, not here.
    return axios.post(
      `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: channelUserId,
        type: 'text',
        text: { body: text },
      },
      { headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` } }
    );
  }

  if (channel === 'Facebook') {
    return axios.post(
      `https://graph.facebook.com/v20.0/me/messages`,
      {
        recipient: { id: channelUserId },
        message: { text },
        messaging_type: 'RESPONSE',
      },
      { params: { access_token: process.env.PAGE_ACCESS_TOKEN } }
    );
  }

  if (channel === 'Instagram') {
    return axios.post(
      `https://graph.facebook.com/v20.0/me/messages`,
      {
        recipient: { id: channelUserId },
        message: { text },
      },
      { params: { access_token: process.env.PAGE_ACCESS_TOKEN } }
    );
  }

  throw new Error(`Unknown channel: ${channel}`);
}

module.exports = { sendMessage };
