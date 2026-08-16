import { useState, useEffect, useCallback } from "react";
import { automationRulesApi, AutomationRule } from "../../lib/api-client";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Search, Plus, Zap, Edit2, Trash2, Loader2, Play, Pause } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

const MODULES = ["HR", "Finance", "Purchase", "Sales", "Inventory", "General"];
const TRIGGER_EVENTS = [
  "employee.created", "employee.updated", "leave.submitted", "payslip.generated",
  "order.created", "invoice.overdue", "user.login", "budget.exceeded",
];

function RuleDialog({ open, onClose, initial, onSaved }: {
  open: boolean; onClose: () => void; initial?: AutomationRule; onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [module, setModule] = useState(initial?.module ?? "General");
  const [triggerEvent, setTriggerEvent] = useState(initial?.trigger_event ?? TRIGGER_EVENTS[0]);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? ""); setModule(initial?.module ?? "General");
      setTriggerEvent(initial?.trigger_event ?? TRIGGER_EVENTS[0]);
      setIsActive(initial?.is_active ?? true); setError("");
    }
  }, [open, initial]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setLoading(true); setError("");
    try {
      const data = { name, module, trigger_event: triggerEvent, is_active: isActive, status: "active" };
      if (initial) await automationRulesApi.update(initial.id, data);
      else await automationRulesApi.create(data);
      onSaved(); onClose();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to save"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-md p-6 shadow-2xl">
        <h3 className="text-lg font-bold mb-4">{initial ? "Edit" : "Create"} Automation Rule</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Rule Name *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Notify HR on New Employee" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Module</label>
              <select value={module} onChange={e => setModule(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                {MODULES.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Trigger Event</label>
              <select value={triggerEvent} onChange={e => setTriggerEvent(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                {TRIGGER_EVENTS.map(ev => <option key={ev}>{ev}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="rule-active" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="h-4 w-4 rounded" />
            <label htmlFor="rule-active" className="text-sm">Rule is active</label>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1 gradient-brand text-white border-0" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : (initial ? "Update" : "Create")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function AutomationRules() {
    const { currency, formatCurrency } = useCurrency();
  const [items, setItems] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AutomationRule | undefined>();
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await automationRulesApi.list(page, 20, search || undefined, moduleFilter || undefined);
      setItems(res.items); setTotal(res.total);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [page, search, moduleFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this rule?")) return;
    setDeleting(id);
    try { await automationRulesApi.delete(id); load(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : "Delete failed"); }
    finally { setDeleting(null); }
  };

  const handleToggle = async (rule: AutomationRule) => {
    try { await automationRulesApi.update(rule.id, { is_active: !rule.is_active }); load(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : "Update failed"); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Automation Rules</h2>
          <p className="text-sm text-muted-foreground">Trigger-based business process automation. <span className="font-medium text-primary">{total} total</span></p>
        </div>
        <Button className="gradient-brand text-white border-0" onClick={() => { setEditing(undefined); setDialogOpen(true); }}>
          <Plus className="size-4 mr-2" /> Create Rule
        </Button>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
            placeholder="Search rules..." />
        </div>
        <select value={moduleFilter} onChange={e => { setModuleFilter(e.target.value); setPage(1); }}
          className="h-10 px-3 text-sm rounded-lg border bg-card">
          <option value="">All Modules</option>
          {MODULES.map(m => <option key={m}>{m}</option>)}
        </select>
      </div>

      {loading && <div className="flex items-center justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>}
      {error && <div className="p-4 rounded-xl bg-red-500/10 text-red-600 text-sm border border-red-500/20">{error}</div>}

      {!loading && !error && (
        <div className="space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Zap className="size-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No automation rules</p>
              <p className="text-sm">Create rules to automate repetitive business processes.</p>
            </div>
          ) : items.map(rule => (
            <Card key={rule.id} className="p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
              <div className={`size-10 rounded-lg grid place-items-center shrink-0 ${rule.is_active ? "bg-amber-500/10 text-amber-600" : "bg-muted text-muted-foreground"}`}>
                <Zap className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-semibold text-sm">{rule.name}</h3>
                  <span className="text-[10px] bg-muted px-2 py-0.5 rounded font-medium">{rule.module}</span>
                </div>
                <p className="text-xs text-muted-foreground font-mono">Trigger: {rule.trigger_event}</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                <div className="text-center">
                  <p className="font-bold text-foreground">{rule.run_count}</p>
                  <p>runs</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => handleToggle(rule)}>
                    {rule.is_active ? <Pause className="size-3.5 text-amber-600" /> : <Play className="size-3.5 text-emerald-600" />}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => { setEditing(rule); setDialogOpen(true); }}>
                    <Edit2 className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-red-600" onClick={() => handleDelete(rule.id)} disabled={deleting === rule.id}>
                    {deleting === rule.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <span className="text-sm text-muted-foreground self-center">Page {page}</span>
          <Button variant="outline" size="sm" disabled={items.length < 20} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      <RuleDialog open={dialogOpen} onClose={() => setDialogOpen(false)} initial={editing} onSaved={load} />
    </div>
  );
}
