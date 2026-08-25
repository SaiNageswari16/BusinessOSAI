import React, { useState, useEffect, useCallback } from "react";
import { 
  Users, 
  ShieldCheck, 
  ShieldAlert, 
  Key, 
  Search, 
  RefreshCw, 
  Trash2, 
  ToggleLeft, 
  ToggleRight, 
  Save, 
  X, 
  Eye, 
  EyeOff, 
  Loader2,
  Building,
  Sparkles,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { useCurrency } from "@/hooks/use-currency";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

interface PlatformUser {
  id: string;
  tenant_id: string;
  tenant_name: string;
  email: string;
  full_name: string;
  status: string;
  is_platform_admin: boolean;
  is_tenant_owner: boolean;
  mfa_enabled: boolean;
  created_at: string;
}

interface PlatformTenant {
  id: string;
  slug: string;
  name: string;
  plan: string;
  status: string;
  created_at: string;
  owner_name: string;
  owner_email: string;
  user_count: number;
}

interface PasswordResetModalProps {
  user: PlatformUser;
  onClose: () => void;
}

function PasswordResetModal({ user, onClose }: PasswordResetModalProps) {
  const { accessToken } = useAuth();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

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
  const [tenants, setTenants] = useState<PlatformTenant[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingRegistration[]>([]);
  const [selectedModsMap, setSelectedModsMap] = useState<Record<string, string[]>>({});
  const [activeTab, setActiveTab] = useState<"users" | "tenants" | "pending">("users");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCompany, setFilterCompany] = useState("all");
  const [resetUser, setResetUser] = useState<PlatformUser | null>(null);
  const [isPurgingOrphans, setIsPurgingOrphans] = useState(false);
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

  const loadTenants = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch(`${API_BASE_URL}/system/tenants`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data: PlatformTenant[] = await res.json();
        setTenants(data);
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
    void loadTenants();
  }, [accessToken, loadPending, loadTenants]);

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
      if (!res.ok) throw new Error("Failed to update status");
      toast.success(`User status updated to ${nextStatus.toUpperCase()}`);
      void load();
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle status");
    }
  };

  const handleResetMfa = async (user: PlatformUser) => {
    if (!accessToken) return;
    if (!window.confirm(`Reset MFA hardware lock for user ${user.email}?`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/system/users/${user.id}/reset-mfa`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to reset MFA");
      toast.success(`MFA credentials reset for ${user.email}`);
      void load();
    } catch (err: any) {
      toast.error(err.message || "Failed to reset MFA");
    }
  };

  const handleToggleSuperAdmin = async (user: PlatformUser) => {
    if (!accessToken) return;
    const isSuper = Boolean(user.is_platform_admin || user.email === "venaticfungus@gmail.com");
    const nextState = !isSuper;
    const confirmText = nextState
      ? `Promote "${user.full_name}" (${user.email}) to Global Platform Super Admin / God Mode?\n\nThey will gain unrestricted access to all client companies, settings, and administration tools.`
      : `Revoke Global Super Admin privileges from "${user.full_name}" (${user.email})?`;

    if (!window.confirm(confirmText)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/system/users/${user.id}/super-admin`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_platform_admin: nextState }),
      });
      if (!res.ok) throw new Error("Failed to update platform super admin privileges");
      toast.success(nextState ? `User ${user.email} promoted to God Mode!` : `God mode removed from ${user.email}`);
      void load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteUser = async (user: PlatformUser) => {
    if (!accessToken) return;
    const isGod = Boolean(user.is_platform_admin || user.email === "venaticfungus@gmail.com");
    const warning = isGod ? " (⚠️ WARNING: This user is a Platform Super Admin / God Mode user!)" : "";
    if (!window.confirm(`Permanently delete user "${user.full_name}" (${user.email}) from workspace "${user.tenant_name}"?${warning}\n\nAll their sessions, access roles, products, invoices, and organization records will be permanently purged. This action CANNOT be undone.`)) return;

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
      toast.success(`User ${user.email} and related workspace data permanently deleted!`);
      window.dispatchEvent(new CustomEvent("bos-tenant-changed"));
      window.dispatchEvent(new Event("storage"));
      void load();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user");
    }
  };

  const handleDeleteTenant = async (t: PlatformTenant) => {
    if (!accessToken) return;
    if (t.slug === "system") {
      toast.error("Cannot delete the root system workspace");
      return;
    }
    if (!window.confirm(`⚠️ PERMANENTLY PURGE WORKSPACE "${t.name}" (${t.slug})?\n\nThis will completely delete this entire organization, all its products, batches, inventory, invoices, accounting lines, POS sessions, and users from the entire database.\n\nThis action CANNOT be undone.`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/system/tenants/${t.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const body = await res.text();
        toast.error(body || "Failed to purge workspace");
        return;
      }
      toast.success(`Workspace "${t.name}" and all its records have been permanently purged!`);
      window.dispatchEvent(new CustomEvent("bos-tenant-changed"));
      window.dispatchEvent(new Event("storage"));
      void load();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete workspace");
    }
  };

  const handlePurgeOrphans = async () => {
    if (!accessToken) return;
    if (!window.confirm("Scan database and permanently delete all orphaned workspaces that have 0 remaining users?")) return;
    setIsPurgingOrphans(true);
    try {
      const res = await fetch(`${API_BASE_URL}/system/tenants/purge-orphans`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to purge orphans");
      const json = await res.json();
      toast.success(json.message || "Orphaned workspaces purged successfully!");
      window.dispatchEvent(new CustomEvent("bos-tenant-changed"));
      window.dispatchEvent(new Event("storage"));
      void load();
    } catch (err: any) {
      toast.error(err.message || "Error purging orphaned workspaces");
    } finally {
      setIsPurgingOrphans(false);
    }
  };

  if (isForbidden) {
    return (
      <div className="p-12 max-w-2xl mx-auto text-center space-y-5">
        <div className="size-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 grid place-items-center mx-auto text-2xl">
          🛡️
        </div>
        <h3 className="text-xl font-bold text-slate-900">Platform Administration Access Restricted</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The <strong>Global Support Directory</strong> is reserved for Platform Super Administrators (God Mode).
          You are currently logged in with regular client workspace administrator credentials.
        </p>
      </div>
    );
  }

  const companiesList = Array.from(new Set(users.map((u) => u.tenant_name)));

  const filteredUsers = users.filter((u) => {
    const matchesSearch = 
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.tenant_name.toLowerCase().includes(search.toLowerCase());
    
    const matchesCompany = filterCompany === "all" || u.tenant_name === filterCompany;

    return matchesSearch && matchesCompany;
  });

  const filteredTenants = tenants.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase()) ||
    t.owner_email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
            <Users className="size-5 text-primary" /> Global Users & Workspaces Directory
          </h2>
          <p className="text-muted-foreground text-xs mt-0.5">
            Platform-wide support desk console. Manage users, purge deleted client workspaces, or provision subscriptions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "tenants" && (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-9 gap-2 text-rose-600 border-rose-200 hover:bg-rose-50 font-bold" 
              onClick={handlePurgeOrphans} 
              disabled={isPurgingOrphans || loading}
            >
              <Trash2 className={cn("size-4", isPurgingOrphans && "animate-spin")} /> Purge Orphaned Workspaces
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-9 gap-2 font-bold" onClick={load} disabled={loading}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Refresh Directory
          </Button>
        </div>
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
          onClick={() => setActiveTab("tenants")}
          className={cn(
            "px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2",
            activeTab === "tenants" ? "bg-emerald-600 text-white shadow-sm" : "bg-muted/50 text-muted-foreground hover:bg-muted"
          )}
        >
          <Building className="size-4" /> All Workspaces ({tenants.length})
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

      {/* PENDING TAB */}
      {activeTab === "pending" && (
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
                                  <button
                                    key={mod.id}
                                    type="button"
                                    onClick={() => toggleModuleSelection(item.tenant_id, mod.id)}
                                    className={cn(
                                      "px-2 py-1 rounded text-xs font-semibold border transition-all flex items-center gap-1",
                                      isChecked
                                        ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                                        : "bg-muted/40 text-muted-foreground border-transparent opacity-60 hover:opacity-100"
                                    )}
                                  >
                                    <span className={cn("size-2 rounded-full", isChecked ? "bg-emerald-500" : "bg-slate-300")} />
                                    {mod.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            size="sm"
                            onClick={() => handleApproveRegistration(item)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 shadow-sm gap-1"
                          >
                            <ShieldCheck className="size-3.5" /> Approve Workspace
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
      )}

      {/* ALL WORKSPACES TAB */}
      {activeTab === "tenants" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Search workspace by name, slug, or owner..."
              />
            </div>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-muted-foreground text-xs">Workspace Name & Slug</th>
                  <th className="px-6 py-3 text-left font-semibold text-muted-foreground text-xs">Plan & Status</th>
                  <th className="px-6 py-3 text-left font-semibold text-muted-foreground text-xs">Owner & Users</th>
                  <th className="px-6 py-3 text-left font-semibold text-muted-foreground text-xs">Created Date</th>
                  <th className="px-6 py-3 text-right font-semibold text-muted-foreground text-xs">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      <Building className="size-8 mx-auto mb-2 opacity-20" />
                      <p className="font-semibold text-slate-800">No Workspaces Found</p>
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-bold text-foreground flex items-center gap-1.5">
                            🏢 {t.name}
                            {t.slug === "system" && (
                              <span className="text-[9px] bg-amber-500/10 text-amber-700 border border-amber-500/20 px-1.5 py-0.5 rounded font-extrabold uppercase">
                                System Root
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">
                            slug: <strong>{t.slug}</strong> | id: <span className="text-[10px]">{t.id.slice(0, 8)}...</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {t.plan || "Starter"}
                          </span>
                          <span className={cn(
                            "text-[10px] font-bold uppercase px-2 py-0.5 rounded border",
                            t.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                          )}>
                            {t.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs">
                          <div className="font-semibold text-slate-800">{t.owner_name}</div>
                          <div className="text-muted-foreground font-mono text-[11px]">{t.owner_email}</div>
                          <div className="text-[11px] font-bold text-slate-600 mt-0.5">
                            {t.user_count === 0 ? (
                              <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                0 Users (Orphaned)
                              </span>
                            ) : (
                              <span>👥 {t.user_count} {t.user_count === 1 ? "user" : "users"}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {t.slug !== "system" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTenant(t)}
                            className="h-8 px-2.5 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-bold gap-1"
                            title="Permanently Purge Entire Workspace and All Data"
                          >
                            <Trash2 className="size-3.5" /> Purge Workspace
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ACTIVE USERS TAB */}
      {activeTab === "users" && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Search by full name, email, workspace..."
              />
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
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-muted-foreground">
                      <Users className="size-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No accounts found in this global query</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
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
                              title="Permanently Delete User & Cascade Workspace Data"
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
