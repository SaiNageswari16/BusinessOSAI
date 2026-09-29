import React from 'react';
import { FullInvoiceData } from '../FullInvoicePrinter';
import { numberToIndianWords } from '@/lib/number-to-words';
import { formatDisplayDate } from '@/lib/utils';
import { getOrgSignatureSettings, getActiveBillingGst } from '@/lib/receipt-template-store';

interface TemplateProps {
  invoice: FullInvoiceData;
  dynamicStoreName: string;
  dynamicLogoUrl: string;
  dynamicAddress: string;
  dynamicPhone: string;
  dynamicEmail: string;
  sellerGstin: string;
  sellerStateCode: string;
  currency: { symbol: string; code: string };
  f?: any;
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
  currency,
  f = {},
}: TemplateProps) {
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
    const taxRate = Number(item.tax_rate || 18);
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

  return (
    <div className="w-full bg-transparent text-black font-sans text-[10px] leading-tight border border-black/40 rounded-md selection:bg-none p-1">
      {/* ─── TOP COPY TYPE BAR ─── */}
      <div className="flex justify-between items-center text-[9px] font-bold border-b border-black pb-0.5 mb-1 px-1">
        <span className="font-extrabold uppercase text-blue-900 bg-black/5 px-1.5 py-0.5 rounded border border-gray-400">
          {invoice.copy_type || "ORIGINAL FOR RECIPIENT"}
        </span>
        <span className="text-xs font-black tracking-wider uppercase">GST TAX INVOICE</span>
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
              <p><span className="font-sans font-bold">PO / Order Ref: </span>{invoice.po_number || invoice.order_number || '-'}</p>
              <p><span className="font-sans font-bold">Vehicle No: </span>{invoice.vehicle_number || '-'}</p>
              <p><span className="font-sans font-bold">Transport: </span>{invoice.transporter_name || invoice.driver_phone || 'Road'}</p>
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
                {f.showPartyBalance && (
                  <p className="text-[8.5px] font-bold text-red-600 mt-0.5">
                    Party Balance: {currency.symbol}14,200.00
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
            <h2 className="font-black text-sm text-teal-900 tracking-wider">GST INVOICE</h2>
          </div>
          <div className="col-span-8 text-right font-mono flex justify-end gap-3 text-[9px]">
            <div><span className="font-sans font-bold">Invoice No. : </span><b className="font-black">{invoice.invoice_number || 'B000738'}</b></div>
            {invoice.eway_bill_number && <div><span className="font-sans font-bold text-emerald-800">e-Way Bill: </span><b className="text-emerald-950">{invoice.eway_bill_number}</b></div>}
            <div><span className="font-sans font-bold">Date : </span>{formattedDate}</div>
            <div><span className="font-sans font-bold">Due Date : </span>{formatDisplayDate(invoice.due_date || invoice.invoice_date || new Date())}</div>
          </div>
        </div>
      )}

      {/* ─── TEAL HEADER ITEM TABLE ─── */}
      {f.showItemTable !== false && (
        <div className="min-h-[200px]">
          <table className="w-full border-collapse text-[9px] font-mono">
            <thead>
              <tr className="bg-teal-700 text-white font-sans font-bold text-center border-b border-black">
                <th className="py-1 px-1 border-r border-teal-800 w-6">Sn.</th>
                {f.showProductImage && <th className="py-1 px-1 border-r border-teal-800 w-8">IMG</th>}
                {f.showHSN !== false && <th className="py-1 px-1 border-r border-teal-800 w-16">HSNCODE</th>}
                <th className="py-1 px-2 border-r border-teal-800 text-left">DESCRIPTION</th>
                {f.showMRP !== false && <th className="py-1 px-1 border-r border-teal-800 text-right w-12">MRP</th>}
                <th className="py-1 px-1 border-r border-teal-800 text-right w-12">QTY</th>
                <th className="py-1 px-1 border-r border-teal-800 text-center w-10">UOM</th>
                <th className="py-1 px-1 border-r border-teal-800 text-right w-12">RATE</th>
                <th className="py-1 px-1 border-r border-teal-800 text-right w-14">AMT</th>
                <th className="py-1 px-1 border-r border-teal-800 text-right w-10">DIS</th>
                {f.showTaxSplit !== false && <th className="py-1 px-1 border-r border-teal-800 text-right w-14">CGST%</th>}
                {f.showTaxSplit !== false && <th className="py-1 px-1 border-r border-teal-800 text-right w-14">SGST%</th>}
                <th className="py-1 px-2 text-right w-16">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((it, idx) => {
                const qty = Number(it.quantity || 1);
                const rate = Number(it.unit_price || 0);
                const mrp = Number(it.mrp || rate * 1.15);
                const disc = Number(it.discount_value || 0);
                const isIncl = it.is_tax_inclusive === true || (it as any).is_inclusive === true || invoice.is_tax_inclusive === true;
                const taxRate = Number(it.tax_rate || 18);
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

                return (
                  <tr key={idx} className="border-b border-gray-200 hover:bg-teal-50/20">
                    <td className="py-0.5 px-1 text-center border-r border-black font-sans">{idx + 1}.</td>
                    {f.showProductImage && (
                      <td className="py-0.5 px-1 text-center border-r border-black">
                        <div className="w-5 h-5 rounded bg-slate-100 border border-slate-300 mx-auto flex items-center justify-center text-[8px]">
                          🍪
                        </div>
                      </td>
                    )}
                    {f.showHSN !== false && <td className="py-0.5 px-1 text-center border-r border-black">{it.hsn_code || '19059020'}</td>}
                    <td className="py-0.5 px-2 font-sans font-bold border-r border-black text-left">
                      <span>{it.product_name || 'Goods'}</span>
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
                    </td>
                    {f.showMRP !== false && <td className="py-0.5 px-1 text-right border-r border-black">{mrp.toFixed(2)}</td>}
                    <td className="py-0.5 px-1 text-right font-bold border-r border-black">
                      <div>{qty.toFixed(3)}</div>
                      {it.secondary_uom && (
                        <span className="block text-[7px] font-black text-gray-600">
                          {it.selected_uom === it.secondary_uom ? "Sec" : "Pri"}
                        </span>
                      )}
                    </td>
                    <td className="py-0.5 px-1 text-center border-r border-black font-sans">{it.selected_uom || it.uom || '90G'}</td>
                    <td className="py-0.5 px-1 text-right border-r border-black">{displayRate.toFixed(2)}</td>
                    <td className="py-0.5 px-1 text-right border-r border-black">{taxable.toFixed(2)}</td>
                    <td className="py-0.5 px-1 text-right border-r border-black">{disc > 0 ? disc.toFixed(2) : '0.00'}</td>
                    {f.showTaxSplit !== false && <td className="py-0.5 px-1 text-right border-r border-black">{halfTax.toFixed(2)} {taxVal.toFixed(2)}</td>}
                    {f.showTaxSplit !== false && <td className="py-0.5 px-1 text-right border-r border-black">{halfTax.toFixed(2)} {taxVal.toFixed(2)}</td>}
                    <td className="py-0.5 px-2 text-right font-bold">{totalAmt.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── BARCODE & QR CODE SECTION ─── */}
      {(f.showBarcode || f.showQR) && (
        <div className="flex items-center justify-center gap-6 py-1 border-t border-black bg-black/[0.02]">
          {f.showBarcode && (
            <div className="flex flex-col items-center">
              <div className="font-mono text-[8px] tracking-widest bg-white px-2 py-0.5 border border-black">
                ||||| | |||| ||| |||||||
              </div>
              <span className="text-[7px] font-mono">{invoice.invoice_number || 'B000738'}</span>
            </div>
          )}
          {f.showQR && (
            <div className="flex items-center gap-1.5 bg-white border border-black p-1 rounded">
              <div className="size-7 bg-black text-white text-[6px] font-mono flex items-center justify-center font-bold">
                UPI
              </div>
              <div className="text-[7px] font-sans font-bold">Scan to Pay</div>
            </div>
          )}
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
            </div>
          </div>
        </div>
      )}

      {/* ─── TERMS, PAYMENT & SIGNATURES ─── */}
      <div className="grid grid-cols-12 border-t-2 border-black pt-1 mt-1 text-[8px]">
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
              <span className="font-bold text-black font-sans">Payment Details: </span>
              <span>Bank: HDFC Bank | A/C: 502000492811 | IFSC: HDFC0000003</span>
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
