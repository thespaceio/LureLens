import { useMemo, useState } from 'react';
import { ArrowLeft, BadgeCheck, Cloud, Globe, Loader2, LogOut, Mail, Trash2, Trophy, UserRound, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/authContext';
import type { Profile } from '@/hooks/authContext';
import { OnlineError } from '@/lib/online';
import type { GameSession } from '@/types';

interface AccountProps {
  sessions: GameSession[];
  /** Adds this device's guest games (by id) to the account. */
  onClaim: (ids: string[]) => void;
  onPrivacy: () => void;
  /** Where to go after signing in, if the player came from somewhere specific. */
  returnLabel?: string;
  onReturn?: () => void;
}

const message = (e: unknown) => (e instanceof OnlineError ? e.message : e instanceof Error ? e.message : 'Something went wrong. Try again.');

export function Account({ sessions, onClaim, onPrivacy, returnLabel, onReturn }: AccountProps) {
  const auth = useAuth();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6" data-testid="account">
      <div>
        <p className="font-mono text-xs tracking-[0.16em] text-primary">SPACEIO // ACCOUNT</p>
        <h1 className="mt-1 text-3xl font-bold sm:text-4xl">
          {auth.status === 'signedIn' && auth.profile ? auth.profile.username : 'Your LureLens account'}
        </h1>
      </div>

      {auth.status === 'loading' || (auth.status === 'signedIn' && !auth.profileLoaded) ? (
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </p>
      ) : auth.status === 'signedIn' && !auth.profile ? (
        <ProfileForm firstTime onPrivacy={onPrivacy} />
      ) : auth.status === 'signedIn' ? (
        <SignedIn sessions={sessions} onClaim={onClaim} onPrivacy={onPrivacy} returnLabel={returnLabel} onReturn={onReturn} />
      ) : (
        <SignIn onPrivacy={onPrivacy} />
      )}
    </div>
  );
}

function SignIn({ onPrivacy }: { onPrivacy: () => void }) {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resendAt, setResendAt] = useState(0);

  const send = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await auth.sendCode(email);
      setSentTo(email.trim());
      setCode('');
      setResendAt(Date.now() + 60_000);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!sentTo) return;
    setBusy(true);
    setError('');
    try {
      await auth.verifyCode(sentTo, code);
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  };

  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2">
        {[
          [UserRound, 'Reserve your username', 'Nobody else can post under your name.'],
          [Trophy, 'Post to the online scoreboard', 'See how you rank against everyone, live.'],
          [Cloud, 'Your progress on every device', 'Play on your phone, carry on on a laptop.'],
          [BadgeCheck, 'Checkable certificates', 'Tied to your account, with your full name.'],
        ].map(([Icon, title, text]) => {
          const I = Icon as typeof UserRound;
          return (
            <li key={title as string} className="flex gap-3 rounded-xl border border-border bg-card p-4">
              <I className="mt-0.5 size-5 shrink-0 text-lavender" aria-hidden />
              <div className="text-sm">
                <div className="font-semibold">{title as string}</div>
                <div className="text-muted-foreground">{text as string}</div>
              </div>
            </li>
          );
        })}
      </ul>

      <section className="space-y-4 rounded-xl border border-border bg-card p-5" aria-labelledby="signin-heading">
        <h2 id="signin-heading" className="flex items-center gap-2 text-lg font-semibold">
          <Mail className="size-5 text-primary" /> {sentTo ? 'Enter your code' : 'Sign in or create an account'}
        </h2>

        {!sentTo ? (
          <form
            className="space-y-3"
            onSubmit={e => {
              e.preventDefault();
              void send();
            }}
          >
            <div className="space-y-1.5">
              <label htmlFor="signin-email" className="text-sm text-muted-foreground">Email address</label>
              <Input
                id="signin-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder="you@example.com"
                className="h-12 bg-background text-base"
              />
            </div>
            <Button type="submit" size="lg" className="h-12 w-full gap-2 font-semibold" disabled={busy} data-testid="send-code">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} Email me a sign-in code
            </Button>
            <p className="text-xs text-muted-foreground">
              No password needed. We email you a 6-digit code. By continuing you agree to the{' '}
              <button type="button" onClick={onPrivacy} className="text-lavender underline underline-offset-2 hover:text-foreground">
                privacy notice
              </button>
              .
            </p>
          </form>
        ) : (
          <form
            className="space-y-3"
            onSubmit={e => {
              e.preventDefault();
              void verify();
            }}
          >
            <p className="text-sm text-muted-foreground">
              We sent a code to <strong className="text-foreground">{sentTo}</strong>. It can take a minute; check your spam
              folder too. You can also tap the link in the email if you open it on this device.
            </p>
            <div className="space-y-1.5">
              <label htmlFor="signin-code" className="text-sm text-muted-foreground">6-digit code</label>
              <Input
                id="signin-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={10}
                value={code}
                onChange={e => {
                  setCode(e.target.value.replace(/[^\d]/g, ''));
                  setError('');
                }}
                placeholder="123456"
                className="h-12 bg-background font-mono text-2xl tracking-[0.4em]"
                autoFocus
              />
            </div>
            <Button type="submit" size="lg" className="h-12 w-full gap-2 font-semibold" disabled={busy || code.length < 6} data-testid="verify-code">
              {busy ? <Loader2 className="size-4 animate-spin" /> : null} Sign in
            </Button>
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <button type="button" className="text-lavender underline underline-offset-2" onClick={() => setSentTo(null)}>
                Use a different email
              </button>
              <button
                type="button"
                className="text-lavender underline underline-offset-2 disabled:no-underline disabled:opacity-50"
                disabled={busy || Date.now() < resendAt}
                onClick={() => void send()}
              >
                Send a new code
              </button>
            </div>
          </form>
        )}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </section>
      <QuickJoin onPrivacy={onPrivacy} />

      <p className="text-sm text-muted-foreground">
        You can always play without an account. Your scores then stay on this device.
      </p>
    </>
  );
}

