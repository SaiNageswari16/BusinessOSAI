/**
 * Shared renderer for Purchase Invoice / Vendor Bill & Purchase Order printing.
 *
 * The "actually use it anywhere" requirement: when the user has selected a
 * print template for the `purchase_invoice` / `purchase_order` document
 * category (via the Print & Document Templates strip — the new
 * `bos_active_purchase_invoice_template_id` / `bos_active_purchase_order_template_id`
 * slots), the purchase document is rendered with that template's branding
 * (primary color, font, logo, terms, signature) and label overrides. When no
 * template is selected the renderer falls back to a clean uniform layout
 * using the active billing GST branding (primary color #4f46e5), so printing
 * never crashes either way.
 *
 * Callers (procurement share modal / print entry points) do:
 *   const tpl = resolvePurchasePrintTemplate(kind, tenantId);
 *   const html = renderPurchaseDocument(kind, doc, company, tpl);
 *   printHtmlInPage(html, 300);
 *
 * `resolvePurchasePrintTemplate` returns `null` when nothing is selected (or
 * the stored template object cannot be found) — the renderer treats `null`
 * as "use the billing-GST fallback" and never throws. Resolution mirrors
 * `resolveNotePrintTemplate` from ./note-document-renderer (which itself
 * falls through the per-category key to the master invoice slot), plus a
 * secondary look-up of the legacy `bos_active_purchase_template_id_<tid>`
 * key that FullInvoicePrinter still honors for purchase documents — so the
 * print matches whatever template the user last picked in the PDF printer.
 */

import {
  getActiveInvoicePrintTemplateForCategory,
  getTenantIdFromStorage,
  getTenantTemplatesKey,
} from './receipt-template-store';
import {
  getNoteCompanyInfo,
  formatNoteCurrency,
  type NoteCompanyInfo,
  type NotePrintTemplate,
} from './note-document-renderer';

export type PurchaseDocKind = 'purchase_invoice' | 'purchase_order';

/** Re-export so callers only need this module's import surface. */
export type PurchasePrintTemplate = NotePrintTemplate;
export { getNoteCompanyInfo, formatNoteCurrency };
export type PurchaseCompanyInfo = NoteCompanyInfo;

/**
 * The flat purchase-document payload every print entry point can supply.
 * All fields optional — missing values are simply not printed.
 */
export interface PurchaseDocumentInput {
  doc_number: string;
  date_iso?: string;
  due_date?: string;
  status?: string;
  /** Terms / remarks line shown in the meta panel + footer. */
  terms?: string;
  // ── Supplier / Vendor party ──
  supplier_name?: string;
  supplier_phone?: string;
  supplier_email?: string;
  supplier_gstin?: string;
  supplier_pan?: string;
  supplier_address?: string;
  // ── References ──
  po_reference?: string;
  /** Goods Received Note reference (purchase invoices / 3-way match). */
  grn_reference?: string;
  // ── Items (rendered as a table when present) ──
  items?: Array<Record<string, any>>;
  // ── Totals ──
  subtotal?: number | string;
  tax_amount?: number | string;
  discount_amount?: number | string;
  round_off?: number | string;
  grand_total?: number | string;
  /** Alternative grand-total key used by share-modal payloads. */
  total_amount?: number | string;
  amount_paid?: number | string;
  /** Alternative paid-amount key used by share-modal payloads. */
  amount_received?: number | string;
}

export interface RenderPurchaseDocumentOptions {
  /** Label overrides. When omitted, resolved from `template.texts`. */
  texts?: Record<string, string>;
}

// ── Template resolution ─────────────────────────────────────────────────────

function isSentinelTemplateId(id: string): boolean {
  const s = id.toLowerCase();
  return s === 'a4' || s.includes('thermal') || s.includes('receipt') || s.startsWith('tpl-thm-');
}

function loadTemplateObject(activeId: string, tid: string): NotePrintTemplate | null {
  let list: any[] = [];
  try {
    const raw = localStorage.getItem(getTenantTemplatesKey(tid));
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) list = parsed;
  } catch {
    list = [];
  }
  const s = String(activeId).toLowerCase();
  return (
    list.find((t: any) => t && t.id === activeId) ||
    list.find((t: any) => t && String(t.themeName || '').toLowerCase() === s) ||
    null
  );
}

