import React from 'react';
import { formatDisplayDate } from '@/lib/utils';
import { computeGstBreakdown, extractGstState } from '@/lib/gst-utils';
import { generateQRCodeSVG, buildUpiPayUrl } from '@/lib/qr-generator';
import { getOrgPaymentQrSettings, getOrgSignatureSettings, getActiveBillingGst } from '@/lib/receipt-template-store';
import type { FullInvoiceData } from '../FullInvoicePrinter';

export interface PdfOverlayLayout {
  headerTopOffsetMm?: number;
  customerTopOffsetMm?: number;
  tableTopOffsetMm?: number;
  totalsBottomOffsetMm?: number;
  contentPaddingLeftMm?: number;
  contentPaddingRightMm?: number;
  contentPaddingTopMm?: number;
  contentPaddingBottomMm?: number;
  hideCompanyHeader?: boolean;
  hideCustomerLabels?: boolean;
  hideTableHeader?: boolean;
  hideFooterTerms?: boolean;
  showBackgroundInPrint?: boolean;
  fontSizePt?: number;
  lineItemHeightMm?: number;
  fontFamily?: string;
  primaryColor?: string;
  tableStyle?: 'word_grid' | 'striped' | 'modern_banner' | 'minimal_clean' | 'boxed';
  cellPadding?: 'compact' | 'standard' | 'spacious';
  watermarkText?: string;
  showWatermark?: boolean;
  customTexts?: Record<string, string>;
}

interface PdfStationeryOverlayTemplateProps {
  invoice: FullInvoiceData;
  dynamicStoreName: string;
  dynamicLogoUrl: string;
  dynamicAddress: string;
  dynamicPhone: string;
  dynamicEmail: string;
  sellerGstin: string;
  sellerStateCode: string;
  dynamicBank?: string;
  currency: { symbol: string; code: string };
  f: Record<string, boolean>;
  template: any;
  isEditable?: boolean;
  onCustomTextChange?: (key: string, value: string) => void;
}

