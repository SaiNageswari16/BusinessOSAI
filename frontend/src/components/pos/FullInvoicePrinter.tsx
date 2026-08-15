'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Download, X, CheckCircle } from 'lucide-react';
import { getActiveInvoicePrintTemplate } from '../../lib/receipt-template-store';

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

export function FullInvoicePrinter({
  invoice,
  isOpen,
  onClose,
  autoPrint = false,
  customTemplate,
}: FullInvoicePrinterProps) {
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

  const items = invoice.items || [];

  // Financial calculations
  const subtotal = Number(invoice.subtotal ?? items.reduce((acc, item) => {
    const qty = Number(item.quantity || 0);
    const price = Number(item.unit_price || 0);
    return acc + (qty * price);
  }, 0));

  const totalDiscount = Number(invoice.discount_amount ?? items.reduce((acc, item) => {
    const qty = Number(item.quantity || 0);
    const price = Number(item.unit_price || 0);
    const discVal = Number(item.discount_value || 0);
    const disc = item.discount_type === 'percent'
      ? (qty * price * discVal / 100)
      : discVal;
    return acc + disc;
  }, 0));

  const totalTax = Number(invoice.tax_amount ?? items.reduce((acc, item) => {
    const qty = Number(item.quantity || 0);
    const price = Number(item.unit_price || 0);
    const discVal = Number(item.discount_value || 0);
    const taxRate = Number(item.tax_rate || 0);
    const itemSub = (qty * price) - (
      item.discount_type === 'percent'
        ? (qty * price * discVal / 100)
        : discVal
    );
    return acc + (itemSub * taxRate / 100);
  }, 0));

  const grandTotal = Number(invoice.grand_total ?? (subtotal - totalDiscount + totalTax));

  const cgstAmount = totalTax / 2;
  const sgstAmount = totalTax / 2;

  const handlePrint = () => {
    window.print();
  };

  const modalJSX = (
    <>
      {/* Dynamic Print Styles for A4 Full Page Invoice */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #a4-invoice-printable-area, #a4-invoice-printable-area * {
            visibility: visible !important;
          }
          #a4-invoice-printable-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 10mm !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto print:p-0 print:bg-transparent">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden print:max-w-none print:max-h-none print:shadow-none print:border-none print:rounded-none">
          
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
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-600/30 flex items-center gap-2 transition-all"
              >
                <Printer className="w-4 h-4" /> Save as PDF / Print A4 Invoice
              </button>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Printable Invoice Container */}
          <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-slate-100 print:bg-white print:p-0">
            <div
              id="a4-invoice-printable-area"
              ref={printContainerRef}
              className={`mx-auto bg-white p-8 md:p-12 shadow-md rounded-xl max-w-3xl text-slate-900 text-xs space-y-6 print:shadow-none print:rounded-none print:max-w-none ${
                isTally ? 'border-2 border-double border-slate-900' : 'border border-slate-200'
              }`}
              style={{
                fontFamily: fontFamily,
                backgroundColor: template.paperBgColor || '#ffffff',
                borderTop: isStylish || isCultureUp || isCultureGod ? `8px solid ${primaryColor}` : undefined,
              }}
            >
              {/* Culture God / UP Header tags */}
              {(isCultureGod || isCultureUp) && (
                <div className="text-center text-[11px] font-bold tracking-widest text-amber-800 bg-amber-50 py-1.5 rounded-md border border-amber-200 mb-2">
                  {isCultureGod ? '॥ श्री गणेशाय नमः ॥ शुभ लाभ ॥' : '॥ गंगा मैया की जय ॥ उत्तर प्रदेश शासन स्वीकृत ॥'}
                </div>
              )}

              {/* Recipient Copy Checkboxes */}
              {(isBillBook || isAdvGst) && (
                <div className="flex justify-between items-center text-[10px] text-slate-500 border-b border-dashed pb-2">
                  <span className="font-bold text-slate-700 uppercase tracking-wider">TAX INVOICE</span>
                  <div className="flex gap-4 font-semibold">
                    <span>[✓] Original for Recipient</span>
                    <span>[ ] Duplicate for Transporter</span>
                    <span>[ ] Triplicate for Supplier</span>
                  </div>
                </div>
              )}

              {/* Watermark Overlay */}
              {template.showWatermark && (
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0"
                  style={{ opacity: template.watermarkOpacity || 0.12 }}
                >
                  {template.watermarkType === 'image' && template.watermarkImage ? (
                    <img src={template.watermarkImage} alt="Watermark" className="max-w-[70%] max-h-[70%] object-contain" />
                  ) : (
                    <span className="text-7xl font-black uppercase tracking-widest text-slate-900 -rotate-45 whitespace-nowrap">
                      {template.watermarkText || 'PAID'}
                    </span>
                  )}
                </div>
              )}

              {/* Header Info: Store Details vs Invoice Header */}
              <div
                className={`flex items-start justify-between border-b pb-6 z-10 relative ${
                  isTally ? 'border-slate-900 border-b-2' : 'border-slate-200'
                }`}
                style={(!isTally && !isSimple && !isModern) ? { borderBottom: `2px solid ${primaryColor}` } : {}}
              >
                <div className="space-y-1.5 max-w-[60%]">
                  {f.showLogo && (
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="h-11 w-11 rounded-xl flex items-center justify-center text-white font-extrabold text-lg shadow-sm"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {template.storeName ? template.storeName.substring(0, 2).toUpperCase() : 'IS'}
                      </div>
                      <div>
                        <h2 className="font-extrabold text-base text-slate-900 leading-tight">
                          {template.storeName || 'LAZYMONKEY AI SUPERSTORE'}
                        </h2>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          Authorized Business Partner
                        </span>
                      </div>
                    </div>
                  )}

                  {!f.showLogo && (
                    <h2 className="font-extrabold text-lg mb-1" style={{ color: primaryColor }}>
                      {template.storeName || 'LAZYMONKEY AI SUPERSTORE'}
                    </h2>
                  )}

                  <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                    {template.storeAddress || 'KK Street, Proddatur, YSR Cuddapah, Andhra Pradesh, 516360'}
                  </p>
                  <p className="text-[11px] text-slate-600 font-medium">Ph: {template.storePhone || '+91 9849344919'}</p>
                  {(template.gstin || '37AABCCH694G1Z4') && (
                    <p className="text-[11px] font-bold text-slate-900">
                      GSTIN: {template.gstin || '37AABCCH694G1Z4'}
                    </p>
                  )}
                </div>

                <div className="text-right space-y-1">
                  <h1 className="text-2xl font-black tracking-tight uppercase" style={{ color: primaryColor }}>
                    {template.headerTitle || 'TAX INVOICE'}
                  </h1>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 inline-block text-right mt-1">
                    <p className="text-xs font-bold text-slate-900">Invoice No: {invoice.invoice_number || '#INV-2026/0809'}</p>
                    <p className="text-[11px] text-slate-600 font-medium">Date: {invoice.invoice_date || new Date().toLocaleDateString()}</p>
                    {invoice.due_date && <p className="text-[11px] text-slate-600 font-medium">Due Date: {invoice.due_date}</p>}
                    <p className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded mt-1 inline-block border border-emerald-200">
                      Status: {invoice.payment_status || 'PAID'} ({invoice.payment_method || 'Cash'})
                    </p>
                  </div>
                </div>
              </div>

              {/* Billed To / Party Details */}
              {f.showCustomerDetails && (
                <div
                  className={`grid grid-cols-2 gap-4 p-4 rounded-xl border z-10 relative ${
                    isModern ? 'bg-slate-50 border-slate-200' :
                    isLuxury ? 'bg-amber-50/40 border-amber-200' :
                    isTally ? 'bg-white border-slate-900' : 'bg-slate-50/80 border-slate-200'
                  }`}
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Billed To (Customer Details)</span>
                    <h4 className="font-bold text-slate-900 text-sm">{invoice.customerName || 'Walk-in Customer'}</h4>
                    {invoice.customerCompany && <p className="text-[11px] font-semibold text-slate-700">{invoice.customerCompany}</p>}
                    {invoice.customerAddress && <p className="text-[11px] text-slate-600 leading-relaxed">{invoice.customerAddress}</p>}
                    {invoice.customerPhone && <p className="text-[11px] text-slate-600">Ph: {invoice.customerPhone}</p>}
                    {invoice.customerEmail && <p className="text-[11px] text-slate-600">Email: {invoice.customerEmail}</p>}
                    {invoice.customerGST && <p className="text-[11px] font-bold text-slate-800">GSTIN: {invoice.customerGST}</p>}
                  </div>

                  <div className="text-right space-y-1 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Place of Supply</span>
                      <p className="text-[11px] font-bold text-slate-800 mt-0.5">Andhra Pradesh (37)</p>
                      {invoice.customerType && (
                        <p className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded inline-block border border-indigo-100 mt-1">
                          Category: {invoice.customerType}
                        </p>
                      )}
                    </div>
                    {f.showPartyBalance && (
                      <div className="text-[10px] font-bold text-slate-600 bg-white p-2 rounded-lg border border-slate-200 inline-block">
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
                      <th className="p-3 w-10 text-center">#</th>
                      <th className="p-3">Item Description</th>
                      {f.showHSN && <th className="p-3 text-center">HSN/SAC</th>}
                      <th className="p-3 text-center">Qty</th>
                      <th className="p-3 text-right">Unit Rate</th>
                      <th className="p-3 text-right">Discount</th>
                      {f.showTaxSplit && <th className="p-3 text-right">Tax Rate</th>}
                      <th className="p-3 text-right">Amount</th>
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
                          <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="p-3">
                            <span className="font-bold text-slate-900 block">{item.product_name || 'Item'}</span>
                            {mrpPrice > unitPrice && (
                              <span className="text-[10px] text-slate-500">MRP: ₹{mrpPrice.toFixed(2)}</span>
                            )}
                          </td>
                          {f.showHSN && <td className="p-3 text-center font-mono text-slate-600">{item.hsn_code || '9988'}</td>}
                          <td className="p-3 text-center font-extrabold text-slate-800">{qty}</td>
                          <td className="p-3 text-right font-medium text-slate-700">₹{unitPrice.toFixed(2)}</td>
                          <td className="p-3 text-right text-emerald-600 font-semibold">
                            {disc > 0 ? `-₹${disc.toFixed(2)}` : '—'}
                          </td>
                          {f.showTaxSplit && (
                            <td className="p-3 text-right text-slate-600">
                              {taxRate ? `${taxRate}%` : '5%'}
                            </td>
                          )}
                          <td className="p-3 text-right font-bold text-slate-900">₹{netAmount.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals & Bank Details */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-2 z-10 relative">
                <div className="md:col-span-7 space-y-4">
                  {f.showBankDetails && (
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Bank & Wire Transfer Details
                      </span>
                      <p className="text-[11px] text-slate-700 font-mono leading-relaxed whitespace-pre-line">
                        {template.bankDetails || 'Bank: SBI | A/C: 334455667788 | IFSC: SBIN0001234'}
                      </p>
                    </div>
                  )}

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Terms & Conditions</span>
                    <p className="text-[10px] text-slate-500 whitespace-pre-line leading-relaxed">
                      {template.termsText || '1. Goods once sold will not be taken back.\n2. All disputes subject to local jurisdiction.'}
                    </p>
                  </div>
                </div>

                <div className="md:col-span-5 bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2.5 text-xs text-slate-700">
                  <div className="flex justify-between font-semibold">
                    <span>Taxable Subtotal:</span>
                    <span className="text-slate-900">₹{Number(subtotal || 0).toFixed(2)}</span>
                  </div>

                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-semibold">
                      <span>Total Savings / Discount:</span>
                      <span>-₹{Number(totalDiscount || 0).toFixed(2)}</span>
                    </div>
                  )}

                  {f.showTaxSplit && (
                    <>
                      <div className="flex justify-between text-slate-500">
                        <span>CGST (2.5%):</span>
                        <span>₹{Number(cgstAmount || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>SGST (2.5%):</span>
                        <span>₹{Number(sgstAmount || 0).toFixed(2)}</span>
                      </div>
                    </>
                  )}

                  {/* Additional Charges (Freight, Packing, etc.) */}
                  {(invoice.additional_charges || []).filter(c => Number(c.amount) > 0).map((charge, idx) => (
                    <div key={idx} className="flex justify-between text-slate-600">
                      <span>{charge.name}:</span>
                      <span>+₹{Number(charge.amount || 0).toFixed(2)}</span>
                    </div>
                  ))}

                  {/* Round Off */}
                  {invoice.round_off !== undefined && invoice.round_off !== 0 && (
                    <div className="flex justify-between text-slate-500 italic">
                      <span>Round Off:</span>
                      <span>{Number(invoice.round_off || 0) >= 0 ? '+' : ''}₹{Number(invoice.round_off || 0).toFixed(2)}</span>
                    </div>
                  )}

                  <div
                    className="flex justify-between items-center pt-3 border-t-2 border-slate-300 font-black text-sm text-slate-900"
                    style={{ borderColor: primaryColor }}
                  >
                    <span>GRAND TOTAL:</span>
                    <span className="text-base" style={{ color: primaryColor }}>
                      ₹{Number(grandTotal || 0).toFixed(2)}
                    </span>
                  </div>

                  {/* Amount Received & Balance */}
                  {invoice.amount_received !== undefined && invoice.amount_received > 0 && (
                    <>
                      <div className="flex justify-between text-slate-600 font-semibold pt-1">
                        <span>Amount Received:</span>
                        <span className="text-emerald-700">₹{Number(invoice.amount_received).toFixed(2)}</span>
                      </div>
                      {Number(invoice.amount_received) >= grandTotal ? (
                        <div className="flex justify-between text-emerald-600 font-bold">
                          <span>Change Returned:</span>
                          <span>₹{(Number(invoice.amount_received) - grandTotal).toFixed(2)}</span>
                        </div>
                      ) : (
                        <div className="flex justify-between text-red-600 font-bold">
                          <span>Balance Due:</span>
                          <span>₹{(grandTotal - Number(invoice.amount_received)).toFixed(2)}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Signature & Footer */}
              <div className="pt-6 border-t border-slate-200 flex justify-between items-end z-10 relative">
                <div className="text-[10px] text-slate-500 max-w-[50%]">
                  <p className="font-semibold text-slate-700">{template.footerText || 'Thank you for your business!'}</p>
                  <p className="mt-1">Computer generated invoice. No signature required if authorized.</p>
                </div>

                {f.showSignature && (
                  <div className="text-center space-y-8">
                    <div className="h-10 border-b border-slate-300 w-44"></div>
                    <span className="text-[10px] font-bold text-slate-600 block uppercase tracking-wider">
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
