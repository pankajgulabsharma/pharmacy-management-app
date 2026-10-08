import { useState } from "react";
import {
  BadgeCheck,
  Building2,
  Database,
  HardDriveDownload,
  Printer,
  Network,
  Palette,
  Receipt,
  Settings as SettingsIcon,
  Stethoscope,
  UserCog,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/PageHeader";
import { useHotkeys } from "@/hooks/useHotkeys";
import { KEYS } from "@/app/shortcuts/registry";
import {
  AppearanceSection,
  BillingSection,
  DataSection,
  InventorySection,
  ListsSection,
  ShopProfileSection,
} from "../components/SettingsSections";
import { UsersSection } from "../components/UsersSection";
import { BackupSection } from "../components/BackupSection";
import { NetworkSection } from "../components/NetworkSection";
import { PrintingSection } from "../components/PrintingSection";
import { LicenseSection } from "../components/LicenseSection";
import { oneOf, useUrlIntent } from "@/hooks/useUrlIntent";
import { tr } from "@/lib/i18n";

type SectionId =
  | "shop"
  | "billing"
  | "inventory"
  | "lists"
  | "users"
  | "printing"
  | "backup"
  | "network"
  | "license"
  | "appearance"
  | "data";

const SECTIONS: {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  Component: () => React.JSX.Element;
}[] = [
  {
    id: "shop",
    label: "Shop profile",
    icon: Building2,
    Component: ShopProfileSection,
  },
  { id: "billing", label: "Billing", icon: Receipt, Component: BillingSection },
  {
    id: "inventory",
    label: "Stock & expiry",
    icon: Warehouse,
    Component: InventorySection,
  },
  {
    id: "lists",
    label: "Doctors & counters",
    icon: Stethoscope,
    Component: ListsSection,
  },
  {
    id: "users",
    label: "Users & roles",
    icon: UserCog,
    Component: UsersSection,
  },
  {
    id: "printing",
    label: "Printing",
    icon: Printer,
    Component: PrintingSection,
  },
  {
    id: "backup",
    label: "Backup & restore",
    icon: HardDriveDownload,
    Component: BackupSection,
  },
  {
    id: "network",
    label: "This computer & network",
    icon: Network,
    Component: NetworkSection,
  },
  {
    id: "license",
    label: "Licence",
    icon: BadgeCheck,
    Component: LicenseSection,
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: Palette,
    Component: AppearanceSection,
  },
  { id: "data", label: "Data", icon: Database, Component: DataSection },
];

export default function SettingsPage() {
  // ?section=license (e.g. from the licence banner) opens that section
  const intent = useUrlIntent();
  const [active, setActive] = useState<SectionId>(
    oneOf(
      intent.section,
      SECTIONS.map((s) => s.id),
      "shop",
    ),
  );
  const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

  // Keyboard: [ ] previous / next section
  const step = (d: number) => {
    const i = SECTIONS.findIndex((x) => x.id === active);
    setActive(SECTIONS[(i + d + SECTIONS.length) % SECTIONS.length].id);
  };
  useHotkeys([
    { keys: KEYS.prevTab, handler: () => step(-1) },
    { keys: KEYS.nextTab, handler: () => step(1) },
  ]);
  const Active = section.Component;

  return (
    <div className="h-full w-full p-3 overflow-hidden box-border bg-background flex flex-col gap-2.5 min-h-0">
      <PageHeader
        icon={SettingsIcon}
        title="Settings"
        subtitle="Shop profile · billing · stock · lists · users · printing · backup · network · appearance"
      />

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3">
        <nav
          aria-label="Settings sections"
          className="rounded-xl border border-border bg-card p-1.5 h-fit"
        >
          <ul className="space-y-0.5">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setActive(id)}
                  aria-current={active === id ? "page" : undefined}
                  className={cn(
                    "w-full h-9 px-2.5 rounded-lg text-[12px] inline-flex items-center gap-2 transition-colors",
                    active === id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tr(label)}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-h-0 overflow-y-auto pr-0.5">
          {/* key: each section starts with fresh form state */}
          <Active key={active} />
        </div>
      </div>
    </div>
  );
}
