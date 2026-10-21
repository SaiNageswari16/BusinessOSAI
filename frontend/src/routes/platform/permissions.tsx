import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Filter,
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  platformService,
  type PermissionCatalogueItem,
  type AccessPolicyItem,
} from "@/services/platformService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/platform/permissions")({
  head: () => ({
    meta: [
      { title: "RBAC Permissions & Policies — Platform Super Admin" },
      { name: "description", content: "Inspect 67+ granular permissions and manage ABAC policy rules across microservices." },
    ],
  }),
  component: PlatformPermissionsPage,
});

const TIER_LABELS: Record<number, { name: string; color: string }> = {
  1: { name: "Tier 1: Line Staff", color: "border-slate-200 bg-slate-100 text-slate-700" },
  2: { name: "Tier 2: Captain / Cashier", color: "border-blue-200 bg-blue-50 text-blue-700" },
  3: { name: "Tier 3: Outlet Manager", color: "border-amber-200 bg-amber-50 text-amber-700" },
  4: { name: "Tier 4: Tenant Owner", color: "border-violet-200 bg-violet-50 text-violet-700" },
  5: { name: "Tier 5: Platform Super Admin", color: "border-rose-200 bg-rose-50 text-rose-700" },
};

function PlatformPermissionsPage() {
  const [permissions, setPermissions] = useState<PermissionCatalogueItem[]>([]);
  const [policies, setPolicies] = useState<AccessPolicyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedModule, setSelectedModule] = useState("all");
  const [selectedTier, setSelectedTier] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);

  // New Perm Form
  const [newCode, setNewCode] = useState("");
  const [newModule, setNewModule] = useState("pos");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newTier, setNewTier] = useState("2");
  const [submitting, setSubmitting] = useState(false);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const [permData, polData] = await Promise.all([
        platformService.getPermissions(),
        platformService.getPolicies(),
      ]);
      setPermissions(permData);
      setPolicies(polData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load permissions";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const handleCreatePermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newName) return;
    setSubmitting(true);
    try {
      const created = await platformService.createPermission({
        code: newCode,
        module: newModule,
        name: newName,
        description: newDesc,
        tier: parseInt(newTier, 10),
      });
      setPermissions((prev) => [...prev, created]);
      toast.success(`Permission '${created.code}' registered in catalogue`);
      setModalOpen(false);
      setNewCode("");
      setNewName("");
      setNewDesc("");
    } catch (err) {
      toast.error((err as Error).message || "Failed to create permission");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = permissions.filter((p) => {
    const matchesSearch =
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()));
    const matchesModule = selectedModule === "all" || p.module === selectedModule;
    const matchesTier = selectedTier === "all" || p.tier.toString() === selectedTier;
    return matchesSearch && matchesModule && matchesTier;
  });

  const modulesList = Array.from(new Set(permissions.map((p) => p.module))).sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <KeyRound className="size-6 text-amber-600" />
            RBAC Catalogue & Permission Matrix
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Browse 67+ fine-grained permission keys and ABAC dynamic policy evaluation rules.
          </p>
        </div>

        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 shadow-xs">
              <Plus className="size-3.5 mr-1.5" />
              Register Permission Key
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md bg-white border-slate-200 text-slate-900 shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="size-5 text-indigo-600" />
                Add Permission to Catalogue
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Newly registered permissions become immediately enforceable in Gateway authorization checks and role assignments.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreatePermission} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs text-slate-700 font-medium">Permission Code (e.g. pos:refund:issue)</Label>
                <Input
                  required
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="module:resource:action"
                  className="bg-white border-slate-200 text-slate-900 text-xs h-8 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-700 font-medium">Module</Label>
                  <Input
                    required
                    value={newModule}
                    onChange={(e) => setNewModule(e.target.value)}
                    placeholder="pos"
                    className="bg-white border-slate-200 text-slate-900 text-xs h-8 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-700 font-medium">RBAC Tier</Label>
                  <Select value={newTier} onValueChange={setNewTier}>
                    <SelectTrigger className="bg-white border-slate-200 text-slate-900 text-xs h-8">
                      <SelectValue placeholder="Tier" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 text-slate-900 shadow-md">
                      <SelectItem value="1">Tier 1: Staff</SelectItem>
                      <SelectItem value="2">Tier 2: Cashier</SelectItem>
                      <SelectItem value="3">Tier 3: Manager</SelectItem>
                      <SelectItem value="4">Tier 4: Owner</SelectItem>
                      <SelectItem value="5">Tier 5: Platform Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-slate-700 font-medium">Human Readable Name</Label>
                <Input
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Issue POS Cash Refund"
                  className="bg-white border-slate-200 text-slate-900 text-xs h-8"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-slate-700 font-medium">Description</Label>
                <Input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Optional operational explanation"
                  className="bg-white border-slate-200 text-slate-900 text-xs h-8"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                  className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs h-8 shadow-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 shadow-xs"
                >
                  {submitting ? "Registering..." : "Add Permission"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="catalogue" className="space-y-6">
        <TabsList className="bg-slate-100 border border-slate-200 text-slate-600">
          <TabsTrigger value="catalogue" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs text-xs">
            Permission Catalogue ({filtered.length})
          </TabsTrigger>
          <TabsTrigger value="policies" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs text-xs">
            ABAC Policy Rules ({policies.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalogue" className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by permission code or name..."
                className="pl-9 bg-white border-slate-200 text-xs h-9 text-slate-900 placeholder:text-slate-400 shadow-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <Select value={selectedModule} onValueChange={setSelectedModule}>
                <SelectTrigger className="w-[140px] bg-white border-slate-200 text-xs h-9 text-slate-700 shadow-xs">
                  <SelectValue placeholder="All Modules" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900 shadow-md">
                  <SelectItem value="all">All Modules</SelectItem>
                  {modulesList.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedTier} onValueChange={setSelectedTier}>
                <SelectTrigger className="w-[140px] bg-white border-slate-200 text-xs h-9 text-slate-700 shadow-xs">
                  <SelectValue placeholder="All Tiers" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900 shadow-md">
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="1">Tier 1: Staff</SelectItem>
                  <SelectItem value="2">Tier 2: Cashier</SelectItem>
                  <SelectItem value="3">Tier 3: Manager</SelectItem>
                  <SelectItem value="4">Tier 4: Owner</SelectItem>
                  <SelectItem value="5">Tier 5: Platform</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-mono">
                  <tr>
                    <th className="py-3 px-4">Permission Key</th>
                    <th className="py-3 px-4">Module</th>
                    <th className="py-3 px-4">Readable Name</th>
                    <th className="py-3 px-4">RBAC Tier Level</th>
                    <th className="py-3 px-4">System Guard</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500 text-xs">
                        No permissions found matching query.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((p) => {
                      const tierStyle = TIER_LABELS[p.tier] || {
                        name: `Tier ${p.tier}`,
                        color: "border-slate-200 bg-slate-100 text-slate-600",
                      };
                      return (
                        <tr key={p.code} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-mono text-indigo-700 font-medium">
                              {p.code}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="text-[10px] uppercase font-mono border-slate-200 bg-slate-100 text-slate-700">
                              {p.module}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="space-y-0.5">
                              <span className="font-medium text-slate-900">{p.name}</span>
                              {p.description && (
                                <p className="text-[11px] text-slate-500">{p.description}</p>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className={cn("text-[10px] font-mono", tierStyle.color)}>
                              {tierStyle.name}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            {p.is_system ? (
                              <span className="text-slate-500 text-[11px] font-mono flex items-center gap-1">
                                <Shield className="size-3 text-slate-400" />
                                core_locked
                              </span>
                            ) : (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                                Custom
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: ABAC Policies */}
        <TabsContent value="policies" className="space-y-4">
          <div className="p-4 rounded-xl bg-white border border-slate-200 text-xs text-slate-600 space-y-1 shadow-xs">
            <span className="font-semibold text-slate-900">Attribute-Based Access Control (ABAC) Engine</span>
            <p>
              Policies dynamically evaluate tenant context, branch hours, discount thresholds, and role scopes during Gateway dispatch.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-mono">
                <tr>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Module</th>
                  <th className="py-3 px-4">Resource</th>
                  <th className="py-3 px-4">Operation</th>
                  <th className="py-3 px-4">Effect</th>
                  <th className="py-3 px-4">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {policies.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                      No tenant-specific override policies active. Global RBAC catalog controls all requests.
                    </td>
                  </tr>
                ) : (
                  policies.map((pol) => (
                    <tr key={pol.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono text-slate-800">{pol.subject}</td>
                      <td className="py-3 px-4 uppercase font-mono">{pol.module}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">{pol.resource}</td>
                      <td className="py-3 px-4 font-mono">{pol.operation}</td>
                      <td className="py-3 px-4">
                        <Badge
                          className={cn(
                            "text-[10px] font-mono",
                            pol.effect === "allow"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          )}
                        >
                          {pol.effect.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">{pol.priority}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
