import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Boxes,
  CheckCircle2,
  Cpu,
  Database,
  ExternalLink,
  FileClock,
  HardDrive,
  KeyRound,
  Layers,
  Network,
  Plus,
  RefreshCw,
  ScrollText,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  platformService,
  type AuditEntry,
  type FleetHealthReport,
  type PermissionCatalogueItem,
  type PlatformAdminRecord,
  type TenantRosterItem,
} from "@/services/platformService";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/platform/")({
  head: () => ({
    meta: [
      { title: "Fleet Telemetry & Overview — Platform Super Admin" },
      { name: "description", content: "Real-time microservices fleet health and system telemetry." },
    ],
  }),
  component: PlatformDashboardPage,
});

function PlatformDashboardPage() {
  const [fleet, setFleet] = useState<FleetHealthReport | null>(null);
  const [rosterTotal, setRosterTotal] = useState<number | null>(null);
  const [roster, setRoster] = useState<TenantRosterItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionCatalogueItem[]>([]);
  const [admins, setAdmins] = useState<PlatformAdminRecord[]>([]);
  const [recentAudit, setRecentAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [fleetData, rosterData, permData, adminData, auditData] = await Promise.all([
        platformService.getFleetHealth(),
        platformService.listAllTenants({ limit: 5 }),
        platformService.getPermissions(),
        platformService.getAdmins(),
        platformService.getAudit({ limit: 8 }),
      ]);
      setFleet(fleetData);
      setRosterTotal(rosterData.total);
      setRoster(rosterData.items);
      setPermissions(permData);
      setAdmins(adminData.items);
      setRecentAudit(auditData.items);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load telemetry";
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading && !fleet) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500 font-mono text-xs">
        Loading Fleet Telemetry Mesh...
      </div>
    );
  }

  const report: FleetHealthReport = fleet || {
    overall_status: "down",
    services_up: 0,
    services_total: 14,
    services: [],
    checked_at: new Date().toISOString(),
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Server className="size-6 text-indigo-600" />
            Platform Telemetry & Fleet Mesh
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time status of 14 isolated microservices, schema health, and cross-vertical tenants.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={refreshing}
            className="border-slate-200 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs h-8 shadow-xs"
          >
            <RefreshCw className={cn("size-3.5 mr-1.5", refreshing && "animate-spin")} />
            Probe Mesh
          </Button>

          <Link to="/platform/tenants">
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 shadow-xs">
              <Plus className="size-3.5 mr-1.5" />
              Onboard Tenant
            </Button>
          </Link>
        </div>
      </div>

      {/* Top 6 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Mesh State</span>
            <span className={cn("size-2 rounded-full shadow-xs",
              report.overall_status === "ok" ? "bg-emerald-500 animate-pulse shadow-emerald-500/50" : "bg-rose-500 shadow-rose-500/50")} />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {report.services_up} / {report.services_total}
            </div>
            <Badge className={cn("text-[10px] font-mono",
              report.overall_status === "ok"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-rose-50 text-rose-700 border-rose-200")}>
              {report.overall_status.toUpperCase()}
            </Badge>
          </div>
          <p className="text-[11px] text-slate-500">All registered microservices responding</p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Tenants</span>
            <Users className="size-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {rosterTotal === null ? "—" : rosterTotal.toLocaleString()}
            </div>
            <Badge variant="outline" className="border-indigo-200 text-indigo-700 bg-indigo-50 text-[10px]">
              Full Roster
            </Badge>
          </div>
          <p className="text-[11px] text-slate-500">
            {roster.filter((t) => t.is_managed).length > 0
              ? `${roster.filter((t) => t.is_managed).length} of first page under module management`
              : "Isolated database schemas per tenant"}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Control-Plane Admins</span>
            <ShieldCheck className="size-4 text-sky-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {admins.length === 0 ? "—" : admins.length}
            </div>
            <Badge variant="outline" className="border-sky-200 text-sky-700 bg-sky-50 text-[10px]">
              {admins.filter((a) => a.is_active).length} active
            </Badge>
          </div>
          <p className="text-[11px] text-slate-500">Platform realm account holders</p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Permission Registry</span>
            <KeyRound className="size-4 text-amber-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {permissions.length === 0 ? "—" : permissions.length}
            </div>
            <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50 text-[10px]">
              Granular RBAC
            </Badge>
          </div>
          <p className="text-[11px] text-slate-500">Fine-grained permission keys enforced at gateway</p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Plug-and-Play Verticals</span>
            <Boxes className="size-4 text-violet-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold text-slate-900 font-mono">6 Verticals</div>
            <Badge variant="outline" className="border-violet-200 text-violet-700 bg-violet-50 text-[10px]">
              Dynamic
            </Badge>
          </div>
          <p className="text-[11px] text-slate-500">Restaurant, Salon, Gym, Retail, Clinic, Auto</p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Audit Activity</span>
            <FileClock className="size-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {recentAudit.length}
            </div>
            <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50 text-[10px]">
              Recent
            </Badge>
          </div>
          <p className="text-[11px] text-slate-500">Control-plane actions captured in the immutable log</p>
        </div>
      </div>

      {/* 14 Microservices Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="size-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-slate-900">Microservice Infrastructure Grid</h2>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Last inspected: {new Date(report.checked_at).toLocaleTimeString()}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {report.services.map((svc) => (
            <div
              key={svc.service}
              className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 transition-colors flex items-center justify-between shadow-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "size-2 rounded-full",
                    svc.status === "up" ? "bg-emerald-500" : "bg-rose-500"
                  )} />
                  <span className="font-semibold text-xs text-slate-900 uppercase tracking-wider font-mono">
                    {svc.service}
                  </span>
                  <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-600 text-[10px] font-mono px-1 py-0">
                    :{svc.port}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Database className="size-3 text-slate-400" />
                    <code className="text-slate-700 font-mono text-[10px]">restaurantos_{svc.service}</code>
                  </span>
                </div>
              </div>

              <div className="text-right space-y-1">
                <Badge
                  className={cn(
                    "text-[10px] font-mono",
                    svc.status === "up"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-rose-50 text-rose-700 border-rose-200"
                  )}
                >
                  {svc.status.toUpperCase()}
                </Badge>
                {svc.latency_ms !== null && (
                  <p className="text-[10px] font-mono text-slate-500">
                    {svc.latency_ms} ms
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Management Domains — quick navigation to every control-plane page */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ScrollText className="size-4 text-emerald-600" />
          <h2 className="text-sm font-semibold text-slate-900">Control-Plane Management Domains</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Link to="/platform/tenants">
            <div className="p-4 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 transition-colors flex items-center gap-3 shadow-xs">
              <Users className="size-4 text-indigo-600" />
              <div>
                <div className="text-xs font-semibold text-slate-900">Tenant Roster & Onboarding</div>
                <div className="text-[10px] text-slate-500">Provision, page & filter {rosterTotal === null ? "…" : `${rosterTotal.toLocaleString()}`} tenants</div>
              </div>
            </div>
          </Link>
          <Link to="/platform/modules">
            <div className="p-4 rounded-xl bg-white border border-slate-200 hover:border-violet-300 transition-colors flex items-center gap-3 shadow-xs">
              <Boxes className="size-4 text-violet-600" />
              <div>
                <div className="text-xs font-semibold text-slate-900">Module Lifecycle</div>
                <div className="text-[10px] text-slate-500">Per-tenant on/off, kill-switches</div>
              </div>
            </div>
          </Link>
          <Link to="/platform/permissions">
            <div className="p-4 rounded-xl bg-white border border-slate-200 hover:border-amber-300 transition-colors flex items-center gap-3 shadow-xs">
              <KeyRound className="size-4 text-amber-600" />
              <div>
                <div className="text-xs font-semibold text-slate-900">RBAC & ABAC Policies</div>
                <div className="text-[10px] text-slate-500">Permission matrix, allow/deny rules</div>
              </div>
            </div>
          </Link>
          <Link to="/platform/admins">
            <div className="p-4 rounded-xl bg-white border border-slate-200 hover:border-sky-300 transition-colors flex items-center gap-3 shadow-xs">
              <ShieldCheck className="size-4 text-sky-600" />
              <div>
                <div className="text-xs font-semibold text-slate-900">Admin Users</div>
                <div className="text-[10px] text-slate-500">Control-plane accounts, roles, kill-switch</div>
              </div>
            </div>
          </Link>
          <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center gap-3 shadow-xs">
            <FileClock className="size-4 text-emerald-600" />
            <div>
              <div className="text-xs font-semibold text-slate-900">Audit Trail</div>
              <div className="text-[10px] text-slate-500">Immutable log, filterable & exportable</div>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center gap-3 shadow-xs">
            <Activity className="size-4 text-rose-600" />
            <div>
              <div className="text-xs font-semibold text-slate-900">Fleet Telemetry</div>
              <div className="text-[10px] text-slate-500">Live status of every microservice (this page)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Control-Plane Activity */}
      {recentAudit.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileClock className="size-4 text-emerald-600" />
              <h2 className="text-sm font-semibold text-slate-900">Recent Control-Plane Activity</h2>
            </div>
            <Link to="/platform/audit">
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1.5 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50">
                View full audit log <ExternalLink className="size-3" />
              </Button>
            </Link>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs divide-y divide-slate-100">
            {recentAudit.map((entry) => (
              <div key={entry.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className="text-[10px] font-mono border-emerald-200 bg-emerald-50 text-emerald-700 shrink-0">
                    {entry.action}
                  </Badge>
                  <span className="text-[11px] text-slate-600 truncate">
                    {entry.target_type} <code className="font-mono text-slate-400">{entry.target_id}</code>
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                  {entry.admin_email} • {new Date(entry.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Row: Quick Navigation & Telemetry Architecture */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Network className="size-4 text-indigo-600" />
              Gateway Cross-Service Routing Architecture
            </h3>
            <Badge variant="outline" className="border-indigo-200 text-indigo-700 bg-indigo-50 text-[10px]">
              Port :8000
            </Badge>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs text-slate-700 space-y-2">
            <div className="flex items-center justify-between text-slate-500 text-[11px]">
              <span>Inbound Public Path</span>
              <span>Forwarded Upstream Service</span>
            </div>
            <div className="h-px bg-slate-200" />
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-indigo-600 font-medium">/api/v1/auth/*</span>
              <span className="text-slate-600">→ http://localhost:8100/api/v1/auth/*</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-indigo-600 font-medium">/api/v1/platform/*</span>
              <span className="text-slate-600">→ http://localhost:8113/api/v1/platform/*</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-indigo-600 font-medium">/api/v1/organization/*</span>
              <span className="text-slate-600">→ http://localhost:8102/api/v1/organization/*</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-indigo-600 font-medium">/api/v1/pos/*</span>
              <span className="text-slate-600">→ http://localhost:8103/api/v1/pos/*</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-indigo-600 font-medium">/api/v1/menu/*</span>
              <span className="text-slate-600">→ http://localhost:8104/api/v1/menu/*</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-indigo-600 font-medium">/api/v1/inventory/*</span>
              <span className="text-slate-600">→ http://localhost:8106/api/v1/inventory/*</span>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            All microservices authenticate edge identity headers (<code className="text-slate-800 bg-slate-200/60 px-1 py-0.5 rounded font-mono">X-Identity-User-Id</code>, <code className="text-slate-800 bg-slate-200/60 px-1 py-0.5 rounded font-mono">X-Identity-Permissions</code>). Direct cross-service database access is strictly disallowed by isolated schema boundaries.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4 flex flex-col justify-between shadow-xs">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Boxes className="size-4 text-violet-600" />
              Dynamic Tenant Provisioning
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              When a new enterprise tenant signs up, the Platform Control Plane creates their auth profile, generates their branch outlet, and provisions isolated vertical plugins with lifecycle state tracking.
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <Link to="/platform/tenants" className="block">
              <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 justify-between shadow-xs">
                <span>Manage All Tenants</span>
                <ExternalLink className="size-3.5" />
              </Button>
            </Link>
            <Link to="/platform/modules" className="block">
              <Button variant="outline" className="w-full border-slate-200 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs h-9 justify-between shadow-xs">
                <span>Review Plugin Catalog</span>
                <Boxes className="size-3.5 text-violet-600" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
