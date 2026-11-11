// The opening scene, played when LureLens is opened (rules in src/lib/intro.ts).
//
// A fake "urgent" bank message drops in, the lens sweeps across it and catches
// its three red flags, it is stamped LURE SPOTTED and breaks apart, the lens
// flies to the centre and becomes the logo's lens while the two Ls draw in, the
// name and line appear, and the scene opens outward from the lens onto the home
// screen. About six seconds. Any key, a tap or "Skip intro" ends it at once.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { animate, motion, useMotionTemplate, useMotionValue } from 'framer-motion';
import { ChevronsRight, Flag as FlagIcon } from 'lucide-react';
import { S_PATH } from '@/components/Logo/Logo';

const LAVENDER = '#B9A6FF';
const LIME = '#C6F432';
const CORAL = '#FF6B6B';
const NIGHT = '#0F0822';

/**
 * Seconds from the start at which each phase begins:
 * 0 incoming, 1 message drops in, 2 lens sweeps, 3 stamp, 4 logo,
 * 5 name, 6 line, 7 opens onto the home screen.
 */
const AT = [0, 0.5, 1.2, 2.75, 3.35, 3.75, 4.25, 5.35];
const OUT = 7;
const OUT_SECONDS = 0.8;
const SWEEP_SECONDS = 1.45;
/** When, into the sweep, the lens reaches each red flag. */
const FLAG_AT = [0.3, 0.75, 1.2];
const LENS = 76;

const FRAGMENTS = [
  { text: 'Your BVN has been suspended', x: '5%', y: '9%' },
  { text: 'Claim your ₦50,000 grant today', x: '57%', y: '6%' },
  { text: 'Share the OTP to confirm', x: '74%', y: '24%' },
  { text: 'Final notice: act within 24 hours', x: '3%', y: '33%' },
  { text: 'Your parcel is held: pay ₦1,500', x: '66%', y: '64%' },
  { text: "Hi, it's me. This is my new number", x: '4%', y: '78%' },
  { text: 'Congratulations! You have been selected', x: '42%', y: '90%' },
];

const TAGLINE = 'See the lure before it hooks you.';

type Point = { x: number; y: number };

