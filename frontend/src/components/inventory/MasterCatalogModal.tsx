import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import {
  Search,
  Globe,
  Database,
  Upload,
  Plus,
  CheckCircle,
  Loader2,
  Sparkles,
  Barcode,
  Tag,
  Package,
  Layers,
  FileSpreadsheet,
  X,
  Building2,
  DollarSign,
  ShieldCheck,
  Zap,
  Info
} from "lucide-react";
import { inventoryApi } from "@/lib/api-client";
import { useCurrency } from "@/hooks/use-currency";

interface MasterCatalogItem {
  id?: string;
  name: string;
  brand?: string;
  barcode?: string;
  sku_code?: string;
  product_code?: string;
  hsn_code?: string;
  plu_no?: string;
  
  cost_price?: number;
  mrp?: number;
  sale_price?: number;
  wholesale_price?: number;
  special_price?: number;
  online_price?: number;
  
  weight?: string;
  quantity?: number;
  expired_quantity?: number;
  near_expiry_quantity?: number;
  
  tax?: number;
  type?: string;
  cess?: number;
  cess_on?: number;
  cess_type?: string;
  tax_amount?: number;
  taxable_value?: number;
  cess_tax_amount?: number;
  additional_cess_tax_amount?: number;
  
  supplier?: string;
  discount_rs?: number;
  discount_percent?: number;
  actual_margin_rs?: number;
  margin_on_cp?: number;
  margin_on_sp?: number;
  category?: string;
  sub_category?: string;
  instock_value?: number;

  image_url?: string;
  short_description?: string;
  specifications?: string;
  source?: "MASTER_DB" | "AI_WEB_SEARCH" | "EXCEL_IMPORT";
  ai_search_done?: boolean;
  rag_status?: string;
  rag_enriched_at?: string;
  rag_error?: string;
}

interface MasterCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductAdded?: () => void;
}

