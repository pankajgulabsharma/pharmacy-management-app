/**
 * Every keyboard shortcut in the app, in one place.
 * The help dialog (F1), sidebar hints and button hints all read from here,
 * so what is shown is always what works.
 */
import {
  BarChart3,
  LayoutDashboard,
  Package,
  Pill,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  keys: string;
};

/** Screens — Alt+1 … Alt+8 (same order as the sidebar) */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    keys: "Alt+1",
  },
  {
    to: "/billing",
    label: "Sales & Billing",
    icon: ShoppingCart,
    keys: "Alt+2",
  },
  {
    to: "/medicines",
    label: "Medicines",
    icon: Pill,
    keys: "Alt+3",
  },
  {
    to: "/inventory",
    label: "Inventory",
    icon: Package,
    keys: "Alt+4",
  },
  {
    to: "/purchases",
    label: "Purchases",
    icon: Truck,
    keys: "Alt+5",
  },
  {
    to: "/suppliers",
    label: "Suppliers",
    icon: Users,
    keys: "Alt+6",
  },
  {
    to: "/reports",
    label: "Reports",
    icon: BarChart3,
    keys: "Alt+7",
  },
  {
    to: "/settings",
    label: "Settings",
    icon: Settings,
    keys: "Alt+8",
  },
];

/**
 * Keys used in code — change a key here and it changes everywhere.
 *
 * Every F-key has a partner that works on any keyboard: Mac laptops send
 * F1–F12 only with the fn key, and some browsers keep F-keys for
 * themselves. Alt+letters avoid Firefox's menu letters (F, E, V, S, B, T, H).
 */
export const KEYS = {
  help: ["F1", "Alt+H", "Shift+?"],
  newBill: ["F2", "Alt+N"],
  globalSearch: "Mod+K",
  toggleSidebar: "Mod+B",

  // Lists (Medicines, Inventory, Purchases, Suppliers, Returns…)
  focusSearch: ["/", "Mod+F"],
  listUp: "ArrowUp",
  listDown: "ArrowDown",
  listFirst: "Home",
  listLast: "End",
  open: "Enter",
  create: "N",
  edit: "E",
  remove: "Delete",
  history: "H",
  prevTab: "[",
  nextTab: "]",

  // Billing
  billSearch: ["F2", "/"],
  customer: ["F3", "Alt+C"],
  nextPayment: ["F4", "Alt+P"],
  /** Jump to the amount box of the chosen payment method */
  payAmount: "Alt+A",
  heldBills: ["F6", "Alt+L"],
  holdBill: ["F7", "Alt+W"],
  saveBill: ["F8", "Mod+S"],
  savePrintBill: ["F9", "Mod+Enter"],
  salesReturn: "Alt+R",
  clearBill: ["Mod+Delete", "Mod+Backspace"],
  qtyUp: ["+", "="],
  qtyDown: "-",
  looseUp: "Alt+ArrowUp",
  looseDown: "Alt+ArrowDown",
  // Alt, not a plain letter: "D" typed in the search box (Dolo, Digene…)
  // must never change a discount
  nextDiscount: "Alt+D",

  // Reports
  exportReport: "Alt+X",

  // Dialogs
  save: "Mod+Enter",
  close: "Escape",
} as const;

export type ShortcutRow = { keys: string | readonly string[]; label: string };
export type ShortcutGroup = { title: string; rows: ShortcutRow[] };

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Anywhere",
    rows: [
      { keys: "Alt+1", label: "Dashboard … Alt+8 Settings (sidebar order)" },
      { keys: KEYS.newBill, label: "New bill" },
      { keys: KEYS.globalSearch, label: "Search everything" },
      { keys: KEYS.help, label: "Show this list" },
      { keys: KEYS.toggleSidebar, label: "Collapse / expand sidebar" },
    ],
  },
  {
    title: "Sales & Billing",
    rows: [
      { keys: KEYS.billSearch, label: "Search medicine / scan barcode" },
      {
        keys: ["ArrowUp", "ArrowDown"],
        label: "Move in results (then Enter to add)",
      },
      {
        keys: ["ArrowUp", "ArrowDown"],
        label: "Pick a bill line (when search is empty)",
      },
      { keys: ["+", "-"], label: "More / fewer packs on the line" },
      {
        keys: [KEYS.looseUp, KEYS.looseDown],
        label: "More / fewer loose units",
      },
      { keys: KEYS.nextDiscount, label: "Change discount on the line" },
      { keys: KEYS.remove, label: "Remove the line" },
      { keys: KEYS.customer, label: "Customer name" },
      {
        keys: KEYS.payAmount,
        label: "Type the amount (cash received / split)",
      },
      { keys: KEYS.nextPayment, label: "Next payment method" },
      { keys: KEYS.savePrintBill, label: "Save & print — one key bill" },
      { keys: KEYS.saveBill, label: "Save without printing" },
      { keys: KEYS.holdBill, label: "Hold bill" },
      { keys: KEYS.heldBills, label: "Held bills" },
      { keys: KEYS.salesReturn, label: "Sales return" },
      { keys: KEYS.clearBill, label: "Clear the bill" },
    ],
  },
  {
    title: "Lists — Medicines, Inventory, Purchases, Suppliers",
    rows: [
      { keys: KEYS.focusSearch, label: "Search" },
      { keys: ["ArrowUp", "ArrowDown"], label: "Move between rows" },
      { keys: [KEYS.listFirst, KEYS.listLast], label: "First / last row" },
      { keys: KEYS.open, label: "Open the selected row" },
      { keys: KEYS.create, label: "New (medicine, purchase, supplier)" },
      { keys: KEYS.edit, label: "Edit the selected row" },
      { keys: KEYS.remove, label: "Delete the selected medicine" },
      { keys: KEYS.history, label: "Batch history (Inventory)" },
      { keys: [KEYS.prevTab, KEYS.nextTab], label: "Previous / next tab" },
    ],
  },
  {
    title: "Dialogs & forms",
    rows: [
      { keys: KEYS.save, label: "Save" },
      { keys: KEYS.close, label: "Close / cancel" },
      { keys: ["Tab", "Shift+Tab"], label: "Next / previous field" },
    ],
  },
  {
    title: "Reports & Settings",
    rows: [
      {
        keys: [KEYS.prevTab, KEYS.nextTab],
        label: "Previous / next report or section",
      },
      { keys: KEYS.exportReport, label: "Export CSV" },
    ],
  },
];
