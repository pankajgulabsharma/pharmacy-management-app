import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { isTopModal, popModal, pushModal } from "@/lib/modalStack";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

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
    const token = pushModal();
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
      if (!isTopModal(token)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      // Ctrl/⌘ + Enter (or + S) submits the dialog's form — save without the mouse
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === "Enter" || e.key.toLowerCase() === "s")) {
        const form = panel?.querySelector("form");
        if (form) {
          e.preventDefault();
          form.requestSubmit();
          return;
        }
        const primary = panel?.querySelector<HTMLButtonElement>(
          "[data-primary]:not([disabled])",
        );
        if (primary) {
          e.preventDefault();
          primary.click();
          return;
        }
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
      popModal(token);
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
