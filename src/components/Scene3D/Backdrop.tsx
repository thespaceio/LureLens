// The 3D scene behind LureLens, drawn with three.js (via React Three Fiber).
// Loaded on its own, after the page, and only on devices that suit it (see
// src/lib/scene3d.ts and Scene3DHost.tsx).
//
// - The LureLens mark in 3D: the two Ls extruded in lavender around a glowing
//   lime lens, turning gently and following the pointer.
// - Message cards (emails and chats) drifting up through the dark: mostly
//   lavender, some coral (the lures), a few lime.
// - A star field and a perspective grid floor that slowly travels.
// - The camera leans with the pointer and sinks as you scroll, so near things
//   move more than far ones.
// It stops drawing during a round (the host freezes it), and tells the host if
// the device can't keep up, so the host can switch it off.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const LAVENDER = '#B9A6FF';
const LIME = '#C6F432';
const CORAL = '#FF6B6B';
const NIGHT = '#100822';

export type SceneMode = 'home' | 'page' | 'quiz';

/** Pointer (-1 to 1) and scroll (in screen heights), shared by the scene. */
const input = { px: 0, py: 0, scroll: 0 };

function useWindowInput() {
  useEffect(() => {
    const move = (e: PointerEvent) => {
      input.px = (e.clientX / window.innerWidth) * 2 - 1;
      input.py = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    const scroll = () => {
      input.scroll = window.scrollY / Math.max(1, window.innerHeight);
    };
    scroll();
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('scroll', scroll, { passive: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('scroll', scroll);
    };
  }, []);
}

/** Frame-rate independent easing towards a target. */
const ease = (dt: number, speed = 3) => 1 - Math.exp(-speed * dt);

function Rig() {
  const look = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }, dt) => {
    const s = Math.min(input.scroll, 3);
    const k = ease(dt, 2.2);
    camera.position.x += (input.px * 0.7 - camera.position.x) * k;
    camera.position.y += (input.py * 0.45 - s * 0.9 - camera.position.y) * k;
    look.set(0, -s * 0.9, -4);
    camera.lookAt(look);
  });
  return null;
}

// ---- The LureLens mark -------------------------------------------------------

/** One L of the mark, as the outline of its 20-unit stroke in the 120 box. */
const L_OUTLINE: [number, number][] = [
  [12, 18],
  [32, 18],
  [32, 88],
  [66, 88],
  [66, 108],
  [12, 108],
];

function lShape(points: [number, number][]) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => {
    const X = (x - 60) / 30;
    const Y = -(y - 60) / 30;
    if (i === 0) shape.moveTo(X, Y);
    else shape.lineTo(X, Y);
  });
  shape.closePath();
  return shape;
}

