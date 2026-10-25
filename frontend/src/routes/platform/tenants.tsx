import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Boxes,
  Building2,
  CheckCircle2,
  ChevronRight,
  Filter,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Store,
  Users,
  X,
} from "lucide-react";
import {
  platformService,
  type TenantModuleState,
  type TenantOnboardPayload,
  type TenantRosterItem,
} from "@/services/platformService";
import { ALL_MODULE_KEYS, moduleLabel } from "@/lib/platform-modules";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/platform/tenants")({
  head: () => ({
    meta: [
      { title: "Tenant Provisioning & Registry — Platform Super Admin" },
      { name: "description", content: "Provision, inspect, and manage enterprise tenants across all verticals." },
    ],
  }),
  component: PlatformTenantsPage,
});

const VERTICAL_OPTIONS = [
  { value: "restaurant", label: "Restaurant & Dining OS", icon: "🍽️" },
  { value: "salon", label: "Salon & Spa Care", icon: "✂️" },
  { value: "gym", label: "Fitness & Gym Club", icon: "🏋️" },
  { value: "retail", label: "Retail & Boutique Store", icon: "🛍️" },
  { value: "clinic", label: "Healthcare & Clinic Care", icon: "🩺" },
  { value: "carwash", label: "Auto Care & Car Wash", icon: "🚗" },
];

const PAGE_SIZE = 50;

