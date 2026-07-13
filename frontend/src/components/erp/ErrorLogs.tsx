import { useState, useEffect, useCallback } from "react";
import { errorLogsApi } from "../../lib/api-client";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { AlertTriangle, RefreshCw, Loader2, ChevronLeft, ChevronRight, Filter } from "lucide-react";

const MODULES = ["erp", "hrms", "auth", "system"];

export function ErrorLogs() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [moduleFilter, setModuleFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await errorLogsApi.list(page, 20, moduleFilter || undefined);
      setItems(res.items as Record<string, unknown>[]); setTotal(res.total);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to load error logs"); }
    finally { setLoading(false); }
  }, [page, moduleFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Error Logs</h2>
          <p className="text-sm text-muted-foreground">
            Failed operations and system errors.
            <span className="font-medium text-red-500 ml-1">{total} errors found</span>
          </p>
        </div>
        <Button variant="outline" className="bg-background" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <RefreshCw className="size-4 mr-2" />}
          Refresh
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Filter className="size-4 text-muted-foreground" />
        <select value={moduleFilter} onChange={e => { setModuleFilter(e.target.value); setPage(1); }}
          className="h-10 px-3 text-sm rounded-lg border bg-card">
          <option value="">All Modules</option>
          {MODULES.map(m => <option key={m}>{m}</option>)}
        </select>
      </div>

      {loading && !items.length && <div className="flex items-center justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>}
      {error && <div className="p-4 rounded-xl bg-red-500/10 text-red-600 text-sm border border-red-500/20">{error}</div>}

      <Card className="overflow-hidden">
        {items.length === 0 && !loading ? (
          <div className="text-center py-16 text-muted-foreground">
            <AlertTriangle className="size-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No errors found</p>
            <p className="text-sm">All operations are completing successfully.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
                <tr>
                  <th className="px-5 py-4 text-left">Time</th>
                  <th className="px-5 py-4 text-left">Module</th>
                  <th className="px-5 py-4 text-left">Action</th>
                  <th className="px-5 py-4 text-left">Entity</th>
                  <th className="px-5 py-4 text-left">IP Address</th>
                  <th className="px-5 py-4 text-left">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((log, i) => (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap">
                      {log.created_at ? new Date(log.created_at as string).toLocaleString() : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-600 uppercase">
                        {log.module as string}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-medium">{log.action as string}</td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">{log.entity_type as string || "—"}</td>
                    <td className="px-5 py-4 font-mono text-xs">{log.ip_address as string || "—"}</td>
                    <td className="px-5 py-4">
                      {log.error_details ? (
                        <span className="text-xs text-muted-foreground truncate block max-w-48" title={JSON.stringify(log.error_details)}>
                          {JSON.stringify(log.error_details).slice(0, 60)}...
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {total > 20 && (
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">Showing {items.length} of {total} errors</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm text-muted-foreground self-center">Page {page}</span>
            <Button variant="outline" size="sm" disabled={items.length < 20} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
