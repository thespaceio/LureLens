import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/** A QR code drawn as one SVG path, dark on white so every phone camera reads it. */
export function QrCode({ text, label, className }: { text: string; label: string; className?: string }) {
  const { size, path } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
    }
    return { size: n + 8, path: d };
  }, [text]);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className={className} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#ffffff" />
      <path d={path} fill="#1B1035" />
    </svg>
  );
}

export default QrCode;