function glowTexture(color: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, color);
  grad.addColorStop(0.35, `${color}66`);
  grad.addColorStop(1, `${color}00`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Logo3D({ mode }: { mode: SceneMode }) {
  const group = useRef<THREE.Group>(null);
  const lens = useRef<THREE.Mesh>(null);
  const viewport = useThree(s => s.viewport);
  const size = useThree(s => s.size);

  const { frame, ring, halo } = useMemo(() => {
    const depth = 0.42;
    const frame = new THREE.ExtrudeGeometry(
      [lShape(L_OUTLINE), lShape(L_OUTLINE.map(([x, y]) => [120 - x, 120 - y] as [number, number]))],
      { depth, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3, curveSegments: 4 },
    );
    frame.translate(0, 0, -depth / 2);
    return {
      frame,
      ring: new THREE.TorusGeometry(0.5, 0.135, 24, 72),
      halo: glowTexture(LIME),
    };
  }, []);
  useEffect(
    () => () => {
      frame.dispose();
      ring.dispose();
      halo.dispose();
    },
    [frame, ring, halo],
  );

  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const wide = size.width / size.height > 1.1;
    // Home: large, beside the headline (right on wide screens, above on phones).
    // Other pages: smaller and further back, in the top corner.
    // Home: beside the headline, peeking around its card; it scrolls away with
    // the headline. Other pages: small and far back in the top corner.
    const target =
      mode === 'home'
        ? wide
          ? [Math.min(viewport.width * 0.3, 4.4), 0.95, -2.2, 0.95]
          : [viewport.width * 0.26, 2.3, -5, 0.72]
        : wide
          ? [Math.min(viewport.width * 0.4, 6), 1.8, -6, 0.9]
          : [viewport.width * 0.3, 2.6, -7, 0.6];
    // Height of the screen, in scene units, at the logo's depth.
    const screenH = 2 * (9 - target[2]) * Math.tan((45 / 2) * (Math.PI / 180));
    const follow = mode === 'home' ? Math.min(input.scroll, 3) * (screenH - 0.9) : 0;
    const k = ease(dt, 2.5);
    g.position.x += (target[0] - g.position.x) * k;
    g.position.y += (target[1] + follow + Math.sin(t * 0.8) * 0.12 - g.position.y) * ease(dt, 6);
    g.position.z += (target[2] - g.position.z) * k;
    const sc = g.scale.x + (target[3] - g.scale.x) * k;
    g.scale.setScalar(sc);
    g.rotation.y += (Math.sin(t * 0.45) * 0.5 + input.px * 0.35 - g.rotation.y) * k;
    g.rotation.x += (Math.sin(t * 0.3) * 0.1 - input.py * 0.2 - g.rotation.x) * k;
    if (lens.current) lens.current.rotation.x = Math.sin(t * 1.1) * 0.35;
  });

  return (
    <group ref={group} position={[3, 0.7, -1.2]} scale={0.6}>
      <mesh geometry={frame}>
        <meshStandardMaterial color={LAVENDER} metalness={0.45} roughness={0.28} emissive="#2b1d5c" emissiveIntensity={0.6} />
      </mesh>
      <mesh ref={lens} geometry={ring}>
        <meshStandardMaterial color={LIME} emissive={LIME} emissiveIntensity={1.15} roughness={0.3} toneMapped={false} />
      </mesh>
      <sprite scale={[2.6, 2.6, 1]}>
        <spriteMaterial map={halo} transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <pointLight color={LIME} intensity={6} distance={6} decay={2} position={[0, 0, 0.8]} />
    </group>
  );
}

