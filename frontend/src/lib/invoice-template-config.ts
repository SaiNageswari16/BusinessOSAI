/**
 * Invoice template texts / labels config layer.
 *
 * Makes every visible word on an A4 invoice (document titles, section titles,
 * table column headers, totals labels, payment-QR / bank captions, terms,
 * signature title, thank-you, copy tag, party titles, etc.) fully editable
 * per template — like myBillBook / a Word document.
 *
 * How it works:
 *   - Each theme ships a DEFAULT label set (see THEME_DEFAULT_TEXTS).
 *   - A template may carry a `texts` override object (persisted to localStorage
 *     and the backend via the existing print-template save pipeline).
 *   - `resolveInvoiceTexts(template, theme)` returns `{ ...themeDefaults, ...template.texts }`
 *     so a user-edited label wins, and anything left unedited keeps the theme's
 *     default. Nothing is hard-coded downstream — themes always read from here.
 */

export interface InvoiceTexts {
  // Document titles
  invoiceTitle: string;
  quotationTitle: string;
  estimateTitle: string;
  proformaTitle: string;
  challanTitle: string;
  copyTag: string;
  companyTagline: string;

  // Meta labels
  invoiceNoLabel: string;
  quoteNoLabel: string;
  estimateNoLabel: string;
  proformaNoLabel: string;
  challanNoLabel: string;
  challanDateLabel: string;
  invoiceDateLabel: string;
  quoteDateLabel: string;
  estimateDateLabel: string;
  dueDateLabel: string;
  placeOfSupplyLabel: string;
  poNumberLabel: string;
  vehicleNoLabel: string;
  ewayBillLabel: string;
  orderDateLabel: string;
  transportLabel: string;
  casesModeLabel: string;
  ackDateLabel: string;
  cinLabel: string;
  panLabel: string;
  stateLabel: string;
  custContactLabel: string;
  pageLabel: string;

  // Party
  partyTitle: string;
  shipToTitle: string;
  partyGstinLabel: string;
  partyBalanceLabel: string;
  outstandingLabel: string;
  addressLabel: string;
  gstinLabel: string;
  phoneLabel: string;
  emailLabel: string;
  partyGenderLabel: string;
  partyDobLabel: string;
  partyAgeLabel: string;

  // Items table headers
  colSno: string;
  colDescription: string;
  colHsn: string;
  colBatch: string;
  colUom: string;
  colMrp: string;
  colQty: string;
  colRate: string;
  colDiscount: string;
  colTaxRate: string;
  colAmount: string;
  cgstCol: string;
  sgstCol: string;
  igstCol: string;
  mfrLabel: string;
  packLabel: string;
  grossAmtLabel: string;
  freeLabel: string;
  discAmtLabel: string;
  totTaxLabel: string;
  taxableAmtLabel: string;
  imgLabel: string;

  // Totals
  subtotalLabel: string;
  taxableLabel: string;
  cgstLabel: string;
  sgstLabel: string;
  igstLabel: string;
  totalTaxLabel: string;
  grandTotalLabel: string;
  amountInWordsLabel: string;
  roundOffLabel: string;
  receivedAmountLabel: string;
  balanceDueLabel: string;
  youSavedLabel: string;
  totalQtyLabel: string;
  totalItemsLabel: string;
  totalBilledQtyLabel: string;
  paymentModeLabel: string;
  sgstPayableLabel: string;
  cgstPayableLabel: string;

  // Payment QR / bank
  scanToPayLabel: string;
  upiLabel: string;
  bankDetailsLabel: string;

  // Footer
  termsLabel: string;
  declarationLabel: string;
  signatureTitle: string;
  receiverSigLabel: string;
  forLabel: string;
  thankYouLabel: string;
  msgLabel: string;

  // Receipt-specific (80mm / 58mm thermal) labels
  cashierLabel: string;
  changeLabel: string;
  receiptTitle: string;
  paidViaLabel: string;
}

type TextsMap = Record<string, InvoiceTexts>;

const BASE: InvoiceTexts = {
  invoiceTitle: "TAX INVOICE",
  quotationTitle: "TAX QUOTATION / ESTIMATE",
  estimateTitle: "TAX ESTIMATE",
  proformaTitle: "PROFORMA INVOICE",
  challanTitle: "DELIVERY CHALLAN",
  copyTag: "ORIGINAL FOR RECIPIENT",
  companyTagline: "Authorized Business Organization",

  invoiceNoLabel: "Invoice No",
  quoteNoLabel: "Quote No",
  estimateNoLabel: "Estimate No",
  proformaNoLabel: "Proforma No",
  challanNoLabel: "Challan No",
  challanDateLabel: "Challan Date",
  invoiceDateLabel: "Invoice Date",
  quoteDateLabel: "Quote Date",
  estimateDateLabel: "Estimate Date",
  dueDateLabel: "Due Date",
  placeOfSupplyLabel: "Place of Supply",
  poNumberLabel: "PO / Order Ref",
  vehicleNoLabel: "Vehicle No",
  ewayBillLabel: "e-Way Bill",
  orderDateLabel: "Order Date",
  transportLabel: "Transport",
  casesModeLabel: "Cases / Mode",
  ackDateLabel: "Ack. Date",
  cinLabel: "CIN",
  panLabel: "PAN",
  stateLabel: "State",
  custContactLabel: "Cust Contact",
  pageLabel: "Page No",

  partyTitle: "Bill To / Customer",
  shipToTitle: "Ship To / Destination",
  partyGstinLabel: "GSTIN",
  partyBalanceLabel: "Party Balance",
  outstandingLabel: "Outstanding",
  addressLabel: "Address",
  gstinLabel: "GSTIN",
  phoneLabel: "Ph",
  emailLabel: "Email",
  partyGenderLabel: "Gender",
  partyDobLabel: "Date of Birth",
  partyAgeLabel: "Age",

  colSno: "S.No",
  colDescription: "Items / Services",
  colHsn: "HSN/SAC",
  colBatch: "Batch",
  colUom: "UOM",
  colMrp: "MRP",
  colQty: "Qty",
  colRate: "Rate",
  colDiscount: "Disc",
  colTaxRate: "GST%",
  colAmount: "Amount",
  cgstCol: "CGST%",
  sgstCol: "SGST%",
  igstCol: "IGST%",
  mfrLabel: "Mfr",
  packLabel: "Pack",
  grossAmtLabel: "GrossAmt",
  freeLabel: "Free",
  discAmtLabel: "Disc.Amt",
  totTaxLabel: "Tot.Tax",
  taxableAmtLabel: "Taxable Amt",
  imgLabel: "Img",

  subtotalLabel: "Sub Total",
  taxableLabel: "Taxable Amount",
  cgstLabel: "CGST",
  sgstLabel: "SGST",
  igstLabel: "IGST",
  totalTaxLabel: "Total Tax",
  grandTotalLabel: "Grand Total",
  amountInWordsLabel: "Amount in Words",
  roundOffLabel: "Round Off",
  receivedAmountLabel: "Amount Received",
  balanceDueLabel: "Balance Due",
  youSavedLabel: "You Saved",
  totalQtyLabel: "Total Qty",
  totalItemsLabel: "Total Items",
  totalBilledQtyLabel: "Total Billed Qty",
  paymentModeLabel: "Payment Mode",
  sgstPayableLabel: "SGST Payable",
  cgstPayableLabel: "CGST Payable",

  scanToPayLabel: "Scan to Pay",
  upiLabel: "UPI",
  bankDetailsLabel: "Bank Details",

  termsLabel: "Terms & Conditions",
  declarationLabel: "Declaration",
  signatureTitle: "Authorised Signatory",
  receiverSigLabel: "Receiver Signature",
  forLabel: "FOR",
  thankYouLabel: "Thank You!",
  msgLabel: "MSG",

  // Receipt-specific (80mm / 58mm thermal) labels
  cashierLabel: "Cashier",
  changeLabel: "Change",
  receiptTitle: "TAX INVOICE",
  paidViaLabel: "Paid Via",
};

/**
 * Per-theme label sets. Each predefined template "comes with its own settings"
 * but all are fully editable — these are only the starting defaults a user can
 * override via the Texts & Labels editor.
 */
export const THEME_DEFAULT_TEXTS: TextsMap = {
  gst_tally: { ...BASE },
  marg_pharma: {
    ...BASE,
    invoiceTitle: "GST INVOICE",
    partyTitle: "Party Name",
    shipToTitle: "Delivery Location",
    colSno: "S.",
    colDescription: "Product Name",
    colMrp: "M.R.P",
    colQty: "Qty.",
    totalTaxLabel: "TOTAL GST",
    grandTotalLabel: "Grand Total",
  },
  fmcg_distributor: {
    ...BASE,
    quotationTitle: "TAX QUOTATION / ESTIMATE",
    estimateTitle: "TAX ESTIMATE / ESTIMATE",
    partyTitle: "Billed To",
    shipToTitle: "Shipped To",
    colDescription: "Item Name",
    colHsn: "HSN",
  },
  parle_teal: {
    ...BASE,
    invoiceTitle: "GST TAX INVOICE",
    quotationTitle: "TAX QUOTATION",
    estimateTitle: "TAX ESTIMATE",
    partyTitle: "Customer / Bill To",
    colHsn: "HSN CODE",
    totalTaxLabel: "GST",
  },
  agri_seeds: {
    ...BASE,
    invoiceTitle: "GST INVOICE",
    partyTitle: "Buyer (Bill To)",
    shipToTitle: "Ship To (Delivery)",
    colDescription: "Product / Description",
    colBatch: "Lot/Batch",
    totalTaxLabel: "GST / Tax",
  },
  word_studio: { ...BASE },
  // Legacy / decorative themes reuse the base set; users can still override.
  luxury: { ...BASE },
  tally: { ...BASE },
  adv_gst: { ...BASE },
  billbook: { ...BASE, invoiceTitle: "TAX INVOICE" },
  modern: { ...BASE },
  culture_up: { ...BASE },
  culture_god: { ...BASE },
  simple: { ...BASE },
  stylish: { ...BASE },
  pdf_stationery_overlay: { ...BASE },
};

/**
 * Resolve the effective texts for a template + theme:
 *   theme defaults  <  user's persisted `texts` override.
 * Falls back to the base set for any theme not in the map.
 */
export function resolveInvoiceTexts(template: any, theme?: string | null): InvoiceTexts {
  const resolvedTheme = theme || String(template?.themeName || "");
  const defaults = THEME_DEFAULT_TEXTS[resolvedTheme] || BASE;
  const override: InvoiceTexts | undefined =
    (template && (template.texts || (template as any).labels)) || undefined;
  return { ...BASE, ...defaults, ...(override || {}) };
}

// ── Shared renderer resolution (preview + print must AGREE) ───────────────
// One single source of truth for "which engine renders this template". The
// designer's Live Preview, the print modal (FullInvoicePrinter), and any
// future surface all call this, so a template can no longer render as a Word
// mock in one place and a named theme in another.

export type InvoiceRendererKey =
  | 'word'
  | 'pdf_overlay'
  | 'marg_pharma'
  | 'fmcg_distributor'
  | 'parle_teal'
  | 'agri_seeds'
  | 'gst_tally'
  | 'default';

/**
 * Derive the effective theme for a template: explicit `themeName` first, then
 * keyword detection on name / id (mirrors the long-standing detection used
 * by the print path, so legacy templates keep working).
 */