/** Join with just a username: an account without an email, for classes and events. */
function QuickJoin({ onPrivacy }: { onPrivacy: () => void }) {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const join = async () => {
    setBusy(true);
    setError('');
    try {
      await auth.quickJoin();
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-lavender/40 bg-card p-5" aria-labelledby="quick-join-heading" data-testid="quick-join">
      <h2 id="quick-join-heading" className="flex items-center gap-2 text-lg font-semibold">
        <Zap className="size-5 text-lavender" /> Quick join, no email
      </h2>
      <p className="text-sm text-muted-foreground">
        In a class or at an event? Pick a username and post to the live scoreboard straight away. The account lives only on
        this device; you can add your email later to keep it.
      </p>
      <Button size="lg" variant="secondary" className="h-12 w-full gap-2 font-semibold" onClick={() => void join()} disabled={busy} data-testid="quick-join-button">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />} Quick join with a username
      </Button>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        By continuing you agree to the{' '}
        <button type="button" onClick={onPrivacy} className="text-lavender underline underline-offset-2 hover:text-foreground">
          privacy notice
        </button>
        .
      </p>
    </section>
  );
}

/** Quick-join accounts: add an email (with a code) to keep the account and use it on other devices. */
function AddEmail() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  if (done || !auth.anonymous) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-primary/50 bg-card p-4 text-sm">
        <BadgeCheck className="size-4 text-primary" /> Email added. You can now sign in with it on any device.
      </p>
    );
  }

  return (
    <section className="space-y-3 rounded-xl border border-lavender/50 bg-card p-5 text-sm" data-testid="add-email">
      <h2 className="flex items-center gap-2 font-semibold">
        <Zap className="size-4 text-lavender" /> Quick-join account
      </h2>
      <p className="text-muted-foreground">
        This account lives only on this device. Add your email to keep it if you change phones or clear your browser, and to
        sign in on other devices.
      </p>
      {!sentTo ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={e => {
            e.preventDefault();
            void run(async () => {
              await auth.addEmail(email);
              setSentTo(email.trim());
            });
          }}
        >
          <label htmlFor="add-email" className="sr-only">Email address</label>
          <Input id="add-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="h-11 min-w-0 flex-1 bg-background" />
          <Button type="submit" disabled={busy || !/^\S+@\S+\.\S+$/.test(email.trim())}>
            {busy && <Loader2 className="size-4 animate-spin" />} Send code
          </Button>
        </form>
      ) : (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={e => {
            e.preventDefault();
            void run(async () => {
              await auth.confirmEmail(sentTo, code);
              setDone(true);
            });
          }}
        >
          <label htmlFor="add-email-code" className="sr-only">Code from the email</label>
          <Input id="add-email-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value.replace(/[^\d]/g, ''))} placeholder="123456" className="h-11 w-40 bg-background font-mono tracking-[0.3em]" />
          <Button type="submit" disabled={busy || code.length < 6}>
            {busy && <Loader2 className="size-4 animate-spin" />} Confirm
          </Button>
          <button type="button" className="text-lavender underline underline-offset-2" onClick={() => setSentTo(null)}>
            Different email
          </button>
        </form>
      )}
      {error && (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function ProfileForm({ firstTime = false, onDone, onPrivacy }: { firstTime?: boolean; onDone?: () => void; onPrivacy: () => void }) {
  const auth = useAuth();
  const [form, setForm] = useState<Profile>(auth.profile ?? { username: '', full_name: '', organisation: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await auth.saveProfile({
        username: form.username.trim(),
        full_name: form.full_name?.trim() || null,
        organisation: form.organisation?.trim() || null,
      });
      onDone?.();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof Profile, label: string, hint: string, max: number, required = false) => (
    <div className="space-y-1.5">
      <label htmlFor={`profile-${key}`} className="text-sm font-medium">
        {label} {!required && <span className="font-normal text-muted-foreground">(optional)</span>}
      </label>
      <Input
        id={`profile-${key}`}
        value={form[key] ?? ''}
        maxLength={max}
        onChange={e => {
          setForm(f => ({ ...f, [key]: e.target.value }));
          setError('');
        }}
        className="h-11 bg-background"
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );

  return (
    <form
      className="space-y-4 rounded-xl border border-border bg-card p-5"
      data-testid="profile-form"
      onSubmit={e => {
        e.preventDefault();
        void save();
      }}
    >
      <h2 className="text-lg font-semibold">{firstTime ? 'Choose your username' : 'Edit your profile'}</h2>
      {firstTime && (
        <p className="text-sm text-muted-foreground">
          {auth.anonymous ? 'Quick join: choose the name the scoreboard will show.' : `Signed in as ${auth.email}. One more step.`}
        </p>
      )}
      {field('username', 'Username', 'Public: shown on the scoreboard. Letters from any language are fine.', 24, true)}
      {field('full_name', 'Full name', 'Private: only printed on your certificate and its check page.', 48)}
      {field('organisation', 'School or organisation', 'Private for now. Helps us plan school and team boards.', 80)}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" className="gap-2 font-semibold" disabled={busy || form.username.trim().length < 2} data-testid="save-profile">
          {busy && <Loader2 className="size-4 animate-spin" />} {firstTime ? 'Save and continue' : 'Save changes'}
        </Button>
        {onDone && (
          <Button type="button" variant="outline" className="bg-transparent" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        See what we keep and why in the{' '}
        <button type="button" onClick={onPrivacy} className="text-lavender underline underline-offset-2 hover:text-foreground">
          privacy notice
        </button>
        .
      </p>
    </form>
  );
}

function SignedIn({ sessions, onClaim, onPrivacy, returnLabel, onReturn }: Omit<AccountProps, never>) {
  const auth = useAuth();
  const profile = auth.profile!;
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Remember a quick-join start, so the "Email added" note stays after the account gets its email.
  const [quickJoined] = useState(auth.anonymous);

  const mine = sessions.filter(s => s.userId === auth.userId);
  const pending = mine.filter(s => !s.synced).length;
  // Games played on this device without an account, grouped by player name.
  const guests = useMemo(() => {
    const by = new Map<string, GameSession[]>();
    for (const s of sessions.filter(s => !s.userId)) {
      const key = s.name.trim();
      by.set(key, [...(by.get(key) ?? []), s]);
    }
    return [...by.entries()];
  }, [sessions]);
  const [chosen, setChosen] = useState<Set<string>>(
    () => new Set(guests.filter(([n]) => n.toLowerCase() === profile.username.toLowerCase()).map(([n]) => n)),
  );

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      await auth.deleteAccount();
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  };

  return (
    <>
      {onReturn && returnLabel && (
        <Button onClick={onReturn} className="gap-2 font-semibold" data-testid="account-return">
          <ArrowLeft className="size-4" /> {returnLabel}
        </Button>
      )}

      {editing ? (
        <ProfileForm onDone={() => setEditing(false)} onPrivacy={onPrivacy} />
      ) : (
        <section className="space-y-3 rounded-xl border border-border bg-card p-5" data-testid="profile-card">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {[
              ['Username (public)', profile.username],
              ['Email (private)', auth.email ?? (auth.anonymous ? 'None (quick join)' : '')],
              ['Full name for certificates (private)', profile.full_name || 'Not set'],
              ['School or organisation (private)', profile.organisation || 'Not set'],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="font-medium [overflow-wrap:anywhere]">{value}</dd>
              </div>
            ))}
          </dl>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit profile
          </Button>
        </section>
      )}

      {(auth.anonymous || quickJoined) && <AddEmail />}

      <section className="space-y-2 rounded-xl border border-border bg-card p-5 text-sm" data-testid="sync-card">
        <h2 className="flex items-center gap-2 font-semibold">
          <Cloud className="size-4 text-lavender" /> Your games
        </h2>
        <p className="text-muted-foreground">
          {mine.length} game{mine.length === 1 ? '' : 's'} in your account
          {pending ? `, ${pending} waiting to sync (they upload when you're online)` : ', all synced'}.
          {auth.anonymous ? ' Add your email above to carry on on another device.' : ' Sign in on another device to carry on there.'}
        </p>
        <p className="flex items-center gap-2 text-muted-foreground">
          <Globe className="size-4" /> Games only appear on the online scoreboard when you tap "Post" after a game.
        </p>
      </section>

      {guests.length > 0 && (
        <section className="space-y-3 rounded-xl border border-lavender/50 bg-card p-5 text-sm" data-testid="claim-card">
          <h2 className="font-semibold">Add this device's games to your account?</h2>
          <p className="text-muted-foreground">
            These were played here without signing in. Pick the ones that are yours; they'll move to {profile.username}.
          </p>
          <ul className="space-y-2">
            {guests.map(([name, games]) => (
              <li key={name}>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-[hsl(var(--primary))]"
                    checked={chosen.has(name)}
                    onChange={e =>
                      setChosen(prev => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(name);
                        else next.delete(name);
                        return next;
                      })
                    }
                  />
                  <span>
                    <strong>{name}</strong> · {games.length} game{games.length === 1 ? '' : 's'}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <Button
            disabled={chosen.size === 0}
            onClick={() => onClaim(guests.filter(([n]) => chosen.has(n)).flatMap(([, g]) => g.map(s => s.id)))}
            data-testid="claim-games"
          >
            Add to my account
          </Button>
        </section>
      )}

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-5 text-sm">
        <p className="text-muted-foreground">
          {auth.anonymous
            ? "Quick-join accounts can't be signed back into. If you sign out without adding an email, this account is gone (your posted scores stay on the board)."
            : 'Signing out removes your games from this device. They stay in your account.'}
        </p>
        <Button
          variant="outline"
          className="gap-2 bg-transparent"
          onClick={() => {
            if (auth.anonymous && !window.confirm("Sign out of this quick-join account? You won't be able to sign back in to it.")) return;
            void auth.signOut();
          }}
          data-testid="sign-out"
        >
          <LogOut className="size-4" /> Sign out
        </Button>
      </section>

      <section className="space-y-3 rounded-xl border border-destructive/40 bg-card p-5 text-sm">
        {deleting ? (
          <>
            <p>
              This deletes your account, profile, game history, online scores and certificates for good. Type{' '}
              <strong>DELETE</strong> to confirm.
            </p>
            <Input value={confirm} onChange={e => setConfirm(e.target.value)} className="h-11 max-w-xs bg-background" aria-label="Type DELETE to confirm" />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2 border-destructive/60 bg-transparent text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={confirm !== 'DELETE' || busy}
                onClick={() => void remove()}
                data-testid="confirm-delete"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Delete my account
              </Button>
              <Button variant="ghost" onClick={() => setDeleting(false)}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground">Delete your account and everything stored with it.</p>
            <Button variant="ghost" className="gap-2 text-destructive hover:text-destructive" onClick={() => setDeleting(true)}>
              <Trash2 className="size-4" /> Delete account
            </Button>
          </div>
        )}
        {error && (
          <p className="text-destructive" role="alert">
            {error}
          </p>
        )}
      </section>

      <p className="text-center text-xs text-muted-foreground">
        <button type="button" onClick={onPrivacy} className="text-lavender underline underline-offset-2 hover:text-foreground">
          Privacy notice
        </button>
      </p>
    </>
  );
}

export default Account;
