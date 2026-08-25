import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2, Search, Filter, Download, Plus, MoreHorizontal, Mail, Phone, MapPin,
  ExternalLink, Edit2, ShieldCheck, CreditCard, ChevronRight, LayoutGrid, List,
  Users, Sparkles, X, Save, Loader2, Trash2, AlertCircle, Globe, FileText, CheckCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { companiesApi, branchesApi, taxConfigurationsApi, type Company, type Branch, type TaxConfiguration } from "@/lib/api-client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

// ─── Form Modal ───────────────────────────────────────────────────────────────

function CompanyFormModal({
  company,
  onClose,
  onSaved,
}: {
  company: Company | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!company;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: company?.name ?? "",
    legal_name: company?.legal_name ?? "",
    company_type: company?.company_type ?? "",
    industry: company?.industry ?? "",
    gst_number: company?.gst_number ?? "",
    pan_number: company?.pan_number ?? "",
    registration_number: company?.registration_number ?? "",
    email: company?.email ?? "",
    phone: company?.phone ?? "",
    website: company?.website ?? "",
    country: company?.country ?? "India",
    state: company?.state ?? "",
    city: company?.city ?? "",
    address: company?.address ?? "",
    default_currency_code: company?.default_currency_code ?? "INR",
    timezone: company?.timezone ?? "Asia/Kolkata",
    language: company?.language ?? "en",
    status: company?.status ?? "active",
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await companiesApi.update(company.id, form);
        toast.success("Company updated successfully");
      } else {
        await companiesApi.create(form);
        toast.success("Company created successfully");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save company");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
              <Building2 className="size-5" />
            </div>
            <h2 className="font-bold text-lg">{isEdit ? "Edit Company" : "Create Company"}</h2>
          </div>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center">
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold mb-1.5">Company Name *</label>
              <input value={form.name} onChange={set("name")} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                placeholder="Nimbus Retail Group" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold mb-1.5">Legal Name *</label>
              <input value={form.legal_name} onChange={set("legal_name")} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                placeholder="Nimbus Retail Group Pvt. Ltd." />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Business Type</label>
              <select value={form.company_type} onChange={set("company_type")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none">
                <option value="">Select type</option>
                {["Private Limited", "Public Limited", "LLP", "Partnership", "Sole Proprietorship", "OPC", "Trust"].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Industry</label>
              <input value={form.industry} onChange={set("industry")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                placeholder="Retail, Manufacturing, etc." />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">GST Number</label>
              <input value={form.gst_number} onChange={set("gst_number")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                placeholder="29AABCU9603R1ZX" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">PAN Number</label>
              <input value={form.pan_number} onChange={set("pan_number")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                placeholder="AABCU9603R" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={set("email")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                placeholder="company@email.com" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Phone</label>
              <input value={form.phone} onChange={set("phone")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                placeholder="+91 98765 43210" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Website</label>
              <input value={form.website} onChange={set("website")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                placeholder="https://company.com" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Currency</label>
              <select value={form.default_currency_code} onChange={set("default_currency_code")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none">
                {["INR", "USD", "EUR", "GBP", "AED", "SGD"].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Country</label>
              <input value={form.country} onChange={set("country")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">State</label>
              <input value={form.state} onChange={set("state")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">City</label>
              <input value={form.city} onChange={set("city")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1.5">Address</label>
              <textarea value={form.address} onChange={set("address")} rows={2}
                className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none resize-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Status</label>
              <select value={form.status} onChange={set("status")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="gradient-brand text-white border-0 min-w-[100px]">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <><Save className="size-4 mr-1.5" />{isEdit ? "Update" : "Create"}</>}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirmModal({ company, onClose, onDeleted }: { company: Company; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await companiesApi.delete(company.id);
      toast.success(`${company.name} deleted`);
      window.dispatchEvent(new CustomEvent("bos-tenant-changed"));
      window.dispatchEvent(new Event("storage"));
      onDeleted();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete company");
    } finally {
      setDeleting(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="size-10 rounded-lg bg-red-500/10 text-red-500 grid place-items-center">
            <AlertCircle className="size-5" />
          </div>
          <h3 className="font-bold">Delete Company</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Are you sure you want to delete <span className="font-semibold text-foreground">{company.name}</span>? This action cannot be undone and will remove all associated data.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
            {deleting ? <Loader2 className="size-4 animate-spin mr-1" /> : <Trash2 className="size-4 mr-1" />}
            Delete
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CompanyManagement() {
  const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [deleteCompany, setDeleteCompany] = useState<Company | null>(null);
  const [activeTab, setActiveTab] = useState("Overview");

  // Sub-data states
  const [companyBranches, setCompanyBranches] = useState<Branch[]>([]);
  const [companyTaxes, setCompanyTaxes] = useState<TaxConfiguration[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [subLoading, setSubLoading] = useState(false);

  const activeCompany = companies.find((c) => c.id === activeCompanyId) ?? companies[0] ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await companiesApi.list(1, 50, search || undefined);
      setCompanies(res.items);
      setTotal(res.total);
      if (res.items.length > 0) {
        if (!activeCompanyId || !res.items.some(c => c.id === activeCompanyId)) {
          setActiveCompanyId(res.items[0].id);
        }
      } else {
        setActiveCompanyId(null);
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : "Failed to load");
      setCompanies([]);
      setTotal(0);
      setActiveCompanyId(null);
    } finally {
      setLoading(false);
    }
  }, [search, activeCompanyId]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [search, tenant?.id]);

  useEffect(() => { void load(); }, [tenant?.id]);

  // Fetch sub-tab data whenever activeCompanyId or activeTab changes
  useEffect(() => {
    if (!activeCompany) return;
    const fetchSubData = async () => {
      setSubLoading(true);
      try {
        const storedAuth = localStorage.getItem("bos-auth");
        const token = storedAuth ? (JSON.parse(storedAuth) as { accessToken?: string }).accessToken : null;

        if (activeTab === "Branches" || activeTab === "Overview") {
          const brRes = await branchesApi.list(1, 100, undefined, activeCompany.id);
          setCompanyBranches(brRes.items);
        }
        if (activeTab === "Tax & Finance") {
          const taxRes = await taxConfigurationsApi.list(1, 100, activeCompany.id);
          setCompanyTaxes(taxRes.items);
        }
        if (activeTab === "Overview" && token) {
          // Fetch real user counts
          const userRes = await fetch(`${API_BASE_URL}/erp/users`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (userRes.ok) {
            const data = await userRes.json();
            setTotalUsers(data.total ?? data.items?.length ?? 0);
          }
        }
      } catch (err) {
        console.error("Failed to load sub-tab data:", err);
      } finally {
        setSubLoading(false);
      }
    };
    void fetchSubData();
  }, [activeCompanyId, activeTab, activeCompany]);

  const filtered = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.gst_number ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* Company List Sidebar */}
      <div className="w-72 xl:w-88 flex flex-col border-r border-border bg-card/50 shrink-0 h-full">
        <div className="p-5 border-b border-border bg-card sticky top-0 z-10">
          <div className="flex items-center gap-3 mb-1">
            <div className="size-9 rounded-xl gradient-brand text-white grid place-items-center shadow-sm">
              <Building2 className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight leading-tight">Company Management</h2>
              <p className="text-muted-foreground text-[11px]">Manage legal entities within your ERP.</p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground outline-none transition-all"
                placeholder="Search by name, GST..."
              />
            </div>
            <Button variant="outline" size="sm" className="h-9 px-3 shrink-0"><Filter className="size-3.5 mr-1" /> Filters</Button>
          </div>
          <div className="flex justify-between items-center mt-3">
            <span className="text-[10px] font-semibold text-muted-foreground">
              Showing {filtered.length} of {total} companies
            </span>
            <div className="flex bg-muted rounded-md p-0.5 gap-0.5">
              <button className="p-1.5 rounded-sm bg-background shadow-sm text-foreground"><List className="size-3" /></button>
              <button className="p-1.5 rounded-sm text-muted-foreground hover:text-foreground"><LayoutGrid className="size-3" /></button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl border bg-muted/30 animate-pulse" />
            ))
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <Building2 className="size-8 mx-auto mb-2 opacity-30" />
              No companies found.
            </div>
          ) : (
            filtered.map((company) => {
              const isActive = company.id === activeCompanyId;
              const initials = company.logo_initials ?? company.name.slice(0, 2).toUpperCase();
              return (
                <button
                  key={company.id}
                  onClick={() => { setActiveCompanyId(company.id); setActiveTab("Overview"); }}
                  className={cn(
                    "w-full text-left p-4 rounded-xl border transition-all relative flex flex-col gap-3 group",
                    isActive
                      ? "bg-primary/5 border-primary/30 shadow-sm"
                      : "bg-card hover:border-primary/20 hover:shadow-sm",
                  )}
                >
                  <div className="flex gap-3 w-full">
                    <div className="size-10 rounded-lg gradient-brand text-white grid place-items-center font-bold text-sm shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h3 className={cn("font-bold text-sm tracking-tight truncate", isActive ? "text-primary" : "text-foreground")}>
                        {company.name}
                      </h3>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {company.company_type ?? "Company"} • {company.industry ?? "General"}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className={`size-1.5 rounded-full ${company.status === "active" ? "bg-emerald-500" : "bg-rose-500"}`} />
                        <span className={cn("text-[10px] font-medium capitalize", company.status === "active" ? "text-emerald-600" : "text-rose-600")}>
                          {company.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="w-full text-[10px] font-mono text-muted-foreground pt-2 border-t flex justify-between items-center">
                    <span>GST: {company.gst_number ?? "N/A"}</span>
                    <ChevronRight className={cn("size-3.5 transition-transform", isActive ? "text-primary translate-x-0.5" : "text-muted-foreground opacity-0 group-hover:opacity-100")} />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Detail Column */}
      <div className="flex-1 overflow-y-auto bg-muted/20 flex flex-col">
        {!activeCompany && !loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-5">
            <div className="size-20 rounded-3xl bg-card border-2 border-dashed border-border flex items-center justify-center">
              <Building2 className="size-10 opacity-20" />
            </div>
            <div className="text-center">
              <p className="font-bold text-foreground">No Company Selected</p>
              <p className="text-sm text-muted-foreground mt-1">Choose a company from the list or create one.</p>
            </div>
            <Button className="gradient-brand text-white border-0 h-10 px-6" onClick={() => { setEditCompany(null); setShowForm(true); }}>
              <Plus className="size-4 mr-2" /> Create First Company
            </Button>
          </div>
        ) : activeCompany && (
          <div className="flex flex-col h-full">
            {/* ── Top Action Bar ── */}
            <div className="flex items-center justify-between px-8 py-4 bg-card border-b border-border sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl gradient-brand text-white grid place-items-center font-bold text-sm shrink-0 shadow-md">
                  {activeCompany.logo_initials ?? activeCompany.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-extrabold tracking-tight leading-tight">{activeCompany.name}</h1>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${activeCompany.status === "active" ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`}>
                      <span className={`size-1.5 rounded-full ${activeCompany.status === "active" ? "bg-emerald-500" : "bg-rose-500"}`} />
                      {activeCompany.status.charAt(0).toUpperCase() + activeCompany.status.slice(1)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{activeCompany.company_type ?? "Company"} • {activeCompany.industry ?? "General"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-9 gap-2 font-semibold">
                  <Download className="size-4" /> Export
                </Button>
                <Button variant="outline" size="sm" className="h-9 gap-2 font-semibold text-rose-600 hover:text-rose-700 hover:border-rose-300"
                  onClick={() => { setDeleteCompany(activeCompany); }}>
                  <Trash2 className="size-4" /> Delete
                </Button>
                <Button variant="outline" size="sm" className="h-9 gap-2 font-semibold"
                  onClick={() => { setEditCompany(activeCompany); setShowForm(true); }}>
                  <Edit2 className="size-4" /> Edit
                </Button>
                <Button size="sm" className="h-9 gap-2 gradient-brand text-white border-0 font-semibold px-5"
                  onClick={() => { setEditCompany(null); setShowForm(true); }}>
                  <Plus className="size-4" /> New Company
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9"><MoreHorizontal className="size-4" /></Button>
              </div>
            </div>

            {/* ── Quick Info Strip ── */}
            <div className="grid grid-cols-4 divide-x divide-border border-b border-border bg-card">
              {[
                { label: "Legal Name", value: activeCompany.legal_name ?? "—", icon: null },
                { label: "Email", value: activeCompany.email ?? "—", icon: Mail },
                { label: "Phone", value: activeCompany.phone ?? "—", icon: Phone },
                { label: "Website", value: activeCompany.website ?? "—", icon: ExternalLink, link: true },
              ].map(({ label, value, icon: Icon, link }) => (
                <div key={label} className="px-6 py-3">
                  <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1 flex items-center gap-1">
                    {Icon && <Icon className="size-3" />} {label}
                  </div>
                  {link ? (
                    <a href={activeCompany.website ?? "#"} target="_blank" rel="noreferrer" className="text-sm font-semibold text-primary hover:underline truncate block">{value}</a>
                  ) : (
                    <div className="text-sm font-semibold truncate">{value}</div>
                  )}
                </div>
              ))}
            </div>

            {/* ── Tabs Switcher ── */}
            <div className="bg-card border-b border-border px-8">
              <div className="flex gap-0 overflow-x-auto scrollbar-hide">
                {["Overview", "Additional Info", "Tax & Finance", "Branches", "Contacts", "Documents"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "relative py-4 px-4 text-sm font-bold border-b-2 whitespace-nowrap transition-all duration-200",
                      activeTab === tab
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30",
                    )}
                  >
                    {tab}
                    {tab === "Branches" && companyBranches.length > 0 && (
                      <span className="ml-2 bg-primary text-primary-foreground text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">
                        {companyBranches.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Tab Content Area ── */}
            <div className="flex-1 overflow-y-auto p-8">

            <AnimatePresence mode="wait">
              {subLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <Loader2 className="size-8 text-primary animate-spin" />
                </div>
              ) : (
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="h-full"
                >
                  {/* OVERVIEW TAB */}
                  {activeTab === "Overview" && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* General Info Card */}
                        <Card className="p-6 h-fit">
                          <div className="flex items-center gap-2 mb-6 text-foreground">
                            <Building2 className="size-4 text-primary" />
                            <h3 className="font-bold">General Information</h3>
                          </div>
                          <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                            {[
                              { label: "GST Number", value: activeCompany.gst_number, mono: true },
                              { label: "Country", value: activeCompany.country },
                              { label: "PAN Number", value: activeCompany.pan_number, mono: true },
                              { label: "State", value: activeCompany.state },
                              { label: "Registration No.", value: activeCompany.registration_number, mono: true },
                              { label: "City", value: activeCompany.city },
                              { label: "Industry", value: activeCompany.industry },
                              { label: "Timezone", value: activeCompany.timezone },
                              { label: "Currency", value: activeCompany.default_currency_code },
                              { label: "Language", value: activeCompany.language },
                            ].map(({ label, value, mono }) => (
                              <div key={label}>
                                <div className="text-[10px] font-semibold text-muted-foreground mb-1">{label}</div>
                                <div className={cn("text-sm font-semibold", mono && "font-mono")}>{value ?? "—"}</div>
                              </div>
                            ))}
                            <div className="col-span-2">
                              <div className="text-[10px] font-semibold text-muted-foreground mb-1">Address</div>
                              <div className="text-sm font-medium">{activeCompany.address ?? "—"}</div>
                            </div>
                          </div>
                        </Card>

                        {/* Financial Card */}
                        <Card className="p-6 h-fit bg-muted/5">
                          <div className="flex items-center gap-2 mb-6 text-foreground">
                            <CreditCard className="size-4 text-primary" />
                            <h3 className="font-bold">Financial & Operational Summary</h3>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            {[
                              { label: "Currency", value: activeCompany.default_currency_code },
                              { label: "Timezone", value: activeCompany.timezone },
                              { label: "Tax Label", value: activeCompany.tax_config_label ?? "—" },
                              { label: "FY Start Month", value: `Month ${activeCompany.financial_year_start_month}` },
                              { label: "Business Type", value: activeCompany.company_type ?? "—" },
                              { label: "Status", value: activeCompany.status.charAt(0).toUpperCase() + activeCompany.status.slice(1) },
                            ].map(({ label, value }) => (
                              <div key={label} className="bg-card border rounded-lg p-3">
                                <div className="text-[10px] font-semibold text-muted-foreground mb-1">{label}</div>
                                <div className="text-sm font-bold capitalize text-foreground">{value}</div>
                              </div>
                            ))}
                          </div>
                        </Card>
                      </div>

                      {/* Subscription Plan Banner */}
                      <Card className="p-6 border-primary/20 bg-primary/5">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <div className="flex gap-4 items-center">
                            <div className="size-12 rounded-lg bg-primary text-primary-foreground grid place-items-center shadow-md">
                              <ShieldCheck className="size-6" />
                            </div>
                            <div>
                              <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-0.5">Subscription Plan</div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-lg font-black">{activeCompany.plan ?? "Standard"} Plan</h4>
                                <span className="bg-primary/20 text-primary px-2 py-0.5 rounded text-[10px] font-bold">Active</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-8 text-sm">
                            <div>
                              <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-semibold mb-1"><Users className="size-3.5" /> Users</div>
                              <div className="font-mono font-bold text-sm">{totalUsers || "—"} <span className="text-muted-foreground">/ 50</span></div>
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-semibold mb-1"><Sparkles className="size-3.5" /> AI Credits</div>
                              <div className="font-mono font-bold text-sm">18,500 <span className="text-muted-foreground">/ 50K</span></div>
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-semibold mb-1"><Building2 className="size-3.5" /> Branches</div>
                              <div className="font-mono font-bold text-sm">{companyBranches.length || "—"} <span className="text-muted-foreground">/ 10</span></div>
                            </div>
                          </div>
                          <Button variant="outline" className="h-10 bg-background hover:bg-muted font-semibold">Manage Subscription</Button>
                        </div>
                      </Card>
                    </div>
                  )}

                  {/* ADDITIONAL INFO TAB */}
                  {activeTab === "Additional Info" && (
                    <Card className="p-6">
                      <h3 className="font-bold text-base mb-4 flex items-center gap-2"><Globe className="size-4 text-primary" /> Corporate & Metadata</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div>
                          <div className="text-[10px] font-bold text-muted-foreground mb-1">Company Type / Legal entity</div>
                          <div className="text-sm font-semibold">{activeCompany.company_type ?? "Not Set"}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-muted-foreground mb-1">Industry Classification</div>
                          <div className="text-sm font-semibold">{activeCompany.industry ?? "Not Set"}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-muted-foreground mb-1">Established / Inc. Date</div>
                          <div className="text-sm font-semibold">{activeCompany.established_date ?? "Not Set"}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-muted-foreground mb-1">System Tenant ID</div>
                          <div className="text-sm font-mono text-muted-foreground truncate">{activeCompany.tenant_id}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-muted-foreground mb-1">Active Plan Tier</div>
                          <div className="text-sm font-semibold capitalize">{activeCompany.plan ?? "Starter"}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-muted-foreground mb-1">Entity Status</div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold mt-1 ${activeCompany.status === "active" ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`}>
                            {activeCompany.status}
                          </span>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* TAX & FINANCE TAB */}
                  {activeTab === "Tax & Finance" && (
                    <Card className="p-6 space-y-6">
                      <div>
                        <h3 className="font-bold text-base mb-4 flex items-center gap-2"><CreditCard className="size-4 text-primary" /> Tax Identifiers & FY</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          <div>
                            <div className="text-[10px] font-bold text-muted-foreground mb-1">GST Registration Number</div>
                            <div className="text-sm font-mono font-semibold">{activeCompany.gst_number ?? "Not Registered"}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold text-muted-foreground mb-1">PAN Number</div>
                            <div className="text-sm font-mono font-semibold">{activeCompany.pan_number ?? "Not Set"}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold text-muted-foreground mb-1">Corporate Registration No (CIN/LLPIN)</div>
                            <div className="text-sm font-mono font-semibold">{activeCompany.registration_number ?? "Not Set"}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold text-muted-foreground mb-1">Accounting Currency</div>
                            <div className="text-sm font-semibold">{activeCompany.default_currency_code}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold text-muted-foreground mb-1">FY Start Month</div>
                            <div className="text-sm font-semibold">Month {activeCompany.financial_year_start_month} (April to March default)</div>
                          </div>
                        </div>
                      </div>

                      <div className="border-t pt-6">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Linked Tax Configurations</h4>
                        {companyTaxes.length === 0 ? (
                          <div className="text-sm text-muted-foreground bg-muted/20 p-4 rounded-xl border border-dashed text-center">
                            No custom tax configurations linked to this company profile.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {companyTaxes.map((tax) => (
                              <div key={tax.id} className="border rounded-xl p-3 flex justify-between items-center bg-card">
                                <div>
                                  <div className="font-semibold text-sm">{tax.name}</div>
                                  <div className="text-[10px] text-muted-foreground uppercase">{tax.tax_type}</div>
                                </div>
                                <div className="text-lg font-black text-primary">{tax.rate_percent}%</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </Card>
                  )}

                  {/* BRANCHES TAB */}
                  {activeTab === "Branches" && (
                    <Card className="p-6">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-base flex items-center gap-2"><Building2 className="size-4 text-primary" /> Active Company Branches</h3>
                      </div>
                      {companyBranches.length === 0 ? (
                        <div className="text-sm text-muted-foreground py-12 text-center bg-muted/20 rounded-xl border border-dashed">
                          No physical branches found for this entity. Add branches under the Branch Management tab.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/50 border-b">
                              <tr>
                                <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground text-xs">Code</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground text-xs">Branch Name</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground text-xs">Location / City</th>
                                <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground text-xs">Warehouse</th>
                                <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground text-xs">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {companyBranches.map((branch) => (
                                <tr key={branch.id} className="hover:bg-muted/10 transition-colors">
                                  <td className="px-4 py-3 font-mono text-xs font-bold text-primary">{branch.code}</td>
                                  <td className="px-4 py-3 font-semibold">{branch.name}</td>
                                  <td className="px-4 py-3 text-muted-foreground">{branch.city ? `${branch.city}, ${branch.state || ""}` : branch.country ?? "—"}</td>
                                  <td className="px-4 py-3 text-xs">
                                    {branch.has_warehouse ? (
                                      <span className="text-emerald-600 font-semibold flex items-center gap-1"><CheckCircle className="size-3" /> Yes</span>
                                    ) : <span className="text-muted-foreground">No</span>}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize",
                                      branch.status === "active" ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground")}>
                                      {branch.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </Card>
                  )}

                  {/* CONTACTS TAB */}
                  {activeTab === "Contacts" && (
                    <Card className="p-6">
                      <h3 className="font-bold text-base mb-4 flex items-center gap-2"><Phone className="size-4 text-primary" /> Corporate Contact Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <div className="text-[10px] font-bold text-muted-foreground mb-0.5">Primary Contact Email</div>
                            <a href={`mailto:${activeCompany.email ?? ""}`} className="text-sm font-semibold text-primary hover:underline flex items-center gap-1.5">
                              <Mail className="size-4 text-muted-foreground" /> {activeCompany.email ?? "No email configured"}
                            </a>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold text-muted-foreground mb-0.5">Phone Number</div>
                            <span className="text-sm font-semibold flex items-center gap-1.5">
                              <Phone className="size-4 text-muted-foreground" /> {activeCompany.phone ?? "No phone configured"}
                            </span>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold text-muted-foreground mb-0.5">Website</div>
                            <a href={activeCompany.website ?? "#"} target="_blank" rel="noreferrer" className="text-sm font-semibold text-primary hover:underline flex items-center gap-1.5">
                              <ExternalLink className="size-4 text-muted-foreground" /> {activeCompany.website ?? "No website configured"}
                            </a>
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-bold text-muted-foreground mb-1 flex items-center gap-1"><MapPin className="size-3" /> Registered Office Address</div>
                          <div className="bg-muted/30 border p-4 rounded-xl text-sm font-medium leading-relaxed">
                            <div className="font-bold mb-1">{activeCompany.legal_name}</div>
                            {activeCompany.address && <div>{activeCompany.address}</div>}
                            {(activeCompany.city || activeCompany.state) && <div>{activeCompany.city}{activeCompany.city && activeCompany.state ? ", " : ""}{activeCompany.state}</div>}
                            {activeCompany.country && <div>{activeCompany.country}</div>}
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* DOCUMENTS TAB */}
                  {activeTab === "Documents" && (
                    <Card className="p-6">
                      <h3 className="font-bold text-base mb-4 flex items-center gap-2"><FileText className="size-4 text-primary" /> Verified Compliance Documents</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { name: "Certificate of Incorporation", type: "COI", format: "PDF", date: "2026-01-15", status: "Verified" },
                          { name: "GSTIN Certificate (REG-06)", type: "GST", format: "PDF", date: "2026-02-10", status: "Verified" },
                          { name: "Company PAN Card Copy", type: "PAN", format: "PDF", date: "2026-01-20", status: "Verified" },
                          { name: "SaaS Subscription Agreement", type: "AGR", format: "PDF", date: "2026-07-04", status: "Active" },
                        ].map((doc) => (
                          <div key={doc.name} className="border rounded-xl p-4 flex justify-between items-center bg-card hover:border-primary/20 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                                <FileText className="size-5" />
                              </div>
                              <div>
                                <div className="font-bold text-sm">{doc.name}</div>
                                <div className="text-[10px] text-muted-foreground font-mono">Type: {doc.type} • {doc.format} • Uploaded {doc.date}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="bg-emerald-500/10 text-emerald-600 font-semibold px-2 py-0.5 rounded text-[10px]">
                                {doc.status}
                              </span>
                              <Button variant="ghost" size="icon" className="size-8"><Download className="size-4 text-muted-foreground hover:text-foreground" /></Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showForm && (
          <CompanyFormModal
            company={editCompany}
            onClose={() => { setShowForm(false); setEditCompany(null); }}
            onSaved={load}
          />
        )}
        {deleteCompany && (
          <DeleteConfirmModal
            company={deleteCompany}
            onClose={() => setDeleteCompany(null)}
            onDeleted={() => { setActiveCompanyId(null); void load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
