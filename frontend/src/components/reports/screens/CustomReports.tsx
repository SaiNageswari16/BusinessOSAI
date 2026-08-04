import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { inventoryApi } from '@/lib/api-client';
import { getKpiIcon } from '@/components/reports/utils';
import { RefreshCw, Sparkles, LayoutDashboard } from 'lucide-react';

export function CustomReports() {
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const data = await inventoryApi.getReportData('custom_reports');
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
      
      <div className="space-y-6">
        
      <div className="pl-4 border-l-4 border-primary py-2 my-2">
        <p className="text-lg md:text-xl font-medium text-foreground">"{aiSummary}"</p>
        <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mt-2 flex items-center gap-1"><Sparkles className="w-3 h-3"/> AI Summary</p>
      </div>
    
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric: any, idx: number) => {
            const Icon = getKpiIcon(metric.icon);
            return (
      <motion.div key={idx} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * idx }} className="bg-card/40 backdrop-blur-md border border-border/40 rounded-3xl p-5 flex flex-col justify-between min-h-[140px]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-muted-foreground truncate mr-2">{metric.label}</span>
          <Icon className="w-5 h-5 text-primary opacity-80 shrink-0" />
        </div>
        <div>
          <h3 className="text-2xl lg:text-3xl font-bold text-foreground truncate">{metric.value}</h3>
          <p className={"text-xs font-medium mt-1 truncate " + (metric.isPositive ? "text-emerald-500" : "text-red-500")}>{metric.change}</p>
        </div>
      </motion.div>
    );
          })}
        </div>
        <div className="bg-card border border-border/50 rounded-3xl p-6 h-[400px]">
          
      <div className="w-full h-full min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              {chartConfig.keys.map((c: any) => (
                <linearGradient key={c.key + "-grad"} id={c.key + "-grad"} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={c.color} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={c.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
            <XAxis dataKey="name" stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px" }} />
            {chartConfig.keys.map((c: any) => (
              <Area key={c.key} type="monotone" dataKey={c.key} stroke={c.color} strokeWidth={3} fill={"url(#" + c.key + "-grad)"} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    
        </div>
        
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
