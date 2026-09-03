const axios = require('axios');

const CRM_URL = process.env.CRM_API_URL || 'https://vconstech-crm-new.onrender.com/api/leads';
const CRM_RETRY_DELAYS_MS = [0, 15000, 60000, 180000, 300000];

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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelay(error, failedAttempt) {
  const retryAfter = error.response?.headers?.['retry-after'];
  const retryAfterSeconds = Number(retryAfter);

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }

  return CRM_RETRY_DELAYS_MS[failedAttempt] || CRM_RETRY_DELAYS_MS[CRM_RETRY_DELAYS_MS.length - 1];
}

async function forwardLeadToCrm(payload, lead) {
  console.log(`Forwarding ${payload.channel} lead to remote CRM: ${lead.id}`);

  for (let attempt = 1; attempt <= CRM_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const { data } = await axios.post(CRM_URL, payload);
      Object.assign(lead, data);
      console.log(`Remote CRM accepted ${payload.channel} lead: ${lead.id}`);
      return;
    } catch (error) {
      const status = error.response?.status;
      const shouldRetry = status === 429 && attempt < CRM_RETRY_DELAYS_MS.length;

      if (!shouldRetry) {
        throw error;
      }

      const delay = getRetryDelay(error, attempt);
      console.warn(`Remote CRM is rate-limiting this app. Retrying ${payload.channel} lead forwarding in ${delay}ms.`);
      await wait(delay);
    }
  }
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
  seen.set(key, lead);

  forwardLeadToCrm(payload, lead).catch((error) => {
    console.error(`Remote CRM lead forwarding failed for ${payload.channel}:`, error.response?.status || '', error.response?.data || error.message);
  });

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
