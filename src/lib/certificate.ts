// The LureLens certificate: earned by scoring at least 80% on all three levels
// in full rounds (ranked or classroom, not single-topic practice). It is drawn
// in the browser, so it works offline and nothing is sent anywhere.
import { DAYLIGHT_MARK, SITE_URL, drawMark, fit, fontsReady } from '@/lib/shareCard';
import { playerSessions } from '@/lib/stats';
import { LEVELS, LEVEL_ORDER } from '@/types';
import type { GameSession, Level } from '@/types';

export const CERTIFICATE_ACCURACY = 80;

export interface LevelProgress {
  /** Best full round at this level (highest accuracy, then score), if any. */
  best: GameSession | null;
  /** First full round at this level that reached the bar. */
  passedWith: GameSession | null;
}

export interface CertificateProgress {
  levels: Record<Level, LevelProgress>;
  earned: boolean;
  /** When the last level was passed: the certificate's date. */
  earnedOn: string | null;
  /** A short reference made from the qualifying games, e.g. LL-7K2Q-X9AB. */
  reference: string | null;
}

/** Full mixed rounds count; rounds filtered to one topic or channel do not. */
export const countsForCertificate = (s: GameSession) => !s.practice || Boolean(s.classCode);

export function certificateProgress(sessions: GameSession[], name: string): CertificateProgress {
  const games = name.trim() ? playerSessions(sessions, name).filter(countsForCertificate) : [];
  const levels = {} as Record<Level, LevelProgress>;
  for (const level of LEVEL_ORDER) {
    const at = games.filter(s => s.level === level);
    const best = at.slice().sort((a, b) => b.accuracy - a.accuracy || b.score - a.score)[0] ?? null;
    const passedWith =
      at
        .filter(s => s.accuracy >= CERTIFICATE_ACCURACY)
        .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
    levels[level] = { best, passedWith };
  }
  const passed = LEVEL_ORDER.map(l => levels[l].passedWith);
  const earned = passed.every(Boolean);
  const earnedOn = earned ? passed.map(s => s!.date).sort().at(-1)! : null;
  return { levels, earned, earnedOn, reference: earned ? reference(name, passed.map(s => s!.id)) : null };
}

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function reference(name: string, ids: string[]): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (const ch of `${name.trim().toLowerCase()}|${ids.join('|')}`) {
    const c = ch.charCodeAt(0);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  const chars = (n: number) => Array.from({ length: 4 }, (_, i) => ALPHABET[(n >>> (i * 5)) & 31]).join('');
  return `LL-${chars(h1)}-${chars(h2)}`;
}

export function formatCertificateDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

const INK = '#1B1035';
const MUTED = '#5B4F7D';
const PURPLE = '#3B1F7A';
const GREEN = '#4D7C0F';
const LINE = '#D9D1F5';

