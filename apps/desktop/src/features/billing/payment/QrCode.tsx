import { useMemo } from "react";
import { qrMatrix } from "./upi";

/** Crisp QR code (one SVG path), quiet zone included */
export function QrCode({
  value,
  size = 128,
  label,
}: {
  value: string;
  size?: number;
  label: string;
}) {
  const { d, n } = useMemo(() => {
    const m = qrMatrix(value);
    let path = "";
    m.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) path += `M${x + 2} ${y + 2}h1v1h-1z`;
      }),
    );
    return { d: path, n: m.length + 4 };
  }, [value]);
  return (
    <svg
      viewBox={`0 0 ${n} ${n}`}
      width={size}
      height={size}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className="rounded-lg bg-white"
    >
      <path d={d} fill="#0f172a" />
    </svg>
  );
}
