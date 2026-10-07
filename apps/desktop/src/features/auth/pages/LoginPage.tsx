import { useState } from "react";
import { useAuthStore, useCurrentUser } from "../store/useAuthStore";

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
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Eye, EyeOff, Cross, Loader2 } from "lucide-react";
import { ThemeLanguageSwitcher } from "@/components/common/ThemeLanguageSwitcher";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((st) => st.login);
  const user = useCurrentUser();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      toast.warning(t("login.errorEmpty"));
      return;
    }

    setLoading(true);

    try {
      const result = await login(trimmedEmail, password, remember);
      if (result.ok) {
        toast.success(t("login.success"), {
          description: `${result.user.name} · ${t("login.successDesc")}`,
        });
        // Back to the screen they were trying to open (only in-app paths)
        navigate(safeFrom(location.state), { replace: true });
      } else if (result.reason === "locked") {
        toast.error(
          tr("Too many wrong attempts — try again in {{sec}} seconds", {
            sec: result.retryInSec ?? 30,
          }),
        );
      } else if (result.reason === "offline") {
        toast.error(tr(result.message));
      } else {
        toast.error(t("login.errorInvalid"));
      }
    } finally {
      setLoading(false);
      setPassword(""); // security: clear password from state after attempt
    }
  };

  if (user) return <Navigate to={safeFrom(location.state)} replace />;

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background px-4 transition-colors duration-300">
      <div className="absolute top-5 right-5 z-20">
        <ThemeLanguageSwitcher />
      </div>

      <Card className="w-full max-w-md border border-border shadow-xl bg-card text-card-foreground animate-in fade-in-0 zoom-in-95 duration-300">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto w-14 h-14 bg-primary rounded-xl flex items-center justify-center shadow-md">
            <Cross
              className="w-8 h-8 text-primary-foreground"
              strokeWidth={2.5}
            />
          </div>

          <div>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              {t("login.title")}
            </CardTitle>
            <CardDescription className="text-sm mt-1 text-muted-foreground">
              {t("login.subtitle")}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-sm font-medium text-foreground"
              >
                {t("login.email")}
              </Label>
              <Input
                id="email"
                name="email"
                type="text"
                autoComplete="username"
                placeholder={t("login.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className={cn(
                  "h-12 rounded-xl bg-input border border-border text-foreground",
                  "placeholder:text-muted-foreground",
                  "focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-ring",
                )}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-sm font-medium text-foreground"
              >
                {t("login.password")}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder={t("login.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className={cn(
                    "h-12 rounded-xl bg-input border border-border text-foreground pr-12",
                    "placeholder:text-muted-foreground",
                    "focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-ring",
                  )}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  disabled={loading}
                  className="peer sr-only"
                />
                <div
                  className={cn(
                    "h-4 w-4 rounded-md border-2 flex items-center justify-center transition-all",
                    remember
                      ? "bg-primary border-primary"
                      : "bg-background border-border",
                  )}
                >
                  {remember && (
                    <svg
                      className="h-3 w-3 text-primary-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {t("login.remember")}
                </span>
              </label>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("login.loading")}
                </>
              ) : (
                t("login.button")
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
