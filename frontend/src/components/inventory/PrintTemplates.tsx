import React, { useState, useEffect, useRef, useMemo } from "react";
import { useI18n } from "@/contexts/i18n-context";
import { motion, AnimatePresence } from "framer-motion";
import {
  Printer,
  FileText,
  Receipt,
  ScanBarcode,
  QrCode,
  Tag,
  Truck,
  FilePlus2,
  Edit3,
  Copy,
  Trash2,
  Star,
  FileMinus,
  FileOutput,
  ClipboardList,
  ShoppingCart,
  Eye,
  Settings,
  Sparkles,
  Check,
  CheckCircle2,
  Upload,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Type,
  Layers,
  LayoutGrid,
  Sliders,
  Palette,
  GripVertical,
  ExternalLink,
  RotateCcw,
  Save,
  Download,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Building2,
  Calculator,
  User,
  CreditCard,
  PenTool,
  HeartHandshake,
  Image as ImageIcon,
  Plus,
  Search,
  CheckCheck,
  ArrowUp,
  ArrowDown,
  EyeOff,
  Stamp,
  Maximize2,
  X,
  CheckCircle,
  Barcode,
  Table as TableIcon,
  Columns,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { resolveImageUrl, invoicesApi, inventoryApi, printTemplatesApi, bankApi, taxApi, companiesApi, numberSeriesApi, type TaxCode, BankAccountRecord } from "@/lib/api-client";
import { formatDisplayDate } from "@/lib/utils";
import {
  getActiveBillingGst,
  saveBarcodeTemplate,
  setActiveBarcodeTemplate,
  saveActiveReceiptTemplate,
  GLOBAL_INVOICE_TEMPLATES,
  CURATED_BUILTIN_TEMPLATE_IDS,
  DEPRECATED_BUILTIN_TEMPLATE_IDS,
  setActiveInvoicePrintTemplate,
  setActiveInvoicePrintTemplateForCategory,
  getActiveInvoicePrintTemplateForCategory,
  setInvoiceCategoryLinked,
  isInvoiceCategoryUnlinked,
  syncMasterInvoiceToReceivers,
  setActiveBillingGst,
  getOrgSignatureSettings,
  setOrgSignatureSettings,
  setOrgPaymentQrSettings,
  setOrgDocumentPrefixes,
} from "@/lib/receipt-template-store";
// Defensive: these two helpers are being added in a parallel workstream —
// import them via a namespace so a missing export falls back to safeSetItem
// / a no-op instead of crashing the page.
import * as receiptTemplateStore from "@/lib/receipt-template-store";
import { safeSetItem, safeGetItem, safeRemoveItem, compressImageForStorage } from "@/lib/safe-storage";
import { INVOICE_DOC_CATEGORIES, type InvoiceDocCategory, type InvoiceTexts, TEXT_LABEL_GROUPS, resolveInvoiceTexts, resolveInvoiceRenderer, resolveInvoiceThemeName, FREEFORM_FIELD_BIND_OPTIONS, PARTY_LAYOUT_OPTIONS } from "@/lib/invoice-template-config";
import { getOrgPaymentQrSettings } from "@/lib/receipt-template-store";
import type { PaymentQrContext } from "@/components/pos/invoice-templates/PaymentQrBlock";
import { triggerThermalPrint } from "@/lib/print-helper";
import { generateQRCodeSVG, buildUpiPayUrl } from "@/lib/qr-generator";
import { MargPharmaTemplate } from "@/components/pos/invoice-templates/MargPharmaTemplate";
import { FmcgDistributorTemplate } from "@/components/pos/invoice-templates/FmcgDistributorTemplate";
import { ParleDistributorTemplate } from "@/components/pos/invoice-templates/ParleDistributorTemplate";
import { AgriSeedsTemplate } from "@/components/pos/invoice-templates/AgriSeedsTemplate";
import { GstTallyTemplate } from "@/components/pos/invoice-templates/GstTallyTemplate";
import { PdfStationeryOverlayTemplate } from "@/components/pos/invoice-templates/PdfStationeryOverlayTemplate";
import { WordInvoiceDocument } from "@/components/pos/invoice-templates/WordInvoiceDocument";
import { PdfTemplateOverlayModal } from "@/components/pos/PdfTemplateOverlayModal";
import { WordInvoiceStudioModal, DEFAULT_WORD_COLUMNS } from "@/components/pos/WordInvoiceStudioModal";
import {
  InvoiceQuickSettingsModal,
  loadStoredInvoiceSettings,
  saveStoredInvoiceSettings,
  type InvoiceSettings,
} from "@/components/pos/InvoiceQuickSettingsModal";
import { BarcodeTemplateCustomizerModal } from "./BarcodeTemplateCustomizerModal";
import {
  RealBarcodeSvg,
  SingleBarcodeLabelCard,
  getDefaultBarcodeElements,
  printBarcodePopup,
  generateBarcodeLabelHtml,
  type BarcodeElementBlock,
} from "@/lib/barcode-svg";
import type { FullInvoiceData } from "@/components/pos/FullInvoicePrinter";

const FONT_FAMILIES = [
  { label: "Calibri (Word Standard)", value: "Calibri, 'Segoe UI', sans-serif" },
  { label: "Aptos (Modern Word)", value: "Aptos, 'Segoe UI', sans-serif" },
  { label: "Inter (Modern Digital)", value: "Inter, sans-serif" },
  { label: "Arial (Clean Sans)", value: "Arial, Helvetica, sans-serif" },
  { label: "Times New Roman (Formal)", value: "'Times New Roman', Times, serif" },
  { label: "Segoe UI (Windows Fluent)", value: "'Segoe UI', Tahoma, sans-serif" },
  { label: "Georgia (Classic Serif)", value: "Georgia, serif" },
  { label: "Roboto (Clean Standard)", value: "Roboto, sans-serif" },
  { label: "JetBrains Mono (Monospace)", value: "'JetBrains Mono', monospace" },
  { label: "Courier New (Typewriter)", value: "'Courier New', Courier, monospace" },
];

export type DocumentType =
  | "invoice"
  | "quotation"
  | "proforma"
  | "thermal"
  | "barcode"
  | "qrcode"
  | "pricetag"
  | "challan"
  | "custom"
  | "credit_note"
  | "debit_note"
  | "purchase_invoice"
  | "purchase_order";

export interface PrintTemplate {
  id: string;
  name: string;
  category: "invoices" | "thermal" | "barcodes" | "qrcodes" | "pricetag" | "challan" | "custom";
  docType: DocumentType;
  description: string;
  isDefault: boolean;
  paperSize: string; // "A4" | "A5" | "Letter" | "80mm" | "58mm" | "50x25mm" | "38x25mm" | "100x50mm" | "50x30mm"
  orientation: "portrait" | "landscape";
  margins: "normal" | "narrow" | "wide" | "none";
  primaryColor: string;
  paperBgColor?: string;
  fontFamily: string;
  logoUrl?: string;
  headerTitle?: string;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  gstin?: string;
  cin?: string;
  pan?: string;
  email?: string;
  sellerStateCode?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branchName?: string;
  accountHolderName?: string;
  stampAlign?: "left" | "center" | "right";
  footerText?: string;
  termsText?: string;
  termsAndConditionsText?: string;
  bankDetails?: string;
  thankYouNote?: string;
  customTaglineText?: string;

  // Thermal Hardware & Darkness Specific Settings
  fontDensity?: "normal" | "compact" | "large";
  printClarity?: "ultra_dark" | "crisp_mono" | "compact" | "standard";
  dividerStyle?: "dashed" | "solid" | "dotted" | "double" | "star";
  thermalFontFamily?: "monospace" | "sans-serif" | "clean" | "terminal" | "courier";
  branchName?: string;
  headerTagline?: string;
  declarationText?: string;
  googleReviewUrl?: string;
  upiId?: string;
  qrType?: "upi" | "einvoice" | "url";
  signatureUrl?: string;
  stampUrl?: string;
  customQrUrl?: string;
  signatoryLabel?: string;
  showPaidInFullStamp?: boolean;
  showDeclaration?: boolean;
  showFooterNote?: boolean;
  showStamp?: boolean;
  showSignature?: boolean;
  showGoogleReviewQR?: boolean;
  payeeName?: string;

  // Thermal Dynamic Custom Fields & Columns
  customFields?: Array<{ id: string; name: string; value?: string; enabled: boolean }>;
  customItemColumns?: Array<{ id: string; name: string; enabled: boolean }>;

  themeName?: string; // "stylish" | "luxury" | "adv_tally" | "adv_gst" | "billbook" | "modern" | "simple" | "marg_pharma" | "fmcg_distributor" | "parle_teal" | "agri_seeds" | "culture_up" | "culture_god" | "jain" | "maharashtra" | "ganesh" | "hindu_god" | "shubh_labh" | "royal_gold" | "corporate" | "compact" | "minimal" | "elegant" | "advanced" | "supermarket" | "pharma"
  barcodeHeight?: number;
  barcodeSymbology?: "Auto" | "Code-128" | "EAN-13" | "Code-39" | "QR";
  showBarcodeText?: boolean;
  pricePrefix?: string;
  spPrefix?: string;
  mrpPrefix?: string;
  skuPrefix?: string;
  spBadgeStyle?: string;
  mrpStrikeColor?: string;
  showDiscountBadge?: boolean;
  borderStyle?: string;
  borderRadius?: string;
  textAlign?: "left" | "center" | "right" | "justify";
  isBoldProductName?: boolean;
  isUppercaseCompany?: boolean;
  elements?: BarcodeElementBlock[];
  customTexts?: Record<string, string>;

  // Watermark Customization
  showWatermark?: boolean;
  watermarkType?: "text" | "image";
  watermarkText?: string;
  watermarkImage?: string;
  watermarkOpacity?: number;

  // Decorative ThemeStore Background Settings
  decorativeThemeId?: string;
  decorativeHeader?: string;

  // Toggleable Elements
  fields: {
    showHeader?: boolean;
    showLogo?: boolean;
    showCompanyDetails?: boolean;
    showInvoiceDetails?: boolean;
    showItemTable?: boolean;
    showTaxSplit?: boolean;
    showTotals?: boolean;
    showTerms?: boolean;
    showFooter?: boolean;
    showBarcode?: boolean;
    showQR?: boolean;
    showProductImage?: boolean;
    showCustomerDetails?: boolean;
    showPaymentDetails?: boolean;
    showSignature?: boolean;
    showThankYou?: boolean;

    // Additional granular fields
    showProductName?: boolean;
    showPrice?: boolean;
    showMRP?: boolean;
    showSKU?: boolean;
    showBarcodeGraphic?: boolean;
    showMfgExpDate?: boolean;
    showCategoryBrand?: boolean;
    showCompanyName?: boolean;
    showCustomTagline?: boolean;
    showHSN?: boolean;
    showBankDetails?: boolean;
    showPartyBalance?: boolean;
    showItemDescription?: boolean;
    showTime?: boolean;

    // MyBillBook Thermal Granular Fields
    showPoNumber?: boolean;
    showEwayBill?: boolean;
    showVehicleNumber?: boolean;
    showChallanNumber?: boolean;
    showBillTo?: boolean;
    showShipTo?: boolean;
    showPlaceOfSupply?: boolean;
    showPartyPhone?: boolean;
    showPartyEmail?: boolean;
    showPartyGstin?: boolean;
    showPartyDlNumber?: boolean;
    showPartyDl?: boolean;
    showCustomerDl?: boolean;
    showDlNumber?: boolean;
    showPartyPan?: boolean;
    showContactPerson?: boolean;
    showCustomerEmail?: boolean;
    showCustomerPhone?: boolean;
    showCustomerGstin?: boolean;
    showCustomerPan?: boolean;
    showDeclaration?: boolean;
    showItemIndex?: boolean;
    showItemQty?: boolean;
    showItemRate?: boolean;
    showItemAmount?: boolean;
    showBatchNumber?: boolean;
    showExpMfgDates?: boolean;
    showDiscountCol?: boolean;
    showGstRateCol?: boolean;
    showSubtotal?: boolean;
    showTaxableAmount?: boolean;
    showTaxBreakup?: boolean;
    showTotalAmount?: boolean;
    showYouSaved?: boolean;
    showReceivedAmount?: boolean;
    showBalanceAmount?: boolean;
    showSecondaryUnit?: boolean;
    showAmountInWords?: boolean;
  };
  createdAt: string;
}

const DEFAULT_ELEMENT_TOGGLES = {
  showHeader: true,
  showLogo: true,
  showCompanyDetails: true,
  showInvoiceDetails: true,
  showItemTable: true,
  showTaxSplit: true,
  showTotals: true,
  showTerms: true,
  showFooter: true,
  showBarcode: true,
  showQR: true,
  showProductImage: false,
  showCustomerDetails: true,
  showPaymentDetails: true,
  showSignature: true,
  showThankYou: true,
  showProductName: true,
  showPrice: true,
  showMRP: true,
  showSKU: true,
  showBarcodeGraphic: true,
  showMfgExpDate: true,
  showCategoryBrand: true,
  showCompanyName: true,
  showCustomTagline: true,
  showHSN: true,
  showBankDetails: true,
  showPartyBalance: true,
  showItemDescription: true,
  showTime: true,

  // MyBillBook Thermal Defaults
  showPoNumber: false,
  showEwayBill: false,
  showVehicleNumber: false,
  showChallanNumber: false,
  showBillTo: true,
  showShipTo: true,
  showPlaceOfSupply: true,
  showPartyPhone: true,
  showPartyEmail: true,
  showPartyGstin: true,
  showPartyDlNumber: true,
  showPartyDl: true,
  showCustomerDl: true,
  showDlNumber: true,
  showPartyPan: true,
  showContactPerson: true,
  showCustomerEmail: true,
  showCustomerPhone: true,
  showCustomerGstin: true,
  showCustomerPan: true,
  showDeclaration: true,
  showItemIndex: true,
  showItemQty: true,
  showItemRate: true,
  showItemAmount: true,
  showBatchNumber: true,
  showExpMfgDates: true,
  showDiscountCol: true,
  showGstRateCol: true,
  showSubtotal: true,
  showTaxableAmount: true,
  showTaxBreakup: true,
  showTotalAmount: true,
  showYouSaved: true,
  showReceivedAmount: true,
  showBalanceAmount: true,
  showSecondaryUnit: true,
};

export interface ThemeStoreItem {
  id: string;
  name: string;
  category: string;
  badge?: string;
  primaryColor: string;
  paperBgColor: string;
  watermarkText?: string;
  decorativeHeader?: string;
  themeStyle: string;
  description: string;
  previewGradient: string;
  iconType: "none" | "jain" | "maharashtra" | "ganesh" | "hindu_god" | "shubh_labh" | "royal_gold" | "corporate";
}

export const THEME_STORE_BACKGROUNDS: ThemeStoreItem[] = [
  {
    id: "ts-original",
    name: "Original (None)",
    category: "Standard Clean",
    badge: "DEFAULT",
    primaryColor: "#4f46e5",
    paperBgColor: "#ffffff",
    watermarkText: "",
    decorativeHeader: "",
    themeStyle: "original",
    description: "Revert to standard clean invoice theme without decorative art or watermark.",
    previewGradient: "from-slate-100 via-white to-slate-200",
    iconType: "none",
  },
  {
    id: "ts-corporate",
    name: "Corporate Minimal",
    category: "Modern Corporate",
    badge: "CLEAN",
    primaryColor: "#4f46e5",
    paperBgColor: "#ffffff",
    watermarkText: "AUTHENTIC TAX INVOICE",
    decorativeHeader: "OFFICIAL COMMERCIAL INVOICE",
    themeStyle: "corporate",
    description: "Crisp contemporary geometric background with sleek high-contrast borders.",
    previewGradient: "from-indigo-50 via-slate-50 to-blue-100",
    iconType: "corporate",
  },
  {
    id: "ts-shubh-labh",
    name: "Shubh Labh",
    category: "Traditional Business",
    badge: "VEDIC",
    primaryColor: "#dc2626",
    paperBgColor: "#fff1f2",
    watermarkText: "॥ शुभ लाभ ॥",
    decorativeHeader: "॥ श्री ॥ शुभ लाभ ॥ रिद्धि सिद्धि ॥",
    themeStyle: "shubh_labh",
    description: "Traditional Indian vyapar invoice with auspicious prosperity blessings.",
    previewGradient: "from-rose-100 via-red-50 to-orange-100",
    iconType: "shubh_labh",
  },
  {
    id: "ts-royal-gold",
    name: "Royal Gold",
    category: "Luxury & Executive",
    badge: "PREMIUM",
    primaryColor: "#a16207",
    paperBgColor: "#fefce8",
    watermarkText: "LUXURY GOLD",
    decorativeHeader: "ROYAL EXCLUSIVE INVOICE",
    themeStyle: "royal_gold",
    description: "Ornate gold filigree border with subtle vintage damask background watermark.",
    previewGradient: "from-yellow-100 via-amber-50 to-yellow-200",
    iconType: "royal_gold",
  },
];

const INITIAL_TEMPLATES: PrintTemplate[] = [
  // ─── 1. GST & COMMERCIAL INVOICES ───
  ...(GLOBAL_INVOICE_TEMPLATES as any[]),
  {
    id: "tpl-inv-gst-tally",
    name: "GST Tally (myBillBook Style)",
    category: "invoices",
    docType: "invoice",
    description: "Advanced GST / Tally A4 format matching myBillBook: party bill-to/ship-to, HSN + GST slab summary, amount-in-words, and previous/current party balance.",
    isDefault: false,
    paperSize: "A4",
    orientation: "portrait",
    margins: "narrow",
    primaryColor: "#0f172a",
    paperBgColor: "#ffffff",
    fontFamily: "Inter, sans-serif",
    headerTitle: "TAX INVOICE",
    themeName: "gst_tally",
    fields: {
      ...DEFAULT_ELEMENT_TOGGLES,
      showHSN: true,
      showTaxSplit: true,
      showBankDetails: true,
      showPartyBalance: true,
      showItemDescription: true,
      showBillTo: true,
      showShipTo: true,
      showPlaceOfSupply: true,
      showPartyPhone: true,
      showPartyGstin: true,
      showItemIndex: true,
      showItemQty: true,
      showItemRate: true,
      showGstRateCol: true,
      showSubtotal: true,
      showTaxableAmount: true,
      showTaxBreakup: true,
      showTotalAmount: true,
      showAmountInWords: true,
      showReceivedAmount: true,
      showBalanceAmount: true,
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-inv-marg",
    name: "Marg Pharma Replica Theme",
    category: "invoices",
    docType: "invoice",
    description: "Pharmaceutical & medical distributor billing with Batch, Expiry, Pack size, Free schemes & GST split.",
    isDefault: false,
    paperSize: "A4",
    orientation: "portrait",
    margins: "narrow",
    primaryColor: "#e11d48",
    fontFamily: "Inter, sans-serif",
    headerTitle: "TAX INVOICE",
    themeName: "marg_pharma",
    fields: { ...DEFAULT_ELEMENT_TOGGLES, showHSN: true, showTaxSplit: true },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-inv-fmcg",
    name: "FMCG Distributor Theme",
    category: "invoices",
    docType: "invoice",
    description: "FMCG wholesale distribution template with case units, trade schemes, and multi-tier tax summary.",
    isDefault: false,
    paperSize: "A4",
    orientation: "portrait",
    margins: "narrow",
    primaryColor: "#059669",
    fontFamily: "Inter, sans-serif",
    headerTitle: "DISTRIBUTION INVOICE",
    themeName: "fmcg_distributor",
    fields: { ...DEFAULT_ELEMENT_TOGGLES, showHSN: true, showTaxSplit: true },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-inv-parle",
    name: "Parle Teal Supermarket Theme",
    category: "invoices",
    docType: "invoice",
    description: "Supermarket retail billing with teal branded headers, cashier ID, and itemized savings.",
    isDefault: false,
    paperSize: "A4",
    orientation: "portrait",
    margins: "normal",
    primaryColor: "#0f766e",
    fontFamily: "Inter, sans-serif",
    headerTitle: "RETAIL TAX INVOICE",
    themeName: "parle_teal",
    fields: { ...DEFAULT_ELEMENT_TOGGLES },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-inv-pdf-overlay",
    name: "Exact PDF Letterhead / Stationery Overlay",
    category: "invoices",
    docType: "invoice",
    description: "Upload your exact pre-printed stationery PDF or scan background and overlay live dynamic invoice fields with millimetric precision.",
    isDefault: false,
    paperSize: "A4",
    orientation: "portrait",
    margins: "none",
    primaryColor: "#0284c7",
    fontFamily: "Inter, sans-serif",
    headerTitle: "TAX INVOICE",
    themeName: "pdf_overlay",
    fields: { ...DEFAULT_ELEMENT_TOGGLES },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-inv-agri",
    name: "Agri Seeds & Fertilizer Theme",
    category: "invoices",
    docType: "invoice",
    description: "Agricultural invoice template with seed certification, lot numbers, germination % and purity.",
    isDefault: false,
    paperSize: "A4",
    orientation: "portrait",
    margins: "normal",
    primaryColor: "#15803d",
    fontFamily: "Inter, sans-serif",
    headerTitle: "AGRI SEEDS TAX INVOICE",
    themeName: "agri_seeds",
    fields: { ...DEFAULT_ELEMENT_TOGGLES, showHSN: true },
    createdAt: new Date().toISOString(),
  },

  // ─── 2. POS THERMAL RECEIPTS ───
  {
    id: "tpl-thm-mybillbook",
    name: "myBillBook Clean Thermal (2-inch / 3-inch Roll)",
    category: "thermal",
    docType: "thermal",
    description: "Exact myBillBook thermal receipt format with party details, multi-line item metadata (HSN, Batch, Mfg/Exp), item savings, and detailed tax breakup.",
    isDefault: true,
    paperSize: "80mm",
    orientation: "portrait",
    margins: "none",
    primaryColor: "#000000",
    fontFamily: "monospace",
    fontDensity: "normal",
    printClarity: "ultra_dark",
    dividerStyle: "dashed",
    headerTitle: "TAX INVOICE",
    storeName: "I Smart Bazaar",
    branchName: "Main Branch",
    storeAddress: "KK Street, Proddatur, YSR, Cuddapah, Andhra Pradesh, 516360",
    storePhone: "9849344919",
    gstin: "37AAFCOE694G1Z4",
    footerText: "THANK YOU! VISIT AGAIN",
    thankYouNote: "THANK YOU! VISIT AGAIN",
    termsText: "1. Goods once sold will not be taken back. 2. Subject to local jurisdiction only.",
    declarationText: "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.",
    upiId: "",
    googleReviewUrl: "https://g.page/r/smart-bazaar/review",
    customFields: [
      { id: "cf-1", name: "DL No", value: "20B/21B-87654", enabled: true },
      { id: "cf-2", name: "FSSAI Lic", value: "10019043002871", enabled: true },
    ],
    customItemColumns: [
      { id: "col-1", name: "Rack No", enabled: true },
      { id: "col-2", name: "Size / Color", enabled: false },
    ],
    themeName: "compact",
    fields: {
      ...DEFAULT_ELEMENT_TOGGLES,
      showPartyBalance: true,
      showItemDescription: true,
      showTime: false,
      showBillTo: true,
      showShipTo: true,
      showPlaceOfSupply: true,
      showPartyPhone: true,
      showPartyGstin: true,
      showItemIndex: true,
      showItemQty: true,
      showItemRate: true,
      showItemAmount: true,
      showMRP: true,
      showHSN: true,
      showBatchNumber: true,
      showExpMfgDates: true,
      showDiscountCol: true,
      showGstRateCol: true,
      showSubtotal: true,
      showTaxableAmount: true,
      showTaxBreakup: true,
      showTotalAmount: true,
      showYouSaved: true,
      showReceivedAmount: true,
      showBalanceAmount: true,
      showTerms: true,
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-thm-80-std",
    name: "80mm POS Standard",
    category: "thermal",
    docType: "thermal",
    description: "Standard 3-inch roll receipt with dark crisp monospace font, barcode, QR payment, and itemized summary.",
    isDefault: false,
    paperSize: "80mm",
    orientation: "portrait",
    margins: "none",
    primaryColor: "#000000",
    fontFamily: "monospace",
    fontDensity: "normal",
    printClarity: "ultra_dark",
    dividerStyle: "dashed",
    headerTitle: "CASH RECEIPT",
    storeName: "Smart Bazaar POS",
    branchName: "Main Branch",
    storeAddress: "KK Street, Proddatur, AP",
    storePhone: "9849344919",
    gstin: "37AAFCOE694G1Z4",
    footerText: "Save Paper, Save Trees!",
    thankYouNote: "Thank You! Visit Again!",
    termsText: "E. & O.E. All disputes subject to local jurisdiction.",
    upiId: "",
    customFields: [
      { id: "cf-1", name: "Counter No", value: "POS-01", enabled: true },
    ],
    customItemColumns: [],
    themeName: "advanced",
    fields: { ...DEFAULT_ELEMENT_TOGGLES, showTerms: false, showProductImage: false },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-thm-80-tax",
    name: "80mm Detailed Tax Slip",
    category: "thermal",
    docType: "thermal",
    description: "3-inch thermal receipt with complete CGST and SGST statutory item split and HSN summary.",
    isDefault: false,
    paperSize: "80mm",
    orientation: "portrait",
    margins: "none",
    primaryColor: "#000000",
    fontFamily: "monospace",
    fontDensity: "normal",
    printClarity: "ultra_dark",
    dividerStyle: "solid",
    headerTitle: "TAX RECEIPT",
    storeName: "Smart Bazaar Retail",
    branchName: "Retail Division",
    storeAddress: "Proddatur, AP",
    storePhone: "9849344919",
    gstin: "37AAFCOE694G1Z4",
    termsText: "Subject to Andhra Pradesh jurisdiction only.",
    upiId: "",
    themeName: "simple",
    fields: { ...DEFAULT_ELEMENT_TOGGLES, showTaxSplit: true, showHSN: true, showTerms: true },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-thm-58-compact",
    name: "58mm Compact Mobile Slip",
    category: "thermal",
    docType: "thermal",
    description: "2-inch mini thermal slip optimized for handheld Bluetooth mobile billing printers with ultra-dark legibility.",
    isDefault: false,
    paperSize: "58mm",
    orientation: "portrait",
    margins: "none",
    primaryColor: "#000000",
    fontFamily: "monospace",
    fontDensity: "compact",
    printClarity: "ultra_dark",
    dividerStyle: "dashed",
    headerTitle: "BILL",
    storeName: "Smart Bazaar",
    storeAddress: "Proddatur",
    storePhone: "9849344919",
    themeName: "compact",
    fields: { ...DEFAULT_ELEMENT_TOGGLES, showTerms: false, showProductImage: false, showSignature: false },
    createdAt: new Date().toISOString(),
  },

  // ─── 3. PRODUCT BARCODE LABELS ───
  {
    id: "tpl-bar-mybillbook",
    name: "myBillBook Clean Barcode (50x25mm)",
    category: "barcodes",
    docType: "barcode",
    description: "Exact myBillBook standard 50x25mm / 2-up thermal roll barcode tag with centered Business Name, Item Code, Item Name, and SP/MRP pricing.",
    isDefault: true,
    paperSize: "50x25mm",
    labelWidthMm: 50,
    labelHeightMm: 25,
    labelLayout: "1up",
    orientation: "landscape",
    margins: "none",
    primaryColor: "#000000",
    fontFamily: "Inter, sans-serif",
    textAlign: "center",
    spPrefix: "SP: ",
    mrpPrefix: "MRP: ",
    spBadgeStyle: "none",
    showMrpStrike: false,
    priceLayout: "center_offer",
    themeName: "mybillbook_clean",
    fields: { ...DEFAULT_ELEMENT_TOGGLES, showSKU: true },
    elementSettings: {
      header: { fontSize: 12, fontWeight: "700", textAlign: "center" },
      sku: { fontSize: 10, fontWeight: "600", textAlign: "center" },
      productName: { fontSize: 10, fontWeight: "600", textAlign: "center" },
      priceSp: { fontSize: 10, fontWeight: "700", textAlign: "center" },
      priceMrp: { fontSize: 10, fontWeight: "600", textAlign: "center" },
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-bar-dual-trendy",
    name: "Trendy Dual-Roll Tag (100x25mm / 2-Up)",
    category: "barcodes",
    docType: "barcode",
    description: "Standard 2-across dual thermal roll for TSC, TVS, Xprinter, and Zebra with centered SP & MRP layout.",
    isDefault: false,
    paperSize: "100x25mm",
    labelWidthMm: 100,
    labelHeightMm: 25,
    labelLayout: "2up",
    orientation: "landscape",
    margins: "none",
    primaryColor: "#0f172a",
    fontFamily: "Inter, sans-serif",
    textAlign: "center",
    spPrefix: "SP: ",
    mrpPrefix: "MRP: ",
    spBadgeStyle: "none",
    showMrpStrike: false,
    priceLayout: "center_offer",
    themeName: "trendy_offer",
    fields: { ...DEFAULT_ELEMENT_TOGGLES, showSKU: false },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-bar-fmcg",
    name: "FMCG Retail Box Label (50x30mm)",
    category: "barcodes",
    docType: "barcode",
    description: "Box packaging label with Batch, Mfg Date, Expiry Date, and Net Weight.",
    isDefault: false,
    paperSize: "50x30mm",
    labelWidthMm: 50,
    labelHeightMm: 30,
    labelLayout: "1up",
    orientation: "landscape",
    margins: "none",
    primaryColor: "#1e293b",
    fontFamily: "Inter, sans-serif",
    storeName: "Smart FMCG",
    customTaglineText: "NET WT: 500g | BATCH #402",
    themeName: "simple",
    fields: { ...DEFAULT_ELEMENT_TOGGLES },
    createdAt: new Date().toISOString(),
  },

  // ─── 4. SMART QR CODES ───
  {
    id: "tpl-qr-smart",
    name: "Smart Product QR Tag (50x25mm)",
    category: "qrcodes",
    docType: "qrcode",
    description: "2-inch square label encoding product catalog, instant UPI payment, and batch details.",
    isDefault: true,
    paperSize: "50x25mm",
    orientation: "landscape",
    margins: "none",
    primaryColor: "#4f46e5",
    fontFamily: "Inter, sans-serif",
    storeName: "Smart Bazaar",
    customTaglineText: "Scan to Pay / Verify Batch",
    themeName: "modern",
    fields: { ...DEFAULT_ELEMENT_TOGGLES },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-qr-poster",
    name: "Signage QR Poster (127x75mm)",
    category: "qrcodes",
    docType: "qrcode",
    description: "Large 5-inch high-visibility QR poster for checkout counter stands and displays.",
    isDefault: false,
    paperSize: "127x75mm",
    orientation: "landscape",
    margins: "normal",
    primaryColor: "#2563eb",
    fontFamily: "Outfit, sans-serif",
    storeName: "SMART BAZAAR SUPERSTORE",
    customTaglineText: "Scan to Pay with Any UPI App",
    themeName: "stylish",
    fields: { ...DEFAULT_ELEMENT_TOGGLES },
    createdAt: new Date().toISOString(),
  },

  // ─── 5. PRICE TAGS ───
  {
    id: "tpl-price-shelf",
    name: "Retail Shelf Price Talker (50x30mm)",
    category: "pricetag",
    docType: "pricetag",
    description: "Vibrant shelf price talker tag with high-contrast bold price, discount badge, and SKU.",
    isDefault: true,
    paperSize: "50x30mm",
    orientation: "landscape",
    margins: "none",
    primaryColor: "#dc2626",
    fontFamily: "Outfit, sans-serif",
    storeName: "Smart Bazaar Superstore",
    customTaglineText: "BEST VALUE DEAL",
    themeName: "modern",
    fields: { ...DEFAULT_ELEMENT_TOGGLES },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-price-promo",
    name: "Promotional Discount Tag (60x40mm)",
    category: "pricetag",
    docType: "pricetag",
    description: "Promotional yellow/gold badge tag for seasonal offers, clearance sales, and deals.",
    isDefault: false,
    paperSize: "60x40mm",
    orientation: "landscape",
    margins: "none",
    primaryColor: "#d97706",
    fontFamily: "Outfit, sans-serif",
    storeName: "FESTIVE SALE",
    customTaglineText: "LIMITED TIME OFFER",
    themeName: "luxury",
    fields: { ...DEFAULT_ELEMENT_TOGGLES },
    createdAt: new Date().toISOString(),
  },

  // ─── 6. DELIVERY CHALLANS ───
  {
    id: "tpl-challan-std",
    name: "Standard Delivery Challan",
    category: "challan",
    docType: "challan",
    description: "Official dispatch & transport document with vehicle number, transporter ID, and consignee sign.",
    isDefault: true,
    paperSize: "A4",
    orientation: "portrait",
    margins: "normal",
    primaryColor: "#2563eb",
    fontFamily: "Inter, sans-serif",
    headerTitle: "DELIVERY CHALLAN",
    storeName: "Smart Bazaar Logistics",
    storeAddress: "Plot No. 12, Industrial Estate, Cuddapah, Andhra Pradesh",
    storePhone: "9849344919",
    gstin: "37AAFCOE694G1Z4",
    footerText: "Goods received in good condition. Subject to local jurisdiction.",
    termsText: "1. Not for sale / Consignment transfer only.\n2. Transport carrier is responsible for goods during transit.",
    themeName: "modern",
    fields: { ...DEFAULT_ELEMENT_TOGGLES, showSignature: true },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-challan-transfer",
    name: "Inter-Branch Stock Transfer Challan",
    category: "challan",
    docType: "challan",
    description: "Internal warehouse-to-store stock transfer challan with dispatch batch numbers.",
    isDefault: false,
    paperSize: "A4",
    orientation: "portrait",
    margins: "normal",
    primaryColor: "#475569",
    fontFamily: "Inter, sans-serif",
    headerTitle: "STOCK TRANSFER CHALLAN",
    storeName: "Smart Central Warehouse",
    storeAddress: "Hub #2, Logistics Park, Hyderabad",
    storePhone: "9849344919",
    themeName: "adv_tally",
    fields: { ...DEFAULT_ELEMENT_TOGGLES, showSignature: true },
    createdAt: new Date().toISOString(),
  },

  // ─── 7. CUSTOM DOCUMENTS ───
  {
    id: "tpl-custom-doc",
    name: "Custom Enterprise Layout",
    category: "custom",
    docType: "custom",
    description: "Fully customizable blank canvas template ready to configure for any internal documentation.",
    isDefault: true,
    paperSize: "A4",
    orientation: "portrait",
    margins: "normal",
    primaryColor: "#4f46e5",
    fontFamily: "Inter, sans-serif",
    headerTitle: "CUSTOM DOCUMENT",
    storeName: "Smart Bazaar",
    storeAddress: "KK Street, Proddatur, YSR, Cuddapah, Andhra Pradesh",
    storePhone: "9849344919",
    themeName: "modern",
    fields: { ...DEFAULT_ELEMENT_TOGGLES },
    createdAt: new Date().toISOString(),
  },
];

const DOCUMENT_TYPES_CONFIG: Array<{
  type: DocumentType;
  category: "invoices" | "thermal" | "barcodes" | "qrcodes" | "pricetag" | "challan" | "custom";
  label: string;
  subtitle: string;
  icon: React.ElementType;
}> = [
    {
      type: "invoice",
      category: "invoices",
      label: "Invoice",
      subtitle: "GST & Commercial Invoice",
      icon: FileText,
    },
    {
      type: "quotation",
      category: "invoices",
      label: "Quotation",
      subtitle: "Price Quote / Estimate",
      icon: FileText,
    },
    {
      type: "proforma",
      category: "invoices",
      label: "Proforma Invoice",
      subtitle: "Preliminary Commercial Invoice",
      icon: FileText,
    },
    {
      type: "thermal",
      category: "thermal",
      label: "Thermal Receipt",
      subtitle: "POS Billing Receipt",
      icon: Receipt,
    },
    {
      type: "barcode",
      category: "barcodes",
      label: "Barcode Label",
      subtitle: "Product Barcode Labels",
      icon: ScanBarcode,
    },
    {
      type: "qrcode",
      category: "qrcodes",
      label: "QR Code",
      subtitle: "Product / Payment QR Codes",
      icon: QrCode,
    },
    {
      type: "pricetag",
      category: "pricetag",
      label: "Price Tag",
      subtitle: "Shelf Labels & Price Tags",
      icon: Tag,
    },
    {
      type: "challan",
      category: "challan",
      label: "Delivery Challan",
      subtitle: "Shipment Document",
      icon: Truck,
    },
    {
      type: "credit_note",
      category: "invoices",
      label: "Credit Note",
      subtitle: "Sales refund adjustment",
      icon: FileMinus,
    },
    {
      type: "debit_note",
      category: "invoices",
      label: "Debit Note",
      subtitle: "Charge to customer or vendor",
      icon: FileOutput,
    },
    {
      type: "purchase_invoice",
      category: "invoices",
      label: "Purchase Invoice",
      subtitle: "Vendor bill (GRN-verified)",
      icon: ShoppingCart,
    },
    {
      type: "purchase_order",
      category: "invoices",
      label: "Purchase Order",
      subtitle: "Outbound PO to supplier",
      icon: ClipboardList,
    },
    {
      type: "custom",
      category: "custom",
      label: "Custom Document",
      subtitle: "Create your own template",
      icon: FilePlus2,
    },
  ];

// ── Per-document-category slot definitions ───────────────────────────────
// The A4 document family keeps a clean separation: each type resolves to its
// OWN chosen template. "challan" is a local DocumentType (delivery challan);
// the invoice config library only knows invoice/quotation/proforma/estimate,
// so challan + custom document use local fallbacks instead of the config API.
type A4SlotKey =
  | "invoice"
  | "quotation"
  | "proforma"
  | "estimate"
  | "challan"
  | "credit_note"
  | "debit_note"
  | "purchase_invoice"
  | "purchase_order"
  | "custom";
const A4_SLOT_KEYS: A4SlotKey[] = [
  "invoice", "quotation", "proforma", "estimate", "challan",
  "credit_note", "debit_note", "purchase_invoice", "purchase_order", "custom",
];
const A4_SLOT_LABELS: Record<A4SlotKey, string> = {
  invoice: "TAX INVOICE",
  quotation: "QUOTATION",
  proforma: "PROFORMA",
  estimate: "ESTIMATE",
  challan: "CHALLAN",
  credit_note: "CREDIT NOTE",
  debit_note: "DEBIT NOTE",
  purchase_invoice: "PURCHASE INVOICE",
  purchase_order: "PURCHASE ORDER",
  custom: "CUSTOM",
};
// The live-preview sample title / number prefix per slot, so each doc type's
// preview + print reflects its own identity (never silently the tax invoice's).
const A4_SLOT_PREVIEWS: Record<A4SlotKey, { title: string; noPrefix: string }> = {
  invoice: { title: "TAX INVOICE", noPrefix: "INV-" },
  quotation: { title: "QUOTATION", noPrefix: "QT-" },
  proforma: { title: "PROFORMA INVOICE", noPrefix: "PI-" },
  estimate: { title: "ESTIMATE", noPrefix: "EST-" },
  challan: { title: "DELIVERY CHALLAN", noPrefix: "DC-" },
  credit_note: { title: "CREDIT NOTE", noPrefix: "CN-" },
  debit_note: { title: "DEBIT NOTE", noPrefix: "DN-" },
  purchase_invoice: { title: "PURCHASE INVOICE", noPrefix: "PINV-" },
  purchase_order: { title: "PURCHASE ORDER", noPrefix: "PO-" },
  custom: { title: "CUSTOM DOCUMENT", noPrefix: "CD-" },
};
// The clickable slots in the doc-type strip.
const A4_STRIP_SLOTS: Array<{ key: A4SlotKey; label: string }> = [
  { key: "invoice", label: "Tax Invoice" },
  { key: "quotation", label: "Quotation" },
  { key: "proforma", label: "Proforma" },
  { key: "estimate", label: "Estimate" },
  { key: "challan", label: "Challan" },
  { key: "credit_note", label: "Credit Note" },
  { key: "debit_note", label: "Debit Note" },
  { key: "purchase_invoice", label: "Purchase Invoice" },
  { key: "purchase_order", label: "Purchase Order" },
  { key: "custom", label: "Custom Document" },
];
// Resolve the slot key for the current sidebar doc type.
function slotKeyForDocType(docType: DocumentType): A4SlotKey {
  if (docType === "quotation") return "quotation";
  if (docType === "proforma") return "proforma";
  if (docType === "challan") return "challan";
  if (docType === "credit_note") return "credit_note";
  if (docType === "debit_note") return "debit_note";
  if (docType === "purchase_invoice") return "purchase_invoice";
  if (docType === "purchase_order") return "purchase_order";
  if (docType === "custom") return "custom";
  return "invoice";
}

// The note / purchase doc types (credit_note, debit_note, purchase_invoice,
// purchase_order) render through the A4 invoice template engine — same slot
// family as "invoice". Used to treat them as invoices everywhere the A4
// template set resolves. A type predicate so call sites narrow `selectedDocType`
// on both the true and false branches.
function isInvoicesFamilyDocType(
  docType: DocumentType
): docType is "invoice" | "quotation" | "proforma" | "credit_note" | "debit_note" | "purchase_invoice" | "purchase_order" {
  return (
    docType === "invoice" ||
    docType === "quotation" ||
    docType === "proforma" ||
    docType === "credit_note" ||
    docType === "debit_note" ||
    docType === "purchase_invoice" ||
    docType === "purchase_order"
  );
}

// Defensive accessors for the parallel-workstream storage helpers. They are
// imported from the same module namespace; if not yet landed we fall back to
// safeSetItem (quota-safe raw write) and a no-op purge.
function savePrintTemplateSafe(tpl: any): void {
  const fn = (receiptTemplateStore as any).savePrintTemplateSafe;
  if (typeof fn === "function") {
    fn(tpl);
    return;
  }
  // Minimal fallback: persist a single template into the tenant-scoped list.
  try {
    const tid = (typeof receiptTemplateStore.getTenantIdFromStorage === "function"
      ? receiptTemplateStore.getTenantIdFromStorage()
      : "") || "default";
    const key = `businessos_print_templates_v1_${tid}`;
    const raw = safeGetItem(key);
    let list: any[] = [];
    try { list = raw ? JSON.parse(raw) : []; } catch { list = []; }
    if (!Array.isArray(list)) list = [];
    const idx = list.findIndex((t: any) => t && (t.id === tpl.id || t.name === tpl.name));
    if (idx >= 0) list[idx] = tpl; else list.push(tpl);
    safeSetItem(key, JSON.stringify(list));
  } catch { /* ignore quota / serialization issues */ }
}
function purgeStalePrintTemplates(): void {
  const fn = (receiptTemplateStore as any).purgeStalePrintTemplates;
  if (typeof fn === "function") fn();
}

const COLOR_SWATCHES = [
  { label: "Indigo", value: "#4f46e5" },
  { label: "Blue", value: "#2563eb" },
  { label: "Sky", value: "#0284c7" },
  { label: "Emerald", value: "#059669" },
  { label: "Teal", value: "#0f766e" },
  { label: "Amber", value: "#d97706" },
  { label: "Gold", value: "#b45309" },
  { label: "Rose", value: "#e11d48" },
  { label: "Purple", value: "#9333ea" },
  { label: "Slate", value: "#334155" },
  { label: "Black", value: "#18181b" },
];

/**
 * Prune legacy / near-duplicate built-in templates that the designer no longer
 * ships. A template survives when it is a user-created design (Word Studio
 * `wordConfig`, PDF stationery overlay, or a backend org template that isn't
 * one of the built-in `tpl-` ids) or its id is in the curated keep-list.
 * Everything else (the old generic repeats: stylish, luxury, adv-tally,
 * adv-gst, billbook, minimal, elegant, clean-slate, emerald-corp,
 * culture-up, culture-god, and the trimmed thermal/barcode/qr variants)
 * is dropped from the picker.
 */
function pruneLegacyTemplates(list: PrintTemplate[]): PrintTemplate[] {
  if (!Array.isArray(list) || list.length === 0) return list;
  const keep = new Set(CURATED_BUILTIN_TEMPLATE_IDS);
  const deprecated = new Set(DEPRECATED_BUILTIN_TEMPLATE_IDS);
  const seen = new Set<string>();

  const first = list.filter((t: any) => {
    if (!t || !t.id) return true;
    // 1. Hard blocklist wins outright — these specific legacy ids are always
    //    dropped, even when the org DB returned a wordConfig/word-copy of them.
    if (deprecated.has(t.id)) return false;
    // 2. User-created / organization templates: always keep.
    const isUserWordDesign = Boolean(t.wordConfig) || Boolean(t.isWordTemplate);
    const isPdfOverlay = Boolean(t.isPdfStationeryOverlay) || Boolean(t.pdfBackgroundDataUrl);
    // 3. Built-in ids not on the curated list get pruned (unless user design).
    const looksBuiltin = /^tpl-/.test(t.id);
    if (looksBuiltin && !isUserWordDesign && !isPdfOverlay && !keep.has(t.id)) return false;
    // 4. Dedupe identical display names within the same document category so
    //    synced org copies don't produce "Custom Word-Designed Invoice" x2.
    const key = `${t.category || t.docType}::${String(t.name || "").trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return first;
}

/**
 * Enterprise template-library helpers: group the active doc-type's templates
 * into meaningful sections and render a small document thumbnail per card.
 */
function buildTemplateGroups(templates: PrintTemplate[], docType: DocumentType): Array<{ title: string; items: PrintTemplate[] }> {
  const invoiceGroup = (tpl: any): string => {
    const theme = tpl.themeName || "";
    if (theme === "gst_tally" || tpl.id === "tpl-inv-gst-tally") return "Signature · GST / Tally";
    if (["marg_pharma", "fmcg_distributor", "parle_teal", "agri_seeds"].includes(theme)) return "Industry Templates";
    if (theme === "pdf_overlay" || tpl.isPdfStationeryOverlay || tpl.id === "tpl-inv-pdf-overlay") return "PDF Stationery Overlay";
    if (theme === "word_studio" || tpl.wordConfig || tpl.isWordTemplate || tpl.id === "tpl-word-default") return "Word Studio";
    return "My Templates";
  };

  if (docType !== "invoice") {
    return [{ title: "All Layouts", items: templates }];
  }

  const order = ["Signature · GST / Tally", "Industry Templates", "Word Studio", "PDF Stationery Overlay", "My Templates"];
  const byGroup = new Map<string, PrintTemplate[]>();
  templates.forEach((tpl: any) => {
    const g = invoiceGroup(tpl);
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(tpl);
  });
  return order
    .filter((g) => byGroup.has(g))
    .map((g) => ({ title: g, items: byGroup.get(g)! }));
}

function TemplateThumb({ tpl, selected }: { tpl: any; selected: boolean }) {
  const color = tpl.primaryColor || "#4f46e5";
  const isLabel = tpl.docType === "barcode" || tpl.docType === "qrcode" || tpl.docType === "pricetag";
  const isThermal = tpl.docType === "thermal" || tpl.category === "thermal";
  const sizeChip = isLabel ? "50×25" : isThermal ? "80mm" : tpl.paperSize || "A4";
  const frame = `shrink-0 rounded-md border-2 bg-white shadow-2xs overflow-hidden ${selected ? "border-indigo-500" : "border-slate-200 dark:border-slate-600"}`;

  if (isThermal) {
    return (
      <div className={`${frame} w-[30px] aspect-[30/48] flex flex-col items-center justify-between py-1`}>
        <div className="w-3/4 h-1 rounded-sm" style={{ backgroundColor: color }} />
        <div className="w-full px-1 space-y-[3px]">
          <div className="h-0.5 w-full rounded bg-slate-300" />
          <div className="h-0.5 w-4/5 rounded bg-slate-200" />
          <div className="h-0.5 w-full rounded bg-slate-300" />
          <div className="border-t border-dashed border-slate-400 pt-[3px] h-0.5 w-3/4 rounded bg-slate-200" />
        </div>
        <div className="w-full px-1 flex justify-between text-[4px] font-black text-slate-700">
          <span>TOTAL</span>
          <span style={{ color }}>{sizeChip}</span>
        </div>
      </div>
    );
  }

  if (isLabel) {
    const isQr = tpl.docType === "qrcode";
    const isPrice = tpl.docType === "pricetag";
    return (
      <div className={`${frame} w-[46px] aspect-[46/30] p-1 flex flex-col justify-between`}>
        <div className="h-[3px] w-2/3 rounded-sm" style={{ backgroundColor: color }} />
        {isQr ? (
          <div
            className="mx-auto size-4"
            style={{
              background:
                "conic-gradient(#0f172a 25%, #fff 0 50%, #0f172a 0 75%, #fff 0)",
              backgroundSize: "4px 4px",
            }}
          />
        ) : isPrice ? (
          <div className="flex items-center gap-1">
            <span className="text-[8px] font-black leading-none" style={{ color }}>₹</span>
            <span className="text-[7px] font-black text-slate-700 leading-none">99</span>
            <span className="text-[5px] font-black text-white bg-red-500 rounded px-0.5 leading-tight">-20%</span>
          </div>
        ) : (
          <div
            className="mx-auto w-3/4 h-3"
            style={{
              background:
                "repeating-linear-gradient(90deg,#0f172a 0 1.5px,transparent 1.5px 3px)",
            }}
          />
        )}
        <div className="h-0.5 w-full rounded bg-slate-300" />
      </div>
    );
  }

  // A4 / A5 invoice-like thumbnail
  return (
    <div className={`${frame} w-[38px] aspect-[38/50] p-1 flex flex-col justify-between`}>
      <div className="space-y-[3px]">
        <div className="flex justify-between">
          <div className="h-1.5 w-4/5 rounded-sm" style={{ backgroundColor: color }} />
          <div className="text-[4px] font-black text-slate-500">INVOICE</div>
        </div>
        <div className="h-0.5 w-3/4 rounded bg-slate-200" />
        <div className="h-0.5 w-1/2 rounded bg-slate-200" />
      </div>
      <div className="space-y-[2px] flex-1 px-0.5 my-1">
        <div className="h-1 w-full rounded-sm bg-slate-100 border border-slate-200" />
        <div className="h-1 w-full rounded-sm bg-slate-100 border border-slate-200" />
        <div className="h-1 w-full rounded-sm bg-slate-100 border border-slate-200" />
        <div className="h-1 w-full rounded-sm bg-slate-100 border border-slate-200" />
      </div>
      <div className="flex items-end justify-between">
        <div className="space-y-[2px]">
          <div className="h-0.5 w-3 rounded bg-slate-200" />
          <div className="h-0.5 w-2 rounded bg-slate-200" />
        </div>
        <div className="h-2 w-1/3 rounded-sm flex items-center justify-center" style={{ backgroundColor: color }}>
          <span className="text-[4px] font-black text-white">₹</span>
        </div>
      </div>
    </div>
  );
}

export function PrintTemplates() {
  const { t } = useI18n();
  const [printBankAccounts, setPrintBankAccounts] = useState<BankAccountRecord[]>([]);

  useEffect(() => {
    bankApi.listBankAccounts({ page: 1, page_size: 50 }).then((res) => {
      if (res?.items) setPrintBankAccounts(res.items);
    }).catch(() => { });
  }, []);
  const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();
  const tenantId = tenant?.id || "default";

  // Navigation / Selection State
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>("invoice");
  // Per-document-type template slot (drives the A4 doc-type strip + live preview).
  const [selectedA4Slot, setSelectedA4Slot] = useState<A4SlotKey>("invoice");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  // Re-render trigger for invoice-category link/unlink state changes.
  const [invoiceCatLinkVersion, setInvoiceCatLinkVersion] = useState(0);
  const [activeEditorTab, setActiveEditorTab] = useState<"design" | "content" | "branding" | "settings">("design");
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isTemplateStoreModalOpen, setIsTemplateStoreModalOpen] = useState(false);
  const [isPdfOverlayModalOpen, setIsPdfOverlayModalOpen] = useState(false);
  const [isBarcodeCustomizerModalOpen, setIsBarcodeCustomizerModalOpen] = useState(false);
  const [isWordStudioOpen, setIsWordStudioOpen] = useState(false);
  const [isWordStudioBlank, setIsWordStudioBlank] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState<boolean>(false);
  const [isThermalFullViewOpen, setIsThermalFullViewOpen] = useState<boolean>(false);
  const [isInvoiceSettingsModalOpen, setIsInvoiceSettingsModalOpen] = useState(false);
  const [liveInvoiceSettings, setLiveInvoiceSettings] = useState<InvoiceSettings>(() => loadStoredInvoiceSettings(tenant?.id));
  const [settingsActiveSubTab, setSettingsActiveSubTab] = useState<
    "numbering" | "columns" | "bank_qr" | "tax_terms" | "credit_debit" | "tax_finance" | "barcode"
  >("numbering");

  // Org-level Payment QR + Signature/Stamp + Tax slab editor local state.
  const [orgPaymentQr, setOrgPaymentQr] = useState<any>(() => getOrgPaymentQrSettings(tenant?.id));
  const [orgSignature, setOrgSignature] = useState<any>(() => getOrgSignatureSettings(tenant?.id));
  const [orgSignatureAlignment, setOrgSignatureAlignment] = useState<"left" | "center" | "right">(() => (getOrgSignatureSettings(tenant?.id) as any).signatureAlignment || "right");
  const [orgReviewEnabled, setOrgReviewEnabled] = useState<boolean>(() => getActiveBillingGst(tenant?.id)?.google_review_enabled !== false);
  const [orgReviewUrl, setOrgReviewUrl] = useState<string>(() => getActiveBillingGst(tenant?.id)?.google_review_url || "");
  const [taxSlabs, setTaxSlabs] = useState<TaxCode[]>([]);
  const [newTaxRate, setNewTaxRate] = useState<string>("");
  const [newTaxName, setNewTaxName] = useState<string>("");
  const [isAddingTaxSlab, setIsAddingTaxSlab] = useState(false);

  // Refresh org-level payment QR / signature / review caches when tenant changes.
  useEffect(() => {
    setOrgPaymentQr(getOrgPaymentQrSettings(tenant?.id));
    const sig = getOrgSignatureSettings(tenant?.id);
    setOrgSignature(sig);
    setOrgSignatureAlignment((sig as any).signatureAlignment || "right");
    const gst = getActiveBillingGst(tenant?.id);
    setOrgReviewEnabled(gst?.google_review_enabled !== false);
    setOrgReviewUrl(gst?.google_review_url || "");
  }, [tenant?.id]);

  // Load active GST tax slabs for the Tax & GST sub-tab.
  useEffect(() => {
    if (settingsActiveSubTab === "tax_finance") {
      taxApi.listTaxCodes({ tax_type: "gst", is_active: true } as any)
        .then((res: any) => {
          const items = res?.items || (Array.isArray(res) ? res : []);
          setTaxSlabs(items);
        })
        .catch((err) => console.warn("Could not load tax slabs:", err));
    }
  }, [settingsActiveSubTab, tenant?.id]);

  useEffect(() => {
    setLiveInvoiceSettings(loadStoredInvoiceSettings(tenant?.id));
  }, [tenant?.id]);

  // ── Keep every numbering source in agreement with the panel's configured prefixes ──
  // This panel is the single control center for document prefixes. Whenever the
  // user edits one, sync the OTHER two authoritative layers that downstream code
  // (POS, backend document-number generation) actually reads, so a configured
  // prefix like "SVB/26-27-" is never shadowed by a stale "INV-" default:
  //   1. the org document-prefix store (getOrgDocumentPrefix, read by POS fallback)
  //   2. the backend NumberSeries row (the authoritative number source of truth)
  const s = liveInvoiceSettings;
  const seqRef = React.useRef<string>("");
  useEffect(() => {
    const key = [s.prefix, s.sequenceNumber, s.quotationPrefix, s.proformaPrefix, s.estimatePrefix,
      s.creditNotePrefix, s.debitNotePrefix, s.purchaseInvoicePrefix, s.purchaseOrderPrefix,
      s.receiptPrefix].join("|");
    if (seqRef.current === key) return;
    seqRef.current = key;
    const tid = tenant?.id;
    if (!tid) return;
    // 1. Org document-prefix store (debounced so typing a prefix doesn't fire a request
    // per keystroke — only flushes when the value settles).
    const t = setTimeout(async () => {
      try {
        setOrgDocumentPrefixes({
          invoice_prefix: s.prefix || "INV-",
          quotation_prefix: s.quotationPrefix || "QT-",
          proforma_prefix: s.proformaPrefix || "PI-",
          estimate_prefix: s.estimatePrefix || "EST-",
          credit_note_prefix: s.creditNotePrefix || "CN-",
          debit_note_prefix: s.debitNotePrefix || "DN-",
          purchase_invoice_prefix: s.purchaseInvoicePrefix || "PINV-",
          purchase_order_prefix: s.purchaseOrderPrefix || "PO-",
          receipt_prefix: s.receiptPrefix || "REC-",
        }, tid);

        // 2. Backend NumberSeries rows (authoritative). Reuse the exact module names the
        //    POS quick-settings modal syncs, so the two UIs stay consistent.
        const cid = (typeof localStorage !== "undefined" && localStorage.getItem("bos_active_company_id")) || undefined;
        const seriesRes = await numberSeriesApi.list(1, 100, cid);
        const seriesList: any[] = (seriesRes as any)?.items || (seriesRes as any)?.data || [];
        const findSeries = (m: string) => seriesList.find((x: any) => x.module_name?.toLowerCase() === m)
          || seriesList.find((x: any) => x.module_name?.toLowerCase().includes(m));
        const syncOne = async (module: string, fallbackModule: string, prefix: string, seq: number, padding: number) => {
          const existing = findSeries(module) || (fallbackModule ? findSeries(fallbackModule) : undefined);
          const cur = Math.max(0, seq - 1);
          if (existing) {
            await numberSeriesApi.update(existing.id, { prefix, current_number: cur, padding }).catch(() => { });
          } else {
            await numberSeriesApi.create({ company_id: cid, module_name: module, prefix, current_number: cur, padding, status: "active" }).catch(() => { });
          }
        };
        await syncOne("invoices", "invoice", s.prefix || "INV-", Number(s.sequenceNumber) || 1, Number(s.padding) || 4);
        await syncOne("quotations", "", s.quotationPrefix || "QT-", Number(s.quotationSequenceNumber) || 1, Number(s.quotationPadding) || 4);
        await syncOne("proforma_invoices", "proforma", s.proformaPrefix || "PI-", Number(s.proformaSequenceNumber) || 1, Number(s.proformaPadding) || 4);
      await syncOne("delivery_challans", "challan", s.challanPrefix || "DC-", Number(s.challanSequenceNumber) || 1, Number(s.challanPadding) || 4);
        await syncOne("estimates", "", s.estimatePrefix || "EST-", Number(s.estimateSequenceNumber) || 1, Number(s.estimatePadding) || 4);
        await syncOne("receipts", "receipt", s.receiptPrefix || "REC-", Number(s.receiptSequenceNumber) || 1, Number(s.receiptPadding) || 5);
        await syncOne("credit_notes", "", s.creditNotePrefix || "CN-", Number(s.creditNoteSequenceNumber) || 1, Number(s.creditNotePadding) || 4);
        await syncOne("debit_notes", "", s.debitNotePrefix || "DN-", Number(s.debitNoteSequenceNumber) || 1, Number(s.debitNotePadding) || 4);
        await syncOne("purchase_invoices", "", s.purchaseInvoicePrefix || "PINV-", Number(s.purchaseInvoiceSequenceNumber) || 1, Number(s.purchaseInvoicePadding) || 4);
        await syncOne("purchase_orders", "", s.purchaseOrderPrefix || "PO-", Number(s.purchaseOrderSequenceNumber) || 1, Number(s.purchaseOrderPadding) || 4);
      } catch (e) {
        console.warn("Could not sync document number prefixes:", e);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [s, tenant?.id]);

  // Org-level save handlers (mirror InvoiceQuickSettingsModal persistence).
  const saveOrgPaymentQr = () => {
    setOrgPaymentQrSettings({
      payment_qr_enabled: Boolean(orgPaymentQr?.enabled),
      payment_qr_type: orgPaymentQr?.type || "dynamic_upi",
      payment_qr_custom_image_url: orgPaymentQr?.customImageUrl || null,
      upi_vpa: (orgPaymentQr?.vpa || "").trim() || null,
      upi_payee_name: (orgPaymentQr?.payeeName || "").trim() || null,
      bank_name: (orgPaymentQr?.bankName || "").trim() || null,
      bank_account_number: (orgPaymentQr?.accountNumber || "").trim() || null,
      bank_ifsc: (orgPaymentQr?.ifsc || "").trim() || null,
    }, tenant?.id);
    toast.success("Payment QR & bank settings saved & applied.");
  };

  const saveOrgSignature = () => {
    setOrgSignatureSettings({
      signature_url: orgSignature?.signatureUrl || null,
      stamp_url: orgSignature?.stampUrl || null,
      signature_title: (orgSignature?.signatureTitle || "").trim() || null,
      signature_company_name: (orgSignature?.signatureCompanyName || "").trim() || null,
      show_digital_signature: orgSignature?.showDigitalSignature !== false,
      show_digital_stamp: orgSignature?.showDigitalStamp !== false,
      signature_alignment: orgSignatureAlignment,
    }, tenant?.id);
    toast.success("Signature & stamp settings saved & applied.");
  };

  const saveOrgReviewSettings = () => {
    const active = getActiveBillingGst(tenant?.id) || ({ gstin: "", trade_name: "Organization", legal_name: "Organization", state_code: "29", state_name: "State", address: "" } as any);
    setActiveBillingGst({
      ...active,
      google_review_enabled: orgReviewEnabled,
      google_review_url: (orgReviewUrl || "").trim() || null,
    } as any, tenant?.id);
    toast.success("Google Review QR settings saved & applied.");
  };

  const handleCreateTaxSlab = async () => {
    const rateNum = parseFloat(newTaxRate);
    if (isNaN(rateNum) || rateNum < 0) {
      toast.error("Please enter a valid tax rate percentage.");
      return;
    }
    setIsAddingTaxSlab(true);
    try {
      await taxApi.createTaxCode({
        code: `GST_${rateNum}%`,
        name: newTaxName.trim() || `GST ${rateNum}%`,
        rate: rateNum,
        tax_type: "gst",
        is_inclusive: false,
        is_active: true,
      } as any);
      toast.success(`GST Slab ${rateNum}% created successfully!`);
      const updated: any = await taxApi.listTaxCodes({ tax_type: "gst" } as any);
      setTaxSlabs(updated?.items || (Array.isArray(updated) ? updated : []));
      setNewTaxRate("");
      setNewTaxName("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to create tax slab.");
    } finally {
      setIsAddingTaxSlab(false);
    }
  };

  // One-time cleanup of stale / duplicate stored print templates on mount.
  useEffect(() => {
    purgeStalePrintTemplates();
  }, []);

  // Re-render on any template-list change (Word Studio saves, backend sync,
  // other components persisting print templates) — no page reload needed.
  const [templateStoreVersion, setTemplateStoreVersion] = useState(0);
  useEffect(() => {
    const refreshFromStorage = () => {
      try {
        const raw = safeGetItem(`businessos_print_templates_v1_${tenantId}`) || safeGetItem("businessos_print_templates_v1");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setTemplates((prev) => {
              const map = new Map<string, PrintTemplate>();
              prev.forEach((t) => map.set(t.id, t));
              parsed.forEach((t: any) => {
                if (t && t.id && !map.has(t.id)) map.set(t.id, t as PrintTemplate);
              });
              return pruneLegacyTemplates(Array.from(map.values()));
            });
          }
        }
      } catch { }
      // Bump version so the live preview + strip recompute fresh state.
      setTemplateStoreVersion((v) => v + 1);
    };
    window.addEventListener("print_templates_updated", refreshFromStorage);
    window.addEventListener("print-templates-updated", refreshFromStorage);
    window.addEventListener("storage", refreshFromStorage);
    return () => {
      window.removeEventListener("print_templates_updated", refreshFromStorage);
      window.removeEventListener("print-templates-updated", refreshFromStorage);
      window.removeEventListener("storage", refreshFromStorage);
    };
  }, [tenantId]);

  useEffect(() => {
    const handleUpdate = () => {
      setLiveInvoiceSettings(loadStoredInvoiceSettings(tenant?.id));
    };
    window.addEventListener("bos-invoice-settings-changed", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("bos-invoice-settings-changed", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [tenant?.id]);

  // Template Storage with automatic migration & normalization
  const [templates, setTemplates] = useState<PrintTemplate[]>(() => {
    if (typeof window !== "undefined") {
      const saved = safeGetItem(`businessos_print_templates_v1_${tenantId}`) ||
        safeGetItem(`businessos_print_templates_v1`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const normalizedSaved = parsed.map((t: any) => {
              const base = INITIAL_TEMPLATES.find((it) => it.id === t.id) ||
                INITIAL_TEMPLATES.find((it) => it.name?.toLowerCase() === t.name?.toLowerCase());
              let docType: DocumentType = t.docType || base?.docType;
              if (!docType) {
                if (t.category === "invoices") docType = "invoice";
                else if (t.category === "thermal") docType = "thermal";
                else if (t.category === "barcodes") docType = "barcode";
                else if (t.category === "qrcodes") docType = "qrcode";
                else if (t.category === "pricetag") docType = "pricetag";
                else if (t.category === "challan") docType = "challan";
                else docType = "custom";
              }
              const themeName = base?.themeName || t.themeName || (
                t.id?.includes("luxury") ? "luxury" :
                  t.id?.includes("tally") ? "adv_tally" :
                    t.id?.includes("gst") ? "adv_gst" :
                      t.id?.includes("billbook") ? "billbook" :
                        t.id?.includes("marg") ? "marg_pharma" :
                          t.id?.includes("fmcg") ? "fmcg_distributor" :
                            t.id?.includes("parle") ? "parle_teal" :
                              t.id?.includes("agri") ? "agri_seeds" :
                                t.id?.includes("modern") ? "modern" :
                                  t.id?.includes("simple") ? "simple" :
                                    t.id?.includes("culture_up") || t.id?.includes("uttar") ? "culture_up" :
                                      t.id?.includes("culture_god") || t.id?.includes("shubh") ? "culture_god" :
                                        t.id?.includes("minimal") ? "minimal" :
                                          t.id?.includes("elegant") ? "elegant" :
                                            t.id?.includes("compact") ? "compact" :
                                              t.id?.includes("clean_slate") || t.id?.includes("slate") ? "clean_slate" :
                                                t.id?.includes("emerald") ? "emerald_corp" :
                                                  "stylish"
              );
              return {
                ...(base || {}),
                ...t,
                customItemColumns: Array.isArray(t.customItemColumns) ? t.customItemColumns : (base?.customItemColumns || []),
                docType,
                themeName,
                primaryColor: t.primaryColor || base?.primaryColor || "#4f46e5",
                fontFamily: t.fontFamily || base?.fontFamily || "Inter, sans-serif",
                fields: { ...DEFAULT_ELEMENT_TOGGLES, ...(base?.fields || {}), ...(t.fields || {}) },
              };
            });
            const existingIds = new Set(normalizedSaved.map((t: any) => t.id));
            const missing = INITIAL_TEMPLATES.filter((t) => !existingIds.has(t.id));
            return pruneLegacyTemplates([...normalizedSaved, ...missing]);
          }
        } catch (e) { }
      }
    }
    return pruneLegacyTemplates(INITIAL_TEMPLATES);
  });

  // User-Active Defaults Mapping
  const [userActiveDefaults, setUserActiveDefaults] = useState<Record<string, string>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`user_active_print_templates_v1_${tenantId}`);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) { }
      }
    }
    return {};
  });

  // Directly track active template ID
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
    const activeUserTplId = userActiveDefaults[selectedDocType] || (selectedDocType === "invoice" ? userActiveDefaults.invoices : selectedDocType === "thermal" ? userActiveDefaults.thermal : selectedDocType === "barcode" ? userActiveDefaults.barcodes : undefined);
    const candidateList = (templates || []).filter((t) => {
      if (isInvoicesFamilyDocType(selectedDocType)) {
        return (t.category === "invoices" || t.docType === "invoice" || (!t.docType && !t.category)) && t.category !== "thermal" && t.docType !== "thermal" && t.category !== "barcodes";
      }
      if (selectedDocType === "thermal") return t.category === "thermal" || t.docType === "thermal";
      if (selectedDocType === "barcode") return t.category === "barcodes" || t.docType === "barcode";
      if (selectedDocType === "qrcode") return t.category === "qrcodes" || t.docType === "qrcode";
      if (selectedDocType === "pricetag") return t.category === "pricetag" || t.docType === "pricetag";
      if (selectedDocType === "challan") return t.category === "challan" || t.docType === "challan";
      if (selectedDocType === "custom") return t.category === "custom" || t.docType === "custom";
      return t.docType === selectedDocType || t.category === selectedDocType;
    });
    const match =
      (activeUserTplId && candidateList.find((t) => t.id === activeUserTplId)) ||
      candidateList.find((t) => t.isDefault) ||
      candidateList[0] ||
      INITIAL_TEMPLATES.find((t) => selectedDocType === "invoice" ? (t.category === "invoices" || t.docType === "invoice") : t.docType === selectedDocType) ||
      INITIAL_TEMPLATES[0];
    return match.id;
  });

  // Filter & sort templates strictly for current selected category/doctype
  const currentCategoryTemplates = React.useMemo(() => {
    const list = (templates || []).filter((t) => {
      if (isInvoicesFamilyDocType(selectedDocType)) {
        return (t.category === "invoices" || t.docType === "invoice" || (!t.docType && !t.category)) && t.category !== "thermal" && t.docType !== "thermal" && t.category !== "barcodes";
      }
      if (selectedDocType === "thermal") {
        return t.category === "thermal" || t.docType === "thermal";
      }
      if (selectedDocType === "barcode") {
        return t.category === "barcodes" || t.docType === "barcode";
      }
      if (selectedDocType === "qrcode") {
        return t.category === "qrcodes" || t.docType === "qrcode";
      }
      if (selectedDocType === "pricetag") {
        return t.category === "pricetag" || t.docType === "pricetag";
      }
      if (selectedDocType === "challan") {
        return t.category === "challan" || t.docType === "challan";
      }
      if (selectedDocType === "custom") {
        return t.category === "custom" || t.docType === "custom";
      }
      return t.docType === selectedDocType || t.category === selectedDocType;
    });

    if (isInvoicesFamilyDocType(selectedDocType)) {
      const builtinIds = new Set(INITIAL_TEMPLATES.map((t) => t.id));
      const globalIds = new Set((GLOBAL_INVOICE_TEMPLATES as any[]).map((g) => g.id));
      const globalOrder = new Map<string, number>(
        (GLOBAL_INVOICE_TEMPLATES as any[]).map((g, i) => [g.id, i])
      );

      const activeId = userActiveDefaults.invoice || userActiveDefaults.invoices || selectedTemplateId;

      const getRank = (t: any): number => {
        if (t.id === activeId) return 0;               // 0: currently active
        const isUserCustom = Boolean(t.wordConfig) ||   // Word Studio designed
          (!builtinIds.has(t.id) && !globalIds.has(t.id)); // user-uploaded/api template
        if (isUserCustom) return 1;                    // 1: user-designed custom
        if (globalIds.has(t.id)) return 2 + (globalOrder.get(t.id) ?? 99); // 2+: global word templates
        return 200 + Array.from(builtinIds).indexOf(t.id); // 200+: built-in templates at end
      };

      return [...list].sort((a, b) => getRank(a) - getRank(b));
    }

    return list;
  }, [templates, selectedDocType, userActiveDefaults, selectedTemplateId]);

  // ── Per-document-category template slot resolution ─────────────────────
  // The four config-known slots (invoice/quotation/proforma/estimate) use the
  // shared receipt-template-store category API. "challan" and "custom" keep
  // their own device-local active keys (falling back to the master invoice
  // template when unlinked) so they can display & print their OWN chosen
  // template instead of silently using the tax invoice's.
  // Both slots live in the shared ACTIVE_DOC_TEMPLATE_KEYS family (see
  // receipt-template-store) so they can never diverge from the invoice-family
  // slots. Tenant-scoped only — legacy unsuffixed global keys are purged.
  // Clearing wipes EVERY key family for the slot (dedicated + category-slot +
  // link-pin) so a re-linked slot falls back to master with no stale value.
  const clearDocTemplateSlot = (slot: string, tid?: string) => {
    try {
      const t = tid || receiptTemplateStore.getTenantIdFromStorage();
      const cid = typeof localStorage !== "undefined" ? localStorage.getItem("bos_active_company_id") || "" : "";
      // 1. Dedicated per-category key family (ACTIVE_DOC_TEMPLATE_KEYS).
      receiptTemplateStore.safeRemoveTenantDocTemplateId(slot, t);
      // 2. Invoice-category slot + link-pin families (mirrors the store's
      //    getInvoiceCategoryActiveKey / getInvoiceCategoryLinkKey shapes).
      safeRemoveItem(`bos_active_invoice_category_template_${t}_${slot}`);
      if (cid) safeRemoveItem(`bos_active_invoice_category_template_${t}_${slot}_${cid}`);
      safeRemoveItem(`bos_invoice_category_link_${t}_${slot}`);
      if (cid) safeRemoveItem(`bos_invoice_category_link_${t}_${slot}_${cid}`);
      window.dispatchEvent(new Event("storage"));
    } catch { }
  };

  const getChallanSlotActiveId = (): string | null => {
    try {
      return receiptTemplateStore.getActiveDocTemplateId("challan", tenantId) || null;
    } catch { return null; }
  };
  const setChallanSlotActiveId = (id: string | null) => {
    try {
      if (id) {
        receiptTemplateStore.setActiveDocTemplateId("challan", id, tenantId);
      } else {
        clearDocTemplateSlot("challan", tenantId);
      }
    } catch { }
  };
  const getCustomSlotActiveId = (): string | null => {
    try {
      return receiptTemplateStore.getActiveDocTemplateId("custom", tenantId) || null;
    } catch { return null; }
  };
  const setCustomSlotActiveId = (id: string | null) => {
    try {
      if (id) {
        receiptTemplateStore.setActiveDocTemplateId("custom", id, tenantId);
      } else {
        clearDocTemplateSlot("custom", tenantId);
      }
    } catch { }
  };
  const masterInvoiceTemplateId = (): string | null =>
    getActiveInvoicePrintTemplateForCategory("invoice" as InvoiceDocCategory, tenantId) ||
    userActiveDefaults.invoice || userActiveDefaults.invoices ||
    null;
  const masterNameForSlot = (id: string | null): string =>
    id ? (currentCategoryTemplates.find((x: any) => x.id === id)?.name || "Master invoice template") : "Master invoice template";

  // Resolve the active template id for a doc-type slot. For linked slots the
  // result follows the master invoice template; for unlinked slots it returns
  // the pinned per-category template. Returns null when nothing resolves so
  // the editor can fall back to a sensible default.
  const resolveA4SlotActiveId = (slot: A4SlotKey): string | null => {
    if (slot === "invoice") return masterInvoiceTemplateId();
    if (slot === "challan") return getChallanSlotActiveId() ?? masterInvoiceTemplateId();
    if (slot === "custom") return getCustomSlotActiveId() ?? masterInvoiceTemplateId();
    // invoice-family slots from the config library
    const direct = getActiveInvoicePrintTemplateForCategory(slot as InvoiceDocCategory, tenantId);
    return direct ?? masterInvoiceTemplateId();
  };
  // True when the slot has pinned its own template (OVERRIDE).
  const isA4SlotOverridden = (slot: A4SlotKey): boolean => {
    if (slot === "invoice") return false;
    if (slot === "challan") return Boolean(getChallanSlotActiveId());
    if (slot === "custom") return Boolean(getCustomSlotActiveId());
    return isInvoiceCategoryUnlinked(slot as InvoiceDocCategory, tenantId);
  };
  // Pin a template as this slot's own override.
  const pinA4SlotTemplate = (slot: A4SlotKey, templateId: string) => {
    if (slot === "challan") { setChallanSlotActiveId(templateId); return; }
    if (slot === "custom") { setCustomSlotActiveId(templateId); return; }
    if (slot === "invoice") {
      setActiveInvoicePrintTemplate(templateId, tenantId);
      invoicesApi.setActivePrintTemplate(templateId).catch(() => { });
      return;
    }
    // Unlink + pin this category so it stops following the master.
    setInvoiceCategoryLinked(slot as InvoiceDocCategory, false, templateId, tenantId);
    setActiveInvoicePrintTemplateForCategory(templateId, slot as InvoiceDocCategory, tenantId);
  };
  // Re-link a slot back to the master invoice template.
  const relinkA4SlotToMaster = (slot: A4SlotKey) => {
    if (slot === "challan") { setChallanSlotActiveId(null); return; }
    if (slot === "custom") { setCustomSlotActiveId(null); return; }
    setInvoiceCategoryLinked(slot as InvoiceDocCategory, true, undefined, tenantId);
  };

  // Selecting a doc-type slot loads that type's OWN template into the editor +
  // preview. Called from the doc-type strip (and kept in sync with the sidebar).
  const handleSelectA4Slot = (slot: A4SlotKey) => {
    setSelectedA4Slot(slot);
    // invoice/quotation/proforma/estimate + note/purchase types all live in the
    // invoice A4 template set (distinguished by the doc-type slot);
    // challan/custom map to their own separate template sets.
    const docTypeForSlot: DocumentType =
      slot === "challan" ? "challan"
        : slot === "quotation" ? "quotation"
          : slot === "proforma" ? "proforma"
            : slot === "custom" ? "custom"
              : slot === "credit_note" ? "credit_note"
                : slot === "debit_note" ? "debit_note"
                  : slot === "purchase_invoice" ? "purchase_invoice"
                    : slot === "purchase_order" ? "purchase_order"
                      : "invoice";
    setSelectedDocType(docTypeForSlot);
    const isInvoicesSet = !["challan", "custom", "thermal", "barcode", "qrcode", "pricetag"].includes(slot);
    const s: string = slot;
    const list = (templates || []).filter((t) => isInvoicesSet ? (t.category === "invoices" || t.docType === "invoice" || (!t.docType && !t.category)) && t.category !== "thermal" && t.docType !== "thermal" && t.category !== "barcodes" : t.category === s || t.docType === s);
    const resolved = resolveA4SlotActiveId(slot);
    const match =
      (resolved && list.find((t) => t.id === resolved)) ||
      list.find((t) => t.isDefault) ||
      list[0] ||
      INITIAL_TEMPLATES.find((t) => t.category === "invoices" || t.docType === "invoice") ||
      INITIAL_TEMPLATES[0];
    setSelectedTemplateId(match.id);
  };

  // Synchronous document selection from sidebar ensuring template ID and slot stay in sync
  const handleSelectSidebarDocType = (docType: DocumentType) => {
    setSelectedDocType(docType);
    const slot = slotKeyForDocType(docType);
    setSelectedA4Slot(slot);

    const list = (templates || []).filter((t) => {
      if (isInvoicesFamilyDocType(docType)) {
        return (t.category === "invoices" || t.docType === "invoice" || (!t.docType && !t.category)) && t.category !== "thermal" && t.docType !== "thermal" && t.category !== "barcodes";
      }
      if (docType === "thermal") return t.category === "thermal" || t.docType === "thermal";
      if (docType === "barcode") return t.category === "barcodes" || t.docType === "barcode";
      if (docType === "qrcode") return t.category === "qrcodes" || t.docType === "qrcode";
      if (docType === "pricetag") return t.category === "pricetag" || t.docType === "pricetag";
      if (docType === "challan") return t.category === "challan" || t.docType === "challan";
      if (docType === "custom") return t.category === "custom" || t.docType === "custom";
      return t.docType === docType || t.category === docType;
    });

    const activeUserTplId =
      docType === "barcode" ? (userActiveDefaults.barcode || userActiveDefaults.barcodes)
      : docType === "thermal" ? userActiveDefaults.thermal
      : isInvoicesFamilyDocType(docType) ? (resolveA4SlotActiveId(slot) || userActiveDefaults.invoice || userActiveDefaults.invoices)
      : userActiveDefaults[docType];

    const match =
      (activeUserTplId && list.find((t) => t.id === activeUserTplId)) ||
      list.find((t) => t.isDefault) ||
      list[0] ||
      INITIAL_TEMPLATES.find((t) => isInvoicesFamilyDocType(docType) ? (t.category === "invoices" || t.docType === "invoice") : t.docType === docType);

    if (match) {
      setSelectedTemplateId(match.id);
    }
  };

  // Fetch DB print templates from backend on mount so all users see organization templates
  useEffect(() => {
    printTemplatesApi.getTemplates().then((res) => {
      if (res?.templates && res.templates.length > 0) {
        setTemplates((prev) => {
          const map = new Map<string, PrintTemplate>();
          prev.forEach((t) => map.set(t.id, t));
          res.templates.forEach((t: any) => {
            if (t && t.id) {
              const existing = map.get(t.id);
              const base = INITIAL_TEMPLATES.find((it) => it.id === t.id) ||
                INITIAL_TEMPLATES.find((it) => it.name?.toLowerCase() === t.name?.toLowerCase());
              map.set(t.id, {
                ...(base || {}),
                ...(existing || {}),
                ...t,
                fields: {
                  ...DEFAULT_ELEMENT_TOGGLES,
                  ...(base?.fields || {}),
                  ...(existing?.fields || {}),
                  ...(t?.fields || {}),
                  showLogo: t?.fields?.showLogo ?? (existing?.fields as any)?.showLogo ?? (t as any)?.showLogo ?? true,
                },
              });
            }
          });
          return pruneLegacyTemplates(Array.from(map.values()));
        });
      }
      if (res?.active_map) {
        const unifiedMap: Record<string, string> = { ...res.active_map };
        if (res.active_map.barcodes) {
          unifiedMap.barcode = res.active_map.barcodes;
          unifiedMap.barcodes = res.active_map.barcodes;
        }
        if (res.active_map.invoices) {
          unifiedMap.invoice = res.active_map.invoices;
          unifiedMap.invoices = res.active_map.invoices;
        }
        if (res.active_map.thermal) {
          unifiedMap.thermal = res.active_map.thermal;
        }
        setUserActiveDefaults((prev) => ({ ...prev, ...unifiedMap }));

        // Automatically select the organization active template for the current category if valid!
        const activeId =
          selectedDocType === "barcode"
            ? (unifiedMap.barcode || unifiedMap.barcodes)
            : selectedDocType === "thermal"
              ? unifiedMap.thermal
              : selectedDocType === "invoice"
                ? (unifiedMap.invoice || unifiedMap.invoices)
                : unifiedMap[selectedDocType];

        if (activeId) {
          const exists = templates.some(
            (t) =>
              t.id === activeId &&
              (selectedDocType === "invoice"
                ? (t.category === "invoices" || t.docType === "invoice") && t.category !== "thermal"
                : selectedDocType === "thermal"
                  ? t.category === "thermal" || t.docType === "thermal"
                  : selectedDocType === "barcode"
                    ? t.category === "barcodes" || t.docType === "barcode"
                    : true)
          );
          if (exists) {
            setSelectedTemplateId(activeId);
          }
        }
      }
    }).catch(() => { });
  }, [tenantId, selectedDocType]);

  // Derived active template object strictly scoped to current category with guaranteed safe fields
  const rawActiveTemplate: PrintTemplate =
    currentCategoryTemplates.find((t) => t.id === selectedTemplateId) ||
    currentCategoryTemplates.find((t) => t.isDefault) ||
    currentCategoryTemplates[0] ||
    INITIAL_TEMPLATES.find((t) => (selectedDocType === "invoice" ? (t.category === "invoices" || t.docType === "invoice") : t.docType === selectedDocType)) ||
    INITIAL_TEMPLATES[0];

  const activeTemplate: PrintTemplate = React.useMemo(() => {
    const raw = rawActiveTemplate || INITIAL_TEMPLATES[0];
    const base = INITIAL_TEMPLATES.find((it) => it.id === raw.id) ||
      INITIAL_TEMPLATES.find((it) => it.name?.toLowerCase() === raw.name?.toLowerCase());
    return {
      ...(base || {}),
      ...raw,
      fields: {
        ...DEFAULT_ELEMENT_TOGGLES,
        ...(base?.fields || {}),
        ...((raw as any)?.fields || {}),
        showLogo: (raw as any)?.fields?.showLogo ?? (raw as any)?.showLogo ?? true,
      },
    };
  }, [rawActiveTemplate]);

  const activeBillingGst = getActiveBillingGst(tenant?.id);

  const tenantRawObj = (tenant as any)?.raw || tenant || {};
  const tenantAddress = (
    tenant?.address ||
    tenantRawObj?.address ||
    tenantRawObj?.settings?.address ||
    [tenantRawObj?.city || tenant?.city, tenantRawObj?.state || tenant?.state, tenantRawObj?.country || tenant?.country, tenantRawObj?.pincode || tenant?.pincode].filter(Boolean).join(', ')
  ).trim();

  const tenantPhone = (tenant?.phone || tenantRawObj?.phone || tenantRawObj?.settings?.phone || '').trim();
  const tenantGstin = (tenant?.gst_number || tenant?.gstin || tenantRawObj?.gst_number || tenantRawObj?.gstin || tenantRawObj?.settings?.gstin || '').trim();

  const isDummyAddress = (addr?: string | null): boolean => {
    if (!addr || !addr.trim()) return true;
    const lower = addr.toLowerCase().trim();
    if (lower.includes('kk street') || lower.includes('123 commercial hub') || lower.includes('mandi road, proddatur') || lower.includes('apmc yard') || lower.includes('main market, proddatur') || lower.includes('hospital road, proddatur')) {
      return true;
    }
    if (lower.includes('proddatur') && !tenantAddress.toLowerCase().includes('proddatur') && !activeBillingGst?.address?.toLowerCase().includes('proddatur')) {
      return true;
    }
    return false;
  };

  const isDummyPhone = (ph?: string | null): boolean => {
    if (!ph || !ph.trim()) return true;
    return ph.includes('9849344919') && !tenantPhone.includes('9849344919') && !activeBillingGst?.phone?.includes('9849344919');
  };

  const isDummyGstin = (gst?: string | null): boolean => {
    if (!gst || !gst.trim()) return true;
    return (gst.includes('37AABCCH694G1Z4') || gst.includes('37AAFCOE694G1Z4') || gst.includes('37AAFC16694B1Z4')) &&
      !tenantGstin.includes(gst) &&
      !activeBillingGst?.gstin?.includes(gst);
  };

  // Dynamic Store Name Resolution
  const resolvedStoreName =
    activeBillingGst?.trade_name ||
    activeBillingGst?.legal_name ||
    tenant?.name ||
    (activeTemplate?.storeName && activeTemplate.storeName.trim() !== "" && !activeTemplate.storeName.includes("Organization") && !activeTemplate.storeName.includes("Smart Bazaar") ? activeTemplate.storeName : "") ||
    "Store";

  // Dynamic Logo Resolution
  const resolvedLogoUrl = resolveImageUrl(activeTemplate?.logoUrl || activeBillingGst?.logo_url || tenant?.logo_url || (tenant as any)?.raw?.logo_url || "") || "/Logo.png";

  // Dynamic Address Resolution
  const resolvedAddress =
    (activeBillingGst?.address && !isDummyAddress(activeBillingGst.address) ? activeBillingGst.address : '') ||
    (tenantAddress && !isDummyAddress(tenantAddress) ? tenantAddress : '') ||
    (activeTemplate?.storeAddress && !isDummyAddress(activeTemplate.storeAddress) ? activeTemplate.storeAddress : '') ||
    activeBillingGst?.address ||
    tenantAddress ||
    '';

  // Dynamic Phone Resolution
  const resolvedPhone =
    (activeBillingGst?.phone && !isDummyPhone(activeBillingGst.phone) ? activeBillingGst.phone : '') ||
    (tenantPhone && !isDummyPhone(tenantPhone) ? tenantPhone : '') ||
    (activeTemplate?.storePhone && !isDummyPhone(activeTemplate.storePhone) ? activeTemplate.storePhone : '') ||
    activeBillingGst?.phone ||
    tenantPhone ||
    '';

  // Dynamic GSTIN Resolution
  const resolvedGstin =
    (activeBillingGst?.gstin && !isDummyGstin(activeBillingGst.gstin) ? activeBillingGst.gstin : '') ||
    (tenantGstin && !isDummyGstin(tenantGstin) ? tenantGstin : '') ||
    (activeTemplate?.gstin && !isDummyGstin(activeTemplate.gstin) ? activeTemplate.gstin : '') ||
    '';

  // Persist templates to safe localStorage + the receipt-template-store active
  // setters + the backend database. No raw localStorage.setItem in this file.
  const persistTemplates = (newTemplates: PrintTemplate[]) => {
    setTemplates(newTemplates);
    const currentActive =
      newTemplates.find((t) => t.id === selectedTemplateId) ||
      newTemplates.find((t) => t.id === activeTemplate?.id) ||
      activeTemplate;
    // The template list is stored once, quota-safe (dedupe + prune + base64 strip).
    safeSetItem(`businessos_print_templates_v1_${tenantId}`, JSON.stringify(newTemplates));
    safeSetItem(`businessos_print_templates_v1`, JSON.stringify(newTemplates));

    const isInvoice = isInvoicesFamilyDocType(selectedDocType) || selectedDocType === "challan" || currentActive?.category === "invoices" || currentActive?.docType === "invoice";
    const isBarcode = (selectedDocType === "barcode" || currentActive?.category === "barcodes" || currentActive?.docType === "barcode") && !isInvoice;
    const isThermal = (selectedDocType === "thermal" || currentActive?.category === "thermal" || currentActive?.docType === "thermal") && !isBarcode && !isInvoice;

    const nextDefaults = {
      ...userActiveDefaults,
      ...(isInvoice ? { [selectedDocType]: currentActive.id, invoices: currentActive.id, invoice: currentActive.id } : {}),
      ...(isBarcode ? { [selectedDocType]: currentActive.id, barcodes: currentActive.id, barcode: currentActive.id } : {}),
      ...(isThermal ? { [selectedDocType]: currentActive.id, thermal: currentActive.id } : {}),
    };
    setUserActiveDefaults(nextDefaults);
    safeSetItem(`user_active_print_templates_v1_${tenantId}`, JSON.stringify(nextDefaults));
    safeSetItem(`user_active_print_templates_v1`, JSON.stringify(nextDefaults));

    try {
      if (isInvoice) {
        // Master invoice slot goes through the shared store setter (which
        // already handles the per-tenant key, default flags, backend + events).
        setActiveInvoicePrintTemplate(currentActive.id, tenantId);
        // When the user is editing a non-master doc-type (quotation / proforma /
        // estimate / challan / custom), pin that slot's active key so the exact
        // template they designed is the one that prints for that document type.
        const slot = slotKeyForDocType(selectedDocType);
        if (slot !== "invoice") pinA4SlotTemplate(slot, currentActive.id);
        printTemplatesApi.setActiveTemplate(currentActive.id, "invoices").catch(() => { });
        // Persist the full template object (wordConfig, columns, texts, QR...).
        savePrintTemplateSafe(currentActive);
        // Propagate master-invoice edits down to the receipt + barcode templates
        // so the whole template family stays consistent (labels, signature,
        // custom fields, payment-QR, branding).
        syncMasterInvoiceToReceivers(currentActive, tenantId);
      } else if (isBarcode) {
        setActiveBarcodeTemplate(currentActive.id, tenantId);
        printTemplatesApi.setActiveTemplate(currentActive.id, "barcodes").catch(() => { });
        savePrintTemplateSafe(currentActive);
      } else if (isThermal) {
        saveActiveReceiptTemplate(currentActive as any, tenantId);
        printTemplatesApi.setActiveTemplate(currentActive.id, "thermal").catch(() => { });
        savePrintTemplateSafe(currentActive);
      }

      // Persist to backend PostgreSQL DB for the organization
      if (currentActive) {
        const category = isBarcode ? "barcodes" : isThermal ? "thermal" : "invoices";
        printTemplatesApi.saveTemplate(currentActive as any, Boolean(currentActive.isDefault)).catch(() => { });
      }

      window.dispatchEvent(new CustomEvent("print_templates_updated", { detail: { template: currentActive } }));
      window.dispatchEvent(new CustomEvent("bos_invoice_template_changed", { detail: { templateId: currentActive.id } }));
      window.dispatchEvent(new CustomEvent("bos_barcode_template_changed", { detail: { templateId: currentActive.id } }));
      window.dispatchEvent(new CustomEvent("bos_receipt_template_changed", { detail: { templateId: currentActive.id } }));
    } catch (e) { }
  };

  // Field Toggles updater
  const toggleElementField = (fieldKey: keyof PrintTemplate["fields"]) => {
    const curFields = activeTemplate?.fields || DEFAULT_ELEMENT_TOGGLES;
    const nextVal = !curFields[fieldKey];
    const nextFields = {
      ...curFields,
      [fieldKey]: nextVal,
    };

    const fieldToColKey: Record<string, string> = {
      showItemIndex: "sno",
      showHSN: "hsn",
      showBatchNumber: "batch",
      showExpMfgDates: "expiry_date",
      showItemDescription: "description",
      showMRP: "mrp",
      showSecondaryUnit: "uom",
      showItemRate: "unit_price",
      showDiscountCol: "discount",
      showGstRateCol: "tax_rate",
      showItemQty: "quantity",
      showItemAmount: "total_amount",
      showSKU: "sku",
    };
    const targetColKey = fieldToColKey[fieldKey as string];

    const syncCols = (cols?: any[]) => {
      if (!cols || !Array.isArray(cols)) return cols;
      return cols.map((col) =>
        col.fieldKey === targetColKey || (targetColKey === "expiry_date" && col.fieldKey === "exp")
          ? { ...col, enabled: nextVal }
          : col
      );
    };

    const updatedTemplates = templates.map((t) => {
      if (t.id !== activeTemplate.id) return t;
      const updatedT: any = { ...t, fields: nextFields };
      if (t.columns) updatedT.columns = syncCols(t.columns);
      if (t.wordConfig?.columns) {
        updatedT.wordConfig = {
          ...t.wordConfig,
          columns: syncCols(t.wordConfig.columns),
        };
      }
      return updatedT;
    });
    persistTemplates(updatedTemplates);
  };

  // Property updater
  const updateTemplateProperty = <K extends keyof PrintTemplate>(key: K, value: PrintTemplate[K]) => {
    const updatedTemplates = templates.map((t) =>
      t.id === activeTemplate.id ? { ...t, [key]: value } : t
    );
    persistTemplates(updatedTemplates);
  };

  const updateTemplateProperties = (props: Partial<PrintTemplate> & Record<string, any>) => {
    const updatedTemplates = templates.map((t) =>
      t.id === activeTemplate.id ? { ...t, ...props } : t
    );
    persistTemplates(updatedTemplates);
  };

  const handlePartyToggle = (key: string, checked: boolean) => {
    const curFields: any = { ...(activeTemplate?.fields || DEFAULT_ELEMENT_TOGGLES) };
    const curParty: any = { ...((activeTemplate as any)?.party || {}) };
    const curBillTo: any = { ...(curParty.billTo || {}) };
    const curShipTo: any = { ...(curParty.shipTo || {}) };

    if (key === "showBillTo") {
      curFields.showBillTo = checked;
      curFields.showCustomerDetails = checked;
      curBillTo.showCompanyName = checked;
    } else if (key === "showShipTo") {
      curFields.showShipTo = checked;
      curShipTo.showShippingAddress = checked;
    } else if (key === "showPartyPhone") {
      curFields.showPartyPhone = checked;
      curFields.showCustomerPhone = checked;
      curBillTo.showPhone = checked;
    } else if (key === "showPartyEmail") {
      curFields.showPartyEmail = checked;
      curFields.showCustomerEmail = checked;
      curBillTo.showEmail = checked;
    } else if (key === "showPartyGstin") {
      curFields.showPartyGstin = checked;
      curFields.showCustomerGstin = checked;
      curBillTo.showGstin = checked;
    } else if (key === "showPartyPan") {
      curFields.showPartyPan = checked;
      curFields.showCustomerPan = checked;
      curBillTo.showPan = checked;
    } else if (key === "showPartyDlNumber") {
      curFields.showPartyDlNumber = checked;
      curFields.showPartyDl = checked;
      curFields.showCustomerDl = checked;
      curFields.showDlNumber = checked;
      curBillTo.showDlNumber = checked;
    } else if (key === "showPlaceOfSupply") {
      curFields.showPlaceOfSupply = checked;
    } else if (key === "showPartyBalance") {
      curFields.showPartyBalance = checked;
      curBillTo.showPartyBalance = checked;
    } else if (key === "showContactPerson") {
      curFields.showContactPerson = checked;
      curBillTo.showContactPerson = checked;
    }

    curParty.billTo = curBillTo;
    curParty.shipTo = curShipTo;

    updateTemplateProperties({
      fields: curFields,
      party: curParty,
    });
  };

  const isPartyFieldChecked = (key: string): boolean => {
    const f: any = activeTemplate?.fields || {};
    const party: any = (activeTemplate as any)?.party || {};
    const billTo: any = party.billTo || {};
    const shipTo: any = party.shipTo || {};

    switch (key) {
      case "showBillTo":
        return f.showBillTo !== false && f.showCustomerDetails !== false && billTo.showCompanyName !== false;
      case "showShipTo":
        return f.showShipTo !== false && shipTo.showShippingAddress !== false;
      case "showPartyPhone":
        return f.showCustomerPhone !== false && f.showPartyPhone !== false && billTo.showPhone !== false;
      case "showPartyEmail":
        return f.showCustomerEmail !== false && f.showPartyEmail !== false && billTo.showEmail !== false;
      case "showPartyGstin":
        return f.showCustomerGstin !== false && f.showPartyGstin !== false && billTo.showGstin !== false;
      case "showPartyPan":
        return f.showCustomerPan !== false && f.showPartyPan !== false && billTo.showPan !== false;
      case "showPartyDlNumber":
        return f.showDlNumber !== false && f.showPartyDl !== false && f.showCustomerDl !== false && f.showPartyDlNumber !== false && billTo.showDlNumber !== false;
      case "showPlaceOfSupply":
        return f.showPlaceOfSupply !== false;
      case "showPartyBalance":
        return f.showPartyBalance !== false && billTo.showPartyBalance !== false;
      case "showContactPerson":
        return f.showContactPerson !== false && billTo.showContactPerson !== false;
      default:
        return f[key] !== false;
    }
  };

  // A4 columns manager — edits the active template's `columns` array directly
  // (enabled toggle, header rename, alignment, reorder) so the live preview +
  // print path pick up the exact column set the user designed.
  const getA4Columns = (): any[] => {
    const tpl: any = activeTemplate;
    if (Array.isArray(tpl?.columns) && tpl.columns.length > 0) return tpl.columns;
    if (tpl?.wordConfig && Array.isArray(tpl.wordConfig.columns) && tpl.wordConfig.columns.length > 0) return tpl.wordConfig.columns;
    if (tpl?.body && Array.isArray(tpl.body.columns) && tpl.body.columns.length > 0) return tpl.body.columns;
    return DEFAULT_WORD_COLUMNS;
  };
  const updateA4Columns = (updater: (cols: any[]) => any[]) => {
    const current = getA4Columns();
    const next = updater(current);
    const updatedTemplates = templates.map((t) => {
      if (t.id !== activeTemplate.id) return t;
      const anyT: any = t;
      const nextT: any = { ...t };
      // Keep every column store in sync so the renderer's resolver sees the same set.
      nextT.columns = next.map((c: any) => ({ ...c }));
      if (anyT.wordConfig) {
        nextT.wordConfig = { ...anyT.wordConfig, columns: next.map((c: any) => ({ ...c })) };
      }
      if (anyT.body) {
        nextT.body = {
          ...anyT.body,
          columns: next
            .filter((c: any) => c.enabled !== false)
            .map((c: any) => ({ key: c.fieldKey, label: c.headerTitle, width: c.widthPercent ? `${c.widthPercent}%` : undefined, align: c.align, visible: true })),
        };
      }
      // Mirror custom columns into customItemColumns (used by thermal + label UIs).
      nextT.customItemColumns = next.filter((c: any) => c.isCustom).map((c: any) => ({
        id: c.id,
        name: c.headerTitle,
        label: c.headerTitle,
        key: c.fieldKey,
        enabled: c.enabled !== false,
      }));
      return nextT;
    });
    persistTemplates(updatedTemplates);
  };
  const addA4StandardColumn = (fieldKey: string) => {
    updateA4Columns((cols) => {
      if (cols.some((c: any) => (c.fieldKey || c.key) === fieldKey)) return cols;
      const defaults: Record<string, any> = {
        sno: { headerTitle: "S.No", align: "center", widthPercent: 5 },
        description: { headerTitle: "Description", align: "left", widthPercent: 24 },
        hsn: { headerTitle: "HSN/SAC", align: "center", widthPercent: 9 },
        batch: { headerTitle: "Batch", align: "left", widthPercent: 9 },
        expiry_date: { headerTitle: "Mfg/Exp", align: "left", widthPercent: 9 },
        uom: { headerTitle: "UOM", align: "center", widthPercent: 6 },
        tax_rate: { headerTitle: "GST %", align: "center", widthPercent: 6 },
        cgst: { headerTitle: "CGST", align: "right", widthPercent: 6 },
        sgst: { headerTitle: "SGST", align: "right", widthPercent: 6 },
        igst: { headerTitle: "IGST", align: "right", widthPercent: 6 },
        unit_price: { headerTitle: "Rate", align: "right", widthPercent: 10 },
        selling_price: { headerTitle: "SP", align: "right", widthPercent: 9 },
        mrp: { headerTitle: "MRP", align: "right", widthPercent: 9 },
        discount: { headerTitle: "Disc", align: "right", widthPercent: 7 },
        quantity: { headerTitle: "Qty", align: "center", widthPercent: 6 },
        total_amount: { headerTitle: "Amount", align: "right", widthPercent: 12 },
      };
      const d = defaults[fieldKey] || { headerTitle: fieldKey, align: "left" as const };
      return [...cols, { id: `col_${fieldKey}`, fieldKey, headerTitle: d.headerTitle, align: d.align, widthPercent: d.widthPercent, enabled: true }];
    });
  };
  const addA4CustomColumn = (name: string, source: "static" | "item_field" | "customer_field", value: string) => {
    updateA4Columns((cols) => {
      const colId = `custom_col_${Date.now()}`;
      const newCol: any = {
        id: colId,
        fieldKey: colId,
        headerTitle: name || "Custom Column",
        align: "left" as const,
        widthPercent: 10,
        enabled: true,
        isCustom: true,
        source: source || "static",
        customSourceField: value || "",
        staticValue: source === "static" ? value || "" : undefined,
      };
      // `updateA4Columns` also rewrites customItemColumns, so the value source
      // (static / item field / customer field) reaches the renderers too.
      return [...cols, newCol];
    });
    toast.success(`Custom column "${name || "Custom"}" added`);
  };
  // A4 dispatch / shipping field toggles + default values, written into the
  // template's `fields` toggles and `dispatchDefaults` so preview & print honor them.
  const setA4FieldToggle = (key: string, value: boolean) => {
    const curFields: any = { ...DEFAULT_ELEMENT_TOGGLES, ...((activeTemplate as any)?.fields || {}) };
    curFields[key] = value;
    updateTemplateProperty("fields", curFields as any);
  };
  const setA4DispatchDefault = (key: string, value: string) => {
    const anyTpl: any = activeTemplate;
    const nextDefaults = { ...(anyTpl.dispatchDefaults || {}), [key]: value };
    updateTemplateProperty("dispatchDefaults" as any, nextDefaults);
  };

  // Texts / labels updater — persists editable words into `template.texts` so
  // every A4 theme (print, PDF, email, WhatsApp) picks up user-edited labels.
  const updateTemplateTexts = (key: string, value: string) => {
    const updatedTemplates = templates.map((t) =>
      t.id === activeTemplate.id
        ? { ...t, texts: { ...(t as any).texts || {}, [key]: value } }
        : t
    );
    persistTemplates(updatedTemplates);
  };
  const resolvedInvoiceTexts = React.useMemo(
    () => resolveInvoiceTexts(activeTemplate, activeTemplate.themeName || "gst_tally"),
    [activeTemplate]
  );
  const activeTemplateTexts: Record<string, string> = (activeTemplate as any).texts || {};

  const [selectedThemeStoreId, setSelectedThemeStoreId] = useState<string | null>(activeTemplate.decorativeThemeId || null);

  // A4 Content tab — "Add Column" picker form state
  const [colAddOpen, setColAddOpen] = useState(false);
  const [newCustomName, setNewCustomName] = useState("");
  const [newCustomSource, setNewCustomSource] = useState<"static" | "item_field" | "customer_field">("static");
  const [newCustomValue, setNewCustomValue] = useState("");

  // Barcode In-Page Studio State & Handlers
  const [selectedBarcodeElementKey, setSelectedBarcodeElementKey] = useState<string>("el_product_name");
  const [barcodeSubTab, setBarcodeSubTab] = useState<"mybillbook" | "layers" | "typography" | "barcode" | "pricing" | "paper">("mybillbook");
  const [mbCustomFields, setMbCustomFields] = useState<{ id: string; label: string; fontSize: number; bold: boolean; enabled: boolean }[]>([]);
  const [mbPrinterType, setMbPrinterType] = useState<"label" | "a4">("label");
  const [isBarcodeAddMenuOpen, setIsBarcodeAddMenuOpen] = useState<boolean>(false);
  const [realCatalogProducts, setRealCatalogProducts] = useState<any[]>([]);
  const [selectedSampleProductIdx, setSelectedSampleProductIdx] = useState<number>(0);

  useEffect(() => {
    inventoryApi.getBarcodes().then((items) => {
      if (items && items.length > 0) {
        setRealCatalogProducts(
          items
            .filter((p) => Boolean(p.barcode))
            .map((p) => {
              const spNum = Number(p.selling_price) || 200;
              const mrpNum = Number(p.mrp) || (spNum ? Math.round(spNum * 1.25) : 399);
              return {
                ...p,
                selling_price: spNum,
                mrp: mrpNum,
              };
            })
        );
      }
    }).catch(() => { });
  }, []);

  const currentBarcodeElements: BarcodeElementBlock[] =
    (activeTemplate?.elements && Array.isArray(activeTemplate.elements) && activeTemplate.elements.length > 0)
      ? activeTemplate.elements.filter((el) => {
        if (el.visible === false) return false;
        if (el.id === "el_sku" && activeTemplate?.fields?.showSKU !== true && activeTemplate?.fields?.showHSN !== true) return false;
        if (el.type === "sku" && activeTemplate?.fields?.showSKU !== true) return false;
        if (el.type === "hsn" && activeTemplate?.fields?.showHSN !== true) return false;
        if (el.id === "el_footer" && activeTemplate?.fields?.showCustomTagline !== true && activeTemplate?.fields?.showMfgExpDate !== true) return false;
        return true;
      })
      : (getDefaultBarcodeElements(activeTemplate) || []).filter((el) => {
        if (el.visible === false) return false;
        if (el.id === "el_sku" && activeTemplate?.fields?.showSKU !== true && activeTemplate?.fields?.showHSN !== true) return false;
        if (el.id === "el_footer" && activeTemplate?.fields?.showCustomTagline !== true && activeTemplate?.fields?.showMfgExpDate !== true) return false;
        return true;
      });

  const selectedBarcodeElement =
    currentBarcodeElements.find(
      (el) =>
        el.id === selectedBarcodeElementKey ||
        (selectedBarcodeElementKey === "price" && (el.id === "el_price_group" || el.type === "priceGroup" || el.type === "sellingPrice")) ||
        (selectedBarcodeElementKey === "header" && (el.id === "el_company" || el.type === "companyName")) ||
        (selectedBarcodeElementKey === "companyName" && (el.id === "el_company" || el.type === "companyName")) ||
        (selectedBarcodeElementKey === "productName" && (el.id === "el_product_name" || el.type === "productName")) ||
        (selectedBarcodeElementKey === "sku" && (el.id === "el_sku" || el.type === "sku")) ||
        (selectedBarcodeElementKey === "barcode" && (el.id === "el_barcode" || el.type === "barcodeGraphic")) ||
        (selectedBarcodeElementKey === "barcodeGraphic" && (el.id === "el_barcode" || el.type === "barcodeGraphic"))
    ) || currentBarcodeElements[0];

  const setBarcodeElements = (newElements: BarcodeElementBlock[]) => {
    const updated = templates.map((t) =>
      t.id === activeTemplate.id ? { ...t, elements: newElements } : t
    );
    persistTemplates(updated);
    saveBarcodeTemplate({ ...activeTemplate, elements: newElements }, activeTemplate.isDefault);
  };

  const moveBarcodeElementUp = (id: string) => {
    const idx = currentBarcodeElements.findIndex((el) => el.id === id);
    if (idx <= 0) return;
    const updated = [...currentBarcodeElements];
    const temp = updated[idx - 1];
    updated[idx - 1] = updated[idx];
    updated[idx] = temp;
    setBarcodeElements(updated);
  };

  const moveBarcodeElementDown = (id: string) => {
    const idx = currentBarcodeElements.findIndex((el) => el.id === id);
    if (idx < 0 || idx >= currentBarcodeElements.length - 1) return;
    const updated = [...currentBarcodeElements];
    const temp = updated[idx + 1];
    updated[idx + 1] = updated[idx];
    updated[idx] = temp;
    setBarcodeElements(updated);
  };

  const moveBarcodeElementToTop = (id: string) => {
    const idx = currentBarcodeElements.findIndex((el) => el.id === id);
    if (idx <= 0) return;
    const target = currentBarcodeElements[idx];
    const updated = [target, ...currentBarcodeElements.filter((el) => el.id !== id)];
    setBarcodeElements(updated);
  };

  const moveBarcodeElementToBottom = (id: string) => {
    const idx = currentBarcodeElements.findIndex((el) => el.id === id);
    if (idx < 0 || idx === currentBarcodeElements.length - 1) return;
    const target = currentBarcodeElements[idx];
    const updated = [...currentBarcodeElements.filter((el) => el.id !== id), target];
    setBarcodeElements(updated);
  };

  const addBarcodeElement = (type: string) => {
    const labelMap: Record<string, string> = {
      companyName: "Company / Store Header",
      productName: "Product Title",
      sellingPrice: "Selling Price (SP)",
      mrp: "MRP (Strike Price)",
      priceGroup: "Price Block (SP + MRP + Discount)",
      sku: "SKU / Item Code",
      hsn: "HSN / Tax Code",
      barcodeGraphic: "Barcode Graphic",
      customText: "Custom Text / Tagline",
      category: "Category / Brand",
      batchMfgExp: "Mfg & Expiry Dates",
      divider: "Divider Line",
      discountBadge: "Discount Badge (% OFF)",
    };
    const newId = `el_${type}_${Date.now()}`;
    const newBlock: BarcodeElementBlock = {
      id: newId,
      type: type as any,
      label: labelMap[type] || type,
      visible: true,
      textAlign: activeTemplate.textAlign || "left",
      fontFamily: activeTemplate.fontFamily || "Calibri, Inter, sans-serif",
      fontSize: type === "companyName" ? 10 : type === "productName" ? 11 : type === "barcodeGraphic" ? 40 : 9,
      fontWeight: type === "companyName" || type === "productName" ? "bold" : "normal",
      color: type === "companyName" ? activeTemplate.primaryColor || "#0f172a" : "#020617",
      prefix: type === "sku" ? "SKU: " : type === "sellingPrice" ? "SP: " : type === "mrp" ? "MRP: " : type === "hsn" ? "HSN: " : "",
      customText: type === "customText" ? "Custom Label Text" : undefined,
      height: type === "barcodeGraphic" ? 40 : type === "divider" ? 1 : undefined,
      marginBottom: 2,
    };
    const selIdx = currentBarcodeElements.findIndex((el) => el.id === selectedBarcodeElementKey);
    let updated: BarcodeElementBlock[] = [];
    if (selIdx >= 0) {
      updated = [...currentBarcodeElements.slice(0, selIdx + 1), newBlock, ...currentBarcodeElements.slice(selIdx + 1)];
    } else {
      updated = [...currentBarcodeElements, newBlock];
    }
    setBarcodeElements(updated);
    setSelectedBarcodeElementKey(newId);
    setIsBarcodeAddMenuOpen(false);
    toast.success(`Added "${labelMap[type] || type}" to label`);
  };

  const removeBarcodeElement = (id: string) => {
    if (currentBarcodeElements.length <= 1) {
      toast.error("Label must have at least one element.");
      return;
    }
    const updated = currentBarcodeElements.filter((el) => el.id !== id);
    setBarcodeElements(updated);
    if (selectedBarcodeElementKey === id && updated.length > 0) {
      setSelectedBarcodeElementKey(updated[0].id);
    }
    toast.info("Element removed from label");
  };

  const duplicateBarcodeElement = (id: string) => {
    const idx = currentBarcodeElements.findIndex((el) => el.id === id);
    if (idx < 0) return;
    const orig = currentBarcodeElements[idx];
    const newBlock: BarcodeElementBlock = {
      ...JSON.parse(JSON.stringify(orig)),
      id: `el_${orig.type}_${Date.now()}`,
      label: `${orig.label} (Copy)`,
    };
    const updated = [...currentBarcodeElements.slice(0, idx + 1), newBlock, ...currentBarcodeElements.slice(idx + 1)];
    setBarcodeElements(updated);
    setSelectedBarcodeElementKey(newBlock.id);
    toast.success(`Duplicated "${orig.label}"`);
  };

  const toggleBarcodeElementVisibility = (id: string) => {
    const updated = currentBarcodeElements.map((el) => {
      if (el.id === id) {
        return { ...el, visible: el.visible === false ? true : false };
      }
      return el;
    });
    setBarcodeElements(updated);
  };

  const updateSelectedBarcodeElement = (updates: Partial<BarcodeElementBlock>) => {
    if (!selectedBarcodeElementKey) return;
    const updated = currentBarcodeElements.map((el) => {
      if (el.id === selectedBarcodeElementKey) {
        return { ...el, ...updates };
      }
      return el;
    });
    setBarcodeElements(updated);
  };

  const handleResizeBarcode = (newHeight: number, newScale?: number) => {
    updateTemplateProperty("barcodeHeight", newHeight);
    const updated = currentBarcodeElements.map((el) => {
      if (el.type === "barcodeGraphic" || el.id === selectedBarcodeElementKey) {
        return { ...el, height: newHeight, widthScale: newScale !== undefined ? newScale : el.widthScale };
      }
      return el;
    });
    setBarcodeElements(updated);
  };

  const handleResizeElement = (elementId: string, updates: { height?: number; width?: number; fontSize?: number; posX?: number; posY?: number; isFreePositioned?: boolean }) => {
    const updated = currentBarcodeElements.map((el) => {
      if (el.id === elementId) {
        return { ...el, ...updates };
      }
      return el;
    });
    setBarcodeElements(updated);
  };

  const handleMoveBarcodeElement = (elementId: string, pos: { posX: number; posY: number; isFreePositioned: boolean }) => {
    const updated = currentBarcodeElements.map((el) => {
      if (el.id === elementId) {
        return { ...el, ...pos };
      }
      return el;
    });
    setBarcodeElements(updated);
  };

  const updateBarcodeCustomText = (textKey: string, value: string) => {
    const updatedElements = currentBarcodeElements.map((el) => {
      if (el.id === textKey) {
        return { ...el, customText: value };
      }
      return el;
    });
    const nextCustomTexts = {
      ...(activeTemplate.customTexts || {}),
      [textKey]: value,
    };
    const updatedTemplates = templates.map((t) =>
      t.id === activeTemplate.id ? { ...t, elements: updatedElements, customTexts: nextCustomTexts } : t
    );
    persistTemplates(updatedTemplates);
    saveBarcodeTemplate({ ...activeTemplate, elements: updatedElements, customTexts: nextCustomTexts }, activeTemplate.isDefault);
  };

  // Helper for ThemeStore background selection (applies background art, colors & watermark across all invoice templates)
  const handleSelectThemeStoreItem = (item: ThemeStoreItem) => {
    if (item.id === "ts-original" || item.themeStyle === "original") {
      setSelectedThemeStoreId(null);
      const updated = templates.map((t) => {
        if (t.docType === "invoice" || t.category === "invoices") {
          return {
            ...t,
            primaryColor: t.themeName === "emerald_corp" ? "#059669" : t.themeName === "royal_gold" ? "#a16207" : t.themeName === "luxury" ? "#d97706" : "#4f46e5",
            paperBgColor: "#ffffff",
            watermarkText: "",
            showWatermark: false,
            watermarkOpacity: 15,
            decorativeThemeId: undefined,
            decorativeHeader: undefined,
          };
        }
        return t;
      });
      persistTemplates(updated);
      toast.success("Reverted to Original clean document theme!");
      return;
    }

    setSelectedThemeStoreId(item.id);
    const updated = templates.map((t) => {
      if (t.docType === "invoice" || t.category === "invoices") {
        return {
          ...t,
          primaryColor: item.primaryColor,
          paperBgColor: item.paperBgColor,
          watermarkText: item.watermarkText,
          showWatermark: true,
          watermarkOpacity: 18,
          decorativeThemeId: item.id,
          decorativeHeader: item.decorativeHeader,
        };
      }
      return t;
    });
    persistTemplates(updated);
    toast.success(`Applied "${item.name}" background & colors to all invoice themes!`);
  };

  // Switch to specific template in active category
  const handleSelectTemplate = (tpl: PrintTemplate) => {
    setSelectedTemplateId(tpl.id);
    const isThermal = (selectedDocType === "thermal" || tpl.docType === "thermal" || tpl.category === "thermal") && selectedDocType !== "invoice" && selectedDocType !== "barcode" && selectedDocType !== "qrcode" && selectedDocType !== "pricetag" && selectedDocType !== "challan" && selectedDocType !== "custom";
    const isBarcode = (selectedDocType === "barcode" || tpl.docType === "barcode" || tpl.category === "barcodes") && selectedDocType !== "invoice" && selectedDocType !== "thermal" && selectedDocType !== "challan";
    const isInvoice = (isInvoicesFamilyDocType(selectedDocType) || selectedDocType === "challan" || tpl.category === "invoices" || tpl.docType === "invoice") && !isThermal && !isBarcode;

    const nextUserActive = {
      ...userActiveDefaults,
      [selectedDocType]: tpl.id,
      [tpl.docType || selectedDocType]: tpl.id,
      ...(isBarcode ? { barcodes: tpl.id, barcode: tpl.id } : {}),
      ...(isThermal ? { thermal: tpl.id } : {}),
      ...(isInvoice ? { invoices: tpl.id, invoice: tpl.id } : {}),
    };
    setUserActiveDefaults(nextUserActive);
    try {
      safeSetItem(`user_active_print_templates_v1_${tenantId}`, JSON.stringify(nextUserActive));
      safeSetItem(`user_active_print_templates_v1`, JSON.stringify(nextUserActive));

      if (isInvoice) {
        // Master invoice slot via the shared store setter (also writes the
        // tenant-scoped key + syncs the backend).
        setActiveInvoicePrintTemplate(tpl.id, tenantId);
        // Pin the current doc-type slot to this template so each document type
        // displays & prints its OWN chosen design (never the master's by accident).
        const slot = slotKeyForDocType(selectedDocType);
        if (slot !== "invoice") pinA4SlotTemplate(slot, tpl.id);
        printTemplatesApi.setActiveTemplate(tpl.id, "invoices").catch(() => { });
      } else if (isThermal) {
        saveActiveReceiptTemplate(tpl as any, tenantId);
        printTemplatesApi.setActiveTemplate(tpl.id, "thermal").catch(() => { });
      } else if (isBarcode) {
        setActiveBarcodeTemplate(tpl.id, tenantId);
        printTemplatesApi.setActiveTemplate(tpl.id, "barcodes").catch(() => { });
      }
      window.dispatchEvent(new CustomEvent("print_templates_updated", { detail: { template: tpl } }));
      window.dispatchEvent(new CustomEvent("bos_invoice_template_changed", { detail: { templateId: tpl.id } }));
      window.dispatchEvent(new CustomEvent("bos_barcode_template_changed", { detail: { templateId: tpl.id } }));
      window.dispatchEvent(new CustomEvent("bos_receipt_template_changed", { detail: { templateId: tpl.id } }));
    } catch { }
    toast.info(`Switched to "${tpl.name}" layout`);
  };

  // Dedicated Input Refs
  const thermalLogoInputRef = useRef<HTMLInputElement>(null);
  const thermalSigInputRef = useRef<HTMLInputElement>(null);
  const thermalStampInputRef = useRef<HTMLInputElement>(null);
  const thermalQrInputRef = useRef<HTMLInputElement>(null);
  const watermarkImageInputRef = useRef<HTMLInputElement>(null);

  // Thermal Custom Header Fields Handlers
  const handleAddThermalCustomField = (name: string = "New Field", value: string = "") => {
    const newField = {
      id: `cf-${Date.now()}`,
      name: name || "Custom Field",
      label: name || "Custom Field",
      value: value || "",
      enabled: true,
    };
    const currentList = activeTemplate.customFields || [];
    updateTemplateProperty("customFields" as any, [...currentList, newField]);
    toast.success(`Header field "${newField.name}" added`);
  };

  const handleUpdateThermalCustomField = (id: string, updates: Partial<{ name: string; value: string; enabled: boolean; label?: string; bindKey?: string; source?: string }>) => {
    const currentList = activeTemplate.customFields || [];
    const nextList = currentList.map((f) => (f.id === id ? { ...f, ...updates } : f));
    updateTemplateProperty("customFields" as any, nextList);
  };

  const handleDeleteThermalCustomField = (id: string) => {
    const currentList = activeTemplate.customFields || [];
    const nextList = currentList.filter((f) => f.id !== id);
    updateTemplateProperty("customFields" as any, nextList);
    toast.info("Header field removed");
  };

  // Thermal & Invoice Custom Item Columns Handlers
  const handleAddThermalCustomColumn = (name: string = "New Column") => {
    const colId = `col-${Date.now()}`;
    const newCol = {
      id: colId,
      name: name || "Custom Column",
      label: name || "Custom Column",
      enabled: true,
    };
    const currentList = activeTemplate.customItemColumns || [];
    const nextList = [...currentList, newCol];

    const currentWordCols = activeTemplate.wordConfig?.columns;
    const updatedWordCols = currentWordCols
      ? [
        ...currentWordCols,
        {
          id: colId,
          fieldKey: colId,
          headerTitle: name || "Custom Column",
          widthPercent: 10,
          align: "left" as const,
          enabled: true,
          isCustom: true,
        },
      ]
      : undefined;

    const updatedTemplates = templates.map((t) => {
      if (t.id === activeTemplate.id) {
        return {
          ...t,
          customItemColumns: nextList,
          ...(updatedWordCols && t.wordConfig ? { wordConfig: { ...t.wordConfig, columns: updatedWordCols } } : {}),
        };
      }
      return t;
    });

    persistTemplates(updatedTemplates);
    toast.success(`Item column "${newCol.name}" added`);
  };

  const handleUpdateThermalCustomColumn = (id: string, updates: Partial<{ name: string; label: string; enabled: boolean }>) => {
    const currentList = activeTemplate.customItemColumns || [];
    const nextList = currentList.map((c) =>
      c.id === id
        ? {
          ...c,
          ...updates,
          name: updates.name ?? updates.label ?? c.name,
          label: updates.label ?? updates.name ?? c.label,
        }
        : c
    );

    const currentWordCols = activeTemplate.wordConfig?.columns;
    const updatedWordCols = currentWordCols
      ? currentWordCols.map((c: any) => {
        if (c.id === id || c.fieldKey === id) {
          return {
            ...c,
            ...(updates.enabled !== undefined ? { enabled: updates.enabled } : {}),
            ...(updates.label || updates.name ? { headerTitle: updates.label || updates.name } : {}),
          };
        }
        return c;
      })
      : undefined;

    const updatedTemplates = templates.map((t) => {
      if (t.id === activeTemplate.id) {
        return {
          ...t,
          customItemColumns: nextList,
          ...(updatedWordCols && t.wordConfig ? { wordConfig: { ...t.wordConfig, columns: updatedWordCols } } : {}),
        };
      }
      return t;
    });

    persistTemplates(updatedTemplates);
  };

  const handleDeleteThermalCustomColumn = (id: string) => {
    const currentList = activeTemplate.customItemColumns || [];
    const nextList = currentList.filter((c) => c.id !== id && (c as any).key !== id);

    const currentWordCols = activeTemplate.wordConfig?.columns;
    const updatedWordCols = currentWordCols
      ? currentWordCols.filter(
        (c: any) => c.id !== id && c.fieldKey !== id && c.headerTitle?.toLowerCase() !== id.toLowerCase()
      )
      : undefined;

    const currentTopCols = activeTemplate.columns;
    const updatedTopCols = currentTopCols
      ? currentTopCols.filter((c: any) => c.id !== id && c.fieldKey !== id)
      : undefined;

    const updatedTemplates = templates.map((t) => {
      if (t.id === activeTemplate.id) {
        return {
          ...t,
          customItemColumns: nextList,
          ...(updatedWordCols && t.wordConfig ? { wordConfig: { ...t.wordConfig, columns: updatedWordCols } } : {}),
          ...(updatedTopCols ? { columns: updatedTopCols } : {}),
        };
      }
      return t;
    });

    persistTemplates(updatedTemplates);
    toast.info("Item column removed");
  };

  // Thermal & Invoice Image Upload Handler
  const handleThermalImageUpload = async (
    fileOrEvent: React.ChangeEvent<HTMLInputElement> | File,
    targetProp: 'logoUrl' | 'signatureUrl' | 'stampUrl' | 'customQrUrl' | 'watermarkImage'
  ) => {
    let file: File | undefined;
    if (fileOrEvent instanceof File) {
      file = fileOrEvent;
    } else if (fileOrEvent && (fileOrEvent as any).target?.files?.[0]) {
      file = (fileOrEvent as any).target.files[0];
    }
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image file size should be less than 2MB");
      return;
    }
    try {
      const dataUrl = await compressImageForStorage(file, { maxWidth: 500, maxHeight: 300, quality: 0.85 });
      if (!dataUrl) {
        toast.error("Failed to process image");
        return;
      }
      updateTemplateProperty(targetProp as any, dataUrl);
      if (targetProp === 'logoUrl') updateTemplateProperty("fields", { ...(activeTemplate?.fields || DEFAULT_ELEMENT_TOGGLES), showLogo: true });
      if (targetProp === 'signatureUrl') {
        updateTemplateProperty("showSignature" as any, true);
        updateTemplateProperty("fields", { ...(activeTemplate?.fields || DEFAULT_ELEMENT_TOGGLES), showSignature: true });
        try {
          const curSig = getOrgSignatureSettings(tenantId) || {};
          setOrgSignatureSettings({ ...curSig, signatureUrl: dataUrl, showDigitalSignature: true }, tenantId);
        } catch { }
      }
      if (targetProp === 'stampUrl') {
        updateTemplateProperty("showStamp" as any, true);
        try {
          const curSig = getOrgSignatureSettings(tenantId) || {};
          setOrgSignatureSettings({ ...curSig, stampUrl: dataUrl, showDigitalStamp: true }, tenantId);
        } catch { }
      }
      if (targetProp === 'watermarkImage') {
        updateTemplateProperty("watermarkType" as any, "image");
        updateTemplateProperty("showWatermark", true);
      }
      toast.success("Image updated successfully");
    } catch {
      toast.error("Error processing image file");
    }
  };

  // Sync with CoreERP Org Setup
  const handleSyncWithCoreErp = async () => {
    try {
      let coreTerms: string | null = null;
      let coreStoreName: string | null = null;
      let coreAddress: string | null = null;
      let coreGstin: string | null = null;
      let corePhone: string | null = null;
      let coreEmail: string | null = null;
      let coreLogo: string | null = null;
      let coreUpi: string | null = null;
      let coreGoogleReview: string | null = null;

      // 1. Try fetching freshest company profile from backend API
      if (tenant?.id) {
        try {
          const comp = await companiesApi.get(tenant.id);
          if (comp) {
            if (comp.terms_and_conditions) coreTerms = comp.terms_and_conditions;
            if (comp.name) coreStoreName = comp.name;
            if (comp.address) coreAddress = comp.address;
            if (comp.phone) corePhone = comp.phone;
            if (comp.email) coreEmail = comp.email;
            if (comp.logo_url) coreLogo = comp.logo_url;
            if (comp.google_review_url) coreGoogleReview = comp.google_review_url;
            const primaryGst = comp.gst_registrations?.find((r) => r.is_primary) || comp.gst_registrations?.[0];
            if (primaryGst?.gstin) coreGstin = primaryGst.gstin;
            if (primaryGst?.address && !coreAddress) coreAddress = primaryGst.address;
            if (primaryGst?.trade_name && !coreStoreName) coreStoreName = primaryGst.trade_name;
          }
        } catch {
          // fallback to local caches if backend is unreachable
        }
      }

      // 2. Check active billing GST from local session store
      const activeBillingGst = getActiveBillingGst();
      if (activeBillingGst) {
        if (!coreTerms && activeBillingGst.terms_and_conditions) {
          coreTerms = activeBillingGst.terms_and_conditions;
        }
        if (!coreStoreName) {
          coreStoreName = activeBillingGst.trade_name || activeBillingGst.legal_name || null;
        }
        if (!coreAddress && activeBillingGst.address) coreAddress = activeBillingGst.address;
        if (!coreGstin && activeBillingGst.gstin) coreGstin = activeBillingGst.gstin;
        if (!corePhone && activeBillingGst.phone) corePhone = activeBillingGst.phone;
        if (!coreEmail && activeBillingGst.email) coreEmail = activeBillingGst.email;
        if (!coreLogo && activeBillingGst.logo_url) coreLogo = activeBillingGst.logo_url;
        if (!coreUpi && (activeBillingGst as any).upi_vpa) coreUpi = (activeBillingGst as any).upi_vpa;
        if (!coreGoogleReview && activeBillingGst.google_review_url) coreGoogleReview = activeBillingGst.google_review_url;
      }

      // 3. Check tenant context raw payload
      if (tenant?.raw) {
        const raw = tenant.raw;
        if (!coreTerms && raw.terms_and_conditions) coreTerms = raw.terms_and_conditions;
        if (!coreStoreName && raw.name) coreStoreName = raw.name;
        if (!coreAddress && raw.address) coreAddress = raw.address;
        if (!corePhone && raw.phone) corePhone = raw.phone;
        if (!coreEmail && raw.email) coreEmail = raw.email;
        if (!coreLogo && raw.logo_url) coreLogo = raw.logo_url;
        if (!coreGoogleReview && raw.google_review_url) coreGoogleReview = raw.google_review_url;
      }

      // 4. Check localStorage active company caches
      try {
        const tid = tenantId || tenant?.id;
        const compRaw = localStorage.getItem(`bos_active_company_${tid}`) || localStorage.getItem("bos_active_company");
        if (compRaw) {
          const parsed = JSON.parse(compRaw);
          if (!coreTerms && parsed.terms_and_conditions) coreTerms = parsed.terms_and_conditions;
          if (!coreStoreName && parsed.name) coreStoreName = parsed.name;
          if (!coreAddress && parsed.address) coreAddress = parsed.address;
          if (!corePhone && parsed.phone) corePhone = parsed.phone;
          if (!coreEmail && parsed.email) coreEmail = parsed.email;
          if (!coreLogo && parsed.logo_url) coreLogo = parsed.logo_url;
          if (!coreUpi && parsed.upi_vpa) coreUpi = parsed.upi_vpa;
          if (!coreGoogleReview && parsed.google_review_url) coreGoogleReview = parsed.google_review_url;
        }
      } catch { }

      // 5. Fallback standard CoreERP terms if still not populated
      const finalTerms =
        coreTerms?.trim() ||
        "1. Goods once sold will not be taken back or exchanged.\n2. All disputes are subject to local jurisdiction only.";

      const finalStoreName = coreStoreName || tenant?.name || activeTemplate.storeName || "My Store";
      const finalAddress = coreAddress || activeTemplate.storeAddress || "";
      const finalGstin = coreGstin || activeTemplate.gstin || "";
      const finalPhone = corePhone || activeTemplate.storePhone || "";
      const finalEmail = coreEmail || activeTemplate.storeEmail || "";
      const finalLogo = coreLogo || activeTemplate.logoUrl;
      const finalUpi = coreUpi || activeTemplate.upiId || "";
      const finalGoogleReview = coreGoogleReview || activeTemplate.googleReviewUrl;

      const updated = templates.map((t) => {
        if (t.id === activeTemplate.id) {
          return {
            ...t,
            storeName: finalStoreName,
            storeAddress: finalAddress,
            gstin: finalGstin,
            storePhone: finalPhone,
            storeEmail: finalEmail,
            termsText: finalTerms,
            termsAndConditionsText: finalTerms,
            logoUrl: finalLogo,
            upiId: finalUpi,
            googleReviewUrl: finalGoogleReview,
            signatoryLabel: `For ${finalStoreName}`,
          };
        }
        return t;
      });

      persistTemplates(updated);
      toast.success("Successfully synced store details & terms from CoreERP Org Profile!");
    } catch (err) {
      console.error("Failed to sync with CoreERP:", err);
      toast.error("Could not sync with CoreERP profile. Please try again.");
    }
  };

  // Apply Thermal Preset
  const handleApplyThermalPreset = (presetKey: 'compact' | 'advanced' | 'simple' | 'classic' | 'supermarket' | 'pharma' | 'kot') => {
    let presetUpdates: Partial<PrintTemplate> = {};
    if (presetKey === 'compact') {
      presetUpdates = {
        themeName: 'compact',
        fontDensity: 'compact',
        printClarity: 'ultra_dark',
        thermalFontFamily: 'sans-serif',
        dividerStyle: 'dashed',
        fields: {
          ...activeTemplate.fields,
          showItemDescription: true,
          showHSN: true,
          showMRP: true,
          showBatchNumber: true,
          showExpMfgDates: true,
          showDiscountCol: true,
          showGstRateCol: true,
          showSubtotal: true,
          showTaxBreakup: true,
          showYouSaved: true,
          showReceivedAmount: true,
          showBalanceAmount: true,
        }
      };
    } else if (presetKey === 'advanced') {
      presetUpdates = {
        themeName: 'advanced',
        fontDensity: 'normal',
        printClarity: 'ultra_dark',
        thermalFontFamily: 'monospace',
        dividerStyle: 'double',
        showPaidInFullStamp: true,
        fields: {
          ...activeTemplate.fields,
          showTaxSplit: true,
          showHSN: true,
          showMRP: true,
          showDiscountCol: true,
          showQR: true,
          showTerms: true,
        }
      };
    } else if (presetKey === 'simple') {
      presetUpdates = {
        themeName: 'simple',
        fontDensity: 'normal',
        printClarity: 'crisp_mono',
        thermalFontFamily: 'sans-serif',
        dividerStyle: 'dotted',
        fields: {
          ...activeTemplate.fields,
          showHSN: false,
          showTaxSplit: false,
        }
      };
    } else if (presetKey === 'classic') {
      presetUpdates = {
        themeName: 'classic',
        fontDensity: 'normal',
        printClarity: 'ultra_dark',
        thermalFontFamily: 'monospace',
        dividerStyle: 'dashed',
      };
    } else if (presetKey === 'supermarket') {
      presetUpdates = {
        themeName: 'supermarket',
        fontDensity: 'normal',
        printClarity: 'ultra_dark',
        dividerStyle: 'double',
        fields: {
          ...activeTemplate.fields,
          showMRP: true,
          showDiscountBadge: true,
          showDiscountCol: true,
          showYouSaved: true,
          showQR: true,
        }
      };
    } else if (presetKey === 'pharma') {
      presetUpdates = {
        themeName: 'pharma',
        fontDensity: 'compact',
        printClarity: 'ultra_dark',
        dividerStyle: 'solid',
        fields: {
          ...activeTemplate.fields,
          showHSN: true,
          showTaxSplit: true,
          showBatchNumber: true,
          showExpMfgDates: true,
        }
      };
    } else if (presetKey === 'kot') {
      presetUpdates = {
        themeName: 'kot',
        fontDensity: 'large',
        printClarity: 'ultra_dark',
        dividerStyle: 'solid',
        headerTitle: 'KITCHEN ORDER TICKET',
        fields: {
          ...activeTemplate.fields,
          showTaxSplit: false,
          showTotals: false,
        }
      };
    }
    const updated = templates.map((t) => (t.id === activeTemplate.id ? { ...t, ...presetUpdates } : t));
    persistTemplates(updated);
    toast.success(`Applied ${presetKey.toUpperCase()} thermal preset!`);
  };

  // Set as Organization Default
  const handleSetOrgDefault = async (tplId: string) => {
    const updated = templates.map((t) => {
      if (t.docType === selectedDocType || t.category === activeTemplate.category) {
        return { ...t, isDefault: t.id === tplId };
      }
      return t;
    });
    persistTemplates(updated);
    const targetTpl = updated.find((t) => t.id === tplId) || activeTemplate;
    const isThermal = (selectedDocType === "thermal" || targetTpl.category === "thermal" || targetTpl.docType === "thermal") && selectedDocType !== "invoice" && selectedDocType !== "barcode" && selectedDocType !== "qrcode" && selectedDocType !== "pricetag" && selectedDocType !== "challan" && selectedDocType !== "custom";
    const isBarcode = (selectedDocType === "barcode" || targetTpl.category === "barcodes" || targetTpl.docType === "barcode") && selectedDocType !== "invoice" && selectedDocType !== "thermal" && selectedDocType !== "challan";
    const isInvoice = (isInvoicesFamilyDocType(selectedDocType) || selectedDocType === "challan" || targetTpl.category === "invoices" || targetTpl.docType === "invoice") && !isThermal && !isBarcode;
    const category = isBarcode ? "barcodes" : isThermal ? "thermal" : "invoices";
    try {
      await printTemplatesApi.setActiveTemplate(tplId, category);
      await printTemplatesApi.saveTemplate(targetTpl, true);
    } catch (e) {
      console.warn("Backend setActiveTemplate error:", e);
    }
    if (isInvoice) {
      // The shared store setter writes the tenant-scoped active key, clears
      // defaults, syncs the backend and fires change events.
      setActiveInvoicePrintTemplate(tplId, tenantId);
    } else if (isThermal) {
      saveActiveReceiptTemplate(targetTpl as any, tenantId);
    } else if (isBarcode) {
      setActiveBarcodeTemplate(tplId, tenantId);
    }
    window.dispatchEvent(new CustomEvent("print_templates_updated", { detail: { template: targetTpl } }));
    window.dispatchEvent(new CustomEvent("bos_invoice_template_changed", { detail: { templateId: tplId } }));
    window.dispatchEvent(new CustomEvent("bos_barcode_template_changed", { detail: { templateId: tplId } }));
    window.dispatchEvent(new CustomEvent("bos_receipt_template_changed", { detail: { templateId: tplId } }));
    toast.success(`"${targetTpl.name}" is now the Organization Master Default!`);
  };

  // Set as Active for Me
  const handleSetActiveForMe = (tplId: string) => {
    const isThermal = (selectedDocType === "thermal" || activeTemplate.category === "thermal" || activeTemplate.docType === "thermal") && selectedDocType !== "invoice" && selectedDocType !== "barcode" && selectedDocType !== "qrcode" && selectedDocType !== "pricetag" && selectedDocType !== "challan" && selectedDocType !== "custom";
    const isBarcode = (selectedDocType === "barcode" || activeTemplate.category === "barcodes" || activeTemplate.docType === "barcode") && selectedDocType !== "invoice" && selectedDocType !== "thermal" && selectedDocType !== "challan";
    const isInvoice = (isInvoicesFamilyDocType(selectedDocType) || selectedDocType === "challan" || activeTemplate.category === "invoices" || activeTemplate.docType === "invoice") && !isThermal && !isBarcode;

    const nextDefaults = {
      ...userActiveDefaults,
      [selectedDocType]: tplId,
      [activeTemplate.docType || selectedDocType]: tplId,
      ...(isBarcode ? { barcodes: tplId, barcode: tplId } : {}),
      ...(isThermal ? { thermal: tplId } : {}),
      ...(isInvoice ? { invoices: tplId, invoice: tplId } : {}),
    };
    setUserActiveDefaults(nextDefaults);
    try {
      safeSetItem(`user_active_print_templates_v1_${tenantId}`, JSON.stringify(nextDefaults));
      safeSetItem(`user_active_print_templates_v1`, JSON.stringify(nextDefaults));
      if (isInvoice) {
        setActiveInvoicePrintTemplate(tplId, tenantId);
        printTemplatesApi.setActiveTemplate(tplId, "invoices").catch(() => { });
      } else if (isThermal) {
        saveActiveReceiptTemplate(activeTemplate as any, tenantId);
        printTemplatesApi.setActiveTemplate(tplId, "thermal").catch(() => { });
      } else if (isBarcode) {
        setActiveBarcodeTemplate(tplId, tenantId);
        printTemplatesApi.setActiveTemplate(tplId, "barcodes").catch(() => { });
      }
      window.dispatchEvent(new CustomEvent("print_templates_updated", { detail: { template: activeTemplate } }));
      window.dispatchEvent(new CustomEvent("bos_invoice_template_changed", { detail: { templateId: tplId } }));
      window.dispatchEvent(new CustomEvent("bos_barcode_template_changed", { detail: { templateId: tplId } }));
      window.dispatchEvent(new CustomEvent("bos_receipt_template_changed", { detail: { templateId: tplId } }));
    } catch { }
    toast.success(`"${activeTemplate.name}" set as Active Template for Your User Account!`);
  };

  // Duplicate current template
  const handleDuplicateTemplate = (tpl: PrintTemplate) => {
    const copy: PrintTemplate = {
      ...tpl,
      id: `tpl-${Date.now()}`,
      name: `${tpl.name} (Custom Copy)`,
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
    const next = [copy, ...templates];
    persistTemplates(next);
    setSelectedTemplateId(copy.id);
    toast.success(`Template duplicated as "${copy.name}"!`);
  };

  // Delete current template
  const handleDeleteTemplate = (tplId: string) => {
    if (activeTemplate.isDefault) {
      toast.error("Cannot delete the Organization Master Default template!");
      return;
    }
    const filtered = templates.filter((t) => t.id !== tplId);
    persistTemplates(filtered);
    const fallback = filtered.find((t) => t.docType === selectedDocType) || filtered[0];
    if (fallback) setSelectedTemplateId(fallback.id);
    printTemplatesApi.deleteTemplate(tplId, selectedDocType).catch(() => { });
    toast.success("Template deleted.");
  };

  // Save current template changes
  const handleSaveTemplate = async () => {
    const isBarcode = selectedDocType === "barcode" || activeTemplate.category === "barcodes" || activeTemplate.docType === "barcode";
    const isThermal = selectedDocType === "thermal" || activeTemplate.category === "thermal" || activeTemplate.docType === "thermal";

    // Merge current activeTemplate edits into the templates array
    const updatedTemplates = templates.map((t) =>
      t.id === activeTemplate.id ? { ...t, ...activeTemplate } : t
    );
    persistTemplates(updatedTemplates);

    if (isBarcode) {
      saveBarcodeTemplate(activeTemplate as any, Boolean(activeTemplate.isDefault));
      setActiveBarcodeTemplate(activeTemplate.id);
    } else if (isThermal) {
      saveActiveReceiptTemplate({
        id: activeTemplate.id,
        name: activeTemplate.name,
        isDefault: Boolean(activeTemplate.isDefault),
        paperSize: (activeTemplate.paperSize === "58mm" ? "58mm" : "80mm") as any,
        fontDensity: (activeTemplate as any).fontDensity || "normal",
        printClarity: (activeTemplate as any).printClarity || "ultra_dark",
        fontFamily: ((activeTemplate as any).thermalFontFamily || (activeTemplate.fontFamily?.includes("monospace") ? "monospace" : "sans-serif")) as any,
        dividerStyle: ((activeTemplate as any).dividerStyle || "dashed") as any,
        storeName: activeTemplate.storeName || "",
        branchName: (activeTemplate as any).branchName || "",
        headerTagline: (activeTemplate as any).headerTagline || activeTemplate.customTaglineText || "",
        invoiceTitle: activeTemplate.headerTitle || "TAX INVOICE",
        address: activeTemplate.storeAddress || "",
        phone: activeTemplate.storePhone || "",
        email: (activeTemplate as any).email || "",
        gstin: activeTemplate.gstin || "",
        cin: (activeTemplate as any).cin || "",
        pan: (activeTemplate as any).pan || "",
        logoUrl: activeTemplate.logoUrl || "",
        showLogo: Boolean(activeTemplate.fields?.showLogo ?? (activeTemplate as any)?.showLogo ?? true),
        showStoreName: Boolean(activeTemplate.fields?.showCompanyName ?? activeTemplate.fields?.showStoreName ?? (activeTemplate as any)?.showStoreName ?? true),
        showBranchName: Boolean((activeTemplate.fields as any)?.showBranchName ?? (activeTemplate as any)?.showBranchName ?? true),
        showStoreAddress: Boolean(activeTemplate.fields?.showCompanyDetails ?? (activeTemplate as any)?.showStoreAddress ?? true),
        showStoreContact: Boolean(activeTemplate.fields?.showCompanyDetails ?? (activeTemplate as any)?.showStoreContact ?? true),
        showTaxId: Boolean(activeTemplate.fields?.showHSN ?? (activeTemplate as any)?.showTaxId ?? true),
        showCin: Boolean((activeTemplate.fields as any)?.showCin ?? (activeTemplate as any)?.showCin ?? true),
        showInvoiceTitle: Boolean(activeTemplate.fields?.showInvoiceDetails ?? (activeTemplate as any)?.showInvoiceTitle ?? true),
        showTagline: Boolean(activeTemplate.fields?.showCustomTagline ?? (activeTemplate as any)?.showTagline ?? true),
        showCashier: Boolean((activeTemplate.fields as any)?.showCashier ?? (activeTemplate as any)?.showCashier ?? true),
        showTime: Boolean(activeTemplate.fields?.showTime ?? (activeTemplate as any)?.showTime ?? true),
        showCustomerDetails: Boolean(activeTemplate.fields?.showCustomerDetails ?? (activeTemplate as any)?.showCustomerDetails ?? true),
        showCustomerAddress: Boolean((activeTemplate.fields as any)?.showCustomerAddress ?? true),
        showCustomerPhone: Boolean((activeTemplate.fields as any)?.showCustomerPhone ?? true),
        showShippingAddress: Boolean((activeTemplate.fields as any)?.showShippingAddress ?? true),
        showPoNumber: Boolean((activeTemplate.fields as any)?.showPoNumber ?? true),
        showVehicleNumber: Boolean((activeTemplate.fields as any)?.showVehicleNumber ?? true),
        showEwayBill: Boolean((activeTemplate.fields as any)?.showEwayBill ?? true),
        showChallanNumber: Boolean((activeTemplate.fields as any)?.showChallanNumber ?? true),
        showItemIndex: Boolean((activeTemplate.fields as any)?.showItemIndex ?? true),
        showItemName: Boolean(activeTemplate.fields?.showProductName ?? true),
        showItemDescription: Boolean(activeTemplate.fields?.showItemDescription ?? true),
        showItemHSN: Boolean(activeTemplate.fields?.showHSN ?? true),
        showItemSKU: Boolean(activeTemplate.fields?.showSKU ?? false),
        showItemQty: Boolean(activeTemplate.fields?.showItemTable ?? true),
        showItemUom: Boolean((activeTemplate.fields as any)?.showItemUom ?? true),
        showItemRate: Boolean(activeTemplate.fields?.showPrice ?? true),
        showItemMrp: Boolean(activeTemplate.fields?.showMRP ?? true),
        showItemDiscount: Boolean(activeTemplate.fields?.showDiscountBadge ?? true),
        showItemTax: Boolean(activeTemplate.fields?.showTaxSplit ?? true),
        showItemTotal: Boolean(activeTemplate.fields?.showTotals ?? true),
        showSubtotal: Boolean(activeTemplate.fields?.showTotals ?? true),
        showTotalDiscount: Boolean(activeTemplate.fields?.showDiscountBadge ?? true),
        showSavingsBanner: Boolean((activeTemplate.fields as any)?.showSavingsBanner ?? true),
        showTaxBreakdown: Boolean(activeTemplate.fields?.showTaxSplit ?? true),
        showRoundOff: Boolean((activeTemplate.fields as any)?.showRoundOff ?? true),
        showGrandTotal: Boolean(activeTemplate.fields?.showTotals ?? true),
        showLoyaltyPoints: Boolean((activeTemplate.fields as any)?.showLoyaltyPoints ?? true),
        showPaymentMode: Boolean(activeTemplate.fields?.showPaymentDetails ?? true),
        showQrCode: Boolean(activeTemplate.fields?.showQR !== false),
        showGoogleReviewQR: (activeTemplate as any).showGoogleReviewQR !== false,
        googleReviewUrl: (activeTemplate as any).googleReviewUrl || "",
        showTermsAndConditions: Boolean(activeTemplate.fields?.showTerms !== false),
        termsAndConditionsText: activeTemplate.termsText || (activeTemplate as any).termsAndConditionsText || "",
        showDeclaration: Boolean((activeTemplate.fields as any)?.showDeclaration !== false),
        declarationText: (activeTemplate as any).declarationText || "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.",
        showFooterNote: Boolean(activeTemplate.fields?.showThankYou !== false),
        footerNote: activeTemplate.thankYouNote || activeTemplate.footerText || "THANK YOU FOR SHOPPING WITH US! VISIT AGAIN",
        showSignature: Boolean(activeTemplate.fields?.showSignature !== false || (activeTemplate as any).showSignature !== false),
        showStamp: Boolean((activeTemplate as any).showStamp !== false),
        signatureUrl: (activeTemplate as any).signatureUrl || "",
        stampUrl: (activeTemplate as any).stampUrl || "",
        signatoryLabel: (activeTemplate as any).signatoryLabel || "",
        customQrUrl: (activeTemplate as any).customQrUrl || "",
        payeeName: (activeTemplate as any).payeeName || "",
        qrType: ((activeTemplate as any).qrType || "upi") as any,
        upiId: (activeTemplate as any).upiId || "",
        customFields: (activeTemplate as any).customFields || [],
        customItemColumns: (activeTemplate as any).customItemColumns || [],
      });
      // The receipt store setter already persists the active receipt key.
    }
    try {
      await printTemplatesApi.saveTemplate(activeTemplate as any, Boolean(activeTemplate.isDefault));
      await printTemplatesApi.setActiveTemplate(activeTemplate.id, isBarcode ? "barcodes" : isThermal ? "thermal" : "invoices");
    } catch (e) {
      console.warn("Backend template persistence deferred:", e);
    }
    window.dispatchEvent(new CustomEvent("bos_receipt_template_changed", { detail: { templateId: activeTemplate.id } }));
    toast.success(`Template "${activeTemplate.name}" saved to organization cloud!`);
  };

  // Wipe ALL saved templates for this organization (device-side) and reload
  // from a clean slate. The database copy is cleared separately
  // (backend/reset_print_templates.py); this clears the browser's cached lists
  // so nothing stale re-merges on load.
  const handleResetAllTemplates = () => {
    if (!window.confirm("Reset ALL print templates for this organization?\n\nThis clears every saved template, custom field, and your active-template selections from this browser and reloads the app. This cannot be undone from the app (a database backup was written before the reset).")) return;
    try {
      receiptTemplateStore.resetAllPrintTemplatesForTenant(tenant?.id);
      toast.success("Cleared all local templates — reloading a clean slate…");
    } catch (e) {
      console.error("Reset all templates failed:", e);
    }
    // Give the storage removal a beat to flush, then reload so the app re-fetches
    // from the (already-cleared) backend and re-seeds built-in defaults only.
    setTimeout(() => window.location.reload(), 300);
  };

  // Reset current template to defaults
  const handleResetTemplate = () => {
    const baseline = INITIAL_TEMPLATES.find((t) => t.id === activeTemplate.id) || INITIAL_TEMPLATES.find((t) => t.docType === selectedDocType);
    if (baseline) {
      const resetTpl = { ...baseline, id: activeTemplate.id };
      const updatedTemplates = templates.map((t) =>
        t.id === activeTemplate.id ? resetTpl : t
      );
      persistTemplates(updatedTemplates);
      toast.info(`Reset "${activeTemplate.name}" to standard default settings.`);
    }
  };

  // Preview in new browser tab / in-tab full view
  const handlePreviewNewTab = () => {
    const isThermal = selectedDocType === "thermal" || activeTemplate?.category === "thermal" || activeTemplate?.docType === "thermal";
    if (isThermal) {
      setIsThermalFullViewOpen(true);
      return;
    }
    if (isBarcodeTemplate) {
      const sampleItem = realCatalogProducts[selectedSampleProductIdx] || {
        product_name: "Designer Saree Silk 3799",
        barcode: "2064965391328",
        sku: "SAR-3799",
        selling_price: 3799.0,
        mrp: 7599.0,
        category_name: "APPAREL / ETHNIC",
        format: activeTemplate.barcodeSymbology || "Code-128",
      };
      printBarcodePopup([sampleItem], activeTemplate as any, (activeTemplate as any).labelLayout || "1up", currency.symbol, activeTemplate.storeName || tenant?.name);
      return;
    }
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Popup was blocked. Please allow popups for this site.");
      return;
    }
    const htmlContent = generatePrintableHtml(activeTemplate, currency);
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Download PDF / Direct Print
  const handleDownloadPdf = () => {
    const isThermal = selectedDocType === "thermal" || activeTemplate?.category === "thermal" || activeTemplate?.docType === "thermal";
    if (isThermal) {
      triggerThermalPrint("preview-thermal-paper", {
        width: activeTemplate.paperSize === "58mm" ? "58mm" : "80mm",
        contrast: (activeTemplate.thermalContrast as any) || "ultra-dark",
        safeFeedMarginMm: activeTemplate.feedAfterPrint !== false ? 20 : 0,
        autoCut: activeTemplate.autoCutPaper !== false,
      });
      toast.success("Printing thermal receipt...");
      return;
    }
    if (isBarcodeTemplate) {
      const sampleItem = realCatalogProducts[selectedSampleProductIdx] || {
        product_name: "Designer Saree Silk 3799",
        barcode: "2064965391328",
        sku: "SAR-3799",
        selling_price: 3799.0,
        mrp: 7599.0,
        category_name: "APPAREL / ETHNIC",
        format: activeTemplate.barcodeSymbology || "Code-128",
      };
      printBarcodePopup([sampleItem], activeTemplate as any, (activeTemplate as any).labelLayout || "1up", currency.symbol, activeTemplate.storeName || tenant?.name);
      toast.success("Opening barcode print dialog...");
      return;
    }
    window.print();
    toast.success("Opening system print / PDF export dialog...");
  };

  const isThermalTemplate =
    selectedDocType === "thermal" ||
    activeTemplate?.category === "thermal" ||
    activeTemplate?.docType === "thermal";

  const isBarcodeTemplate =
    selectedDocType === "barcode" ||
    selectedDocType === "pricetag" ||
    selectedDocType === "qrcode" ||
    activeTemplate?.category === "barcodes" ||
    activeTemplate?.category === "pricetag" ||
    activeTemplate?.category === "qrcodes" ||
    activeTemplate?.docType === "barcode" ||
    activeTemplate?.docType === "pricetag" ||
    activeTemplate?.docType === "qrcode";

  return (
    <div className="flex flex-col gap-3.5 lg:h-[calc(100vh-130px)] lg:max-h-[calc(100vh-130px)] min-h-[580px] text-foreground lg:overflow-hidden pb-4 lg:pb-0">
      {/* ─── Standard Tab Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{t("Print & Document Templates", "Print & Document Templates")}</h2>
          <p className="text-sm text-muted-foreground">{t("Design, customize and live preview templates for Invoices, POS Receipts, Barcodes, QR Codes & Delivery Challans", "Design, customize and live preview templates for Invoices, POS Receipts, Barcodes, QR Codes & Delivery Challans")}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsPdfOverlayModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-all shadow-xs cursor-pointer active:scale-95"
            title="Upload your exact invoice PDF or scan stationery and overlay live invoice fields"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload & Overlay Existing PDF
          </button>

          <button
            onClick={handlePreviewNewTab}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/70 transition-all shadow-xs cursor-pointer active:scale-95"
            title={isThermalTemplate ? "Open full view interactive preview in this tab" : "Preview in New Tab"}
          >
            {isThermalTemplate ? (
              <>
                <Maximize2 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                Full View Preview
              </>
            ) : (
              <>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                Preview in New Tab
              </>
            )}
          </button>

          <button
            onClick={handleResetTemplate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/70 transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
            Reset
          </button>

          <button
            onClick={handleResetAllTemplates}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-all shadow-xs cursor-pointer active:scale-95"
            title="Wipe all saved templates for this organization (device + database) and start from a clean slate"
          >
            <Trash2 className="h-3.5 w-3.5 text-rose-600" />
            Reset All
          </button>

          <button
            onClick={handleSaveTemplate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-bold shadow-xs shadow-indigo-500/20 transition-all cursor-pointer active:scale-95"
          >
            <Save className="h-3.5 w-3.5" />
            Save Template
          </button>
        </div>
      </div>

      {/* ─── 3-Column Main Workspace (Separate Independent Scrolling) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch flex-1 min-h-0 lg:overflow-hidden">

        {/* ── COLUMN 1: Template Type Sidebar (Collapsible & Compact) ── */}
        {isSidebarCollapsed ? (
          <div className="lg:col-span-1 bg-card border border-border/80 rounded-2xl p-2 shadow-sm flex flex-col items-center gap-2 lg:h-full lg:overflow-y-auto custom-scrollbar">
            <button
              onClick={() => setIsSidebarCollapsed(false)}
              className="w-full flex flex-col items-center justify-center p-2 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 hover:scale-105 transition-all cursor-pointer shadow-xs"
              title="Expand Document Types"
            >
              <PanelLeftOpen className="h-4 w-4" />
              <span className="text-[9px] font-bold mt-1">Types</span>
            </button>

            <div className="w-full h-px bg-border/60 my-0.5" />

            <div className="flex flex-col gap-1.5 w-full items-center">
              {DOCUMENT_TYPES_CONFIG.map((doc) => {
                const IconComp = doc.icon;
                const isActive = selectedDocType === doc.type;
                const count = (templates || []).filter((t) => t.docType === doc.type || t.category === doc.category).length;
                return (
                  <button
                    key={doc.type}
                    onClick={() => handleSelectSidebarDocType(doc.type)}
                    title={`${doc.label} (${count} templates)`}
                    className={`relative w-9 h-9 flex items-center justify-center rounded-xl border transition-all cursor-pointer ${isActive
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm scale-105"
                      : "bg-muted/40 hover:bg-muted text-muted-foreground border-transparent hover:border-border"
                      }`}
                  >
                    <IconComp className="h-4 w-4" />
                    {isActive && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-2 ring-card" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 bg-card border border-border/80 rounded-2xl p-3 shadow-sm flex flex-col lg:h-full lg:overflow-hidden">
            <div className="flex items-center justify-between px-1 pb-2 border-b border-border/40 shrink-0">
              <div className="min-w-0">
                <h2 className="text-xs font-bold text-foreground">{t("Template Type", "Template Type")}</h2>
                <p className="text-[9.5px] text-muted-foreground truncate">{t("Choose format", "Choose format")}</p>
              </div>
              <button
                onClick={() => setIsSidebarCollapsed(true)}
                className="p-1.5 rounded-lg border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-3 flex-1 min-h-0 lg:overflow-y-auto custom-scrollbar pr-1 pt-2">
              {([
                { title: "Documents", types: ["invoice", "challan", "quotation", "proforma", "custom"] },
                { title: "Procurement & Notes", types: ["credit_note", "debit_note", "purchase_invoice", "purchase_order"] },
                { title: "POS Receipts", types: ["thermal"] },
                { title: "Labels & Tags", types: ["barcode", "qrcode", "pricetag"] },
              ] as const).map((group) => (
                <div key={group.title} className="space-y-1">
                  <p className="px-1 pt-1 text-[8.5px] font-black uppercase tracking-wider text-muted-foreground/70">
                    {group.title}
                  </p>
                  {group.types.map((docType) => {
                    const doc = DOCUMENT_TYPES_CONFIG.find((d) => d.type === docType);
                    if (!doc) return null;
                    const IconComp = doc.icon;
                    const isActive = selectedDocType === doc.type;
                    const count = (templates || []).filter((t) => t.docType === doc.type || t.category === doc.category).length;
                    return (
                      <button
                        key={doc.type}
                        onClick={() => handleSelectSidebarDocType(doc.type)}
                        className={`w-full flex items-center justify-between p-2 rounded-xl border transition-all text-left cursor-pointer ${isActive
                          ? "border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 shadow-sm"
                          : "border-border/60 bg-card hover:bg-muted/40 hover:border-border text-foreground"
                          }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-lg shrink-0 transition-colors ${isActive ? "bg-indigo-600 text-white shadow-sm" : "bg-muted text-muted-foreground"
                              }`}
                          >
                            <IconComp className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 pr-0.5">
                            <div className="text-[11px] font-bold truncate leading-snug flex items-center gap-1">
                              {doc.label}
                              <span className="text-[9px] font-normal px-1 py-0.2 rounded-full bg-muted text-muted-foreground">{count}</span>
                            </div>
                            <div className="text-[9px] text-muted-foreground truncate leading-tight mt-0.5">{doc.subtitle}</div>
                          </div>
                        </div>
                        <ChevronRight
                          className={`h-3.5 w-3.5 shrink-0 transition-transform ${isActive ? "text-indigo-600 dark:text-indigo-400 translate-x-0.5" : "text-muted-foreground/40"
                            }`}
                        />
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── COLUMN 2: Editor Customization Center Panel ── */}
        <div className="lg:col-span-5 bg-card border border-border/80 rounded-2xl p-4 shadow-sm flex flex-col lg:h-full lg:overflow-hidden">

          {/* Top Pill Navigation Tabs - Fixed at top */}
          <div className="flex items-center p-1 bg-muted/50 rounded-xl border border-border/50 gap-1 shrink-0 mb-3">
            <button
              onClick={() => setActiveEditorTab("design")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeEditorTab === "design"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
            >
              <Edit3 className="h-3.5 w-3.5" />
              Design
            </button>
            <button
              onClick={() => setActiveEditorTab("content")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeEditorTab === "content"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Content
            </button>
            <button
              onClick={() => setActiveEditorTab("branding")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeEditorTab === "branding"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
            >
              <Palette className="h-3.5 w-3.5" />
              Branding
            </button>
            <button
              onClick={() => setActiveEditorTab("settings")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeEditorTab === "settings"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </button>
          </div>

          {/* Active Configuration Body - Independent Scroll Container */}
          <div className="flex-1 min-h-0 lg:overflow-y-auto custom-scrollbar pr-2 space-y-5">

            {/* Active Template Banner / Status Actions Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 bg-muted/30 border border-border/60 rounded-xl">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-foreground">{activeTemplate.name}</span>
                  {activeTemplate.isDefault && (
                    <span className="rounded-full bg-primary/15 text-primary text-[9px] font-bold px-2 py-0.5 shrink-0">
                      ORG DEFAULT
                    </span>
                  )}
                  {userActiveDefaults[selectedDocType] === activeTemplate.id && (
                    <span className="rounded-full bg-teal-500/15 text-teal-600 dark:text-teal-400 text-[9px] font-bold px-2 py-0.5 shrink-0">
                      ACTIVE FOR ME
                    </span>
                  )}
                </div>
                <p className="text-[10.5px] text-muted-foreground truncate mt-0.5">{activeTemplate.description}</p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                {userActiveDefaults[selectedDocType] !== activeTemplate.id && (
                  <button
                    onClick={() => handleSetActiveForMe(activeTemplate.id)}
                    title="Set Active for My Account"
                    className="px-2 py-1 rounded-lg border border-teal-500/30 bg-teal-500/10 hover:bg-teal-500 hover:text-white text-teal-600 dark:text-teal-400 text-[10px] font-semibold cursor-pointer transition-colors"
                  >
                    Active for Me
                  </button>
                )}
                <button
                  onClick={() => handleDuplicateTemplate(activeTemplate)}
                  title="Duplicate Template"
                  className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                {!activeTemplate.isDefault && (
                  <button
                    onClick={() => handleDeleteTemplate(activeTemplate.id)}
                    title="Delete Template"
                    className="p-1.5 rounded-lg border border-border hover:bg-destructive/10 text-destructive cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* ── A4 DOCUMENT-TYPE SEPARATION STRIP ── */}
            {(selectedDocType === "invoice" || activeTemplate.category === "invoices" || activeTemplate.docType === "invoice") && (
              <div className="space-y-2.5 p-3.5 bg-muted/20 border border-border/70 rounded-2xl">
                <div className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  <h3 className="text-xs font-black tracking-tight text-foreground">{t("Template by Document Type", "Template by Document Type")}</h3>
                  <span className="text-[10px] font-semibold text-muted-foreground ml-auto">
                    Each type keeps its OWN chosen design across save, print, PDF, email &amp; WhatsApp.
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {A4_STRIP_SLOTS.map(({ key: slot, label }) => {
                    const isActiveSlot = selectedA4Slot === slot && slotKeyForDocType(selectedDocType) === slot;
                    const overridden = isA4SlotOverridden(slot);
                    const masterId = masterInvoiceTemplateId();
                    const resolvedId = resolveA4SlotActiveId(slot) || masterId || activeTemplate.id;
                    const resolvedName = currentCategoryTemplates.find((x: any) => x.id === resolvedId)?.name || masterNameForSlot(masterId);
                    const isMasterSlot = slot === "invoice";
                    // ACTIVE FOR ME badge: master slot when the active template is the
                    // master invoice template; otherwise only when this slot's resolved
                    // template matches what is loaded in the editor.
                    const isLoaded = activeTemplate.id === resolvedId;
                    return (
                      <div
                        key={slot}
                        className={`rounded-xl border p-2.5 space-y-1.5 transition-all cursor-pointer ${isActiveSlot ? "border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 ring-1 ring-indigo-500/40" : "border-border/70 bg-card hover:border-indigo-300 hover:bg-muted/30"}`}
                        onClick={() => handleSelectA4Slot(slot)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wide text-foreground">{label}</span>
                          <div className="flex items-center gap-1">
                            {overridden && (
                              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">OVERRIDE</span>
                            )}
                            {isMasterSlot && (
                              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary shrink-0">MASTER</span>
                            )}
                            {!overridden && !isMasterSlot && isLoaded && (
                              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-600 dark:text-teal-400 shrink-0">ACTIVE FOR ME</span>
                            )}
                          </div>
                        </div>
                        <select
                          value={resolvedId}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const nextId = e.target.value;
                            if (!nextId) return;
                            pinA4SlotTemplate(slot, nextId);
                            setInvoiceCatLinkVersion((v) => v + 1);
                            handleSelectA4Slot(slot);
                          }}
                          className="w-full text-[11px] font-semibold border border-border rounded-lg bg-background px-2 py-1.5 text-foreground cursor-pointer focus:ring-2 focus:ring-primary/40"
                        >
                          {currentCategoryTemplates.map((tpl: any) => (
                            <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                          ))}
                        </select>
                        {!isMasterSlot && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              relinkA4SlotToMaster(slot);
                              setInvoiceCatLinkVersion((v) => v + 1);
                            }}
                            className={`w-full flex items-center justify-center gap-1.5 text-[10px] font-bold rounded-lg px-2 py-1 border cursor-pointer transition-colors ${overridden
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                              : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"}`}
                            title={overridden ? "Re-link this document type to the master invoice template" : "Re-link to master"}
                          >
                            {overridden ? "↩️ Re-link to master" : "Linked to master"}
                          </button>
                        )}
                        <p className="text-[9px] text-muted-foreground leading-tight truncate">{resolvedName}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── TAB 1: DESIGN (Option 1: Backgrounds & Colors & ThemeStore + Option 2: Page Template & Table Format) ── */}
            {activeEditorTab === "design" && isThermalTemplate ? (
              <div className="space-y-5">
                {/* Thermal Theme Presets */}
                <div className="space-y-3 p-4 bg-muted/20 border border-border/70 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <h3 className="text-xs font-black tracking-tight text-foreground">Thermal Theme Presets</h3>
                    </div>
                    <span className="text-[10px] font-semibold text-muted-foreground">Click card to apply instant styling</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { id: 'compact', name: 'Compact', desc: 'Minimal spacing, high item density', badge: 'STANDARD' },
                      { id: 'advanced', name: 'Advanced', desc: 'Pro boxed grid & heavy contrast', badge: 'PRO GRID' },
                      { id: 'simple', name: 'Simple', desc: 'Light dotted dividers, clean font', badge: 'CLEAN' },
                      { id: 'classic', name: 'Classic', desc: 'Traditional POS double lines', badge: 'MATRIX' },
                      { id: 'supermarket', name: 'Supermarket', desc: 'MRP comparison & savings banner', badge: 'RETAIL' },
                      { id: 'pharma', name: 'Pharma', desc: 'Batch, Expiry & Drug License', badge: 'RX MEDICAL' },
                      { id: 'kot', name: 'Restaurant KOT', desc: 'Kitchen order ticket format', badge: 'KITCHEN' },
                    ].map((preset) => {
                      const isSelected = activeTemplate.themeName === preset.id;
                      return (
                        <div
                          key={preset.id}
                          onClick={() => handleApplyThermalPreset(preset.id as any)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between relative ${isSelected
                            ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/30 shadow-xs'
                            : 'border-border bg-card hover:border-indigo-300 hover:bg-muted/40'
                            }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-black text-foreground">{preset.name}</span>
                            {isSelected && <Check className="h-3 w-3 text-indigo-600 stroke-[3]" />}
                          </div>
                          <p className="text-[9.5px] text-muted-foreground leading-tight">{preset.desc}</p>
                          <span className="mt-2 text-[8.5px] font-bold uppercase tracking-wider text-muted-foreground/80 self-start px-1.5 py-0.2 rounded bg-muted/60">
                            {preset.badge}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Hardware Paper & Thermal Clarity Settings */}
                <div className="space-y-3 p-4 bg-muted/20 border border-border/70 rounded-2xl">
                  <h3 className="text-xs font-black tracking-tight text-foreground flex items-center gap-1.5">
                    <Printer className="h-4 w-4 text-indigo-600" />
                    Paper Roll & Hardware Darkness
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Paper Roll Width */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-foreground">Paper Roll Width</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => updateTemplateProperty("paperSize", "80mm")}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-0.5 ${activeTemplate.paperSize !== "58mm"
                            ? "border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500"
                            : "border-border bg-card text-foreground hover:bg-muted"
                            }`}
                        >
                          <span>80mm</span>
                          <span className="text-[9px] font-normal text-muted-foreground">(3-inch Standard)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateTemplateProperty("paperSize", "58mm")}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-0.5 ${activeTemplate.paperSize === "58mm"
                            ? "border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500"
                            : "border-border bg-card text-foreground hover:bg-muted"
                            }`}
                        >
                          <span>58mm</span>
                          <span className="text-[9px] font-normal text-muted-foreground">(2-inch Mini POS)</span>
                        </button>
                      </div>
                    </div>

                    {/* Thermal Contrast / Print Darkness */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-foreground">Thermal Contrast / Darkness</label>
                      <select
                        value={activeTemplate.printClarity || "ultra_dark"}
                        onChange={(e) => updateTemplateProperty("printClarity" as any, e.target.value as any)}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold text-foreground focus:border-indigo-500"
                      >
                        <option value="ultra_dark">🔥 Ultra-Dark (Pure Black 900) - Recommended</option>
                        <option value="crisp_mono">🖨️ Crisp Monospace (High Density)</option>
                        <option value="compact">⚡ Compact Ink-Saver</option>
                        <option value="standard">📄 Standard Contrast</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    {/* Font Family */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-foreground">Receipt Font Style</label>
                      <select
                        value={activeTemplate.thermalFontFamily || "monospace"}
                        onChange={(e) => updateTemplateProperty("thermalFontFamily" as any, e.target.value as any)}
                        className="w-full rounded-xl border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-indigo-500 font-medium"
                      >
                        <option value="monospace">Monospace (Classic POS)</option>
                        <option value="sans-serif">Clean (Modern Sans)</option>
                        <option value="terminal">Terminal (High Contrast)</option>
                        <option value="courier">Courier (Typewriter)</option>
                      </select>
                    </div>

                    {/* Divider Line Style */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-foreground">Divider Line Style</label>
                      <select
                        value={activeTemplate.dividerStyle || "dashed"}
                        onChange={(e) => updateTemplateProperty("dividerStyle" as any, e.target.value as any)}
                        className="w-full rounded-xl border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-indigo-500 font-medium"
                      >
                        <option value="dashed">Dashed Lines (-------)</option>
                        <option value="solid">Solid Heavy Line (━━━━━━)</option>
                        <option value="double">Double Border (══════)</option>
                        <option value="dotted">Dotted Lines (······)</option>
                        <option value="star">Star Accent (******)</option>
                      </select>
                    </div>

                    {/* Font Density / Line Spacing */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-foreground">Line Density / Spacing</label>
                      <select
                        value={activeTemplate.fontDensity || "normal"}
                        onChange={(e) => updateTemplateProperty("fontDensity" as any, e.target.value as any)}
                        className="w-full rounded-xl border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-indigo-500 font-medium"
                      >
                        <option value="compact">Compact (Dense / Ink Saver)</option>
                        <option value="normal">Normal Standard Spacing</option>
                        <option value="large">Large (High Legibility)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeEditorTab === "design" && (
              <div className="space-y-5">

                {/* ═══ SECTION 1: TEMPLATE LIBRARY (grouped, enterprise) ═══ */}
                <div className="space-y-4 p-4 bg-card border border-border/70 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <LayoutGrid className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      <h3 className="text-xs font-black tracking-tight text-foreground">Template Library</h3>
                    </div>
                    <button
                      onClick={() => setIsTemplateStoreModalOpen(true)}
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Full gallery ({currentCategoryTemplates.length})
                    </button>
                  </div>
                  <p className="text-[10.5px] text-muted-foreground -mt-1.5">
                    Pick a starting layout — every field, column and element can still be fully customized in the tabs below.
                  </p>

                  {(() => {
                    // Compact card picker: show at most 4 cards; everything else
                    // lives in the full gallery modal so the tab stays clean.
                    const groups = buildTemplateGroups(currentCategoryTemplates, selectedDocType);
                    const visible = groups.map((g) => ({ ...g, items: g.items.slice(0, 4) }));
                    const total = groups.reduce((n, g) => n + g.items.length, 0);
                    return (
                    <>
                  {visible.map((group) => (
                    <div key={group.title} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[9.5px] font-black uppercase tracking-wider text-muted-foreground">{group.title}</span>
                        <span className="text-[9px] font-bold text-indigo-500/80 bg-indigo-500/10 rounded-full px-1.5 py-0.1">{total}</span>
                        <div className="h-px flex-1 bg-border/50" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {group.items.map((tpl) => {
                          const isSelected = activeTemplate.id === tpl.id;
                          return (
                            <button
                              key={tpl.id}
                              type="button"
                              onClick={() => handleSelectTemplate(tpl)}
                              className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer ${isSelected
                                ? "border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-1 ring-indigo-500/40"
                                : "border-border/60 bg-background hover:border-indigo-300 hover:bg-muted/40"
                                }`}
                            >
                              <div className="flex items-start gap-2.5">
                                <TemplateThumb tpl={tpl} selected={isSelected} />
                                <div className="min-w-0 flex-1 pr-1">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className={`text-[11px] font-bold truncate ${isSelected ? "text-indigo-700 dark:text-indigo-300" : "text-foreground"}`}>
                                      {tpl.name.replace(" Theme", "")}
                                    </span>
                                    {isSelected && <Check className="h-3 w-3 shrink-0 text-indigo-600 stroke-[3]" />}
                                  </div>
                                  <div className="flex items-center gap-1 flex-wrap mt-0.5">
                                    {tpl.isDefault && (
                                      <span className="text-[7.5px] font-black px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400">ORG DEFAULT</span>
                                    )}
                                    {userActiveDefaults[selectedDocType] === tpl.id && (
                                      <span className="text-[7.5px] font-black px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-600 dark:text-teal-400">ACTIVE FOR ME</span>
                                    )}
                                    {(tpl.docType === "thermal" || tpl.docType === "invoice" || tpl.docType === "challan") && (
                                      <span className="text-[7.5px] font-bold text-muted-foreground/70 px-1.5 py-0.5 rounded bg-muted/70">
                                        {tpl.paperSize}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[9px] text-muted-foreground leading-tight mt-1 line-clamp-2">{tpl.description}</p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                    </>
                  );
                })()}
                </div>

                {/* ═══ SECTION 2: ONE BUTTON ROW (Word canvas / designer / org default) ═══ */}
                {(isInvoicesFamilyDocType(selectedDocType) || selectedDocType === "challan" || activeTemplate.category === "invoices" || activeTemplate.docType === "invoice") && (
                  <div className="space-y-2 p-4 bg-card border border-border/70 rounded-2xl">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      <h3 className="text-xs font-black tracking-tight text-foreground">{t("Design Tools", "Design Tools")}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSetOrgDefault(activeTemplate.id)}
                        className="w-full px-3 py-2.5 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-950/50 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                      >
                        <CheckCircle2 className="size-3.5" /> {t("Make Org Default", "Make Org Default")}
                      </button>
                    </div>
                  </div>
                )}

                {/* ═══ SECTION: 3 PARTY LAYOUT SELECTOR CARDS ═══ */}
                {(!isThermalTemplate && !isBarcodeTemplate) && (
                  <div className="space-y-3 p-4 bg-card border border-border/70 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <LayoutGrid className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        <h3 className="text-xs font-black tracking-tight text-foreground">Party Details Layout</h3>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-semibold">3 Header Styles</span>
                    </div>
                    <p className="text-[10.5px] text-muted-foreground -mt-1.5">
                      Choose how Bill To, Ship To, and Company details are partitioned in the invoice header.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {PARTY_LAYOUT_OPTIONS.map((layout) => {
                        const currentLayout = (activeTemplate as any)?.party?.layout || (activeTemplate as any)?.partyLayout || "layout_1";
                        const isSelected = currentLayout === layout.id;
                        return (
                          <button
                            key={layout.id}
                            type="button"
                            onClick={() => {
                              const updated = templates.map((t) =>
                                t.id === activeTemplate.id
                                  ? {
                                      ...t,
                                      partyLayout: layout.id as any,
                                      party: { ...((t as any).party || {}), layout: layout.id as any },
                                    }
                                  : t
                              );
                              persistTemplates(updated);
                            }}
                            className={`relative flex flex-col justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? "border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-1 ring-indigo-500/40 shadow-xs"
                                : "border-border/60 bg-background hover:border-indigo-300 hover:bg-muted/30"
                            }`}
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className={`text-[11px] font-bold ${isSelected ? "text-indigo-700 dark:text-indigo-300" : "text-foreground"}`}>
                                  {layout.title}
                                </span>
                                {isSelected && <Check className="h-3.5 w-3.5 text-indigo-600 shrink-0 stroke-[3]" />}
                              </div>
                              {layout.badge && (
                                <span className="inline-block text-[8px] font-black px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                  {layout.badge}
                                </span>
                              )}
                              <p className="text-[9.5px] text-muted-foreground leading-snug">
                                {layout.description}
                              </p>
                            </div>
                            {/* Wireframe preview */}
                            <div className="mt-2.5 pt-2 border-t border-border/40">
                              {layout.id === "layout_1" && (
                                <div className="grid grid-cols-2 gap-1 h-7">
                                  <div className="border border-dashed border-indigo-300 dark:border-indigo-800 rounded bg-indigo-50/50 dark:bg-indigo-950/20 flex items-center justify-center text-[7px] font-mono text-muted-foreground">Bill To</div>
                                  <div className="border border-dashed border-indigo-300 dark:border-indigo-800 rounded bg-indigo-50/50 dark:bg-indigo-950/20 flex items-center justify-center text-[7px] font-mono text-muted-foreground">Ship To</div>
                                </div>
                              )}
                              {layout.id === "layout_2" && (
                                <div className="grid grid-cols-3 gap-1 h-7">
                                  <div className="border border-dashed border-indigo-300 dark:border-indigo-800 rounded bg-indigo-50/50 dark:bg-indigo-950/20 flex items-center justify-center text-[6px] font-mono text-muted-foreground">Seller</div>
                                  <div className="border border-dashed border-indigo-300 dark:border-indigo-800 rounded bg-indigo-50/50 dark:bg-indigo-950/20 flex items-center justify-center text-[6px] font-mono text-muted-foreground">Meta</div>
                                  <div className="border border-dashed border-indigo-300 dark:border-indigo-800 rounded bg-indigo-50/50 dark:bg-indigo-950/20 flex items-center justify-center text-[6px] font-mono text-muted-foreground">Party</div>
                                </div>
                              )}
                              {layout.id === "layout_3" && (
                                <div className="flex flex-col gap-0.5 h-7">
                                  <div className="border border-dashed border-indigo-300 dark:border-indigo-800 rounded bg-indigo-50/50 dark:bg-indigo-950/20 flex-1 flex items-center justify-center text-[7px] font-mono text-muted-foreground">Bill To (Full Width)</div>
                                  <div className="border border-dashed border-indigo-300 dark:border-indigo-800 rounded bg-indigo-50/50 dark:bg-indigo-950/20 flex-1 flex items-center justify-center text-[7px] font-mono text-muted-foreground">Ship To (Full Width)</div>
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ═══ SECTION 3: STYLE & ACCENTS (color, font, accent background) ═══ */}
                <div className="space-y-3 p-4 bg-card border border-border/70 rounded-2xl">
                  <div className="flex items-center gap-1.5">
                    <Palette className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="text-xs font-black tracking-tight text-foreground">Style & Accents</h3>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-bold text-foreground">{t("Accent Color", "Accent Color")}</label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {COLOR_SWATCHES.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => updateTemplateProperty("primaryColor", c.value)}
                          title={c.label}
                          className={`h-7 w-7 rounded-lg border-2 transition-all cursor-pointer ${activeTemplate.primaryColor === c.value ? "ring-2 ring-offset-1 ring-indigo-500 scale-105" : "border-border/60 hover:scale-105"
                            }`}
                          style={{ backgroundColor: c.value }}
                        />
                      ))}
                      {/* Free-form hex input so any accent can be chosen */}
                      <div className="flex items-center gap-1 pl-2 border-l border-border">
                        <input
                          type="text"
                          value={activeTemplate.primaryColor || ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (/^#([0-9a-fA-F]{0,6})$/.test(v)) updateTemplateProperty("primaryColor", v);
                          }}
                          placeholder="#4f46e5"
                          className="w-20 h-7 rounded-lg border border-border bg-background px-2 text-[11px] font-mono text-foreground focus:border-indigo-500"
                        />
                        <input
                          type="color"
                          value={/^#([0-9a-f]{6})$/i.test(activeTemplate.primaryColor || "") ? activeTemplate.primaryColor : "#4f46e5"}
                          onChange={(e) => updateTemplateProperty("primaryColor", e.target.value)}
                          className="h-7 w-7 rounded-lg border border-border cursor-pointer"
                          title={t("Custom color", "Custom color")}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-bold text-foreground">Font Family</label>
                    <select
                      value={activeTemplate.fontFamily}
                      onChange={(e) => updateTemplateProperty("fontFamily", e.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold text-foreground focus:border-indigo-500"
                    >
                      {FONT_FAMILIES.map((ff) => (
                        <option key={ff.value} value={ff.value}>{ff.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10.5px] font-bold text-foreground">Decorative Accent (optional)</label>
                      {selectedThemeStoreId && (
                        <button
                          onClick={() => handleSelectThemeStoreItem(THEME_STORE_BACKGROUNDS[0] as ThemeStoreItem)}
                          className="text-[9.5px] font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          Revert to clean
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {THEME_STORE_BACKGROUNDS.map((item) => {
                        const isSelected = selectedThemeStoreId === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelectThemeStoreItem(item)}
                            title={item.description}
                            className={`relative aspect-[4/5] rounded-lg border p-1 flex flex-col justify-between transition-all overflow-hidden cursor-pointer ${isSelected
                              ? "border-indigo-600 ring-1 ring-indigo-500/40 shadow-sm"
                              : "border-border/60 hover:border-indigo-300"
                              }`}
                          >
                            <div className={`w-full h-full rounded bg-gradient-to-br ${item.previewGradient} flex flex-col justify-between p-0.5`}>
                              <div className="text-[6px] font-bold text-slate-700/70 flex justify-between">
                                <span>{item.iconType === "none" ? "CLEAN" : item.iconType === "corporate" ? "CORP" : item.iconType === "shubh_labh" ? "VEDIC" : "GOLD"}</span>
                                {item.badge && <span className="text-[5.5px] font-black px-1 rounded-full bg-indigo-600/80 text-white leading-tight">{item.badge}</span>}
                              </div>
                              <div className="flex flex-col items-center opacity-80">
                                {item.iconType === "none" && <span className="text-[11px] leading-none">📄</span>}
                                {item.iconType === "shubh_labh" && <span className="text-[11px] leading-none">✨</span>}
                                {item.iconType === "royal_gold" && <span className="text-[11px] leading-none">👑</span>}
                                {item.iconType === "corporate" && <span className="text-[11px] leading-none">🏛️</span>}
                              </div>
                              <div className="space-y-0.5">
                                <div className="w-full h-0.5 bg-slate-700/20 rounded-full" />
                                <div className="w-3/4 h-0.5 bg-slate-700/20 rounded-full" />
                              </div>
                            </div>
                            {isSelected && (
                              <div className="absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-indigo-600 text-white shadow">
                                <Check className="h-2 w-2 stroke-[3]" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[9px] text-muted-foreground">Applies an optional background accent & watermark to all invoice layouts.</p>
                  </div>
                </div>


              </div>
            )}

                                    {/* ── TAB 2: CONTENT ── */}
                                    {activeEditorTab === "content" && isThermalTemplate ? (
                                      <div className="space-y-5">
                                        {/* 1. Header Details & CoreERP Profile Sync */}
                                        <div className="space-y-3 p-4 bg-muted/20 border border-border/70 rounded-2xl">
                                          <div className="flex items-center justify-between">
                                            <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                              <Building2 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                              Store Header & Contact Details
                                            </h3>
                                            <button
                                              onClick={handleSyncWithCoreErp}
                                              className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                                              title="Import name, address, phone, GSTIN from CoreERP active profile"
                                            >
                                              <RefreshCw className="h-3 w-3" />
                                              Sync CoreERP Profile
                                            </button>
                                          </div>

                                          <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                              <label className="text-[10px] font-semibold text-foreground">Header Title</label>
                                              <input
                                                type="text"
                                                value={activeTemplate.headerTitle || ""}
                                                onChange={(e) => updateTemplateProperty("headerTitle", e.target.value)}
                                                placeholder="e.g. CASH RECEIPT / TAX INVOICE"
                                                className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-indigo-500 font-bold"
                                              />
                                            </div>
                                            <div className="space-y-1">
                                              <label className="text-[10px] font-semibold text-foreground">Store / Business Name</label>
                                              <input
                                                type="text"
                                                value={activeTemplate.storeName || ""}
                                                onChange={(e) => updateTemplateProperty("storeName", e.target.value)}
                                                placeholder="Store Name"
                                                className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-indigo-500 font-bold"
                                              />
                                            </div>
                                          </div>

                                          <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                              <label className="text-[10px] font-semibold text-foreground">Branch / Outlet</label>
                                              <input
                                                type="text"
                                                value={activeTemplate.branchName || ""}
                                                onChange={(e) => updateTemplateProperty("branchName", e.target.value)}
                                                placeholder="e.g. MAIN BRANCH, PRODDATUR"
                                                className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-indigo-500"
                                              />
                                            </div>
                                            <div className="space-y-1">
                                              <label className="text-[10px] font-semibold text-foreground">Phone Number</label>
                                              <input
                                                type="text"
                                                value={activeTemplate.storePhone || ""}
                                                onChange={(e) => updateTemplateProperty("storePhone", e.target.value)}
                                                placeholder="e.g. +91 9849344919"
                                                className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-indigo-500"
                                              />
                                            </div>
                                          </div>

                                          <div className="space-y-1">
                                            <label className="text-[10px] font-semibold text-foreground">Store Address</label>
                                            <input
                                              type="text"
                                              value={activeTemplate.storeAddress || ""}
                                              onChange={(e) => updateTemplateProperty("storeAddress", e.target.value)}
                                              placeholder="Street, City, State, Pincode"
                                              className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-indigo-500"
                                            />
                                          </div>

                                          <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                              <label className="text-[10px] font-semibold text-foreground">GSTIN / Tax ID</label>
                                              <input
                                                type="text"
                                                value={activeTemplate.gstin || ""}
                                                onChange={(e) => updateTemplateProperty("gstin", e.target.value)}
                                                placeholder="GSTIN (e.g. 37AAFCOE694G1Z4)"
                                                className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs text-foreground font-mono focus:border-indigo-500"
                                              />
                                            </div>
                                            <div className="space-y-1">
                                              <label className="text-[10px] font-semibold text-foreground">Store Tagline / Subtitle</label>
                                              <input
                                                type="text"
                                                value={activeTemplate.customTaglineText || ""}
                                                onChange={(e) => updateTemplateProperty("customTaglineText", e.target.value)}
                                                placeholder="e.g. Quality Products Everyday"
                                                className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-indigo-500"
                                              />
                                            </div>
                                          </div>

                                          {/* Header Visibility Toggles */}
                                          <div className="pt-2 border-t border-border/50">
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                                              Header Visibility Toggles
                                            </label>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                              <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                                <input
                                                  type="checkbox"
                                                  checked={activeTemplate.showStoreName !== false}
                                                  onChange={(e) => updateTemplateProperty("showStoreName" as any, e.target.checked)}
                                                  className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <span className="text-[11px] font-medium text-foreground">Store Name</span>
                                              </label>
                                              <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                                <input
                                                  type="checkbox"
                                                  checked={activeTemplate.showBranch !== false}
                                                  onChange={(e) => updateTemplateProperty("showBranch" as any, e.target.checked)}
                                                  className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <span className="text-[11px] font-medium text-foreground">Branch / Outlet</span>
                                              </label>
                                              <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                                <input
                                                  type="checkbox"
                                                  checked={activeTemplate.showAddress !== false}
                                                  onChange={(e) => updateTemplateProperty("showAddress" as any, e.target.checked)}
                                                  className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <span className="text-[11px] font-medium text-foreground">Address</span>
                                              </label>
                                              <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                                <input
                                                  type="checkbox"
                                                  checked={activeTemplate.showPhone !== false}
                                                  onChange={(e) => updateTemplateProperty("showPhone" as any, e.target.checked)}
                                                  className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <span className="text-[11px] font-medium text-foreground">Phone Number</span>
                                              </label>
                                              <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                                <input
                                                  type="checkbox"
                                                  checked={activeTemplate.showGstin !== false}
                                                  onChange={(e) => updateTemplateProperty("showGstin" as any, e.target.checked)}
                                                  className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <span className="text-[11px] font-medium text-foreground">GSTIN</span>
                                              </label>
                                              <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                                <input
                                                  type="checkbox"
                                                  checked={activeTemplate.showTagline !== false}
                                                  onChange={(e) => updateTemplateProperty("showTagline" as any, e.target.checked)}
                                                  className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <span className="text-[11px] font-medium text-foreground">Tagline</span>
                                              </label>
                                            </div>
                                          </div>
                                        </div>

                                        {/* 2. Dynamic Custom Header Fields (DL No, FSSAI, Doctor, Cashier, etc.) */}
                                        <div className="space-y-3 p-4 bg-muted/20 border border-border/70 rounded-2xl">
                                          <div className="flex items-center justify-between">
                                            <div>
                                              <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                                                Dynamic Custom Header Fields
                                              </h3>
                                              <p className="text-[10px] text-muted-foreground">Add custom licenses, DL No, FSSAI, Doctor, or Cashier</p>
                                            </div>
                                            <button
                                              onClick={handleAddThermalCustomField}
                                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[10px] font-bold shadow-xs hover:bg-indigo-700 cursor-pointer"
                                            >
                                              <Plus className="h-3 w-3" />
                                              Add Header Field
                                            </button>
                                          </div>

                                          {/* Quick Suggestion Chips */}
                                          <div className="flex flex-wrap gap-1.5 pt-1">
                                            <span className="text-[10px] text-muted-foreground self-center">Quick Add:</span>
                                            {[
                                              { label: "DL No", val: "DL-20B-184920" },
                                              { label: "FSSAI Lic", val: "10123999000142" },
                                              { label: "Doctor Name", val: "Dr. K. Sharma MD" },
                                              { label: "Salesperson", val: "Ramesh K." },
                                              { label: "CIN No", val: "U72200AP2026PTC1" },
                                            ].map((chip) => (
                                              <button
                                                key={chip.label}
                                                onClick={() => {
                                                  const existing = activeTemplate.customFields || [];
                                                  if (existing.some((f) => f.label.toLowerCase() === chip.label.toLowerCase())) {
                                                    toast.info(`${chip.label} already exists`);
                                                    return;
                                                  }
                                                  const newFields = [...existing, { id: `cf-${Date.now()}`, label: chip.label, value: chip.val, enabled: true }];
                                                  updateTemplateProperty("customFields" as any, newFields);
                                                  toast.success(`Added ${chip.label}`);
                                                }}
                                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 cursor-pointer"
                                              >
                                                + {chip.label}
                                              </button>
                                            ))}
                                          </div>

                                          {/* Custom Fields List */}
                                          <div className="space-y-2 pt-2">
                                            {(activeTemplate.customFields || []).length === 0 ? (
                                              <div className="text-center py-3 text-xs text-muted-foreground bg-card/60 rounded-xl border border-dashed border-border">
                                                No custom header fields added yet. Click &quot;Add Header Field&quot; or select a quick preset above.
                                              </div>
                                            ) : (
                                              (activeTemplate.customFields || []).map((field: any) => (
                                                <div key={field.id} className="p-2 bg-card rounded-xl border border-border">
                                                  <div className="flex items-center gap-2">
                                                    <input
                                                      type="checkbox"
                                                      checked={field.enabled !== false}
                                                      onChange={(e) => handleUpdateThermalCustomField(field.id, { enabled: e.target.checked })}
                                                      className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500 shrink-0"
                                                      title="Show/Hide on Thermal Receipt"
                                                    />
                                                    <input
                                                      type="text"
                                                      value={field.label ?? field.name ?? ""}
                                                      onChange={(e) => handleUpdateThermalCustomField(field.id, { label: e.target.value, name: e.target.value })}
                                                      placeholder="Field Label (e.g. DL No)"
                                                      className="w-1/3 min-w-0 rounded-lg border border-input bg-background px-2 py-1 text-xs text-foreground font-semibold"
                                                    />
                                                    {/* Source: bind to an EXISTING document field, or leave a new static value */}
                                                    <select
                                                      value={field.bindKey || ""}
                                                      onChange={(e) => handleUpdateThermalCustomField(field.id, { bindKey: e.target.value || undefined, source: e.target.value ? "field" : "static" })}
                                                      className="flex-1 min-w-0 rounded-lg border border-input bg-background px-2 py-1 text-xs text-foreground cursor-pointer"
                                                      title="Source — pick an existing field to auto-fill, or 'New / static' to type your own"
                                                    >
                                                      <option value="">✎ New / static value</option>
                                                      {FREEFORM_FIELD_BIND_OPTIONS.map((opt) => (
                                                        <option key={opt.key} value={opt.key}>{opt.label} (existing)</option>
                                                      ))}
                                                    </select>
                                                    <button
                                                      onClick={() => handleDeleteThermalCustomField(field.id)}
                                                      className="p-1 rounded-lg hover:bg-destructive/10 text-destructive cursor-pointer shrink-0"
                                                      title="Delete Field"
                                                    >
                                                      <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                  </div>
                                                  <input
                                                    type="text"
                                                    value={field.value}
                                                    disabled={Boolean(field.bindKey)}
                                                    onChange={(e) => handleUpdateThermalCustomField(field.id, { value: e.target.value })}
                                                    placeholder={field.bindKey ? "Auto-filled from live document value" : "Field Value (e.g. 10123999000142)"}
                                                    className="w-full mt-1.5 rounded-lg border border-input bg-background px-2 py-1 text-xs text-foreground disabled:opacity-60 disabled:italic disabled:bg-muted/40"
                                                  />
                                                  {field.bindKey && (
                                                    <p className="text-[9.5px] text-indigo-600 dark:text-indigo-400 mt-0.5">
                                                      Prints the live value of &quot;{FREEFORM_FIELD_BIND_OPTIONS.find((o) => o.key === field.bindKey)?.label || field.bindKey}&quot; from the document.
                                                    </p>
                                                  )}
                                                </div>
                                              ))
                                            )}
                                          </div>
                                        </div>

                                        {/* 3. Customer & Transaction Metadata */}
                                        <div className="space-y-3 p-4 bg-muted/20 border border-border/70 rounded-2xl">
                                          <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                            <User className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                            Customer & Transaction Metadata
                                          </h3>

                                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                              <input
                                                type="checkbox"
                                                checked={activeTemplate.fields.showCustomerDetails !== false}
                                                onChange={() => toggleElementField("showCustomerDetails")}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <span className="text-[11px] font-medium text-foreground">Customer Name</span>
                                            </label>
                                            <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                              <input
                                                type="checkbox"
                                                checked={activeTemplate.showCustomerPhone !== false}
                                                onChange={(e) => updateTemplateProperty("showCustomerPhone" as any, e.target.checked)}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <span className="text-[11px] font-medium text-foreground">Customer Mobile</span>
                                            </label>
                                            <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                              <input
                                                type="checkbox"
                                                checked={activeTemplate.showCustomerAddress !== false}
                                                onChange={(e) => updateTemplateProperty("showCustomerAddress" as any, e.target.checked)}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <span className="text-[11px] font-medium text-foreground">Customer Address</span>
                                            </label>
                                            <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                              <input
                                                type="checkbox"
                                                checked={activeTemplate.showCustomerGstin !== false}
                                                onChange={(e) => updateTemplateProperty("showCustomerGstin" as any, e.target.checked)}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <span className="text-[11px] font-medium text-foreground">Customer GSTIN</span>
                                            </label>
                                            <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                              <input
                                                type="checkbox"
                                                checked={activeTemplate.showPoNumber !== false}
                                                onChange={(e) => updateTemplateProperty("showPoNumber" as any, e.target.checked)}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <span className="text-[11px] font-medium text-foreground">PO Number</span>
                                            </label>
                                            <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                              <input
                                                type="checkbox"
                                                checked={activeTemplate.showEwayBill !== false}
                                                onChange={(e) => updateTemplateProperty("showEwayBill" as any, e.target.checked)}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <span className="text-[11px] font-medium text-foreground">E-Way Bill No</span>
                                            </label>
                                            <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                              <input
                                                type="checkbox"
                                                checked={activeTemplate.showVehicleNumber !== false}
                                                onChange={(e) => updateTemplateProperty("showVehicleNumber" as any, e.target.checked)}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <span className="text-[11px] font-medium text-foreground">Vehicle Number</span>
                                            </label>
                                            <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                              <input
                                                type="checkbox"
                                                checked={activeTemplate.showChallanNumber !== false}
                                                onChange={(e) => updateTemplateProperty("showChallanNumber" as any, e.target.checked)}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <span className="text-[11px] font-medium text-foreground">Challan Number</span>
                                            </label>
                                            <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                              <input
                                                type="checkbox"
                                                checked={activeTemplate.showCashierName !== false}
                                                onChange={(e) => updateTemplateProperty("showCashierName" as any, e.target.checked)}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <span className="text-[11px] font-medium text-foreground">Cashier / Terminal</span>
                                            </label>
                                          </div>
                                        </div>

                                        {/* 4. Item Table Columns & Dynamic Custom Item Columns */}
                                        <div className="space-y-3 p-4 bg-muted/20 border border-border/70 rounded-2xl">
                                          <div className="flex items-center justify-between">
                                            <div>
                                              <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                <Columns className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                                Item Table Columns & Custom Attributes
                                              </h3>
                                              <p className="text-[10px] text-muted-foreground">Toggle standard columns and add custom attributes like Rack, Size, Color</p>
                                            </div>
                                            <button
                                              onClick={handleAddThermalCustomColumn}
                                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[10px] font-bold shadow-xs hover:bg-indigo-700 cursor-pointer"
                                            >
                                              <Plus className="h-3 w-3" />
                                              Add Item Column
                                            </button>
                                          </div>

                                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                              <input
                                                type="checkbox"
                                                checked={activeTemplate.fields.showItemIndex !== false}
                                                onChange={() => toggleElementField("showItemIndex")}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <span className="text-[11px] font-medium text-foreground">S.No / Index (1,2,3)</span>
                                            </label>
                                            <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                              <input
                                                type="checkbox"
                                                checked={activeTemplate.fields.showDescription !== false}
                                                onChange={() => toggleElementField("showDescription")}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <span className="text-[11px] font-medium text-foreground">Item Description</span>
                                            </label>
                                            <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                              <input
                                                type="checkbox"
                                                checked={activeTemplate.fields.showHSN !== false}
                                                onChange={() => toggleElementField("showHSN")}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <span className="text-[11px] font-medium text-foreground">HSN / SAC Code</span>
                                            </label>
                                            <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                              <input
                                                type="checkbox"
                                                checked={activeTemplate.showBatchNumber !== false}
                                                onChange={(e) => updateTemplateProperty("showBatchNumber" as any, e.target.checked)}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <span className="text-[11px] font-medium text-foreground">Batch Number</span>
                                            </label>
                                            <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                              <input
                                                type="checkbox"
                                                checked={activeTemplate.showExpiryDate !== false}
                                                onChange={(e) => updateTemplateProperty("showExpiryDate" as any, e.target.checked)}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <span className="text-[11px] font-medium text-foreground">Expiry Date (EXP)</span>
                                            </label>
                                            <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                              <input
                                                type="checkbox"
                                                checked={activeTemplate.fields.showMRP !== false}
                                                onChange={() => toggleElementField("showMRP")}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <span className="text-[11px] font-medium text-foreground">MRP & Savings</span>
                                            </label>
                                            <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                              <input
                                                type="checkbox"
                                                checked={activeTemplate.fields.showDiscountBadge !== false}
                                                onChange={() => toggleElementField("showDiscountBadge")}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <span className="text-[11px] font-medium text-foreground">Item Discount</span>
                                            </label>
                                            <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                              <input
                                                type="checkbox"
                                                checked={activeTemplate.showGstRateColumn !== false}
                                                onChange={(e) => updateTemplateProperty("showGstRateColumn" as any, e.target.checked)}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <span className="text-[11px] font-medium text-foreground">GST % Rate</span>
                                            </label>
                                            <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                              <input
                                                type="checkbox"
                                                checked={activeTemplate.showSkuCode !== false}
                                                onChange={(e) => updateTemplateProperty("showSkuCode" as any, e.target.checked)}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <span className="text-[11px] font-medium text-foreground">SKU / Item Code</span>
                                            </label>
                                          </div>

                                          {/* Quick Add Custom Item Column Chips */}
                                          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/50">
                                            <span className="text-[10px] text-muted-foreground self-center">Quick Custom Column:</span>
                                            {[
                                              { label: "Rack No", key: "rack_no" },
                                              { label: "Size / Color", key: "size_color" },
                                              { label: "Serial / IMEI", key: "serial_no" },
                                              { label: "Brand", key: "brand_name" },
                                            ].map((chip) => (
                                              <button
                                                key={chip.label}
                                                onClick={() => {
                                                  const existing = activeTemplate.customItemColumns || [];
                                                  if (existing.some((c) => (c.label || c.name || "").toLowerCase() === chip.label.toLowerCase())) {
                                                    toast.info(`${chip.label} column already exists`);
                                                    return;
                                                  }
                                                  handleAddThermalCustomColumn(chip.label);
                                                }}
                                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 cursor-pointer"
                                              >
                                                + {chip.label}
                                              </button>
                                            ))}
                                          </div>

                                          {/* Custom Columns List */}
                                          <div className="space-y-2 pt-1">
                                            {(activeTemplate.customItemColumns || []).length > 0 && (
                                              <div className="space-y-1.5">
                                                {(activeTemplate.customItemColumns || []).map((col) => (
                                                  <div key={col.id} className="flex items-center gap-2 p-2 bg-card rounded-xl border border-border">
                                                    <input
                                                      type="checkbox"
                                                      checked={col.enabled !== false}
                                                      onChange={(e) => handleUpdateThermalCustomColumn(col.id, { enabled: e.target.checked })}
                                                      className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500 shrink-0"
                                                      title="Enable Column on Thermal Receipt"
                                                    />
                                                    <input
                                                      type="text"
                                                      value={col.label || col.name || ""}
                                                      onChange={(e) => handleUpdateThermalCustomColumn(col.id, { label: e.target.value, name: e.target.value })}
                                                      placeholder="Column Label (e.g. Rack No)"
                                                      className="flex-1 rounded-lg border border-input bg-background px-2 py-1 text-xs text-foreground font-semibold"
                                                    />
                                                    <button
                                                      onClick={() => handleDeleteThermalCustomColumn(col.id)}
                                                      className="p-1 rounded-lg hover:bg-destructive/10 text-destructive cursor-pointer shrink-0"
                                                      title="Delete Column"
                                                    >
                                                      <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {/* 5. Summary & Totals Toggles */}
                                        <div className="space-y-3 p-4 bg-muted/20 border border-border/70 rounded-2xl">
                                          <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                            <Calculator className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                            Summary, Billed Quantity & Tax Split
                                          </h3>

                                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                              <input
                                                type="checkbox"
                                                checked={activeTemplate.showTotalQuantity !== false}
                                                onChange={(e) => updateTemplateProperty("showTotalQuantity" as any, e.target.checked)}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <span className="text-[11px] font-medium text-foreground">Total Billed Qty (e.g. 3 Items / 7 Units)</span>
                                            </label>
                                            <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                              <input
                                                type="checkbox"
                                                checked={activeTemplate.fields.showTaxSplit !== false}
                                                onChange={() => toggleElementField("showTaxSplit")}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <span className="text-[11px] font-medium text-foreground">GST Split (CGST + SGST)</span>
                                            </label>
                                            <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                              <input
                                                type="checkbox"
                                                checked={activeTemplate.showTotalSavings !== false}
                                                onChange={(e) => updateTemplateProperty("showTotalSavings" as any, e.target.checked)}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <span className="text-[11px] font-medium text-foreground">Total Savings Highlight</span>
                                            </label>
                                            <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                              <input
                                                type="checkbox"
                                                checked={activeTemplate.showPaidInFullStamp !== false}
                                                onChange={(e) => updateTemplateProperty("showPaidInFullStamp" as any, e.target.checked)}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <span className="text-[11px] font-medium text-foreground">Paid In Full Stamp Badge</span>
                                            </label>
                                            <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                              <input
                                                type="checkbox"
                                                checked={activeTemplate.fields.showPaymentDetails !== false}
                                                onChange={() => toggleElementField("showPaymentDetails")}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <span className="text-[11px] font-medium text-foreground">Payment Mode & Change Returned</span>
                                            </label>
                                            <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                              <input
                                                type="checkbox"
                                                checked={activeTemplate.fields.showPartyBalance !== false}
                                                onChange={() => toggleElementField("showPartyBalance")}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <span className="text-[11px] font-medium text-foreground">Customer Ledger Balance</span>
                                            </label>
                                          </div>
                                        </div>

                                        {/* 6. Terms & Conditions & Statutory Declaration */}
                                        <div className="space-y-3 p-4 bg-muted/20 border border-border/70 rounded-2xl">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <input
                                                type="checkbox"
                                                id="thermal-terms-toggle"
                                                checked={activeTemplate.fields.showTerms !== false}
                                                onChange={() => toggleElementField("showTerms")}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <label htmlFor="thermal-terms-toggle" className="text-xs font-bold text-foreground cursor-pointer flex items-center gap-1.5">
                                                <FileText className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                                Terms & Conditions / Disclaimer
                                              </label>
                                            </div>
                                            <button
                                              onClick={handleSyncWithCoreErp}
                                              className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                                            >
                                              Sync Terms with CoreERP
                                            </button>
                                          </div>

                                          {activeTemplate.fields.showTerms !== false && (
                                            <textarea
                                              rows={3}
                                              value={activeTemplate.termsAndConditionsText || activeTemplate.termsText || ""}
                                              onChange={(e) => {
                                                updateTemplateProperty("termsAndConditionsText" as any, e.target.value);
                                                updateTemplateProperty("termsText", e.target.value);
                                              }}
                                              placeholder="1. Goods once sold will not be taken back or exchanged.&#10;2. Subject to local jurisdiction only."
                                              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-indigo-500 font-mono"
                                            />
                                          )}

                                          {/* Statutory Declaration */}
                                          <div className="pt-2 border-t border-border/50 space-y-2">
                                            <div className="flex items-center gap-2">
                                              <input
                                                type="checkbox"
                                                id="thermal-declaration-toggle"
                                                checked={activeTemplate.showDeclaration !== false}
                                                onChange={(e) => updateTemplateProperty("showDeclaration" as any, e.target.checked)}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <label htmlFor="thermal-declaration-toggle" className="text-xs font-bold text-foreground cursor-pointer">
                                                Statutory GST Declaration Note
                                              </label>
                                            </div>
                                            {activeTemplate.showDeclaration !== false && (
                                              <textarea
                                                rows={2}
                                                value={activeTemplate.declarationText || "We declare that this invoice shows the actual price of the goods described and all particulars are true and correct."}
                                                onChange={(e) => updateTemplateProperty("declarationText" as any, e.target.value)}
                                                placeholder="Statutory declaration statement..."
                                                className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-indigo-500"
                                              />
                                            )}
                                          </div>

                                          {/* Thank You Note & Tagline */}
                                          <div className="pt-2 border-t border-border/50 grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                              <label className="text-[10px] font-semibold text-foreground">Thank You Note</label>
                                              <input
                                                type="text"
                                                value={activeTemplate.thankYouNote || activeTemplate.footerText || ""}
                                                onChange={(e) => {
                                                  updateTemplateProperty("thankYouNote", e.target.value);
                                                  updateTemplateProperty("footerText", e.target.value);
                                                }}
                                                placeholder="THANK YOU! VISIT AGAIN"
                                                className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-indigo-500 font-bold"
                                              />
                                            </div>
                                            <div className="space-y-1">
                                              <label className="text-[10px] font-semibold text-foreground">Footer Subtext / Note</label>
                                              <input
                                                type="text"
                                                value={activeTemplate.footerNote || ""}
                                                onChange={(e) => updateTemplateProperty("footerNote" as any, e.target.value)}
                                                placeholder="Save Paper, Save Trees!"
                                                className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-indigo-500 italic"
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ) : activeEditorTab === "content" ? (
                                      <div className="space-y-4">
                                        {/* ══ (a) PARTY DETAILS CONTROLS ══ */}
                                        <div className="space-y-2.5 p-3.5 bg-muted/20 border border-border/70 rounded-2xl">
                                          <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                              <User className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                              {t("Party Details", "Party Details")}
                                            </h4>
                                            <span className="text-[9px] font-semibold text-muted-foreground">
                                              Toggle buyer &amp; consignee party fields across all 3 party layouts
                                            </span>
                                          </div>
                                          <div className="grid grid-cols-2 gap-1.5">
                                            {([
                                              { key: "showBillTo", label: "Bill To (Buyer)" },
                                              { key: "showShipTo", label: "Ship To (Consignee)" },
                                              { key: "showPartyPhone", label: "Party Phone" },
                                              { key: "showPartyEmail", label: "Party Email" },
                                              { key: "showPartyGstin", label: "Party GSTIN" },
                                              { key: "showPartyPan", label: "Party PAN" },
                                              { key: "showPartyDlNumber", label: "Drug License (DL No)" },
                                              { key: "showPlaceOfSupply", label: "Place of Supply" },
                                              { key: "showPartyBalance", label: "Party Balance" },
                                              { key: "showContactPerson", label: "Contact Person" },
                                            ] as const).map(({ key, label }) => (
                                              <label key={key} className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                                <input
                                                  type="checkbox"
                                                  checked={isPartyFieldChecked(key)}
                                                  onChange={(e) => handlePartyToggle(key, e.target.checked)}
                                                  className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                />
                                                <span className="text-[11px] font-medium text-foreground">{label}</span>
                                              </label>
                                            ))}
                                          </div>
                                        </div>

                                        {/* ══ (b) ITEMS TABLE COLUMNS MANAGER ══ */}
                                        <div className="space-y-2.5 p-3.5 bg-muted/20 border border-border/70 rounded-2xl">
                                          <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                              <Columns className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                              {t("Items Table Columns", "Items Table Columns")}
                                            </h4>
                                            <span className="text-[9px] font-semibold text-muted-foreground">
                                              Edit this template's columns — the live preview updates instantly
                                            </span>
                                          </div>
                                          <div className="space-y-1.5">
                                            {getA4Columns().map((col: any, idx: number) => (
                                              <div key={col.id || col.fieldKey || idx} className="flex items-center gap-1.5 p-1.5 bg-card rounded-lg border border-border/60">
                                                <input
                                                  type="checkbox"
                                                  checked={col.enabled !== false}
                                                  onChange={(e) => updateA4Columns((cols) => cols.map((c: any) => c.id === col.id ? { ...c, enabled: e.target.checked } : c))}
                                                  className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500 shrink-0 cursor-pointer"
                                                  title="Show / hide this column"
                                                />
                                                <input
                                                  type="text"
                                                  value={col.headerTitle || col.fieldKey}
                                                  onChange={(e) => updateA4Columns((cols) => cols.map((c: any) => c.id === col.id ? { ...c, headerTitle: e.target.value } : c))}
                                                  placeholder="Column header"
                                                  className="flex-1 min-w-0 h-7 rounded-lg border border-input bg-background px-2 text-[11px] font-semibold text-foreground focus:border-indigo-500"
                                                />
                                                <select
                                                  value={col.align || "left"}
                                                  onChange={(e) => updateA4Columns((cols) => cols.map((c: any) => c.id === col.id ? { ...c, align: e.target.value } : c))}
                                                  className="h-7 rounded-lg border border-input bg-background px-1 text-[10px] font-semibold text-foreground cursor-pointer"
                                                  title="Alignment"
                                                >
                                                  <option value="left">L</option>
                                                  <option value="center">C</option>
                                                  <option value="right">R</option>
                                                </select>
                                                <div className="flex items-center gap-0.5 shrink-0">
                                                  <button onClick={() => updateA4Columns((cols) => { const i = cols.findIndex((c: any) => c.id === col.id); if (i <= 0) return cols; const n = [...cols]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })} className="p-0.5 rounded hover:bg-muted text-muted-foreground cursor-pointer" title="Move up"><ArrowUp className="h-3 w-3" /></button>
                                                  <button onClick={() => updateA4Columns((cols) => { const i = cols.findIndex((c: any) => c.id === col.id); if (i < 0 || i >= cols.length - 1) return cols; const n = [...cols]; [n[i], n[i + 1]] = [n[i + 1], n[i]]; return n; })} className="p-0.5 rounded hover:bg-muted text-muted-foreground cursor-pointer" title="Move down"><ArrowDown className="h-3 w-3" /></button>
                                                  {col.isCustom && (
                                                    <button onClick={() => updateA4Columns((cols) => cols.filter((c: any) => c.id !== col.id))} className="p-0.5 rounded hover:bg-destructive/10 text-destructive cursor-pointer" title="Delete custom column"><Trash2 className="h-3 w-3" /></button>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                            {getA4Columns().length === 0 && (
                                              <p className="text-[10px] text-muted-foreground py-2 text-center">No explicit columns yet — the template uses its default item columns. Add one below.</p>
                                            )}
                                          </div>

                                          {/* [+ Add Column] picker: standard key OR custom */}
                                          {(() => {
                                            const availableStandard = [
                                              "sno", "description", "hsn", "batch", "expiry_date", "uom", "tax_rate", "cgst", "sgst", "igst", "unit_price", "selling_price", "mrp", "discount", "quantity", "total_amount",
                                            ].filter((k) => !getA4Columns().some((c: any) => (c.fieldKey || c.key) === k));
                                            return (
                                              <div className="space-y-1.5 pt-1 border-t border-border/40">
                                                <button onClick={() => setColAddOpen((o) => !o)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-[10.5px] font-bold shadow-xs hover:bg-indigo-700 cursor-pointer">
                                                  <Plus className="h-3 w-3" /> {t("Add Column", "Add Column")}
                                                </button>
                                                {colAddOpen && (
                                                  <div className="space-y-2 p-2.5 bg-card rounded-xl border border-border/70">
                                                    <div>
                                                      <label className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Standard field</label>
                                                      <div className="flex flex-wrap gap-1">
                                                        {availableStandard.length === 0 && <span className="text-[10px] text-muted-foreground">All standard fields already present</span>}
                                                        {availableStandard.map((k) => (
                                                          <button key={k} onClick={() => { addA4StandardColumn(k); setColAddOpen(false); }} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 cursor-pointer">
                                                            + {k.replace("_", " ")}
                                                          </button>
                                                        ))}
                                                      </div>
                                                    </div>
                                                    <div className="pt-1 border-t border-border/40 space-y-1.5">
                                                      <label className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider block">Custom column</label>
                                                      <input value={newCustomName} onChange={(e) => setNewCustomName(e.target.value)} placeholder="Column name (e.g. Dispatch Ref)" className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[11px] text-foreground focus:border-indigo-500" />
                                                      <div className="grid grid-cols-2 gap-1.5">
                                                        <select value={newCustomSource} onChange={(e) => setNewCustomSource(e.target.value as any)} className="h-7 rounded-lg border border-input bg-background px-1.5 text-[10.5px] text-foreground cursor-pointer">
                                                          <option value="static">Static value</option>
                                                          <option value="item_field">Item field</option>
                                                          <option value="customer_field">Customer field</option>
                                                        </select>
                                                        <input
                                                          value={newCustomValue}
                                                          onChange={(e) => setNewCustomValue(e.target.value)}
                                                          placeholder={newCustomSource === "static" ? "Value" : newCustomSource === "item_field" ? "item field key" : "customer field key"}
                                                          className="h-7 rounded-lg border border-input bg-background px-2 text-[10.5px] font-mono text-foreground focus:border-indigo-500"
                                                        />
                                                      </div>
                                                      <button
                                                        onClick={() => { if (!newCustomName.trim()) { toast.error("Give the custom column a name first"); return; } addA4CustomColumn(newCustomName.trim(), newCustomSource, newCustomValue.trim()); setNewCustomName(""); setNewCustomValue(""); setColAddOpen(false); }}
                                                        className="w-full h-7 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10.5px] font-bold cursor-pointer"
                                                      >
                                                        Add custom column
                                                      </button>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })()}
                                        </div>

                                        {/* ══ (b) DISPATCH & SHIPPING FIELDS ══ */}
                                        <div className="space-y-2.5 p-3.5 bg-muted/20 border border-border/70 rounded-2xl">
                                          <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                            <Truck className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                            {t("Dispatch & Shipping Fields", "Dispatch & Shipping Fields")}
                                          </h4>
                                          <div className="grid grid-cols-2 gap-1.5">
                                            {([
                                              { key: "showPoNumber", label: "PO No" },
                                              { key: "showVehicleNumber", label: "Vehicle No" },
                                              { key: "showEwayBill", label: "e-Way No / Date" },
                                              { key: "showChallanNumber", label: "Challan No" },
                                            ] as const).map(({ key, label }) => (
                                              <label key={key} className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card text-xs cursor-pointer hover:bg-muted/30">
                                                <input type="checkbox" checked={Boolean((activeTemplate as any).fields?.[key])} onChange={(e) => setA4FieldToggle(key, e.target.checked)} className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500" />
                                                <span className="text-[11px] font-medium text-foreground">{label}</span>
                                              </label>
                                            ))}
                                          </div>
                                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider pt-1">Default values (shown when a document has none)</p>
                                          <div className="grid grid-cols-2 gap-2">
                                            {([
                                              { key: "poNo", label: "PO No" },
                                              { key: "vehicleNo", label: "Vehicle No" },
                                              { key: "ewayNo", label: "e-Way No" },
                                              { key: "challanNo", label: "Challan No" },
                                              { key: "transporter", label: "Transporter" },
                                              { key: "driverName", label: "Driver Name" },
                                              { key: "driverPhone", label: "Driver Phone" },
                                              { key: "lrNo", label: "LR No" },
                                              { key: "dispatchMode", label: "Dispatch Mode" },
                                            ] as const).map(({ key, label }) => (
                                              <div key={key} className="space-y-0.5">
                                                <label className="text-[9.5px] font-semibold text-muted-foreground block">{label}</label>
                                                <input
                                                  type="text"
                                                  value={(activeTemplate as any).dispatchDefaults?.[key] || ""}
                                                  onChange={(e) => setA4DispatchDefault(key, e.target.value)}
                                                  placeholder={label}
                                                  className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10.5px] text-foreground focus:border-indigo-500"
                                                />
                                              </div>
                                            ))}
                                          </div>
                                        </div>

                                        {/* ══ (c) FREEFORM FIELDS (template.customFields) ══ */}
                                        <div className="space-y-2.5 p-3.5 bg-muted/20 border border-border/70 rounded-2xl">
                                          <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                              <FilePlus2 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                              {t("Freeform Fields", "Freeform Fields")}
                                            </h4>
                                            <button onClick={() => handleAddThermalCustomField("New Field")} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-600 text-white text-[10px] font-bold shadow-xs hover:bg-indigo-700 cursor-pointer">
                                              <Plus className="h-3 w-3" /> {t("Add Field", "Add Field")}
                                            </button>
                                          </div>
                                          <div className="space-y-1.5">
                                            {(activeTemplate.customFields || []).length === 0 ? (
                                              <p className="text-[10px] text-muted-foreground py-1.5 text-center">No freeform key–value pairs yet. Add one to print extra labels on this document.</p>
                                            ) : (
                                              (activeTemplate.customFields || []).map((field: any) => (
                                                <div key={field.id} className="p-1.5 bg-card rounded-lg border border-border/60">
                                                  <div className="flex items-center gap-1.5">
                                                    <input type="checkbox" checked={field.enabled !== false} onChange={(e) => handleUpdateThermalCustomField(field.id, { enabled: e.target.checked })} className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500 shrink-0" title="Show / hide" />
                                                    <input type="text" value={field.name || field.label} onChange={(e) => handleUpdateThermalCustomField(field.id, { name: e.target.value, label: e.target.value })} placeholder="Key (e.g. DL No)" className="w-2/5 min-w-0 rounded-lg border border-input bg-background px-2 py-1 text-[10.5px] font-semibold text-foreground" />
                                                    <select
                                                      value={field.bindKey || ""}
                                                      onChange={(e) => handleUpdateThermalCustomField(field.id, { bindKey: e.target.value || undefined, source: e.target.value ? "field" : "static" })}
                                                      className="flex-1 min-w-0 rounded-lg border border-input bg-background px-2 py-1 text-[10.5px] text-foreground cursor-pointer"
                                                      title="Source — bind to an existing document field, or keep a new static value"
                                                    >
                                                      <option value="">✎ New / static value</option>
                                                      {FREEFORM_FIELD_BIND_OPTIONS.map((opt) => (
                                                        <option key={opt.key} value={opt.key}>{opt.label} (existing)</option>
                                                      ))}
                                                    </select>
                                                    <button onClick={() => handleDeleteThermalCustomField(field.id)} className="p-1 rounded hover:bg-destructive/10 text-destructive cursor-pointer shrink-0" title="Delete"><Trash2 className="h-3 w-3" /></button>
                                                  </div>
                                                  <input
                                                    type="text"
                                                    value={field.value}
                                                    disabled={Boolean(field.bindKey)}
                                                    onChange={(e) => handleUpdateThermalCustomField(field.id, { value: e.target.value })}
                                                    placeholder={field.bindKey ? "Auto-filled from live document value" : "Value"}
                                                    className="w-full mt-1 rounded-lg border border-input bg-background px-2 py-1 text-[10.5px] text-foreground disabled:opacity-60 disabled:italic disabled:bg-muted/40"
                                                  />
                                                  {field.bindKey && (
                                                    <p className="text-[9.5px] text-indigo-600 dark:text-indigo-400 mt-0.5">
                                                      Prints the live value of &quot;{FREEFORM_FIELD_BIND_OPTIONS.find((o) => o.key === field.bindKey)?.label || field.bindKey}&quot;.
                                                    </p>
                                                  )}
                                                </div>
                                              ))
                                            )}
                                          </div>
                                        </div>
                                    {/* (d) Texts & Labels + Section Visibility (moved out of the Design tab) */}
                                        <div className="space-y-3 pt-2 border-t border-border/50">
    {/* Texts & Labels — full word-level customization (myBillBook / Word style) */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-1.5">
                          <Type className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                          <h4 className="text-xs font-bold text-foreground">{t("Texts & Labels", "Texts & Labels")}</h4>
                          <span className="text-[10px] text-muted-foreground font-medium hidden sm:inline">
                            Rename any visible word — titles, headers, totals, bank & QR captions, terms
                          </span>
                        </div>
                        {TEXT_LABEL_GROUPS.map((group) => (
                          <div key={group.title} className="rounded-xl border border-border/60 bg-card p-2.5">
                            <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground mb-1.5">{group.title}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {group.items.map((item) => (
                                <label key={item.key} className="space-y-0.5">
                                  <span className="text-[9.5px] font-semibold text-foreground">{item.label}</span>
                                  <input
                                    type="text"
                                    value={activeTemplateTexts[item.key] ?? ""}
                                    placeholder={resolvedInvoiceTexts[item.key as keyof InvoiceTexts] || item.label}
                                    onChange={(e) => updateTemplateTexts(item.key, e.target.value)}
                                    className="w-full rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground focus:ring-2 focus:ring-indigo-500/40"
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Template Elements (14 Reorderable & Toggleable Elements) */}
                      <div className="space-y-2 pt-2 border-t border-border/50">
                        <div>
                          <h4 className="text-xs font-bold text-foreground">{t("Template Elements", "Template Elements")}</h4>
                          <p className="text-[10.5px] text-muted-foreground">{t("Drag to reorder or enable/disable elements", "Drag to reorder or enable/disable elements")}</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <ElementToggleRow
                            icon={Building2}
                            label="Company Details"
                            checked={!!activeTemplate.fields.showCompanyDetails}
                            onChange={() => toggleElementField("showCompanyDetails")}
                          />
                          <ElementToggleRow
                            icon={Receipt}
                            label="Invoice Details (No, Date, Bill To)"
                            checked={!!activeTemplate.fields.showInvoiceDetails}
                            onChange={() => toggleElementField("showInvoiceDetails")}
                          />
                          <ElementToggleRow
                            icon={TableIcon}
                            label="Item Table"
                            checked={!!activeTemplate.fields.showItemTable}
                            onChange={() => toggleElementField("showItemTable")}
                          />
                          <ElementToggleRow
                            icon={ScanBarcode}
                            label="Barcode"
                            checked={!!activeTemplate.fields.showBarcode}
                            onChange={() => toggleElementField("showBarcode")}
                          />
                          <ElementToggleRow
                            icon={User}
                            label="Customer Details"
                            checked={!!activeTemplate.fields.showCustomerDetails}
                            onChange={() => toggleElementField("showCustomerDetails")}
                          />
                          <ElementToggleRow
                            icon={CreditCard}
                            label="Payment Details"
                            checked={!!activeTemplate.fields.showPaymentDetails}
                            onChange={() => toggleElementField("showPaymentDetails")}
                          />
                          <ElementToggleRow
                            icon={Calculator}
                            label="Tax / GST % Split"
                            checked={!!activeTemplate.fields.showTaxSplit}
                            onChange={() => toggleElementField("showTaxSplit")}
                          />
                          <ElementToggleRow
                            icon={ImageIcon}
                            label="Product Image in Items"
                            checked={!!activeTemplate.fields.showProductImage}
                            onChange={() => toggleElementField("showProductImage")}
                          />
                          <ElementToggleRow
                            icon={CreditCard}
                            label="Party Balance Summary"
                            checked={!!activeTemplate.fields.showPartyBalance}
                            onChange={() => toggleElementField("showPartyBalance")}
                          />
                          <ElementToggleRow
                            icon={HeartHandshake}
                            label="Thank You Note & Footer"
                            checked={!!activeTemplate.fields.showThankYou}
                            onChange={() => toggleElementField("showThankYou")}
                          />
                        </div>
                      </div>
                                        </div>
                                      </div>
                                    ) : null}

                                    {activeEditorTab === "branding" && isThermalTemplate ? (
                                      <div className="space-y-5">
                                        {/* 1. Store Logo on Thermal Paper */}
                                        <div className="space-y-3 p-4 bg-muted/20 border border-border/70 rounded-2xl">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <input
                                                type="checkbox"
                                                id="thermal-logo-toggle"
                                                checked={activeTemplate.fields?.showLogo !== false}
                                                onChange={() => toggleElementField("showLogo")}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <label htmlFor="thermal-logo-toggle" className="text-xs font-bold text-foreground cursor-pointer flex items-center gap-1.5">
                                                <ImageIcon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                                Print Store Logo on Thermal Paper
                                              </label>
                                            </div>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                              High Contrast Dithered
                                            </span>
                                          </div>

                                          {activeTemplate.fields?.showLogo !== false && (
                                            <div className="space-y-3 pt-1">
                                              <div className="flex items-center gap-3">
                                                {activeTemplate.logoUrl ? (
                                                  <div className="relative h-14 w-28 bg-white border border-slate-300 rounded-lg p-1 flex items-center justify-center overflow-hidden shadow-xs">
                                                    <img
                                                      src={activeTemplate.logoUrl}
                                                      alt="Thermal Logo"
                                                      className="max-h-full max-w-full object-contain filter grayscale contrast-200"
                                                    />
                                                  </div>
                                                ) : (
                                                  <div className="h-14 w-28 bg-muted rounded-lg border border-dashed border-border flex items-center justify-center text-[10px] text-muted-foreground text-center px-1">
                                                    No Logo Set
                                                  </div>
                                                )}

                                                <div className="flex-1 space-y-1.5">
                                                  <input
                                                    ref={thermalLogoInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => handleThermalImageUpload(e, "logoUrl")}
                                                  />
                                                  <div className="flex gap-2">
                                                    <button
                                                      onClick={() => thermalLogoInputRef.current?.click()}
                                                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold shadow-xs hover:bg-indigo-700 cursor-pointer"
                                                    >
                                                      <Upload className="h-3.5 w-3.5" />
                                                      Upload Logo
                                                    </button>
                                                    {activeTemplate.logoUrl && (
                                                      <button
                                                        onClick={() => updateTemplateProperty("logoUrl", "")}
                                                        className="px-2.5 py-1.5 rounded-lg border border-border hover:bg-destructive/10 text-destructive text-xs font-semibold cursor-pointer"
                                                      >
                                                        Remove
                                                      </button>
                                                    )}
                                                  </div>
                                                  <p className="text-[10px] text-muted-foreground">Recommended: Black & white transparent PNG or high contrast JPG</p>
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </div>

                                        {/* 2. Dynamic UPI Payment QR Code */}
                                        <div className="space-y-3 p-4 bg-muted/20 border border-border/70 rounded-2xl">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <input
                                                type="checkbox"
                                                id="thermal-upi-toggle"
                                                checked={activeTemplate.fields.showQR !== false}
                                                onChange={() => toggleElementField("showQR")}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <label htmlFor="thermal-upi-toggle" className="text-xs font-bold text-foreground cursor-pointer flex items-center gap-1.5">
                                                <QrCode className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                                Dynamic UPI Payment QR Code
                                              </label>
                                            </div>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                                              Auto-Generates Amount & Bill No
                                            </span>
                                          </div>

                                          {activeTemplate.fields.showQR !== false && (
                                            <div className="space-y-3 pt-1">
                                              <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                  <label className="text-[10px] font-semibold text-foreground">UPI VPA ID (Merchant ID)</label>
                                                  <input
                                                    type="text"
                                                    value={activeTemplate.upiId || ""}
                                                    onChange={(e) => updateTemplateProperty("upiId", e.target.value)}
                                                    placeholder="e.g. 9849344919@okaxis / store@upi"
                                                    className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs text-foreground font-mono focus:border-indigo-500"
                                                  />
                                                </div>
                                                <div className="space-y-1">
                                                  <label className="text-[10px] font-semibold text-foreground">Payee Name</label>
                                                  <input
                                                    type="text"
                                                    value={activeTemplate.payeeName || activeTemplate.storeName || ""}
                                                    onChange={(e) => updateTemplateProperty("payeeName" as any, e.target.value)}
                                                    placeholder="Business / Merchant Legal Name"
                                                    className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-indigo-500"
                                                  />
                                                </div>
                                              </div>

                                              {/* Custom Static QR Upload Option */}
                                              <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                                                <div className="space-y-0.5">
                                                  <span className="text-[11px] font-semibold text-foreground block">Or Upload Standee / Static QR Image</span>
                                                  <span className="text-[10px] text-muted-foreground">Upload your bank standee QR image directly</span>
                                                </div>
                                                <input
                                                  ref={thermalQrInputRef}
                                                  type="file"
                                                  accept="image/*"
                                                  className="hidden"
                                                  onChange={(e) => handleThermalImageUpload(e, "customQrUrl" as any)}
                                                />
                                                <div className="flex gap-2">
                                                  <button
                                                    onClick={() => thermalQrInputRef.current?.click()}
                                                    className="px-2.5 py-1 rounded-lg border border-border hover:bg-muted text-[11px] font-semibold text-foreground cursor-pointer flex items-center gap-1"
                                                  >
                                                    <Upload className="h-3 w-3" />
                                                    {activeTemplate.customQrUrl ? "Replace QR" : "Upload Custom QR"}
                                                  </button>
                                                  {activeTemplate.customQrUrl && (
                                                    <button
                                                      onClick={() => updateTemplateProperty("customQrUrl" as any, "")}
                                                      className="px-2 py-1 rounded-lg border border-border text-destructive text-[11px] font-semibold hover:bg-destructive/10 cursor-pointer"
                                                    >
                                                      Remove
                                                    </button>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </div>

                                        {/* 3. Google Review 5-Star Feedback QR Code */}
                                        <div className="space-y-3 p-4 bg-muted/20 border border-border/70 rounded-2xl">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <input
                                                type="checkbox"
                                                id="thermal-review-toggle"
                                                checked={activeTemplate.showGoogleReviewQR !== false}
                                                onChange={(e) => updateTemplateProperty("showGoogleReviewQR" as any, e.target.checked)}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <label htmlFor="thermal-review-toggle" className="text-xs font-bold text-foreground cursor-pointer flex items-center gap-1.5">
                                                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                                                Google Review 5-Star Feedback QR Code
                                              </label>
                                            </div>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                              Boosts Google Reviews
                                            </span>
                                          </div>

                                          {activeTemplate.showGoogleReviewQR !== false && (
                                            <div className="space-y-2 pt-1">
                                              <label className="text-[10px] font-semibold text-foreground">Google Business Review Link / URL</label>
                                              <input
                                                type="url"
                                                value={activeTemplate.googleReviewUrl || ""}
                                                onChange={(e) => updateTemplateProperty("googleReviewUrl" as any, e.target.value)}
                                                placeholder="https://g.page/r/your-google-place-id/review"
                                                className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs text-foreground font-mono focus:border-indigo-500"
                                              />
                                              <p className="text-[10px] text-muted-foreground">
                                                Customers scanning this QR on their phone will directly open your Google Review page to give 5 stars!
                                              </p>
                                            </div>
                                          )}
                                        </div>

                                        {/* 4. Digital Signature & Company Stamp */}
                                        <div className="space-y-3 p-4 bg-muted/20 border border-border/70 rounded-2xl">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <input
                                                type="checkbox"
                                                id="thermal-sig-toggle"
                                                checked={activeTemplate.showSignature !== false}
                                                onChange={(e) => updateTemplateProperty("showSignature" as any, e.target.checked)}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <label htmlFor="thermal-sig-toggle" className="text-xs font-bold text-foreground cursor-pointer flex items-center gap-1.5">
                                                <CheckCircle className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                                Digital Signature & Company Stamp
                                              </label>
                                            </div>
                                          </div>

                                          {activeTemplate.showSignature !== false && (
                                            <div className="space-y-3 pt-1">
                                              <div className="space-y-1">
                                                <label className="text-[10px] font-semibold text-foreground">Signatory Designation / Footer Label</label>
                                                <input
                                                  type="text"
                                                  value={activeTemplate.signatoryLabel || `Authorized Signatory For ${activeTemplate.storeName || "Venatic"}`}
                                                  onChange={(e) => updateTemplateProperty("signatoryLabel" as any, e.target.value)}
                                                  placeholder="e.g. Authorized Signatory / Manager"
                                                  className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-indigo-500"
                                                />
                                              </div>

                                              <div className="grid grid-cols-2 gap-3 pt-1">
                                                {/* Signature Upload */}
                                                <div className="p-3 bg-card rounded-xl border border-border space-y-2">
                                                  <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-bold text-foreground">Digital Signature</span>
                                                    {activeTemplate.signatureUrl && (
                                                      <button
                                                        onClick={() => updateTemplateProperty("signatureUrl" as any, "")}
                                                        className="text-[10px] font-semibold text-destructive hover:underline cursor-pointer"
                                                      >
                                                        Remove
                                                      </button>
                                                    )}
                                                  </div>
                                                  <input
                                                    ref={thermalSigInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => handleThermalImageUpload(e, "signatureUrl" as any)}
                                                  />
                                                  {activeTemplate.signatureUrl ? (
                                                    <div className="h-12 bg-white border border-slate-300 rounded p-1 flex items-center justify-center">
                                                      <img src={activeTemplate.signatureUrl} alt="Signature" className="max-h-full object-contain filter grayscale contrast-200" />
                                                    </div>
                                                  ) : (
                                                    <button
                                                      onClick={() => thermalSigInputRef.current?.click()}
                                                      className="w-full py-2 rounded-lg border border-dashed border-border hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center gap-1"
                                                    >
                                                      <Upload className="h-3 w-3" /> Upload Signature
                                                    </button>
                                                  )}
                                                </div>

                                                {/* Company Stamp Upload */}
                                                <div className="p-3 bg-card rounded-xl border border-border space-y-2">
                                                  <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-bold text-foreground">Company Stamp</span>
                                                    {activeTemplate.stampUrl && (
                                                      <button
                                                        onClick={() => updateTemplateProperty("stampUrl" as any, "")}
                                                        className="text-[10px] font-semibold text-destructive hover:underline cursor-pointer"
                                                      >
                                                        Remove
                                                      </button>
                                                    )}
                                                  </div>
                                                  <input
                                                    ref={thermalStampInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => handleThermalImageUpload(e, "stampUrl" as any)}
                                                  />
                                                  {activeTemplate.stampUrl ? (
                                                    <div className="h-12 bg-white border border-slate-300 rounded p-1 flex items-center justify-center">
                                                      <img src={activeTemplate.stampUrl} alt="Stamp" className="max-h-full object-contain filter grayscale contrast-200" />
                                                    </div>
                                                  ) : (
                                                    <button
                                                      onClick={() => thermalStampInputRef.current?.click()}
                                                      className="w-full py-2 rounded-lg border border-dashed border-border hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center gap-1"
                                                    >
                                                      <Upload className="h-3 w-3" /> Upload Stamp
                                                    </button>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ) : activeEditorTab === "branding" ? (
                                      <div className="space-y-4">
                                        {/* ══ HEADER BUSINESS DETAILS ══ */}
                                        <div className="space-y-2.5 p-3.5 bg-muted/20 border border-border/70 rounded-2xl">
                                          <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                              <Building2 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                              {t("Header Business Details", "Header Business Details")}
                                            </h4>
                                            <span className="text-[9px] font-semibold text-muted-foreground">
                                              Printed in document header across all layouts
                                            </span>
                                          </div>
                                          <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-0.5 col-span-2">
                                              <label className="text-[9.5px] font-semibold text-muted-foreground block">Store / Trade Name</label>
                                              <input
                                                type="text"
                                                value={activeTemplate.storeName || ""}
                                                onChange={(e) => updateTemplateProperty("storeName", e.target.value)}
                                                placeholder="Your Business Name"
                                                className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10.5px] font-bold text-foreground focus:border-indigo-500"
                                              />
                                            </div>
                                            <div className="space-y-0.5 col-span-2">
                                              <label className="text-[9.5px] font-semibold text-muted-foreground block">Business Address</label>
                                              <input
                                                type="text"
                                                value={activeTemplate.storeAddress || ""}
                                                onChange={(e) => updateTemplateProperty("storeAddress", e.target.value)}
                                                placeholder="Street, Area, City, State - PIN"
                                                className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10.5px] text-foreground focus:border-indigo-500"
                                              />
                                            </div>
                                            <div className="space-y-0.5">
                                              <label className="text-[9.5px] font-semibold text-muted-foreground block">Phone</label>
                                              <input
                                                type="text"
                                                value={activeTemplate.storePhone || ""}
                                                onChange={(e) => updateTemplateProperty("storePhone", e.target.value)}
                                                placeholder="+91 9876543210"
                                                className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10.5px] text-foreground focus:border-indigo-500"
                                              />
                                            </div>
                                            <div className="space-y-0.5">
                                              <label className="text-[9.5px] font-semibold text-muted-foreground block">Email</label>
                                              <input
                                                type="email"
                                                value={activeTemplate.email || ""}
                                                onChange={(e) => updateTemplateProperty("email", e.target.value)}
                                                placeholder="contact@business.com"
                                                className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10.5px] text-foreground focus:border-indigo-500"
                                              />
                                            </div>
                                            <div className="space-y-0.5">
                                              <label className="text-[9.5px] font-semibold text-muted-foreground block">GSTIN</label>
                                              <input
                                                type="text"
                                                value={activeTemplate.gstin || ""}
                                                onChange={(e) => updateTemplateProperty("gstin", e.target.value.toUpperCase())}
                                                placeholder="22AAAAA0000A1Z5"
                                                className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10.5px] font-mono text-foreground focus:border-indigo-500"
                                              />
                                            </div>
                                            <div className="space-y-0.5">
                                              <label className="text-[9.5px] font-semibold text-muted-foreground block">PAN</label>
                                              <input
                                                type="text"
                                                value={activeTemplate.pan || ""}
                                                onChange={(e) => updateTemplateProperty("pan", e.target.value.toUpperCase())}
                                                placeholder="AAAAA0000A"
                                                className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10.5px] font-mono text-foreground focus:border-indigo-500"
                                              />
                                            </div>
                                            <div className="space-y-0.5">
                                              <label className="text-[9.5px] font-semibold text-muted-foreground block">CIN</label>
                                              <input
                                                type="text"
                                                value={activeTemplate.cin || ""}
                                                onChange={(e) => updateTemplateProperty("cin", e.target.value.toUpperCase())}
                                                placeholder="U12345MH2020PTC000000"
                                                className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10.5px] font-mono text-foreground focus:border-indigo-500"
                                              />
                                            </div>
                                            <div className="space-y-0.5">
                                              <label className="text-[9.5px] font-semibold text-muted-foreground block">State Code</label>
                                              <input
                                                type="text"
                                                value={activeTemplate.sellerStateCode || ""}
                                                onChange={(e) => updateTemplateProperty("sellerStateCode", e.target.value)}
                                                placeholder="e.g. 27 or 37"
                                                className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10.5px] text-foreground focus:border-indigo-500"
                                              />
                                            </div>
                                          </div>
                                        </div>

                                        {/* ══ LOGO ══ */}
                                        <div className="space-y-2.5 p-3.5 bg-muted/20 border border-border/70 rounded-2xl">
                                          <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                            <ImageIcon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                            {t("Logo", "Logo")}
                                          </h4>
                                          <div className="grid grid-cols-2 gap-3 items-start">
                                            <div className="space-y-1.5">
                                              <label className="text-[9.5px] font-semibold text-muted-foreground block">Logo URL</label>
                                              <input
                                                type="text"
                                                value={activeTemplate.logoUrl || ""}
                                                onChange={(e) => updateTemplateProperty("logoUrl", e.target.value)}
                                                placeholder="https://... or /logo.png"
                                                className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10.5px] text-foreground focus:border-indigo-500"
                                              />
                                              <div className="flex gap-1.5">
                                                <input ref={thermalLogoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleThermalImageUpload(e, "logoUrl")} />
                                                <button onClick={() => thermalLogoInputRef.current?.click()} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border hover:bg-muted text-[10px] font-semibold text-foreground cursor-pointer">
                                                  <Upload className="h-3 w-3" /> {activeTemplate.logoUrl ? "Replace" : "Upload"}
                                                </button>
                                                {activeTemplate.logoUrl && (
                                                  <button onClick={() => updateTemplateProperty("logoUrl", "")} className="px-2 py-1 rounded-lg border border-border text-destructive text-[10px] font-semibold hover:bg-destructive/10 cursor-pointer">Remove</button>
                                                )}
                                              </div>
                                            </div>
                                            <div className="h-20 rounded-xl border border-border/60 bg-white p-2 flex items-center justify-center overflow-hidden">
                                              {activeTemplate.logoUrl ? (
                                                <img src={activeTemplate.logoUrl} alt="Logo preview" className="max-h-full max-w-full object-contain" />
                                              ) : (
                                                <span className="text-[10px] text-muted-foreground">No logo</span>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        {/* ══ SIGNATURE + SIGNATORY TITLE ══ */}
                                        <div className="space-y-2.5 p-3.5 bg-muted/20 border border-border/70 rounded-2xl">
                                          <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                            <PenTool className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                            {t("Signature & Signatory", "Signature & Signatory")}
                                          </h4>
                                          <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                              <label className="text-[9.5px] font-semibold text-muted-foreground block">Signature image</label>
                                              <input ref={thermalSigInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleThermalImageUpload(e, "signatureUrl")} />
                                              <div className="h-14 rounded-xl border border-dashed border-border bg-white flex items-center justify-center overflow-hidden">
                                                {activeTemplate.signatureUrl ? (
                                                  <img src={activeTemplate.signatureUrl} alt="Signature preview" className="max-h-full max-w-full object-contain filter grayscale" />
                                                ) : (
                                                  <button onClick={() => thermalSigInputRef.current?.click()} className="text-[10px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1">
                                                    <Upload className="h-3 w-3" /> {t("Upload Signature", "Upload Signature")}
                                                  </button>
                                                )}
                                              </div>
                                              {activeTemplate.signatureUrl && (
                                                <button onClick={() => updateTemplateProperty("signatureUrl" as any, "")} className="w-full text-[10px] font-semibold text-destructive hover:underline cursor-pointer">{t("Remove Signature", "Remove Signature")}</button>
                                              )}
                                            </div>
                                            <div className="space-y-1.5">
                                              <label className="text-[9.5px] font-semibold text-muted-foreground block">Signatory title</label>
                                              <input
                                                type="text"
                                                value={(activeTemplate as any).signatureTitle || activeTemplate.signatoryLabel || "Authorized Signatory"}
                                                onChange={(e) => {
                                                  updateTemplateProperty("signatureTitle" as any, e.target.value);
                                                  updateTemplateProperty("signatoryLabel" as any, e.target.value);
                                                }}
                                                placeholder="Authorized Signatory"
                                                className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10.5px] text-foreground focus:border-indigo-500"
                                              />
                                            </div>
                                          </div>
                                        </div>

                                        {/* ══ STAMP + ALIGNMENT ══ */}
                                        <div className="space-y-2.5 p-3.5 bg-muted/20 border border-border/70 rounded-2xl">
                                          <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                            <Stamp className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                            {t("Company Stamp", "Company Stamp")}
                                          </h4>
                                          <div className="flex items-start gap-3">
                                            <div className="space-y-1.5 flex-1">
                                              <label className="text-[9.5px] font-semibold text-muted-foreground block">Stamp image</label>
                                              <input ref={thermalStampInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleThermalImageUpload(e, "stampUrl")} />
                                              <div className="h-14 rounded-xl border border-dashed border-border bg-white flex items-center justify-center overflow-hidden">
                                                {activeTemplate.stampUrl ? (
                                                  <img src={activeTemplate.stampUrl} alt="Stamp preview" className="max-h-full max-w-full object-contain" />
                                                ) : (
                                                  <button onClick={() => thermalStampInputRef.current?.click()} className="text-[10px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1">
                                                    <Upload className="h-3 w-3" /> {t("Upload Stamp", "Upload Stamp")}
                                                  </button>
                                                )}
                                              </div>
                                              {activeTemplate.stampUrl && (
                                                <button onClick={() => updateTemplateProperty("stampUrl" as any, "")} className="text-[10px] font-semibold text-destructive hover:underline cursor-pointer">{t("Remove Stamp", "Remove Stamp")}</button>
                                              )}
                                            </div>
                                            <div className="space-y-1.5 shrink-0">
                                              <label className="text-[9.5px] font-semibold text-muted-foreground block">Alignment</label>
                                              <div className="flex rounded-lg border border-input p-0.5 bg-background">
                                                {(["left", "center", "right"] as const).map((a) => (
                                                  <button
                                                    key={a}
                                                    type="button"
                                                    onClick={() => updateTemplateProperty("stampAlign" as any, a)}
                                                    className={`px-2 py-1 text-[10.5px] font-bold rounded-md cursor-pointer ${((activeTemplate as any).stampAlign || "left") === a ? "bg-indigo-600 text-white" : "text-muted-foreground hover:text-foreground"}`}
                                                  >
                                                    {a === "left" ? "L" : a === "center" ? "C" : "R"}
                                                  </button>
                                                ))}
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        {/* ══ FOOTER BRANDING ══ */}
                                        <div className="space-y-2.5 p-3.5 bg-muted/20 border border-border/70 rounded-2xl">
                                          <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                            <HeartHandshake className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                            {t("Footer Branding & Declarations", "Footer Branding & Declarations")}
                                          </h4>
                                          <div className="space-y-2">
                                            <div className="space-y-1">
                                              <div className="flex items-center justify-between">
                                                <label className="text-[9.5px] font-semibold text-muted-foreground block">Statutory GST Declaration</label>
                                                <label className="flex items-center gap-1 text-[9.5px] text-muted-foreground cursor-pointer">
                                                  <input
                                                    type="checkbox"
                                                    checked={activeTemplate.showDeclaration !== false}
                                                    onChange={(e) => updateTemplateProperty("showDeclaration", e.target.checked)}
                                                    className="h-3 w-3 rounded text-indigo-600"
                                                  />
                                                  Show
                                                </label>
                                              </div>
                                              <textarea
                                                rows={2}
                                                value={activeTemplate.declarationText || "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct."}
                                                onChange={(e) => updateTemplateProperty("declarationText", e.target.value)}
                                                placeholder="We declare that this invoice shows the actual price..."
                                                className="w-full rounded-lg border border-input bg-background px-2 py-1 text-[10.5px] text-foreground focus:border-indigo-500"
                                              />
                                            </div>
                                            <div className="space-y-1">
                                              <div className="flex items-center justify-between">
                                                <label className="text-[9.5px] font-semibold text-muted-foreground block">Thank You Note</label>
                                                <label className="flex items-center gap-1 text-[9.5px] text-muted-foreground cursor-pointer">
                                                  <input
                                                    type="checkbox"
                                                    checked={activeTemplate.fields?.showThankYou !== false}
                                                    onChange={(e) => updateTemplateProperty("fields", { ...activeTemplate.fields, showThankYou: e.target.checked })}
                                                    className="h-3 w-3 rounded text-indigo-600"
                                                  />
                                                  Show
                                                </label>
                                              </div>
                                              <input
                                                type="text"
                                                value={activeTemplate.thankYouNote || activeTemplate.footerText || ""}
                                                onChange={(e) => {
                                                  updateTemplateProperty("thankYouNote", e.target.value);
                                                  updateTemplateProperty("footerText", e.target.value);
                                                }}
                                                placeholder="Thank you for your business!"
                                                className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10.5px] text-foreground focus:border-indigo-500"
                                              />
                                            </div>
                                          </div>
                                        </div>

                                        {/* ══ WATERMARK CONTROLS & CULTURAL PRESETS ══ */}
                                        <div className="space-y-2.5 p-3.5 bg-muted/20 border border-border/70 rounded-2xl">
                                          <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                              <EyeOff className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                              {t("Background Watermark", "Background Watermark")}
                                            </h4>
                                            <input
                                              type="checkbox"
                                              checked={!!activeTemplate.showWatermark}
                                              onChange={(e) => updateTemplateProperty("showWatermark", e.target.checked)}
                                              className="h-4 w-4 rounded border-input text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            />
                                          </div>

                                          {/* Cultural Presets Bar */}
                                          <div>
                                            <label className="text-[9.5px] font-semibold text-muted-foreground block mb-1">Quick Cultural &amp; Business Presets</label>
                                            <div className="flex flex-wrap gap-1">
                                              {([
                                                { label: "None", value: "" },
                                                { label: "॥ श्री गणेशाय नमः ॥", value: "॥ श्री गणेशाय नमः ॥" },
                                                { label: "॥ ॐ अर्हं नमः ॥", value: "॥ ॐ अर्हं नमः ॥" },
                                                { label: "॥ शुभ लाभ ॥", value: "॥ शुभ लाभ ॥" },
                                                { label: "LUXURY GOLD", value: "LUXURY GOLD" },
                                                { label: "AUTHENTIC TAX INVOICE", value: "AUTHENTIC TAX INVOICE" },
                                              ] as const).map((preset) => (
                                                <button
                                                  key={preset.label}
                                                  type="button"
                                                  onClick={() => {
                                                    updateTemplateProperty("watermarkText", preset.value);
                                                    updateTemplateProperty("watermarkType", "text");
                                                    updateTemplateProperty("showWatermark", preset.value !== "");
                                                  }}
                                                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 cursor-pointer"
                                                >
                                                  {preset.label}
                                                </button>
                                              ))}
                                            </div>
                                          </div>

                                          {/* Watermark Type Selector */}
                                          <div className="flex gap-2 items-center">
                                            <label className="text-[9.5px] font-semibold text-muted-foreground">Type:</label>
                                            <div className="flex rounded-lg border border-input p-0.5 bg-background">
                                              <button
                                                type="button"
                                                onClick={() => updateTemplateProperty("watermarkType", "text")}
                                                className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${activeTemplate.watermarkType !== "image" ? "bg-indigo-600 text-white" : "text-muted-foreground hover:text-foreground"}`}
                                              >
                                                Text
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => updateTemplateProperty("watermarkType", "image")}
                                                className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${activeTemplate.watermarkType === "image" ? "bg-indigo-600 text-white" : "text-muted-foreground hover:text-foreground"}`}
                                              >
                                                Image
                                              </button>
                                            </div>
                                          </div>

                                          {activeTemplate.watermarkType === "image" ? (
                                            <div className="space-y-1.5">
                                              <label className="text-[9.5px] font-semibold text-muted-foreground block">Watermark Image</label>
                                              <input ref={watermarkImageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleThermalImageUpload(e, "watermarkImage")} />
                                              <div className="flex gap-2 items-center">
                                                <button
                                                  type="button"
                                                  onClick={() => watermarkImageInputRef.current?.click()}
                                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border hover:bg-muted text-[10.5px] font-semibold text-foreground cursor-pointer"
                                                >
                                                  <Upload className="h-3 w-3" /> {activeTemplate.watermarkImage ? "Replace Image" : "Upload Watermark Image"}
                                                </button>
                                                {activeTemplate.watermarkImage && (
                                                  <button
                                                    type="button"
                                                    onClick={() => updateTemplateProperty("watermarkImage", "")}
                                                    className="px-2 py-1 rounded-lg border border-border text-destructive text-[10px] font-semibold hover:bg-destructive/10 cursor-pointer"
                                                  >
                                                    Remove
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="space-y-0.5">
                                              <label className="text-[9.5px] font-semibold text-muted-foreground block">Custom Watermark Text</label>
                                              <input
                                                type="text"
                                                value={activeTemplate.watermarkText || ""}
                                                onChange={(e) => {
                                                  updateTemplateProperty("watermarkText", e.target.value);
                                                  if (e.target.value.trim()) updateTemplateProperty("showWatermark", true);
                                                }}
                                                placeholder="e.g. OFFICIAL / DUPLICATE"
                                                className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10.5px] text-foreground focus:border-indigo-500"
                                              />
                                            </div>
                                          )}

                                          <div className="space-y-0.5">
                                            <label className="text-[9.5px] font-semibold text-muted-foreground block">Opacity ({activeTemplate.watermarkOpacity || 15}%) — Range 5% to 50%</label>
                                            <input
                                              type="range"
                                              min="5"
                                              max="50"
                                              value={activeTemplate.watermarkOpacity || 15}
                                              onChange={(e) => {
                                                updateTemplateProperty("watermarkOpacity", Number(e.target.value));
                                                updateTemplateProperty("showWatermark", true);
                                              }}
                                              className="w-full cursor-pointer accent-indigo-600 mt-1"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    ) : null}

                                    {activeEditorTab === "settings" && isThermalTemplate ? (
                                      <div className="space-y-5">
                                        {/* Organization Master Default */}
                                        <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-200 dark:border-indigo-900 space-y-2">
                                          <div className="flex items-center justify-between">
                                            <div>
                                              <div className="text-xs font-bold text-foreground">Organization Master Default</div>
                                              <div className="text-[11px] text-muted-foreground">Use this template for all POS terminals and cashiers across the organization</div>
                                            </div>
                                            <input
                                              type="checkbox"
                                              checked={!!activeTemplate.isDefault}
                                              onChange={(e) => updateTemplateProperty("isDefault", e.target.checked)}
                                              className="h-4 w-4 rounded border-input text-indigo-600 focus:ring-indigo-500"
                                            />
                                          </div>
                                        </div>

                                        {/* Hardware Paper Roll & Cutter Margins */}
                                        <div className="space-y-3 p-4 bg-muted/20 border border-border/70 rounded-2xl">
                                          <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                            <Printer className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                            Hardware Paper Roll & Cutter Margins
                                          </h3>

                                          <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                              <label className="text-[10px] font-semibold text-foreground">Paper Roll Width</label>
                                              <select
                                                value={activeTemplate.paperSize || "80mm"}
                                                onChange={(e) => updateTemplateProperty("paperSize", e.target.value)}
                                                className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-indigo-500 font-semibold"
                                              >
                                                <option value="80mm">80mm (Standard 3-Inch POS Roll)</option>
                                                <option value="58mm">58mm (Mini 2-Inch Compact Roll)</option>
                                              </select>
                                            </div>
                                            <div className="space-y-1">
                                              <label className="text-[10px] font-semibold text-foreground">Thermal Contrast / Darkness</label>
                                              <select
                                                value={activeTemplate.thermalContrast || "ultra-dark"}
                                                onChange={(e) => updateTemplateProperty("thermalContrast" as any, e.target.value)}
                                                className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-indigo-500 font-semibold"
                                              >
                                                <option value="ultra-dark">🔥 Ultra-Dark (Pure Black #000 + 900 Weight)</option>
                                                <option value="crisp-mono">⚡ Crisp Monospace (High Density)</option>
                                                <option value="compact">📄 Compact Retail Density</option>
                                                <option value="standard">Standard Balance</option>
                                              </select>
                                            </div>
                                          </div>

                                          <div className="pt-2 border-t border-border/50 space-y-2">
                                            <label className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-card cursor-pointer hover:bg-muted/40">
                                              <input
                                                type="checkbox"
                                                checked={activeTemplate.feedAfterPrint !== false}
                                                onChange={(e) => updateTemplateProperty("feedAfterPrint" as any, e.target.checked)}
                                                className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <div className="text-xs">
                                                <span className="font-semibold text-foreground block">20mm Safe Feed & Cutter Margin</span>
                                                <span className="text-[10px] text-muted-foreground">Appends feed lines so auto-cutters do not chop off the thank you note</span>
                                              </div>
                                            </label>

                                            <label className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-card cursor-pointer hover:bg-muted/40">
                                              <input
                                                type="checkbox"
                                                checked={activeTemplate.autoCutPaper !== false}
                                                onChange={(e) => updateTemplateProperty("autoCutPaper" as any, e.target.checked)}
                                                className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <div className="text-xs">
                                                <span className="font-semibold text-foreground block">Send ESC/POS Auto-Cut Command</span>
                                                <span className="text-[10px] text-muted-foreground">Triggers automatic guillotine cut on supported thermal hardware</span>
                                              </div>
                                            </label>
                                          </div>
                                        </div>

                                        {/* Receipt Bottom Barcode */}
                                        <div className="space-y-3 p-4 bg-muted/20 border border-border/70 rounded-2xl">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <input
                                                type="checkbox"
                                                id="thermal-barcode-toggle"
                                                checked={activeTemplate.fields.showBarcode !== false}
                                                onChange={() => toggleElementField("showBarcode")}
                                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <label htmlFor="thermal-barcode-toggle" className="text-xs font-bold text-foreground cursor-pointer flex items-center gap-1.5">
                                                <Barcode className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                                Receipt Bottom Return / Lookup Barcode
                                              </label>
                                            </div>
                                          </div>

                                          {activeTemplate.fields.showBarcode !== false && (
                                            <div className="grid grid-cols-2 gap-3 pt-1">
                                              <div className="space-y-1">
                                                <label className="text-[10px] font-semibold text-foreground">Barcode Symbology</label>
                                                <select
                                                  value={activeTemplate.barcodeSymbology || "Code-128"}
                                                  onChange={(e) => updateTemplateProperty("barcodeSymbology", e.target.value as any)}
                                                  className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-indigo-500"
                                                >
                                                  <option value="Code-128">Code 128 (Universal POS Standard)</option>
                                                  <option value="EAN-13">EAN-13 (GS1 Retail Standard)</option>
                                                  <option value="Code-39">Code 39 (Alphanumeric)</option>
                                                  <option value="QR">QR Code (2D Lookup)</option>
                                                </select>
                                              </div>

                                              <div className="space-y-1">
                                                <div className="flex justify-between text-[10px] font-semibold text-foreground">
                                                  <span>Barcode Height:</span>
                                                  <span className="font-mono text-indigo-600">{activeTemplate.barcodeHeight || 28}px</span>
                                                </div>
                                                <input
                                                  type="range"
                                                  min="18"
                                                  max="60"
                                                  value={activeTemplate.barcodeHeight || 28}
                                                  onChange={(e) => updateTemplateProperty("barcodeHeight", Number(e.target.value))}
                                                  className="w-full cursor-pointer accent-indigo-600 mt-1"
                                                />
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ) : activeEditorTab === "settings" ? (
                                      <div className="space-y-4">
                                        {/* Settings Sub-Tab Navigation */}
                                        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-xl border border-border/60 overflow-x-auto">
                                          {[
                                            { id: "numbering", label: "🔢 Numbering & B2B/B2C" },
                                            { id: "columns", label: "📱 Columns & IMEI" },
                                            { id: "bank_qr", label: "🏦 Bank & UPI QR" },
                                            { id: "tax_terms", label: "📜 Terms & Legal" },
                                            { id: "credit_debit", label: "🧾 Credit / Debit Note" },
                                            { id: "tax_finance", label: "🧾 Tax & GST" },
                                            { id: "barcode", label: "🏷️ Barcode" },
                                          ].map((tab) => (
                                            <button
                                              key={tab.id}
                                              type="button"
                                              onClick={() => setSettingsActiveSubTab(tab.id as any)}
                                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${settingsActiveSubTab === tab.id
                                                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                                                : "text-muted-foreground hover:text-foreground"
                                                }`}
                                            >
                                              {tab.label}
                                            </button>
                                          ))}
                                        </div>

                                        {/* Sub-Tab 1: Numbering & B2B/B2C */}
                                        {settingsActiveSubTab === "numbering" && (
                                          <div className="space-y-3 animate-in fade-in">
                                            {/* B2B vs B2C Separate Series Switch */}
                                            <div className="p-3.5 bg-white dark:bg-slate-800/80 rounded-xl border border-purple-200 dark:border-purple-900/50 space-y-3">
                                              <div className="flex items-center justify-between">
                                                <div>
                                                  <div className="flex items-center gap-2">
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-700">🏢 B2B / 🛒 B2C Switch</span>
                                                    <h4 className="text-xs font-bold text-foreground">Separate B2B & B2C Invoice Series</h4>
                                                  </div>
                                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                                    Assign separate prefixes for GST registered corporate customers vs retail walk-ins.
                                                  </p>
                                                </div>
                                                <input
                                                  type="checkbox"
                                                  checked={Boolean(liveInvoiceSettings.separateB2BSequenceEnabled)}
                                                  onChange={(e) => {
                                                    const updated = { ...liveInvoiceSettings, separateB2BSequenceEnabled: e.target.checked };
                                                    setLiveInvoiceSettings(updated);
                                                    saveStoredInvoiceSettings(updated, tenant?.id);
                                                  }}
                                                  className="size-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                                                />
                                              </div>

                                              {liveInvoiceSettings.separateB2BSequenceEnabled && (
                                                <div className="pt-2 border-t border-purple-100 dark:border-purple-900/30 space-y-3">
                                                  <div className="p-2.5 bg-purple-50/60 dark:bg-purple-950/20 rounded-lg space-y-2">
                                                    <span className="text-[11px] font-bold text-purple-800 dark:text-purple-300 block">🏢 B2B Tax Invoice Prefix</span>
                                                    <div className="grid grid-cols-2 gap-2">
                                                      <div>
                                                        <label className="text-[10px] text-muted-foreground block mb-0.5">Prefix</label>
                                                        <input
                                                          type="text"
                                                          value={liveInvoiceSettings.b2bPrefix || "B2B-"}
                                                          onChange={(e) => {
                                                            const updated = { ...liveInvoiceSettings, b2bPrefix: e.target.value.toUpperCase() };
                                                            setLiveInvoiceSettings(updated);
                                                            saveStoredInvoiceSettings(updated, tenant?.id);
                                                          }}
                                                          className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-mono font-bold"
                                                          placeholder="B2B-"
                                                        />
                                                      </div>
                                                      <div>
                                                        <label className="text-[10px] text-muted-foreground block mb-0.5">Next Number</label>
                                                        <input
                                                          type="number"
                                                          min="1"
                                                          value={liveInvoiceSettings.b2bSequenceNumber || 1}
                                                          onChange={(e) => {
                                                            const updated = { ...liveInvoiceSettings, b2bSequenceNumber: Math.max(1, parseInt(e.target.value) || 1) };
                                                            setLiveInvoiceSettings(updated);
                                                            saveStoredInvoiceSettings(updated, tenant?.id);
                                                          }}
                                                          className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-bold"
                                                        />
                                                      </div>
                                                    </div>
                                                  </div>

                                                  <div className="p-2.5 bg-blue-50/60 dark:bg-blue-950/20 rounded-lg space-y-2">
                                                    <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300 block">📦 Wholesale Invoice Prefix</span>
                                                    <div className="grid grid-cols-2 gap-2">
                                                      <div>
                                                        <label className="text-[10px] text-muted-foreground block mb-0.5">Prefix</label>
                                                        <input
                                                          type="text"
                                                          value={liveInvoiceSettings.wholesalePrefix || "WS-"}
                                                          onChange={(e) => {
                                                            const updated = { ...liveInvoiceSettings, wholesalePrefix: e.target.value.toUpperCase() };
                                                            setLiveInvoiceSettings(updated);
                                                            saveStoredInvoiceSettings(updated, tenant?.id);
                                                          }}
                                                          className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-mono font-bold"
                                                          placeholder="WS-"
                                                        />
                                                      </div>
                                                      <div>
                                                        <label className="text-[10px] text-muted-foreground block mb-0.5">Next Number</label>
                                                        <input
                                                          type="number"
                                                          min="1"
                                                          value={liveInvoiceSettings.wholesaleSequenceNumber || 1}
                                                          onChange={(e) => {
                                                            const updated = { ...liveInvoiceSettings, wholesaleSequenceNumber: Math.max(1, parseInt(e.target.value) || 1) };
                                                            setLiveInvoiceSettings(updated);
                                                            saveStoredInvoiceSettings(updated, tenant?.id);
                                                          }}
                                                          className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-bold"
                                                        />
                                                      </div>
                                                    </div>
                                                  </div>

                                                  <div className="p-2.5 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-lg space-y-2">
                                                    <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 block">🛒 B2C Consumer Retail Prefix</span>
                                                    <div className="grid grid-cols-2 gap-2">
                                                      <div>
                                                        <label className="text-[10px] text-muted-foreground block mb-0.5">Prefix</label>
                                                        <input
                                                          type="text"
                                                          value={liveInvoiceSettings.b2cPrefix || "RET-"}
                                                          onChange={(e) => {
                                                            const updated = { ...liveInvoiceSettings, b2cPrefix: e.target.value.toUpperCase() };
                                                            setLiveInvoiceSettings(updated);
                                                            saveStoredInvoiceSettings(updated, tenant?.id);
                                                          }}
                                                          className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-mono font-bold"
                                                          placeholder="RET-"
                                                        />
                                                      </div>
                                                      <div>
                                                        <label className="text-[10px] text-muted-foreground block mb-0.5">Next Number</label>
                                                        <input
                                                          type="number"
                                                          min="1"
                                                          value={liveInvoiceSettings.b2cSequenceNumber || 1}
                                                          onChange={(e) => {
                                                            const updated = { ...liveInvoiceSettings, b2cSequenceNumber: Math.max(1, parseInt(e.target.value) || 1) };
                                                            setLiveInvoiceSettings(updated);
                                                            saveStoredInvoiceSettings(updated, tenant?.id);
                                                          }}
                                                          className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-bold"
                                                        />
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                              )}
                                            </div>

                                            {/* Standard Invoice Numbering Series */}
                                            <div className="p-3.5 bg-white dark:bg-slate-800/80 rounded-xl border border-border/70 space-y-2.5">
                                              <h4 className="text-xs font-bold text-foreground">Standard Sales Invoice Prefix & Sequence</h4>
                                              <div className="grid grid-cols-3 gap-2">
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Prefix</label>
                                                  <input
                                                    type="text"
                                                    value={liveInvoiceSettings.prefix !== undefined ? liveInvoiceSettings.prefix : "INV-"}
                                                    onChange={(e) => {
                                                      const updated = { ...liveInvoiceSettings, prefix: e.target.value.toUpperCase() };
                                                      setLiveInvoiceSettings(updated);
                                                      saveStoredInvoiceSettings(updated, tenant?.id);
                                                    }}
                                                    className="w-full h-8 px-2 bg-background border rounded-lg text-xs font-mono font-bold"
                                                    placeholder="INV-"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Next Sequence</label>
                                                  <input
                                                    type="number"
                                                    min="1"
                                                    value={liveInvoiceSettings.sequenceNumber ?? 1}
                                                    onChange={(e) => {
                                                      const updated = { ...liveInvoiceSettings, sequenceNumber: Math.max(1, parseInt(e.target.value) || 1) };
                                                      setLiveInvoiceSettings(updated);
                                                      saveStoredInvoiceSettings(updated, tenant?.id);
                                                    }}
                                                    className="w-full h-8 px-2 bg-background border rounded-lg text-xs font-bold"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Padding</label>
                                                  <select
                                                    value={liveInvoiceSettings.padding ?? 4}
                                                    onChange={(e) => {
                                                      const updated = { ...liveInvoiceSettings, padding: parseInt(e.target.value, 10) || 4 };
                                                      setLiveInvoiceSettings(updated);
                                                      saveStoredInvoiceSettings(updated, tenant?.id);
                                                    }}
                                                    className="w-full h-8 px-2 bg-background border rounded-lg text-xs font-semibold"
                                                  >
                                                    <option value={4}>4 Digits (0001)</option>
                                                    <option value={5}>5 Digits (00001)</option>
                                                    <option value={6}>6 Digits (000001)</option>
                                                    <option value={3}>3 Digits (001)</option>
                                                  </select>
                                                </div>
                                              </div>
                                              <div className="p-2 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-lg border border-indigo-100 dark:border-indigo-900/50 text-[11px] flex items-center justify-between">
                                                <span className="text-muted-foreground">Next Generated:</span>
                                                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                  {(liveInvoiceSettings.prefix || "INV-")}{String(liveInvoiceSettings.sequenceNumber || 1).padStart(liveInvoiceSettings.padding ?? 4, "0")}
                                                </span>
                                              </div>
                                            </div>

                                            {/* Additional Numbering Series — Quotation / Proforma / Estimate / Receipt */}
                                            <div className="p-3.5 bg-white dark:bg-slate-800/80 rounded-xl border border-teal-200 dark:border-teal-900/50 space-y-2.5">
                                              <h4 className="text-xs font-bold text-foreground">📄 Quotation Prefix & Sequence (QT-)</h4>
                                              <div className="grid grid-cols-3 gap-2">
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Prefix</label>
                                                  <input type="text" value={liveInvoiceSettings.quotationPrefix || "QT-"}
                                                    onChange={(e) => { const updated = { ...liveInvoiceSettings, quotationPrefix: e.target.value.toUpperCase() }; setLiveInvoiceSettings(updated); saveStoredInvoiceSettings(updated, tenant?.id); }}
                                                    className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-mono font-bold" placeholder="QT-" />
                                                </div>
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Next Sequence</label>
                                                  <input type="number" min="1" value={liveInvoiceSettings.quotationSequenceNumber || 1}
                                                    onChange={(e) => { const updated = { ...liveInvoiceSettings, quotationSequenceNumber: Math.max(1, parseInt(e.target.value) || 1) }; setLiveInvoiceSettings(updated); saveStoredInvoiceSettings(updated, tenant?.id); }}
                                                    className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-bold" />
                                                </div>
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Padding</label>
                                                  <select value={liveInvoiceSettings.quotationPadding ?? 4}
                                                    onChange={(e) => { const updated = { ...liveInvoiceSettings, quotationPadding: parseInt(e.target.value, 10) || 4 }; setLiveInvoiceSettings(updated); saveStoredInvoiceSettings(updated, tenant?.id); }}
                                                    className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-semibold">
                                                    <option value={3}>3 Digits</option><option value={4}>4 Digits</option><option value={5}>5 Digits</option><option value={6}>6 Digits</option>
                                                  </select>
                                                </div>
                                              </div>
                                              <div className="p-2 bg-teal-50/50 dark:bg-teal-950/30 rounded-lg border border-teal-100 dark:border-teal-900/50 text-[11px] flex items-center justify-between">
                                                <span className="text-muted-foreground">Next Quotation:</span>
                                                <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                                                  {(liveInvoiceSettings.quotationPrefix || "QT-")}{String(liveInvoiceSettings.quotationSequenceNumber || 1).padStart(liveInvoiceSettings.quotationPadding ?? 4, "0")}
                                                </span>
                                              </div>
                                            </div>

                                            <div className="p-3.5 bg-white dark:bg-slate-800/80 rounded-xl border border-sky-200 dark:border-sky-900/50 space-y-2.5">
                                              <h4 className="text-xs font-bold text-foreground">📑 Proforma Prefix & Sequence (PI-)</h4>
                                              <div className="grid grid-cols-3 gap-2">
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Prefix</label>
                                                  <input type="text" value={liveInvoiceSettings.proformaPrefix || "PI-"}
                                                    onChange={(e) => { const updated = { ...liveInvoiceSettings, proformaPrefix: e.target.value.toUpperCase() }; setLiveInvoiceSettings(updated); saveStoredInvoiceSettings(updated, tenant?.id); }}
                                                    className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-mono font-bold" placeholder="PI-" />
                                                </div>
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Next Sequence</label>
                                                  <input type="number" min="1" value={liveInvoiceSettings.proformaSequenceNumber || 1}
                                                    onChange={(e) => { const updated = { ...liveInvoiceSettings, proformaSequenceNumber: Math.max(1, parseInt(e.target.value) || 1) }; setLiveInvoiceSettings(updated); saveStoredInvoiceSettings(updated, tenant?.id); }}
                                                    className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-bold" />
                                                </div>
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Padding</label>
                                                  <select value={liveInvoiceSettings.proformaPadding ?? 4}
                                                    onChange={(e) => { const updated = { ...liveInvoiceSettings, proformaPadding: parseInt(e.target.value, 10) || 4 }; setLiveInvoiceSettings(updated); saveStoredInvoiceSettings(updated, tenant?.id); }}
                                                    className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-semibold">
                                                    <option value={3}>3 Digits</option><option value={4}>4 Digits</option><option value={5}>5 Digits</option><option value={6}>6 Digits</option>
                                                  </select>
                                                </div>
                                              </div>
                                              <div className="p-2 bg-sky-50/50 dark:bg-sky-950/30 rounded-lg border border-sky-100 dark:border-sky-900/50 text-[11px] flex items-center justify-between">
                                                <span className="text-muted-foreground">Next Proforma:</span>
                                                <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                                                  {(liveInvoiceSettings.proformaPrefix || "PI-")}{String(liveInvoiceSettings.proformaSequenceNumber || 1).padStart(liveInvoiceSettings.proformaPadding ?? 4, "0")}
                                                </span>
                                              </div>
                                            </div>

                                            <div className="p-3.5 bg-white dark:bg-slate-800/80 rounded-xl border border-violet-200 dark:border-violet-900/50 space-y-2.5">
                                              <h4 className="text-xs font-bold text-foreground">📝 Estimate Prefix & Sequence (EST-)</h4>
                                              <div className="grid grid-cols-3 gap-2">
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Prefix</label>
                                                  <input type="text" value={liveInvoiceSettings.estimatePrefix || "EST-"}
                                                    onChange={(e) => { const updated = { ...liveInvoiceSettings, estimatePrefix: e.target.value.toUpperCase() }; setLiveInvoiceSettings(updated); saveStoredInvoiceSettings(updated, tenant?.id); }}
                                                    className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-mono font-bold" placeholder="EST-" />
                                                </div>
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Next Sequence</label>
                                                  <input type="number" min="1" value={liveInvoiceSettings.estimateSequenceNumber || 1}
                                                    onChange={(e) => { const updated = { ...liveInvoiceSettings, estimateSequenceNumber: Math.max(1, parseInt(e.target.value) || 1) }; setLiveInvoiceSettings(updated); saveStoredInvoiceSettings(updated, tenant?.id); }}
                                                    className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-bold" />
                                                </div>
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Padding</label>
                                                  <select value={liveInvoiceSettings.estimatePadding ?? 4}
                                                    onChange={(e) => { const updated = { ...liveInvoiceSettings, estimatePadding: parseInt(e.target.value, 10) || 4 }; setLiveInvoiceSettings(updated); saveStoredInvoiceSettings(updated, tenant?.id); }}
                                                    className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-semibold">
                                                    <option value={3}>3 Digits</option><option value={4}>4 Digits</option><option value={5}>5 Digits</option><option value={6}>6 Digits</option>
                                                  </select>
                                                </div>
                                              </div>
                                              <div className="p-2 bg-violet-50/50 dark:bg-violet-950/30 rounded-lg border border-violet-100 dark:border-violet-900/50 text-[11px] flex items-center justify-between">
                                                <span className="text-muted-foreground">Next Estimate:</span>
                                                <span className="font-mono font-bold text-violet-600 dark:text-violet-400">
                                                  {(liveInvoiceSettings.estimatePrefix || "EST-")}{String(liveInvoiceSettings.estimateSequenceNumber || 1).padStart(liveInvoiceSettings.estimatePadding ?? 4, "0")}
                                                </span>
                                              </div>
                                            </div>

                                            <div className="p-3.5 bg-white dark:bg-slate-800/80 rounded-xl border border-emerald-200 dark:border-emerald-900/50 space-y-2.5">
                                              <h4 className="text-xs font-bold text-foreground">🧾 Thermal / Counter Receipt Prefix & Sequence (REC-)</h4>
                                              <div className="grid grid-cols-3 gap-2">
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Prefix</label>
                                                  <input type="text" value={liveInvoiceSettings.receiptPrefix || "REC-"}
                                                    onChange={(e) => { const updated = { ...liveInvoiceSettings, receiptPrefix: e.target.value.toUpperCase() }; setLiveInvoiceSettings(updated); saveStoredInvoiceSettings(updated, tenant?.id); }}
                                                    className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-mono font-bold" placeholder="REC-" />
                                                </div>
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Next Sequence</label>
                                                  <input type="number" min="1" value={liveInvoiceSettings.receiptSequenceNumber || 1}
                                                    onChange={(e) => { const updated = { ...liveInvoiceSettings, receiptSequenceNumber: Math.max(1, parseInt(e.target.value) || 1) }; setLiveInvoiceSettings(updated); saveStoredInvoiceSettings(updated, tenant?.id); }}
                                                    className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-bold" />
                                                </div>
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Padding</label>
                                                  <select value={liveInvoiceSettings.receiptPadding ?? 5}
                                                    onChange={(e) => { const updated = { ...liveInvoiceSettings, receiptPadding: parseInt(e.target.value, 10) || 5 }; setLiveInvoiceSettings(updated); saveStoredInvoiceSettings(updated, tenant?.id); }}
                                                    className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-semibold">
                                                    <option value={3}>3 Digits</option><option value={4}>4 Digits</option><option value={5}>5 Digits</option><option value={6}>6 Digits</option>
                                                  </select>
                                                </div>
                                              </div>
                                              <div className="p-2 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-lg border border-emerald-100 dark:border-emerald-900/50 text-[11px] flex items-center justify-between">
                                                <span className="text-muted-foreground">Next Receipt:</span>
                                                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                  {(liveInvoiceSettings.receiptPrefix || "REC-")}{String(liveInvoiceSettings.receiptSequenceNumber || 1).padStart(liveInvoiceSettings.receiptPadding ?? 5, "0")}
                                                </span>
                                              </div>
                                            </div>

                                            <div className="p-3.5 bg-white dark:bg-slate-800/80 rounded-xl border border-teal-200 dark:border-teal-900/50 space-y-2.5">
                                              <h4 className="text-xs font-bold text-foreground">📦 Delivery Challan Prefix &amp; Sequence (DC-)</h4>
                                              <div className="grid grid-cols-3 gap-2">
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Prefix</label>
                                                  <input type="text" value={liveInvoiceSettings.challanPrefix || "DC-"}
                                                    onChange={(e) => { const updated = { ...liveInvoiceSettings, challanPrefix: e.target.value.toUpperCase() }; setLiveInvoiceSettings(updated); saveStoredInvoiceSettings(updated, tenant?.id); }}
                                                    className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-mono font-bold" placeholder="DC-" />
                                                </div>
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Next Sequence</label>
                                                  <input type="number" min="1" value={liveInvoiceSettings.challanSequenceNumber || 1}
                                                    onChange={(e) => { const updated = { ...liveInvoiceSettings, challanSequenceNumber: Math.max(1, parseInt(e.target.value) || 1) }; setLiveInvoiceSettings(updated); saveStoredInvoiceSettings(updated, tenant?.id); }}
                                                    className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-bold" />
                                                </div>
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Padding</label>
                                                  <select value={liveInvoiceSettings.challanPadding ?? 4}
                                                    onChange={(e) => { const updated = { ...liveInvoiceSettings, challanPadding: parseInt(e.target.value, 10) || 4 }; setLiveInvoiceSettings(updated); saveStoredInvoiceSettings(updated, tenant?.id); }}
                                                    className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-semibold">
                                                    <option value={3}>3 Digits</option><option value={4}>4 Digits</option><option value={5}>5 Digits</option><option value={6}>6 Digits</option>
                                                  </select>
                                                </div>
                                              </div>
                                              <div className="p-2 bg-teal-50/50 dark:bg-teal-950/30 rounded-lg border border-teal-100 dark:border-teal-900/50 text-[11px] flex items-center justify-between">
                                                <span className="text-muted-foreground">Next Challan:</span>
                                                <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                                                  {(liveInvoiceSettings.challanPrefix || "DC-")}{String(liveInvoiceSettings.challanSequenceNumber || 1).padStart(liveInvoiceSettings.challanPadding ?? 4, "0")}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        {/* Sub-Tab 2: Columns & IMEI */}
                                        {settingsActiveSubTab === "columns" && (
                                          <div className="space-y-2.5 animate-in fade-in">
                                            {/* IMEI / Serial No Highlighted Toggle */}
                                            <label className="flex items-center justify-between p-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/30 cursor-pointer hover:bg-indigo-50 transition-colors">
                                              <div className="flex items-center gap-2.5">
                                                <span className="text-lg">📱</span>
                                                <div>
                                                  <span className="text-xs font-bold text-foreground block">Serial / IMEI No. Column</span>
                                                  <span className="text-[10px] text-muted-foreground">Print device serial, IMEI & MAC address rows</span>
                                                </div>
                                              </div>
                                              <input
                                                type="checkbox"
                                                checked={Boolean(liveInvoiceSettings.showSerialNo)}
                                                onChange={(e) => {
                                                  const updated = { ...liveInvoiceSettings, showSerialNo: e.target.checked };
                                                  setLiveInvoiceSettings(updated);
                                                  saveStoredInvoiceSettings(updated, tenant?.id);
                                                  toggleElementField("showSerialNo" as any);
                                                }}
                                                className="size-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                              />
                                            </label>

                                            {/* Item Table Columns — full control set from the old popup */}
                                            <div className="space-y-2.5 p-3.5 bg-muted/20 border border-border/70 rounded-2xl">
                                              <h4 className="text-xs font-bold text-foreground">Item Table Columns</h4>
                                              <div className="grid grid-cols-2 gap-2 text-xs">
                                                {[
                                                  { key: "showItemIndex", label: "Item Index (#)" },
                                                  { key: "showItemDescription", label: "Item Description" },
                                                  { key: "showSKU", label: "SKU / Barcode" },
                                                  { key: "showHSN", label: "HSN / SAC" },
                                                  { key: "showMRP", label: "MRP" },
                                                  { key: "showDiscount", label: "Discount" },
                                                  { key: "showTax", label: "Tax / GST Rate" },
                                                  { key: "showBatchNo", label: "Batch No." },
                                                  { key: "showExpDate", label: "Expiry Date" },
                                                  { key: "showMfgDate", label: "Mfg Date" },
                                                  { key: "showWarranty", label: "Warranty" },
                                                  { key: "showUOM", label: "Secondary UOM" },
                                                ].map((col) => (
                                                  <label
                                                    key={col.key}
                                                    className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-card cursor-pointer hover:bg-muted/40 transition-colors"
                                                  >
                                                    <span className="text-[11px] font-medium text-foreground">{col.label}</span>
                                                    <input
                                                      type="checkbox"
                                                      checked={(activeTemplate.fields as any)[col.key] !== false}
                                                      onChange={() => toggleElementField(col.key as any)}
                                                      className="size-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                    />
                                                  </label>
                                                ))}
                                              </div>
                                            </div>

                                            {/* Summary / Footer Toggles */}
                                            <div className="space-y-2.5 p-3.5 bg-muted/20 border border-border/70 rounded-2xl">
                                              <h4 className="text-xs font-bold text-foreground">Summary &amp; Footer Toggles</h4>
                                              <div className="grid grid-cols-2 gap-2 text-xs">
                                                {[
                                                  { key: "showOverallQty", label: "Overall Qty Summary" },
                                                  { key: "showSavingsBanner", label: "Savings Banner" },
                                                  { key: "showRoundOff", label: "Round Off" },
                                                  { key: "showTaxSplit", label: "Tax Breakdown (CGST/SGST/IGST)" },
                                                  { key: "showPartyBalance", label: "Party Balance" },
                                                  { key: "showLoyaltyPoints", label: "Loyalty Points" },
                                                  { key: "showPaidInFullStamp", label: "Paid-in-Full Stamp" },
                                                  { key: "showQR", label: "Payment QR" },
                                                  { key: "showGoogleReviewQR", label: "Google Review QR" },
                                                  { key: "showSignature", label: "Authorized Signatory" },
                                                  { key: "showSignatureStamp", label: "Signature & Company Stamp" },
                                                  { key: "showTerms", label: "Terms & Conditions" },
                                                  { key: "showDeclaration", label: "Statutory Declaration" },
                                                  { key: "showFooterMessage", label: "Footer Message" },
                                                ].map((col) => (
                                                  <label
                                                    key={col.key}
                                                    className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-card cursor-pointer hover:bg-muted/40 transition-colors"
                                                  >
                                                    <span className="text-[11px] font-medium text-foreground">{col.label}</span>
                                                    <input
                                                      type="checkbox"
                                                      checked={(activeTemplate.fields as any)[col.key] !== false}
                                                      onChange={() => toggleElementField(col.key as any)}
                                                      className="size-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                    />
                                                  </label>
                                                ))}
                                              </div>
                                            </div>

                                            {/* Invoice Detail Field Toggles — bound to liveInvoiceSettings */}
                                            <div className="space-y-2.5 p-3.5 bg-muted/20 border border-border/70 rounded-2xl">
                                              <h4 className="text-xs font-bold text-foreground">Invoice Detail Fields</h4>
                                              <div className="grid grid-cols-2 gap-2 text-xs">
                                                {[
                                                  { key: "showPoNumber", label: "PO Number" },
                                                  { key: "showEwayBill", label: "E-Way Bill No." },
                                                  { key: "showVehicleNumber", label: "Vehicle Number" },
                                                  { key: "showChallanNumber", label: "Challan Number" },
                                                ].map((col) => (
                                                  <label
                                                    key={col.key}
                                                    className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-card cursor-pointer hover:bg-muted/40 transition-colors"
                                                  >
                                                    <span className="text-[11px] font-medium text-foreground">{col.label}</span>
                                                    <input
                                                      type="checkbox"
                                                      checked={Boolean((liveInvoiceSettings as any)[col.key])}
                                                      onChange={(e) => {
                                                        const updated = { ...liveInvoiceSettings, [col.key]: e.target.checked } as any;
                                                        setLiveInvoiceSettings(updated);
                                                        saveStoredInvoiceSettings(updated, tenant?.id);
                                                      }}
                                                      className="size-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                    />
                                                  </label>
                                                ))}
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        {/* Sub-Tab 3: Bank & UPI QR */}
                                        {settingsActiveSubTab === "bank_qr" && (
                                          <div className="space-y-2.5 animate-in fade-in">
                                            <div className="space-y-2.5 p-3.5 bg-muted/20 border border-border/70 rounded-2xl">
                                              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                <QrCode className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                                {t("UPI Payment QR & Bank Details", "UPI Payment QR & Bank Details")}
                                              </h4>
                                              <div className="grid grid-cols-2 gap-2">
                                                <label className="flex items-center justify-between p-2 rounded-lg border border-border bg-card cursor-pointer">
                                                  <span className="text-[10.5px] font-semibold text-foreground">Print UPI QR</span>
                                                  <input
                                                    type="checkbox"
                                                    checked={activeTemplate.fields?.showQR !== false}
                                                    onChange={(e) => updateTemplateProperty("fields", { ...activeTemplate.fields, showQR: e.target.checked })}
                                                    className="h-4 w-4 rounded border-input text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                  />
                                                </label>
                                                <label className="flex items-center justify-between p-2 rounded-lg border border-border bg-card cursor-pointer">
                                                  <span className="text-[10.5px] font-semibold text-foreground">Bank Account Box</span>
                                                  <input
                                                    type="checkbox"
                                                    checked={!!activeTemplate.fields.showBankDetails}
                                                    onChange={() => toggleElementField("showBankDetails")}
                                                    className="h-4 w-4 rounded border-input text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                  />
                                                </label>
                                              </div>
                                              <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                  <label className="text-[9.5px] font-semibold text-muted-foreground block mb-0.5">Payee / Merchant Name</label>
                                                  <input
                                                    type="text"
                                                    value={activeTemplate.payeeName || ""}
                                                    onChange={(e) => updateTemplateProperty("payeeName", e.target.value)}
                                                    placeholder="Store Merchant / Firm Name"
                                                    className="w-full h-8 rounded-lg border border-input bg-background px-2.5 text-[11px] font-semibold text-foreground focus:border-indigo-500"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="text-[9.5px] font-semibold text-muted-foreground block mb-0.5">Merchant UPI ID / VPA</label>
                                                  <input
                                                    type="text"
                                                    value={activeTemplate.upiId || ""}
                                                    onChange={(e) => updateTemplateProperty("upiId", e.target.value.trim().toLowerCase())}
                                                    placeholder="e.g. 9908297963@ybl or store@okaxis"
                                                    className="w-full h-8 rounded-lg border border-input bg-background px-2.5 text-[11px] font-mono font-bold text-foreground focus:border-indigo-500"
                                                  />
                                                </div>
                                              </div>
                                              <div className="space-y-2 p-3 bg-card rounded-xl border border-border/70">
                                                <div className="flex items-center justify-between">
                                                  <span className="text-[11px] font-bold text-foreground">Structured Bank Account Details</span>
                                                  {printBankAccounts.length > 0 && (
                                                    <span className="text-[9px] text-muted-foreground">Or pick from accounts below</span>
                                                  )}
                                                </div>
                                                <div>
                                                  <label className="text-[9.5px] font-semibold text-muted-foreground block mb-0.5">{t("Insert from Configured Bank Account", "Insert from Configured Bank Account")}</label>
                                                  {printBankAccounts.length > 0 ? (
                                                    <select
                                                      onChange={(e) => {
                                                        const b = printBankAccounts.find((x) => x.id === e.target.value);
                                                        if (b) {
                                                          const bName = b.bank_name || b.name || "";
                                                          const accNo = b.account_number || "";
                                                          const ifsc = b.ifsc_code || "";
                                                          const holder = b.account_holder_name || "";
                                                          const branch = b.branch_name || "";
                                                          const parts = [
                                                            `Bank: ${bName}`,
                                                            `A/C: ${accNo}`,
                                                            `IFSC: ${ifsc}`,
                                                          ];
                                                          if (holder) parts.push(`Holder: ${holder}`);
                                                          if (branch) parts.push(`Branch: ${branch}`);
                                                          if (b.upi_id) {
                                                            parts.push(`UPI: ${b.upi_id}`);
                                                          }
                                                          updateTemplateProperties({
                                                            bankName: bName,
                                                            accountNumber: accNo,
                                                            ifscCode: ifsc,
                                                            accountHolderName: holder,
                                                            branchName: branch,
                                                            upiId: b.upi_id || activeTemplate.upiId,
                                                            bankDetails: parts.join(" | "),
                                                            fields: { ...activeTemplate.fields, showBankDetails: true },
                                                          });
                                                          toast.success(`Inserted bank details from "${b.name}"`);
                                                        }
                                                      }}
                                                      className="w-full h-8 rounded-lg border border-input bg-background px-2 text-[10.5px] font-semibold text-foreground cursor-pointer"
                                                    >
                                                      <option value="">{t("-- Choose Bank Account --", "-- Choose Bank Account --")}</option>
                                                      {printBankAccounts.map((b) => (
                                                        <option key={b.id} value={b.id}>{b.name} ({b.bank_name || "Bank"}) - ...{b.account_number?.slice(-4) || ""} {b.is_default ? "★" : ""}</option>
                                                      ))}
                                                    </select>
                                                  ) : (
                                                    <p className="text-[10px] text-muted-foreground py-0.5">{t("No bank accounts configured yet — add one under Settings → Bank Accounts.", "No bank accounts configured yet")}</p>
                                                  )}
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 pt-1">
                                                  <div>
                                                    <label className="text-[9.5px] font-semibold text-muted-foreground block mb-0.5">Bank Name</label>
                                                    <input
                                                      type="text"
                                                      value={activeTemplate.bankName || ""}
                                                      onChange={(e) => updateTemplateProperty("bankName", e.target.value)}
                                                      placeholder="e.g. HDFC Bank"
                                                      className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10.5px] text-foreground focus:border-indigo-500"
                                                    />
                                                  </div>
                                                  <div>
                                                    <label className="text-[9.5px] font-semibold text-muted-foreground block mb-0.5">Account Number</label>
                                                    <input
                                                      type="text"
                                                      value={activeTemplate.accountNumber || ""}
                                                      onChange={(e) => updateTemplateProperty("accountNumber", e.target.value)}
                                                      placeholder="5010023456789"
                                                      className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10.5px] font-mono text-foreground focus:border-indigo-500"
                                                    />
                                                  </div>
                                                  <div>
                                                    <label className="text-[9.5px] font-semibold text-muted-foreground block mb-0.5">IFSC Code</label>
                                                    <input
                                                      type="text"
                                                      value={activeTemplate.ifscCode || ""}
                                                      onChange={(e) => updateTemplateProperty("ifscCode", e.target.value.toUpperCase())}
                                                      placeholder="HDFC0000104"
                                                      className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10.5px] font-mono text-foreground focus:border-indigo-500"
                                                    />
                                                  </div>
                                                  <div>
                                                    <label className="text-[9.5px] font-semibold text-muted-foreground block mb-0.5">Branch Name</label>
                                                    <input
                                                      type="text"
                                                      value={activeTemplate.branchName || ""}
                                                      onChange={(e) => updateTemplateProperty("branchName", e.target.value)}
                                                      placeholder="Indiranagar Branch"
                                                      className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10.5px] text-foreground focus:border-indigo-500"
                                                    />
                                                  </div>
                                                  <div className="col-span-2">
                                                    <label className="text-[9.5px] font-semibold text-muted-foreground block mb-0.5">Account Holder Name</label>
                                                    <input
                                                      type="text"
                                                      value={activeTemplate.accountHolderName || ""}
                                                      onChange={(e) => updateTemplateProperty("accountHolderName", e.target.value)}
                                                      placeholder="ACME ENTERPRISES PVT LTD"
                                                      className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10.5px] text-foreground focus:border-indigo-500"
                                                    />
                                                  </div>
                                                </div>
                                              </div>
                                              <div>
                                                <label className="text-[9.5px] font-semibold text-muted-foreground block mb-0.5">{t("Org-Level Payment QR & UPI Collections", "Org-Level Payment QR & UPI Collections")}</label>
                                                <div className="space-y-2 p-2.5 bg-purple-50/40 dark:bg-purple-950/20 rounded-xl border border-purple-200 dark:border-purple-900/50">
                                                  <label className="flex items-center justify-between">
                                                    <span className="text-[10.5px] font-semibold text-foreground">Enable Payment QR on Invoices</span>
                                                    <input type="checkbox" checked={Boolean(orgPaymentQr?.enabled)}
                                                      onChange={(e) => setOrgPaymentQr({ ...orgPaymentQr, enabled: e.target.checked })}
                                                      className="h-4 w-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer" />
                                                  </label>
                                                  <div>
                                                    <label className="text-[9.5px] font-semibold text-muted-foreground block mb-0.5">Payment QR Method</label>
                                                    <div className="grid grid-cols-3 gap-1.5">
                                                      {([
                                                        { id: "dynamic_upi", label: "Dynamic UPI" },
                                                        { id: "razorpay", label: "Razorpay" },
                                                        { id: "custom_image", label: "Custom Image" },
                                                      ]).map((m) => (
                                                        <button key={m.id} type="button"
                                                          onClick={() => setOrgPaymentQr({ ...orgPaymentQr, type: m.id })}
                                                          className={`h-7 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                                                            orgPaymentQr?.type === m.id
                                                              ? "bg-purple-600 text-white border-purple-600"
                                                              : "bg-white dark:bg-slate-900 text-muted-foreground border-input hover:bg-muted/50"
                                                          }`}>
                                                          {m.label}
                                                        </button>
                                                      ))}
                                                    </div>
                                                  </div>
                                                  <div>
                                                    <label className="text-[9.5px] font-semibold text-muted-foreground block mb-0.5">UPI VPA</label>
                                                    <input type="text" value={orgPaymentQr?.vpa || ""}
                                                      onChange={(e) => setOrgPaymentQr({ ...orgPaymentQr, vpa: e.target.value.trim().toLowerCase() })}
                                                      placeholder="merchant@okaxis"
                                                      className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10.5px] font-mono font-bold text-foreground focus:border-purple-500" />
                                                  </div>
                                                  <div>
                                                    <label className="text-[9.5px] font-semibold text-muted-foreground block mb-0.5">Payee / Merchant Name</label>
                                                    <input type="text" value={orgPaymentQr?.payeeName || ""}
                                                      onChange={(e) => setOrgPaymentQr({ ...orgPaymentQr, payeeName: e.target.value })}
                                                      className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10.5px] font-semibold text-foreground focus:border-purple-500" />
                                                  </div>
                                                  <div className="grid grid-cols-3 gap-1.5">
                                                    <div>
                                                      <label className="text-[9.5px] font-semibold text-muted-foreground block mb-0.5">Bank</label>
                                                      <input type="text" value={orgPaymentQr?.bankName || ""}
                                                        onChange={(e) => setOrgPaymentQr({ ...orgPaymentQr, bankName: e.target.value })}
                                                        placeholder="HDFC"
                                                        className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10px] text-foreground focus:border-purple-500" />
                                                    </div>
                                                    <div>
                                                      <label className="text-[9.5px] font-semibold text-muted-foreground block mb-0.5">A/C No</label>
                                                      <input type="text" value={orgPaymentQr?.accountNumber || ""}
                                                        onChange={(e) => setOrgPaymentQr({ ...orgPaymentQr, accountNumber: e.target.value })}
                                                        placeholder="5010023..."
                                                        className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10px] font-mono text-foreground focus:border-purple-500" />
                                                    </div>
                                                    <div>
                                                      <label className="text-[9.5px] font-semibold text-muted-foreground block mb-0.5">IFSC</label>
                                                      <input type="text" value={orgPaymentQr?.ifsc || ""}
                                                        onChange={(e) => setOrgPaymentQr({ ...orgPaymentQr, ifsc: e.target.value })}
                                                        placeholder="HDFC0000104"
                                                        className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10px] font-mono text-foreground focus:border-purple-500" />
                                                    </div>
                                                  </div>
                                                  <div>
                                                    <label className="text-[9.5px] font-semibold text-muted-foreground block mb-0.5">Custom Standee Image URL (base64/URL)</label>
                                                    <input type="text" value={orgPaymentQr?.customImageUrl || ""}
                                                      onChange={(e) => setOrgPaymentQr({ ...orgPaymentQr, customImageUrl: e.target.value })}
                                                      placeholder="https://... or data:image/png;base64,..."
                                                      className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10px] font-mono text-foreground focus:border-purple-500" />
                                                  </div>
                                                  <button type="button" onClick={saveOrgPaymentQr}
                                                    className="w-full h-7 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs">
                                                    <Save className="size-3.5" /> Save &amp; Apply
                                                  </button>
                                                </div>
                                              </div>
                                              <div>
                                                <label className="text-[9.5px] font-semibold text-muted-foreground block mb-0.5">{t("Bank & Wire Transfer Details", "Bank & Wire Transfer Details")}</label>
                                                <textarea
                                                  rows={2}
                                                  value={activeTemplate.bankDetails || ""}
                                                  onChange={(e) => updateTemplateProperty("bankDetails", e.target.value)}
                                                  placeholder="Bank: HDFC Bank | A/C: 5010023456789 | IFSC: HDFC0000104"
                                                  className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-[10.5px] font-mono text-foreground focus:border-indigo-500"
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        {/* Sub-Tab 4: Terms & Legal */}
                                        {settingsActiveSubTab === "tax_terms" && (
                                          <div className="space-y-2.5 animate-in fade-in">
                                            <label className="flex items-center justify-between p-3 rounded-xl border border-border bg-card cursor-pointer hover:bg-muted/40">
                                              <div>
                                                <span className="text-xs font-bold text-foreground block">Print Terms & Conditions / Return Policy</span>
                                                <span className="text-[10px] text-muted-foreground">Display store returns, warranty, and interest policies</span>
                                              </div>
                                              <input
                                                type="checkbox"
                                                checked={activeTemplate.fields.showTerms !== false}
                                                onChange={() => toggleElementField("showTerms")}
                                                className="size-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                              />
                                            </label>
                                            <label className="flex items-center justify-between p-3 rounded-xl border border-border bg-card cursor-pointer hover:bg-muted/40">
                                              <div>
                                                <span className="text-xs font-bold text-foreground block">Digital Signature & Company Stamp</span>
                                                <span className="text-[10px] text-muted-foreground">Show authorized signatory seal in invoice footer</span>
                                              </div>
                                              <input
                                                type="checkbox"
                                                checked={!!activeTemplate.fields.showSignature}
                                                onChange={() => toggleElementField("showSignature")}
                                                className="size-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                              />
                                            </label>
                                            <div className="space-y-2.5 p-3.5 bg-muted/20 border border-border/70 rounded-2xl">
                                              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                <FileText className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                                {t("Terms & Footer Notes", "Terms & Footer Notes")}
                                              </h4>
                                              <div className="space-y-1">
                                                <label className="text-[9.5px] font-semibold text-muted-foreground block">Terms &amp; Conditions</label>
                                                <textarea
                                                  rows={3}
                                                  value={activeTemplate.termsText || (activeTemplate as any).termsAndConditionsText || ""}
                                                  onChange={(e) => {
                                                    updateTemplateProperty("termsText", e.target.value);
                                                    updateTemplateProperty("termsAndConditionsText" as any, e.target.value);
                                                  }}
                                                  placeholder="1. Goods once sold will not be taken back or exchanged."
                                                  className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-[10.5px] font-mono text-foreground focus:border-indigo-500"
                                                />
                                              </div>
                                              <div className="space-y-1">
                                                <label className="text-[9.5px] font-semibold text-muted-foreground block">Footer / Thank-You Note</label>
                                                <input
                                                  type="text"
                                                  value={activeTemplate.thankYouNote || activeTemplate.footerText || ""}
                                                  onChange={(e) => {
                                                    updateTemplateProperty("thankYouNote", e.target.value);
                                                    updateTemplateProperty("footerText", e.target.value);
                                                  }}
                                                  placeholder="Thank you for shopping with us!"
                                                  className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10.5px] text-foreground focus:border-indigo-500"
                                                />
                                              </div>
                                            </div>

                                            {/* Google Review QR — Org-level (billing GST store) */}
                                            <div className="space-y-2 p-3.5 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border border-amber-200 dark:border-amber-900/50">
                                              <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                  <Star className="h-3.5 w-3.5 text-amber-500" />
                                                  Google Review QR
                                                </h4>
                                                <input type="checkbox" checked={orgReviewEnabled}
                                                  onChange={(e) => setOrgReviewEnabled(e.target.checked)}
                                                  className="h-4 w-4 rounded text-amber-500 focus:ring-amber-500 cursor-pointer" />
                                              </div>
                                              <div className="space-y-1">
                                                <label className="text-[9.5px] font-semibold text-muted-foreground block">Review URL (base64/URL)</label>
                                                <input type="text" value={orgReviewUrl}
                                                  onChange={(e) => setOrgReviewUrl(e.target.value)}
                                                  placeholder="https://search.google.com/local/writereview?placeid=..."
                                                  className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10.5px] font-mono text-foreground focus:border-amber-500" />
                                                {orgReviewUrl && (
                                                  <a href={orgReviewUrl} target="_blank" rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 hover:underline">
                                                    <ExternalLink className="h-3 w-3" /> Open link
                                                  </a>
                                                )}
                                              </div>
                                              <button type="button" onClick={saveOrgReviewSettings}
                                                className="w-full h-7 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs">
                                                <Save className="size-3.5" /> Save &amp; Apply
                                              </button>
                                            </div>

                                            {/* Signature & Stamp — Org-level (billing GST store) */}
                                            <div className="space-y-2 p-3.5 bg-muted/20 border border-border/70 rounded-2xl">
                                              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                <PenTool className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                                Signature &amp; Stamp
                                              </h4>
                                              <div className="grid grid-cols-2 gap-1.5">
                                                <label className="flex items-center justify-between">
                                                  <span className="text-[10px] font-semibold text-foreground">Show Signature</span>
                                                  <input type="checkbox" checked={orgSignature?.showDigitalSignature !== false}
                                                    onChange={(e) => setOrgSignature({ ...orgSignature, showDigitalSignature: e.target.checked })}
                                                    className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                                                </label>
                                                <label className="flex items-center justify-between">
                                                  <span className="text-[10px] font-semibold text-foreground">Show Stamp</span>
                                                  <input type="checkbox" checked={orgSignature?.showDigitalStamp !== false}
                                                    onChange={(e) => setOrgSignature({ ...orgSignature, showDigitalStamp: e.target.checked })}
                                                    className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                                                </label>
                                              </div>
                                              <div className="space-y-1">
                                                <label className="text-[9.5px] font-semibold text-muted-foreground block">Signature Image URL (base64/URL)</label>
                                                <input type="text" value={orgSignature?.signatureUrl || ""}
                                                  onChange={(e) => setOrgSignature({ ...orgSignature, signatureUrl: e.target.value })}
                                                  className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10px] font-mono text-foreground focus:border-indigo-500" />
                                              </div>
                                              <div className="space-y-1">
                                                <label className="text-[9.5px] font-semibold text-muted-foreground block">Stamp Image URL (base64/URL)</label>
                                                <input type="text" value={orgSignature?.stampUrl || ""}
                                                  onChange={(e) => setOrgSignature({ ...orgSignature, stampUrl: e.target.value })}
                                                  className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10px] font-mono text-foreground focus:border-indigo-500" />
                                              </div>
                                              <div className="grid grid-cols-2 gap-1.5">
                                                <div className="space-y-1">
                                                  <label className="text-[9.5px] font-semibold text-muted-foreground block">Signature Title</label>
                                                  <input type="text" value={orgSignature?.signatureTitle || ""}
                                                    onChange={(e) => setOrgSignature({ ...orgSignature, signatureTitle: e.target.value })}
                                                    placeholder="Authorized Signatory"
                                                    className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10px] font-semibold text-foreground focus:border-indigo-500" />
                                                </div>
                                                <div className="space-y-1">
                                                  <label className="text-[9.5px] font-semibold text-muted-foreground block">Company Name</label>
                                                  <input type="text" value={orgSignature?.signatureCompanyName || ""}
                                                    onChange={(e) => setOrgSignature({ ...orgSignature, signatureCompanyName: e.target.value })}
                                                    className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10px] font-semibold text-foreground focus:border-indigo-500" />
                                                </div>
                                              </div>
                                              <div className="space-y-1">
                                                <label className="text-[9.5px] font-semibold text-muted-foreground block">Alignment</label>
                                                <select value={orgSignatureAlignment}
                                                  onChange={(e) => setOrgSignatureAlignment(e.target.value as any)}
                                                  className="w-full h-7 rounded-lg border border-input bg-background px-2 text-[10px] font-semibold text-foreground focus:border-indigo-500">
                                                  <option value="left">Left</option>
                                                  <option value="center">Center</option>
                                                  <option value="right">Right</option>
                                                </select>
                                              </div>
                                              <button type="button" onClick={saveOrgSignature}
                                                className="w-full h-7 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs">
                                                <Save className="size-3.5" /> Save &amp; Apply
                                              </button>
                                            </div>
                                          </div>
                                        )}

                                        {/* Sub-Tab 5: Credit / Debit Note Prefixes */}
                                        {settingsActiveSubTab === "credit_debit" && (
                                          <div className="space-y-3 animate-in fade-in">
                                            <div className="p-3.5 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-900/50 space-y-2.5">
                                              <span className="text-[11px] font-bold text-rose-800 dark:text-rose-300 block">🧾 Sales Credit Note (CN-)</span>
                                              <div className="grid grid-cols-3 gap-2">
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Prefix</label>
                                                  <input
                                                    type="text"
                                                    value={liveInvoiceSettings.creditNotePrefix || "CN-"}
                                                    onChange={(e) => {
                                                      const updated = { ...liveInvoiceSettings, creditNotePrefix: e.target.value.toUpperCase() };
                                                      setLiveInvoiceSettings(updated);
                                                      saveStoredInvoiceSettings(updated, tenant?.id);
                                                    }}
                                                    className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-mono font-bold"
                                                    placeholder="CN-"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Next Number</label>
                                                  <input
                                                    type="number"
                                                    min="1"
                                                    value={liveInvoiceSettings.creditNoteSequenceNumber || 1}
                                                    onChange={(e) => {
                                                      const updated = { ...liveInvoiceSettings, creditNoteSequenceNumber: Math.max(1, parseInt(e.target.value) || 1) };
                                                      setLiveInvoiceSettings(updated);
                                                      saveStoredInvoiceSettings(updated, tenant?.id);
                                                    }}
                                                    className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-bold"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Padding</label>
                                                  <select
                                                    value={liveInvoiceSettings.creditNotePadding ?? 4}
                                                    onChange={(e) => {
                                                      const updated = { ...liveInvoiceSettings, creditNotePadding: parseInt(e.target.value, 10) || 4 };
                                                      setLiveInvoiceSettings(updated);
                                                      saveStoredInvoiceSettings(updated, tenant?.id);
                                                    }}
                                                    className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-semibold"
                                                  >
                                                    <option value={4}>4 Digits</option>
                                                    <option value={5}>5 Digits</option>
                                                    <option value={3}>3 Digits</option>
                                                  </select>
                                                </div>
                                              </div>
                                              <div className="p-2 bg-rose-100/50 dark:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-900/40 flex items-center justify-between">
                                                <span className="text-[10px] text-muted-foreground">Next Credit Note:</span>
                                                <span className="font-mono text-[11px] font-bold text-rose-600 dark:text-rose-400">
                                                  {(liveInvoiceSettings.creditNotePrefix || "CN-")}{String(liveInvoiceSettings.creditNoteSequenceNumber || 1).padStart(liveInvoiceSettings.creditNotePadding ?? 4, "0")}
                                                </span>
                                              </div>
                                            </div>

                                            <div className="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/50 space-y-2.5">
                                              <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 block">🧾 Vendor Debit Note (DN-)</span>
                                              <div className="grid grid-cols-3 gap-2">
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Prefix</label>
                                                  <input
                                                    type="text"
                                                    value={liveInvoiceSettings.debitNotePrefix || "DN-"}
                                                    onChange={(e) => {
                                                      const updated = { ...liveInvoiceSettings, debitNotePrefix: e.target.value.toUpperCase() };
                                                      setLiveInvoiceSettings(updated);
                                                      saveStoredInvoiceSettings(updated, tenant?.id);
                                                    }}
                                                    className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-mono font-bold"
                                                    placeholder="DN-"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Next Number</label>
                                                  <input
                                                    type="number"
                                                    min="1"
                                                    value={liveInvoiceSettings.debitNoteSequenceNumber || 1}
                                                    onChange={(e) => {
                                                      const updated = { ...liveInvoiceSettings, debitNoteSequenceNumber: Math.max(1, parseInt(e.target.value) || 1) };
                                                      setLiveInvoiceSettings(updated);
                                                      saveStoredInvoiceSettings(updated, tenant?.id);
                                                    }}
                                                    className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-bold"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Padding</label>
                                                  <select
                                                    value={liveInvoiceSettings.debitNotePadding ?? 4}
                                                    onChange={(e) => {
                                                      const updated = { ...liveInvoiceSettings, debitNotePadding: parseInt(e.target.value, 10) || 4 };
                                                      setLiveInvoiceSettings(updated);
                                                      saveStoredInvoiceSettings(updated, tenant?.id);
                                                    }}
                                                    className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-semibold"
                                                  >
                                                    <option value={4}>4 Digits</option>
                                                    <option value={5}>5 Digits</option>
                                                    <option value={3}>3 Digits</option>
                                                  </select>
                                                </div>
                                              </div>
                                              <div className="p-2 bg-amber-100/50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900/40 flex items-center justify-between">
                                                <span className="text-[10px] text-muted-foreground">Next Debit Note:</span>
                                                <span className="font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400">
                                                  {(liveInvoiceSettings.debitNotePrefix || "DN-")}{String(liveInvoiceSettings.debitNoteSequenceNumber || 1).padStart(liveInvoiceSettings.debitNotePadding ?? 4, "0")}
                                                </span>
                                              </div>
                                            </div>

                                            <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-900/50 space-y-2.5">
                                              <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300 block">🛒 Purchase Invoice (PINV-)</span>
                                              <div className="grid grid-cols-3 gap-2">
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Prefix</label>
                                                  <input
                                                    type="text"
                                                    value={liveInvoiceSettings.purchaseInvoicePrefix || "PINV-"}
                                                    onChange={(e) => {
                                                      const updated = { ...liveInvoiceSettings, purchaseInvoicePrefix: e.target.value.toUpperCase() };
                                                      setLiveInvoiceSettings(updated);
                                                      saveStoredInvoiceSettings(updated, tenant?.id);
                                                    }}
                                                    className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-mono font-bold"
                                                    placeholder="PINV-"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Next Number</label>
                                                  <input
                                                    type="number"
                                                    min="1"
                                                    value={liveInvoiceSettings.purchaseInvoiceSequenceNumber || 1}
                                                    onChange={(e) => {
                                                      const updated = { ...liveInvoiceSettings, purchaseInvoiceSequenceNumber: Math.max(1, parseInt(e.target.value) || 1) };
                                                      setLiveInvoiceSettings(updated);
                                                      saveStoredInvoiceSettings(updated, tenant?.id);
                                                    }}
                                                    className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-bold"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Padding</label>
                                                  <select
                                                    value={liveInvoiceSettings.purchaseInvoicePadding ?? 4}
                                                    onChange={(e) => {
                                                      const updated = { ...liveInvoiceSettings, purchaseInvoicePadding: parseInt(e.target.value, 10) || 4 };
                                                      setLiveInvoiceSettings(updated);
                                                      saveStoredInvoiceSettings(updated, tenant?.id);
                                                    }}
                                                    className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-semibold"
                                                  >
                                                    <option value={4}>4 Digits</option>
                                                    <option value={5}>5 Digits</option>
                                                    <option value={3}>3 Digits</option>
                                                  </select>
                                                </div>
                                              </div>
                                              <div className="p-2 bg-blue-100/50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900/40 flex items-center justify-between">
                                                <span className="text-[10px] text-muted-foreground">Next Purchase Invoice:</span>
                                                <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400">
                                                  {(liveInvoiceSettings.purchaseInvoicePrefix || "PINV-")}{String(liveInvoiceSettings.purchaseInvoiceSequenceNumber || 1).padStart(liveInvoiceSettings.purchaseInvoicePadding ?? 4, "0")}
                                                </span>
                                              </div>
                                            </div>

                                            <div className="p-3.5 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-200 dark:border-purple-900/50 space-y-2.5">
                                              <span className="text-[11px] font-bold text-purple-800 dark:text-purple-300 block">📋 Purchase Order (PO-)</span>
                                              <div className="grid grid-cols-3 gap-2">
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Prefix</label>
                                                  <input
                                                    type="text"
                                                    value={liveInvoiceSettings.purchaseOrderPrefix || "PO-"}
                                                    onChange={(e) => {
                                                      const updated = { ...liveInvoiceSettings, purchaseOrderPrefix: e.target.value.toUpperCase() };
                                                      setLiveInvoiceSettings(updated);
                                                      saveStoredInvoiceSettings(updated, tenant?.id);
                                                    }}
                                                    className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-mono font-bold"
                                                    placeholder="PO-"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Next Number</label>
                                                  <input
                                                    type="number"
                                                    min="1"
                                                    value={liveInvoiceSettings.purchaseOrderSequenceNumber || 1}
                                                    onChange={(e) => {
                                                      const updated = { ...liveInvoiceSettings, purchaseOrderSequenceNumber: Math.max(1, parseInt(e.target.value) || 1) };
                                                      setLiveInvoiceSettings(updated);
                                                      saveStoredInvoiceSettings(updated, tenant?.id);
                                                    }}
                                                    className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-bold"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="text-[10px] text-muted-foreground block mb-0.5">Padding</label>
                                                  <select
                                                    value={liveInvoiceSettings.purchaseOrderPadding ?? 4}
                                                    onChange={(e) => {
                                                      const updated = { ...liveInvoiceSettings, purchaseOrderPadding: parseInt(e.target.value, 10) || 4 };
                                                      setLiveInvoiceSettings(updated);
                                                      saveStoredInvoiceSettings(updated, tenant?.id);
                                                    }}
                                                    className="w-full h-7 px-2 bg-white dark:bg-slate-900 border rounded text-xs font-semibold"
                                                  >
                                                    <option value={4}>4 Digits</option>
                                                    <option value={5}>5 Digits</option>
                                                    <option value={3}>3 Digits</option>
                                                  </select>
                                                </div>
                                              </div>
                                              <div className="p-2 bg-purple-100/50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-900/40 flex items-center justify-between">
                                                <span className="text-[10px] text-muted-foreground">Next Purchase Order:</span>
                                                <span className="font-mono text-[11px] font-bold text-purple-600 dark:text-purple-400">
                                                  {(liveInvoiceSettings.purchaseOrderPrefix || "PO-")}{String(liveInvoiceSettings.purchaseOrderSequenceNumber || 1).padStart(liveInvoiceSettings.purchaseOrderPadding ?? 4, "0")}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        {/* Sub-Tab 6: Tax & GST Slabs (Core ERP) */}
                                        {settingsActiveSubTab === "tax_finance" && (
                                          <div className="space-y-3 animate-in fade-in">
                                            <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-900/50 space-y-2.5">
                                              <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 block">🧾 Configured GST Tax Slabs</span>
                                                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                                                  {taxSlabs.length} Active Slabs
                                                </span>
                                              </div>
                                              <p className="text-[10.5px] text-muted-foreground">Active GST rates across POS, Sales Invoices &amp; Purchases with auto-split as CGST+SGST (Intra) or IGST (Inter).</p>
                                              {taxSlabs.length === 0 ? (
                                                <div className="p-3 bg-white/60 dark:bg-slate-900/40 rounded-lg border border-emerald-100 dark:border-emerald-900/40 text-[10.5px] text-muted-foreground">
                                                  No active GST slabs yet. Add one below.
                                                </div>
                                              ) : (
                                                <div className="grid grid-cols-3 gap-2">
                                                  {taxSlabs.map((slab) => {
                                                    const rate = Number(slab.rate ?? slab.rate_percent ?? 0);
                                                    const half = (rate / 2).toFixed(1);
                                                    return (
                                                      <div key={slab.id || slab.code} className="p-2 bg-white/70 dark:bg-slate-900/50 rounded-lg border border-emerald-100 dark:border-emerald-900/40 space-y-0.5">
                                                        <span className="font-extrabold text-xs text-foreground block">{rate}%</span>
                                                        <span className="text-[10px] font-bold text-muted-foreground block truncate">{slab.name || `GST ${rate}%`}</span>
                                                        <div className="mt-1 text-[8.5px] font-mono font-semibold text-muted-foreground border-t border-border/50 pt-1">
                                                          <div>CGST {half}% + SGST {half}%</div>
                                                          <div className="text-emerald-600 dark:text-emerald-400 font-bold">IGST {rate}%</div>
                                                        </div>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              )}
                                            </div>

                                            <div className="p-3.5 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-xl border border-indigo-200 dark:border-indigo-900/50 space-y-2">
                                              <span className="text-[10px] font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider block">+ Add New GST Tax Slab</span>
                                              <div className="grid grid-cols-[90px_1fr_auto] gap-1.5 items-center">
                                                <input
                                                  type="number"
                                                  step="0.01"
                                                  min="0"
                                                  max="100"
                                                  value={newTaxRate}
                                                  onChange={(e) => {
                                                    setNewTaxRate(e.target.value);
                                                    if (e.target.value) setNewTaxName(`GST ${e.target.value}%`);
                                                  }}
                                                  placeholder="Rate %"
                                                  className="w-full h-7 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 px-2 text-[11px] font-bold text-foreground focus:ring-1 focus:ring-indigo-500"
                                                />
                                                <input
                                                  type="text"
                                                  value={newTaxName}
                                                  onChange={(e) => setNewTaxName(e.target.value)}
                                                  placeholder="Slab Name (e.g. GST 18% Standard)"
                                                  className="w-full h-7 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 px-2 text-[11px] font-medium text-foreground focus:ring-1 focus:ring-indigo-500"
                                                />
                                                <button
                                                  type="button"
                                                  onClick={handleCreateTaxSlab}
                                                  disabled={isAddingTaxSlab || !newTaxRate}
                                                  className="h-7 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                                                >
                                                  {isAddingTaxSlab ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                                                  Save
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        {/* Sub-Tab 7: Barcode & Symbology */}
                                        {settingsActiveSubTab === "barcode" && (
                                          <div className="space-y-3 animate-in fade-in">
                                            <div className="space-y-1">
                                              <label className="text-xs font-semibold text-foreground">Symbology Standard</label>
                                              <select
                                                value={activeTemplate.barcodeSymbology || "Auto"}
                                                onChange={(e) => updateTemplateProperty("barcodeSymbology", e.target.value as any)}
                                                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-indigo-500 font-medium"
                                              >
                                                <option value="Auto">Auto (Smart Detect numeric vs alphanumeric)</option>
                                                <option value="Code-128">Code 128 (Universal High-Density Standard)</option>
                                                <option value="EAN-13">GS1 EAN-13 (13-digit Retail Standard)</option>
                                                <option value="Code-39">Code 39 (Alphanumeric Standard)</option>
                                                <option value="QR">QR Code (2D Data Matrix / Instant UPI)</option>
                                              </select>
                                            </div>

                                            <div className="space-y-1 p-3 bg-muted/20 rounded-xl border border-border/50">
                                              <div className="flex justify-between text-[11px] font-semibold text-foreground">
                                                <span>Barcode Height:</span>
                                                <span className="font-mono text-indigo-600 dark:text-indigo-400">{activeTemplate.barcodeHeight || 44}px</span>
                                              </div>
                                              <input
                                                type="range"
                                                min="20"
                                                max="90"
                                                value={activeTemplate.barcodeHeight || 44}
                                                onChange={(e) => updateTemplateProperty("barcodeHeight", Number(e.target.value))}
                                                className="w-full cursor-pointer accent-indigo-600"
                                              />
                                            </div>

                                            <div className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-card cursor-pointer hover:bg-muted/40">
                                              <input
                                                type="checkbox"
                                                id="show-barcode-text-toggle-2"
                                                checked={activeTemplate.showBarcodeText !== false}
                                                onChange={(e) => updateTemplateProperty("showBarcodeText", e.target.checked)}
                                                className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                                              />
                                              <label htmlFor="show-barcode-text-toggle-2" className="text-xs font-semibold text-foreground cursor-pointer">
                                                Show Digits / Text below Barcode
                                              </label>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ) : null}
                                    {/* ── Barcode & Label Studio — compact collapsed card (out of the A4 editor area) ── */}
                                    {isBarcodeTemplate && (
                                      <details className="rounded-2xl border border-blue-500/40 bg-card p-3 shadow-sm">
                                        <summary className="cursor-pointer text-xs font-black text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                                          <ScanBarcode className="h-3.5 w-3.5" /> {t("Barcode & Label Studio (collapsed)", "Barcode & Label Studio (collapsed)")}
                                        </summary>
                {(selectedDocType === "barcode" || activeTemplate?.category === "barcodes") && (
                  <div className="p-4 rounded-2xl bg-card border border-blue-500/40 shadow-sm space-y-4 mb-4">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-border/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
                          <ScanBarcode className="size-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-foreground">Barcode Studio (In-Page Customizer)</h4>
                          <p className="text-[10px] text-muted-foreground">Move, add, remove, and format elements with live preview</p>
                        </div>
                      </div>

                      {/* Add Element Anywhere Dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => setIsBarcodeAddMenuOpen(!isBarcodeAddMenuOpen)}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition"
                        >
                          <Plus className="size-3.5" /> + Add Element
                        </button>

                        {isBarcodeAddMenuOpen && (
                          <div className="absolute right-0 top-full mt-1 w-64 bg-card border border-border rounded-xl shadow-2xl p-1.5 z-50 max-h-80 overflow-y-auto space-y-0.5">
                            <div className="text-[9px] font-black uppercase text-muted-foreground px-2 py-1 border-b border-border/60">
                              Insert Element into Label
                            </div>
                            {[
                              { type: "companyName", label: "Company Header", icon: "🏢" },
                              { type: "productName", label: "Product Title", icon: "📦" },
                              { type: "sellingPrice", label: "Selling Price (SP)", icon: "💰" },
                              { type: "mrp", label: "MRP (Strike Price)", icon: "🏷️" },
                              { type: "priceGroup", label: "Price Block (SP+MRP)", icon: "💵" },
                              { type: "sku", label: "SKU / Code", icon: "🔖" },
                              { type: "hsn", label: "HSN Code", icon: "🔢" },
                              { type: "barcodeGraphic", label: "Barcode Graphic", icon: "📊" },
                              { type: "customText", label: "Custom Free Text", icon: "✍️" },
                              { type: "category", label: "Category / Brand", icon: "🏷️" },
                              { type: "batchMfgExp", label: "Mfg & Expiry Dates", icon: "📅" },
                              { type: "divider", label: "Divider Line", icon: "➖" },
                              { type: "discountBadge", label: "Discount Badge (% OFF)", icon: "🏷️" },
                            ].map((opt) => (
                              <button
                                key={opt.type}
                                onClick={() => addBarcodeElement(opt.type)}
                                className="w-full text-left p-1.5 rounded-lg hover:bg-muted flex items-center gap-2 transition text-xs group"
                              >
                                <span>{opt.icon}</span>
                                <span className="font-semibold text-foreground group-hover:text-blue-500 transition">{opt.label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sub-Tabs: Layers, Typography, Barcode, Pricing, Paper */}
                    <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl border border-border/60 overflow-x-auto text-xs">
                      {[
                        { id: "mybillbook", label: "⚡ myBillBook Setup" },
                        { id: "layers", label: "🗂️ Move & Order" },
                        { id: "typography", label: "✍️ Typography & Text" },
                        { id: "barcode", label: "📊 Barcode Graphic" },
                        { id: "pricing", label: "💰 MRP & Badges" },
                        { id: "paper", label: "📏 Paper & Border" },
                      ].map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => setBarcodeSubTab(sub.id as any)}
                          className={`px-2.5 py-1.5 rounded-lg font-bold transition whitespace-nowrap ${barcodeSubTab === sub.id
                            ? "bg-blue-600 text-white shadow-xs"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>

                    {/* Active Element Properties & Inspector Card (Always visible when an element is selected) */}
                    {selectedBarcodeElement && (
                      <div className="p-3 rounded-xl bg-muted/30 border border-border/80 space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="size-2 rounded-full bg-blue-500 animate-pulse" />
                            <span className="font-black text-foreground">
                              Selected: <strong className="text-blue-500">{selectedBarcodeElement.label || selectedBarcodeElement.type}</strong>
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {selectedBarcodeElement.isFreePositioned && (
                              <button
                                onClick={() =>
                                  updateSelectedBarcodeElement({
                                    isFreePositioned: false,
                                    posX: undefined,
                                    posY: undefined,
                                  })
                                }
                                className="px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 font-bold flex items-center gap-0.5 text-[10px]"
                                title="Snap back into structured auto-layout stack"
                              >
                                ↩ Snap to Flow
                              </button>
                            )}
                            <button
                              onClick={() => selectedBarcodeElementKey && moveBarcodeElementUp(selectedBarcodeElementKey)}
                              className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground font-bold flex items-center gap-0.5 text-[10px]"
                              title="Move Up"
                            >
                              <ArrowUp className="size-3 text-blue-500" /> Up
                            </button>
                            <button
                              onClick={() => selectedBarcodeElementKey && moveBarcodeElementDown(selectedBarcodeElementKey)}
                              className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground font-bold flex items-center gap-0.5 text-[10px]"
                              title="Move Down"
                            >
                              <ArrowDown className="size-3 text-blue-500" /> Down
                            </button>
                            <button
                              onClick={() => selectedBarcodeElementKey && duplicateBarcodeElement(selectedBarcodeElementKey)}
                              className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground font-bold flex items-center gap-0.5 text-[10px]"
                              title="Duplicate Block"
                            >
                              <Copy className="size-3 text-amber-500" /> Copy
                            </button>
                            <button
                              onClick={() => selectedBarcodeElementKey && removeBarcodeElement(selectedBarcodeElementKey)}
                              className="px-2 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold flex items-center gap-0.5 text-[10px]"
                              title="Delete Block"
                            >
                              <Trash2 className="size-3" /> Del
                            </button>
                          </div>
                        </div>

                        {/* Element Data Source & Custom Display Name */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground">Data Field / Source</label>
                            <select
                              value={selectedBarcodeElement.type}
                              onChange={(e) => {
                                const newType = e.target.value as any;
                                const defaultLabels: Record<string, string> = {
                                  mrp: "MRP (Retail Price)",
                                  sellingPrice: "Selling Price (SP)",
                                  priceGroup: "Price Block (SP+MRP)",
                                  productName: "Product Title",
                                  sku: "SKU / Code",
                                  hsn: "HSN Code",
                                  companyName: "Company Name",
                                  category: "Category / Brand",
                                  customText: "Custom Free Text",
                                  batchMfgExp: "Mfg & Expiry Dates",
                                  discountBadge: "Discount Badge (% OFF)",
                                  barcodeGraphic: "Barcode Graphic",
                                  divider: "Divider Line",
                                };
                                updateSelectedBarcodeElement({
                                  type: newType,
                                  label: defaultLabels[newType] || newType,
                                });
                              }}
                              className="w-full h-8 bg-background border border-border rounded-lg px-2 text-xs font-semibold text-foreground outline-none"
                            >
                              <option value="mrp">🏷️ MRP (Retail Price)</option>
                              <option value="sellingPrice">💰 Selling Price (SP)</option>
                              <option value="priceGroup">💵 Price Block (SP + MRP + Discount)</option>
                              <option value="productName">📦 Product Title</option>
                              <option value="sku">🔖 SKU / Code</option>
                              <option value="hsn">🔢 HSN Code</option>
                              <option value="companyName">🏢 Company / Store Name</option>
                              <option value="category">🏷️ Category / Brand</option>
                              <option value="customText">✍️ Custom Free Text / Template</option>
                              <option value="batchMfgExp">📅 Mfg & Expiry Dates</option>
                              <option value="discountBadge">🏷️ Discount Badge (% OFF)</option>
                              <option value="barcodeGraphic">📊 Barcode Graphic</option>
                              <option value="divider">➖ Divider Line</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground">Element Name / Label</label>
                            <input
                              type="text"
                              value={selectedBarcodeElement.label || ""}
                              onChange={(e) => updateSelectedBarcodeElement({ label: e.target.value })}
                              placeholder="e.g. Market Price, Max Retail Price"
                              className="w-full h-8 bg-background border border-border rounded-lg px-2 text-xs font-semibold text-foreground outline-none"
                            />
                          </div>
                        </div>

                        {/* Prefix & Suffix Customization */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground">Prefix Text</label>
                            <input
                              type="text"
                              value={selectedBarcodeElement.prefix || ""}
                              onChange={(e) => updateSelectedBarcodeElement({ prefix: e.target.value })}
                              placeholder="e.g. MRP: or Offer Price: "
                              className="w-full h-8 bg-background border border-border rounded-lg px-2 text-xs font-semibold text-foreground outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground">Suffix Text</label>
                            <input
                              type="text"
                              value={selectedBarcodeElement.suffix || ""}
                              onChange={(e) => updateSelectedBarcodeElement({ suffix: e.target.value })}
                              placeholder="e.g. /- or (Incl. Tax)"
                              className="w-full h-8 bg-background border border-border rounded-lg px-2 text-xs font-semibold text-foreground outline-none"
                            />
                          </div>
                        </div>

                        {/* Dynamic Template for Custom Text */}
                        {selectedBarcodeElement.type === "customText" && (
                          <div className="space-y-1.5 p-2 rounded-lg bg-blue-50/40 dark:bg-blue-950/20 border border-blue-500/30">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-blue-600 dark:text-blue-400">Custom Content / Template</label>
                              <span className="text-[9px] text-muted-foreground">Click chips to insert tags</span>
                            </div>
                            <input
                              type="text"
                              value={selectedBarcodeElement.customText || ""}
                              onChange={(e) => updateSelectedBarcodeElement({ customText: e.target.value })}
                              placeholder="e.g. Market: {mrp} | Offer: {sp}"
                              className="w-full h-8 bg-background border border-border rounded-lg px-2 text-xs font-semibold text-foreground outline-none"
                            />
                            <div className="flex items-center gap-1 flex-wrap pt-0.5">
                              {[
                                { tag: "{mrp}", label: "+ {mrp}" },
                                { tag: "{sp}", label: "+ {sp}" },
                                { tag: "{sku}", label: "+ {sku}" },
                                { tag: "{product_name}", label: "+ {product}" },
                                { tag: "{hsn}", label: "+ {hsn}" },
                                { tag: "{category}", label: "+ {category}" },
                                { tag: "{dates}", label: "+ {dates}" },
                                { tag: "{batch}", label: "+ {batch}" },
                              ].map((item) => (
                                <button
                                  key={item.tag}
                                  type="button"
                                  onClick={() => {
                                    const cur = selectedBarcodeElement.customText || "";
                                    updateSelectedBarcodeElement({ customText: cur ? `${cur} ${item.tag}` : item.tag });
                                  }}
                                  className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 transition"
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* MRP Strikeoff Toggle (Applicable & Removable as per user choice) */}
                        {(selectedBarcodeElement.type === "mrp" || selectedBarcodeElement.type === "priceGroup") && (
                          <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border">
                            <div>
                              <div className="text-xs font-bold text-foreground">MRP Strike-through Line</div>
                              <div className="text-[9.5px] text-muted-foreground">
                                {selectedBarcodeElement.showStrike === false || selectedBarcodeElement.textDecoration === "none"
                                  ? "✕ Strikeoff disabled (Solid & Clean MRP)"
                                  : "✓ Strikeoff enabled (Line-through MRP)"}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const isCurrentlyOff =
                                  selectedBarcodeElement.showStrike === false ||
                                  selectedBarcodeElement.textDecoration === "none";
                                const nextVal = isCurrentlyOff; // if off, turn on (true); if on, turn off (false)
                                updateSelectedBarcodeElement({
                                  showStrike: nextVal,
                                  textDecoration: nextVal ? "line-through" : "none",
                                });
                                updateTemplateProperty("showMrpStrike", nextVal);
                              }}
                              className={`px-3 py-1 rounded-lg text-xs font-black border transition ${selectedBarcodeElement.showStrike === false || selectedBarcodeElement.textDecoration === "none"
                                ? "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                                : "bg-red-600 text-white border-red-600 shadow-2xs"
                                }`}
                            >
                              {selectedBarcodeElement.showStrike === false || selectedBarcodeElement.textDecoration === "none"
                                ? "Strike-through: OFF"
                                : "Strike-through: ON"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SUBTAB 0: myBillBook Setup – Fixed Columns, Font Size Steppers, Bold Toggles */}
                    {barcodeSubTab === "mybillbook" && (
                      <div className="space-y-4 pt-1">
                        {/* Printer Type */}
                        <div className="space-y-2">
                          <h5 className="text-[11px] font-black text-foreground flex items-center gap-1.5">
                            <span className="size-5 rounded-md bg-blue-600 text-white flex items-center justify-center text-[10px]">🖨️</span>
                            Printer Type
                          </h5>
                          <div className="flex items-center gap-3">
                            {[
                              { id: "label" as const, label: "Label Printer", desc: "Roll / Sticker" },
                              { id: "a4" as const, label: "A4 Printer", desc: "Sheet Grid" },
                            ].map((pt) => (
                              <label
                                key={pt.id}
                                onClick={() => setMbPrinterType(pt.id)}
                                className={`flex-1 flex items-center gap-2 p-2.5 rounded-xl border-2 cursor-pointer transition-all ${mbPrinterType === pt.id
                                  ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 shadow-xs"
                                  : "border-border/60 bg-card hover:border-border"
                                  }`}
                              >
                                <input
                                  type="radio"
                                  name="mbPrinterType"
                                  checked={mbPrinterType === pt.id}
                                  onChange={() => setMbPrinterType(pt.id)}
                                  className="h-3.5 w-3.5 text-blue-600"
                                />
                                <div>
                                  <div className="text-[11px] font-bold text-foreground">{pt.label}</div>
                                  <div className="text-[9px] text-muted-foreground">{pt.desc}</div>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* Label Size */}
                        <div className="space-y-1.5">
                          <h5 className="text-[11px] font-black text-foreground flex items-center gap-1.5">
                            <span className="size-5 rounded-md bg-indigo-600 text-white flex items-center justify-center text-[10px]">📏</span>
                            Label Size
                          </h5>
                          <select
                            value={activeTemplate.paperSize || "50x25mm"}
                            onChange={(e) => updateTemplateProperty("paperSize", e.target.value)}
                            className="w-full h-9 bg-background border border-border rounded-lg px-3 text-xs font-semibold text-foreground outline-none focus:border-blue-500 transition"
                          >
                            <option value="50x25mm">50 × 25mm (2 Labels/Row)</option>
                            <option value="38x25mm">38 × 25mm (1 Label/Row)</option>
                            <option value="50x50mm">50 × 50mm (Square)</option>
                            <option value="100x50mm">100 × 50mm (Large)</option>
                            <option value="A4 Sheet">A4 Sheet (Grid)</option>
                          </select>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-border/60" />

                        {/* Fixed Columns Table */}
                        <div className="space-y-2">
                          <h5 className="text-[11px] font-black text-foreground flex items-center gap-1.5">
                            <span className="size-5 rounded-md bg-emerald-600 text-white flex items-center justify-center text-[10px]">📋</span>
                            Fixed Columns
                          </h5>
                          <div className="rounded-xl border border-border/80 overflow-hidden">
                            {/* Table Header */}
                            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 px-3 py-2 bg-muted/50 border-b border-border/60">
                              <span className="text-[9px] font-bold text-muted-foreground uppercase">Show</span>
                              <span className="text-[9px] font-bold text-muted-foreground uppercase">Field Name</span>
                              <span className="text-[9px] font-bold text-muted-foreground uppercase">Font Size</span>
                              <span className="text-[9px] font-bold text-muted-foreground uppercase">Bold</span>
                            </div>
                            {/* Table Rows */}
                            {[
                              { key: "companyName", label: "Business Name", elId: "el_company", settingKey: "header", defaultSize: 10 },
                              { key: "sku", label: "Item Code", elId: "el_sku", settingKey: "sku", defaultSize: 8 },
                              { key: "productName", label: "Item Name", elId: "el_product_name", settingKey: "productName", defaultSize: 9 },
                              { key: "mrp", label: "MRP", elId: "el_mrp", settingKey: "priceMrp", defaultSize: 8 },
                              { key: "sellingPrice", label: "Selling Price", elId: "el_sp", settingKey: "priceSp", defaultSize: 9 },
                              { key: "hsn", label: "HSN Code", elId: "el_hsn", settingKey: "hsn", defaultSize: 7 },
                              { key: "batchMfgExp", label: "Batch No / Expiry", elId: "el_batch", settingKey: "batchMfgExp", defaultSize: 7 },
                              { key: "category", label: "Net Qty", elId: "el_category", settingKey: "category", defaultSize: 8 },
                            ].map((col, idx) => {
                              const elBlock = currentBarcodeElements.find(
                                (el) =>
                                  el.id === col.elId ||
                                  (col.key === "sellingPrice" && (el.id === "el_sp" || el.id === "el_selling_price" || el.type === "sellingPrice")) ||
                                  (col.key === "mrp" && (el.id === "el_mrp" || el.type === "mrp")) ||
                                  el.type === col.key
                              );
                              const isVisible = elBlock ? elBlock.visible !== false : false;
                              const currentFontSize = elBlock?.fontSize
                                ? parseInt(String(elBlock.fontSize), 10)
                                : col.defaultSize;
                              const isBold = elBlock?.fontWeight === "bold" || elBlock?.fontWeight === "900" || elBlock?.fontWeight === "600";

                              const handleToggleVisible = () => {
                                if (elBlock) {
                                  const updated = currentBarcodeElements.map((el) =>
                                    el.id === elBlock.id ? { ...el, visible: !isVisible } : el
                                  );
                                  setBarcodeElements(updated);
                                } else {
                                  addBarcodeElement(col.key);
                                }
                              };

                              const handleFontSizeChange = (delta: number) => {
                                if (!elBlock) return;
                                const newSize = Math.max(5, Math.min(36, currentFontSize + delta));
                                const updated = currentBarcodeElements.map((el) =>
                                  el.id === elBlock.id ? { ...el, fontSize: newSize } : el
                                );
                                setBarcodeElements(updated);
                                if (col.settingKey) {
                                  const prevSettings = activeTemplate.elementSettings || {};
                                  const prevSetting = prevSettings[col.settingKey] || {};
                                  updateTemplateProperty("elementSettings", {
                                    ...prevSettings,
                                    [col.settingKey]: { ...prevSetting, fontSize: newSize },
                                  });
                                }
                              };

                              const handleToggleBold = () => {
                                if (!elBlock) return;
                                const nextWeight = isBold ? "normal" : "900";
                                const updated = currentBarcodeElements.map((el) =>
                                  el.id === elBlock.id
                                    ? { ...el, fontWeight: nextWeight }
                                    : el
                                );
                                setBarcodeElements(updated);
                                if (col.settingKey) {
                                  const prevSettings = activeTemplate.elementSettings || {};
                                  const prevSetting = prevSettings[col.settingKey] || {};
                                  updateTemplateProperty("elementSettings", {
                                    ...prevSettings,
                                    [col.settingKey]: { ...prevSetting, fontWeight: nextWeight },
                                  });
                                }
                              };

                              return (
                                <div
                                  key={col.key}
                                  className={`grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center px-3 py-2 ${idx % 2 === 0 ? "bg-background" : "bg-muted/20"
                                    } ${idx < 7 ? "border-b border-border/40" : ""}`}
                                >
                                  {/* Checkbox */}
                                  <input
                                    type="checkbox"
                                    checked={isVisible}
                                    onChange={handleToggleVisible}
                                    className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                  {/* Label */}
                                  <span className={`text-xs font-semibold ${isVisible ? "text-foreground" : "text-muted-foreground line-through"
                                    }`}>
                                    {col.label}
                                  </span>
                                  {/* Font Size Stepper: [-] [22] [+] */}
                                  <div className="flex items-center gap-0">
                                    <button
                                      onClick={() => handleFontSizeChange(-1)}
                                      disabled={!isVisible || !elBlock}
                                      className="h-7 w-7 flex items-center justify-center rounded-l-lg border border-border bg-muted/60 hover:bg-muted text-foreground font-bold text-sm transition disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                      −
                                    </button>
                                    <div className="h-7 w-9 flex items-center justify-center border-y border-border bg-background text-xs font-black text-foreground tabular-nums">
                                      {currentFontSize}
                                    </div>
                                    <button
                                      onClick={() => handleFontSizeChange(1)}
                                      disabled={!isVisible || !elBlock}
                                      className="h-7 w-7 flex items-center justify-center rounded-r-lg border border-border bg-muted/60 hover:bg-muted text-foreground font-bold text-sm transition disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                      +
                                    </button>
                                  </div>
                                  {/* Bold Toggle: [B] */}
                                  <button
                                    onClick={handleToggleBold}
                                    disabled={!isVisible || !elBlock}
                                    className={`h-7 w-7 flex items-center justify-center rounded-lg border text-xs transition disabled:opacity-30 disabled:cursor-not-allowed ${isBold
                                      ? "bg-blue-600 border-blue-600 text-white font-black shadow-xs"
                                      : "bg-background border-border text-muted-foreground hover:bg-muted font-bold"
                                      }`}
                                  >
                                    B
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Custom Fields */}
                        <div className="space-y-2">
                          <h5 className="text-[11px] font-black text-foreground flex items-center gap-1.5">
                            <span className="size-5 rounded-md bg-amber-600 text-white flex items-center justify-center text-[10px]">✨</span>
                            Custom Fields
                          </h5>
                          <div className="space-y-1.5">
                            {mbCustomFields.map((cf) => (
                              <div
                                key={cf.id}
                                className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-2 items-center px-3 py-2 rounded-lg border border-border/60 bg-card"
                              >
                                <input
                                  type="checkbox"
                                  checked={cf.enabled}
                                  onChange={() =>
                                    setMbCustomFields((prev) =>
                                      prev.map((f) =>
                                        f.id === cf.id ? { ...f, enabled: !f.enabled } : f
                                      )
                                    )
                                  }
                                  className="h-4 w-4 rounded border-border text-blue-600 cursor-pointer"
                                />
                                <input
                                  type="text"
                                  value={cf.label}
                                  onChange={(e) =>
                                    setMbCustomFields((prev) =>
                                      prev.map((f) =>
                                        f.id === cf.id ? { ...f, label: e.target.value } : f
                                      )
                                    )
                                  }
                                  className="h-7 bg-background border border-border rounded-md px-2 text-xs font-semibold text-foreground outline-none focus:border-blue-500"
                                  placeholder="Field name..."
                                />
                                {/* Font Size Stepper */}
                                <div className="flex items-center gap-0">
                                  <button
                                    onClick={() =>
                                      setMbCustomFields((prev) =>
                                        prev.map((f) =>
                                          f.id === cf.id
                                            ? { ...f, fontSize: Math.max(5, f.fontSize - 1) }
                                            : f
                                        )
                                      )
                                    }
                                    className="h-7 w-7 flex items-center justify-center rounded-l-lg border border-border bg-muted/60 hover:bg-muted text-foreground font-bold text-sm transition"
                                  >
                                    −
                                  </button>
                                  <div className="h-7 w-9 flex items-center justify-center border-y border-border bg-background text-xs font-black text-foreground tabular-nums">
                                    {cf.fontSize}
                                  </div>
                                  <button
                                    onClick={() =>
                                      setMbCustomFields((prev) =>
                                        prev.map((f) =>
                                          f.id === cf.id
                                            ? { ...f, fontSize: Math.min(36, f.fontSize + 1) }
                                            : f
                                        )
                                      )
                                    }
                                    className="h-7 w-7 flex items-center justify-center rounded-r-lg border border-border bg-muted/60 hover:bg-muted text-foreground font-bold text-sm transition"
                                  >
                                    +
                                  </button>
                                </div>
                                {/* Bold Toggle */}
                                <button
                                  onClick={() =>
                                    setMbCustomFields((prev) =>
                                      prev.map((f) =>
                                        f.id === cf.id ? { ...f, bold: !f.bold } : f
                                      )
                                    )
                                  }
                                  className={`h-7 w-7 flex items-center justify-center rounded-lg border text-xs transition ${cf.bold
                                    ? "bg-blue-600 border-blue-600 text-white font-black shadow-xs"
                                    : "bg-background border-border text-muted-foreground hover:bg-muted font-bold"
                                    }`}
                                >
                                  B
                                </button>
                                {/* Delete */}
                                <button
                                  onClick={() =>
                                    setMbCustomFields((prev) =>
                                      prev.filter((f) => f.id !== cf.id)
                                    )
                                  }
                                  className="h-7 w-7 flex items-center justify-center rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-500 hover:bg-red-100 dark:hover:bg-red-950 transition"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={() =>
                              setMbCustomFields((prev) => [
                                ...prev,
                                {
                                  id: `cf_${Date.now()}`,
                                  label: `Custom Field ${prev.length + 1}`,
                                  fontSize: 8,
                                  bold: false,
                                  enabled: true,
                                },
                              ])
                            }
                            className="w-full py-2 rounded-lg border-2 border-dashed border-blue-400/60 hover:border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center justify-center gap-1.5 transition hover:bg-blue-50/80 dark:hover:bg-blue-950/40"
                          >
                            <Plus className="size-3.5" />
                            + Add Custom Field
                          </button>
                        </div>
                      </div>
                    )}

                    {/* SUBTAB 1: Layers & Hierarchy / Free 2D Placement */}
                    {barcodeSubTab === "layers" && (
                      <div className="space-y-3.5">
                        {/* Interactive Drag & Place Tip */}
                        <div className="p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-500/30 text-xs flex items-start gap-2">
                          <Sparkles className="size-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <span className="font-bold text-blue-900 dark:text-blue-200">Free-Form Canvas Drag & Place</span>
                            <p className="text-[10px] text-blue-700/80 dark:text-blue-300/80 leading-relaxed">
                              Click and drag <strong>ANY</strong> element directly on the sticker label preview to place it anywhere (X & Y coordinates).
                            </p>
                          </div>
                        </div>

                        {/* Selected Element Precise Coordinate Controls */}
                        {selectedBarcodeElement && (
                          <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-foreground flex items-center gap-1.5">
                                <span className="size-2 rounded-full bg-blue-500" />
                                Placement for: <strong className="text-blue-600 dark:text-blue-400">{selectedBarcodeElement.label || selectedBarcodeElement.type}</strong>
                              </span>
                              {selectedBarcodeElement.isFreePositioned && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateSelectedBarcodeElement({
                                      isFreePositioned: false,
                                      posX: undefined,
                                      posY: undefined,
                                    })
                                  }
                                  className="text-[9.5px] font-bold text-amber-600 hover:text-amber-500 hover:underline"
                                >
                                  Reset to Stack
                                </button>
                              )}
                            </div>

                            {/* 4-Way Precision Nudge D-Pad & Keyboard Controls */}
                            <div className="p-2 rounded-lg bg-background border border-border/80 flex items-center justify-between gap-2">
                              <div className="space-y-0.5">
                                <span className="text-[10px] font-bold text-foreground block">Precision Nudge</span>
                                <span className="text-[9px] text-muted-foreground block">Use on-screen buttons or keyboard <strong>↑ ↓ ← →</strong> arrow keys (Shift for 5%)</span>
                              </div>
                              <div className="grid grid-cols-3 gap-1 shrink-0 w-24">
                                <div />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const curY = selectedBarcodeElement.posY ?? 10;
                                    updateSelectedBarcodeElement({
                                      posY: Math.max(0, curY - 1),
                                      isFreePositioned: true,
                                    });
                                  }}
                                  className="h-6 w-full rounded bg-muted hover:bg-blue-600 hover:text-white flex items-center justify-center font-bold text-xs transition border border-border/60"
                                  title="Nudge Up (1%)"
                                >
                                  ▲
                                </button>
                                <div />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const curX = selectedBarcodeElement.posX ?? 5;
                                    updateSelectedBarcodeElement({
                                      posX: Math.max(0, curX - 1),
                                      isFreePositioned: true,
                                    });
                                  }}
                                  className="h-6 w-full rounded bg-muted hover:bg-blue-600 hover:text-white flex items-center justify-center font-bold text-xs transition border border-border/60"
                                  title="Nudge Left (1%)"
                                >
                                  ◀
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const curY = selectedBarcodeElement.posY ?? 10;
                                    updateSelectedBarcodeElement({
                                      posY: Math.min(92, curY + 1),
                                      isFreePositioned: true,
                                    });
                                  }}
                                  className="h-6 w-full rounded bg-muted hover:bg-blue-600 hover:text-white flex items-center justify-center font-bold text-xs transition border border-border/60"
                                  title="Nudge Down (1%)"
                                >
                                  ▼
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const curX = selectedBarcodeElement.posX ?? 5;
                                    updateSelectedBarcodeElement({
                                      posX: Math.min(92, curX + 1),
                                      isFreePositioned: true,
                                    });
                                  }}
                                  className="h-6 w-full rounded bg-muted hover:bg-blue-600 hover:text-white flex items-center justify-center font-bold text-xs transition border border-border/60"
                                  title="Nudge Right (1%)"
                                >
                                  ▶
                                </button>
                              </div>
                            </div>

                            {/* X & Y Coordinate Sliders and Numeric Inputs */}
                            <div className="grid grid-cols-2 gap-2.5 pt-1">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] font-bold">
                                  <span className="text-muted-foreground">↔ X Position (Left %)</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="92"
                                    value={selectedBarcodeElement.posX ?? 0}
                                    onChange={(e) =>
                                      updateSelectedBarcodeElement({
                                        posX: Math.max(0, Math.min(92, Number(e.target.value))),
                                        isFreePositioned: true,
                                      })
                                    }
                                    className="w-12 h-5 text-right font-mono text-blue-600 bg-background border border-border rounded px-1 text-[10px] outline-none"
                                  />
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="90"
                                  value={selectedBarcodeElement.posX ?? 0}
                                  onChange={(e) =>
                                    updateSelectedBarcodeElement({
                                      posX: Number(e.target.value),
                                      isFreePositioned: true,
                                    })
                                  }
                                  className="w-full accent-blue-600 cursor-pointer"
                                />
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] font-bold">
                                  <span className="text-muted-foreground">↕ Y Position (Top %)</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="92"
                                    value={selectedBarcodeElement.posY ?? 0}
                                    onChange={(e) =>
                                      updateSelectedBarcodeElement({
                                        posY: Math.max(0, Math.min(92, Number(e.target.value))),
                                        isFreePositioned: true,
                                      })
                                    }
                                    className="w-12 h-5 text-right font-mono text-blue-600 bg-background border border-border rounded px-1 text-[10px] outline-none"
                                  />
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="90"
                                  value={selectedBarcodeElement.posY ?? 0}
                                  onChange={(e) =>
                                    updateSelectedBarcodeElement({
                                      posY: Number(e.target.value),
                                      isFreePositioned: true,
                                    })
                                  }
                                  className="w-full accent-blue-600 cursor-pointer"
                                />
                              </div>
                            </div>

                            {/* 9-Point Quick Alignment Presets */}
                            <div className="space-y-1 pt-1 border-t border-border/60">
                              <span className="text-[9.5px] font-bold text-muted-foreground block">Quick Position Presets</span>
                              <div className="grid grid-cols-3 gap-1">
                                {[
                                  { label: "Top Left", x: 2, y: 2 },
                                  { label: "Top Center", x: 30, y: 2 },
                                  { label: "Top Right", x: 65, y: 2 },
                                  { label: "Mid Left", x: 2, y: 40 },
                                  { label: "Center", x: 30, y: 40 },
                                  { label: "Mid Right", x: 65, y: 40 },
                                  { label: "Bot Left", x: 2, y: 78 },
                                  { label: "Bot Center", x: 30, y: 78 },
                                  { label: "Bot Right", x: 65, y: 78 },
                                ].map((p) => (
                                  <button
                                    key={p.label}
                                    type="button"
                                    onClick={() =>
                                      updateSelectedBarcodeElement({
                                        posX: p.x,
                                        posY: p.y,
                                        isFreePositioned: true,
                                      })
                                    }
                                    className="px-1.5 py-1 rounded bg-background hover:bg-muted text-[9.5px] font-bold text-foreground border border-border transition text-center"
                                  >
                                    {p.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="font-bold text-muted-foreground">
                            All Elements Stack & Order
                          </span>
                        </div>

                        {/* Element list stack */}
                        <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                          {currentBarcodeElements.map((el, idx) => {
                            const isSel = selectedBarcodeElementKey === el.id;
                            return (
                              <div
                                key={el.id}
                                onClick={() => setSelectedBarcodeElementKey(el.id)}
                                className={`flex items-center justify-between p-1.5 rounded-lg text-xs cursor-pointer border transition ${isSel
                                  ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 font-bold shadow-xs"
                                  : "border-border/60 bg-background hover:bg-muted/40 text-foreground"
                                  }`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="font-mono text-[10px] text-muted-foreground w-3.5">{idx + 1}.</span>
                                  <span className="truncate">{el.label || el.type}</span>
                                  {el.isFreePositioned && (
                                    <span className="text-[8px] bg-blue-500/10 text-blue-600 px-1 rounded font-mono">
                                      ({el.posX ?? 0}%, {el.posY ?? 0}%)
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => moveBarcodeElementUp(el.id)}
                                    disabled={idx === 0}
                                    className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-20"
                                  >
                                    <ArrowUp className="size-3" />
                                  </button>
                                  <button
                                    onClick={() => moveBarcodeElementDown(el.id)}
                                    disabled={idx === currentBarcodeElements.length - 1}
                                    className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-20"
                                  >
                                    <ArrowDown className="size-3" />
                                  </button>
                                  <button
                                    onClick={() => toggleBarcodeElementVisibility(el.id)}
                                    className={`p-1 ${el.visible === false ? "text-muted-foreground" : "text-emerald-500"}`}
                                  >
                                    {el.visible === false ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* SUBTAB 2: Typography */}
                    {barcodeSubTab === "typography" && (
                      <div className="space-y-3 pt-1">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground">Font Family</label>
                            <select
                              value={selectedBarcodeElement?.fontFamily || activeTemplate.fontFamily || "Calibri, sans-serif"}
                              onChange={(e) => updateSelectedBarcodeElement({ fontFamily: e.target.value })}
                              className="w-full h-8 bg-background border border-border rounded-lg px-2 text-xs font-semibold text-foreground outline-none"
                            >
                              {FONT_FAMILIES.map((f) => (
                                <option key={f.value} value={f.value}>{f.label}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground">Font Size (px)</label>
                            <input
                              type="number"
                              min="6"
                              max="24"
                              value={selectedBarcodeElement?.fontSize ? Number(selectedBarcodeElement.fontSize) : 10}
                              onChange={(e) => updateSelectedBarcodeElement({ fontSize: Number(e.target.value) })}
                              className="w-full h-8 bg-background border border-border rounded-lg px-2 text-xs font-bold text-foreground outline-none"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          {/* Formatting: Bold, Italic, Underline, Strikethrough, AA */}
                          <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border">
                            {/* Bold */}
                            <button
                              onClick={() =>
                                updateSelectedBarcodeElement({
                                  fontWeight: selectedBarcodeElement?.fontWeight === "bold" || selectedBarcodeElement?.fontWeight === "900" ? "normal" : "bold",
                                })
                              }
                              className={`p-1.5 rounded text-xs font-black transition ${selectedBarcodeElement?.fontWeight === "bold" || selectedBarcodeElement?.fontWeight === "900"
                                ? "bg-blue-600 text-white shadow-2xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                }`}
                              title="Bold"
                            >
                              <Bold className="size-3.5" />
                            </button>

                            {/* Italic */}
                            <button
                              onClick={() =>
                                updateSelectedBarcodeElement({
                                  fontStyle: selectedBarcodeElement?.fontStyle === "italic" ? "normal" : "italic",
                                })
                              }
                              className={`p-1.5 rounded text-xs font-black transition ${selectedBarcodeElement?.fontStyle === "italic"
                                ? "bg-blue-600 text-white shadow-2xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                }`}
                              title="Italic"
                            >
                              <Italic className="size-3.5" />
                            </button>

                            {/* Underline */}
                            <button
                              onClick={() =>
                                updateSelectedBarcodeElement({
                                  textDecoration: selectedBarcodeElement?.textDecoration === "underline" ? "none" : "underline",
                                })
                              }
                              className={`p-1.5 rounded text-xs font-black transition ${selectedBarcodeElement?.textDecoration === "underline"
                                ? "bg-blue-600 text-white shadow-2xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                }`}
                              title="Underline"
                            >
                              <Underline className="size-3.5" />
                            </button>

                            {/* Strikethrough */}
                            <button
                              onClick={() => {
                                const isStruck =
                                  selectedBarcodeElement?.textDecoration === "line-through" ||
                                  selectedBarcodeElement?.showStrike === true;
                                const nextDecoration = isStruck ? "none" : "line-through";
                                updateSelectedBarcodeElement({
                                  textDecoration: nextDecoration,
                                  showStrike: !isStruck,
                                });
                                if (selectedBarcodeElement?.type === "mrp") {
                                  updateTemplateProperty("showMrpStrike", !isStruck);
                                }
                              }}
                              className={`p-1.5 rounded text-xs font-black transition ${selectedBarcodeElement?.textDecoration === "line-through" ||
                                selectedBarcodeElement?.showStrike === true
                                ? "bg-blue-600 text-white shadow-2xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                }`}
                              title="Strike-through (Line-Through)"
                            >
                              <Strikethrough className="size-3.5" />
                            </button>

                            {/* Case */}
                            <button
                              onClick={() =>
                                updateSelectedBarcodeElement({
                                  textTransform: selectedBarcodeElement?.textTransform === "uppercase" ? "none" : "uppercase",
                                })
                              }
                              className={`px-2 py-1 rounded text-[10px] font-black uppercase transition ${selectedBarcodeElement?.textTransform === "uppercase"
                                ? "bg-blue-600 text-white shadow-2xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                }`}
                              title="UPPERCASE"
                            >
                              AA
                            </button>
                          </div>

                          {/* Alignment */}
                          <div className="flex items-center gap-1">
                            {(["left", "center", "right"] as const).map((align) => {
                              const isSel = (selectedBarcodeElement?.textAlign || "left") === align;
                              const Icon = align === "left" ? AlignLeft : align === "center" ? AlignCenter : AlignRight;
                              return (
                                <button
                                  key={align}
                                  onClick={() => updateSelectedBarcodeElement({ textAlign: align })}
                                  className={`p-1.5 rounded border transition ${isSel ? "bg-blue-600 text-white border-blue-600" : "border-border text-foreground hover:bg-muted"
                                    }`}
                                  title={`Align ${align}`}
                                >
                                  <Icon className="size-3.5" />
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Text Color */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground">Text Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={selectedBarcodeElement?.color || "#0f172a"}
                              onChange={(e) => updateSelectedBarcodeElement({ color: e.target.value })}
                              className="size-7 rounded cursor-pointer border border-border bg-transparent"
                            />
                            <span className="font-mono text-xs text-muted-foreground uppercase">
                              {selectedBarcodeElement?.color || "#0f172a"}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SUBTAB 3: Barcode Graphic */}
                    {barcodeSubTab === "barcode" && (
                      <div className="space-y-3 pt-1">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground">Symbology</label>
                          <select
                            value={activeTemplate.barcodeSymbology || "Auto"}
                            onChange={(e) => updateTemplateProperty("barcodeSymbology", e.target.value as any)}
                            className="w-full h-8 bg-background border border-border rounded-lg px-2 text-xs font-semibold text-foreground outline-none"
                          >
                            <option value="Auto">Auto-Detect (Smart)</option>
                            <option value="Code-128">Code-128 (Alphanumeric Standard)</option>
                            <option value="EAN-13">GS1 EAN-13 (Retail Standard)</option>
                            <option value="EAN-8">EAN-8 (Compact)</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-muted-foreground">
                              Barcode Graphic Height
                            </label>
                            <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.2 rounded">
                              {activeTemplate.barcodeHeight || 40}px
                            </span>
                          </div>
                          <input
                            type="range"
                            min="20"
                            max="90"
                            step="2"
                            value={activeTemplate.barcodeHeight || 40}
                            onChange={(e) => handleResizeBarcode(Number(e.target.value), (activeTemplate as any).barcodeWidthScale || 1.0)}
                            className="w-full accent-blue-600"
                          />
                        </div>

                        {/* Barcode Width Scaling / Side Width */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-muted-foreground">
                              Barcode Width & Thickness (Sides)
                            </label>
                            <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.2 rounded">
                              {Math.round(((activeTemplate as any).barcodeWidthScale || 1.0) * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.6"
                            max="2.0"
                            step="0.05"
                            value={(activeTemplate as any).barcodeWidthScale || 1.0}
                            onChange={(e) => handleResizeBarcode(activeTemplate.barcodeHeight || 40, Number(e.target.value))}
                            className="w-full accent-blue-600"
                          />
                          <p className="text-[9.5px] text-muted-foreground">
                            💡 You can also drag the left, right, or bottom corner handles on the sticker to adjust sides!
                          </p>
                        </div>

                        <label className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer">
                          <input
                            type="checkbox"
                            checked={activeTemplate.showBarcodeText !== false}
                            onChange={(e) => updateTemplateProperty("showBarcodeText", e.target.checked)}
                            className="size-3.5 rounded text-blue-600"
                          />
                          <span>Show Human Readable Text</span>
                        </label>
                      </div>
                    )}

                    {/* SUBTAB 4: Pricing & Badges */}
                    {barcodeSubTab === "pricing" && (
                      <div className="space-y-3 pt-1">
                        {/* Strike-through line toggle */}
                        <div className="p-2.5 rounded-xl bg-muted/40 border border-border space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs font-black text-foreground">MRP Strike-through Line</div>
                              <div className="text-[10px] text-muted-foreground">
                                {activeTemplate.showMrpStrike === false
                                  ? "✕ Strikeoff line disabled (Clean price text)"
                                  : "✓ Strikeoff line enabled (Line-through price)"}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const nextVal = activeTemplate.showMrpStrike === false;
                                updateTemplateProperty("showMrpStrike", nextVal);
                                if (selectedBarcodeElement?.type === "mrp") {
                                  updateSelectedBarcodeElement({
                                    showStrike: nextVal,
                                    textDecoration: nextVal ? "line-through" : "none",
                                  });
                                }
                              }}
                              className={`px-3 py-1 rounded-lg text-xs font-black border transition ${activeTemplate.showMrpStrike === false
                                ? "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                                : "bg-red-600 text-white border-red-600 shadow-2xs"
                                }`}
                            >
                              {activeTemplate.showMrpStrike === false ? "Strike-through: OFF" : "Strike-through: ON"}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground">Selling Price Badge</label>
                          <div className="flex items-center gap-1 flex-wrap">
                            {[
                              { id: "none", label: "Clean" },
                              { id: "pill", label: "Green Pill" },
                              { id: "dark", label: "Dark Tag" },
                              { id: "gold", label: "Gold" },
                              { id: "outline", label: "Border" },
                            ].map((s) => (
                              <button
                                key={s.id}
                                onClick={() => updateTemplateProperty("spBadgeStyle", s.id)}
                                className={`px-2 py-1 rounded text-xs font-bold border transition ${(activeTemplate.spBadgeStyle || "none") === s.id
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "border-border text-foreground hover:bg-muted"
                                  }`}
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground">MRP Strike Color</label>
                          <div className="flex items-center gap-1">
                            {[
                              { id: "gray", label: "Slate" },
                              { id: "red", label: "Red" },
                              { id: "black", label: "Black" },
                            ].map((c) => (
                              <button
                                key={c.id}
                                onClick={() => updateTemplateProperty("mrpStrikeColor", c.id)}
                                className={`px-2 py-1 rounded text-xs font-bold border transition ${(activeTemplate.mrpStrikeColor || "gray") === c.id
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "border-border text-foreground hover:bg-muted"
                                  }`}
                              >
                                {c.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <label className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer">
                          <input
                            type="checkbox"
                            checked={activeTemplate.showDiscountBadge ?? false}
                            onChange={(e) => updateTemplateProperty("showDiscountBadge", e.target.checked)}
                            className="size-3.5 rounded text-blue-600"
                          />
                          <span>Show Discount % Badge</span>
                        </label>
                      </div>
                    )}

                    {/* SUBTAB 5: Paper & Borders */}
                    {barcodeSubTab === "paper" && (
                      <div className="space-y-3 pt-1">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground">Label Size</label>
                            <select
                              value={activeTemplate.paperSize || "50x25mm"}
                              onChange={(e) => updateTemplateProperty("paperSize", e.target.value)}
                              className="w-full h-8 bg-background border border-border rounded-lg px-2 text-xs font-semibold text-foreground outline-none"
                            >
                              <option value="50x25mm">50x25mm (Standard)</option>
                              <option value="38x25mm">38x25mm (Compact 3-Up)</option>
                              <option value="50x38mm">50x38mm (Apparel Tag)</option>
                              <option value="100x50mm">100x50mm (Shipping Box)</option>
                              <option value="A4 Sheet">A4 Sheet (24/40 Up)</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground">Border Style</label>
                            <select
                              value={activeTemplate.borderStyle || "solid"}
                              onChange={(e) => updateTemplateProperty("borderStyle", e.target.value)}
                              className="w-full h-8 bg-background border border-border rounded-lg px-2 text-xs font-semibold text-foreground outline-none"
                            >
                              <option value="solid">Solid</option>
                              <option value="dashed">Dashed</option>
                              <option value="dotted">Dotted</option>
                              <option value="double">Double</option>
                              <option value="none">Borderless</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground">Corner Radius</label>
                          <select
                            value={activeTemplate.borderRadius || "sm"}
                            onChange={(e) => updateTemplateProperty("borderRadius", e.target.value)}
                            className="w-full h-8 bg-background border border-border rounded-lg px-2 text-xs font-semibold text-foreground outline-none"
                          >
                            <option value="none">Square (0px)</option>
                            <option value="sm">Small (2px)</option>
                            <option value="md">Rounded (4px)</option>
                            <option value="lg">Pillow (8px)</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                                      </details>
                                    )}
                                  </div>
                                </div>

                                {/* ── COLUMN 3: Live Preview & Quick Switcher (Expanded) ── */}
                                <div className={`${isSidebarCollapsed ? "lg:col-span-6" : "lg:col-span-5"} flex flex-col lg:h-full lg:overflow-hidden`}>

                                  {/* Live Preview Card */}
                                  <div className="bg-card border border-border/80 rounded-2xl p-3.5 shadow-sm flex flex-col lg:h-full lg:overflow-hidden">
                                    {/* Header - Fixed at top */}
                                    <div className="flex items-center justify-between pb-2.5 border-b border-border/60 shrink-0">
                                      <div className="flex items-center gap-2">
                                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                                          <FileText className="h-4 w-4" />
                                        </div>
                                        <div>
                                          <h2 className="text-xs font-bold text-foreground">{t("Live Preview", "Live Preview")}</h2>
                                          <p className="text-[10px] text-muted-foreground">{t("This is how your document will look", "This is how your document will look")}</p>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5">
                                        {isBarcodeTemplate && (
                                          <div className="flex items-center rounded-lg border border-border/60 overflow-hidden text-[11px] font-semibold mr-1">
                                            <button
                                              type="button"
                                              onClick={() => setShowPrintPreview(false)}
                                              className={`px-2.5 py-1.5 transition-colors cursor-pointer ${!showPrintPreview
                                                ? "bg-indigo-600 text-white font-bold"
                                                : "bg-muted/60 text-muted-foreground hover:text-foreground"
                                                }`}
                                              title="Edit elements, drag, resize & style"
                                            >
                                              ✏️ Design
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setShowPrintPreview(true)}
                                              className={`px-2.5 py-1.5 transition-colors cursor-pointer ${showPrintPreview
                                                ? "bg-emerald-600 text-white font-bold"
                                                : "bg-muted/60 text-muted-foreground hover:text-foreground"
                                                }`}
                                              title="See exact output as it will be printed by the printer"
                                            >
                                              🖨️ Print Preview
                                            </button>
                                          </div>
                                        )}

                                        {/* Zoom Controls */}
                                        <div className="flex items-center bg-muted/60 rounded-lg p-0.5 border border-border/50 text-[11px] font-semibold text-muted-foreground">
                                          <button
                                            onClick={() => setZoomLevel((z) => Math.max(75, z - 10))}
                                            className="p-1 hover:text-foreground cursor-pointer"
                                            title="Zoom Out"
                                          >
                                            -
                                          </button>
                                          <span className="px-1.5 text-[10px]">{zoomLevel}%</span>
                                          <button
                                            onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
                                            className="p-1 hover:text-foreground cursor-pointer"
                                            title="Zoom In"
                                          >
                                            +
                                          </button>
                                        </div>

                                        {/* Thermal In-Tab Full View Toggle Button */}
                                        {isThermalTemplate && (
                                          <button
                                            type="button"
                                            onClick={() => setIsThermalFullViewOpen(true)}
                                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background hover:bg-muted/70 px-2.5 py-1.5 text-[11px] font-bold text-foreground shadow-xs transition-all cursor-pointer"
                                            title="Open full view interactive preview in this tab"
                                          >
                                            <Maximize2 className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                                            Full View
                                          </button>
                                        )}

                                        {/* Word Studio Button for Invoices */}
                                        {(selectedDocType === "invoice" || activeTemplate.category === "invoices" || activeTemplate.docType === "invoice") && (
                                          <button
                                            type="button"
                                            onClick={() => { setIsWordStudioBlank(false); setIsWordStudioOpen(true); }}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-2.5 py-1.5 text-[11px] font-bold shadow-xs transition-all cursor-pointer"
                                            title="Customize with Visual Word-Style Studio"
                                          >
                                            <Sparkles className="h-3 w-3 text-amber-300" />
                                            Word Studio
                                          </button>
                                        )}

                                        {/* Download PDF / Print Button */}
                                        <button
                                          onClick={handleDownloadPdf}
                                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 text-[11px] font-bold shadow-sm transition-all cursor-pointer"
                                        >
                                          <Download className="h-3 w-3" />
                                          {isThermalTemplate ? "Print Receipt" : "Download PDF"}
                                        </button>
                                      </div>
                                    </div>

                                    {/* Barcode Quick Interactive Controls Header */}
                                    {isBarcodeTemplate && (
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-200/80 dark:border-blue-800/60 shrink-0 my-2">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[11px] font-bold text-blue-950 dark:text-blue-200 shrink-0">Sample Product:</span>
                                          <select
                                            value={selectedSampleProductIdx}
                                            onChange={(e) => setSelectedSampleProductIdx(Number(e.target.value))}
                                            className="h-7 bg-background border border-border rounded-lg px-2 text-xs font-semibold text-foreground max-w-[220px] truncate outline-none"
                                          >
                                            {realCatalogProducts.map((p, idx) => (
                                              <option key={idx} value={idx}>
                                                {p.product_name} ({p.barcode || "No Barcode"})
                                              </option>
                                            ))}
                                          </select>
                                        </div>

                                        {selectedBarcodeElementKey && (
                                          <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                            <span className="text-[10px] font-mono text-blue-700 dark:text-blue-300">
                                              Selected: <strong className="font-bold">{selectedBarcodeElementKey}</strong>
                                            </span>
                                            {selectedBarcodeElement?.isFreePositioned && (
                                              <button
                                                onClick={() =>
                                                  updateSelectedBarcodeElement({
                                                    isFreePositioned: false,
                                                    posX: undefined,
                                                    posY: undefined,
                                                  })
                                                }
                                                className="px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 font-bold flex items-center gap-0.5 text-[10px] border border-amber-500/30"
                                                title="Snap back into structured auto-layout stack"
                                              >
                                                ↩ Snap to Flow
                                              </button>
                                            )}
                                            <div className="flex items-center gap-0.5 bg-background border border-border/80 rounded px-1 py-0.5">
                                              <button
                                                onClick={() => {
                                                  const curX = selectedBarcodeElement?.posX ?? 5;
                                                  updateSelectedBarcodeElement({ posX: Math.max(0, curX - 1), isFreePositioned: true });
                                                }}
                                                className="size-5 rounded hover:bg-blue-600 hover:text-white flex items-center justify-center text-[10px] font-bold"
                                                title="Nudge Left (1%)"
                                              >
                                                ◀
                                              </button>
                                              <button
                                                onClick={() => {
                                                  const curY = selectedBarcodeElement?.posY ?? 10;
                                                  updateSelectedBarcodeElement({ posY: Math.max(0, curY - 1), isFreePositioned: true });
                                                }}
                                                className="size-5 rounded hover:bg-blue-600 hover:text-white flex items-center justify-center text-[10px] font-bold"
                                                title="Nudge Up (1%)"
                                              >
                                                ▲
                                              </button>
                                              <button
                                                onClick={() => {
                                                  const curY = selectedBarcodeElement?.posY ?? 10;
                                                  updateSelectedBarcodeElement({ posY: Math.min(92, curY + 1), isFreePositioned: true });
                                                }}
                                                className="size-5 rounded hover:bg-blue-600 hover:text-white flex items-center justify-center text-[10px] font-bold"
                                                title="Nudge Down (1%)"
                                              >
                                                ▼
                                              </button>
                                              <button
                                                onClick={() => {
                                                  const curX = selectedBarcodeElement?.posX ?? 5;
                                                  updateSelectedBarcodeElement({ posX: Math.min(92, curX + 1), isFreePositioned: true });
                                                }}
                                                className="size-5 rounded hover:bg-blue-600 hover:text-white flex items-center justify-center text-[10px] font-bold"
                                                title="Nudge Right (1%)"
                                              >
                                                ▶
                                              </button>
                                            </div>
                                            <button
                                              onClick={() => moveBarcodeElementUp(selectedBarcodeElementKey)}
                                              className="p-1 rounded bg-background hover:bg-muted border border-border/80 text-foreground"
                                              title="Move Up (Order)"
                                            >
                                              <ArrowUp className="size-3" />
                                            </button>
                                            <button
                                              onClick={() => moveBarcodeElementDown(selectedBarcodeElementKey)}
                                              className="p-1 rounded bg-background hover:bg-muted border border-border/80 text-foreground"
                                              title="Move Down (Order)"
                                            >
                                              <ArrowDown className="size-3" />
                                            </button>
                                            <button
                                              onClick={() => duplicateBarcodeElement(selectedBarcodeElementKey)}
                                              className="p-1 rounded bg-background hover:bg-muted border border-border/80 text-amber-600"
                                              title="Duplicate Block"
                                            >
                                              <Copy className="size-3" />
                                            </button>
                                            <button
                                              onClick={() => removeBarcodeElement(selectedBarcodeElementKey)}
                                              className="p-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-600"
                                              title="Delete Block"
                                            >
                                              <Trash2 className="size-3" />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Document Canvas with scaling - Independent Scroll Container */}
                                    <div className="relative w-full flex-1 min-h-0 bg-slate-200/80 dark:bg-slate-900/80 rounded-xl p-3 sm:p-5 flex flex-col justify-start items-center overflow-x-auto overflow-y-auto border border-border/60 shadow-inner custom-scrollbar mt-2">
                                      {isBarcodeTemplate && !showPrintPreview && (
                                        <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1 bg-white/60 dark:bg-slate-800/60 px-3 py-1 rounded-full border border-border/60">
                                          <span>💡 <strong>Click</strong> any block to select & style, <strong>Double-click</strong> to edit text, or use left controls to add & reorder.</span>
                                        </div>
                                      )}

                                      {isBarcodeTemplate && showPrintPreview ? (
                                        /* Print Preview Mode - renders the exact same HTML iframe that gets sent to the printer */
                                        <div className="w-full flex flex-col items-center gap-2">
                                          <div className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50/80 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-200/60">
                                            <span>🖨️ <strong>Exact Print Output:</strong> This preview renders the precise HTML & CSS sent to the printer.</span>
                                          </div>
                                          <div
                                            style={{
                                              transform: `scale(${zoomLevel / 100})`,
                                              transformOrigin: "top center",
                                              transition: "transform 0.15s ease-out",
                                              width: "100%",
                                              display: "flex",
                                              justifyContent: "center",
                                            }}
                                          >
                                            <iframe
                                              key={`print-preview-${activeTemplate.id}-${selectedSampleProductIdx}-${JSON.stringify(activeTemplate.elements || {})}-${JSON.stringify(activeTemplate.elementSettings || {})}-${JSON.stringify(activeTemplate.customTexts || {})}-${JSON.stringify(activeTemplate.fields || {})}-${activeTemplate.paperSize}-${activeTemplate.labelWidthMm}-${activeTemplate.labelHeightMm}-${(activeTemplate as any).labelLayout}-${activeTemplate.primaryColor}-${activeTemplate.fontFamily}-${activeTemplate.textAlign}-${activeTemplate.barcodeSymbology}`}
                                              srcDoc={generateBarcodeLabelHtml(
                                                [
                                                  realCatalogProducts[selectedSampleProductIdx] || {
                                                    product_name: "Designer Saree Silk 3799",
                                                    barcode: "2064965391328",
                                                    sku: "SAR-3799",
                                                    selling_price: 3799.0,
                                                    mrp: 7599.0,
                                                    category_name: "APPAREL / ETHNIC",
                                                    format: activeTemplate.barcodeSymbology || "Code-128",
                                                  },
                                                ],
                                                activeTemplate as any,
                                                (activeTemplate as any).labelLayout || (activeTemplate.id?.includes("dual") ? "2up" : "1up"),
                                                currency.symbol,
                                                activeTemplate.storeName || tenant?.name,
                                                activeTemplate.barcodeSymbology
                                              )}
                                              style={{
                                                width: "100%",
                                                minHeight: "440px",
                                                border: "none",
                                                borderRadius: "12px",
                                                background: "#f8fafc",
                                                boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
                                              }}
                                              sandbox="allow-same-origin"
                                              title="Barcode Label Print Preview"
                                            />
                                          </div>
                                        </div>
                                      ) : (
                                        /* Design Mode - interactive live canvas */
                                        <div
                                          id="printable-preview-canvas"
                                          style={{
                                            transform: `scale(${zoomLevel / 100})`,
                                            transformOrigin: "top center",
                                            transition: "transform 0.15s ease-out",
                                          }}
                                          className="w-full flex justify-center"
                                        >
                                          <LiveDocumentPreview
                                            template={activeTemplate}
                                            currency={currency}
                                            bankAccounts={printBankAccounts}
                                            previewInvoiceSettings={liveInvoiceSettings}
                                            previewSlot={slotKeyForDocType(selectedDocType)}
                                            selectedBarcodeElementKey={selectedBarcodeElementKey}
                                            onSelectBarcodeElement={(k) => setSelectedBarcodeElementKey(k)}
                                            onFieldEdit={(k, val) => updateBarcodeCustomText(k, val)}
                                            onResizeBarcode={handleResizeBarcode}
                                            onResizeElement={handleResizeElement}
                                            onMoveElement={handleMoveBarcodeElement}
                                            sampleBarcodeItem={realCatalogProducts[selectedSampleProductIdx]}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                              </div>

                              {/* Template Store & Custom Theme Modal */}
                              {isTemplateStoreModalOpen && (
                                <TemplateStoreModal
                                  category={selectedDocType}
                                  templates={currentCategoryTemplates}
                                  activeTemplateId={activeTemplate.id}
                                  onClose={() => setIsTemplateStoreModalOpen(false)}
                                  onSelect={(tpl) => {
                                    handleSelectTemplate(tpl);
                                    setIsTemplateStoreModalOpen(false);
                                  }}
                                  onDuplicate={(tpl) => {
                                    handleDuplicateTemplate(tpl);
                                    setIsTemplateStoreModalOpen(false);
                                  }}
                                />
                              )}

                              {/* Exact PDF Stationery Overlay Modal */}
                              {isPdfOverlayModalOpen && (
                                <PdfTemplateOverlayModal
                                  isOpen={isPdfOverlayModalOpen}
                                  onClose={() => setIsPdfOverlayModalOpen(false)}
                                  onSaved={(newTplId) => {
                                    try {
                                      const saved = localStorage.getItem(`businessos_print_templates_v1_${tenantId}`);
                                      if (saved) {
                                        const parsed = JSON.parse(saved);
                                        if (Array.isArray(parsed)) {
                                          setTemplates(parsed);
                                        }
                                      }
                                    } catch { }
                                  }}
                                />
                              )}

                              {/* Barcode Word Template Customizer Studio Modal */}
                              {isBarcodeCustomizerModalOpen && (
                                <BarcodeTemplateCustomizerModal
                                  isOpen={isBarcodeCustomizerModalOpen}
                                  onClose={() => setIsBarcodeCustomizerModalOpen(false)}
                                  initialTemplateId={activeTemplate?.id}
                                  onSaved={(savedId) => {
                                    const allBarcodes = receiptTemplateStore.getAllBarcodeTemplates();
                                    setTemplates((prev) => {
                                      const others = prev.filter((t) => t.category !== "barcodes" && t.docType !== "barcode");
                                      return [...others, ...allBarcodes];
                                    });
                                    setSelectedTemplateId(savedId);
                                  }}
                                />
                              )}

                              {/* Visual Word-Style Invoice Designer Studio Modal */}
                              {isWordStudioOpen && (
                                <WordInvoiceStudioModal
                                  isOpen={isWordStudioOpen}
                                  onClose={() => {
                                    setIsWordStudioOpen(false);
                                    setIsWordStudioBlank(false);
                                  }}
                                  startBlank={isWordStudioBlank}
                                  initialTemplate={isWordStudioBlank ? undefined : activeTemplate}
                                  logoUrl={resolvedLogoUrl}
                                  storeName={resolvedStoreName}
                                  address={resolvedAddress}
                                  phone={resolvedPhone}
                                  email={activeBillingGst?.email || ""}
                                  gstin={resolvedGstin}
                                  onSaved={(savedConfig) => {
                                    const isNewBlank = isWordStudioBlank || !templates.some((t) => t.id === savedConfig.id);
                                    let updated: PrintTemplate[];
                                    let targetId = savedConfig.id;

                                    if (isNewBlank) {
                                      const newTpl: PrintTemplate = {
                                        id: savedConfig.id,
                                        name: savedConfig.name || "Custom Word Canvas Invoice",
                                        category: "invoices",
                                        docType: "invoice",
                                        description: "Custom invoice built from scratch using Blank Canvas Word Designer",
                                        isDefault: Boolean(savedConfig.isDefault),
                                        paperSize: "A4",
                                        orientation: "portrait",
                                        fontFamily: savedConfig.fontFamily,
                                        fontSize: `${savedConfig.fontSizePt}pt`,
                                        primaryColor: savedConfig.primaryColor,
                                        paperBgColor: savedConfig.paperBgColor,
                                        headerTitle: savedConfig.invoiceTitle,
                                        logoUrl: savedConfig.logoUrl,
                                        storeName: savedConfig.companyName,
                                        companyName: savedConfig.companyName,
                                        storeAddress: savedConfig.companyAddress,
                                        companyAddress: savedConfig.companyAddress,
                                        storePhone: savedConfig.companyPhone,
                                        companyPhone: savedConfig.companyPhone,
                                        storeEmail: savedConfig.companyEmail,
                                        companyEmail: savedConfig.companyEmail,
                                        gstin: savedConfig.companyGstin,
                                        wordConfig: savedConfig,
                                        columns: savedConfig.columns,
                                        customItemColumns: (savedConfig.columns || [])
                                          .filter((c: any) => c.isCustom || !DEFAULT_WORD_COLUMNS.some((dc) => dc.id === c.id || dc.fieldKey === c.fieldKey))
                                          .map((c: any) => ({
                                            id: c.id,
                                            name: c.headerTitle,
                                            label: c.headerTitle,
                                            key: c.fieldKey,
                                            enabled: c.enabled,
                                          })),
                                        body: {
                                          columns: (savedConfig.columns || []).filter((c: any) => c.enabled).map((c: any) => ({
                                            key: c.fieldKey,
                                            label: c.headerTitle,
                                            width: `${c.widthPercent}%`,
                                            align: c.align,
                                            visible: true,
                                          })),
                                        },
                                        watermarkText: savedConfig.watermarkText,
                                        watermarkOpacity: (savedConfig.watermarkOpacity || 0.08) * 100,
                                        showWatermark: Boolean(savedConfig.watermarkText),
                                      };
                                      updated = [newTpl, ...templates];
                                      targetId = newTpl.id;
                                    } else {
                                      updated = templates.map((t) => {
                                        if (t.id === activeTemplate.id || t.id === savedConfig.id) {
                                          return {
                                            ...t,
                                            name: savedConfig.name || t.name,
                                            logoUrl: savedConfig.logoUrl,
                                            storeName: savedConfig.companyName,
                                            companyName: savedConfig.companyName,
                                            storeAddress: savedConfig.companyAddress,
                                            companyAddress: savedConfig.companyAddress,
                                            storePhone: savedConfig.companyPhone,
                                            companyPhone: savedConfig.companyPhone,
                                            storeEmail: savedConfig.companyEmail,
                                            companyEmail: savedConfig.companyEmail,
                                            gstin: savedConfig.companyGstin,
                                            wordConfig: savedConfig,
                                            columns: savedConfig.columns,
                                            customItemColumns: (savedConfig.columns || [])
                                              .filter((c: any) => c.isCustom || !DEFAULT_WORD_COLUMNS.some((dc) => dc.id === c.id || dc.fieldKey === c.fieldKey))
                                              .map((c: any) => ({
                                                id: c.id,
                                                name: c.headerTitle,
                                                label: c.headerTitle,
                                                key: c.fieldKey,
                                                fieldKey: c.fieldKey,
                                                enabled: c.enabled,
                                              })),
                                            fields: {
                                              ...(t.fields || {}),
                                              showItemIndex: (savedConfig.columns || []).some((c: any) => c.fieldKey === "sno" && c.enabled),
                                              showHSN: (savedConfig.columns || []).some((c: any) => c.fieldKey === "hsn" && c.enabled),
                                              showBankDetails: savedConfig.showBankDetails ?? t.fields?.showBankDetails,
                                              showQR: savedConfig.showPaymentQr ?? t.fields?.showQR,
                                              showTaxSplit: savedConfig.showTaxBreakdown ?? t.fields?.showTaxSplit,
                                              showAmountInWords: savedConfig.showAmountInWords ?? t.fields?.showAmountInWords,
                                            },
                                            body: {
                                              ...(t.body || {}),
                                              columns: (savedConfig.columns || []).filter((c: any) => c.enabled).map((c: any) => ({
                                                key: c.fieldKey,
                                                label: c.headerTitle,
                                                width: `${c.widthPercent}%`,
                                                align: c.align,
                                                visible: true,
                                              })),
                                            },
                                            primaryColor: savedConfig.primaryColor,
                                            fontFamily: savedConfig.fontFamily,
                                            paperBgColor: savedConfig.paperBgColor,
                                            headerTitle: savedConfig.invoiceTitle,
                                            isDefault: Boolean(savedConfig.isDefault),
                                            watermarkText: savedConfig.watermarkText,
                                            watermarkOpacity: (savedConfig.watermarkOpacity || 0.08) * 100,
                                            showWatermark: Boolean(savedConfig.watermarkText),
                                          };
                                        }
                                        return t;
                                      });
                                    }

                                    persistTemplates(updated);
                                    setSelectedTemplateId(targetId);
                                    setIsWordStudioBlank(false);
                                    toast.success(`Word-style invoice template "${savedConfig.name || "Custom Word Canvas"}" saved & set active!`);
                                  }}
                                />
                              )}

                              

                              {/* ── Thermal Receipt Full View Modal (In-Tab Interactive) ── */}
                              {isThermalFullViewOpen && (
                                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
                                  <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                                    {/* Header */}
                                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/40 shrink-0">
                                      <div className="flex items-center gap-2.5">
                                        <div className="h-8 w-8 rounded-lg bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                                          <Printer className="h-4 w-4" />
                                        </div>
                                        <div>
                                          <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                                            Thermal Receipt Full View Preview
                                            <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                              100% ESC/POS Ready
                                            </span>
                                          </h3>
                                          <p className="text-[11px] text-muted-foreground">
                                            {activeTemplate.name} • {activeTemplate.paperSize === "58mm" ? "58mm Mini Roll" : "80mm Standard Roll"}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            triggerThermalPrint("preview-thermal-paper", {
                                              width: activeTemplate.paperSize === "58mm" ? "58mm" : "80mm",
                                              contrast: (activeTemplate.thermalContrast as any) || "ultra-dark",
                                              safeFeedMarginMm: activeTemplate.feedAfterPrint !== false ? 20 : 0,
                                              autoCut: activeTemplate.autoCutPaper !== false,
                                            });
                                            toast.success("Sending to ESC/POS Thermal Printer...");
                                          }}
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm cursor-pointer transition-transform active:scale-95"
                                        >
                                          <Printer className="h-3.5 w-3.5" />
                                          Direct Thermal Print
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => setIsThermalFullViewOpen(false)}
                                          className="p-1.5 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                                          title="Close"
                                        >
                                          <X className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Modal Canvas Body */}
                                    <div className="flex-1 overflow-y-auto p-6 flex justify-center bg-slate-100 dark:bg-slate-900/90">
                                      <div className="w-full flex justify-center">
                                        <LiveDocumentPreview
                                          template={activeTemplate}
                                          currency={currency}
                                            bankAccounts={printBankAccounts}
                                            previewInvoiceSettings={liveInvoiceSettings}
                                            previewSlot={slotKeyForDocType(selectedDocType)}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                          </div>
                          );
}

                          /* ── Element Toggle Row Component ── */
                          function ElementToggleRow({
                            icon: Icon,
                          label,
                          checked,
                          onChange,
}: {
                            icon: React.ElementType;
                          label: string;
                          checked: boolean;
  onChange: () => void;
}) {
  return (
                          <div className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-background hover:bg-muted/30 transition-all">
                            <div className="flex items-center gap-2 min-w-0">
                              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 cursor-grab" />
                              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="text-[11px] font-semibold text-foreground truncate">{label}</span>
                            </div>

                            <button
                              type="button"
                              onClick={onChange}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"
                                }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${checked ? "translate-x-4" : "translate-x-0"
                                  }`}
                              />
                            </button>
                          </div>
                          );
}

                          /* ── Live Document Preview Engine (Exact Multi-Theme Renderer Matching Original Screens) ── */
                          function LiveDocumentPreview({
                            template,
                            bankAccounts,
                            currency,
                            previewSlot,
                            previewInvoiceSettings,
                            selectedBarcodeElementKey,
                            onSelectBarcodeElement,
                            onFieldEdit,
                            onResizeBarcode,
                            onResizeElement,
                            onMoveElement,
                            sampleBarcodeItem,
}: {
                            template: PrintTemplate;
  bankAccounts?: BankAccountRecord[];
  previewSlot?: A4SlotKey;
  previewInvoiceSettings?: any;
                          currency: {symbol: string; code: string };
                          selectedBarcodeElementKey?: string | null;
  onSelectBarcodeElement?: (key: string | null) => void;
  onFieldEdit?: (key: string, val: string) => void;
  onResizeBarcode?: (newHeight: number, newScale?: number) => void;
                          onResizeElement?: (elementId: string, updates: {height ?: number; width?: number; fontSize?: number; posX?: number; posY?: number; isFreePositioned?: boolean }) => void;
                          onMoveElement?: (elementId: string, pos: {posX: number; posY: number; isFreePositioned: boolean }) => void;
                          sampleBarcodeItem?: any;
}) {
  const {t} = useI18n();
                          const {tenant} = useTenant();
                          const liveInvoiceSettings = previewInvoiceSettings || loadStoredInvoiceSettings(tenant?.id);
                          const f = {
                            ...DEFAULT_ELEMENT_TOGGLES,
                            showPoNumber: (template as any)?.fields?.showPoNumber !== undefined ? Boolean((template as any)?.fields?.showPoNumber) : (previewInvoiceSettings?.showPoNumber !== false),
                            showVehicleNumber: (template as any)?.fields?.showVehicleNumber !== undefined ? Boolean((template as any)?.fields?.showVehicleNumber) : (previewInvoiceSettings?.showVehicleNumber !== false),
                            showEwayBill: (template as any)?.fields?.showEwayBill !== undefined ? Boolean((template as any)?.fields?.showEwayBill) : (previewInvoiceSettings?.showEwayBill !== false),
                            showChallanNumber: (template as any)?.fields?.showChallanNumber !== undefined ? Boolean((template as any)?.fields?.showChallanNumber) : Boolean(previewInvoiceSettings?.showChallanNumber),
    ...(template?.fields || { }),
                          ...(template ? {
                            showLogo: template?.fields?.showLogo ?? (template as any)?.showLogo ?? true,
                          showSignature: template?.fields?.showSignature ?? (template as any)?.showSignature ?? true,
                          showCustomerDetails: template?.fields?.showCustomerDetails ?? (template as any)?.showCustomerDetails ?? true,
                          showItemTable: template?.fields?.showItemTable ?? (template as any)?.showItemTable ?? true,
                          showTotals: template?.fields?.showTotals ?? (template as any)?.showTotals ?? true,
                          showTaxSplit: template?.fields?.showTaxSplit ?? (template as any)?.showTaxSplit ?? true,
                          showHSN: template?.fields?.showHSN ?? (template as any)?.showHSN ?? (template as any)?.showTaxId ?? true,
                          showItemIndex: template?.fields?.showItemIndex ?? (template as any)?.showItemIndex ?? true,
                          showBatchNumber: template?.fields?.showBatchNumber ?? (template as any)?.showBatchNumber ?? true,
                          showExpMfgDates: template?.fields?.showExpMfgDates ?? (template as any)?.showExpMfgDates ?? true,
                          showSecondaryUnit: template?.fields?.showSecondaryUnit ?? (template as any)?.showSecondaryUnit ?? true,
                          showGstRateCol: template?.fields?.showGstRateCol ?? (template as any)?.showGstRateCol ?? true,
                          showItemRate: template?.fields?.showItemRate ?? (template as any)?.showItemRate ?? true,
                          showDiscountCol: template?.fields?.showDiscountCol ?? (template as any)?.showDiscountCol ?? true,
                          showItemQty: template?.fields?.showItemQty ?? (template as any)?.showItemQty ?? true,
                          showItemAmount: template?.fields?.showItemAmount ?? (template as any)?.showItemAmount ?? true,
                          showMRP: template?.fields?.showMRP ?? (template as any)?.showMRP ?? true,
                          showTime: template?.fields?.showTime ?? (template as any)?.showTime ?? true,
                          showPartyBalance: template?.fields?.showPartyBalance ?? (template as any)?.showPartyBalance ?? true,
                          showItemDescription: template?.fields?.showItemDescription ?? (template as any)?.showItemDescription ?? true,
                          showQR: template?.fields?.showQR ?? (template as any)?.showQrCode ?? true,
                          showTerms: template?.fields?.showTerms ?? (template as any)?.showTermsAndConditions ?? true,
                          showThankYou: template?.fields?.showThankYou ?? (template as any)?.showFooterNote ?? true,
                          showBillTo: template?.fields?.showBillTo ?? template?.party?.billTo?.showName ?? true,
                          showShipTo: template?.fields?.showShipTo ?? template?.party?.shipTo?.showName ?? true,
                          showPartyPhone: template?.fields?.showPartyPhone ?? template?.party?.billTo?.showPhone ?? true,
                          showPartyEmail: template?.fields?.showPartyEmail ?? template?.party?.billTo?.showEmail ?? true,
                          showPartyGstin: template?.fields?.showPartyGstin ?? template?.party?.billTo?.showGst ?? true,
                          showPartyPan: template?.fields?.showPartyPan ?? template?.party?.billTo?.showPan ?? true,
                          showPartyDlNumber: template?.fields?.showPartyDlNumber ?? (template?.fields as any)?.showPartyDl ?? true,
                          showPartyDl: template?.fields?.showPartyDlNumber ?? (template?.fields as any)?.showPartyDl ?? true,
                          showCustomerDl: template?.fields?.showPartyDlNumber ?? (template?.fields as any)?.showPartyDl ?? true,
                          showDlNumber: template?.fields?.showPartyDlNumber ?? (template?.fields as any)?.showPartyDl ?? true,
                          showCustomerEmail: template?.fields?.showPartyEmail ?? true,
                          showCustomerPhone: template?.fields?.showPartyPhone ?? true,
                          showCustomerGstin: template?.fields?.showPartyGstin ?? true,
                          showCustomerPan: template?.fields?.showPartyPan ?? true,
                          showPlaceOfSupply: template?.fields?.showPlaceOfSupply ?? (template as any)?.showPlaceOfSupply ?? true,
                          showContactPerson: template?.fields?.showContactPerson ?? (template as any)?.showContactPerson ?? true,
                          showBankDetails: template?.fields?.showBankDetails ?? (template as any)?.showBankDetails ?? true,
                          showDeclaration: template?.fields?.showDeclaration ?? (template as any)?.showDeclaration ?? true,
    } : { }),
  };
                          // THE SAME theme + renderer decision the print path uses
                          // (resolveInvoiceRenderer), so the live preview can no
                          // longer route a template to a different engine than
                          // print / PDF / WhatsApp do.
                          const { renderer: previewRenderer, theme: resolvedTheme } = resolveInvoiceRenderer(template);
                          const theme = resolvedTheme;

                          // ── Structural Layout Themes (Stylish, Luxury, Tally, BillBook, Modern, Simple, etc.) ──
                          const layoutTheme = template.themeName || "stylish";
                          const isLuxury = layoutTheme === "luxury";
                          const isTally = layoutTheme === "adv_tally" || layoutTheme === "classic";
                          const isStylish = layoutTheme === "stylish";
                          const isBillBook = layoutTheme === "billbook";
                          const isModern = layoutTheme === "modern";
                          const isSimple = layoutTheme === "simple";
                          const isCultureUp = layoutTheme === "culture_up";
                          const isCultureGod = layoutTheme === "culture_god";
                          const isMinimal = layoutTheme === "minimal";
                          const isElegant = layoutTheme === "elegant";
                          const isCompact = layoutTheme === "compact";
                          const isCleanSlate = layoutTheme === "clean_slate";
                          const isEmeraldCorp = layoutTheme === "emerald_corp";

                          // ── ThemeStore Background Art & Decorative Motifs ──
                          const decoId = template.decorativeThemeId || (
                          template.themeName === "jain" ? "ts-jain" :
                          template.themeName === "maharashtra" ? "ts-maharashtra" :
                          template.themeName === "ganesh" ? "ts-ganesh" :
                          template.themeName === "hindu_god" ? "ts-hindu-god" :
                          template.themeName === "shubh_labh" ? "ts-shubh-labh" :
                          template.themeName === "royal_gold" ? "ts-royal-gold" :
                          template.themeName === "corporate" ? "ts-corporate" : undefined
                          );
                          const isJain = decoId === "ts-jain";
                          const isMaharashtra = decoId === "ts-maharashtra";
                          const isGanesh = decoId === "ts-ganesh";
                          const isHinduGod = decoId === "ts-hindu-god";
                          const isShubhLabh = decoId === "ts-shubh-labh";
                          const isRoyalGold = decoId === "ts-royal-gold";
                          const isCorporate = decoId === "ts-corporate";

                          const isDecorativeTheme = isJain || isMaharashtra || isGanesh || isHinduGod || isShubhLabh || isRoyalGold || isCultureGod || isCultureUp;

                          const borderStyle = isTally
                          ? "border-2 border-double border-slate-900 rounded-lg"
                          : isMinimal
                          ? "border-0 shadow-sm rounded-2xl"
                          : isCleanSlate
                          ? "border border-slate-300 rounded-2xl"
                          : isRoyalGold
                          ? "border-2 border-amber-400/80 rounded-2xl"
                          : isCorporate
                          ? "border-2 border-indigo-200/80 rounded-2xl"
                          : isJain || isMaharashtra || isGanesh || isHinduGod || isShubhLabh
                          ? "border-2 border-amber-300/70 rounded-2xl"
                          : "border border-slate-200 rounded-2xl";

                          const isLandscape = template.orientation === "landscape";
                          const isInvoiceDoc = template.docType === "invoice" || template.category === "invoices";
                          const isA5 = template.paperSize === "A5";
                          const containerWidthClass = isLandscape
                          ? isA5
                          ? "w-full max-w-[794px] min-h-[559px]"
                          : "w-full max-w-[800px]"
                          : isA5
                          ? "w-full max-w-[559px] min-h-[794px]"
                          : isInvoiceDoc || template.paperSize === "A4"
                          ? "w-full max-w-[794px] min-h-[1080px]"
                          : template.paperSize === "A5"
                          ? "w-[420px] max-w-full"
                          : template.paperSize === "Letter"
                          ? "w-full max-w-[760px]"
                          : "w-[340px] sm:w-[360px] max-w-full";

                          const marginPaddingClass =
                          template.margins === "none"
                          ? "p-1.5"
                          : template.margins === "narrow"
                          ? "p-2.5"
                          : template.margins === "wide"
                          ? "p-6"
                          : "p-4 sm:p-5";

                          const activeBillingGst = getActiveBillingGst(tenant?.id);

                          const tenantRawObj = (tenant as any)?.raw || tenant || { };
                          const tenantAddress = (
                          tenant?.address ||
                          tenantRawObj?.address ||
                          tenantRawObj?.settings?.address ||
                          [tenantRawObj?.city || tenant?.city, tenantRawObj?.state || tenant?.state, tenantRawObj?.country || tenant?.country, tenantRawObj?.pincode || tenant?.pincode].filter(Boolean).join(', ')
                          ).trim();

                          const tenantPhone = (tenant?.phone || tenantRawObj?.phone || tenantRawObj?.settings?.phone || '').trim();
                          const tenantGstin = (tenant?.gst_number || tenant?.gstin || tenantRawObj?.gst_number || tenantRawObj?.gstin || tenantRawObj?.settings?.gstin || '').trim();

  const isDummyAddress = (addr?: string | null): boolean => {
    if (!addr || !addr.trim()) return true;
                          const lower = addr.toLowerCase().trim();
                          if (lower.includes('kk street') || lower.includes('123 commercial hub') || lower.includes('mandi road, proddatur') || lower.includes('apmc yard') || lower.includes('main market, proddatur') || lower.includes('hospital road, proddatur')) {
      return true;
    }
                          if (lower.includes('proddatur') && !tenantAddress.toLowerCase().includes('proddatur') && !activeBillingGst?.address?.toLowerCase().includes('proddatur')) {
      return true;
    }
                          return false;
  };

  const isDummyPhone = (ph?: string | null): boolean => {
    if (!ph || !ph.trim()) return true;
                          return ph.includes('9849344919') && !tenantPhone.includes('9849344919') && !activeBillingGst?.phone?.includes('9849344919');
  };

  const isDummyGstin = (gst?: string | null): boolean => {
    if (!gst || !gst.trim()) return true;
                          return (gst.includes('37AABCCH694G1Z4') || gst.includes('37AAFCOE694G1Z4') || gst.includes('37AAFC16694B1Z4')) &&
                          !tenantGstin.includes(gst) &&
                          !activeBillingGst?.gstin?.includes(gst);
  };

                          // Dynamic Store Name Resolution
                          const resolvedStoreName =
                          (template.storeName && template.storeName.trim() !== "" && !template.storeName.includes("Organization") && !template.storeName.includes("Smart Bazaar") ? template.storeName : "") ||
                          activeBillingGst?.trade_name ||
                          activeBillingGst?.legal_name ||
                          tenant?.name ||
                          template.storeName ||
                          "Store";

                          // Dynamic Logo Resolution
                          const resolvedLogoUrl = resolveImageUrl(template.logoUrl || activeBillingGst?.logo_url || tenant?.logo_url || (tenant as any)?.raw?.logo_url || "") || "/Logo.png";

                          // Dynamic Address Resolution
                          const resolvedAddress =
                          (template.storeAddress && !isDummyAddress(template.storeAddress) ? template.storeAddress : '') ||
                          (activeBillingGst?.address && !isDummyAddress(activeBillingGst.address) ? activeBillingGst.address : '') ||
                          (tenantAddress && !isDummyAddress(tenantAddress) ? tenantAddress : '') ||
                          template.storeAddress ||
                          activeBillingGst?.address ||
                          tenantAddress ||
                          '';

                          // Dynamic Phone Resolution
                          const resolvedPhone =
                          (template.storePhone && !isDummyPhone(template.storePhone) ? template.storePhone : '') ||
                          (activeBillingGst?.phone && !isDummyPhone(activeBillingGst.phone) ? activeBillingGst.phone : '') ||
                          (tenantPhone && !isDummyPhone(tenantPhone) ? tenantPhone : '') ||
                          template.storePhone ||
                          activeBillingGst?.phone ||
                          tenantPhone ||
                          '';

                          // Dynamic GSTIN Resolution
                          const resolvedGstin =
                          (template.gstin && !isDummyGstin(template.gstin) ? template.gstin : '') ||
                          (activeBillingGst?.gstin && !isDummyGstin(activeBillingGst.gstin) ? activeBillingGst.gstin : '') ||
                          (tenantGstin && !isDummyGstin(tenantGstin) ? tenantGstin : '') ||
                          template.gstin ||
                          '';

                          // ── Editable words + payment QR: must reach the theme components,
                          //    exactly like FullInvoicePrinter does, so the live preview
                          //    matches the real print / PDF / WhatsApp output.
                          const previewTexts = resolveInvoiceTexts(template, theme);
                          // ── Doc-type identity: drive the preview title / number from the
                          //    selected document slot so a quotation/proforma/estimate/
                          //    challan shows its OWN identity (never the tax invoice's).
                          //    The template's explicit headerTitle still wins when set.
                          const slotMeta = previewSlot ? A4_SLOT_PREVIEWS[previewSlot] : A4_SLOT_PREVIEWS.invoice;
                          const previewDocTitle = previewSlot && previewSlot !== "invoice" ? slotMeta.title : ((template as any)?.headerTitle || slotMeta.title);
                          const previewDocNoSafe = (() => {
                            const isQuote = previewSlot === "quotation";
                            const isProf = previewSlot === "proforma";
                            const isEst = previewSlot === "estimate";
                            const isChal = previewSlot === "challan";
                            const isCN = previewSlot === "credit_note";
                            const isDN = previewSlot === "debit_note";
                            const isPINV = previewSlot === "purchase_invoice";
                            const isPO = previewSlot === "purchase_order";
                            const isRec = previewSlot === "thermal" || (template as any)?.docType === "thermal" || (template as any)?.category === "thermal";

                            let pfx = isQuote
                              ? (liveInvoiceSettings.quotationPrefix || "QT-")
                              : isProf
                              ? (liveInvoiceSettings.proformaPrefix || "PI-")
                              : isEst
                              ? (liveInvoiceSettings.estimatePrefix || "EST-")
                              : isChal
                              ? (liveInvoiceSettings.challanPrefix || "DC-")
                              : isCN
                              ? (liveInvoiceSettings.creditNotePrefix || "CN-")
                              : isDN
                              ? (liveInvoiceSettings.debitNotePrefix || "DN-")
                              : isPINV
                              ? (liveInvoiceSettings.purchaseInvoicePrefix || "PINV-")
                              : isPO
                              ? (liveInvoiceSettings.purchaseOrderPrefix || "PO-")
                              : isRec
                              ? (liveInvoiceSettings.receiptPrefix || "REC-")
                              : (liveInvoiceSettings.prefix || slotMeta.noPrefix || "INV-");

                            if (!pfx.endsWith("-") && !pfx.endsWith("/")) {
                              pfx = `${pfx}-`;
                            }

                            const seq = isQuote
                              ? (liveInvoiceSettings.quotationSequenceNumber || 1)
                              : isProf
                              ? (liveInvoiceSettings.proformaSequenceNumber || 1)
                              : isEst
                              ? (liveInvoiceSettings.estimateSequenceNumber || 1)
                              : isChal
                              ? (liveInvoiceSettings.challanSequenceNumber || 1)
                              : isCN
                              ? (liveInvoiceSettings.creditNoteSequenceNumber || 1)
                              : isDN
                              ? (liveInvoiceSettings.debitNoteSequenceNumber || 1)
                              : isPINV
                              ? (liveInvoiceSettings.purchaseInvoiceSequenceNumber || 1)
                              : isPO
                              ? (liveInvoiceSettings.purchaseOrderSequenceNumber || 1)
                              : isRec
                              ? (liveInvoiceSettings.receiptSequenceNumber || 1)
                              : (liveInvoiceSettings.sequenceNumber || 1);

                            const pad = isQuote
                              ? (liveInvoiceSettings.quotationPadding ?? 4)
                              : isProf
                              ? (liveInvoiceSettings.proformaPadding ?? 4)
                              : isEst
                              ? (liveInvoiceSettings.estimatePadding ?? 4)
                              : isChal
                              ? (liveInvoiceSettings.challanPadding ?? 4)
                              : isCN
                              ? (liveInvoiceSettings.creditNotePadding ?? 4)
                              : isDN
                              ? (liveInvoiceSettings.debitNotePadding ?? 4)
                              : isPINV
                              ? (liveInvoiceSettings.purchaseInvoicePadding ?? 4)
                              : isPO
                              ? (liveInvoiceSettings.purchaseOrderPadding ?? 4)
                              : isRec
                              ? (liveInvoiceSettings.receiptPadding ?? 5)
                              : (liveInvoiceSettings.padding ?? 4);

                            const sfx = (!isQuote && !isProf && !isEst && !isChal && !isCN && !isDN && !isPINV && !isPO && !isRec)
                              ? (liveInvoiceSettings.suffix || "")
                              : "";

                            return `${pfx}${String(seq).padStart(pad, "0")}${sfx}`;
                          })();

                          const previewPaymentQr: PaymentQrContext = (() => {
                            const qrSettings = getOrgPaymentQrSettings(tenant?.id);
                            const upiVpa = ((template as any)?.upiId || qrSettings?.vpa || activeBillingGst?.upi_vpa || "").trim();
                            const customQr = (template as any)?.customQrUrl || (qrSettings?.type === 'custom_image' ? qrSettings?.customImageUrl : null);
                            const hasValidUpi = Boolean(upiVpa && upiVpa.includes('@'));
                            const hasRealSource = Boolean(customQr || hasValidUpi);
                            const enabled = f.showQR !== false && hasRealSource;
                            const src = !enabled
                              ? ""
                              : customQr
                                ? customQr
                                : generateQRCodeSVG(
                                    buildUpiPayUrl({
                                      vpa: upiVpa,
                                      payeeName: (template as any)?.payeeName || qrSettings?.payeeName || resolvedStoreName || "Store Merchant",
                                      amount: 51262,
                                      invoiceNumber: previewDocNoSafe,
                                    }),
                                    160,
                                  );
                            return { enabled, src, vpa: upiVpa, targetAmount: 51262, balanceDue: 51262, isPaidInFull: false };
                          })();
                          // Real bank line: prefer structured bank fields, then template string,
                          // then active GST bank, never hardcoded numbers.
                          const structuredBank = [
                            template?.bankName ? `Bank: ${template.bankName}` : "",
                            template?.accountNumber ? `A/C: ${template.accountNumber}` : "",
                            template?.ifscCode ? `IFSC: ${template.ifscCode}` : "",
                            template?.branchName ? `Branch: ${template.branchName}` : "",
                            template?.accountHolderName ? `Holder: ${template.accountHolderName}` : "",
                          ].filter(Boolean).join(" | ");

                          const previewBank =
                            structuredBank ||
                            (template?.bankDetails || "").trim() ||
                            (bankAccounts && bankAccounts.length > 0 && bankAccounts[0]
                              ? `Bank: ${bankAccounts[0].bank_name || bankAccounts[0].name} | A/C: ${bankAccounts[0].account_number || ""} | IFSC: ${bankAccounts[0].ifsc_code || ""}`
                              : "") ||
                            (activeBillingGst?.bank_name
                              ? `Bank: ${activeBillingGst.bank_name} | A/C: ${activeBillingGst?.bank_account_number || ""} | IFSC: ${activeBillingGst?.bank_ifsc || ""}`
                              : "");

                          // ─── 0. THERMAL RECEIPT LIVE PREVIEW ENGINE (80mm / 58mm Pure Black High-Contrast) ───
                          if (template.docType === "thermal" || template.category === "thermal") {
    const is58mm = template.paperSize === "58mm";
                          const rollWidth = is58mm ? "w-[300px] sm:w-[320px] max-w-full" : "w-[370px] sm:w-[400px] max-w-full";
                          const fontDensityClass =
                          template.fontDensity === "compact"
                          ? "text-[11px] leading-tight space-y-1.5"
                          : template.fontDensity === "large"
                          ? "text-[14px] leading-relaxed space-y-3"
                          : "text-[12px] leading-snug space-y-2";

                          const thermalFont =
                          template.thermalFontFamily === "sans-serif"
                          ? "font-sans"
                          : template.thermalFontFamily === "terminal"
                          ? "font-mono tracking-tight"
                          : template.thermalFontFamily === "courier"
                          ? "font-serif"
                          : "font-mono";

                          const dividerChar =
                          template.dividerStyle === "solid"
                          ? "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                          : template.dividerStyle === "double"
                          ? "══════════════════════════════"
                          : template.dividerStyle === "dotted"
                          ? "······························"
                          : template.dividerStyle === "star"
                          ? "******************************"
                          : "------------------------------";

    const enabledCustomFields = (template.customFields || []).filter((field) => field.enabled !== false && field.label);
    const enabledCustomColumns = (template.customItemColumns || []).filter((col) => col.enabled !== false && col.label);

                          return (
                          <div className="flex flex-col items-center py-4 w-full">
                            {/* Interactive Direct Thermal Print Bar */}
                            <div className="mb-3 flex items-center justify-between gap-2 w-full max-w-[350px] px-2 py-1.5 bg-slate-900 text-white rounded-xl shadow-md border border-slate-700 text-xs">
                              <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-[10px] font-bold text-slate-300">
                                  {is58mm ? "58mm Mini Roll" : "80mm Standard Roll"}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  triggerThermalPrint("preview-thermal-paper", {
                                    width: is58mm ? "58mm" : "80mm",
                                    contrast: (template.thermalContrast as any) || "ultra-dark",
                                    safeFeedMarginMm: template.feedAfterPrint !== false ? 20 : 0,
                                    autoCut: template.autoCutPaper !== false,
                                  });
                                  toast.success("Sending to Thermal POS Printer...");
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] shadow-sm transition-transform active:scale-95 cursor-pointer"
                              >
                                <Printer className="h-3 w-3" />
                                Direct Thermal Print
                              </button>
                            </div>

                            {/* Paper roll container with id="preview-thermal-paper" for instant ESC/POS printer capture */}
                            <div
                              id="preview-thermal-paper"
                              className={`${rollWidth} bg-white text-black p-4 shadow-2xl border border-slate-300 rounded-sm ${fontDensityClass} ${thermalFont}`}
                              style={{
                                color: "#000000",
                                backgroundColor: "#ffffff",
                                WebkitPrintColorAdjust: "exact",
                                printColorAdjust: "exact",
                                WebkitFontSmoothing: "none",
                                fontWeight: template.thermalContrast === "ultra-dark" ? 800 : 700,
                              }}
                            >
                              {/* Top Tear Edge */}
                              <div className="w-full text-center text-slate-400 text-[8px] tracking-widest select-none -mt-2 mb-2">
                                ✂ - - - - - - - - - - - - - - - - - - - ✂
                              </div>

                              {/* Store Header */}
                              <div className="text-center space-y-0.5">
                                {f.showLogo !== false && (template.logoUrl || resolvedLogoUrl) && (
                                  <div className="flex justify-center mb-1.5">
                                    <img
                                      src={template.logoUrl || resolvedLogoUrl}
                                      alt="Thermal Logo"
                                      className="h-11 w-auto max-w-[140px] object-contain filter grayscale contrast-200"
                                    />
                                  </div>
                                )}
                                {template.showStoreName !== false && (
                                  <h1 className="font-black text-sm uppercase tracking-wide text-black">{resolvedStoreName}</h1>
                                )}
                                {template.showBranch !== false && template.branchName && !template.branchName.toUpperCase().includes("PRODDATUR") && (
                                  <p className="font-bold text-[10px] uppercase text-black">{template.branchName}</p>
                                )}
                                {template.showTagline !== false && template.customTaglineText && (
                                  <p className="italic text-[10px] text-black font-semibold">{template.customTaglineText}</p>
                                )}
                                {template.showAddress !== false && resolvedAddress && (
                                  <p className="font-semibold text-[10px] text-black">{resolvedAddress}</p>
                                )}
                                {template.showPhone !== false && resolvedPhone && (
                                  <p className="font-bold text-[10px] text-black">PH: {resolvedPhone}</p>
                                )}
                                {template.showGstin !== false && (f.showCompanyDetails !== false) && resolvedGstin && (
                                  <p className="font-bold text-[10px] text-black">GSTIN: {resolvedGstin}</p>
                                )}

                                {/* Dynamic Custom Header Fields (DL No, FSSAI, Doctor, etc.) */}
                                {enabledCustomFields.length > 0 && (
                                  <div className="pt-1 space-y-0.5 border-t border-dotted border-black mt-1">
                                    {enabledCustomFields.map((field) => (
                                      <p key={field.id} className="font-bold text-[10px] text-black">
                                        {field.label.toUpperCase()}: {field.value}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="text-center overflow-hidden whitespace-nowrap font-black select-none text-[10px] text-black my-1">
                                {dividerChar}
                              </div>

                              {/* Title & Metadata */}
                              <div className="text-center">
                                <span className="font-black text-xs uppercase px-2.5 py-0.5 border-2 border-black rounded inline-block text-black tracking-wider">
                                  {previewDocTitle}
                                </span>
                              </div>

                              <div className="flex justify-between items-center text-[10px] font-bold text-black pt-1">
                                <span>INV: #POS-2026-0042</span>
                                <span>DATE: {formatDisplayDate(new Date().toISOString())}</span>
                              </div>

                              <div className="flex justify-between items-center text-[10px] font-semibold text-black">
                                {template.showCashierName !== false && (
                                  <span>CASHIER: Main Terminal</span>
                                )}
                                <span>TIME: 14:30 PM</span>
                              </div>

                              {/* PO, E-Way, Vehicle, Challan Metadata */}
                              {(template.showPoNumber !== false || template.showEwayBill !== false || template.showVehicleNumber !== false || template.showChallanNumber !== false) && (
                                <div className="pt-1 text-[9.5px] font-bold text-black space-y-0.5">
                                  {template.showPoNumber !== false && <div className="flex justify-between"><span>PO NO:</span><span>PO-89211</span></div>}
                                  {template.showEwayBill !== false && <div className="flex justify-between"><span>E-WAY BILL:</span><span>2418-9201-9920</span></div>}
                                  {template.showVehicleNumber !== false && <div className="flex justify-between"><span>VEHICLE NO:</span><span>AP-04-TX-4412</span></div>}
                                  {template.showChallanNumber !== false && <div className="flex justify-between"><span>CHALLAN NO:</span><span>DC-2026-092</span></div>}
                                </div>
                              )}

                              {f.showCustomerDetails !== false && (
                                <div className="pt-1 border-t border-dashed border-black mt-1">
                                  <p className="font-bold text-[10px] text-black">CUSTOMER: Walk-in Retail Customer</p>
                                  {template.showCustomerPhone !== false && (
                                    <p className="font-semibold text-[10px] text-black">MOB: +91 9876543210</p>
                                  )}
                                  {template.showCustomerGstin !== false && (
                                    <p className="font-semibold text-[10px] text-black">GSTIN: {resolvedGstin || "Unregistered"}</p>
                                  )}
                                  {template.showCustomerAddress !== false && resolvedAddress && (
                                    <p className="font-medium text-[9.5px] text-black">ADDR: {resolvedAddress.split(',')[0]}</p>
                                  )}
                                </div>
                              )}

                              <div className="text-center overflow-hidden whitespace-nowrap font-black select-none text-[10px] text-black my-1">
                                {dividerChar}
                              </div>

                              {/* Items Header */}
                              <div className="grid grid-cols-12 font-black text-[10px] uppercase border-b-2 border-black pb-0.5 text-black">
                                <span className="col-span-6 text-left">ITEM</span>
                                <span className="col-span-2 text-center">QTY</span>
                                <span className="col-span-2 text-right">RATE</span>
                                <span className="col-span-2 text-right">AMT</span>
                              </div>

                              {/* Sample Items List */}
                              <div className="space-y-1.5 py-1">
                                {/* Item 1 */}
                                <div className="space-y-0.5">
                                  <div className="grid grid-cols-12 font-bold text-[10px] text-black">
                                    <span className="col-span-6 text-left truncate">
                                      {f.showItemIndex !== false ? "1. " : ""}Basmati Rice 5kg
                                    </span>
                                    <span className="col-span-2 text-center">1 Pkg</span>
                                    <span className="col-span-2 text-right">₹480</span>
                                    <span className="col-span-2 text-right">₹480</span>
                                  </div>
                                  {f.showDescription !== false && (
                                    <div className="text-[9px] text-black/80 font-medium pl-3 italic">
                                      Premium Long Grain Aged Rice
                                    </div>
                                  )}
                                  {(f.showHSN !== false || template.showBatchNumber !== false || template.showExpiryDate !== false) && (
                                    <div className="text-[9px] text-black font-semibold pl-3">
                                      {f.showHSN !== false ? "HSN: 1006 " : ""}
                                      {template.showBatchNumber !== false ? "| Batch: BR-992 " : ""}
                                      {template.showExpiryDate !== false ? "| EXP: 12/2027" : ""}
                                    </div>
                                  )}
                                  {f.showMRP !== false && (
                                    <div className="text-[9px] text-black font-medium pl-3">
                                      MRP: ₹550 | Saved: ₹70 (12% OFF)
                                    </div>
                                  )}
                                  {enabledCustomColumns.length > 0 && (
                                    <div className="flex flex-wrap gap-1 pl-3 pt-0.5 text-[8.5px] font-bold text-black">
                                      {enabledCustomColumns.map((col) => (
                                        <span key={col.id} className="border border-black px-1 rounded-xs">
                                          {col.label}: A-12
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Item 2 */}
                                <div className="space-y-0.5">
                                  <div className="grid grid-cols-12 font-bold text-[10px] text-black">
                                    <span className="col-span-6 text-left truncate">
                                      {f.showItemIndex !== false ? "2. " : ""}Sunflower Oil 1L
                                    </span>
                                    <span className="col-span-2 text-center">2 Pcs</span>
                                    <span className="col-span-2 text-right">₹145</span>
                                    <span className="col-span-2 text-right">₹290</span>
                                  </div>
                                  {(f.showHSN !== false || template.showBatchNumber !== false) && (
                                    <div className="text-[9px] text-black font-semibold pl-3">
                                      {f.showHSN !== false ? "HSN: 1512 " : ""}
                                      {template.showBatchNumber !== false ? "| Batch: SF-201" : ""}
                                    </div>
                                  )}
                                  {f.showMRP !== false && (
                                    <div className="text-[9px] text-black font-medium pl-3">
                                      MRP: ₹170 | Saved: ₹50 (14% OFF)
                                    </div>
                                  )}
                                  {enabledCustomColumns.length > 0 && (
                                    <div className="flex flex-wrap gap-1 pl-3 pt-0.5 text-[8.5px] font-bold text-black">
                                      {enabledCustomColumns.map((col) => (
                                        <span key={col.id} className="border border-black px-1 rounded-xs">
                                          {col.label}: R-04
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Item 3 */}
                                <div className="space-y-0.5">
                                  <div className="grid grid-cols-12 font-bold text-[10px] text-black">
                                    <span className="col-span-6 text-left truncate">
                                      {f.showItemIndex !== false ? "3. " : ""}Parle-G Biscuit
                                    </span>
                                    <span className="col-span-2 text-center">4 Pcs</span>
                                    <span className="col-span-2 text-right">₹25</span>
                                    <span className="col-span-2 text-right">₹100</span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-center overflow-hidden whitespace-nowrap font-black select-none text-[10px] text-black my-1">
                                {dividerChar}
                              </div>

                              {/* Totals Section */}
                              <div className="space-y-0.5 font-bold text-[10px] text-black">
                                {template.showTotalQuantity !== false && (
                                  <div className="flex justify-between font-black text-[10.5px]">
                                    <span>TOTAL ITEMS / BILLED QTY:</span>
                                    <span>3 Items / 7 Units</span>
                                  </div>
                                )}
                                <div className="flex justify-between">
                                  <span>SUBTOTAL:</span>
                                  <span>₹870.00</span>
                                </div>
                                {template.showTotalSavings !== false && (
                                  <div className="flex justify-between font-black">
                                    <span>TOTAL SAVINGS TODAY:</span>
                                    <span>- ₹120.00 (12.1% OFF)</span>
                                  </div>
                                )}
                                {f.showTaxSplit !== false && (
                                  <div className="pt-0.5 border-t border-dotted border-black mt-0.5 space-y-0.5 text-[9.5px]">
                                    <div className="flex justify-between">
                                      <span>Taxable Amount:</span>
                                      <span>₹750.00</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Central GST (CGST 2.5%):</span>
                                      <span>₹18.75</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>State GST (SGST 2.5%):</span>
                                      <span>₹18.75</span>
                                    </div>
                                    <div className="flex justify-between font-black">
                                      <span>Total Tax (GST):</span>
                                      <span>₹37.50</span>
                                    </div>
                                  </div>
                                )}
                                <div className="flex justify-between items-center text-sm font-black border-y-2 border-black py-1 mt-1 text-black">
                                  <span>NET PAYABLE:</span>
                                  <span className="text-base">₹870.00</span>
                                </div>
                              </div>

                              {/* PAID IN FULL Stamp Badge */}
                              {template.showPaidInFullStamp !== false && (
                                <div className="my-2 flex justify-center">
                                  <div className="border-2 border-dashed border-black px-4 py-1 rounded text-center rotate-[-3deg]">
                                    <span className="text-xs font-black tracking-widest uppercase block">★ PAID IN FULL ★</span>
                                    <span className="text-[8px] font-bold block">ALL DUES CLEARED</span>
                                  </div>
                                </div>
                              )}

                              {/* Payment Details */}
                              {f.showPaymentDetails !== false && (
                                <div className="pt-1 space-y-0.5 text-[10px] font-bold text-black border-t border-dotted border-black mt-1">
                                  <div className="flex justify-between">
                                    <span>PAID VIA:</span>
                                    <span>CASH / UPI (COMPLETED)</span>
                                  </div>
                                  <div className="flex justify-between font-black">
                                    <span>AMOUNT RECEIVED:</span>
                                    <span>₹1000.00</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>CHANGE RETURNED:</span>
                                    <span>₹130.00</span>
                                  </div>
                                </div>
                              )}

                              {/* Customer Outstanding Balance */}
                              {f.showPartyBalance !== false && (
                                <div className="pt-1 border-t border-dotted border-black flex justify-between text-[10px] font-bold text-black">
                                  <span>CUSTOMER LEDGER OUTSTANDING:</span>
                                  <span>₹0.00</span>
                                </div>
                              )}

                              {/* Dynamic UPI Payment QR Code */}
                              {f.showQR !== false && (template.upiId || activeBillingGst?.upi_vpa) && (
                                <div className="text-center pt-2 space-y-1 flex flex-col items-center border-t border-dashed border-black mt-2">
                                  {template.customQrUrl ? (
                                    <img
                                      src={template.customQrUrl}
                                      alt="UPI QR"
                                      className="h-24 w-24 object-contain filter contrast-200"
                                    />
                                  ) : (
                                    <img
                                      src={generateQRCodeSVG(
                                        buildUpiPayUrl({
                                          vpa: template.upiId || activeBillingGst?.upi_vpa || "",
                                          payeeName: template.payeeName || resolvedStoreName,
                                          amount: "870.00",
                                          invoiceNumber: "POS-2026-0042",
                                          transactionNote: "POS-2026-0042",
                                        }),
                                        96
                                      )}
                                      alt="UPI QR"
                                      className="h-24 w-24 object-contain filter contrast-200"
                                    />
                                  )}
                                  <p className="text-[9px] font-black uppercase text-black">SCAN TO PAY VIA UPI / GPAY</p>
                                  <p className="text-[8px] font-mono text-black">{template.upiId || activeBillingGst?.upi_vpa}</p>
                                </div>
                              )}

                              {/* Google Review 5-Star Feedback QR Code */}
                              {template.showGoogleReviewQR !== false && (template.googleReviewUrl || activeBillingGst?.google_review_url) && (
                                <div className="text-center pt-2 pb-1 space-y-1 flex flex-col items-center border-t border-dashed border-black mt-2">
                                  <div className="flex items-center justify-center gap-0.5 text-black">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                      <span key={s} className="text-xs font-black">★</span>
                                    ))}
                                  </div>
                                  <p className="text-[9.5px] font-black uppercase tracking-wider text-black">Rate Your Experience</p>
                                  <img
                                    src={generateQRCodeSVG(
                                      template.googleReviewUrl || activeBillingGst?.google_review_url || `https://search.google.com/local/writereview?placeid=${resolvedStoreName}`,
                                      80
                                    )}
                                    alt="Google Review QR"
                                    className="h-20 w-20 object-contain filter contrast-200"
                                  />
                                  <p className="text-[8px] font-bold text-black uppercase">Scan to Leave a 5-Star Google Review!</p>
                                </div>
                              )}

                              {/* Digital Signature & Company Stamp */}
                              {template.showSignature !== false && (
                                <div className="pt-2 border-t border-dashed border-black mt-2 flex justify-between items-end">
                                  {template.stampUrl ? (
                                    <div className="h-12 w-16 flex items-center justify-center">
                                      <img src={template.stampUrl} alt="Stamp" className="max-h-full max-w-full object-contain filter grayscale contrast-200" />
                                    </div>
                                  ) : <div />}

                                  <div className="text-right space-y-0.5">
                                    {template.signatureUrl && (
                                      <div className="flex justify-end mb-1">
                                        <img src={template.signatureUrl} alt="Signature" className="h-8 max-w-[100px] object-contain filter grayscale contrast-200" />
                                      </div>
                                    )}
                                    <p className="text-[9px] font-bold text-black">
                                      {template.signatoryLabel || `For ${resolvedStoreName}`}
                                    </p>
                                    <p className="text-[8px] font-semibold text-black uppercase">Authorized Signatory</p>
                                  </div>
                                </div>
                              )}

                              <div className="text-center overflow-hidden whitespace-nowrap font-black select-none text-[10px] text-black my-1">
                                {dividerChar}
                              </div>

                              {/* Terms & Conditions & Statutory GST Declaration */}
                              {f.showTerms !== false && (
                                <div className="text-[8.5px] font-mono text-black space-y-0.5 py-1">
                                  <p className="font-bold uppercase underline">Terms & Conditions:</p>
                                  <p className="whitespace-pre-line leading-tight">
                                    {template.termsAndConditionsText || template.termsText || "1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction only."}
                                  </p>
                                </div>
                              )}

                              {template.showDeclaration !== false && template.declarationText && (
                                <div className="text-[8px] font-mono text-black italic py-0.5 border-t border-dotted border-black">
                                  {template.declarationText}
                                </div>
                              )}

                              {/* Footer Note & Barcode */}
                              <div className="text-center space-y-1 pt-1">
                                <p className="font-black text-[11px] uppercase text-black">
                                  {template.thankYouNote || template.footerText || "THANK YOU! VISIT AGAIN"}
                                </p>
                                {(template.footerNote || (template.footerText && template.footerText !== template.thankYouNote)) && (
                                  <p className="text-[9px] text-black font-semibold italic">
                                    {template.footerNote || template.footerText}
                                  </p>
                                )}

                                {f.showBarcode !== false && (
                                  <div className="pt-1.5 flex flex-col items-center">
                                    <RealBarcodeSvg
                                      value="POS20260042"
                                      format={template.barcodeSymbology === "EAN-13" ? "EAN13" : "CODE128"}
                                      height={template.barcodeHeight || 28}
                                      displayValue={true}
                                      fontSize={9}
                                      className="filter contrast-200"
                                    />
                                  </div>
                                )}
                              </div>

                              {/* Bottom Tear Edge */}
                              <div className="w-full text-center text-slate-400 text-[8px] tracking-widest select-none mt-3 -mb-2">
                                ✂ - - - - - - - - - - - - - - - - - - - ✂
                              </div>
                            </div>
                          </div>
                          );
  }

                          // 1. A4 COMMERCIAL DOCUMENT PREVIEW ENGINE (Invoices, Quotations, Proformas, Challans)
                          if (
                            template.docType === "invoice" ||
                            template.category === "invoices" ||
                            template.docType === "challan" ||
                            template.category === "challan" ||
                            template.docType === "quotation" ||
                            template.docType === "proforma" ||
                            template.docType === "custom" ||
                            template.category === "custom" ||
                            isInvoicesFamilyDocType(template.docType)
                          ) {
    // ── Check if Word-Style Designer or Global Template ──
    // Routed by the SHARED resolver (same decision as the print path), so a
    // named theme with an attached wordConfig no longer flips to the Word
    // mock here while print keeps the named design.
    if (previewRenderer === "word") {
      const wordMockInvoice: FullInvoiceData = {
                            id: "mock-inv-word-01",
                          invoice_number: (template as any).wordConfig?.invoiceNumberValue || previewDocNoSafe,
                          invoice_date: new Date().toISOString(),
                          due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
                          customerName: (template as any).wordConfig?.customerName || "Sri Sai Supermarket & Retailers",
                          customerCompany: (template as any).wordConfig?.customerName || "Sri Sai Supermarket & Retailers",
                          customerGST: (template as any).wordConfig?.customerGstin || "36BBBPB4321B1Z2",
                          customerBillingAddress: (template as any).wordConfig?.customerAddress || "Door No 4/12, Market Road, Hyderabad, Telangana - 500001",
                          customerShippingAddress: (template as any).wordConfig?.shippingAddress || "Plot 88, Phase 2, Logistics Park, Hyderabad, Telangana - 500034",
                          customerShippingName: (template as any).wordConfig?.shippingName || (template as any).wordConfig?.customerName || "Sri Sai Supermarket & Retailers",
                          customerPhone: (template as any).wordConfig?.customerPhone || "+91 91234 56789",
        po_number: (template as any).wordConfig?.customFields?.find((f: any) => f.id === "cf_po" || f.label?.toLowerCase()?.includes("po"))?.value || "PO-2026-9921",
        vehicle_number: (template as any).wordConfig?.customFields?.find((f: any) => f.id === "cf_veh" || f.label?.toLowerCase()?.includes("veh"))?.value || "TS 09 EA 4412",
        eway_bill_number: (template as any).wordConfig?.customFields?.find((f: any) => f.id === "cf_eway" || f.label?.toLowerCase()?.includes("eway"))?.value || "241098234190",
        challan_number: (template as any).wordConfig?.customFields?.find((f: any) => f.id === "cf_challan" || f.label?.toLowerCase()?.includes("challan"))?.value || "DC-0045",
                          custom_fields: (template as any).wordConfig?.customFields || (template as any).customFields || [],
                          invoice_custom_fields: (template as any).wordConfig?.customFields || (template as any).customFields || [],
                          place_of_supply: (template as any).wordConfig?.placeOfSupplyValue || "36 - Telangana",
                          items: [
                          {
                            product_name: "Basmati Rice Royal Premium (Aged 2 Years)",
                          description: "Export Quality Double Polished Grain (Batch #R-2021)",
                          quantity: 5,
                          unit_price: 2450.0,
                          mrp: 2800.0,
                          hsn_code: "10063020",
                          tax_rate: 5,
                          subtotal: 12250.0,
                          selected_uom: "Bag",
                          uom: "Bag",
                          measuring_unit: "Bag",
                          secondary_uom: "25kg",
          },
                          {
                            product_name: "Organic Cold Pressed Mustard Oil (15L Tin)",
                          description: "Kachi Ghani single cold press pure mustard oil",
                          quantity: 2,
                          unit_price: 2150.0,
                          mrp: 2400.0,
                          hsn_code: "15141190",
                          tax_rate: 5,
                          subtotal: 4300.0,
                          selected_uom: "Tin",
                          uom: "Tin",
                          measuring_unit: "Tin",
                          secondary_uom: "15L",
          },
                          {
                            product_name: "Whole Spices Combo Pack (Export Grade)",
                          description: "Cardamom 100g, Clove 100g, Cinnamon 200g",
                          quantity: 10,
                          unit_price: 560.0,
                          mrp: 650.0,
                          hsn_code: "09083100",
                          tax_rate: 12,
                          subtotal: 5600.0,
                          selected_uom: "Pcs",
                          uom: "Pcs",
                          measuring_unit: "Pcs",
                          discount_value: 0,
          },
                          {
                            product_name: "Promotional Tasting Sample (Darjeeling Tea 50g)",
                          description: "Complimentary promo sample given free with bulk order",
                          quantity: 2,
                          unit_price: 0,
                          original_unit_price: 150.0,
                          mrp: 150.0,
                          hsn_code: "09024020",
                          tax_rate: 0,
                          subtotal: 0,
                          selected_uom: "Pcs",
                          uom: "Pcs",
                          is_free: true,
          },
                          ],
                          taxable_value: 22150.0,
                          cgst_amount: 602.5,
                          sgst_amount: 602.5,
                          tax_amount: 1205.0,
                          grand_total: 23355.0,
                          amount_received: 23355.0,
      };

                          return (
                          <div className={`relative overflow-hidden ${containerWidthClass} bg-transparent`}>
                            <WordInvoiceDocument
                              invoice={wordMockInvoice}
                              wordConfig={(template as any).wordConfig}
                              dynamicStoreName={resolvedStoreName}
                              dynamicLogoUrl={resolvedLogoUrl}
                              dynamicAddress={resolvedAddress}
                              dynamicPhone={resolvedPhone}
                              dynamicEmail={activeBillingGst?.email || ""}
                              sellerGstin={resolvedGstin}
                              sellerStateCode={activeBillingGst?.state_code || "36"}
                              currency={currency}
                              f={f}
                              template={template}
                            />
                          </div>
                          );
    }

                          // ── Check if Exact PDF Stationery Overlay Template ──
                          if (previewRenderer === "pdf_overlay") {
      const overlayMockInvoice: FullInvoiceData = {
                            invoice_number: previewDocNoSafe,
                          invoice_date: new Date().toISOString(),
                          due_date: new Date().toISOString(),
                          customerName: "Acme Retail Enterprises",
                          customerCompany: "ACME Enterprises Pvt Ltd",
                          customerGST: "09BBBBA9999C1Z2",
                          customerBillingAddress: "45 Tech Boulevard, Sector 62, Noida, UP",
                          customerShippingAddress: "Plot 12, Industrial Area, Sector 63, Noida, UP",
                          customerPhone: "+91 98765 43210",
                          items: [
                          {product_name: "Samsung Galaxy A30", description: "6.4-inch display, 4GB RAM, Dual Camera setup, 4000mAh Battery.", quantity: 1, unit_price: 12000.0, mrp: 14000.0, tax_rate: 18, subtotal: 10620.0 },
                          {product_name: "Parle-G Biscuit 200g", description: "Crispy glucose biscuits packed with wheat & milk energy.", quantity: 1, unit_price: 400.0, mrp: 450.0, tax_rate: 18, subtotal: 342.86 },
                          ],
                          taxable_value: 11497.0,
                          cgst_amount: 1034.73,
                          sgst_amount: 1034.73,
                          tax_amount: 2069.46,
                          grand_total: 13566.46,
                          amount_received: 13566.46,
      };
                          return (
                          <div className="w-[700px] bg-white shadow-2xl">
                            <PdfStationeryOverlayTemplate
                              invoice={overlayMockInvoice}
                              dynamicStoreName={resolvedStoreName}
                              dynamicLogoUrl={resolvedLogoUrl}
                              dynamicAddress={resolvedAddress}
                              dynamicPhone={resolvedPhone}
                              dynamicEmail=""
                              sellerGstin={resolvedGstin}
                              sellerStateCode={activeBillingGst?.state_code || "37"}
                              currency={currency}
                              f={f}
                              template={template}
                            />
                          </div>
                          );
    }

                          // ── Check if Custom Replica Template (Marg Pharma) ──
                          if (previewRenderer === "marg_pharma") {
      const margMockInvoice: FullInvoiceData = {
                            id: "mock-marg-01",
                          invoice_number: previewDocNoSafe,
                          invoice_date: "2026-08-11",
                          due_date: "2026-08-11",
                          created_at: "2026-08-11T10:00:00Z",
                          customerName: "ACME Enterprises Pvt Ltd",
                          customerCompany: "ACME Medical Store",
                          customerAddress: "45 Tech Boulevard, Sector 62, Noida, UP",
                          customerShippingAddress: "Plot 12, Industrial Area, Sector 63, Noida, UP",
                          customerPhone: "9876543210",
                          customerGST: "09BBBBA9999C1Z2",
                          taxable_value: 11497.0,
                          cgst_amount: 1034.73,
                          sgst_amount: 1034.73,
                          tax_amount: 2069.46,
                          grand_total: 13566.46,
                          items: [
                          {
                            product_name: "Samsung Galaxy A30",
                          quantity: 1,
                          unit_price: 12000.0,
                          mrp: 14000.0,
                          hsn_code: "85171200",
                          tax_rate: 18,
                          subtotal: 10620.0,
          },
                          {
                            product_name: "Parle-G Biscuit 200g",
                          quantity: 1,
                          unit_price: 400.0,
                          mrp: 450.0,
                          hsn_code: "19059090",
                          tax_rate: 18,
                          subtotal: 342.86,
          },
                          ],
      };
                          return (
                          <div
                            className={`relative overflow-hidden ${containerWidthClass} ${marginPaddingClass} shadow-xl ${borderStyle}`}
                            style={{
                              fontFamily: template.fontFamily,
                              backgroundColor: template.paperBgColor || (isDecorativeTheme ? "#fffdf5" : "#ffffff"),
                              borderTop: isStylish || isCultureUp || isCultureGod || isElegant || isEmeraldCorp || isMaharashtra || isGanesh || isHinduGod || isShubhLabh || isRoyalGold || isJain ? `5px solid ${template.primaryColor}` : undefined,
                            }}
                          >
                            {isJain && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-amber-800 bg-amber-100/70 py-0.5 rounded border border-amber-300/80 mb-2 shadow-2xs">
                                ॥ ॐ नमो जिनानाम् ॥ अहिंसा परमो धर्मः ॥
                              </div>
                            )}
                            {isMaharashtra && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-orange-900 bg-orange-100/80 py-0.5 rounded border border-orange-300/80 mb-2 shadow-2xs">
                                🚩 ॥ जय भवानी जय शिवाजी ॥ जय महाराष्ट्र ॥ 🚩
                              </div>
                            )}
                            {isGanesh && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-amber-900 bg-amber-100/80 py-0.5 rounded border border-amber-300/80 mb-2 shadow-2xs">
                                🕉️ ॥ श्री गणेशाय नमः ॥ ॐ गं गणपतये नमः ॥ ✨
                              </div>
                            )}
                            {isHinduGod && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-red-900 bg-red-100/70 py-0.5 rounded border border-red-300/80 mb-2 shadow-2xs">
                                🪷 ॥ ॐ नमो भगवते वासुदेवाय ॥ श्री महालक्ष्म्यै नमः ॥ 🪷
                              </div>
                            )}
                            {isShubhLabh && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-amber-900 bg-amber-100/70 py-0.5 rounded border border-amber-300/80 mb-2 shadow-2xs">
                                ✨ ॥ शुभ लाभ ॥ रिद्धि सिद्धि ॥ श्री गणेशाय नमः ॥ ✨
                              </div>
                            )}
                            {isRoyalGold && (
                              <div className="text-center text-[8px] font-black tracking-widest text-amber-900 bg-gradient-to-r from-amber-200/60 via-yellow-100/90 to-amber-200/60 py-0.5 rounded border border-amber-400/80 mb-2 shadow-2xs">
                                👑 ✦ ROYAL HERITAGE TAX INVOICE ✦ 👑
                              </div>
                            )}
                            {isCorporate && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-indigo-900 dark:text-indigo-200 bg-indigo-50/80 dark:bg-indigo-950/50 py-0.5 rounded border border-indigo-200/80 mb-2 shadow-2xs">
                                🏛️ OFFICIAL COMMERCIAL TAX INVOICE · ORIGINAL 🏛️
                              </div>
                            )}

                            {template.showWatermark && (
                              <div
                                className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden"
                                style={{ opacity: (template.watermarkOpacity || 15) / 100 }}
                              >
                                {isGanesh ? (
                                  <span className="text-8xl select-none font-bold text-amber-800/40">🕉️</span>
                                ) : isJain ? (
                                  <span className="text-8xl select-none font-bold text-amber-800/40">🛕</span>
                                ) : isMaharashtra ? (
                                  <span className="text-8xl select-none font-bold text-orange-800/40">🚩</span>
                                ) : isHinduGod ? (
                                  <span className="text-8xl select-none font-bold text-red-800/40">🪷</span>
                                ) : isShubhLabh ? (
                                  <span className="text-7xl select-none font-black text-amber-800/40 tracking-wider">॥ शुभ लाभ ॥</span>
                                ) : isRoyalGold ? (
                                  <span className="text-8xl select-none font-bold text-amber-800/40">👑</span>
                                ) : (
                                  <span className="text-4xl font-black uppercase tracking-widest text-slate-900 -rotate-45 whitespace-nowrap">
                                    {template.watermarkText || resolvedStoreName || "OFFICIAL"}
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="relative z-10">
                              <MargPharmaTemplate
                                invoice={margMockInvoice}
                                dynamicStoreName={resolvedStoreName}
                                dynamicLogoUrl={resolvedLogoUrl}
                                dynamicAddress={resolvedAddress}
                                dynamicPhone={resolvedPhone}
                                dynamicEmail=""
                                sellerGstin={resolvedGstin}
                                sellerStateCode="37"
                                dynamicBank={previewBank}
                                currency={currency}
                                f={f as any}
                                texts={previewTexts}
                                paymentQr={previewPaymentQr}
                              />
                            </div>
                          </div>
                          );
    }

                          // ── Check if Custom Replica Template (FMCG Wholesale) ──
                          if (previewRenderer === "fmcg_distributor") {
      const fmcgMockInvoice: FullInvoiceData = {
                            id: "mock-fmcg-01",
                          invoice_number: previewDocNoSafe,
                          invoice_date: "2026-07-21",
                          due_date: "2026-07-21",
                          created_at: "2026-07-21T10:00:00Z",
                          payment_method: "Cash",
                          customerName: "ACME Enterprises Pvt Ltd",
                          customerAddress: "45 Tech Boulevard, Sector 62, Noida, UP",
                          customerPhone: "9876543210",
                          customerGST: "09BBBBA9999C1Z2",
                          taxable_value: 11497.0,
                          cgst_amount: 1034.73,
                          sgst_amount: 1034.73,
                          tax_amount: 2069.46,
                          grand_total: 13566.46,
                          items: [
                          {product_name: "Samsung Galaxy A30", quantity: 1, unit_price: 12000.0, mrp: 14000.0, hsn_code: "85171200", tax_rate: 18, discount_value: 0, subtotal: 10620.0 },
                          {product_name: "Parle-G Biscuit 200g", quantity: 1, unit_price: 400.0, mrp: 450.0, hsn_code: "19059090", tax_rate: 18, discount_value: 0, subtotal: 342.86 },
                          ],
      };
                          return (
                          <div
                            className={`relative overflow-hidden ${containerWidthClass} ${marginPaddingClass} shadow-xl ${borderStyle}`}
                            style={{
                              fontFamily: template.fontFamily,
                              backgroundColor: template.paperBgColor || (isDecorativeTheme ? "#fffdf5" : "#ffffff"),
                              borderTop: isStylish || isCultureUp || isCultureGod || isElegant || isEmeraldCorp || isMaharashtra || isGanesh || isHinduGod || isShubhLabh || isRoyalGold || isJain ? `5px solid ${template.primaryColor}` : undefined,
                            }}
                          >
                            {isJain && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-amber-800 bg-amber-100/70 py-0.5 rounded border border-amber-300/80 mb-2 shadow-2xs">
                                ॥ ॐ नमो जिनानाम् ॥ अहिंसा परमो धर्मः ॥
                              </div>
                            )}
                            {isMaharashtra && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-orange-900 bg-orange-100/80 py-0.5 rounded border border-orange-300/80 mb-2 shadow-2xs">
                                🚩 ॥ जय भवानी जय शिवाजी ॥ जय महाराष्ट्र ॥ 🚩
                              </div>
                            )}
                            {isGanesh && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-amber-900 bg-amber-100/80 py-0.5 rounded border border-amber-300/80 mb-2 shadow-2xs">
                                🕉️ ॥ श्री गणेशाय नमः ॥ ॐ गं गणपतये नमः ॥ ✨
                              </div>
                            )}
                            {isHinduGod && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-red-900 bg-red-100/70 py-0.5 rounded border border-red-300/80 mb-2 shadow-2xs">
                                🪷 ॥ ॐ नमो भगवते वासुदेवाय ॥ श्री महालक्ष्म्यै नमः ॥ 🪷
                              </div>
                            )}
                            {isShubhLabh && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-amber-900 bg-amber-100/70 py-0.5 rounded border border-amber-300/80 mb-2 shadow-2xs">
                                ✨ ॥ शुभ लाभ ॥ रिद्धि सिद्धि ॥ श्री गणेशाय नमः ॥ ✨
                              </div>
                            )}
                            {isRoyalGold && (
                              <div className="text-center text-[8px] font-black tracking-widest text-amber-900 bg-gradient-to-r from-amber-200/60 via-yellow-100/90 to-amber-200/60 py-0.5 rounded border border-amber-400/80 mb-2 shadow-2xs">
                                👑 ✦ ROYAL HERITAGE TAX INVOICE ✦ 👑
                              </div>
                            )}
                            {isCorporate && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-indigo-900 dark:text-indigo-200 bg-indigo-50/80 dark:bg-indigo-950/50 py-0.5 rounded border border-indigo-200/80 mb-2 shadow-2xs">
                                🏛️ OFFICIAL COMMERCIAL TAX INVOICE · ORIGINAL 🏛️
                              </div>
                            )}

                            {template.showWatermark && (
                              <div
                                className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden"
                                style={{ opacity: (template.watermarkOpacity || 15) / 100 }}
                              >
                                {isGanesh ? (
                                  <span className="text-8xl select-none font-bold text-amber-800/40">🕉️</span>
                                ) : isJain ? (
                                  <span className="text-8xl select-none font-bold text-amber-800/40">🛕</span>
                                ) : isMaharashtra ? (
                                  <span className="text-8xl select-none font-bold text-orange-800/40">🚩</span>
                                ) : isHinduGod ? (
                                  <span className="text-8xl select-none font-bold text-red-800/40">🪷</span>
                                ) : isShubhLabh ? (
                                  <span className="text-7xl select-none font-black text-amber-800/40 tracking-wider">॥ शुभ लाभ ॥</span>
                                ) : isRoyalGold ? (
                                  <span className="text-8xl select-none font-bold text-amber-800/40">👑</span>
                                ) : (
                                  <span className="text-4xl font-black uppercase tracking-widest text-slate-900 -rotate-45 whitespace-nowrap">
                                    {template.watermarkText || resolvedStoreName || "OFFICIAL"}
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="relative z-10">
                              <FmcgDistributorTemplate
                                invoice={fmcgMockInvoice}
                                dynamicStoreName={resolvedStoreName}
                                dynamicLogoUrl={resolvedLogoUrl}
                                dynamicAddress={resolvedAddress}
                                dynamicPhone={resolvedPhone}
                                dynamicEmail=""
                                sellerGstin={resolvedGstin}
                                sellerStateCode="37"
                                dynamicBank={previewBank}
                                currency={currency}
                                f={f as any}
                                texts={previewTexts}
                                paymentQr={previewPaymentQr}
                              />
                            </div>
                          </div>
                          );
    }

                          // ── Check if Custom Replica Template (Parle Supermarket) ──
                          if (previewRenderer === "parle_teal") {
      const parleMockInvoice: FullInvoiceData = {
                            id: "mock-parle-01",
                          invoice_number: previewDocNoSafe,
                          invoice_date: "2026-05-30",
                          due_date: "2026-05-30",
                          created_at: "2026-05-30T10:00:00Z",
                          customerName: "ACME Enterprises Pvt Ltd",
                          customerAddress: "45 Tech Boulevard, Sector 62, Noida, UP",
                          customerPhone: "9876543210",
                          customerGST: "09BBBBA9999C1Z2",
                          taxable_value: 11497.0,
                          cgst_amount: 1034.73,
                          sgst_amount: 1034.73,
                          tax_amount: 2069.46,
                          grand_total: 13566.46,
                          items: [
                          {product_name: "Samsung Galaxy A30", quantity: 1, unit_price: 12000.0, mrp: 14000.0, hsn_code: "85171200", tax_rate: 18, subtotal: 10620.0 },
                          {product_name: "Parle-G Biscuit 200g", quantity: 1, unit_price: 400.0, mrp: 450.0, hsn_code: "19059090", tax_rate: 18, subtotal: 342.86 },
                          ],
      };
                          return (
                          <div
                            className={`relative overflow-hidden ${containerWidthClass} ${marginPaddingClass} shadow-xl ${borderStyle}`}
                            style={{
                              fontFamily: template.fontFamily,
                              backgroundColor: template.paperBgColor || (isDecorativeTheme ? "#fffdf5" : "#ffffff"),
                              borderTop: isStylish || isCultureUp || isCultureGod || isElegant || isEmeraldCorp || isMaharashtra || isGanesh || isHinduGod || isShubhLabh || isRoyalGold || isJain ? `5px solid ${template.primaryColor}` : undefined,
                            }}
                          >
                            {isJain && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-amber-800 bg-amber-100/70 py-0.5 rounded border border-amber-300/80 mb-2 shadow-2xs">
                                ॥ ॐ नमो जिनानाम् ॥ अहिंसा परमो धर्मः ॥
                              </div>
                            )}
                            {isMaharashtra && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-orange-900 bg-orange-100/80 py-0.5 rounded border border-orange-300/80 mb-2 shadow-2xs">
                                🚩 ॥ जय भवानी जय शिवाजी ॥ जय महाराष्ट्र ॥ 🚩
                              </div>
                            )}
                            {isGanesh && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-amber-900 bg-amber-100/80 py-0.5 rounded border border-amber-300/80 mb-2 shadow-2xs">
                                🕉️ ॥ श्री गणेशाय नमः ॥ ॐ गं गणपतये नमः ॥ ✨
                              </div>
                            )}
                            {isHinduGod && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-red-900 bg-red-100/70 py-0.5 rounded border border-red-300/80 mb-2 shadow-2xs">
                                🪷 ॥ ॐ नमो भगवते वासुदेवाय ॥ श्री महालक्ष्म्यै नमः ॥ 🪷
                              </div>
                            )}
                            {isShubhLabh && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-amber-900 bg-amber-100/70 py-0.5 rounded border border-amber-300/80 mb-2 shadow-2xs">
                                ✨ ॥ शुभ लाभ ॥ रिद्धि सिद्धि ॥ श्री गणेशाय नमः ॥ ✨
                              </div>
                            )}
                            {isRoyalGold && (
                              <div className="text-center text-[8px] font-black tracking-widest text-amber-900 bg-gradient-to-r from-amber-200/60 via-yellow-100/90 to-amber-200/60 py-0.5 rounded border border-amber-400/80 mb-2 shadow-2xs">
                                👑 ✦ ROYAL HERITAGE TAX INVOICE ✦ 👑
                              </div>
                            )}
                            {isCorporate && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-indigo-900 dark:text-indigo-200 bg-indigo-50/80 dark:bg-indigo-950/50 py-0.5 rounded border border-indigo-200/80 mb-2 shadow-2xs">
                                🏛️ OFFICIAL COMMERCIAL TAX INVOICE · ORIGINAL 🏛️
                              </div>
                            )}

                            {template.showWatermark && (
                              <div
                                className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden"
                                style={{ opacity: (template.watermarkOpacity || 15) / 100 }}
                              >
                                {isGanesh ? (
                                  <span className="text-8xl select-none font-bold text-amber-800/40">🕉️</span>
                                ) : isJain ? (
                                  <span className="text-8xl select-none font-bold text-amber-800/40">🛕</span>
                                ) : isMaharashtra ? (
                                  <span className="text-8xl select-none font-bold text-orange-800/40">🚩</span>
                                ) : isHinduGod ? (
                                  <span className="text-8xl select-none font-bold text-red-800/40">🪷</span>
                                ) : isShubhLabh ? (
                                  <span className="text-7xl select-none font-black text-amber-800/40 tracking-wider">॥ शुभ लाभ ॥</span>
                                ) : isRoyalGold ? (
                                  <span className="text-8xl select-none font-bold text-amber-800/40">👑</span>
                                ) : (
                                  <span className="text-4xl font-black uppercase tracking-widest text-slate-900 -rotate-45 whitespace-nowrap">
                                    {template.watermarkText || resolvedStoreName || "OFFICIAL"}
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="relative z-10">
                              <ParleDistributorTemplate
                                invoice={parleMockInvoice}
                                dynamicStoreName={resolvedStoreName}
                                dynamicLogoUrl={resolvedLogoUrl}
                                dynamicAddress={resolvedAddress}
                                dynamicPhone={resolvedPhone}
                                dynamicEmail=""
                                sellerGstin={resolvedGstin}
                                sellerStateCode="37"
                                dynamicBank={previewBank}
                                currency={currency}
                                f={f as any}
                                texts={previewTexts}
                                paymentQr={previewPaymentQr}
                              />
                            </div>
                          </div>
                          );
    }

                          // ── Check if Custom Replica Template (Agri Seeds) ──
                          if (previewRenderer === "agri_seeds") {
      const agriMockInvoice: FullInvoiceData = {
                            id: "mock-agri-01",
                          invoice_number: previewDocNoSafe,
                          invoice_date: "2026-06-15",
                          due_date: "2026-06-15",
                          created_at: "2026-06-15T10:00:00Z",
                          customerName: "ACME Enterprises Pvt Ltd",
                          customerAddress: "45 Tech Boulevard, Sector 62, Noida, UP",
                          customerPhone: "9876543210",
                          customerGST: "09BBBBA9999C1Z2",
                          taxable_value: 11497.0,
                          tax_amount: 2069.46,
                          grand_total: 13566.46,
                          items: [
                          {product_name: "Samsung Galaxy A30", quantity: 1, unit_price: 12000.0, mrp: 14000.0, hsn_code: "85171200", tax_rate: 18, subtotal: 10620.0 },
                          {product_name: "Parle-G Biscuit 200g", quantity: 1, unit_price: 400.0, mrp: 450.0, hsn_code: "19059090", tax_rate: 18, subtotal: 342.86 },
                          ],
      };
                          return (
                          <div
                            className={`relative overflow-hidden ${containerWidthClass} ${marginPaddingClass} shadow-xl ${borderStyle}`}
                            style={{
                              fontFamily: template.fontFamily,
                              backgroundColor: template.paperBgColor || (isDecorativeTheme ? "#fffdf5" : "#ffffff"),
                              borderTop: isStylish || isCultureUp || isCultureGod || isElegant || isEmeraldCorp || isMaharashtra || isGanesh || isHinduGod || isShubhLabh || isRoyalGold || isJain ? `5px solid ${template.primaryColor}` : undefined,
                            }}
                          >
                            {isJain && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-amber-800 bg-amber-100/70 py-0.5 rounded border border-amber-300/80 mb-2 shadow-2xs">
                                ॥ ॐ नमो जिनानाम् ॥ अहिंसा परमो धर्मः ॥
                              </div>
                            )}
                            {isMaharashtra && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-orange-900 bg-orange-100/80 py-0.5 rounded border border-orange-300/80 mb-2 shadow-2xs">
                                🚩 ॥ जय भवानी जय शिवाजी ॥ जय महाराष्ट्र ॥ 🚩
                              </div>
                            )}
                            {isGanesh && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-amber-900 bg-amber-100/80 py-0.5 rounded border border-amber-300/80 mb-2 shadow-2xs">
                                🕉️ ॥ श्री गणेशाय नमः ॥ ॐ गं गणपतये नमः ॥ ✨
                              </div>
                            )}
                            {isHinduGod && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-red-900 bg-red-100/70 py-0.5 rounded border border-red-300/80 mb-2 shadow-2xs">
                                🪷 ॥ ॐ नमो भगवते वासुदेवाय ॥ श्री महालक्ष्म्यै नमः ॥ 🪷
                              </div>
                            )}
                            {isShubhLabh && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-amber-900 bg-amber-100/70 py-0.5 rounded border border-amber-300/80 mb-2 shadow-2xs">
                                ✨ ॥ शुभ लाभ ॥ रिद्धि सिद्धि ॥ श्री गणेशाय नमः ॥ ✨
                              </div>
                            )}
                            {isRoyalGold && (
                              <div className="text-center text-[8px] font-black tracking-widest text-amber-900 bg-gradient-to-r from-amber-200/60 via-yellow-100/90 to-amber-200/60 py-0.5 rounded border border-amber-400/80 mb-2 shadow-2xs">
                                👑 ✦ ROYAL HERITAGE TAX INVOICE ✦ 👑
                              </div>
                            )}
                            {isCorporate && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-indigo-900 dark:text-indigo-200 bg-indigo-50/80 dark:bg-indigo-950/50 py-0.5 rounded border border-indigo-200/80 mb-2 shadow-2xs">
                                🏛️ OFFICIAL COMMERCIAL TAX INVOICE · ORIGINAL 🏛️
                              </div>
                            )}

                            {template.showWatermark && (
                              <div
                                className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden"
                                style={{ opacity: (template.watermarkOpacity || 15) / 100 }}
                              >
                                {isGanesh ? (
                                  <span className="text-8xl select-none font-bold text-amber-800/40">🕉️</span>
                                ) : isJain ? (
                                  <span className="text-8xl select-none font-bold text-amber-800/40">🛕</span>
                                ) : isMaharashtra ? (
                                  <span className="text-8xl select-none font-bold text-orange-800/40">🚩</span>
                                ) : isHinduGod ? (
                                  <span className="text-8xl select-none font-bold text-red-800/40">🪷</span>
                                ) : isShubhLabh ? (
                                  <span className="text-7xl select-none font-black text-amber-800/40 tracking-wider">॥ शुभ लाभ ॥</span>
                                ) : isRoyalGold ? (
                                  <span className="text-8xl select-none font-bold text-amber-800/40">👑</span>
                                ) : (
                                  <span className="text-4xl font-black uppercase tracking-widest text-slate-900 -rotate-45 whitespace-nowrap">
                                    {template.watermarkText || resolvedStoreName || "OFFICIAL"}
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="relative z-10">
                              <AgriSeedsTemplate
                                invoice={agriMockInvoice}
                                dynamicStoreName={resolvedStoreName}
                                dynamicLogoUrl={resolvedLogoUrl}
                                dynamicAddress={resolvedAddress}
                                dynamicPhone={resolvedPhone}
                                dynamicEmail=""
                                sellerGstin={resolvedGstin}
                                sellerStateCode="37"
                                dynamicBank={previewBank}
                                currency={currency}
                                f={f as any}
                                texts={previewTexts}
                                paymentQr={previewPaymentQr}
                              />
                            </div>
                          </div>
                          );
    }

                          // ── Canonical Commercial Document Engine (GST Tally, Stylish, Luxury, BillBook, etc.) ──
                          const gstTallyMockInvoice: FullInvoiceData = {
                            id: "mock-gst-tally-01",
                          invoice_number: previewDocNoSafe,
                          doc_type: previewSlot && previewSlot !== "invoice" ? (previewSlot === "challan" ? "challan" : previewSlot) : "invoice",
                          header_title: previewDocTitle,
                          invoice_date: "2026-07-10",
                          due_date: "2026-07-24",
                          created_at: "2026-07-10T10:00:00Z",
                          payment_method: "Cash",
                          place_of_supply: "37 - Andhra Pradesh",
                          po_number: (template as any)?.dispatchDefaults?.poNo || "PO-2026-8812",
                          challan_number: (template as any)?.dispatchDefaults?.challanNo || "DC-2026-042",
                          vehicle_number: (template as any)?.dispatchDefaults?.vehicleNo || "AP-04-TX-4412",
                          eway_bill_number: (template as any)?.dispatchDefaults?.ewayNo || "2418-9201-9920",
                          customerName: "ACME Enterprises Pvt Ltd",
                          customerCompany: "ACME Enterprises Pvt Ltd",
                          contactPerson: "Dr. Rajesh Sharma",
                          customerEmail: "billing@acme-enterprises.com",
                          customerPAN: "AABCA8821K",
                          customerDl: "DL-2026-UP-8871",
                          customer_dl: "DL-2026-UP-8871",
                          customerAddress: "45 Tech Boulevard, Sector 62, Noida, UP",
                          customerShippingAddress: "Plot 12, Industrial Area, Sector 63, Noida, UP",
                          customerPhone: "98765 43210",
                          customerGST: "09BBBBA9999C1Z2",
                          seller_pan: template.pan || activeBillingGst?.pan || "",
                          seller_cin: template.cin || activeBillingGst?.cin || "",
                          terms_text: template.termsText || (template as any).termsAndConditionsText || "",
                          terms_and_conditions: template.termsText || (template as any).termsAndConditionsText || "",
                          thank_you_note: template.thankYouNote || template.footerText || "",
                          declaration_text: template.declarationText || "",
                          taxable_value: 43450,
                          cgst_amount: 3906,
                          sgst_amount: 3906,
                          tax_amount: 7812,
                          grand_total: 51262,
                          amount_received: 51262,
                          party_previous_balance: 4500,
                          items: [
                          {product_name: "Samsung Galaxy A30", description: "6.4\" display, 4GB RAM, Dual Camera, 4000mAh", quantity: 1, unit_price: 12000, mrp: 14000, hsn_code: "85171200", tax_rate: 18, subtotal: 14160, batch_no: "SA-4412", mfg_date: "01/2026", exp_date: "01/2027" },
                          {product_name: "Parle-G Biscuit 200g", description: "Crispy glucose biscuits", quantity: 24, unit_price: 40, mrp: 48, hsn_code: "19059090", tax_rate: 18, subtotal: 5632, batch_no: "PG-778", mfg_date: "05/2026", exp_date: "05/2028" },
                          {product_name: "Tata Salt 1kg", description: "Iodized table salt", quantity: 40, unit_price: 28, mrp: 32, hsn_code: "2915", tax_rate: 0, subtotal: 1120, batch_no: "TS-112", mfg_date: "03/2026", exp_date: "" },
                          {product_name: "Amul Ghee 500ml", description: "Pure cow ghee", quantity: 6, unit_price: 380, mrp: 420, hsn_code: "0405", tax_rate: 18, subtotal: 2721, batch_no: "AG-88", mfg_date: "06/2026", exp_date: "06/2027" },
                          {product_name: "Dettol Soap 100g", description: "Antiseptic body wash", quantity: 50, unit_price: 32, mrp: 38, hsn_code: "3401", tax_rate: 18, subtotal: 3768, batch_no: "DT-45", mfg_date: "04/2026", exp_date: "04/2029" },
                          {product_name: "Liril 1kg", description: "Fruit salt detergent", quantity: 30, unit_price: 45, mrp: 52, hsn_code: "3402", tax_rate: 18, subtotal: 4091, batch_no: "LR-90", mfg_date: "05/2026", exp_date: "05/2028" },
                          {product_name: "Coca Cola 750ml", description: "Carbonated beverage", quantity: 24, unit_price: 40, mrp: 45, hsn_code: "2202", tax_rate: 28, subtotal: 1288, batch_no: "CC-19", mfg_date: "06/2026", exp_date: "06/2027" },
                          {product_name: "MTR Sambar Powder 200g", description: "Instant sambar masala", quantity: 8, unit_price: 95, mrp: 110, hsn_code: "2103", tax_rate: 5, subtotal: 801, batch_no: "MT-77", mfg_date: "02/2026", exp_date: "02/2027" },
                          {product_name: "Haldiram Bhujia 200g", description: "Onion bhujia snack", quantity: 20, unit_price: 42, mrp: 48, hsn_code: "2005", tax_rate: 18, subtotal: 2482, batch_no: "HB-31", mfg_date: "05/2026", exp_date: "05/2028" },
                          {product_name: "Wai Wai Noodles 500g", description: "Instant wavy noodles", quantity: 18, unit_price: 80, mrp: 90, hsn_code: "1902", tax_rate: 5, subtotal: 1494, batch_no: "WW-64", mfg_date: "04/2026", exp_date: "04/2027" },
                          {product_name: "Red Label Tea 250g", description: "Premium CTC tea leaves", quantity: 10, unit_price: 120, mrp: 140, hsn_code: "0902", tax_rate: 5, subtotal: 1262, batch_no: "RT-08", mfg_date: "03/2026", exp_date: "03/2028" },
                          {product_name: "Surf Excel 1kg", description: "Auto-wash detergent", quantity: 14, unit_price: 78, mrp: 88, hsn_code: "3402", tax_rate: 18, subtotal: 2184, batch_no: "SE-52", mfg_date: "05/2026", exp_date: "05/2028" },
                          {product_name: "Vejantene Vajol 90ml", description: "Herbal cough syrup", quantity: 5, unit_price: 210, mrp: 240, hsn_code: "3003", tax_rate: 5, subtotal: 1107, batch_no: "VJ-17", mfg_date: "02/2026", exp_date: "02/2027" },
                          {product_name: "Dabur Red 200ml", description: "Hair oil with herbs", quantity: 7, unit_price: 160, mrp: 185, hsn_code: "3304", tax_rate: 18, subtotal: 1325, batch_no: "DB-83", mfg_date: "06/2026", exp_date: "06/2028" },
                          {product_name: "Complan 1L", description: "Nutritious malt drink", quantity: 4, unit_price: 340, mrp: 380, hsn_code: "2106", tax_rate: 5, subtotal: 1428, batch_no: "CP-29", mfg_date: "05/2026", exp_date: "05/2027" },
                          ],
      };
                          return (
                          <div
                            className={`relative overflow-hidden ${containerWidthClass} shadow-xl`}
                            style={{
                              fontFamily: template.fontFamily,
                              backgroundColor: template.paperBgColor || (isDecorativeTheme ? "#fffdf5" : "#ffffff"),
                              borderTop: isStylish || isCultureUp || isCultureGod || isElegant || isEmeraldCorp || isMaharashtra || isGanesh || isHinduGod || isShubhLabh || isRoyalGold || isJain ? `5px solid ${template.primaryColor}` : undefined,
                            }}
                          >
                            {isJain && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-amber-800 bg-amber-100/70 py-0.5 rounded border border-amber-300/80 mb-2 shadow-2xs">
                                ॥ ॐ नमो जिनानाम् ॥ अहिंसा परमो धर्मः ॥
                              </div>
                            )}
                            {isMaharashtra && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-orange-900 bg-orange-100/80 py-0.5 rounded border border-orange-300/80 mb-2 shadow-2xs">
                                🚩 ॥ जय भवानी जय शिवाजी ॥ जय महाराष्ट्र ॥ 🚩
                              </div>
                            )}
                            {isGanesh && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-amber-900 bg-amber-100/80 py-0.5 rounded border border-amber-300/80 mb-2 shadow-2xs">
                                🕉️ ॥ श्री गणेशाय नमः ॥ ॐ गं गणपतये नमः ॥ ✨
                              </div>
                            )}
                            {isHinduGod && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-red-900 bg-red-100/70 py-0.5 rounded border border-red-300/80 mb-2 shadow-2xs">
                                🪷 ॥ ॐ नमो भगवते वासुदेवाय ॥ श्री महालक्ष्म्यै नमः ॥ 🪷
                              </div>
                            )}
                            {isShubhLabh && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-amber-900 bg-amber-100/80 py-0.5 rounded border border-amber-300/80 mb-2 shadow-2xs">
                                ✨ ॥ शुभ लाभ ॥ रिद्धि सिद्धि ॥ श्री गणेशाय नमः ॥ ✨
                              </div>
                            )}
                            {isRoyalGold && (
                              <div className="text-center text-[8px] font-black tracking-widest text-amber-900 bg-gradient-to-r from-amber-200/60 via-yellow-100/90 to-amber-200/60 py-0.5 rounded border border-amber-400/80 mb-2 shadow-2xs">
                                👑 ✦ ROYAL HERITAGE TAX INVOICE ✦ 👑
                              </div>
                            )}
                            {isCorporate && (
                              <div className="text-center text-[8px] font-bold tracking-widest text-indigo-900 dark:text-indigo-200 bg-indigo-50/80 dark:bg-indigo-950/50 py-0.5 rounded border border-indigo-200/80 mb-2 shadow-2xs">
                                🏛️ OFFICIAL COMMERCIAL TAX INVOICE · ORIGINAL 🏛️
                              </div>
                            )}

                            {template.showWatermark && (
                              <div
                                className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden"
                                style={{ opacity: (template.watermarkOpacity || 15) / 100 }}
                              >
                                {template.watermarkType === "image" && template.watermarkImage ? (
                                  <img src={template.watermarkImage} alt="Watermark" className="max-w-[60%] max-h-[60%] object-contain" />
                                ) : isGanesh ? (
                                  <span className="text-8xl select-none font-bold text-amber-800/40">🕉️</span>
                                ) : isJain ? (
                                  <span className="text-8xl select-none font-bold text-amber-800/40">🛕</span>
                                ) : isMaharashtra ? (
                                  <span className="text-8xl select-none font-bold text-orange-800/40">🚩</span>
                                ) : isHinduGod ? (
                                  <span className="text-8xl select-none font-bold text-red-800/40">🪷</span>
                                ) : isShubhLabh ? (
                                  <span className="text-7xl select-none font-black text-amber-800/40 tracking-wider">॥ शुभ लाभ ॥</span>
                                ) : isRoyalGold ? (
                                  <span className="text-8xl select-none font-bold text-amber-800/40">👑</span>
                                ) : (
                                  <span className="text-4xl font-black uppercase tracking-widest text-slate-900 -rotate-45 whitespace-nowrap">
                                    {template.watermarkText || resolvedStoreName || "OFFICIAL"}
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="relative z-10">
                              <GstTallyTemplate
                                invoice={gstTallyMockInvoice}
                                dynamicStoreName={resolvedStoreName}
                                dynamicLogoUrl={resolvedLogoUrl}
                                dynamicAddress={resolvedAddress}
                                dynamicPhone={resolvedPhone}
                                dynamicEmail={template.email || activeBillingGst?.email || ""}
                                sellerGstin={resolvedGstin}
                                sellerStateCode={template.sellerStateCode || activeBillingGst?.state_code || "37"}
                                dynamicBank={previewBank}
                                currency={currency}
                                f={f as any}
                                texts={previewTexts}
                                paymentQr={previewPaymentQr}
                                template={template}
                                partyLayout={(template as any)?.party?.layout || (template as any)?.partyLayout || "layout_1"}
                                columns={(template as any)?.itemTable?.columns || (template as any)?.columns}
                                customFields={(template as any)?.customFields}
                                paperSize={(template.paperSize as any) || "A4"}
                                orientation={(template.orientation as any) || "portrait"}
                              />
                            </div>
                          </div>
                          );
  }


                          // 3. BARCODE LABEL PREVIEW (HD Studio Workspace with Millimeter Grid & Safe Bounds)
                          if (template.docType === "barcode" || template.category === "barcodes") {
    const defaultMock = {
                            product_name: "Saree 849",
                          barcode: "TS0459208499",
                          sku: "TS0459208499",
                          selling_price: 849.0,
                          mrp: 1698.0,
                          category_name: "ETHNIC WEAR",
                          format: template.barcodeSymbology || "Code-128",
    };
                          const itemToRender = sampleBarcodeItem || defaultMock;
                          const is2Up = template.layout === "2up" || (template as any).paperSize === "100x25mm" || (template as any).labelLayout === "2up" || template.id?.includes("dual");

                          return (
                          <div className="w-full flex flex-col items-center gap-3">
                            {/* Workspace Canvas Header & Dimension Guide */}
                            <div className="flex items-center justify-between w-full max-w-[680px] px-2 text-[11px] font-semibold text-slate-500">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="font-mono text-slate-700 font-bold">
                                  {is2Up ? "📏 100mm × 25mm (2-Up Dual Roll)" : "📏 50mm × 25mm (1-Up Single Roll)"}
                                </span>
                              </div>
                              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] border border-slate-200">
                                Click / Drag Elements to Edit
                              </span>
                            </div>

                            {/* Blueprint Millimeter Grid Workspace */}
                            <div className="w-full max-w-[680px] p-3 sm:p-4 bg-slate-50/90 rounded-2xl border-2 border-dashed border-slate-300 shadow-inner flex flex-col items-center justify-center relative overflow-hidden group">
                              {/* Subtle Millimeter Grid Background Lines */}
                              <div
                                className="absolute inset-0 opacity-[0.15] pointer-events-none"
                                style={{
                                  backgroundImage: "radial-gradient(#3b82f6 1px, transparent 1px), radial-gradient(#64748b 1px, transparent 1px)",
                                  backgroundSize: "16px 16px, 4px 4px",
                                  backgroundPosition: "0 0, 8px 8px"
                                }}
                              />

                              {/* Safe Margins Indicator Frame */}
                              <div className="w-full relative z-10 flex flex-col items-center">
                                {is2Up ? (
                                  <div className="w-full p-2 bg-slate-200/80 dark:bg-slate-800/80 rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xl">
                                    <div className="grid grid-cols-2 gap-2 w-full">
                                      <div className="w-full shadow-sm rounded-xs border border-slate-300/80 overflow-hidden bg-white">
                                        <SingleBarcodeLabelCard
                                          item={itemToRender}
                                          template={template as any}
                                          isPrint={false}
                                          orgName={tenant?.name || template.storeName || "TRENDY SLICE BY BINDU"}
                                          isEditable={true}
                                          selectedElementKey={selectedBarcodeElementKey || undefined}
                                          onSelectElement={(key) => onSelectBarcodeElement && onSelectBarcodeElement(key)}
                                          onFieldEdit={(key, val) => onFieldEdit && onFieldEdit(key, val)}
                                          onResizeBarcode={onResizeBarcode}
                                          onResizeElement={onResizeElement}
                                          onMoveElement={onMoveElement}
                                        />
                                      </div>
                                      <div className="w-full shadow-sm rounded-xs border border-slate-300/80 overflow-hidden bg-white">
                                        <SingleBarcodeLabelCard
                                          item={itemToRender}
                                          template={template as any}
                                          isPrint={false}
                                          orgName={tenant?.name || template.storeName || "TRENDY SLICE BY BINDU"}
                                          isEditable={true}
                                          selectedElementKey={selectedBarcodeElementKey || undefined}
                                          onSelectElement={(key) => onSelectBarcodeElement && onSelectBarcodeElement(key)}
                                          onFieldEdit={(key, val) => onFieldEdit && onFieldEdit(key, val)}
                                          onResizeBarcode={onResizeBarcode}
                                          onResizeElement={onResizeElement}
                                          onMoveElement={onMoveElement}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="w-full max-w-[440px] shadow-2xl rounded-xl border border-slate-300/80 overflow-hidden bg-white ring-4 ring-slate-900/5 transition-all">
                                    <SingleBarcodeLabelCard
                                      item={itemToRender}
                                      template={template as any}
                                      isPrint={false}
                                      orgName={tenant?.name || template.storeName || "RETAIL STORE"}
                                      isEditable={true}
                                      selectedElementKey={selectedBarcodeElementKey || undefined}
                                      onSelectElement={(key) => onSelectBarcodeElement && onSelectBarcodeElement(key)}
                                      onFieldEdit={(key, val) => onFieldEdit && onFieldEdit(key, val)}
                                      onResizeBarcode={onResizeBarcode}
                                      onResizeElement={onResizeElement}
                                      onMoveElement={onMoveElement}
                                    />
                                  </div>
                                )}
                                <p className="text-[10px] text-slate-400 font-mono mt-2 select-none text-center">
                                  Safe Printable Margin: ±1.5mm • 100% 1:1 Thermal Output Sync
                                </p>
                              </div>
                            </div>
                          </div>
                          );
  }

                          // 4. QR CODE TAG PREVIEW
                          if (template.docType === "qrcode" || template.category === "qrcodes") {
    return (
                          <div className="w-[280px] h-[140px] bg-white text-black p-3 rounded-lg shadow-2xl border-2 border-teal-800 font-sans flex items-center justify-between gap-3 overflow-hidden">
                            <div className="flex flex-col justify-between h-full flex-1">
                              <div>
                                {f.showCompanyName && (
                                  <span className="font-bold text-[9px] tracking-wider uppercase text-teal-800 block">
                                    {template.storeName}
                                  </span>
                                )}
                                {f.showProductName && (
                                  <h4 className="font-bold text-xs leading-tight text-slate-900 line-clamp-2 mt-0.5">{t("Smart AI Fitness Watch Series 5", "Smart AI Fitness Watch Series 5")}</h4>
                                )}
                                {f.showSKU && <p className="text-[8px] font-mono text-slate-500">SKU: WTC-AI-550</p>}
                              </div>

                              <div>
                                {f.showPrice && (
                                  <span className="text-sm font-extrabold text-slate-900 block">{currency.symbol}8,999.00</span>
                                )}
                                {f.showCustomTagline && (
                                  <span className="text-[8px] font-medium text-slate-500">{template.customTaglineText}</span>
                                )}
                              </div>
                            </div>

                            {f.showBarcodeGraphic && (
                              <div className="flex flex-col items-center justify-center bg-slate-50 p-2 rounded-lg border border-slate-200 shrink-0">
                                <svg className="h-16 w-16" viewBox="0 0 100 100">
                                  <rect width="100" height="100" fill="white" />
                                  <rect x="5" y="5" width="30" height="30" fill="black" />
                                  <rect x="10" y="10" width="20" height="20" fill="white" />
                                  <rect x="15" y="15" width="10" height="10" fill="black" />
                                  <rect x="65" y="5" width="30" height="30" fill="black" />
                                  <rect x="70" y="10" width="20" height="20" fill="white" />
                                  <rect x="75" y="15" width="10" height="10" fill="black" />
                                  <rect x="5" y="65" width="30" height="30" fill="black" />
                                  <rect x="10" y="70" width="20" height="20" fill="white" />
                                  <rect x="15" y="75" width="10" height="10" fill="black" />
                                  <rect x="45" y="45" width="12" height="12" fill="black" />
                                </svg>
                                <span className="text-[7px] font-mono text-slate-500 mt-1">SCAN QR</span>
                              </div>
                            )}
                          </div>
                          );
  }

                          // 5. PRICE TAG PREVIEW
                          if (template.docType === "pricetag" || template.category === "pricetag") {
    return (
                          <div className="w-[250px] bg-white text-slate-900 rounded-xl shadow-xl p-3 text-center border-2 border-red-500 relative overflow-hidden space-y-1.5">
                            <div className="bg-red-600 text-white font-black text-[9px] py-0.5 tracking-wider uppercase">
                              {template.customTaglineText || "SPECIAL OFFER"}
                            </div>
                            <div className="font-bold text-[10px] text-slate-800">Parle-G Gold Premium 200g</div>
                            <div className="text-3xl font-black text-red-600 tracking-tight">₹ 299</div>
                            <div className="text-[7.5px] text-slate-500 font-medium">Incl. of all taxes | SKU: PG-200G</div>
                          </div>
                          );
  }

                          // 6. DEFAULT / OTHER PREVIEW
                          return (
                          <div className="w-[300px] bg-white text-slate-900 rounded-xl shadow-xl p-4 text-[9px] border border-slate-200 space-y-3">
                            <div className="font-bold text-xs text-indigo-600 uppercase tracking-wider">{template.name}</div>
                            <p className="text-[8px] text-slate-500">{template.description}</p>
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center font-mono text-[8px]">
                              {template.headerTitle} - {template.paperSize} ({template.orientation})
                            </div>
                          </div>
                          );
}

                          /* ── Full Template Store & Library Modal ── */
                          function TemplateStoreModal({
                            category,
                            templates,
                            activeTemplateId,
                            onClose,
                            onSelect,
                            onDuplicate,
}: {
                            category: DocumentType;
                          templates: PrintTemplate[];
                          activeTemplateId: string;
  onClose: () => void;
  onSelect: (tpl: PrintTemplate) => void;
  onDuplicate: (tpl: PrintTemplate) => void;
}) {
  const {t} = useI18n();
                          const [search, setSearch] = useState("");

                          const filtered = (templates || []).filter(
    (t) =>
                          t.name.toLowerCase().includes(search.toLowerCase()) ||
                          t.description.toLowerCase().includes(search.toLowerCase())
                          );

                          return (
                          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="w-full max-w-4xl max-h-[88vh] bg-card border border-border rounded-3xl p-6 shadow-2xl flex flex-col gap-4 overflow-hidden"
                            >
                              {/* Header */}
                              <div className="flex items-center justify-between border-b border-border/80 pb-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                                    <Sparkles className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <h2 className="text-base font-bold text-foreground">
                                      All Available Master Templates ({(templates || []).length})
                                    </h2>
                                    <p className="text-xs text-muted-foreground">{t("Browse, select, or duplicate pre-built ERP & retail formats.", "Browse, select, or duplicate pre-built ERP & retail formats.")}</p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <div className="relative w-56">
                                    <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                                    <input
                                      type="text"
                                      value={search}
                                      onChange={(e) => setSearch(e.target.value)}
                                      placeholder="Search templates..."
                                      className="w-full rounded-xl border border-input bg-background py-1.5 pl-8 pr-3 text-xs text-foreground focus:border-indigo-500"
                                    />
                                  </div>
                                  <button
                                    onClick={onClose}
                                    className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>

                              {/* Templates Grid List */}
                              <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pr-1">
                                {filtered.map((item) => {
                                  const isSelected = item.id === activeTemplateId;
                                  return (
                                    <div
                                      key={item.id}
                                      className={`flex flex-col justify-between p-4 rounded-2xl border transition-all ${isSelected
                                        ? "border-indigo-600 bg-indigo-50/20 ring-2 ring-indigo-500/20 shadow-sm"
                                        : "border-border/80 bg-card hover:border-indigo-400 hover:bg-muted/20"
                                        }`}
                                    >
                                      <div>
                                        <div className="flex items-start justify-between gap-2">
                                          <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                                            {item.name}
                                            {isSelected && (
                                              <CheckCheck className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                                            )}
                                          </h4>
                                          {item.isDefault && (
                                            <span className="rounded-full bg-primary/10 text-primary text-[9px] font-bold px-2 py-0.5 shrink-0">
                                              ORG DEFAULT
                                            </span>
                                          )}
                                        </div>
                                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                                          Paper Size: <strong className="text-foreground">{item.paperSize}</strong>
                                        </span>
                                        <p className="mt-2 text-xs text-muted-foreground leading-relaxed line-clamp-3">
                                          {item.description}
                                        </p>
                                      </div>

                                      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
                                        <button
                                          onClick={() => onSelect(item)}
                                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${isSelected
                                            ? "bg-indigo-600 text-white"
                                            : "border border-border hover:bg-muted text-foreground"
                                            }`}
                                        >
                                          {isSelected ? "Active Template" : "Select & Customize"}
                                        </button>

                                        <button
                                          onClick={() => onDuplicate(item)}
                                          title="Duplicate as New Template"
                                          className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                                        >
                                          <Copy className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </motion.div>
                          </div>
                          );
}

                          /* ── Printable HTML Generator ── */
                          function generatePrintableHtml(template: PrintTemplate, currency: {symbol: string }) {
                          return `
                          <!DOCTYPE html>
                          <html>
                            <head>
                              <title>${template.name} - Print Preview</title>
                              <style>
                                body {font - family: ${template.fontFamily || "Inter, sans-serif"}; margin: 0; padding: 20px; background: #f8fafc; color: #0f172a; }
                                .sheet {max - width: 800px; margin: 0 auto; background: ${template.paperBgColor || "#ffffff"}; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
                                .header {display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; }
                                .title {background: ${template.primaryColor || "#4f46e5"}; color: #fff; text-align: center; padding: 8px; font-weight: bold; border-radius: 6px; margin: 15px 0; text-transform: uppercase; }
                                table {width: 100%; border-collapse: collapse; margin-top: 15px; }
                                th {border - bottom: 2px solid #cbd5e1; text-align: left; padding: 8px; font-size: 12px; }
                                td {border - bottom: 1px solid #f1f5f9; padding: 8px; font-size: 12px; }
                                .total-box {margin - top: 20px; text-align: right; font-size: 13px; }
                                @media print {body {background: #fff; padding: 0; } .sheet {box - shadow: none; padding: 0; } }
                              </style>
                            </head>
                            <body>
                              <div class="sheet">
                                <div class="header">
                                  <div>
                                    <h2 style="margin: 0; color: ${template.primaryColor || "#4f46e5"}">${template.storeName || "Smart Bazaar"}</h2>
                                  <p style="margin: 4px 0; font-size: 12px; color: #64748b;">${template.storeAddress || ""}</p>
                                  <p style="margin: 0; font-size: 12px; color: #64748b;">GSTIN: ${template.gstin || ""} | Ph: ${template.storePhone || ""}</p>
                                </div>
                                <div style="text-align: right;">
                                  <h3 style="margin: 0;">${template.headerTitle || "TAX INVOICE"}</h3>
                                  <p style="margin: 4px 0; font-size: 12px;">Date: ${formatDisplayDate(new Date())}</p>
                                </div>
                              </div>
                              <div class="title">${template.headerTitle || "TAX INVOICE"}</div>
                              <table>
                                <thead>
                                  <tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
                                </thead>
                                <tbody>
                                  <tr><td>1</td><td>Samsung Galaxy A30</td><td>1 Pcs</td><td>10,000</td><td>10,620</td></tr>
                                  <tr><td>2</td><td>Parle-G 200g</td><td>1 Box</td><td>342.86</td><td>306</td></tr>
                                  <tr><td>3</td><td>Puma Blue Round Neck T-Shirt</td><td>2 Pcs</td><td>900</td><td>1,890</td></tr>
                                </tbody>
                              </table>
                              <div class="total-box">
                                <p>Subtotal: 12,816.00</p>
                                <p>GST (18%): 2,307.00</p>
                                <h3 style="color: ${template.primaryColor || "#4f46e5"}">Grand Total: ₹ 15,123.00</h3>
                            </div>
                          </div>
                          <script>
                            window.onload = function() {window.print(); }
                          </script>
                        </body>
                      </html>
                      `;
}