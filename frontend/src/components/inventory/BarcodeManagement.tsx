import { useState, useEffect, useMemo } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import {
  ScanBarcode, Loader2, Search, Download, Plus, Hash,
  Printer, Package, CheckCircle2, Filter, X,
  Scan, Tag, ListChecks, Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { inventoryApi, type ProductBarcode, type InventoryCategory } from "../../lib/api-client";

function BarcodeVisual({ value, format }: { value: string; format: string | null }) {
  const bars = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < value.length; i++) {
      const c = value.charCodeAt(i);
      const w = (c % 3) + 1;
      out.push(w);
      out.push(2);
      out.push((c % 4) + 1);
    }
    return out;
  }, [value]);

  return (
    <div className="space-y-2">
      <div className="bg-white border rounded-lg p-4 flex justify-center">
        <svg width="220" height="80" viewBox="0 0 220 80">
          <rect width="220" height="70" fill="white" />
          {(() => {
            let x = 10;
            return bars.map((w, i) => {
              const isBlack = i % 2 === 0;
              const el = (
                <rect key={i} x={x} y={5} width={w} height={50} fill={isBlack ? "#000" : "transparent"} />
              );
              x += w + 1;
              return el;
            });
          })()}
          <text x="110" y="78" textAnchor="middle" fontSize="9" fontFamily="monospace" fontWeight="bold">
            {value}
          </text>
        </svg>
      </div>
      <div className="text-center text-[10px] uppercase font-bold text-muted-foreground">{format || "Code-128"}</div>
    </div>
  );
}

type Mode = "with" | "without" | "all";

