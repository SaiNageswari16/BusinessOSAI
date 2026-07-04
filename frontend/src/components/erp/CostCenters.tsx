import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Search, Plus, Edit2, X, Save, Loader2, Target, Building2, TrendingUp } from "lucide-react";
import { costCentersApi, departmentsApi, type CostCenter, type Department } from "@/lib/api-client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

function CostCenterFormModal({ cc, departments, onClose, onSaved }: {
  cc: CostCenter | null; departments: Department[]; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!cc;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    department_id: cc?.department_id ?? (departments[0]?.id ?? ""),
    code: cc?.code ?? "",
    name: cc?.name ?? "",
    budget_amount: cc?.budget_amount ?? 0,
    status: cc?.status ?? "active",
  });
  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...form, budget_amount: Number(form.budget_amount) };
      if (isEdit) { await costCentersApi.update(cc.id, payload); toast.success("Cost center updated"); }
      else { await costCentersApi.create(payload); toast.success("Cost center created"); }
      onSaved(); onClose();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg flex items-center gap-2"><Target className="size-5 text-primary" />{isEdit ? "Edit Cost Center" : "Add Cost Center"}</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5">Department *</label>
            <select value={form.department_id} onChange={set("department_id")} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5">Code *</label>
              <input value={form.code} onChange={set("code")} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                placeholder="CC-001" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Name *</label>
              <input value={form.name} onChange={set("name")} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Marketing Ops" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Budget (₹)</label>
              <input type="number" min="0" value={form.budget_amount} onChange={set("budget_amount")}
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

export function CostCenters() {
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editCC, setEditCC] = useState<CostCenter | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ccRes, dRes] = await Promise.all([costCentersApi.list(1, 100), departmentsApi.list(1, 100)]);
      setCostCenters(ccRes.items);
      setDepartments(dRes.items);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, []);

  const filtered = costCenters.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase()),
  );

  const deptMap = Object.fromEntries(departments.map((d) => [d.id, d.name]));

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Cost Centers</h2>
          <p className="text-sm text-muted-foreground">Track budgets and expenses by department and function.</p>
        </div>
        <Button className="gradient-brand text-white border-0 gap-2" onClick={() => { setEditCC(null); setShowForm(true); }}>
          <Plus className="size-4" /> Add Cost Center
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-4 text-sm rounded-lg border bg-card focus:ring-2 focus:ring-primary/20 outline-none"
          placeholder="Search cost centers..." />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-36 rounded-xl border bg-muted/30 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Target className="size-10 mx-auto mb-3 text-muted-foreground opacity-20" />
          <p className="text-sm text-muted-foreground">No cost centers yet</p>
          <Button size="sm" className="mt-4 gradient-brand text-white border-0" onClick={() => { setEditCC(null); setShowForm(true); }}>
            <Plus className="size-4 mr-1" /> Add Cost Center
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((cc) => {
            const utilization = cc.budget_amount > 0 ? Math.min(100, (cc.expense_amount / cc.budget_amount) * 100) : 0;
            const utilizationColor = utilization > 90 ? "bg-red-500" : utilization > 70 ? "bg-amber-500" : "bg-emerald-500";
            return (
              <Card key={cc.id} className="p-5 hover:shadow-md transition-shadow group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                      <Target className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">{cc.name}</h3>
                      <p className="text-[10px] font-mono text-muted-foreground">{cc.code}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="size-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => { setEditCC(cc); setShowForm(true); }}>
                    <Edit2 className="size-3.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                  <Building2 className="size-3" />{deptMap[cc.department_id] ?? "—"}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Budget</span>
                    <span className="font-mono font-semibold">₹{cc.budget_amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1"><TrendingUp className="size-3" /> Spent</span>
                    <span className="font-mono font-semibold">₹{cc.expense_amount.toLocaleString()}</span>
                  </div>
                  {cc.budget_amount > 0 && (
                    <div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", utilizationColor)}
                          style={{ width: `${utilization}%` }} />
                      </div>
                      <div className="text-[10px] text-right mt-0.5 text-muted-foreground">{utilization.toFixed(1)}% used</div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <CostCenterFormModal cc={editCC} departments={departments}
            onClose={() => { setShowForm(false); setEditCC(null); }} onSaved={load} />
        )}
      </AnimatePresence>
    </div>
  );
}
