import { useState, useEffect, useRef, useMemo } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Filter, Plus, Package, Edit2, Archive, X, Sparkles, Globe, Loader2, Sliders, ShoppingCart, Store, Copy, Upload, Download, Barcode, Zap } from "lucide-react";
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



const localVisibleDefault = ["image", "name", "sku", "barcode", "category", "brand", "mrp", "initial_stock", "status"];
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
  item, onClose, onConfirm, isImporting,
}: {
  item: MasterResult;
  onClose: () => void;
  onConfirm: (item: MasterResult) => void;
  isImporting: boolean;
}) {
  const [initialStock, setInitialStock] = useState(10);
  const [sellingPrice, setSellingPrice] = useState(item.sale_price || item.mrp || 0);
  const [purchasePrice, setPurchasePrice] = useState(item.cost_price || (item.mrp ? item.mrp * 0.7 : 0));

  const isAISourced = item.source === "AI_WEB_SEARCH";

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
                {item.brand_name || item.brand || "General"} {item.category_name || item.category ? `• ${item.category_name || item.category}` : ""}
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
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" onClick={onClose} disabled={isImporting}>Cancel</Button>
            <Button onClick={() => onConfirm({
              ...item,
              cost_price: purchasePrice,
              sale_price: sellingPrice,
              initial_stock: initialStock,
            })} disabled={isImporting} className="gradient-brand text-white border-0">
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

  // ── Inventory data ───────────────────────────────────────────────
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);


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
  const loadData = async () => {
    try {
      const prodsRes = await inventoryApi.getProducts().catch((err) => {
        console.error("Failed to load products:", err);
        return { items: [] };
      });
      setProducts(prodsRes.items || []);
    } catch (error) {
      console.error("Failed in loadData:", error);
    } finally {
      setIsLoading(false);
    }

    // Load metadata asynchronously in the background — never blocks product list
    inventoryApi.getCategories().then((res) => setCategories(res.items || [])).catch(() => {});
    inventoryApi.getBrands().then((res) => setBrands(res.items || [])).catch(() => {});
    inventoryApi.getUOMs().then((res) => setUoms(res.items || [])).catch(() => {});
    inventoryApi.getWarehouses().then((res) => setWarehouses(res || [])).catch(() => {});
  };




  useEffect(() => { checkAiStatus(); }, []);
  useEffect(() => { loadData(); }, []);

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

  // ── Phase 2: Debounced search with exact-match priority ──────────
  useEffect(() => {
    const cleanSearch = search.trim();
    const isBarcode = /^\d{8,14}$/.test(cleanSearch);

    if (cleanSearch.length < 2) {
      setSuggestions([]);
      if (activeTab === "catalog") setMasterResults([]);
      setSearchError(null);
      setExactMatch(null);
      return;
    }

    // Phase 2: Check exact match FIRST (barcode/SKU priority)
    const exact = checkExactMatch(cleanSearch);
    if (exact) {
      setExactMatch(exact);
      setMasterResults([]);
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    } else {
      setExactMatch(null);
    }

    // ── FAST PATH: Barcode detected → use the instant DB lookup endpoint (~12ms) ──
    if (isBarcode) {
      const barcodeTimer = setTimeout(async () => {
        setIsSearchingMaster(true);
        setSearchError(null);
        try {
          const res = await inventoryApi.lookupProductByBarcode(cleanSearch);
          if (res?.success && res?.product) {
            const p = res.product;
            // Map to MasterResult shape so the UI renders immediately
            setMasterResults([{
              id: p.id,
              name: p.name,
              barcode: p.barcode || cleanSearch,
              brand_name: p.brand || "",
              category_name: p.category || "",
              mrp: p.mrp || 0,
              sale_price: p.selling_price || 0,
              image_url: p.image || "",
              short_description: p.package_size || "",
              source: p.source || "DATABASE",
            }]);
            setSuggestions([]);
          } else {
            setMasterResults([]);
            toast.info(`Barcode "${cleanSearch}" not found in database.`);
          }
        } catch (err: any) {
          console.error("Barcode lookup failed:", err);
          setSearchError(err.detail || err.message || "Lookup failed.");
        } finally {
          setIsSearchingMaster(false);
        }
      }, 150); // 150ms debounce for barcode (scanner fires all digits at once)

      return () => clearTimeout(barcodeTimer);
    }

    // ── NORMAL PATH: Text search → suggestions + master catalog ──
    const timer = setTimeout(async () => {
      // Local suggestions
      try {
        const sugs = await inventoryApi.getSearchSuggestions(cleanSearch);
        setSuggestions(sugs || []);
      } catch (err) {
        console.error("Suggestions fetch failed:", err);
      }

      // Master catalog search (DB search only, searchWeb = false for instant response)
      setIsSearchingMaster(true);
      setSearchError(null);
      try {
        const res = await inventoryApi.searchMasterCatalog(cleanSearch, false, "auto");
        setMasterResults(res || []);
      } catch (err: any) {
        console.error("Master search failed:", err);
        setSearchError(err.detail || err.message || "Search failed.");
      } finally {
        setIsSearchingMaster(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [search, aiPaused, activeTab, products]);


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

  // ── Phase 2: Import with preview ─────────────────────────────────
  const handleConfirmImport = async (item: MasterResult) => {
    try {
      setIsImporting(true);
      await inventoryApi.importToLocalInventory({
        name: item.name,
        sku: item.sku_code || `SKU-${item.barcode || Math.random().toString(36).slice(2, 9)}`,
        barcode: item.barcode || "",
        brand_name: item.brand_name || item.brand || "General",
        category_name: item.category_name || item.category || "General",
        sub_category_name: item.sub_category_name || item.sub_category || "General",
        short_description: item.short_description || item.specifications || "",
        specifications: item.specifications || "",
        image_url: item.image_url || "",
        purchase_price: item.cost_price || 0,
        mrp: item.mrp || 0,
        selling_price: item.sale_price || item.mrp || 0,
        tax_percent: 18,
        initial_stock: item.initial_stock || 10,
        supplier: item.supplier || "Global Sourced",
        warehouse: warehouses[0]?.name || "Main Warehouse",
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

  // ── Import from file ─────────────────────────────────────────────
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);

    const processData = async (rows: any[]) => {
      try {
        if (!rows?.length) throw new Error("File is empty.");
        const items = rows.map((row: any) => {
          const getVal = (keys: string[]) => {
            for (const k of keys) { if (row[k] != null) return String(row[k]).trim(); }
            return "";
          };
          const isActiveRaw = getVal(["is_active", "Active", "Status"]);
          const isActive = isActiveRaw === "" ? true : (isActiveRaw.toLowerCase() === 'true' || isActiveRaw === '1' || isActiveRaw.toLowerCase() === 'active');
          return {
            name: getVal(["Product Name", "name", "ProductName", "Product_Name"]) || "Unnamed",
            sku: getVal(["SKU", "sku"]) || "",
            barcode: getVal(["Barcode (EAN/UPC)", "barcode", "Barcode", "EAN", "UPC"]) || "",
            short_description: getVal(["Description", "description"]) || "",
            purchase_price: parseFloat(getVal(["Purchase Price", "purchase_price", "PurchasePrice", "Cost Price"])) || 0,
            mrp: parseFloat(getVal(["MRP", "mrp"])) || 0,
            selling_price: parseFloat(getVal(["Selling Price", "selling_price", "SellingPrice", "Base Price"])) || 0,
            tax_percent: parseFloat(getVal(["Tax (%)", "tax_percent", "Tax"])) || 0,
            discount_limit: parseFloat(getVal(["Discount Limit (%)", "discount_limit", "Discount Limit"])) || 0,
            initial_stock: parseInt(getVal(["Quantity", "quantity", "stock", "initial_stock", "Stock"]), 10) || 0,
            reorder_level: parseInt(getVal(["Reorder Level", "reorder_level", "ReorderLevel"]), 10) || 10,
            status: isActive ? "active" : "inactive",
            brand_name: getVal(["Brand", "brand", "Brand Name"]),
            category_name: getVal(["Category", "category", "Category Name"]),
            sub_category_name: getVal(["Sub Category", "sub_category", "Sub Category Name"]),
            uom_name: getVal(["UOM", "uom", "Unit", "unit", "Unit of Measure", "Unit of Measure (UoM)"]),
          };
        });
        const res = await inventoryApi.masterImportProducts(items);
        alert(`Master Import Complete!\n\nProducts Created: ${res.products_created}\nBrands: ${res.brands_created}\nCategories: ${res.categories_created}\nUOMs: ${res.uoms_created}\nDuplicates Skipped: ${res.skipped_count}`);
        await loadData();
      } catch (error: any) {
        alert("Import failed: " + (error.detail || error.message || "Unknown"));
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
        value={search} onChange={(e) => { setSearch(e.target.value); setShowSuggestions(true); setExactMatch(null); }}
        onFocus={() => setShowSuggestions(true)}
        placeholder={activeTab === "inventory"
          ? "Search by name, SKU, or Barcode..."
          : "Search master catalog..."}
        className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30 outline-none"
      />
      {/* ── Suggestions dropdown ─────────────────────────────────── */}
      {showSuggestions && suggestions.length > 0 && (
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

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Product Name", name: "name", required: true },
              { label: "SKU", name: "sku" },
              { label: "Barcode", name: "barcode" },
              { label: "Brand", name: "brand_id", type: "select", options: brands },
              { label: "Category", name: "category_id", type: "select", options: categories },
              { label: "UoM", name: "uom_id", type: "select", options: uoms },

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
            ].map(field => (
              <div key={field.name} className={field.name === "name" ? "col-span-2" : ""}>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{field.label}{(field as any).required && <span className="text-red-500 ml-0.5">*</span>}</label>
                {field.type === "select" ? (
                  <select name={field.name} value={(currentForm as any)[field.name]} onChange={handleFormChange}
                    className="w-full h-10 px-3 text-sm rounded-lg border bg-background">
                    <option value="">Select {field.label}</option>
                    {(field.options || []).map((opt: any) => (
                      <option key={opt.id} value={opt.id}>{opt.name}</option>
                    ))}
                  </select>
                ) : (
                  <input type={(field as any).type || "text"} name={field.name} step={(field as any).step || "any"}
                    value={(currentForm as any)[field.name]} onChange={handleFormChange}
                    className="w-full h-10 px-3 text-sm rounded-lg border bg-background"
                  />
                )}
              </div>
            ))}
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
          <Button variant="outline"><Filter className="size-4 mr-2" /> Filters</Button>
        )}
        {activeTab === "inventory" && renderColumnsMenu()}
      </div>


      {/* ══════════════════════════════════════════════════════════════
           INVENTORY TAB — Two-source unified view
           ══════════════════════════════════════════════════════════════ */}
      {activeTab === "inventory" && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
                <tr>
                  {localVisibleColumns.map((colId) => {
                    const col = LOCAL_COLUMNS.find(c => c.id === colId);
                    if (!col) return null;
                    return <th key={col.id} className="px-6 py-4">{col.label}</th>;
                  })}
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={localVisibleColumns.length + 1} className="px-6 py-8 text-center text-muted-foreground">
                    <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Loading...</span>
                  </td></tr>
                ) : !hasSearch ? (
                  // ── No search: full product list ─────────────────────
                  products.length === 0 ? (
                    <tr><td colSpan={localVisibleColumns.length + 1} className="px-6 py-12 text-center">
                      <Package className="size-10 mx-auto mb-2 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground font-medium">No products yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Create your first product or import from the Master Catalog.</p>
                      <div className="flex gap-2 justify-center mt-3">
                        <Button size="sm" onClick={openCreateModal} className="gradient-brand text-white border-0">Create Product</Button>
                        <Button size="sm" variant="outline" onClick={() => setActiveTab("catalog")}>
                          <Globe className="size-3 mr-1" /> Browse Master Catalog
                        </Button>
                      </div>
                    </td></tr>
                  ) : (
                    products.map(p => renderLocalRow(p, localVisibleColumns))
                  )
                ) : exactMatch ? (
                  // ── Phase 2: Exact match found (barcode/SKU priority) ─
                  <>
                    <tr className="bg-emerald-50/60 border-y border-emerald-200/50">
                      <td colSpan={localVisibleColumns.length + 1} className="px-6 py-2.5">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wider">
                          <Barcode className="size-4" />
                          Exact Match Found
                          <span className="font-normal normal-case tracking-normal text-emerald-600 ml-1">— matched by barcode or SKU</span>
                        </span>
                      </td>
                    </tr>
                    {renderLocalRow(exactMatch, localVisibleColumns, true)}
                  </>
                ) : fuzzyLocalResults.length > 0 ? (
                  // ── Phase 2: Two groups — local first, then master ─────
                  <>
                    {/* Local results header */}
                    <tr className="bg-emerald-50/40 border-y border-emerald-100/50">
                      <td colSpan={localVisibleColumns.length + 1} className="px-6 py-2.5">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wider">
                          <Store className="size-4" />
                          In Your Inventory
                          <span className="font-normal normal-case tracking-normal text-emerald-600 ml-1">({fuzzyLocalResults.length} result{fuzzyLocalResults.length !== 1 ? 's' : ''})</span>
                        </span>
                      </td>
                    </tr>
                    {fuzzyLocalResults.map(p => renderLocalRow(p, localVisibleColumns))}

                    {/* Master catalog results — shown as second group */}
                    {showMasterResults && (
                      <>
                        <tr className="bg-indigo-50/50 border-y">
                          <td colSpan={localVisibleColumns.length + 1} className="px-6 py-2.5">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 uppercase tracking-wider">
                              <Globe className="size-4" />
                              From Master Catalog
                              <span className="font-normal normal-case tracking-normal text-indigo-600 ml-1">({uniqueMasterResults.length} product{uniqueMasterResults.length !== 1 ? 's' : ''} not yet in your inventory)</span>
                            </span>
                          </td>
                        </tr>
                        {uniqueMasterResults.map((item, idx) => renderMasterRow(item, localVisibleColumns))}
                      </>
                    )}
                  </>
                ) : showMasterResults ? (
                  // ── Only master results (no local matches) ───────────
                  <>
                    <tr className="bg-indigo-50/50 border-y">
                      <td colSpan={localVisibleColumns.length + 1} className="px-6 py-2.5">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 uppercase tracking-wider">
                          <Globe className="size-4" />
                          From Master Catalog
                          <span className="font-normal normal-case tracking-normal text-indigo-600 ml-1">(not found in your inventory — import to add)</span>
                        </span>
                      </td>
                    </tr>
                    {uniqueMasterResults.map((item, idx) => renderMasterRow(item, localVisibleColumns))}
                  </>
                ) : null}

                {/* ── Phase 2: Quick-add CTA when nothing found ──────── */}
                {hasNoResults && (
                  <tr>
                    <td colSpan={localVisibleColumns.length + 1} className="px-6 py-8">
                      <div className="flex flex-col items-center gap-3 text-center">
                        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                          <Search className="size-6 text-muted-foreground/50" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">No results found for "{search}"</p>
                          <p className="text-xs text-muted-foreground/70 mt-0.5">This product isn't in your inventory or the master catalog.</p>
                        </div>
                        <Button size="sm" onClick={handleQuickAdd} className="gradient-brand text-white border-0">
                          <Zap className="size-3.5 mr-1.5" />
                          Quick Add "{search.length > 20 ? search.slice(0, 20) + '...' : search}"
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}

                {isSearchingMaster && showLocalResults && (
                  <tr><td colSpan={localVisibleColumns.length + 1} className="px-6 py-4 text-center text-indigo-600 font-semibold text-xs">
                    <span className="inline-flex items-center gap-2"><Loader2 className="size-3.5 animate-spin" /> Searching master catalog...</span>
                  </td></tr>
                )}
                {searchError && (
                  <tr><td colSpan={localVisibleColumns.length + 1} className="px-6 py-3 bg-rose-50 border-y">
                    <div className="flex items-center gap-2 text-xs font-bold text-rose-700">
                      <X className="size-4 text-rose-500 shrink-0" /><span>{searchError}</span>
                    </div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
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
