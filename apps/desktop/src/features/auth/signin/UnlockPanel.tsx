import { useEffect, useState, type FormEvent } from "react";
import { Copy, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import type { SignInPerson } from "@medicare/domain/auth/types";
import { checkPassword } from "@medicare/domain/auth/users";
import { Button } from "@/components/ui/button";
import { apiGet, apiRequest } from "@/lib/api";
import { tr } from "@/lib/i18n";
import { PersonHeader } from "./SignInPanels";

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
    <form onSubmit={submit} noValidate className="space-y-3">
      <PersonHeader person={person} onBack={onBack}>
        <p className="max-w-xs text-[12px] text-muted-foreground">
          {tr(
            "No code? Your MediCare provider can unlock it. Send them these details:",
          )}
        </p>
      </PersonHeader>
      <div className="rounded-xl border border-border bg-muted/40 p-3 text-[12px]">
        {req ? (
          <>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">
                {tr("Machine code")}
              </span>
              <b className="font-mono">{req.machine}</b>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">{tr("Request no.")}</span>
              <b className="font-mono text-[15px] tracking-widest">
                {req.request}
              </b>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() =>
                  navigator.clipboard
                    ?.writeText(message)
                    .then(() => toast.success(tr("Copied")))
                }
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                <Copy className="h-3.5 w-3.5" />
                {tr("Copy")}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#128C7E] hover:underline"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {tr("Send on WhatsApp")}
              </a>
            </div>
          </>
        ) : (
          <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
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
        className={`${input} py-2 font-mono text-[11px]`}
      />
      <input
        type="password"
        autoComplete="new-password"
        aria-label={tr("New password (6+ characters)")}
        placeholder={tr("New password (6+ characters)")}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={`${input} h-10`}
      />
      <input
        type="password"
        autoComplete="new-password"
        aria-label={tr("New password again")}
        placeholder={tr("New password again")}
        value={again}
        onChange={(e) => setAgain(e.target.value)}
        className={`${input} h-10`}
      />
      {error ? (
        <p role="alert" className="text-[12px] text-red-600">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={busy}
        className="h-11 w-full rounded-xl text-[13px]"
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {tr("Set new password")}
      </Button>
    </form>
  );
}
