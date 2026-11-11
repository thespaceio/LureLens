// Puts the three.js scene (Backdrop.tsx) behind the whole site, when this
// device should have it (the rules are in src/lib/scene3d.ts).
//
// The scene and three.js load as their own file a moment after the page, so the
// game never waits for them, and they are left out of the offline download. If
// that file can't load (offline before it was ever fetched) or WebGL fails, the
// site simply stays as it is. During a round the scene is frozen and dimmed so it
// never competes with the clock.
import { Component, Suspense, lazy, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { SceneMode } from './Backdrop';

const Backdrop = lazy(() => import('./Backdrop'));

class Quiet extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function Scene3DHost({
  enabled,
  mode,
  guard = true,
  onSlow,
}: {
  enabled: boolean;
  mode: SceneMode;
  guard?: boolean;
  onSlow: () => void;
}) {
  const [load, setLoad] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled || load) return;
    const t = window.setTimeout(() => setLoad(true), 250);
    return () => window.clearTimeout(t);
  }, [enabled, load]);

  const showing = enabled && load && ready && !failed;
  useEffect(() => {
    const html = document.documentElement;
    if (showing) html.setAttribute('data-scene', '');
    else html.removeAttribute('data-scene');
    return () => html.removeAttribute('data-scene');
  }, [showing]);

  if (!enabled || !load || failed) return null;
  return (
    <div
      aria-hidden="true"
      data-testid="scene-3d"
      className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-1000"
      style={{ opacity: ready ? (mode === 'quiz' ? 0.35 : 1) : 0 }}
    >
      <Quiet onError={() => setFailed(true)}>
        <Suspense fallback={null}>
          <Backdrop mode={mode} guard={guard} onReady={() => setReady(true)} onSlow={onSlow} />
        </Suspense>
      </Quiet>
      {/* Darker edges, so text near them stays easy to read. */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 90% 80% at 50% 42%, transparent 50%, rgba(10,5,24,0.7))' }} />
    </div>
  );
}
