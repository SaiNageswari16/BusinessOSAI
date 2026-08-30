'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { getActiveInvoicePrintTemplate } from '../../lib/receipt-template-store';
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";

export interface FullInvoiceData {
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerCompany?: string;
  customerGST?: string;
  customerAddress?: string;
  customerType?: string;
  items?: Array<{
    product_id?: string;
    product_name?: string;
    hsn_code?: string;
    quantity: number;
    unit_price: number;
    mrp?: number;
    discount_type?: 'percent' | 'fixed';
    discount_value?: number;
    tax_rate?: number;
    subtotal?: number;
  }>;
  subtotal?: number;
  discount_amount?: number;
  tax_amount?: number;
  taxable_value?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  gst_type?: 'cgst_sgst' | 'igst';
  is_interstate?: boolean;
  additional_charges?: Array<{ name: string; amount: number }>;
  round_off?: number;
  grand_total?: number;
  payment_method?: string;
  payment_status?: string;
  amount_received?: number;
  notes?: string;
  terms?: string;
}

interface FullInvoicePrinterProps {
  invoice: FullInvoiceData | null;
  isOpen: boolean;
  onClose: () => void;
  autoPrint?: boolean;
  customTemplate?: any;
}

const STATE_GST_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "32": "Kerala", "33": "Tamil Nadu",
  "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh"
};

