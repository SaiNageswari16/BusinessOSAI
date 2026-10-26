import { useState, useEffect, useMemo } from "react";
import React from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import {
  Plus,
  Receipt,
  Loader2,
  Eye,
  FileText,
  Boxes,
  CheckCircle2,
  Search,
  Calendar,
  ArrowUpDown,
  RotateCcw,
  Filter,
  Wallet,
  AlertCircle,
  TrendingUp,
  X,
  Clock,
  Sparkles,
  Ban,
  AlertTriangle,
  XCircle,
  Trash2,
  Sliders
} from "lucide-react";
import { inventoryApi } from "../../lib/api-client";
import { toast } from "sonner";
import { ProcurementDocumentForm } from "./ProcurementDocumentForm";
import { ProcurementShareModal } from "./ProcurementShareModal";
import { PurchaseInvoiceQuickSettingsModal } from "./PurchaseInvoiceQuickSettingsModal";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { formatDisplayDate } from "@/lib/utils";
import { PaginationControl } from "@/components/ui/PaginationControl";

type DatePreset = "all" | "today" | "yesterday" | "this_week" | "this_month" | "last_30_days" | "custom";
type SortOption = "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "due_asc";

export function VendorBills() {
  const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [shareDoc, setShareDoc] = useState<any | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancellingBill, setCancellingBill] = useState<any | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  const handleOpenCancelModal = (bill: any) => {
    if ((bill.status || "").toLowerCase() === "cancelled") {
      toast.error("This purchase invoice is already cancelled.");
      return;
    }
    setCancellingBill(bill);
    setCancellationReason("");
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancellation = async () => {
    if (!cancellingBill) return;
    setIsCancelling(true);
    try {
      const res = await inventoryApi.cancelVendorBill(
        cancellingBill.id || cancellingBill.bill_number,
        cancellationReason
      );
      toast.success(res?.message || `Purchase Invoice ${cancellingBill.bill_number} cancelled successfully. Inventory stock has been reversed.`);
      setIsCancelModalOpen(false);
      setCancellingBill(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel purchase invoice");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDeleteBill = async (bill: any) => {
    const ok = window.confirm(
      `Permanently delete Purchase Invoice ${bill.bill_number || bill.id?.slice(0, 8)}?\n\nThis will remove the bill and its payment records. It cannot be undone.`
    );
    if (!ok) return;
    try {
      await inventoryApi.deleteVendorBill(bill.id || bill.bill_number);
      toast.success(`Purchase Invoice ${bill.bill_number || bill.id?.slice(0, 8)} deleted.`);
      fetchData();
    } catch (err: any) {
      toast.error(err?.detail || err?.message || "Failed to delete purchase invoice");
    }
  };

  // ── Filters & Search State ──────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [matchFilter, setMatchFilter] = useState("all");
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortOption>("date_desc");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, datePreset, startDate, endDate, statusFilter, matchFilter, minAmount, maxAmount, sortBy]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.getVendorBills();
      setBills(res || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load vendor bills");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const params = new URLSearchParams(window.location.search);
    const poId = params.get("po_id");
    const grnId = params.get("grn_id");
    if (poId || grnId) {
      setSelectedDoc({
        purchase_order_id: poId || undefined,
        grn_id: grnId || undefined,
      });
      setIsCreateMode(true);
    }

    const handleTenantChange = () => {
      fetchData();
    };
    window.addEventListener("bos-tenant-changed", handleTenantChange);
    return () => window.removeEventListener("bos-tenant-changed", handleTenantChange);
  }, [tenant?.id, (tenant as any)?.raw?.tenant_id]);

  // ── Date Range Presets Handler ─────────────────────────────────────────────
  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (preset === "all") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "today") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(today.toISOString().slice(0, 10));
    } else if (preset === "yesterday") {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const yStart = new Date(d);
      yStart.setHours(0, 0, 0, 0);
      const yEnd = new Date(d);
      yEnd.setHours(23, 59, 59, 999);
      setStartDate(yStart.toISOString().slice(0, 10));
      setEndDate(yEnd.toISOString().slice(0, 10));
    } else if (preset === "this_week") {
      const d = new Date();
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
      const mon = new Date(d.setDate(diff));
      mon.setHours(0, 0, 0, 0);
      setStartDate(mon.toISOString().slice(0, 10));
      setEndDate(today.toISOString().slice(0, 10));
    } else if (preset === "this_month") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      firstDay.setHours(0, 0, 0, 0);
      setStartDate(firstDay.toISOString().slice(0, 10));
      setEndDate(today.toISOString().slice(0, 10));
    } else if (preset === "last_30_days") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      d.setHours(0, 0, 0, 0);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(today.toISOString().slice(0, 10));
    }
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setDatePreset("all");
    setStartDate("");
    setEndDate("");
    setStatusFilter("all");
    setMatchFilter("all");
    setMinAmount("");
    setMaxAmount("");
    setSortBy("date_desc");
  };

  const isFiltered = Boolean(
    searchQuery ||
    datePreset !== "all" ||
    startDate ||
    endDate ||
    statusFilter !== "all" ||
    matchFilter !== "all" ||
    minAmount ||
    maxAmount ||
    sortBy !== "date_desc"
  );

  // ── Filtered & Sorted Bills Calculation ─────────────────────────────────────
  const filteredBills = useMemo(() => {
    return bills.filter((b: any) => {
      // 1. Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNumber = (b.bill_number || "").toLowerCase().includes(q);
        const matchPo = (b.po_number || "").toLowerCase().includes(q);
        const matchSupplier = (b.supplier_name || "").toLowerCase().includes(q);
        const matchGrn = (b.grn_number || "").toLowerCase().includes(q);
        if (!matchNumber && !matchPo && !matchSupplier && !matchGrn) {
          return false;
        }
      }

      // 2. Status Filter
      if (statusFilter !== "all") {
        if ((b.status || "Unpaid").toLowerCase() !== statusFilter.toLowerCase()) {
          return false;
        }
      }

      // 3. 3-Way Match Filter
      if (matchFilter !== "all") {
        const hasGrn = Boolean(b.grn_number || b.grn_id);
        if (matchFilter === "matched" && !hasGrn) return false;
        if (matchFilter === "pending" && hasGrn) return false;
      }

      // 4. Amount Range Filter
      const totalAmt = Number(b.total_amount || 0);
      if (minAmount && totalAmt < Number(minAmount)) return false;
      if (maxAmount && totalAmt > Number(maxAmount)) return false;

      // 5. Date Range Filter (Billed Date / Created Date)
      const rawDate = b.bill_date || b.created_at;
      if (rawDate && (startDate || endDate)) {
        const itemDate = new Date(rawDate).getTime();
        if (startDate) {
          const s = new Date(startDate);
          s.setHours(0, 0, 0, 0);
          if (itemDate < s.getTime()) return false;
        }
        if (endDate) {
          const e = new Date(endDate);
          e.setHours(23, 59, 59, 999);
          if (itemDate > e.getTime()) return false;
        }
      }

      return true;
    }).sort((a: any, b: any) => {
      if (sortBy === "date_desc") {
        const da = new Date(a.bill_date || a.created_at || 0).getTime();
        const db = new Date(b.bill_date || b.created_at || 0).getTime();
        return db - da;
      }
      if (sortBy === "date_asc") {
        const da = new Date(a.bill_date || a.created_at || 0).getTime();
        const db = new Date(b.bill_date || b.created_at || 0).getTime();
        return da - db;
      }
      if (sortBy === "amount_desc") {
        return Number(b.total_amount || 0) - Number(a.total_amount || 0);
      }
      if (sortBy === "amount_asc") {
        return Number(a.total_amount || 0) - Number(b.total_amount || 0);
      }
      if (sortBy === "due_asc") {
        const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        return da - db;
      }
      return 0;
    });
  }, [bills, searchQuery, statusFilter, matchFilter, minAmount, maxAmount, startDate, endDate, sortBy]);

  const paginatedBills = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBills.slice(start, start + pageSize);
  }, [filteredBills, currentPage, pageSize]);

  // ── Summary KPI Calculations ────────────────────────────────────────────────
  const stats = useMemo(() => {
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let matchedCount = 0;

    const activeList = filteredBills.filter((b: any) => (b.status || "").toLowerCase() !== "cancelled");

    activeList.forEach((b: any) => {
      const inv = Number(b.total_amount || 0);
      const pd = Number(b.paid_amount || 0);
      totalInvoiced += inv;
      totalPaid += pd;
      totalOutstanding += Math.max(0, inv - pd);
      if (b.grn_number || b.grn_id) matchedCount++;
    });

    return { 
      totalInvoiced, 
      totalPaid, 
      totalOutstanding, 
      matchedCount, 
      activeCount: activeList.length,
      cancelledCount: filteredBills.length - activeList.length
    };
  }, [filteredBills]);

  if (isCreateMode || selectedDoc) {
    return (
      <ProcurementDocumentForm
        docType="PINV"
        initialData={selectedDoc}
        onClose={() => {
          setIsCreateMode(false);
          setSelectedDoc(null);
        }}
        onSaved={() => {
          setIsCreateMode(false);
          setSelectedDoc(null);
          fetchData();
        }}
      />
    );
  }

  return (
    <div className="space-y-6 text-foreground">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <Receipt className="w-7 h-7 text-primary" />
            Purchase Invoices & Vendor Bills
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage supplier purchase invoices, track payment settlements, and review 3-way match verification.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsSettingsOpen(true)}
            className="font-semibold px-4 py-2.5 rounded-xl border border-border bg-card/60 hover:bg-accent/60 flex items-center gap-2 cursor-pointer shadow-xs"
            title="Configure Purchase Invoice Columns, Custom Columns, Numbering Series & Layout"
          >
            <Sliders className="size-4 text-primary" />
            <span>Invoice Settings</span>
          </Button>
          <Button 
            onClick={() => setIsCreateMode(true)} 
            className="gradient-brand text-white border-0 font-bold px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-2"
          >
            <Plus className="size-4" /> Log Purchase Invoice
          </Button>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-card border-indigo-100 dark:border-indigo-900/50 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">Total Invoiced</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {currency.symbol}{stats.totalInvoiced.toLocaleString("en-IN")}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {stats.activeCount} Active Invoices {stats.cancelledCount > 0 ? `(${stats.cancelledCount} cancelled)` : ""}
              </p>
            </div>
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-sm">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/20 dark:to-card border-emerald-100 dark:border-emerald-900/50 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Total Paid Amount</p>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {currency.symbol}{stats.totalPaid.toLocaleString("en-IN")}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Settled to suppliers</p>
            </div>
            <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-sm">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-amber-50/50 to-white dark:from-amber-950/20 dark:to-card border-amber-100 dark:border-amber-900/50 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Pending Dues / AP</p>
              <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                {currency.symbol}{stats.totalOutstanding.toLocaleString("en-IN")}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Outstanding Payables</p>
            </div>
            <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-sm">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-50/50 to-white dark:from-purple-950/20 dark:to-card border-purple-100 dark:border-purple-900/50 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">3-Way Matched</p>
              <h3 className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
                {stats.matchedCount} / {stats.activeCount}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {stats.activeCount > 0 ? `${Math.round((stats.matchedCount / stats.activeCount) * 100)}% Verified` : "0% Verified"}
              </p>
            </div>
            <div className="p-3 bg-purple-600 text-white rounded-2xl shadow-sm">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Comprehensive Filter Control Panel */}
      <Card className="p-4 bg-card border rounded-2xl shadow-xs space-y-4">
        {/* Top Filter Row: Search & Quick Presets */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[280px]">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Bill #, PO #, Vendor, or GRN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-8 bg-muted/30 hover:bg-muted/50 border border-input rounded-xl text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Date Range Preset Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {(
              [
                { key: "all", label: "All Time" },
                { key: "today", label: "Today" },
                { key: "yesterday", label: "Yesterday" },
                { key: "this_week", label: "This Week" },
                { key: "this_month", label: "This Month" },
                { key: "last_30_days", label: "Last 30 Days" },
                { key: "custom", label: "Custom Range" },
              ] as const
            ).map((preset) => (
              <button
                key={preset.key}
                onClick={() => handleDatePresetChange(preset.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  datePreset === preset.key
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Advanced Filters Toggle & Reset Button */}
          <div className="flex items-center gap-2 self-end lg:self-auto shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`h-9 px-3 rounded-xl text-xs font-bold gap-1.5 cursor-pointer ${
                showAdvancedFilters || (isFiltered && datePreset === "custom") 
                  ? "bg-primary/10 text-primary border-primary/30" 
                  : ""
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              {showAdvancedFilters ? "Hide Filters" : "More Filters"}
              {isFiltered && (
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              )}
            </Button>

            {isFiltered && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-9 px-2.5 rounded-xl text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 gap-1 cursor-pointer"
                title="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Custom Date Range & Advanced Filter Controls */}
        {(showAdvancedFilters || datePreset === "custom") && (
          <div className="pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 bg-muted/20 p-3 rounded-xl">
            {/* Custom Start Date */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-primary" /> Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset("custom");
                }}
                className="w-full h-9 bg-background border border-input rounded-xl px-3 text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary shadow-2xs"
              />
            </div>

            {/* Custom End Date */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-primary" /> End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset("custom");
                }}
                className="w-full h-9 bg-background border border-input rounded-xl px-3 text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary shadow-2xs"
              />
            </div>

            {/* Min & Max Amount Filter */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Amount Range ({currency.symbol})
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  placeholder="Min ₹"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  className="w-1/2 h-9 bg-background border border-input rounded-xl px-2.5 text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary shadow-2xs"
                />
                <span className="text-muted-foreground text-xs font-bold">-</span>
                <input
                  type="number"
                  placeholder="Max ₹"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  className="w-1/2 h-9 bg-background border border-input rounded-xl px-2.5 text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary shadow-2xs"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Payment Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-9 bg-background border border-input rounded-xl px-3 text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary shadow-2xs"
              >
                <option value="all">All Statuses</option>
                <option value="Paid">Paid (Settled)</option>
                <option value="Partial">Partial</option>
                <option value="Unpaid">Unpaid / Due</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1 flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 text-primary" /> Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full h-9 bg-background border border-input rounded-xl px-3 text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary shadow-2xs"
              >
                <option value="date_desc">Latest Date First</option>
                <option value="date_asc">Oldest Date First</option>
                <option value="amount_desc">Amount: High to Low</option>
                <option value="amount_asc">Amount: Low to High</option>
                <option value="due_asc">Earliest Due Date</option>
              </select>
            </div>
          </div>
        )}
      </Card>

      {/* Main Table */}
      <Card className="bg-card border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground text-xs uppercase font-bold tracking-wider">
              <tr>
                <th className="py-4 px-6">Bill / Invoice Number</th>
                <th className="py-4 px-6">Vendor / Supplier</th>
                <th className="py-4 px-6">Linked PO Reference</th>
                <th className="py-4 px-6">3-Way Match (GRN)</th>
                <th className="py-4 px-6 text-right font-bold">Invoiced Amount</th>
                <th className="py-4 px-6 text-right">Paid Amount</th>
                <th className="py-4 px-6">Due Date</th>
                <th className="py-4 px-6">Payment Status</th>
                <th className="py-4 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-muted-foreground">
                    <Loader2 className="w-7 h-7 animate-spin mx-auto mb-3 text-primary" />
                    <p className="font-semibold text-sm">Loading purchase invoices...</p>
                  </td>
                </tr>
              ) : filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-muted-foreground">
                    <div className="max-w-md mx-auto space-y-3">
                      <Receipt className="w-10 h-10 mx-auto text-muted-foreground/50" />
                      <h4 className="text-base font-bold text-foreground">No purchase invoices found</h4>
                      <p className="text-xs text-muted-foreground">
                        {isFiltered 
                          ? "No records match your selected date, amount, or search filters. Try clearing some filters."
                          : "No vendor purchase bills logged yet. Click '+ Log Purchase Invoice' above to create one."}
                      </p>
                      {isFiltered && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleResetFilters}
                          className="rounded-xl font-bold text-xs mt-2"
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Clear All Filters
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedBills.map((b: any) => (
                  <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-4 px-6 font-mono font-bold text-primary">
                      {b.bill_number || b.id.slice(0, 8)}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-foreground">{b.supplier_name || "Unknown Vendor"}</span>
                        {b.supplier?.gst_number && (
                          <span className="text-[10px] text-muted-foreground font-mono">GSTIN: {b.supplier.gst_number}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 font-medium text-foreground">
                      {b.po_number || (b.purchase_order_id ? `PO-${b.purchase_order_id.slice(0, 6)}` : "Direct Invoice")}
                    </td>
                    <td className="py-4 px-6">
                      {b.grn_number ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                            <Boxes className="size-3 text-indigo-600 dark:text-indigo-400" />
                            {b.grn_number}
                          </span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" /> 3-Way Matched
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-muted-foreground italic">No GRN linked</span>
                          <span className="text-[10px] text-amber-600 font-medium">Pending Receipt</span>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right font-black text-foreground">
                      <span className={b.status === 'Cancelled' ? 'line-through text-muted-foreground/70 font-semibold' : ''}>
                        {currency.symbol}{Number(b.total_amount || 0).toLocaleString("en-IN")}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      <span className={b.status === 'Cancelled' ? 'line-through text-muted-foreground/70 font-semibold' : ''}>
                        {currency.symbol}{Number(b.status === 'Cancelled' ? 0 : (b.paid_amount || 0)).toLocaleString("en-IN")}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-muted-foreground font-medium text-xs">
                      {b.due_date ? formatDisplayDate(b.due_date) : "Net 30"}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                        b.status === 'Paid' 
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' 
                          : b.status === 'Partial' 
                          ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' 
                          : b.status === 'Cancelled'
                          ? 'bg-slate-500/10 text-slate-500 border border-slate-500/20 line-through'
                          : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                      }`}>
                        {b.status === 'Paid' && <CheckCircle2 className="w-3 h-3" />}
                        {b.status === 'Cancelled' && <Ban className="w-3 h-3 text-slate-400" />}
                        {b.status || 'Unpaid'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setShareDoc(b)}
                          className="h-8 gap-1.5 font-bold rounded-lg border-teal-200 text-teal-700 bg-teal-50/50 hover:bg-teal-100 dark:bg-teal-950/30 dark:border-teal-800 dark:text-teal-300 shadow-2xs cursor-pointer"
                        >
                          <FileText className="size-3.5 text-teal-600" /> PDF & Share
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setSelectedDoc(b)}
                          className="h-8 gap-1.5 font-bold rounded-lg hover:bg-primary/10 cursor-pointer"
                        >
                          <Eye className="size-3.5" /> View / Edit
                        </Button>
                        {b.status === 'Cancelled' ? (
                          <span className="text-[11px] font-bold text-slate-400 italic px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md">
                            Cancelled
                          </span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenCancelModal(b)}
                            className="h-8 gap-1 font-bold rounded-lg border-rose-200 text-rose-700 bg-rose-50/50 hover:bg-rose-100 dark:bg-rose-950/30 dark:border-rose-900/50 dark:text-rose-400 shadow-2xs cursor-pointer"
                            title="Cancel purchase invoice & reverse stock"
                          >
                            <Ban className="size-3.5 text-rose-600" /> Cancel
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteBill(b)}
                          className="h-8 gap-1 font-bold rounded-lg border-red-300 text-red-700 bg-red-50/50 hover:bg-red-100 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-400 shadow-2xs cursor-pointer"
                          title="Permanently delete this purchase invoice"
                        >
                          <Trash2 className="size-3.5 text-red-600" /> Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationControl
          currentPage={currentPage}
          totalPages={Math.max(1, Math.ceil(filteredBills.length / pageSize))}
          totalItems={filteredBills.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="vendor bills"
        />
      </Card>

      {/* Cancel Purchase Invoice Confirmation Modal */}
      {isCancelModalOpen && cancellingBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-600 text-white rounded-xl shadow-xs">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-rose-600 dark:text-rose-400">
                    Cancel Purchase Invoice
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Reverse inventory stock & cancel bill #{cancellingBill.bill_number}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCancelModalOpen(false);
                  setCancellingBill(null);
                }}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              {/* Warning Notice */}
              <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl space-y-1 text-rose-900 dark:text-rose-300">
                <p className="font-bold flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                  <Ban className="w-4 h-4 shrink-0" />
                  Inventory Stock Reversal Warning
                </p>
                <p className="text-[11px] leading-relaxed">
                  Cancelling this purchase invoice will automatically reverse received quantities from your warehouse inventory stock, mark the linked GRN as Cancelled, and log an audit movement.
                </p>
              </div>

              {/* Invoice Summary Details */}
              <div className="p-3.5 bg-muted/30 border border-border rounded-xl space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium">Bill Number:</span>
                  <span className="font-mono font-bold text-primary">{cancellingBill.bill_number}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium">Supplier / Vendor:</span>
                  <span className="font-bold text-foreground">{cancellingBill.supplier_name || "Unknown Vendor"}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium">Linked PO:</span>
                  <span className="font-medium text-foreground">{cancellingBill.po_number || "Direct Inward"}</span>
                </div>
                <div className="flex justify-between items-center text-xs pt-1.5 border-t border-border">
                  <span className="text-muted-foreground font-medium">Total Invoiced Amount:</span>
                  <span className="font-black text-foreground text-sm">
                    {currency.symbol}{Number(cancellingBill.total_amount || 0).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {/* Items stock to be deducted */}
              {cancellingBill.items && cancellingBill.items.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-foreground">
                    Items & Quantities to Deduct from Inventory:
                  </label>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {cancellingBill.items.map((it: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-2 bg-muted/40 rounded-lg text-[11px]">
                        <span className="font-medium text-foreground truncate max-w-[240px]">
                          {it.product_name || "Product Item"}
                        </span>
                        <span className="font-mono font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800 shrink-0">
                          -{it.quantity || 1} units
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reason Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-foreground">
                  Cancellation Reason <span className="text-muted-foreground font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="e.g., Goods damaged / Incorrect billing rate / Duplicate entry / Order cancelled with vendor"
                  className="w-full p-2.5 bg-background border border-input rounded-xl text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all placeholder:text-muted-foreground shadow-2xs"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-muted/20 border-t border-border flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isCancelling}
                onClick={() => {
                  setIsCancelModalOpen(false);
                  setCancellingBill(null);
                }}
                className="rounded-xl font-bold text-xs cursor-pointer"
              >
                Keep Invoice
              </Button>
              <Button
                size="sm"
                disabled={isCancelling}
                onClick={handleConfirmCancellation}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Reversing Stock...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Confirm & Cancel Purchase Invoice</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Full Document PDF & WhatsApp/Email Share Modal */}
      <ProcurementShareModal
        isOpen={Boolean(shareDoc)}
        onClose={() => setShareDoc(null)}
        documentData={shareDoc}
        docType="PINV"
      />

      {/* Purchase Invoice Quick Settings Modal */}
      <PurchaseInvoiceQuickSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

