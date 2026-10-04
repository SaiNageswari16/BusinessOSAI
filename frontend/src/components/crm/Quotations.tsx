import { toast } from "sonner";
import React, { useState, useEffect, useMemo } from "react";
import { useI18n } from "@/contexts/i18n-context";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  FileCheck,
  FileText,
  Building,
  PhoneCall,
  Printer,
  Edit,
  MessageCircle,
  Mail,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  TrendingUp,
  Ban,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { crmQuotationsApi } from "@/lib/api-client";
import { useTenant } from "@/contexts/tenant-context";
import { getActiveBillingGst } from "@/lib/receipt-template-store";
import { useCurrency } from "@/hooks/use-currency";
import { AiCallingModal } from "./AiCallingModal";
import { PosSalesInvoice } from "@/components/pos/PosSalesInvoice";
import { FullInvoicePrinter, type FullInvoiceData } from "@/components/pos/FullInvoicePrinter";
import { extractGstState } from "@/lib/gst-utils";
import { formatDisplayDate } from "@/lib/utils";

export type QuotationStatusCategory = "all" | "open" | "closed_converted" | "closed_rejected" | "closed_expired";

export function normalizeStatusCategory(status?: string): "open" | "closed_converted" | "closed_rejected" | "closed_expired" {
  const s = (status || "").toLowerCase().trim();
  if (
    s.includes("converted") ||
    s.includes("accepted") ||
    s.includes("approved") ||
    s.includes("won") ||
    s.includes("invoiced")
  ) {
    return "closed_converted";
  }
  if (
    s.includes("not interested") ||
    s.includes("rejected") ||
    s.includes("lost") ||
    s.includes("declined") ||
    s.includes("cancelled")
  ) {
    return "closed_rejected";
  }
  if (s.includes("expired") || s.includes("lapsed")) {
    return "closed_expired";
  }
  return "open";
}

