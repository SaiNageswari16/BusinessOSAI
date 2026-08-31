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
  Download,
  Upload,
} from "lucide-react";
import { crmCustomersApi, inventoryApi, type CrmCustomer, type CustomerAddressItem } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { Sparkles, Loader2, PhoneCall, CheckCircle2, Clock, Trash2, Check } from "lucide-react";
import { usePincodeLookup } from "@/hooks/use-pincode-lookup";
import { AiCallingModal } from "./AiCallingModal";
import { crmCallsApi, type CRMCallLog } from "@/lib/api-client";
import { downloadCustomersTemplateExcel } from "@/lib/crm-excel-utils";
import { BulkImportCustomersModal } from "./BulkImportCustomersModal";

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

const createBlankAddress = (index: number = 1, tag: string = "Head Office"): CustomerAddressItem => ({
  id: `addr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  tag,
  type: index === 1 ? "both" : "shipping",
  street: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
  gst_number: "",
  contact_person: "",
  contact_phone: "",
  is_default_billing: index === 1,
  is_default_shipping: index === 1,
});

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
  addresses: [createBlankAddress(1, "Head Office / Billing")],
};

export function Customers() {
    const { currency, formatCurrency } = useCurrency();
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
  const [callingCustomer, setCallingCustomer] = useState<CrmCustomer | null>(null);
  const [callStatusMap, setCallStatusMap] = useState<Record<string, CRMCallLog>>({});
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>(blankCustomer);

  const { lookup: lookupPincode, loading: isLookingUpPincode } = usePincodeLookup();

  const handlePincodeChange = async (val: string) => {
    setForm(prev => ({ ...prev, postal_code: val }));
    const clean = val.replace(/\D/g, "").slice(0, 6);
    if (clean.length === 6) {
      const res = await lookupPincode(clean);
      if (res) {
        setForm(prev => ({
          ...prev,
          city: res.city || prev.city,
          state: res.state || prev.state,
          country: res.country || prev.country || "India",
          address: prev.address || res.area || ""
        }));
      }
    }
  };

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
        name: res.trade_name || res.legal_name || prev.name,
        company_name: res.legal_name || res.trade_name || prev.company_name,
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
      toast.success(
        res.is_fallback
          ? `GST State & PAN Verified: ${res.state} (PAN: ${res.pan})`
          : `GSTIN Verified: ${res.trade_name || res.legal_name} (${res.state})`
      );
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
      // Load call statuses in background
      try {
        const callRes = await crmCallsApi.listLogs(1, 200, "customer");
        const map: Record<string, CRMCallLog> = {};
        for (const log of (callRes.items || [])) {
          if (log.target_id && !map[log.target_id]) {
            map[log.target_id] = log;
          }
        }
        setCallStatusMap(map);
      } catch { /* silent */ }
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
    
    // Normalize address list from customer object
    let loadedAddresses: CustomerAddressItem[] = [];
    if (Array.isArray(customer.addresses) && customer.addresses.length > 0) {
      loadedAddresses = customer.addresses.map((a, idx) => ({
        id: a.id || `addr-${idx + 1}-${Date.now()}`,
        tag: a.tag || (idx === 0 ? "Head Office" : `Branch ${idx + 1}`),
        type: a.type || "both",
        street: a.street || "",
        city: a.city || customer.city || "",
        state: a.state || customer.state || "",
        pincode: a.pincode || customer.postal_code || customer.pincode || "",
        country: a.country || customer.country || "India",
        gst_number: a.gst_number || "",
        contact_person: a.contact_person || customer.contact_person || "",
        contact_phone: a.contact_phone || customer.phone || "",
        is_default_billing: a.is_default_billing ?? (idx === 0),
        is_default_shipping: a.is_default_shipping ?? (idx === 0),
      }));
    } else if (customer.billing_address || customer.address || customer.shipping_address) {
      const bAddr = customer.billing_address || customer.address || "";
      const sAddr = customer.shipping_address || "";
      loadedAddresses.push({
        id: "addr-1",
        tag: "Head Office / Billing",
        type: sAddr && sAddr !== bAddr ? "billing" : "both",
        street: bAddr,
        city: customer.city || "",
        state: customer.state || "",
        pincode: customer.postal_code || customer.pincode || "",
        country: customer.country || "India",
        gst_number: customer.gst_number || "",
        contact_person: customer.contact_person || "",
        contact_phone: customer.phone || "",
        is_default_billing: true,
        is_default_shipping: !sAddr || sAddr === bAddr,
      });
      if (sAddr && sAddr !== bAddr) {
        loadedAddresses.push({
          id: "addr-2",
          tag: "Warehouse / Delivery Site",
          type: "shipping",
          street: sAddr,
          city: customer.city || "",
          state: customer.state || "",
          pincode: customer.postal_code || customer.pincode || "",
          country: customer.country || "India",
          gst_number: customer.gst_number || "",
          contact_person: customer.contact_person || "",
          contact_phone: customer.phone || "",
          is_default_billing: false,
          is_default_shipping: true,
        });
      }
    } else {
      loadedAddresses = [createBlankAddress(1, "Head Office / Billing")];
    }

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
      addresses: loadedAddresses,
    });
    setShowForm(true);
  };

  const handleAddAddress = () => {
    const currList = (form.addresses as CustomerAddressItem[]) || [];
    const nextIdx = currList.length + 1;
    const newAddr = createBlankAddress(nextIdx, `Location / Branch ${nextIdx}`);
    setForm(prev => ({
      ...prev,
      addresses: [...currList, newAddr],
    }));
  };

  const handleRemoveAddress = (id: string) => {
    const currList = (form.addresses as CustomerAddressItem[]) || [];
    if (currList.length <= 1) {
      toast.error("Customer must have at least one address location");
      return;
    }
    const updated = currList.filter(a => a.id !== id);
    // If we removed default billing or shipping, ensure first one becomes default
    if (!updated.some(a => a.is_default_billing)) updated[0].is_default_billing = true;
    if (!updated.some(a => a.is_default_shipping)) updated[0].is_default_shipping = true;
    setForm(prev => ({ ...prev, addresses: updated }));
  };

  const handleUpdateAddressItem = (id: string, field: keyof CustomerAddressItem, val: any) => {
    const currList = (form.addresses as CustomerAddressItem[]) || [];
    const updated = currList.map(item => {
      if (item.id !== id) return item;
      return { ...item, [field]: val };
    });
    setForm(prev => ({ ...prev, addresses: updated }));
  };

  const handleAddressPincodeLookup = async (id: string, val: string) => {
    handleUpdateAddressItem(id, "pincode", val);
    const clean = val.replace(/\D/g, "").slice(0, 6);
    if (clean.length === 6) {
      const res = await lookupPincode(clean);
      if (res) {
        const currList = (form.addresses as CustomerAddressItem[]) || [];
        const updated = currList.map(item => {
          if (item.id !== id) return item;
          return {
            ...item,
            pincode: clean,
            city: res.city || item.city,
            state: res.state || item.state,
            country: res.country || item.country || "India",
            street: item.street || res.area || "",
          };
        });
        setForm(prev => ({ ...prev, addresses: updated }));
      }
    }
  };

  const handleSetDefaultAddress = (id: string, defType: "billing" | "shipping") => {
    const currList = (form.addresses as CustomerAddressItem[]) || [];
    const updated = currList.map(item => {
      if (defType === "billing") {
        return { ...item, is_default_billing: item.id === id };
      } else {
        return { ...item, is_default_shipping: item.id === id };
      }
    });
    setForm(prev => ({ ...prev, addresses: updated }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const addrList = (form.addresses as CustomerAddressItem[]) || [];
      const defaultBilling = addrList.find(a => a.is_default_billing) || addrList[0];
      const defaultShipping = addrList.find(a => a.is_default_shipping) || addrList.find(a => a.type === "shipping" || a.type === "both") || addrList[0];

      const fullBilling = [defaultBilling?.street, defaultBilling?.city, defaultBilling?.state, defaultBilling?.pincode].filter(Boolean).join(", ");
      const fullShipping = [defaultShipping?.street, defaultShipping?.city, defaultShipping?.state, defaultShipping?.pincode].filter(Boolean).join(", ");

      const payload = {
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        alternate_phone: form.alternate_phone || null,
        whatsapp_number: form.whatsapp_number || null,
        company_name: form.company_name || null,
        contact_person: form.contact_person || defaultBilling?.contact_person || null,
        customer_type: form.customer_type,
        status: form.status,
        source: form.source || null,
        addresses: addrList,
        address: defaultBilling?.street || fullBilling || (form.address as string) || null,
        billing_address: defaultBilling?.street || fullBilling || (form.address as string) || null,
        shipping_address: defaultShipping?.street || fullShipping || (form.shipping_address as string) || null,
        city: defaultBilling?.city || (form.city as string) || null,
        state: defaultBilling?.state || (form.state as string) || null,
        country: defaultBilling?.country || (form.country as string) || "India",
        postal_code: defaultBilling?.pincode || form.postal_code || form.pincode || null,
        gst_number: defaultBilling?.gst_number || form.gst_number || null,
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
        toast.success("Customer and addresses updated successfully");
      } else {
        const created = await crmCustomersApi.create(payload);
        setCustomers((curr) => [created, ...curr]);
        setTotal((t) => t + 1);
        toast.success("Customer created with multi-location addresses");
      }
      setShowForm(false);
      resetForm();
    } catch {
      toast.error("Failed to save customer");
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Customers</h2>
          <p className="text-xs text-muted-foreground">
            Manage your customer relationships from one tenant-scoped source of truth.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadCustomersTemplateExcel}
            className="flex items-center gap-1.5 px-3 h-8 bg-muted/60 hover:bg-muted border border-border rounded-xl text-xs font-semibold text-foreground transition-colors"
            title="Download sample formatted Excel template for customer import"
          >
            <Download className="size-3.5 text-primary" />
            Sample Excel
          </button>
          <button
            onClick={() => setShowBulkImport(true)}
            className="flex items-center gap-1.5 px-3 h-8 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400 transition-colors"
          >
            <Upload className="size-3.5 text-emerald-600" />
            Import Customers
          </button>
          <button
            onClick={openCreate}
            className="flex items-center justify-center gap-1.5 px-3 h-8 gradient-brand text-white rounded-lg text-xs font-semibold"
          >
            <UserPlus className="size-3.5" /> Add Customer
          </button>
        </div>
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

          {/* Address Book & Locations */}
          <FieldSection label={`Address Book & Locations (${((form.addresses as CustomerAddressItem[]) || []).length})`}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Define multiple branch, warehouse, and billing locations for this customer.
                </p>
                <button
                  type="button"
                  onClick={handleAddAddress}
                  className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Plus className="size-3.5" /> Add Location / Address
                </button>
              </div>

              {((form.addresses as CustomerAddressItem[]) || []).map((addr, idx) => (
                <div key={addr.id || idx} className="rounded-xl border border-border/80 bg-background/60 p-4 space-y-3.5 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="size-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={addr.tag || ""}
                        onChange={(e) => handleUpdateAddressItem(addr.id, "tag", e.target.value)}
                        placeholder="Location Tag (e.g. Head Office, Warehouse 1, Factory)"
                        className="text-xs font-bold text-foreground bg-transparent border-b border-dashed border-border px-1 py-0.5 focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={addr.type || "both"}
                        onChange={(e) => handleUpdateAddressItem(addr.id, "type", e.target.value)}
                        className="text-[11px] font-semibold bg-muted/60 border border-border rounded-lg px-2 py-1 text-foreground focus:outline-none"
                      >
                        <option value="both">Both (Billing & Shipping)</option>
                        <option value="billing">Billing Only</option>
                        <option value="shipping">Shipping Only</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => handleSetDefaultAddress(addr.id, "billing")}
                        className={`text-[10px] font-bold px-2 py-1 rounded-md border flex items-center gap-1 transition ${
                          addr.is_default_billing
                            ? "bg-indigo-500/10 text-indigo-600 border-indigo-500/30"
                            : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                        }`}
                        title="Set this address as Default Billing"
                      >
                        {addr.is_default_billing ? <Check className="size-3" /> : null}
                        Default Billing
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSetDefaultAddress(addr.id, "shipping")}
                        className={`text-[10px] font-bold px-2 py-1 rounded-md border flex items-center gap-1 transition ${
                          addr.is_default_shipping
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                            : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                        }`}
                        title="Set this address as Default Shipping"
                      >
                        {addr.is_default_shipping ? <Check className="size-3" /> : null}
                        Default Shipping
                      </button>

                      {((form.addresses as CustomerAddressItem[]) || []).length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveAddress(addr.id)}
                          className="p-1 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-md transition"
                          title="Remove Address"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2">
                      <Input
                        label="Street / Building / Area"
                        value={addr.street || ""}
                        onChange={(v) => handleUpdateAddressItem(addr.id, "street", v)}
                        placeholder="Plot #, Street, Area name..."
                      />
                    </div>
                    <Input
                      label={`Pincode ${isLookingUpPincode ? "(Looking up...)" : ""}`}
                      value={addr.pincode || ""}
                      onChange={(v) => void handleAddressPincodeLookup(addr.id, v)}
                      placeholder="e.g. 500081"
                    />
                    <Input
                      label="City"
                      value={addr.city || ""}
                      onChange={(v) => handleUpdateAddressItem(addr.id, "city", v)}
                      placeholder="City"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <Input
                      label="State"
                      value={addr.state || ""}
                      onChange={(v) => handleUpdateAddressItem(addr.id, "state", v)}
                      placeholder="State"
                    />
                    <Input
                      label="Country"
                      value={addr.country || "India"}
                      onChange={(v) => handleUpdateAddressItem(addr.id, "country", v)}
                    />
                    <Input
                      label="Location GSTIN (Optional)"
                      value={addr.gst_number || ""}
                      onChange={(v) => handleUpdateAddressItem(addr.id, "gst_number", v.toUpperCase())}
                      placeholder="Branch GSTIN"
                    />
                    <Input
                      label="Contact Person / Phone"
                      value={addr.contact_person || ""}
                      onChange={(v) => handleUpdateAddressItem(addr.id, "contact_person", v)}
                      placeholder="e.g. Manager (9849...)"
                    />
                  </div>
                </div>
              ))}
            </div>
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
        <div className="bg-card rounded-2xl border border-border/70 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-semibold tracking-wider">
                <tr>
                  <th className="px-6 py-4 text-left whitespace-nowrap">Customer</th>
                  <th className="px-6 py-4 text-left whitespace-nowrap">Contact</th>
                  <th className="px-6 py-4 text-left whitespace-nowrap">Type</th>
                  <th className="px-6 py-4 text-left whitespace-nowrap">City</th>
                  <th className="px-6 py-4 text-center whitespace-nowrap">Status</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">Lifetime Value</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">Orders</th>
                  <th className="px-6 py-4 text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30 font-medium">
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
                        <div className="size-8 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                          {customer.name.split(" ").slice(0, 2).map((p) => p[0]).join("")}
                        </div>
                        <div>
                          <p className="font-bold text-foreground">{customer.name}</p>
                          {customer.company_name && <p className="text-[11px] text-muted-foreground">{customer.company_name}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {/* Contact info with call status indicator */}
                      <div className="space-y-0.5">
                        <p className="text-muted-foreground text-xs">{customer.email || customer.phone || "—"}</p>
                        {(() => {
                          const log = callStatusMap[customer.id];
                          if (!log) return null;
                          const days = Math.floor((Date.now() - new Date(log.created_at).getTime()) / (1000 * 60 * 60 * 24));
                          const overdue = days >= 3;
                          return (
                            <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              overdue
                                ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            }`}>
                              {overdue ? <Clock className="size-2.5" /> : <CheckCircle2 className="size-2.5" />}
                              {overdue ? `Follow-up ${days}d ago` : days === 0 ? "Called today" : `Called ${days}d ago`}
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                        <Tag className="size-3" />{customer.customer_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {customer.city || "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                        customer.status === "Active" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                        customer.status === "Inactive" && "bg-muted text-muted-foreground border-border/40",
                        customer.status === "Blocked" && "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
                        customer.status === "Pending" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                      )}>
                        {customer.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-foreground">{currency.symbol}{(customer.lifetime_value || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold text-foreground">{customer.total_orders ?? 0}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); setCallingCustomer(customer); }}
                          className={`p-1.5 rounded-lg transition ${
                            callStatusMap[customer.id]
                              ? Math.floor((Date.now() - new Date(callStatusMap[customer.id].created_at).getTime()) / (1000 * 60 * 60 * 24)) >= 3
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 animate-pulse"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                              : "hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
                          }`}
                          title={callStatusMap[customer.id] ? "Called — Click to call again" : "Start AI Call"}
                        >
                          <PhoneCall className="size-3.5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); openEdit(customer); }} className="p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground" title="Edit">
                          <Plus className="size-3.5 rotate-45" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(customer.id); }} className="p-1 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 rounded-md" title="Deactivate">
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
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCallingCustomer(selectedCustomer)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition"
              >
                <PhoneCall className="size-3.5" />
                Start AI Voice Call
              </button>
              <button onClick={() => setSelectedCustomer(null)}>
                <X className="size-5 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
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

          {/* Customer Multi-Address Book List */}
          <div className="pt-3 border-t border-border space-y-2">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="size-3.5 text-primary" />
              Saved Locations & Branches ({Array.isArray(selectedCustomer.addresses) && selectedCustomer.addresses.length > 0 ? selectedCustomer.addresses.length : 1})
            </h4>
            
            {Array.isArray(selectedCustomer.addresses) && selectedCustomer.addresses.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedCustomer.addresses.map((addr: CustomerAddressItem, idx: number) => (
                  <div key={addr.id || idx} className="rounded-xl border border-border/80 bg-muted/20 p-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-primary" />
                        {addr.tag || `Location ${idx + 1}`}
                      </span>
                      <div className="flex items-center gap-1">
                        {addr.is_default_billing && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                            Default Billing
                          </span>
                        )}
                        {addr.is_default_shipping && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            Default Shipping
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-muted text-muted-foreground uppercase">
                          {addr.type || "Both"}
                        </span>
                      </div>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      {[addr.street, addr.city, addr.state, addr.pincode, addr.country].filter(Boolean).join(", ") || "No street address provided"}
                    </p>
                    {(addr.gst_number || addr.contact_person) && (
                      <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                        {addr.gst_number && <span>GSTIN: <strong className="text-foreground">{addr.gst_number}</strong></span>}
                        {addr.contact_person && <span>Contact: <strong className="text-foreground">{addr.contact_person}</strong></span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-border/60 bg-muted/10 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Primary Location</p>
                <p>{selectedCustomer.address || selectedCustomer.billing_address || "No address defined."}</p>
              </div>
            )}
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

      {/* Universal AI Calling Modal */}
      {callingCustomer && (
        <AiCallingModal
          open={!!callingCustomer}
          onClose={() => setCallingCustomer(null)}
          targetType="customer"
          targetId={callingCustomer.id}
          contactName={callingCustomer.name}
          contactPhone={callingCustomer.phone || undefined}
          contactEmail={callingCustomer.email || undefined}
          companyName={callingCustomer.company_name || undefined}
          dealValue={callingCustomer.lifetime_value}
          defaultNotes={callingCustomer.city ? `Customer based in ${callingCustomer.city}, ${callingCustomer.state}. Total orders: ${callingCustomer.total_orders || 0}.` : undefined}
          onCallCompleted={async () => {
            await load();
          }}
        />
      )}

      {/* Bulk Customer Excel / CSV Import Modal */}
      {showBulkImport && (
        <BulkImportCustomersModal
          isOpen={showBulkImport}
          onClose={() => setShowBulkImport(false)}
          onSuccess={() => {
            void load();
          }}
        />
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
  placeholder,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className={cn("rounded-lg border border-border bg-background/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-full")}
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
