import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Laptop, Globe, Clock, Users, Palette, MoreHorizontal, X, Save, Loader2, AlertCircle, Trash2, RefreshCw, Search } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useTenant } from "@/contexts/tenant-context";
import { companiesApi, branchesApi, type Company, type Branch } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useCurrency } from "@/hooks/use-currency";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

interface Workspace {
  id: string;
  company_id: string;
  branch_id: string | null;
  name: string;
  theme: string;
  language: string;
  timezone: string;
  status: string;
  created_at: string;
}

function WorkspaceModal({
  workspace,
  companies,
  branches,
  onClose,
  onSaved,
}: {
  workspace: Workspace | null;
  companies: Company[];
  branches: Branch[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { accessToken } = useAuth();
  const isEdit = !!workspace;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_id: workspace?.company_id ?? (companies[0]?.id ?? ""),
    branch_id: workspace?.branch_id ?? "",
    name: workspace?.name ?? "",
    theme: workspace?.theme ?? "light",
    language: workspace?.language ?? "en",
    timezone: workspace?.timezone ?? "Asia/Kolkata",
    status: workspace?.status ?? "active",
  });

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        branch_id: form.branch_id || null,
      };
      const url = isEdit
        ? `${API_BASE_URL}/erp/workspaces/${workspace.id}`
        : `${API_BASE_URL}/erp/workspaces`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save workspace");
      toast.success(isEdit ? "Workspace updated" : "Workspace created");
      onSaved();
      onClose();
    } catch (err) {
      console.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg flex items-center gap-2"><Laptop className="size-5 text-primary" />{isEdit ? "Edit Workspace" : "Create Workspace"}</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5">Workspace Name *</label>
            <input value={form.name} onChange={set("name")} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="e.g. Retail Production Environment" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5">Company Profile *</label>
            <select value={form.company_id} onChange={set("company_id")} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
              {(companies || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5">Branch Profile</label>
            <select value={form.branch_id} onChange={set("branch_id")}
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
              <option value="">No linked branch (All branches)</option>
              {(branches || []).filter(b => b.company_id === form.company_id).map((b) => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5">Default Theme</label>
              <select value={form.theme} onChange={set("theme")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Default Language</label>
              <select value={form.language} onChange={set("language")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
                <option value="en">English (US)</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="hi">हिन्दी</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Default Timezone</label>
              <select value={form.timezone} onChange={set("timezone")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
                <option value="Asia/Kolkata">Kolkata (IST)</option>
                <option value="America/New_York">New York (EST)</option>
                <option value="Europe/London">London (GMT)</option>
                <option value="Asia/Singapore">Singapore (SGT)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Status</label>
              <select value={form.status} onChange={set("status")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="gradient-brand text-white border-0 min-w-[100px]">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <><Save className="size-4 mr-1.5" />Save</>}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export function WorkspaceManagement() {
    const { currency, formatCurrency } = useCurrency();
  const { accessToken } = useAuth();
  const { tenant: activeTenant, setTenant } = useTenant();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editWorkspace, setEditWorkspace] = useState<Workspace | null>(null);
  const [deleteWorkspace, setDeleteWorkspace] = useState<Workspace | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [wRes, cRes, bRes] = await Promise.all([
        fetch(`${API_BASE_URL}/erp/workspaces`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        companiesApi.list(1, 100),
        branchesApi.list(1, 100),
      ]);
      if (!wRes.ok) throw new Error("Failed to load workspaces");
      const wData = await wRes.json();
      setWorkspaces(wData);
      setCompanies(cRes.items);
      setBranches(bRes.items);
    } catch (err) {
      console.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { void load(); }, [load]);

  const handleDelete = async () => {
    if (!deleteWorkspace || !accessToken) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/erp/workspaces/${deleteWorkspace.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to delete workspace");
      toast.success("Workspace deleted");
      setDeleteWorkspace(null);
      void load();
    } catch (err) {
      console.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setDeleting(false);
    }
  };

  const handleSwitchWorkspace = (ws: Workspace) => {
    const matchedCompany = companies.find(c => c.id === ws.company_id);
    if (matchedCompany) {
      setTenant({
        id: matchedCompany.id,
        name: matchedCompany.name,
        industry: matchedCompany.industry ?? "General",
        logo: matchedCompany.logo_initials ?? matchedCompany.name.slice(0, 2).toUpperCase(),
        isReal: true,
        raw: matchedCompany
      });
      toast.success(`Switched active profile to workspace: ${ws.name}`);
    } else {
      toast.error("Linked company profile not found in your list");
    }
  };

  const companyMap = Object.fromEntries((companies || []).map(c => [c.id, c.name]));
  const branchMap = Object.fromEntries((branches || []).map(b => [b.id, b.name]));

  const filtered = Array.isArray(workspaces)
    ? workspaces.filter((w) =>
        (w?.name || "").toLowerCase().includes(search.toLowerCase())
      )
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight">Workspace Management</h2>
          <p className="text-muted-foreground text-xs mt-0.5">Configure multi-environment workspaces, UI themes, and localization.</p>
        </div>
        <Button size="sm" className="h-8 gradient-brand text-white border-0 gap-1.5 text-xs font-semibold" onClick={() => { setEditWorkspace(null); setShowModal(true); }}>
          <Plus className="size-3.5" /> Create Workspace
        </Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 text-sm rounded-lg border bg-card focus:ring-2 focus:ring-primary/20 outline-none"
            placeholder="Search workspaces..." />
        </div>
        <Button variant="outline" className="gap-2 h-10" onClick={load}>
          <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-56 rounded-xl border bg-muted/30 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/10 rounded-2xl border border-dashed">
          <Laptop className="size-10 mx-auto mb-3 text-muted-foreground opacity-20" />
          <p className="text-sm text-muted-foreground">No active workspaces configured</p>
          <Button size="sm" className="mt-4 gradient-brand text-white border-0" onClick={() => { setEditWorkspace(null); setShowModal(true); }}>
            <Plus className="size-4 mr-1" /> Create Workspace
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((ws) => (
            <Card key={ws.id} className="p-6 hover:shadow-elegant transition-shadow group relative">
              <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="size-7" onClick={() => { setEditWorkspace(ws); setShowModal(true); }}>
                  <Palette className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="size-7 text-red-500" onClick={() => setDeleteWorkspace(ws)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="flex items-center gap-3 mb-6">
                <div className="size-12 rounded-xl bg-purple-500/10 text-purple-600 grid place-items-center shadow-sm">
                  <Laptop className="size-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base tracking-tight">{ws.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {companyMap[ws.company_id] ?? "Unknown Company"} • {ws.branch_id ? branchMap[ws.branch_id] ?? "Unknown Branch" : "All Branches"}
                  </p>
                </div>
              </div>

              <div className="space-y-3.5 mb-6 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground"><Palette className="size-3.5" /> Default Theme</div>
                  <span className="font-semibold capitalize">{ws.theme}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground"><Globe className="size-3.5" /> Language</div>
                  <span className="font-semibold uppercase">{ws.language}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground"><Clock className="size-3.5" /> Timezone</div>
                  <span className="font-semibold">{ws.timezone}</span>
                </div>
              </div>

              <Button variant="outline" className="w-full text-xs h-8 hover:bg-primary/5 hover:text-primary transition-colors"
                onClick={() => handleSwitchWorkspace(ws)}>
                Switch to this Workspace
              </Button>
            </Card>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <WorkspaceModal workspace={editWorkspace} companies={companies} branches={branches}
            onClose={() => setShowModal(false)} onSaved={load} />
        )}
        {deleteWorkspace && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-card border rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-lg bg-red-500/10 text-red-500 grid place-items-center"><AlertCircle className="size-5" /></div>
                <h3 className="font-bold">Delete Workspace</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">Are you sure you want to delete <span className="font-semibold text-foreground">{deleteWorkspace.name}</span>?</p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteWorkspace(null)}>Cancel</Button>
                <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
                  {deleting ? <Loader2 className="size-4 animate-spin mr-1" /> : <Trash2 className="size-4 mr-1" />} Delete
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
