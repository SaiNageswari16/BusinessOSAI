import { useState, useEffect, useMemo, useCallback } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import {
  RefreshCw, Loader2, AlertTriangle, TrendingUp, Package, Calendar, PieChart,
  Tag, AlertCircle, BarChart3, Sparkles, ShieldCheck, Truck, RotateCcw,
  XCircle, ChevronRight, ArrowDownToLine, BadgeDollarSign, Flame, Target,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart as RechartsPie, Pie, Cell, Legend,
} from "recharts";
import { inventoryApi, type IntelligenceSummary } from "../../lib/api-client";
import * as Icons from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

/* ─── types ─── */

type Tab = "overview" | "deadstock" | "reorder" | "abc" | "anomalies" | "categories";

const ICON_MAP: Record<string, any> = {
  Package: Icons.Package,
  AlertTriangle: Icons.AlertTriangle,
  Calendar: Icons.Calendar,
  TrendingUp: Icons.TrendingUp,
  PieChart: Icons.PieChart,
  Tag: Icons.Tag,
  RotateCcw: Icons.RotateCcw,
  Sparkles: Icons.Sparkles,
};

/* ─── helpers ─── */

const TONE_COLORS: Record<string, { bg: string; text: string; border: string; fill: string }> = {
  critical: { bg: "bg-rose-500/10", text: "text-rose-600", border: "border-rose-500/30", fill: "#ef4444" },
  warning:  { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/30", fill: "#f59e0b" },
  info:     { bg: "bg-sky-500/10", text: "text-sky-600", border: "border-sky-500/30", fill: "#0ea5e9" },
  success:  { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-500/30", fill: "#10b981" },
};
const URGENCY_ORDER = ["critical", "high", "medium", "low"];
const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "deadstock", label: "Dead Stock", icon: Package },
  { key: "reorder", label: "Reorder", icon: ArrowDownToLine },
  { key: "abc", label: "ABC", icon: Target },
  { key: "anomalies", label: "Anomalies", icon: AlertTriangle },
  { key: "categories", label: "Categories", icon: PieChart },
];

function gradeRing(grade: string, score: number, color: string) {
  const radius = 54;
  const circ = 2 * Math.PI * radius;
  const pct = Math.min(100, Math.max(0, score)) / 100;
  const dash = circ * pct;
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="10" />
      <circle cx="70" cy="70" r={radius} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 70 70)"
        style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)" }} />
      <text x="70" y="62" textAnchor="middle" fontSize="32" fontWeight="900" fill={color} fontFamily="sans-serif">
        {Math.round(score)}
      </text>
      <text x="70" y="82" textAnchor="middle" fontSize="12" fontWeight="700" fill="#94a3b8" fontFamily="sans-serif">
        out of 100
      </text>
    </svg>
  );
}

/* ─── component ─── */

