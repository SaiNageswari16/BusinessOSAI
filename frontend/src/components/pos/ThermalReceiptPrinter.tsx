'use client';

import React, { useState, useEffect } from 'react';
import { useI18n } from "@/contexts/i18n-context";
import { createPortal } from 'react-dom';
import {
  getActiveReceiptTemplate,
  getActiveBillingGst,
  getOrgPaymentQrSettings,
  getOrgSignatureSettings,
  getTenantTemplatesKey,
  getTenantDefaultsKey,
  ReceiptTemplate
} from '../../lib/receipt-template-store';
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
  const [, setTick] = useState(0);

  // Re-render in real-time if invoice settings, GST details, payment QR, or signature change
  useEffect(() => {
    const handleUpdate = () => setTick((v) => v + 1);
    if (typeof window !== 'undefined') {
      window.addEventListener('bos-invoice-settings-changed', handleUpdate);
      window.addEventListener('bos-active-gst-changed', handleUpdate);
      window.addEventListener('bos-payment-qr-changed', handleUpdate);
      window.addEventListener('bos-signature-settings-changed', handleUpdate);
      window.addEventListener('bos-receipt-template-changed', handleUpdate);
      return () => {
        window.removeEventListener('bos-invoice-settings-changed', handleUpdate);
        window.removeEventListener('bos-active-gst-changed', handleUpdate);
        window.removeEventListener('bos-payment-qr-changed', handleUpdate);
        window.removeEventListener('bos-signature-settings-changed', handleUpdate);
        window.removeEventListener('bos-receipt-template-changed', handleUpdate);
      };
    }
  }, []);

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
  const fallbackStore = customTemplate || getActiveReceiptTemplate(tenant?.id);
  const sigSettings = getOrgSignatureSettings(tenant?.id);
  const tenantRaw = (tenant as any)?.raw || {};
  
  let activeCompanyTerms = '';
  try {
    const tid = tenant?.id;
    const activeCompanyRaw = tid ? localStorage.getItem(`bos_active_company_${tid}`) : null;
    if (activeCompanyRaw) {
      const parsedComp = JSON.parse(activeCompanyRaw);
      if (parsedComp?.terms_and_conditions) {
        activeCompanyTerms = parsedComp.terms_and_conditions;
      }
    }
  } catch {}

  const tenantAddress = (
    tenantRaw?.address ||
    tenantRaw?.raw?.address ||
    tenantRaw?.settings?.address ||
    [tenantRaw?.raw?.city || tenantRaw?.city, tenantRaw?.raw?.state || tenantRaw?.state, tenantRaw?.raw?.country || tenantRaw?.country, tenantRaw?.raw?.pincode || tenantRaw?.pincode].filter(Boolean).join(', ')
  ).trim();

  const tenantPhone = (tenantRaw?.phone || tenantRaw?.raw?.phone || tenantRaw?.settings?.phone || '').trim();
  const tenantGstin = (tenantRaw?.gst_number || tenantRaw?.gstin || tenantRaw?.raw?.gst_number || tenantRaw?.raw?.gstin || tenantRaw?.settings?.gstin || '').trim();
  const tenantName = (!isGenericBusinessTerm(tenant?.name) ? tenant?.name : '') || (!isGenericBusinessTerm(tenantRaw?.name) ? tenantRaw?.name : '') || '';

  const isDummyAddress = (addr?: string | null): boolean => {
    if (!addr || !addr.trim()) return true;
    const lower = addr.toLowerCase().trim();
    if (lower.includes('kk street') || lower.includes('123 commercial hub') || lower.includes('mandi road, proddatur') || lower.includes('apmc yard') || lower.includes('main market, proddatur') || lower.includes('hospital road, proddatur')) {
      return true;
    }
    if (lower.includes('proddatur') && !tenantAddress.toLowerCase().includes('proddatur') && !activeBillingGst?.address?.toLowerCase().includes('proddatur')) {
      return true;
    }
    return false;
  };

  const isDummyPhone = (ph?: string | null): boolean => {
    if (!ph || !ph.trim()) return true;
    return ph.includes('9849344919') && !tenantPhone.includes('9849344919') && !activeBillingGst?.phone?.includes('9849344919');
  };

  const isDummyGstin = (gst?: string | null): boolean => {
    if (!gst || !gst.trim()) return true;
    return (gst.includes('37AABCCH694G1Z4') || gst.includes('37AAFCOE694G1Z4') || gst.includes('37AAFC16694B1Z4')) &&
           !tenantGstin.includes(gst) &&
           !activeBillingGst?.gstin?.includes(gst);
  };

  const storeName =
    activeBillingGst?.trade_name ||
    activeBillingGst?.legal_name ||
    tenantName ||
    (!isGenericBusinessTerm(invTemplate?.storeName) && !invTemplate?.storeName?.includes('Smart Bazaar') ? invTemplate?.storeName : '') ||
    'Store';

  const branchName = (invTemplate?.branchName && !invTemplate.branchName.toUpperCase().includes('PRODDATUR') ? invTemplate.branchName : '') ||
                     (fallbackStore.branchName && !fallbackStore.branchName.toUpperCase().includes('PRODDATUR') ? fallbackStore.branchName : '');

  const storeAddress =
    (activeBillingGst?.address && !isDummyAddress(activeBillingGst.address) ? activeBillingGst.address : '') ||
    (tenantAddress && !isDummyAddress(tenantAddress) ? tenantAddress : '') ||
    (invTemplate?.storeAddress && !isDummyAddress(invTemplate.storeAddress) ? invTemplate.storeAddress : '') ||
    activeBillingGst?.address ||
    tenantAddress ||
    '';

  const storePhone =
    (activeBillingGst?.phone && !isDummyPhone(activeBillingGst.phone) ? activeBillingGst.phone : '') ||
    (tenantPhone && !isDummyPhone(tenantPhone) ? tenantPhone : '') ||
    (invTemplate?.storePhone && !isDummyPhone(invTemplate.storePhone) ? invTemplate.storePhone : '') ||
    activeBillingGst?.phone ||
    tenantPhone ||
    '';

  const storeEmail = activeBillingGst?.email || invTemplate?.email || fallbackStore.email || '';
  const gstin =
    (activeBillingGst?.gstin && !isDummyGstin(activeBillingGst.gstin) ? activeBillingGst.gstin : '') ||
    (tenantGstin && !isDummyGstin(tenantGstin) ? tenantGstin : '') ||
    (invTemplate?.gstin && !isDummyGstin(invTemplate.gstin) ? invTemplate.gstin : '') ||
    '';

  const cin = activeBillingGst?.cin || invTemplate?.cin || fallbackStore.cin || '';
  const rawHeaderTitle = invTemplate?.headerTitle || fallbackStore.invoiceTitle || 'TAX INVOICE';
  const headerTagline = invTemplate?.headerTagline || fallbackStore.headerTagline || '';
  const footerText = invTemplate?.footerText || fallbackStore.footerNote || '*** THANK YOU FOR SHOPPING ***';
  const declarationText = invTemplate?.declarationText || fallbackStore.declarationText || '';
  const termsText =
    bill?.terms ||
    bill?.terms_and_conditions ||
    activeBillingGst?.terms_and_conditions ||
    activeCompanyTerms ||
    tenantRaw?.terms_and_conditions ||
    tenantRaw?.settings?.terms_and_conditions ||
    invTemplate?.termsAndConditionsText ||
    fallbackStore.termsAndConditionsText ||
    '1. Goods once sold will not be taken back or exchanged.\n2. All disputes are subject to local jurisdiction only.';

  // Logo Resolution per organization
  const rawLogo = activeBillingGst?.logo_url || invTemplate?.logoUrl || tenant?.logo_url || tenantRaw?.logo_url || fallbackStore.logoUrl || '';
  const resolvedLogoUrl = resolveImageUrl(rawLogo);

  // Merge toggles from invTemplate.fields and fallbackStore (ReceiptTemplate)
  const f = {
    // Theme Settings
    showPartyBalance: invTemplate?.fields?.showPartyBalance ?? fallbackStore.showPartyBalance ?? true,
    showItemDescription: invTemplate?.fields?.showItemDescription ?? fallbackStore.showItemDescription ?? true,
    showTime: invTemplate?.fields?.showTime ?? fallbackStore.showTime ?? true,

    // Header
    showLogo: invTemplate?.fields?.showLogo ?? fallbackStore.showLogo ?? true,
    showStoreName: invTemplate?.fields?.showStoreName ?? fallbackStore.showStoreName ?? true,
    showBranchName: invTemplate?.fields?.showBranchName ?? fallbackStore.showBranchName ?? false,
    showStoreAddress: invTemplate?.fields?.showStoreAddress ?? fallbackStore.showStoreAddress ?? true,
    showStoreContact: invTemplate?.fields?.showStoreContact ?? fallbackStore.showStoreContact ?? true,
    showTaxId: invTemplate?.fields?.showTaxId ?? fallbackStore.showTaxId ?? true,
    showCin: invTemplate?.fields?.showCin ?? fallbackStore.showCin ?? false,
    showInvoiceTitle: invTemplate?.fields?.showInvoiceTitle ?? fallbackStore.showInvoiceTitle ?? true,
    showTagline: invTemplate?.fields?.showTagline ?? fallbackStore.showTagline ?? false,
    showCashier: invTemplate?.fields?.showCashier ?? fallbackStore.showCashier ?? true,

    // Invoice Details
    showInvoiceNumber: invTemplate?.fields?.showInvoiceNumber ?? fallbackStore.showInvoiceNumber ?? true,
    showInvoiceDate: invTemplate?.fields?.showInvoiceDate ?? fallbackStore.showInvoiceDate ?? true,
    showPoNumber: invTemplate?.fields?.showPoNumber ?? fallbackStore.showPoNumber ?? false,
    showVehicleNumber: invTemplate?.fields?.showVehicleNumber ?? fallbackStore.showVehicleNumber ?? false,
    showEwayBill: invTemplate?.fields?.showEwayBill ?? fallbackStore.showEwayBill ?? false,
    showChallanNumber: invTemplate?.fields?.showChallanNumber ?? fallbackStore.showChallanNumber ?? false,
    showDueDate: invTemplate?.fields?.showDueDate ?? fallbackStore.showDueDate ?? false,
    showPaymentMethod: invTemplate?.fields?.showPaymentMethod ?? fallbackStore.showPaymentMethod ?? true,

    // Party Details
    showCustomerDetails: invTemplate?.fields?.showCustomerDetails ?? fallbackStore.showCustomerDetails ?? true,
    showCustomerAddress: invTemplate?.fields?.showCustomerAddress ?? fallbackStore.showCustomerAddress ?? true,
    showCustomerPhone: invTemplate?.fields?.showCustomerPhone ?? fallbackStore.showCustomerPhone ?? true,
    showCustomerGstin: invTemplate?.fields?.showCustomerGstin ?? fallbackStore.showCustomerGstin ?? true,
    showCustomerPan: invTemplate?.fields?.showCustomerPan ?? fallbackStore.showCustomerPan ?? false,
    showPlaceOfSupply: invTemplate?.fields?.showPlaceOfSupply ?? fallbackStore.showPlaceOfSupply ?? true,
    showShippingAddress: invTemplate?.fields?.showShippingAddress ?? fallbackStore.showShippingAddress ?? true,

    // Item Table
    showItemIndex: invTemplate?.fields?.showItemIndex ?? fallbackStore.showItemIndex ?? true,
    showItemName: invTemplate?.fields?.showItemName ?? fallbackStore.showItemName ?? true,
    showItemHSN: invTemplate?.fields?.showItemHSN ?? invTemplate?.fields?.showHSN ?? fallbackStore.showItemHSN ?? true,
    showItemSKU: invTemplate?.fields?.showItemSKU ?? invTemplate?.fields?.showSKU ?? fallbackStore.showItemSKU ?? false,
    showItemQty: invTemplate?.fields?.showItemQty ?? fallbackStore.showItemQty ?? true,
    showItemUom: invTemplate?.fields?.showItemUom ?? fallbackStore.showItemUom ?? true,
    showItemRate: invTemplate?.fields?.showItemRate ?? fallbackStore.showItemRate ?? true,
    showItemMrp: invTemplate?.fields?.showItemMrp ?? fallbackStore.showItemMrp ?? true,
    showItemBatch: invTemplate?.fields?.showItemBatch ?? fallbackStore.showItemBatch ?? true,
    showItemExpiry: invTemplate?.fields?.showItemExpiry ?? fallbackStore.showItemExpiry ?? true,
    showItemMfg: invTemplate?.fields?.showItemMfg ?? fallbackStore.showItemMfg ?? true,
    showItemDiscount: invTemplate?.fields?.showItemDiscount ?? fallbackStore.showItemDiscount ?? true,
    showItemTax: invTemplate?.fields?.showItemTax ?? fallbackStore.showItemTax ?? true,
    showItemTotal: invTemplate?.fields?.showItemTotal ?? fallbackStore.showItemTotal ?? true,

    // Totals & Footer
    showSubtotal: invTemplate?.fields?.showSubtotal ?? fallbackStore.showSubtotal ?? true,
    showOverallQty: invTemplate?.fields?.showOverallQty ?? fallbackStore.showOverallQty ?? true,
    showTotalDiscount: invTemplate?.fields?.showTotalDiscount ?? fallbackStore.showTotalDiscount ?? true,
    showYouSaved: invTemplate?.fields?.showYouSaved ?? fallbackStore.showYouSaved ?? true,
    showSavingsBanner: invTemplate?.fields?.showSavingsBanner ?? fallbackStore.showSavingsBanner ?? true,
    showTaxBreakdown: invTemplate?.fields?.showTaxBreakdown ?? invTemplate?.fields?.showTaxSplit ?? fallbackStore.showTaxBreakdown ?? true,
    showRoundOff: invTemplate?.fields?.showRoundOff ?? fallbackStore.showRoundOff ?? true,
    showGrandTotal: invTemplate?.fields?.showGrandTotal ?? fallbackStore.showGrandTotal ?? true,
    showReceivedAndBalance: invTemplate?.fields?.showReceivedAndBalance ?? fallbackStore.showReceivedAndBalance ?? true,
    showAmountInWords: invTemplate?.fields?.showAmountInWords ?? fallbackStore.showAmountInWords ?? false,
    showLoyaltyPoints: invTemplate?.fields?.showLoyaltyPoints ?? fallbackStore.showLoyaltyPoints ?? false,
    showPaymentMode: invTemplate?.fields?.showPaymentMode ?? fallbackStore.showPaymentMode ?? true,
    showPaidInFullStamp: invTemplate?.fields?.showPaidInFullStamp ?? fallbackStore.showPaidInFullStamp ?? false,
    showQrCode: invTemplate?.fields?.showQrCode ?? invTemplate?.fields?.showPaymentQR ?? fallbackStore.showQrCode ?? false,
    showGoogleReviewQR: invTemplate?.fields?.showGoogleReviewQR ?? fallbackStore.showGoogleReviewQR ?? false,
    showTermsAndConditions: invTemplate?.fields?.showTermsAndConditions ?? fallbackStore.showTermsAndConditions ?? true,
    showDeclaration: invTemplate?.fields?.showDeclaration ?? fallbackStore.showDeclaration ?? true,
    showFooterNote: invTemplate?.fields?.showFooterNote ?? fallbackStore.showFooterNote ?? true,
    showSignature: invTemplate?.fields?.showSignature ?? fallbackStore.showSignature ?? false,
    showStamp: invTemplate?.fields?.showStamp ?? fallbackStore.showStamp ?? false,
  };

  // Google Review Resolution per organization
  const rawGoogleReviewUrl = activeBillingGst?.google_review_url || invTemplate?.googleReviewUrl || fallbackStore.googleReviewUrl || '';
  const googlePlaceId = activeBillingGst?.google_place_id || '';
  const resolvedGoogleReviewUrl = rawGoogleReviewUrl || (googlePlaceId ? `https://search.google.com/local/writereview?placeid=${googlePlaceId}` : '');
  const googleReviewEnabled = (activeBillingGst?.google_review_enabled !== false) && (f.showGoogleReviewQR !== false) && Boolean(resolvedGoogleReviewUrl);

  const invoiceNum = bill.invoice_number || bill.id || bill.rawId?.substring(0, 8) || 'AABBCCDD/202';
  const dateStr = formatDisplayDate(bill.date || new Date());
  const timeStr = bill.date ? new Date(bill.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const customerName = bill.customerName || bill.customer?.name || 'Walk-in Customer';
  const customerPhone = bill.customerPhone || bill.customer?.phone || '';
  const customerAddress = bill.customerBillingAddress || bill.customerAddress || bill.customer?.address || '';
  const customerGstin = bill.customerGstin || bill.customer?.gstin || '';
  const customerPan = bill.customerPan || bill.customer?.pan || '';
  const placeOfSupply = bill.place_of_supply || bill.state || fallbackStore.placeOfSupply || activeBillingGst?.state_name || 'Andhra Pradesh';
  const shippingAddress = bill.customerShippingAddress || bill.shipping_address || fallbackStore.shippingAddress || '';
  const cashierName = bill.cashier_name || bill.cashier || bill.created_by_name || 'Admin';

  const items = bill.items || [];
  const rawSubtotal = Number(bill.subtotal ?? items.reduce((sum: number, i: any) => sum + ((Number(i.quantity || 1)) * Number(i.unit_price || i.price || 0)), 0));
  const totalOverallQty = items.reduce((sum: number, i: any) => sum + Number(i.quantity || 1), 0);
  const rawDiscount = Number(bill.discount || bill.discount_amount || 0);
  
  const itemsTaxTotal = items.reduce((acc: number, item: any) => acc + Number(item.tax_amount || item.tax || 0), 0);
  const explicitTax = bill.tax != null ? Number(bill.tax) : (bill.tax_amount != null ? Number(bill.tax_amount) : (bill.total_tax != null ? Number(bill.total_tax) : null));
  const rawTax = explicitTax !== null ? explicitTax : itemsTaxTotal;
  const hasGst = rawTax > 0.001 || Boolean(bill.cgst_amount > 0 || bill.sgst_amount > 0 || bill.igst_amount > 0);

  const isInterstate = Boolean(bill.gst_type === 'igst' || bill.is_interstate || (bill.igst_amount && Number(bill.igst_amount) > 0));
  const cgst = Number(bill.cgst_amount ?? (isInterstate ? 0 : rawTax / 2));
  const sgst = Number(bill.sgst_amount ?? (isInterstate ? 0 : rawTax / 2));
  const igst = Number(bill.igst_amount ?? (isInterstate ? rawTax : 0));

  const roundOff = Number(bill.round_off || bill.roundoff || 0);
  const grandTotal = Number(bill.total || bill.grand_total || (rawSubtotal - rawDiscount + (hasGst ? rawTax : 0) + roundOff));
  const partyBalanceVal = bill.party_balance ?? bill.customer?.balance ?? fallbackStore.partyBalance ?? 0;

  const headerTitle = hasGst ? rawHeaderTitle : (rawHeaderTitle === 'TAX INVOICE' ? 'BILL OF SUPPLY' : rawHeaderTitle);

  const is58mm = invTemplate?.paperSize === '58mm' || fallbackStore.paperSize === '58mm';
  const printableWidth = is58mm ? '48mm' : '72mm';

  // Typography & Density style resolution
  const printClarity = fallbackStore.printClarity || 'ultra_dark';
  const fontFamilyChoice = fallbackStore.fontFamily || 'monospace';
  const dividerStyle = fallbackStore.dividerStyle || 'solid';

  const fontFam = fontFamilyChoice === 'monospace'
    ? '"Consolas", "Courier New", Courier, monospace'
    : fontFamilyChoice === 'clean'
    ? '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

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
      className="hidden print:block bg-white text-black p-1 text-[11.5px] font-black leading-snug select-none print:static print:visible pointer-events-none print:pointer-events-auto"
      style={{
        width: printableWidth,
        maxWidth: printableWidth,
        margin: '0 auto',
        padding: '1.5mm 1.5mm 22mm 1.5mm',
        fontFamily: fontFam,
        color: '#000000',
        fontWeight: 900,
        textShadow: '0 0 0.25px #000000',
        WebkitFontSmoothing: 'antialiased',
        WebkitTextStroke: printClarity === 'ultra_dark' ? '0.35px #000000' : '0.2px #000000',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        textRendering: 'geometricPrecision',
      }}
    >
      <style>{`
        @media print {
          @page {
            size: ${is58mm ? '58mm' : '80mm'} auto;
            margin: 0mm !important;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #printable-receipt-portal {
            display: block !important;
            visibility: visible !important;
            position: static !important;
            width: ${printableWidth} !important;
            max-width: ${printableWidth} !important;
            margin: 0 auto !important;
            padding: 1.5mm 1.5mm 22mm 1.5mm !important;
            color: #000000 !important;
            background: #ffffff !important;
            font-weight: 900 !important;
            -webkit-font-smoothing: antialiased !important;
            -webkit-text-stroke: ${printClarity === 'ultra_dark' ? '0.35px #000000' : '0.2px #000000'} !important;
            text-shadow: 0 0 0.25px #000000 !important;
            text-rendering: geometricPrecision !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #printable-receipt-portal * {
            color: #000000 !important;
            border-color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #printable-receipt-portal img,
          #printable-receipt-portal svg {
            image-rendering: pixelated !important;
            image-rendering: -moz-crisp-edges !important;
            image-rendering: crisp-edges !important;
            shape-rendering: crispEdges !important;
            filter: grayscale(100%) contrast(300%) !important;
          }
          #printable-receipt-portal .bg-black {
            background-color: #000000 !important;
            color: #ffffff !important;
          }
          #printable-receipt-portal .bg-black * {
            color: #ffffff !important;
          }
        }
      `}</style>
      {/* Header */}
      <div className={`text-center border-b-[1.5px] ${dividerBorderClass} border-black pb-1.5`}>
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
          <p className="text-[10px] font-bold text-black mt-0.5">{branchName}</p>
        )}
        {f.showTagline && headerTagline && (
          <p className="text-[9.5px] font-semibold italic text-black mt-0.5">{headerTagline}</p>
        )}
        {f.showStoreAddress && storeAddress && (
          <p className="text-[10.5px] font-bold mt-0.5 whitespace-pre-line text-black leading-tight">{storeAddress}</p>
        )}
        {f.showStoreContact && storePhone && (
          <p className="text-[10.5px] font-black text-black mt-0.5">Phone No : {storePhone}</p>
        )}
        {f.showTaxId && gstin && (
          <p className="text-[11px] font-black mt-0.5 text-black">GST : {gstin}</p>
        )}
        {f.showCin && cin && (
          <p className="text-[9.5px] font-bold text-black">CIN : {cin}</p>
        )}
        {f.showInvoiceTitle && (
          <div className="font-black text-center mt-1.5 text-[12px] uppercase tracking-wider text-black">
            {headerTitle}
          </div>
        )}
      </div>

      {/* Transaction & Party Meta */}
      <div className={`text-[10.5px] font-bold border-b-[1.5px] ${dividerBorderClass} border-black py-1 space-y-0.5 text-black leading-tight`}>
        {f.showInvoiceNumber && (
          <div className="flex justify-between">
            <span className="font-black">Invoice No : {invoiceNum}</span>
            {f.showInvoiceDate && <span>Date : {dateStr}</span>}
          </div>
        )}
        <div className="flex justify-between">
          {f.showTime && <span>Time : {timeStr}</span>}
          {f.showCashier && <span>Cashier : {cashierName}</span>}
        </div>
        {f.showCustomerDetails && (
          <div className="space-y-0.5 pt-0.5">
            <div><span className="font-bold">Bill To :</span> <span className="font-black">{customerName}</span></div>
            {f.showCustomerPhone && customerPhone && (
              <div>Ph : {customerPhone}</div>
            )}
            {f.showCustomerAddress && customerAddress && (
              <div className="whitespace-pre-line">{customerAddress}</div>
            )}
            {f.showCustomerGstin && customerGstin && (
              <div>GSTIN : {customerGstin}</div>
            )}
            {f.showPlaceOfSupply && placeOfSupply && (
              <div>Place of Supply : {placeOfSupply}</div>
            )}
            {f.showShippingAddress && shippingAddress && (
              <div className="mt-0.5 pt-0.5 border-t border-dotted border-black">
                <span className="font-bold">Ship To : </span>
                <span className="whitespace-pre-line font-bold">{shippingAddress}</span>
              </div>
            )}
            {f.showPoNumber && bill.po_number && <div>PO Ref : {bill.po_number}</div>}
            {f.showVehicleNumber && bill.vehicle_number && <div>Vehicle : {bill.vehicle_number}</div>}
            {f.showEwayBill && bill.eway_bill_number && <div className="font-black">e-Way Bill : {bill.eway_bill_number}</div>}
            {f.showChallanNumber && (bill.challan_number || bill.delivery_challan_number) && (
              <div>Challan No : {bill.challan_number || bill.delivery_challan_number}</div>
            )}
            {/* Custom Header Fields */}
            {(fallbackStore?.customFields || invTemplate?.customFields || [])
              .filter((cf: any) => cf.enabled && (cf.value || (bill.custom_fields && bill.custom_fields[cf.id]) || (bill.custom_fields && bill.custom_fields[cf.name])))
              .map((cf: any) => {
                const val = (bill.custom_fields && (bill.custom_fields[cf.id] || bill.custom_fields[cf.name])) || cf.value;
                return (
                  <div key={cf.id || cf.name}>
                    <span className="font-bold">{cf.name} : </span>
                    <span>{val}</span>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Item Table */}
      <div className="my-1">
        <div className={`flex justify-between text-[11px] font-black border-y-[1.5px] ${dividerBorderClass} border-black py-0.5`}>
          <div className="flex items-center gap-1.5">
            {f.showItemIndex && <span className="w-4 text-left">#</span>}
            <span className="text-left">Item</span>
          </div>
          <div className="flex items-center gap-2">
            {f.showItemQty && <span className="w-10 text-center">Qty</span>}
            {f.showItemRate && <span className="w-12 text-right">Rate</span>}
            {f.showItemTotal && <span className="w-14 text-right">Amt</span>}
          </div>
        </div>

        <div className={`divide-y ${dividerBorderClass} divide-black/40`}>
          {items.map((item: any, idx: number) => {
            const name = item.name || item.product_name || `Item ${idx + 1}`;
            const qty = item.quantity || 1;
            const rate = item.unit_price || item.price || (qty > 0 ? (item.subtotal || 0) / qty : 0);
            const mrp = item.mrp || item.standard_price || 0;
            const discount = item.discount || item.item_discount || 0;
            const taxAmt = item.tax_amount || item.tax || 0;
            const taxRate = item.tax_rate || item.gst_rate || 0;
            const lineAmt = item.subtotal || (qty * rate) - (discount || 0);

            // Sub-line metadata chips
            const metaChips: string[] = [];
            if (f.showItemMrp && mrp > 0 && mrp !== rate) metaChips.push(`MRP: ${Number(mrp).toFixed(0)}`);
            if (f.showItemSKU && (item.sku || item.item_code || item.barcode)) metaChips.push(`SKU: ${item.sku || item.item_code || item.barcode}`);
            if (f.showItemHSN && item.hsn_code) metaChips.push(`HSN: ${item.hsn_code}`);
            if (f.showItemDiscount && discount > 0) {
              const discPct = item.discount_percentage || (mrp > 0 ? ((discount / (mrp * qty)) * 100).toFixed(0) : 0);
              metaChips.push(`Disc: ${discPct > 0 ? `${discPct}%` : `₹${Number(discount).toFixed(2)}`}`);
            }
            if (f.showItemTax && hasGst && (taxRate > 0 || taxAmt > 0)) {
              metaChips.push(`GST: ${taxRate > 0 ? `${taxRate}%` : `₹${Number(taxAmt).toFixed(2)}`}`);
            }
            if (f.showItemBatch && item.batch_no) metaChips.push(`Batch: ${item.batch_no}`);
            if (f.showItemMfg && (item.mfg_date || item.mfg)) metaChips.push(`Mfg: ${item.mfg_date || item.mfg}`);
            if (f.showItemExpiry && (item.exp_date || item.expiry || item.expiry_date)) metaChips.push(`Exp: ${item.exp_date || item.expiry || item.expiry_date}`);
            if (item.serial_no || item.imei) metaChips.push(`SN: ${item.serial_no || item.imei}`);
            if (item.warranty || item.warranty_period) metaChips.push(`Warranty: ${item.warranty || item.warranty_period}`);

            // Custom Item Columns
            const customCols = fallbackStore?.customItemColumns || invTemplate?.customItemColumns || [];
            customCols.filter((cc: any) => cc.enabled).forEach((cc: any) => {
              const val = (item.custom_columns && item.custom_columns[cc.id]) || (item.custom_columns && item.custom_columns[cc.name]) || item[cc.name] || item[cc.id];
              if (val) metaChips.push(`${cc.name}: ${val}`);
            });

            return (
              <div key={idx} className="py-1 text-black">
                {/* Line 1: Index, Name, Qty, Rate, Amount */}
                <div className="flex justify-between items-start text-[11px] font-black leading-tight">
                  <div className="flex items-start gap-1.5 flex-1 pr-1">
                    {f.showItemIndex && <span className="w-4 text-left flex-shrink-0">{idx + 1}</span>}
                    <span className="break-words">{name}</span>
                  </div>
                  <div className="flex items-start gap-2 flex-shrink-0">
                    {f.showItemQty && (
                      <span className="w-10 text-center">
                        {qty} {f.showItemUom ? (item.selected_uom || item.uom || item.measuring_unit || 'Pcs') : ''}
                      </span>
                    )}
                    {f.showItemRate && (
                      <span className="w-12 text-right">
                        {Number(rate || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    )}
                    {f.showItemTotal && (
                      <span className="w-14 text-right">
                        {Number(lineAmt || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Line 2: Description */}
                {f.showItemDescription && (item.description || item.custom_note || item.notes) && (
                  <div className="text-[9.5px] font-bold text-black italic pl-5.5 leading-none mt-0.5">
                    Desc: {item.description || item.custom_note || item.notes}
                  </div>
                )}

                {/* Line 3: Meta details */}
                {metaChips.length > 0 && (
                  <div className="text-[9px] font-bold text-black pl-5.5 leading-tight mt-0.5">
                    {metaChips.join(', ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sub Total with overall Qty alignment */}
        {f.showSubtotal && (
          <div className={`flex justify-between items-center text-[11px] font-black border-y-[1.5px] ${dividerBorderClass} border-black py-0.5 mt-1`}>
            <div className="flex items-center gap-1.5 flex-1">
              {f.showItemIndex && <span className="w-4" />}
              <span>Sub Total</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {f.showOverallQty && (
                <span className="w-10 text-center">{totalOverallQty}</span>
              )}
              {f.showItemRate && <span className="w-12" />}
              <span className="w-14 text-right">₹ {Number(rawSubtotal || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        )}
      </div>

      {/* Totals & Calculations */}
      <div className="space-y-0.5 text-[11px] font-bold text-black">
        {/* Tax Breakdown - Only rendered if GST is actually present on the bill */}
        {hasGst && f.showTaxBreakdown && (
          <div className="space-y-0.5 pb-1 border-t border-dotted border-black pt-1 mt-0.5">
            <div className="flex justify-between">
              <span>Taxable Amount</span>
              <span className="font-bold">₹ {Number(rawSubtotal - rawDiscount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            {isInterstate ? (
              <div className="flex justify-between">
                <span>IGST Tax</span>
                <span>₹ {Number(igst).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between">
                  <span>CGST</span>
                  <span>₹ {Number(cgst).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>SGST</span>
                  <span>₹ {Number(sgst).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </>
            )}
            <div className="flex justify-between font-black">
              <span>Total Tax (GST)</span>
              <span>₹ {Number(rawTax).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        )}

        {/* Grand Total */}
        {f.showGrandTotal && (
          <div className={`flex justify-between font-black text-[14px] border-t-[1.5px] ${dividerBorderClass} border-black pt-1 mt-0.5 text-black`}>
            <span>TOTAL AMOUNT:</span>
            <span>₹{Number(grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        )}

        {/* Total Billed Quantity */}
        <div className="flex justify-between text-[11px] font-black text-black">
          <span>Total Billed Qty:</span>
          <span>{totalOverallQty} {totalOverallQty === 1 ? 'Unit' : 'Units'}</span>
        </div>

        {/* You Saved */}
        {f.showYouSaved && rawDiscount > 0 && (
          <div className="flex justify-between text-[11px] font-black text-black">
            <span>You Saved:</span>
            <span>- ₹{Number(rawDiscount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        )}

        {/* Received & Balance Amount */}
        {f.showReceivedAndBalance && (
          <>
            <div className="flex justify-between text-[11px] font-bold text-black">
              <span>Received:</span>
              <span>₹{Number(amountReceived || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-[11px] font-black text-black">
              <span>Balance Amount:</span>
              <span>₹{Number(balanceDue).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</span>
            </div>
          </>
        )}

        {/* Party Balance */}
        {f.showPartyBalance && (
          <div className="flex justify-between text-[11px] font-black text-black pt-0.5">
            <span>Party Balance:</span>
            <span>₹{Number(partyBalanceVal).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
          </div>
        )}
      </div>

      {/* Payment Mode */}
      {f.showPaymentMode && (
        <div className={`flex justify-between text-[10.5px] font-black mt-1 border-t ${dividerBorderClass} border-black pt-0.5 text-black`}>
          <span>PAYMENT MODE:</span>
          <span className="uppercase">{bill.payment_method || 'Cash'} ({bill.payment_status || (isPaidInFull ? 'PAID' : 'PENDING')})</span>
        </div>
      )}

      {/* Paid in Full Banner */}
      {isPaidInFull && (
        <div className="text-center font-black text-[11px] uppercase tracking-wide py-0.5 my-0.5 text-black">
          ★ [✓ PAID IN FULL] ({bill.payment_method || 'Cash'}) ★
        </div>
      )}

      {/* Loyalty Points */}
      {f.showLoyaltyPoints && (bill.loyalty_points_earned || bill.loyalty_points) && (
        <div className="bg-black text-white p-1 text-[9.5px] text-center my-1 font-black uppercase tracking-wider">
          ★ Loyalty Points Earned: +{bill.loyalty_points_earned || bill.loyalty_points || 0} Pts ★
        </div>
      )}

      {/* Savings Banner */}
      {f.showSavingsBanner && rawDiscount > 0 && (
        <div className={`text-center font-black text-[10.5px] border-[1.5px] ${dividerBorderClass} border-black py-0.5 my-1 uppercase text-black`}>
          ★ YOU SAVED ₹{Number(rawDiscount).toFixed(2)} ON THIS ORDER ★
        </div>
      )}

      {/* Payment QR */}
      {shouldPrintPaymentQr && paymentQrSrc && (
        <div className={`flex flex-col items-center justify-center pt-1.5 my-1 border-t ${dividerBorderClass} border-black text-center`}>
          <img
            src={paymentQrSrc}
            alt="UPI QR Code"
            className="w-22 h-22 object-contain border-[2px] border-black p-0.5 my-0.5"
          />
          <span className="text-[9.5px] font-black block uppercase tracking-wider text-black">
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
          <div className="font-black uppercase text-[9.5px] tracking-wider mb-0.5">TERMS & CONDITIONS</div>
          <div className="whitespace-pre-line text-left">{termsText}</div>
        </div>
      )}

      {/* Authorized Signature & Digital Stamp */}
      {(sigSettings.showDigitalSignature || sigSettings.showDigitalStamp || sigSettings.signatureTitle || f.showSignature) && (
        <div className={`pt-2 mt-1 border-t ${dividerBorderClass} border-black text-right`}>
          {sigSettings.signatureCompanyName && (
            <div className="text-[9.5px] font-black text-black uppercase mb-0.5">
              {sigSettings.signatureCompanyName}
            </div>
          )}
          <div className="flex items-center justify-end gap-2 my-0.5">
            {sigSettings.showDigitalStamp && sigSettings.stampUrl && (
              <img
                src={resolveImageUrl(sigSettings.stampUrl)}
                alt="Stamp"
                className="max-h-10 max-w-[50px] object-contain filter grayscale contrast-200"
              />
            )}
            {sigSettings.showDigitalSignature && sigSettings.signatureUrl ? (
              <img
                src={resolveImageUrl(sigSettings.signatureUrl)}
                alt="Signature"
                className="max-h-8 max-w-[80px] object-contain filter grayscale contrast-200"
              />
            ) : (
              <div className="h-5 border-b border-dashed border-black w-20 mb-0.5 inline-block" />
            )}
          </div>
          <div className="text-[9.5px] font-black text-black uppercase tracking-wider">
            {sigSettings.signatureTitle || "Authorized Signatory"}
          </div>
        </div>
      )}

      {/* Statutory Declaration */}
      {f.showDeclaration && declarationText && (
        <div className={`text-[8.5px] font-bold border-t ${dividerBorderClass} border-black pt-1 mt-0.5 text-center text-black leading-tight`}>
          <span className="font-black">Declaration: </span>{declarationText}
        </div>
      )}

      {/* Thank You Footer Message */}
      {f.showFooterNote && footerText && (
        <div className={`text-[10px] font-black border-t-[1.5px] ${dividerBorderClass} border-black pt-1 mt-1 text-center whitespace-pre-line leading-tight text-black uppercase tracking-wider`}>
          {footerText}
        </div>
      )}

      {/* Google Review Section Below Thank You Message */}
      {googleReviewEnabled && resolvedGoogleReviewUrl && (
        <div className={`flex flex-col items-center justify-center pt-1.5 mt-1 border-t-[1.5px] ${dividerBorderClass} border-black text-center`}>
          <div className="flex items-center justify-center gap-1 font-black text-[10px] tracking-widest text-black">
            <span>★ ★ ★ ★ ★</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-black mt-0.5">
            LEAVE US A GOOGLE REVIEW
          </span>
          <img
            src={generateQRCodeSVG(resolvedGoogleReviewUrl, 140)}
            alt="Google Review QR Code"
            className="w-20 h-20 object-contain border-[2px] border-black p-0.5 my-1"
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
