import { describe, expect, it } from 'vitest';
import { deviceSuits3D, shouldShow3D } from './scene3d';
import type { SceneEnv } from './scene3d';

const laptop: SceneEnv = {
  forced: false,
  pref: null,
  webgl: true,
  reducedMotion: false,
  saveData: false,
  cores: 8,
  memoryGb: 8,
  automated: false,
};

describe('shouldShow3D', () => {
  it('shows on a capable device', () => {
    expect(shouldShow3D(laptop)).toBe(true);
    expect(shouldShow3D({ ...laptop, cores: undefined, memoryGb: undefined })).toBe(true);
  });

  it('stays off where it could cost the player', () => {
    expect(shouldShow3D({ ...laptop, reducedMotion: true })).toBe(false);
    expect(shouldShow3D({ ...laptop, saveData: true })).toBe(false);
    expect(shouldShow3D({ ...laptop, cores: 2 })).toBe(false);
    expect(shouldShow3D({ ...laptop, memoryGb: 2 })).toBe(false);
    expect(shouldShow3D({ ...laptop, automated: true })).toBe(false);
  });

  it('never without WebGL, even when asked for', () => {
    expect(shouldShow3D({ ...laptop, webgl: false, pref: 'on', forced: true })).toBe(false);
  });

  it("follows the player's switch over the device check", () => {
    expect(shouldShow3D({ ...laptop, pref: 'off' })).toBe(false);
    expect(shouldShow3D({ ...laptop, cores: 2, saveData: true, pref: 'on' })).toBe(true);
  });

  it('?3d forces it on', () => {
    expect(shouldShow3D({ ...laptop, automated: true, pref: 'off', forced: true })).toBe(true);
  });

  it('deviceSuits3D ignores the switch', () => {
    expect(deviceSuits3D({ ...laptop, pref: 'off' })).toBe(true);
    expect(deviceSuits3D({ ...laptop, cores: 2, pref: 'on' })).toBe(false);
  });
});
