import React, { useState, useEffect, useRef } from "react";
import { useI18n } from "@/contexts/i18n-context";
import { createPortal } from "react-dom";
import {
  X,
  Printer,
  Sparkles,
  RotateCcw,
  Save,
  Check,
  CheckCircle2,
  Sliders,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Palette,
  Layout,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Layers,
  FileText,
  Tag,
  ScanBarcode,
  Eye,
  EyeOff,
  Info,
  ChevronDown,
  Plus,
  Trash2,
  Copy,
  Zap,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Calendar,
  Minus,
  Percent,
  QrCode,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import {
  RealBarcodeSvg,
  SingleBarcodeLabelCard,
  printBarcodePopup,
  resolveOrgName,
  getDefaultBarcodeElements,
  type ProductBarcodeLike,
  type BarcodeElementBlock,
} from "@/lib/barcode-svg";
import {
  getAllBarcodeTemplates,
  getActiveBarcodeTemplate,
  saveBarcodeTemplate,
  setActiveBarcodeTemplate,
  DEFAULT_BARCODE_TEMPLATES,
  getActiveBillingGst,
} from "@/lib/receipt-template-store";
import { inventoryApi } from "@/lib/api-client";

export interface BarcodeTemplateCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTemplateId?: string;
  onSaved?: (templateId: string) => void;
}

const SAMPLE_TEST_PRODUCTS: ProductBarcodeLike[] = [
  {
    product_name: "Designer Silk Banarasi Saree",
    barcode: "8904358601259",
    sku: "SAR-SILK-902",
    selling_price: 3499.0,
    mrp: 6999.0,
    category_name: "Ethnic Apparel",
    format: "EAN-13",
    batch_no: "B-8802",
    mfg_lic_no: "MH/104643",
    pkd_date: "11/2025",
    exp_date: "10/2028",
    net_qty: "1 Pc",
  },
  {
    product_name: "Premium Wireless Active Noise Canceling Earbuds Pro",
    barcode: "8901234567890",
    sku: "AUD-EAR-PRO",
    selling_price: 2199.0,
    mrp: 4999.0,
    category_name: "Consumer Electronics",
    format: "Code-128",
    batch_no: "LOT-991",
    pkd_date: "01/2026",
    exp_date: "01/2029",
    net_qty: "1 Unit",
  },
  {
    product_name: "Organic Cold Pressed Mustard Oil (1L Bottle)",
    barcode: "8906001234567",
    sku: "GRO-OIL-1L",
    selling_price: 185.0,
    mrp: 220.0,
    category_name: "Grocery & FMCG",
    format: "EAN-13",
    batch_no: "BATCH-104",
    pkd_date: "06/2026",
    exp_date: "06/2027",
    net_qty: "1000 ml",
  },
  {
    product_name: "Gold Plated Temple Jewellery Choker Set",
    barcode: "2064965391328",
    sku: "JWL-GLD-441",
    selling_price: 5400.0,
    mrp: 9900.0,
    category_name: "Fine Jewellery",
    format: "Code-128",
    batch_no: "J-092",
    net_qty: "1 Set",
  },
  {
    product_name: "Paracetamol 650mg Fast Action (Strip of 15 Tablets)",
    barcode: "8907890123456",
    sku: "MED-PCM-650",
    selling_price: 42.5,
    mrp: 55.0,
    category_name: "Pharmaceuticals",
    format: "Code-128",
    batch_no: "PCM-26A",
    pkd_date: "02/2026",
    exp_date: "01/2029",
    net_qty: "15 Tabs",
  },
];

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

const COLOR_SWATCHES = [
  { label: "Word Blue", value: "#185abd" },
  { label: "Executive Navy", value: "#0f172a" },
  { label: "Charcoal Black", value: "#1e293b" },
  { label: "True Black", value: "#000000" },
  { label: "Emerald Green", value: "#059669" },
  { label: "Crimson Red", value: "#dc2626" },
  { label: "Deep Indigo", value: "#4f46e5" },
  { label: "Amber Gold", value: "#d97706" },
  { label: "Slate Gray", value: "#475569" },
];

const PAPER_BG_SWATCHES = [
  { label: "Clean White", value: "#ffffff" },
  { label: "Ivory White", value: "#fafaf9" },
  { label: "Soft Cream", value: "#fefce8" },
  { label: "Warm Linen", value: "#fffbeb" },
  { label: "Light Slate", value: "#f8fafc" },
  { label: "Dark Noir", value: "#09090b" },
];

const ELEMENT_TYPE_OPTIONS = [
  { type: "companyName", label: "Company / Store Header", icon: "🏢", desc: "Top branding line with company name" },
  { type: "productName", label: "Product Title", icon: "📦", desc: "Item name with bold/normal styling" },
  { type: "sellingPrice", label: "Selling Price (SP)", icon: "💰", desc: "Highlighted offer price with badge options" },
  { type: "mrp", label: "MRP (Strike Price)", icon: "🏷️", desc: "Retail price with red/black strikethrough" },
  { type: "priceGroup", label: "Price Block (SP + MRP + Discount)", icon: "💵", desc: "Combined side-by-side or stacked price row" },
  { type: "sku", label: "SKU / Item Code", icon: "🔖", desc: "Monospace SKU identifier" },
  { type: "hsn", label: "HSN / Tax Code", icon: "🔢", desc: "HSN or tariff code" },
  { type: "barcodeGraphic", label: "Barcode Graphic", icon: "📊", desc: "Hardware-scannable optical barcode" },
  { type: "customText", label: "Custom Text / Tagline", icon: "✍️", desc: "Freeform custom text, note or slogan" },
  { type: "category", label: "Category / Brand", icon: "🏷️", desc: "Uppercase category or brand badge" },
  { type: "batchMfgExp", label: "Mfg & Expiry Dates", icon: "📅", desc: "Manufacturing date, Expiry, and Batch" },
  { type: "divider", label: "Divider Line", icon: "➖", desc: "Horizontal separation line" },
  { type: "discountBadge", label: "Discount Badge (% OFF)", icon: "🏷️", desc: "Pill badge displaying discount percentage" },
];

