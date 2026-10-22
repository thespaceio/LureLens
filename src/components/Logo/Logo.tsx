// LureLens logo. Generated from the brand canvas: two interlocking Ls, each
// with an "s" for SpaceIO knocked out of its corner, framing a lime lens.
// The "s" is outlined (Syne 800) so the mark never depends on a web font.
import { useId } from 'react';

/** The outlined "s" hallmark, in the mark's 120 x 120 box. */
export const S_PATH =
  'M14.76 100.16L14.76 100.16L18.96 100.16Q19.23 100.65 19.98 100.84Q20.73 101.03 22.13 101.03L22.13 101.03Q23.22 101.03 23.74 100.92Q24.26 100.80 24.42 100.61Q24.58 100.42 24.58 100.21L24.58 100.21Q24.58 99.89 24.23 99.77Q23.88 99.64 23.05 99.61Q22.21 99.59 20.75 99.59L20.75 99.59Q19.36 99.59 18.27 99.46Q17.17 99.34 16.41 99.06Q15.65 98.79 15.26 98.29Q14.86 97.80 14.86 97.06L14.86 97.06Q14.86 96.15 15.45 95.53Q16.03 94.91 17.04 94.56Q18.05 94.21 19.37 94.06Q20.69 93.91 22.13 93.91L22.13 93.91Q24.53 93.91 26.05 94.39Q27.57 94.87 28.29 95.69Q29.01 96.51 28.99 97.53L28.99 97.53L24.91 97.53Q24.70 97.04 24.12 96.85Q23.54 96.66 22.13 96.66L22.13 96.66Q20.80 96.66 20.20 96.86Q19.61 97.06 19.61 97.50L19.61 97.50Q19.61 97.78 19.90 97.92Q20.20 98.07 21.02 98.12Q21.85 98.18 23.44 98.18L23.44 98.18Q24.55 98.18 25.60 98.26Q26.66 98.33 27.50 98.58Q28.35 98.83 28.84 99.34Q29.33 99.85 29.33 100.75L29.33 100.75Q29.33 101.83 28.45 102.50Q27.57 103.18 25.95 103.48Q24.34 103.78 22.13 103.78L22.13 103.78Q20.21 103.78 18.89 103.54Q17.57 103.29 16.74 102.88Q15.90 102.47 15.45 101.99Q15.01 101.50 14.87 101.02Q14.72 100.54 14.76 100.16Z';

interface LogoMarkProps {
  size?: number;
  /** Bolder version without the "s", for 48 px and below. */
  simple?: boolean;
  frame?: string;
  accent?: string;
  className?: string;
  title?: string;
}

export function LogoMark({
  size = 32,
  simple = size < 48,
  frame = '#B9A6FF',
  accent = '#C6F432',
  className,
  title,
}: LogoMarkProps) {
  const maskId = `lurelens-s-${useId().replace(/:/g, '')}`;
  const lw = simple ? 24 : 20;
  const ls = (
    <>
      <path d="M22 18 L22 98 L66 98" fill="none" stroke={frame} strokeWidth={lw} strokeLinejoin="miter" />
      <path d="M98 102 L98 22 L54 22" fill="none" stroke={frame} strokeWidth={lw} strokeLinejoin="miter" />
    </>
  );
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {simple ? (
        ls
      ) : (
        <>
          <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
              <rect width="120" height="120" fill="#fff" />
              <path d={S_PATH} fill="#000" />
              <path d={S_PATH} fill="#000" transform="rotate(180 60 60)" />
            </mask>
          </defs>
          <g mask={`url(#${maskId})`}>{ls}</g>
        </>
      )}
      <circle cx="60" cy="60" r="15" fill="none" stroke={accent} strokeWidth={simple ? 11 : 8} />
    </svg>
  );
}

/** Mark plus the lowercase "lurelens" wordmark in Syne. */
export function Logo({ size = 32, className, wordmarkClassName }: { size?: number; className?: string; wordmarkClassName?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <LogoMark size={size} />
      <span className={`font-display text-[1.45rem] font-extrabold leading-none tracking-[-0.03em] text-foreground ${wordmarkClassName ?? ''}`}>lurelens</span>
    </span>
  );
}

export default Logo;