export function BarcodeManagement() {
  const [items, setItems] = useState<ProductBarcode[]>([]);
  const [allProducts, setAllProducts] = useState<ProductBarcode[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [mode, setMode] = useState<Mode>("with");
  const [selected, setSelected] = useState<Set<string>>(new Set());
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
      const cats = (catsRaw as any).results || [];
      setCategories(cats);
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

  const printable = filtered.filter(i => i.barcode);
  const allSelected = printable.length > 0 && selected.size === printable.length;

  const handleBatchPrint = async () => {
    const ids = selected.size > 0 ? Array.from(selected) : printable.map(p => p.id);
    if (ids.length === 0) return;
    try {
      setWorking(true);
      const result = await inventoryApi.batchPrintBarcodes(ids);
      flash(`Printed ${result.printed} labels`);
      setSelected(new Set());
    } catch (e: any) {
      alert(`Print failed: ${e?.detail ?? e?.message}`);
    } finally {
      setWorking(false);
    }
  };

  const handleGenerate = async (productId: string) => {
    try {
      setWorking(true);
      const result = await inventoryApi.generateBarcode(productId);
      flash(`Generated: ${result.barcode}`);
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

  const handleDownload = () => {
    const rows = printable.length > 0 ? printable : filtered;
    if (rows.length === 0) return;
    const csv = ["Product Name,SKU,Barcode,Format,Category,Selling Price"]
      .concat(rows.map(i => `"${i.product_name}","${i.sku}","${i.barcode}","${i.format}","${i.category_name ?? ""}","${i.selling_price ?? ""}"`))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "barcodes.csv"; a.click();
    URL.revokeObjectURL(url);
    flash("Downloaded barcodes.csv");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Barcode Management</h2>
          <p className="text-sm text-muted-foreground">Generate, assign, and print EAN-13 / Code-128 barcodes for inventory items.</p>
        </div>
        <div className="flex gap-2">
          {mode === "without" && filtered.some(i => !i.barcode) && (
            <Button onClick={handleBulkGenerate} disabled={working} className="gradient-brand text-white border-0">
              <Sparkles className="size-4 mr-2" /> Generate All ({filtered.filter(i => !i.barcode).length})
            </Button>
          )}
          <Button variant="outline" onClick={handleDownload} disabled={filtered.length === 0}>
            <Download className="size-4 mr-2" /> Download CSV
          </Button>
          <Button
            onClick={handleBatchPrint}
            disabled={printable.length === 0 || working}
            className="gradient-brand text-white border-0"
            title={selected.size > 0 ? `Print ${selected.size} selected` : `Print all ${printable.length} with barcodes`}
          >
            <Printer className="size-4 mr-2" />
            Print Labels {selected.size > 0 ? `(${selected.size})` : printable.length > 0 ? `(all ${printable.length})` : ""}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={`p-4 cursor-pointer transition ${mode === "with" ? "ring-2 ring-emerald-500" : ""}`}
          onClick={() => { setMode("with"); setSelected(new Set()); }}>
          <div className="text-xs uppercase font-bold text-muted-foreground">With Barcodes</div>
          <div className="text-3xl font-bold text-emerald-600 mt-1">{withBarcode.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Ready to print</div>
        </Card>
        <Card className={`p-4 cursor-pointer transition ${mode === "without" ? "ring-2 ring-amber-500" : ""}`}
          onClick={() => { setMode("without"); setSelected(new Set()); }}>
          <div className="text-xs uppercase font-bold text-muted-foreground">Without Barcodes</div>
          <div className="text-3xl font-bold text-amber-600 mt-1">{withoutBarcode.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Need barcode assignment</div>
        </Card>
        <Card className={`p-4 cursor-pointer transition ${mode === "all" ? "ring-2 ring-blue-500" : ""}`}
          onClick={() => { setMode("all"); setSelected(new Set()); }}>
          <div className="text-xs uppercase font-bold text-muted-foreground">All Products</div>
          <div className="text-3xl font-bold text-blue-600 mt-1">{allProducts.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Combined inventory view</div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
              placeholder="Search by name, SKU, or barcode..." />
          </div>
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
              className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30 appearance-none">
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
          <ListChecks className="size-3" />
          Showing <strong className="text-foreground">{filtered.length}</strong> of {allProducts.length} products
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center bg-muted/20 border-dashed">
          <ScanBarcode className="size-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No products match this filter</h3>
          <p className="text-muted-foreground">Try changing the category filter or search term.</p>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-3 text-xs flex-wrap">
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
              <Card key={item.id}
                className={`p-4 transition ${item.barcode ? "cursor-pointer hover:shadow-md" : ""} ${selected.has(item.id) ? "ring-2 ring-indigo-500" : ""}`}
                onClick={() => item.barcode && toggle(item.id)}>
                <div className="flex items-start gap-3">
                  {item.image_url ? (
                    <img src={item.image_url} alt="" className="size-12 rounded object-cover" />
                  ) : (
                    <div className="size-12 rounded bg-muted flex items-center justify-center">
                      <Package className="size-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{item.product_name}</div>
                    <div className="text-xs font-mono text-muted-foreground">{item.sku}</div>
                    {item.category_name && (
                      <span className="inline-block text-[9px] bg-blue-500/10 text-blue-700 px-1.5 py-0.5 rounded mt-1 font-bold uppercase">
                        {item.category_name}
                      </span>
                    )}
                  </div>
                  {item.barcode ? (
                    <div className={`size-4 rounded border-2 ${selected.has(item.id) ? "bg-indigo-500 border-indigo-500" : "border-border"}`} />
                  ) : (
                    <Button size="sm" variant="outline" disabled={working} onClick={(e) => { e.stopPropagation(); handleGenerate(item.id); }}>
                      <Plus className="size-3 mr-1" /> Generate
                    </Button>
                  )}
                </div>
                {item.barcode ? (
                  <div className="mt-3">
                    <BarcodeVisual value={item.barcode} format={item.format} />
                  </div>
                ) : (
                  <div className="mt-3 p-4 bg-amber-500/5 border border-amber-200 rounded-lg text-center">
                    <Tag className="size-5 mx-auto text-amber-600 mb-1" />
                    <div className="text-xs text-amber-700 font-bold">No barcode assigned</div>
                    <div className="text-[10px] text-amber-600/70 mt-0.5">Click Generate to create EAN-13</div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

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
