import React, { useState, useEffect } from "react";
import {
  X,
  Settings,
  Plus,
  Trash2,
  Check,
  Sparkles,
  FileText,
  Layers,
  CheckCircle2,
  Sliders,
  Palette,
  Tag,
  Eye,
  EyeOff,
  Hash,
  Calendar,
  DollarSign,
  Percent,
  ShieldCheck,
  Printer,
  HelpCircle,
  Package,
  Boxes,
  Truck,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { getTenantIdFromStorage, getCompanyIdFromStorage } from "@/lib/receipt-template-store";
import { procurementApi } from "@/lib/api-client";
import { WordInvoiceStudioModal } from "../pos/WordInvoiceStudioModal";

export interface ItemCustomColumn {
  id: string;
  name: string;
  enabled: boolean;
}

export interface InvoiceCustomField {
  id: string;
  name: string;
  enabled: boolean;
  value?: string;
}

export interface PurchaseInvoiceSettings {
  // Numbering / Prefixes
  customSequenceEnabled: boolean;
  prefix: string;
  sequenceNumber: number;
  suffix: string;
  padding: number;
  poPrefix: string;
  grnPrefix: string;

  // Document Fields
  showPoNumber: boolean;
  showGrnReference: boolean;
  showEwayBill: boolean;
  showVehicleNumber: boolean;
  showChallanNumber: boolean;
  showPaymentTerms: boolean;
  invoiceCustomFields: InvoiceCustomField[];

  // Item Table Columns
  showHsn: boolean;
  showUom: boolean;
  showBatchNo: boolean;
  showExpDate: boolean;
  showMfgDate: boolean;
  showMrp: boolean;
  showSellPrice: boolean;
  showRate: boolean;
  showDiscount: boolean;
  showGstTax: boolean;
  showFreeQty: boolean;
  itemCustomColumns: ItemCustomColumn[];

  // Terms & Notes
  defaultTerms: string;
  defaultPaymentTerms: string;
}

export const DEFAULT_PURCHASE_INVOICE_SETTINGS: PurchaseInvoiceSettings = {
  customSequenceEnabled: true,
  prefix: "BILL-",
  sequenceNumber: 1,
  suffix: "",
  padding: 4,
  poPrefix: "PO-",
  grnPrefix: "GRN-",

  showPoNumber: true,
  showGrnReference: true,
  showEwayBill: true,
  showVehicleNumber: true,
  showChallanNumber: true,
  showPaymentTerms: true,
  invoiceCustomFields: [],

  showHsn: true,
  showUom: true,
  showBatchNo: true,
  showExpDate: true,
  showMfgDate: false,
  showMrp: false,
  showSellPrice: false,
  showRate: true,
  showDiscount: true,
  showGstTax: true,
  showFreeQty: false,
  itemCustomColumns: [],

  defaultTerms: "1. All goods received are subject to physical verification & quality inspection.\n2. Invoice payments will be released as per agreed vendor credit terms.\n3. Discrepancies or damaged goods must be notified within 48 hours.",
  defaultPaymentTerms: "Net 30 Days",
};

export function getPurchaseInvoiceSettingsStorageKey(tenantId?: string, companyId?: string): string {
  const tid = tenantId || getTenantIdFromStorage();
  const cid = companyId || getCompanyIdFromStorage();
  if (tid && cid) return `pos_purchase_quick_settings_${tid}_${cid}`;
  if (tid) return `pos_purchase_quick_settings_${tid}`;
  return "pos_purchase_quick_settings";
}

export function loadStoredPurchaseInvoiceSettings(tenantId?: string, companyId?: string): PurchaseInvoiceSettings {
  try {
    const tid = tenantId || getTenantIdFromStorage();
    const cid = companyId || getCompanyIdFromStorage();
    const key = getPurchaseInvoiceSettingsStorageKey(tid, cid);
    let raw = localStorage.getItem(key);
    if (!raw && tid && cid) {
      raw = localStorage.getItem(`pos_purchase_quick_settings_${tid}`);
    }
    if (!raw && !tid) {
      raw = localStorage.getItem("pos_purchase_quick_settings");
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_PURCHASE_INVOICE_SETTINGS, ...parsed };
    }
  } catch (err) {
    console.warn("Failed to load purchase invoice settings:", err);
  }
  return DEFAULT_PURCHASE_INVOICE_SETTINGS;
}

