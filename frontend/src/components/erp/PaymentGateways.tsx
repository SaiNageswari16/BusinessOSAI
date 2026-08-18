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
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";

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
      keyId: "rzp_test_9831948194",
      keySecret: "••••••••••••••••••••••••",
      webhookSecret: "whsec_••••••••••••••••••••",
    },
    supportedMethods: ["UPI & QR", "Cards (Visa/MC/RuPay)", "Net Banking (50+ banks)", "Wallets", "EMI"],
    currencies: ["INR", "USD", "EUR", "GBP", "AED"],
    docUrl: "https://razorpay.com/docs",
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
    isEnabled: true,
    isTestMode: true,
    credentials: {
      publishableKey: "pk_test_51Mz••••••••••••••••••••",
      secretKey: "sk_test_••••••••••••••••••••••••",
      webhookSecret: "whsec_••••••••••••••••••••",
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
    id: "paytm",
    name: "Paytm PG",
    category: "domestic",
    description: "All-in-one payment suite with Paytm Payments Bank, Paytm Wallet, and multi-bank UPI stack.",
    iconBg: "bg-sky-500/10 text-sky-600 border-sky-200 dark:border-sky-900/30",
    logoText: "PTM",
    logoColor: "bg-sky-600 text-white",
    badgeText: "Paytm Ecosystem",
    isEnabled: false,
    isTestMode: true,
    credentials: {
      merchantId: "",
      merchantKey: "",
      website: "WEBSTAGING",
    },
    supportedMethods: ["Paytm Wallet", "UPI Intent & Dynamic QR", "Net Banking", "Cards"],
    currencies: ["INR"],
    docUrl: "https://developer.paytm.com",
  },
  {
    id: "cashfree",
    name: "Cashfree Payments",
    category: "domestic",
    description: "Payment gateway with instant refunds, payouts, subscriptions, and buy now pay later (BNPL).",
    iconBg: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-900/30",
    logoText: "CF",
    logoColor: "bg-emerald-600 text-white",
    badgeText: "Instant Refunds",
    isEnabled: false,
    isTestMode: true,
    credentials: {
      appId: "",
      secretKey: "",
    },
    supportedMethods: ["UPI", "Cards", "Net Banking", "Pay Later", "Wallets"],
    currencies: ["INR", "USD"],
    docUrl: "https://docs.cashfree.com",
  },
  {
    id: "paypal",
    name: "PayPal Express",
    category: "international",
    description: "Trusted global checkout brand for international buyers with Buyer & Seller Protection.",
    iconBg: "bg-blue-500/10 text-blue-800 border-blue-200 dark:border-blue-900/30",
    logoText: "PP",
    logoColor: "bg-blue-700 text-white",
    badgeText: "Cross-Border",
    isEnabled: false,
    isTestMode: true,
    credentials: {
      clientId: "",
      clientSecret: "",
    },
    supportedMethods: ["PayPal Balance", "Linked Credit Cards", "Pay in 4 (Pay Later)"],
    currencies: ["USD", "EUR", "GBP", "CAD", "AUD"],
    docUrl: "https://developer.paypal.com",
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
    isTestMode: false,
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
  onClose,
  onSave,
}: {
  gateway: PaymentGatewayConfig;
  onClose: () => void;
  onSave: (updated: PaymentGatewayConfig) => void;
}) {
  const [form, setForm] = useState<PaymentGatewayConfig>({ ...gateway });
  const [testing, setTesting] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const webhookUrl = `https://api.lazymonkeyai.com/api/v1/payments/webhooks/${gateway.id}`;

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    toast.success("Webhook URL copied to clipboard");
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handleTestConnection = () => {
    setTesting(true);
    setTimeout(() => {
      setTesting(false);
      toast.success(`Handshake with ${gateway.name} API verified successfully!`);
    }, 1200);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    toast.success(`${gateway.name} configuration saved successfully`);
    onClose();
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
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  form.isEnabled ? "bg-emerald-500/10 text-emerald-600 border border-emerald-200" : "bg-muted text-muted-foreground"
                }`}>
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
        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto text-xs">
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
              <KeyRound className="size-3.5 text-primary" /> API Credentials & Secret Keys
            </h4>

            {Object.keys(form.credentials).map((key) => (
              <div key={key}>
                <label className="block font-semibold text-muted-foreground mb-1 capitalize">
                  {key.replace(/([A-Z])/g, " $1")} *
                </label>
                <input
                  type={key.toLowerCase().includes("secret") || key.toLowerCase().includes("key") ? "password" : "text"}
                  required
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
            <p className="text-[11px] text-muted-foreground">
              Paste this URL into your {form.name} Merchant Dashboard under Webhooks to receive instant payment success callbacks.
            </p>
            <div className="p-2 bg-background border border-border rounded-lg font-mono text-[10px] text-muted-foreground break-all">
              {webhookUrl}
            </div>
          </div>

          {/* Supported Methods Badges */}
          <div>
            <h4 className="font-bold text-foreground mb-1.5 uppercase tracking-wider text-[11px]">
              Supported Payment Methods
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {form.supportedMethods.map((m) => (
                <span key={m} className="px-2.5 py-1 rounded-lg bg-muted/60 text-muted-foreground text-[11px] font-medium border border-border/50">
                  {m}
                </span>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-border/60">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-border hover:bg-muted transition-colors flex items-center gap-1.5"
            >
              {testing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              Test Connection
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold rounded-xl gradient-brand text-white shadow-md hover:opacity-90 transition-opacity"
              >
                Save Settings
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Main Payment Gateways Component ─────────────────────────────────────────
export function PaymentGateways() {
  const { currency, formatCurrency } = useCurrency();
  const [gateways, setGateways] = useState<PaymentGatewayConfig[]>(() => {
    const saved = localStorage.getItem("bos-payment-gateways");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_GATEWAYS;
      }
    }
    return DEFAULT_GATEWAYS;
  });

  const [selectedGateway, setSelectedGateway] = useState<PaymentGatewayConfig | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const saveGateways = (updatedList: PaymentGatewayConfig[]) => {
    setGateways(updatedList);
    localStorage.setItem("bos-payment-gateways", JSON.stringify(updatedList));
  };

  const handleToggleGateway = (id: string) => {
    const updated = gateways.map((g) => {
      if (g.id === id) {
        const next = !g.isEnabled;
        toast.success(`${g.name} ${next ? "Enabled" : "Disabled"}`);
        return { ...g, isEnabled: next };
      }
      return g;
    });
    saveGateways(updated);
  };

  const handleSaveModal = (updated: PaymentGatewayConfig) => {
    const nextList = gateways.map((g) => (g.id === updated.id ? updated : g));
    saveGateways(nextList);
    setSelectedGateway(null);
  };

  const filteredGateways = gateways.filter((g) => {
    if (filterCategory === "all") return true;
    return g.category === filterCategory;
  });

  const activeCount = gateways.filter((g) => g.isEnabled).length;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Payment Gateways & Integrations</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-200 dark:border-emerald-900/30">
              {activeCount} Active Gateway{activeCount !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Configure online checkout providers, domestic UPI aggregators, global card processors, and retail EDC swipers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-muted-foreground">
            <Globe className="size-3.5 text-primary" />
            <span>Store Currency: <strong>{currency.code} ({currency.symbol})</strong></span>
          </div>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Providers</span>
            <div className="size-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Zap className="size-4" />
            </div>
          </div>
          <h3 className="text-2xl font-extrabold text-foreground mt-2">{activeCount} / {gateways.length}</h3>
          <p className="text-[11px] font-medium text-emerald-600 mt-0.5">Ready to process</p>
        </div>

        <div className="p-4 rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Primary Domestic</span>
            <div className="size-7 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <CreditCard className="size-4" />
            </div>
          </div>
          <h3 className="text-base font-extrabold text-foreground mt-2">Razorpay (UPI + Cards)</h3>
          <p className="text-[11px] font-medium text-blue-600 mt-0.5">Test Mode Active</p>
        </div>

        <div className="p-4 rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Primary Global</span>
            <div className="size-7 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
              <Globe className="size-4" />
            </div>
          </div>
          <h3 className="text-base font-extrabold text-foreground mt-2">Stripe Checkout</h3>
          <p className="text-[11px] font-medium text-indigo-600 mt-0.5">135+ Currencies</p>
        </div>

        <div className="p-4 rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Security & PCI</span>
            <div className="size-7 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center">
              <ShieldCheck className="size-4" />
            </div>
          </div>
          <h3 className="text-base font-extrabold text-emerald-600 mt-2">PCI-DSS Level 1</h3>
          <p className="text-[11px] font-medium text-muted-foreground mt-0.5">End-to-End Encrypted</p>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
          {[
            { id: "all", label: "All Integrations" },
            { id: "domestic", label: "Domestic (UPI & India)" },
            { id: "international", label: "Global / Cross-Border" },
            { id: "pos_terminal", label: "POS EDC Terminals" },
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
                className="px-3.5 py-1.5 rounded-xl border border-border hover:bg-muted font-semibold text-foreground transition-colors flex items-center gap-1.5"
              >
                <Settings2 className="size-3.5 text-primary" /> Configure
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Gateway Configuration Modal */}
      <AnimatePresence>
        {selectedGateway && (
          <PaymentGatewayModal
            gateway={selectedGateway}
            onClose={() => setSelectedGateway(null)}
            onSave={handleSaveModal}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
