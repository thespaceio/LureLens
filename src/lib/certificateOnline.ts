// Which certificates this browser has registered online, and which games can back one.
import { ALL_EMAILS } from '@/lib/game';
import type { GameSession } from '@/types';

// Which certificates this browser has registered, and under what name.
const KEY = 'lurelens_cert_online_v1';

export function readRegistered(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

export function saveRegistered(reference: string, name: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readRegistered(), [reference]: name }));
  } catch {
    // Storage blocked: the certificate is still registered online.
  }
}

const knownIds = new Set(ALL_EMAILS.map(e => e.id));
/** A game from an older version (other messages, or no answer list) can't be checked by the server. */
export const checkable = (s: GameSession) => s.answers.length === 10 && s.answers.every(a => knownIds.has(a.id));

export function isRegistered(reference: string | null): boolean {
  return Boolean(reference && readRegistered()[reference] !== undefined);
}