export function FullInvoicePrinter({
  invoice,
  isOpen,
  onClose,
  autoPrint = false,
  customTemplate,
}: FullInvoicePrinterProps) {
  const { currency } = useCurrency();
  const { tenant } = useTenant();
  const printContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && autoPrint && invoice) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoPrint, invoice]);

  if (!isOpen || !invoice) return null;
  if (typeof document === 'undefined') return null;

  // Retrieve active template or fallback
  const template = customTemplate || getActiveInvoicePrintTemplate();
  const f = template.fields || {
    showLogo: true,
    showHSN: true,
    showTaxSplit: true,
    showBankDetails: true,
    showSignature: true,
    showCustomerDetails: true,
    showProductName: true,
    showPrice: true,
    showMRP: true,
    showSKU: true,
    showPartyBalance: true,
    showItemDescription: true,
    showTime: true,
  };

  const theme = template.themeName || 'stylish';
  const isLuxury = theme === 'luxury';
  const isTally = theme === 'tally';
  const isStylish = theme === 'stylish';
  const isAdvGst = theme === 'adv_gst';
  const isBillBook = theme === 'billbook';
  const isModern = theme === 'modern';
  const isSimple = theme === 'simple';
  const isCultureUp = theme === 'culture_up';
  const isCultureGod = theme === 'culture_god';

  const primaryColor = template.primaryColor || '#2563eb';
  const fontFamily = template.fontFamily || 'Inter, sans-serif';

  // 1. Group / aggregate identical items so rows aren't repeated
  const rawItems = invoice.items || [];
  const items = rawItems.reduce((acc: typeof rawItems, item) => {
    const pId = item.product_id || "";
    const pName = (item.product_name || "").trim().toLowerCase();
    const price = Number(item.unit_price || 0);
    const tax = Number(item.tax_rate || 0);

    const existing = acc.find(
      (x) =>
        (pId && x.product_id === pId && Number(x.unit_price) === price) ||
        (!pId && (x.product_name || "").trim().toLowerCase() === pName && Number(x.unit_price) === price && Number(x.tax_rate) === tax)
    );

    if (existing) {
      existing.quantity = Number(existing.quantity || 0) + Number(item.quantity || 0);
      existing.discount_value = Number(existing.discount_value || 0) + Number(item.discount_value || 0);
    } else {
      acc.push({ ...item });
    }
    return acc;
  }, []);

  // 2. GST State Detection (Intra-State vs Inter-State)
  const sellerGstin = (template.gstin || '37AABCCH694G1Z4').trim().toUpperCase();
  const sellerStateCode = sellerGstin.slice(0, 2) || '37';

  const customerGstin = (invoice.customerGST || '').trim().toUpperCase();
  const customerStateCode = customerGstin.slice(0, 2);

  // If customer has a different valid 2-digit state GSTIN code, or user selected IGST -> Inter-State (IGST)
  const isInterState = Boolean(
    invoice.gst_type === 'igst' ||
    invoice.is_interstate === true ||
    (customerStateCode && customerStateCode.length === 2 && customerStateCode !== sellerStateCode)
  );

  // 3. Tax Calculation
  let calculatedTaxableSubtotal = 0;
  let calculatedTax = 0;
  let calculatedDiscount = 0;

  items.forEach((item) => {
    const qty = Number(item.quantity || 0);
    const price = Number(item.unit_price || 0);
    const taxRate = Number(item.tax_rate || 0);
    const discVal = Number(item.discount_value || 0);
    const disc = item.discount_type === 'percent'
      ? (qty * price * discVal / 100)
      : discVal;
    
    calculatedDiscount += disc;
    const lineNet = Math.max(0, (qty * price) - disc);

    if (taxRate > 0) {
      const lineBase = lineNet / (1 + taxRate / 100);
      const lineTax = lineNet - lineBase;
      calculatedTaxableSubtotal += lineBase;
      calculatedTax += lineTax;
    } else {
      calculatedTaxableSubtotal += lineNet;
    }
  });

  const grandTotal = Number(invoice.grand_total !== undefined ? invoice.grand_total : (calculatedTaxableSubtotal + calculatedTax));
  const totalTax = Number(invoice.tax_amount !== undefined && Number(invoice.tax_amount) >= 0 ? invoice.tax_amount : calculatedTax);
  const taxableSubtotal = Number(
    invoice.taxable_value !== undefined && Number(invoice.taxable_value) > 0
      ? invoice.taxable_value
      : Math.max(0, grandTotal - totalTax)
  );
  const totalDiscount = Number(invoice.discount_amount !== undefined ? invoice.discount_amount : calculatedDiscount);

  // Dominant statutory tax rate (e.g. 18%, 12%, 5%)
  const dominantTaxRate = items.length > 0 && items[0].tax_rate ? Number(items[0].tax_rate) : (taxableSubtotal > 0 && totalTax > 0 ? Math.round((totalTax / taxableSubtotal) * 100) : 18);
  const halfTaxRate = (dominantTaxRate / 2);

  const cgstAmount = invoice.cgst_amount !== undefined ? Number(invoice.cgst_amount) : (totalTax / 2);
  const sgstAmount = invoice.sgst_amount !== undefined ? Number(invoice.sgst_amount) : (totalTax / 2);
  const igstAmount = invoice.igst_amount !== undefined ? Number(invoice.igst_amount) : totalTax;

  // 4. Clean Bank Details: Only display if real organization bank details exist (filter out dummy strings)
  const rawBank = (template.bankDetails || '').trim();
  const isDummyBank = !rawBank || 
    rawBank.includes('334455667788') || 
    rawBank.includes('TEST') || 
    rawBank.includes('000405103000') || 
    rawBank.includes('SBIN0001234') ||
    rawBank.toLowerCase().includes('dummy');
  const hasRealBank = Boolean(f.showBankDetails && !isDummyBank && rawBank.length > 5);

  const handlePrint = () => {
    document.body.classList.add('printing-a4-invoice');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          window.print();
        } finally {
          setTimeout(() => {
            document.body.classList.remove('printing-a4-invoice');
          }, 1500);
        }
      });
    });
  };

  const modalJSX = (
    <>
      {/* Dynamic Print Styles for A4 Single Page Invoice */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait !important;
            margin: 6mm 8mm 6mm 8mm !important;
          }
          html, body {
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body > *:not(#a4-invoice-portal),
          #root,
          header, nav, footer, .no-print, [data-no-print] {
            display: none !important;
            visibility: hidden !important;
          }
          #a4-invoice-portal {
            display: block !important;
            visibility: visible !important;
            position: static !important;
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            overflow: visible !important;
            z-index: 999999 !important;
          }
          #a4-invoice-portal * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #a4-invoice-printable-area {
            display: block !important;
            visibility: visible !important;
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 4mm 6mm !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div
        id="a4-invoice-portal"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto print:static print:inset-auto print:p-0 print:m-0 print:w-full print:h-auto print:overflow-visible print:bg-white print:backdrop-blur-none"
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden print:static print:w-full print:max-w-none print:max-h-none print:h-auto print:overflow-visible print:shadow-none print:border-none print:rounded-none print:m-0 print:p-0 print:bg-white">
          
          {/* Header Bar (Hidden during print) */}
          <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-xl">
                <Printer className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Tax Invoice Preview (A4 Format)</h3>
                <p className="text-xs text-slate-300">Selected Template: <span className="font-semibold text-blue-400">{template.name || 'Stylish Theme'}</span></p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handlePrint}
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-600/30 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                <Printer className="w-4 h-4" /> Save as PDF / Print A4 Invoice
              </button>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Printable Invoice Container */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-100 print:static print:w-full print:h-auto print:overflow-visible print:bg-white print:p-0 print:m-0">
            <div
              id="a4-invoice-printable-area"
              ref={printContainerRef}
              className={`mx-auto bg-white p-6 md:p-8 shadow-md rounded-xl max-w-3xl text-slate-900 text-xs space-y-4 print:static print:w-full print:max-w-none print:shadow-none print:rounded-none print:border-none print:p-0 print:m-0 ${
                isTally ? 'border-2 border-double border-slate-900' : 'border border-slate-200'
              }`}
              style={{
                fontFamily: fontFamily,
                backgroundColor: template.paperBgColor || '#ffffff',
                borderTop: isStylish || isCultureUp || isCultureGod ? `6px solid ${primaryColor}` : undefined,
              }}
            >
              {/* Culture God / UP Header tags */}
              {(isCultureGod || isCultureUp) && (
                <div className="text-center text-[11px] font-bold tracking-widest text-amber-800 bg-amber-50 py-1 rounded-md border border-amber-200 mb-1">
                  {isCultureGod ? '॥ श्री गणेशाय नमः ॥ शुभ लाभ ॥' : '॥ गंगा मैया की जय ॥ उत्तर प्रदेश शासन स्वीकृत ॥'}
                </div>
              )}

              {/* Recipient Copy Checkboxes */}
              {(isBillBook || isAdvGst) && (
                <div className="flex justify-between items-center text-[10px] text-slate-500 border-b border-dashed pb-1.5">
                  <span className="font-bold text-slate-700 uppercase tracking-wider">TAX INVOICE</span>
                  <div className="flex gap-4 font-semibold">
                    <span>[✓] Original for Recipient</span>
                    <span>[ ] Duplicate for Transporter</span>
                    <span>[ ] Triplicate for Supplier</span>
                  </div>
                </div>
              )}

              {/* Header Info: Store Details vs Invoice Header */}
              <div
                className={`flex items-start justify-between border-b pb-4 z-10 relative ${
                  isTally ? 'border-slate-900 border-b-2' : 'border-slate-200'
                }`}
                style={(!isTally && !isSimple && !isModern) ? { borderBottom: `2px solid ${primaryColor}` } : {}}
              >
                <div className="space-y-1 max-w-[60%]">
                  {f.showLogo && (
                    <div className="flex items-center gap-2.5 mb-1">
                      {(template.logoUrl || tenant?.logo_url || tenant?.raw?.logo_url) ? (
                        <img
                          src={template.logoUrl || tenant?.logo_url || tenant?.raw?.logo_url}
                          alt="Logo"
                          className="h-10 max-w-[140px] object-contain rounded-lg shadow-2xs"
                        />
                      ) : (
                        <div
                          className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-extrabold text-base shadow-sm shrink-0"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {template.storeName ? template.storeName.substring(0, 2).toUpperCase() : (tenant?.name ? tenant.name.substring(0, 2).toUpperCase() : 'LM')}
                        </div>
                      )}
                      <div>
                        <h2 className="font-extrabold text-base text-slate-900 leading-tight">
                          {template.storeName || tenant?.name || 'BusinessOS AI'}
                        </h2>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          Authorized Business Partner
                        </span>
                      </div>
                    </div>
                  )}

                  {!f.showLogo && (
                    <h2 className="font-extrabold text-lg mb-1" style={{ color: primaryColor }}>
                      {template.storeName || 'LazyMonkeyAI'}
                    </h2>
                  )}

                  <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                    {template.storeAddress || 'KK Street, Proddatur, YSR Cuddapah, Andhra Pradesh, 516360'}
                  </p>
                  <p className="text-[11px] text-slate-600 font-medium">Ph: {template.storePhone || '+91 9849344919'}</p>
                  {sellerGstin && (
                    <p className="text-[11px] font-bold text-slate-900">
                      GSTIN: {sellerGstin}
                    </p>
                  )}
                </div>

                <div className="text-right space-y-1">
                  <h1 className="text-xl font-black tracking-tight uppercase" style={{ color: primaryColor }}>
                    {template.headerTitle || 'TAX INVOICE'}
                  </h1>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 inline-block text-right mt-0.5">
                    <p className="text-xs font-bold text-slate-900">Invoice No: {invoice.invoice_number || '#INV-2026/0809'}</p>
                    <p className="text-[11px] text-slate-600 font-medium">Date: {invoice.invoice_date || new Date().toLocaleDateString()}</p>
                    {invoice.due_date && <p className="text-[11px] text-slate-600 font-medium">Due Date: {invoice.due_date}</p>}
                    <p className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded mt-0.5 inline-block border border-emerald-200">
                      Status: {invoice.payment_status || 'PAID'} ({invoice.payment_method || 'Cash'})
                    </p>
                  </div>
                </div>
              </div>

              {/* Billed To / Party Details */}
              {f.showCustomerDetails && (
                <div
                  className={`grid grid-cols-2 gap-4 p-3 rounded-xl border z-10 relative ${
                    isModern ? 'bg-slate-50 border-slate-200' :
                    isLuxury ? 'bg-amber-50/40 border-amber-200' :
                    isTally ? 'bg-white border-slate-900' : 'bg-slate-50/80 border-slate-200'
                  }`}
                >
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Billed To (Customer Details)</span>
                    <h4 className="font-bold text-slate-900 text-xs">{invoice.customerName || 'Walk-in Customer'}</h4>
                    {invoice.customerCompany && <p className="text-[10px] font-semibold text-slate-700">{invoice.customerCompany}</p>}
                    {invoice.customerAddress && <p className="text-[10px] text-slate-600 leading-tight">{invoice.customerAddress}</p>}
                    {invoice.customerPhone && <p className="text-[10px] text-slate-600">Ph: {invoice.customerPhone}</p>}
                    {invoice.customerEmail && <p className="text-[10px] text-slate-600">Email: {invoice.customerEmail}</p>}
                    {invoice.customerGST && <p className="text-[10px] font-bold text-slate-800">GSTIN: {invoice.customerGST}</p>}
                  </div>

                  <div className="text-right space-y-0.5 flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Place of Supply</span>
                      <p className="text-[10px] font-bold text-slate-800 mt-0.5">
                        {isInterState ? (customerGstin ? `Inter-State (${customerStateCode})` : 'Inter-State') : `${STATE_GST_CODES[sellerStateCode] || 'Intra-State'} (${sellerStateCode})`}
                      </p>
                      {invoice.customerType && (
                        <p className="text-[9px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded inline-block border border-indigo-100 mt-0.5">
                          Category: {invoice.customerType}
                        </p>
                      )}
                    </div>
                    {f.showPartyBalance && (
                      <div className="text-[9px] font-bold text-slate-600 bg-white p-1.5 rounded-lg border border-slate-200 inline-block">
                        Payment Mode: <span className="text-slate-900 font-extrabold">{invoice.payment_method || 'Cash'}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Line Items Table */}
              <div className="z-10 relative overflow-hidden rounded-xl border border-slate-200">
                <table className={`w-full border-collapse text-xs ${isTally ? 'border border-slate-900' : ''}`}>
                  <thead>
                    <tr
                      className="text-white text-left font-bold"
                      style={{ backgroundColor: isSimple ? '#1e293b' : primaryColor }}
                    >
                      <th className="py-2 px-3 w-8 text-center">#</th>
                      <th className="py-2 px-3">Item Description</th>
                      {f.showHSN && <th className="py-2 px-3 text-center">HSN/SAC</th>}
                      <th className="py-2 px-3 text-center">Qty</th>
                      <th className="py-2 px-3 text-right">Unit Rate</th>
                      <th className="py-2 px-3 text-right">Discount</th>
                      {f.showTaxSplit && <th className="py-2 px-3 text-right">Tax Rate</th>}
                      <th className="py-2 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isTally ? 'divide-slate-900' : 'divide-slate-100'} bg-white`}>
                    {items.map((item, idx) => {
                      const qty = Number(item.quantity || 0);
                      const unitPrice = Number(item.unit_price || 0);
                      const mrpPrice = Number(item.mrp || 0);
                      const discVal = Number(item.discount_value || 0);
                      const taxRate = Number(item.tax_rate || 0);
                      const itemSub = qty * unitPrice;
                      const disc = item.discount_type === 'percent'
                        ? (itemSub * discVal / 100)
                        : discVal;
                      const netAmount = itemSub - disc;

                      return (
                        <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/50' : ''}>
                          <td className="py-2 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-2 px-3">
                            <span className="font-bold text-slate-900 block">{item.product_name || 'Item'}</span>
                            {mrpPrice > unitPrice && (
                              <span className="text-[9px] text-slate-500">MRP: {currency.symbol}{mrpPrice.toFixed(2)}</span>
                            )}
                          </td>
                          {f.showHSN && <td className="py-2 px-3 text-center font-mono text-slate-600 text-[10px]">{item.hsn_code || '9988'}</td>}
                          <td className="py-2 px-3 text-center font-extrabold text-slate-800">{qty}</td>
                          <td className="py-2 px-3 text-right font-medium text-slate-700">{currency.symbol}{unitPrice.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right text-emerald-600 font-semibold">
                            {disc > 0 ? `-₹${disc.toFixed(2)}` : '—'}
                          </td>
                          {f.showTaxSplit && (
                            <td className="py-2 px-3 text-right text-slate-600">
                              {taxRate ? `${taxRate}%` : '18%'}
                            </td>
                          )}
                          <td className="py-2 px-3 text-right font-bold text-slate-900">{currency.symbol}{netAmount.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals & Bank Details */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-1 z-10 relative">
                <div className="md:col-span-7 space-y-3">
                  {hasRealBank && (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-0.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                        Bank & Wire Transfer Details
                      </span>
                      <p className="text-[10px] text-slate-700 font-mono leading-relaxed whitespace-pre-line">
                        {rawBank}
                      </p>
                    </div>
                  )}

                  <div className="space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Terms & Conditions</span>
                    <p className="text-[9px] text-slate-500 whitespace-pre-line leading-relaxed">
                      {template.termsText || '1. Goods once sold will not be taken back.\n2. All disputes subject to local jurisdiction.'}
                    </p>
                  </div>
                </div>

                <div className="md:col-span-5 bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-2 text-xs text-slate-700">
                  <div className="flex justify-between font-semibold text-xs">
                    <span>Taxable Subtotal:</span>
                    <span className="text-slate-900">{currency.symbol}{taxableSubtotal.toFixed(2)}</span>
                  </div>

                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-semibold text-xs">
                      <span>Total Savings / Discount:</span>
                      <span>-{currency.symbol}{totalDiscount.toFixed(2)}</span>
                    </div>
                  )}

                  {totalTax > 0 && (
                    <>
                      {isInterState ? (
                        <div className="flex justify-between text-slate-600 text-[11px] font-medium">
                          <span>IGST ({dominantTaxRate}%):</span>
                          <span className="font-bold text-slate-800">{currency.symbol}{igstAmount.toFixed(2)}</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between text-slate-600 text-[11px] font-medium">
                            <span>CGST ({halfTaxRate}%):</span>
                            <span className="font-bold text-slate-800">{currency.symbol}{cgstAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-slate-600 text-[11px] font-medium">
                            <span>SGST ({halfTaxRate}%):</span>
                            <span className="font-bold text-slate-800">{currency.symbol}{sgstAmount.toFixed(2)}</span>
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {/* Additional Charges (Freight, Packing, etc.) */}
                  {(invoice.additional_charges || []).filter(c => Number(c.amount) > 0).map((charge, idx) => (
                    <div key={idx} className="flex justify-between text-slate-600 text-[11px]">
                      <span>{charge.name}:</span>
                      <span>+{currency.symbol}{Number(charge.amount || 0).toFixed(2)}</span>
                    </div>
                  ))}

                  {/* Round Off */}
                  {invoice.round_off !== undefined && invoice.round_off !== 0 && (
                    <div className="flex justify-between text-slate-500 italic text-[11px]">
                      <span>Round Off:</span>
                      <span>{Number(invoice.round_off || 0) >= 0 ? '+' : ''}{currency.symbol}{Number(invoice.round_off || 0).toFixed(2)}</span>
                    </div>
                  )}

                  <div
                    className="flex justify-between items-center pt-2 border-t-2 border-slate-300 font-black text-xs text-slate-900"
                    style={{ borderColor: primaryColor }}
                  >
                    <span>GRAND TOTAL:</span>
                    <span className="text-sm font-extrabold" style={{ color: primaryColor }}>
                      {currency.symbol}{grandTotal.toFixed(2)}
                    </span>
                  </div>

                  {/* Amount Received & Balance */}
                  {invoice.amount_received !== undefined && Number(invoice.amount_received) > 0 && (
                    <>
                      <div className="flex justify-between text-slate-600 font-semibold pt-0.5 text-[11px]">
                        <span>Amount Received:</span>
                        <span className="text-emerald-700 font-bold">{currency.symbol}{Number(invoice.amount_received).toFixed(2)}</span>
                      </div>
                      {Number(invoice.amount_received) >= grandTotal - 0.05 ? (
                        <div className="flex justify-between text-emerald-700 font-bold text-[11px]">
                          <span>Payment Status:</span>
                          <span>PAID ({invoice.payment_method || 'Cash'})</span>
                        </div>
                      ) : (
                        <div className="flex justify-between text-red-600 font-bold text-[11px]">
                          <span>Balance Due:</span>
                          <span>{currency.symbol}{Math.max(0, grandTotal - Number(invoice.amount_received)).toFixed(2)}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Signature & Footer */}
              <div className="pt-4 border-t border-slate-200 flex justify-between items-end z-10 relative">
                <div className="text-[9px] text-slate-500 max-w-[50%]">
                  <p className="font-semibold text-slate-700">{template.footerText || 'Thank you for your business!'}</p>
                  <p className="mt-0.5">Computer generated invoice. No signature required if authorized.</p>
                </div>

                {f.showSignature && (
                  <div className="text-center space-y-4">
                    <div className="h-6 border-b border-slate-300 w-36"></div>
                    <span className="text-[9px] font-bold text-slate-600 block uppercase tracking-wider">
                      Authorized Signatory
                    </span>
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>
      </div>
    </>
  );

  return createPortal(modalJSX, document.body);
}

export type FullInvoicePropsWrapper = FullInvoicePrinterProps;
