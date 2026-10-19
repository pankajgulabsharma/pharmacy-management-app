import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, Lock } from "lucide-react";
import { ROLE_LABELS, type SignInPerson } from "@medicare/domain/auth/types";
import { checkPassword, formatRecoveryCode } from "@medicare/domain/auth/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "../components/PersonAvatar";
import { PinPad } from "./PinPad";

const inputClass =
  "h-11 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-ring";

/* ------------------------------------------------------------------ */

/** "Who is signing in?" — one tile per person */
export function PeopleGrid({
  people,
  onPick,
}: {
  people: SignInPerson[];
  onPick: (p: SignInPerson) => void;
}) {
  return (
    <ul
      className={cn(
        "grid gap-3",
        people.length > 4 ? "grid-cols-3" : "grid-cols-2",
      )}
      aria-label={tr("People who can sign in")}
    >
      {people.map((p, i) => (
        <li key={p.id}>
          <button
            type="button"
            autoFocus={i === 0}
            onClick={() => onPick(p)}
            className="group flex w-full flex-col items-center gap-2 rounded-2xl border border-border bg-card px-3 py-4 text-center transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PersonAvatar id={p.id} name={p.name} />
            <span className="w-full truncate text-[13px] font-semibold">
              {p.name}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              {p.method === "pin" ? (
                <KeyRound className="h-3 w-3" />
              ) : (
                <Lock className="h-3 w-3" />
              )}
              {tr(ROLE_LABELS[p.role])} ·{" "}
              {tr(p.method === "pin" ? "PIN" : "Password")}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */

/** Back arrow + the chosen person, on top of the PIN / password panel */
export function PersonHeader({
  person,
  onBack,
  children,
}: {
  person: SignInPerson;
  onBack: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="relative flex flex-col items-center gap-2 text-center">
      <button
        type="button"
        onClick={onBack}
        aria-label={tr("Back")}
        title={`${tr("Back")} (Esc)`}
        className="absolute left-0 top-0 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <PersonAvatar id={person.id} name={person.name} size="lg" />
      <div>
        <p className="text-[16px] font-semibold">{person.name}</p>
        <p className="text-[11px] text-muted-foreground">
          {tr(ROLE_LABELS[person.role])}
        </p>
      </div>
      {children}
    </div>
  );
}

export function PinPanel({
  person,
  onBack,
  onSubmit,
  onUsePassword,
}: {
  person: SignInPerson;
  onBack: () => void;
  /** Resolves to an error message, or null when signed in */
  onSubmit: (pin: string) => Promise<string | null>;
  /** Forgot the PIN → sign in with the password */
  onUsePassword: () => void;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(0);

  const submit = async (value: string) => {
    setBusy(true);
    const err = await onSubmit(value);
    setBusy(false);
    if (err) {
      setError(err);
      setPin("");
      setShake((n) => n + 1);
    }
  };

  return (
    <div className="space-y-6">
      <PersonHeader person={person} onBack={onBack}>
        <p
          className={cn(
            "h-4 text-[12px]",
            error ? "text-red-600" : "text-muted-foreground",
          )}
          role={error ? "alert" : undefined}
        >
          {error || tr("Enter your 4-digit PIN")}
        </p>
      </PersonHeader>
      <PinPad
        value={pin}
        onChange={(v) => {
          setPin(v);
          if (v) setError("");
        }}
        onComplete={(v) => void submit(v)}
        disabled={busy}
        shake={shake}
      />
      <div className="text-center">
        <button
          type="button"
          onClick={onUsePassword}
          className="text-[12px] font-medium text-primary hover:underline"
        >
          {tr("Forgot PIN? Use password")}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PasswordInput({
  id,
  value,
  onChange,
  autoFocus,
  autoComplete = "one-time-code",
  placeholder,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  autoComplete?: string;
  placeholder: string;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(inputClass, "pr-11")}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label={tr(show ? "Hide password" : "Show password")}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function RememberBox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2 text-[12px] text-muted-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded accent-primary"
      />
      {tr("Keep me signed in on this computer (7 days)")}
    </label>
  );
}

function SubmitButton({ busy, children }: { busy: boolean; children: string }) {
  return (
    <Button
      type="submit"
      disabled={busy}
      className="h-11 w-full rounded-xl text-[13px]"
    >
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {tr(busy ? "Please wait…" : children)}
    </Button>
  );
}

/** Owner (or someone without a PIN): password */
export function PasswordPanel({
  person,
  onBack,
  onSubmit,
  onForgot,
  onUsePin,
}: {
  person: SignInPerson;
  onBack: () => void;
  onSubmit: (password: string, remember: boolean) => Promise<string | null>;
  onForgot: () => void;
  /** This person has a PIN → back to the number pad */
  onUsePin?: () => void;
}) {
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return setError(tr("Enter your password"));
    setBusy(true);
    const err = await onSubmit(password, remember);
    setBusy(false);
    setPassword("");
    setError(err ?? "");
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <PersonHeader person={person} onBack={onBack} />
      <PasswordInput
        id="signin-password"
        value={password}
        onChange={(v) => {
          setPassword(v);
          setError("");
        }}
        autoFocus
        placeholder={tr("Password")}
        disabled={busy}
      />
      {error ? (
        <p role="alert" className="text-[12px] text-red-600">
          {error}
        </p>
      ) : null}
      <RememberBox checked={remember} onChange={setRemember} />
      <SubmitButton busy={busy}>Sign in</SubmitButton>
      <div className="flex items-center justify-center gap-4 text-center">
        <button
          type="button"
          onClick={() => (person.role === "owner" ? onForgot() : setHint(true))}
          className="text-[12px] font-medium text-primary hover:underline"
        >
          {tr("Forgot password?")}
        </button>
        {onUsePin ? (
          <button
            type="button"
            onClick={onUsePin}
            className="text-[12px] font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            {tr("Use PIN")}
          </button>
        ) : null}
      </div>
      <div className="text-center">
        {hint ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {tr("Ask the owner — Settings → Users & roles → Reset password.")}
          </p>
        ) : null}
      </div>
    </form>
  );
}

/** Fallback: type the username (and when the tiles can't be shown) */
export function UsernamePanel({
  onBack,
  onSubmit,
}: {
  onBack?: () => void;
  onSubmit: (
    username: string,
    password: string,
    remember: boolean,
  ) => Promise<string | null>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password)
      return setError(tr("Enter username and password"));
    setBusy(true);
    const err = await onSubmit(username.trim(), password, remember);
    setBusy(false);
    setPassword("");
    setError(err ?? "");
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="relative text-center">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label={tr("Back")}
            className="absolute left-0 top-0 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : null}
        <p className="pt-1.5 text-[16px] font-semibold">
          {tr("Sign in with username")}
        </p>
      </div>
      <Input
        id="signin-username"
        autoComplete="off"
        autoFocus
        placeholder={tr("Username")}
        value={username}
        onChange={(e) => {
          setUsername(e.target.value);
          setError("");
        }}
        disabled={busy}
        className={inputClass}
      />
      <PasswordInput
        id="signin-password"
        value={password}
        onChange={(v) => {
          setPassword(v);
          setError("");
        }}
        placeholder={tr("Password")}
        disabled={busy}
      />
      {error ? (
        <p role="alert" className="text-[12px] text-red-600">
          {error}
        </p>
      ) : null}
      <RememberBox checked={remember} onChange={setRemember} />
      <SubmitButton busy={busy}>Sign in</SubmitButton>
    </form>
  );
}

/** Owner forgot the password: recovery code → new password */
export function RecoverPanel({
  person,
  onBack,
  onSubmit,
  onNoCode,
}: {
  person: SignInPerson;
  onBack: () => void;
  onSubmit: (code: string, password: string) => Promise<string | null>;
  /** Lost the code too → the provider's unlock code */
  onNoCode: () => void;
}) {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const bad = checkPassword(password);
    if (code.replace(/-/g, "").length < 12)
      return setError(tr("Type the 12-letter recovery code"));
    if (bad) return setError(tr(bad));
    if (password !== again) return setError(tr("The two passwords differ"));
    setBusy(true);
    const err = await onSubmit(code, password);
    setBusy(false);
    setError(err ?? "");
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <PersonHeader person={person} onBack={onBack}>
        <p className="max-w-xs text-[12px] text-muted-foreground">
          {tr(
            "Type the recovery code you wrote down (Settings → Users & roles), then choose a new password.",
          )}
        </p>
      </PersonHeader>
      <Input
        id="recovery-code"
        autoFocus
        autoComplete="off"
        spellCheck={false}
        placeholder="XXXX-XXXX-XXXX"
        value={code}
        onChange={(e) => {
          setCode(formatRecoveryCode(e.target.value));
          setError("");
        }}
        disabled={busy}
        className={cn(inputClass, "text-center font-mono tracking-[0.2em]")}
        aria-label={tr("Recovery code")}
      />
      <PasswordInput
        id="recovery-new"
        value={password}
        onChange={setPassword}
        autoComplete="one-time-code"
        placeholder={tr("New password (6+ characters)")}
        disabled={busy}
      />
      <PasswordInput
        id="recovery-again"
        value={again}
        onChange={setAgain}
        autoComplete="one-time-code"
        placeholder={tr("New password again")}
        disabled={busy}
      />
      {error ? (
        <p role="alert" className="text-[12px] text-red-600">
          {error}
        </p>
      ) : null}
      <SubmitButton busy={busy}>Set new password</SubmitButton>
      <div className="text-center">
        <button
          type="button"
          onClick={onNoCode}
          className="text-[12px] font-medium text-primary hover:underline"
        >
          {tr("Lost the code too?")}
        </button>
      </div>
    </form>
  );
}
