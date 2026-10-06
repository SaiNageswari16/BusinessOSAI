'use client';

import React, { useState, useEffect } from 'react';
import { useI18n } from "@/contexts/i18n-context";
import {
  FileCheck,
  Printer,
  Sparkles,
  Save,
  RotateCcw,
  CheckCircle2,
  Sliders,
  QrCode,
  Building,
  Phone,
  Mail,
  FileText,
  Eye,
  Check,
  Copy,
  Info,
  Type,
  Layers,
  ShoppingBag,
  Calculator,
  ShieldCheck,
  Split,
  ChevronDown
} from 'lucide-react';
import {
  ReceiptTemplate,
  DEFAULT_RECEIPT_TEMPLATE,
  getActiveReceiptTemplate,
  saveActiveReceiptTemplate,
  getStoredReceiptTemplates
} from '../../lib/receipt-template-store';
import { toast } from 'sonner';
import { triggerThermalPrint } from '../../lib/print-helper';
import { useCurrency } from "@/hooks/use-currency";

export function ReceiptTemplates() {
  const { t } = useI18n();
  const { currency, formatCurrency } = useCurrency();
  const [template, setTemplate] = useState<ReceiptTemplate>(DEFAULT_RECEIPT_TEMPLATE);
  const [templatesList, setTemplatesList] = useState<ReceiptTemplate[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'clarity' | 'header' | 'customer' | 'items' | 'totals' | 'terms'>('clarity');

  useEffect(() => {
    const active = getActiveReceiptTemplate();
    setTemplate(active);
    setTemplatesList(getStoredReceiptTemplates());
  }, []);

  const handleSave = () => {
    saveActiveReceiptTemplate(template);
    setIsSaved(true);
    toast.success('Thermal Receipt settings & layout saved successfully!');
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleTestPrint = () => {
    saveActiveReceiptTemplate(template);
    triggerThermalPrint();
  };

  const handleResetDefault = () => {
    setTemplate(DEFAULT_RECEIPT_TEMPLATE);
    saveActiveReceiptTemplate(DEFAULT_RECEIPT_TEMPLATE);
    toast.info('Reset to default high-clarity 80mm thermal receipt template');
  };

  const updateField = (key: keyof ReceiptTemplate, val: any) => {
    setTemplate(prev => ({ ...prev, [key]: val }));
  };

  const dividerBorderClass = template.dividerStyle === 'solid'
    ? 'border-solid'
    : template.dividerStyle === 'dotted'
    ? 'border-dotted'
    : template.dividerStyle === 'double'
    ? 'border-double'
    : 'border-dashed';

  const fontFam = template.fontFamily === 'sans-serif'
    ? '"Segoe UI", -apple-system, BlinkMacSystemFont, "Roboto", "Helvetica Neue", Arial, sans-serif'
    : template.fontFamily === 'clean'
    ? '"Inter", "Segoe UI", -apple-system, sans-serif'
    : '"Consolas", "Courier New", Courier, monospace';

  return (
    <div className="space-y-6 font-sans text-slate-800">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {t("Thermal Receipt & Print Settings", "Thermal Receipt & Print Settings")}
            </h2>
            <span className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Ultra-Dark Clarity Engine Active
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {t("Configure high-contrast dark text, custom columns, terms & conditions, and roll layouts for 80mm/58mm thermal printers", "Configure high-contrast dark text, custom columns, terms & conditions, and roll layouts for 80mm/58mm thermal printers")}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleResetDefault}
            className="px-3 h-8 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
          </button>
          <button
            onClick={handleTestPrint}
            className="px-3 h-8 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-card border border-slate-300 dark:border-slate-700 hover:bg-slate-50 rounded-lg transition-all shadow-xs flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5 text-indigo-600" /> Test Thermal Print
          </button>
          <button
            onClick={handleSave}
            className="px-3.5 h-8 text-xs font-bold text-white gradient-brand hover:opacity-90 rounded-lg transition-all shadow-xs flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" /> {isSaved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Main Settings & Live Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Granular Settings Panel (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Navigation Tabs for Granular Settings */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border overflow-x-auto">
            {[
              { id: 'clarity', label: 'Clarity & Hardware', icon: Sliders },
              { id: 'header', label: 'Store Header', icon: Building },
              { id: 'customer', label: 'Customer & Meta', icon: ShieldCheck },
              { id: 'items', label: 'Item Columns', icon: ShoppingBag },
              { id: 'totals', label: 'Totals & QR', icon: Calculator },
              { id: 'terms', label: 'Terms & Notes', icon: FileText },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    isActive
                      ? 'bg-background text-primary shadow-xs border border-border/80'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* TAB 1: Print Clarity & Hardware */}
          {activeTab === 'clarity' && (
            <div className="space-y-4">
              <div className="bg-card p-4 rounded-xl border border-border shadow-xs space-y-3">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/50 pb-2">
                  <Sliders className="w-3.5 h-3.5 text-indigo-600" /> Print Density & Ultra-Dark Engine
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">Print Clarity Engine</label>
                    <select
                      value={template.printClarity || 'ultra_dark'}
                      onChange={(e) => updateField('printClarity', e.target.value)}
                      className="w-full h-8 bg-background border border-border rounded-lg px-2.5 text-xs font-bold text-foreground outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="ultra_dark">★ Ultra-Dark High-Contrast (Deep Black / No Fading)</option>
                      <option value="crisp_mono">Crisp Monospace (Sharp Thermal Edges)</option>
                      <option value="compact">Compact Dense (Maximum Lines)</option>
                      <option value="standard">Standard Default</option>
                    </select>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Enforces heavy font-weight, dark ink stroke emulation, and high-contrast rendering.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">Receipt Font Family</label>
                    <select
                      value={template.fontFamily || 'monospace'}
                      onChange={(e) => updateField('fontFamily', e.target.value)}
                      className="w-full h-8 bg-background border border-border rounded-lg px-2.5 text-xs font-bold text-foreground outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="monospace">Monospace (Classic POS Consolas/Courier)</option>
                      <option value="sans-serif">Modern Sans-Serif (Segoe UI/Arial)</option>
                      <option value="clean">Clean Minimal (Inter/Roboto)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">Thermal Roll Width</label>
                    <select
                      value={template.paperSize}
                      onChange={(e) => updateField('paperSize', e.target.value)}
                      className="w-full h-8 bg-background border border-border rounded-lg px-2.5 text-xs font-bold text-foreground outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="80mm">80mm (3-Inch Standard Desktop POS - HSPRINTER / Epson / TVS / Citizen)</option>
                      <option value="58mm">58mm (2-Inch Portable Bluetooth / Handheld POS)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">Divider Line Style</label>
                    <select
                      value={template.dividerStyle || 'dashed'}
                      onChange={(e) => updateField('dividerStyle', e.target.value)}
                      className="w-full h-8 bg-background border border-border rounded-lg px-2.5 text-xs font-bold text-foreground outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="dashed">Dashed Lines ( - - - - - )</option>
                      <option value="solid">Solid Black Lines ( ─────── )</option>
                      <option value="dotted">Dotted Lines ( • • • • • )</option>
                      <option value="double">Double Border Lines ( ═══════ )</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Store & Header Branding */}
          {activeTab === 'header' && (
            <div className="bg-card p-4 rounded-xl border border-border shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/50 pb-2">
                <Building className="w-3.5 h-3.5 text-purple-600" /> Store Branding & Header Fields
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">Store / Legal Name *</label>
                  <input
                    type="text"
                    value={template.storeName}
                    onChange={(e) => updateField('storeName', e.target.value)}
                    className="w-full h-8 bg-background border border-border rounded-lg px-2.5 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">Branch / Outlet Name</label>
                  <input
                    type="text"
                    value={template.branchName}
                    onChange={(e) => updateField('branchName', e.target.value)}
                    className="w-full h-8 bg-background border border-border rounded-lg px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">Receipt Header Title</label>
                  <input
                    type="text"
                    value={template.invoiceTitle}
                    onChange={(e) => updateField('invoiceTitle', e.target.value)}
                    className="w-full h-8 bg-background border border-border rounded-lg px-2.5 text-xs font-bold text-indigo-700 outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">Tagline / Subtitle</label>
                  <input
                    type="text"
                    value={template.headerTagline}
                    onChange={(e) => updateField('headerTagline', e.target.value)}
                    className="w-full h-8 bg-background border border-border rounded-lg px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Store Address (Multi-line)</label>
                <textarea
                  rows={2}
                  value={template.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">GSTIN / Tax ID</label>
                  <input
                    type="text"
                    value={template.gstin}
                    onChange={(e) => updateField('gstin', e.target.value)}
                    className="w-full h-8 bg-background border border-border rounded-lg px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">CIN / Registration No</label>
                  <input
                    type="text"
                    value={template.cin}
                    onChange={(e) => updateField('cin', e.target.value)}
                    className="w-full h-8 bg-background border border-border rounded-lg px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={template.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    className="w-full h-8 bg-background border border-border rounded-lg px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">Email Address</label>
                  <input
                    type="email"
                    value={template.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    className="w-full h-8 bg-background border border-border rounded-lg px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-border/60">
                <label className="text-xs font-bold text-foreground block mb-2">Header Visibility Toggles</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { key: 'showLogo', label: 'Print Logo / Monogram' },
                    { key: 'showStoreName', label: 'Print Store Name' },
                    { key: 'showBranchName', label: 'Print Branch Name' },
                    { key: 'showInvoiceTitle', label: 'Print Header Title Banner' },
                    { key: 'showTagline', label: 'Print Store Tagline' },
                    { key: 'showStoreAddress', label: 'Print Store Address' },
                    { key: 'showStoreContact', label: 'Print Phone & Email' },
                    { key: 'showTaxId', label: 'Print GSTIN / Tax ID' },
                    { key: 'showCin', label: 'Print CIN / Reg No' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors border border-border/60">
                      <input
                        type="checkbox"
                        checked={(template as any)[key] !== false}
                        onChange={(e) => updateField(key as any, e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                      <span className="font-semibold text-foreground text-[11px]">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Customer & Transaction Meta */}
          {activeTab === 'customer' && (
            <div className="bg-card p-4 rounded-xl border border-border shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/50 pb-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Customer & Transaction Meta Toggles
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {[
                  { key: 'showCustomerDetails', label: 'Show Customer Name' },
                  { key: 'showCustomerPhone', label: 'Show Customer Phone' },
                  { key: 'showCustomerAddress', label: 'Show Customer Billing Address' },
                  { key: 'showShippingAddress', label: 'Show Shipping / Delivery Address' },
                  { key: 'showTime', label: 'Show Print Time' },
                  { key: 'showCashier', label: 'Show Cashier Name' },
                  { key: 'showPoNumber', label: 'Show PO Reference Number' },
                  { key: 'showVehicleNumber', label: 'Show Vehicle / Transport Number' },
                  { key: 'showEwayBill', label: 'Show e-Way Bill Number' },
                  { key: 'showChallanNumber', label: 'Show Delivery Challan Number' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors border border-border/60">
                    <input
                      type="checkbox"
                      checked={(template as any)[key] !== false}
                      onChange={(e) => updateField(key as any, e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="font-semibold text-foreground text-[11px]">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: Item Table Columns */}
          {activeTab === 'items' && (
            <div className="bg-card p-4 rounded-xl border border-border shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/50 pb-2">
                <ShoppingBag className="w-3.5 h-3.5 text-blue-600" /> Thermal Item Table Column Toggles
              </h3>
              <p className="text-xs text-muted-foreground">
                Enable or disable individual columns on the receipt table just like invoice customization.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {[
                  { key: 'showItemIndex', label: 'Column: Item Index (#1, #2...)' },
                  { key: 'showItemName', label: 'Column: Item / Product Name' },
                  { key: 'showItemDescription', label: 'Row: Item Description & Notes' },
                  { key: 'showItemHSN', label: 'Tag: Item HSN/SAC Code' },
                  { key: 'showItemSKU', label: 'Tag: Item SKU / Barcode' },
                  { key: 'showItemQty', label: 'Column: Quantity' },
                  { key: 'showItemUom', label: 'Unit of Measure (UOM/Unit)' },
                  { key: 'showItemRate', label: 'Column: Unit Rate / Price' },
                  { key: 'showItemMrp', label: 'Tag: MRP Comparison' },
                  { key: 'showItemDiscount', label: 'Tag: Item Discount Amount' },
                  { key: 'showItemTax', label: 'Tag: Item Tax Amount' },
                  { key: 'showItemTotal', label: 'Column: Line Total Amount' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors border border-border/60">
                    <input
                      type="checkbox"
                      checked={(template as any)[key] !== false}
                      onChange={(e) => updateField(key as any, e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="font-semibold text-foreground text-[11px]">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: Totals, Payments & QR */}
          {activeTab === 'totals' && (
            <div className="bg-card p-4 rounded-xl border border-border shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/50 pb-2">
                <Calculator className="w-3.5 h-3.5 text-amber-600" /> Totals, Discounts & QR Settings
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {[
                  { key: 'showSubtotal', label: 'Show Subtotal' },
                  { key: 'showTotalDiscount', label: 'Show Total Discount Line' },
                  { key: 'showSavingsBanner', label: '★ Show Savings Banner (You Saved ₹X)' },
                  { key: 'showTaxBreakdown', label: 'Show GST Split (CGST / SGST / IGST)' },
                  { key: 'showRoundOff', label: 'Show Round Off Amount' },
                  { key: 'showGrandTotal', label: 'Show Grand Total (Emphasized)' },
                  { key: 'showPaymentMode', label: 'Show Payment Mode (Cash/UPI/Card)' },
                  { key: 'showPaidInFullStamp', label: '★ Show [PAID IN FULL] Stamp' },
                  { key: 'showLoyaltyPoints', label: 'Show Loyalty Points Earned' },
                  { key: 'showQrCode', label: 'Print UPI Payment QR Code' },
                  { key: 'showGoogleReviewQR', label: '★ Print Google Review Feedback QR' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors border border-border/60">
                    <input
                      type="checkbox"
                      checked={(template as any)[key] !== false}
                      onChange={(e) => updateField(key as any, e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="font-semibold text-foreground text-[11px]">{label}</span>
                  </label>
                ))}
              </div>

              {template.showGoogleReviewQR && (
                <div className="mt-3 pt-3 border-t border-border/60 space-y-1.5">
                  <label className="text-xs font-bold text-foreground block">Google Review URL / Short Link</label>
                  <input
                    type="text"
                    placeholder="e.g. https://g.page/r/.../review or https://search.google.com/local/writereview"
                    value={template.googleReviewUrl || ''}
                    onChange={(e) => updateField('googleReviewUrl', e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 6: Terms & Conditions, Declaration & Footer */}
          {activeTab === 'terms' && (
            <div className="bg-card p-4 rounded-xl border border-border shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/50 pb-2">
                <FileText className="w-3.5 h-3.5 text-amber-600" /> Terms & Conditions & Footer Notes
              </h3>

              {/* Terms & Conditions Block */}
              <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/60">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={template.showTermsAndConditions !== false}
                      onChange={(e) => updateField('showTermsAndConditions', e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <span>Print Terms & Conditions on Thermal Receipt</span>
                  </label>
                  <span className="text-[10px] text-muted-foreground font-semibold">Separate from Declaration</span>
                </div>
                
                {template.showTermsAndConditions !== false && (
                  <textarea
                    rows={4}
                    value={template.termsAndConditionsText || ''}
                    onChange={(e) => updateField('termsAndConditionsText', e.target.value)}
                    placeholder="1. Goods once sold will not be taken back without original bill.&#10;2. Warranty as per manufacturer terms.&#10;3. Disputes subject to local jurisdiction."
                    className="w-full bg-background border border-border rounded-lg p-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                )}
              </div>

              {/* Declaration Block */}
              <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/60">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={template.showDeclaration !== false}
                      onChange={(e) => updateField('showDeclaration', e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <span>Print Statutory Declaration</span>
                  </label>
                </div>
                
                {template.showDeclaration !== false && (
                  <textarea
                    rows={2}
                    value={template.declarationText || ''}
                    onChange={(e) => updateField('declarationText', e.target.value)}
                    className="w-full bg-background border border-border rounded-lg p-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                  />
                )}
              </div>

              {/* Footer Note Block */}
              <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/60">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={template.showFooterNote !== false}
                      onChange={(e) => updateField('showFooterNote', e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <span>Print Footer Thank You Note</span>
                  </label>
                </div>
                
                {template.showFooterNote !== false && (
                  <textarea
                    rows={2}
                    value={template.footerNote || ''}
                    onChange={(e) => updateField('footerNote', e.target.value)}
                    className="w-full bg-background border border-border rounded-lg p-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live High-Clarity Thermal Receipt Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-slate-950 text-slate-100 p-4 rounded-xl border border-slate-800 shadow-2xl sticky top-20">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> High-Clarity Thermal Preview
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {template.paperSize} Roll • {template.printClarity || 'ultra_dark'}
              </span>
            </div>

            {/* Real-time Rendered High-Contrast Thermal Receipt Component */}
            <div
              className="bg-white text-black p-3.5 text-[11px] leading-tight rounded-lg shadow-inner border-2 border-slate-400 overflow-y-auto max-h-[640px] select-none mx-auto w-full max-w-[310px]"
              style={{
                fontFamily: fontFam,
                fontWeight: 800,
                color: '#000000',
                textShadow: '0 0 0.2px #000000',
              }}
            >
              {/* Header */}
              <div className={`text-center border-b-2 ${dividerBorderClass} border-black pb-2 mb-2`}>
                {template.showLogo !== false && (
                  <div className="mx-auto h-7 w-7 bg-black text-white font-extrabold flex items-center justify-center text-xs rounded mb-1">
                    {template.storeName ? template.storeName.substring(0, 2).toUpperCase() : 'IS'}
                  </div>
                )}
                {template.showStoreName !== false && (
                  <h4 className="text-sm font-black uppercase tracking-tight text-black">{template.storeName}</h4>
                )}
                {template.showBranchName !== false && template.branchName && (
                  <p className="text-[10px] text-black font-bold">{template.branchName}</p>
                )}
                {template.showTagline !== false && template.headerTagline && (
                  <p className="text-[9px] italic text-black font-bold mt-0.5">{template.headerTagline}</p>
                )}
                {template.showStoreAddress !== false && template.address && (
                  <p className="text-[10px] text-black font-bold whitespace-pre-line mt-1">{template.address}</p>
                )}
                {template.showStoreContact !== false && (
                  <div className="text-[10px] text-black font-bold mt-0.5">
                    Ph: {template.phone} • {template.email}
                  </div>
                )}
                {template.showTaxId !== false && template.gstin && (
                  <p className="text-[10px] font-black text-black mt-1">
                    GSTIN: {template.gstin}
                  </p>
                )}
                {template.showCin !== false && template.cin && (
                  <p className="text-[9px] font-bold text-black">
                    CIN: {template.cin}
                  </p>
                )}
                {template.showInvoiceTitle !== false && (
                  <div className="font-black border-2 border-black inline-block px-2.5 py-0.5 mt-1.5 text-[11px] uppercase tracking-wider text-black">
                    {template.invoiceTitle}
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className={`text-[10px] font-bold border-b-2 ${dividerBorderClass} border-black pb-1.5 mb-1.5 space-y-0.5 text-black`}>
                <div className="flex justify-between">
                  <span className="font-black">Bill No: INV-20260805-13767</span>
                  <span>Date: 05 Aug 2026</span>
                </div>
                <div className="flex justify-between">
                  {template.showTime !== false && <span>Time: 09:24 PM</span>}
                  {template.showCashier !== false && <span>Cashier: Sarah J.</span>}
                </div>
                {template.showCustomerDetails !== false && (
                  <div className={`border-t ${dividerBorderClass} border-black pt-1 mt-1 space-y-0.5 text-black`}>
                    <div className="font-black">Customer: Rahul Sharma</div>
                    {template.showCustomerPhone !== false && <div>Phone: +91 9876543210</div>}
                    {template.showCustomerAddress !== false && <div>Bill To: 42 Palm Grove, Phase 2, Hyderabad</div>}
                    {template.showShippingAddress !== false && <div className="font-black">Ship To: 42 Palm Grove, Phase 2, Hyderabad</div>}
                    {template.showPoNumber !== false && <div>PO Ref: PO-98421</div>}
                    {template.showVehicleNumber !== false && <div>Vehicle: TS-09-EA-1234</div>}
                    {template.showEwayBill !== false && <div className="font-black">e-Way Bill: 241098234123</div>}
                    {template.showChallanNumber !== false && <div>Challan No: CH-5432</div>}
                  </div>
                )}
              </div>

              {/* Items Table */}
              <table className="w-full text-left text-[10px] my-1 font-bold text-black border-collapse">
                <thead>
                  <tr className="border-b-2 border-black font-black text-[10.5px]">
                    {template.showItemIndex !== false && <th className="pb-1 w-5 text-left text-black">#</th>}
                    {template.showItemName !== false && <th className="pb-1 text-left text-black">ITEM</th>}
                    {template.showItemQty !== false && <th className="pb-1 text-center text-black">QTY</th>}
                    {template.showItemRate !== false && <th className="pb-1 text-right text-black">RATE</th>}
                    {template.showItemTotal !== false && <th className="pb-1 text-right text-black">TOTAL</th>}
                  </tr>
                </thead>
                <tbody className={`divide-y ${dividerBorderClass} divide-black`}>
                  {[
                    { name: 'AirPods Pro Gen 2', desc: 'Active Noise Cancelling', sku: 'APP-G2-WHT', hsn: '8518', mrp: 269.99, qty: 1, uom: 'PCS', rate: 249.99, disc: 20.0, tax: 22.5, total: 249.99 },
                    { name: 'Samsung Buds2 Pro', desc: 'Bora Purple Special Ed.', sku: 'SAM-B2P-PRP', hsn: '8518', mrp: 169.99, qty: 2, uom: 'PCS', rate: 149.99, disc: 10.0, tax: 27.0, total: 299.98 },
                    { name: 'L\'Oreal Hair Care', desc: '500ml Salon Pack', sku: 'LOR-HC-500', hsn: '3305', mrp: 19.99, qty: 1, uom: 'BTL', rate: 14.99, disc: 5.0, tax: 2.7, total: 14.99 }
                  ].map((item, idx) => (
                    <tr key={idx} className="text-black">
                      {template.showItemIndex !== false && (
                        <td className="py-1 pr-1 font-black align-top">{idx + 1}</td>
                      )}
                      {template.showItemName !== false && (
                        <td className="py-1 pr-1 font-black align-top">
                          <span className="block leading-tight">{item.name}</span>
                          {template.showItemDescription !== false && (
                            <span className="block text-[8.5px] italic text-black">{item.desc}</span>
                          )}
                          <div className="flex flex-wrap gap-x-1.5 text-[8.5px] font-bold text-black mt-0.5">
                            {template.showItemSKU !== false && <span>SKU:{item.sku}</span>}
                            {template.showItemHSN !== false && <span>HSN:{item.hsn}</span>}
                            {template.showItemMrp !== false && <span>MRP:{currency.symbol}{item.mrp}</span>}
                            {template.showItemDiscount !== false && item.disc > 0 && <span>Disc:-{currency.symbol}{item.disc}</span>}
                            {template.showItemTax !== false && <span>Tax:{currency.symbol}{item.tax}</span>}
                          </div>
                        </td>
                      )}
                      {template.showItemQty !== false && (
                        <td className="py-1 text-center font-black align-top whitespace-nowrap">
                          {item.qty} {template.showItemUom !== false ? item.uom : ''}
                        </td>
                      )}
                      {template.showItemRate !== false && (
                        <td className="py-1 text-right font-black align-top whitespace-nowrap">
                          {item.rate.toFixed(2)}
                        </td>
                      )}
                      {template.showItemTotal !== false && (
                        <td className="py-1 text-right font-black align-top whitespace-nowrap">
                          {item.total.toFixed(2)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className={`border-t-2 ${dividerBorderClass} border-black pt-1 space-y-0.5 text-[11px] font-bold text-black`}>
                {template.showSubtotal !== false && (
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-black">{currency.symbol}564.96</span>
                  </div>
                )}
                {template.showTotalDiscount !== false && (
                  <div className="flex justify-between font-black text-black">
                    <span>Discount / Savings:</span>
                    <span>-{currency.symbol}35.00</span>
                  </div>
                )}
                {template.showTaxBreakdown !== false && (
                  <>
                    <div className="flex justify-between text-[10px] text-black font-bold">
                      <span>CGST (9%):</span>
                      <span>{currency.symbol}26.10</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-black font-bold">
                      <span>SGST (9%):</span>
                      <span>{currency.symbol}26.10</span>
                    </div>
                  </>
                )}
                {template.showRoundOff !== false && (
                  <div className="flex justify-between text-[10px] text-black font-bold">
                    <span>Round Off:</span>
                    <span>+{currency.symbol}0.04</span>
                  </div>
                )}
                {template.showGrandTotal !== false && (
                  <div className="flex justify-between font-black text-sm border-t-2 border-black pt-1 mt-1 text-black">
                    <span>TOTAL AMOUNT:</span>
                    <span>{currency.symbol}582.20</span>
                  </div>
                )}
              </div>

              {/* Payment Mode */}
              {template.showPaymentMode !== false && (
                <div className={`flex justify-between text-[10px] font-black mt-1.5 border-t ${dividerBorderClass} border-black pt-1 text-black`}>
                  <span>PAYMENT MODE:</span>
                  <span className="uppercase">CASH (PAID)</span>
                </div>
              )}

              {/* Loyalty Points */}
              {template.showLoyaltyPoints !== false && (
                <div className="bg-black text-white p-1 text-[9px] text-center my-1 font-black uppercase tracking-wider">
                  ★ Loyalty Points Earned: +58 Pts ★
                </div>
              )}

              {/* Savings Banner */}
              {template.showSavingsBanner !== false && (
                <div className={`text-center font-black text-[10px] border-2 ${dividerBorderClass} border-black py-0.5 my-1.5 uppercase text-black`}>
                  ★ YOU SAVED {currency.symbol}35.00 ON THIS ORDER ★
                </div>
              )}

              {/* Paid Stamp */}
              {template.showPaidInFullStamp !== false && (
                <div className="text-center font-black text-[10px] border-2 border-black py-1 my-1 uppercase text-black">
                  ★ [✓ PAID IN FULL] ★
                </div>
              )}

              {/* QR Code */}
              {template.showQrCode !== false && (
                <div className={`flex flex-col items-center my-1.5 pt-1 border-t ${dividerBorderClass} border-black text-center`}>
                  <QrCode className="w-16 h-16 text-black border-2 border-black p-0.5 my-0.5" strokeWidth={2} />
                  <span className="text-[9px] font-black uppercase text-black">Scan to Pay UPI: ₹582.20</span>
                </div>
              )}

              {/* Google Review QR */}
              {template.showGoogleReviewQR && (
                <div className={`flex flex-col items-center my-1.5 pt-1 border-t-2 ${dividerBorderClass} border-black text-center`}>
                  <span className="text-[9.5px] font-black text-black">★ ★ ★ ★ ★ RATE US ON GOOGLE</span>
                  <QrCode className="w-14 h-14 text-black border-2 border-black p-0.5 my-0.5" strokeWidth={2} />
                  <span className="text-[8px] font-bold text-black">Scan to Share Feedback!</span>
                </div>
              )}

              {/* Terms and Conditions Section */}
              {template.showTermsAndConditions !== false && template.termsAndConditionsText && (
                <div className={`text-[8.5px] font-bold border-t-2 ${dividerBorderClass} border-black pt-1 mt-1 text-black leading-tight`}>
                  <div className="font-black uppercase text-[9px] tracking-wider mb-0.5 text-center">TERMS & CONDITIONS</div>
                  <div className="whitespace-pre-line text-left pl-0.5">{template.termsAndConditionsText}</div>
                </div>
              )}

              {/* Statutory Declaration */}
              {template.showDeclaration !== false && template.declarationText && (
                <div className={`text-[8.5px] font-bold border-t ${dividerBorderClass} border-black pt-1 mt-1 text-center text-black leading-tight`}>
                  <span className="font-black">Declaration: </span>{template.declarationText}
                </div>
              )}

              {/* Footer Note */}
              {template.showFooterNote !== false && template.footerNote && (
                <div className={`text-center font-black text-[9.5px] mt-1.5 whitespace-pre-line border-t-2 ${dividerBorderClass} border-black pt-1 text-black uppercase tracking-wider`}>
                  {template.footerNote}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
