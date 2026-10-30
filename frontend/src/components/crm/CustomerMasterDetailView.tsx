import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Search,
  Filter,
  Plus,
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  Tag,
  DollarSign,
  Calendar,
  Clock,
  ChevronRight,
  ArrowLeft,
  MoreVertical,
  Coins,
  Wallet,
  Package,
  ShoppingBag,
  ShoppingCart,
  Receipt,
  BookOpen,
  Layers,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Printer,
  Download,
  Eye,
  FileText,
  Sparkles,
  PhoneCall,
  Pencil,
  Trash2,
  X,
  ArrowUpDown,
  RefreshCw,
  BarChart3,
  Sliders,
  CreditCard,
  Share2,
  FileSpreadsheet,
  Check,
  LayoutGrid,
  Rows3,
  FileCheck2,
  ChevronDown,
  Boxes,
  Warehouse,
  Loader2,
  Copy,
  Gift,
  Upload,
} from "lucide-react";
import {
  CrmCustomer,
  CustomerLedgerResponse,
  CustomerLedgerEntry,
  crmCustomersApi,
  invoicesApi,
  posApi,
  CRMCallLog,
} from "@/lib/api-client";
import { useCurrency } from "@/hooks/use-currency";
import { formatDisplayDate, cn } from "@/lib/utils";
import { toast } from "sonner";

export interface CustomerMasterDetailViewProps {
  customer: CrmCustomer;
  customers: CrmCustomer[];
  onSelectCustomer: (customer: CrmCustomer) => void;
  onBackToCustomers: () => void;
  onEditCustomer?: (customer: CrmCustomer) => void;
  onDeleteCustomer?: (customerId: string) => void;
  onAdjustBalance?: (customer: CrmCustomer) => void;
  onOpenLedgerModal?: (customer: CrmCustomer) => void;
  onAiCall?: (customer: CrmCustomer) => void;
  onCreateCustomer?: () => void;
  onCreateSalesInvoice?: (customer: CrmCustomer) => void;
  callStatusMap?: Record<string, CRMCallLog>;
  viewLayout?: "detail" | "table";
  onToggleLayout?: (layout: "detail" | "table") => void;
}

type SubTab = "customer_details" | "transactions" | "ledger" | "item_report";
type DateFilter = "today" | "7d" | "30d" | "90d" | "365d" | "all";

