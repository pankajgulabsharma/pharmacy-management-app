import { useNavigate } from "react-router-dom";
import { Bell, CheckCircle2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";
import { ALERT_TONE, useShopAlerts } from "@/features/alerts/useShopAlerts";

/**
 * Header bell: the same "needs attention" list as the Dashboard, from any
 * screen. The number = how many things need you; red dot = something
 * urgent (expired, overdue, out of stock). Click an item to go and fix it.
 */
export function NotificationBell() {
  const alerts = useShopAlerts();
  const navigate = useNavigate();
  const urgent = alerts.some((a) => a.level === "red");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`${tr("Notifications")} (${alerts.length})`}
            title={tr("Notifications")}
            className="relative h-9 w-9 rounded-lg flex items-center justify-center hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
        {alerts.length ? (
          <span
            className={cn(
              "absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full text-[9px] font-bold leading-4 text-white text-center",
              urgent ? "bg-red-500" : "bg-amber-500",
            )}
          >
            {alerts.length}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-1.5">
        <p className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground">
          {tr("Needs attention")}
        </p>
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 px-2 py-3 text-[12px] text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {tr("All good — nothing needs attention.")}
          </div>
        ) : (
          alerts.map((a) => (
            <DropdownMenuItem
              key={a.key}
              onClick={() => navigate(a.to)}
              className="items-start gap-2.5 py-2"
            >
              <span
                className={cn(
                  "h-7 w-7 rounded-md flex items-center justify-center shrink-0",
                  ALERT_TONE[a.level],
                )}
              >
                <a.icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-semibold text-foreground">
                  {a.title}
                </span>
                <span className="block text-[10.5px] text-muted-foreground leading-snug whitespace-normal">
                  {a.desc}
                </span>
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
