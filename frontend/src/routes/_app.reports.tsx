import React, { useState, useEffect, useRef } from "react";
import { createFileRoute, useRouterState, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, LineChart as LucideLineChart, Building2, ShoppingCart, Boxes, ArrowRightLeft,
  Warehouse, PieChart, ShoppingBag, Truck, FileCheck, Calculator,
  Users, UserCog, Tags, Radio, Store, Clock, CreditCard, Briefcase,
  Target, BrainCircuit, Skull, ShieldCheck, Settings, Activity,
  FileText, Search, Download, Sparkles, Send, Bot, User, RefreshCw,
  ChevronDown, ChevronRight, X, AlertTriangle
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

import { inventoryApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsModule,
});

// Category and Sub-category list configuration (matching navigationData)
interface ReportSubItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface ReportCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  items: ReportSubItem[];
}

const REPORT_CATEGORIES: ReportCategory[] = [
  {
    id: "sales",
    label: "Sales",
    icon: TrendingUp,
    items: [
      { id: "sales_reports", label: "Sales Reports", icon: TrendingUp },
      { id: "revenue_reports", label: "Revenue Reports", icon: LucideLineChart },
      { id: "branch_reports", label: "Branch Reports", icon: Building2 },
      { id: "pos_reports", label: "POS Reports", icon: ShoppingCart }
    ]
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: Boxes,
    items: [
      { id: "stock_reports", label: "Stock Reports", icon: Boxes },
      { id: "movement_reports", label: "Movement Reports", icon: ArrowRightLeft },
      { id: "warehouse_reports", label: "Warehouse Reports", icon: Warehouse },
      { id: "abc_analysis_reports", label: "ABC Analysis", icon: PieChart },
      { id: "xyz_analysis_reports", label: "XYZ Analysis", icon: LucideLineChart }
    ]
  },
  {
    id: "procurement",
    label: "Procurement",
    icon: ShoppingBag,
    items: [
      { id: "purchase_reports", label: "Purchase Reports", icon: ShoppingBag },
      { id: "supplier_reports", label: "Supplier Reports", icon: Truck },
      { id: "grn_reports", label: "GRN Reports", icon: FileCheck },
      { id: "spend_analysis_reports", label: "Spend Analysis", icon: Calculator }
    ]
  },
  {
    id: "crm",
    label: "CRM",
    icon: Users,
    items: [
      { id: "customer_reports", label: "Customer Reports", icon: Users },
      { id: "lead_reports", label: "Lead Reports", icon: UserCog },
      { id: "loyalty_reports", label: "Loyalty Reports", icon: Tags },
      { id: "campaign_reports", label: "Campaign Reports", icon: Radio }
    ]
  },
  {
    id: "marketplace",
    label: "Marketplace",
    icon: Store,
    items: [
      { id: "vendor_reports", label: "Vendor Reports", icon: Store },
      { id: "marketplace_revenue", label: "Marketplace Revenue", icon: LucideLineChart },
      { id: "delivery_reports", label: "Delivery Reports", icon: Truck },
      { id: "order_reports", label: "Order Reports", icon: ShoppingCart }
    ]
  },
  {
    id: "hr",
    label: "HR",
    icon: UserCog,
    items: [
      { id: "attendance_reports", label: "Attendance Reports", icon: Clock },
      { id: "payroll_reports", label: "Payroll Reports", icon: CreditCard },
      { id: "recruitment_reports", label: "Recruitment Reports", icon: Briefcase },
      { id: "performance_reports", label: "Performance Reports", icon: Target }
    ]
  },
  {
    id: "finance",
    label: "Finance",
    icon: Calculator,
    items: [
      { id: "pnl_reports", label: "P&L", icon: FileCheck },
      { id: "balance_sheet_reports", label: "Balance Sheet", icon: FileCheck },
      { id: "cash_flow_reports", label: "Cash Flow", icon: FileCheck },
      { id: "gst_reports", label: "GST Reports", icon: FileCheck },
      { id: "expense_reports", label: "Expense Reports", icon: CreditCard }
    ]
  },
  {
    id: "ai_analytics",
    label: "AI Analytics",
    icon: BrainCircuit,
    items: [
      { id: "revenue_prediction", label: "Revenue Prediction", icon: TrendingUp },
      { id: "demand_forecast_reports", label: "Demand Forecast", icon: TrendingUp },
      { id: "inventory_forecast", label: "Inventory Forecast", icon: Boxes },
      { id: "customer_prediction", label: "Customer Prediction", icon: Users },
      { id: "attrition_prediction_reports", label: "Attrition Prediction", icon: Skull },
      { id: "fraud_detection_reports", label: "Fraud Detection", icon: ShieldCheck }
    ]
  },
  {
    id: "report_builder",
    label: "Report Builder",
    icon: Settings,
    items: [
      { id: "custom_reports", label: "Custom Reports", icon: Settings },
      { id: "saved_reports", label: "Saved Reports", icon: FileCheck },
      { id: "scheduled_reports", label: "Scheduled Reports", icon: Clock },
      { id: "exports", label: "Exports", icon: FileCheck }
    ]
  }
];

