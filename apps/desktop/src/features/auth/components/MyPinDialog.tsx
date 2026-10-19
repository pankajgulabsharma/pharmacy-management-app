import { useState } from "react";
import { toast } from "sonner";
import { RectangleEllipsis } from "lucide-react";
import { PIN_LENGTH, checkPin } from "@medicare/domain/auth/users";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FormField } from "@/components/common/FormField";
import { fieldClass } from "@/components/common/formStyles";
import { apiRequest } from "@/lib/api";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * My own counter PIN (owner too): tap my name + 4 digits instead of the
 * password. Needs my password, so an open screen can't change it.
 * Forgot the PIN later? "Use password instead" on the sign-in screen.
 */
export function MyPinDialog({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const bad = checkPin(pin);
  const save = (value: string | null, done: string) =>
    apiRequest("POST", "/api/auth/pin", { password, pin: value }).then(
      () => {
        toast.success(tr(done));
        onClose();
      },
      (err: unknown) =>
        toast.error(
          err instanceof Error ? tr(err.message) : tr("Could not save"),
        ),
    );
  return (
    <ConfirmDialog
      open
      tone="default"
      icon={RectangleEllipsis}
      title={tr("My PIN")}
      description={tr(
        "Sign in faster: tap your name and type 4 digits. Your password keeps working too.",
      )}
      confirmLabel="Save PIN"
      cancelLabel="Cancel"
      confirmDisabled={bad !== null || !password}
      onConfirm={() => void save(pin, "PIN saved")}
      onClose={onClose}
    >
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Your password" htmlFor="my-pin-pw">
          <input
            id="my-pin-pw"
            data-autofocus
            type="password"
            autoComplete="one-time-code"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldClass}
          />
        </FormField>
        <FormField
          label="New PIN"
          htmlFor="my-pin"
          hint={
            pin.length === PIN_LENGTH && bad
              ? bad
              : "Any 4 digits"
          }
        >
          <input
            id="my-pin"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={PIN_LENGTH}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className={cn(fieldClass, "text-center font-mono tracking-[0.5em]")}
          />
        </FormField>
      </div>
      <button
        type="button"
        disabled={!password}
        onClick={() => void save(null, "PIN removed — password only now")}
        className="text-[11px] font-medium text-red-600 hover:underline disabled:opacity-50"
      >
        {tr("Remove my PIN")}
      </button>
    </ConfirmDialog>
  );
}
