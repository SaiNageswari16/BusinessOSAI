import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Search, Plus, Edit2, Trash2, X, Save, Loader2, AlertCircle, LayoutGrid, Building2 } from "lucide-react";
import { businessUnitsApi, companiesApi, type BusinessUnit, type Company } from "@/lib/api-client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

function BusinessUnitFormModal({ bu, companies, onClose, onSaved }: {
  bu: BusinessUnit | null; companies: Company[]; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!bu;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_id: bu?.company_id ?? (companies[0]?.id ?? ""),
    name: bu?.name ?? "",
    status: bu?.status ?? "active",
  });
  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (isEdit) { await businessUnitsApi.update(bu.id, form); toast.success("Business unit updated"); }
      else { await businessUnitsApi.create(form); toast.success("Business unit created"); }
      onSaved(); onClose();
    } catch (err) { console.error(err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg flex items-center gap-2"><LayoutGrid className="size-5 text-primary" />{isEdit ? "Edit Business Unit" : "Add Business Unit"}</h2>
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
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1.5">Business Unit Name *</label>
              <input value={form.name} onChange={set("name")} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Technology Division" />
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

export function BusinessUnits() {
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editUnit, setEditUnit] = useState<BusinessUnit | null>(null);
  const [deleteUnit, setDeleteUnit] = useState<BusinessUnit | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, cRes] = await Promise.all([businessUnitsApi.list(1, 100), companiesApi.list(1, 100)]);
      setUnits(uRes.items);
      setCompanies(cRes.items);
    } catch (err) { console.error(err instanceof Error ? err.message : "Failed"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, []);

  const filtered = units.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()));

  const handleDelete = async () => {
    if (!deleteUnit) return;
    setDeleting(true);
    try {
      await businessUnitsApi.delete(deleteUnit.id);
      toast.success("Business unit deleted");
      setDeleteUnit(null);
      void load();
    } catch (err) { console.error(err instanceof Error ? err.message : "Failed"); }
    finally { setDeleting(false); }
  };

  const companyMap = Object.fromEntries(companies.map((c) => [c.id, c.name]));

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Business Units</h2>
          <p className="text-sm text-muted-foreground">Operational divisions that group departments and functions.</p>
        </div>
        <Button className="gradient-brand text-white border-0 gap-2" onClick={() => { setEditUnit(null); setShowForm(true); }}>
          <Plus className="size-4" /> Add Business Unit
        </Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30 outline-none"
            placeholder="Search business units..." />
        </div>
        <span className="text-xs text-muted-foreground">{units.length} units</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 rounded-xl border bg-muted/30 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <LayoutGrid className="size-10 mx-auto mb-3 text-muted-foreground opacity-20" />
          <p className="text-sm text-muted-foreground">No business units yet</p>
          <Button size="sm" className="mt-4 gradient-brand text-white border-0" onClick={() => { setEditUnit(null); setShowForm(true); }}>
            <Plus className="size-4 mr-1" /> Add Business Unit
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((unit) => (
            <Card key={unit.id} className="p-5 hover:shadow-md transition-shadow group">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                    <LayoutGrid className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">{unit.name}</h3>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 className="size-3" />{companyMap[unit.company_id] ?? "—"}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => { setEditUnit(unit); setShowForm(true); }}><Edit2 className="size-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="size-8 text-red-500" onClick={() => setDeleteUnit(unit)}><Trash2 className="size-3.5" /></Button>
                </div>
              </div>
              <span className={cn("text-[10px] font-medium", unit.status === "active" ? "text-emerald-600" : "text-muted-foreground")}>
                {unit.status.charAt(0).toUpperCase() + unit.status.slice(1)}
              </span>
            </Card>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <BusinessUnitFormModal bu={editUnit} companies={companies}
            onClose={() => { setShowForm(false); setEditUnit(null); }} onSaved={load} />
        )}
        {deleteUnit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-card border rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-lg bg-red-500/10 text-red-500 grid place-items-center"><AlertCircle className="size-5" /></div>
                <h3 className="font-bold">Delete Business Unit</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">Delete <span className="font-semibold text-foreground">{deleteUnit.name}</span>?</p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteUnit(null)}>Cancel</Button>
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
