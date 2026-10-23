import { Flag } from 'lucide-react';
import { reportIssueUrl, reportMailto } from '@/lib/report';
import type { Email } from '@/types';

/** "Something wrong with this message?" with a GitHub issue and an email option. */
export function ReportMistake({ email }: { email: Email }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground" data-testid="report-mistake">
      <Flag className="size-3.5 shrink-0" aria-hidden />
      <span>Something wrong with this message?</span>
      <a
        href={reportIssueUrl(email)}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-lavender underline underline-offset-2 hover:text-foreground"
      >
        Report it on GitHub
      </a>
      <span aria-hidden>·</span>
      <a href={reportMailto(email)} className="font-medium text-lavender underline underline-offset-2 hover:text-foreground">
        Email us
      </a>
    </p>
  );
}

export default ReportMistake;
