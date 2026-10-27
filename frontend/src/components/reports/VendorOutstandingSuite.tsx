import React, { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  Search,
  Download,
  Printer,
  RefreshCw,
  ChevronDown,
  CheckCircle2,
  X,
  FileSpreadsheet,
  FileText,
  Landmark,
  Eye,
  Sparkles,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { formatDisplayDateTime, getTodayDateString } from "@/lib/utils";
import { inventoryApi } from "@/lib/api-client";
import { printHtmlInPage } from "@/lib/print-helper";
import { getActiveBillingGst } from "@/lib/receipt-template-store";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker-input";

export interface VendorBillItem {
  id: string;
  bill_number: string;
  date: string;
  due_date: string;
  po_number: string;
  total_amount: number;
  paid_amount: number;
  balance: number;
  status: string;
}

export interface VendorOutstandingRow {
  id: string;
  name: string;
  category: string;
  contact: string;
  gstin: string;
  address?: string;
  total_billed: string;
  total_paid: string;
  bills: string;
  open_bills_count: number;
  total_bills_count: number;
  balance: string;
  raw_balance: number;
  status: "To Pay" | "To Collect" | "Settled";
  bills_list: VendorBillItem[];
}

interface VendorOutstandingSuiteProps {
  onBack?: () => void;
}

export function VendorOutstandingSuite({ onBack }: VendorOutstandingSuiteProps) {
  const { tenant } = useTenant();
  const { formatCurrency } = useCurrency();

  // Tab State: "all" | "to_pay" | "to_collect"
  const [activeTab, setActiveTab] = useState<"all" | "to_pay" | "to_collect">("all");

  // Filter States
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customStartDate, setCustomStartDate] = useState<string>(getTodayDateString());
  const [customEndDate, setCustomEndDate] = useState<string>(getTodayDateString());
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Loading & Data States
  const [loading, setLoading] = useState<boolean>(true);
  const [vendorsData, setVendorsData] = useState<VendorOutstandingRow[]>([]);
  const [tabTotals, setTabTotals] = useState<{
    all_count: number;
    to_pay: number;
    to_collect: number;
    settled: number;
    total_open_bills: number;
  }>({
    all_count: 0,
    to_pay: 0,
    to_collect: 0,
    settled: 0,
    total_open_bills: 0,
  });

  // Selected Vendor Statement / Ledger Modal
  const [selectedVendor, setSelectedVendor] = useState<VendorOutstandingRow | null>(null);

  // Export Dropdown State
  const [showExportDropdown, setShowExportDropdown] = useState<boolean>(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false);
      }
    };
    if (showExportDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showExportDropdown]);

  // Load report data from backend
  const loadReportData = async () => {
    setLoading(true);
    try {
      const payload: any = {
        entity: "vendor_outstanding",
        reportId: "vendor_outstanding",
        dateRange: dateFilter,
        startDate: dateFilter === "custom" ? customStartDate : undefined,
        endDate: dateFilter === "custom" ? customEndDate : undefined,
        tab: "all", // Load all so client can instantly switch tabs without lag
        filters: {
          search: searchQuery || undefined,
        },
      };

      const res = await inventoryApi.generateCustomReport(payload);
      if (res && Array.isArray(res.tableData)) {
        setVendorsData(res.tableData);
      }
      if (res && res.tabTotals) {
        setTabTotals(res.tabTotals);
      }
    } catch (err: any) {
      console.error("Failed to load vendor outstanding report:", err);
      toast.error(err.message || "Failed to load vendor outstanding report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [dateFilter, customStartDate, customEndDate]);

  // Filtered rows for current active tab, search, and category
  const filteredVendors = useMemo(() => {
    let list = vendorsData;

    // Search filtering
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.contact.includes(q) ||
          (v.gstin && v.gstin.toLowerCase().includes(q))
      );
    }

    // Category filtering
    if (selectedCategory !== "all") {
      list = list.filter((v) => v.category.toLowerCase() === selectedCategory.toLowerCase());
    }

    // Tab filtering
    if (activeTab === "to_pay") {
      list = list.filter((v) => v.raw_balance > 0.01);
    } else if (activeTab === "to_collect") {
      list = list.filter((v) => v.raw_balance < -0.01);
    }

    return list;
  }, [vendorsData, searchQuery, selectedCategory, activeTab]);

  // Category options
  const categories = useMemo(() => {
    const set = new Set<string>();
    vendorsData.forEach((v) => {
      if (v.category && v.category !== "—") {
        set.add(v.category);
      }
    });
    return Array.from(set);
  }, [vendorsData]);

  // Dynamic totals for current active tab
  const summaryTotals = useMemo(() => {
    let totBilled = 0;
    let totPaid = 0;
    let totPayable = 0;
    let totCollect = 0;
    let openBills = 0;

    vendorsData.forEach((v) => {
      const billed = Number(v.total_billed.replace(/[₹,]/g, "") || 0);
      const paid = Number(v.total_paid.replace(/[₹,]/g, "") || 0);
      totBilled += billed;
      totPaid += paid;
      if (v.raw_balance > 0.01) totPayable += v.raw_balance;
      if (v.raw_balance < -0.01) totCollect += Math.abs(v.raw_balance);
      openBills += v.open_bills_count;
    });

    return {
      totBilled,
      totPaid,
      totPayable,
      totCollect,
      openBills,
      count: filteredVendors.length,
    };
  }, [vendorsData, filteredVendors]);

  // ── EXPORT EXCEL ─────────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    const rows: any[][] = [];
    const dateStr = new Date().toISOString().slice(0, 10);
    const companyName = (tenant as any)?.name || "IOTRONCS ERP";

    rows.push([companyName]);
    rows.push(["VENDOR OUTSTANDING REGISTER (PAYABLES)"]);
    rows.push([`Period: ${dateFilter.toUpperCase()} | Generated: ${formatDisplayDateTime(new Date())}`]);
    rows.push([]);
    rows.push([
      "Vendor / Supplier Name",
      "Category / Type",
      "Contact Number",
      "GSTIN",
      "Total Invoiced (₹)",
      "Total Paid (₹)",
      "Open Bills",
      "Closing Balance (₹)",
      "Settlement Status",
    ]);

    filteredVendors.forEach((v) => {
      rows.push([
        v.name,
        v.category,
        v.contact,
        v.gstin,
        Number(v.total_billed.replace(/[₹,]/g, "") || 0),
        Number(v.total_paid.replace(/[₹,]/g, "") || 0),
        v.open_bills_count,
        Number(Math.abs(v.raw_balance).toFixed(2)),
        v.status,
      ]);
    });

    rows.push([]);
    rows.push([
      "Total Summary",
      "",
      "",
      "",
      Number(summaryTotals.totBilled.toFixed(2)),
      Number(summaryTotals.totPaid.toFixed(2)),
      summaryTotals.openBills,
      Number(summaryTotals.totPayable.toFixed(2)),
      `${filteredVendors.length} Vendors`,
    ]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vendor Outstanding");
    XLSX.writeFile(wb, `vendor_outstanding_${activeTab}_${dateStr}.xlsx`);
    toast.success("Exported Vendor Outstanding as Excel (.xlsx)");
    setShowExportDropdown(false);
  };

  // ── EXPORT CSV ───────────────────────────────────────────────────────────────
  const handleExportCsv = () => {
    const companyName = (tenant as any)?.name || "IOTRONCS ERP";
    const metaHeader = [
      `"COMPANY NAME:","${companyName.replace(/"/g, '""')}"`,
      `"REPORT TITLE:","Vendor Outstanding Register (Payables) - ${activeTab.toUpperCase()}"`,
      `"PERIOD:","${dateFilter.toUpperCase()}"`,
      `"GENERATED ON:","${formatDisplayDateTime(new Date()).replace(/"/g, '""')}"`,
      `""`,
    ].join("\n");

    const headers = `"Vendor / Supplier","Category","Contact","GSTIN","Total Invoiced (₹)","Total Paid (₹)","Open Bills","Closing Balance (₹)","Status"`;

    const rowLines = filteredVendors.map((v) => {
      const bld = v.total_billed.replace(/[₹,]/g, "");
      const pd = v.total_paid.replace(/[₹,]/g, "");
      const bal = Math.abs(v.raw_balance).toFixed(2);
      return `"${v.name.replace(/"/g, '""')}","${v.category}","${v.contact}","${v.gstin}","${bld}","${pd}","${v.open_bills_count}","${bal}","${v.status}"`;
    });

    const summaryLine = `\n\n"TOTALS:","","","","${summaryTotals.totBilled.toFixed(2)}","${summaryTotals.totPaid.toFixed(2)}","${summaryTotals.openBills}","${summaryTotals.totPayable.toFixed(2)}","${filteredVendors.length} Vendors"`;

    const fullCsv = metaHeader + "\n" + headers + "\n" + rowLines.join("\n") + summaryLine;
    const blob = new Blob(["\uFEFF" + fullCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vendor_outstanding_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Exported Vendor Outstanding as CSV");
    setShowExportDropdown(false);
  };

  // ── PRINT PDF ────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const companyName = (tenant as any)?.name || "IOTRONCS ERP";
    const companyGstin = getActiveBillingGst() || "—";

    const tableRowsHtml = filteredVendors
      .map(
        (v, i) => `
        <tr>
          <td style="text-align: center; color: #64748b;">${i + 1}</td>
          <td><strong>${v.name}</strong></td>
          <td>${v.category}</td>
          <td>${v.contact}</td>
          <td>${v.gstin}</td>
          <td style="text-align: right;">${v.total_billed}</td>
          <td style="text-align: right; color: #166534;">${v.total_paid}</td>
          <td style="text-align: center;">${v.open_bills_count > 0 ? `<span style="color:#b45309;font-weight:700;">${v.open_bills_count} Open</span>` : '<span style="color:#166534;">Settled</span>'}</td>
          <td style="text-align: right; font-weight: 700; color: ${v.raw_balance > 0.01 ? '#be123c' : v.raw_balance < -0.01 ? '#047857' : '#334155'};">${v.balance}</td>
          <td style="text-align: center; font-size: 8.5px; font-weight: 700;">${v.status}</td>
        </tr>
      `
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Vendor Outstanding Register - ${companyName}</title>
        <meta charset="utf-8" />
        <style>
          @page { size: A4 landscape; margin: 8mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 9.5px; color: #0f172a; margin: 0; padding: 10px; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #4f46e5; padding-bottom: 8px; margin-bottom: 12px; }
          .header h1 { margin: 0; font-size: 16px; color: #1e1b4b; }
          .meta { font-size: 8.5px; color: #64748b; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th { background: #f8fafc; border: 1px solid #cbd5e1; padding: 5px 6px; font-size: 8.5px; text-transform: uppercase; color: #334155; }
          td { border: 1px solid #e2e8f0; padding: 5px 6px; font-size: 9px; }
          tr:nth-child(even) { background: #f8fafc; }
          .totals { background: #eef2ff; border: 1px solid #c7d2fe; padding: 8px 12px; margin-top: 14px; display: flex; justify-content: flex-end; gap: 20px; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>Vendor Outstanding Register (Payables)</h1>
            <div class="meta">Company: <strong>${companyName}</strong> &bull; GSTIN: <strong>${companyGstin}</strong></div>
          </div>
          <div style="text-align: right;" class="meta">
            <div>Tab: <strong>${activeTab.toUpperCase()}</strong></div>
            <div>Period: <strong>${dateFilter.toUpperCase()}</strong></div>
            <div>Generated: ${formatDisplayDateTime(new Date())}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 25px;">#</th>
              <th>Vendor / Supplier</th>
              <th>Category</th>
              <th>Contact Number</th>
              <th>GSTIN</th>
              <th style="text-align: right;">Total Invoiced (₹)</th>
              <th style="text-align: right;">Total Paid (₹)</th>
              <th style="text-align: center;">Open Bills</th>
              <th style="text-align: right;">Closing Balance (₹)</th>
              <th style="text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
        <div class="totals">
          <div>Total Vendors: <strong>${filteredVendors.length}</strong></div>
          <div>Total Billed: <strong>${formatCurrency(summaryTotals.totBilled)}</strong></div>
          <div>Total Paid: <strong>${formatCurrency(summaryTotals.totPaid)}</strong></div>
          <div style="color: #be123c;">Total Payable Due: <strong>${formatCurrency(summaryTotals.totPayable)}</strong></div>
          <div style="color: #047857;">Total Advance / Credit: <strong>${formatCurrency(summaryTotals.totCollect)}</strong></div>
        </div>
      </body>
      </html>
    `;

    printHtmlInPage(html, 280);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 font-sans">
      {/* ──────────────────────────────────────────────────────────────────────────
          TOP HEADER & ACTIONS
      ────────────────────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 shrink-0 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer text-slate-600 hover:text-slate-900"
                title="Back to Reports Hub"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Landmark className="size-4" />
                </div>
                <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Vendor Outstanding (Payables)
                </h1>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Sparkles className="size-2.5" /> Live DB
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Register of unpaid vendor bills, procurement dues, advance settlements & itemized purchase ledger.
              </p>
            </div>
          </div>

          {/* Export Dropdown, Print, Refresh */}
          <div className="flex items-center gap-2">
            <div className="relative" ref={exportDropdownRef}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                className="h-8 gap-1.5 text-xs font-semibold rounded-xl border-slate-200 hover:bg-slate-100 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Excel / CSV</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </Button>

              <AnimatePresence>
                {showExportDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 mt-1.5 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={handleExportExcel}
                      className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                    >
                      <FileSpreadsheet className="size-4 text-emerald-600" />
                      <span>Excel (.xlsx)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportCsv}
                      className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                    >
                      <FileText className="size-4 text-indigo-600" />
                      <span>CSV (.csv)</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-8 gap-1.5 text-xs font-semibold rounded-xl border-slate-200 hover:bg-slate-100 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print PDF</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={loadReportData}
              disabled={loading}
              className="h-8 w-8 p-0 rounded-xl border-slate-200 hover:bg-slate-100 cursor-pointer"
              title="Refresh Live Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </header>

      {/* ──────────────────────────────────────────────────────────────────────────
          FILTER TOOLBAR & 3 QUICK TABS (MATCHING CUSTOMER PARTY SUITE)
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 pt-3 pb-0 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          {/* Search Input */}
          <div className="relative min-w-[260px] max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search vendor name, phone, or GSTIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          {/* Category Filter */}
          {categories.length > 0 && (
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-8 pl-3 pr-7 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Vendor Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-slate-400 pointer-events-none" />
            </div>
          )}

          {/* Period Filter */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="h-8 pl-3 pr-7 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="this_week">This Week</option>
                <option value="this_month">This Month</option>
                <option value="this_quarter">This Quarter</option>
                <option value="this_year">This Financial Year</option>
                <option value="custom">Custom Date Range</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-slate-400 pointer-events-none" />
            </div>

            {dateFilter === "custom" && (
              <div className="flex items-center gap-1.5">
                <DatePickerInput
                  value={customStartDate}
                  onChange={(d) => setCustomStartDate(d)}
                  className="h-8 w-32 text-xs"
                />
                <span className="text-xs text-slate-400">to</span>
                <DatePickerInput
                  value={customEndDate}
                  onChange={(d) => setCustomEndDate(d)}
                  className="h-8 w-32 text-xs"
                />
              </div>
            )}
          </div>
        </div>

        {/* Informational Yellow Banner */}
        <div className="bg-amber-50/80 border border-amber-200/60 rounded-xl px-3.5 py-1.5 text-xs text-amber-900 font-medium mb-3 flex items-center justify-between">
          <span>ℹ️ GSTIN, Contact, along with itemized purchase bills, can be viewed in the Excel report or by clicking View Statement.</span>
          <span className="text-[11px] font-bold text-amber-800">
            {tabTotals.total_open_bills} Open Bills Pending
          </span>
        </div>

        {/* ── 3 STATUS TABS (ALL / TO PAY / TO COLLECT) ── */}
        <div className="flex items-center gap-0 border-b border-slate-200">
          {/* Tab 1: All */}
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-6 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === "all"
                ? "border-indigo-600 text-indigo-700 bg-indigo-50/30"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <span>All Vendors</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-slate-200/70 text-slate-700">
              {tabTotals.all_count}
            </span>
          </button>

          {/* Tab 2: To Pay (Payables Due) */}
          <button
            type="button"
            onClick={() => setActiveTab("to_pay")}
            className={`px-6 py-1.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex flex-col items-center ${
              activeTab === "to_pay"
                ? "border-rose-600 text-rose-700 bg-rose-50/30"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span>To Pay (Payables)</span>
            </div>
            <span className="text-[11px] font-mono font-bold text-rose-600 mt-0.5">
              {formatCurrency(tabTotals.to_pay)}
            </span>
          </button>

          {/* Tab 3: To Collect (Advances / Debit Notes) */}
          <button
            type="button"
            onClick={() => setActiveTab("to_collect")}
            className={`px-6 py-1.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex flex-col items-center ${
              activeTab === "to_collect"
                ? "border-emerald-600 text-emerald-700 bg-emerald-50/30"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span>To Collect (Advances)</span>
            </div>
            <span className="text-[11px] font-mono font-bold text-emerald-600 mt-0.5">
              {formatCurrency(tabTotals.to_collect)}
            </span>
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          MAIN DATA TABLE
      ────────────────────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="size-6 text-indigo-600 animate-spin" />
            <p className="text-xs font-semibold text-slate-500">Loading vendor payables from live database...</p>
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto mt-8 shadow-2xs">
            <div className="size-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
              <Building2 className="size-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Vendors Found</h3>
            <p className="text-xs text-slate-500 mt-1">
              {activeTab === "to_pay"
                ? "Great news! There are no pending vendor dues in this category."
                : activeTab === "to_collect"
                ? "There are no advance deposits or debit note balances with vendors."
                : "No vendor records matched your active filter."}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Vendor / Supplier</th>
                    <th className="py-3 px-4">Category / Type</th>
                    <th className="py-3 px-4">Contact Number</th>
                    <th className="py-3 px-4">GSTIN</th>
                    <th className="py-3 px-4 text-right">Total Invoiced (₹)</th>
                    <th className="py-3 px-4 text-right">Total Paid (₹)</th>
                    <th className="py-3 px-4 text-center">Open Bills</th>
                    <th className="py-3 px-4 text-right">Closing Payable (₹)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredVendors.map((row, idx) => {
                    const isDue = row.raw_balance > 0.01;
                    const isAdvance = row.raw_balance < -0.01;

                    return (
                      <tr
                        key={row.id || idx}
                        className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                        onClick={() => setSelectedVendor(row)}
                      >
                        <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>

                        {/* Vendor Name */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="size-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                              {row.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                {row.name}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {row.total_bills_count} Total Bills Recorded
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
                            {row.category}
                          </span>
                        </td>

                        {/* Contact */}
                        <td className="py-3 px-4 font-mono text-slate-600">{row.contact}</td>

                        {/* GSTIN */}
                        <td className="py-3 px-4 font-mono text-slate-600">{row.gstin}</td>

                        {/* Total Invoiced */}
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800">
                          {row.total_billed}
                        </td>

                        {/* Total Paid */}
                        <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700">
                          {row.total_paid}
                        </td>

                        {/* Open Bills */}
                        <td className="py-3 px-4 text-center">
                          {row.open_bills_count > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                              {row.open_bills_count} Open
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                              <CheckCircle2 className="size-2.5" /> Settled
                            </span>
                          )}
                        </td>

                        {/* Closing Payable */}
                        <td
                          className={`py-3 px-4 text-right font-mono font-extrabold ${
                            isDue ? "text-rose-600" : isAdvance ? "text-emerald-700" : "text-slate-600"
                          }`}
                        >
                          {isAdvance ? `- ${row.balance}` : row.balance}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isDue
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : isAdvance
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="py-3 px-4 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVendor(row);
                            }}
                            className="h-7 text-xs font-semibold gap-1 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg cursor-pointer"
                          >
                            <Eye className="size-3.5" />
                            <span>Statement</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Bottom Totals Bar */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-slate-700">
              <div className="flex items-center gap-3">
                <span>TOTAL VENDORS: <strong className="text-slate-900">{filteredVendors.length}</strong></span>
                <span>&bull;</span>
                <span>OPEN BILLS: <strong className="text-amber-700">{summaryTotals.openBills} Bills</strong></span>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <span className="text-slate-500 font-normal">Total Billed: </span>
                  <strong className="text-slate-900 font-mono">{formatCurrency(summaryTotals.totBilled)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-normal">Total Paid: </span>
                  <strong className="text-emerald-700 font-mono">{formatCurrency(summaryTotals.totPaid)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-normal">Total Payable Due: </span>
                  <strong className="text-rose-600 font-mono text-sm">{formatCurrency(summaryTotals.totPayable)}</strong>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ──────────────────────────────────────────────────────────────────────────
          VENDOR STATEMENT / PURCHASE LEDGER DRILLDOWN MODAL
      ────────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedVendor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.16 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/50 via-white to-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
                    <Building2 className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-extrabold text-slate-900">{selectedVendor.name}</h2>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          selectedVendor.raw_balance > 0.01
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : selectedVendor.raw_balance < -0.01
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        }`}
                      >
                        {selectedVendor.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Tel: <strong>{selectedVendor.contact}</strong> &bull; GSTIN: <strong>{selectedVendor.gstin}</strong> &bull; Category: <strong>{selectedVendor.category}</strong>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedVendor(null)}
                  className="size-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-4 gap-3 p-5 bg-slate-50/70 border-b border-slate-200">
                <div className="bg-white p-3 rounded-2xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Bills</div>
                  <div className="text-lg font-extrabold text-slate-900 mt-0.5">{selectedVendor.total_bills_count} Bills</div>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Gross Billed</div>
                  <div className="text-lg font-extrabold text-slate-900 font-mono mt-0.5">{selectedVendor.total_billed}</div>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Settled / Paid</div>
                  <div className="text-lg font-extrabold text-emerald-700 font-mono mt-0.5">{selectedVendor.total_paid}</div>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Net Balance Due</div>
                  <div className={`text-lg font-extrabold font-mono mt-0.5 ${selectedVendor.raw_balance > 0.01 ? "text-rose-600" : "text-slate-800"}`}>
                    {selectedVendor.balance}
                  </div>
                </div>
              </div>

              {/* Itemized Bills Table */}
              <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Receipt className="size-4 text-indigo-600" /> Itemized Purchase Bills & Settlement Ledger
                  </h3>
                  <span className="text-xs font-semibold text-slate-500">
                    Showing {selectedVendor.bills_list.length} Records
                  </span>
                </div>

                {selectedVendor.bills_list.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500">
                    No purchase bills recorded for this vendor.
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Bill / Invoice #</th>
                          <th className="py-2.5 px-3">Linked PO Ref</th>
                          <th className="py-2.5 px-3">Due Date</th>
                          <th className="py-2.5 px-3 text-right">Invoiced (₹)</th>
                          <th className="py-2.5 px-3 text-right">Paid (₹)</th>
                          <th className="py-2.5 px-3 text-right">Balance Due (₹)</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedVendor.bills_list.map((b) => (
                          <tr key={b.id || b.bill_number} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">{b.date}</td>
                            <td className="py-2.5 px-3 font-bold text-indigo-700 font-mono">{b.bill_number}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-600">{b.po_number}</td>
                            <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">{b.due_date}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                              {formatCurrency(b.total_amount)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-700">
                              {formatCurrency(b.paid_amount)}
                            </td>
                            <td className={`py-2.5 px-3 text-right font-mono font-bold ${b.balance > 0.01 ? "text-rose-600" : "text-slate-600"}`}>
                              {formatCurrency(b.balance)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  b.status.toLowerCase() === "paid"
                                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                    : b.status.toLowerCase() === "partially paid"
                                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                                    : "bg-rose-50 text-rose-800 border border-rose-200"
                                }`}
                              >
                                {b.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Detailed ledger matches active ERP purchase orders & bills.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedVendor(null)}
                  className="rounded-xl"
                >
                  Close Statement
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
