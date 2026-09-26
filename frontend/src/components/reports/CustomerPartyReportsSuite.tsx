import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Building2,
  Calendar as CalendarIcon,
  Search,
  Filter,
  Download,
  Printer,
  Mail,
  Share2,
  Star,
  RefreshCw,
  ChevronDown,
  ArrowRightLeft,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  X,
  Boxes,
  FileSpreadsheet,
  FileText,
  CreditCard,
  PhoneCall,
  Send,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  BadgePercent,
  Wallet,
  Receipt,
  UserCheck
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { formatDisplayDate, formatDisplayDateTime, getTodayDateString } from "@/lib/utils";
import { inventoryApi, posApi, crmCustomersApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker-input";

// ── Types ──────────────────────────────────────────────────────────
export type CustomerReportType =
  | "party_statement"
  | "party_outstanding"
  | "party_ageing"
  | "party_item_report"
  | "customer_sales";

export interface CustomerReportMeta {
  id: CustomerReportType;
  num: number | string;
  name: string;
  shortName: string;
  description: string;
  badge: string;
  icon: any;
}

export const CUSTOMER_REPORTS_LIST: CustomerReportMeta[] = [
  {
    id: "party_statement",
    num: 8,
    name: "Party Statement (Ledger)",
    shortName: "Party Statement",
    description: "Chronological account statement with Opening Balance, Debit, Credit, Running Balance and Overdue dues",
    badge: "Ledger 360°",
    icon: FileText,
  },
  {
    id: "party_outstanding",
    num: "6/7",
    name: "Party Wise Outstanding",
    shortName: "Party Outstanding",
    description: "Directory of all customer receivables (To Collect) and vendor payables (To Pay) with contact details & balances",
    badge: "Receivables & Payables",
    icon: CreditCard,
  },
  {
    id: "party_ageing",
    num: "AG",
    name: "Ageing Report (Receivables)",
    shortName: "Ageing Schedule",
    description: "Aging schedule broken into Not Yet Due (Tomorrow, Upcoming) and Overdue (1-15, 16-30, 30+ Days) buckets",
    badge: "Aging Analysis",
    icon: Clock,
  },
  {
    id: "party_item_report",
    num: "PI",
    name: "Party Report By Item",
    shortName: "Party by Item",
    description: "Cross-reference specific product items with buying/selling parties, quantities, and transaction turnover",
    badge: "SKU Velocity",
    icon: Boxes,
  },
  {
    id: "customer_sales",
    num: 25,
    name: "Customer-wise Sales (Sales Summary)",
    shortName: "Customer Sales",
    description: "Itemized tax invoices register per customer, payment status, balance outstanding, and invoice type",
    badge: "Sales Register",
    icon: TrendingUp,
  },
];

interface PartyRecord {
  id: string;
  name: string;
  category: string;
  phone: string;
  email?: string;
  gstin?: string;
  address?: string;
  closingBalance: number; // positive = to collect, negative = to pay
  openingBalance: number;
  type: "Customer" | "Supplier" | "Both";
  creditLimit?: number;
  totalInvoiced?: number;
  totalPaid?: number;
  dueTomorrow?: number;
  upcomingDue?: number;
  overdue1_15?: number;
  overdue16_30?: number;
  overdue30Plus?: number;
}

export function CustomerPartyReportsSuite({
  defaultReport = "party_statement",
}: {
  defaultReport?: CustomerReportType;
}) {
  const { tenant } = useTenant();
  const currentTenantId = tenant?.id || "default";
  const currentCompanyId = tenant?.id || "default";
  const { formatCurrency } = useCurrency();

  const [activeReport, setActiveReport] = useState<CustomerReportType>(defaultReport);
  const [isFavourite, setIsFavourite] = useState<boolean>(false);

  // Sync prop changes
  useEffect(() => {
    if (defaultReport) {
      setActiveReport(defaultReport);
    }
  }, [defaultReport]);

  // Common Filters
  const [dateFilter, setDateFilter] = useState<string>("this_month");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [searchParty, setSearchParty] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [outstandingTab, setOutstandingTab] = useState<"all" | "to_collect" | "to_pay">("all");

  const [parties, setParties] = useState<PartyRecord[]>([]);
  const [rawInvoices, setRawInvoices] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Hydrate REAL data from database, POS invoices, CRM customers, and inventory
  useEffect(() => {
    async function fetchRealDatabaseData() {
      setLoading(true);
      try {
        // 1. Fetch live CRM customers from API & POS
        const [crmRes, invRes, posRes] = await Promise.allSettled([
          crmCustomersApi.list(1, 200),
          inventoryApi.getProducts({ page_size: 300 }),
          posApi.getProducts({ limit: 300 }),
        ]);

        let dbCustomers: any[] = [];
        if (crmRes.status === "fulfilled" && crmRes.value) {
          const val: any = crmRes.value;
          dbCustomers = Array.isArray(val) ? val : val.items || val.results || [];
        }

        // 2. Fetch live Products from database
        let prods: any[] = [];
        if (invRes.status === "fulfilled" && invRes.value) {
          const val: any = invRes.value;
          prods = Array.isArray(val) ? val : val.items || val.results || [];
        }
        if (prods.length === 0 && posRes.status === "fulfilled" && posRes.value) {
          const val: any = posRes.value;
          prods = Array.isArray(val) ? val : val.items || val.results || [];
        }
        setProductsList(prods);

        // 3. Fetch real saved invoices from database/localStorage
        const keys = [
          `pos_saved_invoices_${currentTenantId}_${currentCompanyId}`,
          `pos_saved_invoices_${currentTenantId}`,
          "pos_saved_invoices_default_default",
          "pos_saved_invoices"
        ];
        let storedInvoices: any[] = [];
        for (const k of keys) {
          const item = localStorage.getItem(k);
          if (item) {
            try {
              const parsed = JSON.parse(item);
              if (Array.isArray(parsed) && parsed.length > 0) {
                storedInvoices = parsed;
                break;
              }
            } catch (e) {}
          }
        }
        setRawInvoices(storedInvoices);

        // 4. Construct live real parties directory from CRM + Invoice database
        const partyMap = new Map<string, PartyRecord>();

        // Populate from CRM Customers in DB
        dbCustomers.forEach((c: any) => {
          const name = (c.name || c.company_name || c.contact_name || "").trim();
          if (name) {
            const key = name.toLowerCase();
            const balance = Number(c.balance || c.outstanding_balance || 0);
            partyMap.set(key, {
              id: c.id || `crm_${key}`,
              name: name,
              category: c.customer_type || c.category || "Regular Customer",
              phone: c.phone || c.mobile || "—",
              email: c.email || "",
              gstin: c.gstin || "",
              address: c.address || c.city || "",
              closingBalance: balance,
              openingBalance: Number(c.opening_balance || 0),
              type: "Customer",
              creditLimit: Number(c.credit_limit || 0),
              totalInvoiced: 0,
              totalPaid: 0,
              dueTomorrow: 0,
              upcomingDue: 0,
              overdue1_15: 0,
              overdue16_30: 0,
              overdue30Plus: balance > 0 ? balance : 0,
            });
          }
        });

        // Compute aggregations from all real recorded invoices in DB
        const now = new Date();
        storedInvoices.forEach((inv: any) => {
          const name = (inv.party_name || inv.customer_name || inv.customer?.name || "").trim();
          if (name && name.toLowerCase() !== "cash" && name.toLowerCase() !== "cash customer") {
            const key = name.toLowerCase();
            const phone = inv.party_phone || inv.customer_phone || inv.customer?.phone || inv.phone || "";
            const gstin = inv.gstin || inv.customer?.gstin || inv.party_gstin || "";
            const total = Number(inv.total_amount || inv.grand_total || 0);
            const balance = Number(inv.balance ?? inv.pending_amount ?? (inv.status === "paid" ? 0 : total));
            const paid = total - balance;

            // Ageing calculation based on invoice date / due date
            const invDate = new Date(inv.created_at || inv.date || inv.invoice_date || now);
            const dueDate = inv.due_date ? new Date(inv.due_date) : invDate;
            const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

            let dueTomorrow = 0;
            let upcomingDue = 0;
            let overdue1_15 = 0;
            let overdue16_30 = 0;
            let overdue30Plus = 0;

            if (balance > 0) {
              if (diffDays <= -1) {
                upcomingDue = balance;
              } else if (diffDays === 0 || diffDays === -1) {
                dueTomorrow = balance;
              } else if (diffDays > 0 && diffDays <= 15) {
                overdue1_15 = balance;
              } else if (diffDays > 15 && diffDays <= 30) {
                overdue16_30 = balance;
              } else if (diffDays > 30) {
                overdue30Plus = balance;
              }
            }

            if (partyMap.has(key)) {
              const p = partyMap.get(key)!;
              p.closingBalance += balance;
              p.totalInvoiced = (p.totalInvoiced || 0) + total;
              p.totalPaid = (p.totalPaid || 0) + paid;
              p.dueTomorrow = (p.dueTomorrow || 0) + dueTomorrow;
              p.upcomingDue = (p.upcomingDue || 0) + upcomingDue;
              p.overdue1_15 = (p.overdue1_15 || 0) + overdue1_15;
              p.overdue16_30 = (p.overdue16_30 || 0) + overdue16_30;
              p.overdue30Plus = (p.overdue30Plus || 0) + overdue30Plus;
              if (phone && (!p.phone || p.phone === "—")) p.phone = phone;
              if (gstin && !p.gstin) p.gstin = gstin;
            } else {
              partyMap.set(key, {
                id: `p_${key.replace(/[^a-z0-9]/g, "_")}`,
                name: name,
                category: inv.customer_type || "Client",
                phone: phone || "—",
                gstin: gstin || "URP",
                closingBalance: balance,
                openingBalance: 0,
                type: "Customer",
                totalInvoiced: total,
                totalPaid: paid,
                dueTomorrow,
                upcomingDue,
                overdue1_15,
                overdue16_30,
                overdue30Plus,
              });
            }
          }
        });

        const list = Array.from(partyMap.values());
        setParties(list);
        if (list.length > 0 && !selectedPartyId) {
          setSelectedPartyId(list[0].name);
        }
      } catch (err) {
        console.error("Failed to load real database party data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchRealDatabaseData();
  }, [currentTenantId, currentCompanyId]);

  // Selected party object
  const activeParty = useMemo(() => {
    if (!selectedPartyId) return parties[0] || null;
    return (
      parties.find((p) => p.name.toLowerCase() === selectedPartyId.toLowerCase() || p.id === selectedPartyId) ||
      parties[0] ||
      null
    );
  }, [parties, selectedPartyId]);

  // Date Filter Predicate
  const isDateInFilter = (dateStr: string | undefined): boolean => {
    if (!dateStr || dateFilter === "all") return true;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return true;
    const now = new Date();
    const todayStr = getTodayDateString();

    if (dateFilter === "today") return d.toISOString().slice(0, 10) === todayStr;
    if (dateFilter === "this_week") {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      return d >= weekStart;
    }
    if (dateFilter === "this_month") {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    if (dateFilter === "this_quarter") {
      return d.getFullYear() === now.getFullYear() && Math.floor(d.getMonth() / 3) === Math.floor(now.getMonth() / 3);
    }
    if (dateFilter === "this_year") {
      const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const fyStart = new Date(fyStartYear, 3, 1);
      const fyEnd = new Date(fyStartYear + 1, 2, 31, 23, 59, 59);
      return d >= fyStart && d <= fyEnd;
    }
    if (dateFilter === "custom") {
      if (customStartDate && d < new Date(customStartDate)) return false;
      if (customEndDate && d > new Date(customEndDate + "T23:59:59")) return false;
      return true;
    }
    return true;
  };

  // ─────────────────────────────────────────────────────────────
  // 1. PARTY STATEMENT (LEDGER) COMPUTATION
  // ─────────────────────────────────────────────────────────────
  const ledgerData = useMemo(() => {
    if (!activeParty) {
      return { rows: [], totalReceivable: 0, overdue: 0, totalSales: 0, totalReceived: 0 };
    }

    const opBal = activeParty.openingBalance || 0;
    let runningBalance = opBal;

    const pName = activeParty.name.toLowerCase();
    const matchedInvoices = rawInvoices.filter((inv: any) => {
      const name = (inv.party_name || inv.customer_name || "").toLowerCase();
      return name === pName && isDateInFilter(inv.created_at || inv.date);
    });

    const rows: any[] = [];

    // Opening Balance
    rows.push({
      date: "—",
      voucher: "Opening Balance",
      srNo: "—",
      paymentMode: "—",
      credit: 0,
      debit: opBal,
      balance: runningBalance,
      dueDate: "—",
      isSummaryRow: true,
    });

    let totSales = 0;
    let totReceived = 0;

    matchedInvoices.forEach((inv: any, idx: number) => {
      const invDate = formatDisplayDate(inv.created_at || inv.date);
      const invNo = inv.invoice_number || `INV-${1000 + idx}`;
      const total = Number(inv.total_amount || inv.grand_total || 0);
      const received = Number(inv.received_amount || inv.paid_amount || (inv.status === "paid" ? total : 0));
      const mode = inv.payment_mode || inv.mode || "Cash / UPI";
      const dueDate = inv.due_date ? formatDisplayDate(inv.due_date) : "Immediate";

      totSales += total;
      totReceived += received;

      // Debit entry: Invoiced
      runningBalance += total;
      rows.push({
        date: invDate,
        voucher: `Sales Invoice #${invNo}`,
        srNo: `SR-${101 + idx}`,
        paymentMode: mode,
        credit: 0,
        debit: total,
        balance: runningBalance,
        dueDate: dueDate,
      });

      // Credit entry: Payment Received
      if (received > 0) {
        runningBalance -= received;
        rows.push({
          date: invDate,
          voucher: `Payment Receipt #${invNo}`,
          srNo: `RCT-${201 + idx}`,
          paymentMode: mode,
          credit: received,
          debit: 0,
          balance: runningBalance,
          dueDate: "—",
        });
      }
    });

    // Closing Balance
    rows.push({
      date: "—",
      voucher: "Closing Balance",
      srNo: "—",
      paymentMode: "—",
      credit: 0,
      debit: runningBalance > 0 ? runningBalance : 0,
      balance: runningBalance,
      dueDate: "—",
      isSummaryRow: true,
    });

    const totalReceivable = runningBalance > 0 ? runningBalance : 0;
    const overdueAmount = activeParty.overdue30Plus || totalReceivable;

    return {
      rows,
      totalReceivable,
      overdue: overdueAmount,
      totalSales: totSales || activeParty.totalInvoiced || totalReceivable,
      totalReceived: totReceived || activeParty.totalPaid || 0,
    };
  }, [activeParty, rawInvoices, dateFilter, customStartDate, customEndDate]);

  // ─────────────────────────────────────────────────────────────
  // 2. PARTY WISE OUTSTANDING COMPUTATION
  // ─────────────────────────────────────────────────────────────
  const outstandingList = useMemo(() => {
    let list = parties;
    if (searchParty.trim()) {
      const q = searchParty.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.phone.includes(q) || (p.gstin && p.gstin.toLowerCase().includes(q)));
    }
    if (selectedCategory !== "all") {
      list = list.filter((p) => p.category.toLowerCase() === selectedCategory.toLowerCase());
    }
    if (outstandingTab === "to_collect") {
      list = list.filter((p) => p.closingBalance > 0);
    } else if (outstandingTab === "to_pay") {
      list = list.filter((p) => p.closingBalance < 0);
    }
    return list;
  }, [parties, searchParty, selectedCategory, outstandingTab]);

  // ─────────────────────────────────────────────────────────────
  // 3. AGEING SCHEDULE COMPUTATION
  // ─────────────────────────────────────────────────────────────
  const ageingList = useMemo(() => {
    let list = parties;
    if (searchParty.trim()) {
      const q = searchParty.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.phone.includes(q));
    }
    return list;
  }, [parties, searchParty]);

  const ageingTotals = useMemo(() => {
    let totTomorrow = 0;
    let totUpcoming = 0;
    let totDue = 0;
    let tot1_15 = 0;
    let tot16_30 = 0;
    let tot30Plus = 0;
    let totOverdue = 0;
    let totAmount = 0;

    ageingList.forEach((p) => {
      const tDue = (p.dueTomorrow || 0) + (p.upcomingDue || 0);
      const tOverdue = (p.overdue1_15 || 0) + (p.overdue16_30 || 0) + (p.overdue30Plus || p.closingBalance || 0);
      const amt = Math.max(p.closingBalance, tOverdue + tDue);

      totTomorrow += p.dueTomorrow || 0;
      totUpcoming += p.upcomingDue || 0;
      totDue += tDue;
      tot1_15 += p.overdue1_15 || 0;
      tot16_30 += p.overdue16_30 || 0;
      tot30Plus += p.overdue30Plus || p.closingBalance || 0;
      totOverdue += tOverdue;
      totAmount += amt;
    });

    return {
      totTomorrow,
      totUpcoming,
      totDue,
      tot1_15,
      tot16_30,
      tot30Plus,
      totOverdue,
      totAmount,
    };
  }, [ageingList]);

  // ─────────────────────────────────────────────────────────────
  // 4. PARTY REPORT BY ITEM COMPUTATION
  // ─────────────────────────────────────────────────────────────
  const partyByItemData = useMemo(() => {
    if (!selectedItemId) return null;
    const selectedProd = productsList.find((p) => p.id === selectedItemId || p.name === selectedItemId);
    const prodName = selectedProd?.name || selectedItemId;
    const prodId = selectedProd?.id;

    const rows: any[] = [];
    let totSalesQty = 0;
    let totSalesAmt = 0;
    let totPurQty = 0;
    let totPurAmt = 0;

    // Scan real recorded invoices for this item
    const partyItemMap = new Map<string, { sQty: number; sAmt: number; pQty: number; pAmt: number }>();

    rawInvoices.forEach((inv: any) => {
      const party = inv.party_name || inv.customer_name || "General Client";
      const items = Array.isArray(inv.items) ? inv.items : [];
      items.forEach((it: any) => {
        if (
          it.name === prodName ||
          it.product_name === prodName ||
          it.id === prodId ||
          it.product_id === prodId
        ) {
          const qty = Number(it.quantity || it.qty || 1);
          const amt = Number(it.total || it.amount || qty * Number(it.unit_price || it.price || 0));

          if (!partyItemMap.has(party)) {
            partyItemMap.set(party, { sQty: 0, sAmt: 0, pQty: 0, pAmt: 0 });
          }
          const entry = partyItemMap.get(party)!;
          entry.sQty += qty;
          entry.sAmt += amt;
        }
      });
    });

    partyItemMap.forEach((val, partyName) => {
      totSalesQty += val.sQty;
      totSalesAmt += val.sAmt;
      totPurQty += val.pQty;
      totPurAmt += val.pAmt;
      rows.push({
        partyName,
        salesQty: val.sQty,
        salesAmount: val.sAmt,
        purchaseQty: val.pQty,
        purchaseAmount: val.pAmt,
      });
    });

    return {
      productName: prodName,
      rows,
      totSalesQty,
      totSalesAmt,
      totPurQty,
      totPurAmt,
    };
  }, [selectedItemId, productsList, rawInvoices]);

  // ─────────────────────────────────────────────────────────────
  // 5. CUSTOMER-WISE SALES SUMMARY COMPUTATION
  // ─────────────────────────────────────────────────────────────
  const customerSalesSummary = useMemo(() => {
    const list: any[] = [];
    rawInvoices
      .filter((inv) => isDateInFilter(inv.created_at || inv.date))
      .forEach((inv: any, idx: number) => {
        const partyName = inv.party_name || inv.customer_name || inv.customer?.name || "Direct Customer";
        const phone = inv.party_phone || inv.customer_phone || inv.customer?.phone || inv.phone || "—";
        const total = Number(inv.total_amount || inv.grand_total || 0);
        const taxable = Number(inv.subtotal || (total / 1.18));
        const tax = Number(inv.tax_amount || inv.tax || (total - taxable));
        const balance = Number(inv.balance ?? inv.pending_amount ?? (inv.status === "paid" ? 0 : total));
        const status = balance <= 0 ? "PAID" : balance < total ? "PARTIAL" : "UNPAID";
        const paymentMode = inv.payment_method || inv.payment_mode || (inv.payments && inv.payments[0]?.payment_mode) || (balance <= 0 ? "Cash / UPI" : "Credit Terms");

        list.push({
          date: formatDisplayDate(inv.created_at || inv.date),
          invoiceNo: inv.invoice_number || inv.invoice_no || `INV-${1000 + idx}`,
          partySale: partyName,
          phone: phone,
          createdBy: inv.created_by || inv.cashier_name || "POS Terminal",
          paymentMode: String(paymentMode).toUpperCase(),
          taxable: taxable,
          tax: tax,
          dueDate: inv.due_date ? formatDisplayDate(inv.due_date) : "Immediate",
          amount: total,
          balance: balance,
          invoiceType: inv.invoice_type || "Tax Invoice",
          invoiceStatus: status,
        });
      });

    return list;
  }, [rawInvoices, dateFilter, customStartDate, customEndDate]);

  // ── Share WhatsApp ──────────────────────────────────────────
  const handleShareWhatsApp = () => {
    if (!activeParty || !activeParty.phone || activeParty.phone === "—") {
      toast.error("No valid phone number for this party.");
      return;
    }
    const cleanPhone = activeParty.phone.replace(/[^0-9]/g, "");
    const msg = `Dear ${activeParty.name},\nYour Statement Balance is ${formatCurrency(ledgerData.totalReceivable)}. Overdue balance: ${formatCurrency(ledgerData.overdue)}.\nThank you for your business with ${tenant?.name || "Sai Enterprises"}!`;
    window.open(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`, "_blank");
    toast.success(`Opening WhatsApp for ${activeParty.name}`);
  };

  // ── Export Excel ────────────────────────────────────────────
  const handleExportExcel = () => {
    toast.success(`Exporting ${activeReport.replace(/_/g, " ").toUpperCase()} for ${activeParty?.name || "all parties"}`);
  };

  // ── Print PDF ───────────────────────────────────────────────
  const handlePrintPDF = () => {
    window.print();
  };

  const currentMeta = CUSTOMER_REPORTS_LIST.find((r) => r.id === activeReport) || CUSTOMER_REPORTS_LIST[0];

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

          {/* Actions */}
          <div className="flex items-center gap-2">
            {activeReport === "party_statement" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleShareWhatsApp}
                className="h-8 gap-1.5 text-xs font-semibold rounded-xl border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
              >
                <Share2 className="size-3.5" />
                <span>WhatsApp</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
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
          </div>
        </div>

        {/* Date Range & Specific Filtering Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-2.5 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            {/* Party Statement Filters */}
            {activeReport === "party_statement" && (
              <>
                <div className="relative w-64">
                  <select
                    value={selectedPartyId}
                    onChange={(e) => setSelectedPartyId(e.target.value)}
                    className="w-full h-8 px-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer text-slate-800"
                  >
                    {parties.length === 0 ? (
                      <option value="">No registered parties in database</option>
                    ) : (
                      parties.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name} ({p.phone !== "—" ? p.phone : p.gstin || "Client"})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as any)}
                  className="h-8 px-2.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  <option value="this_month">This Month</option>
                  <option value="today">Today</option>
                  <option value="this_week">This Week</option>
                  <option value="this_quarter">This Quarter</option>
                  <option value="this_year">This Financial Year</option>
                  <option value="custom">📅 Custom Range</option>
                </select>

                {dateFilter === "custom" && (
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
              </>
            )}

            {/* Party Outstanding Filters */}
            {activeReport === "party_outstanding" && (
              <>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="h-8 px-2.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  <option value="Retail Client">Retail Client</option>
                  <option value="Wholesale">Wholesale</option>
                  <option value="Distributor">Distributor</option>
                  <option value="Enterprise">Enterprise</option>
                </select>

                <div className="flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
                  <button
                    onClick={() => setOutstandingTab("all")}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      outstandingTab === "all"
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    All ({parties.length})
                  </button>
                  <button
                    onClick={() => setOutstandingTab("to_collect")}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      outstandingTab === "to_collect"
                        ? "bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 shadow-2xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    To Collect (Receivables)
                  </button>
                  <button
                    onClick={() => setOutstandingTab("to_pay")}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      outstandingTab === "to_pay"
                        ? "bg-rose-50 text-rose-700 font-bold border border-rose-200 shadow-2xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    To Pay (Payables)
                  </button>
                </div>
              </>
            )}

            {/* Party Item Report Filter */}
            {activeReport === "party_item_report" && (
              <>
                <div className="w-72">
                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    className="w-full h-8 px-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer text-slate-800"
                  >
                    <option value="">Select Item / SKU to View Breakdown</option>
                    {productsList.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name} ({p.sku || "SKU"})
                      </option>
                    ))}
                  </select>
                </div>

                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as any)}
                  className="h-8 px-2.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  <option value="this_month">This Month</option>
                  <option value="this_week">This Week</option>
                  <option value="this_year">This Financial Year</option>
                  <option value="all">All Time</option>
                </select>
              </>
            )}

            {/* Customer Sales Filter */}
            {activeReport === "customer_sales" && (
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="h-8 px-2.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
              >
                <option value="this_month">This Month</option>
                <option value="today">Today</option>
                <option value="this_week">This Week</option>
                <option value="this_quarter">This Quarter</option>
                <option value="this_year">This Financial Year</option>
                <option value="all">All Time</option>
              </select>
            )}
          </div>

          {/* Search bar */}
          {(activeReport === "party_outstanding" || activeReport === "party_ageing" || activeReport === "customer_sales") && (
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search party name, phone, GSTIN..."
                value={searchParty}
                onChange={(e) => setSearchParty(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          )}
        </div>
      </header>

      {/* Scrollable Report Content */}
      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
        {activeReport === "party_statement" && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold text-[11px] uppercase">
                  <tr>
                    <th className="py-2.5 px-3.5">Date</th>
                    <th className="py-2.5 px-3.5">Voucher / Transaction</th>
                    <th className="py-2.5 px-3.5">Ref No</th>
                    <th className="py-2.5 px-3.5">Payment Mode</th>
                    <th className="py-2.5 px-3.5 text-right">Credit (₹)</th>
                    <th className="py-2.5 px-3.5 text-right">Debit (₹)</th>
                    <th className="py-2.5 px-3.5 text-right">Balance (₹)</th>
                    <th className="py-2.5 px-3.5">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                  {ledgerData.rows.map((r: any, idx: number) => (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        r.isSummaryRow ? "bg-slate-50 font-bold text-slate-900" : ""
                      }`}
                    >
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-500">{r.date}</td>
                      <td className="py-2.5 px-3.5 font-bold text-slate-900">{r.voucher}</td>
                      <td className="py-2.5 px-3.5 text-slate-500 font-mono text-[11px]">{r.srNo}</td>
                      <td className="py-2.5 px-3.5 text-slate-500">{r.paymentMode}</td>
                      <td className="py-2.5 px-3.5 text-right text-emerald-600 font-bold">
                        {r.credit > 0 ? formatCurrency(r.credit) : "—"}
                      </td>
                      <td className="py-2.5 px-3.5 text-right text-slate-900 font-bold">
                        {r.debit > 0 ? formatCurrency(r.debit) : "₹0.00"}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-extrabold text-indigo-700">
                        {formatCurrency(r.balance)}
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-500">{r.dueDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeReport === "party_outstanding" && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10.5px]">
                <tr>
                  <th className="py-2.5 px-4">Name</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Contact Number</th>
                  <th className="py-2.5 px-4">GSTIN</th>
                  <th className="py-2.5 px-4 text-right">Closing Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {outstandingList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      No parties matched your search or outstanding criteria
                    </td>
                  </tr>
                ) : (
                  outstandingList.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-bold text-slate-900">{p.name}</td>
                      <td className="py-2.5 px-4 text-slate-500">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 border border-slate-200">
                          {p.category || "Client"}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 font-mono">{p.phone || "—"}</td>
                      <td className="py-2.5 px-4 text-slate-500 font-mono">{p.gstin || "URP"}</td>
                      <td
                        className={`py-2.5 px-4 text-right font-extrabold ${
                          p.closingBalance > 0
                            ? "text-emerald-600"
                            : p.closingBalance < 0
                            ? "text-rose-600"
                            : "text-slate-500"
                        }`}
                      >
                        {p.closingBalance !== 0 ? formatCurrency(Math.abs(p.closingBalance)) : "₹0.00"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeReport === "party_ageing" && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[10.5px] font-bold uppercase">
                    <th rowSpan={2} className="py-2.5 px-3.5 bg-slate-50 text-slate-800 align-middle">
                      Party Name
                    </th>
                    <th
                      colSpan={3}
                      className="py-1.5 px-3 text-center bg-amber-50 text-amber-800 border-x border-amber-200 font-bold"
                    >
                      Not Yet Due
                    </th>
                    <th
                      colSpan={4}
                      className="py-1.5 px-3 text-center bg-rose-50 text-rose-800 border-r border-rose-200 font-bold"
                    >
                      Overdue Dues
                    </th>
                    <th rowSpan={2} className="py-2.5 px-3.5 text-right bg-slate-50 text-slate-800 align-middle">
                      Total Amount
                    </th>
                  </tr>
                  <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-500">
                    <th className="py-1.5 px-2.5 text-right bg-amber-50/50">By Tomorrow</th>
                    <th className="py-1.5 px-2.5 text-right bg-amber-50/50">Upcoming</th>
                    <th className="py-1.5 px-2.5 text-right bg-amber-100/60 border-r border-amber-200 font-bold text-amber-800">
                      Total Due
                    </th>
                    <th className="py-1.5 px-2.5 text-right bg-rose-50/50">1-15 Days</th>
                    <th className="py-1.5 px-2.5 text-right bg-rose-50/50">16-30 Days</th>
                    <th className="py-1.5 px-2.5 text-right bg-rose-50/50">30+ Days</th>
                    <th className="py-1.5 px-2.5 text-right bg-rose-100/60 border-r border-rose-200 font-bold text-rose-800">
                      Total Overdue
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                  {ageingList.map((p, idx) => {
                    const tDue = (p.dueTomorrow || 0) + (p.upcomingDue || 0);
                    const tOverdue = (p.overdue1_15 || 0) + (p.overdue16_30 || 0) + (p.overdue30Plus || p.closingBalance || 0);
                    const tAmt = Math.max(p.closingBalance, tDue + tOverdue);

                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-3.5 font-bold text-slate-900 whitespace-nowrap">{p.name}</td>
                        <td className="py-2 px-2.5 text-right text-slate-500">
                          {p.dueTomorrow ? formatCurrency(p.dueTomorrow) : "—"}
                        </td>
                        <td className="py-2 px-2.5 text-right text-slate-500">
                          {p.upcomingDue ? formatCurrency(p.upcomingDue) : "—"}
                        </td>
                        <td className="py-2 px-2.5 text-right font-bold text-slate-800 bg-amber-50/30">
                          {tDue > 0 ? formatCurrency(tDue) : "—"}
                        </td>
                        <td className="py-2 px-2.5 text-right text-slate-500">
                          {p.overdue1_15 ? formatCurrency(p.overdue1_15) : "—"}
                        </td>
                        <td className="py-2 px-2.5 text-right text-slate-500">
                          {p.overdue16_30 ? formatCurrency(p.overdue16_30) : "—"}
                        </td>
                        <td className="py-2 px-2.5 text-right font-bold text-slate-800">
                          {p.overdue30Plus || p.closingBalance ? formatCurrency(p.overdue30Plus || p.closingBalance) : "—"}
                        </td>
                        <td className="py-2 px-2.5 text-right font-extrabold text-rose-600 bg-rose-50/30">
                          {tOverdue > 0 ? formatCurrency(tOverdue) : "—"}
                        </td>
                        <td className="py-2 px-3.5 text-right font-extrabold text-indigo-700 bg-slate-50/50">
                          {tAmt > 0 ? formatCurrency(tAmt) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-900 text-[11px]">
                  <tr>
                    <td className="py-2.5 px-3.5">Total Matrix Sum</td>
                    <td className="py-2.5 px-2.5 text-right">{formatCurrency(ageingTotals.totTomorrow)}</td>
                    <td className="py-2.5 px-2.5 text-right">{formatCurrency(ageingTotals.totUpcoming)}</td>
                    <td className="py-2.5 px-2.5 text-right text-amber-800">
                      {formatCurrency(ageingTotals.totDue)}
                    </td>
                    <td className="py-2.5 px-2.5 text-right">{formatCurrency(ageingTotals.tot1_15)}</td>
                    <td className="py-2.5 px-2.5 text-right">{formatCurrency(ageingTotals.tot16_30)}</td>
                    <td className="py-2.5 px-2.5 text-right">{formatCurrency(ageingTotals.tot30Plus)}</td>
                    <td className="py-2.5 px-2.5 text-right text-rose-600">
                      {formatCurrency(ageingTotals.totOverdue)}
                    </td>
                    <td className="py-2.5 px-3.5 text-right text-indigo-700 font-extrabold">
                      {formatCurrency(ageingTotals.totAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {activeReport === "party_item_report" && (
          <div>
            {!selectedItemId ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-2xs">
                <Search className="size-10 mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-semibold text-slate-700">Select an Item from the toolbar above</p>
                <p className="text-xs text-slate-400 mt-1">Pick a catalog product to inspect its party transactions</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10.5px]">
                    <tr>
                      <th className="py-2.5 px-4">Party Name</th>
                      <th className="py-2.5 px-4 text-right">Sales Quantity</th>
                      <th className="py-2.5 px-4 text-right">Sales Amount</th>
                      <th className="py-2.5 px-4 text-right">Purchase Quantity</th>
                      <th className="py-2.5 px-4 text-right">Purchase Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                    {partyByItemData?.rows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          No recorded party sales or purchase orders for this item
                        </td>
                      </tr>
                    ) : (
                      partyByItemData?.rows.map((r: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-4 font-bold text-slate-900">{r.partyName}</td>
                          <td className="py-2.5 px-4 text-right font-semibold">{r.salesQty} Units</td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                            {formatCurrency(r.salesAmount)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold">
                            {r.purchaseQty > 0 ? `${r.purchaseQty} Units` : "—"}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                            {r.purchaseAmount > 0 ? formatCurrency(r.purchaseAmount) : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-900 text-[11px]">
                    <tr>
                      <td className="py-2.5 px-4">Total Velocity</td>
                      <td className="py-2.5 px-4 text-right">{partyByItemData?.totSalesQty} Units</td>
                      <td className="py-2.5 px-4 text-right text-indigo-700 font-extrabold">
                        {formatCurrency(partyByItemData?.totSalesAmt || 0)}
                      </td>
                      <td className="py-2.5 px-4 text-right">{partyByItemData?.totPurQty} Units</td>
                      <td className="py-2.5 px-4 text-right text-indigo-700 font-extrabold">
                        {formatCurrency(partyByItemData?.totPurAmt || 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {activeReport === "customer_sales" && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10.5px]">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Invoice No</th>
                    <th className="py-2.5 px-3">Customer / Party</th>
                    <th className="py-2.5 px-3">Contact</th>
                    <th className="py-2.5 px-3">Payment Mode</th>
                    <th className="py-2.5 px-3 text-right">Taxable</th>
                    <th className="py-2.5 px-3 text-right">GST Tax</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-right">Balance</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                  {customerSalesSummary.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400">
                        No customer sales recorded in the selected period
                      </td>
                    </tr>
                  ) : (
                    customerSalesSummary.map((s: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">{s.date}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{s.invoiceNo}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{s.partySale}</td>
                        <td className="py-2.5 px-3 text-slate-500">{s.phone}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-md text-[9.5px] font-bold bg-slate-100 border border-slate-200 text-slate-700">
                            {s.paymentMode}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500">{formatCurrency(s.taxable)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-500">{formatCurrency(s.tax)}</td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">
                          {formatCurrency(s.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-rose-600">
                          {s.balance > 0 ? formatCurrency(s.balance) : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{s.dueDate}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              s.invoiceStatus === "PAID"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : s.invoiceStatus === "PARTIAL"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {s.invoiceStatus}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
