import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Play, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { categoryCounts, channelCounts, emailsFor } from '@/lib/game';
import { bestScore } from '@/lib/stats';
import { CATEGORIES, CHANNELS, LEVELS, LEVEL_ORDER, PLAYER } from '@/types';
import type { CategoryId, Channel, GameSession, Level } from '@/types';

interface DifficultySelectorProps {
  playerName: string;
  sessions: GameSession[];
  initialLevel?: Level;
  onNameChange: (name: string) => void;
  onStart: (level: Level, categories: CategoryId[], channels: Channel[]) => void;
}

const LEVEL_ACCENT: Record<Level, string> = {
  beginner: 'text-primary border-primary',
  intermediate: 'text-lavender border-lavender',
  advanced: 'text-muted-foreground border-muted-foreground',
};

export function DifficultySelector({ playerName, sessions, initialLevel, onNameChange, onStart }: DifficultySelectorProps) {
  const [level, setLevel] = useState<Level>(initialLevel ?? 'beginner');
  const [categories, setCategories] = useState<CategoryId[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [nameError, setNameError] = useState(false);

  const counts = useMemo(() => categoryCounts(level), [level]);
  const chCounts = useMemo(() => channelCounts(level), [level]);
  const available = useMemo(() => emailsFor(level, categories, channels).length, [level, categories, channels]);
  const rounds = Math.min(LEVELS[level].rounds, available);

  const selectLevel = (l: Level) => {
    setLevel(l);
    // Drop categories that don't exist at the new level.
    const c = categoryCounts(l);
    setCategories(prev => prev.filter(id => (c[id] ?? 0) > 0));
  };

  const toggleCategory = (id: CategoryId) =>
    setCategories(prev => (prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]));

  const toggleChannel = (id: Channel) =>
    setChannels(prev => (prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]));

  const start = () => {
    if (!playerName.trim()) {
      setNameError(true);
      document.getElementById('player-name')?.focus();
      return;
    }
    onStart(level, categories, channels);
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <motion.section initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <p className="font-mono text-xs tracking-[0.16em] text-primary">SPACEIO // CYBERSECURITY</p>
        <h1 className="max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
          Can you spot the phish before the clock runs out?
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
          You're <strong className="text-foreground">{PLAYER.name}</strong>, an analyst at {PLAYER.company} (
          <span className="font-mono text-sm">{PLAYER.domain}</span>). Emails, texts and WhatsApp messages land on your phone and in your inbox one at a time. Decide
          which are <span className="rounded bg-primary/15 px-1.5 font-semibold text-primary">legitimate</span> and which
          are <span className="rounded bg-destructive/15 px-1.5 font-semibold text-destructive">phishing</span>. Faster
          correct answers score more.
        </p>
      </motion.section>

      <div className="max-w-sm space-y-2">
        <label htmlFor="player-name" className="text-sm text-muted-foreground">
          Your name for the scoreboard
        </label>
        <Input
          id="player-name"
          value={playerName}
          maxLength={24}
          placeholder="e.g. Faith"
          aria-invalid={nameError}
          className={`h-11 bg-card ${nameError ? 'border-destructive' : ''}`}
          onChange={e => {
            onNameChange(e.target.value);
            if (e.target.value.trim()) setNameError(false);
          }}
          onKeyDown={e => e.key === 'Enter' && start()}
        />
        {nameError && <p className="text-sm text-destructive">Enter a name to start.</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-3" role="radiogroup" aria-label="Difficulty">
        {LEVEL_ORDER.map((id, i) => {
          const cfg = LEVELS[id];
          const selected = level === id;
          const best = playerName.trim() ? bestScore(sessions, playerName, id) : 0;
          return (
            <motion.button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              data-level={id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => selectLevel(id)}
              className={`flex flex-col gap-3 rounded-xl border bg-card p-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
                selected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.1em] ${LEVEL_ACCENT[id]}`}>
                  {cfg.label}
                </span>
                {selected ? (
                  <span className="grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-4" />
                  </span>
                ) : (
                  <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                    <Timer className="size-3.5" /> {cfg.seconds}s
                  </span>
                )}
              </div>
              <h3 className="text-lg font-semibold">{cfg.tagline}</h3>
              <p className="text-sm text-muted-foreground">{cfg.description}</p>
              <ul className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                <li className="rounded-md bg-background/60 px-2 py-1">{cfg.seconds}s per message</li>
                <li className="rounded-md bg-background/60 px-2 py-1">×{cfg.multiplier} points</li>
                <li className="rounded-md bg-background/60 px-2 py-1">
                  Your best: <strong className="text-foreground">{best ? best.toLocaleString() : '–'}</strong>
                </li>
              </ul>
            </motion.button>
          );
        })}
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Practise a channel or topic (optional, not ranked)</h2>
          <span className="font-mono text-xs text-muted-foreground">
            {available} message{available === 1 ? '' : 's'} available
          </span>
        </div>
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Channels">
          <button
            type="button"
            aria-pressed={channels.length === 0}
            onClick={() => setChannels([])}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              channels.length === 0 ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/50'
            }`}
          >
            All channels
          </button>
          {(Object.keys(CHANNELS) as Channel[]).map(id => {
            const on = channels.includes(id);
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                disabled={chCounts[id] === 0}
                onClick={() => toggleChannel(id)}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                  on ? 'border-lavender bg-lavender text-primary-foreground' : 'border-border hover:border-lavender/60'
                }`}
              >
                {CHANNELS[id].label} <span className="opacity-60">({chCounts[id]})</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Topics">
          <button
            type="button"
            aria-pressed={categories.length === 0}
            onClick={() => setCategories([])}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              categories.length === 0 ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/50'
            }`}
          >
            All topics
          </button>
          {(Object.keys(CATEGORIES) as CategoryId[]).map(id => {
            const count = counts[id] ?? 0;
            const on = categories.includes(id);
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                disabled={count === 0}
                title={CATEGORIES[id].description}
                onClick={() => toggleCategory(id)}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                  on ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/50'
                }`}
              >
                {CATEGORIES[id].label} <span className="opacity-60">({count})</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex flex-col items-center gap-2">
        <Button size="lg" onClick={start} disabled={rounds === 0} className="h-12 gap-2 px-10 text-base font-semibold">
          <Play className="size-5" />
          Start {LEVELS[level].label}
        </Button>
        <p className="text-xs text-muted-foreground">
          {rounds} messages · {LEVELS[level].seconds}s each
        </p>
      </div>

      <section className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
        <h2 className="mb-2 font-semibold text-foreground">How scoring works</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong className="text-foreground">100 points</strong> per correct answer, plus up to <strong className="text-foreground">50</strong> for speed.</li>
          <li>Intermediate scores <strong className="text-foreground">×1.5</strong>, Advanced <strong className="text-foreground">×2</strong>.</li>
          <li>From <strong className="text-foreground">3 correct in a row</strong>, every further correct answer adds <strong className="text-foreground">+50</strong>.</li>
          <li>Running out of time or skipping scores 0 and resets your streak.</li>
          <li>Need a moment? <strong className="text-foreground">Pause</strong> stops the clock and hides the message. Switching apps pauses automatically.</li>
          <li>Channel or topic practice rounds count towards your progress but not the scoreboard.</li>
          <li>Shortcuts: <kbd className="font-mono">L</kbd> legitimate, <kbd className="font-mono">P</kbd> phishing, <kbd className="font-mono">S</kbd> skip, <kbd className="font-mono">Enter</kbd> next.</li>
        </ul>
      </section>
    </div>
  );
}

export default DifficultySelector;
