import { toast } from "sonner";
import React, { useState, useEffect, useMemo } from "react";
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
  const [openStatusDropdownId, setOpenStatusDropdownId] = useState<string | null>(null);

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const res = await crmQuotationsApi.list().catch(() => []);
      const apiItems: any[] = Array.isArray(res) ? res : (res as any)?.items || [];

      // Check local storage for any recently created POS quotations
      const currentTenantId = (tenant as any)?.raw?.tenant_id || (tenant as any)?.tenant_id || tenant?.id || "default";
      const currentCompanyId = tenant?.id || (tenant as any)?.raw?.id || (tenant as any)?.company_id || "default";
      const localKey = `pos_saved_invoices_${currentTenantId}_${currentCompanyId}`;
      let localItems: any[] = [];
      try {
        const raw = localStorage.getItem(localKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          localItems = parsed
            .filter((i: any) => i.invoice_type === "QUOTATION" || (i.invoice_number && i.invoice_number.startsWith("QT-")) || i.quote_number)
            .map((i: any) => ({
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
            }));
        }
      } catch (e) {
        console.warn("Local storage parse error:", e);
      }

      // Merge and deduplicate
      const map = new Map<string, any>();
      apiItems.forEach((it) => map.set(it.id || it.quote_number, it));
      localItems.forEach((it) => {
        const key = it.id || it.quote_number;
        if (!map.has(key)) {
          map.set(key, it);
        } else {
          // Merge local conversion info if present
          const existing = map.get(key);
          map.set(key, {
            ...existing,
            ...it,
            status: it.status || existing.status,
            converted_invoice_number: it.converted_invoice_number || existing.converted_invoice_number,
          });
        }
      });

      setQuotations(Array.from(map.values()));
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
    return () => {
      window.removeEventListener("bos-tenant-changed", handleTenantChange);
      window.removeEventListener("pos_invoices_updated", handleTenantChange);
    };
  }, [tenant?.id, (tenant as any)?.raw?.tenant_id]);

  const handleUpdateQuoteStatus = async (quote: any, newStatus: string) => {
    setOpenStatusDropdownId(null);
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
    const printWin = window.open("", "_blank", "width=850,height=1100");
    if (!printWin) {
      toast.error("Please allow popups to preview and print the Quotation.");
      return;
    }

    const activeBillingGst = getActiveBillingGst(tenant?.id);
    const orgName = activeBillingGst?.trade_name || activeBillingGst?.legal_name || tenant?.name || "BusinessOS AI Global";
    const orgLogo = activeBillingGst?.logo_url || tenant?.logo_url || (tenant as any)?.raw?.logo_url || "";
    const orgAddress = activeBillingGst?.address || (tenant as any)?.settings?.address || "Registered Corporate Office";
    const orgPhone = activeBillingGst?.phone || (tenant as any)?.settings?.phone || "+91 98493 44919";
    const orgEmail = activeBillingGst?.email || (tenant as any)?.settings?.email || "sales@businessos.ai";
    const orgGstin = activeBillingGst?.gstin || (tenant as any)?.settings?.gstin || (tenant as any)?.settings?.tax_id || "";
    const googleReviewUrl = activeBillingGst?.google_review_url || (tenant as any)?.raw?.google_review_url || null;
    const showReviewQR = activeBillingGst?.google_review_enabled !== false && Boolean(googleReviewUrl);

    const items = (quote.items as any)?.items || (Array.isArray(quote.items) ? quote.items : []);
    const subtotal = Number(quote.total || 0);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Quotation - ${quote.quote_number} - ${orgName}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm 15mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            body { background: #ffffff; color: #0f172a; padding: 16px; font-size: 9.5pt; line-height: 1.5; }
            .container { max-width: 740px; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2563eb; padding-bottom: 14px; margin-bottom: 20px; }
            .org-box { display: flex; align-items: center; gap: 12px; }
            .org-box h1 { font-size: 16pt; font-weight: 900; color: #0f172a; }
            .org-box p { font-size: 8.5pt; color: #64748b; }
            .quote-badge { text-align: right; }
            .quote-tag { display: inline-block; background: #2563eb; color: #ffffff; font-size: 8pt; font-weight: 800; padding: 4px 12px; border-radius: 6px; text-transform: uppercase; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f8fafc; padding: 12px 16px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; font-size: 8.5pt; }
            .info-grid h4 { font-size: 8pt; text-transform: uppercase; color: #94a3b8; font-weight: 800; margin-bottom: 4px; }
            .info-grid p { font-size: 9pt; font-weight: 600; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 9pt; }
            th { background: #f1f5f9; padding: 8px 12px; border: 1px solid #cbd5e1; text-align: left; font-weight: 800; color: #1e293b; }
            td { padding: 8px 12px; border: 1px solid #e2e8f0; }
            .total-box { display: flex; justify-content: flex-end; margin-bottom: 24px; }
            .total-card { width: 260px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; }
            .total-row { display: flex; justify-content: space-between; font-size: 9pt; font-weight: 600; margin-bottom: 6px; }
            .grand-total { border-top: 1.5px solid #0f172a; padding-top: 6px; margin-top: 6px; font-size: 11pt; font-weight: 900; color: #2563eb; }
            .terms { background: #f8fafc; border-left: 3px solid #2563eb; padding: 10px 14px; font-size: 8pt; color: #475569; margin-bottom: 20px; }
            .review-box { display: flex; align-items: center; gap: 14px; padding: 12px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; margin-bottom: 20px; }
            .footer { text-align: center; font-size: 7.5pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="org-box">
                ${orgLogo ? `<img src="${orgLogo}" alt="${orgName}" style="max-height: 48px; max-width: 140px; object-fit: contain;" />` : `<div style="width: 42px; height: 42px; border-radius: 8px; background: #2563eb; color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 13pt;">${orgName.slice(0, 2).toUpperCase()}</div>`}
                <div>
                  <h1>${orgName}</h1>
                  <p>${orgAddress}</p>
                  <p>Ph: ${orgPhone} • Email: ${orgEmail}${orgGstin ? ` • GSTIN: ${orgGstin}` : ""}</p>
                </div>
              </div>
              <div class="quote-badge">
                <span class="quote-tag">Official Quotation</span>
                <p style="font-size: 8.5pt; font-weight: bold; margin-top: 4px; color: #0f172a;">Quote #: ${quote.quote_number}</p>
                <p style="font-size: 7.5pt; color: #64748b;">Date: ${new Date(quote.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            <div class="info-grid">
              <div>
                <h4>Prepared For (Customer)</h4>
                <p>${(quote as any).customer_name || "Valued Client"}</p>
                <p style="font-size: 8pt; color: #64748b; font-weight: normal;">Status: <strong>${quote.status}</strong></p>
              </div>
              <div>
                <h4>Commercial Details</h4>
                <p>Validity: 30 Days from Issue</p>
                <p style="font-size: 8pt; color: #64748b; font-weight: normal;">Payment Terms: Immediate / Net 15</p>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 40px; text-align: center;">#</th>
                  <th>Item & Description</th>
                  <th style="text-align: center; width: 80px;">Qty</th>
                  <th style="text-align: right; width: 110px;">Unit Price</th>
                  <th style="text-align: right; width: 120px;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${items.length > 0 ? items.map((item: any, idx: number) => `
                  <tr>
                    <td style="text-align: center; font-weight: bold; color: #64748b;">${idx + 1}</td>
                    <td>
                      <div style="font-weight: 600; color: #0f172a;">${item.name || item.product_name || "Professional Services / Product"}</div>
                      ${item.sku ? `<div style="font-size: 7.5pt; color: #94a3b8; font-family: monospace;">SKU: ${item.sku}${item.hsn_code ? ` • HSN: ${item.hsn_code}` : ""}</div>` : ""}
                      ${item.description ? `<div style="font-size: 8pt; color: #475569; margin-top: 2px; font-style: italic;">${item.description}</div>` : ""}
                    </td>
                    <td style="text-align: center;">${item.quantity || 1}</td>
                    <td style="text-align: right;">${currency.symbol}${Number(item.price || item.unit_price || 0).toLocaleString()}</td>
                    <td style="text-align: right; font-weight: bold;">${currency.symbol}${Number((item.quantity || 1) * (item.price || item.unit_price || 0)).toLocaleString()}</td>
                  </tr>
                `).join("") : `
                  <tr>
                    <td style="text-align: center; font-weight: bold; color: #64748b;">1</td>
                    <td style="font-weight: 600;">Enterprise Solution & Implementation Package</td>
                    <td style="text-align: center;">1</td>
                    <td style="text-align: right;">${currency.symbol}${subtotal.toLocaleString()}</td>
                    <td style="text-align: right; font-weight: bold;">${currency.symbol}${subtotal.toLocaleString()}</td>
                  </tr>
                `}
              </tbody>
            </table>

            <div class="total-box">
              <div class="total-card">
                <div class="total-row">
                  <span>Subtotal:</span>
                  <span>${currency.symbol}${subtotal.toLocaleString()}</span>
                </div>
                <div class="total-row grand-total">
                  <span>Total Amount:</span>
                  <span>${currency.symbol}${subtotal.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div class="terms">
              <p style="font-weight: bold; margin-bottom: 2px;">Terms & Conditions:</p>
              <p>1. Quotation prices are valid for 30 calendar days from the issue date.</p>
              <p>2. Goods and services will be scheduled upon receipt of purchase order or advance payment confirmation.</p>
            </div>

            ${showReviewQR && googleReviewUrl ? `
            <div class="review-box">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&margin=0&data=${encodeURIComponent(googleReviewUrl)}" alt="Google Review QR" style="width: 60px; height: 60px; object-fit: contain; background: #fff; padding: 3px; border: 1px solid #f59e0b; border-radius: 6px;" />
              <div>
                <div style="color: #f59e0b; font-size: 11px; font-weight: 900; letter-spacing: 2px;">★ ★ ★ ★ ★</div>
                <div style="font-size: 11px; font-weight: 800; color: #78350f; text-transform: uppercase;">Rate our solutions on Google!</div>
                <div style="font-size: 9.5px; color: #92400e;">Scan with your phone camera to share your 5-star experience with our team.</div>
              </div>
            </div>
            ` : ''}

            <div class="footer">
              <p>This is a computer-generated quotation statement issued by ${orgName}.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 500);
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
          <p className="text-xs text-muted-foreground">
            Create, track lifecycle, manage open vs closed conversions, and convert quotes to Tax Invoices.
          </p>
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
              <p className="text-[10px] text-muted-foreground">Active in sales pipeline</p>
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
              <p className="text-[10px] text-muted-foreground">Converted to Tax Invoices</p>
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
              <p className="text-[10px] text-muted-foreground">Lost / customer declined</p>
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
              <p className="text-[10px] text-muted-foreground">All generated proposals</p>
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
                  const isDropdownOpen = openStatusDropdownId === (quote.id || quote.quote_number);

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
                        {quote.created_at ? new Date(quote.created_at).toLocaleDateString() : "-"}
                      </td>

                      {/* Total Amount */}
                      <td className="px-6 py-4 font-black text-foreground text-right text-sm">
                        {currency.symbol}{Number(quote.total || 0).toLocaleString()}
                      </td>

                      {/* Status / Conversion Column with Dropdown */}
                      <td className="px-6 py-4 relative">
                        <div className="flex flex-col items-start gap-1">
                          <div className="relative inline-block text-left">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenStatusDropdownId(
                                  isDropdownOpen ? null : (quote.id || quote.quote_number)
                                );
                              }}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer shadow-2xs ${
                                isConverted
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                                  : isRejected
                                  ? "bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100"
                                  : isExpired
                                  ? "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100"
                                  : "bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100"
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
                                  : quote.status || "Open (Pending)"}
                              </span>
                              <ChevronDown className="size-3 text-muted-foreground ml-0.5 opacity-70" />
                            </button>

                            {/* Dropdown Menu */}
                            {isDropdownOpen && (
                              <div
                                className="absolute left-0 mt-1 w-56 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400">
                                  Change Quotation Status
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleUpdateQuoteStatus(quote, "Open (Pending)")}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer"
                                >
                                  <span className="size-2 rounded-full bg-blue-500" />
                                  <span>Open (Pending / Active)</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleUpdateQuoteStatus(quote, "Closed (Converted)")}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer"
                                >
                                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                                  <span>Closed (Converted to Invoice)</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleUpdateQuoteStatus(quote, "Closed (Not Interested)")}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                                >
                                  <XCircle className="size-3.5 text-rose-600" />
                                  <span>Closed (Not Interested / Rejected)</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleUpdateQuoteStatus(quote, "Closed (Expired)")}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 cursor-pointer"
                                >
                                  <Clock className="size-3.5 text-amber-600" />
                                  <span>Closed (Expired / Lapsed)</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleUpdateQuoteStatus(quote, "Draft")}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                >
                                  <Edit className="size-3.5 text-slate-500" />
                                  <span>Draft (Open)</span>
                                </button>
                              </div>
                            )}
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
    </div>
  );
}
