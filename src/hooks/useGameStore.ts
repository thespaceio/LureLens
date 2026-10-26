// Saved games, scoreboard and player name, persisted in localStorage.
// Everything stays on this device; nothing is sent to a server.
import { useCallback, useEffect, useState } from 'react';
import { LEVELS } from '@/types';
import type { GameSession } from '@/types';

const SESSIONS_KEY = 'lurelens_sessions_v2';
const PLAYER_KEY = 'lurelens_player_v2';
const MAX_SESSIONS = 500;

// Keys used before the game was renamed from PhishGuard to LureLens. Saved
// games are copied across once so nobody loses their scores.
const OLD_SESSIONS_KEY = 'phishguard_sessions_v2';
const OLD_PLAYER_KEY = 'phishguard_player_v2';
const LEGACY_KEY = 'phishguard_data'; // old per-answer format from v0

function migrateOldKeys() {
  try {
    for (const [oldKey, newKey] of [
      [OLD_SESSIONS_KEY, SESSIONS_KEY],
      [OLD_PLAYER_KEY, PLAYER_KEY],
    ]) {
      const old = localStorage.getItem(oldKey);
      if (old !== null && localStorage.getItem(newKey) === null) localStorage.setItem(newKey, old);
      if (old !== null) localStorage.removeItem(oldKey);
    }
  } catch {
    // Storage blocked (private mode). Nothing to migrate.
  }
}
migrateOldKeys();

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked (private mode). The game still works for this visit.
  }
}

function isSession(value: unknown): value is GameSession {
  const s = value as GameSession;
  return (
    !!s &&
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    typeof s.score === 'number' &&
    s.level in LEVELS &&
    Array.isArray(s.answers)
  );
}

function loadSessions(): GameSession[] {
  const list = read<unknown>(SESSIONS_KEY, []);
  return Array.isArray(list) ? list.filter(isSession) : [];
}

export function useGameStore() {
  const [sessions, setSessions] = useState<GameSession[]>(loadSessions);
  const [playerName, setPlayerName] = useState<string>(() => read(PLAYER_KEY, ''));

  useEffect(() => write(SESSIONS_KEY, sessions), [sessions]);
  useEffect(() => write(PLAYER_KEY, playerName), [playerName]);

  const saveSession = useCallback((session: GameSession) => {
    setSessions(prev => [session, ...prev].slice(0, MAX_SESSIONS));
  }, []);

  const updateSession = useCallback((id: string, patch: Partial<GameSession>) => {
    setSessions(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const updateSessions = useCallback((ids: string[], patch: Partial<GameSession>) => {
    const wanted = new Set(ids);
    setSessions(prev => prev.map(s => (wanted.has(s.id) ? { ...s, ...patch } : s)));
  }, []);

  /** Adds games from the account that this device doesn't have yet. */
  const mergeSessions = useCallback((incoming: GameSession[]) => {
    setSessions(prev => {
      const have = new Set(prev.map(s => s.id));
      const added = incoming.filter(s => isSession(s) && !have.has(s.id));
      if (added.length === 0) return prev;
      return [...prev, ...added].sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_SESSIONS);
    });
  }, []);

  const removeSessions = useCallback((predicate: (s: GameSession) => boolean) => {
    setSessions(prev => prev.filter(s => !predicate(s)));
  }, []);

  const clearAll = useCallback(() => {
    setSessions([]);
    try {
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { sessions, playerName, setPlayerName, saveSession, updateSession, updateSessions, mergeSessions, removeSessions, clearAll };
}

export type GameStore = ReturnType<typeof useGameStore>;
