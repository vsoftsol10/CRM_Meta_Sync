const axios = require('axios');

const CRM_URL = 'https://vconstech-crm-new.onrender.com/api/leads';

// We haven't confirmed the CRM has a "find by channel + channelUserId" GET
// endpoint — only POST /api/leads is confirmed working. So this keeps an
// in-memory map to avoid creating a duplicate lead every time the same
// person messages again. It resets on server restart; swap for a real table
// (SQLite/Postgres) before this goes to production on the VPS.
const seen = new Map(); // key: `${channel}:${channelUserId}` -> lead object returned by CRM

function stripCountryCode(phoneRaw) {
  // WhatsApp sends the full E.164 number without '+', e.g. "919876543210".
  // The CRM wants exactly 10 digits, no country code. This assumes Indian
  // numbers (91 + 10 digits) — adjust the slice logic if you get senders
  // from other countries.
  const digits = (phoneRaw || '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

async function findOrCreateLead({ channel, channelUserId, fullName, phoneRaw }) {
  const key = `${channel}:${channelUserId}`;
  if (seen.has(key)) return seen.get(key);

  const payload = {
    fullName: fullName || 'Unknown',
    company: 'N/A', // Meta never gives you a company name — capture it later in conversation if needed
    phone: phoneRaw ? stripCountryCode(phoneRaw) : '0000000000', // Messenger/Instagram don't expose phone numbers at all
    email: `${channelUserId}@${channel.toLowerCase()}.lead`, // placeholder — Meta doesn't expose email either
    status: 'New',
    plan: 'Unassigned',
    channel,
    date: new Date().toISOString().split('T')[0],
  };

  const { data: lead } = await axios.post(CRM_URL, payload);
  seen.set(key, lead);
  return lead;
}

function listLeads() {
  return Array.from(seen.values());
}

module.exports = { findOrCreateLead, listLeads };