import { NavLink } from "react-router-dom";
import { Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCombo, preferredCombo } from "@/lib/hotkeys";
import { useUIStore } from "@/stores/useUIStore";
import { useSettingsStore } from "@/features/settings/store/useSettingsStore";
import { KEYS, navItemsFor, type NavItem } from "@/app/shortcuts/registry";
import { useAuthStore } from "@/features/auth/store/useAuthStore";
import { useTr } from "@/hooks/useTr";
import { tr } from "@/lib/i18n";

const keyText = (keys: string | readonly string[]) =>
  formatCombo(preferredCombo(keys)).join(" ");

/**
 * App navigation: one simple list, the active screen clearly marked,
 * shortcut hints on hover. Collapsing lives in the Header (or Ctrl/⌘+B).
 */
export function Sidebar() {
  const open = useUIStore((s) => s.sidebarOpen);
  const shopName = useSettingsStore((s) => s.shop.name);
  const role = useAuthStore((s) => s.session?.user.role);

  return (
    <aside
      aria-label="Main navigation"
      className={cn(
        "h-full shrink-0 flex flex-col",
        "bg-slate-950 text-slate-300 border-r border-white/[0.06]",
        "transition-[width] duration-200 ease-out",
        open ? "w-60" : "w-16",
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          "h-14 shrink-0 flex items-center border-b border-white/[0.06]",
          open ? "px-4 gap-3" : "justify-center",
        )}
      >
        <div
          aria-hidden="true"
          className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-950/50 flex items-center justify-center text-white font-bold text-base select-none shrink-0"
        >
          +
        </div>
        {open ? (
          <div className="min-w-0">
            <p
              className="text-[13px] font-semibold text-white truncate leading-tight"
              title={shopName}
            >
              {shopName}
            </p>
            <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
              Pharmacy POS
            </p>
          </div>
        ) : null}
      </div>

      {/* Screens, one after another */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-1">
        {navItemsFor(role).map((item) => (
          <NavItemLink key={item.to} item={item} open={open} />
        ))}
      </nav>

      {/* Help */}
      <div className="shrink-0 border-t border-white/[0.06] px-3 py-3">
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: "F1",
                code: "F1",
                bubbles: true,
              }),
            )
          }
          title={`${tr("Keyboard shortcuts")} (${keyText(KEYS.help)})`}
          className={cn(
            "group w-full flex items-center rounded-lg text-[12.5px] text-slate-400 transition-colors",
            "hover:bg-white/[0.05] hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60",
            open ? "h-9 gap-3 px-3" : "h-10 justify-center",
          )}
        >
          <Keyboard className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} />
          {open ? (
            <>
              <span className="flex-1 text-left truncate">
                {tr("Keyboard shortcuts")}
              </span>
              <span className="text-[10px] font-mono text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                {keyText(KEYS.help)}
              </span>
            </>
          ) : null}
        </button>
      </div>
    </aside>
  );
}

function NavItemLink({ item, open }: { item: NavItem; open: boolean }) {
  const tr = useTr();
  const Icon = item.icon;
  const hint = keyText(item.keys);
  return (
    <NavLink
      to={item.to}
      title={`${tr(item.label)} (${hint})`}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center rounded-lg text-[12.5px] font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60",
          open ? "h-10 gap-3 px-3" : "h-10 justify-center",
          isActive
            ? "bg-indigo-500/[0.14] text-white"
            : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-100",
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Active marker */}
          <span
            aria-hidden="true"
            className={cn(
              "absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-indigo-400 transition-opacity",
              isActive ? "opacity-100" : "opacity-0",
            )}
          />
          <Icon
            className={cn(
              "h-[18px] w-[18px] shrink-0",
              isActive && "text-indigo-300",
            )}
            strokeWidth={isActive ? 2.2 : 1.9}
          />
          {open ? (
            <>
              <span className="truncate flex-1">{tr(item.label)}</span>
              <span className="text-[10px] font-mono text-slate-500 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity shrink-0">
                {hint}
              </span>
            </>
          ) : null}
        </>
      )}
    </NavLink>
  );
}
