import React, { useState, useEffect, useMemo } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import {
  Plus,
  FileCheck,
  Loader2,
  X,
  Search,
  Printer,
  Calendar,
  Building2,
  Receipt,
  RotateCcw,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Eye,
  CheckCircle2,
  Filter,
} from "lucide-react";
import { inventoryApi, numberSeriesApi } from "../../lib/api-client";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { formatDisplayDate } from "@/lib/utils";
import { printHtmlInPage } from "@/lib/print-helper";
import { getActiveBillingGst } from "@/lib/receipt-template-store";
import { renderNoteDocument, resolveNotePrintTemplate } from "@/lib/note-document-renderer";
import { PaginationControl } from "@/components/ui/PaginationControl";

export interface VendorCreditNoteItem {
  id: string;
  note_number: string;
  supplier_id?: string;
  supplier_name: string;
  amount: number;
  status: "Unapplied" | "Applied" | "Refunded" | string;
  reference_number?: string;
  bill_number?: string;
  vendor_bill_id?: string;
  notes?: string;
  created_at?: string;
}

export function CreditNotes() {
  const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();
  
  const [notes, setNotes] = useState<VendorCreditNoteItem[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [vendorBills, setVendorBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modal State for Generating CN
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cnNo, setCnNo] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [selectedBillId, setSelectedBillId] = useState("");
  const [billReference, setBillReference] = useState("");
  const [amount, setAmount] = useState<number | string>(1000);
  const [reasonCategory, setReasonCategory] = useState("Vendor Rebate / Post-Sale Discount");
  const [notesText, setNotesText] = useState("");

  // Voucher Detail View Modal State
  const [viewingVoucher, setViewingVoucher] = useState<VendorCreditNoteItem | null>(null);

  const currentTenantId = (tenant as any)?.raw?.tenant_id || (tenant as any)?.tenant_id || tenant?.id || "default";
  const currentCompanyId = tenant?.id || (tenant as any)?.raw?.id || (tenant as any)?.company_id || "default";
  const localStorageKey = `procurement_credit_notes_${currentTenantId}_${currentCompanyId}`;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, dateFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [supps, res, bills] = await Promise.all([
        inventoryApi.getSuppliers().catch(() => []),
        inventoryApi.getVendorCreditNotes().catch(() => []),
        inventoryApi.getVendorBills().catch(() => []),
      ]);

      setSuppliers(supps || []);
      setVendorBills(bills || []);

      const apiList: VendorCreditNoteItem[] = (res || []).map((cn: any) => ({
        id: cn.id,
        note_number: cn.note_number || `CN-${String(cn.id).slice(0, 8)}`,
        supplier_id: cn.supplier_id,
        supplier_name: cn.supplier_name || "Vendor / Supplier",
        amount: Number(cn.amount || 0),
        status: cn.status || "Unapplied",
        reference_number: cn.reference_number || cn.bill_number,
        bill_number: cn.bill_number || cn.reference_number,
        vendor_bill_id: cn.vendor_bill_id,
        notes: cn.notes,
        created_at: cn.created_at || new Date().toISOString(),
      }));

      // Merge with localStorage fallback
      let localList: VendorCreditNoteItem[] = [];
      try {
        const raw = localStorage.getItem(localStorageKey);
        if (raw) localList = JSON.parse(raw);
      } catch (e) {
        console.warn("Error reading localStorage credit notes:", e);
      }

      const map = new Map<string, VendorCreditNoteItem>();
      apiList.forEach((it) => map.set(it.note_number, it));
      localList.forEach((it) => {
        if (!map.has(it.note_number)) map.set(it.note_number, it);
      });

      setNotes(Array.from(map.values()));
    } catch (err: any) {
      toast.error(err.message || "Failed to load credit notes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Check if opened with pre-selected bill from query param
    const params = new URLSearchParams(window.location.search);
    const billIdParam = params.get("bill_id");
    if (billIdParam) {
      handleOpenNew(billIdParam);
    }
  }, [tenant?.id]);

  const handleOpenNew = async (preSelectedBillId?: string) => {
    // Pre-fill with the configured NumberSeries next number (Settings → Credit/Debit Note
    // prefix + sequence) rather than a hard-coded CN-2026-xxxx. Falls back to a locally
    // detected sequence when the peek is unavailable.
    let cnNum = "";
    try {
      const peek = await numberSeriesApi.peekNextNumber("credit_notes");
      if (peek?.formatted_number) cnNum = peek.formatted_number;
    } catch { /* fall through */ }
    if (!cnNum) {
      const nextSeq = String(notes.length + 1).padStart(4, "0");
      cnNum = `CN-2026-${nextSeq}`;
    }
    setCnNo(cnNum);
    setAmount(1000);
    setReasonCategory("Vendor Rebate / Post-Sale Discount");
    setNotesText("");

    if (preSelectedBillId && vendorBills.length > 0) {
      const b = vendorBills.find((x) => x.id === preSelectedBillId || x.bill_number === preSelectedBillId);
      if (b) {
        setSelectedBillId(b.id);
        setSupplierId(b.supplier_id || "");
        setBillReference(b.bill_number || "");
        setAmount(Number(b.total_amount || 1000));
        setIsOpen(true);
        return;
      }
    }

    setSelectedBillId("");
    setBillReference("");
    setSupplierId(suppliers[0]?.id || "");
    setIsOpen(true);
  };

  const handleBillSelectionChange = (bId: string) => {
    setSelectedBillId(bId);
    if (!bId) {
      setBillReference("");
      return;
    }
    const matched = vendorBills.find((x) => x.id === bId);
    if (matched) {
      setBillReference(matched.bill_number || "");
      if (matched.supplier_id) setSupplierId(matched.supplier_id);
      if (matched.total_amount) setAmount(Number(matched.total_amount));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cnNo.trim()) return toast.error("Please enter a valid Credit Note Number.");
    if (!amount || Number(amount) <= 0) return toast.error("Credit amount must be greater than zero.");

    const suppObj = suppliers.find((s) => s.id === supplierId) || { name: "Vendor Partner" };
    const fullNotes = `[Category: ${reasonCategory}] ${notesText.trim() ? "• " + notesText.trim() : ""}`.trim();

    setIsSubmitting(true);
    try {
      await inventoryApi.createVendorCreditNote({
        note_number: cnNo.trim(),
        supplier_id: supplierId || undefined,
        amount: Number(amount),
        vendor_bill_id: selectedBillId || undefined,
        reference_number: billReference.trim() || undefined,
        notes: fullNotes,
        status: "Unapplied",
      });

      // Save to localStorage for instant local reactivity
      const newEntry: VendorCreditNoteItem = {
        id: `cn-loc-${Date.now()}`,
        note_number: cnNo.trim(),
        supplier_id: supplierId,
        supplier_name: suppObj.name,
        amount: Number(amount),
        status: "Unapplied",
        reference_number: billReference.trim() || undefined,
        bill_number: billReference.trim() || undefined,
        vendor_bill_id: selectedBillId || undefined,
        notes: fullNotes,
        created_at: new Date().toISOString(),
      };

      try {
        const existing = JSON.parse(localStorage.getItem(localStorageKey) || "[]");
        localStorage.setItem(localStorageKey, JSON.stringify([newEntry, ...existing]));
      } catch (e) {}

      toast.success(`Vendor Credit Note ${cnNo} generated successfully.`);
      setIsOpen(false);
      window.dispatchEvent(new CustomEvent("bos-tenant-changed"));
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create Credit Note");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter & Search Logic
  const filteredNotes = useMemo(() => {
    return notes.filter((cn) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        (cn.note_number || "").toLowerCase().includes(q) ||
        (cn.supplier_name || "").toLowerCase().includes(q) ||
        (cn.bill_number || "").toLowerCase().includes(q) ||
        (cn.reference_number || "").toLowerCase().includes(q) ||
        (cn.notes || "").toLowerCase().includes(q);

      const matchStatus =
        statusFilter === "all" || (cn.status || "").toLowerCase() === statusFilter.toLowerCase();

      return matchQuery && matchStatus;
    });
  }, [notes, searchQuery, statusFilter, dateFilter]);

  // KPI Calculations
  const stats = useMemo(() => {
    const totalCount = notes.length;
    const totalCredit = notes.reduce((sum, n) => sum + Number(n.amount || 0), 0);
    const appliedAmount = notes
      .filter((n) => (n.status || "").toLowerCase() === "applied")
      .reduce((sum, n) => sum + Number(n.amount || 0), 0);
    const unappliedAmount = totalCredit - appliedAmount;

    return { totalCount, totalCredit, appliedAmount, unappliedAmount };
  }, [notes]);

  // Pagination
  const totalPages = Math.ceil(filteredNotes.length / pageSize) || 1;
  const paginatedNotes = filteredNotes.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Print Credit Note Handler
  // Respects the user's selected print template for the "credit_note" category
  // (when one is set), and falls back to a clean uniform layout built from the
  // active billing GST branding when none is selected. All rendering lives in
  // the shared note-document-renderer helper.
  const handlePrint = (cn: VendorCreditNoteItem) => {
    const activeBillingGst = getActiveBillingGst(tenant?.id);
    const orgName = activeBillingGst?.trade_name || activeBillingGst?.legal_name || tenant?.name || "BusinessOS AI";
    const orgGstin = activeBillingGst?.gstin || (tenant as any)?.settings?.gstin || "";
    const orgAddress = activeBillingGst?.address || (tenant as any)?.settings?.address || "Corporate Office";
    const orgPhone = activeBillingGst?.phone || (tenant as any)?.settings?.phone || "+91 98493 44919";

    const template = resolveNotePrintTemplate("credit_note", tenant?.id);
    const printHtml = renderNoteDocument("credit_note", {
      note_number: cn.note_number,
      amount: Number(cn.amount || 0),
      status: cn.status,
      party: cn.supplier_name || "Vendor / Supplier",
      reference_no: cn.bill_number || cn.reference_number || "Direct Credit",
      reference_label: "Original Purchase Bill Ref",
      reason: cn.notes || "Vendor credit adjustment applied to accounts payable",
      date_iso: cn.created_at,
    }, {
      name: orgName,
      gstin: orgGstin,
      address: orgAddress,
      phone: orgPhone,
      logo_url: activeBillingGst?.logo_url || null,
      currency_symbol: currency.symbol,
      upi_vpa: activeBillingGst?.upi_vpa || null,
      bank_name: activeBillingGst?.bank_name || null,
      bank_account_number: activeBillingGst?.bank_account_number || null,
      bank_ifsc: activeBillingGst?.bank_ifsc || null,
      signature_url: activeBillingGst?.signature_url || null,
      terms_and_conditions: activeBillingGst?.terms_and_conditions || null,
    }, template);
    printHtmlInPage(printHtml, 300);
  };

  return (
    <div className="space-y-6 text-foreground">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileCheck className="size-6 text-emerald-600" />
            Vendor Credit Notes
          </h2>
          <p className="text-sm text-muted-foreground">
            Track vendor credits received for purchase discounts, allowances, rebates, and price revisions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => handleOpenNew()}
            className="gradient-brand text-white border-0 font-semibold rounded-lg shadow-sm hover:opacity-95"
          >
            <Plus className="size-4 mr-2" /> Generate CN
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-card border rounded-xl shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            <span>Total Credit Notes</span>
            <FileCheck className="size-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.totalCount}</div>
          <p className="text-xs text-muted-foreground">Logged vendor credits</p>
        </Card>

        <Card className="p-4 bg-card border rounded-xl shadow-sm space-y-1">
          <div className="flex items-center justify-between text-emerald-600 text-xs font-semibold uppercase tracking-wider">
            <span>Total Credit Amount</span>
            <TrendingUp className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            {currency.symbol}{stats.totalCredit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground">Gross supplier allowances</p>
        </Card>

        <Card className="p-4 bg-card border rounded-xl shadow-sm space-y-1">
          <div className="flex items-center justify-between text-blue-600 text-xs font-semibold uppercase tracking-wider">
            <span>Applied to Bills</span>
            <CheckCircle2 className="size-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {currency.symbol}{stats.appliedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground">Offset against invoices</p>
        </Card>

        <Card className="p-4 bg-card border rounded-xl shadow-sm space-y-1">
          <div className="flex items-center justify-between text-amber-600 text-xs font-semibold uppercase tracking-wider">
            <span>Unapplied Balance</span>
            <AlertCircle className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600">
            {currency.symbol}{stats.unappliedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground">Available store credit</p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 bg-card border rounded-xl shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by CN #, supplier, purchase bill #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-background border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-background border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="Unapplied">Unapplied</option>
              <option value="Applied">Applied</option>
              <option value="Refunded">Refunded</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Credit Notes Table */}
      <Card className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-slate-50/70 dark:bg-slate-900/40 border-b text-slate-600 dark:text-slate-400 text-xs uppercase font-semibold">
              <tr>
                <th className="py-4 px-6">CN Number</th>
                <th className="py-4 px-6">Supplier Vendor</th>
                <th className="py-4 px-6">Target Purchase Invoice</th>
                <th className="py-4 px-6 text-right">Credit Amount</th>
                <th className="py-4 px-6">Date Generated</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                    Loading credit notes ledger...
                  </td>
                </tr>
              ) : paginatedNotes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted-foreground font-semibold">
                    No vendor credit notes found matching the selected filters.
                  </td>
                </tr>
              ) : (
                paginatedNotes.map((cn) => (
                  <tr key={cn.id || cn.note_number} className="hover:bg-muted/40 transition-colors">
                    <td className="py-4 px-6 font-mono font-bold">
                      <div className="flex items-center gap-2">
                        <FileCheck className="size-4 text-emerald-500" />
                        <span className="text-foreground">{cn.note_number}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-semibold text-foreground">
                      <div>{cn.supplier_name}</div>
                      {cn.notes && (
                        <div className="text-xs text-muted-foreground truncate max-w-xs">{cn.notes}</div>
                      )}
                    </td>
                    <td className="py-4 px-6 font-mono text-xs font-semibold text-primary">
                      {cn.bill_number || cn.reference_number ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-primary/10 text-primary">
                          <Receipt className="size-3" />
                          {cn.bill_number || cn.reference_number}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Direct Note</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-emerald-600 font-mono text-base">
                      {currency.symbol}{cn.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-6 font-mono text-xs text-muted-foreground">
                      {cn.created_at ? formatDisplayDate(cn.created_at) : "—"}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          (cn.status || "").toLowerCase() === "applied"
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            : (cn.status || "").toLowerCase() === "refunded"
                            ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                            : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                        }`}
                      >
                        {cn.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setViewingVoucher(cn)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          title="View Voucher Details"
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handlePrint(cn)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-emerald-600"
                          title="Print Credit Note"
                        >
                          <Printer className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredNotes.length > pageSize && (
          <div className="p-4 border-t border-border">
            <PaginationControl
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredNotes.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </Card>

      {/* Generate Credit Note Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 text-foreground animate-in fade-in-50 zoom-in-95">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                <FileCheck className="w-5 h-5 text-emerald-600" />
                Generate Vendor Credit Note (CN)
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground rounded-lg p-1 hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <label className="font-semibold text-xs text-muted-foreground uppercase">
                  Link to Purchase Invoice (Optional)
                </label>
                <select
                  value={selectedBillId}
                  onChange={(e) => handleBillSelectionChange(e.target.value)}
                  className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm cursor-pointer focus:ring-1 focus:ring-primary focus:outline-none"
                >
                  <option value="">Select a Purchase Invoice (or leave blank for direct credit)</option>
                  {vendorBills.map((b) => (
                    <option key={b.id} value={b.id}>
                      Bill #{b.bill_number} • {b.supplier_name} • {currency.symbol}
                      {Number(b.total_amount || 0).toLocaleString("en-IN")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-semibold text-xs text-muted-foreground uppercase">
                    CN Document ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={cnNo}
                    onChange={(e) => setCnNo(e.target.value)}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-xs text-muted-foreground uppercase">
                    Credit Value ({currency.symbol}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm font-bold text-emerald-600 focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-xs text-muted-foreground uppercase">
                  Supplier / Vendor *
                </label>
                <select
                  required
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm cursor-pointer focus:ring-1 focus:ring-primary focus:outline-none"
                >
                  <option value="">Select Vendor Partner</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.phone ? `(${s.phone})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-xs text-muted-foreground uppercase">
                  Reason Category
                </label>
                <select
                  value={reasonCategory}
                  onChange={(e) => setReasonCategory(e.target.value)}
                  className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm cursor-pointer focus:ring-1 focus:ring-primary focus:outline-none"
                >
                  <option value="Vendor Rebate / Post-Sale Discount">Vendor Rebate / Post-Sale Discount</option>
                  <option value="Rate Difference / Price Reduction">Rate Difference / Price Reduction</option>
                  <option value="Quality Allowance / Goodwill Credit">Quality Allowance / Goodwill Credit</option>
                  <option value="Volume Target Incentive">Volume Target Incentive</option>
                  <option value="Goods Return Credit Memo">Goods Return Credit Memo</option>
                  <option value="Other Vendor Credit">Other Vendor Credit</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-xs text-muted-foreground uppercase">
                  Notes & Remarks
                </label>
                <textarea
                  rows={2}
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder="e.g. 5% quarterly rebate granted by vendor against invoices..."
                  className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  variant="outline"
                  className="rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="gradient-brand text-white border-0 font-semibold rounded-lg shadow-sm"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    "Save & Record Credit Note"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Viewing Voucher Modal */}
      {viewingVoucher && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 text-foreground animate-in fade-in-50 zoom-in-95">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <FileCheck className="size-5 text-emerald-600" />
                  Vendor Credit Note Details
                </h3>
                <p className="text-xs text-muted-foreground font-mono">{viewingVoucher.note_number}</p>
              </div>
              <button
                onClick={() => setViewingVoucher(null)}
                className="text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3 p-4 bg-muted/40 rounded-xl border">
                <div>
                  <span className="text-xs text-muted-foreground font-semibold uppercase">Vendor</span>
                  <div className="font-bold text-base text-foreground mt-0.5">{viewingVoucher.supplier_name}</div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground font-semibold uppercase">Credit Amount</span>
                  <div className="font-bold text-xl text-emerald-600 font-mono mt-0.5">
                    {currency.symbol}{viewingVoucher.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-muted-foreground">Linked Purchase Invoice:</span>
                  <div className="font-mono font-semibold text-primary mt-0.5">
                    {viewingVoucher.bill_number || viewingVoucher.reference_number || "Direct Credit"}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Date Issued:</span>
                  <div className="font-mono mt-0.5">
                    {viewingVoucher.created_at ? formatDisplayDate(viewingVoucher.created_at) : "—"}
                  </div>
                </div>
              </div>

              {viewingVoucher.notes && (
                <div className="p-3 bg-background border rounded-lg">
                  <span className="text-xs text-muted-foreground font-semibold uppercase">Reason / Notes:</span>
                  <p className="text-xs mt-1 text-foreground leading-relaxed">{viewingVoucher.notes}</p>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t">
              <Button
                variant="outline"
                onClick={() => handlePrint(viewingVoucher)}
                className="rounded-lg gap-2"
              >
                <Printer className="size-4" />
                Print Voucher
              </Button>
              <Button
                onClick={() => setViewingVoucher(null)}
                className="gradient-brand text-white border-0 rounded-lg px-6"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
