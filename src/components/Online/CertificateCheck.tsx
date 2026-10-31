import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import RevealText from '@/components/ui/reveal';
import { BadgeCheck, Loader2, Search, ShieldQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCertificateDate } from '@/lib/certificate';
import { OnlineError, checkCertificate } from '@/lib/online';
import type { CheckedCertificate } from '@/lib/online';
import { LEVELS, LEVEL_ORDER } from '@/types';

type Outcome = { reference: string; cert: CheckedCertificate | null } | { reference: string; error: string };

/** Lets anyone confirm a LureLens certificate from its reference. */
export function CertificateCheck({ initialReference }: { initialReference?: string }) {
  const [input, setInput] = useState(initialReference ?? '');
  const [query, setQuery] = useState(initialReference ?? '');
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    checkCertificate(query)
      .then(cert => !cancelled && setOutcome({ reference: query, cert }))
      .catch(e => !cancelled && setOutcome({ reference: query, error: e instanceof OnlineError ? e.message : 'Could not check right now.' }));
    return () => {
      cancelled = true;
    };
  }, [query]);

  const loading = Boolean(query) && outcome?.reference !== query;
  const submit = () => {
    const ref = input.trim().toUpperCase().replace(/\s+/g, '');
    if (ref === query) return;
    setQuery(ref);
  };

  return (
    <div className="stagger-children mx-auto w-full max-w-2xl space-y-6">
      <div>
        <p className="text-in font-mono text-xs tracking-[0.16em] text-primary">SPACEIO // CERTIFICATES</p>
        <h1 className="mt-1 text-3xl font-bold sm:text-4xl"><RevealText text="Check a certificate" /></h1>
        <p className="text-in mt-1 text-muted-foreground" style={{ '--d': '300ms' } as CSSProperties}>
          Enter the reference printed on a LureLens certificate, such as <span className="font-mono">LL-7K2Q-X9AB</span>.
        </p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={e => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor="cert-ref" className="sr-only">Certificate reference</label>
        <Input
          id="cert-ref"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="LL-XXXX-XXXX"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="h-12 bg-card font-mono text-lg uppercase tracking-[0.1em] placeholder:normal-case placeholder:tracking-normal"
        />
        <Button type="submit" size="lg" className="h-12 gap-2 font-semibold" disabled={!input.trim()}>
          <Search className="size-4" /> Check
        </Button>
      </form>

      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-5 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Checking…
        </div>
      ) : outcome && 'error' in outcome ? (
        <p className="rounded-xl border border-border bg-card p-5 text-muted-foreground" role="alert">{outcome.error}</p>
      ) : outcome && outcome.cert ? (
        <section className="space-y-4 rounded-xl border-2 border-primary bg-card p-5" data-testid="certificate-valid">
          <p className="flex items-center gap-2 font-semibold text-primary">
            <BadgeCheck className="size-5" /> Genuine LureLens certificate
          </p>
          <div>
            <p className="text-2xl font-bold">{outcome.cert.display_name}</p>
            <p className="text-sm text-muted-foreground">
              Played as <strong className="text-foreground">{outcome.cert.player_name}</strong> · completed{' '}
              {formatCertificateDate(outcome.cert.completed_on)} · <span className="font-mono">{outcome.cert.reference}</span>
            </p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-3">
            {LEVEL_ORDER.map(level => {
              const l = outcome.cert!.levels[level];
              return (
                <li key={level} className="rounded-lg border border-border bg-background/50 p-3 text-center">
                  <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{LEVELS[level].label}</div>
                  <div className="text-2xl font-bold text-primary">{l.accuracy}%</div>
                  <div className="text-xs text-muted-foreground">{formatCertificateDate(l.played_at)}</div>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            Each result was scored by the LureLens server from the player's answers. LureLens is self-paced training by Th3
            SpaceIO, not a supervised exam.
          </p>
        </section>
      ) : outcome ? (
        <section className="flex gap-3 rounded-xl border border-destructive/50 bg-card p-5" data-testid="certificate-unknown">
          <ShieldQuestion className="size-6 shrink-0 text-destructive" />
          <div>
            <p className="font-semibold">No certificate found for {outcome.reference}</p>
            <p className="text-sm text-muted-foreground">
              Check the reference for typos. A certificate only appears here once its owner has made it checkable online.
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default CertificateCheck;
