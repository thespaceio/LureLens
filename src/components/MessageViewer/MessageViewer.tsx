import { FileText, UserRound } from 'lucide-react';
import { splitLinks } from '@/lib/game';
import type { PhoneMessage } from '@/types';

interface MessageViewerProps {
  message: PhoneMessage;
  /** Called when a link is hovered, focused or tapped. Links never open. */
  onLinkInspect?: (url: string, clicked: boolean) => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Message text with every link turned into an inspect-only button. */
function MessageText({ text, onLinkInspect, linkClass }: { text: string; onLinkInspect?: MessageViewerProps['onLinkInspect']; linkClass: string }) {
  return (
    <>
      {splitLinks(text).map((part, i) =>
        part.url ? (
          <button
            key={i}
            type="button"
            className={`inline break-all text-left underline underline-offset-2 ${linkClass}`}
            onMouseEnter={() => onLinkInspect?.(part.url!, false)}
            onFocus={() => onLinkInspect?.(part.url!, false)}
            onClick={() => onLinkInspect?.(part.url!, true)}
          >
            {part.text}
          </button>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

export function MessageViewer({ message, onLinkInspect }: MessageViewerProps) {
  const isWhatsApp = message.channel === 'whatsapp';
  const time = formatTime(message.date);
  const initial = (message.sender.name.replace(/^\+/, '').trim()[0] ?? '?').toUpperCase();
  const unknown = isWhatsApp && !message.sender.saved;
  const subline = isWhatsApp
    ? message.sender.saved
      ? message.sender.number ?? 'WhatsApp'
      : 'Not in your contacts'
    : message.sender.number
      ? `Text message · ${message.sender.number}`
      : 'Text message · sender ID';

  return (
    <article
      className="mx-auto w-full max-w-md overflow-hidden rounded-[1.75rem] border-[6px] border-[#2A1A55] bg-white text-[#1E0F45] shadow-2xl shadow-black/40"
      data-testid="message-viewer"
      aria-label={isWhatsApp ? 'WhatsApp chat' : 'Text message'}
    >
      <header className={`flex items-center gap-3 px-4 py-3 ${isWhatsApp ? 'bg-[#0F5C4D] text-white' : 'border-b border-[#DDD6EE] bg-[#F7F5FC]'}`}>
        <div
          className={`grid size-10 shrink-0 place-items-center rounded-full font-bold ${
            isWhatsApp ? 'bg-white/20 text-white' : 'bg-[#DDD6EE] text-[#3B1F7A]'
          }`}
          aria-hidden
        >
          {/^\+?\d/.test(message.sender.name) ? <UserRound className="size-5" /> : initial}
        </div>
        <div className="min-w-0">
          <div className="truncate font-semibold [overflow-wrap:anywhere]">{message.sender.name}</div>
          <div className={`truncate font-mono text-xs ${isWhatsApp ? 'text-white/80' : 'text-[#4A3E6B]'}`}>{subline}</div>
        </div>
        <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${isWhatsApp ? 'bg-white/15 text-white' : 'bg-[#E8E3F5] text-[#3B1F7A]'}`}>
          {isWhatsApp ? 'WhatsApp' : 'SMS'}
        </span>
      </header>

      <div className={`flex min-h-[260px] flex-col gap-2 px-3 py-4 ${isWhatsApp ? 'bg-[#EFE7DD]' : 'bg-white'}`}>
        <span className="mx-auto mb-1 rounded-md bg-[#E8E3F5] px-2.5 py-0.5 text-[11px] font-medium text-[#4A3E6B]">{formatDay(message.date)}</span>
        {unknown && (
          <p className="mx-auto max-w-[85%] rounded-md bg-[#FFF4D6] px-3 py-1.5 text-center text-[12px] text-[#6B4E00]">
            This number is not saved in your contacts.
          </p>
        )}
        {message.messages.map((text, i) => (
          <div
            key={i}
            className={`max-w-[85%] self-start whitespace-pre-line rounded-2xl rounded-tl-md px-3.5 py-2.5 text-[15px] leading-relaxed [overflow-wrap:anywhere] ${
              isWhatsApp ? 'bg-white shadow-sm' : 'bg-[#ECE8F5]'
            }`}
          >
            <MessageText text={text} onLinkInspect={onLinkInspect} linkClass="text-[#1a62d6]" />
            {i === message.messages.length - 1 && message.attachments?.map(name => (
              <span key={name} className="mt-2 flex items-center gap-2 rounded-lg bg-black/5 px-2.5 py-2 font-mono text-xs">
                <FileText className="size-4 shrink-0" />
                {name}
              </span>
            ))}
            <span className="mt-1 block text-right text-[11px] text-[#6B6185]">{time}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

export default MessageViewer;
