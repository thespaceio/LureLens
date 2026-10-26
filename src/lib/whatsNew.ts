import { APP_VERSION } from '@/lib/report';

// Shown once to returning players after an update.
const SEEN_KEY = 'lurelens_seen_version';

/** True when this browser played an earlier version and hasn't seen this one's notes. */
export function shouldShowWhatsNew(hasHistory: boolean): boolean {
  try {
    const seen = localStorage.getItem(SEEN_KEY);
    if (seen === APP_VERSION) return false;
    if (!hasHistory) {
      // New players start on this version: nothing to announce.
      localStorage.setItem(SEEN_KEY, APP_VERSION);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function markWhatsNewSeen() {
  try {
    localStorage.setItem(SEEN_KEY, APP_VERSION);
  } catch {
    // Storage blocked: the note may show again next visit.
  }
}
