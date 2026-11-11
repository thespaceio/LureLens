// Cards and panels tilt in 3D towards the pointer, as if you were holding them.
//
// It applies to the same containers that glow on hover (bg-card with a border),
// plus anything marked data-tilt, and only the innermost one under the pointer.
// Big panels tilt less than small cards, so a long table barely moves. Mouse and
// trackpad only, never with reduced motion, and never inside data-no-tilt (the
// message you're judging during a round stays still). The CSS is in index.css.

const SELECTOR =
  ':is(div,section,li,article,aside,form,ol,ul).bg-card.border:not([role=dialog]):not([data-no-glow]), [data-tilt]';

export function installTilt(): () => void {
  if (typeof window === 'undefined' || typeof matchMedia !== 'function') return () => {};
  const canHover = matchMedia('(hover: hover) and (pointer: fine)');
  const still = matchMedia('(prefers-reduced-motion: reduce)');

  let current: HTMLElement | null = null;
  let frame = 0;
  let last: PointerEvent | null = null;
  const releasing = new Map<HTMLElement, number>();

  const release = (el: HTMLElement) => {
    el.style.setProperty('--tilt-x', '0deg');
    el.style.setProperty('--tilt-y', '0deg');
    window.clearTimeout(releasing.get(el));
    releasing.set(
      el,
      window.setTimeout(() => {
        el.classList.remove('tilt-3d');
        el.style.removeProperty('--tilt-x');
        el.style.removeProperty('--tilt-y');
        el.style.removeProperty('--glare-x');
        el.style.removeProperty('--glare-y');
        releasing.delete(el);
      }, 260),
    );
  };

  const update = () => {
    frame = 0;
    const e = last;
    if (!e) return;
    const target = e.target instanceof Element ? e.target : null;
    let el = target?.closest<HTMLElement>(SELECTOR) ?? null;
    if (el && (el.closest('[data-no-tilt]') || document.documentElement.hasAttribute('data-no-tilt'))) el = null;
    if (el !== current) {
      if (current) release(current);
      current = el;
    }
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) - 0.5;
    const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) - 0.5;
    // About 7 degrees for a small card, under 2 for a page-wide panel.
    const max = Math.min(7, 2000 / Math.max(r.width, r.height * 1.4));
    window.clearTimeout(releasing.get(el));
    releasing.delete(el);
    el.classList.add('tilt-3d');
    el.style.setProperty('--tilt-x', `${(-py * 2 * max).toFixed(2)}deg`);
    el.style.setProperty('--tilt-y', `${(px * 2 * max).toFixed(2)}deg`);
    el.style.setProperty('--glare-x', `${((px + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty('--glare-y', `${((py + 0.5) * 100).toFixed(1)}%`);
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch' || !canHover.matches || still.matches) return;
    last = e;
    if (!frame) frame = window.requestAnimationFrame(update);
  };
  const onLeave = () => {
    last = null;
    if (current) release(current);
    current = null;
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);
  window.addEventListener('blur', onLeave);
  return () => {
    window.removeEventListener('pointermove', onMove);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('blur', onLeave);
    if (frame) window.cancelAnimationFrame(frame);
    if (current) release(current);
  };
}
