import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, CheckCircle2, Copy, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@medicare/domain/auth/types";
import { checkPassword } from "@medicare/domain/auth/users";
import {
  validateShop,
  type Errors,
} from "@medicare/domain/settings/validation";
import type { ShopProfile } from "@medicare/domain/settings/types";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { printRecoveryCode } from "./printRecoveryCode";

type Shop = Pick<
  ShopProfile,
  "name" | "phone" | "address" | "drugLicense" | "gstin"
>;
type Done = {
  token: string;
  expiresAt: number;
  user: User;
  recoveryCode: string;
  /** As typed on the form (printed on the recovery slip) */
  shopName: string;
};

const input =
  "h-10 w-full rounded-xl border border-border bg-input px-3 text-[13px] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function Field({
  id,
  label,
  error,
  optional,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-[11px] font-medium">
        {tr(label)}
        {optional ? (
          <span className="ml-1 font-normal text-muted-foreground">
            ({tr("optional")})
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="text-[11px] text-red-600" role="alert">
          {tr(error)}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Brand-new shop: everything needed in ONE screen — the shop's details
 * (they print on every bill) and the owner's own name and password.
 * Then straight in. Everything can be changed later in Settings.
 */
export function SetupPanel({
  onDone,
}: {
  /** Signed in — show the recovery code, then open the shop */
  onDone: (r: Done) => void;
}) {
  const [shop, setShop] = useState<Shop>({
    name: "",
    phone: "",
    address: "",
    drugLicense: "",
    gstin: "",
  });
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [errors, setErrors] = useState<
    Errors<ShopProfile> & { owner?: string; password?: string; again?: string }
  >({});
  const [busy, setBusy] = useState(false);

  const set = (k: keyof Shop) => (v: string) => {
    setShop({ ...shop, [k]: v });
    setErrors({ ...errors, [k]: undefined });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found: typeof errors = validateShop({
      ...shop,
      email: "",
      gstScheme: "regular",
    });
    if (name.trim().length < 2) found.owner = "Enter your name";
    const pw = checkPassword(password, "admin");
    if (pw) found.password = pw;
    else if (password.toLowerCase() === "admin")
      found.password = "Choose a password only you know (not “admin”)";
    else if (password !== again) found.again = "The two passwords differ";
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    setBusy(true);
    try {
      const r = await apiRequest<Omit<Done, "shopName">>("POST", "/api/setup", {
        shop,
        owner: { name: name.trim(), password },
      });
      onDone({ ...r, shopName: shop.name.trim() });
    } catch (err) {
      toast.error(tr(err instanceof Error ? err.message : "Could not save"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <h1 className="text-[20px] font-semibold">
          {tr("Welcome! Set up your shop")}
        </h1>
        <p className="text-[12px] text-muted-foreground">
          {tr("One minute — you can change all of this later in Settings.")}
        </p>
      </div>

      <fieldset className="space-y-2.5">
        <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
          {tr("Your shop")}
        </legend>
        <Field id="setup-shop" label="Shop name" error={errors.name}>
          <input
            id="setup-shop"
            autoFocus
            value={shop.name}
            onChange={(e) => set("name")(e.target.value)}
            placeholder="e.g. Sharma Medical & General Stores"
            className={input}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2.5">
          <Field id="setup-phone" label="Mobile" error={errors.phone}>
            <input
              id="setup-phone"
              inputMode="tel"
              value={shop.phone}
              onChange={(e) => set("phone")(e.target.value)}
              placeholder="98XXXXXXXX"
              className={input}
            />
          </Field>
          <Field
            id="setup-dl"
            label="Drug licence no."
            error={errors.drugLicense}
          >
            <input
              id="setup-dl"
              value={shop.drugLicense}
              onChange={(e) => set("drugLicense")(e.target.value)}
              placeholder="20B / 21B no."
              className={input}
            />
          </Field>
        </div>
        <Field id="setup-address" label="Address" error={errors.address}>
          <input
            id="setup-address"
            value={shop.address}
            onChange={(e) => set("address")(e.target.value)}
            placeholder="Shop no., road, city, PIN"
            className={input}
          />
        </Field>
        <Field id="setup-gstin" label="GSTIN" optional error={errors.gstin}>
          <input
            id="setup-gstin"
            value={shop.gstin}
            onChange={(e) => set("gstin")(e.target.value.toUpperCase())}
            placeholder="27ABCDE1234F1Z5"
            className={cn(input, "font-mono")}
          />
        </Field>
      </fieldset>

      <fieldset className="space-y-2.5">
        <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
          {tr("You (owner)")}
        </legend>
        <Field id="setup-owner" label="Your name" error={errors.owner}>
          <input
            id="setup-owner"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors({ ...errors, owner: undefined });
            }}
            placeholder="e.g. Rakesh Sharma"
            className={input}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2.5">
          <Field id="setup-pw" label="Password" error={errors.password}>
            <input
              id="setup-pw"
              type="password"
              autoComplete="one-time-code"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors({ ...errors, password: undefined });
              }}
              placeholder={tr("6+ characters")}
              className={input}
            />
          </Field>
          <Field id="setup-again" label="Password again" error={errors.again}>
            <input
              id="setup-again"
              type="password"
              autoComplete="one-time-code"
              value={again}
              onChange={(e) => {
                setAgain(e.target.value);
                setErrors({ ...errors, again: undefined });
              }}
              className={input}
            />
          </Field>
        </div>
      </fieldset>

      <Button
        type="submit"
        disabled={busy}
        className="h-11 w-full rounded-xl text-[13px] gap-1.5"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowRight className="h-4 w-4" />
        )}
        {tr("Start using MediCare")}
      </Button>
    </form>
  );
}

/** Done: the recovery code, once — then into the shop */
export function SetupDone({
  name,
  code,
  shop,
  onOpen,
}: {
  name: string;
  code: string;
  shop: string;
  onOpen: () => void;
}) {
  return (
    <div className="space-y-5 text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
      <div>
        <h1 className="text-[20px] font-semibold">
          {tr("All set, {{name}}!", { name })}
        </h1>
        <p className="text-[12px] text-muted-foreground">
          {tr(
            "If you ever forget your password, this code lets you back in. Print it or write it down and keep it at home — it is shown only now.",
          )}
        </p>
      </div>
      <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-4">
        <p className="font-mono text-2xl font-semibold tracking-[0.25em]">
          {code}
        </p>
        <button
          type="button"
          onClick={() =>
            navigator.clipboard
              ?.writeText(code)
              .then(() => toast.success(tr("Copied")))
          }
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
        >
          <Copy className="h-3.5 w-3.5" />
          {tr("Copy")}
        </button>
        <button
          type="button"
          onClick={() => void printRecoveryCode(code, shop).catch(() => {})}
          className="mt-2 ml-4 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
        >
          <Printer className="h-3.5 w-3.5" />
          {tr("Print")}
        </button>
      </div>
      <Button
        type="button"
        autoFocus
        onClick={onOpen}
        className="h-11 w-full rounded-xl text-[13px] gap-1.5"
      >
        {tr("Open MediCare")}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
