const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'registrations.json');

function load() {
  if (!fs.existsSync(FILE)) return {};
  return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
}

function persist(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function createRegistration(context) {
  const data = load();
  const token = crypto.randomBytes(18).toString('hex');

  data[token] = {
    ...context,
    token,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  persist(data);
  return data[token];
}

function getRegistration(token) {
  return load()[token] || null;
}

function completeRegistration(token, lead) {
  const data = load();
  if (!data[token]) return null;

  data[token] = {
    ...data[token],
    status: 'completed',
    lead,
    completedAt: new Date().toISOString(),
  };

  persist(data);
  return data[token];
}

module.exports = { createRegistration, getRegistration, completeRegistration };
