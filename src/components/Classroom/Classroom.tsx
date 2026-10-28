import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, ClipboardList, Copy, Eye, LogIn, MonitorPlay, Presentation, RefreshCw, UserRound, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import EmailViewer from '@/components/EmailViewer/EmailViewer';
import MessageViewer from '@/components/MessageViewer/MessageViewer';
import Explanation from '@/components/Explanation/Explanation';
import LinkStatus from '@/components/LinkStatus/LinkStatus';
import type { InspectedLink } from '@/components/LinkStatus/LinkStatus';
import QrCode from '@/components/Classroom/QrCode';
import LiveDot from '@/components/Online/LiveDot';
import { mergeResults, useClassBoard } from '@/hooks/useClassBoard';
import type { ClassBoard } from '@/hooks/useClassBoard';
import { ONLINE } from '@/lib/online';
import {
  classRound,
  createClassCode,
  decodeClassCode,
  formatCode,
  inviteLink,
  messageAccuracy,
  parseResults,
} from '@/lib/classroom';
import type { ClassResult, DecodedClass } from '@/lib/classroom';
import { CHANNELS, LEVELS, LEVEL_ORDER, channelOf, verifyTip } from '@/types';
import type { Email, EmailMessage, Level } from '@/types';

type JoinedClass = Extract<DecodedClass, { ok: true }>;

interface ClassroomProps {
  playerName: string;
  /** Signed in: the name is the account's username and can't be edited here. */
  lockedName?: string;
  onNameChange: (name: string) => void;
  /** Code from an invite link, filled in for the player. */
  initialCode?: string;
  onJoin: (decoded: JoinedClass) => void;
  signedIn: boolean;
  /** Sign in or quick join, then come back here. */
  onSignIn: () => void;
  /** Opens the class board on the big screen. */
  onBigScreen: (code: string) => void;
}

// A code typed in the join box survives a trip to sign in and back.
const JOIN_KEY = 'lurelens_join_code';
const readJoin = () => {
  try {
    return sessionStorage.getItem(JOIN_KEY) ?? '';
  } catch {
    return '';
  }
};
const writeJoin = (code: string) => {
  try {
    sessionStorage.setItem(JOIN_KEY, code);
  } catch {
    // Storage blocked: the code just isn't remembered.
  }
};

// The facilitator's class survives a refresh, so pasted results aren't lost.
const HOST_KEY = 'lurelens_class_host_v1';

interface HostState {
  code: string;
  pasted: string;
}

function readHost(): HostState | null {
  try {
    const raw = localStorage.getItem(HOST_KEY);
    const value = raw ? (JSON.parse(raw) as HostState) : null;
    return value && typeof value.code === 'string' && decodeClassCode(value.code).ok
      ? { code: value.code, pasted: typeof value.pasted === 'string' ? value.pasted : '' }
      : null;
  } catch {
    return null;
  }
}

