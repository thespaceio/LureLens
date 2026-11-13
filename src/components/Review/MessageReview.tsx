import { useMemo, useRef, useState } from 'react';
import Explanation from '@/components/Explanation/Explanation';
import LinkStatus from '@/components/LinkStatus/LinkStatus';
import type { InspectedLink } from '@/components/LinkStatus/LinkStatus';
import ReviewViewer from '@/components/Review/ReviewViewer';
import VerifyTip from '@/components/Review/VerifyTip';
import { marksFor, showMark } from '@/lib/marks';
import { CHANNELS, channelOf } from '@/types';
import type { Choice, Email } from '@/types';

/** A message from a finished round, with its red flags marked and explained. */
export function MessageReview({ email, choice }: { email: Email; choice?: Choice }) {
  const scope = useRef<HTMLDivElement>(null);
  const marks = useMemo(() => marksFor(email), [email]);
  const [link, setLink] = useState<InspectedLink | null>(null);
  return (
    <div ref={scope} className="space-y-4" data-testid="message-review">
      <div>
        <ReviewViewer email={email} marks={marks} onLinkInspect={(url, clicked) => setLink({ url, clicked })} />
        <LinkStatus link={link} noun={CHANNELS[channelOf(email)].noun} />
      </div>
      <VerifyTip email={email} choice={choice} />
      <Explanation email={email} onShow={n => showMark(scope.current, n)} />
    </div>
  );
}

export default MessageReview;
