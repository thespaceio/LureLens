import { useEffect, useMemo, useRef } from 'react';
import DOMPurify from 'dompurify';
import { Paperclip } from 'lucide-react';
import Marked from '@/components/Marks/Marked';
import { cutPieces, markElement, placeMarks, textOf } from '@/lib/marks';
import type { Mark, Placed } from '@/lib/marks';
import type { EmailMessage } from '@/types';

interface EmailViewerProps {
  email: EmailMessage;
  /** Called when a link is hovered, focused or clicked. Links never open. */
  onLinkInspect?: (url: string, clicked: boolean) => void;
  /** Outline every link (used when reviewing an email after answering). */
  highlightLinks?: boolean;
  /** Red flags or reasons to trust, marked on the email after answering. */
  marks?: Mark[];
}

const EMAIL_STYLES = `
  :host { all: initial; display: block; }
  .mail { font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #222;
          padding: 20px; overflow-wrap: anywhere; }
  .mail img, .mail table { max-width: 100%; }
  .mail a[data-href] { cursor: pointer; }
  .mail a[data-href]:focus { outline: 2px solid #1a62d6; outline-offset: 2px; }
  .mail.highlight a[data-href] { outline: 2px dashed #e5484d; outline-offset: 3px; }
  ${'' /* Keep in step with the .lure-* rules in index.css. */}
  .lure-mark { color: #1e0f45; background: #ffe1e2; box-shadow: inset 0 -2px 0 #c4343a;
               border-radius: 3px; padding: 0 2px; -webkit-box-decoration-break: clone; box-decoration-break: clone;
               scroll-margin: 96px; }
  .lure-trust { background: #e4f5bd; box-shadow: inset 0 -2px 0 #3f6b00; }
  .lure-num { margin-right: 0.3em; padding: 0.05em 0.42em; border-radius: 999px; background: #c4343a; color: #fff;
              font: 700 0.72em/1 Arial, Helvetica, sans-serif; vertical-align: 0.15em; text-decoration: none; }
  .lure-trust .lure-num { background: #3f6b00; }
  .lure-pulse { animation: lure-pulse 1.2s ease-out 1; }
  @keyframes lure-pulse { 0%, 60% { outline: 3px solid #7b5cff; outline-offset: 3px; } 100% { outline: 3px solid transparent; outline-offset: 3px; } }
  @media (prefers-reduced-motion: reduce) { .lure-pulse { animation: none; outline: 3px solid #7b5cff; outline-offset: 3px; } }
`;

/**
 * Sanitise the HTML and neutralise every link: the real URL moves to
 * data-href so nothing in a training email can ever be opened.
 */
function prepareBody(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'div', 'p', 'span', 'a', 'img', 'table', 'tr', 'td', 'th', 'tbody', 'thead',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'hr', 'ul', 'ol', 'li', 'strong',
      'em', 'b', 'i', 'u', 's', 'blockquote', 'pre', 'code', 'center', 'font',
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'style', 'width', 'height', 'border',
      'cellpadding', 'cellspacing', 'align', 'valign', 'bgcolor', 'color',
    ],
  });
  const doc = new DOMParser().parseFromString(`<div>${clean}</div>`, 'text/html');
  // Never load remote images: they would leak plays to third parties and break offline.
  doc.querySelectorAll('img').forEach(img => {
    if (!(img.getAttribute('src') ?? '').startsWith('data:image/')) img.remove();
  });
  doc.querySelectorAll('a').forEach(a => {
    const href = a.getAttribute('href') ?? '';
    a.removeAttribute('href');
    if (href && href !== '#') {
      a.setAttribute('data-href', href);
      a.setAttribute('tabindex', '0');
      a.setAttribute('role', 'link');
    }
  });
  return doc.body.firstElementChild?.innerHTML ?? '';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  });
}

/** Fields in reading order, for placing marks: subject, sender name and address, reply-to, body, attachments. */
const BODY = 4;

