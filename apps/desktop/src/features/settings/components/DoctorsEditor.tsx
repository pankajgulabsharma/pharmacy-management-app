import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Stethoscope, Trash2 } from "lucide-react";
import {
  doctorDetails,
  doctorName,
  DOCTOR_LIMITS,
  EMPTY_DOCTOR_INFO,
  type DoctorInfo,
} from "@medicare/domain/doctors/doctor";
import { SETTINGS_LIMITS as L } from "@medicare/domain/settings/types";
import { fieldClass, invalidFieldClass } from "@/components/common/formStyles";
import { Button } from "@/components/ui/button";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "../store/useSettingsStore";

type Draft = { name: string } & DoctorInfo;
const EMPTY: Draft = { name: "", ...EMPTY_DOCTOR_INFO };

/**
 * Settings → Doctors: the billing pick-list. Name is written "Dr. …" by
 * itself; registration no., clinic and phone are optional — they print on
 * the Schedule H1 / X register next to the doctor's name.
 */
export function DoctorsEditor() {
  const doctors = useSettingsStore((s) => s.doctors);
  const info = useSettingsStore((s) => s.doctorInfo);
  const setDoctors = useSettingsStore((s) => s.setDoctors);
  const [editing, setEditing] = useState<string | null>(null);

  const save = async (
    list: string[],
    nextInfo: Record<string, DoctorInfo>,
    ok: string,
  ) => {
    try {
      await setDoctors(list, nextInfo);
      toast.success(ok);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("Could not save"));
      return false;
    }
  };

  const put = async (d: Draft, was: string | null) => {
    const name = doctorName(d.name);
    const list = was
      ? doctors.map((x) => (x === was ? name : x))
      : [...doctors, name];
    const nextInfo = { ...info };
    if (was) delete nextInfo[was];
    nextInfo[name] = { regNo: d.regNo, clinic: d.clinic, phone: d.phone };
    return save(
      list,
      nextInfo,
      tr(was ? "Doctor saved" : "{{name}} added", { name }),
    );
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium">
        {tr("Doctors")}{" "}
        <span className="font-normal text-muted-foreground">
          ({doctors.length}/{L.maxDoctors})
        </span>
      </p>
      {doctors.length ? (
        <ul className="divide-y divide-border/70 rounded-lg border border-border">
          {doctors.map((d) =>
            editing === d ? (
              <li key={d} className="bg-muted/30 p-3">
                <DoctorForm
                  initial={{ name: d, ...(info[d] ?? EMPTY_DOCTOR_INFO) }}
                  taken={doctors.filter((x) => x !== d)}
                  submitLabel={tr("Save")}
                  onCancel={() => setEditing(null)}
                  onSubmit={async (draft) => {
                    if (await put(draft, d)) setEditing(null);
                  }}
                />
              </li>
            ) : (
              <li key={d} className="group flex items-center gap-3 px-3 py-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                  <Stethoscope className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium">{d}</p>
                  <p className="truncate text-[10.5px] text-muted-foreground">
                    {[doctorDetails(info[d]), info[d]?.phone]
                      .filter(Boolean)
                      .join(" · ") || tr("No registration no. / clinic yet")}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={tr("Edit {{name}}", { name: d })}
                  onClick={() => setEditing(d)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={tr("Remove {{what}}", { what: d })}
                  onClick={() => {
                    const nextInfo = { ...info };
                    delete nextInfo[d];
                    void save(
                      doctors.filter((x) => x !== d),
                      nextInfo,
                      tr("{{name}} removed", { name: d }),
                    );
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ),
          )}
        </ul>
      ) : null}
      {doctors.length < L.maxDoctors ? (
        <div className="rounded-lg border border-dashed border-border p-3">
          <DoctorForm
            initial={EMPTY}
            taken={doctors}
            submitLabel={tr("Add doctor")}
            onSubmit={(d) => put(d, null).then(() => undefined)}
            resetOnSubmit
          />
        </div>
      ) : null}
    </div>
  );
}

function DoctorForm({
  initial,
  taken,
  submitLabel,
  onSubmit,
  onCancel,
  resetOnSubmit,
}: {
  initial: Draft;
  taken: readonly string[];
  submitLabel: string;
  onSubmit: (d: Draft) => Promise<void>;
  onCancel?: () => void;
  resetOnSubmit?: boolean;
}) {
  const [d, setD] = useState<Draft>(initial);
  const [error, setError] = useState("");
  const name = doctorName(d.name);
  const set = (k: keyof Draft, v: string) => {
    setD({ ...d, [k]: v });
    setError("");
  };
  const submit = async () => {
    if (!name) return setError(tr("Type the doctor's name"));
    if (taken.some((x) => x.toLowerCase() === name.toLowerCase()))
      return setError(tr("Already in the list"));
    await onSubmit(d);
    if (resetOnSubmit) setD(EMPTY);
  };
  return (
    // Not a <form>: Settings cards are forms already (Enter adds here)
    <div
      onKeyDown={(e) => {
        if (
          e.key === "Enter" &&
          (e.target as HTMLElement).tagName === "INPUT"
        ) {
          e.preventDefault();
          void submit();
        }
      }}
      className="space-y-2"
    >
      <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr]">
        <label className="block">
          <span className="mb-1 block text-[10.5px] text-muted-foreground">
            {tr("Name & degree")}
          </span>
          <input
            value={d.name}
            maxLength={DOCTOR_LIMITS.nameMax}
            placeholder={tr("e.g. Anita Mehta, MBBS")}
            onChange={(e) => set("name", e.target.value)}
            aria-invalid={Boolean(error)}
            className={cn(fieldClass, "h-8", error && invalidFieldClass)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10.5px] text-muted-foreground">
            {tr("Registration no. (optional)")}
          </span>
          <input
            value={d.regNo}
            maxLength={DOCTOR_LIMITS.regNoMax}
            placeholder={tr("e.g. MMC 2012/06/5528")}
            onChange={(e) => set("regNo", e.target.value)}
            className={cn(fieldClass, "h-8")}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10.5px] text-muted-foreground">
            {tr("Clinic / hospital (optional)")}
          </span>
          <input
            value={d.clinic}
            maxLength={DOCTOR_LIMITS.clinicMax}
            placeholder={tr("e.g. Mehta Clinic, Naupada")}
            onChange={(e) => set("clinic", e.target.value)}
            className={cn(fieldClass, "h-8")}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10.5px] text-muted-foreground">
            {tr("Phone (optional)")}
          </span>
          <input
            value={d.phone}
            inputMode="tel"
            maxLength={DOCTOR_LIMITS.phoneMax}
            placeholder="98200 12345"
            onChange={(e) => set("phone", e.target.value)}
            className={cn(fieldClass, "h-8")}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <p
          className={cn(
            "mr-auto text-[10.5px]",
            error ? "text-rose-600" : "text-muted-foreground",
          )}
        >
          {error ||
            (name
              ? tr("Saved as “{{name}}”", { name })
              : tr("“Dr.” is added by itself"))}
        </p>
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="h-8 rounded-lg text-[11px]"
          >
            {tr("Cancel")}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          onClick={() => void submit()}
          className="h-8 gap-1 rounded-lg text-[11px]"
        >
          {onCancel ? null : <Plus className="h-3.5 w-3.5" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