export function resolveInvoiceThemeName(template: any): string {
  if (template?.themeName && !String(template.themeName).startsWith('global_')) return template.themeName;
  if (String(template?.themeName || '').startsWith('global_')) return 'word_studio';
  const name = String(template?.name || '').toLowerCase();
  const id = String(template?.id || '').toLowerCase();
  if (id.startsWith('tpl-word-') || id.startsWith('tpl-inv-global-')) return 'word_studio';
  if (name.includes('marg') || id.includes('marg')) return 'marg_pharma';
  if (name.includes('fmcg') || id.includes('fmcg')) return 'fmcg_distributor';
  if (name.includes('parle') || id.includes('parle')) return 'parle_teal';
  if (name.includes('gst tally') || name.includes('gst-tally') || id.includes('gst-tally')) return 'gst_tally';
  if (name.includes('agri') || id.includes('agri') || name.includes('seed') || id.includes('seed')) return 'agri_seeds';
  if (name.includes('luxury') || id.includes('luxury')) return 'luxury';
  if (name.includes('tally') || id.includes('tally')) return 'tally';
  if (name.includes('adv') || id.includes('adv')) return 'adv_gst';
  if (name.includes('billbook') || id.includes('billbook')) return 'billbook';
  if (name.includes('modern') || id.includes('modern')) return 'modern';
  if (name.includes('god') || id.includes('god')) return 'culture_god';
  if (name.includes('word') || id.includes('word') || name.includes('studio') || id.includes('studio')) return 'word_studio';
  return 'stylish';
}

/**
 * The single renderer decision. Rules (most specific wins):
 *  1. PDF stationery overlay flags  → overlay engine (even if a wordConfig is
 *     attached, e.g. when a Word Studio save merged one onto the overlay
 *     template — it must still render as the overlay design).
 *  2. Named replica themes (Marg / FMCG / Parle / Agri / GST Tally) keep
 *     their fixed design even when a wordConfig is attached to them.
 *  3. Genuinely Word-studio templates (wordConfig, tpl-word-* ids,
 *     word_studio / global_* themes, isWordTemplate flag) → Word engine.
 *  4. Everything else → the default designer engine.
 */
export function resolveInvoiceRenderer(template: any): { renderer: InvoiceRendererKey; theme: string } {
  const theme = resolveInvoiceThemeName(template);
  const isPdfOverlay =
    theme === 'pdf_stationery_overlay' ||
    template?.isPdfStationeryOverlay === true ||
    Boolean(template?.pdfBackgroundDataUrl);
  const isNamedReplica =
    theme === 'marg_pharma' || theme === 'fmcg_distributor' || theme === 'parle_teal' ||
    theme === 'agri_seeds' || theme === 'gst_tally';
  if (isPdfOverlay) return { renderer: 'pdf_overlay', theme };
  if (isNamedReplica) return { renderer: theme as InvoiceRendererKey, theme };
  const isWord = Boolean(
    (template?.wordConfig && !isNamedReplica) ||
    String(template?.id || '').startsWith('tpl-word-') ||
    String(template?.id || '').startsWith('tpl-inv-global-') ||
    theme === 'word_studio' ||
    (template as any)?.isWordTemplate === true
  );
  if (isWord) return { renderer: 'word', theme: 'word_studio' };
  return { renderer: 'default', theme };
}

/** Convenience: pick the doc title + number/date label for the current doc type. */
export function docTitleFor(invoice: any, texts: InvoiceTexts, template?: any): string {
  const type = String(invoice?.invoice_type || invoice?.doc_type || "").toUpperCase();
  const num = String(invoice?.invoice_number || invoice?.quote_number || "").toUpperCase();
  const isChallan = type === "CHALLAN" || type === "DELIVERY_CHALLAN" || num.startsWith("DC-");
  const isQuote = type === "QUOTATION" || num.startsWith("QT-");
  const isEstimate = type === "ESTIMATE_NON_GST" || type === "ESTIMATE" || num.startsWith("EST-");
  const isProforma = type === "PROFORMA" || num.startsWith("PI-");

  const currentDocCategory = isChallan
    ? "challan"
    : isQuote
      ? "quotation"
      : isEstimate
        ? "estimate"
        : isProforma
          ? "proforma"
          : "invoice";

  const tplCat = template?.docCategory || template?.category;
  const isTemplateCatMismatch = Boolean(tplCat && tplCat !== currentDocCategory && tplCat !== "all");

  const templateTitle = !isTemplateCatMismatch
    ? String(template?.invoice?.documentTitle || template?.headerTitle || "").trim()
    : "";

  const invoiceForcedTitle = String(
    invoice?.header_title || (invoice as any)?.documentTitle || ""
  ).trim();

  const isGenericTaxTitle = /^tax\s+invoice$/i.test(templateTitle) || /^invoice$/i.test(templateTitle);
  const suppressGenericTaxTitle = (isQuote || isProforma || isChallan || isEstimate) && isGenericTaxTitle && tplCat !== currentDocCategory;

  const forced = invoiceForcedTitle || (!suppressGenericTaxTitle ? templateTitle : "");

  if (isChallan) return forced || texts.challanTitle || "DELIVERY CHALLAN";
  if (isEstimate) return forced || texts.estimateTitle;
  if (isProforma) return forced || texts.proformaTitle;
  if (isQuote) return forced || texts.quotationTitle;
  return forced || texts.invoiceTitle;
}

export function docNoLabelFor(invoice: any, texts: InvoiceTexts): string {
  const type = String(invoice?.invoice_type || invoice?.doc_type || "").toUpperCase();
  const num = String(invoice?.invoice_number || invoice?.quote_number || "").toUpperCase();
  if (type === "CHALLAN" || type === "DELIVERY_CHALLAN" || num.startsWith("DC-")) return texts.challanNoLabel;
  if (type === "QUOTATION" || num.startsWith("QT-")) return texts.quoteNoLabel;
  if (type === "ESTIMATE_NON_GST" || type === "ESTIMATE" || num.startsWith("EST-")) return texts.estimateNoLabel;
  if (type === "PROFORMA" || num.startsWith("PI-")) return texts.proformaNoLabel;
  return texts.invoiceNoLabel;
}

export function docDateLabelFor(invoice: any, texts: InvoiceTexts): string {
  const type = String(invoice?.invoice_type || invoice?.doc_type || "").toUpperCase();
  const num = String(invoice?.invoice_number || invoice?.quote_number || "").toUpperCase();
  if (type === "CHALLAN" || type === "DELIVERY_CHALLAN" || num.startsWith("DC-")) return texts.challanDateLabel || texts.invoiceDateLabel;
  if (type === "QUOTATION" || num.startsWith("QT-")) return texts.quoteDateLabel;
  if (type === "ESTIMATE_NON_GST" || type === "ESTIMATE" || num.startsWith("EST-")) return texts.estimateDateLabel;
  return texts.invoiceDateLabel;
}

// ── Data-driven groups for the "Texts & Labels" editor UI ─────────────────
// Each group lists text keys so the editor can render inputs generically and
// persist them into `template.texts`.
export interface TextLabelGroup {
  title: string;
  items: { key: keyof InvoiceTexts; label: string; placeholder?: string }[];
}

export const TEXT_LABEL_GROUPS: TextLabelGroup[] = [
  {
    title: "Document Titles & Copy Tag",
    items: [
      { key: "invoiceTitle", label: "Invoice Title", placeholder: "TAX INVOICE" },
      { key: "quotationTitle", label: "Quotation Title", placeholder: "TAX QUOTATION / ESTIMATE" },
      { key: "estimateTitle", label: "Estimate Title", placeholder: "TAX ESTIMATE" },
      { key: "proformaTitle", label: "Proforma Title", placeholder: "PROFORMA INVOICE" },
      { key: "challanTitle", label: "Challan Title", placeholder: "DELIVERY CHALLAN" },
      { key: "copyTag", label: "Copy Tag", placeholder: "ORIGINAL FOR RECIPIENT" },
      { key: "companyTagline", label: "Company Tagline", placeholder: "Authorized Business Organization" },
    ],
  },
  {
    title: "Invoice Meta Labels",
    items: [
      { key: "invoiceNoLabel", label: "Invoice No Label" },
      { key: "quoteNoLabel", label: "Quotation No Label" },
      { key: "estimateNoLabel", label: "Estimate No Label" },
      { key: "proformaNoLabel", label: "Proforma No Label" },
      { key: "invoiceDateLabel", label: "Invoice Date Label" },
      { key: "challanDateLabel", label: "Challan Date Label" },
      { key: "dueDateLabel", label: "Due Date Label" },
      { key: "placeOfSupplyLabel", label: "Place of Supply Label" },
      { key: "poNumberLabel", label: "PO / Order Ref Label" },
      { key: "vehicleNoLabel", label: "Vehicle No Label" },
      { key: "ewayBillLabel", label: "e-Way Bill Label" },
      { key: "challanNoLabel", label: "Challan No Label" },
      { key: "transportLabel", label: "Transport Label" },
    ],
  },
  {
    title: "Party / Customer Labels",
    items: [
      { key: "partyTitle", label: "Bill-To Title" },
      { key: "partyGenderLabel", label: "Gender Label" },
      { key: "partyDobLabel", label: "Date of Birth Label" },
      { key: "partyAgeLabel", label: "Age Label" },
      { key: "shipToTitle", label: "Ship-To Title" },
      { key: "partyGstinLabel", label: "Party GSTIN Label" },
      { key: "outstandingLabel", label: "Outstanding Balance Label" },
      { key: "addressLabel", label: "Address Label" },
    ],
  },
  {
    title: "Items Table Column Headers",
    items: [
      { key: "colSno", label: "S.No Header" },
      { key: "colDescription", label: "Description Header" },
      { key: "colHsn", label: "HSN Header" },
      { key: "colBatch", label: "Batch Header" },
      { key: "colUom", label: "UOM Header" },
      { key: "colMrp", label: "MRP Header" },
      { key: "colQty", label: "Qty Header" },
      { key: "colRate", label: "Rate Header" },
      { key: "colDiscount", label: "Discount Header" },
      { key: "colTaxRate", label: "GST % Header" },
      { key: "colAmount", label: "Amount Header" },
      { key: "cgstCol", label: "CGST % Header" },
      { key: "sgstCol", label: "SGST % Header" },
      { key: "igstCol", label: "IGST % Header" },
    ],
  },
  {
    title: "Totals & Summary Labels",
    items: [
      { key: "subtotalLabel", label: "Sub Total Label" },
      { key: "taxableLabel", label: "Taxable Amount Label" },
      { key: "cgstLabel", label: "CGST Label" },
      { key: "sgstLabel", label: "SGST Label" },
      { key: "igstLabel", label: "IGST Label" },
      { key: "totalTaxLabel", label: "Total Tax Label" },
      { key: "grandTotalLabel", label: "Grand Total Label" },
      { key: "amountInWordsLabel", label: "Amount in Words Label" },
      { key: "roundOffLabel", label: "Round Off Label" },
      { key: "receivedAmountLabel", label: "Received Amount Label" },
      { key: "balanceDueLabel", label: "Balance Due Label" },
      { key: "paymentModeLabel", label: "Payment Mode Label" },
    ],
  },
  {
    title: "Payment QR & Bank",
    items: [
      { key: "scanToPayLabel", label: "Scan-to-Pay Caption" },
      { key: "upiLabel", label: "UPI Label" },
      { key: "bankDetailsLabel", label: "Bank Details Label" },
    ],
  },
  {
    title: "Footer & Signature",
    items: [
      { key: "termsLabel", label: "Terms Label" },
      { key: "declarationLabel", label: "Declaration Label" },
      { key: "signatureTitle", label: "Signature Title" },
      { key: "forLabel", label: "For Label" },
      { key: "thankYouLabel", label: "Thank You Message" },
    ],
  },
];

/**
 * Toggleable field groups for the "Fields & Sections" editor — the checkboxes
 * that show/hide sections and table columns. Mirrors the `f` object in
 * FullInvoicePrinter.
 */
export interface FieldGroup {
  title: string;
  items: { key: string; label: string }[];
}

