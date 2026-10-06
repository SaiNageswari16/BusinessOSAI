import React, { useState, useEffect, useRef } from "react";
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
  ZoomIn,
  ZoomOut,
  ChevronLeft,
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
  Table as TableIcon,
  HelpCircle,
  ShieldCheck,
  Search,
  CheckCheck,
  ArrowUp,
  ArrowDown,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { resolveImageUrl, invoicesApi, inventoryApi, printTemplatesApi } from "@/lib/api-client";
import { formatDisplayDate } from "@/lib/utils";
import { getActiveBillingGst, saveBarcodeTemplate, setActiveBarcodeTemplate, syncPrintTemplatesFromBackend } from "@/lib/receipt-template-store";
import { MargPharmaTemplate } from "@/components/pos/invoice-templates/MargPharmaTemplate";
import { FmcgDistributorTemplate } from "@/components/pos/invoice-templates/FmcgDistributorTemplate";
import { ParleDistributorTemplate } from "@/components/pos/invoice-templates/ParleDistributorTemplate";
import { AgriSeedsTemplate } from "@/components/pos/invoice-templates/AgriSeedsTemplate";
import { PdfStationeryOverlayTemplate } from "@/components/pos/invoice-templates/PdfStationeryOverlayTemplate";
import { PdfTemplateOverlayModal } from "@/components/pos/PdfTemplateOverlayModal";
import { BarcodeTemplateCustomizerModal } from "./BarcodeTemplateCustomizerModal";
import {
  RealBarcodeSvg,
  SingleBarcodeLabelCard,
  getDefaultBarcodeElements,
  printBarcodePopup,
  generateBarcodeLabelHtml,
  type BarcodeElementBlock,
  type ProductBarcodeLike,
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
  | "thermal"
  | "barcode"
  | "qrcode"
  | "pricetag"
  | "challan"
  | "custom";

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
  footerText?: string;
  termsText?: string;
  bankDetails?: string;
  thankYouNote?: string;
  customTaglineText?: string;

  themeName?: string; // "stylish" | "luxury" | "adv_tally" | "adv_gst" | "billbook" | "modern" | "simple" | "marg_pharma" | "fmcg_distributor" | "parle_teal" | "agri_seeds" | "culture_up" | "culture_god" | "jain" | "maharashtra" | "ganesh" | "hindu_god" | "shubh_labh" | "royal_gold" | "corporate" | "compact" | "minimal" | "elegant" | "advanced"
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
  showTerms: false,
  showFooter: true,
  showBarcode: true,
  showQR: true,
  showProductImage: false,
  showCustomerDetails: true,
  showPaymentDetails: true,
  showSignature: false,
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
    id: "ts-jain",
    name: "Jain theme",
    category: "Devotional & Vedic",
    badge: "POPULAR",
    primaryColor: "#c2410c",
    paperBgColor: "#fffbeb",
    watermarkText: "॥ ॐ अर्हं नमः ॥",
    decorativeHeader: "॥ ॐ णमोकाराय नमः ॥ अहिंसा परमो धर्मः ॥",
    themeStyle: "jain",
    description: "Traditional Jain auspicious spiritual border with golden Navkar mantra background.",
    previewGradient: "from-amber-100 via-orange-50 to-amber-200",
    iconType: "jain",
  },
  {
    id: "ts-maharashtra",
    name: "Maharashtra",
    category: "Cultural & Heritage",
    badge: "ROYAL",
    primaryColor: "#ea580c",
    paperBgColor: "#fff7ed",
    watermarkText: "॥ छत्रपती शिवाजी महाराज ॥",
    decorativeHeader: "॥ जय भवानी जय शिवाजी ॥",
    themeStyle: "maharashtra",
    description: "Royal Maratha saffron heritage border with auspicious Raigad fort motif background.",
    previewGradient: "from-orange-100 via-amber-50 to-orange-200",
    iconType: "maharashtra",
  },
  {
    id: "ts-ganesh",
    name: "Ganesh Chaturthi",
    category: "Festive & Auspicious",
    badge: "FESTIVE",
    primaryColor: "#b91c1c",
    paperBgColor: "#fef2f2",
    watermarkText: "॥ श्री गणेशाय नमः ॥",
    decorativeHeader: "॥ श्री गणेशाय नमः ॥ ॐ गं गणपतये नमः ॥",
    themeStyle: "ganesh",
    description: "Vedic Shree Ganesha blessing watermark with auspicious vermilion floral border.",
    previewGradient: "from-red-100 via-rose-50 to-red-200",
    iconType: "ganesh",
  },
  {
    id: "ts-hindu-god",
    name: "Hindu God",
    category: "Devotional & Vedic",
    badge: "AUSPICIOUS",
    primaryColor: "#b45309",
    paperBgColor: "#fefce8",
    watermarkText: "॥ महालक्ष्मी प्रसन्न ॥",
    decorativeHeader: "॥ ॐ श्रीं ह्रीं क्लीं महालक्ष्म्यै नमः ॥ शुभ लाभ ॥",
    themeStyle: "hindu_god",
    description: "Goddess Laxmi prosperity & divine blessings background art with golden temple arch.",
    previewGradient: "from-amber-100 via-yellow-50 to-amber-200",
    iconType: "hindu_god",
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
    description: "Traditional Indian vyapar invoice with swastik, rangoli, and prosperity blessings.",
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
  {
    id: "ts-corporate",
    name: "Corporate Minimal",
    category: "Modern Corporate",
    primaryColor: "#4f46e5",
    paperBgColor: "#ffffff",
    watermarkText: "AUTHENTIC TAX INVOICE",
    decorativeHeader: "OFFICIAL COMMERCIAL INVOICE",
    themeStyle: "corporate",
    description: "Crisp contemporary geometric background with sleek high-contrast borders.",
    previewGradient: "from-indigo-50 via-slate-50 to-blue-100",
    iconType: "corporate",
  },
];

