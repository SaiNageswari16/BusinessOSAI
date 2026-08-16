import React, { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Star,
  UserPlus,
  Users,
  X,
  Calendar,
  DollarSign,
  ShoppingCart,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { crmCustomersApi, inventoryApi, type CrmCustomer } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Sparkles, Loader2 } from "lucide-react";

const CUSTOMER_TYPES = [
  "Retail",
  "Corporate",
  "Wholesale",
  "VIP",
  "Distributor",
  "Dealer",
  "Online",
  "Walk-in",
] as const;

const GENDERS = ["Male", "Female", "Other", "Prefer not to say"] as const;

const STATUSES = ["Active", "Inactive", "Blocked", "Pending"] as const;

const blankCustomer: Record<string, unknown> = {
  name: "",
  email: "",
  phone: "",
  alternate_phone: "",
  whatsapp_number: "",
  company_name: "",
  contact_person: "",
  customer_type: "Retail",
  status: "Active",
  source: "",
  address: "",
  billing_address: "",
  shipping_address: "",
  isShippingSameAsBilling: true,
  city: "",
  state: "",
  country: "India",
  postal_code: "",
  gst_number: "",
  pan_number: "",
  date_of_birth: "",
  anniversary_date: "",
  gender: "",
  preferred_language: "English",
  credit_limit: 0,
};