export const FIELD_GROUPS: FieldGroup[] = [
  {
    title: "Sections",
    items: [
      { key: "showHeader", label: "Header & Logo" },
      { key: "showCompanyDetails", label: "Company Details" },
      { key: "showInvoiceDetails", label: "Invoice / Meta Details" },
      { key: "showCustomerDetails", label: "Customer / Party Details" },
      { key: "showItemTable", label: "Items Table" },
      { key: "showTaxSplit", label: "Tax Split (CGST/SGST/IGST)" },
      { key: "showTotals", label: "Summary Totals" },
      { key: "showBankDetails", label: "Bank Details" },
      { key: "showPaymentDetails", label: "Payment Details" },
      { key: "showQR", label: "UPI / Payment QR" },
      { key: "showTerms", label: "Terms & Conditions" },
      { key: "showDeclaration", label: "Declaration" },
      { key: "showSignature", label: "Signature & Stamp" },
      { key: "showThankYou", label: "Thank You Note" },
      { key: "showFooter", label: "Footer" },
    ],
  },
  {
    title: "Items Table Columns",
    items: [
      { key: "showItemIndex", label: "S.No" },
      { key: "showHSN", label: "HSN/SAC" },
      { key: "showBatchNumber", label: "Batch" },
      { key: "showExpMfgDates", label: "Expiry / Mfg Dates" },
      { key: "showItemDescription", label: "Description" },
      { key: "showMRP", label: "MRP" },
      { key: "showSecondaryUnit", label: "UOM" },
      { key: "showItemRate", label: "Rate" },
      { key: "showDiscountCol", label: "Discount" },
      { key: "showGstRateCol", label: "GST %" },
      { key: "showItemQty", label: "Quantity" },
      { key: "showItemAmount", label: "Amount" },
      { key: "showSKU", label: "SKU" },
      { key: "showProductImage", label: "Product Image" },
    ],
  },
];

/** All boolean `f` flags with their default values (used to seed a new template). */
export const DEFAULT_INVOICE_FIELDS: Record<string, boolean> = {
  showHeader: true,
  showLogo: true,
  showCompanyDetails: true,
  showInvoiceDetails: true,
  showItemTable: true,
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
  showTerms: true,
  showBarcode: true,
  showQR: true,
  showProductImage: false,
  showPaymentDetails: true,
  showTotals: true,
  showFooter: true,
  showThankYou: true,
  showDeclaration: true,
  showItemIndex: true,
  showBatchNumber: true,
  showExpMfgDates: true,
  showSecondaryUnit: true,
  showItemRate: true,
  showDiscountCol: true,
  showGstRateCol: true,
  showItemQty: true,
  showItemAmount: true,
};

// ── Per-category template slots ────────────────────────────────────────────
// Each document category can have its OWN active template. When a category has
// none set, it falls back to the invoice slot, so every document always renders
// through exactly one chosen design across every mode (save, print, PDF, email,
// WhatsApp).
export type InvoiceDocCategory =
  | "invoice"
  | "quotation"
  | "proforma"
  | "estimate"
  | "credit_note"
  | "debit_note"
  | "purchase_invoice"
  | "purchase_order"
  | "challan";

// Per-category picker shows the sales flow only. Credit / Debit notes have their
// own separate template systems and are intentionally NOT listed here — they
// always render through their own/standard templates (detectDocCategory still
// recognizes them, they just don't get a picker slot and follow the master).
export const INVOICE_DOC_CATEGORIES: { key: InvoiceDocCategory; label: string }[] = [
  { key: "invoice", label: "Tax Invoice" },
  { key: "quotation", label: "Quotation" },
  { key: "proforma", label: "Proforma" },
  { key: "estimate", label: "Estimate" },
  { key: "challan", label: "Delivery Challan" },
];

// ── Party Details Layouts (myBillBook parity) ─────────────────────────────
export type PartyLayoutType = "layout_1" | "layout_2" | "layout_3";

export interface PartyLayoutOption {
  id: PartyLayoutType;
  title: string;
  description: string;
  badge?: string;
}

export const PARTY_LAYOUT_OPTIONS: PartyLayoutOption[] = [
  {
    id: "layout_1",
    title: "Side-by-Side",
    description: "Bill To on left, Ship To on right in a partitioned party grid",
    badge: "Recommended",
  },
  {
    id: "layout_2",
    title: "3-Box Header Split",
    description: "Seller on left, Invoice Meta in center, Party on right",
  },
  {
    id: "layout_3",
    title: "Stacked / Full Width",
    description: "Bill To stacked above Ship To across full page width",
  },
];

/** Detect the document category from a FullInvoiceData-like payload. */
export function detectDocCategory(invoice: any): InvoiceDocCategory {
  const type = String(invoice?.invoice_type || invoice?.doc_type || "").toUpperCase();
  // Quotations / proformas / estimates created from POS & Sales History carry
  // their number in `quote_number`, not `invoice_number` — check both, or the
  // document is misclassified as a plain "invoice" and the per-category
  // template assignment is silently ignored.
  const num = String(invoice?.invoice_number || invoice?.quote_number || "").toUpperCase();
  if (type === "CREDIT_NOTE" || type === "CREDITNOTE" || type === "CREDIT" || num.startsWith("CN-") || num.startsWith("CRN-")) return "credit_note";
  if (type === "DEBIT_NOTE" || type === "DEBITNOTE" || type === "DEBIT" || num.startsWith("DN-") || num.startsWith("DRN-")) return "debit_note";
  // Purchase docs (vendor bills / outbound POs): their prefixes (PINV- / PO-)
  // must be detected BEFORE falling through to the tax-invoice default, and are
  // distinct from the sales proforma "PI-" prefix above.
  if (type === "PURCHASE_INVOICE" || type === "VENDOR_BILL" || type === "BILL" || num.startsWith("PINV-")) return "purchase_invoice";
  if (type === "PURCHASE_ORDER" || num.startsWith("PO-")) return "purchase_order";
  // Delivery challans: doc_type 'challan'/'delivery_challan' or a DC- number
  // prefix. (A plain invoice that merely REFERENCEs a challan number is NOT
  // a challan document — that's why we don't key off challan_number.)
  if (type === "CHALLAN" || type === "DELIVERY_CHALLAN" || num.startsWith("DC-")) return "challan";
  if (type === "PROFORMA" || num.startsWith("PI-")) return "proforma";
  if (type === "ESTIMATE_NON_GST" || type === "ESTIMATE" || num.startsWith("EST-")) return "estimate";
  if (type === "QUOTATION" || num.startsWith("QT-")) return "quotation";
  return "invoice";
}

// ── Receipt / Barcode (80mm & 58mm thermal + price labels) text layer ─────
// These templates link to the master invoice template: any label not set on the
// receipt/barcode itself inherits the master's editable word. The groups below
// drive the "Texts & Labels" editor for receipts/barcodes (myBillBook / Word
// style) so every visible word is changeable — nothing hard-coded.
export interface ReceiptTexts {
  receiptTitle: string;
  invoiceNoLabel: string;
  invoiceDateLabel: string;
  cashierLabel: string;
  partyTitle: string;
  phoneLabel: string;
  gstinLabel: string;
  addressLabel: string;
  colDescription: string;
  colQty: string;
  colRate: string;
  colAmount: string;
  subtotalLabel: string;
  taxableLabel: string;
  cgstLabel: string;
  sgstLabel: string;
  igstLabel: string;
  totalTaxLabel: string;
  grandTotalLabel: string;
  receivedAmountLabel: string;
  changeLabel: string;
  outstandingLabel: string;
  paymentModeLabel: string;
  scanToPayLabel: string;
  upiLabel: string;
  bankDetailsLabel: string;
  termsLabel: string;
  declarationLabel: string;
  signatureTitle: string;
  forLabel: string;
  thankYouLabel: string;
}

type ReceiptTextsMap = Record<string, ReceiptTexts>;

/** Receipt/barcode defaults — the subset of `BASE` a thermal receipt shows. */
export const RECEIPT_TEXTS_BASE: ReceiptTexts = {
  receiptTitle: "TAX INVOICE",
  invoiceNoLabel: "INV",
  invoiceDateLabel: "DATE",
  cashierLabel: "CASHIER",
  partyTitle: "CUSTOMER",
  phoneLabel: "MOB",
  gstinLabel: "GSTIN",
  addressLabel: "ADDR",
  colDescription: "ITEM",
  colQty: "QTY",
  colRate: "RATE",
  colAmount: "AMT",
  subtotalLabel: "SUBTOTAL",
  taxableLabel: "Taxable Amount",
  cgstLabel: "CGST",
  sgstLabel: "SGST",
  igstLabel: "IGST Tax",
  totalTaxLabel: "Total Tax (GST)",
  grandTotalLabel: "NET PAYABLE",
  receivedAmountLabel: "AMOUNT RECEIVED",
  changeLabel: "CHANGE RETURNED",
  outstandingLabel: "CUSTOMER LEDGER OUTSTANDING",
  paymentModeLabel: "PAID VIA",
  scanToPayLabel: "Scan to Pay",
  upiLabel: "UPI",
  bankDetailsLabel: "Bank Details",
  termsLabel: "Terms & Conditions",
  declarationLabel: "Declaration",
  signatureTitle: "Authorized Signatory",
  forLabel: "FOR",
  thankYouLabel: "Thank you for shopping with us!",
};

const RECEIPT_TEXTS_OVERRIDES: ReceiptTextsMap = {
  // 80mm "compact" preset defaults to the receipt base; users override per-template.
  compact: { ...RECEIPT_TEXTS_BASE },
  advanced: { ...RECEIPT_TEXTS_BASE, grandTotalLabel: "GRAND TOTAL", paymentModeLabel: "MODE" },
  simple: { ...RECEIPT_TEXTS_BASE, partyTitle: "Customer", phoneLabel: "Phone" },
  classic: { ...RECEIPT_TEXTS_BASE, receiptTitle: "TAX RECEIPT" },
};

/**
 * Resolve the effective receipt/barcode texts:
 *   receipt defaults  <  master invoice texts  <  this template's own `texts`.
 * Passing the master template means the receipt inherits the master's edited
 * words for any key the receipt has not set locally (the "link" behaviour).
 */
export function resolveReceiptTexts(
  receiptTemplate: any,
  masterTemplate?: any,
  theme?: string | null
): ReceiptTexts {
  const resolvedTheme = theme || String(receiptTemplate?.themeName || "compact");
  const receiptDefaults = RECEIPT_TEXTS_OVERRIDES[resolvedTheme] || RECEIPT_TEXTS_BASE;
  const masterTexts: any = (masterTemplate && (masterTemplate.texts || masterTemplate.customTexts)) || {};
  const localTexts: any =
    (receiptTemplate && (receiptTemplate.texts || receiptTemplate.customTexts || receiptTemplate.labels)) || {};
  return { ...RECEIPT_TEXTS_BASE, ...receiptDefaults, ...masterTexts, ...localTexts };
}

/** Data-driven receipt "Texts & Labels" editor groups. */
export const RECEIPT_TEXT_LABEL_GROUPS: TextLabelGroup[] = [
  {
    title: "Receipt Header",
    items: [
      { key: "receiptTitle" as any, label: "Receipt / Document Title", placeholder: "TAX INVOICE" },
      { key: "invoiceNoLabel" as any, label: "Invoice No Label", placeholder: "INV" },
      { key: "invoiceDateLabel" as any, label: "Date Label", placeholder: "DATE" },
      { key: "cashierLabel" as any, label: "Cashier Label", placeholder: "CASHIER" },
      { key: "partyTitle" as any, label: "Customer Label", placeholder: "CUSTOMER" },
    ],
  },
  {
    title: "Items & Totals",
    items: [
      { key: "colDescription" as any, label: "Item Header", placeholder: "ITEM" },
      { key: "colQty" as any, label: "Qty Header", placeholder: "QTY" },
      { key: "colRate" as any, label: "Rate Header", placeholder: "RATE" },
      { key: "colAmount" as any, label: "Amount Header", placeholder: "AMT" },
      { key: "subtotalLabel" as any, label: "Subtotal Label", placeholder: "SUBTOTAL" },
      { key: "totalTaxLabel" as any, label: "Total Tax Label", placeholder: "Total Tax (GST)" },
      { key: "grandTotalLabel" as any, label: "Grand Total Label", placeholder: "NET PAYABLE" },
    ],
  },
  {
    title: "Payment & Footer",
    items: [
      { key: "paymentModeLabel" as any, label: "Payment Mode Label", placeholder: "PAID VIA" },
      { key: "receivedAmountLabel" as any, label: "Received Label", placeholder: "AMOUNT RECEIVED" },
      { key: "changeLabel" as any, label: "Change Label", placeholder: "CHANGE RETURNED" },
      { key: "outstandingLabel" as any, label: "Outstanding Label", placeholder: "CUSTOMER LEDGER OUTSTANDING" },
      { key: "scanToPayLabel" as any, label: "Scan-to-Pay Caption", placeholder: "Scan to Pay" },
      { key: "thankYouLabel" as any, label: "Thank You Message", placeholder: "Thank you for shopping with us!" },
      { key: "signatureTitle" as any, label: "Signature Title", placeholder: "Authorized Signatory" },
    ],
  },
];

