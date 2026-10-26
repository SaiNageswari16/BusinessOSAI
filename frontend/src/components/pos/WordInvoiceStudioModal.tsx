import React, { useState, useEffect, useRef } from "react";
import { useI18n } from "@/contexts/i18n-context";
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
  setActiveInvoicePrintTemplate,
  type ActiveGstDetails,
} from "@/lib/receipt-template-store";
import { printTemplatesApi, invoicesApi } from "@/lib/api-client";

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
  headerStyle: "modern_banner" | "classic_split" | "minimal" | "centered_letterhead" | "swiss_grid" | "tokyo_precision";
  tableBorderStyle: "subtle" | "strong" | "double" | "minimal";
  paperBgColor: string;
  watermarkText: string;
  watermarkOpacity: number;
  invoiceTitle: string;
  logoUrl?: string;
  companyName: string;
  companyTagline?: string;
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
  { id: "col_sno", fieldKey: "sno", headerTitle: "S.No", widthPercent: 5, align: "center", enabled: true },
  { id: "col_desc", fieldKey: "description", headerTitle: "Item Description & Notes", widthPercent: 27, align: "left", enabled: true },
  { id: "col_hsn", fieldKey: "hsn", headerTitle: "HSN / SAC", widthPercent: 10, align: "center", enabled: true },
  { id: "col_qty", fieldKey: "quantity", headerTitle: "Qty", widthPercent: 7, align: "center", enabled: true },
  { id: "col_mrp", fieldKey: "mrp", headerTitle: "MRP (₹)", widthPercent: 9, align: "right", enabled: true },
  { id: "col_selling", fieldKey: "selling_price", headerTitle: "Sell Price (₹)", widthPercent: 9, align: "right", enabled: true },
  { id: "col_rate", fieldKey: "unit_price", headerTitle: "Rate (₹)", widthPercent: 9, align: "right", enabled: true },
  { id: "col_disc", fieldKey: "discount", headerTitle: "Disc %", widthPercent: 7, align: "center", enabled: true },
  { id: "col_tax", fieldKey: "tax_rate", headerTitle: "GST %", widthPercent: 7, align: "center", enabled: true },
  { id: "col_amt", fieldKey: "total_amount", headerTitle: "Amount (₹)", widthPercent: 10, align: "right", enabled: true },
];

export const PROCUREMENT_WORD_COLUMNS: WordStudioColumnConfig[] = [
  { id: "col_sno", fieldKey: "sno", headerTitle: "#", widthPercent: 4, align: "center", enabled: true },
  { id: "col_desc", fieldKey: "description", headerTitle: "ITEMS / SERVICES", widthPercent: 22, align: "left", enabled: true },
  { id: "col_hsn", fieldKey: "hsn", headerTitle: "HSN/SAC", widthPercent: 8, align: "center", enabled: true },
  { id: "col_uom", fieldKey: "uom", headerTitle: "UOM", widthPercent: 6, align: "center", enabled: true },
  { id: "col_exp", fieldKey: "expiry_date", headerTitle: "EXP DATE", widthPercent: 9, align: "center", enabled: true },
  { id: "col_mrp", fieldKey: "mrp", headerTitle: "MRP (₹)", widthPercent: 7, align: "right", enabled: true },
  { id: "col_selling", fieldKey: "selling_price", headerTitle: "SELL PRICE (₹)", widthPercent: 8, align: "right", enabled: true },
  { id: "col_qty", fieldKey: "quantity", headerTitle: "QTY", widthPercent: 6, align: "center", enabled: true },
  { id: "col_rate", fieldKey: "unit_price", headerTitle: "PRICE/ITEM (₹)", widthPercent: 10, align: "right", enabled: true },
  { id: "col_disc", fieldKey: "discount", headerTitle: "DISCOUNT", widthPercent: 7, align: "right", enabled: true },
  { id: "col_tax", fieldKey: "tax_rate", headerTitle: "GST TAX %", widthPercent: 6, align: "right", enabled: true },
  { id: "col_amt", fieldKey: "total_amount", headerTitle: "AMOUNT (₹)", widthPercent: 7, align: "right", enabled: true },
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
  { label: "PO Reference", value: "PO-2026-9921" },
  { label: "Vehicle No", value: "TS 09 EA 4412" },
  { label: "E-Way Bill No", value: "241098234190" },
  { label: "Challan No", value: "DC-0045" },
  { label: "Challan Date", value: "25-Sep-2026" },
  { label: "Dispatch Through", value: "Surface Cargo / Road Transport" },
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
  onSave?: () => void;
  initialTemplate?: any;
  startBlank?: boolean;
  logoUrl?: string;
  storeName?: string;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
}

