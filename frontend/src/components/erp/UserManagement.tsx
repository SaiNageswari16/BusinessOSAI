import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Edit2,
  Trash2,
  ShieldCheck,
  Mail,
  CheckCircle,
  XCircle,
  UserPlus,
  X,
  Save,
} from "lucide-react";
import { useAuth, canAssignSuperAdmin } from "@/contexts/auth-context";
import { useTenant } from "@/contexts/tenant-context";
import { useRbac } from "@/contexts/rbac-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

type UserStatus = "Active" | "Inactive";

interface Role {
  id: string;
  name: string;
  description: string | null;
}

interface RoleSummary {
  id: string;
  name: string;
  is_default: boolean;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  status: UserStatus;
  roles: RoleSummary[];
  must_change_password: boolean;
  avatar_initials: string | null;
  is_tenant_owner?: boolean;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface UserFormPayload {
  email: string;
  full_name: string;
  status: string;
  role_ids: string[];
  default_role_id: string | null;
  must_change_password?: boolean;
  password?: string;
  send_invite?: boolean;
  is_tenant_owner?: boolean;
}


function StatusBadge({ status }: { status: UserStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium",
        status === "Active" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
      )}
    >
      {status === "Active" ? <CheckCircle className="size-3" /> : <XCircle className="size-3" />}
      {status}
    </span>
  );
}

