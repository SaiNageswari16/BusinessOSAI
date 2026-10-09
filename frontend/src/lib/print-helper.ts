import {
  getActiveReceiptTemplate,
  getActiveBillingGst,
  getOrgPaymentQrSettings,
  getTenantTemplatesKey,
  getTenantDefaultsKey,
  getResolvedActiveThermalTemplate,
} from './receipt-template-store';
import { generateQRCodeSVG, buildUpiPayUrl } from './qr-generator';
import { resolveImageUrl } from './api-client';
import { formatDisplayDate } from './utils';

/**
 * Generate full thermal receipt HTML string from an invoice object and active saved template.
 * Matches 100% with the designer live preview engine in PrintTemplates.tsx.
 */
export function generateThermalReceiptHtml(inv: any, templateOverride?: any, tenantId?: string): string {
  const tid = tenantId || (typeof window !== 'undefined' ? localStorage.getItem('bos_selected_tenant_id') || '' : '');
  const activeGst = getActiveBillingGst(tid);

  let activeTemplate: any = templateOverride;
  if (!activeTemplate || Object.keys(activeTemplate).length <= 1) {
    activeTemplate = getResolvedActiveThermalTemplate(tid) || getActiveReceiptTemplate(tid);
  }

  const f = activeTemplate?.fields || {};
  const is58mm = (templateOverride?.paperSize || activeTemplate?.paperSize) === '58mm';
  const printableWidth = is58mm ? '48mm' : '72mm';
  const clarity = activeTemplate?.printClarity || 'ultra_dark';
  const fontFamilyChoice = activeTemplate?.thermalFontFamily || activeTemplate?.fontFamily || 'monospace';
  const dividerStyle = activeTemplate?.dividerStyle || 'double';

  const fontFam =
    fontFamilyChoice === 'sans-serif'
      ? "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      : fontFamilyChoice === 'terminal'
      ? "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
      : fontFamilyChoice === 'courier'
      ? "'Courier New', Courier, monospace"
      : "'Courier New', Courier, monospace";

  const dividerChar =
    dividerStyle === 'solid'
      ? '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      : dividerStyle === 'double'
      ? '══════════════════════════════'
      : dividerStyle === 'dotted'
      ? '······························'
      : dividerStyle === 'star'
      ? '******************************'
      : '------------------------------';

  // Resolved store details matching PrintTemplates.tsx
  const storeName =
    (activeTemplate?.storeName && activeTemplate.storeName.trim() !== '' && !activeTemplate.storeName.includes('Organization') && !activeTemplate.storeName.includes('Smart Bazaar') ? activeTemplate.storeName : '') ||
    activeGst?.trade_name ||
    activeGst?.legal_name ||
    (typeof window !== 'undefined' ? (JSON.parse(localStorage.getItem('bos-tenant') || '{}')?.name) : '') ||
    'BusinessOS Store';

  const branchName = activeTemplate?.branchName || 'MAIN BRANCH, PRODDATUR';
  const tagline = activeTemplate?.customTaglineText || activeTemplate?.headerTagline || '';
  
  const storeAddress =
    (activeTemplate?.storeAddress && activeTemplate.storeAddress.trim() !== '' && !activeTemplate.storeAddress.includes('123 Commercial Hub') ? activeTemplate.storeAddress : '') ||
    activeGst?.address ||
    'KK Street, Proddatur, YSR Cuddapah, Andhra Pradesh, 516360';

  const storePhone =
    (activeTemplate?.storePhone && activeTemplate.storePhone.trim() !== '' ? activeTemplate.storePhone : '') ||
    activeGst?.phone ||
    '+91 9849344919';

  const storeGstin =
    (activeTemplate?.gstin && activeTemplate.gstin.trim() !== '' ? activeTemplate.gstin : '') ||
    activeGst?.gstin ||
    '37AABCCH694G1Z4';

  const rawLogo =
    activeTemplate?.logoUrl ||
    activeGst?.logo_url ||
    (typeof window !== 'undefined'
      ? (() => {
          try {
            const rawTenant = localStorage.getItem('bos-tenant');
            if (rawTenant) {
              const parsed = JSON.parse(rawTenant);
              return parsed?.logo_url || parsed?.raw?.logo_url;
            }
          } catch {}
          return '';
        })()
      : '') ||
    '/Logo.png';

  const resolvedLogoUrl = rawLogo ? resolveImageUrl(rawLogo) : (typeof window !== 'undefined' ? `${window.location.origin}/Logo.png` : '/Logo.png');

  const isSamplePreview = !inv || (!inv.id && !inv.invoice_number && !inv.receipt_number && (!Array.isArray(inv.items) || inv.items.length === 0));

  // Invoice & Cashier details
  const invoiceNum = inv?.invoice_number || inv?.receipt_number || inv?.id || (isSamplePreview ? 'POS-2026-0042' : 'INV-0001');
  const invoiceDate = inv?.invoice_date || (inv?.created_at ? formatDisplayDate(inv.created_at) : formatDisplayDate(new Date().toISOString()));
  const invoiceTime = inv?.invoice_time || (inv?.created_at ? new Date(inv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const cashierRep = inv?.sales_executive || inv?.sales_rep_name || (inv as any)?.salesperson_name || inv?.cashier_name || (isSamplePreview ? 'Main Terminal' : 'Platform Staff');

  // Customer details
  const customerName = inv?.customer_name || inv?.customer?.name || (isSamplePreview ? 'Walk-in Retail Customer' : 'Walk-in Customer');
  const customerPhone = inv?.customer_phone || inv?.customer?.phone || (isSamplePreview ? '+91 9876543210' : '');
  const customerGstin = inv?.customer_gstin || inv?.customer?.gst_number || inv?.customer?.tax_number || (isSamplePreview ? '37AAFCOE694G1Z4' : '');
  const customerAddress = inv?.customer_billing_address || inv?.customer_address || inv?.customer?.address || (isSamplePreview ? 'Proddatur, AP' : '');

  // Meta fields (PO, E-Way Bill, Vehicle, Challan)
  const poNumber = inv?.po_number || inv?.purchase_order_number || (isSamplePreview ? 'PO-89211' : '');
  const ewayBill = inv?.eway_bill_number || inv?.eway_bill || (isSamplePreview ? '2418-9201-9920' : '');
  const vehicleNumber = inv?.vehicle_number || inv?.vehicle_no || (isSamplePreview ? 'AP-04-TX-4412' : '');
  const challanNumber = inv?.challan_number || inv?.delivery_challan_number || (isSamplePreview ? 'DC-2026-092' : '');

  const hasAnyMetaField =
    (activeTemplate?.showPoNumber !== false && Boolean(poNumber)) ||
    (activeTemplate?.showEwayBill !== false && Boolean(ewayBill)) ||
    (activeTemplate?.showVehicleNumber !== false && Boolean(vehicleNumber)) ||
    (activeTemplate?.showChallanNumber !== false && Boolean(challanNumber));

  // Items
  const rawItems = (Array.isArray(inv?.items) && inv.items.length > 0)
    ? inv.items
    : (isSamplePreview ? [
        { product_name: 'Basmati Rice 5kg', description: 'Premium Long Grain Aged Rice', quantity: 1, unit: 'Pkg', unit_price: 480, mrp: 550, hsn_code: '1006', batch_number: 'BR-992', expiry_date: '12/2027' },
        { product_name: 'Sunflower Oil 1L', quantity: 2, unit: 'Pcs', unit_price: 145, mrp: 170, hsn_code: '1512', batch_number: 'SF-201', expiry_date: '12/2027' },
        { product_name: 'Parle-G Biscuit', quantity: 4, unit: 'Pcs', unit_price: 25, mrp: 25, hsn_code: '1905' },
      ] : []);

  const rawSubtotal = Number(inv?.subtotal ?? rawItems.reduce((s: number, i: any) => s + (Number(i.quantity || 1) * Number(i.unit_price || i.price || i.rate || 0)), 0));
  const totalTax = Number(inv?.total_tax ?? inv?.tax_amount ?? (isSamplePreview ? rawSubtotal * 0.05 : 0));
  const grandTotal = Number(inv?.grand_total ?? inv?.total_amount ?? (rawSubtotal + totalTax));
  const amountReceived = Number(inv?.amount_received ?? inv?.paid_amount ?? grandTotal);
  const isPaidInFull = inv?.payment_status?.toUpperCase() === 'PAID' || inv?.payment_status === 'Paid' || (amountReceived > 0 && amountReceived >= grandTotal - 0.05) || true;
  const totalQty = rawItems.reduce((sum: number, i: any) => sum + Number(i.quantity || 1), 0);
  const totalSavings = Number(inv?.discount_amount ?? inv?.discount ?? 0);

  // Dynamic Custom Header Fields
  const enabledCustomFields: any[] = Array.isArray(activeTemplate?.customFields)
    ? activeTemplate.customFields.filter((fld: any) => fld.enabled !== false && (fld.value || fld.name || fld.label))
    : [];

  // Dynamic Custom Item Columns
  const enabledCustomCols: any[] = Array.isArray(activeTemplate?.customItemColumns)
    ? activeTemplate.customItemColumns.filter((col: any) => col.enabled !== false && (col.name || col.label))
    : [];

  // UPI & Google Review QR
  const paymentQrSettings = getOrgPaymentQrSettings(tid);
  const balanceDue = isPaidInFull ? 0 : Math.max(0, grandTotal - amountReceived);
  const targetAmount = balanceDue > 0 ? balanceDue : grandTotal;
  const resolvedUpiVpa = (inv?.upi_vpa || activeTemplate?.upiId || paymentQrSettings?.vpa || activeGst?.upi_vpa || '9849344919@okaxis').trim();
  const payeeName = activeTemplate?.payeeName || paymentQrSettings?.payeeName || storeName;

  const upiIntentUrl = buildUpiPayUrl({
    vpa: resolvedUpiVpa,
    payeeName: payeeName,
    amount: targetAmount,
    invoiceNumber: invoiceNum,
  });

  const showPaymentQR = (f.showQR !== false && f.showQrCode !== false && activeTemplate?.showQR !== false);
  const paymentQrSvg = showPaymentQR
    ? (activeTemplate?.customQrUrl || (paymentQrSettings?.type === 'custom_image' && paymentQrSettings.customImageUrl) || generateQRCodeSVG(upiIntentUrl, 96))
    : '';

  const rawGoogleReviewUrl = activeTemplate?.googleReviewUrl || activeGst?.google_review_url || `https://search.google.com/local/writereview?placeid=${encodeURIComponent(storeName)}`;
  const showGoogleReviewQR = (activeTemplate?.showGoogleReviewQR !== false);
  const googleReviewQrSvg = showGoogleReviewQR ? generateQRCodeSVG(rawGoogleReviewUrl, 80) : '';

  const termsText =
    inv?.terms ||
    inv?.terms_and_conditions ||
    activeTemplate?.termsAndConditionsText ||
    activeTemplate?.termsText ||
    activeGst?.terms_and_conditions ||
    '1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction only.';

  const declarationText =
    activeTemplate?.declarationText ||
    'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.';

  const footerText = activeTemplate?.thankYouNote || activeTemplate?.footerText || 'THANK YOU FOR SHOPPING WITH US! VISIT AGAIN';

  const itemsHtml = rawItems
    .map((it: any, idx: number) => {
      const lineQty = Number(it.quantity ?? it.qty ?? 1);
      const lineRate = Number(it.unit_price ?? it.rate ?? it.price ?? 0);
      const lineAmt = Number(it.amount ?? it.total ?? (lineQty * lineRate));
      const mrp = it.mrp ? Number(it.mrp) : 0;
      const saved = (mrp > lineRate) ? (mrp - lineRate) * lineQty : 0;
      const hsn = (it.hsn_code || it.hsn || (isSamplePreview ? (idx === 0 ? '1006' : '1512') : '') || '').trim();
      const batch = (it.batch_number || it.batch || (isSamplePreview ? (idx === 0 ? 'BR-992' : 'SF-201') : '') || '').trim();
      const exp = (it.expiry_date || it.exp_date || (isSamplePreview ? '12/2027' : '') || '').trim();
      const description = (it.description || (isSamplePreview ? (idx === 0 ? 'Premium Long Grain Aged Rice' : '') : '') || '').trim();
      const hasSubDetails = Boolean((f.showHSN !== false && hsn) || (activeTemplate?.showBatchNumber !== false && batch) || (activeTemplate?.showExpiryDate !== false && exp));

      return `
        <div style="margin-bottom: 5px;">
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 10px; line-height: 1.3;">
            <span style="flex: 1; text-align: left; padding-right: 4px;">
              ${f.showItemIndex !== false ? `${idx + 1}. ` : ''}${it.product_name || it.item_name || it.name || 'Item'}
            </span>
            <span style="width: 40px; text-align: center;">${lineQty} ${it.unit || 'Nos'}</span>
            <span style="width: 50px; text-align: right;">₹${lineRate.toFixed(0)}</span>
            <span style="width: 55px; text-align: right;">₹${lineAmt.toFixed(0)}</span>
          </div>
          ${(f.showDescription !== false && description) ? `
            <div style="font-size: 8.5px; color: #222; padding-left: 10px; font-style: italic;">
              ${description}
            </div>
          ` : ''}
          ${hasSubDetails ? `
            <div style="font-size: 8.5px; font-weight: 600; padding-left: 10px;">
              ${(f.showHSN !== false && hsn) ? `HSN: ${hsn}` : ''}
              ${(activeTemplate?.showBatchNumber !== false && batch) ? `${(f.showHSN !== false && hsn) ? ' | ' : ''}Batch: ${batch}` : ''}
              ${(activeTemplate?.showExpiryDate !== false && exp) ? `${((f.showHSN !== false && hsn) || (activeTemplate?.showBatchNumber !== false && batch)) ? ' | ' : ''}EXP: ${exp}` : ''}
            </div>
          ` : ''}
          ${(f.showMRP !== false && mrp > lineRate) ? `
            <div style="font-size: 8.5px; font-weight: 500; padding-left: 10px;">
              MRP: ₹${mrp.toFixed(0)} | Saved: ₹${saved.toFixed(0)} (${Math.round(((mrp - lineRate) / mrp) * 100)}% OFF)
            </div>
          ` : ''}
          ${enabledCustomCols.length > 0 ? (() => {
            const badges = enabledCustomCols
              .map((col: any) => {
                const val = it[col.key] || it[col.name] || it[col.id] || it.attributes?.[col.key] || it.attributes?.[col.name] || (isSamplePreview ? 'A-12' : '');
                if (!val) return '';
                return `<span style="border: 1px solid #000; padding: 0 3px;">${col.name || col.label}: ${val}</span>`;
              })
              .filter(Boolean);
            if (badges.length === 0) return '';
            return `<div style="display: flex; flex-wrap: wrap; gap: 4px; padding-left: 10px; font-size: 8px; font-weight: bold; margin-top: 1px;">${badges.join('')}</div>`;
          })() : ''}
        </div>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Thermal Receipt</title>
        <style>
          @page {
            size: ${is58mm ? '58mm' : '80mm'} auto;
            margin: 0mm !important;
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
            margin: 0;
            padding: 0;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            width: ${printableWidth} !important;
            max-width: ${printableWidth} !important;
            margin: 0 auto !important;
            padding: 2mm 2mm 8mm 2mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: ${fontFam} !important;
            font-weight: 800 !important;
            font-size: 10.5px !important;
            line-height: 1.28 !important;
            -webkit-text-stroke: ${clarity === 'ultra_dark' ? '0.3px #000000' : '0.15px #000000'} !important;
            -webkit-font-smoothing: antialiased !important;
            text-rendering: geometricPrecision !important;
          }
          .center { text-align: center; }
          .divider { text-align: center; overflow: hidden; white-space: nowrap; font-weight: 900; margin: 3px 0; font-size: 9.5px; letter-spacing: 0.5px; }
          .flex-between { display: flex; justify-content: space-between; align-items: center; }
          .bold { font-weight: 900; }
          .title-box { display: inline-block; border: 2px solid #000; padding: 2px 10px; font-size: 12px; font-weight: 900; letter-spacing: 1px; border-radius: 4px; text-transform: uppercase; }
          .stamp { border: 2px dashed #000; padding: 4px 10px; text-align: center; margin: 6px auto; transform: rotate(-3deg); font-weight: 900; display: inline-block; }
          .qr-section { text-align: center; border-top: 1px dashed #000; padding-top: 6px; margin-top: 6px; display: block; width: 100%; }
          .qr-img { display: block; margin: 0 auto 4px auto; filter: contrast(200%); }
          @media print {
            html, body {
              width: ${printableWidth} !important;
              max-width: ${printableWidth} !important;
              margin: 0 auto !important;
              padding: 1mm 1mm 4mm 1mm !important;
            }
          }
        </style>
      </head>
      <body>
        <!-- Top Tear Edge -->
        <div class="center" style="font-size: 8px; letter-spacing: 2px; color: #555; margin-bottom: 4px;">
          ✂ - - - - - - - - - - - - - - - - - - - ✂
        </div>

        <!-- Store Header -->
        <div class="center" style="margin-bottom: 3px; text-align: center;">
          ${(f.showLogo !== false && resolvedLogoUrl) ? `
            <div style="margin-bottom: 6px; text-align: center;">
              <img src="${resolvedLogoUrl}" alt="Logo" style="max-height: 48px; max-width: 140px; object-fit: contain; margin: 0 auto 4px auto; display: block; filter: grayscale(100%) contrast(200%);" />
            </div>
          ` : ''}
          ${activeTemplate?.showStoreName !== false ? `<h1 style="font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; text-align: center;">${storeName}</h1>` : ''}
          ${(activeTemplate?.showBranch !== false && branchName) ? `<p style="font-size: 10px; font-weight: bold; text-transform: uppercase; text-align: center;">${branchName}</p>` : ''}
          ${(activeTemplate?.showTagline !== false && tagline) ? `<p style="font-size: 9.5px; font-style: italic; font-weight: 600; text-align: center;">${tagline}</p>` : ''}
          ${activeTemplate?.showAddress !== false && storeAddress ? `<p style="font-size: 10px; font-weight: 600; text-align: center;">${storeAddress}</p>` : ''}
          ${activeTemplate?.showPhone !== false && storePhone ? `<p style="font-size: 10px; font-weight: bold; text-align: center;">PH: ${storePhone}</p>` : ''}
          ${(activeTemplate?.showGstin !== false && storeGstin) ? `<p style="font-size: 10px; font-weight: bold; text-align: center;">GSTIN: ${storeGstin}</p>` : ''}
          
          ${enabledCustomFields.length > 0 ? `
            <div style="margin-top: 3px; border-top: 1px dotted #000; padding-top: 2px; text-align: center;">
              ${enabledCustomFields.map((field) => `<p style="font-size: 9.5px; font-weight: bold;">${(field.name || field.label || '').toUpperCase()}: ${field.value || ''}</p>`).join('')}
            </div>
          ` : ''}
        </div>

        <div class="divider">${dividerChar}</div>

        <!-- Receipt Title & Meta -->
        <div class="center" style="margin: 4px 0; text-align: center;">
          <span class="title-box">${activeTemplate?.headerTitle || 'TAX INVOICE'}</span>
        </div>

        <div class="flex-between" style="font-size: 10px; font-weight: bold; margin-top: 4px;">
          <span>INV: #${invoiceNum}</span>
          <span>DATE: ${invoiceDate}</span>
        </div>

        <div class="flex-between" style="font-size: 9.5px; font-weight: 600; margin-bottom: 3px;">
          ${activeTemplate?.showCashierName !== false ? `<span>CASHIER: ${cashierRep}</span>` : '<span></span>'}
          <span>TIME: ${invoiceTime}</span>
        </div>

        ${hasAnyMetaField ? `
          <div style="font-size: 9.5px; font-weight: bold; border-top: 1px dashed #000; padding-top: 3px; margin-top: 3px;">
            ${(activeTemplate?.showPoNumber !== false && poNumber) ? `<div class="flex-between"><span>PO NO:</span><span>${poNumber}</span></div>` : ''}
            ${(activeTemplate?.showEwayBill !== false && ewayBill) ? `<div class="flex-between"><span>E-WAY BILL:</span><span>${ewayBill}</span></div>` : ''}
            ${(activeTemplate?.showVehicleNumber !== false && vehicleNumber) ? `<div class="flex-between"><span>VEHICLE NO:</span><span>${vehicleNumber}</span></div>` : ''}
            ${(activeTemplate?.showChallanNumber !== false && challanNumber) ? `<div class="flex-between"><span>CHALLAN NO:</span><span>${challanNumber}</span></div>` : ''}
          </div>
        ` : ''}

        ${f.showCustomerDetails !== false ? `
          <div style="border-top: 1px dashed #000; padding-top: 3px; margin-top: 3px; font-size: 10px;">
            <p style="font-weight: bold;">CUSTOMER: ${customerName}</p>
            ${(activeTemplate?.showCustomerPhone !== false && customerPhone) ? `<p style="font-weight: 600;">MOB: ${customerPhone}</p>` : ''}
            ${(activeTemplate?.showCustomerGstin !== false && customerGstin) ? `<p style="font-weight: 600;">GSTIN: ${customerGstin}</p>` : ''}
            ${(activeTemplate?.showCustomerAddress !== false && customerAddress) ? `<p style="font-weight: 500; font-size: 9.5px;">ADDR: ${customerAddress}</p>` : ''}
          </div>
        ` : ''}

        <div class="divider">${dividerChar}</div>

        <!-- Items Table Header -->
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 10px; border-bottom: 2px solid #000; padding-bottom: 2px; margin-bottom: 3px;">
          <span style="flex: 1; text-align: left;">ITEM</span>
          <span style="width: 40px; text-align: center;">QTY</span>
          <span style="width: 50px; text-align: right;">RATE</span>
          <span style="width: 55px; text-align: right;">AMT</span>
        </div>

        <!-- Items List -->
        ${itemsHtml}

        <div class="divider">${dividerChar}</div>

        <!-- Totals Summary -->
        <div style="font-size: 10px; font-weight: bold;">
          ${activeTemplate?.showTotalQuantity !== false ? `
            <div class="flex-between" style="font-weight: 900; font-size: 10.5px;">
              <span>TOTAL ITEMS / BILLED QTY:</span>
              <span>${rawItems.length} Items / ${totalQty} Units</span>
            </div>
          ` : ''}
          <div class="flex-between">
            <span>SUBTOTAL:</span>
            <span>₹${rawSubtotal.toFixed(2)}</span>
          </div>
          ${(activeTemplate?.showTotalSavings !== false && totalSavings > 0) ? `
            <div class="flex-between" style="font-weight: 900;">
              <span>TOTAL SAVINGS TODAY:</span>
              <span>- ₹${totalSavings.toFixed(2)}</span>
            </div>
          ` : ''}
          ${(f.showTaxSplit !== false && totalTax > 0) ? `
            <div class="flex-between" style="font-size: 9.5px;">
              <span>GST (CGST 2.5% + SGST 2.5%):</span>
              <span>₹${totalTax.toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="flex-between" style="font-size: 14px; font-weight: 900; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 4px 0; margin-top: 3px;">
            <span>NET PAYABLE:</span>
            <span style="font-size: 16px;">₹${grandTotal.toFixed(2)}</span>
          </div>
        </div>

        <!-- Paid in Full Stamp -->
        ${(activeTemplate?.showPaidInFullStamp !== false && isPaidInFull) ? `
          <div class="center" style="margin: 6px 0; text-align: center;">
            <div class="stamp">
              <span style="font-size: 12px; font-weight: 900; letter-spacing: 1px; display: block;">★ PAID IN FULL ★</span>
              <span style="font-size: 8px; font-weight: bold; display: block;">(${inv.payment_mode || 'CASH / UPI'}) · ALL DUES CLEARED</span>
            </div>
          </div>
        ` : ''}

        <!-- Payment Details -->
        ${f.showPaymentDetails !== false ? `
          <div style="border-top: 1px dotted #000; padding-top: 3px; margin-top: 3px; font-size: 10px; font-weight: bold;">
            <div class="flex-between">
              <span>PAID VIA:</span>
              <span>${inv.payment_mode || 'CASH / UPI'} (COMPLETED)</span>
            </div>
            <div class="flex-between">
              <span>AMOUNT RECEIVED:</span>
              <span>₹${amountReceived.toFixed(2)}</span>
            </div>
            ${amountReceived > grandTotal ? `
              <div class="flex-between">
                <span>CHANGE RETURNED:</span>
                <span>₹${(amountReceived - grandTotal).toFixed(2)}</span>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Customer Ledger Balance -->
        ${f.showPartyBalance !== false ? `
          <div class="flex-between" style="border-top: 1px dotted #000; padding-top: 3px; font-size: 9.5px; font-weight: bold; margin-top: 2px;">
            <span>CUSTOMER LEDGER OUTSTANDING:</span>
            <span>₹${balanceDue.toFixed(2)}</span>
          </div>
        ` : ''}

        <!-- Payment QR Code -->
        ${showPaymentQR ? `
          <div class="qr-section">
            <img src="${paymentQrSvg}" alt="UPI QR" class="qr-img" style="width: 90px; height: 90px; object-fit: contain;" />
            <div style="font-size: 9.5px; font-weight: 900; text-transform: uppercase; margin-top: 2px; text-align: center;">SCAN TO PAY VIA UPI / GPAY</div>
            <div style="font-size: 8.5px; font-family: monospace; text-align: center;">${resolvedUpiVpa}</div>
          </div>
        ` : ''}

        <!-- Google Review QR Code -->
        ${showGoogleReviewQR ? `
          <div class="qr-section">
            <div style="font-size: 12px; font-weight: 900; letter-spacing: 2px; text-align: center; margin-bottom: 2px;">★ ★ ★ ★ ★</div>
            <div style="font-size: 9.5px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px; text-align: center;">RATE YOUR EXPERIENCE</div>
            <img src="${googleReviewQrSvg}" alt="Review QR" class="qr-img" style="width: 80px; height: 80px; object-fit: contain;" />
            <div style="font-size: 8px; font-weight: bold; text-transform: uppercase; margin-top: 2px; text-align: center;">Scan to Leave a 5-Star Google Review!</div>
          </div>
        ` : ''}

        <!-- Digital Signature & Company Stamp -->
        ${activeTemplate?.showSignature !== false ? `
          <div style="border-top: 1px dashed #000; padding-top: 6px; margin-top: 6px; display: flex; justify-content: space-between; align-items: flex-end;">
            ${activeTemplate?.stampUrl ? `
              <div style="max-height: 48px; max-width: 64px;">
                <img src="${activeTemplate.stampUrl}" alt="Stamp" style="max-height: 48px; max-width: 64px; object-fit: contain; filter: grayscale(100%) contrast(200%);" />
              </div>
            ` : '<div></div>'}
            <div style="text-align: right;">
              ${activeTemplate?.signatureUrl ? `
                <div style="margin-bottom: 2px; display: flex; justify-content: flex-end;">
                  <img src="${activeTemplate.signatureUrl}" alt="Signature" style="max-height: 32px; max-width: 100px; object-fit: contain; filter: grayscale(100%) contrast(200%);" />
                </div>
              ` : ''}
              <p style="font-size: 9px; font-weight: bold;">${activeTemplate?.signatoryLabel || `For ${storeName}`}</p>
              <p style="font-size: 8px; font-weight: 600; text-transform: uppercase;">Authorized Signatory</p>
            </div>
          </div>
        ` : ''}

        <div class="divider">${dividerChar}</div>

        <!-- Terms & Conditions -->
        ${(f.showTerms !== false && termsText) ? `
          <div style="font-size: 8.5px; line-height: 1.25; margin-top: 3px;">
            <div style="font-weight: 900; margin-bottom: 1px; text-transform: uppercase; text-decoration: underline;">Terms & Conditions:</div>
            <div style="font-family: monospace;">${termsText.replace(/\n/g, '<br />')}</div>
          </div>
        ` : ''}

        <!-- Statutory Declaration -->
        ${(activeTemplate?.showDeclaration !== false && declarationText) ? `
          <div style="font-size: 7.5px; font-style: italic; line-height: 1.15; margin-top: 4px;">
            ${declarationText}
          </div>
        ` : ''}

        <!-- Thank You Note -->
        <p class="center" style="margin-top: 8px; font-size: 9.5px; font-weight: 900;">
          *** ${footerText} ***
        </p>

        <script>
          document.title = "";
          window.onload = function() {
            document.title = "";
            window.print();
            setTimeout(function() {
              window.close();
            }, 600);
          };
        </script>
      </body>
    </html>
  `;
}


/**
 * Print any arbitrary HTML content seamlessly in the current page via an isolated iframe
 * without opening a separate browser popup window (about:blank).
 */
export function printHtmlInPage(htmlContent: string, delayMs = 350) {
  if (typeof window === 'undefined') return;

  const existingIframe = document.getElementById('bos-in-page-print-iframe');
  if (existingIframe) {
    existingIframe.remove();
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'bos-in-page-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '-9999px';
  iframe.style.width = '0px';
  iframe.style.height = '0px';
  iframe.style.border = 'none';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
  if (iframeDoc) {
    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.error('In-page iframe print error:', e);
      } finally {
        setTimeout(() => {
          try {
            iframe.remove();
          } catch {}
        }, 120000);
      }
    }, delayMs);
  }
}

/**
 * Direct function to print a thermal receipt invoice seamlessly in-page using the active saved template.
 */
export function printThermalReceiptInvoice(inv: any, templateOverride?: any, tenantId?: string) {
  if (typeof window === 'undefined') return;
  const htmlContent = generateThermalReceiptHtml(inv, templateOverride, tenantId);
  printHtmlInPage(htmlContent, 250);
}

/**
 * High-Reliability Thermal Receipt Printer
 * Supports both direct iframe printing (zero CSS interference) and clean standard print mode.
 */
export function triggerThermalPrint(customPaperWidth?: string) {
  if (typeof window === 'undefined') return;

  const activeTemplate = getActiveReceiptTemplate();
  const paperWidth = customPaperWidth || activeTemplate.paperSize || '80mm';
  const is58 = paperWidth === '58mm';
  const printableWidth = is58 ? '48mm' : '72mm';
  const clarity = activeTemplate.printClarity || 'ultra_dark';
  const strokeVal = clarity === 'ultra_dark' ? '0.3px #000000' : '0.15px #000000';
  const fontWeightVal = clarity === 'ultra_dark' ? '800' : '700';

  let portal = document.getElementById('printable-receipt-portal');
  if (!portal) {
    portal = document.getElementById('preview-thermal-paper');
  }

  if (!portal) {
    console.warn('[Print] Receipt portal not found in DOM, retrying with window.print()');
    window.print();
    return;
  }

  // Attempt isolated iframe printing first (prevents blank pages & style clashes)
  try {
    const existingIframe = document.getElementById('thermal-print-iframe');
    if (existingIframe) {
      existingIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'thermal-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    iframe.style.width = printableWidth;
    iframe.style.height = '100px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Thermal Receipt</title>
            <style>
              @page {
                size: ${is58 ? '58mm' : '80mm'} auto;
                margin: 0mm !important;
              }
              *, *::before, *::after {
                box-sizing: border-box !important;
                margin: 0;
                padding: 0;
                color: #000000 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              html, body {
                width: ${printableWidth} !important;
                max-width: ${printableWidth} !important;
                margin: 0 auto !important;
                padding: 1.5mm 1.5mm 20mm 1.5mm !important;
                background: #ffffff !important;
                color: #000000 !important;
                font-family: 'Consolas', 'Courier New', 'Courier', 'Lucida Console', monospace, system-ui !important;
                font-weight: 900 !important;
                font-size: 11.5px !important;
                line-height: 1.25 !important;
                -webkit-text-stroke: ${clarity === 'ultra_dark' ? '0.35px #000000' : '0.2px #000000'} !important;
                text-shadow: 0 0 0.25px #000000 !important;
                -webkit-font-smoothing: antialiased !important;
                text-rendering: geometricPrecision !important;
              }
              /* Layout & Flex Utilities for Iframe Print */
              .flex { display: flex !important; }
              .flex-col { flex-direction: column !important; }
              .flex-1 { flex: 1 1 0% !important; }
              .flex-shrink-0 { flex-shrink: 0 !important; }
              .items-center { align-items: center !important; }
              .items-start { align-items: flex-start !important; }
              .items-end { align-items: flex-end !important; }
              .justify-between { justify-content: space-between !important; }
              .justify-center { justify-content: center !important; }
              .justify-end { justify-content: flex-end !important; }
              .text-left { text-align: left !important; }
              .text-center { text-align: center !important; }
              .text-right { text-align: right !important; }
              .font-black, .font-extrabold { font-weight: 900 !important; }
              .font-bold { font-weight: 800 !important; }
              .uppercase { text-transform: uppercase !important; }
              .italic { font-style: italic !important; }
              .whitespace-pre-line { white-space: pre-line !important; }
              .break-words { word-break: break-word !important; }
              .leading-none { line-height: 1 !important; }
              .leading-tight { line-height: 1.15 !important; }
              .leading-snug { line-height: 1.3 !important; }
              .w-full { width: 100% !important; }
              .w-4 { width: 1rem !important; }
              .w-10 { width: 2.5rem !important; }
              .w-12 { width: 3rem !important; }
              .w-14 { width: 3.5rem !important; }
              .gap-1 { gap: 0.25rem !important; }
              .gap-1\\.5 { gap: 0.375rem !important; }
              .gap-2 { gap: 0.5rem !important; }
              .p-0\\.5 { padding: 0.125rem !important; }
              .p-1 { padding: 0.25rem !important; }
              .py-0\\.5 { padding-top: 0.125rem !important; padding-bottom: 0.125rem !important; }
              .py-1 { padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }
              .pt-0\\.5 { padding-top: 0.125rem !important; }
              .pt-1 { padding-top: 0.25rem !important; }
              .pt-1\\.5 { padding-top: 0.375rem !important; }
              .pt-2 { padding-top: 0.5rem !important; }
              .pb-1 { padding-bottom: 0.25rem !important; }
              .pb-1\\.5 { padding-bottom: 0.375rem !important; }
              .my-0\\.5 { margin-top: 0.125rem !important; margin-bottom: 0.125rem !important; }
              .my-1 { margin-top: 0.25rem !important; margin-bottom: 0.25rem !important; }
              .my-2 { margin-top: 0.5rem !important; margin-bottom: 0.5rem !important; }
              .mt-0\\.5 { margin-top: 0.125rem !important; }
              .mt-1 { margin-top: 0.25rem !important; }
              .mb-0\\.5 { margin-bottom: 0.125rem !important; }
              .mb-1 { margin-bottom: 0.25rem !important; }
              .mx-auto { margin-left: auto !important; margin-right: auto !important; }
              .space-y-0\\.5 > * + * { margin-top: 0.125rem !important; }
              .space-y-1 > * + * { margin-top: 0.25rem !important; }
              .border-b { border-bottom-width: 1px !important; }
              .border-b-\\[1\\.5px\\] { border-bottom-width: 1.5px !important; }
              .border-t { border-top-width: 1px !important; }
              .border-t-\\[1\\.5px\\] { border-top-width: 1.5px !important; }
              .border-y-\\[1\\.5px\\] { border-top-width: 1.5px !important; border-bottom-width: 1.5px !important; }
              .border-solid { border-style: solid !important; }
              .border-dashed { border-style: dashed !important; }
              .border-dotted { border-style: dotted !important; }
              .border-double { border-style: double !important; }
              .border-black { border-color: #000000 !important; }
              .divide-y > * + * { border-top-width: 1px !important; }
              .divide-black\\/40 > * + * { border-color: #000000 !important; }
              
              /* Pure Black High Contrast Thermal Elements */
              table { width: 100% !important; border-collapse: collapse !important; }
              th, td { color: #000000 !important; }
              img, svg {
                image-rendering: pixelated !important;
                image-rendering: -moz-crisp-edges !important;
                image-rendering: crisp-edges !important;
                shape-rendering: crispEdges !important;
                filter: grayscale(100%) contrast(300%) !important;
                max-width: 100% !important;
              }
              .bg-black {
                background-color: #000000 !important;
                color: #ffffff !important;
              }
              .bg-black * {
                color: #ffffff !important;
              }
            </style>
          </head>
          <body>
            ${portal.innerHTML}
          </body>
        </html>
      `);
      iframeDoc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error('[Thermal Print] Iframe print failed, falling back to window print:', e);
          fallbackWindowPrint(printableWidth, strokeVal, fontWeightVal);
        } finally {
          setTimeout(() => {
            try { iframe.remove(); } catch {}
          }, 60000); // keep iframe alive while print spooler processes
        }
      }, 250);
      return;
    }
  } catch (err) {
    console.warn('[Thermal Print] Iframe setup encountered an issue, falling back:', err);
  }

  // Fallback direct window print
  fallbackWindowPrint(printableWidth, strokeVal, fontWeightVal);
}

