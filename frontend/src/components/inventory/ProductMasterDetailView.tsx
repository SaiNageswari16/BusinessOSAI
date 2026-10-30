import React, { useState, useMemo, useEffect } from "react";
import { 
  Search, 
  Filter, 
  Plus, 
  Package, 
  Edit2, 
  Trash2, 
  MoreVertical, 
  ArrowLeft, 
  Sliders, 
  Warehouse, 
  Receipt, 
  FileText, 
  ShoppingCart, 
  DollarSign, 
  Layers, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Boxes, 
  ChevronRight, 
  Eye, 
  Copy, 
  Printer,
  Coins,
  Store,
  Info,
  Calendar,
  Truck,
  LayoutGrid,
  Rows3,
  Upload,
  Download,
  Gift,
  Loader2
} from "lucide-react";
import { InventoryProduct, InventoryCategory, type Warehouse as WarehouseType, resolveImageUrl, invoicesApi, posApi } from "../../lib/api-client";
import { useCurrency } from "@/hooks/use-currency";
import { formatDisplayDate } from "@/lib/utils";
import { toast } from "sonner";

interface ProductMasterDetailViewProps {
  products: InventoryProduct[];
  categories: InventoryCategory[];
  warehouses: WarehouseType[];
  isLoading: boolean;
  initialProductId?: string;
  onEditProduct: (product: InventoryProduct) => void;
  onDeleteProduct: (product: InventoryProduct) => void;
  onDuplicateProduct: (product: InventoryProduct) => void;
  onCreateProduct: () => void;
  onAdjustStock: (product: InventoryProduct) => void;
  onPrintBarcode?: (productId: string) => void;
  onExport?: () => void;
  onImport?: () => void;
  onOpenFreeQty?: () => void;
  viewLayout?: "detail" | "table";
  onToggleLayout?: (layout: "detail" | "table") => void;
  onBackToProducts?: () => void;
}

