import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  UserCheck,
  Calendar as CalendarIcon,
  Search,
  Filter,
  Download,
  Printer,
  RefreshCw,
  ChevronDown,
  ArrowRightLeft,
  DollarSign,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
  FileText,
  CreditCard,
  PhoneCall,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  CalendarDays,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Percent,
  Copy,
  Layers,
  Award
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { useI18n } from "@/contexts/i18n-context";
import { formatDisplayDate, formatDisplayDateTime, getTodayDateString } from "@/lib/utils";
import { inventoryApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

export function EmployeeSalesReportSuite() {
  const { t } = useI18n();
  const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();

  // View state
  const [activeView, setActiveView] = useState<"day_wise" | "detailed" | "leaderboard">("day_wise");
  const [datePreset, setDatePreset] = useState<"today" | "yesterday" | "last7" | "this_month" | "all" | "custom">("this_month");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Data state
  const [loading, setLoading] = useState<boolean>(true);
  const [reportData, setReportData] = useState<any>(null);

  // Initialize date range based on preset
  useEffect(() => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (datePreset === "today") {
      const todayStr = fmt(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (datePreset === "yesterday") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = fmt(y);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (datePreset === "last7") {
      const past = new Date(now);
      past.setDate(past.getDate() - 7);
      setStartDate(fmt(past));
      setEndDate(fmt(now));
    } else if (datePreset === "this_month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(fmt(firstDay));
      setEndDate(fmt(now));
    } else if (datePreset === "all") {
      setStartDate("");
      setEndDate("");
    }
  }, [datePreset]);

  // Fetch report data
  const loadReport = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (selectedEmployee && selectedEmployee !== "all") params.employee_id = selectedEmployee;
      if (selectedUser && selectedUser !== "all") params.user_id = selectedUser;
      if (searchQuery) params.search = searchQuery;

      const data = await inventoryApi.getEmployeeSalesReport(params);
      setReportData(data);
    } catch (err: any) {
      console.error("Failed to load employee sales report:", err);
      toast.error(err.message || "Failed to load employee sales report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport();
  }, [startDate, endDate, selectedEmployee, selectedUser]);

  // Copy helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  // Export to CSV
  const exportToCSV = () => {
    if (!reportData) return;

    let headers: string[] = [];
    let rows: string[][] = [];

    if (activeView === "day_wise") {
      headers = [
        "Date",
        "Employee Code",
        "Employee Name",
        "Department",
        "Designation",
        "Logged-in Cashier/User",
        "Invoices Count",
        "Taxable Subtotal (INR)",
        "Tax Amount (INR)",
        "Discount Amount (INR)",
        "Total Net Sales (INR)",
        "Avg Bill Value (INR)"
      ];
      rows = (reportData.day_wise_summary || []).map((r: any) => [
        `"${r.date}"`,
        `"${r.employee_code}"`,
        `"${r.employee_name}"`,
        `"${r.department}"`,
        `"${r.designation}"`,
        `"${r.login_user_name}"`,
        `${r.invoices_count}`,
        `${r.subtotal}`,
        `${r.tax_amount}`,
        `${r.discount_amount}`,
        `${r.total_sales}`,
        `${r.avg_bill_value}`
      ]);
    } else if (activeView === "leaderboard") {
      headers = [
        "Employee Code",
        "Employee Name",
        "Department",
        "Total Invoices",
        "Total Sales (INR)",
        "Avg Ticket Size (INR)",
        "Sales Share (%)"
      ];
      rows = (reportData.employee_leaderboard || []).map((r: any) => [
        `"${r.employee_code}"`,
        `"${r.employee_name}"`,
        `"${r.department}"`,
        `${r.invoices_count}`,
        `${r.total_sales}`,
        `${r.avg_ticket}`,
        `${r.percentage_share}%`
      ]);
    } else {
      headers = [
        "Invoice / Bill #",
        "Date & Time",
        "Doc Type",
        "Employee Code",
        "Employee Name",
        "Logged-in Cashier / User",
        "Customer Name",
        "Customer Phone",
        "Payment Mode",
        "Payment Status",
        "Subtotal (INR)",
        "Tax Amount (INR)",
        "Discount (INR)",
        "Total Amount (INR)"
      ];
      rows = (reportData.detailed_invoices || []).map((r: any) => [
        `"${r.invoice_number}"`,
        `"${r.date_time}"`,
        `"${r.doc_type}"`,
        `"${r.employee_code}"`,
        `"${r.employee_name}"`,
        `"${r.login_user_name}"`,
        `"${r.customer_name}"`,
        `"${r.customer_phone}"`,
        `"${r.payment_mode}"`,
        `"${r.payment_status}"`,
        `${r.subtotal}`,
        `${r.tax_amount}`,
        `${r.discount_amount}`,
        `${r.total_amount}`
      ]);
    }

    const csvContent = [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `employee_sales_report_${activeView}_${startDate || "all"}_to_${endDate || "all"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Report exported to CSV successfully");
  };

  // Print Report
  const handlePrint = () => {
    window.print();
  };

  const summary = reportData?.summary || {
    total_sales_amount: 0,
    total_invoices_count: 0,
    total_subtotal: 0,
    total_tax_amount: 0,
    total_discount_amount: 0,
    avg_ticket_size: 0,
    active_employees_count: 0,
    top_employee_name: "—",
    top_employee_sales: 0
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* ── Top Header & Description ───────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="size-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-sm">
              <Users className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                {t("Employee-Wise Sales Report", "Employee-Wise Sales Report")}
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  {t("Live Day-Wise Sync", "Live Day-Wise Sync")}
                </span>
              </h1>
              <p className="text-xs text-muted-foreground">
                {t(
                  "Track total sales made by each employee day-wise with customer details, invoice numbers, and billing cashier login names.",
                  "Track total sales made by each employee day-wise with customer details, invoice numbers, and billing cashier login names."
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={loadReport}
            disabled={loading}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            {t("Refresh", "Refresh")}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            className="h-9 gap-1.5 text-xs font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-600 border-emerald-500/30"
          >
            <FileSpreadsheet className="size-3.5 text-emerald-600" />
            {t("Export CSV", "Export CSV")}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <Printer className="size-3.5" />
            {t("Print", "Print")}
          </Button>
        </div>
      </div>

      {/* ── Filters & Controls Bar ─────────────────────────────────────── */}
      <div className="bg-card border rounded-2xl p-4 shadow-sm space-y-4">
        {/* Row 1: Date Presets & View Mode Toggle */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-muted-foreground mr-1 flex items-center gap-1">
              <CalendarDays className="size-3.5" /> {t("Date:", "Date:")}
            </span>
            {[
              { id: "today", label: "Today" },
              { id: "yesterday", label: "Yesterday" },
              { id: "last7", label: "Last 7 Days" },
              { id: "this_month", label: "This Month" },
              { id: "all", label: "All Time" },
              { id: "custom", label: "Custom Range" }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setDatePreset(p.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  datePreset === p.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                }`}
              >
                {t(p.label, p.label)}
              </button>
            ))}
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 p-1 bg-muted rounded-xl border border-border/60 self-stretch lg:self-auto">
            <button
              onClick={() => setActiveView("day_wise")}
              className={`flex-1 lg:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                activeView === "day_wise"
                  ? "bg-card text-foreground shadow-sm border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarIcon className="size-3.5" />
              {t("Day-Wise Summary", "Day-Wise Summary")}
            </button>

            <button
              onClick={() => setActiveView("detailed")}
              className={`flex-1 lg:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                activeView === "detailed"
                  ? "bg-card text-foreground shadow-sm border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Receipt className="size-3.5" />
              {t("Detailed Invoices", "Detailed Invoices")}
            </button>

            <button
              onClick={() => setActiveView("leaderboard")}
              className={`flex-1 lg:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                activeView === "leaderboard"
                  ? "bg-card text-foreground shadow-sm border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Award className="size-3.5" />
              {t("Staff Leaderboard", "Staff Leaderboard")}
            </button>
          </div>
        </div>

        {/* Row 2: Search, Custom Date Pickers, Employee & User Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadReport()}
              placeholder={t("Search Emp, Invoice, Customer...", "Search Emp, Invoice, Customer...")}
              className="w-full h-9 pl-9 pr-3 text-xs rounded-xl border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>

          {/* Filter by Employee */}
          <div>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full h-9 px-3 text-xs rounded-xl border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
            >
              <option value="all">{t("All Employees / Sales Staff", "All Employees / Sales Staff")}</option>
              {(reportData?.employees_list || []).map((emp: any) => (
                <option key={emp.id} value={emp.code}>
                  {emp.code} - {emp.name} ({emp.department})
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Logged-in Cashier / User */}
          <div>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full h-9 px-3 text-xs rounded-xl border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
            >
              <option value="all">{t("All Cashier / User Logins", "All Cashier / User Logins")}</option>
              {(reportData?.users_list || []).map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.email ? `(${u.email})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Date Pickers */}
          {datePreset === "custom" ? (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-1/2 h-9 px-2 text-xs rounded-xl border bg-background outline-none"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-1/2 h-9 px-2 text-xs rounded-xl border bg-background outline-none"
              />
            </div>
          ) : (
            <div className="flex items-center justify-end">
              <Button
                size="sm"
                onClick={loadReport}
                className="h-9 gradient-brand text-white border-0 text-xs font-semibold px-4 w-full"
              >
                <Filter className="size-3.5 mr-1.5" />
                {t("Apply Filters", "Apply Filters")}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Visual Trend Chart ─────────────────────────────────────────── */}
      {reportData?.sales_trend_chart && reportData.sales_trend_chart.length > 0 && (
        <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" />
                {t("Day-Wise Sales Velocity & Bill Counts", "Day-Wise Sales Velocity & Bill Counts")}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {t("Daily sales trajectory across all active sales employees", "Daily sales trajectory across all active sales employees")}
              </p>
            </div>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={reportData.sales_trend_chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                <XAxis dataKey="name" stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} width={60} tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px", fontSize: "12px" }}
                  formatter={(val: any) => [formatCurrency(Number(val)), "Sales Revenue"]}
                />
                <Area type="monotone" dataKey="total_sales" stroke="var(--primary)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Table View 1: Day-Wise Summary ─────────────────────────────── */}
      {activeView === "day_wise" && (
        <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-muted/20 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <CalendarIcon className="size-4 text-primary" />
              <h3 className="text-sm font-bold">{t("Day-Wise Employee Sales Aggregation", "Day-Wise Employee Sales Aggregation")}</h3>
              <span className="text-[11px] font-semibold text-muted-foreground">
                ({reportData?.day_wise_summary?.length || 0} {t("Date-Staff Records", "Date-Staff Records")})
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-bold tracking-wider border-b">
                <tr>
                  <th className="py-3 px-4">{t("Date", "Date")}</th>
                  <th className="py-3 px-4">{t("Employee", "Employee")}</th>
                  <th className="py-3 px-4">{t("Department & Role", "Department & Role")}</th>
                  <th className="py-3 px-4">{t("Billed From User Login", "Billed From User Login")}</th>
                  <th className="py-3 px-4 text-center">{t("Invoices", "Invoices")}</th>
                  <th className="py-3 px-4 text-right">{t("Taxable Subtotal", "Taxable Subtotal")}</th>
                  <th className="py-3 px-4 text-right">{t("Tax (GST)", "Tax (GST)")}</th>
                  <th className="py-3 px-4 text-right">{t("Discount", "Discount")}</th>
                  <th className="py-3 px-4 text-right">{t("Total Net Sales", "Total Net Sales")}</th>
                  <th className="py-3 px-4 text-right">{t("Avg Bill Value", "Avg Bill Value")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={10} className="py-4 px-4 bg-muted/10">
                        <div className="h-4 bg-muted/40 rounded w-full" />
                      </td>
                    </tr>
                  ))
                ) : !reportData?.day_wise_summary || reportData.day_wise_summary.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-muted-foreground">
                      <Receipt className="size-8 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold">{t("No sales records found for the selected date range.", "No sales records found for the selected date range.")}</p>
                      <p className="text-[11px] mt-1">{t("Try adjusting filters or date range above.", "Try adjusting filters or date range above.")}</p>
                    </td>
                  </tr>
                ) : (
                  reportData.day_wise_summary.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-muted/30 transition-colors">
                      {/* Date */}
                      <td className="py-3 px-4 font-semibold whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full bg-primary/60" />
                          <span>{row.display_date}</span>
                        </div>
                      </td>

                      {/* Employee Name & Code */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-foreground">{row.employee_name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                          <span>{row.employee_code}</span>
                        </div>
                      </td>

                      {/* Department & Role */}
                      <td className="py-3 px-4">
                        <div className="text-foreground">{row.department}</div>
                        <div className="text-[10px] text-muted-foreground">{row.designation}</div>
                      </td>

                      {/* Billed From User Login */}
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          <UserCheck className="size-3 text-primary" />
                          <span>{row.login_user_name}</span>
                        </div>
                      </td>

                      {/* Invoices Count */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md font-bold bg-primary/10 text-primary">
                          {row.invoices_count}
                        </span>
                      </td>

                      {/* Subtotal */}
                      <td className="py-3 px-4 text-right font-medium text-muted-foreground whitespace-nowrap">
                        {formatCurrency(row.subtotal)}
                      </td>

                      {/* Tax */}
                      <td className="py-3 px-4 text-right text-muted-foreground whitespace-nowrap">
                        {formatCurrency(row.tax_amount)}
                      </td>

                      {/* Discount */}
                      <td className="py-3 px-4 text-right text-amber-600 font-medium whitespace-nowrap">
                        {row.discount_amount > 0 ? `-${formatCurrency(row.discount_amount)}` : "—"}
                      </td>

                      {/* Total Net Sales */}
                      <td className="py-3 px-4 text-right font-black text-foreground whitespace-nowrap">
                        {formatCurrency(row.total_sales)}
                      </td>

                      {/* Avg Bill Value */}
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600 whitespace-nowrap">
                        {formatCurrency(row.avg_bill_value)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {reportData?.day_wise_summary && reportData.day_wise_summary.length > 0 && (
                <tfoot className="bg-muted/60 font-bold border-t-2 border-border text-[11px]">
                  <tr>
                    <td colSpan={4} className="py-3.5 px-4 text-foreground uppercase tracking-wider">
                      {t("Total Aggregated Day-Wise Sales", "Total Aggregated Day-Wise Sales")}
                    </td>
                    <td className="py-3.5 px-4 text-center text-primary font-black">
                      {summary.total_invoices_count}
                    </td>
                    <td className="py-3.5 px-4 text-right text-muted-foreground">
                      {formatCurrency(summary.total_subtotal)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-muted-foreground">
                      {formatCurrency(summary.total_tax_amount)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-amber-600">
                      {formatCurrency(summary.total_discount_amount)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-emerald-600 font-black text-sm">
                      {formatCurrency(summary.total_sales_amount)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-foreground">
                      {formatCurrency(summary.avg_ticket_size)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── Table View 2: Detailed Invoices Drill-Down ─────────────────── */}
      {activeView === "detailed" && (
        <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-muted/20 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Receipt className="size-4 text-primary" />
              <h3 className="text-sm font-bold">{t("Detailed Transaction Invoices & Billed Credentials", "Detailed Transaction Invoices & Billed Credentials")}</h3>
              <span className="text-[11px] font-semibold text-muted-foreground">
                ({reportData?.detailed_invoices?.length || 0} {t("Invoices", "Invoices")})
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-bold tracking-wider border-b">
                <tr>
                  <th className="py-3 px-4">{t("Invoice / Receipt #", "Invoice / Receipt #")}</th>
                  <th className="py-3 px-4">{t("Date & Time", "Date & Time")}</th>
                  <th className="py-3 px-4">{t("Sales Employee", "Sales Employee")}</th>
                  <th className="py-3 px-4">{t("Logged-in Cashier / User", "Logged-in Cashier / User")}</th>
                  <th className="py-3 px-4">{t("Customer Name & Phone", "Customer Name & Phone")}</th>
                  <th className="py-3 px-4">{t("Payment Mode", "Payment Mode")}</th>
                  <th className="py-3 px-4 text-right">{t("Subtotal", "Subtotal")}</th>
                  <th className="py-3 px-4 text-right">{t("Tax", "Tax")}</th>
                  <th className="py-3 px-4 text-right">{t("Discount", "Discount")}</th>
                  <th className="py-3 px-4 text-right">{t("Grand Total", "Grand Total")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={10} className="py-4 px-4 bg-muted/10">
                        <div className="h-4 bg-muted/40 rounded w-full" />
                      </td>
                    </tr>
                  ))
                ) : !reportData?.detailed_invoices || reportData.detailed_invoices.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-muted-foreground">
                      <Receipt className="size-8 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold">{t("No invoice records match the selected criteria.", "No invoice records match the selected criteria.")}</p>
                    </td>
                  </tr>
                ) : (
                  reportData.detailed_invoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                      {/* Invoice # */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-bold font-mono text-primary">
                          <span>{inv.invoice_number}</span>
                          <button
                            onClick={() => copyToClipboard(inv.invoice_number, "Invoice number")}
                            className="text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100"
                            title="Copy Invoice Number"
                          >
                            <Copy className="size-3" />
                          </button>
                        </div>
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {inv.doc_type}
                        </span>
                      </td>

                      {/* Date & Time */}
                      <td className="py-3 px-4 whitespace-nowrap text-muted-foreground font-medium">
                        <div>{inv.display_date}</div>
                      </td>

                      {/* Employee Name & Code */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-foreground">{inv.employee_name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{inv.employee_code} ({inv.department})</div>
                      </td>

                      {/* Logged-in User */}
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          <UserCheck className="size-3 text-primary" />
                          <span>{inv.login_user_name}</span>
                        </div>
                        {inv.user_email && (
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{inv.user_email}</div>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">{inv.customer_name}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <PhoneCall className="size-2.5" />
                          <span>{inv.customer_phone}</span>
                        </div>
                      </td>

                      {/* Payment Mode & Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-foreground">{inv.payment_mode}</div>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-500/10 text-emerald-600">
                          {inv.payment_status}
                        </span>
                      </td>

                      {/* Subtotal */}
                      <td className="py-3 px-4 text-right font-medium text-muted-foreground whitespace-nowrap">
                        {formatCurrency(inv.subtotal)}
                      </td>

                      {/* Tax */}
                      <td className="py-3 px-4 text-right text-muted-foreground whitespace-nowrap">
                        {formatCurrency(inv.tax_amount)}
                      </td>

                      {/* Discount */}
                      <td className="py-3 px-4 text-right text-amber-600 font-medium whitespace-nowrap">
                        {inv.discount_amount > 0 ? `-${formatCurrency(inv.discount_amount)}` : "—"}
                      </td>

                      {/* Grand Total */}
                      <td className="py-3 px-4 text-right font-black text-foreground whitespace-nowrap text-xs">
                        {formatCurrency(inv.total_amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Table View 3: Employee Leaderboard ──────────────────────────── */}
      {activeView === "leaderboard" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card border rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-muted/20 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Award className="size-4 text-amber-500" />
                <h3 className="text-sm font-bold">{t("Sales Staff Leaderboard & Rankings", "Sales Staff Leaderboard & Rankings")}</h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-bold tracking-wider border-b">
                  <tr>
                    <th className="py-3 px-4">{t("Rank", "Rank")}</th>
                    <th className="py-3 px-4">{t("Employee", "Employee")}</th>
                    <th className="py-3 px-4">{t("Department", "Department")}</th>
                    <th className="py-3 px-4 text-center">{t("Invoices Billed", "Invoices Billed")}</th>
                    <th className="py-3 px-4 text-right">{t("Avg Ticket Size", "Avg Ticket Size")}</th>
                    <th className="py-3 px-4 text-right">{t("Total Revenue", "Total Revenue")}</th>
                    <th className="py-3 px-4 text-right">{t("Revenue Share", "Revenue Share")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={7} className="py-4 px-4 bg-muted/10">
                          <div className="h-4 bg-muted/40 rounded w-full" />
                        </td>
                      </tr>
                    ))
                  ) : !reportData?.employee_leaderboard || reportData.employee_leaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        {t("No sales staff rankings available.", "No sales staff rankings available.")}
                      </td>
                    </tr>
                  ) : (
                    reportData.employee_leaderboard.map((lead: any, idx: number) => (
                      <tr key={lead.employee_code} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <span
                            className={`size-6 rounded-full inline-flex items-center justify-center font-black text-xs ${
                              idx === 0
                                ? "bg-amber-500 text-white shadow-sm"
                                : idx === 1
                                ? "bg-slate-300 text-slate-800"
                                : idx === 2
                                ? "bg-amber-700/60 text-white"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-foreground">{lead.employee_name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{lead.employee_code}</div>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {lead.department}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-primary">
                          {lead.invoices_count}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-muted-foreground">
                          {formatCurrency(lead.avg_ticket)}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-foreground">
                          {formatCurrency(lead.total_sales)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
                            <span>{lead.percentage_share}%</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Leaderboard Bar Chart */}
          <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Award className="size-4 text-primary" />
              {t("Revenue Share Breakdown", "Revenue Share Breakdown")}
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={reportData?.employee_leaderboard || []}
                  layout="vertical"
                  margin={{ top: 10, right: 20, left: 30, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.3} />
                  <XAxis type="number" stroke="#888" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                  <YAxis type="category" dataKey="employee_name" stroke="#888" fontSize={11} tickLine={false} axisLine={false} width={90} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px", fontSize: "12px" }}
                    formatter={(val: any) => [formatCurrency(Number(val)), "Sales"]}
                  />
                  <Bar dataKey="total_sales" fill="var(--primary)" radius={[0, 6, 6, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
