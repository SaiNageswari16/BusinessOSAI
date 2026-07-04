import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Search, Plus, Edit2, Trash2, X, Save, Loader2, AlertCircle, Calendar, Lock, CheckCircle, Building2 } from "lucide-react";
import { fiscalYearsApi, companiesApi, type FiscalYear, type Company } from "@/lib/api-client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { color: string; icon: React.ElementType }> = {
  open: { color: "bg-emerald-500/10 text-emerald-600", icon: CheckCircle },
  locked: { color: "bg-amber-500/10 text-amber-600", icon: Lock },
  closed: { color: "bg-red-500/10 text-red-600", icon: Lock },
};

function FiscalYearFormModal({ fy, companies, onClose, onSaved }: {
  fy: FiscalYear | null; companies: Company[]; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!fy;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_id: fy?.company_id ?? (companies[0]?.id ?? ""),
    name: fy?.name ?? "",
    start_date: fy?.start_date ?? "",
    end_date: fy?.end_date ?? "",
    status: fy?.status ?? "open",
  });
  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (isEdit) { await fiscalYearsApi.update(fy.id, form); toast.success("Fiscal year updated"); }
      else { await fiscalYearsApi.create(form); toast.success("Fiscal year created"); }
      onSaved(); onClose();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg flex items-center gap-2"><Calendar className="size-5 text-primary" />{isEdit ? "Edit Fiscal Year" : "Add Fiscal Year"}</h2>
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
          <div>
            <label className="block text-xs font-semibold mb-1.5">Name *</label>
            <input value={form.name} onChange={set("name")} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="FY 2024-25" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5">Start Date *</label>
              <input type="date" value={form.start_date} onChange={set("start_date")} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">End Date *</label>
              <input type="date" value={form.end_date} onChange={set("end_date")} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1.5">Status</label>
              <select value={form.status} onChange={set("status")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
                <option value="open">Open</option>
                <option value="locked">Locked</option>
                <option value="closed">Closed</option>
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

export function FiscalYears() {
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editFY, setEditFY] = useState<FiscalYear | null>(null);
  const [deleteFY, setDeleteFY] = useState<FiscalYear | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fRes, cRes] = await Promise.all([fiscalYearsApi.list(1, 100), companiesApi.list(1, 100)]);
      setFiscalYears(fRes.items);
      setCompanies(cRes.items);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, []);

  const filtered = fiscalYears.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));
  const companyMap = Object.fromEntries(companies.map((c) => [c.id, c.name]));

  const handleDelete = async () => {
    if (!deleteFY) return;
    setDeleting(true);
    try {
      await fiscalYearsApi.delete(deleteFY.id);
      toast.success("Fiscal year deleted");
      setDeleteFY(null);
      void load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setDeleting(false); }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Fiscal Years</h2>
          <p className="text-sm text-muted-foreground">Manage accounting periods and fiscal year transitions.</p>
        </div>
        <Button className="gradient-brand text-white border-0 gap-2" onClick={() => { setEditFY(null); setShowForm(true); }}>
          <Plus className="size-4" /> New Fiscal Year
        </Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-2 focus:ring-primary/20 outline-none"
            placeholder="Search fiscal years..." />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-36 rounded-xl border bg-muted/30 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Calendar className="size-10 mx-auto mb-3 text-muted-foreground opacity-20" />
          <p className="text-sm text-muted-foreground">No fiscal years yet</p>
          <Button size="sm" className="mt-4 gradient-brand text-white border-0" onClick={() => { setEditFY(null); setShowForm(true); }}>
            <Plus className="size-4 mr-1" /> Create Fiscal Year
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((fy) => {
            const statusCfg = STATUS_CONFIG[fy.status] ?? STATUS_CONFIG.open;
            const StatusIcon = statusCfg.icon;
            return (
              <Card key={fy.id} className="p-5 hover:shadow-md transition-shadow group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                      <Calendar className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-bold">{fy.name}</h3>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="size-3" />{companyMap[fy.company_id] ?? "—"}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => { setEditFY(fy); setShowForm(true); }}><Edit2 className="size-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="size-7 text-red-500" onClick={() => setDeleteFY(fy)}><Trash2 className="size-3.5" /></Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mb-3">
                  <span className="font-mono">{fy.start_date}</span> → <span className="font-mono">{fy.end_date}</span>
                </div>
                <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize", statusCfg.color)}>
                  <StatusIcon className="size-3" />{fy.status}
                </span>
              </Card>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <FiscalYearFormModal fy={editFY} companies={companies}
            onClose={() => { setShowForm(false); setEditFY(null); }} onSaved={load} />
        )}
        {deleteFY && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-card border rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-lg bg-red-500/10 text-red-500 grid place-items-center"><AlertCircle className="size-5" /></div>
                <h3 className="font-bold">Delete Fiscal Year</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">Delete <span className="font-semibold text-foreground">{deleteFY.name}</span>? This may affect accounting data.</p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteFY(null)}>Cancel</Button>
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
