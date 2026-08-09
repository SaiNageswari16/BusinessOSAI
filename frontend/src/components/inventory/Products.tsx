import { useState, useEffect, useRef, useMemo } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Filter, Plus, Package, Edit2, Archive, X, Sparkles, Globe, Loader2, Sliders, ShoppingCart, Store, Copy, Upload, Download, Barcode, Zap, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

import { inventoryApi, InventoryProduct, InventoryCategory, type Warehouse, resolveImageUrl } from "../../lib/api-client";
import { useHardwareBarcodeScanner } from "../../hooks/useHardwareBarcodeScanner";
import { motion, AnimatePresence } from "framer-motion";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { formatCurrency } from "../../lib/utils";

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
  purchase_price: 0, mrp: 0, selling_price: 0, wholesale_price: 0, min_wholesale_qty: 1, tax_percent: 0,
  discount_limit: 0, initial_stock: 0, reorder_level: 0, safety_stock: 0,
  image_url: "", short_description: "", long_description: "", status: "active"
});



const localVisibleDefault = ["image", "name", "sku", "barcode", "category", "brand", "mrp", "selling_price", "wholesale_price", "min_wholesale_qty", "initial_stock", "status"];
const masterVisibleDefault = ["image", "name", "sku", "barcode", "category", "brand", "mrp", "selling_price", "source"];