export function Quotations() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<QuotationStatusCategory>("all");
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formDocType, setFormDocType] = useState<"QUOTATION" | "TAX_INVOICE">("QUOTATION");
  const [editingQuote, setEditingQuote] = useState<any | null>(null);
  const [callingQuote, setCallingQuote] = useState<any | null>(null);
  const [selectedQuoteForPrint, setSelectedQuoteForPrint] = useState<FullInvoiceData | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const res = await crmQuotationsApi.list().catch(() => []);
      const apiItems: any[] = Array.isArray(res) ? res : (res as any)?.items || [];

      // Check local storage for any recently created POS quotations and invoices
      const currentTenantId = (tenant as any)?.raw?.tenant_id || (tenant as any)?.tenant_id || tenant?.id || "default";
      const currentCompanyId = tenant?.id || (tenant as any)?.raw?.id || (tenant as any)?.company_id || "default";
      const localKey = `pos_saved_invoices_${currentTenantId}_${currentCompanyId}`;
      let localItems: any[] = [];
      const conversionMap = new Map<string, { invoiceNumber: string; convertedAt: string }>();

      // 1. Read conversion map from dedicated local storage
      try {
        const convKeys = [`pos_quote_conversions_${currentTenantId}`, "pos_quote_conversions"];
        convKeys.forEach((ck) => {
          const rawConv = localStorage.getItem(ck);
          if (rawConv) {
            const parsed = JSON.parse(rawConv);
            Object.entries(parsed).forEach(([qKey, val]: [string, any]) => {
              if (qKey && val?.invoiceNumber) {
                conversionMap.set(qKey.trim().toLowerCase(), {
                  invoiceNumber: val.invoiceNumber,
                  convertedAt: val.convertedAt || new Date().toISOString(),
                });
              }
            });
          }
        });
      } catch (e) {}

      // 2. Read saved POS invoices across all keys and map quotation conversions
      try {
        const allKeys = Object.keys(localStorage).filter(k => k.startsWith("pos_saved_invoices_"));
        if (!allKeys.includes(localKey)) allKeys.push(localKey);

        allKeys.forEach((k) => {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              parsed.forEach((i: any) => {
                const isQuote = i.invoice_type === "QUOTATION" || (i.invoice_number && String(i.invoice_number).startsWith("QT-")) || i.quote_number;
                if (isQuote) {
                  localItems.push({
                    id: i.id,
                    quote_number: i.invoice_number || i.quote_number,
                    customer_name: i.customer_name,
                    customer_phone: i.customer_phone,
                    total: i.grand_total || i.total,
                    status: i.status || i.payment_status || "Open (Pending)",
                    converted_invoice_number: i.converted_invoice_number,
                    converted_at: i.converted_at,
                    created_at: i.invoice_date || i.created_at || new Date().toISOString(),
                    items: i.items,
                  });
                } else {
                  // Tax Invoice: check if it converted a quote
                  const po = String(i.po_number || "");
                  const notes = String(i.notes || "");
                  const origRef = String(i.original_invoice_ref || "");
                  const qNum = String(i.quotation_number || "");

                  [po, notes, origRef, qNum].forEach((str) => {
                    const match = str.match(/QT-[\w-]+/i);
                    if (match) {
                      const matchedQuote = match[0].toLowerCase();
                      conversionMap.set(matchedQuote, {
                        invoiceNumber: i.invoice_number,
                        convertedAt: i.created_at || i.invoice_date || new Date().toISOString(),
                      });
                    }
                  });
                }
              });
            }
          }
        });
      } catch (e) {
        console.warn("Local storage parse error:", e);
      }

      // Merge and deduplicate strictly by quote_number (or id)
      const map = new Map<string, any>();
      apiItems.forEach((it) => {
        const numKey = (it.quote_number || "").trim().toLowerCase();
        const idKey = (it.id || "").trim();
        const primaryKey = numKey || idKey;
        if (primaryKey) {
          map.set(primaryKey, it);
          if (numKey && idKey) {
            map.set(idKey, it);
          }
        }
      });

      localItems.forEach((it) => {
        const numKey = (it.quote_number || "").trim().toLowerCase();
        const idKey = (it.id || "").trim();
        const match = (numKey && map.get(numKey)) || (idKey && map.get(idKey));

        if (!match) {
          const primaryKey = numKey || idKey;
          if (primaryKey) map.set(primaryKey, it);
        } else {
          // Merge local conversion info if present without creating duplicate
          const merged = {
            ...match,
            ...it,
            id: match.id || it.id, // prefer backend UUID
            quote_number: match.quote_number || it.quote_number,
            status: it.status || match.status,
            converted_invoice_number: it.converted_invoice_number || match.converted_invoice_number,
          };
          if (numKey) map.set(numKey, merged);
          if (idKey) map.set(idKey, merged);
        }
      });

      // Deduplicate unique list by id or quote_number and apply conversion map
      const uniqueQuotes = new Map<string, any>();
      Array.from(map.values()).forEach((q) => {
        const numKey = (q.quote_number || "").trim().toLowerCase();
        const uniqueKey = numKey || (q.id || "").trim().toLowerCase();

        if (uniqueKey && !uniqueQuotes.has(uniqueKey)) {
          const quoteObj = { ...q };
          const convInfo = (numKey && conversionMap.get(numKey)) || (q.id && conversionMap.get(String(q.id).toLowerCase()));

          if (convInfo || quoteObj.converted_invoice_number) {
            quoteObj.status = "Closed (Converted)";
            quoteObj.converted_invoice_number = quoteObj.converted_invoice_number || convInfo?.invoiceNumber;
            quoteObj.converted_at = quoteObj.converted_at || convInfo?.convertedAt;
          }

          uniqueQuotes.set(uniqueKey, quoteObj);
        }
      });

      setQuotations(Array.from(uniqueQuotes.values()));
    } catch (err) {
      console.error("Failed to fetch quotations:", err);
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchQuotations();
    const handleTenantChange = () => {
      void fetchQuotations();
    };
    window.addEventListener("bos-tenant-changed", handleTenantChange);
    window.addEventListener("pos_invoices_updated", handleTenantChange);
    window.addEventListener("crm_quotations_updated", handleTenantChange);
    window.addEventListener("storage", handleTenantChange);
    return () => {
      window.removeEventListener("bos-tenant-changed", handleTenantChange);
      window.removeEventListener("pos_invoices_updated", handleTenantChange);
      window.removeEventListener("crm_quotations_updated", handleTenantChange);
      window.removeEventListener("storage", handleTenantChange);
    };
  }, [tenant?.id, (tenant as any)?.raw?.tenant_id]);

  const handleUpdateQuoteStatus = async (quote: any, newStatus: string) => {
    try {
      // 1. Update state in memory
      setQuotations((prev) =>
        prev.map((q) => {
          if (q.id === quote.id || q.quote_number === quote.quote_number) {
            return { ...q, status: newStatus };
          }
          return q;
        })
      );

      // 2. Update backend if id is valid uuid
      if (quote.id) {
        await crmQuotationsApi.update(quote.id, { status: newStatus }).catch(console.warn);
      }

      // 3. Update in local storage
      const currentTenantId = (tenant as any)?.raw?.tenant_id || (tenant as any)?.tenant_id || tenant?.id || "default";
      const currentCompanyId = tenant?.id || (tenant as any)?.raw?.id || (tenant as any)?.company_id || "default";
      const localKey = `pos_saved_invoices_${currentTenantId}_${currentCompanyId}`;
      try {
        const raw = localStorage.getItem(localKey);
        if (raw) {
          const list = JSON.parse(raw);
          const updated = list.map((item: any) => {
            if (item.id === quote.id || item.invoice_number === quote.quote_number || item.quote_number === quote.quote_number) {
              return {
                ...item,
                status: newStatus,
                payment_status: newStatus,
              };
            }
            return item;
          });
          localStorage.setItem(localKey, JSON.stringify(updated));
        }
      } catch (e) {
        console.warn("Error updating local storage quote status:", e);
      }

      toast.success(`Quotation #${quote.quote_number || quote.id} marked as "${newStatus}"`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update quotation status");
    }
  };

  // Status-based partitioning (Must be declared before any conditional returns)
  const openQuotes = useMemo(() => quotations.filter((q) => normalizeStatusCategory(q.status) === "open"), [quotations]);
  const convertedQuotes = useMemo(() => quotations.filter((q) => normalizeStatusCategory(q.status) === "closed_converted"), [quotations]);
  const rejectedQuotes = useMemo(() => quotations.filter((q) => normalizeStatusCategory(q.status) === "closed_rejected"), [quotations]);
  const expiredQuotes = useMemo(() => quotations.filter((q) => normalizeStatusCategory(q.status) === "closed_expired"), [quotations]);

  const totalValue = useMemo(() => quotations.reduce((sum, q) => sum + Number(q.total || 0), 0), [quotations]);
  const openTotal = useMemo(() => openQuotes.reduce((sum, q) => sum + Number(q.total || 0), 0), [openQuotes]);
  const convertedTotal = useMemo(() => convertedQuotes.reduce((sum, q) => sum + Number(q.total || 0), 0), [convertedQuotes]);
  const rejectedTotal = useMemo(() => rejectedQuotes.reduce((sum, q) => sum + Number(q.total || 0), 0), [rejectedQuotes]);

  // Tab & Search filtered list
  const filteredQuotes = useMemo(() => {
    return quotations.filter((q) => {
      const qNum = (q.quote_number || "").toLowerCase();
      const cName = ((q as any).customer_name || "").toLowerCase();
      const term = searchTerm.toLowerCase();
      const matchesSearch = !term || qNum.includes(term) || cName.includes(term);

      if (!matchesSearch) return false;

      if (activeTab === "all") return true;
      const cat = normalizeStatusCategory(q.status);
      return cat === activeTab;
    });
  }, [quotations, searchTerm, activeTab]);

  const handlePrintQuotation = (quote: any) => {
    const rawItems = (quote.items as any)?.items || (Array.isArray(quote.items) ? quote.items : []);
    
    // Extract default tenant billing info for fallback address & GST state
    const activeBillingGst = getActiveBillingGst(tenant?.id);
    const sellerState = extractGstState(activeBillingGst?.gstin || (tenant as any)?.settings?.gstin);

    // Build structured items for tax invoice / quotation preview
    const mappedItems = (rawItems.length > 0 ? rawItems : [
      {
        product_name: "Professional Services / Implementation",
        quantity: 1,
        unit_price: Number(quote.subtotal || quote.total || 0),
        tax_rate: 0,
      }
    ]).map((item: any) => {
      const qty = Number(item.quantity || item.qty || 1);
      const price = Number(item.price || item.unit_price || item.rate || 0);
      const rawTax = item.tax_rate !== undefined && item.tax_rate !== null ? item.tax_rate : (item.tax_percent !== undefined && item.tax_percent !== null ? item.tax_percent : (item.tax !== undefined && item.tax !== null ? item.tax : (item.gst !== undefined && item.gst !== null ? item.gst : 0)));
      const taxRate = Number(rawTax) || 0;
      const discountVal = Number(item.discount_value ?? item.discount_percent ?? item.discount ?? 0);
      const discountType = item.discount_type || (item.discount_percent !== undefined ? "percent" : "fixed");
      const gross = price * qty;
      const discountAmt = discountType === "percent" ? (gross * discountVal) / 100 : Math.min(discountVal, gross);
      const taxable = Math.max(0, gross - discountAmt);
      const taxAmt = (taxable * taxRate) / 100;
      
      return {
        product_id: item.product_id || item.id,
        product_name: item.name || item.product_name || item.title || "Item",
        sku: item.sku || item.product_code || "",
        hsn_code: item.hsn_code || item.hsn || item.hsn_sac || "9988",
        quantity: qty,
        unit: item.unit || item.uom || "Pcs",
        unit_price: price,
        mrp: item.mrp || price,
        discount_type: discountType,
        discount_value: discountVal,
        tax_rate: taxRate,
        subtotal: taxable + taxAmt,
        taxable_value: taxable,
        tax_amount: taxAmt,
        description: item.description || "",
      };
    });

    const isConverted = normalizeStatusCategory(quote.status) === "closed_converted";
    const custBilling = quote.billing_address || quote.customer_address || quote.customerBillingAddress || quote.address || "";
    const custShipping = quote.shipping_address || quote.customerShippingAddress || custBilling || "";

    const invData: FullInvoiceData = {
      id: quote.id,
      doc_type: "quotation",
      header_title: "TAX QUOTATION / ESTIMATE",
      invoice_number: quote.quote_number || quote.quotation_number || "QT-0001",
      invoice_date: quote.created_at || quote.date || new Date().toISOString(),
      due_date: quote.valid_until || quote.due_date,
      customerName: quote.customer_name || quote.customerName || quote.lead_name || "Valued Client",
      customerPhone: quote.customer_phone || quote.customerPhone || quote.phone || "",
      customerEmail: quote.customer_email || quote.customerEmail || quote.email || "",
      customerAddress: custBilling,
      customerBillingAddress: custBilling,
      customerShippingAddress: custShipping,
      customerGST: quote.customer_gst || quote.customerGST || quote.gstin || "",
      place_of_supply: quote.place_of_supply || (sellerState?.name ? `${sellerState.name} (${sellerState.code}) - Intra-State` : undefined),
      payment_terms: quote.payment_terms || "Due on Receipt / Net 15",
      payment_status: isConverted ? `CONVERTED (Inv: ${quote.converted_invoice_number || "Generated"})` : "QUOTATION VALID (30 Days)",
      items: mappedItems,
      subtotal: Number(quote.subtotal || quote.total || 0),
      discount_amount: Number(quote.discount || quote.discount_amount || 0),
      tax_amount: Number(quote.tax || quote.total_tax || 0),
      grand_total: Number(quote.total || quote.grand_total || 0),
      notes: quote.notes || quote.description || "",
      terms: quote.terms || "1. Goods once sold will not be taken back or exchanged.\n2. All disputes are subject to local jurisdiction only.\n3. Quotation prices are valid for 30 calendar days from the issue date.",
    };

    setSelectedQuoteForPrint(invData);
    setIsPrintModalOpen(true);
  };

  const handleSendWhatsAppRow = async (quote: any) => {
    try {
      toast.info(`Sending Quotation #${quote.quote_number} PDF via Tenant WhatsApp...`);
      const res = await crmQuotationsApi.sendQuotation(quote.id, {
        send_whatsapp: true,
        send_email: false,
      });
      const errs = res?.results?.errors || [];
      if (errs.length > 0) {
        toast.warning(`WhatsApp notice: ${errs.join(", ")}`);
      } else {
        toast.success(`Quotation PDF #${quote.quote_number} sent to customer via Tenant WhatsApp session!`);
        void fetchQuotations();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to dispatch WhatsApp message");
    }
  };

  const handleSendEmailRow = async (quote: any) => {
    try {
      toast.info(`Sending Quotation #${quote.quote_number} PDF via SMTP...`);
      const res = await crmQuotationsApi.sendQuotation(quote.id, {
        send_email: true,
        send_whatsapp: false,
      });
      const errs = res?.results?.errors || [];
      if (errs.length > 0) {
        toast.warning(`Email SMTP notice: ${errs.join(", ")}`);
      } else {
        toast.success(`Quotation PDF #${quote.quote_number} emailed to customer via SMTP!`);
        void fetchQuotations();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to dispatch email");
    }
  };

  if (isFormOpen) {
    return (
      <div className="space-y-4">
        <div
          className={`flex items-center justify-between px-4 py-2.5 rounded-2xl border ${
            formDocType === "TAX_INVOICE"
              ? "bg-emerald-50/80 border-emerald-200"
              : "bg-purple-50/80 border-purple-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`p-1 text-white rounded-lg font-bold text-xs ${
                formDocType === "TAX_INVOICE" ? "bg-emerald-600" : "bg-purple-600"
              }`}
            >
              {formDocType === "TAX_INVOICE" ? "INV" : "QT"}
            </span>
            <div>
              <h3
                className={`font-bold text-xs ${
                  formDocType === "TAX_INVOICE" ? "text-emerald-900" : "text-purple-900"
                }`}
              >
                {formDocType === "TAX_INVOICE"
                  ? `Convert Quotation #${editingQuote?.quote_number || editingQuote?.invoice_number || editingQuote?.id} to Tax Invoice`
                  : editingQuote
                  ? `Edit Sales Quotation #${editingQuote.quote_number || editingQuote.invoice_number || editingQuote.id}`
                  : "New Customer Sales Quotation / Estimate"}
              </h3>
              <p
                className={`text-[11px] ${
                  formDocType === "TAX_INVOICE" ? "text-emerald-700" : "text-purple-700"
                }`}
              >
                {formDocType === "TAX_INVOICE"
                  ? "Generate official GST Tax Invoice with automatic serial number and linked quotation reference (will mark quote as Closed)"
                  : "Issue itemized sales proposals, pricing estimates & commercial quotes"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsFormOpen(false);
              setEditingQuote(null);
              setFormDocType("QUOTATION");
              void fetchQuotations();
            }}
            className="px-3 py-1.5 bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            ← Back to Quotations List
          </button>
        </div>

        <PosSalesInvoice
          initialDocType={formDocType}
          editingInvoice={editingQuote}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingQuote(null);
            setFormDocType("QUOTATION");
            void fetchQuotations();
          }}
          onSaved={(savedDoc) => {
            setIsFormOpen(false);
            setEditingQuote(null);
            const isTaxInv = formDocType === "TAX_INVOICE" || savedDoc?.invoice_type === "TAX_INVOICE" || savedDoc?.invoice_type === "INVOICE";
            setFormDocType("QUOTATION");
            void fetchQuotations();
            if (isTaxInv) {
              navigate({ to: "/pos", search: { tab: "sales_history" } as any });
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>Quotations & Sales Proposals</span>
            <span className="text-[11px] font-medium bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
              {quotations.length} total
            </span>
          </h2>
          <p className="text-xs text-muted-foreground">{t("Create, track lifecycle, manage open vs closed conversions, and convert quotes to Tax Invoices.", "Create, track lifecycle, manage open vs closed conversions, and convert quotes to Tax Invoices.")}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingQuote(null);
              setFormDocType("QUOTATION");
              setIsFormOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 h-9 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Plus className="size-4" /> Create Quotation
          </button>
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Open Quotes */}
        <div className="glass-panel p-5 rounded-2xl border border-blue-200/70 bg-gradient-to-br from-blue-50/40 via-card to-sky-50/30 shadow-xs">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-blue-500 animate-pulse" />
                Open / Pending Quotes
              </p>
              <p className="text-[10px] text-muted-foreground">{t("Active in sales pipeline", "Active in sales pipeline")}</p>
            </div>
            <div className="px-2 py-0.5 rounded-lg text-xs font-black bg-blue-500/10 text-blue-600 border border-blue-200">
              {openQuotes.length}
            </div>
          </div>
          <h3 className="text-2xl font-black text-foreground mt-2">{currency.symbol}{openTotal.toLocaleString()}</h3>
        </div>

        {/* Closed - Converted */}
        <div className="glass-panel p-5 rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/40 via-card to-teal-50/30 shadow-xs">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                Closed (Converted)
              </p>
              <p className="text-[10px] text-muted-foreground">{t("Converted to Tax Invoices", "Converted to Tax Invoices")}</p>
            </div>
            <div className="px-2 py-0.5 rounded-lg text-xs font-black bg-emerald-500/10 text-emerald-600 border border-emerald-200">
              {convertedQuotes.length}
            </div>
          </div>
          <h3 className="text-2xl font-black text-emerald-600 mt-2">{currency.symbol}{convertedTotal.toLocaleString()}</h3>
        </div>

        {/* Closed - Not Interested */}
        <div className="glass-panel p-5 rounded-2xl border border-rose-200/70 bg-gradient-to-br from-rose-50/40 via-card to-pink-50/30 shadow-xs">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                <XCircle className="size-3.5 text-rose-500" />
                Closed (Not Interested)
              </p>
              <p className="text-[10px] text-muted-foreground">{t("Lost / customer declined", "Lost / customer declined")}</p>
            </div>
            <div className="px-2 py-0.5 rounded-lg text-xs font-black bg-rose-500/10 text-rose-600 border border-rose-200">
              {rejectedQuotes.length}
            </div>
          </div>
          <h3 className="text-2xl font-black text-rose-600 mt-2">{currency.symbol}{rejectedTotal.toLocaleString()}</h3>
        </div>

        {/* Total Pipeline Value */}
        <div className="glass-panel p-5 rounded-2xl border border-purple-200/70 bg-gradient-to-br from-purple-50/40 via-card to-indigo-50/30 shadow-xs">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-purple-600" />
                Total Pipeline Value
              </p>
              <p className="text-[10px] text-muted-foreground">{t("All generated proposals", "All generated proposals")}</p>
            </div>
            <div className="px-2 py-0.5 rounded-lg text-xs font-black bg-purple-500/10 text-purple-600 border border-purple-200">
              {quotations.length}
            </div>
          </div>
          <h3 className="text-2xl font-black text-purple-700 mt-2">{currency.symbol}{totalValue.toLocaleString()}</h3>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="space-y-3">
        {/* Status Lifecycle Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border">
          {[
            { id: "all", label: "All Quotes", count: quotations.length, icon: FileText, color: "text-slate-600" },
            { id: "open", label: "Open / Pending", count: openQuotes.length, icon: TrendingUp, color: "text-blue-600" },
            { id: "closed_converted", label: "Closed - Converted", count: convertedQuotes.length, icon: CheckCircle2, color: "text-emerald-600" },
            { id: "closed_rejected", label: "Closed - Not Interested", count: rejectedQuotes.length, icon: Ban, color: "text-rose-600" },
            { id: "closed_expired", label: "Closed - Expired", count: expiredQuotes.length, icon: Clock, color: "text-amber-600" },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as QuotationStatusCategory)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Icon className={`size-3.5 ${isActive ? "text-white dark:text-slate-900" : tab.color}`} />
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    isActive
                      ? "bg-white/20 text-white dark:bg-black/10 dark:text-black"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search quotations by quote number, customer name, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="text-xs text-muted-foreground hover:text-foreground underline px-2 cursor-pointer"
            >
              Clear Search
            </button>
          )}
        </div>
      </div>

      {/* Main Quotations Table */}
      <div className="glass-panel rounded-2xl border border-border/70 overflow-visible bg-card shadow-sm">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground space-y-2">
              <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-medium">Loading quotations list...</p>
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="size-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto border border-purple-200 shadow-2xs">
                <FileText className="size-6" />
              </div>
              <p className="text-sm font-bold text-foreground">
                {activeTab === "open"
                  ? "No Open Quotations Pending"
                  : activeTab === "closed_converted"
                  ? "No Converted Invoices Yet"
                  : activeTab === "closed_rejected"
                  ? "No Rejected Quotes"
                  : "No Quotations Found"}
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {searchTerm
                  ? `No quotations matched "${searchTerm}". Try a different search keyword.`
                  : "Create and issue sales quotes to customers, manage their open/closed conversion state, and convert directly into Tax Invoices."}
              </p>
              <button
                onClick={() => {
                  setEditingQuote(null);
                  setFormDocType("QUOTATION");
                  setIsFormOpen(true);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all inline-flex items-center gap-1.5"
              >
                <Plus className="size-3.5" /> + Create New Quotation
              </button>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/80 dark:bg-slate-900/50 border-b text-slate-600 dark:text-slate-400 text-[11px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Quote ID & Items</th>
                  <th className="px-6 py-3.5">Customer</th>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5 text-right">Amount</th>
                  <th className="px-6 py-3.5">Status / Conversion</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredQuotes.map((quote, i) => {
                  const category = normalizeStatusCategory(quote.status);
                  const isConverted = category === "closed_converted";
                  const isRejected = category === "closed_rejected";
                  const isExpired = category === "closed_expired";

                  return (
                    <motion.tr
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      key={quote.id || quote.quote_number || i}
                      className="hover:bg-muted/40 transition-colors group cursor-default"
                    >
                      {/* Quote Number & Item count */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <FileCheck className="size-4 text-purple-600 flex-shrink-0" />
                          <span className="font-mono font-bold text-foreground tracking-tight">
                            {quote.quote_number || quote.invoice_number}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 ml-6">
                          {quote.items?.items?.length || (Array.isArray(quote.items) ? quote.items.length : 0)} items itemized
                        </p>
                      </td>

                      {/* Customer */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 font-semibold text-foreground">
                          <Building className="size-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="truncate max-w-[180px]">
                            {quote.customer_name || "Enterprise Client"}
                          </span>
                        </div>
                        {quote.customer_phone && (
                          <p className="text-[11px] text-muted-foreground font-mono ml-5.5">
                            {quote.customer_phone}
                          </p>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-6 py-4 text-muted-foreground text-xs font-medium">
                        {quote.created_at ? formatDisplayDate(quote.created_at) : "-"}
                      </td>

                      {/* Total Amount & Discount */}
                      <td className="px-6 py-4 text-right">
                        <div className="font-black text-foreground text-sm">
                          {currency.symbol}{Number(quote.total || 0).toLocaleString()}
                        </div>
                        {Number(quote.discount || quote.discount_amount || 0) > 0 && (
                          <div className="text-[10px] text-emerald-600 font-bold">
                            Disc: -{currency.symbol}{Number(quote.discount || quote.discount_amount || 0).toLocaleString()}
                          </div>
                        )}
                      </td>

                      {/* Status / Conversion Column with Dropdown */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-start gap-1">
                          {/* Automatic Status Badge */}
                          <div
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border shadow-2xs ${
                              isConverted
                                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                : isRejected
                                ? "bg-rose-50 text-rose-700 border-rose-300"
                                : isExpired
                                ? "bg-amber-50 text-amber-700 border-amber-300"
                                : "bg-blue-50 text-blue-700 border-blue-300"
                            }`}
                          >
                            {isConverted ? (
                              <CheckCircle2 className="size-3.5 text-emerald-600" />
                            ) : isRejected ? (
                              <XCircle className="size-3.5 text-rose-600" />
                            ) : isExpired ? (
                              <Clock className="size-3.5 text-amber-600" />
                            ) : (
                              <span className="size-2 rounded-full bg-blue-500 animate-pulse" />
                            )}
                            <span>
                              {isConverted
                                ? "Closed (Converted)"
                                : isRejected
                                ? "Closed (Not Interested)"
                                : isExpired
                                ? "Closed (Expired)"
                                : quote.status || "Open (Active)"}
                            </span>
                          </div>

                          {/* Converted Invoice Reference Badge */}
                          {quote.converted_invoice_number && (
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-700 font-bold bg-emerald-100/80 px-1.5 py-0.5 rounded border border-emerald-200">
                              <span>Tax Inv:</span>
                              <strong>#{quote.converted_invoice_number}</strong>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Convert to Tax Invoice Button */}
                          {isConverted ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingQuote(quote);
                                setFormDocType("TAX_INVOICE");
                                setIsFormOpen(true);
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                              title="Quotation has been converted to an official Tax Invoice (Click to view/re-issue)"
                            >
                              <CheckCircle2 className="size-3.5 text-emerald-600" />
                              <span className="hidden sm:inline">Converted</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingQuote(quote);
                                setFormDocType("TAX_INVOICE");
                                setIsFormOpen(true);
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-lg shadow-sm transition-all cursor-pointer"
                              title="Convert this Quotation into an Official Tax Invoice with auto serial number"
                            >
                              <FileCheck className="size-3.5" />
                              <span className="hidden sm:inline">Convert to Invoice</span>
                            </button>
                          )}

                          {/* Quick Message Actions */}
                          <button
                            type="button"
                            onClick={() => handleSendWhatsAppRow(quote)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Send Quotation PDF via Tenant WhatsApp"
                          >
                            <MessageCircle className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendEmailRow(quote)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Send Quotation PDF via SMTP Email"
                          >
                            <Mail className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => window.open(crmQuotationsApi.getPdfUrl(quote.id), "_blank")}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Download Server-Generated PDF"
                          >
                            <Download className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrintQuotation(quote)}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Print Quotation PDF"
                          >
                            <Printer className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCallingQuote(quote)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Start AI Follow-up Call"
                          >
                            <PhoneCall className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingQuote(quote);
                              setFormDocType("QUOTATION");
                              setIsFormOpen(true);
                            }}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit Quotation"
                          >
                            <Edit className="size-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Universal AI Calling Modal */}
      {callingQuote && (
        <AiCallingModal
          open={!!callingQuote}
          onClose={() => setCallingQuote(null)}
          targetType="quotation"
          targetId={callingQuote.id}
          contactName={(callingQuote as any).customer_name || `Quote ${callingQuote.quote_number}`}
          contactPhone={(callingQuote as any).contact_phone || undefined}
          contactEmail={(callingQuote as any).contact_email || undefined}
          dealValue={callingQuote.total}
          defaultNotes={`Quotation: ${callingQuote.quote_number}, Status: ${callingQuote.status}, Total Amount: ${callingQuote.total}`}
          onCallCompleted={async () => {
            await fetchQuotations();
          }}
        />
      )}

      {/* Unified A4 Quotation / Tax Invoice Preview & Print Modal */}
      <FullInvoicePrinter
        invoice={selectedQuoteForPrint}
        isOpen={isPrintModalOpen}
        onClose={() => {
          setIsPrintModalOpen(false);
          setSelectedQuoteForPrint(null);
        }}
      />
    </div>
  );
}
