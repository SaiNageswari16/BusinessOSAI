import React from 'react';
import { useI18n } from "@/contexts/i18n-context";
import type { FullInvoiceData } from '../FullInvoicePrinter';
import { numberToIndianWords } from '@/lib/number-to-words';
import { formatDisplayDate, isInvoiceLineFree } from '@/lib/utils';
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

export function MargPharmaTemplate({
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
  const texts_ = texts || resolveInvoiceTexts(template, 'marg_pharma');
  const templateColumns: NormalizedTemplateColumn[] = resolveTemplateColumns(template, (template as any)?.columns, f, texts_);
  const customRows = resolveCustomFieldRows(template, invoice, f);
  const showTaxSplitMarg = f?.showTaxSplit !== false;
  const colAlignClassM = (col: NormalizedTemplateColumn) =>
    col.align === 'left' ? 'text-left' : col.align === 'right' ? 'text-right' : 'text-center';
  const colWidthStyleM = (col: NormalizedTemplateColumn) =>
    col.widthPercent ? { width: col.widthPercent + '%' } : undefined;
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

  // Group Tax Slabs (5%, 12%, 18%, 28%)
  const taxSlabs: Record<number, { taxable: number; cgst: number; sgst: number; totalGst: number }> = {
    5: { taxable: 0, cgst: 0, sgst: 0, totalGst: 0 },
    12: { taxable: 0, cgst: 0, sgst: 0, totalGst: 0 },
    18: { taxable: 0, cgst: 0, sgst: 0, totalGst: 0 },
    28: { taxable: 0, cgst: 0, sgst: 0, totalGst: 0 },
  };

  let totalItemQty = 0;
  items.forEach((item) => {
    const qty = Number(item.quantity || 0);
    totalItemQty += qty;
    const rate = Number(item.tax_rate || (invoice.is_interstate ? (invoice.igst_amount ? 18 : 0) : (invoice.cgst_amount ? 18 : 0)));
    const matchedSlab = [5, 12, 18, 28].find((s) => Math.abs(s - rate) <= 1) || 18;
    const itemSub = Number(item.subtotal || qty * Number(item.unit_price || 0));
    const gstVal = (itemSub * matchedSlab) / 100;

    if (taxSlabs[matchedSlab]) {
      taxSlabs[matchedSlab].taxable += itemSub;
      taxSlabs[matchedSlab].cgst += gstVal / 2;
      taxSlabs[matchedSlab].sgst += gstVal / 2;
      taxSlabs[matchedSlab].totalGst += gstVal;
    }
  });

  // If no items populated slab, fallback to invoice total taxes
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

  // ── MARG unified cell "plan" ─────────────────────────────────────────────
  // The item table = user-driven DATA columns (templateColumns) interleaved
  // with MARG's decorative theme chrome (a static image column, the Mfr "—" and
  // Pack "1*1" columns, and the 4-column per-line CGST/SGST tax-split block).
  // One plan drives the thead, every item row, AND the blank filler rows so the
  // vertical ledger borders always line up.

  type MargToken =
    | { kind: 'data'; col: NormalizedTemplateColumn }
    | { kind: 'img' }
    | { kind: 'mfr' }
    | { kind: 'pack' }
    | { kind: 'tax'; n: 0 | 1 | 2 | 3 };

  const buildMargCells = (): MargToken[] => {
    const plan: MargToken[] = [];
    const qtyIdx = templateColumns.findIndex((c) => c.fieldKey === 'quantity');
    const mfrPackAnchor = qtyIdx >= 0 ? qtyIdx : Math.min(1, templateColumns.length - 1);
    const amtIdx = templateColumns.findIndex((c) => c.fieldKey === 'total_amount');
    const showTax = f?.showTaxSplit !== false;
    templateColumns.forEach((col, i) => {
      if (f?.showProductImage && i === 0) plan.push({ kind: 'img' });
      if (showTax && i === amtIdx) {
        plan.push({ kind: 'tax', n: 0 }, { kind: 'tax', n: 1 }, { kind: 'tax', n: 2 }, { kind: 'tax', n: 3 });
      }
      plan.push({ kind: 'data', col });
      if (i === mfrPackAnchor) {
        plan.push({ kind: 'mfr' }, { kind: 'pack' });
      }
    });
    if (showTax && amtIdx < 0) {
      plan.push({ kind: 'tax', n: 0 }, { kind: 'tax', n: 1 }, { kind: 'tax', n: 2 }, { kind: 'tax', n: 3 });
    }
    return plan;
  };
  const margCells: MargToken[] = buildMargCells();

  const margCellLabel = (tok: MargToken): React.ReactNode => {
    switch (tok.kind) {
      case 'img': return texts_.imgLabel;
      case 'mfr': return texts_.mfrLabel;
      case 'pack': return texts_.packLabel;
      case 'tax':
        return tok.n === 0 ? texts_.sgstCol : tok.n === 2 ? texts_.cgstCol : texts_.totTaxLabel;
      case 'data': return tok.col.headerTitle;
    }
  };
  const margCellAlign = (tok: MargToken): string => {
    switch (tok.kind) {
      case 'img': case 'mfr': case 'pack': return 'text-center';
      case 'tax': return 'text-right';
      case 'data': return colAlignClassM(tok.col);
    }
  };

  interface MargCtx {
    item: any; idx: number; qty: number; mrp: number; displayRate: number;
    disc: number; lineTotal: number; halfTax: number; taxVal: number; taxRate: number;
  }
  // Rich compound cell renderer for MARG data columns (FREE badge, Pri/Sec
  // sub-lines, tax-split) — falls back to the generic resolver for custom keys.
  const renderMargItemCell = (col: NormalizedTemplateColumn, ctx: MargCtx): React.ReactNode => {
    const { item, idx, qty, mrp, displayRate, disc, lineTotal, halfTax, taxVal, taxRate } = ctx;
    switch (col.fieldKey) {
      case 'sno':
        return <span className="font-sans">{idx + 1}.</span>;
      case 'description':
        return (
          <>
            <span className="font-sans font-bold">{item.product_name || 'Goods'}{isInvoiceLineFree(item) ? ' [FREE]' : ''}</span>
            {f?.showItemDescription !== false && (item.custom_note || item.description || item.notes) && (
              <span className="text-[8.5px] text-gray-600 block mt-0.5 font-normal leading-tight">
                {item.custom_note || item.description || item.notes}
              </span>
            )}
            {f?.showSKU && <span className="text-[7px] text-slate-500 block font-normal">SKU: {item.hsn_code || 'PH-01'}</span>}
          </>
        );
      case 'quantity':
        return (
          <>
            <div>{qty} {item.selected_uom || item.uom || ''}</div>
            {item.secondary_uom && (
              <span className="block text-[7px] font-black text-gray-600">
                {item.selected_uom === item.secondary_uom ? 'Sec' : 'Pri'}
              </span>
            )}
          </>
        );
      case 'unit_price':
        return <span>{displayRate.toFixed(2)}</span>;
      case 'selling_price':
        return <span>{(mrp > 0 ? mrp : displayRate).toFixed(2)}</span>;
      case 'mrp':
        return <span>{mrp.toFixed(2)}</span>;
      case 'discount':
        return <span>{disc > 0 ? disc.toFixed(2) : '0.00'}</span>;
      case 'total_amount':
        return <span className="font-bold">{lineTotal.toFixed(2)}</span>;
      case 'tax_rate':
        return <span>{taxRate}%</span>;
      case 'expiry_date':
        return [item.mfg_date, item.exp_date].filter(Boolean).join(' / ') || '—';
      default:
        return cellValueForColumn(col, item, invoice).text;
    }
  };
  const margCellValue = (tok: MargToken, ctx: MargCtx): React.ReactNode => {
    switch (tok.kind) {
      case 'img': return <span className="text-[10px]">💊</span>;
      case 'mfr': return <span className="font-sans">—</span>;
      case 'pack': return <span className="font-sans">1*1</span>;
      case 'tax':
        // n:0 SGST % (halfTax) · n:1 SGST amt (taxVal) · n:2 CGST % · n:3 CGST amt
        return (tok.n === 0 || tok.n === 2 ? ctx.halfTax : ctx.taxVal).toFixed(2);
      case 'data': return renderMargItemCell(tok.col, ctx);
    }
  };

  const isQuotation =
    invoice.doc_type === "quotation" ||
    invoice.invoice_type === "QUOTATION" ||
    String(invoice.invoice_number || "").toUpperCase().startsWith("QT-") ||
    Boolean((invoice as any).quote_number);
  const isEstimate =
    invoice.doc_type === "estimate" ||
    invoice.invoice_type === "ESTIMATE_NON_GST" ||
    String(invoice.invoice_number || "").toUpperCase().startsWith("EST-");
  const docHeaderTitle = docTitleFor(invoice, texts_, template);
  const docNumLabel = docNoLabelFor(invoice, texts_);
  const docDateLabel = docDateLabelFor(invoice, texts_);

  // Full-page sheet (mm = print-physical, matches @page): A4 289mm,
  // A4-land 202mm, A5 205mm, A5-land 143mm. `tpl-sheet-full` exempts this
  // from the print rule that zeroes min-heights (the ~75% sheet bug).
  const sheetMinH = isA5
    ? (orientation === 'landscape' ? 'min-h-[143mm]' : 'min-h-[205mm]')
    : (orientation === 'landscape' ? 'min-h-[202mm]' : 'min-h-[289mm]');
  return (
    <div className={`w-full bg-transparent text-black font-sans ${isA5 ? 'text-[8.5px] leading-tight p-0.5' : 'text-[11px] leading-tight'} border border-black/40 rounded-md selection:bg-none flex flex-col tpl-sheet-full ${sheetMinH}`}>
      {/* ─── TOP 3-BOX HEADER ─── */}
      <div className="grid grid-cols-12 border-b-2 border-black">
        {/* Left Box: Seller */}
        {f?.showCompanyDetails !== false && (
          <div className="col-span-4 p-2.5 border-r-2 border-black flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {f?.showLogo !== false && dynamicLogoUrl && dynamicLogoUrl !== '/Logo.png' && (
                  <img src={dynamicLogoUrl} alt="Logo" className="h-8 max-w-[80px] object-contain" />
                )}
                <h2 className="font-extrabold text-sm uppercase tracking-tight text-blue-900 leading-snug">
                  {dynamicStoreName}
                </h2>
              </div>
              {dynamicAddress && <p className="text-[10px] text-gray-800 leading-relaxed">{dynamicAddress}</p>}
              {dynamicPhone && <p className="text-[10px] text-gray-800">Phone: {dynamicPhone}</p>}
            </div>
            <div className="mt-2 pt-1 border-t border-gray-300">
              <p className="font-bold text-[11px] text-black">
                GSTIN : <span className="font-mono">{sellerGstin || '-'}</span>
              </p>
            </div>
          </div>
        )}

        {/* Center Box: GST Invoice Meta */}
        {f?.showInvoiceDetails !== false && (
          <div className={`${f?.showCompanyDetails === false ? 'col-span-6' : 'col-span-4'} p-1.5 border-r-2 border-black flex flex-col justify-between text-center bg-black/5`}>
            <div>
              <h1 className="text-base font-black text-blue-900 tracking-wider">{docHeaderTitle}</h1>
              <span className="text-[9px] font-extrabold text-blue-900 tracking-wider uppercase block mb-1 border border-blue-300 bg-blue-500/10 px-1 py-0.5 rounded">
                {invoice.copy_type || texts_.copyTag}
              </span>
            </div>

            <table className="w-full text-left text-[8px] border border-black border-collapse bg-transparent font-mono">
              <tbody>
                <tr className="border-b border-black">
                  <td className="p-0.5 font-sans font-bold border-r border-black w-18">{docNumLabel}</td>
                  <td className="p-0.5 font-bold border-r border-black">{invoice.invoice_number || (isQuotation ? 'QT-0001' : 'A000002')}</td>
                  <td className="p-0.5 font-sans font-bold border-r border-black">{texts_.poNumberLabel}<br />{texts_.orderDateLabel}</td>
                  <td className="p-0.5 border-r border-black font-bold">{invoice.po_number || invoice.order_number || '-'}<br />{invoice.po_date ? formatDisplayDate(invoice.po_date) : formattedDate}</td>
                  <td className="p-0.5 font-sans font-bold border-r border-black">{texts_.casesModeLabel}</td>
                  <td className="p-0.5">{invoice.payment_method || '0'}</td>
                </tr>
                <tr>
                  <td className="p-0.5 font-sans font-bold border-r border-black">{docDateLabel}<br />{texts_.dueDateLabel}</td>
                  <td className="p-0.5 border-r border-black">{formattedDate}<br />{formatDisplayDate(invoice.due_date || invoice.invoice_date || new Date())}</td>
                  <td className="p-0.5 font-sans font-bold border-r border-black">{texts_.ewayBillLabel}<br />{texts_.vehicleNoLabel}</td>
                  <td className="p-0.5 border-r border-black font-bold text-[7.5px]">{invoice.eway_bill_number ? `EWB: ${invoice.eway_bill_number}` : '-'}<br />{invoice.vehicle_number || '-'}</td>
                  <td className="p-0.5 font-sans font-bold border-r border-black">{texts_.transportLabel}</td>
                  <td className="p-0.5 text-[7.5px] truncate max-w-[70px]">{invoice.transporter_name || invoice.driver_phone || 'Road'}</td>
                </tr>
              </tbody>
            </table>

            {customRows.length > 0 && (
              <div className="mt-1 text-[7.5px] font-mono space-y-0.5">
                {customRows.map((row, rIdx) => (
                  <p key={rIdx} className="leading-tight">
                    <span className="font-sans font-bold">{row.label} : </span>
                    <span className="font-bold">{row.value}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Right Box: Customer */}
        {f?.showCustomerDetails !== false && (
          <div className={`${f?.showCompanyDetails === false && f?.showInvoiceDetails === false ? 'col-span-12' : f?.showCompanyDetails === false || f?.showInvoiceDetails === false ? 'col-span-6' : 'col-span-4'} p-2.5 flex flex-col justify-between`}>
            <div>
              <span className="text-[10px] font-bold underline block mb-0.5">{texts_.partyTitle} :</span>
              <h3 className="font-bold text-xs uppercase text-blue-950">
                {invoice.customerName || invoice.customerCompany || 'CASH CUSTOMER'}
              </h3>
              <p className="text-[10px] text-gray-800 leading-snug">
                <span className="font-bold text-gray-900">{texts_.addressLabel} : </span>{invoice.customerBillingAddress || invoice.customerAddress || '-'}
              </p>
              <p className="text-[9.5px] text-indigo-900 leading-snug mt-0.5 font-medium">
                <span className="font-bold text-indigo-950">{texts_.shipToTitle} : </span>{invoice.customerShippingAddress || invoice.customerBillingAddress || invoice.customerAddress || 'Same as Bill To'}
              </p>
              {f?.showPartyBalance && (
                <p className="text-[9px] font-bold text-red-600 mt-0.5">{texts_.outstandingLabel}: {currency.symbol}{Number(invoice.party_previous_balance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              )}
              {invoice.customerPhone && (
                <p className="text-[10px] text-gray-800 mt-0.5">
                  {texts_.phoneLabel} : <span className="font-mono">{invoice.customerPhone}</span>
                </p>
              )}
              <CustomerExtrasBlock invoice={invoice} texts={texts_} className="mt-0.5 text-gray-800" />
            </div>
            {invoice.customerGST && (
              <p className="text-[10px] font-bold mt-1">
                {texts_.partyGstinLabel} : <span className="font-mono">{invoice.customerGST}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* ─── MARG STYLE ITEM TABLE ─── */}
      {f?.showItemTable !== false && (
        <div className="min-h-[160px] print:min-h-0">
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="bg-black/10 border-b border-black font-bold text-center">
                {margCells.map((tok, ti) => {
                  const isLast = ti === margCells.length - 1;
                  const alignCls = margCellAlign(tok);
                  let widthCls = '';
                  let style: React.CSSProperties | undefined;
                  if (tok.kind === 'data') {
                    if (ti === 0) widthCls = 'w-7';
                    if (tok.col.fieldKey === 'description') widthCls = '';
                    style = colWidthStyleM(tok.col);
                  } else if (tok.kind === 'img') {
                    widthCls = 'w-8';
                  } else if (tok.kind === 'tax') {
                    widthCls = 'w-14';
                  }
                  return (
                    <th
                      key={ti}
                      className={`py-1 px-1 ${isLast ? '' : 'border-r border-black'} ${alignCls} ${tok.kind === 'data' && tok.col.fieldKey === 'description' ? 'text-left font-bold px-2' : ''} ${widthCls}`}
                      style={style}
                    >
                      {margCellLabel(tok)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 font-mono">
              {items.map((item, idx) => {
                const qty = Number(item.quantity || 1);
                const rate = Number(item.unit_price || 0);
                const mrp = Number(item.mrp || rate * 1.1);
                const disc = Number(item.discount_value || 0);
                const isIncl = item.is_tax_inclusive === true || (item as any).is_inclusive === true || invoice.is_tax_inclusive === true;
                const taxRate = item.tax_rate !== undefined && item.tax_rate !== null ? Number(item.tax_rate) : 0;
                const halfTax = taxRate / 2;

                let taxable = 0;
                let taxVal = 0;
                let lineTotal = 0;
                let displayRate = rate;

                if (isIncl && taxRate > 0) {
                  lineTotal = qty * rate - disc;
                  taxable = lineTotal / (1 + taxRate / 100);
                  taxVal = (lineTotal - taxable) / 2;
                  displayRate = rate / (1 + taxRate / 100);
                } else {
                  taxable = qty * rate - disc;
                  taxVal = (taxable * halfTax) / 100;
                  lineTotal = taxable + taxVal * 2;
                  displayRate = rate;
                }

                const ctx = { item, idx, qty, mrp, displayRate, disc, lineTotal, halfTax, taxVal, taxRate };
                return (
                  <tr key={idx} className="border-b border-gray-200">
                    {margCells.map((tok, ti) => {
                      const isLast = ti === margCells.length - 1;
                      let cls = `p-1 ${isLast ? '' : 'border-r border-black'} ${margCellAlign(tok)}`;
                      if (tok.kind === 'tax') cls += ' font-mono';
                      else if (tok.kind === 'data' && tok.col.fieldKey === 'description') cls += ' font-sans font-bold text-left px-2';
                      else if (tok.kind === 'data' && tok.col.fieldKey === 'sno') cls += ' font-sans';
                      return (
                        <td key={ti} className={cls}>
                          {margCellValue(tok, ctx)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {/* Blank filler rows to maintain vertical MARG ledger columns */}
              {Array.from({ length: Math.max(0, 5 - items.length) }).map((_, i) => (
                <tr key={`fill-${i}`} className="h-6 border-b border-gray-100">
                  {margCells.map((_, ti) => (
                    <td key={ti} className={`p-1 ${ti === margCells.length - 1 ? '' : 'border-r border-black'}`}></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── BOTTOM TAX SLAB MATRIX & TOTALS (group pinned to page bottom) ─── */}
      <div className="grid grid-cols-12 border-t-2 border-black mt-auto">
        {/* Left Side: Tax Matrix */}
        <div className="col-span-8 p-1.5 border-r-2 border-black flex flex-col justify-between">
          {f?.showTaxSplit !== false && (
            <table className="w-full border border-black border-collapse text-[9px] font-mono text-center">
              <thead>
                <tr className="bg-black/10 border-b border-black font-bold font-sans">
                  <th className="p-0.5 border-r border-black">CLASS</th>
                  <th className="p-0.5 border-r border-black">{texts_.grossAmtLabel}</th>
                  <th className="p-0.5 border-r border-black">SCHEME</th>
                  <th className="p-0.5 border-r border-black">{texts_.discAmtLabel}</th>
                  <th className="p-0.5 border-r border-black">{texts_.sgstLabel}</th>
                  <th className="p-0.5 border-r border-black">{texts_.cgstLabel}</th>
                  <th className="p-0.5">{texts_.totalTaxLabel}</th>
                </tr>
              </thead>
              <tbody>
                {[5, 12, 18, 28].map((s) => (
                  <tr key={s} className="border-b border-gray-200">
                    <td className="p-0.5 border-r border-black font-sans font-bold">GST {s}.00 %</td>
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

          <div className="mt-2 text-[10px]">
            <p className="font-bold text-blue-950 font-sans">{numberToIndianWords(grandTotal)}</p>
            <p className="text-[9px] text-gray-600 uppercase font-sans mt-0.5">{texts_.msgLabel}: {texts_.thankYouLabel}</p>
          </div>
        </div>

        {/* Right Side: Calculation Totals Box */}
        <div className="col-span-4 p-2 flex flex-col justify-between bg-black/[0.03]">
          <div className="space-y-1 text-[10px] font-mono">
            <div className="flex justify-between border-b border-gray-300 pb-0.5 font-sans">
              <span>Total Items :- <b className="font-mono">{items.length || 1}</b></span>
              <span>Total Qty :- <b className="font-mono">{totalItemQty || 1}</b></span>
            </div>
            <div className="flex justify-between">
              <span className="font-sans">TOTAL</span>
              <span className="font-bold">{taxableSubtotal.toFixed(2)}</span>
            </div>
            {f?.showTaxSplit !== false && (
              <>
                <div className="flex justify-between">
                  <span className="font-sans">SGST PAYABLE</span>
                  <span>{(totalSgst || sumSgst).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans">CGST PAYABLE</span>
                  <span>{(totalCgst || sumCgst).toFixed(2)}</span>
                </div>
              </>
            )}
          </div>

          <div className="mt-2 p-1.5 bg-black/10 border-2 border-black rounded text-center">
            <span className="text-[10px] font-black font-sans uppercase block tracking-wider">Grand Total</span>
            <span className="text-base font-black font-mono tracking-tight text-blue-950">
              {currency.symbol}{grandTotal.toFixed(2)}
            </span>
            <span className="text-[8.5px] font-bold text-gray-800 font-sans block mt-0.5 border-t border-black/20 pt-0.5">
              Total Billed Qty: {totalItemQty || items.reduce((s, i) => s + Number(i.quantity || 1), 0)} Units
            </span>
          </div>
        </div>
      </div>

      {/* ─── FOOTER TERMS & SIGNATURE ─── */}
      <div className="grid grid-cols-12 border-t-2 border-black p-2 bg-transparent">
        <div className="col-span-7 border-r border-gray-300 pr-2 space-y-0.5 text-[9px] text-gray-700">
          {f?.showTerms !== false && (
            <>
              <span className="font-bold underline text-black">{texts_.termsLabel}</span>
              <p>1. Goods once sold will not be taken back or exchanged.</p>
              <p>2. All disputes subject to local Jurisdiction only.</p>
              <p>3. Bills not paid due date will attract 24% interest.</p>
            </>
          )}
          {f?.showPaymentDetails !== false && (
            <p className="text-[8px] font-mono text-gray-600 mt-1">
              {dynamicBank || `${texts_.bankDetailsLabel}: —`}
            </p>
          )}
          {paymentQr && (
            <div className="mt-1.5">
              <PaymentQrBlock paymentQr={paymentQr} texts={texts_} currency={currency} compact />
            </div>
          )}
          {Boolean(template?.googleReviewUrl && (template as any)?.showGoogleReviewQR !== false) && (
            <div className="flex items-center gap-2 p-1.5 bg-amber-50/80 border border-amber-300 rounded-lg w-fit mt-1.5">
              <img
                src={generateQRCodeSVG(template.googleReviewUrl, 56)}
                alt="Google Review QR"
                className="size-8 object-contain bg-white p-0.5 rounded border border-amber-200"
              />
              <div className="text-[7.5px] leading-tight text-amber-900">
                <span className="font-extrabold block text-amber-950">⭐ Rate Us on Google</span>
                <span>Scan to review our service</span>
              </div>
            </div>
          )}
        </div>
        {f?.showSignature !== false && (
          <div className="col-span-5 pl-3 flex flex-col justify-between text-right">
            <span className="text-[10px] font-bold uppercase text-gray-900">
              FOR {sigCompany}
            </span>
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
              <span className="text-[9px] font-bold text-gray-800 border-t border-black pt-0.5 inline-block min-w-[120px] text-center">
                {sigTitle}
              </span>
            </div>
          </div>
        )}
      </div>
      <div className="text-center text-[8px] text-gray-700 py-0.5 border-t border-black bg-black/[0.03] font-mono">
        Our Software MARG Erp +911166969600, +911130969600
      </div>
    </div>
  );
}
