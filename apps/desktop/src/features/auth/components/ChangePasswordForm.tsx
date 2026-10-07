import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { checkPassword } from "@medicare/domain/auth/users";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/common/FormField";
import { fieldClass, invalidFieldClass } from "@/components/common/formStyles";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";
import { useAuthStore } from "../store/useAuthStore";

/**
 * Current + new + repeat. Used from the account menu, and as the forced
 * first step when someone signs in with a starter / reset password.
 */
export function ChangePasswordForm({
  onDone,
  onCancel,
  cancelLabel = "Cancel",
}: {
  onDone: () => void;
  onCancel: () => void;
  cancelLabel?: string;
}) {
  const id = useId();
  const username = useAuthStore((s) => s.session?.user.username ?? "");
  const changePassword = useAuthStore((s) => s.changePassword);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  const nextError =
    checkPassword(next, username) ??
    (next === current && next ? "Choose a different password" : null);
  const repeatError = repeat !== next ? "Passwords don't match" : null;
  const show = (e: string | null) => (tried ? (e ?? undefined) : undefined);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!current || nextError || repeatError) return;
    setSaving(true);
    try {
      await changePassword(current, next);
      toast.success(tr("Password changed"));
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <FormField
        label="Current password"
        htmlFor={`${id}-cur`}
        error={show(current ? null : "Required")}
      >
        <input
          id={`${id}-cur`}
          type="password"
          autoComplete="current-password"
          data-autofocus
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className={cn(fieldClass, tried && !current && invalidFieldClass)}
        />
      </FormField>
      <FormField
        label="New password"
        htmlFor={`${id}-new`}
        error={show(nextError)}
        hint="At least 6 characters"
      >
        <input
          id={`${id}-new`}
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className={cn(fieldClass, show(nextError) && invalidFieldClass)}
        />
      </FormField>
      <FormField
        label="Repeat new password"
        htmlFor={`${id}-rep`}
        error={show(repeatError)}
      >
        <input
          id={`${id}-rep`}
          type="password"
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          className={cn(fieldClass, show(repeatError) && invalidFieldClass)}
        />
      </FormField>
      <div className="flex justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="h-9 rounded-lg text-[12px]"
        >
          {tr(cancelLabel)}
        </Button>
        <Button
          type="submit"
          disabled={saving}
          className="h-9 rounded-lg text-[12px]"
        >
          {tr("Change password")}
        </Button>
      </div>
    </form>
  );
}