export function PdfStationeryOverlayTemplate({
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
  f,
  template,
  isEditable = false,
  onCustomTextChange,
}: PdfStationeryOverlayTemplateProps) {
  const layout: PdfOverlayLayout = template?.overlayLayout || {};
  const bgDataUrl = template?.pdfBackgroundDataUrl || template?.backgroundUrl || '';
  const showBgInPrint = layout.showBackgroundInPrint !== false;
  const hideCompanyHeader = Boolean(layout.hideCompanyHeader);
  const hideFooterTerms = Boolean(layout.hideFooterTerms);
  const fontSizePt = layout.fontSizePt || 9.5;
  const paddingLeftMm = layout.contentPaddingLeftMm !== undefined ? layout.contentPaddingLeftMm : 10;
  const paddingRightMm = layout.contentPaddingRightMm !== undefined ? layout.contentPaddingRightMm : 10;
  const paddingTopMm = layout.contentPaddingTopMm !== undefined ? layout.contentPaddingTopMm : (layout.headerTopOffsetMm !== undefined ? layout.headerTopOffsetMm : 8);
  const paddingBottomMm = layout.contentPaddingBottomMm !== undefined ? layout.contentPaddingBottomMm : 10;
  
  const customerTopMm = layout.customerTopOffsetMm !== undefined ? layout.customerTopOffsetMm : 40;
  const tableTopMm = layout.tableTopOffsetMm !== undefined ? layout.tableTopOffsetMm : 82;
  const primaryColor = layout.primaryColor || template?.primaryColor || '#185abd';
  const fontFamily = layout.fontFamily || template?.fontFamily || 'Calibri, Aptos, Arial, sans-serif';
  const tableStyle = layout.tableStyle || 'word_grid';
  const cellPadding = layout.cellPadding || 'standard';
  const watermarkText = layout.watermarkText || template?.watermarkText || '';
  const showWatermark = Boolean(layout.showWatermark && watermarkText);

  const customTexts = layout.customTexts || {};

  const editClass = isEditable
    ? 'hover:bg-blue-50/70 hover:outline-dashed hover:outline-1 hover:outline-blue-400 focus:outline-solid focus:outline-2 focus:outline-blue-600 focus:bg-blue-50/40 rounded px-0.5 transition-all cursor-text select-text outline-none'
    : '';

  // 1. Calculate GST breakdown
  const rawItems = invoice.items || [];
  const items = rawItems.reduce((acc: typeof rawItems, item) => {
    const pId = item.product_id || '';
    const pName = (item.product_name || '').trim().toLowerCase();
    const price = Number(item.unit_price || 0);
    const tax = Number(item.tax_rate || 0);
    const note = item.custom_note || item.description || item.notes || '';

    const existing = acc.find(
      (x) =>
        (pId && x.product_id === pId && Number(x.unit_price) === price && (x.custom_note || x.description || x.notes || '') === note) ||
        (!pId && (x.product_name || '').trim().toLowerCase() === pName && Number(x.unit_price) === price && Number(x.tax_rate) === tax && (x.custom_note || x.description || x.notes || '') === note)
    );

    if (existing) {
      existing.quantity = Number(existing.quantity || 0) + Number(item.quantity || 0);
      existing.discount_value = Number(existing.discount_value || 0) + Number(item.discount_value || 0);
    } else {
      acc.push({ ...item });
    }
    return acc;
  }, []);

  const billingAddr = invoice.customerBillingAddress || invoice.customerAddress || invoice.billing_address || '';
  const shippingAddr = invoice.customerShippingAddress || invoice.shipping_address || billingAddr;

  const sellerState = extractGstState(sellerGstin, dynamicAddress);
  const customerState = extractGstState(
    invoice.customerGST,
    shippingAddr || billingAddr,
    invoice.customerState || invoice.shipping_state || invoice.billing_state
  );

  const isInterState = Boolean(
    invoice.gst_type === 'igst' ||
    invoice.is_interstate === true ||
    (sellerState.code && customerState.code && sellerState.code !== customerState.code)
  );

  const gstBreakdown = computeGstBreakdown(items, isInterState, sellerState, customerState);

  let calculatedDiscount = 0;
  items.forEach((item) => {
    const qty = Number(item.quantity || 0);
    const price = Number(item.unit_price || 0);
    const discVal = Number(item.discount_value || 0);
    const disc = item.discount_type === 'percent' ? (qty * price * discVal) / 100 : discVal;
    calculatedDiscount += disc;
  });

  const totalTax = Number(
    invoice.tax_amount !== undefined && Number(invoice.tax_amount) > 0
      ? invoice.tax_amount
      : invoice.cgst_amount || invoice.sgst_amount || invoice.igst_amount
      ? Number(invoice.cgst_amount || 0) + Number(invoice.sgst_amount || 0) + Number(invoice.igst_amount || 0)
      : gstBreakdown.totalTax
  );

  const taxableSubtotal = Number(
    invoice.taxable_value !== undefined && Number(invoice.taxable_value) > 0
      ? invoice.taxable_value
      : gstBreakdown.totalTaxable
  );

  const grandTotal = Number(invoice.grand_total !== undefined ? invoice.grand_total : taxableSubtotal + totalTax);
  const totalDiscount = Number(invoice.discount_amount !== undefined ? invoice.discount_amount : calculatedDiscount);

  const cgstAmount = invoice.cgst_amount !== undefined ? Number(invoice.cgst_amount) : gstBreakdown.totalCgst;
  const sgstAmount = invoice.sgst_amount !== undefined ? Number(invoice.sgst_amount) : gstBreakdown.totalSgst;
  const igstAmount = invoice.igst_amount !== undefined ? Number(invoice.igst_amount) : gstBreakdown.totalIgst;

  // Payment QR
  const paymentQrSettings = getOrgPaymentQrSettings();
  const amountReceived = Number(invoice.amount_received ?? invoice.paid_amount ?? 0);
  const isPaidInFull = Boolean(
    invoice.status?.toUpperCase() === 'PAID' ||
    invoice.payment_status?.toUpperCase() === 'PAID' ||
    (amountReceived > 0 && amountReceived >= grandTotal - 0.05)
  );
  const balanceDue = isPaidInFull ? 0 : Math.max(0, grandTotal - amountReceived);
  const resolvedUpiVpa = (invoice.upi_vpa || paymentQrSettings.vpa || '').trim();
  const targetAmount = balanceDue > 0 ? balanceDue : grandTotal;
  const upiIntentUrl = resolvedUpiVpa
    ? buildUpiPayUrl({
        vpa: resolvedUpiVpa,
        payeeName: paymentQrSettings.payeeName || dynamicStoreName,
        amount: targetAmount,
        invoiceNumber: invoice.invoice_number || 'INV',
      })
    : '';

  const paymentQrSrc = paymentQrSettings.enabled
    ? paymentQrSettings.type === 'custom_image' && paymentQrSettings.customImageUrl
      ? paymentQrSettings.customImageUrl
      : upiIntentUrl
      ? generateQRCodeSVG(upiIntentUrl, 140)
      : ''
    : '';

  // Signature Settings
  const sigSettings = getOrgSignatureSettings();
  const sigImg = sigSettings.signatureUrl;

  const padClass =
    cellPadding === 'compact'
      ? 'py-1 px-1.5'
      : cellPadding === 'spacious'
      ? 'py-2.5 px-3'
      : 'py-1.5 px-2.5';

  return (
    <div
      className="relative w-full min-h-[297mm] bg-white text-slate-900 print:min-h-0 print:h-auto select-text"
      style={{
        fontFamily: fontFamily,
        fontSize: `${fontSizePt}pt`,
        lineHeight: 1.35,
      }}
    >
      {/* ── Background Stationery Layer (Clean Image / Clean PDF Embed) ── */}
      {bgDataUrl && (
        <div
          className={`absolute inset-0 pointer-events-none z-0 ${
            showBgInPrint ? 'print:block' : 'print:hidden'
          }`}
          style={{ width: '100%', height: '100%', overflow: 'hidden' }}
        >
          {bgDataUrl.startsWith('data:application/pdf') || bgDataUrl.endsWith('.pdf') ? (
            <iframe
              src={`${bgDataUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
              className="w-full h-full border-none pointer-events-none opacity-90"
              title="Stationery PDF Background"
            />
          ) : (
            <img
              src={bgDataUrl}
              alt="Stationery Template Background"
              className="w-full h-full object-contain object-top"
              style={{ width: '100%', height: '100%' }}
            />
          )}
        </div>
      )}

      {/* ── Watermark Layer (Word Document Style) ── */}
      {showWatermark && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-5 overflow-hidden select-none">
          <span
            className="text-[64pt] font-black uppercase tracking-widest text-slate-400/15 -rotate-45 whitespace-nowrap transform select-none"
            style={{ fontFamily }}
          >
            {watermarkText}
          </span>
        </div>
      )}

      {/* ── Word Document Layout Content ── */}
      <div
        className="relative z-10 w-full flex flex-col justify-between select-text"
        style={{
          paddingLeft: `${paddingLeftMm}mm`,
          paddingRight: `${paddingRightMm}mm`,
          paddingTop: `${paddingTopMm}mm`,
          paddingBottom: `${paddingBottomMm}mm`,
          minHeight: '280mm',
        }}
      >
        <div>
          {/* Header Block (Microsoft Word Header Design) */}
          {!hideCompanyHeader ? (
            <div
              className="flex justify-between items-start pb-3"
              style={{
                borderBottom: `2px solid ${primaryColor}`,
              }}
            >
              <div className="max-w-[60%] space-y-0.5">
                {f.showLogo && dynamicLogoUrl && (
                  <img
                    src={dynamicLogoUrl}
                    alt="Logo"
                    className="h-11 max-w-[150px] object-contain mb-1.5 rounded"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                )}
                <h2
                  contentEditable={isEditable}
                  suppressContentEditableWarning
                  onBlur={(e) => onCustomTextChange?.('storeName', e.currentTarget.innerText)}
                  className={`font-bold text-[15pt] leading-tight ${editClass}`}
                  style={{ color: primaryColor }}
                >
                  {customTexts.storeName || dynamicStoreName}
                </h2>
                {(customTexts.storeAddress || dynamicAddress) && (
                  <p
                    contentEditable={isEditable}
                    suppressContentEditableWarning
                    onBlur={(e) => onCustomTextChange?.('storeAddress', e.currentTarget.innerText)}
                    className={`text-[9.5pt] text-slate-700 leading-tight ${editClass}`}
                  >
                    {customTexts.storeAddress || dynamicAddress}
                  </p>
                )}
                <div className="flex flex-wrap gap-x-3 text-[9pt] text-slate-600 font-medium">
                  {(customTexts.storePhone || dynamicPhone) && (
                    <span
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      onBlur={(e) => onCustomTextChange?.('storePhone', e.currentTarget.innerText)}
                      className={editClass}
                    >
                      Tel: {customTexts.storePhone || dynamicPhone}
                    </span>
                  )}
                  {(customTexts.storeEmail || dynamicEmail) && (
                    <span
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      onBlur={(e) => onCustomTextChange?.('storeEmail', e.currentTarget.innerText)}
                      className={editClass}
                    >
                      Email: {customTexts.storeEmail || dynamicEmail}
                    </span>
                  )}
                </div>
                {(customTexts.storeGstin || sellerGstin) && (
                  <p className="text-[9.5pt] font-bold text-slate-900 mt-0.5">
                    GSTIN:{' '}
                    <span
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      onBlur={(e) => onCustomTextChange?.('storeGstin', e.currentTarget.innerText)}
                      className={`font-mono ${editClass}`}
                    >
                      {customTexts.storeGstin || sellerGstin}
                    </span>
                  </p>
                )}
              </div>

              <div className="text-right space-y-1">
                <span
                  contentEditable={isEditable}
                  suppressContentEditableWarning
                  onBlur={(e) => onCustomTextChange?.('copyType', e.currentTarget.innerText)}
                  className={`text-[8.5pt] font-bold uppercase px-2.5 py-0.5 rounded tracking-wider inline-block text-white ${editClass}`}
                  style={{ backgroundColor: primaryColor }}
                >
                  {customTexts.copyType || invoice.copy_type || 'ORIGINAL FOR RECIPIENT'}
                </span>
                <h1
                  contentEditable={isEditable}
                  suppressContentEditableWarning
                  onBlur={(e) => onCustomTextChange?.('headerTitle', e.currentTarget.innerText)}
                  className={`text-[17pt] font-black tracking-tight uppercase ${editClass}`}
                  style={{ color: primaryColor }}
                >
                  {customTexts.headerTitle || template.headerTitle || 'TAX INVOICE'}
                </h1>
                <div className="bg-slate-50 border border-slate-300 rounded p-2 inline-block text-right shadow-2xs">
                  <p className="text-[10pt] font-bold text-slate-900">
                    <span
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      className={editClass}
                    >
                      Invoice No:
                    </span>{' '}
                    <span
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      className={`font-mono ${editClass}`}
                    >
                      {invoice.invoice_number || '#INV-0001'}
                    </span>
                  </p>
                  <p className="text-[9pt] text-slate-700">
                    <span
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      className={editClass}
                    >
                      Invoice Date: {formatDisplayDate(invoice.invoice_date || invoice.created_at || new Date())}
                    </span>
                  </p>
                  {invoice.due_date && (
                    <p className="text-[8.5pt] text-slate-600">
                      <span
                        contentEditable={isEditable}
                        suppressContentEditableWarning
                        className={editClass}
                      >
                        Due Date: {formatDisplayDate(invoice.due_date)}
                      </span>
                    </p>
                  )}
                  {invoice.eway_bill_number && (
                    <p className="text-[8.5pt] font-mono font-bold text-emerald-800">
                      <span
                        contentEditable={isEditable}
                        suppressContentEditableWarning
                        className={editClass}
                      >
                        e-Way Bill: {invoice.eway_bill_number}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Pre-printed Letterhead Header Offset */
            <div className="flex justify-between items-start">
              <div />
              <div className="text-right bg-white/95 border border-slate-300 rounded p-2 shadow-2xs">
                <span
                  contentEditable={isEditable}
                  suppressContentEditableWarning
                  className={`text-[8pt] font-bold uppercase px-2 py-0.5 rounded tracking-wider inline-block text-white mb-1 ${editClass}`}
                  style={{ backgroundColor: primaryColor }}
                >
                  {customTexts.copyType || invoice.copy_type || 'ORIGINAL FOR RECIPIENT'}
                </span>
                <p className="text-[10pt] font-bold text-slate-900">
                  <span
                    contentEditable={isEditable}
                    suppressContentEditableWarning
                    className={editClass}
                  >
                    Invoice No: <span className="font-mono">{invoice.invoice_number || '#INV'}</span>
                  </span>
                </p>
                <p className="text-[9pt] text-slate-700">
                  <span
                    contentEditable={isEditable}
                    suppressContentEditableWarning
                    className={editClass}
                  >
                    Date: {formatDisplayDate(invoice.invoice_date || invoice.created_at || new Date())}
                  </span>
                </p>
                {invoice.eway_bill_number && (
                  <p className="text-[8.5pt] font-mono font-bold text-emerald-800">
                    <span
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      className={editClass}
                    >
                      e-Way: {invoice.eway_bill_number}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Customer & Shipping Details (Word 2-Column Boxed Table) */}
          {f.showCustomerDetails && (
            <div
              className="grid grid-cols-12 gap-0 border border-slate-300 rounded overflow-hidden my-2.5 bg-white shadow-2xs"
              style={{ marginTop: hideCompanyHeader ? `${customerTopMm}mm` : '3mm' }}
            >
              {/* Billed To Column */}
              <div className="col-span-5 p-2.5 border-r border-slate-300 space-y-0.5">
                <div
                  contentEditable={isEditable}
                  suppressContentEditableWarning
                  onBlur={(e) => onCustomTextChange?.('billedToLabel', e.currentTarget.innerText)}
                  className={`text-[8pt] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded inline-block text-white mb-1 ${editClass}`}
                  style={{ backgroundColor: primaryColor }}
                >
                  {customTexts.billedToLabel || 'Billed To (Customer)'}
                </div>
                <h4
                  contentEditable={isEditable}
                  suppressContentEditableWarning
                  className={`font-bold text-slate-950 text-[10.5pt] ${editClass}`}
                >
                  {invoice.customerName || 'Walk-in Customer'}
                </h4>
                {invoice.customerCompany && (
                  <p
                    contentEditable={isEditable}
                    suppressContentEditableWarning
                    className={`font-semibold text-slate-800 text-[9.5pt] ${editClass}`}
                  >
                    {invoice.customerCompany}
                  </p>
                )}
                {billingAddr && (
                  <p
                    contentEditable={isEditable}
                    suppressContentEditableWarning
                    className={`text-slate-700 text-[9pt] leading-tight ${editClass}`}
                  >
                    {billingAddr}
                  </p>
                )}
                {invoice.customerPhone && (
                  <p
                    contentEditable={isEditable}
                    suppressContentEditableWarning
                    className={`text-slate-700 text-[9pt] ${editClass}`}
                  >
                    Ph: {invoice.customerPhone}
                  </p>
                )}
                {invoice.customerEmail && (
                  <p
                    contentEditable={isEditable}
                    suppressContentEditableWarning
                    className={`text-slate-700 text-[9pt] ${editClass}`}
                  >
                    Email: {invoice.customerEmail}
                  </p>
                )}
                {invoice.customerGST && (
                  <p className="font-bold text-slate-900 text-[9pt] mt-1">
                    GSTIN:{' '}
                    <span
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      className={`font-mono ${editClass}`}
                    >
                      {invoice.customerGST}
                    </span>
                  </p>
                )}
              </div>

              {/* Shipped To Column */}
              <div className="col-span-4 p-2.5 border-r border-slate-300 space-y-0.5 bg-slate-50/40">
                <div
                  contentEditable={isEditable}
                  suppressContentEditableWarning
                  onBlur={(e) => onCustomTextChange?.('shippedToLabel', e.currentTarget.innerText)}
                  className={`text-[8pt] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded inline-block bg-slate-200 text-slate-800 mb-1 ${editClass}`}
                >
                  {customTexts.shippedToLabel || 'Shipped To / Delivery'}
                </div>
                <h4
                  contentEditable={isEditable}
                  suppressContentEditableWarning
                  className={`font-bold text-slate-900 text-[10pt] ${editClass}`}
                >
                  {invoice.customerCompany || invoice.customerName || 'Same as Billed'}
                </h4>
                <p
                  contentEditable={isEditable}
                  suppressContentEditableWarning
                  className={`text-slate-700 text-[9pt] leading-tight ${editClass}`}
                >
                  {shippingAddr || billingAddr || 'Same as billing address'}
                </p>
                {invoice.customerPhone && (
                  <p
                    contentEditable={isEditable}
                    suppressContentEditableWarning
                    className={`text-slate-700 text-[9pt] ${editClass}`}
                  >
                    Contact: {invoice.customerPhone}
                  </p>
                )}
              </div>

              {/* Invoice Meta & Place of Supply */}
              <div className="col-span-3 p-2.5 space-y-1.5 bg-slate-50 flex flex-col justify-between text-[9pt]">
                <div>
                  <span className="text-[8pt] font-bold uppercase text-slate-500 tracking-wider block">
                    Place of Supply
                  </span>
                  <p
                    contentEditable={isEditable}
                    suppressContentEditableWarning
                    className={`font-bold text-slate-900 text-[9.5pt] ${editClass}`}
                  >
                    {customerState.name} ({customerState.code})
                  </p>
                  <span className="text-[8pt] text-slate-600 block">
                    {isInterState ? '• Inter-State (IGST)' : '• Intra-State (CGST+SGST)'}
                  </span>
                </div>

                {invoice.po_number && (
                  <div>
                    <span className="text-[8pt] font-bold text-slate-500 block">P.O. Number</span>
                    <span
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      className={`font-mono font-bold text-slate-900 ${editClass}`}
                    >
                      {invoice.po_number}
                    </span>
                  </div>
                )}

                {invoice.payment_terms && (
                  <div>
                    <span className="text-[8pt] font-bold text-slate-500 block">Payment Terms</span>
                    <span
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      className={`text-slate-800 font-medium ${editClass}`}
                    >
                      {invoice.payment_terms}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Line Items Table (Microsoft Word Table Styles) */}
          <div
            className="overflow-hidden rounded border border-slate-300 bg-white my-2.5 shadow-2xs"
            style={{
              marginTop: hideCompanyHeader && !f.showCustomerDetails ? `${tableTopMm}mm` : '2.5mm',
            }}
          >
            <table className="w-full border-collapse" style={{ fontSize: `${fontSizePt}pt` }}>
              <thead>
                <tr
                  className="text-white font-bold text-left border-b border-slate-300"
                  style={{
                    backgroundColor: tableStyle === 'minimal_clean' ? '#f8fafc' : primaryColor,
                    color: tableStyle === 'minimal_clean' ? '#0f172a' : '#ffffff',
                  }}
                >
                  <th className={`${padClass} w-8 text-center border-r border-slate-300/30`}>#</th>
                  <th
                    contentEditable={isEditable}
                    suppressContentEditableWarning
                    className={`${padClass} border-r border-slate-300/30 ${editClass}`}
                  >
                    Item & Description
                  </th>
                  {f.showHSN && (
                    <th
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      className={`${padClass} text-center w-18 border-r border-slate-300/30 ${editClass}`}
                    >
                      HSN/SAC
                    </th>
                  )}
                  {f.showMRP && (
                    <th
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      className={`${padClass} text-right w-16 border-r border-slate-300/30 ${editClass}`}
                    >
                      MRP
                    </th>
                  )}
                  <th
                    contentEditable={isEditable}
                    suppressContentEditableWarning
                    className={`${padClass} text-center w-14 border-r border-slate-300/30 ${editClass}`}
                  >
                    Qty
                  </th>
                  {f.showPrice && (
                    <th
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      className={`${padClass} text-right w-20 border-r border-slate-300/30 ${editClass}`}
                    >
                      Rate
                    </th>
                  )}
                  <th
                    contentEditable={isEditable}
                    suppressContentEditableWarning
                    className={`${padClass} text-right w-16 border-r border-slate-300/30 ${editClass}`}
                  >
                    Disc
                  </th>
                  {f.showTaxSplit && (
                    <th
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      className={`${padClass} text-right w-14 border-r border-slate-300/30 ${editClass}`}
                    >
                      Tax%
                    </th>
                  )}
                  <th
                    contentEditable={isEditable}
                    suppressContentEditableWarning
                    className={`${padClass} text-right w-24 ${editClass}`}
                  >
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white text-slate-900">
                {items.map((item, idx) => {
                  const qty = Number(item.quantity || 0);
                  const unitPrice = Number(item.unit_price || 0);
                  const mrpPrice = Number(item.mrp || 0);
                  const discVal = Number(item.discount_value || 0);
                  const taxRate = Number(item.tax_rate || 0);
                  const itemSub = qty * unitPrice;
                  const disc = item.discount_type === 'percent' ? (itemSub * discVal) / 100 : discVal;
                  const netAmount = itemSub - disc;
                  const noteText = item.custom_note || item.description || item.notes || '';

                  const rowBg =
                    tableStyle === 'striped' && idx % 2 === 1
                      ? 'bg-slate-50'
                      : tableStyle === 'word_grid' && idx % 2 === 1
                      ? 'bg-slate-50/40'
                      : 'bg-white';

                  return (
                    <tr key={idx} className={`${rowBg} hover:bg-blue-50/30 transition-colors`}>
                      <td className={`${padClass} text-center font-bold text-slate-400 border-r border-slate-200`}>
                        {idx + 1}
                      </td>
                      <td className={`${padClass} border-r border-slate-200`}>
                        <span
                          contentEditable={isEditable}
                          suppressContentEditableWarning
                          className={`font-bold text-slate-950 block ${editClass}`}
                        >
                          {item.product_name || 'Item'}
                        </span>
                        {noteText && (
                          <span
                            contentEditable={isEditable}
                            suppressContentEditableWarning
                            className={`text-[8.5pt] text-slate-600 block mt-0.5 whitespace-pre-line font-normal italic leading-snug ${editClass}`}
                          >
                            {noteText}
                          </span>
                        )}
                      </td>
                      {f.showHSN && (
                        <td
                          contentEditable={isEditable}
                          suppressContentEditableWarning
                          className={`${padClass} text-center font-mono text-slate-700 text-[8.5pt] border-r border-slate-200 ${editClass}`}
                        >
                          {item.hsn_code || '—'}
                        </td>
                      )}
                      {f.showMRP && (
                        <td
                          contentEditable={isEditable}
                          suppressContentEditableWarning
                          className={`${padClass} text-right text-slate-600 text-[8.5pt] border-r border-slate-200 ${editClass}`}
                        >
                          {mrpPrice > 0 ? `${currency.symbol}${mrpPrice.toFixed(2)}` : '—'}
                        </td>
                      )}
                      <td
                        contentEditable={isEditable}
                        suppressContentEditableWarning
                        className={`${padClass} text-center font-bold text-slate-900 border-r border-slate-200 ${editClass}`}
                      >
                        {qty}
                      </td>
                      {f.showPrice && (
                        <td
                          contentEditable={isEditable}
                          suppressContentEditableWarning
                          className={`${padClass} text-right text-slate-800 border-r border-slate-200 ${editClass}`}
                        >
                          {currency.symbol}{unitPrice.toFixed(2)}
                        </td>
                      )}
                      <td
                        contentEditable={isEditable}
                        suppressContentEditableWarning
                        className={`${padClass} text-right text-emerald-700 font-semibold border-r border-slate-200 ${editClass}`}
                      >
                        {disc > 0 ? `-${currency.symbol}${disc.toFixed(2)}` : '—'}
                      </td>
                      {f.showTaxSplit && (
                        <td
                          contentEditable={isEditable}
                          suppressContentEditableWarning
                          className={`${padClass} text-right text-slate-700 font-medium border-r border-slate-200 ${editClass}`}
                        >
                          {taxRate}%
                        </td>
                      )}
                      <td
                        contentEditable={isEditable}
                        suppressContentEditableWarning
                        className={`${padClass} text-right font-bold text-slate-950 ${editClass}`}
                      >
                        {currency.symbol}{netAmount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* GST Slabs Breakdown (Word Table Style) */}
          {f.showTaxSplit && gstBreakdown.slabsBreakdown.length > 0 && (
            <div className="rounded border border-slate-300 bg-white p-2 my-2 text-[8.5pt] shadow-2xs">
              <div className="flex justify-between items-center font-bold text-slate-800 mb-1 border-b border-slate-200 pb-1">
                <span
                  contentEditable={isEditable}
                  suppressContentEditableWarning
                  className={`uppercase text-[8pt] tracking-wider ${editClass}`}
                  style={{ color: primaryColor }}
                >
                  Tax Split Breakdown ({isInterState ? 'IGST 100%' : 'CGST 50% + SGST 50%'})
                </span>
                <span
                  contentEditable={isEditable}
                  suppressContentEditableWarning
                  className={`text-slate-600 ${editClass}`}
                >
                  Place of Supply: {customerState.name}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {gstBreakdown.slabsBreakdown.map((s, idx) => (
                  <div key={idx} className="bg-slate-50 p-1.5 rounded border border-slate-200">
                    <span
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      className={`font-bold text-slate-900 block ${editClass}`}
                    >
                      GST @ {s.rate}%
                    </span>
                    <span
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      className={`text-slate-600 block ${editClass}`}
                    >
                      Taxable: {currency.symbol}{s.taxableAmount.toFixed(2)}
                    </span>
                    <span
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      className={`font-bold text-slate-900 block ${editClass}`}
                      style={{ color: primaryColor }}
                    >
                      Tax: {currency.symbol}{s.totalTax.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Zone: Totals, Bank, QR, Terms, Signatures */}
        <div
          className="border-t-2 pt-2.5 mt-2 bg-white rounded"
          style={{ borderColor: primaryColor }}
        >
          <div className="grid grid-cols-12 gap-3">
            {/* Left: Bank details, QR, Terms */}
            <div className="col-span-7 space-y-2 text-[9pt]">
              {(customTexts.bankText || dynamicBank) && (
                <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                  <span
                    contentEditable={isEditable}
                    suppressContentEditableWarning
                    className={`font-bold text-slate-800 block uppercase text-[8pt] tracking-wider ${editClass}`}
                    style={{ color: primaryColor }}
                  >
                    Bank & Payment Details
                  </span>
                  <p
                    contentEditable={isEditable}
                    suppressContentEditableWarning
                    onBlur={(e) => onCustomTextChange?.('bankText', e.currentTarget.innerText)}
                    className={`font-mono text-slate-800 leading-tight whitespace-pre-line text-[8.5pt] mt-0.5 ${editClass}`}
                  >
                    {customTexts.bankText || dynamicBank}
                  </p>
                </div>
              )}

              {paymentQrSrc && (
                <div className="flex items-center gap-2.5 p-2 bg-slate-50 border border-slate-200 rounded">
                  <img src={paymentQrSrc} alt="UPI QR" className="size-14 object-contain bg-white rounded p-0.5 border border-slate-200" />
                  <div>
                    <span
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      className={`font-bold uppercase tracking-wider text-[8pt] block ${editClass}`}
                      style={{ color: primaryColor }}
                    >
                      ⚡ Scan to Pay via UPI / QR
                    </span>
                    <span
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      className={`font-black text-[11pt] text-slate-950 ${editClass}`}
                    >
                      {currency.symbol}{targetAmount.toFixed(2)}
                    </span>
                    {resolvedUpiVpa && (
                      <span
                        contentEditable={isEditable}
                        suppressContentEditableWarning
                        className={`text-[8pt] text-slate-600 font-mono block mt-0.5 ${editClass}`}
                      >
                        {resolvedUpiVpa}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {!hideFooterTerms && (
                <div>
                  <span
                    contentEditable={isEditable}
                    suppressContentEditableWarning
                    className={`font-bold uppercase text-[7.5pt] text-slate-400 tracking-wider block ${editClass}`}
                  >
                    Terms & Conditions
                  </span>
                  <p
                    contentEditable={isEditable}
                    suppressContentEditableWarning
                    onBlur={(e) => onCustomTextChange?.('termsText', e.currentTarget.innerText)}
                    className={`text-[8pt] text-slate-600 leading-tight mt-0.5 ${editClass}`}
                  >
                    {customTexts.termsText ||
                      '1. Goods once sold will not be taken back or exchanged. 2. Interest @ 18% p.a. will be charged for delayed payments. 3. Subject to local jurisdiction.'}
                  </p>
                </div>
              )}
            </div>

            {/* Right: Calculations, Grand Total & Signature Block */}
            <div className="col-span-5 flex flex-col justify-between text-[9pt]">
              <div className="space-y-1 bg-slate-50 border border-slate-200 rounded p-2 text-slate-700">
                <div className="flex justify-between">
                  <span contentEditable={isEditable} suppressContentEditableWarning className={editClass}>
                    Taxable Subtotal:
                  </span>
                  <span className="font-medium text-slate-900">{currency.symbol}{taxableSubtotal.toFixed(2)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span contentEditable={isEditable} suppressContentEditableWarning className={editClass}>
                      Discount:
                    </span>
                    <span>-{currency.symbol}{totalDiscount.toFixed(2)}</span>
                  </div>
                )}
                {!isInterState ? (
                  <>
                    <div className="flex justify-between text-[8.5pt]">
                      <span contentEditable={isEditable} suppressContentEditableWarning className={editClass}>
                        CGST:
                      </span>
                      <span>{currency.symbol}{cgstAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[8.5pt]">
                      <span contentEditable={isEditable} suppressContentEditableWarning className={editClass}>
                        SGST:
                      </span>
                      <span>{currency.symbol}{sgstAmount.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-[8.5pt]">
                    <span contentEditable={isEditable} suppressContentEditableWarning className={editClass}>
                      IGST:
                    </span>
                    <span>{currency.symbol}{igstAmount.toFixed(2)}</span>
                  </div>
                )}
                <div
                  className="flex justify-between text-[11pt] font-black pt-1.5 mt-1 border-t-2"
                  style={{ borderColor: primaryColor, color: primaryColor }}
                >
                  <span contentEditable={isEditable} suppressContentEditableWarning className={editClass}>
                    Grand Total:
                  </span>
                  <span>{currency.symbol}{grandTotal.toFixed(2)}</span>
                </div>
                {amountReceived > 0 && (
                  <div className="flex justify-between text-[8.5pt] text-emerald-700 font-bold border-t border-slate-200 pt-1">
                    <span contentEditable={isEditable} suppressContentEditableWarning className={editClass}>
                      Amount Paid:
                    </span>
                    <span>{currency.symbol}{amountReceived.toFixed(2)}</span>
                  </div>
                )}
                {balanceDue > 0 && (
                  <div className="flex justify-between text-[8.5pt] text-rose-700 font-bold">
                    <span contentEditable={isEditable} suppressContentEditableWarning className={editClass}>
                      Balance Due:
                    </span>
                    <span>{currency.symbol}{balanceDue.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Authorized Signatory Block */}
              <div className="mt-3 text-right pt-2">
                <div className="inline-block text-center min-w-[130px]">
                  {sigImg && (
                    <img src={sigImg} alt="Signature" className="h-10 mx-auto object-contain mb-0.5" />
                  )}
                  <div className="border-t border-slate-400 pt-1">
                    <p
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      onBlur={(e) => onCustomTextChange?.('signatoryLabel', e.currentTarget.innerText)}
                      className={`text-[7.5pt] font-bold uppercase tracking-wider text-slate-800 ${editClass}`}
                    >
                      {customTexts.signatoryLabel || `For ${customTexts.storeName || dynamicStoreName}`}
                    </p>
                    <p
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      onBlur={(e) => onCustomTextChange?.('signatoryTitle', e.currentTarget.innerText)}
                      className={`text-[7pt] text-slate-500 font-medium ${editClass}`}
                    >
                      {customTexts.signatoryTitle || 'Authorized Signatory'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
