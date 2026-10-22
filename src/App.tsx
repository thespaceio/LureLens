import { Suspense, lazy, useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, Info, Play, Trophy } from 'lucide-react';
import DifficultySelector from '@/components/DifficultySelector/DifficultySelector';
import QuizInterface from '@/components/QuizInterface/QuizInterface';
import type { QuizResult } from '@/components/QuizInterface/QuizInterface';
import ResultsScreen from '@/components/ResultsScreen/ResultsScreen';
import Leaderboard from '@/components/Leaderboard/Leaderboard';
import { Logo } from '@/components/Logo/Logo';
import { useGameStore } from '@/hooks/useGameStore';
import { accuracyOf, buildRound } from '@/lib/game';
import { bestScore, playerSessions, rankOf } from '@/lib/stats';
import type { CategoryId, Channel, Email, GameSession, Level } from '@/types';
import './App.css';

// The dashboard pulls in the charting library, so load it only when opened.
const ProgressDashboard = lazy(() => import('@/components/ProgressDashboard/ProgressDashboard'));

type View = 'menu' | 'quiz' | 'results' | 'scoreboard' | 'progress' | 'about';

interface Game {
  id: string;
  level: Level;
  categories: CategoryId[];
  channels: Channel[];
  emails: Email[];
}

interface Result {
  session: GameSession;
  rank: { rank: number; of: number };
  personalBest: boolean;
}

const NAV: { id: View; label: string; short: string; icon: typeof Play }[] = [
  { id: 'menu', label: 'Play', short: 'Play', icon: Play },
  { id: 'scoreboard', label: 'Scoreboard', short: 'Scores', icon: Trophy },
  { id: 'progress', label: 'Progress', short: 'Stats', icon: BarChart3 },
  { id: 'about', label: 'About', short: '', icon: Info },
];

function App() {
  const store = useGameStore();
  const [view, setView] = useState<View>('menu');
  const [game, setGame] = useState<Game | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [menuLevel, setMenuLevel] = useState<Level>('beginner');

  const navigate = (next: View) => {
    if (view === 'quiz' && next !== 'quiz' && !window.confirm("Leave this game? This round won't be saved.")) return;
    if (next === 'menu') setGame(null);
    setView(next);
    window.scrollTo(0, 0);
  };

  const startGame = useCallback((level: Level, categories: CategoryId[] = [], channels: Channel[] = []) => {
    const emails = buildRound(level, categories, channels);
    if (emails.length === 0) return;
    setMenuLevel(level);
    setGame({ id: `${level}-${Date.now()}`, level, categories, channels, emails });
    setView('quiz');
    window.scrollTo(0, 0);
  }, []);

  const finishGame = useCallback(
    ({ answers, score, bestStreak }: QuizResult) => {
      if (!game) return;
      const name = store.playerName.trim() || 'Player';
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
        ...(game.categories.length > 0 || game.channels.length > 0 ? { practice: true } : {}),
      };
      const playedBefore = playerSessions(store.sessions, name).some(s => !s.practice && s.level === game.level);
      const previousBest = bestScore(store.sessions, name, game.level);
      store.saveSession(session);
      setResult({
        session,
        rank: rankOf([session, ...store.sessions], session),
        personalBest: !session.practice && playedBefore && score > previousBest,
      });
      setView('results');
      window.scrollTo(0, 0);
    },
    [game, store],
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
            onPlayLevel={level => startGame(level)}
            onScoreboard={() => navigate('scoreboard')}
            onProgress={() => navigate('progress')}
          />
        ) : null;
      case 'scoreboard':
        return <Leaderboard sessions={store.sessions} playerName={store.playerName} onPlay={() => navigate('menu')} />;
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
            />
          </Suspense>
        );
      case 'about':
        return <About />;
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
          />
        );
    }
  };

  const activeNav = view === 'quiz' || view === 'results' ? 'menu' : view;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <button onClick={() => navigate('menu')} className="flex min-h-11 items-center rounded-lg" aria-label="LureLens home">
            <Logo size={34} wordmarkClassName="hidden sm:inline" />
          </button>
          <nav className="flex items-center gap-1">
            {NAV.map(item => (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                aria-current={activeNav === item.id ? 'page' : undefined}
                aria-label={item.label}
                className={`flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors sm:px-3 ${
                  activeNav === item.id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-card hover:text-foreground'
                }`}
              >
                <item.icon className="size-4" />
                <span className="hidden sm:inline">{item.label}</span>
                {item.short && <span className="sm:hidden">{item.short}</span>}
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

      <footer className="border-t border-border px-4 py-6 text-center font-mono text-[11px] tracking-[0.18em] text-muted-foreground">
        TH3 SPACEIO · LEARN. BUILD. SECURE.
      </footer>
    </div>
  );
}

function About() {
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
            <li>Scores are saved only in this browser, so the scoreboard is per device.</li>
            <li>All emails are simulated. Brand names are used for education only, and the phishing domains are fictional.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

export default App;
