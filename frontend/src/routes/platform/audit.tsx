import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Download,
  FileClock,
  RefreshCw,
  Search,
} from "lucide-react";
import { platformService, type AuditEntry } from "@/services/platformService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/platform/audit")({
  head: () => ({
    meta: [
      { title: "Control-Plane Audit Trail — Platform Super Admin" },
      {
        name: "description",
        content: "Immutable audit log of every platform admin action: module lifecycles, policies, admin accounts.",
      },
    ],
  }),
  component: PlatformAuditPage,
});

const ACTION_GROUPS: Record<string, { label: string; color: string }> = {
  "module.activated": { label: "Module Activated", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  "module.suspended": { label: "Module Suspended", color: "bg-amber-50 text-amber-700 border-amber-200" },
  "module.archived": { label: "Module Archived", color: "bg-slate-100 text-slate-600 border-slate-200" },
  "plugin.kill_switch.toggle": { label: "Global Kill-Switch", color: "bg-rose-50 text-rose-700 border-rose-200" },
  "permission.created": { label: "Permission Registered", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  "policy.created": { label: "Policy Created", color: "bg-violet-50 text-violet-700 border-violet-200" },
  "policy.deleted": { label: "Policy Retired", color: "bg-slate-100 text-slate-600 border-slate-200" },
  "admin.created": { label: "Admin Provisioned", color: "bg-sky-50 text-sky-700 border-sky-200" },
  "admin.updated": { label: "Admin Updated", color: "bg-sky-50 text-sky-700 border-sky-200" },
  "tenant.onboarded": { label: "Tenant Onboarded", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

function actionLabel(action: string) {
  return ACTION_GROUPS[action]?.label ?? action.replace(/\./g, " ");
}

function actionColor(action: string) {
  return ACTION_GROUPS[action]?.color ?? "bg-slate-100 text-slate-600 border-slate-200";
}

function PlatformAuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("all");
  const [adminFilter, setAdminFilter] = useState("");
  const [search, setSearch] = useState("");

  const PAGE_SIZE = 50;

  const fetchPage = useCallback(async (nextOffset: number, keep: boolean) => {
    try {
      setLoading(true);
      const res = await platformService.getAudit({
        limit: PAGE_SIZE,
        offset: nextOffset,
        action: actionFilter === "all" ? undefined : actionFilter,
        admin_email: adminFilter || undefined,
      });
      setEntries(keep ? [...entries, ...res.items] : res.items);
      setTotal(res.total);
      setOffset(nextOffset);
      setHasMore(res.has_more);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load audit log";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, adminFilter, entries]);

  useEffect(() => {
    fetchPage(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter]);

  const visible = entries.filter((e) => {
    if (!search) return true;
    const haystack = `${e.admin_email} ${e.target_type} ${e.target_id} ${JSON.stringify(e.details)}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const exportCsv = () => {
    const header = "created_at,admin_email,action,target_type,target_id,ip_address,details";
    const rows = entries.map((e) =>
      [
        e.created_at,
        e.admin_email,
        e.action,
        e.target_type,
        e.target_id,
        e.ip_address ?? "",
        JSON.stringify(e.details),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `platform-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <FileClock className="size-6 text-emerald-600" />
            Control-Plane Audit Trail
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Immutable log of every platform admin action — module lifecycle, policies, and admin accounts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs h-8 shadow-xs"
          >
            <Download className="size-3.5 mr-1.5" />
            Export Page (CSV)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchPage(0, false)}
            disabled={loading}
            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs h-8 shadow-xs"
          >
            <RefreshCw className={cn("size-3.5 mr-1.5", loading && "animate-spin")} />
            Reload
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search admin, target, or details..."
            className="pl-9 bg-white border-slate-200 text-xs h-9 text-slate-900 placeholder:text-slate-400 shadow-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={adminFilter}
            onChange={(e) => setAdminFilter(e.target.value)}
            placeholder="Filter by admin email"
            className="w-[200px] bg-white border-slate-200 text-xs h-9 text-slate-900 shadow-xs"
          />
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[190px] bg-white border-slate-200 text-xs h-9 text-slate-700 shadow-xs">
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent className="bg-white border-slate-200 text-slate-900 shadow-md">
              <SelectItem value="all">All Actions</SelectItem>
              {Object.entries(ACTION_GROUPS).map(([action, group]) => (
                <SelectItem key={action} value={action}>
                  {group.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Log */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
            {visible.length} entries shown • {total} total
          </span>
          <span className="text-[11px] text-slate-500">Newest first</span>
        </div>

        <div className="divide-y divide-slate-100">
          {visible.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-500">
              No audit entries match the current filters.
            </div>
          ) : (
            visible.map((entry) => (
              <div key={entry.id} className="px-4 py-3 hover:bg-slate-50/60 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className={cn("text-[10px] font-mono shrink-0", actionColor(entry.action))}>
                      {actionLabel(entry.action)}
                    </Badge>
                    <span className="text-[11px] font-medium text-slate-800 truncate">{entry.target_type}</span>
                    <code className="text-[10px] font-mono text-slate-500 truncate">{entry.target_id}</code>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="text-[11px] text-slate-600">
                    <span className="text-slate-400">by</span> {entry.admin_email}
                  </span>
                  <details className="shrink-0">
                    <summary className="text-[10px] font-mono text-indigo-600 cursor-pointer list-none hover:text-indigo-800">
                      details
                    </summary>
                    <pre className="mt-1 max-w-lg overflow-x-auto rounded-lg bg-slate-900 text-slate-100 p-2.5 text-[10px] font-mono">
                      {JSON.stringify(entry.details, null, 2)}
                    </pre>
                  </details>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Load more / pagination footer */}
        {hasMore && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchPage(offset + PAGE_SIZE, true)}
              disabled={loading}
              className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs h-8 shadow-xs"
            >
              {loading ? "Loading..." : `Load More (next ${PAGE_SIZE})`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
