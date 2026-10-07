import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHotkeys } from "@/hooks/useHotkeys";
import { useUIStore } from "@/stores/useUIStore";
import { useAuthStore } from "@/features/auth/store/useAuthStore";
import { KEYS, navItemsFor } from "./registry";
import { ShortcutsDialog } from "./ShortcutsDialog";

/** App-wide keys: switch screens, new bill, help. Mounted once in AppLayout. */
export function GlobalShortcuts() {
  const navigate = useNavigate();
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const [helpOpen, setHelpOpen] = useState(false);
  const role = useAuthStore((s) => s.session?.user.role);

  useHotkeys([
    ...navItemsFor(role).map((item) => ({
      keys: item.keys,
      handler: () => navigate(item.to),
    })),
    // New bill from anywhere: open billing with the search box focused
    { keys: KEYS.newBill, handler: () => navigate("/billing?focus=search") },
    { keys: KEYS.help, handler: () => setHelpOpen(true) },
    { keys: KEYS.toggleSidebar, handler: toggleSidebar },
  ]);

  return <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />;
}
