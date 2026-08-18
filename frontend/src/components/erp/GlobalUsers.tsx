import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users, Search, ShieldCheck, RefreshCw, Key, ToggleLeft, ToggleRight,
  ShieldAlert, Loader2, Save, X, Eye, EyeOff, AlertCircle, Trash2
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useCurrency } from "@/hooks/use-currency";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

interface PlatformUser {
  id: string;
  tenant_name: string;
  email: string;
  full_name: string;
  status: string;
  is_tenant_owner: boolean;
  is_platform_admin?: boolean;
  mfa_enabled: boolean;
  created_at: string;
}


function PasswordResetModal({
  user,
  onClose,
}: {
  user: PlatformUser;
  onClose: () => void;
}) {
  const { accessToken } = useAuth();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!accessToken || !password) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/system/users/${user.id}/reset-password`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error("Failed to reset password");
      toast.success(`Password successfully reset for ${user.email}`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg flex items-center gap-2"><Key className="size-5 text-indigo-500" />Reset Password</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-muted-foreground">
            Administratively setting password for <strong className="text-foreground">{user.full_name}</strong> ({user.email}). The user will be required to update this password upon their next login.
          </p>
          <div>
            <label className="block text-xs font-semibold mb-1.5">New Temporary Password *</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full h-9 pl-3 pr-10 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Minimum 8 characters..."
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || password.length < 8} className="gradient-brand text-white border-0 min-w-[100px]">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <><Save className="size-4 mr-1.5" />Reset</>}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

interface PendingRegistration {
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  admin_name: string | null;
  admin_email: string | null;
  requested_modules: string[];
  enabled_modules: string[];
  status: string;
  requested_at: string;
}

export function GlobalUsers() {
    const { currency, formatCurrency } = useCurrency();
  const { accessToken } = useAuth();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingRegistration[]>([]);
  const [selectedModsMap, setSelectedModsMap] = useState<Record<string, string[]>>({});
  const [activeTab, setActiveTab] = useState<"users" | "pending">("users");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCompany, setFilterCompany] = useState("all");
  const [resetUser, setResetUser] = useState<PlatformUser | null>(null);

  const [isForbidden, setIsForbidden] = useState(false);

  const loadPending = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch(`${API_BASE_URL}/system/pending-approvals`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data: PendingRegistration[] = await res.json();
        setPendingApprovals(data);
        const map: Record<string, string[]> = {};
        data.forEach((item) => {
          map[item.tenant_id] = item.requested_modules.length > 0 ? item.requested_modules : ["inventory", "pos"];
        });
        setSelectedModsMap(map);
      }
    } catch {
      // ignore
    }
  }, [accessToken]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/system/users`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.status === 403) {
        setIsForbidden(true);
        setUsers([]);
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch global users directory");
      const data = await res.json();
      setIsForbidden(false);
      setUsers(data);
    } catch (err: any) {
      console.error(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
    void loadPending();
  }, [accessToken, loadPending]);

  useEffect(() => { void load(); }, [load]);


  const handleApproveRegistration = async (item: PendingRegistration) => {
    if (!accessToken) return;
    const modsToApprove = selectedModsMap[item.tenant_id] || item.requested_modules;
    if (!window.confirm(`Approve workspace "${item.tenant_name}" with modules: ${modsToApprove.join(", ").toUpperCase()}?`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/system/tenants/${item.tenant_id}/approve`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ approved_modules: modsToApprove }),
      });
      if (!res.ok) throw new Error("Failed to approve workspace");
      toast.success(`Workspace "${item.tenant_name}" approved successfully!`);
      void load();
      void loadPending();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve workspace");
    }
  };

  const toggleModuleSelection = (tenantId: string, modId: string) => {
    setSelectedModsMap((prev) => {
      const current = prev[tenantId] || [];
      const updated = current.includes(modId) ? current.filter((m) => m !== modId) : [...current, modId];
      return { ...prev, [tenantId]: updated };
    });
  };


  const toggleUserStatus = async (user: PlatformUser) => {
    if (!accessToken) return;
    const nextStatus = user.status.toLowerCase() === "active" ? "inactive" : "active";
    const confirmText = nextStatus === "inactive" 
      ? `Suspend user account ${user.email}? they will be instantly blocked from all systems.`
      : `Reactivate user account ${user.email}?`;
    
    if (!window.confirm(confirmText)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/system/users/${user.id}/status`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("Failed to change user account status");
      toast.success(`User status updated to ${nextStatus.toUpperCase()}`);
      void load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggleSuperAdmin = async (user: PlatformUser) => {
    if (!accessToken) return;
    const isGod = Boolean(user.is_platform_admin || user.email === "venaticfungus@gmail.com");
    const actionText = isGod ? "Demote God Mode access from" : "Promote to Global Super Admin (God Mode)";
    if (!window.confirm(`${actionText} ${user.email}? This grants 100% unrestricted control across all tenant workspaces, SaaS administration, and system settings.`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/system/users/${user.id}/toggle-super-admin`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to update God Mode status");
      toast.success(isGod ? `Demoted ${user.email} from God Mode.` : `Successfully promoted ${user.email} to Global Super Admin (God Mode)!`);
      void load();
    } catch (err: any) {
      toast.error(err.message || "Failed to update super admin status");
    }
  };


  const handleResetMfa = async (user: PlatformUser) => {
    if (!accessToken) return;
    if (!window.confirm(`Force disable Multi-Factor Authentication (MFA) for ${user.email}?`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/system/users/${user.id}/reset-mfa`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to disable MFA");
      toast.success(`MFA successfully disabled for ${user.email}`);
      void load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteUser = async (user: PlatformUser) => {
    if (!accessToken) return;
    const isGod = Boolean(user.is_platform_admin || user.email === "venaticfungus@gmail.com");
    const warning = isGod ? " (⚠️ WARNING: This user is a Platform Super Admin / God Mode user!)" : "";
    if (!window.confirm(`Permanently delete user "${user.full_name}" (${user.email}) from workspace "${user.tenant_name}"?${warning}\n\nAll their sessions, access roles, and associated tokens will be permanently purged. This action CANNOT be undone.`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/system/users/${user.id}`, {
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
      toast.success(`User ${user.email} permanently deleted from platform!`);
      void load();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user");
    }
  };

  if (isForbidden) {
    return (
      <div className="p-12 max-w-2xl mx-auto text-center space-y-5">
        <div className="size-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 grid place-items-center mx-auto text-2xl">
          🛡️
        </div>
        <h3 className="text-xl font-bold text-slate-900">Platform Administration Access Restricted</h3>
        <p className="text-sm text-slate-600 leading-relaxed">
          The <strong>Global Users Directory</strong> and multi-tenant workspace administration console are reserved exclusively for the <strong>SaaS Platform Provider Super Admins</strong> (e.g., <code>system</code> or <code>venatic</code> workspace).
        </p>
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 text-left">
          <strong>Client Tenant Super Admin Note:</strong> As a Super Admin of your own company workspace, you can manage your company's users, roles, and security permissions under <strong>System Configuration ➔ Access & Security ➔ User Directory</strong>.
        </div>
      </div>
    );
  }

  const companiesList = Array.from(new Set(users.map((u) => u.tenant_name)));

  const filtered = users.filter((u) => {
    const matchesSearch = 
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.tenant_name.toLowerCase().includes(search.toLowerCase());
    
    const matchesCompany = filterCompany === "all" || u.tenant_name === filterCompany;

    return matchesSearch && matchesCompany;
  });

  return (


    <div className="p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="size-6 text-primary" /> Global Users Directory
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Platform-wide support desk console. Suspend logins, reset passwords, or remove MFA locks across all client workspaces.
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-9 gap-2" onClick={load} disabled={loading}>
          <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Refresh Directory
        </Button>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b pb-2">
        <button
          onClick={() => setActiveTab("users")}
          className={cn(
            "px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2",
            activeTab === "users" ? "bg-primary text-white shadow-sm" : "bg-muted/50 text-muted-foreground hover:bg-muted"
          )}
        >
          <Users className="size-4" /> Active Users ({users.length})
        </button>
        <button
          onClick={() => setActiveTab("pending")}
          className={cn(
            "px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 relative",
            activeTab === "pending" ? "bg-indigo-600 text-white shadow-sm" : "bg-muted/50 text-muted-foreground hover:bg-muted"
          )}
        >
          ⏳ Pending Workspace Approvals
          {pendingApprovals.length > 0 && (
            <span className="bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full animate-bounce">
              {pendingApprovals.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "pending" ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border bg-amber-500/5 border-amber-500/20 text-xs text-amber-900 flex items-center gap-3">
            <ShieldCheck className="size-5 text-amber-600 shrink-0" />
            <div>
              <strong>Pending Workspace Registrations:</strong> Review requested modules chosen by new client signups, customize approved module entitlements, and click <strong>Approve Workspace</strong> to provision their account.
            </div>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-muted-foreground text-xs">Workspace & Owner</th>
                  <th className="px-6 py-3 text-left font-semibold text-muted-foreground text-xs">Requested Date</th>
                  <th className="px-6 py-3 text-left font-semibold text-muted-foreground text-xs">Module Entitlements Customization</th>
                  <th className="px-6 py-3 text-right font-semibold text-muted-foreground text-xs">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pendingApprovals.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                      <ShieldCheck className="size-8 mx-auto mb-2 text-emerald-500 opacity-60" />
                      <p className="font-semibold text-slate-800">No Pending Workspace Registrations</p>
                      <p className="text-xs">All workspace signups have been reviewed and approved.</p>
                    </td>
                  </tr>
                ) : (
                  pendingApprovals.map((item) => {
                    const currentSelected = selectedModsMap[item.tenant_id] || item.requested_modules;
                    return (
                      <tr key={item.tenant_id} className="hover:bg-muted/20">
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                              🏢 {item.tenant_name}
                              <span className="text-[10px] bg-amber-500/10 text-amber-700 border border-amber-500/20 px-1.5 py-0.5 rounded font-bold uppercase">
                                Pending Approval
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground font-mono mt-0.5">
                              Slug: <strong>{item.tenant_slug}</strong>
                            </div>
                            {item.admin_email && (
                              <div className="text-xs text-slate-600 mt-1">
                                Owner: <strong>{item.admin_name || "Admin"}</strong> ({item.admin_email})
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-muted-foreground">
                          {new Date(item.requested_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-bold text-slate-700 block">Check Modules to Approve:</span>
                            <div className="flex flex-wrap gap-1.5 max-w-md">
                              {[
                                { id: "inventory", name: "📦 Inventory" },
                                { id: "pos", name: "🛒 POS" },
                                { id: "accounting", name: "📊 Finance" },
                                { id: "crm", name: "🤝 CRM" },
                                { id: "procurement", name: "💼 Procurement" },
                                { id: "hrms", name: "🏢 HRMS" },
                                { id: "iot", name: "🔌 IoT" },
                                { id: "copilot", name: "🤖 Copilot" },
                              ].map((mod) => {
                                const isChecked = currentSelected.includes(mod.id);
                                return (
                                  <label
                                    key={mod.id}
                                    onClick={() => toggleModuleSelection(item.tenant_id, mod.id)}
                                    className={cn(
                                      "cursor-pointer text-[11px] font-semibold px-2 py-1 rounded border transition-all select-none flex items-center gap-1",
                                      isChecked
                                        ? "bg-indigo-600 text-white border-indigo-600"
                                        : "bg-background text-slate-600 border-slate-200 hover:border-slate-300"
                                    )}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      readOnly
                                      className="size-3 accent-indigo-600"
                                    />
                                    {mod.name}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            onClick={() => handleApproveRegistration(item)}
                            className="gradient-brand text-white font-bold text-xs h-9 px-4 gap-1.5 shadow-sm"
                          >
                            <ShieldCheck className="size-4" /> Approve & Provision
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-60 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-4 text-sm rounded-lg border bg-card focus:ring-2 focus:ring-primary/20 outline-none"
                placeholder="Search by full name, email, workspace..." />
            </div>
            
            <select
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              className="h-10 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20 min-w-44"
            >
              <option value="all">All Client Companies</option>
              {companiesList.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>


      {/* Grid table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-6 py-3 text-left font-semibold text-muted-foreground text-xs">Full Name & Email</th>
              <th className="px-6 py-3 text-left font-semibold text-muted-foreground text-xs">Client Workspace</th>
              <th className="px-6 py-3 text-left font-semibold text-muted-foreground text-xs">MFA Status</th>
              <th className="px-6 py-3 text-left font-semibold text-muted-foreground text-xs">Registered</th>
              <th className="px-6 py-3 text-left font-semibold text-muted-foreground text-xs">User status</th>
              <th className="px-6 py-3 text-right font-semibold text-muted-foreground text-xs">Administrative Support</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={6} className="px-6 py-4">
                    <div className="h-5 bg-muted/40 rounded w-full" />
                  </td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center text-muted-foreground">
                  <Users className="size-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No accounts found in this global query</p>
                </td>
              </tr>
            ) : (
              filtered.map((u) => {
                const isActive = u.status.toLowerCase() === "active";
                return (
                  <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          {u.full_name}
                          {Boolean(u.is_platform_admin || u.email === "venaticfungus@gmail.com") ? (
                            <span className="text-[9px] bg-gradient-to-r from-amber-500 to-yellow-600 text-white px-1.5 py-0.5 rounded uppercase tracking-wider font-extrabold shadow-sm flex items-center gap-0.5">
                              👑 God Mode
                            </span>
                          ) : u.is_tenant_owner ? (
                            <span className="text-[9px] bg-indigo-500/10 text-indigo-700 border border-indigo-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
                              🏢 Workspace Owner
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">{u.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-indigo-500/5 text-indigo-600 font-bold border border-indigo-500/10 text-[10px]">
                        🏢 {u.tenant_name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                        u.mfa_enabled 
                          ? "bg-emerald-50 text-emerald-600 border-emerald-200" 
                          : "bg-muted text-muted-foreground border-border"
                      )}>
                        {u.mfa_enabled ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border",
                        isActive 
                          ? "bg-emerald-50 text-emerald-600 border-emerald-200 animate-pulse" 
                          : "bg-rose-50 text-rose-600 border-rose-200"
                      )}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {Boolean(u.is_platform_admin || u.email === "venaticfungus@gmail.com") ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleSuperAdmin(u)}
                            className="h-8 px-2 text-xs font-bold gap-1 text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200"
                            title="Demote from Global Super Admin / God Mode"
                          >
                            ⚡ Demote God Mode
                          </Button>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleToggleSuperAdmin(u)}
                            className="h-8 px-2.5 text-xs font-bold gap-1 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white border-0 shadow-sm"
                            title="Promote to Global Super Admin with 100% God Mode access"
                          >
                            👑 Promote to God Mode
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleUserStatus(u)}
                          className={cn("h-8 px-2.5 text-xs font-bold gap-1", isActive ? "text-red-500 hover:text-red-600" : "text-emerald-600 hover:text-emerald-700")}
                          title={isActive ? "Suspend login access" : "Reactivate account"}
                        >
                          {isActive ? <ToggleLeft className="size-4" /> : <ToggleRight className="size-4" />}
                          {isActive ? "Suspend" : "Activate"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setResetUser(u)}
                          className="h-8 px-2.5 text-xs text-indigo-500 hover:text-indigo-600 font-bold gap-1"
                        >
                          <Key className="size-3.5" /> PW Reset
                        </Button>
                        {u.mfa_enabled && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResetMfa(u)}
                            className="h-8 px-2.5 text-xs text-amber-500 hover:text-amber-600 font-bold gap-1"
                          >
                            <ShieldAlert className="size-3.5" /> Reset MFA
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteUser(u)}
                          className="h-8 px-2.5 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-bold gap-1"
                          title="Permanently Delete User"
                        >
                          <Trash2 className="size-3.5" /> Delete
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
      </>
      )}



      <AnimatePresence>
        {resetUser && <PasswordResetModal user={resetUser} onClose={() => setResetUser(null)} />}
      </AnimatePresence>
    </div>
  );
}
