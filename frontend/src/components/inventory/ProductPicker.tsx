import { useEffect, useState, useMemo } from "react";
import { Search, Package, X } from "lucide-react";
import { inventoryApi, InventoryProduct } from "../../lib/api-client";

interface ProductPickerProps {
  value: string;
  onChange: (id: string, product?: InventoryProduct) => void;
  placeholder?: string;
  excludeIds?: string[];
  autoFocus?: boolean;
}

/**
 * Searchable product dropdown. Loads all products once, then filters client-side.
 * Shows product name + SKU so users don't need to memorize UUIDs.
 */
export function ProductPicker({ value, onChange, placeholder = "Search product…", excludeIds = [], autoFocus = false }: ProductPickerProps) {
  const [all, setAll] = useState<InventoryProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    inventoryApi.getProducts({ page_size: 200 })
      .then((res) => { if (mounted) setAll(res.items || []); })
      .catch(() => { if (mounted) setAll([]); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((p) => !excludeIds.includes(p.id))
      .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q) || (p.barcode || "").includes(q))
      .slice(0, 50);
  }, [all, query, excludeIds]);

  const selected = all.find((p) => p.id === value);

  return (
    <div className="relative">
      {selected ? (
        <div className="flex items-center justify-between h-10 px-3 text-sm rounded-lg border bg-background">
          <div className="flex items-center gap-2 min-w-0">
            <Package className="size-4 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold truncate">{selected.name}</div>
              <div className="text-[10px] text-muted-foreground font-mono">{selected.sku || selected.id.slice(0, 8)}</div>
            </div>
          </div>
          <button type="button" onClick={() => { onChange("", undefined); setQuery(""); }}
            className="text-muted-foreground hover:text-rose-500 shrink-0">
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              autoFocus={autoFocus}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              placeholder={placeholder}
              className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-background focus:ring-1 focus:ring-primary/30 outline-none"
            />
          </div>
          {open && (
            <div className="absolute left-0 right-0 top-11 z-30 bg-white border rounded-xl shadow-xl max-h-64 overflow-y-auto">
              {isLoading ? (
                <div className="px-4 py-3 text-xs text-muted-foreground">Loading products…</div>
              ) : filtered.length === 0 ? (
                <div className="px-4 py-3 text-xs text-muted-foreground">No products match.</div>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { onChange(p.id, p); setOpen(false); setQuery(""); }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                  >
                    <div className="text-xs font-semibold truncate">{p.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {p.sku || "—"} {p.barcode ? `• ${p.barcode}` : ""}
                    </div>
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