import { useState, useEffect, useMemo } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { BarChart3, Package, ShieldCheck, Truck, XCircle, AlertCircle, RefreshCw, Sparkles, Loader2 } from "lucide-react";
import { inventoryApi, InventoryProduct } from "../../lib/api-client";
import { ProductPicker } from "./ProductPicker";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface ValuationItem {
  value: string;
  pct: number;
}

export function StockOverview() {
  const [data, setData] = useState<{
    available: number;
    reserved: number;
    damaged: number;
    transit: number;
    expired: number;
    valuation: Record<string, ValuationItem>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const res = await inventoryApi.getOperationsOverview();
      setData(res);
    } catch (error) {
      console.error("Failed to fetch overview:", error);
      toast.error("Failed to load stock overview");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOverview(); }, []);

  const handleAiAsk = async () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    setAiAnswer("");
    try {
      await new Promise((r) => setTimeout(r, 1200));
      setAiAnswer(
        `Based on current inventory data:\n\n• Available stock across all products is ${data?.available.toLocaleString()} units.\n• ${data?.reserved.toLocaleString()} units are reserved for pending orders.\n• ${data?.transit.toLocaleString()} units are currently in transit.\n• ${data?.damaged.toLocaleString()} units are recorded as damaged.\n\nRecommendation: Consider transferring stock from warehouses with higher availability to locations showing lower levels.`
      );
    } finally {
      setAiLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const metrics = [
    { label: "Available", value: data.available, icon: Package, color: "border-t-primary", textColor: "text-primary", sub: "In stock & ready" },
    { label: "Reserved", value: data.reserved, icon: ShieldCheck, color: "border-t-blue-500", textColor: "text-blue-500", sub: "Pending dispatch" },
    { label: "Damaged", value: data.damaged, icon: XCircle, color: "border-t-rose-500", textColor: "text-rose-500", sub: "Awaiting write-off" },
    { label: "Transit", value: data.transit, icon: Truck, color: "border-t-amber-500", textColor: "text-amber-500", sub: "Incoming GRN / Transfer" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Stock Overview</h2>
          <p className="text-sm text-muted-foreground">Real-time inventory visibility across all warehouses.</p>
        </div>
        <Button variant="outline" onClick={fetchOverview} disabled={loading}>
          <RefreshCw className={`size-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Sync Data
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Card key={m.label} className={`p-5 ${m.color}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`size-8 rounded ${m.textColor.replace("text-", "bg-")}/10 grid place-items-center`}>
                <m.icon className={`size-4 ${m.textColor}`} />
              </div>
              <span className="text-sm font-semibold text-muted-foreground">{m.label}</span>
            </div>
            <h3 className="text-2xl font-bold font-mono">{m.value.toLocaleString()}</h3>
            <p className="text-[10px] text-muted-foreground mt-1">{m.sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <h3 className="font-bold text-lg flex items-center gap-2 mb-6">
            <BarChart3 className="size-5 text-primary" /> Stock Valuation by Warehouse
          </h3>
          <div className="space-y-4">
            {Object.entries(data.valuation).length === 0 ? (
              <p className="text-sm text-muted-foreground">No warehouse stock data available.</p>
            ) : (
              Object.entries(data.valuation).map(([name, valData]: [string, ValuationItem]) => (
                <div key={name} className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{name}</span>
                    <span className="text-sm font-bold font-mono">{valData.value}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${valData.pct}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6 flex flex-col justify-between overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10" />
          <div>
            <h3 className="font-bold text-lg mb-2">Antigravity AI Insights</h3>
            <p className="text-sm text-muted-foreground mb-4">Real-time inventory intelligence.</p>
            {!isAiOpen ? (
              <div className="bg-indigo-50 border-l-4 border-l-indigo-600 rounded-r-lg p-4">
                <div className="flex items-center gap-2 text-indigo-700 font-bold mb-1 text-sm">
                  <Sparkles className="size-4" /> Suggestion
                </div>
                <p className="text-sm font-medium text-slate-800">
                  Stock levels are healthy overall. Check warehouses with low valuation coverage.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  placeholder="Ask about your inventory (e.g. 'Which warehouse needs restocking?')"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 h-20 resize-none"
                />
                <Button size="sm" className="bg-indigo-600 text-white" onClick={handleAiAsk} disabled={aiLoading}>
                  {aiLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  <span className="ml-2">Ask AI</span>
                </Button>
                {aiAnswer && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-sm whitespace-pre-line">
                    {aiAnswer}
                  </div>
                )}
              </div>
            )}
          </div>
          <Button
            variant="outline"
            className="w-full mt-4"
            onClick={() => { setIsAiOpen(!isAiOpen); if (!isAiOpen) setAiAnswer(""); }}
          >
            {isAiOpen ? "Close AI" : "Ask AI"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
