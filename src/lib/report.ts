// Links that let players report a mistake in a message: a pre-filled GitHub
// issue, or an email for people without a GitHub account.
import { CHANNELS, LEVELS, channelOf } from '@/types';
import type { Email } from '@/types';

export const REPO_URL = 'https://github.com/thespaceio/LureLens';
export const CONTACT_EMAIL = 'th3officialspaceio@gmail.com';
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

function details(email: Email): string {
  return [
    `Message: ${email.id} (${LEVELS[email.level].label}, ${CHANNELS[channelOf(email)].label})`,
    `Subject: ${email.subject}`,
    `Shown as: ${email.is_phishing ? 'Phishing' : 'Legitimate'}`,
  ].join('\n');
}

export function reportTitle(email: Email): string {
  return `Mistake in ${email.id}: ${email.subject}`.slice(0, 120);
}

export function reportIssueUrl(email: Email): string {
  const body = [
    details(email),
    '',
    "**What's wrong?**",
    '<!-- For example: the real domain is different, a fact is out of date, the answer is wrong, a typo. -->',
    '',
    '',
    '**Source, if you have one** (a link to the official website or announcement):',
    '',
    '',
    '---',
    `Reported from LureLens ${APP_VERSION}`,
  ].join('\n');
  const params = new URLSearchParams({ title: reportTitle(email), body, labels: 'content' });
  return `${REPO_URL}/issues/new?${params.toString()}`;
}

export function reportMailto(email: Email): string {
  const body = [details(email), '', "What's wrong:", '', '', 'Source, if you have one:', '', '', `LureLens ${APP_VERSION}`].join('\n');
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`LureLens: ${reportTitle(email)}`)}&body=${encodeURIComponent(body)}`;
}

/** A general issue link, for the About page. */
export const NEW_ISSUE_URL = `${REPO_URL}/issues/new/choose`;
