import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Search, Plus, Edit2, Trash2, X, Save, Loader2, AlertCircle, Clock, CreditCard } from "lucide-react";
import { paymentTermsApi, type PaymentTerm } from "@/lib/api-client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

function PaymentTermFormModal({ term, onClose, onSaved }: { term: PaymentTerm | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!term;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: term?.name ?? "",
    days: term?.days ?? 30,
    credit_limit: term?.credit_limit ?? "",
    late_fee_percent: term?.late_fee_percent ?? "",
    status: term?.status ?? "active",
  });
  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = {
        name: form.name,
        days: Number(form.days),
        credit_limit: form.credit_limit !== "" ? Number(form.credit_limit) : null,
        late_fee_percent: form.late_fee_percent !== "" ? Number(form.late_fee_percent) : null,
        status: form.status,
      };
      if (isEdit) { await paymentTermsApi.update(term.id, payload); toast.success("Payment term updated"); }
      else { await paymentTermsApi.create(payload); toast.success("Payment term created"); }
      onSaved(); onClose();
    } catch (err) { console.error(err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg flex items-center gap-2"><CreditCard className="size-5 text-primary" />{isEdit ? "Edit Payment Term" : "Add Payment Term"}</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5">Term Name *</label>
            <input value={form.name} onChange={set("name")} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Net 30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5">Payment Days *</label>
              <input type="number" min="0" value={form.days} onChange={set("days")} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Credit Limit (₹)</label>
              <input type="number" min="0" value={form.credit_limit} onChange={set("credit_limit")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Optional" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Late Fee (%)</label>
              <input type="number" step="0.01" min="0" value={form.late_fee_percent} onChange={set("late_fee_percent")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Optional" />
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

export function PaymentTerms() {
  const [terms, setTerms] = useState<PaymentTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editTerm, setEditTerm] = useState<PaymentTerm | null>(null);
  const [deleteTerm, setDeleteTerm] = useState<PaymentTerm | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await paymentTermsApi.list(1, 100);
      setTerms(res.items);
    } catch (err) { console.error(err instanceof Error ? err.message : "Failed"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, []);

  const filtered = terms.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));

  const handleDelete = async () => {
    if (!deleteTerm) return;
    setDeleting(true);
    try {
      await paymentTermsApi.delete(deleteTerm.id);
      toast.success("Payment term deleted");
      setDeleteTerm(null);
      void load();
    } catch (err) { console.error(err instanceof Error ? err.message : "Failed"); }
    finally { setDeleting(false); }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Payment Terms</h2>
          <p className="text-sm text-muted-foreground">Define credit terms, payment windows, and late fee policies.</p>
        </div>
        <Button className="gradient-brand text-white border-0 gap-2" onClick={() => { setEditTerm(null); setShowForm(true); }}>
          <Plus className="size-4" /> Add Term
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-4 text-sm rounded-lg border bg-card focus:ring-2 focus:ring-primary/20 outline-none"
          placeholder="Search payment terms..." />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 rounded-xl border bg-muted/30 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <CreditCard className="size-10 mx-auto mb-3 text-muted-foreground opacity-20" />
          <p className="text-sm text-muted-foreground">No payment terms configured</p>
          <Button size="sm" className="mt-4 gradient-brand text-white border-0" onClick={() => { setEditTerm(null); setShowForm(true); }}>
            <Plus className="size-4 mr-1" /> Add Payment Term
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((term) => (
            <Card key={term.id} className="p-5 hover:shadow-md transition-shadow group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-blue-500/10 text-blue-600 font-bold text-sm grid place-items-center">
                    <Clock className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold">{term.name}</h3>
                    <p className="text-xs text-muted-foreground">{term.days} days</p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => { setEditTerm(term); setShowForm(true); }}><Edit2 className="size-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="size-7 text-red-500" onClick={() => setDeleteTerm(term)}><Trash2 className="size-3.5" /></Button>
                </div>
              </div>
              <div className="space-y-1.5 text-xs">
                {term.credit_limit !== null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Credit Limit</span>
                    <span className="font-mono font-semibold">₹{term.credit_limit.toLocaleString()}</span>
                  </div>
                )}
                {term.late_fee_percent !== null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Late Fee</span>
                    <span className="font-mono font-semibold">{term.late_fee_percent}%</span>
                  </div>
                )}
              </div>
              <div className="mt-3">
                <span className={cn("text-[10px] font-medium", term.status === "active" ? "text-emerald-600" : "text-muted-foreground")}>
                  {term.status.charAt(0).toUpperCase() + term.status.slice(1)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <PaymentTermFormModal term={editTerm}
            onClose={() => { setShowForm(false); setEditTerm(null); }} onSaved={load} />
        )}
        {deleteTerm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-card border rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-lg bg-red-500/10 text-red-500 grid place-items-center"><AlertCircle className="size-5" /></div>
                <h3 className="font-bold">Delete Payment Term</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">Delete <span className="font-semibold text-foreground">{deleteTerm.name}</span>?</p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteTerm(null)}>Cancel</Button>
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
