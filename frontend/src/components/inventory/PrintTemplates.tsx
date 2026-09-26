import React, { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { resolveImageUrl } from "@/lib/api-client";
import { getActiveBillingGst } from "@/lib/receipt-template-store";
import { MargPharmaTemplate } from "@/components/pos/invoice-templates/MargPharmaTemplate";
import { FmcgDistributorTemplate } from "@/components/pos/invoice-templates/FmcgDistributorTemplate";
import { ParleDistributorTemplate } from "@/components/pos/invoice-templates/ParleDistributorTemplate";
import { AgriSeedsTemplate } from "@/components/pos/invoice-templates/AgriSeedsTemplate";
import { RealBarcodeSvg, SingleBarcodeLabelCard } from "@/lib/barcode-svg";
import type { FullInvoiceData } from "@/components/pos/FullInvoicePrinter";

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

  themeName?: string; // "stylish" | "luxury" | "adv_tally" | "adv_gst" | "billbook" | "modern" | "simple" | "marg_pharma" | "fmcg_distributor" | "parle_teal" | "agri_seeds" | "culture_up" | "culture_god" | "compact" | "minimal" | "elegant" | "advanced"
  barcodeHeight?: number;
  barcodeSymbology?: "Auto" | "Code-128" | "EAN-13" | "Code-39" | "QR";
  showBarcodeText?: boolean;
  pricePrefix?: string;

  // Watermark Customization
  showWatermark?: boolean;
  watermarkType?: "text" | "image";
  watermarkText?: string;
  watermarkImage?: string;
  watermarkOpacity?: number;

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
    id: "tpl-bar-std",
    name: "Standard 2x1 Inch Tag (50x25mm)",
    category: "barcodes",
    docType: "barcode",
    description: "Standard 50mm x 25mm product sticker with Code-128 barcode, MRP and Selling Price.",
    isDefault: true,
    paperSize: "50x25mm",
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
  const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();
  const tenantId = tenant?.id || "default";

  // Navigation / Selection State
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>("invoice");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [activeEditorTab, setActiveEditorTab] = useState<"design" | "content" | "branding" | "settings">("design");
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isTemplateStoreModalOpen, setIsTemplateStoreModalOpen] = useState(false);

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

  // Derived active template object
  const activeTemplate: PrintTemplate =
    templates.find((t) => t.id === selectedTemplateId) ||
    currentCategoryTemplates[0] ||
    INITIAL_TEMPLATES[0];

  // Persist templates to localStorage
  const persistTemplates = (newTemplates: PrintTemplate[]) => {
    setTemplates(newTemplates);
    try {
      localStorage.setItem(`businessos_print_templates_v1_${tenantId}`, JSON.stringify(newTemplates));
      localStorage.setItem(`businessos_print_templates_v1`, JSON.stringify(newTemplates));
      window.dispatchEvent(new Event("print_templates_updated"));
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

  // Switch to specific template in active category
  const handleSelectTemplate = (tpl: PrintTemplate) => {
    setSelectedTemplateId(tpl.id);
    const nextUserActive = { ...userActiveDefaults, [selectedDocType]: tpl.id, [tpl.docType || selectedDocType]: tpl.id };
    setUserActiveDefaults(nextUserActive);
    try {
      localStorage.setItem(`user_active_print_templates_v1_${tenantId}`, JSON.stringify(nextUserActive));
      localStorage.setItem(`user_active_print_templates_v1`, JSON.stringify(nextUserActive));
    } catch {}
    toast.info(`Switched to "${tpl.name}"`);
  };

  // Set as Organization Default
  const handleSetOrgDefault = (tplId: string) => {
    const updated = templates.map((t) => {
      if (t.docType === selectedDocType || t.category === activeTemplate.category) {
        return { ...t, isDefault: t.id === tplId };
      }
      return t;
    });
    persistTemplates(updated);
    toast.success(`"${activeTemplate.name}" is now the Organization Master Default!`);
  };

  // Set as Active for Me
  const handleSetActiveForMe = (tplId: string) => {
    const nextDefaults = { ...userActiveDefaults, [selectedDocType]: tplId };
    setUserActiveDefaults(nextDefaults);
    try {
      localStorage.setItem(`user_active_print_templates_v1_${tenantId}`, JSON.stringify(nextDefaults));
      localStorage.setItem(`user_active_print_templates_v1`, JSON.stringify(nextDefaults));
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
    toast.success("Template deleted.");
  };

  // Save current template changes
  const handleSaveTemplate = () => {
    persistTemplates(templates);
    toast.success(`Template "${activeTemplate.name}" saved successfully!`);
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
    window.print();
    toast.success("Opening system print / PDF export dialog...");
  };

  return (
    <div className="flex flex-col gap-6 min-h-[calc(100vh-130px)] pb-10 text-foreground">
      {/* ─── Standard Tab Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Print & Document Templates
          </h2>
          <p className="text-sm text-muted-foreground">
            Design, customize and live preview templates for Invoices, POS Receipts, Barcodes, QR Codes & Delivery Challans
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
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
                <h2 className="text-xs font-bold text-foreground">Template Type</h2>
                <p className="text-[9.5px] text-muted-foreground truncate">Choose format</p>
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

          {/* ── TAB 1: DESIGN ── */}
          {activeEditorTab === "design" && (
            <div className="space-y-6">
              
              {/* Themes Carousel of all templates for this category */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-foreground">Themes</h3>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      ({currentCategoryTemplates.length} styles)
                    </span>
                  </div>
                  <button
                    onClick={() => setIsTemplateStoreModalOpen(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    Custom
                  </button>
                </div>

                {/* Horizontal scrollable row of actual templates */}
                <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
                  {currentCategoryTemplates.map((tpl) => {
                    const isSelected = activeTemplate.id === tpl.id;
                    const accentColor = tpl.primaryColor || "#4f46e5";
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => handleSelectTemplate(tpl)}
                        className="flex flex-col items-center gap-1.5 cursor-pointer group shrink-0 w-[72px]"
                      >
                        <div
                          className={`relative w-full aspect-[4/5] rounded-xl border p-1.5 flex flex-col justify-between transition-all overflow-hidden ${
                            isSelected
                              ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/30 shadow-sm"
                              : "border-border/70 bg-muted/20 hover:border-indigo-400 hover:bg-muted/40"
                          }`}
                        >
                          {/* Mini Theme Thumbnail Illustration */}
                          <div className="w-full h-full flex flex-col gap-1 p-1 bg-white dark:bg-slate-900 rounded border border-border/40">
                            <div className="flex justify-between items-center border-b border-slate-200 pb-0.5">
                              <div className="w-4 h-1 rounded-sm" style={{ backgroundColor: accentColor }} />
                              <div className="w-2 h-1 bg-slate-400 rounded-sm" />
                            </div>
                            <div
                              className="w-full h-1 rounded-sm mt-0.5 opacity-40"
                              style={{ backgroundColor: accentColor }}
                            />
                            <div className="flex-1 space-y-0.5 mt-0.5">
                              <div className="w-full h-0.5 bg-slate-200 dark:bg-slate-700 rounded-full" />
                              <div className="w-4/5 h-0.5 bg-slate-200 dark:bg-slate-700 rounded-full" />
                              <div className="w-full h-0.5 bg-slate-200 dark:bg-slate-700 rounded-full" />
                            </div>
                            <div
                              className="w-3/4 h-1 rounded-sm self-end"
                              style={{ backgroundColor: accentColor }}
                            />
                          </div>

                          {/* Selected Checkmark Badge */}
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-white shadow">
                              <Check className="h-2.5 w-2.5 stroke-[3]" />
                            </div>
                          )}
                        </div>
                        <span
                          className={`text-[10.5px] font-semibold text-center leading-tight truncate w-full ${
                            isSelected ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-muted-foreground group-hover:text-foreground"
                          }`}
                          title={tpl.name}
                        >
                          {tpl.name.replace(" Theme", "").replace(" Replica", "").replace(" (Tally)", "")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Template Elements (14 Reorderable & Toggleable Elements) */}
              <div className="space-y-2.5">
                <div>
                  <h3 className="text-xs font-bold text-foreground">Template Elements</h3>
                  <p className="text-[11px] text-muted-foreground">Drag to reorder or enable/disable elements</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Left Column Items */}
                  <div className="space-y-2">
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
                      icon={TableIcon}
                      label="Item Table"
                      checked={!!activeTemplate.fields.showItemTable}
                      onChange={() => toggleElementField("showItemTable")}
                    />
                    <ElementToggleRow
                      icon={Calculator}
                      label="Tax & Totals"
                      checked={!!activeTemplate.fields.showTaxSplit}
                      onChange={() => toggleElementField("showTaxSplit")}
                    />
                    <ElementToggleRow
                      icon={FileText}
                      label="Terms & Conditions"
                      checked={!!activeTemplate.fields.showTerms}
                      onChange={() => toggleElementField("showTerms")}
                    />
                    <ElementToggleRow
                      icon={LayoutGrid}
                      label="Footer"
                      checked={!!activeTemplate.fields.showFooter}
                      onChange={() => toggleElementField("showFooter")}
                    />
                  </div>

                  {/* Right Column Items */}
                  <div className="space-y-2">
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
                      icon={ImageIcon}
                      label="Product Image"
                      checked={!!activeTemplate.fields.showProductImage}
                      onChange={() => toggleElementField("showProductImage")}
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
                      icon={PenTool}
                      label="Signature"
                      checked={!!activeTemplate.fields.showSignature}
                      onChange={() => toggleElementField("showSignature")}
                    />
                    <ElementToggleRow
                      icon={HeartHandshake}
                      label="Thank You Note"
                      checked={!!activeTemplate.fields.showThankYou}
                      onChange={() => toggleElementField("showThankYou")}
                    />
                  </div>
                </div>
              </div>

              {/* Page Settings */}
              <div className="space-y-2.5 pt-2 border-t border-border/60">
                <h3 className="text-xs font-bold text-foreground">Page Settings</h3>

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
              {/* Primary Color Palette */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Primary Accent Color</label>
                <div className="flex flex-wrap items-center gap-2">
                  {COLOR_SWATCHES.map((swatch) => (
                    <button
                      key={swatch.value}
                      onClick={() => updateTemplateProperty("primaryColor", swatch.value)}
                      title={swatch.label}
                      className={`h-7 w-7 rounded-full border-2 transition-all cursor-pointer flex items-center justify-center ${
                        activeTemplate.primaryColor === swatch.value
                          ? "border-foreground scale-110 shadow-md"
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
                    <span className="text-[11px] font-mono text-muted-foreground">{activeTemplate.primaryColor}</span>
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
                  <div className="text-xs font-semibold text-foreground">Background Watermark</div>
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
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Opacity: {activeTemplate.watermarkOpacity || 15}%</span>
                      <input
                        type="range"
                        min="5"
                        max="40"
                        value={activeTemplate.watermarkOpacity || 15}
                        onChange={(e) => updateTemplateProperty("watermarkOpacity", Number(e.target.value))}
                        className="w-32 cursor-pointer"
                      />
                    </div>
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
                  <label className="text-xs font-semibold text-foreground">Barcode Symbology Format</label>
                  <select
                    value={activeTemplate.barcodeSymbology || "Code-128"}
                    onChange={(e) => updateTemplateProperty("barcodeSymbology", e.target.value as any)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-indigo-500"
                  >
                    <option value="Code-128">Code-128 (Standard Product Barcode)</option>
                    <option value="EAN-13">EAN-13 (GS1 Retail Format)</option>
                    <option value="Code-39">Code-39 (Alphanumeric)</option>
                    <option value="QR">QR Code (2D Data Matrix)</option>
                  </select>
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
                  <h2 className="text-xs font-bold text-foreground">Live Preview</h2>
                  <p className="text-[10px] text-muted-foreground">This is how your document will look</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
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

            {/* Document Canvas with scaling */}
            <div className="relative w-full bg-slate-100 dark:bg-slate-900/80 rounded-xl p-3 flex justify-center items-start overflow-hidden min-h-[460px] border border-border/60 shadow-inner">
              <div
                id="printable-preview-canvas"
                style={{
                  transform: `scale(${zoomLevel / 100})`,
                  transformOrigin: "top center",
                  transition: "transform 0.15s ease-out",
                }}
                className="w-full flex justify-center"
              >
                <LiveDocumentPreview template={activeTemplate} currency={currency} />
              </div>
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
}: {
  template: PrintTemplate;
  currency: { symbol: string; code: string };
}) {
  const { tenant } = useTenant();
  const f = template.fields;
  const theme = template.themeName || "stylish";

  // 1. INVOICE PREVIEW ENGINE
  if (template.docType === "invoice" || template.category === "invoices") {
    // ── Check if Custom Replica Template (Marg Pharma) ──
    if (theme === "marg_pharma") {
      const margMockInvoice: FullInvoiceData = {
        id: "mock-marg-01",
        invoice_number: "A000002",
        invoice_date: "2026-08-11",
        due_date: "2026-08-11",
        created_at: "2026-08-11T10:00:00Z",
        customerName: "ALI MEDICAL STORE",
        customerAddress: "32-1-111, Mehdipatnam, Hyderabad, 500028",
        customerPhone: "9912389593",
        customerGST: "36AAAAA0000A1Z5",
        taxable_value: 163200.0,
        cgst_amount: 14688.0,
        sgst_amount: 14688.0,
        tax_amount: 29376.0,
        grand_total: 192576.0,
        items: [
          {
            product_name: "BLUEWELL 500MG",
            quantity: 12,
            unit_price: 13600.0,
            mrp: 15000.0,
            hsn_code: "123456",
            tax_rate: 18,
            subtotal: 163200.0,
          },
        ],
      };
      return (
        <div className="w-[340px] sm:w-[360px] bg-white shadow-xl rounded-xl overflow-hidden border border-slate-200">
          <MargPharmaTemplate
            invoice={margMockInvoice}
            dynamicStoreName={template.storeName || tenant?.name || "SYED PHARMA DISTRIBUTORS"}
            dynamicLogoUrl={resolveImageUrl(template.logoUrl || "")}
            dynamicAddress={template.storeAddress || "67-1-220, Asif Nagar, Mehdipatnam"}
            dynamicPhone={template.storePhone || "911166969600"}
            dynamicEmail=""
            sellerGstin={template.gstin || "36DYHPR6361D1Z6"}
            sellerStateCode="36"
            currency={currency}
            f={f as any}
          />
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
        customerName: "Cust.Code: 17QC859 (Sri Lakshmi Stores)",
        customerAddress: "BAGDAL, HYDERABAD",
        customerPhone: "9686438474",
        customerGST: "UNREGISTERED",
        taxable_value: 6385.18,
        cgst_amount: 159.63,
        sgst_amount: 159.63,
        tax_amount: 319.26,
        grand_total: 6704.0,
        items: [
          { product_name: "DARK FANTASY CHOCO FILLS", quantity: 60, unit_price: 8.66, mrp: 10.0, hsn_code: "19053100", tax_rate: 5, discount_value: 0, subtotal: 519.48 },
          { product_name: "BINGO! CHIPS RS.5 SALTED", quantity: 1, unit_price: 1038.96, mrp: 5.0, hsn_code: "20052000", tax_rate: 5, discount_value: 92.26, subtotal: 946.7 },
        ],
      };
      return (
        <div className="w-[340px] sm:w-[360px] bg-white shadow-xl rounded-xl overflow-hidden border border-slate-200">
          <FmcgDistributorTemplate
            invoice={fmcgMockInvoice}
            dynamicStoreName={template.storeName || tenant?.name || "M.S. PAWAR & SONS"}
            dynamicLogoUrl={resolveImageUrl(template.logoUrl || "")}
            dynamicAddress={template.storeAddress || "Plot No N-2, Industrial Estate, Karnataka"}
            dynamicPhone={template.storePhone || "9999999999"}
            dynamicEmail=""
            sellerGstin={template.gstin || "29AAOFM2891F1ZT"}
            sellerStateCode="29"
            currency={currency}
            f={f as any}
          />
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
        customerName: "SRI MAHIRA SUPER MARKET",
        customerAddress: "JYOTHINAGAR, TELANGANA",
        customerPhone: "9849344919",
        customerGST: "36AAACH694G1Z4",
        taxable_value: 4500.0,
        cgst_amount: 225.0,
        sgst_amount: 225.0,
        tax_amount: 450.0,
        grand_total: 4950.0,
        items: [
          { product_name: "PARLE-G 250G BISCUITS", quantity: 24, unit_price: 25.0, mrp: 30.0, hsn_code: "19053100", tax_rate: 5, subtotal: 600.0 },
          { product_name: "HIDE & SEEK CHOCO CHIP", quantity: 12, unit_price: 45.0, mrp: 50.0, hsn_code: "19053100", tax_rate: 5, subtotal: 540.0 },
        ],
      };
      return (
        <div className="w-[340px] sm:w-[360px] bg-white shadow-xl rounded-xl overflow-hidden border border-slate-200">
          <ParleDistributorTemplate
            invoice={parleMockInvoice}
            dynamicStoreName={template.storeName || tenant?.name || "PARLE SUPER STORE"}
            dynamicLogoUrl={resolveImageUrl(template.logoUrl || "")}
            dynamicAddress={template.storeAddress || "Jyothinagar, Telangana"}
            dynamicPhone={template.storePhone || "9849344919"}
            dynamicEmail=""
            sellerGstin={template.gstin || "36AAACH694G1Z4"}
            sellerStateCode="36"
            currency={currency}
            f={f as any}
          />
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
        customerName: "FARMER COOPERATIVE SOCIETY",
        customerAddress: "MANDI YARD, PRODDATUR, AP",
        customerPhone: "9849344919",
        customerGST: "37AAFCOE694G1Z4",
        taxable_value: 8500.0,
        tax_amount: 425.0,
        grand_total: 8925.0,
        items: [
          { product_name: "HYBRID COTTON SEEDS BG-II", quantity: 10, unit_price: 850.0, mrp: 950.0, hsn_code: "12099900", tax_rate: 5, subtotal: 8500.0 },
        ],
      };
      return (
        <div className="w-[340px] sm:w-[360px] bg-white shadow-xl rounded-xl overflow-hidden border border-slate-200">
          <AgriSeedsTemplate
            invoice={agriMockInvoice}
            dynamicStoreName={template.storeName || tenant?.name || "SMART AGRI SEEDS"}
            dynamicLogoUrl={resolveImageUrl(template.logoUrl || "")}
            dynamicAddress={template.storeAddress || "Mandi Road, Proddatur"}
            dynamicPhone={template.storePhone || "9849344919"}
            dynamicEmail=""
            sellerGstin={template.gstin || "37AAFCOE694G1Z4"}
            sellerStateCode="37"
            dynamicBank={template.bankDetails || "Bank: SBI | A/C: 123456789 | IFSC: SBIN0001234"}
            currency={currency}
            f={f as any}
          />
        </div>
      );
    }

    // ── Authentic Standard Themes (Stylish, Luxury, Tally, BillBook, Modern, Simple, etc.) ──
    const isLuxury = theme === "luxury";
    const isTally = theme === "adv_tally" || theme === "classic";
    const isStylish = theme === "stylish";
    const isBillBook = theme === "billbook";
    const isModern = theme === "modern";
    const isSimple = theme === "simple";
    const isCultureUp = theme === "culture_up";
    const isCultureGod = theme === "culture_god";
    const isMinimal = theme === "minimal";
    const isElegant = theme === "elegant";
    const isCompact = theme === "compact";
    const isCleanSlate = theme === "clean_slate";
    const isEmeraldCorp = theme === "emerald_corp";

    const borderStyle = isTally
      ? "border-2 border-double border-slate-900"
      : isMinimal
      ? "border-0 shadow-sm"
      : isCleanSlate
      ? "border border-slate-300 rounded-2xl"
      : "border border-slate-200";

    return (
      <div
        className={`relative overflow-hidden w-[340px] sm:w-[360px] text-slate-900 p-4 sm:p-5 rounded-xl shadow-xl text-[8.5px] space-y-3 bg-white ${borderStyle}`}
        style={{
          fontFamily: template.fontFamily,
          backgroundColor: template.paperBgColor || "#ffffff",
          borderTop:
            isStylish || isCultureUp || isCultureGod || isElegant || isEmeraldCorp
              ? `5px solid ${template.primaryColor}`
              : undefined,
        }}
      >
        {/* Culture God / UP Header tags */}
        {(isCultureGod || isCultureUp) && (
          <div className="text-center text-[8px] font-bold tracking-widest text-amber-700 bg-amber-50 py-0.5 rounded border border-amber-200 -mt-1">
            {isCultureGod ? "॥ श्री गणेशाय नमः ॥ शुभ लाभ ॥" : "॥ गंगा मैया की जय ॥ उत्तर प्रदेश शासन स्वीकृत ॥"}
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

        {/* Watermark Overlay */}
        {template.showWatermark && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0"
            style={{ opacity: (template.watermarkOpacity || 15) / 100 }}
          >
            <span className="text-4xl font-black uppercase tracking-widest text-slate-900 -rotate-45 whitespace-nowrap">
              {template.watermarkText || template.storeName || "OFFICIAL"}
            </span>
          </div>
        )}

        {/* Invoice Header */}
        <div
          className={`flex items-start justify-between border-b pb-3 z-10 relative ${
            isTally ? "border-slate-900 border-b-2" : "border-slate-100"
          }`}
          style={!isTally && !isSimple && !isModern ? { borderBottom: `2px solid ${template.primaryColor}` } : {}}
        >
          <div>
            {f.showLogo && (
              <div className="flex items-center gap-1.5 mb-1">
                <div
                  className="h-6 w-6 rounded flex items-center justify-center text-white font-bold text-[10px]"
                  style={{ backgroundColor: template.primaryColor }}
                >
                  {template.storeName ? template.storeName.substring(0, 2).toUpperCase() : "AC"}
                </div>
                <span className="font-bold text-xs text-slate-900">{template.storeName || "ACME Luxury Store"}</span>
              </div>
            )}
            {!f.showLogo && (
              <h2 className="font-extrabold text-xs mb-0.5" style={{ color: template.primaryColor }}>
                {template.storeName || "Luxury Store"}
              </h2>
            )}
            <p className="text-[7.5px] text-slate-600 max-w-[180px] leading-tight">
              {template.storeAddress || "45 Royal Avenue, Heritage Plaza, Sector 18, Noida, UP"}
            </p>
            <p className="text-[7.5px] text-slate-500">Ph: {template.storePhone || "+91 9849344919"}</p>
            {template.gstin && (
              <p className="text-[7.5px] font-bold text-slate-700">GSTIN: {template.gstin}</p>
            )}
          </div>

          <div className="text-right">
            <h3
              className={`font-black text-xs tracking-wider uppercase mb-1 ${isLuxury ? "font-serif text-amber-900" : ""}`}
              style={{ color: isLuxury ? template.primaryColor : undefined }}
            >
              {template.headerTitle || "TAX INVOICE"}
            </h3>
            <div className="text-[7.5px] text-slate-600 space-y-0.5">
              <div>Invoice No: <strong>#INV-2026/0822</strong></div>
              <div>Date: 01 Aug 2026 12:14 PM</div>
              <div>Due Date: 15 Aug 2026</div>
            </div>
          </div>
        </div>

        {/* Customer / Party Info Block */}
        {f.showCustomerDetails && (
          <div
            className={`grid grid-cols-3 gap-1.5 p-2 rounded-lg border z-10 relative ${
              isModern
                ? "bg-slate-50 border-slate-100"
                : isLuxury
                ? "bg-amber-50/40 border-amber-200/60"
                : isTally
                ? "bg-white border-slate-900"
                : "bg-slate-50 border-slate-100"
            }`}
          >
            <div>
              <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider block">BILLED TO</span>
              <h4 className="font-bold text-slate-800 text-[8.5px] mt-0.5 leading-tight">ACME Enterprises Pvt Ltd</h4>
              <p className="text-[7px] text-slate-600 leading-tight">45 Tech Boulevard, Sector 62, Noida, UP</p>
              <p className="text-[7px] text-slate-600 font-medium">GSTIN: 09BBBBA9999C1Z2</p>
            </div>
            <div className="border-l border-slate-200 pl-1.5">
              <span className="text-[7px] font-bold text-indigo-500 uppercase tracking-wider block">SHIPPED TO</span>
              <h4 className="font-bold text-slate-800 text-[8.5px] mt-0.5 leading-tight">ACME Warehouse (Noida Hub)</h4>
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
                  Outstanding Balance: {currency.symbol}14,200.00
                </div>
              )}
            </div>
          </div>
        )}

        {/* Line Items Table */}
        {f.showItemTable && (
          <table className={`w-full border-collapse text-[7.5px] z-10 relative ${isTally ? "border border-slate-900" : ""}`}>
            <thead>
              <tr
                className="text-white text-left font-bold"
                style={{ backgroundColor: isSimple ? "#1e293b" : template.primaryColor }}
              >
                <th className={`p-1.5 ${isTally ? "border border-slate-900" : "rounded-l"}`}>#</th>
                <th className={`p-1.5 ${isTally ? "border border-slate-900" : ""}`}>ITEM & DESCRIPTION</th>
                {f.showHSN && <th className={`p-1.5 ${isTally ? "border border-slate-900" : ""}`}>HSN</th>}
                <th className={`p-1.5 text-center ${isTally ? "border border-slate-900" : ""}`}>QTY</th>
                <th className={`p-1.5 text-right ${isTally ? "border border-slate-900" : ""}`}>RATE</th>
                <th className={`p-1.5 text-right ${isTally ? "border border-slate-900" : "rounded-r"}`}>AMOUNT</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isTally ? "divide-slate-900" : "divide-slate-100"}`}>
              <tr className={isTally ? "border-b border-slate-900" : ""}>
                <td className={`p-1.5 text-slate-400 ${isTally ? "border-r border-slate-900 text-slate-900 text-center" : ""}`}>1</td>
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
                <td className={`p-1.5 text-right ${isTally ? "border-r border-slate-900" : ""}`}>{currency.symbol}12,000.00</td>
                <td className="p-1.5 text-right font-bold text-slate-900">{currency.symbol}10,620.00</td>
              </tr>
              <tr className={isTally ? "border-b border-slate-900" : ""}>
                <td className={`p-1.5 text-slate-400 ${isTally ? "border-r border-slate-900 text-slate-900 text-center" : ""}`}>2</td>
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
                <td className={`p-1.5 text-right ${isTally ? "border-r border-slate-900" : ""}`}>{currency.symbol}400.00</td>
                <td className="p-1.5 text-right font-bold text-slate-900">{currency.symbol}342.86</td>
              </tr>
            </tbody>
          </table>
        )}

        {/* Bank Details & Totals */}
        <div className="flex justify-between items-start pt-1 z-10 relative">
          {f.showBankDetails ? (
            <div className={`p-2 rounded-lg border max-w-[150px] ${isTally ? "border-slate-900 bg-white" : "border-slate-100 bg-slate-50"}`}>
              <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                BANK PAYMENT INFO
              </span>
              <p className="text-[7px] text-slate-700 whitespace-pre-line leading-tight font-mono">
                {template.bankDetails || "Bank: HDFC Bank\nA/C: 502000492811\nIFSC: HDFC0000003"}
              </p>
            </div>
          ) : (
            <div />
          )}

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
        </div>

        {/* Footer & Signature */}
        <div className="border-t pt-2.5 flex justify-between items-end z-10 relative">
          <div>
            {template.footerText && (
              <p className="text-[7.5px] font-semibold text-slate-700 mb-0.5">{template.footerText}</p>
            )}
            {template.termsText && (
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
          <h3 className="font-black text-xs">{template.storeName || "Smart Bazaar POS"}</h3>
          <p className="text-[7px] text-slate-600">{template.storeAddress || "Proddatur, AP"}</p>
          <p className="text-[7px] text-slate-600">GSTIN: {template.gstin || "37AAFCOE694G1Z4"}</p>
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
            <div className="flex flex-col items-center">
              <div className="h-5 w-24 bg-black text-white text-[6px] flex items-center justify-center">
                |||||||||||||||||
              </div>
              <span className="text-[6.5px]">8892019283</span>
            </div>
          )}
          <p className="text-[7px] text-slate-600">{template.thankYouNote || "Thank You! Visit Again!"}</p>
        </div>
      </div>
    );
  }

  // 3. BARCODE LABEL PREVIEW
  if (template.docType === "barcode" || template.category === "barcodes") {
    const mockBarcodeItem = {
      product_name: "Designer Saree Silk 3799",
      barcode: "2064965391328",
      sku: "SAR-3799",
      selling_price: 3799.0,
      mrp: 7599.0,
      category_name: "APPAREL / ETHNIC",
      format: template.barcodeSymbology || "Code-128",
    };
    return (
      <div className="w-[280px] shadow-2xl rounded-xl border border-slate-200 overflow-hidden bg-white">
        <SingleBarcodeLabelCard
          item={mockBarcodeItem}
          template={template as any}
          isPrint={false}
          orgName={template.storeName || tenant?.name || "RETAIL STORE"}
        />
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
              <h4 className="font-bold text-xs leading-tight text-slate-900 line-clamp-2 mt-0.5">
                Smart AI Fitness Watch Series 5
              </h4>
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
              <p className="text-xs text-muted-foreground">
                Browse, select, or duplicate pre-built ERP & retail formats.
              </p>
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
          {filtered.map((t) => {
            const isSelected = t.id === activeTemplateId;
            return (
              <div
                key={t.id}
                className={`flex flex-col justify-between p-4 rounded-2xl border transition-all ${
                  isSelected
                    ? "border-indigo-600 bg-indigo-50/20 ring-2 ring-indigo-500/20 shadow-sm"
                    : "border-border/80 bg-card hover:border-indigo-400 hover:bg-muted/20"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      {t.name}
                      {isSelected && (
                        <CheckCheck className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                      )}
                    </h4>
                    {t.isDefault && (
                      <span className="rounded-full bg-primary/10 text-primary text-[9px] font-bold px-2 py-0.5 shrink-0">
                        ORG DEFAULT
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    Paper Size: <strong className="text-foreground">{t.paperSize}</strong>
                  </span>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed line-clamp-3">
                    {t.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
                  <button
                    onClick={() => onSelect(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-indigo-600 text-white"
                        : "border border-border hover:bg-muted text-foreground"
                    }`}
                  >
                    {isSelected ? "Active Template" : "Select & Customize"}
                  </button>

                  <button
                    onClick={() => onDuplicate(t)}
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
  return `
<!DOCTYPE html>
<html>
<head>
  <title>${template.name} - Print Preview</title>
  <style>
    body { font-family: ${template.fontFamily || "Inter, sans-serif"}; margin: 0; padding: 20px; background: #f8fafc; color: #0f172a; }
    .sheet { max-width: 800px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
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
        <p style="margin: 4px 0; font-size: 12px;">Date: ${new Date().toLocaleDateString()}</p>
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