export default function Intro({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState(0);
  const [points, setPoints] = useState<Point[] | null>(null);
  const [centre, setCentre] = useState<Point>({ x: 180, y: 170 });
  const stageRef = useRef<HTMLDivElement>(null);
  const flagRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const skipRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef(onDone);
  useLayoutEffect(() => {
    doneRef.current = onDone;
  });

  // The scene opens outward from the centre, where the lens lands.
  const iris = useMotionValue(-4);
  const mask = useMotionTemplate`radial-gradient(circle at 50% 50%, transparent ${iris}vmax, #000 calc(${iris}vmax + 3vmax))`;

  const skip = useCallback(() => setPhase(OUT), []);

  useEffect(() => {
    const timers = AT.slice(1).map((s, i) => window.setTimeout(() => setPhase(p => Math.max(p, i + 1)), s * 1000));
    return () => timers.forEach(t => window.clearTimeout(t));
  }, []);

  useEffect(() => {
    skipRef.current?.focus({ preventScroll: true });
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (['Tab', 'Shift', 'Alt', 'Control', 'Meta'].includes(e.key)) return;
      e.preventDefault();
      setPhase(OUT);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      html.style.overflow = before;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // Where the red flags sit, so the lens stops on each one at any screen size.
  useLayoutEffect(() => {
    if (phase !== 2 || points) return;
    const stage = stageRef.current;
    if (!stage) return;
    const box = stage.getBoundingClientRect();
    const scale = box.width / stage.offsetWidth || 1;
    const found = flagRefs.current.map(el => {
      const r = el?.getBoundingClientRect();
      return r ? { x: (r.left + r.width / 2 - box.left) / scale, y: (r.top + r.height / 2 - box.top) / scale } : { x: 0, y: 0 };
    });
    setPoints(found);
    setCentre({ x: stage.offsetWidth / 2, y: stage.offsetHeight / 2 });
  }, [phase, points]);

  useEffect(() => {
    if (phase !== OUT) return;
    const controls = animate(iris, 150, { duration: OUT_SECONDS, ease: [0.7, 0, 0.3, 1] });
    const t = window.setTimeout(() => doneRef.current(), OUT_SECONDS * 1000 + 40);
    return () => {
      controls.stop();
      window.clearTimeout(t);
    };
  }, [phase, iris]);

  const sweeping = phase >= 2 && phase < 4 && points;
  const landed = phase >= 4;

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="LureLens intro"
      data-testid="intro"
      className="fixed inset-0 z-[100] cursor-pointer select-none overflow-hidden"
      style={{ background: NIGHT, WebkitMaskImage: mask, maskImage: mask }}
      onPointerDown={skip}
    >
      <p className="sr-only">LureLens, the phishing awareness game. {TAGLINE}</p>

      {/* Backdrop: a slow lavender glow, a faint grid, and scam lines drifting past. */}
      <div aria-hidden="true">
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: landed ? 1 : 0.65 }}
          transition={{ duration: 1.2 }}
          style={{ background: `radial-gradient(ellipse 60% 50% at 50% 50%, rgba(185,166,255,${landed ? 0.2 : 0.12}), transparent 70%)` }}
        />
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.12 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 5.5, ease: 'easeOut' }}
          style={{
            backgroundImage: `linear-gradient(rgba(185,166,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(185,166,255,0.07) 1px, transparent 1px)`,
            backgroundSize: '44px 44px',
            WebkitMaskImage: 'radial-gradient(ellipse 55% 55% at 50% 50%, #000 20%, transparent 75%)',
            maskImage: 'radial-gradient(ellipse 55% 55% at 50% 50%, #000 20%, transparent 75%)',
          }}
        />
        {FRAGMENTS.map((f, i) => (
          <motion.p
            key={f.text}
            className="absolute whitespace-nowrap font-mono text-[11px] sm:text-xs"
            style={{ left: f.x, top: f.y, color: LAVENDER }}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: landed ? 0 : 0.22, y: -14 }}
            transition={{ opacity: { duration: landed ? 0.5 : 1.4, delay: landed ? 0 : 0.2 + i * 0.12 }, y: { duration: 6, ease: 'linear' } }}
          >
            {f.text}
          </motion.p>
        ))}
      </div>

      <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
        <div
          ref={stageRef}
          className="relative h-[340px] w-[min(360px,88vw)] [@media(max-height:560px)]:scale-[0.8] [@media(max-height:440px)]:scale-[0.62] [@media(min-width:1024px)_and_(min-height:700px)]:scale-[1.25]"
        >
          {/* "Incoming message" */}
          <motion.p
            className="absolute inset-x-0 -top-9 flex items-center justify-center gap-2 font-mono text-[11px] tracking-[0.22em]"
            style={{ color: LAVENDER }}
            initial={{ opacity: 0, y: 6 }}
            animate={landed ? { opacity: 0, y: -8 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: landed ? 0 : 0.12 }}
          >
            <span className="size-2 animate-pulse rounded-full" style={{ background: LIME, boxShadow: `0 0 12px ${LIME}` }} />
            INCOMING MESSAGE
          </motion.p>

          {/* The lure: message, red flags and stamp. It breaks apart when the logo arrives. */}
          <motion.div
            className="absolute inset-0"
            animate={landed ? { opacity: 0, scale: 0.84, filter: 'blur(10px)', y: 12 } : { opacity: 1, scale: 1, filter: 'blur(0px)', y: 0 }}
            transition={{ duration: 0.45, ease: [0.4, 0, 1, 1] }}
          >
            <motion.div
              className="absolute inset-x-0 top-2"
              initial={{ opacity: 0, y: -46, rotate: -3, scale: 0.94 }}
              animate={
                phase >= 3
                  ? { opacity: 1, y: 0, rotate: 0, scale: 1, x: [0, -9, 8, -6, 5, -2, 0] }
                  : phase >= 1
                    ? { opacity: 1, y: 0, rotate: 0, scale: 1, x: 0 }
                    : { opacity: 0, y: -46, rotate: -3, scale: 0.94 }
              }
              transition={phase >= 3 ? { x: { duration: 0.42 } } : { type: 'spring', stiffness: 260, damping: 18 }}
            >
              <div
                className="rounded-2xl border p-4 text-left"
                style={{
                  background: 'rgba(27,16,53,0.94)',
                  borderColor: phase >= 3 ? 'rgba(255,107,107,0.55)' : 'rgba(185,166,255,0.22)',
                  boxShadow: phase >= 3 ? `0 0 0 1px rgba(255,107,107,0.2), 0 24px 70px -24px rgba(255,107,107,0.45)` : '0 30px 80px -30px rgba(0,0,0,0.85)',
                  transition: 'border-color 0.3s, box-shadow 0.3s',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-full font-display text-sm font-extrabold" style={{ background: 'rgba(185,166,255,0.18)', color: LAVENDER }}>
                    YB
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">YourBank Alerts</p>
                    <p className="font-mono text-[11px] text-white/55">
                      <Flag on={phase >= 2} delay={FLAG_AT[0]} base="rgba(255,255,255,0.55)" spanRef={el => (flagRefs.current[0] = el)}>
                        alerts@yourbank-verify.xyz
                      </Flag>
                    </p>
                  </div>
                  <span className="ml-auto self-start font-mono text-[10px] text-white/40">now</span>
                </div>
                <p className="mt-3 text-[15px] leading-snug text-white/90">
                  <span className="font-bold">URGENT:</span> Your account will be{' '}
                  <Flag on={phase >= 2} delay={FLAG_AT[1]} base="rgba(255,255,255,0.9)" spanRef={el => (flagRefs.current[1] = el)}>
                    <span className="font-bold">BLOCKED in 24 hours</span>
                  </Flag>
                  . Verify your BVN now to keep it open.
                </p>
                <p className="mt-2.5 font-mono text-[13px]" style={{ color: LAVENDER }}>
                  <Flag on={phase >= 2} delay={FLAG_AT[2]} base={LAVENDER} spanRef={el => (flagRefs.current[2] = el)}>
                    <span className="underline underline-offset-2">bit.ly/bvn-verify-now</span>
                  </Flag>
                </p>
              </div>
            </motion.div>

            {/* What the lens caught */}
            <div className="absolute inset-x-0 top-[242px] flex flex-wrap justify-center gap-2">
              {['Look-alike sender', 'Pressure', 'Hidden link'].map((label, i) => (
                <motion.span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px]"
                  style={{ borderColor: 'rgba(255,107,107,0.55)', color: CORAL, background: 'rgba(255,107,107,0.1)' }}
                  initial={{ opacity: 0, scale: 0.6, y: 8 }}
                  animate={phase >= 2 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.6, y: 8 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 20, delay: phase >= 2 ? FLAG_AT[i] + 0.12 : 0 }}
                >
                  <FlagIcon className="size-3" />
                  {label}
                </motion.span>
              ))}
            </div>

            {/* LURE SPOTTED */}
            <div className="absolute inset-x-0 top-[78px] flex justify-center">
              <motion.div
                className="rounded-md border-[3px] px-4 py-1.5 font-display text-2xl font-extrabold tracking-[0.04em] sm:text-[1.7rem]"
                style={{ borderColor: CORAL, color: CORAL, background: 'rgba(15,8,34,0.82)', boxShadow: `0 0 28px rgba(255,107,107,0.45), inset 0 0 14px rgba(255,107,107,0.2)` }}
                initial={{ opacity: 0, scale: 2.6, rotate: -16 }}
                animate={phase >= 3 ? { opacity: 1, scale: 1, rotate: -8 } : { opacity: 0, scale: 2.6, rotate: -16 }}
                transition={{ type: 'spring', stiffness: 520, damping: 22, mass: 0.8 }}
              >
                LURE SPOTTED
              </motion.div>
            </div>
          </motion.div>

          {/* The lens: sweeps the message, then flies to the centre and becomes the logo's lens. */}
          <motion.div
            className="pointer-events-none absolute left-0 top-0 rounded-full"
            style={{
              width: LENS,
              height: LENS,
              marginLeft: -LENS / 2,
              marginTop: -LENS / 2,
              border: `7px solid ${LIME}`,
              background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.22), rgba(198,244,50,0.06) 55%, transparent 70%)',
              boxShadow: `0 0 26px rgba(198,244,50,0.55), inset 0 0 18px rgba(198,244,50,0.25)`,
            }}
            initial={{ opacity: 0, x: -120, y: 120, scale: 0.8 }}
            animate={
              landed
                ? { x: centre.x, y: centre.y, scale: 0.42, opacity: [1, 1, 0] }
                : sweeping
                  ? {
                      opacity: [0, 1, 1, 1, 1, 1, 1],
                      scale: [0.8, 1, 1.08, 1, 1.08, 1, 1.08],
                      x: [-120, points[0].x, points[0].x, points[1].x, points[1].x, points[2].x, points[2].x],
                      y: [120, points[0].y, points[0].y, points[1].y, points[1].y, points[2].y, points[2].y],
                    }
                  : { opacity: 0, x: -120, y: 120, scale: 0.8 }
            }
            transition={
              landed
                ? { duration: 0.5, ease: [0.5, 0, 0.2, 1], opacity: { duration: 0.75, times: [0, 0.7, 1] } }
                : { duration: SWEEP_SECONDS, ease: 'easeInOut', times: [0, 0.2, 0.3, 0.5, 0.6, 0.8, 1] }
            }
          />

          {/* The logo */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <motion.div
              className="absolute size-40 rounded-full"
              style={{ border: `2px solid ${LIME}`, left: '50%', top: '50%', marginLeft: -80, marginTop: -80 }}
              initial={{ opacity: 0, scale: 0.2 }}
              animate={landed ? { opacity: [0, 0.8, 0], scale: [0.2, 1.6, 2.6] } : { opacity: 0, scale: 0.2 }}
              transition={{ duration: 0.9, delay: 0.42, ease: 'easeOut' }}
            />
            <LogoDraw on={landed} />
          </div>

          {/* Name, line and sign-off */}
          <div className="absolute -inset-x-5 top-[calc(50%+78px)] text-center">
            <p className="font-display text-5xl font-extrabold leading-none tracking-[-0.03em] text-white sm:text-6xl">
              {'lurelens'.split('').map((ch, i) => (
                <motion.span
                  key={i}
                  className="inline-block"
                  initial={{ opacity: 0, y: 26, filter: 'blur(6px)' }}
                  animate={phase >= 5 ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 26, filter: 'blur(6px)' }}
                  transition={{ duration: 0.45, delay: phase >= 5 ? i * 0.045 : 0, ease: [0.22, 1, 0.36, 1] }}
                >
                  {ch}
                </motion.span>
              ))}
            </p>
            <p className="mt-3 text-base text-white/80 sm:text-lg">
              {TAGLINE.split(' ').map((word, i) => (
                <motion.span
                  key={i}
                  className="inline-block"
                  initial={{ opacity: 0, y: 10 }}
                  animate={phase >= 6 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                  transition={{ duration: 0.35, delay: phase >= 6 ? i * 0.08 : 0 }}
                >
                  {word === 'lure' ? <span style={{ color: LIME }}>{word}</span> : word}
                  {i < TAGLINE.split(' ').length - 1 ? ' ' : ''}
                </motion.span>
              ))}
            </p>
            <motion.p
              className="mt-4 font-mono text-[10px] tracking-[0.22em] sm:text-[11px]"
              style={{ color: LAVENDER }}
              initial={{ opacity: 0 }}
              animate={{ opacity: phase >= 6 ? 0.75 : 0 }}
              transition={{ duration: 0.5, delay: phase >= 6 ? 0.6 : 0 }}
            >
              TH3 SPACEIO · LEARN. BUILD. SECURE.
            </motion.p>
          </div>
        </div>
      </div>

      {/* How far along it is */}
      <motion.div
        aria-hidden="true"
        className="absolute bottom-0 left-0 h-[3px]"
        style={{ background: LIME, boxShadow: `0 0 10px ${LIME}` }}
        initial={{ width: '0%' }}
        animate={{ width: '100%' }}
        transition={{ duration: phase >= OUT ? 0.2 : AT[OUT], ease: 'linear' }}
      />

      {phase < OUT && (
        <button
          ref={skipRef}
          type="button"
          data-testid="intro-skip"
          onClick={skip}
          className="absolute bottom-5 right-4 inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:right-6"
          style={{ borderColor: 'rgba(185,166,255,0.35)', background: 'rgba(255,255,255,0.04)', outlineColor: LIME }}
        >
          Skip intro
          <ChevronsRight className="size-4" aria-hidden="true" />
        </button>
      )}
    </motion.div>
  );
}

