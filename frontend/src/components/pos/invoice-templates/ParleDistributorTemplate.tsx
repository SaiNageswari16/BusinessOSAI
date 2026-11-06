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
  dynamicEmail: string;
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

export function ParleDistributorTemplate({
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
  paperSize = 'A4',
  orientation = 'portrait',
}: TemplateProps) {
  const { t } = useI18n();
  const texts_ = texts || resolveInvoiceTexts(template, 'parle_teal');
  const templateColumns: NormalizedTemplateColumn[] = resolveTemplateColumns(template, (template as any)?.columns, f, texts_);
  const customRows = resolveCustomFieldRows(template, invoice, f);
  const parleColAlign = (col: NormalizedTemplateColumn) =>
    col.align === 'left' ? 'text-left' : col.align === 'right' ? 'text-right' : 'text-center';
  const parleColWidth = (col: NormalizedTemplateColumn) =>
    col.widthPercent ? { width: col.widthPercent + '%' } : undefined;

  // Per-item cell renderer: preserves Parle's compound rendering (description
  // sub-lines, qty with Pri/Sec unit) for standard fieldKeys and falls back to
  // the generic value resolver for custom / user-defined columns.
  const renderParleCell = (
    tok: { kind: 'img' } | { kind: 'data'; col: NormalizedTemplateColumn },
    ctx: { it: any; idx: number; qty: number; mrp: number; displayRate: number; disc: number; totalAmt: number; taxable: number; halfTax: number; taxVal: number; taxRate: number }
  ): React.ReactNode => {
    if (tok.kind === 'img') {
      return (
        <div className="w-5 h-5 rounded bg-slate-100 border border-slate-300 mx-auto flex items-center justify-center text-[8px]">
          🍪
        </div>
      );
    }
    const { it, idx, qty, mrp, displayRate, disc, totalAmt, taxable, halfTax, taxVal, taxRate } = ctx;
    switch (tok.col.fieldKey) {
      case 'sno': return <span className="font-sans">{idx + 1}.</span>;
      case 'description':
        return (
          <>
            <span className="font-sans font-bold">{it.product_name || 'Goods'}</span>
            {f.showItemDescription !== false && (it.custom_note || it.description || it.notes) && (
              <span className="text-[8px] text-gray-600 block mt-0.5 font-normal leading-tight">
                {it.custom_note || it.description || it.notes}
              </span>
            )}
            {f.showSKU && (
              <span className="text-[7px] text-gray-500 block mt-0.5 font-mono">
                SKU: {(it as any).sku || `PARLE-${idx + 101}`}
              </span>
            )}
          </>
        );
      case 'quantity':
        return (
          <>
            <div className="font-bold">{qty.toFixed(3)}</div>
            {it.secondary_uom && (
              <span className="block text-[7px] font-black text-gray-600">
                {it.selected_uom === it.secondary_uom ? 'Sec' : 'Pri'}
              </span>
            )}
          </>
        );
      case 'unit_price':
      case 'selling_price': return displayRate.toFixed(2);
      case 'mrp': return mrp.toFixed(2);
      case 'discount': return disc > 0 ? disc.toFixed(2) : '0.00';
      case 'gross_amount': return taxable.toFixed(2);
      case 'tax_rate': return `${taxRate}%`;
      case 'cgst': return <span className="font-bold">{halfTax.toFixed(2)} {taxVal.toFixed(2)}</span>;
      case 'sgst': return <span className="font-bold">{halfTax.toFixed(2)} {taxVal.toFixed(2)}</span>;
      case 'igst': return <span className="font-bold">{taxVal.toFixed(2)}</span>;
      case 'total_amount': return <span className="font-bold">{totalAmt.toFixed(2)}</span>;
      default: return cellValueForColumn(tok.col, it, invoice).text;
    }
  };

  type ParleTok = { kind: 'img' } | { kind: 'data'; col: NormalizedTemplateColumn };
  // Parle plan: static image column (when enabled) + user-driven data columns.
  const parleCells: ParleTok[] = [
    ...(f.showProductImage ? [{ kind: 'img' as const }] : []),
    ...templateColumns.map((col) => ({ kind: 'data' as const, col })),
  ];

  const isA5 = paperSize === 'A5';
  const items = invoice.items || [];
  const grandTotal = Number(invoice.grand_total || invoice.total_amount || 0);
  const taxableSubtotal = Number(invoice.taxable_value || invoice.subtotal || grandTotal * 0.85);

  const sigSettings = getOrgSignatureSettings() as any;
  const activeGst = getActiveBillingGst() as any;
  const signatureUrl = sigSettings.showDigitalSignature !== false && sigSettings.show_digital_signature !== false ? (sigSettings.signatureUrl || sigSettings.signature_url || activeGst?.signature_url) : null;
  const stampUrl = sigSettings.showDigitalStamp !== false && sigSettings.show_digital_stamp !== false ? (sigSettings.stampUrl || sigSettings.stamp_url || activeGst?.stamp_url) : null;
  const sigTitle = sigSettings.signatureTitle || sigSettings.signature_title || activeGst?.signature_title || "Authorised Signatory";
  const sigCompany = sigSettings.signatureCompanyName || sigSettings.signature_company_name || dynamicStoreName;

  const taxSlabs: Record<number, { taxable: number; cgst: number; sgst: number; totalGst: number }> = {
    5: { taxable: 0, cgst: 0, sgst: 0, totalGst: 0 },
    12: { taxable: 0, cgst: 0, sgst: 0, totalGst: 0 },
    18: { taxable: 0, cgst: 0, sgst: 0, totalGst: 0 },
    28: { taxable: 0, cgst: 0, sgst: 0, totalGst: 0 },
  };

  items.forEach((item) => {
    const qty = Number(item.quantity || 1);
    const rate = Number(item.unit_price || 0);
    const taxRate = item.tax_rate !== undefined && item.tax_rate !== null ? Number(item.tax_rate) : 0;
    const discVal = Number(item.discount_value || 0);
    const isIncl = item.is_tax_inclusive === true || (item as any).is_inclusive === true || invoice.is_tax_inclusive === true;
    const grossAmt = qty * rate;
    const netTotal = grossAmt - discVal;

    let taxable = 0;
    let gstVal = 0;

    if (isIncl && taxRate > 0) {
      taxable = netTotal / (1 + taxRate / 100);
      gstVal = netTotal - taxable;
    } else {
      taxable = netTotal;
      gstVal = (taxable * taxRate) / 100;
    }

    const matchedSlab = [5, 12, 18, 28].find((s) => Math.abs(s - taxRate) <= 1) || 18;
    if (taxSlabs[matchedSlab]) {
      taxSlabs[matchedSlab].taxable += taxable;
      taxSlabs[matchedSlab].cgst += gstVal / 2;
      taxSlabs[matchedSlab].sgst += gstVal / 2;
      taxSlabs[matchedSlab].totalGst += gstVal;
    }
  });

  const totalCgst = Number(invoice.cgst_amount || 0);
  const totalSgst = Number(invoice.sgst_amount || 0);
  const totalTax = Number(invoice.tax_amount || totalCgst + totalSgst || (grandTotal - taxableSubtotal));

  if (taxSlabs[18].taxable === 0 && taxableSubtotal > 0) {
    taxSlabs[18].taxable = taxableSubtotal;
    taxSlabs[18].cgst = totalCgst || totalTax / 2;
    taxSlabs[18].sgst = totalSgst || totalTax / 2;
    taxSlabs[18].totalGst = totalTax;
  }

  const sumTaxable = Object.values(taxSlabs).reduce((acc, s) => acc + s.taxable, 0);
  const sumSgst = Object.values(taxSlabs).reduce((acc, s) => acc + s.sgst, 0);
  const sumCgst = Object.values(taxSlabs).reduce((acc, s) => acc + s.cgst, 0);
  const sumTotalGst = Object.values(taxSlabs).reduce((acc, s) => acc + s.totalGst, 0);

  const formattedDate = formatDisplayDate(invoice.invoice_date || invoice.created_at || new Date());

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
  const docStripTitle = isEstimate ? texts_.estimateTitle : isQuotation ? texts_.quotationTitle : t("GST INVOICE", "GST INVOICE");
  const docNumLabel = `${docNoLabelFor(invoice, texts_)} : `;
  const docDateLabel = `${docDateLabelFor(invoice, texts_)} : `;

  // Full-page sheet (mm = print-physical, matches @page): A4 289mm,
  // A4-land 202mm, A5 205mm, A5-land 143mm. `tpl-sheet-full` exempts this
  // from the print rule that zeroes min-heights (the ~75% sheet bug).
  const sheetMinH = isA5
    ? (orientation === 'landscape' ? 'min-h-[143mm]' : 'min-h-[205mm]')
    : (orientation === 'landscape' ? 'min-h-[202mm]' : 'min-h-[289mm]');
  return (
    <div className={`w-full bg-transparent text-black font-sans ${isA5 ? 'text-[8px] leading-tight p-0.5' : 'text-[10px] leading-tight p-1'} border border-black/40 rounded-md selection:bg-none flex flex-col tpl-sheet-full ${sheetMinH}`}>
      {/* ─── TOP COPY TYPE BAR ─── */}
      <div className={`flex justify-between items-center ${isA5 ? 'text-[7.5px] pb-0.5 mb-0.5 px-0.5' : 'text-[9px] pb-0.5 mb-1 px-1'} font-bold border-b border-black`}>
        <span className="font-extrabold uppercase text-blue-900 bg-black/5 px-1.5 py-0.5 rounded border border-gray-400">
          {invoice.copy_type || "ORIGINAL FOR RECIPIENT"}
        </span>
        <span className="text-xs font-black tracking-wider uppercase">{docTitle}</span>
        <span className="font-mono text-[8px]">Page No. 1</span>
      </div>

      {/* ─── 3-WAY DISTRIBUTOR HEADER ─── */}
      {(f.showCompanyDetails !== false || f.showLogo !== false || f.showCustomerDetails !== false) && (
        <div className="grid grid-cols-12 border-b-2 border-black pb-1 mb-0.5">
          {/* Left: Distributor Profile */}
          {f.showCompanyDetails !== false && (
            <div className={`${f.showCustomerDetails === false ? 'col-span-8' : 'col-span-4'} p-1 space-y-0.5 border-r border-black`}>
              <h1 className="font-black text-xs uppercase tracking-tight text-teal-950">
                {dynamicStoreName || 'AUTHORIZED DISTRIBUTOR'}
              </h1>
              {dynamicAddress && (
                <p className="text-[9px] text-gray-700 leading-snug">
                  {dynamicAddress}
                </p>
              )}
              {dynamicPhone && <p className="text-[9px]">Phone : <span className="font-mono font-bold">{dynamicPhone}</span></p>}
              {dynamicEmail && <p className="text-[9px]">E-Mail : <span className="font-mono">{dynamicEmail}</span></p>}
              <p className="font-bold text-[9px] pt-0.5">
                GSTIN : <span className="font-mono">{sellerGstin || '-'}</span>
              </p>
            </div>
          )}

          {/* Center: Brand Banner & Salesman */}
          <div className={`${f.showCompanyDetails === false && f.showCustomerDetails === false ? 'col-span-12' : f.showCompanyDetails === false ? 'col-span-6' : 'col-span-4'} p-1 border-r border-black flex flex-col justify-between items-center text-center`}>
            <div className="p-1 border border-red-500 rounded bg-red-500/10 inline-block px-3">
              {f.showLogo !== false && dynamicLogoUrl && dynamicLogoUrl !== '/Logo.png' ? (
                <img src={dynamicLogoUrl} alt="Brand Logo" className="h-6 max-w-[80px] object-contain" />
              ) : (
                <span className="font-black text-xs text-red-600 tracking-wider uppercase">{dynamicStoreName || 'AUTHORIZED DISTRIBUTOR'}</span>
              )}
            </div>
            <div className="text-[9px] font-mono text-left w-full pl-2 space-y-0.5 mt-1">
              {f.showPoNumber !== false && (
                <p><span className="font-sans font-bold">PO / Order Ref: </span>{invoice.po_number || invoice.order_number || '-'}</p>
              )}
              {f.showVehicleNumber !== false && (
                <p><span className="font-sans font-bold">Vehicle No: </span>{invoice.vehicle_number || '-'}</p>
              )}
              {f.showEwayBill !== false && (
                <p><span className="font-sans font-bold">e-Way Bill: </span>{invoice.eway_bill_number || '-'}</p>
              )}
              {f.showChallanNumber !== false && invoice.challan_number && (
                <p><span className="font-sans font-bold">Challan No: </span>{invoice.challan_number}</p>
              )}
              <p><span className="font-sans font-bold">Transport: </span>{invoice.transporter_name || invoice.driver_phone || 'Road'}</p>
              {customRows.length > 0 && (
                <div className="pt-0.5 space-y-0.5 border-t border-black/20">
                  {customRows.map((row, rIdx) => (
                    <p key={rIdx}><span className="font-sans font-bold">{row.label}: </span><span>{row.value}</span></p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Customer & Invoice Meta */}
          {f.showCustomerDetails !== false && (
            <div className={`${f.showCompanyDetails === false ? 'col-span-6' : 'col-span-4'} p-1 space-y-0.5 flex flex-col justify-between`}>
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-[9px] font-bold">M/s {invoice.customerName || 'Customer'}</span>
                  <span className="text-[8px] font-mono text-gray-500">Page No. 1</span>
                </div>
                <p className="text-[9px] text-gray-700 leading-snug">
                  <span className="font-bold text-gray-900">Bill To: </span>{invoice.customerBillingAddress || invoice.customerAddress || '-'}
                </p>
                <p className="text-[8.5px] text-teal-900 leading-snug font-medium">
                  <span className="font-bold text-teal-950">Ship To: </span>{invoice.customerShippingAddress || invoice.customerBillingAddress || invoice.customerAddress || 'Same as Bill To'}
                </p>
                {invoice.customerPhone && <p className="text-[9px]">Ph.No.: <span className="font-mono">{invoice.customerPhone}</span></p>}
                <p className="font-bold text-[9px]">
                  GST : <span className="font-mono">{invoice.customerGST || 'UNREGISTERED'}</span>
                </p>
                <CustomerExtrasBlock invoice={invoice} texts={texts_} className="text-teal-900" />
                {f.showPartyBalance && (
                  <p className="text-[8.5px] font-bold text-red-600 mt-0.5">
                    {texts_.partyBalanceLabel}: {currency.symbol}{Number(invoice.party_previous_balance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── INVOICE STRIP (TEAL ACCENT) ─── */}
      {f.showInvoiceDetails !== false && (
        <div className="grid grid-cols-12 border-b-2 border-black bg-teal-900/10 py-1 px-2 items-center text-[10px]">
          <div className="col-span-4">
            <h2 className="font-black text-sm text-teal-900 tracking-wider">{docStripTitle}</h2>
          </div>
          <div className="col-span-8 text-right font-mono flex justify-end gap-3 text-[9px]">
            <div><span className="font-sans font-bold">{docNumLabel}</span><b className="font-black">{invoice.invoice_number || (isQuotation ? 'QT-0001' : 'B000738')}</b></div>
            {invoice.eway_bill_number && <div><span className="font-sans font-bold text-emerald-800">e-Way Bill: </span><b className="text-emerald-950">{invoice.eway_bill_number}</b></div>}
            <div><span className="font-sans font-bold">{docDateLabel}</span>{formattedDate}</div>
            <div><span className="font-sans font-bold">Due Date : </span>{formatDisplayDate(invoice.due_date || invoice.invoice_date || new Date())}</div>
          </div>
        </div>
      )}

      {/* ─── TEAL HEADER ITEM TABLE ─── */}
      {f.showItemTable !== false && (
        <div className="min-h-[200px] print:min-h-0">
          <table className="w-full border-collapse text-[9px] font-mono">
            <thead>
              <tr className="bg-teal-700 text-white font-sans font-bold text-center border-b border-black">
                {parleCells.map((tok, ti) => {
                  const isLast = ti === parleCells.length - 1;
                  if (tok.kind === 'img') {
                    return <th key={ti} className={`py-1 px-1 ${isLast ? '' : 'border-r border-teal-800'} w-8 text-center`}>{texts_.imgLabel}</th>;
                  }
                  const align = parleColAlign(tok.col);
                  const width = parleColWidth(tok.col);
                  const cls = `py-1 px-1 ${isLast ? '' : 'border-r border-teal-800'} ${align} ${tok.col.fieldKey === 'description' ? 'px-2' : ''}`;
                  return <th key={ti} className={cls} style={width}>{tok.col.headerTitle}</th>;
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((it, idx) => {
                const qty = Number(it.quantity || 1);
                const rate = Number(it.unit_price || 0);
                const mrp = Number(it.mrp || rate * 1.15);
                const disc = Number(it.discount_value || 0);
                const isIncl = it.is_tax_inclusive === true || (it as any).is_inclusive === true || invoice.is_tax_inclusive === true;
                const taxRate = it.tax_rate !== undefined && it.tax_rate !== null ? Number(it.tax_rate) : 0;
                const halfTax = taxRate / 2;

                let taxable = 0;
                let taxVal = 0;
                let totalAmt = 0;
                let displayRate = rate;

                if (isIncl && taxRate > 0) {
                  totalAmt = qty * rate - disc;
                  taxable = totalAmt / (1 + taxRate / 100);
                  taxVal = (totalAmt - taxable) / 2;
                  displayRate = rate / (1 + taxRate / 100);
                } else {
                  taxable = qty * rate - disc;
                  taxVal = (taxable * halfTax) / 100;
                  totalAmt = taxable + taxVal * 2;
                  displayRate = rate;
                }

                const ctx = { it, idx, qty, mrp, displayRate, disc, totalAmt, taxable, halfTax, taxVal, taxRate };
                return (
                  <tr key={idx} className="border-b border-gray-200 hover:bg-teal-50/20">
                    {parleCells.map((tok, ti) => {
                      const isLast = ti === parleCells.length - 1;
                      let cls = `py-0.5 px-1 ${isLast ? '' : 'border-r border-black'} ${tok.kind === 'data' ? parleColAlign(tok.col) : 'text-center'}`;
                      if (tok.kind === 'data' && tok.col.fieldKey === 'description') cls += ' font-sans font-bold text-left px-2';
                      else if (tok.kind === 'data' && tok.col.fieldKey === 'sno') cls += ' font-sans';
                      else if (tok.kind === 'data' && tok.col.fieldKey === 'uom') cls += ' font-sans';
                      return (
                        <td key={ti} className={cls}>
                          {renderParleCell(tok, ctx)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── BARCODE & QR CODE SECTION ─── */}
      {f.showBarcode && (
        <div className="flex items-center justify-center gap-6 py-1 border-t border-black bg-black/[0.02]">
          <div className="flex flex-col items-center">
            <div className="font-mono text-[8px] tracking-widest bg-white px-2 py-0.5 border border-black">
              ||||| | |||| ||| |||||||
            </div>
            <span className="text-[7px] font-mono">{invoice.invoice_number || 'B000738'}</span>
          </div>
        </div>
      )}
      {paymentQr && (
        <div className="flex items-center justify-center py-1 border-t border-black bg-black/[0.02]">
          <PaymentQrBlock paymentQr={paymentQr} texts={texts_} currency={currency} compact />
        </div>
      )}

      {/* ─── BOTTOM TAX MATRIX TABLE ─── */}
      {f.showTotals !== false && (
        <div className="border-t-2 border-black grid grid-cols-12 pt-1">
          <div className="col-span-8 pr-2">
            {f.showTaxSplit !== false && (
              <table className="w-full border border-black border-collapse text-[9px] font-mono text-center">
                <thead>
                  <tr className="bg-black/5 border-b border-black font-sans font-bold">
                    <th className="p-0.5 border-r border-black">CLASS</th>
                    <th className="p-0.5 border-r border-black">TOTAL</th>
                    <th className="p-0.5 border-r border-black">SCH</th>
                    <th className="p-0.5 border-r border-black">DISC.</th>
                    <th className="p-0.5 border-r border-black">SGST</th>
                    <th className="p-0.5 border-r border-black">CGST</th>
                    <th className="p-0.5">TOTAL GST</th>
                  </tr>
                </thead>
                <tbody>
                  {[5, 12, 18, 28].map((s) => (
                    <tr key={s} className="border-b border-gray-200">
                      <td className="p-0.5 border-r border-black font-sans font-bold">GST {s}.00</td>
                      <td className="p-0.5 border-r border-black text-right">{taxSlabs[s].taxable.toFixed(2)}</td>
                      <td className="p-0.5 border-r border-black">0.00</td>
                      <td className="p-0.5 border-r border-black">0.00</td>
                      <td className="p-0.5 border-r border-black text-right">{taxSlabs[s].sgst.toFixed(2)}</td>
                      <td className="p-0.5 border-r border-black text-right">{taxSlabs[s].cgst.toFixed(2)}</td>
                      <td className="p-0.5 text-right font-bold">{taxSlabs[s].totalGst.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="bg-black/5 font-bold border-t border-black">
                    <td className="p-0.5 border-r border-black font-sans">TOTAL</td>
                    <td className="p-0.5 border-r border-black text-right">{sumTaxable.toFixed(2)}</td>
                    <td className="p-0.5 border-r border-black">0.00</td>
                    <td className="p-0.5 border-r border-black">0.00</td>
                    <td className="p-0.5 border-r border-black text-right">{sumSgst.toFixed(2)}</td>
                    <td className="p-0.5 border-r border-black text-right">{sumCgst.toFixed(2)}</td>
                    <td className="p-0.5 text-right">{sumTotalGst.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            )}
            <p className="text-[9px] font-bold font-sans mt-1">
              {numberToIndianWords(grandTotal)}
            </p>
          </div>

          <div className="col-span-4 flex flex-col justify-between border-l border-black pl-2 text-right">
            <span className="text-gray-500 font-mono text-[9px]">Continued... 1</span>
            <div className="p-2 border-2 border-teal-900 rounded bg-teal-900/10 text-center my-auto">
              <span className="text-[10px] font-bold font-sans uppercase block text-teal-950">Grand Total</span>
              <span className="text-base font-black font-mono text-teal-950">
                {currency.symbol}{grandTotal.toFixed(2)}
              </span>
              <span className="text-[8px] font-bold font-sans block text-teal-900 border-t border-teal-900/30 pt-0.5 mt-0.5">
                Total Billed Qty: {items.reduce((s, i) => s + Number(i.quantity || 1), 0)} Units
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ─── TERMS, PAYMENT & SIGNATURES ─── */}
      <div className="grid grid-cols-12 border-t-2 border-black pt-1 mt-auto text-[8px]">
        <div className="col-span-5 pr-2 space-y-0.5 text-gray-700">
          {f.showTerms !== false && (
            <div>
              <span className="font-bold underline text-black">Terms & Conditions</span>
              <p>1. Goods once sold will not be taken back or exchanged.</p>
              <p>2. Bills not paid due date will attract 24% interest.</p>
            </div>
          )}
          {f.showPaymentDetails !== false && (
            <div className="pt-1 font-mono text-[7.5px] text-gray-800">
              <span className="font-bold text-black font-sans">{texts_.bankDetailsLabel}: </span>
              <span>{dynamicBank || '—'}</span>
            </div>
          )}
        </div>
        <div className="col-span-3 text-center flex flex-col justify-end">
          <span className="font-bold text-black border-t border-black pt-0.5 inline-block">Receiver Signature</span>
        </div>
        <div className="col-span-4 text-right flex flex-col justify-between">
          <span className="font-bold text-black font-sans uppercase">For {sigCompany}</span>
          {(f.showSignature !== false || signatureUrl || stampUrl) && (
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
          )}
        </div>
      </div>
    </div>
  );
}
