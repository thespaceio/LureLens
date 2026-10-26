// The Supabase client, loaded on demand so the game itself starts fast and
// works offline. Used for sign-in, the online functions and live updates.
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from '@/onlineConfig';

export const ONLINE = Boolean(SUPABASE_URL && SUPABASE_KEY);

let client: Promise<SupabaseClient> | null = null;

export function getSupabase(): Promise<SupabaseClient> {
  if (!ONLINE) return Promise.reject(new Error('Online features are not set up.'));
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Picks up the sign-in link from the address bar, on any device.
        detectSessionInUrl: true,
        flowType: 'implicit',
        storageKey: 'lurelens-auth',
      },
    }),
  );
  return client;
}
