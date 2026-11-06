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
  TrendingDown,
  DollarSign,
  Eye,
  CheckCircle2,
  Filter,
  Pencil,
  Trash2,
} from "lucide-react";
import { inventoryApi, numberSeriesApi } from "../../lib/api-client";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useStoreLocations } from "@/hooks/use-store-locations";
import { useTenant } from "@/contexts/tenant-context";
import { formatDisplayDate } from "@/lib/utils";
import { printHtmlInPage } from "@/lib/print-helper";
import { getActiveBillingGst } from "@/lib/receipt-template-store";
import { loadStoredInvoiceSettings, saveStoredInvoiceSettings, syncAndHardResetSequencesFromServer } from "../pos/InvoiceQuickSettingsModal";
import { renderNoteDocument, resolveNotePrintTemplate } from "@/lib/note-document-renderer";
import { PaginationControl } from "@/components/ui/PaginationControl";

export interface VendorDebitNoteItem {
  id: string;
  note_number: string;
  supplier_id?: string;
  supplier_name: string;
  amount: number;
  status: "Draft" | "Issued" | "Settled" | string;
  reference_number?: string;
  bill_number?: string;
  vendor_bill_id?: string;
  notes?: string;
  created_at?: string;
}

export function DebitNotes() {
  const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();
  const { stores, selectedStore, setSelectedStore } = useStoreLocations();
  const [selectedLocation, setSelectedLocation] = useState<string>(() => selectedStore);
  
  const [notes, setNotes] = useState<VendorDebitNoteItem[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [vendorBills, setVendorBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modal State for Generating / Editing DN
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dnNo, setDnNo] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [selectedBillId, setSelectedBillId] = useState("");
  const [billReference, setBillReference] = useState("");
  const [amount, setAmount] = useState<number | string>(1000);
  const [reasonCategory, setReasonCategory] = useState("Purchase Return / Defective Goods");
  const [notesText, setNotesText] = useState("");
  const [noteStatus, setNoteStatus] = useState("Issued");

  // Voucher Detail View Modal State
  const [viewingVoucher, setViewingVoucher] = useState<VendorDebitNoteItem | null>(null);

  const currentTenantId = (tenant as any)?.raw?.tenant_id || (tenant as any)?.tenant_id || tenant?.id || "default";
  const currentCompanyId = tenant?.id || (tenant as any)?.raw?.id || (tenant as any)?.company_id || "default";
  const localStorageKey = `procurement_debit_notes_${currentTenantId}_${currentCompanyId}`;

  useEffect(() => {
    if (selectedStore && (!selectedLocation || selectedLocation.includes("Main Store"))) {
      setSelectedLocation(selectedStore);
    }
  }, [selectedStore]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, dateFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [supps, res, bills] = await Promise.all([
        inventoryApi.getSuppliers().catch(() => []),
        inventoryApi.getVendorDebitNotes().catch(() => []),
        inventoryApi.getVendorBills().catch(() => []),
      ]);

      setSuppliers(supps || []);
      setVendorBills(bills || []);

      const apiList: VendorDebitNoteItem[] = (res || []).map((dn: any) => ({
        id: dn.id,
        note_number: dn.note_number || `DN-${String(dn.id).slice(0, 8)}`,
        supplier_id: dn.supplier_id,
        supplier_name: dn.supplier_name || "Vendor / Supplier",
        amount: Number(dn.amount || 0),
        status: dn.status || "Issued",
        reference_number: dn.reference_number || dn.bill_number,
        bill_number: dn.bill_number || dn.reference_number,
        vendor_bill_id: dn.vendor_bill_id,
        notes: dn.notes,
        created_at: dn.created_at || new Date().toISOString(),
      }));

      // Merge with localStorage fallback
      let localList: VendorDebitNoteItem[] = [];
      try {
        const raw = localStorage.getItem(localStorageKey);
        if (raw) localList = JSON.parse(raw);
      } catch (e) {
        console.warn("Error reading localStorage debit notes:", e);
      }

      const map = new Map<string, VendorDebitNoteItem>();
      apiList.forEach((it) => map.set(it.note_number, it));
      localList.forEach((it) => {
        if (!map.has(it.note_number)) map.set(it.note_number, it);
      });

      setNotes(Array.from(map.values()));
    } catch (err: any) {
      toast.error(err.message || "Failed to load debit notes");
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
    setEditingId(null);
    setNoteStatus("Issued");
    // Pre-fill with the configured NumberSeries next number (Settings → Credit/Debit Note
    // prefix + sequence) rather than a hard-coded DN-2026-xxxx. Falls back to a locally
    // detected sequence when the peek is unavailable.
    const synced = await syncAndHardResetSequencesFromServer(tenant?.id).catch(() => null);
    const invSettings = synced || loadStoredInvoiceSettings(tenant?.id);
    const dnPfx = invSettings.debitNotePrefix || "DN-";
    const dnSeq = Math.max(1, Number(invSettings.debitNoteSequenceNumber || 1));
    const dnPad = Number(invSettings.debitNotePadding ?? 4);
    const dnNum = `${dnPfx}${String(dnSeq).padStart(dnPad, "0")}`;
    setDnNo(dnNum);
    setAmount(1000);
    setReasonCategory("Purchase Return / Defective Goods");
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

  const handleOpenEdit = (dn: VendorDebitNoteItem) => {
    setEditingId(dn.id);
    setDnNo(dn.note_number || "");
    setSupplierId(dn.supplier_id || suppliers.find((s) => s.name === dn.supplier_name)?.id || "");
    setSelectedBillId(dn.vendor_bill_id || "");
    setBillReference(dn.bill_number || dn.reference_number || "");
    setAmount(Number(dn.amount || 0));
    setNoteStatus(dn.status || "Issued");
    const catMatch = (dn.notes || "").match(/^\[Category:\s*([^\]]+)\]\s*(?:•\s*)?(.*)$/);
    if (catMatch) {
      setReasonCategory(catMatch[1].trim());
      setNotesText(catMatch[2].trim());
    } else {
      setReasonCategory("Purchase Return / Defective Goods");
      setNotesText(dn.notes || "");
    }
    setIsOpen(true);
  };

  const handleDelete = async (dn: VendorDebitNoteItem) => {
    if (!window.confirm(`Delete Vendor Debit Note ${dn.note_number}?`)) return;
    try {
      if (dn.id && !String(dn.id).startsWith("dn-loc-")) {
        await inventoryApi.deleteVendorDebitNote(dn.id);
      }
      try {
        const existing = JSON.parse(localStorage.getItem(localStorageKey) || "[]");
        const updated = existing.filter(
          (it: any) => it.id !== dn.id && it.note_number !== dn.note_number
        );
        localStorage.setItem(localStorageKey, JSON.stringify(updated));
      } catch (e) {}
      setNotes((prev) => prev.filter((it) => it.id !== dn.id && it.note_number !== dn.note_number));
      if (viewingVoucher?.id === dn.id) setViewingVoucher(null);
      toast.success(`Vendor Debit Note ${dn.note_number} deleted.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete Debit Note");
    }
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
    if (!dnNo.trim()) return toast.error("Please enter a valid Debit Note Number.");
    if (!amount || Number(amount) <= 0) return toast.error("Debit amount must be greater than zero.");

    const suppObj = suppliers.find((s) => s.id === supplierId) || { name: "Vendor Partner" };
    const fullNotes = `[Category: ${reasonCategory}] ${notesText.trim() ? "• " + notesText.trim() : ""}`.trim();

    setIsSubmitting(true);
    try {
      if (editingId) {
        if (!String(editingId).startsWith("dn-loc-")) {
          await inventoryApi.updateVendorDebitNote(editingId, {
            note_number: dnNo.trim(),
            supplier_id: supplierId || undefined,
            amount: Number(amount),
            vendor_bill_id: selectedBillId || undefined,
            reference_number: billReference.trim() || undefined,
            notes: fullNotes,
            status: noteStatus || "Issued",
          });
        }
        try {
          const existing = JSON.parse(localStorage.getItem(localStorageKey) || "[]");
          const updated = existing.map((it: any) =>
            it.id === editingId || it.note_number === dnNo.trim()
              ? {
                  ...it,
                  note_number: dnNo.trim(),
                  supplier_id: supplierId,
                  supplier_name: suppObj.name,
                  amount: Number(amount),
                  status: noteStatus || "Issued",
                  reference_number: billReference.trim() || undefined,
                  bill_number: billReference.trim() || undefined,
                  vendor_bill_id: selectedBillId || undefined,
                  notes: fullNotes,
                }
              : it
          );
          localStorage.setItem(localStorageKey, JSON.stringify(updated));
        } catch (e) {}
        toast.success(`Vendor Debit Note ${dnNo} updated successfully.`);
      } else {
        await inventoryApi.createVendorDebitNote({
          note_number: dnNo.trim(),
          supplier_id: supplierId || undefined,
          amount: Number(amount),
          vendor_bill_id: selectedBillId || undefined,
          reference_number: billReference.trim() || undefined,
          notes: fullNotes,
          status: "Issued",
        });

        // Save to localStorage for instant local reactivity
        const newEntry: VendorDebitNoteItem = {
          id: `dn-loc-${Date.now()}`,
          note_number: dnNo.trim(),
          supplier_id: supplierId,
          supplier_name: suppObj.name,
          amount: Number(amount),
          status: "Issued",
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

        const curInv = loadStoredInvoiceSettings(tenant?.id);
        const trailingDigits = dnNo.trim().match(/(\d+)\D*$/);
        const usedSeq = trailingDigits ? parseInt(trailingDigits[1], 10) : 0;
        const nextDnSeq = usedSeq > 0 ? Math.max(Number(curInv.debitNoteSequenceNumber || 1) + 1, usedSeq + 1) : Number(curInv.debitNoteSequenceNumber || 1) + 1;
        saveStoredInvoiceSettings({ ...curInv, debitNoteSequenceNumber: nextDnSeq }, tenant?.id);
        toast.success(`Vendor Debit Note ${dnNo} generated successfully.`);
      }
      setIsOpen(false);
      setEditingId(null);
      window.dispatchEvent(new CustomEvent("bos-tenant-changed"));
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save Debit Note");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter & Search Logic
  const filteredNotes = useMemo(() => {
    return notes.filter((dn) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        (dn.note_number || "").toLowerCase().includes(q) ||
        (dn.supplier_name || "").toLowerCase().includes(q) ||
        (dn.bill_number || "").toLowerCase().includes(q) ||
        (dn.reference_number || "").toLowerCase().includes(q) ||
        (dn.notes || "").toLowerCase().includes(q);

      const matchStatus =
        statusFilter === "all" || (dn.status || "").toLowerCase() === statusFilter.toLowerCase();

      return matchQuery && matchStatus;
    });
  }, [notes, searchQuery, statusFilter, dateFilter]);

  // KPI Calculations
  const stats = useMemo(() => {
    const totalCount = notes.length;
    const totalDebited = notes.reduce((sum, n) => sum + Number(n.amount || 0), 0);
    const settledAmount = notes
      .filter((n) => (n.status || "").toLowerCase() === "settled")
      .reduce((sum, n) => sum + Number(n.amount || 0), 0);
    const activeAmount = totalDebited - settledAmount;

    return { totalCount, totalDebited, settledAmount, activeAmount };
  }, [notes]);

  // Pagination
  const totalPages = Math.ceil(filteredNotes.length / pageSize) || 1;
  const paginatedNotes = filteredNotes.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Print Debit Note Handler
  // Respects the user's selected print template for the "debit_note" category
  // (when one is set), and falls back to a clean uniform layout built from the
  // active billing GST branding when none is selected. All rendering lives in
  // the shared note-document-renderer helper.
  const handlePrint = (dn: VendorDebitNoteItem) => {
    const activeBillingGst = getActiveBillingGst(tenant?.id);
    const orgName = activeBillingGst?.trade_name || activeBillingGst?.legal_name || tenant?.name || "BusinessOS AI";
    const orgGstin = activeBillingGst?.gstin || (tenant as any)?.settings?.gstin || "";
    const orgAddress = activeBillingGst?.address || (tenant as any)?.settings?.address || "Corporate Office";
    const orgPhone = activeBillingGst?.phone || (tenant as any)?.settings?.phone || "+91 98493 44919";

    const template = resolveNotePrintTemplate("debit_note", tenant?.id);
    const printHtml = renderNoteDocument("debit_note", {
      note_number: dn.note_number,
      amount: Number(dn.amount || 0),
      status: dn.status,
      party: dn.supplier_name || "Vendor / Supplier",
      reference_no: dn.bill_number || dn.reference_number || "Direct Adjustment",
      reference_label: "Purchase Invoice Ref",
      reason: dn.notes || "Debit adjustment against vendor account",
      date_iso: dn.created_at,
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
            <RotateCcw className="size-6 text-rose-600" />
            Vendor Debit Notes
          </h2>
          <p className="text-sm text-muted-foreground">
            Generate and track debit notes issued to suppliers for purchase returns, damages, and rate differences.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => handleOpenNew()}
            className="gradient-brand text-white border-0 font-semibold rounded-lg shadow-sm hover:opacity-95"
          >
            <Plus className="size-4 mr-2" /> Generate DN
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-card border rounded-xl shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            <span>Total Debit Notes</span>
            <FileCheck className="size-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.totalCount}</div>
          <p className="text-xs text-muted-foreground">Logged debit vouchers</p>
        </Card>

        <Card className="p-4 bg-card border rounded-xl shadow-sm space-y-1">
          <div className="flex items-center justify-between text-rose-600 text-xs font-semibold uppercase tracking-wider">
            <span>Total Debited Amount</span>
            <TrendingDown className="size-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600">
            {currency.symbol}{stats.totalDebited.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground">Gross supplier deductions</p>
        </Card>

        <Card className="p-4 bg-card border rounded-xl shadow-sm space-y-1">
          <div className="flex items-center justify-between text-emerald-600 text-xs font-semibold uppercase tracking-wider">
            <span>Settled Against Bills</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            {currency.symbol}{stats.settledAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground">Reduced payables</p>
        </Card>

        <Card className="p-4 bg-card border rounded-xl shadow-sm space-y-1">
          <div className="flex items-center justify-between text-amber-600 text-xs font-semibold uppercase tracking-wider">
            <span>Pending / Open Claims</span>
            <AlertCircle className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600">
            {currency.symbol}{stats.activeAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground">Unapplied claims</p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 bg-card border rounded-xl shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by DN #, supplier, purchase bill #..."
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
              <option value="Issued">Issued</option>
              <option value="Draft">Draft</option>
              <option value="Settled">Settled</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Debit Notes Table */}
      <Card className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-slate-50/70 dark:bg-slate-900/40 border-b text-slate-600 dark:text-slate-400 text-xs uppercase font-semibold">
              <tr>
                <th className="py-4 px-6">DN Number</th>
                <th className="py-4 px-6">Supplier Vendor</th>
                <th className="py-4 px-6">Target Purchase Invoice</th>
                <th className="py-4 px-6 text-right">Debit Amount</th>
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
                    Loading debit notes ledger...
                  </td>
                </tr>
              ) : paginatedNotes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted-foreground font-semibold">
                    No vendor debit notes found matching the selected filters.
                  </td>
                </tr>
              ) : (
                paginatedNotes.map((dn) => (
                  <tr key={dn.id || dn.note_number} className="hover:bg-muted/40 transition-colors">
                    <td className="py-4 px-6 font-mono font-bold">
                      <div className="flex items-center gap-2">
                        <FileCheck className="size-4 text-rose-500" />
                        <span className="text-foreground">{dn.note_number}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-semibold text-foreground">
                      <div>{dn.supplier_name}</div>
                      {dn.notes && (
                        <div className="text-xs text-muted-foreground truncate max-w-xs">{dn.notes}</div>
                      )}
                    </td>
                    <td className="py-4 px-6 font-mono text-xs font-semibold text-primary">
                      {dn.bill_number || dn.reference_number ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-primary/10 text-primary">
                          <Receipt className="size-3" />
                          {dn.bill_number || dn.reference_number}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Direct Note</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-rose-600 font-mono text-base">
                      {currency.symbol}{dn.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-6 font-mono text-xs text-muted-foreground">
                      {dn.created_at ? formatDisplayDate(dn.created_at) : "—"}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          (dn.status || "").toLowerCase() === "settled"
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            : (dn.status || "").toLowerCase() === "issued"
                            ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                            : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                        }`}
                      >
                        {dn.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setViewingVoucher(dn)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          title="View Voucher Details"
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenEdit(dn)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-blue-600"
                          title="Edit Debit Note"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handlePrint(dn)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600"
                          title="Print Debit Note"
                        >
                          <Printer className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleDelete(dn)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600"
                          title="Delete Debit Note"
                        >
                          <Trash2 className="size-4" />
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

      {/* Generate Debit Note Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 text-foreground animate-in fade-in-50 zoom-in-95">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                <RotateCcw className="w-5 h-5 text-rose-600" />
                {editingId ? "Edit Vendor Debit Note (DN)" : "Generate Vendor Debit Note (DN)"}
              </h3>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setEditingId(null);
                }}
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
                  <option value="">Select a Purchase Invoice (or leave blank for direct debit)</option>
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
                    DN Document ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={dnNo}
                    onChange={(e) => setDnNo(e.target.value)}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-xs text-muted-foreground uppercase">
                    Debit Value ({currency.symbol}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm font-bold text-rose-600 focus:ring-1 focus:ring-primary focus:outline-none"
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
                  <option value="Purchase Return / Defective Goods">Purchase Return / Defective Goods</option>
                  <option value="Rate / Price Discrepancy">Rate / Price Discrepancy</option>
                  <option value="Shortage in Delivery / Damaged Goods">Shortage in Delivery / Damaged Goods</option>
                  <option value="Excess Billed on Invoice">Excess Billed on Invoice</option>
                  <option value="Volume Rebate / Cash Discount Claim">Volume Rebate / Cash Discount Claim</option>
                  <option value="Other Debit Adjustment">Other Debit Adjustment</option>
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
                  placeholder="e.g. Return of 10 defective units against batch #B-2026..."
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
                  ) : editingId ? (
                    "Update Debit Note"
                  ) : (
                    "Save & Issue Debit Note"
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
                  <FileCheck className="size-5 text-rose-600" />
                  Vendor Debit Note Details
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
                  <span className="text-xs text-muted-foreground font-semibold uppercase">Debit Amount</span>
                  <div className="font-bold text-xl text-rose-600 font-mono mt-0.5">
                    {currency.symbol}{viewingVoucher.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-muted-foreground">Linked Purchase Invoice:</span>
                  <div className="font-mono font-semibold text-primary mt-0.5">
                    {viewingVoucher.bill_number || viewingVoucher.reference_number || "Direct Debit"}
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
