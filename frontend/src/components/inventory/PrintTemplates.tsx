import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Printer,
  FileText,
  Receipt,
  ScanBarcode,
  QrCode,
  Plus,
  CheckCircle2,
  Edit3,
  Copy,
  Trash2,
  Star,
  Eye,
  Settings,
  Sparkles,
  Check,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

export interface PrintTemplate {
  id: string;
  name: string;
  category: "invoices" | "thermal" | "barcodes" | "qrcodes";
  description: string;
  isDefault: boolean;
  paperSize: string; // "A4" | "Letter" | "80mm" | "58mm" | "50x25mm" | "38x25mm" | "100x50mm"
  primaryColor: string;
  paperBgColor?: string; // Custom sheet/paper background color
  fontFamily: string;
  headerTitle?: string;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  gstin?: string;
  footerText?: string;
  termsText?: string;
  bankDetails?: string;
  // Watermark Customization
  showWatermark?: boolean;
  watermarkType?: "text" | "image";
  watermarkText?: string;
  watermarkImage?: string;
  watermarkOpacity?: number;
  // Field Toggles for Barcodes & Labels
  fields: {
    showProductName?: boolean;
    showPrice?: boolean;
    showMRP?: boolean;
    showSKU?: boolean;
    showBarcodeGraphic?: boolean;
    showMfgExpDate?: boolean;
    showCategoryBrand?: boolean;
    showCompanyName?: boolean;
    showCustomTagline?: boolean;
    customTaglineText?: string;
    // Invoice / Receipt specific
    showLogo?: boolean;
    showHSN?: boolean;
    showTaxSplit?: boolean;
    showBankDetails?: boolean;
    showSignature?: boolean;
    showCustomerDetails?: boolean;
    showPaymentQR?: boolean;
    showPartyBalance?: boolean;
    showItemDescription?: boolean;
    showTime?: boolean;
  };
  themeName?: string;
  createdAt: string;
}

