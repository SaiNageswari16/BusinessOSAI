'use client';

import React, { useState } from 'react';
import {
  Printer,
  X,
  MessageCircle,
  Copy,
  Check,
  Receipt,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCurrency } from '@/hooks/use-currency';
import { useTenant } from '@/contexts/tenant-context';
import { getActiveBillingGst, getTenantIdFromStorage } from '@/lib/receipt-template-store';
import { resolveImageUrl, invoicesApi } from '@/lib/api-client';
import { printHtmlInPage } from '@/lib/print-helper';
import { formatDisplayDate } from '@/lib/utils';

export interface InvoiceSettlementAllocation {
  invoice_id: string;
  realId?: string;
  invoice_number: string;
  invoice_date?: string;
  grand_total: number;
  previous_pending: number;
  amount_allocated: number;
  new_pending: number;
  status: 'fully_paid' | 'partially_paid' | 'unpaid';
}

export interface PaymentSettlementVoucher {
  id: string;
  voucher_number: string;
  payment_date: string;
  party_id: string;
  party_name: string;
  party_phone?: string;
  party_email?: string;
  party_address?: string;
  party_gstin?: string;
  party_type?: 'customer' | 'vendor' | string;
  payment_amount: number;
  payment_mode: string;
  payment_purpose?: 'settle_due' | 'wallet_topup' | 'wallet_debit' | string;
  notes?: string;

  // Ledger summary
  previous_total_dues: number;
  total_allocated: number;
  remaining_advance: number;
  new_total_remaining_dues: number;

  // Detailed breakdown of each invoice covered
  covered_invoices: InvoiceSettlementAllocation[];

  created_at?: string;
}

interface PaymentSettlementReceiptModalProps {
  voucher: PaymentSettlementVoucher | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PaymentSettlementReceiptModal({
  voucher,
  isOpen,
  onClose,
}: PaymentSettlementReceiptModalProps) {
  const { tenant } = useTenant();
  const { currency, formatCurrency } = useCurrency();
  const [printFormat, setPrintFormat] = useState<'a4' | 'thermal'>('a4');
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen || !voucher) return null;

  const tid = tenant?.id || getTenantIdFromStorage();
  const activeGst = getActiveBillingGst(tid);
  const tenantRaw = (tenant as any)?.raw || {};
  const tenantSettings = (tenant as any)?.settings || tenantRaw?.settings || {};

  // Store information resolution
  const storeName =
    activeGst?.trade_name ||
    activeGst?.legal_name ||
    tenant?.name ||
    tenantRaw?.name ||
    'Business Organization';

  const storeAddress =
    activeGst?.address ||
    tenantRaw?.address ||
    tenantSettings?.address ||
    '';

  const storePhone =
    activeGst?.phone ||
    tenantRaw?.phone ||
    tenantSettings?.phone ||
    '';

  const storeEmail =
    activeGst?.email ||
    tenantRaw?.email ||
    tenantSettings?.email ||
    '';

  const storeGstin =
    activeGst?.gstin ||
    tenantRaw?.gst_number ||
    tenantRaw?.gstin ||
    tenantSettings?.gstin ||
    '';

  // Covered invoices list (filter to only ones with previous pending dues or touched)
  const coveredList = (voucher.covered_invoices || []).filter(
    (inv) => inv.previous_pending > 0 || inv.amount_allocated > 0
  );

  const formattedDate = voucher.payment_date
    ? formatDisplayDate(voucher.payment_date)
    : formatDisplayDate(new Date().toISOString());

