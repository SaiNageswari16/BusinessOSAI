import React, { useEffect, useState } from "react";
import {
  Plus,
  Search,
  Trash2,
  X,
  Target,
  RefreshCw,
  Users,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { crmSegmentsApi, type CrmSegment } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";

type Condition = {
  attribute: string;
  operator: string;
  value: string;
};

type ConditionGroup = {
  combinator: "AND" | "OR";
  conditions: Condition[];
};

const ATTRIBUTES = [
  { key: "total_lifetime_value", label: "Lifetime Value", type: "number" },
  { key: "total_orders", label: "Total Orders", type: "number" },
  { key: "wallet_balance", label: "Wallet Balance", type: "number" },
  { key: "loyalty_points", label: "Loyalty Points", type: "number" },
  { key: "outstanding_balance", label: "Outstanding Balance", type: "number" },
  { key: "credit_limit", label: "Credit Limit", type: "number" },
  { key: "last_order_at", label: "Last Order Date", type: "date" },
  { key: "city", label: "City", type: "string" },
  { key: "state", label: "State", type: "string" },
  { key: "customer_type", label: "Customer Type", type: "string" },
  { key: "status", label: "Status", type: "string" },
  { key: "source", label: "Source", type: "string" },
  { key: "rating", label: "Rating", type: "number" },
];

const OPERATORS_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  number: [
    { value: "eq", label: "= equals" },
    { value: "ne", label: "≠ not equal" },
    { value: "gt", label: "> greater than" },
    { value: "gte", label: "≥ greater or equal" },
    { value: "lt", label: "< less than" },
    { value: "lte", label: "≤ less or equal" },
    { value: "between", label: "between (comma separated)" },
  ],
  string: [
    { value: "eq", label: "= equals" },
    { value: "ne", label: "≠ not equal" },
    { value: "contains", label: "contains" },
    { value: "starts_with", label: "starts with" },
    { value: "ends_with", label: "ends with" },
    { value: "in", label: "in (comma list)" },
  ],
  date: [
    { value: "eq", label: "= equals" },
    { value: "gt", label: "> after" },
    { value: "lt", label: "< before" },
    { value: "within_days", label: "within last N days" },
  ],
};

const blankSegment = {
  name: "",
  description: "",
  is_dynamic: true,
  is_active: true,
  criteria: { groups: [{ combinator: "AND" as const, conditions: [] }] },
};