function fallbackWindowPrint(printableWidth: string, strokeVal: string, fontWeightVal: string) {
  document.body.classList.add('printing-receipt');

  let styleEl = document.getElementById('thermal-print-style-tag');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'thermal-print-style-tag';
    document.head.appendChild(styleEl);
  }

  styleEl.innerHTML = `
    @page {
      size: auto;
      margin: 0 !important;
    }
    @media print {
      @page {
        size: auto;
        margin: 0 !important;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
        overflow: visible !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body > *:not(#printable-receipt-portal),
      body #root > *:not(#printable-receipt-portal) {
        display: none !important;
        visibility: hidden !important;
      }
      #printable-receipt-portal {
        display: block !important;
        visibility: visible !important;
        position: static !important;
        width: ${printableWidth} !important;
        max-width: ${printableWidth} !important;
        padding: 1.5mm !important;
        margin: 0 auto !important;
        background: #ffffff !important;
        color: #000000 !important;
        z-index: 999999 !important;
        font-size: 12px !important;
        font-weight: ${fontWeightVal} !important;
        line-height: 1.25 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        text-rendering: geometricPrecision !important;
        -webkit-font-smoothing: antialiased !important;
        -webkit-text-stroke: ${strokeVal} !important;
        box-sizing: border-box !important;
      }
      #printable-receipt-portal * {
        visibility: visible !important;
        color: #000000 !important;
        border-color: #000000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  `;

  const cleanup = () => {
    document.body.classList.remove('printing-receipt');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.print();
    });
  });
}

