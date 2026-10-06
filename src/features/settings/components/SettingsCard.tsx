import type { FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useTr } from "@/hooks/useTr";

type Props = {
  title: string;
  description: string;
  children: ReactNode;
  /** Form actions (omit for read-only sections) */
  dirty?: boolean;
  onSubmit?: () => void;
  onDiscard?: () => void;
};

/** One settings section: heading, fields, and Save / Discard bar */
export function SettingsCard({
  title,
  description,
  children,
  dirty,
  onSubmit,
  onDiscard,
}: Props) {
  const tr = useTr();
  const handle = (e: FormEvent) => {
    e.preventDefault();
    onSubmit?.();
  };

  return (
    <form
      onSubmit={handle}
      noValidate
      className="rounded-xl border border-border bg-card"
    >
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{tr(title)}</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {tr(description)}
        </p>
      </div>
      <div className="p-4 space-y-3">{children}</div>
      {onSubmit ? (
        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5">
          <p className="text-[10px] text-muted-foreground" role="status">
            {dirty ? "You have unsaved changes" : "All changes saved"}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!dirty}
              onClick={onDiscard}
              className="h-8 rounded-lg text-[11px]"
            >
              Discard changes
            </Button>
            <Button
              type="submit"
              disabled={!dirty}
              className="h-8 rounded-lg text-[11px]"
            >
              Save
            </Button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
