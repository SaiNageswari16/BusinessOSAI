import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, Zap, HardDrive, Users, Sparkles, Server,
  AlertTriangle, Play, Pause, RefreshCw, Search, ShieldAlert,
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

export function SubscriptionManagement() {
  const { user, accessToken } = useAuth();
  const [tenants, setTenants] = useState<PlatformTenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const isPlatformAdmin = user?.tenantSlug === "system" && user?.isTenantOwner;

  console.log("SubscriptionManagement render debug:", {
    user,
    isPlatformAdmin,
    tenantSlug: user?.tenantSlug,
    isTenantOwner: user?.isTenantOwner,
  });


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
      toast.error(error.message || "Could not fetch platform data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isPlatformAdmin) {
      void loadTenants();
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
      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ShieldAlert className="size-6 text-primary" /> Platform Administration
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              SaaS Console — Manage registered customer workspaces, verify signups, and control billing status.
            </p>
          </div>
          <Button size="sm" onClick={loadTenants} disabled={loading} className="gap-2">
            <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Refresh Signups
          </Button>
        </div>

        {/* Platform metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 flex flex-col justify-between">
            <span className="text-xs text-muted-foreground font-medium uppercase">Total Workspaces</span>
            <span className="text-2xl font-bold mt-2">{tenants.length}</span>
          </Card>
          <Card className="p-4 flex flex-col justify-between border-l-emerald-500 border-l-2">
            <span className="text-xs text-muted-foreground font-medium uppercase">Active Accounts</span>
            <span className="text-2xl font-bold mt-2 text-emerald-600">{activeCount}</span>
          </Card>
          <Card className="p-4 flex flex-col justify-between border-l-blue-500 border-l-2">
            <span className="text-xs text-muted-foreground font-medium uppercase">Trial Accounts</span>
            <span className="text-2xl font-bold mt-2 text-blue-600">{trialCount}</span>
          </Card>
          <Card className="p-4 flex flex-col justify-between border-l-amber-500 border-l-2">
            <span className="text-xs text-muted-foreground font-medium uppercase">Suspended Accounts</span>
            <span className="text-2xl font-bold mt-2 text-amber-600">{suspendedCount}</span>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:max-w-xs flex items-center h-10 px-3 rounded-lg border bg-background">
            <Search className="size-4 text-muted-foreground mr-2 shrink-0" />
            <input
              className="bg-transparent flex-1 text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Search workspaces or owner..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5 w-full sm:w-auto">
            {["all", "active", "trial", "suspended"].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={cn(
                  "px-3 py-1.5 rounded-lg border text-xs font-semibold uppercase tracking-wider transition",
                  filterStatus === s 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-card hover:bg-muted text-muted-foreground"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Signups list */}
        <Card className="overflow-hidden border">
          {loading ? (
            <div className="py-20 text-center text-muted-foreground text-sm">Fetching registrants list...</div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground text-sm">No registered workspaces found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground font-semibold uppercase">
                    <th className="px-6 py-4">Workspace / Slug</th>
                    <th className="px-6 py-4">Owner Info</th>
                    <th className="px-6 py-4">Plan / Users</th>
                    <th className="px-6 py-4">Registered On</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((t) => {
                    const isSuspended = t.status === "suspended";
                    const isCurrentTenant = t.slug === "system";
                    return (
                      <tr key={t.id} className="hover:bg-muted/10 transition">
                        <td className="px-6 py-4">
                          <div className="font-bold text-foreground">{t.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">slug: {t.slug}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-foreground">{t.owner_name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{t.owner_email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="capitalize font-medium text-foreground">{t.plan}</div>
                          <div className="text-xs text-muted-foreground">{t.user_count} registered users</div>
                        </td>
                        <td className="px-6 py-4 text-xs text-muted-foreground font-mono">
                          {new Date(t.created_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={cn(
                              "text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider",
                              t.status === "active" && "bg-emerald-500/10 text-emerald-600",
                              t.status === "trial" && "bg-blue-500/10 text-blue-600",
                              t.status === "suspended" && "bg-amber-500/10 text-amber-600",
                              t.status === "cancelled" && "bg-red-500/10 text-red-600"
                            )}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {!isCurrentTenant && (
                            <Button
                              variant="outline"
                              size="sm"

                              disabled={updatingId === t.id}
                              onClick={() => toggleTenantStatus(t.id, t.status)}
                              className={cn(
                                "h-8 gap-1 px-3 text-xs font-semibold",
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
      </div>
    );
  }

  // ─── Normal Tenant / Customer Invoice & Billing View ───────────────
  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Subscription & Licenses</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage your BusinessOS Enterprise plan, modules, and billing.</p>
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
