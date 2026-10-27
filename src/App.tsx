import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, Info, Play, Trophy, UserRound, Users } from 'lucide-react';
import DifficultySelector from '@/components/DifficultySelector/DifficultySelector';
import QuizInterface from '@/components/QuizInterface/QuizInterface';
import type { QuizResult } from '@/components/QuizInterface/QuizInterface';
import ResultsScreen from '@/components/ResultsScreen/ResultsScreen';
import Leaderboard from '@/components/Leaderboard/Leaderboard';
import { Logo } from '@/components/Logo/Logo';
import WhatsNew from '@/components/WhatsNew/WhatsNew';
import TopPlayers from '@/components/Online/TopPlayers';
import { isReady, useAuth } from '@/hooks/authContext';
import { pullGames, pushGames } from '@/lib/sync';
import { markWhatsNewSeen, whatsNewFor } from '@/lib/whatsNew';
import { useGameStore } from '@/hooks/useGameStore';
import { accuracyOf, buildRound } from '@/lib/game';
import { APP_VERSION, CONTACT_EMAIL, NEW_ISSUE_URL } from '@/lib/report';
import { classRound, normalizeCode } from '@/lib/classroom';
import { certificateProgress } from '@/lib/certificate';
import { ONLINE } from '@/lib/online';
import type { DecodedClass } from '@/lib/classroom';
import { bestScore, playerSessions, rankOf } from '@/lib/stats';
import type { CategoryId, Channel, Email, GameSession, Level } from '@/types';
import './App.css';

// The dashboard pulls in the charting library, so load it only when opened.
const ProgressDashboard = lazy(() => import('@/components/ProgressDashboard/ProgressDashboard'));
const Classroom = lazy(() => import('@/components/Classroom/Classroom'));
const CertificateCheck = lazy(() => import('@/components/Online/CertificateCheck'));
const Account = lazy(() => import('@/components/Account/Account'));
const Privacy = lazy(() => import('@/components/Privacy/Privacy'));
const LiveBoard = lazy(() => import('@/components/Online/LiveBoard'));
const ClassLiveBoard = lazy(() => import('@/components/Online/ClassLiveBoard'));

type View = 'menu' | 'quiz' | 'results' | 'scoreboard' | 'progress' | 'classroom' | 'check' | 'about' | 'account' | 'privacy' | 'live';

/** Reads ?class=… or ?cert=… from a link, and removes it from the address bar. */
function paramFromLink(name: string): string | undefined {
  try {
    const params = new URLSearchParams(window.location.search);
    const value = params.get(name);
    if (value === null) return undefined;
    params.delete(name);
    const rest = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
    return value;
  } catch {
    return undefined;
  }
}
const LINK_CODE = ((c: string | undefined) => (c === undefined ? undefined : normalizeCode(c)))(paramFromLink('class'));
/** A certificate reference from a check link (?cert=LL-XXXX-XXXX), e.g. from LinkedIn. */
const LINK_CERT = ONLINE ? paramFromLink('cert')?.trim().toUpperCase() : undefined;
/** ?live opens the big-screen scoreboard (for projectors); ?privacy the privacy notice. */
const LINK_LIVE = ONLINE && paramFromLink('live') !== undefined;
const LINK_PRIVACY = paramFromLink('privacy') !== undefined;

interface Game {
  id: string;
  level: Level;
  categories: CategoryId[];
  channels: Channel[];
  emails: Email[];
  /** Set for classroom rounds. */
  classCode?: string;
}

interface Result {
  session: GameSession;
  rank: { rank: number; of: number };
  personalBest: boolean;
  /** This game completed the certificate. */
  newCertificate: boolean;
}

const NAV: { id: View; label: string; short: string; icon: typeof Play }[] = [
  { id: 'menu', label: 'Play', short: 'Play', icon: Play },
  { id: 'scoreboard', label: 'Scoreboard', short: 'Scores', icon: Trophy },
  { id: 'progress', label: 'Progress', short: 'Stats', icon: BarChart3 },
  { id: 'classroom', label: 'Classroom', short: 'Class', icon: Users },
  { id: 'about', label: 'About', short: 'About', icon: Info },
];