export function CustomerSegments() {
    const { currency, formatCurrency } = useCurrency();
  const [segments, setSegments] = useState<CrmSegment[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(blankSegment);
  const [preview, setPreview] = useState<{ id: string; count: number } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await crmSegmentsApi.list(1, 100, search || undefined);
      setSegments(response.items);
      setTotal(response.total);
    } catch {
      toast.error("Could not load segments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const getGroups = (): ConditionGroup[] => {
    const f = form.criteria as { groups: ConditionGroup[] };
    return f.groups || [];
  };

  const updateGroups = (groups: ConditionGroup[]) => {
    setForm({ ...form, criteria: { groups } });
  };

  const addGroup = () => {
    const groups = getGroups();
    updateGroups([...groups, { combinator: "AND", conditions: [] }]);
  };

  const removeGroup = (idx: number) => {
    const groups = getGroups();
    updateGroups(groups.filter((_, i) => i !== idx));
  };

  const updateGroupCombinator = (idx: number, combinator: "AND" | "OR") => {
    const groups = getGroups();
    const newGroups = [...groups];
    newGroups[idx] = { ...newGroups[idx], combinator };
    updateGroups(newGroups);
  };

  const addCondition = (groupIdx: number) => {
    const groups = getGroups();
    const newGroups = [...groups];
    const attr = ATTRIBUTES[0];
    newGroups[groupIdx] = {
      ...newGroups[groupIdx],
      conditions: [...newGroups[groupIdx].conditions, { attribute: attr.key, operator: "eq", value: "" }],
    };
    updateGroups(newGroups);
  };

  const updateCondition = (groupIdx: number, condIdx: number, partial: Partial<Condition>) => {
    const groups = getGroups();
    const newGroups = [...groups];
    const newConds = [...newGroups[groupIdx].conditions];
    newConds[condIdx] = { ...newConds[condIdx], ...partial };
    newGroups[groupIdx] = { ...newGroups[groupIdx], conditions: newConds };
    updateGroups(newGroups);
  };

  const removeCondition = (groupIdx: number, condIdx: number) => {
    const groups = getGroups();
    const newGroups = [...groups];
    newGroups[groupIdx] = {
      ...newGroups[groupIdx],
      conditions: newGroups[groupIdx].conditions.filter((_, i) => i !== condIdx),
    };
    updateGroups(newGroups);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        is_dynamic: form.is_dynamic,
        is_active: form.is_active,
        criteria: form.criteria,
      };
      if (editingId) {
        const updated = await crmSegmentsApi.update(editingId, payload);
        setSegments((curr) => curr.map((s) => (s.id === editingId ? updated : s)));
        toast.success("Segment updated");
      } else {
        const created = await crmSegmentsApi.create(payload);
        setSegments((curr) => [created, ...curr]);
        setTotal((t) => t + 1);
        toast.success("Segment created");
      }
      setShowForm(false);
      setForm(blankSegment);
      setEditingId(null);
    } catch {
      toast.error("Could not save segment");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (segment: CrmSegment) => {
    setEditingId(segment.id);
    setForm({
      name: segment.name,
      description: segment.description || "",
      is_dynamic: segment.is_dynamic,
      is_active: segment.is_active,
      criteria: segment.criteria as { groups: ConditionGroup[] },
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this segment?")) return;
    try {
      await crmSegmentsApi.delete(id);
      setSegments((curr) => curr.filter((s) => s.id !== id));
      setTotal((t) => t - 1);
      toast.success("Segment deleted");
    } catch {
      toast.error("Could not delete segment");
    }
  };

  const handleToggle = async (segment: CrmSegment) => {
    try {
      const updated = await crmSegmentsApi.toggle(segment.id, !segment.is_active);
      setSegments((curr) => curr.map((s) => (s.id === segment.id ? updated : s)));
    } catch {
      toast.error("Could not toggle");
    }
  };

  const handleRecalculate = async (id: string) => {
    try {
      const result = await crmSegmentsApi.recalculate(id);
      setSegments((curr) => curr.map((s) =>
        s.id === id ? { ...s, member_count: result.member_count, last_recalculated_at: result.recalculated_at } : s
      ));
      toast.success(`${result.member_count} members matched`);
    } catch {
      toast.error("Could not recalculate");
    }
  };

  const handlePreview = async (id: string) => {
    try {
      const result = await crmSegmentsApi.preview(id);
      setPreview({ id, count: result.member_count });
    } catch {
      toast.error("Could not preview");
    }
  };

  const groups = getGroups();

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customer Segments</h1>
          <p className="text-sm text-muted-foreground">
            Build dynamic customer segments using rules. Members update automatically based on criteria.
          </p>
        </div>
        <button
          onClick={() => { setEditingId(null); setForm(blankSegment); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium"
        >
          <Plus className="size-4" /> New Segment
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Segments" value={total} icon={<Target className="size-5" />} />
        <StatCard label="Active Segments" value={segments.filter((s) => s.is_active).length} icon={<Sparkles className="size-5" />} />
        <StatCard label="Total Members" value={segments.reduce((s, seg) => s + seg.member_count, 0)} icon={<Users className="size-5" />} />
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">{editingId ? "Edit Segment" : "New Segment"}</h3>
            <button type="button" onClick={() => { setShowForm(false); setForm(blankSegment); setEditingId(null); }}>
              <X className="size-5 text-muted-foreground hover:text-foreground" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Segment Name *</label>
              <input required value={form.name as string} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
              <input value={form.description as string} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
          </div>

          <div className="rounded-lg bg-muted/30 border border-border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Criteria Builder</h4>
              <div className="flex gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.is_dynamic as boolean}
                    onChange={(e) => setForm({ ...form, is_dynamic: e.target.checked })}
                    className="rounded" />
                  Dynamic (auto-recalculate)
                </label>
              </div>
            </div>

            {groups.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <AlertTriangle className="size-6 mx-auto mb-2 opacity-50" />
                No rules defined. Click "Add Rule Group" below.
              </div>
            ) : (
              groups.map((group, gIdx) => (
                <div key={gIdx} className="rounded-lg bg-background border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <select
                      value={group.combinator}
                      onChange={(e) => updateGroupCombinator(gIdx, e.target.value as "AND" | "OR")}
                      className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium"
                    >
                      <option value="AND">ALL of these (AND)</option>
                      <option value="OR">ANY of these (OR)</option>
                    </select>
                    <button type="button" onClick={() => removeGroup(gIdx)} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-md">
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  {group.conditions.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No conditions yet.</p>
                  )}

                  {group.conditions.map((cond, cIdx) => {
                    const attr = ATTRIBUTES.find((a) => a.key === cond.attribute) || ATTRIBUTES[0];
                    const ops = OPERATORS_BY_TYPE[attr.type] || [];
                    return (
                      <div key={cIdx} className="flex items-center gap-2">
                        <select
                          value={cond.attribute}
                          onChange={(e) => updateCondition(gIdx, cIdx, { attribute: e.target.value })}
                          className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                        >
                          {ATTRIBUTES.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                        </select>
                        <select
                          value={cond.operator}
                          onChange={(e) => updateCondition(gIdx, cIdx, { operator: e.target.value })}
                          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                        >
                          {ops.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <input
                          value={cond.value}
                          onChange={(e) => updateCondition(gIdx, cIdx, { value: e.target.value })}
                          placeholder="Value"
                          className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                        />
                        <button type="button" onClick={() => removeCondition(gIdx, cIdx)} className="p-1 hover:bg-red-500/10 text-red-500 rounded-md">
                          <X className="size-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  <button type="button" onClick={() => addCondition(gIdx)}
                    className="w-full px-3 py-1.5 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:border-primary hover:text-primary">
                    + Add Condition
                  </button>
                </div>
              ))
            )}

            <button type="button" onClick={addGroup}
              className="w-full px-3 py-2 rounded-md border border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary">
              + Add Rule Group
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setShowForm(false); setForm(blankSegment); setEditingId(null); }}
              className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
            <button disabled={saving} className="rounded-md bg-primary px-6 py-2 text-sm text-primary-foreground font-medium">
              {saving ? "Saving…" : editingId ? "Update Segment" : "Create Segment"}
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-4 glass-panel p-4 rounded-xl border border-border/50">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search segments..."
            className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm" />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">Loading segments…</div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Segment</th>
                  <th className="text-left px-4 py-3 font-medium">Members</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Last Calculated</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {segments.map((segment) => (
                  <tr key={segment.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{segment.name}</p>
                        {segment.description && <p className="text-xs text-muted-foreground">{segment.description}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Users className="size-3.5" /> {segment.member_count}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-md px-2 py-1 text-xs font-medium",
                        segment.is_dynamic ? "bg-purple-500/10 text-purple-600" : "bg-blue-500/10 text-blue-600")}>
                        {segment.is_dynamic ? "Dynamic" : "Static"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {segment.last_recalculated_at ? new Date(segment.last_recalculated_at).toLocaleString() : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleToggle(segment)}
                        className={cn("rounded-md px-2.5 py-1 text-xs font-medium",
                          segment.is_active ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground")}>
                        {segment.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handlePreview(segment.id)} className="px-2 py-1 text-xs rounded-md hover:bg-muted" title="Preview">
                          Preview
                        </button>
                        <button onClick={() => handleRecalculate(segment.id)} className="p-1.5 hover:bg-muted rounded-md" title="Recalculate">
                          <RefreshCw className="size-3.5" />
                        </button>
                        <button onClick={() => handleEdit(segment)} className="p-1.5 hover:bg-muted rounded-md" title="Edit">
                          <Plus className="size-3.5 rotate-45" />
                        </button>
                        <button onClick={() => handleDelete(segment.id)} className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-md" title="Delete">
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {segments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-16 text-muted-foreground">
                      No segments yet. Build your first dynamic segment to automatically classify customers.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="rounded-xl bg-card border border-border p-6 max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-2">Segment Preview</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This segment currently matches <span className="font-semibold text-primary">{preview.count}</span> customers.
            </p>
            <button onClick={() => setPreview(null)} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="glass-panel p-5 rounded-xl border border-border/50">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold flex gap-2 items-center"><span className="text-primary">{icon}</span>{value.toLocaleString()}</p>
    </div>
  );
}