const fs = require('fs');
const path = require('path');

// The CRM stores leads, not conversation threads, so there's nowhere on the
// CRM side to keep the message history. This is a flat-file store good
// enough for local testing. IMPORTANT: Render's filesystem is ephemeral —
// this file gets wiped on every redeploy there. Before moving to the
// Hostinger VPS for production, swap this for SQLite or Postgres.
const FILE = path.join(__dirname, '..', 'messages.json');

function load() {
  if (!fs.existsSync(FILE)) return {};
  return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
}

function persist(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

async function saveMessage({ leadId, channel, channelUserId, direction, text }) {
  const data = load();
  if (!data[leadId]) data[leadId] = [];
  data[leadId].push({ channel, channelUserId, direction, text, at: new Date().toISOString() });
  persist(data);
}

async function getMessages(leadId) {
  const data = load();
  return data[leadId] || [];
}

module.exports = { saveMessage, getMessages };