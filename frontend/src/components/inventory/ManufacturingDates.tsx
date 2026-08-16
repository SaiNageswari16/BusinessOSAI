import { useState, useEffect, useMemo } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import {
  CalendarClock, Loader2, Search, ChevronRight, ListChecks,
  Calendar, Boxes, Package2, FlaskConical,
} from "lucide-react";
import { inventoryApi, type ManufacturingCohorts } from "../../lib/api-client";

const COHORT_META: Record<string, { label: string; desc: string; className: string; bg: string; icon: any }> = {
  lt_30d:  { label: "0–30 Days Old",    desc: "Very fresh — highest shelf quality",       className: "text-emerald-600 border-emerald-200 bg-emerald-50",  bg: "from-emerald-500/10", icon: CalendarClock },
  lt_90d:  { label: "30–90 Days Old",   desc: "Fresh — typical retail window",            className: "text-blue-600 border-blue-200 bg-blue-50",            bg: "from-blue-500/10",    icon: Calendar },
  lt_180d: { label: "90–180 Days Old",  desc: "Aging — review discount thresholds",       className: "text-amber-600 border-amber-200 bg-amber-50",         bg: "from-amber-500/10",   icon: Calendar },
  gt_180d: { label: "180+ Days Old",    desc: "Long-aged — investigate FIFO compliance",  className: "text-rose-600 border-rose-200 bg-rose-50",            bg: "from-rose-500/10",    icon: Calendar },
};

