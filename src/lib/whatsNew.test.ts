import { describe, expect, it } from 'vitest';
import { isNewer } from '@/lib/whatsNew';

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
