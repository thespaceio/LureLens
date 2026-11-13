import { describe, expect, it } from 'vitest';
import { ALL_EMAILS } from './game';
import { cutPieces, locate, marksFor, placeMarks, reviewItems } from './marks';
import type { Email, EmailMessage } from '@/types';

/** The message's text fields in the order the viewers place marks. Body text as the browser joins it. */
function fieldsOf(e: Email): string[] {
  if (e.channel === 'sms' || e.channel === 'whatsapp') {
    const unknown = e.channel === 'whatsapp' && !e.sender.saved ? 'This number is not saved in your contacts.' : '';
    return [e.sender.name, e.sender.number ?? '', unknown, ...e.messages, ...(e.attachments ?? [])];
  }
  const m = e as EmailMessage;
  const body = m.body.replace(/<[^>]*>/g, '');
  return [m.subject, m.sender.name, m.sender.email, m.reply_to ?? '', body, ...(m.attachments ?? [])];
}

describe('locate', () => {
  it('finds text ignoring differences in spacing', () => {
    expect(locate('Pay  now\nplease', 'now please')).toEqual([5, 15]);
    expect(locate('abc', 'x')).toBeNull();
    expect(locate('a b a b', 'a b', 1)).toEqual([4, 7]);
  });
});

describe('cutPieces', () => {
  it('splits text around marks and numbers only the first piece', () => {
    const mark = { n: 1, text: 'cd', tone: 'flag' as const };
    expect(cutPieces('abcdef', [{ mark, start: 2, end: 4 }])).toEqual([
      { text: 'ab' },
      { text: 'cd', mark, first: true },
      { text: 'ef' },
    ]);
    // A mark that started in an earlier piece of the same field.
    expect(cutPieces('def', [{ mark, start: 2, end: 4 }], 3)).toEqual([{ text: 'd', mark, first: false }, { text: 'ef' }]);
  });
});

describe('every red flag and trust sign that names a spot', () => {
  it.each(ALL_EMAILS.map(e => [e.id, e] as const))('%s: marks all land on the message, without overlapping', (_id, e) => {
    const marks = marksFor(e);
    const placed = placeMarks(fieldsOf(e), marks).flat();
    const missing = marks.filter(m => !placed.some(p => p.mark === m)).map(m => m.text);
    expect(missing).toEqual([]);
  });

  it('numbers items 1, 2, 3 in order, skipping ones without a spot', () => {
    for (const e of ALL_EMAILS) {
      const ns = reviewItems(e).flatMap(i => (i.n ? [i.n] : []));
      expect(ns).toEqual(ns.map((_, i) => i + 1));
    }
  });

  it('marks most items, so the review is useful', () => {
    const items = ALL_EMAILS.flatMap(reviewItems);
    expect(items.filter(i => i.n).length / items.length).toBeGreaterThan(0.85);
  });
});
