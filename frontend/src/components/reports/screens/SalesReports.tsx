import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { inventoryApi } from '@/lib/api-client';
import { getKpiIcon } from '@/components/reports/utils';
import { RefreshCw, Sparkles, LayoutDashboard, Users, TrendingUp, Receipt } from 'lucide-react';
import { EmployeeSalesReportSuite } from '../EmployeeSalesReportSuite';
import { useI18n } from '@/contexts/i18n-context';

export function SalesReports({ defaultTab = "employee_sales" }: { defaultTab?: "employee_sales" | "overview" }) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<"employee_sales" | "overview">(defaultTab);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const data = await inventoryApi.getReportData('sales_reports');
        setReportData(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (activeTab === "overview") {
      fetchReport();
    }
  }, [activeTab]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b pb-3">
        <button
          onClick={() => setActiveTab("employee_sales")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "employee_sales"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="size-4" />
          {t("Employee-Wise Sales Report", "Employee-Wise Sales Report")}
        </button>

        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "overview"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <TrendingUp className="size-4" />
          {t("Sales & Channel Analytics", "Sales & Channel Analytics")}
        </button>
      </div>

      {/* Render Active View */}
      {activeTab === "employee_sales" ? (
        <EmployeeSalesReportSuite />
      ) : loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-4 min-h-[500px]">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
            <RefreshCw className="w-10 h-10 text-primary animate-spin relative z-10" />
          </div>
          <p className="text-sm text-muted-foreground font-medium tracking-widest uppercase">{t("Loading Sales Analytics...", "Loading Sales Analytics...")}</p>
        </div>
      ) : !reportData ? null : (
        <div className="space-y-6">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h2 className="text-xl font-bold tracking-tight">{reportData.title}</h2>
              <p className="text-xs text-muted-foreground">
                {t("Comprehensive sales revenue, POS transactions, and channel telemetry.", "Comprehensive sales revenue, POS transactions, and channel telemetry.")}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 h-full">
              <div className="bg-card border-2 border-border/60 rounded-3xl p-6 flex flex-col h-full min-h-[200px]">
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border/40">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h3 className="text-sm font-bold">{t("AI Analysis", "AI Analysis")}</h3>
                </div>
                <p className="text-base text-muted-foreground font-medium leading-relaxed italic flex-1">"{reportData.aiSummary}"</p>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {reportData.metrics.slice(0, 2).map((metric: any, idx: number) => {
                  const Icon = getKpiIcon(metric.icon);
                  return (
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
                  );
                })}
              </div>

              <div className="bg-card border border-border/50 rounded-3xl p-6 h-[300px]">
                <div className="w-full h-full min-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                      <XAxis dataKey="name" stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} width={40} />
                      <Tooltip contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px" }} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
                      {reportData.chartConfig.keys.map((c: any) => (
                        <Bar key={c.key} dataKey={c.key} fill={c.color} radius={[4, 4, 0, 0]} maxBarSize={50} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
