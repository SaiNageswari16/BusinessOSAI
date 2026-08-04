import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { inventoryApi } from '@/lib/api-client';
import { getKpiIcon } from '@/components/reports/utils';
import { RefreshCw, Sparkles, LayoutDashboard } from 'lucide-react';

export function SpendAnalysisReports() {
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const data = await inventoryApi.getReportData('spend_analysis_reports');
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
      
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-6 flex flex-col justify-between">
          
      <div className="bg-gradient-to-r from-blue-600/10 to-transparent border-blue-500/20 border border-border/50 rounded-3xl p-6 lg:p-8 shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start md:items-center">
          <div className="p-4 bg-background/50 backdrop-blur-sm rounded-2xl border border-border/50 shrink-0">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">AI Synthesized Intelligence</h3>
            <p className="text-xl md:text-2xl text-foreground font-semibold leading-relaxed">"{aiSummary}"</p>
          </div>
        </div>
      </div>
    
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {metrics.map((metric: any, idx: number) => {
              const Icon = getKpiIcon(metric.icon);
              return (
      <motion.div key={idx} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="group relative rounded-3xl bg-gradient-to-br from-border/50 to-border/10 p-[1px] min-h-[140px]">
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative h-full bg-card rounded-[23px] p-5 flex flex-col justify-between overflow-hidden">
          <div className="flex justify-between items-start mb-2 gap-4">
            <span className="text-xs font-bold text-muted-foreground tracking-widest uppercase truncate">{metric.label}</span>
            <Icon className={"w-4 h-4 shrink-0 " + (metric.isPositive ? "text-emerald-500" : "text-red-500")} />
          </div>
          <div>
            <h3 className="text-2xl lg:text-3xl font-black truncate">{metric.value}</h3>
            <p className="text-xs text-muted-foreground mt-1 truncate">{metric.change} vs last</p>
          </div>
        </div>
      </motion.div>
    );
            })}
          </div>
        </div>
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm flex flex-col h-[400px] xl:h-auto">
          <h3 className="text-sm font-bold mb-6 uppercase tracking-wider text-muted-foreground">Visual Analytics</h3>
          <div className="flex-1 min-h-0">
            
      <div className="w-full h-full min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
            <XAxis dataKey="name" stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px" }} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
            {chartConfig.keys.map((c: any) => (
              <Bar key={c.key} dataKey={c.key} fill={c.color} radius={[4, 4, 0, 0]} maxBarSize={50} />
            ))}
          </BarChart>
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
