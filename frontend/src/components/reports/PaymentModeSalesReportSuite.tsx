import React, { useEffect, useState, useMemo } from "react";
import {
  ArrowLeft,
  Star,
  Download,
  Printer,
  Search,
  Calendar as CalendarIcon,
  ChevronDown,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  CreditCard,
  Banknote,
  Smartphone,
  Building,
  Clock,
  RotateCcw,
  Receipt,
  AlertCircle,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { formatDisplayDateTime } from "@/lib/utils";
import { inventoryApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { printHtmlInPage } from "@/lib/print-helper";
import { getActiveBillingGst } from "@/lib/receipt-template-store";

interface PaymentModeSalesReportSuiteProps {
  onBack?: () => void;
  defaultMode?: string;
}

export function PaymentModeSalesReportSuite({
  onBack,
  defaultMode = "all",
}: PaymentModeSalesReportSuiteProps) {
  const { formatCurrency } = useCurrency();
  const { tenant } = useTenant();

  // Favorite toggle
  const [isFavorite, setIsFavorite] = useState<boolean>(() => {
    return localStorage.getItem("report_fav_payment_mode_sales") === "true";
  });

  const toggleFavorite = () => {
    const next = !isFavorite;
    setIsFavorite(next);
    localStorage.setItem("report_fav_payment_mode_sales", String(next));
    toast.success(next ? "Added to favourites" : "Removed from favourites");
  };

  // Filter States
  const [datePreset, setDatePreset] = useState<
    "all" | "today" | "yesterday" | "this_week" | "last7" | "this_month" | "last_month" | "this_quarter" | "this_fy" | "custom"
  >("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [activeModeTab, setActiveModeTab] = useState<string>(defaultMode);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // UI state
  const [downloadMenuOpen, setDownloadMenuOpen] = useState<boolean>(false);
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
      if (activeModeTab && activeModeTab !== "all") params.mode = activeModeTab;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const data = await inventoryApi.getPaymentModeSalesReport(params);
      setReportData(data);
    } catch (err: any) {
      console.error("Failed to load payment mode sales report:", err);
      toast.error(err.message || "Failed to load payment mode sales report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport();
  }, [startDate, endDate, activeModeTab]);

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      void loadReport();
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const summary = reportData?.summary || {
    total_invoices: 0,
    total_revenue: 0,
    avg_bill: 0,
    cash_total: 0,
    cash_count: 0,
    cash_pct: 0,
    upi_total: 0,
    upi_count: 0,
    upi_pct: 0,
    bank_total: 0,
    bank_count: 0,
    bank_pct: 0,
    credit_total: 0,
    credit_count: 0,
    credit_pct: 0,
    dues_total: 0,
    dues_count: 0,
    credit_notes_total: 0,
    credit_notes_count: 0,
  };

  const modeBreakdown: any[] = reportData?.mode_breakdown || [];
  const detailedInvoices: any[] = reportData?.detailed_invoices || [];

  // Filtered detailed invoices based on search if not already handled
  const filteredInvoices = useMemo(() => {
    if (!searchQuery.trim()) return detailedInvoices;
    const q = searchQuery.toLowerCase().trim();
    return detailedInvoices.filter(
      (inv) =>
        (inv.invoice_no && inv.invoice_no.toLowerCase().includes(q)) ||
        (inv.customer && inv.customer.toLowerCase().includes(q)) ||
        (inv.customer_phone && inv.customer_phone.includes(q)) ||
        (inv.sales_executive && inv.sales_executive.toLowerCase().includes(q)) ||
        (inv.payment_mode_raw && inv.payment_mode_raw.toLowerCase().includes(q))
    );
  }, [detailedInvoices, searchQuery]);

  // Excel (.xlsx) Export
  const handleExportExcel = () => {
    setDownloadMenuOpen(false);
    if (!filteredInvoices || filteredInvoices.length === 0) {
      toast.info("No transaction records available to export");
      return;
    }

    try {
      const summarySheetData = modeBreakdown.map((row) => ({
        "Payment Mode": row.payment_mode,
        "Invoices Count": row.invoices_count,
        "% Share": `${row.percentage_share}%`,
        "Total Billed (₹)": row.total_billed,
        "Collected Amount (₹)": row.collected_amount,
        "Outstanding Dues (₹)": row.dues_amount,
        "Dues Invoices Count": row.dues_invoices_count,
        "Average Ticket (₹)": row.average_ticket,
      }));

      const invoicesSheetData = filteredInvoices.map((inv) => ({
        Date: inv.date || "—",
        "Invoice Number": inv.invoice_no || "—",
        Customer: inv.customer || "Walk-in Customer",
        "Phone Number": inv.customer_phone || "—",
        "Sales Executive": inv.sales_executive || "POS Cashier",
        "Payment Category": inv.category_label || inv.category || "Cash",
        "Raw Mode": inv.payment_mode_raw || "—",
        "Subtotal (₹)": inv.subtotal,
        "GST Tax (₹)": inv.tax,
        "Discount (₹)": inv.discount,
        "Total Billed (₹)": inv.total_amount,
        "Paid Amount (₹)": inv.paid_amount,
        "Pending Balance (₹)": inv.pending_amount,
        Status: inv.status || "Paid",
      }));

      const workbook = XLSX.utils.book_new();
      const wsSummary = XLSX.utils.json_to_sheet(summarySheetData);
      const wsDetails = XLSX.utils.json_to_sheet(invoicesSheetData);

      XLSX.utils.book_append_sheet(workbook, wsSummary, "Payment Mode Summary");
      XLSX.utils.book_append_sheet(workbook, wsDetails, "Itemized Invoices");

      const fileName = `Payment_Mode_Sales_Report_${datePreset}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success("Excel workbook exported successfully");
    } catch (err: any) {
      console.error("Export error:", err);
      toast.error("Failed to export Excel file");
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    setDownloadMenuOpen(false);
    if (!filteredInvoices || filteredInvoices.length === 0) {
      toast.info("No transaction records available to export");
      return;
    }

    const headers = [
      "Date",
      "Invoice Number",
      "Customer",
      "Phone",
      "Sales Rep",
      "Payment Category",
      "Raw Mode",
      "Subtotal",
      "Tax",
      "Discount",
      "Total Billed",
      "Paid",
      "Due Balance",
      "Status",
    ];

    const rows = filteredInvoices.map((inv) => [
      `"${inv.date || "—"}"`,
      `"${inv.invoice_no || "—"}"`,
      `"${(inv.customer || "Walk-in").replace(/"/g, '""')}"`,
      `"${inv.customer_phone || ""}"`,
      `"${(inv.sales_executive || "").replace(/"/g, '""')}"`,
      `"${inv.category_label || "Cash"}"`,
      `"${(inv.payment_mode_raw || "").replace(/"/g, '""')}"`,
      Number(inv.subtotal || 0),
      Number(inv.tax || 0),
      Number(inv.discount || 0),
      Number(inv.total_amount || 0),
      Number(inv.paid_amount || 0),
      Number(inv.pending_amount || 0),
      `"${inv.status || "Paid"}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Payment_Mode_Sales_Report_${datePreset}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV report exported successfully");
  };

  // Print PDF
  const handlePrintPDF = () => {
    const billingGst = getActiveBillingGst();
    const companyName = tenant?.name || billingGst.tradeName || "Business Enterprise";
    const companyGstin = billingGst.gstin || "Unregistered";
    const companyAddress = billingGst.address || "";
    const companyPhone = billingGst.phone || "";

    const dateRangeLabel =
      startDate && endDate
        ? `${startDate} to ${endDate}`
        : datePreset === "all"
        ? "All Time Records"
        : datePreset.replace("_", " ").toUpperCase();

    const summaryCardsHtml = `
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px;">
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px;">
          <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Sales Invoices</div>
          <div style="font-size: 16px; font-weight: 900; color: #0f172a; margin-top: 2px;">${summary.total_invoices}</div>
          <div style="font-size: 8.5px; color: #16a34a; font-weight: 700; margin-top: 2px;">100% Synced & Logged</div>
        </div>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px;">
          <div style="font-size: 9px; font-weight: 700; color: #166534; text-transform: uppercase;">Total Billed Revenue</div>
          <div style="font-size: 16px; font-weight: 900; color: #16a34a; margin-top: 2px;">${formatCurrency(summary.total_revenue)}</div>
          <div style="font-size: 8.5px; color: #475569; margin-top: 2px;">Avg Bill: ${formatCurrency(summary.avg_bill)}</div>
        </div>
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px;">
          <div style="font-size: 9px; font-weight: 700; color: #1e40af; text-transform: uppercase;">Cash Sales</div>
          <div style="font-size: 16px; font-weight: 900; color: #2563eb; margin-top: 2px;">${formatCurrency(summary.cash_total)}</div>
          <div style="font-size: 8.5px; color: #475569; margin-top: 2px;">${summary.cash_count} Invoices (${summary.cash_pct}%)</div>
        </div>
        <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 10px;">
          <div style="font-size: 9px; font-weight: 700; color: #6b21a8; text-transform: uppercase;">UPI / QR Sales</div>
          <div style="font-size: 16px; font-weight: 900; color: #7c3aed; margin-top: 2px;">${formatCurrency(summary.upi_total)}</div>
          <div style="font-size: 8.5px; color: #475569; margin-top: 2px;">${summary.upi_count} Invoices (${summary.upi_pct}%)</div>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px;">
        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 10px;">
          <div style="font-size: 9px; font-weight: 700; color: #0369a1; text-transform: uppercase;">Bank / Card Sales</div>
          <div style="font-size: 16px; font-weight: 900; color: #0284c7; margin-top: 2px;">${formatCurrency(summary.bank_total)}</div>
          <div style="font-size: 8.5px; color: #475569; margin-top: 2px;">${summary.bank_count} Invoices (${summary.bank_pct}%)</div>
        </div>
        <div style="background: #fdf2f8; border: 1px solid #fbcfe8; border-radius: 8px; padding: 10px;">
          <div style="font-size: 9px; font-weight: 700; color: #9d174d; text-transform: uppercase;">Credit / Pay Later</div>
          <div style="font-size: 16px; font-weight: 900; color: #db2777; margin-top: 2px;">${formatCurrency(summary.credit_total)}</div>
          <div style="font-size: 8.5px; color: #475569; margin-top: 2px;">${summary.credit_count} Invoices (${summary.credit_pct}%)</div>
        </div>
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px;">
          <div style="font-size: 9px; font-weight: 700; color: #92400e; text-transform: uppercase;">Outstanding Dues</div>
          <div style="font-size: 16px; font-weight: 900; color: #d97706; margin-top: 2px;">${formatCurrency(summary.dues_total)}</div>
          <div style="font-size: 8.5px; color: #b45309; font-weight: 700; margin-top: 2px;">${summary.dues_count} Invoices with Dues</div>
        </div>
        <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 10px;">
          <div style="font-size: 9px; font-weight: 700; color: #9a3412; text-transform: uppercase;">Credit Notes & Returns</div>
          <div style="font-size: 16px; font-weight: 900; color: #ea580c; margin-top: 2px;">${formatCurrency(summary.credit_notes_total)}</div>
          <div style="font-size: 8.5px; color: #475569; margin-top: 2px;">${summary.credit_notes_count} Credit Notes</div>
        </div>
      </div>
    `;

    const summaryTableRows = modeBreakdown
      .map(
        (row) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 7px 10px; font-weight: 700; color: #0f172a;">${row.payment_mode}</td>
          <td style="padding: 7px 10px; text-align: center; font-weight: 600;">${row.invoices_count}</td>
          <td style="padding: 7px 10px; text-align: center; color: #64748b;">${row.percentage_share}%</td>
          <td style="padding: 7px 10px; text-align: right; font-weight: 700; color: #0f172a;">${formatCurrency(row.total_billed)}</td>
          <td style="padding: 7px 10px; text-align: right; color: #16a34a; font-weight: 600;">${formatCurrency(row.collected_amount)}</td>
          <td style="padding: 7px 10px; text-align: right; color: #dc2626; font-weight: 600;">${formatCurrency(row.dues_amount)}</td>
          <td style="padding: 7px 10px; text-align: center; color: #64748b;">${row.dues_invoices_count}</td>
          <td style="padding: 7px 10px; text-align: right; color: #475569;">${formatCurrency(row.average_ticket)}</td>
        </tr>
      `
      )
      .join("");

    const detailedTableRows = filteredInvoices
      .slice(0, 100)
      .map(
        (inv, idx) => `
        <tr style="border-bottom: 1px solid #f1f5f9; font-size: 9px;">
          <td style="padding: 5px 8px; color: #64748b;">${idx + 1}</td>
          <td style="padding: 5px 8px;">${inv.date || "—"}</td>
          <td style="padding: 5px 8px; font-weight: 700; color: #1e293b;">${inv.invoice_no || "—"}</td>
          <td style="padding: 5px 8px;">${inv.customer || "Walk-in"}</td>
          <td style="padding: 5px 8px; color: #64748b;">${inv.customer_phone || "—"}</td>
          <td style="padding: 5px 8px; font-weight: 600;">${inv.category_label || "Cash"}</td>
          <td style="padding: 5px 8px; text-align: right; font-weight: 700;">${formatCurrency(inv.total_amount)}</td>
          <td style="padding: 5px 8px; text-align: right; color: #16a34a;">${formatCurrency(inv.paid_amount)}</td>
          <td style="padding: 5px 8px; text-align: right; color: #dc2626; font-weight: 600;">${formatCurrency(inv.pending_amount)}</td>
          <td style="padding: 5px 8px; text-align: center;">
            <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 8px; font-weight: 700; ${
              inv.pending_amount > 0.01
                ? "background: #fef2f2; color: #991b1b; border: 1px solid #fecaca;"
                : "background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0;"
            }">
              ${inv.status || "Paid"}
            </span>
          </td>
        </tr>
      `
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Mode & Collections Report - ${companyName}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm 14mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; }
          .header-box { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
          .company-title { font-size: 18px; font-weight: 900; color: #0f172a; margin: 0; }
          .company-meta { font-size: 10px; color: #475569; margin-top: 3px; line-height: 1.4; }
          .report-badge { display: inline-block; background: #e0e7ff; color: #4338ca; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; padding: 3px 8px; border-radius: 4px; margin-bottom: 3px; }
          .report-title { font-size: 16px; font-weight: 800; color: #0f172a; margin: 2px 0; }
          .report-meta { font-size: 10px; color: #64748b; }
          .section-title { font-size: 12px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px; margin: 14px 0 8px 0; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 6px; }
          th { background: #f8fafc; text-align: left; padding: 7px 10px; font-weight: 700; color: #334155; border-top: 1px solid #cbd5e1; border-bottom: 1.5px solid #94a3b8; text-transform: uppercase; font-size: 8.5px; }
          .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 8.5px; color: #64748b; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div>
            <h1 class="company-title">${companyName}</h1>
            <div class="company-meta">
              ${companyAddress ? `<div>${companyAddress}</div>` : ""}
              <div>
                ${companyGstin ? `<span>GSTIN: <strong>${companyGstin}</strong></span>` : ""}
                ${companyPhone ? ` &bull; <span>Tel: ${companyPhone}</span>` : ""}
              </div>
            </div>
          </div>
          <div style="text-align: right;">
            <div class="report-badge">Official Financial Register</div>
            <div class="report-title">Payment Mode & Collections Audit</div>
            <div class="report-meta">Period: <strong>${dateRangeLabel}</strong></div>
            <div class="report-meta">Generated: ${formatDisplayDateTime(new Date())}</div>
          </div>
        </div>

        ${summaryCardsHtml}

        <div class="section-title">Payment Mode Breakdown & Realization Matrix</div>
        <table>
          <thead>
            <tr>
              <th>Payment Channel</th>
              <th style="text-align: center;">Invoices Count</th>
              <th style="text-align: center;">% Share</th>
              <th style="text-align: right;">Total Billed</th>
              <th style="text-align: right;">Collected</th>
              <th style="text-align: right;">Pending Dues</th>
              <th style="text-align: center;">Dues Invoices</th>
              <th style="text-align: right;">Avg Ticket</th>
            </tr>
          </thead>
          <tbody>
            ${summaryTableRows}
            <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid #cbd5e1; border-bottom: 2px solid #cbd5e1;">
              <td style="padding: 8px 10px;">GRAND TOTAL</td>
              <td style="padding: 8px 10px; text-align: center;">${summary.total_invoices}</td>
              <td style="padding: 8px 10px; text-align: center;">100%</td>
              <td style="padding: 8px 10px; text-align: right; color: #16a34a;">${formatCurrency(summary.total_revenue)}</td>
              <td style="padding: 8px 10px; text-align: right; color: #16a34a;">${formatCurrency(summary.cash_total + summary.upi_total + summary.bank_total)}</td>
              <td style="padding: 8px 10px; text-align: right; color: #dc2626;">${formatCurrency(summary.dues_total)}</td>
              <td style="padding: 8px 10px; text-align: center;">${summary.dues_count}</td>
              <td style="padding: 8px 10px; text-align: right;">${formatCurrency(summary.avg_bill)}</td>
            </tr>
          </tbody>
        </table>

        <div class="section-title" style="margin-top: 20px;">Itemized Invoice Ledger (${filteredInvoices.length} Invoices)</div>
        <table>
          <thead>
            <tr>
              <th style="width: 25px;">#</th>
              <th>Date</th>
              <th>Invoice No</th>
              <th>Customer</th>
              <th>Phone</th>
              <th>Payment Mode</th>
              <th style="text-align: right;">Billed</th>
              <th style="text-align: right;">Collected</th>
              <th style="text-align: right;">Due</th>
              <th style="text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${detailedTableRows}
          </tbody>
        </table>

        <div class="footer">
          <span>Generated by BusinessOS &bull; Real-time Database Snapshot</span>
          <span>Confidential Audit Statement &bull; Page 1</span>
        </div>
      </body>
      </html>
    `;

    printHtmlInPage(html, 300);
  };

  const presetLabels: Record<string, string> = {
    all: "All Time",
    today: "Today",
    yesterday: "Yesterday",
    this_week: "This Week",
    last7: "Last 7 Days",
    this_month: "This Month",
    last_month: "Previous Month",
    this_quarter: "This Quarter",
    this_fy: "This Financial Year",
    custom: "Custom Range",
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 text-slate-800 overflow-hidden font-sans">
      {/* ──────────────────────────────────────────────────────────────────────────
          TOP HEADER TOOLBAR
      ────────────────────────────────────────────────────────────────────────── */}
      <header className="px-6 py-3.5 border-b border-slate-200/90 flex flex-wrap items-center justify-between gap-3 shrink-0 bg-white shadow-2xs">
        {/* Left: Back button + Title + Favorite star */}
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors cursor-pointer"
              title="Go Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
                Payment Mode & Collections Report
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Live DB
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Breakdown of sales by Cash, UPI, Bank / Card, Credit / Dues, and Credit Notes.
            </p>
          </div>

          <button
            onClick={toggleFavorite}
            className={`hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all border cursor-pointer ${
              isFavorite
                ? "bg-amber-100/80 text-amber-900 border-amber-300 shadow-2xs"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-amber-50 hover:text-amber-700"
            }`}
          >
            <Star
              className={`w-3.5 h-3.5 ${
                isFavorite ? "fill-amber-500 text-amber-500" : "text-slate-400"
              }`}
            />
            <span>{isFavorite ? "Favorited" : "Favorite"}</span>
          </button>
        </div>

        {/* Right: Export Excel / CSV, Print PDF, Refresh */}
        <div className="flex items-center gap-2">
          {/* Download Dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDownloadMenuOpen(!downloadMenuOpen)}
              className="h-9 px-3 text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-50 gap-1.5 rounded-xl cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Export</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </Button>

            {downloadMenuOpen && (
              <div
                className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100"
                onMouseLeave={() => setDownloadMenuOpen(false)}
              >
                <button
                  onClick={handleExportExcel}
                  className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 flex items-center gap-2 text-slate-700 font-medium cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Download Excel (.xlsx)</span>
                </button>
                <button
                  onClick={handleExportCSV}
                  className="w-full text-left px-3.5 py-2 hover:bg-blue-50 flex items-center gap-2 text-slate-700 font-medium cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Download CSV (.csv)</span>
                </button>
              </div>
            )}
          </div>

          {/* Print PDF */}
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintPDF}
            className="h-9 px-3 text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-50 gap-1.5 rounded-xl cursor-pointer"
          >
            <Printer className="w-4 h-4 text-indigo-600" />
            <span>Print PDF</span>
          </Button>

          {/* Refresh */}
          <Button
            variant="outline"
            size="icon"
            onClick={loadReport}
            disabled={loading}
            className="h-9 w-9 rounded-xl border-slate-200 hover:bg-slate-50 cursor-pointer"
            title="Refresh Live Data"
          >
            <RefreshCw
              className={`w-4 h-4 text-slate-600 ${loading ? "animate-spin text-purple-600" : ""}`}
            />
          </Button>
        </div>
      </header>

      {/* ──────────────────────────────────────────────────────────────────────────
          MAIN SCROLLABLE CONTENT
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5 custom-scrollbar">
        {/* ────────────────────────────────────────────────────────────────────────
            1. FILTER BAR
        ──────────────────────────────────────────────────────────────────────── */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Period Selector */}
            <div className="relative">
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value as any)}
                className="h-9 pl-3 pr-8 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer appearance-none"
              >
                {Object.entries(presetLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Date Pickers (Custom or Active) */}
            <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
              <CalendarIcon className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
              <DatePickerInput
                value={startDate}
                onChange={(val) => {
                  setStartDate(val);
                  setDatePreset("custom");
                }}
                className="h-7 w-28 text-xs bg-white border-slate-200 rounded-lg px-2"
                placeholder="From Date"
              />
              <span className="text-slate-400 font-semibold px-0.5">to</span>
              <DatePickerInput
                value={endDate}
                onChange={(val) => {
                  setEndDate(val);
                  setDatePreset("custom");
                }}
                className="h-7 w-28 text-xs bg-white border-slate-200 rounded-lg px-2"
                placeholder="To Date"
              />
            </div>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[260px] flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer, invoice #, phone..."
              className="w-full h-9 pl-8.5 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
        </div>

        {/* ────────────────────────────────────────────────────────────────────────
            2. SUMMARY KPI STAT CARDS (Strictly matching Sales Tab Cards)
        ──────────────────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          {/* Card 1: Total Sales Invoices */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-blue-200 hover:shadow-xs transition-all">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                Total Sales Invoices
              </span>
              <Receipt className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {summary.total_invoices}
            </div>
            <div className="text-[11px] text-emerald-600 font-bold mt-1">
              100% Synced & Logged
            </div>
          </div>

          {/* Card 2: Total Billed Revenue */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-emerald-200 hover:shadow-xs transition-all">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                Total Billed Revenue
              </span>
              <CreditCard className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-600">
              {formatCurrency(summary.total_revenue)}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              Avg Bill: {formatCurrency(summary.avg_bill)}
            </div>
          </div>

          {/* Card 3: Total Cash */}
          <div
            onClick={() => setActiveModeTab(activeModeTab === "cash" ? "all" : "cash")}
            className={`bg-white p-4 rounded-2xl border shadow-2xs hover:shadow-xs transition-all cursor-pointer ${
              activeModeTab === "cash"
                ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20"
                : "border-slate-200/90 hover:border-emerald-200"
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Cash</span>
              <Banknote className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-600">
              {formatCurrency(summary.cash_total)}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              {summary.cash_count} {summary.cash_count === 1 ? "Invoice" : "Invoices"}
              {summary.total_invoices > 0 && ` (${summary.cash_pct}%)`}
            </div>
          </div>

          {/* Card 4: Total UPI */}
          <div
            onClick={() => setActiveModeTab(activeModeTab === "upi" ? "all" : "upi")}
            className={`bg-white p-4 rounded-2xl border shadow-2xs hover:shadow-xs transition-all cursor-pointer ${
              activeModeTab === "upi"
                ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20"
                : "border-slate-200/90 hover:border-indigo-200"
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total UPI</span>
              <Smartphone className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-indigo-600">
              {formatCurrency(summary.upi_total)}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              {summary.upi_count} {summary.upi_count === 1 ? "Invoice" : "Invoices"}
              {summary.total_invoices > 0 && ` (${summary.upi_pct}%)`}
            </div>
          </div>

          {/* Card 5: Bank / Card */}
          <div
            onClick={() => setActiveModeTab(activeModeTab === "bank" ? "all" : "bank")}
            className={`bg-white p-4 rounded-2xl border shadow-2xs hover:shadow-xs transition-all cursor-pointer ${
              activeModeTab === "bank"
                ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20"
                : "border-slate-200/90 hover:border-blue-200"
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Bank / Card</span>
              <Building className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-blue-600">
              {formatCurrency(summary.bank_total)}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              {summary.bank_count} {summary.bank_count === 1 ? "Invoice" : "Invoices"}
              {summary.total_invoices > 0 && ` (${summary.bank_pct}%)`}
            </div>
          </div>

          {/* Card 6: Credit / Due */}
          <div
            onClick={() => setActiveModeTab(activeModeTab === "credit" ? "all" : "credit")}
            className={`bg-white p-4 rounded-2xl border shadow-2xs hover:shadow-xs transition-all cursor-pointer ${
              activeModeTab === "credit"
                ? "border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/20"
                : "border-slate-200/90 hover:border-purple-200"
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Credit / Due</span>
              <Clock className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-black text-purple-600">
              {formatCurrency(summary.credit_total)}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              {summary.credit_count} {summary.credit_count === 1 ? "Invoice" : "Invoices"}
              {summary.total_invoices > 0 && ` (${summary.credit_pct}%)`}
            </div>
          </div>

          {/* Card 7: Credit Notes */}
          <div
            onClick={() => setActiveModeTab(activeModeTab === "credit_notes" ? "all" : "credit_notes")}
            className={`bg-white p-4 rounded-2xl border shadow-2xs hover:shadow-xs transition-all cursor-pointer ${
              activeModeTab === "credit_notes"
                ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20"
                : "border-slate-200/90 hover:border-amber-200"
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Credit Notes</span>
              <RotateCcw className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-600">
              {formatCurrency(summary.credit_notes_total)}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              {summary.credit_notes_count}{" "}
              {summary.credit_notes_count === 1 ? "Credit Note" : "Credit Notes"}
            </div>
          </div>
        </div>

        {/* ────────────────────────────────────────────────────────────────────────
            OUTSTANDING DUES BANNER / HIGHLIGHT
        ──────────────────────────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200/90 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-200 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Total Outstanding Customer Dues
              </div>
              <div className="text-lg font-black text-amber-800">
                {formatCurrency(summary.dues_total)}{" "}
                <span className="text-xs font-semibold text-amber-700">
                  across {summary.dues_count} invoices with pending balances
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setActiveModeTab(activeModeTab === "dues" ? "all" : "dues")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeModeTab === "dues"
                ? "bg-amber-600 text-white shadow-md shadow-amber-300"
                : "bg-white text-amber-900 border border-amber-300 hover:bg-amber-100/60"
            }`}
          >
            {activeModeTab === "dues" ? "Showing Dues Only" : "Filter Invoices with Dues"}
          </button>
        </div>

        {/* ────────────────────────────────────────────────────────────────────────
            3. PAYMENT MODE BREAKDOWN SUMMARY TABLE (Grand Totals + Realization)
        ──────────────────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50/50 to-white">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Payment Mode Breakdown Summary
              </h2>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
              Realization & Dues Matrix
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4">Payment Mode / Category</th>
                  <th className="py-3 px-4 text-center">Invoices Count</th>
                  <th className="py-3 px-4 text-center">% Share</th>
                  <th className="py-3 px-4 text-right">Total Billed (₹)</th>
                  <th className="py-3 px-4 text-right">Realized / Paid (₹)</th>
                  <th className="py-3 px-4 text-right">Pending Dues (₹)</th>
                  <th className="py-3 px-4 text-center">Dues Count</th>
                  <th className="py-3 px-4 text-right">Avg Ticket (₹)</th>
                  <th className="py-3 px-4 text-center">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {modeBreakdown.map((row) => {
                  const isSelected = activeModeTab === row.mode_key;
                  return (
                    <tr
                      key={row.mode_key}
                      className={`hover:bg-indigo-50/30 transition-colors ${
                        isSelected ? "bg-indigo-50/50 font-semibold" : ""
                      }`}
                    >
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span
                            className={`size-2 rounded-full ${
                              row.mode_key === "cash"
                                ? "bg-emerald-500"
                                : row.mode_key === "upi"
                                ? "bg-indigo-500"
                                : row.mode_key === "bank"
                                ? "bg-blue-500"
                                : row.mode_key === "credit"
                                ? "bg-purple-500"
                                : row.mode_key === "dues"
                                ? "bg-amber-500"
                                : "bg-orange-500"
                            }`}
                          />
                          <span>{row.payment_mode}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800">
                        {row.invoices_count}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <span className="font-semibold text-slate-600">
                            {row.percentage_share}%
                          </span>
                          <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${Math.min(100, row.percentage_share)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900">
                        {formatCurrency(row.total_billed)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">
                        {formatCurrency(row.collected_amount)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-600">
                        {row.dues_amount > 0 ? formatCurrency(row.dues_amount) : "—"}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-600 font-semibold">
                        {row.dues_invoices_count > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200">
                            {row.dues_invoices_count}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 font-medium">
                        {formatCurrency(row.average_ticket)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() =>
                            setActiveModeTab(isSelected ? "all" : row.mode_key)
                          }
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          {isSelected ? "Reset" : "View"}
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Grand Total Row */}
                <tr className="bg-slate-50 font-black text-slate-900 border-t-2 border-slate-300">
                  <td className="py-3 px-4 text-sm font-black">GRAND TOTAL (ALL MODES)</td>
                  <td className="py-3 px-4 text-center text-sm font-black">
                    {summary.total_invoices}
                  </td>
                  <td className="py-3 px-4 text-center text-sm font-black">100.0%</td>
                  <td className="py-3 px-4 text-right text-sm font-black text-emerald-600">
                    {formatCurrency(summary.total_revenue)}
                  </td>
                  <td className="py-3 px-4 text-right text-sm font-black text-emerald-600">
                    {formatCurrency(summary.cash_total + summary.upi_total + summary.bank_total)}
                  </td>
                  <td className="py-3 px-4 text-right text-sm font-black text-rose-600">
                    {formatCurrency(summary.dues_total)}
                  </td>
                  <td className="py-3 px-4 text-center text-sm font-black">
                    {summary.dues_count}
                  </td>
                  <td className="py-3 px-4 text-right text-sm font-black">
                    {formatCurrency(summary.avg_bill)}
                  </td>
                  <td className="py-3 px-4 text-center">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ────────────────────────────────────────────────────────────────────────
            4. DETAILED INVOICES LEDGER WITH MODE PILLS
        ──────────────────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          {/* Header & Mode Filter Pills */}
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-50/50 to-white">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Detailed Invoices Ledger
              </h2>
              <span className="text-xs font-bold text-slate-500">
                ({filteredInvoices.length} Invoices)
              </span>
            </div>

            {/* Mode Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: "all", label: "All Sales", count: summary.total_invoices },
                { id: "cash", label: "Cash", count: summary.cash_count },
                { id: "upi", label: "UPI", count: summary.upi_count },
                { id: "bank", label: "Bank / Card", count: summary.bank_count },
                { id: "credit", label: "Credit", count: summary.credit_count },
                { id: "dues", label: "Dues Only", count: summary.dues_count },
                { id: "credit_notes", label: "Credit Notes", count: summary.credit_notes_count },
              ].map((pill) => {
                const isActive = activeModeTab === pill.id;
                return (
                  <button
                    key={pill.id}
                    onClick={() => setActiveModeTab(pill.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
                    }`}
                  >
                    <span>{pill.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isActive ? "bg-white/20 text-white" : "bg-white text-slate-700"
                      }`}
                    >
                      {pill.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer & Contact</th>
                  <th className="py-3 px-4">Payment Category</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Subtotal (₹)</th>
                  <th className="py-3 px-4 text-right">Tax (₹)</th>
                  <th className="py-3 px-4 text-right">Total (₹)</th>
                  <th className="py-3 px-4 text-right">Collected (₹)</th>
                  <th className="py-3 px-4 text-right">Due Balance (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      No invoices found for the selected period and payment mode.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr
                      key={inv.id || inv.invoice_no}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
                        {inv.date || "—"}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                        {inv.invoice_no || "—"}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-bold text-slate-800">{inv.customer}</div>
                        {inv.customer_phone && (
                          <div className="text-[10px] text-slate-400">
                            {inv.customer_phone}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            inv.category === "cash"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : inv.category === "upi"
                              ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                              : inv.category === "bank"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : inv.category === "credit"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {inv.category_label || inv.payment_mode_raw}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            inv.pending_amount > 0.01
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {inv.status || (inv.pending_amount > 0.01 ? "Due" : "Paid")}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-600">
                        {formatCurrency(inv.subtotal)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-600">
                        {formatCurrency(inv.tax)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-slate-900">
                        {formatCurrency(inv.total_amount)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-emerald-600">
                        {formatCurrency(inv.paid_amount)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-rose-600">
                        {inv.pending_amount > 0.01 ? formatCurrency(inv.pending_amount) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