function ReportsModule() {
  const routerState = useRouterState();
  const navigate = useNavigate();
  const searchStr = routerState.location.searchStr;

  // Resolve current active tab from query parameters (?tab=)
  let activeTab = "sales_reports";
  if (searchStr.includes("tab=")) {
    const params = new URLSearchParams(searchStr);
    activeTab = params.get("tab") || "sales_reports";
  }

  // Find corresponding category to expand accordion
  const currentCategory = REPORT_CATEGORIES.find(cat =>
    cat.items.some(sub => sub.id === activeTab)
  );

  const [expandedCategory, setExpandedCategory] = useState<string | null>(
    currentCategory ? currentCategory.id : "sales"
  );
  
  // States for report data and UI interactions
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // AI Copilot Sidebar States
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "ai" | "user"; text: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [consulting, setConsulting] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch report config & data from backend
  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await inventoryApi.getReportData(activeTab);
      setReportData(data);
      // Pre-populate AI introductory message
      setChatMessages([
        {
          sender: "ai",
          text: `Hello! I am your AI Business Analyst. I have successfully loaded the **${data.title}** dashboard. ${data.aiSummary || ""}\n\nWhat details would you like me to analyze for you?`
        }
      ]);
    } catch (err: any) {
      console.error(err);
      setError("Failed to sync live database reports. Please verify backend connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeTab]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, consulting]);

  // Expand category or toggle
  const toggleCategory = (catId: string) => {
    setExpandedCategory(prev => (prev === catId ? null : catId));
  };

  // Navigating to sub-item
  const selectSubTab = (subId: string) => {
    navigate({ to: "/reports", search: { tab: subId } });
  };

  // Filtered rows matching search query
  const getFilteredRows = () => {
    if (!reportData || !reportData.tableData) return [];
    if (!searchQuery.trim()) return reportData.tableData;
    
    return reportData.tableData.filter((row: any) =>
      Object.values(row).some((val: any) =>
        String(val).toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!reportData || !reportData.tableData) return;
    const headers = reportData.tableColumns.map((c: any) => c.header).join(",");
    const rows = reportData.tableData.map((row: any) =>
      reportData.tableColumns.map((col: any) => `"${String(row[col.key] || "").replace(/"/g, '""')}"`).join(",")
    );
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${activeTab}_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Submit query to AI Analyst Copilot
  const handleSendAiMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || consulting) return;
    
    const userText = chatInput.trim();
    setChatMessages(prev => [...prev, { sender: "user", text: userText }]);
    setChatInput("");
    setConsulting(true);
    
    try {
      const response = await inventoryApi.consultAIReport(activeTab, userText, reportData);
      setChatMessages(prev => [...prev, { sender: "ai", text: response.answer }]);
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [
        ...prev, 
        { sender: "ai", text: "Error consulting AI assistant. Please confirm model keys and network status." }
      ]);
    } finally {
      setConsulting(false);
    }
  };

  // KPI Metric Icons resolver
  const getKpiIcon = (iconName: string) => {
    switch (iconName) {
      case "trending-up": return TrendingUp;
      case "shopping-cart": return ShoppingCart;
      case "boxes": return Boxes;
      case "percent": return Tags;
      case "users": return Users;
      default: return Activity;
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground overflow-hidden font-sans">
      {/* 1. SIDEBAR SUB-NAVIGATION */}
      <aside className="w-80 border-r border-border bg-card/65 backdrop-blur-md flex flex-col h-full shrink-0">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20">
            <BrainCircuit className="size-6 text-white" />
          </div>
          <div>
            <h2 className="font-extrabold text-base tracking-tight text-foreground">IOTRONCS Retail</h2>
            <span className="text-xs font-semibold text-primary">Analytics & Intelligence</span>
          </div>
        </div>

        {/* Scrollable Accordion Categories list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {REPORT_CATEGORIES.map(category => {
            const IconComponent = category.icon;
            const isExpanded = expandedCategory === category.id;
            const hasActiveSub = category.items.some(sub => sub.id === activeTab);

            return (
              <div key={category.id} className="rounded-xl overflow-hidden border border-border/40 bg-card/30">
                <button
                  onClick={() => toggleCategory(category.id)}
                  className={cn(
                    "w-full px-4 py-3 flex items-center justify-between text-sm font-semibold transition-all hover:bg-muted/40",
                    hasActiveSub ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <IconComponent className="size-4.5 shrink-0" />
                    <span>{category.label}</span>
                  </div>
                  {isExpanded ? <ChevronDown className="size-4 text-muted-foreground/60" /> : <ChevronRight className="size-4 text-muted-foreground/60" />}
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      className="overflow-hidden bg-background/40 border-t border-border/30"
                    >
                      <div className="p-1.5 space-y-1">
                        {category.items.map(subItem => {
                          const SubIcon = subItem.icon;
                          const isActive = activeTab === subItem.id;
                          
                          return (
                            <button
                              key={subItem.id}
                              onClick={() => selectSubTab(subItem.id)}
                              className={cn(
                                "w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-all",
                                isActive 
                                  ? "bg-gradient-to-r from-primary to-primary/80 text-white shadow-md shadow-primary/10" 
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                              )}
                            >
                              <SubIcon className="size-4 shrink-0" />
                              <span>{subItem.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </aside>

      {/* 2. MAIN REPORT PAGE AREA */}
      <main className="flex-1 overflow-y-auto flex flex-col h-full bg-background/50 relative">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="size-10 text-primary animate-spin" />
            <p className="text-sm font-semibold text-muted-foreground">Fetching live database integrations...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="p-4 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
              <AlertTriangle className="size-12" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Database Sync Intercepted</h3>
            <p className="text-muted-foreground max-w-md text-sm">{error}</p>
            <button onClick={fetchReport} className="px-5 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-sm font-bold transition-all">
              Retry Sourcing
            </button>
          </div>
        ) : (
          <div className="p-6 md:p-8 space-y-8 max-w-screen-2xl mx-auto w-full">
            {/* Header Title bar */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/80 pb-6">
              <div>
                <span className="text-xs font-bold text-primary uppercase tracking-widest">Intelligence Reporting</span>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground mt-1">{reportData.title}</h1>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={fetchReport}
                  className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground transition-all"
                  title="Reload Live Metrics"
                >
                  <RefreshCw className="size-5" />
                </button>
                <button
                  onClick={handleExportCSV}
                  className="px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-sm font-semibold text-muted-foreground flex items-center gap-2 transition-all"
                >
                  <Download className="size-4" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={() => setAiSidebarOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:brightness-110 text-sm font-bold text-white shadow-lg shadow-primary/25 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Sparkles className="size-4 text-white" />
                  <span>Consult AI Analyst</span>
                </button>
              </div>
            </div>

            {/* KPI Metric summary grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {reportData.metrics.map((metric: any, idx: number) => {
                const IconComp = getKpiIcon(metric.icon);
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * idx }}
                    className="p-6 rounded-2xl border border-border bg-card hover:border-border/80 transition-all duration-300 group"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className={cn(
                        "p-3 rounded-xl bg-muted border border-border/30",
                        metric.isPositive ? "text-primary" : "text-rose-500"
                      )}>
                        <IconComp className="size-5" />
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground">{metric.label}</span>
                    <p className="text-3xl font-extrabold text-foreground mt-1 group-hover:text-primary transition-colors">
                      {metric.value}
                    </p>
                    <span className={cn(
                      "text-xs font-bold mt-2.5 block",
                      metric.isPositive ? "text-emerald-500" : "text-rose-500"
                    )}>
                      {metric.change}
                    </span>
                  </motion.div>
                );
              })}
            </div>

            {/* Visualizer Recharts Panel */}
            <div className="p-6 rounded-2xl border border-border bg-card shadow-sm">
              <h3 className="text-lg font-bold text-foreground mb-6">Interactive Distribution Analytics</h3>
              <ReportsChart config={reportData.chartConfig} data={reportData.chartData} />
            </div>

            {/* Grid Table for Database values */}
            <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <h3 className="text-lg font-bold text-foreground">Aggregated Live Records Log</h3>
                
                {/* Local search input */}
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search logs..."
                    className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:border-primary text-foreground"
                  />
                </div>
              </div>

              {/* Responsive Table */}
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/65 border-b border-border text-xs font-bold text-muted-foreground uppercase">
                      {reportData.tableColumns.map((col: any) => (
                        <th key={col.key} className="px-6 py-4">{col.header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-sm text-foreground">
                    {getFilteredRows().length === 0 ? (
                      <tr>
                        <td colSpan={reportData.tableColumns.length} className="px-6 py-12 text-center text-muted-foreground font-semibold">
                          No matching records found in this context.
                        </td>
                      </tr>
                    ) : (
                      getFilteredRows().map((row: any, rIdx: number) => (
                        <tr key={rIdx} className="hover:bg-muted/10 transition-colors">
                          {reportData.tableColumns.map((col: any) => (
                            <td key={col.key} className="px-6 py-4.5 whitespace-nowrap">{row[col.key]}</td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3. AI CONSULTANT FLOATING DRAWER PANEL */}
      <AnimatePresence>
        {aiSidebarOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.2 }}
              exit={{ opacity: 0 }}
              onClick={() => setAiSidebarOpen(false)}
              className="fixed inset-0 bg-black z-40"
            />

            {/* Chat drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-120 bg-card border-l border-border shadow-2xl z-50 flex flex-col"
            >
              {/* Drawer Header */}
              <div className="p-5 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Sparkles className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-foreground">AI Analyst Copilot</h3>
                    <span className="text-xs font-semibold text-muted-foreground">Context: {reportData?.title}</span>
                  </div>
                </div>
                <button
                  onClick={() => setAiSidebarOpen(false)}
                  className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Chat Message List */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={cn("flex gap-3", msg.sender === "user" ? "justify-end" : "justify-start")}>
                    {msg.sender === "ai" && (
                      <div className="size-8.5 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                        <Bot className="size-4.5" />
                      </div>
                    )}
                    
                    <div className={cn(
                      "p-4 rounded-2xl max-w-[82%] text-[13px] leading-relaxed shadow-sm",
                      msg.sender === "user" 
                        ? "bg-primary text-white rounded-tr-none" 
                        : "bg-muted/50 border border-border/80 text-foreground rounded-tl-none markdown-preview"
                    )}>
                      {msg.text.split("\n").map((line, lIdx) => (
                        <p key={lIdx} className={cn(line ? "mb-2" : "mb-3")}>
                          {line}
                        </p>
                      ))}
                    </div>

                    {msg.sender === "user" && (
                      <div className="size-8.5 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                        <User className="size-4.5" />
                      </div>
                    )}
                  </div>
                ))}
                
                {consulting && (
                  <div className="flex gap-3 justify-start">
                    <div className="size-8.5 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                      <Bot className="size-4.5" />
                    </div>
                    <div className="p-4 rounded-2xl bg-muted/50 border border-border/80 text-muted-foreground rounded-tl-none flex items-center gap-2">
                      <RefreshCw className="size-4.5 animate-spin text-primary" />
                      <span className="text-xs font-semibold">Running database AI projections...</span>
                    </div>
                  </div>
                )}
                
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input panel */}
              <form onSubmit={handleSendAiMessage} className="p-4 border-t border-border bg-card/90">
                {/* Prompt suggestion chips */}
                <div className="flex gap-2 mb-3.5 overflow-x-auto pb-1.5 scrollbar-thin select-none">
                  {["Analyse anomalies", "Suggest action plan", "Forecast next cycle"].map((chip, cIdx) => (
                    <button
                      key={cIdx}
                      type="button"
                      onClick={() => setChatInput(chip)}
                      className="px-3 py-1.5 rounded-lg bg-muted border border-border text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted/80 shrink-0 transition-all cursor-pointer"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder="Ask about this report..."
                    className="w-full pl-4 pr-12 py-3 rounded-xl border border-border bg-background focus:outline-none focus:border-primary text-foreground text-xs font-medium"
                    disabled={consulting}
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-primary text-white transition-all disabled:opacity-50 cursor-pointer"
                    disabled={!chatInput.trim() || consulting}
                  >
                    <Send className="size-4" />
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-component wrapper for loading correct Recharts types
function ReportsChart({ config, data }: { config: any; data: any[] }) {
  if (!data || data.length === 0) return null;
  const chartType = config.type || "line";
  const keys = config.keys || [];

  const renderChart = () => {
    switch (chartType) {
      case "area":
        return (
          <AreaChart data={data}>
            <defs>
              {keys.map((k: any) => (
                <linearGradient key={k.key} id={`color-${k.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={k.color} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={k.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.2} />
            <XAxis dataKey="name" stroke="#64748b" fontSize={11} fontWeight={600} tickLine={false} />
            <YAxis stroke="#64748b" fontSize={11} fontWeight={600} tickLine={false} />
            <Tooltip contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--card-foreground)", borderRadius: "12px" }} />
            <Legend wrapperStyle={{ fontSize: "11px", fontWeight: 600 }} />
            {keys.map((k: any) => (
              <Area key={k.key} type="monotone" dataKey={k.key} stroke={k.color} fill={`url(#color-${k.key})`} strokeWidth={2.5} name={k.label} />
            ))}
          </AreaChart>
        );
      case "bar":
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.2} />
            <XAxis dataKey="name" stroke="#64748b" fontSize={11} fontWeight={600} tickLine={false} />
            <YAxis stroke="#64748b" fontSize={11} fontWeight={600} tickLine={false} />
            <Tooltip contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--card-foreground)", borderRadius: "12px" }} />
            <Legend wrapperStyle={{ fontSize: "11px", fontWeight: 600 }} />
            {keys.map((k: any) => (
              <Bar key={k.key} dataKey={k.key} fill={k.color} radius={[6, 6, 0, 0]} name={k.label} />
            ))}
          </BarChart>
        );
      case "scatter":
        return (
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.2} />
            <XAxis type="number" dataKey="tenure" name="Tenure" unit="m" stroke="#64748b" fontSize={11} fontWeight={600} tickLine={false} />
            <YAxis type="number" dataKey="rating" name="Rating" stroke="#64748b" fontSize={11} fontWeight={600} tickLine={false} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--card-foreground)", borderRadius: "12px" }} />
            <Legend wrapperStyle={{ fontSize: "11px", fontWeight: 600 }} />
            <Scatter name="Staff Level" data={data} fill="var(--primary)" />
          </ScatterChart>
        );
      case "line":
      default:
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.2} />
            <XAxis dataKey="name" stroke="#64748b" fontSize={11} fontWeight={600} tickLine={false} />
            <YAxis stroke="#64748b" fontSize={11} fontWeight={600} tickLine={false} />
            <Tooltip contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--card-foreground)", borderRadius: "12px" }} />
            <Legend wrapperStyle={{ fontSize: "11px", fontWeight: 600 }} />
            {keys.map((k: any) => (
              <Line key={k.key} type="monotone" dataKey={k.key} stroke={k.color} strokeWidth={2.5} activeDot={{ r: 5 }} name={k.label} />
            ))}
          </LineChart>
        );
    }
  };

  return (
    <ResponsiveContainer width="100%" height={360}>
      {renderChart()}
    </ResponsiveContainer>
  );
}