export const MasterCatalogModal: React.FC<MasterCatalogModalProps> = ({
  isOpen,
  onClose,
  onProductAdded
}) => {
    const { currency, formatCurrency } = useCurrency();
  const [searchQuery, setSearchQuery] = useState("");
  const [provider, setProvider] = useState<"gemini" | "openai" | "auto">("auto");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<MasterCatalogItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // RAG Enrichment Tracking Hooks
  const [ragStatus, setRagStatus] = useState({ total: 0, pending: 0, processing: 0, completed: 0, failed: 0 });
  const [isTriggeringRAG, setIsTriggeringRAG] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [ragFilterDone, setRagFilterDone] = useState(false); // Filter to exclude AI search done products

  // Periodically fetch pipeline status while modal is open
  React.useEffect(() => {
    if (!isOpen) return;
    const fetchStatus = async () => {
      try {
        const stats = await inventoryApi.getRAGEnrichmentStatus();
        setRagStatus(stats);
      } catch (err) {
        console.error("Failed to fetch RAG stats:", err);
      }
    };
    fetchStatus();
    const timer = setInterval(fetchStatus, 4000);
    return () => clearInterval(timer);
  }, [isOpen]);

  // Auto-load initial 50 sample products when modal opens
  React.useEffect(() => {
    if (!isOpen) return;
    const loadInitialSample = async () => {
      if (results.length > 0) return;
      setIsLoading(true);
      try {
        const res = await inventoryApi.adminGetMasterCatalogList({ page: 1, page_size: 50 });
        const items = Array.isArray(res) ? res : (res?.items || []);
        if (items.length > 0) {
          setResults(items);
          setHasSearched(true);
        }

      } catch (err) {
        console.error("Failed to load initial master catalog items:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadInitialSample();
  }, [isOpen]);

  const handleTriggerBulkRAG = async () => {
    setIsTriggeringRAG(true);
    try {
      await inventoryApi.triggerRAGEnrichment(undefined, true);
      showToast("Background AI RAG search enqueued successfully for all products with barcodes!", "success");
      const stats = await inventoryApi.getRAGEnrichmentStatus();
      setRagStatus(stats);
    } catch (err: any) {
      showToast(err.message || "Failed to trigger bulk AI RAG search", "error");
    } finally {
      setIsTriggeringRAG(false);
    }
  };

  const handleTriggerSelectedRAG = async () => {
    if (selectedProductIds.length === 0) return;
    setIsTriggeringRAG(true);
    try {
      await inventoryApi.triggerRAGEnrichment(selectedProductIds, false);
      showToast(`Successfully enqueued ${selectedProductIds.length} products for RAG enrichment!`, "success");
      setSelectedProductIds([]);
      const stats = await inventoryApi.getRAGEnrichmentStatus();
      setRagStatus(stats);
    } catch (err: any) {
      showToast(err.message || "Failed to trigger selected RAG enrichment", "error");
    } finally {
      setIsTriggeringRAG(false);
    }
  };

  const handleTriggerSingleRAG = async (productId: string) => {
    try {
      await inventoryApi.triggerRAGEnrichment([productId], false);
      showToast("Enqueued product for RAG enrichment!", "success");
      const stats = await inventoryApi.getRAGEnrichmentStatus();
      setRagStatus(stats);
      // Update result state inline
      setResults(prev => prev.map(r => r.id === productId ? { ...r, rag_status: "pending" } : r));
    } catch (err: any) {
      showToast(err.message || "Failed to enqueue product", "error");
    }
  };

  // Local Inventory Quick Import Modal state
  const [selectedItem, setSelectedItem] = useState<MasterCatalogItem | null>(null);
  const [initialStock, setInitialStock] = useState<number>(10);
  const [localSellingPrice, setLocalSellingPrice] = useState<number>(0);
  const [localPurchasePrice, setLocalPurchasePrice] = useState<number>(0);
  const [supplier, setSupplier] = useState("");
  const [warehouse, setWarehouse] = useState("Main Warehouse");
  const [isImporting, setIsImporting] = useState(false);
  const [savingToMasterId, setSavingToMasterId] = useState<string | null>(null);

  // Excel Upload State
  const [isUploadingExcel, setIsUploadingExcel] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSearch = async (forceWeb = false) => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    setHasSearched(true);
    try {
      const data = await inventoryApi.searchMasterCatalog(searchQuery.trim(), forceWeb, provider);
      setResults(data);
      if (data.length === 0) {
        showToast("No products found locally. Click 'Search Web with AI' for live retrieval.", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to search Master Catalog", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToMaster = async (item: MasterCatalogItem, idx: number) => {
    setSavingToMasterId(`item-${idx}`);
    try {
      const saved = await inventoryApi.saveToMasterCatalog(item);
      showToast(`Saved "${item.name}" to Master Catalog!`, "success");
      // Update item in place
      setResults((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, source: "MASTER_DB", id: saved.id } : r))
      );
    } catch (err: any) {
      showToast(err.message || "Failed to save to Master Catalog", "error");
    } finally {
      setSavingToMasterId(null);
    }
  };

  const openImportToLocalModal = (item: MasterCatalogItem) => {
    setSelectedItem(item);
    setLocalSellingPrice(item.sale_price || item.mrp || 0);
    setLocalPurchasePrice(item.cost_price || (item.mrp ? item.mrp * 0.7 : 0));
    setInitialStock(item.quantity || 10);
    setSupplier(item.supplier || item.brand || "");
  };

  const handleConfirmImportToLocal = async () => {
    if (!selectedItem) return;
    setIsImporting(true);
    try {
      await inventoryApi.importToLocalInventory({
        name: selectedItem.name,
        barcode: selectedItem.barcode,
        brand_name: selectedItem.brand,
        category_name: selectedItem.category,
        sub_category_name: selectedItem.sub_category,
        short_description: selectedItem.short_description || selectedItem.name,
        image_url: selectedItem.image_url,
        mrp: selectedItem.mrp,
        selling_price: localSellingPrice,
        purchase_price: localPurchasePrice,
        initial_stock: initialStock,
        supplier: supplier,
        warehouse: warehouse
      });
      showToast(`Successfully added "${selectedItem.name}" to Local Inventory!`, "success");
      setSelectedItem(null);
      if (onProductAdded) onProductAdded();
    } catch (err: any) {
      showToast(err.message || "Failed to import into local inventory", "error");
    } finally {
      setIsImporting(false);
    }
  };

  // Excel/CSV Bulk Import parser handler using xlsx library
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingExcel(true);
    const reader = new FileReader();
    reader.onload = async (evt: any) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (rawRows.length === 0) {
          showToast("Excel/CSV sheet is empty", "error");
          setIsUploadingExcel(false);
          return;
        }

        const itemsToImport: MasterCatalogItem[] = [];

        for (const row of rawRows) {
          const getVal = (exactHeaders: string[]): string => {
            for (const eh of exactHeaders) {
              const matchedKey = Object.keys(row).find(
                (k) => k.trim().toLowerCase() === eh.trim().toLowerCase()
              );
              if (matchedKey) return String(row[matchedKey] || "").trim();
            }
            return "";
          };

          const getFloat = (exactHeaders: string[]): number => {
            const val = getVal(exactHeaders);
            return val ? parseFloat(val) || 0 : 0;
          };

          const name = getVal(["NAME", "Product Name", "Product"]);
          if (!name) continue;

          itemsToImport.push({
            name,
            brand: getVal(["BRAND", "Brand Name"]),
            barcode: getVal(["BARCODE", "Barcode/EAN/UPC", "Barcode"]),
            sku_code: getVal(["SKU CODE", "SKU"]),
            product_code: getVal(["PRODUCT CODE", "Product Code"]),
            hsn_code: getVal(["HSN CODE", "HSN", "HSN/SAC"]),
            plu_no: getVal(["PLU NO", "PLU"]),
            cost_price: getFloat(["COST PRICE", "Cost Price"]),
            mrp: getFloat(["MRP"]),
            sale_price: getFloat(["SALE PRICE", "Sale Price"]),
            wholesale_price: getFloat(["WHOLESALE PRICE", "Wholesale Price"]),
            special_price: getFloat(["SPECIAL PRICE", "Special Price"]),
            online_price: getFloat(["ONLINE PRICE", "Online Price"]),
            weight: getVal(["WEIGHT", "Weight"]),
            quantity: getFloat(["QUANTITY", "Quantity"]),
            expired_quantity: getFloat(["EXPIRED QUANTITY", "Expired Quantity"]),
            near_expiry_quantity: getFloat(["NEAR EXPIRY QUANTITY", "Near Expiry Quantity"]),
            tax: getFloat(["TAX", "Tax Rate"]),
            type: getVal(["TYPE", "Tax Type"]),
            cess: getFloat(["CESS"]),
            cess_on: getFloat(["CESS ON"]),
            cess_type: getVal(["CESS TYPE"]),
            tax_amount: getFloat(["TAX AMOUNT", "Tax Amount"]),
            taxable_value: getFloat(["TAXABLE VALUE", "Taxable Value"]),
            cess_tax_amount: getFloat(["CESS TAX AMOUNT"]),
            additional_cess_tax_amount: getFloat(["ADDITIONAL CESS TAX AMOUNT"]),
            supplier: getVal(["SUPPLIER", "Supplier"]),
            discount_rs: getFloat(["DISCOUNT(₹)", "Discount Rs"]),
            discount_percent: getFloat(["DISCOUNT(%)", "Discount %"]),
            actual_margin_rs: getFloat(["ACTUAL MARGIN (₹)", "Actual Margin"]),
            margin_on_cp: getFloat(["MARGIN ON CP (%)", "Margin on CP"]),
            margin_on_sp: getFloat(["MARGIN ON SP (%)", "Margin on SP"]),
            category: getVal(["CATEGORY", "Category"]),
            sub_category: getVal(["SUB CATEGORY", "Sub Category"]),
            instock_value: getFloat(["INSTOCK VALUE", "Instock Value"]),
            source: "EXCEL_IMPORT"
          });
        }

        if (itemsToImport.length === 0) {
          showToast("No valid rows found with product names", "error");
          setIsUploadingExcel(false);
          return;
        }

        const res = await inventoryApi.importExcelMasterCatalog(itemsToImport);
        showToast(res.message || `Successfully imported ${itemsToImport.length} items to Master Data!`, "success");
        setSearchQuery("");
        handleSearch(false);
      } catch (err: any) {
        showToast(err.message || "Failed to process Excel/CSV file", "error");
      } finally {
        setIsUploadingExcel(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      {/* Toast Overlay */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium border ${
              toastMessage.type === "success"
                ? "bg-emerald-950/90 text-emerald-200 border-emerald-500/40"
                : "bg-rose-950/90 text-rose-200 border-rose-500/40"
            }`}
          >
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Global Master Catalog & AI Product Search
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  RAG System
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Search global product master database or fetch live real-time specifications from the web using AI.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Search Bar */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/40 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Type Product Name, Brand, or Barcode (e.g. 'Godrej 2 Ton AC' or '8901...')"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch(false)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>

            {/* Provider Toggle */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setProvider("auto")}
                className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                  provider === "auto"
                    ? "bg-slate-700 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Database className="w-3.5 h-3.5 text-slate-300" />
                Server Default
              </button>
              <button
                onClick={() => setProvider("gemini")}
                className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                  provider === "gemini"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Gemini 2.5 AI
              </button>
              <button
                onClick={() => setProvider("openai")}
                className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                  provider === "openai"
                    ? "bg-purple-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-purple-300" />
                OpenAI GPT-4o
              </button>
            </div>

            {/* Search Buttons */}
            <button
              onClick={() => handleSearch(false)}
              disabled={isLoading}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search Master DB
            </button>

            <button
              onClick={() => handleSearch(true)}
              disabled={isLoading}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              Search Web with AI (RAG)
            </button>
          </div>

          {/* Excel File Importer Row */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-indigo-400" />
                Upload an Excel/CSV file with master product details to populate Master Data Catalog.
              </span>
              
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer hover:text-white select-none">
                <input
                  type="checkbox"
                  checked={ragFilterDone}
                  onChange={(e) => setRagFilterDone(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-650 focus:ring-indigo-500 w-3.5 h-3.5"
                />
                <span>Exclude AI-sourced products</span>
              </label>
            </div>

            <label className="cursor-pointer px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg transition flex items-center gap-2 border border-slate-700">
              {isUploadingExcel ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>Import Excel Master File</span>
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileUpload}
                disabled={isUploadingExcel}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Results Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {isLoading && (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-sm font-medium">Searching Master Database & Performing AI Web RAG Retrieval...</p>
            </div>
          )}

          {!isLoading && !hasSearched && (
            <div className="space-y-6">
              {/* RAG pipeline dashboard */}
              <div className="bg-slate-950/60 rounded-xl p-5 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
                    <div>
                      <h4 className="text-sm font-bold text-white">Active Background RAG Catalog Enrichment</h4>
                      <p className="text-[11px] text-slate-400">Continuous AI agent sourcing product details from the web sequentially.</p>
                    </div>
                  </div>
                  <button
                    onClick={handleTriggerBulkRAG}
                    disabled={isTriggeringRAG}
                    className="h-8 text-xs font-semibold px-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-650 hover:to-purple-705 text-white rounded-lg shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isTriggeringRAG ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3 h-3 text-amber-300" />}
                    Start/Resume Bulk AI Sourcing
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
                  <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 text-center">
                    <div className="text-xs text-slate-400 font-medium">Total Barcodes</div>
                    <div className="text-lg font-bold text-slate-200 mt-1">{ragStatus.total}</div>
                  </div>
                  <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 text-center">
                    <div className="text-xs text-slate-400 font-medium">Pending AI</div>
                    <div className="text-lg font-bold text-amber-400 mt-1">{ragStatus.pending}</div>
                  </div>
                  <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 text-center">
                    <div className="text-xs text-slate-400 font-medium">Processing</div>
                    <div className="text-lg font-bold text-indigo-400 mt-1 flex items-center justify-center gap-1">
                      {ragStatus.processing > 0 && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />}
                      <span>{ragStatus.processing}</span>
                    </div>
                  </div>
                  <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 text-center">
                    <div className="text-xs text-slate-400 font-medium">Completed</div>
                    <div className="text-lg font-bold text-emerald-400 mt-1">{ragStatus.completed}</div>
                  </div>
                  <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 text-center col-span-2 md:col-span-1">
                    <div className="text-xs text-slate-400 font-medium">Failed</div>
                    <div className="text-lg font-bold text-rose-400 mt-1">{ragStatus.failed}</div>
                  </div>
                </div>

                {/* Progress bar */}
                {ragStatus.total > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-semibold text-slate-300">
                      <span>Overall Progress</span>
                      <span>{Math.round((ragStatus.completed / (ragStatus.total || 1)) * 100)}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 transition-all duration-500" 
                        style={{ width: `${(ragStatus.completed / (ragStatus.total || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="py-8 flex flex-col items-center justify-center text-center space-y-3 text-slate-500 border border-slate-800/40 rounded-xl bg-slate-950/20">
                <Package className="w-12 h-12 stroke-[1.5] text-slate-600" />
                <h3 className="text-base font-semibold text-slate-300">Ready to Source Products</h3>
                <p className="text-xs max-w-md text-slate-400">
                  Type any product query (e.g. "Godrej Split AC 2 Ton") or barcode into the search bar above to fetch master data details.
                </p>
              </div>
            </div>
          )}

          {!isLoading && hasSearched && results.length === 0 && (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-3 text-slate-400">
              <Globe className="w-10 h-10 text-amber-500/80" />
              <h3 className="text-base font-semibold text-slate-200">No Match in Local Master Database</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Click <span className="text-indigo-400 font-semibold">\"Search Web with AI (RAG)\"</span> to automatically query live online catalogs!
              </p>
              <button
                onClick={() => handleSearch(true)}
                className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-500 transition"
              >
                Search Web Now
              </button>
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <div className="space-y-4">
              {/* Bulk manual trigger bar */}
              {selectedProductIds.length > 0 && (
                <div className="bg-slate-950/80 border border-indigo-500/40 rounded-xl p-3.5 flex items-center justify-between text-xs text-indigo-300">
                  <span className="flex items-center gap-2 font-medium">
                    <Info className="w-4 h-4 text-indigo-400 shrink-0" />
                    Selected {selectedProductIds.length} products for RAG enrichment.
                  </span>
                  <button
                    onClick={handleTriggerSelectedRAG}
                    disabled={isTriggeringRAG}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isTriggeringRAG ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-300" />}
                    Enrich Selected via AI
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(ragFilterDone ? results.filter(r => !r.ai_search_done) : results).map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      {/* Source Badge & Brand */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center">
                          {item.source !== "AI_WEB_SEARCH" && item.id && (
                            <input
                              type="checkbox"
                              checked={selectedProductIds.includes(item.id)}
                              onChange={(e) => {
                                const id = item.id!;
                                if (e.target.checked) {
                                  setSelectedProductIds(prev => [...prev, id]);
                                } else {
                                  setSelectedProductIds(prev => prev.filter(x => x !== id));
                                }
                              }}
                              className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer mr-2 shrink-0"
                            />
                          )}
                          <span
                            className={`text-[10px] font-bold tracking-wide uppercase px-2.5 py-0.5 rounded-full border ${
                              item.source === "AI_WEB_SEARCH"
                                ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            }`}
                          >
                            {item.source === "AI_WEB_SEARCH" ? "🌐 Live AI Web Search" : "💾 Master Catalog DB"}
                          </span>
                          
                          {item.source !== "AI_WEB_SEARCH" && (
                            <span
                              className={`text-[10px] font-bold tracking-wide uppercase px-2.5 py-0.5 rounded-full border ml-1.5 ${
                                item.ai_search_done
                                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                                  : item.rag_status === "processing"
                                  ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/20"
                                  : "bg-slate-500/10 text-slate-400 border-slate-800"
                              }`}
                            >
                              {item.ai_search_done ? "✓ AI Enriched" : item.rag_status === "processing" ? "⚡ Sourcing..." : "Pending"}
                            </span>
                          )}
                        </div>

                        {item.brand && (
                          <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-slate-500" />
                            {item.brand}
                          </span>
                        )}
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h4 className="text-base font-semibold text-white leading-snug">{item.name}</h4>
                        {item.short_description && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.short_description}</p>
                        )}
                      </div>

                      {/* Metadata Specs Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                        {item.barcode && (
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <Barcode className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span className="font-mono text-[11px] truncate">{item.barcode}</span>
                          </div>
                        )}
                        {item.category && (
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            <span className="truncate">{item.category}</span>
                          </div>
                        )}
                        {item.mrp ? (
                          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                            <Tag className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>MRP: {currency.symbol}{item.mrp.toLocaleString()}</span>
                          </div>
                        ) : null}
                        {item.hsn_code && (
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <ShieldCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>HSN: {item.hsn_code}</span>
                          </div>
                        )}
                        {item.cost_price ? (
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <DollarSign className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>Cost: {currency.symbol}{item.cost_price}</span>
                          </div>
                        ) : null}
                        {item.sale_price ? (
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <Tag className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            <span>Sale: {currency.symbol}{item.sale_price}</span>
                          </div>
                        ) : null}
                        {item.quantity ? (
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>Qty: {item.quantity}</span>
                          </div>
                        ) : null}
                        {item.supplier ? (
                          <div className="flex items-center gap-1.5 text-slate-300 col-span-2">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">Supplier: {item.supplier}</span>
                          </div>
                        ) : null}
                      </div>

                      {item.specifications && (
                        <p className="text-[11px] text-slate-400 bg-slate-900/30 p-2 rounded-lg border border-slate-800/40 italic">
                          {item.specifications}
                        </p>
                      )}
                    </div>

                    {/* Actions Bar */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
                      {item.source === "AI_WEB_SEARCH" && (
                        <button
                          onClick={() => handleSaveToMaster(item, idx)}
                          disabled={savingToMasterId === `item-${idx}`}
                          className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 border border-slate-700"
                        >
                          {savingToMasterId === `item-${idx}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Database className="w-3.5 h-3.5 text-purple-400" />
                          )}
                          Save to Master
                        </button>
                      )}
                      
                      {item.source !== "AI_WEB_SEARCH" && item.id && !item.ai_search_done && (
                        <button
                          onClick={() => handleTriggerSingleRAG(item.id!)}
                          disabled={item.rag_status === "processing" || item.rag_status === "pending"}
                          className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 border border-slate-700 disabled:opacity-50"
                        >
                          {item.rag_status === "processing" || item.rag_status === "pending" ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                          ) : (
                            <Zap className="w-3.5 h-3.5 text-indigo-400" />
                          )}
                          <span>AI Enrich Specs</span>
                        </button>
                      )}

                      <button
                        onClick={() => openImportToLocalModal(item)}
                        className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Save to Local Inventory
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Quick Local Inventory Import Dialog */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-indigo-400" />
                  Add Product to Local Inventory
                </h3>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <p className="text-sm font-semibold text-white">{selectedItem.name}</p>
                <p className="text-xs text-slate-400">
                  {selectedItem.brand ? `${selectedItem.brand} • ` : ""}
                  {selectedItem.category || "General"}
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Initial Stock Quantity</label>
                  <input
                    type="number"
                    value={initialStock}
                    onChange={(e) => setInitialStock(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Selling Price ({currency.symbol})</label>
                    <input
                      type="number"
                      value={localSellingPrice}
                      onChange={(e) => setLocalSellingPrice(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Purchase Price ({currency.symbol})</label>
                    <input
                      type="number"
                      value={localPurchasePrice}
                      onChange={(e) => setLocalPurchasePrice(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Warehouse Location</label>
                  <input
                    type="text"
                    value={warehouse}
                    onChange={(e) => setWarehouse(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmImportToLocal}
                  disabled={isImporting}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Confirm Add
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
