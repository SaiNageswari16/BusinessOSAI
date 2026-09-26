import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  FileText,
  X,
  Check,
  MoveUp,
  MoveDown,
  Plus,
  Trash2,
  Upload,
  Eye,
  Settings,
  Sparkles,
  Layers,
  Palette,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ShieldCheck,
  QrCode,
  Landmark,
  Building,
  RotateCcw,
  Sliders,
  CheckCircle2,
  Copy,
  PenTool,
  Edit3,
  Stamp,
  UserCheck,
  ArrowRight,
  ArrowLeft,
  PlusCircle,
  HelpCircle,
  Maximize2,
} from "lucide-react";
import { toast } from "sonner";
import { generateQRCodeSVG, buildUpiPayUrl } from "@/lib/qr-generator";
import {
  getActiveBillingGst,
  setActiveBillingGst,
  getOrgSignatureSettings,
  setOrgSignatureSettings,
  getOrgPaymentQrSettings,
  getTenantTemplatesKey,
  getTenantDefaultsKey,
  getTenantIdFromStorage,
  type ActiveGstDetails,
} from "@/lib/receipt-template-store";

export interface WordStudioColumnConfig {
  id: string;
  fieldKey: string;
  headerTitle: string;
  widthPercent: number;
  align: "left" | "center" | "right";
  enabled: boolean;
  isCustom?: boolean;
}

export interface WordStudioCustomField {
  id: string;
  label: string;
  value: string;
  enabled: boolean;
  section: "meta" | "header" | "party" | "footer";
}

export interface WordStudioSectionConfig {
  id: string;
  title: string;
  enabled: boolean;
  order: number;
}

export interface WordInvoiceTemplateConfig {
  id: string;
  name: string;
  category: "invoices";
  isDefault: boolean;
  fontFamily: string;
  fontSizePt: number;
  primaryColor: string;
  headerStyle: "modern_banner" | "classic_split" | "minimal" | "centered_letterhead";
  tableBorderStyle: "subtle" | "strong" | "double" | "minimal";
  paperBgColor: string;
  watermarkText: string;
  watermarkOpacity: number;
  invoiceTitle: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyGstin: string;
  companyPan: string;
  customerTitle: string;
  customerName: string;
  customerAddress: string;
  customerGstin: string;
  customerPhone: string;
  shippingTitle: string;
  shippingName: string;
  shippingAddress: string;
  invoiceNumberLabel: string;
  invoiceNumberValue: string;
  invoiceDateLabel: string;
  invoiceDateValue: string;
  dueDateLabel: string;
  dueDateValue: string;
  placeOfSupplyLabel: string;
  placeOfSupplyValue: string;
  sections: WordStudioSectionConfig[];
  columns: WordStudioColumnConfig[];
  customFields: WordStudioCustomField[];
  signatureConfig: {
    signatureUrl?: string | null;
    stampUrl?: string | null;
    title: string;
    companyName: string;
    showSignature: boolean;
    showStamp: boolean;
    alignment: "left" | "center" | "right";
  };
  termsText: string;
  footerNote: string;
  showBankDetails: boolean;
  showPaymentQr: boolean;
  showTaxBreakdown: boolean;
  showAmountInWords: boolean;
  createdAt: string;
}

export const DEFAULT_WORD_COLUMNS: WordStudioColumnConfig[] = [
  { id: "col_sno", fieldKey: "sno", headerTitle: "S.No", widthPercent: 6, align: "center", enabled: true },
  { id: "col_desc", fieldKey: "description", headerTitle: "Item Description & Notes", widthPercent: 34, align: "left", enabled: true },
  { id: "col_hsn", fieldKey: "hsn", headerTitle: "HSN / SAC", widthPercent: 12, align: "center", enabled: true },
  { id: "col_qty", fieldKey: "quantity", headerTitle: "Qty", widthPercent: 8, align: "center", enabled: true },
  { id: "col_rate", fieldKey: "unit_price", headerTitle: "Unit Price (₹)", widthPercent: 12, align: "right", enabled: true },
  { id: "col_disc", fieldKey: "discount", headerTitle: "Disc %", widthPercent: 8, align: "center", enabled: true },
  { id: "col_tax", fieldKey: "tax_rate", headerTitle: "GST %", widthPercent: 8, align: "center", enabled: true },
  { id: "col_amt", fieldKey: "total_amount", headerTitle: "Amount (₹)", widthPercent: 12, align: "right", enabled: true },
];

export const DEFAULT_WORD_SECTIONS: WordStudioSectionConfig[] = [
  { id: "company_header", title: "1. Organization Header & Logo", enabled: true, order: 1 },
  { id: "invoice_meta", title: "2. Invoice Meta & Custom References", enabled: true, order: 2 },
  { id: "party_details", title: "3. Bill To & Ship To Details", enabled: true, order: 3 },
  { id: "items_table", title: "4. Dynamic Items Table Grid", enabled: true, order: 4 },
  { id: "tax_slabs", title: "5. GST Slabs Breakdown Matrix", enabled: true, order: 5 },
  { id: "totals_block", title: "6. Summary Totals & Amount in Words", enabled: true, order: 6 },
  { id: "bank_qr_block", title: "7. UPI Payment QR & Bank Account", enabled: true, order: 7 },
  { id: "terms_block", title: "8. Terms & Declarations", enabled: true, order: 8 },
  { id: "signature_block", title: "9. Authorized Signature & Stamp", enabled: true, order: 9 },
];

export const PRESET_FIELD_SUGGESTIONS = [
  { label: "PO Number", value: "PO-2026-9921" },
  { label: "PO Date", value: "24-Sep-2026" },
  { label: "Vehicle No", value: "TS 09 EA 4412" },
  { label: "E-Way Bill No", value: "241098234190" },
  { label: "Challan No", value: "DC-0045" },
  { label: "Challan Date", value: "25-Sep-2026" },
  { label: "Dispatch Through", value: "VRL Logistics / SafeX" },
  { label: "LR / GR Number", value: "LR-789012" },
  { label: "Driver Name & Phone", value: "Ramesh (+91 98765 00000)" },
  { label: "Sales Executive", value: "Rahul Sharma" },
  { label: "Payment Terms", value: "Net 15 Days" },
  { label: "Terms of Delivery", value: "Door Delivery Freight Paid" },
  { label: "Reverse Charge (Y/N)", value: "No" },
  { label: "LUT / Bond ARN", value: "AD360124000123P" },
  { label: "Destination", value: "Hyderabad Hub" },
];

interface WordInvoiceStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (templateConfig: WordInvoiceTemplateConfig) => void;
  initialTemplate?: any;
}

