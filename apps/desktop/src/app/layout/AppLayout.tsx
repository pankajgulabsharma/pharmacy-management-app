import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useEffect } from "react";
import { GlobalShortcuts } from "@/app/shortcuts/GlobalShortcuts";
import { useServerStore } from "@/stores/useServerStore";

export function AppLayout() {
  const { i18n } = useTranslation();
  // Connect to the server once, when the app opens (signed-in area)
  useEffect(() => {
    void useServerStore.getState().sync();
  }, []);
  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <Header />
        <main className="flex-1 min-h-0 overflow-hidden">
          {/* key: switching language re-renders the screen in the new language */}
          <Outlet key={i18n.language} />
        </main>
        <GlobalShortcuts />
      </div>
    </div>
  );
}
