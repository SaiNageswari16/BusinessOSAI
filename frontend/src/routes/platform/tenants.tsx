import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Boxes,
  Building2,
  CheckCircle2,
  ChevronRight,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Store,
  Users,
  X,
} from "lucide-react";
import { platformService, type TenantSummary, type TenantOnboardPayload } from "@/services/platformService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

function PlatformTenantsPage() {
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [verticalFilter, setVerticalFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const data = await platformService.getTenants();
      setTenants(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load tenants";
      toast.error(message);
      setTenants([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

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
      fetchTenants();
    } catch (err) {
      toast.error((err as Error).message || "Tenant onboarding failed");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = tenants.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase()) ||
      (t.contact_email && t.contact_email.toLowerCase().includes(search.toLowerCase()));
    const matchesVertical =
      verticalFilter === "all" ||
      t.active_modules.some((m) => m.toLowerCase().includes(verticalFilter));
    return matchesSearch && matchesVertical;
  });

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
          <Select value={verticalFilter} onValueChange={setVerticalFilter}>
            <SelectTrigger className="w-[180px] bg-white border-slate-200 text-xs h-9 text-slate-700 shadow-xs">
              <SelectValue placeholder="All Verticals" />
            </SelectTrigger>
            <SelectContent className="bg-white border-slate-200 text-slate-900 shadow-md">
              <SelectItem value="all">All Verticals</SelectItem>
              <SelectItem value="restaurant">Restaurant OS</SelectItem>
              <SelectItem value="salon">Salon & Spa</SelectItem>
              <SelectItem value="gym">Gym & Fitness</SelectItem>
              <SelectItem value="retail">Retail Store</SelectItem>
              <SelectItem value="clinic">Clinic Care</SelectItem>
              <SelectItem value="carwash">Auto Care</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={fetchTenants}
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                    No enterprise tenants found matching the filter.
                  </td>
                </tr>
              ) : (
                filtered.map((tenant) => (
                  <tr key={tenant.tenant_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <Building2 className="size-3.5 text-indigo-600" />
                          <span>{tenant.name}</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {tenant.slug}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
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

                    <td className="py-3 px-4 text-slate-600 text-[11px]">
                      {tenant.contact_email || "—"}
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