/** A piece of the message the lens marks as a red flag. */
function Flag({
  on,
  delay,
  base,
  spanRef,
  children,
}: {
  on: boolean;
  delay: number;
  /** The text's own colour before it is flagged. */
  base: string;
  spanRef: (el: HTMLSpanElement | null) => void;
  children: ReactNode;
}) {
  return (
    <span ref={spanRef} className="relative inline-block">
      <motion.span
        className="absolute -inset-x-1 -inset-y-0.5 origin-left rounded"
        style={{ background: 'rgba(255,107,107,0.2)', boxShadow: `inset 0 -2px 0 ${CORAL}` }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: on ? 1 : 0 }}
        transition={{ duration: 0.28, delay: on ? delay : 0, ease: 'easeOut' }}
      />
      <motion.span
        className="relative"
        initial={{ color: base }}
        animate={{ color: on ? CORAL : base }}
        transition={{ duration: 0.2, delay: on ? delay : 0 }}
      >
        {children}
      </motion.span>
    </span>
  );
}

/** The LureLens mark, its two Ls drawing in around the lens. */
function LogoDraw({ on }: { on: boolean }) {
  const draw = (delay: number) => ({
    initial: { pathLength: 0, opacity: 0 },
    animate: on ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 },
    transition: { pathLength: { duration: 0.55, delay, ease: [0.65, 0, 0.35, 1] as const }, opacity: { duration: 0.05, delay } },
  });
  return (
    <svg viewBox="0 0 120 120" width={136} height={136} className="relative block overflow-visible">
      <defs>
        <mask id="intro-s" maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
          <rect width="120" height="120" fill="#fff" />
          <path d={S_PATH} fill="#000" />
          <path d={S_PATH} fill="#000" transform="rotate(180 60 60)" />
        </mask>
        <filter id="intro-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g mask="url(#intro-s)" filter="url(#intro-glow)">
        <motion.path d="M22 18 L22 98 L66 98" fill="none" stroke={LAVENDER} strokeWidth={20} strokeLinejoin="miter" {...draw(0.3)} />
        <motion.path d="M98 102 L98 22 L54 22" fill="none" stroke={LAVENDER} strokeWidth={20} strokeLinejoin="miter" {...draw(0.4)} />
      </g>
      <motion.circle
        cx="60"
        cy="60"
        r="15"
        fill="none"
        stroke={LIME}
        strokeWidth={8}
        initial={{ opacity: 0 }}
        animate={{ opacity: on ? 1 : 0 }}
        transition={{ duration: 0.2, delay: on ? 0.4 : 0 }}
        style={{ filter: `drop-shadow(0 0 6px ${LIME})` }}
      />
    </svg>
  );
}