// ── Column menu sub-component ───────────────────────────────────────
function ColumnMenu({
  columns, visible, onToggle, onSave, onReset, onClose,
}: {
  columns: typeof LOCAL_COLUMNS;
  visible: string[];
  onToggle: (id: string) => void;
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
          onClick={() => visible.length === columns.length
            ? onReset()
            : onToggle(columns.map(c => c.id).filter(id => !visible.includes(id))[0] || columns[0].id)}
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
              onChange={(e) => { if (e.target.checked) onToggle(col.id); }}
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
  const [initialStock, setInitialStock] = useState(item.initial_stock || 10);
  const [sellingPrice, setSellingPrice] = useState(item.sale_price || item.mrp || 0);
  const [purchasePrice, setPurchasePrice] = useState(item.cost_price || (item.mrp ? item.mrp * 0.7 : 0));
  // Category selection: default to matching name if found
  const matchedCat = categories.find(c => !c.parent_id && c.name.toLowerCase() === (item.category_name || "").toLowerCase());
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(matchedCat?.id || "");
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string>("");

  const isAISourced = item.source === "AI_WEB_SEARCH";

  // Top-level categories (parents)
  const parentCategories = categories.filter(c => !c.parent_id);
  // Sub-categories of selected parent
  const subCategories = selectedCategoryId
    ? categories.filter(c => c.parent_id === selectedCategoryId)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
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
              <p className="text-xs text-muted-foreground">
                {item.brand_name || item.brand || ""}
              </p>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[10px] mt-1 ${isAISourced ? "bg-amber-500/10 text-amber-600" : "bg-indigo-500/10 text-indigo-600"}`}>
                <Sparkles className="size-3" /> {isAISourced ? "AI Sourced" : "Global Catalog"}
              </span>
            </div>
          </div>

          {/* Specs preview */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {item.sku_code && <div><span className="text-muted-foreground">SKU:</span> <span className="font-mono font-bold">{item.sku_code}</span></div>}
            {item.barcode && <div><span className="text-muted-foreground">Barcode:</span> <span className="font-mono font-bold">{item.barcode}</span></div>}
            {item.mrp && <div><span className="text-muted-foreground">MRP:</span> <span className="font-bold">{formatCurrency(item.mrp)}</span></div>}
            {item.sale_price && <div><span className="text-muted-foreground">Sale Price:</span> <span className="font-bold">{formatCurrency(item.sale_price)}</span></div>}
            {item.cost_price && <div><span className="text-muted-foreground">Cost:</span> <span className="font-bold">{formatCurrency(item.cost_price)}</span></div>}
            {item.specifications && <div className="col-span-2"><span className="text-muted-foreground">Specs:</span> <span className="text-[11px]">{item.specifications}</span></div>}
          </div>

          {/* Editable fields */}
          <div className="space-y-3 pt-3 border-t">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Customize Import</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Initial Stock</label>
                <input type="number" value={initialStock} onChange={(e) => setInitialStock(parseInt(e.target.value) || 0)}
                  className="w-full h-9 px-3 text-sm rounded-lg border bg-background" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Selling Price (₹)</label>
                <input type="number" step="0.01" value={sellingPrice} onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                  className="w-full h-9 px-3 text-sm rounded-lg border bg-background" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Purchase Price (₹)</label>
                <input type="number" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)}
                  className="w-full h-9 px-3 text-sm rounded-lg border bg-background" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Supplier</label>
                <input type="text" value={item.supplier || ""} readOnly
                  className="w-full h-9 px-3 text-sm rounded-lg border bg-muted/50 text-muted-foreground" />
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

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" onClick={onClose} disabled={isImporting}>Cancel</Button>
            <Button onClick={() => {
              const selectedCat = categories.find(c => c.id === selectedCategoryId);
              const selectedSubCat = categories.find(c => c.id === selectedSubCategoryId);
              onConfirm({
                ...item,
                cost_price: purchasePrice,
                sale_price: sellingPrice,
                initial_stock: initialStock,
                // Pass selected category info — IDs take priority for direct DB linkage
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
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentForm, setCurrentForm] = useState(defaultFormData());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formData = useMemo(() => defaultFormData(), []);

  // ── Quick-add modal state ────────────────────────────────────────
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");

  // ── Import preview state ────────────────────────────────────────
  const [previewItem, setPreviewItem] = useState<MasterResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // ── Derived ──────────────────────────────────────────────────────
  const localBarcodes = useMemo(() => new Set(products.map(p => p.barcode).filter(Boolean)), [products]);
  const localNames = useMemo(() => new Set(products.map(p => p.name.toLowerCase())), [products]);
  const localSkus = useMemo(() => new Set(products.map(p => p.sku?.toLowerCase()).filter(Boolean) as string[]), [products]);
  const uniqueMasterResults = masterResults.filter(m =>
    (!m.barcode || !localBarcodes.has(m.barcode)) && !localNames.has(m.name.toLowerCase())
  );

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
    inventoryApi.getWarehouses().then((res) => setWarehouses(Array.isArray(res) ? res : (res?.items || []))).catch(() => {});
  };

  useEffect(() => { checkAiStatus(); }, []);
  useEffect(() => { loadData(search); }, [currentPage, pageSize, sortBy, sortOrder]);


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
          const res = await inventoryApi.searchMasterCatalog(cleanSearch, false, "auto");
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
    setIsSearchingMaster(true);
    setSearchError(null);
    setExactMatch(null);
    setMasterResults([]);
    try {
      const res = await inventoryApi.searchMasterCatalog(sug, false, "auto");
      setMasterResults(res || []);
      if (res?.length) toast.success(`Found ${res.length} result(s)`);
    } catch (err: any) {
      console.error("Search failed:", err);
      setSearchError(err.detail || err.message || "Search failed.");
    } finally {
      setIsSearchingMaster(false);
    }
  };

  // ── Product CRUD ─────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        ...currentForm,
        brand_id: currentForm.brand_id || null,
        category_id: currentForm.category_id || null,
        uom_id: currentForm.uom_id || null,
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
    setCurrentForm({
      name: product.name,
      brand: product.brand_name || product.brand || "",
      brand_id: product.brand_id || "",
      sku: product.sku || "",
      barcode: product.barcode || "",
      category_id: product.category_id || "",
      uom_id: product.uom_id || "",
      warehouse: product.warehouse || "",
      supplier: product.supplier || "",
      purchase_price: product.purchase_price || 0,
      mrp: product.mrp || 0,
      selling_price: product.selling_price || 0,
      wholesale_price: product.wholesale_price || 0,
      min_wholesale_qty: product.min_wholesale_qty || 1,
      tax_percent: product.tax_percent || 0,
      discount_limit: product.discount_limit || 0,
      initial_stock: product.stock ?? product.initial_stock ?? 0,
      reorder_level: product.reorder_level || 0,
      safety_stock: product.safety_stock || 0,
      image_url: product.image_url || "",
      short_description: product.short_description || "",
      long_description: product.long_description || "",
      status: product.status || "active"
    });
    setEditingProductId(product.id);
    setIsModalOpen(true);
  };

  const handleDuplicate = (product: any) => {
    setCurrentForm({
      name: product.name + " (Copy)",
      brand: product.brand_name || product.brand || "",
      brand_id: product.brand_id || "",
      sku: (product.sku || "") + "-COPY",
      barcode: "",
      category_id: product.category_id || "",
      uom_id: product.uom_id || "",
      warehouse: product.warehouse || "",
      supplier: product.supplier || "",
      purchase_price: product.purchase_price || 0,
      mrp: product.mrp || 0,
      selling_price: product.selling_price || 0,
      wholesale_price: product.wholesale_price || 0,
      min_wholesale_qty: product.min_wholesale_qty || 1,
      tax_percent: product.tax_percent || 0,
      discount_limit: product.discount_limit || 0,
      initial_stock: product.stock ?? product.initial_stock ?? 0,
      reorder_level: product.reorder_level || 0,
      safety_stock: product.safety_stock || 0,
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

          return {
            name: nameVal,
            sku: skuVal,
            barcode: barcodeVal,
            short_description: findVal(["DESCRIPTION", "Short Description", "short_description", "description", "Description", "details"]),
            purchase_price: parseFloat(findVal(["PURCHASEPRICEAFTERTAX", "PURCHASEPRICEBEFORETAX", "Purchase Price", "purchase_price", "purchaseprice", "cost_price", "cost", "Cost Price"])) || 0,
            mrp: parseFloat(findVal(["MRP", "mrp", "retail_price", "list_price"])) || 0,
            selling_price: parseFloat(findVal(["SALESPRICEAFTERTAX", "SALESPRICEBEFORETAX", "Selling Price", "selling_price", "sellingprice", "price", "Price", "base_price"])) || 0,
            tax_percent: parseFloat(findVal(["SALESTAXPERCENT", "Tax (%)", "tax_percent", "tax", "Tax"])) || 0,
            discount_limit: parseFloat(findVal(["Discount Limit (%)", "discount_limit"])) || 0,
            initial_stock: parseInt(findVal(["STOCK", "Quantity", "quantity", "stock", "initial_stock", "Stock", "qty"]), 10) || 0,
            reorder_level: parseInt(findVal(["Reorder Level", "reorder_level"]), 10) || 10,
            status: isActive ? "active" : "inactive",
            brand_name: findVal(["Brand", "brand", "Brand Name", "brand_name", "manufacturer"]),
            category_name: findVal(["CATEGORY", "Category", "category", "Category Name", "category_name"]),
            sub_category_name: findVal(["Sub Category", "sub_category", "sub_category_name"]),
            uom_name: findVal(["SALESMEASURINGUNIT", "PURCHASEMEASURINGUNIT", "UOM", "uom", "Unit", "unit", "Unit of Measure", "uom_name"]),
            hsn_code: findVal(["HSN", "hsn", "HSN Code", "hsn_code", "hsncode", "tax_hsn", "HSN/SAC", "hsn/sac"]),
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

  // ── Search bar renderer ─────────────────────────────────────────
  const renderSearchBar = () => (
    <div className="relative flex-1 max-w-sm" ref={suggestionsRef}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
      <input
        value={search} onChange={(e) => { setSearch(e.target.value); if (activeTab === "catalog") setShowSuggestions(true); setExactMatch(null); }}
        onFocus={() => { if (activeTab === "catalog") setShowSuggestions(true); }}
        placeholder={activeTab === "inventory"
          ? "Search inventory by name, SKU, or Barcode..."
          : "Search master catalog..."}
        className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30 outline-none"
      />
      {/* ── Suggestions dropdown (Only on Master Catalog tab) ── */}
      {activeTab === "catalog" && showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="text-[10px] font-bold text-slate-400 px-3 py-1.5 bg-slate-50/50 uppercase border-b border-slate-100">
            Sourcing Suggestions
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
            {suggestions.map((sug, idx) => (
              <button key={idx} type="button" onClick={() => handleSelectSuggestion(sug)}
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
    setCurrentForm(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }));
  };

  // ══════════════════════════════════════════════════════════════════
  //  RENDER: Product form modal
  // ══════════════════════════════════════════════════════════════════
  const renderProductForm = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold">{editingProductId ? "Edit Product" : "Create Product"}</h2>
          <button onClick={() => { setIsModalOpen(false); setEditingProductId(null); setCurrentForm(defaultFormData()); }} className="p-1.5 rounded-lg hover:bg-muted"><X className="size-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Product Image Upload Section */}
          <div className="border-b pb-4 mb-4">
            <label className="block text-xs font-semibold text-muted-foreground mb-2">Product Image</label>
            <div className="flex items-center gap-4">
              {currentForm.image_url ? (
                <div className="relative size-20 rounded-xl overflow-hidden border bg-white group shadow-sm">
                  <img src={resolveImageUrl(currentForm.image_url)} alt="Preview" className="object-cover w-full h-full" />
                  <button type="button" onClick={() => setCurrentForm(p => ({ ...p, image_url: "" }))} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity cursor-pointer border-0">
                    Remove
                  </button>
                </div>
              ) : (
                <div className="size-20 rounded-xl border border-dashed flex items-center justify-center text-muted-foreground bg-muted/20">
                  <Package className="size-6 text-muted-foreground opacity-60" />
                </div>
              )}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
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
                  <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById("prod-img-upload")?.click()} className="cursor-pointer">
                    <Upload className="size-3.5 mr-1.5" /> Upload Photo
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">PNG, JPG or WebP — Max 5MB. Matches local listings style.</p>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          {(() => {
            const selectedCatObj = categories.find(c => c.id === currentForm.category_id);
            const activeParentId = selectedCatObj ? (selectedCatObj.parent_id || selectedCatObj.id) : "";
            const activeSubId = selectedCatObj && selectedCatObj.parent_id ? selectedCatObj.id : "";
            
            const mainCategories = categories.filter(c => !c.parent_id);
            const subCategories = categories.filter(c => c.parent_id && c.parent_id === activeParentId);

            return (
              <div className="grid grid-cols-2 gap-4">
                {/* Product Name */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Product Name<span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={currentForm.name}
                    onChange={handleFormChange}
                    required
                    className="w-full h-10 px-3 text-sm rounded-lg border bg-background"
                  />
                </div>

                {/* SKU & Barcode */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">SKU</label>
                  <input
                    type="text"
                    name="sku"
                    value={currentForm.sku}
                    onChange={handleFormChange}
                    className="w-full h-10 px-3 text-sm rounded-lg border bg-background"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Barcode</label>
                  <input
                    type="text"
                    name="barcode"
                    value={currentForm.barcode}
                    onChange={handleFormChange}
                    className="w-full h-10 px-3 text-sm rounded-lg border bg-background"
                  />
                </div>

                {/* Brand & Category */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Brand</label>
                  <select
                    name="brand_id"
                    value={currentForm.brand_id}
                    onChange={handleFormChange}
                    className="w-full h-10 px-3 text-sm rounded-lg border bg-background"
                  >
                    <option value="">Select Brand</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
                  <select
                    value={activeParentId}
                    onChange={(e) => {
                      const newParentId = e.target.value;
                      setCurrentForm(prev => ({ ...prev, category_id: newParentId }));
                    }}
                    className="w-full h-10 px-3 text-sm rounded-lg border bg-background"
                  >
                    <option value="">Select Category</option>
                    {mainCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Sub-Category & UoM */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Sub-Category</label>
                  <select
                    value={activeSubId}
                    disabled={!activeParentId}
                    onChange={(e) => {
                      const newSubId = e.target.value;
                      setCurrentForm(prev => ({ ...prev, category_id: newSubId || activeParentId }));
                    }}
                    className="w-full h-10 px-3 text-sm rounded-lg border bg-background disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">{activeParentId ? "Select Sub-Category (Optional)" : "Select Category First"}</option>
                    {subCategories.map((sc) => (
                      <option key={sc.id} value={sc.id}>{sc.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">UoM</label>
                  <select
                    name="uom_id"
                    value={currentForm.uom_id}
                    onChange={handleFormChange}
                    className="w-full h-10 px-3 text-sm rounded-lg border bg-background"
                  >
                    <option value="">Select UoM</option>
                    {uoms.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                {/* Pricing & Stock Fields */}
                {[
                  { label: "Purchase Price", name: "purchase_price", type: "number", step: "0.01" },
                  { label: "MRP", name: "mrp", type: "number", step: "0.01" },
                  { label: "Retail Selling Price", name: "selling_price", type: "number", step: "0.01" },
                  { label: "Wholesale Price", name: "wholesale_price", type: "number", step: "0.01" },
                  { label: "Min Wholesale Qty", name: "min_wholesale_qty", type: "number" },
                  { label: "Tax (%)", name: "tax_percent", type: "number" },
                  { label: "Discount Limit (%)", name: "discount_limit", type: "number" },
                  { label: "Initial Stock", name: "initial_stock", type: "number" },
                  { label: "Reorder Level", name: "reorder_level", type: "number" },
                  { label: "Safety Stock", name: "safety_stock", type: "number" },
                  { label: "Warehouse", name: "warehouse" },
                  { label: "Supplier", name: "supplier" },
                ].map((field) => (
                  <div key={field.name}>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{field.label}</label>
                    <input
                      type={field.type || "text"}
                      name={field.name}
                      step={field.step || "any"}
                      value={(currentForm as any)[field.name]}
                      onChange={handleFormChange}
                      className="w-full h-10 px-3 text-sm rounded-lg border bg-background"
                    />
                  </div>
                ))}
              </div>
            );
          })()}

            {/* HSN Code Selector */}
            <div className="col-span-2 bg-muted/20 p-3 rounded-xl border border-dashed space-y-2">
              <label className="block text-xs font-semibold text-muted-foreground">
                HSN Code & GST Tax Schedule Lookup
              </label>
              <div className="flex gap-2">
                <select
                  className="flex-1 h-10 px-3 text-sm rounded-lg border bg-background"
                  value={(currentForm as any).hsn_code || ""}
                  onChange={(e) => {
                    const selectedCode = e.target.value;
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
                  <option value="">Select Official HSN Code / GST Rate...</option>
                  {hsnCodes.map((item) => (
                    <option key={item.hsn_code} value={item.hsn_code}>
                      {item.hsn_code} — {item.description.slice(0, 55)}... ({item.gst_rate}% GST)
                    </option>
                  ))}
                </select>
              </div>
              {(currentForm as any).hsn_code && (
                <p className="text-[11px] text-emerald-600 font-medium">
                  Auto-assigned GST Tax Rate: {(currentForm as any).tax_percent}%
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">

            <Button type="button" variant="outline" onClick={() => { setIsModalOpen(false); setEditingProductId(null); setCurrentForm(defaultFormData()); }}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="gradient-brand text-white border-0">
              {isSubmitting ? "Saving..." : editingProductId ? "Update Product" : "Create Product"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════
  //  RENDER: Table body for local products
  // ══════════════════════════════════════════════════════════════════
  const renderLocalRow = (product: InventoryProduct, visible: string[], isExact = false) => (
    <tr key={product.id} className={`hover:bg-muted/30 transition-colors ${isExact ? "bg-emerald-500/5 ring-1 ring-emerald-500/20" : ""}`}>
      {visible.includes("image") && (
        <td className="px-6 py-4">
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
      )}
      {visible.includes("name") && (
        <td className="px-6 py-4 font-bold">
          {product.name}
          {isExact && <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold text-[10px]">
            <Barcode className="size-3" /> Exact Match
          </span>}
        </td>
      )}
      {visible.includes("sku") && <td className="px-6 py-4 font-mono font-bold text-xs">{product.sku || '-'}</td>}
      {visible.includes("barcode") && <td className="px-6 py-4 font-mono text-xs">{product.barcode || '-'}</td>}
      {visible.includes("category") && <td className="px-6 py-4 text-xs font-medium">{product.category_name || (categories.find(c => c.id === product.category_id)?.name) || '-'}</td>}
      {visible.includes("brand") && <td className="px-6 py-4 text-xs font-medium">{product.brand_name || (brands.find(b => b.id === product.brand_id)?.name) || (product as any).brand || '-'}</td>}
      {visible.includes("uom") && <td className="px-6 py-4 text-xs font-medium">{product.uom_name || (uoms.find(u => u.id === product.uom_id)?.name) || '-'}</td>}

      {/* Selling Prices */}
      {visible.includes("purchase_price") && <td className="px-6 py-4">{formatCurrency(product.purchase_price)}</td>}
      {visible.includes("mrp") && <td className="px-6 py-4 font-bold">{formatCurrency(product.mrp)}</td>}
      {visible.includes("selling_price") && <td className="px-6 py-4">{formatCurrency(product.selling_price)}</td>}
      {visible.includes("wholesale_price") && <td className="px-6 py-4 text-emerald-700 font-semibold">{formatCurrency((product as any).wholesale_price || 0)}</td>}
      {visible.includes("min_wholesale_qty") && <td className="px-6 py-4 text-xs font-mono">{(product as any).min_wholesale_qty || 1} pcs</td>}
      {visible.includes("tax_percent") && <td className="px-6 py-4 text-xs">{product.tax_percent}%</td>}

      {visible.includes("initial_stock") && (
        <td className="px-6 py-4">
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
      )}
      {visible.includes("reorder_level") && <td className="px-6 py-4 text-xs">{product.reorder_level}</td>}
      {visible.includes("safety_stock") && <td className="px-6 py-4 text-xs">{product.safety_stock}</td>}
      {visible.includes("status") && (
        <td className="px-6 py-4">
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${product.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
            <span className={`size-1.5 rounded-full ${product.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            {product.status === 'active' ? 'Active' : 'Inactive'}
          </span>
        </td>
      )}
      {visible.includes("source") && <td className="px-6 py-4 text-xs"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold text-[10px]"><Store className="size-3" /> My Inventory</span></td>}
      <td className="px-6 py-4 text-right">
        <div className="flex justify-end gap-1">
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
        {visible.includes("image") && (
          <td className="px-6 py-4">
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
        )}
        {visible.includes("name") && (
          <td className="px-6 py-4 font-bold text-indigo-950">
            <div>{item.name}</div>
            <div className="text-[10px] text-indigo-500 font-semibold uppercase mt-0.5">{sourceLabel}</div>
          </td>
        )}
        {visible.includes("sku") && <td className="px-6 py-4 font-mono font-bold text-xs text-indigo-900">{item.sku_code || '-'}</td>}
        {visible.includes("barcode") && <td className="px-6 py-4 font-mono text-xs text-indigo-750">{item.barcode || '-'}</td>}
        {visible.includes("category") && <td className="px-6 py-4 text-xs text-indigo-800">{item.category_name || item.category || '-'}</td>}
        {visible.includes("brand") && <td className="px-6 py-4 text-xs text-indigo-800">{item.brand_name || item.brand || '-'}</td>}
        {visible.includes("mrp") && <td className="px-6 py-4 font-bold text-indigo-950">{formatCurrency(item.mrp)}</td>}
        {visible.includes("selling_price") && <td className="px-6 py-4 text-indigo-800">{formatCurrency(item.sale_price)}</td>}
        {visible.includes("specifications") && <td className="px-6 py-4 text-xs text-indigo-800 max-w-xs truncate">{item.specifications || '-'}</td>}
        {visible.includes("source") && (
          <td className="px-6 py-4">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[10px] ${isAISourced ? "bg-amber-500/10 text-amber-600" : "bg-indigo-500/10 text-indigo-600"}`}>
              <Sparkles className="size-3" /> {sourceLabel}
            </span>
          </td>
        )}
        <td className="px-6 py-4 text-right">
          <Button variant="default" size="sm" className="h-7 text-[11px] font-bold"
            onClick={() => setPreviewItem(item)}>
            <ShoppingCart className="size-3 mr-1" /> Import
          </Button>
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
          <Button variant="outline" className="hidden lg:flex" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            <Upload className="size-4 mr-2" /> {isImporting ? "Importing..." : "Import File"}
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={fuzzyLocalResults.length === 0}>
            <Download className="size-4 mr-2" /> Export
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
                  {localVisibleColumns.map((colId) => {
                    const col = LOCAL_COLUMNS.find(c => c.id === colId);
                    if (!col) return null;
                    return <th key={col.id} className="px-6 py-4 whitespace-nowrap">{col.label}</th>;
                  })}
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
                    {masterVisibleColumns.map((colId) => {
                    const col = MASTER_COLUMNS.find(c => c.id === colId);
                    if (!col) return null;
                    return <th key={col.id} className="px-6 py-4">{col.label}</th>;
                  })}
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
    </div>
  );
}
