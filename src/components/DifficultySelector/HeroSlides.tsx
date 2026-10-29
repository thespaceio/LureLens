import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { BadgeCheck, ChevronLeft, ChevronRight, Landmark, MessageCircle, Pause, Play, ShieldAlert, Timer, Users } from 'lucide-react';

// The rotating hooks at the top of the home screen. Every claim here is true
// of the game: keep it that way when editing.

interface Slide {
  tag: string;
  title: string;
  sub: string;
  visual: ReactNode;
}

const SECONDS = 6;

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`w-full max-w-sm rounded-2xl border border-border bg-card p-3 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] sm:p-4 ${className}`}>{children}</div>
  );
}

const TimerVisual = (
  <Card>
    <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
      <span>MESSAGE 3 / 10</span>
      <span className="flex items-center gap-1 text-primary">
        <Timer className="size-3.5" aria-hidden /> 0:18
      </span>
    </div>
    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background">
      <motion.div
        className="h-full rounded-full bg-primary"
        initial={{ width: '100%' }}
        animate={{ width: '35%' }}
        transition={{ duration: SECONDS, ease: 'linear' }}
      />
    </div>
    <div className="mt-4 flex gap-2">
      <span className="flex-1 rounded-lg bg-primary/15 py-2 text-center text-sm font-semibold text-primary">Legitimate</span>
      <span className="flex-1 rounded-lg bg-destructive/15 py-2 text-center text-sm font-semibold text-destructive">Phishing</span>
    </div>
  </Card>
);

const BankVisual = (
  <Card>
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-lavender/20 text-lavender">
        <Landmark className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold">Bank Alert</span>
          <span className="font-mono text-[11px] text-muted-foreground">now</span>
        </div>
        <p className="mt-1 text-muted-foreground">
          Your account has been restricted. Verify within 24 hours to avoid closure:{' '}
          <span className="break-all text-lavender underline">secure-bank-verify.com</span>
        </p>
      </div>
    </div>
  </Card>
);

const WhatsAppVisual = (
  <Card className="space-y-2">
    <div className="flex items-center gap-2 text-sm">
      <span className="grid size-8 place-items-center rounded-full bg-lavender text-xs font-bold text-primary-foreground">KA</span>
      <span className="font-semibold">Kemi</span>
      <MessageCircle className="ml-auto size-4 text-muted-foreground" aria-hidden />
    </div>
    <p className="w-fit max-w-[90%] rounded-2xl rounded-tl-md bg-background px-3 py-2 text-sm">Hi dear, please I need ₦50,000 urgently 🙏</p>
    <p className="w-fit max-w-[90%] rounded-2xl rounded-tl-md bg-background px-3 py-2 text-sm">I'll pay you back tonight. Don't call, I'm in a meeting.</p>
  </Card>
);

const CodeVisual = (
  <Card>
    <p className="text-sm text-muted-foreground">Your verification code is</p>
    <div className="mt-3 flex gap-1.5">
      {['4', '8', '1', '9', '0', '6'].map((d, i) => (
        <span key={i} className="grid h-11 flex-1 place-items-center rounded-lg bg-background font-mono text-xl font-bold">
          {d}
        </span>
      ))}
    </div>
    <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-destructive">
      <ShieldAlert className="size-4" aria-hidden /> Don't share this code with anyone.
    </p>
  </Card>
);

const ClassVisual = (
  <Card className="space-y-2">
    <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <Users className="size-3.5" aria-hidden /> CLASS 4K7-QD2
      </span>
      <span className="flex items-center gap-1.5 text-primary">
        <span className="size-2 rounded-full bg-primary" /> LIVE
      </span>
    </div>
    {[
      ['Tolu', '1,640'],
      ['Chinedu', '1,520'],
      ['Amaka', '1,390'],
    ].map(([name, score], i) => (
      <motion.div
        key={name}
        className="flex items-center justify-between rounded-lg bg-background px-3 py-2 text-sm"
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 + i * 0.35 }}
      >
        <span>
          <span className="mr-2 font-mono text-muted-foreground">{i + 1}</span>
          {name}
        </span>
        <span className="font-mono font-semibold">{score}</span>
      </motion.div>
    ))}
  </Card>
);

