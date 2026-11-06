import React, { useState, useEffect } from "react";
import { useI18n } from "@/contexts/i18n-context";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  FileCheck,
  Printer,
  MessageCircle,
  Download,
  Calendar,
  User,
  ArrowRightLeft,
  DollarSign,
  TrendingDown,
  FileText,
  Clock,
  CheckCircle,
  RefreshCw,
  Pencil,
  Trash2,
} from "lucide-react";
import { invoicesApi } from "@/lib/api-client";
import { useTenant } from "@/contexts/tenant-context";
import { useCurrency } from "@/hooks/use-currency";
import { getActiveBillingGst } from "@/lib/receipt-template-store";
import { renderNoteDocument, resolveNotePrintTemplate } from "@/lib/note-document-renderer";
import { printHtmlInPage } from "@/lib/print-helper";
import { PosSalesInvoice } from "./PosSalesInvoice";
import { PaginationControl } from "@/components/ui/PaginationControl";

export interface PosDocumentRecord {
  id: string;
  invoice_number?: string;
  invoice_type?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_gstin?: string;
  billing_address?: string;
  shipping_address?: string;
  reference_number?: string;
  original_invoice_ref?: string;
  order_number?: string;
  note_reason?: string;
  invoice_date?: string;
  due_date?: string;
  payment_terms?: string;
  payment_status?: string;
  payment_method?: string;
  subtotal?: number;
  total?: number;
  total_amount?: number;
  grand_total?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  notes?: string;
  lines?: any[];
  items?: any[];
}

