import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard, FileText, Settings, Activity, Search,
  Download, Plus, RefreshCw, Filter, CheckCircle2, TrendingUp,
  Layers, ShieldCheck, Database
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";

interface MockScreenProps {
  title: string;
  description?: string;
  type?: "crm" | "accounting" | "analytics" | "settings";
}

const mockChartData = [
  { month: "Jan", volume: 420, revenue: 12500, score: 92 },
  { month: "Feb", volume: 580, revenue: 18200, score: 94 },
  { month: "Mar", volume: 710, revenue: 24000, score: 96 },
  { month: "Apr", volume: 640, revenue: 21500, score: 95 },
  { month: "May", volume: 890, revenue: 31000, score: 98 },
  { month: "Jun", volume: 1050, revenue: 38400, score: 99 },
];

export function MockScreen({ title, description, type = "crm" }: MockScreenProps) {
    const { currency, formatCurrency } = useCurrency();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const cards = [
    { title: `${title} Total Records`, value: "1,420", change: "+14.2% this month", icon: Database, isPositive: true },
    { title: "Active Operational Volume", value: "₹485,200", change: "Live sync active", icon: Activity, isPositive: true },
    { title: "Efficiency Rate", value: "98.4%", change: "+2.1% optimal performance", icon: TrendingUp, isPositive: true },
    { title: "Audit & System Health", value: "Compliant", change: "100% verified", icon: ShieldCheck, isPositive: true },
  ];

  const colors = {
    crm: "from-rose-500/20 to-rose-500/5 text-rose-600",
    accounting: "from-violet-500/20 to-violet-500/5 text-violet-600",
    analytics: "from-fuchsia-500/20 to-fuchsia-500/5 text-fuchsia-600",
    settings: "from-slate-500/20 to-slate-500/5 text-slate-600",
  };

  const tableRecords = [
    { id: `REC-101`, name: `${title} Primary Entity Alpha`, code: `REF-9021`, status: "Active", amount: "₹42,500", date: "2026-07-28" },
    { id: `REC-102`, name: `${title} Operation Beta`, code: `REF-9022`, status: "Completed", amount: "₹18,200", date: "2026-07-27" },
    { id: `REC-103`, name: `${title} Workflow Gamma`, code: `REF-9023`, status: "Active", amount: "₹95,000", date: "2026-07-26" },
    { id: `REC-104`, name: `${title} Transaction Delta`, code: `REF-9024`, status: "Pending", amount: "₹12,400", date: "2026-07-25" },
    { id: `REC-105`, name: `${title} Compliance Epsilon`, code: `REF-9025`, status: "Active", amount: "₹63,100", date: "2026-07-24" },
  ];

  const filteredRecords = tableRecords.filter((rec) => {
    const matchesSearch = rec.name.toLowerCase().includes(searchQuery.toLowerCase()) || rec.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || rec.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const handleExportCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8,ID,Name,Code,Status,Amount,Date\n" +
      tableRecords.map(r => `"${r.id}","${r.name}","${r.code}","${r.status}","${r.amount}","${r.date}"`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${title.toLowerCase().replace(/\s+/g, '_')}_records.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`${title} data exported to CSV successfully!`);
  };

  return (
    <div className="p-6 md:p-8 space-y-8 w-full max-w-screen-2xl mx-auto h-full">
      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("p-6 md:p-8 rounded-2xl border border-border/50 bg-gradient-to-br flex flex-col md:flex-row md:items-center md:justify-between gap-4", colors[type])}
      >
        <div>
          <span className="text-[10px] uppercase tracking-widest font-extrabold px-2.5 py-1 rounded-full bg-background/80 border border-border/40 inline-block mb-2">
            Module Control Center
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="text-sm opacity-80 max-w-2xl mt-1 text-foreground/90 font-medium">
            {description || `Real-time management dashboard for ${title}. Monitor operational records, trends, and execution logs.`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => toast.info(`Refreshed ${title} live data stream`)}
            className="p-2.5 rounded-xl border border-border/60 bg-background/80 hover:bg-background text-foreground text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <RefreshCw className="size-4" />
          </button>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-xl border border-border/60 bg-background/80 hover:bg-background text-foreground text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Download className="size-4" />
            <span>Export Data</span>
          </button>

          <button
            onClick={() => toast.success(`New entry dialog opened for ${title}`)}
            className="px-4 py-2.5 rounded-xl bg-primary hover:brightness-110 text-primary-foreground text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
          >
            <Plus className="size-4" />
            <span>New {title} Item</span>
          </button>
        </div>
      </motion.div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * idx }}
            className="p-6 rounded-2xl border border-border bg-card hover:shadow-md transition-all duration-300 group"
          >
            <div className="flex justify-between items-start mb-3">
              <div className={cn("p-2.5 rounded-xl bg-background border border-border/30", colors[type])}>
                <card.icon className="size-5" />
              </div>
            </div>
            <h3 className="text-xs font-semibold text-muted-foreground">{card.title}</h3>
            <p className="text-2xl font-bold mt-1 text-foreground group-hover:text-primary transition-colors">
              {card.value}
            </p>
            <span className="text-xs font-bold mt-2 block text-emerald-500">
              {card.change}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Chart & Table Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-1 p-6 rounded-2xl border border-border bg-card space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" /> {title} Volume Trend
            </h3>
            <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">6 Months</span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockChartData}>
                <defs>
                  <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="volume" stroke="var(--primary)" fillOpacity={1} fill="url(#colorVol)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Live Searchable Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 p-6 rounded-2xl border border-border bg-card space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Layers className="size-4 text-primary" /> Active {title} Records
            </h3>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search records..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-semibold text-foreground focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto border border-border/60 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border/60">
                <tr>
                  <th className="p-3">Record ID</th>
                  <th className="p-3">Item Name</th>
                  <th className="p-3">Reference Code</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Value</th>
                  <th className="p-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium">
                {filteredRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-mono text-[11px] text-primary">{rec.id}</td>
                    <td className="p-3 font-semibold text-foreground">{rec.name}</td>
                    <td className="p-3 font-mono text-muted-foreground">{rec.code}</td>
                    <td className="p-3">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                        rec.status === "Active" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" :
                        rec.status === "Completed" ? "bg-blue-500/10 text-blue-600 border border-blue-500/20" :
                        "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                      )}>
                        {rec.status}
                      </span>
                    </td>
                    <td className="p-3 text-right font-bold text-foreground">{rec.amount}</td>
                    <td className="p-3 text-right text-muted-foreground">{rec.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
