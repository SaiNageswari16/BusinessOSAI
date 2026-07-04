import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Search, Plus, Edit2, Trash2, X, Save, Loader2, AlertCircle, MapPin, Building2, MoreHorizontal } from "lucide-react";
import { regionsApi, companiesApi, type Region, type Company } from "@/lib/api-client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

function RegionFormModal({ region, companies, onClose, onSaved }: {
  region: Region | null; companies: Company[]; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!region;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_id: region?.company_id ?? (companies[0]?.id ?? ""),
    name: region?.name ?? "",
    code: region?.code ?? "",
    country: region?.country ?? "India",
    status: region?.status ?? "active",
  });
  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (isEdit) { await regionsApi.update(region.id, form); toast.success("Region updated"); }
      else { await regionsApi.create(form); toast.success("Region created"); }
      onSaved(); onClose();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg flex items-center gap-2"><MapPin className="size-5 text-primary" />{isEdit ? "Edit Region" : "Add Region"}</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5">Company *</label>
            <select value={form.company_id} onChange={set("company_id")} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5">Region Name *</label>
              <input value={form.name} onChange={set("name")} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="South India" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Code *</label>
              <input value={form.code} onChange={set("code")} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                placeholder="SI" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Country</label>
              <input value={form.country} onChange={set("country")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" />
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
              {saving ? <Loader2 className="size-4 animate-spin" /> : <><Save className="size-4 mr-1.5" />{isEdit ? "Update" : "Create"}</>}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export function Regions() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editRegion, setEditRegion] = useState<Region | null>(null);
  const [deleteRegion, setDeleteRegion] = useState<Region | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, cRes] = await Promise.all([regionsApi.list(1, 100), companiesApi.list(1, 100)]);
      setRegions(rRes.items);
      setCompanies(cRes.items);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, []);

  const filtered = regions.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.code.toLowerCase().includes(search.toLowerCase()),
  );

  const handleDelete = async () => {
    if (!deleteRegion) return;
    setDeleting(true);
    try {
      await regionsApi.delete(deleteRegion.id);
      toast.success("Region deleted");
      setDeleteRegion(null);
      void load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setDeleting(false); }
  };

  const companyMap = Object.fromEntries(companies.map((c) => [c.id, c.name]));

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Regions</h2>
          <p className="text-sm text-muted-foreground">Manage enterprise geographic regions.</p>
        </div>
        <Button className="gradient-brand text-white border-0 gap-2" onClick={() => { setEditRegion(null); setShowForm(true); }}>
          <Plus className="size-4" /> Add Region
        </Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30 outline-none"
            placeholder="Search regions..." />
        </div>
        <span className="text-xs text-muted-foreground">{regions.length} regions</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 rounded-xl border bg-muted/30 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <MapPin className="size-10 mx-auto mb-3 text-muted-foreground opacity-20" />
          <p className="text-sm text-muted-foreground">No regions yet</p>
          <Button size="sm" className="mt-4 gradient-brand text-white border-0" onClick={() => { setEditRegion(null); setShowForm(true); }}>
            <Plus className="size-4 mr-1" /> Add Region
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((region) => (
            <Card key={region.id} className="p-6 hover:shadow-md transition-shadow group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                    <MapPin className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold">{region.name}</h3>
                    <p className="text-xs text-muted-foreground font-mono">{region.code} • {region.country ?? "—"}</p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => { setEditRegion(region); setShowForm(true); }}><Edit2 className="size-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="size-8 text-red-500 hover:text-red-600" onClick={() => setDeleteRegion(region)}><Trash2 className="size-3.5" /></Button>
                </div>
              </div>
              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Building2 className="size-3" />{companyMap[region.company_id] ?? "—"}
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t">
                <span className={cn("text-[10px] font-medium",
                  region.status === "active" ? "text-emerald-600" : "text-muted-foreground")}>
                  {region.status.charAt(0).toUpperCase() + region.status.slice(1)}
                </span>
                <Button variant="ghost" size="icon" className="size-7"><MoreHorizontal className="size-4" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <RegionFormModal region={editRegion} companies={companies}
            onClose={() => { setShowForm(false); setEditRegion(null); }} onSaved={load} />
        )}
        {deleteRegion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-card border rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-lg bg-red-500/10 text-red-500 grid place-items-center"><AlertCircle className="size-5" /></div>
                <h3 className="font-bold">Delete Region</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">Delete <span className="font-semibold text-foreground">{deleteRegion.name}</span>?</p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteRegion(null)}>Cancel</Button>
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
