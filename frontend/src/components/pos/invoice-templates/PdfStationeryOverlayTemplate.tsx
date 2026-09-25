import React from 'react';
import { formatDisplayDate } from '@/lib/utils';
import { computeGstBreakdown, extractGstState } from '@/lib/gst-utils';
import { generateQRCodeSVG, buildUpiPayUrl } from '@/lib/qr-generator';
import { getOrgPaymentQrSettings } from '@/lib/receipt-template-store';
import type { FullInvoiceData } from '../FullInvoicePrinter';

export interface PdfOverlayLayout {
  headerTopOffsetMm?: number;
  customerTopOffsetMm?: number;
  tableTopOffsetMm?: number;
  totalsBottomOffsetMm?: number;
  contentPaddingLeftMm?: number;
  contentPaddingRightMm?: number;
  hideCompanyHeader?: boolean;
  hideCustomerLabels?: boolean;
  hideTableHeader?: boolean;
  hideFooterTerms?: boolean;
  showBackgroundInPrint?: boolean;
  fontSizePt?: number;
  lineItemHeightMm?: number;
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
}: PdfStationeryOverlayTemplateProps) {
  const layout: PdfOverlayLayout = template?.overlayLayout || {};
  const bgDataUrl = template?.pdfBackgroundDataUrl || template?.backgroundUrl || '';
  const showBgInPrint = layout.showBackgroundInPrint !== false;
  const hideCompanyHeader = Boolean(layout.hideCompanyHeader);
  const hideFooterTerms = Boolean(layout.hideFooterTerms);
  const fontSizePt = layout.fontSizePt || 9.5;
  const paddingLeftMm = layout.contentPaddingLeftMm !== undefined ? layout.contentPaddingLeftMm : 10;
  const paddingRightMm = layout.contentPaddingRightMm !== undefined ? layout.contentPaddingRightMm : 10;
  const headerTopMm = layout.headerTopOffsetMm !== undefined ? layout.headerTopOffsetMm : 8;
  const customerTopMm = layout.customerTopOffsetMm !== undefined ? layout.customerTopOffsetMm : 40;
  const tableTopMm = layout.tableTopOffsetMm !== undefined ? layout.tableTopOffsetMm : 82;

  // 1. Calculate GST breakdown
  const rawItems = invoice.items || [];
  const items = rawItems.reduce((acc: typeof rawItems, item) => {
    const pId = item.product_id || '';
    const pName = (item.product_name || '').trim().toLowerCase();
    const price = Number(item.unit_price || 0);
    const tax = Number(item.tax_rate || 0);

    const existing = acc.find(
      (x) =>
        (pId && x.product_id === pId && Number(x.unit_price) === price) ||
        (!pId && (x.product_name || '').trim().toLowerCase() === pName && Number(x.unit_price) === price && Number(x.tax_rate) === tax)
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

  return (
    <div
      className="relative w-full min-h-[297mm] bg-white text-slate-900 font-sans print:min-h-0 print:h-auto"
      style={{
        fontSize: `${fontSizePt}pt`,
        lineHeight: 1.35,
      }}
    >
      {/* ── Exact Uploaded PDF / Scanned Stationery Background ── */}
      {bgDataUrl && (
        <div
          className={`absolute inset-0 pointer-events-none z-0 ${
            showBgInPrint ? 'print:block' : 'print:hidden'
          }`}
          style={{ width: '100%', height: '100%' }}
        >
          {bgDataUrl.startsWith('data:application/pdf') || bgDataUrl.endsWith('.pdf') ? (
            <object
              data={bgDataUrl}
              type="application/pdf"
              className="w-full h-full object-contain"
              style={{ width: '100%', height: '100%' }}
            >
              <embed src={bgDataUrl} type="application/pdf" className="w-full h-full" />
            </object>
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

      {/* ── Overlay Dynamic Content Layer ── */}
      <div
        className="relative z-10 w-full flex flex-col justify-between"
        style={{
          paddingLeft: `${paddingLeftMm}mm`,
          paddingRight: `${paddingRightMm}mm`,
          minHeight: '280mm',
        }}
      >
        <div>
          {/* Header Block */}
          {!hideCompanyHeader ? (
            <div
              className="flex justify-between items-start border-b border-slate-300 pb-3"
              style={{ paddingTop: `${headerTopMm}mm` }}
            >
              <div className="max-w-[60%] space-y-0.5">
                {f.showLogo && dynamicLogoUrl && (
                  <img
                    src={dynamicLogoUrl}
                    alt="Logo"
                    className="h-10 max-w-[140px] object-contain mb-1 rounded"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                )}
                <h2 className="font-extrabold text-base text-slate-900 leading-tight">
                  {dynamicStoreName}
                </h2>
                {dynamicAddress && <p className="text-[10px] text-slate-600 leading-tight">{dynamicAddress}</p>}
                <div className="flex flex-wrap gap-x-2 text-[10px] text-slate-600 font-medium">
                  {dynamicPhone && <span>Ph: {dynamicPhone}</span>}
                  {dynamicEmail && <span>Email: {dynamicEmail}</span>}
                </div>
                {sellerGstin && <p className="text-[10px] font-bold text-slate-900">GSTIN: {sellerGstin}</p>}
              </div>

              <div className="text-right space-y-1">
                <span className="text-[8.5px] font-black uppercase px-2 py-0.5 rounded border border-slate-300 bg-slate-100 text-slate-800 tracking-wider">
                  {invoice.copy_type || 'ORIGINAL FOR RECIPIENT'}
                </span>
                <h1 className="text-lg font-black tracking-tight uppercase text-slate-900">
                  {template.headerTitle || 'TAX INVOICE'}
                </h1>
                <div className="bg-slate-50/90 border border-slate-200 rounded p-1.5 inline-block text-right">
                  <p className="text-[11px] font-bold text-slate-900">Inv No: {invoice.invoice_number || '#INV'}</p>
                  <p className="text-[10px] text-slate-600">
                    Date: {formatDisplayDate(invoice.invoice_date || invoice.created_at || new Date())}
                  </p>
                  {invoice.eway_bill_number && (
                    <p className="text-[9px] font-mono font-bold text-emerald-800">
                      e-Way: {invoice.eway_bill_number}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* If letterhead header is pre-printed, just position Invoice Number & Date block on the right */
            <div
              className="flex justify-between items-start"
              style={{ paddingTop: `${headerTopMm}mm` }}
            >
              <div />
              <div className="text-right bg-white/90 backdrop-blur-xs p-2 rounded border border-slate-300 shadow-2xs">
                <span className="text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 tracking-wider block mb-1">
                  {invoice.copy_type || 'ORIGINAL FOR RECIPIENT'}
                </span>
                <p className="text-[11px] font-bold text-slate-900">Invoice: {invoice.invoice_number || '#INV'}</p>
                <p className="text-[10px] text-slate-600">
                  Date: {formatDisplayDate(invoice.invoice_date || invoice.created_at || new Date())}
                </p>
                {invoice.eway_bill_number && (
                  <p className="text-[9px] font-mono font-bold text-emerald-800">
                    e-Way: {invoice.eway_bill_number}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Customer Billed To / Shipped To Zone */}
          {f.showCustomerDetails && (
            <div
              className="grid grid-cols-3 gap-2 p-2.5 rounded-lg border border-slate-200 bg-white/95 backdrop-blur-xs shadow-2xs my-2 text-[10px]"
              style={{ marginTop: hideCompanyHeader ? `${customerTopMm}mm` : '2mm' }}
            >
              <div className="space-y-0.5">
                <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block">
                  Billed To
                </span>
                <h4 className="font-bold text-slate-900 text-[11px]">{invoice.customerName || 'Walk-in Customer'}</h4>
                {invoice.customerCompany && <p className="font-semibold text-slate-700">{invoice.customerCompany}</p>}
                {billingAddr && <p className="text-slate-600 leading-tight">{billingAddr}</p>}
                {invoice.customerPhone && <p className="text-slate-600">Ph: {invoice.customerPhone}</p>}
                {invoice.customerGST && <p className="font-bold text-slate-800">GSTIN: {invoice.customerGST}</p>}
              </div>

              <div className="space-y-0.5 border-l border-slate-200 pl-2.5">
                <span className="text-[8.5px] font-bold text-indigo-500 uppercase tracking-wider block">
                  Shipped To
                </span>
                <h4 className="font-bold text-slate-900 text-[11px]">
                  {invoice.customerCompany || invoice.customerName || 'Consignee'}
                </h4>
                <p className="text-slate-600 leading-tight">{shippingAddr || billingAddr || 'Same as billing'}</p>
                {invoice.customerPhone && <p className="text-slate-600">Contact: {invoice.customerPhone}</p>}
              </div>

              <div className="text-right space-y-0.5 border-l border-slate-200 pl-2.5 flex flex-col justify-between">
                <div>
                  <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block">
                    Place of Supply
                  </span>
                  <p className="font-bold text-slate-800 mt-0.5">
                    {isInterState
                      ? `${customerState.name} (${customerState.code}) - Inter-State`
                      : `${sellerState.name} (${sellerState.code}) - Intra-State`}
                  </p>
                </div>
                {invoice.payment_terms && (
                  <p className="text-[9px] text-slate-600">
                    <span className="font-bold">Terms: </span> {invoice.payment_terms}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Line Items Table */}
          <div
            className="overflow-hidden rounded-lg border border-slate-300 bg-white/95 backdrop-blur-xs shadow-2xs my-2"
            style={{ marginTop: hideCompanyHeader && !f.showCustomerDetails ? `${tableTopMm}mm` : '2mm' }}
          >
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="bg-slate-800 text-white font-bold text-left">
                  <th className="py-1.5 px-2.5 w-7 text-center">#</th>
                  <th className="py-1.5 px-2.5">Item Description</th>
                  {f.showHSN && <th className="py-1.5 px-2 text-center">HSN/SAC</th>}
                  <th className="py-1.5 px-2 text-center">Qty</th>
                  <th className="py-1.5 px-2 text-right">Rate</th>
                  <th className="py-1.5 px-2 text-right">Disc</th>
                  {f.showTaxSplit && <th className="py-1.5 px-2 text-right">Tax%</th>}
                  <th className="py-1.5 px-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {items.map((item, idx) => {
                  const qty = Number(item.quantity || 0);
                  const unitPrice = Number(item.unit_price || 0);
                  const mrpPrice = Number(item.mrp || 0);
                  const discVal = Number(item.discount_value || 0);
                  const taxRate = Number(item.tax_rate || 0);
                  const itemSub = qty * unitPrice;
                  const disc = item.discount_type === 'percent' ? (itemSub * discVal) / 100 : discVal;
                  const netAmount = itemSub - disc;

                  return (
                    <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/50' : ''}>
                      <td className="py-1.5 px-2.5 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-1.5 px-2.5">
                        <span className="font-bold text-slate-900 block">{item.product_name || 'Item'}</span>
                        {(item.description || item.custom_note || item.notes) && (
                          <span className="text-[9px] text-slate-600 block mt-0.5 whitespace-pre-line font-normal leading-tight">
                            {item.description || item.custom_note || item.notes}
                          </span>
                        )}
                        {mrpPrice > unitPrice && (
                          <span className="text-[8.5px] text-slate-500">
                            MRP: {currency.symbol}{mrpPrice.toFixed(2)}
                          </span>
                        )}
                      </td>
                      {f.showHSN && (
                        <td className="py-1.5 px-2 text-center font-mono text-slate-600 text-[9px]">
                          {item.hsn_code || '—'}
                        </td>
                      )}
                      <td className="py-1.5 px-2 text-center font-bold text-slate-800">{qty}</td>
                      <td className="py-1.5 px-2 text-right text-slate-700">
                        {currency.symbol}{unitPrice.toFixed(2)}
                      </td>
                      <td className="py-1.5 px-2 text-right text-emerald-600 font-semibold">
                        {disc > 0 ? `-${currency.symbol}${disc.toFixed(2)}` : '—'}
                      </td>
                      {f.showTaxSplit && (
                        <td className="py-1.5 px-2 text-right text-slate-600 font-medium">
                          {taxRate}%
                        </td>
                      )}
                      <td className="py-1.5 px-2.5 text-right font-bold text-slate-900">
                        {currency.symbol}{netAmount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* GST Slabs Breakdown */}
          {f.showTaxSplit && gstBreakdown.slabsBreakdown.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white/95 backdrop-blur-xs p-2 my-2 text-[9.5px]">
              <div className="flex justify-between items-center font-bold text-slate-700 mb-1 border-b border-slate-200 pb-1">
                <span>Tax Breakdown ({isInterState ? 'IGST' : 'CGST + SGST'})</span>
                <span>Place of Supply: {customerState.name}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-slate-600">
                {gstBreakdown.slabsBreakdown.map((s, idx) => (
                  <div key={idx} className="bg-slate-50 p-1 rounded border border-slate-200">
                    <span className="font-bold text-slate-800 block">GST @ {s.rate}%</span>
                    <span>Taxable: {currency.symbol}{s.taxableAmount.toFixed(2)}</span>
                    <span className="block font-semibold text-slate-900">
                      Tax: {currency.symbol}{s.totalTax.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Zone: Totals, Bank, QR, Terms, Signatures */}
        <div className="pt-2 border-t border-slate-300 mt-2 bg-white/95 backdrop-blur-xs rounded-lg p-2.5">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-7 space-y-2 text-[9.5px]">
              {dynamicBank && (
                <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                  <span className="font-bold text-slate-700 block uppercase text-[8.5px]">Bank Details</span>
                  <p className="font-mono text-slate-800 leading-tight whitespace-pre-line">{dynamicBank}</p>
                </div>
              )}

              {paymentQrSrc && (
                <div className="flex items-center gap-2 p-1.5 bg-purple-50 border border-purple-200 rounded">
                  <img src={paymentQrSrc} alt="UPI QR" className="size-12 object-contain bg-white rounded p-0.5" />
                  <div>
                    <span className="font-bold text-purple-900 block text-[9px]">⚡ SCAN TO PAY VIA UPI</span>
                    <span className="font-black text-[11px] text-slate-900">
                      {currency.symbol}{targetAmount.toFixed(2)}
                    </span>
                    {resolvedUpiVpa && <span className="text-[8.5px] text-purple-700 font-mono block">{resolvedUpiVpa}</span>}
                  </div>
                </div>
              )}

              {!hideFooterTerms && (
                <div>
                  <span className="font-bold text-slate-400 uppercase text-[8px] block">Terms & Conditions</span>
                  <p className="text-[8.5px] text-slate-500 whitespace-pre-line leading-tight">
                    {invoice?.terms || template.termsText || '1. Goods once sold will not be taken back.\n2. Disputes subject to local jurisdiction.'}
                  </p>
                </div>
              )}
            </div>

            <div className="col-span-5 bg-slate-50 border border-slate-200 p-2 rounded space-y-1 text-[10px]">
              <div className="flex justify-between font-semibold">
                <span>Taxable Subtotal:</span>
                <span>{currency.symbol}{taxableSubtotal.toFixed(2)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Discount:</span>
                  <span>-{currency.symbol}{totalDiscount.toFixed(2)}</span>
                </div>
              )}
              {totalTax > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Total Tax ({isInterState ? 'IGST' : 'CGST+SGST'}):</span>
                  <span>{currency.symbol}{totalTax.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1 border-t border-slate-300 font-black text-[11.5px] text-slate-900">
                <span>GRAND TOTAL:</span>
                <span className="text-blue-700">{currency.symbol}{grandTotal.toFixed(2)}</span>
              </div>
              {invoice.amount_received !== undefined && Number(invoice.amount_received) > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold pt-0.5 border-t border-slate-200">
                  <span>Paid:</span>
                  <span>{currency.symbol}{Number(invoice.amount_received).toFixed(2)}</span>
                </div>
              )}
              {balanceDue > 0 && (
                <div className="flex justify-between text-red-600 font-bold">
                  <span>Balance Due:</span>
                  <span>{currency.symbol}{balanceDue.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between items-end pt-3 mt-2 border-t border-slate-200">
            <span className="text-[8.5px] text-slate-500">
              {template.footerText || 'Thank you for your business!'}
            </span>
            {f.showSignature && (
              <div className="text-center">
                <div className="h-6 border-b border-slate-400 w-32 mb-0.5"></div>
                <span className="text-[8.5px] font-bold text-slate-700 uppercase tracking-wider block">
                  Authorized Signatory
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
