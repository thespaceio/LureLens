// Classroom mode without a server: a short code fixes the level and the random
// seed, so everyone who enters it gets the same messages in the same order.
// Players send their result line back to the facilitator, who pastes the
// lines in to see the class results.
import { ALL_EMAILS, buildRound } from '@/lib/game';
import type { Random } from '@/lib/game';
import { LEVEL_ORDER, channelOf } from '@/types';
import type { Email, GameSession, Level } from '@/types';

// Crockford base32: no I, L, O or U, so codes are easy to read out loud.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const VALUE_CHARS = 5;
const SEEDS_PER_LEVEL = Math.floor(32 ** VALUE_CHARS / LEVEL_ORDER.length);

/** FNV-1a, a small fast string hash. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Seeded random numbers (mulberry32), the same sequence on every device. */
export function seededRandom(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A fingerprint of a level's message bank. If the bank changes between
 * versions, old codes stop matching instead of quietly giving players a
 * different round from the facilitator.
 */
function bankFingerprint(level: Level, bank: Email[]): string {
  const items = bank
    .filter(e => e.level === level)
    .map(e => `${e.id}:${e.is_phishing ? 1 : 0}:${channelOf(e)}`)
    .sort();
  return `${level}|${items.join(',')}`;
}

function checkChar(level: Level, value: number, bank: Email[]): string {
  return ALPHABET[hash(`${bankFingerprint(level, bank)}#${value}`) % 32];
}

function encodeValue(value: number): string {
  let out = '';
  for (let i = 0; i < VALUE_CHARS; i++) {
    out = ALPHABET[value % 32] + out;
    value = Math.floor(value / 32);
  }
  return out;
}

/** "7K2QX9" → "7K2-QX9" */
export function formatCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

/** Upper-case, drop spaces and dashes, and read O as 0 and I or L as 1. */
export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/[^0-9A-Z]/g, '');
}

export function createClassCode(level: Level, rand: Random = Math.random, bank: Email[] = ALL_EMAILS): string {
  const seedIndex = Math.floor(rand() * SEEDS_PER_LEVEL);
  const value = seedIndex * LEVEL_ORDER.length + LEVEL_ORDER.indexOf(level);
  return encodeValue(value) + checkChar(level, value, bank);
}

export type DecodedClass =
  | { ok: true; code: string; level: Level; seed: number }
  | { ok: false; reason: 'format' | 'mismatch' };

export function decodeClassCode(input: string, bank: Email[] = ALL_EMAILS): DecodedClass {
  const code = normalizeCode(input);
  if (code.length !== VALUE_CHARS + 1 || [...code].some(c => !ALPHABET.includes(c))) return { ok: false, reason: 'format' };
  let value = 0;
  for (const c of code.slice(0, VALUE_CHARS)) value = value * 32 + ALPHABET.indexOf(c);
  const level = LEVEL_ORDER[value % LEVEL_ORDER.length];
  const seedIndex = Math.floor(value / LEVEL_ORDER.length);
  if (seedIndex >= SEEDS_PER_LEVEL || checkChar(level, value, bank) !== code[VALUE_CHARS]) return { ok: false, reason: 'mismatch' };
  return { ok: true, code, level, seed: hash(`seed#${value}`) };
}

/** The round for a class: identical on every device with the same version. */
export function classRound(decoded: Extract<DecodedClass, { ok: true }>): Email[] {
  return buildRound(decoded.level, [], [], seededRandom(decoded.seed));
}

/** Link that opens LureLens with the code filled in. */
export function inviteLink(code: string, base = `${location.origin}${location.pathname}`): string {
  return `${base}?class=${code}`;
}

// --- Results sent back to the facilitator ---------------------------------

const RIGHT = '✓';
const WRONG = '✗';

const cleanName = (name: string) => name.replace(/[·\n\r]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Player';

/** One line a player sends to the facilitator, e.g. over WhatsApp. */
export function resultLine(session: GameSession): string {
  const code = formatCode(session.classCode ?? '');
  const marks = session.answers.map(a => (a.correct ? RIGHT : WRONG)).join('');
  return `LureLens class ${code} · ${cleanName(session.name)} · ${session.score} pts · ${session.correct}/${session.total} · ${marks}`;
}

export interface ClassResult {
  name: string;
  score: number;
  correct: number;
  total: number;
  /** Right or wrong for each message, in round order. */
  marks: boolean[];
}

const LINE_RE = /LureLens class ([0-9A-Z]{3})-?([0-9A-Z]{3}) · (.+?) · (\d+) pts · (\d+)\/(\d+) · ([✓✗]+)/g;

/**
 * Read result lines pasted from a chat. Forwarded-message prefixes and other
 * text are ignored. A player who appears twice keeps their latest line.
 */
export function parseResults(text: string, code: string): { results: ClassResult[]; otherClass: number } {
  const byName = new Map<string, ClassResult>();
  let otherClass = 0;
  for (const m of text.matchAll(LINE_RE)) {
    if (`${m[1]}${m[2]}` !== code) {
      otherClass++;
      continue;
    }
    const name = cleanName(m[3]);
    const marks = [...m[7]].map(c => c === RIGHT);
    byName.set(name.toLowerCase(), { name, score: Number(m[4]), correct: Number(m[5]), total: Number(m[6]), marks });
  }
  const results = [...byName.values()].sort((a, b) => b.score - a.score || b.correct - a.correct);
  return { results, otherClass };
}

/** Share of players who got each message right, in round order. */
export function messageAccuracy(results: ClassResult[], count: number): { right: number; answered: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const answered = results.filter(r => r.marks.length > i);
    return { right: answered.filter(r => r.marks[i]).length, answered: answered.length };
  });
}