export function WordInvoiceStudioModal({
  isOpen,
  onClose,
  onSaved,
  onSave,
  initialTemplate,
  startBlank = false,
  logoUrl: propLogoUrl,
  storeName: propStoreName,
  address: propAddress,
  phone: propPhone,
  email: propEmail,
  gstin: propGstin,
}: WordInvoiceStudioModalProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<"visual_canvas" | "smart_suggestions" | "columns" | "custom_fields" | "signature_stamp" | "typography">(startBlank ? "smart_suggestions" : "visual_canvas");
  const [canvasZoom, setCanvasZoom] = useState<number>(100);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [quickAddSection, setQuickAddSection] = useState<"meta" | "party" | "footer">("meta");

  const tenantId = getTenantIdFromStorage();
  const activeGst = getActiveBillingGst(tenantId);
  const activeSig = getOrgSignatureSettings(tenantId);
  const activeQr = getOrgPaymentQrSettings(tenantId);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  // Helper function to build initial config matching Live Preview
  const buildInitialWordConfig = (
    template: any,
    blank: boolean,
    gstDetails: any,
    sigDetails: any,
    lUrl?: string,
    sName?: string,
    sAddr?: string,
    sPh?: string,
    sEm?: string,
    sGst?: string
  ): WordInvoiceTemplateConfig => {
    const resolvedLogo =
      template?.wordConfig?.logoUrl ||
      template?.logoUrl ||
      lUrl ||
      gstDetails?.logo_url ||
      "/Logo.png";

    const isDummyName = (n?: string) => !n || n.toLowerCase().includes('venatic') || n.toLowerCase().includes('head office') || n.toLowerCase() === 'company';
    const isDummyAddr = (a?: string) => !a || a.toLowerCase().includes('cauvery block') || a.toLowerCase().includes('national games village');
    const isDummyGst = (g?: string) => !g || g.includes('29AAACH7489R1ZX') || g.includes('36AAFCG6041L1Z');

    const resolvedName =
      (sName && !isDummyName(sName) ? sName : '') ||
      (gstDetails?.trade_name && !isDummyName(gstDetails.trade_name) ? gstDetails.trade_name : '') ||
      (gstDetails?.legal_name && !isDummyName(gstDetails.legal_name) ? gstDetails.legal_name : '') ||
      (!isDummyName(template?.wordConfig?.companyName) ? template?.wordConfig?.companyName : '') ||
      (!isDummyName(template?.companyName) ? template?.companyName : '') ||
      (!isDummyName(template?.storeName) ? template?.storeName : '') ||
      sName || "Organization";

    const resolvedTagline =
      template?.wordConfig?.companyTagline ||
      template?.companyTagline ||
      "";

    const resolvedAddress =
      (sAddr && !isDummyAddr(sAddr) ? sAddr : '') ||
      (gstDetails?.address && !isDummyAddr(gstDetails.address) ? gstDetails.address : '') ||
      (!isDummyAddr(template?.wordConfig?.companyAddress) ? template?.wordConfig?.companyAddress : '') ||
      (!isDummyAddr(template?.companyAddress) ? template?.companyAddress : '') ||
      (!isDummyAddr(template?.storeAddress) ? template?.storeAddress : '') ||
      sAddr || "";

    const resolvedPhone =
      (sPh && !sPh.includes('98765 43210') ? sPh : '') ||
      (gstDetails?.phone && !gstDetails.phone.includes('98765 43210') ? gstDetails.phone : '') ||
      (template?.wordConfig?.companyPhone && !template.wordConfig.companyPhone.includes('98765 43210') ? template.wordConfig.companyPhone : '') ||
      sPh || "";

    const resolvedEmail =
      (sEm && !sEm.includes('venatic.com') ? sEm : '') ||
      (gstDetails?.email && !gstDetails.email.includes('venatic.com') ? gstDetails.email : '') ||
      (template?.wordConfig?.companyEmail && !template.wordConfig.companyEmail.includes('venatic.com') ? template.wordConfig.companyEmail : '') ||
      sEm || "";

    const resolvedGstin =
      (sGst && !isDummyGst(sGst) ? sGst : '') ||
      (gstDetails?.gstin && !isDummyGst(gstDetails.gstin) ? gstDetails.gstin : '') ||
      (!isDummyGst(template?.wordConfig?.companyGstin) ? template?.wordConfig?.companyGstin : '') ||
      (!isDummyGst(template?.companyGstin) ? template?.companyGstin : '') ||
      (!isDummyGst(template?.gstin) ? template?.gstin : '') ||
      sGst || "";

    if (blank) {
      return {
        id: `tpl-word-blank-${Date.now()}`,
        name: "My Blank Canvas Document",
        category: "invoices",
        isDefault: true,
        fontFamily: "Inter, sans-serif",
        fontSizePt: 9.5,
        primaryColor: "#0f172a",
        headerStyle: "classic_split",
        tableBorderStyle: "subtle",
        paperBgColor: "#ffffff",
        watermarkText: "",
        watermarkOpacity: 0.08,
        invoiceTitle: "TAX INVOICE",
        logoUrl: resolvedLogo,
        companyName: resolvedName,
        companyTagline: resolvedTagline,
        companyAddress: resolvedAddress,
        companyPhone: resolvedPhone,
        companyEmail: resolvedEmail,
        companyGstin: resolvedGstin,
        companyPan: gstDetails?.pan || "AAACA1234A",
        customerTitle: "BILLED TO (CUSTOMER):",
        customerName: "",
        customerAddress: "",
        customerGstin: "",
        customerPhone: "",
        shippingTitle: "SHIPPED TO (DELIVERY):",
        shippingName: "",
        shippingAddress: "",
        invoiceNumberLabel: "INVOICE NO:",
        invoiceNumberValue: "INV-2026-0009",
        invoiceDateLabel: "INVOICE DATE:",
        invoiceDateValue: "11/10/2026",
        dueDateLabel: "DUE DATE:",
        dueDateValue: "18/10/2026",
        placeOfSupplyLabel: "PLACE OF SUPPLY:",
        placeOfSupplyValue: "36 - Telangana",
        sections: DEFAULT_WORD_SECTIONS.map((s) => ({ ...s, enabled: false })),
        columns: DEFAULT_WORD_COLUMNS,
        customFields: [],
        signatureConfig: {
          signatureUrl: sigDetails.signatureUrl || null,
          stampUrl: sigDetails.stampUrl || null,
          title: sigDetails.signatureTitle || "Authorized Signatory",
          companyName: sigDetails.signatureCompanyName || `For ${resolvedName}`,
          showSignature: sigDetails.showDigitalSignature ?? true,
          showStamp: sigDetails.showDigitalStamp ?? true,
          alignment: sigDetails.signatureAlignment || "right",
        },
        termsText: gstDetails?.terms_and_conditions || "1. Goods once sold will not be taken back without valid receipt.\n2. Interest @ 18% p.a. will be levied on overdue payments.\n3. All disputes subject to local jurisdiction.",
        footerNote: "THANK YOU FOR YOUR VALUED BUSINESS!",
        showBankDetails: true,
        showPaymentQr: true,
        showTaxBreakdown: true,
        showAmountInWords: true,
        createdAt: new Date().toISOString(),
      };
    }

    const src = template?.wordConfig || template;
    const tplId = template?.id || "";
    const defaultHeaderStyle =
      src?.headerStyle ||
      (tplId.includes("zurich") ? "swiss_grid" :
       tplId.includes("tokyo") ? "tokyo_precision" :
       tplId.includes("singapore") ? "modern_banner" :
       tplId.includes("nordic") ? "minimal" :
       tplId.includes("luxury") || tplId.includes("letterhead") ? "centered_letterhead" :
       "classic_split");

    const defaultPrimaryColor =
      src?.primaryColor ||
      template?.primaryColor ||
      (tplId.includes("zurich") ? "#dc2626" :
       tplId.includes("tokyo") ? "#1e1b4b" :
       tplId.includes("singapore") ? "#0284c7" :
       tplId.includes("nordic") ? "#334155" :
       tplId.includes("emerald") ? "#059669" :
       tplId.includes("luxury") ? "#d97706" :
       "#0f172a");

    return {
      id: src?.id || template?.id || `tpl-word-${Date.now()}`,
      name: src?.name || template?.name || "Custom Word-Designed Invoice",
      category: "invoices",
      isDefault: src?.isDefault ?? template?.isDefault ?? true,
      fontFamily: src?.fontFamily || template?.fontFamily || "Inter, sans-serif",
      fontSizePt: src?.fontSizePt || (template?.fontSize ? parseFloat(template.fontSize) : 9.5) || 9.5,
      primaryColor: defaultPrimaryColor,
      headerStyle: defaultHeaderStyle,
      tableBorderStyle: src?.tableBorderStyle || "subtle",
      paperBgColor: src?.paperBgColor || template?.paperBgColor || "#ffffff",
      watermarkText: src?.watermarkText || template?.watermarkText || "",
      watermarkOpacity: src?.watermarkOpacity || (template?.watermarkOpacity ? template.watermarkOpacity / 100 : 0.08),
      invoiceTitle: src?.invoiceTitle || src?.headerTitle || template?.headerTitle || "TAX INVOICE",
      logoUrl: resolvedLogo,
      companyName: resolvedName,
      companyTagline: resolvedTagline,
      companyAddress: resolvedAddress,
      companyPhone: resolvedPhone,
      companyEmail: resolvedEmail,
      companyGstin: resolvedGstin,
      companyPan: src?.companyPan || gstDetails?.pan || "AAACA1234A",
      customerTitle: src?.customerTitle || "BILLED TO (CUSTOMER):",
      customerName: src?.customerName || "",
      customerAddress: src?.customerAddress || "",
      customerGstin: src?.customerGstin || "",
      customerPhone: src?.customerPhone || "",
      shippingTitle: src?.shippingTitle || "SHIPPED TO (DELIVERY):",
      shippingName: src?.shippingName || "",
      shippingAddress: src?.shippingAddress || "",
      invoiceNumberLabel: src?.invoiceNumberLabel || "INVOICE NO:",
      invoiceNumberValue: src?.invoiceNumberValue || "INV-2026-0009",
      invoiceDateLabel: src?.invoiceDateLabel || "INVOICE DATE:",
      invoiceDateValue: src?.invoiceDateValue || "11/10/2026",
      dueDateLabel: src?.dueDateLabel || "DUE DATE:",
      dueDateValue: src?.dueDateValue || "18/10/2026",
      placeOfSupplyLabel: src?.placeOfSupplyLabel || "PLACE OF SUPPLY:",
      placeOfSupplyValue: src?.placeOfSupplyValue || "36 - Telangana",
      sections: src?.sections && Array.isArray(src.sections) && src.sections.length > 0 ? src.sections : DEFAULT_WORD_SECTIONS,
      columns: src?.columns && Array.isArray(src.columns) && src.columns.length > 0
        ? src.columns
        : template?.columns && Array.isArray(template.columns) && template.columns.length > 0
        ? template.columns
        : template?.wordConfig?.columns && Array.isArray(template.wordConfig.columns) && template.wordConfig.columns.length > 0
        ? template.wordConfig.columns
        : DEFAULT_WORD_COLUMNS,
      customFields:
        (src?.customFields && Array.isArray(src.customFields) && src.customFields.length > 0)
          ? src.customFields
          : (template?.customFields && Array.isArray(template.customFields) && template.customFields.length > 0)
          ? template.customFields
          : (template?.metadata?.customFields && Array.isArray(template.metadata.customFields) && template.metadata.customFields.length > 0)
          ? template.metadata.customFields
          : [
              { id: "cf_po", label: "PO Reference", value: "PO-2026-9921", enabled: true, section: "meta" },
              { id: "cf_veh", label: "Vehicle No", value: "TS 09 EA 4412", enabled: true, section: "meta" },
              { id: "cf_eway", label: "E-Way Bill No", value: "241098234190", enabled: true, section: "meta" },
              { id: "cf_challan", label: "Challan No", value: "DC-0045", enabled: true, section: "meta" },
            ],
      signatureConfig: {
        signatureUrl: src?.signatureConfig?.signatureUrl !== undefined ? src?.signatureConfig?.signatureUrl : (sigDetails.signatureUrl || null),
        stampUrl: src?.signatureConfig?.stampUrl !== undefined ? src?.signatureConfig?.stampUrl : (sigDetails.stampUrl || null),
        title: src?.signatureConfig?.title || sigDetails.signatureTitle || "Authorized Signatory",
        companyName: src?.signatureConfig?.companyName || sigDetails.signatureCompanyName || `For ${resolvedName}`,
        showSignature: src?.signatureConfig?.showSignature ?? sigDetails.showDigitalSignature ?? true,
        showStamp: src?.signatureConfig?.showStamp ?? sigDetails.showDigitalStamp ?? true,
        alignment: src?.signatureConfig?.alignment || sigDetails.signatureAlignment || "right",
      },
      termsText: src?.termsText || template?.termsText || template?.termsAndConditionsText || gstDetails?.terms_and_conditions || "1. Goods once sold will not be taken back without valid receipt.\n2. Interest @ 18% p.a. will be levied on overdue payments.\n3. All disputes subject to local jurisdiction.",
      footerNote: src?.footerNote || src?.footerText || template?.thankYouNote || template?.footerText || "THANK YOU FOR YOUR VALUED BUSINESS!",
      showBankDetails: src?.showBankDetails ?? true,
      showPaymentQr: src?.showPaymentQr ?? true,
      showTaxBreakdown: src?.showTaxBreakdown ?? true,
      showAmountInWords: src?.showAmountInWords ?? true,
      createdAt: src?.createdAt || new Date().toISOString(),
    };
  };

  // Template Master Config State
  const [config, setConfig] = useState<WordInvoiceTemplateConfig>(() =>
    buildInitialWordConfig(
      initialTemplate,
      startBlank,
      activeGst,
      activeSig,
      propLogoUrl,
      propStoreName,
      propAddress,
      propPhone,
      propEmail,
      propGstin
    )
  );

  // Re-sync configuration whenever a new initialTemplate is passed or modal opens
  useEffect(() => {
    if (!isOpen) return;
    if (startBlank) {
      setActiveTab("smart_suggestions");
    }
    setConfig(
      buildInitialWordConfig(
        initialTemplate,
        startBlank,
        activeGst,
        activeSig,
        propLogoUrl,
        propStoreName,
        propAddress,
        propPhone,
        propEmail,
        propGstin
      )
    );
  }, [isOpen, initialTemplate?.id, startBlank, propLogoUrl, propStoreName]);

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
      columns: (config.columns || DEFAULT_WORD_COLUMNS).filter((c) => c.id !== id && c.fieldKey !== id),
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
      customFields: (config.customFields || []).filter((f) => f.id !== id),
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
  const handleSave = async () => {
    try {
      const storageKey = getTenantTemplatesKey(tenantId);
      const rawTemplates = localStorage.getItem(storageKey);
      const existingList = rawTemplates ? JSON.parse(rawTemplates) : [];

      const transformedTemplate = {
        ...(initialTemplate || {}),
        id: config.id,
        name: config.name,
        category: "invoices",
        docType: "invoice",
        paperSize: "a4",
        isDefault: config.isDefault,
        wordConfig: config,
        customFields: config.customFields,
        custom_fields: config.customFields,
        logoUrl: config.logoUrl,
        storeName: config.companyName,
        companyName: config.companyName,
        storeAddress: config.companyAddress,
        companyAddress: config.companyAddress,
        storePhone: config.companyPhone,
        companyPhone: config.companyPhone,
        storeEmail: config.companyEmail,
        companyEmail: config.companyEmail,
        gstin: config.companyGstin,
        headerTitle: config.invoiceTitle,
        primaryColor: config.primaryColor,
        fontFamily: config.fontFamily,
        paperBgColor: config.paperBgColor,
        watermarkText: config.watermarkText,
        columns: config.columns || DEFAULT_WORD_COLUMNS,
        customItemColumns: (config.columns || DEFAULT_WORD_COLUMNS)
          .filter((c) => c.isCustom || !DEFAULT_WORD_COLUMNS.some((dc) => dc.id === c.id || dc.fieldKey === c.fieldKey))
          .map((c) => ({
            id: c.id,
            name: c.headerTitle,
            label: c.headerTitle,
            key: c.fieldKey,
            enabled: c.enabled,
          })),
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
          columns: (config.columns || DEFAULT_WORD_COLUMNS).filter((c) => c.enabled).map((c) => ({
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
        nextDefaults.invoice = transformedTemplate.id;
        localStorage.setItem(defaultsKey, JSON.stringify(nextDefaults));
        localStorage.setItem("user_active_print_templates_v1", JSON.stringify(nextDefaults));
        localStorage.setItem(`bos_active_invoice_template_id_${tenantId || 'default'}`, transformedTemplate.id);
        localStorage.setItem('bos_active_invoice_template_id', transformedTemplate.id);
        localStorage.setItem('bos_word_invoice_custom_fields', JSON.stringify(config.customFields));
        setActiveInvoicePrintTemplate(transformedTemplate.id, tenantId);
        invoicesApi.setActivePrintTemplate(transformedTemplate.id).catch(console.warn);
        printTemplatesApi.setActiveTemplate(transformedTemplate.id, "invoices").catch(console.warn);
      }

      // Persist to backend database as well so it is synced across all users and devices in this organization
      try {
        await printTemplatesApi.saveTemplate(transformedTemplate as any, Boolean(config.isDefault));
      } catch (saveErr) {
        console.warn("Backend print template persistence warning:", saveErr);
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
      window.dispatchEvent(new CustomEvent("bos_invoice_template_changed", { detail: { templateId: transformedTemplate.id } }));
      
      toast.success(`Word-Style Invoice Template "${config.name}" saved & applied across organization!`);
      if (onSaved) onSaved(config);
      if (onSave) onSave();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save template.");
    }
  };

  // Sample Live Preview Data matching Production Mock Invoice
  const sampleItems = [
    {
      sno: 1,
      description: "Basmati Rice Royal Premium (Aged 2 Years)",
      custom_note: "Export Quality Double Polished Grain (Batch #R-2021)",
      hsn: "10063020",
      quantity: 5,
      unit: "Bag",
      unit_type: "25kg",
      unit_price: 2450.0,
      discount: 5.0,
      tax_rate: 5,
      total_amount: 12250.0,
      isFree: false,
    },
    {
      sno: 2,
      description: "Organic Cold Pressed Mustard Oil (15L Tin)",
      custom_note: "Kachi Ghani single cold press pure mustard oil",
      hsn: "15141190",
      quantity: 2,
      unit: "Tin",
      unit_type: "15L",
      unit_price: 2150.0,
      discount: 0,
      tax_rate: 5,
      total_amount: 4300.0,
      isFree: false,
    },
    {
      sno: 3,
      description: "Whole Spices Combo Pack (Export Grade)",
      custom_note: "Cardamom 100g, Clove 100g, Cinnamon 200g",
      hsn: "09083100",
      quantity: 10,
      unit: "Pcs",
      unit_type: "Loose",
      unit_price: 560.0,
      discount: 0,
      tax_rate: 12,
      total_amount: 5600.0,
      isFree: false,
    },
    {
      sno: 4,
      description: "Promotional Tasting Sample (Darjeeling Tea 50g)",
      custom_note: "Complimentary promo sample given free with bulk order",
      hsn: "09024020",
      quantity: 2,
      unit: "Pcs",
      unit_type: "Promo",
      unit_price: 0,
      originalRate: 150.0,
      discount: 0,
      tax_rate: 0,
      total_amount: 0,
      isFree: true,
    },
  ];

  const subtotal = 22150.0;
  const cgst = 602.5;
  const sgst = 602.5;
  const taxAmount = 1205.0;
  const grandTotal = 23355.0;
  const totalBilledQty = 19;
  const totalItemsCount = 4;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-200 font-sans">
      {/* Hidden Logo File Input */}
      <input
        ref={logoFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            const url = reader.result as string;
            setConfig((prev) => ({ ...prev, logoUrl: url }));
            toast.success("Document logo uploaded & applied!");
          };
          reader.readAsDataURL(file);
        }}
      />
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-[98vw] h-[96vh] overflow-hidden flex flex-col">
        
        {/* TOP WORD-STYLE RIBBON HEADER */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-6 py-3 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">{t("Visual Word-Style Invoice Designer Studio", "Visual Word-Style Invoice Designer Studio")}</h1>
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/30 text-emerald-200 px-2.5 py-0.5 rounded-full border border-emerald-400/30 flex items-center gap-1">
                  <Sparkles className="size-3 text-emerald-300" /> Click Any Text to Edit Directly
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Complete Microsoft Word freedom: Click on ANY field in the preview to rename, replace, or delete. Add unlimited custom fields.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                setConfig((prev) => ({
                  ...prev,
                  name: prev.name.includes("Blank") ? prev.name : "My Blank Canvas Document",
                  sections: prev.sections.map((s) => ({ ...s, enabled: false })),
                }));
                setActiveTab("smart_suggestions");
                toast.info("Cleared canvas to blank digital document. Select building blocks from the left panel to compose!");
              }}
              title="Clear all sections to start from an empty Word document"
              className="px-3 py-1.5 bg-emerald-500/25 hover:bg-emerald-500/35 text-emerald-200 border border-emerald-400/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <PlusCircle className="size-3.5 text-emerald-300" />
              Blank Canvas
            </button>
            <button
              type="button"
              onClick={() => {
                setConfig((prev) => ({
                  ...prev,
                  fontFamily: "Inter, sans-serif",
                  primaryColor: "#2563eb",
                  headerStyle: "classic_split",
                  tableBorderStyle: "subtle",
                  columns: DEFAULT_WORD_COLUMNS,
                  sections: DEFAULT_WORD_SECTIONS,
                }));
                setActiveTab("visual_canvas");
                toast.info("Restored standard full invoice format");
              }}
              title="Prefill all standard invoice sections"
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="size-3.5" />
              Standard Preset
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
          
          {/* Canvas Zoom Controls */}
          <div className="flex items-center gap-1.5 border-r border-slate-300 pr-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Zoom:</span>
            <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5">
              {[75, 100, 125].map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setCanvasZoom(z)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    canvasZoom === z ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {z}%
                </button>
              ))}
            </div>
          </div>
          
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
              <option value="classic_split">Classic 2-Column Split (Stripe / Standard)</option>
              <option value="modern_banner">Modern Color Banner</option>
              <option value="minimal">Minimal Clean Line (Nordic)</option>
              <option value="swiss_grid">Zurich Swiss International</option>
              <option value="tokyo_precision">Tokyo Precision Technical</option>
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
              <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab("smart_suggestions")}
                  className={`py-1.5 rounded-lg text-[10.5px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    activeTab === "smart_suggestions" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Smart Building Blocks & Suggestions"
                >
                  <Sparkles className="size-3 text-amber-500" />
                  Blocks
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("visual_canvas")}
                  className={`py-1.5 rounded-lg text-[10.5px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    activeTab === "visual_canvas" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Live Edit Fields"
                >
                  <Eye className="size-3" />
                  Live Edit
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("columns")}
                  className={`py-1.5 rounded-lg text-[10.5px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    activeTab === "columns" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Table Columns"
                >
                  <Layers className="size-3" />
                  Columns
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("signature_stamp")}
                  className={`py-1.5 rounded-lg text-[10.5px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    activeTab === "signature_stamp" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Signature & Rubber Stamp"
                >
                  <PenTool className="size-3" />
                  Sign
                </button>
              </div>

              {/* TAB 0: SMART BUILDING BLOCKS & SUGGESTIONS */}
              {activeTab === "smart_suggestions" && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl space-y-1">
                    <h3 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-indigo-600" />
                      Smart Invoice Building Blocks
                    </h3>
                    <p className="text-[10.5px] text-indigo-700 leading-snug">
                      Click to insert ready-made elements onto your blank sheet or toggle existing ones:
                    </p>
                  </div>

                  <div className="space-y-2">
                    {[
                      {
                        id: "company_header",
                        title: "1. Header & Branding",
                        desc: "Business title, logo, GSTIN, phone & address banner",
                        icon: Building,
                        badge: "Identity",
                      },
                      {
                        id: "invoice_meta",
                        title: "2. Invoice Facts & Dates",
                        desc: "Invoice #, Date, Due Date, Place of Supply & PO #",
                        icon: FileText,
                        badge: "Details",
                      },
                      {
                        id: "party_details",
                        title: "3. Parties & Delivery Site",
                        desc: "Billed To (Customer) & Shipped To (Consignee) cards",
                        icon: UserCheck,
                        badge: "Customer",
                      },
                      {
                        id: "items_table",
                        title: "4. Line Items & Pricing Grid",
                        desc: "Dynamic table: S.No, HSN, Qty, Rate, Tax %, Subtotal",
                        icon: Layers,
                        badge: "Core Grid",
                      },
                      {
                        id: "tax_slabs",
                        title: "5. GST Slabs Matrix",
                        desc: "Statutory tax schedule breakdown for CGST / SGST / IGST",
                        icon: ShieldCheck,
                        badge: "Taxes",
                      },
                      {
                        id: "totals_block",
                        title: "6. Ledger Totals & Words",
                        desc: "Subtotal, Round Off, Grand Total banner & Amount in Words",
                        icon: Sliders,
                        badge: "Finance",
                      },
                      {
                        id: "bank_qr_block",
                        title: "7. UPI QR Code & Bank",
                        desc: "Instant dynamic UPI QR (GPay / PhonePe) + Bank A/C",
                        icon: QrCode,
                        badge: "Payments",
                      },
                      {
                        id: "terms_block",
                        title: "8. Terms & Declarations",
                        desc: "Editable warranty, returns & jurisdiction conditions",
                        icon: HelpCircle,
                        badge: "Legal",
                      },
                      {
                        id: "signature_block",
                        title: "9. Signature & Stamp Seal",
                        desc: "Authorized signatory signature & official rubber seal",
                        icon: Stamp,
                        badge: "Auth",
                      },
                    ].map((block) => {
                      const isEnabled = config.sections.some((s) => s.id === block.id && s.enabled);
                      const Icon = block.icon;
                      return (
                        <div
                          key={block.id}
                          className={`p-3 rounded-xl border transition-all ${
                            isEnabled
                              ? "bg-emerald-50/50 border-emerald-200"
                              : "bg-white border-slate-200 hover:border-indigo-300"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                  isEnabled
                                    ? "bg-emerald-600 text-white"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                <Icon className="size-3.5" />
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-slate-800 leading-tight">
                                  {block.title}
                                </h4>
                                <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                                  {block.badge}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                handleToggleSection(block.id);
                                if (!isEnabled) {
                                  toast.success(`Inserted ${block.title} into your document!`);
                                } else {
                                  toast.info(`Removed ${block.title} from document`);
                                }
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                                isEnabled
                                  ? "bg-emerald-600 hover:bg-rose-600 text-white group"
                                  : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200"
                              }`}
                            >
                              {isEnabled ? (
                                <>
                                  <Check className="size-3 group-hover:hidden" />
                                  <span className="group-hover:hidden">Active</span>
                                  <Trash2 className="size-3 hidden group-hover:inline" />
                                  <span className="hidden group-hover:inline">Remove</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="size-3" />
                                  <span>+ Insert</span>
                                </>
                              )}
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-relaxed pl-9">
                            {block.desc}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
                            {(col.isCustom || !DEFAULT_WORD_COLUMNS.some((dc) => dc.id === col.id || dc.fieldKey === col.fieldKey)) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteColumn(col.id)}
                                className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
                                title="Delete Custom Column"
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
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center bg-slate-200/90">
            {/* Word Document Top Status & Margin Ruler */}
            <div className="w-full max-w-[794px] mb-3 bg-white/95 backdrop-blur-xs border border-slate-300 rounded-xl px-4 py-2 flex items-center justify-between text-[11px] shadow-xs select-none">
              <div className="flex items-center gap-2 font-bold text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Word Document Canvas • Standard A4 (210 × 297 mm)</span>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-slate-400 font-mono text-[10px]">
                <span>◀ 1.0" Margins ▶</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {(config.sections || DEFAULT_WORD_SECTIONS).filter((s) => s.enabled).length} Active Block{(config.sections || DEFAULT_WORD_SECTIONS).filter((s) => s.enabled).length === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            {/* Real A4 Paper Boundary */}
            <div
              className="w-full max-w-[794px] min-h-[1080px] bg-white shadow-2xl rounded-xl p-8 sm:p-10 flex flex-col justify-between border border-slate-300 relative transition-transform duration-200 origin-top"
              style={{
                fontFamily: config.fontFamily,
                fontSize: `${config.fontSizePt}pt`,
                backgroundColor: config.paperBgColor || "#ffffff",
                transform: canvasZoom !== 100 ? `scale(${canvasZoom / 100})` : undefined,
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
              <div className="space-y-4 z-10 flex-1 flex flex-col">
                {(config.sections || DEFAULT_WORD_SECTIONS).filter((s) => s.enabled).length === 0 ? (
                  <div className="my-auto py-12 px-6 border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl bg-slate-50/70 flex flex-col items-center justify-center text-center transition-all">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mb-3 shadow-inner">
                      <FileText className="w-7 h-7 text-indigo-500" />
                    </div>
                    <h3 className="text-base font-extrabold text-slate-800 mb-1">
                      Blank Word Document Canvas
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md leading-relaxed mb-6">
                      Your document sheet is completely empty. Click any suggested building block below to start designing your custom invoice from scratch:
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 w-full max-w-lg mb-6">
                      {[
                        { id: "company_header", label: "+ Header & Logo", icon: Building },
                        { id: "invoice_meta", label: "+ Invoice Meta", icon: FileText },
                        { id: "party_details", label: "+ Customer Parties", icon: UserCheck },
                        { id: "items_table", label: "+ Items Table Grid", icon: Layers },
                        { id: "tax_slabs", label: "+ GST Slabs Matrix", icon: ShieldCheck },
                        { id: "totals_block", label: "+ Totals & Words", icon: Sliders },
                        { id: "bank_qr_block", label: "+ UPI QR & Bank", icon: QrCode },
                        { id: "terms_block", label: "+ Terms & Conditions", icon: HelpCircle },
                        { id: "signature_block", label: "+ Signature & Stamp", icon: Stamp },
                      ].map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => {
                            handleToggleSection(b.id);
                            toast.success(`Inserted ${b.label.replace("+ ", "")} into canvas!`);
                          }}
                          className="p-2.5 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl text-xs font-bold text-slate-700 hover:text-indigo-700 shadow-2xs transition-all flex items-center gap-2 cursor-pointer text-left"
                        >
                          <b.icon className="size-4 text-indigo-600 shrink-0" />
                          <span className="truncate">{b.label}</span>
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setConfig((prev) => ({
                          ...prev,
                          sections: DEFAULT_WORD_SECTIONS,
                        }));
                        toast.success("Loaded full standard invoice layout!");
                      }}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline underline-offset-4 cursor-pointer"
                    >
                      Or prefill with standard full layout
                    </button>
                  </div>
                ) : (
                  (config.sections || DEFAULT_WORD_SECTIONS)
                    .filter((s) => s.enabled)
                    .map((section) => {
                    
                    // 1. Company Header
                    if (section.id === "company_header") {
                      // Modern Banner Style
                      if (config.headerStyle === "modern_banner") {
                        return (
                          <div
                            key={section.id}
                            className="rounded-2xl p-6 text-white shadow-md relative overflow-hidden"
                            style={{
                              background: `linear-gradient(135deg, ${config.primaryColor} 0%, #0f172a 100%)`,
                            }}
                          >
                            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                              <div className="flex items-center gap-3.5">
                                <div
                                  onClick={() => logoFileInputRef.current?.click()}
                                  title="Click to upload/change document logo"
                                  className="h-14 w-14 rounded-xl bg-white/95 p-1.5 shadow-md flex items-center justify-center shrink-0 cursor-pointer relative group/logo overflow-hidden"
                                >
                                  {config.logoUrl ? (
                                    <img src={config.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                                  ) : (
                                    <div className="h-full w-full rounded-lg bg-indigo-600 text-white font-black text-xl flex items-center justify-center">
                                      {config.companyName.charAt(0)}
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover/logo:opacity-100 flex items-center justify-center text-[9px] font-bold transition-opacity">
                                    Change
                                  </div>
                                </div>
                                <div className="space-y-0.5">
                                  <input
                                    type="text"
                                    value={config.companyName}
                                    onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
                                    className="font-black text-xl sm:text-2xl tracking-tight uppercase leading-tight text-white drop-shadow-sm bg-transparent outline-none hover:bg-black/20 focus:bg-black/30 rounded px-1 -mx-1 w-full"
                                    title="Click to edit company name"
                                  />
                                  <input
                                    type="text"
                                    value={config.companyAddress}
                                    onChange={(e) => setConfig({ ...config, companyAddress: e.target.value })}
                                    className="text-[10.5px] text-slate-200 leading-relaxed max-w-md bg-transparent outline-none hover:bg-black/20 focus:bg-black/30 rounded px-1 -mx-1 w-full"
                                    title="Click to edit address"
                                  />
                                  <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-200 pt-1 font-medium">
                                    <span className="bg-white/10 px-2 py-0.5 rounded border border-white/15 font-mono flex items-center gap-1">
                                      GSTIN:
                                      <input
                                        type="text"
                                        value={config.companyGstin}
                                        onChange={(e) => setConfig({ ...config, companyGstin: e.target.value })}
                                        className="bg-transparent font-mono font-bold text-white outline-none w-32"
                                      />
                                    </span>
                                    <span className="flex items-center gap-1">
                                      Tel:
                                      <input
                                        type="text"
                                        value={config.companyPhone}
                                        onChange={(e) => setConfig({ ...config, companyPhone: e.target.value })}
                                        className="bg-transparent text-white font-bold outline-none w-28"
                                      />
                                    </span>
                                    <span className="flex items-center gap-1">
                                      Email:
                                      <input
                                        type="text"
                                        value={config.companyEmail}
                                        onChange={(e) => setConfig({ ...config, companyEmail: e.target.value })}
                                        className="bg-transparent text-white font-bold outline-none w-36"
                                      />
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="sm:text-right shrink-0">
                                <input
                                  type="text"
                                  value={config.invoiceTitle}
                                  onChange={(e) => setConfig({ ...config, invoiceTitle: e.target.value })}
                                  className="font-black text-2xl tracking-wider uppercase block text-white drop-shadow-sm bg-transparent outline-none text-right hover:bg-black/20 focus:bg-black/30 rounded px-1 w-52"
                                />
                                <span className="inline-block mt-1 px-2.5 py-0.5 text-[9px] font-bold tracking-widest uppercase rounded-full bg-white/15 text-white border border-white/20">
                                  ORIGINAL FOR RECIPIENT
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // Swiss Grid Header
                      if (config.headerStyle === "swiss_grid") {
                        return (
                          <div key={section.id} className="pb-5 border-b-2 border-slate-900">
                            <div className="h-1.5 w-full mb-4 rounded-full" style={{ backgroundColor: config.primaryColor }} />
                            <div className="flex flex-col sm:flex-row items-start justify-between gap-5">
                              <div className="space-y-1.5 max-w-md">
                                <div className="flex items-center gap-3">
                                  <div
                                    onClick={() => logoFileInputRef.current?.click()}
                                    title="Click to upload logo"
                                    className="h-12 w-12 border border-slate-300 p-1 flex items-center justify-center shrink-0 cursor-pointer relative group/logo overflow-hidden"
                                  >
                                    {config.logoUrl ? (
                                      <img src={config.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                                    ) : (
                                      <div className="h-full w-full text-white font-black text-lg flex items-center justify-center" style={{ backgroundColor: config.primaryColor }}>
                                        {config.companyName.charAt(0)}
                                      </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover/logo:opacity-100 flex items-center justify-center text-[8.5px] font-bold">
                                      Change
                                    </div>
                                  </div>
                                  <div>
                                    <input
                                      type="text"
                                      value={config.companyName}
                                      onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
                                      className="font-black text-2xl tracking-tighter uppercase text-slate-950 leading-none bg-transparent outline-none hover:bg-slate-100 rounded px-1 -mx-1 w-full"
                                    />
                                    <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest block mt-1">
                                      SWISS INVOICE SPECIFICATION
                                    </span>
                                  </div>
                                </div>
                                <input
                                  type="text"
                                  value={config.companyAddress}
                                  onChange={(e) => setConfig({ ...config, companyAddress: e.target.value })}
                                  className="text-[10px] text-slate-600 leading-tight pt-1 bg-transparent outline-none hover:bg-slate-100 rounded px-1 -mx-1 w-full"
                                />
                                <div className="flex flex-wrap items-center gap-3 pt-1 text-[9.5px] font-mono text-slate-600">
                                  <span>TAX ID: <input type="text" value={config.companyGstin} onChange={(e) => setConfig({ ...config, companyGstin: e.target.value })} className="font-bold text-slate-900 bg-transparent outline-none w-32" /></span>
                                  <span>T: <input type="text" value={config.companyPhone} onChange={(e) => setConfig({ ...config, companyPhone: e.target.value })} className="font-bold text-slate-900 bg-transparent outline-none w-24" /></span>
                                </div>
                              </div>
                              <div className="sm:text-right shrink-0 space-y-2">
                                <div>
                                  <input
                                    type="text"
                                    value={config.invoiceTitle}
                                    onChange={(e) => setConfig({ ...config, invoiceTitle: e.target.value })}
                                    className="font-black text-3xl tracking-tighter uppercase text-slate-950 bg-transparent outline-none text-right hover:bg-slate-100 rounded px-1 w-52"
                                  />
                                  <span className="inline-block mt-1 px-2 py-0.5 text-[8.5px] font-mono font-bold tracking-widest uppercase bg-slate-900 text-white">
                                    ORIGINAL FOR RECIPIENT
                                  </span>
                                </div>
                                <div className="border border-slate-900 p-2.5 sm:min-w-[210px] text-[10px] font-mono space-y-1 text-left sm:text-right">
                                  <div className="flex justify-between gap-3">
                                    <span className="text-slate-500 uppercase">{config.invoiceNumberLabel || "Invoice #"}:</span>
                                    <input type="text" value={config.invoiceNumberValue} onChange={(e) => setConfig({ ...config, invoiceNumberValue: e.target.value })} className="text-slate-950 font-black text-right bg-transparent outline-none w-28" />
                                  </div>
                                  <div className="flex justify-between gap-3">
                                    <span className="text-slate-500 uppercase">{config.invoiceDateLabel || "Date"}:</span>
                                    <input type="text" value={config.invoiceDateValue} onChange={(e) => setConfig({ ...config, invoiceDateValue: e.target.value })} className="text-slate-900 text-right bg-transparent outline-none w-24" />
                                  </div>
                                  <div className="flex justify-between gap-3">
                                    <span className="text-slate-500 uppercase">{config.dueDateLabel || "Due"}:</span>
                                    <input type="text" value={config.dueDateValue} onChange={(e) => setConfig({ ...config, dueDateValue: e.target.value })} className="text-slate-900 text-right bg-transparent outline-none w-24" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // Tokyo Precision Technical Header
                      if (config.headerStyle === "tokyo_precision") {
                        return (
                          <div key={section.id} className="border-2 border-slate-900 rounded-lg overflow-hidden">
                            <div className="px-4 py-2 text-white flex items-center justify-between text-xs font-mono font-bold uppercase tracking-wider" style={{ backgroundColor: config.primaryColor }}>
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                                <input type="text" value={config.companyName} onChange={(e) => setConfig({ ...config, companyName: e.target.value })} className="bg-transparent text-white font-bold outline-none" />
                              </div>
                              <input type="text" value={config.invoiceTitle} onChange={(e) => setConfig({ ...config, invoiceTitle: e.target.value })} className="bg-transparent text-white font-bold outline-none text-right" />
                            </div>
                            <div className="p-3 bg-slate-50 flex justify-between items-center text-xs">
                              <input type="text" value={config.companyAddress} onChange={(e) => setConfig({ ...config, companyAddress: e.target.value })} className="bg-transparent outline-none text-slate-600 w-2/3" />
                              <div className="font-mono text-right font-bold text-slate-800">
                                <span>{config.invoiceNumberValue}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // Minimal Nordic Line Header
                      if (config.headerStyle === "minimal") {
                        return (
                          <div key={section.id} className="pb-4 border-b border-slate-200">
                            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                              <div>
                                <input type="text" value={config.companyName} onChange={(e) => setConfig({ ...config, companyName: e.target.value })} className="font-black text-2xl tracking-tight text-slate-800 bg-transparent outline-none" />
                                <input type="text" value={config.companyAddress} onChange={(e) => setConfig({ ...config, companyAddress: e.target.value })} className="text-[10px] text-slate-500 block mt-0.5 bg-transparent outline-none w-full" />
                              </div>
                              <div className="sm:text-right space-y-1">
                                <input type="text" value={config.invoiceTitle} onChange={(e) => setConfig({ ...config, invoiceTitle: e.target.value })} className="font-extrabold text-2xl tracking-tight text-slate-900 uppercase bg-transparent outline-none text-right" />
                                <span className="text-xs font-mono text-slate-500 block">{config.invoiceNumberValue}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // Centered Luxury Letterhead
                      if (config.headerStyle === "centered_letterhead") {
                        return (
                          <div key={section.id} className="text-center pb-4 border-b-2" style={{ borderColor: config.primaryColor }}>
                            {config.logoUrl && (
                              <div className="flex justify-center mb-2">
                                <img src={config.logoUrl} alt="Logo" className="h-12 object-contain" />
                              </div>
                            )}
                            <input type="text" value={config.companyName} onChange={(e) => setConfig({ ...config, companyName: e.target.value })} className="font-black text-2xl sm:text-3xl uppercase tracking-tight text-slate-950 bg-transparent outline-none text-center w-full" />
                            <input type="text" value={config.companyAddress} onChange={(e) => setConfig({ ...config, companyAddress: e.target.value })} className="text-[10.5px] text-slate-600 max-w-lg mx-auto block mt-0.5 bg-transparent outline-none text-center w-full" />
                            <div className="mt-2">
                              <input type="text" value={config.invoiceTitle} onChange={(e) => setConfig({ ...config, invoiceTitle: e.target.value })} style={{ color: config.primaryColor }} className="font-black tracking-wider uppercase text-base bg-transparent outline-none text-center" />
                            </div>
                          </div>
                        );
                      }

                      // Classic 2-Column Split (Default - Exact match to Live Preview Screenshot 1)
                      return (
                        <div
                          key={section.id}
                          className="pb-5 border-b border-slate-200/90 flex flex-col sm:flex-row items-start justify-between gap-5 relative group"
                        >
                          {/* Left: Organization Identity */}
                          <div className="space-y-1.5 max-w-md">
                            <div className="flex items-center gap-3">
                              <div
                                onClick={() => logoFileInputRef.current?.click()}
                                title="Click to upload/change document logo"
                                className="h-12 w-12 rounded-xl border border-slate-200/80 bg-white p-1 flex items-center justify-center shadow-xs shrink-0 cursor-pointer relative group/logo overflow-hidden hover:border-indigo-400 transition-colors"
                              >
                                {config.logoUrl ? (
                                  <img
                                    src={config.logoUrl}
                                    alt="Logo"
                                    className="max-h-full max-w-full object-contain"
                                  />
                                ) : (
                                  <div
                                    className="h-10 w-10 rounded-xl text-white font-black text-lg flex items-center justify-center shrink-0 shadow-xs"
                                    style={{ backgroundColor: config.primaryColor }}
                                  >
                                    {config.companyName.charAt(0)}
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/55 text-white opacity-0 group-hover/logo:opacity-100 flex items-center justify-center text-[8.5px] font-bold transition-opacity">
                                  Change
                                </div>
                              </div>

                              <div className="space-y-0.5">
                                <input
                                  type="text"
                                  value={config.companyName}
                                  onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
                                  className="font-black text-xl tracking-tight text-slate-900 leading-none bg-transparent hover:bg-slate-100 focus:bg-white focus:ring-1 focus:ring-indigo-400 rounded px-1 -mx-1 outline-none w-full"
                                  title="Click to edit company name"
                                />
                                <input
                                  type="text"
                                  value={config.companyTagline || "AUTHORIZED BILLING & COMMERCIAL INVOICING"}
                                  onChange={(e) => setConfig({ ...config, companyTagline: e.target.value })}
                                  className="text-[9.5px] font-semibold text-slate-400 uppercase tracking-wider block mt-0.5 bg-transparent hover:bg-slate-100 focus:bg-white focus:ring-1 focus:ring-indigo-400 rounded px-1 -mx-1 outline-none w-full"
                                  title="Click to edit subtitle / tagline"
                                />
                              </div>
                            </div>

                            <input
                              type="text"
                              value={config.companyAddress}
                              onChange={(e) => setConfig({ ...config, companyAddress: e.target.value })}
                              className="text-[10.5px] text-slate-600 leading-relaxed pt-1 bg-transparent hover:bg-slate-100 focus:bg-white focus:ring-1 focus:ring-indigo-400 rounded px-1 -mx-1 outline-none w-full"
                              title="Click to edit address"
                            />

                            <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px]">
                              <span className="bg-slate-100/90 text-slate-800 font-mono font-bold px-2 py-0.5 rounded border border-slate-200/70 flex items-center gap-1">
                                GSTIN:
                                <input
                                  type="text"
                                  value={config.companyGstin}
                                  onChange={(e) => setConfig({ ...config, companyGstin: e.target.value })}
                                  className="bg-transparent font-mono font-bold text-slate-800 outline-none w-32 hover:bg-white focus:bg-white rounded px-0.5"
                                  title="Click to edit GSTIN"
                                />
                              </span>
                              <span className="text-slate-600 flex items-center gap-1">
                                Tel:
                                <input
                                  type="text"
                                  value={config.companyPhone}
                                  onChange={(e) => setConfig({ ...config, companyPhone: e.target.value })}
                                  className="font-bold text-slate-800 bg-transparent outline-none w-28 hover:bg-white focus:bg-white rounded px-0.5"
                                  title="Click to edit telephone"
                                />
                              </span>
                              <span className="text-slate-600 flex items-center gap-1">
                                Email:
                                <input
                                  type="text"
                                  value={config.companyEmail}
                                  onChange={(e) => setConfig({ ...config, companyEmail: e.target.value })}
                                  className="font-bold text-slate-800 bg-transparent outline-none w-36 hover:bg-white focus:bg-white rounded px-0.5"
                                  title="Click to edit email"
                                />
                              </span>
                            </div>
                          </div>

                          {/* Right: Document Title & Key Facts Micro-Card */}
                          <div className="sm:text-right shrink-0 space-y-2">
                            <div>
                              <input
                                type="text"
                                value={config.invoiceTitle}
                                onChange={(e) => setConfig({ ...config, invoiceTitle: e.target.value })}
                                style={{ color: config.primaryColor }}
                                className="font-black text-2xl sm:text-3xl tracking-tight uppercase text-right bg-transparent hover:bg-slate-100 focus:bg-white focus:ring-1 focus:ring-indigo-400 rounded px-1 outline-none w-56 sm:w-64"
                                title="Click to edit invoice title (e.g. TAX INVOICE, BILL OF SUPPLY)"
                              />
                              <span className="inline-block mt-1 px-2.5 py-0.5 text-[9px] font-bold tracking-widest uppercase rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                ORIGINAL FOR RECIPIENT
                              </span>
                            </div>

                            <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-2.5 sm:min-w-[200px] text-[10.5px] space-y-1 text-left sm:text-right shadow-xs">
                              <div className="flex justify-between gap-3 items-center">
                                <input
                                  type="text"
                                  value={config.invoiceNumberLabel || "INVOICE NO:"}
                                  onChange={(e) => setConfig({ ...config, invoiceNumberLabel: e.target.value })}
                                  className="text-slate-400 font-semibold text-[9px] uppercase tracking-wider bg-transparent outline-none w-24 hover:bg-white rounded px-0.5"
                                />
                                <input
                                  type="text"
                                  value={config.invoiceNumberValue}
                                  onChange={(e) => setConfig({ ...config, invoiceNumberValue: e.target.value })}
                                  className="font-mono font-black text-slate-900 text-xs bg-transparent outline-none text-right w-28 hover:bg-white rounded px-0.5"
                                />
                              </div>
                              <div className="flex justify-between gap-3 items-center">
                                <input
                                  type="text"
                                  value={config.invoiceDateLabel || "INVOICE DATE:"}
                                  onChange={(e) => setConfig({ ...config, invoiceDateLabel: e.target.value })}
                                  className="text-slate-400 font-semibold text-[9px] uppercase tracking-wider bg-transparent outline-none w-24 hover:bg-white rounded px-0.5"
                                />
                                <input
                                  type="text"
                                  value={config.invoiceDateValue}
                                  onChange={(e) => setConfig({ ...config, invoiceDateValue: e.target.value })}
                                  className="font-bold text-slate-800 bg-transparent outline-none text-right w-24 hover:bg-white rounded px-0.5"
                                />
                              </div>
                              <div className="flex justify-between gap-3 items-center">
                                <input
                                  type="text"
                                  value={config.dueDateLabel || "DUE DATE:"}
                                  onChange={(e) => setConfig({ ...config, dueDateLabel: e.target.value })}
                                  className="text-slate-400 font-semibold text-[9px] uppercase tracking-wider bg-transparent outline-none w-24 hover:bg-white rounded px-0.5"
                                />
                                <input
                                  type="text"
                                  value={config.dueDateValue}
                                  onChange={(e) => setConfig({ ...config, dueDateValue: e.target.value })}
                                  className="font-bold text-slate-800 bg-transparent outline-none text-right w-24 hover:bg-white rounded px-0.5"
                                />
                              </div>
                              <div className="flex justify-between gap-3 items-center pt-1 border-t border-slate-200/80">
                                <input
                                  type="text"
                                  value={config.placeOfSupplyLabel || "PLACE OF SUPPLY:"}
                                  onChange={(e) => setConfig({ ...config, placeOfSupplyLabel: e.target.value })}
                                  className="text-slate-400 font-semibold text-[9px] uppercase tracking-wider bg-transparent outline-none w-28 hover:bg-white rounded px-0.5"
                                />
                                <input
                                  type="text"
                                  value={config.placeOfSupplyValue}
                                  onChange={(e) => setConfig({ ...config, placeOfSupplyValue: e.target.value })}
                                  className="font-bold text-slate-800 bg-transparent outline-none text-right w-28 hover:bg-white rounded px-0.5"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // 2. Invoice Meta Details & Editable Custom References Strip (Matches Live Preview)
                    if (section.id === "invoice_meta") {
                      return (
                        <div
                          key={section.id}
                          className="bg-slate-50/70 border border-slate-200/80 rounded-xl px-4 py-3 relative group"
                        >
                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <span>Commercial & Shipment References</span>
                              <span className="text-[8px] px-1.5 py-0.2 bg-indigo-50 text-indigo-600 rounded border border-indigo-200 lowercase font-mono">
                                click any to edit
                              </span>
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleAddCustomField("meta", "New Field", "Sample Value")}
                                className="text-[8.5px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-white hover:bg-indigo-50 border border-slate-200 px-2 py-0.5 rounded cursor-pointer transition-colors shadow-2xs"
                              >
                                <Plus className="size-2.5" />
                                + Add Field
                              </button>
                              <span className="font-mono text-slate-400">REF-TAG</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                            {(config.customFields || [])
                              .filter((f) => f.enabled && (f.section === "meta" || !f.section))
                              .map((f) => (
                                <div
                                  key={f.id}
                                  className="space-y-0.5 p-1 rounded hover:bg-white border border-transparent hover:border-slate-200 relative group/ref transition-all"
                                >
                                  <div className="flex items-center justify-between">
                                    <input
                                      type="text"
                                      value={f.label}
                                      onChange={(e) => handleUpdateCustomField(f.id, { label: e.target.value })}
                                      className="text-slate-400 font-bold text-[8.5px] uppercase tracking-wider block bg-transparent outline-none w-full hover:bg-slate-100 rounded px-0.5"
                                      placeholder="Field Label"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteCustomField(f.id)}
                                      className="text-rose-400 hover:text-rose-600 opacity-0 group-hover/ref:opacity-100 transition-opacity p-0.5 cursor-pointer"
                                      title="Remove Field"
                                    >
                                      <Trash2 className="size-2.5" />
                                    </button>
                                  </div>
                                  <input
                                    type="text"
                                    value={f.value}
                                    onChange={(e) => handleUpdateCustomField(f.id, { value: e.target.value })}
                                    className="font-mono font-bold text-slate-900 text-[11px] block bg-transparent outline-none w-full hover:bg-slate-100 rounded px-0.5 truncate"
                                    placeholder="Value"
                                  />
                                </div>
                              ))}
                          </div>
                        </div>
                      );
                    }

                    // 3. Bill To & Ship To Details (Matches Live Preview)
                    if (section.id === "party_details") {
                      return (
                        <div
                          key={section.id}
                          className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl p-4 bg-slate-50/50 border border-slate-200/80 text-[10.5px] hover:border-indigo-300 transition-colors"
                        >
                          {/* Billed To (Customer) */}
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: config.primaryColor }} />
                              <input
                                type="text"
                                value={config.customerTitle}
                                onChange={(e) => setConfig({ ...config, customerTitle: e.target.value })}
                                className="font-bold text-slate-400 uppercase text-[9px] tracking-wider bg-transparent outline-none w-48 hover:bg-white rounded px-0.5"
                              />
                            </div>

                            <input
                              type="text"
                              value={config.customerName}
                              onChange={(e) => setConfig({ ...config, customerName: e.target.value })}
                              className="font-black text-slate-950 text-sm block leading-snug bg-transparent outline-none w-full hover:bg-white rounded px-0.5"
                              title="Click to edit customer name"
                            />

                            <input
                              type="text"
                              value={config.customerAddress}
                              onChange={(e) => setConfig({ ...config, customerAddress: e.target.value })}
                              className="text-slate-600 leading-relaxed bg-transparent outline-none w-full hover:bg-white rounded px-0.5"
                              title="Click to edit customer address"
                            />

                            <div className="flex flex-wrap items-center gap-2 pt-1 font-medium text-[10px]">
                              <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-800 font-mono font-bold flex items-center gap-1">
                                GSTIN:
                                <input
                                  type="text"
                                  value={config.customerGstin}
                                  onChange={(e) => setConfig({ ...config, customerGstin: e.target.value })}
                                  className="font-mono font-bold text-slate-800 bg-transparent outline-none w-32 hover:bg-slate-100 rounded px-0.5"
                                />
                              </span>
                              <span className="text-slate-600 flex items-center gap-1">
                                Phone:
                                <input
                                  type="text"
                                  value={config.customerPhone}
                                  onChange={(e) => setConfig({ ...config, customerPhone: e.target.value })}
                                  className="font-bold text-slate-800 bg-transparent outline-none w-28 hover:bg-slate-100 rounded px-0.5"
                                />
                              </span>
                            </div>
                          </div>

                          {/* Shipped To (Delivery) */}
                          <div className="space-y-1.5 sm:border-l sm:border-slate-200/90 sm:pl-4">
                            <div className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-slate-400" />
                              <input
                                type="text"
                                value={config.shippingTitle}
                                onChange={(e) => setConfig({ ...config, shippingTitle: e.target.value })}
                                className="font-bold text-slate-400 uppercase text-[9px] tracking-wider bg-transparent outline-none w-48 hover:bg-white rounded px-0.5"
                              />
                            </div>

                            <input
                              type="text"
                              value={config.shippingName}
                              onChange={(e) => setConfig({ ...config, shippingName: e.target.value })}
                              className="font-black text-slate-950 text-sm block leading-snug bg-transparent outline-none w-full hover:bg-white rounded px-0.5"
                              title="Click to edit shipping name"
                            />

                            <input
                              type="text"
                              value={config.shippingAddress}
                              onChange={(e) => setConfig({ ...config, shippingAddress: e.target.value })}
                              className="text-slate-600 leading-relaxed bg-transparent outline-none w-full hover:bg-white rounded px-0.5"
                              title="Click to edit shipping address"
                            />

                            <div className="text-[10px] text-slate-500 pt-1 font-medium">
                              <span>Dispatch Mode: <strong className="text-slate-800">Surface Cargo / Road Transport</strong></span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // 4. Dynamic Items Table Grid (Matches Live Preview)
                    if (section.id === "items_table") {
                      const enabledCols = (config.columns || DEFAULT_WORD_COLUMNS).filter((c) => c.enabled);
                      return (
                        <div
                          key={section.id}
                          className="rounded-2xl overflow-hidden border border-slate-200 shadow-xs bg-white"
                        >
                          <table className="w-full border-collapse text-[10.5px]">
                            {/* Table Header */}
                            <thead>
                              <tr
                                className="text-white font-bold uppercase tracking-wider text-[9.5px]"
                                style={{ backgroundColor: config.primaryColor }}
                              >
                                {enabledCols.map((col) => (
                                  <th
                                    key={col.id}
                                    style={{ width: `${col.widthPercent}%`, textAlign: col.align }}
                                    className="py-3 px-3 border-r border-white/10 last:border-r-0 font-extrabold relative group/col"
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <input
                                        type="text"
                                        value={col.headerTitle}
                                        onChange={(e) => handleUpdateColumnHeader(col.id, e.target.value)}
                                        className="bg-transparent font-bold uppercase text-[9.5px] text-white outline-none w-full text-center hover:bg-white/15 focus:bg-black/25 rounded px-0.5"
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

                            {/* Table Body */}
                            <tbody className="divide-y divide-slate-100">
                              {sampleItems.map((item, idx) => (
                                <tr
                                  key={idx}
                                  className={idx % 2 === 1 ? "bg-slate-50/40 hover:bg-slate-100/50 transition-colors" : "bg-white hover:bg-slate-50/60 transition-colors"}
                                >
                                  {enabledCols.map((col) => {
                                    if (col.fieldKey === "sno") {
                                      return (
                                        <td key={col.id} className="py-3 px-2 text-center text-slate-400 font-bold font-mono text-[10px]">
                                          {item.sno}
                                        </td>
                                      );
                                    }
                                    if (col.fieldKey === "description") {
                                      return (
                                        <td key={col.id} className="py-3 px-3.5 text-left">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <strong className="text-slate-900 font-bold text-[11px] leading-snug">
                                              {item.description}
                                            </strong>
                                            {item.isFree && (
                                              <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                FREE ITEM
                                              </span>
                                            )}
                                          </div>
                                          {item.custom_note && (
                                            <span className="text-[9.5px] text-slate-500 block mt-0.5 leading-snug">
                                              {item.custom_note}
                                            </span>
                                          )}
                                        </td>
                                      );
                                    }
                                    if (col.fieldKey === "hsn") {
                                      return (
                                        <td key={col.id} className="py-3 px-2 text-center font-mono text-[9.5px] text-slate-600">
                                          <span className="bg-slate-100/80 px-1.5 py-0.5 rounded border border-slate-200/50">
                                            {item.hsn}
                                          </span>
                                        </td>
                                      );
                                    }
                                    if (col.fieldKey === "quantity") {
                                      return (
                                        <td key={col.id} className="py-3 px-2 text-center font-bold">
                                          <div className="inline-flex items-center gap-1 font-mono">
                                            <span className="text-slate-900 font-extrabold text-[11px]">{item.quantity}</span>
                                            <span className="text-slate-500 font-bold text-[9px] uppercase">{item.unit}</span>
                                          </div>
                                        </td>
                                      );
                                    }
                                    if (col.fieldKey === "unit_price") {
                                      return (
                                        <td key={col.id} className="py-3 px-3 text-right font-mono text-[11px] text-slate-700 font-medium">
                                          {item.isFree ? (
                                            <span>
                                              <span className="line-through text-slate-400 mr-1 text-[9px]">₹{(item as any).originalRate || 150}.00</span>
                                              <span className="text-emerald-700 font-bold">₹0.00</span>
                                            </span>
                                          ) : (
                                            <span>₹{item.unit_price.toFixed(2)}</span>
                                          )}
                                        </td>
                                      );
                                    }
                                    if (col.fieldKey === "discount") {
                                      return (
                                        <td key={col.id} className="py-3 px-2 text-center text-slate-600 text-[10px]">
                                          {item.discount > 0 ? `${item.discount}%` : "-"}
                                        </td>
                                      );
                                    }
                                    if (col.fieldKey === "tax_rate") {
                                      return (
                                        <td key={col.id} className="py-3 px-2 text-center font-semibold text-slate-700 text-[10px]">
                                          {item.tax_rate}%
                                        </td>
                                      );
                                    }
                                    if (col.fieldKey === "total_amount") {
                                      return (
                                        <td key={col.id} className="py-3 px-3 text-right font-black font-mono text-slate-950 text-[11px]">
                                          ₹{item.total_amount.toFixed(2)}
                                        </td>
                                      );
                                    }
                                    return (
                                      <td key={col.id} className="py-3 px-2 text-center text-slate-400" style={{ textAlign: col.align }}>
                                        -
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>

                            {/* Table Footer */}
                            <tfoot>
                              <tr className="bg-slate-100 font-bold border-t border-slate-200 text-slate-900">
                                {enabledCols.map((col) => {
                                  if (col.fieldKey === "sno") {
                                    return (
                                      <td key={col.id} className="py-2.5 px-2 text-center text-slate-500 font-bold text-[9px]">
                                        Total
                                      </td>
                                    );
                                  }
                                  if (col.fieldKey === "description") {
                                    return (
                                      <td key={col.id} className="py-2.5 px-3.5 text-left font-black text-slate-800 text-[10px]">
                                        Total Items: {totalItemsCount} Items
                                      </td>
                                    );
                                  }
                                  if (col.fieldKey === "quantity") {
                                    return (
                                      <td key={col.id} className="py-2.5 px-2 text-center font-black text-slate-900 text-[10px] bg-slate-200/90 font-mono">
                                        {totalBilledQty} Units
                                      </td>
                                    );
                                  }
                                  if (col.fieldKey === "total_amount") {
                                    return (
                                      <td key={col.id} className="py-2.5 px-3 text-right font-black font-mono text-slate-900 text-[11px]">
                                        ₹{subtotal.toFixed(2)}
                                      </td>
                                    );
                                  }
                                  return (
                                    <td key={col.id} className="py-2.5 px-2 text-center text-slate-400">
                                      —
                                    </td>
                                  );
                                })}
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      );
                    }

                    // 5. GST Slabs Matrix
                    if (section.id === "tax_slabs" && config.showTaxBreakdown) {
                      return (
                        <div key={section.id} className="border border-slate-200 rounded-xl p-3 text-[9px] bg-slate-50/50">
                          <span className="font-bold text-slate-500 uppercase block mb-1.5 text-[8.5px] tracking-wider">
                            GST Tax Breakdown (HSN / SAC Split)
                          </span>
                          <table className="w-full text-center">
                            <thead>
                              <tr className="text-slate-400 border-b border-slate-200 uppercase font-bold text-[8px]">
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
                              <tr className="font-mono text-slate-700">
                                <td className="p-1 text-left font-semibold">15141190</td>
                                <td className="p-1 text-right">₹4,300.00</td>
                                <td className="p-1">₹107.50</td>
                                <td className="p-1">₹107.50</td>
                                <td className="p-1">₹0.00</td>
                                <td className="p-1 text-right font-bold">₹215.00</td>
                              </tr>
                              <tr className="font-mono text-slate-700">
                                <td className="p-1 text-left font-semibold">09083100</td>
                                <td className="p-1 text-right">₹5,600.00</td>
                                <td className="p-1">₹188.75</td>
                                <td className="p-1">₹188.75</td>
                                <td className="p-1">₹0.00</td>
                                <td className="p-1 text-right font-bold">₹377.50</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      );
                    }

                    // 6. Totals & Words
                    if (section.id === "totals_block") {
                      return (
                        <div key={section.id} className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-1">
                          <div className="flex-1 text-[9.5px] text-slate-600 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80">
                            <span className="font-bold text-slate-400 uppercase text-[8px] tracking-wider block mb-0.5">
                              Amount in Words:
                            </span>
                            <strong className="text-slate-800 text-[10.5px] leading-snug block">
                              Twenty Three Thousand Three Hundred Fifty Five Rupees Only
                            </strong>
                            <div className="mt-2.5 pt-2 border-t border-slate-200/90 flex items-center justify-between text-[9px] text-slate-500 font-medium">
                              <span>Total Billed Qty: <strong className="text-slate-800 font-mono font-bold">{totalBilledQty} Units</strong></span>
                              <span>Total Items: <strong className="text-slate-800 font-bold">{totalItemsCount}</strong></span>
                            </div>
                          </div>

                          <div className="w-full sm:w-64 space-y-1.5 text-[10px] font-semibold bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80">
                            <div className="flex justify-between text-slate-600">
                              <span>Subtotal (Taxable):</span>
                              <span className="font-mono font-bold text-slate-800">₹{subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                              <span>CGST (Output):</span>
                              <span className="font-mono">₹{cgst.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                              <span>SGST (Output):</span>
                              <span className="font-mono">₹{sgst.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                              <span>Total Tax Amount:</span>
                              <span className="font-mono font-bold text-slate-800">₹{taxAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-200">
                              <span>Grand Total:</span>
                              <span className="font-mono font-black" style={{ color: config.primaryColor }}>
                                ₹{grandTotal.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // 7. UPI QR & Bank
                    if (section.id === "bank_qr_block" && config.showPaymentQr) {
                      return (
                        <div key={section.id} className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/60 text-[9.5px]">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-400 uppercase text-[8.5px] tracking-wider block">
                              Bank Payment Details
                            </span>
                            <p className="text-slate-600">Bank: <strong className="text-slate-900">{activeGst?.bank_name || "HDFC Bank Ltd"}</strong></p>
                            <p className="text-slate-600">A/C No: <strong className="font-mono text-slate-900">{activeGst?.bank_account_number || "50200012345678"}</strong></p>
                            <p className="text-slate-600">IFSC Code: <strong className="font-mono text-slate-900">{activeGst?.bank_ifsc || "HDFC0001234"}</strong></p>
                          </div>
                          <div className="flex items-center gap-3">
                            <img
                              src={generateQRCodeSVG(
                                buildUpiPayUrl({
                                  vpa: activeGst?.upi_vpa || "merchant@upi",
                                  payeeName: config.companyName || "Merchant",
                                  amount: grandTotal,
                                  invoiceNumber: config.invoiceNumberValue || "INV-2026-0009",
                                }),
                                90
                              )}
                              alt="UPI QR"
                              className="w-16 h-16 object-contain bg-white p-1 rounded-xl border border-slate-200 shadow-2xs"
                            />
                            <div className="text-right text-[8.5px] text-slate-500">
                              <span className="font-bold text-indigo-700 block text-[9.5px]">⚡ Scan & Pay UPI</span>
                              <span>Supports PhonePe, GPay, Paytm</span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // 8. Terms & Declarations
                    if (section.id === "terms_block") {
                      return (
                        <div key={section.id} className="text-[8.5px] text-slate-500 leading-relaxed border-t border-slate-200/80 pt-2.5 group">
                          <strong className="text-slate-700 block mb-0.5 text-[9px] uppercase tracking-wider">Terms & Conditions:</strong>
                          <textarea
                            value={config.termsText}
                            onChange={(e) => setConfig({ ...config, termsText: e.target.value })}
                            rows={3}
                            className="w-full bg-transparent outline-none resize-none text-slate-600 hover:bg-slate-50 focus:bg-white p-1 rounded border border-transparent focus:border-slate-200 transition-colors"
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
                              className="text-[9.5px] font-bold text-slate-500 bg-transparent outline-none text-center hover:bg-white rounded px-1 w-full"
                            />

                            {/* Digital Stamp & Signature Visual Preview */}
                            <div className="h-16 w-full flex items-center justify-center gap-3 my-1 relative">
                              {config.signatureConfig.showStamp && config.signatureConfig.stampUrl && (
                                <img
                                  src={config.signatureConfig.stampUrl}
                                  alt="Stamp"
                                  className="h-14 w-14 object-contain opacity-85 rotate-[-6deg]"
                                />
                              )}
                              {config.signatureConfig.showSignature && config.signatureConfig.signatureUrl && (
                                <img
                                  src={config.signatureConfig.signatureUrl}
                                  alt="Signature"
                                  className="h-12 max-w-[120px] object-contain"
                                />
                              )}
                              {(!config.signatureConfig.signatureUrl && !config.signatureConfig.stampUrl) && (
                                <div className="h-12 w-32 border border-dashed border-slate-300 rounded-lg flex items-center justify-center text-[9px] text-slate-400">
                                  Digital Sign / Stamp
                                </div>
                              )}
                            </div>

                            {/* Signatory Title */}
                            <input
                              type="text"
                              value={config.signatureConfig.title}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  signatureConfig: { ...config.signatureConfig, title: e.target.value },
                                })
                              }
                              className="text-[10px] font-extrabold text-slate-800 bg-transparent outline-none text-center hover:bg-white rounded px-1 w-full border-t border-slate-300 pt-1"
                            />
                          </div>
                        </div>
                      );
                    }

                    return null;
                  })
                )}
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