export function saveStoredPurchaseInvoiceSettings(settings: PurchaseInvoiceSettings, tenantId?: string, companyId?: string) {
  try {
    const tid = tenantId || getTenantIdFromStorage();
    const cid = companyId || getCompanyIdFromStorage();
    const key = getPurchaseInvoiceSettingsStorageKey(tid, cid);
    localStorage.setItem(key, JSON.stringify(settings));
    if (tid && key !== `pos_purchase_quick_settings_${tid}`) {
      localStorage.setItem(`pos_purchase_quick_settings_${tid}`, JSON.stringify(settings));
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("bos-purchase-settings-updated", { detail: { settings, key, tenantId: tid, companyId: cid } }));
      window.dispatchEvent(new CustomEvent("bos-purchase-invoice-settings-changed", { detail: settings }));
    }
  } catch (err) {
    console.warn("Failed to save purchase invoice settings:", err);
  }
}

interface PurchaseInvoiceQuickSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (settings: PurchaseInvoiceSettings) => void;
}

export function PurchaseInvoiceQuickSettingsModal({
  isOpen,
  onClose,
  onSaved,
}: PurchaseInvoiceQuickSettingsModalProps) {
  const { currency } = useCurrency();
  const { tenant } = useTenant();
  const [activeTab, setActiveTab] = useState<"columns" | "design" | "numbering" | "terms">("columns");
  const [settings, setSettings] = useState<PurchaseInvoiceSettings>(() => loadStoredPurchaseInvoiceSettings());
  const [isWordStudioOpen, setIsWordStudioOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const tid = tenant?.id || getTenantIdFromStorage();
      const cid = getCompanyIdFromStorage();
      const local = loadStoredPurchaseInvoiceSettings(tid, cid);
      setSettings(local);

      // Revalidate from backend API for this active organization
      procurementApi.getPurchaseInvoiceSettings(cid)
        .then((serverData) => {
          if (serverData && typeof serverData === "object") {
            const merged = { ...DEFAULT_PURCHASE_INVOICE_SETTINGS, ...serverData };
            setSettings(merged);
            saveStoredPurchaseInvoiceSettings(merged, tid, cid);
          }
        })
        .catch((err) => {
          console.warn("Could not sync purchase invoice settings from API:", err);
        });
    }
  }, [isOpen, tenant?.id]);

  if (!isOpen) return null;

  const handleToggleColumn = (key: keyof PurchaseInvoiceSettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleAddCustomColumn = () => {
    const trimmed = newColumnName.trim();
    if (!trimmed) {
      toast.error("Please enter a column title");
      return;
    }
    const newCol: ItemCustomColumn = {
      id: `col_custom_${Date.now()}`,
      name: trimmed,
      enabled: true,
    };
    setSettings((prev) => ({
      ...prev,
      itemCustomColumns: [...(prev.itemCustomColumns || []), newCol],
    }));
    setNewColumnName("");
    toast.success(`Custom column "${trimmed}" added!`);
  };

  const handleToggleCustomColumn = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      itemCustomColumns: (prev.itemCustomColumns || []).map((c) =>
        c.id === id ? { ...c, enabled: !c.enabled } : c
      ),
    }));
  };

  const handleDeleteCustomColumn = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      itemCustomColumns: (prev.itemCustomColumns || []).filter((c) => c.id !== id),
    }));
    toast.info("Custom column removed");
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const tid = tenant?.id || getTenantIdFromStorage();
      const cid = getCompanyIdFromStorage();
      saveStoredPurchaseInvoiceSettings(settings, tid, cid);

      try {
        await procurementApi.updatePurchaseInvoiceSettings(settings, cid);
      } catch (apiErr) {
        console.warn("Could not persist purchase invoice settings to backend database:", apiErr);
      }

      if (onSaved) onSaved(settings);
      toast.success("Purchase invoice settings and columns saved successfully!");
      onClose();
    } catch (err) {
      console.error("Save settings failed:", err);
      toast.error("Failed to save purchase invoice settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    setSettings(DEFAULT_PURCHASE_INVOICE_SETTINGS);
    toast.info("Reset to standard purchase invoice settings");
  };

  // Count active columns
  const standardColsCount = [
    settings.showHsn,
    settings.showUom,
    settings.showBatchNo,
    settings.showExpDate,
    settings.showMfgDate,
    settings.showMrp,
    settings.showSellPrice,
    settings.showRate,
    settings.showDiscount,
    settings.showGstTax,
    settings.showFreeQty,
  ].filter(Boolean).length;
  const customColsCount = (settings.itemCustomColumns || []).filter((c) => c.enabled).length;
  const totalCols = 3 + standardColsCount + customColsCount; // #, Name, Amount + active

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <Settings className="size-6" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">Purchase Invoice & Bill Settings</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Customize line item columns, styling templates, numbering series, and terms.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 px-6 py-2 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("columns")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "columns"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            <Layers className="size-3.5" />
            <span>Item Columns ({totalCols})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("design")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "design"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            <Palette className="size-3.5" />
            <span>Design & Word Studio</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("numbering")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "numbering"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            <Hash className="size-3.5" />
            <span>Numbering & Fields</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("terms")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "terms"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            <FileText className="size-3.5" />
            <span>Terms & Conditions</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: COLUMNS */}
          {activeTab === "columns" && (
            <div className="space-y-6">
              {/* Info banner */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 flex items-start gap-3">
                <Sliders className="size-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed">
                  <p className="font-bold">Avoid Column Cutoffs on A4 Prints & Previews</p>
                  <p className="text-indigo-800/80 dark:text-indigo-300/80 mt-0.5">
                    Toggle off columns your business doesn't need (e.g. MRP or Sell Price for raw materials, or Exp Date for non-perishables). The invoice table will automatically rebalance so remaining columns fit comfortably without cutting off.
                  </p>
                </div>
              </div>

              {/* Standard Columns Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Standard Line Item Columns
                  </h4>
                  <span className="text-xs font-bold text-slate-600">
                    {standardColsCount} of 11 enabled
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: "showHsn", label: "HSN / SAC Code", desc: "Tax classification code", icon: Tag },
                    { key: "showUom", label: "UOM (Units)", desc: "e.g. Pcs, Box, Kg, Ltr", icon: Boxes },
                    { key: "showBatchNo", label: "Batch / Lot No.", desc: "Batch track number", icon: Hash },
                    { key: "showExpDate", label: "Expiry Date", desc: "Shelf life / expiry date", icon: Calendar },
                    { key: "showMfgDate", label: "Mfg Date", desc: "Date of manufacture", icon: Calendar },
                    { key: "showMrp", label: `MRP (${currency.symbol})`, desc: "Maximum retail price", icon: DollarSign },
                    { key: "showSellPrice", label: `Sell Price (${currency.symbol})`, desc: "Expected resale price", icon: DollarSign },
                    { key: "showRate", label: `Rate / Price (${currency.symbol})`, desc: "Purchase cost per unit", icon: DollarSign },
                    { key: "showDiscount", label: "Discount", desc: "Line trade discount", icon: Percent },
                    { key: "showGstTax", label: "GST Tax %", desc: "Tax rate breakdown", icon: ShieldCheck },
                    { key: "showFreeQty", label: "Free Quantity Badge", desc: "Mark promotional samples", icon: Package },
                  ].map((col) => {
                    const isEnabled = settings[col.key as keyof PurchaseInvoiceSettings] !== false;
                    const Icon = col.icon;
                    return (
                      <div
                        key={col.key}
                        onClick={() => handleToggleColumn(col.key as keyof PurchaseInvoiceSettings)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isEnabled
                            ? "bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-800/60 shadow-xs ring-1 ring-indigo-500/10"
                            : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isEnabled
                                ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400"
                                : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                            }`}
                          >
                            <Icon className="size-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{col.label}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{col.desc}</p>
                          </div>
                        </div>

                        <div
                          className={`w-11 h-6 rounded-full transition-colors flex items-center p-1 shrink-0 ${
                            isEnabled ? "bg-indigo-600 justify-end" : "bg-slate-300 dark:bg-slate-700 justify-start"
                          }`}
                        >
                          <div className="size-4 rounded-full bg-white shadow-xs" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom Item Columns */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Custom Columns (Add or Delete)
                  </h4>
                  <span className="text-xs text-slate-500 font-medium">
                    {(settings.itemCustomColumns || []).length} Custom Columns
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddCustomColumn()}
                    placeholder="Enter new column name (e.g. Brand, Rack No, Size, Grade)..."
                    className="flex-1 h-10 px-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomColumn}
                    className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Plus className="size-3.5" /> Add Column
                  </button>
                </div>

                {settings.itemCustomColumns && settings.itemCustomColumns.length > 0 ? (
                  <div className="space-y-2">
                    {settings.itemCustomColumns.map((col) => (
                      <div
                        key={col.id}
                        className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleToggleCustomColumn(col.id)}
                            className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                              col.enabled
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                            }`}
                          >
                            {col.enabled ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                          </button>
                          <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">{col.name}</span>
                            <span className="text-[10px] text-slate-500 ml-2 font-mono">
                              ({col.enabled ? "Visible on Invoice" : "Hidden"})
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteCustomColumn(col.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Custom Column"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No custom columns added yet.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: DESIGN & WORD STUDIO */}
          {activeTab === "design" && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-100 dark:border-indigo-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="size-4 text-indigo-600" />
                    <span>Visual Word & Template Studio</span>
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-lg leading-relaxed">
                    Open the drag-and-drop Word Template Studio to rearrange purchase invoice sections, change brand colors, adjust column width percentages, customize typography, or add watermark logos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWordStudioOpen(true)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 shrink-0 cursor-pointer"
                >
                  <Palette className="size-4" /> Open Word Studio
                </button>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Recommended Layout Themes for Purchase Invoices
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: "stylish", name: "Stylish Theme (A4)", desc: "Clean modern corporate layout with crisp colored headers & borders.", color: "#2563eb" },
                    { id: "word_studio", name: "Custom Word-Designed Layout", desc: "Fully customizable Word document layout with editable column widths.", color: "#0f172a" },
                    { id: "tally", name: "Advanced GST (Tally Format)", desc: "Traditional border-grid layout preferred by tax auditors and accountants.", color: "#1e293b" },
                    { id: "modern", name: "Modern Minimalist", desc: "Airy, high-legibility layout with slate accents for quick scanning.", color: "#475569" },
                  ].map((tpl) => (
                    <div
                      key={tpl.id}
                      className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:border-indigo-300 transition-all flex items-start gap-3"
                    >
                      <div
                        className="size-4 rounded-full mt-1 shrink-0"
                        style={{ backgroundColor: tpl.color }}
                      />
                      <div>
                        <h5 className="text-xs font-bold text-slate-900 dark:text-white">{tpl.name}</h5>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                          {tpl.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: NUMBERING & FIELDS */}
          {activeTab === "numbering" && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Purchase Invoice / Bill Numbering Series
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Prefix</label>
                    <input
                      type="text"
                      value={settings.prefix}
                      onChange={(e) => setSettings({ ...settings, prefix: e.target.value.toUpperCase() })}
                      placeholder="BILL-"
                      className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Next Number</label>
                    <input
                      type="number"
                      min="1"
                      value={settings.sequenceNumber}
                      onChange={(e) => setSettings({ ...settings, sequenceNumber: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Digits Padding</label>
                    <select
                      value={settings.padding}
                      onChange={(e) => setSettings({ ...settings, padding: parseInt(e.target.value) || 4 })}
                      className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value={3}>3 digits (e.g. 001)</option>
                      <option value={4}>4 digits (e.g. 0001)</option>
                      <option value={5}>5 digits (e.g. 00001)</option>
                      <option value={6}>6 digits (e.g. 000001)</option>
                    </select>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                  <span className="text-slate-500">Preview next generated Bill Number: </span>
                  <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">
                    {settings.prefix}
                    {String(settings.sequenceNumber).padStart(settings.padding, "0")}
                    {settings.suffix}
                  </span>
                </div>
              </div>

              {/* Linked References & Transport Toggles */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Header & Transport Field Visibility
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: "showPoNumber", label: "Show PO Reference Number" },
                    { key: "showGrnReference", label: "Show GRN Reference Number" },
                    { key: "showEwayBill", label: "Show e-Way Bill Details" },
                    { key: "showVehicleNumber", label: "Show Vehicle Number" },
                    { key: "showChallanNumber", label: "Show Delivery Challan No." },
                    { key: "showPaymentTerms", label: "Show Payment Credit Terms" },
                  ].map((field) => {
                    const isChecked = settings[field.key as keyof PurchaseInvoiceSettings] !== false;
                    return (
                      <label
                        key={field.key}
                        className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between cursor-pointer"
                      >
                        <span className="text-xs font-medium text-slate-800 dark:text-slate-200">{field.label}</span>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleColumn(field.key as keyof PurchaseInvoiceSettings)}
                          className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TERMS & CONDITIONS */}
          {activeTab === "terms" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Default Purchase Terms & Quality Inspection Policy
                </label>
                <textarea
                  rows={5}
                  value={settings.defaultTerms}
                  onChange={(e) => setSettings({ ...settings, defaultTerms: e.target.value })}
                  placeholder="Enter purchase terms and conditions..."
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-normal leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Standard Vendor Credit Terms
                </label>
                <input
                  type="text"
                  value={settings.defaultPaymentTerms}
                  onChange={(e) => setSettings({ ...settings, defaultPaymentTerms: e.target.value })}
                  placeholder="e.g. Net 30 Days / 50% Advance, 50% on Delivery"
                  className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="text-xs text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="size-3.5" /> Reset Defaults
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              <span>{isSaving ? "Saving..." : "Save Settings"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Visual Word Invoice Studio Modal */}
      {isWordStudioOpen && (
        <WordInvoiceStudioModal
          isOpen={isWordStudioOpen}
          onClose={() => setIsWordStudioOpen(false)}
          docMode="purchase"
          onSaved={() => {
            setIsWordStudioOpen(false);
            toast.success("Purchase template customized in Word Studio!");
          }}
        />
      )}
    </div>
  );
}
