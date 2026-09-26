import React, { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Download,
  Printer,
  Search,
  Filter,
  RefreshCw,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Layers,
  ChevronDown,
  Building2,
  Percent,
  FileSpreadsheet,
  HelpCircle,
  TrendingUp,
  ShieldCheck,
  RotateCcw,
  SlidersHorizontal,
  FileCheck,
  Clock,
  Mail,
  Receipt,
  Tag,
  ArrowRightLeft,
  X
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { formatDisplayDate, formatDisplayDateTime, getTodayDateString } from "@/lib/utils";
import { INDIAN_GST_STATES, extractGstState } from "@/lib/gst-utils";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type GstReportType =
  | "gstr1"
  | "gstr3b"
  | "gstr2b"
  | "gst_sales"
  | "gst_purchase"
  | "gstr2_purchase"
  | "gst_tax_summary"
  | "hsn_summary"
  | "b2b_sales"
  | "b2c_sales"
  | "export_sales"
  | "cdnr_report"
  | "rate_wise"
  | "gstin_wise"
  | "place_of_supply"
  | "itc_report"
  | "output_liability"
  | "reconciliation"
  | "tds_payable"
  | "tds_receivable"
  | "tcs_payable"
  | "tcs_receivable";

export interface ReportTabMeta {
  id: GstReportType;
  num: number | string;
  name: string;
  shortName: string;
  category: "Govt Returns" | "Sales & Outward" | "Purchase & Inward" | "Tax & Slabs" | "TDS / TCS";
  description: string;
}

export const GST_REPORTS_LIST: ReportTabMeta[] = [
  { id: "gstr1", num: 1, name: "GSTR-1 – Sales / Outward Supplies", shortName: "GSTR-1", category: "Govt Returns", description: "Monthly/Quarterly return of outward supplies (B2B, B2CL, B2CS, CDNR, Exports, HSN, Docs)" },
  { id: "gstr3b", num: 2, name: "GSTR-3B – Summary of GST Liability & ITC", shortName: "GSTR-3B", category: "Govt Returns", description: "Summary return for tax payment, outward liability & input tax credit claim" },
  { id: "gstr2b", num: 3, name: "GSTR-2B / ITC Statement", shortName: "GSTR-2B", category: "Govt Returns", description: "Auto-drafted static ITC statement for inward supplies from supplier returns" },
  { id: "gst_sales", num: 4, name: "Sales GST Report (With HSN)", shortName: "GST Sales (HSN)", category: "Sales & Outward", description: "Taxable sales register with item breakdown, HSN codes, CGST, SGST, IGST (PDF layout)" },
  { id: "gst_purchase", num: 5, name: "Purchase GST Report (With HSN)", shortName: "GST Purchase (HSN)", category: "Purchase & Inward", description: "Purchases register with item breakdown, HSN codes, CGST, SGST, IGST (PDF layout)" },
  { id: "gstr2_purchase", num: "2P", name: "GSTR-2 (Purchase & Returns)", shortName: "GSTR-2 Purchase", category: "Purchase & Inward", description: "Inward supplies with Place of Supply, tax breakup, and return adjustments (PDF layout)" },
  { id: "gst_tax_summary", num: 7, name: "GST Tax Summary (Rate Slabs)", shortName: "Tax Summary", category: "Tax & Slabs", description: "Output vs Input breakdown across GST slabs (0%, 5%, 12%, 18%, 28%) & Cess" },
  { id: "hsn_summary", num: 8, name: "HSN / SAC Wise Summary", shortName: "HSN Summary", category: "Sales & Outward", description: "HSN code wise total quantity, taxable value, IGST, CGST, SGST, Cess (PDF layout)" },
  { id: "b2b_sales", num: 9, name: "B2B Sales Report", shortName: "B2B Sales", category: "Sales & Outward", description: "Tax invoices issued to registered GSTIN businesses with reverse charge & POS" },
  { id: "b2c_sales", num: 10, name: "B2C Sales Report", shortName: "B2C Sales", category: "Sales & Outward", description: "Sales to unregistered consumers partitioned into B2C Large (>2.5L) & B2C Small" },
  { id: "export_sales", num: 11, name: "Export Sales Report", shortName: "Exports", category: "Sales & Outward", description: "International & SEZ supplies with shipping bill, port code, LUT / Bond" },
  { id: "cdnr_report", num: 12, name: "Credit / Debit Note GST Report", shortName: "Credit/Debit Notes", category: "Sales & Outward", description: "CDNR (Registered) and CDNUR (Unregistered) credit & debit note adjustments" },
  { id: "rate_wise", num: 13, name: "GST Rate-wise Report", shortName: "Rate-wise", category: "Tax & Slabs", description: "Sales & purchase breakdown categorized by individual tax percentage brackets" },
  { id: "gstin_wise", num: 14, name: "GSTIN-wise Sales Report", shortName: "GSTIN-wise", category: "Sales & Outward", description: "Consolidated sales volume, taxable value, and tax collected grouped by client GSTIN" },
  { id: "place_of_supply", num: 15, name: "Place of Supply Report", shortName: "Place of Supply", category: "Sales & Outward", description: "State-wise sales & tax distribution across all 37 Indian States and Union Territories" },
  { id: "itc_report", num: 16, name: "Input Tax Credit (ITC) Report", shortName: "ITC Report", category: "Purchase & Inward", description: "Inward tax credits classified into Inputs, Input Services, Capital Goods, and Blocked ITC" },
  { id: "output_liability", num: 17, name: "Output GST Liability Report", shortName: "Output Liability", category: "Govt Returns", description: "Forward charge & RCM tax liability vs ITC utilization and cash ledger balance" },
  { id: "reconciliation", num: 18, name: "GST Reconciliation Report", shortName: "Reconciliation", category: "Govt Returns", description: "2-way audit matching Books vs GSTR-1 and Books/GRN vs GSTR-2B with mismatch flags" },
  { id: "tds_payable", num: "T1", name: "TDS Payable", shortName: "TDS Payable", category: "TDS / TCS", description: "Tax Deducted at Source payable on vendor payments with section & rate (PDF layout)" },
  { id: "tds_receivable", num: "T2", name: "TDS Receivable", shortName: "TDS Receivable", category: "TDS / TCS", description: "TDS deducted by clients on sales invoices with PAN, section & rate (PDF layout)" },
  { id: "tcs_payable", num: "T3", name: "TCS Payable", shortName: "TCS Payable", category: "TDS / TCS", description: "Tax Collected at Source payable on high-value sales u/s 206C (PDF layout)" },
  { id: "tcs_receivable", num: "T4", name: "TCS Receivable", shortName: "TCS Receivable", category: "TDS / TCS", description: "TCS collected by suppliers on high-value purchases (PDF layout)" },
];

export function GstReportsSuite({ defaultReport = "gst_sales" }: { defaultReport?: GstReportType }) {
  const { tenant } = useTenant();
  const currentTenantId = tenant?.id || "default";
  const currentCompanyId = tenant?.id || "default";
  const { formatCurrency } = useCurrency();

  const [activeReport, setActiveReport] = useState<GstReportType>(defaultReport);
  const [dateFilter, setDateFilter] = useState<"this_week" | "this_month" | "this_quarter" | "this_fy" | "custom">("this_month");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeSubTab, setActiveSubTab] = useState<string>("all");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sync prop changes
  useEffect(() => {
    if (defaultReport) {
      setActiveReport(defaultReport);
    }
  }, [defaultReport]);

  // Load Invoices from localStorage & API
  const rawInvoices = useMemo(() => {
    try {
      const keys = [
        `pos_saved_invoices_${currentTenantId}_${currentCompanyId}`,
        `pos_saved_invoices_${currentTenantId}`,
        "pos_saved_invoices_default_default",
        "pos_saved_invoices"
      ];
      let storedList: any[] = [];
      for (const k of keys) {
        const item = localStorage.getItem(k);
        if (item) {
          try {
            const parsed = JSON.parse(item);
            if (Array.isArray(parsed) && parsed.length > 0) {
              storedList = parsed;
              break;
            }
          } catch (e) {}
        }
      }

      // If no stored list or small list, enrich with realistic GST sample data
      if (!storedList || storedList.length === 0) {
        storedList = generateSampleGstInvoices();
      }
      return storedList;
    } catch (e) {
      return generateSampleGstInvoices();
    }
  }, [currentTenantId, currentCompanyId]);

  // Load Purchases / GRNs
  const rawPurchases = useMemo(() => {
    return generateSampleGstPurchases();
  }, []);

  // Filter by Date Range
  const filteredData = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = new Date();

    if (dateFilter === "this_week") {
      const day = now.getDay();
      start = new Date(now);
      start.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      start.setHours(0, 0, 0, 0);
    } else if (dateFilter === "this_month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (dateFilter === "this_quarter") {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), qMonth, 1);
    } else if (dateFilter === "this_fy") {
      const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      start = new Date(fyStartYear, 3, 1);
    } else if (customStartDate && customEndDate) {
      start = new Date(customStartDate);
      end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999);
    } else {
      start = new Date(now.getFullYear(), 0, 1);
    }

    const filterFn = (item: any) => {
      if (!item.date && !item.invoice_date && !item.createdAt) return true;
      const dStr = item.date || item.invoice_date || item.createdAt;
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return true;
      return d >= start && d <= end;
    };

    const invs = rawInvoices.filter(filterFn);
    const purs = rawPurchases.filter(filterFn);

    return { invoices: invs, purchases: purs };
  }, [rawInvoices, rawPurchases, dateFilter, customStartDate, customEndDate]);

  // Aggregate Metrics for Active Report
  const metrics = useMemo(() => {
    const invs = filteredData.invoices;
    const purs = filteredData.purchases;

    let totalSalesTaxable = 0;
    let totalSalesCgst = 0;
    let totalSalesSgst = 0;
    let totalSalesIgst = 0;
    let totalSalesCess = 0;
    let totalSalesValue = 0;

    invs.forEach((inv: any) => {
      const tax = inv.tax || inv.total_tax || 0;
      const isInter = inv.is_interstate || (inv.customer_gstin && !inv.customer_gstin.startsWith("37") && !inv.customer_gstin.startsWith("36"));
      const taxable = inv.taxable_amount || (inv.total || inv.grand_total || 0) - tax;
      totalSalesTaxable += taxable;
      totalSalesValue += (inv.total || inv.grand_total || taxable + tax);
      if (isInter) {
        totalSalesIgst += tax;
      } else {
        totalSalesCgst += tax / 2;
        totalSalesSgst += tax / 2;
      }
      totalSalesCess += inv.cess || 0;
    });

    let totalPurchaseTaxable = 0;
    let totalPurchaseCgst = 0;
    let totalPurchaseSgst = 0;
    let totalPurchaseIgst = 0;
    let totalPurchaseCess = 0;
    let totalPurchaseValue = 0;

    purs.forEach((p: any) => {
      const tax = p.cgst + p.sgst + p.igst;
      totalPurchaseTaxable += p.taxable_value;
      totalPurchaseCgst += p.cgst;
      totalPurchaseSgst += p.sgst;
      totalPurchaseIgst += p.igst;
      totalPurchaseCess += p.cess || 0;
      totalPurchaseValue += p.amount || (p.taxable_value + tax);
    });

    const netOutputLiability = (totalSalesCgst + totalSalesSgst + totalSalesIgst);
    const netInputCredit = (totalPurchaseCgst + totalPurchaseSgst + totalPurchaseIgst);
    const netGstPayable = Math.max(0, netOutputLiability - netInputCredit);

    return {
      totalSalesTaxable,
      totalSalesCgst,
      totalSalesSgst,
      totalSalesIgst,
      totalSalesCess,
      totalSalesValue,
      totalSalesTax: totalSalesCgst + totalSalesSgst + totalSalesIgst + totalSalesCess,
      salesCount: invs.length,

      totalPurchaseTaxable,
      totalPurchaseCgst,
      totalPurchaseSgst,
      totalPurchaseIgst,
      totalPurchaseCess,
      totalPurchaseValue,
      totalPurchaseTax: totalPurchaseCgst + totalPurchaseSgst + totalPurchaseIgst + totalPurchaseCess,
      purchaseCount: purs.length,

      netOutputLiability,
      netInputCredit,
      netGstPayable
    };
  }, [filteredData]);

  // Export handlers
  const handleExportCsv = () => {
    toast.success(`Exporting ${activeReport.toUpperCase()} to Excel/CSV...`);
    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(`Report: ${activeReport.toUpperCase()}\nGenerated: ${new Date().toISOString()}\nTotal Value: ${metrics.totalSalesValue}\n`);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `${activeReport}_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJson = () => {
    const payload = {
      gstin: "37AAACG1234F1Z5",
      fp: "092026",
      version: "GSTR_V1.0",
      report: activeReport,
      data: filteredData
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeReport}_gov_portal_ready.json`;
    a.click();
    toast.success("Govt GST Portal JSON exported successfully");
  };

  const currentMeta = GST_REPORTS_LIST.find((r) => r.id === activeReport) || GST_REPORTS_LIST[0];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Top Action & Filtering Toolbar */}
      <header className="bg-white border-b border-slate-200 px-5 py-3 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Title & Description */}
          <div>
            <h1 className="text-base font-extrabold text-slate-900">{currentMeta.name}</h1>
            <p className="text-xs text-slate-500 mt-0.5">{currentMeta.description}</p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Excel / CSV</span>
            </button>

            {(activeReport === "gstr1" || activeReport === "gstr3b") && (
              <button
                onClick={handleDownloadJson}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-2xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON</span>
              </button>
            )}

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-600" />
              <span>Print PDF</span>
            </button>
          </div>
        </div>

        {/* Filter Bar (Date Selector + Search) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-2.5 border-t border-slate-100">
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
              <CalendarIcon className="size-3.5 text-indigo-500" /> Period:
            </span>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="h-8 px-2.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
            >
              <option value="this_month">This Month</option>
              <option value="this_week">This Week</option>
              <option value="this_quarter">This Quarter</option>
              <option value="this_fy">This Financial Year</option>
              <option value="custom">📅 Custom Range</option>
            </select>

            {dateFilter === "custom" && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white"
                />
              </div>
            )}
          </div>

          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search party, GSTIN, invoice..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Scrollable Report Content */}
      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          {renderReportContent(activeReport, filteredData, searchTerm, formatCurrency, activeSubTab, setActiveSubTab)}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Specific Report Tables & Views (Exact PDF Layouts & Computations)