const CertificateVisual = (
  <Card className="text-center">
    <BadgeCheck className="mx-auto size-10 text-primary" aria-hidden />
    <p className="mt-2 font-display text-lg font-extrabold">Certificate of completion</p>
    <p className="text-sm text-muted-foreground">Beginner · Intermediate · Advanced</p>
    <p className="mt-3 font-mono text-xs text-lavender">Check it online: LL-7QX2-M4KD</p>
  </Card>
);

const SLIDES: Slide[] = [
  {
    tag: 'THE GAME',
    title: 'Can you spot the phish before the clock runs out?',
    sub: '110 emails, texts and WhatsApp messages. Some are scams, some are safe. Three levels, one clock.',
    visual: TimerVisual,
  },
  {
    tag: 'BANK ALERTS',
    title: 'That bank alert looks real. Is it?',
    sub: 'Fake alerts are built to make you panic and click. Learn the tells while the stakes are only points.',
    visual: BankVisual,
  },
  {
    tag: 'WHATSAPP',
    title: 'Your friend needs money urgently. Or do they?',
    sub: 'Hijacked accounts message everyone in the contact list. Would you notice before you send?',
    visual: WhatsAppVisual,
  },
  {
    tag: 'ONE-TIME CODES',
    title: 'Someone is asking for your 6-digit code. What do you do?',
    sub: 'The code on your phone unlocks your account. Practise saying no before it matters.',
    visual: CodeVisual,
  },
  {
    tag: 'CLASSROOM',
    title: 'Run a live class and watch the results roll in.',
    sub: 'Share one code, everyone plays the same messages, then walk through the tricky ones together.',
    visual: ClassVisual,
  },
  {
    tag: 'CERTIFICATE',
    title: 'Score 80% on every level and earn a certificate anyone can check.',
    sub: 'Add it to LinkedIn. Employers and trainers confirm it online from its reference.',
    visual: CertificateVisual,
  },
];

interface HeroSlidesProps {
  onPlay: () => void;
  onClassroom?: () => void;
}

