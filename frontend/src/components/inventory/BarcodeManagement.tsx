import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import {
  ScanBarcode, Loader2, Search, Download, Plus, Hash,
  Printer, Package, CheckCircle2, Filter, X, LayoutGrid, Rows3,
  Scan, Tag, ListChecks, Sparkles, SlidersHorizontal, Settings2, Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { inventoryApi, type ProductBarcode, type InventoryCategory } from "../../lib/api-client";
import { getActiveBarcodeTemplate } from "../../lib/receipt-template-store";
import { getHardwareScannableBarcode } from "../../lib/code128";

// ISO/IEC 15417 Code-128 & GS1 EAN-13 Hardware-Scannable Vector SVG Renderer
function RealBarcodeSvg({
  code,
  format = "Code-128",
  width = 220,
  height = 52,
  unitPx = 2.0
}: {
  code: string;
  format?: string;
  width?: number;
  height?: number;
  unitPx?: number;
}) {
  const bars = useMemo(() => getHardwareScannableBarcode(code || "8901234567890"), [code]);

  const quietZonePx = 16;
  let contentModules = 0;
  bars.forEach(b => { contentModules += b.width; });
  const totalSvgWidth = Math.max(width, Math.ceil(contentModules * unitPx + (quietZonePx * 2)));
  const barHeight = Math.max(28, height - 16);

  return (
    <div className="flex flex-col items-center justify-center bg-white p-0.5 rounded overflow-hidden">
      <svg
        width={totalSvgWidth}
        height={height}
        shapeRendering="crispEdges"
        className="block mx-auto"
      >
        <rect width={totalSvgWidth} height={height} fill="white" />
        {(() => {
          let x = quietZonePx;
          return bars.map((b, i) => {
            const w = b.width * unitPx;
            const el = b.isBlack ? (
              <rect
                key={i}
                x={Math.round(x)}
                y={2}
                width={Math.max(1.8, Math.round(w))}
                height={barHeight}
                fill="black"
              />
            ) : null;
            x += w;
            return el;
          });
        })()}
        <text
          x={totalSvgWidth / 2}
          y={height - 2}
          textAnchor="middle"
          fontSize="9.5"
          fontFamily="monospace"
          fontWeight="bold"
          fill="black"
        >
          {code}
        </text>
      </svg>
    </div>
  );
}

// Single Label Renderer Following Active Master Barcode Template
function SingleBarcodeLabelCard({
  item,
  template,
  isPrint = false
}: {
  item: ProductBarcode;
  template: any;
  isPrint?: boolean;
}) {
  const f = template.fields || {};
  const storeName = template.storeName || "LAZYMONKEY AI SUPERSTORE";

  return (
    <div className={`bg-white text-black border border-slate-300 rounded ${isPrint ? 'p-1 h-[24mm]' : 'p-2.5 min-h-[210px]'} flex flex-col justify-between font-sans shadow-sm select-none overflow-hidden box-border`}>
      {/* Company Header */}
      {f.showCompanyName && (
        <div className="flex items-center justify-between border-b border-slate-200 pb-0.5 mb-0.5">
          <span className={`font-bold ${isPrint ? 'text-[8px]' : 'text-[9px]'} tracking-wider uppercase truncate`} style={{ color: template.primaryColor || "#000" }}>
            {storeName}
          </span>
          {f.showCategoryBrand && item.category_name && (
            <span className={`font-semibold text-slate-500 uppercase ${isPrint ? 'text-[7px]' : 'text-[7.5px]'}`}>{item.category_name}</span>
          )}
        </div>
      )}

      {/* Product Name & SKU */}
      <div>
        {f.showProductName && (
          <h4 className={`font-bold leading-tight text-slate-900 line-clamp-1 ${isPrint ? 'text-[9px]' : 'text-[11px]'}`}>
            {item.product_name}
          </h4>
        )}
        {f.showSKU && item.sku && <p className={`font-mono text-slate-600 ${isPrint ? 'text-[7.5px]' : 'text-[8.5px]'}`}>SKU: {item.sku}</p>}

        {/* Price & MRP */}
        <div className="flex items-baseline gap-1.5 mt-0.5">
          {f.showPrice && item.selling_price != null && (
            <span className={`font-extrabold text-slate-900 ${isPrint ? 'text-[10px]' : 'text-xs'}`}>₹{Number(item.selling_price).toFixed(2)}</span>
          )}
          {f.showMRP && item.mrp != null && (
            <span className={`text-slate-500 line-through ${isPrint ? 'text-[7.5px]' : 'text-[8.5px]'}`}>MRP: ₹{Number(item.mrp).toFixed(2)}</span>
          )}
        </div>
      </div>

      {/* Barcode Graphic */}
      {f.showBarcodeGraphic && item.barcode && (
        <div className="mt-0.5">
          <RealBarcodeSvg
            code={item.barcode}
            format={item.format}
            width={isPrint ? 160 : 220}
            height={isPrint ? 36 : 54}
            unitPx={isPrint ? 1.5 : 2.0}
          />
        </div>
      )}
    </div>
  );
}

type LayoutType = "1up" | "2up" | "3up" | "a4";
type Mode = "with" | "without" | "all";

export function BarcodeManagement() {
  const [allProducts, setAllProducts] = useState<ProductBarcode[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [mode, setMode] = useState<Mode>("with");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copiesPerItem, setCopiesPerItem] = useState<number>(1);
  const [layoutType, setLayoutType] = useState<LayoutType>("2up");
  const [activeTemplate, setActiveTemplate] = useState<any>(getActiveBarcodeTemplate());

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const [data, catsRaw] = await Promise.all([
        inventoryApi.getBarcodes(),
        inventoryApi.getCategories({ page: 1, page_size: 100 }).catch(() => ({ results: [] } as { results: { name: string }[] })),
      ]);
      setAllProducts(data);
      setCategories((catsRaw as any).results || []);
      setActiveTemplate(getActiveBarcodeTemplate());
    } catch {
      setAllProducts([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const filtered = useMemo(() => {
    let list = mode === "with" ? allProducts.filter(i => i.barcode) : allProducts;
    if (mode === "without") list = list.filter(i => !i.barcode);
    if (categoryFilter) list = list.filter(i => i.category_name === categoryFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(i =>
        i.product_name.toLowerCase().includes(q)
        || i.sku.toLowerCase().includes(q)
        || (i.barcode || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [allProducts, mode, search, categoryFilter]);

  const printable = useMemo(() => filtered.filter(i => i.barcode), [filtered]);
  const withBarcode = useMemo(() => allProducts.filter(i => i.barcode), [allProducts]);
  const withoutBarcode = useMemo(() => allProducts.filter(i => !i.barcode), [allProducts]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const allSelected = printable.length > 0 && selected.size === printable.length;

  const targetPrintItems = useMemo(() => {
    const list = selected.size > 0 ? printable.filter(i => selected.has(i.id)) : printable;
    const expanded: ProductBarcode[] = [];
    list.forEach(item => {
      for (let i = 0; i < copiesPerItem; i++) {
        expanded.push(item);
      }
    });
    return expanded;
  }, [selected, printable, copiesPerItem]);

  const handleExecutePrint = () => {
    if (targetPrintItems.length === 0) return;

    let styleEl = document.getElementById("barcode-print-style-tag");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "barcode-print-style-tag";
      document.head.appendChild(styleEl);
    }

    let pageCss = "@page { size: 50mm 25mm portrait !important; margin: 0mm !important; }";
    if (layoutType === "2up") {
      pageCss = "@page { size: 100mm 25mm portrait !important; margin: 0mm !important; }";
    } else if (layoutType === "3up") {
      pageCss = "@page { size: 114mm 25mm portrait !important; margin: 0mm !important; }";
    } else if (layoutType === "a4") {
      pageCss = "@page { size: A4 portrait !important; margin: 5mm !important; }";
    }

    styleEl.innerHTML = `
      @media print {
        ${pageCss}
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          width: 100% !important;
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
      }
    `;

    document.body.classList.add("printing-barcodes");
    setIsPrintModalOpen(false);

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove("printing-barcodes");
      }, 1000);
    }, 150);
  };

  const handleGenerate = async (productId: string) => {
    try {
      setWorking(true);
      const result = await inventoryApi.generateBarcode(productId);
      flash(`Generated barcode: ${result.barcode}`);
      await load();
    } catch (e: any) {
      alert(`Generate failed: ${e?.detail ?? e?.message}`);
    } finally {
      setWorking(false);
    }
  };

  const handleBulkGenerate = async () => {
    const targets = filtered.filter(i => !i.barcode);
    if (targets.length === 0) return;
    if (!confirm(`Generate barcodes for ${targets.length} products?`)) return;
    try {
      setWorking(true);
      for (const p of targets) {
        try {
          await inventoryApi.generateBarcode(p.id);
        } catch {}
      }
      flash(`Generated ${targets.length} barcodes`);
      await load();
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Master Template Inherited Status */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-xl border border-slate-700">
        <div>
          <div className="flex items-center gap-2">
            <ScanBarcode className="size-6 text-emerald-400" />
            <h2 className="text-2xl font-black tracking-tight">Barcode Label Generator</h2>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Active Master Barcode Template: <strong className="text-emerald-300 font-bold">{activeTemplate.name || 'Retail Jewelry & Apparel Tag (50x25mm)'}</strong> ({activeTemplate.paperSize || '50x25mm'})
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => window.location.href = '/inventory?tab=print_templates&sub=barcodes'} className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 text-xs font-bold">
            <Settings2 className="size-3.5 mr-1.5 text-emerald-400" /> Template Settings
          </Button>
          <Button
            onClick={() => setIsPrintModalOpen(true)}
            disabled={printable.length === 0 || working}
            className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs font-bold shadow-lg shadow-emerald-500/20"
          >
            <Printer className="size-4 mr-2" />
            Print Barcodes {selected.size > 0 ? `(${selected.size} selected)` : `(all ${printable.length})`}
          </Button>
        </div>
      </div>

      {/* Filter Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={`p-4 cursor-pointer transition ${mode === "with" ? "ring-2 ring-emerald-500 bg-emerald-50/20" : ""}`}
          onClick={() => { setMode("with"); setSelected(new Set()); }}>
          <div className="text-xs uppercase font-bold text-muted-foreground">With Barcodes</div>
          <div className="text-3xl font-bold text-emerald-600 mt-1">{withBarcode.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Ready for barcode label printing</div>
        </Card>
        <Card className={`p-4 cursor-pointer transition ${mode === "without" ? "ring-2 ring-amber-500 bg-amber-50/20" : ""}`}
          onClick={() => { setMode("without"); setSelected(new Set()); }}>
          <div className="text-xs uppercase font-bold text-muted-foreground">Without Barcodes</div>
          <div className="text-3xl font-bold text-amber-600 mt-1">{withoutBarcode.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Need EAN-13 code assignment</div>
        </Card>
        <Card className={`p-4 cursor-pointer transition ${mode === "all" ? "ring-2 ring-blue-500 bg-blue-50/20" : ""}`}
          onClick={() => { setMode("all"); setSelected(new Set()); }}>
          <div className="text-xs uppercase font-bold text-muted-foreground">All Products</div>
          <div className="text-3xl font-bold text-blue-600 mt-1">{allProducts.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Total catalog products</div>
        </Card>
      </div>

      {/* Search & Selection Controls */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
              placeholder="Search by product name, SKU, or barcode..." />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
              className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30 appearance-none">
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 text-xs text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="size-3.5" />
            Showing <strong className="text-foreground">{filtered.length}</strong> of {allProducts.length} products
          </div>
          {mode === "without" && filtered.some(i => !i.barcode) && (
            <Button size="sm" onClick={handleBulkGenerate} disabled={working} className="bg-amber-600 hover:bg-amber-700 text-white text-xs">
              <Sparkles className="size-3.5 mr-1.5" /> Bulk Generate All ({filtered.filter(i => !i.barcode).length})
            </Button>
          )}
        </div>
      </Card>

      {/* Product Barcode Label Cards */}
      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center bg-muted/20 border-dashed">
          <ScanBarcode className="size-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No products match this filter</h3>
          <p className="text-muted-foreground">Try selecting a different category or search query.</p>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs flex-wrap gap-2">
            <button onClick={() => setSelected(allSelected ? new Set() : new Set(printable.map(p => p.id)))}
              className="text-primary font-bold hover:underline">
              {allSelected ? "Deselect all" : "Select all printable"} ({printable.length})
            </button>
            {selected.size > 0 && (
              <span className="text-muted-foreground">
                {selected.size} selected · <button onClick={() => setSelected(new Set())} className="hover:underline">clear</button>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(item => (
              <Card
                key={item.id}
                className={`p-4 transition ${item.barcode ? "cursor-pointer hover:shadow-lg" : ""} ${selected.has(item.id) ? "ring-2 ring-indigo-500 bg-indigo-50/10" : ""}`}
                onClick={() => item.barcode && toggle(item.id)}
              >
                <div className="flex items-center justify-between mb-3 border-b pb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">Product Label Preview</span>
                  {item.barcode ? (
                    <div className={`size-4 rounded border-2 ${selected.has(item.id) ? "bg-indigo-500 border-indigo-500" : "border-slate-300"}`} />
                  ) : (
                    <Button size="sm" variant="outline" disabled={working} onClick={(e) => { e.stopPropagation(); handleGenerate(item.id); }}>
                      <Plus className="size-3 mr-1" /> Generate Barcode
                    </Button>
                  )}
                </div>

                {/* Render Template Card */}
                <div className="min-h-[220px]">
                  <SingleBarcodeLabelCard item={item} template={activeTemplate} isPrint={false} />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Barcode Print Setup Modal */}
      <AnimatePresence>
        {isPrintModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-3xl p-6 max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5"
            >
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Printer className="size-5 text-emerald-500" />
                  <h3 className="text-lg font-black">Barcode Print Configuration</h3>
                </div>
                <button onClick={() => setIsPrintModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="size-5" />
                </button>
              </div>

              {/* Crucial Instructions Banner */}
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-3.5 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
                <Info className="size-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold block">Important Printer Settings in Chrome Dialog:</strong>
                  1. Set <strong>Margins</strong> to <strong>"None"</strong> (0mm).<br />
                  2. Set <strong>Paper Size</strong> to <strong>100mm x 25mm</strong> (for 2-Up roll) or matching label dimensions.
                </div>
              </div>

              {/* Layout Mode Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Thermal Roll & Sheet Layout Format
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setLayoutType("2up")}
                    className={`p-3 rounded-xl border text-left flex items-start gap-3 transition ${layoutType === "2up" ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-bold" : "border-slate-200 dark:border-slate-800"}`}
                  >
                    <LayoutGrid className="size-5 shrink-0 text-emerald-500 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold">2 Labels Per Row (2-Up)</div>
                      <div className="text-[10px] text-slate-500">Dual sticker roll tags (100mm x 25mm)</div>
                    </div>
                  </button>

                  <button
                    onClick={() => setLayoutType("1up")}
                    className={`p-3 rounded-xl border text-left flex items-start gap-3 transition ${layoutType === "1up" ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-bold" : "border-slate-200 dark:border-slate-800"}`}
                  >
                    <Rows3 className="size-5 shrink-0 text-emerald-500 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold">1 Label Per Row (1-Up)</div>
                      <div className="text-[10px] text-slate-500">Single roll sticker (50mm x 25mm)</div>
                    </div>
                  </button>

                  <button
                    onClick={() => setLayoutType("3up")}
                    className={`p-3 rounded-xl border text-left flex items-start gap-3 transition ${layoutType === "3up" ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-bold" : "border-slate-200 dark:border-slate-800"}`}
                  >
                    <LayoutGrid className="size-5 shrink-0 text-emerald-500 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold">3 Labels Per Row (3-Up)</div>
                      <div className="text-[10px] text-slate-500">Triple sticker roll tags (114mm x 25mm)</div>
                    </div>
                  </button>

                  <button
                    onClick={() => setLayoutType("a4")}
                    className={`p-3 rounded-xl border text-left flex items-start gap-3 transition ${layoutType === "a4" ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-bold" : "border-slate-200 dark:border-slate-800"}`}
                  >
                    <Package className="size-5 shrink-0 text-emerald-500 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold">A4 Adhesive Sheet (24-Up)</div>
                      <div className="text-[10px] text-slate-500">3 cols x 8 rows inkjet/laser sheet</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Copies Per Item Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Label Copies Per Product
                </label>
                <div className="flex gap-2">
                  {[1, 2, 5, 10].map(cnt => (
                    <button
                      key={cnt}
                      onClick={() => setCopiesPerItem(cnt)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${copiesPerItem === cnt ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900" : "border-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                    >
                      {cnt} {cnt === 1 ? "Copy" : "Copies"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-slate-100 dark:bg-slate-800/60 p-4 rounded-2xl flex items-center justify-between text-xs font-bold">
                <span>Total Barcode Labels to Print:</span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{targetPrintItems.length} Labels</span>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setIsPrintModalOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleExecutePrint} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold">
                  Print Now ({targetPrintItems.length})
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Printable Barcode Portal (Locks height to 24mm per sticker row) */}
      {typeof document !== "undefined" && createPortal(
        <div id="printable-barcode-portal" className="hidden print:block text-black bg-white p-0">
          {layoutType === "a4" ? (
            <div className="grid grid-cols-3 gap-2 w-full p-2">
              {targetPrintItems.map((item, idx) => (
                <div key={idx} className="h-[24mm]">
                  <SingleBarcodeLabelCard item={item} template={activeTemplate} isPrint={true} />
                </div>
              ))}
            </div>
          ) : layoutType === "2up" ? (
            <div className="grid grid-cols-2 gap-1 w-full p-0">
              {targetPrintItems.map((item, idx) => (
                <div key={idx} className="h-[24mm]">
                  <SingleBarcodeLabelCard item={item} template={activeTemplate} isPrint={true} />
                </div>
              ))}
            </div>
          ) : layoutType === "3up" ? (
            <div className="grid grid-cols-3 gap-1 w-full p-0">
              {targetPrintItems.map((item, idx) => (
                <div key={idx} className="h-[24mm]">
                  <SingleBarcodeLabelCard item={item} template={activeTemplate} isPrint={true} />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-1 w-full p-0">
              {targetPrintItems.map((item, idx) => (
                <div key={idx} className="h-[24mm]">
                  <SingleBarcodeLabelCard item={item} template={activeTemplate} isPrint={true} />
                </div>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-6 right-6 z-[200] inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-bold">
            <CheckCircle2 className="size-4" /> {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
