import EmailViewer from '@/components/EmailViewer/EmailViewer';
import MessageViewer from '@/components/MessageViewer/MessageViewer';
import type { Mark } from '@/lib/marks';
import type { Email, EmailMessage } from '@/types';

/** The right viewer for an email, text or chat, optionally with its red flags marked. */
export function ReviewViewer({
  email,
  marks,
  onLinkInspect,
}: {
  email: Email;
  marks?: Mark[];
  onLinkInspect?: (url: string, clicked: boolean) => void;
}) {
  return email.channel === 'sms' || email.channel === 'whatsapp' ? (
    <MessageViewer message={email} marks={marks} onLinkInspect={onLinkInspect} />
  ) : (
    <EmailViewer email={email as EmailMessage} marks={marks} onLinkInspect={onLinkInspect} />
  );
}

export default ReviewViewer;
