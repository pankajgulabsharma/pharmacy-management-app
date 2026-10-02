import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

/** Page title row used by Medicines / Inventory / Purchases */
export function PageHeader({ icon: Icon, title, subtitle, actions }: Props) {
  return (
    <div className="flex items-center justify-between gap-2 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-foreground leading-tight">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-[10px] text-muted-foreground truncate">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      ) : null}
    </div>
  );
}