const INITIAL_TEMPLATES: PrintTemplate[] = [
  // ─── 1. GST & COMMERCIAL INVOICES ───
  {
    id: "tpl-inv-stylish",
    name: "Stylish Theme",
    category: "invoices",
    docType: "invoice",
    description: "Modern card-style design with clean borders, high-contrast headers, and highlighted totals.",
    isDefault: true,
    paperSize: "A4",
    orientation: "portrait",
    margins: "normal",
    primaryColor: "#4f46e5",
    paperBgColor: "#ffffff",
    fontFamily: "Inter, sans-serif",
    headerTitle: "TAX INVOICE",
    storeName: "ACME Luxury Store",
    storeAddress: "KK Street, Proddatur, YSR, Cuddapah, Andhra Pradesh, 516360",
    storePhone: "9849344919",
    gstin: "37AAFCOE694G1Z4",
    footerText: "Thank you for shopping with us! For any queries, contact: 9849344919",
    thankYouNote: "Thank you for shopping with us! For any queries, contact: 9849344919",
    termsText: "1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. charged after due date.",
    bankDetails: "Bank: HDFC Bank | A/C: 502000492811 | IFSC: HDFC0000003",
    customTaglineText: "Quality Products Everyday",
    themeName: "stylish",
    fields: { ...DEFAULT_ELEMENT_TOGGLES },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-inv-luxury",
    name: "Luxury Theme",
    category: "invoices",
    docType: "invoice",
    description: "Elegant royal design with primary gold borders, premium serif fonts, and high-end aesthetics.",
    isDefault: false,
    paperSize: "A4",
    orientation: "portrait",
    margins: "normal",
    primaryColor: "#b45309",
    fontFamily: "Playfair Display, serif",
    headerTitle: "TAX INVOICE",
    storeName: "Luxury Store",
    storeAddress: "45 Royal Avenue, Heritage Plaza, Sector 18, Noida, UP",
    storePhone: "+91 9849344919",
    gstin: "37AAFCOE694G1Z4",
    footerText: "We value your premium association.",
    thankYouNote: "We value your premium association.",
    termsText: "All claims subject to Cuddapah jurisdiction only.",
    bankDetails: "Bank: HDFC Bank | A/C: 502000492811 | IFSC: HDFC0000003",
    themeName: "luxury",
    fields: { ...DEFAULT_ELEMENT_TOGGLES, showSignature: true, showBankDetails: true },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-inv-adv-tally",
    name: "Advanced GST (Tally) Theme",
    category: "invoices",
    docType: "invoice",
    description: "Classic grid accounting format matching standard traditional business ERP systems with clear double borders.",
    isDefault: false,
    paperSize: "A4",
    orientation: "portrait",
    margins: "normal",
    primaryColor: "#0f172a",
    fontFamily: "Inter, sans-serif",
    headerTitle: "TAX INVOICE",
    storeName: "Smart Commercial Hub",
    storeAddress: "KK Street, Proddatur, YSR, Cuddapah, Andhra Pradesh, 516360",
    storePhone: "9849344919",
    gstin: "37AAFCOE694G1Z4",
    footerText: "Original for Recipient",
    thankYouNote: "Thank you for your business!",
    termsText: "E. & O.E. All disputes subject to Cuddapah jurisdiction only.",
    bankDetails: "Bank: Axis Bank | A/C: 912010023456 | IFSC: UTIB0000021",
    themeName: "adv_tally",
    fields: { ...DEFAULT_ELEMENT_TOGGLES, showTaxSplit: true, showHSN: true, showBankDetails: true },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-inv-adv-gst",
    name: "Advanced GST Theme",
    category: "invoices",
    docType: "invoice",
    description: "High-information layout featuring complete CGST/SGST/IGST tax splits and detailed party balance reporting.",
    isDefault: false,
    paperSize: "A4",
    orientation: "portrait",
    margins: "normal",
    primaryColor: "#2563eb",
    fontFamily: "Inter, sans-serif",
    headerTitle: "TAX INVOICE (GST COMPLIANT)",
    storeName: "Smart Enterprise ERP",
    storeAddress: "KK Street, Proddatur, YSR, Cuddapah, Andhra Pradesh, 516360",
    storePhone: "9849344919",
    gstin: "37AAFCOE694G1Z4",
    footerText: "Computer Generated Invoice",
    thankYouNote: "Thank you for your valued association.",
    termsText: "E. & O.E. All disputes subject to local jurisdiction only.",
    bankDetails: "Bank: HDFC Bank | A/C: 502000492811 | IFSC: HDFC0000003",
    themeName: "adv_gst",
    fields: { ...DEFAULT_ELEMENT_TOGGLES, showTaxSplit: true, showPartyBalance: true, showBankDetails: true },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-inv-billbook",
    name: "BillBook Theme",
    category: "invoices",
    docType: "invoice",
    description: "Standard commercial print format with clear highlighted headers and client copies indicator.",
    isDefault: false,
    paperSize: "A4",
    orientation: "portrait",
    margins: "normal",
    primaryColor: "#0284c7",
    fontFamily: "Inter, sans-serif",
    headerTitle: "TAX INVOICE",
    storeName: "Smart Bazaar Commercial",
    storeAddress: "KK Street, Proddatur, YSR, Cuddapah, Andhra Pradesh, 516360",
    storePhone: "9849344919",
    gstin: "37AAFCOE694G1Z4",
    footerText: "Original for Recipient Copy",
    thankYouNote: "Thank you for choosing us!",
    termsText: "Interest will be charged @ 2% per month after due date.",
    bankDetails: "Bank: HDFC Bank | A/C: 502000492811 | IFSC: HDFC0000003",
    themeName: "billbook",
    fields: { ...DEFAULT_ELEMENT_TOGGLES, showBankDetails: true },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-inv-modern",
    name: "Modern Theme",
    category: "invoices",
    docType: "invoice",
    description: "Sleek modern design featuring soft gray backgrounds, rounded cards, and clean typography.",
    isDefault: false,
    paperSize: "A4",
    orientation: "portrait",
    margins: "normal",
    primaryColor: "#475569",
    fontFamily: "Outfit, sans-serif",
    headerTitle: "TAX INVOICE",
    storeName: "Smart Bazaar",
    storeAddress: "KK Street, Proddatur, YSR, Cuddapah, Andhra Pradesh, 516360",
    storePhone: "9849344919",
    gstin: "37AAFCOE694G1Z4",
    footerText: "Thank you for choosing Smart Bazaar!",
    thankYouNote: "Thank you for choosing Smart Bazaar!",
    termsText: "Subject to local terms and conditions.",
    bankDetails: "Bank: HDFC Bank | A/C: 502000492811 | IFSC: HDFC0000003",
    themeName: "modern",
    fields: { ...DEFAULT_ELEMENT_TOGGLES, showBankDetails: true },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-inv-simple",
    name: "Simple Theme",
    category: "invoices",
    docType: "invoice",
    description: "Clean, no-nonsense minimal print style with simple border lines, perfect for black & white printing.",
    isDefault: false,
    paperSize: "A4",
    orientation: "portrait",
    margins: "narrow",
    primaryColor: "#1e293b",
    fontFamily: "Inter, sans-serif",
    headerTitle: "INVOICE",
    storeName: "Smart Bazaar Retail",
    storeAddress: "KK Street, Proddatur, YSR Cuddapah, AP",
    storePhone: "9849344919",
    gstin: "37AAFCOE694G1Z4",
    footerText: "Thank you!",
    termsText: "All disputes subject to local jurisdiction only.",
    bankDetails: "",
    themeName: "simple",
    fields: { ...DEFAULT_ELEMENT_TOGGLES, showTerms: false },
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
    storeName: "Smart Pharma & Medical",
    storeAddress: "Plot 32, Medical Zone, Hyderabad",
    storePhone: "911166969600",
    gstin: "36DYHPR6361D1Z6",
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
    storeName: "Smart FMCG & Wholesale",
    storeAddress: "Industrial Estate, Karnataka",
    storePhone: "9999999999",
    gstin: "29AAOFM2891F1ZT",
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
    storeName: "Parle Smart Supermarket",
    storeAddress: "Jyothinagar, Telangana",
    storePhone: "9849344919",
    gstin: "36AAACH694G1Z4",
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
    storeName: "Smart Bazaar Enterprise",
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
    storeName: "Smart Agri Seeds & Fertilizers",
    storeAddress: "Mandi Road, Proddatur, AP",
    storePhone: "9849344919",
    gstin: "37AAFCOE694G1Z4",
    themeName: "agri_seeds",
    fields: { ...DEFAULT_ELEMENT_TOGGLES, showHSN: true },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-inv-culture-up",
    name: "Uttar Pradesh GST Theme",
    category: "invoices",
    docType: "invoice",
    description: "Regional Uttar Pradesh state-compliant design with Devnagari Sanskrit shloka headers and state tax stamps.",
    isDefault: false,
    paperSize: "A4",
    orientation: "portrait",
    margins: "normal",
    primaryColor: "#ea580c",
    fontFamily: "Inter, sans-serif",
    headerTitle: "TAX INVOICE (UTTAR PRADESH)",
    storeName: "Smart Traders UP",
    storeAddress: "Shop 14, Mandi Parishad, Sector 18, Noida, Uttar Pradesh (09)",
    storePhone: "9849344919",
    gstin: "09AAFCOE694G1Z4",
    footerText: "उत्तर प्रदेश राज्य माल एवं सेवा कर नियमावली के अंतर्गत जारी",
    thankYouNote: "शुभ यात्रा • आपकी सेवा में सदैव तत्पर",
    themeName: "culture_up",
    fields: { ...DEFAULT_ELEMENT_TOGGLES, showTaxSplit: true, showHSN: true },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-inv-culture-god",
    name: "Shubh Labh Vedic Theme",
    category: "invoices",
    docType: "invoice",
    description: "Traditional Indian business invoice with Shree Ganesh and Shubh-Labh blessings auspicious headers.",
    isDefault: false,
    paperSize: "A4",
    orientation: "portrait",
    margins: "normal",
    primaryColor: "#b91c1c",
    fontFamily: "Inter, sans-serif",
    headerTitle: "॥ श्री ॥ TAX INVOICE",
    storeName: "Shree Laxmi Commercials",
    storeAddress: "KK Street, Proddatur, YSR Cuddapah, AP",
    storePhone: "9849344919",
    gstin: "37AAFCOE694G1Z4",
    footerText: "॥ शुभम् भवतु ॥ धन्यवाद ॥",
    thankYouNote: "Thank you for your blessed association!",
    themeName: "culture_god",
    fields: { ...DEFAULT_ELEMENT_TOGGLES, showBankDetails: true },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-inv-minimal",
    name: "Minimalist Clean Theme",
    category: "invoices",
    docType: "invoice",
    description: "Ultra-clean borderless contemporary layout with ample whitespace and sleek line dividers.",
    isDefault: false,
    paperSize: "A4",
    orientation: "portrait",
    margins: "wide",
    primaryColor: "#64748b",
    fontFamily: "Inter, sans-serif",
    headerTitle: "INVOICE",
    storeName: "Smart Minimalist Co.",
    storeAddress: "Tech Park, Noida, UP",
    storePhone: "9849344919",
    themeName: "minimal",
    fields: { ...DEFAULT_ELEMENT_TOGGLES, showTerms: false },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-inv-elegant",
    name: "Elegant Corporate Theme",
    category: "invoices",
    docType: "invoice",
    description: "Deep violet executive layout featuring distinguished corporate styling and high-contrast tables.",
    isDefault: false,
    paperSize: "A4",
    orientation: "portrait",
    margins: "normal",
    primaryColor: "#7c3aed",
    fontFamily: "Inter, sans-serif",
    headerTitle: "OFFICIAL TAX INVOICE",
    storeName: "Smart Enterprise Holdings",
    storeAddress: "Executive Suites, Cyber City, Hyderabad",
    storePhone: "9849344919",
    gstin: "36DYHPR6361D1Z6",
    themeName: "elegant",
    fields: { ...DEFAULT_ELEMENT_TOGGLES, showSignature: true, showBankDetails: true },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-inv-compact",
    name: "Compact Dense Grid Theme",
    category: "invoices",
    docType: "invoice",
    description: "High-density invoice format designed to pack large numbers of item rows into a single A4 sheet.",
    isDefault: false,
    paperSize: "A4",
    orientation: "portrait",
    margins: "narrow",
    primaryColor: "#1e1b4b",
    fontFamily: "Inter, sans-serif",
    headerTitle: "TAX INVOICE",
    storeName: "Smart Wholesale Depot",
    storeAddress: "APMC Yard, Proddatur",
    storePhone: "9849344919",
    themeName: "compact",
    fields: { ...DEFAULT_ELEMENT_TOGGLES, showHSN: true, showTaxSplit: true },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-inv-clean-slate",
    name: "Clean Slate Theme",
    category: "invoices",
    docType: "invoice",
    description: "Slate gray structured invoice with rounded element blocks and balanced information hierarchy.",
    isDefault: false,
    paperSize: "A4",
    orientation: "portrait",
    margins: "normal",
    primaryColor: "#334155",
    fontFamily: "Outfit, sans-serif",
    headerTitle: "TAX INVOICE",
    storeName: "Smart Slate Retail",
    storeAddress: "Main Market, Proddatur, AP",
    storePhone: "9849344919",
    themeName: "clean_slate",
    fields: { ...DEFAULT_ELEMENT_TOGGLES },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-inv-emerald-corp",
    name: "Emerald Corporate Theme",
    category: "invoices",
    docType: "invoice",
    description: "Modern corporate green theme with emerald headers, clean borders, and statutory GST badges.",
    isDefault: false,
    paperSize: "A4",
    orientation: "portrait",
    margins: "normal",
    primaryColor: "#047857",
    fontFamily: "Inter, sans-serif",
    headerTitle: "TAX INVOICE (GST)",
    storeName: "Smart Green Commercials",
    storeAddress: "Green Valley Plaza, Hyderabad",
    storePhone: "9849344919",
    gstin: "36AAACH694G1Z4",
    themeName: "emerald_corp",
    fields: { ...DEFAULT_ELEMENT_TOGGLES, showTaxSplit: true, showBankDetails: true },
    createdAt: new Date().toISOString(),
  },

  // ─── 2. POS THERMAL RECEIPTS ───
  {
    id: "tpl-thm-80-std",
    name: "80mm POS Standard",
    category: "thermal",
    docType: "thermal",
    description: "Standard 3-inch roll receipt with barcode, QR payment, and itemized tax summary.",
    isDefault: true,
    paperSize: "80mm",
    orientation: "portrait",
    margins: "narrow",
    primaryColor: "#18181b",
    fontFamily: "monospace",
    headerTitle: "CASH RECEIPT",
    storeName: "Smart Bazaar POS",
    storeAddress: "KK Street, Proddatur, AP",
    storePhone: "9849344919",
    gstin: "37AAFCOE694G1Z4",
    footerText: "Save Paper, Save Trees!",
    thankYouNote: "Thank You! Visit Again!",
    themeName: "modern",
    fields: { ...DEFAULT_ELEMENT_TOGGLES, showTerms: false, showProductImage: false },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-thm-80-tax",
    name: "80mm Detailed Tax Slip",
    category: "thermal",
    docType: "thermal",
    description: "3-inch thermal receipt with complete CGST and SGST statutory item split.",
    isDefault: false,
    paperSize: "80mm",
    orientation: "portrait",
    margins: "narrow",
    primaryColor: "#0f172a",
    fontFamily: "monospace",
    headerTitle: "TAX RECEIPT",
    storeName: "Smart Bazaar Retail",
    storeAddress: "Proddatur, AP",
    storePhone: "9849344919",
    gstin: "37AAFCOE694G1Z4",
    themeName: "adv_gst",
    fields: { ...DEFAULT_ELEMENT_TOGGLES, showTaxSplit: true },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-thm-58-compact",
    name: "58mm Compact Mobile Slip",
    category: "thermal",
    docType: "thermal",
    description: "2-inch mini thermal slip optimized for handheld Bluetooth mobile billing printers.",
    isDefault: false,
    paperSize: "58mm",
    orientation: "portrait",
    margins: "none",
    primaryColor: "#000000",
    fontFamily: "monospace",
    headerTitle: "BILL",
    storeName: "Smart Bazaar",
    storeAddress: "Proddatur",
    storePhone: "9849344919",
    themeName: "compact",
    fields: { ...DEFAULT_ELEMENT_TOGGLES, showTerms: false, showProductImage: false, showSignature: false },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-thm-80-kot",
    name: "80mm Restaurant KOT Slip",
    category: "thermal",
    docType: "thermal",
    description: "Kitchen Order Ticket (KOT) format with table number, steward name, and item modifiers.",
    isDefault: false,
    paperSize: "80mm",
    orientation: "portrait",
    margins: "narrow",
    primaryColor: "#dc2626",
    fontFamily: "monospace",
    headerTitle: "KITCHEN ORDER TICKET",
    storeName: "Smart Restaurant & Cafe",
    storeAddress: "Table #12 | Steward: Alex",
    themeName: "simple",
    fields: { ...DEFAULT_ELEMENT_TOGGLES, showTaxSplit: false, showTotals: false },
    createdAt: new Date().toISOString(),
  },

  // ─── 3. PRODUCT BARCODE LABELS ───
  {
    id: "tpl-bar-trendy-offer",
    name: "Trendy Retail Tag (Centered SP & MRP)",
    category: "barcodes",
    docType: "barcode",
    description: "Apparel & retail dual/single tag with centered Store Name, Product Name, and inline SP & MRP pricing.",
    isDefault: true,
    paperSize: "50x25mm",
    labelWidthMm: 50,
    labelHeightMm: 25,
    labelLayout: "1up",
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
    id: "tpl-bar-std",
    name: "Standard 2x1 Inch Tag (50x25mm)",
    category: "barcodes",
    docType: "barcode",
    description: "Standard 50mm x 25mm product sticker with Code-128 barcode, MRP and Selling Price.",
    isDefault: false,
    paperSize: "50x25mm",
    labelWidthMm: 50,
    labelHeightMm: 25,
    labelLayout: "1up",
    orientation: "landscape",
    margins: "none",
    primaryColor: "#000000",
    fontFamily: "Inter, sans-serif",
    storeName: "Smart Bazaar",
    customTaglineText: "100% Genuine Quality",
    themeName: "modern",
    fields: { ...DEFAULT_ELEMENT_TOGGLES },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-bar-apparel",
    name: "Jewelry & Apparel Tag (38x25mm)",
    category: "barcodes",
    docType: "barcode",
    description: "Compact sticker layout for jewelry items, accessories, and apparel tags.",
    isDefault: false,
    paperSize: "38x25mm",
    labelWidthMm: 38,
    labelHeightMm: 25,
    labelLayout: "1up",
    orientation: "landscape",
    margins: "none",
    primaryColor: "#000000",
    fontFamily: "Inter, sans-serif",
    storeName: "Smart Apparel",
    customTaglineText: "SIZE: L | COLOR: BLUE",
    themeName: "compact",
    fields: { ...DEFAULT_ELEMENT_TOGGLES },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-bar-cargo",
    name: "Large Cargo Pallet Tag (100x50mm)",
    category: "barcodes",
    docType: "barcode",
    description: "High-visibility 4x2 inch tag for warehouse pallets, batch crates, and heavy cartons.",
    isDefault: false,
    paperSize: "100x50mm",
    labelWidthMm: 100,
    labelHeightMm: 50,
    labelLayout: "1up",
    orientation: "landscape",
    margins: "narrow",
    primaryColor: "#0f172a",
    fontFamily: "Inter, sans-serif",
    storeName: "Smart Bazaar Logistics",
    customTaglineText: "FRAGILE / HANDLE WITH CARE",
    themeName: "advanced",
    fields: { ...DEFAULT_ELEMENT_TOGGLES },
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
    id: "tpl-qr-bin",
    name: "Warehouse Bin QR Tag (75x50mm)",
    category: "qrcodes",
    docType: "qrcode",
    description: "3-inch QR label for warehouse rack/shelf location mapping and inventory scans.",
    isDefault: false,
    paperSize: "75x50mm",
    orientation: "landscape",
    margins: "narrow",
    primaryColor: "#0f172a",
    fontFamily: "Inter, sans-serif",
    storeName: "SMART LOGISTICS HUB",
    customTaglineText: "AISLE 4 - RACK B - BIN 09",
    themeName: "advanced",
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
    type: "custom",
    category: "custom",
    label: "Custom Document",
    subtitle: "Create your own template",
    icon: FilePlus2,
  },
];

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

