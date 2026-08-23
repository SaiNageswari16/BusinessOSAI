import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Building2,
  Users,
  ShieldCheck,
  Key,
  Search,
  RefreshCw,
  Trash2,
  X,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Copy,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Activity,
  History,
  Settings,
  Database,
  ExternalLink,
  Crown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@tanstack/react-router";
import {
  systemAdminApi,
  SystemTenant,
  SystemUser,
  SystemPendingApproval,
  CreateSystemTenantPayload,
  CreateSystemUserPayload,
} from "@/lib/api-client";

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─── Modal: Create Organisation ──────────────────────────────────────────────

interface CreateTenantModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function CreateTenantModal({ onClose, onSuccess }: CreateTenantModalProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [plan, setPlan] = useState("enterprise");
  const [adminName, setAdminName] = useState("Super Admin");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleNameChange = (val: string) => {
    setName(val);
    setSlug(generateSlug(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      toast.error("Organisation name and slug are required");
      return;
    }
    if (!adminEmail.trim() || !adminPassword.trim()) {
      toast.error("Admin Email and Password are required");
      return;
    }
    if (adminPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setSaving(true);
    try {
      const payload: CreateSystemTenantPayload = {
        name: name.trim(),
        slug: slug.trim(),
        plan,
        status: "active",
        admin_name: adminName.trim(),
        admin_email: adminEmail.trim().toLowerCase(),
        admin_password: adminPassword,
        enabled_modules: ["inventory", "pos", "accounting", "crm", "hrms", "procurement", "marketplace", "iot", "copilot"],
      };

      await systemAdminApi.createTenant(payload);
      toast.success(`Organisation "${name}" created successfully!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to create organisation");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Building2 className="size-5" />
            </div>
            <div>
              <h2 className="font-bold text-base">Add New Organisation</h2>
              <p className="text-xs text-muted-foreground">Create workspace and initial admin credentials</p>
            </div>
          </div>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Organisation Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Acme Retail"
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Workspace Slug *</label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(generateSlug(e.target.value))}
                placeholder="e.g. acme-retail"
                className="w-full h-9 px-3 text-sm font-mono rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Subscription Plan</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
            >
              <option value="starter">Starter Plan</option>
              <option value="growth">Growth Plan</option>
              <option value="enterprise">Enterprise Plan (All Modules)</option>
              <option value="lifetime">Lifetime Unlimited</option>
            </select>
          </div>

          <div className="pt-2 border-t space-y-3">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Initial Admin Credentials
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Admin Name</label>
                <input
                  type="text"
                  required
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="Admin Name"
                  className="w-full h-9 px-3 text-sm rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Admin Email *</label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@organisation.com"
                  className="w-full h-9 px-3 text-sm rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Admin Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Minimum 8 characters..."
                  className="w-full h-9 pl-3 pr-9 text-sm rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving}
              className="gradient-brand text-white border-0"
            >
              {saving ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Plus className="size-4 mr-1.5" />}
              Create Organisation
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Modal: Create User ───────────────────────────────────────────────────────

interface CreateUserModalProps {
  tenants: SystemTenant[];
  onClose: () => void;
  onSuccess: () => void;
}

function CreateUserModal({ tenants, onClose, onSuccess }: CreateUserModalProps) {
  const [tenantId, setTenantId] = useState(tenants[0]?.id || "");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [roleName, setRoleName] = useState("Admin");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) {
      toast.error("Please select an Organisation");
      return;
    }
    if (!fullName.trim() || !email.trim()) {
      toast.error("Full Name and Email are required");
      return;
    }
    if (!password || password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setSaving(true);
    try {
      const payload: CreateSystemUserPayload = {
        tenant_id: tenantId,
        email: email.trim().toLowerCase(),
        password,
        full_name: fullName.trim(),
        role_name: roleName,
        is_tenant_owner: roleName === "Super Admin" || roleName === "Admin",
        is_platform_admin: roleName === "Super Admin",
        status: "ACTIVE",
      };

      await systemAdminApi.createUser(payload);
      toast.success(`User "${fullName}" created successfully!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to create user");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold">
              <Users className="size-5" />
            </div>
            <div>
              <h2 className="font-bold text-base">Add New User</h2>
              <p className="text-xs text-muted-foreground">Assign user to an organisation workspace</p>
            </div>
          </div>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold mb-1">Select Organisation *</label>
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.slug})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Alice Smith"
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alice@company.com"
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 chars..."
                  className="w-full h-9 pl-3 pr-9 text-sm rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Role</label>
              <select
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
              >
                <option value="Super Admin">Super Admin (God Mode)</option>
                <option value="Admin">Admin</option>
                <option value="Manager">Manager</option>
                <option value="Staff">Staff</option>
                <option value="Cashier">Cashier</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving}
              className="gradient-brand text-white border-0"
            >
              {saving ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Plus className="size-4 mr-1.5" />}
              Create User
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Modal: Reset Password ────────────────────────────────────────────────────

interface ResetPasswordModalProps {
  user: SystemUser;
  onClose: () => void;
}

function ResetPasswordModal({ user, onClose }: ResetPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setSaving(true);
    try {
      await systemAdminApi.resetUserPassword(user.id, password);
      toast.success(`Password reset for ${user.email}`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-sm"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Key className="size-4 text-indigo-500" /> Reset Password
          </h3>
          <button onClick={onClose} className="size-7 rounded hover:bg-muted flex items-center justify-center">
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Set a new password for <strong className="text-foreground">{user.full_name}</strong> ({user.email}).
          </p>
          <div>
            <label className="block text-xs font-semibold mb-1">New Password *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Minimum 8 characters..."
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving || password.length < 8} className="gradient-brand text-white border-0">
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Main Super Admin Component ───────────────────────────────────────────────

export function SuperAdminManagement() {
  const [activeTab, setActiveTab] = useState<"tenants" | "users" | "pending">("tenants");
  const [tenants, setTenants] = useState<SystemTenant[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<SystemPendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tenantFilter, setTenantFilter] = useState("all");
  const [isForbidden, setIsForbidden] = useState(false);

  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<SystemUser | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tenantsData, usersData, pendingData] = await Promise.all([
        systemAdminApi.listTenants().catch((e) => {
          if (e.status === 403) setIsForbidden(true);
          return [];
        }),
        systemAdminApi.listUsers().catch((e) => {
          if (e.status === 403) setIsForbidden(true);
          return [];
        }),
        systemAdminApi.listPendingApprovals().catch(() => []),
      ]);
      setTenants(tenantsData);
      setUsers(usersData);
      setPendingApprovals(pendingData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleToggleTenantStatus = async (t: SystemTenant) => {
    const next = t.status === "active" ? "suspended" : "active";
    try {
      await systemAdminApi.updateTenantStatus(t.id, next);
      toast.success(`Organisation ${next === "active" ? "activated" : "suspended"}`);
      void loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const handleToggleUserStatus = async (u: SystemUser) => {
    const next = u.status.toUpperCase() === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      await systemAdminApi.updateUserStatus(u.id, next);
      toast.success(`User status updated to ${next}`);
      void loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update user status");
    }
  };

  const handleToggleSuperAdmin = async (u: SystemUser) => {
    const nextState = !u.is_platform_admin;
    try {
      await systemAdminApi.toggleSuperAdmin(u.id, nextState);
      toast.success(`Platform God Mode ${nextState ? "granted to" : "revoked from"} ${u.full_name}`);
      void loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle Super Admin status");
    }
  };

  const handleApprovePendingTenant = async (p: SystemPendingApproval) => {
    try {
      const defaultModules = p.requested_modules.length > 0 ? p.requested_modules : ["inventory", "pos", "accounting", "crm"];
      await systemAdminApi.approveTenant(p.tenant_id, defaultModules);
      toast.success(`Workspace "${p.tenant_name}" approved successfully!`);
      void loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve workspace");
    }
  };

  const handleDeleteTenant = async (t: SystemTenant) => {
    if (t.slug === "system") {
      toast.error("Cannot delete root system organisation");
      return;
    }
    if (!window.confirm(`Delete organisation "${t.name}" (${t.slug}) and all its data?`)) return;
    try {
      await systemAdminApi.deleteTenant(t.id);
      toast.success(`Organisation "${t.name}" deleted`);
      void loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete organisation");
    }
  };

  const handleDeleteUser = async (u: SystemUser) => {
    if (!window.confirm(`Delete user "${u.full_name}" (${u.email})?`)) return;
    try {
      await systemAdminApi.deleteUser(u.id);
      toast.success(`User ${u.email} deleted`);
      void loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user");
    }
  };

  const filteredTenants = useMemo(() => {
    return tenants.filter(
      (t) =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.slug.toLowerCase().includes(search.toLowerCase()) ||
        (t.owner_email && t.owner_email.toLowerCase().includes(search.toLowerCase()))
    );
  }, [tenants, search]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchOrg = tenantFilter === "all" || u.tenant_name === tenantFilter;
      const matchSearch =
        u.full_name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        u.tenant_name.toLowerCase().includes(search.toLowerCase());
      return matchOrg && matchSearch;
    });
  }, [users, search, tenantFilter]);

  const activeTenantsCount = useMemo(() => tenants.filter((t) => t.status === "active").length, [tenants]);
  const superAdminCount = useMemo(() => users.filter((u) => u.is_platform_admin).length, [users]);

  if (isForbidden) {
    return (
      <div className="p-8 text-center bg-card rounded-2xl border max-w-md mx-auto my-12 space-y-3">
        <ShieldAlert className="size-10 text-destructive mx-auto" />
        <h2 className="text-lg font-bold">Access Restricted</h2>
        <p className="text-xs text-muted-foreground">Only Platform Super Admins can access this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-5 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold shadow-inner">
            <Crown className="size-6 text-amber-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">Super Admin & Platform Operations</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                GOD MODE
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Universal control plane for multi-tenant organisations, platform users, and global infrastructure
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            size="sm"
            onClick={() => setShowCreateTenant(true)}
            className="gradient-brand text-white border-0 text-xs shadow-sm"
          >
            <Building2 className="size-3.5 mr-1.5" /> + Add Organisation
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowCreateUser(true)}
            className="text-xs"
          >
            <Users className="size-3.5 mr-1.5" /> + Add User
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => void loadData()}
            className="size-8"
            title="Refresh"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-card p-4 rounded-xl border shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Organisations</span>
            <Building2 className="size-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">{tenants.length}</div>
          <div className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
            <CheckCircle2 className="size-3" /> {activeTenantsCount} active workspaces
          </div>
        </div>

        <div className="bg-card p-4 rounded-xl border shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Total Users</span>
            <Users className="size-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{users.length}</div>
          <div className="text-[11px] text-muted-foreground">Across all organisations</div>
        </div>

        <div className="bg-card p-4 rounded-xl border shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>God Mode Admins</span>
            <Sparkles className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{superAdminCount}</div>
          <div className="text-[11px] text-amber-600 font-medium">Full platform privileges</div>
        </div>

        <div className="bg-card p-4 rounded-xl border shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Pending Approvals</span>
            <AlertCircle className="size-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{pendingApprovals.length}</div>
          <div className="text-[11px] text-muted-foreground">Self-service signups</div>
        </div>
      </div>

      {/* System Quick Links Hub */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          to="/erp"
          search={{ tab: "audit_logs" }}
          className="flex items-center gap-2.5 p-3 rounded-xl border bg-card/60 hover:bg-muted transition-colors text-xs font-medium text-foreground"
        >
          <div className="size-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <History className="size-3.5" />
          </div>
          <span>Audit Logs</span>
        </Link>
        <Link
          to="/erp"
          search={{ tab: "system_health" }}
          className="flex items-center gap-2.5 p-3 rounded-xl border bg-card/60 hover:bg-muted transition-colors text-xs font-medium text-foreground"
        >
          <div className="size-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <Activity className="size-3.5" />
          </div>
          <span>System Health</span>
        </Link>
        <Link
          to="/erp"
          search={{ tab: "backup_restore" }}
          className="flex items-center gap-2.5 p-3 rounded-xl border bg-card/60 hover:bg-muted transition-colors text-xs font-medium text-foreground"
        >
          <div className="size-7 rounded-lg bg-violet-500/10 text-violet-500 flex items-center justify-center">
            <Database className="size-3.5" />
          </div>
          <span>Backup & Restore</span>
        </Link>
        <Link
          to="/erp"
          search={{ tab: "global_settings" }}
          className="flex items-center gap-2.5 p-3 rounded-xl border bg-card/60 hover:bg-muted transition-colors text-xs font-medium text-foreground"
        >
          <div className="size-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Settings className="size-3.5" />
          </div>
          <span>Global Settings</span>
        </Link>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex items-center justify-between gap-4 border-b pb-1 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("tenants")}
            className={cn(
              "px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5",
              activeTab === "tenants"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Building2 className="size-3.5" /> Organisations ({tenants.length})
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={cn(
              "px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5",
              activeTab === "users"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Users className="size-3.5" /> Platform Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab("pending")}
            className={cn(
              "px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5",
              activeTab === "pending"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <AlertCircle className="size-3.5" /> Pending Approvals ({pendingApprovals.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "users" && (
            <select
              value={tenantFilter}
              onChange={(e) => setTenantFilter(e.target.value)}
              className="h-8 px-2.5 text-xs rounded-lg border bg-card focus:ring-2 focus:ring-primary/20 outline-none"
            >
              <option value="all">All Organisations</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <div className="relative w-48 sm:w-60">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-2.5 text-xs rounded-lg border bg-card focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Tab 1: Organisations */}
      {activeTab === "tenants" && (
        <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b font-semibold text-muted-foreground">
              <tr>
                <th className="p-3.5">Organisation</th>
                <th className="p-3.5">Slug</th>
                <th className="p-3.5">Plan</th>
                <th className="p-3.5">Owner / Contact</th>
                <th className="p-3.5">Users</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No organisations found.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => {
                  const isActive = t.status === "active";
                  return (
                    <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3.5 font-semibold text-foreground flex items-center gap-2">
                        <Building2 className="size-4 text-primary shrink-0" />
                        {t.name}
                      </td>
                      <td className="p-3.5">
                        <span className="font-mono text-[11px] bg-muted px-2 py-0.5 rounded text-muted-foreground inline-flex items-center gap-1">
                          {t.slug}
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(t.slug);
                              toast.success(`Copied: ${t.slug}`);
                            }}
                            className="hover:text-foreground"
                            title="Copy Slug"
                          >
                            <Copy className="size-2.5" />
                          </button>
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-primary/10 text-primary">
                          {t.plan}
                        </span>
                      </td>
                      <td className="p-3.5 text-muted-foreground">
                        {t.owner_email || "—"}
                      </td>
                      <td className="p-3.5 font-semibold text-foreground">
                        {t.user_count}
                      </td>
                      <td className="p-3.5">
                        <button
                          onClick={() => handleToggleTenantStatus(t)}
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors",
                            isActive
                              ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                              : "bg-rose-500/10 text-rose-600 hover:bg-rose-500/20"
                          )}
                        >
                          {isActive ? "Active" : "Suspended"}
                        </button>
                      </td>
                      <td className="p-3.5 text-right">
                        {t.slug !== "system" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteTenant(t)}
                            className="size-7 text-rose-500 hover:bg-rose-500/10"
                            title="Delete"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Users */}
      {activeTab === "users" && (
        <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b font-semibold text-muted-foreground">
              <tr>
                <th className="p-3.5">User</th>
                <th className="p-3.5">Organisation</th>
                <th className="p-3.5">Role</th>
                <th className="p-3.5">God Mode</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isActive = u.status.toUpperCase() === "ACTIVE";
                  return (
                    <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3.5">
                        <div className="font-semibold text-foreground">{u.full_name}</div>
                        <div className="text-[11px] text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="p-3.5 font-medium text-muted-foreground">
                        {u.tenant_name}
                      </td>
                      <td className="p-3.5">
                        {u.is_platform_admin ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 border border-purple-500/20 inline-flex items-center gap-1">
                            <Sparkles className="size-2.5" /> Super Admin
                          </span>
                        ) : u.is_tenant_owner ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600">
                            Org Admin
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                            User
                          </span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => handleToggleSuperAdmin(u)}
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold transition-all inline-flex items-center gap-1",
                            u.is_platform_admin
                              ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          )}
                          title="Click to toggle platform god-mode"
                        >
                          <Crown className="size-2.5" />
                          {u.is_platform_admin ? "Active" : "Disabled"}
                        </button>
                      </td>
                      <td className="p-3.5">
                        <button
                          onClick={() => handleToggleUserStatus(u)}
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors",
                            isActive
                              ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                              : "bg-rose-500/10 text-rose-600 hover:bg-rose-500/20"
                          )}
                        >
                          {isActive ? "Active" : "Suspended"}
                        </button>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setResetTargetUser(u)}
                            className="h-7 text-xs text-indigo-500 hover:bg-indigo-500/10"
                            title="Reset Password"
                          >
                            <Key className="size-3 mr-1" /> Reset
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteUser(u)}
                            className="size-7 text-rose-500 hover:bg-rose-500/10"
                            title="Delete"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Pending Approvals */}
      {activeTab === "pending" && (
        <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b font-semibold text-muted-foreground">
              <tr>
                <th className="p-3.5">Workspace Name</th>
                <th className="p-3.5">Slug</th>
                <th className="p-3.5">Admin Contact</th>
                <th className="p-3.5">Requested Modules</th>
                <th className="p-3.5">Requested At</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pendingApprovals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No pending registration approvals.
                  </td>
                </tr>
              ) : (
                pendingApprovals.map((p) => (
                  <tr key={p.tenant_id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3.5 font-semibold text-foreground">
                      {p.tenant_name}
                    </td>
                    <td className="p-3.5 font-mono text-[11px] text-muted-foreground">
                      {p.tenant_slug}
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-foreground">{p.admin_name || "Admin"}</div>
                      <div className="text-[11px] text-muted-foreground">{p.admin_email}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="flex flex-wrap gap-1">
                        {(p.requested_modules.length > 0 ? p.requested_modules : ["inventory", "pos"]).map((m) => (
                          <span key={m} className="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary">
                            {m}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3.5 text-muted-foreground">
                      {p.requested_at ? new Date(p.requested_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="p-3.5 text-right">
                      <Button
                        size="sm"
                        onClick={() => handleApprovePendingTenant(p)}
                        className="gradient-brand text-white border-0 text-xs h-7"
                      >
                        <CheckCircle2 className="size-3 mr-1" /> Approve
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showCreateTenant && (
          <CreateTenantModal
            onClose={() => setShowCreateTenant(false)}
            onSuccess={() => void loadData()}
          />
        )}
        {showCreateUser && (
          <CreateUserModal
            tenants={tenants}
            onClose={() => setShowCreateUser(false)}
            onSuccess={() => void loadData()}
          />
        )}
        {resetTargetUser && (
          <ResetPasswordModal
            user={resetTargetUser}
            onClose={() => setResetTargetUser(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
