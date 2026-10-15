import { useSettingsStore } from "@/features/settings/store/useSettingsStore";
import { APP_NAME } from "@medicare/domain/settings/defaults";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useEffect } from "react";
import { GlobalShortcuts } from "@/app/shortcuts/GlobalShortcuts";
import { useServerStore } from "@/stores/useServerStore";
import { tr } from "@/lib/i18n";
import { KeepAliveOutlet } from "./KeepAliveOutlet";
import { preloadPages } from "@/app/router/lazyPage";
import { LicenseBanner } from "@/features/license/LicenseBanner";

export function AppLayout() {
  const { i18n } = useTranslation();
  // Live connection to the server while signed in (closed on sign-out)
  useEffect(() => {
    const { connect, disconnect } = useServerStore.getState();
    connect();
    return disconnect;
  }, []);
  // Other screens' code, fetched in the background once the app is idle
  useEffect(() => {
    const t = window.setTimeout(preloadPages, 1500);
    return () => window.clearTimeout(t);
  }, []);
  // Window / taskbar title: this shop, in this software
  const shopName = useSettingsStore((s) => s.shop.name);
  useEffect(() => {
    document.title = `${shopName} · ${APP_NAME}`;
  }, [shopName]);
  // Screens wait for the first load, so they never show empty/old numbers
  const loaded = useServerStore((s) => s.lastSyncAt !== null);
  // First load failed (server down…) → say so, never spin for ever
  const loadError = useServerStore((s) =>
    s.status === "offline" ? s.error : null,
  );
  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <Header />
        <LicenseBanner />
        <main className="flex-1 min-h-0 overflow-hidden">
          {loaded ? (
            // Screens stay alive across tab switches (nothing typed is lost).
            // key: switching language re-renders them in the new language.
            <KeepAliveOutlet key={i18n.language} />
          ) : (
            <div className="h-full flex items-center justify-center gap-2 text-[12px] text-muted-foreground">
              {loadError ? (
                <>
                  <span>{tr(loadError)}</span>
                  <button
                    type="button"
                    onClick={() => void useServerStore.getState().sync()}
                    className="h-7 rounded-md border border-border px-2.5 text-[11px] font-medium text-foreground hover:bg-muted"
                  >
                    {tr("Try again")}
                  </button>
                </>
              ) : (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tr("Loading shop data…")}
                </>
              )}
            </div>
          )}
        </main>
        <GlobalShortcuts />
      </div>
    </div>
  );
}