function UserFormModal({
  user,
  roles,
  canAssignSuperAdminRole,
  onClose,
  onSave,
}: {
  user?: User;
  roles: Role[];
  canAssignSuperAdminRole: boolean;
  onClose: () => void;
  onSave: (payload: UserFormPayload) => Promise<void>;
}) {
  const isEdit = Boolean(user);
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [status, setStatus] = useState<UserStatus>(user?.status ?? "Active");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(user?.roles.map((role) => role.id) ?? []);
  const [defaultRoleId, setDefaultRoleId] = useState<string>(user?.roles.find((role) => role.is_default)?.id ?? "");
  const [sendInvite, setSendInvite] = useState(!isEdit);
  const [password, setPassword] = useState("");
  const [mustChangePassword, setMustChangePassword] = useState(user?.must_change_password ?? true);
  const [isTenantOwner, setIsTenantOwner] = useState(user?.is_tenant_owner ?? false);

  const assignableRoles = useMemo(
    () =>
      roles.filter(
        (role) => canAssignSuperAdminRole || role.name.toLowerCase() !== "super admin"
      ),
    [roles, canAssignSuperAdminRole]
  );

  useEffect(() => {
    if (!isEdit && selectedRoles.length && !defaultRoleId) {
      setDefaultRoleId(selectedRoles[0]);
    }
  }, [isEdit, selectedRoles, defaultRoleId]);

  const toggleRole = (id: string) =>
    setSelectedRoles((prev) => (prev.includes(id) ? prev.filter((roleId) => roleId !== id) : [...prev, id]));

  const canSubmit =
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    selectedRoles.length > 0 &&
    (isEdit || sendInvite || password.length >= 8);

  useEffect(() => {
    if (!isEdit) {
      setMustChangePassword(true);
    }
  }, [isEdit]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    await onSave({
      email,
      full_name: fullName,
      status: status.toLowerCase(),
      role_ids: selectedRoles,
      default_role_id: defaultRoleId || null,
      must_change_password: mustChangePassword,
      is_tenant_owner: isTenantOwner,
      ...(sendInvite ? { send_invite: true } : {}),
      ...(sendInvite ? {} : { password }),
    });
    onClose();
  };


  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl"
      >
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-card z-10">
            <div>
              <h2 className="text-lg font-bold">{isEdit ? "Edit User" : "Invite New User"}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isEdit
                  ? "Update existing user details, status, and role assignments."
                  : "Create a user account and optionally send an invite email with a temporary password."}
              </p>
            </div>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition">
              <X className="size-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Mail className="size-4 text-primary" /> Identity
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Full Name</label>
                  <input
                    className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="e.g. John Smith"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Work Email</label>
                  <input
                    type="email"
                    className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="john@company.com"
                    disabled={isEdit}
                  />
                </div>
              </div>
              <div className="mt-3">
                <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                <div className="flex gap-2">
                  {["Active", "Inactive"].map((statusOption) => (
                    <button
                      key={statusOption}
                      type="button"
                      onClick={() => setStatus(statusOption as UserStatus)}
                      className={cn(
                        "px-4 py-1.5 rounded-full text-sm font-medium border transition",
                        status === statusOption
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:bg-muted"
                      )}
                    >
                      {statusOption}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" /> Assign Roles
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {assignableRoles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => toggleRole(role.id)}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-xl border text-left transition",
                      selectedRoles.includes(role.id)
                        ? "bg-primary/5 border-primary/40"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <span
                      className={cn(
                        "size-4 mt-0.5 rounded border-2 shrink-0 flex items-center justify-center transition",
                        selectedRoles.includes(role.id) ? "bg-primary border-primary" : "border-border"
                      )}
                    >
                      {selectedRoles.includes(role.id) && <span className="size-2 bg-white rounded-sm" />}
                    </span>
                    <div>
                      <div className="text-sm font-medium">{role.name}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{role.description ?? "Role access and permissions."}</div>
                    </div>
                  </button>
                ))}
              </div>
              {selectedRoles.length > 0 && (
                <div className="mt-4">
                  <label className="text-xs text-muted-foreground mb-1 block">Default Role</label>
                  <select
                    className="w-full h-10 rounded-lg border bg-background px-3 text-sm outline-none"
                    value={defaultRoleId}
                    onChange={(event) => setDefaultRoleId(event.target.value)}
                  >
                    {selectedRoles.map((roleId) => {
                      const found = assignableRoles.find((role) => role.id === roleId);
                      return (
                        <option key={roleId} value={roleId}>
                          {found?.name ?? roleId}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>

            {!isEdit && (
              <div className="space-y-3 rounded-2xl border p-4 bg-muted/50">
                <label className="flex items-center gap-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={sendInvite}
                    onChange={(event) => setSendInvite(event.target.checked)}
                    className="h-4 w-4 rounded border-muted-foreground text-primary focus:ring-primary"
                  />
                  Send a temporary password invite email
                </label>
                {!sendInvite && (
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground mb-1 block">Temporary password</label>
                    <input
                      type="password"
                      className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter a temporary password"
                    />
                    <p className="text-xs text-muted-foreground">Leave blank to generate and email a temporary password.</p>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-2xl border p-4 bg-orange-50 text-orange-700 text-sm">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={mustChangePassword}
                  onChange={(event) => setMustChangePassword(event.target.checked)}
                  disabled={!isEdit && !canAssignSuperAdminRole}
                  className="h-4 w-4 rounded border-muted-foreground text-primary focus:ring-primary"
                />
                <span>This user must change their password when they sign in.</span>
              </label>
              {!canAssignSuperAdminRole && !isEdit && (
                <p className="text-xs mt-2">Required for all newly created users.</p>
              )}
              {isEdit && user?.must_change_password && !mustChangePassword && (
                <p className="text-xs text-muted-foreground mt-2">
                  Currently the user is required to reset their password on next login.
                </p>
              )}
            </div>
          </div>

          <div className="p-6 border-t flex justify-end gap-3 sticky bottom-0 bg-card">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border hover:bg-muted text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2",
                canSubmit
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              <Save className="size-4" /> {isEdit ? "Save Changes" : "Create User"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export function UserManagement({ tab = "users" }: { tab?: string }) {
    const { currency, formatCurrency } = useCurrency();
  const { accessToken, user: currentUser } = useAuth();
  const { hasPermission } = useRbac();
  const canManageUsers = hasPermission("manage:users");
  const { tenant } = useTenant();
  const canAssignSuperAdminRole = canAssignSuperAdmin(currentUser);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = accessToken
    ? { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }
    : undefined;

  const loadUsers = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);

    try {
      const userRes = await fetch(`${API_BASE_URL}/erp/users`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userRes.ok) {
        const body = await userRes.text();
        throw new Error(body || "Failed to load users");
      }
      const userData: PaginatedResponse<User> = await userRes.json();
      setUsers(
        userData.items.map((user) => ({
          ...user,
          status: (user.status as unknown as string) === "active" ? "Active" : "Inactive",
        }))
      );


      const roleRes = await fetch(`${API_BASE_URL}/erp/roles`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!roleRes.ok) {
        const body = await roleRes.text();
        throw new Error(body || "Failed to load roles");
      }
      const roleData: PaginatedResponse<Role> = await roleRes.json();
      setRoles(roleData.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load user management data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, tenant?.id]);

  const saveUser = async (payload: UserFormPayload) => {
    if (!accessToken) return;
    setSaving(true);
    setError(null);

    try {
      if (editUser) {
        const response = await fetch(`${API_BASE_URL}/erp/users/${editUser.id}`, {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify({
            full_name: payload.full_name,
            status: payload.status,
            role_ids: payload.role_ids,
            default_role_id: payload.default_role_id,
            must_change_password: payload.must_change_password,
            is_tenant_owner: payload.is_tenant_owner,
          }),

        });
        if (!response.ok) {
          let message = "Failed to save user";
          try {
            const json = await response.json();
            message = typeof json.detail === "string" ? json.detail : message;
          } catch {
            const body = await response.text();
            if (body) message = body;
          }
          throw new Error(message);
        }
      } else {
        const response = await fetch(`${API_BASE_URL}/erp/users`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          let message = "Failed to create user";
          try {
            const json = await response.json();
            message = typeof json.detail === "string" ? json.detail : message;
          } catch {
            const body = await response.text();
            if (body) message = body;
          }
          throw new Error(message);
        }
      }

      await loadUsers();
      toast.success(editUser ? "User updated" : "Invite sent");
      setEditUser(undefined);
      setShowModal(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Unable to save user");
      setError(err instanceof Error ? err.message : "Unable to save user");
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const searchMatch =
        user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const statusMatch = filterStatus === "All" || user.status === filterStatus;
      const roleMatch = filterRole === "All" || user.roles.some((role) => role.id === filterRole);
      return searchMatch && statusMatch && roleMatch;
    });
  }, [users, searchTerm, filterRole, filterStatus]);

  const pendingInvites = users.filter((user) => user.must_change_password).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Create users, assign roles, and manage access for your tenant.</p>
        </div>
        {canManageUsers && (
          <button
            onClick={() => {
              setEditUser(undefined);
              setShowModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition cursor-pointer"
          >
            <UserPlus className="size-3.5" /> New User
          </button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Users", value: users.length, sub: "across your tenant" },
          { label: "Active", value: users.filter((user) => user.status === "Active").length, sub: "currently active" },
          { label: "Roles Configured", value: roles.length, sub: "role profiles" },
          { label: "Pending Invites", value: pendingInvites, sub: "awaiting password setup" },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className="bg-card rounded-xl border p-4"
          >
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-sm font-medium mt-0.5">{stat.label}</div>
            <div className="text-sm text-muted-foreground mt-1">{stat.sub}</div>
          </motion.div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 h-10 px-3 rounded-xl border bg-background flex-1 min-w-50">
          <Search className="size-4 text-muted-foreground" />
          <input
            className="bg-transparent flex-1 text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search users by name or email..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <select
          className="h-10 px-3 rounded-xl border bg-background text-sm outline-none"
          value={filterStatus}
          onChange={(event) => setFilterStatus(event.target.value)}
        >
          <option value="All">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
        <select
          className="h-10 px-3 rounded-xl border bg-background text-sm outline-none"
          value={filterRole}
          onChange={(event) => setFilterRole(event.target.value)}
        >
          <option value="All">All Roles</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
              <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">User</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Roles</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-sm text-center text-muted-foreground">
                  Loading users…
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-sm text-center text-muted-foreground">
                  No users found.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user, index) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.03 }}
                  className="border-b last:border-0 hover:bg-muted/20 transition"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-full gradient-brand text-white text-xs font-bold grid place-items-center shrink-0">
                        {user.avatar_initials || user.full_name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-1.5">
                          {user.full_name}
                          {user.is_tenant_owner && (
                            <span className="text-[10px] bg-amber-500/10 text-amber-700 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold">
                              👑 Main Admin
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </div>

                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <span key={role.id} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          {role.name}{role.is_default ? " • Default" : ""}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 space-y-2">
                    <StatusBadge status={user.status} />
                    {user.must_change_password && (
                      <div className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                        Require password reset
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canManageUsers ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditUser(user);
                            setShowModal(true);
                          }}
                          className="p-1.5 rounded-lg hover:bg-muted transition text-muted-foreground hover:text-foreground"
                          title="Edit User"
                        >
                          <Edit2 className="size-4" />
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Delete user "${user.full_name}"? This cannot be undone.`)) return;
                            const res = await fetch(`${API_BASE_URL}/erp/users/${user.id}`, {
                              method: "DELETE",
                              headers: { Authorization: `Bearer ${accessToken}` },
                            });
                            if (!res.ok) {
                              const body = await res.text();
                              let msg = "Failed to delete user";
                              try {
                                const json = JSON.parse(body);
                                if (typeof json.detail === "string") msg = json.detail;
                              } catch {}
                              toast.error(msg);
                              return;
                            }
                            toast.success("User deleted");
                            await loadUsers();
                          }}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 transition text-muted-foreground hover:text-destructive"
                          title="Delete User"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Read-only</span>
                    )}
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <AnimatePresence>
        {showModal && (
          <UserFormModal
            user={editUser}
            roles={roles}
            canAssignSuperAdminRole={canAssignSuperAdminRole}
            onClose={() => setShowModal(false)}
            onSave={saveUser}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
