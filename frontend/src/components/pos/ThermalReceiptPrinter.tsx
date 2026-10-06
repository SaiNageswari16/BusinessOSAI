'use client';

import React from 'react';
import { useI18n } from "@/contexts/i18n-context";
import { createPortal } from 'react-dom';
import { getActiveReceiptTemplate, getActiveBillingGst, getOrgPaymentQrSettings, getTenantTemplatesKey, getTenantDefaultsKey, ReceiptTemplate } from '../../lib/receipt-template-store';
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { resolveImageUrl } from "@/lib/api-client";
import { formatDisplayDate } from "@/lib/utils";
import { generateQRCodeSVG, buildUpiPayUrl } from "@/lib/qr-generator";

interface ThermalReceiptPrinterProps {
  bill: any;
  customTemplate?: any;
}

export function ThermalReceiptPrinter({ bill, customTemplate }: ThermalReceiptPrinterProps) {
  const { t } = useI18n();
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
  const fallbackStore = customTemplate || getActiveReceiptTemplate();
  const tenantRaw = (tenant as any)?.raw || {};
  
  const storeName = activeBillingGst?.trade_name || activeBillingGst?.legal_name || tenant?.name || invTemplate?.storeName || fallbackStore.storeName || 'Store';
  const branchName = invTemplate?.branchName || fallbackStore.branchName || '';
  const storeAddress = activeBillingGst?.address || invTemplate?.storeAddress || tenantRaw?.address || fallbackStore.address || '';
  const storePhone = activeBillingGst?.phone || invTemplate?.storePhone || tenantRaw?.phone || fallbackStore.phone || '';
  const storeEmail = invTemplate?.email || fallbackStore.email || '';
  const gstin = activeBillingGst?.gstin || invTemplate?.gstin || tenantRaw?.gstin || fallbackStore.gstin || '';
  const cin = invTemplate?.cin || fallbackStore.cin || '';
  const headerTitle = invTemplate?.headerTitle || fallbackStore.invoiceTitle || 'TAX INVOICE';
  const headerTagline = invTemplate?.headerTagline || fallbackStore.headerTagline || '';
  const footerText = invTemplate?.footerText || fallbackStore.footerNote || '*** THANK YOU FOR SHOPPING ***';
  const declarationText = invTemplate?.declarationText || fallbackStore.declarationText || '';
  const termsText = activeBillingGst?.terms_and_conditions || invTemplate?.termsAndConditionsText || fallbackStore.termsAndConditionsText || '';

  // Logo Resolution per organization
  const rawLogo = activeBillingGst?.logo_url || invTemplate?.logoUrl || fallbackStore.logoUrl || tenant?.logo_url || tenantRaw?.logo_url || '';
  const resolvedLogoUrl = resolveImageUrl(rawLogo);

  // Merge toggles from invTemplate.fields and fallbackStore (ReceiptTemplate)
  const f = {
    // Header
    showLogo: invTemplate?.fields?.showLogo ?? fallbackStore.showLogo ?? true,
    showStoreName: invTemplate?.fields?.showStoreName ?? fallbackStore.showStoreName ?? true,
    showBranchName: invTemplate?.fields?.showBranchName ?? fallbackStore.showBranchName ?? true,
    showStoreAddress: invTemplate?.fields?.showStoreAddress ?? fallbackStore.showStoreAddress ?? true,
    showStoreContact: invTemplate?.fields?.showStoreContact ?? fallbackStore.showStoreContact ?? true,
    showTaxId: invTemplate?.fields?.showTaxId ?? fallbackStore.showTaxId ?? true,
    showCin: invTemplate?.fields?.showCin ?? fallbackStore.showCin ?? true,
    showInvoiceTitle: invTemplate?.fields?.showInvoiceTitle ?? fallbackStore.showInvoiceTitle ?? true,
    showTagline: invTemplate?.fields?.showTagline ?? fallbackStore.showTagline ?? true,
    showCashier: invTemplate?.fields?.showCashier ?? fallbackStore.showCashier ?? true,
    showTime: invTemplate?.fields?.showTime ?? fallbackStore.showTime ?? true,
    showCustomerDetails: invTemplate?.fields?.showCustomerDetails ?? fallbackStore.showCustomerDetails ?? true,
    showCustomerAddress: invTemplate?.fields?.showCustomerAddress ?? fallbackStore.showCustomerAddress ?? true,
    showCustomerPhone: invTemplate?.fields?.showCustomerPhone ?? fallbackStore.showCustomerPhone ?? true,
    showShippingAddress: invTemplate?.fields?.showShippingAddress ?? fallbackStore.showShippingAddress ?? true,
    showPoNumber: invTemplate?.fields?.showPoNumber ?? fallbackStore.showPoNumber ?? true,
    showVehicleNumber: invTemplate?.fields?.showVehicleNumber ?? fallbackStore.showVehicleNumber ?? true,
    showEwayBill: invTemplate?.fields?.showEwayBill ?? fallbackStore.showEwayBill ?? true,
    showChallanNumber: invTemplate?.fields?.showChallanNumber ?? fallbackStore.showChallanNumber ?? true,

    // Item Table
    showItemIndex: invTemplate?.fields?.showItemIndex ?? fallbackStore.showItemIndex ?? true,
    showItemName: invTemplate?.fields?.showItemName ?? fallbackStore.showItemName ?? true,
    showItemDescription: invTemplate?.fields?.showItemDescription ?? fallbackStore.showItemDescription ?? true,
    showItemHSN: invTemplate?.fields?.showItemHSN ?? invTemplate?.fields?.showHSN ?? fallbackStore.showItemHSN ?? true,
    showItemSKU: invTemplate?.fields?.showItemSKU ?? invTemplate?.fields?.showSKU ?? fallbackStore.showItemSKU ?? false,
    showItemQty: invTemplate?.fields?.showItemQty ?? fallbackStore.showItemQty ?? true,
    showItemUom: invTemplate?.fields?.showItemUom ?? fallbackStore.showItemUom ?? true,
    showItemRate: invTemplate?.fields?.showItemRate ?? fallbackStore.showItemRate ?? true,
    showItemMrp: invTemplate?.fields?.showItemMrp ?? fallbackStore.showItemMrp ?? true,
    showItemDiscount: invTemplate?.fields?.showItemDiscount ?? fallbackStore.showItemDiscount ?? true,
    showItemTax: invTemplate?.fields?.showItemTax ?? fallbackStore.showItemTax ?? true,
    showItemTotal: invTemplate?.fields?.showItemTotal ?? fallbackStore.showItemTotal ?? true,

    // Totals & Footer
    showSubtotal: invTemplate?.fields?.showSubtotal ?? fallbackStore.showSubtotal ?? true,
    showTotalDiscount: invTemplate?.fields?.showTotalDiscount ?? fallbackStore.showTotalDiscount ?? true,
    showSavingsBanner: invTemplate?.fields?.showSavingsBanner ?? fallbackStore.showSavingsBanner ?? true,
    showTaxBreakdown: invTemplate?.fields?.showTaxBreakdown ?? invTemplate?.fields?.showTaxSplit ?? fallbackStore.showTaxBreakdown ?? true,
    showRoundOff: invTemplate?.fields?.showRoundOff ?? fallbackStore.showRoundOff ?? true,
    showGrandTotal: invTemplate?.fields?.showGrandTotal ?? fallbackStore.showGrandTotal ?? true,
    showLoyaltyPoints: invTemplate?.fields?.showLoyaltyPoints ?? fallbackStore.showLoyaltyPoints ?? true,
    showPaymentMode: invTemplate?.fields?.showPaymentMode ?? fallbackStore.showPaymentMode ?? true,
    showPaidInFullStamp: invTemplate?.fields?.showPaidInFullStamp ?? fallbackStore.showPaidInFullStamp ?? true,
    showQrCode: invTemplate?.fields?.showQrCode ?? invTemplate?.fields?.showPaymentQR ?? fallbackStore.showQrCode ?? true,
    showGoogleReviewQR: invTemplate?.fields?.showGoogleReviewQR ?? fallbackStore.showGoogleReviewQR ?? false,
    showTermsAndConditions: invTemplate?.fields?.showTermsAndConditions ?? fallbackStore.showTermsAndConditions ?? true,
    showDeclaration: invTemplate?.fields?.showDeclaration ?? fallbackStore.showDeclaration ?? true,
    showFooterNote: invTemplate?.fields?.showFooterNote ?? fallbackStore.showFooterNote ?? true,
  };

  // Google Review Resolution per organization
  const rawGoogleReviewUrl = activeBillingGst?.google_review_url || invTemplate?.googleReviewUrl || fallbackStore.googleReviewUrl || '';
  const googlePlaceId = activeBillingGst?.google_place_id || '';
  const resolvedGoogleReviewUrl = rawGoogleReviewUrl || (googlePlaceId ? `https://search.google.com/local/writereview?placeid=${googlePlaceId}` : '');
  const googleReviewEnabled = (activeBillingGst?.google_review_enabled !== false) && (f.showGoogleReviewQR !== false) && Boolean(resolvedGoogleReviewUrl);

  const invoiceNum = bill.invoice_number || bill.id || bill.rawId?.substring(0, 8) || '#90412';
  const dateStr = formatDisplayDate(bill.date || new Date());
  const timeStr = bill.date ? new Date(bill.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const customerName = bill.customerName || 'Walk-in Customer';
  const cashierName = bill.cashier_name || bill.cashier || bill.created_by_name || 'Admin';

  const items = bill.items || [];
  const rawSubtotal = bill.subtotal || items.reduce((sum: number, i: any) => sum + ((i.quantity || 1) * (i.unit_price || i.price || 0)), 0);
  const rawDiscount = bill.discount || bill.discount_amount || 0;
  const rawTax = bill.tax || bill.tax_amount || (rawSubtotal * 0.05);
  const roundOff = bill.round_off || bill.roundoff || 0;
  const grandTotal = bill.total || bill.grand_total || (rawSubtotal - rawDiscount + rawTax + roundOff);

  const is58mm = invTemplate?.paperSize === '58mm' || fallbackStore.paperSize === '58mm';
  const printableWidth = is58mm ? '48mm' : '72mm';

  // Typography & Density style resolution
  const fontDensity = fallbackStore.fontDensity || invTemplate?.fontDensity || 'normal';
  const printClarity = fallbackStore.printClarity || 'ultra_dark';
  const fontFamilyChoice = fallbackStore.fontFamily || 'monospace';
  const dividerStyle = fallbackStore.dividerStyle || 'dashed';

  const fontFam = fontFamilyChoice === 'sans-serif'
    ? '"Segoe UI", -apple-system, BlinkMacSystemFont, "Roboto", "Helvetica Neue", Arial, sans-serif'
    : fontFamilyChoice === 'clean'
    ? '"Inter", "Segoe UI", -apple-system, sans-serif'
    : '"Consolas", "Courier New", Courier, monospace';

  const dividerBorderClass = dividerStyle === 'solid'
    ? 'border-solid'
    : dividerStyle === 'dotted'
    ? 'border-dotted'
    : dividerStyle === 'double'
    ? 'border-double'
    : 'border-dashed';

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
    f.showQrCode &&
    bill.print_payment_qr !== false &&
    paymentQrSettings.enabled
  );

  const resolvedUpiVpa = (bill.upi_vpa || paymentQrSettings.vpa || activeBillingGst?.upi_vpa || fallbackStore.upiId || '').trim();
  const targetAmount = balanceDue > 0 ? balanceDue : Number(grandTotal || 0);
  const upiIntentUrl = resolvedUpiVpa
    ? buildUpiPayUrl({
        vpa: resolvedUpiVpa,
        payeeName: paymentQrSettings.payeeName || storeName,
        amount: targetAmount,
        invoiceNumber: bill.invoice_number || 'INV',
      })
    : '';

  const paymentQrSrc = shouldPrintPaymentQr
    ? (paymentQrSettings.type === 'custom_image' && paymentQrSettings.customImageUrl
        ? paymentQrSettings.customImageUrl
        : (upiIntentUrl ? generateQRCodeSVG(upiIntentUrl, 140) : ''))
    : '';

  return createPortal(
    <div
      id="printable-receipt-portal"
      className="hidden print:block bg-white text-black p-1 text-[12px] font-bold leading-tight select-none fixed left-[-9999px] top-[-9999px] print:static print:visible pointer-events-none print:pointer-events-auto"
      style={{
        width: printableWidth,
        maxWidth: printableWidth,
        margin: '0 auto',
        fontFamily: fontFam,
        color: '#000000',
        fontWeight: 800,
        textShadow: '0 0 0.2px #000000',
        WebkitFontSmoothing: 'antialiased',
        WebkitTextStroke: printClarity === 'ultra_dark' ? '0.25px #000000' : '0.1px #000000',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        textRendering: 'geometricPrecision',
      }}
    >
      {/* Header */}
      <div className={`text-center border-b-[2px] ${dividerBorderClass} border-black pb-2`}>
        {f.showLogo && (
          resolvedLogoUrl ? (
            <img
              src={resolvedLogoUrl}
              alt="Logo"
              className="mx-auto max-h-12 max-w-[150px] object-contain mb-1 filter grayscale contrast-200"
            />
          ) : (
            <div className="mx-auto h-7 w-7 bg-black text-white font-extrabold flex items-center justify-center text-xs rounded mb-1">
              {storeName ? storeName.substring(0, 2).toUpperCase() : (tenant?.name ? tenant.name.substring(0, 2).toUpperCase() : 'IS')}
            </div>
          )
        )}
        {f.showStoreName && (
          <h2 className="font-black text-[15px] tracking-wide uppercase text-black">{storeName || tenant?.name}</h2>
        )}
        {f.showBranchName && branchName && (
          <p className="text-[10.5px] font-bold text-black mt-0.5">{branchName}</p>
        )}
        {f.showTagline && headerTagline && (
          <p className="text-[10px] font-semibold italic text-black mt-0.5">{headerTagline}</p>
        )}
        {f.showStoreAddress && storeAddress && (
          <p className="text-[11px] font-bold mt-0.5 whitespace-pre-line text-black">{storeAddress}</p>
        )}
        {f.showStoreContact && (
          <div className="text-[10.5px] font-bold text-black mt-0.5">
            {storePhone && <span>Ph: {storePhone}</span>}
            {storePhone && storeEmail && <span> • </span>}
            {storeEmail && <span>{storeEmail}</span>}
          </div>
        )}
        {f.showTaxId && gstin && (
          <p className="text-[11px] font-black mt-0.5 text-black">GSTIN: {gstin}</p>
        )}
        {f.showCin && cin && (
          <p className="text-[10px] font-bold text-black">CIN: {cin}</p>
        )}
        {f.showInvoiceTitle && (
          <h3 className="font-black border-[2px] border-black inline-block px-3 py-0.5 mt-1.5 text-[12px] uppercase tracking-wider text-black">
            {headerTitle}
          </h3>
        )}
      </div>

      {/* Transaction Meta */}
      <div className={`text-[11px] font-bold border-b-[2px] ${dividerBorderClass} border-black py-1.5 space-y-0.5 text-black`}>
        <div className="flex justify-between">
          <span className="font-black">Bill No: {invoiceNum}</span>
          <span>Date: {dateStr}</span>
        </div>
        <div className="flex justify-between">
          {f.showTime && <span>Time: {timeStr}</span>}
          {f.showCashier && <span>Cashier: {cashierName}</span>}
        </div>
        {f.showCustomerDetails && (
          <div className={`text-[10.5px] font-bold text-black mt-1 border-t ${dividerBorderClass} border-black pt-1 space-y-0.5`}>
            <div>Customer: <span className="font-black">{customerName}</span></div>
            {f.showCustomerPhone && bill.customerPhone && (
              <div className="text-[10px]">Phone: {bill.customerPhone}</div>
            )}
            {f.showCustomerAddress && (bill.customerBillingAddress || bill.customerAddress) && (
              <div className="text-[10px]">Bill To: {bill.customerBillingAddress || bill.customerAddress}</div>
            )}
            {f.showShippingAddress && (bill.customerShippingAddress || bill.customerBillingAddress || bill.customerAddress) && (
              <div className="text-[10px] font-bold">Ship To: {bill.customerShippingAddress || bill.customerBillingAddress || bill.customerAddress}</div>
            )}
            {f.showPoNumber && bill.po_number && <div className="text-[10px]">PO Ref: {bill.po_number}</div>}
            {f.showVehicleNumber && bill.vehicle_number && <div className="text-[10px]">Vehicle: {bill.vehicle_number}</div>}
            {f.showEwayBill && bill.eway_bill_number && <div className="text-[10px] font-black">e-Way Bill: {bill.eway_bill_number}</div>}
            {f.showChallanNumber && (bill.challan_number || bill.delivery_challan_number) && (
              <div className="text-[10px]">Challan No: {bill.challan_number || bill.delivery_challan_number}</div>
            )}
            {Array.isArray(bill.invoice_custom_fields) && bill.invoice_custom_fields.filter((f: any) => f.enabled !== false && f.name).map((cf: any, idx: number) => (
              <div key={idx} className="text-[10px]"><span className="font-bold">{cf.name}:</span> {cf.value || "—"}</div>
            ))}
            {bill.custom_fields && typeof bill.custom_fields === 'object' && !Array.isArray(bill.custom_fields) && Object.entries(bill.custom_fields).map(([k, v], idx) => (
              <div key={idx} className="text-[10px]"><span className="font-bold">{k}:</span> {String(v || "—")}</div>
            ))}
          </div>
        )}
      </div>

      {/* Item Table */}
      <table className="w-full text-left text-[11px] my-1 font-bold text-black border-collapse">
        <thead>
          <tr className="border-b-[2px] border-black text-[11.5px] font-black">
            {f.showItemIndex && <th className="pb-1 w-6 text-left text-black">#</th>}
            {f.showItemName && <th className="pb-1 text-left text-black">ITEM</th>}
            {f.showItemQty && <th className="pb-1 text-center text-black">QTY</th>}
            {f.showItemRate && <th className="pb-1 text-right text-black">RATE</th>}
            {f.showItemTotal && <th className="pb-1 text-right text-black">TOTAL</th>}
          </tr>
        </thead>
        <tbody className={`divide-y ${dividerBorderClass} divide-black`}>
          {items.map((item: any, idx: number) => {
            const name = item.name || item.product_name || `Item ${idx + 1}`;
            const qty = item.quantity || 1;
            const rate = item.unit_price || item.price || (qty > 0 ? (item.subtotal || 0) / qty : 0);
            const mrp = item.mrp || item.standard_price || 0;
            const discount = item.discount || item.item_discount || 0;
            const taxAmt = item.tax_amount || item.tax || 0;
            const lineAmt = item.subtotal || (qty * rate) - (discount || 0);

            return (
              <tr key={idx} className="text-black">
                {f.showItemIndex && (
                  <td className="py-1 pr-1 font-black align-top text-[10px]">{idx + 1}</td>
                )}
                {f.showItemName && (
                  <td className="py-1 pr-1 font-black align-top">
                    <span className="block leading-tight">{name}</span>
                    {f.showItemDescription && (item.description || item.custom_note || item.notes) && (
                      <span className="block text-[9.5px] font-bold text-black italic leading-tight">
                        {item.description || item.custom_note || item.notes}
                      </span>
                    )}
                    <div className="flex flex-wrap gap-x-2 text-[9px] font-bold text-black">
                      {f.showItemSKU && item.sku && <span>SKU:{item.sku}</span>}
                      {f.showItemHSN && item.hsn_code && <span>HSN:{item.hsn_code}</span>}
                      {f.showItemMrp && mrp > 0 && mrp !== rate && <span>MRP:₹{Number(mrp).toFixed(2)}</span>}
                      {f.showItemDiscount && discount > 0 && <span>Disc:-₹{Number(discount).toFixed(2)}</span>}
                      {f.showItemTax && taxAmt > 0 && <span>Tax:₹{Number(taxAmt).toFixed(2)}</span>}
                    </div>
                  </td>
                )}
                {f.showItemQty && (
                  <td className="py-1 text-center font-black align-top whitespace-nowrap">
                    <div>{qty} {f.showItemUom ? (item.selected_uom || item.uom || item.measuring_unit || "") : ""}</div>
                    {f.showItemUom && item.secondary_uom && (
                      <span className="block text-[8px] font-black text-black leading-none">
                        {item.selected_uom === item.secondary_uom ? "(Sec)" : "(Pri)"}
                      </span>
                    )}
                  </td>
                )}
                {f.showItemRate && (
                  <td className="py-1 text-right font-black align-top whitespace-nowrap">
                    {Number(rate || 0).toFixed(2)}
                  </td>
                )}
                {f.showItemTotal && (
                  <td className="py-1 text-right font-black align-top whitespace-nowrap">
                    {Number(lineAmt || 0).toFixed(2)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals */}
      <div className={`border-t-[2px] ${dividerBorderClass} border-black pt-1.5 space-y-0.5 text-[12px] font-bold text-black`}>
        {f.showSubtotal && (
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span className="font-black">{currency.symbol}{Number(rawSubtotal || 0).toFixed(2)}</span>
          </div>
        )}
        {f.showTotalDiscount && rawDiscount > 0 && (
          <div className="flex justify-between text-[11px] font-black text-black">
            <span>Discount / Savings:</span>
            <span>-{currency.symbol}{Number(rawDiscount || 0).toFixed(2)}</span>
          </div>
        )}
        {f.showTaxBreakdown && (
          (bill as any)?.gst_type === 'igst' || (bill as any)?.is_interstate ? (
            <div className="flex justify-between text-[10.5px] font-bold text-black">
              <span>IGST (Integrated Tax):</span>
              <span>{currency.symbol}{Number(rawTax || 0).toFixed(2)}</span>
            </div>
          ) : (
            <div className="flex justify-between text-[10.5px] font-bold text-black">
              <span>CGST + SGST:</span>
              <span>{currency.symbol}{Number(rawTax || 0).toFixed(2)}</span>
            </div>
          )
        )}
        {f.showRoundOff && Number(roundOff) !== 0 && (
          <div className="flex justify-between text-[10.5px] font-bold text-black">
            <span>Round Off:</span>
            <span>{Number(roundOff) > 0 ? `+${Number(roundOff).toFixed(2)}` : Number(roundOff).toFixed(2)}</span>
          </div>
        )}
        {f.showGrandTotal && (
          <div className="flex justify-between font-black text-[15px] border-t-[2px] border-black pt-1 mt-1 text-black">
            <span>TOTAL AMOUNT:</span>
            <span>{currency.symbol}{Number(grandTotal || 0).toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Payment Mode */}
      {f.showPaymentMode && bill.payment_method && (
        <div className={`flex justify-between text-[11px] font-black mt-1.5 border-t ${dividerBorderClass} border-black pt-1 text-black`}>
          <span>PAYMENT MODE:</span>
          <span className="uppercase">{bill.payment_method} ({bill.payment_status || 'PAID'})</span>
        </div>
      )}

      {/* Loyalty Points */}
      {f.showLoyaltyPoints && (bill.loyalty_points_earned || bill.loyalty_points) && (
        <div className="bg-black text-white p-1 text-[10px] text-center my-1 font-black uppercase tracking-wider">
          ★ Loyalty Points Earned: +{bill.loyalty_points_earned || bill.loyalty_points || 0} Pts ★
        </div>
      )}

      {/* Savings Banner */}
      {f.showSavingsBanner && rawDiscount > 0 && (
        <div className={`text-center font-black text-[11px] border-[2px] ${dividerBorderClass} border-black py-0.5 my-1.5 uppercase text-black`}>
          ★ YOU SAVED {currency.symbol}{Number(rawDiscount).toFixed(2)} ON THIS ORDER ★
        </div>
      )}

      {/* Payment QR / Verified Paid Status */}
      {f.showPaidInFullStamp && isPaidInFull && (
        <div className="text-center font-black text-[11px] border-[2px] border-black py-1 my-1.5 uppercase text-black">
          ★ [✓ PAID IN FULL] ({bill.payment_method || 'CASH'}) ★
        </div>
      )}
      {shouldPrintPaymentQr && paymentQrSrc && (
        <div className={`flex flex-col items-center justify-center pt-1.5 my-1 border-t ${dividerBorderClass} border-black text-center`}>
          <img
            src={paymentQrSrc}
            alt="UPI QR Code"
            className="w-24 h-24 object-contain border-[2px] border-black p-0.5 my-1"
          />
          <span className="text-[10px] font-black block uppercase tracking-wider text-black">
            {balanceDue > 0 ? `Scan to Pay Balance: ₹${balanceDue.toFixed(2)}` : `Store UPI QR: ₹${targetAmount.toFixed(2)}`}
          </span>
          {resolvedUpiVpa && (
            <span className="text-[9px] font-mono text-black font-black">
              UPI: {resolvedUpiVpa}
            </span>
          )}
        </div>
      )}

      {/* Terms & Conditions Section */}
      {f.showTermsAndConditions && termsText && (
        <div className={`text-[9.5px] font-bold border-t-[1.5px] ${dividerBorderClass} border-black pt-1 mt-1 text-black leading-tight`}>
          <div className="font-black uppercase text-[10px] tracking-wider mb-0.5 text-center">TERMS & CONDITIONS</div>
          <div className="whitespace-pre-line text-left pl-1">{termsText}</div>
        </div>
      )}

      {/* Statutory Declaration */}
      {f.showDeclaration && declarationText && (
        <div className={`text-[9px] font-bold border-t ${dividerBorderClass} border-black pt-1 mt-1 text-center text-black leading-tight`}>
          <span className="font-black">Declaration: </span>{declarationText}
        </div>
      )}

      {/* Thank You Footer Message */}
      {f.showFooterNote && footerText && (
        <div className={`text-[10.5px] font-black border-t-[1.5px] ${dividerBorderClass} border-black pt-1.5 mt-1 text-center whitespace-pre-line leading-tight text-black uppercase tracking-wider`}>
          {footerText}
        </div>
      )}

      {/* Google Review Section Below Thank You Message */}
      {googleReviewEnabled && resolvedGoogleReviewUrl && (
        <div className={`flex flex-col items-center justify-center pt-2 mt-1.5 border-t-[2px] ${dividerBorderClass} border-black text-center`}>
          <div className="flex items-center justify-center gap-1 font-black text-[11px] tracking-widest text-black">
            <span>★ ★ ★ ★ ★</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-black mt-0.5">
            LEAVE US A GOOGLE REVIEW
          </span>
          <img
            src={generateQRCodeSVG(resolvedGoogleReviewUrl, 140)}
            alt="Google Review QR Code"
            className="w-18 h-18 object-contain border-[2px] border-black p-0.5 my-1"
          />
          <span className="text-[9px] font-black block text-black">
            Scan to Share Your Feedback on Google!
          </span>
        </div>
      )}
    </div>,
    document.body
  );
}
