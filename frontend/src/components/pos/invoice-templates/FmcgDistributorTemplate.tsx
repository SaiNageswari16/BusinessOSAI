import React from 'react';
import { useI18n } from "@/contexts/i18n-context";
import type { FullInvoiceData } from '../FullInvoicePrinter';
import { numberToIndianWords } from '@/lib/number-to-words';
import { formatDisplayDate } from '@/lib/utils';
import { getOrgSignatureSettings, getActiveBillingGst } from '@/lib/receipt-template-store';
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
} from '@/lib/invoice-template-config';
import { generateQRCodeSVG } from '@/lib/qr-generator';
import { PaymentQrBlock, type PaymentQrContext } from './PaymentQrBlock';
import { CustomerExtrasBlock } from './CustomerExtrasBlock';

interface TemplateProps {
  invoice: FullInvoiceData;
  dynamicStoreName: string;
  dynamicLogoUrl: string;
  dynamicAddress: string;
  dynamicPhone: string;
  dynamicEmail?: string;
  sellerGstin: string;
  sellerStateCode: string;
  dynamicBank?: string;
  currency: { symbol: string; code: string };
  f?: any;
  texts?: InvoiceTexts;
  paymentQr?: PaymentQrContext;
  template?: any;
  paperSize?: 'A4' | 'A5';
  orientation?: 'portrait' | 'landscape';
}