export function WordInvoiceStudioModal({
  isOpen,
  onClose,
  onSaved,
  initialTemplate,
}: WordInvoiceStudioModalProps) {
  const [activeTab, setActiveTab] = useState<"visual_canvas" | "layout_ribbon" | "columns" | "custom_fields" | "signature_stamp" | "typography">("visual_canvas");
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [quickAddSection, setQuickAddSection] = useState<"meta" | "party" | "footer">("meta");

  const tenantId = getTenantIdFromStorage();
  const activeGst = getActiveBillingGst(tenantId);
  const activeSig = getOrgSignatureSettings(tenantId);
  const activeQr = getOrgPaymentQrSettings(tenantId);

  // Template Master Config State
  const [config, setConfig] = useState<WordInvoiceTemplateConfig>(() => {
    return {
      id: initialTemplate?.id || `tpl-word-${Date.now()}`,
      name: initialTemplate?.name || "Custom Word-Designed Invoice",
      category: "invoices",
      isDefault: initialTemplate?.isDefault ?? true,
      fontFamily: initialTemplate?.fontFamily || "Inter, sans-serif",
      fontSizePt: initialTemplate?.fontSizePt || 9.5,
      primaryColor: initialTemplate?.primaryColor || "#2563eb",
      headerStyle: initialTemplate?.headerStyle || "modern_banner",
      tableBorderStyle: initialTemplate?.tableBorderStyle || "subtle",
      paperBgColor: initialTemplate?.paperBgColor || "#ffffff",
      watermarkText: initialTemplate?.watermarkText || "",
      watermarkOpacity: initialTemplate?.watermarkOpacity || 0.08,
      invoiceTitle: initialTemplate?.headerTitle || initialTemplate?.invoiceTitle || "TAX INVOICE",
      companyName: initialTemplate?.companyName || activeGst?.trade_name || activeGst?.legal_name || "ACME ENTERPRISES PVT LTD",
      companyAddress: initialTemplate?.companyAddress || activeGst?.address || "123 Commercial Hub, Main Road, Hyderabad, Telangana - 500034",
      companyPhone: initialTemplate?.companyPhone || activeGst?.phone || "+91 98765 43210",
      companyEmail: initialTemplate?.companyEmail || activeGst?.email || "billing@acme.com",
      companyGstin: initialTemplate?.companyGstin || activeGst?.gstin || "36AAACA1234A1Z5",
      companyPan: initialTemplate?.companyPan || activeGst?.pan || "AAACA1234A",
      customerTitle: initialTemplate?.customerTitle || "Billed To (Customer):",
      customerName: initialTemplate?.customerName || "Sri Sai Supermarket & Retailers",
      customerAddress: initialTemplate?.customerAddress || "Door No 4/12, Market Road, Hyderabad, Telangana - 500001",
      customerGstin: initialTemplate?.customerGstin || "36BBBPB4321B1Z2",
      customerPhone: initialTemplate?.customerPhone || "+91 91234 56789",
      shippingTitle: initialTemplate?.shippingTitle || "Shipped To (Delivery):",
      shippingName: initialTemplate?.shippingName || "Warehouse Hub #2",
      shippingAddress: initialTemplate?.shippingAddress || "Plot 88, Phase 2, Logistics Park, Hyderabad, Telangana - 500034",
      invoiceNumberLabel: initialTemplate?.invoiceNumberLabel || "Invoice No",
      invoiceNumberValue: initialTemplate?.invoiceNumberValue || "INV-2026-0089",
      invoiceDateLabel: initialTemplate?.invoiceDateLabel || "Invoice Date",
      invoiceDateValue: initialTemplate?.invoiceDateValue || "25-Sep-2026",
      dueDateLabel: initialTemplate?.dueDateLabel || "Due Date",
      dueDateValue: initialTemplate?.dueDateValue || "02-Oct-2026",
      placeOfSupplyLabel: initialTemplate?.placeOfSupplyLabel || "Place of Supply",
      placeOfSupplyValue: initialTemplate?.placeOfSupplyValue || "36 - Telangana",
      sections: initialTemplate?.sections && Array.isArray(initialTemplate.sections) ? initialTemplate.sections : DEFAULT_WORD_SECTIONS,
      columns: initialTemplate?.columns && Array.isArray(initialTemplate.columns) ? initialTemplate.columns : DEFAULT_WORD_COLUMNS,
      customFields: initialTemplate?.customFields && Array.isArray(initialTemplate.customFields) ? initialTemplate.customFields : [
        { id: "cf_po", label: "PO Reference", value: "PO-2026-9921", enabled: true, section: "meta" },
        { id: "cf_veh", label: "Vehicle Number", value: "TS 09 EA 4412", enabled: true, section: "meta" },
        { id: "cf_eway", label: "E-Way Bill No", value: "241098234190", enabled: true, section: "meta" },
      ],
      signatureConfig: {
        signatureUrl: initialTemplate?.signatureConfig?.signatureUrl !== undefined ? initialTemplate?.signatureConfig?.signatureUrl : (activeSig.signatureUrl || null),
        stampUrl: initialTemplate?.signatureConfig?.stampUrl !== undefined ? initialTemplate?.signatureConfig?.stampUrl : (activeSig.stampUrl || null),
        title: initialTemplate?.signatureConfig?.title || activeSig.signatureTitle || "Authorized Signatory",
        companyName: initialTemplate?.signatureConfig?.companyName || activeSig.signatureCompanyName || `For ${activeGst?.trade_name || 'Organization'}`,
        showSignature: initialTemplate?.signatureConfig?.showSignature ?? activeSig.showDigitalSignature ?? true,
        showStamp: initialTemplate?.signatureConfig?.showStamp ?? activeSig.showDigitalStamp ?? true,
        alignment: initialTemplate?.signatureConfig?.alignment || activeSig.signatureAlignment || "right",
      },
      termsText: initialTemplate?.termsText || activeGst?.terms_and_conditions || "1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged for delayed payments.\n3. All disputes subject to local jurisdiction.",
      footerNote: initialTemplate?.footerText || "THANK YOU FOR YOUR BUSINESS! VISIT AGAIN.",
      showBankDetails: initialTemplate?.showBankDetails ?? true,
      showPaymentQr: initialTemplate?.showPaymentQr ?? true,
      showTaxBreakdown: initialTemplate?.showTaxBreakdown ?? true,
      showAmountInWords: initialTemplate?.showAmountInWords ?? true,
      createdAt: initialTemplate?.createdAt || new Date().toISOString(),
    };
  });

  const sigFileInputRef = useRef<HTMLInputElement>(null);
  const stampFileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  // Reorder Sections
  const handleMoveSection = (index: number, direction: "up" | "down") => {
    const newSections = [...config.sections];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSections.length) return;

    const temp = newSections[index];
    newSections[index] = newSections[targetIndex];
    newSections[targetIndex] = temp;

    newSections.forEach((s, idx) => {
      s.order = idx + 1;
    });

    setConfig({ ...config, sections: newSections });
  };

  const handleToggleSection = (id: string) => {
    setConfig({
      ...config,
      sections: config.sections.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    });
  };

  // Columns Operations
  const handleMoveColumn = (index: number, direction: "left" | "right") => {
    const newCols = [...config.columns];
    const targetIndex = direction === "left" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newCols.length) return;

    const temp = newCols[index];
    newCols[index] = newCols[targetIndex];
    newCols[targetIndex] = temp;

    setConfig({ ...config, columns: newCols });
  };

  const handleToggleColumn = (id: string) => {
    setConfig({
      ...config,
      columns: config.columns.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)),
    });
  };

  const handleUpdateColumnHeader = (id: string, newTitle: string) => {
    setConfig({
      ...config,
      columns: config.columns.map((c) => (c.id === id ? { ...c, headerTitle: newTitle } : c)),
    });
  };

  const handleAddCustomColumn = (defaultName = "Custom Header") => {
    const colId = `custom_col_${Date.now()}`;
    const newCol: WordStudioColumnConfig = {
      id: colId,
      fieldKey: colId,
      headerTitle: defaultName,
      widthPercent: 10,
      align: "left",
      enabled: true,
      isCustom: true,
    };
    setConfig({ ...config, columns: [...config.columns, newCol] });
    toast.success("Added new custom table column!");
  };

  const handleDeleteColumn = (id: string) => {
    setConfig({
      ...config,
      columns: config.columns.filter((c) => c.id !== id),
    });
    toast.info("Column removed from invoice layout");
  };

  // Custom Fields Operations
  const handleAddCustomField = (section: "meta" | "header" | "party" | "footer" = "meta", label = "New Field", value = "Custom Value") => {
    const fieldId = `field_${Date.now()}`;
    const newField: WordStudioCustomField = {
      id: fieldId,
      label: label,
      value: value,
      enabled: true,
      section: section,
    };
    setConfig({ ...config, customFields: [...config.customFields, newField] });
    setSelectedElementId(fieldId);
    toast.success(`Added "${label}" field to invoice!`);
  };

  const handleUpdateCustomField = (id: string, patch: Partial<WordStudioCustomField>) => {
    setConfig({
      ...config,
      customFields: config.customFields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    });
  };

  const handleDeleteCustomField = (id: string) => {
    setConfig({
      ...config,
      customFields: config.customFields.filter((f) => f.id !== id),
    });
    if (selectedElementId === id) setSelectedElementId(null);
    toast.info("Field removed");
  };

  // Upload Signatures & Stamps
  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setConfig({
        ...config,
        signatureConfig: {
          ...config.signatureConfig,
          signatureUrl: url,
          showSignature: true,
        },
      });
      setOrgSignatureSettings({ signature_url: url, show_digital_signature: true }, tenantId);
      toast.success("Authorized signature uploaded!");
    };
    reader.readAsDataURL(file);
  };

  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setConfig({
        ...config,
        signatureConfig: {
          ...config.signatureConfig,
          stampUrl: url,
          showStamp: true,
        },
      });
      setOrgSignatureSettings({ stamp_url: url, show_digital_stamp: true }, tenantId);
      toast.success("Company stamp / seal uploaded!");
    };
    reader.readAsDataURL(file);
  };

  // Save Master Template
  const handleSave = () => {
    try {
      const storageKey = getTenantTemplatesKey(tenantId);
      const rawTemplates = localStorage.getItem(storageKey);
      const existingList = rawTemplates ? JSON.parse(rawTemplates) : [];

      const transformedTemplate = {
        id: config.id,
        name: config.name,
        category: "invoices",
        paperSize: "a4",
        isDefault: config.isDefault,
        wordConfig: config,
        header: {
          title: config.invoiceTitle,
          subtitle: "ORIGINAL FOR RECIPIENT",
          showLogo: true,
          companyName: config.companyName,
          companyAddress: config.companyAddress,
          phone: config.companyPhone,
          email: config.companyEmail,
          gstin: config.companyGstin,
          pan: config.companyPan,
          showGstin: true,
          showPan: true,
          showPhone: true,
          showEmail: true,
        },
        body: {
          columns: config.columns.filter((c) => c.enabled).map((c) => ({
            key: c.fieldKey,
            label: c.headerTitle,
            width: `${c.widthPercent}%`,
            align: c.align,
            visible: true,
          })),
          tableStyle: config.tableBorderStyle,
        },
        footer: {
          termsAndConditions: config.termsText,
          notes: config.footerNote,
          showSignature: config.signatureConfig.showSignature,
          showStamp: config.signatureConfig.showStamp,
          signatureUrl: config.signatureConfig.signatureUrl,
          stampUrl: config.signatureConfig.stampUrl,
          signatoryTitle: config.signatureConfig.title,
          signatoryCompany: config.signatureConfig.companyName,
          signatureAlignment: config.signatureConfig.alignment,
          showBankDetails: config.showBankDetails,
          showQrCode: config.showPaymentQr,
        },
        metadata: {
          customFields: config.customFields,
          showDate: true,
          showInvoiceNumber: true,
          showDueDate: true,
          showTime: true,
        },
      };

      const updatedList = existingList.some((t: any) => t.id === transformedTemplate.id)
        ? existingList.map((t: any) => (t.id === transformedTemplate.id ? transformedTemplate : t))
        : [transformedTemplate, ...existingList];

      localStorage.setItem(storageKey, JSON.stringify(updatedList));
      localStorage.setItem("businessos_print_templates_v1", JSON.stringify(updatedList));

      if (config.isDefault) {
        const defaultsKey = getTenantDefaultsKey(tenantId);
        const rawDefaults = localStorage.getItem(defaultsKey);
        const nextDefaults = rawDefaults ? JSON.parse(rawDefaults) : {};
        nextDefaults.invoices = transformedTemplate.id;
        localStorage.setItem(defaultsKey, JSON.stringify(nextDefaults));
        localStorage.setItem("user_active_print_templates_v1", JSON.stringify(nextDefaults));
      }

      // Sync signature settings to org store
      setOrgSignatureSettings(
        {
          signature_url: config.signatureConfig.signatureUrl || null,
          stamp_url: config.signatureConfig.stampUrl || null,
          signature_title: config.signatureConfig.title,
          signature_company_name: config.signatureConfig.companyName,
          show_digital_signature: config.signatureConfig.showSignature,
          show_digital_stamp: config.signatureConfig.showStamp,
          signature_alignment: config.signatureConfig.alignment,
        },
        tenantId
      );

      window.dispatchEvent(new Event("print_templates_updated"));
      window.dispatchEvent(new CustomEvent("bos-invoice-settings-changed", { detail: config }));
      
      toast.success(`Word-Style Invoice Template "${config.name}" saved & applied!`);
      if (onSaved) onSaved(config);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save template.");
    }
  };

  // Sample Live Preview Data
  const sampleItems = [
    {
      sno: 1,
      description: "Basmati Rice Royal Premium (Aged 2 Years)",
      custom_note: "Export Quality Double Polished Grain (Batch #B-9021)",
      hsn: "10063020",
      quantity: 5,
      unit_price: 2450.0,
      discount: 5.0,
      tax_rate: 5,
      total_amount: 12250.0,
    },
    {
      sno: 2,
      description: "Organic Cold Pressed Mustard Oil (15L Tin)",
      custom_note: "Kachi Ghani single cold press pure mustard oil",
      hsn: "15149100",
      quantity: 2,
      unit_price: 2150.0,
      discount: 0,
      tax_rate: 5,
      total_amount: 4300.0,
    },
    {
      sno: 3,
      description: "Whole Spices Combo Pack (Export Grade)",
      custom_note: "Cardamom 100g, Clove 100g, Cinnamon 200g",
      hsn: "09083100",
      quantity: 10,
      unit_price: 680.0,
      discount: 2.5,
      tax_rate: 12,
      total_amount: 6630.0,
    },
  ];

  const subtotal = 23180.0;
  const taxAmount = 1432.5;
  const grandTotal = 24612.5;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-200 font-sans">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-[98vw] h-[96vh] overflow-hidden flex flex-col">
        
        {/* TOP WORD-STYLE RIBBON HEADER */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-6 py-3 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
                  Visual Word-Style Invoice Designer Studio
                </h1>
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/30 text-emerald-200 px-2.5 py-0.5 rounded-full border border-emerald-400/30 flex items-center gap-1">
                  <Sparkles className="size-3 text-emerald-300" /> Click Any Text to Edit Directly
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Complete Microsoft Word freedom: Click on ANY field in the preview to rename, replace, or delete. Add unlimited custom fields.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setConfig((prev) => ({
                  ...prev,
                  fontFamily: "Inter, sans-serif",
                  primaryColor: "#2563eb",
                  headerStyle: "modern_banner",
                  tableBorderStyle: "subtle",
                  columns: DEFAULT_WORD_COLUMNS,
                  sections: DEFAULT_WORD_SECTIONS,
                }));
                toast.info("Reset to standard invoice format");
              }}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="size-3.5" />
              Reset
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* WORD FORMATTING TOOLBAR RIBBON */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-2.5 flex items-center gap-4 shrink-0 overflow-x-auto text-xs">
          
          {/* Template Name Input */}
          <div className="flex items-center gap-2 border-r border-slate-300 pr-4">
            <span className="font-bold text-slate-600 uppercase text-[10px] tracking-wider">Template:</span>
            <input
              type="text"
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 font-bold text-slate-800 text-xs w-44 shadow-2xs focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Font Family Selector */}
          <div className="flex items-center gap-2 border-r border-slate-300 pr-4">
            <Type className="w-3.5 h-3.5 text-indigo-600" />
            <select
              value={config.fontFamily}
              onChange={(e) => setConfig({ ...config, fontFamily: e.target.value })}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 font-semibold text-slate-700 text-xs cursor-pointer"
            >
              <option value="Inter, sans-serif">Inter (Modern Clean)</option>
              <option value="'Roboto', sans-serif">Roboto (Standard ERP)</option>
              <option value="'Outfit', sans-serif">Outfit (Premium Royal)</option>
              <option value="'Playfair Display', serif">Playfair (Classic Serif)</option>
              <option value="'Courier New', monospace">Courier New (Typewriter)</option>
              <option value="Arial, sans-serif">Arial (Traditional)</option>
            </select>
          </div>

          {/* Font Size Selector */}
          <div className="flex items-center gap-2 border-r border-slate-300 pr-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Size:</span>
            <select
              value={config.fontSizePt}
              onChange={(e) => setConfig({ ...config, fontSizePt: parseFloat(e.target.value) })}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 font-semibold text-slate-700 text-xs cursor-pointer"
            >
              <option value={8.5}>8.5 pt (Compact)</option>
              <option value={9.5}>9.5 pt (Standard)</option>
              <option value={10.5}>10.5 pt (Large)</option>
              <option value={11.5}>11.5 pt (Bold & Clear)</option>
            </select>
          </div>

          {/* Primary Accent Color */}
          <div className="flex items-center gap-2 border-r border-slate-300 pr-4">
            <Palette className="w-3.5 h-3.5 text-indigo-600" />
            <input
              type="color"
              value={config.primaryColor}
              onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
              className="w-7 h-7 rounded-lg border border-slate-300 cursor-pointer p-0.5 bg-white"
            />
            <div className="flex items-center gap-1">
              {["#2563eb", "#0d9488", "#16a34a", "#b45309", "#7c3aed", "#0f172a"].map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setConfig({ ...config, primaryColor: color })}
                  className="w-4 h-4 rounded-full border border-slate-300 transition-transform hover:scale-125 cursor-pointer"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Header Banner Style */}
          <div className="flex items-center gap-2 border-r border-slate-300 pr-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Header:</span>
            <select
              value={config.headerStyle}
              onChange={(e) => setConfig({ ...config, headerStyle: e.target.value as any })}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 font-semibold text-slate-700 text-xs cursor-pointer"
            >
              <option value="modern_banner">Modern Color Banner</option>
              <option value="classic_split">Classic 2-Column Split</option>
              <option value="minimal">Minimal Clean Line</option>
              <option value="centered_letterhead">Centered Letterhead</option>
            </select>
          </div>

          {/* Table Border Style */}
          <div className="flex items-center gap-2 border-r border-slate-300 pr-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Grid:</span>
            <select
              value={config.tableBorderStyle}
              onChange={(e) => setConfig({ ...config, tableBorderStyle: e.target.value as any })}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 font-semibold text-slate-700 text-xs cursor-pointer"
            >
              <option value="subtle">Subtle Grey Borders</option>
              <option value="strong">High-Contrast Solid Grid</option>
              <option value="double">Double Luxury Borders</option>
              <option value="minimal">Minimal Open Rows</option>
            </select>
          </div>

          {/* Quick Insert Buttons */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => handleAddCustomField("meta", "Custom Field", "Sample Value")}
              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer transition-all"
            >
              <Plus className="size-3.5" />
              + Field
            </button>
            <button
              type="button"
              onClick={() => handleAddCustomColumn()}
              className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer transition-all"
            >
              <Plus className="size-3.5" />
              + Table Column
            </button>
          </div>
        </div>

        {/* WORKSPACE BODY: LEFT TOOLBOX + RIGHT INTERACTIVE CANVAS */}
        <div className="flex flex-1 min-h-0 overflow-hidden bg-slate-100/70">
          
          {/* LEFT SIDEBAR TOOLBOX */}
          <div className="w-80 bg-white border-r border-slate-200 p-4 space-y-4 shrink-0 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-4">
              
              {/* Tabs Switcher */}
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab("visual_canvas")}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    activeTab === "visual_canvas" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Eye className="size-3.5" />
                  Live Edit
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("columns")}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    activeTab === "columns" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Layers className="size-3.5" />
                  Columns
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("signature_stamp")}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    activeTab === "signature_stamp" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <PenTool className="size-3.5" />
                  Signature
                </button>
              </div>

              {/* TAB 1: VISUAL CANVAS QUICK TOOLBOX */}
              {activeTab === "visual_canvas" && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-2">
                    <h3 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                      <Sparkles className="size-4 text-indigo-600" />
                      Interactive Direct Word Editor
                    </h3>
                    <p className="text-[11px] text-indigo-700 leading-relaxed">
                      Click directly on any text or field inside the preview on the right to edit it in real-time.
                    </p>
                  </div>

                  {/* Add Pre-built or Custom Field Dropdown */}
                  <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      ⚡ Quick Add Common Invoice Field
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                      {PRESET_FIELD_SUGGESTIONS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => handleAddCustomField("meta", preset.label, preset.value)}
                          className="px-2 py-1.5 text-left bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg text-[10.5px] font-semibold text-slate-700 hover:text-indigo-700 truncate transition-colors cursor-pointer flex items-center justify-between"
                        >
                          <span className="truncate">{preset.label}</span>
                          <Plus className="size-3 text-slate-400 shrink-0 ml-1" />
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddCustomField("meta", "Custom Field", "Sample Value")}
                      className="w-full mt-2 py-2 border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 rounded-xl text-xs font-bold text-indigo-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="size-3.5" />
                      + Add Freeform Custom Field
                    </button>
                  </div>

                  {/* Section Order & Toggles */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Invoice Sections Order
                    </span>
                    <div className="space-y-1.5">
                      {config.sections.map((sec, idx) => (
                        <div
                          key={sec.id}
                          className={`p-2 rounded-lg border flex items-center justify-between transition-all ${
                            sec.enabled ? "bg-white border-slate-200" : "bg-slate-50 border-slate-100 opacity-60"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={sec.enabled}
                              onChange={() => handleToggleSection(sec.id)}
                              className="w-3.5 h-3.5 rounded text-indigo-600 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-slate-700">{sec.title}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveSection(idx, "up")}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                            >
                              <MoveUp className="size-3" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === config.sections.length - 1}
                              onClick={() => handleMoveSection(idx, "down")}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                            >
                              <MoveDown className="size-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: COLUMNS DESIGNER */}
              {activeTab === "columns" && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Table Columns</span>
                    <button
                      type="button"
                      onClick={() => handleAddCustomColumn()}
                      className="px-2 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="size-3.5" /> Add Column
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                    {config.columns.map((col, idx) => (
                      <div key={col.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={col.enabled}
                              onChange={() => handleToggleColumn(col.id)}
                              className="w-3.5 h-3.5 rounded text-indigo-600"
                            />
                            <span className="text-xs font-bold text-slate-800">{col.headerTitle}</span>
                          </label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveColumn(idx, "left")}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                              title="Move Left"
                            >
                              <ArrowLeft className="size-3" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === config.columns.length - 1}
                              onClick={() => handleMoveColumn(idx, "right")}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                              title="Move Right"
                            >
                              <ArrowRight className="size-3" />
                            </button>
                            {col.isCustom && (
                              <button
                                type="button"
                                onClick={() => handleDeleteColumn(col.id)}
                                className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Header Title</span>
                            <input
                              type="text"
                              value={col.headerTitle}
                              onChange={(e) => handleUpdateColumnHeader(col.id, e.target.value)}
                              className="w-full h-7 bg-white border border-slate-200 rounded-lg px-2 text-xs font-bold text-slate-800 outline-none"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Align</span>
                            <select
                              value={col.align}
                              onChange={(e) => {
                                const newCols = config.columns.map((c) => (c.id === col.id ? { ...c, align: e.target.value as any } : c));
                                setConfig({ ...config, columns: newCols });
                              }}
                              className="w-full h-7 bg-white border border-slate-200 rounded-lg px-1.5 text-xs text-slate-700 outline-none cursor-pointer"
                            >
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: SIGNATURE & RUBBER STAMP */}
              {activeTab === "signature_stamp" && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <h3 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <ShieldCheck className="size-4 text-emerald-600" />
                      Signatory & Company Seal
                    </h3>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      Upload your official seal and signature. They will be embedded into all printed invoices.
                    </p>
                  </div>

                  {/* Signature Upload */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">Authorized Signature</span>
                      <label className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.signatureConfig.showSignature}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              signatureConfig: { ...config.signatureConfig, showSignature: e.target.checked },
                            })
                          }
                          className="w-3.5 h-3.5 rounded text-indigo-600"
                        />
                        Show
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      {config.signatureConfig.signatureUrl ? (
                        <div className="w-20 h-12 bg-white border border-slate-200 rounded-lg p-1 flex items-center justify-center relative group">
                          <img src={config.signatureConfig.signatureUrl} alt="Signature" className="max-h-full max-w-full object-contain" />
                          <button
                            type="button"
                            onClick={() => setConfig({ ...config, signatureConfig: { ...config.signatureConfig, signatureUrl: null } })}
                            className="absolute -top-1.5 -right-1.5 size-4 bg-rose-600 text-white rounded-full flex items-center justify-center text-[10px] cursor-pointer"
                          >
                            ×
                          </button>
                        </div>
                      ) : null}

                      <input ref={sigFileInputRef} type="file" accept="image/*" onChange={handleSignatureUpload} className="hidden" />
                      <button
                        type="button"
                        onClick={() => sigFileInputRef.current?.click()}
                        className="flex-1 py-1.5 px-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="size-3.5" />
                        {config.signatureConfig.signatureUrl ? "Change Signature" : "Upload Signature"}
                      </button>
                    </div>
                  </div>

                  {/* Stamp Upload */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">Company Seal / Stamp</span>
                      <label className="flex items-center gap-1.5 text-xs font-bold text-teal-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.signatureConfig.showStamp}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              signatureConfig: { ...config.signatureConfig, showStamp: e.target.checked },
                            })
                          }
                          className="w-3.5 h-3.5 rounded text-teal-600"
                        />
                        Show
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      {config.signatureConfig.stampUrl ? (
                        <div className="w-14 h-14 bg-white border border-slate-200 rounded-lg p-1 flex items-center justify-center relative group">
                          <img src={config.signatureConfig.stampUrl} alt="Stamp" className="max-h-full max-w-full object-contain" />
                          <button
                            type="button"
                            onClick={() => setConfig({ ...config, signatureConfig: { ...config.signatureConfig, stampUrl: null } })}
                            className="absolute -top-1.5 -right-1.5 size-4 bg-rose-600 text-white rounded-full flex items-center justify-center text-[10px] cursor-pointer"
                          >
                            ×
                          </button>
                        </div>
                      ) : null}

                      <input ref={stampFileInputRef} type="file" accept="image/*" onChange={handleStampUpload} className="hidden" />
                      <button
                        type="button"
                        onClick={() => stampFileInputRef.current?.click()}
                        className="flex-1 py-1.5 px-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="size-3.5" />
                        {config.signatureConfig.stampUrl ? "Change Stamp" : "Upload Rubber Stamp"}
                      </button>
                    </div>
                  </div>

                  {/* Signatory Text & Alignment */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Company Prefix Header</span>
                      <input
                        type="text"
                        value={config.signatureConfig.companyName}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            signatureConfig: { ...config.signatureConfig, companyName: e.target.value },
                          })
                        }
                        placeholder="For ACME ENTERPRISES"
                        className="w-full h-7 bg-white border border-slate-200 rounded-lg px-2 text-xs font-bold text-slate-800 outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Designation</span>
                      <input
                        type="text"
                        value={config.signatureConfig.title}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            signatureConfig: { ...config.signatureConfig, title: e.target.value },
                          })
                        }
                        placeholder="Authorized Signatory"
                        className="w-full h-7 bg-white border border-slate-200 rounded-lg px-2 text-xs font-bold text-slate-800 outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Alignment</span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(["left", "center", "right"] as const).map((align) => (
                          <button
                            key={align}
                            type="button"
                            onClick={() =>
                              setConfig({
                                ...config,
                                signatureConfig: { ...config.signatureConfig, alignment: align },
                              })
                            }
                            className={`py-1 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                              config.signatureConfig.alignment === align
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            {align}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Helper Note */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 space-y-1">
              <span className="font-bold text-slate-700 flex items-center gap-1">
                <HelpCircle className="size-3.5 text-indigo-600" />
                Word Studio Tips:
              </span>
              <p className="text-[10px] text-slate-500 leading-normal">
                • Click any text in the A4 invoice preview to change it.
                • Click the red trash icon on any field to remove it.
                • Add new fields dynamically from the top bar or sidebar.
              </p>
            </div>
          </div>

          {/* RIGHT LIVE A4 WYSIWYG CANVAS */}
          <div className="flex-1 overflow-y-auto p-6 flex justify-center items-start bg-slate-200/90">
            {/* Real A4 Paper Boundary */}
            <div
              className="w-[820px] min-h-[1140px] bg-white shadow-2xl rounded-sm p-8 flex flex-col justify-between border border-slate-300 relative transition-all"
              style={{
                fontFamily: config.fontFamily,
                fontSize: `${config.fontSizePt}pt`,
                backgroundColor: config.paperBgColor || "#ffffff",
              }}
            >
              {/* Optional Background Watermark */}
              {config.watermarkText && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
                  <span
                    className="font-black text-7xl uppercase tracking-widest text-slate-900 transform -rotate-30"
                    style={{ opacity: config.watermarkOpacity || 0.06 }}
                  >
                    {config.watermarkText}
                  </span>
                </div>
              )}

              {/* RENDER ACTIVE SECTIONS IN ORDER */}
              <div className="space-y-4 z-10">
                {config.sections
                  .filter((s) => s.enabled)
                  .map((section) => {
                    
                    // 1. Company Header
                    if (section.id === "company_header") {
                      if (config.headerStyle === "modern_banner") {
                        return (
                          <div
                            key={section.id}
                            className="p-4 rounded-xl text-white flex items-center justify-between relative group border border-transparent hover:border-white/40 transition-all"
                            style={{ backgroundColor: config.primaryColor }}
                          >
                            <div className="space-y-0.5">
                              <input
                                type="text"
                                value={config.companyName}
                                onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
                                className="bg-transparent font-black text-xl tracking-tight text-white w-full outline-none focus:bg-black/20 px-1 rounded"
                                title="Click to edit company name"
                              />
                              <input
                                type="text"
                                value={config.companyAddress}
                                onChange={(e) => setConfig({ ...config, companyAddress: e.target.value })}
                                className="bg-transparent text-[10px] text-white/90 w-full outline-none focus:bg-black/20 px-1 rounded"
                                title="Click to edit company address"
                              />
                              <div className="flex items-center gap-3 text-[9.5px] text-white/90 pt-0.5">
                                <span className="flex items-center gap-1">
                                  GSTIN:
                                  <input
                                    type="text"
                                    value={config.companyGstin}
                                    onChange={(e) => setConfig({ ...config, companyGstin: e.target.value })}
                                    className="bg-transparent font-mono font-bold text-white outline-none focus:bg-black/20 px-1 rounded w-36"
                                  />
                                </span>
                                <span className="flex items-center gap-1">
                                  Phone:
                                  <input
                                    type="text"
                                    value={config.companyPhone}
                                    onChange={(e) => setConfig({ ...config, companyPhone: e.target.value })}
                                    className="bg-transparent text-white outline-none focus:bg-black/20 px-1 rounded w-28"
                                  />
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <input
                                type="text"
                                value={config.invoiceTitle}
                                onChange={(e) => setConfig({ ...config, invoiceTitle: e.target.value })}
                                className="bg-transparent font-black text-lg tracking-widest uppercase text-white text-right outline-none focus:bg-black/20 px-1 rounded w-52"
                                title="Click to edit invoice title (e.g. TAX INVOICE, BILL OF SUPPLY)"
                              />
                              <span className="text-[10px] opacity-80 block pr-1">ORIGINAL FOR RECIPIENT</span>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={section.id} className="border-b-2 pb-3 flex items-start justify-between" style={{ borderColor: config.primaryColor }}>
                          <div className="space-y-0.5">
                            <input
                              type="text"
                              value={config.companyName}
                              onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
                              className="bg-transparent font-black text-lg outline-none focus:bg-slate-100 px-1 rounded w-96"
                              style={{ color: config.primaryColor }}
                            />
                            <input
                              type="text"
                              value={config.companyAddress}
                              onChange={(e) => setConfig({ ...config, companyAddress: e.target.value })}
                              className="bg-transparent text-[9.5px] text-slate-600 outline-none focus:bg-slate-100 px-1 rounded w-96"
                            />
                            <div className="text-[9px] text-slate-500 flex items-center gap-2">
                              <span>
                                GSTIN:
                                <input
                                  type="text"
                                  value={config.companyGstin}
                                  onChange={(e) => setConfig({ ...config, companyGstin: e.target.value })}
                                  className="bg-transparent font-mono font-bold text-slate-800 outline-none focus:bg-slate-100 px-1 rounded w-32"
                                />
                              </span>
                              <span>
                                Phone:
                                <input
                                  type="text"
                                  value={config.companyPhone}
                                  onChange={(e) => setConfig({ ...config, companyPhone: e.target.value })}
                                  className="bg-transparent text-slate-700 outline-none focus:bg-slate-100 px-1 rounded w-28"
                                />
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <input
                              type="text"
                              value={config.invoiceTitle}
                              onChange={(e) => setConfig({ ...config, invoiceTitle: e.target.value })}
                              className="bg-transparent font-black text-base tracking-wider uppercase text-right outline-none focus:bg-slate-100 px-1 rounded w-48"
                              style={{ color: config.primaryColor }}
                            />
                            <span className="text-[9px] text-slate-400 block pr-1">ORIGINAL FOR RECIPIENT</span>
                          </div>
                        </div>
                      );
                    }

                    // 2. Invoice Meta Details & Editable Custom Fields
                    if (section.id === "invoice_meta") {
                      return (
                        <div key={section.id} className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 text-[9.5px] space-y-2 relative group hover:border-indigo-300 transition-colors">
                          <div className="flex items-center justify-between pb-1 border-b border-slate-200/80">
                            <span className="font-bold text-slate-500 uppercase text-[8.5px] tracking-wider">
                              Invoice References & Custom Meta Fields
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAddCustomField("meta", "New Field", "Sample Value")}
                              className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded cursor-pointer"
                            >
                              <Plus className="size-3" />
                              + Add Field Here
                            </button>
                          </div>

                          <div className="grid grid-cols-4 gap-2.5">
                            {/* Standard Inbuilt Meta Fields */}
                            <div className="p-1 rounded hover:bg-white transition-colors">
                              <input
                                type="text"
                                value={config.invoiceNumberLabel}
                                onChange={(e) => setConfig({ ...config, invoiceNumberLabel: e.target.value })}
                                className="text-slate-400 uppercase font-bold text-[8.5px] bg-transparent outline-none w-full"
                              />
                              <input
                                type="text"
                                value={config.invoiceNumberValue}
                                onChange={(e) => setConfig({ ...config, invoiceNumberValue: e.target.value })}
                                className="font-bold text-slate-800 bg-transparent outline-none w-full"
                              />
                            </div>

                            <div className="p-1 rounded hover:bg-white transition-colors">
                              <input
                                type="text"
                                value={config.invoiceDateLabel}
                                onChange={(e) => setConfig({ ...config, invoiceDateLabel: e.target.value })}
                                className="text-slate-400 uppercase font-bold text-[8.5px] bg-transparent outline-none w-full"
                              />
                              <input
                                type="text"
                                value={config.invoiceDateValue}
                                onChange={(e) => setConfig({ ...config, invoiceDateValue: e.target.value })}
                                className="font-bold text-slate-800 bg-transparent outline-none w-full"
                              />
                            </div>

                            <div className="p-1 rounded hover:bg-white transition-colors">
                              <input
                                type="text"
                                value={config.dueDateLabel}
                                onChange={(e) => setConfig({ ...config, dueDateLabel: e.target.value })}
                                className="text-slate-400 uppercase font-bold text-[8.5px] bg-transparent outline-none w-full"
                              />
                              <input
                                type="text"
                                value={config.dueDateValue}
                                onChange={(e) => setConfig({ ...config, dueDateValue: e.target.value })}
                                className="font-bold text-slate-800 bg-transparent outline-none w-full"
                              />
                            </div>

                            <div className="p-1 rounded hover:bg-white transition-colors">
                              <input
                                type="text"
                                value={config.placeOfSupplyLabel}
                                onChange={(e) => setConfig({ ...config, placeOfSupplyLabel: e.target.value })}
                                className="text-slate-400 uppercase font-bold text-[8.5px] bg-transparent outline-none w-full"
                              />
                              <input
                                type="text"
                                value={config.placeOfSupplyValue}
                                onChange={(e) => setConfig({ ...config, placeOfSupplyValue: e.target.value })}
                                className="font-bold text-slate-800 bg-transparent outline-none w-full"
                              />
                            </div>

                            {/* Render user's dynamic custom fields */}
                            {config.customFields
                              .filter((f) => f.enabled && (f.section === "meta" || !f.section))
                              .map((f) => (
                                <div
                                  key={f.id}
                                  className="p-1 rounded bg-white border border-slate-200/80 hover:border-indigo-300 relative group/field"
                                >
                                  <div className="flex items-center justify-between">
                                    <input
                                      type="text"
                                      value={f.label}
                                      onChange={(e) => handleUpdateCustomField(f.id, { label: e.target.value })}
                                      className="text-slate-500 uppercase font-bold text-[8px] bg-transparent outline-none w-full"
                                      placeholder="Field Name"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteCustomField(f.id)}
                                      className="text-rose-400 hover:text-rose-600 opacity-0 group-hover/field:opacity-100 transition-opacity p-0.5 cursor-pointer"
                                      title="Remove Field"
                                    >
                                      <Trash2 className="size-3" />
                                    </button>
                                  </div>
                                  <input
                                    type="text"
                                    value={f.value}
                                    onChange={(e) => handleUpdateCustomField(f.id, { value: e.target.value })}
                                    className="font-semibold text-slate-800 bg-transparent outline-none w-full"
                                    placeholder="Value"
                                  />
                                </div>
                              ))}
                          </div>
                        </div>
                      );
                    }

                    // 3. Bill To & Ship To Details
                    if (section.id === "party_details") {
                      return (
                        <div key={section.id} className="grid grid-cols-2 gap-4 text-[9.5px] border border-slate-200 rounded-xl p-3 bg-white hover:border-indigo-300 transition-colors">
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={config.customerTitle}
                              onChange={(e) => setConfig({ ...config, customerTitle: e.target.value })}
                              className="font-bold text-slate-400 uppercase text-[8.5px] bg-transparent outline-none w-full"
                            />
                            <input
                              type="text"
                              value={config.customerName}
                              onChange={(e) => setConfig({ ...config, customerName: e.target.value })}
                              className="font-extrabold text-slate-900 text-xs bg-transparent outline-none w-full"
                            />
                            <input
                              type="text"
                              value={config.customerAddress}
                              onChange={(e) => setConfig({ ...config, customerAddress: e.target.value })}
                              className="text-slate-600 bg-transparent outline-none w-full"
                            />
                            <div className="flex items-center gap-2 pt-0.5">
                              <span className="text-slate-500">GSTIN:</span>
                              <input
                                type="text"
                                value={config.customerGstin}
                                onChange={(e) => setConfig({ ...config, customerGstin: e.target.value })}
                                className="font-mono font-bold text-slate-800 bg-transparent outline-none w-32"
                              />
                            </div>
                          </div>
                          <div className="border-l border-slate-200 pl-4 space-y-1">
                            <input
                              type="text"
                              value={config.shippingTitle}
                              onChange={(e) => setConfig({ ...config, shippingTitle: e.target.value })}
                              className="font-bold text-slate-400 uppercase text-[8.5px] bg-transparent outline-none w-full"
                            />
                            <input
                              type="text"
                              value={config.shippingName}
                              onChange={(e) => setConfig({ ...config, shippingName: e.target.value })}
                              className="font-extrabold text-slate-900 text-xs bg-transparent outline-none w-full"
                            />
                            <input
                              type="text"
                              value={config.shippingAddress}
                              onChange={(e) => setConfig({ ...config, shippingAddress: e.target.value })}
                              className="text-slate-600 bg-transparent outline-none w-full"
                            />
                          </div>
                        </div>
                      );
                    }

                    // 4. Dynamic Items Table Grid
                    if (section.id === "items_table") {
                      const enabledCols = config.columns.filter((c) => c.enabled);
                      return (
                        <div key={section.id} className="rounded-xl overflow-hidden border border-slate-300 shadow-2xs">
                          <table className="w-full border-collapse text-[9.5px]">
                            <thead>
                              <tr style={{ backgroundColor: config.primaryColor }} className="text-white">
                                {enabledCols.map((col, idx) => (
                                  <th
                                    key={col.id}
                                    style={{ width: `${col.widthPercent}%`, textAlign: col.align }}
                                    className="p-2 font-bold uppercase tracking-wider text-[9px] border-r border-white/20 last:border-r-0 relative group/col"
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <input
                                        type="text"
                                        value={col.headerTitle}
                                        onChange={(e) => handleUpdateColumnHeader(col.id, e.target.value)}
                                        className="bg-transparent font-bold uppercase text-[9px] text-white outline-none w-full text-center focus:bg-black/20 rounded px-0.5"
                                        title="Click to rename column header"
                                      />
                                      {col.isCustom && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteColumn(col.id)}
                                          className="text-white/60 hover:text-white opacity-0 group-hover/col:opacity-100 p-0.5 cursor-pointer"
                                          title="Delete Column"
                                        >
                                          <Trash2 className="size-2.5" />
                                        </button>
                                      )}
                                    </div>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sampleItems.map((item, idx) => (
                                <tr key={idx} className={idx % 2 === 1 ? "bg-slate-50/70" : "bg-white"}>
                                  {enabledCols.map((col) => {
                                    if (col.fieldKey === "sno") {
                                      return (
                                        <td key={col.id} className="p-2 text-center border-t border-slate-200 text-slate-500 font-semibold">
                                          {item.sno}
                                        </td>
                                      );
                                    }
                                    if (col.fieldKey === "description") {
                                      return (
                                        <td key={col.id} className="p-2 border-t border-slate-200 text-left">
                                          <strong className="text-slate-900 block">{item.description}</strong>
                                          {item.custom_note && (
                                            <span className="text-[8.5px] text-slate-500 block mt-0.5">
                                              {item.custom_note}
                                            </span>
                                          )}
                                        </td>
                                      );
                                    }
                                    if (col.fieldKey === "hsn") {
                                      return (
                                        <td key={col.id} className="p-2 text-center border-t border-slate-200 font-mono text-[9px]">
                                          {item.hsn}
                                        </td>
                                      );
                                    }
                                    if (col.fieldKey === "quantity") {
                                      return (
                                        <td key={col.id} className="p-2 text-center border-t border-slate-200 font-bold">
                                          {item.quantity}
                                        </td>
                                      );
                                    }
                                    if (col.fieldKey === "unit_price") {
                                      return (
                                        <td key={col.id} className="p-2 text-right border-t border-slate-200 font-mono">
                                          ₹{item.unit_price.toFixed(2)}
                                        </td>
                                      );
                                    }
                                    if (col.fieldKey === "discount") {
                                      return (
                                        <td key={col.id} className="p-2 text-center border-t border-slate-200">
                                          {item.discount > 0 ? `${item.discount}%` : "-"}
                                        </td>
                                      );
                                    }
                                    if (col.fieldKey === "tax_rate") {
                                      return (
                                        <td key={col.id} className="p-2 text-center border-t border-slate-200 font-semibold">
                                          {item.tax_rate}%
                                        </td>
                                      );
                                    }
                                    if (col.fieldKey === "total_amount") {
                                      return (
                                        <td key={col.id} className="p-2 text-right border-t border-slate-200 font-bold font-mono text-slate-900">
                                          ₹{item.total_amount.toFixed(2)}
                                        </td>
                                      );
                                    }

                                    // Default Custom Column
                                    return (
                                      <td key={col.id} className="p-2 border-t border-slate-200 text-slate-600" style={{ textAlign: col.align }}>
                                        -
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    }

                    // 5. GST Slabs Matrix
                    if (section.id === "tax_slabs" && config.showTaxBreakdown) {
                      return (
                        <div key={section.id} className="border border-slate-200 rounded-xl p-2.5 text-[8.5px] bg-slate-50/50">
                          <span className="font-bold text-slate-500 uppercase block mb-1">GST Tax Breakdown (HSN / SAC Split)</span>
                          <table className="w-full text-center">
                            <thead>
                              <tr className="text-slate-400 border-b border-slate-200 uppercase font-bold">
                                <th className="p-1 text-left">HSN / SAC</th>
                                <th className="p-1 text-right">Taxable Value</th>
                                <th className="p-1">CGST (2.5%)</th>
                                <th className="p-1">SGST (2.5%)</th>
                                <th className="p-1">IGST</th>
                                <th className="p-1 text-right">Total Tax</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="font-mono text-slate-700">
                                <td className="p-1 text-left font-semibold">10063020</td>
                                <td className="p-1 text-right">₹12,250.00</td>
                                <td className="p-1">₹306.25</td>
                                <td className="p-1">₹306.25</td>
                                <td className="p-1">₹0.00</td>
                                <td className="p-1 text-right font-bold">₹612.50</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      );
                    }

                    // 6. Totals & Words
                    if (section.id === "totals_block") {
                      return (
                        <div key={section.id} className="flex justify-between items-start gap-4 pt-1">
                          <div className="flex-1 text-[9px] text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <span className="font-bold text-slate-400 uppercase text-[8px] block mb-0.5">Amount in Words:</span>
                            <strong className="text-slate-800 text-[10px]">Twenty Four Thousand Six Hundred Twelve Rupees and Fifty Paise Only</strong>
                          </div>
                          <div className="w-64 space-y-1 text-[10px] font-semibold bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <div className="flex justify-between text-slate-600">
                              <span>Taxable Amount:</span>
                              <span className="font-mono">₹{subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                              <span>Total GST:</span>
                              <span className="font-mono">₹{taxAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-slate-900 font-extrabold text-xs pt-1.5 border-t border-slate-300">
                              <span>Grand Total:</span>
                              <span className="font-mono font-black" style={{ color: config.primaryColor }}>₹{grandTotal.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // 7. UPI QR & Bank
                    if (section.id === "bank_qr_block" && config.showPaymentQr) {
                      return (
                        <div key={section.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/50 text-[9px]">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-400 uppercase text-[8px] block">Bank Payment Details</span>
                            <p>Bank: <strong>{activeGst?.bank_name || "HDFC Bank Ltd"}</strong></p>
                            <p>A/C No: <strong className="font-mono">{activeGst?.bank_account_number || "50200012345678"}</strong></p>
                            <p>IFSC Code: <strong className="font-mono">{activeGst?.bank_ifsc || "HDFC0001234"}</strong></p>
                          </div>
                          <div className="flex items-center gap-3">
                            <img
                              src={generateQRCodeSVG(
                                buildUpiPayUrl({
                                  vpa: activeGst?.upi_vpa || "merchant@upi",
                                  payeeName: activeGst?.trade_name || "Merchant",
                                  amount: grandTotal,
                                  invoiceNumber: "INV-2026-0089",
                                }),
                                90
                              )}
                              alt="UPI QR"
                              className="w-16 h-16 object-contain bg-white p-1 rounded-lg border border-slate-200"
                            />
                            <div className="text-right text-[8px] text-slate-500">
                              <span className="font-bold text-indigo-700 block">⚡ Scan & Pay UPI</span>
                              <span>Supports PhonePe, GPay, Paytm</span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // 8. Terms & Declarations
                    if (section.id === "terms_block") {
                      return (
                        <div key={section.id} className="text-[8.5px] text-slate-500 leading-relaxed border-t border-slate-200 pt-2 group">
                          <strong className="text-slate-700 block mb-0.5">Terms & Conditions:</strong>
                          <textarea
                            value={config.termsText}
                            onChange={(e) => setConfig({ ...config, termsText: e.target.value })}
                            rows={3}
                            className="w-full bg-transparent outline-none resize-none text-slate-600 focus:bg-slate-50 p-1 rounded border border-transparent focus:border-slate-200"
                          />
                        </div>
                      );
                    }

                    // 9. Authorized Signature & Official Stamp Block
                    if (section.id === "signature_block") {
                      const alignClass =
                        config.signatureConfig.alignment === "left"
                          ? "justify-start text-left"
                          : config.signatureConfig.alignment === "center"
                          ? "justify-center text-center"
                          : "justify-end text-right";

                      return (
                        <div key={section.id} className={`pt-4 border-t border-slate-200 flex ${alignClass}`}>
                          <div className="relative inline-flex flex-col items-center min-w-[200px] text-center group p-2 rounded-xl hover:bg-slate-50/80 border border-transparent hover:border-slate-200 transition-colors">
                            
                            {/* Company Header */}
                            <input
                              type="text"
                              value={config.signatureConfig.companyName}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  signatureConfig: { ...config.signatureConfig, companyName: e.target.value },
                                })
                              }
                              placeholder="For ACME ENTERPRISES"
                              className="text-[9px] font-bold text-slate-700 bg-transparent text-center outline-none w-full mb-1"
                            />

                            {/* Seal / Rubber Stamp Overlay */}
                            <div className="h-16 flex items-center justify-center relative w-full my-1">
                              {config.signatureConfig.showStamp && config.signatureConfig.stampUrl ? (
                                <img
                                  src={config.signatureConfig.stampUrl}
                                  alt="Official Stamp"
                                  className="absolute h-16 w-16 object-contain opacity-85 rotate-[-8deg] pointer-events-none"
                                />
                              ) : null}
                              {config.signatureConfig.showSignature && config.signatureConfig.signatureUrl ? (
                                <img
                                  src={config.signatureConfig.signatureUrl}
                                  alt="Authorized Signature"
                                  className="h-12 max-w-[140px] object-contain relative z-10"
                                />
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">Digital Signature</span>
                              )}
                            </div>

                            {/* Signatory Designation Line */}
                            <div className="w-36 border-t border-slate-400 pt-1">
                              <input
                                type="text"
                                value={config.signatureConfig.title}
                                onChange={(e) =>
                                  setConfig({
                                    ...config,
                                    signatureConfig: { ...config.signatureConfig, title: e.target.value },
                                  })
                                }
                                placeholder="Authorized Signatory"
                                className="text-[9px] font-extrabold uppercase tracking-wider text-slate-800 bg-transparent text-center outline-none w-full"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return null;
                  })}
              </div>

              {/* FOOTER TEXT */}
              <div className="text-center text-[8.5px] text-slate-400 border-t border-slate-200 pt-2 mt-4 z-10">
                <input
                  type="text"
                  value={config.footerNote}
                  onChange={(e) => setConfig({ ...config, footerNote: e.target.value })}
                  className="bg-transparent text-center w-full outline-none text-slate-400 focus:bg-slate-50 p-1 rounded"
                />
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between shrink-0 shadow-lg">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={config.isDefault}
                onChange={(e) => setConfig({ ...config, isDefault: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              Set as Organization Default Template for Invoices & POS
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-500/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Save Master Word Template
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
