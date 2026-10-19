import { VENDOR } from "@medicare/domain/vendor";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";

/** "Powered by Vyntez Solution · © 2026" — the company named once */
export function PoweredBy({ className }: { className?: string }) {
  const year = new Date().getFullYear();
  return (
    <p
      className={cn("text-center text-[11px] text-muted-foreground", className)}
    >
      {tr("Powered by")}{" "}
      <b className="font-semibold text-foreground/70">{VENDOR.company}</b>
      <span className="mx-1.5 opacity-50">·</span>© {year}
    </p>
  );
}
