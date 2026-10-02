import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  Pill,
  Package,
  Truck,
  Users,
  FileText,
  Settings,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/useUIStore";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/billing", label: "Sales & Billing", icon: ShoppingCart },
  { to: "/medicines", label: "Medicines", icon: Pill },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/purchases", label: "Purchases", icon: Truck },
  { to: "/suppliers", label: "Suppliers", icon: Users },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        "h-full shrink-0 flex flex-col border-r border-slate-800",
        "bg-slate-950 text-slate-200",
        "transition-[width] duration-300 ease-in-out",
        sidebarOpen ? "w-56" : "w-[68px]",
      )}
    >
      {/* Brand — + logo always visible */}
      <div
        className={cn(
          "h-14 shrink-0 flex items-center border-b border-slate-800",
          sidebarOpen ? "px-3 gap-2" : "justify-center px-0",
        )}
      >
        <div
          className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0 select-none"
          title="MediCare"
        >
          +
        </div>

        {sidebarOpen && (
          <>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate leading-tight">
                MediCare
              </p>
              <p className="text-[10px] text-slate-400 truncate">Pharmacy</p>
            </div>
            <button
              type="button"
              onClick={toggleSidebar}
              className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              aria-label="Collapse sidebar"
              title="Collapse"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 min-h-0 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={!sidebarOpen ? label : undefined}
            className={({ isActive }) =>
              cn(
                "flex items-center rounded-lg text-[12px] font-medium transition-colors",
                sidebarOpen
                  ? "gap-2.5 px-2.5 h-9"
                  : "justify-center h-10 w-full",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white",
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {sidebarOpen && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Expand when collapsed */}
      {!sidebarOpen && (
        <div className="shrink-0 p-2 border-t border-slate-800">
          <button
            type="button"
            onClick={toggleSidebar}
            className="h-10 w-full rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Expand sidebar"
            title="Expand"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </aside>
  );
}
