import {
  Pill,
  Package,
  AlertTriangle,
  Clock,
  IndianRupee,
  ChevronRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { statsCardsData } from "../data/mockData";
import type { StatCard } from "@/types/dashboard";
import { cn } from "@/lib/utils";

const iconMap = {
  Pill,
  Package,
  AlertTriangle,
  Clock,
  IndianRupee,
};

export function StatsCards() {
  return (
    <div className="grid grid-cols-5 gap-2.5">
      {statsCardsData.map((card) => (
        <StatCardItem key={card.id} card={card} />
      ))}
    </div>
  );
}

function StatCardItem({ card }: { card: StatCard }) {
  const { t } = useTranslation();
  const Icon = iconMap[card.icon];

  return (
    <button
      type="button"
      className="bg-card border border-border rounded-xl p-2.5 text-left hover:bg-muted/40 transition-colors w-full"
    >
      <div
        className={cn(
          "h-7 w-7 rounded-lg flex items-center justify-center",
          card.iconBg,
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-1">
        <p className="text-[10px] text-muted-foreground truncate">
          {t(card.titleKey)}
        </p>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </div>

      <h3 className="text-sm font-bold text-foreground leading-tight mt-1">
        {card.value}
      </h3>

      {card.change && (
        <p
          className={cn(
            "text-[9px] mt-1 font-medium",
            card.changeType === "positive" &&
              "text-emerald-600 dark:text-emerald-400",
            card.changeType === "negative" && "text-red-500 dark:text-red-400",
          )}
        >
          {card.change}
        </p>
      )}
    </button>
  );
}
