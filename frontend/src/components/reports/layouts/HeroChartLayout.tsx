import React from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { DashboardLayoutProps } from "./LayoutTypes";
import { useCurrency } from "@/hooks/use-currency";

export function HeroChartLayout({ reportData, filteredTableData, getKpiIcon }: DashboardLayoutProps) {
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
            <Tooltip
              contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px", color: "var(--foreground)" }}
              itemStyle={{ color: "var(--foreground)" }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", paddingTop: "20px" }} />
            {chartConfig.keys.map((c, i) => (
              <Bar key={c.key} dataKey={c.key} name={c.label} fill={c.color} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        );
      case "line":
        return (
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" vertical={false} />
            <XAxis dataKey="name" stroke="currentColor" className="text-muted-foreground text-[11px]" tickLine={false} axisLine={false} />
            <YAxis stroke="currentColor" className="text-muted-foreground text-[11px]" tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
            <Tooltip
              contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px", color: "var(--foreground)" }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", paddingTop: "20px" }} />
            {chartConfig.keys.map((c, i) => (
              <Line key={c.key} type="monotone" dataKey={c.key} name={c.label} stroke={c.color} strokeWidth={3} dot={false} />
            ))}
          </LineChart>
        );
      case "area":
      default:
        return (
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              {chartConfig.keys.map(c => (
                <linearGradient key={`grad-${c.key}`} id={`grad-${c.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={c.color} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={c.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" vertical={false} />
            <XAxis dataKey="name" stroke="currentColor" className="text-muted-foreground text-[11px]" tickLine={false} axisLine={false} />
            <YAxis stroke="currentColor" className="text-muted-foreground text-[11px]" tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
            <Tooltip
              contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px", color: "var(--foreground)" }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", paddingTop: "20px" }} />
            {chartConfig.keys.map((c, i) => (
              <Area key={c.key} type="monotone" dataKey={c.key} name={c.label} stroke={c.color} strokeWidth={3} fillOpacity={1} fill={`url(#grad-${c.key})`} />
            ))}
          </AreaChart>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Chart & Metrics Split */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3 bg-card border border-border/80 rounded-2xl p-6 shadow-sm flex flex-col min-h-[450px]">
          <h2 className="text-sm font-bold text-foreground mb-6 uppercase tracking-wider">Primary Trend Analysis</h2>
          <div className="flex-1 w-full min-h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Sidebar Metrics */}
        <div className="flex flex-col gap-4">
          <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
            <h3 className="text-xs font-bold text-primary uppercase mb-2">AI Summary</h3>
            <p className="text-sm text-foreground/80 leading-relaxed font-medium">
              {aiSummary}
            </p>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-1 gap-4 flex-1">
            {metrics.map((metric, idx) => {
              const Icon = getKpiIcon(metric.icon);
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * idx }}
                  className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm flex flex-col justify-center"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-muted-foreground">{metric.label}</span>
                    <div className={`p-2 rounded-lg ${metric.isPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                      <Icon className="size-4" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-black text-foreground">{metric.value}</h3>
                  <p className={`text-[11px] font-bold mt-2 ${metric.isPositive ? "text-emerald-500" : "text-red-500"}`}>
                    {metric.change}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
              <tr>
                {tableColumns.map((col, i) => (
                  <th key={i} className="px-6 py-4 font-bold text-xs uppercase tracking-wider">
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredTableData.length === 0 ? (
                <tr>
                  <td colSpan={tableColumns.length} className="px-6 py-12 text-center text-muted-foreground font-medium">
                    No records found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredTableData.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-muted/30 transition-colors">
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
