import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_VERSION } from '@/lib/report';
import { isNewer, whatsNewFor } from '@/lib/whatsNew';

describe('isNewer', () => {
  it('compares releases by major and minor version', () => {
    expect(isNewer('2.3', '2.2.0')).toBe(true);
    expect(isNewer('2.2', '2.2.0')).toBe(false);
    expect(isNewer('2.1', '2.2.0')).toBe(false);
    expect(isNewer('2.10', '2.9.1')).toBe(true);
    expect(isNewer('3.0', '2.9.0')).toBe(true);
    expect(isNewer('2.1', '0')).toBe(true);
  });
});

describe('whatsNewFor', () => {
  const [major, minor] = APP_VERSION.split('.');
  beforeEach(() => {
    // Tests run without a browser, so give them a fresh in-memory storage.
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
      clear: () => data.clear(),
    });
  });

  it('says nothing to new players, and remembers the version', () => {
    expect(whatsNewFor(false)).toBe('none');
    expect(localStorage.getItem('lurelens_seen_version')).toBe(APP_VERSION);
  });

  it('explains the rename to players from before 2.0', () => {
    expect(whatsNewFor(true)).toBe('renamed');
  });

  it('lists releases since the last note a returning player saw', () => {
    localStorage.setItem('lurelens_seen_version', '2.1.0');
    expect(whatsNewFor(true)).toBe('since:2.1.0');
  });

  it('stays quiet after a patch release, instead of showing an empty note', () => {
    localStorage.setItem('lurelens_seen_version', `${major}.${minor}.0`);
    expect(whatsNewFor(true)).toBe('none');
    expect(localStorage.getItem('lurelens_seen_version')).toBe(APP_VERSION);
  });
});
