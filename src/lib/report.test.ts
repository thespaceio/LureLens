import { describe, expect, it } from 'vitest';
import { ALL_EMAILS } from './game';
import { CONTACT_EMAIL, REPO_URL, reportIssueUrl, reportMailto } from './report';

describe('mistake reports', () => {
  const sms = ALL_EMAILS.find(e => e.channel === 'sms')!;

  it('opens a pre-filled GitHub issue naming the message', () => {
    const url = new URL(reportIssueUrl(sms));
    expect(url.href.startsWith(`${REPO_URL}/issues/new?`)).toBe(true);
    expect(url.searchParams.get('title')).toContain(sms.id);
    const body = url.searchParams.get('body')!;
    expect(body).toContain(`Message: ${sms.id}`);
    expect(body).toContain('SMS');
    expect(body).toContain(sms.is_phishing ? 'Shown as: Phishing' : 'Shown as: Legitimate');
    expect(url.searchParams.get('labels')).toBe('content');
  });

  it('keeps every report link short enough for browsers and GitHub', () => {
    for (const e of ALL_EMAILS) expect(reportIssueUrl(e).length).toBeLessThan(4000);
  });

  it('offers an email with the same details', () => {
    const mail = reportMailto(sms);
    expect(mail.startsWith(`mailto:${CONTACT_EMAIL}?subject=`)).toBe(true);
    expect(decodeURIComponent(mail)).toContain(`Message: ${sms.id}`);
  });
});
