import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { Moon, Sun, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function ThemeLanguageSwitcher() {
  const { theme, setTheme } = useTheme();
  const { i18n } = useTranslation();
  const isDark = theme === "dark";

  return (
    <div className="flex items-center gap-2">
      {/* Language — Base UI uses `render` (not Radix `asChild`) to swap the trigger element */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" className="h-9 w-9" />}
          aria-label="Change language"
        >
          <Languages className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="z-50 min-w-[140px] rounded-xl border border-border bg-popover text-popover-foreground shadow-lg"
        >
          <DropdownMenuItem
            onClick={() => i18n.changeLanguage("en")}
            className="cursor-pointer"
          >
            English
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => i18n.changeLanguage("hi")}
            className="cursor-pointer"
          >
            हिन्दी
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Theme toggle */}
      <button
        type="button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
        className={cn(
          "relative inline-flex h-9 w-[72px] items-center rounded-full transition-colors duration-300 focus:outline-none",
          isDark ? "bg-slate-700" : "bg-slate-200",
        )}
      >
        <span
          className={cn(
            "absolute top-1 left-1 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300",
            isDark && "translate-x-9",
          )}
        >
          {isDark ? (
            <Moon className="h-4 w-4 text-slate-800" />
          ) : (
            <Sun className="h-4 w-4 text-yellow-500" />
          )}
        </span>
      </button>
    </div>
  );
}
