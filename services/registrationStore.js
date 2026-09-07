const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'registrations.json');
const TOKEN_VERSION = 'v1';
const DEFAULT_LINK_TTL_DAYS = 30;

function load() {
  if (!fs.existsSync(FILE)) return {};
  return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
}

function persist(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function registrationSecret() {
  // META_VERIFY_TOKEN is already a stable private value in existing deployments.
  // REGISTRATION_TOKEN_SECRET is preferred so the form-link key can be rotated independently.
  const secret = process.env.REGISTRATION_TOKEN_SECRET || process.env.META_VERIFY_TOKEN;

  if (!secret) {
    throw new Error('REGISTRATION_TOKEN_SECRET or META_VERIFY_TOKEN must be configured.');
  }

  return crypto.createHash('sha256').update(secret).digest();
}

function toBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function fromBase64Url(value) {
  return Buffer.from(value, 'base64url');
}

function createToken(registration) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', registrationSecret(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(registration), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [TOKEN_VERSION, toBase64Url(iv), toBase64Url(encrypted), toBase64Url(tag)].join('.');
}

function readToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 4 || parts[0] !== TOKEN_VERSION) return null;

  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      registrationSecret(),
      fromBase64Url(parts[1])
    );
    decipher.setAuthTag(fromBase64Url(parts[3]));
    const decrypted = Buffer.concat([
      decipher.update(fromBase64Url(parts[2])),
      decipher.final(),
    ]);
    const registration = JSON.parse(decrypted.toString('utf8'));

    if (
      !registration ||
      !registration.channel ||
      !registration.channelUserId ||
      !registration.expiresAt ||
      new Date(registration.expiresAt).getTime() < Date.now()
    ) {
      return null;
    }

    return { ...registration, token, status: 'pending' };
  } catch {
    return null;
  }
}

function createRegistration(context) {
  const data = load();
  const createdAt = new Date();
  const ttlDays = Number(process.env.REGISTRATION_LINK_TTL_DAYS || DEFAULT_LINK_TTL_DAYS);
  const expiresAt = new Date(
    createdAt.getTime() + (Number.isFinite(ttlDays) && ttlDays > 0 ? ttlDays : DEFAULT_LINK_TTL_DAYS) * 86400000
  ).toISOString();
  const registration = {
    ...context,
    status: 'pending',
    createdAt: createdAt.toISOString(),
    expiresAt,
  };
  const token = createToken(registration);

  data[token] = { ...registration, token };

  persist(data);
  return data[token];
}

function getRegistration(token) {
  return load()[token] || readToken(token);
}

function getPendingRegistration(channel, channelUserId) {
  return Object.values(load()).find(
    (registration) =>
      registration.channel === channel &&
      registration.channelUserId === channelUserId &&
      registration.status === 'pending'
  ) || null;
}

function completeRegistration(token, lead) {
  const data = load();
  const registration = data[token] || readToken(token);
  if (!registration) return null;

  data[token] = {
    ...registration,
    token,
    status: 'completed',
    lead,
    completedAt: new Date().toISOString(),
  };

  persist(data);
  return data[token];
}

module.exports = { createRegistration, getRegistration, getPendingRegistration, completeRegistration };
