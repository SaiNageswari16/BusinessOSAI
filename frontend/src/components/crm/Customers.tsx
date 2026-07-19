import React, { useEffect, useMemo, useState } from "react";
import { Building, Mail, Phone, Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { crmCustomersApi, type CrmCustomer } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const types = ["All", "Retail", "Corporate", "Wholesale", "VIP", "Distributor", "Dealer"];
const blankCustomer = { name: "", email: "", phone: "", company_name: "", customer_type: "Retail" };

export function Customers() {
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("All");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(blankCustomer);

  const load = async () => {
    setLoading(true);
    try {
      const response = await crmCustomersApi.list(1, 100, search || undefined, type === "All" ? undefined : type);
      setCustomers(response.items); setTotal(response.total);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load customers"); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [type]);
  const visibleCustomers = useMemo(() => {
    const term = search.toLowerCase();
    return customers.filter((customer) => !term || customer.name.toLowerCase().includes(term) || customer.email?.toLowerCase().includes(term) || customer.phone?.includes(search));
  }, [customers, search]);
  const activeCustomers = customers.filter((customer) => customer.status === "Active").length;

  const createCustomer = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true);
    try {
      const customer = await crmCustomersApi.create({ ...form, email: form.email || null, phone: form.phone || null, company_name: form.company_name || null });
      setCustomers((current) => [customer, ...current]); setTotal((current) => current + 1); setForm(blankCustomer); setShowForm(false); toast.success("Customer created");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not create customer"); }
    finally { setSaving(false); }
  };

  return <div className="p-6 space-y-6">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div><h1 className="text-2xl font-bold text-foreground">Customers</h1><p className="text-sm text-muted-foreground">Manage your customer relationships from one tenant-scoped source of truth.</p></div>
      <button onClick={() => setShowForm((value) => !value)} className="flex items-center justify-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium"><Plus className="size-4" /> Add Customer</button>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Metric label="Total Customers" value={total} /><Metric label="Active Customers" value={activeCustomers} /><Metric label="Showing" value={visibleCustomers.length} />
    </div>
    {showForm && <form onSubmit={createCustomer} className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-xl border border-border bg-card p-4">
      <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Customer name" className="field" />
      <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="field" />
      <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="field" />
      <input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Company" className="field" />
      <select value={form.customer_type} onChange={(e) => setForm({ ...form, customer_type: e.target.value })} className="field">{types.slice(1).map((value) => <option key={value}>{value}</option>)}</select>
      <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowForm(false)} className="px-3 py-2 text-sm">Cancel</button><button disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">{saving ? "Saving…" : "Create"}</button></div>
    </form>}
    <div className="flex flex-col sm:flex-row items-center gap-4 glass-panel p-4 rounded-xl border border-border/50"><div className="relative flex-1 w-full"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers..." className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm" /></div><div className="flex gap-2 overflow-x-auto w-full sm:w-auto">{types.map((value) => <button key={value} onClick={() => setType(value)} className={cn("px-3 py-2 rounded-lg text-sm whitespace-nowrap", type === value ? "bg-primary text-primary-foreground" : "border border-border")}>{value}</button>)}</div></div>
    {loading ? <div className="py-16 text-center text-muted-foreground">Loading customers…</div> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">{visibleCustomers.map((customer) => <article key={customer.id} className="glass-panel rounded-xl border border-border/50 p-5"><div className="flex gap-3 items-start"><div className="size-11 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center">{customer.name.split(" ").slice(0, 2).map((part) => part[0]).join("")}</div><div className="min-w-0"><h2 className="font-semibold truncate">{customer.name}</h2><p className="text-xs text-muted-foreground">{customer.company_name || customer.customer_type}</p></div></div><div className="mt-4 space-y-2 text-sm text-muted-foreground">{customer.email && <p className="flex gap-2 truncate"><Mail className="size-4 shrink-0" />{customer.email}</p>}{customer.phone && <p className="flex gap-2"><Phone className="size-4" />{customer.phone}</p>}<p className="flex gap-2"><Building className="size-4" />{customer.customer_type}</p></div><div className="mt-4 pt-3 border-t flex justify-between"><span className={cn("rounded px-2 py-1 text-xs", customer.status === "Active" ? "bg-emerald-500/10 text-emerald-600" : "bg-muted")}>{customer.status}</span><span className="text-xs text-muted-foreground">{new Date(customer.created_at).toLocaleDateString()}</span></div></article>)}{visibleCustomers.length === 0 && <p className="col-span-full text-center py-16 text-muted-foreground">No customers found.</p>}</div>}
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="glass-panel p-5 rounded-xl border border-border/50"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold flex gap-2 items-center"><Users className="size-5 text-primary" />{value.toLocaleString()}</p></div>; }
