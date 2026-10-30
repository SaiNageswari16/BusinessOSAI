import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  ArrowLeft,
  Building2,
  Calendar as CalendarIcon,
  Search,
  Download,
  Printer,
  Mail,
  Share2,
  Star,
  RefreshCw,
  ChevronDown,
  Clock,
  CheckCircle2,
  X,
  FileSpreadsheet,
  TrendingUp,
  Info,
  Receipt,
  CreditCard,
  Phone,
  Landmark,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { formatDisplayDate, formatDisplayDateTime, getTodayDateString, parseSafeDateTimestamp } from "@/lib/utils";
import { ReportEmailModal } from "./ReportEmailModal";
import * as XLSX from "xlsx";
import { inventoryApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

export interface SupplierRecord {
  id: string;
  name: string;
  category: string;
  phone: string;
  email?: string;
  gstin?: string;
  address?: string;
  openingBalance: number;
  closingBalance: number; // Positive = To Pay (Liability), Negative = To Collect (Advance)
  totalBilled: number;
  totalPaid: number;
  openBillsCount: number;
  totalBillsCount: number;
}

interface SearchableSupplierSelectProps {
  value: string;
  onChange: (supplierName: string) => void;
  suppliers: SupplierRecord[];
  placeholder?: string;
  className?: string;
}

function SearchableSupplierSelect({
  value,
  onChange,
  suppliers,
  placeholder = "Search Supplier...",
  className = "",
}: SearchableSupplierSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.phone && s.phone.includes(q)) ||
        (s.gstin && s.gstin.toLowerCase().includes(q))
    );
  }, [suppliers, search]);

  const selectedSupplier = suppliers.find((s) => s.name.toLowerCase() === (value || "").toLowerCase());

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 px-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between cursor-pointer hover:border-slate-300 transition-colors shadow-2xs text-xs font-medium text-slate-700"
      >
        <div className="flex items-center gap-1.5 truncate">
          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">{selectedSupplier ? selectedSupplier.name : value || placeholder}</span>
        </div>
        <div className="flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
                setSearch("");
              }}
              className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
              title="Clear selection"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
        </div>
      </div>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50">
          <div className="px-2 pb-1.5 border-b border-slate-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search supplier, phone, GSTIN..."
                autoFocus
                className="w-full pl-7 pr-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-center text-xs text-slate-400 font-medium">
                No matching suppliers found
              </div>
            ) : (
              filtered.map((s) => (
                <div
                  key={s.id || s.name}
                  onClick={() => {
                    onChange(s.name);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={`px-3 py-2 text-xs cursor-pointer hover:bg-slate-50 flex items-center justify-between ${
                    s.name.toLowerCase() === (value || "").toLowerCase() ? "bg-indigo-50/70 text-indigo-700 font-semibold" : "text-slate-700"
                  }`}
                >
                  <div className="truncate pr-2">
                    <div className="truncate font-medium">{s.name}</div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                      {s.phone && <span>📞 {s.phone}</span>}
                      {s.category && <span>• {s.category}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        s.closingBalance > 0.01
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : s.closingBalance < -0.01
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {s.closingBalance > 0.01
                        ? `To Pay ₹${s.closingBalance.toFixed(0)}`
                        : s.closingBalance < -0.01
                        ? `Advance ₹${Math.abs(s.closingBalance).toFixed(0)}`
                        : "Settled"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface PurchaseStatementSuiteProps {
  onBack?: () => void;
  initialSupplierName?: string;
}

export function PurchaseStatementSuite({ onBack, initialSupplierName }: PurchaseStatementSuiteProps) {
  const { tenant } = useTenant();
  const { formatCurrency } = useCurrency();

  // State
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [selectedSupplierName, setSelectedSupplierName] = useState<string>(initialSupplierName || "");
  const [vendorBills, setVendorBills] = useState<any[]>([]);
  const [vendorPayments, setVendorPayments] = useState<any[]>([]);
  const [vendorDebitNotes, setVendorDebitNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFavourite, setIsFavourite] = useState<boolean>(false);

  // Filters
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customStartDate, setCustomStartDate] = useState<string>(getTodayDateString());
  const [customEndDate, setCustomEndDate] = useState<string>(getTodayDateString());

  // Export & Email State
  const [showExcelDropdown, setShowExcelDropdown] = useState<boolean>(false);
  const [emailModalOpen, setEmailModalOpen] = useState<boolean>(false);

  // Load procurement data from backend API
  const loadProcurementData = async () => {
    setLoading(true);
    try {
      const [billsRes, paymentsRes, debitsRes, suppsRes] = await Promise.all([
        inventoryApi.getVendorBills().catch(() => []),
        inventoryApi.getVendorPayments().catch(() => []),
        inventoryApi.getVendorDebitNotes().catch(() => []),
        inventoryApi.getSuppliers().catch(() => []),
      ]);

      const bills = Array.isArray(billsRes) ? billsRes : [];
      const payments = Array.isArray(paymentsRes) ? paymentsRes : [];
      const debits = Array.isArray(debitsRes) ? debitsRes : [];
      const rawSupps = Array.isArray(suppsRes) ? suppsRes : [];

      setVendorBills(bills);
      setVendorPayments(payments);
      setVendorDebitNotes(debits);

      // Build unified suppliers map
      const supplierMap = new Map<string, SupplierRecord>();

      // 1. Ingest Master Suppliers
      rawSupps.forEach((s: any) => {
        const sName = (s.name || s.company_name || s.contact_name || "").trim();
        if (!sName) return;
        const key = sName.toLowerCase();
        const opBal = Number(s.opening_balance || s.outstanding_balance || 0);

        supplierMap.set(key, {
          id: String(s.id || `supp_${key}`),
          name: sName,
          category: s.category || s.type || "Vendor",
          phone: s.phone || s.mobile || "—",
          email: s.email || "",
          gstin: s.gstin || s.gst_number || "",
          address: s.address || s.city || "",
          openingBalance: opBal,
          closingBalance: opBal, // positive = we owe them (To Pay)
          totalBilled: 0,
          totalPaid: 0,
          openBillsCount: 0,
          totalBillsCount: 0,
        });
      });

      // 2. Ingest Bills to track totals and auto-register vendors not in master
      bills.forEach((b: any) => {
        const rawStatus = String(b.status || "").toLowerCase();
        if (rawStatus === "cancelled" || rawStatus === "voided") return;

        const sName = (b.supplier_name || b.vendor_name || b.supplier?.name || "Vendor").trim();
        const key = sName.toLowerCase();
        const invoiced = Number(b.total_amount || b.amount || 0);
        const paid = Number(b.paid_amount || b.amount_paid || 0);
        const due = invoiced - paid;

        let rec = supplierMap.get(key);
        if (!rec) {
          rec = {
            id: String(b.supplier_id || `supp_${key}`),
            name: sName,
            category: "Supplier / Vendor",
            phone: b.supplier_phone || b.phone || "—",
            email: b.supplier_email || "",
            gstin: b.supplier_gstin || b.gstin || "",
            address: b.supplier_address || "",
            openingBalance: 0,
            closingBalance: 0,
            totalBilled: 0,
            totalPaid: 0,
            openBillsCount: 0,
            totalBillsCount: 0,
          };
          supplierMap.set(key, rec);
        }

        rec.totalBilled += invoiced;
        rec.totalPaid += paid;
        rec.closingBalance += due;
        rec.totalBillsCount += 1;
        if (due > 0.01) {
          rec.openBillsCount += 1;
        }
      });

      // 3. Subtract Vendor Payments & Debit Notes
      payments.forEach((p: any) => {
        const sName = (p.supplier_name || p.vendor_name || "").trim();
        if (!sName) return;
        const key = sName.toLowerCase();
        const rec = supplierMap.get(key);
        if (rec) {
          const amt = Number(p.amount_paid || p.amount || 0);
          rec.totalPaid += amt;
          rec.closingBalance -= amt;
        }
      });

      debits.forEach((d: any) => {
        const sName = (d.supplier_name || d.supplier?.name || "").trim();
        if (!sName) return;
        const key = sName.toLowerCase();
        const rec = supplierMap.get(key);
        if (rec) {
          const amt = Number(d.amount || 0);
          rec.closingBalance -= amt;
        }
      });

      const list = Array.from(supplierMap.values()).sort((a, b) => b.closingBalance - a.closingBalance);
      setSuppliers(list);

      // Select default supplier if none selected
      if (list.length > 0 && !selectedSupplierName) {
        setSelectedSupplierName(list[0].name);
      }
    } catch (err: any) {
      console.error("Failed to load purchase statement records:", err);
      toast.error(err.message || "Failed to load supplier records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProcurementData();
  }, [tenant?.id]);

  // Active Selected Supplier
  const activeSupplier = useMemo(() => {
    if (!selectedSupplierName) return suppliers[0] || null;
    return (
      suppliers.find((s) => s.name.toLowerCase() === selectedSupplierName.toLowerCase() || s.id === selectedSupplierName) ||
      suppliers[0] ||
      null
    );
  }, [suppliers, selectedSupplierName]);

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
  // PURCHASE STATEMENT (SUPPLIER LEDGER) COMPUTATION
  // ─────────────────────────────────────────────────────────────
  const ledgerData = useMemo(() => {
    if (!activeSupplier) {
      return { rows: [], totalPayable: 0, overdue: 0, totalPurchase: 0, totalPaid: 0 };
    }

    const sName = (activeSupplier.name || "").toLowerCase().trim();
    const sPhone = (activeSupplier.phone || "").replace(/\D/g, "");
    const sId = activeSupplier.id ? String(activeSupplier.id) : "";

    // 1. Filter Vendor Bills for this supplier
    const matchedBills = vendorBills.filter((b: any) => {
      const rawStatus = String(b.status || "").toLowerCase();
      if (rawStatus === "cancelled" || rawStatus === "voided") return false;

      const billSName = (b.supplier_name || b.vendor_name || b.supplier?.name || "").toLowerCase().trim();
      const billPhone = (b.supplier_phone || b.phone || "").replace(/\D/g, "");
      const billSId = b.supplier_id ? String(b.supplier_id) : "";

      const matchesName = billSName && (billSName === sName || billSName.includes(sName) || sName.includes(billSName));
      const matchesId = billSId && (billSId === sId || sId.includes(billSId));
      const matchesPhone = sPhone && sPhone.length >= 10 && billPhone && billPhone.endsWith(sPhone.slice(-10));

      return (matchesName || matchesId || matchesPhone) && isDateInFilter(b.bill_date || b.created_at);
    });

    const matchedBillIds = new Set<string>();
    const matchedBillNumbers = new Set<string>();
    matchedBills.forEach((b: any) => {
      if (b.id) matchedBillIds.add(String(b.id));
      const num = String(b.bill_number || "").trim().toUpperCase();
      if (num) matchedBillNumbers.add(num);
    });

    // 2. Filter Payment Out Records for this supplier
    const matchedPayments = vendorPayments.filter((p: any) => {
      const pSName = (p.supplier_name || p.vendor_name || "").toLowerCase().trim();
      const pBillId = p.vendor_bill_id ? String(p.vendor_bill_id) : "";
      const pBillNo = String(p.bill_number || "").trim().toUpperCase();

      const matchesDirectBill = (pBillId && matchedBillIds.has(pBillId)) || (pBillNo && matchedBillNumbers.has(pBillNo));
      const matchesName = pSName && (pSName === sName || pSName.includes(sName) || sName.includes(pSName));

      return (matchesDirectBill || matchesName) && isDateInFilter(p.payment_date || p.created_at);
    });

    // 3. Filter Debit Notes for this supplier
    const matchedDebitNotes = vendorDebitNotes.filter((dn: any) => {
      const dnSName = (dn.supplier_name || dn.supplier?.name || "").toLowerCase().trim();
      const dnSId = dn.supplier_id ? String(dn.supplier_id) : "";
      const matchesName = dnSName && (dnSName === sName || dnSName.includes(sName) || sName.includes(dnSName));
      const matchesId = dnSId && (dnSId === sId || sId.includes(dnSId));
      return (matchesName || matchesId) && isDateInFilter(dn.created_at || dn.date);
    });

    interface TimelineEvent {
      timestamp: number;
      date: string;
      rawDate: string;
      voucher: string;
      srNo: string;
      paymentMode: string;
      debit: number;
      credit: number;
      balance: number;
      dueDate: string;
      type: "bill" | "payment" | "debit_note";
      billNumber?: string;
    }

    const events: TimelineEvent[] = [];
    let totPurchases = 0;
    let totPayments = 0;
    let overdueAmt = 0;

    const paymentsAllocatedPerBill = new Map<string, number>();
    const processedPaymentIds = new Set<string>();

    // Process explicit matched Payment Out vouchers (Debit entries)
    matchedPayments.forEach((p: any, idx: number) => {
      const pId = String(p.id || p.reference_number || `pay_${idx}`);
      if (processedPaymentIds.has(pId)) return;
      processedPaymentIds.add(pId);

      const amt = Number(p.amount_paid || p.amount || 0);
      if (amt <= 0) return;

      const pDate = p.payment_date || p.created_at;
      const refNo = p.reference_number || `TXN-${String(p.id || idx + 1000).slice(0, 8).toUpperCase()}`;
      const billRef = p.bill_number ? ` (#${p.bill_number})` : "";
      const mode = p.payment_method || "Bank Transfer";

      if (p.bill_number) {
        const key = String(p.bill_number).trim().toUpperCase();
        paymentsAllocatedPerBill.set(key, (paymentsAllocatedPerBill.get(key) || 0) + amt);
      }

      totPayments += amt;

      events.push({
        timestamp: parseSafeDateTimestamp(pDate) || Date.now(),
        date: formatDisplayDate(pDate),
        rawDate: pDate,
        voucher: `Payment Out #${refNo}${billRef}`,
        srNo: refNo,
        paymentMode: mode,
        debit: amt, // Debit reduces supplier liability
        credit: 0,
        balance: 0,
        dueDate: "—",
        type: "payment",
        billNumber: p.bill_number,
      });
    });

    // Process Vendor Bills (Credit entries)
    matchedBills.forEach((b: any, idx: number) => {
      const bDate = b.bill_date || b.created_at;
      const bNo = b.bill_number || `BILL-${1000 + idx}`;
      const total = Number(b.total_amount || b.amount || 0);
      const paidOnBill = Number(b.paid_amount || b.amount_paid || 0);
      const mode = b.payment_mode || (paidOnBill >= total ? "Settled" : "Credit Terms");
      const dueDate = b.due_date ? formatDisplayDate(b.due_date) : "Immediate";

      totPurchases += total;

      // Check overdue status
      if (b.due_date) {
        const dueTs = parseSafeDateTimestamp(b.due_date);
        if (dueTs && dueTs < Date.now() && total > paidOnBill) {
          overdueAmt += (total - paidOnBill);
        }
      }

      // Credit entry: Purchase bill increases liability
      events.push({
        timestamp: parseSafeDateTimestamp(bDate) || 0,
        date: formatDisplayDate(bDate),
        rawDate: bDate,
        voucher: b.po_number ? `Purchase Invoice #${bNo} (#${b.po_number})` : `Purchase Invoice #${bNo}`,
        srNo: b.po_number || `PO-${101 + idx}`,
        paymentMode: mode,
        credit: total,
        debit: 0,
        balance: 0,
        dueDate: dueDate,
        type: "bill",
        billNumber: bNo,
      });

      // Upfront payment recorded on bill not covered by explicit Payment Out
      const billKey = String(bNo).trim().toUpperCase();
      const alreadyAllocated = paymentsAllocatedPerBill.get(billKey) || 0;
      const unallocatedPaid = Math.max(0, paidOnBill - alreadyAllocated);

      if (unallocatedPaid > 0.05) {
        totPayments += unallocatedPaid;
        events.push({
          timestamp: (parseSafeDateTimestamp(bDate) || 0) + 1,
          date: formatDisplayDate(bDate),
          rawDate: bDate,
          voucher: `Payment Out #${bNo} (Bill Settlement)`,
          srNo: `SETTLE-${201 + idx}`,
          paymentMode: mode,
          debit: unallocatedPaid,
          credit: 0,
          balance: 0,
          dueDate: "—",
          type: "payment",
          billNumber: bNo,
        });
      }
    });

    // Process Vendor Debit Notes (Debit entries)
    matchedDebitNotes.forEach((dn: any, idx: number) => {
      const dnDate = dn.created_at || dn.date;
      const dnNo = dn.note_number || dn.reference_number || `DN-${1000 + idx}`;
      const amt = Number(dn.amount || 0);
      if (amt <= 0) return;

      events.push({
        timestamp: parseSafeDateTimestamp(dnDate) || 0,
        date: formatDisplayDate(dnDate),
        rawDate: dnDate,
        voucher: `Vendor Debit Note #${dnNo}`,
        srNo: dnNo,
        paymentMode: dn.notes ? `Adjustment (${dn.notes})` : "Purchase Return",
        debit: amt, // Debit reduces supplier liability
        credit: 0,
        balance: 0,
        dueDate: "—",
        type: "debit_note",
      });
    });

    // Chronological Sort: Oldest to newest
    // For identical timestamps: Bill (Credit) comes before Payment (Debit)
    events.sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      if (a.type === "bill" && a.type !== b.type) return -1;
      if (b.type === "bill" && a.type !== b.type) return 1;
      return 0;
    });

    // Compute Chronological Running Balance
    const opBal = activeSupplier.openingBalance || 0;
    let runningBalance = opBal;
    const rows: any[] = [];

    // Row 1: Opening Balance
    rows.push({
      date: "—",
      voucher: "Opening Balance",
      srNo: "—",
      paymentMode: "—",
      credit: opBal > 0 ? opBal : 0,
      debit: opBal < 0 ? Math.abs(opBal) : 0,
      balance: runningBalance,
      dueDate: "—",
      isSummaryRow: true,
    });

    events.forEach((ev) => {
      if (ev.credit > 0) {
        runningBalance += ev.credit; // Bills increase liability
      }
      if (ev.debit > 0) {
        runningBalance -= ev.debit; // Payments/Debit notes decrease liability
      }
      ev.balance = runningBalance;
      rows.push(ev);
    });

    // Final Row: Closing Balance
    const totalPayable = runningBalance > 0 ? Math.round(runningBalance * 100) / 100 : 0;
    rows.push({
      date: "—",
      voucher: "Closing Balance",
      srNo: "—",
      paymentMode: "—",
      credit: totalPayable > 0 ? totalPayable : 0,
      debit: runningBalance < 0 ? Math.abs(runningBalance) : 0,
      balance: runningBalance,
      dueDate: "—",
      isSummaryRow: true,
    });

    return {
      rows,
      totalPayable,
      overdue: overdueAmt,
      totalPurchase: totPurchases,
      totalPaid: totPayments,
    };
  }, [activeSupplier, vendorBills, vendorPayments, vendorDebitNotes, dateFilter, customStartDate, customEndDate]);

  // ── Share WhatsApp ──────────────────────────────────────────
  const handleShareWhatsApp = () => {
    if (!activeSupplier || !activeSupplier.phone || activeSupplier.phone === "—") {
      toast.error("No valid phone number for this supplier.");
      return;
    }
    const cleanPhone = activeSupplier.phone.replace(/[^0-9]/g, "");
    const company = (tenant as any)?.name || "IOTRONCS ERP";
    const msg = `Dear ${activeSupplier.name},\nYour Purchase Account Statement Balance with ${company} is ${formatCurrency(ledgerData.totalPayable)}. Overdue balance: ${formatCurrency(ledgerData.overdue)}.\nThank you for your valued partnership!`;
    window.open(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`, "_blank");
    toast.success(`Opening WhatsApp for ${activeSupplier.name}`);
  };

  // ── Build Export Rows (for Excel Download & Email Modal) ──
  const buildExportData = () => {
    const sName = activeSupplier?.name || "Supplier";
    const filename = `purchase_statement_${sName.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}`;
    const rows: any[][] = [];
    const company = (tenant as any)?.name || "IOTRONCS ERP";

    rows.push([`${company} - PURCHASE STATEMENT (SUPPLIER LEDGER)`]);
    rows.push([`Supplier: ${sName} | Phone: ${activeSupplier?.phone || "—"} | GSTIN: ${activeSupplier?.gstin || "—"}`]);
    rows.push([
      `Total Purchases: ₹${ledgerData.totalPurchase.toFixed(2)} | Total Paid: ₹${ledgerData.totalPaid.toFixed(2)} | Net Payable: ₹${ledgerData.totalPayable.toFixed(2)} | Overdue: ₹${ledgerData.overdue.toFixed(2)}`,
    ]);
    rows.push([]);
    rows.push(["Date", "Voucher", "Sr No", "Payment Mode", "Credit (₹)", "Debit (₹)", "Running Balance (₹)", "Due Date / Status"]);

    (ledgerData.rows || []).forEach((r: any) => {
      rows.push([
        r.date === "—" ? "-" : r.date,
        r.voucher,
        r.srNo === "—" ? "-" : r.srNo,
        r.paymentMode === "—" ? "-" : r.paymentMode,
        r.credit > 0 ? Number(r.credit.toFixed(2)) : "-",
        r.debit > 0 ? Number(r.debit.toFixed(2)) : "-",
        Number(r.balance.toFixed(2)),
        r.dueDate === "—" ? "-" : r.dueDate,
      ]);
    });

    return {
      title: `Purchase Statement: ${sName}`,
      filename,
      rows,
    };
  };

  // ── Export Excel / CSV ──────────────────────────────────────
  const handleExport = (format: "xlsx" | "csv") => {
    const { filename, rows } = buildExportData();
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Apply auto column widths
    const maxCols = rows.reduce((max, r) => Math.max(max, r.length), 0);
    ws["!cols"] = Array.from({ length: maxCols }, () => ({ wch: 22 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Purchase Statement");

    if (format === "xlsx") {
      XLSX.writeFile(wb, `${filename}.xlsx`);
      toast.success("Exported Purchase Statement as Excel (.xlsx)!");
    } else {
      XLSX.writeFile(wb, `${filename}.csv`, { bookType: "csv" });
      toast.success("Exported Purchase Statement as CSV (.csv)!");
    }
  };

  // ── Print PDF ───────────────────────────────────────────────
  const handlePrintPDF = () => {
    window.print();
  };

  const exportData = buildExportData();

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      {/* ──────────────────────────────────────────────────────────────────────────
          TOP ACTION & FILTERING TOOLBAR (EXACT SAME AS PARTY STATEMENT)
      ────────────────────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 px-5 py-3 shrink-0">
        <div className="space-y-3.5">
          {/* Row 1: Back + Title + Favourite & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (onBack) onBack();
                  else window.history.back();
                }}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-slate-700"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-base font-bold text-slate-900">Purchase Statement (Ledger)</h1>
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

            {/* Action Buttons: WhatsApp, Email Excel, Download Excel, Print PDF */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleShareWhatsApp}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>WhatsApp</span>
              </button>

              <button
                onClick={() => setEmailModalOpen(true)}
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
                        handleExport("xlsx");
                        setShowExcelDropdown(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Download Excel (.xlsx)
                    </button>
                    <button
                      onClick={() => {
                        handleExport("csv");
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
            {/* Card 1: Total Payable Amount */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center gap-2 text-slate-600">
                <div className="size-6 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 font-semibold text-xs">
                  ₹
                </div>
                <span className="text-xs font-medium text-slate-600">Total Payable Amount</span>
              </div>
              <div className="text-lg font-bold text-slate-900 mt-2 font-mono">
                {ledgerData.totalPayable > 0 ? formatCurrency(ledgerData.totalPayable) : "₹ 0"}
              </div>
            </div>

            {/* Card 2: Overdue Amount */}
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

            {/* Card 3: Total Purchase Amount */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center gap-2 text-slate-600">
                <div className="size-6 rounded-full border border-blue-200 bg-blue-50/50 flex items-center justify-center text-blue-600 text-xs">
                  <TrendingUp className="size-3.5" />
                </div>
                <span className="text-xs font-medium text-blue-600">Total Purchase Amount</span>
              </div>
              <div className="text-lg font-bold text-slate-900 mt-2 font-mono">
                {ledgerData.totalPurchase > 0 ? formatCurrency(ledgerData.totalPurchase) : "₹ 0"}
              </div>
            </div>

            {/* Card 4: Total Paid Amount */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center gap-2 text-slate-600">
                <div className="size-6 rounded-full border border-emerald-200 bg-emerald-50/50 flex items-center justify-center text-emerald-600 text-xs">
                  <CheckCircle2 className="size-3.5" />
                </div>
                <span className="text-xs font-medium text-emerald-600">Total Paid Amount</span>
              </div>
              <div className="text-lg font-bold text-slate-900 mt-2 font-mono">
                {ledgerData.totalPaid > 0 ? formatCurrency(ledgerData.totalPaid) : "₹ 0"}
              </div>
            </div>
          </div>

          {/* Row 3: Search Supplier Select + Date Range Filter */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-3">
              <SearchableSupplierSelect
                value={selectedSupplierName}
                onChange={setSelectedSupplierName}
                suppliers={suppliers}
                placeholder="Search Supplier (e.g. Sunrise Agro)..."
                className="w-64"
              />

              <div className="relative flex items-center">
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
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

            {/* Quick Supplier Contact & Info Pill */}
            {activeSupplier && (
              <div className="hidden md:flex items-center gap-3 text-xs text-slate-500">
                {activeSupplier.phone && activeSupplier.phone !== "—" && (
                  <span className="flex items-center gap-1 font-mono">
                    <Phone className="size-3 text-slate-400" /> {activeSupplier.phone}
                  </span>
                )}
                {activeSupplier.gstin && activeSupplier.gstin !== "—" && (
                  <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700">
                    GSTIN: {activeSupplier.gstin}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ──────────────────────────────────────────────────────────────────────────
          MAIN REPORT BODY: CHRONOLOGICAL DOUBLE-ENTRY TABLE
      ────────────────────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
            <p className="text-sm font-bold text-slate-700">Loading purchase statement...</p>
            <p className="text-xs text-slate-400 mt-1">Fetching vendor bills and payment out records from database</p>
          </div>
        ) : (
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
                  {ledgerData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-slate-400 text-xs font-semibold">
                        No purchase transactions recorded for this supplier in the selected period.
                      </td>
                    </tr>
                  ) : (
                    ledgerData.rows.map((r: any, idx: number) => {
                      const isOpening = r.voucher === "Opening Balance";
                      const isClosing = r.voucher === "Closing Balance";

                      return (
                        <tr
                          key={idx}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            r.isSummaryRow ? "bg-slate-50/30 text-slate-900" : ""
                          }`}
                        >
                          {/* Date */}
                          <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono">
                            {r.date === "—" ? "-" : r.date}
                          </td>

                          {/* Voucher */}
                          <td className="py-3 px-4 font-medium text-slate-900">
                            {r.voucher}
                          </td>

                          {/* Sr No */}
                          <td className="py-3 px-4 text-slate-500 font-mono text-xs">
                            {r.srNo === "—" ? "-" : r.srNo}
                          </td>

                          {/* Payment Mode */}
                          <td className="py-3 px-4 text-slate-500">
                            {r.paymentMode === "—" ? "-" : r.paymentMode}
                          </td>

                          {/* Credit (Bills / Dues to Vendor) */}
                          <td className="py-3 px-4 text-right font-mono font-medium text-slate-700">
                            {isOpening || isClosing
                              ? r.credit > 0
                                ? formatCurrency(r.credit)
                                : "₹ 0"
                              : r.credit > 0
                              ? formatCurrency(r.credit)
                              : "-"}
                          </td>

                          {/* Debit (Payment Out / Payments to Vendor) */}
                          <td className="py-3 px-4 text-right font-mono font-medium text-slate-700">
                            {r.debit > 0 ? formatCurrency(r.debit) : "-"}
                          </td>

                          {/* Running Balance */}
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            {isClosing
                              ? "-"
                              : isOpening && r.balance === 0
                              ? "₹ 0"
                              : formatCurrency(r.balance)}
                          </td>

                          {/* Due Date */}
                          <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                            {r.dueDate === "—" || !r.dueDate ? "-" : r.dueDate}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Email Report Modal */}
      {emailModalOpen && (
        <ReportEmailModal
          open={emailModalOpen}
          onClose={() => setEmailModalOpen(false)}
          reportTitle={exportData.title}
          sheetName="Purchase Statement"
          attachmentFilename={exportData.filename}
          headers={exportData.rows[4] || []}
          rows={exportData.rows.slice(5) || []}
          summaryLines={exportData.rows.slice(0, 3).map((r) => r.join(" - "))}
        />
      )}
    </div>
  );
}