/** Draws the certificate as an A4 landscape PNG (2000 x 1414). */
export async function drawCertificate(progress: CertificateProgress, displayName: string): Promise<Blob> {
  if (!progress.earned || !progress.earnedOn) throw new Error('Certificate not earned yet');
  await fontsReady();
  const W = 2000;
  const H = 1414;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // Frame: a thin lavender border with the brand's L corners.
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 3;
  ctx.strokeRect(60, 60, W - 120, H - 120);
  ctx.strokeStyle = PURPLE;
  ctx.lineWidth = 14;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  const corner = (x: number, y: number, dx: number, dy: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y + dy * 120);
    ctx.lineTo(x, y);
    ctx.lineTo(x + dx * 120, y);
    ctx.stroke();
  };
  corner(67, 67, 1, 1);
  corner(W - 67, H - 67, -1, -1);

  const cx = W / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Header: mark and wordmark, centred together.
  ctx.font = '800 64px Syne, Inter, sans-serif';
  const wordWidth = ctx.measureText('lurelens').width;
  const logoLeft = cx - (96 + 24 + wordWidth) / 2;
  drawMark(ctx, logoLeft, 150, 96, DAYLIGHT_MARK);
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.fillText('lurelens', logoLeft + 120, 222);
  ctx.textAlign = 'center';

  ctx.fillStyle = PURPLE;
  ctx.font = '500 28px "JetBrains Mono", monospace';
  ctx.fillText('C E R T I F I C A T E   O F   C O M P L E T I O N', cx, 336);

  ctx.fillStyle = INK;
  fit(ctx, 'Phishing Awareness Training', px => `800 ${px}px Syne, Inter, sans-serif`, 76, 1500);
  ctx.fillText('Phishing Awareness Training', cx, 440);

  ctx.fillStyle = MUTED;
  ctx.font = '400 34px Inter, sans-serif';
  ctx.fillText('This certifies that', cx, 540);

  // The name, with a rule under it.
  const name = displayName.trim() || 'Player';
  ctx.fillStyle = INK;
  fit(ctx, name, px => `800 ${px}px Syne, Inter, sans-serif`, 104, 1400);
  ctx.fillText(name, cx, 668);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 560, 708);
  ctx.lineTo(cx + 560, 708);
  ctx.stroke();

  ctx.fillStyle = MUTED;
  ctx.font = '400 32px Inter, sans-serif';
  ctx.fillText('completed all three levels of LureLens, spotting phishing emails, scam texts and fake', cx, 782);
  ctx.fillText(`WhatsApp messages, with at least ${CERTIFICATE_ACCURACY}% accuracy at every level.`, cx, 830);

  // One box per level.
  const boxW = 440;
  const gap = 40;
  const left = cx - (boxW * 3 + gap * 2) / 2;
  LEVEL_ORDER.forEach((level, i) => {
    const s = progress.levels[level].passedWith!;
    const x = left + i * (boxW + gap);
    const y = 900;
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, boxW, 196, 18);
    ctx.stroke();
    ctx.fillStyle = PURPLE;
    ctx.font = '500 24px "JetBrains Mono", monospace';
    ctx.fillText(LEVELS[level].label.toUpperCase(), x + boxW / 2, y + 52);
    ctx.fillStyle = GREEN;
    ctx.font = '800 56px Syne, Inter, sans-serif';
    ctx.fillText(`${s.accuracy}%`, x + boxW / 2, y + 122);
    ctx.fillStyle = MUTED;
    ctx.font = '400 24px Inter, sans-serif';
    ctx.fillText(formatCertificateDate(s.date), x + boxW / 2, y + 170);
  });

  // Footer: date, issuer, reference.
  const footY = 1226;
  ctx.fillStyle = INK;
  ctx.font = '600 30px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(formatCertificateDate(progress.earnedOn), 180, footY);
  ctx.fillStyle = MUTED;
  ctx.font = '400 24px Inter, sans-serif';
  ctx.fillText('Date completed', 180, footY + 40);

  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.font = '600 30px Inter, sans-serif';
  ctx.fillText('Th3 SpaceIO', cx, footY);
  ctx.fillStyle = MUTED;
  ctx.font = '400 24px Inter, sans-serif';
  ctx.fillText(`Issued through ${SITE_URL.replace(/^https:\/\/|\/$/g, '')}`, cx, footY + 40);

  ctx.textAlign = 'right';
  ctx.fillStyle = INK;
  ctx.font = '500 30px "JetBrains Mono", monospace';
  ctx.fillText(progress.reference ?? '', W - 180, footY);
  ctx.fillStyle = MUTED;
  ctx.font = '400 24px Inter, sans-serif';
  ctx.fillText('Reference', W - 180, footY + 40);

  ctx.textAlign = 'center';
  ctx.fillStyle = PURPLE;
  ctx.font = '500 20px "JetBrains Mono", monospace';
  ctx.fillText('TH3 SPACEIO  ·  LEARN. BUILD. SECURE.', cx, H - 96);

  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not create the image'))), 'image/png'),
  );
}
