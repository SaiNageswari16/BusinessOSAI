import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target, Megaphone, Image, Link2, Type, DollarSign,
  CheckCircle2, AlertCircle, Loader2, Plus, Trash2,
  ChevronDown, ChevronUp, Eye, Send, X, Globe,
  Users, TrendingUp, Calendar
} from "lucide-react";
import { paidAdsApi } from "@/lib/api-client";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type CampaignObjective =
  | "OUTCOME_ENGAGEMENT"
  | "OUTCOME_TRAFFIC"
  | "OUTCOME_LEADS"
  | "OUTCOME_SALES"
  | "OUTCOME_AWARENESS"
  | "OUTCOME_APP_INSTALLS"
  | "REACH";

type LeadFormOption = {
  id: string;
  name: string;
  status: string;
  leads_count: number;
};

type CtaType = "SIGN_UP" | "LEARN_MORE" | "SHOP_NOW" | "GET_QUOTE" | "APPLY_NOW" | "DOWNLOAD" | "BOOK_TRAVEL" | "CONTACT_US" | "REQUEST_TIME" | "WATCH_MORE";

const OBJECTIVE_OPTIONS: { value: CampaignObjective; label: string; icon: string }[] = [
  { value: "OUTCOME_LEADS", label: "Lead Generation", icon: "📋" },
  { value: "OUTCOME_SALES", label: "Sales", icon: "💰" },
  { value: "OUTCOME_TRAFFIC", label: "Traffic", icon: "🔗" },
  { value: "OUTCOME_ENGAGEMENT", label: "Engagement", icon: "❤️" },
  { value: "OUTCOME_AWARENESS", label: "Awareness", icon: "👁" },
  { value: "REACH", label: "Reach", icon: "🌐" },
];

const CTA_OPTIONS: { value: CtaType; label: string }[] = [
  { value: "LEARN_MORE", label: "Learn More" },
  { value: "SHOP_NOW", label: "Shop Now" },
  { value: "SIGN_UP", label: "Sign Up" },
  { value: "GET_QUOTE", label: "Get Quote" },
  { value: "APPLY_NOW", label: "Apply Now" },
  { value: "DOWNLOAD", label: "Download" },
  { value: "CONTACT_US", label: "Contact Us" },
  { value: "REQUEST_TIME", label: "Request Time" },
];

const SPECIAL_AD_CATEGORY_OPTIONS = [
  "CREDIT",
  "EMPLOYMENT",
  "HOUSING",
  "ISSUES_ELECTIONS_POLITICS",
  "ONLINE_GAMBLING",
  "SOCIAL_ISSUES_CAUSES",
];

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_TARGETING: Record<string, any> = {
  geo_locations: { countries: ["IN"] },
  p_age_min: 18,
  p_age_max: 65,
  publisher_platforms: ["facebook", "instagram"],
};

const DAILY_BUDGET_OPTIONS = [
  10000, 25000, 50000, 100000, 250000, 500000, 1000000,
]; // in cents (₹100, ₹250, ₹500, ₹1k, ₹2.5k, ₹5k, ₹10k)

