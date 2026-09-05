import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Settings2,
  ShieldCheck,
  Zap,
  Globe,
  Lock,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Power,
  KeyRound,
  QrCode,
  DollarSign,
  HelpCircle,
  X,
  Loader2,
  SlidersHorizontal,
  Building,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import {
  paymentsApi,
  companiesApi,
  type PaymentGatewayConfigDTO,
  type Company,
} from "@/lib/api-client";

export interface PaymentGatewayConfig {
  id: string;
  name: string;
  category: "domestic" | "international" | "pos_terminal" | "offline";
  description: string;
  iconBg: string;
  logoText: string;
  logoColor: string;
  badgeText: string;
  isEnabled: boolean;
  isTestMode: boolean;
  credentials: Record<string, string>;
  supportedMethods: string[];
  currencies: string[];
  docUrl: string;
}

const DEFAULT_GATEWAYS: PaymentGatewayConfig[] = [
  {
    id: "razorpay",
    name: "Razorpay",
    category: "domestic",
    description: "Accept UPI, Credit/Debit Cards, Net Banking, and Wallets with automatic settlements across India.",
    iconBg: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-900/30",
    logoText: "RZP",
    logoColor: "bg-blue-600 text-white",
    badgeText: "Recommended (India)",
    isEnabled: true,
    isTestMode: true,
    credentials: {
      keyId: "rzp_test_RCEmjSWmFaZJbN",
      keySecret: "IGLluMDmPXFRpqDd4MZ7PwBB",
      webhookSecret: "",
    },
    supportedMethods: ["UPI & QR", "Cards (Visa/MC/RuPay)", "Net Banking (50+ banks)", "Wallets", "EMI"],
    currencies: ["INR", "USD", "EUR", "GBP", "AED"],
    docUrl: "https://razorpay.com/docs",
  },
  {
    id: "pinelabs",
    name: "PineLabs POS / EDC Swiper",
    category: "pos_terminal",
    description: "Physical retail EDC integration for POS counter card swipes, contactless tap, and smart UPI soundboxes.",
    iconBg: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-900/30",
    logoText: "PL",
    logoColor: "bg-amber-600 text-white",
    badgeText: "Retail Hardware",
    isEnabled: true,
    isTestMode: true,
    credentials: {
      terminalId: "TID-882194",
      merchantId: "MID-PINELABS-01",
      ipAddress: "192.168.1.150",
      port: "8082",
    },
    supportedMethods: ["EMV Chip Cards", "Contactless NFC / Tap to Pay", "Dynamic QR on EDC Screen", "Plutus Cloud"],
    currencies: ["INR"],
    docUrl: "https://developer.pinelabs.com",
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "international",
    description: "Industry-standard global payments supporting 135+ currencies, Apple Pay, Google Pay, and cards.",
    iconBg: "bg-indigo-500/10 text-indigo-600 border-indigo-200 dark:border-indigo-900/30",
    logoText: "STP",
    logoColor: "bg-indigo-600 text-white",
    badgeText: "Global & Cards",
    isEnabled: false,
    isTestMode: true,
    credentials: {
      publishableKey: "",
      secretKey: "",
      webhookSecret: "",
    },
    supportedMethods: ["Credit/Debit Cards", "Apple Pay", "Google Pay", "SEPA", "iDEAL"],
    currencies: ["USD", "EUR", "GBP", "CAD", "AUD", "INR", "AED", "SAR"],
    docUrl: "https://stripe.com/docs",
  },
  {
    id: "phonepe",
    name: "PhonePe PG",
    category: "domestic",
    description: "High-speed UPI direct deep-linking, QR payments, and high-conversion gateway for Indian consumers.",
    iconBg: "bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-900/30",
    logoText: "PE",
    logoColor: "bg-purple-600 text-white",
    badgeText: "High UPI Conversion",
    isEnabled: false,
    isTestMode: true,
    credentials: {
      merchantId: "",
      saltKey: "",
      saltIndex: "1",
    },
    supportedMethods: ["PhonePe UPI", "UPI QR", "Credit/Debit Cards", "PhonePe Wallet"],
    currencies: ["INR"],
    docUrl: "https://developer.phonepe.com",
  },
  {
    id: "cod",
    name: "Cash on Delivery (COD)",
    category: "offline",
    description: "Allow customers to pay via cash or UPI collection at the doorstep upon order delivery.",
    iconBg: "bg-teal-500/10 text-teal-600 border-teal-200 dark:border-teal-900/30",
    logoText: "COD",
    logoColor: "bg-teal-600 text-white",
    badgeText: "Offline Storefront",
    isEnabled: true,
    isTestMode: false,
    credentials: {
      maxOrderLimit: "10000",
      verificationOtpRequired: "true",
    },
    supportedMethods: ["Cash at Delivery", "Doorstep QR Scan"],
    currencies: ["INR", "USD", "AED", "SAR"],
    docUrl: "#",
  },
];

