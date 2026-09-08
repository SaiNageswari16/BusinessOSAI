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
  Banknote,
  UserPlus,
  PhoneCall,
  Headset,
  Target
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
    badge: "9 Reports",
    reports: [
      { id: "sales_summary", title: "Sales Summary Report", entity: "sales_summary", description: "Comprehensive turnover, total invoices count, profit estimates & AOV.", icon: TrendingUp },
      { id: "sales_invoice", title: "Sales Invoice Register", entity: "sales_invoice", description: "Granular register of all tax invoices, estimates & payment modes.", icon: FileText },
      { id: "sales_return", title: "Sales Return Register", entity: "sales_return", description: "Physical goods returned by customers, restock status, SKU details & return valuation.", icon: ArrowDownRight },
      { id: "sales_credit_note", title: "Credit Note Register & Aging", entity: "sales_credit_note", description: "Financial credit notes issued, days count aging, unadjusted balances & redemption status.", icon: CreditCard },
      { id: "sales_itemwise", title: "Item-wise Product Sales", entity: "sales_itemwise", description: "Product SKU velocity, units sold, revenue contribution and margins.", icon: Boxes },
      { id: "sales_customerwise", title: "Customer-wise Sales Report", entity: "sales_customerwise", description: "Client purchase history, order frequency and outstanding status.", icon: Users },
      { id: "sales_salesperson", title: "Salesperson-wise Sales", entity: "sales_salesperson", description: "Staff-level billing performance, targets achieved and commissions.", icon: UserCheck },
      { id: "sales_periodic", title: "Daily / Monthly Sales Trends", entity: "sales_periodic", description: "Periodic sales aggregation for seasonal trends and revenue forecasting.", icon: CalendarIcon },
      { id: "sales_gst", title: "GST Outward Supply Sales", entity: "sales_gst", description: "B2B and B2C outward supply tax breakdown with taxable rates.", icon: FileCheck },
    ],
  },
  {
    id: "purchases",
    title: "Purchase Reports",
    icon: ShoppingBag,
    badge: "7 Reports",
    reports: [
      { id: "purchase_summary", title: "Purchase Summary", entity: "purchase_summary", description: "Total procurement volume, purchase orders & landed cost values.", icon: ShoppingBag },
      { id: "purchase_invoice", title: "Purchase Invoices Register", entity: "purchase_invoice", description: "Vendor bills register with tax details, payment terms and due dates.", icon: FileText },
      { id: "purchase_return", title: "Purchase Return (Vendor Returns)", entity: "purchase_return", description: "Goods returned to suppliers, dispatch notes and replacement tracking.", icon: ArrowUpRight },
      { id: "purchase_debit_note", title: "Debit Note Register & Vendor Aging", entity: "purchase_debit_note", description: "Debit notes issued to vendors, days aging count and purchase adjustments.", icon: Landmark },
      { id: "purchase_supplierwise", title: "Supplier-wise Purchases", entity: "purchase_supplierwise", description: "Procurement breakdown across vendor partners and volume ranks.", icon: Building2 },
      { id: "purchase_itemwise", title: "Item-wise Purchase History", entity: "purchase_itemwise", description: "Purchase unit costs, price variation history and suppliers.", icon: Boxes },
      { id: "purchase_gst", title: "GST Input Tax Credit (ITC)", entity: "purchase_gst", description: "Input Tax Credit (ITC) eligibility and vendor tax compliance.", icon: FileCheck },
    ],
  },
  {
    id: "inventory",
    title: "Stock / Inventory Reports",
    icon: Boxes,
    badge: "6 Reports",
    reports: [
      { id: "stock_summary", title: "Stock Summary & Valuation", entity: "stock_summary", description: "Live catalog quantities, valuation at selling price and cost rate.", icon: Boxes },
      { id: "stock_in_out", title: "Stock In / Out Movement", entity: "stock_in_out", description: "Inward GRNs, POS sales outwards and warehouse transfers.", icon: ArrowRightLeft },
      { id: "stock_low", title: "Low Stock & Reorder Alerts", entity: "stock_low", description: "Items below safe reorder levels needing immediate replenishment.", icon: AlertTriangle },
      { id: "stock_out_of_stock", title: "Out-of-Stock SKUs Report", entity: "stock_out_of_stock", description: "Zero quantity SKU inventory to prevent lost sales opportunities.", icon: X },
      { id: "stock_itemwise", title: "Item-wise Stock History", entity: "stock_itemwise", description: "Complete movement register for each product SKU.", icon: FileSpreadsheet },
      { id: "stock_batch_expiry", title: "Batch & Expiry Aging Report", entity: "stock_batch_expiry", description: "Lot/Batch numbers, manufacturing & upcoming expiry date monitoring.", icon: Clock },
    ],
  },
  {
    id: "payments",
    title: "Payment & Outstanding",
    icon: CreditCard,
    badge: "4 Reports",
    reports: [
      { id: "customer_outstanding", title: "Customer Outstanding Aging (360°)", entity: "customer_outstanding", description: "Receivables aging (0-30, 31-60, 61-90, 90+ days) and credit balances.", icon: Users },
      { id: "supplier_outstanding", title: "Supplier Outstanding & Payables", entity: "supplier_outstanding", description: "Accounts payable aging and upcoming vendor due dates.", icon: Building2 },
      { id: "payment_collection", title: "Payment Collections & Receipts", entity: "payment_collection", description: "Collections split across Cash, UPI, Cards, NetBanking and Wallets.", icon: CheckCircle2 },
      { id: "cash_bank_transactions", title: "Cash & Bank Transaction Register", entity: "cash_bank_transactions", description: "Consolidated cash drawer logs and bank account inflows/outflows.", icon: Landmark },
    ],
  },
  {
    id: "gst",
    title: "GST & Tax Reports",
    icon: FileCheck,
    badge: "4 Reports",
    reports: [
      { id: "gstr_1", title: "GSTR-1 Outward Supply Return", entity: "gstr_1", description: "B2B, B2CL, B2CS, and Credit/Debit note outward return filing data.", icon: FileCheck },
      { id: "gstr_3b", title: "GSTR-3B Monthly Return & ITC", entity: "gstr_3b", description: "Consolidated monthly outward tax liability vs eligible input tax credit.", icon: FileSpreadsheet },
      { id: "hsn_summary", title: "HSN / SAC Code Summary", entity: "hsn_summary", description: "HSN code wise taxable values, quantity, and GST tax rates.", icon: Layers },
      { id: "gst_tax_summary", title: "GST Tax Slabs Breakdown", entity: "gst_tax_summary", description: "Tax collected grouped by 0%, 5%, 12%, 18% & 28% slabs.", icon: Percent },
    ],
  },
  {
    id: "business",
    title: "Business & Financials",
    icon: Building2,
    badge: "4 Reports",
    reports: [
      { id: "profit_loss", title: "Profit & Loss (P&L) Statement", entity: "profit_loss", description: "Revenue, COGS, operating overheads, and net business bottom-line.", icon: TrendingUp },
      { id: "gross_profit", title: "Gross Profit & Margin Analysis", entity: "gross_profit", description: "Sales turnover minus landed cost of goods sold.", icon: Percent },
      { id: "expense_report", title: "Business Expense Audit Report", entity: "expense_report", description: "Categorized expenses (Rent, Electricity, Salaries, Marketing).", icon: CreditCard },
      { id: "day_book", title: "Daily Day Book & Cash Ledger", entity: "day_book", description: "Chronological log of all daily receipts, sales and outgoings.", icon: CalendarIcon },
    ],
  },
  {
    id: "parties",
    title: "Customer & Supplier Ledgers",
    icon: Users,
    badge: "2 Reports",
    reports: [
      { id: "customer_statement", title: "Customer Account Statement & 360° Ledger", entity: "customer_statement", description: "Detailed customer bill history, pending dues & itemized product drilldown.", icon: FileText },
      { id: "supplier_statement", title: "Supplier Account Statement & Ledger", entity: "supplier_statement", description: "Vendor account reconciliation, purchase bills and confirmation of balance.", icon: FileSpreadsheet },
    ],
  },
  {
    id: "staff",
    title: "Staff & User Reports",
    icon: UserCheck,
    badge: "4 Reports",
    reports: [
      { id: "user_sales", title: "User / Cashier-wise Sales", entity: "user_sales", description: "Invoices created and cash collected by each POS cashier.", icon: Users },
      { id: "salesperson_performance", title: "Salesperson Quota & Performance", entity: "salesperson_performance", description: "Sales quota achievement, target vs actuals and conversion.", icon: TrendingUp },
      { id: "user_activity", title: "Staff Login & Activity Audit", entity: "user_activity", description: "Security audit logs, system access times and actions taken.", icon: ShieldCheck },
      { id: "discount_audit", title: "Discount & Override Audit", entity: "discount_audit", description: "Manual bill discounts, coupon redemptions & staff overrides.", icon: Percent },
    ],
  },
  {
    id: "crm",
    title: "CRM & Leads Pipeline",
    icon: UserPlus,
    badge: "6 Reports",
    reports: [
      { id: "crm_leads_pipeline", title: "Lead Master & Pipeline Register", entity: "crm_leads_pipeline", description: "Comprehensive leads registry, stages, lead sources, assigned owners and estimated values.", icon: UserPlus },
      { id: "crm_lead_conversion", title: "Lead Conversion & Won/Lost Report", entity: "crm_lead_conversion", description: "Win rates, lost reasons analysis, sales cycle duration and conversion efficiency.", icon: Target },
      { id: "crm_lead_activities", title: "Lead Activities & Interaction Logs", entity: "crm_lead_activities", description: "Outbound call logs, demo meetings, call dispositions and client responses.", icon: PhoneCall },
      { id: "crm_deals_pipeline", title: "Deals & Opportunity Pipeline", entity: "crm_deals_pipeline", description: "Deal stages, win probability percentages, weighted pipeline and close dates.", icon: TrendingUp },
      { id: "crm_quotations", title: "CRM Quotations & Estimates Register", entity: "crm_quotations", description: "Formal pricing quotations issued, tax breakdowns, discount and approval status.", icon: FileText },
      { id: "crm_support_tickets", title: "CRM Support & Service Tickets", entity: "crm_support_tickets", description: "Client issue tickets, priority SLAs, categories and resolution rates.", icon: Headset },
    ],
  },
  {
    id: "hrms",
    title: "HRMS & Workforce Suite",
    icon: Users,
    badge: "7 Reports",
    reports: [
      { id: "hrms_employee_directory", title: "Employee Master & Digital vCard Directory", entity: "hrms_employee_directory", description: "Complete staff master directory, contact vCards, departments & designation codes.", icon: Users },
      { id: "hrms_attendance", title: "Biometric Attendance & Shift Logs", entity: "hrms_attendance", description: "Daily employee check-in/out timestamps, working hours, shift timings & overtime.", icon: Clock },
      { id: "hrms_leaves", title: "Staff Leave Balances & Absence Register", entity: "hrms_leaves", description: "Leave requests, casual/sick leave quotas, approved leaves and pending approvals.", icon: CalendarIcon },
      { id: "hrms_payroll", title: "Monthly Payroll Summary & Disbursals", entity: "hrms_payroll", description: "Basic salary, HRA allowances, gross earnings, PF/ESI deductions and net pay summary.", icon: Wallet },
      { id: "hrms_payslips", title: "Employee Payslips & Salary Vault", entity: "hrms_payslips", description: "Individual salary slips, generated PDF vouchers and digital disbursement signatures.", icon: Banknote },
      { id: "hrms_recruitment", title: "Recruitment Pipeline & Job Offers", entity: "hrms_recruitment", description: "Hiring pipeline candidates, offered CTC packages, joining dates and offer letters.", icon: UserPlus },
      { id: "hrms_performance", title: "Employee KPI & Performance Reviews", entity: "hrms_performance", description: "Quarterly/annual staff appraisals, KPI scorecards, appraisal hikes and ratings.", icon: Target },
    ],
  },
  {
    id: "marketplace",
    title: "Marketplace & Logistics",
    icon: ShoppingBag,
    badge: "2 Reports",
    reports: [
      { id: "marketplace_orders", title: "Multi-Channel Marketplace Orders", entity: "marketplace_orders", description: "Orders from Amazon, Flipkart, Blinkit, Swiggy & Shopify with commission splits.", icon: ShoppingBag },
      { id: "delivery_logistics", title: "Delivery & Courier Tracking", entity: "delivery_logistics", description: "AWB dispatch tracking, carrier delivery turnaround time (TAT) and proof of delivery.", icon: ArrowRightLeft },
    ],
  },
  {
    id: "ai",
    title: "AI Predictive Intelligence",
    icon: Sparkles,
    badge: "3 Reports",
    reports: [
      { id: "revenue_prediction", title: "AI Revenue & Sales Forecast", entity: "revenue_prediction", description: "Machine learning 6-month projected turnover, bounds and seasonal surge drivers.", icon: Sparkles },
      { id: "demand_forecast", title: "AI Stock Demand & Reorder Forecast", entity: "demand_forecast", description: "SKU sales velocity, out-of-stock risk scoring and intelligent purchase recommendations.", icon: Boxes },
      { id: "customer_prediction", title: "AI Retention & Churn Risk Score", entity: "customer_prediction", description: "Predictive customer churn probability, lifetime value and automated retention strategies.", icon: Users },
    ],
  },
  {
    id: "builder",
    title: "Custom Report Builder",
    icon: SlidersHorizontal,
    badge: "Drag & Select",
    reports: [
      { id: "custom_builder", title: "Interactive Query Builder", entity: "custom_builder", description: "Build bespoke business reports by choosing custom dimensions, filters & aggregations.", icon: SlidersHorizontal }
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

  // Expandable Nested Drilldown State
  const [expandedInvoices, setExpandedInvoices] = useState<Record<string, boolean>>({});
  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});

  // Custom Report Builder States
  const [builderEntity, setBuilderEntity] = useState<string>("sales");
  const [builderColumns, setBuilderColumns] = useState<string[]>([]);
  const [builderGroupBy, setBuilderGroupBy] = useState<string>("none");

  const toggleInvoice = (key: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedInvoices((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleCustomer = (key: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedCustomers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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

  // Debounce search query so customer name search dynamically updates the live report
  useEffect(() => {
    const timer = setTimeout(() => {
      loadReport(activeReport);
    }, 320);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle category / report selection
  const handleSelectReport = (catId: string, item: ReportItem) => {
    setSelectedCategory(catId);
    setActiveReport(item);
  };

  // ── CSV Export with Company Header, Customer Details & Nested Products ───────
  const handleExportCSV = () => {
    if (!reportData?.tableData || reportData.tableData.length === 0) {
      toast.error("No data available to export.");
      return;
    }

    const isCustomer360Statement = activeReport.id === "customer_statement";
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

    // 2. Customer Profile block ONLY if viewing Customer 360 Statement
    let customerBlock = "";
    if (isCustomer360Statement && reportData.customerDetails) {
      const cd = reportData.customerDetails;
      customerBlock = [
        `"CUSTOMER 360 STATEMENT DETAILS"`,
        `"Customer Name:","${(cd.name || "").replace(/"/g, '""')}"`,
        `"Contact Phone:","${(cd.phone || "").replace(/"/g, '""')}"`,
        `"GSTIN:","${(cd.gstin || "Unregistered").replace(/"/g, '""')}"`,
        `"Billing Address:","${(cd.address || "").replace(/"/g, '""')}"`,
        `"Total Invoices:","${cd.total_invoices || 0} Bills"`,
        `"Gross Billed:","${String(cd.total_billed || "").replace(/^[₹Rs\.\s]+/, "")}"`,
        `"Settled / Paid:","${String(cd.total_paid || "").replace(/^[₹Rs\.\s]+/, "")}"`,
        `"Pending Balance:","${String(cd.pending_balance || "").replace(/^[₹Rs\.\s]+/, "")}"`,
        `"Settlement Status:","${cd.pending_invoices_count > 0 ? `${cd.pending_invoices_count} Pending Invoices` : 'All Settled'}"`,
        `""`,
      ].join("\n") + "\n";
    }

    // 3. Column Headers
    const headers = cols.map((c: any) => `"${c.header.replace(/"/g, '""')}"`).join(",");

    // 4. Rows (Itemized Product Sub-Lines ONLY for Customer 360 Statement)
    const rowsList: string[] = [];
    reportData.tableData.forEach((row: any, rIdx: number) => {
      // Main row (Invoice / Customer / Summary line)
      const mainRowStr = cols.map((c: any) => {
        let val = row[c.key] ?? "";
        const strVal = String(val).trim();
        if (strVal.startsWith("₹") || strVal.startsWith("Rs.")) {
          val = strVal.replace(/^[₹Rs\.\s]+/, "").replace(/,/g, "");
        }
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(",");
      rowsList.push(mainRowStr);

      // Nested items under this invoice ONLY in Customer 360 Statement
      if (isCustomer360Statement && Array.isArray(row.items) && row.items.length > 0) {
        rowsList.push(`"","  ↳ ITEM #","PRODUCT / ITEM NAME","SKU / CODE","QUANTITY","UNIT PRICE (₹)","TAX (₹)","LINE TOTAL (₹)"`);
        row.items.forEach((it: any, itIdx: number) => {
          const pName = it.name || it.product_name || `Product Item #${itIdx + 1}`;
          const pSku = it.sku || it.product_sku || "—";
          const pQty = it.qty ?? it.quantity ?? 1;
          const pPrice = typeof it.price === "number" ? it.price : String(it.price || 0).replace(/^[₹Rs\.\s]+/, "").replace(/,/g, "");
          const pTax = typeof it.tax === "number" ? it.tax : String(it.tax || 0).replace(/^[₹Rs\.\s]+/, "").replace(/,/g, "");
          const pTotal = typeof it.total === "number" ? it.total : String(it.total || 0).replace(/^[₹Rs\.\s]+/, "").replace(/,/g, "");

          rowsList.push([
            `""`,
            `"  ↳ Item ${itIdx + 1}"`,
            `"${pName.replace(/"/g, '""')}"`,
            `"${pSku.replace(/"/g, '""')}"`,
            `"${pQty}"`,
            `"${pPrice}"`,
            `"${pTax}"`,
            `"${pTotal}"`,
          ].join(","));
        });
        rowsList.push(`""`); // Blank line separator after items
      }
    });

    // 5. Summary Totals Footer
    let summaryBlock = "";
    if (reportData.summaryTotals && Object.keys(reportData.summaryTotals).length > 0) {
      summaryBlock = "\n\n" + Object.entries(reportData.summaryTotals)
        .map(([k, v]: [string, any]) => `"${k.replace(/_/g, " ").toUpperCase()}:","${String(v).replace(/^[₹Rs\.\s]+/, "").replace(/"/g, '""')}"`)
        .join("\n");
    }

    const fullCsv = metaHeader + "\n" + customerBlock + headers + "\n" + rowsList.join("\n") + summaryBlock;

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
    toast.success(`Exported ${activeReport.title} for ${companyName} to CSV (including itemized products)`);
  };

  // ── PDF Print with Official Corporate Header & Nested Itemized Products ─────
  const handlePrintPDF = () => {
    if (!reportData?.tableData || reportData.tableData.length === 0) {
      toast.error("No data available to print.");
      return;
    }

    const isCustomer360Statement = activeReport.id === "customer_statement";
    const printWin = window.open("", "_blank");
    if (!printWin) {
      toast.error("Please allow popups to print report.");
      return;
    }

    const cols = reportData.tableColumns || [];
    const tableHeaderHtml = cols.map((c: any) => `<th>${c.header}</th>`).join("");
    
    // Build rows (with nested product tables ONLY if customer 360 statement)
    const tableRowsHtml = reportData.tableData
      .map((row: any, rIdx: number) => {
        const isEven = rIdx % 2 === 0;
        const mainRowHtml = `<tr style="background: ${isEven ? '#ffffff' : '#f8fafc'}; font-weight: 500;">
          ${cols.map((c: any) => {
            const val = row[c.key] ?? "—";
            const isNumeric = String(val).includes("₹") || String(val).includes("%");
            const isStatus = c.key === "status";
            const isPending = (c.key === "pending_amount" || c.key === "balance") && parseFloat(String(val).replace(/[^0-9.-]/g, "")) > 0;
            
            if (isStatus) {
              const isPaid = String(val).toLowerCase().includes("paid") || String(val).toLowerCase().includes("completed");
              return `<td style="white-space: nowrap;"><span style="display: inline-block; padding: 2px 7px; border-radius: 9999px; font-size: 8px; font-weight: 700; ${isPaid ? 'background: #dcfce7; color: #15803d; border: 1px solid #86efac;' : 'background: #fef3c7; color: #b45309; border: 1px solid #fde68a;'}">${val}</span></td>`;
            }
            if (isPending) {
              return `<td style="text-align: right; font-weight: 700; color: #be123c;">${val}</td>`;
            }
            return `<td style="${isNumeric ? 'text-align: right;' : ''} ${c.key === 'invoice_no' ? 'font-weight: 700; color: #0f172a;' : ''}">${val}</td>`;
          }).join("")}
        </tr>`;

        // Sub-table for itemized products ONLY in Customer 360 Statement
        let itemsSubTableHtml = "";
        if (isCustomer360Statement && Array.isArray(row.items) && row.items.length > 0) {
          itemsSubTableHtml = `
            <tr style="background: #faf5ff;">
              <td colspan="${cols.length}" style="padding: 5px 12px 9px 12px; border-bottom: 1.5px solid #d8b4fe;">
                <div style="background: #ffffff; border: 1px solid #e9d5ff; border-radius: 6px; padding: 6px 10px;">
                  <div style="font-size: 8.5px; font-weight: 800; color: #6b21a8; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.3px;">
                    📦 Itemized Products in Bill #${row.invoice_no || row.id} (${row.items.length} items):
                  </div>
                  <table style="width: 100%; border-collapse: collapse; font-size: 8.5px; margin-top: 0;">
                    <thead>
                      <tr style="background: #f3e8ff; color: #581c87; border-top: 1px solid #e9d5ff; border-bottom: 1px solid #d8b4fe;">
                        <th style="padding: 2.5px 6px; text-align: left; font-size: 8px;">#</th>
                        <th style="padding: 2.5px 6px; text-align: left; font-size: 8px;">Product Name</th>
                        <th style="padding: 2.5px 6px; text-align: left; font-size: 8px;">SKU / Code</th>
                        <th style="padding: 2.5px 6px; text-align: right; font-size: 8px;">Quantity</th>
                        <th style="padding: 2.5px 6px; text-align: right; font-size: 8px;">Unit Price (₹)</th>
                        <th style="padding: 2.5px 6px; text-align: right; font-size: 8px;">Tax (₹)</th>
                        <th style="padding: 2.5px 6px; text-align: right; font-size: 8px;">Line Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${row.items.map((it: any, idx: number) => {
                        const pName = it.name || it.product_name || `Product Item #${idx + 1}`;
                        const pSku = it.sku || it.product_sku || "—";
                        const pQty = it.qty ?? it.quantity ?? 1;
                        const pPrice = typeof it.price === "number" ? formatCurrency(it.price) : (it.price || "₹0.00");
                        const pTax = typeof it.tax === "number" ? formatCurrency(it.tax) : (it.tax || "₹0.00");
                        const pTotal = typeof it.total === "number" ? formatCurrency(it.total) : (it.total || "₹0.00");
                        return `
                          <tr style="border-bottom: 1px solid #f3e8ff;">
                            <td style="padding: 2.5px 6px; color: #64748b;">${idx + 1}</td>
                            <td style="padding: 2.5px 6px; font-weight: 700; color: #1e1b4b;">${pName}</td>
                            <td style="padding: 2.5px 6px; color: #64748b;">${pSku}</td>
                            <td style="padding: 2.5px 6px; text-align: right; font-weight: 600;">${pQty}</td>
                            <td style="padding: 2.5px 6px; text-align: right;">${pPrice}</td>
                            <td style="padding: 2.5px 6px; text-align: right; color: #64748b;">${pTax}</td>
                            <td style="padding: 2.5px 6px; text-align: right; font-weight: 800; color: #0f172a;">${pTotal}</td>
                          </tr>
                        `;
                      }).join("")}
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          `;
        }

        return mainRowHtml + itemsSubTableHtml;
      })
      .join("");

    // Customer 360 Header Profile ONLY for printable customer statement
    const customerProfileBannerHtml = (isCustomer360Statement && reportData.customerDetails) ? `
      <div style="background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%); border: 1.5px solid #d8b4fe; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 13.5px; font-weight: 800; color: #581c87; display: flex; align-items: gap: 8px;">
            <span>${reportData.customerDetails.name}</span>
            <span style="font-size: 9px; font-weight: 700; padding: 2px 8px; border-radius: 9999px; ${reportData.customerDetails.pending_invoices_count > 0 ? 'background: #fef3c7; color: #92400e; border: 1px solid #fcd34d;' : 'background: #dcfce7; color: #166534; border: 1px solid #86efac;'}">
              ${reportData.customerDetails.pending_invoices_count > 0 ? `⚠️ ${reportData.customerDetails.pending_invoices_count} Pending Invoices` : '✓ All Invoices Settled'}
            </span>
          </div>
          <div style="font-size: 9px; color: #475569; margin-top: 3px; line-height: 1.4;">
            <span>Tel: <strong style="color: #0f172a;">${reportData.customerDetails.phone || '—'}</strong></span> &bull; 
            <span>GSTIN: <strong style="color: #0f172a;">${reportData.customerDetails.gstin || 'Unregistered'}</strong></span> &bull; 
            <span>${reportData.customerDetails.address || ''}</span>
          </div>
        </div>
        <div style="display: flex; gap: 8px; text-align: center;">
          <div style="background: #ffffff; border: 1px solid #e9d5ff; padding: 4px 9px; border-radius: 6px; min-width: 75px;">
            <div style="font-size: 7.5px; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Bills</div>
            <div style="font-size: 11px; font-weight: 800; color: #0f172a;">${reportData.customerDetails.total_invoices}</div>
          </div>
          <div style="background: #ffffff; border: 1px solid #e9d5ff; padding: 4px 9px; border-radius: 6px; min-width: 85px;">
            <div style="font-size: 7.5px; font-weight: 700; color: #64748b; text-transform: uppercase;">Gross Billed</div>
            <div style="font-size: 11px; font-weight: 800; color: #0f172a;">${reportData.customerDetails.total_billed}</div>
          </div>
          <div style="background: #ffffff; border: 1px solid #bbf7d0; padding: 4px 9px; border-radius: 6px; min-width: 85px;">
            <div style="font-size: 7.5px; font-weight: 700; color: #166534; text-transform: uppercase;">Settled / Paid</div>
            <div style="font-size: 11px; font-weight: 800; color: #166534;">${reportData.customerDetails.total_paid}</div>
          </div>
          <div style="background: #ffffff; border: 1.5px solid #fecdd3; padding: 4px 9px; border-radius: 6px; min-width: 95px;">
            <div style="font-size: 7.5px; font-weight: 800; color: #be123c; text-transform: uppercase;">Pending Due</div>
    ` : "";

    const summaryTotalsHtml = reportData.summaryTotals && Object.keys(reportData.summaryTotals).length > 0
      ? `
        <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px 16px; margin-top: 18px; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 20px; font-size: 10px;">
          ${Object.entries(reportData.summaryTotals).map(([k, v]: [string, any]) => `
            <div>
              <span style="color: #475569; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px;">${k.replace(/_/g, " ")}: </span>
              <strong style="color: #1e1b4b; font-size: 12px;">${v}</strong>
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
          @page { size: A4 portrait; margin: 10mm 10mm 12mm 10mm; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; 
            padding: 4px; 
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
            padding-bottom: 10px;
            margin-bottom: 14px;
          }
          .company-title {
            font-size: 19px;
            font-weight: 800;
            color: #1e1b4b;
            letter-spacing: -0.5px;
            margin: 0;
            line-height: 1.2;
          }
          .company-meta {
            font-size: 9.5px;
            color: #475569;
            margin-top: 3px;
            line-height: 1.35;
          }
          .report-badge {
            display: inline-block;
            background: #eef2ff;
            color: #4f46e5;
            font-size: 8.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            padding: 2px 7px;
            border-radius: 4px;
            margin-bottom: 2px;
          }
          .report-heading {
            font-size: 15px;
            font-weight: 800;
            color: #0f172a;
            margin: 2px 0;
          }
          .report-details {
            font-size: 9.5px;
            color: #64748b;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            font-size: 9.5px; 
            margin-top: 6px; 
          }
          th { 
            background: #f1f5f9; 
            text-align: left; 
            padding: 6px 8px; 
            font-weight: 700; 
            color: #334155; 
            border-top: 1px solid #cbd5e1;
            border-bottom: 1.5px solid #94a3b8; 
            text-transform: uppercase;
            font-size: 8.5px;
            letter-spacing: 0.3px;
          }
          td { 
            padding: 5.5px 8px; 
            border-bottom: 1px solid #e2e8f0; 
            color: #1e293b;
          }
          .footer { 
            margin-top: 20px; 
            font-size: 9px; 
            color: #94a3b8; 
            display: flex;
            justify-content: space-between;
            border-top: 1px solid #e2e8f0; 
            padding-top: 6px; 
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
            <div class="report-badge">Official Financial & Operations Statement</div>
            <div class="report-heading">${activeReport.title}</div>
            <div class="report-details">Period: <strong>${reportData.dateRangeLabel || "All Time"}</strong></div>
            <div class="report-details">Generated: ${formatDisplayDateTime(new Date())}</div>
          </div>
        </div>

        ${customerProfileBannerHtml}

        <table>
          <thead><tr>${tableHeaderHtml}</tr></thead>
          <tbody>${tableRowsHtml}</tbody>
        </table>

        ${summaryTotalsHtml}

        <div class="footer">
          <span>Report Generated by BusinessOS for ${companyName}</span>
          <span>Confidential Business Statement & Itemized Audit</span>
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
          r.description.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.reports.length > 0);
  }, [sidebarSearch]);

  const isCustomer360Statement = activeReport.id === "customer_statement";

  return (
    <div className="flex flex-1 h-full w-full bg-slate-50 overflow-hidden font-sans">
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
                            className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-medium transition-all flex items-center justify-between ${
                              isReportActive
                                ? "bg-indigo-600 text-white font-bold shadow-md shadow-indigo-200"
                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            }`}
                          >
                            <span className="truncate">{item.title}</span>
                            {isReportActive && <ChevronRight className="size-3 shrink-0" />}
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
              <h1 className="text-base font-extrabold text-slate-900">{activeReport.title}</h1>
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
              CUSTOMER 360 STATEMENT & PENDING INVOICES SUMMARY CARD
          ────────────────────────────────────────────────────────────────────────── */}
          {reportData?.customerDetails && isCustomer360Statement && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-purple-50/90 via-indigo-50/60 to-white border border-purple-200/90 rounded-2xl p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Customer Identity */}
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-xl bg-purple-700 text-white flex items-center justify-center font-extrabold text-sm shadow-md shadow-purple-200 shrink-0">
                    <Users className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-extrabold text-slate-900 leading-tight">
                        {reportData.customerDetails.name}
                      </h3>
                      {reportData.customerDetails.pending_invoices_count > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                          <AlertTriangle className="size-3" />
                          {reportData.customerDetails.pending_invoices_count} Pending Invoices
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="size-3" /> All Invoices Settled
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 font-medium mt-1">
                      <span>Tel: <strong className="text-slate-700">{reportData.customerDetails.phone || "—"}</strong></span>
                      <span>&bull;</span>
                      <span>GSTIN: <strong className="text-slate-700">{reportData.customerDetails.gstin || "Unregistered"}</strong></span>
                      <span>&bull;</span>
                      <span className="truncate max-w-xs">{reportData.customerDetails.address || ""}</span>
                    </div>
                  </div>
                </div>

                {/* 6 Financial Stat Cards (including Returns and Credit Note Aging) */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="bg-white/90 border border-purple-100 px-3 py-1.5 rounded-xl shadow-2xs text-center min-w-[95px]">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Total Bills</div>
                    <div className="text-xs font-extrabold text-slate-900 mt-0.5">
                      {reportData.customerDetails.total_invoices} Invoices
                    </div>
                  </div>

                  <div className="bg-white/90 border border-purple-100 px-3 py-1.5 rounded-xl shadow-2xs text-center min-w-[105px]">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Gross Billed</div>
                    <div className="text-xs font-extrabold text-slate-900 mt-0.5">
                      {reportData.customerDetails.total_billed}
                    </div>
                  </div>

                  <div className="bg-white/90 border border-emerald-100 px-3 py-1.5 rounded-xl shadow-2xs text-center min-w-[105px]">
                    <div className="text-[10px] uppercase font-bold text-emerald-600">Settled / Paid</div>
                    <div className="text-xs font-extrabold text-emerald-700 mt-0.5">
                      {reportData.customerDetails.total_paid}
                    </div>
                  </div>

                  {reportData.customerDetails.total_returns && (
                    <div className="bg-white/90 border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs text-center min-w-[95px]">
                      <div className="text-[10px] uppercase font-bold text-slate-500">Sales Returns</div>
                      <div className="text-xs font-extrabold text-slate-800 mt-0.5">
                        {reportData.customerDetails.total_returns}
                      </div>
                    </div>
                  )}

                  {reportData.customerDetails.unadjusted_credit_balance && (
                    <div className="bg-white/90 border border-indigo-100 px-3 py-1.5 rounded-xl shadow-2xs text-center min-w-[110px]">
                      <div className="text-[10px] uppercase font-bold text-indigo-600">
                        Credit Note Bal ({reportData.customerDetails.oldest_credit_days || "Active"})
                      </div>
                      <div className="text-xs font-extrabold text-indigo-700 mt-0.5">
                        {reportData.customerDetails.unadjusted_credit_balance}
                      </div>
                    </div>
                  )}

                  <div className="bg-gradient-to-r from-amber-50 to-rose-50 border border-rose-200 px-3.5 py-1.5 rounded-xl shadow-2xs text-center min-w-[125px]">
                    <div className="text-[10px] uppercase font-extrabold text-rose-700 flex items-center justify-center gap-1">
                      <Clock className="size-2.5" /> Pending Balance
                    </div>
                    <div className="text-xs font-extrabold text-rose-700 mt-0.5">
                      {reportData.customerDetails.pending_balance}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ──────────────────────────────────────────────────────────────────────────
              REPORT DATA TABLE
          ────────────────────────────────────────────────────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200">
                    <th className="w-8 px-3 py-3 text-[11px] font-bold text-slate-700 uppercase">#</th>
                    {reportData?.tableColumns?.map((col: any, idx: number) => (
                      <th
                        key={idx}
                        className="px-4 py-3 text-[11px] font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap"
                      >
                        {col.header}
                      </th>
                    ))}
                    {isCustomer360Statement && (
                      <th className="px-3 py-3 text-[11px] font-bold text-slate-700 uppercase text-right">Details</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={(reportData?.tableColumns?.length || 6) + (isCustomer360Statement ? 2 : 1)}
                        className="px-4 py-12 text-center text-slate-400"
                      >
                        <RefreshCw className="size-6 animate-spin mx-auto text-indigo-600 mb-2" />
                        <span>Querying live database records...</span>
                      </td>
                    </tr>
                  ) : !reportData?.tableData || reportData.tableData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={(reportData?.tableColumns?.length || 6) + (isCustomer360Statement ? 2 : 1)}
                        className="px-4 py-12 text-center text-slate-400"
                      >
                        <Boxes className="size-8 mx-auto text-slate-300 mb-2" />
                        <span className="font-semibold">No records found for the selected period.</span>
                      </td>
                    </tr>
                  ) : (
                    reportData.tableData.map((row: any, rIdx: number) => {
                      const rowKey = row.id || row.invoice_no || `row-${rIdx}`;
                      const isRowExpanded = Boolean(expandedInvoices[rowKey]);
                      const hasItems = Array.isArray(row.items) && row.items.length > 0;

                      return (
                        <React.Fragment key={rowKey}>
                          <tr
                            onClick={() => {
                              if (isCustomer360Statement && hasItems) toggleInvoice(rowKey);
                            }}
                            className={`transition-colors group ${
                              isCustomer360Statement && hasItems ? "cursor-pointer" : ""
                            } ${
                              isRowExpanded && isCustomer360Statement ? "bg-purple-50/50" : "hover:bg-slate-50/80"
                            }`}
                          >
                            {/* Expand Indicator Icon (Customer 360 Statement only) or Row Number */}
                            <td className="px-3 py-2.5 text-center text-slate-400">
                              {isCustomer360Statement && hasItems ? (
                                <button
                                  type="button"
                                  onClick={(e) => toggleInvoice(rowKey, e)}
                                  className="p-1 rounded hover:bg-slate-200/60 text-slate-500 transition-transform"
                                >
                                  <ChevronDown
                                    className={`size-3.5 transition-transform duration-200 ${
                                      isRowExpanded ? "rotate-180 text-purple-700" : "text-slate-400"
                                    }`}
                                  />
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400">{rIdx + 1}</span>
                              )}
                            </td>

                            {/* Main Columns */}
                            {reportData.tableColumns.map((col: any, cIdx: number) => {
                              const val = row[col.key];
                              const isStatus = col.key === "status";
                              const isPending = col.key === "pending_amount" || col.key === "balance";
                              const isNumericPending = isPending && parseFloat(String(val).replace(/[^0-9.-]/g, "")) > 0;

                              return (
                                <td key={cIdx} className="px-4 py-2.5 whitespace-nowrap">
                                  {isStatus ? (
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        String(val).toLowerCase().includes("paid") ||
                                        String(val).toLowerCase().includes("completed") ||
                                        String(val).toLowerCase().includes("active")
                                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                          : String(val).toLowerCase().includes("pending") ||
                                            String(val).toLowerCase().includes("partial") ||
                                            String(val).toLowerCase().includes("overdue")
                                          ? "bg-amber-50 text-amber-700 border border-amber-200 font-extrabold"
                                          : "bg-slate-100 text-slate-700"
                                      }`}
                                    >
                                      {val}
                                    </span>
                                  ) : isNumericPending ? (
                                    <span className="font-extrabold text-rose-600">{val}</span>
                                  ) : (
                                    <span className={col.key === "invoice_no" ? "font-bold text-slate-900" : ""}>
                                      {val ?? "—"}
                                    </span>
                                  )}
                                </td>
                              );
                            })}

                            {/* View Products Dropdown Pill (Customer 360 Statement only) */}
                            {isCustomer360Statement && (
                              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                {hasItems && (
                                  <button
                                    type="button"
                                    onClick={(e) => toggleInvoice(rowKey, e)}
                                    className="text-[10px] font-bold px-2 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition-colors cursor-pointer"
                                  >
                                    {`${row.items.length} Products`}
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>

                          {/* ── EXPANDED ROW: Bill-Wise Products Drilldown Table (ONLY in Customer 360 Statement) ── */}
                          {isCustomer360Statement && isRowExpanded && hasItems && (
                            <tr className="bg-purple-50/30">
                              <td colSpan={(reportData.tableColumns.length || 6) + 2} className="px-4 py-3">
                                <div className="bg-white border border-purple-200 rounded-xl p-3.5 shadow-xs space-y-2">
                                  <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                                    <div className="flex items-center gap-2">
                                      <Boxes className="size-3.5 text-purple-700" />
                                      <h4 className="text-xs font-extrabold text-slate-900">
                                        Itemized Bill Products for Invoice #{row.invoice_no || row.id}
                                      </h4>
                                    </div>
                                    <span className="text-[10.5px] font-semibold text-slate-500">
                                      Total Bill Items: <strong>{row.items.length}</strong>
                                    </span>
                                  </div>

                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="bg-slate-50 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                                        <th className="py-1.5 px-3">#</th>
                                        <th className="py-1.5 px-3">Product Name</th>
                                        <th className="py-1.5 px-3">SKU / Code</th>
                                        <th className="py-1.5 px-3 text-right">Quantity</th>
                                        <th className="py-1.5 px-3 text-right">Unit Price</th>
                                        <th className="py-1.5 px-3 text-right">Tax (₹)</th>
                                        <th className="py-1.5 px-3 text-right">Line Total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {row.items.map((it: any, itIdx: number) => {
                                        const pName = it.name || it.product_name || `Product Item #${itIdx + 1}`;
                                        const pSku = it.sku || it.product_sku || it.hsn || "—";
                                        const pQty = it.qty ?? it.quantity ?? 1;
                                        const pPrice = typeof it.price === "number" ? formatCurrency(it.price) : (it.price || "₹0.00");
                                        const pTax = typeof it.tax === "number" ? formatCurrency(it.tax) : (it.tax || "₹0.00");
                                        const pTotal = typeof it.total === "number" ? formatCurrency(it.total) : (it.total || "₹0.00");

                                        return (
                                          <tr key={itIdx} className="hover:bg-slate-50/60 text-slate-700 font-medium">
                                            <td className="py-1.5 px-3 text-slate-400 font-bold text-[10px]">{itIdx + 1}</td>
                                            <td className="py-1.5 px-3 font-bold text-slate-900">{pName}</td>
                                            <td className="py-1.5 px-3 text-slate-500 text-[11px]">{pSku}</td>
                                            <td className="py-1.5 px-3 text-right font-semibold">{pQty}</td>
                                            <td className="py-1.5 px-3 text-right">{pPrice}</td>
                                            <td className="py-1.5 px-3 text-right text-slate-500">{pTax}</td>
                                            <td className="py-1.5 px-3 text-right font-extrabold text-slate-900">{pTotal}</td>
                                          </tr>
                                        );
                                      })}
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
