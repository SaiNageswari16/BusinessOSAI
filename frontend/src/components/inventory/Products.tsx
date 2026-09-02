import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Filter, Plus, Package, Edit2, Archive, X, Sparkles, Globe, Loader2, Sliders, ShoppingCart, Store, Copy, Upload, Download, Barcode, Zap, ChevronLeft, ChevronRight, ArrowUpDown, Printer, Tag, CheckSquare, Square, LayoutGrid, Rows3, Box, Truck, Lightbulb, FileText, UploadCloud, DollarSign, Layers, Trash2, CheckCircle, CheckCircle2, Gift, Pause, Play, Bot, FileSpreadsheet, HelpCircle, Receipt, Eye } from "lucide-react";

import { inventoryApi, InventoryProduct, InventoryCategory, type Warehouse, resolveImageUrl, invoicesApi } from "../../lib/api-client";
import { useHardwareBarcodeScanner } from "../../hooks/useHardwareBarcodeScanner";
import { useTenant } from "../../contexts/tenant-context";
import { motion, AnimatePresence } from "framer-motion";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { RealBarcodeSvg, SingleBarcodeLabelCard } from "../../lib/barcode-svg";
import { generateClientTenantBarcode } from "../../lib/code128";
import { getActiveBarcodeTemplate } from "../../lib/receipt-template-store";
import { useCurrency } from "@/hooks/use-currency";
import { FreeQtySettingsModal } from "./FreeQtySettingsModal";

// ── Types ───────────────────────────────────────────────────────────
interface MasterResult {
  id?: string;
  name: string;
  sku_code?: string;
  barcode?: string;
  category_name?: string;
  brand_name?: string;
  cost_price?: number;
  mrp?: number;
  sale_price?: number;
  image_url?: string;
  specifications?: string;
  source?: string;
  short_description?: string;
  sub_category_name?: string;
  supplier?: string;
  [k: string]: any;
}

// ── Column definitions ──────────────────────────────────────────────
const LOCAL_COLUMNS = [
  // 1. Identity & Core
  { id: "image", label: "Image", group: "Identity" },
  { id: "name", label: "Item Name", group: "Identity" },
  { id: "unique_item_name", label: "Unique Item Name", group: "Identity" },
  { id: "sku", label: "SKU", group: "Identity" },
  { id: "barcode", label: "BarCode", group: "Identity" },
  { id: "secondary_barcode", label: "Secondary BarCode (BarCode.1)", group: "Identity" },
  { id: "item_code", label: "Item CODE", group: "Identity" },
  { id: "category", label: "Category", group: "Identity" },
  { id: "sub_category", label: "Sub Category", group: "Identity" },
  { id: "brand", label: "Brand", group: "Identity" },
  { id: "uom", label: "Unit (UOM)", group: "Identity" },
  { id: "sales_measuring_unit", label: "Sales Measuring Unit", group: "Identity" },
  { id: "purchase_measuring_unit", label: "Purchase Measuring Unit", group: "Identity" },

  // 2. Asian Paints & Colorant
  { id: "base_name", label: "Base Code/Name (Col C)", group: "Asian Paints" },
  { id: "product_base_code", label: "Product Base Code (Col D)", group: "Asian Paints" },
  { id: "size_l_kg", label: "Size (L/Kg) (Col E)", group: "Asian Paints" },

  // 3. Pricing & Tax
  { id: "mrp", label: "MRP", group: "Pricing" },
  { id: "selling_price", label: "Sales Price (Before Tax)", group: "Pricing" },
  { id: "sales_tax_type", label: "Sales Tax Mode", group: "Pricing" },
  { id: "sales_tax_name", label: "Sales Tax Name", group: "Pricing" },
  { id: "tax_percent", label: "Sales Tax (%)", group: "Pricing" },
  { id: "sales_price_after_tax", label: "Sales Price After Tax", group: "Pricing" },
  { id: "discount_limit", label: "Disc1(%)", group: "Pricing" },
  { id: "discount_amount", label: "Disc1(Rs)", group: "Pricing" },
  { id: "wholesale_price", label: "Wholesale Price", group: "Pricing" },
  { id: "min_wholesale_qty", label: "Min Wholesale Qty", group: "Pricing" },
  { id: "b2b_price", label: "B2B Price", group: "Pricing" },
  { id: "min_b2b_qty", label: "Min B2B Qty", group: "Pricing" },
  { id: "distributor_price", label: "Distributor Price", group: "Pricing" },
  { id: "min_distributor_qty", label: "Min Distributor Qty", group: "Pricing" },
  { id: "hsn_code", label: "HSN Code", group: "Pricing" },

  // 4. Purchasing & Supplier
  { id: "purchase_price", label: "Purchase Price", group: "Purchasing" },
  { id: "purchase_tax_type", label: "Purchase Tax Mode", group: "Purchasing" },
  { id: "purchase_tax_name", label: "Purchase Tax Name", group: "Purchasing" },
  { id: "purchase_tax_percent", label: "Purchase Tax (%)", group: "Purchasing" },
  { id: "purchase_price_after_tax", label: "Purchase Price After Tax", group: "Purchasing" },
  { id: "supplier", label: "Supplier Name", group: "Purchasing" },
  { id: "preferred_supplier", label: "Preferred Supplier", group: "Purchasing" },
  { id: "supplier_invoice_number", label: "Supplier Invoice #", group: "Purchasing" },
  { id: "supplier_invoice_date", label: "Supplier Invoice Date", group: "Purchasing" },
  { id: "item_received_date", label: "Item Received Date", group: "Purchasing" },

  // 5. Inventory & Warehouse & Batches
  { id: "initial_stock", label: "Opening Stock", group: "Inventory" },
  { id: "stock", label: "Current Stock", group: "Inventory" },
  { id: "reorder_level", label: "Stock Alert", group: "Inventory" },
  { id: "safety_stock", label: "Safety Stock", group: "Inventory" },
  { id: "mfg_date", label: "Manufacturing Date", group: "Inventory" },
  { id: "expiry_date", label: "Expiry Date", group: "Inventory" },
  { id: "warehouse", label: "Warehouse Name", group: "Inventory" },
  { id: "location_in_warehouse", label: "Location in Warehouse", group: "Inventory" },
  { id: "has_manual_batch", label: "Has Manual Batch", group: "Inventory" },
  { id: "stock_batch_number", label: "Stock Batch #", group: "Inventory" },
  { id: "stock_batch_expiry_date", label: "Stock Batch Expiry", group: "Inventory" },
  { id: "opening_stock_batch_number", label: "Opening Stock Batch #", group: "Inventory" },
  { id: "opening_stock_batch_expiry_date", label: "Opening Stock Batch Expiry", group: "Inventory" },

  // 6. Flags & Operations
  { id: "status", label: "Is Active / Status", group: "Operations" },
  { id: "has_label", label: "Has Label", group: "Operations" },
  { id: "label_headings", label: "Label Headings", group: "Operations" },
  { id: "need_to_print_barcode_sticker", label: "Print Barcode Sticker", group: "Operations" },
  { id: "is_service_item", label: "Is Service Item", group: "Operations" },
  { id: "not_for_sale", label: "Not For Sale", group: "Operations" },
  { id: "only_for_portal", label: "Only For Portal", group: "Operations" },
  { id: "not_for_portal", label: "Not For Portal", group: "Operations" },
  { id: "conversion_factor", label: "Conversion Factor", group: "Operations" },
  { id: "weighing_scale_code", label: "Weighing Scale Code", group: "Operations" },
  { id: "display_index", label: "Display Index", group: "Operations" },
  { id: "keywords", label: "Keywords", group: "Operations" },
  { id: "accessories_keyword", label: "Accessories Keyword", group: "Operations" },
  { id: "short_description", label: "Description", group: "Details" },
  { id: "description_html", label: "Description HTML", group: "Details" },
  { id: "source", label: "Source", group: "Details" },
];

const MASTER_COLUMNS = [
  { id: "image", label: "Image" },
  { id: "name", label: "Product Name" },
  { id: "sku", label: "SKU" },
  { id: "barcode", label: "Barcode" },
  { id: "base_name", label: "Base Code/Name" },
  { id: "product_base_code", label: "Product Base Code" },
  { id: "size_l_kg", label: "Size (L/Kg)" },
  { id: "category", label: "Category" },
  { id: "brand", label: "Brand" },
  { id: "mrp", label: "MRP" },
  { id: "selling_price", label: "Retail Price" },
  { id: "wholesale_price", label: "Wholesale Price" },
  { id: "b2b_price", label: "B2B Price" },
  { id: "specifications", label: "Specifications" },
  { id: "source", label: "Source" },
];

// ── Helpers ──────────────────────────────────────────────────────────
const esc = (v: any) => {
  if (v == null) return '""';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
};

const defaultFormData = () => ({
  // 1. Basic & Identification
  name: "",
  unique_item_name: "",
  brand: "",
  brand_id: "",
  sku: "",
  barcode: "",
  secondary_barcode: "",
  category_id: "",
  sub_category: "",
  item_code: "",
  uom_id: "",
  display_index: "" as any,
  image_url: "",
  category_image: "",

  // Asian Paints & Hardware Specific
  base_name: "",
  product_base_code: "",
  size_l_kg: "",

  // 2. Pricing, Tax & Tiers
  selling_price: "" as any,
  is_tax_inclusive: true,
  sales_tax_name: "GST",
  tax_percent: 0,
  sales_price_after_tax: "" as any,
  mrp: "" as any,
  discount_limit: "" as any, // Disc1(%)
  discount_amount: "" as any, // Disc1(Rs)
  sales_measuring_unit: "",
  hsn_code: "",

  // Multi-tier rates
  wholesale_price: "" as any,
  min_wholesale_qty: "" as any,
  wholesale_is_tax_inclusive: true,

  b2b_price: "" as any,
  min_b2b_qty: "" as any,
  b2b_is_tax_inclusive: true,

  distributor_price: "" as any,
  min_distributor_qty: "" as any,
  distributor_is_tax_inclusive: true,

  // 3. Purchase & Sourcing
  purchase_price: "" as any,
  is_purchase_tax_inclusive: true,
  purchase_tax_name: "GST",
  purchase_tax_percent: 0,
  purchase_price_after_tax: "" as any,
  purchase_measuring_unit: "",
  supplier: "",
  preferred_supplier: "",
  supplier_invoice_number: "",
  supplier_invoice_date: "",
  item_received_date: "",

  // 4. Stock, Warehouse & Batch Management
  initial_stock: "" as any, // Opening Stock
  stock: "" as any, // Current Stock
  reorder_level: "" as any, // Stock Alert
  safety_stock: "" as any,
  warehouse: "",
  location_in_warehouse: "",
  mfg_date: "",
  expiry_date: "",
  has_manual_batch: false,
  stock_batch_number: "",
  stock_batch_expiry_date: "",
  opening_stock_batch_number: "",
  opening_stock_batch_expiry_date: "",

  // 5. Flags & Portal Operations
  status: "active",
  is_service_item: false,
  not_for_sale: false,
  only_for_portal: false,
  not_for_portal: false,
  has_label: true,
  label_headings: "",
  need_to_print_barcode_sticker: true,
  weighing_scale_code: "",
  conversion_factor: "1",
  keywords: "",
  accessories_keyword: "",

  // 6. Descriptions & Custom Specs
  short_description: "",
  long_description: "",
  description_html: "",
  custom_fields: [] as Array<{ key: string; value: string }>
});

const localVisibleDefault = [
  "image", "name", "sku", "barcode", "base_name", "product_base_code", "size_l_kg",
  "category", "brand", "mrp", "selling_price", "wholesale_price", "b2b_price",
  "min_wholesale_qty", "tax_percent", "initial_stock", "status"
];
const masterVisibleDefault = ["image", "name", "sku", "barcode", "base_name", "product_base_code", "size_l_kg", "category", "brand", "mrp", "selling_price", "source"];

