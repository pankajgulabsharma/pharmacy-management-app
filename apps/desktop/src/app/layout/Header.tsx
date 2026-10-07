import { useState } from "react";
import {
  Calendar,
  ChevronDown,
  KeyRound,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useAuthStore,
  useCan,
  useCurrentUser,
} from "@/features/auth/store/useAuthStore";
import { ChangePasswordDialog } from "@/features/auth/components/ChangePasswordDialog";
import { ROLE_LABELS } from "@medicare/domain/auth/types";
import { tr } from "@/lib/i18n";

/** "Pankaj Sharma" → "PS" */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
import { useUIStore } from "@/stores/useUIStore";
import { KEYS } from "@/app/shortcuts/registry";
import { formatCombo, preferredCombo } from "@/lib/hotkeys";
import { ThemeLanguageSwitcher } from "@/components/common/ThemeLanguageSwitcher";
import { ServerStatus } from "./ServerStatus";
import { NotificationBell } from "./NotificationBell";
import { GlobalSearch } from "./GlobalSearch";

export function Header() {
  const user = useCurrentUser();
  const logout = useAuthStore((st) => st.logout);
  const canAdmin = useCan("admin");
  const [pwOpen, setPwOpen] = useState(false);
  const navigate = useNavigate();
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleHint = formatCombo(preferredCombo(KEYS.toggleSidebar)).join("+");

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

      {/* Search everything (Ctrl/⌘+K) */}
      <GlobalSearch />

      {/* Right side (ml-auto pushes it to the far right) */}
      <div className="ml-auto flex items-center gap-3 shrink-0">
        {/* Language + Theme */}
        <ServerStatus />
        <ThemeLanguageSwitcher />

        {/* Notifications — same list as the Dashboard alerts */}
        <NotificationBell />

        {/* Date */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
          <Calendar className="h-3.5 w-3.5" />
          <span>{today}</span>
        </div>

        {/* Signed-in user — menu with Sign out */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label={`${user?.name ?? ""} — account menu`}
                className="flex items-center gap-2 pl-3 border-l border-border rounded-r-lg hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            }
          >
            <span className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-[11px] font-semibold text-primary-foreground">
              {initials(user?.name ?? "")}
            </span>
            <span className="hidden sm:block leading-tight text-left">
              <span className="block text-xs font-medium text-foreground">
                {user?.name}
              </span>
              <span className="block text-[10px] text-muted-foreground">
                {user ? tr(ROLE_LABELS[user.role]) : ""}
              </span>
            </span>
            <ChevronDown className="hidden sm:block h-3.5 w-3.5 text-muted-foreground mr-1" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {canAdmin ? (
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                <Settings className="h-3.5 w-3.5" />
                {tr("Settings")}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={() => setPwOpen(true)}>
              <KeyRound className="h-3.5 w-3.5" />
              {tr("Change password")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void logout();
                navigate("/login", { replace: true });
              }}
              className="text-red-600 focus:text-red-600"
            >
              <LogOut className="h-3.5 w-3.5" />
              {tr("Sign out")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ChangePasswordDialog open={pwOpen} onClose={() => setPwOpen(false)} />
      </div>
    </header>
  );
}
