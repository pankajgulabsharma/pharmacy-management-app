import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useEffect } from "react";
import { GlobalShortcuts } from "@/app/shortcuts/GlobalShortcuts";
import { useServerStore } from "@/stores/useServerStore";
import { tr } from "@/lib/i18n";
import { KeepAliveOutlet } from "./KeepAliveOutlet";

export function AppLayout() {
  const { i18n } = useTranslation();
  // Live connection to the server while signed in (closed on sign-out)
  useEffect(() => {
    const { connect, disconnect } = useServerStore.getState();
    connect();
    return disconnect;
  }, []);
  // Screens wait for the first load, so they never show empty/old numbers
  const loaded = useServerStore((s) => s.lastSyncAt !== null);
  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <Header />
        <main className="flex-1 min-h-0 overflow-hidden">
          {loaded ? (
            // Screens stay alive across tab switches (nothing typed is lost).
            // key: switching language re-renders them in the new language.
            <KeepAliveOutlet key={i18n.language} />
          ) : (
            <div className="h-full flex items-center justify-center gap-2 text-[12px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {tr("Loading shop data…")}
            </div>
          )}
        </main>
        <GlobalShortcuts />
      </div>
    </div>
  );
}
