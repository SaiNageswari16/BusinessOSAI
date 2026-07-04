import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Search, Plus, Edit2, Save, Loader2, Hash, Building2, RefreshCw } from "lucide-react";
import { numberSeriesApi, companiesApi, type NumberSeries, type Company } from "@/lib/api-client";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

function NumberSeriesFormModal({ ns, companies, onClose, onSaved }: {
  ns: NumberSeries | null; companies: Company[]; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!ns;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_id: ns?.company_id ?? (companies[0]?.id ?? ""),
    module_name: ns?.module_name ?? "",
    prefix: ns?.prefix ?? "",
    padding: ns?.padding ?? 5,
    current_number: ns?.current_number ?? 0,
    status: ns?.status ?? "active",
  });
  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...form, padding: Number(form.padding), current_number: Number(form.current_number) };
      if (isEdit) { await numberSeriesApi.update(ns.id, payload); toast.success("Number series updated"); }
      else { await numberSeriesApi.create(payload); toast.success("Number series created"); }
      onSaved(); onClose();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  };
  const preview = `${form.prefix}${String(Number(form.current_number) + 1).padStart(Number(form.padding), "0")}`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg flex items-center gap-2"><Hash className="size-5 text-primary" />{isEdit ? "Edit Number Series" : "Create Number Series"}</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {!isEdit && (
            <div>
              <label className="block text-xs font-semibold mb-1.5">Company *</label>
              <select value={form.company_id} onChange={set("company_id")} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold mb-1.5">Module Name *</label>
            <input value={form.module_name} onChange={set("module_name")} required disabled={isEdit}
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Purchase Order" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5">Prefix *</label>
              <input value={form.prefix} onChange={set("prefix")} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20 font-mono uppercase"
                placeholder="PO-" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Padding (zeros)</label>
              <select value={form.padding} onChange={set("padding")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
                {[3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n} digits</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Current Number</label>
              <input type="number" min="0" value={form.current_number} onChange={set("current_number")}
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
          <div className="bg-muted/50 rounded-xl p-4 text-center">
            <div className="text-xs text-muted-foreground mb-1">Next document number preview</div>
            <div className="text-xl font-black font-mono text-primary">{preview}</div>
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

export function NumberSeries() {
  const [series, setSeries] = useState<NumberSeries[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editNS, setEditNS] = useState<NumberSeries | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nsRes, cRes] = await Promise.all([numberSeriesApi.list(1, 100), companiesApi.list(1, 100)]);
      setSeries(nsRes.items);
      setCompanies(cRes.items);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, []);

  const filtered = series.filter((s) =>
    s.module_name.toLowerCase().includes(search.toLowerCase()) ||
    s.prefix.toLowerCase().includes(search.toLowerCase()),
  );

  const companyMap = Object.fromEntries(companies.map((c) => [c.id, c.name]));

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Number Series</h2>
          <p className="text-sm text-muted-foreground">Auto-incrementing document numbers for PO, SO, invoices, and more.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 h-9" onClick={load}><RefreshCw className={cn("size-4", loading && "animate-spin")} /> Refresh</Button>
          <Button className="gradient-brand text-white border-0 gap-2 h-9" onClick={() => { setEditNS(null); setShowForm(true); }}>
            <Plus className="size-4" /> New Series
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-4 text-sm rounded-lg border bg-card focus:ring-2 focus:ring-primary/20 outline-none"
          placeholder="Search by module or prefix..." />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 rounded-xl border bg-muted/30 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Hash className="size-10 mx-auto mb-3 text-muted-foreground opacity-20" />
          <p className="text-sm text-muted-foreground">No number series configured</p>
          <Button size="sm" className="mt-4 gradient-brand text-white border-0" onClick={() => { setEditNS(null); setShowForm(true); }}>
            <Plus className="size-4 mr-1" /> Create Series
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((ns) => {
            const nextNumber = `${ns.prefix}${String(ns.current_number + 1).padStart(ns.padding, "0")}`;
            return (
              <Card key={ns.id} className="p-5 hover:shadow-md transition-shadow group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                      <Hash className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">{ns.module_name}</h3>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="size-3" />{companyMap[ns.company_id] ?? "—"}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="size-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => { setEditNS(ns); setShowForm(true); }}>
                    <Edit2 className="size-3.5" />
                  </Button>
                </div>
                <div className="bg-muted/50 rounded-lg p-2.5 mb-3 text-center">
                  <div className="text-[10px] text-muted-foreground mb-0.5">Next Number</div>
                  <div className="font-black font-mono text-primary">{nextNumber}</div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Prefix: <span className="font-mono font-semibold text-foreground">{ns.prefix}</span></span>
                  <span>Current: <span className="font-mono font-semibold text-foreground">{ns.current_number}</span></span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <NumberSeriesFormModal ns={editNS} companies={companies}
            onClose={() => { setShowForm(false); setEditNS(null); }} onSaved={load} />
        )}
      </AnimatePresence>
    </div>
  );
}
