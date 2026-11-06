import React from "react";
import { useI18n } from "@/contexts/i18n-context";
import type { FullInvoiceData } from "../FullInvoicePrinter";
import { numberToIndianWords } from "@/lib/number-to-words";
import { formatDisplayDate, isInvoiceLineFree, formatPartyAddress } from "@/lib/utils";
import { getOrgSignatureSettings, getActiveBillingGst } from "@/lib/receipt-template-store";
import {
  resolveInvoiceTexts,
  docTitleFor,
  docNoLabelFor,
  docDateLabelFor,
  type InvoiceTexts,
  resolveTemplateColumns,
  type NormalizedTemplateColumn,
  cellValueForColumn,
  resolveCustomFieldRows,
  type PartyLayoutType,
} from "@/lib/invoice-template-config";
import { generateQRCodeSVG } from "@/lib/qr-generator";
import { PaymentQrBlock, type PaymentQrContext } from "./PaymentQrBlock";
import { CustomerExtrasBlock } from "./CustomerExtrasBlock";

interface TemplateProps {
  invoice: FullInvoiceData;
  dynamicStoreName: string;
  dynamicLogoUrl: string;
  dynamicAddress: string;
  dynamicPhone: string;
  dynamicEmail?: string;
  sellerGstin: string;
  sellerStateCode?: string;
  dynamicBank?: string;
  currency: { symbol: string; code: string };
  f?: any;
  texts?: InvoiceTexts;
  paymentQr?: PaymentQrContext;
  template?: any;
  partyLayout?: PartyLayoutType;
  paperSize?: "A4" | "A5";
  orientation?: "portrait" | "landscape";
  columns?: any[];
  customFields?: any[];
}

/**
 * GST-Tally / myBillBook "Advanced GST" style invoice template.
 * Fully responsive to both A4 and A5 paper sizes (portrait & landscape)
 * driven by user selection in the print modal and template designer.
 */
