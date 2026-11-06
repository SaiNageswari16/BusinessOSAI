import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Palette,
  Printer,
  Building2,
  FileText,
  Users,
  Table,
  Sliders,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  Upload,
  Eye,
  Save,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Download,
  Check,
  CheckCircle2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sparkles,
  QrCode,
  Landmark,
  ShieldCheck,
  Receipt,
  Barcode,
  Layers,
  ChevronRight,
  X,
  FileCheck,
} from "lucide-react";
import { toast } from "sonner";
import { GstTallyTemplate } from "@/components/pos/invoice-templates/GstTallyTemplate";
import { loadStoredInvoiceSettings, saveStoredInvoiceSettings } from "@/components/pos/InvoiceQuickSettingsModal";
import type { FullInvoiceData } from "@/components/pos/FullInvoicePrinter";
import {
  type UnifiedInvoiceCustomizerConfig,
  type InvoiceDocCategory,
  type DynamicColumnDefinition,
  type CustomFieldDefinition,
  createDefaultUnifiedConfig,
  unifiedConfigToPrintTemplate,
  printTemplateToUnifiedConfig,
  DEFAULT_UNIFIED_COLUMNS,
  PARTY_LAYOUT_OPTIONS,
  docTitleFor,
  docNoLabelFor,
  docDateLabelFor,
  resolveInvoiceTexts,
} from "@/lib/invoice-template-config";
import {
  safeSetItem,
  safeGetItem,
  sanitizeForStorage,
  compressImageForStorage,
  MAX_STORED_IMAGE_CHARS,
} from "@/lib/safe-storage";
import {
  savePrintTemplateSafe,
  getActiveInvoicePrintTemplateForCategory,
  setActiveInvoicePrintTemplateForCategory,
  setActiveDocTemplateId,
  getActiveBillingGst,
  getTenantIdFromStorage,
  getTenantTemplatesKey,
} from "@/lib/receipt-template-store";

export type CustomizerCategory =
  | "style"
  | "print"
  | "business"
  | "invoice"
  | "party"
  | "itemTable"
  | "miscellaneous";

export interface UnifiedInvoiceCustomizerProps {
  tenant?: any;
  currency?: string;
  onSave?: (savedTemplate: any) => void;
  onSwitchToThermal?: () => void;
  onSwitchToBarcode?: () => void;
  initialCategory?: CustomizerCategory;
  initialDocCategory?: InvoiceDocCategory;
}

export const CATEGORY_DEFINITIONS: {
  id: CustomizerCategory;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "style", label: "Style Settings", subtitle: "Colors, fonts & margins", icon: Palette },
  { id: "print", label: "Print Settings", subtitle: "Page size & orientation", icon: Printer },
  { id: "business", label: "Business Details", subtitle: "Name, logo & GSTIN", icon: Building2 },
  { id: "invoice", label: "Invoice Details", subtitle: "Title, dates & references", icon: FileText },
  { id: "party", label: "Party Details", subtitle: "Party layouts & billing", icon: Users },
  { id: "itemTable", label: "Item Table", subtitle: "Columns, totals & tax", icon: Table },
  { id: "miscellaneous", label: "Miscellaneous", subtitle: "UPI QR, bank & signature", icon: Sliders },
];

export const DOC_CATEGORY_TABS: {
  id: InvoiceDocCategory;
  label: string;
  badge: string;
}[] = [
  { id: "invoice", label: "Tax Invoice", badge: "INV" },
  { id: "proforma", label: "Proforma Invoice", badge: "PI" },
  { id: "quotation", label: "Quotation", badge: "QT" },
  { id: "challan", label: "Delivery Challan", badge: "DC" },
];

// Sample datasets for realistic live preview
const SAMPLE_DATASETS: Record<string, { name: string; invoice: FullInvoiceData }> = {
  fmcg: {
    name: "FMCG Grocery Wholesale",
    invoice: {
      id: "mock-inv-fmcg",
      invoice_number: "INV-2026-0042",
      doc_type: "invoice",
      header_title: "TAX INVOICE",
      invoice_date: "2026-07-10",
      due_date: "2026-07-24",
      created_at: "2026-07-10T10:00:00Z",
      payment_method: "Bank Transfer",
      place_of_supply: "37 - Andhra Pradesh",
      po_number: "PO-2026-8812",
      customerName: "ACME Supermarket & Retailers",
      customerCompany: "ACME Retail Enterprises Pvt Ltd",
      customerAddress: "Shop 12-14, Commercial Complex, MG Road, Vijayawada, AP - 520002",
      customerShippingAddress: "Warehouse 4, Auto Nagar Industrial Area, Vijayawada, AP - 520007",
      customerPhone: "+91 98765 43210",
      customerGST: "37BBBBA9999C1Z2",
      customerPan: "BBBBA9999C",
      taxable_value: 38500,
      cgst_amount: 3465,
      sgst_amount: 3465,
      tax_amount: 6930,
      grand_total: 45430,
      amount_received: 45430,
      party_previous_balance: 5200,
      items: [
        { product_name: "Tata Tea Gold 500g", description: "Premium Assam & CTC Blend", quantity: 24, unit_price: 240, mrp: 270, hsn_code: "0902", tax_rate: 5, subtotal: 6048, batch_no: "TG-441", mfg_date: "01/2026", exp_date: "01/2028" },
        { product_name: "Aashirvaad Select Sharbati Atta 10kg", description: "100% MP Sharbati Wheat Flour", quantity: 15, unit_price: 520, mrp: 580, hsn_code: "1101", tax_rate: 5, subtotal: 8190, batch_no: "AS-102", mfg_date: "03/2026", exp_date: "09/2026" },
        { product_name: "Amul Pure Ghee 1L Tin", description: "Pure Milk Fat Ghee", quantity: 12, unit_price: 610, mrp: 660, hsn_code: "0405", tax_rate: 12, subtotal: 8198, batch_no: "AG-88", mfg_date: "04/2026", exp_date: "04/2027" },
        { product_name: "Surf Excel Matic Front Load 2kg", description: "Top Detergent Powder", quantity: 10, unit_price: 430, mrp: 480, hsn_code: "3402", tax_rate: 18, subtotal: 5074, batch_no: "SE-91", mfg_date: "02/2026", exp_date: "02/2028" },
        { product_name: "Cadbury Celebrations Box 280g", description: "Assorted Chocolate Gift Pack", quantity: 30, unit_price: 185, mrp: 210, hsn_code: "1806", tax_rate: 18, subtotal: 6549, batch_no: "CB-77", mfg_date: "05/2026", exp_date: "11/2026" },
        { product_name: "Fortune Sunlite Refined Oil 5L Jar", description: "Refined Sunflower Oil Jar", quantity: 8, unit_price: 680, mrp: 740, hsn_code: "1512", tax_rate: 5, subtotal: 5712, batch_no: "FS-55", mfg_date: "05/2026", exp_date: "05/2027" },
      ],
    },
  },
  pharma: {
    name: "Pharma Healthcare Wholesale",
    invoice: {
      id: "mock-inv-pharma",
      invoice_number: "INV-2026-0042",
      doc_type: "invoice",
      header_title: "TAX INVOICE",
      invoice_date: "2026-07-10",
      due_date: "2026-07-25",
      created_at: "2026-07-10T10:00:00Z",
      payment_method: "NEFT / RTGS",
      place_of_supply: "37 - Andhra Pradesh",
      po_number: "PO-MED-9921",
      customerName: "Apollo MedPlus Pharmacy",
      customerCompany: "Apollo Health Care Ltd",
      customerAddress: "Plot 42, Hospital Road, Proddatur, YSR District, AP - 516360",
      customerShippingAddress: "Apollo MedPlus Pharmacy, Hospital Road, Proddatur, AP",
      customerPhone: "+91 94401 23456",
      customerGST: "37AAAAA0000A1Z5",
      customerPan: "AAAAA0000A",
      taxable_value: 29800,
      cgst_amount: 1788,
      sgst_amount: 1788,
      tax_amount: 3576,
      grand_total: 33376,
      amount_received: 33376,
      party_previous_balance: 0,
      items: [
        { product_name: "Dolo 650mg Tablets (15s)", description: "Paracetamol IP 650mg", quantity: 100, unit_price: 32, mrp: 35.5, hsn_code: "3004", tax_rate: 12, subtotal: 3584, batch_no: "DL-9081", mfg_date: "02/2026", exp_date: "01/2028" },
        { product_name: "Azithral 500mg (5s Strip)", description: "Azithromycin Tablets IP 500mg", quantity: 60, unit_price: 110, mrp: 128, hsn_code: "3004", tax_rate: 12, subtotal: 7392, batch_no: "AZ-4122", mfg_date: "01/2026", exp_date: "12/2027" },
        { product_name: "Pantocid DSR Capsules (10s)", description: "Pantoprazole & Domperidone SR", quantity: 80, unit_price: 135, mrp: 154, hsn_code: "3004", tax_rate: 12, subtotal: 12096, batch_no: "PD-6631", mfg_date: "03/2026", exp_date: "02/2028" },
        { product_name: "Ascoril D Plus Syrup 100ml", description: "Cough Relief Suspension", quantity: 40, unit_price: 118, mrp: 132, hsn_code: "3004", tax_rate: 12, subtotal: 5286, batch_no: "AS-1144", mfg_date: "04/2026", exp_date: "03/2028" },
        { product_name: "Shelcal 500mg Tablets (15s)", description: "Calcium & Vitamin D3 Tablets", quantity: 50, unit_price: 90, mrp: 105, hsn_code: "3004", tax_rate: 12, subtotal: 5040, batch_no: "SH-8821", mfg_date: "03/2026", exp_date: "02/2028" },
      ],
    },
  },
  hardware: {
    name: "Hardware & Electricals",
    invoice: {
      id: "mock-inv-hardware",
      invoice_number: "INV-2026-0042",
      doc_type: "invoice",
      header_title: "TAX INVOICE",
      invoice_date: "2026-07-10",
      due_date: "2026-07-30",
      created_at: "2026-07-10T10:00:00Z",
      payment_method: "Cheque",
      place_of_supply: "37 - Andhra Pradesh",
      po_number: "PO-ELEC-4401",
      customerName: "Sri Balaji Electrical Contractors",
      customerCompany: "Sri Balaji Infra & Projects",
      customerAddress: "Door No 8/120, Trunk Road, Kadapa, AP - 516001",
      customerShippingAddress: "Site Office, Phase 2 Smart City Project, Kadapa, AP",
      customerPhone: "+91 94405 67890",
      customerGST: "37CCCCA1111B1Z3",
      customerPan: "CCCCA1111B",
      taxable_value: 54000,
      cgst_amount: 4860,
      sgst_amount: 4860,
      tax_amount: 9720,
      grand_total: 63720,
      amount_received: 40000,
      party_previous_balance: 15400,
      items: [
        { product_name: "Havells 1.5 Sqmm FR-LSH Copper Wire (90m)", description: "Flame Retardant Low Smoke Copper Wire", quantity: 12, unit_price: 1850, mrp: 2100, hsn_code: "8544", tax_rate: 18, subtotal: 26196, batch_no: "HV-15", mfg_date: "05/2026", exp_date: "" },
        { product_name: "Philips 9W LED Cool Day Light Bulb (Pack of 10)", description: "6500K B22 LED Lamp", quantity: 10, unit_price: 850, mrp: 990, hsn_code: "8539", tax_rate: 18, subtotal: 10030, batch_no: "PH-9W", mfg_date: "04/2026", exp_date: "" },
        { product_name: "Anchor Roma 6A 1-Way Modular Switch", description: "White Modular 1-Way Switch", quantity: 150, unit_price: 38, mrp: 45, hsn_code: "8536", tax_rate: 18, subtotal: 6726, batch_no: "AR-6A", mfg_date: "03/2026", exp_date: "" },
        { product_name: "Schneider Acti9 32A DP MCB (C-Curve)", description: "Double Pole 10kA Miniature Circuit Breaker", quantity: 10, unit_price: 780, mrp: 920, hsn_code: "8536", tax_rate: 18, subtotal: 9204, batch_no: "SC-32A", mfg_date: "02/2026", exp_date: "" },
        { product_name: "Finolex 25mm Medium Heavy PVC Conduit (3m)", description: "Rigid Electrical Conduit Pipe", quantity: 60, unit_price: 130, mrp: 150, hsn_code: "3917", tax_rate: 18, subtotal: 9204, batch_no: "FN-25", mfg_date: "05/2026", exp_date: "" },
      ],
    },
  },
};

