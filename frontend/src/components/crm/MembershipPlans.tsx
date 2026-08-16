import React, { useEffect, useState } from "react";
import {
  Plus,
  Search,
  Trash2,
  X,
  Users,
  DollarSign,
  Tag,
  RefreshCw,
  Edit3,
  CheckCircle,
  XCircle,
  Crown,
} from "lucide-react";
import { toast } from "sonner";
import { crmMembershipsApi, type MembershipPlan, type CustomerMembership } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";

const TIERS = ["Bronze", "Silver", "Gold", "Platinum", "VIP"];
const BENEFITS_LIST = [
  "Free shipping", "Priority support", "Early access to sales", "Exclusive discounts",
  "Birthday rewards", "Points multiplier", "Extended returns", "Dedicated account manager",
  "Free returns", "Cashback on purchases", "Gift wrapping", "VIP events access",
];

const blankPlan: Record<string, unknown> = {
  name: "",
  tier: "Bronze",
  description: "",
  duration_months: 12,
  price: 0,
  currency: "INR",
  benefits: [],
  discount_percentage: 0,
  points_multiplier: 1,
  auto_renewal: false,
  is_active: true,
  max_members: null,
};

export function MembershipPlans() {
    const { currency, formatCurrency } = useCurrency();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"plans" | "subscriptions">("plans");
  const [subscriptions, setSubscriptions] = useState<CustomerMembership[]>([]);
  const [showSubForm, setShowSubForm] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>(blankPlan);
  const [subForm, setSubForm] = useState({ customer_id: "", plan_id: "" });

  const loadPlans = async () => {
    setLoading(true);
    try {
      const response = await crmMembershipsApi.listPlans(1, 100, search || undefined);
      setPlans(response.items);
      setTotal(response.total);
    } catch {
      toast.error("Could not load membership plans");
    } finally {
      setLoading(false);
    }
  };

  const loadSubscriptions = async () => {
    setLoading(true);
    try {
      const response = await crmMembershipsApi.listSubscriptions(1, 100);
      setSubscriptions(response.items);
    } catch {
      toast.error("Could not load subscriptions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "plans") void loadPlans();
    else void loadSubscriptions();
  }, [activeTab]);

  const handlePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        tier: form.tier,
        description: form.description || null,
        duration_months: Number(form.duration_months),
        price: Number(form.price),
        currency: form.currency,
        benefits: form.benefits,
        discount_percentage: Number(form.discount_percentage),
        points_multiplier: Number(form.points_multiplier),
        auto_renewal: form.auto_renewal,
        is_active: form.is_active,
        max_members: form.max_members || null,
      };
      if (editingId) {
        const updated = await crmMembershipsApi.updatePlan(editingId, payload);
        setPlans((curr) => curr.map((p) => (p.id === editingId ? updated : p)));
        toast.success("Plan updated");
      } else {
        const created = await crmMembershipsApi.createPlan(payload);
        setPlans((curr) => [created, ...curr]);
        setTotal((t) => t + 1);
        toast.success("Plan created");
      }
      setShowForm(false);
      setForm(blankPlan);
      setEditingId(null);
    } catch {
      toast.error("Could not save plan");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (plan: MembershipPlan) => {
    setEditingId(plan.id);
    setForm({
      name: plan.name,
      tier: plan.tier,
      description: plan.description || "",
      duration_months: plan.duration_months,
      price: plan.price,
      currency: plan.currency,
      benefits: plan.benefits,
      discount_percentage: plan.discount_percentage,
      points_multiplier: plan.points_multiplier,
      auto_renewal: plan.auto_renewal,
      is_active: plan.is_active,
      max_members: plan.max_members || null,
    });
    setShowForm(true);
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm("Delete this plan? Active subscriptions will remain historical.")) return;
    try {
      await crmMembershipsApi.deletePlan(id);
      setPlans((curr) => curr.filter((p) => p.id !== id));
      setTotal((t) => t - 1);
      toast.success("Plan deleted");
    } catch {
      toast.error("Could not delete plan");
    }
  };

  const handleTogglePlan = async (plan: MembershipPlan) => {
    try {
      const updated = await crmMembershipsApi.updatePlan(plan.id, { ...plan, is_active: !plan.is_active });
      setPlans((curr) => curr.map((p) => (p.id === plan.id ? updated : p)));
    } catch {
      toast.error("Could not toggle plan");
    }
  };

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await crmMembershipsApi.createSubscription({
        customer_id: subForm.customer_id,
        plan_id: subForm.plan_id,
      });
      setSubscriptions((curr) => [created, ...curr]);
      setShowSubForm(false);
      setSubForm({ customer_id: "", plan_id: "" });
      toast.success("Subscription created");
    } catch {
      toast.error("Could not create subscription");
    }
  };

  const handleCancelSubscription = async (id: string) => {
    try {
      const updated = await crmMembershipsApi.cancelSubscription(id);
      setSubscriptions((curr) => curr.map((s) => (s.id === id ? updated : s)));
      toast.success("Subscription cancelled");
    } catch {
      toast.error("Could not cancel subscription");
    }
  };

  const handleRenewSubscription = async (id: string) => {
    try {
      const updated = await crmMembershipsApi.renewSubscription(id);
      setSubscriptions((curr) => curr.map((s) => (s.id === id ? updated : s)));
      toast.success("Subscription renewed");
    } catch {
      toast.error("Could not renew subscription");
    }
  };

  const toggleBenefit = (benefit: string) => {
    const current = form.benefits as string[];
    setForm({
      ...form,
      benefits: current.includes(benefit)
        ? current.filter((b) => b !== benefit)
        : [...current, benefit],
    });
  };

  const tierColor: Record<string, string> = {
    Bronze: "text-amber-600 bg-amber-500/10",
    Silver: "text-gray-400 bg-gray-500/10",
    Gold: "text-yellow-500 bg-yellow-500/10",
    Platinum: "text-cyan-400 bg-cyan-500/10",
    VIP: "text-purple-500 bg-purple-500/10",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Membership Plans</h1>
          <p className="text-sm text-muted-foreground">
            Define membership tiers, pricing, benefits and manage customer subscriptions.
          </p>
        </div>
        {activeTab === "plans" ? (
          <button onClick={() => { setEditingId(null); setForm(blankPlan); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium">
            <Plus className="size-4" /> New Plan
          </button>
        ) : (
          <button onClick={() => setShowSubForm(true)}
            className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium">
            <Plus className="size-4" /> New Subscription
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button onClick={() => setActiveTab("plans")}
          className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "plans" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
          Plans ({total})
        </button>
        <button onClick={() => setActiveTab("subscriptions")}
          className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "subscriptions" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
          Subscriptions ({subscriptions.length})
        </button>
      </div>

      {/* ─── PLANS TAB ─── */}
      {activeTab === "plans" && (
        <>
          {showForm && (
            <form onSubmit={handlePlanSubmit} className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">{editingId ? "Edit Plan" : "New Plan"}</h3>
                <button type="button" onClick={() => { setShowForm(false); setForm(blankPlan); setEditingId(null); }}>
                  <X className="size-5 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Plan Name *</label>
                  <input required value={form.name as string} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Tier</label>
                  <select value={form.tier as string} onChange={(e) => setForm({ ...form, tier: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm">
                    {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Price ({currency.symbol})</label>
                  <input type="number" value={String(form.price)} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                    className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Duration (Months)</label>
                  <input type="number" value={String(form.duration_months)} onChange={(e) => setForm({ ...form, duration_months: Number(e.target.value) })}
                    className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Discount (%)</label>
                  <input type="number" value={String(form.discount_percentage)} onChange={(e) => setForm({ ...form, discount_percentage: Number(e.target.value) })}
                    className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Points Multiplier</label>
                  <input type="number" value={String(form.points_multiplier)} onChange={(e) => setForm({ ...form, points_multiplier: Number(e.target.value) })}
                    className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm" />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                  <textarea value={form.description as string} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm" rows={2} />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-muted-foreground mb-2">Benefits</label>
                  <div className="flex flex-wrap gap-2">
                    {BENEFITS_LIST.map((b) => (
                      <button key={b} type="button" onClick={() => toggleBenefit(b)}
                        className={cn("px-3 py-1.5 rounded-full text-xs border transition-colors",
                          (form.benefits as string[]).includes(b)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border hover:border-primary text-muted-foreground")}>
                        {(form.benefits as string[]).includes(b) && <CheckCircle className="size-3 inline mr-1" />}
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm md:col-span-3">
                  <input type="checkbox" checked={form.auto_renewal as boolean}
                    onChange={(e) => setForm({ ...form, auto_renewal: e.target.checked })} />
                  Auto-renewal allowed
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setForm(blankPlan); setEditingId(null); }}
                  className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
                <button disabled={saving} className="rounded-md bg-primary px-6 py-2 text-sm text-primary-foreground font-medium">
                  {saving ? "Saving…" : editingId ? "Update Plan" : "Create Plan"}
                </button>
              </div>
            </form>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-4 glass-panel p-4 rounded-xl border border-border/50">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search plans..."
                className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm" />
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-muted-foreground">Loading plans…</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <div key={plan.id} className="rounded-xl border border-border bg-card p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Crown className={cn("size-5", tierColor[plan.tier]?.split(" ")[0])} />
                      <div>
                        <h3 className="font-semibold">{plan.name}</h3>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", tierColor[plan.tier])}>
                          {plan.tier}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => handleTogglePlan(plan)}
                      className={cn("p-1.5 rounded-md", plan.is_active ? "text-emerald-600 hover:bg-emerald-500/10" : "text-muted-foreground hover:bg-muted")}>
                      {plan.is_active ? <CheckCircle className="size-5" /> : <XCircle className="size-5" />}
                    </button>
                  </div>

                  {plan.description && <p className="text-sm text-muted-foreground">{plan.description}</p>}

                  <div className="grid grid-cols-3 gap-2 py-3 border-y border-border">
                    <div className="text-center">
                      <p className="text-lg font-bold">{currency.symbol}{plan.price.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Price</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold">{plan.duration_months}mo</p>
                      <p className="text-xs text-muted-foreground">Duration</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold">{plan.discount_percentage}%</p>
                      <p className="text-xs text-muted-foreground">Discount</p>
                    </div>
                  </div>

                  {plan.benefits.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {plan.benefits.map((b) => (
                        <span key={b} className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">
                          <Tag className="size-3" />{b}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                    <span className="flex items-center gap-1"><Users className="size-3.5" />{plan.current_members} / {plan.max_members || "∞"} members</span>
                    <span>{plan.points_multiplier}x points</span>
                    {plan.auto_renewal && <span className="text-emerald-500">Auto-renewal</span>}
                  </div>

                  <div className="flex gap-1 pt-2 border-t border-border">
                    <button onClick={() => handleEdit(plan)} className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs rounded-md hover:bg-muted">
                      <Edit3 className="size-3.5" /> Edit
                    </button>
                    <button onClick={() => handleDeletePlan(plan.id)} className="px-3 py-1.5 text-xs rounded-md hover:bg-red-500/10 text-red-500">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {plans.length === 0 && (
                <div className="col-span-full text-center py-16 text-muted-foreground">
                  {search ? "No plans match your search." : "No membership plans yet. Create your first plan."}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── SUBSCRIPTIONS TAB ─── */}
      {activeTab === "subscriptions" && (
        <>
          {showSubForm && (
            <form onSubmit={handleCreateSubscription} className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">New Subscription</h3>
                <button type="button" onClick={() => setShowSubForm(false)}>
                  <X className="size-5 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Customer ID</label>
                  <input required value={subForm.customer_id} onChange={(e) => setSubForm({ ...subForm, customer_id: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Plan ID</label>
                  <input required value={subForm.plan_id} onChange={(e) => setSubForm({ ...subForm, plan_id: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowSubForm(false)} className="px-4 py-2 text-sm border border-border rounded-lg">Cancel</button>
                <button className="rounded-md bg-primary px-6 py-2 text-sm text-primary-foreground font-medium">Create Subscription</button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="py-16 text-center text-muted-foreground">Loading subscriptions…</div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Customer</th>
                      <th className="text-left px-4 py-3 font-medium">Plan</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="text-left px-4 py-3 font-medium">Started</th>
                      <th className="text-left px-4 py-3 font-medium">Expires</th>
                      <th className="text-right px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {subscriptions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{sub.customer_name || sub.customer_id}</td>
                        <td className="px-4 py-3">{sub.plan_name || sub.plan_id}</td>
                        <td className="px-4 py-3">
                          <span className={cn("rounded-md px-2 py-1 text-xs font-medium",
                            sub.status === "active" && "bg-emerald-500/10 text-emerald-600",
                            sub.status === "expired" && "bg-muted text-muted-foreground",
                            sub.status === "cancelled" && "bg-red-500/10 text-red-600",
                            sub.status === "pending" && "bg-yellow-500/10 text-yellow-600")}>
                            {sub.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{new Date(sub.started_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-muted-foreground">{new Date(sub.expires_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {sub.status === "active" && (
                              <>
                                <button onClick={() => handleRenewSubscription(sub.id)} className="px-2 py-1 text-xs rounded-md hover:bg-muted">Renew</button>
                                <button onClick={() => handleCancelSubscription(sub.id)} className="px-2 py-1 text-xs rounded-md hover:bg-red-500/10 text-red-500">Cancel</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {subscriptions.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-16 text-muted-foreground">No subscriptions yet.</td>
                      </tr>
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

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="glass-panel p-5 rounded-xl border border-border/50">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold flex gap-2 items-center"><span className="text-primary">{icon}</span>{value.toLocaleString()}</p>
    </div>
  );
}