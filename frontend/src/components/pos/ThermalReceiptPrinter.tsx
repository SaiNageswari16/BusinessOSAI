'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { getActiveReceiptTemplate, ReceiptTemplate } from '../../lib/receipt-template-store';

interface ThermalReceiptPrinterProps {
  bill: {
    id?: string;
    rawId?: string;
    invoice_number?: string;
    date?: string | Date;
    customer_id?: string;
    customerName?: string;
    customerPhone?: string;
    customer_phone?: string;
    items?: Array<{
      product_id?: string;
      name?: string;
      product_name?: string;
      hsn_code?: string;
      sku?: string;
      quantity: number;
      unit_price?: number;
      price?: number;
      subtotal?: number;
      discount?: number;
      tax_rate?: number;
    }>;
    subtotal?: number;
    tax?: number;
    tax_amount?: number;
    discount?: number;
    discount_amount?: number;
    total?: number;
    grand_total?: number;
    payment_method?: string;
    payment_status?: string;
  } | null;
  customTemplate?: ReceiptTemplate;
}

export function ThermalReceiptPrinter({ bill, customTemplate }: ThermalReceiptPrinterProps) {
  if (!bill) return null;
  if (typeof document === 'undefined') return null;

  // Retrieve Active Inventory Print Template
  let invTemplate: any = null;
  try {
    const rawInv = localStorage.getItem('businessos_print_templates_v1');
    const rawActive = localStorage.getItem('user_active_print_templates_v1');
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
  const templateName = invTemplate?.name || fallbackStore.name || 'Express POS Receipt (80mm Thermal)';
  const storeName = invTemplate?.storeName || fallbackStore.storeName || 'LAZYMONKEY AI SUPERSTORE';
  const storeAddress = invTemplate?.storeAddress || fallbackStore.address || 'Main Market, MG Road, Bengaluru';
  const storePhone = invTemplate?.storePhone || fallbackStore.phone || 'Ph: 080-25589999';
  const gstin = invTemplate?.gstin || fallbackStore.gstin || '29ABCDE1234F1ZH';
  const headerTitle = invTemplate?.headerTitle || fallbackStore.invoiceTitle || 'RETAIL RECEIPT';
  const footerText = invTemplate?.footerText || fallbackStore.footerNote || '*** THANK YOU FOR SHOPPING ***\nVisit us again at www.lazymonkeyai.com';
  const termsText = invTemplate?.termsText || fallbackStore.declarationText || '';

  const f = invTemplate?.fields || {
    showLogo: true,
    showStoreAddress: true,
    showTaxSplit: true,
    showCustomerDetails: true,
    showProductName: true,
    showPrice: true,
    showMRP: true,
    showSKU: true,
    showHSN: true,
    showPartyBalance: true,
    showItemDescription: true,
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
      className="bg-white text-black p-1 font-mono text-[11px] leading-tight select-none relative"
      style={{
        width: printableWidth,
        maxWidth: printableWidth,
        margin: '0 auto',
        fontFamily: "'Courier New', Courier, monospace"
      }}
    >
      {/* Header */}
      <div className="text-center border-b border-dashed border-black pb-2">
        {f.showLogo && (
          <div className="mx-auto h-7 w-7 bg-black text-white font-bold flex items-center justify-center text-xs rounded mb-1">
            IS
          </div>
        )}
        <h2 className="font-bold text-sm tracking-widest uppercase">{storeName}</h2>
        {f.showStoreAddress && storeAddress && (
          <p className="text-[10px] mt-0.5 whitespace-pre-line">{storeAddress}</p>
        )}
        {storePhone && <p className="text-[10px]">{storePhone}</p>}
        {gstin && (
          <p className="text-[10px] font-bold mt-0.5">GSTIN: {gstin}</p>
        )}
        <h3 className="font-bold border border-black inline-block px-2 py-0.5 mt-2 text-[10px] uppercase">
          {headerTitle}
        </h3>
      </div>

      {/* Transaction Meta */}
      <div className="text-[10px] border-b border-dashed border-black py-1.5 space-y-0.5">
        <div className="flex justify-between">
          <span>Bill No: {invoiceNum}</span>
          <span>Date: {dateStr}</span>
        </div>
        {f.showTime && (
          <div className="flex justify-between">
            <span>Time: {timeStr}</span>
            <span>Cashier: Admin</span>
          </div>
        )}
        {f.showCustomerDetails && (
          <div className="text-[9px] text-slate-800 mt-1 border-t border-dashed border-black/30 pt-1">
            <span>Customer: {customerName}</span>
            {f.showPartyBalance && (
              <span className="block text-red-700 font-bold mt-0.5">O/S Balance: ₹14,200.00</span>
            )}
          </div>
        )}
      </div>

      {/* Item Table */}
      <table className="w-full text-left text-[10px] my-1">
        <thead>
          <tr className="border-b border-black">
            <th className="pb-1">ITEM</th>
            <th className="pb-1 text-center">QTY</th>
            <th className="pb-1 text-right">PRICE</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-dashed divide-black/40">
          {items.map((item, idx) => {
            const name = item.name || item.product_name || `Item ${idx + 1}`;
            const qty = item.quantity || 1;
            const rate = item.unit_price || item.price || (qty > 0 ? (item.subtotal || 0) / qty : 0);
            const lineAmt = item.subtotal || (qty * rate) - (item.discount || 0);

            return (
              <tr key={idx}>
                <td className="py-1 pr-1">
                  {name}
                  {f.showSKU && item.sku && <span className="block text-[8px] text-slate-600">SKU: {item.sku}</span>}
                  {f.showHSN && item.hsn_code && <span className="block text-[8px] text-slate-600">HSN: {item.hsn_code}</span>}
                </td>
                <td className="py-1 text-center font-bold align-top">{qty}</td>
                <td className="py-1 text-right font-bold align-top">{lineAmt.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals */}
      <div className="border-t border-dashed border-black pt-1.5 space-y-0.5 text-[11px]">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{rawSubtotal.toFixed(2)}</span>
        </div>
        {f.showTaxSplit && (
          <div className="flex justify-between text-[9px] text-slate-700">
            <span>CGST 2.5% + SGST 2.5%:</span>
            <span>{rawTax.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-sm border-t border-black pt-1 mt-1">
          <span>TOTAL AMOUNT:</span>
          <span>₹{grandTotal.toFixed(2)}</span>
        </div>
      </div>

      {/* Payment Mode */}
      {bill.payment_method && (
        <div className="flex justify-between text-[9.5px] font-bold mt-1.5 border-t border-dashed border-black pt-1">
          <span>PAYMENT MODE:</span>
          <span className="uppercase">{bill.payment_method} ({bill.payment_status || 'PAID'})</span>
        </div>
      )}

      {/* Payment QR */}
      {f.showPaymentQR && (
        <div className="flex flex-col items-center justify-center pt-2 my-1 border-t border-dashed border-black text-center">
          <div className="h-14 w-14 bg-black p-1 rounded flex items-center justify-center text-white text-[8px] font-bold">
            [ UPI QR ]
          </div>
          <span className="text-[8px] mt-1 font-semibold">Scan to pay via UPI</span>
        </div>
      )}

      {/* Terms & Footer */}
      {termsText && (
        <div className="text-[8.5px] text-justify mt-1.5 border-t border-dashed border-black pt-1 leading-tight">
          <span className="font-bold">Declaration:</span> {termsText}
        </div>
      )}

      {footerText && (
        <div className="text-center font-bold text-[9px] mt-1.5 whitespace-pre-line leading-tight border-t border-black pt-1">
          {footerText}
        </div>
      )}
    </div>,
    document.body
  );
}
