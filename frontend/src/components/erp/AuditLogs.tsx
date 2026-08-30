import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Search, Filter, History, Download, ArrowRight, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { auditLogsApi, type AuditLog } from "@/lib/api-client";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

const ACTION_COLORS: Record<string, string> = {
  created: "bg-emerald-500/10 text-emerald-600",
  updated: "bg-blue-500/10 text-blue-600",
  deleted: "bg-red-500/10 text-red-600",
  login: "bg-purple-500/10 text-purple-600",
  logout: "bg-gray-500/10 text-gray-600",
  "password-reset": "bg-amber-500/10 text-amber-600",
};

const MODULE_OPTIONS = ["", "auth", "erp", "hrms", "inventory", "accounting", "crm"];
const ACTION_OPTIONS = ["", "created", "updated", "deleted", "login", "logout"];

function formatDate(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
  };
}

export function AuditLogs() {
    const { currency, formatCurrency } = useCurrency();
  const { user, accessToken } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const PAGE_SIZE = 25;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const isPlatformAdmin = user?.tenantSlug === "system" && user?.isTenantOwner;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isPlatformAdmin && accessToken) {
        // Cross-tenant administrative log view for platform owner
        const res = await fetch(`${API_BASE_URL}/system/audit-logs`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error("Failed to load platform audit trail");
        const data = await res.json();
        
        const mappedLogs = data.map((l: any) => ({
          id: l.id,
          tenant_id: "",
          user_id: l.user_email || l.user_name || "System",
          module: l.module,
          action: l.action,
          entity_type: `Tenant: ${l.tenant_name}`,
          entity_id: null,
          old_values: null,
          new_values: null,
          ip_address: l.ip_address,
          user_agent: null,
          status: "success",
          created_at: l.created_at,
        }));
        
        setLogs(mappedLogs);
        setTotal(mappedLogs.length);
      } else {
        // Scoped tenant log view for standard buyers
        const res = await auditLogsApi.list(page, PAGE_SIZE, {
          module: moduleFilter || undefined,
          action: actionFilter || undefined,
        });
        setLogs(res.items);
        setTotal(res.total);
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [page, moduleFilter, actionFilter, isPlatformAdmin, accessToken]);

  useEffect(() => { void load(); }, [load]);

  const filtered = search
    ? logs.filter((l) =>
        (l.user_id ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (l.module ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (l.entity_type ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (l.ip_address ?? "").includes(search),
      )
    : logs;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
            <History className="size-5 text-primary" /> {isPlatformAdmin ? "SaaS Platform Audit Trail" : "System Audit Logs"}
          </h2>
          <p className="text-muted-foreground text-xs mt-0.5">
            {isPlatformAdmin 
              ? "Cross-tenant tracking of system modifications across all client environments." 
              : "Enterprise-grade tracking of system modifications."}
            {" "}<span className="text-primary font-semibold">{total.toLocaleString()} total records</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-semibold" onClick={load} disabled={loading}>
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} /> Refresh
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-semibold">
            <Download className="size-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-60 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 text-sm rounded-lg border bg-card focus:ring-2 focus:ring-primary/20 outline-none"
            placeholder="Search by user, email, module, tenant, IP..." />
        </div>
        {!isPlatformAdmin && (
          <Button variant="outline" className="h-10 gap-2" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="size-4" /> Filters {(moduleFilter || actionFilter) && <span className="size-2 rounded-full bg-primary" />}
          </Button>
        )}
        {(moduleFilter || actionFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setModuleFilter(""); setActionFilter(""); setPage(1); }}>
            Clear filters
          </Button>
        )}
      </div>

      {showFilters && !isPlatformAdmin && (
        <div className="flex flex-wrap gap-4 p-4 bg-muted/30 rounded-xl border">
          <div>
            <label className="block text-xs font-semibold mb-1.5">Module</label>
            <select value={moduleFilter} onChange={(e) => { setModuleFilter(e.target.value); setPage(1); }}
              className="h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20 min-w-36">
              {MODULE_OPTIONS.map((m) => <option key={m} value={m}>{m || "All Modules"}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5">Action</label>
            <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              className="h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20 min-w-36">
              {ACTION_OPTIONS.map((a) => <option key={a} value={a}>{a || "All Actions"}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-3 text-left font-semibold text-muted-foreground text-xs">Timestamp</th>
              <th className="px-6 py-3 text-left font-semibold text-muted-foreground text-xs">User / Email & IP</th>
              <th className="px-6 py-3 text-left font-semibold text-muted-foreground text-xs">Module</th>
              <th className="px-6 py-3 text-left font-semibold text-muted-foreground text-xs">Action & Context</th>
              <th className="px-6 py-3 text-left font-semibold text-muted-foreground text-xs">Changes</th>
              <th className="px-6 py-3 text-right font-semibold text-muted-foreground text-xs">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={6} className="px-6 py-4">
                    <div className="h-4 bg-muted/50 rounded" />
                  </td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center text-muted-foreground">
                  <History className="size-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No audit logs found</p>
                </td>
              </tr>
            ) : (
              filtered.map((log) => {
                const { date, time } = formatDate(log.created_at);
                const actionColor = ACTION_COLORS[log.action] ?? "bg-muted text-muted-foreground";
                const hasChanges = log.old_values || log.new_values;
                const isEmail = log.user_id && log.user_id.includes("@");
                return (
                  <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-mono text-xs">{date}</div>
                      <div className="text-[10px] text-muted-foreground">{time}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-xs text-foreground font-mono truncate max-w-[200px]" title={log.user_id || "System"}>
                        {isEmail ? log.user_id : (log.user_id && log.user_id !== "System" ? log.user_id.slice(0, 8) + "..." : "System")}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {log.ip_address ?? "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground capitalize">
                        {log.module}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold capitalize", actionColor)}>
                          {log.action}
                        </span>
                        {log.entity_type && (
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded font-medium",
                            log.entity_type.startsWith("Tenant:") 
                              ? "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 font-bold" 
                              : "text-muted-foreground"
                          )}>
                            {log.entity_type}
                          </span>
                        )}
                      </div>
                      {log.entity_id && (
                        <div className="text-[10px] font-mono text-muted-foreground">{log.entity_id.slice(0, 8)}…</div>
                      )}
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      {hasChanges && (
                        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground bg-muted/50 p-1.5 rounded-md inline-flex max-w-full overflow-hidden">
                          {log.old_values && (
                            <span className="text-rose-500 truncate max-w-20">
                              {Object.keys(log.old_values).slice(0, 2).join(", ")}
                            </span>
                          )}
                          {log.old_values && log.new_values && <ArrowRight className="size-3 shrink-0" />}
                          {log.new_values && (
                            <span className="text-emerald-500 truncate max-w-20">
                              {Object.keys(log.new_values).slice(0, 2).join(", ")}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium",
                        log.status === "success" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600",
                      )}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && !isPlatformAdmin && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages} — {total.toLocaleString()} total
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="size-4" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = page <= 3 ? i + 1 : page - 2 + i;
              if (pageNum > totalPages) return null;
              return (
                <Button key={pageNum} variant={page === pageNum ? "default" : "outline"} size="sm"
                  className="min-w-[36px]" onClick={() => setPage(pageNum)}>
                  {pageNum}
                </Button>
              );
            })}
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
