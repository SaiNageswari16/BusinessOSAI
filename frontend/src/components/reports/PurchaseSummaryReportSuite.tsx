import React, { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag,
  ArrowLeft,
  Search,
  Download,
  Printer,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Boxes,
  FileSpreadsheet,
  FileText,
  Sparkles,
  Receipt,
  ShieldCheck,
  CheckCircle2,
  Calendar as CalendarIcon,
  Clock,
  X,
  CreditCard,
  Percent,
  Layers,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { formatDisplayDate, formatSafeTime, formatDisplayDateTime, getTodayDateString } from "@/lib/utils";
import { inventoryApi } from "@/lib/api-client";
import { printHtmlInPage } from "@/lib/print-helper";
import { getActiveBillingGst } from "@/lib/receipt-template-store";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker-input";

export interface PurchaseOrderItemDetail {
  product_id?: string;
  name: string;
  sku?: string;
  hsn_code?: string;
  qty: number;
  price: string;
  tax: string;
  tax_rate?: string;
  total: string;
  raw_price?: number;
  raw_tax?: number;
  raw_total?: number;
}

export interface PurchaseInvoiceRow {
  id: string;
  date: string;
  raw_date?: string;
  invoice_no: string;
  supplier: string;
  customer?: string;
  supplier_phone?: string;
  supplier_gstin?: string;
  source: string;
  payment_mode: string;
  taxable_amount: string;
  raw_taxable: number;
  tax_rate: string;
  cgst: string;
  raw_cgst: number;
  sgst: string;
  raw_sgst: number;
  igst: string;
  raw_igst: number;
  total_tax: string;
  raw_tax: number;
  discount: string;
  raw_discount: number;
  total_amount: string;
  raw_total: number;
  status: string;
  items?: PurchaseOrderItemDetail[];
}

export interface TaxSlabRow {
  slab: string;
  invoices_count: string;
  taxable: string;
  cgst: string;
  sgst: string;
  igst: string;
  total_tax: string;
  gross_total: string;
  raw_taxable?: number;
  raw_tax?: number;
  raw_total?: number;
}

export interface PeriodSummaryRow {
  period: string;
  total_pos: string;
  completed_pos: string;
  pending_pos: string;
  taxable: string;
  itc_tax: string;
  gross_total: string;
  raw_taxable?: number;
  raw_tax?: number;
  raw_total?: number;
  count?: number;
}

interface PurchaseSummaryReportSuiteProps {
  onBack?: () => void;
}

export function PurchaseSummaryReportSuite({ onBack }: PurchaseSummaryReportSuiteProps) {
  const { tenant } = useTenant();
  const { formatCurrency } = useCurrency();

  // Tab State: "periods" | "invoices" | "slabs"
  // Default to "periods" to match the user's initial screen layout, or easily switchable
  const [activeTab, setActiveTab] = useState<"periods" | "invoices" | "slabs">("periods");

  // Filters
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customStartDate, setCustomStartDate] = useState<string>(getTodayDateString());
  const [customEndDate, setCustomEndDate] = useState<string>(getTodayDateString());
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTaxRate, setSelectedTaxRate] = useState<string>("all");

  // Loading & Data States
  const [loading, setLoading] = useState<boolean>(true);
  const [invoicesData, setInvoicesData] = useState<PurchaseInvoiceRow[]>([]);
  const [taxSlabsData, setTaxSlabsData] = useState<TaxSlabRow[]>([]);
  const [periodsData, setPeriodsData] = useState<PeriodSummaryRow[]>([]);
  const [summaryTotals, setSummaryTotals] = useState<any>({
    active_invoices: 0,
    total_invoices_count: 0,
    net_gross_turnover: "₹0.00",
    raw_gross_turnover: 0,
    total_taxable: "₹0.00",
    raw_taxable: 0,
    total_cgst: "₹0.00",
    raw_cgst: 0,
    total_sgst: "₹0.00",
    raw_sgst: 0,
    total_igst: "₹0.00",
    raw_igst: 0,
    total_gst: "₹0.00",
    raw_gst: 0,
    total_procurement_value: "₹0.00",
    total_eligible_itc: "₹0.00",
    total_orders_raised: "0 POs",
  });

  // Expandable Invoices
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<Record<string, boolean>>({});

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
        entity: "purchase_summary",
        reportId: "purchase_summary",
        dateRange: dateFilter,
        startDate: dateFilter === "custom" ? customStartDate : undefined,
        endDate: dateFilter === "custom" ? customEndDate : undefined,
        filters: {
          search: searchQuery || undefined,
        },
      };

      const res = await inventoryApi.generateCustomReport(payload);
      if (res) {
        if (Array.isArray(res.invoicesData)) {
          setInvoicesData(res.invoicesData);
        } else if (Array.isArray(res.tableData) && res.tableData[0]?.supplier) {
          setInvoicesData(res.tableData);
        }
        if (Array.isArray(res.taxSlabs)) {
          setTaxSlabsData(res.taxSlabs);
        }
        if (Array.isArray(res.periodsSummary)) {
          setPeriodsData(res.periodsSummary);
        } else if (Array.isArray(res.tableData) && res.tableData[0]?.period) {
          setPeriodsData(res.tableData);
        }
        if (res.summaryTotals) {
          setSummaryTotals(res.summaryTotals);
        }
      }
    } catch (err: any) {
      console.error("Failed to load purchase summary report:", err);
      toast.error(err.message || "Failed to load purchase summary report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [dateFilter, customStartDate, customEndDate]);

  // Toggle single row expansion
  const toggleRowExpansion = (rowId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedInvoiceIds((prev) => ({
      ...prev,
      [rowId]: !prev[rowId],
    }));
  };

  // Tax Rate options
  const taxRateOptions = useMemo(() => {
    const set = new Set<string>();
    invoicesData.forEach((inv) => {
      if (inv.tax_rate) set.add(inv.tax_rate);
    });
    return Array.from(set);
  }, [invoicesData]);

  // Filtered rows for search & tax rate
  const filteredInvoices = useMemo(() => {
    let list = invoicesData;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (inv) =>
          inv.invoice_no.toLowerCase().includes(q) ||
          inv.supplier.toLowerCase().includes(q) ||
          (inv.supplier_phone && inv.supplier_phone.includes(q)) ||
          (inv.supplier_gstin && inv.supplier_gstin.toLowerCase().includes(q))
      );
    }

    if (selectedTaxRate !== "all") {
      list = list.filter((inv) => inv.tax_rate === selectedTaxRate);
    }

    return list;
  }, [invoicesData, searchQuery, selectedTaxRate]);

  // Filtered periods
  const filteredPeriods = useMemo(() => {
    let list = periodsData;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => p.period.toLowerCase().includes(q));
    }
    return list;
  }, [periodsData, searchQuery]);

  // Dynamic totals for filtered invoices
  const dynamicTotals = useMemo(() => {
    let totTaxable = 0;
    let totCgst = 0;
    let totSgst = 0;
    let totIgst = 0;
    let totTax = 0;
    let totGross = 0;

    filteredInvoices.forEach((inv) => {
      totTaxable += inv.raw_taxable || 0;
      totCgst += inv.raw_cgst || 0;
      totSgst += inv.raw_sgst || 0;
      totIgst += inv.raw_igst || 0;
      totTax += inv.raw_tax || 0;
      totGross += inv.raw_total || 0;
    });

    return {
      count: filteredInvoices.length,
      totTaxable,
      totCgst,
      totSgst,
      totIgst,
      totTax,
      totGross,
    };
  }, [filteredInvoices]);

  // Dynamic periods totals
  const periodTotals = useMemo(() => {
    let totTaxable = 0;
    let totItc = 0;
    let totGross = 0;
    let totPos = 0;

    filteredPeriods.forEach((p) => {
      totTaxable += p.raw_taxable || Number(p.taxable.replace(/[₹,]/g, "") || 0);
      totItc += p.raw_tax || Number(p.itc_tax.replace(/[₹,]/g, "") || 0);
      totGross += p.raw_total || Number(p.gross_total.replace(/[₹,]/g, "") || 0);
      const orders = parseInt(p.total_pos) || p.count || 0;
      totPos += orders;
    });

    return {
      count: filteredPeriods.length,
      totTaxable,
      totItc,
      totGross,
      totPos,
    };
  }, [filteredPeriods]);

  // ── EXPORT EXCEL ─────────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    const rows: any[][] = [];
    const dateStr = new Date().toISOString().slice(0, 10);
    const companyName = (tenant as any)?.name || "IOTRONCS ERP";
    const companyGstin = getActiveBillingGst() || "—";

    rows.push([companyName]);
    rows.push(["PROCUREMENT & PURCHASE SUMMARY REPORT"]);
    rows.push([`Period: ${dateFilter.toUpperCase()} | Generated: ${formatDisplayDateTime(new Date())} | GSTIN: ${companyGstin}`]);
    rows.push([]);

    if (activeTab === "periods") {
      rows.push(["#", "Month / Period", "Total POs Created", "Completed Orders", "Pending Approval", "Taxable Procurement (₹)", "Input Tax Credit (₹)", "Gross Procurement (₹)"]);
      filteredPeriods.forEach((p, idx) => {
        rows.push([
          idx + 1,
          p.period,
          p.total_pos,
          p.completed_pos,
          p.pending_pos,
          Number((p.taxable || "").replace(/[₹,]/g, "")),
          Number((p.itc_tax || "").replace(/[₹,]/g, "")),
          Number((p.gross_total || "").replace(/[₹,]/g, "")),
        ]);
      });
      rows.push([]);
      rows.push([
        "TOTAL SUMMARY",
        `${filteredPeriods.length} Periods`,
        `${periodTotals.totPos} POs`,
        "",
        "",
        Number(periodTotals.totTaxable.toFixed(2)),
        Number(periodTotals.totItc.toFixed(2)),
        Number(periodTotals.totGross.toFixed(2)),
      ]);
    } else if (activeTab === "invoices") {
      rows.push([
        "Date",
        "PO / Bill #",
        "Supplier Name",
        "Supplier GSTIN",
        "Source",
        "Payment Mode",
        "Taxable Base (₹)",
        "Tax Rate",
        "CGST (₹)",
        "SGST (₹)",
        "IGST (₹)",
        "Input Tax Credit (₹)",
        "Gross Total (₹)",
        "Status",
      ]);
      filteredInvoices.forEach((inv) => {
        rows.push([
          inv.date,
          inv.invoice_no,
          inv.supplier,
          inv.supplier_gstin || "—",
          inv.source,
          inv.payment_mode,
          inv.raw_taxable,
          inv.tax_rate,
          inv.raw_cgst,
          inv.raw_sgst,
          inv.raw_igst,
          inv.raw_tax,
          inv.raw_total,
          inv.status,
        ]);
      });
      rows.push([]);
      rows.push([
        "TOTAL SUMMARY",
        `${filteredInvoices.length} Orders`,
        "",
        "",
        "",
        "",
        Number(dynamicTotals.totTaxable.toFixed(2)),
        "",
        Number(dynamicTotals.totCgst.toFixed(2)),
        Number(dynamicTotals.totSgst.toFixed(2)),
        Number(dynamicTotals.totIgst.toFixed(2)),
        Number(dynamicTotals.totTax.toFixed(2)),
        Number(dynamicTotals.totGross.toFixed(2)),
        "",
      ]);
    } else {
      rows.push(["GST Slab Rate (ITC)", "Bills Count", "Taxable Base (₹)", "CGST (₹)", "SGST (₹)", "IGST (₹)", "Total ITC Tax (₹)", "Gross Procurement (₹)"]);
      taxSlabsData.forEach((s) => {
        rows.push([
          s.slab,
          s.invoices_count,
          Number((s.taxable || "").replace(/[₹,]/g, "")),
          Number((s.cgst || "").replace(/[₹,]/g, "")),
          Number((s.sgst || "").replace(/[₹,]/g, "")),
          Number((s.igst || "").replace(/[₹,]/g, "")),
          Number((s.total_tax || "").replace(/[₹,]/g, "")),
          Number((s.gross_total || "").replace(/[₹,]/g, "")),
        ]);
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Purchase Summary");
    XLSX.writeFile(wb, `purchase_summary_${activeTab}_${dateStr}.xlsx`);
    toast.success("Exported Purchase Summary as Excel (.xlsx)");
    setShowExportDropdown(false);
  };

  // ── EXPORT CSV ───────────────────────────────────────────────────────────────
  const handleExportCsv = () => {
    const companyName = (tenant as any)?.name || "IOTRONCS ERP";
    const metaHeader = [
      `"COMPANY NAME:","${companyName.replace(/"/g, '""')}"`,
      `"REPORT TITLE:","Purchase Summary Report - ${activeTab.toUpperCase()}"`,
      `"PERIOD:","${dateFilter.toUpperCase()}"`,
      `"GENERATED ON:","${formatDisplayDateTime(new Date()).replace(/"/g, '""')}"`,
      `""`,
    ].join("\n");

    let headers = "";
    let rowLines: string[] = [];

    if (activeTab === "periods") {
      headers = `"Month / Period","Total POs","Completed Orders","Pending Approval","Taxable Procurement (₹)","Input Tax Credit (₹)","Gross Procurement (₹)"`;
      rowLines = filteredPeriods.map((p) => {
        return `"${p.period}","${p.total_pos}","${p.completed_pos}","${p.pending_pos}","${p.taxable}","${p.itc_tax}","${p.gross_total}"`;
      });
    } else {
      headers = `"Date","PO / Bill #","Supplier","GSTIN","Source","Payment Mode","Taxable Base (₹)","Tax Rate","CGST (₹)","SGST (₹)","IGST (₹)","Total ITC (₹)","Gross Total (₹)","Status"`;
      rowLines = filteredInvoices.map((inv) => {
        return `"${inv.date}","${inv.invoice_no}","${inv.supplier.replace(/"/g, '""')}","${inv.supplier_gstin || "—"}","${inv.source}","${inv.payment_mode}","${inv.raw_taxable.toFixed(2)}","${inv.tax_rate}","${inv.raw_cgst.toFixed(2)}","${inv.raw_sgst.toFixed(2)}","${inv.raw_igst.toFixed(2)}","${inv.raw_tax.toFixed(2)}","${inv.raw_total.toFixed(2)}","${inv.status}"`;
      });
    }

    const fullCsv = metaHeader + "\n" + headers + "\n" + rowLines.join("\n");
    const blob = new Blob(["\uFEFF" + fullCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `purchase_summary_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Exported Purchase Summary as CSV");
    setShowExportDropdown(false);
  };

  // ── PRINT PDF ────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 font-sans">
      {/* ──────────────────────────────────────────────────────────────────────────
          TOP HEADER & ACTIONS (MATCHING SALES SUMMARY REPORT SUITE)
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
                  <ShoppingBag className="size-4" />
                </div>
                <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Purchase Summary
                </h1>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Sparkles className="size-2.5" /> Live DB
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Total procurement volume, purchase orders & landed cost values.
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
          KPI SUMMARY STATS CARDS (SAME PROPORTIONAL LAYOUT AS SALES SUMMARY)
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* 1. Gross Procurement Value */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Gross Procurement Value
            </span>
            <span className="text-base font-extrabold text-slate-900 font-mono mt-0.5 block truncate">
              {summaryTotals.total_procurement_value || "₹0.00"}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              {summaryTotals.active_invoices || 0} Recorded Orders
            </span>
          </div>

          {/* 2. Taxable Base */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Taxable Procurement Base
            </span>
            <span className="text-base font-extrabold text-slate-900 font-mono mt-0.5 block truncate">
              {summaryTotals.total_taxable || "₹0.00"}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">Pre-tax Procurement Cost</span>
          </div>

          {/* 3. Input Tax Credit (ITC) */}
          <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-3">
            <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
              Input Tax Credit (ITC)
            </span>
            <span className="text-base font-extrabold text-indigo-700 font-mono mt-0.5 block truncate">
              {summaryTotals.total_eligible_itc || "₹0.00"}
            </span>
            <span className="text-[10px] text-indigo-600 font-medium">Eligible GST Credit</span>
          </div>

          {/* 4. Total Orders Raised */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Total Orders Raised
            </span>
            <span className="text-base font-extrabold text-slate-900 font-mono mt-0.5 block truncate">
              {summaryTotals.total_orders_raised || "0 POs"}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">Purchase Orders & Bills</span>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          FILTER TOOLBAR & 3 TABS
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 pt-3 pb-0 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          {/* Search Input */}
          <div className="relative min-w-[260px] max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter current report rows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          {/* Tax Rate Filter (when in invoices or slabs) */}
          {activeTab !== "periods" && taxRateOptions.length > 0 && (
            <div className="relative">
              <select
                value={selectedTaxRate}
                onChange={(e) => setSelectedTaxRate(e.target.value)}
                className="h-8 pl-3 pr-7 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All GST Slabs</option>
                {taxRateOptions.map((rate) => (
                  <option key={rate} value={rate}>
                    {rate} Tax Slab
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-slate-400 pointer-events-none" />
            </div>
          )}

          {/* Period Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
              <CalendarIcon className="size-3.5 text-slate-400" /> Period:
            </span>
            <div className="relative">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="h-8 pl-3 pr-7 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Time (All Recorded Invoices)</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="this_week">This Week</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
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

        {/* ── 3 QUICK TABS (MONTHLY SUMMARY / ALL BILLS / TAX SLABS) ── */}
        <div className="flex items-center gap-0 border-b border-slate-200">
          {/* Tab 1: Monthly / Periodic Summary */}
          <button
            type="button"
            onClick={() => setActiveTab("periods")}
            className={`px-5 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === "periods"
                ? "border-indigo-600 text-indigo-700 bg-indigo-50/30"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <CalendarIcon className="size-3.5" />
            <span>Monthly Summary</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-slate-200/70 text-slate-700">
              {filteredPeriods.length}
            </span>
          </button>

          {/* Tab 2: All Purchase Orders / Bills */}
          <button
            type="button"
            onClick={() => setActiveTab("invoices")}
            className={`px-5 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === "invoices"
                ? "border-indigo-600 text-indigo-700 bg-indigo-50/30"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Receipt className="size-3.5" />
            <span>Purchase Bills & Orders</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-slate-200/70 text-slate-700">
              {filteredInvoices.length}
            </span>
          </button>

          {/* Tab 3: Tax Slabs Breakdown */}
          <button
            type="button"
            onClick={() => setActiveTab("slabs")}
            className={`px-5 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === "slabs"
                ? "border-indigo-600 text-indigo-700 bg-indigo-50/30"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Layers className="size-3.5" />
            <span>Tax Slabs Breakdown (ITC)</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-slate-200/70 text-slate-700">
              {taxSlabsData.length}
            </span>
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          MAIN REPORT BODY
      ────────────────────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
            <p className="text-sm font-bold text-slate-700">Loading purchase summary...</p>
            <p className="text-xs text-slate-400 mt-1">Executing real database procurement queries</p>
          </div>
        ) : activeTab === "periods" ? (
          /* ── TAB 1: MONTHLY SUMMARY TABLE (EXACT MATCH TO REFERENCE SCREENSHOT, REAL DATA) ── */
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 w-10 text-center">#</th>
                    <th className="py-3 px-4">MONTH / PERIOD</th>
                    <th className="py-3 px-4">TOTAL POS CREATED</th>
                    <th className="py-3 px-4">COMPLETED ORDERS</th>
                    <th className="py-3 px-4">PENDING APPROVAL</th>
                    <th className="py-3 px-4 text-right">TAXABLE PROCUREMENT (₹)</th>
                    <th className="py-3 px-4 text-right">INPUT TAX CREDIT (₹)</th>
                    <th className="py-3 px-4 text-right">GROSS PROCUREMENT (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                  {filteredPeriods.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-slate-400 text-xs font-semibold">
                        No purchase orders recorded for the selected period.
                      </td>
                    </tr>
                  ) : (
                    filteredPeriods.map((p, idx) => (
                      <tr key={p.period} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{p.period}</td>
                        <td className="py-3 px-4 text-slate-700 font-medium">{p.total_pos}</td>
                        <td className="py-3 px-4 text-emerald-700 font-medium">{p.completed_pos}</td>
                        <td className="py-3 px-4 text-slate-500 font-medium">{p.pending_pos}</td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-slate-700">{p.taxable}</td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-indigo-700">{p.itc_tax}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{p.gross_total}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Summary Matching User Screenshot */}
            <div className="bg-slate-50/90 border-t border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-3">
              <span className="font-bold text-slate-500 uppercase tracking-wider">
                TOTAL RECORDS: {filteredPeriods.length}
              </span>
              <div className="flex flex-wrap items-center gap-5 text-right font-medium">
                <span>
                  Total Procurement Value: <strong className="font-mono text-slate-900 font-bold">{formatCurrency(periodTotals.totGross)}</strong>
                </span>
                <span>
                  Total Eligible ITC: <strong className="font-mono text-indigo-700 font-bold">{formatCurrency(periodTotals.totItc)}</strong>
                </span>
                <span>
                  Total Orders Raised: <strong className="font-mono text-slate-900 font-bold">{periodTotals.totPos} POs</strong>
                </span>
              </div>
            </div>
          </div>
        ) : activeTab === "invoices" ? (
          /* ── TAB 2: DETAILED ITEM-WISE PURCHASE ORDERS & BILLS REGISTER ── */
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3 w-8"></th>
                    <th className="py-3 px-3">DATE</th>
                    <th className="py-3 px-3">PO / BILL #</th>
                    <th className="py-3 px-3">SUPPLIER</th>
                    <th className="py-3 px-3">SOURCE</th>
                    <th className="py-3 px-3 text-right">TAXABLE (₹)</th>
                    <th className="py-3 px-3 text-center">RATE</th>
                    <th className="py-3 px-3 text-right">CGST (₹)</th>
                    <th className="py-3 px-3 text-right">SGST (₹)</th>
                    <th className="py-3 px-3 text-right">TOTAL ITC (₹)</th>
                    <th className="py-3 px-3 text-right">GROSS (₹)</th>
                    <th className="py-3 px-3 text-center">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-16 text-center text-slate-400 text-xs font-semibold">
                        No purchase orders matching filters.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => {
                      const isExpanded = Boolean(expandedInvoiceIds[inv.id || inv.invoice_no]);
                      const hasItems = Array.isArray(inv.items) && inv.items.length > 0;

                      return (
                        <React.Fragment key={inv.id || inv.invoice_no}>
                          <tr
                            onClick={(e) => hasItems && toggleRowExpansion(inv.id || inv.invoice_no, e)}
                            className={`hover:bg-slate-50/80 transition-colors ${hasItems ? "cursor-pointer" : ""}`}
                          >
                            <td className="py-3 px-3 text-center text-slate-400">
                              {hasItems && (
                                <ChevronRight className={`size-3.5 transition-transform ${isExpanded ? "rotate-90 text-indigo-600" : ""}`} />
                              )}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap text-slate-600 font-mono text-[11px]">{inv.date}</td>
                            <td className="py-3 px-3 font-bold text-indigo-700 font-mono">{inv.invoice_no}</td>
                            <td className="py-3 px-3 font-bold text-slate-900">{inv.supplier}</td>
                            <td className="py-3 px-3 text-slate-600">{inv.source}</td>
                            <td className="py-3 px-3 text-right font-mono font-medium">{inv.taxable_amount}</td>
                            <td className="py-3 px-3 text-center font-mono text-slate-600">{inv.tax_rate}</td>
                            <td className="py-3 px-3 text-right font-mono text-slate-600">{inv.cgst}</td>
                            <td className="py-3 px-3 text-right font-mono text-slate-600">{inv.sgst}</td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-indigo-700">{inv.total_tax}</td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">{inv.total_amount}</td>
                            <td className="py-3 px-3 text-center">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                                {inv.status}
                              </span>
                            </td>
                          </tr>

                          {/* Expandable Line Items Drawer */}
                          {isExpanded && hasItems && (
                            <tr className="bg-indigo-50/30">
                              <td colSpan={12} className="p-3 pl-12 pr-6">
                                <div className="bg-white rounded-xl border border-indigo-100 p-3 shadow-xs">
                                  <div className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <Boxes className="size-3.5 text-indigo-600" /> Itemized Procurement Line Items ({inv.items!.length} SKUs)
                                  </div>
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                                      <tr>
                                        <th className="py-1.5 px-3">PRODUCT</th>
                                        <th className="py-1.5 px-3">SKU</th>
                                        <th className="py-1.5 px-3">HSN</th>
                                        <th className="py-1.5 px-3 text-right">QTY</th>
                                        <th className="py-1.5 px-3 text-right">UNIT PRICE</th>
                                        <th className="py-1.5 px-3 text-center">TAX RATE</th>
                                        <th className="py-1.5 px-3 text-right">TOTAL</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium">
                                      {inv.items!.map((it, iIdx) => (
                                        <tr key={iIdx} className="hover:bg-slate-50/50">
                                          <td className="py-1.5 px-3 font-semibold text-slate-800">{it.name}</td>
                                          <td className="py-1.5 px-3 text-slate-500 font-mono text-[11px]">{it.sku}</td>
                                          <td className="py-1.5 px-3 text-slate-500 font-mono text-[11px]">{it.hsn_code}</td>
                                          <td className="py-1.5 px-3 text-right font-mono">{it.qty}</td>
                                          <td className="py-1.5 px-3 text-right font-mono">{it.price}</td>
                                          <td className="py-1.5 px-3 text-center font-mono text-slate-500">{it.tax_rate}</td>
                                          <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">{it.total}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ── TAB 3: TAX SLABS BREAKDOWN (INPUT TAX CREDIT - ITC) ── */
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">TAX SLAB RATE</th>
                    <th className="py-3 px-4">TOTAL ORDERS</th>
                    <th className="py-3 px-4 text-right">TAXABLE BASE (₹)</th>
                    <th className="py-3 px-4 text-right">CGST (₹)</th>
                    <th className="py-3 px-4 text-right">SGST (₹)</th>
                    <th className="py-3 px-4 text-right">IGST (₹)</th>
                    <th className="py-3 px-4 text-right">TOTAL ITC TAX (₹)</th>
                    <th className="py-3 px-4 text-right">GROSS TOTAL (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                  {taxSlabsData.map((s) => (
                    <tr key={s.slab} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <span className="size-2 rounded-full bg-indigo-600 inline-block"></span>
                        <span>{s.slab}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{s.invoices_count}</td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-slate-700">{s.taxable}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">{s.cgst}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">{s.sgst}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">{s.igst}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-indigo-700">{s.total_tax}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{s.gross_total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

