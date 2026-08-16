import React from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { DashboardLayoutProps } from "./LayoutTypes";
import { useCurrency } from "@/hooks/use-currency";

export function SplitDashboardLayout({ reportData, filteredTableData, getKpiIcon }: DashboardLayoutProps) {
    const { currency, formatCurrency } = useCurrency();
  const { metrics, chartData, chartConfig, tableColumns, aiSummary } = reportData;

  const renderChart = () => {
    switch (chartConfig.type) {
      case "bar":
        return (
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" vertical={false} />
            <XAxis dataKey="name" stroke="currentColor" className="text-muted-foreground text-[11px]" tickLine={false} axisLine={false} />
            <YAxis stroke="currentColor" className="text-muted-foreground text-[11px]" tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
            <Tooltip contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px", color: "var(--foreground)" }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", paddingTop: "20px" }} />
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
            <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", paddingTop: "20px" }} />
            {chartConfig.keys.map((c) => (
              <Line key={c.key} type="monotone" dataKey={c.key} name={c.label} stroke={c.color} strokeWidth={3} dot={false} />
            ))}
          </LineChart>
        );
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Side: Data Focus (Metrics + Table) */}
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4">
          {metrics.map((metric, idx) => {
            const Icon = getKpiIcon(metric.icon);
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 * idx }}
                className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm flex flex-col justify-center"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-xl ${metric.isPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                    <Icon className="size-4" />
                  </div>
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{metric.label}</span>
                </div>
                <h3 className="text-2xl font-black text-foreground">{metric.value}</h3>
              </motion.div>
            );
          })}
        </div>

        <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col max-h-[600px]">
          <div className="p-4 border-b border-border/80 bg-muted/20">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Data Ledger</h3>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-muted text-muted-foreground sticky top-0 z-10 shadow-sm">
                <tr>
                  {tableColumns.map((col, i) => (
                    <th key={i} className="px-5 py-3 font-bold text-[10px] uppercase tracking-widest border-b border-border">
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredTableData.length === 0 ? (
                  <tr>
                    <td colSpan={tableColumns.length} className="px-5 py-8 text-center text-muted-foreground text-xs">
                      No records matched the current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredTableData.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-muted/40 transition-colors">
                      {tableColumns.map((col, cIdx) => (
                        <td key={cIdx} className="px-5 py-3 text-xs text-foreground font-medium">
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

      {/* Right Side: Visual Focus (Chart + AI Summary) */}
      <div className="flex flex-col gap-6">
        <div className="bg-card border border-border/80 rounded-2xl shadow-sm p-6 flex flex-col flex-1 min-h-[400px]">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-6">Visual Analysis</h3>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-500/10 to-transparent border border-indigo-500/20 rounded-2xl shadow-sm p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-colors" />
          <h3 className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-3 relative z-10">AI Analyst Conclusion</h3>
          <p className="text-sm text-foreground leading-relaxed font-medium relative z-10">
            {aiSummary}
          </p>
        </div>
      </div>
    </div>
  );
}
