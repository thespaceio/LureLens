// Keeps a signed-in player's games in their account (the private `games`
// table), so progress follows them between devices. Only the player can read
// their own history.
import { OnlineError, friendlyError } from '@/lib/online';
import { getSupabase } from '@/lib/supabase';
import type { GameSession } from '@/types';

/** Uploads games to the account. Returns the ids now saved online. */
export async function pushGames(userId: string, games: GameSession[]): Promise<string[]> {
  if (games.length === 0) return [];
  const sb = await getSupabase();
  const saved: string[] = [];
  for (let i = 0; i < games.length; i += 100) {
    const batch = games.slice(i, i + 100);
    const rows = batch.map(g => {
      // Device-only bookkeeping isn't stored online.
      const { synced: _synced, ...data } = g;
      void _synced;
      return { user_id: userId, id: g.id, played_at: g.date, data: { ...data, userId } };
    });
    const { error } = await sb.from('games').upsert(rows, { onConflict: 'user_id,id', ignoreDuplicates: true });
    if (error) throw friendlyError(error, "Couldn't save your games online. They're safe on this device.");
    saved.push(...batch.map(g => g.id));
  }
  return saved;
}

/** Downloads the account's games, newest first. */
export async function pullGames(): Promise<GameSession[]> {
  const sb = await getSupabase();
  const { data, error } = await sb.from('games').select('data').order('played_at', { ascending: false }).limit(2000);
  if (error) throw friendlyError(error, "Couldn't load your games from your account.");
  return (data ?? []).map(row => ({ ...(row.data as GameSession), synced: true }));
}

export { OnlineError };