export function ProductMasterDetailView({
  products,
  categories,
  warehouses,
  isLoading,
  initialProductId,
  onEditProduct,
  onDeleteProduct,
  onDuplicateProduct,
  onCreateProduct,
  onAdjustStock,
  onPrintBarcode,
  onExport,
  onImport,
  onOpenFreeQty,
  viewLayout = "detail",
  onToggleLayout,
  onBackToProducts,
}: ProductMasterDetailViewProps) {
  const { formatCurrency, currency } = useCurrency();

  const handleBackToProducts = () => {
    if (onBackToProducts) {
      onBackToProducts();
    } else if (onToggleLayout) {
      onToggleLayout("table");
    }
  };

  // Search & filter in left sidebar
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [stockStatusFilter, setStockStatusFilter] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock" | "negative">("all");

  // Selected product
  const [selectedProductId, setSelectedProductId] = useState<string | null>(() => {
    return initialProductId || products[0]?.id || null;
  });

  useEffect(() => {
    if (initialProductId) {
      setSelectedProductId(initialProductId);
    }
  }, [initialProductId]);

  // Active sub-tab in right detail pane: 'item_details' | 'stock_details' | 'party_report' | 'godown'
  const [activeTab, setActiveTab] = useState<"item_details" | "stock_details" | "party_report" | "godown">("item_details");
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  // Live sales invoice records for active product
  const [productInvoices, setProductInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState<boolean>(false);

  // Filtered product list for left sidebar
  const filteredProducts = useMemo(() => {
    let list = [...products];

    // Text search
    if (sidebarSearch.trim()) {
      const q = sidebarSearch.toLowerCase().trim();
      list = list.filter((p) => {
        const name = (p.name || "").toLowerCase();
        const sku = (p.sku || "").toLowerCase();
        const barcode = (p.barcode || "").toLowerCase();
        const brand = (p.brand || p.brand_name || "").toLowerCase();
        return name.includes(q) || sku.includes(q) || barcode.includes(q) || brand.includes(q);
      });
    }

    // Category filter
    if (selectedCategoryId !== "all") {
      list = list.filter((p) => p.category_id === selectedCategoryId || p.category_name === selectedCategoryId);
    }

    // Stock status filter
    if (stockStatusFilter === "in_stock") {
      list = list.filter((p) => Number(p.current_stock ?? p.stock ?? 0) > 0);
    } else if (stockStatusFilter === "low_stock") {
      list = list.filter((p) => {
        const stk = Number(p.current_stock ?? p.stock ?? 0);
        const reorder = Number(p.reorder_level || 0);
        return stk > 0 && stk <= reorder;
      });
    } else if (stockStatusFilter === "out_of_stock") {
      list = list.filter((p) => Number(p.current_stock ?? p.stock ?? 0) === 0);
    } else if (stockStatusFilter === "negative") {
      list = list.filter((p) => Number(p.current_stock ?? p.stock ?? 0) < 0);
    }

    return list;
  }, [products, sidebarSearch, selectedCategoryId, stockStatusFilter]);

  // Ensure an item is selected
  const activeProduct = useMemo(() => {
    if (selectedProductId) {
      const found = products.find((p) => p.id === selectedProductId);
      if (found) return found;
    }
    return filteredProducts[0] || products[0] || null;
  }, [products, selectedProductId, filteredProducts]);

  // Derived metrics for active product
  const specs = (activeProduct?.specifications && typeof activeProduct.specifications === "object") ? activeProduct.specifications : {};
  const currentStock = Number(activeProduct?.current_stock ?? activeProduct?.stock ?? 0);
  const purchasePrice = Number(activeProduct?.purchase_price || (activeProduct as any)?.cost_price || 0);
  const sellingPrice = Number(activeProduct?.selling_price || 0);
  const mrpValue = activeProduct?.mrp ? Number(activeProduct.mrp) : 0;
  const stockValue = currentStock > 0 ? currentStock * purchasePrice : 0;
  const reorderLevel = activeProduct?.reorder_level != null ? Number(activeProduct.reorder_level) : null;
  const uomName = activeProduct?.uom_name || specs.sales_measuring_unit || "Unit";
  const brandName = activeProduct?.brand || activeProduct?.brand_name || specs.brand || "-";
  const categoryName = activeProduct?.category_name || (activeProduct as any)?.category || "-";
  const barcodeValue = activeProduct?.barcode || specs.barcode || "-";
  const itemCodeValue = (activeProduct as any)?.item_code || specs.item_code || "-";
  const hsnCodeValue = activeProduct?.hsn_code || specs.hsn_code || "-";
  const taxPercent = activeProduct?.tax_percent != null ? Number(activeProduct.tax_percent) : (specs.tax_percent != null ? Number(specs.tax_percent) : null);
  const isNegativeStock = currentStock < 0;
  const isOutOfStock = currentStock === 0;
  const isLowStock = reorderLevel != null && currentStock > 0 && currentStock <= reorderLevel;

  // Fetch real billed invoice history for the active product when Party Wise Report tab is selected
  useEffect(() => {
    if (activeTab === "party_report" && activeProduct) {
      setLoadingInvoices(true);

      const cleanStr = (s: any) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const actId = String(activeProduct.id || "").toLowerCase().trim();
      const actName = String(activeProduct.name || "").trim();
      const actCleanName = cleanStr(actName);
      const actSku = String(activeProduct.sku || "").trim();
      const actCleanSku = cleanStr(actSku);
      const actBarcode = String(activeProduct.barcode || "").trim();
      const actCleanBarcode = cleanStr(actBarcode);

      Promise.all([
        invoicesApi.listInvoices({ page_size: 1000 }).catch(() => ({ items: [] })),
        posApi.getHistory({ limit: 500 }).catch(() => []),
      ])
        .then(([invRes, posHistRes]: [any, any]) => {
          const invList: any[] = invRes?.items || (Array.isArray(invRes) ? invRes : []);
          const posList: any[] = Array.isArray(posHistRes) ? posHistRes : (posHistRes?.items || []);

          // Also scan localStorage POS saved invoices across keys
          const localInvoices: any[] = [];
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (
                k &&
                (k.startsWith("pos_saved_invoices") ||
                  k.startsWith("pos_recent_invoices") ||
                  k.startsWith("pos_invoices_history") ||
                  k.startsWith("pos_transactions"))
              ) {
                try {
                  const raw = localStorage.getItem(k);
                  if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) {
                      localInvoices.push(...parsed);
                    }
                  }
                } catch {}
              }
            }
          } catch {}

          // Merge all sources deduplicated by invoice number / id
          const allDocs = new Map<string, any>();

          localInvoices.forEach((inv) => {
            const num = String(inv.invoice_number || inv.receipt_number || inv.id || "").toUpperCase().trim();
            if (num && !allDocs.has(num)) allDocs.set(num, inv);
          });

          posList.forEach((tx) => {
            const num = String(tx.receipt_number || tx.invoice_number || tx.id || "").toUpperCase().trim();
            if (num && !allDocs.has(num)) allDocs.set(num, tx);
          });

          invList.forEach((inv) => {
            const num = String(inv.invoice_number || inv.id || "").toUpperCase().trim();
            if (num && !allDocs.has(num)) allDocs.set(num, inv);
          });

          const matching: any[] = [];
          const seenKeys = new Set<string>();

          allDocs.forEach((inv) => {
            const rawLines = inv.lines || inv.items || [];
            rawLines.forEach((it: any) => {
              const lineProdId = String(it.product_id || it.id || "").toLowerCase().trim();
              const lineName = String(it.product_name || it.name || it.item_name || it.title || "").trim();
              const lineCleanName = cleanStr(lineName);
              const lineSku = String(it.product_sku || it.sku || it.sku_code || it.product?.sku || "").trim();
              const lineCleanSku = cleanStr(lineSku);
              const lineBarcode = String(it.barcode || it.product?.barcode || "").trim();
              const lineCleanBarcode = cleanStr(lineBarcode);

              const matchesId = Boolean(lineProdId && actId && lineProdId === actId);
              const matchesSku = Boolean(
                (lineCleanSku && actCleanSku && lineCleanSku === actCleanSku) ||
                (actCleanSku && actCleanSku.length >= 4 && lineCleanName.includes(actCleanSku)) ||
                (lineCleanSku && lineCleanSku.length >= 4 && actCleanName.includes(lineCleanSku))
              );
              const matchesBarcode = Boolean(lineCleanBarcode && actCleanBarcode && lineCleanBarcode === actCleanBarcode);
              const matchesName = Boolean(
                lineCleanName && actCleanName && (
                  lineCleanName === actCleanName ||
                  (actCleanName.length >= 3 && lineCleanName.includes(actCleanName)) ||
                  (lineCleanName.length >= 3 && actCleanName.includes(lineCleanName))
                )
              );

              if (matchesId || matchesSku || matchesBarcode || matchesName) {
                const invNum = inv.invoice_number || inv.receipt_number || `INV-${String(inv.id || "").slice(0, 8)}`;
                const dedupKey = `${invNum}_${lineCleanName}_${it.quantity || it.qty || 1}`;
                if (seenKeys.has(dedupKey)) return;
                seenKeys.add(dedupKey);

                matching.push({
                  invoice_id: inv.id || invNum,
                  invoice_number: invNum,
                  invoice_date: inv.invoice_date || inv.date || inv.created_at,
                  customer_name:
                    inv.customer_name ||
                    (inv.customer?.first_name
                      ? `${inv.customer?.first_name || ""} ${inv.customer?.last_name || ""}`.trim()
                      : inv.customer?.name || "Walk-in Customer"),
                  customer_phone: inv.customer_phone || inv.customer?.phone || "—",
                  quantity: Number(it.quantity || it.qty || 1),
                  unit_price: Number(it.unit_price || it.price || 0),
                  total:
                    Number(
                      it.line_total ||
                        it.total ||
                        it.subtotal ||
                        Number(it.quantity || it.qty || 1) * Number(it.unit_price || it.price || 0)
                    ) || 0,
                  status: inv.status || inv.payment_status || "Completed",
                });
              }
            });
          });

          // Sort by invoice date descending (most recent first)
          matching.sort((a, b) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime());
          setProductInvoices(matching);
        })
        .catch((err) => {
          console.error("Failed to load party report invoices:", err);
          setProductInvoices([]);
        })
        .finally(() => setLoadingInvoices(false));
    }
  }, [activeTab, activeProduct]);

  return (
    <div className="flex w-full h-[calc(100vh-140px)] min-h-[580px] bg-slate-50/50 rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs">
      
      {/* ══════════════════════════════════════════════════════════════
           LEFT PANE: Master Item List / Selector Sidebar
           ══════════════════════════════════════════════════════════════ */}
      <div className="w-80 lg:w-88 border-r border-slate-200 bg-white flex flex-col shrink-0 h-full">
        
        {/* Top Search & Filter Bar */}
        <div className="p-3 border-b border-slate-100 space-y-2.5 shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                placeholder="Search item by name, SKU, or barcode..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/80 focus:bg-white outline-none focus:ring-2 focus:ring-purple-500 font-medium transition-all"
              />
              {sidebarSearch && (
                <button
                  type="button"
                  onClick={() => setSidebarSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ×
                </button>
              )}
            </div>

            {/* Filter Toggle Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                className={`p-2 rounded-xl border transition-colors shadow-2xs ${
                  isFilterDropdownOpen || selectedCategoryId !== "all" || stockStatusFilter !== "all"
                    ? "bg-purple-50 border-purple-300 text-purple-700"
                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                }`}
                title="Filter by category or stock status"
              >
                <Filter className="w-4 h-4" />
              </button>

              {isFilterDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsFilterDropdownOpen(false)} />
                  <div className="absolute right-0 mt-1.5 w-60 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 p-3 space-y-3 animate-in fade-in zoom-in-95 duration-100">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Category
                      </span>
                      <select
                        value={selectedCategoryId}
                        onChange={(e) => setSelectedCategoryId(e.target.value)}
                        className="w-full h-8 px-2 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 outline-none"
                      >
                        <option value="all">All Categories</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Stock Status
                      </span>
                      <select
                        value={stockStatusFilter}
                        onChange={(e) => setStockStatusFilter(e.target.value as any)}
                        className="w-full h-8 px-2 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 outline-none"
                      >
                        <option value="all">All Stock Levels</option>
                        <option value="in_stock">In Stock (&gt; 0)</option>
                        <option value="low_stock">Low Stock (≤ Reorder)</option>
                        <option value="out_of_stock">Out of Stock (= 0)</option>
                        <option value="negative">Negative Stock (&lt; 0)</option>
                      </select>
                    </div>

                    {(selectedCategoryId !== "all" || stockStatusFilter !== "all") && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategoryId("all");
                          setStockStatusFilter("all");
                        }}
                        className="w-full py-1.5 text-center text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 rounded-lg transition"
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Quick Create Item button in sidebar */}
          <button
            type="button"
            onClick={onCreateProduct}
            className="w-full h-9 rounded-xl border border-dashed border-purple-300 bg-purple-50/50 hover:bg-purple-50 text-purple-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Item</span>
          </button>
        </div>

        {/* Scrollable Product List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-1.5">
          {isLoading ? (
            <div className="p-8 text-center text-slate-400 text-xs font-semibold flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
              <span>Loading inventory products...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-600">No items found</p>
              <p className="text-[11px] text-slate-400 mt-1">Try adjusting your search or category filter.</p>
            </div>
          ) : (
            filteredProducts.map((p) => {
              const isSelected = activeProduct?.id === p.id;
              const pStock = Number(p.current_stock ?? p.stock ?? 0);
              const pUom = p.uom_name || (p.specifications as any)?.sales_measuring_unit || "Unit";
              const isNeg = pStock < 0;
              const isZero = pStock === 0;

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProductId(p.id)}
                  className={`p-2.5 flex items-center gap-3 cursor-pointer transition-all rounded-xl my-0.5 border ${
                    isSelected
                      ? "bg-purple-50/80 border-purple-300 text-slate-900 shadow-2xs ring-1 ring-purple-200"
                      : "bg-white border-transparent hover:bg-slate-50/90 text-slate-700"
                  }`}
                >
                  {/* Item Thumbnail */}
                  <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                    {p.image_url ? (
                      <img
                        src={resolveImageUrl(p.image_url)}
                        alt={p.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <Package className="w-5 h-5 text-slate-400" />
                    )}
                  </div>

                  {/* Middle: Name & Subtitle */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs text-slate-900 truncate leading-tight">
                      {p.name}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      {p.sku || p.barcode || (p.category_name ? p.category_name : "-")}
                    </p>
                  </div>

                  {/* Right: Quantity & Unit */}
                  <div className="text-right shrink-0">
                    <p
                      className={`text-xs font-black leading-tight ${
                        isNeg
                          ? "text-rose-600"
                          : isZero
                          ? "text-slate-500 font-bold"
                          : "text-emerald-600"
                      }`}
                    >
                      {pStock}
                    </p>
                    <span className="text-[10px] text-slate-400 font-medium block">
                      {pUom}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Summary Footer */}
        <div className="p-2.5 border-t border-slate-100 bg-slate-50/80 text-[11px] text-slate-500 flex justify-between items-center shrink-0 font-medium">
          <span>Total: <strong>{products.length}</strong> items</span>
          <span>Showing: <strong>{filteredProducts.length}</strong></span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
           RIGHT PANE: Live Detail View for Selected Item
           ══════════════════════════════════════════════════════════════ */}
      {activeProduct ? (
        <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-50/30 p-5 space-y-3">
          
          {/* Breadcrumb Navigation: ← Products / {productName} */}
          <div className="flex items-center gap-2 text-sm text-slate-600 px-1 py-0.5">
            <button
              type="button"
              onClick={handleBackToProducts}
              className="p-1 -ml-1 rounded-lg hover:bg-slate-200/80 text-slate-600 hover:text-slate-900 transition-colors flex items-center justify-center cursor-pointer"
              title="Back to Products"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleBackToProducts}
              className="font-bold text-slate-800 hover:text-purple-700 transition-colors cursor-pointer"
            >
              Products
            </button>
            <span className="text-slate-400 font-normal">/</span>
            <span className="text-slate-500 font-medium truncate max-w-md">
              {activeProduct.name}
            </span>
          </div>

          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80 bg-white p-4 rounded-2xl border shadow-2xs shrink-0">
            {/* Left: Back Arrow, Thumbnail & Title */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={handleBackToProducts}
                className="p-1.5 -ml-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
                title="Back to Products"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                {activeProduct.image_url ? (
                  <img
                    src={resolveImageUrl(activeProduct.image_url)}
                    alt={activeProduct.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="w-6 h-6 text-slate-400" />
                )}
              </div>

              <div className="min-w-0">
                <h1 className="text-base lg:text-lg font-black text-slate-900 leading-tight truncate">
                  {activeProduct.name}
                </h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {isNegativeStock ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                      Negative Stock
                    </span>
                  ) : isOutOfStock ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                      Out of Stock
                    </span>
                  ) : isLowStock ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                      Low Stock
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                      In Stock
                    </span>
                  )}

                  {activeProduct.sku && (
                    <span className="text-[11px] font-mono text-slate-500">
                      SKU: <strong>{activeProduct.sku}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Adjust Stock Button */}
              <button
                type="button"
                onClick={() => onAdjustStock?.(activeProduct)}
                className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Adjust current stock quantity"
              >
                <Sliders className="w-3.5 h-3.5 text-slate-500" />
                Adjust Stock
              </button>

              {/* Edit Button */}
              <button
                type="button"
                onClick={() => onEditProduct?.(activeProduct)}
                className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Edit item information"
              >
                <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
                Edit
              </button>

              {/* Delete Button */}
              <button
                type="button"
                onClick={() => onDeleteProduct?.(activeProduct)}
                className="p-2 text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-xl shadow-2xs transition-colors cursor-pointer"
                title="Delete this item"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* More Actions Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-xl shadow-2xs transition-colors cursor-pointer"
                  title="More actions"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>

                {isMoreMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsMoreMenuOpen(false)} />
                    <div className="absolute right-0 mt-1.5 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 p-1.5 text-xs font-semibold animate-in fade-in zoom-in-95 duration-100">
                      <div className="py-1 space-y-0.5">
                        {onPrintBarcode && activeProduct.barcode && (
                          <button
                            type="button"
                            onClick={() => {
                              onPrintBarcode(activeProduct.id);
                              setIsMoreMenuOpen(false);
                            }}
                            className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 text-emerald-700 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" /> Print Barcode Label
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            onDuplicateProduct?.(activeProduct);
                            setIsMoreMenuOpen(false);
                          }}
                          className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5 text-slate-400" /> Duplicate Product
                        </button>

                        {onOpenFreeQty && (
                          <button
                            type="button"
                            onClick={() => {
                              onOpenFreeQty();
                              setIsMoreMenuOpen(false);
                            }}
                            className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 text-emerald-700 cursor-pointer"
                          >
                            <Gift className="w-3.5 h-3.5" /> Free Qty Scheme
                          </button>
                        )}

                        {onExport && (
                          <button
                            type="button"
                            onClick={() => {
                              onExport();
                              setIsMoreMenuOpen(false);
                            }}
                            className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-slate-400" /> Export Inventory
                          </button>
                        )}

                        {onImport && (
                          <button
                            type="button"
                            onClick={() => {
                              onImport();
                              setIsMoreMenuOpen(false);
                            }}
                            className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5 text-slate-400" /> Import File
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Sub-Tabs Row */}
          <div className="flex items-center gap-6 border-b border-slate-200 px-2 shrink-0">
            {[
              { id: "item_details", label: "Item Details", icon: FileText },
              { id: "stock_details", label: "Stock Details", icon: Boxes },
              { id: "party_report", label: "Party Wise Report", icon: Receipt },
              { id: "godown", label: "Godown", icon: Warehouse },
            ].map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`pb-2.5 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                    isActive
                      ? "border-purple-600 text-purple-700"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* ══════════════════════════════════════════════════════════
               SUB-TAB 1: ITEM DETAILS (Matching Screenshot)
               ══════════════════════════════════════════════════════════ */}
          {activeTab === "item_details" && (
            <div className="space-y-4">
              
              {/* 4 Metric / KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                
                {/* 1. Current Stock */}
                <div className={`p-4 rounded-2xl border flex items-center gap-3 shadow-2xs ${
                  isNegativeStock
                    ? "bg-rose-50/60 border-rose-100"
                    : isOutOfStock
                    ? "bg-slate-50/80 border-slate-200"
                    : "bg-emerald-50/60 border-emerald-100"
                }`}>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    isNegativeStock
                      ? "bg-rose-100 text-rose-600"
                      : isOutOfStock
                      ? "bg-slate-200 text-slate-600"
                      : "bg-emerald-100 text-emerald-600"
                  }`}>
                    <Boxes className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-500 block mb-0.5">
                      Current Stock
                    </span>
                    <span className={`text-lg font-black ${
                      isNegativeStock
                        ? "text-rose-700"
                        : isOutOfStock
                        ? "text-slate-700"
                        : "text-emerald-700"
                    }`}>
                      {currentStock} {uomName}
                    </span>
                  </div>
                </div>

                {/* 2. Stock Value */}
                <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100 flex items-center gap-3 shadow-2xs">
                  <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-500 block mb-0.5">
                      Stock Value
                    </span>
                    <span className="text-lg font-black text-purple-900">
                      {formatCurrency(stockValue)}
                    </span>
                  </div>
                </div>

                {/* 3. Reorder Level */}
                <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-center gap-3 shadow-2xs">
                  <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-500 block mb-0.5">
                      Reorder Level
                    </span>
                    <span className="text-lg font-black text-blue-900">
                      {reorderLevel != null ? `${reorderLevel} ${uomName}` : "-"}
                    </span>
                  </div>
                </div>

                {/* 4. Godown Availability */}
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex items-center gap-3 shadow-2xs">
                  <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Warehouse className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-500 block mb-0.5">
                      Godown Availability
                    </span>
                    <span className="text-sm font-black text-emerald-900 truncate block max-w-[140px]">
                      {activeProduct.warehouse || "All Godowns"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2-Column Section Cards (General Details vs Pricing & Stock Details) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                
                {/* LEFT CARD: General Details (7 cols) */}
                <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                    <FileText className="w-4 h-4 text-slate-600" />
                    <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                      General Details
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3.5 gap-x-4 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px] mb-0.5">Item Name</span>
                      <p className="font-bold text-slate-900">{activeProduct.name}</p>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px] mb-0.5">Category</span>
                      <p className="font-bold text-slate-800">{categoryName}</p>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px] mb-0.5">Item Code</span>
                      <p className="font-mono font-bold text-slate-800">{itemCodeValue}</p>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px] mb-0.5">Barcode</span>
                      <p className="font-mono font-bold text-slate-800">{barcodeValue}</p>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px] mb-0.5">Brand</span>
                      <p className="font-bold text-slate-800">{brandName}</p>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px] mb-0.5">Stock Value ⓘ</span>
                      <p className="font-bold text-slate-800">{formatCurrency(stockValue)}</p>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px] mb-0.5">Current Stock</span>
                      <p className={`font-black ${isNegativeStock ? "text-rose-600" : "text-emerald-700"}`}>
                        {currentStock} {uomName}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px] mb-0.5">Low Stock Warning</span>
                      <p className={`font-bold ${reorderLevel != null && reorderLevel > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {reorderLevel != null && reorderLevel > 0 ? "Enabled" : "Disabled"}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px] mb-0.5">Low Stock Quantity</span>
                      <p className="font-bold text-slate-800">{activeProduct.safety_stock || "-"}</p>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px] mb-0.5">Show in Online Store</span>
                      <p className="font-bold text-slate-800">
                        {specs.is_published_online !== false && (activeProduct as any).is_published_online !== false ? "Enabled" : "-"}
                      </p>
                    </div>

                    <div className="sm:col-span-2">
                      <span className="text-slate-400 block text-[11px] mb-0.5">Item Description</span>
                      <p className="font-medium text-slate-700 text-xs">
                        {activeProduct.short_description || activeProduct.description || "-"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* RIGHT CARDS: Pricing & Stock Details (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                  
                  {/* Pricing Details Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                      <Receipt className="w-4 h-4 text-slate-600" />
                      <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                        Pricing Details
                      </h2>
                    </div>

                    <div className="grid grid-cols-2 gap-y-3.5 gap-x-4 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px] mb-0.5">Sales Price</span>
                        <p className="font-black text-slate-900">
                          {formatCurrency(sellingPrice)} <span className="text-[10px] text-slate-400 font-normal">With Tax</span>
                        </p>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[11px] mb-0.5">Purchase Price</span>
                        <p className="font-black text-slate-900">
                          {formatCurrency(purchasePrice)} <span className="text-[10px] text-slate-400 font-normal">With Tax</span>
                        </p>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[11px] mb-0.5">MRP</span>
                        <p className="font-bold text-slate-800">
                          {mrpValue > 0 ? formatCurrency(mrpValue) : "-"}
                        </p>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[11px] mb-0.5">GST Tax Rate</span>
                        <p className="font-bold text-slate-800">
                          {taxPercent != null ? `${taxPercent}%` : "None"}
                        </p>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[11px] mb-0.5">HSN Code</span>
                        <p className="font-mono font-bold text-slate-800">{hsnCodeValue}</p>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[11px] mb-0.5">Secondary Unit</span>
                        <p className="font-bold text-slate-800">{specs.secondary_uom || "-"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Stock Details Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                      <Warehouse className="w-4 h-4 text-slate-600" />
                      <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                        Stock Details
                      </h2>
                    </div>

                    <div className="grid grid-cols-2 gap-y-3.5 gap-x-4 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px] mb-0.5">Measuring Unit</span>
                        <p className="font-bold text-slate-900">{uomName}</p>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[11px] mb-0.5">Stock Tracking</span>
                        <p className="font-bold text-emerald-600">
                          {specs.is_service_item ? "Disabled (Service)" : "Enabled"}
                        </p>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[11px] mb-0.5">Batching</span>
                        <p className={`font-bold ${specs.has_manual_batch ? "text-emerald-600" : "text-rose-600"}`}>
                          {specs.has_manual_batch ? "Enabled" : "Disabled"}
                        </p>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[11px] mb-0.5">Manufacturing Date</span>
                        <p className="font-medium text-slate-700">
                          {specs.mfg_date ? formatDisplayDate(specs.mfg_date) : "-"}
                        </p>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[11px] mb-0.5">Expiry Date</span>
                        <p className="font-medium text-slate-700">
                          {specs.expiry_date ? formatDisplayDate(specs.expiry_date) : "-"}
                        </p>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
               SUB-TAB 2: STOCK DETAILS (Warehouses & Batches)
               ══════════════════════════════════════════════════════════ */}
          {activeTab === "stock_details" && (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-purple-600" />
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                    Stock & Warehouse Allocation
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => onAdjustStock(activeProduct)}
                  className="px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold hover:bg-purple-100 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" /> Adjust Stock
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border">
                  <span className="text-slate-500 font-semibold block mb-1">Current On-Hand Stock</span>
                  <span className="text-xl font-black text-slate-900">{currentStock} {uomName}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border">
                  <span className="text-slate-500 font-semibold block mb-1">Reorder Threshold</span>
                  <span className="text-xl font-black text-slate-900">{reorderLevel != null ? `${reorderLevel} ${uomName}` : "Not Set"}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border">
                  <span className="text-slate-500 font-semibold block mb-1">Safety Buffer Stock</span>
                  <span className="text-xl font-black text-slate-900">{activeProduct.safety_stock ? `${activeProduct.safety_stock} ${uomName}` : "Not Set"}</span>
                </div>
              </div>

              <div className="pt-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Registered Batch Data</h4>
                {specs.has_manual_batch && specs.stock_batch_number ? (
                  <div className="p-3 rounded-xl bg-slate-50 border text-xs grid grid-cols-3 gap-2">
                    <div><span className="text-slate-400 block text-[11px]">Batch #</span><strong className="font-mono text-slate-800">{specs.stock_batch_number}</strong></div>
                    <div><span className="text-slate-400 block text-[11px]">Expiry Date</span><strong>{specs.stock_batch_expiry_date || "-"}</strong></div>
                    <div><span className="text-slate-400 block text-[11px]">Opening Batch #</span><strong className="font-mono text-slate-800">{specs.opening_stock_batch_number || "-"}</strong></div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No custom batch registered for this product.</p>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
               SUB-TAB 3: PARTY WISE REPORT (Customer Sales History)
               ══════════════════════════════════════════════════════════ */}
          {activeTab === "party_report" && (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-purple-600" />
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                    Party-Wise Sales Invoices
                  </h3>
                </div>
                <span className="text-xs font-bold text-slate-500">
                  {productInvoices.length} Billed Record{productInvoices.length === 1 ? '' : 's'}
                </span>
              </div>

              {loadingInvoices && (
                <div className="p-12 text-center text-slate-400 text-xs font-semibold flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600" /> Fetching live sales invoice history...
                </div>
              )}

              {!loadingInvoices && productInvoices.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs font-medium space-y-2">
                  <Receipt className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="font-semibold text-slate-700">No Billed Invoices Found</p>
                  <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                    No sales invoices have been billed for "{activeProduct.name}" yet.
                  </p>
                </div>
              )}

              {!loadingInvoices && productInvoices.length > 0 && (
                <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3">Invoice Number</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Customer / Party</th>
                        <th className="px-4 py-3 text-right">Billed Qty</th>
                        <th className="px-4 py-3 text-right">Unit Price</th>
                        <th className="px-4 py-3 text-right">Total Amount</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {productInvoices.map((inv, i) => (
                        <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-purple-700">
                            {inv.invoice_number || `INV-${inv.invoice_id?.slice(0, 8)}`}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {inv.invoice_date ? formatDisplayDate(inv.invoice_date) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-800">{inv.customer_name}</div>
                            <div className="text-[10px] text-slate-400">{inv.customer_phone}</div>
                          </td>
                          <td className="px-4 py-3 text-right font-black text-slate-900">
                            {inv.quantity} {uomName}
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
          )}

          {/* ══════════════════════════════════════════════════════════
               SUB-TAB 4: GODOWN (Warehouse Inventory Breakdown)
               ══════════════════════════════════════════════════════════ */}
          {activeTab === "godown" && (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Warehouse className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                    Godown & Branch Availability
                  </h3>
                </div>
                <span className="text-xs font-bold text-slate-500">{warehouses.length} Active Godowns</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b">
                    <tr>
                      <th className="px-4 py-3">Godown / Branch Name</th>
                      <th className="px-4 py-3">Location / Shelf</th>
                      <th className="px-4 py-3 text-right">Available Stock</th>
                      <th className="px-4 py-3 text-right">Stock Valuation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {warehouses.length === 0 ? (
                      <tr>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {activeProduct.warehouse || "Main Godown (Default)"}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{specs.location_in_warehouse || "General Rack"}</td>
                        <td className="px-4 py-3 text-right font-black text-slate-900">{currentStock} {uomName}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">{formatCurrency(stockValue)}</td>
                      </tr>
                    ) : (
                      warehouses.map((w, idx) => {
                        const isAssigned = (activeProduct.warehouse && activeProduct.warehouse.toLowerCase() === w.name.toLowerCase()) || (!activeProduct.warehouse && idx === 0);
                        const godownStock = isAssigned ? currentStock : 0;
                        const godownValuation = isAssigned ? stockValue : 0;
                        return (
                          <tr key={w.id || idx} className="hover:bg-slate-50/80">
                            <td className="px-4 py-3 font-semibold text-slate-800">
                              <div className="flex items-center gap-1.5">
                                <span>{w.name}</span>
                                {isAssigned && (
                                  <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                                    Assigned
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-500">{isAssigned ? (specs.location_in_warehouse || "Default Location") : "—"}</td>
                            <td className="px-4 py-3 text-right font-black text-slate-900">
                              {godownStock} {uomName}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                              {formatCurrency(godownValuation)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-12 text-slate-400 text-sm">
          No product selected.
        </div>
      )}

    </div>
  );
}