export interface NormalizedTemplateColumn {
  id: string;
  fieldKey: string;
  headerTitle: string;
  widthPercent?: number;
  align: "left" | "center" | "right";
  enabled: boolean;
  isCustom?: boolean;
  /**
   * Optional fixed display value for a user-defined `source: 'static'` custom
   * column (attached by `addCustomColumn`). When present it wins over any live
   * data lookup in `cellValueForColumn`.
   */
  staticValue?: string;
}

export function resolveTemplateColumns(
  template?: any,
  explicitColumns?: any[],
  fields?: any,
  texts?: InvoiceTexts
): NormalizedTemplateColumn[] {
  // 1. If explicitColumns is provided and non-empty, prioritize it
  const sourceCols: any[] | undefined = (Array.isArray(explicitColumns) && explicitColumns.length > 0)
    ? explicitColumns
    : (template?.itemTable?.columns && Array.isArray(template.itemTable.columns) && template.itemTable.columns.length > 0)
    ? template.itemTable.columns
    : (template?.columns && Array.isArray(template.columns) && template.columns.length > 0)
    ? template.columns
    : (template?.wordConfig?.columns && Array.isArray(template.wordConfig.columns) && template.wordConfig.columns.length > 0)
    ? template.wordConfig.columns
    : (template?.body?.columns && Array.isArray(template.body.columns) && template.body.columns.length > 0)
    ? template.body.columns
    : undefined;

  if (sourceCols && sourceCols.length > 0) {
    return sourceCols.map((col, idx) => {
      const fieldKey = col.fieldKey || col.key || `col_${idx}`;
      const headerTitle = col.headerTitle || col.label || col.name || fieldKey;
      let align: "left" | "center" | "right" = col.align || "center";
      if (!col.align) {
        if (fieldKey === "description" || fieldKey === "name" || fieldKey === "product_name") {
          align = "left";
        } else if (["unit_price", "rate", "discount", "disc", "amount", "total_amount", "mrp", "selling_price"].includes(fieldKey)) {
          align = "right";
        }
      }
      const enabled = col.enabled !== false && col.visible !== false;
      const widthPercent = typeof col.widthPercent === "number"
        ? col.widthPercent
        : (typeof col.width === "string" ? parseFloat(col.width) : undefined);
      return {
        id: col.id || `col_${fieldKey}_${idx}`,
        fieldKey,
        headerTitle,
        widthPercent,
        align,
        enabled,
        isCustom: Boolean(col.isCustom),
        staticValue: col.staticValue || col.value,
      };
    }).filter((c) => c.enabled);
  }

  // Fallback to standard columns controlled by fields toggles
  const f = fields || template?.fields || {};
  const t = texts || resolveInvoiceTexts(template);
  const cols: NormalizedTemplateColumn[] = [];

  if (f.showItemIndex !== false) {
    cols.push({ id: "col_sno", fieldKey: "sno", headerTitle: t.colSno || "S.No", widthPercent: 5, align: "center", enabled: true });
  }
  if (f.showHSN !== false) {
    cols.push({ id: "col_hsn", fieldKey: "hsn", headerTitle: t.colHsn || "HSN/SAC", widthPercent: 10, align: "center", enabled: true });
  }
  if (f.showBatchNumber !== false && (f as any).showBatch !== false) {
    cols.push({ id: "col_batch", fieldKey: "batch", headerTitle: t.colBatch || "Batch", widthPercent: 10, align: "left", enabled: true });
  }
  if (f.showExpMfgDates !== false && (f as any).showMfgExpDate !== false) {
    cols.push({ id: "col_exp", fieldKey: "expiry_date", headerTitle: t.mfrLabel || "Mfg/Exp", widthPercent: 10, align: "left", enabled: true });
  }
  cols.push({ id: "col_desc", fieldKey: "description", headerTitle: t.colDescription || "Items / Services", widthPercent: 28, align: "left", enabled: true });
  if (f.showSecondaryUnit !== false && (f as any).showUOM !== false && (f as any).showUom !== false) {
    cols.push({ id: "col_uom", fieldKey: "uom", headerTitle: t.colUom || "UOM", widthPercent: 7, align: "center", enabled: true });
  }
  if (f.showGstRateCol !== false && (f as any).showTaxRate !== false) {
    cols.push({ id: "col_tax", fieldKey: "tax_rate", headerTitle: t.colTaxRate || "GST %", widthPercent: 7, align: "center", enabled: true });
  }
  if (f.showItemRate !== false && (f as any).showRate !== false) {
    cols.push({ id: "col_rate", fieldKey: "unit_price", headerTitle: t.colRate || "Rate", widthPercent: 10, align: "right", enabled: true });
  }
  if (f.showDiscountCol !== false && (f as any).showDiscount !== false) {
    cols.push({ id: "col_disc", fieldKey: "discount", headerTitle: t.colDiscount || "Disc", widthPercent: 7, align: "right", enabled: true });
  }
  if (f.showItemQty !== false && (f as any).showQuantity !== false) {
    cols.push({ id: "col_qty", fieldKey: "quantity", headerTitle: t.colQty || "Qty", widthPercent: 7, align: "center", enabled: true });
  }
  if (f.showItemAmount !== false) {
    cols.push({ id: "col_amt", fieldKey: "total_amount", headerTitle: t.colAmount || "Amount", widthPercent: 12, align: "right", enabled: true });
  }
  return cols;
}

// ── Dynamic item-table cells: value + freeform / dispatch rows ─────────────
// Additive layer so every built-in theme can render the user's template config
// (renamed / aligned / enabled / custom columns + freeform fields) instead of
// a fully hard-coded table. Existing exports above are unchanged.

/** Standard fieldKeys the built-in themes understand out of the box. */
const STANDARD_ITEM_FIELD_KEYS: ReadonlySet<string> = new Set([
  "sno", "hsn", "batch", "expiry_date", "description", "uom", "tax_rate",
  "unit_price", "selling_price", "mrp", "discount", "quantity",
  "total_amount", "cgst", "sgst", "igst", "free_qty", "gross_amount",
]);

const toMoney = (n: number | string | null | undefined): string => {
  const num = Number(n);
  return Number.isFinite(num) ? num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-";
};

const toNumberText = (n: number | string | null | undefined, fallback = "-"): string => {
  const num = Number(n);
  return Number.isFinite(num) && (typeof n !== "string" || n.trim() !== "") ? String(num) : fallback;
};

/**
 * Resolve the display value for one normalized item-table column.
 *   - Standard fieldKeys (sno, hsn, batch, expiry_date, description, uom,
 *     tax_rate, unit_price, selling_price, mrp, discount, quantity,
 *     total_amount, cgst, sgst, igst, free_qty, gross_amount) return
 *     pre-formatted text (money via en-IN 2-dp, rates as-is, description as
 *     name + sub-details joined with " · ").
 *   - Custom / unknown fieldKeys read (in order) the item's own field, the
 *     item's `custom_fields` map, the item field by column id, the invoice's
 *     `custom_fields` map, then the invoice's own field. A static custom value
 *     (`col.staticValue`, set by `addCustomColumn` for `source: 'static'`)
 *     wins over everything. Empty values fall back to "-".
 *
 * NOTE: returns plain formatted numbers (no currency symbol) so any theme can
 * wrap it with its own `fmt` helper when the currency symbol is wanted.
 */
export function cellValueForColumn(
  col: NormalizedTemplateColumn,
  item: any,
  invoice?: any
): { text: string; raw: any } {
  const key = col.fieldKey || col.id;
  // 1. Static custom column value always wins (source === 'static').
  if (col.isCustom && col.staticValue !== undefined && col.staticValue !== null && String(col.staticValue).trim() !== "") {
    return { text: String(col.staticValue), raw: col.staticValue };
  }
  const dash = "-";
  if (STANDARD_ITEM_FIELD_KEYS.has(key)) {
    switch (key) {
      case "sno":
        return { text: toNumberText(item?.sno ?? (item?.line_no ?? item?.s_number), String(dash)), raw: item?.sno ?? item?.line_no ?? item?.s_number };
      case "hsn": {
        const v = item?.hsn_code ?? item?.sac_code ?? item?.hsn ?? "";
        return { text: String(v || dash), raw: v };
      }
      case "batch": {
        const v = item?.batch_no ?? item?.batch_number ?? item?.lot_no ?? item?.batch ?? "";
        return { text: String(v || dash), raw: v };
      }
      case "expiry_date": {
        const v = item?.exp_date ?? item?.expiry_date ?? item?.expiry ?? item?.mfg_date ?? item?.manufacturing_date ?? "";
        return { text: String(v || dash), raw: v };
      }
      case "description": {
        const name = String(item?.product_name ?? item?.name ?? item?.item_name ?? item?.description_title ?? "");
        const sub = [
          item?.description,
          item?.custom_note,
          item?.notes,
          item?.secondary_uom,
        ].filter(Boolean).join(" · ");
        const text = sub ? (name ? `${name} · ${sub}` : sub) : (name || dash);
        return { text, raw: text };
      }
      case "uom": {
        const v = item?.selected_uom ?? item?.uom ?? item?.measuring_unit ?? item?.secondary_unit ?? "";
        return { text: String(v || dash), raw: v };
      }
      case "tax_rate": {
        const n = Number(item?.tax_rate ?? item?.gst_rate ?? 0);
        return { text: Number.isFinite(n) ? String(n) : dash, raw: n };
      }
      case "unit_price":
      case "selling_price":
      case "mrp":
      case "discount":
      case "cgst":
      case "sgst":
      case "igst":
      case "gross_amount":
      case "total_amount": {
        const rawMap: Record<string, any> = {
          unit_price: item?.unit_price ?? item?.rate ?? item?.selling_price,
          selling_price: item?.selling_price ?? item?.unit_price,
          mrp: item?.mrp ?? item?.m_r_p,
          discount: item?.discount_value ?? item?.discount_amount ?? item?.discount,
          cgst: item?.cgst ?? item?.cgst_amount,
          sgst: item?.sgst ?? item?.sgst_amount,
          igst: item?.igst ?? item?.igst_amount,
          gross_amount: item?.gross_amount ?? item?.taxable_amount,
          total_amount: item?.total_amount ?? item?.subtotal ?? item?.amount,
        };
        const raw = rawMap[key];
        return { text: toMoney(raw), raw };
      }
      case "quantity": {
        const raw = item?.quantity ?? item?.qty;
        return { text: Number(raw) > 0 ? String(Number(raw)) : dash, raw };
      }
      case "free_qty": {
        const raw = item?.free_qty ?? item?.free_quantity ?? item?.freeQty ?? 0;
        const n = Number(raw);
        return { text: n > 0 ? String(n) : dash, raw };
      }
      default:
        return { text: dash, raw: undefined };
    }
  }
  // 2. Custom / unknown fieldKey: look up in item, then custom_fields maps.
  const source =
    item?.[col.fieldKey] ??
    (item?.custom_fields ? item?.custom_fields[col.fieldKey] : undefined) ??
    (col.id ? item?.[col.id] : undefined) ??
    (invoice?.custom_fields ? invoice?.custom_fields[col.fieldKey] : undefined) ??
    (col.fieldKey ? invoice?.[col.fieldKey] : undefined);
  if (source === undefined || source === null || source === "") {
    return { text: dash, raw: source };
  }
  if (typeof source === "number") {
    return { text: source.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), raw: source };
  }
  if (typeof source === "boolean") return { text: source ? "Yes" : "No", raw: source };
  if (source instanceof Date) return { text: source.toISOString().slice(0, 10), raw: source };
  return { text: String(source), raw: source };
}

