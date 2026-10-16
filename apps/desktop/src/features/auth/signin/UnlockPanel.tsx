import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Copy,
  KeyRound,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { SignInPerson } from "@medicare/domain/auth/types";
import { checkPassword } from "@medicare/domain/auth/users";
import { Button } from "@/components/ui/button";
import { apiGet, apiRequest } from "@/lib/api";
import { tr } from "@/lib/i18n";

type Req = { machine: string; request: string; shop: string };

const input =
  "w-full rounded-xl border border-border bg-input px-3 text-[13px] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

/**
 * Forgot the password AND no recovery code: send the machine code +
 * request number to the MediCare provider, type the unlock code they send
 * back, choose a new password. Always works — no internet needed here.
 */
export function UnlockPanel({
  person,
  onBack,
  onDone,
}: {
  person: SignInPerson;
  onBack: () => void;
  onDone: () => void;
}) {
  const [req, setReq] = useState<Req | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void apiGet<Req>("/api/auth/unlock-request").then(setReq, () =>
      setError(tr("Can't reach the main computer")),
    );
  }, []);

  const message = req
    ? `MediCare unlock request\nShop: ${req.shop}\nMachine code: ${req.machine}\nRequest no.: ${req.request}`
    : "";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const bad = checkPassword(password);
    if (!code.trim()) return setError(tr("Paste the unlock code you received"));
    if (bad) return setError(tr(bad));
    if (password !== again) return setError(tr("The two passwords differ"));
    setBusy(true);
    try {
      await apiRequest("POST", "/api/auth/unlock", {
        userId: person.id,
        code: code.trim(),
        password,
      });
      toast.success(tr("New password set — sign in with it now"));
      onDone();
    } catch (err) {
      setError(tr(err instanceof Error ? err.message : "Could not save"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="relative text-center">
        <button
          type="button"
          onClick={onBack}
          aria-label={tr("Back")}
          className="absolute left-0 top-0 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <KeyRound className="h-6 w-6" />
        </span>
        <h1 className="text-[17px] font-semibold">
          {tr("Unlock {{name}}", { name: person.name })}
        </h1>
        <p className="text-[12px] text-muted-foreground">
          {tr("Your MediCare provider sends an unlock code — 2 quick steps.")}
        </p>
      </div>

      <Step n={1} title="Send these details to your provider">
        {req ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Tile label="Machine code" value={req.machine} small />
              <Tile label="Request no." value={req.request} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#25D366] text-[12px] font-semibold text-white hover:bg-[#1fb857]"
              >
                <MessageCircle className="h-4 w-4" />
                {tr("WhatsApp")}
              </a>
              <button
                type="button"
                onClick={() =>
                  navigator.clipboard
                    ?.writeText(message)
                    .then(() => toast.success(tr("Copied")))
                }
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-[12px] font-medium hover:bg-muted"
              >
                <Copy className="h-4 w-4" />
                {tr("Copy")}
              </button>
            </div>
          </>
        ) : (
          <Loader2 className="mx-auto my-3 h-5 w-5 animate-spin text-muted-foreground" />
        )}
      </Step>

      <Step n={2} title="Type the code they send, and a new password">
        <div className="space-y-2">
          <textarea
            aria-label={tr("Unlock code")}
            placeholder={tr("Paste the unlock code (MU1.…)")}
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError("");
            }}
            rows={2}
            spellCheck={false}
            className={`${input} resize-none py-2 font-mono text-[11px]`}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="password"
              autoComplete="one-time-code"
              aria-label={tr("New password (6+ characters)")}
              placeholder={tr("New password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${input} h-10`}
            />
            <input
              type="password"
              autoComplete="one-time-code"
              aria-label={tr("New password again")}
              placeholder={tr("Again")}
              value={again}
              onChange={(e) => setAgain(e.target.value)}
              className={`${input} h-10`}
            />
          </div>
        </div>
      </Step>

      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700 dark:bg-red-950/50 dark:text-red-400"
        >
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={busy}
        className="h-11 w-full rounded-xl text-[13px]"
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {tr("Unlock & set new password")}
      </Button>
    </form>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-muted/30 p-3">
      <p className="mb-2 flex items-center gap-2 text-[12px] font-semibold">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">
          {n}
        </span>
        {tr(title)}
      </p>
      {children}
    </section>
  );
}

function Tile({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {tr(label)}
      </p>
      <p
        className={`font-mono font-semibold tracking-wider ${small ? "text-[12px]" : "text-[18px]"}`}
      >
        {value}
      </p>
    </div>
  );
}