export const UnifiedInvoiceCustomizer: React.FC<UnifiedInvoiceCustomizerProps> = ({
  tenant,
  currency = "₹",
  onSave,
  onSwitchToThermal,
  onSwitchToBarcode,
  initialCategory = "party",
  initialDocCategory = "invoice",
}) => {
  const [activeCategory, setActiveCategory] = useState<CustomizerCategory>(initialCategory);
  const [activeSubTab, setActiveSubTab] = useState<"text" | "styling">("styling");
  const [activeDocCategory, setActiveDocCategory] = useState<InvoiceDocCategory>(initialDocCategory);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [sampleDatasetKey, setSampleDatasetKey] = useState<string>("fmcg");
  const [isSaving, setIsSaving] = useState(false);
  const [newCustomColumnName, setNewCustomColumnName] = useState("");
  const [newCustomColumnHeader, setNewCustomColumnHeader] = useState("");
  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
  const [newCustomFieldLabel, setNewCustomFieldLabel] = useState("");
  const [newCustomFieldValue, setNewCustomFieldValue] = useState("");

  const logoInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const stampInputRef = useRef<HTMLInputElement>(null);
  const qrImageInputRef = useRef<HTMLInputElement>(null);
  const watermarkImageInputRef = useRef<HTMLInputElement>(null);

  // Helper to load or initialize unified configuration for a document category
  const loadConfigForCategory = (cat: InvoiceDocCategory): UnifiedInvoiceCustomizerConfig => {
    if (typeof window === "undefined") {
      return createDefaultUnifiedConfig(cat, "gst_tally");
    }
    const tid = tenant?.id || getTenantIdFromStorage();
    const rawCid = localStorage.getItem("bos_active_company_id");
    const cid = rawCid && rawCid !== "undefined" && rawCid !== "null" ? rawCid : undefined;

    // 1. Check dedicated customizer config key
    const customizerConfigKey = `bos_unified_invoice_customizer_config_${tid}${cid ? `_${cid}` : ""}_${cat}`;
    const rawSaved = safeGetItem(customizerConfigKey);
    if (rawSaved) {
      try {
        const parsed = JSON.parse(rawSaved);
        if (parsed && typeof parsed === "object" && parsed.style && parsed.party && parsed.itemTable) {
          const defaultBase = createDefaultUnifiedConfig(cat, parsed.theme || parsed.style?.themeId || "gst_tally");
          const merged: UnifiedInvoiceCustomizerConfig = {
            ...defaultBase,
            ...parsed,
            docCategory: cat,
            style: { ...defaultBase.style, ...(parsed.style || {}) },
            print: { ...defaultBase.print, ...(parsed.print || {}) },
            business: { ...defaultBase.business, ...(parsed.business || {}) },
            invoice: { ...defaultBase.invoice, ...(parsed.invoice || {}) },
            party: {
              ...defaultBase.party,
              ...(parsed.party || {}),
              billTo: { ...defaultBase.party?.billTo, ...(parsed.party?.billTo || {}) },
              shipTo: { ...defaultBase.party?.shipTo, ...(parsed.party?.shipTo || {}) },
            },
            itemTable: {
              ...defaultBase.itemTable,
              ...(parsed.itemTable || {}),
              subToggles: { ...defaultBase.itemTable?.subToggles, ...(parsed.itemTable?.subToggles || {}) },
              totalsToggles: { ...defaultBase.itemTable?.totalsToggles, ...(parsed.itemTable?.totalsToggles || {}) },
              styling: { ...defaultBase.itemTable?.styling, ...(parsed.itemTable?.styling || {}) },
            },
            miscellaneous: {
              ...defaultBase.miscellaneous,
              ...(parsed.miscellaneous || {}),
              paymentQr: { ...defaultBase.miscellaneous?.paymentQr, ...(parsed.miscellaneous?.paymentQr || {}) },
              bankDetails: { ...defaultBase.miscellaneous?.bankDetails, ...(parsed.miscellaneous?.bankDetails || {}) },
              termsAndConditions: { ...defaultBase.miscellaneous?.termsAndConditions, ...(parsed.miscellaneous?.termsAndConditions || {}) },
              statutoryDeclaration: { ...defaultBase.miscellaneous?.statutoryDeclaration, ...(parsed.miscellaneous?.statutoryDeclaration || {}) },
              thankYouNote: { ...defaultBase.miscellaneous?.thankYouNote, ...(parsed.miscellaneous?.thankYouNote || {}) },
              signatureAndStamp: { ...defaultBase.miscellaneous?.signatureAndStamp, ...(parsed.miscellaneous?.signatureAndStamp || {}) },
            },
          };
          return merged;
        }
      } catch {}
    }

    // 2. Check active template for category in receipt-template-store
    try {
      const activeTplId = getActiveInvoicePrintTemplateForCategory(cat, tid, cid);
      if (activeTplId) {
        const tplKey = getTenantTemplatesKey(tid);
        const tplRaw = safeGetItem(tplKey);
        if (tplRaw) {
          const tpls = JSON.parse(tplRaw);
          const found = tpls.find((t: any) => t && (t.id === activeTplId || t.themeName === activeTplId));
          if (found) {
            return printTemplateToUnifiedConfig(found, cat);
          }
        }
      }
    } catch {}

    // 3. Fallback to default unified config
    return createDefaultUnifiedConfig(cat, "gst_tally");
  };

  // State: Single source of truth for customizer settings
  const [customizerConfig, setCustomizerConfig] = useState<UnifiedInvoiceCustomizerConfig>(() =>
    loadConfigForCategory(activeDocCategory)
  );

  // Switch document category (Tax Invoice, Proforma, Quotation, Delivery Challan)
  const handleSwitchDocCategory = (newCat: InvoiceDocCategory) => {
    setActiveDocCategory(newCat);
    const loaded = loadConfigForCategory(newCat);
    setCustomizerConfig(loaded);
    toast.info(`Switched to ${newCat.toUpperCase()}`);
  };

  // Live PrintTemplate object derived in-memory with 0ms latency
  const liveTemplate = useMemo(() => {
    return unifiedConfigToPrintTemplate(customizerConfig);
  }, [customizerConfig]);

  // Active mock invoice reflecting document type and category
  const activeInvoiceData = useMemo<FullInvoiceData>(() => {
    const base = SAMPLE_DATASETS[sampleDatasetKey]?.invoice || SAMPLE_DATASETS.fmcg.invoice;
    const cat = customizerConfig.docCategory;
    const isChallan = cat === "challan";
    const isQuote = cat === "quotation";
    const isProforma = cat === "proforma";

    const stored = loadStoredInvoiceSettings();
    const pfx = isChallan
      ? (stored.challanPrefix || "DC-")
      : isQuote
        ? (stored.quotationPrefix || "QT-")
        : isProforma
          ? (stored.proformaPrefix || "PI-")
          : (stored.prefix || "INV-");
    const cleanPfx = pfx.endsWith("-") || pfx.endsWith("/") ? pfx : `${pfx}-`;
    const seq = isChallan
      ? (stored.challanSequenceNumber || 1)
      : isQuote
        ? (stored.quotationSequenceNumber || 1)
        : isProforma
          ? (stored.proformaSequenceNumber || 1)
          : (stored.sequenceNumber || 1);
    const pad = isChallan
      ? (stored.challanPadding ?? 4)
      : isQuote
        ? (stored.quotationPadding ?? 4)
        : isProforma
          ? (stored.proformaPadding ?? 4)
          : (stored.padding ?? 4);
    const docNo = `${cleanPfx}${String(seq).padStart(pad, "0")}`;

    const title = customizerConfig.invoice.documentTitle || (
      isChallan ? "DELIVERY CHALLAN" : isQuote ? "TAX QUOTATION / ESTIMATE" : isProforma ? "PROFORMA INVOICE" : "TAX INVOICE"
    );

    return {
      ...base,
      doc_type: cat,
      invoice_number: docNo,
      header_title: title,
    };
  }, [sampleDatasetKey, customizerConfig.docCategory, customizerConfig.invoice.documentTitle]);

  // Resolved Payment QR Block
  const resolvedPaymentQr = useMemo(() => {
    const qr = customizerConfig.miscellaneous.paymentQr;
    if (!qr.enabled) return null;
    return {
      enabled: true,
      upiId: qr.upiId || "vasavi@okhdfcbank",
      payeeName: qr.payeeName || customizerConfig.business.companyName || tenant?.name || "Merchant",
      customImageUrl: qr.customImageUrl || null,
      qrType: qr.qrType,
      caption: qr.caption || "Scan & Pay with UPI",
      size: qr.size || "medium",
    };
  }, [customizerConfig.miscellaneous.paymentQr, customizerConfig.business.companyName, tenant?.name]);

  // Resolved Bank details string for GstTallyTemplate dynamicBank prop
  const resolvedBankString = useMemo(() => {
    const bank = customizerConfig.miscellaneous.bankDetails;
    if (!bank.enabled) return "";
    return [
      bank.bankName ? `Bank: ${bank.bankName}` : "",
      bank.accountHolderName ? `A/c Name: ${bank.accountHolderName}` : "",
      bank.accountNumber ? `A/c No: ${bank.accountNumber}` : "",
      bank.ifscCode ? `IFSC: ${bank.ifscCode}` : "",
      bank.branch ? `Branch: ${bank.branch}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }, [customizerConfig.miscellaneous.bankDetails]);

  // Image Upload Handler with safe Canvas compression
  const handleImageFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
    onCompressed: (dataUrl: string) => void,
    maxWidth = 500,
    maxHeight = 300
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageForStorage(file, {
        maxWidth,
        maxHeight,
        quality: 0.85,
      });
      if (compressed) {
        onCompressed(compressed);
        toast.success("Image safely uploaded (< 150KB)");
      }
    } catch (err) {
      console.error("Image compression error:", err);
      toast.error("Failed to upload image");
    } finally {
      e.target.value = "";
    }
  };

  // Save Template Handler
  const handleSaveTemplate = () => {
    setIsSaving(true);
    try {
      const tid = tenant?.id || getTenantIdFromStorage();
      const rawCid = localStorage.getItem("bos_active_company_id");
      const cid = rawCid && rawCid !== "undefined" && rawCid !== "null" ? rawCid : undefined;
      const cat = customizerConfig.docCategory;

      // 1. Transform to PrintTemplate format
      const templateToSave = unifiedConfigToPrintTemplate(customizerConfig);
      templateToSave.docCategory = cat;

      // 2. Sanitize storage payload to guarantee no QuotaExceededError
      const sanitized = sanitizeForStorage(templateToSave, MAX_STORED_IMAGE_CHARS);

      // 3. Save into safe template storage
      const savedOk = savePrintTemplateSafe(sanitized, tid);
      if (!savedOk) {
        throw new Error("Could not write to local storage");
      }

      // 4. Pin active template for this specific document category
      setActiveInvoicePrintTemplateForCategory(sanitized.id, cat, tid, cid);
      setActiveDocTemplateId(cat, sanitized.id, tid, cid);

      // 5. Store exact customizer configuration under dedicated key
      const customizerKey = `bos_unified_invoice_customizer_config_${tid}${cid ? `_${cid}` : ""}_${cat}`;
      safeSetItem(customizerKey, JSON.stringify(sanitizeForStorage(customizerConfig, MAX_STORED_IMAGE_CHARS)));

      toast.success(`Template saved successfully for ${cat.toUpperCase()}!`);
      onSave?.(sanitized);
    } catch (err) {
      console.error("Save template error:", err);
      toast.error("Failed to save template");
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to Defaults
  const handleResetDefaults = () => {
    const fresh = createDefaultUnifiedConfig(activeDocCategory, "gst_tally");
    setCustomizerConfig(fresh);
    toast.info(`Reset ${activeDocCategory.toUpperCase()} to defaults`);
  };

  // Add Custom Column to itemTable
  const handleAddCustomColumn = () => {
    if (!newCustomColumnHeader.trim()) {
      toast.error("Please provide a column header title");
      return;
    }
    const colId = `col_custom_${Date.now()}`;
    const newCol: DynamicColumnDefinition = {
      id: colId,
      fieldKey: newCustomColumnName.trim().toLowerCase().replace(/\s+/g, "_") || colId,
      headerTitle: newCustomColumnHeader.trim(),
      widthPercent: 10,
      align: "center",
      enabled: true,
      isCustom: true,
    };
    setCustomizerConfig((prev) => ({
      ...prev,
      itemTable: {
        ...prev.itemTable,
        columns: [...prev.itemTable.columns, newCol],
      },
    }));
    setNewCustomColumnName("");
    setNewCustomColumnHeader("");
    setIsAddColumnModalOpen(false);
    toast.success(`Added custom column "${newCol.headerTitle}"`);
  };

  // Reorder Column Up / Down
  const handleMoveColumn = (index: number, direction: "up" | "down") => {
    const cols = [...customizerConfig.itemTable.columns];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= cols.length) return;
    const temp = cols[index];
    cols[index] = cols[targetIdx];
    cols[targetIdx] = temp;
    setCustomizerConfig((prev) => ({
      ...prev,
      itemTable: { ...prev.itemTable, columns: cols },
    }));
  };

  // Toggle Column Visibility
  const handleToggleColumn = (id: string) => {
    setCustomizerConfig((prev) => ({
      ...prev,
      itemTable: {
        ...prev.itemTable,
        columns: prev.itemTable.columns.map((c) =>
          c.id === id ? { ...c, enabled: !c.enabled } : c
        ),
      },
    }));
  };

  // Delete Custom Column
  const handleDeleteColumn = (id: string) => {
    setCustomizerConfig((prev) => ({
      ...prev,
      itemTable: {
        ...prev.itemTable,
        columns: prev.itemTable.columns.filter((c) => c.id !== id),
      },
    }));
    toast.info("Column removed");
  };

  // Rename Column Header
  const handleRenameColumn = (id: string, newTitle: string) => {
    setCustomizerConfig((prev) => ({
      ...prev,
      itemTable: {
        ...prev.itemTable,
        columns: prev.itemTable.columns.map((c) =>
          c.id === id ? { ...c, headerTitle: newTitle } : c
        ),
      },
    }));
  };

  // Change Column Alignment
  const handleChangeColumnAlign = (id: string, align: "left" | "center" | "right") => {
    setCustomizerConfig((prev) => ({
      ...prev,
      itemTable: {
        ...prev.itemTable,
        columns: prev.itemTable.columns.map((c) =>
          c.id === id ? { ...c, align } : c
        ),
      },
    }));
  };

  return (
    <div className="flex flex-col h-full w-full bg-background text-foreground overflow-hidden font-sans">
      {/* ─── Top Bar: Document Type, Status & Actions ─── */}
      <header className="h-14 border-b border-border/80 bg-card px-4 flex items-center justify-between shrink-0 shadow-xs z-20">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight text-foreground flex items-center gap-2">
              Invoice Template Customizer
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                myBillBook 3-Panel Parity
              </span>
            </h1>
            <p className="text-[10px] text-muted-foreground truncate">
              Live instant DOM preview, party layouts 1/2/3, dynamic columns & safe storage
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 bg-background hover:bg-muted text-foreground text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
            title="Reset to default settings"
          >
            <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
            Reset
          </button>
          <button
            type="button"
            onClick={handleSaveTemplate}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md shadow-indigo-500/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? "Saving..." : "Save Template"}
          </button>
        </div>
      </header>

      {/* ─── Main 3-Panel Grid / Flex Layout ─── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* ════════ PANEL 1: LEFT VERTICAL CATEGORY RAIL (~230px) ════════ */}
        <nav
          aria-label="Customizer Categories"
          className="w-56 shrink-0 border-r border-border/80 bg-card/60 flex flex-col justify-between overflow-y-auto custom-scrollbar select-none"
        >
          {/* Top Categories Navigation */}
          <div className="p-3 space-y-1">
            <p className="px-2 pb-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">
              Categories
            </p>
            {CATEGORY_DEFINITIONS.map((cat) => {
              const IconComp = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-left cursor-pointer group ${
                    isActive
                      ? "bg-indigo-50 text-indigo-900 border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-200 dark:border-indigo-800 shadow-xs font-bold"
                      : "bg-transparent text-foreground/80 border-transparent hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-lg shrink-0 transition-all ${
                        isActive
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-muted text-muted-foreground group-hover:bg-muted/80 group-hover:text-foreground"
                      }`}
                    >
                      <IconComp className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs truncate font-bold leading-tight">{cat.label}</div>
                      <div className="text-[9.5px] text-muted-foreground truncate leading-tight mt-0.5">
                        {cat.subtitle}
                      </div>
                    </div>
                  </div>
                  <ChevronRight
                    className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                      isActive ? "text-indigo-600 dark:text-indigo-400 translate-x-0.5" : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Bottom Utility: Quick Switcher for Non-A4 Tools (Thermal POS & Barcode Labels) */}
          <div className="p-3 border-t border-border/70 bg-card/80 space-y-1.5 shrink-0">
            <p className="px-1 text-[9px] font-black uppercase tracking-wider text-muted-foreground/70">
              Other Formats
            </p>
            {onSwitchToThermal && (
              <button
                type="button"
                onClick={onSwitchToThermal}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border/60 hover:bg-muted/60 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                <Receipt className="h-3.5 w-3.5 text-amber-500" />
                <span className="truncate">POS Thermal Receipts</span>
              </button>
            )}
            {onSwitchToBarcode && (
              <button
                type="button"
                onClick={onSwitchToBarcode}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border/60 hover:bg-muted/60 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                <Barcode className="h-3.5 w-3.5 text-emerald-500" />
                <span className="truncate">Barcode Price Labels</span>
              </button>
            )}
          </div>
        </nav>

        {/* ════════ PANEL 2: CENTER LIVE A4 PREVIEW CANVAS (Flex-1) ════════ */}
        <main
          aria-label="Live Invoice Preview"
          className="flex-1 flex flex-col min-w-0 bg-slate-100 dark:bg-slate-900 border-r border-border/80 overflow-hidden relative"
        >
          {/* Canvas Toolbar: Document Types, Zoom, Sample Data */}
          <div className="h-12 border-b border-border/70 bg-card/90 px-4 flex items-center justify-between shrink-0 z-10 shadow-xs">
            {/* Document Type Switcher (Tax Invoice | Proforma | Quotation | Challan) */}
            <div className="flex items-center p-0.5 bg-muted/60 rounded-xl border border-border/60 gap-0.5">
              {DOC_CATEGORY_TABS.map((docTab) => {
                const isActive = activeDocCategory === docTab.id;
                return (
                  <button
                    key={docTab.id}
                    type="button"
                    onClick={() => handleSwitchDocCategory(docTab.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-xs scale-102"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {docTab.label}
                  </button>
                );
              })}
            </div>

            {/* Canvas Viewport Controls: Sample Data, Zoom Level, Print */}
            <div className="flex items-center gap-2">
              {/* Sample Data Switcher */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="text-[10px] font-semibold hidden md:inline">Sample:</span>
                <select
                  aria-label="Sample Dataset"
                  value={sampleDatasetKey}
                  onChange={(e) => setSampleDatasetKey(e.target.value)}
                  className="px-2 py-1 rounded-lg border border-border/70 bg-card text-foreground text-xs font-semibold cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="fmcg">Grocery / FMCG</option>
                  <option value="pharma">Pharma Healthcare</option>
                  <option value="hardware">Hardware & Electrical</option>
                </select>
              </div>

              {/* Zoom Controls (50% to 150%) */}
              <div className="flex items-center bg-card rounded-lg border border-border/70 p-0.5 text-xs font-semibold text-muted-foreground">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
                  className="p-1 hover:text-foreground hover:bg-muted rounded cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="px-2 text-[10.5px] font-mono min-w-10 text-center">{zoomLevel}%</span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
                  className="p-1 hover:text-foreground hover:bg-muted rounded cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Centered A4 Document Canvas Viewport */}
          <div className="flex-1 overflow-auto custom-scrollbar flex justify-center p-6 bg-slate-100/90 dark:bg-slate-950/80">
            <div
              style={{
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: "top center",
                transition: "transform 0.15s ease",
              }}
              className="w-[794px] min-h-[1123px] bg-white text-slate-900 shadow-2xl rounded-xs border border-slate-300/80 dark:border-slate-800 shrink-0 relative overflow-hidden"
            >
              {/* Live Mount of GstTallyTemplate with full reactive props */}
              <GstTallyTemplate
                invoice={activeInvoiceData}
                template={liveTemplate}
                partyLayout={customizerConfig.party.layout}
                columns={customizerConfig.itemTable.columns}
                texts={liveTemplate.texts}
                f={liveTemplate.fields}
                paymentQr={resolvedPaymentQr}
                dynamicStoreName={customizerConfig.business.companyName || tenant?.name || "BusinessOS Store"}
                dynamicLogoUrl={customizerConfig.business.logoUrl || tenant?.logo_url || ""}
                dynamicAddress={customizerConfig.business.address || tenant?.address || ""}
                dynamicPhone={customizerConfig.business.phone || tenant?.phone || ""}
                dynamicEmail={customizerConfig.business.email || tenant?.email || ""}
                sellerGstin={customizerConfig.business.gstin || tenant?.gst_number || ""}
                sellerStateCode={customizerConfig.business.gstin?.slice(0, 2) || "37"}
                dynamicBank={resolvedBankString}
                paperSize={customizerConfig.print.paperSize}
                orientation={customizerConfig.print.orientation}
                currency={currency}
              />
            </div>
          </div>
        </main>

        {/* ════════ PANEL 3: RIGHT SETTINGS PANEL (~400px) ════════ */}
        <aside
          aria-label="Category Settings"
          className="w-96 shrink-0 border-l border-border/80 bg-card flex flex-col justify-between overflow-hidden shadow-xs"
        >
          {/* Header with Active Category Title and [ ✏️ Text ] / [ 🎨 Styling ] Sub-Tabs */}
          <div className="p-3.5 border-b border-border/70 shrink-0 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black tracking-tight text-foreground flex items-center gap-1.5">
                  {CATEGORY_DEFINITIONS.find((c) => c.id === activeCategory)?.label}
                </h2>
                <p className="text-[10px] text-muted-foreground">
                  Configure live invoice properties
                </p>
              </div>

              {/* Sub-Tab Segmented Switcher */}
              <div className="flex items-center p-0.5 bg-muted/60 rounded-xl border border-border/60">
                <button
                  type="button"
                  onClick={() => setActiveSubTab("text")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    activeSubTab === "text"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  ✏️ Text
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubTab("styling")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    activeSubTab === "styling"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  🎨 Styling
                </button>
              </div>
            </div>
          </div>

          {/* Dynamic Scrollable Form Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            {/* ─── PARTY DETAILS CATEGORY ─── */}
            {activeCategory === "party" && (
              <div className="space-y-4">
                {/* 📌 PINNED PARTY LAYOUT SELECTOR CARDS (Layout 1, Layout 2, Layout 3) */}
                <div className="space-y-2 p-3 bg-muted/30 rounded-2xl border border-border/70">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-foreground">Select Party Layout</span>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                      {customizerConfig.party.layout === "layout_1"
                        ? "Layout 1: Side-by-Side"
                        : customizerConfig.party.layout === "layout_2"
                        ? "Layout 2: 3-Box Header Split"
                        : "Layout 3: Stacked Rows"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {PARTY_LAYOUT_OPTIONS.map((opt) => {
                      const isSelected = customizerConfig.party.layout === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setCustomizerConfig((prev) => ({
                              ...prev,
                              party: { ...prev.party, layout: opt.id as any },
                            }));
                          }}
                          className={`flex flex-col items-center p-2 rounded-xl border-2 transition-all cursor-pointer text-left relative ${
                            isSelected
                              ? "border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/50 shadow-sm scale-102"
                              : "border-border/70 bg-card hover:border-indigo-300 hover:bg-muted/40"
                          }`}
                        >
                          {/* Mini SVG Wireframe Thumbnail */}
                          <div className="w-full h-12 bg-white dark:bg-slate-900 rounded-md border border-slate-300 dark:border-slate-700 p-1 mb-1.5 flex flex-col justify-center">
                            {opt.id === "layout_1" && (
                              <div className="grid grid-cols-2 gap-1 h-full">
                                <div className="bg-indigo-100 dark:bg-indigo-900/60 rounded-xs flex items-center justify-center text-[7px] font-bold text-indigo-700">
                                  Bill To
                                </div>
                                <div className="bg-slate-100 dark:bg-slate-800 rounded-xs flex items-center justify-center text-[7px] font-bold text-slate-600">
                                  Ship To
                                </div>
                              </div>
                            )}
                            {opt.id === "layout_2" && (
                              <div className="grid grid-cols-3 gap-0.5 h-full">
                                <div className="bg-slate-100 dark:bg-slate-800 rounded-xs flex items-center justify-center text-[6px] font-bold text-slate-600">
                                  Seller
                                </div>
                                <div className="bg-slate-100 dark:bg-slate-800 rounded-xs flex items-center justify-center text-[6px] font-bold text-slate-600">
                                  Meta
                                </div>
                                <div className="bg-indigo-100 dark:bg-indigo-900/60 rounded-xs flex items-center justify-center text-[6px] font-bold text-indigo-700">
                                  Party
                                </div>
                              </div>
                            )}
                            {opt.id === "layout_3" && (
                              <div className="flex flex-col gap-1 h-full">
                                <div className="h-1/2 bg-indigo-100 dark:bg-indigo-900/60 rounded-xs flex items-center justify-center text-[7px] font-bold text-indigo-700">
                                  Bill To (100%)
                                </div>
                                <div className="h-1/2 bg-slate-100 dark:bg-slate-800 rounded-xs flex items-center justify-center text-[7px] font-bold text-slate-600">
                                  Ship To (100%)
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="text-[11px] font-bold text-foreground truncate w-full text-center">
                            {opt.id === "layout_1" ? "Layout 1" : opt.id === "layout_2" ? "Layout 2" : "Layout 3"}
                          </div>
                          <div className="text-[9px] text-muted-foreground truncate w-full text-center">
                            {opt.id === "layout_1" ? "Side-by-Side" : opt.id === "layout_2" ? "3-Box Split" : "Stacked"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {activeSubTab === "text" ? (
                  /* ✏️ Party Details [ Text ] Controls */
                  <div className="space-y-4">
                    {/* Bill To Section */}
                    <div className="space-y-2 p-3 bg-muted/20 rounded-xl border border-border/60">
                      <label className="text-xs font-bold text-foreground block">Bill To Section Title</label>
                      <input
                        type="text"
                        value={customizerConfig.party.billTo.sectionTitle}
                        onChange={(e) =>
                          setCustomizerConfig((prev) => ({
                            ...prev,
                            party: {
                              ...prev.party,
                              billTo: { ...prev.party.billTo, sectionTitle: e.target.value },
                            },
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-border/70 bg-card text-xs"
                        placeholder="Bill To"
                      />

                      <div className="pt-2 space-y-1.5">
                        <span className="text-[11px] font-semibold text-muted-foreground">Fields to Display:</span>
                        {[
                          { key: "showCompanyName", label: "Company / Customer Name" },
                          { key: "showContactPerson", label: "Contact Person" },
                          { key: "showAddress", label: "Billing Address" },
                          { key: "showPhone", label: "Phone Number" },
                          { key: "showEmail", label: "Email Address" },
                          { key: "showGstin", label: "Customer GSTIN" },
                          { key: "showPan", label: "Customer PAN" },
                          { key: "showPartyBalance", label: "Outstanding Ledger Balance" },
                        ].map((field) => (
                          <label key={field.key} className="flex items-center gap-2 text-xs cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={(customizerConfig.party.billTo as any)[field.key]}
                              onChange={(e) =>
                                setCustomizerConfig((prev) => ({
                                  ...prev,
                                  party: {
                                    ...prev.party,
                                    billTo: { ...prev.party.billTo, [field.key]: e.target.checked },
                                  },
                                }))
                              }
                              className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>{field.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Ship To Section */}
                    <div className="space-y-2 p-3 bg-muted/20 rounded-xl border border-border/60">
                      <label className="text-xs font-bold text-foreground block">Ship To Section Title</label>
                      <input
                        type="text"
                        value={customizerConfig.party.shipTo.sectionTitle}
                        onChange={(e) =>
                          setCustomizerConfig((prev) => ({
                            ...prev,
                            party: {
                              ...prev.party,
                              shipTo: { ...prev.party.shipTo, sectionTitle: e.target.value },
                            },
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-border/70 bg-card text-xs"
                        placeholder="Ship To"
                      />

                      <div className="pt-2 space-y-1.5">
                        <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={customizerConfig.party.shipTo.showShippingAddress}
                            onChange={(e) =>
                              setCustomizerConfig((prev) => ({
                                ...prev,
                                party: {
                                  ...prev.party,
                                  shipTo: { ...prev.party.shipTo, showShippingAddress: e.target.checked },
                                },
                              }))
                            }
                            className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Enable Shipping Address Block</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={customizerConfig.party.shipTo.showContact}
                            onChange={(e) =>
                              setCustomizerConfig((prev) => ({
                                ...prev,
                                party: {
                                  ...prev.party,
                                  shipTo: { ...prev.party.shipTo, showContact: e.target.checked },
                                },
                              }))
                            }
                            className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Shipping Contact & Phone</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={customizerConfig.party.shipTo.showGstin}
                            onChange={(e) =>
                              setCustomizerConfig((prev) => ({
                                ...prev,
                                party: {
                                  ...prev.party,
                                  shipTo: { ...prev.party.shipTo, showGstin: e.target.checked },
                                },
                              }))
                            }
                            className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Shipping Consignee GSTIN</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 🎨 Party Details [ Styling ] Controls */
                  <div className="space-y-3">
                    <div className="p-3 bg-muted/20 rounded-xl border border-border/60 space-y-2">
                      <span className="text-xs font-bold text-foreground block">Box Border Styling</span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(["solid", "subtle", "none"] as const).map((style) => (
                          <button
                            key={style}
                            type="button"
                            onClick={() =>
                              setCustomizerConfig((prev) => ({
                                ...prev,
                                party: {
                                  ...prev.party,
                                  styling: { ...(prev.party.styling || {}), borderStyle: style },
                                },
                              }))
                            }
                            className={`py-1.5 text-xs font-bold rounded-lg border capitalize cursor-pointer ${
                              (customizerConfig.party.styling?.borderStyle || "solid") === style
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                : "bg-card text-foreground border-border/70"
                            }`}
                          >
                            {style}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 bg-muted/20 rounded-xl border border-border/60 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-foreground">Header Tint</div>
                        <div className="text-[10px] text-muted-foreground">Light background for party title bars</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={customizerConfig.party.styling?.headerTint !== false}
                        onChange={(e) =>
                          setCustomizerConfig((prev) => ({
                            ...prev,
                            party: {
                              ...prev.party,
                              styling: { ...(prev.party.styling || {}), headerTint: e.target.checked },
                            },
                          }))
                        }
                        className="rounded border-border text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── ITEM TABLE CATEGORY ─── */}
            {activeCategory === "itemTable" && (
              <div className="space-y-4">
                {activeSubTab === "styling" ? (
                  /* 🎨 Item Table [ Styling ] Controls */
                  <div className="space-y-4">
                    {/* Dynamic Columns Manager */}
                    <div className="space-y-2 p-3 bg-muted/30 rounded-2xl border border-border/70">
                      <div className="flex items-center justify-between pb-1">
                        <span className="text-xs font-black text-foreground">Table Columns ({customizerConfig.itemTable.columns.filter((c) => c.enabled).length} Active)</span>
                        <button
                          type="button"
                          onClick={() => setIsAddColumnModalOpen(true)}
                          className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <Plus className="h-3 w-3" /> Add Column
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        {customizerConfig.itemTable.columns.map((col, idx) => (
                          <div
                            key={col.id}
                            className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
                              col.enabled ? "bg-card border-border/80 shadow-xs" : "bg-muted/40 border-border/40 opacity-60"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={col.enabled}
                                onChange={() => handleToggleColumn(col.id)}
                                className="rounded border-border text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                              <input
                                type="text"
                                value={col.headerTitle}
                                onChange={(e) => handleRenameColumn(col.id, e.target.value)}
                                className="px-2 py-0.5 rounded border border-border/60 bg-background text-xs font-bold w-28 truncate"
                              />
                            </div>

                            <div className="flex items-center gap-1">
                              {/* Alignment Selector */}
                              <div className="flex items-center border border-border/60 rounded-md overflow-hidden bg-muted/40">
                                {(["left", "center", "right"] as const).map((align) => (
                                  <button
                                    key={align}
                                    type="button"
                                    onClick={() => handleChangeColumnAlign(col.id, align)}
                                    className={`p-1 cursor-pointer ${
                                      col.align === align ? "bg-indigo-600 text-white" : "text-muted-foreground hover:text-foreground"
                                    }`}
                                    title={`Align ${align}`}
                                  >
                                    {align === "left" ? <AlignLeft className="h-3 w-3" /> : align === "center" ? <AlignCenter className="h-3 w-3" /> : <AlignRight className="h-3 w-3" />}
                                  </button>
                                ))}
                              </div>

                              {/* Reorder Buttons */}
                              <button
                                type="button"
                                onClick={() => handleMoveColumn(idx, "up")}
                                disabled={idx === 0}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                                title="Move Up"
                              >
                                <MoveUp className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveColumn(idx, "down")}
                                disabled={idx === customizerConfig.itemTable.columns.length - 1}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                                title="Move Down"
                              >
                                <MoveDown className="h-3 w-3" />
                              </button>

                              {/* Delete for custom columns */}
                              {col.isCustom && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteColumn(col.id)}
                                  className="p-1 rounded hover:bg-rose-100 text-rose-600 cursor-pointer"
                                  title="Remove Column"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Table Appearance & Borders */}
                    <div className="space-y-2 p-3 bg-muted/20 rounded-xl border border-border/60">
                      <span className="text-xs font-bold text-foreground block">Table Visual Appearance</span>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={customizerConfig.itemTable.styling.showZebraStripes}
                            onChange={(e) =>
                              setCustomizerConfig((prev) => ({
                                ...prev,
                                itemTable: {
                                  ...prev.itemTable,
                                  styling: { ...prev.itemTable.styling, showZebraStripes: e.target.checked },
                                },
                              }))
                            }
                            className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Zebra Striping</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={customizerConfig.itemTable.styling.showVerticalBorders}
                            onChange={(e) =>
                              setCustomizerConfig((prev) => ({
                                ...prev,
                                itemTable: {
                                  ...prev.itemTable,
                                  styling: { ...prev.itemTable.styling, showVerticalBorders: e.target.checked },
                                },
                              }))
                            }
                            className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Vertical Borders</span>
                        </label>
                      </div>

                      <div className="pt-2">
                        <label className="text-xs font-semibold text-muted-foreground block mb-1">
                          Header Background Color
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={customizerConfig.itemTable.styling.headerBgColor}
                            onChange={(e) =>
                              setCustomizerConfig((prev) => ({
                                ...prev,
                                itemTable: {
                                  ...prev.itemTable,
                                  styling: { ...prev.itemTable.styling, headerBgColor: e.target.value },
                                },
                              }))
                            }
                            className="h-8 w-12 rounded cursor-pointer border border-border/80"
                          />
                          <input
                            type="text"
                            value={customizerConfig.itemTable.styling.headerBgColor}
                            onChange={(e) =>
                              setCustomizerConfig((prev) => ({
                                ...prev,
                                itemTable: {
                                  ...prev.itemTable,
                                  styling: { ...prev.itemTable.styling, headerBgColor: e.target.value },
                                },
                              }))
                            }
                            className="px-2 py-1 rounded border border-border/60 bg-card text-xs font-mono w-24"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Totals & Summary Toggles */}
                    <div className="space-y-2 p-3 bg-muted/20 rounded-xl border border-border/60">
                      <span className="text-xs font-bold text-foreground block">Totals & Summary Calculations</span>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {[
                          { key: "showItemsCount", label: "Item & Qty Count" },
                          { key: "showTaxableAmount", label: "Taxable Amount" },
                          { key: "showTaxSplitTable", label: "GST Slabs Matrix" },
                          { key: "showSavingsBanner", label: "Savings Banner" },
                          { key: "showRoundOff", label: "Round Off" },
                          { key: "showGrandTotal", label: "Grand Total" },
                          { key: "showBalanceDue", label: "Balance Due" },
                          { key: "showAmountInWords", label: "Amount in Words" },
                        ].map((item) => (
                          <label key={item.key} className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={(customizerConfig.itemTable.totalsToggles as any)[item.key]}
                              onChange={(e) =>
                                setCustomizerConfig((prev) => ({
                                  ...prev,
                                  itemTable: {
                                    ...prev.itemTable,
                                    totalsToggles: {
                                      ...prev.itemTable.totalsToggles,
                                      [item.key]: e.target.checked,
                                    },
                                  },
                                }))
                              }
                              className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="truncate">{item.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ✏️ Item Table [ Text ] Controls */
                  <div className="space-y-3">
                    <div className="space-y-2 p-3 bg-muted/20 rounded-xl border border-border/60">
                      <span className="text-xs font-bold text-foreground block">Item Cell Additional Text Lines</span>
                      {[
                        { key: "showItemDescription", label: "Item Description Sub-line" },
                        { key: "showSku", label: "Item SKU / Part Code" },
                        { key: "showBarcode", label: "Item Barcode Number" },
                        { key: "showBrandCategory", label: "Item Brand & Category" },
                      ].map((item) => (
                        <label key={item.key} className="flex items-center gap-2 text-xs cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={(customizerConfig.itemTable.subToggles as any)[item.key]}
                            onChange={(e) =>
                              setCustomizerConfig((prev) => ({
                                ...prev,
                                itemTable: {
                                  ...prev.itemTable,
                                  subToggles: {
                                    ...prev.itemTable.subToggles,
                                    [item.key]: e.target.checked,
                                  },
                                },
                              }))
                            }
                            className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── STYLE SETTINGS CATEGORY ─── */}
            {activeCategory === "style" && (
              <div className="space-y-4">
                {activeSubTab === "styling" ? (
                  <div className="space-y-4">
                    {/* Theme Presets */}
                    <div className="space-y-2 p-3 bg-muted/20 rounded-xl border border-border/60">
                      <span className="text-xs font-bold text-foreground block">Theme Style Preset</span>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: "gst_tally", label: "myBillBook (GST Tally)" },
                          { id: "modern", label: "Modern Precision" },
                          { id: "minimal", label: "Clean Minimalist" },
                          { id: "marg_pharma", label: "Marg Pharma" },
                        ].map((theme) => (
                          <button
                            key={theme.id}
                            type="button"
                            onClick={() =>
                              setCustomizerConfig((prev) => ({
                                ...prev,
                                style: { ...prev.style, themeId: theme.id },
                              }))
                            }
                            className={`p-2 rounded-lg border text-left text-xs font-bold cursor-pointer transition-all ${
                              customizerConfig.style.themeId === theme.id
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                : "bg-card text-foreground border-border/70 hover:bg-muted"
                            }`}
                          >
                            {theme.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Primary & Accent Color Picker */}
                    <div className="space-y-3 p-3 bg-muted/20 rounded-xl border border-border/60">
                      <span className="text-xs font-bold text-foreground block">Theme Colors</span>
                      <div className="space-y-2">
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Primary Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={customizerConfig.style.primaryColor}
                              onChange={(e) =>
                                setCustomizerConfig((prev) => ({
                                  ...prev,
                                  style: { ...prev.style, primaryColor: e.target.value },
                                }))
                              }
                              className="h-8 w-12 rounded cursor-pointer border border-border/80"
                            />
                            <input
                              type="text"
                              value={customizerConfig.style.primaryColor}
                              onChange={(e) =>
                                setCustomizerConfig((prev) => ({
                                  ...prev,
                                  style: { ...prev.style, primaryColor: e.target.value },
                                }))
                              }
                              className="px-2 py-1 rounded border border-border/60 bg-card text-xs font-mono w-24"
                            />
                          </div>
                          {/* Quick Swatches */}
                          <div className="flex items-center gap-1.5 mt-2">
                            {["#0f172a", "#1e3a8a", "#065f46", "#7c2d12", "#4f46e5", "#be123c", "#18181b"].map((c) => (
                              <button
                                key={c}
                                type="button"
                                style={{ backgroundColor: c }}
                                onClick={() =>
                                  setCustomizerConfig((prev) => ({
                                    ...prev,
                                    style: { ...prev.style, primaryColor: c },
                                  }))
                                }
                                className="w-5 h-5 rounded-full border border-white/50 shadow-xs cursor-pointer hover:scale-110 transition-transform"
                              />
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Secondary / Accent Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={customizerConfig.style.secondaryColor}
                              onChange={(e) =>
                                setCustomizerConfig((prev) => ({
                                  ...prev,
                                  style: { ...prev.style, secondaryColor: e.target.value },
                                }))
                              }
                              className="h-8 w-12 rounded cursor-pointer border border-border/80"
                            />
                            <input
                              type="text"
                              value={customizerConfig.style.secondaryColor}
                              onChange={(e) =>
                                setCustomizerConfig((prev) => ({
                                  ...prev,
                                  style: { ...prev.style, secondaryColor: e.target.value },
                                }))
                              }
                              className="px-2 py-1 rounded border border-border/60 bg-card text-xs font-mono w-24"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Font Family & Density */}
                    <div className="space-y-3 p-3 bg-muted/20 rounded-xl border border-border/60">
                      <span className="text-xs font-bold text-foreground block">Typography</span>
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Font Family</label>
                        <select
                          value={customizerConfig.style.fontFamily}
                          onChange={(e) =>
                            setCustomizerConfig((prev) => ({
                              ...prev,
                              style: { ...prev.style, fontFamily: e.target.value },
                            }))
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-border/70 bg-card text-xs"
                        >
                          <option value="Inter, -apple-system, sans-serif">Inter (Clean modern)</option>
                          <option value="Calibri, sans-serif">Calibri (Classic invoice)</option>
                          <option value="Aptos, sans-serif">Aptos (New Microsoft standard)</option>
                          <option value="Arial, sans-serif">Arial (High clarity)</option>
                          <option value="'Times New Roman', serif">Times New Roman (Formal)</option>
                          <option value="'JetBrains Mono', monospace">JetBrains Mono (Technical / tabular)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Scale / Density</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(["compact", "normal", "large"] as const).map((density) => (
                            <button
                              key={density}
                              type="button"
                              onClick={() =>
                                setCustomizerConfig((prev) => ({
                                  ...prev,
                                  style: { ...prev.style, fontDensity: density },
                                }))
                              }
                              className={`py-1 text-xs font-bold rounded-lg border capitalize cursor-pointer ${
                                customizerConfig.style.fontDensity === density
                                  ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                  : "bg-card text-foreground border-border/70"
                              }`}
                            >
                              {density}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-muted/20 rounded-xl border border-border/60 space-y-2">
                      <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={customizerConfig.style.watermark.enabled}
                          onChange={(e) =>
                            setCustomizerConfig((prev) => ({
                              ...prev,
                              style: {
                                ...prev.style,
                                watermark: { ...prev.style.watermark, enabled: e.target.checked },
                              },
                            }))
                          }
                          className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Enable Background Watermark</span>
                      </label>
                      {customizerConfig.style.watermark.enabled && (
                        <div className="pt-2 space-y-2">
                          <label className="text-[11px] font-semibold text-muted-foreground block">Watermark Text</label>
                          <input
                            type="text"
                            value={customizerConfig.style.watermark.text}
                            onChange={(e) =>
                              setCustomizerConfig((prev) => ({
                                ...prev,
                                style: {
                                  ...prev.style,
                                  watermark: { ...prev.style.watermark, text: e.target.value },
                                },
                              }))
                            }
                            className="w-full px-2 py-1.5 rounded border border-border/70 bg-card text-xs font-bold"
                            placeholder="e.g. ORIGINAL, PAID, DUPLICATE"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── PRINT SETTINGS CATEGORY ─── */}
            {activeCategory === "print" && (
              <div className="space-y-4">
                {activeSubTab === "styling" ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-muted/20 rounded-xl border border-border/60 space-y-2">
                      <span className="text-xs font-bold text-foreground block">Paper Geometry</span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(["A4", "A5", "Letter"] as const).map((size) => (
                          <button
                            key={size}
                            type="button"
                            onClick={() =>
                              setCustomizerConfig((prev) => ({
                                ...prev,
                                print: { ...prev.print, paperSize: size },
                              }))
                            }
                            className={`py-1.5 text-xs font-bold rounded-lg border cursor-pointer ${
                              customizerConfig.print.paperSize === size
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                : "bg-card text-foreground border-border/70"
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>

                      <div className="pt-2">
                        <span className="text-[11px] font-semibold text-muted-foreground block mb-1">Orientation</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(["portrait", "landscape"] as const).map((orient) => (
                            <button
                              key={orient}
                              type="button"
                              onClick={() =>
                                setCustomizerConfig((prev) => ({
                                  ...prev,
                                  print: { ...prev.print, orientation: orient },
                                }))
                              }
                              className={`py-1.5 text-xs font-bold rounded-lg border capitalize cursor-pointer ${
                                customizerConfig.print.orientation === orient
                                  ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                  : "bg-card text-foreground border-border/70"
                              }`}
                            >
                              {orient}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-muted/20 rounded-xl border border-border/60 space-y-2">
                      <span className="text-xs font-bold text-foreground block">Multi-Page & Options</span>
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={customizerConfig.print.repeatHeaderOnMultiPage}
                          onChange={(e) =>
                            setCustomizerConfig((prev) => ({
                              ...prev,
                              print: { ...prev.print, repeatHeaderOnMultiPage: e.target.checked },
                            }))
                          }
                          className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Repeat Header on Multi-Page</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={customizerConfig.print.showPageNumbers}
                          onChange={(e) =>
                            setCustomizerConfig((prev) => ({
                              ...prev,
                              print: { ...prev.print, showPageNumbers: e.target.checked },
                            }))
                          }
                          className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Print Page Numbers (Page X of Y)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={customizerConfig.print.printBackgroundGraphics}
                          onChange={(e) =>
                            setCustomizerConfig((prev) => ({
                              ...prev,
                              print: { ...prev.print, printBackgroundGraphics: e.target.checked },
                            }))
                          }
                          className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Print Background Graphics / Colors</span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-muted/20 rounded-xl border border-border/60 space-y-2">
                      <label className="text-xs font-bold text-foreground block">Document Copy Tag Badge</label>
                      <input
                        type="text"
                        value={customizerConfig.print.copyTag}
                        onChange={(e) =>
                          setCustomizerConfig((prev) => ({
                            ...prev,
                            print: { ...prev.print, copyTag: e.target.value },
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-border/70 bg-card text-xs font-bold"
                        placeholder="ORIGINAL FOR RECIPIENT"
                      />
                      <p className="text-[10px] text-muted-foreground">Printed at the top right of the invoice</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── BUSINESS DETAILS CATEGORY ─── */}
            {activeCategory === "business" && (
              <div className="space-y-4">
                {activeSubTab === "styling" ? (
                  <div className="space-y-4">
                    {/* Logo Upload & Size */}
                    <div className="space-y-2 p-3 bg-muted/20 rounded-xl border border-border/60">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">Company Logo</span>
                        <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={customizerConfig.business.showLogo}
                            onChange={(e) =>
                              setCustomizerConfig((prev) => ({
                                ...prev,
                                business: { ...prev.business, showLogo: e.target.checked },
                              }))
                            }
                            className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Show Logo</span>
                        </label>
                      </div>

                      {customizerConfig.business.logoUrl ? (
                        <div className="flex items-center gap-3 p-2 bg-card rounded-lg border border-border/80">
                          <img
                            src={customizerConfig.business.logoUrl}
                            alt="Company Logo"
                            className="h-10 object-contain rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] text-muted-foreground block truncate">Logo configured</span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setCustomizerConfig((prev) => ({
                                ...prev,
                                business: { ...prev.business, logoUrl: "" },
                              }))
                            }
                            className="p-1 rounded text-rose-500 hover:bg-rose-50 cursor-pointer"
                            title="Remove Logo"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          className="w-full py-4 border-2 border-dashed border-border/80 hover:border-indigo-500 rounded-xl text-center text-xs text-muted-foreground hover:text-indigo-600 cursor-pointer flex flex-col items-center justify-center gap-1.5 transition-colors"
                        >
                          <Upload className="h-4 w-4" />
                          <span>Upload Business Logo</span>
                          <span className="text-[9px] text-muted-foreground/70">Compressed automatically &lt; 150KB</span>
                        </button>
                      )}
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          handleImageFile(e, (dataUrl) =>
                            setCustomizerConfig((prev) => ({
                              ...prev,
                              business: { ...prev.business, logoUrl: dataUrl, showLogo: true },
                            }))
                          )
                        }
                        className="hidden"
                      />

                      {/* Logo Height Slider */}
                      <div className="pt-2">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground mb-1">
                          <span>Logo Height</span>
                          <span>{customizerConfig.business.logoHeight}px</span>
                        </div>
                        <input
                          type="range"
                          min={24}
                          max={96}
                          step={4}
                          value={customizerConfig.business.logoHeight}
                          onChange={(e) =>
                            setCustomizerConfig((prev) => ({
                              ...prev,
                              business: { ...prev.business, logoHeight: Number(e.target.value) },
                            }))
                          }
                          className="w-full accent-indigo-600 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-2 p-3 bg-muted/20 rounded-xl border border-border/60">
                      <label className="text-xs font-bold text-foreground block">Company Legal Name</label>
                      <input
                        type="text"
                        value={customizerConfig.business.companyName}
                        onChange={(e) =>
                          setCustomizerConfig((prev) => ({
                            ...prev,
                            business: { ...prev.business, companyName: e.target.value },
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-border/70 bg-card text-xs font-bold"
                        placeholder="Company Name"
                      />

                      <label className="text-xs font-bold text-foreground block pt-2">Address</label>
                      <textarea
                        rows={2}
                        value={customizerConfig.business.address}
                        onChange={(e) =>
                          setCustomizerConfig((prev) => ({
                            ...prev,
                            business: { ...prev.business, address: e.target.value },
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-border/70 bg-card text-xs"
                        placeholder="Business Address"
                      />

                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Phone</label>
                          <input
                            type="text"
                            value={customizerConfig.business.phone}
                            onChange={(e) =>
                              setCustomizerConfig((prev) => ({
                                ...prev,
                                business: { ...prev.business, phone: e.target.value },
                              }))
                            }
                            className="w-full px-2 py-1 rounded border border-border/70 bg-card text-xs"
                            placeholder="+91 98765 43210"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground block mb-1">GSTIN</label>
                          <input
                            type="text"
                            value={customizerConfig.business.gstin}
                            onChange={(e) =>
                              setCustomizerConfig((prev) => ({
                                ...prev,
                                business: { ...prev.business, gstin: e.target.value },
                              }))
                            }
                            className="w-full px-2 py-1 rounded border border-border/70 bg-card text-xs font-mono uppercase"
                            placeholder="37AABCCH694G1Z4"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── INVOICE DETAILS CATEGORY ─── */}
            {activeCategory === "invoice" && (
              <div className="space-y-4">
                {activeSubTab === "text" ? (
                  <div className="space-y-3">
                    <div className="space-y-2 p-3 bg-muted/20 rounded-xl border border-border/60">
                      <label className="text-xs font-bold text-foreground block">Document Header Title</label>
                      <input
                        type="text"
                        value={customizerConfig.invoice.documentTitle}
                        onChange={(e) =>
                          setCustomizerConfig((prev) => ({
                            ...prev,
                            invoice: { ...prev.invoice, documentTitle: e.target.value },
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-border/70 bg-card text-xs font-bold"
                        placeholder="e.g. TAX INVOICE, QUOTATION"
                      />

                      <div className="p-2.5 rounded-lg border border-indigo-200/60 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2 mt-2">
                        <div className="flex items-center justify-between text-[11px] font-bold text-indigo-900 dark:text-indigo-300">
                          <span>Prefix &amp; Sequential Proceeding</span>
                          <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-indigo-200">
                            {activeInvoiceData?.invoice_number || "INV-0001"}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground block mb-0.5">Prefix</label>
                            <input
                              type="text"
                              value={
                                customizerConfig.docCategory === "challan"
                                  ? (loadStoredInvoiceSettings().challanPrefix || "DC-")
                                  : customizerConfig.docCategory === "quotation"
                                  ? (loadStoredInvoiceSettings().quotationPrefix || "QT-")
                                  : customizerConfig.docCategory === "proforma"
                                  ? (loadStoredInvoiceSettings().proformaPrefix || "PI-")
                                  : (loadStoredInvoiceSettings().prefix || "INV-")
                              }
                              onChange={(e) => {
                                const val = e.target.value.toUpperCase();
                                const s = loadStoredInvoiceSettings();
                                const cat = customizerConfig.docCategory;
                                const updated = {
                                  ...s,
                                  ...(cat === "challan" ? { challanPrefix: val } : {}),
                                  ...(cat === "quotation" ? { quotationPrefix: val } : {}),
                                  ...(cat === "proforma" ? { proformaPrefix: val } : {}),
                                  ...(cat !== "challan" && cat !== "quotation" && cat !== "proforma" ? { prefix: val } : {}),
                                };
                                saveStoredInvoiceSettings(updated);
                                setCustomizerConfig((prev) => ({ ...prev }));
                              }}
                              className="w-full px-2 py-1 rounded border border-border/70 bg-card text-xs font-mono font-bold"
                              placeholder="INV-"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground block mb-0.5">Next Sequence</label>
                            <input
                              type="number"
                              min="1"
                              value={
                                customizerConfig.docCategory === "challan"
                                  ? (loadStoredInvoiceSettings().challanSequenceNumber || 1)
                                  : customizerConfig.docCategory === "quotation"
                                  ? (loadStoredInvoiceSettings().quotationSequenceNumber || 1)
                                  : customizerConfig.docCategory === "proforma"
                                  ? (loadStoredInvoiceSettings().proformaSequenceNumber || 1)
                                  : (loadStoredInvoiceSettings().sequenceNumber || 1)
                              }
                              onChange={(e) => {
                                const num = Math.max(1, parseInt(e.target.value) || 1);
                                const s = loadStoredInvoiceSettings();
                                const cat = customizerConfig.docCategory;
                                const updated = {
                                  ...s,
                                  ...(cat === "challan" ? { challanSequenceNumber: num } : {}),
                                  ...(cat === "quotation" ? { quotationSequenceNumber: num } : {}),
                                  ...(cat === "proforma" ? { proformaSequenceNumber: num } : {}),
                                  ...(cat !== "challan" && cat !== "quotation" && cat !== "proforma" ? { sequenceNumber: num } : {}),
                                };
                                saveStoredInvoiceSettings(updated);
                                setCustomizerConfig((prev) => ({ ...prev }));
                              }}
                              className="w-full px-2 py-1 rounded border border-border/70 bg-card text-xs font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground block mb-0.5">Padding</label>
                            <select
                              value={
                                customizerConfig.docCategory === "challan"
                                  ? (loadStoredInvoiceSettings().challanPadding ?? 4)
                                  : customizerConfig.docCategory === "quotation"
                                  ? (loadStoredInvoiceSettings().quotationPadding ?? 4)
                                  : customizerConfig.docCategory === "proforma"
                                  ? (loadStoredInvoiceSettings().proformaPadding ?? 4)
                                  : (loadStoredInvoiceSettings().padding ?? 4)
                              }
                              onChange={(e) => {
                                const pad = parseInt(e.target.value, 10) || 4;
                                const s = loadStoredInvoiceSettings();
                                const cat = customizerConfig.docCategory;
                                const updated = {
                                  ...s,
                                  ...(cat === "challan" ? { challanPadding: pad } : {}),
                                  ...(cat === "quotation" ? { quotationPadding: pad } : {}),
                                  ...(cat === "proforma" ? { proformaPadding: pad } : {}),
                                  ...(cat !== "challan" && cat !== "quotation" && cat !== "proforma" ? { padding: pad } : {}),
                                };
                                saveStoredInvoiceSettings(updated);
                                setCustomizerConfig((prev) => ({ ...prev }));
                              }}
                              className="w-full px-1.5 py-1 rounded border border-border/70 bg-card text-xs"
                            >
                              <option value={3}>3 Digits</option>
                              <option value={4}>4 Digits</option>
                              <option value={5}>5 Digits</option>
                              <option value={6}>6 Digits</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Invoice No Label</label>
                          <input
                            type="text"
                            value={customizerConfig.invoice.invoiceNumberLabel}
                            onChange={(e) =>
                              setCustomizerConfig((prev) => ({
                                ...prev,
                                invoice: { ...prev.invoice, invoiceNumberLabel: e.target.value },
                              }))
                            }
                            className="w-full px-2 py-1 rounded border border-border/70 bg-card text-xs"
                            placeholder="Invoice No"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Date Label</label>
                          <input
                            type="text"
                            value={customizerConfig.invoice.invoiceDateLabel}
                            onChange={(e) =>
                              setCustomizerConfig((prev) => ({
                                ...prev,
                                invoice: { ...prev.invoice, invoiceDateLabel: e.target.value },
                              }))
                            }
                            className="w-full px-2 py-1 rounded border border-border/70 bg-card text-xs"
                            placeholder="Invoice Date"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-2 p-3 bg-muted/20 rounded-xl border border-border/60">
                      <span className="text-xs font-bold text-foreground block">Metadata Visibility Switches</span>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {[
                          { key: "showInvoiceNumber", label: "Invoice Number" },
                          { key: "showInvoiceDate", label: "Invoice Date" },
                          { key: "showDueDate", label: "Due Date" },
                          { key: "showPoNumber", label: "PO Reference" },
                          { key: "showEwayBill", label: "e-Way Bill" },
                          { key: "showVehicleNumber", label: "Vehicle Number" },
                          { key: "showChallanNumber", label: "Challan No" },
                          { key: "showPlaceOfSupply", label: "Place of Supply" },
                        ].map((item) => (
                          <label key={item.key} className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={(customizerConfig.invoice as any)[item.key]}
                              onChange={(e) =>
                                setCustomizerConfig((prev) => ({
                                  ...prev,
                                  invoice: { ...prev.invoice, [item.key]: e.target.checked },
                                }))
                              }
                              className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="truncate">{item.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── MISCELLANEOUS CATEGORY ─── */}
            {activeCategory === "miscellaneous" && (
              <div className="space-y-4">
                {activeSubTab === "styling" ? (
                  <div className="space-y-4">
                    {/* UPI Payment QR */}
                    <div className="space-y-2 p-3 bg-muted/20 rounded-xl border border-border/60">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">UPI Payment QR</span>
                        <input
                          type="checkbox"
                          checked={customizerConfig.miscellaneous.paymentQr.enabled}
                          onChange={(e) =>
                            setCustomizerConfig((prev) => ({
                              ...prev,
                              miscellaneous: {
                                ...prev.miscellaneous,
                                paymentQr: { ...prev.miscellaneous.paymentQr, enabled: e.target.checked },
                              },
                            }))
                          }
                          className="rounded border-border text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                        />
                      </div>

                      {customizerConfig.miscellaneous.paymentQr.enabled && (
                        <div className="pt-2 space-y-2">
                          <div>
                            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">UPI VPA / ID</label>
                            <input
                              type="text"
                              value={customizerConfig.miscellaneous.paymentQr.upiId}
                              onChange={(e) =>
                                setCustomizerConfig((prev) => ({
                                  ...prev,
                                  miscellaneous: {
                                    ...prev.miscellaneous,
                                    paymentQr: { ...prev.miscellaneous.paymentQr, upiId: e.target.value },
                                  },
                                }))
                              }
                              className="w-full px-2 py-1.5 rounded border border-border/70 bg-card text-xs font-mono"
                              placeholder="e.g. vasavi@okhdfcbank"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Authorized Signature & Stamp */}
                    <div className="space-y-2 p-3 bg-muted/20 rounded-xl border border-border/60">
                      <span className="text-xs font-bold text-foreground block">Signatures & Company Stamp</span>
                      <div className="grid grid-cols-2 gap-2">
                        {/* Signature */}
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-semibold mb-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={customizerConfig.miscellaneous.signatureAndStamp.showSignature}
                              onChange={(e) =>
                                setCustomizerConfig((prev) => ({
                                  ...prev,
                                  miscellaneous: {
                                    ...prev.miscellaneous,
                                    signatureAndStamp: {
                                      ...prev.miscellaneous.signatureAndStamp,
                                      showSignature: e.target.checked,
                                    },
                                  },
                                }))
                              }
                              className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>Signature</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => signatureInputRef.current?.click()}
                            className="w-full py-2 border border-dashed border-border/80 hover:border-indigo-500 rounded-lg text-center text-[10px] text-muted-foreground cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Upload className="h-3 w-3" />
                            {customizerConfig.miscellaneous.signatureAndStamp.signatureUrl ? "Replace Sig" : "Upload Sig"}
                          </button>
                          <input
                            ref={signatureInputRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              handleImageFile(e, (dataUrl) =>
                                setCustomizerConfig((prev) => ({
                                  ...prev,
                                  miscellaneous: {
                                    ...prev.miscellaneous,
                                    signatureAndStamp: {
                                      ...prev.miscellaneous.signatureAndStamp,
                                      signatureUrl: dataUrl,
                                      showSignature: true,
                                    },
                                  },
                                }))
                              )
                            }
                            className="hidden"
                          />
                        </div>

                        {/* Stamp */}
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-semibold mb-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={customizerConfig.miscellaneous.signatureAndStamp.showStamp}
                              onChange={(e) =>
                                setCustomizerConfig((prev) => ({
                                  ...prev,
                                  miscellaneous: {
                                    ...prev.miscellaneous,
                                    signatureAndStamp: {
                                      ...prev.miscellaneous.signatureAndStamp,
                                      showStamp: e.target.checked,
                                    },
                                  },
                                }))
                              }
                              className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>Stamp Seal</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => stampInputRef.current?.click()}
                            className="w-full py-2 border border-dashed border-border/80 hover:border-indigo-500 rounded-lg text-center text-[10px] text-muted-foreground cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Upload className="h-3 w-3" />
                            {customizerConfig.miscellaneous.signatureAndStamp.stampUrl ? "Replace Stamp" : "Upload Stamp"}
                          </button>
                          <input
                            ref={stampInputRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              handleImageFile(e, (dataUrl) =>
                                setCustomizerConfig((prev) => ({
                                  ...prev,
                                  miscellaneous: {
                                    ...prev.miscellaneous,
                                    signatureAndStamp: {
                                      ...prev.miscellaneous.signatureAndStamp,
                                      stampUrl: dataUrl,
                                      showStamp: true,
                                    },
                                  },
                                }))
                              )
                            }
                            className="hidden"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Bank Details */}
                    <div className="space-y-2 p-3 bg-muted/20 rounded-xl border border-border/60">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">Bank Account Details</span>
                        <input
                          type="checkbox"
                          checked={customizerConfig.miscellaneous.bankDetails.enabled}
                          onChange={(e) =>
                            setCustomizerConfig((prev) => ({
                              ...prev,
                              miscellaneous: {
                                ...prev.miscellaneous,
                                bankDetails: { ...prev.miscellaneous.bankDetails, enabled: e.target.checked },
                              },
                            }))
                          }
                          className="rounded border-border text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                        />
                      </div>

                      {customizerConfig.miscellaneous.bankDetails.enabled && (
                        <div className="pt-2 space-y-2">
                          <input
                            type="text"
                            value={customizerConfig.miscellaneous.bankDetails.bankName}
                            onChange={(e) =>
                              setCustomizerConfig((prev) => ({
                                ...prev,
                                miscellaneous: {
                                  ...prev.miscellaneous,
                                  bankDetails: { ...prev.miscellaneous.bankDetails, bankName: e.target.value },
                                },
                              }))
                            }
                            className="w-full px-2 py-1 rounded border border-border/70 bg-card text-xs"
                            placeholder="Bank Name (e.g. HDFC Bank Ltd)"
                          />
                          <input
                            type="text"
                            value={customizerConfig.miscellaneous.bankDetails.accountNumber}
                            onChange={(e) =>
                              setCustomizerConfig((prev) => ({
                                ...prev,
                                miscellaneous: {
                                  ...prev.miscellaneous,
                                  bankDetails: { ...prev.miscellaneous.bankDetails, accountNumber: e.target.value },
                                },
                              }))
                            }
                            className="w-full px-2 py-1 rounded border border-border/70 bg-card text-xs font-mono"
                            placeholder="Account Number"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={customizerConfig.miscellaneous.bankDetails.ifscCode}
                              onChange={(e) =>
                                setCustomizerConfig((prev) => ({
                                  ...prev,
                                  miscellaneous: {
                                    ...prev.miscellaneous,
                                    bankDetails: { ...prev.miscellaneous.bankDetails, ifscCode: e.target.value },
                                  },
                                }))
                              }
                              className="w-full px-2 py-1 rounded border border-border/70 bg-card text-xs font-mono uppercase"
                              placeholder="IFSC Code"
                            />
                            <input
                              type="text"
                              value={customizerConfig.miscellaneous.bankDetails.branch}
                              onChange={(e) =>
                                setCustomizerConfig((prev) => ({
                                  ...prev,
                                  miscellaneous: {
                                    ...prev.miscellaneous,
                                    bankDetails: { ...prev.miscellaneous.bankDetails, branch: e.target.value },
                                  },
                                }))
                              }
                              className="w-full px-2 py-1 rounded border border-border/70 bg-card text-xs"
                              placeholder="Branch Locality"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Terms & Conditions */}
                    <div className="space-y-2 p-3 bg-muted/20 rounded-xl border border-border/60">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">Terms & Conditions</span>
                        <input
                          type="checkbox"
                          checked={customizerConfig.miscellaneous.termsAndConditions.enabled}
                          onChange={(e) =>
                            setCustomizerConfig((prev) => ({
                              ...prev,
                              miscellaneous: {
                                ...prev.miscellaneous,
                                termsAndConditions: {
                                  ...prev.miscellaneous.termsAndConditions,
                                  enabled: e.target.checked,
                                },
                              },
                            }))
                          }
                          className="rounded border-border text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                        />
                      </div>
                      {customizerConfig.miscellaneous.termsAndConditions.enabled && (
                        <textarea
                          rows={3}
                          value={customizerConfig.miscellaneous.termsAndConditions.text}
                          onChange={(e) =>
                            setCustomizerConfig((prev) => ({
                              ...prev,
                              miscellaneous: {
                                ...prev.miscellaneous,
                                termsAndConditions: {
                                  ...prev.miscellaneous.termsAndConditions,
                                  text: e.target.value,
                                },
                              },
                            }))
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-border/70 bg-card text-xs"
                          placeholder="1. Goods once sold will not be taken back..."
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sticky Bottom Action Bar with prominent Save Template button */}
          <div className="p-3 border-t border-border/80 bg-card/95 shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="flex-1 py-2 px-3 rounded-xl border border-border/80 bg-background hover:bg-muted text-xs font-bold text-muted-foreground hover:text-foreground transition-all cursor-pointer text-center"
            >
              Reset Defaults
            </button>
            <button
              type="button"
              onClick={handleSaveTemplate}
              disabled={isSaving}
              className="flex-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md shadow-indigo-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save Template"}
            </button>
          </div>
        </aside>
      </div>

      {/* ─── Modal: Add Custom Column ─── */}
      {isAddColumnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <h3 className="text-sm font-black text-foreground">Add Custom Column</h3>
              <button
                type="button"
                onClick={() => setIsAddColumnModalOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Column Key / ID</label>
                <input
                  type="text"
                  value={newCustomColumnName}
                  onChange={(e) => setNewCustomColumnName(e.target.value)}
                  placeholder="e.g. warranty_period"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-border/70 bg-card text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Header Display Title</label>
                <input
                  type="text"
                  value={newCustomColumnHeader}
                  onChange={(e) => setNewCustomColumnHeader(e.target.value)}
                  placeholder="e.g. Warranty"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-border/70 bg-card text-xs font-bold"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => setIsAddColumnModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-border/70 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddCustomColumn}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer shadow-xs"
              >
                Add Column
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedInvoiceCustomizer;