/**
 * Freeform / dispatch rows for the meta area of a theme. Returns [] when
 * nothing should be shown.
 *   (i)   freeform pairs from `template.customFields` (or `template.wordConfig.customFields`)
 *         — entries may be `{ key, label, value, isCustom, enabled }`; disabled or
 *         empty-valued entries are skipped. The value also falls back to
 *         `invoice.custom_fields[key]` / `invoice[key]` / `entry.defaultValue`.
 *   (ii)  known dispatch/shipping fields read from the invoice, gated by the
 *         matching `f`/`fields` toggle when that toggle is present (follows
 *         the showPoNumber / showEwayBill / showVehicleNumber / showChallanNumber
 *         / showTransporter / showDriver naming used in FULL_INVOICE_FIELDS /
 *         DEFAULT_INVOICE_FIELDS above). Blank values are skipped.
 */
export function resolveCustomFieldRows(
  template: any,
  invoice: any,
  fields?: any
): Array<{ label: string; value: string }> {
  const texts = (template && resolveInvoiceTexts(template)) || ({} as any);
  const f = fields || template?.fields || {};
  const out: Array<{ label: string; value: string }> = [];
  const push = (label: string, value: any, gate?: boolean) => {
    if (gate === false) return;
    const v = String(value ?? "").trim();
    if (!v || v === "-") return;
    out.push({ label: String(label), value: v });
  };

  // (i) freeform custom fields
  const rawList: any[] = Array.isArray(template?.customFields)
    ? template?.customFields
    : Array.isArray((template as any)?.wordConfig?.customFields)
      ? (template as any).wordConfig.customFields
      : [
          ...(Array.isArray((template as any)?.business?.customFields) ? (template as any).business.customFields : []),
          ...(Array.isArray((template as any)?.invoice?.customFields) ? (template as any).invoice.customFields : []),
          ...(Array.isArray((template as any)?.party?.customFields) ? (template as any).party.customFields : []),
        ];
  rawList.forEach((entry: any) => {
    if (!entry || entry.enabled === false || entry.visible === false) return;
    const label = String(entry.label || entry.name || entry.title || entry.key || entry.headerTitle || "").trim();
    if (!label) return;
    const key = String(entry.key || entry.fieldKey || entry.id || "").trim();
    // A freeform field can either hold a static value OR bind to an EXISTING
    // document/invoice field (entry.bindKey — set by the "Source" selector in the
    // designer). When bound, the live invoice value wins over any static value.
    const bindKey = String(entry.bindKey || entry.fieldKey || "").trim();
    let value: any;
    if (bindKey) {
      value =
        (invoice?.custom_fields ? invoice.custom_fields[bindKey] : undefined) ??
        (invoice as any)?.[bindKey] ??
        (entry.value !== undefined && String(entry.value).trim() !== "" ? entry.value : entry.defaultValue) ??
        // Preview-only: so a designer can SEE where a bound field will print, show a
        // sample value when the invoice is a mock (id starts with "mock-"). Never used
        // on a real invoice, so real prints always reflect live document data.
        (String(invoice?.id || "").startsWith("mock-") ? BIND_PREVIEW_SAMPLE[bindKey] : undefined);
    } else {
      value =
        entry.value ??
        (key && invoice?.custom_fields ? invoice.custom_fields[key] : undefined) ??
        (key && invoice ? invoice[key] : undefined) ??
        entry.defaultValue ??
        "";
    }
    push(label, value);
  });

  // (ii) known dispatch/shipping fields — gated by the matching `f` toggle
  const known: Array<{ key: string; label: string; value: any; gate?: boolean }> = [
    { key: "po_date", label: String(texts.orderDateLabel || "Order Date"), value: invoice?.po_date || invoice?.order_date, gate: f.showPoNumber },
    { key: "eway_bill_date", label: "e-Way Bill Date", value: invoice?.eway_bill_date, gate: f.showEwayBill },
    { key: "delivery_challan_number", label: String(texts.challanNoLabel || "Challan No"), value: invoice?.delivery_challan_number || invoice?.challan_number, gate: f.showChallanNumber },
    { key: "transporter_name", label: String(texts.transportLabel || "Transport"), value: invoice?.transporter_name, gate: f.showTransporter ?? f.showVehicleNumber },
    { key: "driver_name", label: "Driver", value: invoice?.driver_name, gate: f.showDriver ?? f.showTransporter },
    { key: "driver_phone", label: "Driver Ph", value: invoice?.driver_phone, gate: f.showDriver ?? f.showTransporter },
    { key: "lr_number", label: "LR No", value: invoice?.lr_number, gate: f.showTransporter ?? f.showVehicleNumber },
    { key: "dispatch_mode", label: "Dispatch Mode", value: invoice?.dispatch_mode },
  ];
  known.forEach((row) => push(row.label, row.value, row.gate));

  return out;
}

/**
 * Append a user-defined custom column to a normalized column list.
 * Returns a NEW array (input is not mutated). `staticValue` is only attached
 * when `source === 'static'` — that value will win over any live data lookup
 * in `cellValueForColumn`.
 */
/**
 * Options for a freeform field's "Source" selector. A freeform field either holds
 * a typed static value (source "static") OR binds to an EXISTING document/party
 * field (source "field", `bindKey` set) so the live value is pulled from the
 * invoice at render time — that's what `resolveCustomFieldRows` reads.
 */
export const FREEFORM_FIELD_BIND_OPTIONS: { key: string; label: string; hint: string; previewSample: string }[] = [
  { key: "customerPhone", label: "Customer Phone", hint: "Party mobile / phone", previewSample: "+91 98765 43210" },
  { key: "customer_gstin", label: "Customer GSTIN", hint: "Party GSTIN", previewSample: "09BBBBA9999C1Z2" },
  { key: "customerAddress", label: "Customer Address", hint: "Party address", previewSample: "45 Tech Boulevard, Sector 62, Noida" },
  { key: "customer_gender", label: "Customer Gender", hint: "Party gender", previewSample: "Female" },
  { key: "customer_dob", label: "Customer DOB", hint: "Date of birth", previewSample: "12/05/1990" },
  { key: "customer_age", label: "Customer Age", hint: "Age", previewSample: "35" },
  { key: "po_number", label: "PO / Order Ref", hint: "Customer PO reference", previewSample: "PO-2026-8812" },
  { key: "eway_bill_number", label: "e-Way Bill No", hint: "Transport e-Way", previewSample: "241098234190" },
  { key: "challan_number", label: "Challan No", hint: "Delivery challan", previewSample: "DC-0045" },
  { key: "vehicle_number", label: "Vehicle No", hint: "Dispatch vehicle", previewSample: "TS 09 EA 4412" },
  { key: "transporter_name", label: "Transporter", hint: "Carrier name", previewSample: "Kalyani Transports" },
  { key: "driver_name", label: "Driver Name", hint: "Driver", previewSample: "Ravi Kumar" },
  { key: "payment_mode", label: "Payment Mode", hint: "How it was paid", previewSample: "Cash" },
  { key: "place_of_supply", label: "Place of Supply", hint: "State / zone", previewSample: "37 - Andhra Pradesh" },
];

/** Live-document values a preview (mock) invoice should carry for the bindable keys. */
const BIND_PREVIEW_SAMPLE: Record<string, string> = Object.fromEntries(
  FREEFORM_FIELD_BIND_OPTIONS.map((o) => [o.key, o.previewSample])
);

export function addCustomColumn(
  cols: any[],
  opts: {
    name: string;
    fieldKey: string;
    align?: "left" | "center" | "right";
    widthPercent?: number;
    value?: string;
    source?: "static" | "item_field" | "customer_field";
  }
): any[] {
  const slug = String(opts.fieldKey || opts.name || "custom")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const entry: any = {
    id: `col_custom_${slug}`,
    fieldKey: opts.fieldKey,
    headerTitle: opts.name || opts.fieldKey,
    align: opts.align || "left",
    widthPercent: opts.widthPercent,
    enabled: true,
    isCustom: true,
  };
  if (opts.source === "static" && opts.value !== undefined && opts.value !== null && String(opts.value).trim() !== "") {
    entry.staticValue = opts.value;
  }
  return [...(cols || []), entry];
}

// ── Canonical Types for Unified 3-Panel Invoice Customizer ─────────────────

export interface CustomFieldDefinition {
  id: string;
  label: string;
  name?: string; // Aliased for PrintTemplates backward compat
  key?: string; // Aliased for data-key binding
  value?: string;
  defaultValue?: string;
  bindKey?: string;
  enabled: boolean;
  section?: "meta" | "header" | "party" | "footer";
}

export interface DynamicColumnDefinition {
  id: string;
  fieldKey: string;
  headerTitle: string;
  widthPercent?: number;
  align: "left" | "center" | "right";
  enabled: boolean;
  isCustom?: boolean;
  staticValue?: string;
  source?: "static" | "item_field" | "customer_field";
}

export interface StyleSettingsConfig {
  themeId: string;
  primaryColor: string;
  secondaryColor: string;
  paperBgColor: string;
  fontFamily: string;
  fontDensity: "compact" | "normal" | "large";
  margins: "none" | "narrow" | "normal" | "wide";
  tableBorderStyle: "subtle" | "strong" | "double" | "minimal";
  watermark: {
    enabled: boolean;
    type: "text" | "image";
    text: string;
    imageUrl?: string;
    opacity: number;
  };
}

export interface PrintSettingsConfig {
  paperSize: "A4" | "A5" | "Letter";
  orientation: "portrait" | "landscape";
  printClarity: "standard" | "crisp_mono" | "ultra_dark";
  repeatHeaderOnMultiPage: boolean;
  showPageNumbers: boolean;
  printBackgroundGraphics: boolean;
  copyTag: string;
}

export interface BusinessDetailsConfig {
  showCompanyName: boolean;
  companyName: string;
  showLogo: boolean;
  logoUrl?: string;
  logoHeight: number;
  logoAlignment: "left" | "center" | "right";
  showAddress: boolean;
  address: string;
  showPhone: boolean;
  phone: string;
  showEmail: boolean;
  email: string;
  showGstin: boolean;
  gstin: string;
  showPan: boolean;
  pan: string;
  showCin: boolean;
  cin: string;
  showTagline: boolean;
  tagline: string;
  customFields: CustomFieldDefinition[];
}

export interface InvoiceDetailsConfig {
  documentTitle: string;
  invoiceNumberLabel: string;
  showInvoiceNumber: boolean;
  invoiceDateLabel: string;
  showInvoiceDate: boolean;
  dueDateLabel: string;
  showDueDate: boolean;
  poNumberLabel: string;
  showPoNumber: boolean;
  showPoDate: boolean;
  ewayBillLabel: string;
  showEwayBill: boolean;
  vehicleNumberLabel: string;
  showVehicleNumber: boolean;
  challanNumberLabel: string;
  showChallanNumber: boolean;
  challanDateLabel: string;
  showChallanDate: boolean;
  showTransporter: boolean;
  showPlaceOfSupply: boolean;
  showReverseCharge: boolean;
  metaLayout: "table_grid" | "vertical_list";
  customFields: CustomFieldDefinition[];
}

