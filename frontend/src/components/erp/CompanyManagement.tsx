import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2, Search, Filter, Download, Plus, MoreHorizontal, Mail, Phone, MapPin,
  ExternalLink, Edit2, ShieldCheck, CreditCard, ChevronRight, LayoutGrid, List,
  Users, Sparkles, X, Save, Loader2, Trash2, AlertCircle, Globe, FileText, CheckCircle,
  Truck, Receipt, KeyRound, Server, Activity, ArrowRight, ShieldAlert, CheckCircle2,
  Copy, RefreshCw, Layers, Shield, Upload
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  companiesApi,
  branchesApi,
  taxConfigurationsApi,
  type Company,
  type Branch,
  type TaxConfiguration,
  type GstRegistration,
  type GspCredentials
} from "@/lib/api-client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import {
  getActiveBillingGst,
  setActiveBillingGst,
  type ActiveGstDetails
} from "@/lib/receipt-template-store";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

export const STATE_GST_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "32": "Kerala", "33": "Tamil Nadu",
  "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh"
};

// ─── Company Form Modal (Multi-GST & Multi-Tenant GSP Credentials) ────────────

function CompanyFormModal({
  company,
  initialTab = "general",
  onClose,
  onSaved,
}: {
  company: Company | null;
  initialTab?: "general" | "gst" | "gsp";
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!company;
  const [activeModalTab, setActiveModalTab] = useState<"general" | "gst" | "gsp">(initialTab);
  const [saving, setSaving] = useState(false);
  const [testingModule, setTestingModule] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string; token_preview?: string }>>({});

  const [form, setForm] = useState({
    name: company?.name ?? "",
    legal_name: company?.legal_name ?? "",
    company_type: company?.company_type ?? "Private Limited",
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
    logo_url: company?.logo_url ?? "",
    default_currency_code: company?.default_currency_code ?? "INR",
    timezone: company?.timezone ?? "Asia/Kolkata",
    language: company?.language ?? "en",
    status: company?.status ?? "active",
  });

  const [gstRegistrations, setGstRegistrations] = useState<GstRegistration[]>(() => {
    if (company?.gst_registrations && company.gst_registrations.length > 0) {
      return company.gst_registrations;
    }
    if (company?.gst_number) {
      const code = company.gst_number.slice(0, 2);
      return [{
        id: "gst-1",
        gstin: company.gst_number,
        trade_name: company.name + " (Head Office)",
        state_code: code,
        state_name: STATE_GST_CODES[code] || company.state || "State",
        address: company.address ?? "",
        is_primary: true,
      }];
    }
    return [];
  });

  const [gspCreds, setGspCreds] = useState<GspCredentials>(() => {
    const existing = company?.gsp_credentials || {};
    return {
      environment: existing.environment || "sandbox",
      registered_email: existing.registered_email || "",
      ip_address: existing.ip_address || "106.213.64.83",
      ewb: {
        client_id: existing.ewb?.client_id || "",
        client_secret: existing.ewb?.client_secret || "",
        username: existing.ewb?.username || "",
        password: existing.ewb?.password || "",
        gstin: existing.ewb?.gstin || "",
        base_url: existing.ewb?.base_url || "",
      },
      gst: {
        client_id: existing.gst?.client_id || "",
        client_secret: existing.gst?.client_secret || "",
        username: existing.gst?.username || "",
        password: existing.gst?.password || "",
        gstin: existing.gst?.gstin || "",
        base_url: existing.gst?.base_url || "",
      },
      einv: {
        client_id: existing.einv?.client_id || "",
        client_secret: existing.einv?.client_secret || "",
        username: existing.einv?.username || "",
        password: existing.einv?.password || "",
        gstin: existing.einv?.gstin || "",
        base_url: existing.einv?.base_url || "",
      },
    };
  });

  const setGeneral = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  const addGstRegistration = () => {
    const newGst: GstRegistration = {
      id: `gst-${Date.now()}`,
      gstin: "",
      trade_name: "",
      state_code: "",
      state_name: "",
      address: "",
      is_primary: gstRegistrations.length === 0,
    };
    setGstRegistrations((prev) => [...prev, newGst]);
  };

  const removeGstRegistration = (index: number) => {
    setGstRegistrations((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length > 0 && !updated.some((r) => r.is_primary)) {
        updated[0].is_primary = true;
      }
      return updated;
    });
  };

  const updateGstRegistration = (index: number, field: keyof GstRegistration, val: any) => {
    setGstRegistrations((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: val };

      if (field === "gstin") {
        const cleanGst = String(val).toUpperCase().trim();
        item.gstin = cleanGst;
        if (cleanGst.length >= 2) {
          const code = cleanGst.slice(0, 2);
          item.state_code = code;
          if (STATE_GST_CODES[code]) {
            item.state_name = STATE_GST_CODES[code];
          }
        }
      }

      if (field === "is_primary" && val === true) {
        updated.forEach((r, i) => {
          if (i !== index) r.is_primary = false;
        });
      }

      updated[index] = item;
      return updated;
    });
  };

  const setPrimaryGst = (index: number) => {
    setGstRegistrations((prev) =>
      prev.map((r, i) => ({ ...r, is_primary: i === index }))
    );
  };

  const setGspModuleField = (module: "ewb" | "gst" | "einv", field: string, val: string) => {
    setGspCreds((prev) => ({
      ...prev,
      [module]: {
        ...(prev[module] || {}),
        [field]: val,
      },
    }));
  };

  const handleTestConnection = async (module: "ewb" | "gst" | "einv") => {
    setTestingModule(module);
    try {
      const payload = {
        module,
        credentials: {
          ...gspCreds,
          [module]: gspCreds[module],
        },
      };
      const res = await companiesApi.testGspConnection(payload);
      setTestResults((prev) => ({
        ...prev,
        [module]: {
          success: res.success,
          message: res.message,
          token_preview: res.token_preview,
        },
      }));
      if (res.success) {
        toast.success(`${module.toUpperCase()} Connected: ${res.message}`);
      } else {
        toast.error(`${module.toUpperCase()} Test Failed: ${res.message}`);
      }
    } catch (err: any) {
      const msg = err.detail || err.message || "Connection handshake failed";
      setTestResults((prev) => ({
        ...prev,
        [module]: { success: false, message: msg },
      }));
      toast.error(`${module.toUpperCase()} Error: ${msg}`);
    } finally {
      setTestingModule(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const primaryGst = gstRegistrations.find((r) => r.is_primary)?.gstin || gstRegistrations[0]?.gstin || form.gst_number;

      const sanitize = (val: string | null | undefined) => {
        if (!val) return null;
        const trimmed = val.trim();
        return trimmed.length > 0 ? trimmed : null;
      };

      const payload = {
        name: form.name.trim(),
        legal_name: form.legal_name.trim(),
        company_type: sanitize(form.company_type),
        industry: sanitize(form.industry),
        gst_number: sanitize(primaryGst),
        pan_number: sanitize(form.pan_number),
        registration_number: sanitize(form.registration_number),
        email: sanitize(form.email),
        phone: sanitize(form.phone),
        website: sanitize(form.website),
        country: sanitize(form.country) || "India",
        state: sanitize(form.state),
        city: sanitize(form.city),
        address: sanitize(form.address),
        logo_url: sanitize(form.logo_url),
        default_currency_code: form.default_currency_code || "INR",
        timezone: form.timezone || "Asia/Kolkata",
        language: form.language || "en",
        status: form.status || "active",
        gst_registrations: gstRegistrations,
        gsp_credentials: gspCreds,
      };

      if (isEdit) {
        await companiesApi.update(company.id, payload);
        toast.success("Organization & GSP credentials updated successfully!");
      } else {
        await companiesApi.create(payload);
        toast.success("Organization created with GST and GSP settings!");
      }

      const primaryReg = gstRegistrations.find((r) => r.is_primary) || gstRegistrations[0];
      if (primaryReg && primaryReg.gstin) {
        setActiveBillingGst({
          gstin: primaryReg.gstin,
          trade_name: primaryReg.trade_name || form.name,
          legal_name: form.legal_name || form.name,
          state_code: primaryReg.state_code || primaryReg.gstin.slice(0, 2),
          state_name: primaryReg.state_name || form.state || "State",
          address: primaryReg.address || form.address || "",
          phone: form.phone || "",
          email: form.email || "",
          cin: form.registration_number || "",
          pan: form.pan_number || "",
          logo_url: form.logo_url || "",
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to save company");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-3xl my-auto overflow-hidden flex flex-col max-h-[92vh]"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl gradient-brand text-white grid place-items-center shadow-xs">
              <Building2 className="size-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base tracking-tight text-foreground">
                {isEdit ? `Edit Organization: ${company.name}` : "Create New Organization / Legal Entity"}
              </h2>
              <p className="text-xs text-muted-foreground">
                Multi-tenant setup with Multi-GST registrations and dedicated e-Way Bill & e-Invoice credentials.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 px-6 border-b bg-card shrink-0">
          {[
            { id: "general", label: "General Profile", icon: Building2 },
            { id: "gst", label: `GST Registrations (${gstRegistrations.length})`, icon: Layers },
            { id: "gsp", label: "GSP & Govt Gateway (Whitebooks)", icon: KeyRound },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveModalTab(id as any)}
              className={cn(
                "flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap",
                activeModalTab === id
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              <Icon className="size-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeModalTab === "general" && (
            <div className="space-y-4">
              {/* ─── Organization Logo Upload & Preview ─── */}
              <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
                <label className="block text-xs font-bold text-foreground">Organization Official Logo</label>
                <div className="flex items-center gap-4">
                  <div className="size-16 rounded-xl border bg-background flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                    {form.logo_url ? (
                      <img src={form.logo_url} alt="Org Logo" className="w-full h-full object-contain p-1" />
                    ) : (
                      <Building2 className="size-7 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        id="org-logo-file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (re) => {
                              if (typeof re.target?.result === "string") {
                                setForm((prev) => ({ ...prev, logo_url: re.target!.result as string }));
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <label
                        htmlFor="org-logo-file"
                        className="px-3 py-1.5 rounded-lg border text-xs font-semibold hover:bg-muted/40 cursor-pointer flex items-center gap-1.5 shadow-2xs"
                      >
                        <Upload className="size-3.5 text-primary" /> Upload Image
                      </label>
                      {form.logo_url && (
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, logo_url: "" }))}
                          className="px-2.5 py-1.5 rounded-lg border text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          Remove Logo
                        </button>
                      )}
                    </div>
                    <input
                      value={form.logo_url}
                      onChange={setGeneral("logo_url")}
                      className="w-full h-8 px-2.5 text-xs rounded-lg border bg-background font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                      placeholder="Or paste Direct Image URL / Base64 Data URL..."
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold mb-1.5 text-foreground">Company / Organization Name *</label>
                  <input
                    value={form.name}
                    onChange={setGeneral("name")}
                    required
                    className="w-full h-9 px-3 text-xs rounded-xl border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    placeholder="e.g. Acme Retail Enterprises"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold mb-1.5 text-foreground">Legal Entity Registered Name *</label>
                  <input
                    value={form.legal_name}
                    onChange={setGeneral("legal_name")}
                    required
                    className="w-full h-9 px-3 text-xs rounded-xl border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    placeholder="e.g. Acme Retail Enterprises Pvt. Ltd."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-foreground">Business Structure</label>
                  <select
                    value={form.company_type}
                    onChange={setGeneral("company_type")}
                    className="w-full h-9 px-3 text-xs rounded-xl border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                  >
                    {["Private Limited", "Public Limited", "LLP", "Partnership", "Sole Proprietorship", "OPC", "Trust / NGO"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-foreground">Industry</label>
                  <input
                    value={form.industry}
                    onChange={setGeneral("industry")}
                    className="w-full h-9 px-3 text-xs rounded-xl border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="Retail, FMCG, Manufacturing..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-foreground">Company PAN Number</label>
                  <input
                    value={form.pan_number}
                    onChange={setGeneral("pan_number")}
                    className="w-full h-9 px-3 text-xs rounded-xl border bg-background font-mono uppercase focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="ABCDE1234F"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-foreground">Registration / CIN Number</label>
                  <input
                    value={form.registration_number}
                    onChange={setGeneral("registration_number")}
                    className="w-full h-9 px-3 text-xs rounded-xl border bg-background font-mono uppercase focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="U74999KA2026PTC..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-foreground">Official Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={setGeneral("email")}
                    className="w-full h-9 px-3 text-xs rounded-xl border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="accounts@company.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-foreground">Official Phone</label>
                  <input
                    value={form.phone}
                    onChange={setGeneral("phone")}
                    className="w-full h-9 px-3 text-xs rounded-xl border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-foreground">Website</label>
                  <input
                    value={form.website}
                    onChange={setGeneral("website")}
                    className="w-full h-9 px-3 text-xs rounded-xl border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="https://acmeretail.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-foreground">Base Currency</label>
                  <select
                    value={form.default_currency_code}
                    onChange={setGeneral("default_currency_code")}
                    className="w-full h-9 px-3 text-xs rounded-xl border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                  >
                    {["INR", "USD", "EUR", "GBP", "AED", "SGD"].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-foreground">State</label>
                  <input
                    value={form.state}
                    onChange={setGeneral("state")}
                    className="w-full h-9 px-3 text-xs rounded-xl border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="Karnataka"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-foreground">City</label>
                  <input
                    value={form.city}
                    onChange={setGeneral("city")}
                    className="w-full h-9 px-3 text-xs rounded-xl border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="Bengaluru"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold mb-1.5 text-foreground">Registered Office Full Address</label>
                  <textarea
                    value={form.address}
                    onChange={setGeneral("address")}
                    rows={2}
                    className="w-full px-3 py-2 text-xs rounded-xl border bg-background focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                    placeholder="No. 42, 4th Cross, Industrial Layout, Peenya, Bengaluru 560058"
                  />
                </div>
              </div>
            </div>
          )}

          {activeModalTab === "gst" && (
            <div className="space-y-4">
              <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-foreground">Multi-GST Registration Management</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Register all state-specific GSTINs for your branches, interstate warehouses, and retail depots.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={addGstRegistration}
                  size="sm"
                  className="gradient-brand text-white border-0 h-8 px-3 text-xs font-bold gap-1.5 shadow-xs"
                >
                  <Plus className="size-3.5" /> Add GSTIN
                </Button>
              </div>

              {gstRegistrations.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-border rounded-xl">
                  <Layers className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-xs font-bold text-foreground">No GSTIN registrations added yet.</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Click "Add GSTIN" above to configure your organization's GST numbers.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {gstRegistrations.map((reg, idx) => (
                    <div
                      key={reg.id || idx}
                      className={cn(
                        "p-4 rounded-xl border transition-all bg-card space-y-3",
                        reg.is_primary ? "border-primary/40 shadow-xs bg-primary/[0.02]" : "border-border"
                      )}
                    >
                      <div className="flex items-center justify-between pb-2 border-b">
                        <div className="flex items-center gap-2">
                          <span className="size-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-foreground">
                            {reg.trade_name || `GSTIN #${idx + 1}`}
                          </span>
                          {reg.is_primary ? (
                            <span className="bg-emerald-500/10 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                              <CheckCircle2 className="size-3" /> Primary GSTIN
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPrimaryGst(idx)}
                              className="text-[10px] text-muted-foreground hover:text-primary underline cursor-pointer"
                            >
                              Set as Primary
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeGstRegistration(idx)}
                          className="text-muted-foreground hover:text-rose-600 p-1 rounded-md transition-colors"
                          title="Remove GSTIN"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold mb-1 text-muted-foreground">GSTIN (15 Digits) *</label>
                          <input
                            value={reg.gstin}
                            onChange={(e) => updateGstRegistration(idx, "gstin", e.target.value)}
                            maxLength={15}
                            placeholder="29AAGCB1286Q000"
                            className="w-full h-8 px-2.5 text-xs rounded-lg border bg-background font-mono uppercase focus:ring-2 focus:ring-primary/20 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold mb-1 text-muted-foreground">Trade / Branch Name</label>
                          <input
                            value={reg.trade_name || ""}
                            onChange={(e) => updateGstRegistration(idx, "trade_name", e.target.value)}
                            placeholder="e.g. Karnataka Central Hub"
                            className="w-full h-8 px-2.5 text-xs rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold mb-1 text-muted-foreground">State (Code {reg.state_code || "--"})</label>
                          <input
                            value={reg.state_name || ""}
                            onChange={(e) => updateGstRegistration(idx, "state_name", e.target.value)}
                            placeholder="Auto-detected from GSTIN"
                            className="w-full h-8 px-2.5 text-xs rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                          />
                        </div>
                        <div className="col-span-3">
                          <label className="block text-[11px] font-bold mb-1 text-muted-foreground">Registered Address for this GSTIN</label>
                          <input
                            value={reg.address || ""}
                            onChange={(e) => updateGstRegistration(idx, "address", e.target.value)}
                            placeholder="Branch / Warehouse physical address registered with GST portal"
                            className="w-full h-8 px-2.5 text-xs rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeModalTab === "gsp" && (
            <div className="space-y-5">
              <div className="p-4 bg-muted/20 border rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Server className="size-3.5 text-primary" /> Gateway Environment
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Switch between live Government Production API and Sandbox testing.
                    </p>
                  </div>
                  <div className="flex bg-background border rounded-lg p-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setGspCreds((p) => ({ ...p, environment: "sandbox" }))}
                      className={cn(
                        "px-3 py-1 text-xs font-bold rounded-md transition-all",
                        gspCreds.environment === "sandbox"
                          ? "bg-amber-500 text-white shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Sandbox
                    </button>
                    <button
                      type="button"
                      onClick={() => setGspCreds((p) => ({ ...p, environment: "production" }))}
                      className={cn(
                        "px-3 py-1 text-xs font-bold rounded-md transition-all",
                        gspCreds.environment === "production"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Live Production
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
                  <div>
                    <label className="block text-[11px] font-bold mb-1 text-muted-foreground">
                      Whitebooks Registered Account Email *
                    </label>
                    <input
                      type="email"
                      value={gspCreds.registered_email || ""}
                      onChange={(e) => setGspCreds((p) => ({ ...p, registered_email: e.target.value }))}
                      placeholder="email@company.com"
                      className="w-full h-8 px-2.5 text-xs rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Must match the account where Production Client ID was generated.
                    </p>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-1 text-muted-foreground">
                      Whitelisted Server IP Address
                    </label>
                    <input
                      value={gspCreds.ip_address || ""}
                      onChange={(e) => setGspCreds((p) => ({ ...p, ip_address: e.target.value }))}
                      placeholder="106.213.64.83"
                      className="w-full h-8 px-2.5 text-xs rounded-lg border bg-background font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Whitelisted in Whitebooks Dashboard IP Access List.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 border rounded-xl bg-card space-y-3">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-lg bg-indigo-500/10 text-indigo-600 grid place-items-center">
                      <Truck className="size-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">e-Way Bill API Credentials</h4>
                      <p className="text-[10px] text-muted-foreground">Government ewaybillgst.gov.in GSP Access</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={testingModule === "ewb"}
                    onClick={() => handleTestConnection("ewb")}
                    className="h-7 text-xs font-bold gap-1 px-2.5 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                  >
                    {testingModule === "ewb" ? <Loader2 className="size-3 animate-spin" /> : <Activity className="size-3" />}
                    Test e-Way Bill
                  </Button>
                </div>

                {testResults.ewb && (
                  <div className={cn(
                    "p-2.5 rounded-lg text-xs flex items-center justify-between",
                    testResults.ewb.success ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
                  )}>
                    <span className="font-semibold">{testResults.ewb.message}</span>
                    {testResults.ewb.token_preview && <span className="font-mono text-[10px]">Token: {testResults.ewb.token_preview}</span>}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-muted-foreground">EWB Client ID</label>
                    <input
                      value={gspCreds.ewb?.client_id || ""}
                      onChange={(e) => setGspModuleField("ewb", "client_id", e.target.value)}
                      placeholder="EWB..."
                      className="w-full h-8 px-2.5 text-xs rounded-lg border bg-background font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-muted-foreground">EWB Client Secret</label>
                    <input
                      type="password"
                      value={gspCreds.ewb?.client_secret || ""}
                      onChange={(e) => setGspModuleField("ewb", "client_secret", e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full h-8 px-2.5 text-xs rounded-lg border bg-background font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-muted-foreground">NIC GSP Username</label>
                    <input
                      value={gspCreds.ewb?.username || ""}
                      onChange={(e) => setGspModuleField("ewb", "username", e.target.value)}
                      placeholder="GSP User from ewaybillgst.gov.in"
                      className="w-full h-8 px-2.5 text-xs rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-muted-foreground">NIC GSP Password</label>
                    <input
                      type="password"
                      value={gspCreds.ewb?.password || ""}
                      onChange={(e) => setGspModuleField("ewb", "password", e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full h-8 px-2.5 text-xs rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 border rounded-xl bg-card space-y-3">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-lg bg-emerald-500/10 text-emerald-600 grid place-items-center">
                      <Receipt className="size-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">e-Invoice & IRN Credentials</h4>
                      <p className="text-[10px] text-muted-foreground">Government einvoice1.gst.gov.in IRP Access</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={testingModule === "einv"}
                    onClick={() => handleTestConnection("einv")}
                    className="h-7 text-xs font-bold gap-1 px-2.5 border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                  >
                    {testingModule === "einv" ? <Loader2 className="size-3 animate-spin" /> : <Activity className="size-3" />}
                    Test e-Invoice
                  </Button>
                </div>

                {testResults.einv && (
                  <div className={cn(
                    "p-2.5 rounded-lg text-xs flex items-center justify-between",
                    testResults.einv.success ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
                  )}>
                    <span className="font-semibold">{testResults.einv.message}</span>
                    {testResults.einv.token_preview && <span className="font-mono text-[10px]">Token: {testResults.einv.token_preview}</span>}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-muted-foreground">e-Invoice Client ID</label>
                    <input
                      value={gspCreds.einv?.client_id || ""}
                      onChange={(e) => setGspModuleField("einv", "client_id", e.target.value)}
                      placeholder="EIN..."
                      className="w-full h-8 px-2.5 text-xs rounded-lg border bg-background font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-muted-foreground">e-Invoice Client Secret</label>
                    <input
                      type="password"
                      value={gspCreds.einv?.client_secret || ""}
                      onChange={(e) => setGspModuleField("einv", "client_secret", e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full h-8 px-2.5 text-xs rounded-lg border bg-background font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-muted-foreground">IRP API Username</label>
                    <input
                      value={gspCreds.einv?.username || ""}
                      onChange={(e) => setGspModuleField("einv", "username", e.target.value)}
                      placeholder="API User from einvoice1.gst.gov.in"
                      className="w-full h-8 px-2.5 text-xs rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-muted-foreground">IRP API Password</label>
                    <input
                      type="password"
                      value={gspCreds.einv?.password || ""}
                      onChange={(e) => setGspModuleField("einv", "password", e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full h-8 px-2.5 text-xs rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 border rounded-xl bg-card space-y-3">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-lg bg-purple-500/10 text-purple-600 grid place-items-center">
                      <FileText className="size-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">GST Returns & Filing Credentials</h4>
                      <p className="text-[10px] text-muted-foreground">GSTR-1, GSTR-2B & GSTR-3B GSTN Access</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={testingModule === "gst"}
                    onClick={() => handleTestConnection("gst")}
                    className="h-7 text-xs font-bold gap-1 px-2.5 border-purple-200 text-purple-600 hover:bg-purple-50"
                  >
                    {testingModule === "gst" ? <Loader2 className="size-3 animate-spin" /> : <Activity className="size-3" />}
                    Test GST Returns
                  </Button>
                </div>

                {testResults.gst && (
                  <div className={cn(
                    "p-2.5 rounded-lg text-xs flex items-center justify-between",
                    testResults.gst.success ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
                  )}>
                    <span className="font-semibold">{testResults.gst.message}</span>
                    {testResults.gst.token_preview && <span className="font-mono text-[10px]">Token: {testResults.gst.token_preview}</span>}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-muted-foreground">GST API Client ID</label>
                    <input
                      value={gspCreds.gst?.client_id || ""}
                      onChange={(e) => setGspModuleField("gst", "client_id", e.target.value)}
                      placeholder="GST..."
                      className="w-full h-8 px-2.5 text-xs rounded-lg border bg-background font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-muted-foreground">GST API Client Secret</label>
                    <input
                      type="password"
                      value={gspCreds.gst?.client_secret || ""}
                      onChange={(e) => setGspModuleField("gst", "client_secret", e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full h-8 px-2.5 text-xs rounded-lg border bg-background font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-muted-foreground">GSTN Portal Username</label>
                    <input
                      value={gspCreds.gst?.username || ""}
                      onChange={(e) => setGspModuleField("gst", "username", e.target.value)}
                      placeholder="GSTN Username"
                      className="w-full h-8 px-2.5 text-xs rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-muted-foreground">GSTN Portal Password</label>
                    <input
                      type="password"
                      value={gspCreds.gst?.password || ""}
                      onChange={(e) => setGspModuleField("gst", "password", e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full h-8 px-2.5 text-xs rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t sticky bottom-0 bg-card">
            <div className="text-[11px] text-muted-foreground">
              {activeModalTab === "gst" && `${gstRegistrations.length} GST registrations configured`}
              {activeModalTab === "gsp" && `Environment: ${gspCreds.environment === "production" ? "Live Production" : "Sandbox"}`}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} className="h-9 px-4 text-xs font-semibold">
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="gradient-brand text-white border-0 h-9 px-5 text-xs font-bold shadow-xs">
                {saving ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Save className="size-4 mr-1.5" />}
                {isEdit ? "Save Organization Settings" : "Create Organization"}
              </Button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({
  company,
  onClose,
  onDeleted,
}: {
  company: Company;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await companiesApi.delete(company.id);
      toast.success(`${company.name} deleted successfully`);
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
          <h3 className="font-bold">Delete Organization</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Are you sure you want to delete <span className="font-semibold text-foreground">{company.name}</span>? This action cannot be undone and will remove all associated GST registrations and branches.
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

// ─── Main Company Management Component ────────────────────────────────────────

export function CompanyManagement() {
  const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formInitialTab, setFormInitialTab] = useState<"general" | "gst" | "gsp">("general");
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [deleteCompany, setDeleteCompany] = useState<Company | null>(null);
  const [activeTab, setActiveTab] = useState("Overview");

  const [companyBranches, setCompanyBranches] = useState<Branch[]>([]);
  const [companyTaxes, setCompanyTaxes] = useState<TaxConfiguration[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [subLoading, setSubLoading] = useState(false);

  const [activeBillingGst, setActiveBillingGstState] = useState<ActiveGstDetails | null>(() => getActiveBillingGst());

  const activeCompany = companies.find((c) => c.id === activeCompanyId) ?? companies[0] ?? null;

  // Listen for GST changes from other components/storage
  useEffect(() => {
    const handleGstChange = (e: any) => {
      setActiveBillingGstState(e.detail || getActiveBillingGst());
    };
    window.addEventListener("bos-active-gst-changed", handleGstChange);
    window.addEventListener("storage", handleGstChange);
    return () => {
      window.removeEventListener("bos-active-gst-changed", handleGstChange);
      window.removeEventListener("storage", handleGstChange);
    };
  }, []);

  // When activeCompany changes, synchronize active billing GST if not matching
  useEffect(() => {
    if (activeCompany) {
      const primaryReg = activeCompany.gst_registrations?.find((r) => r.is_primary) || activeCompany.gst_registrations?.[0];
      const gstin = primaryReg?.gstin || activeCompany.gst_number;
      if (gstin) {
        const details: ActiveGstDetails = {
          gstin,
          trade_name: primaryReg?.trade_name || activeCompany.name,
          legal_name: activeCompany.legal_name,
          state_code: primaryReg?.state_code || gstin.slice(0, 2),
          state_name: primaryReg?.state_name || activeCompany.state || "State",
          address: primaryReg?.address || activeCompany.address || "",
          phone: activeCompany.phone || "",
          email: activeCompany.email || "",
          cin: activeCompany.registration_number || "",
          pan: activeCompany.pan_number || "",
        };
        localStorage.setItem("bos_active_company", JSON.stringify(activeCompany));
        const current = getActiveBillingGst();
        if (!current || (activeCompany.gst_registrations?.length && !activeCompany.gst_registrations.some((r) => r.gstin === current.gstin))) {
          setActiveBillingGst(details);
          setActiveBillingGstState(details);
        }
      }
    }
  }, [activeCompany]);

  const handleSelectActiveBillingGstin = async (reg: GstRegistration) => {
    if (!activeCompany) return;
    try {
      const updatedRegistrations = (activeCompany.gst_registrations || []).map((r) => ({
        ...r,
        is_primary: r.gstin === reg.gstin,
      }));
      if (!updatedRegistrations.some((r) => r.gstin === reg.gstin)) {
        updatedRegistrations.push({ ...reg, is_primary: true });
      }

      await companiesApi.update(activeCompany.id, {
        gst_number: reg.gstin,
        gst_registrations: updatedRegistrations,
      });

      const details: ActiveGstDetails = {
        gstin: reg.gstin,
        trade_name: reg.trade_name || activeCompany.name,
        legal_name: activeCompany.legal_name,
        state_code: reg.state_code || reg.gstin.slice(0, 2),
        state_name: reg.state_name || activeCompany.state || "State",
        address: reg.address || activeCompany.address || "",
        phone: activeCompany.phone || "",
        email: activeCompany.email || "",
        cin: activeCompany.registration_number || "",
        pan: activeCompany.pan_number || "",
      };

      setActiveBillingGst(details);
      setActiveBillingGstState(details);
      toast.success(`Active Billing GST switched to ${reg.gstin} (${reg.trade_name || reg.state_name || "Primary"})! All bills & invoices will now use this GST.`);
      void load();
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to update active billing GST");
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await companiesApi.list(1, 50, search || undefined);
      setCompanies(res.items);
      setTotal(res.total);
      if (res.items.length > 0) {
        if (!activeCompanyId || !res.items.some((c) => c.id === activeCompanyId)) {
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
          const userRes = await fetch(`${API_BASE_URL}/erp/users`, {
            headers: { Authorization: `Bearer ${token}` },
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
      (c.gst_number ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-full bg-background overflow-hidden">
      <div className="w-72 xl:w-80 flex flex-col border-r border-border bg-card/50 shrink-0 h-full">
        <div className="p-3 border-b border-border bg-card sticky top-0 z-10">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="size-8 rounded-lg gradient-brand text-white grid place-items-center shadow-xs">
              <Building2 className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight leading-tight">Organization Master</h2>
              <p className="text-muted-foreground text-[10px]">Multi-tenant legal entities & GSTINs.</p>
            </div>
          </div>
          <div className="flex gap-1.5 mt-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-8 pl-8 pr-2.5 text-xs rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground outline-none transition-all"
                placeholder="Search by name, GST..."
              />
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditCompany(null);
                setFormInitialTab("general");
                setShowForm(true);
              }}
              className="h-8 px-2.5 gradient-brand text-white border-0 text-xs font-bold"
            >
              <Plus className="size-3.5" /> New
            </Button>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-[10px] font-semibold text-muted-foreground">
              {filtered.length} of {total} organizations
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl border bg-muted/30 animate-pulse" />
            ))
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Building2 className="size-6 mx-auto mb-1.5 opacity-30" />
              No organizations found.
            </div>
          ) : (
            filtered.map((company) => {
              const isActive = company.id === activeCompanyId;
              const initials = company.logo_initials ?? company.name.slice(0, 2).toUpperCase();
              const gstCount = company.gst_registrations?.length || (company.gst_number ? 1 : 0);
              const gspConfigured = Boolean(
                company.gsp_credentials?.ewb?.client_id ||
                company.gsp_credentials?.einv?.client_id ||
                company.gsp_credentials?.gst?.client_id
              );
              const isProd = company.gsp_credentials?.environment === "production";

              return (
                <button
                  key={company.id}
                  onClick={() => {
                    setActiveCompanyId(company.id);
                    setActiveTab("Overview");
                  }}
                  className={cn(
                    "w-full text-left p-2.5 rounded-xl border transition-all relative flex flex-col gap-2 group cursor-pointer",
                    isActive
                      ? "bg-primary/5 border-primary/30 shadow-xs"
                      : "bg-card hover:border-primary/20 hover:shadow-xs"
                  )}
                >
                  <div className="flex gap-2.5 w-full">
                    <div className="size-8 rounded-lg border bg-background flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                      {company.logo_url ? (
                        <img src={company.logo_url} alt={company.name} className="w-full h-full object-contain p-0.5" />
                      ) : (
                        <div className="w-full h-full gradient-brand text-white grid place-items-center font-bold text-xs">
                          {initials}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h3 className={cn("font-bold text-xs tracking-tight truncate", isActive ? "text-primary" : "text-foreground")}>
                        {company.name}
                      </h3>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {company.company_type ?? "Company"} • {company.industry ?? "General"}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`size-1.5 rounded-full ${company.status === "active" ? "bg-emerald-500" : "bg-rose-500"}`} />
                        <span className={cn("text-[10px] font-medium capitalize", company.status === "active" ? "text-emerald-600" : "text-rose-600")}>
                          {company.status}
                        </span>
                        {gspConfigured && (
                          <span className={cn(
                            "text-[9px] font-bold px-1.5 py-0.2 rounded-full border",
                            isProd ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                          )}>
                            {isProd ? "GSP Live" : "GSP Sandbox"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="w-full text-[10px] font-mono text-muted-foreground pt-1.5 border-t flex justify-between items-center">
                    <span>GSTINs: {gstCount} registered</span>
                    <ChevronRight className={cn("size-3.5 transition-transform", isActive ? "text-primary translate-x-0.5" : "text-muted-foreground opacity-0 group-hover:opacity-100")} />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-muted/20 flex flex-col">
        {!activeCompany && !loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <div className="size-16 rounded-2xl bg-card border-2 border-dashed border-border flex items-center justify-center">
              <Building2 className="size-8 opacity-20" />
            </div>
            <div className="text-center">
              <p className="font-bold text-foreground text-sm">No Organization Selected</p>
              <p className="text-sm text-muted-foreground mt-1">Select an organization or create a new one.</p>
            </div>
            <Button
              className="gradient-brand text-white border-0 h-9 px-4 text-xs font-bold"
              onClick={() => {
                setEditCompany(null);
                setFormInitialTab("general");
                setShowForm(true);
              }}
            >
              <Plus className="size-3.5 mr-1.5" /> Create Organization
            </Button>
          </div>
        ) : activeCompany && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-2.5 bg-card border-b border-border sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl border bg-background flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                  {activeCompany.logo_url ? (
                    <img src={activeCompany.logo_url} alt={activeCompany.name} className="w-full h-full object-contain p-0.5" />
                  ) : (
                    <div className="w-full h-full gradient-brand text-white grid place-items-center font-bold text-xs">
                      {activeCompany.logo_initials ?? activeCompany.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-sm font-extrabold tracking-tight leading-tight">{activeCompany.name}</h1>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${activeCompany.status === "active" ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`}>
                      <span className={`size-1.5 rounded-full ${activeCompany.status === "active" ? "bg-emerald-500" : "bg-rose-500"}`} />
                      {activeCompany.status.charAt(0).toUpperCase() + activeCompany.status.slice(1)}
                    </span>
                    {activeCompany.gsp_credentials?.environment && (
                      <span className={cn(
                        "text-[9px] font-bold px-2 py-0.5 rounded-full border",
                        activeCompany.gsp_credentials.environment === "production"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      )}>
                        {activeCompany.gsp_credentials.environment === "production" ? "Govt Production GSP" : "Sandbox GSP"}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{activeCompany.legal_name} • {activeCompany.company_type ?? "Company"}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 font-semibold text-xs px-2.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                  onClick={() => {
                    setEditCompany(activeCompany);
                    setFormInitialTab("gst");
                    setShowForm(true);
                  }}
                >
                  <Layers className="size-3.5" /> Manage GSTINs
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 font-semibold text-xs px-2.5 text-purple-600 border-purple-200 hover:bg-purple-50"
                  onClick={() => {
                    setEditCompany(activeCompany);
                    setFormInitialTab("gsp");
                    setShowForm(true);
                  }}
                >
                  <KeyRound className="size-3.5" /> GSP Credentials
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 font-semibold text-xs px-2.5"
                  onClick={() => {
                    setEditCompany(activeCompany);
                    setFormInitialTab("general");
                    setShowForm(true);
                  }}
                >
                  <Edit2 className="size-3.5" /> Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 font-semibold text-xs text-rose-600 hover:text-rose-700 hover:border-rose-300 px-2.5"
                  onClick={() => setDeleteCompany(activeCompany)}
                >
                  <Trash2 className="size-3.5" /> Delete
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-4 divide-x divide-border border-b border-border bg-card">
              {[
                { label: "Primary GSTIN", value: activeCompany.gst_number ?? "Not configured", icon: Layers },
                { label: "Email", value: activeCompany.email ?? "—", icon: Mail },
                { label: "Phone", value: activeCompany.phone ?? "—", icon: Phone },
                { label: "Website", value: activeCompany.website ?? "—", icon: ExternalLink, link: true },
              ].map(({ label, value, icon: Icon, link }) => (
                <div key={label} className="px-3 py-1.5">
                  <div className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground mb-0.5 flex items-center gap-1">
                    {Icon && <Icon className="size-2.5" />} {label}
                  </div>
                  {link && value !== "—" ? (
                    <a href={activeCompany.website ?? "#"} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary hover:underline truncate block">{value}</a>
                  ) : (
                    <div className="text-xs font-semibold truncate font-mono">{value}</div>
                  )}
                </div>
              ))}
            </div>

            <div className="bg-card border-b border-border px-4">
              <div className="flex gap-0 overflow-x-auto scrollbar-hide">
                {[
                  "Overview",
                  "GST Registrations",
                  "GSP & Govt Gateway",
                  "Branches",
                  "Tax & Finance",
                  "Documents"
                ].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "relative py-2 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all duration-200 cursor-pointer",
                      activeTab === tab
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    )}
                  >
                    {tab}
                    {tab === "GST Registrations" && (activeCompany.gst_registrations?.length ?? 0) > 0 && (
                      <span className="ml-1.5 bg-primary/10 text-primary border border-primary/20 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full">
                        {activeCompany.gst_registrations?.length}
                      </span>
                    )}
                    {tab === "Branches" && companyBranches.length > 0 && (
                      <span className="ml-1.5 bg-muted text-muted-foreground text-[9px] font-extrabold px-1.5 py-0.2 rounded-full">
                        {companyBranches.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <AnimatePresence mode="wait">
                {subLoading ? (
                  <div className="h-48 flex items-center justify-center">
                    <Loader2 className="size-6 text-primary animate-spin" />
                  </div>
                ) : (
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="h-full space-y-4"
                  >
                    {activeTab === "Overview" && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <Card className="p-4 h-fit">
                            <div className="flex items-center gap-2 mb-3 text-foreground">
                              <Building2 className="size-4 text-primary" />
                              <h3 className="font-bold text-sm">General Profile</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-y-3 gap-x-3">
                              {[
                                { label: "Primary GSTIN", value: activeCompany.gst_number, mono: true },
                                { label: "PAN Number", value: activeCompany.pan_number, mono: true },
                                { label: "Registration No.", value: activeCompany.registration_number, mono: true },
                                { label: "Country / State", value: `${activeCompany.country ?? "India"} / ${activeCompany.state ?? "—"}` },
                                { label: "City", value: activeCompany.city },
                                { label: "Industry", value: activeCompany.industry },
                                { label: "Currency", value: activeCompany.default_currency_code },
                                { label: "Timezone", value: activeCompany.timezone },
                              ].map(({ label, value, mono }) => (
                                <div key={label}>
                                  <div className="text-[9px] font-semibold text-muted-foreground mb-0.5">{label}</div>
                                  <div className={cn("text-xs font-semibold", mono && "font-mono")}>{value ?? "—"}</div>
                                </div>
                              ))}
                              <div className="col-span-2">
                                <div className="text-[9px] font-semibold text-muted-foreground mb-0.5">Registered Office Address</div>
                                <div className="text-xs font-medium">{activeCompany.address ?? "—"}</div>
                              </div>
                            </div>
                          </Card>

                          <Card className="p-4 h-fit bg-card border">
                            <div className="flex items-center justify-between mb-3 text-foreground">
                              <div className="flex items-center gap-2">
                                <KeyRound className="size-4 text-primary" />
                                <h3 className="font-bold text-sm">Govt Gateway (GSP) Integration</h3>
                              </div>
                              <span className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                                activeCompany.gsp_credentials?.environment === "production"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              )}>
                                {activeCompany.gsp_credentials?.environment === "production" ? "Production Active" : "Sandbox Active"}
                              </span>
                            </div>

                            <div className="space-y-2.5">
                              {[
                                {
                                  name: "e-Way Bill Generation",
                                  icon: Truck,
                                  configured: Boolean(activeCompany.gsp_credentials?.ewb?.client_id),
                                  user: activeCompany.gsp_credentials?.ewb?.username || "Default .env",
                                },
                                {
                                  name: "e-Invoice & IRN Portal",
                                  icon: Receipt,
                                  configured: Boolean(activeCompany.gsp_credentials?.einv?.client_id),
                                  user: activeCompany.gsp_credentials?.einv?.username || "Default .env",
                                },
                                {
                                  name: "GST Returns & Filing",
                                  icon: FileText,
                                  configured: Boolean(activeCompany.gsp_credentials?.gst?.client_id),
                                  user: activeCompany.gsp_credentials?.gst?.username || "Default .env",
                                },
                              ].map((m) => (
                                <div key={m.name} className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20">
                                  <div className="flex items-center gap-2.5">
                                    <m.icon className="size-4 text-primary" />
                                    <div>
                                      <div className="text-xs font-bold text-foreground">{m.name}</div>
                                      <div className="text-[10px] text-muted-foreground font-mono">GSP User: {m.user}</div>
                                    </div>
                                  </div>
                                  <span className={cn(
                                    "text-[9px] font-bold px-2 py-0.5 rounded-full",
                                    m.configured ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-100 text-slate-600"
                                  )}>
                                    {m.configured ? "Org Custom" : "System Fallback"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </Card>
                        </div>
                      </div>
                    )}

                    {/* ════ TAB: GST REGISTRATIONS ════ */}
                    {activeTab === "GST Registrations" && (
                      <div className="space-y-4">
                        {/* Active Billing GST Profile Callout Banner */}
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                          <div className="flex items-center gap-3">
                            <div className="size-10 rounded-xl bg-emerald-600 text-white grid place-items-center font-bold shadow-xs shrink-0">
                              <CheckCircle2 className="size-5" />
                            </div>
                            <div>
                              <div className="text-[10px] uppercase font-black tracking-wider text-emerald-700 dark:text-emerald-400">
                                Active Billing GSTIN (Printed on Bills & Invoices)
                              </div>
                              <div className="text-sm font-black text-foreground flex items-center gap-2">
                                <span className="font-mono">{activeBillingGst?.gstin || activeCompany.gst_number || "Not Configured"}</span>
                                <span className="text-xs font-semibold text-muted-foreground">
                                  • {activeBillingGst?.trade_name || activeCompany.name} ({activeBillingGst?.state_name || activeCompany.state || "State"})
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                This GSTIN and registered trade address are automatically printed on all POS thermal receipts, A4 sales invoices, e-way bills, and tax reports.
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setEditCompany(activeCompany);
                                setFormInitialTab("gst");
                                setShowForm(true);
                              }}
                              className="gradient-brand text-white border-0 h-8 px-3.5 text-xs font-bold gap-1.5 shadow-xs"
                            >
                              <Plus className="size-3.5" /> Add / Edit GSTINs
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <div>
                            <h3 className="font-bold text-sm text-foreground">Registered GSTIN Profiles ({activeCompany.gst_registrations?.length || (activeCompany.gst_number ? 1 : 0)})</h3>
                            <p className="text-xs text-muted-foreground">
                              Click "Set as Active for Bills" on any GST profile below to switch the default billing GST.
                            </p>
                          </div>
                        </div>

                        {(!activeCompany.gst_registrations || activeCompany.gst_registrations.length === 0) && !activeCompany.gst_number ? (
                          <div className="text-center py-12 border-2 border-dashed rounded-2xl bg-card">
                            <Layers className="size-8 mx-auto text-muted-foreground/30 mb-2" />
                            <p className="text-xs font-bold text-foreground">No GSTIN registrations added.</p>
                            <p className="text-[11px] text-muted-foreground mt-1">Click above to add GSTIN numbers for your branches.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {(activeCompany.gst_registrations && activeCompany.gst_registrations.length > 0
                              ? activeCompany.gst_registrations
                              : [{
                                  gstin: activeCompany.gst_number || "",
                                  trade_name: activeCompany.name,
                                  state_code: activeCompany.gst_number?.slice(0, 2) || "",
                                  state_name: activeCompany.state || "Default State",
                                  address: activeCompany.address || "",
                                  is_primary: true,
                                }]
                            ).map((reg, idx) => {
                              const isThisActive = reg.gstin === (activeBillingGst?.gstin || activeCompany.gst_number);
                              return (
                                <Card
                                  key={reg.id || idx}
                                  className={cn(
                                    "p-4 space-y-3 transition-all",
                                    isThisActive
                                      ? "border-emerald-500/50 bg-emerald-500/[0.03] shadow-xs ring-1 ring-emerald-500/20"
                                      : "border-border hover:border-primary/20"
                                  )}
                                >
                                  <div className="flex items-center justify-between pb-2 border-b">
                                    <div className="flex items-center gap-2">
                                      <Layers className={cn("size-4", isThisActive ? "text-emerald-600" : "text-primary")} />
                                      <span className="font-bold text-xs text-foreground">{reg.trade_name || `GSTIN #${idx + 1}`}</span>
                                    </div>
                                    {isThisActive ? (
                                      <span className="bg-emerald-600 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                                        <CheckCircle2 className="size-3" /> Active Billing GST
                                      </span>
                                    ) : (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleSelectActiveBillingGstin(reg)}
                                        className="h-6 text-[10px] font-bold px-2.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                      >
                                        Set as Active for Bills
                                      </Button>
                                    )}
                                  </div>
                                  <div className="space-y-1.5 text-xs">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[11px] text-muted-foreground font-semibold">GSTIN:</span>
                                      <span className="font-mono text-xs font-extrabold text-foreground tracking-wider">{reg.gstin}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-[11px] text-muted-foreground font-semibold">State / Code:</span>
                                      <span className="text-xs font-semibold text-foreground">
                                        {reg.state_name || STATE_GST_CODES[reg.state_code || ""] || "—"} ({reg.state_code || reg.gstin.slice(0, 2)})
                                      </span>
                                    </div>
                                    {reg.address && (
                                      <div className="text-[11px] text-muted-foreground pt-1.5 border-t">
                                        <MapPin className="size-3 inline mr-1 text-primary" />
                                        {reg.address}
                                      </div>
                                    )}
                                  </div>
                                </Card>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === "GSP & Govt Gateway" && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-bold text-sm text-foreground">Whitebooks GSP & Government Gateway Credentials</h3>
                            <p className="text-xs text-muted-foreground">
                              Dedicated credentials for live e-Way Bill, e-Invoice IRN generation, and GST Returns.
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {
                              setEditCompany(activeCompany);
                              setFormInitialTab("gsp");
                              setShowForm(true);
                            }}
                            className="gradient-brand text-white border-0 h-8 px-3 text-xs font-bold gap-1.5 shadow-xs"
                          >
                            <KeyRound className="size-3.5" /> Configure Credentials
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <Card className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Truck className="size-4 text-indigo-600" />
                                <h4 className="text-xs font-bold">e-Way Bill API</h4>
                              </div>
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700">EWB</span>
                            </div>
                            <div className="space-y-1.5 text-xs">
                              <div>
                                <span className="text-[10px] text-muted-foreground block">Client ID:</span>
                                <span className="font-mono text-[11px] font-semibold">
                                  {activeCompany.gsp_credentials?.ewb?.client_id || "System Default"}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-muted-foreground block">NIC Username:</span>
                                <span className="font-semibold">{activeCompany.gsp_credentials?.ewb?.username || "Default"}</span>
                              </div>
                            </div>
                          </Card>

                          <Card className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Receipt className="size-4 text-emerald-600" />
                                <h4 className="text-xs font-bold">e-Invoice / IRN</h4>
                              </div>
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700">IRP</span>
                            </div>
                            <div className="space-y-1.5 text-xs">
                              <div>
                                <span className="text-[10px] text-muted-foreground block">Client ID:</span>
                                <span className="font-mono text-[11px] font-semibold">
                                  {activeCompany.gsp_credentials?.einv?.client_id || "System Default"}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-muted-foreground block">IRP Username:</span>
                                <span className="font-semibold">{activeCompany.gsp_credentials?.einv?.username || "Default"}</span>
                              </div>
                            </div>
                          </Card>

                          <Card className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <FileText className="size-4 text-purple-600" />
                                <h4 className="text-xs font-bold">GST Returns & Filing</h4>
                              </div>
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700">GSTN</span>
                            </div>
                            <div className="space-y-1.5 text-xs">
                              <div>
                                <span className="text-[10px] text-muted-foreground block">Client ID:</span>
                                <span className="font-mono text-[11px] font-semibold">
                                  {activeCompany.gsp_credentials?.gst?.client_id || "System Default"}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-muted-foreground block">GSTN Username:</span>
                                <span className="font-semibold">{activeCompany.gsp_credentials?.gst?.username || "Default"}</span>
                              </div>
                            </div>
                          </Card>
                        </div>
                      </div>
                    )}

                    {activeTab === "Branches" && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="font-bold text-sm">Branches & Operating Locations</h3>
                        </div>
                        {companyBranches.length === 0 ? (
                          <div className="text-center py-10 border-2 border-dashed rounded-xl">
                            <Building2 className="size-6 mx-auto mb-1.5 text-muted-foreground/40" />
                            <p className="text-xs font-bold text-foreground">No branches mapped to this organization.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {companyBranches.map((br) => (
                              <Card key={br.id} className="p-3.5">
                                <div className="font-bold text-xs text-foreground">{br.name}</div>
                                <div className="text-[10px] text-muted-foreground font-mono mt-0.5">Code: {br.code}</div>
                                <div className="text-xs text-muted-foreground mt-2">{br.address || br.city || "—"}</div>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === "Tax & Finance" && (
                      <div className="space-y-4">
                        <h3 className="font-bold text-sm">Configured Tax Rates</h3>
                        {companyTaxes.length === 0 ? (
                          <div className="text-center py-10 border-2 border-dashed rounded-xl text-xs text-muted-foreground">
                            Standard GST Schedules (GST@0, GST@5, GST@12, GST@18, GST@28) applied.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {companyTaxes.map((t) => (
                              <Card key={t.id} className="p-3">
                                <div className="font-bold text-xs">{t.name}</div>
                                <div className="text-xs font-mono text-primary font-bold mt-1">{t.rate}%</div>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === "Documents" && (
                      <Card className="p-4 space-y-3">
                        <h3 className="font-bold text-sm">Verified Corporate Compliance Documents</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {[
                            { name: "Certificate of Incorporation", type: "COI", format: "PDF", status: "Verified" },
                            { name: "GSTIN Certificate (REG-06)", type: "GST", format: "PDF", status: "Verified" },
                            { name: "Company PAN Card Copy", type: "PAN", format: "PDF", status: "Verified" },
                          ].map((doc) => (
                            <div key={doc.name} className="border rounded-xl p-2.5 flex justify-between items-center bg-card">
                              <div className="flex items-center gap-2.5">
                                <div className="size-8 rounded-lg bg-primary/10 text-primary grid place-items-center">
                                  <FileText className="size-4" />
                                </div>
                                <div>
                                  <div className="font-bold text-xs">{doc.name}</div>
                                  <div className="text-[9px] text-muted-foreground font-mono">Type: {doc.type} • {doc.format}</div>
                                </div>
                              </div>
                              <span className="bg-emerald-500/10 text-emerald-600 font-semibold px-2 py-0.5 rounded text-[9px]">
                                {doc.status}
                              </span>
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

      <AnimatePresence>
        {showForm && (
          <CompanyFormModal
            company={editCompany}
            initialTab={formInitialTab}
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
