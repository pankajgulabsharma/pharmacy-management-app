import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { GlobalShortcuts } from "@/app/shortcuts/GlobalShortcuts";

export function AppLayout() {
  const { i18n } = useTranslation();
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
