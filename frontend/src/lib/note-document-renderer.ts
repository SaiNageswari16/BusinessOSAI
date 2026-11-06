/**
 * Shared renderer for Credit Note / Debit Note printing.
 *
 * The "actually use it anywhere" requirement: when the user has selected a
 * print template for the `credit_note` / `debit_note` document category
 * (via the Print & Document Templates strip), the note is rendered with that
 * template's branding (primary color, font, logo, terms, UPI QR, bank
 * details, signature) and label overrides. When no template is selected the
 * renderer falls back to a clean uniform layout using the active billing GST
 * branding (primary color #4f46e5), so printing never crashes either way.
 *
 * Callers (procurement + POS credit/debit note components) do:
 *   const tpl = resolveNotePrintTemplate("credit_note" | "debit_note", tenantId);
 *   const html = renderNoteDocument(kind, note, company, tpl);
 *   printHtmlInPage(html, 300);
 *
 * `resolveNotePrintTemplate` returns `null` when nothing is selected (or the
 * parallel keys in receipt-template-store haven't landed yet) — the renderer
 * treats `null` as "use the billing-GST fallback" and never throws.
 */

import {
  getActiveBillingGst,
  getActiveInvoicePrintTemplateForCategory,
  getOrgPaymentQrSettings,
  getTenantIdFromStorage,
  getTenantTemplatesKey,
} from './receipt-template-store';
import { buildUpiPayUrl, generateQRCodeSVG } from './qr-generator';

export type NoteKind = 'credit_note' | 'debit_note';

/**
 * Minimal structural type for the template object passed in. Mirrors the
 * invoice print-template shape (primaryColor, fontFamily, logoUrl, texts,
 * fields, terms, upi, bank, signature) without importing a named type from
 * receipt-template-store that may not be exported there yet.
 */
