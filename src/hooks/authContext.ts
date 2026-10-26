// Sign-in state shared across the app. The provider is in
// src/components/Account/AuthProvider.tsx.
import { createContext, useContext } from 'react';

export interface Profile {
  username: string;
  full_name: string | null;
  organisation: string | null;
}

export interface AuthState {
  /** 'off' when online features aren't set up. */
  status: 'off' | 'loading' | 'signedOut' | 'signedIn';
  userId: string | null;
  email: string | null;
  /** Null when signed in but no username chosen yet. */
  profile: Profile | null;
  profileLoaded: boolean;
}

export interface Auth extends AuthState {
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  saveProfile: (profile: Profile) => Promise<Profile>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const noop = async () => {
  throw new Error('Online features are not set up.');
};

export const SIGNED_OUT: AuthState = { status: 'signedOut', userId: null, email: null, profile: null, profileLoaded: true };

export const AuthContext = createContext<Auth>({
  status: 'off',
  userId: null,
  email: null,
  profile: null,
  profileLoaded: true,
  sendCode: noop,
  verifyCode: noop,
  saveProfile: noop,
  signOut: noop,
  deleteAccount: noop,
});

export const useAuth = () => useContext(AuthContext);

/** Signed in and ready to play under a username. */
export const isReady = (auth: AuthState) => auth.status === 'signedIn' && Boolean(auth.profile);