/** Auto-advancing hooks with animated headlines. Pauses on hover, focus, a hidden tab, or the pause button. */
export function HeroSlides({ onPlay, onClassroom }: HeroSlidesProps) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  // Autoplay is off for people who ask for reduced motion; they can still browse.
  const [playing, setPlaying] = useState(!reduce);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(true);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const running = playing && !hovered && !focused && visible;
  const go = useCallback((i: number) => setIndex((i + SLIDES.length) % SLIDES.length), []);

  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => go(index + 1), SECONDS * 1000);
    return () => window.clearTimeout(t);
  }, [running, index, go]);

  useEffect(() => {
    const onVisibility = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Why play LureLens"
      className="relative overflow-hidden rounded-3xl border border-border bg-card/40 p-4 sm:p-8"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
      onKeyDown={e => {
        if (e.key === 'ArrowRight') go(index + 1);
        if (e.key === 'ArrowLeft') go(index - 1);
      }}
      onTouchStart={e => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchEnd={e => {
        const start = touch.current;
        touch.current = null;
        if (!start) return;
        const dx = e.changedTouches[0].clientX - start.x;
        const dy = e.changedTouches[0].clientY - start.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(index + (dx < 0 ? 1 : -1));
      }}
      data-testid="hero-slides"
    >
      <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 size-72 rounded-full bg-primary/[0.07] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 size-72 rounded-full bg-lavender/10 blur-3xl" />

      <h1 className="sr-only">LureLens, the phishing awareness game</h1>

      {/* Every slide sits in the same grid cell, so the box keeps the tallest slide's height and nothing below jumps. */}
      <div className="relative grid" aria-live={running ? 'off' : 'polite'}>
        {SLIDES.map((slide, i) => {
          const active = i === index;
          return (
            <div
              key={slide.tag}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${SLIDES.length}`}
              aria-hidden={!active}
              inert={!active}
              className={`col-start-1 row-start-1 grid items-center gap-5 md:grid-cols-[1.5fr_1fr] md:gap-10 ${active ? '' : 'invisible'}`}
            >
              <div className="space-y-3 sm:space-y-4">
                <motion.p
                  className="font-mono text-xs tracking-[0.16em] text-primary"
                  initial={false}
                  animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: reduce ? 0 : -8 }}
                  transition={{ duration: 0.35 }}
                >
                  {slide.tag}
                </motion.p>
                <p className="font-display text-[1.65rem] font-extrabold leading-[1.08] tracking-[-0.025em] text-foreground sm:text-[2.6rem] lg:text-[3.1rem]">
                  {slide.title.split(' ').map((word, w) => (
                    <motion.span
                      key={w}
                      className="inline-block whitespace-pre"
                      initial={false}
                      animate={
                        active
                          ? { opacity: 1, y: 0, filter: 'blur(0px)' }
                          : { opacity: 0, y: reduce ? 0 : 18, filter: reduce ? 'blur(0px)' : 'blur(6px)' }
                      }
                      transition={{ duration: reduce ? 0.2 : 0.45, delay: active && !reduce ? 0.08 + w * 0.045 : 0, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {word}
                      {w < slide.title.split(' ').length - 1 ? ' ' : ''}
                    </motion.span>
                  ))}
                </p>
                <motion.p
                  className="max-w-xl text-[0.95rem] text-muted-foreground sm:text-lg"
                  initial={false}
                  animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: reduce ? 0 : 10 }}
                  transition={{ duration: 0.4, delay: active && !reduce ? 0.35 : 0 }}
                >
                  {slide.sub}
                </motion.p>
              </div>
              <motion.div
                className="flex justify-center md:justify-end"
                initial={false}
                animate={active ? { opacity: 1, y: 0, rotate: 0, scale: 1 } : { opacity: 0, y: reduce ? 0 : 24, rotate: reduce ? 0 : 2, scale: reduce ? 1 : 0.96 }}
                transition={{ duration: 0.5, delay: active && !reduce ? 0.2 : 0, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Re-mount the visual on each visit so its own animation replays. */}
                {active ? <div key={index} className="flex w-full justify-center md:justify-end">{slide.visual}</div> : slide.visual}
              </motion.div>
            </div>
          );
        })}
      </div>

      <div className="relative mt-5 flex flex-wrap items-center justify-between gap-3 sm:mt-6 sm:gap-4">
        <div className="flex w-full gap-2 sm:w-auto">
          <button
            type="button"
            onClick={onPlay}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-5 sm:flex-none font-semibold text-primary-foreground hover:bg-primary/90"
            data-testid="hero-play"
          >
            <Play className="size-4" aria-hidden /> Play now
          </button>
          {onClassroom && (
            <button
              type="button"
              onClick={onClassroom}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-border px-5 font-semibold hover:border-lavender hover:text-lavender sm:flex-none"
            >
              <Users className="size-4" aria-hidden /> Run a class
            </button>
          )}
        </div>

        <div className="flex w-full items-center justify-between gap-1 sm:w-auto sm:justify-end">
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous slide"
            className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-background/60 hover:text-foreground"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="flex items-center" role="group" aria-label="Choose a slide">
            {SLIDES.map((slide, i) => (
              <button
                key={slide.tag}
                type="button"
                onClick={() => go(i)}
                aria-label={`Slide ${i + 1}: ${slide.tag.toLowerCase()}`}
                aria-current={i === index ? 'true' : undefined}
                className="grid h-11 w-7 place-items-center"
              >
                <span
                  className={`relative block h-1.5 overflow-hidden rounded-full transition-[width,background-color] duration-300 ${
                    i === index ? 'w-6 bg-primary/30' : 'w-1.5 bg-muted-foreground/50'
                  }`}
                >
                  {i === index && (
                    <span
                      key={`${index}-${running}`}
                      className="absolute inset-y-0 left-0 rounded-full bg-primary"
                      style={
                        running
                          ? { animation: `hero-progress ${SECONDS}s linear forwards` }
                          : { width: '100%' }
                      }
                    />
                  )}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next slide"
            className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-background/60 hover:text-foreground"
          >
            <ChevronRight className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setPlaying(p => !p)}
            aria-label={playing ? 'Pause the slides' : 'Play the slides'}
            className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-background/60 hover:text-foreground"
            data-testid="hero-pause"
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
        </div>
      </div>
    </section>
  );
}

export default HeroSlides;
