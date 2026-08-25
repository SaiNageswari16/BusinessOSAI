import { useState, useEffect, useCallback } from "react";
import { auditLogsApi, AuditLog } from "../../lib/api-client";
import { Activity, Search, Loader2, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { useCurrency } from "@/hooks/use-currency";

export function ActivityLogs() {
    const { currency, formatCurrency } = useCurrency();
  const [items, setItems] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await auditLogsApi.list(page, 50);
      setItems(res.items);
      setTotal(res.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load activity logs");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = items.filter(log => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      log.module.toLowerCase().includes(term) ||
      log.action.toLowerCase().includes(term) ||
      (log.entity_type && log.entity_type.toLowerCase().includes(term)) ||
      (log.user_name && log.user_name.toLowerCase().includes(term)) ||
      (log.user_email && log.user_email.toLowerCase().includes(term))
    );
  });

  const getInitials = (name?: string | null) => {
    if (!name) return "SY";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  const formatAction = (log: AuditLog) => {
    const entity = log.entity_type ? log.entity_type.replace(/_/g, " ") : "";
    return (
      <span className="text-xs text-muted-foreground">
        Performed <strong className="text-foreground capitalize">{log.action}</strong> on{" "}
        <span className="font-semibold text-primary capitalize">{entity || log.module}</span>
        {log.new_values && (
          <span className="block mt-1 font-mono text-[10px] bg-muted/50 p-1.5 rounded border overflow-x-auto max-w-full">
            {JSON.stringify(log.new_values)}
          </span>
        )}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
            <Activity className="size-5 text-primary animate-pulse" /> Activity Feed
          </h2>
          <p className="text-muted-foreground text-xs mt-0.5">
            Real-time pulse of business operations and user actions. <span className="font-medium text-primary">{total} actions</span>
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs font-semibold" onClick={load} disabled={loading}>
          Refresh Feed
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-4 text-sm rounded-lg border bg-card focus:ring-2 focus:ring-primary/20"
          placeholder="Filter activity feed by module, action, or user..."
        />
      </div>

      {loading && items.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      )}

      {error && <div className="p-4 rounded-xl bg-red-500/10 text-red-600 text-sm border border-red-500/20">{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Activity className="size-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No activity log found</p>
          <p className="text-sm">Perform actions in other tabs to generate activity logs.</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="relative pl-6 border-l border-border/50 space-y-6 py-2">
          {filtered.map(log => (
            <div key={log.id} className="relative group">
              <div className="absolute -left-[35px] top-1 p-0.5 bg-background transition-transform group-hover:scale-110">
                <Avatar className="size-6 border shadow-sm">
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                    {getInitials(log.user_name)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <Card className="p-4 shadow-sm hover:shadow-md transition-all duration-200 border bg-card hover:border-primary/20">
                <div className="flex justify-between items-start mb-1 gap-4">
                  <div>
                    <span className="text-sm font-semibold text-foreground">{log.user_name || "System"}</span>
                    {log.user_email && (
                      <span className="text-[10px] text-muted-foreground ml-2">({log.user_email})</span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1">{formatAction(log)}</div>
                <div className="flex gap-2 items-center mt-2 text-[10px] text-muted-foreground">
                  <span className="px-1.5 py-0.5 rounded bg-muted font-semibold uppercase">{log.module}</span>
                  {log.ip_address && <span>IP: {log.ip_address}</span>}
                  <span className={`size-1.5 rounded-full ${log.status === "success" ? "bg-emerald-500" : "bg-red-500"}`} />
                  <span className="capitalize">{log.status}</span>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}

      {total > 50 && (
        <div className="flex justify-center gap-2 pt-4">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <span className="text-sm text-muted-foreground self-center">Page {page}</span>
          <Button variant="outline" size="sm" disabled={items.length < 50} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
