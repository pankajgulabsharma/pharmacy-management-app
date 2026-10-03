import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Open modals, innermost last. Only the topmost one reacts to Esc / Tab,
 * so a dialog opened from another dialog closes on its own.
 */
const modalStack: symbol[] = [];

type Props = {
  open: boolean;
  onClose: () => void;
  /** id of the element that names the dialog */
  labelledBy: string;
  describedBy?: string;
  role?: "dialog" | "alertdialog";
  className?: string;
  children: ReactNode;
};

/**
 * Accessible modal container:
 * - Esc and backdrop click call onClose
 * - focus moves inside on open ([data-autofocus] first) and is trapped
 * - focus returns to the previously focused element on close
 * - stacking-safe: only the topmost modal handles keys
 */
export function ModalShell({
  open,
  onClose,
  labelledBy,
  describedBy,
  role = "dialog",
  className,
  children,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const token = Symbol("modal");
    modalStack.push(token);
    const panel = panelRef.current;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const initial =
      panel?.querySelector<HTMLElement>("[data-autofocus]") ??
      panel?.querySelector<HTMLElement>(FOCUSABLE);
    initial?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== token) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;

      const nodes = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const i = modalStack.indexOf(token);
      if (i >= 0) modalStack.splice(i, 1);
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        aria-hidden="true"
        onClick={() => onCloseRef.current()}
      />
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={cn(
          "relative z-10 w-full rounded-xl border border-border bg-card shadow-xl",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
