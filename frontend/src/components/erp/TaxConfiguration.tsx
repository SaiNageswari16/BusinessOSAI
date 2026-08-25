import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Search, Plus, Edit2, Trash2, X, Save, Loader2, AlertCircle, Percent, Building2 } from "lucide-react";
import { taxConfigurationsApi, companiesApi, type TaxConfiguration, type Company } from "@/lib/api-client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const TAX_TYPES = ["GST", "IGST", "SGST", "CGST", "VAT", "Service Tax", "TDS", "Custom"];

function TaxFormModal({ tax, companies, onClose, onSaved }: {
  tax: TaxConfiguration | null; companies: Company[]; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!tax;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_id: tax?.company_id ?? (companies[0]?.id ?? ""),
    name: tax?.name ?? "",
    tax_type: tax?.tax_type ?? "GST",
    rate_percent: tax?.rate_percent ?? 18,
    components: tax?.components ?? "",
    status: tax?.status ?? "active",
  });
  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...form, rate_percent: Number(form.rate_percent), components: form.components || null };
      if (isEdit) { await taxConfigurationsApi.update(tax.id, payload); toast.success("Tax configuration updated"); }
      else { await taxConfigurationsApi.create(payload); toast.success("Tax configuration created"); }
      onSaved(); onClose();
    } catch (err) { console.error(err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg flex items-center gap-2"><Percent className="size-5 text-primary" />{isEdit ? "Edit Tax Config" : "Add Tax Configuration"}</h2>
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
            <label className="block text-xs font-semibold mb-1.5">Tax Name *</label>
            <input value={form.name} onChange={set("name")} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="GST 18%" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5">Tax Type *</label>
              <select value={form.tax_type} onChange={set("tax_type")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
                {TAX_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Rate (%) *</label>
              <input type="number" step="0.01" min="0" max="100" value={form.rate_percent} onChange={set("rate_percent")} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1.5">Components (JSON or description)</label>
              <textarea value={form.components} onChange={set("components")} rows={2}
                className="w-full px-3 py-2 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20 resize-none font-mono"
                placeholder='SGST: 9%, CGST: 9%' />
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

export function TaxConfiguration() {
  const [taxes, setTaxes] = useState<TaxConfiguration[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editTax, setEditTax] = useState<TaxConfiguration | null>(null);
  const [deleteTax, setDeleteTax] = useState<TaxConfiguration | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, cRes] = await Promise.all([taxConfigurationsApi.list(1, 100), companiesApi.list(1, 100)]);
      setTaxes(tRes.items);
      setCompanies(cRes.items);
    } catch (err) { console.error(err instanceof Error ? err.message : "Failed"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, []);

  const filtered = taxes.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.tax_type.toLowerCase().includes(search.toLowerCase()),
  );

  const companyMap = Object.fromEntries(companies.map((c) => [c.id, c.name]));

  const handleDelete = async () => {
    if (!deleteTax) return;
    setDeleting(true);
    try {
      await taxConfigurationsApi.delete(deleteTax.id);
      toast.success("Tax configuration deleted");
      setDeleteTax(null);
      void load();
    } catch (err) { console.error(err instanceof Error ? err.message : "Failed"); }
    finally { setDeleting(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold tracking-tight">Tax Configuration</h2>
          <p className="text-xs text-muted-foreground">Define GST, VAT, TDS, and other tax rules for your companies.</p>
        </div>
        <Button size="sm" className="h-8 gradient-brand text-white border-0 gap-1.5 text-xs font-semibold" onClick={() => { setEditTax(null); setShowForm(true); }}>
          <Plus className="size-3.5" /> Add Tax Config
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-4 text-sm rounded-lg border bg-card focus:ring-2 focus:ring-primary/20 outline-none"
          placeholder="Search tax configurations..." />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 rounded-xl border bg-muted/30 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Percent className="size-10 mx-auto mb-3 text-muted-foreground opacity-20" />
          <p className="text-sm text-muted-foreground">No tax configurations yet</p>
          <Button size="sm" className="mt-4 gradient-brand text-white border-0" onClick={() => { setEditTax(null); setShowForm(true); }}>
            <Plus className="size-4 mr-1" /> Add Tax Configuration
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((tax) => (
            <Card key={tax.id} className="p-5 hover:shadow-md transition-shadow group">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-amber-500/10 text-amber-600 grid place-items-center font-bold text-sm">
                    {tax.rate_percent}%
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">{tax.name}</h3>
                    <span className="text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{tax.tax_type}</span>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => { setEditTax(tax); setShowForm(true); }}><Edit2 className="size-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="size-7 text-red-500" onClick={() => setDeleteTax(tax)}><Trash2 className="size-3.5" /></Button>
                </div>
              </div>
              {tax.components && (
                <p className="text-xs text-muted-foreground font-mono mb-2 line-clamp-2">{tax.components}</p>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Building2 className="size-3" />{companyMap[tax.company_id] ?? "—"}
              </div>
              <div className="mt-2">
                <span className={cn("text-[10px] font-medium", tax.status === "active" ? "text-emerald-600" : "text-muted-foreground")}>
                  {tax.status.charAt(0).toUpperCase() + tax.status.slice(1)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <TaxFormModal tax={editTax} companies={companies}
            onClose={() => { setShowForm(false); setEditTax(null); }} onSaved={load} />
        )}
        {deleteTax && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-card border rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-lg bg-red-500/10 text-red-500 grid place-items-center"><AlertCircle className="size-5" /></div>
                <h3 className="font-bold">Delete Tax Configuration</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">Delete <span className="font-semibold text-foreground">{deleteTax.name}</span>?</p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteTax(null)}>Cancel</Button>
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
