import { useEffect, useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  Check,
  Copy,
  KeyRound,
  LifeBuoy,
  Pencil,
  RectangleEllipsis,
  UserPlus,
} from "lucide-react";
import {
  GRANTABLE,
  PERMISSION_LABELS,
  STAFF_ROLES,
  type GrantablePermission,
  type StaffRole,
} from "@medicare/domain/auth/permissions";
import { useSettingsStore } from "../store/useSettingsStore";
import {
  ROLE_LABELS,
  ROLES,
  type Role,
  type UserRecord,
} from "@medicare/domain/auth/types";
import {
  PIN_LENGTH,
  canUsePin,
  checkPassword,
  checkPin,
} from "@medicare/domain/auth/users";
import { apiGet, apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FormField } from "@/components/common/FormField";
import { StatusBadge } from "@/components/common/StatusBadge";
import { cellInputClass, fieldClass } from "@/components/common/formStyles";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";
import { useAuthStore } from "@/features/auth/store/useAuthStore";
import { useUserStore } from "../store/useUserStore";
import { useBackupHealth } from "../backup/useBackupHealth";
import { SettingsCard } from "./SettingsCard";

const showError = (err: unknown) =>
  toast.error(err instanceof Error ? err.message : "Could not save");

/** Owner: who can sign in, with which role */
export function UsersSection() {
  const { users, loaded, load, update } = useUserStore();
  const meId = useAuthStore((s) => s.session?.user.id);
  const [resetFor, setResetFor] = useState<UserRecord | null>(null);
  const [editFor, setEditFor] = useState<UserRecord | null>(null);
  const [pinFor, setPinFor] = useState<UserRecord | null>(null);

  useEffect(() => {
    void load().catch(showError);
  }, [load]);

  const change = (u: UserRecord, patch: Partial<UserRecord>) => {
    const next = { name: u.name, role: u.role, active: u.active, ...patch };
    update(u.id, next).then(() => toast.success(tr("Saved")), showError);
  };

  return (
    <div className="space-y-3">
      <AddUserCard />
      <SettingsCard
        title="Users & roles"
        description="Who can sign in, and with which role. Changes apply on every counter at once."
      >
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-[12px]">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">
                  {tr("Name")}
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  {tr("Username")}
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  {tr("Role")}
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  {tr("Sign-in")}
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  {tr("Status")}
                </th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {!loaded ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-muted-foreground">
                    {tr("Loading…")}
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const me = u.id === meId;
                  return (
                    <tr
                      key={u.id}
                      className={cn(
                        "border-t border-border/60",
                        !u.active && "opacity-60",
                      )}
                    >
                      <td className="px-3 py-2">
                        {u.name}
                        {me ? (
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            ({tr("you")})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {u.username}
                      </td>
                      <td className="px-3 py-2">
                        {me ? (
                          // Your own role can't be changed (another owner can)
                          <span
                            className="inline-flex h-7 items-center text-[11px] font-medium"
                            title={tr("You can't change your own role")}
                          >
                            {tr(ROLE_LABELS[u.role])}
                          </span>
                        ) : (
                          <select
                            aria-label={`${tr("Role")} — ${u.name}`}
                            value={u.role}
                            onChange={(e) =>
                              change(u, { role: e.target.value as Role })
                            }
                            className={cn(
                              cellInputClass,
                              "w-32 cursor-pointer appearance-auto",
                            )}
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {tr(ROLE_LABELS[r])}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {canUsePin(u.role) ? (
                          <button
                            type="button"
                            onClick={() => setPinFor(u)}
                            title={tr(u.hasPin ? "Change PIN" : "Set PIN")}
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] hover:bg-muted"
                          >
                            <RectangleEllipsis className="h-3.5 w-3.5 text-muted-foreground" />
                            {u.hasPin ? (
                              <StatusBadge tone="success" shape="rounded">
                                {"PIN"}
                              </StatusBadge>
                            ) : (
                              <span className="font-medium text-primary">
                                {tr("Set PIN")}
                              </span>
                            )}
                          </button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            {tr("Password")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <StatusBadge
                            tone={u.active ? "success" : "neutral"}
                            shape="rounded"
                          >
                            {u.active ? "Active" : "Switched off"}
                          </StatusBadge>
                          {u.active && u.mustChangePassword ? (
                            <StatusBadge tone="warning" shape="rounded">
                              {"New password due"}
                            </StatusBadge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setEditFor(u)}
                          className="h-7 rounded-md text-[11px] gap-1"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {tr("Edit")}
                        </Button>
                        {me ? null : (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setResetFor(u)}
                              className="h-7 rounded-md text-[11px] gap-1"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                              {tr("Reset password")}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => change(u, { active: !u.active })}
                              className={cn(
                                "h-7 rounded-md text-[11px]",
                                u.active && "text-red-600 hover:text-red-700",
                              )}
                            >
                              {tr(u.active ? "Switch off" : "Switch on")}
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </SettingsCard>
      <RecoveryCodeCard />
      <RoleAccessCard />
      {editFor ? (
        <EditUserDialog
          user={editFor}
          me={editFor.id === meId}
          onSave={(patch) => {
            change(editFor, patch);
            setEditFor(null);
          }}
          onClose={() => setEditFor(null)}
        />
      ) : null}
      {pinFor ? (
        <SetPinDialog user={pinFor} onClose={() => setPinFor(null)} />
      ) : null}
      {resetFor ? (
        <ResetPasswordDialog
          user={resetFor}
          onClose={() => setResetFor(null)}
        />
      ) : null}
    </div>
  );
}

function AddUserCard() {
  const id = useId();
  const add = useUserStore((s) => s.add);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<Role>("cashier");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const bad = checkPassword(password, username);
    if (!name.trim() || !username.trim()) {
      toast.error(tr("Enter name and username"));
      return;
    }
    if (bad) {
      toast.error(tr(bad));
      return;
    }
    setSaving(true);
    try {
      await add({ name, username, role, password });
      toast.success(
        tr("{{name}} can now sign in — they will choose their own password", {
          name: name.trim(),
        }),
      );
      setName("");
      setUsername("");
      setPassword("");
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="rounded-xl border border-border bg-card p-4 space-y-3"
    >
      <h2 className="text-sm font-semibold inline-flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-primary" />
        {tr("Add a user")}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
        <FormField label="Full name" htmlFor={`${id}-name`}>
          <input
            id={`${id}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Neha Gupta"
            className={fieldClass}
          />
        </FormField>
        <FormField label="Username" htmlFor={`${id}-user`}>
          <input
            id={`${id}-user`}
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            placeholder="e.g. neha"
            autoComplete="off"
            className={fieldClass}
          />
        </FormField>
        <FormField label="Role" htmlFor={`${id}-role`}>
          <select
            id={`${id}-role`}
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className={fieldClass}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {tr(ROLE_LABELS[r])}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Starter password" htmlFor={`${id}-pw`}>
          <input
            id={`${id}-pw`}
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={tr("min. 6 characters")}
            autoComplete="off"
            className={fieldClass}
          />
        </FormField>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-muted-foreground">
          {tr(
            "Tell them the starter password — at first sign-in they must choose their own.",
          )}
        </p>
        <Button
          type="submit"
          disabled={saving}
          className="h-9 rounded-lg text-[12px] gap-1.5"
        >
          <UserPlus className="h-3.5 w-3.5" />
          {tr("Add user")}
        </Button>
      </div>
    </form>
  );
}

/** Forgot password: owner sets a temporary one; that person is signed out */
function ResetPasswordDialog({
  user,
  onClose,
}: {
  user: UserRecord;
  onClose: () => void;
}) {
  const id = useId();
  const resetPassword = useUserStore((s) => s.resetPassword);
  const [password, setPassword] = useState("");
  const bad = checkPassword(password, user.username);
  return (
    <ConfirmDialog
      open
      tone="default"
      icon={KeyRound}
      title={tr("Reset password for {{name}}?", { name: user.name })}
      description={tr(
        "They are signed out everywhere and must choose a new password after signing in with this one.",
      )}
      confirmLabel="Reset password"
      confirmDisabled={bad !== null}
      onConfirm={() =>
        resetPassword(user.id, password).then(() => {
          toast.success(tr("Password reset"));
          onClose();
        }, showError)
      }
      onClose={onClose}
    >
      <FormField
        label="Temporary password"
        htmlFor={`${id}-pw`}
        hint={password ? (bad ?? undefined) : "At least 6 characters"}
      >
        <input
          id={`${id}-pw`}
          data-autofocus
          type="text"
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={fieldClass}
        />
      </FormField>
    </ConfirmDialog>
  );
}

/** Counter PIN: tap the name on the sign-in screen + 4 digits */
function SetPinDialog({
  user,
  onClose,
}: {
  user: UserRecord;
  onClose: () => void;
}) {
  const id = useId();
  const setPin = useUserStore((s) => s.setPin);
  const [pin, setValue] = useState("");
  const bad = checkPin(pin);
  const save = (value: string | null, done: string) =>
    setPin(user.id, value).then(() => {
      toast.success(tr(done));
      onClose();
    }, showError);
  return (
    <ConfirmDialog
      open
      tone="default"
      icon={RectangleEllipsis}
      title={tr(
        user.hasPin ? "Change PIN for {{name}}" : "Set PIN for {{name}}",
        {
          name: user.name,
        },
      )}
      description={tr(
        "On the sign-in screen they tap their name and type these 4 digits — quick at a busy counter. Tell them the PIN; they can keep using their password too.",
      )}
      confirmLabel="Save PIN"
      cancelLabel="Cancel"
      confirmDisabled={bad !== null}
      onConfirm={() => void save(pin, "PIN saved")}
      onClose={onClose}
    >
      <FormField
        label="New PIN"
        htmlFor={`${id}-pin`}
        hint={
          pin.length === PIN_LENGTH && bad ? bad : "4 digits, not 1111 or 1234"
        }
      >
        <input
          id={`${id}-pin`}
          data-autofocus
          inputMode="numeric"
          autoComplete="off"
          maxLength={PIN_LENGTH}
          value={pin}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
          className={cn(
            fieldClass,
            "w-32 text-center font-mono text-lg tracking-[0.5em]",
          )}
        />
      </FormField>
      {user.hasPin ? (
        <button
          type="button"
          onClick={() => void save(null, "PIN removed — password only now")}
          className="text-[11px] font-medium text-red-600 hover:underline"
        >
          {tr("Remove PIN")}
        </button>
      ) : null}
    </ConfirmDialog>
  );
}

/**
 * Owner forgot the password → this code sets a new one on the sign-in
 * screen. No SMS, no internet. Shown once; one use.
 */
function RecoveryCodeCard() {
  const [madeOn, setMadeOn] = useState<string | null | undefined>(undefined);
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    void apiGet<{ createdAt: string | null }>("/api/users/recovery-code").then(
      (r) => setMadeOn(r.createdAt),
      showError,
    );
  }, []);
  const make = () =>
    apiRequest<{ code: string; createdAt: string }>(
      "POST",
      "/api/users/recovery-code",
    ).then((r) => {
      setCode(r.code);
      setMadeOn(r.createdAt);
      void useBackupHealth.getState().refresh(); // the bell's reminder goes
    }, showError);

  return (
    <SettingsCard
      title="Owner recovery code"
      description="If an owner forgets the password, this code sets a new one from the sign-in screen (Forgot password?). No SMS, no internet needed."
    >
      {code ? (
        <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-center space-y-2">
          <p className="font-mono text-2xl font-semibold tracking-[0.25em]">
            {code}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {tr(
              "Write it on paper and keep it at home — not near this computer. It is shown only now and works once.",
            )}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              navigator.clipboard
                ?.writeText(code)
                .then(() => toast.success(tr("Copied")))
            }
            className="h-8 rounded-lg text-[11px] gap-1.5"
          >
            <Copy className="h-3.5 w-3.5" />
            {tr("Copy")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[12px]">
            <LifeBuoy
              className={cn(
                "h-4 w-4",
                madeOn ? "text-emerald-600" : "text-amber-600",
              )}
            />
            {madeOn === undefined
              ? tr("Loading…")
              : madeOn
                ? tr("Made on {{date}} — keep it safe", {
                    date: new Date(madeOn).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }),
                  })
                : tr("Not made yet — make one now, it takes a second")}
          </p>
          <Button
            type="button"
            variant={madeOn ? "outline" : "default"}
            onClick={() => (madeOn ? setConfirm(true) : void make())}
            className="h-8 rounded-lg text-[11px] gap-1.5"
          >
            <KeyRound className="h-3.5 w-3.5" />
            {tr(madeOn ? "Make a new code" : "Make a recovery code")}
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        title={tr("Make a new recovery code?")}
        description={tr("The old code stops working.")}
        confirmLabel="Make a new code"
        onConfirm={() => {
          setConfirm(false);
          void make();
        }}
        onClose={() => setConfirm(false)}
      />
    </SettingsCard>
  );
}

/** Owner: what pharmacists and cashiers may do (screens + buttons + server) */
function RoleAccessCard() {
  const roles = useSettingsStore((s) => s.roles);
  const setRoles = useSettingsStore((s) => s.setRoles);
  const toggle = (role: StaffRole, p: GrantablePermission) => {
    const has = roles[role].includes(p);
    const next = {
      ...roles,
      [role]: has
        ? roles[role].filter((x) => x !== p)
        : GRANTABLE.filter((x) => x === p || roles[role].includes(x)),
    };
    setRoles(next).then(() => toast.success(tr("Saved")), showError);
  };
  return (
    <SettingsCard
      title="What each role can do"
      description="Tick what pharmacists and cashiers may use. Their screens, buttons and the server follow at once. Settings, users, backups and licence stay with the owner."
    >
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-[12px]">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">
                {tr("Allowed to")}
              </th>
              <th className="px-3 py-2 text-center font-medium w-24">
                {tr(ROLE_LABELS.owner)}
              </th>
              {STAFF_ROLES.map((r) => (
                <th key={r} className="px-3 py-2 text-center font-medium w-24">
                  {tr(ROLE_LABELS[r])}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GRANTABLE.map((p) => (
              <tr key={p} className="border-t border-border/60">
                <td className="px-3 py-2">
                  <span className="font-medium">
                    {tr(PERMISSION_LABELS[p].label)}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">
                    {tr(PERMISSION_LABELS[p].help)}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <Check
                    className="inline h-4 w-4 text-emerald-600"
                    aria-label={tr("Always")}
                  />
                </td>
                {STAFF_ROLES.map((r) => (
                  <td key={r} className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      aria-label={`${tr(ROLE_LABELS[r])} — ${tr(PERMISSION_LABELS[p].label)}`}
                      checked={roles[r].includes(p)}
                      onChange={() => toggle(r, p)}
                      className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SettingsCard>
  );
}

/** Change a person's name and role (username stays — it's how they sign in) */
function EditUserDialog({
  user,
  me,
  onSave,
  onClose,
}: {
  user: UserRecord;
  me: boolean;
  onSave: (patch: Partial<UserRecord>) => void;
  onClose: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<Role>(user.role);
  return (
    <ConfirmDialog
      open
      tone="default"
      icon={Pencil}
      title={tr("Edit {{name}}", { name: user.name })}
      description={tr("Username: {{u}} (can't be changed)", {
        u: user.username,
      })}
      confirmLabel="Save"
      cancelLabel="Cancel"
      confirmDisabled={name.trim().length < 2}
      onConfirm={() => onSave({ name: name.trim(), role })}
      onClose={onClose}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Full name" htmlFor={`${id}-name`}>
          <input
            id={`${id}-name`}
            data-autofocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={fieldClass}
          />
        </FormField>
        <FormField
          label="Role"
          htmlFor={`${id}-role`}
          hint={me ? "You can't change your own role" : undefined}
        >
          <select
            id={`${id}-role`}
            value={role}
            disabled={me}
            onChange={(e) => setRole(e.target.value as Role)}
            className={fieldClass}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {tr(ROLE_LABELS[r])}
              </option>
            ))}
          </select>
        </FormField>
      </div>
    </ConfirmDialog>
  );
}