export function PosCreditNotes() {
  const { t } = useI18n();
  const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();
  const [searchTerm, setSearchTerm] = useState("");
  const [creditNotes, setCreditNotes] = useState<PosDocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [editingNote, setEditingNote] = useState<PosDocumentRecord | null>(null);
  const [sendingWhatsappId, setSendingWhatsappId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const fetchCreditNotes = async () => {
    setLoading(true);
    try {
      // Fetch both from backend API and local storage
      const res = await invoicesApi.listInvoices({ invoice_type: "credit_note", page_size: 150 }).catch(() => null);
      const apiItems: any[] = Array.isArray(res) ? res : (res as any)?.items || [];

      // Check local storage for any recently created POS credit notes
      const currentTenantId = (tenant as any)?.raw?.tenant_id || (tenant as any)?.tenant_id || tenant?.id || "default";
      const currentCompanyId = tenant?.id || (tenant as any)?.raw?.id || (tenant as any)?.company_id || "default";
      const localKey = `pos_saved_invoices_${currentTenantId}_${currentCompanyId}`;
      let localItems: any[] = [];
      try {
        const raw = localStorage.getItem(localKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          localItems = parsed.filter((i: any) => i.invoice_type === "CREDIT_NOTE" || i.invoice_type === "credit_note" || (i.invoice_number && i.invoice_number.startsWith("CN-")));
        }
      } catch (e) {
        console.warn("Local storage parse error:", e);
      }

      // Merge and deduplicate
      const map = new Map<string, any>();
      apiItems.forEach((it) => map.set(it.id || it.invoice_number, it));
      localItems.forEach((it) => {
        const key = it.id || it.invoice_number;
        if (!map.has(key)) map.set(key, it);
      });

      setCreditNotes(Array.from(map.values()));
    } catch (err) {
      console.error("Failed to load credit notes:", err);
      toast.error("Failed to load credit notes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCreditNotes();
  }, [tenant?.id]);

  const handlePrintCreditNote = (note: PosDocumentRecord | any) => {
    const activeBillingGst = getActiveBillingGst(tenant?.id);
    const orgName = activeBillingGst?.trade_name || activeBillingGst?.legal_name || tenant?.name || "BusinessOS AI";
    const orgLogo = activeBillingGst?.logo_url || tenant?.logo_url || (tenant as any)?.raw?.logo_url || "";
    const orgAddress = activeBillingGst?.address || (tenant as any)?.settings?.address || "Store Main Branch";
    const orgPhone = activeBillingGst?.phone || (tenant as any)?.settings?.phone || "+91 98493 44919";
    const orgEmail = activeBillingGst?.email || (tenant as any)?.settings?.email || "billing@businessos.ai";
    const orgGstin = activeBillingGst?.gstin || (tenant as any)?.settings?.gstin || (tenant as any)?.tax_id || "";

    // Honor the user's selected "credit_note" print template (if any) via the
    // shared note-document-renderer; otherwise fall back to the clean default
    // layout built from the active billing GST branding. No crash either way.
    const template = resolveNotePrintTemplate("credit_note", tenant?.id);

    const lines: Array<Record<string, any>> = note.lines || note.items || [];
    const total = Number(note.total || note.total_amount || 0);
    const cgst = Number(note.cgst_amount || 0);
    const sgst = Number(note.sgst_amount || 0);
    const igst = Number(note.igst_amount || 0);
    const subtotal = Number(note.subtotal || total - (cgst + sgst + igst));
    const reasonForNote = note.order_number || (note as any).note_reason || "Sales Return / Rebate";
    const originalRef = note.reference_number || (note as any).original_invoice_ref || "Direct Credit";
    const remarks = note.notes ? `${t("Remarks / Reason", "Remarks / Reason")}: ${note.notes}` : "";

    const html = renderNoteDocument(
      "credit_note",
      {
        note_number: note.invoice_number || note.id,
        amount: total,
        party: note.customer_name || "Valued Customer",
        party_phone: note.customer_phone,
        party_gstin: note.customer_gstin,
        party_address: note.billing_address,
        reference_no: originalRef,
        reference_label: "Original Invoice Ref",
        reason_for_note: reasonForNote,
        reason: remarks || undefined,
        date_iso: note.invoice_date,
        lines: lines.length > 0 ? lines : undefined,
        subtotal: subtotal > 0 ? subtotal : undefined,
        tax: { cgst, sgst, igst },
      },
      {
        name: orgName,
        gstin: orgGstin,
        address: orgAddress,
        phone: orgPhone,
        email: orgEmail,
        logo_url: orgLogo || null,
        upi_vpa: activeBillingGst?.upi_vpa || null,
        bank_name: activeBillingGst?.bank_name || null,
        bank_account_number: activeBillingGst?.bank_account_number || null,
        bank_ifsc: activeBillingGst?.bank_ifsc || null,
        signature_url: activeBillingGst?.signature_url || null,
        terms_and_conditions: activeBillingGst?.terms_and_conditions || null,
        currency_symbol: currency.symbol,
      },
      template,
      {
        texts: {
          partyTitle: t("Issued To (Customer)", "Issued To (Customer)"),
        },
      }
    );

    printHtmlInPage(html, 300);
  };

  const handleSendWhatsApp = async (note: PosDocumentRecord | any) => {
    const phone = note.customer_phone || "";
    if (!phone) {
      toast.error("Customer has no phone number on record.");
      return;
    }

    setSendingWhatsappId(note.id);
    try {
      const res = await invoicesApi.sendInvoiceToWhatsApp(note.id, phone);
      if (res.success) {
        toast.success(`Credit Note sent to ${phone} via WhatsApp!`);
      } else {
        toast.error(res.error || "Failed to send Credit Note via WhatsApp.");
      }
    } catch (e: any) {
      toast.error(e?.message || "WhatsApp gateway error.");
    } finally {
      setSendingWhatsappId(null);
    }
  };

  // Filtered notes
  const filtered = creditNotes.filter((n) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      (n.invoice_number || "").toLowerCase().includes(q) ||
      (n.customer_name || "").toLowerCase().includes(q) ||
      (n.customer_phone || "").toLowerCase().includes(q) ||
      (n.reference_number || "").toLowerCase().includes(q) ||
      (n.notes || "").toLowerCase().includes(q);

    return matchesSearch;
  });

  const totalCreditAmount = creditNotes.reduce((sum, n) => sum + Number(n.total || n.total_amount || 0), 0);

  const handleDeleteCreditNote = async (note: PosDocumentRecord) => {
    const label = note.invoice_number || note.id;
    if (!window.confirm(`Delete Credit Note ${label}?`)) return;
    try {
      if (note.id && !String(note.id).startsWith("local-")) {
        await invoicesApi.deleteInvoice(note.id).catch(() => null);
      }
      const currentTenantId = (tenant as any)?.raw?.tenant_id || (tenant as any)?.tenant_id || tenant?.id || "default";
      const currentCompanyId = tenant?.id || (tenant as any)?.raw?.id || (tenant as any)?.company_id || "default";
      const localKey = `pos_saved_invoices_${currentTenantId}_${currentCompanyId}`;
      try {
        const raw = localStorage.getItem(localKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          const updated = parsed.filter(
            (i: any) => i.id !== note.id && i.invoice_number !== note.invoice_number
          );
          localStorage.setItem(localKey, JSON.stringify(updated));
        }
      } catch (e) {}
      setCreditNotes((prev) =>
        prev.filter((i) => i.id !== note.id && i.invoice_number !== note.invoice_number)
      );
      toast.success(`Credit Note ${label} deleted.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete Credit Note.");
    }
  };

  if (isCreatingNote || editingNote) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between bg-rose-50/80 border border-rose-200 px-4 py-2.5 rounded-2xl">
          <div className="flex items-center gap-2">
            <span className="p-1 bg-rose-600 text-white rounded-lg font-bold text-xs">CN</span>
            <div>
              <h3 className="font-bold text-xs text-rose-900">
                {editingNote
                  ? `Edit Customer Credit Note (${editingNote.invoice_number || editingNote.id})`
                  : t("New Customer Credit Note (Sales Return / Rebate)", "New Customer Credit Note (Sales Return / Rebate)")}
              </h3>
              <p className="text-[11px] text-rose-700">Issue store credit or return adjustment for customer against sales invoice</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsCreatingNote(false);
              setEditingNote(null);
              void fetchCreditNotes();
            }}
            className="px-3 py-1.5 bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            ← Back to Credit Notes List
          </button>
        </div>

        <PosSalesInvoice
          initialDocType="CREDIT_NOTE"
          editingInvoice={editingNote || undefined}
          onBack={() => {
            setIsCreatingNote(false);
            setEditingNote(null);
            void fetchCreditNotes();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-1">
      {/* Header & Metric Cards */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
              <FileCheck className="size-4" />
            </span>
            Credit Notes (Sales Returns & Rebates)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage customer credit notes, return goods adjustments, and GST Sec 34 credit memos
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchCreditNotes()}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            title="Refresh List"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin text-rose-600" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsCreatingNote(true)}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="size-4" /> + Create Credit Note
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Total Notes Issued</p>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5">{creditNotes.length}</h3>
          </div>
          <div className="size-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <FileText className="size-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Total Credit Value</p>
            <h3 className="text-xl font-bold text-rose-600 mt-0.5">{currency.symbol}{totalCreditAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          </div>
          <div className="size-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <TrendingDown className="size-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase">GST Status</p>
            <h3 className="text-sm font-bold text-emerald-600 mt-1 flex items-center gap-1">
              <CheckCircle className="size-3.5" /> Sec 34 GST Compliant
            </h3>
          </div>
          <div className="size-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle className="size-4" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="size-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Credit Note #, Customer Name, Phone, Original Inv Ref..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-rose-500"
          />
        </div>
      </div>

      {/* Credit Notes Table List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading credit notes...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="size-10 rounded-full bg-rose-50 text-rose-500 mx-auto flex items-center justify-center">
              <FileCheck className="size-5" />
            </div>
            <p className="text-xs font-semibold text-slate-700">No Credit Notes Found</p>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              Issue a credit note when a customer returns goods or when you provide a post-sale rebate.
            </p>
            <button
              type="button"
              onClick={() => setIsCreatingNote(true)}
              className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors cursor-pointer"
            >
              <Plus className="size-3.5" /> + Create First Credit Note
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase">
                <tr>
                  <th className="px-4 py-3">Note Number</th>
                  <th className="px-4 py-3">Issue Date</th>
                  <th className="px-4 py-3">Customer Party</th>
                  <th className="px-4 py-3">Original Invoice Ref</th>
                  <th className="px-4 py-3">Reason for Note</th>
                  <th className="px-4 py-3 text-right">Credit Amount</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((note) => {
                  const total = Number(note.total || note.total_amount || 0);
                  return (
                    <tr key={note.id || note.invoice_number} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-rose-600">
                        {note.invoice_number || note.id}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {note.invoice_date || new Date().toISOString().slice(0, 10)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-800">{note.customer_name || "Walk-in Customer"}</div>
                        {note.customer_phone && (
                          <div className="text-[11px] text-slate-400">{note.customer_phone}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">
                        {note.reference_number || (note as any).original_invoice_ref ? (
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-bold text-slate-700">
                            #{note.reference_number || (note as any).original_invoice_ref}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Direct Adjustment</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          {note.order_number || (note as any).note_reason || "Sales Return"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-rose-600 text-sm">
                        {currency.symbol}{total.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingNote(note)}
                            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors cursor-pointer"
                            title="Edit Credit Note"
                          >
                            <Pencil className="size-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handlePrintCreditNote(note)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                            title="Print GST Credit Note"
                          >
                            <Printer className="size-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleSendWhatsApp(note)}
                            disabled={sendingWhatsappId === note.id}
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors cursor-pointer disabled:opacity-50"
                            title="Send via WhatsApp"
                          >
                            <MessageCircle className="size-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleDeleteCreditNote(note)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                            title="Delete Credit Note"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <PaginationControl
              currentPage={currentPage}
              totalPages={Math.max(1, Math.ceil(filtered.length / pageSize))}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              itemLabel="credit notes"
            />
          </div>
        )}
      </div>
    </div>
  );
}
