import React, { useEffect, useState, useMemo } from "react";
import {
  ArrowLeft,
  Star,
  Download,
  Printer,
  Search,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  CreditCard,
  Banknote,
  Smartphone,
  Building,
  Clock,
  RotateCcw,
  Receipt,
  AlertCircle,
  Layers,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { formatDisplayDateTime } from "@/lib/utils";
import { inventoryApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { printHtmlInPage } from "@/lib/print-helper";
import { getActiveBillingGst } from "@/lib/receipt-template-store";

interface PaymentModePurchaseReportSuiteProps {
  onBack?: () => void;
  defaultMode?: string;
}

export function PaymentModePurchaseReportSuite({
  onBack,
  defaultMode = "all",
}: PaymentModePurchaseReportSuiteProps) {
  const { formatCurrency } = useCurrency();
  const { tenant } = useTenant();

  // Favorite toggle
  const [isFavorite, setIsFavorite] = useState<boolean>(() => {
    return localStorage.getItem("report_fav_payment_mode_purchases") === "true";
  });

  const toggleFavorite = () => {
    const next = !isFavorite;
    setIsFavorite(next);
    localStorage.setItem("report_fav_payment_mode_purchases", String(next));
    toast.success(next ? "Added to favourites" : "Removed from favourites");
  };

  // Filter States
  const [datePreset, setDatePreset] = useState<
    "all" | "today" | "yesterday" | "this_week" | "last7" | "this_month" | "last_month" | "this_quarter" | "this_fy" | "custom"
  >("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [activeModeTab, setActiveModeTab] = useState<string>(defaultMode);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // UI state
  const [downloadMenuOpen, setDownloadMenuOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [reportData, setReportData] = useState<any>(null);

  // Pagination state
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Initialize date range based on preset
  useEffect(() => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (datePreset === "today") {
      const todayStr = fmt(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (datePreset === "yesterday") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = fmt(y);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (datePreset === "this_week") {
      const day = now.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setStartDate(fmt(monday));
      setEndDate(fmt(sunday));
    } else if (datePreset === "last7") {
      const past = new Date(now);
      past.setDate(past.getDate() - 7);
      setStartDate(fmt(past));
      setEndDate(fmt(now));
    } else if (datePreset === "this_month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(fmt(firstDay));
      setEndDate(fmt(lastDay));
    } else if (datePreset === "last_month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(fmt(firstDay));
      setEndDate(fmt(lastDay));
    } else if (datePreset === "this_quarter") {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const firstDay = new Date(now.getFullYear(), qMonth, 1);
      const lastDay = new Date(now.getFullYear(), qMonth + 3, 0);
      setStartDate(fmt(firstDay));
      setEndDate(fmt(lastDay));
    } else if (datePreset === "this_fy") {
      const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const firstDay = new Date(fyStartYear, 3, 1);
      const lastDay = new Date(fyStartYear + 1, 2, 31);
      setStartDate(fmt(firstDay));
      setEndDate(fmt(lastDay));
    } else if (datePreset === "all") {
      setStartDate("");
      setEndDate("");
    }
  }, [datePreset]);

  // Fetch report data
  const loadReport = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (activeModeTab && activeModeTab !== "all") params.mode = activeModeTab;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      // Attempt authoritative backend endpoint first
      let data: any = null;
      try {
        data = await inventoryApi.getPaymentModePurchaseReport(params);
      } catch (e) {
        data = null;
      }

      // If backend data is ready, use it
      if (data && data.summary) {
        setReportData(data);
      } else {
        // Fallback: Compute client-side from live vendor bills, payments, and debit notes
        const [billsRes, paymentsRes, debitsRes, suppsRes] = await Promise.all([
          inventoryApi.getVendorBills().catch(() => []),
          inventoryApi.getVendorPayments().catch(() => []),
          inventoryApi.getVendorDebitNotes().catch(() => []),
          inventoryApi.getSuppliers().catch(() => []),
        ]);

        const rawBills = Array.isArray(billsRes) ? billsRes : [];
        const rawPayments = Array.isArray(paymentsRes) ? paymentsRes : [];
        const rawDebits = Array.isArray(debitsRes) ? debitsRes : [];
        const rawSupps = Array.isArray(suppsRes) ? suppsRes : [];

        const suppMap = new Map<string, any>();
        rawSupps.forEach((s: any) => {
          if (s.id) suppMap.set(String(s.id), s);
          if (s.name) suppMap.set(s.name.toLowerCase().trim(), s);
        });

        // Map payments by vendor_bill_id, bill_number, supplier_id, and supplier name
        const paymentByBill = new Map<string, any[]>();
        const paymentByBillNum = new Map<string, any[]>();
        const paymentBySupp = new Map<string, any[]>();

        rawPayments.forEach((p: any) => {
          const bId = String(p.vendor_bill_id || "");
          if (bId) {
            const list = paymentByBill.get(bId) || [];
            list.push(p);
            paymentByBill.set(bId, list);
          }
          const ref = String(p.reference_number || p.bill_number || "").trim().toUpperCase();
          if (ref) {
            const list = paymentByBillNum.get(ref) || [];
            list.push(p);
            paymentByBillNum.set(ref, list);
          }
          const sId = String(p.supplier_id || "");
          if (sId) {
            const list = paymentBySupp.get(sId) || [];
            list.push(p);
            paymentBySupp.set(sId, list);
          }
          const sNameRaw = String(p.supplier_name || p.vendor_name || "").trim().toLowerCase();
          if (sNameRaw && sNameRaw !== "vendor / supplier" && sNameRaw !== "supplier / vendor") {
            const list = paymentBySupp.get(sNameRaw) || [];
            list.push(p);
            paymentBySupp.set(sNameRaw, list);
          }
          if (p.notes) {
            const m = String(p.notes).match(/(?:Payment Out to|Payout to|Vendor|Supplier)\s+([A-Za-z0-9_.\-\s&]+)/i);
            if (m && m[1]) {
              const ext = m[1].trim().toLowerCase();
              if (ext && ext !== "vendor" && ext !== "supplier") {
                const list = paymentBySupp.get(ext) || [];
                list.push(p);
                paymentBySupp.set(ext, list);
              }
            }
          }
        });

        const cashBills: any[] = [];
        const upiBills: any[] = [];
        const bankBills: any[] = [];
        const chequeBills: any[] = [];
        const creditBills: any[] = [];
        const activeBills: any[] = [];

        rawBills.forEach((b: any) => {
          const rawStatus = String(b.status || "").toLowerCase();
          if (rawStatus === "cancelled" || rawStatus === "voided") return;

          const bDate = b.bill_date ? String(b.bill_date).slice(0, 10) : "";
          if (startDate && bDate && bDate < startDate) return;
          if (endDate && bDate && bDate > endDate) return;

          const sName = (b.supplier_name || b.vendor_name || b.supplier?.name || "Vendor").trim();
          const suppObj = suppMap.get(String(b.supplier_id)) || suppMap.get(sName.toLowerCase());
          const phone = b.supplier_phone || suppObj?.phone || "";
          const gstin = b.supplier_gstin || suppObj?.gstin || "";

          const total = Number(b.total_amount || b.amount || 0);
          let paid = Number(b.paid_amount || b.amount_paid || 0);

          // Authoritatively gather all matched payments
          const linkedPayMap = new Map<string, any>();
          (paymentByBill.get(String(b.id)) || []).forEach((p: any) => linkedPayMap.set(String(p.id || p.reference_number), p));
          const bNumClean = String(b.bill_number || "").trim().toUpperCase();
          if (bNumClean) {
            (paymentByBillNum.get(bNumClean) || []).forEach((p: any) => linkedPayMap.set(String(p.id || p.reference_number), p));
          }
          if (b.supplier_id && paymentBySupp.has(String(b.supplier_id))) {
            paymentBySupp.get(String(b.supplier_id))!.forEach((p: any) => linkedPayMap.set(String(p.id || p.reference_number), p));
          } else if (sName && paymentBySupp.has(sName.toLowerCase())) {
            paymentBySupp.get(sName.toLowerCase())!.forEach((p: any) => linkedPayMap.set(String(p.id || p.reference_number), p));
          }

          const linkedPay = Array.from(linkedPayMap.values());
          let billCash = 0;
          let billUpi = 0;
          let billCheque = 0;
          let billBank = 0;

          if (linkedPay.length > 0) {
            linkedPay.forEach((p: any) => {
              const pAmt = Number(p.amount_paid || p.amount || 0);
              if (pAmt <= 0) return;
              const pMeth = String(p.payment_method || "").toLowerCase();
              if (pMeth.includes("cash")) billCash += pAmt;
              else if (pMeth.includes("upi") || pMeth.includes("qr") || pMeth.includes("gpay") || pMeth.includes("phonepe") || pMeth.includes("paytm")) billUpi += pAmt;
              else if (pMeth.includes("cheque") || pMeth.includes("check")) billCheque += pAmt;
              else billBank += pAmt;
            });
            const sumP = billCash + billUpi + billCheque + billBank;
            if (sumP > 0) {
              paid = Math.max(paid, sumP);
            }
            const remPaid = paid - sumP;
            if (remPaid > 0.01) {
              const headM = String(b.payment_method || b.payment_terms || "").toLowerCase();
              if (headM.includes("cash")) billCash += remPaid;
              else if (headM.includes("upi") || headM.includes("qr")) billUpi += remPaid;
              else if (headM.includes("cheque") || headM.includes("check")) billCheque += remPaid;
              else billBank += remPaid;
            }
          } else if (paid > 0.01) {
            const headM = String(b.payment_method || b.payment_terms || "").toLowerCase();
            if (headM.includes("cash")) billCash = paid;
            else if (headM.includes("upi") || headM.includes("qr")) billUpi = paid;
            else if (headM.includes("cheque") || headM.includes("check")) billCheque = paid;
            else billBank = paid;
          }

          const pending = Math.max(0, total - paid);

          const modesPresent: string[] = [];
          const modeLabels: string[] = [];
          if (billCash > 0.01) { modesPresent.push("cash"); modeLabels.push(`Cash (₹${billCash.toLocaleString("en-IN")})`); }
          if (billUpi > 0.01) { modesPresent.push("upi"); modeLabels.push(`UPI (₹${billUpi.toLocaleString("en-IN")})`); }
          if (billCheque > 0.01) { modesPresent.push("cheque"); modeLabels.push(`Cheque (₹${billCheque.toLocaleString("en-IN")})`); }
          if (billBank > 0.01) { modesPresent.push("bank"); modeLabels.push(`Bank (₹${billBank.toLocaleString("en-IN")})`); }
          if (pending > 0.01) { modesPresent.push("credit"); modeLabels.push(`Pending (₹${pending.toLocaleString("en-IN")})`); }
          if (modesPresent.length === 0) {
            modesPresent.push(pending > 0.01 ? "credit" : "bank");
            modeLabels.push(pending > 0.01 ? "Credit / Net Terms" : "Bank Transfer");
          }

          let cat = modesPresent[0];
          let catLabel = "Bank Transfer";
          let rawLabel = "";
          if (modeLabels.length === 1) {
            catLabel = cat === "cash" ? "Cash" : cat === "upi" ? "UPI / QR" : cat === "cheque" ? "Cheque" : cat === "bank" ? "Bank Transfer" : "Credit / Payables";
            rawLabel = catLabel;
          } else {
            cat = "split";
            catLabel = "Split / Multi-Mode";
            rawLabel = modeLabels.join(" • ");
          }

          const billItem = {
            id: String(b.id),
            bill_number: b.bill_number || `BILL-${String(b.id).slice(0, 6).toUpperCase()}`,
            date: bDate,
            vendor_name: sName,
            vendor_phone: phone,
            vendor_gstin: gstin,
            payment_mode_raw: rawLabel,
            total_amount: total,
            paid_amount: paid,
            pending_amount: pending,
            status: pending <= 0.01 && paid > 0 ? "Paid" : (paid > 0 ? "Partially Paid" : "Payable"),
            category: cat,
            category_label: catLabel,
            modes: modesPresent,
            cash_paid: billCash,
            upi_paid: billUpi,
            cheque_paid: billCheque,
            bank_paid: billBank,
            is_debit_note: false,
          };

          activeBills.push(billItem);
          if (modesPresent.includes("cash")) cashBills.push(billItem);
          if (modesPresent.includes("upi")) upiBills.push(billItem);
          if (modesPresent.includes("cheque")) chequeBills.push(billItem);
          if (modesPresent.includes("bank")) bankBills.push(billItem);
          if (modesPresent.includes("credit") || pending > 0.01) creditBills.push(billItem);
        });

        // Debit notes
        const debitNotesList = rawDebits.map((d: any) => ({
          id: String(d.id),
          bill_number: d.note_number || `DN-${String(d.id).slice(0, 6).toUpperCase()}`,
          date: d.created_at ? String(d.created_at).slice(0, 10) : "",
          vendor_name: d.supplier_name || d.supplier?.name || "Vendor Partner",
          vendor_phone: d.supplier?.phone || "",
          vendor_gstin: d.supplier?.gstin || "",
          payment_mode_raw: "Debit Note",
          total_amount: Number(d.amount || 0),
          paid_amount: Number(d.amount || 0),
          pending_amount: 0,
          status: d.status || "Applied",
          category: "debit_note",
          category_label: "Debit Note",
          is_debit_note: true,
        }));

        const grandTotal = activeBills.reduce((s, b) => s + b.total_amount, 0);
        const grandDues = activeBills.reduce((s, b) => s + b.pending_amount, 0);
        const duesCount = activeBills.filter((b) => b.pending_amount > 0.01).length;

        const cashPaid = activeBills.reduce((s, b) => s + (b.cash_paid || 0), 0);
        const cashTot = cashPaid;
        const cashDues = 0;

        const upiPaid = activeBills.reduce((s, b) => s + (b.upi_paid || 0), 0);
        const upiTot = upiPaid;
        const upiDues = 0;

        const bankPaid = activeBills.reduce((s, b) => s + (b.bank_paid || 0), 0);
        const bankTot = bankPaid;
        const bankDues = 0;

        const chequePaid = activeBills.reduce((s, b) => s + (b.cheque_paid || 0), 0);
        const chequeTot = chequePaid;
        const chequeDues = 0;

        const creditTot = grandDues;
        const creditPaid = 0;
        const creditDues = grandDues;

        const dnTotal = debitNotesList.reduce((s, d) => s + d.total_amount, 0);

        const clientData = {
          summary: {
            total_bills: activeBills.length,
            total_procurement_cost: grandTotal,
            avg_bill: activeBills.length > 0 ? grandTotal / activeBills.length : 0,
            cash_total: cashTot,
            cash_count: cashBills.length,
            cash_pct: grandTotal > 0 ? Math.round((cashTot / grandTotal) * 1000) / 10 : 0,
            upi_total: upiTot,
            upi_count: upiBills.length,
            upi_pct: grandTotal > 0 ? Math.round((upiTot / grandTotal) * 1000) / 10 : 0,
            bank_total: bankTot,
            bank_count: bankBills.length,
            bank_pct: grandTotal > 0 ? Math.round((bankTot / grandTotal) * 1000) / 10 : 0,
            cheque_total: chequeTot,
            cheque_count: chequeBills.length,
            cheque_pct: grandTotal > 0 ? Math.round((chequeTot / grandTotal) * 1000) / 10 : 0,
            credit_total: creditTot,
            credit_count: creditBills.length,
            credit_pct: grandTotal > 0 ? Math.round((creditTot / grandTotal) * 1000) / 10 : 0,
            dues_total: grandDues,
            dues_count: duesCount,
            debit_notes_total: dnTotal,
            debit_notes_count: debitNotesList.length,
          },
          mode_breakdown: [
            {
              mode_key: "cash",
              payment_mode: "Cash Purchases",
              invoices_count: cashBills.length,
              percentage_share: grandTotal > 0 ? Math.round((cashTot / grandTotal) * 1000) / 10 : 0,
              total_billed: cashTot,
              collected_amount: cashPaid,
              dues_amount: cashDues,
              dues_invoices_count: cashBills.filter((b) => b.pending_amount > 0.01).length,
              average_ticket: cashBills.length > 0 ? Math.round((cashTot / cashBills.length) * 100) / 100 : 0,
            },
            {
              mode_key: "upi",
              payment_mode: "UPI / QR Payouts",
              invoices_count: upiBills.length,
              percentage_share: grandTotal > 0 ? Math.round((upiTot / grandTotal) * 1000) / 10 : 0,
              total_billed: upiTot,
              collected_amount: upiPaid,
              dues_amount: upiDues,
              dues_invoices_count: upiBills.filter((b) => b.pending_amount > 0.01).length,
              average_ticket: upiBills.length > 0 ? Math.round((upiTot / upiBills.length) * 100) / 100 : 0,
            },
            {
              mode_key: "bank",
              payment_mode: "Bank Transfer / NEFT / Card",
              invoices_count: bankBills.length,
              percentage_share: grandTotal > 0 ? Math.round((bankTot / grandTotal) * 1000) / 10 : 0,
              total_billed: bankTot,
              collected_amount: bankPaid,
              dues_amount: bankDues,
              dues_invoices_count: bankBills.filter((b) => b.pending_amount > 0.01).length,
              average_ticket: bankBills.length > 0 ? Math.round((bankTot / bankBills.length) * 100) / 100 : 0,
            },
            {
              mode_key: "cheque",
              payment_mode: "Cheque Payouts",
              invoices_count: chequeBills.length,
              percentage_share: grandTotal > 0 ? Math.round((chequeTot / grandTotal) * 1000) / 10 : 0,
              total_billed: chequeTot,
              collected_amount: chequePaid,
              dues_amount: chequeDues,
              dues_invoices_count: chequeBills.filter((b) => b.pending_amount > 0.01).length,
              average_ticket: chequeBills.length > 0 ? Math.round((chequeTot / chequeBills.length) * 100) / 100 : 0,
            },
            {
              mode_key: "credit",
              payment_mode: "Credit / Payables (Net Terms)",
              invoices_count: creditBills.length,
              percentage_share: grandTotal > 0 ? Math.round((creditTot / grandTotal) * 1000) / 10 : 0,
              total_billed: creditTot,
              collected_amount: creditPaid,
              dues_amount: creditDues,
              dues_invoices_count: creditBills.filter((b) => b.pending_amount > 0.01).length,
              average_ticket: creditBills.length > 0 ? Math.round((creditTot / creditBills.length) * 100) / 100 : 0,
            },
          ],
          detailed_bills: activeModeTab === "debit_notes" ? debitNotesList : activeBills,
        };

        setReportData(clientData);
      }
    } catch (err: any) {
      console.error("Failed to load payment mode purchase report:", err);
      toast.error(err.message || "Failed to load payment mode purchase report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport();
  }, [startDate, endDate, activeModeTab]);

  // Live reload on cross-component procurement or payment updates
  useEffect(() => {
    const handleSync = () => {
      void loadReport();
    };
    window.addEventListener("vendor_payments_updated", handleSync);
    window.addEventListener("procurement_updated", handleSync);
    window.addEventListener("inventory_updated", handleSync);
    window.addEventListener("focus", handleSync);
    return () => {
      window.removeEventListener("vendor_payments_updated", handleSync);
      window.removeEventListener("procurement_updated", handleSync);
      window.removeEventListener("inventory_updated", handleSync);
      window.removeEventListener("focus", handleSync);
    };
  }, []);

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      void loadReport();
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const summary = reportData?.summary || {
    total_bills: 0,
    total_procurement_cost: 0,
    avg_bill: 0,
    cash_total: 0,
    cash_count: 0,
    cash_pct: 0,
    upi_total: 0,
    upi_count: 0,
    upi_pct: 0,
    bank_total: 0,
    bank_count: 0,
    bank_pct: 0,
    cheque_total: 0,
    cheque_count: 0,
    cheque_pct: 0,
    credit_total: 0,
    credit_count: 0,
    credit_pct: 0,
    dues_total: 0,
    dues_count: 0,
    debit_notes_total: 0,
    debit_notes_count: 0,
  };

  const modeBreakdown: any[] = reportData?.mode_breakdown || [];
  const detailedBills: any[] = reportData?.detailed_bills || [];

  // Filtered detailed bills based on search & active tab
  const filteredBills = useMemo(() => {
    let list = detailedBills;
    if (activeModeTab === "cash") {
      list = list.filter((b) => b.modes?.includes("cash") || b.category === "cash" || Number(b.cash_paid || 0) > 0);
    } else if (activeModeTab === "upi") {
      list = list.filter((b) => b.modes?.includes("upi") || b.category === "upi" || Number(b.upi_paid || 0) > 0);
    } else if (activeModeTab === "bank") {
      list = list.filter((b) => b.modes?.includes("bank") || b.category === "bank" || Number(b.bank_paid || 0) > 0);
    } else if (activeModeTab === "cheque") {
      list = list.filter((b) => b.modes?.includes("cheque") || b.category === "cheque" || Number(b.cheque_paid || 0) > 0);
    } else if (activeModeTab === "credit") {
      list = list.filter((b) => b.modes?.includes("credit") || b.category === "credit" || Number(b.pending_amount || 0) > 0.01);
    } else if (activeModeTab === "dues") {
      list = list.filter((b) => Number(b.pending_amount || 0) > 0.01);
    } else if (activeModeTab === "debit_notes") {
      list = list.filter((b) => b.is_debit_note === true);
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (b) =>
        (b.bill_number && b.bill_number.toLowerCase().includes(q)) ||
        (b.vendor_name && b.vendor_name.toLowerCase().includes(q)) ||
        (b.vendor_phone && b.vendor_phone.includes(q)) ||
        (b.vendor_gstin && b.vendor_gstin.toLowerCase().includes(q)) ||
        (b.payment_mode_raw && b.payment_mode_raw.toLowerCase().includes(q))
    );
  }, [detailedBills, searchQuery, activeModeTab]);

  // Reset pagination when filter criteria change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeModeTab, startDate, endDate, datePreset, pageSize]);

  // Paginated Bills
  const totalBillsCount = filteredBills.length;
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(totalBillsCount / (pageSize || 25)));

  const paginatedBills = useMemo(() => {
    if (pageSize === 0) return filteredBills;
    const start = (currentPage - 1) * pageSize;
    return filteredBills.slice(start, start + pageSize);
  }, [filteredBills, currentPage, pageSize]);

  // Aggregate totals for the currently filtered bills
  const filteredTotals = useMemo(() => {
    return filteredBills.reduce(
      (acc, b) => {
        acc.total += Number(b.total_amount || 0);
        acc.paid += Number(b.paid_amount || 0);
        acc.pending += Number(b.pending_amount || 0);
        return acc;
      },
      { total: 0, paid: 0, pending: 0 }
    );
  }, [filteredBills]);

  // Excel Export
  const handleExportExcel = () => {
    setDownloadMenuOpen(false);
    if (!filteredBills || filteredBills.length === 0) {
      toast.info("No transaction records available to export");
      return;
    }

    try {
      const summarySheetData = modeBreakdown.map((row) => ({
        "Payment Mode": row.payment_mode,
        "Bills Count": row.invoices_count,
        "% Share": `${row.percentage_share}%`,
        "Total Procurement (₹)": row.total_billed,
        "Paid Out (₹)": row.collected_amount,
        "Pending Payables (₹)": row.dues_amount,
        "Bills with Payables": row.dues_invoices_count,
        "Average Ticket (₹)": row.average_ticket,
      }));

      const billsSheetData = filteredBills.map((b) => ({
        Date: b.date || "—",
        "Bill Number": b.bill_number || "—",
        "Vendor / Supplier": b.vendor_name || "Vendor Partner",
        "Phone Number": b.vendor_phone || "—",
        "GSTIN": b.vendor_gstin || "—",
        "Payment Category": b.category_label || b.category || "Cash",
        "Raw Mode": b.payment_mode_raw || "—",
        "Total Billed (₹)": b.total_amount,
        "Paid Out (₹)": b.paid_amount,
        "Pending Payable (₹)": b.pending_amount,
        Status: b.status || "Payable",
      }));

      const wb = XLSX.utils.book_new();
      const wsSummary = XLSX.utils.json_to_sheet(summarySheetData);
      const wsBills = XLSX.utils.json_to_sheet(billsSheetData);

      XLSX.utils.book_append_sheet(wb, wsSummary, "Mode Breakdown");
      XLSX.utils.book_append_sheet(wb, wsBills, "Vendor Transactions");

      const fname = `Vendor_Payment_Mode_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fname);
      toast.success("Excel report exported successfully");
    } catch (e: any) {
      console.error("Export error:", e);
      toast.error("Failed to generate Excel file");
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    setDownloadMenuOpen(false);
    if (!filteredBills || filteredBills.length === 0) {
      toast.info("No records to export");
      return;
    }

    try {
      const header = ["Date", "Bill Number", "Vendor", "Phone", "GSTIN", "Payment Category", "Total Billed", "Paid Out", "Pending Payable", "Status"];
      const rows = filteredBills.map((b) => [
        `"${b.date || ""}"`,
        `"${b.bill_number || ""}"`,
        `"${b.vendor_name || "Vendor Partner"}"`,
        `"${b.vendor_phone || ""}"`,
        `"${b.vendor_gstin || ""}"`,
        `"${b.category_label || b.category || "Cash"}"`,
        b.total_amount || 0,
        b.paid_amount || 0,
        b.pending_amount || 0,
        `"${b.status || ""}"`,
      ]);

      const csvContent = "data:text/csv;charset=utf-8," + [header.join(","), ...rows.map((e) => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Vendor_Payment_Mode_Report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("CSV report exported successfully");
    } catch (e: any) {
      console.error("CSV Export error:", e);
      toast.error("Failed to generate CSV file");
    }
  };

  // Print PDF
  const handlePrintPDF = () => {
    const activeGst = getActiveBillingGst();
    const companyName = tenant?.name || activeGst?.trade_name || "Enterprise Operations";
    const companyGstin = activeGst?.gstin || (tenant?.raw as any)?.gstin || "";
    const companyAddress = activeGst?.address || (tenant?.raw as any)?.address || "";

    const periodLabel = datePreset === "all" ? "All Time" : `${startDate || "Start"} to ${endDate || "End"}`;

    const summaryCardsHtml = `
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px;">
          <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Purchase Bills</div>
          <div style="font-size: 16px; font-weight: 900; color: #0f172a; margin-top: 2px;">${summary.total_bills}</div>
          <div style="font-size: 8.5px; color: #16a34a; font-weight: 700; margin-top: 2px;">100% Synced & Logged</div>
        </div>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px;">
          <div style="font-size: 9px; font-weight: 700; color: #166534; text-transform: uppercase;">Total Procurement Cost</div>
          <div style="font-size: 16px; font-weight: 900; color: #16a34a; margin-top: 2px;">${formatCurrency(summary.total_procurement_cost)}</div>
          <div style="font-size: 8.5px; color: #475569; margin-top: 2px;">Avg Bill: ${formatCurrency(summary.avg_bill)}</div>
        </div>
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px;">
          <div style="font-size: 9px; font-weight: 700; color: #1e40af; text-transform: uppercase;">Cash Payouts</div>
          <div style="font-size: 16px; font-weight: 900; color: #2563eb; margin-top: 2px;">${formatCurrency(summary.cash_total)}</div>
          <div style="font-size: 8.5px; color: #475569; margin-top: 2px;">${summary.cash_count} Bills (${summary.cash_pct}%)</div>
        </div>
        <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 10px;">
          <div style="font-size: 9px; font-weight: 700; color: #6b21a8; text-transform: uppercase;">UPI / QR Payouts</div>
          <div style="font-size: 16px; font-weight: 900; color: #7c3aed; margin-top: 2px;">${formatCurrency(summary.upi_total)}</div>
          <div style="font-size: 8.5px; color: #475569; margin-top: 2px;">${summary.upi_count} Bills (${summary.upi_pct}%)</div>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px;">
        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 10px;">
          <div style="font-size: 9px; font-weight: 700; color: #0369a1; text-transform: uppercase;">Bank Transfer / Card</div>
          <div style="font-size: 16px; font-weight: 900; color: #0284c7; margin-top: 2px;">${formatCurrency(summary.bank_total)}</div>
          <div style="font-size: 8.5px; color: #475569; margin-top: 2px;">${summary.bank_count} Bills (${summary.bank_pct}%)</div>
        </div>
        <div style="background: #fdf2f8; border: 1px solid #fbcfe8; border-radius: 8px; padding: 10px;">
          <div style="font-size: 9px; font-weight: 700; color: #9d174d; text-transform: uppercase;">Credit / Payables</div>
          <div style="font-size: 16px; font-weight: 900; color: #db2777; margin-top: 2px;">${formatCurrency(summary.credit_total)}</div>
          <div style="font-size: 8.5px; color: #475569; margin-top: 2px;">${summary.credit_count} Bills (${summary.credit_pct}%)</div>
        </div>
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px;">
          <div style="font-size: 9px; font-weight: 700; color: #92400e; text-transform: uppercase;">Vendor Debit Notes</div>
          <div style="font-size: 16px; font-weight: 900; color: #d97706; margin-top: 2px;">${formatCurrency(summary.debit_notes_total)}</div>
          <div style="font-size: 8.5px; color: #475569; margin-top: 2px;">${summary.debit_notes_count} Notes</div>
        </div>
      </div>
    `;

    const summaryTableRows = modeBreakdown
      .map(
        (row) => `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 10px; font-weight: 700; color: #1e293b;">${row.payment_mode}</td>
          <td style="padding: 8px 10px; text-align: center; color: #475569;">${row.invoices_count}</td>
          <td style="padding: 8px 10px; text-align: center; color: #475569;">${row.percentage_share}%</td>
          <td style="padding: 8px 10px; text-align: right; font-weight: 700; color: #0f172a;">${formatCurrency(row.total_billed)}</td>
          <td style="padding: 8px 10px; text-align: right; color: #16a34a; font-weight: 700;">${formatCurrency(row.collected_amount)}</td>
          <td style="padding: 8px 10px; text-align: right; color: #dc2626; font-weight: 700;">${formatCurrency(row.dues_amount)}</td>
          <td style="padding: 8px 10px; text-align: center; color: #dc2626; font-weight: 600;">${row.dues_invoices_count}</td>
          <td style="padding: 8px 10px; text-align: right; color: #475569;">${formatCurrency(row.average_ticket)}</td>
        </tr>
      `
      )
      .join("");

    const billsTableRows = filteredBills
      .slice(0, 150)
      .map(
        (b) => `
        <tr style="border-bottom: 1px solid #f1f5f9; font-size: 9px;">
          <td style="padding: 6px 8px; color: #64748b;">${b.date || "—"}</td>
          <td style="padding: 6px 8px; font-weight: 700; color: #1e293b;">${b.bill_number}</td>
          <td style="padding: 6px 8px; color: #0f172a; font-weight: 600;">${b.vendor_name}</td>
          <td style="padding: 6px 8px; color: #475569;">${b.category_label || b.category || "Cash"}</td>
          <td style="padding: 6px 8px; text-align: center;">${b.status}</td>
          <td style="padding: 6px 8px; text-align: right; font-weight: 700;">${formatCurrency(b.total_amount)}</td>
          <td style="padding: 6px 8px; text-align: right; color: #16a34a; font-weight: 600;">${formatCurrency(b.paid_amount)}</td>
          <td style="padding: 6px 8px; text-align: right; color: #dc2626; font-weight: 700;">${formatCurrency(b.pending_amount)}</td>
        </tr>
      `
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Vendor Payment Mode & Outflow Report - ${companyName}</title>
        <style>
          @page { size: A4 landscape; margin: 12mm 10mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 0; font-size: 10px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid #e2e8f0; margin-bottom: 14px; }
          .title { font-size: 18px; font-weight: 900; color: #0f172a; margin: 0 0 4px 0; }
          .subtitle { font-size: 10px; color: #64748b; margin: 0; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th { background: #f8fafc; font-size: 8.5px; font-weight: 800; text-transform: uppercase; color: #475569; padding: 7px 8px; border-bottom: 1.5px solid #cbd5e1; }
          .section-heading { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #1e293b; margin: 16px 0 8px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">${companyName}</h1>
            <p class="subtitle">Vendor Payment Mode & Outflow Report</p>
            ${companyGstin ? `<p class="subtitle">GSTIN: ${companyGstin}</p>` : ""}
            ${companyAddress ? `<p class="subtitle">${companyAddress}</p>` : ""}
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; font-weight: 800; color: #4f46e5;">PROCUREMENT REPORT</div>
            <div style="font-size: 9px; color: #64748b; margin-top: 2px;">Period: ${periodLabel}</div>
            <div style="font-size: 8.5px; color: #94a3b8; margin-top: 2px;">Generated on: ${formatDisplayDateTime(new Date())}</div>
          </div>
        </div>

        ${summaryCardsHtml}

        <div class="section-heading">Payment Mode Breakdown Summary</div>
        <table>
          <thead>
            <tr>
              <th style="text-align: left;">Payment Mode / Category</th>
              <th style="text-align: center;">Bills Count</th>
              <th style="text-align: center;">% Share</th>
              <th style="text-align: right;">Total Procurement</th>
              <th style="text-align: right;">Paid Out</th>
              <th style="text-align: right;">Pending Payables</th>
              <th style="text-align: center;">Payables Count</th>
              <th style="text-align: right;">Average Ticket</th>
            </tr>
          </thead>
          <tbody>
            ${summaryTableRows}
          </tbody>
        </table>

        <div class="section-heading">Detailed Vendor Bills & Disbursements Register (${filteredBills.length} records)</div>
        <table>
          <thead>
            <tr>
              <th style="text-align: left;">Date</th>
              <th style="text-align: left;">Bill #</th>
              <th style="text-align: left;">Vendor / Supplier</th>
              <th style="text-align: left;">Payment Category</th>
              <th style="text-align: center;">Status</th>
              <th style="text-align: right;">Total Billed</th>
              <th style="text-align: right;">Paid Out</th>
              <th style="text-align: right;">Pending Payable</th>
            </tr>
          </thead>
          <tbody>
            ${billsTableRows}
          </tbody>
        </table>
      </body>
      </html>
    `;

    printHtmlInPage(html, 300);
  };

  const presetLabels: Record<string, string> = {
    all: "All Time",
    today: "Today",
    yesterday: "Yesterday",
    this_week: "This Week",
    last7: "Last 7 Days",
    this_month: "This Month",
    last_month: "Last Month",
    this_quarter: "This Quarter",
    this_fy: "This Financial Year",
    custom: "Custom Range",
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-y-auto w-full bg-slate-50 text-slate-800 font-sans pb-28 custom-scrollbar">
      {/* ──────────────────────────────────────────────────────────────────────────
          TOP HEADER TOOLBAR
      ────────────────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 px-6 py-3.5 border-b border-slate-200/90 flex flex-wrap items-center justify-between gap-3 shrink-0 bg-white/95 backdrop-blur-md shadow-2xs">
        {/* Left: Back button + Title + Favorite star */}
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors cursor-pointer"
              title="Go Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
                Vendor Payment Mode & Outflow Report
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Live DB
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Breakdown of purchases & vendor payouts by Cash, UPI, Bank / Card, Credit / Payables, and Debit Notes.
            </p>
          </div>

          <button
            onClick={toggleFavorite}
            className={`hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all border cursor-pointer ${
              isFavorite
                ? "bg-amber-100/80 text-amber-900 border-amber-300 shadow-2xs"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-amber-50 hover:text-amber-700"
            }`}
          >
            <Star
              className={`w-3.5 h-3.5 ${
                isFavorite ? "fill-amber-500 text-amber-500" : "text-slate-400"
              }`}
            />
            <span>{isFavorite ? "Favorited" : "Favorite"}</span>
          </button>
        </div>

        {/* Right: Export Excel / CSV, Print PDF, Refresh */}
        <div className="flex items-center gap-2">
          {/* Download Dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDownloadMenuOpen(!downloadMenuOpen)}
              className="h-9 px-3 text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-50 gap-1.5 rounded-xl cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Export</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </Button>

            {downloadMenuOpen && (
              <div
                className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100"
                onMouseLeave={() => setDownloadMenuOpen(false)}
              >
                <button
                  onClick={handleExportExcel}
                  className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 flex items-center gap-2 text-slate-700 font-medium cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Download Excel (.xlsx)</span>
                </button>
                <button
                  onClick={handleExportCSV}
                  className="w-full text-left px-3.5 py-2 hover:bg-blue-50 flex items-center gap-2 text-slate-700 font-medium cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Download CSV (.csv)</span>
                </button>
              </div>
            )}
          </div>

          {/* Print PDF */}
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintPDF}
            className="h-9 px-3 text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-50 gap-1.5 rounded-xl cursor-pointer"
          >
            <Printer className="w-4 h-4 text-indigo-600" />
            <span>Print PDF</span>
          </Button>

          {/* Refresh */}
          <Button
            variant="outline"
            size="icon"
            onClick={loadReport}
            disabled={loading}
            className="h-9 w-9 rounded-xl border-slate-200 hover:bg-slate-50 cursor-pointer"
            title="Refresh Live Data"
          >
            <RefreshCw
              className={`w-4 h-4 text-slate-600 ${loading ? "animate-spin text-purple-600" : ""}`}
            />
          </Button>
        </div>
      </header>

      {/* ──────────────────────────────────────────────────────────────────────────
          MAIN CONTENT AREA
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="px-6 py-6 flex flex-col gap-6">
        {/* 1. FILTER BAR */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Period Selector */}
            <div className="relative">
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value as any)}
                className="h-9 pl-3 pr-8 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer appearance-none"
              >
                {Object.entries(presetLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Date Pickers (Custom or Active) */}
            <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
              <CalendarIcon className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
              <DatePickerInput
                value={startDate}
                onChange={(val) => {
                  setStartDate(val);
                  setDatePreset("custom");
                }}
                className="h-7 w-28 text-xs bg-white border-slate-200 rounded-lg px-2"
                placeholder="From Date"
              />
              <span className="text-slate-400 font-semibold px-0.5">to</span>
              <DatePickerInput
                value={endDate}
                onChange={(val) => {
                  setEndDate(val);
                  setDatePreset("custom");
                }}
                className="h-7 w-28 text-xs bg-white border-slate-200 rounded-lg px-2"
                placeholder="To Date"
              />
            </div>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[260px] flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by vendor, bill #, phone, gstin..."
              className="w-full h-9 pl-8.5 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
        </div>

        {/* 2. SUMMARY KPI STAT CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          {/* Card 1: Total Purchase Bills */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-blue-200 hover:shadow-xs transition-all">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                Total Purchase Bills
              </span>
              <Receipt className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {summary.total_bills}
            </div>
            <div className="text-[11px] text-emerald-600 font-bold mt-1">
              100% Synced & Logged
            </div>
          </div>

          {/* Card 2: Total Procurement Outflow */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-emerald-200 hover:shadow-xs transition-all">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                Total Procurement
              </span>
              <ShoppingBag className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-600">
              {formatCurrency(summary.total_procurement_cost)}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              Avg Bill: {formatCurrency(summary.avg_bill)}
            </div>
          </div>

          {/* Card 3: Total Cash */}
          <div
            onClick={() => setActiveModeTab(activeModeTab === "cash" ? "all" : "cash")}
            className={`bg-white p-4 rounded-2xl border shadow-2xs hover:shadow-xs transition-all cursor-pointer ${
              activeModeTab === "cash"
                ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20"
                : "border-slate-200/90 hover:border-emerald-200"
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Cash</span>
              <Banknote className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-600">
              {formatCurrency(summary.cash_total)}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              {summary.cash_count} {summary.cash_count === 1 ? "Bill" : "Bills"}
              {summary.total_bills > 0 && ` (${summary.cash_pct}%)`}
            </div>
          </div>

          {/* Card 4: Total UPI */}
          <div
            onClick={() => setActiveModeTab(activeModeTab === "upi" ? "all" : "upi")}
            className={`bg-white p-4 rounded-2xl border shadow-2xs hover:shadow-xs transition-all cursor-pointer ${
              activeModeTab === "upi"
                ? "border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/20"
                : "border-slate-200/90 hover:border-purple-200"
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total UPI</span>
              <Smartphone className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-black text-purple-600">
              {formatCurrency(summary.upi_total)}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              {summary.upi_count} {summary.upi_count === 1 ? "Bill" : "Bills"}
              {summary.total_bills > 0 && ` (${summary.upi_pct}%)`}
            </div>
          </div>

          {/* Card 5: Bank / NEFT / Card */}
          <div
            onClick={() => setActiveModeTab(activeModeTab === "bank" ? "all" : "bank")}
            className={`bg-white p-4 rounded-2xl border shadow-2xs hover:shadow-xs transition-all cursor-pointer ${
              activeModeTab === "bank"
                ? "border-sky-500 ring-2 ring-sky-500/20 bg-sky-50/20"
                : "border-slate-200/90 hover:border-sky-200"
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Bank / NEFT / Card</span>
              <Building className="w-4 h-4 text-sky-600" />
            </div>
            <div className="text-2xl font-black text-sky-600">
              {formatCurrency(summary.bank_total)}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              {summary.bank_count} {summary.bank_count === 1 ? "Bill" : "Bills"}
              {summary.total_bills > 0 && ` (${summary.bank_pct}%)`}
            </div>
          </div>

          {/* Card 6: Cheque */}
          <div
            onClick={() => setActiveModeTab(activeModeTab === "cheque" ? "all" : "cheque")}
            className={`bg-white p-4 rounded-2xl border shadow-2xs hover:shadow-xs transition-all cursor-pointer ${
              activeModeTab === "cheque"
                ? "border-teal-500 ring-2 ring-teal-500/20 bg-teal-50/20"
                : "border-slate-200/90 hover:border-teal-200"
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Cheque</span>
              <CreditCard className="w-4 h-4 text-teal-600" />
            </div>
            <div className="text-2xl font-black text-teal-600">
              {formatCurrency(summary.cheque_total)}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              {summary.cheque_count} {summary.cheque_count === 1 ? "Bill" : "Bills"}
              {summary.total_bills > 0 && ` (${summary.cheque_pct}%)`}
            </div>
          </div>

          {/* Card 7: Credit / Payables */}
          <div
            onClick={() => setActiveModeTab(activeModeTab === "credit" ? "all" : "credit")}
            className={`bg-white p-4 rounded-2xl border shadow-2xs hover:shadow-xs transition-all cursor-pointer ${
              activeModeTab === "credit"
                ? "border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/20"
                : "border-slate-200/90 hover:border-purple-200"
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Credit / Payables</span>
              <Clock className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-black text-purple-600">
              {formatCurrency(summary.credit_total)}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              {summary.credit_count} {summary.credit_count === 1 ? "Bill" : "Bills"}
              {summary.total_bills > 0 && ` (${summary.credit_pct}%)`}
            </div>
          </div>

          {/* Card 7: Debit Notes */}
          <div
            onClick={() => setActiveModeTab(activeModeTab === "debit_notes" ? "all" : "debit_notes")}
            className={`bg-white p-4 rounded-2xl border shadow-2xs hover:shadow-xs transition-all cursor-pointer ${
              activeModeTab === "debit_notes"
                ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20"
                : "border-slate-200/90 hover:border-amber-200"
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Debit Notes</span>
              <RotateCcw className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-600">
              {formatCurrency(summary.debit_notes_total)}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              {summary.debit_notes_count}{" "}
              {summary.debit_notes_count === 1 ? "Debit Note" : "Debit Notes"}
            </div>
          </div>
        </div>

        {/* OUTSTANDING VENDOR PAYABLES BANNER */}
        <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200/90 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-200 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Total Outstanding Vendor Payables
              </div>
              <div className="text-lg font-black text-amber-800">
                {formatCurrency(summary.dues_total)}{" "}
                <span className="text-xs font-semibold text-amber-700">
                  across {summary.dues_count} bills with pending balances
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setActiveModeTab(activeModeTab === "dues" ? "all" : "dues")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeModeTab === "dues"
                ? "bg-amber-600 text-white shadow-md shadow-amber-300"
                : "bg-white text-amber-900 border border-amber-300 hover:bg-amber-100/60"
            }`}
          >
            {activeModeTab === "dues" ? "Showing Payables Only" : "Filter Bills with Payables"}
          </button>
        </div>

        {/* 3. PAYMENT MODE BREAKDOWN SUMMARY TABLE */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50/50 to-white">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Payment Mode Breakdown Summary
              </h2>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
              Disbursements & Payables Matrix
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="sticky top-0 bg-slate-50/95 backdrop-blur-xs text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 z-10 shadow-2xs">
                  <th className="py-3 px-4">Payment Mode / Category</th>
                  <th className="py-3 px-4 text-center">Bills Count</th>
                  <th className="py-3 px-4 text-center">% Share</th>
                  <th className="py-3 px-4 text-right">Total Procurement (₹)</th>
                  <th className="py-3 px-4 text-right">Paid Out (₹)</th>
                  <th className="py-3 px-4 text-right">Pending Payables (₹)</th>
                  <th className="py-3 px-4 text-center">Payables Count</th>
                  <th className="py-3 px-4 text-right">Avg Ticket (₹)</th>
                  <th className="py-3 px-4 text-center">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {modeBreakdown.map((row) => {
                  const isCurrentMode = activeModeTab === row.mode_key;
                  return (
                    <tr
                      key={row.mode_key}
                      className={`hover:bg-indigo-50/30 transition-colors ${
                        isCurrentMode ? "bg-indigo-50/50 font-bold" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4 flex items-center gap-2">
                        <span
                          className={`size-2 rounded-full ${
                            row.mode_key === "cash"
                              ? "bg-emerald-500"
                              : row.mode_key === "upi"
                              ? "bg-purple-500"
                              : row.mode_key === "bank"
                              ? "bg-sky-500"
                              : row.mode_key === "cheque"
                              ? "bg-teal-500"
                              : "bg-pink-500"
                          }`}
                        ></span>
                        <span className="font-bold text-slate-800">{row.payment_mode}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                        {row.invoices_count}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="font-bold text-slate-700">{row.percentage_share}%</span>
                          <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className={`h-full rounded-full ${
                                row.mode_key === "cash"
                                  ? "bg-emerald-500"
                                  : row.mode_key === "upi"
                                  ? "bg-purple-500"
                                  : row.mode_key === "bank"
                                  ? "bg-sky-500"
                                  : row.mode_key === "cheque"
                                  ? "bg-teal-500"
                                  : "bg-pink-500"
                              }`}
                              style={{ width: `${Math.min(100, row.percentage_share)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-slate-900">
                        {formatCurrency(row.total_billed)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
                        {formatCurrency(row.collected_amount)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-rose-600">
                        {formatCurrency(row.dues_amount)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {row.dues_invoices_count > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                            {row.dues_invoices_count}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-bold">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-600">
                        {formatCurrency(row.average_ticket)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setActiveModeTab(isCurrentMode ? "all" : row.mode_key)}
                          className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                            isCurrentMode
                              ? "bg-indigo-600 text-white shadow-2xs"
                              : "bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600"
                          }`}
                        >
                          {isCurrentMode ? "Active" : "View"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. DETAILED VENDOR BILLS & OUTFLOW REGISTER */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
          {/* Table Header toolbar & Mode Filter Pills */}
          <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-50/50 to-white">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Detailed Vendor Bills & Disbursements Register
              </h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700">
                {filteredBills.length} Records
              </span>
            </div>

            {/* Mode Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: "all", label: "All Purchases", count: summary.total_bills },
                { id: "cash", label: "Cash Payouts", count: summary.cash_count },
                { id: "upi", label: "UPI Payouts", count: summary.upi_count },
                { id: "bank", label: "Bank / NEFT", count: summary.bank_count },
                { id: "cheque", label: "Cheque Payouts", count: summary.cheque_count },
                { id: "credit", label: "Credit / Payables", count: summary.credit_count },
                { id: "dues", label: "Payables Only", count: summary.dues_count },
                { id: "debit_notes", label: "Debit Notes", count: summary.debit_notes_count },
              ].map((pill) => {
                const isActive = activeModeTab === pill.id;
                return (
                  <button
                    key={pill.id}
                    onClick={() => setActiveModeTab(pill.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
                    }`}
                  >
                    <span>{pill.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isActive ? "bg-white/20 text-white" : "bg-white text-slate-700"
                      }`}
                    >
                      {pill.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="sticky top-0 bg-slate-50/95 backdrop-blur-xs text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 z-10 shadow-2xs">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Bill / Ref #</th>
                  <th className="py-3 px-4">Vendor & Contact</th>
                  <th className="py-3 px-4">Payment Category</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Total Billed (₹)</th>
                  <th className="py-3 px-4 text-right">Paid Out (₹)</th>
                  <th className="py-3 px-4 text-right">Pending Payable (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                      Loading live vendor payment records...
                    </td>
                  </tr>
                ) : paginatedBills.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No purchase records found matching your filters.
                    </td>
                  </tr>
                ) : (
                  paginatedBills.map((b) => (
                    <tr key={b.id} className="hover:bg-indigo-50/25 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {b.date || "—"}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                        {b.bill_number}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{b.vendor_name}</div>
                        {(b.vendor_phone || b.vendor_gstin) && (
                          <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                            {b.vendor_phone && <span>{b.vendor_phone}</span>}
                            {b.vendor_gstin && (
                              <span className="font-mono text-[9px] bg-slate-100 px-1 py-0.2 rounded text-slate-600">
                                {b.vendor_gstin}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            b.category === "cash"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : b.category === "upi"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : b.category === "bank"
                              ? "bg-sky-50 text-sky-700 border border-sky-200"
                              : b.category === "cheque"
                              ? "bg-teal-50 text-teal-700 border border-teal-200"
                              : b.category === "debit_note"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : b.category === "split"
                              ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                              : "bg-pink-50 text-pink-700 border border-pink-200"
                          }`}
                        >
                          {b.category === "split" ? (b.payment_mode_raw || "Split Payment") : (b.category_label || b.payment_mode_raw || b.category || "Cash")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            b.status === "Paid"
                              ? "bg-emerald-100 text-emerald-800"
                              : b.status === "Partially Paid"
                              ? "bg-sky-100 text-sky-800"
                              : b.status === "Cancelled"
                              ? "bg-slate-100 text-slate-500"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {b.status || "Payable"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900 whitespace-nowrap">
                        {formatCurrency(b.total_amount)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600 whitespace-nowrap">
                        {formatCurrency(b.paid_amount)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold whitespace-nowrap">
                        {b.pending_amount > 0.01 ? (
                          <span className="text-rose-600 font-black">
                            {formatCurrency(b.pending_amount)}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">₹0.00</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Summary & Pagination Controls */}
          <div className="px-5 py-3.5 border-t border-slate-200/90 bg-slate-50/70 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-slate-600">
            {/* Left: Showing count & Rows per page */}
            <div className="flex items-center gap-3">
              <span>
                Showing{" "}
                <strong className="text-slate-900 font-bold">
                  {totalBillsCount === 0
                    ? 0
                    : (currentPage - 1) * (pageSize || totalBillsCount) + 1}
                </strong>{" "}
                to{" "}
                <strong className="text-slate-900 font-bold">
                  {pageSize === 0
                    ? totalBillsCount
                    : Math.min(currentPage * pageSize, totalBillsCount)}
                </strong>{" "}
                of{" "}
                <strong className="text-slate-900 font-bold">
                  {totalBillsCount}
                </strong>{" "}
                Vendor Bills
              </span>

              <div className="flex items-center gap-1.5 ml-2">
                <span className="text-slate-400 font-medium text-[11px]">Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="h-7 px-2 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={0}>All</option>
                </select>
              </div>
            </div>

            {/* Middle: Active Filter Grand Totals */}
            <div className="hidden lg:flex items-center gap-4 text-xs">
              <span>
                Procurement:{" "}
                <strong className="text-slate-900 font-black">
                  {formatCurrency(filteredTotals.total)}
                </strong>
              </span>
              <span>
                Paid Out:{" "}
                <strong className="text-emerald-600 font-black">
                  {formatCurrency(filteredTotals.paid)}
                </strong>
              </span>
              <span>
                Pending:{" "}
                <strong className="text-rose-600 font-black">
                  {formatCurrency(filteredTotals.pending)}
                </strong>
              </span>
            </div>

            {/* Right: Pagination Navigation */}
            {pageSize > 0 && totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>

                <div className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700">
                  Page <span className="text-indigo-600">{currentPage}</span> of{" "}
                  {totalPages}
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
