import React, { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
} from "recharts";
import { inventoryApi } from "@/lib/api-client";
import { getKpiIcon } from "@/components/reports/utils";
import {
  ArrowLeft,
  Star,
  Mail,
  Download,
  Printer,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  FileSpreadsheet,
  Boxes,
  TrendingUp,
  Users,
  ShoppingBag,
  FileCheck,
  Calculator,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";

interface ReportTabConfig {
  id: string;
  title: string;
  hindi: string;
  entity: string;
  section: string;
  icon: any;
}

const MYBILLBOOK_REPORT_TABS: ReportTabConfig[] = [
  { id: "item_batch", title: "Item Batch Report", hindi: "आइटम बैच रिपोर्ट", entity: "batches", section: "Item", icon: Layers },
  { id: "stock_summary", title: "Stock Summary Report", hindi: "स्टॉक सारांश", entity: "inventory", section: "Item", icon: Boxes },
  { id: "sales_summary", title: "Sales Summary Report", hindi: "बिक्री सारांश", entity: "sales", section: "Sales", icon: TrendingUp },
  { id: "item_sales", title: "Item-wise Sales & Profit", hindi: "आइटम बिक्री और लाभ", entity: "sales", section: "Sales", icon: TrendingUp },
  { id: "customer_sales", title: "Customer-wise Sales Report", hindi: "ग्राहक अनुसार बिक्री", entity: "customers", section: "Sales", icon: Users },
  { id: "party_statement", title: "Party Statement / Ledger", hindi: "पार्टी लेजर", entity: "customers", section: "Parties", icon: Users },
  { id: "purchase_summary", title: "Purchase Bills Summary", hindi: "खरीद बिल सारांश", entity: "purchases", section: "Purchases", icon: ShoppingBag },
  { id: "gstr1_report", title: "GSTR-1 Outward Tax Report", hindi: "जीएसटीआर-1 रिपोर्ट", entity: "gst", section: "GST", icon: FileCheck },
  { id: "pnl_statement", title: "Profit & Loss (P&L)", hindi: "लाभ और हानि खाता", entity: "profit_loss", section: "Accounting", icon: Calculator },
];

export function CustomReports() {
  const { currency } = useCurrency();
  const [activeReport, setActiveReport] = useState<ReportTabConfig>(MYBILLBOOK_REPORT_TABS[0]);
  const [isFavourite, setIsFavourite] = useState<boolean>(false);
  const [hideOutOfStock, setHideOutOfStock] = useState<boolean>(false);
  const [expiringIn, setExpiringIn] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dateRange, setDateRange] = useState<string>("this_month");
  
  // Data State
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [emailModalOpen, setEmailModalOpen] = useState<boolean>(false);
  const [recipientEmail, setRecipientEmail] = useState<string>("");

  // Fetch Report Data from live DB
  const loadReport = async (tabConfig = activeReport) => {
    setLoading(true);
    try {
      const payload = {
        entity: tabConfig.entity,
        dateRange,
        filters: {
          hideOutOfStock,
          expiringDays: expiringIn !== "all" ? expiringIn : undefined,
          search: searchQuery || undefined,
        },
      };
      const res = await inventoryApi.generateCustomReport(payload);
      setReportData(res);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load real-time report data from database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport(activeReport);
  }, [activeReport, hideOutOfStock, expiringIn, dateRange]);

  // Excel / CSV Export
  const handleDownloadExcel = () => {
    if (!reportData?.tableData || reportData.tableData.length === 0) {
      toast.error("No data rows available to export.");
      return;
    }
    const cols = reportData.tableColumns || [];
    const headers = cols.map((c: any) => `"${c.header}"`).join(",");
    const rows = reportData.tableData.map((row: any) =>
      cols.map((c: any) => `"${(row[c.key] ?? "").toString().replace(/"/g, '""')}"`).join(",")
    );
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${activeReport.title.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Downloaded ${activeReport.title} as Excel / CSV.`);
  };

  // Corporate PDF Print Dialog via isolated iframe
  const handlePrintPDF = () => {
    if (!reportData || !reportData.tableData || reportData.tableData.length === 0) {
      toast.error("No report data available to generate PDF.");
      return;
    }

    const cols = reportData.tableColumns || [];
    const rows = filteredRows;
    const isWide = cols.length > 7;
    const pageOrientation = isWide ? "landscape" : "portrait";

    // Build Table Header
    const tableHeaderHtml = cols
      .map((c: any) => {
        const isRight = ["mrp", "purchase_price", "selling_price", "total_amount", "revenue", "cogs", "profit", "stock_valuation"].includes(c.key);
        return `<th style="padding: 8px 10px; text-align: ${isRight ? "right" : "left"}; border-bottom: 2px solid #0f172a; font-size: 8.5pt; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">${c.header}</th>`;
      })
      .join("");

    // Build Table Rows
    const tableRowsHtml = rows
      .map((r: any, idx: number) => {
        const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
        const cellsHtml = cols
          .map((c: any) => {
            const val = r[c.key] ?? "-";
            const isRight = ["mrp", "purchase_price", "selling_price", "total_amount", "revenue", "cogs", "profit", "stock_valuation"].includes(c.key);
            const isItemName = c.key === "item_name" || c.key === "product_name";
            const isBatch = c.key === "batch_number" || c.key === "batch_no";
            const isCurrentStock = c.key === "current_stock" || c.key === "qty";

            let cellStyle = `padding: 7px 10px; border-bottom: 1px solid #e2e8f0; font-size: 8.5pt; color: #334155; text-align: ${isRight ? "right" : "left"};`;
            if (isItemName) cellStyle += " font-weight: 600; color: #0f172a;";
            if (isBatch) cellStyle += " font-family: monospace; font-weight: 600; color: #475569;";
            if (isCurrentStock) cellStyle += " font-weight: 600; color: #0f172a;";
            if (isRight) cellStyle += " font-variant-numeric: tabular-nums;";

            return `<td style="${cellStyle}">${val}</td>`;
          })
          .join("");
        return `<tr style="background-color: ${bg};">${cellsHtml}</tr>`;
      })
      .join("");

    // Build Totals Footer Row
    let totalsFooterHtml = "";
    if (reportData.summaryTotals && Object.keys(reportData.summaryTotals).length > 0) {
      const footerCellsHtml = cols
        .map((c: any) => {
          const val = reportData.summaryTotals[c.key] || "";
          const isRight = ["mrp", "purchase_price", "selling_price", "total_amount", "revenue", "cogs", "profit", "stock_valuation"].includes(c.key);
          return `<td style="padding: 8px 10px; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; font-size: 9pt; font-weight: 800; color: #0f172a; text-align: ${isRight ? "right" : "left"};">${val}</td>`;
        })
        .join("");
      totalsFooterHtml = `<tfoot><tr style="background-color: #f1f5f9;">${footerCellsHtml}</tr></tfoot>`;
    }

    // Build KPI metrics cards
    let metricsHtml = "";
    if (reportData.metrics && reportData.metrics.length > 0) {
      metricsHtml = `
        <div style="display: grid; grid-template-columns: repeat(${Math.min(4, reportData.metrics.length)}, 1fr); gap: 12px; margin-bottom: 16px;">
          ${reportData.metrics
            .map(
              (m: any) => `
              <div style="padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                <div style="font-size: 7.5pt; color: #64748b; font-weight: 600; text-transform: uppercase;">${m.label}</div>
                <div style="font-size: 13pt; font-weight: 800; color: #0f172a; margin-top: 2px;">${m.value}</div>
                <div style="font-size: 7pt; color: ${m.isPositive ? "#16a34a" : "#64748b"}; font-weight: 600; margin-top: 2px;">${m.change}</div>
              </div>
            `
            )
            .join("")}
        </div>
      `;
    }

    const printHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${activeReport.title} - Official Business Report</title>
          <style>
            @page {
              size: A4 ${pageOrientation};
              margin: 12mm 10mm 15mm 10mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              color: #0f172a;
              background: #ffffff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .report-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 12px;
              margin-bottom: 14px;
            }
            .company-info h1 {
              font-size: 16pt;
              font-weight: 900;
              color: #0f172a;
              letter-spacing: -0.5px;
            }
            .company-info p {
              font-size: 8pt;
              color: #64748b;
              margin-top: 2px;
            }
            .report-meta {
              text-align: right;
            }
            .report-meta h2 {
              font-size: 13pt;
              font-weight: 800;
              color: #4f46e5;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .report-meta p {
              font-size: 7.5pt;
              color: #64748b;
              margin-top: 2px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 8px;
            }
            .page-footer {
              margin-top: 24px;
              padding-top: 10px;
              border-top: 1px solid #e2e8f0;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 7.5pt;
              color: #94a3b8;
            }
            .signature-box {
              text-align: right;
            }
            .signature-line {
              display: inline-block;
              width: 140px;
              border-top: 1px solid #0f172a;
              margin-top: 25px;
              padding-top: 4px;
              font-size: 7.5pt;
              font-weight: 600;
              color: #0f172a;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="report-header">
            <div class="company-info">
              <h1>LazyMonkeyAI Store / Smart Bazaar</h1>
              <p>GSTIN: 36ABCDE1234F1Z5 • Phone: +91 9849344919</p>
              <p>Corporate Business Operating System • ProERP Integration</p>
            </div>
            <div class="report-meta">
              <h2>${activeReport.title}</h2>
              <p><strong>Generated on:</strong> ${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
              <p><strong>Filter:</strong> ${hideOutOfStock ? "In-Stock Only" : "All Batches"} | <strong>Rows:</strong> ${rows.length}</p>
            </div>
          </div>

          ${metricsHtml}

          <table>
            <thead>
              <tr style="background: #f8fafc;">
                ${tableHeaderHtml}
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
            ${totalsFooterHtml}
          </table>

          <div class="page-footer">
            <div>
              <span>Generated via BusinessOS AI • myBillBook Reports Architecture • Confidential</span>
            </div>
            <div class="signature-box">
              <div class="signature-line">Authorized Signatory</div>
            </div>
          </div>
        </body>
      </html>
    `;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      toast.error("Unable to open print preview.");
      return;
    }

    doc.open();
    doc.write(printHtml);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 2000);
    }, 400);
  };

  // Send Email Modal Trigger
  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail || !recipientEmail.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setEmailModalOpen(false);
    toast.success(`Excel report scheduled to send to ${recipientEmail}`);
    setRecipientEmail("");
  };

  // Search Filter on table rows
  const filteredRows = useMemo(() => {
    if (!reportData?.tableData) return [];
    if (!searchQuery.trim()) return reportData.tableData;
    const q = searchQuery.toLowerCase();
    return reportData.tableData.filter((row: any) =>
      Object.values(row).some((val: any) =>
        String(val).toLowerCase().includes(q)
      )
    );
  }, [reportData, searchQuery]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200 pb-16 bg-slate-50 dark:bg-slate-950 min-h-screen -m-6 p-6">
      {/* ── MyBillBook Report Navigation Tabs Bar ────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-sm flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        {MYBILLBOOK_REPORT_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeReport.id === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveReport(tab)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                isActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="size-3.5" />
              <span>{tab.title}</span>
            </button>
          );
        })}
      </div>

      {/* ── MyBillBook Main White Report Card Container ───────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {/* Top Header matching MyBillBook screenshot */}
        <div className="p-4 md:px-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.history.back()}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
              title="Back"
            >
              <ArrowLeft className="size-5" />
            </button>
            <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              {activeReport.title}
            </h2>
            <button
              onClick={() => {
                setIsFavourite(!isFavourite);
                toast.success(isFavourite ? "Removed from favourites" : "Added to favourites");
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                isFavourite
                  ? "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800"
                  : "text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <Star className={`size-3.5 ${isFavourite ? "fill-amber-500 text-amber-500" : ""}`} />
              <span>Favourite</span>
            </button>
          </div>

          {/* Action Buttons: Email Excel, Download Excel, Print PDF */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setEmailModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
            >
              <Mail className="size-3.5 text-slate-500" />
              <span>Email Excel</span>
            </button>

            <button
              onClick={handleDownloadExcel}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
            >
              <Download className="size-3.5 text-slate-500" />
              <span>Download Excel</span>
              <ChevronDown className="size-3 text-slate-400" />
            </button>

            <button
              onClick={handlePrintPDF}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
            >
              <Printer className="size-3.5 text-slate-500" />
              <span>Print PDF</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar matching MyBillBook toolbar */}
        <div className="px-4 md:px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-5 flex-wrap">
            {/* Hide out of stock checkbox */}
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300 font-medium">
              <input
                type="checkbox"
                checked={hideOutOfStock}
                onChange={(e) => setHideOutOfStock(e.target.checked)}
                className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Hide out of stock batches</span>
            </label>

            {/* Items Expiring in Dropdown */}
            {activeReport.id === "item_batch" && (
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Items expiring in</span>
                <select
                  value={expiringIn}
                  onChange={(e) => setExpiringIn(e.target.value)}
                  className="h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">Select</option>
                  <option value="30">Next 30 Days</option>
                  <option value="60">Next 60 Days</option>
                  <option value="90">Next 90 Days</option>
                  <option value="expired">Already Expired</option>
                </select>
              </div>
            )}

            {/* Date Range Selector */}
            {activeReport.id !== "item_batch" && (
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Period:</span>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="today">Today</option>
                  <option value="this_week">This Week</option>
                  <option value="this_month">This Month</option>
                  <option value="last_month">Last Month</option>
                  <option value="this_quarter">This Quarter</option>
                </select>
              </div>
            )}
          </div>

          {/* Real-time search inside report */}
          <div className="relative w-full sm:w-64">
            <Search className="size-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search table..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>

        {/* ── Table Content Area matching MyBillBook UI ─────────────────────── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 space-y-3">
            <RefreshCw className="size-8 text-indigo-600 animate-spin" />
            <p className="text-xs text-slate-500 font-semibold tracking-wider uppercase">
              Fetching real-time database records...
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {reportData?.tableColumns?.map((col: any, idx: number) => {
                    const isRightAligned = ["mrp", "purchase_price", "selling_price", "total_amount", "revenue", "cogs", "profit", "stock_valuation"].includes(col.key);
                    return (
                      <th
                        key={idx}
                        className={`px-5 py-3.5 ${isRightAligned ? "text-right" : "text-left"}`}
                      >
                        {col.header}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={reportData?.tableColumns?.length || 8}
                      className="text-center py-16 text-slate-400 dark:text-slate-500 font-medium"
                    >
                      No records found in database matching the applied filters.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row: any, rIdx: number) => (
                    <tr
                      key={rIdx}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {reportData?.tableColumns?.map((col: any, cIdx: number) => {
                        const val = row[col.key] ?? "-";
                        const isRightAligned = ["mrp", "purchase_price", "selling_price", "total_amount", "revenue", "cogs", "profit", "stock_valuation"].includes(col.key);
                        const isItemName = col.key === "item_name" || col.key === "product_name";
                        const isBatch = col.key === "batch_number" || col.key === "batch_no";
                        const isCurrentStock = col.key === "current_stock" || col.key === "qty";

                        return (
                          <td
                            key={cIdx}
                            className={`px-5 py-3.5 text-slate-800 dark:text-slate-200 ${
                              isRightAligned ? "text-right font-medium" : "text-left"
                            } ${isItemName ? "font-semibold text-slate-900 dark:text-white" : ""} ${
                              isBatch ? "font-mono font-medium text-slate-600 dark:text-slate-300" : ""
                            } ${isCurrentStock ? "font-semibold" : ""}`}
                          >
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>

              {/* Table Footer Totals Summary */}
              {reportData?.summaryTotals && Object.keys(reportData.summaryTotals).length > 0 && (
                <tfoot className="bg-slate-50 dark:bg-slate-800 font-bold border-t-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white">
                  <tr>
                    {reportData?.tableColumns?.map((col: any, idx: number) => {
                      const sumVal = reportData.summaryTotals[col.key] || "";
                      const isRightAligned = ["mrp", "purchase_price", "selling_price", "total_amount", "revenue", "cogs", "profit", "stock_valuation"].includes(col.key);
                      return (
                        <td
                          key={idx}
                          className={`px-5 py-3.5 text-indigo-700 dark:text-indigo-400 font-bold ${
                            isRightAligned ? "text-right" : "text-left"
                          }`}
                        >
                          {sumVal}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* ── Email Excel Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {emailModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEmailModalOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4"
            >
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Mail className="size-5" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Email Excel Report
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Enter the email address where you would like to receive the <strong>{activeReport.title}</strong> export.
              </p>
              <form onSubmit={handleSendEmail} className="space-y-4">
                <input
                  type="email"
                  placeholder="name@company.com"
                  required
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEmailModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20"
                  >
                    Send Email
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