export function CustomerMasterDetailView({
  customer: initialCustomer,
  customers,
  onSelectCustomer,
  onBackToCustomers,
  onEditCustomer,
  onDeleteCustomer,
  onAdjustBalance,
  onOpenLedgerModal,
  onAiCall,
  onCreateCustomer,
  onCreateSalesInvoice,
  callStatusMap = {},
  viewLayout = "detail",
  onToggleLayout,
}: CustomerMasterDetailViewProps) {
  const { currency, formatCurrency } = useCurrency();

  // Active customer selection
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialCustomer.id);
  const activeCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || initialCustomer;
  }, [customers, selectedCustomerId, initialCustomer]);

  useEffect(() => {
    if (initialCustomer?.id && initialCustomer.id !== selectedCustomerId) {
      setSelectedCustomerId(initialCustomer.id);
    }
  }, [initialCustomer?.id]);

  // Sidebar search & filters
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [sidebarTypeFilter, setSidebarTypeFilter] = useState<string>("All");
  const [sidebarStatusFilter, setSidebarStatusFilter] = useState<string>("All");
  const [sidebarDueFilter, setSidebarDueFilter] = useState<"all" | "due" | "zero">("all");

  // Active sub-tab (Default to customer_details, exactly mirroring Products Item Details)
  const [activeTab, setActiveTab] = useState<SubTab>("customer_details");

  // Header more menu dropdown
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close more menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Live Ledger and Transactions data
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerData, setLedgerData] = useState<CustomerLedgerResponse | null>(null);
  const [allInvoices, setAllInvoices] = useState<any[]>([]);

  // Transaction tab filters
  const [transDateFilter, setTransDateFilter] = useState<DateFilter>("365d");
  const [transTypeFilter, setTransTypeFilter] = useState<string>("all");
  const [transStatusFilter, setTransStatusFilter] = useState<string>("all");
  const [transSortField, setTransSortField] = useState<"date" | "amount">("date");
  const [transSortAsc, setTransSortAsc] = useState<boolean>(false);

  // Item wise report search
  const [itemSearch, setItemSearch] = useState("");

  // Load customer live ledger and invoices across all sources (accounting invoices, POS transactions, localStorage)
  const loadCustomerData = async () => {
    if (!activeCustomer?.id) return;
    setLedgerLoading(true);
    try {
      const ledgerPromise = crmCustomersApi.getLedger(activeCustomer.id).catch((err) => {
        console.warn("Ledger fetch error:", err);
        return null;
      });

      const invoicesPromise = invoicesApi.listInvoices({ page_size: 1000 }).catch((err) => {
        console.warn("Invoices list error:", err);
        return { items: [] };
      });

      const posHistoryPromise = posApi.getHistory({ limit: 500 }).catch((err) => {
        console.warn("POS history fetch error:", err);
        return [];
      });

      const [ledgerRes, invRes, posHistRes] = await Promise.all([
        ledgerPromise,
        invoicesPromise,
        posHistoryPromise,
      ]);

      if (ledgerRes) {
        setLedgerData(ledgerRes);
      }

      const invList: any[] = (invRes as any)?.items || (Array.isArray(invRes) ? invRes : []);
      const posList: any[] = Array.isArray(posHistRes) ? posHistRes : ((posHistRes as any)?.items || []);

      // Also scan localStorage POS saved invoices
      const localInvoices: any[] = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (
            k &&
            (k.startsWith("pos_saved_invoices") ||
              k.startsWith("pos_recent_invoices") ||
              k.startsWith("pos_invoices_history") ||
              k.startsWith("pos_transactions"))
          ) {
            try {
              const raw = localStorage.getItem(k);
              if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                  localInvoices.push(...parsed);
                }
              }
            } catch {}
          }
        }
      } catch {}

      // Combine all invoice records
      const combinedDocs = new Map<string, any>();
      [...localInvoices, ...posList, ...invList].forEach((doc: any) => {
        const docNum = String(doc.invoice_number || doc.receipt_number || doc.id || "").toUpperCase().trim();
        if (docNum && !combinedDocs.has(docNum)) {
          combinedDocs.set(docNum, doc);
        }
      });

      const cleanStr = (s: any) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const digitsOnly = (s: any) => String(s || "").replace(/\D/g, "");
      const actCustId = String(activeCustomer.id).toLowerCase();
      const actName = cleanStr(activeCustomer.name);
      const actPhone = digitsOnly(activeCustomer.phone);

      const matched: any[] = [];
      combinedDocs.forEach((inv) => {
        const invCustId = inv.customer_id ? String(inv.customer_id).toLowerCase() : "";
        if (invCustId && invCustId === actCustId) {
          matched.push(inv);
          return;
        }

        const invName = cleanStr(inv.customer_name || inv.customer?.name || "");
        if (
          invName &&
          actName &&
          (invName === actName ||
            (actName.length >= 3 && invName.includes(actName)) ||
            (invName.length >= 3 && actName.includes(invName)))
        ) {
          matched.push(inv);
          return;
        }

        const invPhone = digitsOnly(inv.customer_phone || inv.customer?.phone || "");
        if (invPhone && actPhone && (invPhone === actPhone || invPhone.slice(-10) === actPhone.slice(-10))) {
          matched.push(inv);
          return;
        }
      });
      setAllInvoices(matched);
    } catch (e) {
      console.error("Error loading customer live data:", e);
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    void loadCustomerData();
  }, [activeCustomer.id]);

  // Filtered customer list for left sidebar
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (sidebarSearch.trim()) {
        const q = sidebarSearch.toLowerCase().trim();
        const matches =
          (c.name || "").toLowerCase().includes(q) ||
          (c.phone || "").includes(q) ||
          (c.email || "").toLowerCase().includes(q) ||
          (c.company_name || "").toLowerCase().includes(q) ||
          (c.gst_number || "").toLowerCase().includes(q);
        if (!matches) return false;
      }

      if (sidebarTypeFilter !== "All" && c.customer_type !== sidebarTypeFilter) {
        return false;
      }

      if (sidebarStatusFilter !== "All" && c.status !== sidebarStatusFilter) {
        return false;
      }

      if (sidebarDueFilter === "due" && !(Number(c.outstanding_balance) > 0.05)) {
        return false;
      }
      if (sidebarDueFilter === "zero" && Number(c.outstanding_balance) > 0.05) {
        return false;
      }

      return true;
    });
  }, [customers, sidebarSearch, sidebarTypeFilter, sidebarStatusFilter, sidebarDueFilter]);

  const getInitials = (name: string) => {
    if (!name) return "C";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  // Derived Metrics from active customer & live data
  const lifetimeValue = useMemo(() => {
    if (activeCustomer.lifetime_value != null && Number(activeCustomer.lifetime_value) > 0) {
      return Number(activeCustomer.lifetime_value);
    }
    if (ledgerData?.summary?.total_invoiced != null && Number(ledgerData.summary.total_invoiced) > 0) {
      return Number(ledgerData.summary.total_invoiced);
    }
    const sum = allInvoices.reduce((acc, inv) => acc + (Number(inv.total_amount) || 0), 0);
    return sum;
  }, [activeCustomer, ledgerData, allInvoices]);

  const balanceDue = useMemo(() => {
    if (activeCustomer.outstanding_balance != null) {
      return Number(activeCustomer.outstanding_balance);
    }
    if (ledgerData?.summary?.closing_balance != null) {
      return Number(ledgerData.summary.closing_balance);
    }
    return 0;
  }, [activeCustomer, ledgerData]);

  const totalOrders = useMemo(() => {
    if (activeCustomer.total_orders != null && activeCustomer.total_orders > 0) {
      return activeCustomer.total_orders;
    }
    if (allInvoices.length > 0) {
      return allInvoices.length;
    }
    if (ledgerData?.summary?.total_transactions_count != null) {
      return ledgerData.summary.total_transactions_count;
    }
    return 0;
  }, [activeCustomer, allInvoices, ledgerData]);

  const lastPurchaseDate = useMemo(() => {
    if (allInvoices.length > 0) {
      const dates = allInvoices
        .map((i) => i.invoice_date || i.created_at)
        .filter(Boolean)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      if (dates.length > 0) return dates[0];
    }
    if (ledgerData?.ledger_entries && ledgerData.ledger_entries.length > 0) {
      const invEntries = ledgerData.ledger_entries
        .filter((e) => e.type === "invoice")
        .sort((a, b) => new Date(b.date || b.iso_date).getTime() - new Date(a.date || a.iso_date).getTime());
      if (invEntries.length > 0) return invEntries[0].date || invEntries[0].iso_date;
    }
    return null;
  }, [allInvoices, ledgerData]);

  interface CustomerTransactionItem {
    id: string;
    date: string;
    type: "invoice" | "payment" | "credit_note" | "quotation" | "return" | "other" | string;
    typeLabel: string;
    number: string;
    amount: number;
    status: string;
    raw?: any;
  }

  const transactionsList = useMemo(() => {
    const list: CustomerTransactionItem[] = [];
    const seenNumbers = new Set<string>();

    if (ledgerData?.ledger_entries && ledgerData.ledger_entries.length > 0) {
      ledgerData.ledger_entries.forEach((e) => {
        const isInvoice = e.type === "invoice";
        const amt = isInvoice ? e.debit || e.running_balance : e.credit || e.debit;
        const num = String(e.voucher_no || e.reference_no || "").trim();
        if (num && num !== "—") seenNumbers.add(num.toUpperCase());
        list.push({
          id: e.id || e.raw_id || e.voucher_no,
          date: e.date || e.iso_date || e.formatted_date,
          type: e.type,
          typeLabel: e.type_label || (isInvoice ? "Sales Invoice" : "Payment Receipt"),
          number: num || "—",
          amount: Number(amt) || 0,
          status: e.status || (isInvoice ? (e.balance_due && e.balance_due > 0 ? "Unpaid" : "Paid") : "Completed"),
          raw: e,
        });
      });
    }

    allInvoices.forEach((inv) => {
      const invNum = String(inv.invoice_number || inv.receipt_number || "").trim();
      if (invNum && seenNumbers.has(invNum.toUpperCase())) return;
      if (invNum) seenNumbers.add(invNum.toUpperCase());
      const amt = Number(inv.grand_total || inv.total_amount || inv.total || 0);
      list.push({
        id: inv.id || invNum,
        date: inv.invoice_date || inv.date || inv.created_at,
        type: "invoice",
        typeLabel: "Sales Invoice",
        number: invNum || "—",
        amount: amt,
        status: inv.status || inv.payment_status || "Completed",
        raw: inv,
      });
    });

    const now = new Date();
    return list
      .filter((item) => {
        if (transDateFilter !== "all") {
          const itemDate = new Date(item.date);
          if (!isNaN(itemDate.getTime())) {
            const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
            if (transDateFilter === "today" && diffDays > 1) return false;
            if (transDateFilter === "7d" && diffDays > 7) return false;
            if (transDateFilter === "30d" && diffDays > 30) return false;
            if (transDateFilter === "90d" && diffDays > 90) return false;
            if (transDateFilter === "365d" && diffDays > 365) return false;
          }
        }

        if (transTypeFilter !== "all") {
          if (transTypeFilter === "invoice" && item.type !== "invoice") return false;
          if (transTypeFilter === "payment" && item.type !== "payment") return false;
          if (transTypeFilter === "credit_note" && item.type !== "credit_note") return false;
        }

        if (transStatusFilter !== "all") {
          if (String(item.status).toLowerCase() !== transStatusFilter.toLowerCase()) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (transSortField === "amount") {
          return transSortAsc ? a.amount - b.amount : b.amount - a.amount;
        }
        const timeA = new Date(a.date).getTime() || 0;
        const timeB = new Date(b.date).getTime() || 0;
        return transSortAsc ? timeA - timeB : timeB - timeA;
      });
  }, [ledgerData, allInvoices, transDateFilter, transTypeFilter, transStatusFilter, transSortField, transSortAsc]);

  interface PurchasedItemRecord {
    key: string;
    name: string;
    sku: string;
    totalQty: number;
    unitPrice: number;
    totalAmount: number;
    lastBilledDate: string;
    lastInvoiceNumber: string;
  }

  const purchasedItems = useMemo(() => {
    const map = new Map<string, PurchasedItemRecord>();

    allInvoices.forEach((inv) => {
      const lines = inv.lines || inv.items || [];
      const invDate = inv.invoice_date || inv.created_at;
      const invNum = inv.invoice_number || "—";

      lines.forEach((line: any) => {
        const name = line.product_name || line.name || line.item_name || "Unknown Product";
        const sku = line.product_sku || line.sku || line.sku_code || line.barcode || "—";
        const key = `${name.toLowerCase()}__${sku.toLowerCase()}`;
        const qty = Number(line.quantity) || 1;
        const total = Number(line.line_total || line.total || (qty * Number(line.unit_price || 0))) || 0;
        const price = Number(line.unit_price) || (qty > 0 ? total / qty : 0);

        if (!map.has(key)) {
          map.set(key, {
            key,
            name,
            sku,
            totalQty: qty,
            unitPrice: price,
            totalAmount: total,
            lastBilledDate: invDate,
            lastInvoiceNumber: invNum,
          });
        } else {
          const existing = map.get(key)!;
          existing.totalQty += qty;
          existing.totalAmount += total;
          if (new Date(invDate).getTime() > new Date(existing.lastBilledDate).getTime()) {
            existing.lastBilledDate = invDate;
            existing.lastInvoiceNumber = invNum;
            existing.unitPrice = price || existing.unitPrice;
          }
        }
      });
    });

    if (ledgerData?.ledger_entries) {
      ledgerData.ledger_entries.forEach((e) => {
        if (e.items && Array.isArray(e.items)) {
          e.items.forEach((item) => {
            const name = item.item_name || "Product";
            const key = `${name.toLowerCase()}__—`;
            const qty = Number(item.quantity) || 1;
            const total = Number(item.total) || 0;
            const price = Number(item.unit_price) || (qty > 0 ? total / qty : 0);
            const date = e.date || e.iso_date;

            if (!map.has(key)) {
              map.set(key, {
                key,
                name,
                sku: "—",
                totalQty: qty,
                unitPrice: price,
                totalAmount: total,
                lastBilledDate: date,
                lastInvoiceNumber: e.voucher_no || "—",
              });
            }
          });
        }
      });
    }

    let arr = Array.from(map.values());
    if (itemSearch.trim()) {
      const q = itemSearch.toLowerCase().trim();
      arr = arr.filter((it) => it.name.toLowerCase().includes(q) || it.sku.toLowerCase().includes(q));
    }

    return arr.sort((a, b) => b.totalAmount - a.totalAmount);
  }, [allInvoices, ledgerData, itemSearch]);

  const handleCreateSalesInvoice = () => {
    if (onCreateSalesInvoice) {
      onCreateSalesInvoice(activeCustomer);
    } else {
      window.dispatchEvent(
        new CustomEvent("open_create_invoice_for_customer", {
          detail: { customer: activeCustomer },
        })
      );
      toast.info(`Ready to bill customer: ${activeCustomer.name}`);
    }
  };

  const isDuePositive = balanceDue > 0.05;

  return (
    <div className="flex h-[calc(100vh-140px)] overflow-hidden bg-slate-50/50 rounded-2xl border border-slate-200 shadow-xs">
      {/* ══════════════════════════════════════════════════════════════
           LEFT SIDEBAR: Customer List & Quick Create
           ══════════════════════════════════════════════════════════════ */}
      <div className="w-80 lg:w-88 border-r border-slate-200 bg-white flex flex-col shrink-0 h-full">
        {/* Top Search & Filter Bar */}
        <div className="p-3 border-b border-slate-100 space-y-2.5 shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                placeholder="Search customer by name, phone..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/80 focus:bg-white outline-none focus:ring-2 focus:ring-purple-500 font-medium transition-all"
              />
              {sidebarSearch && (
                <button
                  type="button"
                  onClick={() => setSidebarSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ×
                </button>
              )}
            </div>

            {/* Filter Toggle Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                className={cn(
                  "p-2 rounded-xl border transition-colors shadow-2xs",
                  isFilterDropdownOpen || sidebarTypeFilter !== "All" || sidebarDueFilter !== "all"
                    ? "bg-purple-50 border-purple-300 text-purple-700"
                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                )}
                title="Filter Customers"
              >
                <Filter className="w-4 h-4" />
              </button>

              {isFilterDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsFilterDropdownOpen(false)} />
                  <div className="absolute right-0 mt-1.5 w-60 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 p-3 space-y-3 animate-in fade-in zoom-in-95 duration-100">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Customer Type
                      </span>
                      <select
                        value={sidebarTypeFilter}
                        onChange={(e) => setSidebarTypeFilter(e.target.value)}
                        className="w-full h-8 px-2 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 outline-none"
                      >
                        <option value="All">All Types</option>
                        <option value="Retail">Retail</option>
                        <option value="Corporate">Corporate</option>
                        <option value="Wholesale">Wholesale</option>
                        <option value="VIP">VIP</option>
                        <option value="Distributor">Distributor</option>
                      </select>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Balance Due
                      </span>
                      <select
                        value={sidebarDueFilter}
                        onChange={(e) => setSidebarDueFilter(e.target.value as any)}
                        className="w-full h-8 px-2 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 outline-none"
                      >
                        <option value="all">All Balances</option>
                        <option value="due">Has Balance Due (&gt; ₹0)</option>
                        <option value="zero">Zero Due (₹0.00)</option>
                      </select>
                    </div>

                    {(sidebarTypeFilter !== "All" || sidebarDueFilter !== "all") && (
                      <button
                        type="button"
                        onClick={() => {
                          setSidebarTypeFilter("All");
                          setSidebarDueFilter("all");
                        }}
                        className="w-full py-1.5 text-center text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 rounded-lg transition"
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Quick Create Customer button in sidebar (Matches Products + Create Item) */}
          <button
            type="button"
            onClick={onCreateCustomer}
            className="w-full h-9 rounded-xl border border-dashed border-purple-300 bg-purple-50/50 hover:bg-purple-50 text-purple-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Customer</span>
          </button>
        </div>

        {/* Scrollable Customer List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-1.5">
          {filteredCustomers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <User className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-600">No customers found</p>
              <p className="text-[11px] text-slate-400 mt-1">Try adjusting your search or filters.</p>
            </div>
          ) : (
            filteredCustomers.map((c) => {
              const isSelected = activeCustomer?.id === c.id;
              const due = Number(c.outstanding_balance ?? 0);
              const hasDue = due > 0.05;

              return (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelectedCustomerId(c.id);
                    onSelectCustomer(c);
                  }}
                  className={`p-2.5 flex items-center gap-3 cursor-pointer transition-all rounded-xl my-0.5 border ${
                    isSelected
                      ? "bg-purple-50/80 border-purple-300 text-slate-900 shadow-2xs ring-1 ring-purple-200"
                      : "bg-white border-transparent hover:bg-slate-50/90 text-slate-700"
                  }`}
                >
                  {/* Customer Avatar Thumbnail */}
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg font-black flex items-center justify-center text-xs shrink-0 border transition-colors",
                      isSelected
                        ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                        : "bg-purple-100 text-purple-700 border-purple-200"
                    )}
                  >
                    {getInitials(c.name)}
                  </div>

                  {/* Middle: Name & Subtitle */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs text-slate-900 truncate leading-tight">{c.name}</p>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      {c.phone || c.email || c.customer_type || "Retail"}
                    </p>
                  </div>

                  {/* Right: Balance Due */}
                  <div className="text-right shrink-0">
                    <p
                      className={cn(
                        "text-xs font-black leading-tight",
                        hasDue ? "text-rose-600" : "text-emerald-600"
                      )}
                    >
                      {currency.symbol}
                      {due.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    <span className="text-[10px] text-slate-400 font-medium block">Balance Due</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Summary Footer */}
        <div className="p-2.5 border-t border-slate-100 bg-slate-50/80 text-[11px] text-slate-500 flex justify-between items-center shrink-0 font-medium">
          <span>
            Total: <strong>{customers.length}</strong> customers
          </span>
          <span>
            Showing: <strong>{filteredCustomers.length}</strong>
          </span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
           RIGHT PANE: Live Detail View for Selected Customer
           ══════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-50/30 p-5 space-y-3">
        {/* Breadcrumb Navigation: ← Customers / {customerName} */}
        <div className="flex items-center justify-between text-sm text-slate-600 px-1 py-0.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBackToCustomers}
              className="p-1 -ml-1 rounded-lg hover:bg-slate-200/80 text-slate-600 hover:text-slate-900 transition-colors flex items-center justify-center cursor-pointer"
              title="Back to Customers"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onBackToCustomers}
              className="font-bold text-slate-800 hover:text-purple-700 transition-colors cursor-pointer"
            >
              Customers
            </button>
            <span className="text-slate-400 font-normal">/</span>
            <span className="text-slate-500 font-medium truncate max-w-md">{activeCustomer.name}</span>
          </div>

          {/* View Toggle Layout (Detail View | Table View) */}
          {onToggleLayout && (
            <div className="inline-flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => onToggleLayout("detail")}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                  viewLayout === "detail"
                    ? "bg-white text-purple-700 shadow-xs border border-purple-200"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <LayoutGrid className="size-3.5" />
                <span>Detail View</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleLayout("table")}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                  viewLayout === "table"
                    ? "bg-white text-purple-700 shadow-xs border border-purple-200"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Rows3 className="size-3.5" />
                <span>Table View</span>
              </button>
            </div>
          )}
        </div>

        {/* Header Bar (Matches Products Header Bar) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80 bg-white p-4 rounded-2xl border shadow-2xs shrink-0">
          {/* Left: Back Arrow, Avatar & Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBackToCustomers}
              className="p-1.5 -ml-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
              title="Back to Customers"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center shrink-0 text-purple-700 font-black text-lg">
              {getInitials(activeCustomer.name)}
            </div>

            <div className="min-w-0">
              <h1 className="text-base lg:text-lg font-black text-slate-900 leading-tight truncate">
                {activeCustomer.name}
              </h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border",
                    activeCustomer.status === "Active"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : activeCustomer.status === "Blocked"
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  )}
                >
                  {activeCustomer.status || "Active"}
                </span>

                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                  {activeCustomer.customer_type || "Retail"}
                </span>

                {activeCustomer.phone && (
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Phone className="size-3 text-slate-400" />
                    <strong>{activeCustomer.phone}</strong>
                  </span>
                )}

                {(activeCustomer.city || activeCustomer.address) && (
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <MapPin className="size-3 text-slate-400" />
                    {activeCustomer.city || activeCustomer.address}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions (Matches Products Action Buttons) */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Create Sales Invoice Button */}
            <button
              type="button"
              onClick={handleCreateSalesInvoice}
              className="px-3.5 py-1.5 text-xs font-bold gradient-brand text-white rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer hover:opacity-95"
              title="Create a new sales invoice for this customer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Sales Invoice</span>
            </button>

            {/* Adjust Balance Button */}
            {onAdjustBalance && (
              <button
                type="button"
                onClick={() => onAdjustBalance(activeCustomer)}
                className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Adjust outstanding dues"
              >
                <Sliders className="w-3.5 h-3.5 text-slate-500" />
                <span>Adjust Balance</span>
              </button>
            )}

            {/* Edit Button */}
            {onEditCustomer && (
              <button
                type="button"
                onClick={() => onEditCustomer(activeCustomer)}
                className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Edit customer information"
              >
                <Pencil className="w-3.5 h-3.5 text-indigo-600" />
                <span>Edit</span>
              </button>
            )}

            {/* Delete Button */}
            {onDeleteCustomer && (
              <button
                type="button"
                onClick={() => onDeleteCustomer(activeCustomer.id)}
                className="p-2 text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-xl shadow-2xs transition-colors cursor-pointer"
                title="Delete this customer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {/* More Actions Dropdown */}
            <div className="relative" ref={moreMenuRef}>
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                className="p-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl shadow-2xs transition-colors cursor-pointer"
                title="More actions"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {isMoreMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsMoreMenuOpen(false)} />
                  <div className="absolute right-0 mt-1.5 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 p-1.5 text-xs font-medium space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                    {onOpenLedgerModal && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          onOpenLedgerModal(activeCustomer);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-purple-50 hover:text-purple-700 rounded-lg flex items-center gap-2 text-slate-700 cursor-pointer"
                      >
                        <Receipt className="w-3.5 h-3.5 text-purple-600" />
                        <span>View Statement & Ledger</span>
                      </button>
                    )}

                    {onAiCall && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          onAiCall(activeCustomer);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg flex items-center gap-2 text-slate-700 cursor-pointer"
                      >
                        <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Start AI Voice Call</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        navigator.clipboard?.writeText(activeCustomer.id);
                        toast.success("Customer ID copied to clipboard");
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg flex items-center gap-2 text-slate-700 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy Customer ID</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Sub-Tabs Row (Placed right below header, matching Products tab layout!) */}
        <div className="flex items-center gap-6 border-b border-slate-200 px-2 shrink-0">
          {[
            { id: "customer_details", label: "Customer Details", icon: User },
            { id: "transactions", label: "Transactions", icon: FileText },
            { id: "ledger", label: "Ledger (Statement)", icon: BookOpen },
            { id: "item_report", label: "Item Wise Report", icon: Layers },
          ].map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "pb-2.5 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer",
                  isActive
                    ? "border-purple-600 text-purple-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                )}
              >
                <TabIcon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ══════════════════════════════════════════════════════════
             SUB-TAB 1: CUSTOMER DETAILS (KPI Cards + 2-Column Split)
             ══════════════════════════════════════════════════════════ */}
        {activeTab === "customer_details" && (
          <div className="space-y-4">
            {/* 4 Metric / KPI Cards (Identical style and coloring to Products KPI cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 1. Balance Due */}
              <div
                className={cn(
                  "p-4 rounded-2xl border flex items-center gap-3 shadow-2xs",
                  isDuePositive ? "bg-rose-50/60 border-rose-100" : "bg-emerald-50/60 border-emerald-100"
                )}
              >
                <div
                  className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                    isDuePositive ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
                  )}
                >
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block mb-0.5">Balance Due</span>
                  <span
                    className={cn(
                      "text-lg font-black",
                      isDuePositive ? "text-rose-700" : "text-emerald-700"
                    )}
                  >
                    {formatCurrency(balanceDue)}
                  </span>
                </div>
              </div>

              {/* 2. Lifetime Value */}
              <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100 flex items-center gap-3 shadow-2xs">
                <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block mb-0.5">Lifetime Value</span>
                  <span className="text-lg font-black text-purple-900">{formatCurrency(lifetimeValue)}</span>
                </div>
              </div>

              {/* 3. Total Orders */}
              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-center gap-3 shadow-2xs">
                <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block mb-0.5">Total Orders</span>
                  <span className="text-lg font-black text-blue-900">{totalOrders}</span>
                </div>
              </div>

              {/* 4. Last Purchase */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex items-center gap-3 shadow-2xs">
                <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block mb-0.5">Last Purchase</span>
                  <span className="text-sm font-black text-emerald-900 truncate block max-w-[140px]">
                    {lastPurchaseDate ? formatDisplayDate(lastPurchaseDate) : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* 2-Column Section Cards (General Details vs Credit & Tax Details) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* LEFT CARD: General Details (7 cols) */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                  <User className="w-4 h-4 text-purple-600" />
                  <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    General Details
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3.5 gap-x-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Customer Name</span>
                    <p className="font-bold text-slate-900">{activeCustomer.name}</p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Customer Type</span>
                    <p className="font-bold text-purple-700">{activeCustomer.customer_type || "Retail"}</p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Customer Code</span>
                    <p className="font-mono font-bold text-slate-800">{activeCustomer.id?.slice(0, 8).toUpperCase() || "-"}</p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Mobile Phone</span>
                    <p className="font-mono font-bold text-slate-800">{activeCustomer.phone || "-"}</p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Email Address</span>
                    <p className="font-medium text-slate-800 truncate">{activeCustomer.email || "-"}</p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Company Name</span>
                    <p className="font-bold text-slate-800">{activeCustomer.company_name || "-"}</p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Contact Person</span>
                    <p className="font-bold text-slate-800">
                      {activeCustomer.contact_person || activeCustomer.name || "-"}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">GST Number (GSTIN)</span>
                    <p className="font-mono font-bold text-slate-800">{activeCustomer.gst_number || "-"}</p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">PAN Number</span>
                    <p className="font-mono font-bold text-slate-800">{activeCustomer.pan_number || "-"}</p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Account Status</span>
                    <p
                      className={cn(
                        "font-bold",
                        activeCustomer.status === "Active" ? "text-emerald-600" : "text-rose-600"
                      )}
                    >
                      {activeCustomer.status || "Active"}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Preferred Language</span>
                    <p className="font-bold text-slate-800">{activeCustomer.preferred_language || "English"}</p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Customer Source</span>
                    <p className="font-bold text-slate-800">{activeCustomer.source || "-"}</p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Date of Birth</span>
                    <p className="font-medium text-slate-700">
                      {activeCustomer.date_of_birth ? formatDisplayDate(activeCustomer.date_of_birth) : "-"}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Anniversary Date</span>
                    <p className="font-medium text-slate-700">
                      {activeCustomer.anniversary_date ? formatDisplayDate(activeCustomer.anniversary_date) : "-"}
                    </p>
                  </div>

                  <div className="sm:col-span-2">
                    <span className="text-slate-400 block text-[11px] mb-0.5">Customer Notes &amp; Remarks</span>
                    <p className="font-medium text-slate-700 text-xs">
                      {activeCustomer.notes || (activeCustomer as any).description || "No additional remarks registered."}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Opening Balance</span>
                    <p className="font-bold text-slate-800">{formatCurrency(activeCustomer.opening_balance || 0)}</p>
                  </div>

                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[11px] mb-0.5">Current Balance Due</span>
                    <p
                      className={cn(
                        "text-sm font-black",
                        isDuePositive ? "text-rose-600" : "text-emerald-600"
                      )}
                    >
                      {formatCurrency(balanceDue)}
                    </p>
                  </div>
                </div>
              </div>

              {/* RIGHT CARDS: Financial & Location Details (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                {/* Credit & Financials Card */}
                <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                    <Receipt className="w-4 h-4 text-slate-600" />
                    <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                      Credit &amp; Financials
                    </h2>
                  </div>

                  <div className="grid grid-cols-2 gap-y-3.5 gap-x-4 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px] mb-0.5">Balance Due</span>
                      <p
                        className={cn(
                          "font-black text-sm",
                          isDuePositive ? "text-rose-600" : "text-emerald-700"
                        )}
                      >
                        {formatCurrency(balanceDue)}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px] mb-0.5">Lifetime Value</span>
                      <p className="font-black text-sm text-slate-900">{formatCurrency(lifetimeValue)}</p>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px] mb-0.5">Credit Limit</span>
                      <p className="font-bold text-slate-800">
                        {activeCustomer.credit_limit ? formatCurrency(activeCustomer.credit_limit) : "No Limit"}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px] mb-0.5">Opening Balance</span>
                      <p className="font-bold text-slate-800">{formatCurrency(activeCustomer.opening_balance || 0)}</p>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px] mb-0.5">Total Invoiced</span>
                      <p className="font-bold text-slate-800">
                        {ledgerData?.summary?.total_invoiced ? formatCurrency(ledgerData.summary.total_invoiced) : formatCurrency(lifetimeValue)}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px] mb-0.5">Total Paid / Received</span>
                      <p className="font-bold text-emerald-600">
                        {ledgerData?.summary?.total_received ? formatCurrency(ledgerData.summary.total_received) : formatCurrency(Math.max(0, lifetimeValue - balanceDue))}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tax & Address Details Card */}
                <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                    <MapPin className="w-4 h-4 text-slate-600" />
                    <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                      Tax &amp; Address Details
                    </h2>
                  </div>

                  <div className="grid grid-cols-2 gap-y-3.5 gap-x-4 text-xs">
                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[11px] mb-0.5">Billing Address</span>
                      <p className="font-medium text-slate-800">
                        {activeCustomer.billing_address || activeCustomer.address || "-"}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px] mb-0.5">City</span>
                      <p className="font-bold text-slate-800">{activeCustomer.city || "-"}</p>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px] mb-0.5">State &amp; Pincode</span>
                      <p className="font-bold text-slate-800">
                        {[activeCustomer.state, activeCustomer.postal_code || activeCustomer.pincode].filter(Boolean).join(" - ") || "-"}
                      </p>
                    </div>

                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[11px] mb-0.5">Shipping Address</span>
                      <p className="font-medium text-slate-800">
                        {activeCustomer.shipping_address || activeCustomer.billing_address || activeCustomer.address || "-"}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px] mb-0.5">GST Registration</span>
                      <p className={cn("font-bold", activeCustomer.gst_number ? "text-emerald-600" : "text-slate-500")}>
                        {activeCustomer.gst_number ? "Registered" : "Unregistered"}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px] mb-0.5">Currency</span>
                      <p className="font-bold text-slate-800">{currency.code} ({currency.symbol})</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
             SUB-TAB 2: TRANSACTIONS (Live Customer Invoices)
             ══════════════════════════════════════════════════════════ */}
        {activeTab === "transactions" && (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
            {/* Table Top Banner */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-purple-600" />
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  Customer Sales Invoices &amp; Transactions
                </h3>
              </div>
              <span className="text-xs font-bold text-slate-500">
                {transactionsList.length} Billed Record{transactionsList.length === 1 ? "" : "s"}
              </span>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <select
                  value={transDateFilter}
                  onChange={(e) => setTransDateFilter(e.target.value as DateFilter)}
                  className="appearance-none pl-3 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/40 cursor-pointer"
                >
                  <option value="today">Today</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                  <option value="365d">Last 365 Days</option>
                  <option value="all">All Time</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={transTypeFilter}
                  onChange={(e) => setTransTypeFilter(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/40 cursor-pointer"
                >
                  <option value="all">Select Transaction Type</option>
                  <option value="invoice">Sales Invoice</option>
                  <option value="payment">Payment Receipt</option>
                  <option value="credit_note">Credit Note</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={transStatusFilter}
                  onChange={(e) => setTransStatusFilter(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/40 cursor-pointer"
                >
                  <option value="all">Select Status</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="partially paid">Partially Paid</option>
                  <option value="completed">Completed</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b sticky top-0 z-10">
                  <tr>
                    <th
                      className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition"
                      onClick={() => {
                        if (transSortField === "date") {
                          setTransSortAsc(!transSortAsc);
                        } else {
                          setTransSortField("date");
                          setTransSortAsc(false);
                        }
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Date</span>
                        <ArrowUpDown className="size-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="px-4 py-3">Transaction Type</th>
                    <th className="px-4 py-3">Transaction Number</th>
                    <th
                      className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100 transition"
                      onClick={() => {
                        if (transSortField === "amount") {
                          setTransSortAsc(!transSortAsc);
                        } else {
                          setTransSortField("amount");
                          setTransSortAsc(false);
                        }
                      }}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Amount</span>
                        <ArrowUpDown className="size-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactionsList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <Receipt className="w-10 h-10 text-slate-300 stroke-1 mx-auto" />
                          <p className="text-sm font-bold text-slate-800">
                            No transactions for the selected time period
                          </p>
                          <p className="text-xs text-slate-500">
                            Try changing the date range or filters.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    transactionsList.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {formatDisplayDate(tx.date)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                              tx.type === "invoice"
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : tx.type === "payment"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            )}
                          >
                            {tx.typeLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-800">{tx.number}</td>
                        <td className="px-4 py-3 text-right font-black text-slate-900">
                          {formatCurrency(tx.amount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={cn(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                              String(tx.status).toLowerCase().includes("paid") &&
                                !String(tx.status).toLowerCase().includes("unpaid")
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : String(tx.status).toLowerCase().includes("unpaid")
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-slate-100 text-slate-700 border-slate-200"
                            )}
                          >
                            {tx.status}
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


        {/* ══════════════════════════════════════════════════════════
             SUB-TAB 3: LEDGER (STATEMENT)
             ══════════════════════════════════════════════════════════ */}
        {activeTab === "ledger" && (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-purple-600" />
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  Statement of Account &amp; Running Ledger
                </h3>
              </div>
              {onOpenLedgerModal && (
                <button
                  type="button"
                  onClick={() => onOpenLedgerModal(activeCustomer)}
                  className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold border border-purple-200 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="size-3.5" />
                  <span>Print Full Statement</span>
                </button>
              )}
            </div>

            {/* Ledger Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-[11px] font-bold text-slate-500 uppercase">Opening Balance</p>
                <p className="text-base font-black text-slate-800 mt-1">
                  {formatCurrency(ledgerData?.summary?.opening_balance ?? activeCustomer.opening_balance ?? 0)}
                </p>
              </div>
              <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl">
                <p className="text-[11px] font-bold text-purple-700 uppercase">Total Billed (Debit)</p>
                <p className="text-base font-black text-purple-800 mt-1">
                  {formatCurrency(ledgerData?.summary?.total_invoiced ?? lifetimeValue)}
                </p>
              </div>
              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                <p className="text-[11px] font-bold text-emerald-700 uppercase">Total Received (Credit)</p>
                <p className="text-base font-black text-emerald-800 mt-1">
                  {formatCurrency(ledgerData?.summary?.total_received ?? 0)}
                </p>
              </div>
              <div className="p-3 bg-rose-50/60 border border-rose-200 rounded-xl">
                <p className="text-[11px] font-bold text-rose-700 uppercase">Closing Balance Due</p>
                <p className="text-base font-black text-rose-800 mt-1">
                  {formatCurrency(ledgerData?.summary?.closing_balance ?? balanceDue)}
                </p>
              </div>
            </div>

            {/* Entries Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Voucher No</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Particulars</th>
                    <th className="px-4 py-3 text-right">Debit</th>
                    <th className="px-4 py-3 text-right">Credit</th>
                    <th className="px-4 py-3 text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!ledgerData?.ledger_entries || ledgerData.ledger_entries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No ledger transactions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    ledgerData.ledger_entries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-2.5 text-slate-700">{formatDisplayDate(entry.date)}</td>
                        <td className="px-4 py-2.5 font-mono font-bold text-purple-700">{entry.voucher_no || "—"}</td>
                        <td className="px-4 py-2.5">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            {entry.type_label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{entry.particulars || "—"}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-purple-700">
                          {entry.debit > 0 ? formatCurrency(entry.debit) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-emerald-700">
                          {entry.credit > 0 ? formatCurrency(entry.credit) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-black text-slate-900">
                          {formatCurrency(entry.running_balance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
             SUB-TAB 4: ITEM WISE REPORT (Products Purchased by Customer)
             ══════════════════════════════════════════════════════════ */}
        {activeTab === "item_report" && (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-600" />
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  Item-Wise Billed Products
                </h3>
              </div>
              <span className="text-xs font-bold text-slate-500">
                {purchasedItems.length} Distinct Product{purchasedItems.length === 1 ? "" : "s"} Billed
              </span>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                type="text"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Search billed products..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              />
            </div>

            {/* Purchased Items Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b">
                  <tr>
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-4 py-3">SKU / Code</th>
                    <th className="px-4 py-3 text-right">Total Qty</th>
                    <th className="px-4 py-3 text-right">Avg Price</th>
                    <th className="px-4 py-3 text-right">Total Value</th>
                    <th className="px-4 py-3 text-right">Last Purchased</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchasedItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-slate-400">
                        <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-700">No products billed to this customer yet</p>
                        <p className="text-[11px] text-slate-400 mt-1">Invoices billed with line items will appear here.</p>
                      </td>
                    </tr>
                  ) : (
                    purchasedItems.map((item) => (
                      <tr key={item.key} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-800">{item.name}</td>
                        <td className="px-4 py-3 font-mono text-slate-500">{item.sku}</td>
                        <td className="px-4 py-3 text-right font-black text-slate-900">{item.totalQty}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-4 py-3 text-right font-black text-purple-700">
                          {formatCurrency(item.totalAmount)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500">
                          {formatDisplayDate(item.lastBilledDate)}
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

function LayoutGridIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
  );
}

function Rows3Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 9h18" />
      <path d="M3 15h18" />
    </svg>
  );
}
