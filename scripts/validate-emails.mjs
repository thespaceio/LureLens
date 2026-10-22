// Checks src/data/emails.json before every build in CI, so broken JSON,
// lopsided levels, unsafe HTML or emails without explanations never ship.
// Usage: npm run check:data
import { readFileSync } from 'node:fs';

const FILE = new URL('../src/data/emails.json', import.meta.url);
const LEVELS = ['beginner', 'intermediate', 'advanced'];
const CATEGORIES = ['banking', 'workplace', 'accounts', 'shopping', 'government', 'offers'];
const ROUNDS = 10;
const CHANNELS = ['email', 'sms', 'whatsapp'];
const PHONE_RE = /^\+?[0-9][0-9 ]{6,}$/;
const EMAIL_RE = /^[^\s@<>]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

const errors = [];
const fail = (id, msg) => errors.push(`${id}: ${msg}`);

let emails;
try {
  emails = JSON.parse(readFileSync(FILE, 'utf8'));
} catch (e) {
  console.error(`emails.json is not valid JSON: ${e.message}`);
  process.exit(1);
}
if (!Array.isArray(emails)) {
  console.error('emails.json must be an array');
  process.exit(1);
}

const seenIds = new Set();
const seenSubjects = new Map();
for (const e of emails) {
  const id = e?.id ?? '(missing id)';
  if (typeof e.id !== 'string' || !e.id) fail(id, 'missing id');
  else if (seenIds.has(e.id)) fail(id, 'duplicate id');
  seenIds.add(e.id);

  if (!LEVELS.includes(e.level)) fail(id, `unknown level "${e.level}"`);
  if (!CATEGORIES.includes(e.category)) fail(id, `unknown category "${e.category}"`);
  if (typeof e.is_phishing !== 'boolean') fail(id, 'is_phishing must be true or false');
  const channel = e.channel ?? 'email';
  if (!CHANNELS.includes(channel)) fail(id, `unknown channel "${e.channel}"`);
  for (const key of ['topic', 'subject', 'explanation']) {
    if (typeof e[key] !== 'string' || !e[key].trim()) fail(id, `missing ${key}`);
  }
  if (channel === 'email') {
    if (typeof e.body !== 'string' || !e.body.trim()) fail(id, 'missing body');
    if (!e.sender?.name || !EMAIL_RE.test(e.sender?.email ?? '')) fail(id, 'sender needs a name and a valid address');
    if (e.reply_to !== undefined && !EMAIL_RE.test(e.reply_to)) fail(id, 'reply_to is not a valid address');
    if (e.messages !== undefined) fail(id, 'emails use body, not messages');
  } else {
    if (!Array.isArray(e.messages) || !e.messages.length || e.messages.some(m => typeof m !== 'string' || !m.trim())) {
      fail(id, 'SMS and WhatsApp items need a non-empty messages list');
    }
    if (e.body !== undefined || e.reply_to !== undefined) fail(id, 'SMS and WhatsApp items use messages, not body or reply_to');
    if (!e.sender?.name) fail(id, 'sender needs a name, sender ID or number');
    if (e.sender?.email !== undefined) fail(id, 'SMS and WhatsApp senders have no email address');
    if (e.sender?.number !== undefined && !PHONE_RE.test(e.sender.number)) fail(id, 'sender number is not a phone number');
    if (channel === 'whatsapp' && !e.sender?.number) fail(id, 'WhatsApp senders need a phone number');
    if ((e.messages ?? []).some(m => /javascript:|<script|<[a-z][^>]*>/i.test(m))) fail(id, 'messages must be plain text');
  }
  if (Number.isNaN(Date.parse(e.date ?? ''))) fail(id, 'date is not a valid ISO date');
  if (e.attachments !== undefined && !(Array.isArray(e.attachments) && e.attachments.every(a => typeof a === 'string'))) {
    fail(id, 'attachments must be a list of file names');
  }

  const subjectKey = `${e.subject}`.trim().toLowerCase();
  if (seenSubjects.has(subjectKey)) fail(id, `same subject as ${seenSubjects.get(subjectKey)}`);
  seenSubjects.set(subjectKey, id);

  // Teaching content: every answer must explain itself.
  const flags = Array.isArray(e.red_flags) ? e.red_flags : null;
  const trust = Array.isArray(e.trust_signals) ? e.trust_signals : null;
  if (!flags || !trust) fail(id, 'red_flags and trust_signals must both be lists');
  else if (e.is_phishing) {
    if (flags.length < 2) fail(id, 'phishing emails need at least 2 red flags');
    if (trust.length) fail(id, 'phishing emails should not list trust signals');
    if (flags.some(f => typeof f?.description !== 'string' || !f.description.trim())) fail(id, 'every red flag needs a description');
  } else {
    if (trust.length < 2) fail(id, 'legitimate emails need at least 2 trust signals');
    if (flags.length) fail(id, 'legitimate emails should not list red flags');
  }

  // Safety: bodies are sanitised at runtime, but keep the source clean too.
  const body = channel === 'email' ? e.body ?? '' : '';
  if (/<script|<iframe|<object|<embed|<form/i.test(body)) fail(id, 'body contains a disallowed tag');
  if (/\son[a-z]+\s*=/i.test(body)) fail(id, 'body contains an inline event handler');
  if (/javascript:/i.test(body)) fail(id, 'body contains a javascript: link');
  if (/<img[^>]+src=['"](?!data:image\/)/i.test(body)) fail(id, 'body loads a remote image');
}

// Each level needs enough emails for a full game, roughly half of them phishing.
for (const level of LEVELS) {
  const pool = emails.filter(e => e.level === level);
  const phish = pool.filter(e => e.is_phishing).length;
  if (pool.length < ROUNDS * 2) fail(level, `only ${pool.length} emails; at least ${ROUNDS * 2} are needed so games vary`);
  const share = pool.length ? phish / pool.length : 0;
  if (share < 0.4 || share > 0.6) fail(level, `${phish} of ${pool.length} are phishing; keep it between 40% and 60%`);
}

if (errors.length) {
  console.error(`emails.json has ${errors.length} problem(s):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
const counts = LEVELS.map(l => `${l} ${emails.filter(e => e.level === l).length}`).join(', ');
const byChannel = CHANNELS.map(c => `${c} ${emails.filter(e => (e.channel ?? 'email') === c).length}`).join(', ');
console.log(`emails.json OK: ${emails.length} messages (${counts}; ${byChannel})`);
