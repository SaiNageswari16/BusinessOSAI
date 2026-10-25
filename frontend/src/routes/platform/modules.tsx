import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Database,
  Layers,
  PauseCircle,
  PlayCircle,
  Power,
  RefreshCw,
  Scissors,
  Shield,
  ShoppingBag,
  Sparkles,
  StopCircle,
  UtensilsCrossed,
} from "lucide-react";
import {
  platformService,
  type PluginManifest,
  type TenantSummary,
  type TenantModuleState,
} from "@/services/platformService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/platform/modules")({
  head: () => ({
    meta: [
      { title: "Plugin Marketplace & Kill-Switch — Platform Super Admin" },
      { name: "description", content: "Manage plug-and-play vertical modules, global kill-switch, and per-tenant state machines." },
    ],
  }),
  component: PlatformModulesPage,
});

function PlatformModulesPage() {
  const [plugins, setPlugins] = useState<PluginManifest[]>([]);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [tenantModules, setTenantModules] = useState<TenantModuleState[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const [pluginsData, tenantsData] = await Promise.all([
        platformService.getPlugins(),
        platformService.getTenants(),
      ]);
      setPlugins(pluginsData);
      setTenants(tenantsData);
      if (!selectedTenantId && tenantsData.length > 0) {
        const first = tenantsData[0];
        if (first) setSelectedTenantId(first.tenant_id);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load catalog";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchTenantModules = async (tId: string) => {
    if (!tId) return;
    try {
      const states = await platformService.getTenantModules(tId);
      setTenantModules(states);
    } catch {
      setTenantModules([]);
    }
  };

  useEffect(() => {
    if (selectedTenantId) {
      fetchTenantModules(selectedTenantId);
    }
  }, [selectedTenantId]);

  const handleToggleKillSwitch = async (pluginId: string, currentActive: boolean) => {
    try {
      setActionLoading(pluginId);
      const updated = await platformService.togglePluginKillSwitch(pluginId, !currentActive);
      setPlugins((prev) =>
        prev.map((p) => (p.id === pluginId ? { ...p, is_active: updated.is_active } : p))
      );
      toast.success(
        `Global kill-switch for '${pluginId}' updated: ${!currentActive ? "ENABLED" : "DISABLED"}`
      );
    } catch (err) {
      toast.error((err as Error).message || "Failed to toggle kill switch");
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivate = async (pluginId: string) => {
    if (!selectedTenantId) return;
    try {
      setActionLoading(`activate-${pluginId}`);
      await platformService.activateTenantModule(selectedTenantId, pluginId);
      toast.success(`Module '${pluginId}' activated for tenant`);
      fetchTenantModules(selectedTenantId);
    } catch (err) {
      toast.error((err as Error).message || "Activation failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async (pluginId: string) => {
    if (!selectedTenantId) return;
    try {
      setActionLoading(`suspend-${pluginId}`);
      await platformService.suspendTenantModule(selectedTenantId, pluginId);
      toast.success(`Module '${pluginId}' suspended for tenant`);
      fetchTenantModules(selectedTenantId);
    } catch (err) {
      toast.error((err as Error).message || "Suspension failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleArchive = async (pluginId: string) => {
    if (!selectedTenantId) return;
    try {
      setActionLoading(`archive-${pluginId}`);
      await platformService.archiveTenantModule(selectedTenantId, pluginId);
      toast.success(`Module '${pluginId}' archived for tenant`);
      fetchTenantModules(selectedTenantId);
    } catch (err) {
      toast.error((err as Error).message || "Archival failed");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Boxes className="size-6 text-violet-600" />
            Plug-and-Play Module Marketplace
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Toggle global kill-switches and manage dynamic module lifecycles per enterprise tenant.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchCatalog}
          disabled={loading}
          className="border-slate-200 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs h-8 shadow-xs"
        >
          <RefreshCw className={cn("size-3.5 mr-1.5", loading && "animate-spin")} />
          Reload Marketplace
        </Button>
      </div>

      <Tabs defaultValue="catalog" className="space-y-6">
        <TabsList className="bg-slate-100 border border-slate-200 text-slate-600">
          <TabsTrigger value="catalog" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs text-xs">
            Global Plugin Manifests & Kill-Switches
          </TabsTrigger>
          <TabsTrigger value="lifecycle" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs text-xs">
            Tenant Module Lifecycle States
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Global Marketplace */}
        <TabsContent value="catalog" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plugins.map((plugin) => (
              <div
                key={plugin.id}
                className={cn(
                  "p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 shadow-xs",
                  plugin.is_active
                    ? "bg-white border-slate-200 hover:border-indigo-300"
                    : "bg-slate-50 border-rose-200 opacity-80"
                )}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{plugin.name}</span>
                        <Badge variant="outline" className="text-[10px] font-mono border-slate-200 bg-slate-100 text-slate-600">
                          v{plugin.version}
                        </Badge>
                      </div>
                      <span className="text-[10px] font-mono text-indigo-600 uppercase tracking-wider font-medium">
                        {plugin.category}
                        {plugin.gated && (
                          <span className="ml-1.5 text-emerald-600" title="The gateway enforces this module's per-tenant state">
                            · gateway-gated
                          </span>
                        )}
                      </span>
                    </div>

                    <Badge
                      className={cn(
                        "text-[10px] font-mono",
                        plugin.is_active
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                      )}
                    >
                      {plugin.is_active ? "ENABLED" : "KILL-SWITCHED"}
                    </Badge>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed min-h-[36px]">
                    {plugin.description}
                  </p>

                  {/* Capabilities */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase text-slate-500">Required Primitives:</span>
                    <div className="flex flex-wrap gap-1">
                      {plugin.required_capabilities.map((cap) => (
                        <span
                          key={cap}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 border border-slate-200 text-slate-700"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Permissions */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase text-slate-500">Granted Permissions:</span>
                    <div className="flex flex-wrap gap-1">
                      {plugin.permissions.map((perm) => (
                        <span
                          key={perm}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-50 border border-indigo-200 text-indigo-700"
                        >
                          {perm}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Kill Switch Toggle Button */}
                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-[11px] text-slate-600 flex items-center gap-1.5">
                    <Power className={cn("size-3.5", plugin.is_active ? "text-emerald-600" : "text-rose-600")} />
                    Global Kill-Switch
                  </span>

                  <Button
                    size="sm"
                    variant={plugin.is_active ? "destructive" : "default"}
                    onClick={() => handleToggleKillSwitch(plugin.id, plugin.is_active)}
                    disabled={actionLoading === plugin.id}
                    className="text-xs h-7 px-2.5 font-medium shadow-xs"
                  >
                    {plugin.is_active ? "Trigger Kill-Switch" : "Re-enable Plugin"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 2: Tenant Module Lifecycle State */}
        <TabsContent value="lifecycle" className="space-y-4">
          <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-700 font-medium">Select Enterprise Tenant:</span>
              <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                <SelectTrigger className="w-[260px] bg-white border-slate-200 text-xs h-8 text-slate-900 shadow-xs">
                  <SelectValue placeholder="Choose Tenant" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900 shadow-md">
                  {tenants.map((t) => (
                    <SelectItem key={t.tenant_id} value={t.tenant_id}>
                      {t.name} ({t.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <span className="text-xs text-slate-500 font-mono">
              State transitions: ACTIVE ⇄ SUSPENDED ⇄ ARCHIVED
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plugins.map((plugin) => {
              const installed = tenantModules.find((m) => m.plugin_id === plugin.id);
              const state = installed?.state || "not_installed";

              return (
                <div
                  key={plugin.id}
                  className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 flex flex-col justify-between shadow-xs"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 text-xs">{plugin.name}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-mono uppercase",
                          state === "active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : state === "suspended"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : state === "archived"
                            ? "bg-slate-100 text-slate-600 border-slate-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        )}
                      >
                        {state}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">{plugin.description}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-1.5">
                    {state !== "active" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleActivate(plugin.id)}
                        disabled={actionLoading === `activate-${plugin.id}`}
                        className="text-xs h-7 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                      >
                        <PlayCircle className="size-3.5 mr-1" />
                        Activate
                      </Button>
                    )}

                    {state === "active" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSuspend(plugin.id)}
                        disabled={actionLoading === `suspend-${plugin.id}`}
                        className="text-xs h-7 text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                      >
                        <PauseCircle className="size-3.5 mr-1" />
                        Suspend
                      </Button>
                    )}

                    {state !== "archived" && state !== "not_installed" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleArchive(plugin.id)}
                        disabled={actionLoading === `archive-${plugin.id}`}
                        className="text-xs h-7 text-rose-700 hover:text-rose-800 hover:bg-rose-50"
                      >
                        <StopCircle className="size-3.5 mr-1" />
                        Archive
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
