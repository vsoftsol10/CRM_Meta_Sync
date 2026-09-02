const axios = require('axios');

const CRM_URL = 'https://vconstech-crm-new.onrender.com/api/leads';

// We haven't confirmed the CRM has a "find by channel + channelUserId" GET
// endpoint — only POST /api/leads is confirmed working. So this keeps an
// in-memory map to avoid creating a duplicate lead every time the same
// person messages again. It resets on server restart; swap for a real table
// (SQLite/Postgres) before this goes to production on the VPS.
const seen = new Map(); // key: `${channel}:${channelUserId}` -> lead object returned by CRM

function createLocalLead(payload) {
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...payload,
  };
}

function stripCountryCode(phoneRaw) {
  // WhatsApp sends the full E.164 number without '+', e.g. "919876543210".
  // The CRM wants exactly 10 digits, no country code. This assumes Indian
  // numbers (91 + 10 digits) — adjust the slice logic if you get senders
  // from other countries.
  const digits = (phoneRaw || '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function createPlaceholderPhone(channelUserId) {
  const source = String(channelUserId || '0');
  const numeric = source.replace(/\D/g, '');

  if (numeric.length >= 9) {
    return `9${numeric.slice(-9)}`;
  }

  let hash = 0;
  for (const char of source) {
    hash = (hash * 31 + char.charCodeAt(0)) % 1000000000;
  }

  return `9${String(hash).padStart(9, '0')}`;
}

async function findOrCreateLead({ channel, channelUserId, fullName, phoneRaw }) {
  const key = `${channel}:${channelUserId}`;
  if (seen.has(key)) return seen.get(key);

  const payload = {
    fullName: fullName || 'Unknown',
    company: 'N/A', // Meta never gives you a company name — capture it later in conversation if needed
    phone: phoneRaw ? stripCountryCode(phoneRaw) : createPlaceholderPhone(channelUserId), // Messenger/Instagram don't expose phone numbers at all
    email: `${channelUserId}@${channel.toLowerCase()}.lead`, // placeholder — Meta doesn't expose email either
    status: 'New',
    plan: 'Unassigned',
    channel,
    date: new Date().toISOString().split('T')[0],
  };

  let lead = createLocalLead(payload);

  try {
    const { data } = await axios.post(CRM_URL, payload);
    lead = { ...lead, ...data };
  } catch (error) {
    console.error('CRM lead forwarding failed:', error.response?.data || error.message);
  }

  seen.set(key, lead);
  return lead;
}

function listLeads() {
  return Array.from(seen.values());
}

module.exports = { findOrCreateLead, listLeads };
