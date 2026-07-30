import React, { useEffect, useState } from "react";
import {
  Plus,
  Search,
  Trash2,
  X,
  Tag,
  Percent,
  RotateCw,
  RefreshCw,
  Eye,
  Calendar,
  Copy,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { crmDiscountsApi, crmCustomersApi, type Discount, type DiscountUsage, type CrmCustomer } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const DISCOUNT_TYPES = ["percentage", "fixed_amount", "bogo", "bundle"] as const;
const SCOPE_OPTIONS = ["order", "product", "category", "customer_group", "membership_tier", "bundle"] as const;
const RULE_TYPES = ["loyalty", "membership", "manual"] as const;

const blankDiscount: Record<string, unknown> = {
  name: "",
  code: "",
  description: "",
  discount_type: "percentage",
  value: 0,
  min_order_value: 0,
  max_discount: null,
  applicable_scope: "order",
  applicable_products: [],
  applicable_categories: [],
  applicable_customer_groups: [],
  applicable_segments: [],
  applicable_tiers: [],
  bundle_ids: [],
  usage_limit: null,
  per_customer_limit: null,
  starts_at: null,
  ends_at: null,
  stackable: false,
  requires_coupon: false,
  is_active: true,
};

export function Discounts() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [total, setTotal] = useState(0);
  const [usages, setUsages] = useState<DiscountUsage[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"discounts" | "usage">("discounts");
  const [form, setForm] = useState<Record<string, unknown>>(blankDiscount);
  const [showValidate, setShowValidate] = useState(false);
  const [validateResult, setValidateResult] = useState<{ valid: boolean; discount_amount?: number; message?: string } | null>(null);
  const [validateCode, setValidateCode] = useState("");
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);

  const loadDiscounts = async () => {
    setLoading(true);
    try {
      const response = await crmDiscountsApi.list(1, 100, search || undefined);
      setDiscounts(response.items);
      setTotal(response.total);
    } catch {
      toast.error("Could not load discounts");
    } finally {
      setLoading(false);
    }
  };

  const loadUsages = async () => {
    setLoading(true);
    try {
      const response = await crmDiscountsApi.listUsage(undefined, 1, 100);
      setUsages(response.items);
    } catch {
      toast.error("Could not load usage");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "discounts") void loadDiscounts();
    else void loadUsages();
  }, [activeTab]);

  useEffect(() => { void crmCustomersApi.list(1, 200).then(r => setCustomers(r.items)); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        code: form.code || null,
        description: form.description || null,
        discount_type: form.discount_type,
        value: Number(form.value),
        min_order_value: Number(form.min_order_value),
        max_discount: form.max_discount ? Number(form.max_discount) : null,
        applicable_scope: form.applicable_scope,
        applicable_products: (form.applicable_products as string[])?.length ? (form.applicable_products as string[]) : null,
        applicable_categories: (form.applicable_categories as string[])?.length ? (form.applicable_categories as string[]) : null,
        applicable_customer_groups: (form.applicable_customer_groups as string[])?.length ? (form.applicable_customer_groups as string[]) : null,
        applicable_segments: (form.applicable_segments as string[])?.length ? (form.applicable_segments as string[]) : null,
        applicable_tiers: (form.applicable_tiers as string[])?.length ? (form.applicable_tiers as string[]) : null,
        bundle_ids: (form.bundle_ids as string[])?.length ? (form.bundle_ids as string[]) : null,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
        per_customer_limit: form.per_customer_limit ? Number(form.per_customer_limit) : null,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
        stackable: form.stackable,
        requires_coupon: form.requires_coupon,
        is_active: form.is_active,
      };
      if (editingId) {
        const updated = await crmDiscountsApi.update(editingId, payload);
        setDiscounts((curr) => curr.map((d) => (d.id === editingId ? updated : d)));
        toast.success("Discount updated");
      } else {
        const created = await crmDiscountsApi.create(payload);
        setDiscounts((curr) => [created, ...curr]);
        setTotal((t) => t + 1);
        toast.success("Discount created");
      }
      setShowForm(false);
      setForm(blankDiscount);
      setEditingId(null);
    } catch {
      toast.error("Could not save discount");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (discount: Discount) => {
    setEditingId(discount.id);
    setForm({
      name: discount.name,
      code: discount.code || "",
      description: discount.description || "",
      discount_type: discount.discount_type,
      value: discount.value,
      min_order_value: discount.min_order_value,
      max_discount: discount.max_discount || null,
      applicable_scope: discount.applicable_scope,
      applicable_products: discount.applicable_products || [],
      applicable_categories: discount.applicable_categories || [],
      applicable_customer_groups: discount.applicable_customer_groups || [],
      applicable_segments: discount.applicable_segments || [],
      applicable_tiers: discount.applicable_tiers || [],
      bundle_ids: discount.bundle_ids || [],
      usage_limit: discount.usage_limit || null,
      per_customer_limit: discount.per_customer_limit || null,
      starts_at: discount.starts_at || "",
      ends_at: discount.ends_at || "",
      stackable: discount.stackable,
      requires_coupon: discount.requires_coupon,
      is_active: discount.is_active,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this discount?")) return;
    try {
      await crmDiscountsApi.delete(id);
      setDiscounts((curr) => curr.filter((d) => d.id !== id));
      setTotal((t) => t - 1);
      toast.success("Discount deleted");
    } catch {
      toast.error("Could not delete discount");
    }
  };

  const handleToggle = async (discount: Discount) => {
    try {
      const updated = await crmDiscountsApi.toggle(discount.id, !discount.is_active);
      setDiscounts((curr) => curr.map((d) => (d.id === discount.id ? updated : d)));
    } catch {
      toast.error("Could not toggle");
    }
  };

  const handleValidateCoupon = async () => {
    if (!validateCode.trim()) { toast.error("Enter a coupon code"); return; }
    try {
      const result = await crmDiscountsApi.validateCoupon(validateCode.trim());
      setValidateResult(result);
    } catch {
      toast.error("Could not validate coupon");
    }
  };

  const isExpired = (d: Discount) => d.ends_at && new Date(d.ends_at) < new Date();
  const isUpcoming = (d: Discount) => d.starts_at && new Date(d.starts_at) > new Date();

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Discounts</h1>
          <p className="text-sm text-muted-foreground">
            Create discount rules, coupons, and bundle deals. Configure eligibility, usage limits, and stackability.
          </p>
        </div>
        <button onClick={() => { setEditingId(null); setForm(blankDiscount); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium">
          <Plus className="size-4" /> New Discount
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="Total Discounts" value={total} icon={<Tag className="size-5" />} />
        <StatCard label="Active" value={discounts.filter((d) => d.is_active && !isExpired(d) && !isUpcoming(d)).length} icon={<CheckCircle className="size-5" />} />
        <StatCard label="Upcoming" value={discounts.filter((d) => isUpcoming(d)).length} icon={<Calendar className="size-5" />} />
        <StatCard label="Expired" value={discounts.filter((d) => isExpired(d)).length} icon={<XCircle className="size-5" />} />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button onClick={() => setActiveTab("discounts")}
          className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "discounts" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
          Discount Rules
        </button>
        <button onClick={() => setActiveTab("usage")}
          className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "usage" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
          Usage History
        </button>
      </div>

      {/* ─── DISCOUNTS TAB ─── */}
      {activeTab === "discounts" && (
        <>
          {showForm && (
            <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">{editingId ? "Edit Discount" : "New Discount"}</h3>
                <button type="button" onClick={() => { setShowForm(false); setForm(blankDiscount); setEditingId(null); }}>
                  <X className="size-5 text-muted-foreground hover:text-foreground" />
                </button>
              </div>

              <FieldSection label="Basic Info">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Name *</label>
                    <input required value={form.name as string} onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Coupon Code</label>
                    <input value={form.code as string} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                      className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm uppercase font-mono"
                      placeholder="SUMMER25" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Discount Type</label>
                    <select value={form.discount_type as string} onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm">
                      {DISCOUNT_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Value</label>
                    <input type="number" value={String(form.value)} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
                      className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm"
                      placeholder={form.discount_type === "percentage" ? "25 = 25%" : "Amount in ₹"} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Min Order Value (₹)</label>
                    <input type="number" value={String(form.min_order_value)} onChange={(e) => setForm({ ...form, min_order_value: Number(e.target.value) })}
                      className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Max Discount (₹)</label>
                    <input type="number" value={form.max_discount ? String(form.max_discount) : ""} onChange={(e) => setForm({ ...form, max_discount: e.target.value ? Number(e.target.value) : null })}
                      className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm" />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                    <textarea value={form.description as string} onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm" rows={2} />
                  </div>
                </div>
              </FieldSection>

              <FieldSection label="Scope & Eligibility">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Applicable Scope</label>
                    <select value={form.applicable_scope as string} onChange={(e) => setForm({ ...form, applicable_scope: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm">
                      {SCOPE_OPTIONS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Applicable Tiers</label>
                    <input value={(form.applicable_tiers as string[] || []).join(", ")}
                      onChange={(e) => setForm({ ...form, applicable_tiers: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                      className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm"
                      placeholder="Gold, Platinum" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Applicable Groups</label>
                    <input value={(form.applicable_customer_groups as string[] || []).join(", ")}
                      onChange={(e) => setForm({ ...form, applicable_customer_groups: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                      className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm"
                      placeholder="VIP, Bulk Buyers" />
                  </div>
                </div>
              </FieldSection>

              <FieldSection label="Schedule">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Starts At</label>
                    <input type="datetime-local" value={form.starts_at as string} onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Ends At</label>
                    <input type="datetime-local" value={form.ends_at as string} onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Usage Limit</label>
                    <input type="number" value={form.usage_limit ? String(form.usage_limit) : ""} onChange={(e) => setForm({ ...form, usage_limit: e.target.value ? Number(e.target.value) : null })}
                      className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm"
                      placeholder="Unlimited" />
                  </div>
                </div>
              </FieldSection>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.requires_coupon as boolean}
                    onChange={(e) => setForm({ ...form, requires_coupon: e.target.checked })} />
                  Requires Coupon Code
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.stackable as boolean}
                    onChange={(e) => setForm({ ...form, stackable: e.target.checked })} />
                  Stackable with other discounts
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setForm(blankDiscount); setEditingId(null); }}
                  className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
                <button disabled={saving} className="rounded-md bg-primary px-6 py-2 text-sm text-primary-foreground font-medium">
                  {saving ? "Saving…" : editingId ? "Update Discount" : "Create Discount"}
                </button>
              </div>
            </form>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-4 glass-panel p-4 rounded-xl border border-border/50">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search discounts…"
                className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm" />
            </div>
            <button onClick={() => setShowValidate(true)} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">
              <CheckCircle className="size-4" /> Validate Coupon
            </button>
          </div>

          {showValidate && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Validate Coupon</h3>
                <button onClick={() => { setShowValidate(false); setValidateResult(null); setValidateCode(""); }}>
                  <X className="size-5 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
              <div className="flex gap-2">
                <input value={validateCode} onChange={(e) => setValidateCode(e.target.value.toUpperCase())}
                  placeholder="Enter coupon code" className="flex-1 rounded-lg border border-border bg-background/80 px-3 py-2 text-sm font-mono uppercase" />
                <button onClick={handleValidateCoupon} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm">Validate</button>
              </div>
              {validateResult && (
                <div className={cn("rounded-lg p-4 text-sm",
                  validateResult.valid ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600")}>
                  {validateResult.valid ? (
                    <div>
                      <p className="font-medium">Coupon is valid!</p>
                      {validateResult.discount_amount && <p className="mt-1">Discount amount: ₹{validateResult.discount_amount.toLocaleString()}</p>}
                    </div>
                  ) : (
                    <p>{validateResult.message || "Coupon is not valid."}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-muted-foreground">Loading discounts…</div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Discount</th>
                      <th className="text-left px-4 py-3 font-medium">Code</th>
                      <th className="text-left px-4 py-3 font-medium">Value</th>
                      <th className="text-left px-4 py-3 font-medium">Scope</th>
                      <th className="text-left px-4 py-3 font-medium">Usage</th>
                      <th className="text-left px-4 py-3 font-medium">Schedule</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="text-right px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {discounts.map((discount) => (
                      <tr key={discount.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{discount.name}</p>
                            {discount.description && <p className="text-xs text-muted-foreground">{discount.description}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {discount.code ? (
                            <span className="inline-flex items-center gap-1 font-mono text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                              {discount.code} <Copy className="size-3" />
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Auto</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("font-medium",
                            discount.discount_type === "percentage" ? "text-primary" : "text-amber-600")}>
                            {discount.discount_type === "percentage" ? `${discount.value}%` : `₹${discount.value.toLocaleString()}`}
                          </span>
                          {discount.max_discount && <p className="text-xs text-muted-foreground">Max ₹{discount.max_discount.toLocaleString()}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-purple-500/10 text-purple-600 px-2 py-1 rounded-md">{discount.applicable_scope}</span>
                          <div className="flex gap-1 mt-1">
                            {discount.stackable && <span className="text-xs text-muted-foreground">Stackable</span>}
                            {discount.requires_coupon && <span className="text-xs text-muted-foreground">Coupon</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {discount.usage_count} / {discount.usage_limit || "∞"} used
                          <br />{discount.per_customer_limit && `${discount.per_customer_limit}/customer`}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {discount.starts_at ? new Date(discount.starts_at).toLocaleDateString() : "—"} – {discount.ends_at ? new Date(discount.ends_at).toLocaleDateString() : "Ongoing"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <button onClick={() => handleToggle(discount)}
                              className={cn("rounded-md px-2.5 py-1 text-xs font-medium",
                                discount.is_active ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground")}>
                              {discount.is_active ? "Active" : "Inactive"}
                            </button>
                            {(isExpired(discount) || isUpcoming(discount)) && (
                              <span className={cn("block text-xs",
                                isExpired(discount) ? "text-red-500" : "text-yellow-500")}>
                                {isExpired(discount) ? "Expired" : "Upcoming"}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => handleEdit(discount)} className="p-1.5 hover:bg-muted rounded-md" title="Edit">
                              <Plus className="size-3.5 rotate-45" />
                            </button>
                            <button onClick={() => handleDelete(discount.id)} className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-md" title="Delete">
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {discounts.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-16 text-muted-foreground">
                          {search ? "No discounts match your search." : "No discounts yet. Create your first discount rule."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── USAGE TAB ─── */}
      {activeTab === "usage" && (
        <>
          <div className="flex flex-col sm:flex-row items-center gap-4 glass-panel p-4 rounded-xl border border-border/50">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search usage…"
                className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm" />
            </div>
            <button onClick={loadUsages} className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted">
              <RefreshCw className="size-4" />
            </button>
          </div>

          {loading ? (
            <div className="py-16 text-center text-muted-foreground">Loading usage…</div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Date</th>
                      <th className="text-left px-4 py-3 font-medium">Discount</th>
                      <th className="text-left px-4 py-3 font-medium">Customer</th>
                      <th className="text-left px-4 py-3 font-medium">Order</th>
                      <th className="text-left px-4 py-3 font-medium">Amount Saved</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {usages.map((u) => (
                      <tr key={u.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleString()}</td>
                        <td className="px-4 py-3 font-medium">{u.discount_name || u.discount_id}</td>
                        <td className="px-4 py-3">{u.customer_name || u.customer_id}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{u.order_id || "—"}</td>
                        <td className="px-4 py-3 text-emerald-600 font-medium">−₹{u.discount_amount.toLocaleString()}</td>
                      </tr>
                    ))}
                    {usages.length === 0 && (
                      <tr><td colSpan={5} className="text-center py-16 text-muted-foreground">No discount usage recorded yet.</td></tr>
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

function FieldSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{label}</h4>
      {children}
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