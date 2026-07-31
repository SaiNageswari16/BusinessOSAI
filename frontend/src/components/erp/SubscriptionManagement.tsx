import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, Zap, HardDrive, Users, Sparkles, Server,
  AlertTriangle, Play, Pause, RefreshCw, Search, ShieldAlert,
  Clock, Activity, Globe, Info
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

interface PlatformTenant {
  id: string;
  slug: string;
  name: string;
  plan: string;
  status: "active" | "suspended" | "trial" | "cancelled";
  created_at: string;
  owner_name: string;
  owner_email: string;
  user_count: number;
}

interface PlatformAuditLog {
  id: string;
  tenant_name: string;
  user_name: string | null;
  user_email: string | null;
  module: string;
  action: string;
  ip_address: string | null;
  created_at: string;
}

export function SubscriptionManagement() {
  const { user, accessToken } = useAuth();
  const [tenants, setTenants] = useState<PlatformTenant[]>([]);
  const [auditLogs, setAuditLogs] = useState<PlatformAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const isPlatformAdmin = user?.tenantSlug === "system" && user?.isTenantOwner;

  const loadTenants = async () => {
    if (!accessToken || !isPlatformAdmin) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/system/tenants`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to load platform tenants list");
      const data = await res.json();
      setTenants(data);
    } catch (error: any) {
      console.error(error.message || "Could not fetch platform data");
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    if (!accessToken || !isPlatformAdmin) return;
    setLogsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/system/audit-logs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to load system audit trail");
      const data = await res.json();
      setAuditLogs(data);
    } catch (error: any) {
      console.error(error.message || "Could not load system audit trail");
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (isPlatformAdmin) {
      void loadTenants();
      void loadAuditLogs();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, isPlatformAdmin]);

  const toggleTenantStatus = async (tenantId: string, currentStatus: string) => {
    if (!accessToken) return;
    const nextStatus = currentStatus === "active" ? "suspended" : "active";
    const confirmMessage = currentStatus === "active" 
      ? "Are you sure you want to suspend this workspace? All their users will be immediately locked out."
      : "Activate this workspace? Their users will be allowed to log in and resume work.";
      
    if (!window.confirm(confirmMessage)) return;

    setUpdatingId(tenantId);
    try {
      const res = await fetch(`${API_BASE_URL}/system/tenants/${tenantId}/status`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail ?? "Failed to update workspace status");
      }
      toast.success(`Workspace status updated to ${nextStatus}`);
      await loadTenants();
      await loadAuditLogs();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // ─── SaaS Platform Owner View ────────────────────────────────────
  if (isPlatformAdmin) {
    const filtered = tenants.filter(t => {
      const matchesSearch = 
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.owner_email.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = filterStatus === "all" || t.status === filterStatus;
      return matchesSearch && matchesFilter;
    });

    const activeCount = tenants.filter(t => t.status === "active").length;
    const trialCount = tenants.filter(t => t.status === "trial").length;
    const suspendedCount = tenants.filter(t => t.status === "suspended").length;

    return (
      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ShieldAlert className="size-6 text-indigo-500" /> SaaS Platform Oversight
            </h2>
            <p className="text-muted-foreground text-sm mt-1">Cross-tenant administrative control console, logs, and subscriber profiles.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { void loadTenants(); void loadAuditLogs(); }} className="gap-2 h-9">
              <RefreshCw className={cn("size-4", (loading || logsLoading) && "animate-spin")} /> Refresh Feeds
            </Button>
          </div>
        </div>

        {/* ───────── KPI Cards ───────── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border-indigo-500/10">
            <div className="text-xs font-semibold text-muted-foreground uppercase">Total Workspaces</div>
            <div className="text-2xl font-black mt-2 text-indigo-600">{tenants.length}</div>
            <div className="text-[10px] text-muted-foreground mt-1">Registered clients & companies</div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border-emerald-500/10">
            <div className="text-xs font-semibold text-muted-foreground uppercase">Active Workspaces</div>
            <div className="text-2xl font-black mt-2 text-emerald-600">{activeCount}</div>
            <div className="text-[10px] text-muted-foreground mt-1">Operational environments</div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 border-blue-500/10">
            <div className="text-xs font-semibold text-muted-foreground uppercase">Free Trials</div>
            <div className="text-2xl font-black mt-2 text-blue-600">{trialCount}</div>
            <div className="text-[10px] text-muted-foreground mt-1">Evaluating the enterprise system</div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-amber-500/5 to-red-500/5 border-amber-500/10">
            <div className="text-xs font-semibold text-muted-foreground uppercase">Suspended Workspaces</div>
            <div className="text-2xl font-black mt-2 text-amber-600">{suspendedCount}</div>
            <div className="text-[10px] text-muted-foreground mt-1">Administrative blocks active</div>
          </Card>
        </div>

        {/* ───────── Workspace Tenant Accounts List ───────── */}
        <Card className="p-6 border-border/60">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h3 className="font-bold text-lg">Subscribed Workspace Environments</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Toggle status to immediately block/allow tenant system access.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-60">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search tenants or owners..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="py-1.5 px-3 text-xs rounded-lg border bg-background outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="trial">Trial</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <RefreshCw className="size-6 animate-spin text-primary" /> Loading environments...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed rounded-xl text-muted-foreground text-sm">
              No matching workspace environments found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground font-medium bg-muted/20">
                    <th className="py-3 px-4">Workspace Environment</th>
                    <th className="py-3 px-4">Workspace Slug</th>
                    <th className="py-3 px-4">Plan Level</th>
                    <th className="py-3 px-4">Owner Contact</th>
                    <th className="py-3 px-4">Active Users</th>
                    <th className="py-3 px-4">Registered Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => {
                    const isSuspended = t.status === "suspended";
                    return (
                      <tr key={t.id} className="border-b last:border-0 hover:bg-muted/10">
                        <td className="py-4 px-4">
                          <span className="font-bold text-foreground">{t.name}</span>
                        </td>
                        <td className="py-4 px-4 font-mono text-[10px] text-muted-foreground">{t.slug}</td>
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 font-bold uppercase text-[9px]">
                            {t.plan}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div>
                            <div className="font-semibold text-foreground">{t.owner_name}</div>
                            <div className="text-[10px] text-muted-foreground">{t.owner_email}</div>
                          </div>
                        </td>
                        <td className="py-4 px-4 font-bold text-foreground">{t.user_count} users</td>
                        <td className="py-4 px-4 text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</td>
                        <td className="py-4 px-4">
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                            t.status === "active" && "bg-emerald-50 text-emerald-600 border-emerald-200",
                            t.status === "suspended" && "bg-rose-50 text-rose-600 border-rose-200",
                            t.status === "trial" && "bg-blue-50 text-blue-600 border-blue-200",
                            t.status === "cancelled" && "bg-muted text-muted-foreground border-border"
                          )}>
                            {t.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          {t.slug !== "system" && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              disabled={updatingId === t.id}
                              onClick={() => toggleTenantStatus(t.id, t.status)}
                              className={cn(
                                "h-7 gap-1 text-[10px] font-bold",
                                isSuspended 
                                  ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50/40" 
                                  : "text-amber-600 hover:text-amber-700 hover:bg-amber-50/40"
                              )}
                            >
                              {isSuspended ? (
                                <><Play className="size-3" /> Activate</>
                              ) : (
                                <><Pause className="size-3" /> Suspend</>
                              )}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* ───────── LIVE CROSS-TENANT AUDIT LOG TRAIL ───────── */}
        <Card className="p-6 border-border/60">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Activity className="size-5 text-indigo-500 animate-pulse" /> Live Platform Activity logs
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Real-time cross-tenant operations audit stream monitor.</p>
            </div>
            <Button variant="outline" size="sm" onClick={loadAuditLogs} className="h-8 gap-1.5">
              <RefreshCw className={cn("size-3.5", logsLoading && "animate-spin")} /> Reload Logs
            </Button>
          </div>

          {logsLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <RefreshCw className="size-5 animate-spin text-indigo-500" /> Querying platform records...
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="py-12 text-center border border-dashed rounded-xl text-muted-foreground text-sm">
              No transactions recorded in the system audit trail yet.
            </div>
          ) : (
            <div className="space-y-3">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 rounded-lg border bg-muted/10 gap-3 text-xs hover:bg-muted/20 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="size-8 rounded-lg bg-indigo-500/10 text-indigo-600 grid place-items-center shrink-0 mt-0.5">
                      <Activity className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-foreground px-2 py-0.5 rounded bg-indigo-500/5 border border-indigo-500/10 text-[10px]">
                          🏢 {log.tenant_name}
                        </span>
                        <span className="font-semibold text-muted-foreground">
                          {log.user_name || log.user_email || "System Daemon"}
                        </span>
                        <span className="text-muted-foreground">performed</span>
                        <span className="font-bold text-foreground font-mono bg-background border px-1.5 py-0.5 rounded text-[10px]">
                          {log.module}:{log.action}
                        </span>
                      </div>
                      <div className="text-muted-foreground text-[10px] mt-1 flex items-center gap-3">
                        <span className="flex items-center gap-1"><Clock className="size-3" /> {new Date(log.created_at).toLocaleString()}</span>
                        {log.ip_address && <span className="flex items-center gap-1"><Globe className="size-3" /> IP: {log.ip_address}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] font-bold text-indigo-600 bg-indigo-500/5 px-2.5 py-1 rounded-full border border-indigo-500/10">
                    Oversight Logged
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  // ─── Normal Tenant / Customer Invoice & Billing View ───────────────
  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Subscription & Licenses</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage your LazyMonkeyAI plan, modules, and billing.</p>
        </div>
        <Button size="sm" className="h-9 gap-2 gradient-brand text-white border-0"><Zap className="size-4" /> Upgrade Plan</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-2 p-6 flex flex-col justify-between bg-gradient-to-br from-primary/5 to-brand-purple/5 border-primary/20">
          <div>
            <div className="flex items-center gap-2 mb-2 text-primary font-bold">
              <Sparkles className="size-5" /> Enterprise Edition
            </div>
            <h3 className="text-3xl font-black mb-1">$4,999<span className="text-sm text-muted-foreground font-medium"> / month</span></h3>
            <p className="text-sm text-muted-foreground">Billed annually. Next billing date: <strong>March 1, 2027</strong></p>
          </div>
          
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-foreground font-medium"><CheckCircle2 className="size-4 text-emerald-500" /> Unlimited Modules</div>
              <div className="flex items-center gap-2 text-sm text-foreground font-medium"><CheckCircle2 className="size-4 text-emerald-500" /> Advanced Antigravity AI</div>
              <div className="flex items-center gap-2 text-sm text-foreground font-medium"><CheckCircle2 className="size-4 text-emerald-500" /> Dedicated Account Manager</div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-foreground font-medium"><CheckCircle2 className="size-4 text-emerald-500" /> Custom API Rate Limits</div>
              <div className="flex items-center gap-2 text-sm text-foreground font-medium"><CheckCircle2 className="size-4 text-emerald-500" /> White-labeling Options</div>
              <div className="flex items-center gap-2 text-sm text-foreground font-medium"><CheckCircle2 className="size-4 text-emerald-500" /> 24/7 Priority Support</div>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <h3 className="font-bold text-lg mb-4">Current Usage</h3>
          
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-xs mb-1.5 font-medium">
                <span className="flex items-center gap-1.5 text-muted-foreground"><Users className="size-3.5" /> Users</span>
                <span>350 / 500</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden"><div className="h-full rounded-full bg-blue-500 w-[70%]" /></div>
            </div>
            
            <div>
              <div className="flex justify-between text-xs mb-1.5 font-medium">
                <span className="flex items-center gap-1.5 text-muted-foreground"><HardDrive className="size-3.5" /> Storage</span>
                <span>8.4 TB / 10 TB</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden"><div className="h-full rounded-full bg-amber-500 w-[84%]" /></div>
            </div>
            
            <div>
              <div className="flex justify-between text-xs mb-1.5 font-medium">
                <span className="flex items-center gap-1.5 text-muted-foreground"><Server className="size-3.5" /> API Calls</span>
                <span>12.4M / 20M</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden"><div className="h-full rounded-full bg-emerald-500 w-[62%]" /></div>
            </div>
            
            <div>
              <div className="flex justify-between text-xs mb-1.5 font-medium">
                <span className="flex items-center gap-1.5 text-muted-foreground"><Sparkles className="size-3.5" /> AI Credits</span>
                <span>4.1M / 10M</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden"><div className="h-full rounded-full bg-purple-500 w-[41%]" /></div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
