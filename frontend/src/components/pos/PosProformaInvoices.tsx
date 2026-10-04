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
  RefreshCw,
  Zap,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { invoicesApi, crmQuotationsApi } from "@/lib/api-client";
import { useTenant } from "@/contexts/tenant-context";
import { getActiveBillingGst } from "@/lib/receipt-template-store";
import { useCurrency } from "@/hooks/use-currency";
import { AiCallingModal } from "@/components/crm/AiCallingModal";
import { PosSalesInvoice } from "@/components/pos/PosSalesInvoice";
import { FullInvoicePrinter, type FullInvoiceData } from "@/components/pos/FullInvoicePrinter";
import { extractGstState } from "@/lib/gst-utils";

export type ProformaStatusCategory = "all" | "open" | "closed_converted" | "closed_rejected" | "closed_expired";

export function normalizeProformaStatus(status?: string): "open" | "closed_converted" | "closed_rejected" | "closed_expired" {
  const s = (status || "").toLowerCase().trim();
  if (
    s.includes("converted") ||
    s.includes("accepted") ||
    s.includes("approved") ||
    s.includes("paid") ||
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

export function PosProformaInvoices() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<ProformaStatusCategory>("all");
  const [proformaList, setProformaList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formDocType, setFormDocType] = useState<"PROFORMA" | "TAX_INVOICE">("PROFORMA");
  const [editingProforma, setEditingProforma] = useState<any | null>(null);
  const [callingProforma, setCallingProforma] = useState<any | null>(null);
  const [selectedProformaForPrint, setSelectedProformaForPrint] = useState<FullInvoiceData | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const fetchProformaInvoices = async () => {
    setLoading(true);
    try {
      const res = await invoicesApi.listInvoices({ invoice_type: "proforma", page_size: 150 }).catch(() => null);
      const apiItems: any[] = Array.isArray(res) ? res : (res as any)?.items || [];

      const currentTenantId = (tenant as any)?.raw?.tenant_id || (tenant as any)?.tenant_id || tenant?.id || "default";
      const currentCompanyId = tenant?.id || (tenant as any)?.raw?.id || (tenant as any)?.company_id || "default";
      const localKey = `pos_saved_invoices_${currentTenantId}_${currentCompanyId}`;
      let localItems: any[] = [];
      const conversionMap = new Map<string, { invoiceNumber: string; convertedAt: string }>();

      // Read conversion map from local storage
      try {
        const convKeys = [`pos_proforma_conversions_${currentTenantId}`, "pos_proforma_conversions", `pos_quote_conversions_${currentTenantId}`, "pos_quote_conversions"];
        convKeys.forEach((ck) => {
          const rawConv = localStorage.getItem(ck);
          if (rawConv) {
            const parsed = JSON.parse(rawConv);
            Object.entries(parsed).forEach(([pKey, val]: [string, any]) => {
              if (pKey && val?.invoiceNumber) {
                conversionMap.set(pKey.trim().toLowerCase(), {
                  invoiceNumber: val.invoiceNumber,
                  convertedAt: val.convertedAt || new Date().toISOString(),
                });
              }
            });
          }
        });
      } catch (e) {}

      // Read saved POS invoices across all keys
      try {
        const allKeys = Object.keys(localStorage).filter((k) => k.startsWith("pos_saved_invoices_"));
        if (!allKeys.includes(localKey)) allKeys.push(localKey);

        allKeys.forEach((k) => {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              parsed.forEach((i: any) => {
                const isProforma =
                  i.invoice_type === "PROFORMA" ||
                  i.invoice_type === "proforma" ||
                  (i.invoice_number && String(i.invoice_number).startsWith("PI-")) ||
                  i.proforma_number;

                if (isProforma) {
                  localItems.push({
                    id: i.id,
                    proforma_number: i.invoice_number || i.proforma_number,
                    invoice_number: i.invoice_number || i.proforma_number,
                    customer_name: i.customer_name,
                    customer_phone: i.customer_phone,
                    customer_email: i.customer_email,
                    customer_gstin: i.customer_gstin || i.customer_gst,
                    billing_address: i.billing_address || i.address,
                    shipping_address: i.shipping_address,
                    total: i.grand_total || i.total || i.total_amount,
                    subtotal: i.subtotal,
                    status: i.status || i.payment_status || "Open (Pending)",
                    converted_invoice_number: i.converted_invoice_number,
                    converted_at: i.converted_at,
                    created_at: i.invoice_date || i.created_at || new Date().toISOString(),
                    due_date: i.due_date,
                    notes: i.notes,
                    items: i.items || i.lines,
                  });
                } else {
                  // Tax Invoice: check if it converted a proforma
                  const po = String(i.po_number || "");
                  const notes = String(i.notes || "");
                  const origRef = String(i.original_invoice_ref || "");
                  const pNum = String(i.proforma_number || "");

                  [po, notes, origRef, pNum].forEach((str) => {
                    const match = str.match(/PI-[\w-]+/i);
                    if (match) {
                      const matchedProforma = match[0].toLowerCase();
                      conversionMap.set(matchedProforma, {
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
      } catch (e) {}

      // Merge API and local items
      const combinedMap = new Map<string, any>();
      [...apiItems, ...localItems].forEach((item) => {
        const key = String(item.proforma_number || item.invoice_number || item.id || "").trim();
        if (!key) return;

        // Augment with conversion metadata
        const conv = conversionMap.get(key.toLowerCase());
        const isConverted = Boolean(conv?.invoiceNumber || item.converted_invoice_number);

        const currentStatus = item.status || "Open (Pending)";
        const normalized = isConverted
          ? "Closed (Converted)"
          : currentStatus.toLowerCase().includes("won") || currentStatus.toLowerCase().includes("convert")
          ? "Closed (Converted)"
          : currentStatus.toLowerCase().includes("reject") || currentStatus.toLowerCase().includes("cancel")
          ? "Closed (Cancelled)"
          : currentStatus;

        combinedMap.set(key, {
          ...item,
          id: item.id || key,
          proforma_number: key,
          invoice_number: key,
          status: normalized,
          converted_invoice_number: conv?.invoiceNumber || item.converted_invoice_number,
          converted_at: conv?.convertedAt || item.converted_at,
        });
      });

      const list = Array.from(combinedMap.values()).sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );

      setProformaList(list);
    } catch (err) {
      console.error("Failed to load proforma invoices:", err);
      toast.error("Failed to load proforma invoices.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProformaInvoices();
  }, [tenant?.id]);

  // Derived metrics
  const openProformas = useMemo(() => proformaList.filter((p) => normalizeProformaStatus(p.status) === "open"), [proformaList]);
  const convertedProformas = useMemo(() => proformaList.filter((p) => normalizeProformaStatus(p.status) === "closed_converted"), [proformaList]);
  const rejectedProformas = useMemo(() => proformaList.filter((p) => normalizeProformaStatus(p.status) === "closed_rejected"), [proformaList]);
  const expiredProformas = useMemo(() => proformaList.filter((p) => normalizeProformaStatus(p.status) === "closed_expired"), [proformaList]);

  const totalValue = useMemo(() => proformaList.reduce((sum, p) => sum + Number(p.total || 0), 0), [proformaList]);
  const openTotal = useMemo(() => openProformas.reduce((sum, p) => sum + Number(p.total || 0), 0), [openProformas]);
  const convertedTotal = useMemo(() => convertedProformas.reduce((sum, p) => sum + Number(p.total || 0), 0), [convertedProformas]);
  const rejectedTotal = useMemo(() => rejectedProformas.reduce((sum, p) => sum + Number(p.total || 0), 0), [rejectedProformas]);

  // Tab & Search filtered list
  const filteredProformas = useMemo(() => {
    return proformaList.filter((p) => {
      const pNum = (p.proforma_number || p.invoice_number || "").toLowerCase();
      const cName = ((p as any).customer_name || "").toLowerCase();
      const term = searchTerm.toLowerCase();
      const matchesSearch = !term || pNum.includes(term) || cName.includes(term);

      if (!matchesSearch) return false;

      if (activeTab === "all") return true;
      const cat = normalizeProformaStatus(p.status);
      return cat === activeTab;
    });
  }, [proformaList, searchTerm, activeTab]);

  const handlePrintProforma = (proforma: any) => {
    const rawItems = (proforma.items as any)?.items || (Array.isArray(proforma.items) ? proforma.items : []);

    const activeBillingGst = getActiveBillingGst(tenant?.id);
    const sellerState = extractGstState(activeBillingGst?.gstin || (tenant as any)?.settings?.gstin);

    const mappedItems = (rawItems.length > 0 ? rawItems : [
      {
        product_name: "Item / Commercial Goods",
        quantity: 1,
        unit_price: Number(proforma.subtotal || proforma.total || 0),
        tax_rate: 18,
      },
    ]).map((item: any) => {
      const qty = Number(item.quantity || item.qty || 1);
      const price = Number(item.price || item.unit_price || item.rate || 0);
      const taxRate = Number(item.tax_rate ?? item.tax_percent ?? item.tax ?? 18);
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

    const isConverted = normalizeProformaStatus(proforma.status) === "closed_converted";
    const custBilling = proforma.billing_address || proforma.customer_address || proforma.address || "";
    const custShipping = proforma.shipping_address || custBilling || "";

    const invData: FullInvoiceData = {
      id: proforma.id,
      doc_type: "proforma",
      header_title: "PROFORMA INVOICE / PRE-SALE NOTE",
      invoice_number: proforma.proforma_number || proforma.invoice_number || "PI-0001",
      invoice_date: proforma.created_at || proforma.date || new Date().toISOString(),
      due_date: proforma.due_date || proforma.valid_until,
      customerName: proforma.customer_name || "Valued Client",
      customerPhone: proforma.customer_phone || "",
      customerEmail: proforma.customer_email || "",
      customerAddress: custBilling,
      customerBillingAddress: custBilling,
      customerShippingAddress: custShipping,
      customerGST: proforma.customer_gstin || proforma.customer_gst || "",
      place_of_supply: proforma.place_of_supply || (sellerState?.name ? `${sellerState.name} (${sellerState.code}) - Intra-State` : undefined),
      payment_terms: proforma.payment_terms || "Advance Payment / Pre-Shipment",
      payment_status: isConverted ? `CONVERTED (Inv: ${proforma.converted_invoice_number || "Generated"})` : "PROFORMA VALID (30 Days)",
      items: mappedItems,
      subtotal: Number(proforma.subtotal || proforma.total || 0),
      discount_amount: Number(proforma.discount || proforma.discount_amount || 0),
      tax_amount: Number(proforma.tax || proforma.total_tax || 0),
      grand_total: Number(proforma.total || proforma.grand_total || 0),
      notes: proforma.notes || "This is a Proforma Invoice for advance payment. Official Tax Invoice will be issued on dispatch.",
      terms: proforma.terms || "1. Goods once sold will not be taken back or exchanged.\n2. All disputes are subject to local jurisdiction only.\n3. Proforma prices are valid for 30 calendar days from the issue date.",
    };

    setSelectedProformaForPrint(invData);
    setIsPrintModalOpen(true);
  };

  const handleSendWhatsAppRow = async (proforma: any) => {
    try {
      toast.info(`Sending Proforma Invoice #${proforma.proforma_number} via WhatsApp...`);
      const phone = proforma.customer_phone || "";
      if (!phone) {
        toast.error("Customer phone number is missing.");
        return;
      }
      const res = await invoicesApi.sendInvoiceToWhatsApp(proforma.id, phone);
      if (res?.success) {
        toast.success(`Proforma Invoice #${proforma.proforma_number} sent to ${phone} via WhatsApp!`);
        void fetchProformaInvoices();
      } else {
        toast.warning(res?.error || "WhatsApp notice received.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to dispatch WhatsApp message");
    }
  };

  const handleSendEmailRow = async (proforma: any) => {
    try {
      toast.info(`Sending Proforma Invoice #${proforma.proforma_number} via Email...`);
      const res = await crmQuotationsApi.sendQuotation(proforma.id, {
        send_email: true,
        send_whatsapp: false,
      });
      const errs = res?.results?.errors || [];
      if (errs.length > 0) {
        toast.warning(`Email notice: ${errs.join(", ")}`);
      } else {
        toast.success(`Proforma Invoice #${proforma.proforma_number} emailed to customer!`);
        void fetchProformaInvoices();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to dispatch email");
    }
  };

  const handleStatusChange = async (proforma: any, newStatus: string) => {
    try {
      const currentTenantId = (tenant as any)?.raw?.tenant_id || (tenant as any)?.tenant_id || tenant?.id || "default";
      const currentCompanyId = tenant?.id || (tenant as any)?.raw?.id || (tenant as any)?.company_id || "default";
      const localKey = `pos_saved_invoices_${currentTenantId}_${currentCompanyId}`;

      const raw = localStorage.getItem(localKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const updated = parsed.map((i: any) => {
            if (i.id === proforma.id || i.invoice_number === proforma.proforma_number) {
              return { ...i, status: newStatus, payment_status: newStatus };
            }
            return i;
          });
          localStorage.setItem(localKey, JSON.stringify(updated));
        }
      }

      setProformaList((prev) =>
        prev.map((p) =>
          p.id === proforma.id ? { ...p, status: newStatus } : p
        )
      );
      toast.success(`Status updated to "${newStatus}"`);
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const handleConvertToInvoice = (proforma: any) => {
    setEditingProforma({
      ...proforma,
      invoice_type: "TAX_INVOICE",
      doc_type: "TAX_INVOICE",
      original_proforma_ref: proforma.proforma_number || proforma.invoice_number || proforma.id,
      notes: `Converted from Proforma #${proforma.proforma_number || proforma.invoice_number || proforma.id}. ${proforma.notes || ""}`.trim(),
    });
    setFormDocType("TAX_INVOICE");
    setIsFormOpen(true);
  };

  const handleEditProforma = (proforma: any) => {
    setEditingProforma(proforma);
    setFormDocType("PROFORMA");
    setIsFormOpen(true);
  };

  if (isFormOpen) {
    return (
      <div className="space-y-4">
        <div
          className={`flex items-center justify-between px-4 py-2.5 rounded-2xl border ${
            formDocType === "TAX_INVOICE"
              ? "bg-emerald-50/80 border-emerald-200"
              : "bg-blue-50/80 border-blue-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`p-1 text-white rounded-lg font-bold text-xs ${
                formDocType === "TAX_INVOICE" ? "bg-emerald-600" : "bg-blue-600"
              }`}
            >
              {formDocType === "TAX_INVOICE" ? "INV" : "PI"}
            </span>
            <div>
              <h3
                className={`font-bold text-xs ${
                  formDocType === "TAX_INVOICE" ? "text-emerald-900" : "text-blue-900"
                }`}
              >
                {formDocType === "TAX_INVOICE"
                  ? `Convert Proforma #${editingProforma?.proforma_number || editingProforma?.invoice_number || editingProforma?.id} to Tax Invoice`
                  : editingProforma
                  ? `Edit Proforma Invoice #${editingProforma.proforma_number || editingProforma.invoice_number || editingProforma.id}`
                  : "New Proforma Invoice / Pre-Sale Note"}
              </h3>
              <p
                className={`text-[11px] ${
                  formDocType === "TAX_INVOICE" ? "text-emerald-700" : "text-blue-700"
                }`}
              >
                {formDocType === "TAX_INVOICE"
                  ? "Generate official GST Tax Invoice with automatic serial number and linked Proforma reference (will mark Proforma as Converted)"
                  : "Issue commercial proforma quotes, advance payment demands & pre-shipment invoices"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsFormOpen(false);
              setEditingProforma(null);
              setFormDocType("PROFORMA");
              void fetchProformaInvoices();
            }}
            className="px-3 py-1.5 bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            ← Back to Proforma List
          </button>
        </div>

        <PosSalesInvoice
          initialDocType={formDocType}
          editingInvoice={editingProforma}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingProforma(null);
            setFormDocType("PROFORMA");
            void fetchProformaInvoices();
          }}
          onSaved={(savedDoc) => {
            setIsFormOpen(false);
            setEditingProforma(null);
            const isTaxInv = formDocType === "TAX_INVOICE" || savedDoc?.invoice_type === "TAX_INVOICE" || savedDoc?.invoice_type === "INVOICE";
            setFormDocType("PROFORMA");
            void fetchProformaInvoices();
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
            <span>Proforma Invoices & Pre-Sale Notes</span>
            <span className="text-[11px] font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {proformaList.length} total
            </span>
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("Create, track lifecycle, manage pre-payment demands, and convert proformas to Tax Invoices.", "Create, track lifecycle, manage pre-payment demands, and convert proformas to Tax Invoices.")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingProforma(null);
              setFormDocType("PROFORMA");
              setIsFormOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 h-9 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-blue-600/20 transition-all cursor-pointer"
          >
            <Plus className="size-4" /> Create Proforma Invoice
          </button>
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Open Proformas */}
        <div className="glass-panel p-5 rounded-2xl border border-blue-200/70 bg-gradient-to-br from-blue-50/40 via-card to-sky-50/30 shadow-xs">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-blue-500 animate-pulse" />
                Open / Pending Proformas
              </p>
              <p className="text-[10px] text-muted-foreground">{t("Active awaiting payment", "Active awaiting payment")}</p>
            </div>
            <div className="px-2 py-0.5 rounded-lg text-xs font-black bg-blue-500/10 text-blue-600 border border-blue-200">
              {openProformas.length}
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
              {convertedProformas.length}
            </div>
          </div>
          <h3 className="text-2xl font-black text-emerald-600 mt-2">{currency.symbol}{convertedTotal.toLocaleString()}</h3>
        </div>

        {/* Closed - Cancelled / Declined */}
        <div className="glass-panel p-5 rounded-2xl border border-rose-200/70 bg-gradient-to-br from-rose-50/40 via-card to-pink-50/30 shadow-xs">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                <XCircle className="size-3.5 text-rose-500" />
                Closed (Cancelled)
              </p>
              <p className="text-[10px] text-muted-foreground">{t("Lost / customer declined", "Lost / customer declined")}</p>
            </div>
            <div className="px-2 py-0.5 rounded-lg text-xs font-black bg-rose-500/10 text-rose-600 border border-rose-200">
              {rejectedProformas.length}
            </div>
          </div>
          <h3 className="text-2xl font-black text-rose-600 mt-2">{currency.symbol}{rejectedTotal.toLocaleString()}</h3>
        </div>

        {/* Total Pipeline Value */}
        <div className="glass-panel p-5 rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50/40 via-card to-purple-50/30 shadow-xs">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-indigo-600" />
                Total Pipeline Value
              </p>
              <p className="text-[10px] text-muted-foreground">{t("All generated proformas", "All generated proformas")}</p>
            </div>
            <div className="px-2 py-0.5 rounded-lg text-xs font-black bg-indigo-500/10 text-indigo-600 border border-indigo-200">
              {proformaList.length}
            </div>
          </div>
          <h3 className="text-2xl font-black text-indigo-700 mt-2">{currency.symbol}{totalValue.toLocaleString()}</h3>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="space-y-3">
        {/* Status Lifecycle Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border">
          {[
            { id: "all", label: "All Proformas", count: proformaList.length, icon: FileText, color: "text-slate-600" },
            { id: "open", label: "Open / Pending", count: openProformas.length, icon: TrendingUp, color: "text-blue-600" },
            { id: "closed_converted", label: "Closed - Converted", count: convertedProformas.length, icon: CheckCircle2, color: "text-emerald-600" },
            { id: "closed_rejected", label: "Closed - Cancelled", count: rejectedProformas.length, icon: Ban, color: "text-rose-600" },
            { id: "closed_expired", label: "Closed - Expired", count: expiredProformas.length, icon: Clock, color: "text-amber-600" },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ProformaStatusCategory)}
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
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search Proforma Number, Customer Name, Phone, Notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
          <button
            onClick={() => void fetchProformaInvoices()}
            className="p-2 border border-border rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Proforma Table */}
      <div className="glass-panel border border-border rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-muted-foreground">Loading proforma invoices...</div>
        ) : filteredProformas.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="size-12 rounded-2xl bg-blue-500/10 text-blue-600 mx-auto flex items-center justify-center">
              <FileText className="size-6" />
            </div>
            <h4 className="text-sm font-bold text-foreground">No Proforma Invoices Found</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {activeTab === "all"
                ? "Start by issuing your first Proforma Invoice for advance payments and pre-sale commitments."
                : `No Proforma Invoices matching the selected filter status (${activeTab}).`}
            </p>
            <button
              onClick={() => {
                setEditingProforma(null);
                setFormDocType("PROFORMA");
                setIsFormOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              <Plus className="size-4" /> Create First Proforma Invoice
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Proforma #</th>
                  <th className="px-4 py-3">Customer Party</th>
                  <th className="px-4 py-3">Issue Date</th>
                  <th className="px-4 py-3">Valid Until</th>
                  <th className="px-4 py-3 text-right">Total Amount</th>
                  <th className="px-4 py-3 text-center">Lifecycle Status</th>
                  <th className="px-4 py-3 text-center">Conversion / Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredProformas.map((proforma) => {
                  const cat = normalizeProformaStatus(proforma.status);
                  const isConverted = cat === "closed_converted";
                  const total = Number(proforma.total || 0);

                  return (
                    <tr key={proforma.id || proforma.proforma_number} className="hover:bg-muted/40 transition-colors">
                      {/* Proforma Number */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="p-1 rounded-lg bg-blue-500/10 text-blue-600 font-black text-[10px]">
                            PI
                          </span>
                          <span className="font-mono font-bold text-foreground">
                            {proforma.proforma_number || proforma.invoice_number || proforma.id}
                          </span>
                        </div>
                      </td>

                      {/* Customer Party */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-foreground">{proforma.customer_name || "Walk-in Customer"}</div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                          {proforma.customer_phone && <span>{proforma.customer_phone}</span>}
                          {proforma.customer_gstin && (
                            <span className="px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 rounded text-[9px] font-mono font-bold text-slate-700 dark:text-slate-300">
                              GSTIN: {proforma.customer_gstin}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Issue Date */}
                      <td className="px-4 py-3 text-muted-foreground">
                        {proforma.created_at ? new Date(proforma.created_at).toLocaleDateString() : "—"}
                      </td>

                      {/* Valid Until */}
                      <td className="px-4 py-3 text-muted-foreground">
                        {proforma.due_date ? new Date(proforma.due_date).toLocaleDateString() : "30 Days"}
                      </td>

                      {/* Total Amount */}
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono font-black text-sm text-foreground">
                          {currency.symbol}{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Lifecycle Status Dropdown */}
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <select
                            value={
                              isConverted
                                ? "Closed (Converted)"
                                : cat === "closed_rejected"
                                ? "Closed (Cancelled)"
                                : cat === "closed_expired"
                                ? "Closed (Expired)"
                                : "Open (Pending)"
                            }
                            onChange={(e) => handleStatusChange(proforma, e.target.value)}
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-full border outline-none cursor-pointer transition-all ${
                              isConverted
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-300 dark:border-emerald-800"
                                : cat === "closed_rejected"
                                ? "bg-rose-500/10 text-rose-600 border-rose-300 dark:border-rose-800"
                                : cat === "closed_expired"
                                ? "bg-amber-500/10 text-amber-600 border-amber-300 dark:border-amber-800"
                                : "bg-blue-500/10 text-blue-600 border-blue-300 dark:border-blue-800"
                            }`}
                          >
                            <option value="Open (Pending)">Open (Pending)</option>
                            <option value="Closed (Converted)">Closed (Converted)</option>
                            <option value="Closed (Cancelled)">Closed (Cancelled)</option>
                            <option value="Closed (Expired)">Closed (Expired)</option>
                          </select>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Print / Preview */}
                          <button
                            onClick={() => handlePrintProforma(proforma)}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-blue-600 transition-colors cursor-pointer"
                            title="Print / Live Preview Proforma Invoice"
                          >
                            <Printer className="size-4" />
                          </button>

                          {/* WhatsApp */}
                          <button
                            onClick={() => void handleSendWhatsAppRow(proforma)}
                            className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-600 transition-colors cursor-pointer"
                            title="Send Proforma PDF to WhatsApp"
                          >
                            <MessageCircle className="size-4" />
                          </button>

                          {/* Email */}
                          <button
                            onClick={() => void handleSendEmailRow(proforma)}
                            className="p-1.5 rounded-lg hover:bg-blue-500/10 text-muted-foreground hover:text-blue-600 transition-colors cursor-pointer"
                            title="Email Proforma Invoice"
                          >
                            <Mail className="size-4" />
                          </button>

                          {/* AI Calling */}
                          <button
                            onClick={() => setCallingProforma(proforma)}
                            className="p-1.5 rounded-lg hover:bg-purple-500/10 text-muted-foreground hover:text-purple-600 transition-colors cursor-pointer"
                            title="Trigger AI Follow-up Call"
                          >
                            <PhoneCall className="size-4" />
                          </button>

                          {/* Convert to Tax Invoice (If not yet converted) */}
                          {!isConverted ? (
                            <button
                              onClick={() => handleConvertToInvoice(proforma)}
                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-xs transition-all cursor-pointer ml-1"
                              title="Convert this Proforma directly to official GST Tax Invoice"
                            >
                              <FileCheck className="size-3" /> Convert
                            </button>
                          ) : (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold ml-1">
                              <CheckCircle2 className="size-3" />
                              <span>{proforma.converted_invoice_number || "Invoiced"}</span>
                            </div>
                          )}

                          {/* Edit */}
                          <button
                            onClick={() => handleEditProforma(proforma)}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer ml-1"
                            title="Edit Proforma Details"
                          >
                            <Edit className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Full Multi-Theme Invoice Printer Modal */}
      {isPrintModalOpen && selectedProformaForPrint && (
        <FullInvoicePrinter
          invoiceData={selectedProformaForPrint}
          onClose={() => {
            setIsPrintModalOpen(false);
            setSelectedProformaForPrint(null);
          }}
        />
      )}

      {/* AI Calling Modal */}
      {callingProforma && (
        <AiCallingModal
          isOpen={Boolean(callingProforma)}
          onClose={() => setCallingProforma(null)}
          leadId={callingProforma.id}
          leadName={callingProforma.customer_name || "Valued Client"}
          phoneNumber={callingProforma.customer_phone || ""}
          email={callingProforma.customer_email || ""}
        />
      )}
    </div>
  );
}
