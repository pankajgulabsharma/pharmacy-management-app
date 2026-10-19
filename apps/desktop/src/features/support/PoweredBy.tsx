import { VENDOR } from "@medicare/domain/vendor";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";

/** "© 2026 Vintez Solution · Powered by Vintez Solution" */
export function PoweredBy({ className }: { className?: string }) {
  const year = new Date().getFullYear();
  return (
    <p
      className={cn("text-center text-[11px] text-muted-foreground", className)}
    >
      © {year} {VENDOR.company} · {tr("Powered by")}{" "}
      <b className="font-semibold text-foreground/70">{VENDOR.company}</b>
    </p>
  );
}
