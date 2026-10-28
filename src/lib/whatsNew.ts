import { APP_VERSION } from '@/lib/report';

// Shown once to returning players after an update.
const SEEN_KEY = 'lurelens_seen_version';

/**
 * What to show this browser:
 * - 'none': new player, or already seen this version's note
 * - 'since:<version>': last saw that version's note; show every release since
 * - 'renamed': played back when the game was PhishGuard (before 2.0), so the
 *   note also explains the rename and everything 2.0 added
 */
export type WhatsNewKind = 'none' | 'renamed' | `since:${string}`;

export function whatsNewFor(hasHistory: boolean): WhatsNewKind {
  try {
    const seen = localStorage.getItem(SEEN_KEY);
    if (seen === APP_VERSION) return 'none';
    if (!hasHistory) {
      // New players start on this version: nothing to announce.
      localStorage.setItem(SEEN_KEY, APP_VERSION);
      return 'none';
    }
    if (seen === null) return 'renamed';
    return `since:${seen}`;
  } catch {
    return 'none';
  }
}

/** True when version a (e.g. "2.3") is newer than b (e.g. "2.2.0"), by major and minor. */
export function isNewer(a: string, b: string): boolean {
  const [am = 0, an = 0] = a.split('.').map(Number);
  const [bm = 0, bn = 0] = b.split('.').map(Number);
  return am > bm || (am === bm && an > bn);
}

export function markWhatsNewSeen() {
  try {
    localStorage.setItem(SEEN_KEY, APP_VERSION);
  } catch {
    // Storage blocked: the note may show again next visit.
  }
}
