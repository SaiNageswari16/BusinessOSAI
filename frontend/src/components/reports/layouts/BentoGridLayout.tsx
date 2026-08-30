import React from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { DashboardLayoutProps } from "./LayoutTypes";
import { useCurrency } from "@/hooks/use-currency";

export function BentoGridLayout({ reportData, filteredTableData, getKpiIcon }: DashboardLayoutProps) {
    const { currency, formatCurrency } = useCurrency();
  const { metrics, chartData, chartConfig, tableColumns, aiSummary } = reportData;

  const renderChart = (height = "100%") => {
    switch (chartConfig.type) {
      case "bar":
        return (
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" vertical={false} />
            <XAxis dataKey="name" stroke="currentColor" className="text-muted-foreground text-[11px]" tickLine={false} axisLine={false} />
            <YAxis stroke="currentColor" className="text-muted-foreground text-[11px]" tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
            <Tooltip contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px", color: "var(--foreground)" }} />
            {chartConfig.keys.map((c) => (
              <Bar key={c.key} dataKey={c.key} name={c.label} fill={c.color} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        );
      case "line":
      case "area":
      default:
        return (
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" vertical={false} />
            <XAxis dataKey="name" stroke="currentColor" className="text-muted-foreground text-[11px]" tickLine={false} axisLine={false} />
            <YAxis stroke="currentColor" className="text-muted-foreground text-[11px]" tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
            <Tooltip contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px", color: "var(--foreground)" }} />
            {chartConfig.keys.map((c) => (
              <Line key={c.key} type="monotone" dataKey={c.key} name={c.label} stroke={c.color} strokeWidth={3} dot={false} />
            ))}
          </LineChart>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        
        {/* Large AI Summary Box */}
        <div className="md:col-span-2 lg:col-span-2 xl:col-span-2 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20 rounded-3xl p-6 shadow-sm flex flex-col justify-center min-h-[200px]">
          <h3 className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-3">Intelligence Insight</h3>
          <p className="text-base text-foreground leading-relaxed font-medium">
            {aiSummary}
          </p>
        </div>

        {/* Small Metrics Cards */}
        {metrics.slice(0, 2).map((metric, idx) => {
          const Icon = getKpiIcon(metric.icon);
          return (
            <motion.div
              key={idx}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 * idx }}
              className="bg-card border border-border/80 rounded-3xl p-6 shadow-sm flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-muted-foreground">{metric.label}</span>
                <div className={`p-2.5 rounded-xl ${metric.isPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                  <Icon className="size-5" />
                </div>
              </div>
              <div>
                <h3 className="text-3xl font-black text-foreground">{metric.value}</h3>
                <p className={`text-xs font-bold mt-2 ${metric.isPositive ? "text-emerald-500" : "text-red-500"}`}>
                  {metric.change}
                </p>
              </div>
            </motion.div>
          );
        })}

        {/* Main Chart Box */}
        <div className="md:col-span-2 lg:col-span-3 xl:col-span-3 bg-card border border-border/80 rounded-3xl p-6 shadow-sm min-h-[350px]">
          <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-4">Metric Visualization</h3>
          <div className="w-full h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Remaining Metrics (Stacked vertically in last column) */}
        <div className="flex flex-col gap-4 md:col-span-2 lg:col-span-3 xl:col-span-1">
          {metrics.slice(2).map((metric, idx) => {
            const Icon = getKpiIcon(metric.icon);
            return (
              <motion.div
                key={idx + 2}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * (idx + 2) }}
                className="flex-1 bg-card border border-border/80 rounded-3xl p-6 shadow-sm flex flex-col justify-center"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-xl ${metric.isPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                    <Icon className="size-4" />
                  </div>
                  <span className="text-sm font-bold text-muted-foreground">{metric.label}</span>
                </div>
                <h3 className="text-2xl font-black text-foreground">{metric.value}</h3>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-card border border-border/80 rounded-3xl overflow-hidden shadow-sm mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
              <tr>
                {tableColumns.map((col, i) => (
                  <th key={i} className="px-6 py-4 font-bold text-[10px] uppercase tracking-widest">
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredTableData.length === 0 ? (
                <tr>
                  <td colSpan={tableColumns.length} className="px-6 py-12 text-center text-muted-foreground font-medium">
                    No data available.
                  </td>
                </tr>
              ) : (
                filteredTableData.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-muted/30 transition-colors">
                    {tableColumns.map((col, cIdx) => (
                      <td key={cIdx} className="px-6 py-4 font-semibold text-foreground/90">
                        {row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
