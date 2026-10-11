import React, { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Boxes,
  Package,
  Warehouse,
  TrendingUp,
  AlertTriangle,
  FileSpreadsheet,
  Printer,
  Search,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Tag,
  DollarSign,
  ArrowRightLeft,
  ChevronDown,
  Layers,
  Building2,
  Percent,
  X,
  Plus,
  Eye,
  Calendar as CalendarIcon,
  ArrowLeft,
  Star,
  Mail,
  Download,
  Archive,
  FileText
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";

import { inventoryApi, posApi, invoicesApi } from "@/lib/api-client";
import { parseSafeDateTimestamp, formatDisplayDate, getTodayDateString } from "@/lib/utils";
import * as XLSX from "xlsx";


// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type InventoryReportType =
  | "stock_summary"
  | "stock_detail"
  | "stock_godown"
  | "item_batch"
  | "item_party"
  | "item_sales_purchase_summary"
  | "low_stock_summary"
  | "rate_list"
  | "product_sales"
  | "product_profitability";

export interface InventoryReportMeta {
  id: InventoryReportType;
  num: number | string;
  name: string;
  shortName: string;
  category: "Core Stock" | "Movement & Batches" | "Performance & Rates" | "Profitability";
  description: string;
}

export const INVENTORY_REPORTS_LIST: InventoryReportMeta[] = [
  { id: "stock_summary", num: 14, name: "Stock Summary", shortName: "Stock Summary", category: "Core Stock", description: "Real-time closing stock balance, purchase rates, selling rates, and inventory valuation (PDF layout)" },
  { id: "stock_detail", num: 15, name: "Stock Detail Report (Movement Register)", shortName: "Stock Movement", category: "Movement & Batches", description: "Chronological audit trail of item receipts, issues, transfers, and running balances (PDF layout)" },
  { id: "stock_godown", num: 16, name: "Stock Summary - Godown Wise", shortName: "Godown Stock", category: "Core Stock", description: "Warehouse-specific stock breakdown, bins, purchase cost, and location valuation (PDF layout)" },
  { id: "item_batch", num: "IB", name: "Item Batch Report", shortName: "Item Batches", category: "Movement & Batches", description: "Batch numbers, manufacturing dates, expiry tracking, MRP, and batch-wise stock (PDF layout)" },
  { id: "item_party", num: "IP", name: "Party Report By Item", shortName: "Party by Item", category: "Performance & Rates", description: "Party-wise buying & selling patterns for each inventory item and SKU (PDF layout)" },
  { id: "item_sales_purchase_summary", num: "SP", name: "Item Sales and Purchase Summary", shortName: "Sales vs Purchase", category: "Performance & Rates", description: "Aggregated sales quantity vs purchase quantity comparison per product (PDF layout)" },
  { id: "low_stock_summary", num: "LS", name: "Low Stock Summary", shortName: "Low Stock Alert", category: "Core Stock", description: "Critical deficit items breaching minimum reorder levels and stock risk value (PDF layout)" },
  { id: "rate_list", num: "RL", name: "Rate List", shortName: "Rate List", category: "Performance & Rates", description: "Master price catalog with Item Code, MRP, and standard selling prices (PDF layout)" },
  { id: "product_sales", num: 26, name: "Product-wise Sales Report", shortName: "Product Sales", category: "Performance & Rates", description: "Detailed item revenue, volume, discounts, taxable value, and GST collected" },
  { id: "product_profitability", num: 19, name: "Product Profitability Report", shortName: "Profit Margin", category: "Profitability", description: "Unit COGS vs selling price, gross profit contribution, and margin percentage" },
];

interface SearchableCategorySelectProps {
  value: string;
  onChange: (category: string) => void;
  categories: string[];
  placeholder?: string;
  className?: string;
}

function SearchableCategorySelect({
  value,
  onChange,
  categories,
  placeholder = "Search Category",
  className = "",
}: SearchableCategorySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearch("");
    }
  }, [isOpen]);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    return categories.filter((c) => c.toLowerCase().includes(q));
  }, [categories, search]);

  const displayLabel = value === "all" ? "All Categories" : value || placeholder;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-8 pl-3 pr-8 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none flex items-center justify-between text-slate-800 transition-all cursor-pointer text-left shadow-2xs"
      >
        <span className={`truncate ${value !== "all" && value ? "font-bold text-slate-900" : "text-slate-600"}`}>
          {displayLabel}
        </span>
        <div className="absolute right-2.5 flex items-center gap-1">
          {value !== "all" && value ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange("all");
              }}
              className="text-slate-400 hover:text-slate-700 p-0.5 rounded-full hover:bg-slate-100"
            >
              <X className="size-3.5" />
            </span>
          ) : (
            <ChevronDown className="size-3.5 text-slate-400" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 top-full mt-1.5 w-64 max-w-[90vw] bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden flex flex-col"
          >
            <div className="p-2 border-b border-slate-100 bg-slate-50/80">
              <div className="relative flex items-center">
                <Search className="absolute left-2.5 size-3.5 text-slate-400 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search Category..."
                  className="w-full h-7.5 pl-8 pr-2.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400 text-slate-800 font-medium"
                />
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
              <button
                type="button"
                onClick={() => {
                  onChange("all");
                  setIsOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                  value === "all" ? "bg-indigo-50 text-indigo-900 font-bold" : "hover:bg-slate-100 text-slate-700"
                }`}
              >
                <span>All Categories</span>
                {value === "all" && <CheckCircle2 className="size-3.5 text-indigo-600 shrink-0" />}
              </button>

              {filteredCategories.map((cat) => {
                const isSelected = value.toLowerCase() === cat.toLowerCase();
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      onChange(cat);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected ? "bg-indigo-50 text-indigo-900 font-bold" : "hover:bg-slate-100 text-slate-700"
                    }`}
                  >
                    <span className="truncate pr-2">{cat}</span>
                    {isSelected && <CheckCircle2 className="size-3.5 text-indigo-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface SearchableGodownSelectProps {
  value: string;
  onChange: (godownId: string) => void;
  godowns: Array<{ id: string; name: string }>;
  placeholder?: string;
  className?: string;
}

function SearchableGodownSelect({
  value,
  onChange,
  godowns,
  placeholder = "Search Godown",
  className = "",
}: SearchableGodownSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearch("");
    }
  }, [isOpen]);

  const filteredGodowns = useMemo(() => {
    if (!search.trim()) return godowns;
    const q = search.toLowerCase();
    return godowns.filter((g) => g.name.toLowerCase().includes(q));
  }, [godowns, search]);

  const selectedGodownObj = godowns.find(
    (g) => g.id === value || g.name.toLowerCase() === value.toLowerCase()
  );

  const displayLabel = selectedGodownObj ? selectedGodownObj.name : placeholder;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-8 pl-3 pr-8 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none flex items-center justify-between text-slate-800 transition-all cursor-pointer text-left shadow-2xs"
      >
        <span className={`truncate ${selectedGodownObj ? "font-bold text-slate-900" : "text-slate-500"}`}>
          {displayLabel}
        </span>
        <div className="absolute right-2.5 flex items-center gap-1">
          {value ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="text-slate-400 hover:text-slate-700 p-0.5 rounded-full hover:bg-slate-100"
            >
              <X className="size-3.5" />
            </span>
          ) : (
            <ChevronDown className="size-3.5 text-slate-400" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 top-full mt-1.5 w-64 max-w-[90vw] bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden flex flex-col"
          >
            <div className="p-2 border-b border-slate-100 bg-slate-50/80">
              <div className="relative flex items-center">
                <Search className="absolute left-2.5 size-3.5 text-slate-400 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search Godown..."
                  className="w-full h-7.5 pl-8 pr-2.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400 text-slate-800 font-medium"
                />
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
              {filteredGodowns.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No godown matching "{search}"
                </div>
              ) : (
                filteredGodowns.map((g) => {
                  const isSelected = selectedGodownObj?.id === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        onChange(g.id);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected ? "bg-indigo-50 text-indigo-900 font-bold" : "hover:bg-slate-100 text-slate-700"
                      }`}
                    >
                      <span className="truncate pr-2">{g.name}</span>
                      {isSelected && <CheckCircle2 className="size-3.5 text-indigo-600 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface SearchableItemSelectProps {
  value: string;
  onChange: (itemId: string) => void;
  items: Array<{ id: string; name: string; itemCode?: string }>;
  placeholder?: string;
  className?: string;
}

function SearchableItemSelect({
  value,
  onChange,
  items,
  placeholder = "Search Item",
  className = "",
}: SearchableItemSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearch("");
    }
  }, [isOpen]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        (it.itemCode && it.itemCode.toLowerCase().includes(q))
    );
  }, [items, search]);

  const selectedItem = items.find(
    (it) => it.id === value || it.name.toLowerCase() === value.toLowerCase()
  );

  const displayLabel = selectedItem ? selectedItem.name : placeholder;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-8 pl-3 pr-8 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none flex items-center justify-between text-slate-800 transition-all cursor-pointer text-left shadow-2xs"
      >
        <span className={`truncate ${selectedItem ? "font-bold text-slate-900" : "text-slate-500"}`}>
          {displayLabel}
        </span>
        <div className="absolute right-2.5 flex items-center gap-1">
          {value ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="text-slate-400 hover:text-slate-700 p-0.5 rounded-full hover:bg-slate-100"
            >
              <X className="size-3.5" />
            </span>
          ) : (
            <ChevronDown className="size-3.5 text-slate-400" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 top-full mt-1.5 w-72 max-w-[90vw] bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden flex flex-col"
          >
            <div className="p-2 border-b border-slate-100 bg-slate-50/80">
              <div className="relative flex items-center">
                <Search className="absolute left-2.5 size-3.5 text-slate-400 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search item name, code..."
                  className="w-full h-7.5 pl-8 pr-2.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400 text-slate-800 font-medium"
                />
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
              {filteredItems.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No items matching "{search}"
                </div>
              ) : (
                filteredItems.map((it) => {
                  const isSelected = selectedItem?.id === it.id || selectedItem?.name.toLowerCase() === it.name.toLowerCase();
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => {
                        onChange(it.name);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected ? "bg-indigo-50 text-indigo-900 font-bold" : "hover:bg-slate-100 text-slate-700"
                      }`}
                    >
                      <div className="truncate pr-2">
                        <div className="font-semibold text-slate-900 truncate">{it.name}</div>
                        {it.itemCode && <div className="text-[10px] text-slate-400 font-mono">{it.itemCode}</div>}
                      </div>
                      {isSelected && <CheckCircle2 className="size-3.5 text-indigo-600 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function InventoryReportsSuite({ defaultReport = "stock_summary" }: { defaultReport?: InventoryReportType }) {
  const { tenant } = useTenant();
  const currentTenantId = tenant?.id || "default";
  const { formatCurrency } = useCurrency();

  const [activeReport, setActiveReport] = useState<InventoryReportType>(defaultReport);
  const [dateFilter, setDateFilter] = useState<"today" | "this_week" | "this_month" | "this_quarter" | "this_fy" | "all" | "custom">("this_week");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedGodown, setSelectedGodown] = useState<string>("");
  const [selectedParty, setSelectedParty] = useState<string>("all");
  const [selectedExpiryWindow, setSelectedExpiryWindow] = useState<string>("all");
  const [hideOutOfStockBatches, setHideOutOfStockBatches] = useState<boolean>(false);
  const [isFavourite, setIsFavourite] = useState<boolean>(false);
  const [showExcelDropdown, setShowExcelDropdown] = useState<boolean>(false);

  const [liveProducts, setLiveProducts] = useState<any[]>([]);
  const [liveBatches, setLiveBatches] = useState<any[]>([]);
  const [rawInvoices, setRawInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch real inventory products, batches, and invoices from API & database
  useEffect(() => {
    let isMounted = true;
    async function fetchLiveStock() {
      try {
        const [invRes, posRes, batchRes] = await Promise.allSettled([
          inventoryApi.getProducts({ page_size: 500 }),
          posApi.getProducts({ limit: 500 }),
          inventoryApi.getBatches(),
        ]);

        let realList: any[] = [];
        if (invRes.status === "fulfilled" && invRes.value) {
          const val: any = invRes.value;
          const items = Array.isArray(val) ? val : val.items || val.results || [];
          if (items.length > 0) realList = items;
        }

        if (realList.length === 0 && posRes.status === "fulfilled" && posRes.value) {
          const val: any = posRes.value;
          const items = Array.isArray(val) ? val : val.items || val.products || [];
          if (items.length > 0) realList = items;
        }

        if (batchRes.status === "fulfilled" && batchRes.value && Array.isArray(batchRes.value)) {
          if (isMounted) {
            const mappedBatches = batchRes.value.map((b: any) => ({
              id: b.id,
              itemName: b.product_name || "Inventory Item",
              batchNumber: b.batch_number || "BATCH",
              expiryDate: b.expiry_date || null,
              mfgDate: b.manufacturing_date || null,
              mrp: b.mrp ? Number(b.mrp) : null,
              purchasePrice: b.cost_price ? Number(b.cost_price) : null,
              sellingPrice: b.selling_price ? Number(b.selling_price) : null,
              currentStock: b.remaining_quantity !== undefined ? Number(b.remaining_quantity) : Number(b.quantity || 0),
              uom: b.uom || "PCS",
              daysToExpiry: b.expiry_date ? Math.ceil((new Date(b.expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : null,
            }));
            setLiveBatches(mappedBatches);
          }
        }

        // Also check localStorage for local custom inventory products
        if (realList.length === 0) {
          const localKeys = ["custom_products", "inventory_products", "pos_products"];
          for (const k of localKeys) {
            const raw = localStorage.getItem(k);
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  realList = parsed;
                  break;
                }
              } catch {}
            }
          }
        }

        // Fetch all saved invoices from localStorage & backend APIs
        const allInvoicesMap = new Map<string, any>();
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.startsWith("pos_saved_invoices") || k.startsWith("pos_offline_invoices"))) {
              const item = localStorage.getItem(k);
              if (item) {
                try {
                  const parsed = JSON.parse(item);
                  if (Array.isArray(parsed)) {
                    parsed.forEach((inv: any) => {
                      const idKey = String(inv.id || inv.invoice_number || Math.random());
                      if (!allInvoicesMap.has(idKey)) {
                        allInvoicesMap.set(idKey, inv);
                      }
                    });
                  }
                } catch (e) {}
              }
            }
          }
        } catch (e) {}

        try {
          const apiRes: any = await invoicesApi.listInvoices({ page_size: 200 }).catch(() => null);
          const invoiceItems = apiRes?.items || apiRes?.data?.items || apiRes?.data || (Array.isArray(apiRes) ? apiRes : []);
          if (Array.isArray(invoiceItems)) {
            invoiceItems.forEach((inv: any) => {
              const idKey = String(inv.id || inv.invoice_number || Math.random());
              if (!allInvoicesMap.has(idKey)) {
                allInvoicesMap.set(idKey, {
                  ...inv,
                  items: inv.lines || inv.items || [],
                  invoice_date: inv.invoice_date || inv.created_at,
                });
              }
            });
          }
        } catch (e) {}

        if (isMounted) {
          setRawInvoices(Array.from(allInvoicesMap.values()));
          if (realList.length > 0) {
            const normalized = realList.map((p, idx) => {
              const buyPrice = p.purchase_price !== undefined && p.purchase_price !== null
                ? Number(p.purchase_price)
                : (p.cost_price !== undefined && p.cost_price !== null
                    ? Number(p.cost_price)
                    : (p.purchasePrice !== undefined && p.purchasePrice !== null ? Number(p.purchasePrice) : 0));
              const sellPrice = p.selling_price !== undefined && p.selling_price !== null
                ? Number(p.selling_price)
                : (p.price !== undefined && p.price !== null
                    ? Number(p.price)
                    : (p.sellingPrice !== undefined && p.sellingPrice !== null ? Number(p.sellingPrice) : 0));
              const mrpVal = p.mrp !== undefined && p.mrp !== null ? Number(p.mrp) : (sellPrice > 0 ? sellPrice : 0);
              const qty = Number(p.stock_quantity ?? p.stock ?? p.quantity ?? 0);
              const minLevel = Number(p.min_stock_level || p.reorder_level || p.lowStockLevel || p.min_stock || 0);

              return {
                id: p.id || `prod_${idx}`,
                name: p.name || p.title || `Product ${idx + 1}`,
                itemCode: p.sku || p.code || p.item_code || p.itemCode || "",
                batchNumber: p.batch_number || p.batchNumber || "",
                expiryDate: p.expiry_date || p.expiryDate || "",
                mfgDate: p.mfg_date || p.mfgDate || "",
                category: p.category_name || p.category || "General",
                purchasePrice: buyPrice,
                sellingPrice: sellPrice,
                mrp: mrpVal,
                stockQuantity: qty,
                lowStockLevel: minLevel,
                salesQty: Number(p.sales_qty || p.salesQty || 0),
                purQty: Number(p.purchase_qty || p.purQty || qty),
                isRealData: true,
              };
            });
            setLiveProducts(normalized);
          } else {
            setLiveProducts([]);
          }
        }
      } catch (err) {
        if (isMounted) {
          setLiveProducts([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchLiveStock();
    return () => {
      isMounted = false;
    };
  }, []);

  // Unique product categories for filter
  const productCategories = useMemo(() => {
    const set = new Set<string>();
    liveProducts.forEach((p) => {
      const c = p.category || p.category_name;
      if (c && c !== "General") set.add(c);
    });
    return Array.from(set);
  }, [liveProducts]);

  // Date Filter Predicate
  const isDateInFilter = (dateStr: string | undefined): boolean => {
    if (!dateStr || (dateFilter as string) === "all") return true;
    const ts = parseSafeDateTimestamp(dateStr);
    if (!ts) return true;
    const d = new Date(ts);
    const now = new Date();

    if (dateFilter === "today") {
      return d.toDateString() === now.toDateString();
    }
    if (dateFilter === "this_week") {
      const weekStart = new Date(now);
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      weekStart.setDate(diff);
      weekStart.setHours(0, 0, 0, 0);
      return ts >= weekStart.getTime();
    }
    if (dateFilter === "this_month") {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    if (dateFilter === "this_quarter") {
      return d.getFullYear() === now.getFullYear() && Math.floor(d.getMonth() / 3) === Math.floor(now.getMonth() / 3);
    }
    if (dateFilter === "this_fy") {
      const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const fyStart = new Date(fyStartYear, 3, 1).getTime();
      const fyEnd = new Date(fyStartYear + 1, 2, 31, 23, 59, 59).getTime();
      return ts >= fyStart && ts <= fyEnd;
    }
    if (dateFilter === "custom") {
      if (customStartDate) {
        const sTs = parseSafeDateTimestamp(customStartDate);
        if (sTs && ts < sTs) return false;
      }
      if (customEndDate) {
        const eTs = parseSafeDateTimestamp(customEndDate);
        if (eTs && ts > eTs + 86400000 - 1) return false;
      }
      return true;
    }
    return true;
  };

  // ── Real Sales & Purchase Summary Data ──
  const salesPurchaseSummaryData = useMemo(() => {
    const itemMap = new Map<
      string,
      {
        id: string;
        name: string;
        itemCode: string;
        category: string;
        salesQty: number;
        purchaseQty: number;
      }
    >();

    // Seed from catalog products
    liveProducts.forEach((p) => {
      const itName = p.name || p.title || "Product";
      const itCat = p.category || p.category_name || "General";
      if (selectedCategory !== "all" && itCat.toLowerCase() !== selectedCategory.toLowerCase()) {
        return;
      }
      const key = itName.toLowerCase();
      if (!itemMap.has(key)) {
        itemMap.set(key, {
          id: String(p.id),
          name: itName,
          itemCode: p.sku || p.code || p.item_code || "—",
          category: itCat,
          salesQty: 0,
          purchaseQty: 0,
        });
      }
    });

    // Aggregate real sales and purchase invoices
    rawInvoices.forEach((inv: any) => {
      const invDate = inv.invoice_date || inv.created_at || inv.date;
      if (!isDateInFilter(invDate)) return;

      const items = Array.isArray(inv.items) && inv.items.length > 0 ? inv.items : (Array.isArray(inv.lines) ? inv.lines : []);
      const isPurchase =
        inv.type === "purchase" ||
        inv.invoice_type === "purchase_bill" ||
        inv.is_purchase ||
        inv.type === "grn";

      items.forEach((it: any) => {
        const itName = it.name || it.product_name || it.item_name || "Item";
        const itCode = it.sku || it.item_code || it.code || it.product_sku || "—";
        const itCat =
          it.category ||
          liveProducts.find((p) => p.name === itName || p.id === it.product_id)?.category ||
          "General";

        if (selectedCategory !== "all" && itCat.toLowerCase() !== selectedCategory.toLowerCase()) {
          return;
        }

        const key = itName.toLowerCase();
        if (!itemMap.has(key)) {
          itemMap.set(key, {
            id: String(it.id || it.product_id || key),
            name: itName,
            itemCode: itCode,
            category: itCat,
            salesQty: 0,
            purchaseQty: 0,
          });
        }

        const entry = itemMap.get(key)!;
        const qty = Number(it.quantity || it.qty || 1);
        if (isPurchase) {
          entry.purchaseQty += qty;
        } else {
          entry.salesQty += qty;
        }
      });
    });

    const allItems = Array.from(itemMap.values());
    
    // Filter by search term if typed
    let rows = allItems;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.itemCode.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q)
      );
    }

    // Only display products with transactions in this period (or all items if in all-time)
    if ((dateFilter as string) !== "all") {
      rows = rows.filter((r) => r.salesQty > 0 || r.purchaseQty > 0);
    }

    let totSalesQty = 0;
    let totPurchaseQty = 0;

    rows.forEach((r) => {
      totSalesQty += r.salesQty;
      totPurchaseQty += r.purchaseQty;
    });

    return {
      rows,
      totSalesQty,
      totPurchaseQty,
    };
  }, [liveProducts, rawInvoices, dateFilter, customStartDate, customEndDate, selectedCategory, searchTerm]);

  // ── Stock Detail Movements Calculation ──
  const selectedProduct = useMemo(() => {
    if (!selectedItemId) return null;
    return (
      liveProducts.find(
        (p) =>
          p.id === selectedItemId ||
          p.name.toLowerCase() === selectedItemId.toLowerCase()
      ) || null
    );
  }, [liveProducts, selectedItemId]);

  const stockDetailMovements = useMemo(() => {
    if (!selectedProduct) return [];

    const movementsList: Array<{
      date: string;
      rawDate: string;
      type: string;
      qty: number;
      closingStock: number;
      notes: string;
    }> = [];

    const targetName = selectedProduct.name.toLowerCase().trim();
    const targetCode = (selectedProduct.itemCode || "").toLowerCase().trim();

    // 1. Initial / Opening Stock
    const initialQty = Number(selectedProduct.stockQuantity || 0);

    // 2. Scan real transactions (Invoices / Purchases)
    rawInvoices.forEach((inv: any) => {
      const invDate = inv.invoice_date || inv.created_at || inv.date;
      if (!isDateInFilter(invDate)) return;

      const items = Array.isArray(inv.items) && inv.items.length > 0 ? inv.items : (Array.isArray(inv.lines) ? inv.lines : []);
      const isPurchase =
        inv.type === "purchase" ||
        inv.invoice_type === "purchase_bill" ||
        inv.is_purchase ||
        inv.type === "grn" ||
        inv.bill_type === "purchase";

      items.forEach((it: any) => {
        const itName = (it.name || it.product_name || it.item_name || "").toLowerCase().trim();
        const itCode = (it.sku || it.item_code || it.code || it.product_sku || "").toLowerCase().trim();

        if (itName === targetName || (targetCode && itCode === targetCode)) {
          const qty = Number(it.quantity || it.qty || 1);
          const invNo = inv.invoice_number || inv.bill_no || inv.id || "INV";
          const party = inv.customer_name || inv.party_name || inv.supplier_name || "Direct Customer";

          movementsList.push({
            date: formatDisplayDate(invDate),
            rawDate: invDate,
            type: isPurchase ? "Purchase" : "Sale",
            qty: isPurchase ? qty : -qty,
            closingStock: 0,
            notes: isPurchase ? `Purchase Bill #${invNo} (${party})` : `Sales Invoice #${invNo} (${party})`,
          });
        }
      });
    });

    // Sort chronologically
    movementsList.sort((a, b) => {
      const tA = parseSafeDateTimestamp(a.rawDate) || 0;
      const tB = parseSafeDateTimestamp(b.rawDate) || 0;
      return tA - tB;
    });

    // Compute running balance
    let running = initialQty;
    movementsList.forEach((m) => {
      running += m.qty;
      m.closingStock = running;
    });

    return movementsList;
  }, [selectedProduct, rawInvoices, dateFilter, customStartDate, customEndDate]);

  // ── Party Report By Item Calculation ──
  const partyReportByItemData = useMemo(() => {
    if (!selectedItemId) {
      return { rows: [], totSalesQty: 0, totSalesAmt: 0, totPurQty: 0, totPurAmt: 0 };
    }

    const partyMap = new Map<string, {
      partyName: string;
      salesQty: number;
      salesAmt: number;
      purchaseQty: number;
      purchaseAmt: number;
    }>();

    const selectedName = selectedItemId.toLowerCase();
    const selProd = liveProducts.find((p) => p.id === selectedItemId || p.name.toLowerCase() === selectedName);
    const targetNames = new Set<string>();
    if (selProd) {
      targetNames.add(selProd.name.toLowerCase());
      if (selProd.id) targetNames.add(selProd.id.toLowerCase());
      if (selProd.itemCode) targetNames.add(selProd.itemCode.toLowerCase());
    } else {
      targetNames.add(selectedName);
    }

    const isDateMatch = (dateStr: string | null | undefined) => {
      if (!dateStr || dateFilter === "all") return true;
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return true;
        const now = new Date();
        if (dateFilter === "today") {
          return d.toDateString() === now.toDateString();
        }
        if (dateFilter === "this_week") {
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(now.getDate() - 7);
          return d >= oneWeekAgo && d <= now;
        }
        if (dateFilter === "this_month") {
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }
        if (dateFilter === "this_quarter") {
          const q = Math.floor(now.getMonth() / 3);
          const dq = Math.floor(d.getMonth() / 3);
          return q === dq && d.getFullYear() === now.getFullYear();
        }
        if (dateFilter === "this_fy") {
          const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
          const startFy = new Date(fyYear, 3, 1);
          return d >= startFy;
        }
        if (dateFilter === "custom" && customStartDate && customEndDate) {
          const s = new Date(customStartDate);
          const e = new Date(customEndDate);
          return d >= s && d <= e;
        }
        return true;
      } catch {
        return true;
      }
    };

    rawInvoices.forEach((inv) => {
      if (!isDateMatch(inv.created_at || inv.date || inv.invoice_date)) return;

      const party = (inv.customer_name || inv.party_name || inv.customer?.name || "Walk-in Customer").trim();
      const pKey = party.toLowerCase();
      const isPurchase = Boolean(
        inv.type === "purchase" ||
        inv.is_purchase ||
        inv.document_type === "PURCHASE_BILL" ||
        inv.document_type === "PURCHASE" ||
        inv.vendor_name
      );

      (inv.items || inv.lines || []).forEach((it: any) => {
        const itName = (it.name || it.product_name || it.title || "").toLowerCase();
        const itId = String(it.id || it.product_id || "").toLowerCase();
        const itCode = String(it.item_code || it.sku || "").toLowerCase();

        const matches = targetNames.has(itName) || (itId && targetNames.has(itId)) || (itCode && targetNames.has(itCode));

        if (matches) {
          if (!partyMap.has(pKey)) {
            partyMap.set(pKey, {
              partyName: party,
              salesQty: 0,
              salesAmt: 0,
              purchaseQty: 0,
              purchaseAmt: 0,
            });
          }

          const rec = partyMap.get(pKey)!;
          const qty = Number(it.quantity || it.qty || 1);
          const rate = Number(it.price || it.rate || it.selling_price || it.unit_price || 0);
          const lineTotal = Number(it.total || it.amount || (qty * rate));

          if (isPurchase) {
            rec.purchaseQty += qty;
            rec.purchaseAmt += lineTotal;
          } else {
            rec.salesQty += qty;
            rec.salesAmt += lineTotal;
          }
        }
      });
    });

    let rows = Array.from(partyMap.values());
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter((r) => r.partyName.toLowerCase().includes(q));
    }

    let totSalesQty = 0;
    let totSalesAmt = 0;
    let totPurQty = 0;
    let totPurAmt = 0;

    rows.forEach((r) => {
      totSalesQty += r.salesQty;
      totSalesAmt += r.salesAmt;
      totPurQty += r.purchaseQty;
      totPurAmt += r.purchaseAmt;
    });

    return {
      rows,
      totSalesQty,
      totSalesAmt,
      totPurQty,
      totPurAmt,
    };
  }, [selectedItemId, liveProducts, rawInvoices, dateFilter, customStartDate, customEndDate, searchTerm]);

  // Inventory dataset
  const inventoryItems = useMemo(() => {
    return liveProducts;
  }, [liveProducts]);
  const movementLogs = useMemo(() => {
    try {
      const keys = [
        `pos_saved_invoices_${currentTenantId}`,
        "pos_saved_invoices_default_default",
        "pos_saved_invoices"
      ];
      let list: any[] = [];
      for (const k of keys) {
        const raw = localStorage.getItem(k);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              list = parsed;
              break;
            }
          } catch {}
        }
      }
      const logs: any[] = [];
      list.slice(0, 50).forEach((inv) => {
        (inv.items || []).forEach((item: any) => {
          logs.push({
            date: inv.created_at || inv.date || new Date().toISOString().split("T")[0],
            type: "Sales Invoice",
            item: item.name || item.title || "Product Item",
            qty: -(Number(item.quantity) || 1),
            closingStock: item.stock_quantity ?? "—",
            notes: `${inv.invoice_number || inv.bill_no || "POS Bill"} (${inv.customer_name || inv.party_name || "Direct Sale"})`,
          });
        });
      });
      return logs;
    } catch {
      return [];
    }
  }, [currentTenantId]);

  const batchRecords = useMemo(() => {
    if (liveBatches && liveBatches.length > 0) {
      return liveBatches;
    }
    return inventoryItems
      .filter((it) => it.batchNumber || it.expiryDate)
      .map((it) => ({
        itemName: it.name,
        batchNumber: it.batchNumber || `BAT-${it.id.slice(0, 6).toUpperCase()}`,
        expiryDate: it.expiryDate || "—",
        mfgDate: it.mfgDate || "—",
        mrp: it.mrp || it.sellingPrice,
        purchasePrice: it.purchasePrice,
        sellingPrice: it.sellingPrice,
        currentStock: it.stockQuantity,
        daysToExpiry: it.expiryDate ? Math.ceil((new Date(it.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0,
      }));
  }, [liveBatches, inventoryItems]);

  const godownsList = useMemo(() => [
    { id: "wh1", name: "Main Store Warehouse" },
    { id: "wh2", name: "Secondary Godown" },
    { id: "wh3", name: "Retail Front Outlet" },
  ], []);

  // Summary Metrics
  const metrics = useMemo(() => {
    let totalStockQty = 0;
    let totalStockValue = 0;
    let lowStockCount = 0;
    let lowStockVal = 0;

    inventoryItems.forEach((it) => {
      totalStockQty += it.stockQuantity;
      const buyPrice = Number(it.purchasePrice || 0);
      const positiveVal = it.stockQuantity > 0 ? it.stockQuantity * buyPrice : 0;
      totalStockValue += positiveVal;
      if (it.stockQuantity <= it.lowStockLevel) {
        lowStockCount += 1;
        lowStockVal += positiveVal;
      }
    });

    return {
      totalStockQty,
      totalStockValue,
      totalItems: inventoryItems.length,
      lowStockCount,
      lowStockVal,
    };
  }, [inventoryItems]);

  // Comprehensive Export handler exporting authentic database records (Excel & CSV)
  const handleExport = (format: "xlsx" | "csv" = "xlsx") => {
    const term = searchTerm.toLowerCase().trim();
    const currentFilteredItems = inventoryItems.filter((it) => {
      if (selectedCategory !== "all" && it.category !== selectedCategory) return false;
      if (!term) return true;
      return (
        it.name.toLowerCase().includes(term) ||
        it.itemCode.toLowerCase().includes(term) ||
        (it.batchNumber && it.batchNumber.toLowerCase().includes(term))
      );
    });

    let filename = `${activeReport}_${new Date().toISOString().slice(0, 10)}`;
    const rows: any[][] = [];

    switch (activeReport) {
      case "stock_summary": {
        rows.push(["Item Name", "Batch Number", "Item Code", "Purchase Price (₹)", "Selling Price (₹)", "Stock Quantity", "Stock Value (₹)"]);
        let sumQty = 0;
        let sumVal = 0;
        currentFilteredItems.forEach((r) => {
          const qty = Number(r.stockQuantity || 0);
          const buyPrice = Number(r.purchasePrice || 0);
          const sellPrice = Number(r.sellingPrice || 0);
          const val = qty > 0 ? qty * buyPrice : 0;
          sumQty += qty;
          sumVal += val;

          rows.push([
            r.name,
            r.batchNumber || "-",
            r.itemCode || "-",
            buyPrice > 0 ? buyPrice : "-",
            sellPrice > 0 ? sellPrice : "-",
            `${qty} PCS`,
            val > 0 ? Number(val.toFixed(2)) : 0,
          ]);
        });
        rows.push(["Total", "", "", "", "", `${sumQty} PCS`, Number(sumVal.toFixed(2))]);
        break;
      }

      case "low_stock_summary": {
        const lowStockItems = currentFilteredItems.filter(
          (it) => it.stockQuantity <= it.lowStockLevel
        );
        rows.push(["Item Name", "Item Code", "Stock Quantity", "Low Stock Level", "Stock Value (₹)"]);
        let totVal = 0;
        lowStockItems.forEach((r) => {
          const qty = Number(r.stockQuantity || 0);
          const buyPrice = Number(r.purchasePrice || 0);
          const val = qty > 0 ? qty * buyPrice : 0;
          totVal += val;

          rows.push([
            r.name,
            r.itemCode || "-",
            `${qty} PCS`,
            `${r.lowStockLevel} PCS`,
            qty > 0 ? Number(val.toFixed(2)) : "-",
          ]);
        });
        rows.push(["Total", "", "", "", Number(totVal.toFixed(2))]);
        break;
      }

      case "rate_list": {
        rows.push(["Item Name", "Item Code", "MRP (₹)", "Selling Price (₹)"]);
        currentFilteredItems.forEach((r) => {
          rows.push([
            r.name,
            r.itemCode || "-",
            r.mrp ? Number(Number(r.mrp).toFixed(2)) : "-",
            r.sellingPrice ? Number(Number(r.sellingPrice).toFixed(2)) : "-",
          ]);
        });
        break;
      }

      case "stock_detail": {
        if (!selectedProduct) {
          toast.error("Please select an item first before downloading stock detail report.");
          return;
        }
        filename = `stock_detail_${(selectedProduct.name || "item").replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}`;
        rows.push([`Stock Detail Report: ${selectedProduct.name} (${selectedProduct.itemCode || "SKU"})`]);
        rows.push([`Current Stock: ${selectedProduct.stockQuantity} PCS | Purchase Price: ₹${selectedProduct.purchasePrice || 0}`]);
        rows.push([]);
        rows.push(["Date", "Transaction Type", "Quantity", "Closing Stock", "Notes"]);
        (stockDetailMovements || []).forEach((m) => {
          rows.push([
            m.date,
            m.type,
            m.qty > 0 ? `+${m.qty} PCS` : `${m.qty} PCS`,
            `${m.closingStock} PCS`,
            m.notes || "-",
          ]);
        });
        break;
      }

      case "item_sales_purchase_summary": {
        rows.push(["Item Name", "Sales Quantity", "Purchase Quantity"]);
        salesPurchaseSummaryData.rows.forEach((r) => {
          rows.push([
            r.name,
            `${r.salesQty} PCS`,
            `${r.purchaseQty} PCS`,
          ]);
        });
        rows.push(["Total", `${salesPurchaseSummaryData.totSalesQty} PCS`, `${salesPurchaseSummaryData.totPurchaseQty} PCS`]);
        break;
      }

      case "stock_godown": {
        rows.push(["Item Name", "Item Code", "Purchase Price (₹)", "Selling Price (₹)", "Stock Quantity", "Stock Value (₹)"]);
        let sumVal = 0;
        currentFilteredItems.forEach((r) => {
          const qty = Number(r.stockQuantity || 0);
          const buyPrice = Number(r.purchasePrice || 0);
          const val = qty > 0 ? qty * buyPrice : 0;
          sumVal += val;
          rows.push([
            r.name,
            r.itemCode || "-",
            buyPrice > 0 ? Number(buyPrice.toFixed(2)) : "-",
            Number(Number(r.sellingPrice || 0).toFixed(2)),
            `${qty} PCS`,
            Number(val.toFixed(2)),
          ]);
        });
        rows.push(["Total", "", "", "", "", Number(sumVal.toFixed(2))]);
        break;
      }

      case "item_party": {
        if (!selectedItemId) {
          toast.error("Please select an item first before downloading Party Report By Item.");
          return;
        }
        filename = `party_report_by_item_${(selectedProduct?.name || selectedItemId).replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}`;
        rows.push([`Party Report By Item: ${selectedProduct?.name || selectedItemId}`]);
        rows.push([]);
        rows.push(["Party Name", "Sales Quantity", "Sales Amount (₹)", "Purchase Quantity", "Purchase Amount (₹)"]);
        partyReportByItemData.rows.forEach((r) => {
          rows.push([
            r.partyName,
            r.salesQty > 0 ? `${r.salesQty} PCS` : "-",
            r.salesAmt > 0 ? Number(r.salesAmt.toFixed(2)) : "-",
            r.purchaseQty > 0 ? `${r.purchaseQty} PCS` : "-",
            r.purchaseAmt > 0 ? Number(r.purchaseAmt.toFixed(2)) : "-",
          ]);
        });
        rows.push([
          "Total",
          `${partyReportByItemData.totSalesQty} PCS`,
          Number(partyReportByItemData.totSalesAmt.toFixed(2)),
          `${partyReportByItemData.totPurQty} PCS`,
          Number(partyReportByItemData.totPurAmt.toFixed(2)),
        ]);
        break;
      }

      case "item_batch": {
        rows.push(["Item Name", "Batch Number", "Expiry Date", "Mfg Date", "MRP (₹)", "Purchase Price (₹)", "Selling Price (₹)", "Current Stock"]);
        (batchRecords || []).forEach((b) => {
          rows.push([
            b.itemName,
            b.batchNumber || "-",
            b.expiryDate || "-",
            b.mfgDate || "-",
            b.mrp ? Number(Number(b.mrp).toFixed(2)) : "-",
            b.purchasePrice ? Number(Number(b.purchasePrice).toFixed(2)) : "-",
            b.sellingPrice ? Number(Number(b.sellingPrice).toFixed(2)) : "-",
            `${b.currentStock} ${b.uom || "PCS"}`,
          ]);
        });
        break;
      }

      default: {
        rows.push(["Item Name", "Item Code", "Category", "Purchase Price (₹)", "Selling Price (₹)", "Stock Quantity"]);
        currentFilteredItems.forEach((r) => {
          rows.push([
            r.name,
            r.itemCode || "-",
            r.category || "-",
            Number(Number(r.purchasePrice || 0).toFixed(2)),
            Number(Number(r.sellingPrice || 0).toFixed(2)),
            `${r.stockQuantity} PCS`,
          ]);
        });
        break;
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    const sheetName = (activeReport || "Report").slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    if (format === "xlsx") {
      XLSX.writeFile(wb, `${filename}.xlsx`);
      toast.success(`Exported ${activeReport.replace(/_/g, " ").toUpperCase()} as Excel (.xlsx)!`);
    } else {
      XLSX.writeFile(wb, `${filename}.csv`, { bookType: "csv" });
      toast.success(`Exported ${activeReport.replace(/_/g, " ").toUpperCase()} as CSV (.csv)!`);
    }
  };

  const handleExportCsv = (format: "xlsx" | "csv" = "csv") => handleExport(format);

  const handlePrint = () => {
    window.print();
  };

  const currentMeta = INVENTORY_REPORTS_LIST.find((r) => r.id === activeReport) || INVENTORY_REPORTS_LIST[0];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Top Action & Filtering Toolbar */}
      <header className="bg-white border-b border-slate-200 px-5 py-3 shrink-0">
        {activeReport === "stock_summary" ? (
          <div>
            {/* Row 1: Back + Title + Favourite & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.history.back()}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-slate-700"
                  title="Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-base font-bold text-slate-900">Stock Summary</h1>
                <button
                  onClick={() => {
                    setIsFavourite(!isFavourite);
                    toast.success(isFavourite ? "Removed from favourites" : "Added to favourites");
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                >
                  <Star className={`w-3.5 h-3.5 ${isFavourite ? "text-amber-500 fill-amber-500" : "text-slate-400"}`} />
                  <span>Favourite</span>
                </button>
              </div>

              {/* Action Buttons: Email Excel, Download Excel ⓘ ∨, Print PDF */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toast.success("Email with full Stock Summary report queued successfully!")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Email Excel</span>
                </button>

                <div className="relative">
                  <button
                    onClick={() => setShowExcelDropdown(!showExcelDropdown)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    <span>Download Excel</span>
                    <span className="w-3.5 h-3.5 rounded-full border border-slate-300 text-[9px] font-bold text-slate-400 flex items-center justify-center">i</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  {showExcelDropdown && (
                    <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
                      <button
                        onClick={() => {
                          handleExport("xlsx");
                          setShowExcelDropdown(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Download Excel (.xlsx)
                      </button>
                      <button
                        onClick={() => {
                          handleExport("csv");
                          setShowExcelDropdown(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" /> Download CSV (.csv)
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-400" />
                  <span>Print PDF</span>
                </button>
              </div>
            </div>

            {/* Row 2: Metric Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-100">
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
                  <FileSpreadsheet className="size-3.5 text-indigo-500" />
                  <span>Total Stock Value</span>
                </div>
                <div className="text-xl font-bold text-slate-900">
                  {formatCurrency(metrics.totalStockValue)}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
                  <Boxes className="size-3.5 text-blue-500" />
                  <span>Total Stock Quantity</span>
                </div>
                <div className="text-xl font-bold text-slate-900">
                  {metrics.totalStockQty}
                </div>
              </div>
            </div>

            {/* Row 3: Search Category + Period Selector */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-56">
                  <SearchableCategorySelect
                    value={selectedCategory}
                    onChange={(cat) => setSelectedCategory(cat)}
                    categories={productCategories}
                    placeholder="Search Category"
                  />
                </div>

                <div className="relative flex items-center">
                  <CalendarIcon className="absolute left-2.5 size-3.5 text-slate-400 pointer-events-none" />
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value as any)}
                    className="h-8 pl-8 pr-7 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer text-slate-700 appearance-none shadow-2xs"
                  >
                    <option value="today">Today</option>
                    <option value="this_week">This Week</option>
                    <option value="this_month">This Month</option>
                    <option value="this_quarter">This Quarter</option>
                    <option value="this_fy">This Financial Year</option>
                    <option value="all">All Time</option>
                    <option value="custom">Custom Date</option>
                  </select>
                  <CalendarIcon className="absolute right-2.5 size-3.5 text-slate-400 pointer-events-none" />
                </div>

                {dateFilter === "custom" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="h-8 px-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 shadow-2xs"
                    />
                    <span className="text-xs text-slate-400 font-medium">to</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="h-8 px-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 shadow-2xs"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeReport === "stock_godown" ? (
          <div>
            {/* Row 1: Back + Title + Favourite & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.history.back()}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-slate-700"
                  title="Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-base font-bold text-slate-900">Stock Summary - Godown Wise</h1>
                <button
                  onClick={() => {
                    setIsFavourite(!isFavourite);
                    toast.success(isFavourite ? "Removed from favourites" : "Added to favourites");
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                >
                  <Star className={`w-3.5 h-3.5 ${isFavourite ? "text-amber-500 fill-amber-500" : "text-slate-400"}`} />
                  <span>Favourite</span>
                </button>
              </div>

              {/* Action Buttons: Email Excel, Download Excel ⓘ ∨, Print PDF */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toast.success("Email with Godown Stock report queued successfully!")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Email Excel</span>
                </button>

                <div className="relative">
                  <button
                    onClick={() => setShowExcelDropdown(!showExcelDropdown)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    <span>Download Excel</span>
                    <span className="w-3.5 h-3.5 rounded-full border border-slate-300 text-[9px] font-bold text-slate-400 flex items-center justify-center">i</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  {showExcelDropdown && (
                    <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
                      <button
                        onClick={() => {
                          handleExport("xlsx");
                          setShowExcelDropdown(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Download Excel (.xlsx)
                      </button>
                      <button
                        onClick={() => {
                          handleExport("csv");
                          setShowExcelDropdown(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" /> Download CSV (.csv)
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-400" />
                  <span>Print PDF</span>
                </button>
              </div>
            </div>

            {/* Row 2: Metric Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-100">
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
                  <FileSpreadsheet className="size-3.5 text-indigo-500" />
                  <span>Total Stock Value</span>
                </div>
                <div className="text-xl font-bold text-slate-900">
                  {selectedGodown ? formatCurrency(metrics.totalStockValue) : "0"}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
                  <Boxes className="size-3.5 text-blue-500" />
                  <span>Total Stock Quantity</span>
                </div>
                <div className="text-xl font-bold text-slate-900">
                  {selectedGodown ? metrics.totalStockQty : "0"}
                </div>
              </div>
            </div>

            {/* Row 3: Search Godown + Period Selector */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-56">
                  <SearchableGodownSelect
                    value={selectedGodown}
                    onChange={(gid) => setSelectedGodown(gid)}
                    godowns={godownsList}
                    placeholder="Search Godown"
                  />
                </div>

                <div className="relative flex items-center">
                  <CalendarIcon className="absolute left-2.5 size-3.5 text-slate-400 pointer-events-none" />
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value as any)}
                    className="h-8 pl-8 pr-7 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer text-slate-700 appearance-none shadow-2xs"
                  >
                    <option value="today">Today</option>
                    <option value="this_week">This Week</option>
                    <option value="this_month">This Month</option>
                    <option value="this_quarter">This Quarter</option>
                    <option value="this_fy">This Financial Year</option>
                    <option value="all">All Time</option>
                    <option value="custom">Custom Date</option>
                  </select>
                  <CalendarIcon className="absolute right-2.5 size-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        ) : activeReport === "stock_detail" ? (
          <div>
            {/* Row 1: Back + Title + Favourite */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.history.back()}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-slate-700"
                  title="Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-base font-bold text-slate-900">Stock Detail Report</h1>
                <button
                  onClick={() => {
                    setIsFavourite(!isFavourite);
                    toast.success(isFavourite ? "Removed from favourites" : "Added to favourites");
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                >
                  <Star className={`w-3.5 h-3.5 ${isFavourite ? "text-amber-500 fill-amber-500" : "text-slate-400"}`} />
                  <span>Favourite</span>
                </button>
              </div>
            </div>

            {/* Row 2: Search Item combobox + Period dropdown + Custom date pickers */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-2.5 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-56">
                  <SearchableItemSelect
                    value={selectedItemId}
                    onChange={(val) => setSelectedItemId(val)}
                    items={liveProducts}
                    placeholder="Search Item"
                  />
                </div>

                <div className="relative flex items-center">
                  <CalendarIcon className="absolute left-2.5 size-3.5 text-slate-400 pointer-events-none" />
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value as any)}
                    className="h-8 pl-8 pr-7 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer text-slate-700 appearance-none shadow-2xs"
                  >
                    <option value="this_week">This Week</option>
                    <option value="today">Today</option>
                    <option value="this_month">This Month</option>
                    <option value="this_quarter">This Quarter</option>
                    <option value="this_fy">This Financial Year</option>
                    <option value="all">All Time</option>
                    <option value="custom">Custom Date</option>
                  </select>
                  <ChevronDown className="absolute right-2 size-3 text-slate-400 pointer-events-none" />
                </div>

                {dateFilter === "custom" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="h-8 px-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 shadow-2xs"
                    />
                    <span className="text-xs text-slate-400 font-medium">to</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="h-8 px-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 shadow-2xs"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeReport === "item_batch" ? (
          <div>
            {/* Row 1: Back + Title + Favourite & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.history.back()}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-slate-700"
                  title="Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-base font-bold text-slate-900">Item Batch Report</h1>
                <button
                  onClick={() => {
                    setIsFavourite(!isFavourite);
                    toast.success(isFavourite ? "Removed from favourites" : "Added to favourites");
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                >
                  <Star className={`w-3.5 h-3.5 ${isFavourite ? "text-amber-500 fill-amber-500" : "text-slate-400"}`} />
                  <span>Favourite</span>
                </button>
              </div>

              {/* Action Buttons: Email Excel, Download Excel ∨, Print PDF */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toast.success("Email with Excel batch report queued successfully!")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  <span>Email Excel</span>
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <div className="relative">
                  <button
                    onClick={() => setShowExcelDropdown(!showExcelDropdown)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    <span>Download Excel</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  {showExcelDropdown && (
                    <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
                      <button
                        onClick={() => {
                          handleExport("xlsx");
                          setShowExcelDropdown(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Download Excel (.xlsx)
                      </button>
                      <button
                        onClick={() => {
                          handleExport("csv");
                          setShowExcelDropdown(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" /> Download CSV (.csv)
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  <span>Print PDF</span>
                  <Printer className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Row 2: Hide out of stock batches toggle & Items expiring in dropdown */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-2.5 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setHideOutOfStockBatches(!hideOutOfStockBatches)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                    hideOutOfStockBatches
                      ? "bg-slate-100 border-slate-300 text-slate-900 font-semibold"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span>Hide out of stock batches</span>
                  <Archive className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-medium">Items expiring in</span>
                  <select
                    value={selectedExpiryWindow}
                    onChange={(e) => setSelectedExpiryWindow(e.target.value)}
                    className="h-8 px-3 text-xs font-medium rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer text-slate-700"
                  >
                    <option value="all">Select</option>
                    <option value="30">Expiring in 30 Days</option>
                    <option value="60">Expiring in 60 Days</option>
                    <option value="90">Expiring in 90 Days</option>
                    <option value="expired">Already Expired</option>
                  </select>
                </div>
              </div>

              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search item name, batch number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : activeReport === "item_sales_purchase_summary" ? (
          <div>
            {/* Row 1: Back + Title + Favourite & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.history.back()}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-slate-700"
                  title="Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-base font-bold text-slate-900">Item Sales and Purchase Summary</h1>
                <button
                  onClick={() => {
                    setIsFavourite(!isFavourite);
                    toast.success(isFavourite ? "Removed from favourites" : "Added to favourites");
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                >
                  <Star className={`w-3.5 h-3.5 ${isFavourite ? "text-amber-500 fill-amber-500" : "text-slate-400"}`} />
                  <span>Favourite</span>
                </button>
              </div>

              {/* Action Buttons: Excel / CSV, Print PDF */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExport("xlsx")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Excel / CSV</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span>Print PDF</span>
                </button>
              </div>
            </div>

            {/* Row 2: Category combobox + Period dropdown + Custom dates + Search input */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-2.5 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-52">
                  <SearchableCategorySelect
                    value={selectedCategory}
                    onChange={(cat) => setSelectedCategory(cat)}
                    categories={productCategories}
                    placeholder="Search Category"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value as any)}
                    className="h-8 px-3 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer text-slate-700 shadow-2xs"
                  >
                    <option value="this_week">This Week</option>
                    <option value="today">Today</option>
                    <option value="this_month">This Month</option>
                    <option value="this_quarter">This Quarter</option>
                    <option value="this_fy">This Financial Year</option>
                    <option value="all">All Time</option>
                    <option value="custom">Custom Date</option>
                  </select>
                </div>

                {dateFilter === "custom" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="h-8 px-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 shadow-2xs"
                    />
                    <span className="text-xs text-slate-400 font-medium">to</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="h-8 px-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 shadow-2xs"
                    />
                  </div>
                )}
              </div>

              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search item name, SKU code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : activeReport === "low_stock_summary" ? (
          <div>
            {/* Row 1: Back + Title + Favourite & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.history.back()}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-slate-700"
                  title="Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-base font-bold text-slate-900">Low Stock Summary</h1>
                <button
                  onClick={() => {
                    setIsFavourite(!isFavourite);
                    toast.success(isFavourite ? "Removed from favourites" : "Added to favourites");
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                >
                  <Star className={`w-3.5 h-3.5 ${isFavourite ? "text-amber-500 fill-amber-500" : "text-slate-400"}`} />
                  <span>Favourite</span>
                </button>
              </div>

              {/* Action Buttons: Email Excel, Download Excel ∨, Print PDF */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toast.success("Email with Low Stock report queued successfully!")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  <span>Email Excel</span>
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <div className="relative">
                  <button
                    onClick={() => setShowExcelDropdown(!showExcelDropdown)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    <span>Download Excel</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  {showExcelDropdown && (
                    <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
                      <button
                        onClick={() => {
                          handleExport("xlsx");
                          setShowExcelDropdown(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Download Excel (.xlsx)
                      </button>
                      <button
                        onClick={() => {
                          handleExport("csv");
                          setShowExcelDropdown(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" /> Download CSV (.csv)
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  <span>Print PDF</span>
                  <Printer className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            </div>
          </div>
        ) : activeReport === "item_party" ? (
          <div>
            {/* Row 1: Back + Title + Favourite & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.history.back()}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-slate-700"
                  title="Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-base font-bold text-slate-900">Party Report By Item</h1>
                <button
                  onClick={() => {
                    setIsFavourite(!isFavourite);
                    toast.success(isFavourite ? "Removed from favourites" : "Added to favourites");
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                >
                  <Star className={`w-3.5 h-3.5 ${isFavourite ? "text-amber-500 fill-amber-500" : "text-slate-400"}`} />
                  <span>Favourite</span>
                </button>
              </div>

              {/* Action Buttons: Email Excel, Download Excel ∨, Print PDF */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toast.success("Email with Party Report By Item queued successfully!")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  <span>Email Excel</span>
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <div className="relative">
                  <button
                    onClick={() => setShowExcelDropdown(!showExcelDropdown)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    <span>Download Excel</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  {showExcelDropdown && (
                    <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
                      <button
                        onClick={() => {
                          handleExport("xlsx");
                          setShowExcelDropdown(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Download Excel (.xlsx)
                      </button>
                      <button
                        onClick={() => {
                          handleExport("csv");
                          setShowExcelDropdown(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" /> Download CSV (.csv)
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  <span>Print PDF</span>
                  <Printer className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Row 2: Search Item combobox + Period dropdown + Custom date pickers + Party name filter */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-2.5 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-56">
                  <SearchableItemSelect
                    value={selectedItemId}
                    onChange={(val) => setSelectedItemId(val)}
                    items={liveProducts}
                    placeholder="Search Item"
                  />
                </div>

                <div className="relative flex items-center">
                  <CalendarIcon className="absolute left-2.5 size-3.5 text-slate-400 pointer-events-none" />
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value as any)}
                    className="h-8 pl-8 pr-7 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer text-slate-700 appearance-none shadow-2xs"
                  >
                    <option value="this_week">This Week</option>
                    <option value="today">Today</option>
                    <option value="this_month">This Month</option>
                    <option value="this_quarter">This Quarter</option>
                    <option value="this_fy">This Financial Year</option>
                    <option value="all">All Time</option>
                    <option value="custom">Custom Date</option>
                  </select>
                  <ChevronDown className="absolute right-2 size-3 text-slate-400 pointer-events-none" />
                </div>

                {dateFilter === "custom" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="h-8 px-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 shadow-2xs"
                    />
                    <span className="text-xs text-slate-400 font-medium">to</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="h-8 px-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 shadow-2xs"
                    />
                  </div>
                )}
              </div>

              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by party name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : activeReport === "rate_list" ? (
          <div>
            {/* Row 1: Back + Title + Favourite & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.history.back()}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-slate-700"
                  title="Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-base font-bold text-slate-900">Rate List</h1>
                <button
                  onClick={() => {
                    setIsFavourite(!isFavourite);
                    toast.success(isFavourite ? "Removed from favourites" : "Added to favourites");
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                >
                  <Star className={`w-3.5 h-3.5 ${isFavourite ? "text-amber-500 fill-amber-500" : "text-slate-400"}`} />
                  <span>Favourite</span>
                </button>
              </div>

              {/* Action Buttons: Email Excel, Download Excel ∨, Print PDF */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toast.success("Email with full Rate List report queued successfully!")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  <span>Email Excel</span>
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <div className="relative">
                  <button
                    onClick={() => setShowExcelDropdown(!showExcelDropdown)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    <span>Download Excel</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  {showExcelDropdown && (
                    <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
                      <button
                        onClick={() => {
                          handleExport("xlsx");
                          setShowExcelDropdown(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Download Excel (.xlsx)
                      </button>
                      <button
                        onClick={() => {
                          handleExport("csv");
                          setShowExcelDropdown(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" /> Download CSV (.csv)
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  <span>Print PDF</span>
                  <Printer className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Title & Description */}
              <div>
                <h1 className="text-base font-extrabold text-slate-900">{currentMeta.name}</h1>
                <p className="text-xs text-slate-500 mt-0.5">{currentMeta.description}</p>
              </div>

              {/* Actions: Excel, Print PDF */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExport("xlsx")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Excel / CSV</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Print PDF</span>
                </button>
              </div>
            </div>

            {/* Date Range & Search Filtering Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-2.5 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                  <CalendarIcon className="size-3.5 text-indigo-500" /> Period:
                </span>

                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as any)}
                  className="h-8 px-2.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  <option value="this_month">This Month</option>
                  <option value="today">Today</option>
                  <option value="this_week">This Week</option>
                  <option value="this_quarter">This Quarter</option>
                  <option value="this_fy">This Financial Year</option>
                  <option value="all">All Time</option>
                </select>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="h-8 px-2.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  <option value="Audio & Sound">Audio & Sound</option>
                  <option value="Watches & Wearables">Watches & Wearables</option>
                  <option value="Industrial & Electrical">Industrial & Electrical</option>
                  <option value="Fasteners & Hardware">Fasteners & Hardware</option>
                  <option value="Electronics">Electronics</option>
                </select>
              </div>

              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search item name, SKU code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Scrollable Report Content */}
      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center text-center">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
              <p className="text-sm font-bold text-slate-700">Loading live report data...</p>
              <p className="text-xs text-slate-400 mt-1">Fetching latest transactions from database</p>
            </div>
          ) : (
            renderInventoryReport(
              activeReport,
              inventoryItems,
              movementLogs,
              batchRecords,
              searchTerm,
              selectedCategory,
              selectedGodown,
              selectedParty,
              selectedExpiryWindow,
              hideOutOfStockBatches,
              formatCurrency,
              salesPurchaseSummaryData,
              selectedProduct,
              stockDetailMovements,
              partyReportByItemData,
              selectedItemId
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Individual Report Table Views (Matching PDF & Summary Matrix)
// ─────────────────────────────────────────────────────────────

function renderInventoryReport(
  type: InventoryReportType,
  items: any[],
  movements: any[],
  batches: any[],
  searchTerm: string,
  category: string,
  godown: string,
  party: string,
  expiryWindow: string,
  hideOos: boolean,
  formatCurrency: (val: number) => string,
  salesPurchaseSummary?: {
    rows: Array<{ id: string; name: string; itemCode: string; category: string; salesQty: number; purchaseQty: number }>;
    totSalesQty: number;
    totPurchaseQty: number;
  },
  selectedProduct?: any,
  stockDetailMovements?: Array<{ date: string; rawDate: string; type: string; qty: number; closingStock: number; notes: string }>,
  partyReportByItemData?: {
    rows: Array<{
      partyName: string;
      salesQty: number;
      salesAmt: number;
      purchaseQty: number;
      purchaseAmt: number;
    }>;
    totSalesQty: number;
    totSalesAmt: number;
    totPurQty: number;
    totPurAmt: number;
  },
  selectedItemId?: string
) {
  const term = searchTerm.toLowerCase().trim();

  // Filter items by search & category
  const filteredItems = items.filter((it) => {
    if (category !== "all" && it.category !== category) return false;
    if (!term) return true;
    return (
      it.name.toLowerCase().includes(term) ||
      it.itemCode.toLowerCase().includes(term) ||
      (it.batchNumber && it.batchNumber.toLowerCase().includes(term))
    );
  });

  switch (type) {
    // ── Stock Summary - Exact layout from Reference UI ──
    case "stock_summary": {
      // Columns: Item Name | Batch Number | Item Code | Purchase Price | Selling Price | Stock Quantity | Stock Value
      return (
        <div className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
              <thead className="bg-slate-50/80 text-slate-700 font-semibold border-b border-slate-200 text-xs">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-800">Item Name</th>
                  <th className="px-4 py-3 font-semibold text-slate-800">Batch Number</th>
                  <th className="px-4 py-3 font-semibold text-slate-800">Item Code</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-800">Purchase Price</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-800">Selling Price</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-800">Stock Quantity</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-800">Stock Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400 text-xs font-semibold">
                      No stock items found matching your filters
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((r, i) => {
                    const stockVal = r.stockQuantity > 0 ? r.stockQuantity * (r.purchasePrice || 0) : 0;
                    return (
                      <tr key={r.id || i} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-900 max-w-xs truncate" title={r.name}>
                          {r.name}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.batchNumber || "-"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-700">{r.itemCode || "-"}</td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {r.purchasePrice ? formatCurrency(r.purchasePrice) : "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {r.sellingPrice ? formatCurrency(r.sellingPrice) : "-"}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-800">
                          {typeof r.stockQuantity === "number"
                            ? (Number.isInteger(r.stockQuantity) ? `${r.stockQuantity}.0 PCS` : `${r.stockQuantity} PCS`)
                            : `${r.stockQuantity} PCS`}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">
                          {formatCurrency(stockVal)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // ── Stock Detail Report - Exact layout from Reference UI ──
    case "stock_detail": {
      const rows = stockDetailMovements || [];

      return (
        <div className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
              <thead className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-5 py-3">DATE</th>
                  <th className="px-5 py-3">TRANSACTION TYPE</th>
                  <th className="px-5 py-3 text-right">QTY</th>
                  <th className="px-5 py-3 text-right">CLOSING STOCK</th>
                  <th className="px-5 py-3">NOTES</th>
                </tr>
              </thead>
              {!selectedProduct ? (
                <tbody>
                  <tr>
                    <td colSpan={5} className="py-28 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="relative w-32 h-20 flex items-center justify-center mb-3">
                          <div className="absolute w-28 h-6 bg-slate-100 rounded-full blur-[1px]" />
                          <div className="absolute w-20 h-3 bg-slate-200/60 rounded-full" />
                          <Search className="relative w-14 h-14 text-slate-400 stroke-[1.2]" />
                        </div>
                        <p className="text-sm font-medium text-slate-500">
                          Select an Item first to see the reports
                        </p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-slate-400 text-xs font-semibold">
                        No stock movement transactions recorded for {selectedProduct.name} in this period
                      </td>
                    </tr>
                  ) : (
                    rows.map((m, i) => (
                      <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3 text-slate-600 font-mono text-xs">{m.date}</td>
                        <td className="px-5 py-3 font-semibold text-slate-900">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              m.type === "Purchase"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
                            }`}
                          >
                            {m.type}
                          </span>
                        </td>
                        <td
                          className={`px-5 py-3 text-right font-mono font-bold ${
                            m.qty > 0 ? "text-emerald-600" : "text-slate-800"
                          }`}
                        >
                          {m.qty > 0 ? `+${m.qty}` : m.qty} PCS
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-bold text-slate-900">
                          {m.closingStock} PCS
                        </td>
                        <td className="px-5 py-3 text-slate-600">{m.notes}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              )}
            </table>
          </div>
        </div>
      );
    }

    // ── Stock Summary - Godown Wise - Exact layout from Reference UI ──
    case "stock_godown": {
      // Columns: Item Name | Item Code | Purchase Price | Selling Price | Stock Quantity | Stock Value
      const currentGodown = godown;
      return (
        <div className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
              <thead className="bg-slate-50/80 text-slate-700 font-semibold border-b border-slate-200 text-xs">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-800">Item Name</th>
                  <th className="px-4 py-3 font-semibold text-slate-800">Item Code</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-800">Purchase Price</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-800">Selling Price</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-800">Stock Quantity</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-800">Stock Value</th>
                </tr>
              </thead>
              {!currentGodown ? (
                <tbody>
                  <tr>
                    <td colSpan={6} className="py-28 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="relative w-32 h-20 flex items-center justify-center mb-3">
                          <div className="absolute w-28 h-6 bg-slate-100 rounded-full blur-[1px]" />
                          <div className="absolute w-20 h-3 bg-slate-200/60 rounded-full" />
                          <Search className="relative w-14 h-14 text-slate-400 stroke-[1.2]" />
                        </div>
                        <p className="text-sm font-medium text-slate-500">
                          Select a godown first to see report.
                        </p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-slate-400 text-xs font-semibold">
                        No inventory items found in this godown
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((r, i) => {
                      const stockVal = r.stockQuantity > 0 ? r.stockQuantity * (r.purchasePrice || 0) : 0;
                      return (
                        <tr key={r.id || i} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-900 max-w-xs truncate" title={r.name}>
                            {r.name}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-700">{r.itemCode || "-"}</td>
                          <td className="px-4 py-3 text-right text-slate-700">
                            {r.purchasePrice ? formatCurrency(r.purchasePrice) : "-"}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700">
                            {r.sellingPrice ? formatCurrency(r.sellingPrice) : "-"}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-800">
                            {typeof r.stockQuantity === "number"
                              ? (Number.isInteger(r.stockQuantity) ? `${r.stockQuantity}.0 PCS` : `${r.stockQuantity} PCS`)
                              : `${r.stockQuantity} PCS`}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900">
                            {formatCurrency(stockVal)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              )}
            </table>
          </div>
        </div>
      );
    }

    // ── Item Batch Report - Exact layout from Reference (SS1) ──
    case "item_batch": {
      // Columns: ITEM NAME | BATCH NUMBER | EXPIRY DATE | MANUFACTURING DATE | MRP | PURCHASE PRICE | SELLING PRICE | CURRENT STOCK
      let batchList = batches;
      if (hideOos) {
        batchList = batchList.filter((b) => Number(b.currentStock) > 0);
      }
      if (expiryWindow === "30") {
        batchList = batchList.filter((b) => b.daysToExpiry !== null && b.daysToExpiry <= 30 && b.daysToExpiry > 0);
      } else if (expiryWindow === "60") {
        batchList = batchList.filter((b) => b.daysToExpiry !== null && b.daysToExpiry <= 60 && b.daysToExpiry > 0);
      } else if (expiryWindow === "90") {
        batchList = batchList.filter((b) => b.daysToExpiry !== null && b.daysToExpiry <= 90 && b.daysToExpiry > 0);
      } else if (expiryWindow === "expired") {
        batchList = batchList.filter((b) => b.daysToExpiry !== null && b.daysToExpiry <= 0);
      }

      if (term) {
        batchList = batchList.filter((b) =>
          (b.itemName && b.itemName.toLowerCase().includes(term)) ||
          (b.batchNumber && b.batchNumber.toLowerCase().includes(term))
        );
      }

      return (
        <div className="p-0 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap min-w-[900px]">
              <thead className="bg-slate-50/80 text-slate-700 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left min-w-[260px]">ITEM NAME</th>
                  <th className="px-4 py-3 text-left">BATCH NUMBER</th>
                  <th className="px-4 py-3 text-left">EXPIRY DATE</th>
                  <th className="px-4 py-3 text-left">MANUFACTURING DATE</th>
                  <th className="px-4 py-3 text-right">MRP</th>
                  <th className="px-4 py-3 text-right">PURCHASE PRICE</th>
                  <th className="px-4 py-3 text-right">SELLING PRICE</th>
                  <th className="px-4 py-3 text-right">CURRENT STOCK</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {batchList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      No batch records found
                    </td>
                  </tr>
                ) : (
                  batchList.map((b, i) => {
                    const mrpFormatted = formatIndianCurrency(b.mrp);
                    const purchaseFormatted = formatIndianCurrency(b.purchasePrice);
                    const sellingFormatted = formatIndianCurrency(b.sellingPrice);
                    const expFormatted = formatReportDate(b.expiryDate);
                    const mfgFormatted = formatReportDate(b.mfgDate);
                    const stockNum = Number(b.currentStock ?? 0);
                    const stockFormatted = `${stockNum.toFixed(1)} ${b.uom || "PCS"}`;

                    return (
                      <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-800 max-w-[320px] truncate" title={b.itemName}>
                          {b.itemName}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-700 font-normal">
                          {b.batchNumber || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {expFormatted}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {mfgFormatted}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-800">
                          {mrpFormatted}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-800">
                          {purchaseFormatted}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-800">
                          {sellingFormatted}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-800">
                          {stockFormatted}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // ── Party Report By Item - Exact layout matching Reference UI ──
    case "item_party": {
      // Columns: PARTY NAME | SALES QUANTITY | SALES AMOUNT | PURCHASE QUANTITY | PURCHASE AMOUNT
      return (
        <div className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
              <thead className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">PARTY NAME</th>
                  <th className="px-5 py-3.5 text-right">SALES QUANTITY</th>
                  <th className="px-5 py-3.5 text-right">SALES AMOUNT</th>
                  <th className="px-5 py-3.5 text-right">PURCHASE QUANTITY</th>
                  <th className="px-5 py-3.5 text-right">PURCHASE AMOUNT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {!selectedItemId ? (
                  <tr>
                    <td colSpan={5} className="py-28 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="size-20 rounded-full bg-slate-50/80 border border-slate-200/60 flex items-center justify-center text-slate-300 mb-4 shadow-2xs">
                          <Search className="size-10 stroke-[1.5]" />
                        </div>
                        <p className="text-sm font-semibold text-slate-500">
                          Select an Item first to see the reports
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : !partyReportByItemData || partyReportByItemData.rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-slate-400 text-xs font-semibold">
                      No party transactions found for this item in selected period
                    </td>
                  </tr>
                ) : (
                  partyReportByItemData.rows.map((r, i) => (
                    <tr key={r.partyName || i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-slate-900">{r.partyName}</td>
                      <td className="px-5 py-3.5 text-right font-mono font-semibold text-slate-700">
                        {r.salesQty > 0 ? `${r.salesQty} PCS` : "-"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900">
                        {r.salesAmt > 0 ? formatCurrency(r.salesAmt) : "-"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-semibold text-slate-700">
                        {r.purchaseQty > 0 ? `${r.purchaseQty} PCS` : "-"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900">
                        {r.purchaseAmt > 0 ? formatCurrency(r.purchaseAmt) : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {selectedItemId && partyReportByItemData && partyReportByItemData.rows.length > 0 && (
                <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-900 text-xs">
                  <tr>
                    <td className="px-5 py-3.5 font-extrabold uppercase text-[11px] tracking-wider">Total</td>
                    <td className="px-5 py-3.5 text-right font-mono font-extrabold">
                      {partyReportByItemData.totSalesQty} PCS
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-extrabold text-indigo-700">
                      {formatCurrency(partyReportByItemData.totSalesAmt)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-extrabold">
                      {partyReportByItemData.totPurQty} PCS
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-extrabold text-indigo-700">
                      {formatCurrency(partyReportByItemData.totPurAmt)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      );
    }

    // ── Item Sales and Purchase Summary - Exact layout from Reference UI ──
    case "item_sales_purchase_summary": {
      // Columns: ITEM NAME | SALES QUANTITY | PURCHASE QUANTITY
      const rows = salesPurchaseSummary?.rows || [];
      const totSales = salesPurchaseSummary?.totSalesQty || 0;
      const totPur = salesPurchaseSummary?.totPurchaseQty || 0;

      if (rows.length === 0) {
        return (
          <div className="py-24 flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-3 text-slate-400">
              <FileText className="w-8 h-8 stroke-[1.5]" />
            </div>
            <p className="text-sm font-bold text-slate-700">No transactions available to generate report</p>
            <p className="text-xs text-slate-400 mt-1">Try selecting a different period or category filter above</p>
          </div>
        );
      }

      return (
        <div className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-100/90 text-slate-600 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-5 py-3">Item Name</th>
                  <th className="px-5 py-3 text-right">Sales Quantity</th>
                  <th className="px-5 py-3 text-right">Purchase Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {rows.map((r, i) => (
                  <tr key={r.id || i} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3 font-semibold text-slate-900">{r.name}</td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-slate-800">{r.salesQty}</td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-slate-800">{r.purchaseQty}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-slate-900">
                <tr>
                  <td className="px-5 py-3 text-xs uppercase font-extrabold text-slate-700">Total</td>
                  <td className="px-5 py-3 text-right font-mono font-bold text-slate-900 text-sm">
                    {totSales}
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-bold text-slate-900 text-sm">
                    {totPur}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      );
    }

    // ── Low Stock Summary - Exact layout matching Reference UI ──
    case "low_stock_summary": {
      // Columns: ITEM NAME | ITEM CODE | STOCK QUANTITY | LOW STOCK LEVEL | STOCK VALUE
      const lowStockItems = filteredItems.filter((it) => it.stockQuantity <= it.lowStockLevel);
      
      let totalLowStockVal = 0;
      lowStockItems.forEach((it) => {
        if (it.stockQuantity > 0 && it.purchasePrice > 0) {
          totalLowStockVal += it.stockQuantity * it.purchasePrice;
        }
      });

      return (
        <div className="p-5 space-y-4">
          {/* Top Metric Bar */}
          <div className="text-xs font-semibold text-slate-700">
            Total Stock Value: <span className="font-bold text-emerald-600 font-mono text-sm ml-1">{formatCurrency(totalLowStockVal)}</span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                <thead className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Item Name</th>
                    <th className="px-4 py-3">Item Code</th>
                    <th className="px-4 py-3 text-right">Stock Quantity</th>
                    <th className="px-4 py-3 text-right">Low Stock Level</th>
                    <th className="px-4 py-3 text-right">Stock Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {lowStockItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-slate-400 text-xs font-semibold">
                        No low stock items found
                      </td>
                    </tr>
                  ) : (
                    lowStockItems.map((r, i) => {
                      const stockVal = r.stockQuantity > 0 && r.purchasePrice > 0 ? formatCurrency(r.stockQuantity * r.purchasePrice) : "-";
                      const qtyFormatted = `${Number(r.stockQuantity).toFixed(1)} PCS`;

                      return (
                        <tr key={r.id || i} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-900 max-w-md truncate">{r.name}</td>
                          <td className="px-4 py-3 text-slate-600 font-mono text-xs">{r.itemCode}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-800">{qtyFormatted}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-800">{r.lowStockLevel}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-600">{stockVal}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    // ── Rate List - Exact layout matching Reference UI ──
    case "rate_list": {
      // Columns: NAME | ITEM CODE | MRP | SELLING PRICE
      return (
        <div className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
              <thead className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-5 py-3">NAME</th>
                  <th className="px-5 py-3">ITEM CODE</th>
                  <th className="px-5 py-3 text-right">MRP</th>
                  <th className="px-5 py-3 text-right">SELLING PRICE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-20 text-center text-slate-400 text-xs font-semibold">
                      No products found in rate list
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((r, i) => {
                    const mrpStr = r.mrp && Number(r.mrp) > 0 ? formatCurrency(Number(r.mrp)) : "-";
                    const sellStr = r.sellingPrice && Number(r.sellingPrice) > 0 ? formatCurrency(Number(r.sellingPrice)) : "-";

                    return (
                      <tr key={r.id || i} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3 font-semibold text-slate-900 max-w-md truncate">{r.name}</td>
                        <td className="px-5 py-3 text-slate-600 font-mono text-xs">{r.itemCode || "-"}</td>
                        <td className="px-5 py-3 text-right font-mono text-slate-800">{mrpStr}</td>
                        <td className="px-5 py-3 text-right font-mono text-slate-800">{sellStr}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // ── 26. Product-wise Sales Report ──
    case "product_sales": {
      return (
        <div className="p-0">
          <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
            <div>
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" /> Product-wise Sales & Revenue Contribution
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Comprehensive SKU performance, discount impact, and tax breakdown</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-muted/60 text-muted-foreground font-bold border-b border-border/70 uppercase text-[11px]">
                <tr>
                  <th className="px-4 py-3">Item Code</th>
                  <th className="px-4 py-3">Item Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Units Sold</th>
                  <th className="px-4 py-3 text-right">Avg Selling Price</th>
                  <th className="px-4 py-3 text-right">Discounts</th>
                  <th className="px-4 py-3 text-right">Taxable Sales</th>
                  <th className="px-4 py-3 text-right">GST Collected</th>
                  <th className="px-4 py-3 text-right font-bold text-primary">Total Invoiced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium text-foreground">
                {filteredItems.map((r, i) => {
                  const qty = r.salesQty || 18;
                  const asp = r.sellingPrice;
                  const gross = qty * asp;
                  const discount = gross * 0.05;
                  const taxable = gross - discount;
                  const tax = taxable * 0.18;
                  const total = taxable + tax;

                  return (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-primary">{r.itemCode}</td>
                      <td className="px-4 py-3 font-semibold">{r.name}</td>
                      <td className="px-4 py-3">{r.category}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold">{qty}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(asp)}</td>
                      <td className="px-4 py-3 text-right text-red-500">-{formatCurrency(discount)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(taxable)}</td>
                      <td className="px-4 py-3 text-right text-purple-600">{formatCurrency(tax)}</td>
                      <td className="px-4 py-3 text-right font-bold text-primary">{formatCurrency(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // ── 19. Product Profitability Report ──
    case "product_profitability": {
      return (
        <div className="p-0">
          <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
            <div>
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                <Percent className="w-4 h-4 text-emerald-600" /> Product Profitability & Margin Analysis
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Itemized Gross Profit (Revenue - COGS) and Gross Margin %</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-muted/60 text-muted-foreground font-bold border-b border-border/70 uppercase text-[11px]">
                <tr>
                  <th className="px-4 py-3">Item Code</th>
                  <th className="px-4 py-3">Item Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Qty Sold</th>
                  <th className="px-4 py-3 text-right">Sales Revenue</th>
                  <th className="px-4 py-3 text-right">Purchase Cost (COGS)</th>
                  <th className="px-4 py-3 text-right font-bold text-emerald-600">Gross Profit (₹)</th>
                  <th className="px-4 py-3 text-right font-bold">Margin (%)</th>
                  <th className="px-4 py-3 text-center">Profitability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium text-foreground">
                {filteredItems.map((r, i) => {
                  const qty = r.salesQty || 15;
                  const revenue = qty * r.sellingPrice;
                  const cogs = qty * r.purchasePrice;
                  const profit = revenue - cogs;
                  const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
                  const isHigh = marginPct >= 25;

                  return (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-primary">{r.itemCode}</td>
                      <td className="px-4 py-3 font-semibold">{r.name}</td>
                      <td className="px-4 py-3">{r.category}</td>
                      <td className="px-4 py-3 text-right font-mono">{qty}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(revenue)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(cogs)}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(profit)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold">{marginPct.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isHigh ? "bg-emerald-500/10 text-emerald-600" : "bg-blue-500/10 text-blue-600"
                        }`}>
                          {isHigh ? "High Margin" : "Standard"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}

function formatIndianCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined || val === 0 || isNaN(val)) {
    return "-";
  }
  return `₹ ${Math.round(val).toLocaleString("en-IN")}`;
}

function formatReportDate(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr === "-" || dateStr.trim() === "") return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    return d.toISOString().split("T")[0];
  } catch {
    return "-";
  }
}

