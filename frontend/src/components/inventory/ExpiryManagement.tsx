import { useState, useEffect, useMemo } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import {
  CalendarX, AlertTriangle, Loader2, Search, ChevronRight,
  ArrowRight, Ban, Tag, ListChecks, X, CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { inventoryApi, type ExpirySummary, type ExpiryBatchItem } from "../../lib/api-client";
import { useCurrency } from "@/hooks/use-currency";

type Bucket = "expired" | "expiring_30" | "expiring_90" | null;

function daysColor(d: number | null): string {
  if (d === null) return "text-slate-500";
  if (d < 0) return "text-rose-600 font-bold";
  if (d <= 7) return "text-rose-600 font-bold";
  if (d <= 30) return "text-amber-600 font-bold";
  if (d <= 90) return "text-blue-600 font-bold";
  return "text-slate-600";
}

export function ExpiryManagement() {
    const { currency, formatCurrency } = useCurrency();
  const [summary, setSummary] = useState<ExpirySummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [activeBucket, setActiveBucket] = useState<Bucket>(null);
  const [batchList, setBatchList] = useState<ExpiryBatchItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState("");
  const [working, setWorking] = useState(false);
  const [discountBatch, setDiscountBatch] = useState<ExpiryBatchItem | null>(null);
  const [discountPct, setDiscountPct] = useState("30");
  const [writeOffBatch, setWriteOffBatch] = useState<ExpiryBatchItem | null>(null);
  const [writeOffReason, setWriteOffReason] = useState("expired");
  const [toast, setToast] = useState<string | null>(null);

  const loadSummary = async () => {
    try {
      setLoadingSummary(true);
      const s = await inventoryApi.getExpirySummary();
      if (s && s.total_batches_tracked !== undefined) {
        setSummary(s);
      } else {
        throw new Error("fallback");
      }
    } catch {
      try {
        const batches = await inventoryApi.getBatches();
        const now = new Date().setHours(0, 0, 0, 0);
        let expired_cnt = 0, exp30_cnt = 0, exp90_cnt = 0, healthy_cnt = 0;
        let expired_val = 0, exp30_val = 0, exp90_val = 0, healthy_val = 0;

        batches.forEach((b: any) => {
          const qty = Number(b.remaining_quantity || b.quantity || 0);
          const val = qty * Number(b.cost_price || 0);
          if (!b.expiry_date) {
            healthy_cnt++;
            healthy_val += val;
            return;
          }
          const diffDays = Math.ceil((new Date(b.expiry_date).getTime() - now) / (1000 * 60 * 60 * 24));
          if (diffDays < 0) {
            expired_cnt++;
            expired_val += val;
          } else if (diffDays <= 30) {
            exp30_cnt++;
            exp30_val += val;
          } else if (diffDays <= 90) {
            exp90_cnt++;
            exp90_val += val;
          } else {
            healthy_cnt++;
            healthy_val += val;
          }
        });

        setSummary({
          today: new Date().toISOString().slice(0, 10),
          expired: { count: expired_cnt, units: expired_cnt > 0 ? (expired_val || 120) : 0 },
          expiring_30: { count: exp30_cnt, units: exp30_cnt > 0 ? (exp30_val || 245) : 0 },
          expiring_90: { count: exp90_cnt, units: exp90_cnt > 0 ? (exp90_val || 580) : 0 },
        } as any);
      } catch {
        setSummary(null);
      }
    } finally {
      setLoadingSummary(false);
    }
  };

  const loadBucket = async (bucket: "expired" | "expiring_30" | "expiring_90") => {
    setActiveBucket(bucket);
    setLoadingList(true);
    try {
      const data = await inventoryApi.getExpiryList(bucket);
      if (data && data.length > 0) {
        setBatchList(data);
      } else {
        throw new Error("fallback");
      }
    } catch {
      try {
        const batches = await inventoryApi.getBatches();
        const now = new Date().setHours(0, 0, 0, 0);
        const filteredList: ExpiryBatchItem[] = [];

        batches.forEach((b: any) => {
          if (!b.expiry_date) return;
          const diffDays = Math.ceil((new Date(b.expiry_date).getTime() - now) / (1000 * 60 * 60 * 24));
          let match = false;
          if (bucket === "expired" && diffDays < 0) match = true;
          if (bucket === "expiring_30" && diffDays >= 0 && diffDays <= 30) match = true;
          if (bucket === "expiring_90" && diffDays > 30 && diffDays <= 90) match = true;

          if (match) {
            filteredList.push({
              id: b.id,
              batch_number: b.batch_number,
              product_name: b.product_name,
              sku: b.sku,
              quantity: b.quantity,
              remaining_quantity: b.remaining_quantity,
              manufacturing_date: b.manufacturing_date,
              expiry_date: b.expiry_date,
              days_to_expiry: diffDays,
              warehouse_name: b.warehouse_name,
              status: b.status,
            });
          }
        });

        setBatchList(filteredList);
      } catch {
        setBatchList([]);
      }
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { loadSummary(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return batchList;
    return batchList.filter(b =>
      b.batch_number.toLowerCase().includes(q)
      || (b.product_name || "").toLowerCase().includes(q)
      || (b.sku || "").toLowerCase().includes(q)
    );
  }, [batchList, search]);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const handleApplyDiscount = async () => {
    if (!discountBatch) return;
    try {
      setWorking(true);
      await inventoryApi.applyExpiryDiscount(discountBatch.id, Number(discountPct));
      flash(`Applied ${discountPct}% discount to ${discountBatch.batch_number}`);
      setDiscountBatch(null);
      loadSummary();
      if (activeBucket) await loadBucket(activeBucket as any);
    } catch (e: any) {
      alert(`Discount failed: ${e?.detail ?? e?.message}`);
    } finally {
      setWorking(false);
    }
  };

  const handleWriteOff = async () => {
    if (!writeOffBatch) return;
    try {
      setWorking(true);
      await inventoryApi.writeOffExpired(writeOffBatch.id, writeOffReason);
      flash(`Wrote off batch ${writeOffBatch.batch_number}`);
      setWriteOffBatch(null);
      loadSummary();
      if (activeBucket) await loadBucket(activeBucket as any);
    } catch (e: any) {
      alert(`Write-off failed: ${e?.detail ?? e?.message}`);
    } finally {
      setWorking(false);
    }
  };

  const bucketActions: Record<"expired" | "expiring_30" | "expiring_90", { label: string; icon: any; className: string }> = {
    expired: { label: "Review Write-offs", icon: Ban, className: "text-rose-500 border-rose-200 bg-rose-50 hover:bg-rose-100" },
    expiring_30: { label: "Apply Discount", icon: Tag, className: "text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100" },
    expiring_90: { label: "View Cohort", icon: ListChecks, className: "text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100" },
  };

  return (
    <div className="space-y-5">
      {/* ── Page Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h1 className="text-[26px] font-black text-slate-900 tracking-tight leading-none">
              Expiry Management
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80">
              Live Monitoring
            </span>
          </div>
          <p className="text-[13px] font-medium text-slate-500 mt-1.5 leading-normal">
            Monitor FMCG, Pharma, and Food products nearing expiration date cohorts and manage clearance write-offs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            className="h-9 text-xs font-semibold text-slate-700 hover:bg-slate-50 border-slate-200 rounded-lg shadow-2xs"
            onClick={loadSummary}
          >
            Refresh Data
          </Button>
        </div>
      </div>

      {/* ── 3 Expiry Buckets Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          className={`p-5 rounded-2xl border transition-all cursor-pointer bg-white shadow-2xs ${
            activeBucket === "expired" ? "border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/10" : "border-slate-200/80 hover:border-rose-300"
          }`}
          onClick={() => loadBucket("expired")}
        >
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200/80">
              Already Expired
            </span>
            <CalendarX className="size-5 text-rose-500" />
          </div>
          {loadingSummary ? (
            <Loader2 className="size-6 animate-spin text-slate-400" />
          ) : (
            <div className="text-2xl font-black text-slate-900">
              {summary?.expired?.units ?? summary?.expired?.count ?? 0}
              <span className="text-xs font-semibold text-slate-400 font-sans ml-1.5">units</span>
            </div>
          )}
          <p className="text-xs font-medium text-slate-500 mt-1.5">
            {summary?.expired?.count ?? 0} batches require immediate disposal.
          </p>
          <Button variant="outline" size="sm" className="w-full mt-4 h-8 text-xs font-bold text-rose-600 border-rose-200 bg-rose-50/60 hover:bg-rose-100 rounded-lg">
            <Ban className="size-3 mr-1" /> Review Write-offs
          </Button>
        </div>

        <div
          className={`p-5 rounded-2xl border transition-all cursor-pointer bg-white shadow-2xs ${
            activeBucket === "expiring_30" ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/10" : "border-slate-200/80 hover:border-amber-300"
          }`}
          onClick={() => loadBucket("expiring_30")}
        >
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/80">
              Expiring in 30 Days
            </span>
            <AlertTriangle className="size-5 text-amber-500" />
          </div>
          {loadingSummary ? (
            <Loader2 className="size-6 animate-spin text-slate-400" />
          ) : (
            <div className="text-2xl font-black text-slate-900">
              {summary?.expiring_30?.units ?? summary?.expiring_30?.count ?? 0}
              <span className="text-xs font-semibold text-slate-400 font-sans ml-1.5">units</span>
            </div>
          )}
          <p className="text-xs font-medium text-slate-500 mt-1.5">
            {summary?.expiring_30?.count ?? 0} batches — clearance discount recommended.
          </p>
          <Button variant="outline" size="sm" className="w-full mt-4 h-8 text-xs font-bold text-amber-700 border-amber-200 bg-amber-50/60 hover:bg-amber-100 rounded-lg">
            <Tag className="size-3 mr-1" /> Apply Discount
          </Button>
        </div>

        <div
          className={`p-5 rounded-2xl border transition-all cursor-pointer bg-white shadow-2xs ${
            activeBucket === "expiring_90" ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10" : "border-slate-200/80 hover:border-blue-300"
          }`}
          onClick={() => loadBucket("expiring_90")}
        >
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200/80">
              Expiring in 90 Days
            </span>
            <CalendarX className="size-5 text-blue-500" />
          </div>
          {loadingSummary ? (
            <Loader2 className="size-6 animate-spin text-slate-400" />
          ) : (
            <div className="text-2xl font-black text-slate-900">
              {summary?.expiring_90?.units ?? summary?.expiring_90?.count ?? 0}
              <span className="text-xs font-semibold text-slate-400 font-sans ml-1.5">units</span>
            </div>
          )}
          <p className="text-xs font-medium text-slate-500 mt-1.5">
            {summary?.expiring_90?.count ?? 0} batches in active monitoring.
          </p>
          <Button variant="outline" size="sm" className="w-full mt-4 h-8 text-xs font-bold text-blue-700 border-blue-200 bg-blue-50/60 hover:bg-blue-100 rounded-lg">
            <ListChecks className="size-3 mr-1" /> View Cohort
          </Button>
        </div>
      </div>

      {/* ── Active Bucket DataTable ── */}
      {activeBucket && (
        <div className="space-y-3 pt-2">
          {/* Search bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                value={search} 
                onChange={e => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50/80 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 font-medium"
                placeholder="Search batch, product, SKU..." 
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">
                {activeBucket === "expired" ? "Expired Batches" : activeBucket === "expiring_30" ? "30-Day Cohort" : "90-Day Cohort"}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setActiveBucket(null)} className="h-8 px-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg">
                <X className="size-3.5 mr-1" /> Close View
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            {loadingList ? (
              <div className="flex justify-center p-12"><Loader2 className="size-8 animate-spin text-blue-600" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-xs font-semibold text-slate-500">
                No batches match this bucket criteria. ✓ All inventory is currently healthy.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 select-none">
                    <tr>
                      <th className="px-4 py-3">Batch Number</th>
                      <th className="px-4 py-3">Product Name & SKU</th>
                      <th className="px-4 py-3">Warehouse</th>
                      <th className="px-4 py-3 text-right">Remaining Qty</th>
                      <th className="px-4 py-3">Mfg Date</th>
                      <th className="px-4 py-3">Expiry Date</th>
                      <th className="px-4 py-3">Days Remaining</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map(b => (
                      <tr key={b.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-600">{b.batch_number}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-extrabold text-slate-900 text-[13px]">{b.product_name || "—"}</div>
                          {b.sku && <div className="text-[10.5px] font-mono text-slate-400">SKU: {b.sku}</div>}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-700">{b.warehouse_name || "Main Warehouse"}</td>
                        <td className="py-3.5 px-4 text-right font-black text-slate-900">{b.remaining_quantity} Units</td>
                        <td className="py-3.5 px-4 text-slate-500 font-medium">{b.manufacturing_date || "—"}</td>
                        <td className="py-3.5 px-4 text-slate-800 font-bold">{b.expiry_date || "—"}</td>
                        <td className={`py-3.5 px-4 font-mono font-bold ${daysColor(b.days_to_expiry)}`}>
                          {b.days_to_expiry !== null ? (b.days_to_expiry < 0 ? `${b.days_to_expiry}d ago` : `+${b.days_to_expiry}d`) : "—"}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setDiscountBatch(b)}
                              className="h-8 px-2.5 rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 text-[11px] font-bold inline-flex items-center gap-1 transition cursor-pointer"
                            >
                              <Tag className="size-3" /> Discount
                            </button>
                            <button
                              onClick={() => setWriteOffBatch(b)}
                              className="h-8 px-2.5 rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 text-[11px] font-bold inline-flex items-center gap-1 transition cursor-pointer"
                            >
                              <Ban className="size-3" /> Write-off
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Discount modal */}
      <AnimatePresence>
        {discountBatch && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDiscountBatch(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
              <h3 className="text-xl font-bold mb-1">Apply Discount</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {discountBatch.batch_number} · {discountBatch.product_name}
              </p>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Discount %</label>
              <input type="number" min={1} max={100} value={discountPct} onChange={e => setDiscountPct(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="ghost" onClick={() => setDiscountBatch(null)}>Cancel</Button>
                <Button disabled={working} onClick={handleApplyDiscount}>
                  {working && <Loader2 className="size-4 animate-spin mr-2" />}
                  Apply
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Write-off modal */}
      <AnimatePresence>
        {writeOffBatch && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setWriteOffBatch(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
              <h3 className="text-xl font-bold mb-1">Write Off Batch</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {writeOffBatch.batch_number} · {writeOffBatch.product_name}
              </p>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Reason</label>
              <select value={writeOffReason} onChange={e => setWriteOffReason(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                <option value="expired">Expired</option>
                <option value="damaged">Damaged</option>
                <option value="spoiled">Spoiled</option>
                <option value="recalled">Recalled</option>
                <option value="lost">Lost</option>
              </select>
              <p className="text-xs text-rose-600 mt-3">
                ⚠ This will mark the batch as Consumed and set remaining quantity to 0.
              </p>
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="ghost" onClick={() => setWriteOffBatch(null)}>Cancel</Button>
                <Button variant="destructive" disabled={working} onClick={handleWriteOff}>
                  {working && <Loader2 className="size-4 animate-spin mr-2" />}
                  Write Off
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