export function FmcgDistributorTemplate({
  invoice,
  dynamicStoreName,
  dynamicLogoUrl,
  dynamicAddress,
  dynamicPhone,
  sellerGstin,
  sellerStateCode,
  dynamicBank,
  currency,
  f = {},
  texts,
  paymentQr,
  template,
  paperSize = 'A4',
  orientation = 'portrait',
}: TemplateProps) {
  const { t } = useI18n();
  const items = invoice.items || [];
  const texts_ = texts || resolveInvoiceTexts(template, 'fmcg_distributor');
  const templateColumns: NormalizedTemplateColumn[] = resolveTemplateColumns(template, (template as any)?.columns, f, texts_);
  const customRows = resolveCustomFieldRows(template, invoice, f);
  const showTaxSplitFmcg = f?.showTaxSplit !== false;
  const fmcgColAlign = (col: NormalizedTemplateColumn) =>
    col.align === 'left' ? 'text-left' : col.align === 'right' ? 'text-right' : 'text-center';
  const fmcgColWidth = (col: NormalizedTemplateColumn) =>
    col.widthPercent ? { width: col.widthPercent + '%' } : undefined;

  type FmcgToken = { kind: 'img' } | { kind: 'data'; col: NormalizedTemplateColumn };
  // FMCG plan: static image column (when enabled) + user-driven data columns.
  // sno / description / img row-span the 2nd (tax-split) header row.
  const fmcgCells: FmcgToken[] = [
    ...(f?.showProductImage ? [{ kind: 'img' as const }] : []),
    ...templateColumns.map((col) => ({ kind: 'data' as const, col })),
  ];
  const fmcgRowSpans = (tok: FmcgToken) =>
    showTaxSplitFmcg && (tok.kind === 'img' || tok.col.fieldKey === 'sno' || tok.col.fieldKey === 'description');
  const fmcgNonSpans = fmcgCells.filter((tok) => !fmcgRowSpans(tok));
  const FMCG_SUB_LABELS = ['Taxable Amt', 'CGST %', 'CGST Amt', 'SGST %', 'SGST Amt'];

  const renderFmcgCell = (tok: FmcgToken, ctx: { it: any; idx: number; qty: number; mrp: number; displayRate: number; disc: number; netAmount: number; taxableAmt: number; taxVal: number; halfTax: number; taxRate: number }): React.ReactNode => {
    if (tok.kind === 'img') return <span className="text-[9px]">📦</span>;
    const { it, idx, qty, mrp, displayRate, disc, netAmount, taxableAmt, taxVal, halfTax, taxRate } = ctx;
    switch (tok.col.fieldKey) {
      case 'sno': return idx + 1;
      case 'description':
        return (
          <>
            <span className="font-sans font-bold">{it.product_name || 'Item'}</span>
            {f?.showItemDescription !== false && (it.custom_note || it.description || it.notes) && (
              <span className="text-[7.5px] text-gray-600 block mt-0.5 font-normal leading-tight">
                {it.custom_note || it.description || it.notes}
              </span>
            )}
            {f?.showSKU && <span className="text-[6.5px] text-slate-500 block">SKU: {it.hsn_code || 'FMCG-01'}</span>}
          </>
        );
      case 'uom':
        return (
          <span className="font-bold">
            {it.selected_uom || it.uom || 'PAC'}
            {it.secondary_uom && (
              <span className="block text-[6.5px] font-black text-gray-500">
                {it.selected_uom === it.secondary_uom ? 'Sec' : 'Pri'}
              </span>
            )}
          </span>
        );
      case 'mrp': return mrp.toFixed(2);
      case 'unit_price':
      case 'selling_price': return displayRate.toFixed(2);
      case 'quantity': return qty.toFixed(2);
      case 'gross_amount': return taxableAmt.toFixed(2);
      case 'free_qty': return '0.00';
      case 'discount': return disc > 0 ? disc.toFixed(2) : '0.00';
      case 'tax_rate': return taxRate ? `${taxRate}%` : '0.00';
      case 'cgst': return halfTax.toFixed(2);
      case 'sgst': return halfTax.toFixed(2);
      case 'igst': return taxVal.toFixed(2);
      case 'total_amount': return netAmount.toFixed(2);
      default: return cellValueForColumn(tok.col, it, invoice).text;
    }
  };
  const grandTotal = Number(invoice.grand_total || invoice.total_amount || 0);
  const isA5 = paperSize === 'A5';

  const sigSettings = getOrgSignatureSettings() as any;
  const activeGst = getActiveBillingGst() as any;
  const signatureUrl = sigSettings.showDigitalSignature !== false && sigSettings.show_digital_signature !== false ? (sigSettings.signatureUrl || sigSettings.signature_url || activeGst?.signature_url) : null;
  const stampUrl = sigSettings.showDigitalStamp !== false && sigSettings.show_digital_stamp !== false ? (sigSettings.stampUrl || sigSettings.stamp_url || activeGst?.stamp_url) : null;
  const sigTitle = sigSettings.signatureTitle || sigSettings.signature_title || activeGst?.signature_title || "Authorised Signatory";
  const sigCompany = sigSettings.signatureCompanyName || sigSettings.signature_company_name || dynamicStoreName;
  const taxableSubtotal = Number(invoice.taxable_value || invoice.subtotal || grandTotal * 0.85);
  const totalTax = Number(invoice.tax_amount || (invoice.cgst_amount || 0) + (invoice.sgst_amount || 0) || (grandTotal - taxableSubtotal));
  const totalCgst = Number(invoice.cgst_amount || totalTax / 2);
  const totalSgst = Number(invoice.sgst_amount || totalTax / 2);

  const formattedDate = formatDisplayDate(invoice.invoice_date || invoice.created_at || new Date());
  const activeGstAny = activeGst as any;
  const panNumber = activeGstAny?.pan || (sellerGstin && sellerGstin.length >= 12 ? sellerGstin.slice(2, 12) : '');

  const isQuotation =
    invoice.doc_type === "quotation" ||
    invoice.invoice_type === "QUOTATION" ||
    String(invoice.invoice_number || "").toUpperCase().startsWith("QT-") ||
    Boolean((invoice as any).quote_number);
  const isEstimate =
    invoice.doc_type === "estimate" ||
    invoice.invoice_type === "ESTIMATE_NON_GST" ||
    String(invoice.invoice_number || "").toUpperCase().startsWith("EST-");
  const docTitle = docTitleFor(invoice, texts_, template);
  const docNumLabel = `${docNoLabelFor(invoice, texts_)} : `;
  const docDateLabel = `${docDateLabelFor(invoice, texts_)}: `;

  // Full-page sheet height so the template fills the whole A4/A5 page and the
  // footer pins to the bottom (no ~75% sheet with blank space below).
  // Exact printable-area heights @96dpi (page − @page margins), so the sheet
  // fills the page with zero overflow to a 2nd page.
  // Full-page sheet (mm = print-physical, matches @page): A4 289mm,
  // A4-land 202mm, A5 205mm, A5-land 143mm. `tpl-sheet-full` exempts this
  // from the print rule that zeroes min-heights (the ~75% sheet bug).
  const sheetMinH = isA5
    ? (orientation === 'landscape' ? 'min-h-[143mm]' : 'min-h-[205mm]')
    : (orientation === 'landscape' ? 'min-h-[202mm]' : 'min-h-[289mm]');
  return (
    <div className={`w-full bg-transparent text-black font-sans ${isA5 ? 'text-[8px] leading-tight p-0.5' : 'text-[10px] leading-tight p-1'} border border-black/40 rounded-md selection:bg-none flex flex-col tpl-sheet-full ${sheetMinH}`}>
      {/* ─── TOP TITLE BAR ─── */}
      <div className={`flex justify-between items-center ${isA5 ? 'text-[7.5px] pb-0.5 mb-0.5 px-0.5' : 'text-[9px] pb-0.5 mb-1 px-1'} font-bold border-b border-black`}>
        <span className="font-extrabold uppercase text-blue-900 border border-black/60 px-1 py-0.2 rounded bg-black/5">
          {invoice.copy_type || "ORIGINAL FOR RECIPIENT"}
        </span>
        <span className={`${isA5 ? 'text-[10px]' : 'text-xs'} font-black tracking-wider uppercase`}>{docTitle}</span>
        <span>Page No: 1 of 1</span>
      </div>

      {/* ─── COMPANY PROFILE HEADER ─── */}
      {f?.showCompanyDetails !== false && (
        <div className={`grid grid-cols-12 gap-1.5 border-b border-black ${isA5 ? 'pb-0.5 px-0.5' : 'pb-1 px-1'}`}>
          <div className="col-span-7">
            <div className="flex items-center gap-1.5">
              {f?.showLogo !== false && dynamicLogoUrl && dynamicLogoUrl !== '/Logo.png' && (
                <img src={dynamicLogoUrl} alt="Logo" className={`${isA5 ? 'h-5 max-w-[50px]' : 'h-7 max-w-[70px]'} object-contain`} />
              )}
              <h1 className={`font-extrabold ${isA5 ? 'text-[10px]' : 'text-xs'} uppercase tracking-tight text-slate-900`}>
                {dynamicStoreName}
              </h1>
            </div>
            {dynamicAddress && (
              <p className={`${isA5 ? 'text-[7.5px]' : 'text-[9px]'} text-gray-700 leading-tight mt-0.5`}>
                {dynamicAddress}
              </p>
            )}
            {(activeGst as any)?.cin && (
              <p className={`${isA5 ? 'text-[7.5px]' : 'text-[9px]'} text-gray-700`}>CIN: {(activeGst as any).cin}</p>
            )}
          </div>

          <div className={`col-span-5 text-right font-mono ${isA5 ? 'text-[7.5px] space-y-0' : 'text-[9px] space-y-0.5'}`}>
            <p className="font-bold">{texts_.gstinLabel}: <span className="font-extrabold">{sellerGstin || '—'}</span></p>
            {dynamicPhone && <p>{texts_.phoneLabel}: {dynamicPhone}</p>}
            {panNumber && <p>PAN: <span className="font-bold">{panNumber}</span></p>}
          </div>
        </div>
      )}

      {/* ─── META BAR ─── */}
      {f?.showInvoiceDetails !== false && (
        <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-black ${isA5 ? 'text-[7.5px] py-0.5 px-0.5' : 'text-[9px] py-1 px-1'} font-mono bg-black/5`}>
          <div><span className="font-sans font-bold">{docNumLabel}</span>{invoice.invoice_number || (isQuotation ? 'QT-0001' : 'B/26-27/010451')}</div>
          <div><span className="font-sans font-bold">{docDateLabel}</span>{formattedDate}</div>
          {f?.showPoNumber !== false && (
            <div><span className="font-sans font-bold">PO / Order Ref: </span>{invoice.po_number || invoice.order_number || '-'}</div>
          )}
          {f?.showPaymentDetails !== false && (
            <div><span className="font-sans font-bold">Pymt Mode: </span>{invoice.payment_method || 'Cash'}</div>
          )}
          {f?.showEwayBill !== false && (
            <div><span className="font-sans font-bold">e-Way Bill: </span>{invoice.eway_bill_number || '-'}</div>
          )}
          {f?.showVehicleNumber !== false && invoice.vehicle_number && (
            <div><span className="font-sans font-bold">Vehicle No: </span>{invoice.vehicle_number}</div>
          )}
          {f?.showChallanNumber !== false && invoice.challan_number && (
            <div><span className="font-sans font-bold">Challan No: </span>{invoice.challan_number}</div>
          )}
          {customRows.length > 0 && (
            <div className={`flex flex-wrap items-center gap-x-4 gap-y-0.5 ${isA5 ? '' : ''}`}>
              {customRows.map((row, rIdx) => (
                <div key={rIdx}><span className="font-sans font-bold">{row.label}: </span><span className="font-bold">{row.value}</span></div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── BILLED TO / SHIPPED TO DUAL COLUMNS ─── */}
      {f?.showCustomerDetails !== false && (
        <div className={`grid grid-cols-2 border-b border-black ${isA5 ? 'text-[7.5px] leading-tight' : 'text-[9px] leading-snug'}`}>
          <div className={`${isA5 ? 'p-0.5' : 'p-1'} border-r border-black space-y-0.5`}>
            <p className="font-bold font-sans">Billed To : <span className="font-mono">{invoice.customerName || 'Customer'}</span></p>
            <p>Address : {invoice.customerBillingAddress || invoice.customerAddress || '-'}</p>
            <p className="font-mono font-bold">GSTIN : {invoice.customerGST || 'UNREGISTERED'}</p>
            {f?.showPartyBalance && (
              <p className="text-[7.5px] font-bold text-red-600">{texts_.outstandingLabel}: {currency.symbol}{Number(invoice.party_previous_balance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            )}
            <div className={`grid grid-cols-2 ${isA5 ? 'text-[7px]' : 'text-[8px]'} pt-0.5`}>
              <p>State : {invoice.customerState || invoice.shipping_state || invoice.billing_state || `${sellerStateCode || '36'}`}</p>
              <p>PO Date : {invoice.po_date ? formatDisplayDate(invoice.po_date) : formattedDate}</p>
              <p>Vehicle : {invoice.vehicle_number || '-'}</p>
              <p>Cust Contact: {invoice.customerPhone || '-'}</p>
            </div>
            <CustomerExtrasBlock invoice={invoice} texts={texts_} className="text-gray-800" />
          </div>

          <div className={`${isA5 ? 'p-0.5' : 'p-1'} space-y-0.5`}>
            <p className="font-bold font-sans">Shipped To : <span className="font-mono">{invoice.customerCompany || invoice.customerName || 'Customer'}</span></p>
            <p>Address : {invoice.customerShippingAddress || invoice.customerBillingAddress || invoice.customerAddress || 'Same as Billed Address'}</p>
            <p className="font-mono font-bold">GSTIN : {invoice.customerGST || 'UNREGISTERED'}</p>
            <div className={`grid grid-cols-2 ${isA5 ? 'text-[7px]' : 'text-[8px]'} pt-0.5`}>
              <p>Driver / Transport : {invoice.transporter_name || invoice.driver_phone || '-'}</p>
              <p>e-Way Bill No : {invoice.eway_bill_number || '-'}</p>
              <p>Due Date : {formatDisplayDate(invoice.due_date || invoice.invoice_date || new Date())}</p>
              <p>Ack. Date : {formattedDate}</p>
            </div>
          </div>
        </div>
      )}

      {/* ─── MULTI-ROW FMCG ITEM TABLE ─── */}
      {f?.showItemTable !== false && (
        <div className={`${isA5 ? 'min-h-[80px]' : 'min-h-[160px]'} print:min-h-0`}>
          <table className={`w-full border-collapse ${isA5 ? 'text-[7px]' : 'text-[8px]'} font-mono`}>
            <thead>
              <tr className="border-b border-black font-sans font-bold text-center bg-black/5">
                {fmcgCells.map((tok, ti) => {
                  const span = fmcgRowSpans(tok);
                  const isLast = ti === fmcgCells.length - 1;
                  const cls = `p-0.5 ${isLast ? '' : 'border-r border-black'} ${tok.kind === 'data' ? fmcgColAlign(tok.col) : 'text-center'} ${span ? '' : 'border-b border-black/40'}`;
                  if (span) {
                    return (
                      <th key={ti} className={cls} rowSpan={showTaxSplitFmcg ? 2 : 1}>
                        {tok.kind === 'img' ? texts_.imgLabel : (
                          <>
                            {tok.col.headerTitle}
                            {f?.showHSN !== false && <><br /><span className="font-normal text-[7px]">{texts_.colHsn} | Qty in SUOM</span></>}
                          </>
                        )}
                      </th>
                    );
                  }
                  return <th key={ti} className={cls} style={tok.kind === 'data' ? fmcgColWidth(tok.col) : undefined}>{tok.kind === 'data' ? tok.col.headerTitle : texts_.imgLabel}</th>;
                })}
              </tr>
              {showTaxSplitFmcg && (
                <tr className="border-b border-black font-sans font-semibold text-center bg-black/[0.03] text-[7px]">
                  {fmcgNonSpans.map((tok, ni) => (
                    <th key={ni} className={`p-0.5 ${ni < fmcgNonSpans.length - 1 ? 'border-r border-black' : ''}`}>
                      {FMCG_SUB_LABELS[ni] || ''}
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const qty = Number(it.quantity || 1);
                const rate = Number(it.unit_price || 0);
                const mrp = Number(it.mrp || rate * 1.15);
                const disc = Number(it.discount_value || 0);
                const isIncl = it.is_tax_inclusive === true || (it as any).is_inclusive === true || invoice.is_tax_inclusive === true;
                const taxRate = it.tax_rate !== undefined && it.tax_rate !== null ? Number(it.tax_rate) : 0;
                const halfTax = taxRate / 2;

                let taxableAmt = 0;
                let taxVal = 0;
                let netAmount = 0;
                let displayRate = rate;

                if (isIncl && taxRate > 0) {
                  netAmount = qty * rate - disc;
                  taxableAmt = netAmount / (1 + taxRate / 100);
                  taxVal = (netAmount - taxableAmt) / 2;
                  displayRate = rate / (1 + taxRate / 100);
                } else {
                  taxableAmt = qty * rate - disc;
                  taxVal = (taxableAmt * halfTax) / 100;
                  netAmount = taxableAmt + taxVal * 2;
                  displayRate = rate;
                }
                const totalTaxAmt = taxVal * 2;
                const ctx = { it, idx, qty, mrp, displayRate, disc, netAmount, taxableAmt, taxVal, halfTax, taxRate };
                const subRowValue = (ni: number): React.ReactNode => {
                  if (ni === 0) return <span className="text-left text-[7px]">{f?.showHSN !== false ? (it.hsn_code || '19053100') : ''} | {(qty * 0.1).toFixed(3)}KG</span>;
                  const sub = [taxableAmt.toFixed(2), halfTax.toFixed(2), taxVal.toFixed(2), halfTax.toFixed(2), taxVal.toFixed(2)];
                  return sub[ni - 1] ?? totalTaxAmt.toFixed(2);
                };

                return (
                  <React.Fragment key={idx}>
                    <tr className="border-t border-gray-200">
                      {fmcgCells.map((tok, ti) => {
                        const isLast = ti === fmcgCells.length - 1;
                        const span = fmcgRowSpans(tok);
                        let cls = `p-0.5 ${isLast ? '' : 'border-r border-black'} ${tok.kind === 'data' ? fmcgColAlign(tok.col) : 'text-center'}`;
                        if (tok.kind === 'data' && tok.col.fieldKey === 'description') cls += ' font-sans font-bold text-left';
                        else if (tok.kind === 'data' && (tok.col.fieldKey === 'quantity' || tok.col.fieldKey === 'uom')) cls += ' font-bold';
                        else if (tok.kind === 'data' && tok.col.fieldKey === 'total_amount') cls += ' font-bold';
                        return (
                          <td key={ti} className={cls} rowSpan={span ? (showTaxSplitFmcg ? 2 : 1) : undefined}>
                            {renderFmcgCell(tok, ctx)}
                          </td>
                        );
                      })}
                    </tr>
                    {showTaxSplitFmcg && (
                      <tr className="border-b border-gray-300 text-gray-600 bg-black/[0.02]">
                        {fmcgNonSpans.map((tok, ni) => (
                          <td key={ni} className={`p-0.5 ${ni < fmcgNonSpans.length - 1 ? 'border-r border-black' : ''} ${tok.kind === 'data' ? fmcgColAlign(tok.col) : 'text-center'}`}>
                            {subRowValue(ni)}
                          </td>
                        ))}
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── SUMMARY TOTALS BAR ─── */}
      <div className="grid grid-cols-6 border-t-2 border-b border-black p-1 text-[9px] font-mono bg-black/5 font-bold">
        <div><span className="font-sans">Items Sold: </span>{items.length || 1}</div>
        <div><span className="font-sans">Disc: </span>0.00</div>
        <div><span className="font-sans">Taxable: </span>{taxableSubtotal.toFixed(2)}</div>
        {f?.showTaxSplit !== false && <div><span className="font-sans">Total Tax: </span>{totalTax.toFixed(2)}</div>}
        <div className="col-span-2 text-right font-black text-[10px]">{currency.symbol}{grandTotal.toFixed(2)}</div>
      </div>

      {/* ─── TAX BREAKDOWN & ADJUSTMENTS ─── */}
      {f?.showTaxSplit !== false && (
        <div className="grid grid-cols-12 border-b border-black text-[8px]">
          <div className="col-span-8 p-1 border-r border-black">
            <table className="w-full border border-black border-collapse text-center font-mono">
              <thead>
                <tr className="bg-black/5 border-b border-black font-sans font-bold">
                  <th className="p-0.5 border-r border-black">Rate%</th>
                  <th className="p-0.5 border-r border-black">Taxable Amt</th>
                  <th className="p-0.5 border-r border-black">CGST</th>
                  <th className="p-0.5 border-r border-black">SGST</th>
                  <th className="p-0.5">Total Tax</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="p-0.5 border-r border-black font-bold">18.00%</td>
                  <td className="p-0.5 border-r border-black text-right">{taxableSubtotal.toFixed(2)}</td>
                  <td className="p-0.5 border-r border-black text-right">{totalCgst.toFixed(2)}</td>
                  <td className="p-0.5 border-r border-black text-right">{totalSgst.toFixed(2)}</td>
                  <td className="p-0.5 text-right font-bold">{totalTax.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            <p className="font-black text-[9px] uppercase font-sans mt-2">
              {numberToIndianWords(grandTotal)}
            </p>
          </div>

          <div className="col-span-4 p-1 font-mono text-[8px] space-y-0.5 flex flex-col justify-between">
            <div className="space-y-0.5">
              <div className="flex justify-between"><span className="font-sans">TCS u/s 206C(1H) :</span><span>0.00</span></div>
              <div className="flex justify-between"><span className="font-sans">Credit Adj :</span><span>0.00</span></div>
              <div className="flex justify-between"><span className="font-sans">Round Off Amt :</span><span>0.00</span></div>
            </div>
            <div className="border-t border-black pt-1 flex justify-between font-black text-[10px]">
              <span className="font-sans">Net Payable :</span>
              <span>{currency.symbol}{grandTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-[8.5px] text-gray-800 pt-0.5">
              <span className="font-sans">Total Billed Qty :</span>
              <span>{items.reduce((s, i) => s + Number(i.quantity || 1), 0)} Units</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── FSSAI STATUTORY DECLARATION, TERMS & SIGNATURE (pinned to page bottom) ─── */}
      <div className="grid grid-cols-12 p-1.5 text-[8px] mt-auto">
        <div className="col-span-8 pr-2 space-y-0.5 text-gray-700">
          {f?.showTerms !== false && (
            <>
              <p className="font-bold text-black font-sans">
                Statutory Declaration under FSS Act 2006:
              </p>
              <p className="leading-tight text-[7.5px]">
                I/We hereby certify that food/foods mentioned in this invoice is/are warranted to be of the nature and quality which it/these purports/purported to be.
              </p>
            </>
          )}
          {f?.showPaymentDetails !== false && dynamicBank && (
            <p className="text-[7.5px] font-mono text-gray-600 mt-1">
              {texts_.bankDetailsLabel}: {dynamicBank}
            </p>
          )}
          {paymentQr && (
            <div className="mt-1.5">
              <PaymentQrBlock paymentQr={paymentQr} texts={texts_} currency={currency} compact />
            </div>
          )}
        </div>
        {f?.showSignature !== false && (
          <div className="col-span-4 text-right flex flex-col justify-between pt-1">
            <span className="font-bold text-black font-sans uppercase">FOR {sigCompany}</span>
            <div className="pt-2 flex flex-col items-end">
              <div className="relative w-32 h-12 flex items-center justify-end">
                {stampUrl && (
                  <img
                    src={stampUrl}
                    alt="Seal Stamp"
                    className="absolute right-4 top-0 max-h-12 max-w-20 object-contain opacity-75 rotate-[-6deg] pointer-events-none"
                  />
                )}
                {signatureUrl && (
                  <img
                    src={signatureUrl}
                    alt="Signature"
                    className="relative z-10 max-h-10 max-w-28 object-contain"
                  />
                )}
              </div>
              <span className="font-bold text-black font-sans border-t border-black pt-0.5 inline-block min-w-[120px] text-center">
                {sigTitle}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