export function PrintTemplates() {
  const { t } = useI18n();
  const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();
  const tenantId = tenant?.id || "default";

  // Navigation / Selection State
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>("invoice");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [activeEditorTab, setActiveEditorTab] = useState<"design" | "content" | "branding" | "settings">("design");
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isTemplateStoreModalOpen, setIsTemplateStoreModalOpen] = useState(false);
  const [isPdfOverlayModalOpen, setIsPdfOverlayModalOpen] = useState(false);
  const [isBarcodeCustomizerModalOpen, setIsBarcodeCustomizerModalOpen] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState<boolean>(false);

  // Template Storage with automatic migration & normalization
  const [templates, setTemplates] = useState<PrintTemplate[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`businessos_print_templates_v1_${tenantId}`) ||
                    localStorage.getItem(`businessos_print_templates_v1`);
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
                docType,
                themeName,
                primaryColor: t.primaryColor || base?.primaryColor || "#4f46e5",
                fontFamily: t.fontFamily || base?.fontFamily || "Inter, sans-serif",
                fields: { ...DEFAULT_ELEMENT_TOGGLES, ...(base?.fields || {}), ...(t.fields || {}) },
              };
            });
            const existingIds = new Set(normalizedSaved.map((t: any) => t.id));
            const missing = INITIAL_TEMPLATES.filter((t) => !existingIds.has(t.id));
            return [...normalizedSaved, ...missing];
          }
        } catch (e) {}
      }
    }
    return INITIAL_TEMPLATES;
  });

  // User-Active Defaults Mapping
  const [userActiveDefaults, setUserActiveDefaults] = useState<Record<string, string>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`user_active_print_templates_v1_${tenantId}`);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
    }
    return {};
  });

  // Filter templates for current selected category/doctype
  const currentCategoryTemplates = templates.filter(
    (t) =>
      t.docType === selectedDocType ||
      t.category === selectedDocType ||
      (selectedDocType === "invoice" && t.category === "invoices") ||
      (selectedDocType === "barcode" && t.category === "barcodes") ||
      (selectedDocType === "qrcode" && t.category === "qrcodes")
  );

  // Directly track active template ID
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
    const activeUserTplId = userActiveDefaults[selectedDocType];
    const match =
      currentCategoryTemplates.find((t) => t.id === activeUserTplId) ||
      currentCategoryTemplates.find((t) => t.isDefault) ||
      currentCategoryTemplates[0] ||
      INITIAL_TEMPLATES[0];
    return match.id;
  });

  // When selectedDocType changes, pick the active/default template for that category
  useEffect(() => {
    const list = templates.filter(
      (t) =>
        t.docType === selectedDocType ||
        t.category === selectedDocType ||
        (selectedDocType === "invoice" && t.category === "invoices") ||
        (selectedDocType === "barcode" && t.category === "barcodes") ||
        (selectedDocType === "qrcode" && t.category === "qrcodes")
    );
    const activeUserTplId = userActiveDefaults[selectedDocType];
    const match =
      list.find((t) => t.id === activeUserTplId) ||
      list.find((t) => t.isDefault) ||
      list[0] ||
      INITIAL_TEMPLATES.find((t) => t.docType === selectedDocType) ||
      INITIAL_TEMPLATES[0];
    setSelectedTemplateId(match.id);
  }, [selectedDocType]);

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
              map.set(t.id, { ...(existing || {}), ...t });
            }
          });
          return Array.from(map.values());
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
        setUserActiveDefaults((prev) => ({ ...prev, ...unifiedMap }));

        // Automatically select the organization active template for the current category!
        const activeId = unifiedMap[selectedDocType] || (selectedDocType === "barcode" ? unifiedMap.barcodes : unifiedMap.invoices);
        if (activeId) {
          setSelectedTemplateId(activeId);
        }
      }
    }).catch(() => {});
  }, [tenantId, selectedDocType]);

  // Derived active template object
  const activeTemplate: PrintTemplate =
    templates.find((t) => t.id === selectedTemplateId) ||
    currentCategoryTemplates[0] ||
    INITIAL_TEMPLATES[0];

  // Persist templates to localStorage and backend database
  const persistTemplates = (newTemplates: PrintTemplate[]) => {
    setTemplates(newTemplates);
    const currentActive = newTemplates.find((t) => t.id === selectedTemplateId) || activeTemplate;
    try {
      localStorage.setItem(`businessos_print_templates_v1_${tenantId}`, JSON.stringify(newTemplates));
      localStorage.setItem(`businessos_print_templates_v1`, JSON.stringify(newTemplates));
      if (selectedDocType === "invoice" || currentActive?.category === "invoices" || currentActive?.docType === "invoice") {
        const nextDefaults = {
          ...userActiveDefaults,
          [selectedDocType]: currentActive.id,
          invoices: currentActive.id,
          invoice: currentActive.id,
        };
        setUserActiveDefaults(nextDefaults);
        localStorage.setItem(`user_active_print_templates_v1_${tenantId}`, JSON.stringify(nextDefaults));
        localStorage.setItem(`user_active_print_templates_v1`, JSON.stringify(nextDefaults));
        localStorage.setItem(`bos_active_invoice_template_id_${tenantId}`, currentActive.id);
        localStorage.setItem("bos_active_invoice_template_id", currentActive.id);
        localStorage.setItem("bos_default_inv_template_id", currentActive.id);
        invoicesApi.setActivePrintTemplate(currentActive.id).catch(() => {});
        printTemplatesApi.setActiveTemplate(currentActive.id, "invoices").catch(() => {});
      } else if (selectedDocType === "barcode" || currentActive?.category === "barcodes" || currentActive?.docType === "barcode") {
        const nextDefaults = {
          ...userActiveDefaults,
          [selectedDocType]: currentActive.id,
          barcodes: currentActive.id,
          barcode: currentActive.id,
        };
        setUserActiveDefaults(nextDefaults);
        localStorage.setItem(`user_active_print_templates_v1_${tenantId}`, JSON.stringify(nextDefaults));
        localStorage.setItem(`user_active_print_templates_v1`, JSON.stringify(nextDefaults));
        localStorage.setItem("bos_active_barcode_template_id", currentActive.id);
        printTemplatesApi.setActiveTemplate(currentActive.id, "barcodes").catch(() => {});
      }

      // Persist to backend PostgreSQL DB for the organization
      if (currentActive) {
        const category = (selectedDocType === "barcode" || currentActive.category === "barcodes") ? "barcodes" : "invoices";
        printTemplatesApi.saveTemplate(currentActive, Boolean(currentActive.isDefault)).catch(() => {});
      }

      window.dispatchEvent(new CustomEvent("print_templates_updated", { detail: { template: currentActive } }));
      window.dispatchEvent(new CustomEvent("bos_invoice_template_changed", { detail: { templateId: currentActive.id } }));
      window.dispatchEvent(new CustomEvent("bos_barcode_template_changed", { detail: { templateId: currentActive.id } }));
    } catch (e) {}
  };

  // Field Toggles updater
  const toggleElementField = (fieldKey: keyof PrintTemplate["fields"]) => {
    const nextFields = {
      ...activeTemplate.fields,
      [fieldKey]: !activeTemplate.fields[fieldKey],
    };
    const updatedTemplates = templates.map((t) =>
      t.id === activeTemplate.id ? { ...t, fields: nextFields } : t
    );
    persistTemplates(updatedTemplates);
  };

  // Property updater
  const updateTemplateProperty = <K extends keyof PrintTemplate>(key: K, value: PrintTemplate[K]) => {
    const updatedTemplates = templates.map((t) =>
      t.id === activeTemplate.id ? { ...t, [key]: value } : t
    );
    persistTemplates(updatedTemplates);
  };

  const [designSelectionMode, setDesignSelectionMode] = useState<"themes" | "custom">("themes");
  const [selectedThemeStoreId, setSelectedThemeStoreId] = useState<string | null>(activeTemplate.decorativeThemeId || null);
  const themeStoreScrollRef = useRef<HTMLDivElement>(null);
  const themesScrollRef = useRef<HTMLDivElement>(null);

  // Barcode In-Page Studio State & Handlers
  const [selectedBarcodeElementKey, setSelectedBarcodeElementKey] = useState<string>("el_product_name");
  const [barcodeSubTab, setBarcodeSubTab] = useState<"layers" | "typography" | "barcode" | "pricing" | "paper">("layers");
  const [isBarcodeAddMenuOpen, setIsBarcodeAddMenuOpen] = useState<boolean>(false);
  const [realCatalogProducts, setRealCatalogProducts] = useState<any[]>([]);
  const [selectedSampleProductIdx, setSelectedSampleProductIdx] = useState<number>(0);

  useEffect(() => {
    inventoryApi.getBarcodes().then((items) => {
      if (items && items.length > 0) {
        setRealCatalogProducts(items.filter((p) => Boolean(p.barcode)));
      }
    }).catch(() => {});
  }, []);

  const currentBarcodeElements: BarcodeElementBlock[] =
    (activeTemplate.elements && Array.isArray(activeTemplate.elements) && activeTemplate.elements.length > 0)
      ? activeTemplate.elements.filter((el) => {
          if (el.visible === false) return false;
          if (el.id === "el_sku" && activeTemplate?.fields?.showSKU !== true && activeTemplate?.fields?.showHSN !== true) return false;
          if (el.type === "sku" && activeTemplate?.fields?.showSKU !== true) return false;
          if (el.type === "hsn" && activeTemplate?.fields?.showHSN !== true) return false;
          if (el.id === "el_footer" && activeTemplate?.fields?.showCustomTagline !== true && activeTemplate?.fields?.showMfgExpDate !== true) return false;
          return true;
        })
      : getDefaultBarcodeElements(activeTemplate).filter((el) => {
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

  // Scroll ThemeStore carousel
  const handleScrollThemeStore = (direction: "left" | "right") => {
    if (themeStoreScrollRef.current) {
      const offset = direction === "left" ? -160 : 160;
      themeStoreScrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  // Scroll Themes preset carousel
  const handleScrollThemes = (direction: "left" | "right") => {
    if (themesScrollRef.current) {
      const offset = direction === "left" ? -200 : 200;
      themesScrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  // Switch to specific template in active category
  const handleSelectTemplate = (tpl: PrintTemplate) => {
    setSelectedTemplateId(tpl.id);
    const isBarcode = tpl.docType === "barcode" || tpl.category === "barcodes" || selectedDocType === "barcode";
    const nextUserActive = {
      ...userActiveDefaults,
      [selectedDocType]: tpl.id,
      [tpl.docType || selectedDocType]: tpl.id,
      ...(isBarcode ? { barcodes: tpl.id, barcode: tpl.id } : { invoices: tpl.id, invoice: tpl.id })
    };
    setUserActiveDefaults(nextUserActive);
    try {
      localStorage.setItem(`user_active_print_templates_v1_${tenantId}`, JSON.stringify(nextUserActive));
      localStorage.setItem(`user_active_print_templates_v1`, JSON.stringify(nextUserActive));
      if (tpl.docType === "invoice" || tpl.category === "invoices") {
        localStorage.setItem(`bos_active_invoice_template_id_${tenantId}`, tpl.id);
        localStorage.setItem("bos_active_invoice_template_id", tpl.id);
        localStorage.setItem("bos_default_inv_template_id", tpl.id);
        invoicesApi.setActivePrintTemplate(tpl.id).catch(() => {});
      } else if (isBarcode) {
        localStorage.setItem("bos_active_barcode_template_id", tpl.id);
      }
      window.dispatchEvent(new CustomEvent("print_templates_updated", { detail: { template: tpl } }));
      window.dispatchEvent(new CustomEvent("bos_invoice_template_changed", { detail: { templateId: tpl.id } }));
      window.dispatchEvent(new CustomEvent("bos_barcode_template_changed", { detail: { templateId: tpl.id } }));
    } catch {}
    toast.info(`Switched to "${tpl.name}" layout`);
  };

  // Set as Organization Default
  const handleSetOrgDefault = async (tplId: string) => {
    const isBarcode = selectedDocType === "barcode" || activeTemplate.category === "barcodes";
    const updated = templates.map((t) => {
      if (t.docType === selectedDocType || t.category === activeTemplate.category) {
        return { ...t, isDefault: t.id === tplId };
      }
      return t;
    });
    persistTemplates(updated);
    const targetTpl = updated.find((t) => t.id === tplId) || activeTemplate;
    const category = isBarcode ? "barcodes" : "invoices";
    try {
      await printTemplatesApi.setActiveTemplate(tplId, category);
      await printTemplatesApi.saveTemplate(targetTpl, true);
    } catch (e) {
      console.warn("Backend setActiveTemplate error:", e);
    }
    if (selectedDocType === "invoice" || activeTemplate.category === "invoices") {
      try {
        localStorage.setItem(`bos_active_invoice_template_id_${tenantId}`, tplId);
        localStorage.setItem("bos_active_invoice_template_id", tplId);
        localStorage.setItem("bos_default_inv_template_id", tplId);
        invoicesApi.setActivePrintTemplate(tplId).catch(() => {});
      } catch {}
    } else if (isBarcode) {
      try {
        localStorage.setItem("bos_active_barcode_template_id", tplId);
        setActiveBarcodeTemplate(tplId);
      } catch {}
    }
    toast.success(`"${targetTpl.name}" is now the Organization Master Default!`);
  };

  // Set as Active for Me
  const handleSetActiveForMe = (tplId: string) => {
    const isBarcode = selectedDocType === "barcode" || activeTemplate.category === "barcodes";
    const nextDefaults = {
      ...userActiveDefaults,
      [selectedDocType]: tplId,
      ...(isBarcode ? { barcodes: tplId, barcode: tplId } : { invoices: tplId, invoice: tplId })
    };
    setUserActiveDefaults(nextDefaults);
    try {
      localStorage.setItem(`user_active_print_templates_v1_${tenantId}`, JSON.stringify(nextDefaults));
      localStorage.setItem(`user_active_print_templates_v1`, JSON.stringify(nextDefaults));
      if (selectedDocType === "invoice" || activeTemplate.category === "invoices") {
        localStorage.setItem(`bos_active_invoice_template_id_${tenantId}`, tplId);
        localStorage.setItem("bos_active_invoice_template_id", tplId);
        localStorage.setItem("bos_default_inv_template_id", tplId);
        invoicesApi.setActivePrintTemplate(tplId).catch(() => {});
      } else if (isBarcode) {
        localStorage.setItem("bos_active_barcode_template_id", tplId);
      }
      window.dispatchEvent(new CustomEvent("print_templates_updated", { detail: { template: activeTemplate } }));
      window.dispatchEvent(new CustomEvent("bos_invoice_template_changed", { detail: { templateId: tplId } }));
      window.dispatchEvent(new CustomEvent("bos_barcode_template_changed", { detail: { templateId: tplId } }));
    } catch {}
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
    printTemplatesApi.deleteTemplate(tplId, selectedDocType).catch(() => {});
    toast.success("Template deleted.");
  };

  // Save current template changes
  const handleSaveTemplate = async () => {
    persistTemplates(templates);
    const isBarcode = selectedDocType === "barcode" || activeTemplate.category === "barcodes";
    if (isBarcode) {
      saveBarcodeTemplate(activeTemplate as any, Boolean(activeTemplate.isDefault));
      setActiveBarcodeTemplate(activeTemplate.id);
    }
    try {
      await printTemplatesApi.saveTemplate(activeTemplate as any, Boolean(activeTemplate.isDefault));
      await printTemplatesApi.setActiveTemplate(activeTemplate.id, isBarcode ? "barcodes" : "invoices");
    } catch (e) {
      console.warn("Backend template persistence deferred:", e);
    }
    toast.success(`Template "${activeTemplate.name}" saved to organization cloud!`);
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

  // Preview in new browser tab / window
  const handlePreviewNewTab = () => {
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

  const isBarcodeTemplate = selectedDocType === "barcode" || activeTemplate?.category === "barcodes" || activeTemplate?.docType === "barcode";

  return (
    <div className="flex flex-col gap-6 min-h-[calc(100vh-130px)] pb-10 text-foreground">
      {/* ─── Standard Tab Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
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
          >
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            Preview in New Tab
          </button>

          <button
            onClick={handleResetTemplate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/70 transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
            Reset
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

      {/* ─── 3-Column Main Workspace ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* ── COLUMN 1: Template Type Sidebar (Collapsible & Compact) ── */}
        {isSidebarCollapsed ? (
          <div className="lg:col-span-1 bg-card border border-border/80 rounded-2xl p-2 shadow-sm flex flex-col items-center gap-2">
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
                const count = templates.filter((t) => t.docType === doc.type || t.category === doc.category).length;
                return (
                  <button
                    key={doc.type}
                    onClick={() => setSelectedDocType(doc.type)}
                    title={`${doc.label} (${count} templates)`}
                    className={`relative w-9 h-9 flex items-center justify-center rounded-xl border transition-all cursor-pointer ${
                      isActive
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
          <div className="lg:col-span-2 bg-card border border-border/80 rounded-2xl p-3 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between px-1 pb-1 border-b border-border/40">
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

            <div className="space-y-1">
              {DOCUMENT_TYPES_CONFIG.map((doc) => {
                const IconComp = doc.icon;
                const isActive = selectedDocType === doc.type;
                const count = templates.filter((t) => t.docType === doc.type || t.category === doc.category).length;
                return (
                  <button
                    key={doc.type}
                    onClick={() => setSelectedDocType(doc.type)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl border transition-all text-left cursor-pointer ${
                      isActive
                        ? "border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 shadow-sm"
                        : "border-border/60 bg-card hover:bg-muted/40 hover:border-border text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-lg shrink-0 transition-colors ${
                          isActive
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <IconComp className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 pr-0.5">
                        <div className="text-[11px] font-bold truncate leading-snug flex items-center gap-1">
                          {doc.label}
                          <span className="text-[9px] font-normal px-1 py-0.2 rounded-full bg-muted text-muted-foreground">
                            {count}
                          </span>
                        </div>
                        <div className="text-[9px] text-muted-foreground truncate leading-tight mt-0.5">
                          {doc.subtitle}
                        </div>
                      </div>
                    </div>
                    <ChevronRight
                      className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                        isActive ? "text-indigo-600 dark:text-indigo-400 translate-x-0.5" : "text-muted-foreground/40"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── COLUMN 2: Editor Customization Center Panel ── */}
        <div className="lg:col-span-5 bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-6">
          
          {/* Top Pill Navigation Tabs */}
          <div className="flex items-center p-1 bg-muted/50 rounded-xl border border-border/50 gap-1">
            <button
              onClick={() => setActiveEditorTab("design")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeEditorTab === "design"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Edit3 className="h-3.5 w-3.5" />
              Design
            </button>
            <button
              onClick={() => setActiveEditorTab("content")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeEditorTab === "content"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Content
            </button>
            <button
              onClick={() => setActiveEditorTab("branding")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeEditorTab === "branding"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Palette className="h-3.5 w-3.5" />
              Branding
            </button>
            <button
              onClick={() => setActiveEditorTab("settings")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeEditorTab === "settings"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </button>
          </div>

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
              {!activeTemplate.isDefault && (
                <button
                  onClick={() => handleSetOrgDefault(activeTemplate.id)}
                  title="Make Organization Master Default"
                  className="px-2 py-1 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-primary text-[10px] font-semibold cursor-pointer"
                >
                  Make Org Default
                </button>
              )}
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

          {/* ── TAB 1: DESIGN (Option 1: Backgrounds & Colors & ThemeStore + Option 2: Page Template & Table Format) ── */}
          {activeEditorTab === "design" && (
            <div className="space-y-5">
              
              {/* ── TOP SECTION: 🏪 ThemeStore (Backgrounds & Decorative Themes) ── */}
              <div className="space-y-3 p-3.5 bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-purple-500/5 border border-amber-500/20 rounded-2xl shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">🏪</span>
                    <h3 className="text-xs font-black tracking-tight text-foreground flex items-center gap-1">
                      ThemeStore
                      <span className="text-[10px] text-muted-foreground font-normal cursor-help" title="Cultural, Vedic, Regional & Luxury Decorative Background Themes">
                        <HelpCircle className="h-3 w-3 inline text-muted-foreground/70" />
                      </span>
                    </h3>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleScrollThemeStore("left")}
                      className="p-1 rounded-full border border-border hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Scroll Left"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleScrollThemeStore("right")}
                      className="p-1 rounded-full border border-border hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Scroll Right"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Horizontal Scrollable Carousel of ThemeStore Backgrounds */}
                <div
                  ref={themeStoreScrollRef}
                  className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-thin scroll-smooth"
                >
                  {THEME_STORE_BACKGROUNDS.map((item) => {
                    const isSelected = activeTemplate.themeName === item.themeStyle || selectedThemeStoreId === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelectThemeStoreItem(item)}
                        className="flex flex-col items-center gap-1.5 cursor-pointer group shrink-0 w-[92px]"
                      >
                        <div
                          className={`relative w-full aspect-[4/5] rounded-xl border p-1.5 flex flex-col justify-between transition-all overflow-hidden shadow-2xs ${
                            isSelected
                              ? "border-amber-600 bg-amber-50/80 dark:bg-amber-950/40 ring-2 ring-amber-500/40 shadow-sm scale-102"
                              : "border-border/70 bg-card hover:border-amber-400 hover:bg-amber-50/30"
                          }`}
                        >
                          {/* Mini Cultural Decorative Artwork Preview Card */}
                          <div className={`w-full h-full rounded-lg bg-gradient-to-br ${item.previewGradient} border border-amber-300/40 p-1 flex flex-col justify-between overflow-hidden relative`}>
                            {/* Auspicious Ornamental Corner Motif */}
                            <div className="flex justify-between items-center text-[7px] font-bold text-amber-800/80">
                              <span>{item.iconType === "none" ? "CLEAN" : "॥ श्री ॥"}</span>
                              {item.badge && (
                                <span className="text-[6px] font-black px-1 py-0.2 rounded-full bg-amber-600 text-white leading-none">
                                  {item.badge}
                                </span>
                              )}
                            </div>

                            {/* Center Motif Artwork representation */}
                            <div className="flex flex-col items-center justify-center my-auto text-center opacity-85">
                              {item.iconType === "none" && <span className="text-sm leading-none">📄</span>}
                              {item.iconType === "jain" && <span className="text-sm leading-none">🛕</span>}
                              {item.iconType === "maharashtra" && <span className="text-sm leading-none">🚩</span>}
                              {item.iconType === "ganesh" && <span className="text-sm leading-none">🕉️</span>}
                              {item.iconType === "hindu_god" && <span className="text-sm leading-none">🪷</span>}
                              {item.iconType === "shubh_labh" && <span className="text-sm leading-none">✨</span>}
                              {item.iconType === "royal_gold" && <span className="text-sm leading-none">👑</span>}
                              {item.iconType === "corporate" && <span className="text-sm leading-none">🏛️</span>}
                            </div>

                            {/* Mini Table Lines */}
                            <div className="space-y-0.5 w-full">
                              <div className="w-full h-0.5 bg-amber-800/20 rounded-full" />
                              <div className="w-3/4 h-0.5 bg-amber-800/20 rounded-full" />
                            </div>
                          </div>

                          {/* Selected Checkmark Badge */}
                          {isSelected && (
                            <div className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-600 text-white shadow">
                              <Check className="h-2.5 w-2.5 stroke-[3]" />
                            </div>
                          )}
                        </div>
                        <span
                          className={`text-[10px] font-bold text-center leading-tight truncate w-full ${
                            isSelected ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground group-hover:text-foreground"
                          }`}
                          title={item.name}
                        >
                          {item.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── 2 OPTIONS SELECTOR (Option 1: Themes + Option 2: Custom Columns Table) ── */}
              <div className="space-y-4">
                
                {/* ── OPTION 1: 🔘 Themes (Standard Structural Layout Presets) ── */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  designSelectionMode === "themes"
                    ? "border-indigo-600/40 bg-indigo-500/5 shadow-xs"
                    : "border-border/60 bg-card hover:border-border"
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <label 
                      onClick={() => setDesignSelectionMode("themes")}
                      className="flex items-center gap-2.5 cursor-pointer select-none"
                    >
                      <input
                        type="radio"
                        name="designModeSelection"
                        checked={designSelectionMode === "themes"}
                        onChange={() => setDesignSelectionMode("themes")}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className="text-xs font-black text-foreground tracking-tight">Themes</span>
                    </label>

                    {/* Left/Right Carousel Scroll Arrows */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleScrollThemes("left")}
                        className="p-1 rounded-full border border-border hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Scroll Left"
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleScrollThemes("right")}
                        className="p-1 rounded-full border border-border hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Scroll Right"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Horizontal Scrollable Carousel of Standard Structural Layout Cards */}
                  <div
                    ref={themesScrollRef}
                    className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin scroll-smooth"
                  >
                    {currentCategoryTemplates.map((tpl) => {
                      const isSelected = activeTemplate.id === tpl.id;
                      const isLuxuryTheme = tpl.themeName === "luxury" || tpl.name.toLowerCase().includes("luxury");
                      const isTallyTheme = tpl.themeName === "adv_tally" || tpl.name.toLowerCase().includes("tally");
                      const themeColor = tpl.primaryColor || "#2563eb";

                      return (
                        <div
                          key={tpl.id}
                          onClick={() => {
                            setDesignSelectionMode("themes");
                            handleSelectTemplate(tpl);
                          }}
                          className="flex flex-col items-center gap-1.5 cursor-pointer group shrink-0 w-[114px]"
                        >
                          <div
                            className={`relative w-full aspect-[4/5] rounded-xl border p-2 flex flex-col justify-between transition-all overflow-hidden ${
                              isSelected
                                ? "border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/40 shadow-sm scale-102"
                                : "border-border/80 bg-background hover:border-indigo-400 hover:bg-muted/40 shadow-2xs"
                            }`}
                          >
                            {/* NEW Ribbon Tag for Luxury theme */}
                            {isLuxuryTheme && (
                              <div className="absolute top-0 left-0 z-10">
                                <span className="text-[6.5px] font-black uppercase px-1.5 py-0.5 rounded-br-md bg-red-600 text-white shadow-2xs tracking-wider">
                                  NEW
                                </span>
                              </div>
                            )}

                            {/* Mini Realistic Wireframe Representation matching SS1 */}
                            <div
                              className={`w-full h-full flex flex-col justify-between p-1.5 rounded-lg border text-[5px] font-mono transition-all select-none ${
                                isLuxuryTheme
                                  ? "border-amber-200/90 text-amber-950/70"
                                  : isTallyTheme
                                  ? "border-slate-300 text-slate-700"
                                  : "border-slate-200 text-slate-600"
                              }`}
                              style={{
                                backgroundColor: isLuxuryTheme
                                  ? "#fffdf5"
                                  : tpl.paperBgColor || "#ffffff",
                              }}
                            >
                              {/* 1. Header Section */}
                              <div className="space-y-0.5">
                                <div className="flex items-start justify-between gap-1">
                                  {/* Left Logo + Company info lines */}
                                  <div className="flex items-center gap-1 min-w-0">
                                    <div
                                      className="w-3 h-3 rounded-xs shrink-0 flex items-center justify-center text-[5px]"
                                      style={{
                                        backgroundColor: isLuxuryTheme
                                          ? "#fef3c7"
                                          : isTallyTheme
                                          ? "#e2e8f0"
                                          : `${themeColor}20`,
                                        border: `0.5px solid ${isLuxuryTheme ? "#d97706" : themeColor}40`,
                                      }}
                                    >
                                      <div
                                        className="w-1.5 h-1.5 rounded-2xs"
                                        style={{
                                          backgroundColor: isLuxuryTheme ? "#d97706" : themeColor,
                                        }}
                                      />
                                    </div>
                                    <div className="space-y-0.5">
                                      <div
                                        className="h-1 w-6 rounded-2xs"
                                        style={{
                                          backgroundColor: isLuxuryTheme ? "#b45309" : isTallyTheme ? "#334155" : themeColor,
                                          opacity: 0.85,
                                        }}
                                      />
                                      <div className="h-0.5 w-8 bg-slate-200 rounded-2xs" />
                                    </div>
                                  </div>

                                  {/* Right Invoice metadata lines */}
                                  <div className="space-y-0.5 text-right shrink-0">
                                    <div className="h-0.5 w-4 bg-slate-300 rounded-2xs ml-auto" />
                                    <div className="h-0.5 w-5 bg-slate-200 rounded-2xs ml-auto" />
                                  </div>
                                </div>

                                {/* 2. Bill To / Ship To Divider */}
                                <div
                                  className={`pt-0.5 border-t ${
                                    isLuxuryTheme
                                      ? "border-amber-200/80"
                                      : isTallyTheme
                                      ? "border-slate-300"
                                      : "border-slate-100"
                                  }`}
                                >
                                  <div className="flex justify-between items-center text-[3.8px] font-bold tracking-tight text-slate-400">
                                    <span>BILL TO</span>
                                    <span>SHIP TO</span>
                                  </div>
                                  <div className="flex justify-between items-center pt-0.2">
                                    <div className="h-0.5 w-6 bg-slate-200 rounded-2xs" />
                                    <div className="h-0.5 w-6 bg-slate-200 rounded-2xs" />
                                  </div>
                                </div>
                              </div>

                              {/* 3. Item Table Grid */}
                              <div
                                className={`border rounded-xs overflow-hidden my-0.5 ${
                                  isLuxuryTheme
                                    ? "border-amber-300/80 divide-y divide-amber-200"
                                    : isTallyTheme
                                    ? "border-slate-300 divide-y divide-slate-200"
                                    : "border-slate-200 divide-y divide-slate-100"
                                }`}
                              >
                                {/* Table Header Row with 4 columns */}
                                <div
                                  className="h-1.5 flex items-center divide-x px-0.5"
                                  style={{
                                    backgroundColor: isLuxuryTheme
                                      ? "#fef3c7"
                                      : isTallyTheme
                                      ? "#f1f5f9"
                                      : `${themeColor}18`,
                                    borderBottom: `0.5px solid ${isLuxuryTheme ? "#d97706" : themeColor}40`,
                                    borderColor: isLuxuryTheme ? "#fde68a" : isTallyTheme ? "#cbd5e1" : `${themeColor}30`,
                                  }}
                                >
                                  <div className="w-1/2 h-0.5 bg-slate-400/70 rounded-2xs" />
                                  <div className="w-1/6 h-0.5 bg-slate-300 rounded-2xs pl-0.5" />
                                  <div className="w-1/6 h-0.5 bg-slate-300 rounded-2xs pl-0.5" />
                                  <div className="w-1/6 h-0.5 bg-slate-300 rounded-2xs pl-0.5" />
                                </div>

                                {/* Table Row 1 */}
                                <div
                                  className={`h-1.5 flex items-center divide-x px-0.5 ${
                                    isLuxuryTheme
                                      ? "bg-amber-50/40 divide-amber-100"
                                      : isTallyTheme
                                      ? "bg-white divide-slate-200"
                                      : "bg-slate-50/40 divide-slate-100"
                                  }`}
                                >
                                  <div className="w-1/2 h-0.5 bg-slate-200 rounded-2xs" />
                                  <div className="w-1/6 h-0.5 bg-slate-200 rounded-2xs pl-0.5" />
                                  <div className="w-1/6 h-0.5 bg-slate-200 rounded-2xs pl-0.5" />
                                  <div className="w-1/6 h-0.5 bg-slate-200 rounded-2xs pl-0.5" />
                                </div>

                                {/* Table Row 2 */}
                                <div
                                  className={`h-1.5 flex items-center divide-x px-0.5 ${
                                    isLuxuryTheme
                                      ? "bg-white divide-amber-100"
                                      : isTallyTheme
                                      ? "bg-slate-50/50 divide-slate-200"
                                      : "bg-white divide-slate-100"
                                  }`}
                                >
                                  <div className="w-1/2 h-0.5 bg-slate-200 rounded-2xs" />
                                  <div className="w-1/6 h-0.5 bg-slate-200 rounded-2xs pl-0.5" />
                                  <div className="w-1/6 h-0.5 bg-slate-200 rounded-2xs pl-0.5" />
                                  <div className="w-1/6 h-0.5 bg-slate-200 rounded-2xs pl-0.5" />
                                </div>
                              </div>

                              {/* 4. Footer & Total */}
                              <div className="flex items-end justify-between pt-0.5">
                                <div className="space-y-0.2">
                                  <div className="h-0.5 w-5 bg-slate-200 rounded-2xs" />
                                  <div className="h-0.5 w-3 bg-slate-200 rounded-2xs" />
                                </div>
                                <div className="text-right">
                                  <div className="h-0.5 w-4 bg-slate-200 rounded-2xs ml-auto mb-0.5" />
                                  <div
                                    className="font-bold text-[5.2px] leading-none"
                                    style={{
                                      color: isLuxuryTheme ? "#b45309" : isTallyTheme ? "#0f172a" : themeColor || "#1e293b",
                                    }}
                                  >
                                    ₹ 1000.00
                                  </div>
                                </div>
                              </div>
                            </div>

                            {isSelected && (
                              <div className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-white shadow">
                                <Check className="h-2.5 w-2.5 stroke-[3]" />
                              </div>
                            )}
                          </div>

                          <div className="text-center w-full">
                            <span className={`text-[10px] font-bold block truncate ${
                              isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-foreground"
                            }`}>
                              {tpl.name.replace(" Theme", "").replace(" Replica", "")}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* See All Card */}
                    <div
                      onClick={() => setIsTemplateStoreModalOpen(true)}
                      className="flex flex-col items-center gap-1.5 cursor-pointer group shrink-0 w-[114px]"
                    >
                      <div className="w-full aspect-[4/5] rounded-xl border border-dashed border-indigo-300 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/20 hover:bg-indigo-50/70 p-2 flex flex-col items-center justify-center text-center transition-all">
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline">
                          See All
                        </span>
                        <span className="text-[9px] text-muted-foreground mt-0.5">
                          +{currentCategoryTemplates.length} Styles
                        </span>
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground">More Styles</span>
                    </div>
                  </div>
                </div>

                {/* Direct In-Page Word Document Barcode Studio */}
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
                        { id: "layers", label: "🗂️ Move & Order" },
                        { id: "typography", label: "✍️ Typography & Text" },
                        { id: "barcode", label: "📊 Barcode Graphic" },
                        { id: "pricing", label: "💰 MRP & Badges" },
                        { id: "paper", label: "📏 Paper & Border" },
                      ].map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => setBarcodeSubTab(sub.id as any)}
                          className={`px-2.5 py-1.5 rounded-lg font-bold transition whitespace-nowrap ${
                            barcodeSubTab === sub.id
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
                              className={`px-3 py-1 rounded-lg text-xs font-black border transition ${
                                selectedBarcodeElement.showStrike === false || selectedBarcodeElement.textDecoration === "none"
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
                                className={`flex items-center justify-between p-1.5 rounded-lg text-xs cursor-pointer border transition ${
                                  isSel
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
                              className={`p-1.5 rounded text-xs font-black transition ${
                                selectedBarcodeElement?.fontWeight === "bold" || selectedBarcodeElement?.fontWeight === "900"
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
                              className={`p-1.5 rounded text-xs font-black transition ${
                                selectedBarcodeElement?.fontStyle === "italic"
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
                              className={`p-1.5 rounded text-xs font-black transition ${
                                selectedBarcodeElement?.textDecoration === "underline"
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
                              className={`p-1.5 rounded text-xs font-black transition ${
                                selectedBarcodeElement?.textDecoration === "line-through" ||
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
                              className={`px-2 py-1 rounded text-[10px] font-black uppercase transition ${
                                selectedBarcodeElement?.textTransform === "uppercase"
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
                                  className={`p-1.5 rounded border transition ${
                                    isSel ? "bg-blue-600 text-white border-blue-600" : "border-border text-foreground hover:bg-muted"
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
                              className={`px-3 py-1 rounded-lg text-xs font-black border transition ${
                                activeTemplate.showMrpStrike === false
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
                                className={`px-2 py-1 rounded text-xs font-bold border transition ${
                                  (activeTemplate.spBadgeStyle || "none") === s.id
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
                                className={`px-2 py-1 rounded text-xs font-bold border transition ${
                                  (activeTemplate.mrpStrikeColor || "gray") === c.id
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

                {/* ── OPTION 2: ⚪ Create Custom Theme & Column Table Formatter ── */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  designSelectionMode === "custom"
                    ? "border-indigo-600/40 bg-indigo-500/5 shadow-xs"
                    : "border-border/60 bg-card hover:border-border"
                }`}>
                  <label 
                    onClick={() => setDesignSelectionMode("custom")}
                    className="flex items-center gap-2.5 cursor-pointer select-none mb-3"
                  >
                    <input
                      type="radio"
                      name="designModeSelection"
                      checked={designSelectionMode === "custom"}
                      onChange={() => setDesignSelectionMode("custom")}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-foreground tracking-tight">Create Custom Theme</span>
                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </label>

                  <button
                    onClick={() => {
                      setDesignSelectionMode("custom");
                      handleDuplicateTemplate(activeTemplate);
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 mb-4 active:scale-98"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Create your own theme / Customize Columns
                  </button>

                  {/* ── Detailed Table Columns & Format Controls ── */}
                  <div className="space-y-4 pt-2 border-t border-border/60">
                    
                    {/* Item Table Column Toggles */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <TableIcon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                          <h4 className="text-xs font-bold text-foreground">{t("Table Columns & Fields", "Table Columns & Fields")}</h4>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-medium">Select columns to display</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <label className="flex items-center gap-2 p-2 rounded-xl border border-border/60 bg-background cursor-pointer hover:bg-muted/40 text-[11px] font-semibold text-foreground">
                          <input
                            type="checkbox"
                            checked={!!activeTemplate.fields.showItemTable}
                            onChange={() => toggleElementField("showItemTable")}
                            className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Item Table</span>
                        </label>

                        <label className="flex items-center gap-2 p-2 rounded-xl border border-border/60 bg-background cursor-pointer hover:bg-muted/40 text-[11px] font-semibold text-foreground">
                          <input
                            type="checkbox"
                            checked={!!activeTemplate.fields.showHSN}
                            onChange={() => toggleElementField("showHSN")}
                            className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>HSN / SAC Code</span>
                        </label>

                        <label className="flex items-center gap-2 p-2 rounded-xl border border-border/60 bg-background cursor-pointer hover:bg-muted/40 text-[11px] font-semibold text-foreground">
                          <input
                            type="checkbox"
                            checked={!!activeTemplate.fields.showMRP}
                            onChange={() => toggleElementField("showMRP")}
                            className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>MRP Column</span>
                        </label>

                        <label className="flex items-center gap-2 p-2 rounded-xl border border-border/60 bg-background cursor-pointer hover:bg-muted/40 text-[11px] font-semibold text-foreground">
                          <input
                            type="checkbox"
                            checked={!!activeTemplate.fields.showItemDescription}
                            onChange={() => toggleElementField("showItemDescription")}
                            className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Item Description</span>
                        </label>

                        <label className="flex items-center gap-2 p-2 rounded-xl border border-border/60 bg-background cursor-pointer hover:bg-muted/40 text-[11px] font-semibold text-foreground">
                          <input
                            type="checkbox"
                            checked={!!activeTemplate.fields.showTaxSplit}
                            onChange={() => toggleElementField("showTaxSplit")}
                            className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Tax / GST % Split</span>
                        </label>

                        <label className="flex items-center gap-2 p-2 rounded-xl border border-border/60 bg-background cursor-pointer hover:bg-muted/40 text-[11px] font-semibold text-foreground">
                          <input
                            type="checkbox"
                            checked={!!activeTemplate.fields.showProductImage}
                            onChange={() => toggleElementField("showProductImage")}
                            className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Product Image</span>
                        </label>

                        <label className="flex items-center gap-2 p-2 rounded-xl border border-border/60 bg-background cursor-pointer hover:bg-muted/40 text-[11px] font-semibold text-foreground">
                          <input
                            type="checkbox"
                            checked={!!activeTemplate.fields.showSKU}
                            onChange={() => toggleElementField("showSKU")}
                            className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>SKU / Code</span>
                        </label>

                        <label className="flex items-center gap-2 p-2 rounded-xl border border-border/60 bg-background cursor-pointer hover:bg-muted/40 text-[11px] font-semibold text-foreground">
                          <input
                            type="checkbox"
                            checked={!!activeTemplate.fields.showPartyBalance}
                            onChange={() => toggleElementField("showPartyBalance")}
                            className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Party Balance</span>
                        </label>

                        <label className="flex items-center gap-2 p-2 rounded-xl border border-border/60 bg-background cursor-pointer hover:bg-muted/40 text-[11px] font-semibold text-foreground">
                          <input
                            type="checkbox"
                            checked={!!activeTemplate.fields.showSignature}
                            onChange={() => toggleElementField("showSignature")}
                            className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Signature Box</span>
                        </label>
                      </div>
                    </div>

                    {/* Template Elements (14 Reorderable & Toggleable Elements) */}
                    <div className="space-y-2 pt-2 border-t border-border/50">
                      <div>
                        <h4 className="text-xs font-bold text-foreground">{t("Template Elements", "Template Elements")}</h4>
                        <p className="text-[10.5px] text-muted-foreground">{t("Drag to reorder or enable/disable elements", "Drag to reorder or enable/disable elements")}</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <ElementToggleRow
                          icon={ImageIcon}
                          label="Store Header & Logo"
                          checked={!!activeTemplate.fields.showLogo}
                          onChange={() => toggleElementField("showLogo")}
                        />
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
                          icon={ScanBarcode}
                          label="Barcode"
                          checked={!!activeTemplate.fields.showBarcode}
                          onChange={() => toggleElementField("showBarcode")}
                        />
                        <ElementToggleRow
                          icon={QrCode}
                          label="QR Code"
                          checked={!!activeTemplate.fields.showQR}
                          onChange={() => toggleElementField("showQR")}
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
                          icon={FileText}
                          label="Terms & Conditions"
                          checked={!!activeTemplate.fields.showTerms}
                          onChange={() => toggleElementField("showTerms")}
                        />
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ── TAB 2: CONTENT ── */}
          {activeEditorTab === "content" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Header Title</label>
                  <input
                    type="text"
                    value={activeTemplate.headerTitle || ""}
                    onChange={(e) => updateTemplateProperty("headerTitle", e.target.value)}
                    placeholder="e.g. TAX INVOICE"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Store / Business Name</label>
                  <input
                    type="text"
                    value={activeTemplate.storeName || ""}
                    onChange={(e) => updateTemplateProperty("storeName", e.target.value)}
                    placeholder="Store Name"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Store Address</label>
                <input
                  type="text"
                  value={activeTemplate.storeAddress || ""}
                  onChange={(e) => updateTemplateProperty("storeAddress", e.target.value)}
                  placeholder="Street, City, State, Pincode"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Phone Number</label>
                  <input
                    type="text"
                    value={activeTemplate.storePhone || ""}
                    onChange={(e) => updateTemplateProperty("storePhone", e.target.value)}
                    placeholder="e.g. +91 9849344919"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">GSTIN / Tax ID</label>
                  <input
                    type="text"
                    value={activeTemplate.gstin || ""}
                    onChange={(e) => updateTemplateProperty("gstin", e.target.value)}
                    placeholder="GSTIN"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Bank Payment Details</label>
                <textarea
                  rows={2}
                  value={activeTemplate.bankDetails || ""}
                  onChange={(e) => updateTemplateProperty("bankDetails", e.target.value)}
                  placeholder="Bank name, Account Number, IFSC code"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Terms & Conditions / Disclaimer</label>
                <textarea
                  rows={2}
                  value={activeTemplate.termsText || ""}
                  onChange={(e) => updateTemplateProperty("termsText", e.target.value)}
                  placeholder="Legal disclaimers, return policy, jurisdiction"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Thank You Note</label>
                  <input
                    type="text"
                    value={activeTemplate.thankYouNote || activeTemplate.footerText || ""}
                    onChange={(e) => {
                      updateTemplateProperty("thankYouNote", e.target.value);
                      updateTemplateProperty("footerText", e.target.value);
                    }}
                    placeholder="Thank you for shopping with us!"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Tagline / Subtext</label>
                  <input
                    type="text"
                    value={activeTemplate.customTaglineText || ""}
                    onChange={(e) => updateTemplateProperty("customTaglineText", e.target.value)}
                    placeholder="Quality Products Everyday"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 3: BRANDING ── */}
          {activeEditorTab === "branding" && (
            <div className="space-y-5">
              {/* Select Color & Palette + Paper Background + Opacity */}
              <div className="space-y-3 p-4 bg-muted/20 border border-border/60 rounded-2xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Palette className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    Select Color & Palette
                  </h3>
                  <span className="text-[10px] font-mono text-muted-foreground">{activeTemplate.primaryColor}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {COLOR_SWATCHES.map((swatch) => (
                    <button
                      key={swatch.value}
                      onClick={() => updateTemplateProperty("primaryColor", swatch.value)}
                      title={swatch.label}
                      className={`h-7 w-7 rounded-full border-2 transition-all cursor-pointer flex items-center justify-center ${
                        activeTemplate.primaryColor === swatch.value
                          ? "border-foreground scale-110 shadow-md ring-2 ring-indigo-500/30"
                          : "border-transparent hover:scale-105"
                      }`}
                      style={{ backgroundColor: swatch.value }}
                    >
                      {activeTemplate.primaryColor === swatch.value && (
                        <Check className="h-3.5 w-3.5 text-white stroke-[3]" />
                      )}
                    </button>
                  ))}
                  <div className="flex items-center gap-1.5 pl-2 border-l border-border">
                    <input
                      type="color"
                      value={activeTemplate.primaryColor}
                      onChange={(e) => updateTemplateProperty("primaryColor", e.target.value)}
                      className="h-7 w-7 rounded-lg border border-border cursor-pointer"
                    />
                  </div>
                </div>

                {/* Paper Background Color & Opacity */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40 text-xs">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">Paper Background Color</label>
                    <select
                      value={activeTemplate.paperBgColor || "#ffffff"}
                      onChange={(e) => updateTemplateProperty("paperBgColor", e.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-indigo-500"
                    >
                      <option value="#ffffff">Pure White</option>
                      <option value="#fffbeb">Ivory Warm Parchment</option>
                      <option value="#fff7ed">Royal Saffron Tint</option>
                      <option value="#fef2f2">Festive Rose Tint</option>
                      <option value="#f8fafc">Cool Slate White</option>
                      <option value="#f0fdf4">Emerald Mint Tint</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">Watermark / Theme Opacity</label>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="range"
                        min="5"
                        max="40"
                        value={activeTemplate.watermarkOpacity || 15}
                        onChange={(e) => {
                          updateTemplateProperty("watermarkOpacity", Number(e.target.value));
                          updateTemplateProperty("showWatermark", true);
                        }}
                        className="w-full cursor-pointer accent-indigo-600"
                      />
                      <span className="text-[10px] font-mono text-muted-foreground w-8">
                        {activeTemplate.watermarkOpacity || 15}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Page & Layout Settings */}
              <div className="space-y-3 p-4 bg-muted/20 border border-border/60 rounded-2xl">
                <h3 className="text-xs font-bold text-foreground">{t("Page Settings", "Page Settings")}</h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* Paper Size */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">Paper Size</label>
                    <select
                      value={activeTemplate.paperSize}
                      onChange={(e) => updateTemplateProperty("paperSize", e.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="A4">A4 (210 × 297 mm)</option>
                      <option value="A5">A5 (148 × 210 mm)</option>
                      <option value="Letter">Letter (8.5 × 11 in)</option>
                      <option value="80mm">Thermal 80mm (3 Inch)</option>
                      <option value="58mm">Thermal 58mm (2 Inch)</option>
                      <option value="50x25mm">Barcode 50 × 25 mm</option>
                      <option value="38x25mm">Barcode 38 × 25 mm</option>
                      <option value="100x50mm">Barcode 100 × 50 mm</option>
                      <option value="50x30mm">Price Tag 50 × 30 mm</option>
                    </select>
                  </div>

                  {/* Orientation */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">Orientation</label>
                    <div className="flex rounded-xl border border-input p-0.5 bg-background">
                      <button
                        onClick={() => updateTemplateProperty("orientation", "portrait")}
                        className={`flex-1 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                          activeTemplate.orientation === "portrait"
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Portrait
                      </button>
                      <button
                        onClick={() => updateTemplateProperty("orientation", "landscape")}
                        className={`flex-1 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                          activeTemplate.orientation === "landscape"
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Landscape
                      </button>
                    </div>
                  </div>

                  {/* Margins */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">Margins</label>
                    <select
                      value={activeTemplate.margins || "normal"}
                      onChange={(e) => updateTemplateProperty("margins", e.target.value as any)}
                      className="w-full rounded-xl border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="normal">Normal (15mm)</option>
                      <option value="narrow">Narrow (8mm)</option>
                      <option value="wide">Wide (25mm)</option>
                      <option value="none">None (0mm)</option>
                    </select>
                  </div>

                  {/* Font Family */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">Font Family</label>
                    <select
                      value={activeTemplate.fontFamily}
                      onChange={(e) => updateTemplateProperty("fontFamily", e.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="Inter, sans-serif">Inter (Clean Modern)</option>
                      <option value="Roboto, sans-serif">Roboto (ERP Standard)</option>
                      <option value="Outfit, sans-serif">Outfit (Contemporary)</option>
                      <option value="Playfair Display, serif">Playfair (Luxury Serif)</option>
                      <option value="monospace">Monospace (Terminal / POS)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Logo URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Logo URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={activeTemplate.logoUrl || ""}
                    onChange={(e) => updateTemplateProperty("logoUrl", e.target.value)}
                    placeholder="https://... or /logo.png"
                    className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-indigo-500"
                  />
                  <button
                    onClick={() => {
                      const sample = "https://images.unsplash.com/photo-1542838132-92c53300491e?w=120&auto=format&fit=crop&q=60";
                      updateTemplateProperty("logoUrl", sample);
                      toast.success("Sample logo applied!");
                    }}
                    className="rounded-xl border border-border bg-muted px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/80 cursor-pointer"
                  >
                    Use Sample
                  </button>
                </div>
              </div>

              {/* Watermark Controls */}
              <div className="space-y-2 p-3 bg-muted/30 rounded-xl border border-border/50">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-foreground">Background Watermark Text</div>
                  <input
                    type="checkbox"
                    checked={!!activeTemplate.showWatermark}
                    onChange={(e) => updateTemplateProperty("showWatermark", e.target.checked)}
                    className="h-4 w-4 rounded border-input text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                {activeTemplate.showWatermark && (
                  <div className="space-y-2 pt-2">
                    <input
                      type="text"
                      value={activeTemplate.watermarkText || activeTemplate.storeName || "ACME LUXURY"}
                      onChange={(e) => updateTemplateProperty("watermarkText", e.target.value)}
                      placeholder="Watermark Text"
                      className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs text-foreground"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 4: SETTINGS ── */}
          {activeEditorTab === "settings" && (
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-900 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-foreground">Organization Master Default</div>
                    <div className="text-[11px] text-muted-foreground">Use this template as default for all users</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!activeTemplate.isDefault}
                    onChange={(e) => updateTemplateProperty("isDefault", e.target.checked)}
                    className="h-4 w-4 rounded border-input text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground">Symbology Standard</label>
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                      100% Laser Scannable
                    </span>
                  </div>
                  <select
                    value={activeTemplate.barcodeSymbology || "Auto"}
                    onChange={(e) => updateTemplateProperty("barcodeSymbology", e.target.value as any)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-indigo-500 font-medium"
                  >
                    <option value="Auto">Auto (Smart Detect numeric vs alphanumeric)</option>
                    <option value="Code-128">Code 128 (Universal High-Density Standard)</option>
                    <option value="EAN-13">GS1 EAN-13 (13-digit Retail Standard)</option>
                    <option value="EAN-8">GS1 EAN-8 (8-digit Compact Retail Standard)</option>
                    <option value="UPC-A">UPC-A (12-digit North America Standard)</option>
                    <option value="UPC-E">UPC-E (6-digit Compact Standard)</option>
                    <option value="Code-39">Code 39 (Alphanumeric Standard)</option>
                    <option value="Code-93">Code 93 (High-Density Alphanumeric)</option>
                    <option value="ITF-14">ITF-14 (14-digit Shipping Carton Standard)</option>
                    <option value="MSI">MSI Plessey (Warehouse & Inventory)</option>
                    <option value="Codabar">Codabar (Logistics & Library Standard)</option>
                    <option value="Pharmacode">Pharmacode (Pharmaceutical Packaging)</option>
                    <option value="QR">QR Code (2D Data Matrix / Instant UPI)</option>
                  </select>
                </div>

                {/* Barcode Height Slider & Placement */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/20 rounded-xl border border-border/50">
                  <div className="space-y-1">
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

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-foreground block">Placement Slot</label>
                    <select
                      value={(activeTemplate as any).barcodePlacement || "bottom"}
                      onChange={(e) => updateTemplateProperty("barcodePlacement" as any, e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-2 py-1 text-xs text-foreground focus:border-indigo-500"
                    >
                      <option value="bottom">Bottom of Label (Standard)</option>
                      <option value="top">Top of Label</option>
                      <option value="middle">Middle of Label</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-card cursor-pointer hover:bg-muted/40">
                  <input
                    type="checkbox"
                    id="show-barcode-text-toggle"
                    checked={activeTemplate.showBarcodeText !== false}
                    onChange={(e) => updateTemplateProperty("showBarcodeText", e.target.checked)}
                    className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="show-barcode-text-toggle" className="text-xs font-semibold text-foreground cursor-pointer">
                    Show Digits / Text below Barcode
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <label className="flex items-center gap-2 p-3 rounded-xl border border-border bg-card cursor-pointer hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={!!activeTemplate.fields.showHSN}
                      onChange={() => toggleElementField("showHSN")}
                      className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-medium text-foreground">Show HSN / SAC Codes</span>
                  </label>

                  <label className="flex items-center gap-2 p-3 rounded-xl border border-border bg-card cursor-pointer hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={!!activeTemplate.fields.showPartyBalance}
                      onChange={() => toggleElementField("showPartyBalance")}
                      className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-medium text-foreground">Show Party Outstanding</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── COLUMN 3: Live Preview & Quick Switcher (Expanded) ── */}
        <div className={`${isSidebarCollapsed ? "lg:col-span-6" : "lg:col-span-5"} flex flex-col gap-4`}>
          
          {/* Live Preview Card */}
          <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
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
                      className={`px-2.5 py-1.5 transition-colors cursor-pointer ${
                        !showPrintPreview
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
                      className={`px-2.5 py-1.5 transition-colors cursor-pointer ${
                        showPrintPreview
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

                {/* Download PDF Button */}
                <button
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 text-[11px] font-bold shadow-sm transition-all cursor-pointer"
                >
                  <Download className="h-3 w-3" />
                  Download PDF
                </button>
              </div>
            </div>

            {/* Barcode Quick Interactive Controls Header */}
            {isBarcodeTemplate && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-200/80 dark:border-blue-800/60">
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

            {/* Document Canvas with scaling */}
            <div className="relative w-full bg-slate-100 dark:bg-slate-900/80 rounded-xl p-3 flex flex-col justify-center items-center overflow-hidden min-h-[460px] border border-border/60 shadow-inner">
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
            } catch {}
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
            const allBarcodes = getAllBarcodeTemplates();
            setTemplates((prev) => {
              const others = prev.filter((t) => t.category !== "barcodes" && t.docType !== "barcode");
              return [...others, ...allBarcodes];
            });
            setSelectedTemplateId(savedId);
          }}
        />
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
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          checked ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

/* ── Live Document Preview Engine (Exact Multi-Theme Renderer Matching Original Screens) ── */
function LiveDocumentPreview({
  template,
  currency,
  selectedBarcodeElementKey,
  onSelectBarcodeElement,
  onFieldEdit,
  onResizeBarcode,
  onResizeElement,
  onMoveElement,
  sampleBarcodeItem,
}: {
  template: PrintTemplate;
  currency: { symbol: string; code: string };
  selectedBarcodeElementKey?: string | null;
  onSelectBarcodeElement?: (key: string | null) => void;
  onFieldEdit?: (key: string, val: string) => void;
  onResizeBarcode?: (newHeight: number, newScale?: number) => void;
  onResizeElement?: (elementId: string, updates: { height?: number; width?: number; fontSize?: number; posX?: number; posY?: number; isFreePositioned?: boolean }) => void;
  onMoveElement?: (elementId: string, pos: { posX: number; posY: number; isFreePositioned: boolean }) => void;
  sampleBarcodeItem?: any;
}) {
  const { t } = useI18n();
  const { tenant } = useTenant();
  const f = template.fields;
  const theme = template.themeName || "stylish";

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
  const containerWidthClass = isLandscape
    ? "w-[540px] sm:w-[600px] max-w-full"
    : template.paperSize === "A5"
    ? "w-[300px] sm:w-[320px] max-w-full"
    : template.paperSize === "Letter"
    ? "w-[360px] sm:w-[380px] max-w-full"
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

  // Dynamic Store Name Resolution
  const resolvedStoreName =
    (template.storeName && template.storeName.trim() !== "" && !template.storeName.includes("Organization") && !template.storeName.includes("Smart Bazaar") ? template.storeName : "") ||
    activeBillingGst?.trade_name ||
    activeBillingGst?.legal_name ||
    tenant?.name ||
    (template.themeName === "luxury" ? "LazyMonkeyAI Luxury" : template.themeName === "adv_tally" ? "LazyMonkeyAI (ERP Account)" : template.storeName || "LazyMonkeyAI");

  // Dynamic Logo Resolution
  const resolvedLogoUrl = resolveImageUrl(template.logoUrl || activeBillingGst?.logo_url || tenant?.logo_url || (tenant as any)?.raw?.logo_url || "") || "/Logo.png";

  // Dynamic Address Resolution
  const resolvedAddress =
    (template.storeAddress && template.storeAddress.trim() !== "" && !template.storeAddress.includes("123 Commercial Hub") ? template.storeAddress : "") ||
    activeBillingGst?.address ||
    (tenant as any)?.raw?.address ||
    "KK Street, Proddatur, YSR Cuddapah, Andhra Pradesh, 516360";

  // Dynamic Phone Resolution
  const resolvedPhone =
    (template.storePhone && template.storePhone.trim() !== "" ? template.storePhone : "") ||
    activeBillingGst?.phone ||
    (tenant as any)?.raw?.phone ||
    "+91 9849344919";

  // Dynamic GSTIN Resolution
  const resolvedGstin =
    (template.gstin && template.gstin.trim() !== "" ? template.gstin : "") ||
    activeBillingGst?.gstin ||
    (tenant as any)?.raw?.gst_number ||
    "37AABCCH694G1Z4";

  // 1. INVOICE PREVIEW ENGINE
  if (template.docType === "invoice" || template.category === "invoices") {
    // ── Check if Exact PDF Stationery Overlay Template ──
    if ((template as any).isPdfStationeryOverlay || theme === "pdf_stationery_overlay" || (template as any).pdfBackgroundDataUrl) {
      const overlayMockInvoice: FullInvoiceData = {
        invoice_number: "INV-2026-0089",
        invoice_date: new Date().toISOString(),
        due_date: new Date().toISOString(),
        customerName: "Acme Retail Enterprises",
        customerCompany: "ACME Enterprises Pvt Ltd",
        customerGST: "09BBBBA9999C1Z2",
        customerBillingAddress: "45 Tech Boulevard, Sector 62, Noida, UP",
        customerShippingAddress: "Plot 12, Industrial Area, Sector 63, Noida, UP",
        customerPhone: "+91 98765 43210",
        items: [
          { product_name: "Samsung Galaxy A30", description: "6.4-inch display, 4GB RAM, Dual Camera setup, 4000mAh Battery.", quantity: 1, unit_price: 12000.0, mrp: 14000.0, tax_rate: 18, subtotal: 10620.0 },
          { product_name: "Parle-G Biscuit 200g", description: "Crispy glucose biscuits packed with wheat & milk energy.", quantity: 1, unit_price: 400.0, mrp: 450.0, tax_rate: 18, subtotal: 342.86 },
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
    if (theme === "marg_pharma") {
      const margMockInvoice: FullInvoiceData = {
        id: "mock-marg-01",
        invoice_number: "A000002",
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
              currency={currency}
              f={f as any}
            />
          </div>
        </div>
      );
    }

    // ── Check if Custom Replica Template (FMCG Wholesale) ──
    if (theme === "fmcg_distributor") {
      const fmcgMockInvoice: FullInvoiceData = {
        id: "mock-fmcg-01",
        invoice_number: "B/26-27/010451",
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
          { product_name: "Samsung Galaxy A30", quantity: 1, unit_price: 12000.0, mrp: 14000.0, hsn_code: "85171200", tax_rate: 18, discount_value: 0, subtotal: 10620.0 },
          { product_name: "Parle-G Biscuit 200g", quantity: 1, unit_price: 400.0, mrp: 450.0, hsn_code: "19059090", tax_rate: 18, discount_value: 0, subtotal: 342.86 },
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
              currency={currency}
              f={f as any}
            />
          </div>
        </div>
      );
    }

    // ── Check if Custom Replica Template (Parle Supermarket) ──
    if (theme === "parle_teal") {
      const parleMockInvoice: FullInvoiceData = {
        id: "mock-parle-01",
        invoice_number: "B000738",
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
          { product_name: "Samsung Galaxy A30", quantity: 1, unit_price: 12000.0, mrp: 14000.0, hsn_code: "85171200", tax_rate: 18, subtotal: 10620.0 },
          { product_name: "Parle-G Biscuit 200g", quantity: 1, unit_price: 400.0, mrp: 450.0, hsn_code: "19059090", tax_rate: 18, subtotal: 342.86 },
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
              currency={currency}
              f={f as any}
            />
          </div>
        </div>
      );
    }

    // ── Check if Custom Replica Template (Agri Seeds) ──
    if (theme === "agri_seeds") {
      const agriMockInvoice: FullInvoiceData = {
        id: "mock-agri-01",
        invoice_number: "AGRI/2026/099",
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
          { product_name: "Samsung Galaxy A30", quantity: 1, unit_price: 12000.0, mrp: 14000.0, hsn_code: "85171200", tax_rate: 18, subtotal: 10620.0 },
          { product_name: "Parle-G Biscuit 200g", quantity: 1, unit_price: 400.0, mrp: 450.0, hsn_code: "19059090", tax_rate: 18, subtotal: 342.86 },
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
              dynamicBank={template.bankDetails || "Bank: HDFC Bank | A/C: 502000492811 | IFSC: HDFC0000003"}
              currency={currency}
              f={f as any}
            />
          </div>
        </div>
      );
    }

    return (
      <div
        className={`relative overflow-hidden ${containerWidthClass} text-slate-900 ${marginPaddingClass} shadow-xl text-[8.5px] space-y-3 ${borderStyle}`}
        style={{
          fontFamily: template.fontFamily,
          backgroundColor: template.paperBgColor || (isDecorativeTheme ? "#fffdf5" : "#ffffff"),
          borderTop:
            isStylish || isCultureUp || isCultureGod || isElegant || isEmeraldCorp || isMaharashtra || isGanesh || isHinduGod || isShubhLabh || isRoyalGold || isJain
              ? `5px solid ${template.primaryColor}`
              : undefined,
        }}
      >
        {/* Cultural & Auspicious Header Banners for ThemeStore Themes */}
        {isJain && (
          <div className="text-center text-[8px] font-bold tracking-widest text-amber-800 bg-amber-100/70 py-0.5 rounded border border-amber-300/80 -mt-1 shadow-2xs">
            ॥ ॐ नमो जिनानाम् ॥ अहिंसा परमो धर्मः ॥
          </div>
        )}
        {isMaharashtra && (
          <div className="text-center text-[8px] font-bold tracking-widest text-orange-900 bg-orange-100/80 py-0.5 rounded border border-orange-300/80 -mt-1 shadow-2xs">
            🚩 ॥ जय भवानी जय शिवाजी ॥ जय महाराष्ट्र ॥ 🚩
          </div>
        )}
        {isGanesh && (
          <div className="text-center text-[8px] font-bold tracking-widest text-amber-900 bg-amber-100/80 py-0.5 rounded border border-amber-300/80 -mt-1 shadow-2xs">
            🕉️ ॥ श्री गणेशाय नमः ॥ ॐ गं गणपतये नमः ॥ ✨
          </div>
        )}
        {isHinduGod && (
          <div className="text-center text-[8px] font-bold tracking-widest text-red-900 bg-red-100/70 py-0.5 rounded border border-red-300/80 -mt-1 shadow-2xs">
            🪷 ॥ ॐ नमो भगवते वासुदेवाय ॥ श्री महालक्ष्म्यै नमः ॥ 🪷
          </div>
        )}
        {isShubhLabh && (
          <div className="text-center text-[8px] font-bold tracking-widest text-amber-900 bg-amber-100/70 py-0.5 rounded border border-amber-300/80 -mt-1 shadow-2xs">
            ✨ ॥ शुभ लाभ ॥ रिद्धि सिद्धि ॥ श्री गणेशाय नमः ॥ ✨
          </div>
        )}
        {isRoyalGold && (
          <div className="text-center text-[8px] font-black tracking-widest text-amber-900 bg-gradient-to-r from-amber-200/60 via-yellow-100/90 to-amber-200/60 py-0.5 rounded border border-amber-400/80 -mt-1 shadow-2xs">
            👑 ✦ ROYAL HERITAGE TAX INVOICE ✦ 👑
          </div>
        )}
        {isCorporate && (
          <div className="text-center text-[8px] font-bold tracking-widest text-indigo-900 dark:text-indigo-200 bg-indigo-50/80 dark:bg-indigo-950/50 py-0.5 rounded border border-indigo-200/80 -mt-1 shadow-2xs">
            🏛️ OFFICIAL COMMERCIAL TAX INVOICE · ORIGINAL 🏛️
          </div>
        )}
        {isCultureGod && (
          <div className="text-center text-[8px] font-bold tracking-widest text-amber-700 bg-amber-50 py-0.5 rounded border border-amber-200 -mt-1">
            ॥ श्री गणेशाय नमः ॥ शुभ लाभ ॥
          </div>
        )}
        {isCultureUp && (
          <div className="text-center text-[8px] font-bold tracking-widest text-amber-700 bg-amber-50 py-0.5 rounded border border-amber-200 -mt-1">
            ॥ गंगा मैया की जय ॥ उत्तर प्रदेश शासन स्वीकृत ॥
          </div>
        )}

        {/* BillBook Recipient Copy Header */}
        {isBillBook && (
          <div className="flex justify-between items-center text-[7.5px] text-slate-500 border-b border-dashed pb-1.5">
            <span className="font-semibold text-slate-700">TAX INVOICE</span>
            <div className="flex gap-2">
              <span>[x] Original for Recipient</span>
              <span>[ ] Duplicate</span>
            </div>
          </div>
        )}

        {/* Watermark Overlay & Decorative Motifs */}
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

        {/* Invoice Header */}
        {f.showHeader !== false && (
          <div
            className={`flex items-start justify-between border-b pb-3 z-10 relative ${
              isTally ? "border-slate-900 border-b-2" : "border-slate-100"
            }`}
            style={!isTally && !isSimple && !isModern ? { borderBottom: `2px solid ${template.primaryColor}` } : {}}
          >
            <div>
              {f.showLogo && (
                <div className="flex items-center gap-2 mb-1.5">
                  <img
                    src={resolvedLogoUrl}
                    alt="Logo"
                    className="h-8 max-w-[100px] object-contain rounded shadow-2xs"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/Logo.png";
                    }}
                  />
                  <div>
                    <h2 className="font-extrabold text-xs text-slate-900 leading-tight">
                      {resolvedStoreName}
                    </h2>
                    <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest block">
                      Authorized Business Organization
                    </span>
                  </div>
                </div>
              )}
              {!f.showLogo && (
                <h2 className="font-extrabold text-xs mb-0.5" style={{ color: template.primaryColor }}>
                  {resolvedStoreName}
                </h2>
              )}
              {f.showCompanyDetails !== false && (
                <>
                  <p className="text-[7.5px] text-slate-600 max-w-[180px] leading-tight">
                    {resolvedAddress}
                  </p>
                  <p className="text-[7.5px] text-slate-500">Ph: {resolvedPhone}</p>
                  {resolvedGstin && (
                    <p className="text-[7.5px] font-bold text-slate-700">GSTIN: {resolvedGstin}</p>
                  )}
                </>
              )}
            </div>

            {f.showInvoiceDetails !== false && (
              <div className="text-right">
                <h3
                  className={`font-black text-xs tracking-wider uppercase mb-1 ${isLuxury ? "font-serif text-amber-900" : ""}`}
                  style={{ color: isLuxury ? template.primaryColor : undefined }}
                >
                  {isCultureGod ? "श्री गणेशाय नमः (TAX INVOICE)" : isGanesh ? "॥ TAX INVOICE ॥" : (template.headerTitle || "TAX INVOICE")}
                </h3>
                <div className="text-[7.5px] text-slate-600 space-y-0.5">
                  <div>Invoice No: <strong>#INV-2026/0822</strong></div>
                  <div>Date: 01 Aug 2026 12:14 PM</div>
                  <div>Due Date: 15 Aug 2026</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Customer / Party Info Block */}
        {f.showCustomerDetails && (
          <div
            className={`grid grid-cols-3 gap-1.5 p-2 rounded-lg border z-10 relative ${
              isDecorativeTheme
                ? "bg-amber-500/5 border-amber-300/40"
                : isModern
                ? "bg-slate-50 border-slate-100"
                : isLuxury
                ? "bg-amber-50/40 border-amber-200/60"
                : isTally
                ? "bg-transparent border-slate-900"
                : "bg-black/[0.02] border-slate-200/60"
            }`}
          >
            <div>
              <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider block">BILLED TO</span>
              <h4 className="font-bold text-slate-800 text-[8.5px] mt-0.5 leading-tight">{t("ACME Enterprises Pvt Ltd", "ACME Enterprises Pvt Ltd")}</h4>
              <p className="text-[7px] text-slate-600 leading-tight">45 Tech Boulevard, Sector 62, Noida, UP</p>
              <p className="text-[7px] text-slate-600 font-medium">GSTIN: 09BBBBA9999C1Z2</p>
            </div>
            <div className="border-l border-slate-200 pl-1.5">
              <span className="text-[7px] font-bold text-indigo-500 uppercase tracking-wider block">SHIPPED TO</span>
              <h4 className="font-bold text-slate-800 text-[8.5px] mt-0.5 leading-tight">{t("ACME Warehouse (Noida Hub)", "ACME Warehouse (Noida Hub)")}</h4>
              <p className="text-[7px] text-slate-600 leading-tight">Plot 12, Industrial Area, Sector 63, Noida, UP</p>
              <p className="text-[7px] text-slate-600 font-semibold">Contact: +91 98765 43210</p>
            </div>
            <div className="text-right flex flex-col justify-between border-l border-slate-200 pl-1.5">
              <div>
                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider block">PLACE OF SUPPLY</span>
                <p className="text-[7.5px] font-semibold text-slate-700 mt-0.5">Uttar Pradesh (09)</p>
              </div>
              {f.showPartyBalance && (
                <div className="text-[7px] font-bold text-red-600 mt-1">
                  Outstanding: {currency.symbol}14,200.00
                </div>
              )}
            </div>
          </div>
        )}

        {/* Line Items Table with dynamic columns based on user toggles */}
        {f.showItemTable && (
          <table className={`w-full border-collapse text-[7.5px] z-10 relative ${isTally ? "border border-slate-900" : ""}`}>
            <thead>
              <tr
                className="text-white text-left font-bold"
                style={{ backgroundColor: isSimple ? "#1e293b" : template.primaryColor }}
              >
                <th className={`p-1.5 ${isTally ? "border border-slate-900" : "rounded-l"}`}>#</th>
                {f.showProductImage && <th className={`p-1.5 ${isTally ? "border border-slate-900" : ""}`}>IMG</th>}
                <th className={`p-1.5 ${isTally ? "border border-slate-900" : ""}`}>ITEM & DESCRIPTION</th>
                {f.showHSN && <th className={`p-1.5 ${isTally ? "border border-slate-900" : ""}`}>HSN</th>}
                <th className={`p-1.5 text-center ${isTally ? "border border-slate-900" : ""}`}>QTY</th>
                {f.showMRP && <th className={`p-1.5 text-right ${isTally ? "border border-slate-900" : ""}`}>MRP</th>}
                <th className={`p-1.5 text-right ${isTally ? "border border-slate-900" : ""}`}>RATE</th>
                {f.showTaxSplit && <th className={`p-1.5 text-right ${isTally ? "border border-slate-900" : ""}`}>GST %</th>}
                <th className={`p-1.5 text-right ${isTally ? "border border-slate-900" : "rounded-r"}`}>AMOUNT</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isTally ? "divide-slate-900" : "divide-slate-100"}`}>
              <tr className={isTally ? "border-b border-slate-900" : ""}>
                <td className={`p-1.5 text-slate-400 ${isTally ? "border-r border-slate-900 text-slate-900 text-center" : ""}`}>1</td>
                {f.showProductImage && (
                  <td className={`p-1 ${isTally ? "border-r border-slate-900" : ""}`}>
                    <div className="w-5 h-5 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-[8px]">
                      📱
                    </div>
                  </td>
                )}
                <td className={`p-1.5 font-semibold text-slate-800 ${isTally ? "border-r border-slate-900" : ""}`}>
                  Samsung Galaxy A30
                  {f.showItemDescription && (
                    <span className="block text-[6.5px] font-normal text-slate-500 leading-tight">
                      6.4-inch display, 4GB RAM, Dual Camera setup, 4000mAh Battery.
                    </span>
                  )}
                  {f.showSKU && <span className="block text-[6px] font-normal text-slate-500">SKU: SAM-A30-4G</span>}
                </td>
                {f.showHSN && <td className={`p-1.5 text-slate-600 ${isTally ? "border-r border-slate-900 text-center" : ""}`}>85171200</td>}
                <td className={`p-1.5 text-center font-bold ${isTally ? "border-r border-slate-900" : ""}`}>1 PCS</td>
                {f.showMRP && <td className={`p-1.5 text-right text-slate-400 line-through ${isTally ? "border-r border-slate-900" : ""}`}>{currency.symbol}14,000</td>}
                <td className={`p-1.5 text-right ${isTally ? "border-r border-slate-900" : ""}`}>{currency.symbol}12,000.00</td>
                {f.showTaxSplit && <td className={`p-1.5 text-right text-slate-600 ${isTally ? "border-r border-slate-900" : ""}`}>18%</td>}
                <td className="p-1.5 text-right font-bold text-slate-900">{currency.symbol}10,620.00</td>
              </tr>
              <tr className={isTally ? "border-b border-slate-900" : ""}>
                <td className={`p-1.5 text-slate-400 ${isTally ? "border-r border-slate-900 text-slate-900 text-center" : ""}`}>2</td>
                {f.showProductImage && (
                  <td className={`p-1 ${isTally ? "border-r border-slate-900" : ""}`}>
                    <div className="w-5 h-5 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-[8px]">
                      🍪
                    </div>
                  </td>
                )}
                <td className={`p-1.5 font-semibold text-slate-800 ${isTally ? "border-r border-slate-900" : ""}`}>
                  Parle-G Biscuit 200g
                  {f.showItemDescription && (
                    <span className="block text-[6.5px] font-normal text-slate-500 leading-tight">
                      Crispy glucose biscuits packed with wheat & milk energy.
                    </span>
                  )}
                  {f.showSKU && <span className="block text-[6px] font-normal text-slate-500">SKU: PARLE-G-200</span>}
                </td>
                {f.showHSN && <td className={`p-1.5 text-slate-600 ${isTally ? "border-r border-slate-900 text-center" : ""}`}>19059090</td>}
                <td className={`p-1.5 text-center font-bold ${isTally ? "border-r border-slate-900" : ""}`}>1 BOX</td>
                {f.showMRP && <td className={`p-1.5 text-right text-slate-400 line-through ${isTally ? "border-r border-slate-900" : ""}`}>{currency.symbol}450</td>}
                <td className={`p-1.5 text-right ${isTally ? "border-r border-slate-900" : ""}`}>{currency.symbol}400.00</td>
                {f.showTaxSplit && <td className={`p-1.5 text-right text-slate-600 ${isTally ? "border-r border-slate-900" : ""}`}>18%</td>}
                <td className="p-1.5 text-right font-bold text-slate-900">{currency.symbol}342.86</td>
              </tr>
            </tbody>
          </table>
        )}

        {/* Live Scannable Invoice Barcode & Scannable QR Code */}
        {(f.showBarcode || f.showQR) && (
          <div className={`flex items-center justify-center gap-4 p-2 rounded-lg my-1 border ${
            isDecorativeTheme
              ? "bg-white/60 border-amber-300/40"
              : "bg-slate-50/80 border-slate-200"
          }`}>
            {f.showBarcode && (
              <div className="flex flex-col items-center">
                <RealBarcodeSvg
                  code="INV-2026/0822"
                  format={template.barcodeSymbology || "Code-128"}
                  height={32}
                  displayValue={true}
                />
              </div>
            )}
            {f.showQR && (
              <div className="flex flex-col items-center justify-center p-1 bg-white border border-slate-300 rounded">
                <QrCode className="h-8 w-8 text-slate-900" />
                <span className="text-[5.5px] font-bold text-slate-600 mt-0.5">UPI SCAN & PAY</span>
              </div>
            )}
          </div>
        )}

        {/* Bank Details & Totals */}
        <div className="flex justify-between items-start pt-1 z-10 relative">
          {f.showPaymentDetails !== false && (
            <div className={`p-2 rounded-lg border max-w-[150px] ${
              isDecorativeTheme
                ? "bg-amber-500/5 border-amber-300/40"
                : isTally
                ? "border-slate-900 bg-transparent"
                : "border-slate-100 bg-slate-50/60"
            }`}>
              <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                BANK PAYMENT INFO
              </span>
              <p className="text-[7px] text-slate-700 whitespace-pre-line leading-tight font-mono">
                {template.bankDetails || "Bank: HDFC Bank\nA/C: 502000492811\nIFSC: HDFC0000003"}
              </p>
            </div>
          )}
          {f.showPaymentDetails === false && <div />}

          {f.showTotals !== false && (
            <div className="w-36 space-y-0.5 text-slate-700 text-[7.5px]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-semibold">{currency.symbol}11,497.00</span>
              </div>
              {f.showTaxSplit && (
                <>
                  <div className="flex justify-between text-slate-500">
                    <span>CGST (9%):</span>
                    <span>{currency.symbol}1,034.73</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>SGST (9%):</span>
                    <span>{currency.symbol}1,034.73</span>
                  </div>
                </>
              )}
              <div
                className={`flex justify-between pt-1 text-[9px] font-bold text-slate-900 ${
                  isTally ? "border-t-2 border-double border-slate-900" : "border-t-2"
                }`}
                style={!isTally ? { borderColor: template.primaryColor } : {}}
              >
                <span>Total Amount:</span>
                <span style={{ color: template.primaryColor }}>{currency.symbol}13,566.46</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer, Terms & Signature */}
        {(f.showFooter !== false || f.showTerms !== false || f.showSignature) && (
          <div className="border-t pt-2.5 flex justify-between items-end z-10 relative">
            <div>
              {f.showFooter !== false && (template.thankYouNote || template.footerText) && (
                <p className="text-[7.5px] font-semibold text-slate-700 mb-0.5">
                  {template.thankYouNote || template.footerText}
                </p>
              )}
              {f.showTerms !== false && template.termsText && (
                <p className="text-[6.5px] text-slate-400 max-w-[180px] whitespace-pre-line leading-tight">
                  {template.termsText}
                </p>
              )}
            </div>
            {f.showSignature && (
              <div className="text-center font-serif">
                <div className="h-3 text-[9px] italic text-slate-800">Admin</div>
                <span className="text-[6px] text-slate-500 block border-t border-slate-300 pt-0.5">
                  Authorized Signatory
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // 2. THERMAL RECEIPT PREVIEW
  if (template.docType === "thermal" || template.category === "thermal") {
    return (
      <div
        className="w-[260px] bg-white text-slate-900 rounded-lg shadow-xl p-3 text-[8.5px] font-mono border border-slate-300 leading-tight space-y-2"
        style={{ fontFamily: "monospace" }}
      >
        <div className="text-center space-y-0.5 border-b border-dashed border-slate-400 pb-2">
          <h3 className="font-black text-xs">{resolvedStoreName}</h3>
          <p className="text-[7px] text-slate-600">{resolvedAddress}</p>
          <p className="text-[7px] text-slate-600">GSTIN: {resolvedGstin}</p>
          <p className="text-[8px] font-bold mt-1">RECEIPT #POS-8892</p>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between font-bold border-b border-slate-300 pb-0.5">
            <span>ITEM</span>
            <span>QTY</span>
            <span>AMT</span>
          </div>
          <div className="flex justify-between">
            <span>Samsung A30</span>
            <span>1</span>
            <span>10,620</span>
          </div>
          <div className="flex justify-between">
            <span>Parle-G 200g</span>
            <span>1</span>
            <span>306</span>
          </div>
        </div>

        <div className="border-t border-dashed border-slate-400 pt-1.5 space-y-0.5 text-right font-bold">
          <div className="flex justify-between">
            <span>SUBTOTAL:</span>
            <span>12,816.00</span>
          </div>
          <div className="flex justify-between">
            <span>CGST+SGST (18%):</span>
            <span>2,307.00</span>
          </div>
          <div className="flex justify-between text-[10px] font-black border-t border-slate-900 pt-0.5">
            <span>TOTAL:</span>
            <span>₹ 15,123.00</span>
          </div>
        </div>

        <div className="text-center pt-2 border-t border-dashed border-slate-400 space-y-1">
          {f.showBarcode && (
            <div className="flex flex-col items-center justify-center py-1">
              <RealBarcodeSvg
                code="POS-8892"
                format={template.barcodeSymbology || "Code-128"}
                height={32}
                displayValue={true}
              />
            </div>
          )}
          <p className="text-[7px] text-slate-600">{template.thankYouNote || "Thank You! Visit Again!"}</p>
        </div>
      </div>
    );
  }

  // 3. BARCODE LABEL PREVIEW (HD Studio Workspace with Millimeter Grid & Safe Bounds)
  if (template.docType === "barcode" || template.category === "barcodes") {
    const defaultMock = {
      product_name: "Designer Saree Silk 3799",
      barcode: "2064965391328",
      sku: "SAR-3799",
      selling_price: 3799.0,
      mrp: 7599.0,
      category_name: "APPAREL / ETHNIC",
      format: template.barcodeSymbology || "Code-128",
    };
    const itemToRender = sampleBarcodeItem || defaultMock;
    const is2Up = template.layout === "2up" || (template as any).paperSize === "100x25mm";

    return (
      <div className="w-full flex flex-col items-center gap-3">
        {/* Workspace Canvas Header & Dimension Guide */}
        <div className="flex items-center justify-between w-full max-w-[500px] px-2 text-[11px] font-semibold text-slate-500">
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
        <div className="w-full max-w-[500px] p-4 bg-slate-50/90 rounded-2xl border-2 border-dashed border-slate-300 shadow-inner flex flex-col items-center justify-center relative overflow-hidden group">
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
  const { t } = useI18n();
  const [search, setSearch] = useState("");

  const filtered = templates.filter(
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
                All Available Master Templates ({templates.length})
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
                className={`flex flex-col justify-between p-4 rounded-2xl border transition-all ${
                  isSelected
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isSelected
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
function generatePrintableHtml(template: PrintTemplate, currency: { symbol: string }) {
  const { t } = useI18n();
  return `
<!DOCTYPE html>
<html>
<head>
  <title>${template.name} - Print Preview</title>
  <style>
    body { font-family: ${template.fontFamily || "Inter, sans-serif"}; margin: 0; padding: 20px; background: #f8fafc; color: #0f172a; }
    .sheet { max-width: 800px; margin: 0 auto; background: ${template.paperBgColor || "#ffffff"}; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; }
    .title { background: ${template.primaryColor || "#4f46e5"}; color: #fff; text-align: center; padding: 8px; font-weight: bold; border-radius: 6px; margin: 15px 0; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th { border-bottom: 2px solid #cbd5e1; text-align: left; padding: 8px; font-size: 12px; }
    td { border-bottom: 1px solid #f1f5f9; padding: 8px; font-size: 12px; }
    .total-box { margin-top: 20px; text-align: right; font-size: 13px; }
    @media print { body { background: #fff; padding: 0; } .sheet { box-shadow: none; padding: 0; } }
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
    window.onload = function() { window.print(); }
  </script>
</body>
</html>
  `;
}
