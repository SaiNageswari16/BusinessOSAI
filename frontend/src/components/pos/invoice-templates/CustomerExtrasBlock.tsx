import React from 'react';
import type { InvoiceTexts } from '@/lib/invoice-template-config';
import { formatDisplayDate } from '@/lib/utils';

/**
 * Shared, conditional customer-details block: Gender / Date of Birth / Age.
 * Rendered inside a theme's customer/party section ONLY when the value is
 * present on the invoice (set at billing time from the selected CRM customer).
 * Pass `texts` so the labels stay fully editable per template.
 */
export function CustomerExtrasBlock({
  invoice,
  texts,
  className = '',
}: {
  invoice: any;
  texts: InvoiceTexts;
  className?: string;
}) {
  const gender = String(invoice?.customerGender || '').trim();
  const dob = String(invoice?.customerDOB || '').trim();
  const age = invoice?.customerAge != null ? Number(invoice.customerAge) : null;

  const rows: Array<{ label: string; value: React.ReactNode }> = [];
  if (gender) rows.push({ label: texts.partyGenderLabel, value: gender });
  if (dob) rows.push({ label: texts.partyDobLabel, value: formatDisplayDate(dob) });
  if (age != null && Number.isFinite(age)) rows.push({ label: texts.partyAgeLabel, value: String(age) });

  if (rows.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-0.5 text-[9px] ${className}`}>
      {rows.map((r) => (
        <span key={r.label}>
          <span className="font-bold">{r.label}:</span> <span className="font-mono">{r.value}</span>
        </span>
      ))}
    </div>
  );
}
