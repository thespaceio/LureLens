import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthContext, SIGNED_OUT } from '@/hooks/authContext';
import type { Auth, AuthState, Profile } from '@/hooks/authContext';
import { OnlineError, friendlyError, rpc } from '@/lib/online';
import { ONLINE, getSupabase } from '@/lib/supabase';

// The profile is kept on the device too, so a signed-in player can keep
// playing under their username while offline.
const PROFILE_KEY = 'lurelens_profile_v1';

function cachedProfile(userId: string): Profile | null {
  try {
    const all = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}') as Record<string, Profile>;
    return all[userId] ?? null;
  } catch {
    return null;
  }
}

function cacheProfile(userId: string, profile: Profile | null) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile ? { [userId]: profile } : {}));
  } catch {
    // Storage blocked: the profile is fetched again next time.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(
    ONLINE ? { status: 'loading', userId: null, email: null, anonymous: false, profile: null, profileLoaded: false } : { ...SIGNED_OUT, status: 'off' },
  );

  useEffect(() => {
    if (!ONLINE) return;
    let unsubscribe = () => {};
    let cancelled = false;

    const apply = async (session: Session | null) => {
      if (cancelled) return;
      if (!session) {
        setState(SIGNED_OUT);
        return;
      }
      const userId = session.user.id;
      const cached = cachedProfile(userId);
      setState(s => ({
        status: 'signedIn',
        userId,
        email: session.user.email || null,
        anonymous: Boolean(session.user.is_anonymous),
        profile: s.userId === userId && s.profile ? s.profile : cached,
        profileLoaded: (s.userId === userId && s.profileLoaded) || Boolean(cached),
      }));
      try {
        const sb = await getSupabase();
        const { data, error } = await sb.from('profiles').select('username, full_name, organisation').maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        cacheProfile(userId, data);
        setState(s => (s.userId === userId ? { ...s, profile: data, profileLoaded: true } : s));
      } catch {
        // Offline: keep the cached profile.
        setState(s => (s.userId === userId ? { ...s, profileLoaded: true } : s));
      }
    };

    getSupabase()
      .then(sb => {
        if (cancelled) return;
        const { data } = sb.auth.onAuthStateChange((_event, session) => {
          // Run outside the auth callback, as Supabase recommends.
          setTimeout(() => void apply(session), 0);
        });
        unsubscribe = () => data.subscription.unsubscribe();
      })
      .catch(() => !cancelled && setState(SIGNED_OUT));

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const sendCode = useCallback(async (email: string) => {
    const sb = await getSupabase().catch(() => {
      throw new OnlineError("Couldn't load sign-in. Check your connection and try again.");
    });
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: `${location.origin}${location.pathname}` },
    });
    if (error) {
      if (error.status === 429) throw new OnlineError('Too many codes requested. Wait a minute, then try again.');
      if (/not authori[sz]ed/i.test(error.message)) {
        throw new OnlineError("LureLens can't send email to that address yet. Please try again later.");
      }
      if (/invalid/i.test(error.message)) throw new OnlineError('Check the email address and try again.');
      throw friendlyError(error, "Couldn't send the code. Try again in a moment.");
    }
  }, []);

  const quickJoin = useCallback(async () => {
    const sb = await getSupabase().catch(() => {
      throw new OnlineError("Couldn't load sign-in. Check your connection and try again.");
    });
    const { error } = await sb.auth.signInAnonymously();
    if (error) {
      if (error.status === 429) {
        throw new OnlineError(
          'Too many quick joins from this internet connection right now. Wait a few minutes, switch to mobile data, or sign in with email.',
        );
      }
      if (/disabled|not enabled/i.test(error.message)) throw new OnlineError("Quick join isn't switched on yet. Sign in with email instead.");
      throw friendlyError(error, "Couldn't create a quick-join account. Try again in a moment.");
    }
  }, []);

  const addEmail = useCallback(async (email: string) => {
    const sb = await getSupabase();
    const { error } = await sb.auth.updateUser({ email: email.trim() }, { emailRedirectTo: `${location.origin}${location.pathname}` });
    if (error) {
      if (error.status === 429) throw new OnlineError('Too many codes requested. Wait a minute, then try again.');
      if (/already|registered|exists/i.test(error.message)) throw new OnlineError('That email already has a LureLens account. Sign in with it instead.');
      if (/not authori[sz]ed/i.test(error.message)) throw new OnlineError("LureLens can't send email to that address yet. Please try again later.");
      throw friendlyError(error, "Couldn't send the code. Try again in a moment.");
    }
  }, []);

  const confirmEmail = useCallback(async (email: string, code: string) => {
    const sb = await getSupabase();
    const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.replace(/\D/g, ''), type: 'email_change' });
    if (error) throw new OnlineError('That code is wrong or has expired. Check it, or ask for a new one.');
    // Pick up the confirmed email.
    const { data } = await sb.auth.getUser();
    setState(s => ({ ...s, email: data.user?.email ?? s.email, anonymous: Boolean(data.user?.is_anonymous) }));
  }, []);

  const verifyCode = useCallback(async (email: string, code: string) => {
    const sb = await getSupabase();
    const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.replace(/\D/g, ''), type: 'email' });
    if (error) {
      if (error.status === 429) throw new OnlineError('Too many tries. Wait a minute, then try again.');
      throw new OnlineError('That code is wrong or has expired. Check it, or ask for a new one.');
    }
  }, []);

  const saveProfile = useCallback(
    async (profile: Profile) => {
      const saved = await rpc<Profile>('save_profile', {
        p_username: profile.username,
        p_full_name: profile.full_name,
        p_organisation: profile.organisation,
      });
      if (state.userId) cacheProfile(state.userId, saved);
      setState(s => ({ ...s, profile: saved, profileLoaded: true }));
      return saved;
    },
    [state.userId],
  );

  const signOut = useCallback(async () => {
    try {
      const sb = await getSupabase();
      await sb.auth.signOut({ scope: 'local' });
    } finally {
      cacheProfile('', null);
      setState(SIGNED_OUT);
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    await rpc<boolean>('delete_my_account', {});
    await signOut();
  }, [signOut]);

  const value = useMemo<Auth>(
    () => ({ ...state, sendCode, quickJoin, addEmail, confirmEmail, verifyCode, saveProfile, signOut, deleteAccount }),
    [state, sendCode, quickJoin, addEmail, confirmEmail, verifyCode, saveProfile, signOut, deleteAccount],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
