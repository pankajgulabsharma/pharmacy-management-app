import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { tr } from "@/lib/i18n";
import { useAuthStore, useCurrentUser } from "../store/useAuthStore";
import { ChangePasswordForm } from "./ChangePasswordForm";

/**
 * Guards every screen: signed-out users go to Login and come back after.
 * Signed in with a starter / reset password → choose your own first.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }
  if (user.mustChangePassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-xl p-5 space-y-3">
          <h1 className="text-base font-semibold inline-flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            {tr("Choose your own password")}
          </h1>
          <p className="text-[12px] text-muted-foreground">
            {tr(
              "Hi {{name}} — you signed in with a starter password. Pick a new one that only you know.",
              { name: user.name },
            )}
          </p>
          <ChangePasswordForm
            onDone={() => {}}
            onCancel={() => void logout()}
            cancelLabel="Sign out"
          />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
