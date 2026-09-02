import { useEffect, useState, useMemo, useRef } from "react";
import { Search, Package, X, Check } from "lucide-react";
import { inventoryApi, InventoryProduct } from "../../lib/api-client";
import { useCurrency } from "@/hooks/use-currency";

interface ProductPickerProps {
  value: string;
  onChange: (id: string, product?: InventoryProduct) => void;
  placeholder?: string;
  excludeIds?: string[];
  autoFocus?: boolean;
}

/**
 * Searchable product dropdown. Loads products, filters client-side, closes on click-outside,
 * and uses z-[100] with clean elevation so it never flows underneath other containers.
 */
export function ProductPicker({ value, onChange, placeholder = "Search product…", excludeIds = [], autoFocus = false }: ProductPickerProps) {
  const { currency, formatCurrency } = useCurrency();
  const [all, setAll] = useState<InventoryProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    inventoryApi.getProducts({ page_size: 200 })
      .then((res) => { if (mounted) setAll(Array.isArray(res) ? res : (res?.items || [])); })
      .catch(() => { if (mounted) setAll([]); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, []);

  // Click outside to close
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((p) => !excludeIds.includes(p.id))
      .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q) || (p.barcode || "").includes(q))
      .slice(0, 50);
  }, [all, query, excludeIds]);

  const selected = all.find((p) => p.id === value);

  return (
    <div ref={containerRef} className="relative w-full">
      {selected ? (
        <div className="flex items-center justify-between h-10 px-3 text-xs rounded-xl border border-indigo-200 bg-indigo-50/40 text-slate-800">
          <div className="flex items-center gap-2 min-w-0">
            <Package className="size-4 text-indigo-600 shrink-0" />
            <div className="min-w-0">
              <div className="font-bold truncate text-slate-900">{selected.name}</div>
              <div className="text-[10px] text-slate-500 font-mono">
                {selected.sku || selected.barcode || selected.id.slice(0, 8)}
                {selected.purchase_price ? ` • Cost: ${formatCurrency(Number(selected.purchase_price))}` : ""}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { onChange("", undefined); setQuery(""); }}
            className="text-slate-400 hover:text-rose-500 shrink-0 p-1 rounded-md transition-colors"
            title="Clear selected product"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
            <input
              autoFocus={autoFocus}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              placeholder={placeholder}
              className="w-full h-10 pl-9 pr-4 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 placeholder:text-slate-400"
            />
          </div>
          {open && (
            <div className="absolute left-0 right-0 top-11 z-[100] bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-64 overflow-y-auto divide-y divide-slate-100">
              {isLoading ? (
                <div className="px-4 py-3 text-xs text-slate-500">Loading products catalog…</div>
              ) : filtered.length === 0 ? (
                <div className="px-4 py-3 text-xs text-slate-400 text-center">No matching products found.</div>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { onChange(p.id, p); setOpen(false); setQuery(""); }}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-indigo-50/70 transition-colors flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{p.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                        <span>SKU: {p.sku || "—"}</span>
                        {p.barcode && <span>• Barcode: {p.barcode}</span>}
                        {p.current_stock !== undefined && (
                          <span className="text-indigo-600 font-semibold">• Stock: {p.current_stock}</span>
                        )}
                      </div>
                    </div>
                    {p.purchase_price ? (
                      <div className="text-right shrink-0">
                        <div className="text-xs font-black text-slate-900">{formatCurrency(Number(p.purchase_price))}</div>
                        <div className="text-[9px] text-slate-400">Unit Cost</div>
                      </div>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}