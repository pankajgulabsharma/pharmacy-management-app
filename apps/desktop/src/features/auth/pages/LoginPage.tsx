import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Cross, Loader2, RefreshCw, WifiOff } from "lucide-react";
import type { SignInPerson } from "@medicare/domain/auth/types";
import { Button } from "@/components/ui/button";
import { ThemeLanguageSwitcher } from "@/components/common/ThemeLanguageSwitcher";
import { useNow } from "@/hooks/useNow";
import { apiRequest } from "@/lib/api";
import { tr } from "@/lib/i18n";
import {
  useAuthStore,
  useCurrentUser,
  type LoginResult,
} from "../store/useAuthStore";
import { usePeople } from "../signin/usePeople";
import {
  PasswordPanel,
  PeopleGrid,
  PinPanel,
  RecoverPanel,
  UsernamePanel,
} from "../signin/SignInPanels";

/** Only redirect back to our own screens — never to another site */
function safeFrom(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from;
  return typeof from === "string" &&
    from.startsWith("/") &&
    !from.startsWith("//") &&
    from !== "/login"
    ? from
    : "/dashboard";
}

type View =
  | { kind: "people" }
  | { kind: "pin" | "password" | "recover"; person: SignInPerson }
  | { kind: "username" };

/** Left half: the shop's name and the time — the counter's "lock screen" */
function BrandPanel({ shop }: { shop: string }) {
  const now = new Date(useNow(15_000));
  return (
    <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-8 text-white md:flex">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/5"
      />
      <div className="relative flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
          <Cross className="h-6 w-6" strokeWidth={2.5} />
        </span>
        <span className="leading-tight">
          <span className="block text-[14px] font-semibold">
            MediCare Pharmacy
          </span>
          <span className="block text-[11px] text-white/70">
            {tr("Pharmacy Management System")}
          </span>
        </span>
      </div>
      <div className="relative">
        <p className="text-[44px] font-light leading-none tabular-nums">
          {now.toLocaleTimeString("en-IN", {
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
        <p className="mt-2 text-[13px] text-white/80">
          {now.toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
        {shop ? (
          <p className="mt-6 text-[22px] font-semibold leading-snug">{shop}</p>
        ) : null}
      </div>
      <p className="relative text-[11px] text-white/70">
        {tr("Tap your name · staff type their PIN · Ctrl+L switches user")}
      </p>
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((st) => st.login);
  const loginAs = useAuthStore((st) => st.loginAs);
  const user = useCurrentUser();
  const people = usePeople();
  const [view, setView] = useState<View>({ kind: "people" });

  // Esc: back to the tiles
  useEffect(() => {
    if (view.kind === "people") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setView({ kind: "people" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view.kind]);

  /** Signed in → welcome + back to the screen; else the message to show */
  const finish = (r: LoginResult): string | null => {
    if (r.ok) {
      toast.success(tr("Welcome, {{name}}", { name: r.user.name }));
      navigate(safeFrom(location.state), { replace: true });
      return null;
    }
    if (r.reason === "locked")
      return tr("Too many wrong attempts — try again in {{sec}} seconds", {
        sec: r.retryInSec ?? 30,
      });
    return tr(r.message);
  };

  if (user) return <Navigate to={safeFrom(location.state)} replace />;

  const shop = people.status === "ready" ? people.shop : "";
  const back = () => setView({ kind: "people" });

  let panel;
  if (people.status === "loading")
    panel = (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  else if (people.status === "offline" && view.kind !== "username")
    panel = (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <WifiOff className="h-8 w-8 text-muted-foreground" />
        <p className="text-[14px] font-semibold">
          {tr("Can't reach the main computer")}
        </p>
        <p className="max-w-xs text-[12px] text-muted-foreground">
          {tr(
            "Is MediCare open on the main computer, and this computer on the shop Wi-Fi?",
          )}
        </p>
        <Button
          type="button"
          onClick={people.retry}
          className="h-10 rounded-xl gap-1.5"
        >
          <RefreshCw className="h-4 w-4" />
          {tr("Try again")}
        </Button>
      </div>
    );
  else if (view.kind === "pin")
    panel = (
      <PinPanel
        person={view.person}
        onBack={back}
        onSubmit={async (pin) => finish(await loginAs(view.person.id, { pin }))}
      />
    );
  else if (view.kind === "password")
    panel = (
      <PasswordPanel
        person={view.person}
        onBack={back}
        onSubmit={async (password, remember) =>
          finish(await loginAs(view.person.id, { password }, remember))
        }
        onForgot={() => setView({ kind: "recover", person: view.person })}
      />
    );
  else if (view.kind === "recover")
    panel = (
      <RecoverPanel
        person={view.person}
        onBack={() => setView({ kind: "password", person: view.person })}
        onSubmit={async (code, password) => {
          try {
            await apiRequest("POST", "/api/auth/recover", {
              userId: view.person.id,
              code,
              password,
            });
            toast.success(tr("New password set — sign in with it now"));
            setView({ kind: "password", person: view.person });
            return null;
          } catch (err) {
            return tr(err instanceof Error ? err.message : "Could not save");
          }
        }}
      />
    );
  else if (view.kind === "username")
    panel = (
      <UsernamePanel
        onBack={people.status === "ready" ? back : undefined}
        onSubmit={async (username, password, remember) =>
          finish(await login(username, password, remember))
        }
      />
    );
  else
    panel = (
      <div className="space-y-5">
        <div>
          <h1 className="text-[20px] font-semibold">
            {tr("Who is signing in?")}
          </h1>
          <p className="text-[12px] text-muted-foreground">
            {tr("Tap your name")}
          </p>
        </div>
        <PeopleGrid
          people={people.status === "ready" ? people.people : []}
          onPick={(p) => setView({ kind: p.method, person: p })}
        />
        <div className="text-center">
          <button
            type="button"
            onClick={() => setView({ kind: "username" })}
            className="text-[12px] font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            {tr("Sign in with username")}
          </button>
        </div>
      </div>
    );

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-indigo-50 px-4 transition-colors dark:from-slate-950 dark:to-indigo-950/40">
      <div className="absolute right-5 top-5 z-20">
        <ThemeLanguageSwitcher />
      </div>
      <div className="flex w-full max-w-4xl overflow-hidden rounded-3xl border border-border bg-card shadow-2xl animate-in fade-in-0 zoom-in-95 duration-300">
        <BrandPanel shop={shop} />
        <div className="flex min-h-[520px] flex-1 flex-col justify-center p-8 sm:p-10">
          <div className="mx-auto w-full max-w-sm">{panel}</div>
        </div>
      </div>
    </div>
  );
}
