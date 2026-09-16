import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  Calendar,
  Download,
  Share2,
  PlusCircle,
  FileText,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Printer,
  ChevronRight,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileSpreadsheet,
  MessageCircle,
  Eye,
  RefreshCw,
  TrendingUp,
  Receipt,
  Wallet,
  AlertCircle,
  FileCheck2,
} from "lucide-react";
import { toast } from "sonner";
import { crmCustomersApi, CustomerLedgerResponse, CustomerLedgerEntry, CrmCustomer } from "../../lib/api-client";
import { useCurrency } from "@/hooks/use-currency";
import { formatCurrency, cn } from "@/lib/utils";

interface CustomerLedgerModalProps {
  customer: CrmCustomer;
  onClose: () => void;
  onNavigateToCreateInvoice?: (customer: CrmCustomer) => void;
  onCustomerUpdated?: () => void;
}

type DatePreset = "today" | "this_week" | "this_month" | "this_quarter" | "this_fy" | "all_time" | "custom";
type DocFilter = "all" | "invoice" | "payment" | "credit_note" | "quotation";

export function CustomerLedgerModal({
  customer,
  onClose,
  onNavigateToCreateInvoice,
  onCustomerUpdated,
}: CustomerLedgerModalProps) {
  const { currency } = useCurrency();
  const fmt = (v: number) => `${currency.symbol}${Math.abs(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const [datePreset, setDatePreset] = useState<DatePreset>("this_month");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [docFilter, setDocFilter] = useState<DocFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [ledgerData, setLedgerData] = useState<CustomerLedgerResponse | null>(null);

  // Payment Recording Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payAmount, setPayAmount] = useState<string>("");
  const [payMethod, setPayMethod] = useState<string>("UPI");
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [payRef, setPayRef] = useState<string>("");
  const [payNotes, setPayNotes] = useState<string>("");
  const [recordingPayment, setRecordingPayment] = useState(false);

  // Selected Doc Preview Modal State
  const [previewDoc, setPreviewDoc] = useState<CustomerLedgerEntry | null>(null);

  // Printable Statement Ref
  const printRef = useRef<HTMLDivElement>(null);

  // Compute actual date strings based on preset
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    let start = "";
    let end = "";

    const pad = (n: number) => String(n).padStart(2, "0");
    const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (datePreset === "today") {
      start = toYMD(now);
      end = toYMD(now);
    } else if (datePreset === "this_week") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(now.setDate(diff));
      start = toYMD(monday);
      end = toYMD(new Date());
    } else if (datePreset === "this_month") {
      start = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
      end = toYMD(new Date());
    } else if (datePreset === "this_quarter") {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      start = `${now.getFullYear()}-${pad(qMonth + 1)}-01`;
      end = toYMD(new Date());
    } else if (datePreset === "this_fy") {
      // Indian FY starts April 1
      const curYear = now.getFullYear();
      const fyStartYear = now.getMonth() >= 3 ? curYear : curYear - 1;
      start = `${fyStartYear}-04-01`;
      end = toYMD(new Date());
    } else if (datePreset === "custom") {
      start = customStartDate;
      end = customEndDate;
    }

    return { startDate: start, endDate: end };
  }, [datePreset, customStartDate, customEndDate]);

  // Load Ledger
  const loadLedger = async () => {
    try {
      setLoading(true);
      const res = await crmCustomersApi.getLedger(customer.id, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        docType: docFilter === "all" ? undefined : docFilter,
        search: searchQuery || undefined,
      });
      setLedgerData(res);
      // Pre-fill payment amount if there is an outstanding balance
      if (res?.summary?.closing_balance && res.summary.closing_balance > 0) {
        setPayAmount(String(res.summary.closing_balance));
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to load customer statement & ledger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedger();
  }, [customer.id, startDate, endDate, docFilter]);

  // Handle Search Debounce / Trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      loadLedger();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Record Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) {
      toast.error("Please enter a valid payment amount greater than 0");
      return;
    }
    try {
      setRecordingPayment(true);
      await crmCustomersApi.recordPayment(customer.id, {
        amount: amt,
        payment_method: payMethod,
        payment_date: payDate,
        reference_number: payRef || undefined,
        notes: payNotes || undefined,
      });
      toast.success(`Payment of ${fmt(amt)} recorded successfully!`);
      setShowPaymentModal(false);
      setPayAmount("");
      setPayRef("");
      setPayNotes("");
      loadLedger();
      if (onCustomerUpdated) onCustomerUpdated();
    } catch (err: any) {
      toast.error(err?.message || "Failed to record payment");
    } finally {
      setRecordingPayment(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!ledgerData || !ledgerData.ledger_entries.length) {
      toast.error("No statement entries to export");
      return;
    }

    const headers = [
      "Date",
      "Type",
      "Voucher / Doc No.",
      "Reference",
      "Particulars",
      "Payment Mode",
      "Debit (+) Amount",
      "Credit (-) Amount",
      "Balance Due",
      "Running Balance",
      "Status",
    ];

    const rows = ledgerData.ledger_entries.map((e) => [
      e.formatted_date,
      e.type_label,
      e.voucher_no,
      e.reference_no || "",
      `"${e.particulars.replace(/"/g, '""')}"`,
      e.payment_mode || "",
      e.debit ? e.debit.toFixed(2) : "0.00",
      e.credit ? e.credit.toFixed(2) : "0.00",
      e.balance_due ? e.balance_due.toFixed(2) : "0.00",
      e.running_balance ? e.running_balance.toFixed(2) : "0.00",
      e.status,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Ledger_Statement_${customer.name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Customer Ledger CSV exported successfully!");
  };

  // Print / PDF Statement
  const handlePrintStatement = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Popup blocker prevented printing. Please allow popups for this site.");
      return;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Party Statement - ${customer.name}</title>
          <style>
            @page { size: A4 portrait; margin: 15mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; font-size: 11px; }
            .header-table { width: 100%; margin-bottom: 20px; border-bottom: 2px solid #6366f1; padding-bottom: 12px; }
            .party-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 20px; }
            .summary-cards { display: flex; gap: 10px; margin-bottom: 20px; }
            .card { flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; text-align: center; background: #fff; }
            .card.highlight { background: #eef2ff; border-color: #6366f1; }
            .card-title { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 4px; }
            .card-value { font-size: 15px; font-weight: bold; color: #0f172a; }
            table.ledger { width: 100%; border-collapse: collapse; margin-top: 10px; }
            table.ledger th { background: #f1f5f9; color: #334155; font-size: 10px; text-transform: uppercase; font-weight: bold; padding: 8px 6px; border: 1px solid #cbd5e1; text-align: left; }
            table.ledger td { padding: 7px 6px; border: 1px solid #e2e8f0; font-size: 10px; }
            table.ledger tr:nth-child(even) { background: #f8fafc; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .debit { color: #0f172a; font-weight: bold; }
            .credit { color: #059669; font-weight: bold; }
            .balance { color: #4338ca; font-weight: bold; }
            .footer-sig { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
            .sig-box { border-top: 1px solid #94a3b8; width: 180px; text-align: center; padding-top: 6px; font-size: 10px; color: #64748b; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  // WhatsApp Statement Share
  const handleShareWhatsApp = () => {
    if (!ledgerData) return;
    const phone = customer.whatsapp_number || customer.phone || "";
    const cleanPhone = phone.replace(/\D/g, "");

    const startStr = ledgerData.date_range.start_date !== "All Time" ? `From: ${ledgerData.date_range.start_date}` : "Period: All Time";
    const endStr = ledgerData.date_range.end_date !== "All Time" ? `To: ${ledgerData.date_range.end_date}` : "";
    const dueAmt = ledgerData.summary.closing_balance;

    const msg = `*ACCOUNT STATEMENT & LEDGER SUMMARY*
━━━━━━━━━━━━━━━━━━━━
*Customer:* ${customer.name}
${customer.company_name ? `*Company:* ${customer.company_name}\n` : ""}${startStr} ${endStr}

*Opening Balance:* ₹${ledgerData.summary.opening_balance.toFixed(2)}
*Total Invoiced (Billed):* ₹${ledgerData.summary.total_invoiced.toFixed(2)}
*Total Paid / Received:* ₹${ledgerData.summary.total_received.toFixed(2)}
*Credit Adjustments:* ₹${ledgerData.summary.total_returns.toFixed(2)}
━━━━━━━━━━━━━━━━━━━━
*NET OUTSTANDING BALANCE:* ₹${dueAmt.toFixed(2)}
${dueAmt > 0 ? `\n_Kindly arrange the payment of ₹${dueAmt.toFixed(2)} at your earliest convenience._` : `\n_Your account is fully settled. Thank you for doing business with us!_`}

_Generated via BusinessOS Platform_`;

    const url = cleanPhone
      ? `https://wa.me/${cleanPhone.startsWith("91") ? cleanPhone : "91" + cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    window.open(url, "_blank");
    toast.success("Opening WhatsApp with Party Statement summary!");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 md:p-6 overflow-hidden animate-in fade-in duration-200">
      <div className="bg-background w-full max-w-7xl h-[94vh] rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden">
        {/* TOP MODAL HEADER */}
        <div className="px-6 py-4 border-b border-border/80 bg-card/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-sm border border-indigo-500/20 shadow-xs">
              <Receipt className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground tracking-tight">{customer.name}</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                  {customer.customer_type || "Customer"}
                </span>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                    customer.status === "Active"
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      : "bg-muted text-muted-foreground border-border"
                  )}
                >
                  {customer.status || "Active"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
                {customer.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="size-3 text-muted-foreground/70" /> {customer.phone}
                  </span>
                )}
                {customer.gst_number && (
                  <span className="flex items-center gap-1 font-mono text-[11px]">
                    <Building2 className="size-3 text-muted-foreground/70" /> GST: {customer.gst_number}
                  </span>
                )}
                {(customer.city || customer.state) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3 text-muted-foreground/70" /> {[customer.city, customer.state].filter(Boolean).join(", ")}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Top Actions Bar */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPaymentModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition active:scale-95"
            >
              <PlusCircle className="size-3.5" /> Record Payment In
            </button>

            {onNavigateToCreateInvoice && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToCreateInvoice(customer);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition active:scale-95"
              >
                <FileText className="size-3.5" /> + New Bill / Invoice
              </button>
            )}

            <button
              onClick={handlePrintStatement}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/60 hover:bg-muted text-foreground text-xs font-semibold border border-border transition"
              title="Print Customer Statement PDF"
            >
              <Printer className="size-3.5" /> Print Statement
            </button>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/60 hover:bg-muted text-foreground text-xs font-semibold border border-border transition"
              title="Export Statement to CSV"
            >
              <FileSpreadsheet className="size-3.5" /> Export Excel
            </button>

            <button
              onClick={handleShareWhatsApp}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-500/20 transition"
              title="Send Statement via WhatsApp"
            >
              <MessageCircle className="size-3.5" /> WhatsApp
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition ml-2"
              title="Close"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* SUMMARY METRIC CARDS */}
        <div className="p-5 pb-3 border-b border-border/60 bg-muted/10 grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
          <div className="bg-card p-3.5 rounded-xl border border-border/70 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Opening Balance</span>
              <RotateCcw className="size-3.5 text-muted-foreground/60" />
            </div>
            <p className="text-lg font-bold text-foreground mt-2">
              {ledgerData ? fmt(ledgerData.summary.opening_balance) : "—"}
            </p>
            <span className="text-[10px] text-muted-foreground">Prior to selected period</span>
          </div>

          <div className="bg-card p-3.5 rounded-xl border border-border/70 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Total Invoiced (Debit +)</span>
              <ArrowUpRight className="size-3.5 text-indigo-600" />
            </div>
            <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-2">
              {ledgerData ? fmt(ledgerData.summary.total_invoiced) : "—"}
            </p>
            <span className="text-[10px] text-muted-foreground">Sales & POS Bills</span>
          </div>

          <div className="bg-card p-3.5 rounded-xl border border-border/70 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Total Received (Credit -)</span>
              <ArrowDownLeft className="size-3.5 text-emerald-600" />
            </div>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-2">
              {ledgerData ? fmt(ledgerData.summary.total_received) : "—"}
            </p>
            <span className="text-[10px] text-muted-foreground">Payments In / Receipts</span>
          </div>

          <div className="bg-card p-3.5 rounded-xl border border-border/70 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Returns & Credits</span>
              <RotateCcw className="size-3.5 text-amber-600" />
            </div>
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-2">
              {ledgerData ? fmt(ledgerData.summary.total_returns) : "—"}
            </p>
            <span className="text-[10px] text-muted-foreground">Sales Returns / Credit Notes</span>
          </div>

          <div
            className={cn(
              "p-3.5 rounded-xl border shadow-xs flex flex-col justify-between col-span-2 md:col-span-1",
              (ledgerData?.summary?.closing_balance || 0) > 0.05
                ? "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                {(ledgerData?.summary?.closing_balance || 0) > 0.05 ? "Net Receivable (You'll Get)" : "Account Balance"}
              </span>
              <Wallet className="size-4" />
            </div>
            <p className="text-xl font-black mt-2">
              {ledgerData ? fmt(ledgerData.summary.closing_balance) : "—"}
            </p>
            <span className="text-[10px] font-semibold opacity-80">
              {(ledgerData?.summary?.closing_balance || 0) > 0.05
                ? `${ledgerData?.summary?.unpaid_invoices_count || 0} Pending Unpaid Bills`
                : "Account fully settled"}
            </span>
          </div>
        </div>

        {/* FILTER & DATE CONTROLS BAR */}
        <div className="px-6 py-3 border-b border-border/70 bg-card/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Preset Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
              <Calendar className="size-3.5" /> Period:
            </span>
            {(
              [
                { id: "today", label: "Today" },
                { id: "this_week", label: "This Week" },
                { id: "this_month", label: "This Month" },
                { id: "this_quarter", label: "This Quarter" },
                { id: "this_fy", label: "FY 2025-26" },
                { id: "all_time", label: "All Time" },
                { id: "custom", label: "Custom Dates" },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                onClick={() => setDatePreset(p.id)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold transition",
                  datePreset === p.id
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/40"
                )}
              >
                {p.label}
              </button>
            ))}

            {datePreset === "custom" && (
              <div className="flex items-center gap-1.5 ml-2 bg-card p-1 rounded-xl border border-border">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2 py-0.5 text-xs bg-muted/30 border border-border/60 rounded-lg text-foreground focus:outline-hidden"
                />
                <span className="text-xs text-muted-foreground font-bold">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2 py-0.5 text-xs bg-muted/30 border border-border/60 rounded-lg text-foreground focus:outline-hidden"
                />
              </div>
            )}
          </div>

          {/* Doc Type Filter Tabs & Search */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-muted/60 p-0.5 rounded-xl border border-border/60">
              {(
                [
                  { id: "all", label: "All" },
                  { id: "invoice", label: "Invoices & Bills" },
                  { id: "payment", label: "Payments In" },
                  { id: "credit_note", label: "Returns / Credits" },
                  { id: "quotation", label: "Quotations" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setDocFilter(f.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition",
                    docFilter === f.id
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search doc #, item, note..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1 text-xs bg-muted/40 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-indigo-500 w-44"
              />
            </div>
          </div>
        </div>

        {/* LEDGER TRANSACTIONS TABLE */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <RefreshCw className="size-8 animate-spin text-indigo-600 mb-2" />
              <p className="text-sm font-medium">Calculating customer ledger & statement...</p>
            </div>
          ) : !ledgerData?.ledger_entries?.length ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground p-6 text-center">
              <Receipt className="size-12 text-muted-foreground/30 mb-3" />
              <p className="text-base font-bold text-foreground">No ledger transactions found</p>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                No invoices, payments, or returns recorded for this customer in the selected date range.
              </p>
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={() => {
                    setDatePreset("all_time");
                    setDocFilter("all");
                    setSearchQuery("");
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition"
                >
                  View All Time Records
                </button>
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition"
                >
                  + Record First Payment
                </button>
              </div>
            </div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-bold tracking-wider sticky top-0 z-10 backdrop-blur-xs border-b border-border">
                <tr>
                  <th className="px-4 py-3">Date & Time</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Doc / Voucher #</th>
                  <th className="px-4 py-3">Particulars & Reference</th>
                  <th className="px-3 py-3">Payment Mode</th>
                  <th className="px-4 py-3 text-right">Debit (+) Total</th>
                  <th className="px-4 py-3 text-right">Credit (-) Paid</th>
                  <th className="px-4 py-3 text-right">Balance Due</th>
                  <th className="px-4 py-3 text-right bg-indigo-500/5 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    Running Balance
                  </th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-3 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium">
                {ledgerData.ledger_entries.map((entry) => (
                  <tr
                    key={entry.id}
                    onClick={() => {
                      if (entry.type === "invoice") setPreviewDoc(entry);
                    }}
                    className={cn(
                      "hover:bg-muted/40 transition cursor-pointer group",
                      entry.type === "payment" && "bg-emerald-500/[0.02]",
                      entry.type === "credit_note" && "bg-amber-500/[0.02]"
                    )}
                  >
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {entry.formatted_date}
                    </td>

                    <td className="px-3 py-3 whitespace-nowrap">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                          entry.type === "invoice" && "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
                          entry.type === "payment" && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                          entry.type === "credit_note" && "bg-amber-500/10 text-amber-600 border-amber-500/20",
                          entry.type === "quotation" && "bg-sky-500/10 text-sky-600 border-sky-500/20"
                        )}
                      >
                        {entry.type === "invoice" && <FileText className="size-2.5" />}
                        {entry.type === "payment" && <CheckCircle2 className="size-2.5" />}
                        {entry.type === "credit_note" && <RotateCcw className="size-2.5" />}
                        {entry.type === "quotation" && <FileCheck2 className="size-2.5" />}
                        {entry.type_label}
                      </span>
                    </td>

                    <td className="px-3 py-3 font-mono font-bold text-foreground whitespace-nowrap">
                      <span className="hover:underline text-indigo-600 dark:text-indigo-400">{entry.voucher_no}</span>
                    </td>

                    <td className="px-4 py-3 max-w-xs truncate text-foreground">
                      <p className="font-semibold truncate">{entry.particulars}</p>
                      {entry.reference_no && (
                        <p className="text-[10px] text-muted-foreground font-mono truncate">{entry.reference_no}</p>
                      )}
                    </td>

                    <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                      <span className="px-1.5 py-0.5 rounded bg-muted/60 text-[10px] font-semibold border border-border/50">
                        {entry.payment_mode || "—"}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right font-bold text-foreground whitespace-nowrap">
                      {entry.debit > 0 ? fmt(entry.debit) : "—"}
                    </td>

                    <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {entry.credit > 0 ? fmt(entry.credit) : "—"}
                    </td>

                    <td className="px-4 py-3 text-right font-semibold text-muted-foreground whitespace-nowrap">
                      {entry.type === "invoice" ? (entry.balance_due > 0.05 ? fmt(entry.balance_due) : "₹0.00") : "—"}
                    </td>

                    <td className="px-4 py-3 text-right font-black text-indigo-600 dark:text-indigo-400 bg-indigo-500/5 dark:bg-indigo-500/10 whitespace-nowrap">
                      {fmt(entry.running_balance)}
                    </td>

                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                          entry.status === "Paid" || entry.status === "Settled"
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            : entry.status === "Partially Paid"
                            ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                            : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                        )}
                      >
                        {entry.status}
                      </span>
                    </td>

                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewDoc(entry);
                        }}
                        className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
                        title="View Document Details"
                      >
                        <Eye className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* BOTTOM FOOTER / SUMMARY BAR */}
        <div className="px-6 py-3 border-t border-border/80 bg-card/60 flex items-center justify-between text-xs text-muted-foreground shrink-0">
          <div>
            Showing <strong className="text-foreground">{ledgerData?.ledger_entries?.length || 0}</strong> transactions for period:{" "}
            <span className="font-semibold text-foreground">
              {ledgerData?.date_range?.start_date || "All Time"} ➔ {ledgerData?.date_range?.end_date || "All Time"}
            </span>
          </div>

          <div className="flex items-center gap-6">
            <span>
              Closing Ledger Balance:{" "}
              <strong
                className={cn(
                  "text-sm font-black ml-1",
                  (ledgerData?.summary?.closing_balance || 0) > 0.05
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-emerald-600 dark:text-emerald-400"
                )}
              >
                {ledgerData ? fmt(ledgerData.summary.closing_balance) : "—"}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* RECORD PAYMENT IN MODAL */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-150">
          <div className="bg-background rounded-2xl border border-border shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-600 font-bold flex items-center justify-center">
                  <CreditCard className="size-4" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Record Payment In</h3>
                  <p className="text-xs text-muted-foreground">{customer.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-foreground mb-1">Payment Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-muted/30 border border-border rounded-xl text-foreground font-bold text-base focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Current Net Balance Due:{" "}
                  <strong className="text-rose-600">
                    {ledgerData ? fmt(ledgerData.summary.closing_balance) : "—"}
                  </strong>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-foreground mb-1">Payment Mode *</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-muted/30 border border-border rounded-xl text-foreground font-medium focus:outline-hidden"
                  >
                    <option value="UPI">UPI / QR Code</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer / NEFT</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-foreground mb-1">Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 bg-muted/30 border border-border rounded-xl text-foreground font-medium focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">Reference / Transaction ID</label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="e.g. UPI-9281928, CHQ-00129"
                  className="w-full px-3 py-2 bg-muted/30 border border-border rounded-xl text-foreground font-medium focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">Notes / Remarks</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Optional remark"
                  className="w-full px-3 py-2 bg-muted/30 border border-border rounded-xl text-foreground font-medium focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 rounded-xl bg-muted text-foreground font-bold hover:bg-muted/80 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordingPayment}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition flex items-center gap-1.5"
                >
                  {recordingPayment && <RefreshCw className="size-3.5 animate-spin" />}
                  Save Payment Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DOCUMENT DETAIL PREVIEW POPUP */}
      {previewDoc && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-150">
          <div className="bg-background rounded-2xl border border-border shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="size-9 rounded-xl bg-indigo-500/10 text-indigo-600 font-bold flex items-center justify-center">
                  <FileText className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">{previewDoc.voucher_no}</h3>
                  <p className="text-xs text-muted-foreground">{previewDoc.type_label} • {previewDoc.formatted_date}</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-muted/20 p-3 rounded-xl border border-border/60">
              <div>
                <p className="text-muted-foreground font-medium">Customer</p>
                <p className="font-bold text-foreground">{customer.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground font-medium">Status</p>
                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                  {previewDoc.status}
                </span>
              </div>
              <div>
                <p className="text-muted-foreground font-medium">Payment Terms / Mode</p>
                <p className="font-bold text-foreground">{previewDoc.payment_mode || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground font-medium">Reference</p>
                <p className="font-mono text-foreground">{previewDoc.reference_no || "—"}</p>
              </div>
            </div>

            {/* Itemized Line Items (if available) */}
            {previewDoc.items && previewDoc.items.length > 0 ? (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Line Items</h4>
                <div className="border border-border rounded-xl overflow-hidden text-xs">
                  <table className="w-full">
                    <thead className="bg-muted/50 text-[10px] uppercase font-bold text-muted-foreground border-b border-border">
                      <tr>
                        <th className="px-3 py-2 text-left">Item</th>
                        <th className="px-3 py-2 text-center">Qty</th>
                        <th className="px-3 py-2 text-right">Price</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {previewDoc.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 font-medium text-foreground">{item.item_name}</td>
                          <td className="px-3 py-2 text-center text-muted-foreground">{item.quantity}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{fmt(item.unit_price)}</td>
                          <td className="px-3 py-2 text-right font-bold text-foreground">{fmt(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {/* Financial Summary */}
            <div className="bg-card p-3 rounded-xl border border-border space-y-1.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Total Amount</span>
                <span className="font-bold text-foreground">{fmt(previewDoc.debit || previewDoc.credit || 0)}</span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>Amount Paid</span>
                <span className="font-bold">{fmt(previewDoc.amount_paid || 0)}</span>
              </div>
              <div className="flex justify-between text-rose-600 font-bold border-t border-border pt-1.5 text-sm">
                <span>Balance Due</span>
                <span>{fmt(previewDoc.balance_due || 0)}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HIDDEN PRINTABLE TEMPLATE (A4 PARTY STATEMENT) */}
      <div className="hidden">
        <div ref={printRef}>
          <table className="header-table">
            <tbody>
              <tr>
                <td>
                  <h1 style={{ margin: 0, fontSize: "20px", color: "#4338ca" }}>CUSTOMER ACCOUNT STATEMENT</h1>
                  <p style={{ margin: "3px 0", color: "#64748b", fontSize: "11px" }}>Detailed Ledger & Transaction Register</p>
                </td>
                <td style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontWeight: "bold" }}>Date Generated: {new Date().toLocaleDateString("en-IN")}</p>
                  <p style={{ margin: "2px 0", color: "#64748b" }}>
                    Period: {ledgerData?.date_range?.start_date} to {ledgerData?.date_range?.end_date}
                  </p>
                </td>
              </tr>
            </tbody>
          </table>

          <div className="party-box">
            <table style={{ width: "100%" }}>
              <tbody>
                <tr>
                  <td style={{ verticalAlign: "top", width: "50%" }}>
                    <p style={{ margin: "0 0 2px 0", fontWeight: "bold", fontSize: "13px" }}>{customer.name}</p>
                    {customer.company_name && <p style={{ margin: "0 0 2px 0", color: "#475569" }}>{customer.company_name}</p>}
                    <p style={{ margin: "0 0 2px 0" }}>Phone: {customer.phone || "—"}</p>
                    <p style={{ margin: "0 0 2px 0" }}>Email: {customer.email || "—"}</p>
                    <p style={{ margin: "0 0 2px 0" }}>GSTIN: {customer.gst_number || "Unregistered"}</p>
                  </td>
                  <td style={{ verticalAlign: "top", width: "50%", textAlign: "right" }}>
                    <p style={{ margin: "0 0 2px 0", fontWeight: "bold", color: "#64748b" }}>Billing Address:</p>
                    <p style={{ margin: 0, color: "#334155" }}>
                      {customer.address || customer.billing_address || "Registered Customer Account"}
                    </p>
                    <p style={{ margin: "2px 0 0 0", color: "#334155" }}>
                      {[customer.city, customer.state, customer.postal_code].filter(Boolean).join(", ")}
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="summary-cards">
            <div className="card">
              <div className="card-title">Opening Balance</div>
              <div className="card-value">₹{ledgerData?.summary?.opening_balance?.toFixed(2) || "0.00"}</div>
            </div>
            <div className="card">
              <div className="card-title">Total Invoiced (Debit +)</div>
              <div className="card-value">₹{ledgerData?.summary?.total_invoiced?.toFixed(2) || "0.00"}</div>
            </div>
            <div className="card">
              <div className="card-title">Total Received (Credit -)</div>
              <div className="card-value">₹{ledgerData?.summary?.total_received?.toFixed(2) || "0.00"}</div>
            </div>
            <div className="card highlight">
              <div className="card-title" style={{ color: "#4338ca" }}>Closing Net Balance Due</div>
              <div className="card-value" style={{ color: "#4338ca" }}>
                ₹{ledgerData?.summary?.closing_balance?.toFixed(2) || "0.00"}
              </div>
            </div>
          </div>

          <table className="ledger">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Voucher #</th>
                <th>Particulars</th>
                <th>Mode</th>
                <th className="text-right">Debit (+) ₹</th>
                <th className="text-right">Credit (-) ₹</th>
                <th className="text-right">Running Balance ₹</th>
              </tr>
            </thead>
            <tbody>
              {ledgerData?.ledger_entries?.map((e) => (
                <tr key={e.id}>
                  <td>{e.formatted_date}</td>
                  <td>{e.type_label}</td>
                  <td style={{ fontFamily: "monospace", fontWeight: "bold" }}>{e.voucher_no}</td>
                  <td>{e.particulars}</td>
                  <td>{e.payment_mode || "—"}</td>
                  <td className="text-right debit">{e.debit > 0 ? e.debit.toFixed(2) : "—"}</td>
                  <td className="text-right credit">{e.credit > 0 ? e.credit.toFixed(2) : "—"}</td>
                  <td className="text-right balance">₹{e.running_balance.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="footer-sig">
            <div style={{ fontSize: "10px", color: "#64748b" }}>
              * This is a computer generated customer ledger statement.
            </div>
            <div className="sig-box">
              Authorized Signatory
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
