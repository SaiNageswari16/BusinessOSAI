import React, { useEffect, useState, useMemo } from "react";
import {
  ArrowLeft,
  Star,
  Mail,
  Download,
  Printer,
  Search,
  Calendar as CalendarIcon,
  ChevronDown,
  Info,
  X,
  Send,
  Loader2,
  CheckCircle2,
  Image as ImageIcon,
  FileSpreadsheet,
  FileText,
  RotateCcw
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { formatDisplayDate } from "@/lib/utils";
import { inventoryApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { ReportEmailModal } from "./ReportEmailModal";

interface EmployeeSalesReportSuiteProps {
  onBack?: () => void;
}

export function EmployeeSalesReportSuite({ onBack }: EmployeeSalesReportSuiteProps) {
  const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();

  // Favorite toggle
  const [isFavorite, setIsFavorite] = useState<boolean>(() => {
    return localStorage.getItem("report_fav_sales_summary_staff_wise") === "true";
  });

  const toggleFavorite = () => {
    const next = !isFavorite;
    setIsFavorite(next);
    localStorage.setItem("report_fav_sales_summary_staff_wise", String(next));
    toast.success(next ? "Added to favourites" : "Removed from favourites");
  };

  // Filter States
  const [datePreset, setDatePreset] = useState<
    "this_week" | "today" | "yesterday" | "last7" | "this_month" | "last_month" | "this_quarter" | "this_fy" | "all" | "custom"
  >("this_week");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedStaff, setSelectedStaff] = useState<string>("all");
  const [selectedInvoiceType, setSelectedInvoiceType] = useState<string>("all");
  const [selectedInvoiceStatus, setSelectedInvoiceStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // UI state
  const [downloadMenuOpen, setDownloadMenuOpen] = useState<boolean>(false);
  const [emailModalOpen, setEmailModalOpen] = useState<boolean>(false);
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
    } else if (datePreset === "this_week") {
      const day = now.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setStartDate(fmt(monday));
      setEndDate(fmt(sunday));
    } else if (datePreset === "last7") {
      const past = new Date(now);
      past.setDate(past.getDate() - 7);
      setStartDate(fmt(past));
      setEndDate(fmt(now));
    } else if (datePreset === "this_month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(fmt(firstDay));
      setEndDate(fmt(lastDay));
    } else if (datePreset === "last_month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(fmt(firstDay));
      setEndDate(fmt(lastDay));
    } else if (datePreset === "this_quarter") {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const firstDay = new Date(now.getFullYear(), qMonth, 1);
      const lastDay = new Date(now.getFullYear(), qMonth + 3, 0);
      setStartDate(fmt(firstDay));
      setEndDate(fmt(lastDay));
    } else if (datePreset === "this_fy") {
      const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const firstDay = new Date(fyStartYear, 3, 1);
      const lastDay = new Date(fyStartYear + 1, 2, 31);
      setStartDate(fmt(firstDay));
      setEndDate(fmt(lastDay));
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
      if (selectedStaff && selectedStaff !== "all") params.employee_id = selectedStaff;
      if (selectedInvoiceType && selectedInvoiceType !== "all") params.invoice_type = selectedInvoiceType;
      if (selectedInvoiceStatus && selectedInvoiceStatus !== "all") params.invoice_status = selectedInvoiceStatus;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (tenant?.id) params.company_id = tenant.id;

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
  }, [startDate, endDate, selectedStaff, selectedInvoiceType, selectedInvoiceStatus, tenant?.id]);

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      void loadReport();
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Table rows from detailed invoices
  const invoices: any[] = useMemo(() => {
    return reportData?.detailed_invoices || [];
  }, [reportData]);

  // Helper to check if an invoice is cancelled
  const isCancelledInvoice = (inv: any): boolean => {
    return Boolean(
      inv?.is_cancelled ||
      String(inv?.invoice_status || "").toUpperCase().includes("CANCEL") ||
      String(inv?.payment_status || "").toUpperCase().includes("CANCEL") ||
      String(inv?.status || "").toLowerCase().includes("cancel")
    );
  };

  const activeInvoices = useMemo(() => {
    return invoices.filter((inv) => !isCancelledInvoice(inv));
  }, [invoices]);

  const cancelledInvoices = useMemo(() => {
    return invoices.filter((inv) => isCancelledInvoice(inv));
  }, [invoices]);

  // Aggregate totals (Net sales strictly excluding cancelled & repaid invoices)
  const totalSales = useMemo(() => {
    return activeInvoices.reduce((sum, inv) => sum + (Number(inv.amount || inv.total_amount) || 0), 0);
  }, [activeInvoices]);

  const totalCancelledAmount = useMemo(() => {
    return cancelledInvoices.reduce((sum, inv) => sum + (Number(inv.amount || inv.total_amount) || 0), 0);
  }, [cancelledInvoices]);

  const totalBalance = useMemo(() => {
    return activeInvoices.reduce((sum, inv) => sum + (Number(inv.balance_amount) || 0), 0);
  }, [activeInvoices]);

  // Staff options list
  const staffOptions = useMemo(() => {
    const list: { id: string; name: string }[] = [];
    const seen = new Set<string>();

    if (reportData?.employees_list) {
      for (const emp of reportData.employees_list) {
        if (emp.name && !seen.has(emp.name.toLowerCase())) {
          seen.add(emp.name.toLowerCase());
          list.push({ id: emp.name, name: emp.name });
        }
      }
    }
    if (reportData?.users_list) {
      for (const u of reportData.users_list) {
        if (u.name && !seen.has(u.name.toLowerCase())) {
          seen.add(u.name.toLowerCase());
          list.push({ id: u.name, name: u.name });
        }
      }
    }
    return list;
  }, [reportData]);

  // Download Excel (.xlsx)
  const handleDownloadExcel = () => {
    setDownloadMenuOpen(false);
    if (!invoices || invoices.length === 0) {
      toast.info("No transaction data available to export");
      return;
    }

    try {
      const dataToExport = invoices.map((inv) => ({
        Date: inv.date ? formatDisplayDate(inv.date) : "—",
        "Invoice No": inv.invoice_number || inv.receipt_number || "—",
        "Party Name": inv.party_name || inv.customer_name || "Cash Customer",
        "Due Date": inv.due_date ? formatDisplayDate(inv.due_date) : "—",
        Amount: Number(inv.amount || inv.total_amount || 0),
        "Balance Amount": Number(inv.balance_amount || 0),
        "Invoice Type": inv.invoice_type || "Tax Invoice",
        "Invoice Status": inv.invoice_status || "PAID",
        "Created By": inv.created_by || inv.login_user_name || "Admin"
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Staff Sales Summary");
      XLSX.writeFile(workbook, `Sales_Summary_Staff_Wise_${datePreset}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Excel report downloaded successfully");
    } catch (err: any) {
      console.error("Failed to generate Excel:", err);
      toast.error("Failed to generate Excel file");
    }
  };

  // Download CSV
  const handleDownloadCSV = () => {
    setDownloadMenuOpen(false);
    if (!invoices || invoices.length === 0) {
      toast.info("No transaction data available to export");
      return;
    }

    const headers = [
      "Date",
      "Invoice No",
      "Party Name",
      "Due Date",
      "Amount",
      "Balance Amount",
      "Invoice Type",
      "Invoice Status",
      "Created By"
    ];

    const rows = invoices.map((inv) => [
      `"${inv.date ? formatDisplayDate(inv.date) : "—"}"`,
      `"${inv.invoice_number || inv.receipt_number || "—"}"`,
      `"${inv.party_name || inv.customer_name || "Cash Customer"}"`,
      `"${inv.due_date ? formatDisplayDate(inv.due_date) : "—"}"`,
      Number(inv.amount || inv.total_amount || 0),
      Number(inv.balance_amount || 0),
      `"${inv.invoice_type || "Tax Invoice"}"`,
      `"${inv.invoice_status || "PAID"}"`,
      `"${inv.created_by || inv.login_user_name || "Admin"}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Sales_Summary_Staff_Wise_${datePreset}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV report downloaded successfully");
  };

  // Preset labels map
  const presetLabels: Record<string, string> = {
    this_week: "This Week",
    today: "Today",
    yesterday: "Yesterday",
    last7: "Last 7 Days",
    this_month: "This Month",
    last_month: "Previous Month",
    this_quarter: "This Quarter",
    this_fy: "This Financial Year",
    all: "All Time",
    custom: "Custom Range"
  };

  return (
    <div className="flex-1 flex flex-col min-h-full w-full bg-white text-slate-800 font-sans pb-24">
      {/* Top Header Row matching screenshot */}
      <header className="sticky top-0 z-20 px-6 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white/95 backdrop-blur-md shadow-2xs">
        {/* Left: Back button + Title + Favourite badge */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => (onBack ? onBack() : window.history.back())}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors"
            title="Go Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Sales Summary - Staff wise</h1>

          <button
            onClick={toggleFavorite}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
              isFavorite
                ? "bg-amber-100/80 text-amber-900 border-amber-300 shadow-xs"
                : "bg-amber-50/70 text-amber-800 border-amber-200 hover:bg-amber-100/60"
            }`}
          >
            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span>Favourite</span>
          </button>
        </div>

        {/* Right: Email Excel, Download Excel with info/dropdown, Print PDF */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEmailModalOpen(true)}
            className="h-9 px-3.5 text-xs font-medium text-slate-700 border-slate-300 hover:bg-slate-50 shadow-2xs gap-1.5 rounded-lg"
          >
            <Mail className="w-4 h-4 text-slate-600" />
            <span>Email Excel</span>
          </Button>

          {/* Download Excel Dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDownloadMenuOpen(!downloadMenuOpen)}
              className="h-9 px-3.5 text-xs font-medium text-slate-700 border-slate-300 hover:bg-slate-50 shadow-2xs gap-1.5 rounded-lg"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>Download Excel</span>
              <Info className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </Button>

            {downloadMenuOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 text-xs">
                <button
                  onClick={handleDownloadExcel}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 font-medium"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Download Excel (.xlsx)</span>
                </button>
                <button
                  onClick={handleDownloadCSV}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 font-medium"
                >
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Download CSV (.csv)</span>
                </button>
              </div>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="h-9 px-3.5 text-xs font-medium text-slate-700 border-slate-300 hover:bg-slate-50 shadow-2xs gap-1.5 rounded-lg"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Print PDF</span>
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 px-6 py-5 flex flex-col gap-5 bg-white">
        {/* Metric Cards Row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs min-w-[240px]">
            <div className="flex items-center justify-between gap-2 text-slate-500 mb-1.5">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-semibold tracking-wide">Net Total Sales</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {activeInvoices.length} Active Bills
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              ₹ {Number(totalSales || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </div>
          </div>

          {cancelledInvoices.length > 0 && (
            <div className="border border-rose-200 rounded-xl p-4 bg-rose-50/50 shadow-2xs min-w-[240px]">
              <div className="flex items-center justify-between gap-2 text-rose-700 mb-1.5">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-rose-600" />
                  <span className="text-xs font-semibold tracking-wide">Cancelled & Repaid</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                  {cancelledInvoices.length} Invoices Repaid
                </span>
              </div>
              <div className="text-2xl font-bold text-rose-700">
                ₹ {Number(totalCancelledAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </div>
            </div>
          )}
        </div>

        {/* Filter Controls Row (5 inputs matching screenshot) */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* 1. Search Box with Search Icon and down chevron */}
          <div className="relative flex items-center min-w-[210px] flex-1 max-w-[280px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Party / Invoice..."
              className="w-full h-10 pl-9 pr-8 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-2xs"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 pointer-events-none" />
            )}
          </div>

          {/* 2. Staff Dropdown (All Staff) */}
          <div className="relative min-w-[150px]">
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="w-full h-10 px-3.5 pr-8 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-2xs appearance-none font-medium cursor-pointer"
            >
              <option value="all">All Staff</option>
              {staffOptions.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
          </div>

          {/* 3. Date Presets (📅 This Week 📅) */}
          <div className="relative min-w-[170px]">
            <div className="flex items-center">
              <CalendarIcon className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value as any)}
                className="w-full h-10 pl-9 pr-8 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-2xs appearance-none font-medium cursor-pointer"
              >
                <option value="this_week">This Week</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last7">Last 7 Days</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Previous Month</option>
                <option value="this_quarter">This Quarter</option>
                <option value="this_fy">This Financial Year</option>
                <option value="all">All Time</option>
                <option value="custom">Custom Date Range</option>
              </select>
              <CalendarIcon className="w-4 h-4 text-slate-500 absolute right-3 pointer-events-none" />
            </div>
          </div>

          {/* If Custom Date Range, show start & end date inputs */}
          {datePreset === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 shadow-2xs"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 shadow-2xs"
              />
            </div>
          )}

          {/* 4. Invoice Type Dropdown */}
          <div className="relative min-w-[140px]">
            <select
              value={selectedInvoiceType}
              onChange={(e) => setSelectedInvoiceType(e.target.value)}
              className="w-full h-10 px-3.5 pr-8 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-2xs appearance-none font-medium cursor-pointer"
            >
              <option value="all">Invoice Type</option>
              <option value="tax_invoice">Tax Invoice</option>
              <option value="pos_receipt">POS Receipt</option>
              <option value="sales_invoice">Sales Invoice</option>
              <option value="proforma">Proforma Invoice</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
          </div>

          {/* 5. Invoice Status Dropdown */}
          <div className="relative min-w-[140px]">
            <select
              value={selectedInvoiceStatus}
              onChange={(e) => setSelectedInvoiceStatus(e.target.value)}
              className="w-full h-10 px-3.5 pr-8 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-2xs appearance-none font-medium cursor-pointer"
            >
              <option value="all">Invoice Status</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Unpaid</option>
              <option value="overdue">Overdue</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
          </div>
        </div>

        {/* 9-Column Table Container */}
        <div className="flex-1 flex flex-col border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white min-h-[350px]">
          {/* Table Header */}
          <div className="overflow-x-auto custom-scrollbar flex-1 flex flex-col">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold select-none">
                  <th className="py-3 px-4 whitespace-nowrap">Date</th>
                  <th className="py-3 px-4 whitespace-nowrap">Invoice No</th>
                  <th className="py-3 px-4 whitespace-nowrap">Party Name</th>
                  <th className="py-3 px-4 whitespace-nowrap">Due Date</th>
                  <th className="py-3 px-4 whitespace-nowrap text-right">Amount</th>
                  <th className="py-3 px-4 whitespace-nowrap text-right">Balance Amount</th>
                  <th className="py-3 px-4 whitespace-nowrap">Invoice Type</th>
                  <th className="py-3 px-4 whitespace-nowrap text-center">Invoice Status</th>
                  <th className="py-3 px-4 whitespace-nowrap">Created By</th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-24 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        <span className="text-xs text-slate-500 font-medium">Loading transactions...</span>
                      </div>
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  /* Empty state matching screenshot */
                  <tr>
                    <td colSpan={9} className="py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        {/* SVG Illustration: Magnifying glass with subtle accent lines */}
                        <div className="relative w-40 h-28 flex items-center justify-center mb-3">
                          {/* Horizontal soft accent lines */}
                          <div className="absolute top-6 left-6 w-28 h-2 bg-slate-100 rounded-full" />
                          <div className="absolute top-11 left-3 w-34 h-2 bg-slate-100/90 rounded-full" />
                          <div className="absolute top-16 left-9 w-22 h-2 bg-slate-100/70 rounded-full" />

                          {/* Magnifying Glass SVG */}
                          <svg
                            className="relative w-16 h-16 text-slate-400 stroke-current z-10"
                            viewBox="0 0 24 24"
                            fill="none"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="11" cy="11" r="7" />
                            <line x1="16.5" y1="16.5" x2="22" y2="22" />
                          </svg>
                        </div>

                        {/* Exact text matching screenshot */}
                        <p className="text-slate-500 text-sm font-normal">
                          No transactions available to generate report
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv, idx) => {
                    const isCanc = isCancelledInvoice(inv);
                    const status = (inv.invoice_status || "PAID").toUpperCase();
                    let statusBadgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
                    if (isCanc) {
                      statusBadgeClass = "bg-rose-50 text-rose-700 border-rose-200 font-bold";
                    } else if (status.includes("OVERDUE") || status.includes("UNPAID")) {
                      statusBadgeClass = "bg-rose-50 text-rose-700 border-rose-200";
                    } else if (status.includes("PARTIAL")) {
                      statusBadgeClass = "bg-amber-50 text-amber-700 border-amber-200";
                    }

                    const amt = Number(inv.amount || inv.total_amount || 0);
                    const bal = Number(inv.balance_amount || 0);

                    return (
                      <tr key={inv.id || idx} className={`transition-colors ${isCanc ? "bg-rose-50/20 hover:bg-rose-50/40" : "hover:bg-slate-50/80"}`}>
                        <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                          {inv.date ? formatDisplayDate(inv.date) : "—"}
                        </td>
                        <td className="py-3 px-4 font-semibold text-blue-600 whitespace-nowrap">
                          {inv.invoice_number || inv.receipt_number || "—"}
                        </td>
                        <td className="py-3 px-4 text-slate-800 font-medium">
                          {inv.party_name || inv.customer_name || "Cash Customer"}
                        </td>
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          {inv.due_date ? formatDisplayDate(inv.due_date) : "—"}
                        </td>
                        <td className="py-3 px-4 text-slate-900 font-semibold text-right whitespace-nowrap">
                          {isCanc ? (
                            <div className="flex flex-col items-end">
                              <span className="line-through text-slate-400">
                                ₹ {amt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span className="text-[10px] text-rose-600 font-bold">Repaid to Customer</span>
                            </div>
                          ) : (
                            `₹ ${amt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium text-right whitespace-nowrap">
                          {bal > 0 && !isCanc ? (
                            <span className="text-rose-600 font-semibold">
                              ₹ {bal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            "₹ 0.00"
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          {inv.invoice_type || "Tax Invoice"}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusBadgeClass}`}
                          >
                            {isCanc ? "CANCELLED & REPAID" : status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 whitespace-nowrap font-medium">
                          {inv.created_by || inv.login_user_name || "Admin"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Table Footer with Totals (if records exist) */}
              {invoices.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-900">
                    <td colSpan={4} className="py-3 px-4 text-slate-700">
                      Net Total ({activeInvoices.length} active bills{cancelledInvoices.length > 0 ? ` • ${cancelledInvoices.length} cancelled/repaid excluded` : ""})
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 font-extrabold whitespace-nowrap">
                      ₹ {totalSales.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right text-rose-600 font-extrabold whitespace-nowrap">
                      ₹ {totalBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td colSpan={3} className="py-3 px-4"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* Email Modal Dialog — real SMTP dispatch via organization config */}
      <ReportEmailModal
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        reportTitle="Sales Summary - Staff wise"
        sheetName="Staff Sales Summary"
        attachmentFilename={`Sales_Summary_Staff_Wise_${datePreset}_${new Date().toISOString().slice(0, 10)}.xlsx`}
        headers={["Date", "Invoice No", "Party Name", "Due Date", "Amount", "Balance Amount", "Invoice Type", "Invoice Status", "Created By"]}
        rows={invoices.map((inv) => [
          inv.date ? formatDisplayDate(inv.date) : "—",
          inv.invoice_number || inv.receipt_number || "—",
          inv.party_name || inv.customer_name || "Cash Customer",
          inv.due_date ? formatDisplayDate(inv.due_date) : "—",
          Number(inv.amount || inv.total_amount || 0),
          Number(inv.balance_amount || 0),
          inv.invoice_type || "Tax Invoice",
          inv.invoice_status || "PAID",
          inv.created_by || inv.login_user_name || "Admin",
        ])}
        summaryLines={[
          `Date Filter: ${presetLabels[datePreset] || "This Week"}`,
          `Transactions: ${invoices.length} records`,
          `Total Amount: ₹ ${totalSales.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          `Outstanding Balance: ₹ ${totalBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        ]}
      />
    </div>
  );
}
