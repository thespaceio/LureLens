// Shared types and game settings for LureLens.

export type Level = 'beginner' | 'intermediate' | 'advanced';

export type CategoryId = 'banking' | 'workplace' | 'accounts' | 'shopping' | 'government' | 'offers';

export interface RedFlag {
  description: string;
  /** Where in the email the flag appears (optional). */
  location?: string;
}

export interface Email {
  id: string;
  level: Level;
  is_phishing: boolean;
  category: CategoryId;
  /** Finer-grained attack type shown on the dashboard, e.g. "Invoice Fraud". */
  topic: string;
  sender: { name: string; email: string };
  reply_to?: string;
  subject: string;
  /** ISO date, e.g. 2026-10-16T09:30:00 */
  date: string;
  /** HTML body. Sanitised before rendering. */
  body: string;
  attachments?: string[];
  red_flags: RedFlag[];
  trust_signals: string[];
  explanation: string;
}

export type Choice = 'phishing' | 'legitimate' | 'timeout' | 'skip';

export interface Points {
  base: number;
  speed: number;
  streak: number;
  total: number;
}

export interface AnswerRecord {
  id: string;
  subject: string;
  category: CategoryId;
  topic: string;
  is_phishing: boolean;
  choice: Choice;
  correct: boolean;
  seconds: number;
  points: number;
}

export interface GameSession {
  id: string;
  name: string;
  level: Level;
  date: string;
  score: number;
  correct: number;
  total: number;
  accuracy: number;
  bestStreak: number;
  avgSeconds: number;
  answers: AnswerRecord[];
}

export interface LevelConfig {
  id: Level;
  label: string;
  /** Seconds allowed per email. */
  seconds: number;
  /** Points multiplier. */
  multiplier: number;
  /** Emails per game. */
  rounds: number;
  tagline: string;
  description: string;
  features: string[];
}

export const LEVELS: Record<Level, LevelConfig> = {
  beginner: {
    id: 'beginner',
    label: 'Beginner',
    seconds: 30,
    multiplier: 1,
    rounds: 10,
    tagline: 'Spot the classic warning signs',
    description: 'Free-email senders, spelling mistakes, fake prizes and obvious threats.',
    features: ['Bank & fintech scams', 'Fake prizes and grants', 'Delivery and job scams'],
  },
  intermediate: {
    id: 'intermediate',
    label: 'Intermediate',
    seconds: 25,
    multiplier: 1.5,
    rounds: 10,
    tagline: 'Beat the lookalike domains',
    description: 'Convincing branding, lookalike domains and scary alerts that are actually real.',
    features: ['Lookalike domains', 'Fake login and KYC pages', 'Real alerts that look scary'],
  },
  advanced: {
    id: 'advanced',
    label: 'Advanced',
    seconds: 20,
    multiplier: 2,
    rounds: 10,
    tagline: 'Catch targeted attacks at work',
    description: 'CEO fraud, hidden link destinations, malicious attachments, MFA and QR attacks.',
    features: ['CEO & invoice fraud', 'Hidden link destinations', 'Malware attachments, MFA & QR'],
  },
};

export const LEVEL_ORDER: Level[] = ['beginner', 'intermediate', 'advanced'];

export const CATEGORIES: Record<CategoryId, { label: string; description: string }> = {
  banking: { label: 'Banking & Payments', description: 'Banks, fintech wallets, payments and invoices' },
  workplace: { label: 'Work & Business', description: 'Colleagues, HR, documents, file sharing, jobs' },
  accounts: { label: 'Accounts & Security', description: 'Password, sign-in, MFA and social media alerts' },
  shopping: { label: 'Shopping & Delivery', description: 'Orders, couriers, rides and travel' },
  government: { label: 'Government & Education', description: 'Grants, NYSC, JAMB, universities' },
  offers: { label: 'Prizes, Bills & Subscriptions', description: 'Promos, 419 offers, utilities, telecom, streaming' },
};

/** The player's fictional workplace. Used in the intro text. */
export const PLAYER = {
  name: 'Ada Okafor',
  company: 'BrightPath Technologies',
  domain: 'brightpath.ng',
};
