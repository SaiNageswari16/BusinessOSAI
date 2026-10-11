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
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { formatDisplayDate, formatDisplayDateTime, getTodayDateString, parseSafeDateTimestamp } from "@/lib/utils";

import { inventoryApi, posApi, crmCustomersApi, invoicesApi } from "@/lib/api-client";
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
                      const idKey = String(inv.id || inv.invoice_number || Math.random());
                      if (!allInvoicesMap.has(idKey)) {
                        allInvoicesMap.set(idKey, {
                          ...inv,
                          items: inv.lines || inv.items || [],
                          grand_total: Number(inv.total_amount || inv.grand_total || 0),
                        });
                      }
                    });
                  }
                } catch (e) {}
              }
            }
          }
        } catch (e) {}

        if (sqlInvoicesRes.status === "fulfilled" && sqlInvoicesRes.value) {
          const sVal: any = sqlInvoicesRes.value;
          const sqlInvoices = Array.isArray(sVal) ? sVal : sVal.items || sVal.data || [];
          sqlInvoices.forEach((inv: any) => {
            const idKey = String(inv.id || inv.invoice_number || Math.random());
            if (!allInvoicesMap.has(idKey)) {
              allInvoicesMap.set(idKey, {
                ...inv,
                customer_name: inv.customer_name || inv.customer?.name || inv.party_name || "Client",
                items: inv.lines || inv.items || [],
                grand_total: Number(inv.total_amount || inv.grand_total || 0),
                invoice_date: inv.invoice_date || inv.created_at,
              });
            }
          });
        }

        const combinedInvoices = Array.from(allInvoicesMap.values());
        setRawInvoices(combinedInvoices);

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

        // Populate parties and calculate aggregations from all invoices
        const now = new Date();
        combinedInvoices.forEach((inv: any) => {
          const name = (inv.customer_name || inv.party_name || inv.customer?.name || inv.billing_to || "").trim();
          if (name && name.toLowerCase() !== "cash" && name.toLowerCase() !== "cash customer") {
            const key = name.toLowerCase();
            const phone = inv.customer_phone || inv.party_phone || inv.customer?.phone || inv.phone || "";
            const gstin = inv.customer_gstin || inv.gstin || inv.customer?.gstin || inv.party_gstin || "";
            const total = Number(inv.grand_total || inv.total_amount || 0);
            const balance = Number(inv.balance ?? inv.pending_amount ?? (inv.status === "paid" || inv.payment_status === "Paid" ? 0 : total));
            const paid = total - balance;

            if (partyMap.has(key)) {
              const p = partyMap.get(key)!;
              p.closingBalance += balance;
              p.totalInvoiced = (p.totalInvoiced || 0) + total;
              p.totalPaid = (p.totalPaid || 0) + paid;
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
  const handleExportExcel = () => {
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    let csv = "";
    let filename = `${activeReport}_${new Date().toISOString().slice(0, 10)}.csv`;

    switch (activeReport) {
      case "party_statement": {
        const partyName = activeParty?.name || "Party";
        filename = `party_statement_${partyName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
        csv += `Party Statement for: ${partyName} (${activeParty?.phone || 'No Phone'})\n`;
        csv += `Total Sales: ${ledgerData.totalSales} | Total Received: ${ledgerData.totalReceived} | Balance Due: ${ledgerData.totalReceivable}\n\n`;
        csv += "DATE,TYPE,VOUCHER NO,DEBIT (₹),CREDIT (₹),RUNNING BALANCE (₹),STATUS\n";
        (ledgerData.rows || []).forEach((tx: any) => {
          csv += [
            escapeCsv(tx.date),
            escapeCsv(tx.type),
            escapeCsv(tx.voucherNo),
            tx.debit > 0 ? tx.debit.toFixed(2) : "-",
            tx.credit > 0 ? tx.credit.toFixed(2) : "-",
            tx.runningBalance ? tx.runningBalance.toFixed(2) : "0.00",
            escapeCsv(tx.status),
          ].join(",") + "\n";
        });
        break;
      }

      case "party_item_report": {
        const targetParty = itemReportByPartyData.partyName || "Party";
        filename = `item_report_by_party_${targetParty.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
        csv += `Item Report By Party: ${targetParty}\n\n`;
        csv += "ITEM NAME,ITEM CODE,CATEGORY,SALES QTY,SALES AMOUNT (₹),PURCHASE QTY,PURCHASE AMOUNT (₹)\n";
        (itemReportByPartyData.rows || []).forEach((r: any) => {
          csv += [
            escapeCsv(r.itemName),
            escapeCsv(r.itemCode),
            escapeCsv(r.category),
            `${r.salesQty} PCS`,
            r.salesAmount.toFixed(2),
            `${r.purchaseQty} PCS`,
            r.purchaseAmount.toFixed(2),
          ].join(",") + "\n";
        });
        csv += `Total,,,${itemReportByPartyData.totSalesQty} PCS,${itemReportByPartyData.totSalesAmt.toFixed(2)},${itemReportByPartyData.totPurQty} PCS,${itemReportByPartyData.totPurAmt.toFixed(2)}\n`;
        break;
      }

      case "customer_sales": {
        csv += "DATE,INVOICE NO,PARTY NAME,PHONE,PAYMENT MODE,TAXABLE (₹),TAX (₹),TOTAL AMOUNT (₹),BALANCE DUE (₹),STATUS\n";
        let sumTot = 0;
        let sumBal = 0;
        customerSalesSummary.forEach((r: any) => {
          sumTot += Number(r.amount || 0);
          sumBal += Number(r.balance || 0);
          csv += [
            escapeCsv(r.date),
            escapeCsv(r.invoiceNo),
            escapeCsv(r.partySale),
            escapeCsv(r.phone),
            escapeCsv(r.paymentMode),
            Number(r.taxable || 0).toFixed(2),
            Number(r.tax || 0).toFixed(2),
            Number(r.amount || 0).toFixed(2),
            Number(r.balance || 0).toFixed(2),
            escapeCsv(r.invoiceStatus),
          ].join(",") + "\n";
        });
        csv += `Total,,,,,,${sumTot.toFixed(2)},${sumBal.toFixed(2)},\n`;
        break;
      }

      default: {
        csv += "PARTY NAME,PHONE,CATEGORY,BALANCE (₹),CREDIT LIMIT (₹),TYPE\n";
        parties.forEach((p: PartyRecord) => {
          csv += [
            escapeCsv(p.name),
            escapeCsv(p.phone || "-"),
            escapeCsv(p.category || "-"),
            Number(p.closingBalance || 0).toFixed(2),
            Number(p.creditLimit || 0).toFixed(2),
            escapeCsv(p.type || "Customer"),
          ].join(",") + "\n";
        });
        break;
      }
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${activeReport.replace(/_/g, " ").toUpperCase()} with verified database records!`);
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
        {activeReport === "party_ageing" ? (
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
                          handleExportExcel();
                          setShowExcelDropdown(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Download Excel (.xlsx)
                      </button>
                      <button
                        onClick={() => {
                          handleExportExcel();
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
                <SearchablePartySelect
                  value={selectedPartyId}
                  onChange={setSelectedPartyId}
                  parties={parties}
                  placeholder="Search Party (e.g. nagi)..."
                  className="w-72"
                />

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
          {(activeReport === "party_outstanding" || activeReport === "customer_sales" || activeReport === "party_item_report") && (
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
          </>
        )}
      </div>
    </div>
  );
}