  // Build clean WhatsApp message text
  const generateWhatsAppMessage = (): string => {
    const lines = [
      `🧾 *PAYMENT RECEIPT — ${storeName}*`,
      `--------------------------------`,
      `*Receipt #:* \`${voucher.voucher_number}\``,
      `*Date:* ${formattedDate}`,
      `*Customer:* ${voucher.party_name}`,
      `*Payment Mode:* ${voucher.payment_mode || 'Cash'}`,
      `--------------------------------`,
      `💰 *AMOUNT RECEIVED: ${currency.symbol}${voucher.payment_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}*`,
      `--------------------------------`,
    ];

    if (coveredList.length > 0) {
      lines.push(`📑 *INVOICES COVERED & BALANCES:*`);
      coveredList.forEach((inv) => {
        const allocStr = `${currency.symbol}${inv.amount_allocated.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        const remStr = `${currency.symbol}${inv.new_pending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        const prevStr = `${currency.symbol}${inv.previous_pending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

        if (inv.amount_allocated >= inv.previous_pending && inv.previous_pending > 0) {
          lines.push(`• *#${inv.invoice_number}*: Paid ${allocStr} (Was: ${prevStr}) ✅ *[Fully Paid]*`);
        } else if (inv.amount_allocated > 0) {
          lines.push(`• *#${inv.invoice_number}*: Paid ${allocStr} | *Remaining: ${remStr}* ⚠️ *[Partially Paid]*`);
        } else {
          lines.push(`• *#${inv.invoice_number}*: Remaining ${remStr} ⏳ *[Pending]*`);
        }
      });
      lines.push(`--------------------------------`);
    }

    lines.push(`📊 *LEDGER DUE SUMMARY:*`);
    lines.push(`• Previous Outstanding: ${currency.symbol}${voucher.previous_total_dues.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    lines.push(`• Paid in this Receipt: ${currency.symbol}${voucher.payment_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    lines.push(`• *TOTAL REMAINING DUES: ${currency.symbol}${voucher.new_total_remaining_dues.toLocaleString('en-IN', { minimumFractionDigits: 2 })}*`);

    if (voucher.remaining_advance > 0) {
      lines.push(`• *Surplus Advance Credited to Wallet: ${currency.symbol}${voucher.remaining_advance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}*`);
    }

    if (voucher.notes) {
      lines.push(`• Remarks: ${voucher.notes}`);
    }

    lines.push(`--------------------------------`);
    lines.push(`Thank you for your business!`);
    if (storePhone) lines.push(`Contact: ${storePhone}`);

    return lines.join('\n');
  };

  const handleCopyWhatsApp = () => {
    const text = generateWhatsAppMessage();
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    toast.success('Formatted receipt details copied to clipboard!');
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleSendWhatsApp = () => {
    const text = generateWhatsAppMessage();
    const phone = (voucher.party_phone || '').replace(/\D/g, '');
    const cleanPhone = phone.length === 10 ? `91${phone}` : phone;

    // Trigger backend automated WhatsApp gateway dispatch if available
    if (cleanPhone) {
      invoicesApi.sendSettlementWhatsApp({
        recipient_phone: cleanPhone,
        customer_name: voucher.party_name,
        voucher_number: voucher.voucher_number,
        payment_amount: voucher.payment_amount,
        payment_method: voucher.payment_mode || 'Cash',
        payment_date: formattedDate,
        covered_invoices: voucher.covered_invoices,
        previous_total_dues: voucher.previous_total_dues,
        new_remaining_dues: voucher.new_total_remaining_dues,
        wallet_surplus: voucher.remaining_advance,
      }).then(() => {
        toast.success('Dispatched settlement receipt via automated WhatsApp gateway!');
      }).catch(() => {
        // Fallback to WhatsApp Web link without disruption
      });
    }

    const url = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Generate A4 HTML Printable Receipt
  const generateA4Html = (): string => {
    const itemsHtml = coveredList
      .map(
        (inv) => `
        <tr style="border-bottom: 1px solid #e2e8f0; ${inv.amount_allocated > 0 ? 'background-color: #f8fafc;' : ''}">
          <td style="padding: 10px 12px; font-weight: bold; color: #1e293b;">
            #${inv.invoice_number}
            <div style="font-size: 11px; color: #64748b; font-weight: normal;">${inv.invoice_date ? formatDisplayDate(inv.invoice_date) : ''}</div>
          </td>
          <td style="padding: 10px 12px; text-align: right; color: #475569;">
            ${currency.symbol}${inv.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </td>
          <td style="padding: 10px 12px; text-align: right; color: #64748b;">
            ${currency.symbol}${inv.previous_pending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </td>
          <td style="padding: 10px 12px; text-align: right; font-weight: bold; color: #059669;">
            ${inv.amount_allocated > 0 ? `${currency.symbol}${inv.amount_allocated.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
          </td>
          <td style="padding: 10px 12px; text-align: right; font-weight: bold; color: ${inv.new_pending > 0 ? '#b91c1c' : '#059669'};">
            ${currency.symbol}${inv.new_pending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </td>
          <td style="padding: 10px 12px; text-align: center;">
            <span style="display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; ${
              inv.amount_allocated >= inv.previous_pending && inv.previous_pending > 0
                ? 'background-color: #dcfce7; color: #15803d;'
                : inv.amount_allocated > 0
                ? 'background-color: #fef3c7; color: #b45309;'
                : 'background-color: #f1f5f9; color: #64748b;'
            }">
              ${
                inv.amount_allocated >= inv.previous_pending && inv.previous_pending > 0
                  ? 'Fully Settled'
                  : inv.amount_allocated > 0
                  ? 'Partially Paid'
                  : 'Pending'
              }
            </span>
          </td>
        </tr>
      `
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Payment Receipt #${voucher.voucher_number}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 20px;
            background: #ffffff;
            font-size: 13px;
            line-height: 1.5;
          }
          .receipt-container {
            max-width: 800px;
            margin: 0 auto;
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            padding: 28px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 18px;
            margin-bottom: 20px;
          }
          .org-title { font-size: 20px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin: 0; }
          .badge {
            display: inline-block;
            background: #0f172a;
            color: #ffffff;
            padding: 4px 12px;
            border-radius: 6px;
            font-weight: 700;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .table { width: 100%; border-collapse: collapse; margin: 16px 0; }
          .table th {
            background-color: #f1f5f9;
            color: #334155;
            font-weight: 700;
            padding: 10px 12px;
            text-align: left;
            border-bottom: 2px solid #cbd5e1;
            font-size: 12px;
          }
          .summary-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="header">
            <div>
              <h1 class="org-title">${storeName}</h1>
              ${storeGstin ? `<div style="font-weight: 600; color: #475569; margin-top: 4px;">GSTIN: ${storeGstin}</div>` : ''}
              ${storeAddress ? `<div style="color: #64748b; font-size: 12px; max-width: 450px;">${storeAddress}</div>` : ''}
              ${storePhone ? `<div style="color: #64748b; font-size: 12px;">Phone: ${storePhone} ${storeEmail ? `| Email: ${storeEmail}` : ''}</div>` : ''}
            </div>
            <div style="text-align: right;">
              <span class="badge">Payment In Receipt</span>
              <div style="font-size: 18px; font-weight: 800; font-family: monospace; margin-top: 8px; color: #0f172a;">#${voucher.voucher_number}</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Date: <strong>${formattedDate}</strong></div>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Mode: <strong>${voucher.payment_mode || 'Cash'}</strong></div>
            </div>
          </div>

          <!-- Customer Details Box -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; display: flex; justify-content: space-between;">
            <div>
              <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b;">Received From (Customer):</div>
              <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 2px;">${voucher.party_name}</div>
              ${voucher.party_phone ? `<div style="color: #475569; font-size: 12px; margin-top: 2px;">Phone: ${voucher.party_phone}</div>` : ''}
              ${voucher.party_address ? `<div style="color: #64748b; font-size: 12px;">Address: ${voucher.party_address}</div>` : ''}
            </div>
            <div style="text-align: right;">
              <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b;">Amount Received:</div>
              <div style="font-size: 24px; font-weight: 900; color: #059669; margin-top: 2px;">
                ${currency.symbol}${voucher.payment_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div style="font-size: 11px; color: #10b981; font-weight: 600;">Payment Confirmed & Settled</div>
            </div>
          </div>

          <!-- Invoices Covered Table -->
          ${
            coveredList.length > 0
              ? `
            <div style="margin-bottom: 8px; font-weight: 700; color: #1e293b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">
              Invoice Settlement Breakdown
            </div>
            <table class="table">
              <thead>
                <tr>
                  <th>Invoice # / Date</th>
                  <th style="text-align: right;">Bill Total</th>
                  <th style="text-align: right;">Previous Due</th>
                  <th style="text-align: right;">Paid Now</th>
                  <th style="text-align: right;">New Balance Due</th>
                  <th style="text-align: center;">Settlement Status</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
          `
              : `
            <div style="padding: 16px; background-color: #f1f5f9; border-radius: 8px; text-align: center; color: #475569; font-weight: 600; margin-bottom: 20px;">
              Direct Account / Wallet Advance Deposit (No outstanding bills attached).
            </div>
          `
          }

          <!-- Overall Ledger Due Summary -->
          <div class="summary-card">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0;">
              <span style="color: #64748b;">Total Outstanding Before Payment:</span>
              <span style="font-weight: 700; color: #0f172a;">${currency.symbol}${voucher.previous_total_dues.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0;">
              <span style="color: #64748b;">Amount Applied in This Receipt:</span>
              <span style="font-weight: 700; color: #059669;">-${currency.symbol}${voucher.payment_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            ${
              voucher.remaining_advance > 0
                ? `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; color: #7c3aed;">
                <span>Surplus Advance Added to Customer Wallet:</span>
                <span style="font-weight: 700;">+${currency.symbol}${voucher.remaining_advance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            `
                : ''
            }
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0 0 0; margin-top: 8px; border-top: 2px solid #cbd5e1;">
              <span style="font-size: 15px; font-weight: 800; color: #0f172a;">Net Total Remaining Customer Balance:</span>
              <span style="font-size: 18px; font-weight: 900; color: #b91c1c;">${currency.symbol}${voucher.new_total_remaining_dues.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          ${
            voucher.notes
              ? `<div style="margin-top: 16px; font-size: 12px; color: #64748b;"><strong>Notes:</strong> ${voucher.notes}</div>`
              : ''
          }

          <!-- Signatory footer -->
          <div style="margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div style="font-size: 11px; color: #94a3b8;">
              System Generated Verification Receipt<br>
              BusinessOS Live Multi-Tenant ERP
            </div>
            <div style="text-align: center; border-top: 1px solid #cbd5e1; padding-top: 6px; width: 200px;">
              <div style="font-weight: 700; font-size: 12px; color: #0f172a;">Authorized Signatory</div>
              <div style="font-size: 11px; color: #64748b;">For ${storeName}</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  // Generate Thermal Slip HTML (80mm)
  const generateThermalHtml = (): string => {
    const itemsRows = coveredList
      .map(
        (inv) => `
        <div style="border-bottom: 1px dashed #cbd5e1; padding: 4px 0; font-size: 11px;">
          <div style="display: flex; justify-content: space-between; font-weight: bold;">
            <span>#${inv.invoice_number}</span>
            <span>Paid: ${currency.symbol}${inv.amount_allocated.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; color: #475569; font-size: 10px; margin-top: 2px;">
            <span>Was: ${currency.symbol}${inv.previous_pending.toFixed(2)}</span>
            <span style="color: ${inv.new_pending > 0 ? '#b91c1c' : '#059669'}; font-weight: bold;">
              Rem: ${currency.symbol}${inv.new_pending.toFixed(2)} (${inv.new_pending <= 0.05 ? 'PAID' : 'PARTIAL'})
            </span>
          </div>
        </div>
      `
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { size: 80mm auto; margin: 3mm; }
          body {
            font-family: monospace, sans-serif;
            margin: 0;
            padding: 4px;
            color: #000000;
            font-size: 12px;
            line-height: 1.35;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-bottom: 1px dashed #000000; margin: 6px 0; }
          .double-divider { border-bottom: 2px solid #000000; margin: 6px 0; }
          .flex { display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="center bold" style="font-size: 15px;">${storeName}</div>
        ${storeGstin ? `<div class="center" style="font-size: 11px;">GSTIN: ${storeGstin}</div>` : ''}
        ${storeAddress ? `<div class="center" style="font-size: 10px;">${storeAddress}</div>` : ''}
        ${storePhone ? `<div class="center" style="font-size: 10px;">Ph: ${storePhone}</div>` : ''}
        
        <div class="divider"></div>
        <div class="center bold" style="font-size: 13px;">PAYMENT IN RECEIPT</div>
        <div class="divider"></div>

        <div class="flex"><span>Voucher:</span><span class="bold">#${voucher.voucher_number}</span></div>
        <div class="flex"><span>Date:</span><span>${formattedDate}</span></div>
        <div class="flex"><span>Customer:</span><span class="bold">${voucher.party_name}</span></div>
        <div class="flex"><span>Mode:</span><span>${voucher.payment_mode || 'Cash'}</span></div>

        <div class="double-divider"></div>
        <div class="flex bold" style="font-size: 14px;">
          <span>AMOUNT PAID:</span>
          <span>${currency.symbol}${voucher.payment_amount.toFixed(2)}</span>
        </div>
        <div class="double-divider"></div>

        ${
          coveredList.length > 0
            ? `
          <div class="bold" style="font-size: 11px; margin-bottom: 4px;">INVOICES COVERED & BALANCES:</div>
          ${itemsRows}
          <div class="divider"></div>
        `
            : ''
        }

        <div class="flex"><span>Previous Dues:</span><span>${currency.symbol}${voucher.previous_total_dues.toFixed(2)}</span></div>
        <div class="flex"><span>Paid Now:</span><span>-${currency.symbol}${voucher.payment_amount.toFixed(2)}</span></div>
        ${
          voucher.remaining_advance > 0
            ? `<div class="flex bold"><span>Wallet Credit:</span><span>+${currency.symbol}${voucher.remaining_advance.toFixed(2)}</span></div>`
            : ''
        }
        <div class="divider"></div>
        <div class="flex bold" style="font-size: 13px;">
          <span>REMAINING DUE:</span>
          <span>${currency.symbol}${voucher.new_total_remaining_dues.toFixed(2)}</span>
        </div>
        <div class="double-divider"></div>

        <div class="center" style="font-size: 11px; margin-top: 8px;">
          Thank you for your payment!<br>
          Authorized Signatory
        </div>
      </body>
      </html>
    `;
  };

  const handlePrint = () => {
    const html = printFormat === 'a4' ? generateA4Html() : generateThermalHtml();
    printHtmlInPage(html, 250);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header Bar */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Payment In Settlement Receipt</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-emerald-500/20 text-emerald-300 font-bold">
                  #{voucher.voucher_number}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Official itemized collection audit for {voucher.party_name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Format toggle: A4 vs Thermal */}
            <div className="flex bg-slate-800 p-0.5 rounded-lg text-xs font-bold text-slate-300">
              <button
                type="button"
                onClick={() => setPrintFormat('a4')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  printFormat === 'a4'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'hover:text-white'
                }`}
              >
                Standard A4
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('thermal')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  printFormat === 'thermal'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'hover:text-white'
                }`}
              >
                POS Thermal Slip
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-2"
              title="Close receipt modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          {/* Main Visual Receipt Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
            {/* Organization & Receipt Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-6 border-b border-slate-200 gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                  {storeName}
                </h2>
                {storeGstin && (
                  <p className="text-xs font-bold text-slate-600 mt-0.5">
                    GSTIN: <span className="font-mono">{storeGstin}</span>
                  </p>
                )}
                {storeAddress && (
                  <p className="text-xs text-slate-500 max-w-md mt-1">
                    {storeAddress}
                  </p>
                )}
                {storePhone && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ph: {storePhone} {storeEmail ? `| ${storeEmail}` : ''}
                  </p>
                )}
              </div>

              <div className="sm:text-right space-y-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  <ShieldCheck className="w-3.5 h-3.5" /> Confirmed Collection
                </span>
                <p className="text-sm font-mono font-black text-slate-900 mt-2">
                  Receipt #{voucher.voucher_number}
                </p>
                <p className="text-xs text-slate-500">
                  Date: <strong>{formattedDate}</strong>
                </p>
                <p className="text-xs text-slate-500">
                  Tender Mode: <strong>{voucher.payment_mode || 'Cash'}</strong>
                </p>
              </div>
            </div>

            {/* Customer Box + Amount Received Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  Received From (Customer)
                </span>
                <h4 className="text-base font-black text-slate-900">
                  {voucher.party_name}
                </h4>
                {voucher.party_phone && (
                  <p className="text-xs text-slate-600 font-mono">
                    Phone: {voucher.party_phone}
                  </p>
                )}
                {voucher.party_address && (
                  <p className="text-xs text-slate-500">
                    Address: {voucher.party_address}
                  </p>
                )}
              </div>

              <div className="sm:text-right space-y-1 flex flex-col sm:items-end justify-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  Amount Received in this Receipt
                </span>
                <div className="text-3xl font-black text-emerald-600 tracking-tight">
                  {formatCurrency(voucher.payment_amount)}
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full inline-block">
                  Double-Entry Ledger Settled
                </span>
              </div>
            </div>

            {/* Invoices Covered Breakdown Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Covered Invoices & Allocation Breakdown
                </h4>
                <span className="text-xs text-slate-500">
                  {coveredList.length} invoice(s) tracked
                </span>
              </div>

              {coveredList.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="py-2.5 px-3">Invoice # / Date</th>
                        <th className="py-2.5 px-3 text-right">Bill Total</th>
                        <th className="py-2.5 px-3 text-right">Previous Due</th>
                        <th className="py-2.5 px-3 text-right text-emerald-700">Paid Now</th>
                        <th className="py-2.5 px-3 text-right">New Balance Due</th>
                        <th className="py-2.5 px-3 text-center">Settlement Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {coveredList.map((inv) => {
                        const isFullyPaid =
                          inv.amount_allocated >= inv.previous_pending &&
                          inv.previous_pending > 0;
                        const isPartial = inv.amount_allocated > 0 && !isFullyPaid;

                        return (
                          <tr
                            key={inv.invoice_id || inv.invoice_number}
                            className={
                              inv.amount_allocated > 0
                                ? 'bg-emerald-50/15'
                                : 'bg-white'
                            }
                          >
                            <td className="py-3 px-3">
                              <span className="font-bold text-slate-900 font-mono">
                                #{inv.invoice_number}
                              </span>
                              {inv.invoice_date && (
                                <span className="text-[11px] text-slate-400 block mt-0.5">
                                  {formatDisplayDate(inv.invoice_date)}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right text-slate-600">
                              {formatCurrency(inv.grand_total)}
                            </td>
                            <td className="py-3 px-3 text-right text-slate-600">
                              {formatCurrency(inv.previous_pending)}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-emerald-700">
                              {inv.amount_allocated > 0
                                ? `+${formatCurrency(inv.amount_allocated)}`
                                : '—'}
                            </td>
                            <td
                              className={`py-3 px-3 text-right font-black ${
                                inv.new_pending <= 0.05
                                  ? 'text-emerald-700'
                                  : 'text-rose-700'
                              }`}
                            >
                              {formatCurrency(inv.new_pending)}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                  isFullyPaid
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isPartial
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {isFullyPaid
                                  ? 'Fully Settled ✅'
                                  : isPartial
                                  ? 'Partially Covered ⚠️'
                                  : 'Pending ⏳'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                  Direct wallet top-up / unallocated customer advance payment.
                </div>
              )}
            </div>

            {/* Total Balance Audit Box */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Total Outstanding Balance Prior to Receipt:</span>
                <span className="font-bold text-slate-900">
                  {formatCurrency(voucher.previous_total_dues)}
                </span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-emerald-700">
                <span>Total Amount Paid in this Receipt:</span>
                <span className="font-black">
                  -{formatCurrency(voucher.payment_amount)}
                </span>
              </div>
              {voucher.remaining_advance > 0 && (
                <div className="flex justify-between text-xs font-semibold text-purple-700">
                  <span>Surplus Overpayment Credited to Customer Wallet:</span>
                  <span className="font-black">
                    +{formatCurrency(voucher.remaining_advance)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Net Total Remaining Customer Balance:</span>
                <span className="text-base font-black text-rose-700">
                  {formatCurrency(voucher.new_total_remaining_dues)}
                </span>
              </div>
            </div>

            {voucher.notes && (
              <p className="text-xs text-slate-500 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                <strong>Remarks / Notes:</strong> {voucher.notes}
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* WhatsApp Send button */}
            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
              title="Open WhatsApp to send receipt breakdown directly"
            >
              <MessageCircle className="w-4 h-4" />
              Send to Customer WhatsApp
            </button>

            {/* Copy details button */}
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors"
              title="Copy receipt summary for messaging"
            >
              {isCopied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Breakdown
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print Receipt ({printFormat === 'a4' ? 'A4' : 'Thermal'})
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors"
            >
              Done / Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
