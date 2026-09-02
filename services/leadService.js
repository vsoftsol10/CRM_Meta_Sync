const axios = require('axios');

const CRM_URL = process.env.CRM_API_URL || 'https://vconstech-crm-new.onrender.com/api/leads';

const seen = new Map();

function createLocalLead(payload) {
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...payload,
  };
}

function stripCountryCode(phoneRaw) {
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

async function createLead({
  channel,
  channelUserId,
  fullName,
  company,
  phone,
  phoneRaw,
  email,
  plan,
  requirements,
}) {
  const key = `${channel}:${channelUserId}`;
  const payload = {
    fullName: fullName || 'Unknown',
    company: company || 'N/A',
    phone: phone || (phoneRaw ? stripCountryCode(phoneRaw) : createPlaceholderPhone(channelUserId)),
    email: email || `${channelUserId}@${channel.toLowerCase()}.lead`,
    status: 'New',
    plan: plan || 'Unassigned',
    channel,
    date: new Date().toISOString().split('T')[0],
  };

  if (requirements) {
    payload.requirements = requirements;
  }

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

async function findOrCreateLead({ channel, channelUserId, fullName, phoneRaw }) {
  const key = `${channel}:${channelUserId}`;
  if (seen.has(key)) return seen.get(key);

  return createLead({ channel, channelUserId, fullName, phoneRaw });
}

function listLeads() {
  return Array.from(seen.values());
}

module.exports = { createLead, findOrCreateLead, listLeads };