export function Customers() {
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifyingGst, setVerifyingGst] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CrmCustomer | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(blankCustomer);

  const handleVerifyGstin = async () => {
    const cleanGst = String(form.gst_number || "").trim().toUpperCase();
    if (!cleanGst || cleanGst.length !== 15) {
      toast.error("Please enter a valid 15-character GSTIN");
      return;
    }
    try {
      setVerifyingGst(true);
      const res = await inventoryApi.verifyGstin(cleanGst);
      setForm((prev) => ({
        ...prev,
        gst_number: res.gstin || cleanGst,
        name: res.trade_name || res.legal_name,
        company_name: res.legal_name || res.trade_name,
        contact_person: prev.contact_person || res.contact_person || "",
        email: prev.email || res.email || "",
        phone: prev.phone || res.phone || "",
        pan_number: res.pan || prev.pan_number,
        address: res.address || prev.address,
        city: res.city || prev.city,
        state: res.state || prev.state,
        postal_code: res.pincode || prev.postal_code,
        customer_type: "Corporate",
        status: "Active",
      }));
      toast.success(`GSTIN Verified: ${res.trade_name || res.legal_name} (${res.state})`);
    } catch (e: any) {
      toast.error(e?.detail || "GSTIN lookup failed");
    } finally {
      setVerifyingGst(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const response = await crmCustomersApi.list(
        1,
        100,
        search || undefined,
        type === "All" ? undefined : type
      );
      setCustomers(response.items);
      setTotal(response.total);
    } catch {
      toast.error("Could not load customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [type]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return customers.filter((c) => {
      if (statusFilter !== "All" && c.status !== statusFilter) return false;
      if (!term) return true;
      return (
        c.name.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.phone?.includes(term) ||
        c.company_name?.toLowerCase().includes(term) ||
        c.city?.toLowerCase().includes(term) ||
        c.gst_number?.toLowerCase().includes(term)
      );
    });
  }, [customers, search, statusFilter]);

  const stats = useMemo(() => {
    const active = customers.filter((c) => c.status === "Active").length;
    const vip = customers.filter((c) => c.customer_type === "VIP").length;
    const totalLtv = customers.reduce((sum, c) => sum + (c.lifetime_value || 0), 0);
    return { active, vip, totalLtv, totalOrders: customers.reduce((s, c) => s + (c.total_orders || 0), 0) };
  }, [customers]);

  const resetForm = () => {
    setForm(blankCustomer);
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (customer: CrmCustomer) => {
    setEditingId(customer.id);
    setForm({
      name: customer.name,
      email: customer.email || "",
      phone: customer.phone || "",
      alternate_phone: customer.alternate_phone || "",
      whatsapp_number: customer.whatsapp_number || "",
      company_name: customer.company_name || "",
      contact_person: customer.contact_person || "",
      customer_type: customer.customer_type,
      status: customer.status,
      source: customer.source || "",
      address: customer.address || "",
      billing_address: customer.billing_address || customer.address || "",
      shipping_address: customer.shipping_address || "",
      isShippingSameAsBilling: customer.shipping_address ? (customer.shipping_address === (customer.billing_address || customer.address)) : true,
      city: customer.city || "",
      state: customer.state || "",
      country: customer.country || "India",
      postal_code: customer.postal_code || customer.pincode || "",
      gst_number: customer.gst_number || "",
      pan_number: customer.pan_number || "",
      date_of_birth: customer.date_of_birth || "",
      anniversary_date: customer.anniversary_date || "",
      gender: customer.gender || "",
      preferred_language: customer.preferred_language || "English",
      credit_limit: customer.credit_limit,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        alternate_phone: form.alternate_phone || null,
        whatsapp_number: form.whatsapp_number || null,
        company_name: form.company_name || null,
        contact_person: form.contact_person || null,
        customer_type: form.customer_type,
        status: form.status,
        source: form.source || null,
        address: form.address || null,
        billing_address: form.address || null,
        shipping_address: form.isShippingSameAsBilling ? (form.address || null) : (form.shipping_address || null),
        city: form.city || null,
        state: form.state || null,
        country: form.country || null,
        postal_code: form.postal_code || form.pincode || null,
        gst_number: form.gst_number || null,
        pan_number: form.pan_number || null,
        date_of_birth: form.date_of_birth || null,
        anniversary_date: form.anniversary_date || null,
        gender: form.gender || null,
        preferred_language: form.preferred_language || null,
        credit_limit: Number(form.credit_limit) || 0,
      };

      if (editingId) {
        const updated = await crmCustomersApi.update(editingId, payload);
        setCustomers((curr) => curr.map((c) => (c.id === editingId ? updated : c)));
        if (selectedCustomer?.id === editingId) setSelectedCustomer(updated);
        toast.success("Customer updated");
      } else {
        const created = await crmCustomersApi.create(payload);
        setCustomers((curr) => [created, ...curr]);
        setTotal((t) => t + 1);
        toast.success("Customer created");
      }
      setShowForm(false);
      resetForm();
    } catch {
      toast.error(editingId ? "Could not update customer" : "Could not create customer");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this customer?")) return;
    try {
      await crmCustomersApi.update(id, { status: "Inactive" });
      setCustomers((curr) => curr.map((c) => (c.id === id ? { ...c, status: "Inactive" } : c)));
      if (selectedCustomer?.id === id) setSelectedCustomer(null);
      toast.success("Customer deactivated");
    } catch {
      toast.error("Could not delete customer");
    }
  };

  const inputCls =
    "w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customers</h1>
          <p className="text-sm text-muted-foreground">
            Manage your customer relationships from one tenant-scoped source of truth.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center justify-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium"
        >
          <UserPlus className="size-4" /> Add Customer
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Customers" value={total} icon={<Users className="size-5" />} />
        <StatCard label="Active" value={stats.active} icon={<UserPlus className="size-5" />} />
        <StatCard label="VIP / Corporate" value={stats.vip} icon={<Star className="size-5" />} />
        <StatCard label="Lifetime Value" value={`₹${stats.totalLtv.toLocaleString()}`} icon={<DollarSign className="size-5" />} />
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">{editingId ? "Edit Customer" : "New Customer"}</h3>
            <button type="button" onClick={() => { setShowForm(false); resetForm(); }}>
              <X className="size-5 text-muted-foreground hover:text-foreground" />
            </button>
          </div>

          {/* Basic Info */}
          <FieldSection label="Basic Information">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input label="Full Name *" value={form.name as string} onChange={(v) => setForm({ ...form, name: v })} required />
              <Input label="Email" type="email" value={form.email as string} onChange={(v) => setForm({ ...form, email: v })} />
              <Input label="Phone" value={form.phone as string} onChange={(v) => setForm({ ...form, phone: v })} />
              <Input label="Alternate Phone" value={form.alternate_phone as string} onChange={(v) => setForm({ ...form, alternate_phone: v })} />
              <Input label="WhatsApp Number" value={form.whatsapp_number as string} onChange={(v) => setForm({ ...form, whatsapp_number: v })} />
              <Select label="Gender" value={form.gender as string} onChange={(v) => setForm({ ...form, gender: v })} options={["", ...GENDERS]} />
            </div>
          </FieldSection>

          {/* Company */}
          <FieldSection label="Company">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input label="Company Name" value={form.company_name as string} onChange={(v) => setForm({ ...form, company_name: v })} />
              <Input label="Contact Person" value={form.contact_person as string} onChange={(v) => setForm({ ...form, contact_person: v })} />
              <Select label="Customer Type" value={form.customer_type as string} onChange={(v) => setForm({ ...form, customer_type: v })} options={CUSTOMER_TYPES} />
            </div>
          </FieldSection>

          {/* Address */}
          <FieldSection label="Address">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input label="Billing Address" value={form.address as string} onChange={(v) => setForm({ ...form, address: v })} />
              <Input label="City" value={form.city as string} onChange={(v) => setForm({ ...form, city: v })} />
              <Input label="State" value={form.state as string} onChange={(v) => setForm({ ...form, state: v })} />
              <Input label="Country" value={form.country as string} onChange={(v) => setForm({ ...form, country: v })} />
              <Input label="Pincode" value={form.postal_code as string} onChange={(v) => setForm({ ...form, postal_code: v })} />
            </div>

            <div className="flex items-center gap-2 mt-4 mb-2">
              <input 
                type="checkbox" 
                id="sameAsBilling" 
                checked={form.isShippingSameAsBilling as boolean} 
                onChange={(e) => setForm({...form, isShippingSameAsBilling: e.target.checked})}
                className="rounded border-border text-primary focus:ring-primary"
              />
              <label htmlFor="sameAsBilling" className="text-xs cursor-pointer text-muted-foreground">Shipping address same as Billing address</label>
            </div>
            
            {!(form.isShippingSameAsBilling as boolean) && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input label="Shipping Address" value={(form.shipping_address as string) || ""} onChange={(v) => setForm({ ...form, shipping_address: v })} />
              </div>
            )}
          </FieldSection>

          {/* Tax & Financial */}
          <FieldSection label="Tax & Financial">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  GST Number (GSTIN) — Auto-Fill Customer Profile
                </label>
                <div className="flex gap-2">
                  <input
                    value={(form.gst_number as string) || ""}
                    onChange={(e) => setForm({ ...form, gst_number: e.target.value.toUpperCase() })}
                    placeholder="e.g. 37AAAAA0000A1Z5"
                    className="flex-1 rounded-lg border border-border bg-background/80 px-3 py-2 text-sm uppercase font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyGstin}
                    disabled={verifyingGst || !form.gst_number}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                  >
                    {verifyingGst ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5" />
                    )}
                    Verify & Autofill Details
                  </button>
                </div>
              </div>
              <Input label="PAN Number" value={form.pan_number as string} onChange={(v) => setForm({ ...form, pan_number: v })} />
              <Input label="Credit Limit (₹)" type="number" value={String(form.credit_limit)} onChange={(v) => setForm({ ...form, credit_limit: Number(v) })} />
              <Select label="Status" value={form.status as string} onChange={(v) => setForm({ ...form, status: v })} options={STATUSES} />
              <Input label="Source" value={form.source as string} onChange={(v) => setForm({ ...form, source: v })} />
            </div>
          </FieldSection>

          {/* Personal */}
          <FieldSection label="Personal">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input label="Date of Birth" type="date" value={form.date_of_birth as string} onChange={(v) => setForm({ ...form, date_of_birth: v })} />
              <Input label="Anniversary Date" type="date" value={form.anniversary_date as string} onChange={(v) => setForm({ ...form, anniversary_date: v })} />
              <Select label="Preferred Language" value={form.preferred_language as string} onChange={(v) => setForm({ ...form, preferred_language: v })} options={["English", "Hindi", "Tamil", "Telugu", "Kannada", "Malayalam"]} />
            </div>
          </FieldSection>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">
              Cancel
            </button>
            <button disabled={saving} className="rounded-md bg-primary px-6 py-2 text-sm text-primary-foreground font-medium">
              {saving ? "Saving…" : editingId ? "Update Customer" : "Create Customer"}
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-4 glass-panel p-4 rounded-xl border border-border/50">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, company, GST..."
            className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm border border-border bg-background"
          >
            <option value="All">All Status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm border border-border bg-background"
          >
            <option value="All">All Types</option>
            {CUSTOMER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Customer Table */}
      {loading ? (
        <div className="py-16 text-center text-muted-foreground">Loading customers…</div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Customer</th>
                  <th className="text-left px-4 py-3 font-medium">Contact</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">City</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Lifetime Value</th>
                  <th className="text-left px-4 py-3 font-medium">Orders</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => setSelectedCustomer(customer)}
                    className={cn(
                      "hover:bg-muted/30 cursor-pointer transition-colors",
                      selectedCustomer?.id === customer.id && "bg-primary/5"
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center text-xs">
                          {customer.name.split(" ").slice(0, 2).map((p) => p[0]).join("")}
                        </div>
                        <div>
                          <p className="font-medium">{customer.name}</p>
                          {customer.company_name && <p className="text-xs text-muted-foreground">{customer.company_name}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {customer.email || customer.phone || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                        <Tag className="size-3" />{customer.customer_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {customer.city || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-md px-2 py-1 text-xs font-medium",
                        customer.status === "Active" && "bg-emerald-500/10 text-emerald-600",
                        customer.status === "Inactive" && "bg-muted text-muted-foreground",
                        customer.status === "Blocked" && "bg-red-500/10 text-red-600",
                        customer.status === "Pending" && "bg-yellow-500/10 text-yellow-600",
                      )}>
                        {customer.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">₹{(customer.lifetime_value || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-muted-foreground">{customer.total_orders ?? 0}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={(e) => { e.stopPropagation(); openEdit(customer); }} className="p-1.5 hover:bg-muted rounded-md" title="Edit">
                          <Plus className="size-3.5 rotate-45" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(customer.id); }} className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-md" title="Deactivate">
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-muted-foreground">
                      {search || statusFilter !== "All" || type !== "All" ? "No matching customers found." : "No customers yet. Click \"Add Customer\" to create one."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
            Showing {filtered.length} of {total} customers
          </div>
        </div>
      )}

      {/* Detail Panel */}
      {selectedCustomer && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Building2 className="size-5 text-primary" /> Customer Details
            </h3>
            <button onClick={() => setSelectedCustomer(null)}>
              <X className="size-5 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Detail label="Name" value={selectedCustomer.name} />
            <Detail label="Email" value={selectedCustomer.email} icon={<Mail className="size-3.5" />} />
            <Detail label="Phone" value={selectedCustomer.phone} icon={<Phone className="size-3.5" />} />
            <Detail label="Company" value={selectedCustomer.company_name} icon={<Building2 className="size-3.5" />} />
            <Detail label="Address" value={selectedCustomer.address} icon={<MapPin className="size-3.5" />} />
            <Detail label="City" value={selectedCustomer.city} />
            <Detail label="State" value={selectedCustomer.state} />
            <Detail label="GST" value={selectedCustomer.gst_number} icon={<Tag className="size-3.5" />} />
            <Detail label="Credit Limit" value={`₹${(selectedCustomer.credit_limit || 0).toLocaleString()}`} icon={<DollarSign className="size-3.5" />} />
            <Detail label="Outstanding" value={`₹${(selectedCustomer.outstanding_balance || 0).toLocaleString()}`} icon={<DollarSign className="size-3.5" />} />
            <Detail label="Total Orders" value={String(selectedCustomer.total_orders)} icon={<ShoppingCart className="size-3.5" />} />
            <Detail label="Last Order" value={selectedCustomer.last_order_at ? new Date(selectedCustomer.last_order_at).toLocaleDateString() : "—"} icon={<Calendar className="size-3.5" />} />
            <Detail label="Lifetime Value" value={`₹${(selectedCustomer.lifetime_value || 0).toLocaleString()}`} icon={<Star className="size-3.5" />} />
            <Detail label="Loyalty Points" value={String(selectedCustomer.loyalty_points_balance ?? 0)} />
          </div>
          {(selectedCustomer as any).membership_plan_id && (
            <div className="pt-3 border-t">
              <p className="text-xs text-muted-foreground">
                Membership: <span className="font-medium text-foreground">{(selectedCustomer as any).membership_status as string || (selectedCustomer as any).membership_plan_id as string}</span>
                {(selectedCustomer as any).membership_end_at && ` — Expires ${new Date((selectedCustomer as any).membership_end_at as string).toLocaleDateString()}`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="glass-panel p-5 rounded-xl border border-border/50">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold flex gap-2 items-center">
        <span className="text-primary">{icon}</span>
        {value}
      </p>
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

function Input({
  label,
  type = "text",
  value,
  onChange,
  required,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={cn("rounded-lg border border-border bg-background/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50")}
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[] | string[];
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o || "— Select —"}
          </option>
        ))}
      </select>
    </div>
  );
}

function Detail({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | null;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</p>
      <p className="text-sm font-medium mt-0.5">{value || "—"}</p>
    </div>
  );
}
