import React from "react";
import { useI18n } from "@/contexts/i18n-context";
import type { FullInvoiceData } from "../FullInvoicePrinter";
import {
  WordInvoiceTemplateConfig,
  DEFAULT_WORD_COLUMNS,
  DEFAULT_WORD_SECTIONS,
} from "../WordInvoiceStudioModal";
import { numberToIndianWords } from "@/lib/number-to-words";
import { formatDisplayDate, formatPartyAddress, isInvoiceLineFree } from "@/lib/utils";
import { generateQRCodeSVG, buildUpiPayUrl } from "@/lib/qr-generator";
import { computeGstBreakdown, checkIsInterstate } from "@/lib/gst-utils";
import { getActiveBillingGst, getOrgSignatureSettings } from "@/lib/receipt-template-store";

export interface WordInvoiceDocumentProps {
  invoice: FullInvoiceData;
  wordConfig?: WordInvoiceTemplateConfig;
  dynamicStoreName?: string;
  dynamicLogoUrl?: string;
  dynamicAddress?: string;
  dynamicPhone?: string;
  dynamicEmail?: string;
  sellerGstin?: string;
  sellerStateCode?: string;
  dynamicBank?: string;
  currency?: { symbol: string; code: string };
  f?: any;
  template?: any;
}

export function WordInvoiceDocument({
  invoice,
  wordConfig: propWordConfig,
  dynamicStoreName = "",
  dynamicLogoUrl = "",
  dynamicAddress = "",
  dynamicPhone = "",
  dynamicEmail = "",
  sellerGstin = "",
  sellerStateCode = "36",
  dynamicBank = "",
  currency = { symbol: "₹", code: "INR" },
  template,
}: WordInvoiceDocumentProps) {
  const { t } = useI18n();

  const activeGst = getActiveBillingGst() as any;
  const activeSig = getOrgSignatureSettings() as any;

  // Resolve Word Config from props or template
  const config: WordInvoiceTemplateConfig = React.useMemo(() => {
    const raw = propWordConfig || template?.wordConfig || template;
    const themeName = raw?.themeName || template?.themeName || "";
    const tplId = raw?.id || template?.id || "";

    let resolvedHeaderStyle = raw?.headerStyle;
    let resolvedBorderStyle = raw?.tableBorderStyle;
    let resolvedColor = raw?.primaryColor || template?.primaryColor;
    let resolvedFont = raw?.fontFamily || template?.fontFamily;

    if (tplId === "tpl-inv-global-stripe" || themeName === "global_stripe") {
      resolvedHeaderStyle = resolvedHeaderStyle || "classic_split";
      resolvedBorderStyle = resolvedBorderStyle || "minimal";
      resolvedColor = resolvedColor || "#0f172a";
      resolvedFont = resolvedFont || "Inter, sans-serif";
    } else if (tplId === "tpl-inv-global-zurich" || themeName === "global_zurich") {
      resolvedHeaderStyle = resolvedHeaderStyle || "swiss_grid";
      resolvedBorderStyle = resolvedBorderStyle || "strong";
      resolvedColor = resolvedColor || "#dc2626";
      resolvedFont = resolvedFont || "Inter, sans-serif";
    } else if (tplId === "tpl-inv-global-nordic" || themeName === "global_nordic") {
      resolvedHeaderStyle = resolvedHeaderStyle || "minimal";
      resolvedBorderStyle = resolvedBorderStyle || "subtle";
      resolvedColor = resolvedColor || "#334155";
      resolvedFont = resolvedFont || "Outfit, sans-serif";
    } else if (tplId === "tpl-inv-global-tokyo" || themeName === "global_tokyo") {
      resolvedHeaderStyle = resolvedHeaderStyle || "tokyo_precision";
      resolvedBorderStyle = resolvedBorderStyle || "double";
      resolvedColor = resolvedColor || "#1e1b4b";
      resolvedFont = resolvedFont || "Inter, sans-serif";
    } else if (tplId === "tpl-inv-global-singapore" || themeName === "global_singapore") {
      resolvedHeaderStyle = resolvedHeaderStyle || "modern_banner";
      resolvedBorderStyle = resolvedBorderStyle || "subtle";
      resolvedColor = resolvedColor || "#0284c7";
      resolvedFont = resolvedFont || "Inter, sans-serif";
    }

    return {
      id: raw?.id || "tpl-word-default",
      name: raw?.name || "Global Standard Invoice",
      category: "invoices",
      isDefault: Boolean(raw?.isDefault),
      fontFamily: resolvedFont || "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
      fontSizePt: raw?.fontSizePt || 9.5,
      primaryColor: resolvedColor || "#0f172a",
      headerStyle: resolvedHeaderStyle || "classic_split",
      tableBorderStyle: resolvedBorderStyle || "subtle",
      paperBgColor: raw?.paperBgColor || "#ffffff",
      watermarkText: raw?.watermarkText || template?.watermarkText || "",
      watermarkOpacity: raw?.watermarkOpacity || 0.04,
      invoiceTitle: raw?.invoiceTitle || raw?.headerTitle || invoice?.header_title || (
        (invoice.doc_type === 'quotation' || invoice.invoice_type === 'QUOTATION' || String(invoice.invoice_number || '').toUpperCase().startsWith('QT-')) ? "TAX QUOTATION / ESTIMATE" :
        (invoice.doc_type === 'estimate' || invoice.invoice_type === 'ESTIMATE_NON_GST' || String(invoice.invoice_number || '').toUpperCase().startsWith('EST-')) ? "TAX ESTIMATE / ESTIMATE" :
        (invoice.doc_type === 'proforma' || invoice.invoice_type === 'PROFORMA' || String(invoice.invoice_number || '').toUpperCase().startsWith('PI-')) ? "PROFORMA INVOICE" :
        (template?.headerTitle || "TAX INVOICE")
      ),
      logoUrl: raw?.logoUrl || template?.logoUrl || dynamicLogoUrl || "",
      companyName: raw?.companyName || template?.storeName || template?.companyName || dynamicStoreName || activeGst?.trade_name || activeGst?.legal_name || "ACME ENTERPRISES",
      companyTagline: raw?.companyTagline || template?.companyTagline || "AUTHORIZED BILLING & COMMERCIAL INVOICING",
      companyAddress: raw?.companyAddress || template?.storeAddress || dynamicAddress || activeGst?.address || "",
      companyPhone: raw?.companyPhone || template?.storePhone || dynamicPhone || activeGst?.phone || "",
      companyEmail: raw?.companyEmail || template?.storeEmail || dynamicEmail || activeGst?.email || "",
      companyGstin: raw?.companyGstin || template?.gstin || sellerGstin || activeGst?.gstin || "",
      companyPan: raw?.companyPan || activeGst?.pan || "",
      customerTitle: raw?.customerTitle || "Billed To (Customer):",
      customerName: raw?.customerName || "Customer Name",
      customerAddress: raw?.customerAddress || "",
      customerGstin: raw?.customerGstin || "",
      customerPhone: raw?.customerPhone || "",
      shippingTitle: raw?.shippingTitle || "Shipped To (Delivery):",
      shippingName: raw?.shippingName || "",
      shippingAddress: raw?.shippingAddress || "",
      invoiceNumberLabel: raw?.invoiceNumberLabel || (
        (invoice.doc_type === 'quotation' || invoice.invoice_type === 'QUOTATION' || String(invoice.invoice_number || '').toUpperCase().startsWith('QT-')) ? "Quote No" :
        (invoice.doc_type === 'estimate' || invoice.invoice_type === 'ESTIMATE_NON_GST' || String(invoice.invoice_number || '').toUpperCase().startsWith('EST-')) ? "Estimate No" :
        (invoice.doc_type === 'proforma' || invoice.invoice_type === 'PROFORMA' || String(invoice.invoice_number || '').toUpperCase().startsWith('PI-')) ? "Proforma No" :
        "Invoice No"
      ),
      invoiceNumberValue: raw?.invoiceNumberValue || "INV-2026-0001",
      invoiceDateLabel: raw?.invoiceDateLabel || (
        (invoice.doc_type === 'quotation' || invoice.invoice_type === 'QUOTATION' || String(invoice.invoice_number || '').toUpperCase().startsWith('QT-')) ? "Quote Date" :
        (invoice.doc_type === 'estimate' || invoice.invoice_type === 'ESTIMATE_NON_GST' || String(invoice.invoice_number || '').toUpperCase().startsWith('EST-')) ? "Estimate Date" :
        (invoice.doc_type === 'proforma' || invoice.invoice_type === 'PROFORMA' || String(invoice.invoice_number || '').toUpperCase().startsWith('PI-')) ? "Proforma Date" :
        "Invoice Date"
      ),
      invoiceDateValue: raw?.invoiceDateValue || "",
      dueDateLabel: raw?.dueDateLabel || "Due Date",
      dueDateValue: raw?.dueDateValue || "",
      placeOfSupplyLabel: raw?.placeOfSupplyLabel || "Place of Supply",
      placeOfSupplyValue: raw?.placeOfSupplyValue || "36 - Telangana",
      sections: Array.isArray(raw?.sections) && raw.sections.length > 0 ? raw.sections : DEFAULT_WORD_SECTIONS,
      columns: Array.isArray(raw?.columns) && raw.columns.length > 0 ? raw.columns : DEFAULT_WORD_COLUMNS,
      customFields: Array.isArray(raw?.customFields) ? raw.customFields : [],
      signatureConfig: {
        signatureUrl: raw?.signatureConfig?.signatureUrl !== undefined ? raw?.signatureConfig?.signatureUrl : (activeSig.signatureUrl || null),
        stampUrl: raw?.signatureConfig?.stampUrl !== undefined ? raw?.signatureConfig?.stampUrl : (activeSig.stampUrl || null),
        title: raw?.signatureConfig?.title || activeSig.signatureTitle || "Authorized Signatory",
        companyName: raw?.signatureConfig?.companyName || activeSig.signatureCompanyName || `For ${dynamicStoreName || activeGst?.trade_name || "Organization"}`,
        showSignature: raw?.signatureConfig?.showSignature ?? activeSig.showDigitalSignature ?? true,
        showStamp: raw?.signatureConfig?.showStamp ?? activeSig.showDigitalStamp ?? true,
        alignment: raw?.signatureConfig?.alignment || activeSig.signatureAlignment || "right",
      },
      termsText: raw?.termsText || invoice?.terms || activeGst?.terms_and_conditions || "1. Goods once sold will not be taken back without valid receipt.\n2. Interest @ 18% p.a. will be levied on overdue payments.\n3. All disputes subject to local jurisdiction.",
      footerNote: raw?.footerNote || raw?.footerText || "THANK YOU FOR YOUR VALUED BUSINESS!",
      showBankDetails: raw?.showBankDetails ?? true,
      showPaymentQr: raw?.showPaymentQr ?? true,
      showTaxBreakdown: raw?.showTaxBreakdown ?? true,
      showAmountInWords: raw?.showAmountInWords ?? true,
      createdAt: raw?.createdAt || new Date().toISOString(),
    };
  }, [propWordConfig, template, dynamicStoreName, dynamicAddress, dynamicPhone, dynamicEmail, sellerGstin, activeGst, activeSig, invoice?.terms]);

  // Invoice Items Resolution
  const rawItems = invoice.items || [];
  const items = React.useMemo(() => {
    return rawItems.map((it: any, idx: number) => {
      const isFree = isInvoiceLineFree(it);
      const qty = Number(it.quantity || it.qty || 1);
      const unitPrice = isFree ? 0 : Number(it.unit_price || it.price || it.rate || 0);
      const originalRate = Number(it.original_unit_price || it.unit_price || it.rate || 0);
      const mrp = Number(it.mrp || 0);
      const disc = isFree ? 0 : Number(it.discount_value || it.discount_amount || it.discount || 0);
      const taxRate = isFree ? 0 : Number(it.tax_rate || it.tax_percent || it.gst_rate || 0);
      const subtotal = isFree ? 0 : Number(it.subtotal || it.total_amount || (qty * unitPrice - disc));
      const lineGrossAfterDisc = Math.max(0, qty * unitPrice - disc);
      const isTaxInclusive = Boolean(
        it.is_tax_inclusive === true ||
        it.isTaxInclusive === true ||
        it.tax_inclusive === true ||
        (invoice.is_tax_inclusive === true && it.is_tax_inclusive !== false) ||
        (it.taxable_amount && Number(it.taxable_amount) > 0 && Math.abs(Number(it.taxable_amount) - lineGrossAfterDisc) > 0.05)
      );

      return {
        ...it,
        sno: idx + 1,
        isFree,
        is_free: isFree,
        originalRate,
        description: it.product_name || it.name || it.description || `Item #${idx + 1}`,
        custom_note: it.custom_note || it.description || it.notes || "",
        hsn: it.hsn_code || it.hsn || "9988",
        quantity: qty,
        unit: it.selected_uom || it.uom || it.measuring_unit || it.unit || "PCS",
        unit_type: it.secondary_uom && it.selected_uom === it.secondary_uom ? "Secondary Unit" : "Primary Unit",
        unit_price: unitPrice,
        mrp,
        discount: disc,
        tax_rate: taxRate,
        is_tax_inclusive: isTaxInclusive,
        total_amount: subtotal,
      };
    });
  }, [rawItems, invoice.is_tax_inclusive]);

  // Interstate GST Resolution
  const isInterstate = React.useMemo(() => {
    if (invoice.is_interstate !== undefined) return Boolean(invoice.is_interstate);
    if ((invoice as any).gst_type === "igst") return true;
    if ((invoice as any).gst_type === "cgst_sgst") return false;
    if (Number(invoice.igst_amount || (invoice as any).igst || 0) > 0) return true;

    const sellGst = sellerGstin || activeGst?.gstin || "";
    const custGst = invoice.customer_gstin || invoice.customerGstin || (invoice as any)?.customer?.gst_number || (invoice as any)?.customer?.gstin || "";
    const posState = (invoice.place_of_supply || (invoice as any).placeOfSupply || "").slice(0, 2);
    const custAddr = (invoice as any).billing_address || (invoice as any).shipping_address || invoice.customerBillingAddress || invoice.customerAddress || "";

    const checkRes = checkIsInterstate(
      { gstin: sellGst, address: dynamicAddress },
      { gstin: custGst, state: posState || (invoice as any).customerState, address: typeof custAddr === "string" ? custAddr : "" }
    );
    return checkRes.isInterState;
  }, [invoice, sellerGstin, activeGst, dynamicAddress]);

  // Financial Computations
  const gstBreakdown = React.useMemo(() => {
    return computeGstBreakdown(items, isInterstate);
  }, [items, isInterstate]);

  const taxableSubtotal = Number(invoice.taxable_value ?? gstBreakdown.totalTaxable);
  const totalTax = Number(invoice.tax_amount ?? gstBreakdown.totalTax);
  const totalDiscount = Number(invoice.discount_amount || 0);
  const roundOff = Number(invoice.round_off || 0);
  const grandTotal = Number(invoice.grand_total ?? invoice.total_amount ?? (taxableSubtotal + totalTax + roundOff));

  // Total Billed Quantity & Item Counts
  const totalBilledQty = items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
  const totalItemsCount = items.length;

  // Check if we are rendering a pure template designer dummy preview
  const isPureMockPreview = Boolean(
    !invoice.invoice_number &&
    (!invoice.items || invoice.items.length === 0) &&
    invoice.id?.toString().startsWith("mock-")
  );

  // Determine Customer Information
  const customerName =
    invoice.customerName ||
    invoice.customer_name ||
    invoice.customerCompany ||
    (invoice as any)?.customer?.name ||
    (isPureMockPreview ? (config.customerName || "Sample Customer") : "Walk-in Customer");

  const rawCustomerBilling =
    invoice.customerBillingAddress ||
    invoice.customer_billing_address ||
    invoice.customerAddress ||
    invoice.customer_address ||
    (invoice as any).billing_address ||
    (invoice as any)?.customer?.address;

  const customerAddress =
    formatPartyAddress(rawCustomerBilling) ||
    formatPartyAddress({
      street: typeof rawCustomerBilling === "string" ? rawCustomerBilling : (rawCustomerBilling?.street || ""),
      city: (invoice as any).billing_city || (invoice as any).customer_billing_city || (invoice as any)?.customer?.city,
      state: invoice.customerState || (invoice as any).customer_billing_state || (invoice as any).billing_state || (invoice as any)?.customer?.state,
      pincode: (invoice as any).billing_pincode || (invoice as any).customer_billing_pincode || (invoice as any)?.customer?.pincode,
    }) ||
    (typeof rawCustomerBilling === "string" && rawCustomerBilling !== "[object Object]" && rawCustomerBilling.trim() ? rawCustomerBilling : "") ||
    (isPureMockPreview ? config.customerAddress : "");

  const customerGstin =
    invoice.customerGST ||
    invoice.customer_gstin ||
    (invoice as any)?.customer?.gstin ||
    (invoice as any)?.customer?.gst_number ||
    (isPureMockPreview ? config.customerGstin : "");

  const customerPhone =
    invoice.customerPhone ||
    invoice.customer_phone ||
    (invoice as any)?.customer?.phone ||
    (isPureMockPreview ? config.customerPhone : "");

  // Determine Shipping Information
  const shippingName =
    invoice.customerShippingName ||
    (invoice as any).customer_shipping_name ||
    (invoice as any).shipping_name ||
    (invoice as any).shipping_customer_name ||
    (invoice as any)?.customer?.shipping_name ||
    (invoice as any)?.customer?.company ||
    (isPureMockPreview ? (config.shippingName || customerName) : customerName);

  const rawCustomerShipping =
    invoice.customerShippingAddress ||
    invoice.customer_shipping_address ||
    (invoice as any).shipping_address;

  const shippingAddress =
    formatPartyAddress(rawCustomerShipping) ||
    formatPartyAddress({
      street: typeof rawCustomerShipping === "string" ? rawCustomerShipping : (rawCustomerShipping?.street || ""),
      city: (invoice as any).shipping_city || (invoice as any).customer_shipping_city,
      state: (invoice as any).shipping_state || (invoice as any).customer_shipping_state || invoice.customerState,
      pincode: (invoice as any).shipping_pincode || (invoice as any).customer_shipping_pincode,
    }) ||
    (typeof rawCustomerShipping === "string" && rawCustomerShipping !== "[object Object]" && rawCustomerShipping.trim() ? rawCustomerShipping : "") ||
    (isPureMockPreview ? config.shippingAddress : (customerAddress || "Same as Billing Address"));

  // Invoice Numbers & Dates
  const invoiceNumber = invoice.invoice_number || invoice.invoiceNumber || (invoice as any)?.id || config.invoiceNumberValue;
  const invoiceDate = invoice.invoice_date ? formatDisplayDate(invoice.invoice_date) : config.invoiceDateValue;
  const dueDate = invoice.due_date ? formatDisplayDate(invoice.due_date) : config.dueDateValue;
  const placeOfSupply = invoice.place_of_supply || (invoice as any)?.placeOfSupply || config.placeOfSupplyValue;

  // Resolve Bank Details
  const resolvedBankText = dynamicBank || (activeGst?.bank_name ? `Bank: ${activeGst.bank_name} | A/C: ${activeGst.bank_account_number || ""} | IFSC: ${activeGst.bank_ifsc || ""}` : "");

  // Dynamic Custom Field Value Resolver from Invoice metadata (Real data only, no mock fallbacks)
  const resolveCustomFieldValue = (f: { id: string; label: string; value: string }) => {
    const norm = f.label.toLowerCase();
    const invAny = invoice as any;
    const invMeta = invAny.metadata || invAny.custom_fields || invAny.invoice_custom_fields || {};

    if (invMeta[f.id] !== undefined && invMeta[f.id] !== "") return String(invMeta[f.id]);
    if (invMeta[f.label] !== undefined && invMeta[f.label] !== "") return String(invMeta[f.label]);

    if (norm.includes("po num") || norm.includes("po ref") || norm.includes("order no")) {
      return invAny.po_number || invAny.po_reference || invAny.purchase_order_number || (isPureMockPreview ? f.value : "");
    }
    if (norm.includes("po date")) {
      return invAny.po_date ? formatDisplayDate(invAny.po_date) : (isPureMockPreview ? f.value : "");
    }
    if (norm.includes("vehic")) {
      return invAny.vehicle_number || invAny.vehicle_no || (isPureMockPreview ? f.value : "");
    }
    if (norm.includes("eway") || norm.includes("e-way")) {
      return invAny.eway_bill_number || invAny.eway_bill_no || (isPureMockPreview ? f.value : "");
    }
    if (norm.includes("challan no") || norm.includes("dc no")) {
      return invAny.challan_number || invAny.delivery_challan || (isPureMockPreview ? f.value : "");
    }
    if (norm.includes("challan date")) {
      return invAny.challan_date ? formatDisplayDate(invAny.challan_date) : (isPureMockPreview ? f.value : "");
    }
    if (norm.includes("dispatch") || norm.includes("transporter")) {
      return invAny.dispatch_through || invAny.transporter_name || (isPureMockPreview ? f.value : "");
    }
    if (norm.includes("lr") || norm.includes("gr")) {
      return invAny.lr_number || invAny.gr_number || (isPureMockPreview ? f.value : "");
    }
    if (norm.includes("driver")) {
      return [invAny.driver_name, invAny.driver_phone].filter(Boolean).join(" - ") || (isPureMockPreview ? f.value : "");
    }
    if (norm.includes("sales exec")) {
      return invAny.sales_executive || invAny.sales_rep_name || (isPureMockPreview ? f.value : "");
    }
    if (norm.includes("terms of deliv")) {
      return invAny.terms_of_delivery || (isPureMockPreview ? f.value : "");
    }
    if (norm.includes("pay") && norm.includes("terms")) {
      return invAny.payment_terms || (isPureMockPreview ? f.value : "");
    }
    return isPureMockPreview ? f.value : "";
  };

  const enabledCols = config.columns.filter((c) => c.enabled);
  const enabledSections = [...config.sections].sort((a, b) => a.order - b.order).filter((s) => s.enabled);

  // Accent Color Helpers
  const brandPrimary = config.primaryColor || "#0f172a";
  const effectiveLogoUrl = config.logoUrl || dynamicLogoUrl;

  return (
    <div
      className="relative bg-white text-slate-900 mx-auto select-text print:p-0 print:shadow-none print:border-none print:rounded-none print:min-h-0 print:w-full print:max-w-none w-full max-w-[794px] min-h-[1123px] p-8 sm:p-10 shadow-2xl border border-slate-200/90 rounded-2xl flex flex-col justify-between"
      style={{
        fontFamily: config.fontFamily,
        fontSize: `${config.fontSizePt}pt`,
        backgroundColor: config.paperBgColor || "#ffffff",
      }}
    >
      {/* Watermark Overlay */}
      {config.watermarkText && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden"
          style={{ opacity: Math.min(config.watermarkOpacity || 0.04, 0.06) }}
        >
          <span className="text-7xl font-black uppercase tracking-widest text-slate-900 -rotate-45 whitespace-nowrap">
            {config.watermarkText}
          </span>
        </div>
      )}

      {/* Main Document Content */}
      <div className="relative z-10 space-y-5">
        {enabledSections.map((section) => {
          // ── 1. ORGANIZATION HEADER & IDENTITY ──
          if (section.id === "company_header") {
            // Header Option A: Modern Executive Gradient Banner
            if (config.headerStyle === "modern_banner") {
              return (
                <div
                  key={section.id}
                  className="rounded-2xl p-6 text-white shadow-md relative overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${brandPrimary} 0%, #0f172a 100%)`,
                  }}
                >
                  <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      {effectiveLogoUrl ? (
                        <div className="h-14 w-14 rounded-xl bg-white/95 p-1.5 shadow-md flex items-center justify-center shrink-0">
                          <img
                            src={effectiveLogoUrl}
                            alt="Logo"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0 text-white font-black text-xl">
                          {config.companyName.charAt(0)}
                        </div>
                      )}
                      <div>
                        <h1 className="font-black text-xl sm:text-2xl tracking-tight uppercase leading-tight text-white drop-shadow-sm">
                          {config.companyName}
                        </h1>
                        <p className="text-[10.5px] text-slate-200 mt-0.5 leading-relaxed max-w-md">
                          {config.companyAddress}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-200 pt-1.5 font-medium">
                          {config.companyGstin && (
                            <span className="bg-white/10 px-2 py-0.5 rounded border border-white/15 font-mono">
                              GSTIN: <strong className="text-white">{config.companyGstin}</strong>
                            </span>
                          )}
                          {config.companyPhone && (
                            <span>Tel: <strong className="text-white">{config.companyPhone}</strong></span>
                          )}
                          {config.companyEmail && (
                            <span>Email: <strong className="text-white">{config.companyEmail}</strong></span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="sm:text-right shrink-0">
                      <span className="font-black text-2xl tracking-wider uppercase block text-white drop-shadow-sm">
                        {config.invoiceTitle}
                      </span>
                      <span className="inline-block mt-1 px-2.5 py-0.5 text-[9px] font-bold tracking-widest uppercase rounded-full bg-white/15 text-white border border-white/20">
                        {invoice.copy_type || "ORIGINAL FOR RECIPIENT"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            // Header Option B: Zurich Swiss International Typographic Grid
            if (config.headerStyle === "swiss_grid") {
              return (
                <div key={section.id} className="pb-5 border-b-2 border-slate-900">
                  <div className="h-1.5 w-full mb-4 rounded-full" style={{ backgroundColor: brandPrimary }} />
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-5">
                    <div className="space-y-1.5 max-w-md">
                      <div className="flex items-center gap-3">
                        {effectiveLogoUrl ? (
                          <div className="h-12 w-12 border border-slate-300 p-1 flex items-center justify-center shrink-0">
                            <img src={effectiveLogoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                          </div>
                        ) : (
                          <div className="h-10 w-10 text-white font-black text-lg flex items-center justify-center shrink-0" style={{ backgroundColor: brandPrimary }}>
                            {config.companyName.charAt(0)}
                          </div>
                        )}
                        <div>
                          <h1 className="font-black text-2xl tracking-tighter uppercase text-slate-950 leading-none">
                            {config.companyName}
                          </h1>
                          <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest block mt-1">
                            SWISS INVOICE SPECIFICATION
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-600 leading-tight pt-1">
                        {config.companyAddress}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-[9.5px] font-mono text-slate-600">
                        {config.companyGstin && <span>TAX ID: <strong className="text-slate-900">{config.companyGstin}</strong></span>}
                        {config.companyPhone && <span>T: <strong className="text-slate-900">{config.companyPhone}</strong></span>}
                        {config.companyEmail && <span>E: <strong className="text-slate-900">{config.companyEmail}</strong></span>}
                      </div>
                    </div>

                    <div className="sm:text-right shrink-0 space-y-2">
                      <div>
                        <h2 className="font-black text-3xl tracking-tighter uppercase text-slate-950">
                          {config.invoiceTitle}
                        </h2>
                        <span className="inline-block mt-1 px-2 py-0.5 text-[8.5px] font-mono font-bold tracking-widest uppercase bg-slate-900 text-white">
                          {invoice.copy_type || "ORIGINAL FOR RECIPIENT"}
                        </span>
                      </div>
                      <div className="border border-slate-900 p-2.5 sm:min-w-[210px] text-[10px] font-mono space-y-1 text-left sm:text-right">
                        <div className="flex justify-between gap-3">
                          <span className="text-slate-500 uppercase">{config.invoiceNumberLabel || "Invoice #"}:</span>
                          <strong className="text-slate-950 font-black">{invoiceNumber}</strong>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-slate-500 uppercase">{config.invoiceDateLabel || "Date"}:</span>
                          <strong className="text-slate-900">{invoiceDate || "—"}</strong>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-slate-500 uppercase">{config.dueDateLabel || "Due"}:</span>
                          <strong className="text-slate-900">{dueDate || "—"}</strong>
                        </div>
                        <div className="flex justify-between gap-3 pt-1 border-t border-slate-200">
                          <span className="text-slate-500 uppercase">Jurisdiction:</span>
                          <strong className="text-slate-900">{placeOfSupply || `${sellerStateCode} Standard`}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // Header Option C: Tokyo Precision Technical Grid
            if (config.headerStyle === "tokyo_precision") {
              return (
                <div key={section.id} className="border-2 border-slate-900 rounded-lg overflow-hidden">
                  <div className="px-4 py-2 text-white flex items-center justify-between text-xs font-mono font-bold uppercase tracking-wider" style={{ backgroundColor: brandPrimary }}>
                    <span>{config.invoiceTitle || "OFFICIAL TAX INVOICE · COMMERCIAL SPEC"}</span>
                    <span>{invoice.copy_type || "ORIGINAL FOR RECIPIENT"}</span>
                  </div>
                  <div className="p-4 bg-slate-50/50 flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="space-y-1 max-w-md">
                      <h1 className="font-black text-xl tracking-tight text-slate-950 uppercase">
                        {config.companyName}
                      </h1>
                      <p className="text-[10px] text-slate-600 leading-snug">
                        {config.companyAddress}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[9.5px] font-mono">
                        {config.companyGstin && <span className="bg-white border border-slate-300 px-1.5 py-0.5 font-bold">GSTIN: {config.companyGstin}</span>}
                        {config.companyPhone && <span className="bg-white border border-slate-300 px-1.5 py-0.5">TEL: {config.companyPhone}</span>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[9.5px] font-mono min-w-[220px]">
                      <div className="border border-slate-300 bg-white p-1.5">
                        <span className="text-slate-400 block text-[8px] uppercase">{config.invoiceNumberLabel || "INVOICE NO"}</span>
                        <strong className="text-slate-950 font-bold">{invoiceNumber}</strong>
                      </div>
                      <div className="border border-slate-300 bg-white p-1.5">
                        <span className="text-slate-400 block text-[8px] uppercase">DATE</span>
                        <strong className="text-slate-800 font-bold">{invoiceDate || "—"}</strong>
                      </div>
                      <div className="border border-slate-300 bg-white p-1.5">
                        <span className="text-slate-400 block text-[8px] uppercase">DUE DATE</span>
                        <strong className="text-slate-800 font-bold">{dueDate || "—"}</strong>
                      </div>
                      <div className="border border-slate-300 bg-white p-1.5">
                        <span className="text-slate-400 block text-[8px] uppercase">SUPPLY PLACE</span>
                        <strong className="text-slate-800 font-bold">{placeOfSupply || `${sellerStateCode}`}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // Header Option D: Nordic Minimalist Clean Line
            if (config.headerStyle === "minimal") {
              return (
                <div key={section.id} className="pb-4 border-b border-slate-200">
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div>
                      <h1 className="font-black text-2xl tracking-tight text-slate-800">
                        {config.companyName}
                      </h1>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {config.companyAddress}
                      </p>
                      <div className="flex items-center gap-3 text-[9.5px] text-slate-500 pt-1">
                        {config.companyGstin && <span>Tax ID: <strong>{config.companyGstin}</strong></span>}
                        {config.companyPhone && <span>Phone: <strong>{config.companyPhone}</strong></span>}
                      </div>
                    </div>
                    <div className="sm:text-right space-y-1">
                      <span className="text-xs font-mono font-bold tracking-widest uppercase text-slate-400 block">
                        {invoice.copy_type || "ORIGINAL FOR RECIPIENT"}
                      </span>
                      <h2 className="font-extrabold text-2xl tracking-tight text-slate-900 uppercase">
                        {config.invoiceTitle}
                      </h2>
                      <div className="text-[10px] text-slate-600 font-mono space-y-0.5 pt-1">
                        <div>#{invoiceNumber}</div>
                        <div>Date: {invoiceDate || "—"}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // Header Option E: Centered Luxury Letterhead
            if (config.headerStyle === "centered_letterhead") {
              return (
                <div key={section.id} className="text-center pb-4 border-b-2" style={{ borderColor: brandPrimary }}>
                  {effectiveLogoUrl && (
                    <div className="flex justify-center mb-2">
                      <img src={effectiveLogoUrl} alt="Logo" className="h-12 object-contain" />
                    </div>
                  )}
                  <h1 className="font-black text-2xl sm:text-3xl uppercase tracking-tight text-slate-950">
                    {config.companyName}
                  </h1>
                  <p className="text-[10.5px] text-slate-600 max-w-lg mx-auto mt-0.5 leading-relaxed">
                    {config.companyAddress}
                  </p>
                  <div className="flex justify-center items-center flex-wrap gap-4 text-[10px] text-slate-500 mt-1.5 font-medium">
                    {config.companyGstin && (
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-800 font-mono">
                        GSTIN: <strong>{config.companyGstin}</strong>
                      </span>
                    )}
                    {config.companyPhone && <span>Phone: <strong className="text-slate-800">{config.companyPhone}</strong></span>}
                    {config.companyEmail && <span>Email: <strong className="text-slate-800">{config.companyEmail}</strong></span>}
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-200 flex justify-between items-center text-xs">
                    <span className="font-black tracking-wider uppercase text-sm" style={{ color: brandPrimary }}>
                      {config.invoiceTitle}
                    </span>
                    <span className="text-[9.5px] font-bold tracking-widest uppercase bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full border border-slate-200">
                      {invoice.copy_type || "ORIGINAL FOR RECIPIENT"}
                    </span>
                  </div>
                </div>
              );
            }

            // Header Option F: Global Standard Split Layout (Default - Stripe / Xero / QuickBooks Executive Standard)
            return (
              <div
                key={section.id}
                className="pb-5 border-b border-slate-200/90 flex flex-col sm:flex-row items-start justify-between gap-5"
              >
                {/* Left: Organization Identity */}
                <div className="space-y-1.5 max-w-md">
                  <div className="flex items-center gap-3">
                    {effectiveLogoUrl ? (
                      <div className="h-12 w-12 rounded-xl border border-slate-200/80 bg-white p-1 flex items-center justify-center shadow-xs shrink-0">
                        <img
                          src={effectiveLogoUrl}
                          alt="Logo"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div
                        className="h-10 w-10 rounded-xl text-white font-black text-lg flex items-center justify-center shrink-0 shadow-xs"
                        style={{ backgroundColor: brandPrimary }}
                      >
                        {config.companyName.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h1 className="font-black text-xl tracking-tight text-slate-900 leading-none">
                        {config.companyName}
                      </h1>
                      <span className="text-[9.5px] font-semibold text-slate-400 uppercase tracking-wider block mt-0.5">
                        {config.companyTagline || "Authorized Billing & Commercial Invoicing"}
                      </span>
                    </div>
                  </div>

                  <p className="text-[10.5px] text-slate-600 leading-relaxed pt-1">
                    {config.companyAddress}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px]">
                    {config.companyGstin && (
                      <span className="bg-slate-100/90 text-slate-800 font-mono font-bold px-2 py-0.5 rounded border border-slate-200/70">
                        GSTIN: {config.companyGstin}
                      </span>
                    )}
                    {config.companyPhone && (
                      <span className="text-slate-600">
                        Tel: <strong className="text-slate-800">{config.companyPhone}</strong>
                      </span>
                    )}
                    {config.companyEmail && (
                      <span className="text-slate-600">
                        Email: <strong className="text-slate-800">{config.companyEmail}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Document Title & Key Facts Micro-Card */}
                <div className="sm:text-right shrink-0 space-y-2">
                  <div>
                    <h2
                      className="font-black text-2xl sm:text-3xl tracking-tight uppercase"
                      style={{ color: brandPrimary }}
                    >
                      {config.invoiceTitle}
                    </h2>
                    <span className="inline-block mt-1 px-2.5 py-0.5 text-[9px] font-bold tracking-widest uppercase rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {invoice.copy_type || "ORIGINAL FOR RECIPIENT"}
                    </span>
                  </div>

                  <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-2.5 sm:min-w-[200px] text-[10.5px] space-y-1 text-left sm:text-right shadow-xs">
                    <div className="flex justify-between gap-3 items-center">
                      <span className="text-slate-400 font-semibold text-[9px] uppercase tracking-wider">
                        {config.invoiceNumberLabel || "Invoice #"}:
                      </span>
                      <strong className="font-mono font-black text-slate-900 text-xs">
                        {invoiceNumber}
                      </strong>
                    </div>
                    <div className="flex justify-between gap-3 items-center">
                      <span className="text-slate-400 font-semibold text-[9px] uppercase tracking-wider">
                        {config.invoiceDateLabel || "Date"}:
                      </span>
                      <strong className="font-bold text-slate-800">
                        {invoiceDate || "—"}
                      </strong>
                    </div>
                    <div className="flex justify-between gap-3 items-center">
                      <span className="text-slate-400 font-semibold text-[9px] uppercase tracking-wider">
                        {config.dueDateLabel || "Due Date"}:
                      </span>
                      <strong className="font-bold text-slate-800">
                        {dueDate || "—"}
                      </strong>
                    </div>
                    <div className="flex justify-between gap-3 items-center pt-1 border-t border-slate-200/80">
                      <span className="text-slate-400 font-semibold text-[9px] uppercase tracking-wider">
                        {config.placeOfSupplyLabel || "Place of Supply"}:
                      </span>
                      <strong className="font-bold text-slate-800">
                        {placeOfSupply || `${sellerStateCode} - Intra-State`}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          // ── 2. INVOICE REFERENCES STRIP (PO, E-Way, Vehicle, Challan, Custom Meta - DEDUPLICATED) ──
          if (section.id === "invoice_meta") {
            const isStandardRef = (lbl: string) => {
              const norm = (lbl || "").toLowerCase();
              return (
                norm.includes("po ref") ||
                norm.includes("po num") ||
                norm.includes("order no") ||
                norm.includes("vehic") ||
                norm.includes("eway") ||
                norm.includes("e-way") ||
                norm.includes("challan") ||
                norm.includes("dc no")
              );
            };

            const poField = config.customFields.find((f) => f.enabled && (f.label.toLowerCase().includes("po") || f.id.includes("po")));
            const vehField = config.customFields.find((f) => f.enabled && (f.label.toLowerCase().includes("veh") || f.id.includes("veh")));
            const ewayField = config.customFields.find((f) => f.enabled && (f.label.toLowerCase().includes("eway") || f.id.includes("eway")));
            const challanField = config.customFields.find((f) => f.enabled && (f.label.toLowerCase().includes("challan") || f.id.includes("challan")));

            const poVal = (invoice as any)?.po_number || (invoice as any)?.po_reference || (isPureMockPreview ? poField?.value : "") || "";
            const vehVal = (invoice as any)?.vehicle_number || (invoice as any)?.vehicle_no || (isPureMockPreview ? vehField?.value : "") || "";
            const ewayVal = (invoice as any)?.eway_bill_number || (invoice as any)?.eway_bill_no || (isPureMockPreview ? ewayField?.value : "") || "";
            const challanVal = (invoice as any)?.challan_number || (invoice as any)?.delivery_challan || (isPureMockPreview ? challanField?.value : "") || "";

            // Custom metadata fields with standard references filtered out, and ONLY fields that actually have a resolved value!
            const metaCustomFields = config.customFields
              .filter((f) => f.enabled && (f.section === "meta" || !f.section) && !isStandardRef(f.label))
              .map((f) => ({ ...f, resolvedVal: resolveCustomFieldValue(f) }))
              .filter((f) => Boolean(f.resolvedVal && f.resolvedVal.trim() !== ""));

            const hasMetaDetails = Boolean(poVal || vehVal || ewayVal || challanVal || metaCustomFields.length > 0);
            if (!hasMetaDetails) return null;

            return (
              <div
                key={section.id}
                className="bg-slate-50/70 border border-slate-200/80 rounded-xl px-4 py-3"
              >
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                  <span>Commercial & Shipment References</span>
                  <span className="font-mono text-slate-400">REF-TAG</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {poVal && (
                    <div className="space-y-0.5">
                      <span className="text-slate-400 font-bold text-[8.5px] uppercase tracking-wider block">
                        PO Reference
                      </span>
                      <strong className="font-mono font-bold text-slate-900 text-[11px] block truncate">
                        {poVal}
                      </strong>
                    </div>
                  )}

                  {vehVal && (
                    <div className="space-y-0.5">
                      <span className="text-slate-400 font-bold text-[8.5px] uppercase tracking-wider block">
                        Vehicle No
                      </span>
                      <strong className="font-mono font-bold text-slate-900 text-[11px] block truncate">
                        {vehVal}
                      </strong>
                    </div>
                  )}

                  {ewayVal && (
                    <div className="space-y-0.5">
                      <span className="text-slate-400 font-bold text-[8.5px] uppercase tracking-wider block">
                        E-Way Bill No
                      </span>
                      <strong className="font-mono font-bold text-slate-900 text-[11px] block truncate">
                        {ewayVal}
                      </strong>
                    </div>
                  )}

                  {challanVal && (
                    <div className="space-y-0.5">
                      <span className="text-slate-400 font-bold text-[8.5px] uppercase tracking-wider block">
                        Challan No
                      </span>
                      <strong className="font-mono font-bold text-slate-900 text-[11px] block truncate">
                        {challanVal}
                      </strong>
                    </div>
                  )}

                  {metaCustomFields.map((f) => (
                    <div key={f.id} className="space-y-0.5">
                      <span className="text-slate-400 font-bold text-[8.5px] uppercase tracking-wider block truncate">
                        {f.label}
                      </span>
                      <strong className="font-mono font-bold text-slate-900 text-[11px] block truncate">
                        {f.resolvedVal}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          // ── 3. BILL TO & SHIP TO DETAILS ──
          if (section.id === "party_details") {
            return (
              <div
                key={section.id}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl p-4 bg-slate-50/50 border border-slate-200/80 text-[10.5px]"
              >
                {/* Billed To (Customer) */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: brandPrimary }} />
                    <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">
                      {config.customerTitle || "Billed To (Customer):"}
                    </span>
                  </div>

                  <strong className="font-black text-slate-950 text-sm block leading-snug">
                    {customerName}
                  </strong>

                  {customerAddress && (
                    <p className="text-slate-600 leading-relaxed">{customerAddress}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1 font-medium text-[10px]">
                    {customerGstin && (
                      <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-800 font-mono font-bold">
                        GSTIN: {customerGstin}
                      </span>
                    )}
                    {customerPhone && (
                      <span className="text-slate-600">
                        Phone: <strong className="text-slate-800">{customerPhone}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Shipped To (Delivery) */}
                <div className="space-y-1.5 sm:border-l sm:border-slate-200/90 sm:pl-4">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">
                      {config.shippingTitle || "Shipped To (Delivery):"}
                    </span>
                  </div>

                  <strong className="font-black text-slate-950 text-sm block leading-snug">
                    {shippingName}
                  </strong>

                  <p className="text-slate-600 leading-relaxed">
                    {shippingAddress || customerAddress || "Same as Billing Address"}
                  </p>

                  {Boolean((invoice as any)?.dispatch_through || (invoice as any)?.transporter_name || (invoice as any)?.dispatch_mode) && (
                    <div className="text-[10px] text-slate-500 pt-1 font-medium">
                      <span>Dispatch Mode: <strong>{(invoice as any)?.dispatch_through || (invoice as any)?.transporter_name || (invoice as any)?.dispatch_mode}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // ── 4. DYNAMIC ITEMS TABLE GRID (GLOBAL BEST PRACTICE) ──
          if (section.id === "items_table") {
            return (
              <div
                key={section.id}
                className="rounded-2xl overflow-hidden border border-slate-200 shadow-xs bg-white"
              >
                <table className="w-full border-collapse text-[10.5px]">
                  {/* Table Header */}
                  <thead>
                    <tr
                      className="text-white font-bold uppercase tracking-wider text-[9.5px]"
                      style={{ backgroundColor: brandPrimary }}
                    >
                      {enabledCols.map((col) => (
                        <th
                          key={col.id}
                          style={{ width: `${col.widthPercent}%`, textAlign: col.align }}
                          className="py-3 px-3 border-r border-white/10 last:border-r-0 font-extrabold"
                        >
                          {col.headerTitle}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  {/* Table Body */}
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => (
                      <tr
                        key={idx}
                        className={idx % 2 === 1 ? "bg-slate-50/40 hover:bg-slate-100/50 transition-colors" : "bg-white hover:bg-slate-50/60 transition-colors"}
                      >
                        {enabledCols.map((col) => {
                          // S.No
                          if (col.fieldKey === "sno") {
                            return (
                              <td
                                key={col.id}
                                className="py-3 px-2 text-center text-slate-400 font-bold font-mono text-[10px]"
                              >
                                {item.sno}
                              </td>
                            );
                          }

                          // Description & Notes
                          if (col.fieldKey === "description") {
                            return (
                              <td key={col.id} className="py-3 px-3.5 text-left">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <strong className="text-slate-900 font-bold text-[11px] leading-snug">
                                    {item.description}
                                  </strong>
                                  {item.isFree && (
                                    <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      FREE ITEM
                                    </span>
                                  )}
                                </div>
                                {item.custom_note && (
                                  <span className="text-[9.5px] text-slate-500 block mt-0.5 leading-snug">
                                    {item.custom_note}
                                  </span>
                                )}
                              </td>
                            );
                          }

                          // HSN / SAC Code
                          if (col.fieldKey === "hsn") {
                            return (
                              <td
                                key={col.id}
                                className="py-3 px-2 text-center font-mono text-[9.5px] text-slate-600"
                              >
                                <span className="bg-slate-100/80 px-1.5 py-0.5 rounded border border-slate-200/50">
                                  {item.hsn}
                                </span>
                              </td>
                            );
                          }

                          // Quantity & Measuring Unit
                          if (col.fieldKey === "quantity") {
                            return (
                              <td key={col.id} className="py-3 px-2 text-center font-bold">
                                <div className="inline-flex items-center gap-1 font-mono">
                                  <span className="text-slate-900 font-extrabold text-[11px]">{item.quantity}</span>
                                  <span className="text-slate-500 font-bold text-[9px] uppercase">{item.unit}</span>
                                </div>
                              </td>
                            );
                          }

                          // Unit Price
                          if (col.fieldKey === "unit_price") {
                            return (
                              <td key={col.id} className="py-3 px-3 text-right font-mono text-[11px] text-slate-700 font-medium">
                                {item.isFree ? (
                                  <span>
                                    {Number(item.originalRate || 0) > 0 && (
                                      <span className="line-through text-slate-400 mr-1 text-[9px]">
                                        {currency.symbol}{(Number(item.originalRate) || 0).toFixed(2)}
                                      </span>
                                    )}
                                    <span className="text-emerald-700 font-bold">{currency.symbol}0.00</span>
                                  </span>
                                ) : (
                                  <span>{currency.symbol}{(Number(item.unit_price) || 0).toFixed(2)}</span>
                                )}
                              </td>
                            );
                          }

                          // Discount
                          if (col.fieldKey === "discount") {
                            return (
                              <td key={col.id} className="py-3 px-2 text-center font-mono text-[10.5px]">
                                {item.isFree ? (
                                  <span className="text-slate-300">—</span>
                                ) : Number(item.discount || 0) > 0 ? (
                                  <span className="text-emerald-600 font-semibold">
                                    -{currency.symbol}{(Number(item.discount) || 0).toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            );
                          }

                          // GST % Tax Rate
                          if (col.fieldKey === "tax_rate") {
                            return (
                              <td key={col.id} className="py-3 px-2 text-center font-medium text-slate-600 text-[10.5px]">
                                {item.isFree ? "0%" : `${Number(item.tax_rate || 0)}%`}
                              </td>
                            );
                          }

                          // Line Item Amount
                          if (col.fieldKey === "total_amount") {
                            return (
                              <td
                                key={col.id}
                                className="py-3 px-3 text-right font-black font-mono text-slate-900 text-[11.5px]"
                              >
                                {item.isFree ? (
                                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[9px]">
                                    FREE ({currency.symbol}0.00)
                                  </span>
                                ) : (
                                  <span>{currency.symbol}{(Number(item.total_amount) || 0).toFixed(2)}</span>
                                )}
                              </td>
                            );
                          }

                          // Custom Table Column Fallback
                          return (
                            <td
                              key={col.id}
                              className="py-3 px-2 text-slate-700 font-medium"
                              style={{ textAlign: col.align }}
                            >
                              {(item as any)[col.fieldKey] || "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>

                  {/* Table Footer with Total Quantity & Item Counts */}
                  <tfoot>
                    <tr className="bg-slate-100/90 font-bold border-t-2 border-slate-300 text-slate-900">
                      {enabledCols.map((col) => {
                        if (col.fieldKey === "sno") {
                          return (
                            <td key={col.id} className="py-2.5 px-2 text-center text-slate-500 font-bold text-[9px]">
                              Total
                            </td>
                          );
                        }
                        if (col.fieldKey === "description") {
                          return (
                            <td key={col.id} className="py-2.5 px-3 text-left font-black text-slate-800 text-[10.5px]">
                              Total Items: {totalItemsCount} {totalItemsCount === 1 ? "Line Item" : "Line Items"}
                            </td>
                          );
                        }
                        // TOTAL QUANTITY PROMINENT BADGE IN QTY COLUMN
                        if (col.fieldKey === "quantity") {
                          return (
                            <td key={col.id} className="py-2 px-1 text-center bg-slate-200/90">
                              <div className="inline-flex flex-col items-center">
                                <span className="text-slate-500 text-[8px] uppercase font-bold leading-none">TOTAL QTY</span>
                                <span className="text-[12px] font-mono font-black text-slate-950">{totalBilledQty}</span>
                              </div>
                            </td>
                          );
                        }
                        if (col.fieldKey === "total_amount") {
                          return (
                            <td key={col.id} className="py-2.5 px-3 text-right font-black font-mono text-slate-950 text-[11.5px]">
                              {currency.symbol}{(Number(taxableSubtotal) || 0).toFixed(2)}
                            </td>
                          );
                        }
                        return (
                          <td key={col.id} className="py-2.5 px-2 text-center text-slate-400">
                            —
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          }

          // ── 5. GST TAX SLABS MATRIX BREAKDOWN ──
          if (section.id === "tax_slabs" && config.showTaxBreakdown && gstBreakdown.slabsBreakdown.length > 0) {
            return (
              <div
                key={section.id}
                className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 text-[9.5px]"
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/80 mb-1.5">
                  <span className="font-bold text-slate-600 uppercase text-[9px] tracking-wider">
                    Tax Breakdown (GST Slabs Matrix)
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono">
                    All figures in {currency.code}
                  </span>
                </div>

                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="text-slate-400 font-bold uppercase text-[8.5px] border-b border-slate-200/60 pb-1">
                      <th className="py-1 text-left">Tax Slab</th>
                      <th className="py-1 text-right">Taxable Amount</th>
                      <th className="py-1">CGST</th>
                      <th className="py-1">SGST</th>
                      <th className="py-1">IGST</th>
                      <th className="py-1 text-right">Total Tax</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {gstBreakdown.slabsBreakdown.map((slab, sIdx) => (
                      <tr key={sIdx} className="font-mono text-slate-700 py-1">
                        <td className="py-1 text-left font-bold text-slate-900">GST {slab.rate}%</td>
                        <td className="py-1 text-right font-semibold">{currency.symbol}{(Number(slab.taxableAmount) || 0).toFixed(2)}</td>
                        <td className="py-1">{currency.symbol}{(Number(slab.cgstAmount) || 0).toFixed(2)}</td>
                        <td className="py-1">{currency.symbol}{(Number(slab.sgstAmount) || 0).toFixed(2)}</td>
                        <td className="py-1">{currency.symbol}{(Number(slab.igstAmount) || 0).toFixed(2)}</td>
                        <td className="py-1 text-right font-bold text-slate-900">{currency.symbol}{(Number(slab.totalTax) || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className="font-black border-t border-slate-300 text-slate-950 font-mono">
                      <td className="py-1 text-left font-sans font-bold">Total</td>
                      <td className="py-1 text-right">{currency.symbol}{(Number(taxableSubtotal) || 0).toFixed(2)}</td>
                      <td className="py-1">{currency.symbol}{(Number(gstBreakdown.totalCgst) || 0).toFixed(2)}</td>
                      <td className="py-1">{currency.symbol}{(Number(gstBreakdown.totalSgst) || 0).toFixed(2)}</td>
                      <td className="py-1">{currency.symbol}{(Number(gstBreakdown.totalIgst) || 0).toFixed(2)}</td>
                      <td className="py-1 text-right font-black">{currency.symbol}{(Number(totalTax) || 0).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          }

          // ── 6. SUMMARY TOTALS & AMOUNT IN WORDS ──
          if (section.id === "totals_block") {
            return (
              <div key={section.id} className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-2">
                {/* Left Column (Amount in Words & Summary Callout) */}
                <div className="md:col-span-7 space-y-3">
                  {config.showAmountInWords && (
                    <div className="bg-slate-50/80 border-l-4 border-slate-900 p-3.5 rounded-r-xl border-y border-r border-slate-200/80">
                      <span className="text-slate-400 font-bold uppercase text-[8.5px] tracking-wider block mb-0.5">
                        Total Amount in Words ({currency.code}):
                      </span>
                      <strong className="text-slate-900 text-[11px] leading-snug block italic">
                        "{numberToIndianWords(grandTotal)}"
                      </strong>
                    </div>
                  )}

                  {/* Quantity & Item Summary Chips */}
                  <div className="flex items-center gap-3 text-[10px] text-slate-600 bg-slate-50/50 p-2.5 rounded-xl border border-slate-200/80">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span>Total Billed Qty: <strong className="text-slate-900 font-mono font-bold">{totalBilledQty} Units</strong></span>
                    </div>
                    <div className="h-3 w-px bg-slate-300" />
                    <div>
                      <span>Total Items: <strong className="text-slate-900 font-bold">{totalItemsCount}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Right Column (Executive Financial Statement Card) */}
                <div className="md:col-span-5">
                  <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-2 text-[10.5px]">
                    {/* Subtotal */}
                    <div className="flex justify-between items-center text-slate-600">
                      <span className="font-medium">Taxable Subtotal:</span>
                      <span className="font-mono font-bold text-slate-800">
                        {currency.symbol}{(Number(taxableSubtotal) || 0).toFixed(2)}
                      </span>
                    </div>

                    {/* Discount */}
                    {Number(totalDiscount || 0) > 0 && (
                      <div className="flex justify-between items-center text-emerald-600">
                        <span className="font-medium">Discount Applied:</span>
                        <span className="font-mono font-bold">
                          -{currency.symbol}{(Number(totalDiscount) || 0).toFixed(2)}
                        </span>
                      </div>
                    )}

                    {/* Tax */}
                    <div className="flex justify-between items-center text-slate-600">
                      <span className="font-medium">Total GST / Tax:</span>
                      <span className="font-mono font-bold text-slate-800">
                        {currency.symbol}{(Number(totalTax) || 0).toFixed(2)}
                      </span>
                    </div>

                    {/* Round Off */}
                    {Number(roundOff || 0) !== 0 && (
                      <div className="flex justify-between items-center text-slate-500 text-[10px]">
                        <span>Round Off:</span>
                        <span className="font-mono">
                          {Number(roundOff || 0) >= 0 ? "+" : ""}{currency.symbol}{(Number(roundOff) || 0).toFixed(2)}
                        </span>
                      </div>
                    )}

                    {/* Total Quantity Row */}
                    <div className="flex justify-between items-center pt-1 border-t border-slate-200/80 text-[10px] text-slate-700">
                      <span>Total Billed Qty:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {totalBilledQty} {totalBilledQty === 1 ? "Unit" : "Units"}
                      </span>
                    </div>

                    {/* Grand Total Banner */}
                    <div
                      className="rounded-xl p-3 text-white flex justify-between items-center shadow-xs mt-2"
                      style={{ backgroundColor: brandPrimary }}
                    >
                      <span className="font-bold text-xs uppercase tracking-wider">
                        Total Amount Due:
                      </span>
                      <span className="font-mono font-black text-base sm:text-lg">
                        {currency.symbol}{(Number(grandTotal) || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          // ── 7. UPI QR CODE & BANK PAYMENT DETAILS ──
          if (section.id === "bank_qr_block" && config.showPaymentQr) {
            return (
              <div
                key={section.id}
                className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 bg-slate-50/50 text-[10px]"
              >
                <div className="space-y-1 max-w-sm">
                  <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider block">
                    Remittance & Bank Transfer Details
                  </span>
                  <p className="text-slate-800 font-mono leading-relaxed font-medium">
                    {resolvedBankText || "Bank transfer details available upon request"}
                  </p>
                  {activeGst?.upi_vpa && (
                    <span className="text-slate-500 block font-mono text-[9.5px]">
                      UPI VPA: <strong className="text-slate-800">{activeGst.upi_vpa}</strong>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3.5 bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-xs shrink-0">
                  <img
                    src={generateQRCodeSVG(
                      buildUpiPayUrl({
                        vpa: activeGst?.upi_vpa || "merchant@upi",
                        payeeName: config.companyName || "Merchant",
                        amount: grandTotal,
                        invoiceNumber: invoiceNumber,
                      }),
                      88
                    )}
                    alt="Scan & Pay UPI"
                    className="w-16 h-16 object-contain"
                  />
                  <div className="text-left text-[9px] space-y-0.5">
                    <span className="font-bold text-slate-900 block flex items-center gap-1">
                      ⚡ Instant UPI Payment
                    </span>
                    <span className="text-slate-500 block">Scan using any UPI App</span>
                    <div className="flex items-center gap-1.5 text-[8px] font-bold text-slate-400 pt-0.5">
                      <span>GPay</span> • <span>PhonePe</span> • <span>Paytm</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          // ── 8. TERMS & CONDITIONS AND DECLARATIONS ──
          if (section.id === "terms_block") {
            return (
              <div
                key={section.id}
                className="border-t border-slate-200 pt-3 text-[9.5px] text-slate-500 leading-relaxed space-y-1"
              >
                <strong className="text-slate-800 uppercase text-[9px] tracking-wider block">
                  Terms & Conditions & Legal Declaration:
                </strong>
                <p className="whitespace-pre-line leading-relaxed text-slate-600">
                  {config.termsText}
                </p>
              </div>
            );
          }

          // ── 9. AUTHORIZED SIGNATORY & OFFICIAL STAMP ──
          if (section.id === "signature_block") {
            const alignClass =
              config.signatureConfig.alignment === "left"
                ? "justify-start text-left"
                : config.signatureConfig.alignment === "center"
                ? "justify-center text-center"
                : "justify-end text-right";

            return (
              <div key={section.id} className={`pt-4 border-t border-slate-200/80 flex ${alignClass}`}>
                <div className="inline-flex flex-col items-center min-w-[210px] text-center p-2">
                  <span className="text-[10px] font-bold text-slate-700 block mb-1">
                    {config.signatureConfig.companyName || `For ${config.companyName}`}
                  </span>

                  {/* Stamp & Signature Composite Box */}
                  <div className="h-16 flex items-center justify-center relative w-full my-1">
                    {config.signatureConfig.showStamp && config.signatureConfig.stampUrl && (
                      <img
                        src={config.signatureConfig.stampUrl}
                        alt="Stamp"
                        className="absolute h-16 w-16 object-contain opacity-85 rotate-[-8deg] pointer-events-none"
                      />
                    )}
                    {config.signatureConfig.showSignature && config.signatureConfig.signatureUrl ? (
                      <img
                        src={config.signatureConfig.signatureUrl}
                        alt="Signature"
                        className="h-12 max-w-[140px] object-contain relative z-10"
                      />
                    ) : (
                      <span className="text-[9.5px] text-slate-400 italic">Digitally Signed & Validated</span>
                    )}
                  </div>

                  <div className="w-40 border-t border-slate-400 pt-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-800 block">
                      {config.signatureConfig.title || "Authorized Signatory"}
                    </span>
                  </div>
                </div>
              </div>
            );
          }

          return null;
        })}
      </div>

      {/* Clean Global Footer Note */}
      {config.footerNote && (
        <div className="text-center text-[9px] text-slate-400 border-t border-slate-200 pt-3 mt-6 tracking-wide">
          {config.footerNote}
        </div>
      )}
    </div>
  );
}
