import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Building2, Save, Globe, Mail, Phone, MapPin, Receipt,
  Sparkles, CheckCircle2, ShieldCheck, CreditCard, Clock, Store,
  QrCode, Star, ExternalLink, Copy, Printer, Check, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { companiesApi } from "@/lib/api-client";

export function CompanyProfile() {
  const { currency, formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [copied, setCopied] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    companyName: "LazyMonkeyAI Private Limited",
    tradingName: "LazyMonkeyAI AI Store",
    businessType: "Private Limited Company",
    gstin: "36AAACI1234F1Z9",
    panNumber: "AAACI1234F",
    cinNumber: "U72900TG2024PTC189000",
    currency: "INR (₹)",
    timezone: "Asia/Kolkata (IST +5:30)",
    fiscalYearStart: "April 1",
    email: "support@lazymonkeyai.com",
    phone: "+91 98765 43210",
    website: "https://lazymonkeyai.com",
    addressLine1: "Suite 402, High-Tech City Tech Park",
    addressLine2: "Madhapur, Phase II",
    city: "Hyderabad",
    state: "Telangana",
    country: "India",
    pincode: "500081",
    googleReviewUrl: "https://search.google.com/local/writereview",
    googlePlaceId: "",
    googleReviewEnabled: true,
  });

  useEffect(() => {
    const loadCompany = async () => {
      try {
        setFetching(true);
        const res = await companiesApi.list(1, 1);
        if (res.items && res.items.length > 0) {
          const c = res.items[0];
          setCompanyId(c.id);
          setFormData((prev) => ({
            ...prev,
            companyName: c.name || prev.companyName,
            tradingName: c.legal_name || c.name || prev.tradingName,
            businessType: c.company_type || prev.businessType,
            gstin: c.gst_number || prev.gstin,
            panNumber: c.pan_number || prev.panNumber,
            cinNumber: c.registration_number || prev.cinNumber,
            currency: c.default_currency_code || prev.currency,
            timezone: c.timezone || prev.timezone,
            email: c.email || prev.email,
            phone: c.phone || prev.phone,
            website: c.website || prev.website,
            addressLine1: c.address || prev.addressLine1,
            city: c.city || prev.city,
            state: c.state || prev.state,
            country: c.country || prev.country,
            googleReviewUrl: c.google_review_url || "https://search.google.com/local/writereview",
            googlePlaceId: c.google_place_id || "",
            googleReviewEnabled: c.google_review_enabled !== false,
          }));
        }
      } catch (e) {
        console.warn("Could not fetch company profile", e);
      } finally {
        setFetching(false);
      }
    };
    loadCompany();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        name: formData.companyName.trim(),
        legal_name: formData.tradingName.trim() || formData.companyName.trim(),
        company_type: formData.businessType,
        gst_number: formData.gstin || null,
        pan_number: formData.panNumber || null,
        registration_number: formData.cinNumber || null,
        default_currency_code: formData.currency?.includes("INR") ? "INR" : formData.currency || "INR",
        timezone: formData.timezone || "Asia/Kolkata",
        email: formData.email || null,
        phone: formData.phone || null,
        website: formData.website || null,
        address: [formData.addressLine1, formData.addressLine2].filter(Boolean).join(", ") || null,
        city: formData.city || null,
        state: formData.state || null,
        country: formData.country || "India",
        google_review_url: formData.googleReviewUrl || null,
        google_place_id: formData.googlePlaceId || null,
        google_review_enabled: formData.googleReviewEnabled,
      };

      if (companyId) {
        await companiesApi.update(companyId, payload);
      } else {
        const created = await companiesApi.create(payload);
        if (created?.id) setCompanyId(created.id);
      }
      toast.success("Company profile & Google Review settings updated successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save company profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-screen-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-primary uppercase tracking-widest">Enterprise Administration</span>
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="size-3" /> Active Tenant
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground mt-1">Company Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your legal entity information, branch profile, tax registration, and global system defaults.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:brightness-110 text-white font-bold text-sm shadow-lg shadow-primary/25 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 shrink-0"
        >
          {loading ? (
            <span>Saving...</span>
          ) : (
            <>
              <Save className="size-4" />
              <span>Save Profile Changes</span>
            </>
          )}
        </button>
      </div>

      {/* Main Profile Form */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: General & Tax Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* General Information Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4"
          >
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Building2 className="size-5 text-primary" />
              <h2 className="font-bold text-base text-foreground">General Organization Info</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Legal Registered Name</label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Brand / Operating Name</label>
                <input
                  type="text"
                  name="tradingName"
                  value={formData.tradingName}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Business Structure</label>
                <select
                  name="businessType"
                  value={formData.businessType}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option>Private Limited Company</option>
                  <option>Public Limited</option>
                  <option>Sole Proprietorship</option>
                  <option>Partnership Firm</option>
                  <option>LLP (Limited Liability Partnership)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Base Currency</label>
                <input
                  type="text"
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">System Timezone</label>
                <input
                  type="text"
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Fiscal Year Start</label>
                <input
                  type="text"
                  name="fiscalYearStart"
                  value={formData.fiscalYearStart}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
          </motion.div>

          {/* Tax & Legal Compliance Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4"
          >
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Receipt className="size-5 text-emerald-500" />
              <h2 className="font-bold text-base text-foreground">Tax & Regulatory Compliance</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">GSTIN Registration</label>
                <input
                  type="text"
                  name="gstin"
                  value={formData.gstin}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-sm font-mono font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">PAN Number</label>
                <input
                  type="text"
                  name="panNumber"
                  value={formData.panNumber}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-sm font-mono font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Corporate Identification Number (CIN)</label>
                <input
                  type="text"
                  name="cinNumber"
                  value={formData.cinNumber}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-sm font-mono font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
          </motion.div>

          {/* Contact & Registered Address Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4"
          >
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <MapPin className="size-5 text-violet-500" />
              <h2 className="font-bold text-base text-foreground">Registered Headquarters & Address</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Address Line 1</label>
                <input
                  type="text"
                  name="addressLine1"
                  value={formData.addressLine1}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Address Line 2</label>
                <input
                  type="text"
                  name="addressLine2"
                  value={formData.addressLine2}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">City</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">State / Province</label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Country</label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">PIN / Postal Code</label>
                <input
                  type="text"
                  name="pincode"
                  value={formData.pincode}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Column: Tenant Info & Contact Details */}
        <div className="space-y-6">
          {/* Subscription & Subscription Plan */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4"
          >
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-500" /> License & Workspace Status
            </h3>

            <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-indigo-500/10 border border-primary/20 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Edition</span>
                <strong className="text-primary font-bold">Enterprise Smart AI for Lazy Geniuses</strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Status</span>
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> Active
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Tenant ID</span>
                <span className="font-mono text-[10px] text-foreground">TNT-BR100-ENTERPRISE</span>
              </div>
            </div>
          </motion.div>

          {/* Direct Communication Channels */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4"
          >
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Globe className="size-4 text-blue-500" /> Digital Channels
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1 flex items-center gap-1.5">
                  <Mail className="size-3.5 text-blue-500" /> Support Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1 flex items-center gap-1.5">
                  <Phone className="size-3.5 text-emerald-500" /> Contact Number
                </label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1 flex items-center gap-1.5">
                  <Globe className="size-3.5 text-violet-500" /> Corporate Website
                </label>
                <input
                  type="text"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
          </motion.div>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/*  GOOGLE BUSINESS PROFILE & REVIEW QR CODE SUITE                  */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="p-6 rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/40 via-card to-purple-50/40 dark:from-indigo-950/20 dark:to-purple-950/20 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                  <Star className="size-4 fill-amber-500" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">Google Review QR Code</h3>
                  <p className="text-[11px] text-muted-foreground">Automate 5-star customer feedback</p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                POS & CRM
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Google Review Direct Link / Place URL
                </label>
                <input
                  type="text"
                  name="googleReviewUrl"
                  value={formData.googleReviewUrl}
                  onChange={handleChange}
                  placeholder="https://g.page/r/.../review or https://search.google.com/local/writereview..."
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Google Place ID (Optional)
                </label>
                <input
                  type="text"
                  name="googlePlaceId"
                  value={formData.googlePlaceId}
                  onChange={handleChange}
                  placeholder="e.g. ChIJN1t_tDeuEmsRUsoyG83frY4"
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {/* Live QR Preview Box */}
              <div className="p-4 rounded-xl bg-card border border-border shadow-xs flex flex-col items-center text-center space-y-2">
                <div className="flex items-center gap-1 text-amber-500 text-xs font-black">
                  <Star className="size-3.5 fill-amber-500" />
                  <Star className="size-3.5 fill-amber-500" />
                  <Star className="size-3.5 fill-amber-500" />
                  <Star className="size-3.5 fill-amber-500" />
                  <Star className="size-3.5 fill-amber-500" />
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=${encodeURIComponent(
                      formData.googleReviewUrl || "https://search.google.com/local/writereview"
                    )}`}
                    alt="Google Review QR Code"
                    className="size-32 object-contain"
                  />
                </div>
                <span className="text-[11px] font-bold text-foreground">Scan with Phone to Review</span>
                <span className="text-[10px] text-muted-foreground">Auto-printed on POS bills & sent via CRM</span>

                {/* Quick Action Buttons */}
                <div className="grid grid-cols-2 gap-2 w-full pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => {
                      if (formData.googleReviewUrl) {
                        navigator.clipboard.writeText(formData.googleReviewUrl);
                        setCopied(true);
                        toast.success("Google Review Link copied to clipboard!");
                        setTimeout(() => setCopied(false), 2000);
                      }
                    }}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-muted/60 hover:bg-muted text-foreground text-xs font-bold transition-colors"
                  >
                    {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    <span>{copied ? "Copied" : "Copy Link"}</span>
                  </button>

                  <a
                    href={formData.googleReviewUrl || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition-colors"
                  >
                    <ExternalLink className="size-3.5" />
                    <span>Test Link</span>
                  </a>
                </div>

                {/* Print Counter Stand / Tent Card */}
                <button
                  type="button"
                  onClick={() => {
                    const reviewUrl = formData.googleReviewUrl || "https://search.google.com/local/writereview";
                    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&data=${encodeURIComponent(reviewUrl)}`;
                    const win = window.open("", "_blank");
                    if (!win) {
                      toast.error("Please allow popups to print the counter stand card");
                      return;
                    }
                    win.document.write(`
                      <!DOCTYPE html>
                      <html>
                        <head>
                          <title>Google Review Counter Stand - ${formData.tradingName || formData.companyName}</title>
                          <style>
                            @page { size: A5 portrait; margin: 10mm; }
                            body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; margin: 0; padding: 24px; background: #f8fafc; color: #0f172a; }
                            .card { border: 3px solid #6366f1; border-radius: 28px; padding: 40px 24px; max-width: 420px; margin: 0 auto; background: #ffffff; box-shadow: 0 20px 35px -10px rgba(99, 102, 241, 0.15); }
                            .logo-badge { background: #eef2ff; color: #4f46e5; display: inline-block; padding: 6px 18px; border-radius: 999px; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px; }
                            h1 { font-size: 26px; font-weight: 900; margin: 0 0 6px 0; color: #0f172a; }
                            .tagline { font-size: 14px; color: #64748b; margin-bottom: 16px; font-weight: 500; }
                            .stars { color: #f59e0b; font-size: 28px; letter-spacing: 6px; margin-bottom: 20px; }
                            .qr-box { background: #ffffff; border: 2px dashed #cbd5e1; border-radius: 24px; padding: 20px; display: inline-block; margin-bottom: 20px; }
                            .qr-box img { width: 200px; height: 200px; display: block; }
                            .scan-inst { font-size: 16px; font-weight: 900; color: #0f172a; text-transform: uppercase; margin: 0 0 6px 0; }
                            .sub-inst { font-size: 12px; color: #64748b; margin: 0; line-height: 1.5; }
                            .footer { margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: 11px; color: #94a3b8; font-weight: 500; }
                          </style>
                        </head>
                        <body>
                          <div class="card">
                            <div class="logo-badge">${formData.tradingName || formData.companyName}</div>
                            <h1>Love our Service?</h1>
                            <p class="tagline">Your experience matters to us!</p>
                            <div class="stars">★ ★ ★ ★ ★</div>
                            <div class="qr-box">
                              <img src="${qrImgUrl}" alt="Google Review QR Code" />
                            </div>
                            <p class="scan-inst">Scan with Camera to Review</p>
                            <p class="sub-inst">Point your smartphone camera at the QR code above to leave a quick review on Google.</p>
                            <div class="footer">
                              ${formData.addressLine1 ? `${formData.addressLine1}, ${formData.city}` : ''} • Thank you for choosing us!
                            </div>
                          </div>
                          <script>
                            window.onload = function() { window.print(); };
                          </script>
                        </body>
                      </html>
                    `);
                    win.document.close();
                  }}
                  className="w-full mt-2 py-2 px-3 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Printer className="size-3.5" />
                  <span>Print Store Counter QR Stand (A5 / Tent Card)</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </form>
    </div>
  );
}