function writeHost(state: HostState | null) {
  try {
    if (state) localStorage.setItem(HOST_KEY, JSON.stringify(state));
    else localStorage.removeItem(HOST_KEY);
  } catch {
    // Storage blocked. The class still works until the page is closed.
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function useCopied(): [string | null, (key: string, text: string) => void] {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    copyText(text).then(ok => {
      if (!ok) return;
      setCopied(key);
      setTimeout(() => setCopied(c => (c === key ? null : c)), 2000);
    });
  };
  return [copied, copy];
}

const pct = (right: number, answered: number) => (answered ? Math.round((right / answered) * 100) : 0);

function accuracyTone(right: number, answered: number): string {
  if (!answered) return 'border-border text-muted-foreground';
  const p = pct(right, answered);
  if (p >= 70) return 'border-primary/60 bg-primary/10 text-primary';
  if (p >= 40) return 'border-lavender/60 bg-lavender/10 text-lavender';
  return 'border-destructive/60 bg-destructive/10 text-destructive';
}

export function Classroom(props: ClassroomProps) {
  const { onBigScreen } = props;
  const [host, setHost] = useState<HostState | null>(readHost);
  const [debrief, setDebrief] = useState(false);
  const board = useClassBoard(host?.code ?? null);

  useEffect(() => writeHost(host), [host]);

  if (host && debrief) {
    return <Debrief host={host} board={board} onBack={() => setDebrief(false)} />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <motion.section initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <p className="font-mono text-xs tracking-[0.16em] text-primary">SPACEIO // CLASSROOM</p>
        <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">Classroom mode</h1>
        <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
          Run LureLens with a group. Everyone who enters the same class code plays the same 10 messages in the same order,
          so you can talk through each one together afterwards.
          {ONLINE
            ? ' Signed-in players appear on your class board as they finish, ready for the big screen.'
            : ' Nothing is sent to a server.'}
        </p>
      </motion.section>

      {host ? (
        <HostPanel
          host={host}
          board={board}
          onBigScreen={() => onBigScreen(host.code)}
          onChange={setHost}
          onDebrief={() => {
            setDebrief(true);
            window.scrollTo(0, 0);
          }}
          onEnd={() => {
            if (window.confirm('End this class? The code and pasted results will be cleared from this device.')) setHost(null);
          }}
        />
      ) : null}

      <div className={`grid gap-4 ${host ? '' : 'md:grid-cols-2'}`}>
        <JoinCard {...props} />
        {!host && <HostCard onCreate={code => setHost({ code, pasted: '' })} />}
      </div>
    </div>
  );
}

function JoinCard({ playerName, lockedName, onNameChange, initialCode, onJoin, signedIn, onSignIn }: ClassroomProps) {
  const [code, setCode] = useState(() => (initialCode ? formatCode(initialCode) : readJoin()));
  const [error, setError] = useState<string | null>(null);

  const join = () => {
    if (!playerName.trim()) {
      setError('Enter your name so your facilitator knows whose result it is.');
      document.getElementById('class-name')?.focus();
      return;
    }
    const decoded = decodeClassCode(code);
    if (!decoded.ok) {
      setError(
        decoded.reason === 'format'
          ? 'A class code has 6 letters and numbers, like 7K2-QX9.'
          : "That code doesn't match. Check it with your facilitator. If it's right, you may both need to refresh LureLens so you have the same version.",
      );
      document.getElementById('class-code')?.focus();
      return;
    }
    onJoin(decoded);
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="join-heading">
      <h2 id="join-heading" className="mb-1 flex items-center gap-2 text-lg font-semibold">
        <LogIn className="size-5 text-primary" /> Join a class
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">Enter the code your facilitator shows you.</p>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="class-name" className="text-sm text-muted-foreground">Your name</label>
          {lockedName ? (
            <p id="class-name" className="flex h-11 items-center rounded-md border border-border bg-background/50 px-3 font-medium">
              {lockedName}
            </p>
          ) : (
            <Input
              id="class-name"
              value={playerName}
              maxLength={24}
              placeholder="e.g. Faith"
              className="h-11 bg-background"
              onChange={e => {
                onNameChange(e.target.value);
                setError(null);
              }}
            />
          )}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="class-code" className="text-sm text-muted-foreground">Class code</label>
          <Input
            id="class-code"
            value={code}
            maxLength={9}
            placeholder="e.g. 7K2-QX9"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={Boolean(error)}
            className="h-12 bg-background font-mono text-lg uppercase tracking-[0.2em] placeholder:normal-case placeholder:tracking-normal"
            onChange={e => {
              setCode(e.target.value);
              writeJoin(e.target.value);
              setError(null);
            }}
            onKeyDown={e => e.key === 'Enter' && join()}
          />
        </div>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        {ONLINE && !signedIn && (
          <div className="space-y-2 rounded-lg border border-lavender/40 bg-lavender/10 p-3 text-sm" data-testid="join-sign-in">
            <p>
              <strong>Sign in or quick join first</strong> so your result goes straight to your facilitator's class board. It
              takes a few seconds; no email needed.
            </p>
            <Button variant="secondary" className="w-full gap-2" onClick={onSignIn}>
              <UserRound className="size-4" /> Sign in or quick join
            </Button>
          </div>
        )}
        <Button size="lg" className="h-12 w-full gap-2 font-semibold" onClick={join} data-testid="join-class">
          <LogIn className="size-4" /> Join and start
        </Button>
        <p className="text-xs text-muted-foreground">
          {ONLINE
            ? 'Class rounds go to your class board and your progress, not the public scoreboard.'
            : 'Class rounds count towards your progress but not the scoreboard.'}
        </p>
      </div>
    </section>
  );
}

function HostCard({ onCreate }: { onCreate: (code: string) => void }) {
  const [level, setLevel] = useState<Level>('beginner');
  return (
    <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="host-heading">
      <h2 id="host-heading" className="mb-1 flex items-center gap-2 text-lg font-semibold">
        <Users className="size-5 text-lavender" /> Run a class
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Pick a level and get a code, a link and a QR code to put on the screen.
      </p>
      <div className="mb-4 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Class level">
        {LEVEL_ORDER.map(id => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={level === id}
            onClick={() => setLevel(id)}
            className={`rounded-lg border px-2 py-3 text-sm font-medium transition-colors ${
              level === id ? 'border-lavender bg-lavender text-primary-foreground' : 'border-border hover:border-lavender/60'
            }`}
          >
            {LEVELS[id].label}
            <span className="block font-mono text-[11px] opacity-70">{LEVELS[id].seconds}s</span>
          </button>
        ))}
      </div>
      <Button
        size="lg"
        variant="secondary"
        className="h-12 w-full gap-2 font-semibold"
        onClick={() => onCreate(createClassCode(level))}
        data-testid="create-class"
      >
        <Presentation className="size-4" /> Create class code
      </Button>
      {ONLINE ? (
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
          <li>Players sign in or quick join, then join with the code, link or QR code.</li>
          <li>Their results appear on your class board as they finish. Put it on the big screen for the room.</li>
          <li>Run the debrief, message by message, with how the class answered each one.</li>
        </ol>
      ) : (
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
          <li>Players join with the code, link or QR code.</li>
          <li>Each player sends you their result line, for example in your WhatsApp group.</li>
          <li>Paste the lines here to see the class results, then run the debrief.</li>
        </ol>
      )}
    </section>
  );
}

