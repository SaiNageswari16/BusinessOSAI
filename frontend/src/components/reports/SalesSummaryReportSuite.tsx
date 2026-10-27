import React, { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
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
  ShoppingBag,
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

export interface InvoiceItemDetail {
  product_id?: string;
  name: string;
  product_name?: string;
  sku?: string;
  hsn_code?: string;
  qty: number;
  price: string;
  tax: string;
  tax_rate?: string;
  cgst?: string;
  sgst?: string;
  igst?: string;
  total: string;
  raw_price?: number;
  raw_tax?: number;
  raw_total?: number;
}

export interface SalesInvoiceRow {
  id: string;
  date: string;
  invoice_no: string;
  customer: string;
  customer_phone?: string;
  customer_gstin?: string;
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
  items?: InvoiceItemDetail[];
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

export interface ChannelSummaryRow {
  channel: string;
  bills_count: string;
  taxable: string;
  cgst: string;
  sgst: string;
  igst: string;
  total_tax: string;
  discounts: string;
  turnover: string;
  aov: string;
}

interface SalesSummaryReportSuiteProps {
  onBack?: () => void;
}

export function SalesSummaryReportSuite({ onBack }: SalesSummaryReportSuiteProps) {
  const { tenant } = useTenant();
  const { formatCurrency } = useCurrency();

  // Tab State: "invoices" | "slabs" | "channels"
  const [activeTab, setActiveTab] = useState<"invoices" | "slabs" | "channels">("invoices");

  // Filters
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customStartDate, setCustomStartDate] = useState<string>(getTodayDateString());
  const [customEndDate, setCustomEndDate] = useState<string>(getTodayDateString());
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [selectedTaxRate, setSelectedTaxRate] = useState<string>("all");

  // Loading & Data States
  const [loading, setLoading] = useState<boolean>(true);
  const [invoicesData, setInvoicesData] = useState<SalesInvoiceRow[]>([]);
  const [taxSlabsData, setTaxSlabsData] = useState<TaxSlabRow[]>([]);
  const [channelsData, setChannelsData] = useState<ChannelSummaryRow[]>([]);
  const [summaryTotals, setSummaryTotals] = useState<any>({
    active_invoices: 0,
    cancelled_repaid_invoices: 0,
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
    total_discounts: "₹0.00",
    raw_discount: 0,
    overall_aov: "₹0.00",
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
        entity: "sales_summary",
        reportId: "sales_summary",
        dateRange: dateFilter,
        startDate: dateFilter === "custom" ? customStartDate : undefined,
        endDate: dateFilter === "custom" ? customEndDate : undefined,
        filters: {
          search: searchQuery || undefined,
        },
      };

      const res = await inventoryApi.generateCustomReport(payload);
      if (res) {
        if (Array.isArray(res.tableData)) {
          setInvoicesData(res.tableData);
        }
        if (Array.isArray(res.taxSlabs)) {
          setTaxSlabsData(res.taxSlabs);
        }
        if (Array.isArray(res.channelsSummary)) {
          setChannelsData(res.channelsSummary);
        }
        if (res.summaryTotals) {
          setSummaryTotals(res.summaryTotals);
        }
      }
    } catch (err: any) {
      console.error("Failed to load sales summary report:", err);
      toast.error(err.message || "Failed to load sales summary report");
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

  // Toggle all rows expanded/collapsed
  const toggleAllExpansion = () => {
    const anyExpanded = Object.values(expandedInvoiceIds).some(Boolean);
    if (anyExpanded) {
      setExpandedInvoiceIds({});
    } else {
      const all: Record<string, boolean> = {};
      invoicesData.forEach((inv) => {
        all[inv.id || inv.invoice_no] = true;
      });
      setExpandedInvoiceIds(all);
    }
  };

  // Safe helper to format row Date & Time (guarantees local IST timezone and 12-hour AM/PM)
  const getFormattedDateTime = (inv: InvoiceReportRow) => {
    if (inv.date && (inv.date.includes("AM") || inv.date.includes("PM"))) {
      return inv.date;
    }
    const targetDate = inv.raw_date || inv.date;
    if (targetDate) {
      const d = formatDisplayDate(targetDate);
      const t = formatSafeTime(targetDate);
      if (d && t) return `${d} ${t}`;
      if (d) return d;
    }
    return inv.date || "—";
  };

  // Channel options
  const channelOptions = useMemo(() => {
    const set = new Set<string>();
    invoicesData.forEach((inv) => {
      const num = (inv.invoice_no || "").trim().toUpperCase();
      const src = (inv.source || "").trim().toLowerCase();
      if (
        num.startsWith("CN-") ||
        num.startsWith("CN ") ||
        num.startsWith("DN-") ||
        num.startsWith("DN ") ||
        num.startsWith("OPN-") ||
        src.includes("credit note") ||
        src.includes("debit note")
      ) {
        return;
      }
      if (inv.source) set.add(inv.source);
    });
    return Array.from(set);
  }, [invoicesData]);

  // Tax Rate options
  const taxRateOptions = useMemo(() => {
    const set = new Set<string>();
    invoicesData.forEach((inv) => {
      const num = (inv.invoice_no || "").trim().toUpperCase();
      if (num.startsWith("CN-") || num.startsWith("DN-") || num.startsWith("OPN-")) return;
      if (inv.tax_rate) set.add(inv.tax_rate);
    });
    return Array.from(set);
  }, [invoicesData]);

  // Filtered rows for current active search and channel
  const filteredInvoices = useMemo(() => {
    let list = invoicesData;

    // Exclude Credit Notes and Debit Notes from Sales Summary Report
    list = list.filter((inv) => {
      const num = (inv.invoice_no || "").trim().toUpperCase();
      const src = (inv.source || "").trim().toLowerCase();
      if (
        num.startsWith("CN-") ||
        num.startsWith("CN ") ||
        num.startsWith("DN-") ||
        num.startsWith("DN ") ||
        num.startsWith("OPN-") ||
        src.includes("credit note") ||
        src.includes("debit note")
      ) {
        return false;
      }
      return true;
    });

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (inv) =>
          inv.invoice_no.toLowerCase().includes(q) ||
          inv.customer.toLowerCase().includes(q) ||
          (inv.customer_phone && inv.customer_phone.includes(q)) ||
          (inv.customer_gstin && inv.customer_gstin.toLowerCase().includes(q))
      );
    }

    // Channel filter
    if (selectedChannel !== "all") {
      list = list.filter((inv) => inv.source.toLowerCase() === selectedChannel.toLowerCase());
    }

    // Tax Rate filter
    if (selectedTaxRate !== "all") {
      list = list.filter((inv) => inv.tax_rate === selectedTaxRate);
    }

    return list;
  }, [invoicesData, searchQuery, selectedChannel, selectedTaxRate]);

  // Dynamic totals for filtered invoices
  const dynamicTotals = useMemo(() => {
    let totTaxable = 0;
    let totCgst = 0;
    let totSgst = 0;
    let totIgst = 0;
    let totTax = 0;
    let totDisc = 0;
    let totGross = 0;

    filteredInvoices.forEach((inv) => {
      totTaxable += inv.raw_taxable || 0;
      totCgst += inv.raw_cgst || 0;
      totSgst += inv.raw_sgst || 0;
      totIgst += inv.raw_igst || 0;
      totTax += inv.raw_tax || 0;
      totDisc += inv.raw_discount || 0;
      totGross += inv.raw_total || 0;
    });

    return {
      count: filteredInvoices.length,
      totTaxable,
      totCgst,
      totSgst,
      totIgst,
      totTax,
      totDisc,
      totGross,
    };
  }, [filteredInvoices]);

  // ── EXPORT EXCEL ─────────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    const rows: any[][] = [];
    const dateStr = new Date().toISOString().slice(0, 10);
    const companyName = (tenant as any)?.name || "Sai Enterprises";
    const companyGstin = getActiveBillingGst() || "—";

    rows.push([companyName]);
    rows.push(["SALES SUMMARY & TAX DEDUCTION REGISTER"]);
    rows.push([`Period: ${dateFilter.toUpperCase()} | Generated: ${formatDisplayDateTime(new Date())} | GSTIN: ${companyGstin}`]);
    rows.push([]);

    if (activeTab === "invoices") {
      rows.push([
        "Invoice Date & Time",
        "Invoice / Bill #",
        "Customer Name",
        "Customer GSTIN",
        "Source / Channel",
        "Payment Mode",
        "Taxable Base (₹)",
        "Tax Rate",
        "CGST (₹)",
        "SGST (₹)",
        "IGST (₹)",
        "Total Tax Deducted (₹)",
        "Discount (₹)",
        "Invoice Total (₹)",
        "Status",
      ]);

      filteredInvoices.forEach((inv) => {
        rows.push([
          getFormattedDateTime(inv),
          inv.invoice_no,
          inv.customer,
          inv.customer_gstin || "—",
          inv.source,
          inv.payment_mode,
          inv.raw_taxable,
          inv.tax_rate,
          inv.raw_cgst,
          inv.raw_sgst,
          inv.raw_igst,
          inv.raw_tax,
          inv.raw_discount,
          inv.raw_total,
          inv.status,
        ]);
      });

      rows.push([]);
      rows.push([
        "TOTAL SUMMARY",
        `${filteredInvoices.length} Invoices`,
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
        Number(dynamicTotals.totDisc.toFixed(2)),
        Number(dynamicTotals.totGross.toFixed(2)),
        "",
      ]);
    } else if (activeTab === "slabs") {
      rows.push([
        "GST Slab Rate",
        "Invoices Count",
        "Taxable Base (₹)",
        "CGST (₹)",
        "SGST (₹)",
        "IGST (₹)",
        "Total Tax Collected (₹)",
        "Gross Invoiced (₹)",
      ]);
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
    } else {
      rows.push([
        "Channel / Register",
        "Total Bills Count",
        "Taxable Turnover (₹)",
        "CGST (₹)",
        "SGST (₹)",
        "IGST (₹)",
        "Total GST (₹)",
        "Discounts (₹)",
        "Gross Turnover (₹)",
        "Average Order Value (₹)",
      ]);
      channelsData.forEach((c) => {
        rows.push([
          c.channel,
          c.bills_count,
          Number((c.taxable || "").replace(/[₹,]/g, "")),
          Number((c.cgst || "").replace(/[₹,]/g, "")),
          Number((c.sgst || "").replace(/[₹,]/g, "")),
          Number((c.igst || "").replace(/[₹,]/g, "")),
          Number((c.total_tax || "").replace(/[₹,]/g, "")),
          Number((c.discounts || "").replace(/[₹,]/g, "")),
          Number((c.turnover || "").replace(/[₹,]/g, "")),
          Number((c.aov || "").replace(/[₹,]/g, "")),
        ]);
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales Summary");
    XLSX.writeFile(wb, `sales_summary_tax_report_${activeTab}_${dateStr}.xlsx`);
    toast.success("Exported Sales Summary Report as Excel (.xlsx)");
    setShowExportDropdown(false);
  };

  // ── EXPORT CSV ───────────────────────────────────────────────────────────────
  const handleExportCsv = () => {
    const companyName = (tenant as any)?.name || "Sai Enterprises";
    const companyGstin = getActiveBillingGst() || "—";
    const metaHeader = [
      `"COMPANY NAME:","${companyName.replace(/"/g, '""')}"`,
      `"REPORT TITLE:","Sales Summary & Tax Breakdown Register - ${activeTab.toUpperCase()}"`,
      `"GSTIN:","${companyGstin}"`,
      `"PERIOD:","${dateFilter.toUpperCase()}"`,
      `"GENERATED ON:","${formatDisplayDateTime(new Date()).replace(/"/g, '""')}"`,
      `""`,
    ].join("\n");

    const headers = `"Date & Time","Invoice / Bill #","Customer","GSTIN","Channel","Payment Mode","Taxable Base (₹)","Tax Rate","CGST (₹)","SGST (₹)","IGST (₹)","Total Tax (₹)","Discount (₹)","Invoice Total (₹)","Status"`;

    const rowLines = filteredInvoices.map((inv) => {
      return `"${inv.date}","${inv.invoice_no}","${inv.customer.replace(/"/g, '""')}","${inv.customer_gstin || "—"}","${inv.source}","${inv.payment_mode}","${inv.raw_taxable.toFixed(2)}","${inv.tax_rate}","${inv.raw_cgst.toFixed(2)}","${inv.raw_sgst.toFixed(2)}","${inv.raw_igst.toFixed(2)}","${inv.raw_tax.toFixed(2)}","${inv.raw_discount.toFixed(2)}","${inv.raw_total.toFixed(2)}","${inv.status}"`;
    });

    const summaryLine = `\n\n"TOTALS:","${filteredInvoices.length} Invoices","","","","","${dynamicTotals.totTaxable.toFixed(2)}","","${dynamicTotals.totCgst.toFixed(2)}","${dynamicTotals.totSgst.toFixed(2)}","${dynamicTotals.totIgst.toFixed(2)}","${dynamicTotals.totTax.toFixed(2)}","${dynamicTotals.totDisc.toFixed(2)}","${dynamicTotals.totGross.toFixed(2)}",""`;

    const fullCsv = metaHeader + "\n" + headers + "\n" + rowLines.join("\n") + summaryLine;
    const blob = new Blob(["\uFEFF" + fullCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sales_summary_tax_report_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Exported Sales Summary Report as CSV");
    setShowExportDropdown(false);
  };

  // ── PRINT PDF ────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const companyName = (tenant as any)?.name || "Sai Enterprises";
    const companyGstin = getActiveBillingGst() || "—";

    const tableRowsHtml = filteredInvoices
      .map(
        (inv, i) => `
        <tr>
          <td style="text-align: center; color: #64748b;">${i + 1}</td>
          <td>${inv.date}</td>
          <td><strong>${inv.invoice_no}</strong></td>
          <td>${inv.customer}</td>
          <td>${inv.source}</td>
          <td style="text-align: right;">${inv.taxable_amount}</td>
          <td style="text-align: center;">${inv.tax_rate}</td>
          <td style="text-align: right;">${inv.cgst}</td>
          <td style="text-align: right;">${inv.sgst}</td>
          <td style="text-align: right;">${inv.igst}</td>
          <td style="text-align: right; font-weight: 700; color: #4338ca;">${inv.total_tax}</td>
          <td style="text-align: right; font-weight: 700;">${inv.total_amount}</td>
          <td style="text-align: center; font-size: 8.5px;">${inv.status}</td>
        </tr>
      `
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sales Summary & Tax Breakdown - ${companyName}</title>
        <meta charset="utf-8" />
        <style>
          @page { size: A4 landscape; margin: 8mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 9px; color: #0f172a; margin: 0; padding: 10px; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #4f46e5; padding-bottom: 8px; margin-bottom: 12px; }
          .header h1 { margin: 0; font-size: 15px; color: #1e1b4b; }
          .meta { font-size: 8.5px; color: #64748b; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th { background: #f8fafc; border: 1px solid #cbd5e1; padding: 4.5px 5.5px; font-size: 8px; text-transform: uppercase; color: #334155; }
          td { border: 1px solid #e2e8f0; padding: 4.5px 5.5px; font-size: 8.5px; }
          tr:nth-child(even) { background: #f8fafc; }
          .totals { background: #eef2ff; border: 1px solid #c7d2fe; padding: 7px 10px; margin-top: 12px; display: flex; justify-content: flex-end; gap: 16px; font-size: 9.5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>Sales Summary & Tax Deduction Register</h1>
            <div class="meta">Company: <strong>${companyName}</strong> &bull; GSTIN: <strong>${companyGstin}</strong></div>
          </div>
          <div style="text-align: right;" class="meta">
            <div>Period: <strong>${dateFilter.toUpperCase()}</strong></div>
            <div>Generated: ${formatDisplayDateTime(new Date())}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 25px;">#</th>
              <th>Date & Time</th>
              <th>Invoice #</th>
              <th>Customer</th>
              <th>Channel</th>
              <th style="text-align: right;">Taxable (₹)</th>
              <th style="text-align: center;">Rate</th>
              <th style="text-align: right;">CGST (₹)</th>
              <th style="text-align: right;">SGST (₹)</th>
              <th style="text-align: right;">IGST (₹)</th>
              <th style="text-align: right;">Total Tax (₹)</th>
              <th style="text-align: right;">Total (₹)</th>
              <th style="text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
        <div class="totals">
          <div>Invoices: <strong>${filteredInvoices.length}</strong></div>
          <div>Taxable Turnover: <strong>${formatCurrency(dynamicTotals.totTaxable)}</strong></div>
          <div>Total CGST: <strong>${formatCurrency(dynamicTotals.totCgst)}</strong></div>
          <div>Total SGST: <strong>${formatCurrency(dynamicTotals.totSgst)}</strong></div>
          <div>Total IGST: <strong>${formatCurrency(dynamicTotals.totIgst)}</strong></div>
          <div style="color: #4338ca;">Total GST: <strong>${formatCurrency(dynamicTotals.totTax)}</strong></div>
          <div style="color: #047857;">Gross Turnover: <strong>${formatCurrency(dynamicTotals.totGross)}</strong></div>
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
                  <TrendingUp className="size-4" />
                </div>
                <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Sales Summary & Tax Deduction Register
                </h1>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Sparkles className="size-2.5" /> Live DB
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Comprehensive turnover, total invoices count, exact CGST/SGST/IGST tax deduction breakdown & product drilldowns.
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
          KPI SUMMARY STATS CARDS
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {/* 1. Total Turnover */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Gross Turnover
            </span>
            <span className="text-sm font-extrabold text-slate-900 font-mono mt-0.5 block truncate">
              {summaryTotals.net_gross_turnover || "₹0.00"}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              {summaryTotals.active_invoices || 0} Active Invoices
            </span>
          </div>

          {/* 2. Taxable Turnover */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Taxable Base
            </span>
            <span className="text-sm font-extrabold text-slate-900 font-mono mt-0.5 block truncate">
              {summaryTotals.total_taxable || "₹0.00"}
            </span>
            <span className="text-[10px] text-emerald-600 font-medium">Pre-tax Value</span>
          </div>

          {/* 3. CGST Output */}
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-2.5">
            <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
              CGST Output
            </span>
            <span className="text-sm font-extrabold text-indigo-900 font-mono mt-0.5 block truncate">
              {summaryTotals.total_cgst || "₹0.00"}
            </span>
            <span className="text-[10px] text-indigo-600 font-medium">Central GST</span>
          </div>

          {/* 4. SGST Output */}
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-2.5">
            <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
              SGST Output
            </span>
            <span className="text-sm font-extrabold text-indigo-900 font-mono mt-0.5 block truncate">
              {summaryTotals.total_sgst || "₹0.00"}
            </span>
            <span className="text-[10px] text-indigo-600 font-medium">State GST</span>
          </div>

          {/* 5. IGST Output */}
          <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-2.5">
            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">
              IGST Output
            </span>
            <span className="text-sm font-extrabold text-purple-900 font-mono mt-0.5 block truncate">
              {summaryTotals.total_igst || "₹0.00"}
            </span>
            <span className="text-[10px] text-purple-600 font-medium">Inter-state GST</span>
          </div>

          {/* 6. Total Tax Deducted / Collected */}
          <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-2.5">
            <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">
              Total Tax (GST)
            </span>
            <span className="text-sm font-extrabold text-indigo-700 font-mono mt-0.5 block truncate">
              {summaryTotals.total_gst || "₹0.00"}
            </span>
            <span className="text-[10px] text-indigo-600 font-medium">CGST + SGST + IGST</span>
          </div>

          {/* 7. Total Discounts */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Discounts Given
            </span>
            <span className="text-sm font-extrabold text-slate-800 font-mono mt-0.5 block truncate">
              {summaryTotals.total_discounts || "₹0.00"}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              AOV: {summaryTotals.overall_aov || "₹0.00"}
            </span>
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
              placeholder="Search invoice #, customer name, or GSTIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          {/* Channel Filter */}
          {channelOptions.length > 0 && (
            <div className="relative">
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="h-8 pl-3 pr-7 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Channels / Registers</option>
                {channelOptions.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-slate-400 pointer-events-none" />
            </div>
          )}

          {/* Tax Rate Filter */}
          {taxRateOptions.length > 0 && (
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

        {/* ── 3 QUICK TABS ── */}
        <div className="flex items-center justify-between border-b border-slate-200">
          <div className="flex items-center gap-1">
            {/* Tab 1: All Invoices */}
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
              <span>All Invoices (Detailed Tax Register)</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-slate-200/70 text-slate-700">
                {filteredInvoices.length}
              </span>
            </button>

            {/* Tab 2: Tax Slabs Breakdown */}
            <button
              type="button"
              onClick={() => setActiveTab("slabs")}
              className={`px-5 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
                activeTab === "slabs"
                  ? "border-indigo-600 text-indigo-700 bg-indigo-50/30"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Percent className="size-3.5" />
              <span>Tax Slabs Summary</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-slate-200/70 text-slate-700">
                {taxSlabsData.length} Slabs
              </span>
            </button>

            {/* Tab 3: Sales Channels */}
            <button
              type="button"
              onClick={() => setActiveTab("channels")}
              className={`px-5 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
                activeTab === "channels"
                  ? "border-indigo-600 text-indigo-700 bg-indigo-50/30"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Layers className="size-3.5" />
              <span>Channels & Registers</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-slate-200/70 text-slate-700">
                {channelsData.length}
              </span>
            </button>
          </div>

          {activeTab === "invoices" && (
            <button
              type="button"
              onClick={toggleAllExpansion}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors pb-1 cursor-pointer"
            >
              {Object.values(expandedInvoiceIds).some(Boolean) ? "Collapse All Items" : "Expand All Items"}
            </button>
          )}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          MAIN REPORT CONTENT
      ────────────────────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="size-6 text-indigo-600 animate-spin" />
            <p className="text-xs font-semibold text-slate-500">Querying live sales & tax records from database...</p>
          </div>
        ) : activeTab === "invoices" ? (
          filteredInvoices.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto mt-8 shadow-2xs">
              <div className="size-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                <Boxes className="size-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Sales Invoices Found</h3>
              <p className="text-xs text-slate-500 mt-1">
                No invoices matched your selected period or search criteria.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-3 w-10 text-center">#</th>
                      <th className="py-3 px-3">Date & Time</th>
                      <th className="py-3 px-3">Invoice / Bill #</th>
                      <th className="py-3 px-3">Customer Name</th>
                      <th className="py-3 px-3">Channel</th>
                      <th className="py-3 px-3 text-right">Taxable Base (₹)</th>
                      <th className="py-3 px-2 text-center">Tax Rate</th>
                      <th className="py-3 px-3 text-right">CGST (₹)</th>
                      <th className="py-3 px-3 text-right">SGST (₹)</th>
                      <th className="py-3 px-3 text-right">IGST (₹)</th>
                      <th className="py-3 px-3 text-right">Total Tax (₹)</th>
                      <th className="py-3 px-3 text-right">Gross Total (₹)</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3 text-center">Items</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredInvoices.map((inv, idx) => {
                      const rowId = inv.id || inv.invoice_no || `inv-${idx}`;
                      const isExpanded = Boolean(expandedInvoiceIds[rowId]);
                      const hasItems = Array.isArray(inv.items) && inv.items.length > 0;
                      const isCancelled = inv.status.toLowerCase().includes("cancel") || inv.status.toLowerCase().includes("repaid");

                      return (
                        <React.Fragment key={rowId}>
                          <tr
                            className={`hover:bg-slate-50/80 transition-colors group cursor-pointer ${
                              isExpanded ? "bg-indigo-50/30" : ""
                            }`}
                            onClick={() => toggleRowExpansion(rowId)}
                          >
                            {/* # */}
                            <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                              {idx + 1}
                            </td>

                            {/* Date & Time */}
                            <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap text-[11px]">
                              <div className="flex items-center gap-1.5 font-medium">
                                <CalendarIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{getFormattedDateTime(inv)}</span>
                              </div>
                            </td>

                            {/* Invoice No */}
                            <td className="py-3 px-3 font-bold font-mono text-indigo-700 whitespace-nowrap">
                              {inv.invoice_no}
                            </td>

                            {/* Customer */}
                            <td className="py-3 px-3">
                              <div className="font-semibold text-slate-900 truncate max-w-[150px]">
                                {inv.customer}
                              </div>
                              {inv.customer_gstin && inv.customer_gstin !== "—" && (
                                <div className="text-[10px] text-slate-400 font-mono">
                                  GST: {inv.customer_gstin}
                                </div>
                              )}
                            </td>

                            {/* Channel */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-md text-[10.5px] font-semibold ${
                                  inv.source.toLowerCase().includes("pos")
                                    ? "bg-purple-50 text-purple-700 border border-purple-200"
                                    : "bg-blue-50 text-blue-700 border border-blue-200"
                                }`}
                              >
                                {inv.source}
                              </span>
                            </td>

                            {/* Taxable Base */}
                            <td className="py-3 px-3 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">
                              {inv.taxable_amount}
                            </td>

                            {/* Tax Rate */}
                            <td className="py-3 px-2 text-center whitespace-nowrap">
                              <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px]">
                                {inv.tax_rate}
                              </span>
                            </td>

                            {/* CGST */}
                            <td className="py-3 px-3 text-right font-mono text-indigo-800 whitespace-nowrap">
                              {inv.cgst}
                            </td>

                            {/* SGST */}
                            <td className="py-3 px-3 text-right font-mono text-indigo-800 whitespace-nowrap">
                              {inv.sgst}
                            </td>

                            {/* IGST */}
                            <td className="py-3 px-3 text-right font-mono text-purple-800 whitespace-nowrap">
                              {inv.igst}
                            </td>

                            {/* Total Tax */}
                            <td className="py-3 px-3 text-right font-mono font-extrabold text-indigo-700 whitespace-nowrap">
                              {inv.total_tax}
                            </td>

                            {/* Gross Total */}
                            <td
                              className={`py-3 px-3 text-right font-mono font-extrabold whitespace-nowrap ${
                                isCancelled ? "text-rose-600" : "text-slate-900"
                              }`}
                            >
                              {inv.total_amount}
                            </td>

                            {/* Status */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  isCancelled
                                    ? "bg-rose-50 text-rose-700 border border-rose-200 font-extrabold"
                                    : inv.status.toLowerCase().includes("paid")
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200 font-bold"
                                }`}
                              >
                                {inv.status}
                              </span>
                            </td>

                            {/* Items Toggle Action */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              {hasItems ? (
                                <button
                                  type="button"
                                  onClick={(e) => toggleRowExpansion(rowId, e)}
                                  className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
                                >
                                  <span>{inv.items!.length} items</span>
                                  <ChevronDown
                                    className={`size-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                  />
                                </button>
                              ) : (
                                <span className="text-slate-400 text-[10px]">—</span>
                              )}
                            </td>
                          </tr>

                          {/* ── EXPANDED ITEM-LEVEL TAX BREAKDOWN ROW ── */}
                          {isExpanded && hasItems && (
                            <tr className="bg-indigo-50/20">
                              <td colSpan={14} className="p-3.5">
                                <div className="bg-white rounded-xl border border-indigo-200 p-3.5 shadow-xs space-y-2">
                                  <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                                    <div className="flex items-center gap-2">
                                      <Boxes className="size-4 text-indigo-600" />
                                      <h4 className="text-xs font-extrabold text-slate-900">
                                        Tax & Product Deduction Line Items &bull; Invoice #{inv.invoice_no}
                                      </h4>
                                    </div>
                                    <span className="text-[11px] font-semibold text-slate-500">
                                      Payment: <strong className="text-slate-700">{inv.payment_mode}</strong>
                                    </span>
                                  </div>

                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="bg-slate-50 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                                        <th className="py-2 px-3">#</th>
                                        <th className="py-2 px-3">Product / Service Name</th>
                                        <th className="py-2 px-3">SKU</th>
                                        <th className="py-2 px-3">HSN Code</th>
                                        <th className="py-2 px-3 text-right">Qty</th>
                                        <th className="py-2 px-3 text-right">Unit Price (₹)</th>
                                        <th className="py-2 px-3 text-center">Tax %</th>
                                        <th className="py-2 px-3 text-right">CGST (₹)</th>
                                        <th className="py-2 px-3 text-right">SGST (₹)</th>
                                        <th className="py-2 px-3 text-right">Line Tax (₹)</th>
                                        <th className="py-2 px-3 text-right">Line Total (₹)</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {inv.items!.map((it, itIdx) => (
                                        <tr key={itIdx} className="hover:bg-slate-50/80">
                                          <td className="py-2 px-3 text-slate-400 font-mono text-[10.5px]">
                                            {itIdx + 1}
                                          </td>
                                          <td className="py-2 px-3 font-semibold text-slate-800">
                                            {it.name || it.product_name}
                                          </td>
                                          <td className="py-2 px-3 font-mono text-slate-500 text-[10.5px]">
                                            {it.sku || "—"}
                                          </td>
                                          <td className="py-2 px-3 font-mono text-slate-600 text-[10.5px]">
                                            {it.hsn_code || "—"}
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono font-semibold">
                                            {it.qty}
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono text-slate-700">
                                            {it.price}
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px]">
                                              {it.tax_rate || inv.tax_rate}
                                            </span>
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono text-indigo-700">
                                            {it.cgst || (it.raw_tax ? formatCurrency(it.raw_tax / 2) : "₹0.00")}
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono text-indigo-700">
                                            {it.sgst || (it.raw_tax ? formatCurrency(it.raw_tax / 2) : "₹0.00")}
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono font-bold text-indigo-700">
                                            {it.tax}
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono font-extrabold text-slate-900">
                                            {it.total}
                                          </td>
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
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Bottom Totals Bar */}
              <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-slate-700">
                <div className="flex items-center gap-3">
                  <span>
                    TOTAL INVOICES: <strong className="text-slate-900">{filteredInvoices.length}</strong>
                  </span>
                  <span>&bull;</span>
                  <span>
                    TAXABLE TURNOVER:{" "}
                    <strong className="text-slate-900 font-mono">
                      {formatCurrency(dynamicTotals.totTaxable)}
                    </strong>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-6">
                  <div>
                    <span className="text-slate-500 font-normal">CGST: </span>
                    <strong className="text-indigo-800 font-mono">
                      {formatCurrency(dynamicTotals.totCgst)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 font-normal">SGST: </span>
                    <strong className="text-indigo-800 font-mono">
                      {formatCurrency(dynamicTotals.totSgst)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 font-normal">IGST: </span>
                    <strong className="text-purple-800 font-mono">
                      {formatCurrency(dynamicTotals.totIgst)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 font-normal">Total Tax: </span>
                    <strong className="text-indigo-700 font-mono text-sm">
                      {formatCurrency(dynamicTotals.totTax)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 font-normal">Gross Revenue: </span>
                    <strong className="text-emerald-700 font-mono text-sm">
                      {formatCurrency(dynamicTotals.totGross)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )
        ) : activeTab === "slabs" ? (
          /* ──────────────────────────────────────────────────────────────────────────
              TAB 2: TAX SLABS SUMMARY BREAKDOWN
          ────────────────────────────────────────────────────────────────────────── */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-indigo-600" /> GST Tax Slabs Analysis
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Turnover and tax collections categorized across 0%, 5%, 12%, 18%, and 28% GST rate brackets.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {taxSlabsData.length} Slabs Recorded
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">GST Slab Rate</th>
                    <th className="py-3 px-4 text-center">Invoices Count</th>
                    <th className="py-3 px-4 text-right">Taxable Turnover (₹)</th>
                    <th className="py-3 px-4 text-right">CGST Output (₹)</th>
                    <th className="py-3 px-4 text-right">SGST Output (₹)</th>
                    <th className="py-3 px-4 text-right">IGST Output (₹)</th>
                    <th className="py-3 px-4 text-right">Total Tax (₹)</th>
                    <th className="py-3 px-4 text-right">Gross Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {taxSlabsData.map((slab, i) => (
                    <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 font-bold text-slate-900">
                          <span className="size-2 rounded-full bg-indigo-600" />
                          {slab.slab}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-700">
                        {slab.invoices_count}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800">
                        {slab.taxable}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-indigo-800">
                        {slab.cgst}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-indigo-800">
                        {slab.sgst}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-purple-800">
                        {slab.igst}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-indigo-700">
                        {slab.total_tax}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-900">
                        {slab.gross_total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ──────────────────────────────────────────────────────────────────────────
              TAB 3: SALES CHANNELS & REGISTERS
          ────────────────────────────────────────────────────────────────────────── */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="size-4 text-indigo-600" /> Sales Channels & Registers Breakdown
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Breakdown across POS Counter registers, B2B Tax Invoices, and E-commerce Storefront orders.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {channelsData.length} Channels Active
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Sales Channel / Register</th>
                    <th className="py-3 px-4 text-center">Total Bills Count</th>
                    <th className="py-3 px-4 text-right">Taxable Turnover (₹)</th>
                    <th className="py-3 px-4 text-right">CGST Output (₹)</th>
                    <th className="py-3 px-4 text-right">SGST Output (₹)</th>
                    <th className="py-3 px-4 text-right">Total Tax (₹)</th>
                    <th className="py-3 px-4 text-right">Discounts (₹)</th>
                    <th className="py-3 px-4 text-right">Gross Turnover (₹)</th>
                    <th className="py-3 px-4 text-right">Average Order Value (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {channelsData.map((ch, i) => (
                    <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {ch.channel}
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-700">
                        {ch.bills_count}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800">
                        {ch.taxable}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-indigo-800">
                        {ch.cgst}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-indigo-800">
                        {ch.sgst}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-indigo-700">
                        {ch.total_tax}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {ch.discounts}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-900">
                        {ch.turnover}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-700">
                        {ch.aov}
                      </td>
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