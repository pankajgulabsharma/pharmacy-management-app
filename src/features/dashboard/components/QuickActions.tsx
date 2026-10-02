import { useTranslation } from "react-i18next";
import {
  ShoppingCart,
  Plus,
  Truck,
  UserPlus,
  BarChart3,
  Package,
} from "lucide-react";
import { quickActionsData } from "../data/mockData";
import { cn } from "@/lib/utils";

const iconMap = {
  ShoppingCart,
  Plus,
  Truck,
  UserPlus,
  BarChart3,
  Package,
};

export function QuickActions() {
  const { t } = useTranslation();

  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <h3 className="text-xs font-semibold text-foreground mb-2">
        {t("actions.title")}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {quickActionsData.map((action) => {
          const Icon = iconMap[action.icon];
          return (
            <button
              key={action.id}
              type="button"
              className={cn(
                "flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all",
                "bg-white/50 dark:bg-white/5 backdrop-blur-md",
                "border border-white/40 dark:border-white/10 shadow-sm",
                "hover:bg-white/70 dark:hover:bg-white/10 hover:shadow-md",
              )}
            >
              <div
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center",
                  action.color,
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-medium text-center leading-tight text-foreground">
                {t(action.titleKey)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
