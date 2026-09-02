'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { getActiveReceiptTemplate, getTenantTemplatesKey, getTenantDefaultsKey, ReceiptTemplate } from '../../lib/receipt-template-store';
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";

interface ThermalReceiptPrinterProps {
  bill: any;
  customTemplate?: any;
}

export function ThermalReceiptPrinter({ bill, customTemplate }: ThermalReceiptPrinterProps) {
  const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();
  if (!bill) return null;
  if (typeof document === 'undefined') return null;

  // Retrieve Active Inventory Print Template
  let invTemplate: any = null;
  try {
    const storageKey = getTenantTemplatesKey(tenant?.id);
    const defaultsKey = getTenantDefaultsKey(tenant?.id);
    const rawInv = localStorage.getItem(storageKey);
    const rawActive = localStorage.getItem(defaultsKey);
    if (rawInv) {
      const templates = JSON.parse(rawInv);
      const activeMap = rawActive ? JSON.parse(rawActive) : {};
      const activeId = activeMap.thermal || activeMap.invoices;
      invTemplate = templates.find((t: any) => t.id === activeId) ||
                    templates.find((t: any) => t.category === 'thermal' && t.isDefault) ||
                    templates.find((t: any) => t.category === 'thermal') ||
                    templates[0];
    }
  } catch (e) {
    console.error('Failed to load inventory print template:', e);
  }

  const fallbackStore = getActiveReceiptTemplate();
  const tenantRaw = (tenant as any)?.raw || {};
  const storeName = tenant?.name || invTemplate?.storeName || fallbackStore.storeName || 'Store';
  const storeAddress = invTemplate?.storeAddress || tenantRaw?.address || fallbackStore.address || '';
  const storePhone = invTemplate?.storePhone || tenantRaw?.phone || fallbackStore.phone || '';
  const gstin = invTemplate?.gstin || tenantRaw?.gstin || fallbackStore.gstin || '';
  const headerTitle = invTemplate?.headerTitle || fallbackStore.invoiceTitle || 'RETAIL RECEIPT';
  const footerText = invTemplate?.footerText || fallbackStore.footerNote || '*** THANK YOU FOR SHOPPING ***';
  const termsText = invTemplate?.termsText || fallbackStore.declarationText || '';

  const f = invTemplate?.fields || {
    showLogo: true,
    showStoreAddress: true,
    showTaxId: true,
    showCustomerDetails: true,
    showTime: true,
    showPaymentQR: true
  };

  const invoiceNum = bill.invoice_number || bill.id || bill.rawId?.substring(0, 8) || '#90412';
  const dateStr = bill.date ? new Date(bill.date).toLocaleDateString() : '01/08/2026';
  const timeStr = bill.date ? new Date(bill.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '12:14:35 PM';
  const customerName = bill.customerName || 'ACME Enterprises';

  const items = bill.items || [];
  const rawSubtotal = bill.subtotal || items.reduce((sum, i) => sum + ((i.quantity || 1) * (i.unit_price || i.price || 0)), 0);
  const rawDiscount = bill.discount || bill.discount_amount || 0;
  const rawTax = bill.tax || bill.tax_amount || (rawSubtotal * 0.05);
  const grandTotal = bill.total || bill.grand_total || (rawSubtotal - rawDiscount + rawTax);

  const is58mm = invTemplate?.paperSize === '58mm' || fallbackStore.paperSize === '58mm';
  const printableWidth = is58mm ? '48mm' : '72mm';

  return createPortal(
    <div
      id="printable-receipt-portal"
      className="hidden print:block bg-white text-black p-1 text-[12px] font-semibold leading-tight select-none fixed left-[-9999px] top-[-9999px] print:static print:visible pointer-events-none print:pointer-events-auto"
      style={{
        width: printableWidth,
        maxWidth: printableWidth,
        margin: '0 auto',
        fontFamily: '"Segoe UI", -apple-system, BlinkMacSystemFont, "Roboto", "Helvetica Neue", Arial, "Consolas", monospace',
        color: '#000000',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        textRendering: 'geometricPrecision',
      }}
    >
      {/* Header */}
      <div className="text-center border-b-[1.5px] border-dashed border-black pb-2">
        {f.showLogo && (
          (invTemplate?.logoUrl || fallbackStore.logoUrl || tenant?.logo_url || tenant?.raw?.logo_url) ? (
            <img
              src={invTemplate?.logoUrl || fallbackStore.logoUrl || tenant?.logo_url || tenant?.raw?.logo_url}
              alt="Logo"
              className="mx-auto max-h-8 max-w-[120px] object-contain mb-1 filter grayscale contrast-200"
            />
          ) : (
            <div className="mx-auto h-7 w-7 bg-black text-white font-extrabold flex items-center justify-center text-xs rounded mb-1">
              {storeName ? storeName.substring(0, 2).toUpperCase() : (tenant?.name ? tenant.name.substring(0, 2).toUpperCase() : 'IS')}
            </div>
          )
        )}
        <h2 className="font-extrabold text-[15px] tracking-wide uppercase">{storeName || tenant?.name}</h2>
        {f.showStoreAddress && storeAddress && (
          <p className="text-[11px] font-semibold mt-0.5 whitespace-pre-line">{storeAddress}</p>
        )}
        {storePhone && <p className="text-[11px] font-semibold">{storePhone}</p>}
        {gstin && (
          <p className="text-[11px] font-extrabold mt-0.5">GSTIN: {gstin}</p>
        )}
        <h3 className="font-extrabold border-[1.5px] border-black inline-block px-2.5 py-0.5 mt-2 text-[11px] uppercase tracking-wider">
          {headerTitle}
        </h3>
      </div>

      {/* Transaction Meta */}
      <div className="text-[11px] font-semibold border-b-[1.5px] border-dashed border-black py-1.5 space-y-0.5">
        <div className="flex justify-between">
          <span className="font-bold">Bill No: {invoiceNum}</span>
          <span>Date: {dateStr}</span>
        </div>
        {f.showTime && (
          <div className="flex justify-between">
            <span>Time: {timeStr}</span>
            <span>Cashier: Admin</span>
          </div>
        )}
        {f.showCustomerDetails && (
          <div className="text-[10.5px] font-semibold text-black mt-1 border-t border-dashed border-black pt-1">
            <span>Customer: {customerName}</span>
            {f.showPartyBalance && (
              <span className="block text-black font-extrabold mt-0.5">O/S Balance: {currency.symbol}14,200.00</span>
            )}
          </div>
        )}
      </div>

      {/* Item Table */}
      <table className="w-full text-left text-[11px] my-1 font-semibold">
        <thead>
          <tr className="border-b-[1.5px] border-black text-[11.5px] font-extrabold">
            <th className="pb-1 text-black">ITEM</th>
            <th className="pb-1 text-center text-black">QTY</th>
            <th className="pb-1 text-right text-black">PRICE</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-dashed divide-black">
          {items.map((item, idx) => {
            const name = item.name || item.product_name || `Item ${idx + 1}`;
            const qty = item.quantity || 1;
            const rate = item.unit_price || item.price || (qty > 0 ? (item.subtotal || 0) / qty : 0);
            const lineAmt = item.subtotal || (qty * rate) - (item.discount || 0);

            return (
              <tr key={idx} className="text-black">
                <td className="py-1 pr-1 font-bold">
                  {name}
                  {f.showSKU && item.sku && <span className="block text-[9.5px] font-semibold text-black">SKU: {item.sku}</span>}
                  {f.showHSN && item.hsn_code && <span className="block text-[9.5px] font-semibold text-black">HSN: {item.hsn_code}</span>}
                </td>
                <td className="py-1 text-center font-extrabold align-top">{qty}</td>
                <td className="py-1 text-right font-extrabold align-top">{Number(lineAmt || 0).toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals */}
      <div className="border-t-[1.5px] border-dashed border-black pt-1.5 space-y-0.5 text-[12px] font-semibold">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span className="font-bold">{Number(rawSubtotal || 0).toFixed(2)}</span>
        </div>
        {f.showTaxSplit && (
          <div className="flex justify-between text-[10.5px] font-semibold text-black">
            <span>CGST 2.5% + SGST 2.5%:</span>
            <span>{Number(rawTax || 0).toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-extrabold text-[14px] border-t-[2px] border-black pt-1 mt-1 text-black">
          <span>TOTAL AMOUNT:</span>
          <span>{currency.symbol}{Number(grandTotal || 0).toFixed(2)}</span>
        </div>
      </div>

      {/* Payment Mode */}
      {bill.payment_method && (
        <div className="flex justify-between text-[10.5px] font-extrabold mt-1.5 border-t border-dashed border-black pt-1 text-black">
          <span>PAYMENT MODE:</span>
          <span className="uppercase">{bill.payment_method} ({bill.payment_status || 'PAID'})</span>
        </div>
      )}

      {/* Savings Banner */}
      {rawDiscount > 0 && (
        <div className="text-center font-extrabold text-[10.5px] border-[1.5px] border-dashed border-black py-0.5 my-1.5 uppercase text-black">
          ★ YOU SAVED ₹{Number(rawDiscount).toFixed(2)} ON THIS ORDER ★
        </div>
      )}

      {/* Payment QR */}
      {f.showPaymentQR && (
        <div className="flex flex-col items-center justify-center pt-1.5 my-1 border-t border-dashed border-black text-center">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=0&data=${encodeURIComponent(
              `upi://pay?pa=${fallbackStore.upiId || 'merchant@upi'}&pn=${encodeURIComponent(
                storeName
              )}&am=${Number(grandTotal || 0).toFixed(2)}&cu=INR`
            )}`}
            alt="UPI QR Code"
            style={{ imageRendering: 'pixelated' }}
            className="w-20 h-20 object-contain border-[1.5px] border-black p-0.5 my-1"
          />
          <span className="text-[9.5px] font-extrabold block uppercase tracking-wider text-black">
            Scan & Pay via UPI / QR
          </span>
        </div>
      )}

      {/* Google Review QR */}
      {(invTemplate?.showGoogleReviewQR !== false && (invTemplate?.googleReviewUrl || fallbackStore.googleReviewUrl)) && (
        <div className="flex flex-col items-center justify-center pt-1.5 my-1 border-t border-dashed border-black text-center">
          <span className="text-[9px] font-black block uppercase tracking-wider text-black">
            ★ ★ ★ ★ ★ RATE US ON GOOGLE
          </span>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&margin=0&data=${encodeURIComponent(
              invTemplate?.googleReviewUrl || fallbackStore.googleReviewUrl || 'https://search.google.com/local/writereview'
            )}`}
            alt="Google Review QR"
            style={{ imageRendering: 'pixelated' }}
            className="w-16 h-16 object-contain border-[1.5px] border-black p-0.5 my-1"
          />
          <span className="text-[8.5px] font-bold block text-black">
            Scan to Review Us on Google!
          </span>
        </div>
      )}

      {/* Terms & Footer */}
      {termsText && (
        <div className="text-[9.5px] font-semibold border-t border-dashed border-black pt-1 mt-1 text-center text-black leading-tight">
          {termsText}
        </div>
      )}
      {footerText && (
        <div className="text-[10px] font-extrabold border-t border-dashed border-black pt-1 mt-1 text-center whitespace-pre-line leading-tight text-black">
          {footerText}
        </div>
      )}
    </div>,
    document.body
  );
}