export interface NotePrintTemplate {
  id?: string;
  name?: string;
  themeName?: string;
  headerTitle?: string;
  primaryColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  logoUrl?: string | null;
  upiId?: string;
  upiVpa?: string;
  upi_vpa?: string;
  customQrUrl?: string;
  payeeName?: string;
  bankDetails?: string;
  signatureUrl?: string | null;
  termsText?: string;
  texts?: Record<string, string> | null;
  fields?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Optional label overrides (resolved from `template.texts` by default). */
export interface NoteLabelTexts {
  partyTitle?: string;
  noteNoLabel?: string;
  dateLabel?: string;
  referenceLabel?: string;
  reasonForNoteLabel?: string;
  statusLabel?: string;
  partyGstinLabel?: string;
  phoneLabel?: string;
  totalLabel?: string;
  reasonLabel?: string;
  termsLabel?: string;
  signatureTitle?: string;
  forLabel?: string;
  bankDetailsLabel?: string;
  upiLabel?: string;
  amountInWordsLabel?: string;
  // Items-table column headers (present on InvoiceTexts-driven template.texts)
  colSno?: string;
  colDescription?: string;
  colHsn?: string;
  colQty?: string;
  colRate?: string;
}

/** The flat note payload every credit/debit note surface can supply. */
export interface NoteDocumentInput {
  note_number: string;
  amount: number | string;
  status?: string;
  party: string;
  party_gstin?: string;
  party_phone?: string;
  party_address?: string;
  reference_no?: string;
  reference_label?: string;
  /** Short "reason for note" line shown in the meta grid (POS notes). */
  reason_for_note?: string;
  reason?: string;
  date_iso?: string;
  /**
   * Optional itemized lines (POS credit/debit notes carry line items). When
   * present and non-empty, an items table is rendered between the meta grid
   * and the total box.
   */
  lines?: Array<Record<string, any>>;
  /** Taxable value shown in the totals box (POS notes with a tax split). */
  subtotal?: number;
  /** GST breakdown rows — only rows > 0 are printed (POS notes). */
  tax?: { cgst?: number; sgst?: number; igst?: number };
}

/** Company branding block (from getActiveBillingGst / tenant settings). */
export interface NoteCompanyInfo {
  name: string;
  gstin?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string | null;
  upi_vpa?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  signature_url?: string | null;
  terms_and_conditions?: string | null;
  currency_symbol?: string;
  currency_label_in_words?: string;
  /** Set to true to print the amount-in-words line under the total. */
  show_amount_in_words?: boolean;
}

export interface RenderNoteDocumentOptions {
  /** Label overrides. When omitted, resolved from `template.texts`. */
  texts?: NoteLabelTexts;
}

// ── Template resolution ─────────────────────────────────────────────────────

/**
 * Resolve the active print template for a note category to its full template
 * object, or `null` when nothing is selected / it cannot be found.
 *
 * Looks the active id up via `getActiveInvoicePrintTemplateForCategory`
 * (which itself falls through to the master invoice slot), then loads the
 * template object from the tenant's stored template list — the same storage
 * surface FullInvoicePrinter uses. Any error yields `null`, never a throw,
 * so callers can safely fall back to the default layout.
 */
export function resolveNotePrintTemplate(kind: NoteKind, tenantId?: string): NotePrintTemplate | null {
  if (typeof window === 'undefined') return null;
  try {
    const tid = tenantId || getTenantIdFromStorage();
    const activeId = getActiveInvoicePrintTemplateForCategory(kind, tid);
    if (!activeId) return null;
    // Thermal / sentinel ids are receipt engines, not A4 note layouts.
    const s = String(activeId).toLowerCase();
    if (s === 'a4' || s.includes('thermal') || s.includes('receipt') || s.startsWith('tpl-thm-')) {
      return null;
    }
    let list: any[] = [];
    try {
      const raw = localStorage.getItem(getTenantTemplatesKey(tid));
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      list = [];
    }
    const match =
      list.find((t: any) => t && t.id === activeId) ||
      list.find((t: any) => t && String(t.themeName || '').toLowerCase() === s) ||
      null;
    if (!match) return null;
    return match as NotePrintTemplate;
  } catch {
    return null;
  }
}

// ── Formatting helpers ──────────────────────────────────────────────────────

function escHtml(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** INR-style formatting: ₹ with 2 decimals and Indian digit grouping. */
export function formatNoteCurrency(amount: number | string, symbol = '₹'): string {
  const n = Number(amount);
  const safe = Number.isFinite(n) ? n : 0;
  return `${symbol}${safe.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNoteDate(iso?: string): string {
  if (!iso) {
    return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Indian-system number → words (Rupees/Lakhs/Crores). */
function numberToWordsIndian(num: number): string {
  if (num === 0) return 'Zero';
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen', 'Twenty', 'Thirty', 'Forty', 'Fifty',
    'Sixty', 'Seventy', 'Eighty', 'Ninety',
  ];
  const twoDigits = (n: number): string => {
    if (n < 20) return ones[n];
    const rem = n % 10;
    return rem ? `${ones[Math.floor(n / 10)]}-${ones[rem]}` : ones[Math.floor(n / 10)];
  };
  const threeDigits = (n: number): string => {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    const parts: string[] = [];
    if (h) parts.push(`${ones[h]} Hundred`);
    if (rest) parts.push(twoDigits(rest));
    return parts.join(' ');
  };
  let intPart = Math.floor(num);
  const rupParts: string[] = [];
  if (intPart >= 1e7) {
    rupParts.push(`${threeDigits(Math.floor(intPart / 1e7))} Crore`);
    intPart %= 1e7;
  }
  if (intPart >= 1e5) {
    rupParts.push(`${twoDigits(Math.floor(intPart / 1e5))} Lakh`);
    intPart %= 1e5;
  }
  if (intPart >= 100) {
    rupParts.push(threeDigits(intPart));
    intPart = 0;
  }
  if (intPart > 0) rupParts.push(twoDigits(intPart));
  const paise = Math.round((num - Math.floor(num)) * 100);
  let words = rupParts.join(' ');
  if (paise > 0) words += `${words ? ' and ' : ''}${twoDigits(paise)} Paise`;
  return words || 'Zero';
}

// ── HTML rendering ───────────────────────────────────────────────────────────

export function renderNoteDocument(
  kind: NoteKind,
  note: NoteDocumentInput,
  company: NoteCompanyInfo,
  template: NotePrintTemplate | null,
  options: RenderNoteDocumentOptions = {},
): string {
  const isCredit = kind === 'credit_note';
  const texts: NoteLabelTexts = { ...(template?.texts || {}), ...(options.texts || {}) };

  // Branding: the template's primary color wins; with no template (or a
  // template that carries no color) the uniform fallback #4f46e5 is used —
  // the same accent the current hand-crafted layouts build on.
  const brandColor = ((template?.primaryColor as string) || '').trim() || '#4f46e5';
  // Tinted panel behind the party block / total box: the template's background
  // color when present, else a kind-appropriate light tint.
  const brandLightBg =
    (template?.backgroundColor && String(template.backgroundColor).trim()) ||
    (isCredit ? '#ecfdf5' : '#fff1f2');
  const fontFamily = (template?.fontFamily || '').trim() || "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";

  const docTitle =
    (template?.headerTitle && String(template.headerTitle).trim()) ||
    (isCredit ? 'CREDIT NOTE' : 'DEBIT NOTE');
  const docSub = isCredit ? 'CN' : 'DN';
  const refWord = isCredit ? 'Bill' : 'Invoice';

  // ── Labels (template.texts overrides where sensible) ──
  const L = {
    partyTitle: isCredit ? 'Issued To' : 'Billed To',
    noteNoLabel: 'Note No',
    dateLabel: 'Date',
    referenceLabel: `Reference ${refWord} / Invoice`,
    reasonForNoteLabel: 'Reason for Note',
    statusLabel: 'Status',
    partyGstinLabel: 'GSTIN',
    phoneLabel: 'Phone',
    totalLabel: isCredit ? 'Net Credit Amount' : 'Net Debit Amount',
    reasonLabel: 'Reason / Remarks',
    termsLabel: 'Terms & Conditions',
    signatureTitle: 'Authorised Signatory',
    forLabel: `For ${company.name || 'Organization'}`,
    bankDetailsLabel: 'Bank Details',
    upiLabel: 'UPI',
    amountInWordsLabel: 'Amount in Words',
    ...texts,
  };

  // ── Data ──
  const amountNum = Number(note.amount);
  const safeAmount = Number.isFinite(amountNum) ? amountNum : 0;
  const currencySymbol = company.currency_symbol || '₹';
  const amountText = formatNoteCurrency(safeAmount, currencySymbol);
  const statusText = (note.status || '').trim();
  const party = note.party || (isCredit ? 'Valued Customer' : 'Valued Customer');
  const reference = note.reference_no || (isCredit ? 'Direct Credit' : 'Supplementary Billing');

  // ── UPI QR (template.fields.showQR !== false + a resolvable VPA/URL) ──
  const fields = template?.fields || {};
  const showQr = fields.showQR !== false && fields.showPaymentQR !== false;
  const paymentQr =
    typeof window !== 'undefined' ? getOrgPaymentQrSettings() : null;
  const upiVpa =
    (template?.upiId || template?.upiVpa || template?.upi_vpa || company.upi_vpa || paymentQr?.vpa || '').trim();
  const payeeName = template?.payeeName || company.name || 'Merchant';
  const customQr = String(template?.customQrUrl || '').trim();
  let qrSvg = '';
  if (showQr && (upiVpa || customQr)) {
    const qrContent = upiVpa
      ? buildUpiPayUrl({ vpa: upiVpa, payeeName, amount: isCredit ? undefined : safeAmount, invoiceNumber: note.note_number }) ||
        customQr ||
        upiVpa
      : customQr;
    qrSvg = generateQRCodeSVG(qrContent, 110);
  }

  // ── Bank details (template.fields.showBankDetails) ──
  const showBank = fields.showBankDetails !== false;
  const bankFromTemplate = String(template?.bankDetails || '').trim();
  const bankLines: string[] = [];
  if (bankFromTemplate) bankLines.push(bankFromTemplate);
  const coBankName = (company.bank_name || '').trim();
  const coAcct = (company.bank_account_number || '').trim();
  const coIfsc = (company.bank_ifsc || '').trim();
  if (coBankName || coAcct || coIfsc) {
    bankLines.push([coBankName ? `Bank: ${coBankName}` : '', coAcct ? `A/C: ${coAcct}` : '', coIfsc ? `IFSC: ${coIfsc}` : ''].filter(Boolean).join(' | '));
  }
  const bankHtml =
    showBank && bankLines.length > 0
      ? `
        <div style="margin-top:14px; padding:10px 14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; font-size:11px; color:#475569; line-height:1.5;">
          <div style="font-size:10px; font-weight:800; text-transform:uppercase; color:#1e293b; margin-bottom:4px;">${escHtml(L.bankDetailsLabel)}</div>
          ${bankLines.map((b) => escHtml(b)).join('<br/>')}
        </div>`
      : '';

  // ── Signature (template.fields.showSignature !== false) ──
  const showSignature = fields.showSignature !== false && fields.showStamp !== false;
  const signatureUrl =
    (template?.signatureUrl && String(template.signatureUrl).trim()) ||
    (company.signature_url && String(company.signature_url).trim()) ||
    '';
  const signatureHtml = showSignature
    ? `
      <div style="margin-top:32px; display:flex; justify-content:flex-end;">
        <div style="text-align:center; min-width:180px;">
          ${signatureUrl ? `<img src="${escHtml(signatureUrl)}" alt="Signature" style="max-height:44px; max-width:160px; object-fit:contain; margin-bottom:4px;" />` : ''}
          <div style="border-top:1.5px solid #94a3b8; padding-top:6px; font-size:11px; font-weight:600; color:#0f172a;">${escHtml(L.forLabel)}</div>
          <div style="font-size:10px; color:#64748b; margin-top:2px;">${escHtml(L.signatureTitle)}</div>
        </div>
      </div>`
    : '';

  // ── Terms footer ──
  const termsText =
    String(template?.termsText || '').trim() ||
    String(company.terms_and_conditions || '').trim();
  const termsHtml = termsText
    ? `
      <div style="margin-top:20px; font-size:10.5px; color:#475569; line-height:1.5;">
        <div style="font-size:10px; font-weight:800; text-transform:uppercase; color:#64748b; margin-bottom:4px;">${escHtml(L.termsLabel)}</div>
        ${escHtml(termsText).replace(/\n/g, '<br/>')}
      </div>`
    : '';

  // ── Amount in words (optional) ──
  const wordsNum = Math.abs(safeAmount);
  const wordsLine = company.show_amount_in_words && wordsNum > 0
    ? `<div style="font-size:11px; color:#475569; margin-top:6px;">${escHtml(L.amountInWordsLabel)}: ${company.currency_label_in_words ? escHtml(company.currency_label_in_words) : 'Rupees'} ${escHtml(numberToWordsIndian(wordsNum))}</div>`
    : '';

  const disclaimer = isCredit
    ? 'This is a computer-generated credit note document. The above credit amount has been adjusted towards the customer ledger / store credit balance.'
    : 'This is a computer-generated debit note document. The above debit amount has been charged to the customer receivable account.';

  // ── Optional items table (POS notes carry line items) ──
  const lines = Array.isArray(note.lines) ? note.lines : [];
  const linesHtml =
    lines.length > 0
      ? `
        <table style="width:100%; border-collapse:collapse; margin-top:16px; font-size:8.5pt;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="border:1px solid #e2e8f0; padding:8px 12px; text-align:center; width:36px; font-size:8pt; color:#475569;">${escHtml(texts.colSno || '#')}</th>
              <th style="border:1px solid #e2e8f0; padding:8px 12px; text-align:left; font-size:8pt; color:#475569;">${escHtml(texts.colDescription || 'Description')}</th>
              <th style="border:1px solid #e2e8f0; padding:8px 12px; text-align:center; width:72px; font-size:8pt; color:#475569;">${escHtml(texts.colHsn || 'HSN')}</th>
              <th style="border:1px solid #e2e8f0; padding:8px 12px; text-align:center; width:56px; font-size:8pt; color:#475569;">${escHtml(texts.colQty || 'Qty')}</th>
              <th style="border:1px solid #e2e8f0; padding:8px 12px; text-align:right; width:88px; font-size:8pt; color:#475569;">${escHtml(texts.colRate || 'Rate')}</th>
              <th style="border:1px solid #e2e8f0; padding:8px 12px; text-align:right; width:96px; font-size:8pt; color:#475569;">${escHtml(isCredit ? 'Credit Amount' : 'Debit Amount')}</th>
            </tr>
          </thead>
          <tbody>
            ${lines.map((line: Record<string, any>, idx: number) => {
              const qty = Number(line.quantity ?? line.qty ?? 1);
              const rate = Number(line.unit_price ?? line.rate ?? line.selling_price ?? 0);
              const lineAmt = Number(line.total_amount ?? line.amount ?? line.line_total ?? qty * rate);
              return `
                <tr>
                  <td style="border:1px solid #e2e8f0; padding:8px 12px; text-align:center; font-size:8.5pt;">${idx + 1}</td>
                  <td style="border:1px solid #e2e8f0; padding:8px 12px; font-size:8.5pt; font-weight:600;">${escHtml(line.product_name || line.name || line.description || 'Item')}</td>
                  <td style="border:1px solid #e2e8f0; padding:8px 12px; text-align:center; font-size:8.5pt; color:#475569;">${escHtml(line.hsn_code || line.hsn || '—')}</td>
                  <td style="border:1px solid #e2e8f0; padding:8px 12px; text-align:center; font-size:8.5pt;">${Number.isFinite(qty) ? qty : 1}</td>
                  <td style="border:1px solid #e2e8f0; padding:8px 12px; text-align:right; font-size:8.5pt;">${formatNoteCurrency(Number.isFinite(rate) ? rate : 0, currencySymbol)}</td>
                  <td style="border:1px solid #e2e8f0; padding:8px 12px; text-align:right; font-weight:700; color:${brandColor};">${formatNoteCurrency(Number.isFinite(lineAmt) ? lineAmt : 0, currencySymbol)}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>`
      : '';

  const gridCell = (label: string, value: string, strong = false): string =>
    `
    <div style="margin-bottom:6px;">
      <div style="font-size:9.5px; font-weight:700; text-transform:uppercase; color:#94a3b8; letter-spacing:0.4px;">${escHtml(label)}</div>
      <div style="font-size:${strong ? '15px' : '12.5px'}; font-weight:${strong ? 800 : 600}; color:#0f172a; margin-top:2px; word-break:break-word;">${escHtml(value)}</div>
    </div>`;

  const partyPanel = `
    <div style="flex:1; background:${brandLightBg}; border:1px solid #e2e8f0; border-radius:10px; padding:16px;">
      <div style="font-size:10px; font-weight:800; text-transform:uppercase; color:${brandColor}; letter-spacing:0.5px; margin-bottom:8px;">${escHtml(L.partyTitle)}</div>
      <div style="font-size:16px; font-weight:800; color:#0f172a; margin-bottom:6px;">${escHtml(party)}</div>
      ${note.party_phone ? `<div style="font-size:11.5px; color:#475569; margin-bottom:3px;">${escHtml(L.phoneLabel)}: ${escHtml(note.party_phone)}</div>` : ''}
      ${note.party_gstin ? `<div style="font-size:11.5px; color:#475569; margin-bottom:3px;">${escHtml(L.partyGstinLabel)}: ${escHtml(note.party_gstin)}</div>` : ''}
      ${note.party_address ? `<div style="font-size:11px; color:#64748b; line-height:1.4;">${escHtml(note.party_address)}</div>` : ''}
    </div>`;

  const metaPanel = `
    <div style="flex:1; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px;">
      <div style="font-size:10px; font-weight:800; text-transform:uppercase; color:${brandColor}; letter-spacing:0.5px; margin-bottom:8px;">${escHtml(isCredit ? 'Credit Note Details' : 'Debit Note Details')}</div>
      ${gridCell(L.noteNoLabel, note.note_number, true)}
      ${gridCell(L.dateLabel, formatNoteDate(note.date_iso))}
      ${gridCell(L.referenceLabel, note.reference_label || reference)}
      ${note.reason_for_note ? gridCell(L.reasonForNoteLabel, note.reason_for_note) : ''}
      ${statusText ? gridCell(L.statusLabel, statusText) : ''}
    </div>`;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escHtml(isCredit ? 'Credit Note' : 'Debit Note')} - ${escHtml(note.note_number)}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm 15mm; }
          body { background:#ffffff; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div style="font-family:${escHtml(fontFamily)}, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#0f172a; max-width:760px; margin:0 auto; padding:16px; font-size:9.5pt; line-height:1.5;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:20px; border-bottom:2.5px solid ${brandColor}; padding-bottom:14px;">
            <div style="display:flex; align-items:flex-start; gap:12px;">
              ${(template?.logoUrl || company.logo_url) ? `
                <img src="${escHtml(String(template?.logoUrl || company.logo_url))}" alt="Logo" style="max-height:52px; max-width:150px; object-fit:contain;" />`
                : `
                <div style="width:44px; height:44px; border-radius:9px; background:${brandColor}; color:#ffffff; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:15px; flex-shrink:0;">${escHtml(docSub)}</div>`}
              <div>
                <div style="font-size:16pt; font-weight:900; color:#0f172a;">${escHtml(company.name || 'Organization')}</div>
                ${company.address ? `<div style="font-size:8.5pt; color:#64748b; margin-top:2px;">${escHtml(company.address)}</div>` : ''}
                <div style="font-size:8.5pt; color:#64748b;">
                  ${company.phone ? `Ph: ${escHtml(company.phone)}` : ''}${company.phone && company.email ? ' • ' : ''}${company.email ? `Email: ${escHtml(company.email)}` : ''}${(company.phone || company.email) && company.gstin ? ' • ' : ''}${company.gstin ? `GSTIN: ${escHtml(company.gstin)}` : ''}
                </div>
              </div>
            </div>
            <div style="text-align:right; flex-shrink:0;">
              <div style="display:inline-block; background:${brandColor}; color:#ffffff; font-size:11pt; font-weight:800; padding:5px 14px; border-radius:7px; letter-spacing:0.5px;">${escHtml(docTitle)}</div>
              ${statusText ? `<div style="display:inline-block; margin-top:6px; padding:3px 10px; border-radius:999px; font-size:10px; font-weight:700; background:${brandLightBg}; color:${brandColor}; border:1px solid ${brandColor}33;">${escHtml(statusText.toUpperCase())}</div>` : ''}
            </div>
          </div>

          <div style="display:flex; gap:16px; margin-top:18px;">
            ${partyPanel}
            ${metaPanel}
          </div>

          ${note.reason ? `
            <div style="margin-top:16px; background:#f8fafc; border-left:3px solid ${brandColor}; padding:10px 14px; font-size:9pt; color:#475569; line-height:1.5;">
              <span style="font-weight:700; color:#0f172a;">${escHtml(L.reasonLabel)}:</span> ${escHtml(note.reason).replace(/\n/g, '<br/>')}
            </div>` : ''}

          ${linesHtml}

          <div style="margin-top:20px; padding:14px 16px; background:${brandLightBg}; border:1px solid ${brandColor}44; border-radius:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap;">
              <div>
                <div style="font-size:10px; font-weight:800; text-transform:uppercase; color:${brandColor}; letter-spacing:0.5px;">${escHtml(L.totalLabel)}</div>
                ${(() => {
                  const tax = note.tax || {};
                  const hasTax =
                    (typeof note.subtotal === 'number' && Number(note.subtotal) > 0) ||
                    (tax.cgst ?? 0) > 0 ||
                    (tax.sgst ?? 0) > 0 ||
                    (tax.igst ?? 0) > 0;
                  if (!hasTax) return '';
                  const subNote =
                    typeof note.subtotal === 'number' && Number(note.subtotal) > 0
                      ? `<div style="font-size:9.5px; color:#475569; margin-top:2px;">Taxable Value: ${formatNoteCurrency(Number(note.subtotal), currencySymbol)}</div>`
                      : '';
                  const cg = (tax.cgst ?? 0) > 0 ? `<div style="font-size:9.5px; color:#475569; margin-top:2px;">CGST: +${formatNoteCurrency(tax.cgst as number, currencySymbol)}</div>` : '';
                  const sg = (tax.sgst ?? 0) > 0 ? `<div style="font-size:9.5px; color:#475569; margin-top:2px;">SGST: +${formatNoteCurrency(tax.sgst as number, currencySymbol)}</div>` : '';
                  const ig = (tax.igst ?? 0) > 0 ? `<div style="font-size:9.5px; color:#475569; margin-top:2px;">IGST: +${formatNoteCurrency(tax.igst as number, currencySymbol)}</div>` : '';
                  return subNote + cg + sg + ig;
                })()}
              </div>
              <div style="text-align:right;">
                <div style="font-size:22px; font-weight:900; color:${brandColor}; font-family:'Segoe UI', sans-serif;">${amountText}</div>
                ${wordsLine}
              </div>
            </div>
          </div>

          ${qrSvg ? `
            <div style="margin-top:16px; text-align:center; border:1px dashed #cbd5e1; border-radius:10px; padding:12px;">
              <img src="${qrSvg}" alt="UPI QR" style="width:100px; height:100px; object-fit:contain;" />
              <div style="font-size:9.5px; font-weight:800; color:#0f172a; margin-top:6px;">${escHtml(L.upiLabel)}: ${escHtml(upiVpa || customQr)}</div>
              <div style="font-size:8.5px; color:#64748b; margin-top:2px;">${escHtml(payeeName)}</div>
            </div>` : ''}

          ${bankHtml}

          ${termsHtml}

          ${signatureHtml}

          <div style="margin-top:36px; border-top:1px dashed #cbd5e1; padding-top:12px; font-size:10px; color:#94a3b8; text-align:center; line-height:1.5;">
            ${escHtml(disclaimer)}
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Convenience: resolve the template + billing-GST company block and render
 * the note in one call. Used by the POS credit/debit note components.
 */
export function renderNoteDocumentFor(
  kind: NoteKind,
  note: NoteDocumentInput,
  company: NoteCompanyInfo,
  tenantId?: string,
  options: RenderNoteDocumentOptions = {},
): string {
  const template = resolveNotePrintTemplate(kind, tenantId);
  return renderNoteDocument(kind, note, company, template, options);
}

/** Billing-GST company block helper (components that don't already resolve it). */
export function getNoteCompanyInfo(tenantId?: string, overrides?: Partial<NoteCompanyInfo>): NoteCompanyInfo {
  const activeGst = getActiveBillingGst(tenantId);
  return {
    name: activeGst?.trade_name || activeGst?.legal_name || 'Organization',
    gstin: activeGst?.gstin || '',
    address: activeGst?.address || '',
    phone: activeGst?.phone || '',
    email: activeGst?.email || '',
    logo_url: activeGst?.logo_url || null,
    upi_vpa: activeGst?.upi_vpa || null,
    bank_name: activeGst?.bank_name || null,
    bank_account_number: activeGst?.bank_account_number || null,
    bank_ifsc: activeGst?.bank_ifsc || null,
    signature_url: activeGst?.signature_url || null,
    terms_and_conditions: activeGst?.terms_and_conditions || null,
    ...overrides,
  };
}

// Re-export so components can grab the billing-GST block without importing
// receipt-template-store directly (keeps the import surface of this helper
// stable while the store file is being extended by the template-keys work).
export { getActiveBillingGst };
