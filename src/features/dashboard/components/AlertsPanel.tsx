import { useTranslation } from "react-i18next";
import { AlertTriangle, Clock, ShoppingBag } from "lucide-react";

export function AlertsPanel() {
  const { t } = useTranslation();

  const alerts = [
    {
      id: "1",
      titleKey: "alerts.actionRequired",
      descKey: "alerts.actionRequiredDesc",
      icon: AlertTriangle,
      color: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
      border: "border-red-100 dark:border-red-900",
    },
    {
      id: "2",
      titleKey: "alerts.expiringSoon",
      descKey: "alerts.expiringSoonDesc",
      icon: Clock,
      color:
        "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
      border: "border-orange-100 dark:border-orange-900",
    },
    {
      id: "3",
      titleKey: "alerts.purchaseReminder",
      descKey: "alerts.purchaseReminderDesc",
      icon: ShoppingBag,
      color: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
      border: "border-blue-100 dark:border-blue-900",
    },
  ];

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const Icon = alert.icon;
        return (
          <div
            key={alert.id}
            className={`bg-card border ${alert.border} rounded-xl p-2.5 flex items-start gap-2.5`}
          >
            <div
              className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${alert.color}`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">
                {t(alert.titleKey)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                {t(alert.descKey)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