function HostPanel({
  host,
  board,
  onBigScreen,
  onChange,
  onDebrief,
  onEnd,
}: {
  host: HostState;
  board: ClassBoard;
  onBigScreen: () => void;
  onChange: (state: HostState) => void;
  onDebrief: () => void;
  onEnd: () => void;
}) {
  const decoded = useMemo(() => decodeClassCode(host.code) as JoinedClass, [host.code]);
  const round = useMemo(() => classRound(decoded), [decoded]);
  const display = formatCode(host.code);
  const link = inviteLink(host.code);
  const level = LEVELS[decoded.level];
  const [copied, copy] = useCopied();
  const invite = `Join my LureLens class (${level.label}). Open ${link} or open LureLens, choose Classroom and enter the code ${display}.`;

  return (
    <section className="space-y-4 rounded-xl border border-lavender/40 bg-card p-5" aria-label="Your class" data-testid="host-panel">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="mx-auto w-44 shrink-0 overflow-hidden rounded-lg sm:mx-0">
          <QrCode text={link} label={`QR code for ${link}`} className="block h-auto w-full" />
        </div>
        <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-lavender">Your class · {level.label}</p>
          <p className="font-mono text-5xl font-semibold tracking-[0.08em] text-foreground sm:text-6xl" data-testid="class-code">{display}</p>
          <p className="font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{link}</p>
          <div className="flex flex-wrap justify-center gap-2 pt-1 sm:justify-start">
            <Button className="gap-2 font-semibold" onClick={() => copy('invite', invite)}>
              {copied === 'invite' ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied === 'invite' ? 'Copied' : 'Copy invite'}
            </Button>
            <Button asChild variant="secondary">
              <a href={`https://wa.me/?text=${encodeURIComponent(invite)}`} target="_blank" rel="noopener noreferrer">
                Send on WhatsApp
              </a>
            </Button>
            {ONLINE && (
              <Button variant="secondary" className="gap-2" onClick={onBigScreen} data-testid="class-big-screen">
                <MonitorPlay className="size-4" /> Big screen
              </Button>
            )}
            <Button variant="outline" className="gap-2 bg-transparent" onClick={onEnd}>
              <RefreshCw className="size-4" /> New class
            </Button>
          </div>
        </div>
      </div>

      <ClassResults host={host} board={board} round={round} onChange={onChange} onDebrief={onDebrief} />
    </section>
  );
}

