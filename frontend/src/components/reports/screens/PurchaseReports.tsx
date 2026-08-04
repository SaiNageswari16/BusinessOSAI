import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { inventoryApi } from '@/lib/api-client';
import { getKpiIcon } from '@/components/reports/utils';
import { RefreshCw, Sparkles, LayoutDashboard } from 'lucide-react';

export function PurchaseReports() {
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const data = await inventoryApi.getReportData('purchase_reports');
        setReportData(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, []);

  if (loading) return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-4 min-h-[500px]">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
        <RefreshCw className="w-10 h-10 text-primary animate-spin relative z-10" />
      </div>
      <p className="text-sm text-muted-foreground font-medium tracking-widest uppercase">Building Architecture...</p>
    </div>
  );

  if (!reportData) return null;
  const { metrics, chartData, chartConfig, tableColumns, tableData, aiSummary, title } = reportData;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">
             View and manage {title.toLowerCase()} analytics and insights.
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 h-full">
          
      <div className="bg-card border-2 border-border/60 rounded-3xl p-6 flex flex-col h-full min-h-[200px]">
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border/40">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-bold">AI Analysis</h3>
        </div>
        <p className="text-base text-muted-foreground font-medium leading-relaxed italic flex-1">"{aiSummary}"</p>
        <div className="mt-6 pt-4 border-t border-border/40">
          <button className="w-full py-2 bg-muted/50 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-muted transition-colors">Ask AI Follow-up</button>
        </div>
      </div>
    
        </div>
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {metrics.slice(0,2).map((metric: any, idx: number) => {
              const Icon = getKpiIcon(metric.icon);
              return (
                <div key={idx}>
                  
      <motion.div key={idx} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 * idx }} className="bg-muted/30 border-2 border-border/50 rounded-2xl p-5 min-h-[140px] flex flex-col justify-between">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-background p-2 rounded-xl shadow-sm border border-border/50 shrink-0"><Icon className="w-4 h-4" /></div>
          <span className="text-xs font-bold uppercase tracking-wider truncate">{metric.label}</span>
        </div>
        <div>
          <h3 className="text-2xl font-black text-foreground mb-1 truncate">{metric.value}</h3>
          <span className={"inline-flex px-2 py-1 rounded-md text-[10px] font-bold uppercase truncate " + (metric.isPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500")}>{metric.change}</span>
        </div>
      </motion.div>
    
                </div>
              );
            })}
          </div>
          <div className="bg-card border border-border/50 rounded-3xl p-6 h-[300px]">
             
      <div className="w-full h-full min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
            <XAxis dataKey="name" stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px" }} />
            {chartConfig.keys.map((c: any) => (
              <Line key={c.key} type="bump" dataKey={c.key} stroke={c.color} strokeWidth={4} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    
          </div>
        </div>
      </div>
      <div className="mt-6">
        
    <div className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-border/50 bg-muted/20">
        <h3 className="text-sm font-bold text-foreground">Data Detail View</h3>
      </div>
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              {tableColumns.map((col: any, i: number) => (
                <th key={i} className="px-6 py-4 font-bold text-xs uppercase tracking-wider border-b border-border/50">{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {tableData.slice(0, 15).map((row: any, rIdx: number) => (
              <tr key={rIdx} className="hover:bg-muted/30 transition-colors">
                {tableColumns.map((col: any, cIdx: number) => (
                  <td key={cIdx} className="px-6 py-4 font-medium text-foreground/90">{row[col.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  
      </div>
    
    </div>
  );
}
