import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users, Search, ShieldCheck, RefreshCw, Key, ToggleLeft, ToggleRight,
  ShieldAlert, Loader2, Save, X, Eye, EyeOff, AlertCircle
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

interface PlatformUser {
  id: string;
  tenant_name: string;
  email: string;
  full_name: string;
  status: string;
  is_tenant_owner: boolean;
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

export function GlobalUsers() {
  const { accessToken } = useAuth();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCompany, setFilterCompany] = useState("all");
  const [resetUser, setResetUser] = useState<PlatformUser | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/system/users`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to fetch global users directory");
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { void load(); }, [load]);

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
                          {u.is_tenant_owner && (
                            <span className="text-[9px] bg-indigo-500/10 text-indigo-600 font-bold px-1 rounded uppercase tracking-wider">Owner</span>
                          )}
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
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {resetUser && <PasswordResetModal user={resetUser} onClose={() => setResetUser(null)} />}
      </AnimatePresence>
    </div>
  );
}