const RETURN_LABEL: Partial<Record<View, string>> = {
  results: 'Back to your results',
  progress: 'Back to your certificate',
  scoreboard: 'Back to the scoreboard',
  classroom: 'Back to your class',
};

function App() {
  const store = useGameStore();
  const auth = useAuth();
  const signedIn = isReady(auth);
  const username = auth.profile?.username ?? '';
  const [view, setView] = useState<View>(
    LINK_LIVE ? 'live' : LINK_PRIVACY ? 'privacy' : LINK_CERT ? 'check' : LINK_CODE ? 'classroom' : 'menu',
  );
  const [returnTo, setReturnTo] = useState<View | null>(null);
  // The class shown on the big screen (?live&class=…), or null for the public board.
  const [liveClass, setLiveClass] = useState<string | null>(LINK_LIVE && LINK_CODE ? LINK_CODE : null);
  const [game, setGame] = useState<Game | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [menuLevel, setMenuLevel] = useState<Level>('beginner');
  // Returning players see what changed, once. Not over an invite link.
  const [whatsNew, setWhatsNew] = useState(() =>
    LINK_CODE || LINK_CERT || LINK_LIVE || LINK_PRIVACY ? 'none' : whatsNewFor(store.sessions.length > 0 || Boolean(store.playerName)),
  );
  const closeWhatsNew = () => {
    markWhatsNewSeen();
    setWhatsNew('none');
  };

  const navigate = (next: View) => {
    if (view === 'quiz' && next !== 'quiz' && !window.confirm("Leave this game? This round won't be saved.")) return;
    if (next === 'menu') setGame(null);
    setView(next);
    window.scrollTo(0, 0);
  };

  /** Sends the player to sign in, and back here afterwards. */
  const signIn = (from: View) => {
    setReturnTo(from);
    setView('account');
    window.scrollTo(0, 0);
  };

  // Signed in: the player name is the account's username.
  const { setPlayerName, mergeSessions, updateSessions, removeSessions } = store;
  useEffect(() => {
    if (signedIn && username && store.playerName !== username) setPlayerName(username);
  }, [signedIn, username, store.playerName, setPlayerName]);

  // On sign-in, bring the account's games onto this device.
  useEffect(() => {
    if (!signedIn || !auth.userId) return;
    const userId = auth.userId;
    pullGames()
      .then(remote => mergeSessions(remote.map(g => ({ ...g, userId, synced: true }))))
      .catch(() => {
        // Offline: the games arrive next time.
      });
  }, [signedIn, auth.userId, mergeSessions]);

  // Upload games that aren't in the account yet (new ones, or ones added from this device).
  const [onlineTick, setOnlineTick] = useState(0);
  useEffect(() => {
    const bump = () => setOnlineTick(n => n + 1);
    window.addEventListener('online', bump);
    return () => window.removeEventListener('online', bump);
  }, []);
  const pending = signedIn ? store.sessions.filter(s => s.userId === auth.userId && !s.synced) : [];
  const pendingKey = pending.map(s => s.id).join(',');
  useEffect(() => {
    if (!signedIn || !auth.userId || !pendingKey) return;
    const games = store.sessions.filter(s => pendingKey.split(',').includes(s.id));
    pushGames(auth.userId, games)
      .then(ids => updateSessions(ids, { synced: true }))
      .catch(() => {
        // Stays pending; retried when back online or on the next visit.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, auth.userId, pendingKey, onlineTick, updateSessions]);

  // On sign-out (or account deletion), the account's games leave this device.
  const lastUser = useRef<string | null>(null);
  useEffect(() => {
    if (auth.status === 'signedIn' && auth.userId) lastUser.current = auth.userId;
    if (auth.status === 'signedOut' && lastUser.current) {
      const gone = lastUser.current;
      lastUser.current = null;
      removeSessions(s => s.userId === gone);
      setPlayerName('');
    }
  }, [auth.status, auth.userId, removeSessions, setPlayerName]);

  const startGame = useCallback((level: Level, categories: CategoryId[] = [], channels: Channel[] = []) => {
    const emails = buildRound(level, categories, channels);
    if (emails.length === 0) return;
    setMenuLevel(level);
    setGame({ id: `${level}-${Date.now()}`, level, categories, channels, emails });
    setView('quiz');
    window.scrollTo(0, 0);
  }, []);

  const joinClass = useCallback((decoded: Extract<DecodedClass, { ok: true }>) => {
    const emails = classRound(decoded);
    if (emails.length === 0) return;
    setGame({ id: `class-${decoded.code}-${Date.now()}`, level: decoded.level, categories: [], channels: [], emails, classCode: decoded.code });
    setView('quiz');
    window.scrollTo(0, 0);
  }, []);

  const finishGame = useCallback(
    ({ answers, score, bestStreak }: QuizResult) => {
      if (!game) return;
      const name = (signedIn ? username : store.playerName.trim()) || 'Player';
      const correct = answers.filter(a => a.correct).length;
      const total = answers.length;
      const session: GameSession = {
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
        name,
        level: game.level,
        date: new Date().toISOString(),
        score,
        correct,
        total,
        accuracy: accuracyOf(correct, total),
        bestStreak,
        avgSeconds: total ? Math.round((answers.reduce((s, a) => s + a.seconds, 0) / total) * 10) / 10 : 0,
        answers,
        ...(game.categories.length > 0 || game.channels.length > 0 || game.classCode ? { practice: true } : {}),
        ...(game.classCode ? { classCode: game.classCode } : {}),
        ...(signedIn && auth.userId ? { userId: auth.userId, synced: false } : {}),
      };
      const playedBefore = playerSessions(store.sessions, name).some(s => !s.practice && s.level === game.level);
      const previousBest = bestScore(store.sessions, name, game.level);
      const hadCertificate = certificateProgress(store.sessions, name).earned;
      store.saveSession(session);
      setResult({
        session,
        rank: rankOf([session, ...store.sessions], session),
        personalBest: !session.practice && playedBefore && score > previousBest,
        newCertificate: !hadCertificate && certificateProgress([session, ...store.sessions], name).earned,
      });
      setView('results');
      window.scrollTo(0, 0);
    },
    [game, store, signedIn, username, auth.userId],
  );

  const content = () => {
    switch (view) {
      case 'quiz':
        return game ? (
          <QuizInterface
            key={game.id}
            level={game.level}
            emails={game.emails}
            onFinish={finishGame}
            onQuit={() => {
              setGame(null);
              setView('menu');
            }}
          />
        ) : null;
      case 'results':
        return result ? (
          <ResultsScreen
            {...result}
            onPlayAgain={() => startGame(result.session.level, game?.categories ?? [], game?.channels ?? [])}
            onClassroom={() => navigate('classroom')}
            signedIn={signedIn}
            onSignIn={() => signIn('results')}
            onPosted={posted => {
              const patch = {
                onlineId: posted.id,
                online: { score: posted.score, rank: posted.rank, of: posted.of },
                // A game played before signing in now belongs to the account.
                ...(result.session.userId ? {} : { userId: auth.userId ?? undefined, name: posted.name, synced: false }),
              };
              store.updateSession(result.session.id, patch);
              setResult(r => (r ? { ...r, session: { ...r.session, ...patch } } : r));
            }}
            onClassPosted={posted => {
              const patch = {
                onlineId: posted.id,
                classBoard: { rank: posted.rank, of: posted.of },
                ...(result.session.userId ? {} : { userId: auth.userId ?? undefined, name: posted.name, synced: false }),
              };
              store.updateSession(result.session.id, patch);
              setResult(r => (r ? { ...r, session: { ...r.session, ...patch } } : r));
            }}
            onPlayLevel={level => startGame(level)}
            onScoreboard={() => navigate('scoreboard')}
            onProgress={() => navigate('progress')}
          />
        ) : null;
      case 'scoreboard':
        return (
          <Leaderboard
            sessions={store.sessions}
            playerName={store.playerName}
            onPlay={() => navigate('menu')}
            onBigScreen={() => navigate('live')}
          />
        );
      case 'progress':
        return (
          <Suspense fallback={<p className="text-center text-muted-foreground">Loading…</p>}>
            <ProgressDashboard
              sessions={store.sessions}
              playerName={store.playerName}
              onPlay={level => {
                if (level) setMenuLevel(level);
                navigate('menu');
              }}
              onReset={store.clearAll}
              signedIn={signedIn}
              fullName={auth.profile?.full_name ?? null}
              onSignIn={() => signIn('progress')}
              onPosted={(sessionId, posted) =>
                store.updateSession(sessionId, {
                  onlineId: posted.id,
                  ...(posted.rank !== null ? { online: { score: posted.score, rank: posted.rank, of: posted.of } } : {}),
                })
              }
            />
          </Suspense>
        );
      case 'classroom':
        return (
          <Suspense fallback={<p className="text-center text-muted-foreground">Loading…</p>}>
            <Classroom
              playerName={store.playerName}
              lockedName={signedIn ? username : undefined}
              onNameChange={store.setPlayerName}
              initialCode={LINK_LIVE ? undefined : LINK_CODE}
              onJoin={joinClass}
              signedIn={signedIn}
              onSignIn={() => signIn('classroom')}
              onBigScreen={code => {
                setLiveClass(code);
                navigate('live');
              }}
            />
          </Suspense>
        );
      case 'check':
        return (
          <Suspense fallback={<p className="text-center text-muted-foreground">Loading…</p>}>
            <CertificateCheck initialReference={LINK_CERT} />
          </Suspense>
        );
      case 'account':
        return (
          <Suspense fallback={<p className="text-center text-muted-foreground">Loading…</p>}>
            <Account
              sessions={store.sessions}
              onClaim={ids => updateSessions(ids, { userId: auth.userId ?? undefined, name: username, synced: false })}
              onPrivacy={() => navigate('privacy')}
              returnLabel={returnTo ? RETURN_LABEL[returnTo] : undefined}
              onReturn={
                returnTo && (returnTo !== 'results' || result)
                  ? () => {
                      const to = returnTo;
                      setReturnTo(null);
                      navigate(to);
                    }
                  : undefined
              }
            />
          </Suspense>
        );
      case 'privacy':
        return (
          <Suspense fallback={<p className="text-center text-muted-foreground">Loading…</p>}>
            <Privacy />
          </Suspense>
        );
      case 'about':
        return <About onCheck={() => navigate('check')} onPrivacy={() => navigate('privacy')} />;
      case 'menu':
      default:
        return (
          <DifficultySelector
            key={menuLevel}
            playerName={store.playerName}
            sessions={store.sessions}
            initialLevel={menuLevel}
            onNameChange={store.setPlayerName}
            onStart={startGame}
            lockedName={signedIn ? username : undefined}
            onAccount={() => navigate('account')}
            extra={ONLINE ? <TopPlayers onOpen={() => navigate('scoreboard')} /> : null}
          />
        );
    }
  };

  const activeNav = view === 'quiz' || view === 'results' ? 'menu' : view === 'check' || view === 'privacy' ? 'about' : view;
  const nav = ONLINE
    ? [
        ...NAV,
        {
          id: 'account' as View,
          label: signedIn ? username : 'Sign in',
          short: signedIn ? 'Me' : 'Sign in',
          icon: UserRound,
        },
      ]
    : NAV;

  // The big-screen scoreboard fills the whole window, without the menu.
  if (view === 'live') {
    return (
      <Suspense fallback={<p className="p-8 text-center text-muted-foreground">Loading…</p>}>
        {liveClass ? (
          <ClassLiveBoard
            code={liveClass}
            onExit={() => {
              setLiveClass(null);
              navigate('classroom');
            }}
          />
        ) : (
          <LiveBoard onExit={() => navigate('scoreboard')} />
        )}
      </Suspense>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <button onClick={() => navigate('menu')} className="flex min-h-11 items-center rounded-lg" aria-label="LureLens home">
            <Logo size={34} wordmarkClassName="hidden sm:inline" />
          </button>
          <nav className="flex items-center gap-0.5 md:gap-1">
            {nav.map(item => (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                aria-current={activeNav === item.id ? 'page' : undefined}
                aria-label={item.id === 'account' && signedIn ? `Your account, ${username}` : item.label}
                className={`flex min-w-11 flex-col items-center gap-0.5 rounded-lg px-1.5 py-1.5 text-[11px] font-medium transition-colors md:flex-row md:gap-1.5 md:px-3 md:py-2 md:text-sm ${
                  activeNav === item.id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-card hover:text-foreground'
                }`}
              >
                <item.icon className="size-4" />
                <span className="hidden max-w-[9rem] truncate md:inline">{item.label}</span>
                <span className="md:hidden">{item.short}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {content()}
          </motion.div>
        </AnimatePresence>
      </main>

      <WhatsNew
        open={whatsNew !== 'none'}
        kind={whatsNew}
        onClose={closeWhatsNew}
        onScoreboard={() => {
          closeWhatsNew();
          navigate('scoreboard');
        }}
      />

      <footer className="border-t border-border px-4 py-6 text-center font-mono text-[11px] tracking-[0.18em] text-muted-foreground">
        TH3 SPACEIO · LEARN. BUILD. SECURE.
      </footer>
    </div>
  );
}

function About({ onCheck, onPrivacy }: { onCheck: () => void; onPrivacy: () => void }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="font-mono text-xs tracking-[0.16em] text-primary">SPACEIO // ABOUT</p>
        <h1 className="mt-1 text-3xl font-bold sm:text-4xl">About LureLens</h1>
      </div>
      <p className="text-muted-foreground">
        LureLens is a phishing-awareness training game by Th3 SpaceIO. You get a few seconds per email, text message or
        WhatsApp chat to decide if it's safe, then see exactly which signs gave it away. The scenarios are built around
        what people in Nigeria actually receive: bank and fintech alerts, BVN and NIN requests, grants, NYSC and JAMB
        scams, delivery fees, fake jobs, hijacked WhatsApp accounts and targeted attacks on businesses.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 font-semibold">What you'll learn</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {[
              'Check the real sender domain, letter by letter',
              'Know that a text\'s sender name can be faked',
              'Spot a friend\'s hijacked WhatsApp asking for money or codes',
              'Spot urgency, threats and too-good-to-be-true offers',
              'Find where a link really goes before clicking',
              'Recognise CEO fraud and changed bank details',
              'Know when to stop and check through a number you trust',
              'Never share PINs, OTPs or MFA codes',
            ].map(t => (
              <li key={t} className="flex gap-2"><span className="text-primary">✓</span>{t}</li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 font-semibold">Good to know</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Links inside training emails never open.</li>
            <li>Without an account, scores stay in this browser. With one, your games follow you between devices.</li>
            <li>Classroom mode gives a group the same messages through a shared code, without sending anything to a server.</li>
            <li>Score 80% or more on every level to earn a LureLens certificate you can print or add to LinkedIn.</li>
            {ONLINE && (
              <li>
                Games only reach the public online scoreboard when you tap "Post to the online scoreboard". See the{' '}
                <button type="button" onClick={onPrivacy} className="text-lavender underline underline-offset-2 hover:text-foreground">
                  privacy notice
                </button>{' '}
                for what an account stores.
              </li>
            )}
            <li>All emails are simulated. Brand names are used for education only, and the phishing domains are fictional.</li>
          </ul>
        </section>
      </div>
      {ONLINE && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          <div>
            <h2 className="mb-1 font-semibold text-foreground">Check a certificate</h2>
            <p>Confirm a LureLens certificate from the reference printed on it.</p>
          </div>
          <button
            type="button"
            onClick={onCheck}
            className="rounded-lg border border-border px-4 py-2 font-medium text-foreground hover:border-primary/60"
          >
            Check a certificate
          </button>
        </section>
      )}
      <section className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
        <h2 className="mb-2 font-semibold text-foreground">Found a mistake?</h2>
        <p>
          Every message is checked against the organisation's own website, but things change. If a domain, fact or answer
          looks wrong, use the link under the explanation after you answer, or{' '}
          <a href={NEW_ISSUE_URL} target="_blank" rel="noopener noreferrer" className="text-lavender underline underline-offset-2 hover:text-foreground">
            open an issue on GitHub
          </a>{' '}
          or email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-lavender underline underline-offset-2 hover:text-foreground">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
        <p className="mt-3 font-mono text-xs">
          LureLens {APP_VERSION} ·{' '}
          <button type="button" onClick={onPrivacy} className="text-lavender underline underline-offset-2 hover:text-foreground">
            Privacy
          </button>{' '}
          ·{' '}
          <a
            href="https://github.com/thespaceio/LureLens/blob/main/CHANGELOG.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-lavender underline underline-offset-2 hover:text-foreground"
          >
            What's new
          </a>
        </p>
      </section>
    </div>
  );
}

export default App;
