import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Building2,
  Package,
  Pill,
  ShoppingCart,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/common/Kbd";
import { useHotkeys } from "@/hooks/useHotkeys";

type Action = {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  to: string;
  keys: string;
};

/** Each action also has a key — on the Dashboard press the letter shown */
const QUICK_ACTIONS: Action[] = [
  {
    key: "bill",
    label: "New bill",
    icon: ShoppingCart,
    color: "bg-primary/10 text-primary",
    to: "/billing?focus=search",
    keys: "F2",
  },
  {
    key: "medicine",
    label: "Add medicine",
    icon: Pill,
    color: "bg-emerald-500/10 text-emerald-600",
    to: "/medicines?new=1",
    keys: "M",
  },
  {
    key: "purchase",
    label: "New purchase",
    icon: Truck,
    color: "bg-orange-500/10 text-orange-600",
    to: "/purchases?new=1",
    keys: "P",
  },
  {
    key: "supplier",
    label: "Add supplier",
    icon: Building2,
    color: "bg-violet-500/10 text-violet-600",
    to: "/suppliers?new=1",
    keys: "S",
  },
  {
    key: "stock",
    label: "Check stock",
    icon: Package,
    color: "bg-amber-500/10 text-amber-600",
    to: "/inventory",
    keys: "I",
  },
  {
    key: "reports",
    label: "Reports",
    icon: BarChart3,
    color: "bg-sky-500/10 text-sky-600",
    to: "/reports",
    keys: "R",
  },
];

export function QuickActions() {
  const navigate = useNavigate();
  // F2 is global; the letters work on the Dashboard
  useHotkeys(
    QUICK_ACTIONS.filter((a) => a.keys !== "F2").map((a) => ({
      keys: a.keys,
      handler: () => navigate(a.to),
    })),
  );

  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <h3 className="text-xs font-semibold text-foreground mb-2">
        Quick actions
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => navigate(a.to)}
            title={`${a.label} (${a.keys})`}
            className={cn(
              "relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all",
              "bg-white/50 dark:bg-white/5 border border-border shadow-sm",
              "hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <Kbd keys={a.keys} className="absolute top-1.5 right-1.5" />
            <div
              className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center",
                a.color,
              )}
            >
              <a.icon className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-medium text-center leading-tight text-foreground">
              {a.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