export function InventoryIntelligence() {
    const { currency, formatCurrency } = useCurrency();
  const [data, setData] = useState<IntelligenceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await inventoryApi.getIntelligence();
      setData(res);
      return res;
    } catch (e: any) {
      console.error("Intelligence fetch failed:", e);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  /* ─── Overview Tab ─── */
  const renderOverview = (data: IntelligenceSummary) => {
    const h = data.health;
    const dead = data.dead_stock;
    const recs = data.reorder;
    const ins = data.insights;

    return (
      <div className="space-y-6">
        {/* Health Score Gauge + Key Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-6 flex flex-col items-center justify-center">
            {gradeRing(h.grade, h.overall, h.grade_color)}
            <div className="text-center mt-2">
              <span className="text-2xl font-black" style={{ color: h.grade_color }}>{h.grade}</span>
              <span className="text-sm text-muted-foreground block">Inventory Grade</span>
            </div>
          </Card>

          <Card className="p-6 lg:col-span-2">
            <h3 className="font-bold text-lg mb-4">Score Breakdown</h3>
            <div className="space-y-3">
              {h.components.map(c => (
                <div key={c.key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{c.label}</span>
                    <span className="font-bold">{c.score} / 100</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${c.score}%` }}
                      transition={{ duration: 1, delay: 0.1 }}
                      className="h-2.5 rounded-full"
                      style={{
                        backgroundColor: c.score >= 75 ? "#10b981"
                          : c.score >= 50 ? "#eab308"
                          : c.score >= 30 ? "#f97316" : "#ef4444",
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{c.signal}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Dead Stock Items", value: dead.total_count, icon: Package, color: "text-amber-600 bg-amber-500/10", detail: `${dead.total_dead_value?.toLocaleString() || 0} trapped` },
            { label: "Critical Reorders", value: recs.critical + recs.high, icon: AlertTriangle, color: "text-rose-600 bg-rose-500/10", detail: `${recs.total_count} total recommendations` },
            { label: "Active Anomalies", value: (data.anomalies?.counts?.critical || 0) + (data.anomalies?.counts?.warning || 0), icon: AlertCircle, color: "text-orange-600 bg-orange-500/10", detail: `${data.anomalies?.counts?.info || 0} informational` },
            { label: "Stock at Risk", value: h.stocked_out_count, icon: ShieldCheck, color: "text-sky-600 bg-sky-500/10", detail: `${h.expiry_at_risk_value?.toLocaleString() || 0} near expiry` },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label} className="p-4">
                <div className={`size-9 rounded-lg ${s.color} flex items-center justify-center mb-2`}>
                  <Icon className="size-4" />
                </div>
                <div className="text-2xl font-black font-mono">{s.value}</div>
                <div className="text-xs font-bold">{s.label}</div>
                <div className="text-[10px] text-muted-foreground">{s.detail}</div>
              </Card>
            );
          })}
        </div>

        {/* Smart Insights */}
        {ins.insights.length > 0 && (
          <Card className="p-6">
            <h3 className="font-bold text-lg flex items-center gap-2 mb-4">
              <Sparkles className="size-5 text-amber-500" />
              Smart Insights
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ins.insights.map((s, i) => {
                const tc = TONE_COLORS[s.tone] || TONE_COLORS.info;
                const Icon = ICON_MAP[s.icon] || Sparkles;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className={`p-4 rounded-xl border ${tc.border} ${tc.bg}`}>
                    <div className="flex items-start gap-3">
                      <Icon className={`size-5 ${tc.text} shrink-0 mt-0.5`} />
                      <div>
                        <div className="font-bold text-sm">{s.title}</div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.body}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    );
  };

  /* ─── Dead Stock Tab ─── */
  const renderDeadStock = (data: IntelligenceSummary) => {
    const items = data.dead_stock.items;
    if (items.length === 0) {
      return <Card className="p-12 text-center"><Sparkles className="size-12 mx-auto text-emerald-500 mb-3" /><h3 className="text-lg font-bold">No Dead Stock</h3><p className="text-sm text-muted-foreground">All your products are moving — great job.</p></Card>;
    }
    return (
      <Card className="overflow-hidden">
        <div className="p-4 border-b bg-amber-50">
          <div className="flex items-center gap-3">
            <Flame className="size-5 text-amber-600" />
            <div>
              <div className="font-bold">{items.length} products · Rs. {data.dead_stock.total_dead_value.toLocaleString()} in dead capital</div>
              <div className="text-xs text-muted-foreground">No movement in 90+ days · Click to view recommendations</div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">On Hand</th>
                <th className="px-4 py-3 text-right">Stock Value</th>
                <th className="px-4 py-3">Dormant</th>
                <th className="px-4 py-3">Expiry</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map(item => {
                const recColor = item.recommendation_severity === "critical" ? "text-rose-600 bg-rose-50"
                  : item.recommendation_severity === "high" ? "text-orange-600 bg-orange-50"
                  : item.recommendation_severity === "medium" ? "text-amber-600 bg-amber-50"
                  : "text-slate-600 bg-slate-50";
                return (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-bold">{item.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{item.sku}</td>
                    <td className="px-4 py-3 text-xs">{item.category}</td>
                    <td className="px-4 py-3 text-right font-mono">{item.on_hand}</td>
                    <td className="px-4 py-3 text-right font-mono">{currency.symbol}{item.stock_value.toLocaleString()}</td>
                    <td className="px-4 py-3"><span className="text-xs font-bold text-amber-600">{item.no_movement_for}</span></td>
                    <td className="px-4 py-3 text-xs">{item.days_to_expiry != null ? `${item.days_to_expiry}d` : "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-black uppercase ${recColor}`}>
                        {item.recommendation}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    );
  };

  /* ─── Reorder Tab ─── */
  const renderReorder = (data: IntelligenceSummary) => {
    const items = data.reorder.items;
    if (items.length === 0) {
      return <Card className="p-12 text-center"><ShieldCheck className="size-12 mx-auto text-emerald-500 mb-3" /><h3 className="text-lg font-bold">All Stocked Up</h3><p className="text-sm text-muted-foreground">No reorder recommendations right now.</p></Card>;
    }
    const r = data.reorder;
    return (
      <Card className="overflow-hidden">
        <div className="p-4 border-b bg-sky-50 flex items-center gap-3">
          <ArrowDownToLine className="size-5 text-sky-600" />
          <div>
            <div className="font-bold">{r.total_count} reorder recommendations · Est. Rs. {r.estimated_total_value.toLocaleString()}</div>
            <div className="flex gap-2 text-xs mt-1">
              {r.critical > 0 && <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded font-bold">{r.critical} critical</span>}
              {r.high > 0 && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded font-bold">{r.high} high</span>}
              {r.medium > 0 && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded font-bold">{r.medium} medium</span>}
              {r.low > 0 && <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-bold">{r.low} low</span>}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold">
              <tr>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-right">On Hand</th>
                <th className="px-4 py-3 text-right">Reorder @</th>
                <th className="px-4 py-3 text-right">Order Qty</th>
                <th className="px-4 py-3 text-right">Est. Value</th>
                <th className="px-4 py-3">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map(item => {
                const uc = item.urgency === "critical" ? "text-rose-700 bg-rose-50"
                  : item.urgency === "high" ? "text-orange-700 bg-orange-50"
                  : item.urgency === "medium" ? "text-amber-700 bg-amber-50"
                  : "text-slate-600 bg-slate-50";
                return (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${uc}`}>{item.urgency}</span></td>
                    <td className="px-4 py-3 font-bold">{item.name}</td>
                    <td className="px-4 py-3 text-right font-mono">{item.on_hand}</td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">{item.reorder_level}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{item.suggested_order_qty}</td>
                    <td className="px-4 py-3 text-right font-mono">{currency.symbol}{item.suggested_order_value.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px]">{item.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    );
  };

  /* ─── ABC Tab ─── */
  const renderABC = (data: IntelligenceSummary) => {
    const items = data?.reorder.items || [];
    if (items.length === 0) return null;
    const classA = items.filter(i => i.urgency === "critical" || i.urgency === "high");
    const classB = items.filter(i => i.urgency === "medium");
    const classC = items.filter(i => i.urgency === "low");
    const aVal = classA.reduce((s, i) => s + i.suggested_order_value, 0);
    const bVal = classB.reduce((s, i) => s + i.suggested_order_value, 0);
    const cVal = classC.reduce((s, i) => s + i.suggested_order_value, 0);
    const total = aVal + bVal + cVal || 1;

    const pieData = [
      { name: "A — Critical/High", value: classA.length, value_inr: aVal, fill: "#ef4444" },
      { name: "B — Medium", value: classB.length, value_inr: bVal, fill: "#f59e0b" },
      { name: "C — Low", value: classC.length, value_inr: cVal, fill: "#22c55e" },
    ];

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-bold mb-4">Pareto Distribution</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                </Pie>
                <Tooltip formatter={(v: any, _k: any, p: any) => [`${v} products`, p.payload.name]} />
              </RechartsPie>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold mb-4">Category Breakdown</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.categories?.items?.slice(0, 8) || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="category" type="category" tick={{ fontSize: 10 }} width={140} />
                <Tooltip formatter={(v: any) => [`₹${v?.toLocaleString()}`, ""]} />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    );
  };

  /* ─── Anomalies Tab ─── */
  const renderAnomalies = (data: IntelligenceSummary) => {
    const items = data.anomalies.items;
    if (items.length === 0) {
      return <Card className="p-12 text-center"><Target className="size-12 mx-auto text-emerald-500 mb-3" /><h3 className="text-lg font-bold">No Anomalies</h3><p className="text-sm text-muted-foreground">All signals are within expected ranges.</p></Card>;
    }
    const counts = data.anomalies.counts || {};
    return (
      <Card className="overflow-hidden">
        <div className="p-4 border-b bg-orange-50 flex items-center gap-4">
          <AlertTriangle className="size-5 text-orange-600" />
          <div className="flex gap-2">
            {counts.critical > 0 && <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-xs font-bold">{counts.critical} critical</span>}
            {counts.warning > 0 && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-bold">{counts.warning} warning</span>}
            {counts.info > 0 && <span className="px-2 py-0.5 bg-sky-100 text-sky-700 rounded text-xs font-bold">{counts.info} info</span>}
          </div>
        </div>
        <div className="divide-y">
          {items.map((a, i) => {
            const tc = TONE_COLORS[a.severity] || TONE_COLORS.info;
            const Icon = (a.anomaly_type === "velocity_spike" ? TrendingUp
              : a.anomaly_type === "velocity_drop" ? TrendingUp
              : a.anomaly_type === "shrinkage" ? Package
              : a.anomaly_type === "sleeper" ? Flame
              : a.anomaly_type === "negative_stock" ? XCircle
              : AlertCircle);
            return (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`p-4 flex items-start gap-3 ${tc.bg} border-l-4 ${tc.border}`}>
                <Icon className={`size-5 ${tc.text} shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{a.title}</span>
                    <span className="text-xs font-mono text-muted-foreground">{a.sku}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{a.message}</p>
                  {a.context && <p className="text-[10px] text-muted-foreground mt-1 italic">{a.context}</p>}
                </div>
                <span className={`text-[10px] font-black px-2 py-1 rounded uppercase ${tc.text} ${tc.bg} shrink-0`}>
                  {a.severity}
                </span>
              </motion.div>
            );
          })}
        </div>
      </Card>
    );
  };

  /* ─── Categories Tab ─── */
  const renderCategories = (data: IntelligenceSummary) => {
    const cats = data.categories.items;
    if (cats.length === 0) return <Card className="p-12 text-center text-muted-foreground">No category data.</Card>;
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-bold mb-4">Value Distribution</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cats.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => [`₹${v?.toLocaleString()}`, "Stock Value"]} />
                <Bar dataKey="value" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold mb-4">Category Table</h3>
          <div className="overflow-y-auto max-h-[300px]">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase font-bold text-muted-foreground">
                <tr>
                  <th className="pb-2">Category</th>
                  <th className="pb-2 text-right">Products</th>
                  <th className="pb-2 text-right">Units</th>
                  <th className="pb-2 text-right">Value</th>
                  <th className="pb-2 text-right">Margin</th>
                  <th className="pb-2 text-right">Dead</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {cats.map(c => (
                  <tr key={c.category}>
                    <td className="py-2 font-bold text-xs">{c.category}</td>
                    <td className="py-2 text-right text-xs">{c.product_count}</td>
                    <td className="py-2 text-right text-xs font-mono">{c.units}</td>
                    <td className="py-2 text-right text-xs font-mono">{currency.symbol}{c.value.toLocaleString()}</td>
                    <td className="py-2 text-right text-xs">{c.margin_pct.toFixed(0)}%</td>
                    <td className="py-2 text-right text-xs">{c.dead_value > 0 ? `₹${c.dead_value.toLocaleString()}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  };

  /* ─── Tab Content Router ─── */
  const renderTab = () => {
    if (!data) return null;
    switch (activeTab) {
      case "overview": return renderOverview(data);
      case "deadstock": return renderDeadStock(data);
      case "reorder": return renderReorder(data);
      case "abc": return renderABC(data);
      case "anomalies": return renderAnomalies(data);
      case "categories": return renderCategories(data);
    }
  };

  /* ─── Main ─── */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 className="size-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Running inventory intelligence analysis...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">No data available. Add products to get intelligence.</p>
      </Card>
    );
  }

  const h = data.health;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Inventory Intelligence
          </h2>
          <p className="text-sm text-muted-foreground">
            AI-powered analysis · {h.total_products} products · {currency.symbol}{h.total_value.toLocaleString()} stock value · Generated {new Date(data.generated_at).toLocaleTimeString()}
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`size-4 mr-2 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold whitespace-nowrap transition border-b-2 -mb-[1px]
                ${activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <Icon className="size-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}>
          {renderTab()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
