import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * The MediCare mark: a plus inside the loader's orbit ring, on the brand
 * gradient. Same drawing as public/favicon.svg and the installer icon
 * (installer/build/icon.png) — change all three together.
 */
export function AppLogo({ className }: { className?: string }) {
  // Several logos on one screen need their own gradient ids
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="16 16 480 480"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset=".55" stopColor="#5b21b6" />
          <stop offset="1" stopColor="#3b0764" />
        </linearGradient>
        <radialGradient id={`${id}gl`} cx=".3" cy=".22" r=".75">
          <stop offset="0" stopColor="#fff" stopOpacity=".35" />
          <stop offset=".6" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}rg`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset=".5" stopColor="#a5b4fc" />
          <stop offset="1" stopColor="#f0abfc" />
        </linearGradient>
      </defs>
      <rect x="16" y="16" width="480" height="480" rx="112" fill={`url(#${id}bg)`} />
      <rect x="16" y="16" width="480" height="480" rx="112" fill={`url(#${id}gl)`} />
      <circle cx="256" cy="256" r="164" fill="none" stroke="#fff" strokeOpacity=".12" strokeWidth="14" />
      <circle
        cx="256"
        cy="256"
        r="164"
        fill="none"
        stroke={`url(#${id}rg)`}
        strokeWidth="16"
        strokeLinecap="round"
        strokeDasharray="620 1031"
        transform="rotate(-200 256 256)"
      />
      <circle cx="256" cy="92" r="15" fill="#fff" transform="rotate(16 256 256)" />
      <path
        d="M256 150a26 26 0 0 1 26 26v54h54a26 26 0 0 1 0 52h-54v54a26 26 0 0 1-52 0v-54h-54a26 26 0 0 1 0-52h54v-54a26 26 0 0 1 26-26z"
        fill="#fff"
      />
    </svg>
  );
}
