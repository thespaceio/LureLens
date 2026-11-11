// When the opening scene plays.
//
// It plays when LureLens is opened: once per browser tab, so moving around the
// app or refreshing doesn't replay it. It never holds up a link that came to do
// something specific (a class code, a certificate check, the big-screen board or
// the privacy notice), it stays off for people whose device asks for reduced
// motion, and it is skipped under browser automation (tests and crawlers).
// ?intro in the address forces it, and About has "Watch the intro".

const KEY = 'lurelens-intro-seen';

export interface IntroEnv {
  /** ?intro in the address. */
  forced: boolean;
  /** Opened from a class, certificate, live-board or privacy link. */
  deepLink: boolean;
  reducedMotion: boolean;
  /** navigator.webdriver: a test runner or crawler is driving the browser. */
  automated: boolean;
  /** Already played in this tab. */
  seen: boolean;
}

export function shouldPlayIntro(env: IntroEnv): boolean {
  if (env.forced) return true;
  return !env.deepLink && !env.reducedMotion && !env.automated && !env.seen;
}

/** Reads the browser's side of IntroEnv. */
export function introEnv(forced: boolean, deepLink: boolean): IntroEnv {
  let seen = false;
  try {
    seen = sessionStorage.getItem(KEY) === '1';
  } catch {
    // Storage blocked: play it.
  }
  return {
    forced,
    deepLink,
    reducedMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
    automated: typeof navigator !== 'undefined' && navigator.webdriver === true,
    seen,
  };
}

export function markIntroSeen() {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // Storage blocked: it may play again on refresh, which is harmless.
  }
}