// ─── Modal: Gateway Configuration ───────────────────────────────────────────
function PaymentGatewayModal({
  gateway,
  companyId,
  onClose,
  onSave,
}: {
  gateway: PaymentGatewayConfig;
  companyId?: string;
  onClose: () => void;
  onSave: (updated: PaymentGatewayConfig) => Promise<void>;
}) {
  const [form, setForm] = useState<PaymentGatewayConfig>({ ...gateway });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const webhookUrl = `https://api.lazymonkeyai.com/api/v1/payments/webhooks/${gateway.id}`;

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    toast.success("Webhook URL copied to clipboard");
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await paymentsApi.testGatewayConnection(gateway.id, form.credentials);
      if (res.success) {
        toast.success(res.message || `Handshake with ${gateway.name} API verified successfully!`);
      } else {
        toast.error(res.message || `Connection failed to ${gateway.name}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to test connection.");
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-card border border-border/80 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden text-foreground flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-muted/40">
          <div className="flex items-center gap-3">
            <div className={`size-10 rounded-xl font-black text-sm flex items-center justify-center ${form.logoColor}`}>
              {form.logoText}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base">{form.name} Integration</h2>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    form.isEnabled ? "bg-emerald-500/10 text-emerald-600 border border-emerald-200" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {form.isEnabled ? "Active" : "Disabled"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{form.category.toUpperCase()} Gateway</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto text-xs">
          {/* Environment & Active Toggles */}
          <div className="grid grid-cols-2 gap-3 bg-muted/30 p-4 rounded-xl border border-border/60">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-foreground">Enable Gateway</p>
                <p className="text-[11px] text-muted-foreground">Allow checkouts via {form.name}</p>
              </div>
              <input
                type="checkbox"
                checked={form.isEnabled}
                onChange={(e) => setForm((p) => ({ ...p, isEnabled: e.target.checked }))}
                className="size-4 rounded accent-primary cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-between border-l border-border/50 pl-3">
              <div>
                <p className="font-bold text-foreground">Test / Sandbox Mode</p>
                <p className="text-[11px] text-muted-foreground">{form.isTestMode ? "Simulated payments" : "Live real money"}</p>
              </div>
              <input
                type="checkbox"
                checked={form.isTestMode}
                onChange={(e) => setForm((p) => ({ ...p, isTestMode: e.target.checked }))}
                className="size-4 rounded accent-amber-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Credentials Inputs */}
          <div className="space-y-3">
            <h4 className="font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <KeyRound className="size-3.5 text-primary" /> API Credentials & Terminal Settings (Stored in DB)
            </h4>

            {Object.keys(form.credentials).map((key) => (
              <div key={key}>
                <label className="block font-semibold text-muted-foreground mb-1 capitalize">
                  {key.replace(/([A-Z])/g, " $1")} *
                </label>
                <input
                  type={key.toLowerCase().includes("secret") || key.toLowerCase().includes("token") ? "password" : "text"}
                  required={key !== "webhookSecret"}
                  value={form.credentials[key] || ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      credentials: { ...p.credentials, [key]: e.target.value },
                    }))
                  }
                  placeholder={`Enter your ${key}`}
                  className="w-full h-9 px-3 bg-background border border-border rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            ))}
          </div>

          {/* Webhook Configuration */}
          <div className="space-y-2 bg-muted/20 p-3.5 rounded-xl border border-border/60">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-emerald-500" /> Webhook Listener URL
              </span>
              <button
                type="button"
                onClick={handleCopyWebhook}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
              >
                {copiedWebhook ? <Check className="size-3" /> : <Copy className="size-3" />}
                {copiedWebhook ? "Copied" : "Copy URL"}
              </button>
            </div>
            <div className="p-2.5 bg-background border border-border rounded-lg font-mono text-[11px] text-muted-foreground break-all select-all">
              {webhookUrl}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Add this endpoint into your {form.name} Merchant Dashboard to receive real-time webhook events for order status updates.
            </p>
          </div>

          {/* Documentation Link & Connection Tester */}
          <div className="flex items-center justify-between pt-2">
            {form.docUrl && form.docUrl !== "#" ? (
              <a
                href={form.docUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                Developer Docs & API Setup <ExternalLink className="size-3" />
              </a>
            ) : (
              <div />
            )}

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="px-3.5 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold flex items-center gap-1.5 transition-colors"
            >
              {testing ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5 text-amber-500" />}
              Test Connection
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border hover:bg-muted font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all flex items-center gap-2 shadow-sm"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Save Credentials to DB
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Main Payment Gateways Component ─────────────────────────────────────────
export function PaymentGateways({ initialCompanyId }: { initialCompanyId?: string } = {}) {
  const { currency } = useCurrency();
  const [gateways, setGateways] = useState<PaymentGatewayConfig[]>(DEFAULT_GATEWAYS);
  const [selectedGateway, setSelectedGateway] = useState<PaymentGatewayConfig | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(initialCompanyId || "");
  const [loading, setLoading] = useState(true);

  // Load Companies and Gateway Configs from DB
  const loadGateways = async (companyId?: string) => {
    try {
      setLoading(true);
      const effectiveCompanyId = companyId || initialCompanyId || selectedCompanyId;
      const [compRes, gwRes] = await Promise.all([
        companiesApi.list(1, 100).catch(() => ({ items: [] })),
        paymentsApi.getGatewayConfigs(effectiveCompanyId).catch(() => []),
      ]);

      if (compRes.items && compRes.items.length > 0) {
        setCompanies(compRes.items);
        if (!selectedCompanyId && !effectiveCompanyId) {
          setSelectedCompanyId(compRes.items[0].id);
        }
      }

      if (gwRes && gwRes.length > 0) {
        // Merge DB configs with display details
        const merged = DEFAULT_GATEWAYS.map((def) => {
          const fromDb = gwRes.find((g) => g.id.toLowerCase() === def.id.toLowerCase());
          if (fromDb) {
            return {
              ...def,
              isEnabled: fromDb.isEnabled,
              isTestMode: fromDb.isTestMode,
              credentials: { ...def.credentials, ...fromDb.credentials },
              supportedMethods: fromDb.supportedMethods?.length ? fromDb.supportedMethods : def.supportedMethods,
              currencies: fromDb.currencies?.length ? fromDb.currencies : def.currencies,
            };
          }
          return def;
        });
        setGateways(merged);
      }
    } catch (err: any) {
      console.error("Failed to load gateway configurations", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGateways();
  }, []);

  const handleCompanyChange = (compId: string) => {
    setSelectedCompanyId(compId);
    loadGateways(compId);
  };

  const handleToggleGateway = async (gatewayId: string) => {
    const gw = gateways.find((g) => g.id === gatewayId);
    if (!gw) return;

    const newEnabled = !gw.isEnabled;
    setGateways((prev) =>
      prev.map((g) => (g.id === gatewayId ? { ...g, isEnabled: newEnabled } : g))
    );

    try {
      await paymentsApi.saveGatewayConfig(gatewayId, {
        company_id: selectedCompanyId || undefined,
        is_enabled: newEnabled,
        is_test_mode: gw.isTestMode,
        credentials: gw.credentials,
      });
      toast.success(`${gw.name} is now ${newEnabled ? "Enabled" : "Disabled"}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update gateway status in database");
    }
  };

  const handleSaveModal = async (updated: PaymentGatewayConfig) => {
    await paymentsApi.saveGatewayConfig(updated.id, {
      company_id: selectedCompanyId || undefined,
      is_enabled: updated.isEnabled,
      is_test_mode: updated.isTestMode,
      credentials: updated.credentials,
    });

    setGateways((prev) =>
      prev.map((g) => (g.id === updated.id ? updated : g))
    );
    toast.success(`${updated.name} credentials saved successfully to database!`);
  };

  const filteredGateways = gateways.filter(
    (g) => filterCategory === "all" || g.category === filterCategory
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
              <CreditCard className="size-6 text-primary" /> Payment Gateways & POS Terminals
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
              Multi-Tenant DB
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Configure online payment processors (Razorpay, Stripe, UPI) and retail handheld counter card machines (Pine Labs EDC) per company.
          </p>
        </div>

        {/* Company Selector */}
        {companies.length > 0 && (
          <div className="flex items-center gap-2 bg-muted/40 p-1.5 rounded-xl border border-border/60">
            <Building className="size-4 text-muted-foreground ml-2" />
            <select
              value={selectedCompanyId}
              onChange={(e) => handleCompanyChange(e.target.value)}
              className="bg-transparent text-xs font-bold text-foreground focus:outline-none pr-3 py-1 cursor-pointer"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id} className="bg-card text-foreground">
                  {c.name} ({c.code || "HQ"})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Processors</span>
            <div className="size-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Zap className="size-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-foreground mt-2">
            {gateways.filter((g) => g.isEnabled).length} <span className="text-xs text-muted-foreground font-normal">/ {gateways.length}</span>
          </h3>
          <p className="text-[11px] font-medium text-emerald-600 mt-0.5">Ready to accept payments</p>
        </div>

        <div className="p-4 rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Online UPI & Cards</span>
            <div className="size-7 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <QrCode className="size-4" />
            </div>
          </div>
          <h3 className="text-base font-extrabold text-foreground mt-2">Razorpay (Active)</h3>
          <p className="text-[11px] font-medium text-blue-600 mt-0.5">Instant UPI, QR & Cards</p>
        </div>

        <div className="p-4 rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Retail POS EDC</span>
            <div className="size-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Smartphone className="size-4" />
            </div>
          </div>
          <h3 className="text-base font-extrabold text-foreground mt-2">Pine Labs Handheld</h3>
          <p className="text-[11px] font-medium text-amber-600 mt-0.5">Chip, NFC Tap & Soundbox</p>
        </div>

        <div className="p-4 rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Security & PCI</span>
            <div className="size-7 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center">
              <ShieldCheck className="size-4" />
            </div>
          </div>
          <h3 className="text-base font-extrabold text-emerald-600 mt-2">PCI-DSS Compliant</h3>
          <p className="text-[11px] font-medium text-muted-foreground mt-0.5">Encrypted DB Storage</p>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
          {[
            { id: "all", label: "All Integrations" },
            { id: "domestic", label: "Domestic (UPI & India)" },
            { id: "pos_terminal", label: "POS Handheld EDC Terminals" },
            { id: "international", label: "Global / Cross-Border" },
            { id: "offline", label: "Offline & COD" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                filterCategory === cat.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card border border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Gateways Grid */}
      {loading ? (
        <div className="p-12 text-center text-muted-foreground">
          <Loader2 className="size-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-xs">Loading payment configurations from database...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredGateways.map((gw, idx) => (
            <motion.div
              key={gw.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className={`bg-card rounded-2xl border transition-all shadow-sm flex flex-col justify-between overflow-hidden relative group ${
                gw.isEnabled ? "border-border/80 shadow-md" : "border-border/50 opacity-80"
              }`}
            >
              {/* Card Header */}
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`size-11 rounded-xl font-black text-sm flex items-center justify-center shadow-xs ${gw.logoColor}`}>
                      {gw.logoText}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                        {gw.name}
                      </h3>
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {gw.badgeText}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge & Toggle */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        gw.isEnabled
                          ? gw.isTestMode
                            ? "bg-amber-500/10 text-amber-600 border border-amber-200 dark:border-amber-900/30"
                            : "bg-emerald-500/10 text-emerald-600 border border-emerald-200 dark:border-emerald-900/30"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {gw.isEnabled ? (gw.isTestMode ? "Test Mode" : "Live") : "Disabled"}
                    </span>
                    <input
                      type="checkbox"
                      checked={gw.isEnabled}
                      onChange={() => handleToggleGateway(gw.id)}
                      className="size-4 rounded accent-primary cursor-pointer"
                      title="Enable / Disable Gateway"
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {gw.description}
                </p>

                {/* Supported Payment Methods */}
                <div className="pt-2 border-t border-border/50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Methods Supported
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {gw.supportedMethods.map((m) => (
                      <span
                        key={m}
                        className="px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground text-[10px] font-medium border border-border/40"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-5 py-3 border-t border-border/60 bg-muted/20 flex items-center justify-between text-xs">
                <span className="text-[11px] text-muted-foreground">
                  {gw.currencies.join(", ")}
                </span>
                <button
                  onClick={() => setSelectedGateway(gw)}
                  className="px-3.5 py-1.5 rounded-xl border border-border hover:bg-muted font-semibold text-foreground transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Settings2 className="size-3.5 text-primary" /> Configure Credentials
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Gateway Configuration Modal */}
      <AnimatePresence>
        {selectedGateway && (
          <PaymentGatewayModal
            gateway={selectedGateway}
            companyId={selectedCompanyId}
            onClose={() => setSelectedGateway(null)}
            onSave={handleSaveModal}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
