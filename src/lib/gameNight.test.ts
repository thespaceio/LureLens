import { describe, expect, it } from 'vitest';
import { isGameNight, nextGameNight, nextGameNightLabel } from '@/lib/gameNight';

// 6 November 2026 is a Friday. WAT is UTC+1.
const at = (iso: string) => Date.parse(iso);

describe('isGameNight', () => {
  it('opens for the whole of Friday in West Africa Time', () => {
    expect(isGameNight(at('2026-11-05T22:59:00Z'))).toBe(false); // Thu 23:59 WAT
    expect(isGameNight(at('2026-11-05T23:00:00Z'))).toBe(true); // Fri 00:00 WAT
    expect(isGameNight(at('2026-11-06T17:00:00Z'))).toBe(true); // Fri 18:00 WAT, Game Night
    expect(isGameNight(at('2026-11-06T22:59:00Z'))).toBe(true); // Fri 23:59 WAT
    expect(isGameNight(at('2026-11-06T23:00:00Z'))).toBe(false); // Sat 00:00 WAT
  });

  it('works across the new year', () => {
    expect(isGameNight(at('2026-12-31T23:30:00Z'))).toBe(true); // Fri 1 Jan 2027, 00:30 WAT
  });

  it('is always open when Friday-only is switched off', () => {
    expect(isGameNight(at('2026-11-04T12:00:00Z'), false)).toBe(true);
  });
});

describe('nextGameNight', () => {
  it('finds the start of the coming Friday in WAT', () => {
    expect(nextGameNight(at('2026-11-04T12:00:00Z')).toISOString()).toBe('2026-11-05T23:00:00.000Z');
    expect(nextGameNight(at('2026-11-07T10:00:00Z')).toISOString()).toBe('2026-11-12T23:00:00.000Z');
  });

  it('names the date the way people read it', () => {
    expect(nextGameNightLabel(at('2026-11-04T12:00:00Z'))).toBe('Friday 6 November');
    expect(nextGameNightLabel(at('2026-11-07T10:00:00Z'))).toBe('Friday 13 November');
  });
});
