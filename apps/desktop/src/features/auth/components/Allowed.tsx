import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import type { Permission } from "@medicare/domain/auth/permissions";
import { Button } from "@/components/ui/button";
import { tr } from "@/lib/i18n";
import { useCan } from "../store/useAuthStore";

/** A screen your role can't use (e.g. typed address) → a clear "no access" */
export function Allowed({
  perm,
  children,
}: {
  perm: Permission;
  children: ReactNode;
}) {
  if (useCan(perm)) return <>{children}</>;
  return (
    <div className="h-full w-full flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto h-12 w-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-lg font-semibold">{tr("No access")}</h1>
        <p className="mt-1 text-[12px] text-muted-foreground">
          {tr("Your role can't open this screen — ask the owner.")}
        </p>
        <Button
          nativeButton={false}
          render={<Link to="/dashboard" />}
          className="mt-5 h-9 rounded-lg text-[12px]"
        >
          {tr("Go to Dashboard")}
        </Button>
      </div>
    </div>
  );
}
