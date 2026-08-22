import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Filter, Plus, Package, Edit2, Archive, X, Sparkles, Globe, Loader2, Sliders, ShoppingCart, Store, Copy, Upload, Download, Barcode, Zap, ChevronLeft, ChevronRight, ArrowUpDown, Printer, Tag, CheckSquare, Square, LayoutGrid, Rows3, Box, Truck, Lightbulb, FileText, UploadCloud, DollarSign, Layers, Trash2, CheckCircle, Gift } from "lucide-react";

import { inventoryApi, InventoryProduct, InventoryCategory, type Warehouse, resolveImageUrl } from "../../lib/api-client";
import { useHardwareBarcodeScanner } from "../../hooks/useHardwareBarcodeScanner";
import { useTenant } from "../../contexts/tenant-context";
import { motion, AnimatePresence } from "framer-motion";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { RealBarcodeSvg, SingleBarcodeLabelCard } from "../../lib/barcode-svg";
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
  { id: "image", label: "Image" },
  { id: "name", label: "Product Name" },
  { id: "sku", label: "SKU" },
  { id: "barcode", label: "Barcode" },
  { id: "category", label: "Category" },
  { id: "brand", label: "Brand" },
  { id: "uom", label: "Unit (UOM)" },
  { id: "purchase_price", label: "Purchase Price" },
  { id: "mrp", label: "MRP" },
  { id: "selling_price", label: "Retail Selling Price" },
  { id: "wholesale_price", label: "Wholesale Price" },
  { id: "b2b_price", label: "B2B Price" },
  { id: "min_wholesale_qty", label: "Min Wholesale Qty" },
  { id: "tax_percent", label: "Tax (%)" },
  { id: "initial_stock", label: "Stock" },
  { id: "reorder_level", label: "Reorder Level" },
  { id: "safety_stock", label: "Safety Stock" },
  { id: "status", label: "Status" },
  { id: "source", label: "Source" },
];

const MASTER_COLUMNS = [
  { id: "image", label: "Image" },
  { id: "name", label: "Product Name" },
  { id: "sku", label: "SKU" },
  { id: "barcode", label: "Barcode" },
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
  name: "", brand: "", brand_id: "", sku: "", barcode: "", category_id: "",
  uom_id: "", warehouse: "", supplier: "",
  purchase_price: "" as any, mrp: "" as any, selling_price: "" as any,
  wholesale_price: "" as any, min_wholesale_qty: "" as any,
  b2b_price: "" as any, min_b2b_qty: "" as any,
  distributor_price: "" as any, min_distributor_qty: "" as any,
  tax_percent: 0, is_tax_inclusive: true,
  purchase_tax_percent: 0, is_purchase_tax_inclusive: true,
  wholesale_is_tax_inclusive: true,
  b2b_is_tax_inclusive: true,
  distributor_is_tax_inclusive: true,
  discount_limit: "" as any, initial_stock: "" as any, reorder_level: "" as any, safety_stock: "" as any,
  hsn_code: "",
  sub_category: "",
  item_code: "",
  weighing_scale_code: "",
  conversion_factor: "",
  preferred_supplier: "",
  custom_fields: [] as Array<{ key: string; value: string }>,
  image_url: "", short_description: "", long_description: "", status: "active"
});



const localVisibleDefault = ["image", "name", "sku", "barcode", "category", "brand", "mrp", "selling_price", "wholesale_price", "b2b_price", "min_wholesale_qty", "initial_stock", "status"];
const masterVisibleDefault = ["image", "name", "sku", "barcode", "category", "brand", "mrp", "selling_price", "source"];