export interface PartyDetailsConfig {
  layout: PartyLayoutType;
  billTo: {
    sectionTitle: string;
    showCompanyName: boolean;
    showContactPerson: boolean;
    showAddress: boolean;
    showPhone: boolean;
    showEmail: boolean;
    showGstin: boolean;
    showPan: boolean;
    showDlNumber: boolean;
    showPartyBalance: boolean;
  };
  shipTo: {
    sectionTitle: string;
    showShippingAddress: boolean;
    showContact: boolean;
    showGstin: boolean;
  };
  customFields: CustomFieldDefinition[];
  styling?: {
    borderStyle?: "solid" | "subtle" | "none";
    headerTint?: boolean;
    balanceStyle?: "inline" | "badge" | "callout";
  };
}

export interface ItemTableConfig {
  columns: DynamicColumnDefinition[];
  subToggles: {
    showItemDescription: boolean;
    showSku: boolean;
    showBarcode: boolean;
    showBrandCategory: boolean;
    showProductImage: boolean;
    showSecondaryUnit: boolean;
  };
  totalsToggles: {
    showItemsCount: boolean;
    showTotalQuantity: boolean;
    showTaxableAmount: boolean;
    showTaxSplitTable: boolean;
    showSavingsBanner: boolean;
    showRoundOff: boolean;
    showGrandTotal: boolean;
    showReceivedAmount: boolean;
    showBalanceDue: boolean;
    showAmountInWords: boolean;
  };
  styling: {
    headerBgColor: string;
    headerTextColor: string;
    showZebraStripes: boolean;
    showVerticalBorders: boolean;
    minRowsFiller: number;
  };
}

export interface MiscellaneousConfig {
  paymentQr: {
    enabled: boolean;
    upiId: string;
    payeeName: string;
    qrType: "dynamic_upi" | "custom_image";
    customImageUrl?: string;
    caption: string;
    size: "small" | "medium" | "large";
  };
  bankDetails: {
    enabled: boolean;
    bankName: string;
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
    branch: string;
  };
  termsAndConditions: {
    enabled: boolean;
    text: string;
  };
  statutoryDeclaration: {
    enabled: boolean;
    text: string;
  };
  thankYouNote: {
    enabled: boolean;
    text: string;
  };
  signatureAndStamp: {
    showSignature: boolean;
    signatureUrl?: string | null;
    showStamp: boolean;
    stampUrl?: string | null;
    signatureTitle: string;
    signatureCompany: string;
    alignment: "left" | "center" | "right";
  };
  googleReview: {
    enabled: boolean;
    reviewUrl?: string;
  };
}

export interface UnifiedInvoiceCustomizerConfig {
  id: string;
  name: string;
  docCategory: InvoiceDocCategory;
  isDefault: boolean;
  style: StyleSettingsConfig;
  print: PrintSettingsConfig;
  business: BusinessDetailsConfig;
  invoice: InvoiceDetailsConfig;
  party: PartyDetailsConfig;
  itemTable: ItemTableConfig;
  miscellaneous: MiscellaneousConfig;
  updatedAt: string;
}

/** Standard default item table columns for newly initialized customizers */
export const DEFAULT_UNIFIED_COLUMNS: DynamicColumnDefinition[] = [
  { id: "col_sno", fieldKey: "sno", headerTitle: "S.No", widthPercent: 5, align: "center", enabled: true },
  { id: "col_desc", fieldKey: "description", headerTitle: "Items / Services", widthPercent: 28, align: "left", enabled: true },
  { id: "col_hsn", fieldKey: "hsn", headerTitle: "HSN/SAC", widthPercent: 10, align: "center", enabled: true },
  { id: "col_qty", fieldKey: "quantity", headerTitle: "Qty", widthPercent: 8, align: "center", enabled: true },
  { id: "col_rate", fieldKey: "unit_price", headerTitle: "Rate", widthPercent: 12, align: "right", enabled: true },
  { id: "col_disc", fieldKey: "discount", headerTitle: "Disc", widthPercent: 8, align: "right", enabled: true },
  { id: "col_tax", fieldKey: "tax_rate", headerTitle: "GST %", widthPercent: 8, align: "center", enabled: true },
  { id: "col_amt", fieldKey: "total_amount", headerTitle: "Amount", widthPercent: 15, align: "right", enabled: true },
];