// ── Sub-components ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  const steps = ["Campaign", "Creative", "Budget", "Review"];
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div
            className={`
              size-7 rounded-full flex items-center justify-center text-[10px] font-bold
              ${i <= current
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"}
              transition-colors
            `}
          >
            {i + 1}
          </div>
          <span
            className={`text-[10px] font-semibold hidden sm:inline ${
              i <= current ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {label}
          </span>
          {i < steps.length - 1 && (
            <div className={`w-6 h-px mx-1 ${i < current ? "bg-primary" : "bg-muted"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="size-4 text-primary" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function MultiSelectField({
  label,
  options,
  selected,
  onChange,
  maxHeight = "160px",
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  maxHeight?: string;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (v: string) => {
    onChange(
      selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]
    );
  };
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-foreground">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full min-h-[38px] px-3 py-2 rounded-xl border border-input bg-background text-left text-xs flex items-center justify-between hover:border-primary/50 transition-colors"
        >
          <span className={selected.length ? "text-foreground" : "text-muted-foreground"}>
            {selected.length ? `${selected.length} selected` : "None selected"}
          </span>
          {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-xl shadow-xl"
              style={{ maxHeight }}
            >
              <div className="overflow-y-auto p-1.5 space-y-0.5">
                {options.map((opt) => {
                  const isSelected = selected.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggle(opt)}
                      className={`
                        w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] flex items-center gap-2 transition-colors
                        ${isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"}
                      `}
                    >
                      <div
                        className={`size-3.5 rounded border flex items-center justify-center ${
                          isSelected ? "bg-primary border-primary" : "border-input"
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="size-2.5 text-white" />}
                      </div>
                      {opt.replace("ISSUES_ELECTIONS_POLITICS", "Elections / Politics").replace("SOCIAL_ISSUES_CAUSES", "Social Issues")}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {selected.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-semibold"
            >
              {s}
              <button type="button" onClick={() => toggle(s)} className="hover:text-red-500">
                <X className="size-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PaidCampaignBuilder({
  onCreated,
  initialImageUrl,
  initialCaption,
  initialCampaignName,
}: {
  onCreated?: (campaignId: string) => void;
  initialImageUrl?: string;
  initialCaption?: string;
  initialCampaignName?: string;
}) {
  // Step: 0 = Campaign, 1 = Creative, 2 = Budget, 3 = Review
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [leadForms, setLeadForms] = useState<LeadFormOption[]>([]);
  const [loadingForms, setLoadingForms] = useState(false);

  // Step 0: Campaign config
  const [campaignName, setCampaignName] = useState("");
  const [objective, setObjective] = useState<CampaignObjective>("OUTCOME_LEADS");
  const [specialAdCategories, setSpecialAdCategories] = useState<string[]>([]);

  // Step 1: Ad Set + Creative
  const [adsetName, setAdsetName] = useState("");
  const [adName, setAdName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [headline, setHeadline] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [leadFormId, setLeadFormId] = useState("");
  const [ctaType, setCtaType] = useState<CtaType>("LEARN_MORE");

  // Step 2: Budget & Schedule
  const [dailyBudgetCents, setDailyBudgetCents] = useState<number>(0);
  const [lifetimeBudgetCents, setLifetimeBudgetCents] = useState<number | undefined>(undefined);
  const [useLifetime, setUseLifetime] = useState(false);
  const [targeting, setTargeting] = useState<Record<string, any>>(DEFAULT_TARGETING);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  // ── Auto-sync names ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (campaignName) setAdsetName(`${campaignName} – Ad Set`);
    if (!adName) setAdName(`${campaignName} – Ad ${Date.now() % 1000}`);
  }, [campaignName, adName]);

  // ── Pre-fill from AdGenerator pipeline ──────────────────────────────────────
  useEffect(() => {
    if (initialImageUrl) setImageUrl(initialImageUrl);
    if (initialCaption) {
      setCaption(initialCaption);
      // Use caption text as headline (first 100 chars)
      const headlineText = initialCaption.split("\n")[0].replace(/[#@]/g, "").trim();
      if (headlineText.length > 100) setHeadline(headlineText.slice(0, 97) + "...");
      else setHeadline(headlineText);
    }
    if (initialCampaignName) {
      setCampaignName(initialCampaignName);
    }
  }, [initialImageUrl, initialCaption, initialCampaignName]);

  // ── Image preview ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!imageUrl) {
      setImagePreview(null);
      return;
    }
    const img = document.createElement("img");
    img.onload = () => setImagePreview(imageUrl);
    img.onerror = () => setImagePreview(null);
    img.src = imageUrl;
  }, [imageUrl]);

  // ── Lead forms ─────────────────────────────────────────────────────────────
  const loadLeadForms = useCallback(async () => {
    setLoadingForms(true);
    try {
      const res = await paidAdsApi.listLeadForms();
      setLeadForms(res as LeadFormOption[]);
    } catch {
      toast.error("Could not load lead forms. Check your Meta connection.");
    } finally {
      setLoadingForms(false);
    }
  }, []);

  useEffect(() => {
    if (step === 1) loadLeadForms();
  }, [step, loadLeadForms]);

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateStep = (s: number): boolean => {
    if (s === 0) {
      if (!campaignName.trim()) {
        toast.error("Campaign name is required.");
        return false;
      }
      if (campaignName.trim().length < 3) {
        toast.error("Campaign name must be at least 3 characters.");
        return false;
      }
      return true;
    }
    if (s === 1) {
      if (!imageUrl.trim()) { toast.error("Image URL is required."); return false; }
      if (!headline.trim()) { toast.error("Headline is required."); return false; }
      if (!destinationUrl.trim()) { toast.error("Destination URL is required."); return false; }
      if (objective === "OUTCOME_LEADS" && !leadFormId) {
        toast.error("Select a lead form for Lead Generation campaigns.");
        return false;
      }
      try { new URL(destinationUrl); } catch { toast.error("Invalid destination URL."); return false; }
      try { new URL(imageUrl); } catch { toast.error("Invalid image URL."); return false; }
      return true;
    }
    if (s === 2) {
      if (!useLifetime && dailyBudgetCents < 100) {
        toast.error("Daily budget must be at least ₹1.00.");
        return false;
      }
      if (useLifetime && (!lifetimeBudgetCents || lifetimeBudgetCents < 100)) {
        toast.error("Lifetime budget must be at least ₹1.00.");
        return false;
      }
      return true;
    }
    return true;
  };

  const goNext = () => {
    if (validateStep(step)) setStep((s) => s + 1);
  };
  const goBack = () => setStep((s) => Math.max(0, s - 1));

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        campaign_name: campaignName.trim(),
        adset_name: adsetName.trim() || `${campaignName} – Ad Set`,
        ad_name: adName.trim() || `${campaignName} – Ad ${Date.now() % 1000}`,
        objective,
        special_ad_categories: specialAdCategories,
        image_url: imageUrl.trim(),
        caption: caption.trim(),
        headline: headline.trim(),
        destination_url: destinationUrl.trim(),
        cta_type: ctaType,
        daily_budget_cents: useLifetime ? undefined : dailyBudgetCents,
        lifetime_budget_cents: useLifetime ? lifetimeBudgetCents : undefined,
        targeting,
      };

      if (startTime) payload.start_time = startTime;
      if (endTime) payload.end_time = endTime;
      if (leadFormId) payload.lead_form_id = leadFormId;

      const res = await paidAdsApi.createCampaign(payload);
      toast.success("Paid campaign created and submitted! 🎉");
      onCreated?.(res.local_campaign_id);

      // Reset form
      setCampaignName("");
      setAdsetName("");
      setAdName("");
      setImageUrl("");
      setImagePreview(null);
      setCaption("");
      setHeadline("");
      setDestinationUrl("");
      setLeadFormId("");
      setDailyBudgetCents(0);
      setLifetimeBudgetCents(undefined);
      setTargeting(DEFAULT_TARGETING);
      setStep(0);
    } catch (err: any) {
      toast.error(err?.detail || "Failed to create campaign.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-6">
      <StepIndicator current={step} />

      <AnimatePresence mode="wait">
        {/* STEP 0: Campaign Setup */}
        {step === 0 && (
          <motion.div
            key="step-0"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5"
          >
            <SectionTitle icon={Target} title="Campaign Setup" subtitle="Define your campaign objective and reach." />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-foreground">
                  Campaign Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g. Summer Sale 2025 – Brand Awareness"
                  className="w-full px-3 py-2 rounded-xl border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-foreground">Objective</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {OBJECTIVE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setObjective(opt.value)}
                      className={`
                        px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer
                        ${objective === opt.value
                          ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                          : "border-input hover:border-primary/50 bg-background"}
                      `}
                    >
                      <span className="text-lg block mb-0.5">{opt.icon}</span>
                      <span className="text-[11px] font-bold text-foreground block">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <MultiSelectField
                label="Special Ad Categories"
                options={SPECIAL_AD_CATEGORY_OPTIONS}
                selected={specialAdCategories}
                onChange={setSpecialAdCategories}
              />
            </div>
          </motion.div>
        )}

        {/* STEP 1: Ad Creative */}
        {step === 1 && (
          <motion.div
            key="step-1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5"
          >
            <SectionTitle icon={Image} title="Ad Creative" subtitle="Upload your ad image, headline, and call-to-action." />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Ad Set Name
                </label>
                <input
                  type="text"
                  value={adsetName}
                  onChange={(e) => setAdsetName(e.target.value)}
                  placeholder="Auto-filled from campaign"
                  className="w-full px-3 py-2 rounded-xl border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Ad Name
                </label>
                <input
                  type="text"
                  value={adName}
                  onChange={(e) => setAdName(e.target.value)}
                  placeholder="Auto-generated"
                  className="w-full px-3 py-2 rounded-xl border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Image className="size-3.5" /> Ad Image URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/ad-image.jpg"
                  className="w-full px-3 py-2 rounded-xl border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Type className="size-3.5" /> Headline <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. 50% Off Everything!"
                  maxLength={40}
                  className="w-full px-3 py-2 rounded-xl border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <span className="text-[10px] text-muted-foreground">{headline.length}/40</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Link2 className="size-3.5" /> Destination URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  placeholder="https://your-store.com/offers"
                  className="w-full px-3 py-2 rounded-xl border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Megaphone className="size-3.5" /> Caption
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Ad copy – what people will see…"
                  rows={3}
                  maxLength={125}
                  className="w-full px-3 py-2 rounded-xl border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
                <span className="text-[10px] text-muted-foreground">{caption.length}/125</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Call-to-Action Button</label>
                <select
                  value={ctaType}
                  onChange={(e) => setCtaType(e.target.value as CtaType)}
                  className="w-full px-3 py-2 rounded-xl border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {CTA_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {objective === "OUTCOME_LEADS" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Lead Form <span className="text-red-500">*</span>
                  </label>
                  {loadingForms ? (
                    <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" /> Loading forms…
                    </div>
                  ) : (
                    <select
                      value={leadFormId}
                      onChange={(e) => setLeadFormId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="">-- Select a lead form --</option>
                      {leadForms.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.leads_count} leads, {f.status})
                        </option>
                      ))}
                    </select>
                  )}
                  {leadForms.length === 0 && !loadingForms && (
                    <button
                      type="button"
                      onClick={loadLeadForms}
                      className="text-[10px] text-primary hover:underline cursor-pointer"
                    >
                      Refresh lead forms
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Image preview */}
            <AnimatePresence>
              {imagePreview && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-4 p-3 rounded-xl bg-muted/40 border border-border"
                >
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="size-24 object-cover rounded-lg border border-border"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <div className="text-[11px] text-muted-foreground">
                    <span className="font-bold text-foreground">Image Preview</span>
                    <br />
                    Resized to 1200×1200 px on upload.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* STEP 2: Budget & Schedule */}
        {step === 2 && (
          <motion.div
            key="step-2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5"
          >
            <SectionTitle
              icon={DollarSign}
              title="Budget & Schedule"
              subtitle="Set your daily or lifetime budget and campaign timeline."
            />

            <div className="flex items-center gap-3 mb-4">
              <button
                type="button"
                onClick={() => setUseLifetime(false)}
                className={`
                  px-4 py-2 rounded-xl text-[11px] font-bold transition-colors cursor-pointer
                  ${!useLifetime
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"}
                `}
              >
                Daily Budget
              </button>
              <button
                type="button"
                onClick={() => setUseLifetime(true)}
                className={`
                  px-4 py-2 rounded-xl text-[11px] font-bold transition-colors cursor-pointer
                  ${useLifetime
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"}
                `}
              >
                Lifetime Budget
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                {useLifetime ? "Lifetime Budget (₹)" : "Daily Budget (₹)"}
              </label>
              <div className="flex flex-wrap gap-2">
                {DAILY_BUDGET_OPTIONS.map((val) => {
                  const rupees = val / 100;
                  const isSelected = useLifetime
                    ? lifetimeBudgetCents === val
                    : dailyBudgetCents === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        if (useLifetime) setLifetimeBudgetCents(val);
                        else setDailyBudgetCents(val);
                      }}
                      className={`
                        px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors cursor-pointer
                        ${isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"}
                      `}
                    >
                      ₹{rupees.toLocaleString("en-IN")}
                    </button>
                  );
                })}
              </div>
              {useLifetime && (
                <input
                  type="number"
                  value={(lifetimeBudgetCents ?? 0) / 100}
                  onChange={(e) => setLifetimeBudgetCents(Math.round((e.target.valueAsNumber || 0) * 100))}
                  placeholder="Enter amount in ₹"
                  min={1}
                  className="w-full px-3 py-2 rounded-xl border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="size-3.5" /> Start Date
                </label>
                <input
                  type="date"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="size-3.5" /> End Date
                </label>
                <input
                  type="date"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            {/* Targeting summary */}
            <div className="p-3 rounded-xl bg-muted/40 border border-border">
              <p className="text-[11px] font-bold text-foreground mb-1">Default Targeting</p>
              <p className="text-[10px] text-muted-foreground">
                Age {targeting.p_age_min}–{targeting.p_age_max} • Countries:{" "}
                {(targeting.geo_locations?.countries || []).join(", ") || "IN"} •{" "}
                Platforms: {(targeting.publisher_platforms || []).join(", ")}
              </p>
            </div>
          </motion.div>
        )}

        {/* STEP 3: Review & Submit */}
        {step === 3 && (
          <motion.div
            key="step-3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5"
          >
            <SectionTitle icon={Eye} title="Review & Submit" subtitle="Confirm your campaign details before publishing." />

            <div className="space-y-3">
              <ReviewRow label="Campaign Name" value={campaignName} />
              <ReviewRow label="Objective" value={OBJECTIVE_OPTIONS.find(o => o.value === objective)?.label} />
              <ReviewRow label="Ad Set" value={adsetName || `${campaignName} – Ad Set`} />
              <ReviewRow label="Ad Name" value={adName} />
              <ReviewRow label="Image" value={imagePreview ? "Ready ✓" : imageUrl} mono />
              <ReviewRow label="Headline" value={headline} />
              <ReviewRow label="Destination URL" value={destinationUrl} small />
              <ReviewRow label="CTA Button" value={ctaType} />
              <ReviewRow
                label="Budget"
                value={
                  useLifetime
                    ? `₹${((lifetimeBudgetCents || 0) / 100).toLocaleString("en-IN")} (Lifetime)`
                    : `₹${(dailyBudgetCents / 100).toLocaleString("en-IN")} / day`
                }
              />
              {startTime && <ReviewRow label="Starts" value={startTime} />}
              {endTime && <ReviewRow label="Ends" value={endTime} />}
              {specialAdCategories.length > 0 && (
                <ReviewRow label="Special Categories" value={specialAdCategories.join(", ")} />
              )}
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                <span className="font-bold">Heads up:</span> Creating a campaign submits it to Meta for review.
                Ads go live once approved by Meta's policy team. This usually takes a few hours.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Navigation ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div>
          {step > 0 && (
            <button
              type="button"
              onClick={goBack}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Back
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {step < 3 ? (
            <button
              type="button"
              onClick={goNext}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Continue <ChevronDown className="size-3.5 rotate-[-90deg]" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white text-xs font-bold hover:from-green-700 hover:to-emerald-700 transition-all cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Publishing…
                </>
              ) : (
                <>
                  <Send className="size-3.5" /> Publish Campaign
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Small reusable review row ─────────────────────────────────────────────────

function ReviewRow({
  label,
  value,
  small,
  mono,
}: {
  label: string;
  value: string | undefined;
  small?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border/50 last:border-0">
      <span className="text-[11px] text-muted-foreground flex-shrink-0">{label}</span>
      <span
        className={`
          text-[11px] font-semibold text-right break-all
          ${small ? "text-[10px]" : ""}
          ${mono ? "font-mono" : ""}
        `}
      >
        {value || <span className="text-muted-foreground font-normal">—</span>}
      </span>
    </div>
  );
}
