import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Building2, Save, Globe, Mail, Phone, MapPin, Receipt,
  Sparkles, CheckCircle2, ShieldCheck, CreditCard, Clock, Store
} from "lucide-react";
import { toast } from "sonner";

export function CompanyProfile() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    companyName: "IOTRONCS Retail Private Limited",
    tradingName: "IOTRONCS AI Store",
    businessType: "Private Limited Company",
    gstin: "36AAACI1234F1Z9",
    panNumber: "AAACI1234F",
    cinNumber: "U72900TG2024PTC189000",
    currency: "INR (₹)",
    timezone: "Asia/Kolkata (IST +5:30)",
    fiscalYearStart: "April 1",
    email: "support@iotroncs.com",
    phone: "+91 98765 43210",
    website: "https://iotroncs.com",
    addressLine1: "Suite 402, High-Tech City Tech Park",
    addressLine2: "Madhapur, Phase II",
    city: "Hyderabad",
    state: "Telangana",
    country: "India",
    pincode: "500081",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Company profile & tax details updated successfully!");
    }, 600);
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
                <strong className="text-primary font-bold">Enterprise AI Edition</strong>
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
        </div>
      </form>
    </div>
  );
}
