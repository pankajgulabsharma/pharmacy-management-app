import { useEffect, useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Check, KeyRound, Pencil, UserPlus } from "lucide-react";
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
import { checkPassword } from "@medicare/domain/auth/users";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FormField } from "@/components/common/FormField";
import { StatusBadge } from "@/components/common/StatusBadge";
import { cellInputClass, fieldClass } from "@/components/common/formStyles";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";
import { useAuthStore } from "@/features/auth/store/useAuthStore";
import { useUserStore } from "../store/useUserStore";
import { SettingsCard } from "./SettingsCard";

const showError = (err: unknown) =>
  toast.error(err instanceof Error ? err.message : "Could not save");

/** Owner: who can sign in, with which role */
export function UsersSection() {
  const { users, loaded, load, update } = useUserStore();
  const meId = useAuthStore((s) => s.session?.user.id);
  const [resetFor, setResetFor] = useState<UserRecord | null>(null);
  const [editFor, setEditFor] = useState<UserRecord | null>(null);

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
                  {tr("Status")}
                </th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {!loaded ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-muted-foreground">
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
