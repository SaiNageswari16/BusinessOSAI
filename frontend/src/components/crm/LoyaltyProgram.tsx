import React, { useEffect, useState } from "react";
import {
  Plus,
  Search,
  Trash2,
  X,
  Gift,
  RotateCw,
  Users,
  Star,
  Ticket,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { crmLoyaltyApi, crmCustomersApi, type LoyaltyRule, type LoyaltyTransaction, type CrmCustomer } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const RULE_TYPES = ["purchase_amount", "order_count", "referral", "birthday", "review", "milestone"] as const;
const REWARD_TYPES = ["points_fixed", "points_percentage", "coupon"] as const;

const blankRule: Record<string, unknown> = {
  name: "",
  description: "",
  rule_type: "purchase_amount",
  trigger_value: 0,
  reward_type: "points_fixed",
  reward_value: 0,
  cooldown_days: 0,
  is_active: true,
  priority: 0,
};

export function LoyaltyProgram() {
  const [rules, setRules] = useState<LoyaltyRule[]>([]);
  const [totalRules, setTotalRules] = useState(0);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [txSearch, setTxSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showTxForm, setShowTxForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(blankRule);
  const [txForm, setTxForm] = useState({ customer_id: "", points: 0, description: "", reference_id: "" });
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [activeTab, setActiveTab] = useState<"rules" | "transactions">("rules");

  const loadRules = async () => {
    setLoading(true);
    try {
      const response = await crmLoyaltyApi.listRules(1, 100, search || undefined);
      setRules(response.items);
      setTotalRules(response.total);
    } catch {
      toast.error("Could not load loyalty rules");
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const response = await crmLoyaltyApi.listTransactions(undefined, 1, 100);
      setTransactions(response.items);
      setTxTotal(response.total);
    } catch {
      toast.error("Could not load transactions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "rules") void loadRules();
    else void loadTransactions();
  }, [activeTab]);

  useEffect(() => { void crmCustomersApi.list(1, 200).then(r => setCustomers(r.items)); }, []);

  const handleRuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        rule_type: form.rule_type,
        trigger_value: Number(form.trigger_value),
        reward_type: form.reward_type,
        reward_value: Number(form.reward_value),
        cooldown_days: Number(form.cooldown_days),
        is_active: form.is_active,
        priority: Number(form.priority),
      };
      if (editingId) {
        const updated = await crmLoyaltyApi.updateRule(editingId, payload);
        setRules((curr) => curr.map((r) => (r.id === editingId ? updated : r)));
        toast.success("Rule updated");
      } else {
        const created = await crmLoyaltyApi.createRule(payload);
        setRules((curr) => [created, ...curr]);
        setTotalRules((t) => t + 1);
        toast.success("Rule created");
      }
      setShowForm(false);
      setForm(blankRule);
      setEditingId(null);
    } catch {
      toast.error("Could not save rule");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (rule: LoyaltyRule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      description: rule.description || "",
      rule_type: rule.rule_type,
      trigger_value: rule.trigger_value,
      reward_type: rule.reward_type,
      reward_value: rule.reward_value,
      cooldown_days: rule.cooldown_days,
      is_active: rule.is_active,
      priority: rule.priority,
    });
    setShowForm(true);
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm("Delete this loyalty rule?")) return;
    try {
      await crmLoyaltyApi.deleteRule(id);
      setRules((curr) => curr.filter((r) => r.id !== id));
      setTotalRules((t) => t - 1);
      toast.success("Rule deleted");
    } catch {
      toast.error("Could not delete rule");
    }
  };

  const handleToggleRule = async (rule: LoyaltyRule) => {
    try {
      const updated = await crmLoyaltyApi.toggleRule(rule.id, !rule.is_active);
      setRules((curr) => curr.map((r) => (r.id === rule.id ? updated : r)));
    } catch {
      toast.error("Could not toggle rule");
    }
  };

  const handleAddPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txForm.customer_id) { toast.error("Select a customer"); return; }
    setSaving(true);
    try {
      const result = await crmLoyaltyApi.addPoints(txForm.customer_id, Number(txForm.points), txForm.description, txForm.reference_id || undefined);
      setTransactions((curr) => [result, ...curr]);
      setShowTxForm(false);
      setTxForm({ customer_id: "", points: 0, description: "", reference_id: "" });
      toast.success(`${result.points_earned} points added`);
    } catch {
      toast.error("Could not add points");
    } finally {
      setSaving(false);
    }
  };

  const handleRedeemPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txForm.customer_id) { toast.error("Select a customer"); return; }
    setSaving(true);
    try {
      const result = await crmLoyaltyApi.redeemPoints(txForm.customer_id, Number(txForm.points), txForm.description, txForm.reference_id || undefined);
      setTransactions((curr) => [result, ...curr]);
      setShowTxForm(false);
      setTxForm({ customer_id: "", points: 0, description: "", reference_id: "" });
      toast.success(`${result.points_redeemed} points redeemed`);
    } catch {
      toast.error("Could not redeem points");
    } finally {
      setSaving(false);
    }
  };

  const ruleTypeLabel: Record<string, string> = {
    purchase_amount: "Purchase Amount",
    order_count: "Order Count",
    referral: "Referral",
    birthday: "Birthday",
    review: "Review",
    milestone: "Milestone",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Loyalty Program</h1>
          <p className="text-sm text-muted-foreground">
            Configure loyalty rules and manage points earned/redeemed by customers.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button onClick={() => setActiveTab("rules")}
          className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "rules" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
          Rules ({totalRules})
        </button>
        <button onClick={() => setActiveTab("transactions")}
          className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "transactions" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
          Transactions ({txTotal})
        </button>
      </div>

      {/* ─── RULES TAB ─── */}
      {activeTab === "rules" && (
        <>
          {showForm && (
            <form onSubmit={handleRuleSubmit} className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">{editingId ? "Edit Rule" : "New Rule"}</h3>
                <button type="button" onClick={() => { setShowForm(false); setForm(blankRule); setEditingId(null); }}>
                  <X className="size-5 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Rule Name *</label>
                  <input required value={form.name as string} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Rule Type</label>
                  <select value={form.rule_type as string} onChange={(e) => setForm({ ...form, rule_type: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm">
                    {RULE_TYPES.map((t) => <option key={t} value={t}>{ruleTypeLabel[t] || t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Reward Type</label>
                  <select value={form.reward_type as string} onChange={(e) => setForm({ ...form, reward_type: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm">
                    {REWARD_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Trigger Value</label>
                  <input type="number" value={String(form.trigger_value)} onChange={(e) => setForm({ ...form, trigger_value: Number(e.target.value) })}
                    className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm"
                    placeholder={form.rule_type === "purchase_amount" ? "Min. purchase amount (₹)" : form.rule_type === "order_count" ? "Min. orders" : "Value"} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Reward Value</label>
                  <input type="number" value={String(form.reward_value)} onChange={(e) => setForm({ ...form, reward_value: Number(e.target.value) })}
                    className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm"
                    placeholder={form.reward_type === "points_fixed" ? "Points to award" : "Percentage"} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Cooldown (Days)</label>
                  <input type="number" value={String(form.cooldown_days)} onChange={(e) => setForm({ ...form, cooldown_days: Number(e.target.value) })}
                    className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Priority</label>
                  <input type="number" value={String(form.priority)} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                    className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                  <textarea value={form.description as string} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm" rows={2} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setForm(blankRule); setEditingId(null); }}
                  className="px-4 py-2 text-sm border border-border rounded-lg">Cancel</button>
                <button disabled={saving} className="rounded-md bg-primary px-6 py-2 text-sm text-primary-foreground font-medium">
                  {saving ? "Saving…" : editingId ? "Update Rule" : "Create Rule"}
                </button>
              </div>
            </form>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-4 glass-panel p-4 rounded-xl border border-border/50">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search rules..."
                className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm" />
            </div>
            <button onClick={() => { setEditingId(null); setForm(blankRule); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium">
              <Plus className="size-4" /> New Rule
            </button>
          </div>

          {loading ? (
            <div className="py-16 text-center text-muted-foreground">Loading rules…</div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Rule</th>
                      <th className="text-left px-4 py-3 font-medium">Trigger</th>
                      <th className="text-left px-4 py-3 font-medium">Reward</th>
                      <th className="text-left px-4 py-3 font-medium">Cooldown</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="text-right px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{rule.name}</p>
                            {rule.description && <p className="text-xs text-muted-foreground">{rule.description}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 text-purple-600 px-2 py-1">
                            {ruleTypeLabel[rule.rule_type] || rule.rule_type}
                          </span>
                          <span className="ml-1 text-muted-foreground">@{rule.trigger_value}</span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className="text-amber-600 font-medium">
                            {rule.reward_type === "points_fixed" && `+${rule.reward_value} pts`}
                            {rule.reward_type === "points_percentage" && `${rule.reward_value}%`}
                            {rule.reward_type === "coupon" && `Coupon ₹${rule.reward_value}`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{rule.cooldown_days}d</td>
                        <td className="px-4 py-3">
                          <button onClick={() => handleToggleRule(rule)}
                            className={cn("rounded-md px-2.5 py-1 text-xs font-medium",
                              rule.is_active ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground")}>
                            {rule.is_active ? "Active" : "Inactive"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => handleEdit(rule)} className="p-1.5 hover:bg-muted rounded-md" title="Edit">
                              <Plus className="size-3.5 rotate-45" />
                            </button>
                            <button onClick={() => handleDeleteRule(rule.id)} className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-md" title="Delete">
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {rules.length === 0 && (
                      <tr><td colSpan={6} className="text-center py-16 text-muted-foreground">No loyalty rules yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── TRANSACTIONS TAB ─── */}
      {activeTab === "transactions" && (
        <>
          <div className="flex flex-col sm:flex-row items-center gap-4 glass-panel p-4 rounded-xl border border-border/50">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input value={txSearch} onChange={(e) => setTxSearch(e.target.value)} placeholder="Search by customer name..."
                className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm" />
            </div>
            <button onClick={() => { setShowTxForm(true); setTxForm({ customer_id: "", points: 0, description: "", reference_id: "" }); }}
              className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium">
              <Gift className="size-4" /> Give Points
            </button>
          </div>

          {showTxForm && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Give / Redeem Points</h3>
                <button onClick={() => setShowTxForm(false)}><X className="size-5 text-muted-foreground hover:text-foreground" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Customer *</label>
                  <select required value={txForm.customer_id} onChange={(e) => setTxForm({ ...txForm, customer_id: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm">
                    <option value="">— Select Customer —</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.loyalty_points} pts)</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Points</label>
                  <input type="number" required min={1} value={String(txForm.points)}
                    onChange={(e) => setTxForm({ ...txForm, points: Number(e.target.value) })}
                    className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Description *</label>
                  <input required value={txForm.description}
                    onChange={(e) => setTxForm({ ...txForm, description: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm"
                    placeholder="e.g. Birthday bonus, Manual adjustment" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Reference ID</label>
                  <input value={txForm.reference_id}
                    onChange={(e) => setTxForm({ ...txForm, reference_id: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => void crmLoyaltyApi.addPoints(txForm.customer_id, Number(txForm.points), txForm.description)} disabled={!txForm.customer_id || txForm.points <= 0 || saving}
                  className="px-4 py-2 text-sm rounded-md bg-emerald-500/10 text-emerald-600 font-medium hover:bg-emerald-500/20 disabled:opacity-50">
                  Add Points
                </button>
                <button type="button" onClick={() => void crmLoyaltyApi.redeemPoints(txForm.customer_id, Number(txForm.points), txForm.description)} disabled={!txForm.customer_id || txForm.points <= 0 || saving}
                  className="px-4 py-2 text-sm rounded-md bg-red-500/10 text-red-600 font-medium hover:bg-red-500/20 disabled:opacity-50">
                  Redeem Points
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-muted-foreground">Loading transactions…</div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Date</th>
                      <th className="text-left px-4 py-3 font-medium">Customer</th>
                      <th className="text-left px-4 py-3 font-medium">Rule</th>
                      <th className="text-left px-4 py-3 font-medium">Type</th>
                      <th className="text-left px-4 py-3 font-medium">Earned</th>
                      <th className="text-left px-4 py-3 font-medium">Redeemed</th>
                      <th className="text-left px-4 py-3 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</td>
                        <td className="px-4 py-3 font-medium">{tx.customer_name || tx.customer_id}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{tx.rule_name || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={cn("text-xs font-medium capitalize",
                            tx.transaction_type === "earned" ? "text-emerald-600" : "text-red-600")}>
                            {tx.transaction_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-emerald-600 font-medium">{tx.points_earned > 0 ? `+${tx.points_earned}` : "—"}</td>
                        <td className="px-4 py-3 text-red-600 font-medium">{tx.points_redeemed > 0 ? `−${tx.points_redeemed}` : "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{tx.description}</td>
                      </tr>
                    ))}
                    {transactions.length === 0 && (
                      <tr><td colSpan={7} className="text-center py-16 text-muted-foreground">No transactions yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="glass-panel p-5 rounded-xl border border-border/50">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold flex gap-2 items-center"><span className="text-primary">{icon}</span>{value}</p>
    </div>
  );
}