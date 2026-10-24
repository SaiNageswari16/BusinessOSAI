import React, { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
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
  UserCheck,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { formatDisplayDate, formatDisplayDateTime, getTodayDateString, parseSafeDateTimestamp } from "@/lib/utils";
import * as XLSX from "xlsx";

import { inventoryApi, posApi, crmCustomersApi, invoicesApi } from "@/lib/api-client";
import { syncLocalStorageCustomerInvoices } from "@/lib/safe-storage";
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
    name: "Item Report By Party",
    shortName: "Item by Party",
    description: "Party-wise item transaction ledger with sales volume, sales revenue, purchase orders, and item codes",
    badge: "SKU Velocity",
    icon: Boxes,
  },
  {
    id: "customer_sales",
    num: 25,
    name: "Sales Summary - Category Wise",
    shortName: "Category Sales",
    description: "Itemized tax invoices register with party sales, cashier/created by, amount, balance, invoice type, and invoice status",
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

interface SearchablePartySelectProps {
  value: string;
  onChange: (partyName: string) => void;
  parties: PartyRecord[];
  placeholder?: string;
  className?: string;
}

function SearchablePartySelect({
  value,
  onChange,
  parties,
  placeholder = "Search / Select Party...",
  className = "",
}: SearchablePartySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearch("");
    }
  }, [isOpen]);

  const filteredParties = useMemo(() => {
    if (!search.trim()) return parties;
    const q = search.toLowerCase();
    return parties.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.phone && p.phone.toLowerCase().includes(q)) ||
        (p.gstin && p.gstin.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
    );
  }, [parties, search]);

  const selectedParty = parties.find(
    (p) => p.name.toLowerCase() === value.toLowerCase() || p.id === value
  );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-8 pl-3 pr-8 text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 focus:ring-2 focus:ring-indigo-500 outline-none flex items-center justify-between text-slate-800 transition-all cursor-pointer text-left shadow-2xs"
      >
        <span className={`truncate ${selectedParty ? "text-slate-900 font-extrabold" : "text-slate-400 font-medium"}`}>
          {selectedParty ? selectedParty.name : placeholder}
        </span>
        <div className="absolute right-2.5 flex items-center gap-1">
          {value ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="text-slate-400 hover:text-slate-700 p-0.5 rounded-full hover:bg-slate-100"
            >
              <X className="size-3.5" />
            </span>
          ) : (
            <ChevronDown className="size-3.5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Search Popover Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 top-full mt-1.5 w-72 max-w-[90vw] bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden flex flex-col"
          >
            {/* Search Input Box */}
            <div className="p-2 border-b border-slate-100 bg-slate-50/80">
              <div className="relative flex items-center">
                <Search className="absolute left-2.5 size-3.5 text-slate-400 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type name, phone, GSTIN..."
                  className="w-full h-8 pl-8 pr-2.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400 text-slate-800 font-medium"
                />
              </div>
            </div>

            {/* List of Parties */}
            <div className="max-h-60 overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
              {filteredParties.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No parties matching "{search}"
                </div>
              ) : (
                filteredParties.map((p) => {
                  const isSelected = selectedParty?.name.toLowerCase() === p.name.toLowerCase();
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        onChange(p.name);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-indigo-50 text-indigo-900 font-bold"
                          : "hover:bg-slate-100 text-slate-700"
                      }`}
                    >
                      <div className="truncate pr-2">
                        <div className="font-bold text-slate-900 truncate">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-medium flex items-center gap-2">
                          {p.phone !== "—" && <span>📞 {p.phone}</span>}
                          {p.category && <span>• {p.category}</span>}
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 className="size-3.5 text-indigo-600 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function CustomerPartyReportsSuite({
  defaultReport = "party_statement",
}: {
  defaultReport?: CustomerReportType;
}) {
  const { tenant } = useTenant();
  const currentTenantId = (tenant as any)?.raw?.tenant_id || (tenant as any)?.tenant_id || tenant?.id || "default";
  const currentCompanyId = tenant?.id || (tenant as any)?.raw?.id || (tenant as any)?.company_id || "default";
  const { formatCurrency } = useCurrency();

  const [activeReport, setActiveReport] = useState<CustomerReportType>(defaultReport);
  const [isFavourite, setIsFavourite] = useState<boolean>(false);
  const [showExcelDropdown, setShowExcelDropdown] = useState<boolean>(false);

  // Sync prop changes
  useEffect(() => {
    if (defaultReport) {
      setActiveReport(defaultReport);
    }
  }, [defaultReport]);

  // Common Filters
  const [dateFilter, setDateFilter] = useState<string>("all");
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
        // 0. Clean up any ghost OPN- invoices from localStorage caches
        syncLocalStorageCustomerInvoices();

        // 1. Fetch live CRM customers, live products, POS and live SQL Invoices
        const [crmRes, invRes, posRes, sqlInvoicesRes] = await Promise.allSettled([
          crmCustomersApi.list(1, 200),
          inventoryApi.getProducts({ page_size: 500 }),
          posApi.getProducts({ limit: 500 }),
          invoicesApi.listInvoices({ page_size: 500 }),
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

        // 3. Fetch all saved invoices from localStorage & backend APIs
        const allInvoicesMap = new Map<string, any>();

        if (sqlInvoicesRes.status === "fulfilled" && sqlInvoicesRes.value) {
          const sVal: any = sqlInvoicesRes.value;
          const sqlInvoices = Array.isArray(sVal) ? sVal : sVal.items || sVal.data || [];
          sqlInvoices.forEach((inv: any) => {
            const numKey = String(inv.invoice_number || inv.receipt_number || inv.id || "").trim().toUpperCase();
            const isOpn = numKey.startsWith("OPN-") || inv.is_opening_balance || inv.invoice_type === "opening_balance";
            if (isOpn) return;
            if (numKey) {
              allInvoicesMap.set(numKey, {
                ...inv,
                customer_name: inv.customer_name || inv.customer?.name || inv.party_name || "Client",
                items: inv.lines || inv.items || [],
                grand_total: Number(inv.total_amount || inv.grand_total || 0),
                invoice_date: inv.invoice_date || inv.created_at,
              });
            }
          });
        }

        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.startsWith("pos_saved_invoices") || k.startsWith("pos_offline_invoices"))) {
              const item = localStorage.getItem(k);
              if (item) {
                try {
                  const parsed = JSON.parse(item);
                  if (Array.isArray(parsed)) {
                    parsed.forEach((inv: any) => {
                      const numKey = String(inv.invoice_number || inv.receipt_number || inv.id || "").trim().toUpperCase();
                      const isOpn = numKey.startsWith("OPN-") || inv.is_opening_balance || inv.invoice_type === "opening_balance";
                      if (isOpn) return;
                      if (numKey && !allInvoicesMap.has(numKey)) {
                        allInvoicesMap.set(numKey, {
                          ...inv,
                          items: inv.lines || inv.items || [],
                          grand_total: Number(inv.total_amount || inv.grand_total || 0),
                          invoice_date: inv.invoice_date || inv.created_at,
                        });
                      }
                    });
                  }
                } catch (e) {}
              }
            }
          }
        } catch (e) {}

        const combinedInvoices = Array.from(allInvoicesMap.values());
        setRawInvoices(combinedInvoices);

        // 4. Construct live real parties directory from CRM + Invoice database
        const partyMap = new Map<string, PartyRecord>();

        // Populate from CRM Customers in DB
        dbCustomers.forEach((c: any) => {
          const name = (c.name || c.company_name || c.contact_name || "").trim();
          if (name) {
            const key = name.toLowerCase();
            const opBal = Number(c.opening_balance || 0);
            partyMap.set(key, {
              id: c.id || `crm_${key}`,
              name: name,
              category: c.customer_type || c.category || "Regular Customer",
              phone: c.phone || c.mobile || "—",
              email: c.email || "",
              gstin: c.gstin || "",
              address: c.address || c.city || "",
              closingBalance: opBal,
              openingBalance: opBal,
              type: "Customer",
              creditLimit: Number(c.credit_limit || 0),
              totalInvoiced: 0,
              totalPaid: 0,
              dueTomorrow: 0,
              upcomingDue: 0,
              overdue1_15: 0,
              overdue16_30: 0,
              overdue30Plus: 0,
            });
          }
        });

        // Populate parties and calculate aggregations from all invoices
        const now = new Date();
        combinedInvoices.forEach((inv: any) => {
          const rawStatus = String(inv.status || inv.payment_status || "").toLowerCase();
          if (rawStatus === "cancelled" || rawStatus === "voided") return;

          const name = (inv.customer_name || inv.party_name || inv.customer?.name || inv.billing_to || "").trim();
          if (name && name.toLowerCase() !== "cash" && name.toLowerCase() !== "cash customer") {
            const key = name.toLowerCase();
            const phone = inv.customer_phone || inv.party_phone || inv.customer?.phone || inv.phone || "";
            const gstin = inv.customer_gstin || inv.gstin || inv.customer?.gstin || inv.party_gstin || "";
            const total = Number(inv.grand_total || inv.total_amount || 0);

            // Check if opening pseudo-invoice
            const isOpn = String(inv.invoice_number || "").toUpperCase().startsWith("OPN-") || inv.is_opening_balance || inv.invoice_type === "opening_balance";
            if (isOpn) {
              // Ignore opening ghost invoices completely
              return;
            }

            const isPaid = rawStatus === "paid" || (Number(inv.amount_received || inv.amount_paid || 0) >= total - 0.05 && total > 0);
            const balance = isPaid ? 0 : Number(inv.balance ?? inv.balance_due ?? inv.pending_amount ?? (total - Number(inv.amount_received || inv.amount_paid || 0)));
            const paid = isPaid ? total : Math.min(total, Number(inv.amount_received || inv.amount_paid || 0));

            if (partyMap.has(key)) {
              const p = partyMap.get(key)!;
              p.closingBalance += balance;
              p.totalInvoiced = (p.totalInvoiced || 0) + total;
              p.totalPaid = (p.totalPaid || 0) + paid;
              p.overdue30Plus = (p.overdue30Plus || 0) + balance;
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
                dueTomorrow: 0,
                upcomingDue: 0,
                overdue1_15: 0,
                overdue16_30: 0,
                overdue30Plus: balance,
              });
            }
          }
        });

        // Deduplicate party balances if openingBalance was mirrored from billed invoices
        partyMap.forEach((p) => {
          const totInv = Number(p.totalInvoiced || 0);
          const opBal = Number(p.openingBalance || 0);
          if (totInv > 0 && opBal > 0) {
            const unbilledOpening = Math.max(0, opBal - totInv);
            p.closingBalance = (p.closingBalance - opBal) + unbilledOpening;
            p.openingBalance = unbilledOpening;
          }
        });

        // Authoritative reconciliation: If customer record in CRM has balance explicitly settled to 0
        dbCustomers.forEach((c: any) => {
          const name = (c.name || c.company_name || c.contact_name || "").trim().toLowerCase();
          if (name && partyMap.has(name)) {
            const p = partyMap.get(name)!;
            if (c.outstanding_balance !== undefined && c.outstanding_balance !== null) {
              const explicitBal = Number(c.outstanding_balance);
              if (explicitBal <= 0.01) {
                p.closingBalance = 0;
                p.overdue30Plus = 0;
                p.overdue1_15 = 0;
                p.overdue16_30 = 0;
                p.upcomingDue = 0;
                p.dueTomorrow = 0;
              }
            }
          }
        });

        const list = Array.from(partyMap.values());
        setParties(list);
        if (list.length > 0 && !selectedPartyId && activeReport === "party_statement") {
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
    const ts = parseSafeDateTimestamp(dateStr);
    if (!ts) return true;
    const d = new Date(ts);
    const now = new Date();

    if (dateFilter === "today") {
      return d.toDateString() === now.toDateString();
    }
    if (dateFilter === "this_week") {
      const weekStart = new Date(now);
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      weekStart.setDate(diff);
      weekStart.setHours(0, 0, 0, 0);
      return ts >= weekStart.getTime();
    }
    if (dateFilter === "this_month") {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    if (dateFilter === "this_quarter") {
      return d.getFullYear() === now.getFullYear() && Math.floor(d.getMonth() / 3) === Math.floor(now.getMonth() / 3);
    }
    if (dateFilter === "this_year") {
      const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const fyStart = new Date(fyStartYear, 3, 1).getTime();
      const fyEnd = new Date(fyStartYear + 1, 2, 31, 23, 59, 59).getTime();
      return ts >= fyStart && ts <= fyEnd;
    }
    if (dateFilter === "custom") {
      if (customStartDate) {
        const sTs = parseSafeDateTimestamp(customStartDate);
        if (sTs && ts < sTs) return false;
      }
      if (customEndDate) {
        const eTs = parseSafeDateTimestamp(customEndDate);
        if (eTs && ts > eTs + 86400000 - 1) return false;
      }
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
    const matchedInvoices = rawInvoices
      .filter((inv: any) => {
        const isOpn = String(inv.invoice_number || "").toUpperCase().startsWith("OPN-") || inv.is_opening_balance || inv.invoice_type === "opening_balance";
        if (isOpn) return false;
        const name = (inv.party_name || inv.customer_name || "").toLowerCase();
        return name === pName && isDateInFilter(inv.created_at || inv.date);
      })
      .sort((a: any, b: any) => {
        const ta = parseSafeDateTimestamp(a.created_at || a.date) || 0;
        const tb = parseSafeDateTimestamp(b.created_at || b.date) || 0;
        return ta - tb;
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
      const invNo = inv.invoice_number || inv.invoice_no || `INV-${1000 + idx}`;
      const total = Number(inv.total_amount || inv.grand_total || 0);
      const received = Number(inv.received_amount || inv.paid_amount || (inv.status === "paid" ? total : 0));
      const mode = inv.payment_mode || inv.mode || "Cash / UPI";
      const dueDate = inv.due_date ? formatDisplayDate(inv.due_date) : "Immediate";

      const isCreditNote = Boolean(
        inv.is_credit_note ||
        inv.is_sales_return ||
        inv.document_type === "CREDIT_NOTE" ||
        String(inv.invoice_number || "").startsWith("CN")
      );

      if (isCreditNote) {
        // Credit note / sales return reduces balance (Credit entry)
        runningBalance -= total;
        rows.push({
          date: invDate,
          voucher: `Sales Return / Credit Note #${invNo}`,
          srNo: `CN-${101 + idx}`,
          paymentMode: mode,
          credit: total,
          debit: 0,
          balance: runningBalance,
          dueDate: "—",
        });
      } else {
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

  const outstandingTotals = useMemo(() => {
    let toCollect = 0;
    let toPay = 0;
    parties.forEach((p) => {
      if (p.closingBalance > 0) toCollect += p.closingBalance;
      if (p.closingBalance < 0) toPay += Math.abs(p.closingBalance);
    });
    return { toCollect, toPay };
  }, [parties]);

  const partyCategories = useMemo(() => {
    const set = new Set<string>();
    parties.forEach((p) => {
      if (p.category && p.category !== "Regular Customer" && p.category !== "Client") {
        set.add(p.category);
      }
    });
    return Array.from(set);
  }, [parties]);

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

  // Unique product categories for filter
  const productCategories = useMemo(() => {
    const set = new Set<string>();
    productsList.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [productsList]);

  // ─────────────────────────────────────────────────────────────
  // 4. ITEM REPORT BY PARTY COMPUTATION
  // ─────────────────────────────────────────────────────────────
  const itemReportByPartyData = useMemo(() => {
    if (!selectedPartyId) {
      return {
        partyName: "",
        rows: [],
        totSalesQty: 0,
        totSalesAmt: 0,
        totPurQty: 0,
        totPurAmt: 0,
      };
    }

    const selectedPartyObj = parties.find(
      (p) => p.name.toLowerCase() === selectedPartyId.toLowerCase() || p.id === selectedPartyId
    );
    const targetPartyName = selectedPartyObj?.name || selectedPartyId;

    if (!targetPartyName) {
      return {
        partyName: "",
        rows: [],
        totSalesQty: 0,
        totSalesAmt: 0,
        totPurQty: 0,
        totPurAmt: 0,
      };
    }

    const itemMap = new Map<
      string,
      {
        itemId: string;
        itemName: string;
        itemCode: string;
        category: string;
        salesQty: number;
        salesAmount: number;
        purchaseQty: number;
        purchaseAmount: number;
      }
    >();

    rawInvoices.forEach((inv: any) => {
      const party = (inv.customer_name || inv.party_name || inv.customer?.name || inv.billing_to || "").trim();
      const phone = (inv.customer_phone || inv.party_phone || inv.customer?.phone || inv.phone || "").trim();

      const isMatch =
        party.toLowerCase() === targetPartyName.toLowerCase() ||
        (selectedPartyObj?.phone && selectedPartyObj.phone !== "—" && phone && phone === selectedPartyObj.phone);

      if (!isMatch) return;

      const invDate = inv.invoice_date || inv.created_at || inv.date;
      if (!isDateInFilter(invDate)) return;

      const items = Array.isArray(inv.items) && inv.items.length > 0 ? inv.items : (Array.isArray(inv.lines) ? inv.lines : []);
      items.forEach((it: any) => {
        const itName = it.name || it.product_name || it.item_name || "Item";
        const itCode = it.sku || it.item_code || it.code || it.product_sku || it.hsn_code || "—";
        const itCat =
          it.category ||
          productsList.find((p) => p.name === itName || p.id === it.product_id)?.category ||
          "General";

        if (selectedCategory !== "all" && itCat.toLowerCase() !== selectedCategory.toLowerCase()) {
          return;
        }

        const key = `${itName}__${itCode}`.toLowerCase();
        if (!itemMap.has(key)) {
          itemMap.set(key, {
            itemId: String(it.id || it.product_id || key),
            itemName: itName,
            itemCode: itCode,
            category: itCat,
            salesQty: 0,
            salesAmount: 0,
            purchaseQty: 0,
            purchaseAmount: 0,
          });
        }

        const entry = itemMap.get(key)!;
        const isPurchase =
          inv.type === "purchase" ||
          inv.invoice_type === "purchase_bill" ||
          inv.is_purchase ||
          inv.type === "grn";
        const qty = Number(it.quantity || it.qty || 1);
        const amt = Number(it.total || it.amount || qty * Number(it.unit_price || it.price || 0));

        if (isPurchase) {
          entry.purchaseQty += qty;
          entry.purchaseAmount += amt;
        } else {
          entry.salesQty += qty;
          entry.salesAmount += amt;
        }
      });
    });

    const rows = Array.from(itemMap.values());
    let totSalesQty = 0;
    let totSalesAmt = 0;
    let totPurQty = 0;
    let totPurAmt = 0;

    rows.forEach((r) => {
      totSalesQty += r.salesQty;
      totSalesAmt += r.salesAmount;
      totPurQty += r.purchaseQty;
      totPurAmt += r.purchaseAmount;
    });

    return {
      partyName: targetPartyName,
      rows,
      totSalesQty,
      totSalesAmt,
      totPurQty,
      totPurAmt,
    };
  }, [selectedPartyId, parties, rawInvoices, dateFilter, customStartDate, customEndDate, selectedCategory, productsList]);

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

  // ── Export Excel / CSV with Real DB Data ───────────────────
  const handleExportExcel = (format: "xlsx" | "csv" = "xlsx") => {
    let filename = `${activeReport}_${new Date().toISOString().slice(0, 10)}`;
    const rows: any[][] = [];

    switch (activeReport) {
      case "party_statement": {
        const partyName = activeParty?.name || "Party";
        filename = `party_statement_${partyName.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}`;
        rows.push([`Party Statement: ${partyName} (${activeParty?.phone || "No Phone"})`]);
        rows.push([`Total Sales: ₹${ledgerData.totalSales} | Total Received: ₹${ledgerData.totalReceived} | Balance Due: ₹${ledgerData.totalReceivable}`]);
        rows.push([]);
        rows.push(["Date", "Type", "Voucher No", "Debit (₹)", "Credit (₹)", "Running Balance (₹)", "Status"]);
        (ledgerData.rows || []).forEach((tx: any) => {
          rows.push([
            tx.date,
            tx.voucher || tx.type,
            tx.voucherNo || tx.srNo || "-",
            tx.debit > 0 ? Number(tx.debit.toFixed(2)) : "-",
            tx.credit > 0 ? Number(tx.credit.toFixed(2)) : "-",
            tx.balance !== undefined ? Number(tx.balance.toFixed(2)) : 0,
            tx.status || "-",
          ]);
        });
        break;
      }

      case "party_outstanding": {
        filename = `party_outstanding_${new Date().toISOString().slice(0, 10)}`;
        rows.push(["Party Name", "Phone", "GSTIN", "Address", "Category", "Pending Balance (₹)", "Credit Limit (₹)", "Type"]);
        let sumBal = 0;
        outstandingList.forEach((p) => {
          const bal = Number(p.closingBalance || 0);
          sumBal += bal;
          rows.push([
            p.name,
            p.phone || "-",
            p.gstin || "-",
            p.address || "-",
            p.category || "-",
            Number(bal.toFixed(2)),
            Number((p.creditLimit || 0).toFixed(2)),
            p.type || "Customer",
          ]);
        });
        rows.push(["Total", "", "", "", "", Number(sumBal.toFixed(2)), "", ""]);
        break;
      }

      case "party_ageing": {
        filename = `party_ageing_${new Date().toISOString().slice(0, 10)}`;
        rows.push([
          "Party Name",
          "By Tomorrow (₹)",
          "Upcoming (₹)",
          "Total Due (₹)",
          "1-15 Days (₹)",
          "16-30 Days (₹)",
          "30+ Days (₹)",
          "Total Overdue (₹)",
          "Total Amount (₹)",
        ]);
        ageingList.forEach((p) => {
          const tDue = (p.dueTomorrow || 0) + (p.upcomingDue || 0);
          const tOverdue = (p.overdue1_15 || 0) + (p.overdue16_30 || 0) + (p.overdue30Plus || p.closingBalance || 0);
          const amt = Math.max(p.closingBalance, tOverdue + tDue);
          rows.push([
            p.name,
            p.dueTomorrow ? Number(p.dueTomorrow.toFixed(2)) : "-",
            p.upcomingDue ? Number(p.upcomingDue.toFixed(2)) : "-",
            tDue > 0 ? Number(tDue.toFixed(2)) : "-",
            p.overdue1_15 ? Number(p.overdue1_15.toFixed(2)) : "-",
            p.overdue16_30 ? Number(p.overdue16_30.toFixed(2)) : "-",
            (p.overdue30Plus || p.closingBalance) ? Number((p.overdue30Plus || p.closingBalance).toFixed(2)) : "-",
            tOverdue > 0 ? Number(tOverdue.toFixed(2)) : "-",
            Number(amt.toFixed(2)),
          ]);
        });
        rows.push([
          "Total",
          Number(ageingTotals.totTomorrow.toFixed(2)),
          Number(ageingTotals.totUpcoming.toFixed(2)),
          Number(ageingTotals.totDue.toFixed(2)),
          Number(ageingTotals.tot1_15.toFixed(2)),
          Number(ageingTotals.tot16_30.toFixed(2)),
          Number(ageingTotals.tot30Plus.toFixed(2)),
          Number(ageingTotals.totOverdue.toFixed(2)),
          Number(ageingTotals.totAmount.toFixed(2)),
        ]);
        break;
      }

      case "party_item_report": {
        const targetParty = itemReportByPartyData.partyName || "Party";
        filename = `item_report_by_party_${targetParty.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}`;
        rows.push([`Item Report By Party: ${targetParty}`]);
        rows.push([]);
        rows.push(["Item Name", "Item Code", "Category", "Sales Qty", "Sales Amount (₹)", "Purchase Qty", "Purchase Amount (₹)"]);
        (itemReportByPartyData.rows || []).forEach((r: any) => {
          rows.push([
            r.itemName,
            r.itemCode,
            r.category,
            `${r.salesQty} PCS`,
            Number(r.salesAmount.toFixed(2)),
            `${r.purchaseQty} PCS`,
            Number(r.purchaseAmount.toFixed(2)),
          ]);
        });
        rows.push([
          "Total",
          "",
          "",
          `${itemReportByPartyData.totSalesQty} PCS`,
          Number(itemReportByPartyData.totSalesAmt.toFixed(2)),
          `${itemReportByPartyData.totPurQty} PCS`,
          Number(itemReportByPartyData.totPurAmt.toFixed(2)),
        ]);
        break;
      }

      case "customer_sales": {
        filename = `customer_sales_${new Date().toISOString().slice(0, 10)}`;
        rows.push(["Date", "Invoice No", "Party Name", "Phone", "Payment Mode", "Taxable (₹)", "Tax (₹)", "Total Amount (₹)", "Balance Due (₹)", "Status"]);
        let sumTot = 0;
        let sumBal = 0;
        let sumTaxable = 0;
        let sumTax = 0;
        customerSalesSummary.forEach((r: any) => {
          const tot = Number(r.amount || 0);
          const bal = Number(r.balance || 0);
          const taxable = Number(r.taxable || 0);
          const tax = Number(r.tax || 0);
          sumTot += tot;
          sumBal += bal;
          sumTaxable += taxable;
          sumTax += tax;
          rows.push([
            r.date,
            r.invoiceNo,
            r.partySale,
            r.phone,
            r.paymentMode,
            Number(taxable.toFixed(2)),
            Number(tax.toFixed(2)),
            Number(tot.toFixed(2)),
            Number(bal.toFixed(2)),
            r.invoiceStatus,
          ]);
        });
        rows.push(["Total", "", "", "", "", Number(sumTaxable.toFixed(2)), Number(sumTax.toFixed(2)), Number(sumTot.toFixed(2)), Number(sumBal.toFixed(2)), ""]);
        break;
      }

      default: {
        rows.push(["Party Name", "Phone", "Category", "Balance (₹)", "Credit Limit (₹)", "Type"]);
        parties.forEach((p: PartyRecord) => {
          rows.push([
            p.name,
            p.phone || "-",
            p.category || "-",
            Number((p.closingBalance || 0).toFixed(2)),
            Number((p.creditLimit || 0).toFixed(2)),
            p.type || "Customer",
          ]);
        });
        break;
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    const sheetName = (activeReport || "Report").slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    if (format === "xlsx") {
      XLSX.writeFile(wb, `${filename}.xlsx`);
      toast.success(`Exported ${activeReport.replace(/_/g, " ").toUpperCase()} as Excel (.xlsx)!`);
    } else {
      XLSX.writeFile(wb, `${filename}.csv`, { bookType: "csv" });
      toast.success(`Exported ${activeReport.replace(/_/g, " ").toUpperCase()} as CSV (.csv)!`);
    }
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
        {activeReport === "party_statement" ? (
          <div className="space-y-3.5">
            {/* Row 1: Back + Title + Favourite & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.history.back()}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-slate-700"
                  title="Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-base font-bold text-slate-900">Party Statement (Ledger)</h1>
                <button
                  onClick={() => {
                    setIsFavourite(!isFavourite);
                    toast.success(isFavourite ? "Removed from favourites" : "Added to favourites");
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                >
                  <Star className={`w-3.5 h-3.5 ${isFavourite ? "text-amber-500 fill-amber-500" : "text-slate-400"}`} />
                  <span>Favourite</span>
                </button>
              </div>

              {/* Action Buttons: WhatsApp, Email Excel, Download Excel ℹ ∨, Print PDF */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleShareWhatsApp}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WhatsApp</span>
                </button>

                <button
                  onClick={() => toast.success("Email with Party Statement queued successfully!")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Email Excel</span>
                </button>

                <div className="relative">
                  <button
                    onClick={() => setShowExcelDropdown(!showExcelDropdown)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    <span>Download Excel</span>
                    <Info className="w-3.5 h-3.5 text-slate-400" />
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  {showExcelDropdown && (
                    <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
                      <button
                        onClick={() => {
                          handleExportExcel("xlsx");
                          setShowExcelDropdown(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Download Excel (.xlsx)
                      </button>
                      <button
                        onClick={() => {
                          handleExportExcel("csv");
                          setShowExcelDropdown(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" /> Download CSV (.csv)
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handlePrintPDF}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-400" />
                  <span>Print PDF</span>
                </button>
              </div>
            </div>

            {/* Row 2: 4 Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center gap-2 text-slate-600">
                  <div className="size-6 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 font-semibold text-xs">
                    ₹
                  </div>
                  <span className="text-xs font-medium text-slate-600">Total Receivable Amount</span>
                </div>
                <div className="text-lg font-bold text-slate-900 mt-2 font-mono">
                  {ledgerData.totalReceivable > 0 ? formatCurrency(ledgerData.totalReceivable) : "₹ 0"}
                </div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center gap-2 text-amber-600">
                  <div className="size-6 rounded-full border border-amber-200 bg-amber-50/50 flex items-center justify-center text-amber-600 text-xs">
                    <Clock className="size-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-amber-600">Overdue Amount</span>
                </div>
                <div className="text-lg font-bold text-slate-900 mt-2 font-mono">
                  {ledgerData.overdue > 0 ? formatCurrency(ledgerData.overdue) : "₹ 0"}
                </div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center gap-2 text-slate-600">
                  <div className="size-6 rounded-full border border-blue-200 bg-blue-50/50 flex items-center justify-center text-blue-600 text-xs">
                    <TrendingUp className="size-3.5" />
                  </div>
                  <span className="text-xs font-medium text-blue-600">Total Sales Amount</span>
                </div>
                <div className="text-lg font-bold text-slate-900 mt-2 font-mono">
                  {ledgerData.totalSales > 0 ? formatCurrency(ledgerData.totalSales) : "₹ 0"}
                </div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center gap-2 text-slate-600">
                  <div className="size-6 rounded-full border border-emerald-200 bg-emerald-50/50 flex items-center justify-center text-emerald-600 text-xs">
                    <CheckCircle2 className="size-3.5" />
                  </div>
                  <span className="text-xs font-medium text-emerald-600">Total Received Amount</span>
                </div>
                <div className="text-lg font-bold text-slate-900 mt-2 font-mono">
                  {ledgerData.totalReceived > 0 ? formatCurrency(ledgerData.totalReceived) : "₹ 0"}
                </div>
              </div>
            </div>

            {/* Row 3: Search Party Combobox + Date Range Filter */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-3">
                <SearchablePartySelect
                  value={selectedPartyId}
                  onChange={setSelectedPartyId}
                  parties={parties}
                  placeholder="Search Party (e.g. A.RADHA)..."
                  className="w-64"
                />

                <div className="relative flex items-center">
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value as any)}
                    className="h-8 pl-3 pr-8 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer text-slate-700 appearance-none shadow-2xs"
                  >
                    <option value="today">Today</option>
                    <option value="this_week">This Week</option>
                    <option value="this_month">This Month</option>
                    <option value="this_quarter">This Quarter</option>
                    <option value="this_year">This Financial Year</option>
                    <option value="all">All Time</option>
                    <option value="custom">Custom Date</option>
                  </select>
                  <CalendarIcon className="absolute right-2.5 size-3.5 text-slate-400 pointer-events-none" />
                </div>

                {dateFilter === "custom" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="h-8 px-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 shadow-2xs"
                    />
                    <span className="text-xs text-slate-400 font-medium">to</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="h-8 px-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 shadow-2xs"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeReport === "party_outstanding" ? (
          <div>
            {/* Row 1: Back + Title + Favourite & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.history.back()}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-slate-700"
                  title="Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-base font-bold text-slate-900">Party Wise Outstanding</h1>
                <button
                  onClick={() => {
                    setIsFavourite(!isFavourite);
                    toast.success(isFavourite ? "Removed from favourites" : "Added to favourites");
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                >
                  <Star className={`w-3.5 h-3.5 ${isFavourite ? "text-amber-500 fill-amber-500" : "text-slate-400"}`} />
                  <span>Favourite</span>
                </button>
              </div>

              {/* Action Buttons: Email Excel, Download Excel ∨, Print PDF */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toast.success("Email with Party Wise Outstanding report queued successfully!")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  <span>Email Excel</span>
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <div className="relative">
                  <button
                    onClick={() => setShowExcelDropdown(!showExcelDropdown)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    <span>Download Excel</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  {showExcelDropdown && (
                    <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
                      <button
                        onClick={() => {
                          handleExportExcel("xlsx");
                          setShowExcelDropdown(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Download Excel (.xlsx)
                      </button>
                      <button
                        onClick={() => {
                          handleExportExcel("csv");
                          setShowExcelDropdown(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" /> Download CSV (.csv)
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handlePrintPDF}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  <span>Print PDF</span>
                  <Printer className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Row 2: Filter controls + Yellow banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-2.5 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative inline-flex items-center">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="h-8 pl-3 pr-8 text-xs font-medium rounded-xl border border-slate-200 bg-white hover:bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer appearance-none text-slate-700 shadow-2xs"
                  >
                    <option value="all">All Categories</option>
                    {partyCategories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {selectedCategory !== "all" ? (
                    <button
                      type="button"
                      onClick={() => setSelectedCategory("all")}
                      className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : (
                    <ChevronDown className="absolute right-2.5 size-3.5 text-slate-400 pointer-events-none" />
                  )}
                </div>

                <div className="relative flex items-center">
                  <CalendarIcon className="absolute left-2.5 size-3.5 text-slate-400 pointer-events-none" />
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value as any)}
                    className="h-8 pl-8 pr-7 text-xs font-medium rounded-xl border border-slate-200 bg-white hover:bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer appearance-none text-slate-700 shadow-2xs"
                  >
                    <option value="today">Today</option>
                    <option value="this_week">This Week</option>
                    <option value="this_month">This Month</option>
                    <option value="this_quarter">This Quarter</option>
                    <option value="this_year">This Financial Year</option>
                    <option value="all">All Time</option>
                  </select>
                  <ChevronDown className="absolute right-2 size-3 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Yellow notice matching reference ss1, ss2, ss3 */}
              <div className="bg-amber-50/80 border border-amber-200/60 rounded-lg px-3.5 py-1.5 text-xs text-amber-900 font-medium">
                GSTIN, Address, along with Custom Fields, can be viewed in the Excel report
              </div>
            </div>

            {/* Row 3: Tabs matching ss1, ss2, ss3 */}
            <div className="flex items-center gap-0 mt-3 border-b border-slate-200">
              <button
                onClick={() => setOutstandingTab("all")}
                className={`px-6 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                  outstandingTab === "all"
                    ? "border-indigo-600 text-indigo-700 bg-indigo-50/20"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                All
              </button>

              <button
                onClick={() => setOutstandingTab("to_collect")}
                className={`px-6 py-1.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex flex-col items-center ${
                  outstandingTab === "to_collect"
                    ? "border-emerald-600 text-emerald-700 bg-emerald-50/30"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>To Collect</span>
                <span className="text-[11px] font-mono font-bold text-emerald-600 mt-0.5">
                  {formatCurrency(outstandingTotals.toCollect)}
                </span>
              </button>

              <button
                onClick={() => setOutstandingTab("to_pay")}
                className={`px-6 py-1.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex flex-col items-center ${
                  outstandingTab === "to_pay"
                    ? "border-rose-600 text-rose-700 bg-rose-50/30"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>To Pay</span>
                <span className="text-[11px] font-mono font-bold text-rose-600 mt-0.5">
                  {outstandingTotals.toPay > 0 ? `- ${formatCurrency(outstandingTotals.toPay)}` : formatCurrency(0)}
                </span>
              </button>
            </div>
          </div>
        ) : activeReport === "party_ageing" ? (
          <div>
            {/* Row 1: Back + Title + Favourite & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.history.back()}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-slate-700"
                  title="Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-base font-bold text-slate-900">Ageing Report</h1>
                <button
                  onClick={() => {
                    setIsFavourite(!isFavourite);
                    toast.success(isFavourite ? "Removed from favourites" : "Added to favourites");
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                >
                  <Star className={`w-3.5 h-3.5 ${isFavourite ? "text-amber-500 fill-amber-500" : "text-slate-400"}`} />
                  <span>Favourite</span>
                </button>
              </div>

              {/* Action Buttons: Email Excel, Download Excel ∨, Print PDF */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toast.success("Email with Ageing Report queued successfully!")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Email Excel</span>
                </button>

                <div className="relative">
                  <button
                    onClick={() => setShowExcelDropdown(!showExcelDropdown)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    <span>Download Excel</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  {showExcelDropdown && (
                    <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
                      <button
                        onClick={() => {
                          handleExportExcel("xlsx");
                          setShowExcelDropdown(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Download Excel (.xlsx)
                      </button>
                      <button
                        onClick={() => {
                          handleExportExcel("csv");
                          setShowExcelDropdown(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" /> Download CSV (.csv)
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handlePrintPDF}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-400" />
                  <span>Print PDF</span>
                </button>
              </div>
            </div>

            {/* Row 2: Search input */}
            <div className="pt-3 mt-2.5 border-t border-slate-100">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by party name"
                  value={searchParty}
                  onChange={(e) => setSearchParty(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-400 text-slate-800 font-medium"
                />
                {searchParty && (
                  <button onClick={() => setSearchParty("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : activeReport === "customer_sales" ? (
          <div>
            {/* Row 1: Back + Title + Favourite & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.history.back()}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-slate-700"
                  title="Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-base font-bold text-slate-900">Sales Summary - Category Wise</h1>
                <button
                  onClick={() => {
                    setIsFavourite(!isFavourite);
                    toast.success(isFavourite ? "Removed from favourites" : "Added to favourites");
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                >
                  <Star className={`w-3.5 h-3.5 ${isFavourite ? "text-amber-500 fill-amber-500" : "text-slate-400"}`} />
                  <span>Favourite</span>
                </button>
              </div>

              {/* Action Buttons: Email Excel, Download Excel ∨, Print PDF */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toast.success("Email with Sales Summary - Category Wise queued successfully!")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  <span>Email Excel</span>
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <div className="relative">
                  <button
                    onClick={() => setShowExcelDropdown(!showExcelDropdown)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    <span>Download Excel</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  {showExcelDropdown && (
                    <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
                      <button
                        onClick={() => {
                          handleExportExcel("xlsx");
                          setShowExcelDropdown(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Download Excel (.xlsx)
                      </button>
                      <button
                        onClick={() => {
                          handleExportExcel("csv");
                          setShowExcelDropdown(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" /> Download CSV (.csv)
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handlePrintPDF}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  <span>Print PDF</span>
                  <Printer className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Row 2: Date Selector + Search bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-2.5 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex items-center">
                  <CalendarIcon className="absolute left-2.5 size-3.5 text-slate-400 pointer-events-none" />
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value as any)}
                    className="h-8 pl-8 pr-7 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer text-slate-700 appearance-none shadow-2xs"
                  >
                    <option value="today">Today</option>
                    <option value="this_week">This Week</option>
                    <option value="this_month">This Month</option>
                    <option value="this_quarter">This Quarter</option>
                    <option value="this_year">This Financial Year</option>
                    <option value="all">All Time</option>
                    <option value="custom">Custom Date</option>
                  </select>
                  <ChevronDown className="absolute right-2 size-3 text-slate-400 pointer-events-none" />
                </div>

                {dateFilter === "custom" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="h-8 px-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 shadow-2xs"
                    />
                    <span className="text-xs text-slate-400 font-medium">to</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="h-8 px-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 shadow-2xs"
                    />
                  </div>
                )}
              </div>

              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search invoice, customer..."
                  value={searchParty}
                  onChange={(e) => setSearchParty(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                {searchParty && (
                  <button onClick={() => setSearchParty("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Title & Description */}
              <div>
                <h1 className="text-base font-extrabold text-slate-900">{currentMeta.name}</h1>
                <p className="text-xs text-slate-500 mt-0.5">{currentMeta.description}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportExcel("xlsx")}
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
                {/* Category selector */}
                <div className="relative inline-flex items-center">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="h-8 pl-3 pr-8 text-xs font-bold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer appearance-none text-slate-800"
                  >
                    <option value="all">All Categories</option>
                    {productCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  {selectedCategory !== "all" ? (
                    <button
                      type="button"
                      onClick={() => setSelectedCategory("all")}
                      className="absolute right-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : (
                    <ChevronDown className="absolute right-2.5 size-3.5 text-slate-400 pointer-events-none" />
                  )}
                </div>

                {/* Searchable Party selector */}
                <SearchablePartySelect
                  value={selectedPartyId}
                  onChange={setSelectedPartyId}
                  parties={parties}
                  placeholder="Search Party (e.g. nagi)..."
                  className="w-64"
                />

                {/* Date range selector */}
                <div className="relative inline-flex items-center">
                  <CalendarIcon className="absolute left-2.5 size-3.5 text-slate-400 pointer-events-none" />
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value as any)}
                    className="h-8 pl-8 pr-7 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer appearance-none text-slate-800"
                  >
                    <option value="this_week">This Week</option>
                    <option value="today">Today</option>
                    <option value="this_month">This Month</option>
                    <option value="this_quarter">This Quarter</option>
                    <option value="this_year">This Financial Year</option>
                    <option value="all">All Time</option>
                  </select>
                  <ChevronDown className="absolute right-2 size-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Search bar */}
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
            </div>
          </div>
        )}
      </header>

      {/* Scrollable Report Content */}
      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
            <p className="text-sm font-bold text-slate-700">Loading party records...</p>
            <p className="text-xs text-slate-400 mt-1">Fetching parties and invoices from database</p>
          </div>
        ) : (
          <>
            {activeReport === "party_statement" && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-semibold text-xs">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Date</th>
                        <th className="py-3 px-4 font-semibold">Voucher</th>
                        <th className="py-3 px-4 font-semibold">Sr No</th>
                        <th className="py-3 px-4 font-semibold">Payment Mode</th>
                        <th className="py-3 px-4 text-right font-semibold">Credit</th>
                        <th className="py-3 px-4 text-right font-semibold">Debit</th>
                        <th className="py-3 px-4 text-right font-semibold">Balance</th>
                        <th className="py-3 px-4 font-semibold">Due Date (Overdue by)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                      {ledgerData.rows.map((r: any, idx: number) => {
                        const isOpening = r.voucher === "Opening Balance";
                        const isClosing = r.voucher === "Closing Balance";

                        return (
                          <tr
                            key={idx}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              r.isSummaryRow ? "bg-slate-50/30 text-slate-900" : ""
                            }`}
                          >
                            <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono">
                              {r.date === "—" ? "-" : r.date}
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-900">
                              {r.voucher}
                            </td>
                            <td className="py-3 px-4 text-slate-500 font-mono text-xs">
                              {r.srNo === "—" ? "-" : r.srNo}
                            </td>
                            <td className="py-3 px-4 text-slate-500">
                              {r.paymentMode === "—" ? "-" : r.paymentMode}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-medium text-slate-700">
                              {r.credit > 0 ? formatCurrency(r.credit) : "-"}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-medium text-slate-700">
                              {isOpening || isClosing
                                ? (r.debit > 0 ? formatCurrency(r.debit) : "₹ 0")
                                : (r.debit > 0 ? formatCurrency(r.debit) : "-")}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                              {isClosing
                                ? "-"
                                : (isOpening && r.balance === 0
                                  ? "₹ 0"
                                  : formatCurrency(r.balance))}
                            </td>
                            <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                              {r.dueDate === "—" || !r.dueDate ? "-" : r.dueDate}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

        {activeReport === "party_outstanding" && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">NAME</th>
                  <th className="py-3 px-5">CATEGORY</th>
                  <th className="py-3 px-5">CONTACT NUMBER</th>
                  <th className="py-3 px-5 text-right">CLOSING BALANCE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {outstandingList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-16 text-center text-slate-400 text-xs font-semibold">
                      No parties found for this filter
                    </td>
                  </tr>
                ) : (
                  outstandingList.map((p, idx) => {
                    const isPositive = p.closingBalance > 0;
                    const isNegative = p.closingBalance < 0;
                    const catStr = p.category && p.category !== "Regular Customer" && p.category !== "Client" ? p.category : "-";
                    const phoneStr = p.phone && p.phone !== "—" ? p.phone : "-";

                    let balDisplay = "-";
                    if (isPositive) {
                      balDisplay = formatCurrency(p.closingBalance);
                    } else if (isNegative) {
                      balDisplay = `- ${formatCurrency(Math.abs(p.closingBalance))}`;
                    }

                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-5 font-bold text-slate-900">{p.name}</td>
                        <td className="py-3 px-5 text-slate-500 font-mono text-xs">{catStr}</td>
                        <td className="py-3 px-5 text-slate-600 font-mono">{phoneStr}</td>
                        <td
                          className={`py-3 px-5 text-right font-mono font-bold ${
                            isPositive
                              ? "text-slate-900"
                              : isNegative
                              ? "text-rose-600"
                              : "text-slate-400"
                          }`}
                        >
                          {balDisplay}
                        </td>
                      </tr>
                    );
                  })
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
                  <tr className="border-b border-slate-200 text-xs font-bold">
                    <th rowSpan={2} className="py-2.5 px-4 bg-slate-50 text-slate-800 align-middle border-r border-slate-200">
                      Party Name
                    </th>
                    <th
                      colSpan={3}
                      className="py-1.5 px-3 text-center bg-amber-50/70 text-slate-800 border-r border-slate-200 font-bold"
                    >
                      Not yet due
                    </th>
                    <th
                      colSpan={5}
                      className="py-1.5 px-3 text-center bg-rose-50/70 text-slate-800 font-bold"
                    >
                      Overdue
                    </th>
                  </tr>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50/50">
                    <th className="py-2 px-3 text-right">By Tomorrow</th>
                    <th className="py-2 px-3 text-right">Upcoming</th>
                    <th className="py-2 px-3 text-right border-r border-slate-200 font-semibold text-slate-800">
                      T. Due
                    </th>
                    <th className="py-2 px-3 text-right">1-15 Days</th>
                    <th className="py-2 px-3 text-right">16-30 Days</th>
                    <th className="py-2 px-3 text-right">30+ Days</th>
                    <th className="py-2 px-3 text-right font-semibold text-slate-800">
                      T. Overdue
                    </th>
                    <th className="py-2 px-4 text-right font-semibold text-slate-800">
                      T. Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                  {ageingList.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        No ageing records found
                      </td>
                    </tr>
                  ) : (
                    ageingList.map((p, idx) => {
                      const tDue = (p.dueTomorrow || 0) + (p.upcomingDue || 0);
                      const tOverdue = (p.overdue1_15 || 0) + (p.overdue16_30 || 0) + (p.overdue30Plus || p.closingBalance || 0);
                      const tAmt = Math.max(p.closingBalance, tDue + tOverdue);

                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-slate-900 whitespace-nowrap border-r border-slate-100">{p.name}</td>
                          <td className="py-2.5 px-3 text-right text-slate-600">
                            {p.dueTomorrow ? formatCurrency(p.dueTomorrow) : "-"}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600">
                            {p.upcomingDue ? formatCurrency(p.upcomingDue) : "-"}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-700 border-r border-slate-100">
                            {tDue > 0 ? formatCurrency(tDue) : "-"}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600">
                            {p.overdue1_15 ? formatCurrency(p.overdue1_15) : "-"}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600">
                            {p.overdue16_30 ? formatCurrency(p.overdue16_30) : "-"}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-700">
                            {p.overdue30Plus || p.closingBalance ? formatCurrency(p.overdue30Plus || p.closingBalance) : "-"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-slate-800">
                            {tOverdue > 0 ? formatCurrency(tOverdue) : "-"}
                          </td>
                          <td className="py-2.5 px-4 text-right font-medium text-slate-900">
                            {tAmt > 0 ? formatCurrency(tAmt) : "-"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-900 text-xs">
                  <tr>
                    <td className="py-3 px-4 border-r border-slate-200">Total</td>
                    <td className="py-3 px-3 text-right">{formatCurrency(ageingTotals.totTomorrow)}</td>
                    <td className="py-3 px-3 text-right">{formatCurrency(ageingTotals.totUpcoming)}</td>
                    <td className="py-3 px-3 text-right border-r border-slate-200">
                      {formatCurrency(ageingTotals.totDue)}
                    </td>
                    <td className="py-3 px-3 text-right">{formatCurrency(ageingTotals.tot1_15)}</td>
                    <td className="py-3 px-3 text-right">{formatCurrency(ageingTotals.tot16_30)}</td>
                    <td className="py-3 px-3 text-right">{formatCurrency(ageingTotals.tot30Plus)}</td>
                    <td className="py-3 px-3 text-right">
                      {formatCurrency(ageingTotals.totOverdue)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {formatCurrency(ageingTotals.totAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {activeReport === "party_item_report" && (
          <div className="space-y-3">
            {/* Sub-banner: Party Name */}
            {itemReportByPartyData.partyName && (
              <div className="bg-white px-4 py-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700">Party Name:</span>
                <span className="text-xs font-extrabold text-emerald-600 uppercase tracking-wide">
                  {itemReportByPartyData.partyName}
                </span>
              </div>
            )}

            {/* Table or Empty State */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10.5px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">ITEM NAME</th>
                      <th className="py-3 px-4">ITEM CODE</th>
                      <th className="py-3 px-4 text-right">SALES QUANTITY</th>
                      <th className="py-3 px-4 text-right">SALES AMOUNT</th>
                      <th className="py-3 px-4 text-right">PURCHASE QUANTITY</th>
                      <th className="py-3 px-4 text-right">PURCHASE AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                    {itemReportByPartyData.rows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-24 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <div className="size-16 rounded-full bg-slate-50 border border-slate-200/90 flex items-center justify-center text-slate-400 mb-3 shadow-2xs">
                              <Search className="size-7 text-slate-300 stroke-[1.5]" />
                            </div>
                            <p className="text-sm font-semibold text-slate-600">
                              {!selectedPartyId
                                ? "Select a party from the toolbar above to view item transactions"
                                : "No transactions available for selected party"}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      itemReportByPartyData.rows.map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">{r.itemName}</td>
                          <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{r.itemCode}</td>
                          <td className="py-3 px-4 text-right font-semibold">
                            {r.salesQty > 0 ? `${r.salesQty} PCS` : "0 PCS"}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            {formatCurrency(r.salesAmount)}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold">
                            {r.purchaseQty > 0 ? `${r.purchaseQty} PCS` : "0 PCS"}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            {formatCurrency(r.purchaseAmount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {itemReportByPartyData.rows.length > 0 && (
                    <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-900 text-xs">
                      <tr>
                        <td className="py-3 px-4 font-extrabold">Total</td>
                        <td className="py-3 px-4 text-slate-400">—</td>
                        <td className="py-3 px-4 text-right font-extrabold">
                          {itemReportByPartyData.totSalesQty} PCS
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-indigo-700">
                          {formatCurrency(itemReportByPartyData.totSalesAmt)}
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold">
                          {itemReportByPartyData.totPurQty} PCS
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-indigo-700">
                          {formatCurrency(itemReportByPartyData.totPurAmt)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        )}

        {activeReport === "customer_sales" && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10.5px] tracking-wider">
                  <tr>
                    <th className="py-3 px-3.5">DATE</th>
                    <th className="py-3 px-3.5">INVOICE NO</th>
                    <th className="py-3 px-3.5">PARTY SALE</th>
                    <th className="py-3 px-3.5">CREATED BY</th>
                    <th className="py-3 px-3.5">DUE DATE</th>
                    <th className="py-3 px-3.5 text-right">AMOUNT</th>
                    <th className="py-3 px-3.5 text-right">BALANCE</th>
                    <th className="py-3 px-3.5">INVOICE TYPE</th>
                    <th className="py-3 px-3.5">INVOICE STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                  {customerSalesSummary.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-24 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="size-20 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-300 mb-4 shadow-2xs">
                            <FileText className="size-10 stroke-[1.5] text-slate-400" />
                          </div>
                          <p className="text-sm font-semibold text-slate-500">
                            No transaction between selected dates
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    customerSalesSummary.map((s: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3.5 whitespace-nowrap text-slate-500 font-mono text-xs">{s.date}</td>
                        <td className="py-3 px-3.5 font-bold text-slate-900 font-mono text-xs">{s.invoiceNo}</td>
                        <td className="py-3 px-3.5 font-bold text-slate-900">{s.partySale}</td>
                        <td className="py-3 px-3.5 text-slate-600 text-xs">{s.createdBy || "Admin"}</td>
                        <td className="py-3 px-3.5 text-slate-500 font-mono text-xs whitespace-nowrap">{s.dueDate}</td>
                        <td className="py-3 px-3.5 text-right font-bold text-slate-900 font-mono">
                          {formatCurrency(s.amount)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-bold text-rose-600 font-mono">
                          {s.balance > 0 ? formatCurrency(s.balance) : "—"}
                        </td>
                        <td className="py-3 px-3.5 text-slate-600 text-xs">
                          {s.invoiceType || "Tax Invoice"}
                        </td>
                        <td className="py-3 px-3.5">
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
          </>
        )}
      </div>
    </div>
  );
}
