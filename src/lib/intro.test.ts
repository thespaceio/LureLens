import { describe, expect, it } from 'vitest';
import { shouldPlayIntro } from './intro';
import type { IntroEnv } from './intro';

const fresh: IntroEnv = { forced: false, deepLink: false, reducedMotion: false, automated: false, seen: false };

describe('shouldPlayIntro', () => {
  it('plays when the game is opened', () => {
    expect(shouldPlayIntro(fresh)).toBe(true);
  });

  it('plays once per tab', () => {
    expect(shouldPlayIntro({ ...fresh, seen: true })).toBe(false);
  });

  it('never holds up a class, certificate, live-board or privacy link', () => {
    expect(shouldPlayIntro({ ...fresh, deepLink: true })).toBe(false);
  });

  it('stays off with reduced motion and under automation', () => {
    expect(shouldPlayIntro({ ...fresh, reducedMotion: true })).toBe(false);
    expect(shouldPlayIntro({ ...fresh, automated: true })).toBe(false);
  });

  it('?intro forces it', () => {
    expect(shouldPlayIntro({ forced: true, deepLink: true, reducedMotion: true, automated: true, seen: true })).toBe(true);
  });
});
