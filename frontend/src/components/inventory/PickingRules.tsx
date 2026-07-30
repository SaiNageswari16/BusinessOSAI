import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import {
  ListChecks, Plus, Trash2, X, AlertTriangle, Truck, Split, Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { inventoryApi, type PickingRule } from "../../lib/api-client";

const STRATEGIES: { value: string; label: string; description: string }[] = [
  { value: "discrete",     label: "Discrete",     description: "Pick one order at a time" },
  { value: "batch",        label: "Batch",        description: "Multiple orders in single pick walk" },
  { value: "zone",         label: "Zone",         description: "Per-zone picking pass" },
  { value: "wave",         label: "Wave",         description: "Time-window scheduled release" },
  { value: "cluster",      label: "Cluster",      description: "Pick to cart, sort centrally" },
  { value: "single_order", label: "Single Order", description: "One order at a time, hand-off" },
];

const ORDER_RULES: { value: string; label: string; description: string }[] = [
  { value: "by_order_value", label: "By Order Value", description: "Highest value first" },
  { value: "by_priority",    label: "By Priority",    description: "Order priority score" },
  { value: "by_shipping",    label: "By Shipping",    description: "Express before standard" },
  { value: "by_customer",    label: "By Customer",    description: "Group by customer" },
  { value: "by_aging",       label: "By Aging",       description: "Oldest orders first (FIFO)" },
];

const ZONE_PRESETS = ["Receiving", "Storage", "Pick & Pack", "Dispatch", "Returns", "Quarantine", "Cold Storage", "Hazmat"];

function RuleModal({
  rule, onClose, onSave, saving,
}: { rule: Partial<PickingRule> | null; onClose: () => void; onSave: (r: Partial<PickingRule>) => void; saving: boolean; }) {
  const [form, setForm] = useState<Partial<PickingRule>>(rule || {
    name: "", strategy: "discrete", order_rule: "by_aging", batch_size: 10,
    zone_priority: [], exclude_hazmat: true, allow_partial: false, auto_release: false,
    description: "", is_active: true,
  });
  const isEditing = !!rule?.id;
  const set = (k: keyof PickingRule, v: any) => setForm(p => ({ ...p, [k]: v }));

  const toggleZone = (z: string) => {
    const cur = form.zone_priority || [];
    set("zone_priority", cur.includes(z) ? cur.filter(x => x !== z) : [...cur, z]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return alert("Rule name is required.");
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
          <h3 className="text-xl font-bold text-slate-900">{isEditing ? "Edit" : "New"} Picking Rule</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        <form id="pickrule-form" onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Rule Name *</label>
              <input required type="text" value={form.name || ""} onChange={e => set("name", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. Express pickup — Wave 1 (10am)" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Strategy</label>
              <select value={form.strategy} onChange={e => set("strategy", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                {STRATEGIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {STRATEGIES.find(s => s.value === form.strategy)?.description}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Order Rule</label>
              <select value={form.order_rule} onChange={e => set("order_rule", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                {ORDER_RULES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {ORDER_RULES.find(r => r.value === form.order_rule)?.description}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Batch Size</label>
              <input type="number" min={1} value={form.batch_size ?? 10} onChange={e => set("batch_size", Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              <p className="mt-1 text-[11px] text-muted-foreground">Max orders per pick walk.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Zone Priority</label>
              <div className="flex flex-wrap gap-1">
                {ZONE_PRESETS.map(z => {
                  const active = form.zone_priority?.includes(z);
                  return (
                    <button key={z} type="button" onClick={() => toggleZone(z)}
                      className={`px-2 py-1 rounded text-[11px] font-semibold transition border ${
                        active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"
                      }`}>
                      {z}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</label>
              <textarea value={form.description || ""} onChange={e => set("description", e.target.value)}
                rows={2}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.exclude_hazmat ?? true} onChange={e => set("exclude_hazmat", e.target.checked)} className="accent-indigo-600" />
              <span className="font-medium">Exclude hazmat from batches</span>
            </label>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.allow_partial ?? false} onChange={e => set("allow_partial", e.target.checked)} className="accent-indigo-600" />
              <span className="font-medium">Allow partial picks</span>
            </label>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.auto_release ?? false} onChange={e => set("auto_release", e.target.checked)} className="accent-indigo-600" />
              <span className="font-medium">Auto-release to floor</span>
            </label>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.is_active ?? true} onChange={e => set("is_active", e.target.checked)} className="accent-indigo-600" />
              <span className="font-medium">Active</span>
            </label>
          </div>
        </form>

        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg">Cancel</button>
          <button type="submit" form="pickrule-form" disabled={saving}
            className="px-8 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-600/20 disabled:opacity-50 inline-flex items-center gap-2">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {rule?.id ? "Update" : "Create"} Rule
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function PickingRules() {
  const [rules, setRules] = useState<PickingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<PickingRule> | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await inventoryApi.getPickingRules();
      setRules(data);
    } catch (e: any) {
      setError(e?.detail ?? "Failed to load picking rules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (r: Partial<PickingRule>) => {
    try {
      setSaving(true);
      if (r.id) {
        const updated = await inventoryApi.updatePickingRule(r.id, r);
        setRules(prev => prev.map(x => x.id === r.id ? updated : x));
      } else {
        const created = await inventoryApi.createPickingRule(r as Record<string, unknown>);
        setRules(prev => [created, ...prev]);
      }
      setModalOpen(false);
      setEditing(null);
    } catch (e: any) {
      alert(`Save failed: ${e?.detail ?? e?.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this picking rule?")) return;
    try {
      await inventoryApi.deletePickingRule(id);
      setRules(prev => prev.filter(r => r.id !== id));
    } catch (e: any) {
      alert(`Delete failed: ${e?.detail ?? e?.message}`);
    }
  };

  const toggleActive = async (rule: PickingRule) => {
    try {
      const updated = await inventoryApi.updatePickingRule(rule.id, { is_active: !rule.is_active });
      setRules(prev => prev.map(r => r.id === rule.id ? updated : r));
    } catch (e: any) {
      alert(`Toggle failed: ${e?.detail ?? e?.message}`);
    }
  };

  const activeCount = rules.filter(r => r.is_active).length;
  const byStrategy = new Map<string, number>();
  rules.forEach(r => byStrategy.set(r.strategy, (byStrategy.get(r.strategy) || 0) + 1));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Picking Rules</h2>
          <p className="text-sm text-muted-foreground">Configure how orders are routed through your pick-and-pack workflow.</p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="gradient-brand text-white border-0">
          <Plus className="size-4 mr-2" /> Add Rule
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
          <button onClick={load} className="ml-3 underline">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>
      ) : rules.length === 0 ? (
        <Card className="p-12 text-center bg-muted/20 border-dashed">
          <ListChecks className="size-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No picking rules yet</h3>
          <p className="text-muted-foreground mb-4">Configure strategies for how orders are picked from inventory.</p>
          <Button onClick={() => setModalOpen(true)} className="gradient-brand text-white border-0">
            <Plus className="size-4 mr-2" /> Create First Rule
          </Button>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Total Rules</div>
              <div className="text-2xl font-bold mt-1">{rules.length}</div>
            </Card>
            <Card className="p-4">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Active</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</div>
            </Card>
            <Card className="p-4">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Total Batch Cap.</div>
              <div className="text-2xl font-bold mt-1">{rules.reduce((s, r) => s + r.batch_size, 0)}</div>
            </Card>
            <Card className="p-4">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Strategies</div>
              <div className="text-2xl font-bold mt-1">{byStrategy.size}</div>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-3">Rule Name</th>
                  <th className="px-6 py-3">Strategy</th>
                  <th className="px-6 py-3">Order By</th>
                  <th className="px-6 py-3 text-right">Batch</th>
                  <th className="px-6 py-3">Zones</th>
                  <th className="px-6 py-3">Options</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rules.map(r => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-6 py-3">
                      <div className="font-semibold">{r.name}</div>
                      {r.description && <div className="text-[11px] text-muted-foreground mt-0.5">{r.description}</div>}
                    </td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/10 text-indigo-600 capitalize">
                        {r.strategy.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs capitalize">
                      {ORDER_RULES.find(x => x.value === r.order_rule)?.label}
                    </td>
                    <td className="px-6 py-3 text-right font-mono">{r.batch_size}</td>
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.zone_priority.length === 0 ? <span className="text-xs italic text-muted-foreground">All zones</span>
                          : r.zone_priority.slice(0, 3).map(z => (
                            <span key={z} className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-muted">{z}</span>
                          ))
                        }
                        {r.zone_priority.length > 3 && <span className="text-[10px] text-muted-foreground">+{r.zone_priority.length - 3}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.exclude_hazmat && <span title="Hazmat excluded" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600"><AlertTriangle className="size-3" /> Hz</span>}
                        {r.allow_partial && <span title="Allow partial" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600"><Split className="size-3" /> Partial</span>}
                        {r.auto_release && <span title="Auto-release" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600"><Truck className="size-3" /> Auto</span>}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <button onClick={() => toggleActive(r)}
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                          r.is_active ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" : "bg-slate-200 text-slate-500 hover:bg-slate-300"
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${r.is_active ? "bg-emerald-500" : "bg-slate-400"}`} />
                        {r.is_active ? "Active" : "Paused"}
                      </button>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditing(r); setModalOpen(true); }}
                          className="h-8 w-8 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 inline-flex items-center justify-center transition"
                          title="Edit">
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </button>
                        <button onClick={() => handleDelete(r.id)}
                          className="h-8 w-8 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 inline-flex items-center justify-center transition"
                          title="Delete">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <AnimatePresence>
        {modalOpen && (
          <RuleModal rule={editing} onClose={() => { setModalOpen(false); setEditing(null); }}
            onSave={handleSave} saving={saving} />
        )}
      </AnimatePresence>
    </div>
  );
}