function PlatformTenantsPage() {
  const [roster, setRoster] = useState<TenantRosterItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Per-tenant module state panel
  const [selectedTenant, setSelectedTenant] = useState<TenantRosterItem | null>(null);
  const [tenantModuleStates, setTenantModuleStates] = useState<TenantModuleState[]>([]);
  const [moduleLoading, setModuleLoading] = useState(false);
  const [moduleBusy, setModuleBusy] = useState<string | null>(null);

  // Form State
  const [form, setForm] = useState<TenantOnboardPayload>({
    name: "",
    slug: "",
    vertical: "restaurant",
    enabled_modules: ["restaurant"],
    plan: "pro",
    contact_email: "",
    contact_phone: "",
    initial_branch_name: "Flagship Branch",
    initial_branch_code: "HQ-01",
    owner_name: "",
    owner_email: "",
    owner_password: "",
  });

  const fetchRoster = useCallback(async (nextPage: number, searchQuery: string) => {
    try {
      setLoading(true);
      const res = await platformService.listAllTenants({
        limit: PAGE_SIZE,
        offset: nextPage * PAGE_SIZE,
        search: searchQuery || undefined,
      });
      setRoster(res.items);
      setTotal(res.total);
      setPage(nextPage);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load tenant roster";
      toast.error(message);
      setRoster([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoster(0, "");
  }, [fetchRoster]);

  // Debounced search — a fleet of thousands of tenants cannot round-trip
  // on every keystroke; the server owns the filter, so the debounce decides
  // when to ask it.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      fetchRoster(0, search);
    }, 350);
    return () => clearTimeout(t);
  }, [search, fetchRoster]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const openModulePanel = async (tenant: TenantRosterItem) => {
    if (!tenant.id) return; // never-onboarded row without an auth id — nothing to gate
    setSelectedTenant(tenant);
    try {
      setModuleLoading(true);
      const states = await platformService.getTenantModules(tenant.id);
      setTenantModuleStates(states);
    } catch {
      setTenantModuleStates([]);
    } finally {
      setModuleLoading(false);
    }
  };

  const handleModuleAction = async (action: "activate" | "suspend" | "archive", pluginId: string) => {
    if (!selectedTenant?.id) return;
    try {
      setModuleBusy(`${action}-${pluginId}`);
      if (action === "activate") await platformService.activateTenantModule(selectedTenant.id, pluginId);
      else if (action === "suspend") await platformService.suspendTenantModule(selectedTenant.id, pluginId);
      else await platformService.archiveTenantModule(selectedTenant.id, pluginId);
      toast.success(
        `${pluginId} ${action === "activate" ? "activated" : action === "suspend" ? "suspended" : "archived"} for ${selectedTenant.name}`
      );
      const states = await platformService.getTenantModules(selectedTenant.id);
      setTenantModuleStates(states);
      // Refresh the roster page so the module chips stay accurate.
      fetchRoster(page, debouncedSearch);
    } catch (err: unknown) {
      toast.error((err as Error).message || `Module ${action} failed`);
    } finally {
      setModuleBusy(null);
    }
  };

  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setForm((prev) => ({ ...prev, name, slug }));
  };

  const handleVerticalChange = (vertical: string) => {
    setForm((prev) => ({
      ...prev,
      vertical,
      enabled_modules: Array.from(new Set([vertical, "pos"])),
    }));
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await platformService.onboardTenant(form);
      toast.success(`Tenant '${res.name}' provisioned successfully across Auth, Org, & Platform databases!`);
      setModalOpen(false);
      // Jump the roster to page 1 where the new tenant will land (newest first).
      fetchRoster(0, debouncedSearch);
    } catch (err) {
      toast.error((err as Error).message || "Tenant onboarding failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Users className="size-6 text-indigo-600" />
            Enterprise Tenant Provisioning
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Provision new tenants, assign primary verticals, and configure isolated schema states.
          </p>
        </div>

        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 shadow-xs">
              <Plus className="size-3.5 mr-1.5" />
              Onboard Enterprise Tenant
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl bg-white border-slate-200 text-slate-900 max-h-[90vh] overflow-y-auto shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="size-5 text-indigo-600" />
                Tenant Onboarding Wizard
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                This wizard automates cross-service provisioning: creating tenant credentials in Auth, initial branch in Organization, and activated vertical modules in Platform.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleOnboardSubmit} className="space-y-4 pt-2">
              {/* Vertical Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-700 font-medium">Primary Industry Vertical</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {VERTICAL_OPTIONS.map((v) => {
                    const isSelected = form.vertical === v.value;
                    return (
                      <button
                        type="button"
                        key={v.value}
                        onClick={() => handleVerticalChange(v.value)}
                        className={cn(
                          "p-2.5 rounded-xl border text-left text-xs transition-all flex flex-col justify-between gap-1",
                          isSelected
                            ? "bg-indigo-50 border-indigo-500 text-indigo-900 font-medium ring-1 ring-indigo-500/30"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        )}
                      >
                        <span className="text-base">{v.icon}</span>
                        <span className="truncate">{v.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Module Agreement — the enable/disable set per contract */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-700 font-medium">
                  Enable Modules for This Tenant (agreement)
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {ALL_MODULE_KEYS.map((mod) => {
                    const checked = form.enabled_modules.includes(mod) || form.vertical === mod;
                    return (
                      <button
                        type="button"
                        key={mod}
                        onClick={() =>
                          setForm((prev) => {
                            const has = prev.enabled_modules.includes(mod);
                            return {
                              ...prev,
                              enabled_modules: has
                                ? prev.enabled_modules.filter((m) => m !== mod)
                                : [...prev.enabled_modules, mod],
                            };
                          })
                        }
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-lg border text-[11px] font-mono transition-all",
                          checked
                            ? "bg-emerald-50 border-emerald-300 text-emerald-800 font-medium"
                            : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800"
                        )}
                      >
                        <span
                          className={cn(
                            "size-3.5 rounded border flex items-center justify-center shrink-0",
                            checked ? "bg-emerald-500 border-emerald-500" : "bg-white border-slate-300"
                          )}
                        >
                          {checked && <CheckCircle2 className="size-3 text-white" />}
                        </span>
                        <span className="truncate">{mod}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-500">
                  Unchecked modules are switched off at onboarding; the gateway's per-tenant
                  module gate then blocks them (404) within the 5s cache window.
                </p>
              </div>

              {/* Organization Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-700 font-medium">Tenant / Org Name</Label>
                  <Input
                    required
                    value={form.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Bella Napoli Osteria"
                    className="bg-white border-slate-200 text-slate-900 text-xs h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-700 font-medium">Tenant Slug (Unique ID)</Label>
                  <Input
                    required
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    placeholder="bella-napoli"
                    className="bg-white border-slate-200 text-slate-900 text-xs h-8 font-mono"
                  />
                </div>
              </div>

              {/* Plan & Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-700 font-medium">License Plan</Label>
                  <Select value={form.plan} onValueChange={(plan) => setForm({ ...form, plan })}>
                    <SelectTrigger className="bg-white border-slate-200 text-slate-900 text-xs h-8">
                      <SelectValue placeholder="Plan" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 text-slate-900 shadow-md">
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-700 font-medium">Contact Email</Label>
                  <Input
                    type="email"
                    required
                    value={form.contact_email}
                    onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                    placeholder="billing@tenant.com"
                    className="bg-white border-slate-200 text-slate-900 text-xs h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-700 font-medium">Contact Phone</Label>
                  <Input
                    value={form.contact_phone}
                    onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                    placeholder="+1 555-0199"
                    className="bg-white border-slate-200 text-slate-900 text-xs h-8"
                  />
                </div>
              </div>

              {/* Initial Outlet */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-700 font-medium">Initial Branch Name</Label>
                  <Input
                    value={form.initial_branch_name}
                    onChange={(e) => setForm({ ...form, initial_branch_name: e.target.value })}
                    className="bg-white border-slate-200 text-slate-900 text-xs h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-700 font-medium">Initial Branch Code</Label>
                  <Input
                    value={form.initial_branch_code}
                    onChange={(e) => setForm({ ...form, initial_branch_code: e.target.value })}
                    className="bg-white border-slate-200 text-slate-900 text-xs h-8 font-mono"
                  />
                </div>
              </div>

              {/* Owner Admin Credentials */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Shield className="size-3.5 text-indigo-600" />
                  Tenant Owner Admin Account
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-600 font-medium">Admin Name</Label>
                    <Input
                      required
                      value={form.owner_name}
                      onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                      placeholder="e.g. Marco Rossi"
                      className="bg-white border-slate-200 text-slate-900 text-xs h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-600 font-medium">Admin Login Email</Label>
                    <Input
                      type="email"
                      required
                      value={form.owner_email}
                      onChange={(e) => setForm({ ...form, owner_email: e.target.value })}
                      placeholder="owner@tenant.com"
                      className="bg-white border-slate-200 text-slate-900 text-xs h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-600 font-medium">Initial Password</Label>
                    <Input
                      type="password"
                      required
                      minLength={8}
                      value={form.owner_password}
                      onChange={(e) => setForm({ ...form, owner_password: e.target.value })}
                      placeholder="Min 8 chars"
                      className="bg-white border-slate-200 text-slate-900 text-xs h-8"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                  className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs h-9 shadow-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 shadow-xs"
                >
                  {submitting ? "Provisioning Mesh..." : "Provision Tenant Fleet"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by tenant name, slug, or email..."
            className="pl-9 bg-white border-slate-200 text-xs h-9 text-slate-900 placeholder:text-slate-400 shadow-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono">
            {total} tenants • page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchRoster(page, debouncedSearch)}
            disabled={loading}
            className="border-slate-200 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 size-9 shadow-xs"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-mono">
              <tr>
                <th className="py-3 px-4">Organization & Slug</th>
                <th className="py-3 px-4">Active Modules</th>
                <th className="py-3 px-4">License Plan</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Modules</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {roster.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                    {loading ? "Loading tenant roster..." : "No tenants found matching the filter."}
                  </td>
                </tr>
              ) : (
                roster.map((tenant) => (
                  <tr
                    key={tenant.id ?? tenant.slug}
                    onClick={() => openModulePanel(tenant)}
                    className="hover:bg-indigo-50/40 transition-colors cursor-pointer"
                    title="Click to manage this tenant's modules"
                  >
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <Building2 className="size-3.5 text-indigo-600" />
                          <span>{tenant.name}</span>
                          {!tenant.is_managed && (
                            <Badge
                              variant="outline"
                              className="text-[9px] font-mono border-amber-200 bg-amber-50 text-amber-700 px-1 py-0"
                            >
                              unmanaged
                            </Badge>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {tenant.slug}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {tenant.active_modules.length === 0 ? (
                        <span className="text-[10px] text-slate-400">none managed yet</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {tenant.active_modules.map((mod) => (
                            <Badge
                              key={mod}
                              variant="outline"
                              className="text-[10px] bg-slate-100 border-slate-200 text-indigo-700 font-mono px-1.5 py-0"
                            >
                              {mod}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-mono uppercase",
                          tenant.plan === "enterprise"
                            ? "border-violet-200 text-violet-700 bg-violet-50"
                            : tenant.plan === "pro"
                              ? "border-indigo-200 text-indigo-700 bg-indigo-50"
                              : "border-slate-200 text-slate-600 bg-slate-100"
                        )}
                      >
                        {tenant.plan}
                      </Badge>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 text-emerald-600 font-medium text-[11px]">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        {tenant.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(tenant.created_at).toLocaleDateString()}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <span className="text-indigo-600 text-[11px] font-medium flex items-center gap-1 justify-end">
                        Manage Modules
                        <ChevronRight className="size-3.5" />
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0 || loading}
              onClick={() => fetchRoster(page - 1, debouncedSearch)}
              className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs h-8 shadow-xs"
            >
              ← Previous
            </Button>
            <span className="text-[11px] font-mono text-slate-500">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages || loading}
              onClick={() => fetchRoster(page + 1, debouncedSearch)}
              className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs h-8 shadow-xs"
            >
              Next →
            </Button>
          </div>
        )}
      </div>

      {/* Per-Tenant Module On/Off Panel */}
      <Dialog open={!!selectedTenant} onOpenChange={(open) => !open && setSelectedTenant(null)}>
        <DialogContent className="max-w-2xl bg-white border-slate-200 text-slate-900 max-h-[90vh] overflow-y-auto shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Boxes className="size-5 text-indigo-600" />
              Module Lifecycle — {selectedTenant?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Toggle each module on/off per the agreement. Suspended or archived modules
              are blocked by the gateway's per-tenant module gate within the 5s cache window.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 pt-2">
            {moduleLoading ? (
              <div className="py-8 text-center text-xs text-slate-500 font-mono">Loading module states...</div>
            ) : (
              ALL_MODULE_KEYS.map((key) => {
                const state = tenantModuleStates.find((s) => s.plugin_id === key)?.state;
                // No row = active by default (the "never onboarded" case).
                const effective = state ?? "active";

                return (
                  <div
                    key={key}
                    className={cn(
                      "p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors",
                      effective === "active"
                        ? "bg-white border-slate-200"
                        : "bg-slate-50 border-slate-200 opacity-90"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={cn("size-2 rounded-full shrink-0",
                        effective === "active" ? "bg-emerald-500" : effective === "suspended" ? "bg-amber-500" : "bg-slate-400")} />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 truncate">{moduleLabel(key)}</div>
                        <div className="text-[10px] font-mono text-slate-400 truncate">{key}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {effective !== "active" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleModuleAction("activate", key)}
                          disabled={moduleBusy !== null}
                          className="text-xs h-7 gap-1 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                        >
                          <PlayCircle className="size-3.5" /> Activate
                        </Button>
                      )}
                      {effective === "active" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleModuleAction("suspend", key)}
                          disabled={moduleBusy !== null}
                          className="text-xs h-7 gap-1 text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                        >
                          <PauseCircle className="size-3.5" /> Suspend
                        </Button>
                      )}
                      {effective !== "archived" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleModuleAction("archive", key)}
                          disabled={moduleBusy !== null}
                          className="text-xs h-7 gap-1 text-rose-700 hover:text-rose-800 hover:bg-rose-50"
                        >
                          <X className="size-3.5" /> Archive
                        </Button>
                      )}
                      {moduleBusy && moduleBusy.endsWith(`-${key}`) && (
                        <span className="text-[10px] font-mono text-slate-400 animate-pulse">working…</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              variant="outline"
              onClick={() => setSelectedTenant(null)}
              className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs h-8 shadow-xs"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