export function BarcodeTemplateCustomizerModal({
  isOpen,
  onClose,
  initialTemplateId,
  onSaved,
}: BarcodeTemplateCustomizerModalProps) {
  const { t } = useI18n();
  const { currency } = useCurrency();
  const { tenant } = useTenant();

  const [availableTemplates, setAvailableTemplates] = useState<any[]>(() => getAllBarcodeTemplates());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    initialTemplateId || getActiveBarcodeTemplate()?.id || DEFAULT_BARCODE_TEMPLATES[0].id
  );

  const [currentTemplate, setCurrentTemplate] = useState<any>(() => {
    const all = getAllBarcodeTemplates();
    const found = all.find((t) => t.id === (initialTemplateId || selectedTemplateId)) || all[0] || DEFAULT_BARCODE_TEMPLATES[0];
    const cloned = JSON.parse(JSON.stringify(found));
    if (!cloned.elements || !Array.isArray(cloned.elements) || cloned.elements.length === 0) {
      cloned.elements = getDefaultBarcodeElements(cloned);
    }
    return cloned;
  });

  const [activeRibbonTab, setActiveRibbonTab] = useState<"layers" | "typography" | "barcode" | "pricing" | "paper">("layers");
  const [selectedElementKey, setSelectedElementKey] = useState<string>("el_product_name");
  const [sampleProductIndex, setSampleProductIndex] = useState<number>(0);
  const [realProducts, setRealProducts] = useState<ProductBarcodeLike[]>([]);
  const [zoomLevel, setZoomLevel] = useState<number>(125);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState<boolean>(false);

  // Sync when modal opens or initialTemplateId changes & fetch real catalog products with existing barcodes
  useEffect(() => {
    if (isOpen) {
      const all = getAllBarcodeTemplates();
      setAvailableTemplates(all);
      const targetId = initialTemplateId || selectedTemplateId || getActiveBarcodeTemplate()?.id;
      setSelectedTemplateId(targetId);
      const found = all.find((t) => t.id === targetId) || all[0] || DEFAULT_BARCODE_TEMPLATES[0];
      const cloned = JSON.parse(JSON.stringify(found));
      if (!cloned.elements || !Array.isArray(cloned.elements) || cloned.elements.length === 0) {
        cloned.elements = getDefaultBarcodeElements(cloned);
      }
      setCurrentTemplate(cloned);
      if (cloned.elements && cloned.elements.length > 0) {
        setSelectedElementKey(cloned.elements[0].id);
      }

      // Fetch existing barcodes from database (do not generate new barcodes)
      inventoryApi.getBarcodes().then((items) => {
        if (items && items.length > 0) {
          const mapped: ProductBarcodeLike[] = items
            .filter((p) => Boolean(p.barcode))
            .map((p) => ({
              product_name: p.product_name,
              barcode: p.barcode, // Exact existing barcode from DB
              sku: p.sku || "",
              selling_price: p.selling_price != null ? Number(p.selling_price) : null,
              mrp: (p as any).mrp != null ? Number((p as any).mrp) : (p.selling_price ? Math.round(Number(p.selling_price) * 1.25) : 399),
              category_name: p.category_name || "Catalog",
              format: p.format || "EAN-13",
            }));
          if (mapped.length > 0) {
            setRealProducts(mapped);
          }
        }
      }).catch(() => {
        // Fallback gracefully to standard sample products
      });
    }
  }, [isOpen, initialTemplateId]);

  if (!isOpen) return null;

  const allAvailableProducts: ProductBarcodeLike[] = realProducts.length > 0
    ? [...realProducts, ...SAMPLE_TEST_PRODUCTS]
    : SAMPLE_TEST_PRODUCTS;

  const currentSampleProduct = allAvailableProducts[sampleProductIndex] || allAvailableProducts[0] || SAMPLE_TEST_PRODUCTS[0];

  const currentElements: BarcodeElementBlock[] = Array.isArray(currentTemplate.elements) && currentTemplate.elements.length > 0
    ? currentTemplate.elements
    : getDefaultBarcodeElements(currentTemplate);

  const selectedElement = currentElements.find((el) => el.id === selectedElementKey) || currentElements[0];

  // Helper to update top-level template properties
  const updateTemplate = (updates: Partial<any>) => {
    setCurrentTemplate((prev: any) => ({
      ...prev,
      ...updates,
    }));
  };

  // Helper to update elements list
  const setElements = (newElements: BarcodeElementBlock[]) => {
    setCurrentTemplate((prev: any) => ({
      ...prev,
      elements: newElements,
    }));
  };

  // Move Element Up
  const moveElementUp = (id: string) => {
    const idx = currentElements.findIndex((el) => el.id === id);
    if (idx <= 0) return;
    const updated = [...currentElements];
    const temp = updated[idx - 1];
    updated[idx - 1] = updated[idx];
    updated[idx] = temp;
    setElements(updated);
    toast.success(`Moved "${updated[idx - 1].label}" up`);
  };

  // Move Element Down
  const moveElementDown = (id: string) => {
    const idx = currentElements.findIndex((el) => el.id === id);
    if (idx < 0 || idx >= currentElements.length - 1) return;
    const updated = [...currentElements];
    const temp = updated[idx + 1];
    updated[idx + 1] = updated[idx];
    updated[idx] = temp;
    setElements(updated);
    toast.success(`Moved "${updated[idx + 1].label}" down`);
  };

  // Move to Top
  const moveElementToTop = (id: string) => {
    const idx = currentElements.findIndex((el) => el.id === id);
    if (idx <= 0) return;
    const target = currentElements[idx];
    const updated = [target, ...currentElements.filter((el) => el.id !== id)];
    setElements(updated);
  };

  // Move to Bottom
  const moveElementToBottom = (id: string) => {
    const idx = currentElements.findIndex((el) => el.id === id);
    if (idx < 0 || idx === currentElements.length - 1) return;
    const target = currentElements[idx];
    const updated = [...currentElements.filter((el) => el.id !== id), target];
    setElements(updated);
  };

  // Add Element
  const handleAddElement = (type: string) => {
    const opt = ELEMENT_TYPE_OPTIONS.find((o) => o.type === type) || { label: type, type };
    const newId = `el_${type}_${Date.now()}`;
    const newBlock: BarcodeElementBlock = {
      id: newId,
      type: type as any,
      label: opt.label,
      visible: true,
      textAlign: currentTemplate.textAlign || "left",
      fontFamily: currentTemplate.fontFamily || "Calibri, Inter, sans-serif",
      fontSize: type === "companyName" ? 10 : type === "productName" ? 11 : type === "barcodeGraphic" ? 40 : 9,
      fontWeight: type === "companyName" || type === "productName" ? "bold" : "normal",
      color: type === "companyName" ? currentTemplate.primaryColor || "#0f172a" : "#020617",
      prefix: type === "sku" ? "SKU: " : type === "sellingPrice" ? "SP: " : type === "mrp" ? "MRP: " : type === "hsn" ? "HSN: " : "",
      customText: type === "customText" ? "Custom Label Text" : undefined,
      height: type === "barcodeGraphic" ? 40 : type === "divider" ? 1 : undefined,
      marginBottom: 2,
    };

    // Insert right after current selected element, or at end
    const selIdx = currentElements.findIndex((el) => el.id === selectedElementKey);
    let updated: BarcodeElementBlock[] = [];
    if (selIdx >= 0) {
      updated = [...currentElements.slice(0, selIdx + 1), newBlock, ...currentElements.slice(selIdx + 1)];
    } else {
      updated = [...currentElements, newBlock];
    }
    setElements(updated);
    setSelectedElementKey(newId);
    setIsAddMenuOpen(false);
    toast.success(`Added new "${opt.label}" element`);
  };

  // Remove Element
  const handleRemoveElement = (id: string) => {
    if (currentElements.length <= 1) {
      toast.error("Template must have at least one element.");
      return;
    }
    const updated = currentElements.filter((el) => el.id !== id);
    setElements(updated);
    if (selectedElementKey === id && updated.length > 0) {
      setSelectedElementKey(updated[0].id);
    }
    toast.info("Element removed from label");
  };

  // Duplicate Element
  const handleDuplicateElement = (id: string) => {
    const idx = currentElements.findIndex((el) => el.id === id);
    if (idx < 0) return;
    const orig = currentElements[idx];
    const newBlock: BarcodeElementBlock = {
      ...JSON.parse(JSON.stringify(orig)),
      id: `el_${orig.type}_${Date.now()}`,
      label: `${orig.label} (Copy)`,
    };
    const updated = [...currentElements.slice(0, idx + 1), newBlock, ...currentElements.slice(idx + 1)];
    setElements(updated);
    setSelectedElementKey(newBlock.id);
    toast.success(`Duplicated "${orig.label}"`);
  };

  // Toggle Element Visibility
  const handleToggleVisibility = (id: string) => {
    const updated = currentElements.map((el) => {
      if (el.id === id) {
        return { ...el, visible: el.visible === false ? true : false };
      }
      return el;
    });
    setElements(updated);
  };

  // Update a property on the currently selected element
  const updateSelectedElement = (updates: Partial<BarcodeElementBlock>) => {
    if (!selectedElementKey) return;
    const updated = currentElements.map((el) => {
      if (el.id === selectedElementKey) {
        return { ...el, ...updates };
      }
      return el;
    });
    setElements(updated);
  };

  // Helper to update custom text override from inline contentEditable
  const updateCustomText = (textKey: string, value: string) => {
    // Also update block customText if key is block ID
    const updated = currentElements.map((el) => {
      if (el.id === textKey) {
        return { ...el, customText: value };
      }
      return el;
    });
    setElements(updated);

    setCurrentTemplate((prev: any) => ({
      ...prev,
      customTexts: {
        ...(prev.customTexts || {}),
        [textKey]: value,
      },
    }));
  };

  // Switch Active Template
  const handleSelectTemplate = (tplId: string) => {
    const found = availableTemplates.find((t) => t.id === tplId);
    if (found) {
      setSelectedTemplateId(tplId);
      const cloned = JSON.parse(JSON.stringify(found));
      if (!cloned.elements || !Array.isArray(cloned.elements) || cloned.elements.length === 0) {
        cloned.elements = getDefaultBarcodeElements(cloned);
      }
      setCurrentTemplate(cloned);
      if (cloned.elements && cloned.elements.length > 0) {
        setSelectedElementKey(cloned.elements[0].id);
      }
      toast.info(`Loaded template: ${found.name}`);
    }
  };

  // Save changes to template (persists elements + all settings to localStorage)
  const handleSave = (setAsDefault: boolean = false) => {
    try {
      setIsSaving(true);
      const toSave = {
        ...currentTemplate,
        elements: currentElements,
        isDefault: setAsDefault ? true : Boolean(currentTemplate.isDefault),
      };
      saveBarcodeTemplate(toSave, setAsDefault);
      if (setAsDefault) {
        setActiveBarcodeTemplate(currentTemplate.id);
      }
      toast.success(setAsDefault ? "Saved and applied as default barcode template!" : "Barcode template saved successfully!");
      if (onSaved) onSaved(currentTemplate.id);
      const updatedList = getAllBarcodeTemplates();
      setAvailableTemplates(updatedList);
    } catch (e: any) {
      toast.error(`Save failed: ${e?.message || e}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Save as New Duplicate Template
  const handleSaveAsNew = () => {
    const newName = prompt("Enter a name for the new barcode template:", `${currentTemplate.name} (Custom)`);
    if (!newName) return;
    const newId = `tpl-bar-custom-${Date.now()}`;
    const newTemplate = {
      ...currentTemplate,
      id: newId,
      name: newName,
      elements: currentElements,
      isDefault: false,
    };
    saveBarcodeTemplate(newTemplate, false);
    setAvailableTemplates(getAllBarcodeTemplates());
    setSelectedTemplateId(newId);
    setCurrentTemplate(newTemplate);
    toast.success(`Created custom barcode template "${newName}"`);
    if (onSaved) onSaved(newId);
  };

  // Reset to Factory Preset
  const handleResetToPreset = () => {
    const defaultMatch = DEFAULT_BARCODE_TEMPLATES.find((t) => t.id === currentTemplate.id) || DEFAULT_BARCODE_TEMPLATES[0];
    const cloned = JSON.parse(JSON.stringify(defaultMatch));
    cloned.elements = getDefaultBarcodeElements(cloned);
    setCurrentTemplate(cloned);
    if (cloned.elements && cloned.elements.length > 0) {
      setSelectedElementKey(cloned.elements[0].id);
    }
    toast.info("Reset to standard factory preset.");
  };

  // Instant Test Print
  const handleTestPrint = () => {
    const orgName = resolveOrgName(tenant?.name, currentTemplate.storeName);
    const toPrint = {
      ...currentTemplate,
      elements: currentElements,
    };
    printBarcodePopup(
      [currentSampleProduct, currentSampleProduct],
      toPrint,
      currentTemplate.layout || "2up",
      currency.symbol,
      orgName,
      currentTemplate.barcodeSymbology || currentTemplate.barcodeFormat || "Auto"
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 text-slate-100 rounded-3xl w-full max-w-7xl h-[94vh] max-h-[960px] shadow-2xl border border-slate-800 flex flex-col overflow-hidden select-none">
        {/* ── 1. Top Microsoft Word Title Bar ── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950/90">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
              <ScanBarcode className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white tracking-tight">
                  {t("Barcode Studio — Word Layout Customizer", "Barcode Studio — Word Layout Customizer")}
                </h2>
                <span className="text-[10px] font-extrabold uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
                  Free Layout & Blocks
                </span>
                {currentTemplate.isDefault && (
                  <span className="text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="size-3" /> Active Default
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Move, add, delete, or reorder any element anywhere on the label with full typography and inline styling.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Template Selector dropdown */}
            <div className="relative">
              <select
                value={selectedTemplateId}
                onChange={(e) => handleSelectTemplate(e.target.value)}
                className="h-8 pl-3 pr-8 bg-slate-800 hover:bg-slate-750 text-xs font-bold text-white rounded-xl border border-slate-700 outline-none cursor-pointer appearance-none transition"
              >
                {availableTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.isDefault ? "★ (Active)" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
            </div>

            <button
              onClick={handleResetToPreset}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-1.5 transition"
              title="Reset template to factory defaults"
            >
              <RotateCcw className="size-3.5 text-slate-400" /> Reset
            </button>

            <button
              onClick={handleSaveAsNew}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-1.5 transition"
              title="Save as a new custom template"
            >
              <Copy className="size-3.5 text-slate-400" /> Save as New
            </button>

            <button
              onClick={handleTestPrint}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-300 hover:text-emerald-200 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-700/60 flex items-center gap-1.5 transition shadow-sm"
              title="Print real sample to physical thermal printer"
            >
              <Printer className="size-3.5 text-emerald-400" /> Test Print
            </button>

            <button
              onClick={() => handleSave(true)}
              disabled={isSaving}
              className="px-4 py-1.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition"
            >
              <Save className="size-3.5" /> Save & Set Default
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition ml-2"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* ── 2. Microsoft Word Ribbon Toolbar Navigation ── */}
        <div className="border-b border-slate-800 bg-slate-950/50 px-4 pt-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {[
              { id: "layers", label: "🗂️ Move & Elements", icon: Layers },
              { id: "typography", label: "✍️ Home & Typography", icon: Type },
              { id: "barcode", label: "📊 Barcode & Symbology", icon: ScanBarcode },
              { id: "pricing", label: "💰 Pricing & Badges", icon: Tag },
              { id: "paper", label: "📏 Paper & Borders", icon: Layout },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeRibbonTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveRibbonTab(tab.id as any)}
                  className={`px-3.5 py-2 rounded-t-xl text-xs font-black flex items-center gap-2 transition ${
                    isActive
                      ? "bg-slate-900 text-blue-400 border-t-2 border-t-blue-500 border-x border-slate-800 shadow-xs"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
                  }`}
                >
                  <Icon className="size-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Quick Add Element Dropdown */}
          <div className="relative pb-1">
            <button
              onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus className="size-3.5" /> + Add Element Anywhere
            </button>

            {isAddMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 max-h-96 overflow-y-auto space-y-1">
                <div className="text-[10px] font-black uppercase text-slate-400 px-2 py-1 border-b border-slate-800">
                  Insert Element into Label
                </div>
                {ELEMENT_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.type}
                    onClick={() => handleAddElement(opt.type)}
                    className="w-full text-left p-2 rounded-xl hover:bg-slate-800 flex items-start gap-2.5 transition text-xs group"
                  >
                    <span className="text-base shrink-0">{opt.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white group-hover:text-blue-400 transition truncate">
                        {opt.label}
                      </div>
                      <div className="text-[10px] text-slate-400 leading-tight truncate">
                        {opt.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 3. Ribbon Controls Strip ── */}
        <div className="border-b border-slate-800 bg-slate-900/90 px-5 py-2 min-h-[56px] flex items-center gap-4 flex-wrap overflow-x-auto">
          {/* TAB 1: Move & Elements */}
          {activeRibbonTab === "layers" && (
            <div className="flex items-center gap-3 flex-wrap w-full">
              <span className="text-xs font-black text-white flex items-center gap-1.5">
                <Layers className="size-4 text-blue-400" />
                Active Element: <strong className="text-blue-400">{selectedElement?.label || "None"}</strong>
              </span>

              <div className="h-6 w-px bg-slate-800" />

              <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
                <button
                  onClick={() => selectedElementKey && moveElementUp(selectedElementKey)}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-200 hover:text-white hover:bg-slate-700 flex items-center gap-1 transition"
                  title="Move selected element up"
                >
                  <ArrowUp className="size-3.5 text-blue-400" /> Move Up
                </button>
                <button
                  onClick={() => selectedElementKey && moveElementDown(selectedElementKey)}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-200 hover:text-white hover:bg-slate-700 flex items-center gap-1 transition"
                  title="Move selected element down"
                >
                  <ArrowDown className="size-3.5 text-blue-400" /> Move Down
                </button>
                <button
                  onClick={() => selectedElementKey && moveElementToTop(selectedElementKey)}
                  className="px-2 py-1 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-700 transition"
                  title="Send to Top of Label"
                >
                  To Top
                </button>
                <button
                  onClick={() => selectedElementKey && moveElementToBottom(selectedElementKey)}
                  className="px-2 py-1 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-700 transition"
                  title="Send to Bottom of Label"
                >
                  To Bottom
                </button>
              </div>

              <div className="h-6 w-px bg-slate-800" />

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => selectedElementKey && handleDuplicateElement(selectedElementKey)}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-1 transition"
                >
                  <Copy className="size-3.5 text-amber-400" /> Duplicate Block
                </button>
                <button
                  onClick={() => selectedElementKey && handleToggleVisibility(selectedElementKey)}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-1 transition"
                >
                  {selectedElement?.visible === false ? (
                    <>
                      <Eye className="size-3.5 text-emerald-400" /> Show Block
                    </>
                  ) : (
                    <>
                      <EyeOff className="size-3.5 text-slate-400" /> Hide Block
                    </>
                  )}
                </button>
                <button
                  onClick={() => selectedElementKey && handleRemoveElement(selectedElementKey)}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 flex items-center gap-1 transition"
                >
                  <Trash2 className="size-3.5" /> Remove Block
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Typography */}
          {activeRibbonTab === "typography" && (
            <div className="flex items-center gap-4 flex-wrap">
              {/* Font Family */}
              <div className="flex flex-col">
                <span className="text-[9.5px] font-extrabold uppercase text-slate-500 mb-0.5">Font Family</span>
                <select
                  value={selectedElement?.fontFamily || currentTemplate.fontFamily || "Calibri, 'Segoe UI', sans-serif"}
                  onChange={(e) => updateSelectedElement({ fontFamily: e.target.value })}
                  className="h-8 bg-slate-800 border border-slate-700 rounded-lg px-2 text-xs font-semibold text-white outline-none"
                >
                  {FONT_FAMILIES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="h-7 w-px bg-slate-800" />

              {/* Font Size */}
              <div className="flex flex-col">
                <span className="text-[9.5px] font-extrabold uppercase text-slate-500 mb-0.5">Font Size</span>
                <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                  <button
                    onClick={() => {
                      const cur = Number(selectedElement?.fontSize) || 10;
                      updateSelectedElement({ fontSize: Math.max(6, cur - 1) });
                    }}
                    className="px-2 py-1 text-xs font-bold text-slate-400 hover:text-white"
                  >
                    -
                  </button>
                  <span className="w-8 text-center font-mono font-bold text-xs text-white">
                    {selectedElement?.fontSize || 10}px
                  </span>
                  <button
                    onClick={() => {
                      const cur = Number(selectedElement?.fontSize) || 10;
                      updateSelectedElement({ fontSize: Math.min(24, cur + 1) });
                    }}
                    className="px-2 py-1 text-xs font-bold text-slate-400 hover:text-white"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="h-7 w-px bg-slate-800" />

              {/* Formatting: Bold, Italic, Underline, Strikethrough, AA */}
              <div className="flex flex-col">
                <span className="text-[9.5px] font-extrabold uppercase text-slate-500 mb-0.5">Styles</span>
                <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                  {/* Bold */}
                  <button
                    onClick={() =>
                      updateSelectedElement({
                        fontWeight: selectedElement?.fontWeight === "bold" || selectedElement?.fontWeight === "900" ? "normal" : "bold",
                      })
                    }
                    className={`p-1.5 rounded text-xs font-black ${
                      selectedElement?.fontWeight === "bold" || selectedElement?.fontWeight === "900"
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="Bold (Ctrl+B)"
                  >
                    <Bold className="size-3.5" />
                  </button>

                  {/* Italic */}
                  <button
                    onClick={() =>
                      updateSelectedElement({
                        fontStyle: selectedElement?.fontStyle === "italic" ? "normal" : "italic",
                      })
                    }
                    className={`p-1.5 rounded text-xs font-black ${
                      selectedElement?.fontStyle === "italic"
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="Italic (Ctrl+I)"
                  >
                    <Italic className="size-3.5" />
                  </button>

                  {/* Underline */}
                  <button
                    onClick={() =>
                      updateSelectedElement({
                        textDecoration: selectedElement?.textDecoration === "underline" ? "none" : "underline",
                      })
                    }
                    className={`p-1.5 rounded text-xs font-black ${
                      selectedElement?.textDecoration === "underline"
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="Underline (Ctrl+U)"
                  >
                    <Underline className="size-3.5" />
                  </button>

                  {/* Strikethrough */}
                  <button
                    onClick={() => {
                      const isStruck =
                        selectedElement?.textDecoration === "line-through" ||
                        selectedElement?.showStrike === true;
                      const nextVal = !isStruck;
                      updateSelectedElement({
                        textDecoration: nextVal ? "line-through" : "none",
                        showStrike: nextVal,
                      });
                      if (selectedElement?.type === "mrp") {
                        updateTemplate({ showMrpStrike: nextVal });
                      }
                    }}
                    className={`p-1.5 rounded text-xs font-black ${
                      selectedElement?.textDecoration === "line-through" ||
                      selectedElement?.showStrike === true
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="Strike-through / Line-Through"
                  >
                    <Strikethrough className="size-3.5" />
                  </button>

                  {/* Uppercase */}
                  <button
                    onClick={() =>
                      updateSelectedElement({
                        textTransform: selectedElement?.textTransform === "uppercase" ? "none" : "uppercase",
                      })
                    }
                    className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                      selectedElement?.textTransform === "uppercase"
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="UPPERCASE"
                  >
                    AA
                  </button>
                </div>
              </div>

              <div className="h-7 w-px bg-slate-800" />

              {/* Alignment */}
              <div className="flex flex-col">
                <span className="text-[9.5px] font-extrabold uppercase text-slate-500 mb-0.5">Alignment</span>
                <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                  {(["left", "center", "right"] as const).map((align) => {
                    const isSelected = (selectedElement?.textAlign || currentTemplate.textAlign || "left") === align;
                    const Icon = align === "left" ? AlignLeft : align === "center" ? AlignCenter : AlignRight;
                    return (
                      <button
                        key={align}
                        onClick={() => updateSelectedElement({ textAlign: align })}
                        className={`p-1.5 rounded ${
                          isSelected ? "bg-blue-600 text-white shadow-2xs" : "text-slate-400 hover:text-white"
                        }`}
                        title={`Align ${align}`}
                      >
                        <Icon className="size-3.5" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="h-7 w-px bg-slate-800" />

              {/* Text Color */}
              <div className="flex flex-col">
                <span className="text-[9.5px] font-extrabold uppercase text-slate-500 mb-0.5">Element Color</span>
                <div className="flex items-center gap-1.5">
                  {COLOR_SWATCHES.slice(0, 6).map((c) => (
                    <button
                      key={c.value}
                      onClick={() => updateSelectedElement({ color: c.value })}
                      className={`size-6 rounded-full border transition ${
                        selectedElement?.color === c.value ? "ring-2 ring-blue-400 scale-110 border-white" : "border-slate-700"
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                  <input
                    type="color"
                    value={selectedElement?.color || "#020617"}
                    onChange={(e) => updateSelectedElement({ color: e.target.value })}
                    className="size-6 rounded cursor-pointer bg-transparent border-0"
                    title="Custom Color"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Barcode & Symbology */}
          {activeRibbonTab === "barcode" && (
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex flex-col">
                <span className="text-[9.5px] font-extrabold uppercase text-slate-500 mb-0.5">Symbology</span>
                <select
                  value={currentTemplate.barcodeSymbology || "Auto"}
                  onChange={(e) => updateTemplate({ barcodeSymbology: e.target.value })}
                  className="h-8 bg-slate-800 border border-slate-700 rounded-lg px-2 text-xs font-semibold text-white outline-none"
                >
                  <option value="Auto">Auto-Detect (Smart)</option>
                  <option value="Code-128">Code-128 (Alphanumeric Standard)</option>
                  <option value="EAN-13">GS1 EAN-13 (Retail Standard)</option>
                  <option value="EAN-8">EAN-8 (Compact)</option>
                </select>
              </div>

              <div className="h-7 w-px bg-slate-800" />

              <div className="flex flex-col">
                <span className="text-[9.5px] font-extrabold uppercase text-slate-500 mb-0.5">
                  Barcode Height: {currentTemplate.barcodeHeight || 40}px
                </span>
                <input
                  type="range"
                  min="20"
                  max="70"
                  step="2"
                  value={currentTemplate.barcodeHeight || 40}
                  onChange={(e) => updateTemplate({ barcodeHeight: Number(e.target.value) })}
                  className="w-32 accent-blue-500"
                />
              </div>

              <div className="h-7 w-px bg-slate-800" />

              <div className="flex items-center gap-2 mt-3">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentTemplate.showBarcodeText !== false}
                    onChange={(e) => updateTemplate({ showBarcodeText: e.target.checked })}
                    className="size-3.5 rounded accent-blue-500"
                  />
                  <span>Show Human Readable Text</span>
                </label>
              </div>
            </div>
          )}

          {/* TAB 4: Pricing & Badges */}
          {activeRibbonTab === "pricing" && (
            <div className="flex items-center gap-4 flex-wrap">
              {/* Strike-through line toggle */}
              <div className="flex flex-col">
                <span className="text-[9.5px] font-extrabold uppercase text-slate-500 mb-0.5">MRP Strike-through</span>
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = currentTemplate.showMrpStrike === false;
                    updateTemplate({ showMrpStrike: nextVal });
                    if (selectedElement?.type === "mrp") {
                      updateSelectedElement({
                        showStrike: nextVal,
                        textDecoration: nextVal ? "line-through" : "none",
                      });
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black border transition ${
                    currentTemplate.showMrpStrike === false
                      ? "bg-slate-800 text-slate-400 border-slate-700"
                      : "bg-red-600 text-white border-red-600 shadow-2xs"
                  }`}
                >
                  {currentTemplate.showMrpStrike === false ? "Strike-through: OFF" : "Strike-through: ON"}
                </button>
              </div>

              <div className="h-7 w-px bg-slate-800" />

              <div className="flex flex-col">
                <span className="text-[9.5px] font-extrabold uppercase text-slate-500 mb-0.5">SP Badge Style</span>
                <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-xs">
                  {[
                    { id: "none", label: "Clean" },
                    { id: "pill", label: "Green Pill" },
                    { id: "dark", label: "Dark Tag" },
                    { id: "gold", label: "Gold" },
                    { id: "outline", label: "Border" },
                  ].map((style) => (
                    <button
                      key={style.id}
                      onClick={() => updateTemplate({ spBadgeStyle: style.id })}
                      className={`px-2 py-1 rounded ${
                        (currentTemplate.spBadgeStyle || "none") === style.id
                          ? "bg-blue-600 text-white font-black shadow-2xs"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-7 w-px bg-slate-800" />

              <div className="flex flex-col">
                <span className="text-[9.5px] font-extrabold uppercase text-slate-500 mb-0.5">MRP Strike Color</span>
                <div className="flex items-center gap-1">
                  {[
                    { id: "gray", label: "Slate", color: "#64748b" },
                    { id: "red", label: "Red", color: "#dc2626" },
                    { id: "black", label: "Black", color: "#020617" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => updateTemplate({ mrpStrikeColor: s.id })}
                      className={`px-2 py-1 rounded text-xs font-bold border transition ${
                        (currentTemplate.mrpStrikeColor || "gray") === s.id
                          ? "border-blue-400 bg-slate-800 text-white"
                          : "border-slate-700 text-slate-400"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-7 w-px bg-slate-800" />

              <div className="flex items-center gap-2 mt-3">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentTemplate.showDiscountBadge ?? false}
                    onChange={(e) => updateTemplate({ showDiscountBadge: e.target.checked })}
                    className="size-3.5 rounded accent-blue-500"
                  />
                  <span>Show Discount % Badge</span>
                </label>
              </div>
            </div>
          )}

          {/* TAB 5: Paper & Borders */}
          {activeRibbonTab === "paper" && (
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex flex-col">
                <span className="text-[9.5px] font-extrabold uppercase text-slate-500 mb-0.5">Physical Label Size</span>
                <select
                  value={currentTemplate.paperSize || "50x25mm"}
                  onChange={(e) => updateTemplate({ paperSize: e.target.value })}
                  className="h-8 bg-slate-800 border border-slate-700 rounded-lg px-2 text-xs font-semibold text-white outline-none"
                >
                  <option value="50x25mm">50x25mm (Standard Retail)</option>
                  <option value="38x25mm">38x25mm (Compact 3-Up)</option>
                  <option value="50x38mm">50x38mm (Apparel Tag)</option>
                  <option value="100x50mm">100x50mm (Shipping Box)</option>
                  <option value="50x50mm">50x50mm (FMCG Square)</option>
                  <option value="A4 Sheet">A4 Sheet (24/40 Up)</option>
                </select>
              </div>

              <div className="h-7 w-px bg-slate-800" />

              <div className="flex flex-col">
                <span className="text-[9.5px] font-extrabold uppercase text-slate-500 mb-0.5">Border Style</span>
                <select
                  value={currentTemplate.borderStyle || "solid"}
                  onChange={(e) => updateTemplate({ borderStyle: e.target.value })}
                  className="h-8 bg-slate-800 border border-slate-700 rounded-lg px-2 text-xs font-semibold text-white outline-none"
                >
                  <option value="solid">Solid Border</option>
                  <option value="dashed">Dashed Border</option>
                  <option value="dotted">Dotted Border</option>
                  <option value="double">Double Line</option>
                  <option value="none">No Border (Borderless)</option>
                </select>
              </div>

              <div className="h-7 w-px bg-slate-800" />

              <div className="flex flex-col">
                <span className="text-[9.5px] font-extrabold uppercase text-slate-500 mb-0.5">Corner Radius</span>
                <select
                  value={currentTemplate.borderRadius || "sm"}
                  onChange={(e) => updateTemplate({ borderRadius: e.target.value })}
                  className="h-8 bg-slate-800 border border-slate-700 rounded-lg px-2 text-xs font-semibold text-white outline-none"
                >
                  <option value="none">Sharp Square (0px)</option>
                  <option value="sm">Slight Round (2px)</option>
                  <option value="md">Rounded (4px)</option>
                  <option value="lg">Soft Pillow (8px)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* ── 4. Main Body: WYSIWYG Canvas (Left) & Layers / Inspector Drawer (Right) ── */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* LEFT: Live Interactive Sticker Canvas */}
          <div className="lg:col-span-8 bg-slate-950/90 p-4 sm:p-8 flex flex-col justify-between overflow-auto relative items-center">
            {/* Canvas Header Toolbar */}
            <div className="w-full flex items-center justify-between pb-3 mb-2 border-b border-slate-800 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-300">Sample Catalog Item:</span>
                <select
                  value={sampleProductIndex}
                  onChange={(e) => setSampleProductIndex(Number(e.target.value))}
                  className="h-7 bg-slate-800 border border-slate-700 rounded-lg px-2 text-xs font-semibold text-white outline-none max-w-[280px]"
                >
                  {allAvailableProducts.map((prod, idx) => (
                    <option key={idx} value={idx}>
                      {idx < realProducts.length ? "📦 [Catalog] " : "✨ [Sample] "}
                      {prod.product_name.slice(0, 24)} ({prod.barcode})
                    </option>
                  ))}
                </select>
              </div>

              {/* Zoom Stepper */}
              <div className="flex items-center gap-1.5 bg-slate-800/80 px-2 py-1 rounded-xl border border-slate-700">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(75, z - 25))}
                  className="p-1 rounded hover:bg-slate-700 text-slate-300"
                  title="Zoom Out"
                >
                  <ZoomOut className="size-3.5" />
                </button>
                <span className="font-mono font-bold text-white text-xs w-10 text-center">{zoomLevel}%</span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(200, z + 25))}
                  className="p-1 rounded hover:bg-slate-700 text-slate-300"
                  title="Zoom In"
                >
                  <ZoomIn className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Sticker Paper Simulation Area */}
            <div className="flex-1 flex items-center justify-center p-6 w-full">
              <div
                style={{
                  transform: `scale(${zoomLevel / 100})`,
                  transformOrigin: "center center",
                  transition: "transform 0.15s ease-out",
                }}
                className="relative p-6 rounded-3xl bg-slate-900 border-2 border-dashed border-slate-700/80 shadow-2xl flex flex-col items-center"
              >
                {/* Physical Millimeter Indicator */}
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-slate-800 text-slate-400 border border-slate-700 text-[9px] font-mono font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                  📏 Physical Label Size: {currentTemplate.paperSize || "50x25mm"}
                </div>

                {/* The Editable Barcode Label Card */}
                <div className="w-[310px] sm:w-[330px] bg-white rounded-xl shadow-2xl overflow-hidden p-1">
                  <SingleBarcodeLabelCard
                    item={currentSampleProduct}
                    template={{
                      ...currentTemplate,
                      elements: currentElements,
                    }}
                    isPrint={false}
                    orgName={tenant?.name}
                    isEditable={true}
                    selectedElementKey={selectedElementKey}
                    onSelectElement={(key) => setSelectedElementKey(key)}
                    onFieldEdit={(key, val) => updateCustomText(key, val)}
                  />
                </div>

                {/* Laser Gun Verification Footer */}
                <div className="mt-4 flex items-center gap-2 text-[10px] font-extrabold text-emerald-400 bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-500/30 shadow-xs">
                  <CheckCircle2 className="size-3.5 text-emerald-400" />
                  <span>ISO/IEC 15417 Optical Barcode Engine (100% Hardware Scannable)</span>
                </div>
              </div>
            </div>

            {/* In-place quick instructions */}
            <div className="w-full text-center text-[11px] text-slate-400 mt-2 flex items-center justify-center gap-2">
              <span>💡 <strong>Tip:</strong> Click any field in the sticker to select it. Double-click to edit text inline. Use Move Up/Down to rearrange.</span>
            </div>
          </div>

          {/* RIGHT: Layers & Element Inspector */}
          <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-900/80 p-5 overflow-y-auto space-y-5">
            {/* Header with Element Type */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="size-4 text-blue-400" />
                <h3 className="text-sm font-black text-white">Element Hierarchy & Order</h3>
              </div>
              <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded uppercase border border-blue-500/20">
                {currentElements.length} Blocks
              </span>
            </div>

            {/* Layers List (Reorder & Visibility) */}
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {currentElements.map((el, index) => {
                const isSelected = selectedElementKey === el.id;
                return (
                  <div
                    key={el.id}
                    onClick={() => setSelectedElementKey(el.id)}
                    className={`flex items-center justify-between p-2 rounded-xl text-xs transition cursor-pointer border ${
                      isSelected
                        ? "bg-blue-600/20 border-blue-500 text-white font-bold"
                        : "bg-slate-850/60 border-slate-800 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[10px] text-slate-500 w-4">{index + 1}.</span>
                      <span className="truncate">{el.label || el.type}</span>
                    </div>

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => moveElementUp(el.id)}
                        disabled={index === 0}
                        className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-20"
                        title="Move Up"
                      >
                        <ArrowUp className="size-3" />
                      </button>
                      <button
                        onClick={() => moveElementDown(el.id)}
                        disabled={index === currentElements.length - 1}
                        className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-20"
                        title="Move Down"
                      >
                        <ArrowDown className="size-3" />
                      </button>
                      <button
                        onClick={() => handleToggleVisibility(el.id)}
                        className={`p-1 rounded hover:bg-slate-700 ${el.visible === false ? "text-slate-500" : "text-emerald-400"}`}
                        title={el.visible === false ? "Show" : "Hide"}
                      >
                        {el.visible === false ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                      </button>
                      <button
                        onClick={() => handleRemoveElement(el.id)}
                        className="p-1 rounded hover:bg-red-950/60 text-slate-500 hover:text-red-400"
                        title="Delete Element"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Element Detailed Properties */}
            {selectedElement && (
              <div className="pt-3 border-t border-slate-800 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-blue-400 tracking-wider">
                    Format: {selectedElement.label || selectedElement.type}
                  </h4>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDuplicateElement(selectedElement.id)}
                      className="p-1 rounded text-slate-400 hover:text-amber-400"
                      title="Duplicate"
                    >
                      <Copy className="size-3.5" />
                    </button>
                    <button
                      onClick={() => handleRemoveElement(selectedElement.id)}
                      className="p-1 rounded text-slate-400 hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                {/* Element Data Source & Custom Display Name */}
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400">Data Field / Source</label>
                    <select
                      value={selectedElement.type}
                      onChange={(e) => {
                        const newType = e.target.value as any;
                        const matchOpt = ELEMENT_TYPE_OPTIONS.find((o) => o.type === newType);
                        updateSelectedElement({
                          type: newType,
                          label: matchOpt?.label || newType,
                        });
                      }}
                      className="w-full h-8 bg-slate-800 border border-slate-700 rounded-lg px-2 text-xs font-semibold text-white outline-none focus:border-blue-500"
                    >
                      {ELEMENT_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.type} value={opt.type}>
                          {opt.icon} {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400">Element Name / Label</label>
                    <input
                      type="text"
                      value={selectedElement.label || ""}
                      onChange={(e) => updateSelectedElement({ label: e.target.value })}
                      placeholder="e.g. Market Price, Max Retail Price"
                      className="w-full h-8 bg-slate-800 border border-slate-700 rounded-lg px-2 text-xs font-semibold text-white outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Prefix & Suffix */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400">Prefix Text</label>
                    <input
                      type="text"
                      value={selectedElement.prefix || ""}
                      onChange={(e) => updateSelectedElement({ prefix: e.target.value })}
                      placeholder="e.g. MRP: or SP: "
                      className="w-full h-8 bg-slate-800 border border-slate-700 rounded-lg px-2 text-xs font-semibold text-white outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400">Suffix Text</label>
                    <input
                      type="text"
                      value={selectedElement.suffix || ""}
                      onChange={(e) => updateSelectedElement({ suffix: e.target.value })}
                      placeholder="e.g. /- or (Tax Inc)"
                      className="w-full h-8 bg-slate-800 border border-slate-700 rounded-lg px-2 text-xs font-semibold text-white outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Custom Template for Custom Text */}
                {selectedElement.type === "customText" && (
                  <div className="space-y-1.5 p-2 rounded-lg bg-blue-950/40 border border-blue-500/30">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-blue-400">Custom Content / Template</label>
                      <span className="text-[8.5px] text-slate-400">Click chips to insert</span>
                    </div>
                    <input
                      type="text"
                      value={selectedElement.customText || ""}
                      onChange={(e) => updateSelectedElement({ customText: e.target.value })}
                      placeholder="e.g. Market: {mrp} | Offer: {sp}"
                      className="w-full h-8 bg-slate-900 border border-slate-700 rounded-lg px-2 text-xs font-semibold text-white outline-none focus:border-blue-500"
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
                            const cur = selectedElement.customText || "";
                            updateSelectedElement({ customText: cur ? `${cur} ${item.tag}` : item.tag });
                          }}
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 transition"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* MRP Strikeoff Toggle (Applicable & Removable as per user choice) */}
                {(selectedElement.type === "mrp" || selectedElement.type === "priceGroup") && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/80 border border-slate-700">
                    <div>
                      <div className="text-xs font-bold text-white">MRP Strike-through</div>
                      <div className="text-[9px] text-slate-400">
                        {selectedElement.showStrike === false || selectedElement.textDecoration === "none"
                          ? "✕ Strikethrough OFF (Clean text)"
                          : "✓ Strikethrough ON (Line-through)"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const isCurrentlyOff =
                          selectedElement.showStrike === false ||
                          selectedElement.textDecoration === "none";
                        const nextVal = isCurrentlyOff;
                        updateSelectedElement({
                          showStrike: nextVal,
                          textDecoration: nextVal ? "line-through" : "none",
                        });
                        updateTemplate({ showMrpStrike: nextVal });
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-black border transition ${
                        selectedElement.showStrike === false || selectedElement.textDecoration === "none"
                          ? "bg-slate-700 text-slate-300 border-slate-600"
                          : "bg-red-600 text-white border-red-600 shadow-xs"
                      }`}
                    >
                      {selectedElement.showStrike === false || selectedElement.textDecoration === "none"
                        ? "Strike: OFF"
                        : "Strike: ON"}
                    </button>
                  </div>
                )}

                {/* Spacing & Padding */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400">Top Spacing</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={selectedElement.marginTop || 0}
                      onChange={(e) => updateSelectedElement({ marginTop: Number(e.target.value) })}
                      className="w-full h-8 bg-slate-800 border border-slate-700 rounded-lg px-2 text-xs font-mono font-bold text-white outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400">Bottom Spacing</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={selectedElement.marginBottom !== undefined ? selectedElement.marginBottom : 2}
                      onChange={(e) => updateSelectedElement({ marginBottom: Number(e.target.value) })}
                      className="w-full h-8 bg-slate-800 border border-slate-700 rounded-lg px-2 text-xs font-mono font-bold text-white outline-none"
                    />
                  </div>
                </div>

                {/* Specific Height for Barcode / Divider */}
                {selectedElement.type === "barcodeGraphic" && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400">
                      Barcode Graphic Height: {selectedElement.height || 40}px
                    </label>
                    <input
                      type="range"
                      min="20"
                      max="70"
                      step="2"
                      value={selectedElement.height || 40}
                      onChange={(e) => updateSelectedElement({ height: Number(e.target.value) })}
                      className="w-full accent-blue-500"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
