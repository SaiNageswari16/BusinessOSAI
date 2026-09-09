import { toast } from "sonner";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Filter, FileCheck, FileText, Send, Building, Calendar, ExternalLink, PhoneCall, Printer, Edit, MessageCircle, Mail, Download } from "lucide-react";
import { crmQuotationsApi, type CrmQuotation } from "@/lib/api-client";
import { useTenant } from "@/contexts/tenant-context";
import { getActiveBillingGst } from "@/lib/receipt-template-store";
import { useCurrency } from "@/hooks/use-currency";
import { AiCallingModal } from "./AiCallingModal";
import { CustomerQuotationForm } from "./CustomerQuotationForm";

export function Quotations() {
  const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();
  const [searchTerm, setSearchTerm] = useState("");
  const [quotations, setQuotations] = useState<CrmQuotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<CrmQuotation | null>(null);
  const [callingQuote, setCallingQuote] = useState<CrmQuotation | null>(null);

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const res = await crmQuotationsApi.list();
      setQuotations(res || []);
    } catch (err) {
      console.error("Failed to fetch quotations:", err);
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchQuotations();
  }, [tenant?.id]);

  if (isFormOpen) {
    return (
      <CustomerQuotationForm
        onClose={() => {
          setIsFormOpen(false);
          setEditingQuote(null);
        }}
        onSaved={() => {
          setIsFormOpen(false);
          setEditingQuote(null);
          void fetchQuotations();
        }}
        initialData={editingQuote}
      />
    );
  }

  const handlePrintQuotation = (quote: CrmQuotation) => {
    const printWin = window.open("", "_blank", "width=850,height=1100");
    if (!printWin) {
      toast.error("Please allow popups to preview and print the Quotation.");
      return;
    }

    const activeBillingGst = getActiveBillingGst(tenant?.id);
    const orgName = activeBillingGst?.trade_name || activeBillingGst?.legal_name || tenant?.name || "BusinessOS AI Global";
    const orgLogo = activeBillingGst?.logo_url || tenant?.logo_url || (tenant as any)?.raw?.logo_url || "";
    const orgAddress = activeBillingGst?.address || (tenant as any)?.settings?.address || "KK Street, Proddatur, YSR Cuddapah, Andhra Pradesh - 516360";
    const orgPhone = activeBillingGst?.phone || (tenant as any)?.settings?.phone || "+91 98493 44919";
    const orgEmail = activeBillingGst?.email || (tenant as any)?.settings?.email || "sales@businessos.ai";
    const orgGstin = activeBillingGst?.gstin || (tenant as any)?.settings?.gstin || (tenant as any)?.settings?.tax_id || "37AABCCH694G1Z4";
    const googleReviewUrl = activeBillingGst?.google_review_url || (tenant as any)?.raw?.google_review_url || null;
    const showReviewQR = activeBillingGst?.google_review_enabled !== false && Boolean(googleReviewUrl);

    const items = (quote.items as any)?.items || [];
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

  const handleSendWhatsAppRow = async (quote: CrmQuotation) => {
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

  const handleSendEmailRow = async (quote: CrmQuotation) => {
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

  const filteredQuotes = quotations.filter(q => {
    const qNum = (q.quote_number || "").toLowerCase();
    const cName = ((q as any).customer_name || "").toLowerCase();
    const term = searchTerm.toLowerCase();
    return qNum.includes(term) || cName.includes(term);
  });

  const draftQuotes = quotations.filter(q => q.status === "Draft");
  const sentQuotes = quotations.filter(q => q.status === "Sent");
  const approvedQuotes = quotations.filter(q => q.status === "Approved" || q.status === "Accepted");
  const totalValue = quotations.reduce((sum, q) => sum + Number(q.total || 0), 0);

  const draftTotal = draftQuotes.reduce((sum, q) => sum + Number(q.total || 0), 0);
  const sentTotal = sentQuotes.reduce((sum, q) => sum + Number(q.total || 0), 0);
  const approvedTotal = approvedQuotes.reduce((sum, q) => sum + Number(q.total || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold tracking-tight">Quotations</h2>
          <p className="text-xs text-muted-foreground">Create, manage, and track professional sales quotations.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingQuote(null);
              setIsFormOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 h-9 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Plus className="size-4" /> Create Quotation
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Draft Quotes", value: String(draftQuotes.length), amount: `${currency.symbol}${draftTotal.toLocaleString()}`, color: "text-slate-500", bg: "bg-slate-500/10" },
          { label: "Sent Quotes", value: String(sentQuotes.length), amount: `${currency.symbol}${sentTotal.toLocaleString()}`, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Approved / Won", value: String(approvedQuotes.length), amount: `${currency.symbol}${approvedTotal.toLocaleString()}`, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Total Pipeline Value", value: String(quotations.length), amount: `${currency.symbol}${totalValue.toLocaleString()}`, color: "text-indigo-500", bg: "bg-indigo-500/10" },
        ].map((stat, i) => (
          <div key={i} className="glass-panel p-5 rounded-xl border border-border/50 bg-card">
            <div className="flex justify-between items-start mb-2">
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
              <div className={`px-2 py-1 rounded-md text-xs font-bold ${stat.bg} ${stat.color}`}>
                {stat.value}
              </div>
            </div>
            <h3 className="text-2xl font-bold text-foreground">{stat.amount}</h3>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 glass-panel p-4 rounded-xl border border-border/50 bg-card">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search quotations by quote ID or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none"
          />
        </div>
        <button onClick={() => toast.info('Filter options updated.')} className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors">
          <Filter className="size-4" /> Filter
        </button>
      </div>

      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden bg-card">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading quotations…</div>
          ) : filteredQuotes.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="size-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                <FileText className="size-6" />
              </div>
              <p className="text-sm font-bold text-foreground">No Quotations Found</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Create and issue your first sales quotation to a customer with automated GST calculation and instant WhatsApp sharing.
              </p>
              <button
                onClick={() => {
                  setEditingQuote(null);
                  setIsFormOpen(true);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all inline-flex items-center gap-1.5"
              >
                <Plus className="size-3.5" /> + Create First Quotation
              </button>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4">Quote ID</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredQuotes.map((quote, i) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    key={quote.id} 
                    onClick={() => {
                      setEditingQuote(quote);
                      setIsFormOpen(true);
                    }}
                    className="hover:bg-muted/50 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <p className="font-semibold text-foreground flex items-center gap-2">
                        <FileCheck className="size-4 text-primary" /> {quote.quote_number}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {quote.items?.items?.length || 0} Items
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-medium">
                        <Building className="size-4 text-muted-foreground" />
                        {(quote as any).customer_name || "Enterprise Client"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">
                      {quote.created_at ? new Date(quote.created_at).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-6 py-4 font-bold text-foreground text-right">
                      {currency.symbol}{Number(quote.total || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                        quote.status === 'Sent' ? 'bg-blue-500/10 text-blue-600' :
                        quote.status === 'Draft' ? 'bg-slate-500/10 text-slate-600' :
                        quote.status === 'Accepted' ? 'bg-emerald-500/10 text-emerald-600' :
                        'bg-emerald-500/10 text-emerald-600'
                      }`}>
                        {quote.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleSendWhatsAppRow(quote)}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                          title="Send Quotation PDF via Tenant WhatsApp"
                        >
                          <MessageCircle className="size-4" />
                        </button>
                        <button
                          onClick={() => handleSendEmailRow(quote)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="Send Quotation PDF via SMTP Email"
                        >
                          <Mail className="size-4" />
                        </button>
                        <button
                          onClick={() => window.open(crmQuotationsApi.getPdfUrl(quote.id), "_blank")}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                          title="Download Server-Generated PDF"
                        >
                          <Download className="size-4" />
                        </button>
                        <button
                          onClick={() => handlePrintQuotation(quote)}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                          title="Print Quotation PDF"
                        >
                          <Printer className="size-4" />
                        </button>
                        <button
                          onClick={() => setCallingQuote(quote)}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                          title="Start AI Follow-up Call"
                        >
                          <PhoneCall className="size-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingQuote(quote);
                            setIsFormOpen(true);
                          }}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                          title="Edit Quotation"
                        >
                          <Edit className="size-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
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