const INITIAL_TEMPLATES: PrintTemplate[] = [
  // Invoices
  {
    id: "tpl-inv-stylish",
    name: "Stylish Theme",
    category: "invoices",
    description: "Modern card-style design with clean borders, high-contrast headers, and highlighted totals.",
    isDefault: true,
    paperSize: "A4",
    primaryColor: "#2563eb",
    fontFamily: "Inter, sans-serif",
    headerTitle: "TAX INVOICE",
    storeName: "I Smart Bazaar",
    storeAddress: "KK Street, Proddatur, YSR Cuddapah, Andhra Pradesh, 516360",
    storePhone: "+91 9849344919",
    gstin: "37AABCCH694G1Z4",
    footerText: "Thank you for shopping at I Smart Bazaar!",
    termsText: "1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged if payment is not made within due date.",
    bankDetails: "Bank: SBI | A/C: 334455667788 | IFSC: SBIN0001234",
    themeName: "stylish",
    fields: {
      showLogo: true,
      showHSN: true,
      showTaxSplit: true,
      showBankDetails: true,
      showSignature: true,
      showCustomerDetails: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: true,
      showPartyBalance: true,
      showItemDescription: true,
      showTime: true,
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-inv-luxury",
    name: "Luxury Theme",
    category: "invoices",
    description: "Elegant royal design with primary gold borders, premium serif fonts, and high-end aesthetics.",
    isDefault: false,
    paperSize: "A4",
    primaryColor: "#b45309",
    fontFamily: "Outfit, sans-serif",
    headerTitle: "INVOICE",
    storeName: "I Smart Bazaar Luxury",
    storeAddress: "KK Street, Proddatur, YSR Cuddapah, Andhra Pradesh, 516360",
    storePhone: "+91 9849344919",
    gstin: "37AABCCH694G1Z4",
    footerText: "We value your premium association.",
    termsText: "All claims subject to Cuddapah jurisdiction.",
    bankDetails: "Bank: HDFC Bank | A/C: 502000492811 | IFSC: HDFC0000003",
    themeName: "luxury",
    fields: {
      showLogo: true,
      showHSN: true,
      showTaxSplit: true,
      showBankDetails: true,
      showSignature: true,
      showCustomerDetails: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: true,
      showPartyBalance: true,
      showItemDescription: true,
      showTime: true,
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-inv-tally",
    name: "Advanced GST (Tally) Theme",
    category: "invoices",
    description: "Classic grid accounting format matching standard traditional business ERP systems with clear double borders.",
    isDefault: false,
    paperSize: "A4",
    primaryColor: "#0f172a",
    fontFamily: "Inter, sans-serif",
    headerTitle: "TAX INVOICE",
    storeName: "I Smart Bazaar (ERP Account)",
    storeAddress: "KK Street, Proddatur, YSR Cuddapah, Andhra Pradesh, 516360",
    storePhone: "+91 9849344919",
    gstin: "37AABCCH694G1Z4",
    footerText: "Computer Generated Invoice - No Signature Required.",
    termsText: "Goods once sold are not returnable.",
    bankDetails: "Bank: ICICI | A/C: 000405102030 | IFSC: ICIC0000004",
    themeName: "tally",
    fields: {
      showLogo: false,
      showHSN: true,
      showTaxSplit: true,
      showBankDetails: true,
      showSignature: true,
      showCustomerDetails: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: true,
      showPartyBalance: true,
      showItemDescription: true,
      showTime: false,
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-inv-adv-gst",
    name: "Advanced GST Theme",
    category: "invoices",
    description: "High-information layout featuring complete CGST/SGST/IGST tax splits and detailed party balance reporting.",
    isDefault: false,
    paperSize: "A4",
    primaryColor: "#16a34a",
    fontFamily: "Inter, sans-serif",
    headerTitle: "TAX INVOICE",
    storeName: "I Smart Bazaar",
    storeAddress: "KK Street, Proddatur, YSR Cuddapah, Andhra Pradesh, 516360",
    storePhone: "+91 9849344919",
    gstin: "37AABCCH694G1Z4",
    footerText: "Thank you for your business!",
    termsText: "E. & O.E. All disputes subject to Cuddapah jurisdiction only.",
    bankDetails: "Bank: Axis Bank | A/C: 912010023456 | IFSC: UTIB0000021",
    themeName: "adv_gst",
    fields: {
      showLogo: true,
      showHSN: true,
      showTaxSplit: true,
      showBankDetails: true,
      showSignature: true,
      showCustomerDetails: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: true,
      showPartyBalance: true,
      showItemDescription: true,
      showTime: true,
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-inv-billbook",
    name: "BillBook Theme",
    category: "invoices",
    description: "Standard commercial print format with clear highlighted headers and client copies indicator.",
    isDefault: false,
    paperSize: "A4",
    primaryColor: "#0284c7",
    fontFamily: "Inter, sans-serif",
    headerTitle: "TAX INVOICE",
    storeName: "I Smart Bazaar",
    storeAddress: "KK Street, Proddatur, YSR Cuddapah, Andhra Pradesh, 516360",
    storePhone: "+91 9849344919",
    gstin: "37AABCCH694G1Z4",
    footerText: "Original for Recipient Copy",
    termsText: "Interest will be charged @ 2% per month after due date.",
    bankDetails: "Bank: SBI | A/C: 334455667788 | IFSC: SBIN0001234",
    themeName: "billbook",
    fields: {
      showLogo: true,
      showHSN: true,
      showTaxSplit: true,
      showBankDetails: true,
      showSignature: true,
      showCustomerDetails: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: true,
      showPartyBalance: true,
      showItemDescription: true,
      showTime: true,
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-inv-modern",
    name: "Modern Theme",
    category: "invoices",
    description: "Sleek modern design featuring soft gray backgrounds, rounded cards, and clean typography.",
    isDefault: false,
    paperSize: "A4",
    primaryColor: "#475569",
    fontFamily: "Outfit, sans-serif",
    headerTitle: "TAX INVOICE",
    storeName: "I Smart Bazaar",
    storeAddress: "KK Street, Proddatur, YSR Cuddapah, Andhra Pradesh, 516360",
    storePhone: "+91 9849344919",
    gstin: "37AABCCH694G1Z4",
    footerText: "Thank you for choosing I Smart Bazaar!",
    termsText: "Subject to local terms and conditions.",
    bankDetails: "Bank: HDFC Bank | A/C: 502000492811 | IFSC: HDFC0000003",
    themeName: "modern",
    fields: {
      showLogo: true,
      showHSN: true,
      showTaxSplit: true,
      showBankDetails: true,
      showSignature: true,
      showCustomerDetails: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: true,
      showPartyBalance: true,
      showItemDescription: true,
      showTime: true,
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-inv-simple",
    name: "Simple Theme",
    category: "invoices",
    description: "Clean, no-nonsense minimal print style with simple border lines, perfect for black & white printing.",
    isDefault: false,
    paperSize: "A4",
    primaryColor: "#1e293b",
    fontFamily: "Inter, sans-serif",
    headerTitle: "INVOICE",
    storeName: "I Smart Bazaar",
    storeAddress: "KK Street, Proddatur, YSR Cuddapah, Andhra Pradesh, 516360",
    storePhone: "+91 9849344919",
    gstin: "37AABCCH694G1Z4",
    footerText: "Thank you!",
    termsText: "All disputes subject to Cuddapah jurisdiction only.",
    bankDetails: "Bank: SBI | A/C: 334455667788 | IFSC: SBIN0001234",
    themeName: "simple",
    fields: {
      showLogo: false,
      showHSN: true,
      showTaxSplit: false,
      showBankDetails: true,
      showSignature: true,
      showCustomerDetails: true,
      showProductName: true,
      showPrice: true,
      showMRP: false,
      showSKU: true,
      showPartyBalance: false,
      showItemDescription: false,
      showTime: false,
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-inv-up",
    name: "Uttar Pradesh (Artistic)",
    category: "invoices",
    description: "Regional artistic theme featuring local design borders, Ganga-Jamuna motif styling, and saffron highlights.",
    isDefault: false,
    paperSize: "A4",
    primaryColor: "#ea580c",
    fontFamily: "Outfit, sans-serif",
    headerTitle: "कर बीजक (TAX INVOICE)",
    storeName: "I Smart Bazaar UP",
    storeAddress: "KK Street, Proddatur, YSR Cuddapah, Andhra Pradesh, 516360",
    storePhone: "+91 9849344919",
    gstin: "37AABCCH694G1Z4",
    footerText: "हमारे यहाँ आने के लिए धन्यवाद!",
    termsText: "सभी विवाद स्थानीय क्षेत्राधिकार के अधीन हैं।",
    bankDetails: "Bank: SBI | A/C: 334455667788 | IFSC: SBIN0001234",
    themeName: "culture_up",
    fields: {
      showLogo: true,
      showHSN: true,
      showTaxSplit: true,
      showBankDetails: true,
      showSignature: true,
      showCustomerDetails: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: true,
      showPartyBalance: true,
      showItemDescription: true,
      showTime: true,
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-inv-god",
    name: "Hindu God (Spiritual)",
    category: "invoices",
    description: "Devotional saffron-tinted theme featuring traditional motifs, a spiritual border layout, and aura styling.",
    isDefault: false,
    paperSize: "A4",
    primaryColor: "#d97706",
    fontFamily: "Outfit, sans-serif",
    headerTitle: "श्री गणेशाय नमः (TAX INVOICE)",
    storeName: "I Smart Bazaar",
    storeAddress: "KK Street, Proddatur, YSR Cuddapah, Andhra Pradesh, 516360",
    storePhone: "+91 9849344919",
    gstin: "37AABCCH694G1Z4",
    footerText: "श्री कृष्णाय नमः | शुभ लाभ",
    termsText: "1. बिका हुआ माल वापस नहीं होगा।",
    bankDetails: "Bank: SBI | A/C: 334455667788 | IFSC: SBIN0001234",
    themeName: "culture_god",
    fields: {
      showLogo: true,
      showHSN: true,
      showTaxSplit: true,
      showBankDetails: true,
      showSignature: true,
      showCustomerDetails: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: true,
      showPartyBalance: true,
      showItemDescription: true,
      showTime: true,
    },
    createdAt: new Date().toISOString(),
  },

  // Thermal Receipts
  {
    id: "tpl-rec-compact",
    name: "Compact Theme (2 Inch)",
    category: "thermal",
    description: "Compact 2-inch format with tight spacing, condensed line heights, and space-saving headers.",
    isDefault: false,
    paperSize: "58mm",
    primaryColor: "#000000",
    fontFamily: "Courier New, monospace",
    headerTitle: "RETAIL BILL",
    storeName: "I Smart Bazaar Express",
    storeAddress: "KK Street, Proddatur, Andhra Pradesh",
    storePhone: "Ph: 9849344919",
    gstin: "GSTIN: 37AABCCH694G1Z4",
    footerText: "Thank You! Scan QR for Digital Bill",
    themeName: "compact",
    fields: {
      showLogo: false,
      showCustomerDetails: false,
      showTaxSplit: false,
      showPaymentQR: true,
      showProductName: true,
      showPrice: true,
      showPartyBalance: false,
      showItemDescription: false,
      showTime: false,
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-rec-advanced",
    name: "Advanced Theme (3 Inch)",
    category: "thermal",
    description: "Rich 3-inch (80mm) thermal layout including HSN, custom tax splits, logo space, and party balance.",
    isDefault: true,
    paperSize: "80mm",
    primaryColor: "#000000",
    fontFamily: "Courier New, monospace",
    headerTitle: "TAX INVOICE",
    storeName: "I SMART BAZAAR SUPERSTORE",
    storeAddress: "KK Street, Proddatur, YSR Cuddapah, 516360",
    storePhone: "Ph: 9849344919",
    gstin: "GST: 37AABCCH694G1Z4",
    footerText: "*** THANK YOU FOR YOUR VISIT ***\nVisit us again at www.ismartbazaar.com",
    termsText: "No Refund. Exchange within 7 days.",
    themeName: "advanced",
    fields: {
      showLogo: true,
      showCustomerDetails: true,
      showTaxSplit: true,
      showPaymentQR: true,
      showProductName: true,
      showPrice: true,
      showSKU: true,
      showPartyBalance: true,
      showItemDescription: true,
      showTime: true,
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-rec-simple",
    name: "Simple Theme (3 Inch)",
    category: "thermal",
    description: "Plain 3-inch (80mm) format focused entirely on product names and totals without extra details.",
    isDefault: false,
    paperSize: "80mm",
    primaryColor: "#000000",
    fontFamily: "Courier New, monospace",
    headerTitle: "CASH MEMO",
    storeName: "I SMART BAZAAR",
    storeAddress: "Proddatur",
    storePhone: "Ph: 9849344919",
    themeName: "simple",
    fields: {
      showLogo: false,
      showCustomerDetails: false,
      showTaxSplit: false,
      showPaymentQR: false,
      showProductName: true,
      showPrice: true,
      showPartyBalance: false,
      showItemDescription: false,
      showTime: false,
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-rec-classic",
    name: "Classic Theme (3 Inch)",
    category: "thermal",
    description: "Classic retro dot-matrix monospaced format with standard receipts border styles.",
    isDefault: false,
    paperSize: "80mm",
    primaryColor: "#000000",
    fontFamily: "Courier New, monospace",
    headerTitle: "SALES RECEIPT",
    storeName: "I SMART BAZAAR CO.",
    storeAddress: "KK Street, Proddatur",
    storePhone: "Ph: 9849344919",
    gstin: "GST: 37AABCCH694G1Z4",
    footerText: "Have a nice day!",
    themeName: "classic",
    fields: {
      showLogo: false,
      showCustomerDetails: true,
      showTaxSplit: true,
      showPaymentQR: true,
      showProductName: true,
      showPrice: true,
      showPartyBalance: true,
      showItemDescription: true,
      showTime: true,
    },
    createdAt: new Date().toISOString(),
  },

  // Barcode Tag Labels
  {
    id: "tpl-bar-1",
    name: "Retail Jewelry & Apparel Tag (2 Inch / 50x25mm)",
    category: "barcodes",
    description: "Compact 2-inch (50mm x 25mm) label showing Product Name, MRP, SKU, mfg date, and barcode graphic.",
    isDefault: true,
    paperSize: "50x25mm",
    primaryColor: "#1e293b",
    fontFamily: "Inter, sans-serif",
    storeName: "LAZYMONKEY RETAIL",
    fields: {
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: true,
      showBarcodeGraphic: true,
      showMfgExpDate: true,
      showCategoryBrand: true,
      showCompanyName: true,
      showCustomTagline: true,
      customTaglineText: "Incl. of all taxes",
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-bar-2",
    name: "Standard Shipping Label (3 Inch / 75x50mm)",
    category: "barcodes",
    description: "3-inch (75mm x 50mm) standard label template for packaging, shipping, and outer carton tracking.",
    isDefault: false,
    paperSize: "75x50mm",
    primaryColor: "#0f172a",
    fontFamily: "Inter, sans-serif",
    storeName: "LAZYMONKEY LOGISTICS",
    fields: {
      showProductName: true,
      showPrice: false,
      showMRP: false,
      showSKU: true,
      showBarcodeGraphic: true,
      showMfgExpDate: true,
      showCategoryBrand: true,
      showCompanyName: true,
      showCustomTagline: true,
      customTaglineText: "PRIORITY SHIPPING",
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-bar-3",
    name: "Large Cargo & Pallet Tag (5 Inch / 127x75mm)",
    category: "barcodes",
    description: "High-visibility 5-inch (127mm x 75mm) large barcode label for industrial cargo, warehouse shelves, and heavy logistics.",
    isDefault: false,
    paperSize: "127x75mm",
    primaryColor: "#000000",
    fontFamily: "Inter, sans-serif",
    storeName: "GLOBAL LOGISTICS NETWORK",
    fields: {
      showProductName: true,
      showPrice: false,
      showMRP: false,
      showSKU: true,
      showBarcodeGraphic: true,
      showMfgExpDate: true,
      showCategoryBrand: true,
      showCompanyName: true,
      showCustomTagline: true,
      customTaglineText: "HANDLE WITH CARE / FRAGILE",
    },
    createdAt: new Date().toISOString(),
  },

  // QR Code Labels
  {
    id: "tpl-qr-1",
    name: "Smart Product QR Tag (2 Inch / 50x25mm)",
    category: "qrcodes",
    description: "2-inch (50mm x 25mm) QR Code label encoding product URL and batch details for instant customer scan.",
    isDefault: true,
    paperSize: "50x25mm",
    primaryColor: "#0f766e",
    fontFamily: "Inter, sans-serif",
    storeName: "LAZYMONKEY AI SMART PRODUCTS",
    fields: {
      showProductName: true,
      showPrice: true,
      showSKU: true,
      showBarcodeGraphic: true, // used for QR graphic
      showCompanyName: true,
      showCustomTagline: true,
      customTaglineText: "Scan for authenticity & warranty",
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-qr-2",
    name: "Inventory Bin QR Tag (3 Inch / 75x50mm)",
    category: "qrcodes",
    description: "3-inch (75mm x 50mm) QR label for central warehouse bin location mapping and batch tracking.",
    isDefault: false,
    paperSize: "75x50mm",
    primaryColor: "#0f172a",
    fontFamily: "Inter, sans-serif",
    storeName: "LAZYMONKEY CENTRAL WAREHOUSE",
    fields: {
      showProductName: true,
      showPrice: false,
      showSKU: true,
      showBarcodeGraphic: true,
      showCompanyName: true,
      showCustomTagline: true,
      customTaglineText: "BIN LOCATION TAG",
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-qr-3",
    name: "Signage QR Poster (5 Inch / 127x75mm)",
    category: "qrcodes",
    description: "Large 5-inch (127mm x 75mm) high-visibility QR poster layout for counter stands and product checkout displays.",
    isDefault: false,
    paperSize: "127x75mm",
    primaryColor: "#2563eb",
    fontFamily: "Outfit, sans-serif",
    storeName: "LAZYMONKEY SUPERSTORE",
    fields: {
      showProductName: true,
      showPrice: true,
      showSKU: true,
      showBarcodeGraphic: true,
      showCompanyName: true,
      showCustomTagline: true,
      customTaglineText: "Scan to Pay / Check Out",
    },
    createdAt: new Date().toISOString(),
  },
];

export function PrintTemplates() {
  const [activeCategory, setActiveCategory] = useState<"invoices" | "thermal" | "barcodes" | "qrcodes">("invoices");
  const [templates, setTemplates] = useState<PrintTemplate[]>(() => {
    const saved = localStorage.getItem("businessos_print_templates_v1");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return INITIAL_TEMPLATES;
  });

  useEffect(() => {
    localStorage.setItem("businessos_print_templates_v1", JSON.stringify(templates));
  }, [templates]);

  const handleCategoryChange = (cat: "invoices" | "thermal" | "barcodes" | "qrcodes") => {
    setActiveCategory(cat);
    const url = new URL(window.location.href);
    url.searchParams.set("sub", cat);
    window.history.pushState({}, "", url.toString());
  };

  useEffect(() => {
    const syncSub = () => {
      const search = new URLSearchParams(window.location.search);
      const sub = search.get("sub");
      if (sub && ["invoices", "thermal", "barcodes", "qrcodes"].includes(sub)) {
        setActiveCategory(sub as any);
      }
    };
    syncSub();
    window.addEventListener("popstate", syncSub);
    const interval = setInterval(syncSub, 250);
    return () => {
      window.removeEventListener("popstate", syncSub);
      clearInterval(interval);
    };
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<PrintTemplate | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<PrintTemplate | null>(null);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  const [userActiveDefaults, setUserActiveDefaults] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem("user_active_print_templates_v1");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {};
  });

  useEffect(() => {
    localStorage.setItem("user_active_print_templates_v1", JSON.stringify(userActiveDefaults));
  }, [userActiveDefaults]);

  const handleSetActiveOrg = (id: string, category: string) => {
    setTemplates((prev) =>
      prev.map((t) => {
        if (t.category === category) {
          return { ...t, isDefault: t.id === id };
        }
        return t;
      })
    );
    const target = templates.find((t) => t.id === id);
    toast.success(`"${target?.name}" set as Organization Master Default for ${category.toUpperCase()}`);
  };

  const handleSetUserActive = (id: string, category: string) => {
    setUserActiveDefaults((prev) => ({
      ...prev,
      [category]: id,
    }));
    const target = templates.find((t) => t.id === id);
    toast.success(`"${target?.name}" set as Active Template for Your User Account!`);
  };

  const handleDuplicate = (t: PrintTemplate) => {
    const copy: PrintTemplate = {
      ...t,
      id: `tpl-${Date.now()}`,
      name: `${t.name} (Copy)`,
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
    setTemplates((prev) => [copy, ...prev]);
    toast.success("Template duplicated successfully!");
  };

  const handleDelete = (id: string) => {
    const target = templates.find((t) => t.id === id);
    if (target?.isDefault) {
      toast.error("Cannot delete the active default template! Set another template as default first.");
      return;
    }
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    toast.success("Template deleted.");
  };

  const handleSaveTemplate = (tpl: PrintTemplate) => {
    if (!tpl.name.trim()) {
      toast.error("Template name is required.");
      return;
    }
    setTemplates((prev) => {
      const exists = prev.some((x) => x.id === tpl.id);
      if (exists) {
        return prev.map((x) => (x.id === tpl.id ? tpl : x));
      } else {
        return [tpl, ...prev];
      }
    });
    toast.success(`Template "${tpl.name}" saved as Master Data.`);
    setEditingTemplate(null);
  };

  const filteredTemplates = templates.filter(
    (t) =>
      t.category === activeCategory &&
      (t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const categoryTitleMap = {
    invoices: "GST & Commercial Invoice Templates",
    thermal: "POS Thermal Receipt Slip Templates",
    barcodes: "Product Barcode Label & Tag Templates",
    qrcodes: "Product Smart QR Code Label Templates",
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Print & Document Master Templates
              </h1>
              <p className="text-sm text-muted-foreground">
                Design, customize, and set active master print layouts for Invoices, Thermal Receipts, Barcode Labels & QR Tags.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSelectorOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Create Master Template
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
        <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-primary font-bold">Multi-User Master Template Enablement:</span> Set an{" "}
          <span className="font-bold text-primary underline">Organization Default</span> for all users, or select{" "}
          <span className="font-bold text-teal-600 dark:text-teal-400 underline">Active for My Account</span> so different users in your team can use their own custom print layouts for POS, Invoices, and Barcode printing.
        </div>
      </div>

      {/* Category Tabs Switcher */}
      <div className="flex border-b border-border/80 bg-muted/10 p-1.5 rounded-2xl gap-1">
        <button
          onClick={() => handleCategoryChange("invoices")}
          className={`flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
            activeCategory === "invoices"
              ? "bg-primary text-primary-foreground shadow-md"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <FileText className="h-4 w-4" />
          GST & Commercial Invoices
        </button>
        <button
          onClick={() => handleCategoryChange("thermal")}
          className={`flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
            activeCategory === "thermal"
              ? "bg-primary text-primary-foreground shadow-md"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Receipt className="h-4 w-4" />
          POS Thermal Receipts
        </button>
        <button
          onClick={() => handleCategoryChange("barcodes")}
          className={`flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
            activeCategory === "barcodes"
              ? "bg-primary text-primary-foreground shadow-md"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <ScanBarcode className="h-4 w-4" />
          Barcode Label Tags
        </button>
        <button
          onClick={() => handleCategoryChange("qrcodes")}
          className={`flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
            activeCategory === "qrcodes"
              ? "bg-primary text-primary-foreground shadow-md"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <QrCode className="h-4 w-4" />
          Smart QR Tags
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight text-foreground">
          {categoryTitleMap[activeCategory]}
        </h2>

        <div className="relative w-72">
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-input bg-background py-2 pl-3 pr-8 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`group relative flex flex-col justify-between rounded-2xl border p-5 transition-all hover:shadow-xl ${
              t.isDefault
                ? "border-primary bg-gradient-to-b from-primary/5 via-background to-background ring-2 ring-primary/30"
                : "border-border/80 bg-card hover:border-primary/50"
            }`}
          >
            <div>
              {/* Header Badges */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                    {t.name}
                  </h3>
                  <span className="inline-block mt-1 text-xs font-medium text-muted-foreground">
                    Paper Size: <strong className="text-foreground">{t.paperSize}</strong>
                  </span>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  {t.isDefault && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground shadow-sm">
                      <CheckCircle2 className="h-3 w-3" />
                      ORG DEFAULT
                    </span>
                  )}

                  {userActiveDefaults[t.category] === t.id ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-teal-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                      <CheckCircle2 className="h-3 w-3" />
                      MY USER ACTIVE
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSetUserActive(t.id, t.category)}
                      className="inline-flex items-center gap-1 rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold text-teal-600 dark:text-teal-400 transition-all hover:bg-teal-500 hover:text-white cursor-pointer"
                    >
                      <Star className="h-2.5 w-2.5" />
                      Active for Me
                    </button>
                  )}

                  {!t.isDefault && (
                    <button
                      onClick={() => handleSetActiveOrg(t.id, t.category)}
                      className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                    >
                      Make Org Default
                    </button>
                  )}
                </div>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                {t.description}
              </p>

              {/* Template Feature Mini Chips */}
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border/50 pt-3">
                {t.fields.showProductName && (
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground">
                    Product Name
                  </span>
                )}
                {t.fields.showPrice && (
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground">
                    Price/MRP
                  </span>
                )}
                {t.fields.showBarcodeGraphic && (
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground">
                    Barcode/QR Graphic
                  </span>
                )}
                {t.fields.showMfgExpDate && (
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground">
                    Mfg/Exp Date
                  </span>
                )}
                {t.fields.showTaxSplit && (
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground">
                    Tax Breakdown
                  </span>
                )}
              </div>
            </div>

            {/* Actions Bar */}
            <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-3">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setPreviewTemplate(t);
                    setIsPreviewOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview & Test
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditingTemplate(t)}
                  title="Edit Template"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                >
                  <Edit3 className="h-4 w-4" />
                </button>

                <button
                  onClick={() => handleDuplicate(t)}
                  title="Duplicate Template"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                >
                  <Copy className="h-4 w-4" />
                </button>

                {!t.isDefault && (
                  <button
                    onClick={() => handleDelete(t.id)}
                    title="Delete Template"
                    className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Editor Modal */}
      {editingTemplate && (
        <TemplateEditorModal
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSave={handleSaveTemplate}
        />
      )}

      {/* Preview Modal */}
      {isPreviewOpen && previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          onClose={() => setIsPreviewOpen(false)}
        />
      )}

      {/* Base Theme Selector Modal */}
      {isSelectorOpen && (
        <BaseThemeSelectorModal
          category={activeCategory}
          onClose={() => setIsSelectorOpen(false)}
          onConfirm={(baseTemplate, name) => {
            const newTpl: PrintTemplate = {
              ...baseTemplate,
              id: `tpl-${Date.now()}`,
              name: name,
              isDefault: false,
              createdAt: new Date().toISOString(),
            };
            handleSaveTemplate(newTpl);
            setEditingTemplate(newTpl);
            setIsSelectorOpen(false);
          }}
        />
      )}
    </div>
  );
}

/* =========================================================================
   BASE THEME SELECTOR MODAL (Inspired by myBillBook Theme Selection Workflow)
   ========================================================================= */

interface SelectorProps {
  category: "invoices" | "thermal" | "barcodes" | "qrcodes";
  onClose: () => void;
  onConfirm: (baseTemplate: PrintTemplate, customName: string) => void;
}

function BaseThemeSelectorModal({ category, onClose, onConfirm }: SelectorProps) {
  const baseOptions = INITIAL_TEMPLATES.filter((t) => t.category === category);
  const [selectedId, setSelectedId] = useState<string>(baseOptions[0]?.id || "");
  const [customName, setCustomName] = useState<string>("");

  const selectedTemplate = baseOptions.find((t) => t.id === selectedId);

  useEffect(() => {
    if (selectedTemplate) {
      setCustomName(`My Custom ${selectedTemplate.name}`);
    }
  }, [selectedId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col w-full max-w-4xl max-h-[90vh] rounded-3xl bg-background border border-border shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Select Base Theme (myBillBook Theme Store)
              </h2>
              <p className="text-xs text-muted-foreground">
                Choose a pre-designed baseline style to customize for your business.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Custom Name Input */}
          <div className="bg-muted/30 p-4 rounded-2xl border border-border space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Name your custom template
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. My Custom Tax Bill"
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 font-semibold"
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Select baseline theme configuration ({baseOptions.length} available)
            </h3>

            {/* Grid of Base Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {baseOptions.map((opt) => {
                const isSelected = opt.id === selectedId;
                return (
                  <div
                    key={opt.id}
                    onClick={() => setSelectedId(opt.id)}
                    className={`group relative flex flex-col justify-between rounded-2xl border p-4 cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md"
                        : "border-border bg-card hover:border-primary/50 hover:bg-muted/10"
                    }`}
                  >
                    <div>
                      {/* Accent Color Strip */}
                      <div className="h-2 rounded-full mb-3" style={{ backgroundColor: opt.primaryColor }} />

                      <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                        {opt.name}
                      </h4>
                      <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed line-clamp-3">
                        {opt.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border/50 flex justify-between items-center text-[10px] font-semibold">
                      <span className="text-muted-foreground">Size: {opt.paperSize}</span>
                      {opt.themeName && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-foreground uppercase tracking-wider">
                          {opt.themeName.replace("_", " ")}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-end border-t border-border px-6 py-4 bg-muted/20 gap-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (selectedTemplate) {
                onConfirm(selectedTemplate, customName);
              }
            }}
            disabled={!selectedTemplate || !customName.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50"
          >
            Confirm & Customize
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* =========================================================================
   TEMPLATE EDITOR MODAL (Side-by-side Live Interactive Customizer & Preview)
   ========================================================================= */

interface EditorProps {
  template: PrintTemplate;
  onClose: () => void;
  onSave: (t: PrintTemplate) => void;
}

function TemplateEditorModal({ template, onClose, onSave }: EditorProps) {
  const [form, setForm] = useState<PrintTemplate>({ ...template });
  const [openSection, setOpenSection] = useState<string>("general");

  const updateField = (key: keyof PrintTemplate["fields"], value: boolean | string) => {
    setForm((prev) => ({
      ...prev,
      fields: {
        ...prev.fields,
        [key]: value,
      },
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col w-full max-w-6xl max-h-[92vh] rounded-3xl bg-background border border-border shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Master Template Customizer: <span className="text-primary">{form.name}</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Configure printable details, toggle fields, logo, colors, and preview live output.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(form)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition-all cursor-pointer"
            >
              <Check className="h-4 w-4" />
              Save Master Template
            </button>
          </div>
        </div>

        {/* Content Body: Split 2 Columns */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Column: Form Controls with Accordion Groups */}
          <div className="w-1/2 overflow-y-auto p-6 space-y-4 border-r border-border bg-slate-50/30">
            
            {/* 1. General Settings Accordion */}
            <div className="border border-border rounded-2xl bg-background overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenSection(openSection === "general" ? "" : "general")}
                className="w-full flex items-center justify-between px-5 py-4 font-bold text-sm text-foreground hover:bg-muted/50 transition-all cursor-pointer"
              >
                <span>1. General Settings & Dimensions</span>
                <span className="text-xs text-primary">{openSection === "general" ? "▼" : "▶"}</span>
              </button>

              {openSection === "general" && (
                <div className="p-5 border-t border-border space-y-4 bg-background">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Template Name
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Description / Notes
                    </label>
                    <textarea
                      rows={2}
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Paper/Label Dimensions
                      </label>
                      <select
                        value={form.paperSize}
                        onChange={(e) => setForm({ ...form, paperSize: e.target.value })}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                      >
                        {form.category === "invoices" && (
                          <>
                            <option value="A4">A4 Standard Sheet</option>
                            <option value="Letter">US Letter</option>
                          </>
                        )}
                        {form.category === "thermal" && (
                          <>
                            <option value="58mm">2 Inch Thermal (58mm Compact)</option>
                            <option value="80mm">3 Inch Thermal (80mm Standard POS)</option>
                            <option value="127mm">5 Inch Thermal (127mm Large Slip)</option>
                          </>
                        )}
                        {(form.category === "barcodes" || form.category === "qrcodes") && (
                          <>
                            <option value="50x25mm">2 Inch Label (50mm x 25mm Retail/Apparel)</option>
                            <option value="75x50mm">3 Inch Label (75mm x 50mm Standard Shipping)</option>
                            <option value="127x75mm">5 Inch Label (127mm x 75mm Cargo/Pallet)</option>
                            <option value="38x25mm">1.5 Inch Compact Label (38mm x 25mm)</option>
                            <option value="100x50mm">4 Inch Warehouse Tag (100mm x 50mm)</option>
                          </>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Primary Theme Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={form.primaryColor || "#2563eb"}
                          onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                          className="h-9 w-12 rounded-lg cursor-pointer border border-input p-0.5 bg-background"
                        />
                        <span className="text-xs font-mono text-muted-foreground">{form.primaryColor}</span>
                      </div>
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Custom Sheet / Paper Background Color
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={form.paperBgColor || "#ffffff"}
                          onChange={(e) => setForm({ ...form, paperBgColor: e.target.value })}
                          className="h-9 w-12 rounded-lg cursor-pointer border border-input p-0.5 bg-background"
                        />
                        <span className="text-xs font-mono text-muted-foreground">{form.paperBgColor || "#ffffff"}</span>
                        
                        <div className="flex items-center gap-1.5 ml-auto text-xs">
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, paperBgColor: "#ffffff" })}
                            className="rounded-lg border border-border bg-white px-2 py-1 font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                          >
                            White
                          </button>
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, paperBgColor: "#fffdf5" })}
                            className="rounded-lg border border-amber-200 bg-[#fffdf5] px-2 py-1 font-semibold text-amber-900 cursor-pointer"
                          >
                            Cream
                          </button>
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, paperBgColor: "#f8fafc" })}
                            className="rounded-lg border border-slate-200 bg-[#f8fafc] px-2 py-1 font-semibold text-slate-800 cursor-pointer"
                          >
                            Slate
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Invoice & Receipt Details Accordion */}
            <div className="border border-border rounded-2xl bg-background overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenSection(openSection === "details" ? "" : "details")}
                className="w-full flex items-center justify-between px-5 py-4 font-bold text-sm text-foreground hover:bg-muted/50 transition-all cursor-pointer"
              >
                <span>2. Invoice & Receipt Customizations</span>
                <span className="text-xs text-primary">{openSection === "details" ? "▼" : "▶"}</span>
              </button>

              {openSection === "details" && (
                <div className="p-5 border-t border-border space-y-4 bg-background">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <label className="flex items-center gap-2.5 rounded-xl border border-border p-2.5 hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!form.fields.showLogo}
                        onChange={(e) => updateField("showLogo", e.target.checked)}
                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                      />
                      <span className="text-xs font-medium text-foreground">Show Company Logo</span>
                    </label>

                    <label className="flex items-center gap-2.5 rounded-xl border border-border p-2.5 hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!form.fields.showTime}
                        onChange={(e) => updateField("showTime", e.target.checked)}
                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                      />
                      <span className="text-xs font-medium text-foreground">Show Time on Invoices</span>
                    </label>

                    <label className="flex items-center gap-2.5 rounded-xl border border-border p-2.5 hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!form.fields.showBankDetails}
                        onChange={(e) => updateField("showBankDetails", e.target.checked)}
                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                      />
                      <span className="text-xs font-medium text-foreground">Show Bank Payment Details</span>
                    </label>

                    <label className="flex items-center gap-2.5 rounded-xl border border-border p-2.5 hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!form.fields.showSignature}
                        onChange={(e) => updateField("showSignature", e.target.checked)}
                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                      />
                      <span className="text-xs font-medium text-foreground">Show Digital Signature Box</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Header Title Text
                      </label>
                      <input
                        type="text"
                        value={form.headerTitle || ""}
                        onChange={(e) => setForm({ ...form, headerTitle: e.target.value })}
                        placeholder="e.g. TAX INVOICE"
                        className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Store/Organization Name
                      </label>
                      <input
                        type="text"
                        value={form.storeName || ""}
                        onChange={(e) => setForm({ ...form, storeName: e.target.value })}
                        placeholder="Store Name"
                        className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Store Address
                    </label>
                    <input
                      type="text"
                      value={form.storeAddress || ""}
                      onChange={(e) => setForm({ ...form, storeAddress: e.target.value })}
                      placeholder="Store Address"
                      className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Store Mobile Phone No.
                      </label>
                      <input
                        type="text"
                        value={form.storePhone || ""}
                        onChange={(e) => setForm({ ...form, storePhone: e.target.value })}
                        placeholder="Mobile No"
                        className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        GSTIN / Tax ID Number
                      </label>
                      <input
                        type="text"
                        value={form.gstin || ""}
                        onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                        placeholder="GSTIN"
                        className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Bank Payment details (displayed on invoice)
                    </label>
                    <textarea
                      rows={2}
                      value={form.bankDetails || ""}
                      onChange={(e) => setForm({ ...form, bankDetails: e.target.value })}
                      placeholder="Bank Details"
                      className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Terms & Conditions / Disclaimer
                    </label>
                    <textarea
                      rows={2}
                      value={form.termsText || ""}
                      onChange={(e) => setForm({ ...form, termsText: e.target.value })}
                      className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Footer Notes Text
                    </label>
                    <input
                      type="text"
                      value={form.footerText || ""}
                      onChange={(e) => setForm({ ...form, footerText: e.target.value })}
                      className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 3. Party Details Accordion */}
            <div className="border border-border rounded-2xl bg-background overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenSection(openSection === "party" ? "" : "party")}
                className="w-full flex items-center justify-between px-5 py-4 font-bold text-sm text-foreground hover:bg-muted/50 transition-all cursor-pointer"
              >
                <span>3. Party Details Customizations</span>
                <span className="text-xs text-primary">{openSection === "party" ? "▼" : "▶"}</span>
              </button>

              {openSection === "party" && (
                <div className="p-5 border-t border-border space-y-4 bg-background">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <label className="flex items-center gap-2.5 rounded-xl border border-border p-2.5 hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!form.fields.showCustomerDetails}
                        onChange={(e) => updateField("showCustomerDetails", e.target.checked)}
                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                      />
                      <span className="text-xs font-medium text-foreground">Show Billed-To Customer Info</span>
                    </label>

                    <label className="flex items-center gap-2.5 rounded-xl border border-border p-2.5 hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!form.fields.showPartyBalance}
                        onChange={(e) => updateField("showPartyBalance", e.target.checked)}
                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                      />
                      <span className="text-xs font-medium text-foreground">Show Party Balance in Invoice</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Item Table Columns Accordion */}
            <div className="border border-border rounded-2xl bg-background overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenSection(openSection === "items" ? "" : "items")}
                className="w-full flex items-center justify-between px-5 py-4 font-bold text-sm text-foreground hover:bg-muted/50 transition-all cursor-pointer"
              >
                <span>4. Item Table Columns Customizer</span>
                <span className="text-xs text-primary">{openSection === "items" ? "▼" : "▶"}</span>
              </button>

              {openSection === "items" && (
                <div className="p-5 border-t border-border space-y-4 bg-background">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <label className="flex items-center gap-2.5 rounded-xl border border-border p-2.5 hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!form.fields.showProductName}
                        onChange={(e) => updateField("showProductName", e.target.checked)}
                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                      />
                      <span className="text-xs font-medium text-foreground">Show Item Name</span>
                    </label>

                    <label className="flex items-center gap-2.5 rounded-xl border border-border p-2.5 hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!form.fields.showPrice}
                        onChange={(e) => updateField("showPrice", e.target.checked)}
                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                      />
                      <span className="text-xs font-medium text-foreground">Show Selling Price</span>
                    </label>

                    <label className="flex items-center gap-2.5 rounded-xl border border-border p-2.5 hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!form.fields.showMRP}
                        onChange={(e) => updateField("showMRP", e.target.checked)}
                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                      />
                      <span className="text-xs font-medium text-foreground">Show MRP / List Price</span>
                    </label>

                    <label className="flex items-center gap-2.5 rounded-xl border border-border p-2.5 hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!form.fields.showSKU}
                        onChange={(e) => updateField("showSKU", e.target.checked)}
                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                      />
                      <span className="text-xs font-medium text-foreground">Show SKU / Code</span>
                    </label>

                    <label className="flex items-center gap-2.5 rounded-xl border border-border p-2.5 hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!form.fields.showHSN}
                        onChange={(e) => updateField("showHSN", e.target.checked)}
                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                      />
                      <span className="text-xs font-medium text-foreground">Show HSN/SAC Column</span>
                    </label>

                    <label className="flex items-center gap-2.5 rounded-xl border border-border p-2.5 hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!form.fields.showItemDescription}
                        onChange={(e) => updateField("showItemDescription", e.target.checked)}
                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                      />
                      <span className="text-xs font-medium text-foreground">Show Item Description in Invoice</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Miscellaneous & Watermark Accordion */}
            <div className="border border-border rounded-2xl bg-background overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenSection(openSection === "misc" ? "" : "misc")}
                className="w-full flex items-center justify-between px-5 py-4 font-bold text-sm text-foreground hover:bg-muted/50 transition-all cursor-pointer"
              >
                <span>5. Miscellaneous & Watermark Details</span>
                <span className="text-xs text-primary">{openSection === "misc" ? "▼" : "▶"}</span>
              </button>

              {openSection === "misc" && (
                <div className="p-5 border-t border-border space-y-4 bg-background">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <label className="flex items-center gap-2.5 rounded-xl border border-border p-2.5 hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!form.fields.showTaxSplit}
                        onChange={(e) => updateField("showTaxSplit", e.target.checked)}
                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                      />
                      <span className="text-xs font-medium text-foreground">Show CGST/SGST Breakdown</span>
                    </label>

                    <label className="flex items-center gap-2.5 rounded-xl border border-border p-2.5 hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!form.fields.showPaymentQR}
                        onChange={(e) => updateField("showPaymentQR", e.target.checked)}
                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                      />
                      <span className="text-xs font-medium text-foreground">Show Payment UPI QR Code</span>
                    </label>
                  </div>

                  {(form.category === "barcodes" || form.category === "qrcodes") && (
                    <div className="border-t border-border pt-4 grid grid-cols-2 gap-3 text-xs">
                      <label className="flex items-center gap-2.5 rounded-xl border border-border p-2.5 hover:bg-muted/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!form.fields.showBarcodeGraphic}
                          onChange={(e) => updateField("showBarcodeGraphic", e.target.checked)}
                          className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                        />
                        <span className="text-xs font-medium text-foreground">
                          {form.category === "qrcodes" ? "QR Code Image" : "Barcode Graphic"}
                        </span>
                      </label>

                      <label className="flex items-center gap-2.5 rounded-xl border border-border p-2.5 hover:bg-muted/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!form.fields.showMfgExpDate}
                          onChange={(e) => updateField("showMfgExpDate", e.target.checked)}
                          className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                        />
                        <span className="text-xs font-medium text-foreground">Mfg & Expiry Date</span>
                      </label>

                      <label className="flex items-center gap-2.5 rounded-xl border border-border p-2.5 hover:bg-muted/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!form.fields.showCategoryBrand}
                          onChange={(e) => updateField("showCategoryBrand", e.target.checked)}
                          className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                        />
                        <span className="text-xs font-medium text-foreground">Category / Brand</span>
                      </label>

                      <label className="flex items-center gap-2.5 rounded-xl border border-border p-2.5 hover:bg-muted/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!form.fields.showCompanyName}
                          onChange={(e) => updateField("showCompanyName", e.target.checked)}
                          className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                        />
                        <span className="text-xs font-medium text-foreground">Company Name</span>
                      </label>

                      <div className="col-span-2 space-y-1.5 pt-2">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!form.fields.showCustomTagline}
                            onChange={(e) => updateField("showCustomTagline", e.target.checked)}
                            className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                          />
                          <span className="text-xs font-medium text-foreground">Custom Footer Tagline</span>
                        </label>
                        {form.fields.showCustomTagline && (
                          <input
                            type="text"
                            value={form.fields.customTaglineText || ""}
                            onChange={(e) => updateField("customTaglineText", e.target.value)}
                            placeholder="e.g. Incl. of all taxes"
                            className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Watermark Details */}
                  <div className="border-t border-border pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">Watermark Stamp Overlay</span>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!form.showWatermark}
                          onChange={(e) => setForm({ ...form, showWatermark: e.target.checked })}
                          className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                        />
                        <span className="text-xs font-bold text-foreground">Enable</span>
                      </label>
                    </div>

                    {form.showWatermark && (
                      <div className="space-y-3 bg-muted/40 p-3.5 rounded-2xl border border-border">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-foreground mb-1">
                              Watermark Type
                            </label>
                            <select
                              value={form.watermarkType || "text"}
                              onChange={(e) => setForm({ ...form, watermarkType: e.target.value as any })}
                              className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                            >
                              <option value="text">Text Stamp (e.g. OFFICIAL)</option>
                              <option value="image">Custom Logo / Image URL</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-foreground mb-1">
                              Opacity ({Math.round((form.watermarkOpacity || 0.15) * 100)}%)
                            </label>
                            <input
                              type="range"
                              min="0.05"
                              max="0.4"
                              step="0.05"
                              value={form.watermarkOpacity || 0.15}
                              onChange={(e) => setForm({ ...form, watermarkOpacity: parseFloat(e.target.value) })}
                              className="w-full accent-primary cursor-pointer mt-1"
                            />
                          </div>
                        </div>

                        {form.watermarkType === "image" ? (
                          <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-foreground mb-1">
                              Image URL
                            </label>
                            <input
                              type="text"
                              value={form.watermarkImage || ""}
                              onChange={(e) => setForm({ ...form, watermarkImage: e.target.value })}
                              placeholder="https://example.com/logo-watermark.png"
                              className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-xs font-semibold text-foreground mb-1">
                              Watermark Text Stamp
                            </label>
                            <input
                              type="text"
                              value={form.watermarkText || "OFFICIAL"}
                              onChange={(e) => setForm({ ...form, watermarkText: e.target.value })}
                              placeholder="e.g. PAID / ORIGINAL"
                              className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none font-bold uppercase"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Live Interactive WYSIWYG Preview */}
          <div className="w-1/2 bg-muted/40 p-6 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-primary" /> Live WYSIWYG Preview ({form.paperSize})
                </span>
                <span className="text-[11px] rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary">
                  Interactive Preview
                </span>
              </div>

              {/* Live Render Area */}
              <div className="flex items-center justify-center p-4 bg-slate-900/10 rounded-2xl border border-border">
                <LiveTemplateRender template={form} />
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>Modifications update live on the right.</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* =========================================================================
   TEMPLATE PREVIEW MODAL & PRINT HANDLER
   ========================================================================= */

function TemplatePreviewModal({
  template,
  onClose,
}: {
  template: PrintTemplate;
  onClose: () => void;
}) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col w-full max-w-4xl max-h-[95vh] rounded-3xl bg-background border border-border shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Print Preview: {template.name}
              </h2>
              <span className="text-xs text-muted-foreground">
                Format: <strong>{template.paperSize}</strong> | Status:{" "}
                {template.isDefault ? (
                  <strong className="text-primary">ACTIVE MASTER DEFAULT</strong>
                ) : (
                  "Standard Template"
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer"
            >
              Close
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition-all cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              Print / Save PDF
            </button>
          </div>
        </div>

        {/* Printable Paper Render View */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-950/20 flex justify-center">
          <div className="print-area shadow-2xl">
            <LiveTemplateRender template={template} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* =========================================================================
   LIVE WYSIWYG TEMPLATE RENDERER (Supports Invoice, Thermal, Barcode & QR)
   ========================================================================= */

function LiveTemplateRender({ template }: { template: PrintTemplate }) {
  const f = template.fields;
  const theme = template.themeName || "stylish";

  // 1. INVOICE A4 TEMPLATE RENDER
  if (template.category === "invoices") {
    // Determine specific visual accents
    const isLuxury = theme === "luxury";
    const isTally = theme === "tally";
    const isStylish = theme === "stylish";
    const isAdvGst = theme === "adv_gst";
    const isBillBook = theme === "billbook";
    const isModern = theme === "modern";
    const isSimple = theme === "simple";
    const isCultureUp = theme === "culture_up";
    const isCultureGod = theme === "culture_god";

    // Setup styles
    const borderStyle = isTally ? "border-2 border-double border-slate-900" : "border border-slate-200";
    const titleFont = isLuxury ? "font-serif" : "font-sans";

    return (
      <div
        className={`relative overflow-hidden w-[520px] text-slate-900 p-8 rounded-lg shadow-xl text-xs space-y-5 ${borderStyle}`}
        style={{
          fontFamily: template.fontFamily,
          backgroundColor: template.paperBgColor || "#ffffff",
          borderTop: isStylish || isCultureUp || isCultureGod ? `6px solid ${template.primaryColor}` : undefined,
        }}
      >
        {/* Culture God / UP Header tags */}
        {(isCultureGod || isCultureUp) && (
          <div className="text-center text-[10px] font-bold tracking-widest text-amber-700 bg-amber-50 py-1 rounded-md border border-amber-200 -mt-2">
            {isCultureGod ? "॥ श्री गणेशाय नमः ॥ शुभ लाभ ॥" : "॥ गंगा मैया की जय ॥ उत्तर प्रदेश शासन स्वीकृत ॥"}
          </div>
        )}

        {/* Recipient Copy Checkbox (myBillBook style BillBook theme) */}
        {isBillBook && (
          <div className="flex justify-between items-center text-[9px] text-slate-500 border-b border-dashed pb-2">
            <span className="font-semibold text-slate-700">TAX INVOICE</span>
            <div className="flex gap-3">
              <label className="flex items-center gap-1">
                <input type="checkbox" defaultChecked disabled /> [x] Original for Recipient
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" disabled /> [ ] Duplicate for Transporter
              </label>
            </div>
          </div>
        )}

        {/* Watermark Overlay */}
        {template.showWatermark && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0"
            style={{ opacity: template.watermarkOpacity || 0.15 }}
          >
            {template.watermarkType === "image" && template.watermarkImage ? (
              <img src={template.watermarkImage} alt="Watermark" className="max-w-[70%] max-h-[70%] object-contain" />
            ) : (
              <span className="text-6xl font-black uppercase tracking-widest text-slate-900 -rotate-45 whitespace-nowrap">
                {template.watermarkText || "OFFICIAL"}
              </span>
            )}
          </div>
        )}

        {/* Invoice Header */}
        <div className={`flex items-start justify-between border-b pb-5 z-10 relative ${isTally ? "border-slate-900 border-b-2" : "border-slate-100"}`}
             style={(!isTally && !isSimple && !isModern) ? { borderBottom: `2px solid ${template.primaryColor}` } : {}}>
          <div>
            {f.showLogo && (
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: template.primaryColor }}
                >
                  {template.storeName ? template.storeName.substring(0, 2).toUpperCase() : "IS"}
                </div>
                <span className="font-bold text-base text-slate-900">{template.storeName}</span>
              </div>
            )}
            {!f.showLogo && (
              <h2 className="font-extrabold text-base mb-1" style={{ color: template.primaryColor }}>
                {template.storeName}
              </h2>
            )}
            <p className="text-[11px] text-slate-600 max-w-[260px] leading-relaxed">
              {template.storeAddress}
            </p>
            <p className="text-[11px] text-slate-600 mt-1">Ph: {template.storePhone}</p>
            {template.gstin && (
              <p className="text-[11px] font-semibold text-slate-800 mt-0.5">GSTIN: {template.gstin}</p>
            )}
          </div>

          <div className="text-right">
            <h1 className={`text-xl font-extrabold tracking-tight ${titleFont}`} style={{ color: template.primaryColor }}>
              {template.headerTitle || "TAX INVOICE"}
            </h1>
            <p className="text-[11px] font-bold text-slate-700 mt-1">Invoice No: #INV-2026/0822</p>
            <p className="text-[10px] text-slate-500">Date: 01 Aug 2026 {f.showTime && "12:14 PM"}</p>
            <p className="text-[10px] text-slate-500">Due Date: 15 Aug 2026</p>
          </div>
        </div>

        {/* Customer Info Block */}
        {f.showCustomerDetails && (
          <div className={`flex justify-between p-3 rounded-lg border z-10 relative ${
            isModern ? "bg-slate-50 border-slate-100" :
            isLuxury ? "bg-amber-50/30 border-amber-200/50" :
            isTally ? "bg-white border-slate-900" : "bg-slate-50 border-slate-100"
          }`}>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Billed To</span>
              <h4 className="font-bold text-slate-800 text-sm mt-0.5">ACME Enterprises Pvt Ltd</h4>
              <p className="text-[11px] text-slate-600">45 Tech Boulevard, Sector 62, Noida, UP</p>
              <p className="text-[11px] text-slate-600">GSTIN: 09BBBBA9999C1Z2</p>
            </div>
            <div className="text-right flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Place of Supply</span>
                <p className="text-[11px] font-semibold text-slate-700 mt-0.5">Uttar Pradesh (09)</p>
              </div>
              {f.showPartyBalance && (
                <div className="text-[10px] font-bold text-red-600 mt-2">
                  Outstanding Balance: ₹14,200.00
                </div>
              )}
            </div>
          </div>
        )}

        {/* Line Items Table */}
        <table className={`w-full border-collapse text-[11px] z-10 relative ${isTally ? "border border-slate-900" : ""}`}>
          <thead>
            <tr className="text-white text-left font-bold"
                style={{ backgroundColor: isSimple ? "#1e293b" : template.primaryColor }}>
              <th className={`p-2.5 ${isTally ? "border border-slate-900" : "rounded-l-md"}`}>#</th>
              <th className={`p-2.5 ${isTally ? "border border-slate-900" : ""}`}>Item & Description</th>
              {f.showHSN && <th className={`p-2.5 ${isTally ? "border border-slate-900" : ""}`}>HSN</th>}
              <th className={`p-2.5 text-center ${isTally ? "border border-slate-900" : ""}`}>Qty</th>
              <th className={`p-2.5 text-right ${isTally ? "border border-slate-900" : ""}`}>Rate</th>
              <th className={`p-2.5 text-right ${isTally ? "border border-slate-900" : "rounded-r-md"}`}>Amount</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isTally ? "divide-slate-900" : "divide-slate-100"}`}>
            <tr className={isTally ? "border-b border-slate-900" : ""}>
              <td className={`p-2.5 text-slate-400 ${isTally ? "border-r border-slate-900 text-slate-900 text-center" : ""}`}>1</td>
              <td className={`p-2.5 font-semibold text-slate-800 ${isTally ? "border-r border-slate-900" : ""}`}>
                Samsung Galaxy A30
                {f.showItemDescription && (
                  <span className="block text-[9px] font-normal text-slate-500">
                    6.4-inch display, 4GB RAM, Dual Camera setup, 4000mAh Battery.
                  </span>
                )}
                {f.showSKU && <span className="block text-[8px] font-normal text-slate-500">SKU: SAM-A30-4G</span>}
              </td>
              {f.showHSN && <td className={`p-2.5 text-slate-600 ${isTally ? "border-r border-slate-900 text-center" : ""}`}>85171200</td>}
              <td className={`p-2.5 text-center font-bold ${isTally ? "border-r border-slate-900" : ""}`}>1 PCS</td>
              <td className={`p-2.5 text-right ${isTally ? "border-r border-slate-900" : ""}`}>₹12,000.00</td>
              <td className="p-2.5 text-right font-bold text-slate-900">₹10,620.00</td>
            </tr>
            <tr className={isTally ? "border-b border-slate-900" : ""}>
              <td className={`p-2.5 text-slate-400 ${isTally ? "border-r border-slate-900 text-slate-900 text-center" : ""}`}>2</td>
              <td className={`p-2.5 font-semibold text-slate-800 ${isTally ? "border-r border-slate-900" : ""}`}>
                Parle-G Biscuit 200g
                {f.showItemDescription && (
                  <span className="block text-[9px] font-normal text-slate-500">
                    Crispy glucose biscuits packed with wheat & milk energy.
                  </span>
                )}
                {f.showSKU && <span className="block text-[8px] font-normal text-slate-500">SKU: PARLE-G-200</span>}
              </td>
              {f.showHSN && <td className={`p-2.5 text-slate-600 ${isTally ? "border-r border-slate-900 text-center" : ""}`}>19059090</td>}
              <td className={`p-2.5 text-center font-bold ${isTally ? "border-r border-slate-900" : ""}`}>1 BOX</td>
              <td className={`p-2.5 text-right ${isTally ? "border-r border-slate-900" : ""}`}>₹400.00</td>
              <td className="p-2.5 text-right font-bold text-slate-900">₹342.86</td>
            </tr>
          </tbody>
        </table>

        {/* Calculation Totals */}
        <div className="flex justify-between items-start pt-2 z-10 relative">
          {f.showBankDetails ? (
            <div className={`p-3 rounded-lg border max-w-[240px] ${
              isTally ? "border-slate-900 bg-white" : "border-slate-100 bg-slate-50"
            }`}>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Bank Payment Info
              </span>
              <p className="text-[10px] text-slate-700 whitespace-pre-line leading-relaxed font-mono">
                {template.bankDetails}
              </p>
            </div>
          ) : (
            <div />
          )}

          <div className="w-52 space-y-1.5 text-slate-700 text-[11px]">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-semibold">₹11,497.00</span>
            </div>
            {f.showTaxSplit && (
              <>
                <div className="flex justify-between text-slate-500">
                  <span>CGST (9%):</span>
                  <span>₹1,034.73</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>SGST (9%):</span>
                  <span>₹1,034.73</span>
                </div>
              </>
            )}
            <div
              className={`flex justify-between pt-2 text-sm font-bold text-slate-900 ${
                isTally ? "border-t-2 border-double border-slate-900" : "border-t-2"
              }`}
              style={!isTally ? { borderColor: template.primaryColor } : {}}
            >
              <span>Total Amount:</span>
              <span style={{ color: template.primaryColor }}>₹13,566.46</span>
            </div>
          </div>
        </div>

        {/* Footer & Signature */}
        <div className="border-t pt-4 flex justify-between items-end z-10 relative">
          <div>
            {template.footerText && (
              <p className="text-[10px] font-semibold text-slate-700 mb-1">{template.footerText}</p>
            )}
            {template.termsText && (
              <p className="text-[9px] text-slate-400 max-w-[280px] whitespace-pre-line leading-snug">
                {template.termsText}
              </p>
            )}
          </div>

          {f.showSignature && (
            <div className="text-center">
              <div className="h-10 w-28 border-b border-slate-300 mb-1 flex items-center justify-center text-[10px] italic text-slate-400">
                [ Authorized Signatory ]
              </div>
              <span className="text-[9px] font-bold text-slate-600">For {template.storeName}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. THERMAL RECEIPT RENDER
  if (template.category === "thermal") {
    let widthClass = "w-[320px]"; // Default 3 Inch / 80mm
    if (template.paperSize === "58mm") widthClass = "w-[240px]"; // 2 Inch
    if (template.paperSize === "127mm") widthClass = "w-[480px]"; // 5 Inch

    const isCompact = theme === "compact";
    const isSimple = theme === "simple";
    const isClassic = theme === "classic";
    const isAdvanced = theme === "advanced";

    // Typography & padding styles based on theme
    const thermalPadding = isCompact ? "p-2.5 space-y-1.5" : "p-4 space-y-3";
    const thermalFont = isClassic ? "font-mono text-[10px]" : "font-mono text-[11px]";
    const borderClass = isClassic ? "border-t border-dashed border-black pt-1" : "border-t border-black pt-1";

    return (
      <div
        className={`${widthClass} bg-[#fffffb] text-black ${thermalPadding} ${thermalFont} rounded shadow-2xl border border-slate-300 relative`}
      >
        {/* Header */}
        <div className="text-center border-b border-dashed border-black pb-2">
          {f.showLogo && !isCompact && !isSimple && (
            <div className="mx-auto h-7 w-7 bg-black text-white font-bold flex items-center justify-center text-xs rounded mb-1">
              IS
            </div>
          )}
          <h2 className="font-bold text-sm tracking-widest uppercase">{template.storeName}</h2>
          {!isCompact && !isSimple && (
            <>
              <p className="text-[10px] mt-0.5">{template.storeAddress}</p>
              <p className="text-[10px]">{template.storePhone}</p>
            </>
          )}
          {template.gstin && !isSimple && (
            <p className="text-[10px] font-bold mt-0.5">GSTIN: {template.gstin}</p>
          )}
          <h3 className="font-bold border border-black inline-block px-2 py-0.5 mt-2 text-[10px]">
            {template.headerTitle || "RECEIPT"}
          </h3>
        </div>

        {/* Transaction Meta */}
        <div className="text-[10px] border-b border-dashed border-black pb-2 space-y-0.5">
          <div className="flex justify-between">
            <span>Bill No: #90412</span>
            <span>Date: 01/08/2026</span>
          </div>
          {f.showTime && (
            <div className="flex justify-between">
              <span>Time: 12:14:35 PM</span>
              <span>Cashier: POS-01</span>
            </div>
          )}
          {f.showCustomerDetails && (
            <div className="text-[9px] text-slate-800 mt-1 border-t border-dashed border-black/20 pt-1">
              <span>Customer: ACME Enterprises</span>
              {f.showPartyBalance && (
                <span className="block text-red-700 font-bold">O/S Balance: ₹14,200.00</span>
              )}
            </div>
          )}
        </div>

        {/* Item Table */}
        <table className="w-full text-left text-[10px]">
          <thead>
            <tr className="border-b border-black">
              <th className="pb-1">ITEM</th>
              <th className="pb-1 text-center">QTY</th>
              <th className="pb-1 text-right">PRICE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dashed divide-black/40">
            <tr>
              <td className="py-1">
                Organic Green Tea 250g
                {f.showItemDescription && (
                  <span className="block text-[8px] text-slate-600 leading-tight">
                    Premium handpicked green tea leaves, organic certified.
                  </span>
                )}
                {f.showSKU && <span className="block text-[8px] text-slate-600">SKU: TEA-GRN-250</span>}
              </td>
              <td className="py-1 text-center font-bold">2</td>
              <td className="py-1 text-right font-bold">380.00</td>
            </tr>
            <tr>
              <td className="py-1">
                Almond Milk 1L
                {f.showItemDescription && (
                  <span className="block text-[8px] text-slate-600 leading-tight">
                    Unsweetened almond milk, calcium enriched.
                  </span>
                )}
                {f.showSKU && <span className="block text-[8px] text-slate-600">SKU: ALM-MLK-1L</span>}
              </td>
              <td className="py-1 text-center font-bold">1</td>
              <td className="py-1 text-right font-bold">240.00</td>
            </tr>
          </tbody>
        </table>

        {/* Totals */}
        <div className="border-t border-dashed border-black pt-2 space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>620.00</span>
          </div>
          {f.showTaxSplit && (
            <div className="flex justify-between text-[9px] text-slate-700">
              <span>CGST 2.5% + SGST 2.5%:</span>
              <span>31.00</span>
            </div>
          )}
          <div className={`flex justify-between font-bold text-sm ${borderClass}`}>
            <span>TOTAL AMOUNT:</span>
            <span>₹651.00</span>
          </div>
        </div>

        {/* Payment QR */}
        {f.showPaymentQR && !isSimple && (
          <div className="flex flex-col items-center justify-center pt-2 border-t border-dashed border-black text-center">
            <div className="h-16 w-16 bg-black p-1 rounded flex items-center justify-center text-white text-[8px]">
              [ UPI QR ]
            </div>
            <span className="text-[8px] mt-1">Scan to pay via UPI</span>
          </div>
        )}

        {template.footerText && (
          <div className="text-center text-[9px] pt-1 whitespace-pre-line leading-tight border-t border-dashed border-black">
            {template.footerText}
          </div>
        )}
      </div>
    );
  }

  // 3. BARCODE TAG LABEL RENDER
  if (template.category === "barcodes") {
    let dimClass = "w-[280px] h-[140px]"; // default 2 Inch / 50x25mm
    if (template.paperSize === "75x50mm") dimClass = "w-[340px] h-[190px]"; // 3 Inch
    if (template.paperSize === "127x75mm") dimClass = "w-[480px] h-[260px]"; // 5 Inch
    if (template.paperSize === "38x25mm") dimClass = "w-[220px] h-[110px]"; // 1.5 Inch
    if (template.paperSize === "100x50mm") dimClass = "w-[400px] h-[220px]"; // 4 Inch

    return (
      <div
        className={`${dimClass} bg-white text-black p-3 rounded-lg shadow-2xl border-2 border-slate-900 font-sans flex flex-col justify-between overflow-hidden`}
      >
        {/* Company Header */}
        <div className="flex items-center justify-between border-b border-slate-300 pb-1">
          {f.showCompanyName && (
            <span className="font-bold text-[10px] tracking-wider uppercase truncate" style={{ color: template.primaryColor }}>
              {template.storeName}
            </span>
          )}
          {f.showCategoryBrand && (
            <span className="text-[9px] font-semibold text-slate-500">ELECTRONICS / AUDIO</span>
          )}
        </div>

        {/* Product Title & MRP */}
        <div>
          {f.showProductName && (
            <h4 className="font-bold text-xs leading-tight text-slate-900 truncate">
              Wireless Noise-Canceling Headphones
            </h4>
          )}
          {f.showSKU && <p className="text-[9px] font-mono text-slate-600">SKU: HD-WRL-900</p>}

          <div className="flex items-baseline gap-2 mt-1">
            {f.showPrice && (
              <span className="text-sm font-extrabold text-slate-900">₹4,999.00</span>
            )}
            {f.showMRP && (
              <span className="text-[10px] text-slate-500 line-through">MRP: ₹6,999</span>
            )}
          </div>
        </div>

        {/* Barcode SVG Graphic */}
        {f.showBarcodeGraphic && (
          <div className="flex flex-col items-center justify-center my-0.5">
            <svg className="h-8 w-full max-w-[200px]" viewBox="0 0 100 30">
              <rect x="0" y="0" width="3" height="30" fill="black" />
              <rect x="5" y="0" width="1" height="30" fill="black" />
              <rect x="8" y="0" width="4" height="30" fill="black" />
              <rect x="15" y="0" width="2" height="30" fill="black" />
              <rect x="19" y="0" width="1" height="30" fill="black" />
              <rect x="23" y="0" width="3" height="30" fill="black" />
              <rect x="28" y="0" width="2" height="30" fill="black" />
              <rect x="33" y="0" width="4" height="30" fill="black" />
              <rect x="40" y="0" width="1" height="30" fill="black" />
              <rect x="44" y="0" width="3" height="30" fill="black" />
              <rect x="49" y="0" width="2" height="30" fill="black" />
              <rect x="54" y="0" width="4" height="30" fill="black" />
              <rect x="60" y="0" width="1" height="30" fill="black" />
              <rect x="64" y="0" width="3" height="30" fill="black" />
              <rect x="70" y="0" width="2" height="30" fill="black" />
              <rect x="75" y="0" width="4" height="30" fill="black" />
              <rect x="82" y="0" width="1" height="30" fill="black" />
              <rect x="86" y="0" width="3" height="30" fill="black" />
              <rect x="92" y="0" width="2" height="30" fill="black" />
              <rect x="96" y="0" width="4" height="30" fill="black" />
            </svg>
            <span className="text-[9px] font-mono tracking-widest text-slate-800">8901234567890</span>
          </div>
        )}

        {/* Footer info */}
        <div className="flex items-center justify-between text-[8px] border-t border-slate-200 pt-1 text-slate-500">
          {f.showMfgExpDate && <span>Mfg: 07/2026 | Exp: 07/2029</span>}
          {f.showCustomTagline && (
            <span className="font-semibold text-slate-700">{f.customTaglineText}</span>
          )}
        </div>
      </div>
    );
  }

  // 4. QR CODE TAG LABEL RENDER
  if (template.category === "qrcodes") {
    let dimClass = "w-[280px] h-[140px]"; // default 2 Inch / 50x25mm
    if (template.paperSize === "75x50mm") dimClass = "w-[340px] h-[190px]"; // 3 Inch
    if (template.paperSize === "127x75mm") dimClass = "w-[480px] h-[260px]"; // 5 Inch
    if (template.paperSize === "38x25mm") dimClass = "w-[220px] h-[110px]"; // 1.5 Inch
    if (template.paperSize === "100x50mm") dimClass = "w-[400px] h-[220px]"; // 4 Inch

    return (
      <div className={`${dimClass} bg-white text-black p-3 rounded-lg shadow-2xl border-2 border-teal-800 font-sans flex items-center justify-between gap-3 overflow-hidden`}>
        {/* Left Info */}
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
              <span className="text-sm font-extrabold text-slate-900 block">₹8,999.00</span>
            )}
            {f.showCustomTagline && (
              <span className="text-[8px] font-medium text-slate-500">{f.customTaglineText}</span>
            )}
          </div>
        </div>

        {/* Right QR Graphic */}
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

              <rect x="42" y="10" width="8" height="8" fill="black" />
              <rect x="50" y="20" width="8" height="8" fill="black" />
              <rect x="10" y="42" width="8" height="8" fill="black" />
              <rect x="25" y="48" width="8" height="8" fill="black" />
              <rect x="45" y="45" width="12" height="12" fill="black" />
              <rect x="62" y="42" width="8" height="8" fill="black" />
              <rect x="75" y="50" width="10" height="10" fill="black" />
              <rect x="42" y="68" width="8" height="8" fill="black" />
              <rect x="55" y="78" width="10" height="10" fill="black" />
              <rect x="72" y="72" width="12" height="12" fill="black" />
            </svg>
            <span className="text-[7px] font-mono text-slate-500 mt-1">SCAN QR CODE</span>
          </div>
        )}
      </div>
    );
  }

  return null;
}
