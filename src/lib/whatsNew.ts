import { APP_VERSION } from '@/lib/report';

// Shown once to returning players after an update.
const SEEN_KEY = 'lurelens_seen_version';

/**
 * What to show this browser:
 * - 'none': new player, or already seen this version's note
 * - 'update': saw the previous version's note; show what's new in this one
 * - 'since-2.0': last saw the 2.0 note, so also show what 2.1 added
 * - 'renamed': played back when the game was PhishGuard (before 2.0), so the
 *   note also explains the rename and everything 2.0 added
 */
export type WhatsNewKind = 'none' | 'update' | 'since-2.0' | 'renamed';

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
    return seen.startsWith('2.0') ? 'since-2.0' : 'update';
  } catch {
    return 'none';
  }
}

export function markWhatsNewSeen() {
  try {
    localStorage.setItem(SEEN_KEY, APP_VERSION);
  } catch {
    // Storage blocked: the note may show again next visit.
  }
}