// ─────────────────────────────────────────────────────────────

function renderReportContent(
  type: GstReportType,
  data: { invoices: any[]; purchases: any[] },
  searchTerm: string,
  formatCurrency: (val: number) => string,
  activeSubTab: string,
  setActiveSubTab: (t: string) => void
) {
  const term = searchTerm.toLowerCase().trim();

  switch (type) {
    // ── 5. Sales GST Report (With HSN) - Exact layout from PDF Page 1 ──
    case "gst_sales": {
      const rows: any[] = [];
      data.invoices.forEach((inv) => {
        const partyName = inv.customer_name || inv.customer?.name || "Cash Customer";
        const partyGst = inv.customer_gstin || inv.customer?.gstin || "URP";
        const invNo = inv.invoice_number || inv.invoice_no || inv.id || "INV-001";
        const invDate = inv.date || inv.invoice_date || "2026-09-20";
        const isInter = inv.is_interstate || (partyGst.length === 15 && !partyGst.startsWith("37") && !partyGst.startsWith("36"));

        const items = Array.isArray(inv.items) && inv.items.length > 0 ? inv.items : [
          { name: inv.item_name || "General Goods", hsn: inv.hsn || "84713010", quantity: 1, price: inv.taxable_amount || 1000, tax_rate: 18 }
        ];

        items.forEach((it: any) => {
          const qty = it.quantity || it.qty || 1;
          const price = it.price || it.unit_price || it.rate || 0;
          const taxable = qty * price;
          const rate = it.tax_rate || it.gst_rate || 18;
          const taxAmt = (taxable * rate) / 100;
          const sgst = isInter ? 0 : taxAmt / 2;
          const cgst = isInter ? 0 : taxAmt / 2;
          const igst = isInter ? taxAmt : 0;
          const sgstRate = isInter ? 0 : rate / 2;
          const cgstRate = isInter ? 0 : rate / 2;
          const igstRate = isInter ? rate : 0;
          const amount = taxable + taxAmt;

          rows.push({
            date: invDate,
            invoice_no: invNo,
            party_gstin: partyGst,
            party_name: partyName,
            item_name: it.name || it.item_name || "Product Item",
            hsn_code: it.hsn || it.hsn_code || "84713010",
            qty: qty,
            price_unit: price,
            tax_rate: rate,
            sgst_rate: sgstRate,
            cgst_rate: cgstRate,
            igst_rate: igstRate,
            sgst: sgst,
            cgst: cgst,
            igst: igst,
            amount: amount,
          });
        });
      });

      const filteredRows = rows.filter((r) => {
        if (!term) return true;
        return (
          r.invoice_no.toLowerCase().includes(term) ||
          r.party_name.toLowerCase().includes(term) ||
          r.party_gstin.toLowerCase().includes(term) ||
          r.item_name.toLowerCase().includes(term) ||
          r.hsn_code.toLowerCase().includes(term)
        );
      });

      return (
        <div className="p-0">
          <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
            <div>
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                <Receipt className="w-4 h-4 text-primary" /> GST Sales (With HSN) Register
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Itemized outward taxable supplies with tax components & rates</p>
            </div>
            <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
              {filteredRows.length} Line Items
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-muted/60 text-muted-foreground font-bold border-b border-border/70 uppercase text-[11px]">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Invoice No</th>
                  <th className="px-4 py-3">Party GSTIN</th>
                  <th className="px-4 py-3">Party Name</th>
                  <th className="px-4 py-3">Item Name</th>
                  <th className="px-4 py-3">HSN Code</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Price/Unit</th>
                  <th className="px-4 py-3 text-right">SGST (% & Amt)</th>
                  <th className="px-4 py-3 text-right">CGST (% & Amt)</th>
                  <th className="px-4 py-3 text-right">IGST (% & Amt)</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium text-foreground">
                {filteredRows.map((r, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">{r.date}</td>
                    <td className="px-4 py-3 font-bold text-primary">{r.invoice_no}</td>
                    <td className="px-4 py-3 font-mono text-[11px]">{r.party_gstin}</td>
                    <td className="px-4 py-3 font-semibold">{r.party_name}</td>
                    <td className="px-4 py-3">{r.item_name}</td>
                    <td className="px-4 py-3 font-mono">{r.hsn_code}</td>
                    <td className="px-4 py-3 text-right">{r.qty}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(r.price_unit)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 mr-1.5">
                        {r.sgst_rate}%
                      </span>
                      <span className="text-emerald-600 font-semibold">{formatCurrency(r.sgst)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60 mr-1.5">
                        {r.cgst_rate}%
                      </span>
                      <span className="text-blue-600 font-semibold">{formatCurrency(r.cgst)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/60 mr-1.5">
                        {r.igst_rate}%
                      </span>
                      <span className="text-purple-600 font-semibold">{formatCurrency(r.igst)}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold">{formatCurrency(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/70 font-bold border-t border-border text-foreground">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-right uppercase">Total:</td>
                  <td className="px-4 py-3 text-right">{filteredRows.reduce((a, b) => a + Number(b.qty), 0)}</td>
                  <td className="px-4 py-3 text-right">—</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(filteredRows.reduce((a, b) => a + b.sgst, 0))}</td>
                  <td className="px-4 py-3 text-right text-blue-600">{formatCurrency(filteredRows.reduce((a, b) => a + b.cgst, 0))}</td>
                  <td className="px-4 py-3 text-right text-purple-600">{formatCurrency(filteredRows.reduce((a, b) => a + b.igst, 0))}</td>
                  <td className="px-4 py-3 text-right text-primary text-sm">{formatCurrency(filteredRows.reduce((a, b) => a + b.amount, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      );
    }

    // ── 6. Purchase GST Report (With HSN) - Exact layout from PDF Page 1 ──
    case "gst_purchase": {
      const filteredPurchases = data.purchases.filter((p) => {
        if (!term) return true;
        return (
          p.invoice_no.toLowerCase().includes(term) ||
          p.original_inv_no.toLowerCase().includes(term) ||
          p.party_name.toLowerCase().includes(term) ||
          p.party_gstin.toLowerCase().includes(term) ||
          p.item_name.toLowerCase().includes(term) ||
          p.hsn_code.toLowerCase().includes(term)
        );
      });

      return (
        <div className="p-0">
          <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
            <div>
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-600" /> GST Purchase (With HSN) Register
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Itemized inward purchases eligible for Input Tax Credit & rates</p>
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
              {filteredPurchases.length} Purchase Bills
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-muted/60 text-muted-foreground font-bold border-b border-border/70 uppercase text-[11px]">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Invoice No</th>
                  <th className="px-4 py-3">Original Inv No</th>
                  <th className="px-4 py-3">Party GSTIN</th>
                  <th className="px-4 py-3">Party Name</th>
                  <th className="px-4 py-3">Item Name</th>
                  <th className="px-4 py-3">HSN Code</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Price/Unit</th>
                  <th className="px-4 py-3 text-right">SGST (% & Amt)</th>
                  <th className="px-4 py-3 text-right">CGST (% & Amt)</th>
                  <th className="px-4 py-3 text-right">IGST (% & Amt)</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium text-foreground">
                {filteredPurchases.map((r, i) => {
                  const stateCode = r.party_gstin?.slice(0, 2) || "37";
                  const isInter = stateCode !== "37" || r.is_interstate || (r.sgst === 0 && r.igst > 0);
                  const rate = Number(r.tax_rate || 18);
                  const sgstRate = isInter ? 0 : rate / 2;
                  const cgstRate = isInter ? 0 : rate / 2;
                  const igstRate = isInter ? rate : 0;

                  return (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground">{r.date}</td>
                      <td className="px-4 py-3 font-bold text-primary">{r.invoice_no}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono">{r.original_inv_no || "—"}</td>
                      <td className="px-4 py-3 font-mono text-[11px]">{r.party_gstin}</td>
                      <td className="px-4 py-3 font-semibold">{r.party_name}</td>
                      <td className="px-4 py-3">{r.item_name}</td>
                      <td className="px-4 py-3 font-mono">{r.hsn_code}</td>
                      <td className="px-4 py-3 text-right">{r.qty}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(r.price_unit)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 mr-1.5">
                          {sgstRate}%
                        </span>
                        <span className="text-emerald-600 font-semibold">{formatCurrency(r.sgst)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60 mr-1.5">
                          {cgstRate}%
                        </span>
                        <span className="text-blue-600 font-semibold">{formatCurrency(r.cgst)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/60 mr-1.5">
                          {igstRate}%
                        </span>
                        <span className="text-purple-600 font-semibold">{formatCurrency(r.igst)}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold">{formatCurrency(r.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted/70 font-bold border-t border-border text-foreground">
                <tr>
                  <td colSpan={7} className="px-4 py-3 text-right uppercase">Total:</td>
                  <td className="px-4 py-3 text-right">{filteredPurchases.reduce((a, b) => a + Number(b.qty), 0)}</td>
                  <td className="px-4 py-3 text-right">—</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(filteredPurchases.reduce((a, b) => a + b.sgst, 0))}</td>
                  <td className="px-4 py-3 text-right text-blue-600">{formatCurrency(filteredPurchases.reduce((a, b) => a + b.cgst, 0))}</td>
                  <td className="px-4 py-3 text-right text-purple-600">{formatCurrency(filteredPurchases.reduce((a, b) => a + b.igst, 0))}</td>
                  <td className="px-4 py-3 text-right text-primary text-sm">{formatCurrency(filteredPurchases.reduce((a, b) => a + b.amount, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      );
    }

    // ── GSTR-2 (Purchase) - Exact layout from PDF Page 1 ──
    case "gstr2_purchase": {
      const isReturn = activeSubTab === "returns";
      const sourceList = isReturn ? generateSamplePurchaseReturns() : data.purchases;

      return (
        <div className="p-0">
          <div className="px-6 py-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveSubTab("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  !isReturn ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                Purchase
              </button>
              <button
                onClick={() => setActiveSubTab("returns")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isReturn ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                Purchase Return
              </button>
            </div>
            <span className="text-xs text-muted-foreground">Auto-grouped by Place of Supply & Tax %</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-muted/60 text-muted-foreground font-bold border-b border-border/70 uppercase text-[11px]">
                <tr>
                  <th rowSpan={2} className="px-4 py-3 border-r border-border/50">GSTIN</th>
                  <th rowSpan={2} className="px-4 py-3 border-r border-border/50">Customer / Supplier Name</th>
                  <th colSpan={2} className="px-4 py-2 text-center border-b border-r border-border/50 bg-muted/80">Place of Supply</th>
                  <th colSpan={5} className="px-4 py-2 text-center border-b border-r border-border/50 bg-muted/80">Invoice Details</th>
                  <th colSpan={5} className="px-4 py-2 text-center border-b border-border/50 bg-muted/80">Amount of Tax & Rates</th>
                </tr>
                <tr>
                  <th className="px-3 py-2 text-center">State Code</th>
                  <th className="px-3 py-2 border-r border-border/50">State Name</th>
                  <th className="px-3 py-2">Invoice No / Original No</th>
                  <th className="px-3 py-2">Invoice Date</th>
                  <th className="px-3 py-2 text-right">Invoice Value</th>
                  <th className="px-3 py-2 text-right">Total Tax %</th>
                  <th className="px-3 py-2 text-right border-r border-border/50">Taxable Value</th>
                  <th className="px-3 py-2 text-right">SGST (% & Amt)</th>
                  <th className="px-3 py-2 text-right">CGST (% & Amt)</th>
                  <th className="px-3 py-2 text-right">IGST (% & Amt)</th>
                  <th className="px-3 py-2 text-right">Cess</th>
                  <th className="px-3 py-2 text-right font-bold">Total Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium text-foreground">
                {sourceList.map((r: any, i: number) => {
                  const stateCode = r.party_gstin?.slice(0, 2) || "37";
                  const stateName = INDIAN_GST_STATES[stateCode] || "Andhra Pradesh";
                  const taxPct = Number(r.tax_rate || 18);
                  const isInter = stateCode !== "37" || r.is_interstate || (r.sgst === 0 && r.igst > 0);
                  const sgstRate = isInter ? 0 : taxPct / 2;
                  const cgstRate = isInter ? 0 : taxPct / 2;
                  const igstRate = isInter ? taxPct : 0;
                  const totalTax = (r.sgst || 0) + (r.cgst || 0) + (r.igst || 0) + (r.cess || 0);

                  return (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-[11px] border-r border-border/40">{r.party_gstin}</td>
                      <td className="px-4 py-3 font-semibold border-r border-border/40">{r.party_name}</td>
                      <td className="px-3 py-3 text-center font-mono">{stateCode}</td>
                      <td className="px-3 py-3 border-r border-border/40">{stateName}</td>
                      <td className="px-3 py-3 font-bold text-primary">{r.invoice_no || r.original_inv_no}</td>
                      <td className="px-3 py-3 text-muted-foreground">{r.date}</td>
                      <td className="px-3 py-3 text-right font-semibold">{formatCurrency(r.amount || r.invoice_value)}</td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-slate-700">{taxPct}%</td>
                      <td className="px-3 py-3 text-right font-semibold border-r border-border/40">{formatCurrency(r.taxable_value || (r.price_unit * r.qty))}</td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 mr-1.5">
                          {sgstRate}%
                        </span>
                        <span className="text-emerald-600 font-semibold">{formatCurrency(r.sgst || 0)}</span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60 mr-1.5">
                          {cgstRate}%
                        </span>
                        <span className="text-blue-600 font-semibold">{formatCurrency(r.cgst || 0)}</span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/60 mr-1.5">
                          {igstRate}%
                        </span>
                        <span className="text-purple-600 font-semibold">{formatCurrency(r.igst || 0)}</span>
                      </td>
                      <td className="px-3 py-3 text-right">{formatCurrency(r.cess || 0)}</td>
                      <td className="px-3 py-3 text-right font-bold text-primary">{formatCurrency(totalTax)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // ── 8. HSN / SAC Wise Summary - Exact layout from PDF Page 1 ──
    case "hsn_summary": {
      const hsnMap: Record<string, any> = {};

      data.invoices.forEach((inv) => {
        const partyGst = inv.customer_gstin || "";
        const isInter = inv.is_interstate || (partyGst.length === 15 && !partyGst.startsWith("37") && !partyGst.startsWith("36"));
        const items = Array.isArray(inv.items) && inv.items.length > 0 ? inv.items : [
          { name: inv.item_name || "General Goods", hsn: inv.hsn || "84713010", quantity: 1, price: inv.taxable_amount || 1000, tax_rate: 18 }
        ];

        items.forEach((it: any) => {
          const hsn = it.hsn || it.hsn_code || "84713010";
          const name = it.name || it.item_name || "Industrial Component";
          const qty = it.quantity || it.qty || 1;
          const price = it.price || it.unit_price || 0;
          const taxable = qty * price;
          const rate = Number(it.tax_rate || 18);
          const taxAmt = (taxable * rate) / 100;
          const sgst = isInter ? 0 : taxAmt / 2;
          const cgst = isInter ? 0 : taxAmt / 2;
          const igst = isInter ? taxAmt : 0;
          const cess = it.cess || 0;
          const totalVal = taxable + taxAmt + cess;

          if (!hsnMap[hsn]) {
            hsnMap[hsn] = {
              hsn: hsn,
              itemName: name,
              taxRate: rate,
              totalQty: 0,
              totalValue: 0,
              taxableValue: 0,
              igst: 0,
              cgst: 0,
              sgst: 0,
              cess: 0,
              totalTax: 0
            };
          }

          hsnMap[hsn].totalQty += qty;
          hsnMap[hsn].totalValue += totalVal;
          hsnMap[hsn].taxableValue += taxable;
          hsnMap[hsn].igst += igst;
          hsnMap[hsn].cgst += cgst;
          hsnMap[hsn].sgst += sgst;
          hsnMap[hsn].cess += cess;
          hsnMap[hsn].totalTax += (taxAmt + cess);
        });
      });

      const hsnList = Object.values(hsnMap);

      return (
        <div className="p-0">
          <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
            <div>
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                <Tag className="w-4 h-4 text-purple-600" /> HSN / SAC Wise Sales Summary
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Government GSTR-1 Table 12 compliant commodity code rollup</p>
            </div>
            <span className="text-xs font-bold text-purple-600 bg-purple-500/10 px-2.5 py-1 rounded-lg">
              {hsnList.length} Unique HSN/SAC Codes
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-muted/60 text-muted-foreground font-bold border-b border-border/70 uppercase text-[11px]">
                <tr>
                  <th className="px-4 py-3">HSN Code</th>
                  <th className="px-4 py-3">Item Name</th>
                  <th className="px-4 py-3 text-right">Total Quantity</th>
                  <th className="px-4 py-3 text-right">Total Value</th>
                  <th className="px-4 py-3 text-right">Taxable Value</th>
                  <th className="px-4 py-3 text-right">IGST (% & Amt)</th>
                  <th className="px-4 py-3 text-right">CGST (% & Amt)</th>
                  <th className="px-4 py-3 text-right">SGST (% & Amt)</th>
                  <th className="px-4 py-3 text-right">Cess</th>
                  <th className="px-4 py-3 text-right font-bold">Total Tax Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium text-foreground">
                {hsnList.map((h, i) => {
                  const rate = h.taxRate || 18;
                  return (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-primary">{h.hsn}</td>
                      <td className="px-4 py-3 font-semibold">{h.itemName}</td>
                      <td className="px-4 py-3 text-right font-mono">{h.totalQty}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(h.totalValue)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(h.taxableValue)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/60 mr-1.5">
                          {rate}%
                        </span>
                        <span className="text-purple-600 font-semibold">{formatCurrency(h.igst)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60 mr-1.5">
                          {rate / 2}%
                        </span>
                        <span className="text-blue-600 font-semibold">{formatCurrency(h.cgst)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 mr-1.5">
                          {rate / 2}%
                        </span>
                        <span className="text-emerald-600 font-semibold">{formatCurrency(h.sgst)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">{formatCurrency(h.cess)}</td>
                      <td className="px-4 py-3 text-right font-bold text-primary">{formatCurrency(h.totalTax)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // ── 1. GSTR-1 – Sales / Outward supplies return ──
    case "gstr1": {
      return renderGstr1Dashboard(data, formatCurrency, activeSubTab, setActiveSubTab);
    }

    // ── 2. GSTR-3B – Summary of GST liability & ITC ──
    case "gstr3b": {
      return renderGstr3bDashboard(data, formatCurrency);
    }

    // ── 3. GSTR-2B / ITC Report ──
    case "gstr2b": {
      return renderGstr2bDashboard(data, formatCurrency);
    }

    // ── 7. GST Tax Summary (Rate Slabs) ──
    case "gst_tax_summary": {
      return renderGstTaxSummary(data, formatCurrency);
    }

    // ── 9. B2B Sales Report ──
    case "b2b_sales": {
      const b2bInvoices = data.invoices.filter((inv) => {
        const gstin = inv.customer_gstin || inv.customer?.gstin;
        return gstin && gstin.length === 15;
      });

      return (
        <div className="p-0">
          <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
            <div>
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" /> B2B Registered Sales Register (Table 4A)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Invoices issued to registered GSTIN taxpayers</p>
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-500/10 px-2.5 py-1 rounded-lg">
              {b2bInvoices.length} Invoices
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-muted/60 text-muted-foreground font-bold border-b border-border/70 uppercase text-[11px]">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Invoice No</th>
                  <th className="px-4 py-3">Recipient GSTIN</th>
                  <th className="px-4 py-3">Receiver Name</th>
                  <th className="px-4 py-3">Place of Supply</th>
                  <th className="px-4 py-3 text-center">Reverse Charge</th>
                  <th className="px-4 py-3 text-right">Taxable Value</th>
                  <th className="px-4 py-3 text-right">CGST (% & Amt)</th>
                  <th className="px-4 py-3 text-right">SGST (% & Amt)</th>
                  <th className="px-4 py-3 text-right">IGST (% & Amt)</th>
                  <th className="px-4 py-3 text-right font-bold">Total Invoice Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium text-foreground">
                {b2bInvoices.map((inv, i) => {
                  const gstin = inv.customer_gstin || inv.customer?.gstin || "37AAACG1234F1Z5";
                  const posState = INDIAN_GST_STATES[gstin.slice(0, 2)] || "Andhra Pradesh";
                  const tax = inv.tax || inv.total_tax || 0;
                  const isInter = gstin.slice(0, 2) !== "37";
                  const taxable = inv.taxable_amount || (inv.total || 0) - tax;
                  const taxRate = taxable > 0 ? Math.round((tax / taxable) * 100) : 18;
                  const cgstRate = isInter ? 0 : taxRate / 2;
                  const sgstRate = isInter ? 0 : taxRate / 2;
                  const igstRate = isInter ? taxRate : 0;

                  return (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground">{inv.date || "2026-09-20"}</td>
                      <td className="px-4 py-3 font-bold text-primary">{inv.invoice_number || inv.id}</td>
                      <td className="px-4 py-3 font-mono font-bold text-blue-600">{gstin}</td>
                      <td className="px-4 py-3 font-semibold">{inv.customer_name || inv.customer?.name}</td>
                      <td className="px-4 py-3">{gstin.slice(0, 2)} - {posState}</td>
                      <td className="px-4 py-3 text-center"><span className="px-2 py-0.5 rounded text-[10px] bg-muted font-bold">N</span></td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(taxable)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60 mr-1.5">
                          {cgstRate}%
                        </span>
                        <span className="text-blue-600 font-semibold">{formatCurrency(isInter ? 0 : tax / 2)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 mr-1.5">
                          {sgstRate}%
                        </span>
                        <span className="text-emerald-600 font-semibold">{formatCurrency(isInter ? 0 : tax / 2)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/60 mr-1.5">
                          {igstRate}%
                        </span>
                        <span className="text-purple-600 font-semibold">{formatCurrency(isInter ? tax : 0)}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-primary">{formatCurrency(inv.total || inv.grand_total || (taxable + tax))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // ── 10. B2C Sales Report ──
    case "b2c_sales": {
      const b2cInvoices = data.invoices.filter((inv) => {
        const gstin = inv.customer_gstin || inv.customer?.gstin;
        return !gstin || gstin.length !== 15;
      });

      return (
        <div className="p-0">
          <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
            <div>
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600" /> B2C Consumer Sales (Table 5 & 7)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Supplies to unregistered retail consumers</p>
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
              {b2cInvoices.length} Retail Transactions
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-muted/60 text-muted-foreground font-bold border-b border-border/70 uppercase text-[11px]">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Bill / Invoice No</th>
                  <th className="px-4 py-3">Customer Name</th>
                  <th className="px-4 py-3">Supply Type</th>
                  <th className="px-4 py-3">POS State</th>
                  <th className="px-4 py-3 text-right">Rate %</th>
                  <th className="px-4 py-3 text-right">Taxable Value</th>
                  <th className="px-4 py-3 text-right">SGST (% & Amt)</th>
                  <th className="px-4 py-3 text-right">CGST (% & Amt)</th>
                  <th className="px-4 py-3 text-right">IGST (% & Amt)</th>
                  <th className="px-4 py-3 text-right font-bold">Total Bill Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium text-foreground">
                {b2cInvoices.map((inv, i) => {
                  const tax = inv.tax || inv.total_tax || 0;
                  const isInter = inv.is_interstate || false;
                  const taxable = inv.taxable_amount || (inv.total || 0) - tax;
                  const taxRate = taxable > 0 ? Math.round((tax / taxable) * 100) : 18;
                  const sgstRate = isInter ? 0 : taxRate / 2;
                  const cgstRate = isInter ? 0 : taxRate / 2;
                  const igstRate = isInter ? taxRate : 0;

                  return (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground">{inv.date || "2026-09-20"}</td>
                      <td className="px-4 py-3 font-bold text-primary">{inv.invoice_number || inv.id}</td>
                      <td className="px-4 py-3 font-semibold">{inv.customer_name || "Counter Customer"}</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-600 font-bold">B2C Small</span></td>
                      <td className="px-4 py-3">37 - Andhra Pradesh</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-700">{taxRate}%</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(taxable)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 mr-1.5">
                          {sgstRate}%
                        </span>
                        <span className="text-emerald-600 font-semibold">{formatCurrency(isInter ? 0 : tax / 2)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60 mr-1.5">
                          {cgstRate}%
                        </span>
                        <span className="text-blue-600 font-semibold">{formatCurrency(isInter ? 0 : tax / 2)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/60 mr-1.5">
                          {igstRate}%
                        </span>
                        <span className="text-purple-600 font-semibold">{formatCurrency(isInter ? tax : 0)}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold">{formatCurrency(inv.total || inv.grand_total || (taxable + tax))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // ── 11. Export Sales Report ──
    case "export_sales": {
      const exportList = generateSampleExportSales();
      return (
        <div className="p-0">
          <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
            <div>
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-sky-600" /> Zero-Rated & Export Outward Supplies (Table 6A)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">International and SEZ exports with shipping bill & LUT verification</p>
            </div>
            <span className="text-xs font-bold text-sky-600 bg-sky-500/10 px-2.5 py-1 rounded-lg">
              {exportList.length} Shipping Records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-muted/60 text-muted-foreground font-bold border-b border-border/70 uppercase text-[11px]">
                <tr>
                  <th className="px-4 py-3">Export Type</th>
                  <th className="px-4 py-3">Invoice No</th>
                  <th className="px-4 py-3">Invoice Date</th>
                  <th className="px-4 py-3">Port Code</th>
                  <th className="px-4 py-3">Shipping Bill No</th>
                  <th className="px-4 py-3">Shipping Bill Date</th>
                  <th className="px-4 py-3">Currency</th>
                  <th className="px-4 py-3 text-right">Taxable Value (INR)</th>
                  <th className="px-4 py-3 text-right font-bold">IGST Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium text-foreground">
                {exportList.map((ex, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-[10px] bg-sky-500/10 text-sky-600 font-bold">{ex.type}</span></td>
                    <td className="px-4 py-3 font-bold text-primary">{ex.invoice_no}</td>
                    <td className="px-4 py-3 text-muted-foreground">{ex.date}</td>
                    <td className="px-4 py-3 font-mono">{ex.port_code}</td>
                    <td className="px-4 py-3 font-mono font-bold">{ex.shipping_bill_no}</td>
                    <td className="px-4 py-3 text-muted-foreground">{ex.shipping_bill_date}</td>
                    <td className="px-4 py-3 font-bold">{ex.currency}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(ex.taxable_value)}</td>
                    <td className="px-4 py-3 text-right font-bold text-purple-600">{formatCurrency(ex.igst)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // ── 12. Credit Note / Debit Note GST Report (CDNR / CDNUR) ──
    case "cdnr_report": {
      const cdnList = generateSampleCreditDebitNotes();
      return (
        <div className="p-0">
          <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
            <div>
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-600" /> Credit / Debit Notes GST Adjustments (Table 9B)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Supplementary invoices, post-sale discounts, and sales return credit notes</p>
            </div>
            <span className="text-xs font-bold text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-lg">
              {cdnList.length} Notes Issued
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-muted/60 text-muted-foreground font-bold border-b border-border/70 uppercase text-[11px]">
                <tr>
                  <th className="px-4 py-3">Note Date</th>
                  <th className="px-4 py-3">Note Type</th>
                  <th className="px-4 py-3">Note No</th>
                  <th className="px-4 py-3">Original Inv No</th>
                  <th className="px-4 py-3">Original Inv Date</th>
                  <th className="px-4 py-3">Party GSTIN</th>
                  <th className="px-4 py-3">Party Name</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3 text-right">Taxable Value</th>
                  <th className="px-4 py-3 text-right">CGST (% & Amt)</th>
                  <th className="px-4 py-3 text-right">SGST (% & Amt)</th>
                  <th className="px-4 py-3 text-right">IGST (% & Amt)</th>
                  <th className="px-4 py-3 text-right font-bold">Total Note Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium text-foreground">
                {cdnList.map((c, i) => {
                  const totalTax = (c.cgst || 0) + (c.sgst || 0) + (c.igst || 0);
                  const isInter = (c.party_gstin && !c.party_gstin.startsWith("37")) || (c.cgst === 0 && c.igst > 0);
                  const taxRate = c.taxable > 0 ? Math.round((totalTax / c.taxable) * 100) : 18;
                  const cgstRate = isInter ? 0 : taxRate / 2;
                  const sgstRate = isInter ? 0 : taxRate / 2;
                  const igstRate = isInter ? taxRate : 0;

                  return (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground">{c.date}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.type === "Credit Note" ? "bg-red-500/10 text-red-600" : "bg-blue-500/10 text-blue-600"}`}>{c.type}</span></td>
                      <td className="px-4 py-3 font-bold text-primary">{c.note_no}</td>
                      <td className="px-4 py-3 font-mono">{c.orig_inv_no}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.orig_date}</td>
                      <td className="px-4 py-3 font-mono text-[11px]">{c.party_gstin}</td>
                      <td className="px-4 py-3 font-semibold">{c.party_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.reason}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(c.taxable)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60 mr-1.5">
                          {cgstRate}%
                        </span>
                        <span className="text-blue-600 font-semibold">{formatCurrency(c.cgst)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 mr-1.5">
                          {sgstRate}%
                        </span>
                        <span className="text-emerald-600 font-semibold">{formatCurrency(c.sgst)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/60 mr-1.5">
                          {igstRate}%
                        </span>
                        <span className="text-purple-600 font-semibold">{formatCurrency(c.igst)}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold">{formatCurrency(c.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // ── 14. GSTIN-wise Sales Report ──
    case "gstin_wise": {
      const gstinMap: Record<string, any> = {};
      data.invoices.forEach((inv) => {
        const gstin = inv.customer_gstin || inv.customer?.gstin || "URP (Unregistered)";
        const name = inv.customer_name || inv.customer?.name || "Retail Counter";
        const tax = inv.tax || inv.total_tax || 0;
        const isInter = gstin.length === 15 && !gstin.startsWith("37");
        const taxable = inv.taxable_amount || (inv.total || 0) - tax;

        if (!gstinMap[gstin]) {
          gstinMap[gstin] = {
            gstin,
            name,
            state: gstin.length === 15 ? (INDIAN_GST_STATES[gstin.slice(0, 2)] || "Andhra Pradesh") : "Andhra Pradesh",
            invCount: 0,
            taxable: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
            total: 0
          };
        }

        gstinMap[gstin].invCount += 1;
        gstinMap[gstin].taxable += taxable;
        gstinMap[gstin].cgst += isInter ? 0 : tax / 2;
        gstinMap[gstin].sgst += isInter ? 0 : tax / 2;
        gstinMap[gstin].igst += isInter ? tax : 0;
        gstinMap[gstin].total += (inv.total || inv.grand_total || taxable + tax);
      });

      const gstinList = Object.values(gstinMap);

      return (
        <div className="p-0">
          <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
            <div>
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" /> GSTIN-wise Customer Turnover & Tax Breakdown
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Aggregated sales and tax yield per customer GSTIN</p>
            </div>
            <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
              {gstinList.length} Customer Accounts
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-muted/60 text-muted-foreground font-bold border-b border-border/70 uppercase text-[11px]">
                <tr>
                  <th className="px-4 py-3">Customer GSTIN</th>
                  <th className="px-4 py-3">Trade / Legal Name</th>
                  <th className="px-4 py-3">State</th>
                  <th className="px-4 py-3 text-center">Invoices</th>
                  <th className="px-4 py-3 text-right">Taxable Turnover</th>
                  <th className="px-4 py-3 text-right">CGST (% & Amt)</th>
                  <th className="px-4 py-3 text-right">SGST (% & Amt)</th>
                  <th className="px-4 py-3 text-right">IGST (% & Amt)</th>
                  <th className="px-4 py-3 text-right font-bold">Total Invoiced Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium text-foreground">
                {gstinList.map((g, i) => {
                  const isInter = g.gstin.length === 15 && !g.gstin.startsWith("37");
                  const cgstRate = isInter ? 0 : 9;
                  const sgstRate = isInter ? 0 : 9;
                  const igstRate = isInter ? 18 : 0;

                  return (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-blue-600">{g.gstin}</td>
                      <td className="px-4 py-3 font-semibold">{g.name}</td>
                      <td className="px-4 py-3">{g.state}</td>
                      <td className="px-4 py-3 text-center"><span className="px-2 py-0.5 rounded bg-muted font-bold">{g.invCount}</span></td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(g.taxable)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60 mr-1.5">
                          {cgstRate}%
                        </span>
                        <span className="text-blue-600 font-semibold">{formatCurrency(g.cgst)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 mr-1.5">
                          {sgstRate}%
                        </span>
                        <span className="text-emerald-600 font-semibold">{formatCurrency(g.sgst)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/60 mr-1.5">
                          {igstRate}%
                        </span>
                        <span className="text-purple-600 font-semibold">{formatCurrency(g.igst)}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-primary">{formatCurrency(g.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // ── 15. Place of Supply Report ──
    case "place_of_supply": {
      return renderPlaceOfSupplyReport(data, formatCurrency);
    }

    // ── 16. Input Tax Credit (ITC) Report ──
    case "itc_report": {
      return renderItcClassificationReport(data, formatCurrency);
    }

    // ── 17. Output GST Liability Report ──
    case "output_liability": {
      return renderOutputLiabilityReport(data, formatCurrency);
    }

    // ── 18. GST Reconciliation Report ──
    case "reconciliation": {
      return renderReconciliationReport(data, formatCurrency);
    }

    // ── TDS Payable - Exact layout from PDF Page 1 ──
    case "tds_payable": {
      const list = generateSampleTdsPayable();
      return renderTdsTcsTable(list, "TDS Payable", "Tax Deducted at Source on Vendor Payments", formatCurrency);
    }

    // ── TDS Receivable - Exact layout from PDF Page 2 ──
    case "tds_receivable": {
      const list = generateSampleTdsReceivable();
      return renderTdsTcsTable(list, "TDS Receivable", "TDS Deducted by Customers on Invoices", formatCurrency);
    }

    // ── TCS Payable - Exact layout from PDF Page 2 ──
    case "tcs_payable": {
      const list = generateSampleTcsPayable();
      return renderTdsTcsTable(list, "TCS Payable", "Tax Collected at Source on Outward Supplies", formatCurrency);
    }

    // ── TCS Receivable - Exact layout from PDF Page 2 ──
    case "tcs_receivable": {
      const list = generateSampleTcsReceivable();
      return renderTdsTcsTable(list, "TCS Receivable", "TCS Deducted by Suppliers on Inward Purchases", formatCurrency);
    }

    default:
      return (
        <div className="p-8 text-center text-muted-foreground">
          Select a GST report from the top navigation to view details.
        </div>
      );
  }
}

// ─────────────────────────────────────────────────────────────
// Specific Tab Dashboards & Table Renderers
// ─────────────────────────────────────────────────────────────

function renderGstr1Dashboard(
  data: { invoices: any[]; purchases: any[] },
  formatCurrency: (val: number) => string,
  activeSubTab: string,
  setActiveSubTab: (t: string) => void
) {
  const subTabs = [
    { id: "all", label: "Overview Summary" },
    { id: "4a_b2b", label: "4A, 4B, 6B - B2B Invoices" },
    { id: "5a_b2cl", label: "5A - B2C Large" },
    { id: "7_b2cs", label: "7 - B2C Small" },
    { id: "9b_cdnr", label: "9B - Credit/Debit (CDNR)" },
    { id: "6a_exp", label: "6A - Exports (EXP)" },
    { id: "12_hsn", label: "12 - HSN Summary" },
    { id: "13_docs", label: "13 - Docs Issued" },
  ];

  return (
    <div className="p-0">
      <div className="px-6 py-3 border-b border-border/60 bg-muted/20 flex items-center gap-2 overflow-x-auto scrollbar-thin">
        {subTabs.map((st) => (
          <button
            key={st.id}
            onClick={() => setActiveSubTab(st.id)}
            className={`px-3 py-1 text-xs font-bold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
              activeSubTab === st.id
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted"
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-muted/30 border border-border/50 rounded-xl p-4">
            <span className="text-xs font-bold text-muted-foreground uppercase">Table 4: B2B Invoices</span>
            <div className="text-xl font-bold text-foreground mt-1">₹ 2,45,800.00</div>
            <div className="text-xs text-blue-600 font-semibold mt-1">CGST: ₹22,122 | SGST: ₹22,122</div>
          </div>
          <div className="bg-muted/30 border border-border/50 rounded-xl p-4">
            <span className="text-xs font-bold text-muted-foreground uppercase">Table 7: B2C Small</span>
            <div className="text-xl font-bold text-foreground mt-1">₹ 1,12,400.00</div>
            <div className="text-xs text-emerald-600 font-semibold mt-1">Intra-State Retail</div>
          </div>
          <div className="bg-muted/30 border border-border/50 rounded-xl p-4">
            <span className="text-xs font-bold text-muted-foreground uppercase">Table 6A: Exports</span>
            <div className="text-xl font-bold text-foreground mt-1">₹ 85,000.00</div>
            <div className="text-xs text-purple-600 font-semibold mt-1">LUT Zero Rated</div>
          </div>
          <div className="bg-muted/30 border border-border/50 rounded-xl p-4">
            <span className="text-xs font-bold text-muted-foreground uppercase">Table 9B: Net Returns</span>
            <div className="text-xl font-bold text-red-500 mt-1">-₹ 14,200.00</div>
            <div className="text-xs text-muted-foreground font-semibold mt-1">Credit Notes Offset</div>
          </div>
        </div>

        {/* Detailed GSTR-1 Return Table */}
        <div className="border border-border/60 rounded-xl overflow-hidden">
          <div className="bg-muted/60 px-4 py-3 font-bold text-xs uppercase tracking-wider text-muted-foreground flex justify-between">
            <span>GSTR-1 Return Schedule & Tax Breakdown</span>
            <span>Period: Current FY</span>
          </div>
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-muted/40 font-bold text-muted-foreground border-b border-border/60">
              <tr>
                <th className="px-4 py-3">Section</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-center">Invoices</th>
                <th className="px-4 py-3 text-right">Taxable Value</th>
                <th className="px-4 py-3 text-right">IGST (% & Amt)</th>
                <th className="px-4 py-3 text-right">CGST (% & Amt)</th>
                <th className="px-4 py-3 text-right">SGST (% & Amt)</th>
                <th className="px-4 py-3 text-right font-bold">Total Tax</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-medium text-foreground">
              <tr className="hover:bg-muted/30">
                <td className="px-4 py-3 font-bold text-primary">4A, 4B</td>
                <td className="px-4 py-3 font-semibold">B2B Regular Tax Invoices</td>
                <td className="px-4 py-3 text-center">18</td>
                <td className="px-4 py-3 text-right">{formatCurrency(245800)}</td>
                <td className="px-4 py-3 text-right">
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/60 mr-1.5">18%</span>
                  <span className="text-purple-600 font-semibold">{formatCurrency(14200)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60 mr-1.5">9%</span>
                  <span className="text-blue-600 font-semibold">{formatCurrency(15031)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 mr-1.5">9%</span>
                  <span className="text-emerald-600 font-semibold">{formatCurrency(15031)}</span>
                </td>
                <td className="px-4 py-3 text-right font-bold">{formatCurrency(44262)}</td>
              </tr>
              <tr className="hover:bg-muted/30">
                <td className="px-4 py-3 font-bold text-primary">5A, 5B</td>
                <td className="px-4 py-3 font-semibold">B2C Large (Inter-state &gt; 2.5 Lakhs)</td>
                <td className="px-4 py-3 text-center">2</td>
                <td className="px-4 py-3 text-right">{formatCurrency(540000)}</td>
                <td className="px-4 py-3 text-right">
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/60 mr-1.5">18%</span>
                  <span className="text-purple-600 font-semibold">{formatCurrency(97200)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60 mr-1.5">0%</span>
                  <span className="text-blue-600 font-semibold">{formatCurrency(0)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 mr-1.5">0%</span>
                  <span className="text-emerald-600 font-semibold">{formatCurrency(0)}</span>
                </td>
                <td className="px-4 py-3 text-right font-bold">{formatCurrency(97200)}</td>
              </tr>
              <tr className="hover:bg-muted/30">
                <td className="px-4 py-3 font-bold text-primary">7</td>
                <td className="px-4 py-3 font-semibold">B2C Small (Net of Credit Notes)</td>
                <td className="px-4 py-3 text-center">42</td>
                <td className="px-4 py-3 text-right">{formatCurrency(112400)}</td>
                <td className="px-4 py-3 text-right">
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/60 mr-1.5">0%</span>
                  <span className="text-purple-600 font-semibold">{formatCurrency(0)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60 mr-1.5">9%</span>
                  <span className="text-blue-600 font-semibold">{formatCurrency(10116)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 mr-1.5">9%</span>
                  <span className="text-emerald-600 font-semibold">{formatCurrency(10116)}</span>
                </td>
                <td className="px-4 py-3 text-right font-bold">{formatCurrency(20232)}</td>
              </tr>
              <tr className="hover:bg-muted/30">
                <td className="px-4 py-3 font-bold text-primary">6A</td>
                <td className="px-4 py-3 font-semibold">Exports (With / Without Payment of Tax)</td>
                <td className="px-4 py-3 text-center">3</td>
                <td className="px-4 py-3 text-right">{formatCurrency(85000)}</td>
                <td className="px-4 py-3 text-right">
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/60 mr-1.5">0%</span>
                  <span className="text-purple-600 font-semibold">{formatCurrency(0)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60 mr-1.5">0%</span>
                  <span className="text-blue-600 font-semibold">{formatCurrency(0)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 mr-1.5">0%</span>
                  <span className="text-emerald-600 font-semibold">{formatCurrency(0)}</span>
                </td>
                <td className="px-4 py-3 text-right font-bold">{formatCurrency(0)}</td>
              </tr>
              <tr className="hover:bg-muted/30">
                <td className="px-4 py-3 font-bold text-primary">9B</td>
                <td className="px-4 py-3 font-semibold">Credit / Debit Notes (Registered CDNR)</td>
                <td className="px-4 py-3 text-center">2</td>
                <td className="px-4 py-3 text-right text-red-500">-{formatCurrency(14200)}</td>
                <td className="px-4 py-3 text-right text-red-500">
                  <span className="text-[10px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200/60 mr-1.5">0%</span>
                  -{formatCurrency(0)}
                </td>
                <td className="px-4 py-3 text-right text-red-500">
                  <span className="text-[10px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200/60 mr-1.5">9%</span>
                  -{formatCurrency(1278)}
                </td>
                <td className="px-4 py-3 text-right text-red-500">
                  <span className="text-[10px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200/60 mr-1.5">9%</span>
                  -{formatCurrency(1278)}
                </td>
                <td className="px-4 py-3 text-right font-bold text-red-500">-{formatCurrency(2556)}</td>
              </tr>
            </tbody>
            <tfoot className="bg-muted/70 font-bold border-t border-border">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right uppercase">Net Total GSTR-1:</td>
                <td className="px-4 py-3 text-right text-foreground">{formatCurrency(969000)}</td>
                <td className="px-4 py-3 text-right text-purple-600">{formatCurrency(111400)}</td>
                <td className="px-4 py-3 text-right text-blue-600">{formatCurrency(23869)}</td>
                <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(23869)}</td>
                <td className="px-4 py-3 text-right text-primary text-sm">{formatCurrency(159138)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function renderGstr3bDashboard(data: { invoices: any[]; purchases: any[] }, formatCurrency: (val: number) => string) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" /> Table 3.1: Details of Outward Supplies & Inward Supplies Liable to Reverse Charge
        </h3>
      </div>
      <div className="border border-border/60 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-muted/60 font-bold text-muted-foreground border-b border-border/70 uppercase text-[11px]">
            <tr>
              <th className="px-4 py-3">Nature of Supplies</th>
              <th className="px-4 py-3 text-right">Total Taxable Value</th>
              <th className="px-4 py-3 text-right">Integrated Tax (IGST)</th>
              <th className="px-4 py-3 text-right">Central Tax (CGST)</th>
              <th className="px-4 py-3 text-right">State/UT Tax (SGST)</th>
              <th className="px-4 py-3 text-right">Cess</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 font-medium text-foreground">
            <tr className="hover:bg-muted/30">
              <td className="px-4 py-3 font-semibold">(a) Outward Taxable Supplies (other than zero rated, nil rated & exempted)</td>
              <td className="px-4 py-3 text-right">{formatCurrency(884000)}</td>
              <td className="px-4 py-3 text-right text-purple-600">{formatCurrency(111400)}</td>
              <td className="px-4 py-3 text-right text-blue-600">{formatCurrency(23869)}</td>
              <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(23869)}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(0)}</td>
            </tr>
            <tr className="hover:bg-muted/30">
              <td className="px-4 py-3 font-semibold">(b) Outward Taxable Supplies (Zero Rated)</td>
              <td className="px-4 py-3 text-right">{formatCurrency(85000)}</td>
              <td className="px-4 py-3 text-right text-purple-600">{formatCurrency(0)}</td>
              <td className="px-4 py-3 text-right text-blue-600">{formatCurrency(0)}</td>
              <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(0)}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(0)}</td>
            </tr>
            <tr className="hover:bg-muted/30">
              <td className="px-4 py-3 font-semibold">(c) Other Outward Supplies (Nil Rated, Exempted)</td>
              <td className="px-4 py-3 text-right">{formatCurrency(12500)}</td>
              <td className="px-4 py-3 text-right text-purple-600">{formatCurrency(0)}</td>
              <td className="px-4 py-3 text-right text-blue-600">{formatCurrency(0)}</td>
              <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(0)}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(0)}</td>
            </tr>
            <tr className="hover:bg-muted/30">
              <td className="px-4 py-3 font-semibold">(d) Inward Supplies Liable to Reverse Charge (RCM)</td>
              <td className="px-4 py-3 text-right">{formatCurrency(18000)}</td>
              <td className="px-4 py-3 text-right text-purple-600">{formatCurrency(0)}</td>
              <td className="px-4 py-3 text-right text-blue-600">{formatCurrency(1620)}</td>
              <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(1620)}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(0)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="pt-2">
        <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" /> Table 4: Eligible Input Tax Credit (ITC)
        </h3>
      </div>
      <div className="border border-border/60 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-muted/60 font-bold text-muted-foreground border-b border-border/70 uppercase text-[11px]">
            <tr>
              <th className="px-4 py-3">Details</th>
              <th className="px-4 py-3 text-right">Integrated Tax (IGST)</th>
              <th className="px-4 py-3 text-right">Central Tax (CGST)</th>
              <th className="px-4 py-3 text-right">State/UT Tax (SGST)</th>
              <th className="px-4 py-3 text-right">Cess</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 font-medium text-foreground">
            <tr className="hover:bg-muted/30">
              <td className="px-4 py-3 font-semibold">(A) (5) All other ITC (Purchases from Registered Persons)</td>
              <td className="px-4 py-3 text-right text-purple-600">{formatCurrency(32400)}</td>
              <td className="px-4 py-3 text-right text-blue-600">{formatCurrency(18920)}</td>
              <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(18920)}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(0)}</td>
            </tr>
            <tr className="hover:bg-muted/30">
              <td className="px-4 py-3 font-semibold">(B) (2) ITC Reversed (Rule 42/43 / Others)</td>
              <td className="px-4 py-3 text-right text-red-500">-{formatCurrency(0)}</td>
              <td className="px-4 py-3 text-right text-red-500">-{formatCurrency(450)}</td>
              <td className="px-4 py-3 text-right text-red-500">-{formatCurrency(450)}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(0)}</td>
            </tr>
            <tr className="bg-muted/40 font-bold">
              <td className="px-4 py-3">(C) Net ITC Available (A) - (B)</td>
              <td className="px-4 py-3 text-right text-purple-600">{formatCurrency(32400)}</td>
              <td className="px-4 py-3 text-right text-blue-600">{formatCurrency(18470)}</td>
              <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(18470)}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(0)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="pt-2">
        <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
          <Percent className="w-4 h-4 text-primary" /> Table 6.1: Payment of Tax & Cash Offset Ledger
        </h3>
      </div>
      <div className="border border-border/60 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-muted/60 font-bold text-muted-foreground border-b border-border/70 uppercase text-[11px]">
            <tr>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Tax Payable</th>
              <th className="px-4 py-3 text-right">Paid via IGST Credit</th>
              <th className="px-4 py-3 text-right">Paid via CGST Credit</th>
              <th className="px-4 py-3 text-right">Paid via SGST Credit</th>
              <th className="px-4 py-3 text-right font-bold text-primary">Tax Paid in Cash</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 font-medium text-foreground">
            <tr className="hover:bg-muted/30">
              <td className="px-4 py-3 font-semibold">Integrated Tax (IGST)</td>
              <td className="px-4 py-3 text-right">{formatCurrency(111400)}</td>
              <td className="px-4 py-3 text-right text-purple-600">{formatCurrency(32400)}</td>
              <td className="px-4 py-3 text-right">—</td>
              <td className="px-4 py-3 text-right">—</td>
              <td className="px-4 py-3 text-right font-bold text-primary">{formatCurrency(79000)}</td>
            </tr>
            <tr className="hover:bg-muted/30">
              <td className="px-4 py-3 font-semibold">Central Tax (CGST)</td>
              <td className="px-4 py-3 text-right">{formatCurrency(25489)}</td>
              <td className="px-4 py-3 text-right">—</td>
              <td className="px-4 py-3 text-right text-blue-600">{formatCurrency(18470)}</td>
              <td className="px-4 py-3 text-right">—</td>
              <td className="px-4 py-3 text-right font-bold text-primary">{formatCurrency(7019)}</td>
            </tr>
            <tr className="hover:bg-muted/30">
              <td className="px-4 py-3 font-semibold">State Tax (SGST)</td>
              <td className="px-4 py-3 text-right">{formatCurrency(25489)}</td>
              <td className="px-4 py-3 text-right">—</td>
              <td className="px-4 py-3 text-right">—</td>
              <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(18470)}</td>
              <td className="px-4 py-3 text-right font-bold text-primary">{formatCurrency(7019)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderGstr2bDashboard(data: { invoices: any[]; purchases: any[] }, formatCurrency: (val: number) => string) {
  const gstr2bList = generateSampleGstr2b();
  return (
    <div className="p-0">
      <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
        <div>
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Auto-Drafted Input Tax Credit Statement (GSTR-2B)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Static ITC statement populated from supplier GSTR-1 filings</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
            ITC Available: ₹ 69,790
          </span>
          <span className="text-xs font-bold text-red-500 bg-red-500/10 px-2.5 py-1 rounded-lg">
            Ineligible: ₹ 4,500
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-muted/60 text-muted-foreground font-bold border-b border-border/70 uppercase text-[11px]">
            <tr>
              <th className="px-4 py-3">Supplier GSTIN</th>
              <th className="px-4 py-3">Trade Name</th>
              <th className="px-4 py-3">Invoice No</th>
              <th className="px-4 py-3">Invoice Date</th>
              <th className="px-4 py-3 text-right">Invoice Value</th>
              <th className="px-4 py-3">POS State</th>
              <th className="px-4 py-3 text-center">GSTR-1 Filing Date</th>
              <th className="px-4 py-3 text-right">Taxable Value</th>
              <th className="px-4 py-3 text-right">IGST (% & Amt)</th>
              <th className="px-4 py-3 text-right">CGST (% & Amt)</th>
              <th className="px-4 py-3 text-right">SGST (% & Amt)</th>
              <th className="px-4 py-3 text-center">ITC Eligibility</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 font-medium text-foreground">
            {gstr2bList.map((r, i) => {
              const isInter = r.igst > 0;
              const igstRate = isInter ? 18 : 0;
              const cgstRate = isInter ? 0 : 9;
              const sgstRate = isInter ? 0 : 9;

              return (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-blue-600">{r.gstin}</td>
                  <td className="px-4 py-3 font-semibold">{r.name}</td>
                  <td className="px-4 py-3 font-bold text-primary">{r.inv_no}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.date}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(r.value)}</td>
                  <td className="px-4 py-3">{r.pos}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{r.filing_date}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(r.taxable)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/60 mr-1.5">
                      {igstRate}%
                    </span>
                    <span className="text-purple-600 font-semibold">{formatCurrency(r.igst)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60 mr-1.5">
                      {cgstRate}%
                    </span>
                    <span className="text-blue-600 font-semibold">{formatCurrency(r.cgst)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 mr-1.5">
                      {sgstRate}%
                    </span>
                    <span className="text-emerald-600 font-semibold">{formatCurrency(r.sgst)}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.eligible ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-500"}`}>
                      {r.eligible ? "Eligible" : "Ineligible (Sec 17(5))"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderGstTaxSummary(data: { invoices: any[]; purchases: any[] }, formatCurrency: (val: number) => string) {
  const slabs = [
    { slab: "0% (Nil / Exempt)", outwardTaxable: 45000, inwardTaxable: 12000, rate: 0 },
    { slab: "5% Goods & Services", outwardTaxable: 180000, inwardTaxable: 95000, rate: 5 },
    { slab: "12% Standard Concessional", outwardTaxable: 340000, inwardTaxable: 140000, rate: 12 },
    { slab: "18% General Standard", outwardTaxable: 1250000, inwardTaxable: 620000, rate: 18 },
    { slab: "28% Luxury / Sin Goods", outwardTaxable: 210000, inwardTaxable: 80000, rate: 28 },
  ];

  return (
    <div className="p-0">
      <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
        <div>
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
            <Percent className="w-4 h-4 text-primary" /> GST Tax Summary by Rate Slabs
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Slab-wise breakdown of Output Tax Liability vs Input Tax Credit</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-muted/60 text-muted-foreground font-bold border-b border-border/70 uppercase text-[11px]">
            <tr>
              <th className="px-4 py-3">GST Rate Slab</th>
              <th className="px-4 py-3 text-right">Outward Taxable</th>
              <th className="px-4 py-3 text-right">Output CGST (% & Amt)</th>
              <th className="px-4 py-3 text-right">Output SGST (% & Amt)</th>
              <th className="px-4 py-3 text-right">Output IGST (% & Amt)</th>
              <th className="px-4 py-3 text-right">Inward Taxable</th>
              <th className="px-4 py-3 text-right text-emerald-600">Input ITC (Total)</th>
              <th className="px-4 py-3 text-right font-bold text-primary">Net Tax Liability</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 font-medium text-foreground">
            {slabs.map((s, i) => {
              const outTax = (s.outwardTaxable * s.rate) / 100;
              const inTax = (s.inwardTaxable * s.rate) / 100;
              const net = outTax - inTax;
              const cgst = outTax * 0.35;
              const sgst = outTax * 0.35;
              const igst = outTax * 0.3;

              return (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-bold">{s.slab}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(s.outwardTaxable)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60 mr-1.5">
                      {s.rate / 2}%
                    </span>
                    <span className="text-blue-600 font-semibold">{formatCurrency(cgst)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 mr-1.5">
                      {s.rate / 2}%
                    </span>
                    <span className="text-emerald-600 font-semibold">{formatCurrency(sgst)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/60 mr-1.5">
                      {s.rate}%
                    </span>
                    <span className="text-purple-600 font-semibold">{formatCurrency(igst)}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(s.inwardTaxable)}</td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-semibold">{formatCurrency(inTax)}</td>
                  <td className="px-4 py-3 text-right font-bold text-primary">{formatCurrency(net)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderPlaceOfSupplyReport(data: { invoices: any[]; purchases: any[] }, formatCurrency: (val: number) => string) {
  const posList = generateSamplePosDistribution();
  return (
    <div className="p-0">
      <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
        <div>
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
            <Building2 className="w-4 h-4 text-purple-600" /> State-wise Place of Supply (POS) Distribution
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Breakdown across 37 States and Union Territories of India with CGST, SGST & IGST</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-muted/60 text-muted-foreground font-bold border-b border-border/70 uppercase text-[11px]">
            <tr>
              <th className="px-4 py-3">State Code</th>
              <th className="px-4 py-3">Place of Supply (State / UT)</th>
              <th className="px-4 py-3">Supply Type</th>
              <th className="px-4 py-3 text-right">Taxable Turnover</th>
              <th className="px-4 py-3 text-right">CGST (% & Amt)</th>
              <th className="px-4 py-3 text-right">SGST (% & Amt)</th>
              <th className="px-4 py-3 text-right">IGST (% & Amt)</th>
              <th className="px-4 py-3 text-right font-bold text-primary">Gross Invoiced Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 font-medium text-foreground">
            {posList.map((p, i) => {
              const isIntra = p.type === "Intra-State";
              const cgstRate = isIntra ? 9 : 0;
              const sgstRate = isIntra ? 9 : 0;
              const igstRate = isIntra ? 0 : 18;

              return (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-primary">{p.code}</td>
                  <td className="px-4 py-3 font-semibold">{p.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isIntra ? "bg-blue-500/10 text-blue-600" : "bg-purple-500/10 text-purple-600"}`}>
                      {p.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(p.taxable)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60 mr-1.5">
                      {cgstRate}%
                    </span>
                    <span className="text-blue-600 font-semibold">{formatCurrency(p.cgst)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 mr-1.5">
                      {sgstRate}%
                    </span>
                    <span className="text-emerald-600 font-semibold">{formatCurrency(p.sgst)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/60 mr-1.5">
                      {igstRate}%
                    </span>
                    <span className="text-purple-600 font-semibold">{formatCurrency(p.igst)}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-primary">{formatCurrency(p.gross)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderItcClassificationReport(data: { invoices: any[]; purchases: any[] }, formatCurrency: (val: number) => string) {
  const itcCategories = [
    { cat: "Inputs (Raw Materials & Consumables)", taxable: 650000, cgst: 58500, sgst: 58500, igst: 14000, status: "Eligible" },
    { cat: "Input Services (Auditing, Software, Rent)", taxable: 220000, cgst: 19800, sgst: 19800, igst: 8500, status: "Eligible" },
    { cat: "Capital Goods (Plant, Machinery, Computers)", taxable: 480000, cgst: 43200, sgst: 43200, igst: 24000, status: "Eligible" },
    { cat: "RCM Inward Supplies (GTA, Advocate Fees)", taxable: 35000, cgst: 1750, sgst: 1750, igst: 0, status: "Eligible" },
    { cat: "Blocked ITC u/s 17(5) (Food, Motor Vehicles, Club)", taxable: 45000, cgst: 4050, sgst: 4050, igst: 0, status: "Ineligible (Blocked)" },
  ];

  return (
    <div className="p-0">
      <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
        <div>
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Input Tax Credit (ITC) Categorization & Blocked Credits
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Section 16 & Section 17(5) statutory ITC breakdown with tax rates</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-muted/60 text-muted-foreground font-bold border-b border-border/70 uppercase text-[11px]">
            <tr>
              <th className="px-4 py-3">ITC Category</th>
              <th className="px-4 py-3 text-right">Taxable Inward Value</th>
              <th className="px-4 py-3 text-right">CGST (% & Amt)</th>
              <th className="px-4 py-3 text-right">SGST (% & Amt)</th>
              <th className="px-4 py-3 text-right">IGST (% & Amt)</th>
              <th className="px-4 py-3 text-right font-bold">Total ITC</th>
              <th className="px-4 py-3 text-center">Eligibility Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 font-medium text-foreground">
            {itcCategories.map((c, i) => {
              const total = c.cgst + c.sgst + c.igst;
              const isEligible = c.status === "Eligible";
              return (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-semibold">{c.cat}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(c.taxable)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60 mr-1.5">
                      9%
                    </span>
                    <span className="text-blue-600 font-semibold">{formatCurrency(c.cgst)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 mr-1.5">
                      9%
                    </span>
                    <span className="text-emerald-600 font-semibold">{formatCurrency(c.sgst)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/60 mr-1.5">
                      {c.igst > 0 ? "18%" : "0%"}
                    </span>
                    <span className="text-purple-600 font-semibold">{formatCurrency(c.igst)}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold">{formatCurrency(total)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${isEligible ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-500"}`}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderOutputLiabilityReport(data: { invoices: any[]; purchases: any[] }, formatCurrency: (val: number) => string) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> Gross Output GST Liability & Settlement Statement
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">Detailed breakdown of forward charge liability vs available credit offset</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-border/60 rounded-xl p-4 bg-muted/20">
          <span className="text-xs font-bold text-muted-foreground uppercase">Gross Output Tax Due</span>
          <div className="text-2xl font-black text-foreground mt-2">₹ 2,12,400.00</div>
          <p className="text-xs text-muted-foreground mt-1">Tax on outward sales + advances</p>
        </div>
        <div className="border border-border/60 rounded-xl p-4 bg-muted/20">
          <span className="text-xs font-bold text-muted-foreground uppercase">ITC Set-off Utilized</span>
          <div className="text-2xl font-black text-emerald-600 mt-2">₹ 1,54,800.00</div>
          <p className="text-xs text-muted-foreground mt-1">From Electronic Credit Ledger</p>
        </div>
        <div className="border border-border/60 rounded-xl p-4 bg-primary/5 border-primary/20">
          <span className="text-xs font-bold text-primary uppercase">Net Cash Payment Required</span>
          <div className="text-2xl font-black text-primary mt-2">₹ 57,600.00</div>
          <p className="text-xs text-muted-foreground mt-1">To be deposited via PMT-06 Challan</p>
        </div>
      </div>
    </div>
  );
}

function renderReconciliationReport(data: { invoices: any[]; purchases: any[] }, formatCurrency: (val: number) => string) {
  const reconList = [
    { inv: "INV-2026-081", party: "Tata Consultancy Services", booksTaxable: 120000, portalTaxable: 120000, status: "Exact Match", diff: 0 },
    { inv: "INV-2026-085", party: "Infosys Technologies Ltd", booksTaxable: 85000, portalTaxable: 85000, status: "Exact Match", diff: 0 },
    { inv: "INV-2026-089", party: "Apex Global Supplies", booksTaxable: 45000, portalTaxable: 40000, status: "Value Mismatch", diff: 5000 },
    { inv: "INV-2026-092", party: "Wipro Enterprises", booksTaxable: 92000, portalTaxable: 0, status: "Missing in Portal (Supplier not filed)", diff: 92000 },
    { inv: "INV-2026-096", party: "L&T Construction Div", booksTaxable: 154000, portalTaxable: 154000, status: "Exact Match", diff: 0 },
  ];

  return (
    <div className="p-0">
      <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
        <div>
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-primary" /> 2-Way GST Reconciliation (Books vs GSTR-2B)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Audit comparison identifying missing supplier invoices and mismatch amounts</p>
        </div>
        <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
          92% Matched
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-muted/60 text-muted-foreground font-bold border-b border-border/70 uppercase text-[11px]">
            <tr>
              <th className="px-4 py-3">Invoice No</th>
              <th className="px-4 py-3">Vendor / Party Name</th>
              <th className="px-4 py-3 text-right">Taxable in Books</th>
              <th className="px-4 py-3 text-right">Taxable in GSTR-2B</th>
              <th className="px-4 py-3 text-right">Difference</th>
              <th className="px-4 py-3 text-center">Match Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 font-medium text-foreground">
            {reconList.map((r, i) => {
              const isMatch = r.status === "Exact Match";
              return (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-bold text-primary">{r.inv}</td>
                  <td className="px-4 py-3 font-semibold">{r.party}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(r.booksTaxable)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(r.portalTaxable)}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-500">{r.diff > 0 ? formatCurrency(r.diff) : "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isMatch ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                    }`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TDS & TCS Tables (PDF Page 1 & Page 2 Exact Layout)
// ─────────────────────────────────────────────────────────────

function renderTdsTcsTable(
  list: any[],
  title: string,
  subtitle: string,
  formatCurrency: (val: number) => string
) {
  const isTds = title.includes("TDS");
  const taxColName = isTds ? "TDS Amount" : "TCS Amount";

  return (
    <div className="p-0">
      <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
        <div>
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
            <Percent className="w-4 h-4 text-primary" /> {title} Register
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
          {list.length} Records
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-muted/60 text-muted-foreground font-bold border-b border-border/70 uppercase text-[11px]">
            <tr>
              <th className="px-4 py-3">Party Name</th>
              <th className="px-4 py-3">Party GST</th>
              <th className="px-4 py-3">Party PAN</th>
              <th className="px-4 py-3">Invoice No</th>
              <th className="px-4 py-3 text-right">Taxable Amount</th>
              <th className="px-4 py-3 text-right">Total Amount</th>
              <th className="px-4 py-3 text-right font-bold text-primary">{taxColName}</th>
              <th className="px-4 py-3">Tax Name</th>
              <th className="px-4 py-3 text-center">Tax Section</th>
              <th className="px-4 py-3 text-right">Tax Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 font-medium text-foreground">
            {list.map((r, i) => (
              <tr key={i} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-semibold">{r.party_name}</td>
                <td className="px-4 py-3 font-mono text-[11px]">{r.party_gst}</td>
                <td className="px-4 py-3 font-mono font-bold text-muted-foreground">{r.party_pan}</td>
                <td className="px-4 py-3 font-bold text-primary">{r.invoice_no}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatCurrency(r.taxable_amount)}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatCurrency(r.total_amount)}</td>
                <td className="px-4 py-3 text-right font-bold text-primary">{formatCurrency(r.tax_amount)}</td>
                <td className="px-4 py-3">{r.tax_name}</td>
                <td className="px-4 py-3 text-center font-mono font-bold"><span className="px-2 py-0.5 rounded bg-muted">{r.tax_section}</span></td>
                <td className="px-4 py-3 text-right font-mono font-bold">{r.tax_rate}%</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/70 font-bold border-t border-border text-foreground">
            <tr>
              <td colSpan={4} className="px-4 py-3 text-right uppercase">Total:</td>
              <td className="px-4 py-3 text-right">{formatCurrency(list.reduce((a, b) => a + b.taxable_amount, 0))}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(list.reduce((a, b) => a + b.total_amount, 0))}</td>
              <td className="px-4 py-3 text-right text-primary text-sm">{formatCurrency(list.reduce((a, b) => a + b.tax_amount, 0))}</td>
              <td colSpan={3} className="px-4 py-3"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Seed / Demo Data Generators for Instant Rich Reporting
// ─────────────────────────────────────────────────────────────

function generateSampleGstInvoices() {
  return [
    {
      id: "INV-2026-001",
      invoice_number: "INV-2026-001",
      date: "2026-09-22",
      customer_name: "Sri Sai Balaji Enterprises",
      customer_gstin: "37AAACS9876Q1Z2",
      taxable_amount: 145000,
      total_tax: 26100,
      total: 171100,
      is_interstate: false,
      items: [
        { name: "Industrial AC Servo Motor 5HP", hsn: "85015210", quantity: 2, price: 50000, tax_rate: 18 },
        { name: "Digital Variable Frequency Drive", hsn: "85044090", quantity: 3, price: 15000, tax_rate: 18 }
      ]
    },
    {
      id: "INV-2026-002",
      invoice_number: "INV-2026-002",
      date: "2026-09-21",
      customer_name: "Karnataka Precision Tools Pvt Ltd",
      customer_gstin: "29AABCK4321P1Z9",
      taxable_amount: 280000,
      total_tax: 50400,
      total: 330400,
      is_interstate: true,
      items: [
        { name: "CNC Carbide Cutting Inserts Box", hsn: "82090010", quantity: 10, price: 18000, tax_rate: 18 },
        { name: "High Speed Milling Cutter Assembly", hsn: "84669300", quantity: 2, price: 50000, tax_rate: 18 }
      ]
    },
    {
      id: "INV-2026-003",
      invoice_number: "INV-2026-003",
      date: "2026-09-20",
      customer_name: "Vijaya Trading Company",
      customer_gstin: "37ABCVT1122M1Z4",
      taxable_amount: 82000,
      total_tax: 14760,
      total: 96760,
      is_interstate: false,
      items: [
        { name: "Electronic Control Panel Enclosure", hsn: "85381010", quantity: 4, price: 20500, tax_rate: 18 }
      ]
    },
    {
      id: "INV-2026-004",
      invoice_number: "INV-2026-004",
      date: "2026-09-19",
      customer_name: "Walk-in Retail Customer",
      customer_gstin: "URP",
      taxable_amount: 18500,
      total_tax: 3330,
      total: 21830,
      is_interstate: false,
      items: [
        { name: "Heavy Duty Extension Reel 30M", hsn: "85444220", quantity: 5, price: 3700, tax_rate: 18 }
      ]
    },
    {
      id: "INV-2026-005",
      invoice_number: "INV-2026-005",
      date: "2026-09-18",
      customer_name: "Tamil Nadu Heavy Machinery Corp",
      customer_gstin: "33AABCT9988D1Z1",
      taxable_amount: 320000,
      total_tax: 57600,
      total: 377600,
      is_interstate: true,
      items: [
        { name: "Hydraulic Power Pack System", hsn: "84122900", quantity: 1, price: 320000, tax_rate: 18 }
      ]
    }
  ];
}

function generateSampleGstPurchases() {
  return [
    {
      date: "2026-09-21",
      invoice_no: "PUR-2026-091",
      original_inv_no: "TAX/26/9821",
      party_gstin: "37AAACH5544K1Z0",
      party_name: "Hyderabad Steels & Alloys Ltd",
      item_name: "Mild Steel Heavy Angle 50x50x6mm",
      hsn_code: "72162100",
      qty: 150,
      price_unit: 850,
      tax_rate: 18,
      taxable_value: 127500,
      sgst: 11475,
      cgst: 11475,
      igst: 0,
      amount: 150450
    },
    {
      date: "2026-09-20",
      invoice_no: "PUR-2026-092",
      original_inv_no: "INV-MH-4412",
      party_gstin: "27AABCP7766M1Z8",
      party_name: "Pune Electrical Switchgear Ltd",
      item_name: "Schneider MCB 32A Triple Pole",
      hsn_code: "85362030",
      qty: 60,
      price_unit: 1450,
      tax_rate: 18,
      taxable_value: 87000,
      sgst: 0,
      cgst: 0,
      igst: 15660,
      amount: 102660
    },
    {
      date: "2026-09-19",
      invoice_no: "PUR-2026-093",
      original_inv_no: "KA-INV-109",
      party_gstin: "29AABCB1234N1Z5",
      party_name: "Bengaluru Bearings & Seals",
      item_name: "SKF Deep Groove Ball Bearing 6205",
      hsn_code: "84821011",
      qty: 100,
      price_unit: 420,
      tax_rate: 18,
      taxable_value: 42000,
      sgst: 0,
      cgst: 0,
      igst: 7560,
      amount: 49560
    },
    {
      date: "2026-09-18",
      invoice_no: "PUR-2026-094",
      original_inv_no: "AP-VSP-331",
      party_gstin: "37AAACG7788L1Z9",
      party_name: "Visakha Hardware Distributing Co",
      item_name: "Industrial Fasteners & Bolts M12",
      hsn_code: "73181500",
      qty: 500,
      price_unit: 35,
      tax_rate: 18,
      taxable_value: 17500,
      sgst: 1575,
      cgst: 1575,
      igst: 0,
      amount: 20650
    }
  ];
}

function generateSamplePurchaseReturns() {
  return [
    {
      date: "2026-09-21",
      invoice_no: "PRTN-2026-001",
      original_inv_no: "TAX/26/9821",
      party_gstin: "37AAACH5544K1Z0",
      party_name: "Hyderabad Steels & Alloys Ltd",
      item_name: "Defective Angle Bars (Returned)",
      qty: 20,
      price_unit: 850,
      tax_rate: 18,
      taxable_value: 17000,
      sgst: 1530,
      cgst: 1530,
      igst: 0,
      amount: 20060
    }
  ];
}

function generateSampleExportSales() {
  return [
    {
      type: "EXPWP (With Tax)",
      invoice_no: "EXP-2026-001",
      date: "2026-09-20",
      port_code: "INVTZ1 (Vizag Port)",
      shipping_bill_no: "SB-982144",
      shipping_bill_date: "2026-09-19",
      currency: "USD ($3,500)",
      taxable_value: 290500,
      igst: 52290
    },
    {
      type: "EXPWOP (Under LUT)",
      invoice_no: "EXP-2026-002",
      date: "2026-09-18",
      port_code: "INMAA1 (Chennai Port)",
      shipping_bill_no: "SB-441209",
      shipping_bill_date: "2026-09-17",
      currency: "EUR (€4,200)",
      taxable_value: 378000,
      igst: 0
    }
  ];
}

function generateSampleCreditDebitNotes() {
  return [
    {
      date: "2026-09-21",
      type: "Credit Note",
      note_no: "CN-2026-001",
      orig_inv_no: "INV-2026-001",
      orig_date: "2026-09-20",
      party_gstin: "37AAACS9876Q1Z2",
      party_name: "Sri Sai Balaji Enterprises",
      reason: "Defective item returned",
      taxable: 15000,
      cgst: 1350,
      sgst: 1350,
      igst: 0,
      total: 17700
    },
    {
      date: "2026-09-19",
      type: "Debit Note",
      note_no: "DN-2026-001",
      orig_inv_no: "INV-2026-002",
      orig_date: "2026-09-18",
      party_gstin: "29AABCK4321P1Z9",
      party_name: "Karnataka Precision Tools Pvt Ltd",
      reason: "Supplementary price revision",
      taxable: 8000,
      cgst: 0,
      sgst: 0,
      igst: 1440,
      total: 9440
    }
  ];
}

function generateSampleGstr2b() {
  return [
    {
      gstin: "37AAACH5544K1Z0",
      name: "Hyderabad Steels & Alloys Ltd",
      inv_no: "TAX/26/9821",
      date: "2026-09-21",
      value: 150450,
      pos: "37 - Andhra Pradesh",
      filing_date: "2026-09-22",
      taxable: 127500,
      igst: 0,
      cgst: 11475,
      sgst: 11475,
      eligible: true
    },
    {
      gstin: "27AABCP7766M1Z8",
      name: "Pune Electrical Switchgear Ltd",
      inv_no: "INV-MH-4412",
      date: "2026-09-20",
      value: 102660,
      pos: "37 - Andhra Pradesh",
      filing_date: "2026-09-21",
      taxable: 87000,
      igst: 15660,
      cgst: 0,
      sgst: 0,
      eligible: true
    },
    {
      gstin: "37AAACG1122M1Z0",
      name: "Executive Club & Catering",
      inv_no: "CAT-2026-44",
      date: "2026-09-19",
      value: 29500,
      pos: "37 - Andhra Pradesh",
      filing_date: "2026-09-20",
      taxable: 25000,
      igst: 0,
      cgst: 2250,
      sgst: 2250,
      eligible: false
    }
  ];
}

function generateSamplePosDistribution() {
  return [
    { code: "37", name: "Andhra Pradesh (Home State)", type: "Intra-State", taxable: 1420000, cgst: 127800, sgst: 127800, igst: 0, gross: 1675600 },
    { code: "36", name: "Telangana", type: "Inter-State", taxable: 580000, cgst: 0, sgst: 0, igst: 104400, gross: 684400 },
    { code: "29", name: "Karnataka", type: "Inter-State", taxable: 420000, cgst: 0, sgst: 0, igst: 75600, gross: 495600 },
    { code: "33", name: "Tamil Nadu", type: "Inter-State", taxable: 360000, cgst: 0, sgst: 0, igst: 64800, gross: 424800 },
    { code: "27", name: "Maharashtra", type: "Inter-State", taxable: 290000, cgst: 0, sgst: 0, igst: 52200, gross: 342200 },
    { code: "07", name: "Delhi", type: "Inter-State", taxable: 180000, cgst: 0, sgst: 0, igst: 32400, gross: 212400 },
  ];
}

function generateSampleTdsPayable() {
  return [
    {
      party_name: "Apex Facility Management Ltd",
      party_gst: "37AAACA8899K1Z4",
      party_pan: "AAACA8899K",
      invoice_no: "SRV-2026-091",
      taxable_amount: 85000,
      total_amount: 100300,
      tax_amount: 1700,
      tax_name: "TDS on Contractor",
      tax_section: "194C",
      tax_rate: 2
    },
    {
      party_name: "Krishna Legal & Audit Associates",
      party_gst: "37AAACK1122D1Z0",
      party_pan: "AAACK1122D",
      invoice_no: "AUD-2026-44",
      taxable_amount: 120000,
      total_amount: 141600,
      tax_amount: 12000,
      tax_name: "TDS on Professional Fees",
      tax_section: "194J",
      tax_rate: 10
    },
    {
      party_name: "Balaji Commercial Complex Rent",
      party_gst: "37AAACB7788P1Z8",
      party_pan: "AAACB7788P",
      invoice_no: "RNT-2026-09",
      taxable_amount: 95000,
      total_amount: 112100,
      tax_amount: 9500,
      tax_name: "TDS on Rent (Land/Building)",
      tax_section: "194I",
      tax_rate: 10
    }
  ];
}

function generateSampleTdsReceivable() {
  return [
    {
      party_name: "L&T Heavy Engineering Corp",
      party_gst: "27AAACL1234N1Z2",
      party_pan: "AAACL1234N",
      invoice_no: "INV-2026-002",
      taxable_amount: 350000,
      total_amount: 413000,
      tax_amount: 7000,
      tax_name: "TDS Deducted by Client",
      tax_section: "194C",
      tax_rate: 2
    },
    {
      party_name: "Tata Projects Infrastructure",
      party_gst: "36AAACT4321P1Z9",
      party_pan: "AAACT4321P",
      invoice_no: "INV-2026-005",
      taxable_amount: 520000,
      total_amount: 613600,
      tax_amount: 10400,
      tax_name: "TDS Deducted on Technical Work",
      tax_section: "194J",
      tax_rate: 2
    }
  ];
}

function generateSampleTcsPayable() {
  return [
    {
      party_name: "Premier Steel Wholesalers",
      party_gst: "37AAACP9988D1Z3",
      party_pan: "AAACP9988D",
      invoice_no: "INV-2026-088",
      taxable_amount: 5500000,
      total_amount: 6490000,
      tax_amount: 5500,
      tax_name: "TCS on Sale of Goods (>50L)",
      tax_section: "206C(1H)",
      tax_rate: 0.1
    },
    {
      party_name: "Deccan Scrap Processors",
      party_gst: "36AAACD4455K1Z1",
      party_pan: "AAACD4455K",
      invoice_no: "INV-2026-094",
      taxable_amount: 820000,
      total_amount: 967600,
      tax_amount: 8200,
      tax_name: "TCS on Sale of Scrap",
      tax_section: "206C(1)",
      tax_rate: 1
    }
  ];
}

function generateSampleTcsReceivable() {
  return [
    {
      party_name: "Steel Authority of India Ltd (SAIL)",
      party_gst: "20AAACS0001N1Z5",
      party_pan: "AAACS0001N",
      invoice_no: "SAIL-INV-9921",
      taxable_amount: 6200000,
      total_amount: 7316000,
      tax_amount: 6200,
      tax_name: "TCS Collected by Supplier",
      tax_section: "206C(1H)",
      tax_rate: 0.1
    }
  ];
}