export function EmailViewer({ email, onLinkInspect, highlightLinks = false, marks }: EmailViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const inspectRef = useRef(onLinkInspect);
  const prepared = useMemo(() => prepareBody(email.body), [email.body]);
  const { body, placed } = useMemo((): { body: string; placed: Placed[][] | null } => {
    if (!marks?.length) return { body: prepared, placed: null };
    const root = new DOMParser().parseFromString(`<div>${prepared}</div>`, 'text/html').body.firstElementChild;
    if (!root) return { body: prepared, placed: null };
    const fields = [email.subject, email.sender.name, email.sender.email, email.reply_to ?? '', textOf(root), ...(email.attachments ?? [])];
    const placed = placeMarks(fields, marks);
    markElement(root, placed[BODY]);
    return { body: root.innerHTML, placed };
  }, [prepared, marks, email.subject, email.sender.name, email.sender.email, email.reply_to, email.attachments]);
  const show = (text: string, field: number) => (placed ? <Marked pieces={cutPieces(text, placed[field])} /> : text);

  useEffect(() => {
    inspectRef.current = onLinkInspect;
  });

  // Render the email inside a shadow root so its inline styles and the app's
  // styles never affect each other.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    root.innerHTML =
      `<style>${EMAIL_STYLES}</style>` +
      `<div class="mail${highlightLinks ? ' highlight' : ''}">${body}</div>`;
  }, [body, highlightLinks]);

  useEffect(() => {
    const root = hostRef.current?.shadowRoot;
    if (!root) return;
    const linkFrom = (e: Event) => (e.target as Element | null)?.closest?.('a[data-href]') ?? null;
    const onOver = (e: Event) => {
      const a = linkFrom(e);
      if (a) inspectRef.current?.(a.getAttribute('data-href') ?? '', false);
    };
    const onClick = (e: Event) => {
      const a = linkFrom(e);
      if (!a) return;
      e.preventDefault();
      inspectRef.current?.(a.getAttribute('data-href') ?? '', true);
    };
    const onKey = (e: Event) => {
      const k = e as KeyboardEvent;
      if (k.key === 'Enter' && linkFrom(e)) onClick(e);
    };
    root.addEventListener('mouseover', onOver);
    root.addEventListener('focusin', onOver);
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKey);
    return () => {
      root.removeEventListener('mouseover', onOver);
      root.removeEventListener('focusin', onOver);
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKey);
    };
  }, [body]);

  const initial = (email.sender.name.trim()[0] ?? '?').toUpperCase();

  return (
    <article className="overflow-hidden rounded-xl bg-[#F7F5FC] text-[#1E0F45] shadow-2xl shadow-black/40">
      <div className="flex items-center gap-1.5 border-b border-[#DDD6EE] bg-[#E8E3F5] px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-[#C4B8E0]" />
        <span className="size-2.5 rounded-full bg-[#C4B8E0]" />
        <span className="size-2.5 rounded-full bg-[#C4B8E0]" />
        <span className="ml-2 truncate font-mono text-xs text-[#4A3E6B]">Inbox · ada.okafor@brightpath.ng</span>
      </div>

      <header className="border-b border-[#DDD6EE] px-4 py-4 sm:px-6">
        <h2 className="mb-3 text-lg font-semibold leading-snug [overflow-wrap:anywhere] sm:text-xl">
          {show(email.subject, 0)}
        </h2>
        <div className="flex items-start gap-3">
          <div className="hidden size-10 shrink-0 place-items-center rounded-full bg-[#DDD6EE] font-bold text-[#3B1F7A] sm:grid">
            {initial}
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <div className="[overflow-wrap:anywhere]">
              <strong>{show(email.sender.name, 1)}</strong>{' '}
              <span className="font-mono text-[13px] text-[#4A3E6B]">&lt;{show(email.sender.email, 2)}&gt;</span>
            </div>
            {email.reply_to && (
              <div className="font-mono text-[13px] text-[#9A5B00] [overflow-wrap:anywhere]">
                reply-to &lt;{show(email.reply_to, 3)}&gt;
              </div>
            )}
            <div className="font-mono text-[13px] text-[#4A3E6B]">to me &lt;ada.okafor@brightpath.ng&gt;</div>
          </div>
          <time className="hidden shrink-0 text-xs text-[#4A3E6B] sm:block" dateTime={email.date}>
            {formatDate(email.date)}
          </time>
        </div>
      </header>

      <div ref={hostRef} className="min-h-[160px] bg-white" data-testid="email-body" />

      {email.attachments && email.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-[#DDD6EE] bg-white px-4 py-3 sm:px-6">
          {email.attachments.map((name, i) => (
            <span
              key={name}
              className="inline-flex items-center gap-2 rounded-md border border-[#DDD6EE] bg-[#F7F5FC] px-3 py-1.5 font-mono text-xs [overflow-wrap:anywhere]"
            >
              <Paperclip className="size-3.5 shrink-0" />
              <span>{show(name, BODY + 1 + i)}</span>
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

export default EmailViewer;