function ClassResults({
  host,
  board,
  round,
  onChange,
  onDebrief,
}: {
  host: HostState;
  board: ClassBoard;
  round: Email[];
  onChange: (state: HostState) => void;
  onDebrief: () => void;
}) {
  const pasted = useMemo(() => parseResults(host.pasted, host.code), [host.pasted, host.code]);
  const otherClass = pasted.otherClass;
  const results = useMemo(() => mergeResults(board.results, pasted.results), [board.results, pasted.results]);
  const perMessage = useMemo(() => messageAccuracy(results, round.length), [results, round.length]);
  const average = results.length
    ? Math.round(results.reduce((s, r) => s + (r.total ? r.correct / r.total : 0), 0) / results.length * 100)
    : 0;
  const hardest = results.length
    ? perMessage
        .map((m, i) => ({ ...m, i }))
        .filter(m => m.answered > 0)
        .sort((a, b) => pct(a.right, a.answered) - pct(b.right, b.answered))[0]
    : undefined;

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <ClipboardList className="size-4 text-lavender" /> Class results
          {ONLINE && <LiveDot status={board.status} className="ml-1" />}
        </h3>
        <Button size="lg" className="gap-2 font-semibold" onClick={onDebrief} data-testid="start-debrief">
          <Presentation className="size-4" /> Start debrief
        </Button>
      </div>
      {ONLINE && (
        <p className="text-sm text-muted-foreground" data-testid="class-board-note">
          {board.error
            ? `${board.error} Retrying…`
            : results.length
              ? 'Results appear here as players finish.'
              : board.results === null
                ? 'Loading the class board…'
                : 'Waiting for the first player to finish. Results appear here as they do.'}
        </p>
      )}
      {ONLINE ? (
        <details className="rounded-lg border border-border px-3 py-2 text-sm" open={Boolean(host.pasted)}>
          <summary className="cursor-pointer text-muted-foreground">Players without internet? Paste the result lines they send you</summary>
          <PasteBox host={host} onChange={onChange} />
        </details>
      ) : (
        <PasteBox host={host} onChange={onChange} />
      )}
      {otherClass > 0 && (
        <p className="text-xs text-muted-foreground">
          {otherClass} line{otherClass === 1 ? ' was' : 's were'} for a different class code and left out.
        </p>
      )}

      {results.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ['Players', String(results.length)],
              ['Average accuracy', `${average}%`],
              ['Most missed', hardest ? `#${hardest.i + 1}` : '–'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border bg-background/60 p-3">
                <div className="text-xl font-bold">{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
          <ol className="divide-y divide-border overflow-hidden rounded-lg border border-border" data-testid="class-table">
            {results.map((r: ClassResult, i) => (
              <li key={r.name} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-6 font-mono text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                <span className="hidden font-mono text-xs tracking-[0.1em] sm:inline" aria-hidden>
                  {r.marks.map((m, j) => (
                    <span key={j} className={m === 'right' ? 'text-primary' : m === 'safe' ? 'text-lavender' : 'text-destructive'}>
                      {m === 'right' ? '✓' : m === 'safe' ? '☎' : '✗'}
                    </span>
                  ))}
                </span>
                <span className="w-12 text-right text-muted-foreground">{r.correct}/{r.total}</span>
                <span className="w-16 text-right font-mono font-semibold">{r.score}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

function PasteBox({ host, onChange }: { host: HostState; onChange: (state: HostState) => void }) {
  return (
    <div className="space-y-2 pt-2">
      <label htmlFor="class-results" className="block text-sm text-muted-foreground">
        Paste the result lines your players send you. You can paste a whole chat; anything else is ignored.
      </label>
      <textarea
        id="class-results"
        value={host.pasted}
        onChange={e => onChange({ ...host, pasted: e.target.value })}
        rows={4}
        placeholder={`LureLens class ${formatCode(host.code)} · Tunde · 1180 pts · 8/10 · ✓✓✗✓✓✓✗✓✓✓`}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs placeholder:text-muted-foreground/60 focus-visible:outline-2 focus-visible:outline-ring"
      />
    </div>
  );
}

function Debrief({ host, board, onBack }: { host: HostState; board: ClassBoard; onBack: () => void }) {
  const decoded = useMemo(() => decodeClassCode(host.code) as JoinedClass, [host.code]);
  const round = useMemo(() => classRound(decoded), [decoded]);
  const pasted = useMemo(() => parseResults(host.pasted, host.code), [host.pasted, host.code]);
  const results = useMemo(() => mergeResults(board.results, pasted.results), [board.results, pasted.results]);
  const perMessage = useMemo(() => messageAccuracy(results, round.length), [results, round.length]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [link, setLink] = useState<InspectedLink | null>(null);
  const email = round[index];
  const noun = CHANNELS[channelOf(email)].noun;
  const stat = perMessage[index];

  const go = (i: number) => {
    if (i < 0 || i >= round.length) return;
    setIndex(i);
    setRevealed(false);
    setLink(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'ArrowRight') go(index + 1);
      else if (e.key === 'ArrowLeft') go(index - 1);
      else if (e.key.toLowerCase() === 'r') setRevealed(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4" data-testid="debrief">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={onBack}>
          <ArrowLeft className="size-4" /> Back to class
        </Button>
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-lavender">
          Debrief · {formatCode(host.code)} · {LEVELS[decoded.level].label}
        </p>
      </div>

      <nav className="flex flex-wrap gap-1.5" aria-label="Messages">
        {round.map((m, i) => {
          const s = perMessage[i];
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => go(i)}
              aria-current={i === index ? 'step' : undefined}
              title={s.answered ? `${pct(s.right, s.answered)}% got this right` : undefined}
              className={`min-w-11 rounded-lg border px-2 py-1.5 text-center font-mono text-xs transition-colors ${accuracyTone(s.right, s.answered)} ${
                i === index ? 'ring-2 ring-foreground' : ''
              }`}
            >
              <span className="block text-sm font-semibold">{i + 1}</span>
              {s.answered > 0 && <span className="block text-[10px]">{pct(s.right, s.answered)}%</span>}
            </button>
          );
        })}
      </nav>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] sm:text-3xl">
          Message {index + 1} of {round.length}
        </h1>
        <p className="text-sm text-muted-foreground">
          {CHANNELS[channelOf(email)].label} · {email.topic}
        </p>
      </div>

      <motion.div key={email.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
        {email.channel === 'sms' || email.channel === 'whatsapp' ? (
          <MessageViewer message={email} onLinkInspect={(url, clicked) => setLink({ url, clicked })} />
        ) : (
          <EmailViewer email={email as EmailMessage} onLinkInspect={(url, clicked) => setLink({ url, clicked })} highlightLinks={revealed} />
        )}
        <LinkStatus link={link} noun={noun} />
      </motion.div>

      {revealed ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5" data-testid="debrief-answer">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p
              className={`flex items-center gap-2 font-display text-2xl font-extrabold ${
                email.is_phishing ? 'text-destructive' : 'text-primary'
              }`}
            >
              {email.is_phishing ? <X className="size-6" /> : <Check className="size-6" />}
              {email.is_phishing ? 'Phishing' : 'Legitimate'}
            </p>
            {stat.answered > 0 && (
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{stat.right} of {stat.answered}</strong> players got this right (
                {pct(stat.right, stat.answered)}%)
              </p>
            )}
          </div>
          {email.verify_first && (
            <p className="rounded-lg border border-lavender/40 bg-lavender/10 px-4 py-3 text-base">
              <strong className="font-mono text-xs uppercase tracking-[0.12em] text-lavender">Verify first is right here · </strong>
              {verifyTip(email)}
            </p>
          )}
          <Explanation email={email} large />
        </section>
      ) : (
        <section className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-6 text-center">
          <p className="max-w-md text-muted-foreground">
            Ask the room first: who thinks this {noun} is phishing, and what gave it away?
          </p>
          <Button size="lg" className="gap-2 font-semibold" onClick={() => setRevealed(true)} data-testid="reveal-answer">
            <Eye className="size-4" /> Reveal answer
            <kbd className="ml-1 hidden rounded border border-current px-1.5 font-mono text-[10px] opacity-70 sm:inline">R</kbd>
          </Button>
        </section>
      )}

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" className="gap-2 bg-transparent" onClick={() => go(index - 1)} disabled={index === 0}>
          <ArrowLeft className="size-4" /> Previous
        </Button>
        {index < round.length - 1 ? (
          <Button className="gap-2 font-semibold" onClick={() => go(index + 1)} data-testid="debrief-next">
            Next message <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button className="gap-2 font-semibold" onClick={onBack}>
            Finish debrief
          </Button>
        )}
      </div>
    </div>
  );
}

export default Classroom;
