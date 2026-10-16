import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Percent, Stethoscope, UserRound } from "lucide-react";
import {
  MAX_RATE,
  personKey,
  type CommissionRates,
} from "@medicare/domain/reports/commission";
import { ModalShell } from "@/components/common/ModalShell";
import { DialogCloseButton } from "@/components/common/DialogCloseButton";
import { Segmented } from "@/components/common/Segmented";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/features/settings/store/useSettingsStore";
import { useUserStore } from "@/features/settings/store/useUserStore";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useCommissionStore } from "./useCommissionStore";

/** Names once each (first spelling wins), A to Z */
const unique = (names: string[]) => {
  const seen = new Map<string, string>();
  for (const n of names) {
    const clean = n.trim().replace(/\s+/g, " ");
    if (clean && !seen.has(personKey(clean))) seen.set(personKey(clean), clean);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
};

function RateList({
  icon: Icon,
  title,
  names,
  values,
  onChange,
  empty,
}: {
  icon: typeof Percent;
  title: string;
  names: string[];
  values: Record<string, string>;
  onChange: (name: string, v: string) => void;
  empty: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold">
        <Icon className="h-4 w-4 text-primary" />
        {tr(title)}
      </p>
      {names.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">{tr(empty)}</p>
      ) : (
        <ul className="max-h-[200px] divide-y divide-border/60 overflow-y-auto rounded-lg border border-border">
          {names.map((n) => (
            <li key={n} className="flex items-center gap-2 px-2.5 py-1.5">
              <span className="min-w-0 flex-1 truncate text-[12px]">{n}</span>
              <span className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={MAX_RATE}
                  step={0.5}
                  aria-label={`${n} — %`}
                  value={values[personKey(n)] ?? ""}
                  placeholder="0"
                  onChange={(e) => onChange(n, e.target.value)}
                  className="h-8 w-20 rounded-md border border-border bg-input pl-2 pr-6 text-right text-[12px] tabular-nums"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                  %
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Commission rates: on sales or on profit, % per doctor and per staff
 * member. Names come from Settings (doctors), the user list and the bills.
 */
export function RatesDialog({
  billDoctors,
  billStaff,
  onClose,
}: {
  billDoctors: string[];
  billStaff: string[];
  onClose: () => void;
}) {
  const rates = useCommissionStore((s) => s.rates);
  const saveRates = useCommissionStore((s) => s.saveRates);
  const settingsDoctors = useSettingsStore((s) => s.doctors);
  const users = useUserStore((s) => s.users);
  const loadUsers = useUserStore((s) => s.load);
  useEffect(() => void loadUsers().catch(() => {}), [loadUsers]);

  const [basis, setBasis] = useState(rates.basis);
  const toInputs = (r: Record<string, number>) =>
    Object.fromEntries(
      Object.entries(r).map(([n, p]) => [personKey(n), String(p)]),
    );
  const [doctors, setDoctors] = useState(() => toInputs(rates.doctors));
  const [staff, setStaff] = useState(() => toInputs(rates.staff));
  const [saving, setSaving] = useState(false);

  const doctorNames = useMemo(
    () =>
      unique([
        ...settingsDoctors,
        ...billDoctors,
        ...Object.keys(rates.doctors),
      ]),
    [settingsDoctors, billDoctors, rates.doctors],
  );
  const staffNames = useMemo(
    () =>
      unique([
        ...users.filter((u) => u.active).map((u) => u.name),
        ...billStaff,
        ...Object.keys(rates.staff),
      ]),
    [users, billStaff, rates.staff],
  );

  const toRates = (names: string[], v: Record<string, string>) => {
    const out: Record<string, number> = {};
    for (const n of names) {
      const p = Number(v[personKey(n)]);
      if (Number.isFinite(p) && p > 0) out[n] = Math.min(p, MAX_RATE);
    }
    return out;
  };
  const save = async () => {
    const next: CommissionRates = {
      basis,
      doctors: toRates(doctorNames, doctors),
      staff: toRates(staffNames, staff),
    };
    setSaving(true);
    try {
      await saveRates(next);
      toast.success(tr("Commission rates saved"));
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr("Could not save"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy="rates-title"
      className="max-w-2xl"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 id="rates-title" className="text-sm font-semibold">
            {tr("Commission rates")}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {tr(
              "Leave empty (0) for no commission — they still show in the report.",
            )}
          </p>
        </div>
        <DialogCloseButton onClick={onClose} />
      </div>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-medium">{tr("Commission on")}</span>
          <Segmented
            label="Commission on"
            value={basis}
            onChange={setBasis}
            options={[
              ["sales", "Bill amount"],
              ["profit", "Profit"],
            ]}
          />
          <span className={cn("text-[11px] text-muted-foreground")}>
            {tr(
              basis === "sales"
                ? "% of what the customer paid (after returns)"
                : "% of the profit on those bills (after returns)",
            )}
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <RateList
            icon={Stethoscope}
            title="Doctors"
            names={doctorNames}
            values={doctors}
            onChange={(n, v) => setDoctors({ ...doctors, [personKey(n)]: v })}
            empty="No doctors yet — add them in Settings → Doctors & counters, or pick one on a bill."
          />
          <RateList
            icon={UserRound}
            title="Staff"
            names={staffNames}
            values={staff}
            onChange={(n, v) => setStaff({ ...staff, [personKey(n)]: v })}
            empty="No staff yet"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="h-9 rounded-lg text-[12px]"
        >
          {tr("Cancel")}
        </Button>
        <Button
          type="button"
          data-primary
          disabled={saving}
          onClick={() => void save()}
          className="h-9 rounded-lg text-[12px]"
        >
          {tr("Save rates")}
        </Button>
      </div>
    </ModalShell>
  );
}
