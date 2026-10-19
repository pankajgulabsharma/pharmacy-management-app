import type { ReactNode } from "react";
import { toast } from "sonner";
import {
  Clock,
  Copy,
  Globe,
  LifeBuoy,
  Mail,
  MessageCircle,
  Phone,
} from "lucide-react";
import { VENDOR } from "@medicare/domain/vendor";
import { ModalShell } from "@/components/common/ModalShell";
import { DialogCloseButton } from "@/components/common/DialogCloseButton";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useSupportDetails } from "./useSupportDetails";
import { PoweredBy } from "./PoweredBy";

function Channel({
  href,
  icon: Icon,
  label,
  value,
  tone,
}: {
  href: string;
  icon: typeof Phone;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    // A button, not a link: the shop's details travel in the address, and
    // a link would show all of it in the corner on hover
    <button
      type="button"
      onClick={() => window.open(href, "_blank", "noopener,noreferrer")}
      className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left text-foreground transition hover:border-primary hover:shadow-sm"
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          tone,
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] text-muted-foreground">
          {tr(label)}
        </span>
        <span className="block truncate text-[13px] font-semibold group-hover:text-primary">
          {value}
        </span>
      </span>
    </button>
  );
}

/**
 * Help & support: call, WhatsApp or e-mail the provider — the shop's
 * details (machine code, licence, version) go along, so nobody has to
 * read them out on the phone.
 */
export function SupportDialog({ onClose }: { onClose: () => void }) {
  const { rows, text } = useSupportDetails();
  const subject = `MediCare support — ${rows.find(([k]) => k === "Shop")?.[1] ?? ""}`;
  const channels: ReactNode[] = [];
  if (VENDOR.whatsapp)
    channels.push(
      <Channel
        key="wa"
        href={`https://wa.me/${VENDOR.whatsapp}?text=${encodeURIComponent(`Hello, I need help with MediCare.\n\n${text}`)}`}
        icon={MessageCircle}
        label="WhatsApp"
        value={`+${VENDOR.whatsapp}`}
        tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
      />,
    );
  if (VENDOR.phone)
    channels.push(
      <Channel
        key="call"
        href={`tel:${VENDOR.phone.replace(/\s/g, "")}`}
        icon={Phone}
        label="Call"
        value={VENDOR.phone}
        tone="bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400"
      />,
    );
  if (VENDOR.email)
    channels.push(
      <Channel
        key="mail"
        href={`mailto:${VENDOR.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`\n\n---\n${text}`)}`}
        icon={Mail}
        label="E-mail"
        value={VENDOR.email}
        tone="bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400"
      />,
    );
  if (VENDOR.website)
    channels.push(
      <Channel
        key="web"
        href={VENDOR.website}
        icon={Globe}
        label="Website"
        value={VENDOR.website.replace(/^https?:\/\//, "")}
        tone="bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
      />,
    );

  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy="support-title"
      className="max-w-lg"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <LifeBuoy className="h-6 w-6" />
          </span>
          <div>
            <h2 id="support-title" className="text-[15px] font-semibold">
              {tr("Help & support")}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {VENDOR.company}
              {VENDOR.hours ? (
                <span className="ml-2 inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {tr(VENDOR.hours)}
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <DialogCloseButton onClick={onClose} />
      </div>

      <div className="space-y-4 p-5">
        {channels.length ? (
          <div className="grid gap-2 sm:grid-cols-2">{channels}</div>
        ) : (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            {tr(
              "Support contact details are not filled in yet (packages/domain/src/vendor.ts).",
            )}
          </p>
        )}

        <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3 text-foreground">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12px] font-semibold text-foreground">
              {tr("Your details for support")}
            </p>
            <button
              type="button"
              onClick={() =>
                navigator.clipboard
                  ?.writeText(text)
                  .then(() => toast.success(tr("Copied")))
              }
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            >
              <Copy className="h-3.5 w-3.5" />
              {tr("Copy")}
            </button>
          </div>
          <dl className="grid grid-cols-[110px_1fr] gap-y-1 text-[12px]">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{tr(k)}</dt>
                <dd className="truncate font-medium text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-[10px] text-muted-foreground">
            {tr("WhatsApp and e-mail send these along by themselves.")}
          </p>
        </div>
      </div>

      <div className="border-t border-border px-5 py-3">
        <PoweredBy />
      </div>
    </ModalShell>
  );
}
