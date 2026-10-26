// Draws a branded 1200 x 630 result card on a canvas, entirely in the browser,
// so sharing works offline and nothing is sent anywhere.
import { S_PATH } from '@/components/Logo/Logo';
import { rankTitle } from '@/lib/game';
import { LEVELS } from '@/types';
import type { GameSession } from '@/types';

export const SITE_URL = 'https://lurelens.netlify.app/';

const C = {
  ground: '#1B1035',
  lavender: '#B9A6FF',
  lime: '#C6F432',
  mist: '#CFC6E8',
  white: '#FFFFFF',
};

export function shareText(session: GameSession): string {
  const round = session.practice ? 'a practice round' : `the ${LEVELS[session.level].label} level`;
  return (
    `I spotted ${session.correct} of ${session.total} lures on LureLens in ${round} ` +
    `and scored ${session.score.toLocaleString()} points. Can you beat me? ${SITE_URL}`
  );
}

/** Wait for the brand fonts, but never longer than a moment (offline or blocked fonts fall back). */
export async function fontsReady(): Promise<void> {
  if (!('fonts' in document)) return;
  const loads = ['800 72px Syne', '600 28px Inter', '500 22px "JetBrains Mono"'].map(f => document.fonts.load(f).catch(() => []));
  await Promise.race([Promise.all(loads), new Promise(r => setTimeout(r, 1500))]);
}

export interface MarkColours {
  ls: string;
  ring: string;
  /** The background, used to cut the "s" hallmarks out of the Ls. */
  ground: string;
}

const DARK_MARK: MarkColours = { ls: C.lavender, ring: C.lime, ground: C.ground };
/** The daylight mark, for light backgrounds such as the printable certificate. */
export const DAYLIGHT_MARK: MarkColours = { ls: '#3B1F7A', ring: '#4D7C0F', ground: '#FFFFFF' };

export function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, colours: MarkColours = DARK_MARK) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 120, size / 120);
  ctx.strokeStyle = colours.ls;
  ctx.lineWidth = 20;
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(22, 18);
  ctx.lineTo(22, 98);
  ctx.lineTo(66, 98);
  ctx.moveTo(98, 102);
  ctx.lineTo(98, 22);
  ctx.lineTo(54, 22);
  ctx.stroke();
  // The "s" hallmarks are cut out in the background colour.
  const s = new Path2D(S_PATH);
  ctx.fillStyle = colours.ground;
  ctx.fill(s);
  ctx.save();
  ctx.translate(60, 60);
  ctx.rotate(Math.PI);
  ctx.translate(-60, -60);
  ctx.fill(s);
  ctx.restore();
  ctx.strokeStyle = colours.ring;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(60, 60, 15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Shrink a font size until the text fits the width. */
export function fit(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, start: number, maxWidth: number): number {
  let px = start;
  ctx.font = font(px);
  while (px > 24 && ctx.measureText(text).width > maxWidth) {
    px -= 2;
    ctx.font = font(px);
  }
  return px;
}

export async function drawResultCard(session: GameSession): Promise<Blob> {
  await fontsReady();
  const W = 1200;
  const H = 630;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');

  ctx.fillStyle = C.ground;
  ctx.fillRect(0, 0, W, H);

  // Header: mark + wordmark.
  drawMark(ctx, 72, 56, 64);
  ctx.fillStyle = C.white;
  ctx.textBaseline = 'middle';
  ctx.font = '800 40px Syne, Inter, sans-serif';
  ctx.fillText('lurelens', 152, 90);

  ctx.textAlign = 'right';
  ctx.fillStyle = C.lavender;
  ctx.font = '500 18px "JetBrains Mono", monospace';
  const label = session.practice ? 'PRACTICE ROUND' : `${LEVELS[session.level].label.toUpperCase()} LEVEL`;
  ctx.fillText(label, W - 72, 90);
  ctx.textAlign = 'left';

  // Title and score.
  const title = rankTitle(session.accuracy);
  ctx.fillStyle = C.white;
  ctx.textBaseline = 'alphabetic';
  fit(ctx, title, px => `800 ${px}px Syne, Inter, sans-serif`, 96, W - 144);
  ctx.fillText(title, 72, 270);

  ctx.fillStyle = C.lime;
  ctx.font = '800 64px Syne, Inter, sans-serif';
  const score = session.score.toLocaleString();
  ctx.fillText(score, 72, 360);
  const scoreWidth = ctx.measureText(score).width;
  ctx.fillStyle = C.mist;
  ctx.font = '600 28px Inter, sans-serif';
  ctx.fillText('points', 72 + scoreWidth + 16, 360);

  // Stats.
  const stats = [
    `${session.correct}/${session.total} spotted`,
    `${session.accuracy}% accuracy`,
    `best streak ${session.bestStreak}`,
  ].join('   ·   ');
  ctx.fillStyle = C.mist;
  fit(ctx, stats, px => `600 ${px}px Inter, sans-serif`, 30, W - 144);
  ctx.fillText(stats, 72, 430);

  // Footer.
  ctx.fillStyle = C.lime;
  ctx.font = '500 26px "JetBrains Mono", monospace';
  ctx.fillText('Can you beat me?  lurelens.netlify.app', 72, 560);
  ctx.textAlign = 'right';
  ctx.fillStyle = C.lavender;
  ctx.font = '500 16px "JetBrains Mono", monospace';
  ctx.fillText('BY TH3 SPACEIO', W - 72, 560);

  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not create the image'))), 'image/png'),
  );
}
