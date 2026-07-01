import React from "react";
import { motion } from "framer-motion";
import { Grid3X3, Users } from "lucide-react";

// RFM Segment definitions
const rfmSegments = [
  { label: "Champions", r: 5, f: 5, m: 5, count: 420, revenue: "$5.2M", color: "bg-emerald-500", description: "Bought recently, buy often, and spend the most." },
  { label: "Loyal Customers", r: 4, f: 4, m: 4, count: 850, revenue: "$3.8M", color: "bg-teal-500", description: "Regular buyers with strong engagement." },
  { label: "Potential Loyalists", r: 5, f: 2, m: 3, count: 1240, revenue: "$2.1M", color: "bg-blue-500", description: "Recent customers showing strong buying intent." },
  { label: "At Risk", r: 2, f: 4, m: 3, count: 620, revenue: "$1.4M", color: "bg-amber-500", description: "High frequency buyers who haven't purchased recently." },
  { label: "Hibernating", r: 1, f: 2, m: 2, count: 2400, revenue: "$450K", color: "bg-slate-400", description: "Low activity, haven't bought in a long time." },
  { label: "Lost Customers", r: 1, f: 1, m: 1, count: 1850, revenue: "$120K", color: "bg-red-400", description: "Lowest scores across all three dimensions." },
  { label: "Promising", r: 4, f: 1, m: 2, count: 780, revenue: "$890K", color: "bg-indigo-500", description: "First-time buyers with recent activity." },
  { label: "New Customers", r: 5, f: 1, m: 1, count: 945, revenue: "$320K", color: "bg-purple-400", description: "Just joined, first purchase made." },
  { label: "Need Attention", r: 3, f: 3, m: 2, count: 520, revenue: "$680K", color: "bg-orange-400", description: "Average on all metrics, need nurturing." },
];

// Simple 5x5 heatmap data
const heatmapData = Array.from({ length: 5 }, (_, ri) =>
  Array.from({ length: 5 }, (_, fi) => {
    const r = 5 - ri;
    const f = fi + 1;
    const seg = rfmSegments.find(s => s.r === r && s.f === f);
    return { r, f, seg };
  })
);

const cellIntensity = (r: number, f: number) => (r + f) / 10;

export function RfmAnalysis() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">RFM Analysis</h1>
        <p className="text-sm text-muted-foreground">
          Segment customers by <strong>Recency</strong> (when they last bought),{" "}
          <strong>Frequency</strong> (how often), and <strong>Monetary</strong> value (how much they spend).
        </p>
      </div>

      {/* RFM Matrix */}
      <div className="glass-panel p-6 rounded-xl border border-border/50">
        <h2 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
          <Grid3X3 className="size-5 text-primary" /> RFM Heatmap Matrix
        </h2>
        <div className="flex flex-col items-center gap-2">
          {/* Y-axis label */}
          <div className="w-full flex gap-2">
            <div className="flex flex-col items-center justify-center w-10 gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
              Recency →
            </div>
            <div className="flex-1">
              {/* Column headers */}
              <div className="grid grid-cols-5 gap-1.5 mb-1.5 ml-0">
                {[1, 2, 3, 4, 5].map(f => (
                  <div key={f} className="text-center text-[10px] text-muted-foreground font-medium">F={f}</div>
                ))}
              </div>
              {/* Grid */}
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
                          {cell.seg && (
                            <p className="text-[9px] font-bold text-foreground leading-tight">{cell.seg.label}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground font-medium mt-1">R={cell.r} F={cell.f}</p>
                        </div>
                        {/* Tooltip */}
                        {cell.seg && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-background border border-border rounded-lg shadow-xl p-3 text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                            <p className="font-bold text-foreground mb-1">{cell.seg.label}</p>
                            <p className="text-muted-foreground">{cell.seg.description}</p>
                            <div className="flex justify-between mt-2 pt-2 border-t border-border">
                              <span>Customers: <strong>{cell.seg.count.toLocaleString()}</strong></span>
                              <span className="text-primary font-semibold">{cell.seg.revenue}</span>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                ))}
              </div>
              {/* X-axis label */}
              <div className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-2">
                ← Frequency →
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Segment cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rfmSegments.map((seg, i) => (
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
              <span className="text-xs font-bold text-primary">{seg.revenue}</span>
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
    </div>
  );
}