// ── Column menu sub-component ───────────────────────────────────────
function ColumnMenu({
  columns, visible, onToggle, onToggleAll, onSave, onReset, onClose,
}: {
  columns: typeof LOCAL_COLUMNS;
  visible: string[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onSave: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 mt-2 w-56 bg-white border rounded-xl shadow-xl z-50 p-3 flex flex-col max-h-[420px]">
      <div className="flex items-center justify-between border-b pb-1.5 shrink-0">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Columns</span>
        <button
          type="button"
          onClick={onToggleAll}
          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-500 transition-colors uppercase cursor-pointer"
        >
          {visible.length === columns.length ? "Deselect All" : "Select All"}
        </button>
      </div>
      <div className="divide-y divide-slate-100 overflow-y-auto my-2 py-1 pr-1 flex-1 max-h-64">
        {columns.map(col => (
          <label key={col.id} className="flex items-center gap-2.5 py-1.5 hover:bg-slate-50 cursor-pointer text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={visible.includes(col.id)}
              onChange={() => onToggle(col.id)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 size-3.5 cursor-pointer"
            />
            {col.label}
          </label>
        ))}
      </div>
      <div className="flex gap-2 pt-2 border-t mt-auto shrink-0">
        <Button size="sm" onClick={onSave} className="flex-1 text-[11px] h-7 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg border-0 shadow-sm">
          Save Preset
        </Button>
        <Button size="sm" variant="outline" onClick={onReset} className="flex-1 text-[11px] h-7 font-bold rounded-lg text-slate-700 hover:bg-slate-50">
          Reset
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
  onClose,
}: {
  products: InventoryProduct[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(products.filter(p => p.barcode).map(p => p.id)));
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
        category_id: form.category_id || null,
        uom_id: form.uom_id || null,
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
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
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
          {/* Product card */}
          <div className="flex gap-3 p-3 bg-muted/50 rounded-xl">
            {item.image_url ? (
              <img src={resolveImageUrl(item.image_url)} alt={item.name} className="size-14 rounded-lg object-cover border bg-white shrink-0" />
            ) : (
              <div className="size-14 rounded-lg bg-indigo-100/30 flex items-center justify-center shrink-0">
                <Package className="size-7 text-indigo-500" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{item.name}</p>
              <p className="text-xs text-muted-foreground">{item.brand_name || item.brand || ""}</p>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[10px] mt-1 ${isAISourced ? "bg-amber-500/10 text-amber-600" : "bg-indigo-500/10 text-indigo-600"}`}>
                <Sparkles className="size-3" /> {isAISourced ? "AI Sourced" : "Global Catalog"}
              </span>
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
  const [sortBy, setSortBy] = useState<"name" | "sku" | "created_at" | "mrp" | "selling_price">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formData = useMemo(() => defaultFormData(), []);

  // ── Barcode Print Drawer state ───────────────────────────────────
  const [isBarcodeDrawerOpen, setIsBarcodeDrawerOpen] = useState(false);

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

  // ── Free Quantity & Promotional Schemes state ────────────────────
  const [isFreeQtyModalOpen, setIsFreeQtyModalOpen] = useState(false);
  const [freeQtyTriggerProductId, setFreeQtyTriggerProductId] = useState<string | undefined>(undefined);

  // ── Derived ──────────────────────────────────────────────────────
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
    setCurrentPage(1);
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

      const specs = {
        b2b_price: Number(currentForm.b2b_price) || 0,
        min_b2b_qty: Number(currentForm.min_b2b_qty) || 1,
        b2b_is_tax_inclusive: (currentForm as any).b2b_is_tax_inclusive !== false,
        wholesale_price: Number(currentForm.wholesale_price) || 0,
        min_wholesale_qty: Number(currentForm.min_wholesale_qty) || 1,
        wholesale_is_tax_inclusive: (currentForm as any).wholesale_is_tax_inclusive !== false,
        distributor_price: Number(currentForm.distributor_price) || 0,
        min_distributor_qty: Number(currentForm.min_distributor_qty) || 1,
        distributor_is_tax_inclusive: (currentForm as any).distributor_is_tax_inclusive !== false,
        purchase_tax_percent: Number(currentForm.purchase_tax_percent) || 0,
        is_purchase_tax_inclusive: currentForm.is_purchase_tax_inclusive !== false,
        sub_category: currentForm.sub_category || "",
        item_code: currentForm.item_code || "",
        weighing_scale_code: currentForm.weighing_scale_code || "",
        conversion_factor: currentForm.conversion_factor || "",
        preferred_supplier: currentForm.preferred_supplier || currentForm.supplier || "",
        custom_attributes: customFieldsDict
      };

      const payload = {
        ...currentForm,
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
      name: product.name,
      brand: product.brand_name || product.brand || "",
      brand_id: product.brand_id || "",
      sku: product.sku || "",
      barcode: product.barcode || "",
      category_id: product.category_id || "",
      uom_id: product.uom_id || "",
      warehouse: product.warehouse || "",
      supplier: product.supplier || specs.preferred_supplier || "",
      purchase_price: product.purchase_price ? product.purchase_price : "",
      mrp: product.mrp ? product.mrp : "",
      selling_price: product.selling_price ? product.selling_price : "",
      wholesale_price: product.wholesale_price || specs.wholesale_price || "",
      min_wholesale_qty: product.min_wholesale_qty || specs.min_wholesale_qty || "",
      wholesale_is_tax_inclusive: specs.wholesale_is_tax_inclusive !== false,
      b2b_price: product.b2b_price || specs.b2b_price || "",
      min_b2b_qty: specs.min_b2b_qty || "",
      b2b_is_tax_inclusive: specs.b2b_is_tax_inclusive !== false,
      distributor_price: specs.distributor_price || "",
      min_distributor_qty: specs.min_distributor_qty || "",
      distributor_is_tax_inclusive: specs.distributor_is_tax_inclusive !== false,
      tax_percent: product.tax_percent ?? 0,
      is_tax_inclusive: product.is_tax_inclusive !== false,
      purchase_tax_percent: specs.purchase_tax_percent ?? 0,
      is_purchase_tax_inclusive: specs.is_purchase_tax_inclusive !== false,
      discount_limit: product.discount_limit ? product.discount_limit : "",
      initial_stock: (product.stock ?? product.initial_stock) ? (product.stock ?? product.initial_stock) : "",
      reorder_level: product.reorder_level ? product.reorder_level : "",
      safety_stock: product.safety_stock ? product.safety_stock : "",
      hsn_code: product.hsn_code || specs.hsn_code || "",
      sub_category: specs.sub_category || "",
      item_code: specs.item_code || "",
      weighing_scale_code: specs.weighing_scale_code || "",
      conversion_factor: specs.conversion_factor || "",
      preferred_supplier: specs.preferred_supplier || product.supplier || "",
      custom_fields: customFieldsList,
      image_url: product.image_url || "",
      short_description: product.short_description || "",
      long_description: product.long_description || "",
      status: product.status || "active"
    });
    setEditingProductId(product.id);
    setIsModalOpen(true);
  };

  const handleDuplicate = (product: any) => {
    const specs = (product.specifications && typeof product.specifications === 'object') ? product.specifications : {};
    const customAttributes = specs.custom_attributes || {};
    const customFieldsList = Object.entries(customAttributes).map(([key, value]) => ({ key, value: String(value) }));

    setCurrentForm({
      name: product.name + " (Copy)",
      brand: product.brand_name || product.brand || "",
      brand_id: product.brand_id || "",
      sku: (product.sku || "") + "-COPY",
      barcode: "",
      category_id: product.category_id || "",
      uom_id: product.uom_id || "",
      warehouse: product.warehouse || "",
      supplier: product.supplier || specs.preferred_supplier || "",
      purchase_price: product.purchase_price ? product.purchase_price : "",
      mrp: product.mrp ? product.mrp : "",
      selling_price: product.selling_price ? product.selling_price : "",
      wholesale_price: product.wholesale_price || specs.wholesale_price || "",
      min_wholesale_qty: product.min_wholesale_qty || specs.min_wholesale_qty || "",
      wholesale_is_tax_inclusive: specs.wholesale_is_tax_inclusive !== false,
      b2b_price: product.b2b_price || specs.b2b_price || "",
      min_b2b_qty: specs.min_b2b_qty || "",
      b2b_is_tax_inclusive: specs.b2b_is_tax_inclusive !== false,
      distributor_price: specs.distributor_price || "",
      min_distributor_qty: specs.min_distributor_qty || "",
      distributor_is_tax_inclusive: specs.distributor_is_tax_inclusive !== false,
      tax_percent: product.tax_percent ?? 0,
      is_tax_inclusive: product.is_tax_inclusive !== false,
      purchase_tax_percent: specs.purchase_tax_percent ?? 0,
      is_purchase_tax_inclusive: specs.is_purchase_tax_inclusive !== false,
      discount_limit: product.discount_limit ? product.discount_limit : "",
      initial_stock: (product.stock ?? product.initial_stock) ? (product.stock ?? product.initial_stock) : "",
      reorder_level: product.reorder_level ? product.reorder_level : "",
      safety_stock: product.safety_stock ? product.safety_stock : "",
      hsn_code: product.hsn_code || specs.hsn_code || "",
      sub_category: specs.sub_category || "",
      item_code: specs.item_code || "",
      weighing_scale_code: specs.weighing_scale_code || "",
      conversion_factor: specs.conversion_factor || "",
      preferred_supplier: specs.preferred_supplier || product.supplier || "",
      custom_fields: customFieldsList,
      image_url: product.image_url || "",
      short_description: product.short_description || "",
      long_description: product.long_description || "",
      status: product.status || "active"
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
      if (aiPaused) { await inventoryApi.resumeRAGEnrichment(); setAiPaused(false); toast.success("AI Search resumed!"); }
      else { await inventoryApi.pauseRAGEnrichment(); setAiPaused(true); toast.success("AI Search paused!"); }
    } catch { toast.error("Failed to toggle AI search."); }
  };

  // ── Import from file (supports 42k+ rows, flexible column headers & chunking) ──────
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);

    const processData = async (rows: any[]) => {
      try {
        if (!rows?.length) throw new Error("File is empty.");

        const items = rows.map((row: any) => {
          const rowKeys = Object.keys(row || {});
          const findVal = (possibleNames: string[], containsSubstrings: string[] = []) => {
            for (const target of possibleNames) {
              const targetNorm = target.toLowerCase().replace(/[^a-z0-9]/g, "");
              for (const k of rowKeys) {
                const kNorm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
                if (kNorm === targetNorm && row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
                  return String(row[k]).trim();
                }
              }
            }
            for (const sub of containsSubstrings) {
              const subNorm = sub.toLowerCase();
              for (const k of rowKeys) {
                const kNorm = k.toLowerCase();
                if (kNorm.includes(subNorm) && row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
                  return String(row[k]).trim();
                }
              }
            }
            return "";
          };

          const nameVal = findVal(
            ["ITEMNAME", "Product Name", "product_name", "productname", "name", "Name", "Title", "title", "item_name", "itemname", "product", "item", "description", "item_description", "particulars", "material"],
            ["itemname", "name", "product", "desc", "title", "item", "particular"]
          ) || "Unnamed Product";

          const barcodeVal = findVal(
            ["BARCODE", "BarCode", "barcode", "Barcode (EAN/UPC)", "barcode_number", "bar_code", "ean", "EAN", "upc", "UPC", "gtin", "GTIN", "item_code", "itemcode", "code", "Code", "scan_code"],
            ["barcode", "ean", "upc", "gtin", "code", "sku"]
          );

          const skuVal = findVal(["SKU", "sku", "sku_code", "skucode", "product_code", "SEARCHCODE"], ["sku", "searchcode"]) || (barcodeVal ? `SKU-${barcodeVal}` : "");

          const isActiveRaw = findVal(["ISACTIVE", "is_active", "Active", "Status", "status"]);
          const isActive = isActiveRaw === "" ? true : (isActiveRaw.toLowerCase() === "true" || isActiveRaw === "1" || isActiveRaw.toLowerCase() === "active");

          const b2bVal = parseFloat(findVal(["B2BPRICE", "B2B Price", "b2b_price", "B2B"])) || 0;
          const minB2bVal = parseInt(findVal(["MINB2BQTY", "Min B2B Qty", "min_b2b_qty", "B2B Min Qty"]), 10) || 1;
          const wholesaleVal = parseFloat(findVal(["WHOLESALEPRICE", "Wholesale Price", "wholesale_price", "wholesale"])) || 0;
          const minWholesaleVal = parseInt(findVal(["MINWHOLESALEQTY", "Min Wholesale Qty", "min_wholesale_qty", "Wholesale Min Qty"]), 10) || 1;
          const supplierVal = findVal(["PREFERREDSUPPLIER", "Preferred Supplier", "SUPPLIERNAME", "Supplier Name", "supplier", "Supplier"]);

          return {
            name: nameVal,
            sku: skuVal,
            barcode: barcodeVal,
            short_description: findVal(["DESCRIPTION", "Short Description", "short_description", "description", "Description", "details"]),
            purchase_price: parseFloat(findVal(["PURCHASEPRICEAFTERTAX", "PURCHASEPRICEBEFORETAX", "Purchase Price", "purchase_price", "purchaseprice", "cost_price", "cost", "Cost Price"])) || 0,
            mrp: parseFloat(findVal(["MRP", "mrp", "retail_price", "list_price"])) || 0,
            selling_price: parseFloat(findVal(["SALESPRICEAFTERTAX", "SALESPRICEBEFORETAX", "Selling Price", "selling_price", "sellingprice", "price", "Price", "base_price"])) || 0,
            wholesale_price: wholesaleVal,
            min_wholesale_qty: minWholesaleVal,
            tax_percent: parseFloat(findVal(["SALESTAXPERCENT", "Tax (%)", "tax_percent", "tax", "Tax"])) || 0,
            discount_limit: parseFloat(findVal(["Discount Limit (%)", "discount_limit"])) || 0,
            initial_stock: parseInt(findVal(["STOCK", "Quantity", "quantity", "stock", "initial_stock", "Stock", "qty"]), 10) || 0,
            reorder_level: parseInt(findVal(["Reorder Level", "reorder_level"]), 10) || 10,
            status: isActive ? "active" : "inactive",
            supplier: supplierVal,
            brand_name: findVal(["Brand", "brand", "Brand Name", "brand_name", "manufacturer"]),
            category_name: findVal(["CATEGORY", "Category", "category", "Category Name", "category_name"]),
            sub_category_name: findVal(["Sub Category", "sub_category", "sub_category_name"]),
            uom_name: findVal(["SALESMEASURINGUNIT", "PURCHASEMEASURINGUNIT", "UOM", "uom", "Unit", "unit", "Unit of Measure", "uom_name"]),
            hsn_code: findVal(["HSN", "hsn", "HSN Code", "hsn_code", "hsncode", "tax_hsn", "HSN/SAC", "hsn/sac"]),
            specifications: {
              b2b_price: b2bVal,
              min_b2b_qty: minB2bVal,
              wholesale_price: wholesaleVal,
              min_wholesale_qty: minWholesaleVal,
              preferred_supplier: supplierVal,
              weighing_scale_code: findVal(["WEIGHINGSCALEITEMCODE", "Weighing Scale Item Code", "weighing_scale_code"]),
              conversion_factor: findVal(["CONVERSIONFACTOR", "Conversion Factor", "conversion_factor"]),
              item_code: findVal(["Item CODE", "Item Code", "item_code"])
            }
          };

        });

        // Filter out completely blank rows
        const validItems = items.filter(it => (it.name && it.name !== "Unnamed Product") || it.barcode || it.sku);
        if (!validItems.length) throw new Error("No valid products with Name or Barcode found in file.");

        // Chunk into batches of 2,000 items to handle 42,000+ row imports reliably
        const CHUNK_SIZE = 2000;
        let totalCreated = 0;
        let totalSkipped = 0;
        let totalBrands = 0;
        let totalCategories = 0;
        let totalUoms = 0;

        for (let i = 0; i < validItems.length; i += CHUNK_SIZE) {
          const chunk = validItems.slice(i, i + CHUNK_SIZE);
          const currentEnd = Math.min(i + CHUNK_SIZE, validItems.length);
          toast.loading(`Importing rows ${i + 1} to ${currentEnd} of ${validItems.length}...`, { id: "bulk-import-progress" });

          const res = await inventoryApi.masterImportProducts(chunk);
          totalCreated += res.products_created;
          totalSkipped += res.skipped_count;
          totalBrands += res.brands_created;
          totalCategories += res.categories_created;
          totalUoms += res.uoms_created;
        }

        toast.success(
          `Import Complete!\n\n${totalCreated} products imported into inventory.\n${totalSkipped} duplicates skipped.\nQueued for AI background enrichment (images & details)!`,
          { id: "bulk-import-progress", duration: 8000 }
        );
        await loadData();
      } catch (error: any) {
        toast.error("Import failed: " + (error.detail || error.message || "Unknown error"), { id: "bulk-import-progress" });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };


    if (file.name.endsWith(".csv")) {
      const raw = await file.text();
      const text = raw.replace(/^﻿/, '');
      Papa.parse(text, { header: true, skipEmptyLines: true, complete: (r: any) => processData(r.data), error: (err: any) => { setIsImporting(false); alert("CSV parse error: " + err.message); } });
    } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const wb = XLSX.read(evt.target?.result as any, { type: 'binary' });
          const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
          processData(data);
        } catch (err: any) { setIsImporting(false); alert("Excel error: " + err.message); }
      };
      reader.readAsBinaryString(file);
    } else {
      setIsImporting(false); alert("Unsupported format. Use .csv or .xlsx");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleExport = () => {
    if (fuzzyLocalResults.length === 0) return alert("No products to export.");
    const headers = ["name", "brand", "sku", "barcode", "description", "purchase_price", "mrp", "selling_price", "tax_percent", "discount_limit", "initial_stock", "reorder_level", "status"];
    const csv = [headers.join(","), ...fuzzyLocalResults.map(p => headers.map(h => esc((p as any)[h])).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `products_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleDownloadSample = () => {
    const headers = [
      "ITEM NAME", "BarCode", "CATEGORY", "SUB CATEGORY", "BarCode.1", "Brand", "Item CODE", "Unit", "Stock Alert",
      "DESCRIPTION", "DESCRIPTI ON HTML", "CONVERSION FACTOR", "WEIGHING SCALE ITEM CODE", "HSN",
      "MRP", "B2B PRICE", "MIN B2B QTY", "WHOLESALE PRICE", "MIN WHOLESALE QTY", "SALES PRICE",
      "Sales Tax inclusive/Exclusive", "SALES TAX NAME", "SALES PRICE AFTER TAX", "Disc1(%)", "Disc1(Rs)", "SALES MEASURING UNIT",
      "PURCHASE PRICE ", "PURCHASE Tax inclusive/Exclusive", "PURCHASE TAX NAME", "PURCHASE TAX PERCENT", "PURCHASE PRICE AFTER TAX",
      "PURCHASE MEASURING UNIT", "Opening Stock", "STOCK", "Manifacturing DATE", "EXPIRY DATE", "WAREHOUSE NAME",
      "LOCATION IN WAREHOUSE", "IS ACTIVE", "HAS LABEL", "LABEL HEADINGS", "SUPPLIER NAME", "ITEM RECEIVED DATE",
      "SUPPLIER INVOICE NUMBER", "SUPPLIER INVOICE DATE", "NEED TO PRINT BARCODE STICKER", "IS SERVICE ITEM", "NOTFORSALE",
      "ONLY FOR PORTAL", "NOT FOR PORTAL", "HAS MANUAL BATCH", "STOCK BATCH NUMBER", "STOCK BATCH EXPIRY DATE",
      "OPENING STOCK BATCH NUMBER", "OPENING STOCK BATCH EXPIRY DATE", "DISPLAYINDEX", "ITEMIMAGE", "CATEGORYIMAGE",
      "UNIQUE ITEM NAME", "KEYWORDS", "ACCESSORIES KEYWORD", "PREFERRED SUPPLIER"
    ];

    const sampleRows = [
      [
        "CHOKINO MILKEA", "9999179361009", "Beverages", "Milk Drinks", "", "Nestle", "ITM-001", "MILLI", "10",
        "Delicious chocolate milk drink", "", "1", "101", "04029990",
        100, 70.00, 5, 65.00, 10, 76.27,
        "Exclusive", "GST@18", 90, 5, 0, "Qty",
        52.54, "Exclusive", "GST@18", "18", 62,
        "Qty", 50, 50, "2026-01-01", "2026-12-31", "Main Warehouse",
        "Rack A-1", "Yes", "Yes", "MRP: 100", "Global Beverages Ltd", "2026-01-10",
        "INV-9901", "2026-01-10", "Yes", "No", "No",
        "Yes", "No", "Yes", "BAT-2026-01", "2026-12-31",
        "BAT-2026-01", "2026-12-31", "1", "", "",
        "CHOKINO MILKEA 200ML", "milk, chocolate, drink", "straw", "Global Beverages Ltd"
      ],
      [
        "KIT TOWEL", "9997898492653", "Home & Living", "Towels", "", "Bombay Dyeing", "ITM-002", "BAGS", "5",
        "100% Cotton premium bath towel", "", "1", "102", "63026000",
        60, 42.00, 10, 38.00, 20, 49,
        "Inclusive", "GST@5", 49, 0, 0, "Qty",
        28, "Inclusive", "GST@5", "5", 28,
        "Qty", 100, 100, "2026-02-01", "2028-02-01", "Main Warehouse",
        "Shelf B-2", "Yes", "Yes", "MRP: 60", "Textile Hub", "2026-02-15",
        "INV-9902", "2026-02-15", "Yes", "No", "No",
        "Yes", "No", "No", "", "",
        "", "", "2", "", "",
        "KIT TOWEL COTTON", "towel, cotton, bath", "", "Textile Hub"
      ],
      [
        "GORAL Premium Toothbrush No. 616", "9992008087019", "Personal Care", "Oral Care", "", "Goral", "ITM-003", "GRAMS", "20",
        "Ultra soft bristles for deep cleaning", "", "1", "103", "96032100",
        100, 50.00, 12, 45.00, 24, 59,
        "Inclusive", "GST@18", 59, 10, 0, "Qty",
        30, "Inclusive", "GST@18", "18", 30,
        "Qty", 200, 200, "2026-03-01", "2029-03-01", "Main Warehouse",
        "Aisle 3", "Yes", "Yes", "MRP: 100", "Goral Health Care", "2026-03-10",
        "INV-9903", "2026-03-10", "Yes", "No", "No",
        "Yes", "No", "No", "", "",
        "", "", "3", "", "",
        "GORAL TOOTHBRUSH 616", "toothbrush, oral, hygiene", "", "Goral Health Care"
      ]
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Item Details");
    XLSX.writeFile(wb, "Itm_Details_Sample.xlsx");
    toast.success("Sample Excel downloaded with all 58 columns matching your catalog structure!");
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
      <Button variant="outline" onClick={() => setIsColumnsMenuOpen(!isColumnsMenuOpen)}>
        <Sliders className="size-4 mr-2" /> Columns
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
            onSave={() => {
              const key = activeTab === "inventory" ? "products_local_visible_columns" : "products_master_visible_columns";
              const cols = activeTab === "inventory" ? localVisibleColumns : masterVisibleColumns;
              localStorage.setItem(key, JSON.stringify(cols));
              setIsColumnsMenuOpen(false);
            }}
            onReset={() => {
              const def = activeTab === "inventory" ? localVisibleDefault : masterVisibleDefault;
              const setter = activeTab === "inventory" ? setLocalVisibleColumns : setMasterVisibleColumns;
              const key = activeTab === "inventory" ? "products_local_visible_columns" : "products_master_visible_columns";
              setter(def);
              localStorage.setItem(key, JSON.stringify(def));
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
  //  RENDER: Product form modal
  // ══════════════════════════════════════════════════════════════════
  const renderProductForm = () => {
    const selectedCatObj = categories.find(c => c.id === currentForm.category_id);
    const activeParentId = selectedCatObj ? (selectedCatObj.parent_id || selectedCatObj.id) : "";
    const activeSubId = selectedCatObj && selectedCatObj.parent_id ? selectedCatObj.id : "";
    
    const mainCategories = categories.filter(c => !c.parent_id);
    const subCategories = categories.filter(c => c.parent_id && c.parent_id === activeParentId);

    const tabs = [
      { id: "basic", label: "Basic Details", desc: "Name, SKU, Category, Brand", icon: Package },
      { id: "pricing", label: "Pricing, Tax & Purchasing", desc: "Prices, GST, Wholesale, B2B", icon: DollarSign },
      { id: "inventory", label: "Inventory", desc: "Stock, Warehouse, Reorder", icon: Box },
      { id: "custom_fields", label: "Custom Fields", desc: "Attributes, Specs, Tags", icon: Layers },
      { id: "other", label: "Other Details", desc: "Description, Status", icon: FileText }
    ];

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-card border rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] max-h-[92vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b flex items-center justify-between shrink-0 bg-white">
            <h2 className="text-xl font-bold tracking-tight">{editingProductId ? "Edit Product" : "Create Product"}</h2>
            <button type="button" onClick={() => { setIsModalOpen(false); setEditingProductId(null); setCurrentForm(defaultFormData()); setActiveModalTab("basic"); }} className="p-1.5 rounded-lg hover:bg-muted"><X className="size-5" /></button>
          </div>
          
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <div className="w-72 bg-slate-50 border-r flex flex-col overflow-y-auto shrink-0 p-4">
              <div className="space-y-2 flex-1">
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeModalTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveModalTab(tab.id)}
                      className={`w-full text-left p-3 rounded-xl flex gap-3 transition-colors ${
                        isActive ? "bg-indigo-50 border border-indigo-100" : "hover:bg-muted border border-transparent"
                      }`}
                    >
                      <div className={`shrink-0 p-2 rounded-lg ${isActive ? "bg-indigo-100 text-indigo-700" : "bg-white border text-slate-500"}`}>
                        <Icon className="size-5" />
                      </div>
                      <div>
                        <div className={`text-sm font-semibold ${isActive ? "text-indigo-900" : "text-slate-700"}`}>{tab.label}</div>
                        <div className={`text-xs ${isActive ? "text-indigo-600" : "text-slate-500"}`}>{tab.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-6 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 flex gap-3">
                <Lightbulb className="size-5 text-indigo-600 shrink-0" />
                <div>
                  <div className="text-sm font-bold text-indigo-900 mb-1">Tip</div>
                  <div className="text-xs text-indigo-700 leading-relaxed">Fill the basic details first, you can update the rest later.</div>
                </div>
              </div>
            </div>

            {/* Form Area */}
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden bg-white">
              <div className="flex-1 overflow-y-auto p-8">
                
                {activeModalTab === "basic" && (
                  <div className="space-y-6 max-w-3xl">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Basic Details</h3>
                      <p className="text-sm text-slate-500 mb-6">Add the essential details to identify your product.</p>
                      
                      <div className="p-4 border border-dashed rounded-xl flex items-center justify-between bg-slate-50/50 mb-6">
                        <div className="flex items-center gap-4">
                          {currentForm.image_url ? (
                            <div className="relative size-16 rounded-xl overflow-hidden border bg-white group shadow-sm shrink-0">
                              <img src={resolveImageUrl(currentForm.image_url)} alt="Preview" className="object-cover w-full h-full" />
                              <button type="button" onClick={() => setCurrentForm(p => ({ ...p, image_url: "" }))} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity cursor-pointer border-0">
                                Remove
                              </button>
                            </div>
                          ) : (
                            <div className="size-16 rounded-xl border flex items-center justify-center text-muted-foreground bg-white shrink-0">
                              <UploadCloud className="size-6 text-slate-400" />
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-sm text-slate-900">Upload Image</div>
                            <div className="text-xs text-slate-500 mt-0.5">PNG, JPG or WebP • Max 5MB</div>
                          </div>
                        </div>
                        <input type="file" accept="image/*" id="prod-img-upload" className="hidden" onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const res = await inventoryApi.uploadProductImage(file);
                            setCurrentForm(p => ({ ...p, image_url: res.image_url }));
                            toast.success("Product image uploaded successfully!");
                          } catch (err) {
                            toast.error("Failed to upload product image.");
                          }
                        }} />
                        <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById("prod-img-upload")?.click()} className="bg-white">
                          Browse
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                        Product Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={currentForm.name}
                        onChange={handleFormChange}
                        placeholder="Enter product name"
                        required
                        className="w-full h-11 px-4 text-sm rounded-xl border bg-background focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-1.5">SKU</label>
                        <input
                          type="text"
                          name="sku"
                          value={currentForm.sku}
                          onChange={handleFormChange}
                          placeholder="Enter SKU"
                          className="w-full h-11 px-4 text-sm rounded-xl border bg-background focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-1.5">Barcode</label>
                        <input
                          type="text"
                          name="barcode"
                          value={currentForm.barcode}
                          onChange={handleFormChange}
                          placeholder="Enter barcode"
                          className="w-full h-11 px-4 text-sm rounded-xl border bg-background focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-1.5">Brand</label>
                        <div className="relative">
                          <div className="flex gap-2">
                            <select
                              name="brand_id"
                              value={currentForm.brand_id}
                              onChange={handleFormChange}
                              className="flex-1 h-11 px-4 text-sm rounded-xl border bg-background focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            >
                              <option value="">Select brand</option>
                              {brands.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => { setBrandPopoverOpen(v => !v); setCatPopoverOpen(false); setSubCatPopoverOpen(false); }}
                              title="Create new brand"
                              className="w-11 h-11 shrink-0 rounded-xl border text-indigo-600 bg-white hover:bg-indigo-50 flex items-center justify-center transition-all"
                            >
                              <Plus className="size-4" />
                            </button>
                          </div>
                          {brandPopoverOpen && (
                            <InlineCreatePopover
                              label="Brand"
                              onClose={() => setBrandPopoverOpen(false)}
                              onSave={async (name) => {
                                const created = await inventoryApi.createBrand({ name });
                                setBrands(prev => [...prev, created]);
                                setCurrentForm(prev => ({ ...prev, brand_id: created.id }));
                                toast.success(`Brand "${name}" created!`);
                              }}
                            />
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                          Category <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="flex gap-2">
                            <select
                              value={activeParentId}
                              onChange={(e) => {
                                const newParentId = e.target.value;
                                setCurrentForm(prev => ({ ...prev, category_id: newParentId }));
                              }}
                              className="flex-1 h-11 px-4 text-sm rounded-xl border bg-background focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            >
                              <option value="">Select category</option>
                              {mainCategories.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => { setCatPopoverOpen(v => !v); setBrandPopoverOpen(false); setSubCatPopoverOpen(false); }}
                              title="Create new category"
                              className="w-11 h-11 shrink-0 rounded-xl border text-indigo-600 bg-white hover:bg-indigo-50 flex items-center justify-center transition-all"
                            >
                              <Plus className="size-4" />
                            </button>
                          </div>
                          {catPopoverOpen && (
                            <InlineCreatePopover
                              label="Category"
                              onClose={() => setCatPopoverOpen(false)}
                              onSave={async (name) => {
                                const created = await inventoryApi.createCategory({ name });
                                setCategories(prev => [...prev, created]);
                                setCurrentForm(prev => ({ ...prev, category_id: created.id }));
                                toast.success(`Category "${name}" created!`);
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-1.5">Sub-Category</label>
                        <div className="relative">
                          <div className="flex gap-2">
                            <select
                              value={activeSubId}
                              disabled={!activeParentId}
                              onChange={(e) => {
                                const newSubId = e.target.value;
                                setCurrentForm(prev => ({ ...prev, category_id: newSubId || activeParentId }));
                              }}
                              className="flex-1 h-11 px-4 text-sm rounded-xl border bg-background disabled:opacity-50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            >
                              <option value="">{activeParentId ? "Select sub-category" : "Select Category First"}</option>
                              {subCategories.map((sc) => (
                                <option key={sc.id} value={sc.id}>{sc.name}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={!activeParentId}
                              onClick={() => { setSubCatPopoverOpen(v => !v); setBrandPopoverOpen(false); setCatPopoverOpen(false); }}
                              title="Create new sub-category"
                              className="w-11 h-11 shrink-0 rounded-xl border text-indigo-600 bg-white hover:bg-indigo-50 flex items-center justify-center transition-all disabled:opacity-50"
                            >
                              <Plus className="size-4" />
                            </button>
                          </div>
                          {subCatPopoverOpen && activeParentId && (
                            <InlineCreatePopover
                              label="Sub-Category"
                              onClose={() => setSubCatPopoverOpen(false)}
                              onSave={async (name) => {
                                const created = await inventoryApi.createCategory({ name, parent_id: activeParentId });
                                setCategories(prev => [...prev, created]);
                                setCurrentForm(prev => ({ ...prev, category_id: created.id }));
                                toast.success(`Sub-Category "${name}" created!`);
                              }}
                            />
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                          Unit of Measurement (UoM) <span className="text-red-500">*</span>
                        </label>
                        <select
                          name="uom_id"
                          value={currentForm.uom_id}
                          onChange={handleFormChange}
                          className="w-full h-11 px-4 text-sm rounded-xl border bg-background focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        >
                          <option value="">Select unit</option>
                          {uoms.map((u) => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {activeModalTab === "inventory" && (
                  <div className="space-y-6 max-w-3xl">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Inventory Management</h3>
                      <p className="text-sm text-slate-500 mb-6">Track and manage stock levels.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      {[
                        { label: "Initial Stock", name: "initial_stock", type: "number" },
                        { label: "Reorder Level", name: "reorder_level", type: "number" },
                        { label: "Safety Stock", name: "safety_stock", type: "number" },
                        { label: "Warehouse", name: "warehouse", type: "text" },
                      ].map((field) => (
                        <div key={field.name}>
                          <label className="block text-sm font-semibold text-slate-900 mb-1.5">{field.label}</label>
                          <input
                            type={field.type}
                            min={field.type === "number" ? "0" : undefined}
                            onKeyDown={field.type === "number" ? (e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); } : undefined}
                            name={field.name}
                            value={(currentForm as any)[field.name] ?? ""}
                            onChange={handleFormChange}
                            placeholder={`Enter ${field.label.toLowerCase()}`}
                            className="w-full h-11 px-4 text-sm rounded-xl border bg-background focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeModalTab === "pricing" && (
                  <div className="space-y-6 max-w-3xl pb-8">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 tracking-tight">Pricing, Tax & Multi-Tier Rates</h3>
                      <p className="text-xs text-slate-500 mt-1">Configure GST tax schedules, retail selling price, and volume-based pricing tiers (B2B, Wholesale, Distributor).</p>
                    </div>

                    {/* Section 1: GST & Tax Configuration */}
                    <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-4">
                      <div className="border-b border-slate-200/80 pb-3">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 block">1. GST Tax & HSN Configuration</span>
                        <span className="text-[11px] text-slate-500">Configure official GST tax schedules and HSN codes.</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 h-5 mb-1.5 flex items-center">Official GST Rate *</label>
                          <select
                            name="tax_percent"
                            value={(currentForm as any).tax_percent ?? 0}
                            onChange={handleFormChange}
                            className="w-full h-11 px-3 text-sm rounded-xl border border-slate-300 bg-white font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                          >
                            <option value="0">0%</option>
                            <option value="0.25">0.25%</option>
                            <option value="3">3%</option>
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18">18%</option>
                            <option value="28">28%</option>
                          </select>
                        </div>

                        <div>
                          <div className="flex items-center justify-between h-5 mb-1.5">
                            <label className="block text-xs font-bold text-slate-700">HSN Code</label>
                            <button
                              type="button"
                              onClick={() => setIsManualHsn(!isManualHsn)}
                              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 transition-colors"
                            >
                              {isManualHsn ? "📋 Select from List" : "✏️ Enter Manually"}
                            </button>
                          </div>

                          {isManualHsn ? (
                            <div className="relative">
                              <input
                                type="text"
                                name="hsn_code"
                                value={(currentForm as any).hsn_code || ""}
                                onChange={handleFormChange}
                                placeholder="Enter HSN Code (e.g. 84713010)"
                                className="w-full h-11 px-3 text-sm rounded-xl border border-slate-300 bg-white font-mono font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all uppercase placeholder:font-normal placeholder:normal-case placeholder:text-slate-400"
                              />
                            </div>
                          ) : (
                            <select
                              className="w-full h-11 px-3 text-sm rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer font-mono font-bold text-slate-800"
                              value={(currentForm as any).hsn_code || ""}
                              onChange={(e) => {
                                const selectedCode = e.target.value;
                                if (selectedCode === "manual") {
                                  setIsManualHsn(true);
                                  return;
                                }
                                const match = hsnCodes.find(h => h.hsn_code === selectedCode);
                                setCurrentForm(prev => ({
                                  ...prev,
                                  hsn_code: selectedCode,
                                  tax_percent: match ? match.gst_rate : prev.tax_percent
                                }));
                                if (match) {
                                  toast.success(`Selected HSN ${selectedCode} (${match.gst_rate}% GST Rate)`);
                                }
                              }}
                            >
                              <option value="">Select HSN Code</option>
                              {hsnCodes.map((item) => (
                                <option key={item.hsn_code} value={item.hsn_code}>
                                  {item.hsn_code}
                                </option>
                              ))}
                              <option value="manual">✏️ Enter Custom / Manual HSN...</option>
                            </select>
                          )}
                        </div>
                      </div>

                      {/* Live Price Calculator & Tax Breakdown Card */}
                      {(() => {
                        const price = Number((currentForm as any).selling_price) || 0;
                        const taxRate = Number((currentForm as any).tax_percent) || 0;
                        const isIncl = (currentForm as any).is_tax_inclusive !== false;

                        let basePrice = 0;
                        let taxAmount = 0;
                        let finalCustomerPrice = 0;

                        if (isIncl) {
                          basePrice = taxRate > 0 ? price / (1 + taxRate / 100) : price;
                          taxAmount = price - basePrice;
                          finalCustomerPrice = price;
                        } else {
                          basePrice = price;
                          taxAmount = (price * taxRate) / 100;
                          finalCustomerPrice = price + taxAmount;
                        }

                        return (
                          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5 shadow-2xs">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Real-Time Price & Tax Breakdown</span>
                              <span className="bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-bold text-[10px]">
                                {isIncl ? "With GST (Inclusive)" : "Without GST (+Tax Extra)"}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-3 pt-1">
                              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                <span className="text-slate-500 block text-[11px] font-medium mb-0.5">Net Base (Excl. Tax)</span>
                                <span className="font-black text-slate-900 text-sm md:text-base">{currency.symbol}{basePrice.toFixed(2)}</span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">What business retains</span>
                              </div>
                              <div className="bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100">
                                <span className="text-indigo-700 block text-[11px] font-semibold mb-0.5">GST Tax ({taxRate}%)</span>
                                <span className="font-black text-indigo-700 text-sm md:text-base">+{currency.symbol}{taxAmount.toFixed(2)}</span>
                                <span className="text-[10px] text-indigo-400 block mt-0.5">Govt tax collected</span>
                              </div>
                              <div className="bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100">
                                <span className="text-emerald-700 block text-[11px] font-semibold mb-0.5">Final Customer Price</span>
                                <span className="font-black text-emerald-700 text-sm md:text-base">{currency.symbol}{finalCustomerPrice.toFixed(2)}</span>
                                <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">Printed billing amount</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Section 2: Retail & Consumer Pricing */}
                    <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-4">
                      <div>
                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 block">2. Retail & Consumer Pricing</span>
                        <span className="text-[11px] text-slate-500">Standard walk-in counter sales prices and packaging MRP.</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 h-5 mb-1.5 flex items-center">Retail Selling Price *</label>
                          <div className="relative flex items-center rounded-xl border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 overflow-hidden transition-all shadow-2xs">
                            <span className="pl-3 pr-1 text-slate-400 font-bold text-sm select-none">{currency.symbol}</span>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                              name="selling_price"
                              value={(currentForm as any).selling_price ?? ""}
                              onChange={handleFormChange}
                              placeholder="0.00"
                              className="w-full h-11 py-2 pr-2 text-sm bg-transparent font-black text-slate-900 outline-none"
                            />
                            <div className="border-l border-slate-200 bg-slate-50/90 shrink-0 h-11 flex items-center px-1">
                              <select
                                name="is_tax_inclusive"
                                value={(currentForm as any).is_tax_inclusive !== false ? "true" : "false"}
                                onChange={(e) => setCurrentForm(prev => ({ ...prev, is_tax_inclusive: e.target.value === "true" }))}
                                className="h-full bg-transparent px-2 text-xs font-bold text-slate-700 outline-none cursor-pointer hover:text-indigo-600 transition-colors"
                              >
                                <option value="true">With GST</option>
                                <option value="false">Without GST</option>
                              </select>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 h-5 mb-1.5 flex items-center">MRP (Max Retail Price)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">{currency.symbol}</span>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                              name="mrp"
                              value={(currentForm as any).mrp ?? ""}
                              onChange={handleFormChange}
                              placeholder=""
                              className="w-full h-11 pl-8 pr-3 text-sm rounded-xl border border-slate-300 bg-white font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 h-5 mb-1.5 flex items-center">Discount Limit (%)</label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                              name="discount_limit"
                              value={(currentForm as any).discount_limit ?? ""}
                              onChange={handleFormChange}
                              placeholder=""
                              className="w-full h-11 px-4 text-sm rounded-xl border border-slate-300 bg-white font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Multi-Tier B2B & Wholesale Pricing */}
                    <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-4">
                      <div>
                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 block">3. Multi-Tier B2B, Wholesale & Distributor Pricing</span>
                        <span className="text-[11px] text-slate-500">Tiered contract pricing automatically applied at POS & invoices based on customer type and quantity.</span>
                      </div>
                      <div className="space-y-3">
                        {/* Wholesale Tier */}
                        <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3 shadow-2xs">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <span className="text-xs font-bold text-indigo-900">Wholesale Tier</span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-medium">Bulk Volume Rate</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-slate-700 h-5 mb-1.5 flex items-center">Wholesale Price</label>
                              <div className="relative flex items-center rounded-xl border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 overflow-hidden transition-all shadow-2xs">
                                <span className="pl-3 pr-1 text-slate-400 font-bold text-xs select-none">{currency.symbol}</span>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                                  name="wholesale_price"
                                  value={(currentForm as any).wholesale_price ?? ""}
                                  onChange={handleFormChange}
                                  placeholder="0.00"
                                  className="w-full h-11 py-2 pr-2 text-sm bg-transparent font-bold text-slate-800 outline-none"
                                />
                                <div className="border-l border-slate-200 bg-slate-50/90 shrink-0 h-11 flex items-center px-1">
                                  <select
                                    value={(currentForm as any).wholesale_is_tax_inclusive !== false ? "true" : "false"}
                                    onChange={(e) => setCurrentForm(prev => ({ ...prev, wholesale_is_tax_inclusive: e.target.value === "true" }))}
                                    className="h-full bg-transparent px-2 text-xs font-bold text-slate-700 outline-none cursor-pointer hover:text-indigo-600 transition-colors"
                                  >
                                    <option value="true">With GST</option>
                                    <option value="false">Without GST</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-700 h-5 mb-1.5 flex items-center">Min Wholesale Qty</label>
                              <input
                                type="number"
                                min="0"
                                onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                                name="min_wholesale_qty"
                                value={(currentForm as any).min_wholesale_qty ?? ""}
                                onChange={handleFormChange}
                                placeholder=""
                                className="w-full h-11 px-4 text-sm rounded-xl border border-slate-300 bg-white font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                              />
                            </div>
                          </div>
                        </div>

                        {/* B2B Tier */}
                        <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3 shadow-2xs">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <span className="text-xs font-bold text-indigo-900">B2B Business Tier</span>
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-medium">GST Clients</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-slate-700 h-5 mb-1.5 flex items-center">B2B Price</label>
                              <div className="relative flex items-center rounded-xl border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 overflow-hidden transition-all shadow-2xs">
                                <span className="pl-3 pr-1 text-slate-400 font-bold text-xs select-none">{currency.symbol}</span>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                                  name="b2b_price"
                                  value={(currentForm as any).b2b_price ?? ""}
                                  onChange={handleFormChange}
                                  placeholder="0.00"
                                  className="w-full h-11 py-2 pr-2 text-sm bg-transparent font-bold text-slate-800 outline-none"
                                />
                                <div className="border-l border-slate-200 bg-slate-50/90 shrink-0 h-11 flex items-center px-1">
                                  <select
                                    value={(currentForm as any).b2b_is_tax_inclusive !== false ? "true" : "false"}
                                    onChange={(e) => setCurrentForm(prev => ({ ...prev, b2b_is_tax_inclusive: e.target.value === "true" }))}
                                    className="h-full bg-transparent px-2 text-xs font-bold text-slate-700 outline-none cursor-pointer hover:text-indigo-600 transition-colors"
                                  >
                                    <option value="true">With GST</option>
                                    <option value="false">Without GST</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-700 h-5 mb-1.5 flex items-center">Min B2B Qty</label>
                              <input
                                type="number"
                                min="0"
                                onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                                name="min_b2b_qty"
                                value={(currentForm as any).min_b2b_qty ?? ""}
                                onChange={handleFormChange}
                                placeholder=""
                                className="w-full h-11 px-4 text-sm rounded-xl border border-slate-300 bg-white font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Distributor Tier */}
                        <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3 shadow-2xs">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <span className="text-xs font-bold text-indigo-900">Distributor / Stockist Tier</span>
                            <span className="text-[10px] bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-full font-medium">Dealer & Stockist Rate</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-slate-700 h-5 mb-1.5 flex items-center">Distributor Price</label>
                              <div className="relative flex items-center rounded-xl border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 overflow-hidden transition-all shadow-2xs">
                                <span className="pl-3 pr-1 text-slate-400 font-bold text-xs select-none">{currency.symbol}</span>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                                  name="distributor_price"
                                  value={(currentForm as any).distributor_price ?? ""}
                                  onChange={handleFormChange}
                                  placeholder="0.00"
                                  className="w-full h-11 py-2 pr-2 text-sm bg-transparent font-bold text-slate-800 outline-none"
                                />
                                <div className="border-l border-slate-200 bg-slate-50/90 shrink-0 h-11 flex items-center px-1">
                                  <select
                                    value={(currentForm as any).distributor_is_tax_inclusive !== false ? "true" : "false"}
                                    onChange={(e) => setCurrentForm(prev => ({ ...prev, distributor_is_tax_inclusive: e.target.value === "true" }))}
                                    className="h-full bg-transparent px-2 text-xs font-bold text-slate-700 outline-none cursor-pointer hover:text-indigo-600 transition-colors"
                                  >
                                    <option value="true">With GST</option>
                                    <option value="false">Without GST</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-700 h-5 mb-1.5 flex items-center">Min Distributor Qty</label>
                              <input
                                type="number"
                                min="0"
                                onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                                name="min_distributor_qty"
                                value={(currentForm as any).min_distributor_qty ?? ""}
                                onChange={handleFormChange}
                                placeholder=""
                                className="w-full h-11 px-4 text-sm rounded-xl border border-slate-300 bg-white font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 4: Purchase & Sourcing */}
                    <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-4">
                      <div>
                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 block">4. Purchase & Sourcing Costs</span>
                        <span className="text-[11px] text-slate-500">Cost price paid to vendors for margin tracking and procurement.</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 h-5 mb-1.5 flex items-center">Purchase / Cost Price</label>
                          <div className="relative flex items-center rounded-xl border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 overflow-hidden transition-all shadow-2xs">
                            <span className="pl-3 pr-1 text-slate-400 font-bold text-sm select-none">{currency.symbol}</span>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                              name="purchase_price"
                              value={(currentForm as any).purchase_price ?? ""}
                              onChange={handleFormChange}
                              placeholder="0.00"
                              className="w-full h-11 py-2 pr-2 text-sm bg-transparent font-semibold focus:ring-0 outline-none"
                            />
                            <div className="border-l border-slate-200 bg-slate-50/90 shrink-0 h-11 flex items-center px-1">
                              <select
                                name="is_purchase_tax_inclusive"
                                value={(currentForm as any).is_purchase_tax_inclusive !== false ? "true" : "false"}
                                onChange={(e) => setCurrentForm(prev => ({ ...prev, is_purchase_tax_inclusive: e.target.value === "true" }))}
                                className="h-full bg-transparent px-2 text-xs font-bold text-slate-700 outline-none cursor-pointer hover:text-indigo-600 transition-colors"
                              >
                                <option value="true">With GST</option>
                                <option value="false">Without GST</option>
                              </select>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 h-5 mb-1.5 flex items-center">Preferred Supplier / Vendor</label>
                          <input
                            type="text"
                            name="supplier"
                            value={(currentForm as any).supplier || ""}
                            onChange={handleFormChange}
                            placeholder="e.g. Global Beverages Ltd"
                            className="w-full h-11 px-4 text-sm rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeModalTab === "custom_fields" && (
                  <div className="space-y-6 max-w-3xl">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Custom Fields & Attributes</h3>
                      <p className="text-sm text-slate-500 mb-6">Add specialized identifiers, catalog attributes, and custom specifications.</p>
                    </div>

                    {/* Preset Catalog Identifiers */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 block">Standard Catalog Attributes</span>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-900 mb-1.5">Sub Category</label>
                          <input
                            type="text"
                            name="sub_category"
                            value={(currentForm as any).sub_category || ""}
                            onChange={handleFormChange}
                            placeholder="e.g. Milk Drinks, Bath Towels"
                            className="w-full h-11 px-4 text-sm rounded-xl border bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-900 mb-1.5">Internal Item Code</label>
                          <input
                            type="text"
                            name="item_code"
                            value={(currentForm as any).item_code || ""}
                            onChange={handleFormChange}
                            placeholder="e.g. ITM-001"
                            className="w-full h-11 px-4 text-sm rounded-xl border bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-900 mb-1.5">Weighing Scale Item Code</label>
                          <input
                            type="text"
                            name="weighing_scale_code"
                            value={(currentForm as any).weighing_scale_code || ""}
                            onChange={handleFormChange}
                            placeholder="e.g. 101"
                            className="w-full h-11 px-4 text-sm rounded-xl border bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-900 mb-1.5">Conversion Factor</label>
                          <input
                            type="text"
                            name="conversion_factor"
                            value={(currentForm as any).conversion_factor || ""}
                            onChange={handleFormChange}
                            placeholder="e.g. 1, 1000"
                            className="w-full h-11 px-4 text-sm rounded-xl border bg-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Dynamic Key-Value Custom Fields */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Dynamic Custom Attributes</span>
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
                          No custom fields added yet. Click &quot;Add Custom Field&quot; to add specifications like Material, Color, Size, Warranty, etc.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {((currentForm as any).custom_fields || []).map((f: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
                              <input
                                type="text"
                                placeholder="Attribute Name (e.g. Color, Size, Material)"
                                value={f.key}
                                onChange={(e) => {
                                  const updated = [...(currentForm as any).custom_fields];
                                  updated[idx].key = e.target.value;
                                  setCurrentForm(prev => ({ ...prev, custom_fields: updated }));
                                }}
                                className="flex-1 h-9 px-3 text-xs rounded-lg border bg-slate-50 focus:bg-white font-semibold"
                              />
                              <input
                                type="text"
                                placeholder="Value (e.g. Matte Black, XL, Cotton)"
                                value={f.value}
                                onChange={(e) => {
                                  const updated = [...(currentForm as any).custom_fields];
                                  updated[idx].value = e.target.value;
                                  setCurrentForm(prev => ({ ...prev, custom_fields: updated }));
                                }}
                                className="flex-1 h-9 px-3 text-xs rounded-lg border bg-slate-50 focus:bg-white"
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

                {activeModalTab === "other" && (
                  <div className="space-y-6 max-w-3xl">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Other Details</h3>
                      <p className="text-sm text-slate-500 mb-6">Add descriptions and manage product status.</p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-1.5">Short Description</label>
                      <textarea
                        name="short_description"
                        value={currentForm.short_description || ""}
                        onChange={handleFormChange}
                        rows={3}
                        placeholder="Enter short description"
                        className="w-full p-4 text-sm rounded-xl border bg-background focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-1.5">Long Description</label>
                      <textarea
                        name="long_description"
                        value={currentForm.long_description || ""}
                        onChange={handleFormChange}
                        rows={5}
                        placeholder="Enter detailed description"
                        className="w-full p-4 text-sm rounded-xl border bg-background focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-1.5">Status</label>
                      <select
                        name="status"
                        value={currentForm.status}
                        onChange={handleFormChange}
                        className="w-full h-11 px-4 text-sm rounded-xl border bg-background focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                )}

              </div>
              
              {/* Footer */}
              <div className="p-5 border-t bg-slate-50 flex items-center justify-between shrink-0">
                <Button type="button" variant="outline" className="h-11 px-6 rounded-xl font-semibold bg-white hover:bg-slate-100" onClick={() => { setIsModalOpen(false); setEditingProductId(null); setCurrentForm(defaultFormData()); setActiveModalTab("basic"); }}>
                  Cancel
                </Button>
                <div className="flex gap-3">
                  {!editingProductId && (
                    <Button type="submit" name="saveAndNew" value="true" disabled={isSubmitting} variant="outline" className="h-11 px-6 rounded-xl font-semibold text-indigo-700 border-indigo-200 bg-indigo-50 hover:bg-indigo-100">
                      Save & New
                    </Button>
                  )}
                  <Button type="submit" disabled={isSubmitting} className="h-11 px-6 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all border-0">
                    {isSubmitting ? "Saving..." : editingProductId ? "Update Product" : "Save Product"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════
  //  RENDER: Table body for local products
  // ══════════════════════════════════════════════════════════════════
  const renderLocalRow = (product: InventoryProduct, visible: string[], isExact = false) => (
    <tr key={product.id} className={`hover:bg-muted/30 transition-colors ${isExact ? "bg-emerald-500/5 ring-1 ring-emerald-500/20" : ""}`}>
      {LOCAL_COLUMNS.filter(c => visible.includes(c.id)).map(col => {
        switch (col.id) {
          case "image":
            return (
              <td key="image" className="px-6 py-4">
                {product.image_url ? (
                  <img src={resolveImageUrl(product.image_url)} alt={product.name}
                    onClick={() => setPreviewImage(resolveImageUrl(product.image_url))}
                    className="size-10 rounded-lg object-cover border bg-white cursor-zoom-in hover:opacity-90 transition-opacity" />
                ) : (
                  <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Package className="size-5 text-muted-foreground" />
                  </div>
                )}
              </td>
            );
          case "name":
            return (
              <td key="name" className="px-6 py-4 font-bold">
                {product.name}
                {isExact && <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold text-[10px]">
                  <Barcode className="size-3" /> Exact Match
                </span>}
              </td>
            );
          case "sku":
            return <td key="sku" className="px-6 py-4 font-mono font-bold text-xs">{product.sku || '-'}</td>;
          case "barcode":
            return <td key="barcode" className="px-6 py-4 font-mono text-xs">{product.barcode || '-'}</td>;
          case "category":
            return <td key="category" className="px-6 py-4 text-xs font-medium">{product.category_name || (categories.find(c => c.id === product.category_id)?.name) || '-'}</td>;
          case "brand":
            return <td key="brand" className="px-6 py-4 text-xs font-medium">{product.brand_name || (brands.find(b => b.id === product.brand_id)?.name) || (product as any).brand || '-'}</td>;
          case "uom":
            return <td key="uom" className="px-6 py-4 text-xs font-medium">{product.uom_name || (uoms.find(u => u.id === product.uom_id)?.name) || '-'}</td>;
          case "purchase_price":
            return <td key="purchase_price" className="px-6 py-4">{formatCurrency(product.purchase_price)}</td>;
          case "mrp":
            return <td key="mrp" className="px-6 py-4 font-bold">{formatCurrency(product.mrp)}</td>;
          case "selling_price":
            return <td key="selling_price" className="px-6 py-4">{formatCurrency(product.selling_price)}</td>;
          case "wholesale_price":
            return <td key="wholesale_price" className="px-6 py-4 text-emerald-700 font-semibold">{formatCurrency((product as any).wholesale_price || 0)}</td>;
          case "b2b_price": {
            const bVal = (product as any).b2b_price ?? (product as any).specifications?.b2b_price ?? 0;
            return <td key="b2b_price" className="px-6 py-4 text-indigo-700 font-semibold">{formatCurrency(bVal)}</td>;
          }
          case "min_wholesale_qty":
            return <td key="min_wholesale_qty" className="px-6 py-4 text-xs font-mono">{(product as any).min_wholesale_qty || 1} pcs</td>;
          case "tax_percent":
            return <td key="tax_percent" className="px-6 py-4 text-xs">{product.tax_percent}%</td>;
          case "initial_stock":
            return (
              <td key="initial_stock" className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-full bg-muted rounded-full h-1.5 max-w-[80px]">
                    <div className={`h-1.5 rounded-full ${(product.stock ?? product.initial_stock) <= product.reorder_level ? 'bg-rose-500' : 'bg-primary'}`}
                      style={{ width: `${Math.min(100, ((product.stock ?? product.initial_stock) / (product.reorder_level > 0 ? product.reorder_level * 3 : 100)) * 100)}%` }} />
                  </div>
                  <span className="font-bold">{product.stock ?? product.initial_stock}</span>
                </div>
                {(product.stock ?? product.initial_stock) <= product.reorder_level && (
                  <div className="text-[10px] text-rose-500 font-bold mt-1">Low Stock!</div>
                )}
              </td>
            );
          case "reorder_level":
            return <td key="reorder_level" className="px-6 py-4 text-xs">{product.reorder_level}</td>;
          case "safety_stock":
            return <td key="safety_stock" className="px-6 py-4 text-xs">{product.safety_stock}</td>;
          case "status":
            return (
              <td key="status" className="px-6 py-4">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${product.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                  <span className={`size-1.5 rounded-full ${product.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  {product.status === 'active' ? 'Active' : 'Inactive'}
                </span>
              </td>
            );
          case "source":
            return <td key="source" className="px-6 py-4 text-xs"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold text-[10px]"><Store className="size-3" /> My Inventory</span></td>;
          default:
            return null;
        }
      })}
      <td className="px-6 py-4 text-right">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
            title="Configure Free Item / Promotional Scheme for this product"
            onClick={() => {
              setFreeQtyTriggerProductId(product.id);
              setIsFreeQtyModalOpen(true);
            }}
          >
            <Gift className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleDuplicate(product)}><Copy className="size-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(product.id)}><Archive className="size-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleEdit(product)}><Edit2 className="size-4" /></Button>
        </div>
      </td>
    </tr>
  );

  // ══════════════════════════════════════════════════════════════════
  //  RENDER: Table body for master catalog results
  // ══════════════════════════════════════════════════════════════════
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
          <h2 className="text-2xl font-bold tracking-tight">Products</h2>
          <p className="text-sm text-muted-foreground">
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
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
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
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
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
            onClose={() => setIsBarcodeDrawerOpen(false)}
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
    </div>
  );
}
