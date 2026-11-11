// Whether this device gets the 3D scene behind the site (three.js, in
// src/components/Scene3D). It is decoration, so it stays off wherever it could
// cost the player something: no WebGL, reduced motion, data saver, or a phone
// too modest to draw it smoothly (2 or fewer processor cores, or 2 GB or less of
// memory). The footer switch overrides the device check either way, and ?3d in
// the address forces it on (for testing).

const PREF_KEY = 'lurelens_3d';

export type ScenePref = 'on' | 'off' | null;

export interface SceneEnv {
  /** ?3d in the address. */
  forced: boolean;
  /** The player's own choice from the footer switch. */
  pref: ScenePref;
  webgl: boolean;
  reducedMotion: boolean;
  saveData: boolean;
  /** navigator.hardwareConcurrency, when the browser says. */
  cores?: number;
  /** navigator.deviceMemory in GB, when the browser says. */
  memoryGb?: number;
  /** navigator.webdriver: tests and crawlers. */
  automated: boolean;
}

export function shouldShow3D(env: SceneEnv): boolean {
  if (!env.webgl) return false;
  if (env.forced) return true;
  if (env.pref === 'off') return false;
  if (env.pref === 'on') return true;
  if (env.reducedMotion || env.saveData || env.automated) return false;
  if (env.cores !== undefined && env.cores <= 2) return false;
  if (env.memoryGb !== undefined && env.memoryGb <= 2) return false;
  return true;
}

/** Whether the device check alone would show it (to label the switch). */
export function deviceSuits3D(env: SceneEnv): boolean {
  return shouldShow3D({ ...env, forced: false, pref: null });
}

export function readScenePref(): ScenePref {
  try {
    const v = localStorage.getItem(PREF_KEY);
    return v === 'on' || v === 'off' ? v : null;
  } catch {
    return null;
  }
}

export function saveScenePref(pref: 'on' | 'off') {
  try {
    localStorage.setItem(PREF_KEY, pref);
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function sceneEnv(forced: boolean): SceneEnv {
  const nav = (typeof navigator !== 'undefined' ? navigator : {}) as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  return {
    forced,
    pref: readScenePref(),
    webgl: typeof document !== 'undefined' && hasWebGL(),
    reducedMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
    saveData: nav.connection?.saveData === true,
    cores: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : undefined,
    memoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : undefined,
    automated: nav.webdriver === true,
  };
}