export function ManufacturingDates() {
  const [cohorts, setCohorts] = useState<ManufacturingCohorts | null>(null);
  const [list, setList] = useState<any[]>([]);
  const [loadingCohorts, setLoadingCohorts] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState("");

  const loadCohorts = async () => {
    try {
      setLoadingCohorts(true);
      const c = await inventoryApi.getManufacturingCohorts();
      if (c && Object.keys(c.cohorts || {}).length > 0) {
        setCohorts(c);
      } else {
        throw new Error("fallback");
      }
    } catch {
      try {
        const batches = await inventoryApi.getBatches();
        const now = new Date().getTime();
        let lt_30d_cnt = 0, lt_30d_units = 0;
        let lt_90d_cnt = 0, lt_90d_units = 0;
        let lt_180d_cnt = 0, lt_180d_units = 0;
        let gt_180d_cnt = 0, gt_180d_units = 0;

        batches.forEach((b: any) => {
          const qty = Number(b.remaining_quantity || b.quantity || 0);
          if (!b.manufacturing_date) {
            lt_30d_cnt++;
            lt_30d_units += qty;
            return;
          }
          const daysOld = Math.floor((now - new Date(b.manufacturing_date).getTime()) / (1000 * 60 * 60 * 24));
          if (daysOld <= 30) { lt_30d_cnt++; lt_30d_units += qty; }
          else if (daysOld <= 90) { lt_90d_cnt++; lt_90d_units += qty; }
          else if (daysOld <= 180) { lt_180d_cnt++; lt_180d_units += qty; }
          else { gt_180d_cnt++; gt_180d_units += qty; }
        });

        setCohorts({
          cohorts: {
            lt_30d: { count: lt_30d_cnt, units: lt_30d_units },
            lt_90d: { count: lt_90d_cnt, units: lt_90d_units },
            lt_180d: { count: lt_180d_cnt, units: lt_180d_units },
            gt_180d: { count: gt_180d_cnt, units: gt_180d_units },
          },
          total_units: lt_30d_units + lt_90d_units + lt_180d_units + gt_180d_units,
          total_batches: batches.length,
        });
      } catch {
        setCohorts(null);
      }
    } finally {
      setLoadingCohorts(false);
    }
  };

  const loadList = async () => {
    setLoadingList(true);
    try {
      const data = await inventoryApi.getManufacturingList();
      if (data && data.length > 0) {
        setList(data);
      } else {
        throw new Error("fallback");
      }
    } catch {
      try {
        const batches = await inventoryApi.getBatches();
        setList(batches || []);
      } catch {
        setList([]);
      }
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { loadCohorts(); loadList(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(b =>
      b.batch_number.toLowerCase().includes(q)
      || (b.product_name || "").toLowerCase().includes(q)
      || (b.sku || "").toLowerCase().includes(q)
    );
  }, [list, search]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarClock className="size-6 text-primary" />
            Manufacturing Dates
          </h2>
          <p className="text-sm text-muted-foreground">Track batches by their manufacturing date cohorts — verify FIFO rotation and shelf-life compliance.</p>
        </div>
        <Button variant="outline" onClick={() => { loadCohorts(); loadList(); }}>
          Refresh
        </Button>
      </div>

      {loadingCohorts ? (
        <div className="flex justify-center p-12"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>
      ) : !cohorts ? (
        <Card className="p-12 text-center bg-muted/20 border-dashed">
          <p className="text-sm text-muted-foreground">No manufacturing data available. Create batches with manufacturing dates to populate this view.</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Object.entries(COHORT_META).map(([key, meta]) => {
              const c = cohorts.cohorts[key] || { count: 0, units: 0 };
              const Icon = meta.icon;
              return (
                <Card key={key} className="p-5 relative overflow-hidden">
                  <div className={`absolute inset-0 bg-gradient-to-br ${meta.bg} to-transparent pointer-events-none`} />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-bold uppercase ${meta.className.split(" ")[0]}`}>
                        {meta.label}
                      </span>
                      <Icon className={`size-4 ${meta.className.split(" ")[0]}`} />
                    </div>
                    <div className="text-3xl font-bold font-mono">{c.units.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{c.count} batches · {meta.desc}</div>
                  </div>
                </Card>
              );
            })}
          </div>

          {cohorts.serials_tracked > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <FlaskConical className="size-5 text-indigo-600" />
                <div>
                  <div className="font-bold">{cohorts.serials_tracked} serial-numbered items</div>
                  <div className="text-xs text-muted-foreground">tracked individually with their own manufacturing dates</div>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between gap-3">
          <h3 className="font-bold flex items-center gap-2">
            <ListChecks className="size-4 text-primary" />
            All Batches ({list.length})
          </h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="h-9 pl-9 pr-3 text-sm rounded-md border bg-card focus:ring-1 focus:ring-primary/30 w-64"
              placeholder="Search batch, product, SKU..." />
          </div>
        </div>

        {loadingList ? (
          <div className="flex justify-center p-12"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No batches with manufacturing dates found.
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Batch</th>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Warehouse</th>
                <th className="px-6 py-4">Supplier</th>
                <th className="px-6 py-4 text-right">Qty</th>
                <th className="px-6 py-4">Mfg Date</th>
                <th className="px-6 py-4">Expiry</th>
                <th className="px-6 py-4">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((b: any) => {
                const ageDays = b.manufacturing_date
                  ? Math.floor((Date.now() - new Date(b.manufacturing_date).getTime()) / (1000 * 60 * 60 * 24))
                  : null;
                const ageColor = ageDays === null ? "text-slate-400"
                  : ageDays <= 30 ? "text-emerald-600 font-bold"
                  : ageDays <= 90 ? "text-blue-600 font-bold"
                  : ageDays <= 180 ? "text-amber-600 font-bold"
                  : "text-rose-600 font-bold";
                return (
                  <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold">{b.batch_number}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold">{b.product_name || "—"}</div>
                      {b.sku && <div className="text-[10px] font-mono text-muted-foreground">SKU {b.sku}</div>}
                    </td>
                    <td className="px-6 py-4 text-xs">{b.warehouse_name || "—"}</td>
                    <td className="px-6 py-4 text-xs">{b.supplier || "—"}</td>
                    <td className="px-6 py-4 text-right font-mono font-bold">{b.remaining_quantity}</td>
                    <td className="px-6 py-4 text-xs font-medium">{b.manufacturing_date}</td>
                    <td className="px-6 py-4 text-xs">{b.expiry_date || "—"}</td>
                    <td className={`px-6 py-4 text-xs font-mono ${ageColor}`}>
                      {ageDays !== null ? `${ageDays}d` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
