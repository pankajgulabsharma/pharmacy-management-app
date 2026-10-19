import { useEffect, useState } from "react";
import { PLAN_LABEL } from "@medicare/domain/license/plan";
import { useLicenseStore } from "@/features/license/useLicenseStore";
import { useSettingsStore } from "@/features/settings/store/useSettingsStore";
import { useAuthStore } from "@/features/auth/store/useAuthStore";
import { desktopBridge } from "@/lib/desktop";

/**
 * What support needs to know (shop, machine code, licence, version) —
 * ready to copy, WhatsApp or e-mail. Only what this person may see.
 */
export function useSupportDetails() {
  const signedIn = useAuthStore((s) => !!s.session);
  const shop = useSettingsStore((s) => s.shop);
  const lic = useLicenseStore((s) => s.state);
  const [version, setVersion] = useState("development");
  useEffect(() => {
    void desktopBridge()
      ?.updates()
      .then(
        (u) => setVersion(u.version),
        () => {},
      );
  }, []);

  const rows: [string, string][] = signedIn
    ? [
        ["Shop", shop.name],
        ["Phone", shop.phone],
        ["Machine code", lic?.machine ?? ""],
        ["Plan", lic ? PLAN_LABEL[lic.plan] : ""],
        [
          "Licence",
          lic?.license?.id ?? (lic?.status === "trial" ? "Trial" : ""),
        ],
        ["Valid till", lic?.license?.expiresAt ?? ""],
        ["App version", version],
      ]
    : [["App version", version]];
  const filled = rows.filter(([, v]) => v);
  const text = filled.map(([k, v]) => `${k}: ${v}`).join("\n");
  return { rows: filled, text };
}
