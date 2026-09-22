'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { getActiveReceiptTemplate, getActiveBillingGst, getOrgPaymentQrSettings, getTenantTemplatesKey, getTenantDefaultsKey, ReceiptTemplate } from '../../lib/receipt-template-store';
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { resolveImageUrl } from "@/lib/api-client";
import { formatDisplayDate } from "@/lib/utils";
import { generateQRCodeSVG } from "@/lib/qr-generator";

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

  // Active Billing GST & Scoped Organization Details
  const activeBillingGst = getActiveBillingGst(tenant?.id);
  const fallbackStore = getActiveReceiptTemplate();
  const tenantRaw = (tenant as any)?.raw || {};
  
  const storeName = activeBillingGst?.trade_name || activeBillingGst?.legal_name || tenant?.name || invTemplate?.storeName || fallbackStore.storeName || 'Store';
  const storeAddress = activeBillingGst?.address || invTemplate?.storeAddress || tenantRaw?.address || fallbackStore.address || '';
  const storePhone = activeBillingGst?.phone || invTemplate?.storePhone || tenantRaw?.phone || fallbackStore.phone || '';
  const gstin = activeBillingGst?.gstin || invTemplate?.gstin || tenantRaw?.gstin || fallbackStore.gstin || '';
  const headerTitle = invTemplate?.headerTitle || fallbackStore.invoiceTitle || 'RETAIL RECEIPT';
  const footerText = invTemplate?.footerText || fallbackStore.footerNote || '*** THANK YOU FOR SHOPPING ***';
  const termsText = activeBillingGst?.terms_and_conditions || invTemplate?.termsText || fallbackStore.declarationText || '';

  // Logo Resolution per organization
  const rawLogo = activeBillingGst?.logo_url || invTemplate?.logoUrl || fallbackStore.logoUrl || tenant?.logo_url || tenantRaw?.logo_url || '';
  const resolvedLogoUrl = resolveImageUrl(rawLogo);

  // Google Review Resolution per organization
  const rawGoogleReviewUrl = activeBillingGst?.google_review_url || invTemplate?.googleReviewUrl || fallbackStore.googleReviewUrl || '';
  const googlePlaceId = activeBillingGst?.google_place_id || '';
  const resolvedGoogleReviewUrl = rawGoogleReviewUrl || (googlePlaceId ? `https://search.google.com/local/writereview?placeid=${googlePlaceId}` : '');
  const googleReviewEnabled = (activeBillingGst?.google_review_enabled !== false) && (invTemplate?.showGoogleReviewQR !== false) && Boolean(resolvedGoogleReviewUrl);

  const f = invTemplate?.fields || {
    showLogo: true,
    showStoreAddress: true,
    showTaxId: true,
    showCustomerDetails: true,
    showTime: true,
    showPaymentQR: true
  };

  const invoiceNum = bill.invoice_number || bill.id || bill.rawId?.substring(0, 8) || '#90412';
  const dateStr = formatDisplayDate(bill.date || new Date());
  const timeStr = bill.date ? new Date(bill.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const customerName = bill.customerName || 'Walk-in Customer';

  const items = bill.items || [];
  const rawSubtotal = bill.subtotal || items.reduce((sum: number, i: any) => sum + ((i.quantity || 1) * (i.unit_price || i.price || 0)), 0);
  const rawDiscount = bill.discount || bill.discount_amount || 0;
  const rawTax = bill.tax || bill.tax_amount || (rawSubtotal * 0.05);
  const grandTotal = bill.total || bill.grand_total || (rawSubtotal - rawDiscount + rawTax);

  const is58mm = invTemplate?.paperSize === '58mm' || fallbackStore.paperSize === '58mm';
  const printableWidth = is58mm ? '48mm' : '72mm';

  // ── Payment QR & Paid-in-Full Smart Resolution ────────────────────
  const paymentQrSettings = getOrgPaymentQrSettings(tenant?.id);
  const amountReceived = Number(bill.amount_received ?? bill.paid_amount ?? 0);
  const isPaidInFull = Boolean(
    bill.payment_status?.toUpperCase() === 'PAID' ||
    bill.payment_status?.toLowerCase() === 'paid' ||
    bill.status?.toUpperCase() === 'PAID' ||
    (amountReceived > 0 && amountReceived >= (Number(grandTotal || 0) - 0.05))
  );
  const balanceDue = isPaidInFull ? 0 : Math.max(0, Number(grandTotal || 0) - amountReceived);
  const shouldPrintPaymentQr = Boolean(
    bill.print_payment_qr !== false &&
    paymentQrSettings.enabled
  );

  const resolvedUpiVpa = (bill.upi_vpa || paymentQrSettings.vpa || activeBillingGst?.upi_vpa || fallbackStore.upiId || '').trim();
  const resolvedPayeeName = encodeURIComponent(paymentQrSettings.payeeName || storeName);
  const resolvedInvoiceNo = encodeURIComponent(bill.invoice_number || 'INV');
  const targetAmount = balanceDue > 0 ? balanceDue : Number(grandTotal || 0);
  const upiIntentUrl = resolvedUpiVpa
    ? `upi://pay?pa=${resolvedUpiVpa}&pn=${resolvedPayeeName}&am=${targetAmount.toFixed(2)}&tn=Invoice%20${resolvedInvoiceNo}&cu=INR`
    : '';

  const paymentQrSrc = shouldPrintPaymentQr
    ? (paymentQrSettings.type === 'custom_image' && paymentQrSettings.customImageUrl
        ? paymentQrSettings.customImageUrl
        : generateQRCodeSVG(
            upiIntentUrl || `upi://pay?pa=${resolvedUpiVpa || 'merchant@upi'}&pn=${resolvedPayeeName}&am=${targetAmount.toFixed(2)}&tn=Invoice%20${resolvedInvoiceNo}&cu=INR`,
            140
          ))
    : '';

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
          resolvedLogoUrl ? (
            <img
              src={resolvedLogoUrl}
              alt="Logo"
              className="mx-auto max-h-10 max-w-[140px] object-contain mb-1 filter grayscale contrast-200"
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
          <div className="text-[10.5px] font-semibold text-black mt-1 border-t border-dashed border-black pt-1 space-y-0.5">
            <div>Customer: <span className="font-bold">{customerName}</span></div>
            {(bill.customerBillingAddress || bill.customerAddress) && (
              <div className="text-[10px]">Bill To: {bill.customerBillingAddress || bill.customerAddress}</div>
            )}
            {(bill.customerShippingAddress || bill.customerBillingAddress || bill.customerAddress) && (
              <div className="text-[10px] font-bold">Ship To: {bill.customerShippingAddress || bill.customerBillingAddress || bill.customerAddress}</div>
            )}
            {bill.po_number && <div className="text-[10px]">PO Ref: {bill.po_number}</div>}
            {bill.vehicle_number && <div className="text-[10px]">Vehicle: {bill.vehicle_number}</div>}
            {bill.eway_bill_number && <div className="text-[10px] font-extrabold">e-Way Bill: {bill.eway_bill_number}</div>}
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
          {items.map((item: any, idx: number) => {
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
          (bill as any)?.gst_type === 'igst' || (bill as any)?.is_interstate ? (
            <div className="flex justify-between text-[10.5px] font-semibold text-black">
              <span>IGST (Integrated Tax):</span>
              <span>{Number(rawTax || 0).toFixed(2)}</span>
            </div>
          ) : (
            <div className="flex justify-between text-[10.5px] font-semibold text-black">
              <span>CGST + SGST:</span>
              <span>{Number(rawTax || 0).toFixed(2)}</span>
            </div>
          )
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

      {/* Payment QR / Verified Paid Status */}
      {isPaidInFull && (
        <div className="text-center font-black text-[10px] border-[1.5px] border-black py-1 my-1.5 uppercase text-black">
          ★ [✓ PAID IN FULL] ({bill.payment_method || 'CASH'}) ★
        </div>
      )}
      {shouldPrintPaymentQr && paymentQrSrc && (
        <div className="flex flex-col items-center justify-center pt-1.5 my-1 border-t border-dashed border-black text-center">
          <img
            src={paymentQrSrc}
            alt="UPI QR Code"
            className="w-20 h-20 object-contain border-[1.5px] border-black p-0.5 my-1"
          />
          <span className="text-[9.5px] font-extrabold block uppercase tracking-wider text-black">
            {balanceDue > 0 ? `Scan to Pay Balance: ₹${balanceDue.toFixed(2)}` : `Store UPI QR: ₹${targetAmount.toFixed(2)}`}
          </span>
          {resolvedUpiVpa && (
            <span className="text-[8.5px] font-mono text-black font-semibold">
              UPI: {resolvedUpiVpa}
            </span>
          )}
        </div>
      )}

      {/* Terms & Conditions */}
      {termsText && (
        <div className="text-[9.5px] font-semibold border-t border-dashed border-black pt-1 mt-1 text-center text-black leading-tight">
          {termsText}
        </div>
      )}

      {/* Thank You Footer Message */}
      {footerText && (
        <div className="text-[10px] font-extrabold border-t border-dashed border-black pt-1 mt-1 text-center whitespace-pre-line leading-tight text-black uppercase tracking-wider">
          {footerText}
        </div>
      )}

      {/* Google Review Section Below Thank You Message */}
      {googleReviewEnabled && resolvedGoogleReviewUrl && (
        <div className="flex flex-col items-center justify-center pt-2 mt-1.5 border-t-[1.5px] border-dashed border-black text-center">
          <div className="flex items-center justify-center gap-1 font-black text-[10px] tracking-widest text-black">
            <span>★ ★ ★ ★ ★</span>
          </div>
          <span className="text-[9.5px] font-black uppercase tracking-wider text-black mt-0.5">
            LEAVE US A GOOGLE REVIEW
          </span>
          <img
            src={generateQRCodeSVG(resolvedGoogleReviewUrl, 140)}
            alt="Google Review QR Code"
            className="w-16 h-16 object-contain border-[1.5px] border-black p-0.5 my-1"
          />
          <span className="text-[8.5px] font-bold block text-black">
            Scan to Share Your Feedback on Google!
          </span>
        </div>
      )}
    </div>,
    document.body
  );
}
