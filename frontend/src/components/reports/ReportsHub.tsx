import React, { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { inventoryApi } from "@/lib/api-client";
import { formatDisplayDate, formatDisplayDateTime, getTodayDateString } from "@/lib/utils";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import {
  TrendingUp,
  ShoppingCart,
  Boxes,
  CreditCard,
  FileCheck,
  Building2,
  Users,
  UserCheck,
  Sparkles,
  Download,
  Printer,
  Search,
  Filter,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  ChevronDown,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Activity,
  Layers,
  ShoppingBag,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  X,
  Plus,
  ArrowLeft,
  ArrowRightLeft,
  Mail,
  Landmark,
  Wallet,
  Banknote
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { getActiveBillingGst } from "@/lib/receipt-template-store";
import { Button } from "@/components/ui/button";

// ── Types & Metadata ──────────────────────────────────────────────────────────
export interface ReportItem {
  id: string;
  title: string;
  hindi?: string;
  entity: string;
  description: string;
  icon: any;
  defaultGroup?: string;
}

export interface ReportCategory {
  id: string;
  title: string;
  icon: any;
  badge: string;
  reports: ReportItem[];
}

export const REPORT_CATEGORIES: ReportCategory[] = [
  {
    id: "sales",
    title: "Sales Reports",
    icon: TrendingUp,
    badge: "8 Reports",
    reports: [
      { id: "sales_summary", title: "Sales Summary Report", hindi: "बिक्री सारांश", entity: "sales_summary", description: "Comprehensive turnover, total invoices count, profit estimates & AOV.", icon: TrendingUp },
      { id: "sales_invoice", title: "Sales Invoice Report", hindi: "बिक्री बिल रिपोर्ट", entity: "sales_invoice", description: "Granular register of all tax invoices, estimates & payment modes.", icon: FileText },
      { id: "sales_return", title: "Sales Return & Credit Notes", hindi: "बिक्री वापसी रिपोर्ट", entity: "sales_return", description: "Returned items, refunds, credit notes issued and return reasons.", icon: ArrowDownRight },
      { id: "sales_itemwise", title: "Item-wise Sales Report", hindi: "आइटम अनुसार बिक्री", entity: "sales_itemwise", description: "Product SKU velocity, units sold, revenue contribution and margins.", icon: Boxes },
      { id: "sales_customerwise", title: "Customer-wise Sales Report", hindi: "ग्राहक अनुसार बिक्री", entity: "sales_customerwise", description: "Client purchase history, order frequency and outstanding status.", icon: Users },
      { id: "sales_salesperson", title: "Salesperson-wise Sales Report", hindi: "विक्रेता अनुसार बिक्री", entity: "sales_salesperson", description: "Staff-level billing performance, targets achieved and commissions.", icon: UserCheck },
      { id: "sales_periodic", title: "Daily / Weekly / Monthly Sales", hindi: "दैनिक / मासिक बिक्री", entity: "sales_periodic", description: "Periodic sales aggregation for seasonal trends and revenue forecasting.", icon: CalendarIcon },
      { id: "sales_gst", title: "GST Sales Report", hindi: "जीएसटी बिक्री रिपोर्ट", entity: "sales_gst", description: "B2B and B2C outward supply tax breakdown with taxable rates.", icon: FileCheck },
    ],
  },
  {
    id: "purchases",
    title: "Purchase Reports",
    icon: ShoppingBag,
    badge: "6 Reports",
    reports: [
      { id: "purchase_summary", title: "Purchase Summary", hindi: "खरीद सारांश", entity: "purchase_summary", description: "Total procurement volume, purchase orders & landed cost values.", icon: ShoppingBag },
      { id: "purchase_invoice", title: "Purchase Invoice Report", hindi: "खरीद बिल रिपोर्ट", entity: "purchase_invoice", description: "Vendor bills register with tax details, payment terms and due dates.", icon: FileText },
      { id: "purchase_return", title: "Purchase Return & Debit Notes", hindi: "खरीद वापसी रिपोर्ट", entity: "purchase_return", description: "Goods returned to vendors and debit note adjustments.", icon: ArrowUpRight },
      { id: "purchase_supplierwise", title: "Supplier-wise Purchase Report", hindi: "सप्लायर अनुसार खरीद", entity: "purchase_supplierwise", description: "Procurement breakdown across vendor partners and volume ranks.", icon: Building2 },
      { id: "purchase_itemwise", title: "Item-wise Purchase Report", hindi: "आइटम अनुसार खरीद", entity: "purchase_itemwise", description: "Purchase unit costs, price variation history and suppliers.", icon: Boxes },
      { id: "purchase_gst", title: "GST Purchase (ITC) Report", hindi: "जीएसटी खरीद (आईटीसी)", entity: "purchase_gst", description: "Input Tax Credit (ITC) eligibility and vendor tax compliance.", icon: FileCheck },
    ],
  },
  {
    id: "inventory",
    title: "Stock / Inventory Reports",
    icon: Boxes,
    badge: "8 Reports",
    reports: [
      { id: "stock_summary", title: "Stock Summary Report", hindi: "स्टॉक सारांश", entity: "stock_summary", description: "Live catalog quantities, valuation at selling price and cost rate.", icon: Boxes },
      { id: "stock_current", title: "Current Stock Report", hindi: "वर्तमान स्टॉक स्थिति", entity: "stock_current", description: "Warehouse and store real-time physical stock counts.", icon: Layers },
      { id: "stock_in_out", title: "Stock In / Stock Out Movement", hindi: "स्टॉक इन / आउट मूवमेंट", entity: "stock_in_out", description: "Inward GRNs, POS sales outwards and warehouse transfers.", icon: ArrowRightLeft },
      { id: "stock_low", title: "Low Stock / Reorder Report", hindi: "कम स्टॉक रिपोर्ट", entity: "stock_low", description: "Items below safe reorder levels needing immediate replenishment.", icon: AlertTriangle },
      { id: "stock_out_of_stock", title: "Out-of-Stock Report", hindi: "स्टॉक खत्म रिपोर्ट", entity: "stock_out_of_stock", description: "Zero quantity SKU inventory to prevent lost sales opportunities.", icon: X },
      { id: "stock_itemwise", title: "Item-wise Stock Report", hindi: "आइटम स्टॉक इतिहास", entity: "stock_itemwise", description: "Complete movement register for each product SKU.", icon: FileSpreadsheet },
      { id: "stock_valuation", title: "Stock Valuation Report", hindi: "स्टॉक मूल्यांकन", entity: "stock_valuation", description: "Inventory asset value computed via FIFO and Landing costs.", icon: Banknote },
      { id: "stock_batch_expiry", title: "Batch & Expiry Aging Report", hindi: "बैच और एक्सपायरी रिपोर्ट", entity: "stock_batch_expiry", description: "Lot/Batch numbers, manufacturing & upcoming expiry date monitoring.", icon: Clock },
    ],
  },
  {
    id: "payments",
    title: "Payment & Outstanding",
    icon: CreditCard,
    badge: "8 Reports",
    reports: [
      { id: "customer_outstanding", title: "Customer Outstanding Report", hindi: "ग्राहक बकाया रिपोर्ट", entity: "customer_outstanding", description: "Receivables aging (0-30, 31-60, 61-90, 90+ days) and credit balances.", icon: Users },
      { id: "supplier_outstanding", title: "Supplier Outstanding Report", hindi: "सप्लायर बकाया रिपोर्ट", entity: "supplier_outstanding", description: "Accounts payable aging and upcoming vendor due dates.", icon: Building2 },
      { id: "receivables", title: "Accounts Receivable Register", hindi: "प्राप्य राशि रजिस्टर", entity: "receivables", description: "Complete list of unpaid sales bills with party contact details.", icon: Clock },
      { id: "payables", title: "Accounts Payable Register", hindi: "देय राशि रजिस्टर", entity: "payables", description: "Pending vendor liabilities and purchase invoice settlements.", icon: CreditCard },
      { id: "payment_collection", title: "Payment Collection Report", hindi: "भुगतान संग्रह रिपोर्ट", entity: "payment_collection", description: "Collections split across Cash, UPI, Cards, NetBanking and Wallets.", icon: CheckCircle2 },
      { id: "pending_invoices", title: "Pending Invoice Report", hindi: "लंबित बिल रिपोर्ट", entity: "pending_invoices", description: "Unpaid & partially paid invoices awaiting payment reconciliation.", icon: FileText },
      { id: "due_date_aging", title: "Due Date & Overdue Aging", hindi: "नियत तारीख एजिंग रिपोर्ट", entity: "due_date_aging", description: "Actionable priority list of defaulted and overdue bills.", icon: AlertTriangle },
      { id: "cash_bank_transactions", title: "Cash & Bank Transaction Register", hindi: "रोकड़ और बैंक बही", entity: "cash_bank_transactions", description: "Consolidated cash drawer logs and bank account inflows/outflows.", icon: Landmark },
    ],
  },
  {
    id: "gst",
    title: "GST & Tax Reports",
    icon: FileCheck,
    badge: "6 Reports",
    reports: [
      { id: "gstr_1", title: "GSTR-1 Outward Tax Report", hindi: "जीएसटीआर-1 रिपोर्ट", entity: "gstr_1", description: "B2B, B2CL, B2CS, and Credit/Debit note outward return filing data.", icon: FileCheck },
      { id: "gstr_3b", title: "GSTR-3B Monthly Return", hindi: "जीएसटीआर-3B सारांश", entity: "gstr_3b", description: "Consolidated monthly outward tax liability vs eligible input tax credit.", icon: FileSpreadsheet },
      { id: "hsn_summary", title: "HSN / SAC Summary Report", hindi: "एचएसएन सारांश रिपोर्ट", entity: "hsn_summary", description: "HSN code wise taxable values, quantity, and GST tax rates.", icon: Layers },
      { id: "gst_tax_summary", title: "GST Tax Rate Summary", hindi: "जीएसटी कर सारांश", entity: "gst_tax_summary", description: "Tax collected grouped by 0%, 5%, 12%, 18% & 28% slabs.", icon: Percent },
      { id: "cgst_sgst_igst", title: "CGST / SGST / IGST Breakdown", hindi: "केंद्रीय / राज्य कर विवरण", entity: "cgst_sgst_igst", description: "Interstate vs Intrastate tax distribution register.", icon: Building2 },
      { id: "taxable_nontaxable", title: "Taxable & Non-Taxable Sales", hindi: "कर योग्य व गैर-कर बिक्री", entity: "taxable_nontaxable", description: "Comparison between GST taxable supplies and exempt goods.", icon: Activity },
    ],
  },
  {
    id: "business",
    title: "Business & Financials",
    icon: Building2,
    badge: "7 Reports",
    reports: [
      { id: "profit_loss", title: "Profit & Loss (P&L) Statement", hindi: "लाभ और हानि खाता", entity: "profit_loss", description: "Revenue, COGS, operating overheads, and net business bottom-line.", icon: TrendingUp },
      { id: "gross_profit", title: "Gross Profit Report", hindi: "सकल लाभ रिपोर्ट", entity: "gross_profit", description: "Sales turnover minus landed cost of goods sold.", icon: Percent },
      { id: "expense_report", title: "Business Expense Report", hindi: "व्यापारिक खर्च रिपोर्ट", entity: "expense_report", description: "Categorized expenses (Rent, Electricity, Salaries, Marketing).", icon: CreditCard },
      { id: "income_expense_summary", title: "Income & Expense Comparison", hindi: "आय और व्यय सारांश", entity: "income_expense_summary", description: "Monthly operating cash balance and profitability trends.", icon: Activity },
      { id: "day_book", title: "Daily Day Book (डेबुक)", hindi: "दैनिक रोकड़ बही", entity: "day_book", description: "Chronological log of all daily receipts, sales and outgoings.", icon: CalendarIcon },
      { id: "cash_flow", title: "Cash Flow Statement", hindi: "कैश फ्लो स्टेटमेंट", entity: "cash_flow", description: "Operational cash flow, investing activities and net liquidity.", icon: Wallet },
      { id: "business_dashboard", title: "Executive Business Dashboard", hindi: "व्यापार प्रदर्शन बोर्ड", entity: "business_dashboard", description: "High-level overview of revenue, margins, collections and health.", icon: Sparkles },
    ],
  },
  {
    id: "parties",
    title: "Customer & Supplier Ledgers",
    icon: Users,
    badge: "6 Reports",
    reports: [
      { id: "customer_ledger", title: "Customer Account Ledger", hindi: "ग्राहक खाता बही", entity: "customer_ledger", description: "Debit/Credit entries and running balances for specific clients.", icon: Users },
      { id: "supplier_ledger", title: "Supplier Account Ledger", hindi: "सप्लायर खाता बही", entity: "supplier_ledger", description: "Purchase entries, payments made and vendor running balances.", icon: Building2 },
      { id: "customer_statement", title: "Customer Account Statement", hindi: "ग्राहक खाता विवरण", entity: "customer_statement", description: "Printable official statement for payment settlement reminders.", icon: FileText },
      { id: "supplier_statement", title: "Supplier Account Statement", hindi: "सप्लायर खाता विवरण", entity: "supplier_statement", description: "Vendor account reconciliation and confirmation of balance.", icon: FileSpreadsheet },
      { id: "customer_purchase_history", title: "Customer Purchase History", hindi: "ग्राहक खरीद इतिहास", entity: "customer_purchase_history", description: "Itemized transaction logs for loyalty analysis.", icon: Boxes },
      { id: "customer_sales_history", title: "Party Order History", hindi: "पार्टी ऑर्डर इतिहास", entity: "customer_sales_history", description: "Fulfilled vs pending sales orders by customer.", icon: Clock },
    ],
  },
  {
    id: "staff",
    title: "Staff & User Reports",
    icon: UserCheck,
    badge: "5 Reports",
    reports: [
      { id: "user_sales", title: "User / Cashier-wise Sales", hindi: "स्टाफ अनुसार बिक्री", entity: "user_sales", description: "Invoices created and cash collected by each POS cashier.", icon: Users },
      { id: "salesperson_performance", title: "Salesperson Performance", hindi: "विक्रेता प्रदर्शन रिपोर्ट", entity: "salesperson_performance", description: "Sales quota achievement, target vs actuals and conversion.", icon: TrendingUp },
      { id: "user_activity", title: "Staff Login & Activity Audit", hindi: "स्टाफ गतिविधि ऑडिट", entity: "user_activity", description: "Security audit logs, system access times and actions taken.", icon: ShieldCheck },
      { id: "discount_audit", title: "Discount Audit Report", hindi: "छूट ऑडिट रिपोर्ट", entity: "discount_audit", description: "Manual bill discounts, coupon redemptions & staff overrides.", icon: Percent },
      { id: "cancelled_invoices", title: "Cancelled / Void Invoices", hindi: "रद्द किए गए बिल", entity: "cancelled_invoices", description: "Audit trail of deleted, modified or cancelled sale transactions.", icon: AlertTriangle },
    ],
  },
  {
    id: "builder",
    title: "Custom Report Builder",
    icon: SlidersHorizontal,
    badge: "Drag & Select",
    reports: [
      { id: "custom_builder", title: "Interactive Query Builder", hindi: "कस्टम रिपोर्ट बिल्डर", entity: "custom_builder", description: "Build bespoke business reports by choosing custom dimensions, filters & aggregations.", icon: SlidersHorizontal }
    ]
  }
];

export function ReportsHub() {
  const { currency, formatCurrency } = useCurrency();
  const { tenant, activeBranch } = useTenant();
  const activeGst = getActiveBillingGst();

  // Company & Tenant Branding Details
  const companyName = (tenant?.name || (tenant?.raw as any)?.business_name || (tenant?.raw as any)?.name || "Sai Enterprises").trim();
  const branchName = activeBranch?.name || "Main Branch";
  const companyGstin = (tenant?.raw as any)?.gstin || (tenant?.raw as any)?.tax_number || activeGst?.gstin || "";
  const companyAddress = (tenant?.raw as any)?.address || (tenant?.raw as any)?.billing_address || activeGst?.address || "";
  const companyPhone = (tenant?.raw as any)?.phone || activeGst?.phone || "";
  const companyEmail = (tenant?.raw as any)?.email || activeGst?.email || "";

  // Navigation State
  const [selectedCategory, setSelectedCategory] = useState<string>("sales");
  const [activeReport, setActiveReport] = useState<ReportItem>(REPORT_CATEGORIES[0].reports[0]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sidebarSearch, setSidebarSearch] = useState<string>("");

  // Filter States
  const [dateRange, setDateRange] = useState<string>("all");
  const [customStartDate, setCustomStartDate] = useState<string>(getTodayDateString());
  const [customEndDate, setCustomEndDate] = useState<string>(getTodayDateString());

  // Data States
  const [loading, setLoading] = useState<boolean>(false);
  const [reportData, setReportData] = useState<any>(null);

  // Builder Specific State
  const [builderEntity, setBuilderEntity] = useState<string>("sales");
  const [builderColumns, setBuilderColumns] = useState<string[]>(["date", "invoice_no", "customer", "total_amount"]);
  const [builderGroupBy, setBuilderGroupBy] = useState<string>("none");

  // Load report data from backend
  const loadReport = async (reportItem: ReportItem = activeReport) => {
    setLoading(true);
    try {
      const payload: any = {
        entity: reportItem.entity,
        reportId: reportItem.id,
        dateRange,
        startDate: dateRange === "custom" ? customStartDate : undefined,
        endDate: dateRange === "custom" ? customEndDate : undefined,
        selectedColumns: reportItem.id === "custom_builder" ? builderColumns : undefined,
        groupBy: reportItem.id === "custom_builder" ? builderGroupBy : undefined,
        filters: {
          search: searchQuery || undefined,
        },
      };

      const res = await inventoryApi.generateCustomReport(payload);
      setReportData(res);
    } catch (err: any) {
      console.error("Report generation failed:", err);
      toast.error(err.message || "Failed to generate report from live database");
    } finally {
      setLoading(false);
    }
  };

  // Fetch when report selection or filters change
  useEffect(() => {
    loadReport(activeReport);
  }, [activeReport, dateRange, customStartDate, customEndDate, builderEntity, builderGroupBy]);

  // Handle category / report selection
  const handleSelectReport = (catId: string, item: ReportItem) => {
    setSelectedCategory(catId);
    setActiveReport(item);
  };

  // ── CSV Export with Company Header & UTF-8 BOM (Fixes Excel â,¹ bug) ────────
  const handleExportCSV = () => {
    if (!reportData?.tableData || reportData.tableData.length === 0) {
      toast.error("No data available to export.");
      return;
    }

    const cols = reportData.tableColumns || [];
    
    // 1. Company & Report metadata block at top of CSV
    const metaHeader = [
      `"COMPANY NAME:","${companyName.replace(/"/g, '""')}"`,
      `"REPORT TITLE:","${activeReport.title.replace(/"/g, '""')}"`,
      `"PERIOD:","${(reportData.dateRangeLabel || "All Time").replace(/"/g, '""')}"`,
      `"GENERATED ON:","${formatDisplayDateTime(new Date()).replace(/"/g, '""')}"`,
      companyGstin ? `"GSTIN:","${companyGstin.replace(/"/g, '""')}"` : `""`,
      companyAddress ? `"ADDRESS:","${companyAddress.replace(/"/g, '""')}"` : `""`,
      `""`, // blank line separator
    ].filter(Boolean).join("\n");

    // 2. Column Headers
    const headers = cols.map((c: any) => `"${c.header.replace(/"/g, '""')}"`).join(",");

    // 3. Rows (Format numbers cleanly so Excel calculates math formulas without currency string bugs)
    const rows = reportData.tableData.map((row: any) =>
      cols.map((c: any) => {
        let val = row[c.key] ?? "";
        const strVal = String(val).trim();
        if (strVal.startsWith("₹") || strVal.startsWith("Rs.")) {
          val = strVal.replace(/^[₹Rs\.\s]+/, "").replace(/,/g, "");
        }
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(",")
    );

    // 4. Summary Totals Footer
    let summaryBlock = "";
    if (reportData.summaryTotals && Object.keys(reportData.summaryTotals).length > 0) {
      summaryBlock = "\n\n" + Object.entries(reportData.summaryTotals)
        .map(([k, v]: [string, any]) => `"${k.replace(/_/g, " ").toUpperCase()}:","${String(v).replace(/^[₹Rs\.\s]+/, "").replace(/"/g, '""')}"`)
        .join("\n");
    }

    const fullCsv = metaHeader + "\n" + headers + "\n" + rows.join("\n") + summaryBlock;

    // Use UTF-8 BOM (\uFEFF) so Excel on Windows natively recognizes UTF-8 without â,¹ character artifacts
    const blob = new Blob(["\uFEFF" + fullCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${companyName.replace(/\s+/g, "_")}_${activeReport.id}_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${activeReport.title} for ${companyName} to CSV`);
  };

  // ── PDF Print with Official Corporate Header ────────────────────────────────
  const handlePrintPDF = () => {
    if (!reportData?.tableData || reportData.tableData.length === 0) {
      toast.error("No data available to print.");
      return;
    }

    const printWin = window.open("", "_blank");
    if (!printWin) {
      toast.error("Please allow popups to print report.");
      return;
    }

    const cols = reportData.tableColumns || [];
    const tableHeaderHtml = cols.map((c: any) => `<th>${c.header}</th>`).join("");
    const tableRowsHtml = reportData.tableData
      .map((row: any) => `<tr>${cols.map((c: any) => {
        const val = row[c.key] ?? "—";
        const isNumeric = String(val).includes("₹") || String(val).includes("%");
        return `<td style="${isNumeric ? 'text-align: right;' : ''}">${val}</td>`;
      }).join("")}</tr>`)
      .join("");

    const summaryTotalsHtml = reportData.summaryTotals && Object.keys(reportData.summaryTotals).length > 0
      ? `
        <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 12px 18px; margin-top: 20px; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 24px; font-size: 11px;">
          ${Object.entries(reportData.summaryTotals).map(([k, v]: [string, any]) => `
            <div>
              <span style="color: #475569; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">${k.replace(/_/g, " ")}: </span>
              <strong style="color: #1e1b4b; font-size: 13px;">${v}</strong>
            </div>
          `).join("")}
        </div>
      `
      : "";

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${activeReport.title} - ${companyName}</title>
        <meta charset="utf-8" />
        <style>
          @page { size: A4 portrait; margin: 12mm 12mm 15mm 12mm; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; 
            padding: 8px; 
            color: #0f172a; 
            background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .header-box {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2.5px solid #4f46e5;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .company-title {
            font-size: 20px;
            font-weight: 800;
            color: #1e1b4b;
            letter-spacing: -0.5px;
            margin: 0;
            line-height: 1.2;
          }
          .company-meta {
            font-size: 10.5px;
            color: #475569;
            margin-top: 4px;
            line-height: 1.4;
          }
          .report-badge {
            display: inline-block;
            background: #eef2ff;
            color: #4f46e5;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            padding: 2px 8px;
            border-radius: 4px;
            margin-bottom: 3px;
          }
          .report-heading {
            font-size: 16px;
            font-weight: 800;
            color: #0f172a;
            margin: 2px 0;
          }
          .report-details {
            font-size: 10px;
            color: #64748b;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            font-size: 10px; 
            margin-top: 10px; 
          }
          th { 
            background: #f1f5f9; 
            text-align: left; 
            padding: 7px 9px; 
            font-weight: 700; 
            color: #334155; 
            border-top: 1px solid #cbd5e1;
            border-bottom: 1.5px solid #94a3b8; 
            text-transform: uppercase;
            font-size: 9px;
            letter-spacing: 0.3px;
          }
          td { 
            padding: 6.5px 9px; 
            border-bottom: 1px solid #e2e8f0; 
            color: #1e293b;
          }
          tr:nth-child(even) { background-color: #f8fafc; }
          .footer { 
            margin-top: 25px; 
            font-size: 9.5px; 
            color: #94a3b8; 
            display: flex;
            justify-content: space-between;
            border-top: 1px solid #e2e8f0; 
            padding-top: 8px; 
          }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div>
            <h1 class="company-title">${companyName}</h1>
            <div class="company-meta">
              ${companyAddress ? `<div>${companyAddress}</div>` : ""}
              <div>
                ${branchName ? `<span>Branch: <strong>${branchName}</strong></span> &bull; ` : ""}
                ${companyGstin ? `<span style="font-weight: 700; color: #0f172a;">GSTIN: ${companyGstin}</span>` : ""}
                ${companyPhone ? ` &bull; <span>Tel: ${companyPhone}</span>` : ""}
                ${companyEmail ? ` &bull; <span>Email: ${companyEmail}</span>` : ""}
              </div>
            </div>
          </div>
          <div style="text-align: right;">
            <div class="report-badge">Official Financial & Operations Audit</div>
            <div class="report-heading">${activeReport.title}</div>
            <div class="report-details">Period: <strong>${reportData.dateRangeLabel || "All Time"}</strong></div>
            <div class="report-details">Generated: ${formatDisplayDateTime(new Date())}</div>
          </div>
        </div>

        <table>
          <thead><tr>${tableHeaderHtml}</tr></thead>
          <tbody>${tableRowsHtml}</tbody>
        </table>

        ${summaryTotalsHtml}

        <div class="footer">
          <span>Report Generated by BusinessOS for ${companyName}</span>
          <span>Confidential Business Intelligence</span>
        </div>
      </body>
      </html>
    `);

    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 500);
  };

  // Filtered categories for sidebar search
  const filteredCategories = useMemo(() => {
    if (!sidebarSearch.trim()) return REPORT_CATEGORIES;
    const q = sidebarSearch.toLowerCase();
    return REPORT_CATEGORIES.map((cat) => ({
      ...cat,
      reports: cat.reports.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.hindi && r.hindi.toLowerCase().includes(q)) ||
          r.description.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.reports.length > 0);
  }, [sidebarSearch]);

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full bg-slate-50 overflow-hidden font-sans">
      {/* ──────────────────────────────────────────────────────────────────────────
          LEFT NAVIGATION SIDEBAR (Categorized Hub)
      ────────────────────────────────────────────────────────────────────────── */}
      <aside className="w-80 shrink-0 border-r border-slate-200 bg-white flex flex-col h-full shadow-sm z-10">
        {/* Sidebar Header */}
        <div className="p-3.5 border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
                <Sparkles className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 leading-tight">Reports Hub</h2>
                <p className="text-[10px] font-semibold text-slate-500">Live Business Intelligence</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Live DB
            </span>
          </div>

          {/* Sidebar Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search all 38+ reports..."
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs bg-slate-100/70 border border-slate-200/80 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            />
          </div>
        </div>

        {/* Scrollable Category Accordion */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-3 custom-scrollbar">
          {filteredCategories.map((cat) => {
            const isCatSelected = selectedCategory === cat.id;
            const Icon = cat.icon;

            return (
              <div key={cat.id} className="space-y-1">
                {/* Category Header Button */}
                <button
                  type="button"
                  onClick={() => setSelectedCategory(isCatSelected ? "" : cat.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    isCatSelected
                      ? "bg-indigo-50/80 text-indigo-900 font-extrabold"
                      : "text-slate-700 hover:bg-slate-100/70"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`size-4 ${isCatSelected ? "text-indigo-600" : "text-slate-500"}`} />
                    <span>{cat.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-slate-200/60 text-slate-600">
                      {cat.reports.length}
                    </span>
                    <ChevronDown
                      className={`size-3.5 text-slate-400 transition-transform duration-200 ${
                        isCatSelected ? "rotate-180 text-indigo-600" : ""
                      }`}
                    />
                  </div>
                </button>

                {/* Sub Reports List */}
                <AnimatePresence>
                  {(isCatSelected || sidebarSearch.length > 0) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="pl-3.5 space-y-0.5 overflow-hidden"
                    >
                      {cat.reports.map((item) => {
                        const isReportActive = activeReport.id === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelectReport(cat.id, item)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-medium transition-all flex flex-col gap-0.5 ${
                              isReportActive
                                ? "bg-indigo-600 text-white font-bold shadow-md shadow-indigo-200"
                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="truncate">{item.title}</span>
                              {isReportActive && <ChevronRight className="size-3 shrink-0" />}
                            </div>
                            {item.hindi && (
                              <span
                                className={`text-[9px] leading-tight truncate ${
                                  isReportActive ? "text-indigo-100" : "text-slate-400"
                                }`}
                              >
                                {item.hindi}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </aside>

      {/* ──────────────────────────────────────────────────────────────────────────
          MAIN REPORT CONTENT PANEL
      ────────────────────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
        {/* Top Action & Filtering Toolbar */}
        <header className="bg-white border-b border-slate-200 px-5 py-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Title & Description */}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-slate-900">{activeReport.title}</h1>
                {activeReport.hindi && (
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    {activeReport.hindi}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{activeReport.description}</p>
            </div>

            {/* Actions: CSV, Print, Refresh */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="h-8 gap-1.5 text-xs font-semibold rounded-xl border-slate-200 hover:bg-slate-100"
              >
                <Download className="size-3.5 text-emerald-600" />
                <span>Excel / CSV</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintPDF}
                className="h-8 gap-1.5 text-xs font-semibold rounded-xl border-slate-200 hover:bg-slate-100"
              >
                <Printer className="size-3.5 text-indigo-600" />
                <span>Print PDF</span>
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={() => loadReport(activeReport)}
                disabled={loading}
                className="h-8 w-8 rounded-xl border-slate-200 hover:bg-slate-100"
                title="Refresh Live Data"
              >
                <RefreshCw className={`size-3.5 text-slate-600 ${loading ? "animate-spin text-indigo-600" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Date Range & Search Filtering Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-2.5 border-t border-slate-100">
            {/* Date Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                <CalendarIcon className="size-3.5 text-indigo-500" /> Period:
              </span>

              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="h-8 px-2.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
              >
                <option value="all">All Time (All Recorded Invoices)</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="this_week">This Week</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="this_quarter">This Quarter</option>
                <option value="this_year">This Financial Year</option>
                <option value="custom">📅 Custom Date Range (DD/MM/YYYY)</option>
              </select>

              {/* Custom Date Pickers strictly in DD/MM/YYYY */}
              {dateRange === "custom" && (
                <div className="flex items-center gap-1.5">
                  <div className="w-32">
                    <DatePickerInput
                      value={customStartDate}
                      onChange={(val) => setCustomStartDate(val)}
                      placeholder="DD/MM/YYYY"
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-400">to</span>
                  <div className="w-32">
                    <DatePickerInput
                      value={customEndDate}
                      onChange={(val) => setCustomEndDate(val)}
                      placeholder="DD/MM/YYYY"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Search Input for filtering current table */}
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filter current report rows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        </header>

        {/* Scrollable Report Canvas */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {/* ──────────────────────────────────────────────────────────────────────────
              CUSTOM REPORT BUILDER INTERACTIVE MODE
          ────────────────────────────────────────────────────────────────────────── */}
          {activeReport.id === "custom_builder" && (
            <div className="bg-white border border-indigo-100 rounded-2xl p-4 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="size-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900">Custom Query Configuration</h3>
                </div>
                <span className="text-xs text-indigo-600 font-semibold bg-indigo-50 px-2.5 py-0.5 rounded-full">
                  Interactive Drag & Select
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Select Base Entity */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Select Data Entity</label>
                  <select
                    value={builderEntity}
                    onChange={(e) => setBuilderEntity(e.target.value)}
                    className="w-full h-9 px-3 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="sales">Sales & Billing Transactions</option>
                    <option value="inventory">Products & Stock Catalog</option>
                    <option value="purchases">Purchase Orders & GRN</option>
                    <option value="customers">Customers & Outstanding</option>
                    <option value="staff">Staff & Cashier Activity</option>
                  </select>
                </div>

                {/* Group By Option */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Group Records By</label>
                  <select
                    value={builderGroupBy}
                    onChange={(e) => setBuilderGroupBy(e.target.value)}
                    className="w-full h-9 px-3 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="none">No Grouping (Individual Rows)</option>
                    <option value="day">By Date / Day</option>
                    <option value="month">By Calendar Month</option>
                    <option value="customer">By Customer Account</option>
                    <option value="category">By Product Category</option>
                  </select>
                </div>

                {/* Build Action */}
                <div className="flex items-end">
                  <Button
                    type="button"
                    onClick={() => loadReport(activeReport)}
                    className="w-full h-9 gradient-brand text-white font-bold text-xs rounded-xl shadow-md"
                  >
                    Generate Custom Query
                  </Button>
                </div>
              </div>
            </div>
          )}



          {/* ──────────────────────────────────────────────────────────────────────────
              REPORT DATA TABLE
          ────────────────────────────────────────────────────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200">
                    {reportData?.tableColumns?.map((col: any, idx: number) => (
                      <th
                        key={idx}
                        className="px-4 py-3 text-[11px] font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap"
                      >
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={reportData?.tableColumns?.length || 6}
                        className="px-4 py-12 text-center text-slate-400"
                      >
                        <RefreshCw className="size-6 animate-spin mx-auto text-indigo-600 mb-2" />
                        <span>Querying live database records...</span>
                      </td>
                    </tr>
                  ) : !reportData?.tableData || reportData.tableData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={reportData?.tableColumns?.length || 6}
                        className="px-4 py-12 text-center text-slate-400"
                      >
                        <Boxes className="size-8 mx-auto text-slate-300 mb-2" />
                        <span className="font-semibold">No records found for the selected period.</span>
                      </td>
                    </tr>
                  ) : (
                    reportData.tableData.map((row: any, rIdx: number) => (
                      <tr
                        key={rIdx}
                        className="hover:bg-indigo-50/30 transition-colors group cursor-default"
                      >
                        {reportData.tableColumns.map((col: any, cIdx: number) => {
                          const val = row[col.key];
                          const isStatus = col.key === "status";
                          return (
                            <td key={cIdx} className="px-4 py-2.5 whitespace-nowrap">
                              {isStatus ? (
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    String(val).toLowerCase().includes("paid") ||
                                    String(val).toLowerCase().includes("optimal") ||
                                    String(val).toLowerCase().includes("completed") ||
                                    String(val).toLowerCase().includes("active")
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : String(val).toLowerCase().includes("low") ||
                                        String(val).toLowerCase().includes("overdue")
                                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                                      : "bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  {val}
                                </span>
                              ) : (
                                <span>{val ?? "—"}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Summary Footer */}
            {reportData?.summaryTotals && Object.keys(reportData.summaryTotals).length > 0 && (
              <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-800">
                <span className="text-slate-500 uppercase tracking-wider text-[11px]">
                  Total Records: {reportData.tableData?.length || 0}
                </span>
                <div className="flex items-center gap-4">
                  {Object.entries(reportData.summaryTotals).map(([k, v]: [string, any], idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span className="text-slate-500 font-semibold capitalize">
                        {k.replace(/_/g, " ")}:
                      </span>
                      <span className="text-indigo-600 font-extrabold">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
