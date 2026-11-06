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

export function AgriSeedsTemplate({
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
  const texts_ = texts || resolveInvoiceTexts(template, 'agri_seeds');
  const templateColumns: NormalizedTemplateColumn[] = resolveTemplateColumns(template, (template as any)?.columns, f, texts_);
  const customRows = resolveCustomFieldRows(template, invoice, f);
  const agriColAlign = (col: NormalizedTemplateColumn) =>
    col.align === 'left' ? 'text-left' : col.align === 'right' ? 'text-right' : 'text-center';
  const agriColWidth = (col: NormalizedTemplateColumn) =>
    col.widthPercent ? { width: col.widthPercent + '%' } : undefined;

  type AgriTok =
    | { kind: 'img' }
    | { kind: 'crop' }
    | { kind: 'mfg' }
    | { kind: 'exp' }
    | { kind: 'data'; col: NormalizedTemplateColumn };
  // AgriSeeds plan: user-driven data columns, with the theme's signature
  // Crop / Mfg / Exp columns injected after the UOM column when not already
  // present as user columns (the template can also carry them as custom
  // fieldKeys "crop", "mfg_date", "expiry_date").
  const buildAgriCells = (): AgriTok[] => {
    const plan: AgriTok[] = [];
    const has = (key: string) => templateColumns.some((c) => c.fieldKey === key);
    const uomIdx = (() => {
      const i = templateColumns.findIndex((c) => c.fieldKey === 'uom');
      return i >= 0 ? i : Math.min(1, templateColumns.length - 1);
    })();
    templateColumns.forEach((col, i) => {
      if (i === 0 && f.showProductImage) plan.push({ kind: 'img' });
      plan.push({ kind: 'data', col });
      if (i === uomIdx) {
        if (!has('crop')) plan.push({ kind: 'crop' });
        if (!has('mfg_date')) plan.push({ kind: 'mfg' });
        if (!has('expiry_date')) plan.push({ kind: 'exp' });
      }
    });
    return plan;
  };
  const agriCells: AgriTok[] = buildAgriCells();
  const agriTokLabel = (tok: AgriTok): React.ReactNode => {
    switch (tok.kind) {
      case 'img': return texts_.imgLabel;
      case 'crop': return 'Crop';
      case 'mfg': return 'Mfg.';
      case 'exp': return 'Exp';
      case 'data': return tok.col.headerTitle;
    }
  };
  const agriTokAlign = (tok: AgriTok): string =>
    tok.kind === 'data' ? agriColAlign(tok.col) : 'text-center';

  // Rich compound cell renderer: preserves AgriSeeds' signature rendering
  // (description with SKU sub-line, qty with Pri/Sec unit, mfg/exp/batch/crop
  // fields) for standard keys, falls back to the generic resolver for custom.
  const renderAgriCell = (
    tok: AgriTok,
    ctx: { it: any; idx: number; qty: number; mrp: number; rate: number; lineAmount: number }
  ): React.ReactNode => {
    if (tok.kind === 'img') {
      return (
        <div className="w-5 h-5 rounded bg-amber-50 border border-amber-300 mx-auto flex items-center justify-center text-[8px]">
          🌱
        </div>
      );
    }
    if (tok.kind === 'crop') {
      return <span className="font-sans">{ctx.it.crop_type || ctx.it.variety || ctx.it.category || '-'}</span>;
    }
    if (tok.kind === 'mfg') {
      return ctx.it.mfg_date || ctx.it.manufacturing_date || '-';
    }
    if (tok.kind === 'exp') {
      return ctx.it.exp_date || ctx.it.expiry_date || '-';
    }
    const { it, idx, qty, mrp, rate, lineAmount } = ctx;
    switch (tok.col.fieldKey) {
      case 'sno': return <span className="font-sans">{idx + 1}.</span>;
      case 'description':
        return (
          <>
            <span className="font-sans font-bold">{it.product_name || '-'}</span>
            {f.showItemDescription !== false && (it.custom_note || it.description || it.notes) && (
              <span className="text-[8px] text-gray-600 block mt-0.5 font-normal leading-tight">
                {it.custom_note || it.description || it.notes}
              </span>
            )}
            {f.showSKU && (
              <span className="text-[7px] text-gray-500 block mt-0.5 font-mono">
                SKU: {(it as any).sku || '-'}
              </span>
            )}
          </>
        );
      case 'uom':
        return it.size || it.volume || it.weight || it.selected_uom || it.uom || '-';
      case 'quantity':
        return (
          <>
            <div className="font-bold">{qty} {it.selected_uom || it.uom || ''}</div>
            {it.secondary_uom && (
              <span className="block text-[7px] font-black text-gray-600">
                {it.selected_uom === it.secondary_uom ? 'Sec' : 'Pri'}
              </span>
            )}
          </>
        );
      case 'mrp': return mrp.toFixed(2);
      case 'unit_price':
      case 'selling_price': return rate.toFixed(2);
      case 'total_amount': return <span className="font-bold">{lineAmount.toFixed(2)}</span>;
      case 'batch': return it.batch_no || it.batch_number || it.lot_no || '-';
      case 'expiry_date': return [it.mfg_date, it.exp_date].filter(Boolean).join(' / ') || '-';
      case 'tax_rate': return `${Number(it.tax_rate ?? 0)}%`;
      default: return cellValueForColumn(tok.col, it, invoice).text;
    }
  };

  const isA5 = paperSize === 'A5';
  const items = invoice.items || [];
  const grandTotal = Number(invoice.grand_total || invoice.total_amount || 0);
  const taxableSubtotal = Number(invoice.taxable_value || invoice.subtotal || grandTotal * 0.95);
  const totalTax = Number(invoice.tax_amount || (invoice.cgst_amount || 0) + (invoice.sgst_amount || 0) || (grandTotal - taxableSubtotal));

  const sigSettings = getOrgSignatureSettings() as any;
  const activeGst = getActiveBillingGst() as any;
  const signatureUrl = sigSettings.showDigitalSignature !== false && sigSettings.show_digital_signature !== false ? (sigSettings.signatureUrl || sigSettings.signature_url || activeGst?.signature_url) : null;
  const stampUrl = sigSettings.showDigitalStamp !== false && sigSettings.show_digital_stamp !== false ? (sigSettings.stampUrl || sigSettings.stamp_url || activeGst?.stamp_url) : null;
  const sigTitle = sigSettings.signatureTitle || sigSettings.signature_title || activeGst?.signature_title || "Authorised signatory";
  const sigCompany = sigSettings.signatureCompanyName || sigSettings.signature_company_name || dynamicStoreName;

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
  const docHeaderTitle = docTitleFor(invoice, texts_, template);
  const docNumLabel = `${docNoLabelFor(invoice, texts_)} : `;
  const docDateLabel = `${docDateLabelFor(invoice, texts_)} : `;

  // Full-page sheet (mm = print-physical, matches @page): A4 289mm,
  // A4-land 202mm, A5 205mm, A5-land 143mm. `tpl-sheet-full` exempts this
  // from the print rule that zeroes min-heights (the ~75% sheet bug).
  const sheetMinH = isA5
    ? (orientation === 'landscape' ? 'min-h-[143mm]' : 'min-h-[205mm]')
    : (orientation === 'landscape' ? 'min-h-[202mm]' : 'min-h-[289mm]');
  return (
    <div className={`w-full bg-transparent text-black font-sans ${isA5 ? 'text-[8px] leading-tight p-0.5' : 'text-[10px] leading-tight p-1'} border border-black/40 rounded-md selection:bg-none relative flex flex-col tpl-sheet-full ${sheetMinH}`}>
      {/* ─── TOP STATUTORY PERMIT HEADER ─── */}
      {(f.showCompanyDetails !== false || f.showLogo !== false || f.showInvoiceDetails !== false || f.showQR) && (
        <div className="grid grid-cols-12 border-b-2 border-black pb-1 mb-1 items-center">
          {/* Left Statutory Licences */}
          {f.showCompanyDetails !== false && (
            <div className="col-span-3 text-[8px] font-mono space-y-0.5">
              <p className="font-bold">{texts_.gstinLabel} : <span className="font-extrabold">{sellerGstin || '—'}</span></p>
            </div>
          )}

          {/* Center Brand Identity with Circular Logo */}
          <div className={`${f.showCompanyDetails === false ? 'col-span-8' : 'col-span-6'} text-center flex flex-col items-center`}>
            <div className="flex items-center justify-center gap-3">
              {f.showLogo !== false && (
                <div className="size-10 rounded-full border-2 border-red-700 overflow-hidden flex items-center justify-center bg-amber-500/10 shrink-0">
                  {dynamicLogoUrl && dynamicLogoUrl !== '/Logo.png' ? (
                    <img src={dynamicLogoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-base font-bold text-red-700">🌱</span>
                  )}
                </div>
              )}
              <div>
                <h1 className="font-black text-sm uppercase tracking-wide text-red-800 leading-tight">
                  {dynamicStoreName}
                </h1>
                <span className="text-[9px] font-extrabold text-teal-800 block uppercase tracking-wider">
                  {texts_.companyTagline}
                </span>
              </div>
            </div>
            {f.showCompanyDetails !== false && (
              <>
                {dynamicAddress && (
                  <p className="text-[9px] text-gray-700 mt-1 leading-snug">{dynamicAddress}</p>
                )}
                {dynamicPhone && <p className="text-[8px] text-gray-800">{texts_.phoneLabel} : <span className="font-mono font-bold">{dynamicPhone}</span></p>}
              </>
            )}
          </div>

          {/* Right QR & Invoice Title */}
          <div className="col-span-3 text-right flex flex-col justify-between h-full">
            {f.showInvoiceDetails !== false && (
              <div>
                <h2 className="font-black text-xs text-gray-900 tracking-wider">{docHeaderTitle}</h2>
                <span className="text-[8px] font-extrabold uppercase text-blue-900 block bg-blue-500/10 px-1 py-0.5 rounded border border-blue-200 mt-0.5">
                  {invoice.copy_type || "ORIGINAL FOR RECIPIENT"}
                </span>
              </div>
            )}
            {paymentQr?.enabled && paymentQr?.src && (
              <div className="ml-auto mt-1">
                <PaymentQrBlock paymentQr={paymentQr} texts={texts_} currency={currency} compact />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── CUSTOMER DETAILS & INVOICE META ─── */}
      {(f.showCustomerDetails !== false || f.showInvoiceDetails !== false) && (
        <div className="grid grid-cols-12 border-b-2 border-black py-1 px-1 text-[9px] leading-snug bg-black/[0.03]">
          {f.showCustomerDetails !== false && (
            <div className={`${f.showInvoiceDetails === false ? 'col-span-12' : 'col-span-7'} space-y-0.5`}>
              <p className="font-bold">BUYER (BILL TO) : <span className="font-extrabold uppercase">{invoice.customerName || 'Customer'}</span></p>
              <p><span className="font-bold">BILL TO (ADDRESS) : </span>{invoice.customerBillingAddress || invoice.customerAddress || '-'}</p>
              <p className="text-emerald-950 font-bold"><span className="text-gray-900 font-bold">SHIP TO (DELIVERY) : </span>{invoice.customerShippingAddress || invoice.customerBillingAddress || invoice.customerAddress || 'Same as Bill To'}</p>
              <p className="font-mono font-bold">GSTIN : {invoice.customerGST || 'UNREGISTERED'}</p>
              {f.showPartyBalance && (
                <p className="text-red-600 font-bold text-[8.5px]">{texts_.outstandingLabel}: {currency.symbol}{Number(invoice.party_previous_balance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              )}
              <CustomerExtrasBlock invoice={invoice} texts={texts_} className="text-gray-800" />
            </div>
          )}

          {f.showInvoiceDetails !== false && (
            <div className={`${f.showCustomerDetails === false ? 'col-span-12' : 'col-span-5'} text-right font-mono space-y-0.5`}>
              <p><span className="font-sans font-bold">{docDateLabel}</span>{formattedDate}</p>
              <p><span className="font-sans font-bold">{docNumLabel}</span><b className="font-black">{invoice.invoice_number || (isQuotation ? 'QT-0001' : 'ALL000001')}</b></p>
              {f.showPoNumber !== false && invoice.po_number && <p><span className="font-sans font-bold">PO / Order Ref : </span><b>{invoice.po_number}</b></p>}
              {f.showVehicleNumber !== false && invoice.vehicle_number && <p><span className="font-sans font-bold">Vehicle No : </span><b>{invoice.vehicle_number}</b></p>}
              {f.showEwayBill !== false && invoice.eway_bill_number && <p className="text-emerald-800 font-bold"><span className="font-sans">e-Way Bill : </span>{invoice.eway_bill_number}</p>}
              {f.showChallanNumber !== false && invoice.challan_number && <p><span className="font-sans font-bold">Challan No : </span><b>{invoice.challan_number}</b></p>}
              {customRows.length > 0 && (
                <div className="mt-1 pt-0.5 border-t border-black/20 space-y-0.5">
                  {customRows.map((row, rIdx) => (
                    <p key={rIdx}><span className="font-sans font-bold">{row.label} : </span><b>{row.value}</b></p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── AGRICULTURE / SEEDS ITEMS TABLE WITH WATERMARK ─── */}
      {f.showItemTable !== false && (
        <div className="min-h-[220px] print:min-h-0 relative">
          {/* Subtle Agricultural Watermark Artwork in Background */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.06] pointer-events-none">
            <div className="text-center font-black text-5xl uppercase tracking-widest text-emerald-950 rotate-[-12deg]">
              🌾 {dynamicStoreName} 🌾
            </div>
          </div>

          <table className="w-full border-collapse text-[9px] font-mono relative z-10">
            <thead>
              <tr className="bg-black/5 border-b border-black font-sans font-bold text-center">
                {agriCells.map((tok, ti) => {
                  const isLast = ti === agriCells.length - 1;
                  if (tok.kind === 'img') {
                    return <th key={ti} className={`py-1 px-1 ${isLast ? '' : 'border-r border-black'} w-8 text-center`}>{agriTokLabel(tok)}</th>;
                  }
                  if (tok.kind === 'crop') {
                    return <th key={ti} className={`py-1 px-1 ${isLast ? '' : 'border-r border-black'} w-14 text-center`}>Crop</th>;
                  }
                  if (tok.kind === 'mfg') {
                    return <th key={ti} className={`py-1 px-1 ${isLast ? '' : 'border-r border-black'} w-10 text-center`}>Mfg.</th>;
                  }
                  if (tok.kind === 'exp') {
                    return <th key={ti} className={`py-1 px-1 ${isLast ? '' : 'border-r border-black'} w-10 text-center`}>Exp</th>;
                  }
                  const align = agriTokAlign(tok);
                  const width = agriColWidth(tok.col);
                  const cls = `py-1 px-1 ${isLast ? '' : 'border-r border-black'} ${align} ${tok.col.fieldKey === 'description' ? 'px-2 text-left font-bold' : ''}`;
                  return <th key={ti} className={cls} style={width}>{agriTokLabel(tok)}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const qty = Number(it.quantity || 1);
                const rate = Number(it.unit_price || 0);
                const mrp = Number(it.mrp || rate * 1.15);
                const lineAmount = qty * rate;

                const ctx = { it, idx, qty, mrp, rate, lineAmount };
                return (
                  <tr key={idx} className="border-b border-gray-200">
                    {agriCells.map((tok, ti) => {
                      const isLast = ti === agriCells.length - 1;
                      let cls = `py-1 px-1 ${isLast ? '' : 'border-r border-black'} ${agriTokAlign(tok)}`;
                      if (tok.kind === 'data' && tok.col.fieldKey === 'description') cls += ' font-sans font-bold text-left px-2';
                      else if (tok.kind === 'data' && tok.col.fieldKey === 'sno') cls += ' font-sans';
                      else if (tok.kind === 'data' && tok.col.fieldKey === 'total_amount') cls += ' font-bold';
                      else if (tok.kind === 'data' && tok.col.fieldKey === 'quantity') cls += ' font-bold';
                      return (
                        <td key={ti} className={cls}>
                          {renderAgriCell(tok, ctx)}
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

      {/* ─── LIVE BARCODE / QR SECTION ─── */}
      {f.showBarcode && (
        <div className="flex items-center justify-center gap-6 py-1 border-t border-black bg-black/[0.02]">
          <div className="flex flex-col items-center">
            <div className="font-mono text-[8px] tracking-widest bg-white px-2 py-0.5 border border-black">
              ||||| | |||| ||| |||||||
            </div>
            <span className="text-[7px] font-mono">{invoice.invoice_number || 'ALL000001'}</span>
          </div>
        </div>
      )}

      {/* ─── BOTTOM TOTALS & TAX ─── */}
      {f.showTotals !== false && (
        <div className="border-t-2 border-black grid grid-cols-12 py-1 px-1">
          <div className="col-span-7 font-bold text-[9px] space-y-1">
            <p>{numberToIndianWords(grandTotal)}</p>
          </div>
          <div className="col-span-5 font-mono text-[9px] text-right space-y-0.5">
            <div className="flex justify-between"><span className="font-sans font-bold">SUB TOTAL :</span><span>{taxableSubtotal.toFixed(2)}</span></div>
            {f.showTaxSplit !== false && (
              <div className="flex justify-between"><span className="font-sans font-bold">GST / TAX :</span><span>{totalTax.toFixed(2)}</span></div>
            )}
            <div className="flex justify-between border-t border-black pt-0.5 text-[10px] font-black">
              <span className="font-sans">GRAND TOTAL :</span>
              <span>{currency.symbol}{grandTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[8.5px] font-bold text-gray-800 pt-0.5">
              <span className="font-sans">TOTAL BILLED QTY :</span>
              <span>{items.reduce((s, i) => s + Number(i.quantity || 1), 0)} Units</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── TERMS, BANK DETAILS & SIGNATURES (pinned to page bottom) ─── */}
      <div className="border-t-2 border-black grid grid-cols-12 p-1 text-[8px] gap-2 mt-auto">
        <div className="col-span-7 space-y-1 text-gray-700">
          {f.showTerms !== false && (
            <div>
              <span className="font-bold underline text-black">Terms & Conditions :</span>
              <p>1) All disputes subject to local Jurisdiction only.</p>
              <p>2) Goods once sold will not be taken back or exchanged.</p>
            </div>
          )}
          {f.showPaymentDetails !== false && (
            <div className="pt-1">
              <span className="font-bold text-black">{texts_.bankDetailsLabel} :</span>
              <p className="font-mono">{dynamicBank || '—'}</p>
            </div>
          )}
          {paymentQr && (
            <div className="pt-1.5">
              <PaymentQrBlock paymentQr={paymentQr} texts={texts_} currency={currency} compact />
            </div>
          )}
        </div>

        <div className="col-span-5 flex flex-col justify-between text-right">
          <span className="font-bold uppercase text-black font-sans">
            For : {sigCompany}
          </span>
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
              <div className="w-full flex justify-between items-end pt-1">
                <span className="border-t border-black pt-0.5 inline-block text-[7px] font-bold text-center">Customer signatory</span>
                <span className="border-t border-black pt-0.5 inline-block text-[7px] font-bold text-center">{sigTitle}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