/**
 * Resolve the active print template for a purchase-document category to its
 * full template object, or `null` when nothing is selected / it cannot be
 * found.
 *
 * 1. `getActiveInvoicePrintTemplateForCategory(kind, tid)` — the new
 *    `purchase_invoice` / `purchase_order` category slots (which fall
 *    through to the master invoice slot when empty).
 * 2. Legacy `bos_active_purchase_template_id_<tid>` (still written by the
 *    FullInvoicePrinter purchase flow) — tried when the category slot is
 *    empty or its object cannot be resolved, so the print matches the PDF
 *    printer's live pick.
 *
 * Any error yields `null`, never a throw.
 */
export function resolvePurchasePrintTemplate(kind: PurchaseDocKind, tenantId?: string): PurchasePrintTemplate | null {
  if (typeof window === 'undefined') return null;
  try {
    const tid = tenantId || getTenantIdFromStorage();
    const candidates: string[] = [];
    const activeId = getActiveInvoicePrintTemplateForCategory(kind, tid);
    if (activeId && !isSentinelTemplateId(String(activeId))) candidates.push(String(activeId));
    const legacy = localStorage.getItem(`bos_active_purchase_template_id_${tid}`);
    if (legacy && !isSentinelTemplateId(legacy)) candidates.push(legacy);
    for (const id of candidates) {
      const match = loadTemplateObject(id, tid);
      if (match) return match;
    }
    return null;
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

function fmtDate(v?: string): string {
  if (!v) return '';
  const raw = String(v).trim();
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw; // already a display string
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// ── HTML rendering ───────────────────────────────────────────────────────────

export function renderPurchaseDocument(
  kind: PurchaseDocKind,
  doc: PurchaseDocumentInput,
  company: PurchaseCompanyInfo,
  template: PurchasePrintTemplate | null,
  options: RenderPurchaseDocumentOptions = {},
): string {
  const isPo = kind === 'purchase_order';
  const texts: Record<string, string> = { ...(template?.texts || {}), ...(options.texts || {}) };

  // Branding: the template's primary color wins; with no template (or a
  // template that carries no color) the uniform fallback #4f46e5 is used —
  // the same accent the current hand-crafted purchase layouts build on.
  const brandColor = ((template?.primaryColor as string) || '').trim() || '#4f46e5';
  const brandLightBg =
    (template?.backgroundColor && String(template.backgroundColor).trim()) ||
    (isPo ? '#f5f3ff' : '#eff6ff');
  const fontFamily = (template?.fontFamily || '').trim() || "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";

  const docTitle =
    (template?.headerTitle && String(template.headerTitle).trim()) ||
    (isPo ? 'PURCHASE ORDER' : 'VENDOR INVOICE / PURCHASE INVOICE');
  const docSub = isPo ? 'PO' : 'PI';

  // ── Labels (template.texts overrides where sensible) ──
  const L: Record<string, string> = {
    partyTitle: texts.partyTitle || 'Supplier / Vendor',
    docNoLabel: texts.invoiceNoLabel || texts.docNoLabel || (isPo ? 'PO No' : 'Bill / Invoice No'),
    dateLabel: texts.invoiceDateLabel || texts.orderDateLabel || 'Date',
    dueDateLabel: texts.dueDateLabel || 'Due Date',
    poRefLabel: texts.poNumberLabel || 'PO Reference',
    grnRefLabel: 'GRN Reference',
    statusLabel: texts.statusLabel || 'Status',
    termsLabel: texts.termsLabel || 'Terms / Remarks',
    partyGstinLabel: texts.partyGstinLabel || 'GSTIN',
    panLabel: texts.panLabel || 'PAN',
    phoneLabel: texts.phoneLabel || 'Phone',
    emailLabel: texts.emailLabel || 'Email',
    subtotalLabel: texts.subtotalLabel || 'Subtotal',
    taxLabel: texts.totalTaxLabel || 'Tax / GST',
    discountLabel: 'Discount',
    roundOffLabel: 'Round Off',
    totalLabel: texts.grandTotalLabel || (isPo ? 'Order Total' : 'Grand Total'),
    paidLabel: texts.receivedAmountLabel || 'Paid / Received',
    balanceLabel: texts.outstandingLabel || 'Balance Due',
    signatureTitle: texts.signatureTitle || 'Authorised Signatory',
    forLabel: texts.forLabel || `For ${company.name || 'Organization'}`,
    supplierSignatureLabel: 'Supplier / Vendor',
  };

  // ── Data ──
  const currencySymbol = company.currency_symbol || '₹';
  const statusText = (doc.status || '').trim();
  const supplier = doc.supplier_name || 'Supplier / Vendor';
  const docNumber = doc.doc_number || '—';

  // ── Items + totals (explicit document totals win; else computed from lines) ──
  const lines: Array<Record<string, any>> = Array.isArray(doc.items) ? doc.items : [];
  let lineSubtotalSum = 0;
  let lineTaxSum = 0;
  const computedLines = lines.map((line, idx) => {
    const qty = num(line.quantity ?? line.qty ?? 0);
    const rate = num(line.unit_price ?? line.rate ?? line.selling_price ?? line.price ?? 0);
    const taxPct = num(line.tax_rate ?? line.tax_percent ?? line.gst_percent ?? 0);
    const isFree = Boolean(line.is_free) || rate <= 0.009;
    const taxIncl = line.is_tax_inclusive === true;
    const base = isFree ? 0 : qty * rate;
    // Explicit line amount / tax (when a caller supplies pre-computed values)
    // win over the on-the-fly tax math.
    const explicitAmt = line.total_amount ?? line.amount ?? line.line_total ?? line.subtotal;
    const lineAmt =
      explicitAmt != null && Number(explicitAmt) > 0
        ? Number(explicitAmt)
        : isFree ? 0 : taxIncl ? base : base * (1 + taxPct / 100);
    const explicitLineTax = line.tax_amount ?? line.tax;
    const lineTax =
      explicitLineTax != null && Number(explicitLineTax) > 0
        ? Number(explicitLineTax)
        : isFree || taxPct <= 0
          ? 0
          : taxIncl ? base - base / (1 + taxPct / 100) : (base * taxPct) / 100;
    lineSubtotalSum += isFree ? 0 : qty * rate;
    lineTaxSum += lineTax;
    return {
      idx,
      qty,
      rate,
      taxPct,
      isFree,
      lineAmt,
      lineTax,
      name: line.product_name || line.name || line.description || 'Item',
      sku: line.sku || line.product_sku || '',
      hsn: line.hsn_code || line.hsn || '',
    };
  });

  const explicitSubtotal = num(doc.subtotal);
  const explicitTax = num(doc.tax_amount);
  const subtotalVal = explicitSubtotal > 0 ? explicitSubtotal : lineSubtotalSum;
  const taxTotalVal = explicitTax > 0 ? explicitTax : lineTaxSum;
  const discountVal = num(doc.discount_amount);
  const roundOffVal = num(doc.round_off);
  const explicitGrand = num(doc.grand_total);
  const grandTotalVal =
    explicitGrand > 0
      ? explicitGrand
      : Math.max(0, subtotalVal + taxTotalVal - discountVal + roundOffVal);
  const paidVal = num(doc.amount_paid ?? doc.amount_received);
  const balanceVal = Math.max(0, grandTotalVal - paidVal);

  // ── Items table (mirrors the note renderer's styling) ──
  const linesHtml =
    lines.length > 0
      ? `
        <table style="width:100%; border-collapse:collapse; margin-top:16px; font-size:8.5pt;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="border:1px solid #e2e8f0; padding:8px 12px; text-align:center; width:36px; font-size:8pt; color:#475569;">${escHtml(texts.colSno || '#')}</th>
              <th style="border:1px solid #e2e8f0; padding:8px 12px; text-align:left; font-size:8pt; color:#475569;">${escHtml(texts.colDescription || 'Description')}</th>
              <th style="border:1px solid #e2e8f0; padding:8px 12px; text-align:center; width:72px; font-size:8pt; color:#475569;">${escHtml(texts.colHsn || 'HSN/SAC')}</th>
              <th style="border:1px solid #e2e8f0; padding:8px 12px; text-align:center; width:56px; font-size:8pt; color:#475569;">${escHtml(texts.colQty || 'Qty')}</th>
              <th style="border:1px solid #e2e8f0; padding:8px 12px; text-align:right; width:88px; font-size:8pt; color:#475569;">${escHtml(texts.colRate || 'Rate')}</th>
              <th style="border:1px solid #e2e8f0; padding:8px 12px; text-align:center; width:56px; font-size:8pt; color:#475569;">Tax%</th>
              <th style="border:1px solid #e2e8f0; padding:8px 12px; text-align:right; width:104px; font-size:8pt; color:#475569;">${escHtml(texts.colAmount || 'Amount')}</th>
            </tr>
          </thead>
          <tbody>
            ${computedLines.map((l) => `
                <tr>
                  <td style="border:1px solid #e2e8f0; padding:8px 12px; text-align:center; font-size:8.5pt;">${l.idx + 1}</td>
                  <td style="border:1px solid #e2e8f0; padding:8px 12px; font-size:8.5pt; font-weight:600;">
                    ${escHtml(l.name)}${l.isFree ? `<span style="display:inline-block; margin-left:6px; background:#059669; color:#ffffff; font-size:7pt; font-weight:800; padding:1px 5px; border-radius:4px;">FREE</span>` : ''}
                    ${l.sku ? `<div style="font-size:7.5pt; color:#94a3b8; font-family:monospace; margin-top:2px;">SKU: ${escHtml(l.sku)}</div>` : ''}
                  </td>
                  <td style="border:1px solid #e2e8f0; padding:8px 12px; text-align:center; font-size:8.5pt; color:#475569;">${escHtml(l.hsn || '—')}</td>
                  <td style="border:1px solid #e2e8f0; padding:8px 12px; text-align:center; font-size:8.5pt;">${l.qty}</td>
                  <td style="border:1px solid #e2e8f0; padding:8px 12px; text-align:right; font-size:8.5pt;">${formatNoteCurrency(l.isFree ? 0 : l.rate, currencySymbol)}</td>
                  <td style="border:1px solid #e2e8f0; padding:8px 12px; text-align:center; font-size:8.5pt; color:#475569;">${l.taxPct > 0 ? `${l.taxPct}%` : '—'}</td>
                  <td style="border:1px solid #e2e8f0; padding:8px 12px; text-align:right; font-weight:700; color:${l.isFree ? '#059669' : brandColor};">
                    ${formatNoteCurrency(l.lineAmt, currencySymbol)}
                    ${l.lineTax > 0 ? `<div style="font-size:7.5pt; font-weight:400; color:#94a3b8; font-family:monospace;">Tax: ${formatNoteCurrency(l.lineTax, currencySymbol)}</div>` : ''}
                  </td>
                </tr>`).join('')}
          </tbody>
        </table>`
      : '';

  // ── Meta cells ──
  const gridCell = (label: string, value: string, strong = false): string =>
    `
    <div style="margin-bottom:6px;">
      <div style="font-size:9.5px; font-weight:700; text-transform:uppercase; color:#94a3b8; letter-spacing:0.4px;">${escHtml(label)}</div>
      <div style="font-size:${strong ? '15px' : '12.5px'}; font-weight:${strong ? 800 : 600}; color:#0f172a; margin-top:2px; word-break:break-word;">${escHtml(value)}</div>
    </div>`;

  const metaDate = fmtDate(doc.date_iso) || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const dueDateText = fmtDate(doc.due_date);

  const supplierPanel = `
    <div style="flex:1; background:${brandLightBg}; border:1px solid #e2e8f0; border-radius:10px; padding:16px;">
      <div style="font-size:10px; font-weight:800; text-transform:uppercase; color:${brandColor}; letter-spacing:0.5px; margin-bottom:8px;">${escHtml(L.partyTitle)}</div>
      <div style="font-size:16px; font-weight:800; color:#0f172a; margin-bottom:6px;">${escHtml(supplier)}</div>
      ${doc.supplier_phone ? `<div style="font-size:11.5px; color:#475569; margin-bottom:3px;">${escHtml(L.phoneLabel)}: ${escHtml(doc.supplier_phone)}</div>` : ''}
      ${doc.supplier_gstin ? `<div style="font-size:11.5px; color:#475569; margin-bottom:3px;">${escHtml(L.partyGstinLabel)}: ${escHtml(doc.supplier_gstin)}</div>` : ''}
      ${doc.supplier_pan ? `<div style="font-size:11.5px; color:#475569; margin-bottom:3px;">${escHtml(L.panLabel)}: ${escHtml(doc.supplier_pan)}</div>` : ''}
      ${doc.supplier_address ? `<div style="font-size:11px; color:#64748b; line-height:1.4;">${escHtml(doc.supplier_address)}</div>` : ''}
      ${doc.supplier_email ? `<div style="font-size:10.5px; color:#64748b; margin-top:3px;">${escHtml(L.emailLabel)}: ${escHtml(doc.supplier_email)}</div>` : ''}
    </div>`;

  const metaPanel = `
    <div style="flex:1; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px;">
      <div style="font-size:10px; font-weight:800; text-transform:uppercase; color:${brandColor}; letter-spacing:0.5px; margin-bottom:8px;">${escHtml(isPo ? 'Purchase Order Details' : 'Purchase Invoice Details')}</div>
      ${gridCell(L.docNoLabel, docNumber, true)}
      ${gridCell(L.dateLabel, metaDate)}
      ${dueDateText ? gridCell(L.dueDateLabel, dueDateText) : ''}
      ${isPo ? '' : doc.po_reference ? gridCell(L.poRefLabel, doc.po_reference) : ''}
      ${isPo || !doc.grn_reference ? '' : gridCell(L.grnRefLabel, doc.grn_reference)}
      ${statusText ? gridCell(L.statusLabel, statusText) : ''}
      ${doc.terms ? gridCell(L.termsLabel, doc.terms) : ''}
    </div>`;

  // ── Totals box (subtotal / tax / total, big & bold) ──
  const totalRow = (label: string, value: string, tone?: string): string =>
    `<div style="display:flex; justify-content:space-between; gap:12px; font-size:9.5px; color:#475569; margin-top:2px;">
      <span>${escHtml(label)}</span>
      <span style="font-family:monospace; font-weight:${tone ? 700 : 600}; color:${tone || '#0f172a'};">${escHtml(value)}</span>
    </div>`;

  let totalsRows = '';
  if (subtotalVal > 0) totalsRows += totalRow(L.subtotalLabel, formatNoteCurrency(subtotalVal, currencySymbol));
  if (taxTotalVal > 0) totalsRows += totalRow(L.taxLabel, `+${formatNoteCurrency(taxTotalVal, currencySymbol)}`);
  if (discountVal > 0) totalsRows += totalRow(L.discountLabel, `-${formatNoteCurrency(discountVal, currencySymbol)}`, '#059669');
  if (roundOffVal !== 0) totalsRows += totalRow(L.roundOffLabel, `${roundOffVal >= 0 ? '' : '-'}${formatNoteCurrency(Math.abs(roundOffVal), currencySymbol)}`);
  if (paidVal > 0) {
    totalsRows += totalRow(L.paidLabel, formatNoteCurrency(paidVal, currencySymbol));
    totalsRows += totalRow(L.balanceLabel, formatNoteCurrency(balanceVal, currencySymbol), balanceVal > 0 ? '#be123c' : '#047857');
  }

  const totalsHtml =
    lines.length > 0 || grandTotalVal > 0
      ? `
      <div style="margin-top:20px; padding:14px 16px; background:${brandLightBg}; border:1px solid ${brandColor}44; border-radius:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap;">
          <div style="min-width:180px;">
            <div style="font-size:10px; font-weight:800; text-transform:uppercase; color:${brandColor}; letter-spacing:0.5px;">${escHtml(L.totalLabel)}</div>
            ${totalsRows}
          </div>
          <div style="text-align:right;">
            <div style="font-size:22px; font-weight:900; color:${brandColor}; font-family:'Segoe UI', sans-serif;">${formatNoteCurrency(grandTotalVal, currencySymbol)}</div>
            ${paidVal > 0 && grandTotalVal > 0 ? `<div style="font-size:10px; color:#64748b; margin-top:2px;">${escHtml(L.balanceLabel)}: ${formatNoteCurrency(balanceVal, currencySymbol)}</div>` : ''}
          </div>
        </div>
      </div>`
      : '';

  // ── Terms footer ──
  const termsText =
    String(template?.termsText || '').trim() ||
    String(company.terms_and_conditions || '').trim() ||
    String(doc.terms || '').trim();
  const termsHtml = termsText
    ? `
      <div style="margin-top:20px; font-size:10.5px; color:#475569; line-height:1.5;">
        <div style="font-size:10px; font-weight:800; text-transform:uppercase; color:#64748b; margin-bottom:4px;">${escHtml(L.termsLabel)}</div>
        ${escHtml(termsText).replace(/\n/g, '<br/>')}
      </div>`
    : '';

  // ── Signature (template.fields.showSignature !== false) ──
  const fields = template?.fields || {};
  const showSignature = fields.showSignature !== false && fields.showStamp !== false;
  const signatureUrl =
    (template?.signatureUrl && String(template.signatureUrl).trim()) ||
    (company.signature_url && String(company.signature_url).trim()) ||
    '';
  const signatureHtml = showSignature
    ? `
      <div style="margin-top:32px; display:flex; justify-content:space-between; align-items:flex-end; gap:24px;">
        <div style="text-align:center; min-width:180px;">
          ${signatureUrl ? `<img src="${escHtml(signatureUrl)}" alt="Signature" style="max-height:44px; max-width:160px; object-fit:contain; margin-bottom:4px;" />` : ''}
          <div style="border-top:1.5px solid #94a3b8; padding-top:6px; font-size:11px; font-weight:600; color:#0f172a;">${escHtml(L.forLabel)}</div>
          <div style="font-size:10px; color:#64748b; margin-top:2px;">${escHtml(L.signatureTitle)}</div>
        </div>
        <div style="text-align:center; min-width:180px;">
          <div style="border-top:1.5px solid #94a3b8; padding-top:6px; font-size:11px; font-weight:600; color:#0f172a;">${escHtml(L.supplierSignatureLabel)}</div>
          <div style="font-size:10px; color:#64748b; margin-top:2px;">${escHtml(supplier)}</div>
        </div>
      </div>`
    : '';

  const disclaimer = isPo
    ? 'This is a computer-generated purchase order document. The amounts shown are as recorded at the time of printing.'
    : 'This is a computer-generated vendor invoice / purchase invoice document. The amounts shown are as recorded at the time of printing.';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escHtml(isPo ? 'Purchase Order' : 'Vendor Invoice')} - ${escHtml(docNumber)}</title>
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
              <div style="display:inline-block; background:${brandColor}; color:#ffffff; font-size:12pt; font-weight:800; padding:6px 16px; border-radius:8px; letter-spacing:0.5px;">${escHtml(docTitle)}</div>
              ${statusText ? `<div style="display:inline-block; margin-top:6px; padding:3px 10px; border-radius:999px; font-size:10px; font-weight:700; background:${brandLightBg}; color:${brandColor}; border:1px solid ${brandColor}33;">${escHtml(statusText.toUpperCase())}</div>` : ''}
            </div>
          </div>

          <div style="display:flex; gap:16px; margin-top:18px;">
            ${supplierPanel}
            ${metaPanel}
          </div>

          ${linesHtml}

          ${totalsHtml}

          ${termsHtml}

          ${signatureHtml}

          <div style="margin-top:36px; border-top:1px dashed #cbd5e1; padding-top:12px; font-size:10px; color:#94a3b8; text-align:center; line-height:1.5;">
            ${escHtml(disclaimer)}${docNumber && docNumber !== '—' ? ` · ${escHtml(docNumber)}` : ''}
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Convenience: resolve the template + billing-GST company block and render
 * the purchase document in one call.
 */
export function renderPurchaseDocumentFor(
  kind: PurchaseDocKind,
  doc: PurchaseDocumentInput,
  tenantId?: string,
  options: RenderPurchaseDocumentOptions = {},
): string {
  const template = resolvePurchasePrintTemplate(kind, tenantId);
  const company = getNoteCompanyInfo(tenantId, { currency_symbol: '₹' });
  return renderPurchaseDocument(kind, doc, company, template, options);
}
