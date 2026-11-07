// Game Night: public rounds open on Fridays only, from midnight to midnight
// West Africa Time (WAT, UTC+1 all year, no daylight saving). That's when the
// Th3 SpaceIO community plays together, live at 6pm.
//
// Always open, every day: Classroom rounds (trainers and business training),
// certificate checks, the scoreboard, Progress, About and Privacy.
//
// To open public play every day again, set FRIDAY_ONLY to false.
export const FRIDAY_ONLY = true;

/** Where people find Game Night and the community. */
export const GAME_NIGHT_URL = 'https://th3spaceio.pages.dev/game-night';

const WAT_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const FRIDAY = 5;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** WAT wall-clock time: read the UTC fields of the returned date. */
function wat(now: number): Date {
  return new Date(now + WAT_OFFSET_MS);
}

/** True when public rounds are open: any time on a Friday, WAT (or always, if FRIDAY_ONLY is off). */
export function isGameNight(now: number = Date.now(), fridayOnly: boolean = FRIDAY_ONLY): boolean {
  if (!fridayOnly) return true;
  return wat(now).getUTCDay() === FRIDAY;
}

/** The moment the next Friday starts in WAT (as a real instant). Today counts if it is Friday. */
export function nextGameNight(now: number = Date.now()): Date {
  const w = wat(now);
  const daysUntil = (FRIDAY - w.getUTCDay() + 7) % 7;
  const startWat = Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()) + daysUntil * DAY_MS;
  return new Date(startWat - WAT_OFFSET_MS);
}

/** "Friday 13 November", the next Game Night's date as people read it in Nigeria. */
export function nextGameNightLabel(now: number = Date.now()): string {
  const d = wat(nextGameNight(now).getTime());
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