export function GstTallyTemplate({
  invoice,
  dynamicStoreName,
  dynamicLogoUrl,
  dynamicAddress,
  dynamicPhone,
  dynamicEmail,
  sellerGstin,
  sellerStateCode,
  dynamicBank,
  currency,
  f = {},
  texts,
  paymentQr,
  template,
  partyLayout,
  paperSize = "A4",
  orientation = "portrait",
  columns,
  customFields,
}: TemplateProps) {
  const { t } = useI18n();
  const texts_ = texts || resolveInvoiceTexts(template, "gst_tally");
  const templateColumns: NormalizedTemplateColumn[] = resolveTemplateColumns(template, columns, f, texts_);
  const extraCustomFields = (customFields || template?.customFields || template?.wordConfig?.customFields || (invoice as any).customFieldsList || [])
    .filter((cf: any) => cf.enabled !== false && !["cf_po", "cf_veh", "cf_eway", "cf_challan"].includes(cf.id) && Boolean(cf.label && (cf.value || cf.defaultValue)));
  const isA5 = paperSize === "A5";
  const isLandscape = orientation === "landscape";
  const items = invoice.items || [];

  const sigSettings = getOrgSignatureSettings() as any;
  const activeGst = getActiveBillingGst() as any;
  const signatureUrl =
    sigSettings.showDigitalSignature !== false && sigSettings.show_digital_signature !== false
      ? sigSettings.signatureUrl || sigSettings.signature_url || activeGst?.signature_url
      : null;
  const stampUrl =
    sigSettings.showDigitalStamp !== false && sigSettings.show_digital_stamp !== false
      ? sigSettings.stampUrl || sigSettings.stamp_url || activeGst?.stamp_url
      : null;
  const sigTitle =
    sigSettings.signatureTitle || sigSettings.signature_title || activeGst?.signature_title || "Authorised Signatory";
  const sigCompany = sigSettings.signatureCompanyName || sigSettings.signature_company_name || dynamicStoreName;

  // ── Totals (prefer computed values on the invoice, else derive from items) ──
  const grandTotal = Number(invoice.grand_total || invoice.total_amount || 0);
  const subtotalBase = Number(invoice.subtotal ?? invoice.taxable_value ?? 0);
  const discountAmount = Number(invoice.discount_amount || 0);
  const taxableValue = Number(
    invoice.taxable_value || (subtotalBase ? subtotalBase - discountAmount : Math.max(grandTotal - (Number(invoice.tax_amount) || 0), 0))
  );
  const cgstAmount = Number(invoice.cgst_amount || 0);
  const sgstAmount = Number(invoice.sgst_amount || 0);
  const igstAmount = Number(invoice.igst_amount || 0);
  const totalTax = Number(invoice.tax_amount || cgstAmount + sgstAmount + igstAmount || 0);
  const totalDiscount = Number(
    invoice.total_discount !== undefined
      ? invoice.total_discount
      : items.reduce((acc: number, it: any) => acc + (Number(it.discount_value) || 0), discountAmount)
  );

  // Derive GST slabs from items when the invoice does not pre-compute them
  const slabs: any[] = Array.isArray(invoice.tax_slabs) ? (invoice.tax_slabs as any[]) : [];
  const isInter = Boolean(invoice.is_interstate || igstAmount > 0);
  const slabMap = new Map<number, { rate: number; hsn?: string; taxable: number; cgst: number; sgst: number; igst: number; tax: number; _hsns?: string[] }>();
  if (slabs.length > 0) {
    slabs.forEach((s) => {
      const rate = Number(s.rate ?? s.gst_rate ?? 0);
      slabMap.set(rate, { rate, hsn: s.hsn || s.hsn_code || "", taxable: Number(s.taxable ?? s.taxable_value ?? 0), cgst: Number(s.cgst ?? 0), sgst: Number(s.sgst ?? 0), igst: Number(s.igst ?? 0), tax: Number(s.tax ?? s.total_tax ?? (Number(s.cgst ?? 0) + Number(s.sgst ?? 0) + Number(s.igst ?? 0))) });
    });
  } else {
    items.forEach((item: any) => {
      const qty = Number(item.quantity || 0);
      const rate = Number(item.tax_rate ?? 0);
      const disc = Number(item.discount_value || 0);
      const hsn = String(item.hsn_code || item.hsn || "").trim();
      const taxableLine = item.is_tax_inclusive
        ? (qty * Number(item.unit_price || 0) - disc) / (1 + rate / 100)
        : (qty * Number(item.unit_price || 0) - disc);
      const lineTax = (taxableLine * rate) / 100;
      const halfTax = lineTax / 2;
      const row = slabMap.get(rate) || { rate, hsn: "", taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0, _hsns: [] };
      row.taxable += taxableLine;
      if (hsn) {
        if (!row._hsns) row._hsns = [];
        if (!row._hsns.includes(hsn)) {
          row._hsns.push(hsn);
          if (row._hsns.length <= 5) {
            row.hsn = row._hsns.join(", ");
          } else {
            row.hsn = `${row._hsns.slice(0, 5).join(", ")}... (+${row._hsns.length - 5} more)`;
          }
        }
      }
      if (isInter) {
        row.igst += lineTax;
        row.tax += lineTax;
      } else {
        row.cgst += halfTax;
        row.sgst += halfTax;
        row.tax += lineTax;
      }
      slabMap.set(rate, row);
    });
    if (slabMap.size === 0 && taxableValue > 0) {
      slabMap.set(0, { rate: 0, taxable: taxableValue, cgst: 0, sgst: 0, igst: 0, tax: totalTax });
    }
  }
  const slabRows = Array.from(slabMap.values()).sort((a, b) => b.rate - a.rate);

  const resolvedSplitPayments: { method: string; amount: number; reference?: string }[] = (() => {
    let raw = invoice.split_payments_details || invoice.split_payments || (invoice as any).splitPayments;
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch { raw = null; }
    }
    if (Array.isArray(raw)) {
      return raw.map((item: any) => ({
        method: item.method || item.payment_method || item.name || "Payment",
        amount: Number(item.amount) || 0,
        reference: item.reference || item.ref || item.note || "",
      })).filter(s => s.amount > 0);
    }
    if (raw && typeof raw === "object") {
      return Object.entries(raw).map(([method, amount]) => ({
        method,
        amount: Number(amount) || 0,
      })).filter(s => s.amount > 0);
    }
    if (Array.isArray((invoice as any).payments) && (invoice as any).payments.length > 0) {
      return (invoice as any).payments.map((p: any) => ({
        method: p.payment_method || p.method || "Payment",
        amount: Number(p.amount) || 0,
        reference: p.reference_number || p.transaction_id || p.reference || "",
      })).filter((s: any) => s.amount > 0);
    }
    return [];
  })();

  const roundedTotal = Math.round(grandTotal);
  const roundOff = Math.round(grandTotal * 100) / 100 - grandTotal;
  const amountReceived = Number(invoice.amount_received ?? 0);
  const balanceDue = Number(invoice.balance_due ?? Math.max(grandTotal - amountReceived, 0));
  const isFullyPaid = amountReceived > 0 && balanceDue <= 0.009;

  const partyPreviousBalance = Number(invoice.party_previous_balance ?? 0);
  const partyCurrentBalance = Number(invoice.party_current_balance ?? (partyPreviousBalance + balanceDue));

  const currSymbol = typeof currency === "object" && currency ? currency.symbol : typeof currency === "string" ? currency : "₹";
  const currCode = typeof currency === "object" && currency?.code ? currency.code : "INR";
  const fmt = (n: number) =>
    currSymbol + (isNaN(n) ? "0.00" : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

  // Resolve party layout (priority: prop > template.partyLayout > template.party?.layout > default "layout_1")
  const activePartyLayout: PartyLayoutType =
    partyLayout ||
    template?.partyLayout ||
    template?.party?.layout ||
    "layout_1";
  const isLayout2 = activePartyLayout === "layout_2";

  // Granular party field toggles & section configuration
  const partyCfg = template?.party;
  const billToCfg = partyCfg?.billTo;
  const shipToCfg = partyCfg?.shipTo;

  const showBillTo = f.showBillTo !== false && f.showCustomerDetails !== false && billToCfg?.showCompanyName !== false;
  const showShipTo = f.showShipTo !== false && shipToCfg?.showShippingAddress !== false;
  const showPartyPhone = f.showCustomerPhone !== false && f.showPartyPhone !== false && billToCfg?.showPhone !== false;
  const showPartyEmail = f.showCustomerEmail !== false && billToCfg?.showEmail !== false;
  const showPartyGstin = f.showCustomerGstin !== false && f.showPartyGstin !== false && billToCfg?.showGstin !== false;
  const showPartyPan = f.showCustomerPan !== false && f.showPartyPan !== false && billToCfg?.showPan !== false;
  const showPartyDl = f.showDlNumber !== false && f.showPartyDl !== false && f.showCustomerDl !== false && billToCfg?.showDlNumber !== false;
  const showPartyBalance = f.showPartyBalance !== false && billToCfg?.showPartyBalance !== false;
  const showPreviousBalance = f.showPreviousBalance !== false && showPartyBalance;
  const showCurrentBalance = f.showCurrentBalance !== false && showPartyBalance;
  const showContactPerson = f.showContactPerson !== false && billToCfg?.showContactPerson !== false;

  const showItemIndex = f.showItemIndex !== false;
  const showHsn = f.showHSN !== false;
  const showBatch = f.showBatchNumber !== false && (f as any).showBatch !== false;
  const showMfgExp = f.showExpMfgDates !== false && (f as any).showMfgExpDate !== false;
  const showUom = f.showSecondaryUnit !== false && (f as any).showUOM !== false && (f as any).showUom !== false;
  const showQty = f.showItemQty !== false && (f as any).showQuantity !== false;
  const showRate = f.showItemRate !== false && (f as any).showRate !== false;
  const showGstRateCol = f.showGstRateCol !== false && (f as any).showTaxRate !== false;
  const showDiscCol = f.showDiscountCol !== false && (f as any).showDiscount !== false;
  const showAmount = f.showItemAmount !== false;
  const showTaxSplit = f.showTaxSplit !== false;
  const showBank = f.showBankDetails !== false;
  const showPo = f.showPoNumber !== false;
  const showVeh = f.showVehicleNumber !== false;
  const showEway = f.showEwayBill !== false;
  const showChallan = f.showChallanNumber !== false;
  const showPos = f.showPlaceOfSupply !== false;

  // Resolved party details from invoice
  const customerName = invoice.customerName || invoice.customerCompany || "CASH CUSTOMER";
  const contactPerson = invoice.contactPerson || (invoice as any).contact_person || (invoice as any).customerContactPerson;
  const billingAddress = formatPartyAddress(invoice.customerBillingAddress || invoice.customerAddress);
  const rawShippingAddress = formatPartyAddress(invoice.customerShippingAddress || (invoice as any).shipping_address || (invoice as any).shippingAddress);
  const isShippingEmpty = !rawShippingAddress || rawShippingAddress === billingAddress;
  const shippingAddress = isShippingEmpty ? (billingAddress ? "Same as Billing Address" : "-") : rawShippingAddress;
  const consigneeName = invoice.consigneeName || (invoice as any).consignee_name || (invoice as any).shippingName || (invoice as any).shipping_name || customerName;
  const customerPhone = invoice.customerPhone || invoice.customerMobile || (invoice as any).customer_phone || (invoice as any).customer_mobile;
  const shippingPhone = (invoice as any).shippingPhone || (invoice as any).shipping_phone || (invoice as any).consignee_phone || customerPhone;
  const customerEmail = invoice.customerEmail || (invoice as any).customer_email;
  const customerGstin = invoice.customerGST || invoice.customerGstin || (invoice as any).customer_gstin;
  const shippingGstin = (invoice as any).shippingGST || (invoice as any).shipping_gstin || (invoice as any).consignee_gstin || customerGstin;
  const customerPan = invoice.customerPan || (invoice as any).customer_pan;
  const customerDl = (invoice as any).customerDlNumber || (invoice as any).customer_dl_number || (invoice as any).dl_number || (invoice as any).dlNumber || (invoice as any).drug_license_no || (invoice as any).drugLicenseNo;

  const billToTitle = texts_.partyTitle || billToCfg?.sectionTitle || t("Billed To", "Billed To");
  const shipToTitle = texts_.shipToTitle || shipToCfg?.sectionTitle || t("Shipped To", "Shipped To");

  // Theme colors & styling resolution
  const primaryColor =
    template?.primaryColor ||
    template?.style?.primaryColor ||
    "#0f172a";
  const secondaryColor =
    template?.secondaryColor ||
    template?.style?.secondaryColor ||
    "#4f46e5";
  const paperBgColor =
    template?.paperBgColor ||
    template?.style?.paperBgColor ||
    "#ffffff";
  const isCustomPrimary =
    Boolean(primaryColor && primaryColor !== "#0f172a" && primaryColor !== "#000000");

  const tableStyling = template?.itemTable?.styling || {};
  const tableHeaderBg =
    tableStyling.headerBgColor ||
    (isCustomPrimary ? `${primaryColor}14` : "#f1f5f9");
  const tableHeaderTextColor =
    tableStyling.headerTextColor ||
    (isCustomPrimary ? primaryColor : "#0f172a");
  const showZebra = tableStyling.showZebraStripes ?? false;
  const showVerticalBorders = tableStyling.showVerticalBorders ?? true;

  // Business header custom fields (FSSAI, Drug Lic, MSME, Tagline)
  const businessCustomRows = (
    (template?.business?.customFields as any[]) ||
    extraCustomFields.filter((cf: any) => cf.section === "business" || cf.section === "header") ||
    []
  ).filter((cf: any) => cf.enabled !== false && Boolean(cf.label && (cf.value || cf.defaultValue)))
   .map((cf: any) => ({
      label: String(cf.label || cf.name),
      value: String(cf.value || cf.defaultValue || ""),
   }));

  // Structured Bank Details Resolution
  const bankInfo = (() => {
    const mb = template?.miscellaneous?.bankDetails;
    const bName = mb?.bankName || template?.bankName || activeGst?.bank_name || "";
    const accNo = mb?.accountNumber || template?.accountNumber || activeGst?.bank_account_no || activeGst?.account_no || "";
    const ifsc = mb?.ifscCode || template?.ifscCode || activeGst?.bank_ifsc || activeGst?.ifsc_code || "";
    const branch = mb?.branch || mb?.branchName || template?.branchName || template?.branch || activeGst?.bank_branch || activeGst?.branch || "";
    const holder = mb?.accountHolderName || mb?.accountHolder || template?.accountHolder || template?.accountHolderName || activeGst?.bank_account_holder || activeGst?.account_holder || "";
    const rawString = dynamicBank || template?.bankDetails || activeGst?.bank_details || "";

    const hasStructured = Boolean(bName || accNo || ifsc);
    const hasAnyBank = hasStructured || Boolean(rawString);
    const isEnabled = (f.showBankDetails !== false) && (mb?.enabled !== false);

    return {
      isEnabled,
      hasAnyBank,
      hasStructured,
      bankName: bName,
      accountNumber: accNo,
      ifscCode: ifsc,
      branchName: branch,
      accountHolder: holder,
      rawString,
    };
  })();

  // UPI Payment QR Code Resolution
  const effectivePaymentQr: PaymentQrContext | null = React.useMemo(() => {
    if (paymentQr && paymentQr.src) return paymentQr;
    const qrCfg = template?.miscellaneous?.paymentQr;
    const isEnabled = (paymentQr?.enabled !== false) && (f.showQR !== false) && (qrCfg?.enabled !== false);
    const upiId = (qrCfg?.upiId || template?.upiId || "").trim();
    if (!isEnabled || !upiId) return paymentQr || null;

    const payee = qrCfg?.payeeName || template?.payeeName || dynamicStoreName || "Store Merchant";
    const customImg = qrCfg?.qrType === "custom_image" ? qrCfg?.customImageUrl : null;
    const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payee)}&am=${grandTotal.toFixed(2)}&cu=INR`;
    const src = customImg || generateQRCodeSVG(upiUrl, 160);

    return {
      enabled: true,
      src,
      vpa: upiId,
      targetAmount: grandTotal,
      balanceDue,
      isPaidInFull: isFullyPaid,
    };
  }, [paymentQr, template, f.showQR, dynamicStoreName, grandTotal, balanceDue, isFullyPaid]);

  // Freeform / dispatch rows from the template config (rendered in the meta area)
  const customRows = resolveCustomFieldRows(template, invoice, f);

  // Compact mode for invoices with >= 9 items to ensure single-page fit
  const isCompactItems = items.length >= 9;
  const minRows = isA5 ? (isLandscape ? 4 : 6) : (isLandscape ? 6 : (isCompactItems ? 0 : 8));
  const fillerCount = isCompactItems ? 0 : Math.max(0, minRows - items.length);

  // Item-table columns: user's explicit template columns win; otherwise the
  // fields-toggle standard set. A5 keeps its compact column set (Mfg/Exp hidden).
  const tableCols: NormalizedTemplateColumn[] = isA5
    ? templateColumns.filter((c) => c.fieldKey !== "expiry_date")
    : templateColumns;
  const colAlignClass = (col: NormalizedTemplateColumn) =>
    col.align === "left" ? "text-left" : col.align === "right" ? "text-right" : "text-center";
  const colWidthStyle = (col: NormalizedTemplateColumn) =>
    col.widthPercent ? { width: col.widthPercent + "%" } : undefined;

  // Per-item cell renderer: keeps the theme's rich compound rendering for the
  // standard fieldKeys it originally had (S.No, Description sub-lines, MRP,
  // Amount w/ currency), and falls back to the generic value resolver for
  // custom / user-defined columns.
  const renderGstTallyItemCell = (
    col: NormalizedTemplateColumn,
    item: any,
    idx: number,
    lineAmount: number,
    freeLine: boolean,
    desc: string,
    mrp: number
  ): React.ReactNode => {
    switch (col.fieldKey) {
      case "sno":
        return <span className="font-sans">{idx + 1}</span>;
      case "description":
        return (
          <>
            <span className={`font-sans font-bold ${isA5 ? "text-[8px]" : "text-[10px]"}`}>
              {item.product_name || item.name || "-"}
              {freeLine && <span className="font-black text-red-600"> (FREE)</span>}
            </span>
            {f.showItemDescription !== false && desc ? (
              <span className={`block ${isA5 ? "text-[7px]" : "text-[9px]"} font-normal text-gray-600 leading-snug mt-0.5`}>{desc}</span>
            ) : null}
            {mrp > 0 && f.showMRP !== false ? (
              <span className={`block ${isA5 ? "text-[6.5px]" : "text-[8.5px]"} font-normal text-gray-500`}>MRP {fmt(mrp)}</span>
            ) : null}
          </>
        );
      case "total_amount":
        return fmt(lineAmount);
      case "tax_rate":
        return `${Number(item.tax_rate ?? 0)}%`;
      case "expiry_date":
        return [item.mfg_date, item.exp_date].filter(Boolean).join(" / ") || "-";
      case "uom":
        return item.selected_uom || item.uom || item.measuring_unit || "PCS";
      default:
        return cellValueForColumn(col, item, invoice).text;
    }
  };

  // Responsive styling tokens - tuned for optimal single-page packing for <=16 items
  const baseTextClass = isA5 ? "text-[8px] leading-tight p-1.5" : (isCompactItems ? "text-[9px] leading-tight p-1.5" : "text-[10px] sm:text-[10.5px] leading-snug p-2 sm:p-3");
  const borderBoxClass = isA5 ? "border border-black/80" : "border-2 border-black";
  const dividerBorderClass = isA5 ? "border-black/60" : "border-black";
  const headerPadClass = isA5 ? "p-1" : (isCompactItems ? "p-1" : "p-1.5 sm:p-2");
  const logoHClass = isA5 ? "h-6 max-w-[65px]" : (isCompactItems ? "h-7 max-w-[80px]" : "h-9 max-w-[95px]");
  const storeNameClass = isA5 ? "text-[10.5px] font-black leading-tight" : (isCompactItems ? "text-xs font-black leading-tight" : "text-sm sm:text-base font-black leading-tight");
  const subTextClass = isA5 ? "text-[7px] leading-tight" : (isCompactItems ? "text-[8px] leading-tight" : "text-[9px] sm:text-[9.5px] leading-tight");
  const docTitleClass = isA5 ? "text-[11px] font-black tracking-wider" : (isCompactItems ? "text-xs font-black tracking-wider" : "text-sm sm:text-base font-black tracking-wider");
  const copyBadgeClass = isA5 ? "text-[6.5px] font-bold px-1 py-0.5" : "text-[8px] font-extrabold px-1.5 py-0.5";
  const metaCellPad = isA5 ? "p-0.5" : (isCompactItems ? "py-0.5 px-1 text-[8.5px]" : "py-0.5 px-1.5");
  const tableHeadClass = isA5 ? "py-1 px-1 text-[8px] font-bold" : (isCompactItems ? "py-1 px-1 text-[8.5px] font-black" : "py-1.5 px-1.5 text-[10px] font-black");
  const tableCellPad = isA5 ? "px-1 py-[1.5px]" : (isCompactItems ? "px-1 py-[2px] text-[8.5px]" : "px-1.5 py-1");
  const tableTextClass = isA5 ? "text-[8px]" : (isCompactItems ? "text-[8.5px]" : "text-[10px]");
  const fillerRowHeight = isA5 ? "h-4" : (isCompactItems ? "h-3.5" : "h-5");
  // Full-page sheet: stretches to the printable page height (mm = print-physical,
  // matches @page exactly) with the footer pinned to the bottom. Page heights
  // minus @page margins: A4 297-8=289mm, A4-land 210-8=202mm, A5 210-5=205mm,
  // A5-land 148-5=143mm. `tpl-sheet-full` exempts this from the print rule that
  // zeroes min-heights (that rule is what used to shrink every sheet to ~75%).
  const sheetMinH = isA5
    ? (isLandscape ? "min-h-[143mm]" : "min-h-[205mm]")
    : (isLandscape ? "min-h-[202mm]" : "min-h-[289mm]");

  return (
    <div
      className={`w-full bg-white text-black ${baseTextClass} font-sans ${borderBoxClass} block print:p-0 flex flex-col tpl-sheet-full ${sheetMinH}`}
      style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
    >
      <div className="flex-1 flex flex-col min-w-0">
        {/* ─── TOP HEADER ROW (2-Box for Layout 1 & 3, 3-Box Split for Layout 2) ─── */}
        <div className={`grid grid-cols-12 border-b-2 ${dividerBorderClass}`}>
          {/* Seller / Company Box */}
          {f.showCompanyDetails !== false && (
            <div
              className={`${
                isLayout2
                  ? f.showInvoiceDetails !== false && (showBillTo || showShipTo)
                    ? "col-span-4 border-r-2"
                    : f.showInvoiceDetails === false && (showBillTo || showShipTo) === false
                      ? "col-span-12"
                      : "col-span-6 border-r-2"
                  : f.showInvoiceDetails !== false
                    ? "col-span-6 border-r-2"
                    : "col-span-12"
              } ${dividerBorderClass} ${headerPadClass} flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {f.showLogo !== false && dynamicLogoUrl && dynamicLogoUrl !== "/Logo.png" && (
                    <img
                      src={dynamicLogoUrl}
                      alt="Logo"
                      className={`${logoHClass} object-contain`}
                      onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                    />
                  )}
                  <div className="min-w-0">
                    <h2
                      className={`${storeNameClass} uppercase tracking-tight text-slate-900`}
                      style={{ color: isCustomPrimary ? primaryColor : undefined }}
                    >
                      {dynamicStoreName}
                    </h2>
                    <p className={`${subTextClass} text-gray-700 mt-0.5`}>{dynamicAddress}</p>
                  </div>
                </div>
                <div className={`${subTextClass} text-gray-800 space-y-0.5 mt-1`}>
                  {dynamicPhone && <p><span className="font-semibold">Ph:</span> {dynamicPhone}</p>}
                  {dynamicEmail && f.showEmail !== false && <p><span className="font-semibold">Mail:</span> {dynamicEmail}</p>}
                </div>
              </div>
              <div className={`mt-2 pt-1 border-t border-gray-300 ${subTextClass} space-y-0.5`}>
                <p className="font-bold">
                  GSTIN : <span className="font-mono font-black text-slate-900">{sellerGstin || "-"}</span>
                </p>
                {(activeGst?.pan || (invoice as any).seller_pan) && (
                  <p>
                    PAN : <span className="font-mono">{(invoice as any).seller_pan || activeGst?.pan}</span>
                  </p>
                )}
                {(activeGst?.cin || (invoice as any).seller_cin) && (
                  <p>
                    CIN : <span className="font-mono">{(invoice as any).seller_cin || activeGst?.cin}</span>
                  </p>
                )}
                {businessCustomRows.length > 0 && (
                  <div className="pt-0.5 space-y-0.5 border-t border-gray-200">
                    {businessCustomRows.map((bcf, bIdx) => (
                      <p key={bIdx} className="font-semibold text-gray-800">
                        {bcf.label} : <span className="font-mono font-bold text-slate-900">{bcf.value}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Invoice Metadata Box (Center in Layout 2, Right in Layout 1 & 3) */}
          {f.showInvoiceDetails !== false && (
            <div
              className={`${
                isLayout2
                  ? f.showCompanyDetails !== false && (showBillTo || showShipTo)
                    ? "col-span-4 border-r-2"
                    : f.showCompanyDetails === false && (showBillTo || showShipTo) === false
                      ? "col-span-12"
                      : "col-span-6"
                  : f.showCompanyDetails !== false
                    ? "col-span-6"
                    : "col-span-12"
              } ${dividerBorderClass} ${headerPadClass} flex flex-col justify-between text-center bg-black/[0.03]`}
            >
              <div>
                <h1
                  className={`${docTitleClass} uppercase`}
                  style={{ color: isCustomPrimary ? primaryColor : undefined }}
                >
                  {docTitleFor(invoice, texts_, template)}
                </h1>
                <span
                  className={`${copyBadgeClass} uppercase tracking-wider block mb-1 border rounded inline-block`}
                  style={{
                    borderColor: isCustomPrimary ? `${primaryColor}60` : undefined,
                    color: isCustomPrimary ? primaryColor : undefined,
                    backgroundColor: isCustomPrimary ? `${primaryColor}10` : undefined,
                  }}
                >
                  {invoice.copy_type || texts_.copyTag}
                </span>
              </div>

              <table className={`w-full text-left ${tableTextClass} border border-black border-collapse bg-transparent font-mono`}>
                <tbody>
                  <tr className="border-b border-black/40">
                    <td className={`${metaCellPad} font-sans font-bold border-r border-black/40 w-[38%]`}>
                      {docNoLabelFor(invoice, texts_)}
                    </td>
                    <td className={`${metaCellPad} font-bold border-r border-black/40`}>
                      {invoice.invoice_number || "-"}
                    </td>
                    <td className={`${metaCellPad} font-sans font-bold border-r border-black/40 w-[24%]`}>{docDateLabelFor(invoice, texts_)}</td>
                    <td className={`${metaCellPad} font-bold`}>{formatDisplayDate(invoice.invoice_date || invoice.created_at || new Date())}</td>
                  </tr>
                  {(showPo || showChallan) && (
                    <tr className="border-b border-black/40">
                      {showPo && (
                        <>
                          <td className={`${metaCellPad} font-sans font-bold border-r border-black/40 w-[38%]`}>{texts_.poNumberLabel}</td>
                          <td className={`${metaCellPad} font-bold ${showChallan ? "border-r border-black/40" : ""}`} colSpan={showChallan ? 1 : 3}>
                            {invoice.po_number || invoice.po_reference || "-"}
                          </td>
                        </>
                      )}
                      {showChallan && (
                        <>
                          <td className={`${metaCellPad} font-sans font-bold border-r border-black/40 w-[24%]`}>{texts_.challanNoLabel}</td>
                          <td className={`${metaCellPad} font-bold`} colSpan={showPo ? 1 : 3}>
                            {invoice.challan_number || invoice.delivery_challan_number || "-"}
                          </td>
                        </>
                      )}
                    </tr>
                  )}
                  <tr>
                    <td className={`${metaCellPad} font-sans font-bold border-r border-black/40 w-[38%]`}>
                      {f.showPaymentDetails !== false ? "Payment Mode" : "Mode"}
                    </td>
                    <td className={`${metaCellPad} font-bold ${showEway ? "border-r border-black/40" : ""}`} colSpan={showEway ? 1 : 3}>
                      {invoice.payment_method || "Cash"}
                    </td>
                    {showEway && (
                      <>
                        <td className={`${metaCellPad} font-sans font-bold border-r border-black/40 w-[24%]`}>{texts_.ewayBillLabel}</td>
                        <td className={`${metaCellPad} font-bold ${isA5 ? "text-[7px]" : "text-[9px]"}`}>{invoice.eway_bill_number ? `No: ${invoice.eway_bill_number}` : "-"}</td>
                      </>
                    )}
                  </tr>
                  {showVeh && (
                    <tr className="border-t border-black/40">
                      <td className={`${metaCellPad} font-sans font-bold border-r border-black/40 w-[38%]`}>{texts_.vehicleNoLabel}</td>
                      <td className={`${metaCellPad} font-bold ${f.showPartyDetails !== false ? "border-r border-black/40" : ""}`} colSpan={f.showPartyDetails !== false ? 1 : 3}>
                        {invoice.vehicle_number || "-"}
                      </td>
                      {f.showPartyDetails !== false && (
                        <>
                          <td className={`${metaCellPad} font-sans font-bold w-[24%] border-r border-black/40`}>
                            {invoice.transporter_name ? "Transporter" : "Transport"}
                          </td>
                          <td className={`${metaCellPad} ${isA5 ? "text-[7px]" : "text-[9px]"}`}>
                            {invoice.transporter_name || invoice.driver_phone || "Road"}
                          </td>
                        </>
                      )}
                    </tr>
                  )}
                </tbody>
              </table>

              {customRows.length > 0 && (
                <div className={`mt-1 pt-1 border-t border-black/30 space-y-0.5 ${isA5 ? "text-[7px]" : "text-[9px]"}`}>
                  {customRows.map((row, rIdx) => (
                    <p key={rIdx} className="leading-tight">
                      <span className="font-sans font-bold">{row.label} : </span>
                      <span className="font-mono font-bold">{row.value}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Right Box in Layout 2: Customer / Party */}
          {isLayout2 && (showBillTo || showShipTo) && (
            <div
              className={`${
                f.showCompanyDetails === false && f.showInvoiceDetails === false
                  ? "col-span-12"
                  : f.showCompanyDetails === false || f.showInvoiceDetails === false
                    ? "col-span-6"
                    : "col-span-4"
              } ${headerPadClass} flex flex-col justify-between`}
            >
              <div>
                {showBillTo && (
                  <>
                    <span className={`${subTextClass} font-bold underline block mb-0.5`}>{billToTitle} :</span>
                    <h3 className={`font-bold ${isA5 ? "text-[9.5px]" : "text-xs sm:text-sm"} uppercase text-slate-900 leading-tight`}>
                      {customerName}
                    </h3>
                    {showContactPerson && contactPerson && (
                      <p className={`${subTextClass} text-gray-700 font-medium`}>{`Attn: ${contactPerson}`}</p>
                    )}
                    <p className={`${subTextClass} text-gray-800 mt-0.5 leading-snug`}>
                      {billingAddress || "-"}
                    </p>
                  </>
                )}
                {showShipTo && (
                  <p className={`${subTextClass} text-gray-700 mt-1 leading-snug`}>
                    <span className="font-bold text-slate-900">{shipToTitle} : </span>
                    {isShippingEmpty ? (
                      <span className="italic text-gray-600">Same as Billing Address</span>
                    ) : (
                      <span>{shippingAddress}</span>
                    )}
                  </p>
                )}
                {showPartyPhone && customerPhone && (
                  <p className={`${subTextClass} text-gray-800 mt-0.5`}>
                    <span className="font-bold">Phone :</span> <span className="font-mono">{customerPhone}</span>
                  </p>
                )}
                {showPartyEmail && customerEmail && (
                  <p className={`${subTextClass} text-gray-800 mt-0.5`}>
                    <span className="font-bold">Mail :</span> <span className="font-mono">{customerEmail}</span>
                  </p>
                )}
                <CustomerExtrasBlock invoice={invoice} texts={texts_} className="text-gray-800" />
              </div>
              <div className={`${subTextClass} space-y-0.5 mt-1 pt-1 border-t border-gray-200`}>
                {showPartyGstin && customerGstin && (
                  <p className="font-bold">
                    {t("Party GSTIN", "Party GSTIN")} : <span className="font-mono font-black text-slate-900">{customerGstin}</span>
                  </p>
                )}
                {showPartyPan && customerPan && (
                  <p>
                    PAN : <span className="font-mono">{customerPan}</span>
                  </p>
                )}
                {showPartyDl && customerDl && (
                  <p>
                    DL No : <span className="font-mono">{customerDl}</span>
                  </p>
                )}
                {showPos && invoice.place_of_supply && (
                  <p className="font-bold text-blue-900">{t("Place of Supply", "Place of Supply")} : {invoice.place_of_supply}</p>
                )}
                {showPartyBalance && (partyPreviousBalance > 0 || partyCurrentBalance > 0) && (
                  <div className="flex items-center gap-2 pt-0.5 text-gray-700">
                    {showPreviousBalance && partyPreviousBalance > 0 && (
                      <span>Prev: <strong className="font-mono">{fmt(partyPreviousBalance)}</strong></span>
                    )}
                    {showCurrentBalance && (
                      <span>Curr: <strong className="font-mono font-bold">{fmt(partyCurrentBalance)}</strong></span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── PARTY DETAILS: LAYOUT 1 (Side-by-Side) ─── */}
        {activePartyLayout === "layout_1" && (showBillTo || showShipTo) && (
          <div className={`grid grid-cols-12 border-b-2 ${dividerBorderClass}`}>
            {/* Bill To (Left Box) */}
            {showBillTo && (
              <div className={`${showShipTo ? `col-span-6 border-r-2 ${dividerBorderClass}` : "col-span-12"} ${headerPadClass} flex flex-col justify-between`}>
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`${subTextClass} font-bold uppercase tracking-wider text-slate-700 underline`}>
                      {billToTitle} :
                    </span>
                    {showPos && invoice.place_of_supply && (
                      <span className={`${subTextClass} font-bold text-blue-900`}>
                        POS: {invoice.place_of_supply}
                      </span>
                    )}
                  </div>
                  <h3 className={`font-bold ${isA5 ? "text-[9.5px]" : "text-xs sm:text-sm"} uppercase text-slate-900 leading-tight`}>
                    {customerName}
                  </h3>
                  {showContactPerson && contactPerson && (
                    <p className={`${subTextClass} text-gray-700 font-medium`}>{`Attn: ${contactPerson}`}</p>
                  )}
                  <p className={`${subTextClass} text-gray-800 mt-0.5 leading-snug`}>
                    {billingAddress || "-"}
                  </p>
                  <div className={`${subTextClass} text-gray-800 flex flex-wrap gap-x-3 gap-y-0.5 mt-1`}>
                    {showPartyPhone && customerPhone && (
                      <p><span className="font-semibold">Ph:</span> <span className="font-mono">{customerPhone}</span></p>
                    )}
                    {showPartyEmail && customerEmail && (
                      <p><span className="font-semibold">Mail:</span> <span className="font-mono">{customerEmail}</span></p>
                    )}
                  </div>
                  <CustomerExtrasBlock invoice={invoice} texts={texts_} className="text-gray-800 mt-0.5" />
                </div>

                <div className={`${subTextClass} space-y-0.5 mt-1 pt-1 border-t border-gray-200 flex flex-wrap justify-between items-center gap-x-2`}>
                  <div className="flex flex-wrap gap-x-3">
                    {showPartyGstin && customerGstin && (
                      <p className="font-bold">
                        GSTIN: <span className="font-mono font-black text-slate-900">{customerGstin}</span>
                      </p>
                    )}
                    {showPartyPan && customerPan && (
                      <p>
                        PAN: <span className="font-mono font-bold">{customerPan}</span>
                      </p>
                    )}
                    {showPartyDl && customerDl && (
                      <p>
                        DL No: <span className="font-mono font-bold">{customerDl}</span>
                      </p>
                    )}
                  </div>
                  {showPartyBalance && (partyPreviousBalance > 0 || partyCurrentBalance > 0) && (
                    <div className="flex items-center gap-2 text-gray-700">
                      {showPreviousBalance && partyPreviousBalance > 0 && (
                        <span>Prev Bal: <strong className="font-mono">{fmt(partyPreviousBalance)}</strong></span>
                      )}
                      {showCurrentBalance && (
                        <span>Curr Bal: <strong className="font-mono font-bold">{fmt(partyCurrentBalance)}</strong></span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Ship To (Right Box) */}
            {showShipTo && (
              <div className={`${showBillTo ? "col-span-6" : "col-span-12"} ${headerPadClass} flex flex-col justify-between bg-slate-50/40`}>
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`${subTextClass} font-bold uppercase tracking-wider text-slate-700 underline`}>
                      {shipToTitle} :
                    </span>
                    {isShippingEmpty && (
                      <span className={`${subTextClass} text-gray-500 italic`}>
                        (Default Delivery)
                      </span>
                    )}
                  </div>
                  <h3 className={`font-bold ${isA5 ? "text-[9.5px]" : "text-xs sm:text-sm"} uppercase text-slate-900 leading-tight`}>
                    {consigneeName}
                  </h3>
                  {isShippingEmpty ? (
                    <p className={`${subTextClass} text-gray-600 italic mt-0.5 leading-snug`}>
                      Same as Billing Address
                    </p>
                  ) : (
                    <p className={`${subTextClass} text-gray-800 mt-0.5 leading-snug`}>
                      {shippingAddress}
                    </p>
                  )}
                  {shippingPhone && shippingPhone !== customerPhone && (
                    <p className={`${subTextClass} text-gray-800 mt-1`}>
                      <span className="font-semibold">Contact:</span> <span className="font-mono">{shippingPhone}</span>
                    </p>
                  )}
                </div>

                <div className={`${subTextClass} space-y-0.5 mt-1 pt-1 border-t border-gray-200`}>
                  {shippingGstin && shippingGstin !== customerGstin && (
                    <p className="font-bold">
                      Consignee GSTIN: <span className="font-mono font-black text-slate-900">{shippingGstin}</span>
                    </p>
                  )}
                  {Boolean((invoice as any)?.dispatch_through || (invoice as any)?.transporter_name || (invoice as any)?.dispatch_mode) && (
                    <p className="text-gray-600">
                      Dispatch: <span className="font-semibold text-slate-900">{(invoice as any)?.dispatch_through || (invoice as any)?.transporter_name || (invoice as any)?.dispatch_mode}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── PARTY DETAILS: LAYOUT 3 (Stacked / Full Width) ─── */}
        {activePartyLayout === "layout_3" && (showBillTo || showShipTo) && (
          <div className={`border-b-2 ${dividerBorderClass}`}>
            {/* Bill To (Top Stack) */}
            {showBillTo && (
              <div className={`${headerPadClass} flex flex-col justify-between`}>
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`${subTextClass} font-bold uppercase tracking-wider text-slate-700 underline`}>
                      {billToTitle} :
                    </span>
                    {showPos && invoice.place_of_supply && (
                      <span className={`${subTextClass} font-bold text-blue-900`}>
                        POS: {invoice.place_of_supply}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className={`font-bold ${isA5 ? "text-[9.5px]" : "text-xs sm:text-sm"} uppercase text-slate-900 leading-tight`}>
                      {customerName}
                    </h3>
                    <div className={`${subTextClass} text-gray-800 flex flex-wrap gap-x-3`}>
                      {showPartyPhone && customerPhone && (
                        <span><span className="font-semibold">Ph:</span> <span className="font-mono">{customerPhone}</span></span>
                      )}
                      {showPartyEmail && customerEmail && (
                        <span><span className="font-semibold">Mail:</span> <span className="font-mono">{customerEmail}</span></span>
                      )}
                    </div>
                  </div>
                  {showContactPerson && contactPerson && (
                    <p className={`${subTextClass} text-gray-700 font-medium`}>{`Attn: ${contactPerson}`}</p>
                  )}
                  <p className={`${subTextClass} text-gray-800 mt-0.5 leading-snug`}>
                    {billingAddress || "-"}
                  </p>
                  <CustomerExtrasBlock invoice={invoice} texts={texts_} className="text-gray-800 mt-0.5" />
                </div>

                <div className={`${subTextClass} space-y-0.5 mt-1 pt-1 border-t border-gray-200 flex flex-wrap justify-between items-center gap-x-2`}>
                  <div className="flex flex-wrap gap-x-3">
                    {showPartyGstin && customerGstin && (
                      <p className="font-bold">
                        GSTIN: <span className="font-mono font-black text-slate-900">{customerGstin}</span>
                      </p>
                    )}
                    {showPartyPan && customerPan && (
                      <p>
                        PAN: <span className="font-mono font-bold">{customerPan}</span>
                      </p>
                    )}
                    {showPartyDl && customerDl && (
                      <p>
                        DL No: <span className="font-mono font-bold">{customerDl}</span>
                      </p>
                    )}
                  </div>
                  {showPartyBalance && (partyPreviousBalance > 0 || partyCurrentBalance > 0) && (
                    <div className="flex items-center gap-2 text-gray-700">
                      {showPreviousBalance && partyPreviousBalance > 0 && (
                        <span>Prev Bal: <strong className="font-mono">{fmt(partyPreviousBalance)}</strong></span>
                      )}
                      {showCurrentBalance && (
                        <span>Curr Bal: <strong className="font-mono font-bold">{fmt(partyCurrentBalance)}</strong></span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Ship To (Bottom Stack, directly beneath Bill To) */}
            {showShipTo && (
              <div className={`${headerPadClass} ${showBillTo ? `border-t ${dividerBorderClass}` : ""} bg-slate-50/40 flex flex-col justify-between`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <span className={`${subTextClass} font-bold uppercase tracking-wider text-slate-700 underline block mb-0.5`}>
                      {shipToTitle} :
                    </span>
                    <h3 className={`font-bold ${isA5 ? "text-[9.5px]" : "text-xs sm:text-sm"} uppercase text-slate-900 leading-tight`}>
                      {consigneeName}
                    </h3>
                    {isShippingEmpty ? (
                      <p className={`${subTextClass} text-gray-600 italic mt-0.5 leading-snug`}>
                        Same as Billing Address
                      </p>
                    ) : (
                      <p className={`${subTextClass} text-gray-800 mt-0.5 leading-snug`}>
                        {shippingAddress}
                      </p>
                    )}
                  </div>
                  <div className={`${subTextClass} text-right space-y-0.5 shrink-0`}>
                    {shippingPhone && shippingPhone !== customerPhone && (
                      <p><span className="font-semibold">Contact:</span> <span className="font-mono">{shippingPhone}</span></p>
                    )}
                    {shippingGstin && shippingGstin !== customerGstin && (
                      <p className="font-bold">
                        Consignee GSTIN: <span className="font-mono font-black text-slate-900">{shippingGstin}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── ITEM TABLE (Clean Indian GST Ledger Grid) ─── */}
        {f.showItemTable !== false && (
          <div className={`${isA5 ? "min-h-[140px]" : isLandscape ? "min-h-[220px]" : "min-h-[300px]"} print:min-h-0`}>
            <table className={`w-full border-collapse ${tableTextClass}`}>
              <thead>
                <tr
                  className={`border-b-2 ${dividerBorderClass} ${tableHeadClass} text-center uppercase`}
                  style={{
                    backgroundColor: tableHeaderBg,
                    color: tableHeaderTextColor,
                  }}
                >
                  {tableCols.map((col, colIdx) => (
                    <th
                      key={col.id}
                      className={`${tableHeadClass} ${showVerticalBorders && colIdx < tableCols.length - 1 ? "border-r border-black/40" : ""} ${colAlignClass(col)} font-bold`}
                      style={colWidthStyle(col)}
                    >
                      {col.headerTitle}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300 font-mono">
                {items.map((item: any, idx: number) => {
                  const qty = Number(item.quantity || 1);
                  const rate = Number(item.unit_price || 0);
                  const disc = Number(item.discount_value || 0);
                  const mrp = Number(item.mrp || 0);
                  const taxRate = Number(item.tax_rate ?? 0);
                  const lineAmount =
                    Number(item.subtotal) ||
                    (qty * rate - disc + ((qty * rate - disc) * taxRate) / 100);
                  const freeLine = isInvoiceLineFree(item);
                  const desc =
                    item.description || item.custom_note || item.notes || item.brand || item.secondary_uom
                      ? `${[item.brand, item.description, item.custom_note, item.notes, item.secondary_uom].filter(Boolean).join(" · ")}`
                      : "";
                  return (
                    <tr
                      key={idx}
                      className={`${showZebra && idx % 2 === 1 ? "bg-gray-50/70" : "bg-white"} ${freeLine ? "text-red-600" : ""}`}
                    >
                      {tableCols.map((col, colIdx) => {
                        const isLast = colIdx === tableCols.length - 1;
                        const vBorder = showVerticalBorders && !isLast ? "border-r border-black/20" : "";
                        const base = `${tableCellPad} ${vBorder} ${colAlignClass(col)}`;
                        return (
                          <td key={col.id} className={base} style={colWidthStyle(col)}>
                            {renderGstTallyItemCell(col, item, idx, lineAmount, freeLine, desc, mrp)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* Vertical ledger filler rows so the invoice fills the sheet cleanly without a giant gap */}
                {Array.from({ length: fillerCount }).map((_, fIdx) => (
                  <tr key={`fill-${fIdx}`} className={`${fillerRowHeight} border-b border-gray-100/80`}>
                    {tableCols.map((col, colIdx) => (
                      <td
                        key={col.id}
                        className={`${showVerticalBorders && colIdx < tableCols.length - 1 ? "border-r border-black/20" : ""} ${colAlignClass(col)}`}
                        style={colWidthStyle(col)}
                      >
                        &nbsp;
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── ITEMS SOLD / DISCOUNT SUMMARY LINE ─── */}
        {f.showSubtotal !== false && (
          <div className={`flex justify-between items-center border ${dividerBorderClass} mt-1 ${isA5 ? "px-2 py-0.5 text-[8px]" : "px-3 py-1.5 text-[10px]"} font-semibold bg-gray-50/80`}>
            <span>
              {t("Items Sold", "Items Sold")}: <strong className="font-black">{items.length}</strong>
            </span>
            {f.showTaxableAmount !== false && (
              <span>
                {t("Taxable", "Taxable")}: <strong className="font-mono">{fmt(taxableValue)}</strong>
              </span>
            )}
            <span>
              {t("Total Tax", "Total Tax")}: <strong className="font-mono">{fmt(totalTax)}</strong>
            </span>
          </div>
        )}

        {/* ─── BOTTOM SPLIT: GST SUMMARY (left) + TOTALS (right) ─── */}
          <div className={`grid grid-cols-12 gap-0 border-t-2 ${dividerBorderClass} mt-1 avoid-break break-inside-avoid`} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
            {/* Left: HSN / GST Slab Summary */}
            {showTaxSplit && slabRows.length > 0 && (
              <div className={`col-span-5 ${isA5 ? "p-1 text-[7.5px]" : "p-2 text-[9.5px]"} border-r-2 ${dividerBorderClass}`}>
                <table className={`w-full border border-black/60 border-collapse ${isA5 ? "text-[7.5px]" : "text-[9.5px]"}`}>
                  <thead>
                    <tr className="bg-black/10 font-bold uppercase border-b border-black/60">
                      <th className={`${isA5 ? "p-0.5" : "p-1"} border-r border-black/40 text-center`}>Rate</th>
                      {showHsn && <th className={`${isA5 ? "p-0.5" : "p-1"} border-r border-black/40 text-left`}>HSN/SAC</th>}
                      <th className={`${isA5 ? "p-0.5" : "p-1"} border-r border-black/40 text-right`}>Taxable Amt</th>
                      <th className={`${isA5 ? "p-0.5" : "p-1"} border-r border-black/40 text-right`}>{isInter ? "IGST" : "CGST"}</th>
                      {!isInter && <th className={`${isA5 ? "p-0.5" : "p-1"} border-r border-black/40 text-right`}>SGST</th>}
                      <th className={`${isA5 ? "p-0.5" : "p-1"} text-right`}>Total Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slabRows.map((s, i) => (
                      <tr key={i} className="border-b border-black/20 last:border-b-0">
                        <td className={`${isA5 ? "p-0.5" : "p-1"} border-r border-black/30 text-center font-bold`}>{s.rate}%</td>
                        {showHsn && (
                          <td className={`${isA5 ? "p-0.5" : "p-1"} border-r border-black/30 text-left font-mono`}>{s.hsn || "-"}</td>
                        )}
                        <td className={`${isA5 ? "p-0.5" : "p-1"} border-r border-black/30 text-right font-mono`}>{s.taxable.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className={`${isA5 ? "p-0.5" : "p-1"} border-r border-black/30 text-right font-mono`}>{isInter ? s.igst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : s.cgst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        {!isInter && (
                          <td className={`${isA5 ? "p-0.5" : "p-1"} border-r border-black/30 text-right font-mono`}>{s.sgst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        )}
                        <td className={`${isA5 ? "p-0.5" : "p-1"} text-right font-mono font-semibold`}>{s.tax.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-black/5 font-bold border-t border-black/60">
                      <td colSpan={showHsn ? 2 : 1} className={`${isA5 ? "p-0.5" : "p-1"} border-r border-black/30 text-center uppercase`}>Total</td>
                      <td className={`${isA5 ? "p-0.5" : "p-1"} border-r border-black/30 text-right font-mono`}>{taxableValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className={`${isA5 ? "p-0.5" : "p-1"} border-r border-black/30 text-right font-mono`}>{(isInter ? igstAmount : cgstAmount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      {!isInter && (
                        <td className={`${isA5 ? "p-0.5" : "p-1"} border-r border-black/30 text-right font-mono`}>{sgstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      )}
                      <td className={`${isA5 ? "p-0.5" : "p-1"} text-right font-mono font-bold`}>{totalTax.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Right: Payment Summary */}
            <div className={`${showTaxSplit && slabRows.length > 0 ? "col-span-7" : "col-span-12"} ${isA5 ? "p-1.5" : "p-2.5"}`}>
              <div className={`flex justify-between ${isA5 ? "text-[8.5px]" : "text-[11px]"} font-semibold items-baseline`}>
                <span className="uppercase tracking-wider font-bold">
                  {isFullyPaid ? "Net Payable" : t("Total", "Total")}
                </span>
                <span className={`font-black ${isA5 ? "text-xs" : "text-base"}`}>{fmt(grandTotal)}</span>
              </div>

              {f.showTaxableAmount !== false && (
                <div className={`flex justify-between ${isA5 ? "text-[7.5px]" : "text-[10px]"} mt-0.5`}>
                  <span>{t("Taxable Amount", "Taxable Amount")}</span>
                  <span className="font-mono">{fmt(taxableValue)}</span>
                </div>
              )}
              {totalDiscount > 0 && (
                <div className={`flex justify-between ${isA5 ? "text-[7.5px]" : "text-[10px]"} mt-0.5`}>
                  <span>{t("Total Discount", "Total Discount")}</span>
                  <span className="font-mono">{fmt(totalDiscount)}</span>
                </div>
              )}
              {showTaxSplit && (
                <div className={`flex justify-between ${isA5 ? "text-[7.5px]" : "text-[10px]"} mt-0.5`}>
                  <span>{isInter ? "IGST" : "CGST"}</span>
                  <span className="font-mono">{fmt(isInter ? igstAmount : cgstAmount)}</span>
                </div>
              )}
              {showTaxSplit && !isInter && (
                <div className={`flex justify-between ${isA5 ? "text-[7.5px]" : "text-[10px]"} mt-0.5`}>
                  <span>SGST</span>
                  <span className="font-mono">{fmt(sgstAmount)}</span>
                </div>
              )}

              {f.showReceivedAmount !== false && amountReceived > 0 && (
                <div className={`flex justify-between ${isA5 ? "text-[7.5px]" : "text-[10px]"} mt-0.5 font-semibold text-emerald-800`}>
                  <span>{t("Received", "Received")}</span>
                  <span className="font-mono">{fmt(amountReceived)}</span>
                </div>
              )}
              {balanceDue > 0 && f.showBalanceAmount !== false && (
                <div className={`flex justify-between ${isA5 ? "text-[8px]" : "text-[10.5px]"} font-bold mt-0.5 text-red-700`}>
                  <span>{t("Balance Due", "Balance Due")}</span>
                  <span className="font-mono font-black">{fmt(balanceDue)}</span>
                </div>
              )}

              {showPartyBalance && (partyPreviousBalance > 0 || partyCurrentBalance > 0) && (
                <div className={`flex justify-between ${isA5 ? "text-[7.5px]" : "text-[10px]"} mt-1 border-t border-dashed border-black/40 pt-0.5`}>
                  <span>{t("Previous Balance", "Previous Balance")}</span>
                  <span className="font-mono">{fmt(partyPreviousBalance)}</span>
                </div>
              )}
              {showPartyBalance && (
                <div className={`flex justify-between ${isA5 ? "text-[7.5px]" : "text-[10px]"} mt-0.5 font-bold`}>
                  <span>{t("Current Balance", "Current Balance")}</span>
                  <span className="font-mono font-black">{fmt(partyCurrentBalance)}</span>
                </div>
              )}

              {f.showYouSaved !== false && totalDiscount > 0 && (
                <div className={`${isA5 ? "text-[7.5px]" : "text-[9.5px]"} text-green-700 font-semibold mt-1`}>
                  You saved {fmt(totalDiscount)} on this invoice!
                </div>
              )}

              {resolvedSplitPayments.length > 0 && (
                <div className={`mt-1.5 pt-1 border-t border-dashed border-black/40 ${isA5 ? "text-[7px]" : "text-[9px]"}`}>
                  <span className="font-bold uppercase text-slate-800 block mb-0.5">Payment Split:</span>
                  <div className="space-y-0.5 pl-1">
                    {resolvedSplitPayments.map((sp, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span className="capitalize">{sp.method}{sp.reference ? ` (${sp.reference})` : ""}:</span>
                        <span className="font-mono font-bold">{fmt(sp.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─── ROUND OFF / BANK / DUE AMOUNT STRIP ─── */}
          {(f.showRoundOff !== false || showBank || f.showTcsUgc !== false) && (
            <div className={`grid grid-cols-12 border-t ${dividerBorderClass} ${isA5 ? "text-[7.5px] p-0.5" : "text-[9.5px] p-1.5"} bg-gray-50/40 items-center avoid-break break-inside-avoid`} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
              {f.showRoundOff !== false && (
                <div className="col-span-3 border-r border-black/30 pr-1">
                  <span className="font-bold block">Round Off ({roundedTotal - grandTotal > 0 ? "-" : "+"})</span>
                  <span className="font-mono">{Math.abs(roundOff).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              {bankInfo.isEnabled && bankInfo.hasAnyBank ? (
                <div className={`px-1 text-left border-r border-black/30 ${f.showRoundOff !== false ? "col-span-6" : "col-span-9"} ${isA5 ? "text-[7px]" : "text-[8.5px]"} leading-tight`}>
                  {bankInfo.hasStructured ? (
                    <div>
                      <span className="font-bold uppercase tracking-wider text-[7.5px] text-gray-600 block">Bank Details</span>
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                        {bankInfo.bankName && <span><span className="font-semibold">Bank:</span> {bankInfo.bankName}</span>}
                        {bankInfo.accountNumber && <span><span className="font-semibold">A/C:</span> <span className="font-mono font-bold">{bankInfo.accountNumber}</span></span>}
                        {bankInfo.ifscCode && <span><span className="font-semibold">IFSC:</span> <span className="font-mono font-bold">{bankInfo.ifscCode}</span></span>}
                        {bankInfo.branchName && <span><span className="font-semibold">Branch:</span> {bankInfo.branchName}</span>}
                        {bankInfo.accountHolder && <span><span className="font-semibold">Holder:</span> {bankInfo.accountHolder}</span>}
                      </div>
                    </div>
                  ) : (
                    <span className="font-bold block text-[9px]">Bank : {bankInfo.rawString}</span>
                  )}
                </div>
              ) : (
                <div className={`px-1 ${f.showRoundOff !== false ? "col-span-6" : "col-span-9"}`} />
              )}
              <div className={`pl-1 text-right ${f.showRoundOff !== false ? "col-span-3" : bankInfo.isEnabled && bankInfo.hasAnyBank ? "col-span-3" : "col-span-12"}`}>
                <span className="font-bold uppercase block">
                  {balanceDue > 0 ? "Due Amount" : "All Dues Cleared"}
                </span>
                <span className={`font-mono font-black ${isA5 ? "text-[8.5px]" : "text-[11px]"}`}>{balanceDue > 0 ? fmt(balanceDue) : fmt(0)}</span>
              </div>
              {effectivePaymentQr && effectivePaymentQr.enabled && (
                <div className="col-span-12 mt-1 pt-1 border-t border-black/20">
                  <PaymentQrBlock
                    paymentQr={effectivePaymentQr}
                    texts={texts_}
                    currency={currency}
                    compact={isA5 || template?.miscellaneous?.paymentQr?.size === "small"}
                  />
                </div>
              )}
            </div>
          )}

          {/* ─── AMOUNT IN WORDS (full width, myBillBook style) ─── */}
          {f.showAmountInWords !== false && (
            <div className={`border-t ${dividerBorderClass} ${isA5 ? "px-2 py-0.5 text-[8px]" : "px-3 py-1.5 text-[10px]"} font-bold bg-gray-50/70 avoid-break break-inside-avoid`} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
              {currCode === "INR" ? (
                numberToIndianWords(roundedTotal)
              ) : (
                <span>
                  {t("Total Amount in Words", "Total Amount in Words")}: {fmt(grandTotal)} {currCode}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ─── TERMS / DECLARATION / SIGNATURE (Anchored neatly at bottom) ─── */}
        {(f.showTerms !== false || f.showDeclaration !== false || f.showSignature !== false || f.showThankYou !== false) && (
            <div className={`border-t-2 ${dividerBorderClass} mt-auto pt-1 flex justify-between items-end avoid-break break-inside-avoid`} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
              <div className="flex-1 space-y-1 min-w-0">
                {f.showTerms !== false && (invoice.terms_text || (invoice as any).terms_and_conditions) && (
                  <p className={`${isA5 ? "text-[7px]" : "text-[9px]"} text-gray-700 whitespace-pre-line leading-relaxed`}>
                    <span className="font-bold uppercase text-slate-900">{t("Terms & Conditions", "Terms & Conditions")}: </span>
                    {(invoice.terms_text || (invoice as any).terms_and_conditions) as string}
                  </p>
                )}
                {f.showDeclaration !== false && (
                  <p className={`${isA5 ? "text-[6.5px]" : "text-[8.5px]"} text-gray-500 italic leading-normal`}>
                    {t(
                      "We hereby certify that the particulars of the goods and services shown in this invoice are true and correct to the best of our knowledge and belief.",
                      "We hereby certify that the particulars of the goods and services shown in this invoice are true and correct to the best of our knowledge and belief."
                    )}
                  </p>
                )}
                {Boolean(template?.googleReviewUrl && (template as any)?.showGoogleReviewQR !== false) && (
                  <div className="flex items-center gap-2 p-1.5 bg-amber-50/80 border border-amber-300 rounded-lg w-fit mt-1">
                    <img
                      src={generateQRCodeSVG(template.googleReviewUrl, 56)}
                      alt="Google Review QR"
                      className="size-9 object-contain bg-white p-0.5 rounded border border-amber-200"
                    />
                    <div className="text-[8px] leading-tight text-amber-900">
                      <span className="font-extrabold block text-amber-950">⭐ Rate Us on Google</span>
                      <span>Scan to review our service</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="w-1/3 flex flex-col items-end gap-1">
                {(f.showSignature !== false || f.showThankYou !== false) && (
                  <>
                    <div className={`flex items-end gap-2 ${isA5 ? "min-h-[28px]" : "min-h-[42px]"}`}>
                      {f.showSignature !== false && signatureUrl && (
                        <img src={signatureUrl} alt="Signature" className={`${isA5 ? "h-7 max-w-[70px]" : "h-11 max-w-[110px]"} object-contain`} />
                      )}
                      {f.showSignature !== false && !signatureUrl && (
                        <div className={`${isA5 ? "text-[7px] w-20" : "text-[9px] w-28"} text-gray-400 text-center italic`}>
                          /s/ {sigCompany}
                        </div>
                      )}
                      {stampUrl && f.showSignature !== false && (
                        <img src={stampUrl} alt="Stamp" className={`${isA5 ? "h-7 max-w-[55px]" : "h-11 max-w-[90px]"} object-contain opacity-80`} />
                      )}
                    </div>
                    <div className="text-right border-t border-black/40 w-full pt-0.5">
                      <p className={`${isA5 ? "text-[7.5px]" : "text-[9.5px]"} font-bold text-slate-900`}>{sigTitle}</p>
                      <p className={`${isA5 ? "text-[7px]" : "text-[9px]"} text-gray-600`}>{sigCompany}</p>
                    </div>
                  </>
                )}
                {f.showThankYou !== false && (
                  <p className={`${isA5 ? "text-[7.5px]" : "text-[9.5px]"} font-bold text-gray-700 w-full text-right`}>
                    {invoice.thank_you_note || t("Thank you for your business!", "Thank you for your business!")}
                  </p>
                )}
              </div>
            </div>
      )}
          </div>
        );
}
