import { useEffect, useRef, useState } from "react";
import { Bell, Calendar, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useUIStore } from "@/stores/useUIStore";
import { KEYS } from "@/app/shortcuts/registry";
import { formatCombo, preferredCombo } from "@/lib/hotkeys";
import { SearchInput } from "@/components/common/SearchInput";
import { ThemeLanguageSwitcher } from "@/components/common/ThemeLanguageSwitcher";

const IS_MAC =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);
const SHORTCUT_LABEL = IS_MAC ? "⌘K" : "Ctrl K";

export function Header() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleHint = formatCombo(preferredCombo(KEYS.toggleSidebar)).join("+");
  // TODO(search): wire this to a global search (medicines, invoices, suppliers)
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K focuses the global search from anywhere
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <header className="h-14 shrink-0 border-b border-border bg-card px-4 flex items-center gap-3">
      {/* The ONE sidebar control */}
      <button
        type="button"
        onClick={toggleSidebar}
        aria-expanded={sidebarOpen}
        aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        title={`${sidebarOpen ? "Collapse" : "Expand"} sidebar (${toggleHint})`}
        className="h-9 w-9 shrink-0 rounded-lg border border-border bg-background flex items-center justify-center text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {sidebarOpen ? (
          <PanelLeftClose className="h-4 w-4" />
        ) : (
          <PanelLeftOpen className="h-4 w-4" />
        )}
      </button>

      {/* Search */}
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search medicine, invoice, supplier, etc..."
        ariaLabel="Search everything"
        size="lg"
        shortcut={SHORTCUT_LABEL}
        inputRef={searchRef}
        className="max-w-xl 2xl:max-w-2xl"
      />

      {/* Right side (ml-auto pushes it to the far right) */}
      <div className="ml-auto flex items-center gap-3 shrink-0">
        {/* Language + Theme */}
        <ThemeLanguageSwitcher />

        {/* Notifications */}
        <button
          type="button"
          aria-label="Notifications"
          className="relative h-9 w-9 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
        >
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-red-500" />
        </button>

        {/* Date */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
          <Calendar className="h-3.5 w-3.5" />
          <span>{today}</span>
        </div>

        {/* User profile */}
        <div className="flex items-center gap-2 pl-3 border-l border-border">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-[11px] font-semibold text-primary-foreground">
            PS
          </div>
          <div className="hidden sm:block leading-tight">
            <p className="text-xs font-medium text-foreground">Pankaj Sharma</p>
            <p className="text-[10px] text-muted-foreground">Admin</p>
          </div>
        </div>
      </div>
    </header>
  );
}
