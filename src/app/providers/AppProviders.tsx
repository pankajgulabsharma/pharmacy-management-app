import { ThemeProvider } from "./ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { type ReactNode } from "react";
import "@/lib/i18n";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      {children}
      <Toaster richColors position="top-center" closeButton duration={2000} />
    </ThemeProvider>
  );
}
