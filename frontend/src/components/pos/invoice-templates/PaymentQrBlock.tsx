import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { InvoiceTexts } from '@/lib/invoice-template-config';

export interface PaymentQrContext {
  enabled: boolean;
  src: string;
  vpa: string;
  targetAmount: number;
  balanceDue: number;
  isPaidInFull: boolean;
}

interface PaymentQrBlockProps {
  paymentQr: PaymentQrContext;
  texts: InvoiceTexts;
  currency: { symbol: string; code: string };
  compact?: boolean;
}

/**
 * Shared, option-gated payment-QR / paid-in-full block. Every A4 theme renders
 * this instead of hard-coding a QR, so the "UPI QR" template option (f.showQR)
 * and the org setting consistently control it. When `paymentQr.enabled` is
 * false (option unchecked or org disabled), nothing renders.
 */
export function PaymentQrBlock({ paymentQr, texts, currency, compact }: PaymentQrBlockProps) {
  if (!paymentQr?.enabled || !paymentQr?.src) return null;

  return (
    <div className={`flex items-center gap-3 p-2 bg-purple-50/80 border border-purple-200 rounded-xl print:border-slate-300 ${compact ? 'scale-90' : ''}`}>
      <div className="p-1 bg-white border border-purple-200 rounded-lg shrink-0 shadow-2xs">
        <img
          src={paymentQr.src}
          alt="Payment QR"
          className={`${compact ? 'size-12' : 'size-16'} object-contain`}
        />
      </div>
      <div className="space-y-0.5 min-w-0">
        <span className="text-[9px] font-black uppercase tracking-wider text-purple-900 block">
          {texts.scanToPayLabel} {paymentQr.balanceDue > 0 ? '· Balance Due' : ''}
        </span>
        <span className="text-[13px] font-black text-slate-900 block leading-tight">
          {currency.symbol}{paymentQr.targetAmount.toFixed(2)}
        </span>
        {paymentQr.vpa && (
          <span className="text-[9.5px] font-mono text-purple-700 block truncate font-bold">
            {texts.upiLabel}: {paymentQr.vpa}
          </span>
        )}
        <span className="text-[8px] text-slate-500 block leading-tight">
          Scan with GPay, PhonePe, Paytm, BHIM & any UPI app
        </span>
      </div>

      {paymentQr.isPaidInFull && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800">
          <CheckCircle2 className="size-3.5 text-emerald-600" />
          <span className="text-[9px] font-bold">PAID IN FULL</span>
        </span>
      )}
    </div>
  );
}
