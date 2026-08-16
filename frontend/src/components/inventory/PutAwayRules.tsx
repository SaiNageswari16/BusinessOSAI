import { useState, useEffect, useMemo } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import {
  ArrowDownToLine, Plus, GripVertical, Trash2, X,
  Thermometer, Shield, Box, Package, Zap, Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { inventoryApi, type PutAwayRule, type Warehouse, type StorageLocation } from "../../lib/api-client";
import { useCurrency } from "@/hooks/use-currency";

type Condition = { field: string; op: string; value: string };

const CONDITIONS = ["product_category", "temperature_class", "weight", "hazmat", "perishable", "expiry_days"];
const OPS = ["is", "is_not", "contains", "greater_than", "less_than"];
const BIN_METHODS: { value: string; label: string; icon: any }[] = [
  { value: "first_available", label: "First Available",  icon: Box },
  { value: "closest",         label: "Closest to Entry", icon: Zap },
  { value: "stack",           label: "Stack (FIFO)",     icon: Package },
  { value: "assigned",        label: "Assigned Bin",     icon: Shield },
];
const SPECIAL = [
  "FIFO required", "LIFO required", "FEFO (expiry)", "Quarantine first",
  "Stack max 3 units", "Pallet-level only", "Temperature monitoring",
  "Hazmat isolation", "High-value lock", "Cold-chain mandatory",
];

function RuleModal({
  rule, onClose, onSave, zones, racks, saving,
}: {
  rule: Partial<PutAwayRule> | null;
  onClose: () => void;
  onSave: (r: Partial<PutAwayRule>) => void;
  zones: string[];
  racks: string[];
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<PutAwayRule>>(rule || {
    name: "", priority: 10, conditions: [], destination_zone: "",
    destination_rack: "", bin_assignment: "first_available", stacking_limit: 5,
    special_requirements: [], description: "", is_active: true,
  });
  const isEditing = !!rule?.id;

  const set = (k: keyof PutAwayRule, v: any) => setForm(p => ({ ...p, [k]: v }));

  const toggleCondition = (c: string) => {
    const cur = (form.conditions || []) as Condition[];
    set("conditions", cur.some(x => x.field === c) ? cur.filter(x => x.field !== c) : [...cur, { field: c, op: "is", value: "" }]);
  };
  const toggleSpecial = (s: string) => {
    const cur = form.special_requirements || [];
    set("special_requirements",
      cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s]
    );
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
          <h3 className="text-xl font-bold text-slate-900">{isEditing ? "Edit" : "New"} Put-Away Rule</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form id="rule-form" onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Rule Name *</label>
              <input required type="text" value={form.name || ""} onChange={e => set("name", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. Cold items go to Zone C" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Priority (lower = higher)</label>
              <input type="number" value={form.priority ?? 10} onChange={e => set("priority", Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" min={1} />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Bin Assignment</label>
              <select value={form.bin_assignment} onChange={e => set("bin_assignment", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                {BIN_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Destination Zone</label>
              <select value={form.destination_zone || ""} onChange={e => set("destination_zone", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                <option value="">— Select zone —</option>
                {zones.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Destination Rack</label>
              <select value={form.destination_rack || ""} onChange={e => set("destination_rack", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                <option value="">— Select rack —</option>
                {racks.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Stacking Limit</label>
              <input type="number" value={form.stacking_limit ?? 5} onChange={e => set("stacking_limit", Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" min={1} />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</label>
              <textarea value={form.description || ""} onChange={e => set("description", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                rows={2} placeholder="What does this rule do..." />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Conditions (match ALL)</label>
              <div className="flex flex-wrap gap-2">
                {CONDITIONS.map(c => {
                  const active = (form.conditions as Condition[] | undefined)?.some(x => x.field === c);
                  return (
                    <button key={c} type="button" onClick={() => toggleCondition(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                        active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                      }`}>
                      {c}
                    </button>
                  );
                })}
              </div>
              {((form.conditions as Condition[] | undefined) || []).map((cond, i) => (
                <div key={cond.field} className="flex gap-2 mt-2">
                  <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">{cond.field}</span>
                  <select value={cond.op} onChange={e => {
                    const next = [...((form.conditions || []) as Condition[])];
                    next[i] = { ...next[i], op: e.target.value };
                    set("conditions", next);
                  }} className="text-xs border rounded px-2 bg-white">
                    {OPS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <input value={cond.value} onChange={e => {
                    const next = [...((form.conditions || []) as Condition[])];
                    next[i] = { ...next[i], value: e.target.value };
                    set("conditions", next);
                  }} placeholder="value" className="text-xs border rounded px-2 flex-1" />
                </div>
              ))}
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Special Requirements</label>
              <div className="flex flex-wrap gap-2">
                {SPECIAL.map(s => {
                  const active = form.special_requirements?.includes(s);
                  return (
                    <button key={s} type="button" onClick={() => toggleSpecial(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                        active ? "bg-amber-100 text-amber-700 border-amber-300" : "bg-white text-slate-600 border-slate-200"
                      }`}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer col-span-2">
              <input type="checkbox" checked={form.is_active ?? true} onChange={e => set("is_active", e.target.checked)}
                className="accent-indigo-600" />
              <span className="font-medium">Active</span>
            </label>
          </div>
        </form>

        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg">Cancel</button>
          <button type="submit" form="rule-form" disabled={saving}
            className="px-8 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-600/20 disabled:opacity-50 inline-flex items-center gap-2">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {rule?.id ? "Update" : "Create"} Rule
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function PutAwayRules() {
    const { currency, formatCurrency } = useCurrency();
  const [rules, setRules] = useState<PutAwayRule[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<PutAwayRule> | null>(null);

  const loadAll = async () => {
    try {
      setLoading(true);
      setError(null);
      const [r, locs, whs] = await Promise.all([
        inventoryApi.getPutAwayRules(),
        inventoryApi.getStorageLocations(),
        inventoryApi.getWarehouses(),
      ]);
      setRules(r);
      setLocations(locs);
      setWarehouses(whs);
    } catch (e: any) {
      setError(e?.detail ?? "Failed to load rules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const handleSave = async (r: Partial<PutAwayRule>) => {
    try {
      setSaving(true);
      if (r.id) {
        const updated = await inventoryApi.updatePutAwayRule(r.id, r);
        setRules(prev => prev.map(x => x.id === r.id ? updated : x));
      } else {
        const created = await inventoryApi.createPutAwayRule(r as Record<string, unknown>);
        setRules(prev => [created, ...prev]);
      }
      setModalOpen(false);
      setEditingRule(null);
    } catch (e: any) {
      alert(`Save failed: ${e?.detail ?? e?.message ?? "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (rule: PutAwayRule) => {
    setEditingRule(rule);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this rule?")) return;
    try {
      await inventoryApi.deletePutAwayRule(id);
      setRules(prev => prev.filter(r => r.id !== id));
    } catch (e: any) {
      alert(`Delete failed: ${e?.detail ?? e?.message}`);
    }
  };

  const toggleActive = async (rule: PutAwayRule) => {
    try {
      const updated = await inventoryApi.updatePutAwayRule(rule.id, { is_active: !rule.is_active });
      setRules(prev => prev.map(r => r.id === rule.id ? updated : r));
    } catch (e: any) {
      alert(`Toggle failed: ${e?.detail ?? e?.message}`);
    }
  };

  const zones = useMemo(() => {
    const inDb = new Set<string>(locations.map(l => l.zone).filter(Boolean) as string[]);
    const inRules = new Set<string>(rules.map(r => r.destination_zone).filter(Boolean) as string[]);
    return Array.from(new Set([...inDb, ...inRules])).sort();
  }, [locations, rules]);

  const racks = useMemo(() => {
    const inDb = new Set<string>(locations.map(l => l.rack).filter(Boolean) as string[]);
    const inRules = new Set<string>(rules.map(r => r.destination_rack).filter(Boolean) as string[]);
    return Array.from(new Set([...inDb, ...inRules])).sort();
  }, [locations, rules]);

  const activeCount = rules.filter(r => r.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Put-Away Rules</h2>
          <p className="text-sm text-muted-foreground">Configure where incoming stock is automatically placed in the warehouse.</p>
        </div>
        <Button onClick={() => { setEditingRule(null); setModalOpen(true); }} className="gradient-brand text-white border-0">
          <Plus className="size-4 mr-2" /> Add Rule
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
          <button onClick={loadAll} className="ml-3 underline">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>
      ) : rules.length === 0 ? (
        <Card className="p-12 text-center bg-muted/20 border-dashed">
          <ArrowDownToLine className="size-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No put-away rules yet</h3>
          <p className="text-muted-foreground mb-4">Rules define where incoming stock should be stored based on product attributes.</p>
          <Button onClick={() => setModalOpen(true)} className="gradient-brand text-white border-0">
            <Plus className="size-4 mr-2" /> Create First Rule
          </Button>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Total Rules</div>
              <div className="text-2xl font-bold mt-1">{rules.length}</div>
            </Card>
            <Card className="p-4">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Active</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</div>
            </Card>
            <Card className="p-4">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Inactive</div>
              <div className="text-2xl font-bold text-muted-foreground mt-1">{rules.length - activeCount}</div>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Rule Name</th>
                  <th className="px-4 py-3">Conditions</th>
                  <th className="px-4 py-3">Destination</th>
                  <th className="px-4 py-3">Bin Method</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rules.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                        {r.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{r.name}</div>
                      {r.description && <div className="text-[11px] text-muted-foreground mt-0.5">{r.description}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.conditions.length === 0 ? <span className="text-xs text-muted-foreground italic">All items</span>
                          : (r.conditions as Condition[]).map(c => (
                            <span key={c.field} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                              {c.field} {c.op} {c.value || "?"}
                            </span>
                          ))
                        }
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium">
                        {r.destination_zone || "—"}{r.destination_rack ? ` / ${r.destination_rack}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground capitalize">{r.bin_assignment.replace("_", " ")}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActive(r)}
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                          r.is_active ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" : "bg-slate-200 text-slate-500 hover:bg-slate-300"
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${r.is_active ? "bg-emerald-500" : "bg-slate-400"}`} />
                        {r.is_active ? "Active" : "Paused"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleEdit(r)}
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
          <RuleModal rule={editingRule} onClose={() => { setModalOpen(false); setEditingRule(null); }}
            onSave={handleSave} zones={zones} racks={racks} saving={saving} />
        )}
      </AnimatePresence>
    </div>
  );
}
