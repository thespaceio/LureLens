import { APP_VERSION } from '@/lib/report';

// Shown once to returning players after an update.
const SEEN_KEY = 'lurelens_seen_version';

/**
 * What to show this browser:
 * - 'none': new player, or already seen this version's note
 * - 'update': played 2.0 or later and saw its note; show what's new since
 * - 'renamed': played back when the game was PhishGuard (before 2.0), so the
 *   note also explains the rename and everything 2.0 added
 */
export type WhatsNewKind = 'none' | 'update' | 'renamed';

export function whatsNewFor(hasHistory: boolean): WhatsNewKind {
  try {
    const seen = localStorage.getItem(SEEN_KEY);
    if (seen === APP_VERSION) return 'none';
    if (!hasHistory) {
      // New players start on this version: nothing to announce.
      localStorage.setItem(SEEN_KEY, APP_VERSION);
      return 'none';
    }
    return seen === null ? 'renamed' : 'update';
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
