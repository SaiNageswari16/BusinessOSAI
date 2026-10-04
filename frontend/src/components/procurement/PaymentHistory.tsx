import React, { useState, useEffect, useMemo } from "react";
import { useI18n } from "@/contexts/i18n-context";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { 
  Search, 
  ChevronDown, 
  Filter, 
  Printer, 
  MoreVertical, 
  X,
  Plus,
  FileText,
  Calendar,
  WalletCards,
  Receipt,
  FileSpreadsheet,
  CheckCircle,
  Clock,
  Eye,
  Building2,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingDown,
  AlertCircle,
  DollarSign,
  Loader2,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { inventoryApi } from "../../lib/api-client";
import { ThermalReceiptPrinter } from "../pos/ThermalReceiptPrinter";
import { triggerThermalPrint } from "../../lib/print-helper";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { getTodayDateString } from "@/lib/utils";
import { DatePickerInput } from "@/components/ui/date-picker-input";

export function PaymentHistory() {
  const { t } = useI18n();
  const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();
  const currentTenantId = (tenant as any)?.raw?.tenant_id || (tenant as any)?.tenant_id || tenant?.id || "default";
  const currentCompanyId = tenant?.id || (tenant as any)?.raw?.id || (tenant as any)?.company_id || "default";

  // Data States
  const [payments, setPayments] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [debitNotes, setDebitNotes] = useState<any[]>([]);
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Record Payment Out Drawer State
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [selectedSupplierName, setSelectedSupplierName] = useState<string>("");
  const [selectedBillId, setSelectedBillId] = useState<string>("");
  const [paymentPurpose, setPaymentPurpose] = useState<'settle_bill' | 'advance_payout' | 'debit_note_refund'>('settle_bill');
  const [paymentAmount, setPaymentAmount] = useState<number | "">("");
  const [paymentDate, setPaymentDate] = useState(getTodayDateString());
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [referenceNumber, setReferenceNumber] = useState(`TXN-${Math.floor(100000 + Math.random() * 900000)}`);
  const [discountReceived, setDiscountReceived] = useState<number | "">("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter & Search States
  const [activeLedgerTab, setActiveLedgerTab] = useState<'all_passbook' | 'settlements_only' | 'advance_payouts' | 'debit_notes_only' | 'bank_transfers' | 'cash_only'>('all_passbook');
  const [searchQuery, setSearchQuery] = useState("");
  const [supplierFilter, setSupplierFilter] = useState<string>("All");
  const [dateFilter, setDateFilter] = useState("Last 365 Days");
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [modeFilter, setModeFilter] = useState("All");
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);

  // Print & Modal States
  const [printedPayment, setPrintedPayment] = useState<any>(null);
  const [viewingBill, setViewingBill] = useState<any | null>(null);
  const [viewingVoucher, setViewingVoucher] = useState<any | null>(null);

  // Fetch all procurement ledger records
  const fetchData = async () => {
    setLoading(true);
    try {
      const [b, p, dn, cn] = await Promise.all([
        inventoryApi.getVendorBills().catch(() => []),
        inventoryApi.getVendorPayments().catch(() => []),
        inventoryApi.getVendorDebitNotes().catch(() => []),
        inventoryApi.getVendorCreditNotes().catch(() => [])
      ]);
      setBills(b || []);
      setPayments(p || []);
      setDebitNotes(dn || []);
      setCreditNotes(cn || []);
    } catch (err: any) {
      console.error("Failed to load vendor payment history:", err);
      toast.error(err.message || "Failed to load payment history");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenant?.id]);

  // Extract unique supplier list with due balances
  const suppliersList = useMemo(() => {
    const map = new Map<string, { name: string; totalBilled: number; totalPaid: number; dueBalance: number; billCount: number }>();
    
    (bills || []).forEach((b) => {
      const sName = (b.supplier_name || "Vendor").trim();
      const existing = map.get(sName) || { name: sName, totalBilled: 0, totalPaid: 0, dueBalance: 0, billCount: 0 };
      const billed = Number(b.total_amount || 0);
      const paid = Number(b.paid_amount || 0);
      existing.totalBilled += billed;
      existing.totalPaid += paid;
      existing.dueBalance += Math.max(0, billed - paid);
      existing.billCount += 1;
      map.set(sName, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.dueBalance - a.dueBalance);
  }, [bills]);

  // Compute Combined Passbook Entries (Vendor Payments + Debit Notes + Credit Notes)
  const passbookEntries = useMemo(() => {
    const entries: any[] = [];

    // 1. Direct Vendor Bill Payments (Debits / Outflows)
    (payments || []).forEach((p) => {
      const bill = (bills || []).find((b) => b.id === p.vendor_bill_id || b.bill_number === p.bill_number);
      const isAdvance = !p.vendor_bill_id || p.payment_method?.toLowerCase().includes("advance") || p.notes?.toLowerCase().includes("advance");
      const amt = Number(p.amount_paid || p.amount || 0);

      entries.push({
        id: p.id,
        raw: p,
        bill_obj: bill,
        voucher_number: p.reference_number || `TXN-${String(p.id).slice(0, 8).toUpperCase()}`,
        reference_text: bill?.bill_number ? `Vendor Bill #${bill.bill_number}` : (isAdvance ? "Advance Supplier Payout" : "Supplier Bill Settlement"),
        bill_id: bill?.id || p.vendor_bill_id,
        bill_number: bill?.bill_number || p.bill_number,
        supplier_name: bill?.supplier_name || p.supplier_name || p.vendor_name || "Taxpayer Trade Entity",
        party_type: "Supplier / Vendor",
        entry_type: "debit", // Cash outflow
        debit_amount: amt,
        credit_amount: 0,
        amount: amt,
        payment_date: p.payment_date || p.created_at || new Date().toISOString(),
        payment_method: p.payment_method || "Bank Transfer",
        badge: isAdvance ? "Advance Payout" : "Vendor Settlement",
        badge_variant: isAdvance ? "purple" : "amber",
        notes: p.notes || (bill?.bill_number ? `Settlement for Vendor Bill #${bill.bill_number}` : "Vendor Payout"),
        created_at: p.payment_date || p.created_at || new Date().toISOString(),
      });
    });

    // 2. Vendor Debit Notes (Credits / Supplier Claims / Purchase Returns)
    (debitNotes || []).forEach((dn) => {
      const amt = Number(dn.total_amount || dn.grand_total || dn.amount || 0);
      entries.push({
        id: dn.id,
        raw: dn,
        voucher_number: dn.debit_note_number || dn.note_number || dn.invoice_number || `DN-${String(dn.id).slice(0, 6).toUpperCase()}`,
        reference_text: dn.reference_number || (dn.original_bill_number ? `Debit Note against #${dn.original_bill_number}` : "Purchase Return / Debit Adjustment"),
        bill_id: dn.vendor_bill_id,
        bill_number: dn.original_bill_number || dn.bill_number,
        supplier_name: dn.supplier_name || dn.vendor_name || "Supplier",
        party_type: "Supplier / Vendor",
        entry_type: "credit", // Inflow / Credit adjustment
        debit_amount: 0,
        credit_amount: amt,
        amount: amt,
        payment_date: dn.date || dn.created_at || new Date().toISOString(),
        payment_method: "Debit Note (Return)",
        badge: "Debit Note / Return",
        badge_variant: "rose",
        notes: dn.reason || dn.notes || "Supplier Debit Note Adjustment",
        created_at: dn.date || dn.created_at || new Date().toISOString(),
      });
    });

    // 3. Vendor Credit Notes (Credits received from Vendor for returns & rebates)
    (creditNotes || []).forEach((cn) => {
      const amt = Number(cn.amount || cn.total_amount || 0);
      entries.push({
        id: cn.id,
        raw: cn,
        voucher_number: cn.note_number || `CN-${String(cn.id).slice(0, 6).toUpperCase()}`,
        reference_text: cn.bill_reference || cn.reference_number || "Vendor Credit Note (Discount/Rebate)",
        bill_id: cn.vendor_bill_id,
        bill_number: cn.bill_reference,
        supplier_name: cn.supplier_name || "Supplier Vendor",
        party_type: "Supplier / Vendor",
        entry_type: "credit", // Inflow / Balance adjustment
        debit_amount: 0,
        credit_amount: amt,
        amount: amt,
        payment_date: cn.created_at || new Date().toISOString(),
        payment_method: "Vendor Credit Note",
        badge: "Credit Note (Vendor)",
        badge_variant: "emerald",
        notes: cn.notes || `Vendor Credit: ${cn.status || 'Unapplied'}`,
        created_at: cn.created_at || new Date().toISOString(),
      });
    });

    return entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [payments, bills, debitNotes, creditNotes]);

  // Overall Statistics
  const stats = useMemo(() => {
    let totalDebits = 0;
    let totalAdvances = 0;
    let totalSettlements = 0;
    let totalPendingPayables = 0;

    passbookEntries.forEach((e) => {
      if (e.entry_type === "debit") {
        totalDebits += e.debit_amount;
        if (e.badge === "Advance Payout") {
          totalAdvances += e.debit_amount;
        } else {
          totalSettlements += e.debit_amount;
        }
      }
    });

    (bills || []).forEach((b) => {
      const total = Number(b.total_amount || 0);
      const paid = Number(b.paid_amount || 0);
      const due = Math.max(0, total - paid);
      totalPendingPayables += due;
    });

    return {
      totalDebits,
      totalAdvances,
      totalSettlements,
      totalPendingPayables,
      count: passbookEntries.length,
    };
  }, [passbookEntries, bills]);

  // Filtered Passbook Entries
  const filteredEntries = useMemo(() => {
    return passbookEntries.filter((p) => {
      // 1. Tab Filter
      if (activeLedgerTab === "settlements_only" && p.badge !== "Vendor Settlement") return false;
      if (activeLedgerTab === "advance_payouts" && p.badge !== "Advance Payout") return false;
      if (activeLedgerTab === "debit_notes_only" && p.entry_type !== "credit") return false;
      if (activeLedgerTab === "bank_transfers" && !p.payment_method.toLowerCase().includes("bank") && !p.payment_method.toLowerCase().includes("neft") && !p.payment_method.toLowerCase().includes("rtgs") && !p.payment_method.toLowerCase().includes("transfer")) return false;
      if (activeLedgerTab === "cash_only" && !p.payment_method.toLowerCase().includes("cash")) return false;

      // 2. Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSupplier = p.supplier_name?.toLowerCase().includes(q);
        const matchesVoucher = p.voucher_number?.toLowerCase().includes(q);
        const matchesBill = p.bill_number?.toLowerCase().includes(q);
        const matchesRef = p.reference_text?.toLowerCase().includes(q);
        const matchesNotes = p.notes?.toLowerCase().includes(q);
        if (!matchesSupplier && !matchesVoucher && !matchesBill && !matchesRef && !matchesNotes) {
          return false;
        }
      }

      // 3. Supplier Filter
      if (supplierFilter !== "All" && p.supplier_name !== supplierFilter) {
        return false;
      }

      // 4. Payment Mode Filter
      if (modeFilter !== "All") {
        if (!p.payment_method.toLowerCase().includes(modeFilter.toLowerCase())) {
          return false;
        }
      }

      // 5. Date Filter
      if (dateFilter !== "All Time") {
        const pDate = new Date(p.payment_date);
        const now = new Date();
        if (dateFilter === "Today") {
          if (pDate.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === "Yesterday") {
          const yest = new Date(now);
          yest.setDate(now.getDate() - 1);
          if (pDate.toDateString() !== yest.toDateString()) return false;
        } else if (dateFilter === "Last 7 Days") {
          const limit = new Date(now);
          limit.setDate(now.getDate() - 7);
          if (pDate < limit) return false;
        } else if (dateFilter === "Last 30 Days") {
          const limit = new Date(now);
          limit.setDate(now.getDate() - 30);
          if (pDate < limit) return false;
        } else if (dateFilter === "Last 365 Days") {
          const limit = new Date(now);
          limit.setDate(now.getDate() - 365);
          if (pDate < limit) return false;
        }
      }

      return true;
    });
  }, [passbookEntries, activeLedgerTab, searchQuery, supplierFilter, modeFilter, dateFilter]);

  // Bills for the currently selected supplier in Record Payment Drawer
  const supplierPendingBills = useMemo(() => {
    if (!selectedSupplierName) return [];
    return (bills || []).filter((b) => {
      const matchSupplier = (b.supplier_name || "").trim().toLowerCase() === selectedSupplierName.trim().toLowerCase();
      const isUnpaid = (Number(b.total_amount || 0) - Number(b.paid_amount || 0)) > 0.01;
      return matchSupplier && isUnpaid;
    });
  }, [bills, selectedSupplierName]);

  // Selected bill balance helper
  const activeBill = useMemo(() => {
    return (bills || []).find((b) => b.id === selectedBillId);
  }, [bills, selectedBillId]);

  // Open Record Payment Drawer
  const handleOpenRecordPayment = (supplierName?: string, billId?: string) => {
    const sName = supplierName || (suppliersList[0]?.name || "");
    setSelectedSupplierName(sName);
    setSelectedBillId(billId || "");
    
    if (billId) {
      const b = (bills || []).find((x) => x.id === billId);
      if (b) {
        const bal = Math.max(0, Number(b.total_amount || 0) - Number(b.paid_amount || 0));
        setPaymentAmount(bal);
      }
    } else {
      const supplierObj = suppliersList.find((s) => s.name === sName);
      setPaymentAmount(supplierObj?.dueBalance || "");
    }

    setPaymentDate(getTodayDateString());
    setReferenceNumber(`TXN-${Math.floor(100000 + Math.random() * 900000)}`);
    setPaymentMethod("Bank Transfer");
    setDiscountReceived("");
    setPaymentNotes("");
    setIsRecordingPayment(true);
  };

  // Submit Payment Out
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = Number(paymentAmount);
    if (!numAmt || numAmt <= 0) {
      toast.error("Please enter a valid payment amount greater than 0.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create payment in backend
      const targetBillId = selectedBillId || (supplierPendingBills[0]?.id || undefined);
      
      await inventoryApi.createVendorPayment({
        vendor_bill_id: targetBillId,
        amount_paid: numAmt,
        payment_method: paymentMethod,
        reference_number: referenceNumber,
        notes: paymentNotes || (selectedSupplierName ? `Payment Out to ${selectedSupplierName}` : "Vendor Payout"),
        payment_date: paymentDate,
      });

      toast.success(`Recorded ${formatCurrency(numAmt)} Payment Out to ${selectedSupplierName || 'Supplier'} successfully!`);

      // 2. Set for Thermal Receipt
      setPrintedPayment({
        id: referenceNumber,
        created_at: paymentDate || new Date().toISOString(),
        payment_method: paymentMethod,
        amount: numAmt,
        customer_name: selectedSupplierName || "Vendor",
        cashier_name: "Procurement Officer",
        notes: paymentNotes
      });

      setIsRecordingPayment(false);
      await fetchData();
    } catch (err: any) {
      console.error("Failed to record payment out:", err);
      toast.error(err.message || "Failed to process vendor payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Print single payment voucher
  const handlePrintReceipt = (entry: any) => {
    setPrintedPayment({
      id: entry.voucher_number,
      created_at: entry.payment_date || new Date().toISOString(),
      payment_method: entry.payment_method,
      amount: entry.amount,
      customer_name: entry.supplier_name || "Supplier",
      cashier_name: "Procurement Desk",
      notes: entry.notes || entry.reference_text
    });

    setTimeout(() => {
      triggerThermalPrint();
    }, 150);
  };

  // Print Passbook Table
  const handlePrintPassbook = () => {
    window.print();
  };

  return (
    <div className="relative flex w-full h-full min-h-[calc(100vh-140px)] text-foreground">
      {/* Hidden Thermal Printer Element */}
      {printedPayment && (
        <div className="hidden">
          <ThermalReceiptPrinter bill={printedPayment} />
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${isRecordingPayment ? "mr-[480px]" : "mr-0"}`}>
        <div className="space-y-6 h-full flex flex-col w-full overflow-y-auto pr-1">
          
          {/* Header */}
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  {t("Payments Out & Supplier Ledger", "Payments Out & Supplier Ledger")}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
                  Real-Time Debit / Accounts Payable
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {t("Comprehensive double-entry passbook, vendor bill settlements, advance supplier payouts, and live payables auditing.", "Comprehensive double-entry passbook, vendor bill settlements, advance supplier payouts, and live payables auditing.")}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setIsRefreshing(true); void fetchData(); }}
                disabled={isRefreshing}
                className="px-3 h-8 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                title="Refresh Ledger"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-indigo-600" : "text-slate-500"}`} />
                Refresh
              </button>

              <button 
                type="button"
                onClick={() => handleOpenRecordPayment()}
                className="gradient-brand text-white font-semibold px-3.5 h-8 text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all hover:opacity-90 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Record Payment Out / Settle Bill
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Debits (Outflow) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-4 shadow-2xs">
              <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <ArrowDownLeft className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-0.5">Total Outflows (Debits)</p>
                <p className="text-lg font-black text-rose-600">-{formatCurrency(stats.totalDebits)}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Disbursed vendor settlements</p>
              </div>
            </div>

            {/* Pending Payables Due */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-4 shadow-2xs">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-0.5">Pending Accounts Payable</p>
                <p className="text-lg font-black text-amber-700">{formatCurrency(stats.totalPendingPayables)}</p>
                <p className="text-[11px] text-amber-600 font-semibold mt-0.5">Active unpaid / overdue bills</p>
              </div>
            </div>

            {/* Advance Supplier Payouts */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-4 shadow-2xs">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <WalletCards className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-0.5">Advance Supplier Payouts</p>
                <p className="text-lg font-black text-purple-700">{formatCurrency(stats.totalAdvances)}</p>
                <p className="text-[11px] text-purple-600 font-semibold mt-0.5">On-account pre-payments</p>
              </div>
            </div>

            {/* Total Vouchers Recorded */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-4 shadow-2xs">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-0.5">Total Vouchers Logged</p>
                <p className="text-lg font-black text-slate-900">{stats.count} Payouts</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Audited & synced</p>
              </div>
            </div>
          </div>

          {/* Segmented Ledger Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
            {[
              { id: 'all_passbook', label: '📑 All Transactions (Passbook)' },
              { id: 'settlements_only', label: '🔴 Bill Settlements' },
              { id: 'advance_payouts', label: '🟣 Advance Payouts (On-Account)' },
              { id: 'debit_notes_only', label: '🟠 Debit Notes & Returns' },
              { id: 'bank_transfers', label: '🏦 Bank Transfers / NEFT' },
              { id: 'cash_only', label: '💵 Cash Payouts' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveLedgerTab(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  activeLedgerTab === tab.id
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap gap-3 no-print">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by supplier, voucher #, bill #, UTR #, remarks..."
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 bg-white font-medium"
              />
            </div>

            {/* Supplier Filter Dropdown */}
            <div className="relative">
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="h-10 px-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
              >
                <option value="All">🏢 All Suppliers & Vendors</option>
                {suppliersList.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} (Due: {formatCurrency(s.dueBalance)})
                  </option>
                ))}
              </select>
            </div>
            
            {/* Date Filter Dropdown */}
            <div className="relative">
              <button 
                type="button"
                onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
                className="flex items-center gap-2 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-slate-500" /> {dateFilter} <ChevronDown className="w-4 h-4" />
              </button>
              {isDateDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1">
                  {["Today", "Yesterday", "Last 7 Days", "Last 30 Days", "Last 365 Days", "All Time"].map((opt) => (
                    <button 
                      key={opt}
                      type="button"
                      onClick={() => { setDateFilter(opt); setIsDateDropdownOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Payment Mode Filter */}
            <div className="relative">
              <button 
                type="button"
                onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
                className="flex items-center gap-2 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
              >
                <Filter className="w-4 h-4" /> {modeFilter === "All" ? "Filter Mode" : modeFilter}
              </button>
              {isModeDropdownOpen && (
                <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1">
                  {["All", "Bank Transfer", "Cash", "Cheque", "UPI", "Debit Note"].map((opt) => (
                    <button 
                      key={opt}
                      type="button"
                      onClick={() => { setModeFilter(opt); setIsModeDropdownOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      {opt === "All" ? "All Payment Modes" : opt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button 
              type="button"
              onClick={handlePrintPassbook}
              className="border border-slate-200 rounded-xl px-3 py-2 text-slate-600 bg-white hover:bg-slate-50 cursor-pointer"
              title="Print Passbook Table"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>

          {/* Passbook Ledger Table */}
          <Card className="flex-1 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col shadow-2xs">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
                  <tr>
                    <th className="py-3.5 px-4">Date & Time</th>
                    <th className="py-3.5 px-4">Voucher / Ref #</th>
                    <th className="py-3.5 px-4">Supplier / Vendor</th>
                    <th className="py-3.5 px-4 text-right text-rose-700">Debit (-) Out</th>
                    <th className="py-3.5 px-4 text-right text-emerald-700">Credit (+) Adjust</th>
                    <th className="py-3.5 px-4 text-center">Tender / Mode</th>
                    <th className="py-3.5 px-4 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                        Loading vendor payments passbook...
                      </td>
                    </tr>
                  ) : filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16 text-slate-400 text-sm font-semibold">
                        No vendor payment records found for the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map((p, idx) => (
                      <tr key={p.id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-900">{new Date(p.payment_date).toLocaleDateString()}</p>
                          <p className="text-[11px] text-slate-400">{new Date(p.payment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-indigo-600 block">{p.voucher_number}</span>
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider mt-0.5 ${
                            p.badge_variant === "purple" ? "bg-purple-100 text-purple-800" :
                            p.badge_variant === "rose" ? "bg-rose-100 text-rose-800" :
                            p.badge_variant === "amber" ? "bg-amber-100 text-amber-800" :
                            "bg-slate-100 text-slate-800"
                          }`}>
                            {p.badge}
                          </span>

                          {p.bill_number && (
                            <button
                              type="button"
                              onClick={() => {
                                const matchedBill = (bills || []).find((b) => b.id === p.bill_id || b.bill_number === p.bill_number);
                                if (matchedBill) setViewingBill(matchedBill);
                                else toast.info(`Bill #${p.bill_number}`);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-md transition-colors mt-1 block cursor-pointer"
                              title="Click to view Bill details"
                            >
                              <FileText className="w-3 h-3" /> Vendor Bill #{p.bill_number}
                            </button>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-900">{p.supplier_name}</p>
                          <span className="inline-block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                            {p.party_type}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-600">
                          {p.debit_amount > 0 ? `-${formatCurrency(p.debit_amount)}` : "—"}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600">
                          {p.credit_amount > 0 ? `+${formatCurrency(p.credit_amount)}` : "—"}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-semibold text-slate-700 text-xs inline-block">
                            {p.payment_method}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10 cursor-pointer"
                            onClick={() => handlePrintReceipt(p)}
                            title="Print Thermal Payment Voucher"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      {/* RECORD PAYMENT OUT SLIDE-OVER DRAWER */}
      {isRecordingPayment && (
        <div className="fixed top-0 right-0 h-full w-[480px] bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
          {/* Drawer Header */}
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <div>
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-rose-600" /> Record Payment Out
              </h3>
              <p className="text-xs text-slate-500">Settle supplier bills, advance payouts, or debit adjustments.</p>
            </div>
            <button 
              type="button"
              onClick={() => setIsRecordingPayment(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Form */}
          <form onSubmit={handleSubmitPayment} className="p-5 flex-1 overflow-y-auto space-y-4 text-sm">
            {/* Purpose Tabs */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                Payment Type / Purpose
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'settle_bill', label: 'Settle Bill', icon: FileText },
                  { id: 'advance_payout', label: 'Advance Pay', icon: WalletCards },
                  { id: 'debit_note_refund', label: 'Debit Return', icon: CreditCard },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = paymentPurpose === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPaymentPurpose(item.id as any)}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? "bg-rose-50 border-rose-300 text-rose-900 shadow-2xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isSelected ? "text-rose-600" : "text-slate-400"}`} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Supplier / Vendor Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                Select Supplier / Vendor *
              </label>
              <select
                value={selectedSupplierName}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedSupplierName(val);
                  setSelectedBillId("");
                  const s = suppliersList.find((x) => x.name === val);
                  setPaymentAmount(s?.dueBalance || "");
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:border-rose-500 shadow-2xs"
                required
              >
                <option value="" disabled>-- Select Vendor --</option>
                {suppliersList.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} (Outstanding: {formatCurrency(s.dueBalance)})
                  </option>
                ))}
              </select>
            </div>

            {/* Unpaid Bills Accordion / Multi-Allocation */}
            {selectedSupplierName && supplierPendingBills.length > 0 && paymentPurpose === "settle_bill" && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>Pending Vendor Bills ({supplierPendingBills.length})</span>
                  <span className="text-rose-600">Click a bill to auto-allocate</span>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {supplierPendingBills.map((b) => {
                    const bal = Math.max(0, Number(b.total_amount || 0) - Number(b.paid_amount || 0));
                    const isSelected = selectedBillId === b.id;
                    return (
                      <div
                        key={b.id}
                        onClick={() => {
                          setSelectedBillId(isSelected ? "" : b.id);
                          if (!isSelected) {
                            setPaymentAmount(bal);
                          }
                        }}
                        className={`p-2 rounded-lg border text-xs flex justify-between items-center cursor-pointer transition-all ${
                          isSelected
                            ? "bg-rose-100/60 border-rose-300 text-rose-900 font-bold"
                            : "bg-white border-slate-200 hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        <div>
                          <p className="font-mono font-bold">{b.bill_number}</p>
                          <p className="text-[10px] text-slate-400">{b.bill_date ? new Date(b.bill_date).toLocaleDateString() : "Pending"}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-rose-600">{formatCurrency(bal)}</p>
                          <p className="text-[10px] text-slate-400">Total: {formatCurrency(b.total_amount)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Payment Amount & Quick Fill */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Payment Amount ({currency.symbol}) *
                </label>
                {selectedSupplierName && (
                  <button
                    type="button"
                    onClick={() => {
                      const s = suppliersList.find((x) => x.name === selectedSupplierName);
                      if (s) setPaymentAmount(s.dueBalance);
                    }}
                    className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    Pay Full Due ({formatCurrency(suppliersList.find((x) => x.name === selectedSupplierName)?.dueBalance || 0)})
                  </button>
                )}
              </div>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-base font-mono font-bold text-slate-900 bg-white focus:outline-none focus:border-rose-500 shadow-2xs"
                required
              />
            </div>

            {/* Date & Voucher Reference */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Payment Date
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 bg-white focus:outline-none focus:border-rose-500 shadow-2xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Voucher / Ref #
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. TXN-102948"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 bg-white focus:outline-none focus:border-rose-500 shadow-2xs"
                  required
                />
              </div>
            </div>

            {/* Payment Tender / Mode */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                Payment Mode / Tender
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-rose-500 shadow-2xs"
              >
                <option value="Bank Transfer">Bank Transfer / NEFT / RTGS</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="UPI">UPI / QR</option>
                <option value="Debit Card">Debit / Credit Card</option>
                <option value="Direct/Paid">Direct/Paid</option>
              </select>
            </div>

            {/* Optional Cash Discount */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                Cash Discount / Rebate Received ({currency.symbol})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={discountReceived}
                onChange={(e) => setDiscountReceived(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 bg-white focus:outline-none focus:border-rose-500 shadow-2xs"
              />
            </div>

            {/* Notes / Remarks */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                Notes & Settlement Remarks
              </label>
              <textarea
                rows={2}
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Add cheque number, UTR reference, or settlement memo..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 bg-white focus:outline-none focus:border-rose-500 shadow-2xs"
              />
            </div>

            {/* Submit Action Buttons */}
            <div className="pt-3 border-t border-slate-200 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRecordingPayment(false)}
                className="flex-1 rounded-xl text-xs font-bold border-slate-200 cursor-pointer"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-xl text-xs font-bold gradient-brand text-white shadow-md cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    Recording...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5 mr-1" />
                    Save & Record Outflow
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* BILL DETAILS MODAL */}
      {viewingBill && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-sm">
            <div className="flex justify-between items-start border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  Vendor Purchase Bill
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  Bill #{viewingBill.bill_number}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingBill(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Supplier Vendor:</span>
                <span className="font-bold text-slate-900">{viewingBill.supplier_name || "Vendor"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Bill Date:</span>
                <span className="font-semibold text-slate-800">{viewingBill.bill_date || "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Total Billed Amount:</span>
                <span className="font-bold text-slate-900">{formatCurrency(viewingBill.total_amount)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Amount Paid:</span>
                <span className="font-bold text-emerald-600">{formatCurrency(viewingBill.paid_amount || 0)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Outstanding Due Balance:</span>
                <span className="font-bold text-rose-600">
                  {formatCurrency(Math.max(0, Number(viewingBill.total_amount || 0) - Number(viewingBill.paid_amount || 0)))}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                  {viewingBill.status || "Recorded"}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setViewingBill(null)}
                className="rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </Button>
              {Number(viewingBill.total_amount || 0) - Number(viewingBill.paid_amount || 0) > 0.01 && (
                <Button
                  onClick={() => {
                    const b = viewingBill;
                    setViewingBill(null);
                    handleOpenRecordPayment(b.supplier_name, b.id);
                  }}
                  className="rounded-xl text-xs font-bold gradient-brand text-white shadow-sm cursor-pointer"
                >
                  Settle This Bill Now
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