// ---- Drifting message cards ----------------------------------------------------

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function cardTexture(kind: 'mail' | 'chat') {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 176;
  const g = c.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.fillStyle = 'rgba(255,255,255,0.10)';
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 6;
  if (kind === 'mail') {
    roundRect(g, 8, 8, 240, 160, 20);
    g.fill();
    g.stroke();
    g.lineWidth = 5;
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.beginPath();
    g.moveTo(16, 18);
    g.lineTo(128, 96);
    g.lineTo(240, 18);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.fillRect(36, 120, 120, 10);
    g.fillRect(36, 140, 176, 10);
  } else {
    roundRect(g, 8, 8, 240, 128, 26);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(40, 134);
    g.lineTo(30, 168);
    g.lineTo(78, 134);
    g.fill();
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(34, 40, 150, 12);
    g.fillRect(34, 64, 188, 12);
    g.fillRect(34, 88, 110, 12);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

interface Drifter {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  vy: number;
  vr: [number, number, number];
  s: number;
}

/** A small seeded random, so the field is the same on every visit. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function Cards({ kind, count, seed }: { kind: 'mail' | 'chat'; count: number; seed: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const camera = useThree(s => s.camera);
  const viewport = useThree(s => s.viewport);
  const texture = useMemo(() => cardTexture(kind), [kind]);
  const geometry = useMemo(() => new THREE.PlaneGeometry(1.2, 0.825), []);
  useEffect(
    () => () => {
      texture.dispose();
      geometry.dispose();
    },
    [texture, geometry],
  );

  const drifters = useMemo<Drifter[]>(() => {
    const rand = seeded(seed);
    return Array.from({ length: count }, () => ({
      x: (rand() * 2 - 1) * 11,
      y: (rand() * 2 - 1) * 7,
      z: -2.5 - rand() * 14,
      rx: rand() * Math.PI,
      ry: rand() * Math.PI,
      rz: rand() * Math.PI,
      vy: 0.12 + rand() * 0.22,
      vr: [(rand() - 0.5) * 0.5, (rand() - 0.5) * 0.6, (rand() - 0.5) * 0.3],
      s: 0.6 + rand() * 0.7,
    }));
  }, [count, seed]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const rand = seeded(seed + 7);
    const colors = [new THREE.Color(LAVENDER), new THREE.Color(CORAL), new THREE.Color(LIME)];
    for (let i = 0; i < count; i++) {
      const r = rand();
      m.setColorAt(i, colors[r < 0.62 ? 0 : r < 0.86 ? 1 : 2]);
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [count, seed]);

  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    const step = Math.min(dt, 0.1);
    const span = Math.max(viewport.width * 0.85, 9);
    drifters.forEach((d, i) => {
      d.y += d.vy * step;
      d.rx += d.vr[0] * step;
      d.ry += d.vr[1] * step;
      d.rz += d.vr[2] * step;
      // Keep the field around the camera as it moves with scrolling.
      if (d.y > camera.position.y + 8) d.y -= 16;
      if (d.y < camera.position.y - 8) d.y += 16;
      dummy.position.set(Math.max(-span, Math.min(span, d.x)), d.y, d.z);
      dummy.rotation.set(d.rx, d.ry, d.rz);
      dummy.scale.setScalar(d.s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, count]} frustumCulled={false}>
      <meshBasicMaterial map={texture} transparent opacity={0.62} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}

// ---- Stars and the grid floor ----------------------------------------------------

function Stars({ count }: { count: number }) {
  const points = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const rand = seeded(42);
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rand() * 2 - 1) * 34;
      pos[i * 3 + 1] = (rand() * 2 - 1) * 22;
      pos[i * 3 + 2] = -12 - rand() * 26;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_, dt) => {
    if (points.current) points.current.rotation.z += dt * 0.006;
  });
  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial color={LAVENDER} size={0.07} sizeAttenuation transparent opacity={0.75} depthWrite={false} />
    </points>
  );
}

function Floor() {
  const grid = useRef<THREE.GridHelper>(null);
  const camera = useThree(s => s.camera);
  const helper = useMemo(() => {
    const g = new THREE.GridHelper(90, 90, LAVENDER, LAVENDER);
    const mat = g.material as THREE.LineBasicMaterial;
    mat.transparent = true;
    mat.opacity = 0.16;
    mat.depthWrite = false;
    return g;
  }, []);
  useEffect(
    () => () => {
      helper.geometry.dispose();
      (helper.material as THREE.Material).dispose();
    },
    [helper],
  );
  useFrame(({ clock }) => {
    const g = grid.current;
    if (!g) return;
    g.position.y = camera.position.y - 4.6;
    g.position.z = -8 + ((clock.elapsedTime * 0.5) % 1);
  });
  return <primitive ref={grid} object={helper} />;
}

// ---- Watching the frame rate -------------------------------------------------------

/** Calls onSlow if frames take longer than 50 ms on average for 3 seconds (after warming up). */
function PerfGuard({ onSlow }: { onSlow: () => void }) {
  const stats = useRef({ total: 0, frames: 0, elapsed: 0, warm: 0, done: false });
  useFrame((_, dt) => {
    const s = stats.current;
    if (s.done) return;
    if (s.warm < 2) {
      s.warm += dt;
      return;
    }
    s.total += dt;
    s.frames += 1;
    if (s.total >= 3) {
      if (s.total / s.frames > 0.05) {
        s.done = true;
        onSlow();
      }
      s.total = 0;
      s.frames = 0;
    }
  });
  return null;
}

// ---- The scene ---------------------------------------------------------------------

export default function Backdrop({
  mode,
  guard = true,
  onReady,
  onSlow,
}: {
  mode: SceneMode;
  /** Watch the frame rate (off only when testing with ?3d). */
  guard?: boolean;
  onReady: () => void;
  onSlow: () => void;
}) {
  useWindowInput();
  const phone = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 600;
  return (
    <Canvas
      className="!absolute inset-0"
      dpr={[1, phone ? 1.25 : 1.5]}
      gl={{ antialias: !phone, powerPreference: 'low-power', alpha: false }}
      camera={{ position: [0, 0, 9], fov: 45, near: 0.1, far: 80 }}
      frameloop={mode === 'quiz' ? 'never' : 'always'}
      onCreated={() => onReady()}
      fallback={null}
    >
      <color attach="background" args={[NIGHT]} />
      <fog attach="fog" args={[NIGHT, 9, 32]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 6]} intensity={1.3} />
      <directionalLight position={[-6, -2, 3]} intensity={0.5} color={LAVENDER} />
      <Rig />
      <Stars count={phone ? 420 : 900} />
      <Floor />
      <Cards kind="mail" count={phone ? 10 : 18} seed={11} />
      <Cards kind="chat" count={phone ? 8 : 14} seed={23} />
      <Logo3D mode={mode} />
      {guard && <PerfGuard onSlow={onSlow} />}
    </Canvas>
  );
}