/** Factory helper to instantiate a clean UnifiedInvoiceCustomizerConfig */
export function createDefaultUnifiedConfig(
  category: InvoiceDocCategory = "invoice",
  themeId: string = "gst_tally"
): UnifiedInvoiceCustomizerConfig {
  const isChallan = category === "challan";
  const isQuote = category === "quotation";
  const isProforma = category === "proforma";
  const isEstimate = category === "estimate";

  const documentTitle = isChallan
    ? "DELIVERY CHALLAN"
    : isQuote
      ? "TAX QUOTATION / ESTIMATE"
      : isProforma
        ? "PROFORMA INVOICE"
        : isEstimate
          ? "TAX ESTIMATE"
          : "TAX INVOICE";

  const invoiceNumberLabel = isChallan
    ? "Challan No"
    : isQuote
      ? "Quote No"
      : isProforma
        ? "Proforma No"
        : isEstimate
          ? "Estimate No"
          : "Invoice No";

  const invoiceDateLabel = isChallan
    ? "Challan Date"
    : isQuote
      ? "Quote Date"
      : "Invoice Date";

  return {
    id: `unified-${category}-default`,
    name: "GST Tally (myBillBook)",
    docCategory: category,
    isDefault: true,
    style: {
      themeId,
      primaryColor: "#0f172a",
      secondaryColor: "#4f46e5",
      paperBgColor: "#ffffff",
      fontFamily: "Inter, -apple-system, sans-serif",
      fontDensity: "normal",
      margins: "normal",
      tableBorderStyle: "strong",
      watermark: {
        enabled: false,
        type: "text",
        text: "ORIGINAL",
        opacity: 0.1,
      },
    },
    print: {
      paperSize: "A4",
      orientation: "portrait",
      printClarity: "standard",
      repeatHeaderOnMultiPage: true,
      showPageNumbers: true,
      printBackgroundGraphics: true,
      copyTag: "ORIGINAL FOR RECIPIENT",
    },
    business: {
      showCompanyName: true,
      companyName: "",
      showLogo: true,
      logoUrl: "",
      logoHeight: 48,
      logoAlignment: "left",
      showAddress: true,
      address: "",
      showPhone: true,
      phone: "",
      showEmail: true,
      email: "",
      showGstin: true,
      gstin: "",
      showPan: true,
      pan: "",
      showCin: true,
      cin: "",
      showTagline: false,
      tagline: "",
      customFields: [],
    },
    invoice: {
      documentTitle,
      invoiceNumberLabel,
      showInvoiceNumber: true,
      invoiceDateLabel,
      showInvoiceDate: true,
      dueDateLabel: "Due Date",
      showDueDate: true,
      poNumberLabel: "PO / Order Ref",
      showPoNumber: true,
      showPoDate: true,
      ewayBillLabel: "e-Way Bill",
      showEwayBill: true,
      vehicleNumberLabel: "Vehicle No",
      showVehicleNumber: true,
      challanNumberLabel: "Challan No",
      showChallanNumber: true,
      challanDateLabel: "Challan Date",
      showChallanDate: true,
      showTransporter: true,
      showPlaceOfSupply: true,
      showReverseCharge: false,
      metaLayout: "table_grid",
      customFields: [],
    },
    party: {
      layout: "layout_1",
      billTo: {
        sectionTitle: "Bill To",
        showCompanyName: true,
        showContactPerson: true,
        showAddress: true,
        showPhone: true,
        showEmail: false,
        showGstin: true,
        showPan: true,
        showDlNumber: false,
        showPartyBalance: true,
      },
      shipTo: {
        sectionTitle: "Ship To",
        showShippingAddress: true,
        showContact: true,
        showGstin: true,
      },
      customFields: [],
      styling: {
        borderStyle: "solid",
        headerTint: true,
        balanceStyle: "inline",
      },
    },
    itemTable: {
      columns: DEFAULT_UNIFIED_COLUMNS.map((c) => ({ ...c })),
      subToggles: {
        showItemDescription: true,
        showSku: false,
        showBarcode: false,
        showBrandCategory: false,
        showProductImage: false,
        showSecondaryUnit: true,
      },
      totalsToggles: {
        showItemsCount: true,
        showTotalQuantity: true,
        showTaxableAmount: true,
        showTaxSplitTable: true,
        showSavingsBanner: true,
        showRoundOff: true,
        showGrandTotal: true,
        showReceivedAmount: true,
        showBalanceDue: true,
        showAmountInWords: true,
      },
      styling: {
        headerBgColor: "#f8fafc",
        headerTextColor: "#0f172a",
        showZebraStripes: false,
        showVerticalBorders: true,
        minRowsFiller: 3,
      },
    },
    miscellaneous: {
      paymentQr: {
        enabled: true,
        upiId: "",
        payeeName: "",
        qrType: "dynamic_upi",
        caption: "Scan & Pay with UPI",
        size: "medium",
      },
      bankDetails: {
        enabled: true,
        bankName: "",
        accountHolderName: "",
        accountNumber: "",
        ifscCode: "",
        branch: "",
      },
      termsAndConditions: {
        enabled: true,
        text: "1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged if payment is not made within the due date.",
      },
      statutoryDeclaration: {
        enabled: true,
        text: "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.",
      },
      thankYouNote: {
        enabled: true,
        text: "Thank you for doing business with us!",
      },
      signatureAndStamp: {
        showSignature: true,
        signatureUrl: null,
        showStamp: true,
        stampUrl: null,
        signatureTitle: "Authorised Signatory",
        signatureCompany: "",
        alignment: "right",
      },
      googleReview: {
        enabled: false,
        reviewUrl: "",
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

/** Convert a UnifiedInvoiceCustomizerConfig to an object compatible with PrintTemplate and GstTallyTemplate */
export function unifiedConfigToPrintTemplate(config: UnifiedInvoiceCustomizerConfig): any {
  const bankName = config.miscellaneous.bankDetails.bankName || "";
  const accountNumber = config.miscellaneous.bankDetails.accountNumber || "";
  const ifscCode = config.miscellaneous.bankDetails.ifscCode || "";
  const branchName =
    config.miscellaneous.bankDetails.branch ||
    (config.miscellaneous.bankDetails as any).branchName ||
    "";
  const accountHolder =
    config.miscellaneous.bankDetails.accountHolderName ||
    (config.miscellaneous.bankDetails as any).accountHolder ||
    "";

  // Formatted string representation for legacy renderers expecting string bankDetails
  const formattedBankString = bankName
    ? `Bank: ${bankName}${accountNumber ? ` | A/C: ${accountNumber}` : ""}${ifscCode ? ` | IFSC: ${ifscCode}` : ""}${branchName ? ` | Branch: ${branchName}` : ""}${accountHolder ? ` | Holder: ${accountHolder}` : ""}`
    : "";

  return {
    id: config.id,
    name: config.name,
    category: "invoices",
    docType: config.docCategory,
    themeName: config.style.themeId || "gst_tally",
    paperSize: config.print.paperSize,
    orientation: config.print.orientation,
    margins: config.style.margins,
    primaryColor: config.style.primaryColor,
    secondaryColor: config.style.secondaryColor,
    paperBgColor: config.style.paperBgColor,
    fontFamily: config.style.fontFamily,
    fontDensity: config.style.fontDensity,
    printClarity: config.print.printClarity,
    headerTitle: config.invoice.documentTitle,
    storeName: config.business.companyName,
    storeAddress: config.business.address,
    storePhone: config.business.phone,
    email: config.business.email,
    gstin: config.business.gstin,
    pan: config.business.pan,
    cin: config.business.cin,
    tagline: config.business.tagline,
    customTaglineText: config.business.tagline,
    logoUrl: config.business.logoUrl,
    showWatermark: config.style.watermark.enabled,
    watermarkType: config.style.watermark.type,
    watermarkText: config.style.watermark.text,
    watermarkImage: config.style.watermark.imageUrl,
    watermarkOpacity: config.style.watermark.opacity,
    bankName,
    accountNumber,
    ifscCode,
    branchName,
    accountHolder,
    accountHolderName: accountHolder,
    bankDetails: formattedBankString,
    footerText: config.miscellaneous.thankYouNote.text,
    termsText: config.miscellaneous.termsAndConditions.text,
    declarationText: config.miscellaneous.statutoryDeclaration.text,
    upiId: config.miscellaneous.paymentQr.upiId,
    payeeName: config.miscellaneous.paymentQr.payeeName,
    signatureUrl: config.miscellaneous.signatureAndStamp.signatureUrl || undefined,
    stampUrl: config.miscellaneous.signatureAndStamp.stampUrl || undefined,
    signatoryLabel: config.miscellaneous.signatureAndStamp.signatureTitle,
    partyLayout: config.party.layout,
    columns: config.itemTable.columns,
    customItemColumns: config.itemTable.columns.filter((c) => c.isCustom),
    customFields: [
      ...config.business.customFields,
      ...config.invoice.customFields,
      ...config.party.customFields,
    ],
    fields: {
      showHeader: true,
      showLogo: config.business.showLogo,
      showCompanyDetails: config.business.showCompanyName,
      showCustomTagline: config.business.showTagline,
      showInvoiceDetails: config.invoice.showInvoiceNumber || config.invoice.showInvoiceDate,
      showCustomerDetails: config.party.billTo.showCompanyName,
      showItemTable: true,
      showHSN: config.itemTable.columns.some((c) => c.fieldKey === "hsn" && c.enabled),
      showBatchNumber: config.itemTable.columns.some((c) => c.fieldKey === "batch" && c.enabled),
      showExpMfgDates: config.itemTable.columns.some((c) => c.fieldKey === "expiry_date" && c.enabled),
      showSecondaryUnit: config.itemTable.subToggles.showSecondaryUnit,
      showItemRate: config.itemTable.columns.some((c) => c.fieldKey === "unit_price" && c.enabled),
      showDiscountCol: config.itemTable.columns.some((c) => c.fieldKey === "discount" && c.enabled),
      showGstRateCol: config.itemTable.columns.some((c) => c.fieldKey === "tax_rate" && c.enabled),
      showItemQty: config.itemTable.columns.some((c) => c.fieldKey === "quantity" && c.enabled),
      showItemAmount: config.itemTable.columns.some((c) => c.fieldKey === "total_amount" && c.enabled),
      showItemDescription: config.itemTable.subToggles.showItemDescription,
      showProductImage: config.itemTable.subToggles.showProductImage,
      showSKU: config.itemTable.subToggles.showSku,
      showBarcode: config.itemTable.subToggles.showBarcode,
      showTaxSplit: config.itemTable.totalsToggles.showTaxSplitTable,
      showTotals: config.itemTable.totalsToggles.showGrandTotal,
      showBankDetails: config.miscellaneous.bankDetails.enabled,
      showPaymentDetails: true,
      showQR: config.miscellaneous.paymentQr.enabled,
      showTerms: config.miscellaneous.termsAndConditions.enabled,
      showDeclaration: config.miscellaneous.statutoryDeclaration.enabled,
      showSignature: config.miscellaneous.signatureAndStamp.showSignature,
      showStamp: config.miscellaneous.signatureAndStamp.showStamp,
      showThankYou: config.miscellaneous.thankYouNote.enabled,
      showFooter: true,
      showPoNumber: config.invoice.showPoNumber,
      showEwayBill: config.invoice.showEwayBill,
      showVehicleNumber: config.invoice.showVehicleNumber,
      showChallanNumber: config.invoice.showChallanNumber,
      showTransporter: config.invoice.showTransporter,
      showPlaceOfSupply: config.invoice.showPlaceOfSupply,
      showPartyBalance: config.party.billTo.showPartyBalance,
      showPartyPan: config.party.billTo.showPan,
      showPartyGstin: config.party.billTo.showGstin,
    },
    texts: {
      invoiceTitle: config.invoice.documentTitle,
      quotationTitle: config.docCategory === "quotation" ? config.invoice.documentTitle : "TAX QUOTATION / ESTIMATE",
      estimateTitle: config.docCategory === "estimate" ? config.invoice.documentTitle : "TAX ESTIMATE",
      proformaTitle: config.docCategory === "proforma" ? config.invoice.documentTitle : "PROFORMA INVOICE",
      challanTitle: config.docCategory === "challan" ? config.invoice.documentTitle : "DELIVERY CHALLAN",
      invoiceNoLabel: config.invoice.invoiceNumberLabel,
      challanNoLabel: config.invoice.challanNumberLabel,
      invoiceDateLabel: config.invoice.invoiceDateLabel,
      challanDateLabel: config.invoice.challanDateLabel || "Challan Date",
      dueDateLabel: config.invoice.dueDateLabel,
      poNumberLabel: config.invoice.poNumberLabel,
      ewayBillLabel: config.invoice.ewayBillLabel,
      vehicleNoLabel: config.invoice.vehicleNumberLabel,
      partyTitle: config.party.billTo.sectionTitle,
      shipToTitle: config.party.shipTo.sectionTitle,
      copyTag: config.print.copyTag,
      companyTagline: config.business.tagline,
      termsLabel: "Terms & Conditions",
      declarationLabel: "Declaration",
      signatureTitle: config.miscellaneous.signatureAndStamp.signatureTitle,
      thankYouLabel: config.miscellaneous.thankYouNote.text,
    },
    unifiedConfig: config,
  };
}

/** Convert a legacy PrintTemplate or WordInvoiceTemplateConfig into UnifiedInvoiceCustomizerConfig */
export function printTemplateToUnifiedConfig(
  tpl: any,
  category: InvoiceDocCategory = "invoice"
): UnifiedInvoiceCustomizerConfig {
  const defaultBase = createDefaultUnifiedConfig(category, tpl?.themeName || "gst_tally");
  if (!tpl) return defaultBase;

  // Preserve existing unifiedConfig if present so no customizer properties are lost
  const base: UnifiedInvoiceCustomizerConfig = tpl.unifiedConfig
    ? {
        ...defaultBase,
        ...tpl.unifiedConfig,
        docCategory: category,
        style: { ...defaultBase.style, ...(tpl.unifiedConfig.style || {}) },
        print: { ...defaultBase.print, ...(tpl.unifiedConfig.print || {}) },
        business: { ...defaultBase.business, ...(tpl.unifiedConfig.business || {}) },
        invoice: { ...defaultBase.invoice, ...(tpl.unifiedConfig.invoice || {}) },
        party: {
          ...defaultBase.party,
          ...(tpl.unifiedConfig.party || {}),
          billTo: { ...defaultBase.party.billTo, ...(tpl.unifiedConfig.party?.billTo || {}) },
          shipTo: { ...defaultBase.party.shipTo, ...(tpl.unifiedConfig.party?.shipTo || {}) },
        },
        itemTable: {
          ...defaultBase.itemTable,
          ...(tpl.unifiedConfig.itemTable || {}),
          subToggles: { ...defaultBase.itemTable.subToggles, ...(tpl.unifiedConfig.itemTable?.subToggles || {}) },
          totalsToggles: { ...defaultBase.itemTable.totalsToggles, ...(tpl.unifiedConfig.itemTable?.totalsToggles || {}) },
          styling: { ...defaultBase.itemTable.styling, ...(tpl.unifiedConfig.itemTable?.styling || {}) },
        },
        miscellaneous: {
          ...defaultBase.miscellaneous,
          ...(tpl.unifiedConfig.miscellaneous || {}),
          paymentQr: { ...defaultBase.miscellaneous.paymentQr, ...(tpl.unifiedConfig.miscellaneous?.paymentQr || {}) },
          bankDetails: { ...defaultBase.miscellaneous.bankDetails, ...(tpl.unifiedConfig.miscellaneous?.bankDetails || {}) },
          termsAndConditions: { ...defaultBase.miscellaneous.termsAndConditions, ...(tpl.unifiedConfig.miscellaneous?.termsAndConditions || {}) },
          statutoryDeclaration: { ...defaultBase.miscellaneous.statutoryDeclaration, ...(tpl.unifiedConfig.miscellaneous?.statutoryDeclaration || {}) },
          thankYouNote: { ...defaultBase.miscellaneous.thankYouNote, ...(tpl.unifiedConfig.miscellaneous?.thankYouNote || {}) },
          signatureAndStamp: { ...defaultBase.miscellaneous.signatureAndStamp, ...(tpl.unifiedConfig.miscellaneous?.signatureAndStamp || {}) },
        },
      }
    : defaultBase;

  // Resolve watermark settings
  const watermarkEnabled =
    tpl.showWatermark !== undefined
      ? Boolean(tpl.showWatermark)
      : base.style.watermark.enabled;
  const watermarkType = tpl.watermarkType || base.style.watermark.type;
  const watermarkText = tpl.watermarkText || base.style.watermark.text;
  const watermarkImageUrl =
    tpl.watermarkImage !== undefined ? tpl.watermarkImage : base.style.watermark.imageUrl;
  const watermarkOpacity =
    typeof tpl.watermarkOpacity === "number" ? tpl.watermarkOpacity : base.style.watermark.opacity;

  // Resolve business visibility toggles
  const showLogo =
    tpl.fields?.showLogo !== undefined
      ? Boolean(tpl.fields.showLogo)
      : base.business.showLogo;
  const showCompanyName =
    tpl.fields?.showCompanyDetails !== undefined
      ? Boolean(tpl.fields.showCompanyDetails)
      : tpl.fields?.showCompanyName !== undefined
        ? Boolean(tpl.fields.showCompanyName)
        : base.business.showCompanyName;
  const showTagline =
    tpl.fields?.showCustomTagline !== undefined
      ? Boolean(tpl.fields.showCustomTagline)
      : base.business.showTagline;
  const tagline =
    tpl.customTaglineText ||
    tpl.tagline ||
    tpl.texts?.companyTagline ||
    base.business.tagline;

  // Resolve bank details (handles unifiedConfig, direct props, object bankDetails, and string bankDetails)
  let bankName = tpl.bankName || "";
  let accountNumber = tpl.accountNumber || "";
  let ifscCode = tpl.ifscCode || "";
  let branchName = tpl.branchName || tpl.branch || "";
  let accountHolder = tpl.accountHolder || tpl.accountHolderName || "";

  if (typeof tpl.bankDetails === "object" && tpl.bankDetails !== null) {
    bankName = bankName || tpl.bankDetails.bankName || "";
    accountNumber = accountNumber || tpl.bankDetails.accountNumber || "";
    ifscCode = ifscCode || tpl.bankDetails.ifscCode || "";
    branchName = branchName || tpl.bankDetails.branchName || tpl.bankDetails.branch || "";
    accountHolder = accountHolder || tpl.bankDetails.accountHolder || tpl.bankDetails.accountHolderName || "";
  } else if (typeof tpl.bankDetails === "string" && tpl.bankDetails.trim()) {
    const bMatch = tpl.bankDetails.match(/Bank:\s*([^|\n]+)/i);
    if (bMatch && !bankName) bankName = bMatch[1].trim();
    const aMatch = tpl.bankDetails.match(/A\/C:\s*([^|\n]+)/i);
    if (aMatch && !accountNumber) accountNumber = aMatch[1].trim();
    const iMatch = tpl.bankDetails.match(/IFSC:\s*([^|\n]+)/i);
    if (iMatch && !ifscCode) ifscCode = iMatch[1].trim();
    const brMatch = tpl.bankDetails.match(/Branch:\s*([^|\n]+)/i);
    if (brMatch && !branchName) branchName = brMatch[1].trim();
    const hMatch = tpl.bankDetails.match(/Holder:\s*([^|\n]+)/i);
    if (hMatch && !accountHolder) accountHolder = hMatch[1].trim();
  }

  const bankDetailsEnabled =
    tpl.fields?.showBankDetails !== undefined
      ? Boolean(tpl.fields.showBankDetails)
      : base.miscellaneous.bankDetails.enabled;

  return {
    ...base,
    id: tpl.id || base.id,
    name: tpl.name || base.name,
    docCategory: category,
    style: {
      ...base.style,
      themeId: tpl.themeName || base.style.themeId,
      primaryColor: tpl.primaryColor || base.style.primaryColor,
      paperBgColor: tpl.paperBgColor || base.style.paperBgColor,
      fontFamily: tpl.fontFamily || base.style.fontFamily,
      fontDensity: tpl.fontDensity || base.style.fontDensity,
      margins: tpl.margins || base.style.margins,
      watermark: {
        enabled: watermarkEnabled,
        type: watermarkType,
        text: watermarkText,
        imageUrl: watermarkImageUrl,
        opacity: watermarkOpacity,
      },
    },
    print: {
      ...base.print,
      paperSize: tpl.paperSize || base.print.paperSize,
      orientation: tpl.orientation || base.print.orientation,
      printClarity: tpl.printClarity || base.print.printClarity,
      copyTag: tpl.texts?.copyTag || base.print.copyTag,
    },
    business: {
      ...base.business,
      showCompanyName,
      companyName: tpl.storeName || base.business.companyName,
      showLogo,
      logoUrl: tpl.logoUrl !== undefined ? tpl.logoUrl : base.business.logoUrl,
      address: tpl.storeAddress || base.business.address,
      phone: tpl.storePhone || base.business.phone,
      email: tpl.email || base.business.email,
      gstin: tpl.gstin || base.business.gstin,
      pan: tpl.pan || base.business.pan,
      cin: tpl.cin || base.business.cin,
      showTagline,
      tagline,
      customFields: Array.isArray(tpl.customFields)
        ? tpl.customFields.map((cf: any) => ({
            id: cf.id,
            label: cf.label || cf.name || cf.id,
            name: cf.name || cf.label,
            value: cf.value,
            enabled: cf.enabled !== false,
            section: cf.section || "header",
          }))
        : base.business.customFields,
    },
    invoice: {
      ...base.invoice,
      documentTitle: tpl.headerTitle || tpl.texts?.invoiceTitle || base.invoice.documentTitle,
      invoiceNumberLabel: tpl.texts?.invoiceNoLabel || base.invoice.invoiceNumberLabel,
      invoiceDateLabel: tpl.texts?.invoiceDateLabel || base.invoice.invoiceDateLabel,
      dueDateLabel: tpl.texts?.dueDateLabel || base.invoice.dueDateLabel,
      poNumberLabel: tpl.texts?.poNumberLabel || base.invoice.poNumberLabel,
      ewayBillLabel: tpl.texts?.ewayBillLabel || base.invoice.ewayBillLabel,
      vehicleNumberLabel: tpl.texts?.vehicleNoLabel || base.invoice.vehicleNumberLabel,
      challanNumberLabel: tpl.texts?.challanNoLabel || base.invoice.challanNumberLabel,
      challanDateLabel: (tpl.texts as any)?.challanDateLabel || base.invoice.challanDateLabel,
      showPoNumber: tpl.fields?.showPoNumber !== undefined ? Boolean(tpl.fields.showPoNumber) : base.invoice.showPoNumber,
      showEwayBill: tpl.fields?.showEwayBill !== undefined ? Boolean(tpl.fields.showEwayBill) : base.invoice.showEwayBill,
      showVehicleNumber: tpl.fields?.showVehicleNumber !== undefined ? Boolean(tpl.fields.showVehicleNumber) : base.invoice.showVehicleNumber,
      showChallanNumber: tpl.fields?.showChallanNumber !== undefined ? Boolean(tpl.fields.showChallanNumber) : base.invoice.showChallanNumber,
    },
    party: {
      ...base.party,
      layout: (tpl.partyLayout as PartyLayoutType) || base.party.layout,
      billTo: {
        ...base.party.billTo,
        sectionTitle: tpl.texts?.partyTitle || base.party.billTo.sectionTitle,
        showCompanyName: tpl.fields?.showCustomerDetails !== undefined ? Boolean(tpl.fields.showCustomerDetails) : base.party.billTo.showCompanyName,
        showPartyBalance: tpl.fields?.showPartyBalance !== undefined ? Boolean(tpl.fields.showPartyBalance) : base.party.billTo.showPartyBalance,
        showPan: tpl.fields?.showPartyPan !== undefined ? Boolean(tpl.fields.showPartyPan) : base.party.billTo.showPan,
        showGstin: tpl.fields?.showPartyGstin !== undefined ? Boolean(tpl.fields.showPartyGstin) : base.party.billTo.showGstin,
      },
      shipTo: {
        ...base.party.shipTo,
        sectionTitle: tpl.texts?.shipToTitle || base.party.shipTo.sectionTitle,
      },
      customFields: base.party.customFields,
    },
    itemTable: {
      ...base.itemTable,
      columns: Array.isArray(tpl.columns) && tpl.columns.length > 0
        ? tpl.columns
        : base.itemTable.columns,
      subToggles: {
        showItemDescription:
          tpl.fields?.showItemDescription !== undefined
            ? Boolean(tpl.fields.showItemDescription)
            : base.itemTable.subToggles.showItemDescription,
        showSku:
          tpl.fields?.showSKU !== undefined
            ? Boolean(tpl.fields.showSKU)
            : tpl.fields?.showSku !== undefined
              ? Boolean(tpl.fields.showSku)
              : base.itemTable.subToggles.showSku,
        showBarcode:
          tpl.fields?.showBarcode !== undefined
            ? Boolean(tpl.fields.showBarcode)
            : base.itemTable.subToggles.showBarcode,
        showBrandCategory:
          tpl.fields?.showCategoryBrand !== undefined
            ? Boolean(tpl.fields.showCategoryBrand)
            : tpl.fields?.showBrandCategory !== undefined
              ? Boolean(tpl.fields.showBrandCategory)
              : base.itemTable.subToggles.showBrandCategory,
        showProductImage:
          tpl.fields?.showProductImage !== undefined
            ? Boolean(tpl.fields.showProductImage)
            : base.itemTable.subToggles.showProductImage,
        showSecondaryUnit:
          tpl.fields?.showSecondaryUnit !== undefined
            ? Boolean(tpl.fields.showSecondaryUnit)
            : base.itemTable.subToggles.showSecondaryUnit,
      },
      totalsToggles: {
        showItemsCount:
          tpl.fields?.showTotalItems !== undefined
            ? Boolean(tpl.fields.showTotalItems)
            : base.itemTable.totalsToggles.showItemsCount,
        showTotalQuantity:
          tpl.fields?.showTotalQty !== undefined
            ? Boolean(tpl.fields.showTotalQty)
            : base.itemTable.totalsToggles.showTotalQuantity,
        showTaxableAmount:
          tpl.fields?.showTaxableAmount !== undefined
            ? Boolean(tpl.fields.showTaxableAmount)
            : base.itemTable.totalsToggles.showTaxableAmount,
        showTaxSplitTable:
          tpl.fields?.showTaxSplit !== undefined
            ? Boolean(tpl.fields.showTaxSplit)
            : tpl.fields?.showTaxSplitTable !== undefined
              ? Boolean(tpl.fields.showTaxSplitTable)
              : base.itemTable.totalsToggles.showTaxSplitTable,
        showSavingsBanner:
          tpl.fields?.showYouSaved !== undefined
            ? Boolean(tpl.fields.showYouSaved)
            : tpl.fields?.showSavingsBanner !== undefined
              ? Boolean(tpl.fields.showSavingsBanner)
              : base.itemTable.totalsToggles.showSavingsBanner,
        showRoundOff:
          tpl.fields?.showRoundOff !== undefined
            ? Boolean(tpl.fields.showRoundOff)
            : base.itemTable.totalsToggles.showRoundOff,
        showGrandTotal:
          tpl.fields?.showTotals !== undefined
            ? Boolean(tpl.fields.showTotals)
            : tpl.fields?.showGrandTotal !== undefined
              ? Boolean(tpl.fields.showGrandTotal)
              : base.itemTable.totalsToggles.showGrandTotal,
        showReceivedAmount:
          tpl.fields?.showReceivedAmount !== undefined
            ? Boolean(tpl.fields.showReceivedAmount)
            : base.itemTable.totalsToggles.showReceivedAmount,
        showBalanceDue:
          tpl.fields?.showBalanceAmount !== undefined
            ? Boolean(tpl.fields.showBalanceAmount)
            : tpl.fields?.showBalanceDue !== undefined
              ? Boolean(tpl.fields.showBalanceDue)
              : base.itemTable.totalsToggles.showBalanceDue,
        showAmountInWords:
          tpl.fields?.showAmountInWords !== undefined
            ? Boolean(tpl.fields.showAmountInWords)
            : base.itemTable.totalsToggles.showAmountInWords,
      },
    },
    miscellaneous: {
      ...base.miscellaneous,
      paymentQr: {
        ...base.miscellaneous.paymentQr,
        enabled: tpl.fields?.showQR !== undefined ? Boolean(tpl.fields.showQR) : base.miscellaneous.paymentQr.enabled,
        upiId: tpl.upiId || base.miscellaneous.paymentQr.upiId,
        payeeName: tpl.payeeName || base.miscellaneous.paymentQr.payeeName,
      },
      bankDetails: {
        ...base.miscellaneous.bankDetails,
        enabled: bankDetailsEnabled,
        bankName: bankName || base.miscellaneous.bankDetails.bankName,
        accountNumber: accountNumber || base.miscellaneous.bankDetails.accountNumber,
        ifscCode: ifscCode || base.miscellaneous.bankDetails.ifscCode,
        branch: branchName || base.miscellaneous.bankDetails.branch,
        accountHolderName: accountHolder || base.miscellaneous.bankDetails.accountHolderName,
      },
      termsAndConditions: {
        ...base.miscellaneous.termsAndConditions,
        enabled: tpl.fields?.showTerms !== undefined ? Boolean(tpl.fields.showTerms) : base.miscellaneous.termsAndConditions.enabled,
        text: tpl.termsText || tpl.termsAndConditionsText || base.miscellaneous.termsAndConditions.text,
      },
      statutoryDeclaration: {
        ...base.miscellaneous.statutoryDeclaration,
        enabled: tpl.fields?.showDeclaration !== undefined ? Boolean(tpl.fields.showDeclaration) : base.miscellaneous.statutoryDeclaration.enabled,
        text: tpl.declarationText || base.miscellaneous.statutoryDeclaration.text,
      },
      thankYouNote: {
        ...base.miscellaneous.thankYouNote,
        enabled: tpl.fields?.showThankYou !== undefined ? Boolean(tpl.fields.showThankYou) : base.miscellaneous.thankYouNote.enabled,
        text: tpl.thankYouNote || tpl.footerText || base.miscellaneous.thankYouNote.text,
      },
      signatureAndStamp: {
        ...base.miscellaneous.signatureAndStamp,
        showSignature: tpl.fields?.showSignature !== undefined ? Boolean(tpl.fields.showSignature) : base.miscellaneous.signatureAndStamp.showSignature,
        signatureUrl: tpl.signatureUrl !== undefined ? tpl.signatureUrl : base.miscellaneous.signatureAndStamp.signatureUrl,
        showStamp: tpl.fields?.showStamp !== undefined ? Boolean(tpl.fields.showStamp) : base.miscellaneous.signatureAndStamp.showStamp,
        stampUrl: tpl.stampUrl !== undefined ? tpl.stampUrl : base.miscellaneous.signatureAndStamp.stampUrl,
        signatureTitle: tpl.signatoryLabel || base.miscellaneous.signatureAndStamp.signatureTitle,
      },
    },
  };
}