// ── Column menu sub-component with Search & Instant Presets ───────────
function ColumnMenu({
  columns, visible, onToggle, onToggleAll, onSave, onReset, onClose, onApplyPreset
}: {
  columns: typeof LOCAL_COLUMNS;
  visible: string[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onSave: () => void;
  onReset: () => void;
  onClose: () => void;
  onApplyPreset?: (cols: string[]) => void;
}) {
  const [searchCol, setSearchCol] = useState("");

  const filteredColumns = useMemo(() => {
    if (!searchCol.trim()) return columns;
    const q = searchCol.toLowerCase();
    return columns.filter(c => c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || ((c as any).group || "").toLowerCase().includes(q));
  }, [columns, searchCol]);

  const presets = [
    { label: "Default", ids: localVisibleDefault },
    { label: "All 65 Excel Cols", ids: columns.map(c => c.id) },
    { label: "Pricing & GST", ids: ["image", "name", "mrp", "selling_price", "sales_tax_type", "sales_tax_name", "tax_percent", "sales_price_after_tax", "discount_limit", "discount_amount", "wholesale_price", "b2b_price", "distributor_price", "hsn_code"] },
    { label: "Purchasing", ids: ["image", "name", "purchase_price", "purchase_tax_type", "purchase_tax_name", "purchase_tax_percent", "purchase_price_after_tax", "supplier", "preferred_supplier", "supplier_invoice_number", "item_received_date"] },
    { label: "Stock & Batch", ids: ["image", "name", "initial_stock", "stock", "reorder_level", "safety_stock", "warehouse", "location_in_warehouse", "mfg_date", "expiry_date", "has_manual_batch", "stock_batch_number", "stock_batch_expiry_date"] },
    { label: "Asian Paints", ids: ["image", "name", "base_name", "product_base_code", "size_l_kg", "category", "sub_category", "brand", "mrp", "selling_price"] },
  ];

  return (
    <div className="absolute right-0 mt-2 w-84 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-3.5 flex flex-col max-h-[500px]">
      <div className="flex items-center justify-between border-b pb-2 shrink-0">
        <div>
          <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">Columns Customizer</span>
          <span className="text-[10px] text-slate-500 font-semibold">{visible.length} of {columns.length} columns active</span>
        </div>
        <button
          type="button"
          onClick={onToggleAll}
          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors uppercase cursor-pointer"
        >
          {visible.length === columns.length ? "Deselect All" : "Select All"}
        </button>
      </div>

      {/* Preset Quick Selectors */}
      <div className="py-2 border-b shrink-0">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Quick Presets:</span>
        <div className="flex flex-wrap gap-1">
          {presets.map(pr => (
            <button
              key={pr.label}
              type="button"
              onClick={() => onApplyPreset ? onApplyPreset(pr.ids) : pr.ids.forEach(id => { if (!visible.includes(id)) onToggle(id); })}
              className="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 transition-colors cursor-pointer"
            >
              {pr.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search columns */}
      <div className="pt-2 shrink-0">
        <input
          type="text"
          placeholder="Filter columns (e.g. price, batch, gst, paint)..."
          value={searchCol}
          onChange={(e) => setSearchCol(e.target.value)}
          className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Column Checkboxes */}
      <div className="divide-y divide-slate-100 overflow-y-auto my-2 py-1 pr-1 flex-1 max-h-64">
        {filteredColumns.map(col => (
          <label key={col.id} className="flex items-center justify-between gap-2.5 py-1.5 px-1 hover:bg-slate-50 rounded cursor-pointer text-xs font-semibold text-slate-700">
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={visible.includes(col.id)}
                onChange={() => onToggle(col.id)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 size-3.5 cursor-pointer"
              />
              {col.label}
            </span>
            {(col as any).group && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                {(col as any).group}
              </span>
            )}
          </label>
        ))}
      </div>

      <div className="flex gap-2 pt-2 border-t mt-auto shrink-0">
        <Button size="sm" onClick={onSave} className="flex-1 text-[11px] h-8 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg border-0 shadow-sm">
          Save View Preset
        </Button>
        <Button size="sm" variant="outline" onClick={onReset} className="flex-1 text-[11px] h-8 font-bold rounded-lg text-slate-700 hover:bg-slate-50">
          Reset Default
        </Button>
      </div>
    </div>
  );
}
// ══════════════════════════════════════════════════════════════════════
//  INLINE CREATE POPOVER — for Category, Sub-Category, Brand
// ══════════════════════════════════════════════════════════════════════
function InlineCreatePopover({
  label,
  onSave,
  onClose,
}: {
  label: string;
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

  const handleSave = async () => {
    const name = value.trim();
    if (!name) return;
    setSaving(true);
    try {
      await onSave(name);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute z-[200] top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-2xl p-3 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-slate-700">New {label}</span>
        <button type="button" onClick={onClose} className="p-0.5 rounded hover:bg-slate-100"><X className="size-3.5 text-slate-500" /></button>
      </div>
      <input
        ref={inputRef}
        type="text"
        placeholder={`Enter ${label} name...`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave(); } if (e.key === 'Escape') onClose(); }}
        className="w-full h-9 px-3 text-sm rounded-lg border border-slate-300 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose} className="flex-1 h-8 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600">Cancel</button>
        <button type="button" onClick={handleSave} disabled={!value.trim() || saving} className="flex-1 h-8 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50">
          {saving ? "Saving..." : `Create ${label}`}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  BARCODE PRINT DRAWER — embedded in Products page
// ══════════════════════════════════════════════════════════════════════
type LayoutType = "1up" | "2up" | "3up" | "a4";

function BarcodePrintDrawer({
  products,
  initialSelectedId,
  onClose,
}: {
  products: InventoryProduct[];
  initialSelectedId?: string;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => {
    if (initialSelectedId) return new Set([initialSelectedId]);
    return new Set(products.filter(p => p.barcode).map(p => p.id));
  });
  const [copies, setCopies] = useState(1);
  const [layout, setLayout] = useState<LayoutType>("2up");
  const activeTemplate = getActiveBarcodeTemplate();
  const productsWithBarcodes = products.filter(p => p.barcode);

  const toggleAll = () => {
    if (selected.size === productsWithBarcodes.length) setSelected(new Set());
    else setSelected(new Set(productsWithBarcodes.map(p => p.id)));
  };

  const toggleProduct = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  // Build print items (with repetition for copies)
  const printItems = useMemo(() => {
    const items: { product_name: string; barcode: string; sku: string; selling_price: number | null; mrp: number | null; category_name: string; format: string }[] = [];
    products
      .filter(p => p.barcode && selected.has(p.id))
      .forEach(p => {
        for (let i = 0; i < copies; i++) {
          items.push({
            product_name: p.name,
            barcode: p.barcode!,
            sku: p.sku || "",
            selling_price: Number(p.selling_price) || null,
            mrp: Number(p.mrp) || null,
            category_name: p.category_name || "",
            format: "Code-128",
          });
        }
      });
    return items;
  }, [products, selected, copies]);

  const handlePrint = () => {
    if (printItems.length === 0) return toast.warning("Select at least one product with a barcode.");
    
    let styleEl = document.getElementById("barcode-print-style-tag");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "barcode-print-style-tag";
      document.head.appendChild(styleEl);
    }

    let pageCss = "@page { size: 50mm 25mm; margin: 0mm !important; }";
    if (layout === "2up") {
      pageCss = "@page { size: 100mm 25mm; margin: 0mm !important; }";
    } else if (layout === "3up") {
      pageCss = "@page { size: 114mm 25mm; margin: 0mm !important; }";
    } else if (layout === "a4") {
      pageCss = "@page { size: A4 portrait; margin: 4mm !important; }";
    }

    styleEl.innerHTML = `
      @media print {
        ${pageCss}
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          width: 100% !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body > *:not(#printable-barcode-portal) {
          display: none !important;
        }
        #printable-barcode-portal {
          display: block !important;
          visibility: visible !important;
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          background: #ffffff !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        #printable-barcode-portal * {
          visibility: visible !important;
        }
        .barcode-print-cell {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
      }
    `;

    setTimeout(() => {
      window.print();
    }, 150);
  };

  const gridClass = layout === "a4" ? "grid-cols-3" : layout === "3up" ? "grid-cols-3" : layout === "2up" ? "grid-cols-2" : "grid-cols-1";

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 400 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 shadow-2xl rounded-t-2xl max-h-[80vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Printer className="size-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Print Barcodes</h3>
              <p className="text-xs text-slate-500">{selected.size} of {productsWithBarcodes.length} products selected · {printItems.length} labels total</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100"><X className="size-5" /></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Product List */}
          <div className="w-72 shrink-0 border-r border-slate-100 flex flex-col">
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase">Products with Barcodes</span>
              <button type="button" onClick={toggleAll} className="text-[11px] font-bold text-indigo-600 hover:underline">
                {selected.size === productsWithBarcodes.length ? "Deselect All" : "Select All"}
              </button>
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-slate-50">
              {productsWithBarcodes.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-slate-400">
                  <Barcode className="size-8 mx-auto mb-2 opacity-30" />
                  No products with barcodes found.
                </div>
              ) : productsWithBarcodes.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleProduct(p.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 transition ${selected.has(p.id) ? "bg-emerald-50/60" : ""}`}
                >
                  {selected.has(p.id)
                    ? <CheckSquare className="size-4 text-emerald-500 shrink-0" />
                    : <Square className="size-4 text-slate-300 shrink-0" />}
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800 truncate">{p.name}</div>
                    <div className="text-[10px] font-mono text-slate-500 truncate">{p.barcode}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Settings + Preview */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Controls */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-6 shrink-0 flex-wrap">
              {/* Layout */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Layout:</span>
                {([
                  { key: "1up", label: "1-Up Roll", icon: <Rows3 className="size-3.5" /> },
                  { key: "2up", label: "2-Up", icon: <LayoutGrid className="size-3.5" /> },
                  { key: "3up", label: "3-Up", icon: <LayoutGrid className="size-3.5" /> },
                  { key: "a4", label: "A4 Sheet", icon: <Package className="size-3.5" /> },
                ] as { key: LayoutType; label: string; icon: React.ReactNode }[]).map(l => (
                  <button key={l.key} type="button" onClick={() => setLayout(l.key)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${layout === l.key ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-200 hover:bg-slate-50 text-slate-600"}`}>
                    {l.icon}{l.label}
                  </button>
                ))}
              </div>
              {/* Copies */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Copies:</span>
                {[1, 2, 5, 10].map(n => (
                  <button key={n} type="button" onClick={() => setCopies(n)}
                    className={`w-9 h-8 rounded-lg text-xs font-bold border transition ${copies === n ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 hover:bg-slate-50"}`}>{n}</button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="flex-1 overflow-auto p-4">
              <p className="text-xs font-bold text-slate-400 uppercase mb-3">Preview (first 6)</p>
              <div className={`grid ${gridClass} gap-2`}>
                {printItems.slice(0, 6).map((item, idx) => (
                  <SingleBarcodeLabelCard key={idx} item={item} template={activeTemplate} isPrint={false} />
                ))}
              </div>
              {printItems.length === 0 && (
                <div className="py-12 text-center text-slate-400 text-sm">Select products to preview barcodes</div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-xs font-semibold text-slate-500">{printItems.length} barcode labels ready to print</span>
              <div className="flex gap-3">
                <button type="button" onClick={onClose} className="px-4 h-9 rounded-xl border border-slate-200 text-xs font-semibold hover:bg-slate-50">Cancel</button>
                <button type="button" onClick={handlePrint} disabled={printItems.length === 0}
                  className="px-5 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50 shadow-sm">
                  <Printer className="size-3.5" /> Print Now ({printItems.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Printable Portal */}
      {typeof document !== "undefined" && createPortal(
        <div id="printable-barcode-portal" className="hidden print:block text-black bg-white p-0">
          <div className={`grid ${gridClass} gap-1.5 w-full p-0.5 box-border`}>
            {printItems.map((item, idx) => (
              <div key={idx} className="barcode-print-cell h-[24mm] max-h-[24mm] box-border overflow-hidden">
                <SingleBarcodeLabelCard item={item} template={activeTemplate} isPrint={true} />
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  QUICK-ADD MODAL — for when search returns nothing
// ══════════════════════════════════════════════════════════════════════
function QuickAddModal({
  onClose, onSave, initialName, categories, uoms, warehouses,
}: {
  onClose: () => void;
  onSave: () => void;
  initialName: string;
  categories: InventoryCategory[];
  uoms: any[];
  warehouses: Warehouse[];
}) {
  const { activeTenant } = useTenant();
  const [form, setForm] = useState(() => ({
    name: initialName,
    sku: "",
    barcode: "",
    brand: "",
    category_id: "",
    uom_id: "",
    warehouse: warehouses[0]?.name || "",
    supplier: "",
    purchase_price: 0,
    mrp: 0,
    selling_price: 0,
    tax_percent: 18,
    initial_stock: 0,
    reorder_level: 10,
    safety_stock: 5,
    status: "active",
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await inventoryApi.createProduct({
        ...form,
        sku: form.sku?.trim() || undefined,
        category_id: form.category_id || null,
        brand: form.brand || null,
        uom_id: form.uom_id || null,
        purchase_price: Number(form.purchase_price) || 0,
        mrp: Number(form.mrp) || 0,
        selling_price: Number(form.selling_price) || 0,
        tax_percent: Number(form.tax_percent) || 0,
        initial_stock: Number(form.initial_stock) || 0,
      });
      toast.success(`"${form.name}" added to your inventory!`);
      onSave();
      onClose();
    } catch (err: any) {
      toast.error("Failed to add product: " + (err.detail || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickFields = [
    { label: "Product Name", name: "name", required: true },
    { label: "SKU", name: "sku" },
    { label: "Barcode", name: "barcode", icon: Barcode },
    { label: "Brand", name: "brand" },
    { label: "Category", name: "category_id", type: "select", options: categories },
    { label: "UoM", name: "uom_id", type: "select", options: uoms },
    { label: "Warehouse", name: "warehouse" },
    { label: "Supplier", name: "supplier" },
    { label: "Purchase Price", name: "purchase_price", type: "number", step: "0.01" },
    { label: "MRP", name: "mrp", type: "number", step: "0.01" },
    { label: "Selling Price", name: "selling_price", type: "number", step: "0.01" },
    { label: "Tax (%)", name: "tax_percent", type: "number" },
    { label: "Initial Stock", name: "initial_stock", type: "number" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Zap className="size-4 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-bold">Quick Add Product</h2>
              <p className="text-[11px] text-muted-foreground">Not found in catalog? Add directly to your inventory.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="size-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {quickFields.map(field => (
              <div key={field.name} className={field.name === "name" ? "col-span-2" : ""}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-muted-foreground">
                    {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  {field.name === "barcode" && (
                    <button
                      type="button"
                      onClick={() => {
                        const code = generateClientTenantBarcode(activeTenant?.id || activeTenant?.name || "BOS", "EAN-13");
                        setForm(prev => ({ ...prev, barcode: code }));
                        toast.success(`Generated tenant barcode: ${code}`);
                      }}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 flex items-center gap-1 cursor-pointer"
                    >
                      <Zap className="size-2.5 text-amber-500" /> Auto-Gen
                    </button>
                  )}
                </div>
                {field.type === "select" ? (
                  <select name={field.name} value={(form as any)[field.name]} onChange={handleChange}
                    className="w-full h-9 px-3 text-sm rounded-lg border bg-background">
                    <option value="">Select {field.label}</option>
                    {(field.options || []).map((opt: any) => (
                      <option key={opt.id} value={opt.id}>{opt.name}</option>
                    ))}
                  </select>
                ) : (
                  <input type={(field as any).type || "text"} name={field.name} step={(field as any).step || "any"}
                    value={(form as any)[field.name]} onChange={handleChange}
                    className="w-full h-9 px-3 text-sm rounded-lg border bg-background"
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="gradient-brand text-white border-0">
              {isSubmitting ? "Saving..." : "Add to Inventory"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  IMPORT PREVIEW MODAL — shows what will be imported before commit
// ══════════════════════════════════════════════════════════════════════
function ImportPreviewModal({
  item, onClose, onConfirm, isImporting, categories,
}: {
  item: MasterResult;
  onClose: () => void;
  onConfirm: (item: MasterResult) => void;
  isImporting: boolean;
  categories: InventoryCategory[];
}) {
  const { currency, formatCurrency } = useCurrency();
  const [initialStock, setInitialStock] = useState(item.initial_stock || 10);
  const [sellingPrice, setSellingPrice] = useState(item.sale_price || item.mrp || 0);
  const [purchasePrice, setPurchasePrice] = useState(item.cost_price || (item.mrp ? item.mrp * 0.7 : 0));
  const [mrpValue, setMrpValue] = useState(item.mrp || 0);
  const defaultSelling = item.sale_price || item.mrp || 0;
  const [wholesalePrice, setWholesalePrice] = useState(item.wholesale_price || (defaultSelling ? Math.round(defaultSelling * 0.85 * 100) / 100 : 0));
  const [minWholesaleQty, setMinWholesaleQty] = useState(item.min_wholesale_qty || 5);
  const [b2bPrice, setB2bPrice] = useState(item.b2b_price || (defaultSelling ? Math.round(defaultSelling * 0.80 * 100) / 100 : 0));
  const [minB2bQty, setMinB2bQty] = useState(item.min_b2b_qty || 20);
  const [mfgDate, setMfgDate] = useState(item.mfg_date || "");
  const [expiryDate, setExpiryDate] = useState(item.expiry_date || "");
  const [supplier, setSupplier] = useState(item.supplier || "");
  const [isTaxInclusive, setIsTaxInclusive] = useState(item.is_tax_inclusive !== false);

  // Category selection: default to matching name if found
  const matchedCat = categories.find(c => !c.parent_id && c.name.toLowerCase() === (item.category_name || "").toLowerCase());
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(matchedCat?.id || "");
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string>("");

  const isAISourced = item.source === "AI_WEB_SEARCH";
  const [productImage, setProductImage] = useState<string>(item.image_url || "");
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG, JPG, WEBP, SVG)");
      return;
    }
    try {
      const res = await inventoryApi.uploadProductImage(file);
      if (res && res.image_url) {
        setProductImage(res.image_url);
        toast.success("Product image uploaded to server!");
        return;
      }
    } catch (err) {
      console.warn("Direct upload fallback to base64:", err);
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setProductImage(dataUrl);
      toast.success("Product image loaded!");
    };
    reader.readAsDataURL(file);
  };

  const parentCategories = categories.filter(c => !c.parent_id);
  const subCategories = selectedCategoryId ? categories.filter(c => c.parent_id === selectedCategoryId) : [];

  const gstBadge = isTaxInclusive
    ? <span className="text-emerald-600 text-[10px] font-normal ml-1">incl. GST</span>
    : <span className="text-orange-500 text-[10px] font-normal ml-1">excl. GST</span>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-card z-10 rounded-t-2xl">
          <div>
            <h2 className="text-base font-bold">Preview Import</h2>
            <p className="text-[11px] text-muted-foreground">Review details before adding to your inventory</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="size-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Product card with Image Upload action */}
          <div className="flex gap-3 p-3 bg-muted/50 rounded-xl items-center justify-between">
            <div className="flex gap-3 items-center min-w-0">
              <div className="relative group shrink-0">
                {productImage ? (
                  <img src={resolveImageUrl(productImage)} alt={item.name} className="size-16 rounded-xl object-cover border bg-white shadow-xs" />
                ) : (
                  <div className="size-16 rounded-xl bg-indigo-100/30 flex items-center justify-center">
                    <Package className="size-8 text-indigo-500" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="absolute inset-0 bg-black/50 text-white rounded-xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-[9px] font-bold"
                  title="Click to Upload Image"
                >
                  <Upload className="size-4 mb-0.5" />
                  Upload
                </button>
              </div>

              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.brand_name || item.brand || ""}</p>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[10px] mt-1 ${isAISourced ? "bg-amber-500/10 text-amber-600" : "bg-indigo-500/10 text-indigo-600"}`}>
                  <Sparkles className="size-3" /> {isAISourced ? "AI Sourced" : "Global Catalog"}
                </span>
              </div>
            </div>

            <div className="shrink-0 flex flex-col gap-1 items-end">
              <input
                type="file"
                ref={imageInputRef}
                accept="image/*"
                onChange={handleImageFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => imageInputRef.current?.click()}
                className="h-8 text-xs font-semibold gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >
                <Upload className="size-3.5 text-indigo-600" /> Upload Photo
              </Button>
              {productImage && (
                <button
                  type="button"
                  onClick={() => setProductImage("")}
                  className="text-[10px] text-rose-500 hover:underline font-semibold"
                >
                  Remove Photo
                </button>
              )}
            </div>
          </div>

          {/* Catalog specs preview */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {item.sku_code && <div><span className="text-muted-foreground">SKU:</span> <span className="font-mono font-bold">{item.sku_code}</span></div>}
            {item.barcode && <div><span className="text-muted-foreground">Barcode:</span> <span className="font-mono font-bold">{item.barcode}</span></div>}
            {item.mrp && <div><span className="text-muted-foreground">MRP:</span> <span className="font-bold">{formatCurrency(item.mrp)}</span></div>}
            {item.sale_price && <div><span className="text-muted-foreground">Sale Price:</span> <span className="font-bold">{formatCurrency(item.sale_price)}</span></div>}
            {item.specifications && <div className="col-span-2"><span className="text-muted-foreground">Specs:</span> <span className="text-[11px]">{item.specifications}</span></div>}
          </div>

          {/* GST Toggle */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border">
            <span className="text-xs font-semibold text-muted-foreground flex-1">Prices entered are:</span>
            <div className="flex rounded-lg overflow-hidden border text-xs font-semibold">
              <button
                onClick={() => setIsTaxInclusive(true)}
                className={`px-3 py-1.5 transition-colors ${isTaxInclusive ? "bg-emerald-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
              >
                With GST
              </button>
              <button
                onClick={() => setIsTaxInclusive(false)}
                className={`px-3 py-1.5 transition-colors ${!isTaxInclusive ? "bg-orange-500 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
              >
                Without GST
              </button>
            </div>
          </div>

          {/* ── Customize Import Fields ── */}
          <div className="space-y-3 pt-3 border-t">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Customize Import</p>

            {/* Row 1: Initial Stock + Selling Price */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Initial Stock</label>
                <input type="number" value={initialStock} onChange={(e) => setInitialStock(parseInt(e.target.value) || 0)}
                  className="w-full h-9 px-3 text-sm rounded-lg border bg-background" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Selling Price ({currency.symbol}){gstBadge}</label>
                <input type="number" step="0.01" value={sellingPrice} onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                  className="w-full h-9 px-3 text-sm rounded-lg border bg-background" />
              </div>
            </div>

            {/* Row 2: Purchase Price WITH GST Dropdown directly beside it */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-indigo-50/40 rounded-xl border border-indigo-100">
              <div>
                <label className="block text-xs font-bold text-indigo-950 mb-1">
                  Purchase Price ({currency.symbol})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)}
                  className="w-full h-9 px-3 text-sm rounded-lg border border-indigo-200 bg-white font-semibold"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-indigo-950 mb-1">
                  Purchase GST / Tax Mode
                </label>
                <select
                  value={isTaxInclusive ? "with_tax" : "without_tax"}
                  onChange={(e) => setIsTaxInclusive(e.target.value === "with_tax")}
                  className="w-full h-9 px-2 text-xs font-bold rounded-lg border border-indigo-200 bg-white text-indigo-900 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="with_tax">✅ With Tax (Inclusive GST)</option>
                  <option value="without_tax">📦 Without Tax (Exclusive GST)</option>
                </select>
              </div>
            </div>

            {/* Row 3: MRP + Wholesale Tier with MOQ */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">MRP ({currency.symbol}){gstBadge}</label>
                <input type="number" step="0.01" value={mrpValue} onChange={(e) => setMrpValue(parseFloat(e.target.value) || 0)}
                  className="w-full h-9 px-3 text-sm rounded-lg border bg-background" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Wholesale ({currency.symbol})</label>
                  <input type="number" step="0.01" value={wholesalePrice} onChange={(e) => setWholesalePrice(parseFloat(e.target.value) || 0)}
                    className="w-full h-9 px-3 text-sm rounded-lg border bg-background" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Wholesale MOQ</label>
                  <input type="number" min="1" value={minWholesaleQty} onChange={(e) => setMinWholesaleQty(parseInt(e.target.value) || 1)}
                    className="w-full h-9 px-3 text-sm rounded-lg border bg-background" placeholder="e.g. 5" title="Min Qty for Wholesale Price" />
                </div>
              </div>
            </div>

            {/* Row 4: B2B Distributor Tier with MOQ + Supplier */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">B2B Price ({currency.symbol})</label>
                  <input type="number" step="0.01" value={b2bPrice} onChange={(e) => setB2bPrice(parseFloat(e.target.value) || 0)}
                    className="w-full h-9 px-3 text-sm rounded-lg border bg-background" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">B2B MOQ</label>
                  <input type="number" min="1" value={minB2bQty} onChange={(e) => setMinB2bQty(parseInt(e.target.value) || 1)}
                    className="w-full h-9 px-3 text-sm rounded-lg border bg-background" placeholder="e.g. 20" title="Min Qty for B2B Distributor Price" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Supplier</label>
                <input type="text" value={supplier} onChange={(e) => setSupplier(e.target.value)}
                  className="w-full h-9 px-3 text-sm rounded-lg border bg-background" placeholder="Supplier name" />
              </div>
            </div>

            {/* Row 5: Mfg Date + Expiry Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Mfg. Date <span className="text-slate-400 font-normal">(optional)</span></label>
                <input type="date" value={mfgDate} onChange={(e) => setMfgDate(e.target.value)}
                  className="w-full h-9 px-3 text-sm rounded-lg border bg-background" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Expiry Date <span className="text-slate-400 font-normal">(optional)</span></label>
                <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full h-9 px-3 text-sm rounded-lg border bg-background" />
              </div>
            </div>

            {/* Category Selection */}
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-bold text-indigo-700 uppercase tracking-wider mb-1">Category <span className="text-slate-400 font-normal normal-case">(optional)</span></label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => { setSelectedCategoryId(e.target.value); setSelectedSubCategoryId(""); }}
                  className="w-full h-9 px-3 text-sm rounded-lg border bg-background"
                >
                  <option value="">— No Category —</option>
                  {parentCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {subCategories.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-purple-700 uppercase tracking-wider mb-1">Sub-Category <span className="text-slate-400 font-normal normal-case">(optional)</span></label>
                  <select
                    value={selectedSubCategoryId}
                    onChange={(e) => setSelectedSubCategoryId(e.target.value)}
                    className="w-full h-9 px-3 text-sm rounded-lg border bg-background"
                  >
                    <option value="">— No Sub-Category —</option>
                    {subCategories.map(sc => (
                      <option key={sc.id} value={sc.id}>{sc.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" onClick={onClose} disabled={isImporting}>Cancel</Button>
            <Button onClick={() => {
              const selectedCat = categories.find(c => c.id === selectedCategoryId);
              const selectedSubCat = categories.find(c => c.id === selectedSubCategoryId);
              onConfirm({
                ...item,
                mrp: mrpValue,
                cost_price: purchasePrice,
                sale_price: sellingPrice,
                initial_stock: initialStock,
                wholesale_price: wholesalePrice,
                min_wholesale_qty: minWholesaleQty,
                b2b_price: b2bPrice,
                min_b2b_qty: minB2bQty,
                mfg_date: mfgDate || undefined,
                expiry_date: expiryDate || undefined,
                is_tax_inclusive: isTaxInclusive,
                supplier,
                _selected_category_id: selectedCategoryId || undefined,
                _selected_sub_category_id: selectedSubCategoryId || undefined,
                category_name: selectedCat?.name || item.category_name || "",
                sub_category_name: selectedSubCat?.name || item.sub_category_name || "",
                image_url: productImage || item.image_url || "",
              });
            }} disabled={isImporting} className="gradient-brand text-white border-0">
              {isImporting ? <><Loader2 className="size-3 mr-1 animate-spin" /> Importing...</> : <><ShoppingCart className="size-3 mr-1" /> Confirm Import</>}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════
export function Products() {
    const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();
  const [, setCurrencyTick] = useState(0);
  useEffect(() => {
    const cb = () => setCurrencyTick(t => t + 1);
    window.addEventListener("bos-currency-changed", cb);
    return () => window.removeEventListener("bos-currency-changed", cb);
  }, []);

  // ── Tab state ────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"inventory" | "catalog">("inventory");

  // ── Search state ─────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [masterResults, setMasterResults] = useState<MasterResult[]>([]);
  const [isSearchingMaster, setIsSearchingMaster] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [aiPaused, setAiPaused] = useState(false);
  const [exactMatch, setExactMatch] = useState<InventoryProduct | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // ── Pagination & Sorting state ───────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState<"name" | "sku" | "created_at" | "updated_at" | "mrp" | "selling_price">("updated_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // ── Inventory data ───────────────────────────────────────────────
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hsnCodes, setHsnCodes] = useState<Array<{ hsn_code: string; description: string; gst_rate: number }>>([]);

  useEffect(() => {
    inventoryApi.getHsnCodes().then(res => setHsnCodes(res || [])).catch(() => {});
    inventoryApi.getAiImageSearchStatus().then(res => setAiPaused(res.paused)).catch(() => {});
  }, []);




  // ── Column visibility ────────────────────────────────────────────
  const [localVisibleColumns, setLocalVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem("products_local_visible_columns");
    if (saved) try { return JSON.parse(saved); } catch {}
    return localVisibleDefault;
  });
  const [masterVisibleColumns, setMasterVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem("products_master_visible_columns");
    if (saved) try { return JSON.parse(saved); } catch {}
    return masterVisibleDefault;
  });
  const [isColumnsMenuOpen, setIsColumnsMenuOpen] = useState(false);

  // ── Modal state ──────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState("basic");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentForm, setCurrentForm] = useState(defaultFormData());
  const [isManualHsn, setIsManualHsn] = useState(false);
  const [productInvoices, setProductInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState<boolean>(false);
  const [selectedImagePreview, setSelectedImagePreview] = useState<{ url: string; name: string; sku?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formData = useMemo(() => defaultFormData(), []);

  // Fetch Billed Invoices for Product
  useEffect(() => {
    if (isModalOpen && editingProductId && activeModalTab === "billed_invoices") {
      setLoadingInvoices(true);
      invoicesApi.listInvoices({ page_size: 200 })
        .then((res: any) => {
          const invList = res.items || res || [];
          const matching: any[] = [];
          invList.forEach((inv: any) => {
            (inv.items || []).forEach((it: any) => {
              if (
                it.product_id === editingProductId ||
                (it.product_name && currentForm.name && it.product_name.toLowerCase().trim() === currentForm.name.toLowerCase().trim())
              ) {
                matching.push({
                  invoice_id: inv.id,
                  invoice_number: inv.invoice_number,
                  invoice_date: inv.invoice_date || inv.created_at,
                  customer_name: inv.customer_name || inv.customer?.first_name ? `${inv.customer?.first_name || ''} ${inv.customer?.last_name || ''}`.trim() : "Walk-in Customer",
                  customer_phone: inv.customer_phone || inv.customer?.phone || "—",
                  quantity: Number(it.quantity) || 1,
                  unit_price: Number(it.unit_price) || 0,
                  total: Number(it.total || (it.quantity * it.unit_price)) || 0,
                  status: inv.status || "Completed",
                });
              }
            });
          });
          setProductInvoices(matching);
        })
        .catch(() => setProductInvoices([]))
        .finally(() => setLoadingInvoices(false));
    }
  }, [isModalOpen, editingProductId, activeModalTab, currentForm.name]);

  // ── Barcode Print Drawer state ───────────────────────────────────
  const [isBarcodeDrawerOpen, setIsBarcodeDrawerOpen] = useState(false);
  const [barcodeDrawerInitialId, setBarcodeDrawerInitialId] = useState<string | undefined>(undefined);

  // ── Inline popover state (brand / category / sub-category) ───────
  const [brandPopoverOpen, setBrandPopoverOpen] = useState(false);
  const [catPopoverOpen, setCatPopoverOpen] = useState(false);
  const [subCatPopoverOpen, setSubCatPopoverOpen] = useState(false);

  // ── Quick-add modal state ────────────────────────────────────────
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");

  // ── Import preview state ────────────────────────────────────────
  const [previewItem, setPreviewItem] = useState<MasterResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportConfirmModalOpen, setIsImportConfirmModalOpen] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<{ items: any[]; fileName: string; isPaintCatalog: boolean } | null>(null);
  const [enableAiForImport, setEnableAiForImport] = useState<boolean>(false);

  // ── Free Quantity & Promotional Schemes state ────────────────────
  const [isFreeQtyModalOpen, setIsFreeQtyModalOpen] = useState(false);
  const [freeQtyTriggerProductId, setFreeQtyTriggerProductId] = useState<string | undefined>(undefined);

  // ── Barcode Bulk Generator state ─────────────────────────────────
  const [isGeneratingBarcodes, setIsGeneratingBarcodes] = useState(false);

  // ── Derived ──────────────────────────────────────────────────────
  const missingBarcodesCount = useMemo(() => products.filter(p => !p.barcode || !p.barcode.trim()).length, [products]);
  const localBarcodes = useMemo(() => new Set(products.map(p => p.barcode).filter(Boolean)), [products]);
  const localNames = useMemo(() => new Set(products.map(p => p.name.toLowerCase())), [products]);
  const localSkus = useMemo(() => new Set(products.map(p => p.sku?.toLowerCase()).filter(Boolean) as string[]), [products]);
  const uniqueMasterResults = masterResults;

  // ── Phase 2: Exact-match priority: check barcode/SKU first ───────
  const checkExactMatch = (query: string): InventoryProduct | null => {
    const q = query.trim();
    if (!q) return null;
    // Exact barcode match (supports EAN-8, EAN-13, UPC-A)
    if (/^\d{8,14}$/.test(q)) {
      const barcodeMatch = products.find(p => p.barcode === q);
      if (barcodeMatch) return barcodeMatch;
    }
    // Exact SKU match (case-insensitive)
    const skuMatch = products.find(p => p.sku?.toLowerCase() === q.toLowerCase());
    if (skuMatch) return skuMatch;
    return null;
  };

  // Hardware Barcode Scanner Listener
  useHardwareBarcodeScanner({
    onScan: async (scannedCode) => {
      const code = scannedCode.trim();
      if (!code) return;

      const matched = checkExactMatch(code) || products.find(p => p.barcode === code || p.sku === code);
      if (matched) {
        setActiveTab("inventory");
        setSearch(code);
        toast.success(`Scanned: ${matched.name} (Found in Inventory)`);
        return;
      }

      setActiveTab("catalog");
      setSearch(code);
      setIsSearchingMaster(true);

      try {
        const fastRes = await inventoryApi.lookupProductByBarcode(code);
        if (fastRes?.success && fastRes?.product?.name) {
          const p = fastRes.product;
          setMasterResults([{
            id: p.id,
            name: p.name,
            barcode: p.barcode || code,
            sku_code: p.sku || `SKU-${code}`,
            brand_name: p.brand || "",
            category_name: p.category || "General",
            mrp: p.mrp || 0,
            sale_price: p.selling_price || 0,
            image_url: p.image || "/static/uploads/products/default_product.jpg",
            source: p.source || "DATABASE"
          }]);
          setIsSearchingMaster(false);
          toast.success(`Found product: ${p.name}`);
          return;
        }
      } catch (e) { }

      // Fallback: Perform Web/AI Search if fast lookup yielded no results
      try {
        const webRes = await inventoryApi.searchMasterCatalog(code, true, "auto");
        if (webRes && webRes.length > 0 && webRes[0].name) {
          setMasterResults(webRes);
          setIsSearchingMaster(false);
          toast.success(`Sourced product details for ${code}`);
          return;
        }
      } catch (e) { }

      // Only if not found in local DB, master catalog, OR AI web search -> open Quick Add modal
      setQuickAddName(`Scanned Item (${code})`);
      setIsQuickAddOpen(true);
      setIsSearchingMaster(false);

    },
    enabled: true
  });

  // Fuzzy local filter
  const fuzzyLocalResults = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
    (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()))
  );

  // ── AI status ────────────────────────────────────────────────────
  const checkAiStatus = async () => {
    try {
      const res = await inventoryApi.getRAGEnrichmentStatus();
      setAiPaused(!!res.paused);
    } catch (e) { console.error("Failed to fetch RAG status:", e); }
  };

  // ── Data loading ─────────────────────────────────────────────────
  const loadData = async (searchQuery = search) => {
    setIsLoading(true);
    try {
      const prodsRes = await inventoryApi.getProducts({
        page: currentPage,
        page_size: pageSize,
        search: searchQuery.trim(),
        sort_by: sortBy,
        sort_order: sortOrder,
      }).catch((err) => {
        console.error("Failed to load products:", err);
        return { items: [], total: 0, total_pages: 1 };
      });

      const items = prodsRes.items || [];
      const total = prodsRes.total ?? items.length;
      const pages = prodsRes.total_pages ?? Math.max(1, Math.ceil(total / pageSize));

      setProducts(items);
      setTotalProducts(total);
      setTotalPages(pages);
    } catch (error) {
      console.error("Failed in loadData:", error);
    } finally {
      setIsLoading(false);
    }

    inventoryApi.getCategories().then((res) => setCategories(Array.isArray(res) ? res : (res?.items || []))).catch(() => {});
    inventoryApi.getBrands().then((res) => setBrands(Array.isArray(res) ? res : (res?.items || []))).catch(() => {});
    inventoryApi.getUOMs().then((res) => setUoms(Array.isArray(res) ? res : (res?.items || []))).catch(() => {});
    inventoryApi.getWarehouses().then((res) => setWarehouses(Array.isArray(res) ? res : [])).catch(() => {});
  };

  useEffect(() => { checkAiStatus(); }, []);
  useEffect(() => {
    loadData(search);
  }, [tenant?.id, currentPage, pageSize, sortBy, sortOrder]);

  useEffect(() => {
    const handleInventoryChange = () => {
      loadData(search);
    };
    window.addEventListener("inventory_updated", handleInventoryChange);
    window.addEventListener("pos_invoices_updated", handleInventoryChange);
    return () => {
      window.removeEventListener("inventory_updated", handleInventoryChange);
      window.removeEventListener("pos_invoices_updated", handleInventoryChange);
    };
  }, [search, currentPage, pageSize, sortBy, sortOrder]);


  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Debounced search effect: Inventory vs Master Catalog ──────────
  useEffect(() => {
    const cleanSearch = search.trim();

    if (activeTab === "inventory") {
      setMasterResults([]);
      setSuggestions([]);
      setShowSuggestions(false);
      const timer = setTimeout(() => {
        setCurrentPage(1);
        loadData(cleanSearch);
      }, 300);
      return () => clearTimeout(timer);
    } else if (activeTab === "catalog") {
      if (cleanSearch.length < 2) {
        setMasterResults([]);
        return;
      }
      const timer = setTimeout(async () => {
        setIsSearchingMaster(true);
        try {
          const isBarcode = /^\d{4,}$/.test(cleanSearch);
          if (isBarcode) {
            try {
              const fastRes = await inventoryApi.lookupProductByBarcode(cleanSearch);
              if (fastRes?.success && fastRes?.product?.name) {
                const p = fastRes.product;
                setMasterResults([{
                  id: p.id,
                  name: p.name,
                  barcode: p.barcode || cleanSearch,
                  sku_code: p.sku || `SKU-${cleanSearch}`,
                  brand_name: p.brand || "",
                  category_name: p.category || "General",
                  mrp: p.mrp || 0,
                  sale_price: p.selling_price || 0,
                  wholesale_price: (p as any).wholesale_price || 0,
                  b2b_price: (p as any).b2b_price || 0,
                  image_url: p.image || "/static/uploads/products/default_product.jpg",
                  source: p.source || "DATABASE"
                }]);
                return;
              }
            } catch (fastErr) {
              console.debug("Debounced barcode lookup fallback:", fastErr);
            }
          }
          const res = await inventoryApi.searchMasterCatalog(cleanSearch, isBarcode, "auto");
          setMasterResults(res || []);
        } catch (err: any) {
          console.error("Master search failed:", err);
        } finally {
          setIsSearchingMaster(false);
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [search, activeTab]);


  // ── Suggestion select ────────────────────────────────────────────
  const handleSelectSuggestion = async (sug: string) => {
    setSearch(sug);
    setShowSuggestions(false);
    triggerMasterSearch(sug);
  };

  // ── Product CRUD ─────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const customFieldsDict = (currentForm.custom_fields || []).reduce((acc: any, f: any) => {
        if (f.key && f.key.trim()) acc[f.key.trim()] = f.value || "";
        return acc;
      }, {});

      // Calculate taxes if not specified
      const sellingPriceNum = Number(currentForm.selling_price) || 0;
      const salesTaxRate = Number(currentForm.tax_percent) || 0;
      const isSalesIncl = (currentForm as any).is_tax_inclusive !== false;
      let calculatedSalesAfterTax = 0;
      if (isSalesIncl) {
        calculatedSalesAfterTax = sellingPriceNum;
      } else {
        calculatedSalesAfterTax = sellingPriceNum + (sellingPriceNum * salesTaxRate) / 100;
      }

      const purchasePriceNum = Number(currentForm.purchase_price) || 0;
      const purchaseTaxRate = Number((currentForm as any).purchase_tax_percent) || 0;
      const isPurchaseIncl = (currentForm as any).is_purchase_tax_inclusive !== false;
      let calculatedPurchaseAfterTax = 0;
      if (isPurchaseIncl) {
        calculatedPurchaseAfterTax = purchasePriceNum;
      } else {
        calculatedPurchaseAfterTax = purchasePriceNum + (purchasePriceNum * purchaseTaxRate) / 100;
      }

      const specs = {
        // Multi-tier Rates
        b2b_price: Number(currentForm.b2b_price) || 0,
        min_b2b_qty: Number(currentForm.min_b2b_qty) || 1,
        b2b_is_tax_inclusive: (currentForm as any).b2b_is_tax_inclusive !== false,
        wholesale_price: Number(currentForm.wholesale_price) || 0,
        min_wholesale_qty: Number(currentForm.min_wholesale_qty) || 1,
        wholesale_is_tax_inclusive: (currentForm as any).wholesale_is_tax_inclusive !== false,
        distributor_price: Number(currentForm.distributor_price) || 0,
        min_distributor_qty: Number(currentForm.min_distributor_qty) || 1,
        distributor_is_tax_inclusive: (currentForm as any).distributor_is_tax_inclusive !== false,

        // Asian Paints & Hardware
        base_name: currentForm.base_name || "",
        product_base_code: currentForm.product_base_code || "",
        size_l_kg: currentForm.size_l_kg || "",

        // Extended Identity & Barcodes
        unique_item_name: (currentForm as any).unique_item_name || "",
        secondary_barcode: (currentForm as any).secondary_barcode || "",
        item_code: (currentForm as any).item_code || "",
        sub_category: currentForm.sub_category || "",
        display_index: (currentForm as any).display_index || "",
        category_image: (currentForm as any).category_image || "",

        // Pricing & Tax details
        sales_tax_name: (currentForm as any).sales_tax_name || "GST",
        sales_price_after_tax: (currentForm as any).sales_price_after_tax ? Number((currentForm as any).sales_price_after_tax) : calculatedSalesAfterTax,
        discount_amount: Number((currentForm as any).discount_amount) || 0,
        sales_measuring_unit: (currentForm as any).sales_measuring_unit || "",

        // Purchasing & Vendor details
        purchase_tax_percent: purchaseTaxRate,
        is_purchase_tax_inclusive: isPurchaseIncl,
        purchase_tax_name: (currentForm as any).purchase_tax_name || "GST",
        purchase_price_after_tax: (currentForm as any).purchase_price_after_tax ? Number((currentForm as any).purchase_price_after_tax) : calculatedPurchaseAfterTax,
        purchase_measuring_unit: (currentForm as any).purchase_measuring_unit || "",
        preferred_supplier: (currentForm as any).preferred_supplier || currentForm.supplier || "",
        supplier_invoice_number: (currentForm as any).supplier_invoice_number || "",
        supplier_invoice_date: (currentForm as any).supplier_invoice_date || "",
        item_received_date: (currentForm as any).item_received_date || "",

        // Warehouse & Batch Tracking
        location_in_warehouse: (currentForm as any).location_in_warehouse || "",
        mfg_date: (currentForm as any).mfg_date || "",
        expiry_date: (currentForm as any).expiry_date || "",
        has_manual_batch: Boolean((currentForm as any).has_manual_batch),
        stock_batch_number: (currentForm as any).stock_batch_number || "",
        stock_batch_expiry_date: (currentForm as any).stock_batch_expiry_date || "",
        opening_stock_batch_number: (currentForm as any).opening_stock_batch_number || "",
        opening_stock_batch_expiry_date: (currentForm as any).opening_stock_batch_expiry_date || "",

        // Operational Flags
        is_service_item: Boolean((currentForm as any).is_service_item),
        not_for_sale: Boolean((currentForm as any).not_for_sale),
        only_for_portal: Boolean((currentForm as any).only_for_portal),
        not_for_portal: Boolean((currentForm as any).not_for_portal),
        has_label: (currentForm as any).has_label !== false,
        label_headings: (currentForm as any).label_headings || "",
        need_to_print_barcode_sticker: (currentForm as any).need_to_print_barcode_sticker !== false,
        weighing_scale_code: (currentForm as any).weighing_scale_code || "",
        conversion_factor: (currentForm as any).conversion_factor || "1",
        keywords: (currentForm as any).keywords || "",
        accessories_keyword: (currentForm as any).accessories_keyword || "",
        description_html: (currentForm as any).description_html || "",

        custom_attributes: customFieldsDict
      };

      const payload = {
        ...currentForm,
        base_name: currentForm.base_name || null,
        product_base_code: currentForm.product_base_code || null,
        size_l_kg: currentForm.size_l_kg || null,
        purchase_price: Number(currentForm.purchase_price) || 0,
        mrp: Number(currentForm.mrp) || 0,
        selling_price: Number(currentForm.selling_price) || 0,
        wholesale_price: Number(currentForm.wholesale_price) || 0,
        min_wholesale_qty: Number(currentForm.min_wholesale_qty) || 1,
        b2b_price: Number(currentForm.b2b_price) || 0,
        tax_percent: Number(currentForm.tax_percent) || 0,
        discount_limit: Number(currentForm.discount_limit) || 0,
        initial_stock: Number(currentForm.initial_stock) || 0,
        reorder_level: Number(currentForm.reorder_level) || 0,
        safety_stock: Number(currentForm.safety_stock) || 0,
        brand_id: currentForm.brand_id || null,
        category_id: currentForm.category_id || null,
        uom_id: currentForm.uom_id || null,
        specifications: specs
      };
      if (editingProductId) {
        await inventoryApi.updateProduct(editingProductId, payload);
      } else {
        await inventoryApi.createProduct(payload);
      }
      setIsModalOpen(false);
      setEditingProductId(null);
      setCurrentForm(defaultFormData());
      await loadData();
      toast.success(editingProductId ? "Product updated!" : "Product created!");
    } catch (error) {
      console.error("Failed to save:", error);
      toast.error("Failed to save product.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (product: any) => {
    const specs = (product.specifications && typeof product.specifications === 'object') ? product.specifications : {};
    const customAttributes = specs.custom_attributes || {};
    const customFieldsList = Object.entries(customAttributes).map(([key, value]) => ({ key, value: String(value) }));

    setCurrentForm({
      // Basic & Identity
      name: product.name || "",
      unique_item_name: specs.unique_item_name || (product as any).unique_item_name || "",
      brand: product.brand_name || product.brand || "",
      brand_id: product.brand_id || "",
      sku: product.sku || "",
      barcode: product.barcode || "",
      secondary_barcode: specs.secondary_barcode || (product as any).secondary_barcode || "",
      category_id: product.category_id || "",
      sub_category: specs.sub_category || (product as any).sub_category || "",
      item_code: specs.item_code || (product as any).item_code || "",
      uom_id: product.uom_id || "",
      display_index: specs.display_index || (product as any).display_index || "",
      image_url: product.image_url || "",
      category_image: specs.category_image || (product as any).category_image || "",

      // Asian Paints & Hardware
      base_name: product.base_name || specs.base_name || "",
      product_base_code: product.product_base_code || specs.product_base_code || "",
      size_l_kg: product.size_l_kg || specs.size_l_kg || "",

      // Pricing & Tax
      selling_price: product.selling_price ? product.selling_price : (specs.selling_price || ""),
      is_tax_inclusive: product.is_tax_inclusive !== false && specs.is_tax_inclusive !== false,
      sales_tax_name: specs.sales_tax_name || "GST",
      tax_percent: product.tax_percent ?? specs.tax_percent ?? 0,
      sales_price_after_tax: specs.sales_price_after_tax || "",
      mrp: product.mrp ? product.mrp : (specs.mrp || ""),
      discount_limit: product.discount_limit ? product.discount_limit : (specs.discount_limit || ""),
      discount_amount: specs.discount_amount || "",
      sales_measuring_unit: specs.sales_measuring_unit || "",
      hsn_code: product.hsn_code || specs.hsn_code || "",

      // Tiers
      wholesale_price: product.wholesale_price || specs.wholesale_price || "",
      min_wholesale_qty: product.min_wholesale_qty || specs.min_wholesale_qty || "",
      wholesale_is_tax_inclusive: specs.wholesale_is_tax_inclusive !== false,
      b2b_price: product.b2b_price || specs.b2b_price || "",
      min_b2b_qty: specs.min_b2b_qty || "",
      b2b_is_tax_inclusive: specs.b2b_is_tax_inclusive !== false,
      distributor_price: specs.distributor_price || "",
      min_distributor_qty: specs.min_distributor_qty || "",
      distributor_is_tax_inclusive: specs.distributor_is_tax_inclusive !== false,

      // Purchasing & Vendor
      purchase_price: product.purchase_price ? product.purchase_price : (specs.purchase_price || ""),
      is_purchase_tax_inclusive: specs.is_purchase_tax_inclusive !== false,
      purchase_tax_name: specs.purchase_tax_name || "GST",
      purchase_tax_percent: specs.purchase_tax_percent ?? 0,
      purchase_price_after_tax: specs.purchase_price_after_tax || "",
      purchase_measuring_unit: specs.purchase_measuring_unit || "",
      supplier: product.supplier || specs.preferred_supplier || specs.supplier || "",
      preferred_supplier: specs.preferred_supplier || product.supplier || "",
      supplier_invoice_number: specs.supplier_invoice_number || "",
      supplier_invoice_date: specs.supplier_invoice_date || "",
      item_received_date: specs.item_received_date || "",

      // Stock, Warehouse & Batch
      initial_stock: (product.stock ?? product.initial_stock) ? (product.stock ?? product.initial_stock) : (specs.initial_stock || ""),
      stock: product.stock ?? specs.stock ?? "",
      reorder_level: product.reorder_level ? product.reorder_level : (specs.reorder_level || ""),
      safety_stock: product.safety_stock ? product.safety_stock : (specs.safety_stock || ""),
      warehouse: product.warehouse || specs.warehouse || "",
      location_in_warehouse: specs.location_in_warehouse || (product as any).location_in_warehouse || "",
      mfg_date: specs.mfg_date || (product as any).mfg_date || "",
      expiry_date: specs.expiry_date || (product as any).expiry_date || "",
      has_manual_batch: Boolean(specs.has_manual_batch),
      stock_batch_number: specs.stock_batch_number || "",
      stock_batch_expiry_date: specs.stock_batch_expiry_date || "",
      opening_stock_batch_number: specs.opening_stock_batch_number || "",
      opening_stock_batch_expiry_date: specs.opening_stock_batch_expiry_date || "",

      // Flags & Operations
      status: product.status || "active",
      is_service_item: Boolean(specs.is_service_item),
      not_for_sale: Boolean(specs.not_for_sale),
      only_for_portal: Boolean(specs.only_for_portal),
      not_for_portal: Boolean(specs.not_for_portal),
      has_label: specs.has_label !== false,
      label_headings: specs.label_headings || "",
      need_to_print_barcode_sticker: specs.need_to_print_barcode_sticker !== false,
      weighing_scale_code: specs.weighing_scale_code || "",
      conversion_factor: specs.conversion_factor || "1",
      keywords: specs.keywords || "",
      accessories_keyword: specs.accessories_keyword || "",

      // Descriptions & Custom
      short_description: product.short_description || specs.short_description || "",
      long_description: product.long_description || specs.long_description || "",
      description_html: specs.description_html || "",
      custom_fields: customFieldsList
    });
    setEditingProductId(product.id);
    setIsModalOpen(true);
  };

  const handleDuplicate = (product: any) => {
    const specs = (product.specifications && typeof product.specifications === 'object') ? product.specifications : {};
    const customAttributes = specs.custom_attributes || {};
    const customFieldsList = Object.entries(customAttributes).map(([key, value]) => ({ key, value: String(value) }));

    setCurrentForm({
      // Basic & Identity
      name: product.name + " (Copy)",
      unique_item_name: (specs.unique_item_name || "") ? specs.unique_item_name + " (Copy)" : "",
      brand: product.brand_name || product.brand || "",
      brand_id: product.brand_id || "",
      sku: (product.sku || "") + "-COPY",
      barcode: "",
      secondary_barcode: "",
      category_id: product.category_id || "",
      sub_category: specs.sub_category || "",
      item_code: (specs.item_code || "") ? specs.item_code + "-COPY" : "",
      uom_id: product.uom_id || "",
      display_index: specs.display_index || "",
      image_url: product.image_url || "",
      category_image: specs.category_image || "",

      // Asian Paints & Hardware
      base_name: product.base_name || specs.base_name || "",
      product_base_code: product.product_base_code || specs.product_base_code || "",
      size_l_kg: product.size_l_kg || specs.size_l_kg || "",

      // Pricing & Tax
      selling_price: product.selling_price ? product.selling_price : "",
      is_tax_inclusive: product.is_tax_inclusive !== false,
      sales_tax_name: specs.sales_tax_name || "GST",
      tax_percent: product.tax_percent ?? 0,
      sales_price_after_tax: specs.sales_price_after_tax || "",
      mrp: product.mrp ? product.mrp : "",
      discount_limit: product.discount_limit ? product.discount_limit : "",
      discount_amount: specs.discount_amount || "",
      sales_measuring_unit: specs.sales_measuring_unit || "",
      hsn_code: product.hsn_code || specs.hsn_code || "",

      // Tiers
      wholesale_price: product.wholesale_price || specs.wholesale_price || "",
      min_wholesale_qty: product.min_wholesale_qty || specs.min_wholesale_qty || "",
      wholesale_is_tax_inclusive: specs.wholesale_is_tax_inclusive !== false,
      b2b_price: product.b2b_price || specs.b2b_price || "",
      min_b2b_qty: specs.min_b2b_qty || "",
      b2b_is_tax_inclusive: specs.b2b_is_tax_inclusive !== false,
      distributor_price: specs.distributor_price || "",
      min_distributor_qty: specs.min_distributor_qty || "",
      distributor_is_tax_inclusive: specs.distributor_is_tax_inclusive !== false,

      // Purchasing & Vendor
      purchase_price: product.purchase_price ? product.purchase_price : "",
      is_purchase_tax_inclusive: specs.is_purchase_tax_inclusive !== false,
      purchase_tax_name: specs.purchase_tax_name || "GST",
      purchase_tax_percent: specs.purchase_tax_percent ?? 0,
      purchase_price_after_tax: specs.purchase_price_after_tax || "",
      purchase_measuring_unit: specs.purchase_measuring_unit || "",
      supplier: product.supplier || specs.preferred_supplier || "",
      preferred_supplier: specs.preferred_supplier || product.supplier || "",
      supplier_invoice_number: "",
      supplier_invoice_date: "",
      item_received_date: "",

      // Stock, Warehouse & Batch
      initial_stock: "",
      stock: "",
      reorder_level: product.reorder_level ? product.reorder_level : "",
      safety_stock: product.safety_stock ? product.safety_stock : "",
      warehouse: product.warehouse || "",
      location_in_warehouse: specs.location_in_warehouse || "",
      mfg_date: "",
      expiry_date: "",
      has_manual_batch: Boolean(specs.has_manual_batch),
      stock_batch_number: "",
      stock_batch_expiry_date: "",
      opening_stock_batch_number: "",
      opening_stock_batch_expiry_date: "",

      // Flags & Operations
      status: "active",
      is_service_item: Boolean(specs.is_service_item),
      not_for_sale: Boolean(specs.not_for_sale),
      only_for_portal: Boolean(specs.only_for_portal),
      not_for_portal: Boolean(specs.not_for_portal),
      has_label: specs.has_label !== false,
      label_headings: specs.label_headings || "",
      need_to_print_barcode_sticker: specs.need_to_print_barcode_sticker !== false,
      weighing_scale_code: "",
      conversion_factor: specs.conversion_factor || "1",
      keywords: specs.keywords || "",
      accessories_keyword: specs.accessories_keyword || "",

      // Descriptions & Custom
      short_description: product.short_description || "",
      long_description: product.long_description || "",
      description_html: specs.description_html || "",
      custom_fields: customFieldsList
    });
    setEditingProductId(null);
    setIsModalOpen(true);
  };
  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this product?")) return;
    try {
      await inventoryApi.deleteProduct(id);
      toast.success("Product deleted!");
      await loadData();
    } catch (err: any) {
      toast.error("Delete failed: " + (err.detail || err.message));
    }
  };

  const handleConfirmImport = async (item: MasterResult) => {
    try {
      setIsImporting(true);
      await inventoryApi.importToLocalInventory({
        name: item.name,
        sku: item.sku_code || `SKU-${item.barcode || Math.random().toString(36).slice(2, 9)}`,
        barcode: item.barcode || "",
        // Only send brand_name if it's a real value — don't auto-generate "General"
        brand_name: item.brand_name || item.brand || "",
        // Use category_id if user picked from dropdown, otherwise use name if present
        category_id: item._selected_category_id || undefined,
        sub_category_id: item._selected_sub_category_id || undefined,
        // Only send category_name if not empty (prevents auto-creating "General" category)
        category_name: (item.category_name && item.category_name.trim()) ? item.category_name.trim() : "",
        sub_category_name: (item.sub_category_name && item.sub_category_name.trim()) ? item.sub_category_name.trim() : "",
        short_description: item.short_description || item.specifications || "",
        specifications: item.specifications || "",
        image_url: item.image_url || "",
        purchase_price: item.cost_price || 0,
        mrp: item.mrp || 0,
        selling_price: item.sale_price || item.mrp || 0,
        wholesale_price: item.wholesale_price || 0,
        b2b_price: item.b2b_price || 0,
        is_tax_inclusive: item.is_tax_inclusive !== false,
        mfg_date: item.mfg_date || undefined,
        expiry_date: item.expiry_date || undefined,
        tax_percent: 18,
        initial_stock: item.initial_stock || 10,
        supplier: item.supplier || "",
        warehouse: warehouses[0]?.name || "",
      });
      toast.success(`"${item.name}" imported to your inventory`);
      setPreviewItem(null);
      await loadData();
      setSearch("");
      setMasterResults([]);
      setSuggestions([]);
    } catch (error: any) {
      toast.error("Import failed: " + (error.detail || error.message));
    } finally {
      setIsImporting(false);
    }
  };

  const handleToggleAi = async () => {
    try {
      if (aiPaused) {
        await inventoryApi.resumeAiImageSearch();
        setAiPaused(false);
        toast.success("AI Image Search & Web Sourcing resumed globally!");
      } else {
        await inventoryApi.pauseAiImageSearch();
        setAiPaused(true);
        toast.success("AI Image Search paused globally! Web image scraping is stopped.");
      }
    } catch {
      toast.error("Failed to toggle AI image search.");
    }
  };

  const executeBulkImport = async (targetItems: any[], enableAi: boolean) => {
    if (!targetItems?.length) {
      toast.error("No items found to import.");
      return;
    }
    setIsImporting(true);
    setIsImportConfirmModalOpen(false);

    try {
      const CHUNK_SIZE = 2000;
      let totalCreated = 0;
      let totalSkipped = 0;
      let totalBrands = 0;
      let totalCategories = 0;
      let totalUoms = 0;

      for (let i = 0; i < targetItems.length; i += CHUNK_SIZE) {
        const chunk = targetItems.slice(i, i + CHUNK_SIZE);
        const currentEnd = Math.min(i + CHUNK_SIZE, targetItems.length);
        toast.loading(`Importing rows ${i + 1} to ${currentEnd} of ${targetItems.length}...`, { id: "bulk-import-progress" });

        const res = await inventoryApi.masterImportProducts(chunk, enableAi);
        totalCreated += res.products_created;
        totalSkipped += res.skipped_count;
        totalBrands += res.brands_created;
        totalCategories += res.categories_created;
        totalUoms += res.uoms_created;
      }

      toast.success(
        `Import Complete!\n\n${totalCreated} products imported into inventory.\n${totalSkipped} duplicates skipped.\n${enableAi ? "✨ Queued for AI background enrichment (images & specs)." : "⚡ Fast Import: Background AI search skipped for internal barcodes."}`,
        { id: "bulk-import-progress", duration: 8000 }
      );
      await loadData();
    } catch (error: any) {
      toast.error("Import failed: " + (error.detail || error.message || "Unknown error"), { id: "bulk-import-progress" });
    } finally {
      setIsImporting(false);
      setPendingImportData(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Import from file (supports 42k+ rows, flexible column headers & chunking) ──────
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isCsv = fileName.endsWith(".csv");
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");

    if (!isCsv && !isExcel) {
      toast.error("Please upload a valid .csv, .xlsx, or .xls file.");
      return;
    }

    setIsImporting(true);

    const processData = (rows: any[]) => {
      if (!rows || rows.length === 0) {
        toast.error("The uploaded file is empty.");
        setIsImporting(false);
        return;
      }

      // Check if it's an Asian Paints format or standard 65-column sheet
      const firstRow = rows[0] || {};
      const colKeys = Object.keys(firstRow).map(k => k.trim().toLowerCase());
      const isPaintCatalog = colKeys.some(k => k.includes("base code") || k.includes("product base code") || k.includes("size (l/kg)") || k.includes("asian paint"));

      // Clean, format, and map all 65 catalog columns
      const validItems = rows.map((r: any) => {
        const findVal = (exactNames: string[], fuzzySubstrings: string[] = []) => {
          for (const k of Object.keys(r)) {
            const trimmed = k.trim();
            if (exactNames.some(en => en.toLowerCase() === trimmed.toLowerCase())) {
              return r[k] !== undefined && r[k] !== null ? String(r[k]).trim() : "";
            }
          }
          for (const k of Object.keys(r)) {
            const lower = k.trim().toLowerCase();
            if (fuzzySubstrings.some(sub => lower.includes(sub.toLowerCase()))) {
              return r[k] !== undefined && r[k] !== null ? String(r[k]).trim() : "";
            }
          }
          return "";
        };

        const itemName = findVal(["ITEM NAME", "Item Name", "PRODUCT NAME", "Product Name", "name", "Item", "Description"], ["item name", "product name", "item"]);
        if (!itemName) return null;

        // Identity & Codes
        const barcodeVal = findVal(["BarCode", "Barcode", "BARCODE", "barcode", "UPC", "EAN"], ["barcode"]);
        const secondaryBarcodeVal = findVal(["BarCode.1", "Secondary Barcode", "secondary_barcode", "Alternate Barcode", "Barcode 2"]);
        const skuVal = findVal(["SEARCHCODE", "SKU", "sku", "Item Code", "Product Code", "Item ID"], ["searchcode", "sku"]) || barcodeVal || `SKU-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        const itemCodeVal = findVal(["Item CODE", "Item Code", "item_code", "ITM CODE"]);
        const uniqueItemNameVal = findVal(["UNIQUE ITEM NAME", "Unique Item Name", "unique_item_name"]);

        // Asian Paints & Hardware
        const baseNameVal = findVal(["Base Code/Name", "Base Code / Name", "BASE CODE/NAME", "Base Name", "base_name", "Base", "BaseCode/Name"], ["base code/name", "base name"]);
        const productBaseCodeVal = findVal(["Product Base Code", "PRODUCT BASE CODE", "ProductBaseCode", "product_base_code", "base_code", "Base Code"], ["product base code", "base code"]);
        const sizeLKgVal = findVal(["Size (L/Kg)", "Size (L / Kg)", "Size (L/KG)", "SIZE (L/KG)", "Size", "size", "size_l_kg", "Pack Size", "pack_size"], ["size (l/kg)", "size"]);

        // Categories & Brands
        const categoryVal = findVal(["CATEGORY", "Category", "category", "Category Name"], ["category"]);
        const subCategoryVal = findVal(["SUB CATEGORY", "Sub Category", "sub_category", "Subcategory"], ["sub category", "subcategory"]);
        const brandVal = findVal(["Brand", "BRAND", "brand", "Brand Name", "Manufacturer"], ["brand"]);
        const uomVal = findVal(["Unit", "UNIT", "uom", "UOM", "Unit of Measure"], ["unit", "uom"]);
        const salesMeasuringUnitVal = findVal(["SALES MEASURING UNIT", "Sales Measuring Unit", "sales_measuring_unit"]);
        const purchaseMeasuringUnitVal = findVal(["PURCHASE MEASURING UNIT", "Purchase Measuring Unit", "purchase_measuring_unit"]);

        // Pricing & Tax
        const mrpVal = parseFloat(findVal(["MRP", "mrp", "retail_price", "Maximum Retail Price"])) || 0;
        const salesPriceVal = parseFloat(findVal(["SALES PRICE", "Sales Price", "selling_price", "SALESPRICE", "Price", "Rate"])) || 0;
        const salesTaxTypeVal = findVal(["Sales Tax inclusive/Exclusive", "Sales Tax Mode", "sales_tax_type"]);
        const isSalesTaxInclusive = salesTaxTypeVal.toLowerCase().includes("excl") ? false : true;
        const salesTaxNameVal = findVal(["SALES TAX NAME", "Sales Tax Name", "sales_tax_name"]) || "GST";
        const salesTaxPercentVal = parseFloat(findVal(["SALES TAX PERCENT", "Sales Tax Percent", "tax_percent", "GST (%)", "GST %", "Tax Rate", "TAX"])) || 0;
        const salesPriceAfterTaxVal = parseFloat(findVal(["SALES PRICE AFTER TAX", "Sales Price After Tax", "sales_price_after_tax"])) || 0;
        const disc1PctVal = parseFloat(findVal(["Disc1(%)", "Disc1%", "discount_limit", "Discount Limit (%)", "Discount (%)"])) || 0;
        const disc1RsVal = parseFloat(findVal(["Disc1(Rs)", "Disc1 Rs", "discount_amount", "Discount (Rs)"])) || 0;
        const hsnVal = findVal(["HSN", "hsn", "HSN Code", "hsn_code", "hsncode"]);

        // Multi-tier rates
        const wholesaleVal = parseFloat(findVal(["WHOLESALE PRICE", "Wholesale Price", "wholesale_price", "WHOLESALEPRICE"])) || 0;
        const minWholesaleVal = parseInt(findVal(["MIN WHOLESALE QTY", "Min Wholesale Qty", "min_wholesale_qty", "MINWHOLESALEQTY"]), 10) || 1;
        const b2bVal = parseFloat(findVal(["B2B PRICE", "B2B Price", "b2b_price", "B2BPRICE"])) || 0;
        const minB2bVal = parseInt(findVal(["MIN B2B QTY", "Min B2B Qty", "min_b2b_qty", "MINB2BQTY"]), 10) || 1;
        const distributorVal = parseFloat(findVal(["DISTRIBUTOR PRICE", "Distributor Price", "distributor_price"])) || 0;
        const minDistributorVal = parseInt(findVal(["MIN DISTRIBUTOR QTY", "Min Distributor Qty", "min_distributor_qty"]), 10) || 1;

        // Purchase & Sourcing
        const purchasePriceVal = parseFloat(findVal(["PURCHASE PRICE ", "PURCHASE PRICE", "Purchase Price", "purchase_price", "cost_price", "Cost"])) || 0;
        const purchaseTaxTypeVal = findVal(["PURCHASE Tax inclusive/Exclusive", "Purchase Tax Mode", "purchase_tax_type"]);
        const isPurchaseTaxInclusive = purchaseTaxTypeVal.toLowerCase().includes("excl") ? false : true;
        const purchaseTaxNameVal = findVal(["PURCHASE TAX NAME", "Purchase Tax Name", "purchase_tax_name"]) || "GST";
        const purchaseTaxPercentVal = parseFloat(findVal(["PURCHASE TAX PERCENT", "Purchase Tax Percent", "purchase_tax_percent"])) || 0;
        const purchasePriceAfterTaxVal = parseFloat(findVal(["PURCHASE PRICE AFTER TAX", "Purchase Price After Tax", "purchase_price_after_tax"])) || 0;
        const supplierNameVal = findVal(["SUPPLIER NAME", "Supplier Name", "supplier", "Supplier", "Vendor"], ["supplier", "vendor"]);
        const preferredSupplierVal = findVal(["PREFERRED SUPPLIER", "Preferred Supplier", "preferred_supplier"]) || supplierNameVal;
        const supplierInvoiceNoVal = findVal(["SUPPLIER INVOICE NUMBER", "Supplier Invoice Number", "supplier_invoice_number"]);
        const supplierInvoiceDateVal = findVal(["SUPPLIER INVOICE DATE", "Supplier Invoice Date", "supplier_invoice_date"]);
        const itemReceivedDateVal = findVal(["ITEM RECEIVED DATE", "Item Received Date", "item_received_date"]);

        // Stock & Warehouse
        const openingStockVal = parseInt(findVal(["Opening Stock", "opening_stock", "initial_stock"]), 10) || 0;
        const stockVal = parseInt(findVal(["STOCK", "Stock", "Quantity", "quantity", "Qty"]), 10) || openingStockVal;
        const stockAlertVal = parseInt(findVal(["Stock Alert", "stock_alert", "Reorder Level", "reorder_level"]), 10) || 10;
        const safetyStockVal = parseInt(findVal(["Safety Stock", "safety_stock"]), 10) || 0;
        const warehouseNameVal = findVal(["WAREHOUSE NAME", "Warehouse Name", "warehouse", "Warehouse"]);
        const locationInWarehouseVal = findVal(["LOCATION IN WAREHOUSE", "Location In Warehouse", "location_in_warehouse", "Rack Location", "Bin Location"]);
        const mfgDateVal = findVal(["Manifacturing DATE", "Manufacturing Date", "mfg_date", "MFG DATE"]);
        const expiryDateVal = findVal(["EXPIRY DATE", "Expiry Date", "expiry_date", "EXP DATE"]);
        const hasManualBatchRaw = findVal(["HAS MANUAL BATCH", "Has Manual Batch", "has_manual_batch"]);
        const hasManualBatch = hasManualBatchRaw.toLowerCase() === "yes" || hasManualBatchRaw.toLowerCase() === "true" || hasManualBatchRaw === "1";
        const stockBatchNoVal = findVal(["STOCK BATCH NUMBER", "Stock Batch Number", "stock_batch_number"]);
        const stockBatchExpVal = findVal(["STOCK BATCH EXPIRY DATE", "Stock Batch Expiry Date", "stock_batch_expiry_date"]);
        const openingStockBatchNoVal = findVal(["OPENING STOCK BATCH NUMBER", "Opening Stock Batch Number", "opening_stock_batch_number"]);
        const openingStockBatchExpVal = findVal(["OPENING STOCK BATCH EXPIRY DATE", "Opening Stock Batch Expiry Date", "opening_stock_batch_expiry_date"]);

        // Operational Flags
        const isActiveRaw = findVal(["IS ACTIVE", "ISACTIVE", "is_active", "Active", "Status"]);
        const isActive = isActiveRaw === "" ? true : (isActiveRaw.toLowerCase() === "true" || isActiveRaw === "1" || isActiveRaw.toLowerCase() === "yes" || isActiveRaw.toLowerCase() === "active");
        const hasLabelRaw = findVal(["HAS LABEL", "Has Label", "has_label"]);
        const hasLabel = hasLabelRaw.toLowerCase() === "no" || hasLabelRaw.toLowerCase() === "false" || hasLabelRaw === "0" ? false : true;
        const labelHeadingsVal = findVal(["LABEL HEADINGS", "Label Headings", "label_headings"]);
        const needBarcodeStickerRaw = findVal(["NEED TO PRINT BARCODE STICKER", "Need To Print Barcode Sticker", "need_to_print_barcode_sticker"]);
        const needBarcodeSticker = needBarcodeStickerRaw.toLowerCase() === "no" || needBarcodeStickerRaw.toLowerCase() === "false" || needBarcodeStickerRaw === "0" ? false : true;
        const isServiceItemRaw = findVal(["IS SERVICE ITEM", "Is Service Item", "is_service_item"]);
        const isServiceItem = isServiceItemRaw.toLowerCase() === "yes" || isServiceItemRaw.toLowerCase() === "true" || isServiceItemRaw === "1";
        const notForSaleRaw = findVal(["NOTFORSALE", "Not For Sale", "not_for_sale"]);
        const notForSale = notForSaleRaw.toLowerCase() === "yes" || notForSaleRaw.toLowerCase() === "true" || notForSaleRaw === "1";
        const onlyForPortalRaw = findVal(["ONLY FOR PORTAL", "Only For Portal", "only_for_portal"]);
        const onlyForPortal = onlyForPortalRaw.toLowerCase() === "yes" || onlyForPortalRaw.toLowerCase() === "true" || onlyForPortalRaw === "1";
        const notForPortalRaw = findVal(["NOT FOR PORTAL", "Not For Portal", "not_for_portal"]);
        const notForPortal = notForPortalRaw.toLowerCase() === "yes" || notForPortalRaw.toLowerCase() === "true" || notForPortalRaw === "1";
        const conversionFactorVal = findVal(["CONVERSION FACTOR", "Conversion Factor", "conversion_factor"]) || "1";
        const weighingScaleCodeVal = findVal(["WEIGHING SCALE ITEM CODE", "Weighing Scale Item Code", "weighing_scale_code", "WEIGHINGSCALEITEMCODE"]);
        const displayIndexVal = findVal(["DISPLAYINDEX", "Display Index", "display_index"]);
        const itemImageVal = findVal(["ITEMIMAGE", "Item Image", "item_image", "image_url"]);
        const categoryImageVal = findVal(["CATEGORYIMAGE", "Category Image", "category_image"]);
        const keywordsVal = findVal(["KEYWORDS", "Keywords", "keywords"]);
        const accessoriesKeywordVal = findVal(["ACCESSORIES KEYWORD", "Accessories Keyword", "accessories_keyword"]);
        const descVal = findVal(["DESCRIPTION", "Description", "description", "short_description"]);
        const descHtmlVal = findVal(["DESCRIPTI ON HTML", "Description HTML", "description_html", "DESCRIPTI_ON_HTML"]);

        const specs = {
          unique_item_name: uniqueItemNameVal,
          secondary_barcode: secondaryBarcodeVal,
          item_code: itemCodeVal,
          sub_category: subCategoryVal,
          base_name: baseNameVal,
          product_base_code: productBaseCodeVal,
          size_l_kg: sizeLKgVal,
          sales_measuring_unit: salesMeasuringUnitVal,
          purchase_measuring_unit: purchaseMeasuringUnitVal,
          sales_tax_name: salesTaxNameVal,
          sales_tax_type: salesTaxTypeVal || (isSalesTaxInclusive ? "Inclusive" : "Exclusive"),
          is_tax_inclusive: isSalesTaxInclusive,
          sales_price_after_tax: salesPriceAfterTaxVal,
          discount_amount: disc1RsVal,
          wholesale_price: wholesaleVal,
          min_wholesale_qty: minWholesaleVal,
          wholesale_is_tax_inclusive: true,
          b2b_price: b2bVal,
          min_b2b_qty: minB2bVal,
          b2b_is_tax_inclusive: true,
          distributor_price: distributorVal,
          min_distributor_qty: minDistributorVal,
          distributor_is_tax_inclusive: true,
          purchase_tax_name: purchaseTaxNameVal,
          purchase_tax_type: purchaseTaxTypeVal || (isPurchaseTaxInclusive ? "Inclusive" : "Exclusive"),
          purchase_tax_percent: purchaseTaxPercentVal,
          is_purchase_tax_inclusive: isPurchaseTaxInclusive,
          purchase_price_after_tax: purchasePriceAfterTaxVal,
          supplier: supplierNameVal,
          preferred_supplier: preferredSupplierVal,
          supplier_invoice_number: supplierInvoiceNoVal,
          supplier_invoice_date: supplierInvoiceDateVal,
          item_received_date: itemReceivedDateVal,
          location_in_warehouse: locationInWarehouseVal,
          mfg_date: mfgDateVal,
          expiry_date: expiryDateVal,
          has_manual_batch: hasManualBatch,
          stock_batch_number: stockBatchNoVal,
          stock_batch_expiry_date: stockBatchExpVal,
          opening_stock_batch_number: openingStockBatchNoVal,
          opening_stock_batch_expiry_date: openingStockBatchExpVal,
          has_label: hasLabel,
          label_headings: labelHeadingsVal,
          need_to_print_barcode_sticker: needBarcodeSticker,
          is_service_item: isServiceItem,
          not_for_sale: notForSale,
          only_for_portal: onlyForPortal,
          not_for_portal: notForPortal,
          conversion_factor: conversionFactorVal,
          weighing_scale_code: weighingScaleCodeVal,
          display_index: displayIndexVal,
          category_image: categoryImageVal,
          keywords: keywordsVal,
          accessories_keyword: accessoriesKeywordVal,
          description_html: descHtmlVal,
          custom_attributes: {}
        };

        return {
          name: itemName,
          sku: skuVal,
          barcode: barcodeVal || null,
          category_name: categoryVal || (isPaintCatalog ? "Paints & Wall Finishes" : "General"),
          brand_name: brandVal || (isPaintCatalog ? "Asian Paints" : "General"),
          uom_name: uomVal || (isPaintCatalog ? "Litre" : "Pieces"),
          base_name: baseNameVal || null,
          product_base_code: productBaseCodeVal || null,
          size_l_kg: sizeLKgVal || null,
          purchase_price: purchasePriceVal,
          mrp: mrpVal,
          selling_price: salesPriceVal || mrpVal,
          tax_percent: salesTaxPercentVal,
          discount_limit: disc1PctVal,
          wholesale_price: wholesaleVal,
          min_wholesale_qty: minWholesaleVal,
          b2b_price: b2bVal,
          initial_stock: openingStockVal || stockVal,
          reorder_level: stockAlertVal,
          safety_stock: safetyStockVal,
          warehouse: warehouseNameVal || "Main Warehouse",
          supplier: supplierNameVal || null,
          hsn_code: hsnVal || null,
          short_description: descVal || null,
          image_url: itemImageVal || null,
          status: isActive ? "active" : "inactive",
          specifications: specs
        };
      }).filter(Boolean);

      setIsImporting(false);

      if (validItems.length === 0) {
        toast.error("No valid product rows found. Ensure each row has at least an 'ITEM NAME' column.");
        return;
      }

      setPendingImportData({
        items: validItems,
        fileName: file.name,
        isPaintCatalog
      });
      setIsImportConfirmModalOpen(true);
    };

    if (isCsv) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processData(results.data);
        },
        error: (err) => {
          setIsImporting(false);
          toast.error(`CSV parse error: ${err.message}`);
        }
      });
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: "binary" });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
          processData(data);
        } catch (err: any) {
          setIsImporting(false);
          toast.error(`Excel parse error: ${err.message}`);
        }
      };
      reader.readAsBinaryString(file);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleExport = () => {
    if (products.length === 0) {
      toast.error("No products to export.");
      return;
    }

    // Build complete 65-column dataset matching the standard business format
    const exportData = products.map((p) => {
      const specs = (p.specifications && typeof p.specifications === 'object') ? p.specifications : {};
      return {
        "ITEM NAME": p.name || "",
        "BarCode": p.barcode || "",
        "Base Code/Name": p.base_name || specs.base_name || "",
        "Product Base Code": p.product_base_code || specs.product_base_code || "",
        "Size (L/Kg)": p.size_l_kg || specs.size_l_kg || "",
        "CATEGORY": p.category_name || "",
        "SUB CATEGORY": specs.sub_category || (p as any).sub_category || "",
        "BarCode.1": specs.secondary_barcode || (p as any).secondary_barcode || "",
        "Brand": p.brand_name || p.brand || "",
        "Item CODE": specs.item_code || (p as any).item_code || "",
        "Unit": p.uom_name || "",
        "Stock Alert": p.reorder_level ?? 10,
        "DESCRIPTION": p.short_description || specs.short_description || "",
        "DESCRIPTI ON HTML": specs.description_html || "",
        "CONVERSION FACTOR": specs.conversion_factor || "1",
        "WEIGHING SCALE ITEM CODE": specs.weighing_scale_code || "",
        "HSN": p.hsn_code || specs.hsn_code || "",
        "MRP": p.mrp ?? 0,
        "B2B PRICE": p.b2b_price ?? specs.b2b_price ?? 0,
        "MIN B2B QTY": specs.min_b2b_qty ?? 1,
        "WHOLESALE PRICE": p.wholesale_price ?? specs.wholesale_price ?? 0,
        "MIN WHOLESALE QTY": p.min_wholesale_qty ?? specs.min_wholesale_qty ?? 1,
        "SALES PRICE": p.selling_price ?? 0,
        "Sales Tax inclusive/Exclusive": specs.sales_tax_type || (p.is_tax_inclusive !== false ? "Inclusive" : "Exclusive"),
        "SALES TAX NAME": specs.sales_tax_name || "GST",
        "SALES TAX PERCENT": p.tax_percent ?? 0,
        "SALES PRICE AFTER TAX": specs.sales_price_after_tax ?? (p.selling_price ?? 0),
        "Disc1(%)": p.discount_limit ?? 0,
        "Disc1(Rs)": specs.discount_amount ?? 0,
        "SALES MEASURING UNIT": specs.sales_measuring_unit || p.uom_name || "",
        "PURCHASE PRICE ": p.purchase_price ?? 0,
        "PURCHASE Tax inclusive/Exclusive": specs.purchase_tax_type || "Inclusive",
        "PURCHASE TAX NAME": specs.purchase_tax_name || "GST",
        "PURCHASE TAX PERCENT": specs.purchase_tax_percent ?? 0,
        "PURCHASE PRICE AFTER TAX": specs.purchase_price_after_tax ?? (p.purchase_price ?? 0),
        "PURCHASE MEASURING UNIT": specs.purchase_measuring_unit || p.uom_name || "",
        "Opening Stock": p.initial_stock ?? 0,
        "STOCK": p.stock ?? p.initial_stock ?? 0,
        "Manifacturing DATE": specs.mfg_date || "",
        "EXPIRY DATE": specs.expiry_date || "",
        "WAREHOUSE NAME": p.warehouse || "Main Warehouse",
        "LOCATION IN WAREHOUSE": specs.location_in_warehouse || "",
        "IS ACTIVE": p.status === "active" ? "TRUE" : "FALSE",
        "HAS LABEL": specs.has_label !== false ? "TRUE" : "FALSE",
        "LABEL HEADINGS": specs.label_headings || "",
        "SUPPLIER NAME": p.supplier || specs.supplier || "",
        "ITEM RECEIVED DATE": specs.item_received_date || "",
        "SUPPLIER INVOICE NUMBER": specs.supplier_invoice_number || "",
        "SUPPLIER INVOICE DATE": specs.supplier_invoice_date || "",
        "NEED TO PRINT BARCODE STICKER": specs.need_to_print_barcode_sticker !== false ? "TRUE" : "FALSE",
        "IS SERVICE ITEM": specs.is_service_item ? "TRUE" : "FALSE",
        "NOTFORSALE": specs.not_for_sale ? "TRUE" : "FALSE",
        "ONLY FOR PORTAL": specs.only_for_portal ? "TRUE" : "FALSE",
        "NOT FOR PORTAL": specs.not_for_portal ? "TRUE" : "FALSE",
        "HAS MANUAL BATCH": specs.has_manual_batch ? "TRUE" : "FALSE",
        "STOCK BATCH NUMBER": specs.stock_batch_number || "",
        "STOCK BATCH EXPIRY DATE": specs.stock_batch_expiry_date || "",
        "OPENING STOCK BATCH NUMBER": specs.opening_stock_batch_number || "",
        "OPENING STOCK BATCH EXPIRY DATE": specs.opening_stock_batch_expiry_date || "",
        "DISPLAYINDEX": specs.display_index || "",
        "ITEMIMAGE": p.image_url || "",
        "CATEGORYIMAGE": specs.category_image || "",
        "UNIQUE ITEM NAME": specs.unique_item_name || (p as any).unique_item_name || "",
        "KEYWORDS": specs.keywords || "",
        "ACCESSORIES KEYWORD": specs.accessories_keyword || "",
        "PREFERRED SUPPLIER": specs.preferred_supplier || p.supplier || ""
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory Products");
    XLSX.writeFile(workbook, `inventory_products_65cols_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success(`Exported ${products.length} products with all 65 catalog columns!`);
  };

  const handleDownloadSample = () => {
    // Generate complete sample file matching the official 65-column business template
    const sampleHeaders = [
      "ITEM NAME", "BarCode", "Base Code/Name", "Product Base Code", "Size (L/Kg)",
      "CATEGORY", "SUB CATEGORY", "BarCode.1", "Brand", "Item CODE", "Unit",
      "Stock Alert", "DESCRIPTION", "DESCRIPTI ON HTML", "CONVERSION FACTOR",
      "WEIGHING SCALE ITEM CODE", "HSN", "MRP", "B2B PRICE", "MIN B2B QTY",
      "WHOLESALE PRICE", "MIN WHOLESALE QTY", "SALES PRICE", "Sales Tax inclusive/Exclusive",
      "SALES TAX NAME", "SALES TAX PERCENT", "SALES PRICE AFTER TAX", "Disc1(%)",
      "Disc1(Rs)", "SALES MEASURING UNIT", "PURCHASE PRICE ", "PURCHASE Tax inclusive/Exclusive",
      "PURCHASE TAX NAME", "PURCHASE TAX PERCENT", "PURCHASE PRICE AFTER TAX",
      "PURCHASE MEASURING UNIT", "Opening Stock", "STOCK", "Manifacturing DATE",
      "EXPIRY DATE", "WAREHOUSE NAME", "LOCATION IN WAREHOUSE", "IS ACTIVE",
      "HAS LABEL", "LABEL HEADINGS", "SUPPLIER NAME", "ITEM RECEIVED DATE",
      "SUPPLIER INVOICE NUMBER", "SUPPLIER INVOICE DATE", "NEED TO PRINT BARCODE STICKER",
      "IS SERVICE ITEM", "NOTFORSALE", "ONLY FOR PORTAL", "NOT FOR PORTAL",
      "HAS MANUAL BATCH", "STOCK BATCH NUMBER", "STOCK BATCH EXPIRY DATE",
      "OPENING STOCK BATCH NUMBER", "OPENING STOCK BATCH EXPIRY DATE", "DISPLAYINDEX",
      "ITEMIMAGE", "CATEGORYIMAGE", "UNIQUE ITEM NAME", "KEYWORDS", "ACCESSORIES KEYWORD",
      "PREFERRED SUPPLIER"
    ];

    const sampleRows = [
      {
        "ITEM NAME": "Royale Luxury Emulsion White 1L",
        "BarCode": "8901234567890",
        "Base Code/Name": "Base White",
        "Product Base Code": "ROY-WHT-1L",
        "Size (L/Kg)": "1L",
        "CATEGORY": "Paints & Finishes",
        "SUB CATEGORY": "Interior Emulsion",
        "BarCode.1": "8901234567891",
        "Brand": "Asian Paints",
        "Item CODE": "AP-ROY-1L",
        "Unit": "Litre",
        "Stock Alert": 15,
        "DESCRIPTION": "Super luxury emulsion paint with Teflon surface protector for interior walls.",
        "DESCRIPTI ON HTML": "<p>Super luxury interior emulsion with smooth sheen finish.</p>",
        "CONVERSION FACTOR": "1",
        "WEIGHING SCALE ITEM CODE": "WS-001",
        "HSN": "32091000",
        "MRP": 520,
        "B2B PRICE": 430,
        "MIN B2B QTY": 10,
        "WHOLESALE PRICE": 450,
        "MIN WHOLESALE QTY": 5,
        "SALES PRICE": 490,
        "Sales Tax inclusive/Exclusive": "Inclusive",
        "SALES TAX NAME": "GST",
        "SALES TAX PERCENT": 18,
        "SALES PRICE AFTER TAX": 490,
        "Disc1(%)": 5,
        "Disc1(Rs)": 0,
        "SALES MEASURING UNIT": "Litre",
        "PURCHASE PRICE ": 380,
        "PURCHASE Tax inclusive/Exclusive": "Inclusive",
        "PURCHASE TAX NAME": "GST",
        "PURCHASE TAX PERCENT": 18,
        "PURCHASE PRICE AFTER TAX": 380,
        "PURCHASE MEASURING UNIT": "Litre",
        "Opening Stock": 50,
        "STOCK": 50,
        "Manifacturing DATE": "2026-01-15",
        "EXPIRY DATE": "2029-01-15",
        "WAREHOUSE NAME": "Main Warehouse",
        "LOCATION IN WAREHOUSE": "Aisle-3-Rack-2",
        "IS ACTIVE": "TRUE",
        "HAS LABEL": "TRUE",
        "LABEL HEADINGS": "Asian Paints Royale",
        "SUPPLIER NAME": "Asian Paints Dist Ltd",
        "ITEM RECEIVED DATE": "2026-01-20",
        "SUPPLIER INVOICE NUMBER": "INV-AP-8921",
        "SUPPLIER INVOICE DATE": "2026-01-18",
        "NEED TO PRINT BARCODE STICKER": "TRUE",
        "IS SERVICE ITEM": "FALSE",
        "NOTFORSALE": "FALSE",
        "ONLY FOR PORTAL": "FALSE",
        "NOT FOR PORTAL": "FALSE",
        "HAS MANUAL BATCH": "TRUE",
        "STOCK BATCH NUMBER": "BATCH-2026-A1",
        "STOCK BATCH EXPIRY DATE": "2029-01-15",
        "OPENING STOCK BATCH NUMBER": "BATCH-2026-A1",
        "OPENING STOCK BATCH EXPIRY DATE": "2029-01-15",
        "DISPLAYINDEX": "1",
        "ITEMIMAGE": "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=300",
        "CATEGORYIMAGE": "",
        "UNIQUE ITEM NAME": "Asian Paints Royale Luxury Emulsion White 1L",
        "KEYWORDS": "paint, emulsion, interior, asian paints, white",
        "ACCESSORIES KEYWORD": "roller, brush, primer, putty",
        "PREFERRED SUPPLIER": "Asian Paints Dist Ltd"
      },
      {
        "ITEM NAME": "Apex Ultima Weather Proof Exterior Emulsion 4L",
        "BarCode": "8901234567892",
        "Base Code/Name": "Base 01",
        "Product Base Code": "APX-01-4L",
        "Size (L/Kg)": "4L",
        "CATEGORY": "Paints & Finishes",
        "SUB CATEGORY": "Exterior Emulsion",
        "BarCode.1": "",
        "Brand": "Asian Paints",
        "Item CODE": "AP-APX-4L",
        "Unit": "Litre",
        "Stock Alert": 10,
        "DESCRIPTION": "Advanced exterior wall protection with high durability and anti-algal warranty.",
        "DESCRIPTI ON HTML": "<p>Exterior wall emulsion paint with 7-year performance warranty.</p>",
        "CONVERSION FACTOR": "1",
        "WEIGHING SCALE ITEM CODE": "WS-002",
        "HSN": "32091000",
        "MRP": 1680,
        "B2B PRICE": 1390,
        "MIN B2B QTY": 6,
        "WHOLESALE PRICE": 1450,
        "MIN WHOLESALE QTY": 3,
        "SALES PRICE": 1580,
        "Sales Tax inclusive/Exclusive": "Inclusive",
        "SALES TAX NAME": "GST",
        "SALES TAX PERCENT": 18,
        "SALES PRICE AFTER TAX": 1580,
        "Disc1(%)": 5,
        "Disc1(Rs)": 0,
        "SALES MEASURING UNIT": "Litre",
        "PURCHASE PRICE ": 1250,
        "PURCHASE Tax inclusive/Exclusive": "Inclusive",
        "PURCHASE TAX NAME": "GST",
        "PURCHASE TAX PERCENT": 18,
        "PURCHASE PRICE AFTER TAX": 1250,
        "PURCHASE MEASURING UNIT": "Litre",
        "Opening Stock": 30,
        "STOCK": 30,
        "Manifacturing DATE": "2026-02-01",
        "EXPIRY DATE": "2029-02-01",
        "WAREHOUSE NAME": "Main Warehouse",
        "LOCATION IN WAREHOUSE": "Aisle-3-Rack-3",
        "IS ACTIVE": "TRUE",
        "HAS LABEL": "TRUE",
        "LABEL HEADINGS": "Apex Ultima",
        "SUPPLIER NAME": "Asian Paints Dist Ltd",
        "ITEM RECEIVED DATE": "2026-02-05",
        "SUPPLIER INVOICE NUMBER": "INV-AP-9012",
        "SUPPLIER INVOICE DATE": "2026-02-03",
        "NEED TO PRINT BARCODE STICKER": "TRUE",
        "IS SERVICE ITEM": "FALSE",
        "NOTFORSALE": "FALSE",
        "ONLY FOR PORTAL": "FALSE",
        "NOT FOR PORTAL": "FALSE",
        "HAS MANUAL BATCH": "TRUE",
        "STOCK BATCH NUMBER": "BATCH-2026-B2",
        "STOCK BATCH EXPIRY DATE": "2029-02-01",
        "OPENING STOCK BATCH NUMBER": "BATCH-2026-B2",
        "OPENING STOCK BATCH EXPIRY DATE": "2029-02-01",
        "DISPLAYINDEX": "2",
        "ITEMIMAGE": "https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=300",
        "CATEGORYIMAGE": "",
        "UNIQUE ITEM NAME": "Asian Paints Apex Ultima Weather Proof 4L",
        "KEYWORDS": "exterior paint, apex ultima, weather proof",
        "ACCESSORIES KEYWORD": "roller, masking tape, exterior primer",
        "PREFERRED SUPPLIER": "Asian Paints Dist Ltd"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleRows, { header: sampleHeaders });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sample Catalog 65 Cols");
    XLSX.writeFile(wb, "products_65cols_sample_template.xlsx");
    toast.success("Downloaded 65-column sample Excel template!");
  };
  // ── Open create modal helper ────────────────────────────────────
  const openCreateModal = () => {
    setCurrentForm(defaultFormData());
    setEditingProductId(null);
    setIsModalOpen(true);
  };

  // ── Quick-add handler ───────────────────────────────────────────
  const handleQuickAdd = () => {
    setQuickAddName(search.trim());
    setIsQuickAddOpen(true);
  };

  const handleQuickAddSave = () => {
    setSearch("");
    setMasterResults([]);
    setSuggestions([]);
    setShowSuggestions(false);
    loadData();
  };

  const triggerMasterSearch = async (overrideQuery?: string) => {
    const q = (overrideQuery !== undefined ? overrideQuery : search).trim();
    if (q.length < 2) return;
    setIsSearchingMaster(true);
    setShowSuggestions(false);
    setSearchError(null);
    try {
      const isBarcode = /^\d{4,}$/.test(q);

      // If typed query is a barcode, first call fast dedicated barcode lookup endpoint (identical to scanner)
      if (isBarcode) {
        try {
          const fastRes = await inventoryApi.lookupProductByBarcode(q);
          if (fastRes?.success && fastRes?.product?.name) {
            const p = fastRes.product;
            setMasterResults([{
              id: p.id,
              name: p.name,
              barcode: p.barcode || q,
              sku_code: p.sku || `SKU-${q}`,
              brand_name: p.brand || "",
              category_name: p.category || "General",
              mrp: p.mrp || 0,
              sale_price: p.selling_price || 0,
              wholesale_price: (p as any).wholesale_price || 0,
              b2b_price: (p as any).b2b_price || 0,
              image_url: p.image || "/static/uploads/products/default_product.jpg",
              source: p.source || "DATABASE"
            }]);
            setIsSearchingMaster(false);
            toast.success(`Found product: ${p.name}`);
            return;
          }
        } catch (fastErr) {
          console.debug("Fast barcode lookup fallback:", fastErr);
        }
      }

      const res = await inventoryApi.searchMasterCatalog(q, isBarcode || true, "auto");
      setMasterResults(res || []);
      if (res?.length) toast.success(`Found ${res.length} result(s) in catalog`);
      else toast.info(`No products found for "${q}"`);
    } catch (err: any) {
      console.error("Master search failed:", err);
      setSearchError(err.detail || err.message || "Search failed.");
    } finally {
      setIsSearchingMaster(false);
    }
  };

  // ── Search bar renderer ─────────────────────────────────────────
  const renderSearchBar = () => (
    <div className="relative flex-1 max-w-md flex items-center gap-2" ref={suggestionsRef}>
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (activeTab === "catalog") setShowSuggestions(true);
            setExactMatch(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (activeTab === "catalog") {
                triggerMasterSearch();
              }
            }
          }}
          onFocus={() => { if (activeTab === "catalog") setShowSuggestions(true); }}
          placeholder={activeTab === "inventory"
            ? "Search inventory by name, SKU, or Barcode..."
            : "Search master catalog / barcode (Press Enter)..."}
          className="w-full h-10 pl-9 pr-8 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30 outline-none"
        />
        {isSearchingMaster && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 animate-spin text-indigo-600" />
        )}
      </div>
      {activeTab === "catalog" && (
        <Button
          type="button"
          size="sm"
          onClick={() => triggerMasterSearch()}
          disabled={isSearchingMaster || search.trim().length < 2}
          className="h-10 px-4 gradient-brand text-white border-0 font-bold"
        >
          {isSearchingMaster ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4 mr-1" />} Search
        </Button>
      )}
      {/* ── Suggestions dropdown (Only on Master Catalog tab) ── */}
      {activeTab === "catalog" && showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-12 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="text-[10px] font-bold text-slate-400 px-3 py-1.5 bg-slate-50/50 uppercase border-b border-slate-100">
            Sourcing Suggestions
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
            {suggestions.map((sug, idx) => (
              <button key={idx} type="button" onClick={() => { setSearch(sug); triggerMasterSearch(sug); }}
                className="w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-slate-50 text-slate-700 flex items-center gap-2">
                <Sparkles className="size-3 text-indigo-500 shrink-0" />
                <span className="truncate">{sug}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ── Columns menu renderer ───────────────────────────────────────
  const renderColumnsMenu = () => (
    <div className="relative">
      <Button variant="outline" onClick={() => setIsColumnsMenuOpen(!isColumnsMenuOpen)} className="h-10 px-3.5 rounded-xl border-slate-200 text-slate-700 font-bold hover:bg-slate-50 shadow-sm flex items-center gap-2">
        <Sliders className="size-4 text-indigo-600" />
        <span>Columns</span>
        <span className="ml-1 px-1.5 py-0.5 text-[10px] font-black rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200">
          {activeTab === "inventory" ? localVisibleColumns.length : masterVisibleColumns.length}
        </span>
      </Button>
      {isColumnsMenuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsColumnsMenuOpen(false)} />
          <ColumnMenu
            columns={activeTab === "inventory" ? LOCAL_COLUMNS : MASTER_COLUMNS}
            visible={activeTab === "inventory" ? localVisibleColumns : masterVisibleColumns}
            onToggle={(id) => {
              const setter = activeTab === "inventory" ? setLocalVisibleColumns : setMasterVisibleColumns;
              setter(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
            }}
            onToggleAll={() => {
              const cols = activeTab === "inventory" ? LOCAL_COLUMNS : MASTER_COLUMNS;
              const visible = activeTab === "inventory" ? localVisibleColumns : masterVisibleColumns;
              const setter = activeTab === "inventory" ? setLocalVisibleColumns : setMasterVisibleColumns;
              if (visible.length === cols.length) {
                const def = activeTab === "inventory" ? localVisibleDefault : masterVisibleDefault;
                setter(def);
              } else {
                setter(cols.map(c => c.id));
              }
            }}
            onApplyPreset={(presetIds) => {
              if (activeTab === "inventory") {
                setLocalVisibleColumns(presetIds);
                localStorage.setItem("products_local_visible_columns", JSON.stringify(presetIds));
              } else {
                setMasterVisibleColumns(presetIds);
                localStorage.setItem("products_master_visible_columns", JSON.stringify(presetIds));
              }
              toast.success("Applied column view preset!");
            }}
            onSave={() => {
              const key = activeTab === "inventory" ? "products_local_visible_columns" : "products_master_visible_columns";
              const cols = activeTab === "inventory" ? localVisibleColumns : masterVisibleColumns;
              localStorage.setItem(key, JSON.stringify(cols));
              setIsColumnsMenuOpen(false);
              toast.success("Column preferences saved!");
            }}
            onReset={() => {
              const def = activeTab === "inventory" ? localVisibleDefault : masterVisibleDefault;
              const setter = activeTab === "inventory" ? setLocalVisibleColumns : setMasterVisibleColumns;
              const key = activeTab === "inventory" ? "products_local_visible_columns" : "products_master_visible_columns";
              setter(def);
              localStorage.setItem(key, JSON.stringify(def));
              toast.info("Reset columns to default.");
            }}
            onClose={() => setIsColumnsMenuOpen(false)}
          />
        </>
      )}
    </div>
  );

  // ── Input handler for form ───────────────────────────────────────
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let finalVal: any = value;
    if (type === 'number') {
      if (value === "") {
        finalVal = "";
      } else {
        const num = Number(value);
        finalVal = isNaN(num) ? "" : Math.max(0, num);
      }
    }
    setCurrentForm(prev => ({
      ...prev,
      [name]: finalVal
    }));
  };

  // ══════════════════════════════════════════════════════════════════
  //  RENDER: Product form modal (6 Comprehensive Tabs)
  // ══════════════════════════════════════════════════════════════════
  const renderProductForm = () => {
    if (!isModalOpen) return null;

    const modalTabs = [
      { id: "basic", label: "Basic & Identity", icon: Package },
      { id: "pricing", label: "Pricing & Tax", icon: DollarSign },
      { id: "purchasing", label: "Purchasing & Vendor", icon: Truck },
      { id: "inventory", label: "Stock & Batches", icon: Box },
      { id: "operations", label: "Flags & Operations", icon: Zap },
      { id: "other", label: "Descriptions & Specs", icon: FileText },
      ...(editingProductId ? [{ id: "billed_invoices", label: `Billed Invoices (${productInvoices.length})`, icon: Receipt }] : []),
    ];

    // Live tax computations for preview
    const sPrice = Number(currentForm.selling_price) || 0;
    const sTaxPct = Number(currentForm.tax_percent) || 0;
    const isSalesTaxIncl = (currentForm as any).is_tax_inclusive !== false;
    const computedSalesTaxAmt = isSalesTaxIncl 
      ? (sPrice * sTaxPct) / (100 + sTaxPct)
      : (sPrice * sTaxPct) / 100;
    const computedSalesTotal = isSalesTaxIncl ? sPrice : (sPrice + computedSalesTaxAmt);

    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200"
        >
          {/* Header */}
          <div className="p-6 border-b flex items-center justify-between bg-slate-50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600">
                <Package className="size-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  {editingProductId ? "Edit Catalog Product" : "Create New Product"}
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Complete catalog information supporting all 65 business attributes, multi-tier pricing, batches, and paint colorant specifications.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setIsModalOpen(false); setEditingProductId(null); setCurrentForm(defaultFormData()); setActiveModalTab("basic"); }}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b bg-slate-50/50 px-6 gap-2 shrink-0 overflow-x-auto">
            {modalTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeModalTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveModalTab(tab.id)}
                  className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "border-indigo-600 text-indigo-600 bg-white rounded-t-xl shadow-sm"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
                  }`}
                >
                  <Icon className={`size-4 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              {/* TAB 1: BASIC & IDENTITY */}
              {activeModalTab === "basic" && (
                <div className="space-y-6">
                  {/* Product Image Upload Section */}
                  <div className="p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100 flex flex-col md:flex-row items-start md:items-center gap-4">
                    <div className="relative group shrink-0">
                      {currentForm.image_url ? (
                        <div className="relative">
                          <img
                            src={resolveImageUrl(currentForm.image_url)}
                            alt="Product Preview"
                            className="size-20 rounded-2xl object-cover border-2 border-indigo-200 bg-white shadow-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setCurrentForm(prev => ({ ...prev, image_url: "" }))}
                            className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 shadow-md hover:bg-rose-600 transition-colors"
                            title="Remove Image"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="size-20 rounded-2xl border-2 border-dashed border-indigo-300 bg-white/80 flex flex-col items-center justify-center text-indigo-400">
                          <Package className="size-8 opacity-60" />
                          <span className="text-[9px] font-bold mt-1">No Image</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-2 w-full">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Upload className="size-3.5 text-indigo-600" />
                          Product Image / Photo
                        </label>
                        <span className="text-[10px] text-slate-500">Supports JPG, PNG, WEBP, SVG</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="file"
                          id="product_photo_file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const res = await inventoryApi.uploadProductImage(file);
                              if (res && res.image_url) {
                                setCurrentForm(prev => ({ ...prev, image_url: res.image_url }));
                                toast.success("Image uploaded to server successfully!");
                                return;
                              }
                            } catch (err) {
                              console.warn("Direct upload fallback to base64:", err);
                            }
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                              const dataUrl = evt.target?.result as string;
                              setCurrentForm(prev => ({ ...prev, image_url: dataUrl }));
                              toast.success("Image loaded for product draft!");
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById("product_photo_file")?.click()}
                          className="h-9 px-3 text-xs font-bold border-indigo-300 text-indigo-700 hover:bg-indigo-50 rounded-xl"
                        >
                          <Upload className="size-3.5 mr-1.5 text-indigo-600" /> Upload from Computer
                        </Button>
                        <div className="flex-1 min-w-[200px]">
                          <input
                            type="text"
                            name="image_url"
                            value={currentForm.image_url || ""}
                            onChange={handleFormChange}
                            placeholder="Or paste external image URL / CDN link..."
                            className="w-full h-9 px-3 text-xs rounded-xl border border-indigo-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Basic Identifiers */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Item Name (Product Name) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        required
                        value={currentForm.name}
                        onChange={handleFormChange}
                        placeholder="e.g. Royale Luxury Emulsion White 1L"
                        className="w-full h-11 px-4 text-sm font-semibold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Unique Item Name (Full Catalog Name)
                      </label>
                      <input
                        type="text"
                        name="unique_item_name"
                        value={(currentForm as any).unique_item_name || ""}
                        onChange={handleFormChange}
                        placeholder="e.g. Asian Paints Royale Luxury Emulsion White 1L Can"
                        className="w-full h-11 px-4 text-sm rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Internal Item Code
                      </label>
                      <input
                        type="text"
                        name="item_code"
                        value={(currentForm as any).item_code || ""}
                        onChange={handleFormChange}
                        placeholder="e.g. ITM-AP-ROY-1L"
                        className="w-full h-11 px-4 text-sm font-mono rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* SKU & Barcodes */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        SKU / Search Code
                      </label>
                      <input
                        type="text"
                        name="sku"
                        value={currentForm.sku}
                        onChange={handleFormChange}
                        placeholder="e.g. SKU-ROYALE-01"
                        className="w-full h-10 px-3.5 text-sm font-mono rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                          Primary BarCode (EAN/UPC)
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const code = generateClientTenantBarcode(tenant?.id || tenant?.name || "BOS", "EAN-13");
                              setCurrentForm(prev => ({ ...prev, barcode: code }));
                              toast.success(`Generated GS1 EAN-13 barcode: ${code}`);
                            }}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200 transition-colors flex items-center gap-1 cursor-pointer"
                            title="Auto-generate GS1 EAN-13 in-store restricted circulation barcode (starts with 20)"
                          >
                            <Zap className="size-2.5 text-amber-500" /> Auto-Gen (EAN)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const code = generateClientTenantBarcode(tenant?.id || tenant?.name || "BOS", "Code-128");
                              setCurrentForm(prev => ({ ...prev, barcode: code }));
                              toast.success(`Generated Code-128 barcode: ${code}`);
                            }}
                            className="text-[10px] font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded-md border border-slate-200 transition-colors cursor-pointer"
                            title="Auto-generate Code-128 alphanumeric barcode"
                          >
                            Code-128
                          </button>
                          {currentForm.barcode && editingProductId && (
                            <button
                              type="button"
                              onClick={() => {
                                setBarcodeDrawerInitialId(editingProductId);
                                setIsBarcodeDrawerOpen(true);
                              }}
                              className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded-md border border-emerald-200 transition-colors flex items-center gap-1 cursor-pointer"
                              title="Print barcode label for this product"
                            >
                              <Printer className="size-2.5" /> Print
                            </button>
                          )}
                        </div>
                      </div>
                      <input
                        type="text"
                        name="barcode"
                        value={currentForm.barcode}
                        onChange={handleFormChange}
                        placeholder="e.g. 2010420001484 (EAN-13) or 890123..."
                        className="w-full h-10 px-3.5 text-sm font-mono font-bold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />

                      {currentForm.barcode && (
                        <div className="mt-2 p-2 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col items-center justify-center">
                          <RealBarcodeSvg code={currentForm.barcode} height={36} unitPx={1.5} />
                          <span className="text-[10px] font-mono font-semibold text-slate-500 mt-1">
                            {currentForm.barcode.length === 13 && currentForm.barcode.startsWith("20") ? "GS1 In-Store Internal Barcode" : "Hardware Scannable Barcode"}
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Secondary BarCode (BarCode.1)
                      </label>
                      <input
                        type="text"
                        name="secondary_barcode"
                        value={(currentForm as any).secondary_barcode || ""}
                        onChange={handleFormChange}
                        placeholder="e.g. 8901234567891"
                        className="w-full h-10 px-3.5 text-sm font-mono rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Asian Paints / Hardware Specs Card */}
                  <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-3">
                    <div className="flex items-center gap-2 text-amber-900 font-extrabold text-xs uppercase tracking-wider">
                      <Sparkles className="size-4 text-amber-600" />
                      <span>Asian Paints & Colorant Specifications</span>
                      <span className="text-[10px] text-amber-600 font-normal ml-auto">Columns C, D, E</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Base Code / Name (Col C)
                        </label>
                        <input
                          type="text"
                          name="base_name"
                          value={currentForm.base_name}
                          onChange={handleFormChange}
                          placeholder="e.g. Base White / Base 01"
                          className="w-full h-9 px-3 text-xs font-semibold rounded-lg border border-amber-200 bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Product Base Code (Col D)
                        </label>
                        <input
                          type="text"
                          name="product_base_code"
                          value={currentForm.product_base_code}
                          onChange={handleFormChange}
                          placeholder="e.g. ROY-WHT-1L"
                          className="w-full h-9 px-3 text-xs font-mono rounded-lg border border-amber-200 bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Size (L/Kg) (Col E)
                        </label>
                        <input
                          type="text"
                          name="size_l_kg"
                          value={currentForm.size_l_kg}
                          onChange={handleFormChange}
                          placeholder="e.g. 1L, 4L, 10L, 20L, 1Kg, 5Kg"
                          className="w-full h-9 px-3 text-xs font-semibold rounded-lg border border-amber-200 bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Category, Brand, UOM, Units */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Category */}
                    <div className="relative">
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Category
                      </label>
                      <div className="flex gap-2">
                        <select
                          name="category_id"
                          value={currentForm.category_id}
                          onChange={(e) => {
                            const cId = e.target.value;
                            const cat = categories.find(c => c.id === cId);
                            setCurrentForm(prev => ({
                              ...prev,
                              category_id: cId,
                              category: cat ? cat.name : "",
                            }));
                          }}
                          className="w-full h-10 px-3 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          <option value="">Select Category</option>
                          {categories.filter(c => !c.parent_id).map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={() => setCatPopoverOpen(!catPopoverOpen)}
                          className="h-10 w-10 shrink-0 rounded-xl"
                          title="Add New Category"
                        >
                          <Plus className="size-4" />
                        </Button>
                      </div>
                      {catPopoverOpen && (
                        <div className="absolute top-full mt-2 left-0 w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-30">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-800">New Main Category</span>
                            <button type="button" onClick={() => setCatPopoverOpen(false)} className="text-slate-400 hover:text-slate-600">
                              <X className="size-3.5" />
                            </button>
                          </div>
                          <input
                            type="text"
                            placeholder="Category Name (e.g. Paint, Beverages)"
                            id="new_cat_input"
                            className="w-full h-8 px-2.5 text-xs border border-slate-300 rounded-lg mb-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                            onKeyDown={async (e) => {
                              if (e.key === "Enter") {
                                const val = (e.target as HTMLInputElement).value.trim();
                                if (val) {
                                  try {
                                    const res = await inventoryApi.createCategory({ name: val });
                                    const newCat = res.category || res;
                                    setCategories(prev => [...prev, newCat]);
                                    setCurrentForm(prev => ({ ...prev, category_id: newCat.id, category: newCat.name }));
                                    setCatPopoverOpen(false);
                                    toast.success(`Category "${val}" created!`);
                                  } catch (err: any) { toast.error(err.message || "Failed to create category"); }
                                }
                              }
                            }}
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={async () => {
                                const input = document.getElementById("new_cat_input") as HTMLInputElement;
                                const val = input?.value?.trim();
                                if (val) {
                                  try {
                                    const res = await inventoryApi.createCategory({ name: val });
                                    const newCat = res.category || res;
                                    setCategories(prev => [...prev, newCat]);
                                    setCurrentForm(prev => ({ ...prev, category_id: newCat.id, category: newCat.name }));
                                    setCatPopoverOpen(false);
                                    toast.success(`Category "${val}" created!`);
                                  } catch (err: any) { toast.error(err.message || "Failed to create category"); }
                                }
                              }}
                              className="h-7 px-3 text-[11px] font-bold gradient-brand text-white rounded-lg border-0"
                            >
                              Add Category
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Sub Category */}
                    <div className="relative">
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Sub Category
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <select
                            name="sub_category"
                            value={currentForm.sub_category || ""}
                            onChange={handleFormChange}
                            className="w-full h-10 px-3 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                          >
                            <option value="">-- Select Sub Category --</option>
                            {categories
                              .filter(c => Boolean(c.parent_id) && (!currentForm.category_id || c.parent_id === currentForm.category_id))
                              .map((sc) => (
                                <option key={sc.id} value={sc.name}>
                                  {sc.name}
                                </option>
                              ))}
                          </select>
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={() => setSubCatPopoverOpen(!subCatPopoverOpen)}
                          className="h-10 w-10 shrink-0 rounded-xl"
                          title="Add New Sub-Category"
                        >
                          <Plus className="size-4" />
                        </Button>
                      </div>

                      {subCatPopoverOpen && (
                        <div className="absolute top-full mt-2 left-0 w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-30">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-800">
                              New Sub-Category {currentForm.category ? `for ${currentForm.category}` : ""}
                            </span>
                            <button type="button" onClick={() => setSubCatPopoverOpen(false)} className="text-slate-400 hover:text-slate-600">
                              <X className="size-3.5" />
                            </button>
                          </div>
                          <input
                            type="text"
                            placeholder="Sub-Category Name (e.g. Interior Primers)"
                            id="new_sub_cat_input"
                            className="w-full h-8 px-2.5 text-xs border border-slate-300 rounded-lg mb-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                            onKeyDown={async (e) => {
                              if (e.key === "Enter") {
                                const val = (e.target as HTMLInputElement).value.trim();
                                if (val) {
                                  try {
                                    const res = await inventoryApi.createCategory({
                                      name: val,
                                      parent_id: currentForm.category_id || undefined,
                                    });
                                    const newSub = res.category || res;
                                    setCategories(prev => [...prev, newSub]);
                                    setCurrentForm(prev => ({ ...prev, sub_category: val }));
                                    setSubCatPopoverOpen(false);
                                    toast.success(`Sub-Category "${val}" created!`);
                                  } catch (err: any) {
                                    toast.error(err.message || "Failed to create sub-category");
                                  }
                                }
                              }
                            }}
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={async () => {
                                const input = document.getElementById("new_sub_cat_input") as HTMLInputElement;
                                const val = input?.value?.trim();
                                if (val) {
                                  try {
                                    const res = await inventoryApi.createCategory({
                                      name: val,
                                      parent_id: currentForm.category_id || undefined,
                                    });
                                    const newSub = res.category || res;
                                    setCategories(prev => [...prev, newSub]);
                                    setCurrentForm(prev => ({ ...prev, sub_category: val }));
                                    setSubCatPopoverOpen(false);
                                    toast.success(`Sub-Category "${val}" created!`);
                                  } catch (err: any) {
                                    toast.error(err.message || "Failed to create sub-category");
                                  }
                                }
                              }}
                              className="h-7 px-3 text-[11px] font-bold gradient-brand text-white rounded-lg border-0"
                            >
                              Add Sub-Category
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Brand */}
                    <div className="relative">
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Brand
                      </label>
                      <div className="flex gap-2">
                        <select
                          name="brand_id"
                          value={currentForm.brand_id}
                          onChange={(e) => {
                            const bId = e.target.value;
                            const b = brands.find(x => x.id === bId);
                            setCurrentForm(prev => ({ ...prev, brand_id: bId, brand: b ? b.name : "" }));
                          }}
                          className="w-full h-10 px-3 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          <option value="">Select Brand</option>
                          {brands.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={() => setBrandPopoverOpen(!brandPopoverOpen)}
                          className="h-10 w-10 shrink-0 rounded-xl"
                        >
                          <Plus className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Measuring Units */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Base Unit of Measure (UOM)
                      </label>
                      <select
                        name="uom_id"
                        value={currentForm.uom_id}
                        onChange={handleFormChange}
                        className="w-full h-10 px-3 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="">Select Unit</option>
                        {uoms.map((u) => (
                          <option key={u.id} value={u.id}>{u.name} ({u.symbol || u.short_name || u.name})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Sales Measuring Unit
                      </label>
                      <input
                        type="text"
                        name="sales_measuring_unit"
                        value={(currentForm as any).sales_measuring_unit || ""}
                        onChange={handleFormChange}
                        placeholder="e.g. Litre, Can, Pcs, Box"
                        className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Purchase Measuring Unit
                      </label>
                      <input
                        type="text"
                        name="purchase_measuring_unit"
                        value={(currentForm as any).purchase_measuring_unit || ""}
                        onChange={handleFormChange}
                        placeholder="e.g. Carton, Drum, Litre"
                        className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Images & Display Index */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Item Image URL
                      </label>
                      <input
                        type="text"
                        name="image_url"
                        value={currentForm.image_url}
                        onChange={handleFormChange}
                        placeholder="https://.../image.jpg"
                        className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Category Image URL
                      </label>
                      <input
                        type="text"
                        name="category_image"
                        value={(currentForm as any).category_image || ""}
                        onChange={handleFormChange}
                        placeholder="https://.../cat.jpg"
                        className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Display Index (Catalog Sort)
                      </label>
                      <input
                        type="number"
                        name="display_index"
                        value={(currentForm as any).display_index || ""}
                        onChange={handleFormChange}
                        placeholder="e.g. 1, 2, 10"
                        className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PRICING & TAX */}
              {activeModalTab === "pricing" && (
                <div className="space-y-6">
                  {/* Retail Sales Price, Tax Mode & MRP */}
                  <div className="p-5 rounded-2xl bg-indigo-50/40 border border-indigo-100 space-y-4">
                    <span className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider block">
                      Primary Retail Selling Price & GST
                    </span>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Sales Price (Selling Rate) <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            name="selling_price"
                            required
                            value={currentForm.selling_price}
                            onChange={handleFormChange}
                            placeholder="0.00"
                            className="w-full h-10 pl-7 pr-3 text-sm font-black rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Sales Tax Mode
                        </label>
                        <select
                          name="is_tax_inclusive"
                          value={(currentForm as any).is_tax_inclusive !== false ? "inclusive" : "exclusive"}
                          onChange={(e) => {
                            setCurrentForm(prev => ({
                              ...prev,
                              is_tax_inclusive: e.target.value === "inclusive"
                            }));
                          }}
                          className="w-full h-10 px-3 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          <option value="inclusive">Tax Inclusive (Price includes GST)</option>
                          <option value="exclusive">Tax Exclusive (GST added on top)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Sales GST (%)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          name="tax_percent"
                          value={currentForm.tax_percent}
                          onChange={handleFormChange}
                          placeholder="e.g. 18"
                          className="w-full h-10 px-3 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          MRP (Maximum Retail Price)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            name="mrp"
                            value={currentForm.mrp}
                            onChange={handleFormChange}
                            placeholder="0.00"
                            className="w-full h-10 pl-7 pr-3 text-xs font-bold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          HSN / SAC Code
                        </label>
                        <input
                          type="text"
                          name="hsn_code"
                          value={currentForm.hsn_code}
                          onChange={handleFormChange}
                          placeholder="e.g. 32091000"
                          className="w-full h-10 px-3 text-xs font-mono rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Sales Tax Name
                        </label>
                        <input
                          type="text"
                          name="sales_tax_name"
                          value={(currentForm as any).sales_tax_name || "GST"}
                          onChange={handleFormChange}
                          placeholder="e.g. GST, IGST, VAT"
                          className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                    </div>

                    {/* Discounts */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 border-t border-indigo-100">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Disc1 (%) Max Discount Percent
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          name="discount_limit"
                          value={currentForm.discount_limit}
                          onChange={handleFormChange}
                          placeholder="e.g. 5"
                          className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Disc1 (Rs) Fixed Discount Amount
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          name="discount_amount"
                          value={(currentForm as any).discount_amount || ""}
                          onChange={handleFormChange}
                          placeholder="0.00"
                          className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Multi-Tier Rates (Wholesale, B2B, Distributor) */}
                  <div className="space-y-4">
                    <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">
                      Multi-Tier B2B & Wholesale Rates
                    </span>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Wholesale */}
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                        <span className="text-xs font-bold text-slate-800 block border-b pb-1">Wholesale Tier</span>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Wholesale Price</label>
                          <input
                            type="number"
                            step="0.01"
                            name="wholesale_price"
                            value={currentForm.wholesale_price}
                            onChange={handleFormChange}
                            placeholder="0.00"
                            className="w-full h-9 px-3 text-xs font-bold rounded-lg border bg-white outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Min Wholesale Qty</label>
                          <input
                            type="number"
                            name="min_wholesale_qty"
                            value={currentForm.min_wholesale_qty}
                            onChange={handleFormChange}
                            placeholder="e.g. 5"
                            className="w-full h-9 px-3 text-xs rounded-lg border bg-white outline-none"
                          />
                        </div>
                      </div>

                      {/* B2B */}
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                        <span className="text-xs font-bold text-slate-800 block border-b pb-1">B2B Tier</span>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">B2B Price</label>
                          <input
                            type="number"
                            step="0.01"
                            name="b2b_price"
                            value={currentForm.b2b_price}
                            onChange={handleFormChange}
                            placeholder="0.00"
                            className="w-full h-9 px-3 text-xs font-bold rounded-lg border bg-white outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Min B2B Qty</label>
                          <input
                            type="number"
                            name="min_b2b_qty"
                            value={(currentForm as any).min_b2b_qty || ""}
                            onChange={handleFormChange}
                            placeholder="e.g. 10"
                            className="w-full h-9 px-3 text-xs rounded-lg border bg-white outline-none"
                          />
                        </div>
                      </div>

                      {/* Distributor */}
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                        <span className="text-xs font-bold text-slate-800 block border-b pb-1">Distributor Tier</span>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Distributor Price</label>
                          <input
                            type="number"
                            step="0.01"
                            name="distributor_price"
                            value={(currentForm as any).distributor_price || ""}
                            onChange={handleFormChange}
                            placeholder="0.00"
                            className="w-full h-9 px-3 text-xs font-bold rounded-lg border bg-white outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Min Distributor Qty</label>
                          <input
                            type="number"
                            name="min_distributor_qty"
                            value={(currentForm as any).min_distributor_qty || ""}
                            onChange={handleFormChange}
                            placeholder="e.g. 25"
                            className="w-full h-9 px-3 text-xs rounded-lg border bg-white outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Realtime Billing Summary Card */}
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-emerald-900 block">Calculated Customer Billing Total</span>
                      <span className="text-[11px] text-emerald-700">
                        {isSalesTaxIncl ? "Tax is inclusive in sales price" : `+${sTaxPct}% GST added to sales price`}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-emerald-950">₹{computedSalesTotal.toFixed(2)}</span>
                      <span className="text-[10px] text-emerald-700 block font-semibold">(GST component: ₹{computedSalesTaxAmt.toFixed(2)})</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: PURCHASING & VENDOR */}
              {activeModalTab === "purchasing" && (
                <div className="space-y-6">
                  {/* Purchase Price & Tax */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                    <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block">
                      Cost & Purchase Tax Settings
                    </span>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Purchase Price (Cost Rate)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            name="purchase_price"
                            value={currentForm.purchase_price}
                            onChange={handleFormChange}
                            placeholder="0.00"
                            className="w-full h-10 pl-7 pr-3 text-sm font-bold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Purchase Tax Mode
                        </label>
                        <select
                          name="is_purchase_tax_inclusive"
                          value={(currentForm as any).is_purchase_tax_inclusive !== false ? "inclusive" : "exclusive"}
                          onChange={(e) => {
                            setCurrentForm(prev => ({
                              ...prev,
                              is_purchase_tax_inclusive: e.target.value === "inclusive"
                            }));
                          }}
                          className="w-full h-10 px-3 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          <option value="inclusive">Tax Inclusive (Cost includes GST)</option>
                          <option value="exclusive">Tax Exclusive (GST added to Cost)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Purchase Tax (%)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          name="purchase_tax_percent"
                          value={(currentForm as any).purchase_tax_percent || ""}
                          onChange={handleFormChange}
                          placeholder="e.g. 18"
                          className="w-full h-10 px-3 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Purchase Tax Name
                        </label>
                        <input
                          type="text"
                          name="purchase_tax_name"
                          value={(currentForm as any).purchase_tax_name || "GST"}
                          onChange={handleFormChange}
                          placeholder="e.g. GST"
                          className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Purchase Price After Tax
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          name="purchase_price_after_tax"
                          value={(currentForm as any).purchase_price_after_tax || ""}
                          onChange={handleFormChange}
                          placeholder="0.00"
                          className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Vendor & Invoicing */}
                  <div className="space-y-4">
                    <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">
                      Supplier & Inbound Invoicing Details
                    </span>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Supplier Name
                        </label>
                        <input
                          type="text"
                          name="supplier"
                          value={currentForm.supplier}
                          onChange={handleFormChange}
                          placeholder="e.g. Asian Paints Distribution Ltd"
                          className="w-full h-10 px-3.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Preferred Supplier
                        </label>
                        <input
                          type="text"
                          name="preferred_supplier"
                          value={(currentForm as any).preferred_supplier || ""}
                          onChange={handleFormChange}
                          placeholder="e.g. Asian Paints Main Hub"
                          className="w-full h-10 px-3.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Supplier Invoice Number
                        </label>
                        <input
                          type="text"
                          name="supplier_invoice_number"
                          value={(currentForm as any).supplier_invoice_number || ""}
                          onChange={handleFormChange}
                          placeholder="e.g. INV-AP-2026-001"
                          className="w-full h-10 px-3 text-xs font-mono rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Supplier Invoice Date
                        </label>
                        <input
                          type="date"
                          name="supplier_invoice_date"
                          value={(currentForm as any).supplier_invoice_date || ""}
                          onChange={handleFormChange}
                          className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Item Received Date
                        </label>
                        <input
                          type="date"
                          name="item_received_date"
                          value={(currentForm as any).item_received_date || ""}
                          onChange={handleFormChange}
                          className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: STOCK, WAREHOUSE & BATCHES */}
              {activeModalTab === "inventory" && (
                <div className="space-y-6">
                  {/* Stock Levels */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Opening Stock
                      </label>
                      <input
                        type="number"
                        name="initial_stock"
                        value={currentForm.initial_stock}
                        onChange={handleFormChange}
                        placeholder="0"
                        className="w-full h-10 px-3.5 text-sm font-bold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Current Stock
                      </label>
                      <input
                        type="number"
                        name="stock"
                        value={(currentForm as any).stock || ""}
                        onChange={handleFormChange}
                        placeholder="0"
                        className="w-full h-10 px-3.5 text-sm font-bold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Stock Alert (Reorder Level)
                      </label>
                      <input
                        type="number"
                        name="reorder_level"
                        value={currentForm.reorder_level}
                        onChange={handleFormChange}
                        placeholder="10"
                        className="w-full h-10 px-3.5 text-sm font-bold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Safety Stock
                      </label>
                      <input
                        type="number"
                        name="safety_stock"
                        value={currentForm.safety_stock}
                        onChange={handleFormChange}
                        placeholder="5"
                        className="w-full h-10 px-3.5 text-sm font-bold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Warehouse Location & Dates */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Warehouse Name
                      </label>
                      <select
                        name="warehouse"
                        value={currentForm.warehouse}
                        onChange={handleFormChange}
                        className="w-full h-10 px-3 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="">Select Warehouse</option>
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.name}>{w.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Location in Warehouse (Rack / Bin)
                      </label>
                      <input
                        type="text"
                        name="location_in_warehouse"
                        value={(currentForm as any).location_in_warehouse || ""}
                        onChange={handleFormChange}
                        placeholder="e.g. Aisle-4-Rack-2-Bin-10"
                        className="w-full h-10 px-3.5 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Manufacturing & Expiry */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Manufacturing Date
                      </label>
                      <input
                        type="date"
                        name="mfg_date"
                        value={(currentForm as any).mfg_date || ""}
                        onChange={handleFormChange}
                        className="w-full h-10 px-3.5 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Expiry Date
                      </label>
                      <input
                        type="date"
                        name="expiry_date"
                        value={(currentForm as any).expiry_date || ""}
                        onChange={handleFormChange}
                        className="w-full h-10 px-3.5 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Batch Tracking Card */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block">
                          Batch Management & Expiry Tracking
                        </span>
                        <span className="text-[11px] text-slate-500">Enable manual batch tracking for this product</span>
                      </div>
                      <label className="flex items-center gap-2 text-xs font-bold text-indigo-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean((currentForm as any).has_manual_batch)}
                          onChange={(e) => {
                            setCurrentForm(prev => ({
                              ...prev,
                              has_manual_batch: e.target.checked
                            }));
                          }}
                          className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        Has Manual Batch
                      </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Stock Batch Number</label>
                        <input
                          type="text"
                          name="stock_batch_number"
                          value={(currentForm as any).stock_batch_number || ""}
                          onChange={handleFormChange}
                          placeholder="e.g. BATCH-2026-01"
                          className="w-full h-9 px-3 text-xs font-mono rounded-lg border bg-white outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Stock Batch Expiry Date</label>
                        <input
                          type="date"
                          name="stock_batch_expiry_date"
                          value={(currentForm as any).stock_batch_expiry_date || ""}
                          onChange={handleFormChange}
                          className="w-full h-9 px-3 text-xs rounded-lg border bg-white outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Opening Stock Batch Number</label>
                        <input
                          type="text"
                          name="opening_stock_batch_number"
                          value={(currentForm as any).opening_stock_batch_number || ""}
                          onChange={handleFormChange}
                          placeholder="e.g. OP-BATCH-01"
                          className="w-full h-9 px-3 text-xs font-mono rounded-lg border bg-white outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Opening Stock Batch Expiry Date</label>
                        <input
                          type="date"
                          name="opening_stock_batch_expiry_date"
                          value={(currentForm as any).opening_stock_batch_expiry_date || ""}
                          onChange={handleFormChange}
                          className="w-full h-9 px-3 text-xs rounded-lg border bg-white outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: FLAGS & OPERATIONS */}
              {activeModalTab === "operations" && (
                <div className="space-y-6">
                  {/* Boolean Switches Grid */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block mb-3">
                      Operational Flags & Portal Rules
                    </span>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={(currentForm as any).status === "active"}
                          onChange={(e) => setCurrentForm(prev => ({ ...prev, status: e.target.checked ? "active" : "inactive" }))}
                          className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">Is Active Product</span>
                          <span className="text-[10px] text-slate-500">Available for catalog display and sales</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={Boolean((currentForm as any).is_service_item)}
                          onChange={(e) => setCurrentForm(prev => ({ ...prev, is_service_item: e.target.checked }))}
                          className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">Is Service Item</span>
                          <span className="text-[10px] text-slate-500">Non-inventory labour, delivery, or service item</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={Boolean((currentForm as any).not_for_sale)}
                          onChange={(e) => setCurrentForm(prev => ({ ...prev, not_for_sale: e.target.checked }))}
                          className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">Not For Sale</span>
                          <span className="text-[10px] text-slate-500">Internal consumable, demo, or raw material</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={(currentForm as any).need_to_print_barcode_sticker !== false}
                          onChange={(e) => setCurrentForm(prev => ({ ...prev, need_to_print_barcode_sticker: e.target.checked }))}
                          className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">Need To Print Barcode Sticker</span>
                          <span className="text-[10px] text-slate-500">Include in queue for thermal barcode printing</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={Boolean((currentForm as any).only_for_portal)}
                          onChange={(e) => setCurrentForm(prev => ({ ...prev, only_for_portal: e.target.checked }))}
                          className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">Only For Portal</span>
                          <span className="text-[10px] text-slate-500">Exclusive to B2B eCommerce client portal</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={Boolean((currentForm as any).not_for_portal)}
                          onChange={(e) => setCurrentForm(prev => ({ ...prev, not_for_portal: e.target.checked }))}
                          className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">Not For Portal</span>
                          <span className="text-[10px] text-slate-500">POS and retail in-store only</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Hardware Scale & Conversion */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Weighing Scale Item Code
                      </label>
                      <input
                        type="text"
                        name="weighing_scale_code"
                        value={(currentForm as any).weighing_scale_code || ""}
                        onChange={handleFormChange}
                        placeholder="e.g. WS-102"
                        className="w-full h-10 px-3.5 text-xs font-mono rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Conversion Factor
                      </label>
                      <input
                        type="text"
                        name="conversion_factor"
                        value={(currentForm as any).conversion_factor || "1"}
                        onChange={handleFormChange}
                        placeholder="e.g. 1, 10, 1000"
                        className="w-full h-10 px-3.5 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Label Headings & Keywords */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Label Headings
                      </label>
                      <input
                        type="text"
                        name="label_headings"
                        value={(currentForm as any).label_headings || ""}
                        onChange={handleFormChange}
                        placeholder="e.g. Premium High Sheen Interior"
                        className="w-full h-10 px-3.5 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Search Keywords
                      </label>
                      <input
                        type="text"
                        name="keywords"
                        value={(currentForm as any).keywords || ""}
                        onChange={handleFormChange}
                        placeholder="e.g. paint, emulsion, washable, white"
                        className="w-full h-10 px-3.5 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      Accessories & Cross-Sell Keywords
                    </label>
                    <input
                      type="text"
                      name="accessories_keyword"
                      value={(currentForm as any).accessories_keyword || ""}
                      onChange={handleFormChange}
                      placeholder="e.g. paint roller, wall primer, masking tape, sandpaper"
                      className="w-full h-10 px-3.5 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* TAB 6: DESCRIPTIONS & CUSTOM SPECS */}
              {activeModalTab === "other" && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      Short Description
                    </label>
                    <textarea
                      name="short_description"
                      value={currentForm.short_description || ""}
                      onChange={handleFormChange}
                      rows={3}
                      placeholder="Concise summary for invoices and POS display"
                      className="w-full p-3 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      Description HTML / Rich Content
                    </label>
                    <textarea
                      name="description_html"
                      value={(currentForm as any).description_html || ""}
                      onChange={handleFormChange}
                      rows={4}
                      placeholder="<p>Full rich HTML formatted product details...</p>"
                      className="w-full p-3 text-xs font-mono rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      Long Description
                    </label>
                    <textarea
                      name="long_description"
                      value={currentForm.long_description || ""}
                      onChange={handleFormChange}
                      rows={4}
                      placeholder="Comprehensive product specifications, user guides, or warranty info"
                      className="w-full p-3 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    />
                  </div>

                  {/* Dynamic Key-Value Custom Specifications */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 block">
                          Dynamic Custom Specifications
                        </span>
                        <span className="text-[11px] text-slate-500">Add any custom key-value attributes</span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCurrentForm(prev => ({
                            ...prev,
                            custom_fields: [...((prev as any).custom_fields || []), { key: "", value: "" }]
                          }));
                        }}
                        className="h-8 text-xs font-bold text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100"
                      >
                        <Plus className="size-3.5 mr-1" /> Add Custom Field
                      </Button>
                    </div>

                    {((currentForm as any).custom_fields || []).length === 0 ? (
                      <div className="p-6 text-center bg-white rounded-xl border border-dashed border-slate-300 text-xs text-slate-500">
                        No custom fields added yet. Click &quot;Add Custom Field&quot; to add specifications like Finish, Coverage, Thinner, Warranty, etc.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {((currentForm as any).custom_fields || []).map((f: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-200">
                            <input
                              type="text"
                              placeholder="Attribute Name (e.g. Finish, Coverage)"
                              value={f.key}
                              onChange={(e) => {
                                const updated = [...(currentForm as any).custom_fields];
                                updated[idx].key = e.target.value;
                                setCurrentForm(prev => ({ ...prev, custom_fields: updated }));
                              }}
                              className="flex-1 h-9 px-3 text-xs font-semibold rounded-lg border bg-slate-50 focus:bg-white outline-none"
                            />
                            <input
                              type="text"
                              placeholder="Value (e.g. High Gloss, 120 sq.ft/L)"
                              value={f.value}
                              onChange={(e) => {
                                const updated = [...(currentForm as any).custom_fields];
                                updated[idx].value = e.target.value;
                                setCurrentForm(prev => ({ ...prev, custom_fields: updated }));
                              }}
                              className="flex-1 h-9 px-3 text-xs rounded-lg border bg-slate-50 focus:bg-white outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const updated = (currentForm as any).custom_fields.filter((_: any, i: number) => i !== idx);
                                setCurrentForm(prev => ({ ...prev, custom_fields: updated }));
                              }}
                              className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 7: BILLED INVOICES HISTORY */}
              {activeModalTab === "billed_invoices" && (
                <div className="space-y-6">
                  {/* Summary Metric Cards */}
                  {(() => {
                    const totalQty = productInvoices.reduce((sum, inv) => sum + inv.quantity, 0);
                    const totalRevenue = productInvoices.reduce((sum, inv) => sum + inv.total, 0);
                    const avgRate = totalQty > 0 ? totalRevenue / totalQty : 0;

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 shadow-sm">
                          <span className="text-[10px] font-extrabold uppercase text-indigo-600 tracking-wider block mb-1">
                            Total Invoices Billed
                          </span>
                          <span className="text-2xl font-black text-slate-900">{productInvoices.length}</span>
                        </div>

                        <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 shadow-sm">
                          <span className="text-[10px] font-extrabold uppercase text-emerald-600 tracking-wider block mb-1">
                            Total Units Invoiced
                          </span>
                          <span className="text-2xl font-black text-emerald-800">{totalQty.toLocaleString()} {currentForm.uom_id || 'Units'}</span>
                        </div>

                        <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 shadow-sm">
                          <span className="text-[10px] font-extrabold uppercase text-blue-600 tracking-wider block mb-1">
                            Total Billed Revenue
                          </span>
                          <span className="text-2xl font-black text-blue-900">{formatCurrency(totalRevenue)}</span>
                        </div>

                        <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-100 shadow-sm">
                          <span className="text-[10px] font-extrabold uppercase text-amber-700 tracking-wider block mb-1">
                            Avg Selling Rate
                          </span>
                          <span className="text-2xl font-black text-amber-900">{formatCurrency(avgRate)}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Table of Billed Invoices */}
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Receipt className="size-4 text-indigo-600" />
                        <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                          Sales Invoices Billed with "{currentForm.name || 'this Product'}"
                        </h4>
                      </div>
                      <span className="text-xs font-bold text-slate-500">
                        {productInvoices.length} Record{productInvoices.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    {loadingInvoices ? (
                      <div className="p-12 text-center text-slate-400 text-xs font-semibold flex items-center justify-center gap-2">
                        <Loader2 className="size-4 animate-spin text-indigo-600" /> Fetching billed invoice history...
                      </div>
                    ) : productInvoices.length === 0 ? (
                      <div className="p-12 text-center text-slate-400 text-xs font-semibold">
                        No sales invoices have been billed for this product yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b sticky top-0 z-10">
                            <tr>
                              <th className="px-4 py-3">Invoice Number</th>
                              <th className="px-4 py-3">Date & Time</th>
                              <th className="px-4 py-3">Customer</th>
                              <th className="px-4 py-3 text-right">Billed Qty</th>
                              <th className="px-4 py-3 text-right">Unit Price</th>
                              <th className="px-4 py-3 text-right">Total Amount</th>
                              <th className="px-4 py-3 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {productInvoices.map((inv, i) => (
                              <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-4 py-3 font-mono font-bold text-indigo-600">
                                  {inv.invoice_number || `INV-${inv.invoice_id?.slice(0, 8)}`}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                  {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : '—'}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-bold text-slate-800">{inv.customer_name}</div>
                                  <div className="text-[10px] text-slate-400">{inv.customer_phone}</div>
                                </td>
                                <td className="px-4 py-3 text-right font-black text-slate-900">
                                  {inv.quantity} {currentForm.uom_id || 'Pcs'}
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-semibold text-slate-700">
                                  {formatCurrency(inv.unit_price)}
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-black text-emerald-600">
                                  {formatCurrency(inv.total)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    inv.status === 'Paid' || inv.status === 'Completed'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-blue-100 text-blue-700'
                                  }`}>
                                    {inv.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-slate-50 flex items-center justify-between shrink-0">
              <Button
                type="button"
                variant="outline"
                className="h-10 px-5 rounded-xl font-bold bg-white hover:bg-slate-100"
                onClick={() => { setIsModalOpen(false); setEditingProductId(null); setCurrentForm(defaultFormData()); setActiveModalTab("basic"); }}
              >
                Cancel
              </Button>
              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-10 px-6 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all border-0"
                >
                  {isSubmitting ? "Saving..." : editingProductId ? "Update Product" : "Save Product"}
                </Button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════
  //  RENDER: Local product table row renderer (Handles all 65 Columns)
  // ══════════════════════════════════════════════════════════════════
  const renderLocalRow = (product: InventoryProduct, visible: string[], isExact = false) => {
    const specs = (product.specifications && typeof product.specifications === 'object') ? product.specifications : {};

    return (
      <tr
        key={product.id}
        className={`hover:bg-slate-50/80 transition-colors border-b border-slate-100 text-xs text-slate-700 ${
          isExact ? "bg-amber-50/40 font-semibold" : ""
        }`}
      >
        {visible.map((colId) => {
          switch (colId) {
            case "image":
              return (
                <td key={colId} className="py-2.5 px-3 whitespace-nowrap">
                  <div
                    onClick={() => {
                      if (product.image_url) {
                        setSelectedImagePreview({
                          url: resolveImageUrl(product.image_url),
                          name: product.name,
                          sku: product.sku
                        });
                      }
                    }}
                    className={`size-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden transition-all ${
                      product.image_url ? "cursor-pointer hover:ring-2 hover:ring-indigo-500 hover:scale-110 shadow-sm" : ""
                    }`}
                    title={product.image_url ? "Click to view full image" : "No image available"}
                  >
                    {product.image_url ? (
                      <img src={resolveImageUrl(product.image_url)} alt={product.name} className="size-full object-cover" />
                    ) : (
                      <Package className="size-4 text-slate-400" />
                    )}
                  </div>
                </td>
              );

            case "name":
              return (
                <td key={colId} className="py-2.5 px-3 font-bold text-slate-900 min-w-[200px]">
                  <div className="flex flex-col">
                    <span className="truncate">{product.name}</span>
                    {specs.unique_item_name && specs.unique_item_name !== product.name && (
                      <span className="text-[10px] text-slate-400 font-normal truncate">{specs.unique_item_name}</span>
                    )}
                  </div>
                </td>
              );

            case "unique_item_name":
              return (
                <td key={colId} className="py-2.5 px-3 font-semibold text-slate-700 max-w-[220px] truncate">
                  {specs.unique_item_name || product.name || "-"}
                </td>
              );

            case "sku":
              return (
                <td key={colId} className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                  {product.sku || "-"}
                </td>
              );

            case "barcode":
              return (
                <td key={colId} className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                  {product.barcode ? (
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-800">{product.barcode}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setBarcodeDrawerInitialId(product.id);
                          setIsBarcodeDrawerOpen(true);
                        }}
                        className="p-1 rounded hover:bg-emerald-50 text-emerald-600 transition cursor-pointer"
                        title="Print Barcode Label"
                      >
                        <Printer className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isGeneratingBarcodes}
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          setIsGeneratingBarcodes(true);
                          const res = await inventoryApi.generateBarcode(product.id, "EAN-13");
                          toast.success(`Generated barcode: ${res.barcode}`);
                          await loadData(search);
                        } catch (err: any) {
                          toast.error(err?.detail || err?.message || "Failed to generate barcode");
                        } finally {
                          setIsGeneratingBarcodes(false);
                        }
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Click to auto-generate scannable GS1 EAN-13 barcode"
                    >
                      <Zap className="size-2.5 text-amber-500 fill-amber-500" /> Gen Barcode
                    </button>
                  )}
                </td>
              );

            case "secondary_barcode":
              return (
                <td key={colId} className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                  {specs.secondary_barcode || (product as any).secondary_barcode || "-"}
                </td>
              );

            case "item_code":
              return (
                <td key={colId} className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                  {specs.item_code || (product as any).item_code || "-"}
                </td>
              );

            case "base_name":
              return (
                <td key={colId} className="py-2.5 px-3 whitespace-nowrap">
                  {(product.base_name || specs.base_name) ? (
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      {product.base_name || specs.base_name}
                    </span>
                  ) : "-"}
                </td>
              );

            case "product_base_code":
              return (
                <td key={colId} className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                  {product.product_base_code || specs.product_base_code || "-"}
                </td>
              );

            case "size_l_kg":
              return (
                <td key={colId} className="py-2.5 px-3 whitespace-nowrap">
                  {(product.size_l_kg || specs.size_l_kg) ? (
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {product.size_l_kg || specs.size_l_kg}
                    </span>
                  ) : "-"}
                </td>
              );

            case "category":
              return (
                <td key={colId} className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-700">
                  {product.category_name || "-"}
                </td>
              );

            case "sub_category":
              return (
                <td key={colId} className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-600">
                  {specs.sub_category || (product as any).sub_category || "-"}
                </td>
              );

            case "brand":
              return (
                <td key={colId} className="py-2.5 px-3 whitespace-nowrap font-semibold text-slate-800">
                  {product.brand_name || product.brand || "-"}
                </td>
              );

            case "uom":
              return (
                <td key={colId} className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                  {product.uom_name || "-"}
                </td>
              );

            case "sales_measuring_unit":
              return (
                <td key={colId} className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                  {specs.sales_measuring_unit || product.uom_name || "-"}
                </td>
              );

            case "purchase_measuring_unit":
              return (
                <td key={colId} className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                  {specs.purchase_measuring_unit || product.uom_name || "-"}
                </td>
              );

            case "mrp":
              return (
                <td key={colId} className="py-2.5 px-3 font-semibold text-slate-600 whitespace-nowrap">
                  {product.mrp ? formatCurrency(product.mrp) : "-"}
                </td>
              );

            case "selling_price":
              return (
                <td key={colId} className="py-2.5 px-3 font-black text-slate-900 whitespace-nowrap">
                  {product.selling_price ? formatCurrency(product.selling_price) : "-"}
                </td>
              );

            case "sales_tax_type":
              return (
                <td key={colId} className="py-2.5 px-3 whitespace-nowrap text-[10px] font-semibold text-slate-600">
                  {specs.sales_tax_type || (product.is_tax_inclusive !== false ? "Inclusive" : "Exclusive")}
                </td>
              );

            case "sales_tax_name":
              return (
                <td key={colId} className="py-2.5 px-3 whitespace-nowrap text-[10px] font-semibold text-slate-600">
                  {specs.sales_tax_name || "GST"}
                </td>
              );

            case "tax_percent":
              return (
                <td key={colId} className="py-2.5 px-3 whitespace-nowrap text-slate-600 font-semibold">
                  {product.tax_percent !== undefined && product.tax_percent !== null ? `${product.tax_percent}%` : "-"}
                </td>
              );

            case "sales_price_after_tax":
              return (
                <td key={colId} className="py-2.5 px-3 font-bold text-indigo-700 whitespace-nowrap">
                  {specs.sales_price_after_tax ? formatCurrency(specs.sales_price_after_tax) : (product.selling_price ? formatCurrency(product.selling_price) : "-")}
                </td>
              );

            case "discount_limit":
              return (
                <td key={colId} className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                  {product.discount_limit ? `${product.discount_limit}%` : "-"}
                </td>
              );

            case "discount_amount":
              return (
                <td key={colId} className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                  {specs.discount_amount ? formatCurrency(specs.discount_amount) : "-"}
                </td>
              );

            case "wholesale_price":
              return (
                <td key={colId} className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                  {(product.wholesale_price || specs.wholesale_price) ? formatCurrency(product.wholesale_price || specs.wholesale_price) : "-"}
                </td>
              );

            case "min_wholesale_qty":
              return (
                <td key={colId} className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                  {product.min_wholesale_qty || specs.min_wholesale_qty || "-"}
                </td>
              );

            case "b2b_price":
              return (
                <td key={colId} className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                  {(product.b2b_price || specs.b2b_price) ? formatCurrency(product.b2b_price || specs.b2b_price) : "-"}
                </td>
              );

            case "min_b2b_qty":
              return (
                <td key={colId} className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                  {specs.min_b2b_qty || "-"}
                </td>
              );

            case "distributor_price":
              return (
                <td key={colId} className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                  {specs.distributor_price ? formatCurrency(specs.distributor_price) : "-"}
                </td>
              );

            case "min_distributor_qty":
              return (
                <td key={colId} className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                  {specs.min_distributor_qty || "-"}
                </td>
              );

            case "hsn_code":
              return (
                <td key={colId} className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                  {product.hsn_code || specs.hsn_code || "-"}
                </td>
              );

            case "purchase_price":
              return (
                <td key={colId} className="py-2.5 px-3 font-semibold text-slate-700 whitespace-nowrap">
                  {product.purchase_price ? formatCurrency(product.purchase_price) : "-"}
                </td>
              );

            case "purchase_tax_type":
              return (
                <td key={colId} className="py-2.5 px-3 whitespace-nowrap text-[10px] text-slate-600">
                  {specs.purchase_tax_type || (specs.is_purchase_tax_inclusive !== false ? "Inclusive" : "Exclusive")}
                </td>
              );

            case "purchase_tax_name":
              return (
                <td key={colId} className="py-2.5 px-3 whitespace-nowrap text-[10px] text-slate-600">
                  {specs.purchase_tax_name || "GST"}
                </td>
              );

            case "purchase_tax_percent":
              return (
                <td key={colId} className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                  {specs.purchase_tax_percent ? `${specs.purchase_tax_percent}%` : "-"}
                </td>
              );

            case "purchase_price_after_tax":
              return (
                <td key={colId} className="py-2.5 px-3 font-semibold text-slate-700 whitespace-nowrap">
                  {specs.purchase_price_after_tax ? formatCurrency(specs.purchase_price_after_tax) : "-"}
                </td>
              );

            case "supplier":
              return (
                <td key={colId} className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">
                  {product.supplier || specs.supplier || "-"}
                </td>
              );

            case "preferred_supplier":
              return (
                <td key={colId} className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">
                  {specs.preferred_supplier || product.supplier || "-"}
                </td>
              );

            case "supplier_invoice_number":
              return (
                <td key={colId} className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                  {specs.supplier_invoice_number || "-"}
                </td>
              );

            case "supplier_invoice_date":
              return (
                <td key={colId} className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                  {specs.supplier_invoice_date || "-"}
                </td>
              );

            case "item_received_date":
              return (
                <td key={colId} className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                  {specs.item_received_date || "-"}
                </td>
              );

            case "initial_stock":
              return (
                <td key={colId} className="py-2.5 px-3 font-semibold text-slate-700 whitespace-nowrap">
                  {product.initial_stock ?? 0}
                </td>
              );

            case "stock":
              return (
                <td key={colId} className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                  {product.stock ?? product.initial_stock ?? 0}
                </td>
              );

            case "reorder_level":
              return (
                <td key={colId} className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                  {product.reorder_level ?? 10}
                </td>
              );

            case "safety_stock":
              return (
                <td key={colId} className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                  {product.safety_stock ?? "-"}
                </td>
              );

            case "mfg_date":
              return (
                <td key={colId} className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                  {specs.mfg_date || (product as any).mfg_date || "-"}
                </td>
              );

            case "expiry_date":
              return (
                <td key={colId} className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                  {specs.expiry_date || (product as any).expiry_date || "-"}
                </td>
              );

            case "warehouse":
              return (
                <td key={colId} className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">
                  {product.warehouse || specs.warehouse || "-"}
                </td>
              );

            case "location_in_warehouse":
              return (
                <td key={colId} className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                  {specs.location_in_warehouse || (product as any).location_in_warehouse || "-"}
                </td>
              );

            case "has_manual_batch":
              return (
                <td key={colId} className="py-2.5 px-3 whitespace-nowrap">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    specs.has_manual_batch ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500"
                  }`}>
                    {specs.has_manual_batch ? "YES" : "NO"}
                  </span>
                </td>
              );

            case "stock_batch_number":
              return (
                <td key={colId} className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                  {specs.stock_batch_number || "-"}
                </td>
              );

            case "stock_batch_expiry_date":
              return (
                <td key={colId} className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                  {specs.stock_batch_expiry_date || "-"}
                </td>
              );

            case "opening_stock_batch_number":
              return (
                <td key={colId} className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                  {specs.opening_stock_batch_number || "-"}
                </td>
              );

            case "opening_stock_batch_expiry_date":
              return (
                <td key={colId} className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                  {specs.opening_stock_batch_expiry_date || "-"}
                </td>
              );

            case "status":
              return (
                <td key={colId} className="py-2.5 px-3 whitespace-nowrap">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    product.status === "active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500 border border-slate-200"
                  }`}>
                    {product.status === "active" ? "Active" : "Inactive"}
                  </span>
                </td>
              );

            case "has_label":
              return (
                <td key={colId} className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                  {specs.has_label !== false ? "Yes" : "No"}
                </td>
              );

            case "label_headings":
              return (
                <td key={colId} className="py-2.5 px-3 text-slate-600 max-w-[150px] truncate">
                  {specs.label_headings || "-"}
                </td>
              );

            case "need_to_print_barcode_sticker":
              return (
                <td key={colId} className="py-2.5 px-3 whitespace-nowrap">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    specs.need_to_print_barcode_sticker !== false ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-slate-100 text-slate-500"
                  }`}>
                    {specs.need_to_print_barcode_sticker !== false ? "PRINT" : "NO"}
                  </span>
                </td>
              );

            case "is_service_item":
              return (
                <td key={colId} className="py-2.5 px-3 whitespace-nowrap">
                  {specs.is_service_item ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">SERVICE</span>
                  ) : "-"}
                </td>
              );

            case "not_for_sale":
              return (
                <td key={colId} className="py-2.5 px-3 whitespace-nowrap">
                  {specs.not_for_sale ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">NOT FOR SALE</span>
                  ) : "-"}
                </td>
              );

            case "only_for_portal":
              return (
                <td key={colId} className="py-2.5 px-3 whitespace-nowrap">
                  {specs.only_for_portal ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">PORTAL ONLY</span>
                  ) : "-"}
                </td>
              );

            case "not_for_portal":
              return (
                <td key={colId} className="py-2.5 px-3 whitespace-nowrap">
                  {specs.not_for_portal ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">NO PORTAL</span>
                  ) : "-"}
                </td>
              );

            case "conversion_factor":
              return (
                <td key={colId} className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                  {specs.conversion_factor || "1"}
                </td>
              );

            case "weighing_scale_code":
              return (
                <td key={colId} className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                  {specs.weighing_scale_code || "-"}
                </td>
              );

            case "display_index":
              return (
                <td key={colId} className="py-2.5 px-3 text-slate-600 whitespace-nowrap font-mono">
                  {specs.display_index || "-"}
                </td>
              );

            case "keywords":
              return (
                <td key={colId} className="py-2.5 px-3 text-slate-600 max-w-[150px] truncate">
                  {specs.keywords || "-"}
                </td>
              );

            case "accessories_keyword":
              return (
                <td key={colId} className="py-2.5 px-3 text-slate-600 max-w-[150px] truncate">
                  {specs.accessories_keyword || "-"}
                </td>
              );

            case "short_description":
              return (
                <td key={colId} className="py-2.5 px-3 text-slate-600 max-w-[200px] truncate">
                  {product.short_description || specs.short_description || "-"}
                </td>
              );

            case "description_html":
              return (
                <td key={colId} className="py-2.5 px-3 text-slate-600 max-w-[150px] truncate font-mono text-[10px]">
                  {specs.description_html || "-"}
                </td>
              );

            case "source":
              return (
                <td key={colId} className="py-2.5 px-3 whitespace-nowrap">
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                    Local
                  </span>
                </td>
              );

            default:
              return (
                <td key={colId} className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                  {String(specs[colId] || (product as any)[colId] || "-")}
                </td>
              );
          }
        })}

        {/* Action column */}
        <td className="py-2.5 px-3 whitespace-nowrap text-right sticky right-0 bg-white/95 backdrop-blur-xs border-l border-slate-100 shadow-sm">
          <div className="flex items-center justify-end gap-1.5">
            {product.barcode && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setBarcodeDrawerInitialId(product.id);
                  setIsBarcodeDrawerOpen(true);
                }}
                className="size-8 rounded-lg hover:bg-emerald-50 text-emerald-600"
                title="Print Barcode Label"
              >
                <Printer className="size-3.5" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleEdit(product)}
              className="size-8 rounded-lg hover:bg-slate-100 text-slate-600"
              title="Edit Product"
            >
              <Edit2 className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleDuplicate(product)}
              className="size-8 rounded-lg hover:bg-slate-100 text-slate-600"
              title="Duplicate Product"
            >
              <Copy className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleDelete(product.id)}
              className="size-8 rounded-lg hover:bg-rose-50 text-rose-600"
              title="Delete Product"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </td>
      </tr>
    );
  };
  const renderMasterRow = (item: MasterResult, visible: string[]) => {
    const isAISourced = item.source === "AI_WEB_SEARCH";
    const sourceLabel = isAISourced ? "AI Sourced" : "Global Catalog";
    return (
      <tr key={item.id || Math.random()} className="hover:bg-indigo-50/20 bg-indigo-50/5 transition-colors border-b border-indigo-100/50">
        {MASTER_COLUMNS.filter(c => visible.includes(c.id)).map(col => {
          switch (col.id) {
            case "image":
              return (
                <td key="image" className="px-6 py-4">
                  {item.image_url ? (
                    <img src={resolveImageUrl(item.image_url)} alt={item.name}
                      onClick={() => setPreviewImage(resolveImageUrl(item.image_url))}
                      className="size-10 rounded-lg object-cover border bg-white cursor-zoom-in hover:opacity-90 transition-opacity" />
                  ) : (
                    <div className="size-10 rounded-lg bg-indigo-100/30 flex items-center justify-center shrink-0">
                      <Globe className="size-5 text-indigo-500" />
                    </div>
                  )}
                </td>
              );
            case "name":
              return (
                <td key="name" className="px-6 py-4 font-bold text-indigo-950">
                  <div>{item.name}</div>
                  <div className="text-[10px] text-indigo-500 font-semibold uppercase mt-0.5">{sourceLabel}</div>
                </td>
              );
            case "sku":
              return <td key="sku" className="px-6 py-4 font-mono font-bold text-xs text-indigo-900">{item.sku_code || '-'}</td>;
            case "barcode":
              return <td key="barcode" className="px-6 py-4 font-mono text-xs text-indigo-750">{item.barcode || '-'}</td>;
            case "base_name":
              return <td key="base_name" className="px-6 py-4 text-xs font-semibold text-indigo-900">{item.base_name || '-'}</td>;
            case "product_base_code":
              return <td key="product_base_code" className="px-6 py-4 text-xs font-mono text-indigo-800">{item.product_base_code || '-'}</td>;
            case "size_l_kg":
              return <td key="size_l_kg" className="px-6 py-4 text-xs font-bold text-indigo-700">{item.size_l_kg || '-'}</td>;
            case "category":
              return <td key="category" className="px-6 py-4 text-xs text-indigo-800">{item.category_name || item.category || '-'}</td>;
            case "brand":
              return <td key="brand" className="px-6 py-4 text-xs text-indigo-800">{item.brand_name || item.brand || '-'}</td>;
            case "mrp":
              return <td key="mrp" className="px-6 py-4 font-bold text-indigo-950">{formatCurrency(item.mrp)}</td>;
            case "selling_price":
              return <td key="selling_price" className="px-6 py-4 text-indigo-800">{formatCurrency(item.sale_price)}</td>;
            case "wholesale_price":
              return <td key="wholesale_price" className="px-6 py-4 text-indigo-800">{formatCurrency(item.wholesale_price || 0)}</td>;
            case "b2b_price": {
              const bVal = (item as any).b2b_price ?? (item as any).specifications?.b2b_price ?? 0;
              return <td key="b2b_price" className="px-6 py-4 text-indigo-800 font-semibold">{formatCurrency(bVal)}</td>;
            }
            case "specifications":
              return <td key="specifications" className="px-6 py-4 text-xs text-indigo-800 max-w-xs truncate">{item.specifications || '-'}</td>;
            case "source":
              return (
                <td key="source" className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[10px] ${isAISourced ? "bg-amber-500/10 text-amber-600" : "bg-indigo-500/10 text-indigo-600"}`}>
                    <Sparkles className="size-3" /> {sourceLabel}
                  </span>
                </td>
              );
            default:
              return null;
          }
        })}
        <td className="px-6 py-4 text-right">
          {(item.barcode && localBarcodes.has(item.barcode)) || localNames.has(item.name.toLowerCase()) ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <CheckCircle className="size-3" /> In Inventory
            </span>
          ) : (
            <Button variant="default" size="sm" className="h-7 text-[11px] font-bold"
              onClick={() => setPreviewItem(item)}>
              <ShoppingCart className="size-3 mr-1" /> Import
            </Button>
          )}
        </td>
      </tr>
    );
  };

  // ══════════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════════
  const hasSearch = search.trim().length >= 2;
  const showLocalResults = fuzzyLocalResults.length > 0;
  const showMasterResults = uniqueMasterResults.length > 0;
  const hasNoResults = hasSearch && !exactMatch && !showLocalResults && !showMasterResults && !isSearchingMaster;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Products</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your inventory products and browse the global master catalog.
          </p>
        </div>
        <div className="flex gap-2">
          <input type="file" accept=".csv,.xlsx,.xls" ref={fileInputRef} onChange={handleImportFile} className="hidden" />
          <Button variant="outline" className="hidden lg:flex text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200" onClick={handleDownloadSample}>
            <Download className="size-4 mr-2" /> Sample Excel
          </Button>
          <Button variant="outline" className="hidden lg:flex" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            <Upload className="size-4 mr-2" /> {isImporting ? "Importing..." : "Import File"}
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={fuzzyLocalResults.length === 0}>
            <Download className="size-4 mr-2" /> Export
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsBarcodeDrawerOpen(true)}
            className="flex items-center gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          >
            <Printer className="size-4" /> Print Barcodes
          </Button>
          {missingBarcodesCount > 0 && (
            <Button
              variant="outline"
              disabled={isGeneratingBarcodes}
              onClick={async () => {
                try {
                  setIsGeneratingBarcodes(true);
                  const res = await inventoryApi.generateBulkBarcodes("EAN-13");
                  toast.success(res.message || `Generated ${res.generated_count} barcodes`);
                  await loadData(search);
                } catch (err: any) {
                  toast.error(err?.detail || err?.message || "Failed to bulk generate barcodes");
                } finally {
                  setIsGeneratingBarcodes(false);
                }
              }}
              className="flex items-center gap-2 border-amber-300 bg-amber-50/90 text-amber-800 hover:bg-amber-100 font-bold shadow-xs transition-all cursor-pointer"
              title={`Auto-generate scannable GS1 EAN-13 barcodes for all ${missingBarcodesCount} products missing barcodes`}
            >
              {isGeneratingBarcodes ? (
                <Loader2 className="size-4 animate-spin text-amber-600" />
              ) : (
                <Zap className="size-4 text-amber-500 fill-amber-500" />
              )}
              <span>Auto-Gen Barcodes ({missingBarcodesCount})</span>
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              setFreeQtyTriggerProductId(undefined);
              setIsFreeQtyModalOpen(true);
            }}
            className="flex items-center gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-semibold"
            title="Configure Promotional Free Quantity Schemes"
          >
            <Gift className="size-4" /> Free Schemes
          </Button>
          <Button
            variant="outline"
            onClick={handleToggleAi}
            className={`flex items-center gap-2 font-semibold transition-colors ${
              aiPaused
                ? "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 shadow-xs"
                : "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
            }`}
            title={aiPaused ? "AI web image search is PAUSED globally (default placeholders used). Click to resume." : "AI web image search is ACTIVE. Click to pause."}
          >
            {aiPaused ? <Play className="size-4 text-amber-600 fill-amber-600" /> : <Pause className="size-4 text-emerald-600 fill-emerald-600" />}
            <span>{aiPaused ? "Resume AI Images" : "Pause AI Images"}</span>
          </Button>
          <Button onClick={openCreateModal} className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Create Product</Button>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl w-fit">
        <button
          onClick={() => { setActiveTab("inventory"); setSearch(""); setMasterResults([]); setSuggestions([]); setExactMatch(null); }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${activeTab === "inventory" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Store className="size-4" /> My Inventory
        </button>
        <button
          onClick={() => { setActiveTab("catalog"); setSearch(""); setMasterResults([]); setSuggestions([]); setExactMatch(null); }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${activeTab === "catalog" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Globe className="size-4" /> Master Catalog
          {masterResults.length > 0 && (
            <span className="text-[10px] bg-indigo-500/10 text-indigo-600 px-1.5 py-0.5 rounded-full font-bold">{uniqueMasterResults.length}</span>
          )}
        </button>
      </div>

      {/* ── Search bar (shared) ─────────────────────────────────────── */}
      <div className="flex gap-3 items-center flex-wrap">
        {renderSearchBar()}
        {activeTab === "inventory" && (
          <Button
            variant="outline"
            onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
            className="flex items-center gap-1.5"
            title="Toggle Name Sort Order"
          >
            <ArrowUpDown className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium">Sort: Name ({sortOrder === "asc" ? "A-Z ↑" : "Z-A ↓"})</span>
          </Button>
        )}
        {activeTab === "inventory" && (
          <Button variant="outline"><Filter className="size-4 mr-2" /> Filters</Button>
        )}
        {activeTab === "inventory" && renderColumnsMenu()}
      </div>


      {/* ══════════════════════════════════════════════════════════════
           INVENTORY TAB — Two-source unified view
           ══════════════════════════════════════════════════════════════ */}
      {activeTab === "inventory" && (
        <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto w-full min-w-full">
            <table className="w-full text-sm text-left whitespace-nowrap min-w-[1000px]">
              <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
                <tr>
                  {LOCAL_COLUMNS.filter(c => localVisibleColumns.includes(c.id)).map((col) => (
                    <th key={col.id} className="px-6 py-4 whitespace-nowrap">{col.label}</th>
                  ))}
                  <th className="px-6 py-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={localVisibleColumns.length + 1} className="px-6 py-8 text-center text-muted-foreground">
                    <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Loading...</span>
                  </td></tr>
                ) : products.length === 0 ? (
                  <tr><td colSpan={localVisibleColumns.length + 1} className="px-6 py-12 text-center">
                    <Package className="size-10 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground font-medium">
                      {search.trim() ? `No products found matching "${search}" in your inventory.` : "No products in inventory yet."}
                    </p>
                    <div className="flex gap-2 justify-center mt-3">
                      <Button size="sm" onClick={openCreateModal} className="gradient-brand text-white border-0">Create Product</Button>
                    </div>
                  </td></tr>
                ) : (
                  products.map(p => renderLocalRow(p, localVisibleColumns))
                )}
              </tbody>
            </table>
          </div>

          {/* ── Pagination Footer ────────────────────────────────────────── */}
          {totalProducts > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t bg-muted/20 text-sm">
              <div className="text-xs text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{Math.min((currentPage - 1) * pageSize + 1, totalProducts)}</span> to{" "}
                <span className="font-semibold text-foreground">{Math.min(currentPage * pageSize, totalProducts)}</span> of{" "}
                <span className="font-semibold text-foreground">{totalProducts}</span> products
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-3">
                  <span>Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                    className="bg-background border rounded px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                    <option value={500}>500</option>
                  </select>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1 || isLoading}
                  className="h-8 px-2.5 text-xs"
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1 || isLoading}
                  className="h-8 px-2.5 text-xs"
                >
                  <ChevronLeft className="size-3.5 mr-1" /> Previous
                </Button>

                <span className="text-xs font-semibold px-2">
                  Page {currentPage} of {totalPages}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages || isLoading}
                  className="h-8 px-2.5 text-xs"
                >
                  Next <ChevronRight className="size-3.5 ml-1" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage >= totalPages || isLoading}
                  className="h-8 px-2.5 text-xs"
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </div>
      )}


      {/* ══════════════════════════════════════════════════════════════
           MASTER CATALOG TAB
           ══════════════════════════════════════════════════════════════ */}
      {activeTab === "catalog" && (
        <div className="space-y-4">
          {hasSearch && showMasterResults && (
            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4">
              <p className="text-xs text-indigo-700 font-semibold">
                Found <span className="font-bold">{uniqueMasterResults.length}</span> unique product{uniqueMasterResults.length !== 1 ? "s" : ""} not yet in your inventory.
                Click <strong>Import</strong> to add any product directly.
              </p>
            </div>
          )}
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
                  <tr>
                    {MASTER_COLUMNS.filter(c => masterVisibleColumns.includes(c.id)).map((col) => (
                      <th key={col.id} className="px-6 py-4">{col.label}</th>
                    ))}
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? (
                    <tr><td colSpan={masterVisibleColumns.length + 1} className="px-6 py-8 text-center text-muted-foreground">Loading...</td></tr>
                  ) : !hasSearch ? (
                    <tr><td colSpan={masterVisibleColumns.length + 1} className="px-6 py-12 text-center text-muted-foreground">
                      <Globe className="size-8 mx-auto mb-2 opacity-30" />
                      <p>Search for a product to browse the global master catalog.</p>
                      <p className="text-xs mt-1">Type a product name, SKU, or barcode to source from AI or the global database.</p>
                    </td></tr>
                  ) : uniqueMasterResults.length === 0 ? (
                    <tr><td colSpan={masterVisibleColumns.length + 1} className="px-6 py-8 text-center text-muted-foreground">
                      <p className="text-sm">No catalog results found for "{search}"</p>
                      {!aiPaused && (
                        <Button size="sm" variant="outline" className="mt-3" onClick={() => handleSelectSuggestion(search)}>
                          <Sparkles className="size-3 mr-1" /> Try AI Web Search
                        </Button>
                      )}
                    </td></tr>
                  ) : (
                    uniqueMasterResults.map((item, idx) => renderMasterRow(item, masterVisibleColumns))
                  )}
                  {isSearchingMaster && (
                    <tr><td colSpan={masterVisibleColumns.length + 1} className="px-6 py-6 text-center text-indigo-600 font-semibold">
                      <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Searching...</span>
                    </td></tr>
                  )}
                  {searchError && (
                    <tr><td colSpan={masterVisibleColumns.length + 1} className="px-6 py-4 bg-rose-50 border-y">
                      <div className="flex items-center gap-2 text-xs font-bold text-rose-700">
                        <X className="size-4 text-rose-500 shrink-0" /><span>{searchError}</span>
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Product form modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {isModalOpen && renderProductForm()}
      </AnimatePresence>

      {/* ── Phase 2: Quick-add modal ──────────────────────────────── */}
      <AnimatePresence>
        {isQuickAddOpen && (
          <QuickAddModal
            onClose={() => setIsQuickAddOpen(false)}
            onSave={handleQuickAddSave}
            initialName={quickAddName}
            categories={categories}
            uoms={uoms}
            warehouses={warehouses}
          />
        )}
      </AnimatePresence>

      {/* ── Phase 2: Import preview modal ─────────────────────────── */}
      <AnimatePresence>
        {previewItem && (
          <ImportPreviewModal
            item={previewItem}
            onClose={() => setPreviewItem(null)}
            onConfirm={handleConfirmImport}
            isImporting={isImporting}
            categories={categories}
          />
        )}
      </AnimatePresence>

      {/* ── Image Preview popup modal ─────────────────────────────── */}
      <AnimatePresence>
        {previewImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setPreviewImage(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative max-w-3xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="absolute -top-12 right-0 text-white hover:text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-700/50" onClick={() => setPreviewImage(null)}>
                <X className="size-4" /> Close
              </button>
              <img src={previewImage} alt="Preview" className="max-w-full max-h-[80vh] rounded-xl object-contain shadow-2xl border border-white/10" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Barcode Print Drawer ───────────────────────────────────── */}
      <AnimatePresence>
        {isBarcodeDrawerOpen && (
          <BarcodePrintDrawer
            products={products}
            initialSelectedId={barcodeDrawerInitialId}
            onClose={() => {
              setIsBarcodeDrawerOpen(false);
              setBarcodeDrawerInitialId(undefined);
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Promotional Schemes & Free Quantity Settings Modal ──────── */}
      <FreeQtySettingsModal
        isOpen={isFreeQtyModalOpen}
        onClose={() => {
          setIsFreeQtyModalOpen(false);
          setFreeQtyTriggerProductId(undefined);
        }}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          mrp: p.mrp,
          selling_price: p.selling_price,
          stock: p.stock ?? p.initial_stock,
        }))}
        initialTriggerProductId={freeQtyTriggerProductId}
      />

      {/* ── Bulk Import Confirmation & AI Search Prompt Modal ───────── */}
      <AnimatePresence>
        {isImportConfirmModalOpen && pendingImportData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-xl w-full overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                    <FileSpreadsheet className="size-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Ready to Import Catalog</h2>
                    <p className="text-xs text-slate-500">Review your file details and select AI background search preferences.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsImportConfirmModalOpen(false);
                    setPendingImportData(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                {/* File summary pill */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
                  <div className="flex items-center gap-3 truncate">
                    <FileText className="size-5 text-indigo-500 shrink-0" />
                    <div className="truncate">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{pendingImportData.fileName}</div>
                      <div className="text-[11px] text-slate-500">
                        {pendingImportData.isPaintCatalog ? "Detected Paint / Shade Matrix Catalog" : "Standard Inventory Sheet"}
                      </div>
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs shrink-0 border border-indigo-100">
                    {pendingImportData.items.length.toLocaleString()} Products
                  </div>
                </div>

                {/* AI Search Prompt Question */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Bot className="size-4 text-indigo-600" />
                      Run AI Web Search in Background?
                    </label>
                    {pendingImportData.isPaintCatalog && (
                      <span className="text-[10px] bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 font-semibold px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                        Internal Codes Detected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    Choose whether the background RAG worker should look up public barcode databases for images and specs.
                  </p>

                  {/* Option 1: Fast Import without AI search */}
                  <div
                    onClick={() => setEnableAiForImport(false)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      !enableAiForImport
                        ? "border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-xs"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 size-5 rounded-full flex items-center justify-center border ${
                        !enableAiForImport ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 dark:border-slate-600"
                      }`}>
                        {!enableAiForImport && <CheckCircle2 className="size-3.5" />}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <Zap className="size-3.5 text-amber-500 fill-amber-500" />
                            Fast Import Only (Skip Background AI Search)
                          </span>
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full">
                            Recommended
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Imports all products, bases, sizes, prices, and stock immediately. Prevents web search lookups on internal barcodes (e.g. 9450...) and conserves AI quota.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Option 2: AI Web Search Enabled */}
                  <div
                    onClick={() => setEnableAiForImport(true)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      enableAiForImport
                        ? "border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-xs"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 size-5 rounded-full flex items-center justify-center border ${
                        enableAiForImport ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 dark:border-slate-600"
                      }`}>
                        {enableAiForImport && <CheckCircle2 className="size-3.5" />}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <Sparkles className="size-3.5 text-indigo-600" />
                            Enable Background AI Auto-Enrichment
                          </span>
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">
                            Retail & FMCG
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Queues products in the background to search GS1 barcode registries, scrape official brand images, and extract specifications.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Admin reminder notice */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-[11px] text-slate-500 flex items-center gap-2 border border-slate-200/60 dark:border-slate-700/40">
                  <HelpCircle className="size-4 text-slate-400 shrink-0" />
                  <span>Admins can also pause or resume background AI search globally anytime using the AI Search toggle above the table.</span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isImporting}
                  onClick={() => {
                    setIsImportConfirmModalOpen(false);
                    setPendingImportData(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="h-10 px-5 rounded-xl font-semibold bg-white dark:bg-slate-900"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={isImporting}
                  onClick={() => executeBulkImport(pendingImportData.items, enableAiForImport)}
                  className="h-10 px-6 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all border-0 flex items-center gap-2"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Importing Products...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="size-4" />
                      Start Import ({pendingImportData.items.length.toLocaleString()})
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Product Image Fullscreen Popup Modal */}
        {selectedImagePreview && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedImagePreview(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden max-w-lg w-full border border-slate-200 dark:border-slate-800 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
                <div className="min-w-0 pr-2">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">{selectedImagePreview.name}</h3>
                  {selectedImagePreview.sku && (
                    <p className="text-xs text-slate-500 font-mono">SKU: {selectedImagePreview.sku}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedImagePreview(null)}
                  className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="p-6 bg-slate-100/50 dark:bg-slate-950 flex items-center justify-center min-h-[300px] max-h-[70vh] overflow-hidden">
                <img
                  src={selectedImagePreview.url}
                  alt={selectedImagePreview.name}
                  className="max-h-[60vh] max-w-full object-contain rounded-2xl shadow-md border bg-white dark:bg-slate-900"
                />
              </div>
              <div className="p-3 border-t bg-slate-50 dark:bg-slate-800/60 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedImagePreview(null)}
                  className="font-bold text-xs rounded-xl"
                >
                  Close Preview
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
