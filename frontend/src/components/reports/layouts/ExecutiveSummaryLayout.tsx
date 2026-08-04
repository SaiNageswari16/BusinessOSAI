import React from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { DashboardLayoutProps } from "./LayoutTypes";

export function ExecutiveSummaryLayout({ reportData, filteredTableData, getKpiIcon }: DashboardLayoutProps) {
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
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              {chartConfig.keys.map(c => (
                <linearGradient key={`exec-${c.key}`} id={`exec-${c.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={c.color} stopOpacity={0.6} />
                  <stop offset="95%" stopColor={c.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" vertical={false} />
            <XAxis dataKey="name" stroke="currentColor" className="text-muted-foreground text-[11px]" tickLine={false} axisLine={false} />
            <YAxis stroke="currentColor" className="text-muted-foreground text-[11px]" tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
            <Tooltip contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px", color: "var(--foreground)" }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", paddingTop: "20px" }} />
            {chartConfig.keys.map((c) => (
              <Area key={c.key} type="monotone" dataKey={c.key} name={c.label} stroke={c.color} strokeWidth={3} fill={`url(#exec-${c.key})`} />
            ))}
          </AreaChart>
        );
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Top Section: AI Summary (Huge font, focal point) */}
      <div className="text-center space-y-4 py-8">
        <h2 className="text-xs font-black text-primary uppercase tracking-[0.3em]">Executive Summary</h2>
        <p className="text-xl md:text-3xl font-medium text-foreground leading-snug tracking-tight text-balance">
          "{aiSummary}"
        </p>
      </div>

      {/* Metrics Row */}
      <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12 py-6 border-y border-border/60">
        {metrics.map((metric, idx) => {
          const Icon = getKpiIcon(metric.icon);
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * idx }}
              className="flex flex-col items-center text-center min-w-[120px]"
            >
              <div className={`p-3 rounded-full mb-3 ${metric.isPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                <Icon className="size-6" />
              </div>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{metric.label}</span>
              <h3 className="text-4xl font-black text-foreground mt-2 mb-1">{metric.value}</h3>
              <p className={`text-xs font-bold ${metric.isPositive ? "text-emerald-500" : "text-red-500"}`}>
                {metric.change}
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* Chart Section */}
      <div className="bg-card border border-border/60 rounded-3xl p-6 md:p-8 shadow-sm">
        <h3 className="text-sm font-bold text-foreground mb-6 uppercase tracking-wider text-center">Trend Overview</h3>
        <div className="w-full h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-card border border-border/60 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-muted/30 text-muted-foreground">
              <tr>
                {tableColumns.map((col, i) => (
                  <th key={i} className="px-6 py-4 font-bold text-xs uppercase tracking-widest">
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredTableData.length === 0 ? (
                <tr>
                  <td colSpan={tableColumns.length} className="px-6 py-12 text-center text-muted-foreground font-medium">
                    No data available.
                  </td>
                </tr>
              ) : (
                filteredTableData.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-muted/20 transition-colors">
                    {tableColumns.map((col, cIdx) => (
                      <td key={cIdx} className="px-6 py-4 font-medium text-foreground">
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
