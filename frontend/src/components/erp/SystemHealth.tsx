import { useState, useEffect, useCallback } from "react";
import { systemHealthApi, SystemHealth } from "../../lib/api-client";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Activity, Cpu, HardDrive, Network, Server, Database, BrainCircuit, RefreshCw, Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

export function SystemHealth() {
    const { currency, formatCurrency } = useCurrency();
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await systemHealthApi.get();
      setHealth(data);
      setLastRefreshed(new Date());
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to load health data"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const STATUS_COLOR = (s: string) => s === "online" || s === "healthy" ? "emerald" : s === "degraded" ? "amber" : "red";
  const STATUS_BADGE = (s: string) => {
    const c = STATUS_COLOR(s);
    return `bg-${c}-500/10 text-${c}-500 border-${c}-500/20`;
  };
  const STATUS_DOT = (s: string) => s === "online" || s === "healthy" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" : s === "degraded" ? "bg-amber-500" : "bg-red-500";

  const overallStatus = health?.status ?? "unknown";
  const dbStatus = health?.database?.status ?? "unknown";

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">System Health</h2>
          <p className="text-sm text-muted-foreground">
            Real-time infrastructure and application monitoring.
            {lastRefreshed && <span className="ml-1 text-xs">Last updated: {lastRefreshed.toLocaleTimeString()}</span>}
          </p>
        </div>
        <Button variant="outline" className="bg-background" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <RefreshCw className="size-4 mr-2" />}
          Refresh Status
        </Button>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-500/10 text-red-600 text-sm border border-red-500/20 flex items-center gap-2"><AlertCircle className="size-4" />{error}</div>}

      {loading && !health && <div className="flex items-center justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>}

      {health && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className={`p-6 border-t-4 ${overallStatus === "healthy" ? "border-t-emerald-500" : "border-t-amber-500"}`}>
              <div className="flex justify-between items-start mb-4">
                <div className={`size-10 rounded-lg ${overallStatus === "healthy" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"} grid place-items-center`}>
                  <Server className="size-5" />
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded ${overallStatus === "healthy" ? "text-emerald-500 bg-emerald-500/10" : "text-amber-500 bg-amber-500/10"}`}>
                  {overallStatus.toUpperCase()}
                </span>
              </div>
              <h3 className="text-3xl font-bold font-mono tracking-tight text-foreground">
                {overallStatus === "healthy" ? "99.99%" : "~98%"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">Platform Status</p>
            </Card>

            <Card className={`p-6 border-t-4 ${dbStatus === "online" ? "border-t-blue-500" : "border-t-red-500"}`}>
              <div className="flex justify-between items-start mb-4">
                <div className={`size-10 rounded-lg ${dbStatus === "online" ? "bg-blue-500/10 text-blue-500" : "bg-red-500/10 text-red-500"} grid place-items-center`}>
                  <Database className="size-5" />
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded ${dbStatus === "online" ? "text-blue-500 bg-blue-500/10" : "text-red-500 bg-red-500/10"}`}>
                  {dbStatus.toUpperCase()}
                </span>
              </div>
              <h3 className="text-3xl font-bold font-mono tracking-tight text-foreground">
                {health.database.latency_ms}ms
              </h3>
              <p className="text-sm text-muted-foreground mt-1">DB Response Latency</p>
            </Card>

            <Card className="p-6 border-t-4 border-t-primary">
              <div className="flex justify-between items-start mb-4">
                <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <Activity className="size-5" />
                </div>
                <span className="text-primary text-xs font-bold bg-primary/10 px-2 py-1 rounded">LIVE</span>
              </div>
              <h3 className="text-3xl font-bold font-mono tracking-tight text-foreground">
                {health.tenant.total_audit_logs.toLocaleString()}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">Total Audit Logs</p>
            </Card>

            <Card className="p-6 border-t-4 border-t-purple-500">
              <div className="flex justify-between items-start mb-4">
                <div className="size-10 rounded-lg bg-purple-500/10 text-purple-500 grid place-items-center">
                  <BrainCircuit className="size-5" />
                </div>
                <span className="text-purple-500 text-xs font-bold bg-purple-500/10 px-2 py-1 rounded">RUNTIME</span>
              </div>
              <h3 className="text-3xl font-bold font-mono tracking-tight text-foreground">
                {health.python_version}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">Python Runtime</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Database className="size-5 text-primary" /> Service Status
              </h3>
              <div className="space-y-3">
                {health.services.map((svc, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-muted/40 rounded-lg">
                    <div className="font-medium text-sm">{svc.name}</div>
                    <div className="flex items-center gap-3">
                      {svc.latency_ms !== null && (
                        <span className="text-xs text-muted-foreground">{svc.latency_ms}ms</span>
                      )}
                      <div className="flex items-center gap-1.5">
                        {svc.status === "online" ? (
                          <CheckCircle className="size-4 text-emerald-500" />
                        ) : (
                          <XCircle className="size-4 text-red-500" />
                        )}
                        <span className={`text-xs font-bold ${svc.status === "online" ? "text-emerald-600" : "text-red-600"}`}>
                          {svc.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Network className="size-5 text-primary" /> Tenant Information
              </h3>
              <div className="space-y-3">
                {[
                  { label: "Tenant ID", value: health.tenant.id.slice(0, 12) + "...", mono: true },
                  { label: "API Status", value: "Operational", status: "online" },
                  { label: "Audit Log Entries", value: health.tenant.total_audit_logs.toLocaleString(), mono: false },
                  { label: "Last Health Check", value: new Date(health.timestamp).toLocaleTimeString(), mono: false },
                ].map((row, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-muted/40 rounded-lg">
                    <div className="font-medium text-sm">{row.label}</div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${row.mono ? "font-mono" : ""} text-muted-foreground`}>{row.value}</span>
                      {"status" in row && (
                        <span className={`size-2 rounded-full ${STATUS_DOT(row.status ?? "")}`} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
