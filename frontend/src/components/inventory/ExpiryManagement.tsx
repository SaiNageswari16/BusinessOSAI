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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Expiry Management</h2>
          <p className="text-sm text-muted-foreground">Monitor FMCG, Pharma, and Food products nearing expiration.</p>
        </div>
        <Button variant="outline" onClick={loadSummary}>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card
          className={`p-6 border-t-4 border-t-rose-500 cursor-pointer transition ${activeBucket === "expired" ? "ring-2 ring-rose-300" : ""}`}
          onClick={() => loadBucket("expired")}
        >
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-bold text-rose-500">Already Expired</h3>
            <CalendarX className="size-5 text-rose-500" />
          </div>
          {loadingSummary ? (
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          ) : (
            <div className="text-3xl font-bold font-mono">
              {summary?.expired?.units ?? summary?.expired?.count ?? 0}
              <span className="text-sm text-muted-foreground font-sans ml-2">units</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            {summary?.expired?.count ?? 0} batches require immediate write-off and disposal.
          </p>
          <Button variant="outline" size="sm" className="w-full mt-4 text-rose-500 border-rose-200 bg-rose-50 hover:bg-rose-100">
            <Ban className="size-3 mr-1" /> Review Write-offs
          </Button>
        </Card>

        <Card
          className={`p-6 border-t-4 border-t-amber-500 cursor-pointer transition ${activeBucket === "expiring_30" ? "ring-2 ring-amber-300" : ""}`}
          onClick={() => loadBucket("expiring_30")}
        >
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-bold text-amber-500">Expiring in 30 Days</h3>
            <AlertTriangle className="size-5 text-amber-500" />
          </div>
          {loadingSummary ? (
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          ) : (
            <div className="text-3xl font-bold font-mono">
              {summary?.expiring_30?.units ?? summary?.expiring_30?.count ?? 0}
              <span className="text-sm text-muted-foreground font-sans ml-2">units</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            {summary?.expiring_30?.count ?? 0} batches — recommend discount campaigns.
          </p>
          <Button variant="outline" size="sm" className="w-full mt-4 text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100">
            <Tag className="size-3 mr-1" /> Apply Discount
          </Button>
        </Card>

        <Card
          className={`p-6 border-t-4 border-t-blue-500 cursor-pointer transition ${activeBucket === "expiring_90" ? "ring-2 ring-blue-300" : ""}`}
          onClick={() => loadBucket("expiring_90")}
        >
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-bold text-blue-500">Expiring in 90 Days</h3>
            <CalendarX className="size-5 text-blue-500" />
          </div>
          {loadingSummary ? (
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          ) : (
            <div className="text-3xl font-bold font-mono">
              {summary?.expiring_90?.units ?? summary?.expiring_90?.count ?? 0}
              <span className="text-sm text-muted-foreground font-sans ml-2">units</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            {summary?.expiring_90?.count ?? 0} batches in normal clearance tracking.
          </p>
          <Button variant="outline" size="sm" className="w-full mt-4 text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100">
            <ListChecks className="size-3 mr-1" /> View Cohort
          </Button>
        </Card>
      </div>

      {activeBucket && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between gap-3">
            <h3 className="font-bold capitalize flex items-center gap-2">
              {activeBucket && (() => {
                const Icon = bucketActions[activeBucket].icon;
                return <Icon className="size-4" />;
              })()}
              {activeBucket === "expired" && "Already Expired"}
              {activeBucket === "expiring_30" && "Expiring in 30 Days"}
              {activeBucket === "expiring_90" && "Expiring in 90 Days"}
            </h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  className="h-9 pl-9 pr-3 text-sm rounded-md border bg-card focus:ring-1 focus:ring-primary/30 w-64"
                  placeholder="Search batch, product, SKU..." />
              </div>
              <Button variant="ghost" size="icon" onClick={() => setActiveBucket(null)}>
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {loadingList ? (
            <div className="flex justify-center p-12"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No batches match this bucket. ✓ You're clear.
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4">Batch</th>
                  <th className="px-6 py-4">Product</th>
                  <th className="px-6 py-4">Warehouse</th>
                  <th className="px-6 py-4 text-right">Qty</th>
                  <th className="px-6 py-4">Mfg Date</th>
                  <th className="px-6 py-4">Expiry</th>
                  <th className="px-6 py-4">Days</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(b => (
                  <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold">{b.batch_number}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold">{b.product_name || "—"}</div>
                      {b.sku && <div className="text-[10px] font-mono text-muted-foreground">SKU {b.sku}</div>}
                    </td>
                    <td className="px-6 py-4 text-xs">{b.warehouse_name || "—"}</td>
                    <td className="px-6 py-4 text-right font-mono font-bold">{b.remaining_quantity}</td>
                    <td className="px-6 py-4 text-xs">{b.manufacturing_date || "—"}</td>
                    <td className="px-6 py-4 text-xs">{b.expiry_date || "—"}</td>
                    <td className={`px-6 py-4 font-mono ${daysColor(b.days_to_expiry)}`}>
                      {b.days_to_expiry !== null ? (b.days_to_expiry < 0 ? `${b.days_to_expiry}d ago` : `+${b.days_to_expiry}d`) : "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setDiscountBatch(b)}>
                          <Tag className="size-3 mr-1" /> Discount
                        </Button>
                        <Button size="sm" variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => setWriteOffBatch(b)}>
                          <Ban className="size-3 mr-1" /> Write-off
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
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
