import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Grid3X3, Users, RefreshCw, AlertCircle } from "lucide-react";
import { crmIntelligenceApi, IntelRfm, IntelRfmSegment } from "@/lib/api-client";
import { useCurrency } from "@/hooks/use-currency";

const rfmDefinitions: Record<string, { r: number; f: number }> = {
  "Champions": { r: 5, f: 5 },
  "Loyal Customers": { r: 4, f: 4 },
  "Potential Loyalists": { r: 5, f: 2 },
  "At Risk": { r: 2, f: 4 },
  "Hibernating": { r: 1, f: 2 },
  "Lost Customers": { r: 1, f: 1 },
  "Promising": { r: 4, f: 1 },
  "New Customers": { r: 5, f: 1 },
  "Need Attention": { r: 3, f: 3 },
};

const cellIntensity = (r: number, f: number) => (r + f) / 10;

export function RfmAnalysis() {
    const { currency, formatCurrency } = useCurrency();
  const [data, setData] = useState<IntelRfm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await crmIntelligenceApi.getRfm();
      setData(res);
    } catch (e: any) {
      setError(e?.message || "Failed to load RFM analysis");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const fmt = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  };

  // Build heatmap from segments data
  const heatmapData = Array.from({ length: 5 }, (_, ri) =>
    Array.from({ length: 5 }, (_, fi) => {
      const r = 5 - ri;
      const f = fi + 1;
      const seg = data?.segments.find(s => {
        const def = rfmDefinitions[s.label];
        return def?.r === r && def?.f === f;
      });
      return { r, f, seg };
    })
  );

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-accent rounded-lg" />
        <div className="h-64 bg-accent rounded-xl" />
        <div className="grid grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 bg-accent rounded-xl" />)}</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-64 gap-4">
        <AlertCircle className="size-10 text-destructive" />
        <p className="text-muted-foreground">{error || "No RFM data available"}</p>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm">
          <RefreshCw className="size-4" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">RFM Analysis</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Segment customers by <strong>Recency</strong>, <strong>Frequency</strong>, and <strong>Monetary</strong> value computed from live purchase data.
            {data.total_customers_analysed > 0 && (
              <span className="ml-1 text-primary font-semibold">{data.total_customers_analysed} customers analysed.</span>
            )}
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 h-8 bg-accent hover:bg-accent/80 rounded-lg text-xs font-semibold text-muted-foreground transition-colors">
          <RefreshCw className="size-3.5" /> Refresh
        </button>
      </div>

      {data.total_customers_analysed === 0 ? (
        <div className="glass-panel p-10 rounded-xl border border-border/50 text-center">
          <Grid3X3 className="size-10 mx-auto text-muted-foreground opacity-30 mb-3" />
          <p className="text-muted-foreground">No purchase data available yet. RFM segments will appear once customers have made orders.</p>
        </div>
      ) : (
        <>
          {/* RFM Matrix */}
          <div className="glass-panel p-6 rounded-xl border border-border/50">
            <h2 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
              <Grid3X3 className="size-5 text-primary" /> RFM Heatmap Matrix
            </h2>
            <div className="flex flex-col items-center gap-2">
              <div className="w-full flex gap-2">
                <div className="flex flex-col items-center justify-center w-10 gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider"
                  style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
                  Recency →
                </div>
                <div className="flex-1">
                  <div className="grid grid-cols-5 gap-1.5 mb-1.5">
                    {[1, 2, 3, 4, 5].map(f => (
                      <div key={f} className="text-center text-[10px] text-muted-foreground font-medium">F={f}</div>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    {heatmapData.map((row, ri) => (
                      <div key={ri} className="grid grid-cols-5 gap-1.5">
                        {row.map((cell, fi) => (
                          <motion.div
                            key={fi}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: (ri * 5 + fi) * 0.02 }}
                            className="relative group cursor-pointer"
                            title={cell.seg?.label}
                          >
                            <div
                              className="rounded-lg h-16 flex flex-col items-center justify-center text-center p-1 transition-all hover:scale-105 hover:shadow-lg"
                              style={{
                                background: `hsla(${200 + cellIntensity(cell.r, cell.f) * 80}, ${50 + cellIntensity(cell.r, cell.f) * 30}%, ${65 - cellIntensity(cell.r, cell.f) * 30}%, ${0.2 + cellIntensity(cell.r, cell.f) * 0.7})`,
                                border: `1px solid hsla(${200 + cellIntensity(cell.r, cell.f) * 80}, 50%, 60%, 0.3)`,
                              }}
                            >
                              {cell.seg && <p className="text-[9px] font-bold text-foreground leading-tight">{cell.seg.label}</p>}
                              <p className="text-[10px] text-muted-foreground font-medium mt-1">R={cell.r} F={cell.f}</p>
                            </div>
                            {cell.seg && (
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-background border border-border rounded-lg shadow-xl p-3 text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                <p className="font-bold text-foreground mb-1">{cell.seg.label}</p>
                                <p className="text-muted-foreground">{cell.seg.description}</p>
                                <div className="flex justify-between mt-2 pt-2 border-t border-border">
                                  <span>Customers: <strong>{cell.seg.count.toLocaleString()}</strong></span>
                                  <span className="text-primary font-semibold">{fmt(cell.seg.revenue)}</span>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-2">
                    ← Frequency →
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Segment Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.segments.map((seg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="glass-panel p-5 rounded-xl border border-border/50 hover:border-primary/20 transition-all group cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`size-3 rounded-full ${seg.color} shrink-0`} />
                    <h3 className="font-semibold text-foreground">{seg.label}</h3>
                  </div>
                  <span className="text-xs font-bold text-primary">{fmt(seg.revenue)}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">{seg.description}</p>
                <div className="flex items-center gap-2 text-sm pt-3 border-t border-border/50">
                  <Users className="size-4 text-muted-foreground" />
                  <span className="font-semibold">{seg.count.toLocaleString()}</span>
                  <span className="text-muted-foreground">customers</span>
                  <button className="ml-auto text-xs text-primary font-medium hover:underline opacity-0 group-hover:opacity-100 transition-opacity">
                    Target Segment
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
