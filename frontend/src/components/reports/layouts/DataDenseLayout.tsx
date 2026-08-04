import React from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { DashboardLayoutProps } from "./LayoutTypes";

export function DataDenseLayout({ reportData, filteredTableData, getKpiIcon }: DashboardLayoutProps) {
  const { metrics, chartData, chartConfig, tableColumns, aiSummary } = reportData;

  const renderChart = () => {
    switch (chartConfig.type) {
      case "bar":
        return (
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <Tooltip cursor={{ fill: "transparent" }} contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px", fontSize: "11px", color: "var(--foreground)" }} />
            {chartConfig.keys.map((c) => (
              <Bar key={c.key} dataKey={c.key} fill={c.color} radius={[2, 2, 0, 0]} />
            ))}
          </BarChart>
        );
      case "line":
      case "area":
      default:
        return (
          <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              {chartConfig.keys.map(c => (
                <linearGradient key={`dense-${c.key}`} id={`dense-${c.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={c.color} stopOpacity={0.5} />
                  <stop offset="95%" stopColor={c.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <Tooltip contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px", fontSize: "11px", color: "var(--foreground)" }} />
            {chartConfig.keys.map((c) => (
              <Area key={c.key} type="monotone" dataKey={c.key} stroke={c.color} strokeWidth={2} fill={`url(#dense-${c.key})`} />
            ))}
          </AreaChart>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Top row: Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((metric, idx) => {
          const Icon = getKpiIcon(metric.icon);
          return (
            <div key={idx} className="bg-card border border-border/80 rounded-lg p-4 shadow-sm flex items-center gap-4">
              <div className={`p-3 rounded-md ${metric.isPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                <Icon className="size-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{metric.label}</span>
                <h3 className="text-xl font-black text-foreground leading-tight">{metric.value}</h3>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Left Side: Massive Table */}
        <div className="xl:col-span-3 bg-card border border-border/80 rounded-lg shadow-sm flex flex-col h-[600px]">
          <div className="p-4 border-b border-border/80 bg-muted/20">
            <h3 className="text-sm font-bold text-foreground">Detailed Records</h3>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-muted text-muted-foreground sticky top-0 z-10 shadow-sm">
                <tr>
                  {tableColumns.map((col, i) => (
                    <th key={i} className="px-4 py-3 font-bold text-[10px] uppercase tracking-widest border-b border-border">
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredTableData.length === 0 ? (
                  <tr>
                    <td colSpan={tableColumns.length} className="px-4 py-8 text-center text-muted-foreground text-xs">
                      No records matched the current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredTableData.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-muted/40 transition-colors even:bg-muted/10">
                      {tableColumns.map((col, cIdx) => (
                        <td key={cIdx} className="px-4 py-2.5 text-xs text-foreground font-medium">
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

        {/* Right Side: Mini Chart & AI Summary */}
        <div className="flex flex-col gap-4">
          {/* Mini Chart */}
          <div className="bg-card border border-border/80 rounded-lg shadow-sm p-4 h-[250px] flex flex-col">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Quick Trend</h3>
            <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {renderChart()}
              </ResponsiveContainer>
            </div>
          </div>

          {/* AI Summary Block */}
          <div className="bg-gradient-to-b from-card to-primary/5 border border-primary/20 rounded-lg shadow-sm p-5 flex-1 flex flex-col">
            <h3 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-3">AI Synthesis</h3>
            <p className="text-xs text-foreground/80 leading-relaxed font-medium">
              {aiSummary}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
