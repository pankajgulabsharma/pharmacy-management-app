import { Store } from "lucide-react";
import { useSettingsStore } from "@/features/settings/store/useSettingsStore";
import { useTranslation } from "react-i18next";
import { StatsCards } from "../components/StatsCards";
import { SalesOverview } from "../components/SalesOverview";
import { QuickStats } from "../components/QuickStats";
import { RecentSales } from "../components/RecentSales";
import { TopSellingMedicines } from "../components/TopSellingMedicines";
import { QuickActions } from "../components/QuickActions";
import { LowStockAlerts } from "../components/LowStockAlerts";
import { AlertsPanel } from "../components/AlertsPanel";
import { getGreetingName, getTimeBasedGreetingKey } from "@/lib/greeting";
import { useDashboardData } from "../hooks/useDashboardData";
import { useCurrentUser } from "@/features/auth/store/useAuthStore";

export default function DashboardPage() {
  const { t } = useTranslation();
  const name = getGreetingName(useCurrentUser()?.name);
  const d = useDashboardData();
  const shop = useSettingsStore((s) => s.shop);

  return (
    <div className="h-full w-full p-3 overflow-y-auto xl:overflow-hidden box-border">
      <div className="xl:h-full grid grid-cols-1 xl:grid-cols-12 gap-3 min-h-0">
        {/* Main column */}
        <div className="xl:col-span-9 xl:h-full grid grid-cols-1 gap-2.5 xl:overflow-hidden min-h-0 min-w-0 xl:grid-rows-[auto_auto_minmax(0,1.35fr)_minmax(0,1.15fr)_auto]">
          <div className="flex items-center justify-between shrink-0">
            <h1 className="text-base font-bold text-foreground leading-tight">
              👋 {t(getTimeBasedGreetingKey())}, {name}
            </h1>
            <div className="flex items-center gap-2 text-[11px] min-w-0">
              <span className="min-w-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-card text-muted-foreground">
                <Store className="h-3.5 w-3.5 shrink-0 text-primary" />
                <b className="font-semibold text-foreground truncate">
                  {shop.name}
                </b>
                {shop.address ? (
                  <span
                    className="hidden lg:inline truncate max-w-[340px]"
                    title={shop.address}
                  >
                    · {shop.address}
                  </span>
                ) : null}
              </span>
            </div>
          </div>

          <div className="shrink-0">
            <StatsCards d={d} />
          </div>

          <div className="grid grid-cols-3 gap-2.5 min-h-0 overflow-hidden h-[300px] xl:h-auto">
            <div className="col-span-2 h-full min-h-0 overflow-hidden">
              <SalesOverview d={d} />
            </div>
            <div className="h-full min-h-0 overflow-hidden">
              <QuickStats d={d} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 min-h-0 overflow-hidden h-[280px] xl:h-auto">
            <div className="h-full min-h-0 overflow-hidden">
              <RecentSales d={d} />
            </div>
            <div className="h-full min-h-0 overflow-hidden">
              <TopSellingMedicines d={d} />
            </div>
          </div>

          <div className="shrink-0">
            <LowStockAlerts d={d} />
          </div>
        </div>

        {/* Side column: alerts scroll, Quick Actions always fully visible */}
        <div className="xl:col-span-3 xl:h-full flex flex-col gap-2 min-h-0 min-w-0 justify-start">
          <div className="shrink-0 max-h-[50%] overflow-y-auto">
            <AlertsPanel />
          </div>
          <div className="shrink-0">
            <QuickActions />
          </div>
        </div>
      </div>
    </div>
  );
}
