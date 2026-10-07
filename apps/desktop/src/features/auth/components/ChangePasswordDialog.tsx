import { useId } from "react";
import { KeyRound } from "lucide-react";
import { ModalShell } from "@/components/common/ModalShell";
import { tr } from "@/lib/i18n";
import { ChangePasswordForm } from "./ChangePasswordForm";

/** Account menu → Change password (other devices get signed out) */
export function ChangePasswordDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  if (!open) return null;
  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy={titleId}
      className="w-full max-w-sm"
    >
      <div className="p-4 space-y-3">
        <h2
          id={titleId}
          className="text-sm font-semibold inline-flex items-center gap-2"
        >
          <KeyRound className="h-4 w-4 text-primary" />
          {tr("Change password")}
        </h2>
        <p className="text-[11px] text-muted-foreground">
          {tr("Other computers signed in as you will be signed out.")}
        </p>
        <ChangePasswordForm onDone={onClose} onCancel={onClose} />
      </div>
    </ModalShell>
  );
}
