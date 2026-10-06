import { printTemplatesApi } from "./api-client";

export interface ReceiptTemplate {
  id: string;
  name: string;
  isDefault: boolean;
  paperSize: '80mm' | '58mm';
  fontDensity: 'normal' | 'compact' | 'large';
  printClarity?: 'ultra_dark' | 'crisp_mono' | 'compact' | 'standard';
  fontFamily?: 'monospace' | 'sans-serif' | 'clean';
  dividerStyle?: 'dashed' | 'solid' | 'dotted' | 'double';
  
  storeName: string;
  branchName: string;
  headerTagline: string;
  invoiceTitle: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  cin: string;
  pan?: string;
  logoUrl?: string;
  
  // Header Section Toggles
  showLogo: boolean;
  showStoreName?: boolean;
  showBranchName?: boolean;
  showStoreAddress: boolean;
  showStoreContact?: boolean;
  showTaxId: boolean;
  showCin?: boolean;
  showInvoiceTitle?: boolean;
  showTagline?: boolean;
  showCashier?: boolean;
  showTime?: boolean;
  showCustomerDetails: boolean;
  showCustomerAddress?: boolean;
  showCustomerPhone?: boolean;
  showShippingAddress?: boolean;
  showPoNumber?: boolean;
  showVehicleNumber?: boolean;
  showEwayBill?: boolean;
  showChallanNumber?: boolean;

  // Item Table Column Toggles
  showItemIndex?: boolean;
  showItemName?: boolean;
  showItemDescription?: boolean;
  showItemHSN: boolean;
  showItemSKU?: boolean;
  showItemQty?: boolean;
  showItemUom?: boolean;
  showItemRate?: boolean;
  showItemMrp?: boolean;
  showItemDiscount: boolean;
  showItemTax?: boolean;
  showItemTotal?: boolean;

  // Totals & Summary Toggles
  showSubtotal?: boolean;
  showTotalDiscount?: boolean;
  showSavingsBanner?: boolean;
  showTaxBreakdown: boolean;
  showRoundOff?: boolean;
  showGrandTotal?: boolean;
  showLoyaltyPoints: boolean;
  showPaymentMode: boolean;
  showPaidInFullStamp?: boolean;
  showQrCode: boolean;
  showGoogleReviewQR?: boolean;
  googleReviewUrl?: string;

  // Terms, Declaration & Footer Toggles
  showTermsAndConditions?: boolean;
  termsAndConditionsText?: string;
  showDeclaration: boolean;
  declarationText: string;
  showFooterNote: boolean;
  footerNote: string;

  qrType: 'upi' | 'einvoice' | 'url';
  upiId?: string;
}

export const DEFAULT_RECEIPT_TEMPLATE: ReceiptTemplate = {
  id: 'template-80mm-standard',
  name: 'HSPRINTER HS-KH80 (80mm Standard Thermal)',
  isDefault: true,
  paperSize: '80mm',
  fontDensity: 'normal',
  printClarity: 'ultra_dark',
  fontFamily: 'monospace',
  dividerStyle: 'dashed',
  storeName: 'LazyMonkeyAI Store',
  branchName: 'Main Branch (BR-100)',
  headerTagline: 'Smart AI Retail & Store Outlet',
  invoiceTitle: 'TAX INVOICE',
  address: '123 Commercial Hub, Main Market Street\nSan Francisco, CA 94103',
  phone: '+1 (555) 019-8273',
  email: 'pos@lazymonkeyai.com',
  gstin: '36AAAAA0000A1Z5',
  cin: 'U74999MH2026PTC123456',
  pan: 'AAAAA0000A',
  
  // Header Section
  showLogo: true,
  showStoreName: true,
  showBranchName: true,
  showStoreAddress: true,
  showStoreContact: true,
  showTaxId: true,
  showCin: true,
  showInvoiceTitle: true,
  showTagline: true,
  showCashier: true,
  showTime: true,
  showCustomerDetails: true,
  showCustomerAddress: true,
  showCustomerPhone: true,
  showShippingAddress: true,
  showPoNumber: true,
  showVehicleNumber: true,
  showEwayBill: true,
  showChallanNumber: true,

  // Item Table Columns
  showItemIndex: true,
  showItemName: true,
  showItemDescription: true,
  showItemHSN: true,
  showItemSKU: false,
  showItemQty: true,
  showItemUom: true,
  showItemRate: true,
  showItemMrp: true,
  showItemDiscount: true,
  showItemTax: true,
  showItemTotal: true,

  // Totals & Summary
  showSubtotal: true,
  showTotalDiscount: true,
  showSavingsBanner: true,
  showTaxBreakdown: true,
  showRoundOff: true,
  showGrandTotal: true,
  showLoyaltyPoints: true,
  showPaymentMode: true,
  showPaidInFullStamp: true,
  showQrCode: true,
  showGoogleReviewQR: false,
  googleReviewUrl: '',

  // Terms, Declaration & Footer
  showTermsAndConditions: true,
  termsAndConditionsText: '1. Goods once sold will not be taken back without original bill.\n2. Exchange valid within 7 days in original condition.\n3. Warranty claims subject to manufacturer terms & policy.\n4. All disputes subject to local jurisdiction only.',
  showDeclaration: true,
  declarationText: 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
  showFooterNote: true,
  footerNote: 'THANK YOU FOR SHOPPING WITH US!\nVISIT AGAIN • HAVE A NICE DAY',

  qrType: 'einvoice',
  upiId: 'lazymonkeyai@upi',
};

const STORAGE_KEY = 'bos_pos_active_receipt_templates_v1';

export function getStoredReceiptTemplates(): ReceiptTemplate[] {
  if (typeof window === 'undefined') return [DEFAULT_RECEIPT_TEMPLATE];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [DEFAULT_RECEIPT_TEMPLATE];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [DEFAULT_RECEIPT_TEMPLATE];
  } catch (err) {
    console.error('Failed to load receipt templates from storage:', err);
    return [DEFAULT_RECEIPT_TEMPLATE];
  }
}

export interface ActiveGstDetails {
  gstin: string;
  trade_name: string;
  legal_name: string;
  state_code: string;
  state_name: string;
  address: string;
  phone?: string;
  email?: string;
  cin?: string;
  pan?: string;
  logo_url?: string;
  google_review_url?: string | null;
  google_place_id?: string | null;
  google_review_enabled?: boolean;
  terms_and_conditions?: string | null;

  // Organization-level Document Numbering Prefixes
  invoice_prefix?: string | null;
  quotation_prefix?: string | null;
  estimate_prefix?: string | null;
  credit_note_prefix?: string | null;
  debit_note_prefix?: string | null;
  proforma_prefix?: string | null;

  // Organization-level Payment QR & Bank Details
  payment_qr_enabled?: boolean;
  payment_qr_type?: "dynamic_upi" | "razorpay" | "custom_image";
  payment_qr_custom_image_url?: string | null;
  upi_vpa?: string | null;
  upi_payee_name?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;

  // Organization-level Signature & Stamp
  signature_url?: string | null;
  stamp_url?: string | null;
  signature_title?: string | null;
  signature_company_name?: string | null;
  show_digital_signature?: boolean;
  show_digital_stamp?: boolean;
  signature_alignment?: "left" | "center" | "right";
}

export function getOrgSignatureSettings(tenantId?: string) {
  const active = getActiveBillingGst(tenantId);
  let storedSig: any = null;
  if (typeof window !== 'undefined') {
    const tid = tenantId || getTenantIdFromStorage();
    const raw = localStorage.getItem(`bos_signature_settings_${tid}`) || localStorage.getItem('bos_signature_settings');
    if (raw) {
      try { storedSig = JSON.parse(raw); } catch {}
    }
  }

  const companyName = active?.trade_name || active?.legal_name || 'Organization';

  return {
    signatureUrl: storedSig?.signatureUrl !== undefined ? storedSig.signatureUrl : (active?.signature_url || null),
    stampUrl: storedSig?.stampUrl !== undefined ? storedSig.stampUrl : (active?.stamp_url || null),
    signatureTitle: storedSig?.signatureTitle || active?.signature_title || "Authorized Signatory",
    signatureCompanyName: storedSig?.signatureCompanyName || active?.signature_company_name || `For ${companyName}`,
    showDigitalSignature: storedSig?.showDigitalSignature !== undefined ? storedSig.showDigitalSignature : (active?.show_digital_signature !== false),
    showDigitalStamp: storedSig?.showDigitalStamp !== undefined ? storedSig.showDigitalStamp : (active?.show_digital_stamp !== false),
    signatureAlignment: (storedSig?.signatureAlignment || active?.signature_alignment || "right") as "left" | "center" | "right",
  };
}

export function setOrgSignatureSettings(
  settings: {
    signature_url?: string | null;
    stamp_url?: string | null;
    signature_title?: string | null;
    signature_company_name?: string | null;
    show_digital_signature?: boolean;
    show_digital_stamp?: boolean;
    signature_alignment?: "left" | "center" | "right";
  },
  tenantId?: string
): void {
  if (typeof window === 'undefined') return;
  const tid = tenantId || getTenantIdFromStorage();
  const current = getActiveBillingGst(tid) || {
    gstin: '', trade_name: 'Organization', legal_name: 'Organization',
    state_code: '29', state_name: 'State', address: ''
  };
  const updated: ActiveGstDetails = {
    ...current,
    ...settings,
  };
  setActiveBillingGst(updated, tid);

  try {
    const sigPayload = {
      signatureUrl: settings.signature_url !== undefined ? settings.signature_url : current.signature_url,
      stampUrl: settings.stamp_url !== undefined ? settings.stamp_url : current.stamp_url,
      signatureTitle: settings.signature_title || current.signature_title || "Authorized Signatory",
      signatureCompanyName: settings.signature_company_name || current.signature_company_name || `For ${current.trade_name || 'Organization'}`,
      showDigitalSignature: settings.show_digital_signature !== false,
      showDigitalStamp: settings.show_digital_stamp !== false,
      signatureAlignment: settings.signature_alignment || current.signature_alignment || "right",
    };
    localStorage.setItem(`bos_signature_settings_${tid}`, JSON.stringify(sigPayload));
    localStorage.setItem('bos_signature_settings', JSON.stringify(sigPayload));
    window.dispatchEvent(new CustomEvent("bos-signature-settings-changed", { detail: sigPayload }));
  } catch {}
}

export function getOrgPaymentQrSettings(tenantId?: string) {
  const active = getActiveBillingGst(tenantId);
  let storedQr: any = null;
  if (typeof window !== 'undefined') {
    const tid = tenantId || getTenantIdFromStorage();
    const raw = localStorage.getItem(`bos_payment_qr_settings_${tid}`) || localStorage.getItem('bos_payment_qr_settings');
    if (raw) {
      try { storedQr = JSON.parse(raw); } catch {}
    }
  }

  return {
    enabled: storedQr?.enabled !== undefined ? storedQr.enabled : (active?.payment_qr_enabled !== false),
    type: (storedQr?.type || active?.payment_qr_type || "dynamic_upi") as "dynamic_upi" | "razorpay" | "custom_image",
    customImageUrl: storedQr?.customImageUrl || active?.payment_qr_custom_image_url || null,
    vpa: storedQr?.vpa || active?.upi_vpa || "",
    payeeName: storedQr?.payeeName || active?.upi_payee_name || active?.trade_name || active?.legal_name || "Merchant",
    bankName: active?.bank_name || "",
    accountNumber: active?.bank_account_number || "",
    ifsc: active?.bank_ifsc || "",
  };
}

export function setOrgPaymentQrSettings(
  settings: {
    payment_qr_enabled?: boolean;
    payment_qr_type?: "dynamic_upi" | "razorpay" | "custom_image";
    payment_qr_custom_image_url?: string | null;
    upi_vpa?: string | null;
    upi_payee_name?: string | null;
    bank_name?: string | null;
    bank_account_number?: string | null;
    bank_ifsc?: string | null;
  },
  tenantId?: string
): void {
  if (typeof window === 'undefined') return;
  const tid = tenantId || getTenantIdFromStorage();
  const current = getActiveBillingGst(tid) || {
    gstin: '', trade_name: 'Organization', legal_name: 'Organization',
    state_code: '29', state_name: 'State', address: ''
  };
  const updated: ActiveGstDetails = {
    ...current,
    ...settings,
  };
  setActiveBillingGst(updated, tid);

  try {
    const qrPayload = {
      enabled: settings.payment_qr_enabled !== false,
      type: settings.payment_qr_type || "dynamic_upi",
      customImageUrl: settings.payment_qr_custom_image_url || null,
      vpa: settings.upi_vpa || "",
      payeeName: settings.upi_payee_name || current.trade_name || "Merchant",
    };
    localStorage.setItem(`bos_payment_qr_settings_${tid}`, JSON.stringify(qrPayload));
    localStorage.setItem('bos_payment_qr_settings', JSON.stringify(qrPayload));
  } catch {}
}

export function getOrgDocumentPrefix(
  docType: "TAX_INVOICE" | "QUOTATION" | "ESTIMATE_NON_GST" | "PROFORMA" | "CREDIT_NOTE" | "DEBIT_NOTE" | string,
  tenantId?: string
): string {
  const active = getActiveBillingGst(tenantId);
  const typeUpper = String(docType || "TAX_INVOICE").toUpperCase();

  if (typeUpper === "TAX_INVOICE" || typeUpper === "INVOICE" || typeUpper === "INVOICES") {
    return active?.invoice_prefix?.trim() || "INV";
  }
  if (typeUpper === "QUOTATION" || typeUpper === "QUOTE" || typeUpper === "QT") {
    return active?.quotation_prefix?.trim() || "QT";
  }
  if (typeUpper === "ESTIMATE_NON_GST" || typeUpper === "ESTIMATE" || typeUpper === "EST") {
    return active?.estimate_prefix?.trim() || "EST";
  }
  if (typeUpper === "PROFORMA" || typeUpper === "PROFORMA_INVOICE" || typeUpper === "PI") {
    return active?.proforma_prefix?.trim() || "PI";
  }
  if (typeUpper === "CREDIT_NOTE" || typeUpper === "CN") {
    return active?.credit_note_prefix?.trim() || "CN";
  }
  if (typeUpper === "DEBIT_NOTE" || typeUpper === "DN") {
    return active?.debit_note_prefix?.trim() || "DN";
  }

  return active?.invoice_prefix?.trim() || "INV";
}

export function setOrgDocumentPrefixes(
  prefixes: {
    invoice_prefix?: string;
    quotation_prefix?: string;
    estimate_prefix?: string;
    credit_note_prefix?: string;
    debit_note_prefix?: string;
    proforma_prefix?: string;
  },
  tenantId?: string
): void {
  if (typeof window === 'undefined') return;
  const tid = tenantId || getTenantIdFromStorage();
  const current = getActiveBillingGst(tid) || {
    gstin: '', trade_name: 'Organization', legal_name: 'Organization',
    state_code: '29', state_name: 'State', address: ''
  };
  const updated: ActiveGstDetails = {
    ...current,
    ...prefixes,
  };
  setActiveBillingGst(updated, tid);
}

export function getTenantIdFromStorage(): string {
  if (typeof window === 'undefined') return 'default';
  try {
    const raw = localStorage.getItem('bos-tenant');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.raw?.tenant_id || parsed?.tenant_id) return parsed.raw?.tenant_id || parsed.tenant_id;
      if (parsed?.id) return parsed.id;
    }
  } catch {}
  return 'default';
}

export function getCompanyIdFromStorage(): string {
  if (typeof window === 'undefined') return 'default';
  try {
    const raw = localStorage.getItem('bos-tenant');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.id || parsed?.company_id || parsed?.raw?.id) {
        return parsed.id || parsed.company_id || parsed.raw?.id;
      }
    }
    const actComp = localStorage.getItem('bos_active_company');
    if (actComp) {
      try {
        const parsedComp = JSON.parse(actComp);
        return parsedComp.id || parsedComp;
      } catch {
        return actComp;
      }
    }
  } catch {}
  return 'default';
}

const INVALID_COMPANY_NAMES = new Set([
  'individual / proprietorship',
  'proprietorship',
  'partnership',
  'private limited company',
  'public limited company',
  'limited liability partnership',
  'society/ club/ trust/ aop',
  'government department',
  'public sector undertaking',
  'unlimited company',
  'organization',
  'company',
  'default company',
]);

export function isGenericBusinessTerm(name?: string | null): boolean {
  if (!name || typeof name !== 'string') return true;
  const clean = name.trim().toLowerCase();
  return INVALID_COMPANY_NAMES.has(clean) || clean.startsWith('individual /') || clean === 'organization' || clean === 'company' || clean === 'default company';
}

export function getActiveBillingGst(tenantId?: string): ActiveGstDetails | null {
  if (typeof window === 'undefined') return null;
  try {
    const tid = tenantId || getTenantIdFromStorage();

    // 0. Authenticated session tenant from bos-tenant
    let sessionTenant: any = null;
    const tenantRaw = localStorage.getItem('bos-tenant');
    if (tenantRaw) {
      try { sessionTenant = JSON.parse(tenantRaw); } catch {}
    }

    const fallbackName = (!isGenericBusinessTerm(sessionTenant?.name) ? sessionTenant?.name : '') || 
                         (!isGenericBusinessTerm(sessionTenant?.raw?.name) ? sessionTenant?.raw?.name : '') || 
                         'Workspace';

    // Scoped Active Company in localStorage for this specific tenant
    let activeComp: any = null;
    const activeCompanyRaw = tid ? localStorage.getItem(`bos_active_company_${tid}`) : null;
    if (activeCompanyRaw) {
      try { activeComp = JSON.parse(activeCompanyRaw); } catch {}
    }

    // 1. Scoped Active Billing GST details for this specific tenant/workspace
    const storedGstRaw = tid ? localStorage.getItem(`bos_active_billing_gst_details_${tid}`) : null;
    if (storedGstRaw) {
      const parsed = JSON.parse(storedGstRaw);
      if (parsed && (parsed.trade_name || parsed.gstin || parsed.logo_url || parsed.google_review_url || parsed.terms_and_conditions)) {
        const resolvedTradeName = !isGenericBusinessTerm(parsed.trade_name) ? parsed.trade_name : (!isGenericBusinessTerm(activeComp?.name) ? activeComp.name : fallbackName);
        const resolvedLegalName = !isGenericBusinessTerm(parsed.legal_name) ? parsed.legal_name : (!isGenericBusinessTerm(activeComp?.legal_name) ? activeComp.legal_name : resolvedTradeName);
        return {
          ...parsed,
          trade_name: resolvedTradeName,
          legal_name: resolvedLegalName,
          terms_and_conditions: parsed.terms_and_conditions || activeComp?.terms_and_conditions || null,
        };
      }
    }

    // 2. Active Company fallback
    if (activeComp) {
      const activeReg = activeComp.gst_registrations?.find((r: any) => r.is_primary) || activeComp.gst_registrations?.[0];
      const gstin = activeReg?.gstin || activeComp.gst_number || '';
      const stateCode = activeReg?.state_code || (gstin ? gstin.slice(0, 2) : '29');
      const compTrade = !isGenericBusinessTerm(activeReg?.trade_name) ? activeReg?.trade_name : (!isGenericBusinessTerm(activeComp.name) ? activeComp.name : fallbackName);
      const compLegal = !isGenericBusinessTerm(activeComp.legal_name) ? activeComp.legal_name : compTrade;
      return {
        gstin,
        trade_name: compTrade,
        legal_name: compLegal,
        state_code: stateCode,
        state_name: activeReg?.state_name || activeComp.state || 'State',
        address: activeReg?.address || activeComp.address || '',
        phone: activeComp.phone || '',
        email: activeComp.email || '',
        cin: activeComp.registration_number || '',
        pan: activeComp.pan_number || '',
        logo_url: activeComp.logo_url || null,
        google_review_url: activeComp.google_review_url || null,
        google_place_id: activeComp.google_place_id || null,
        google_review_enabled: activeComp.google_review_enabled !== false,
        terms_and_conditions: activeComp.terms_and_conditions || null,
      };
    }

    // 3. Fallback: Authenticated session tenant from bos-tenant
    if (sessionTenant && (sessionTenant.name || sessionTenant.id)) {
      const raw = sessionTenant.raw || {};
      const settings = raw.settings || sessionTenant.settings || {};
      const gstin = raw.gstin || raw.gst_number || settings.gstin || settings.gst_number || '';
      const stateCode = gstin ? gstin.slice(0, 2) : (settings.state_code || raw.state_code || '29');
      const tTrade = !isGenericBusinessTerm(sessionTenant.name) ? sessionTenant.name : (!isGenericBusinessTerm(raw.trade_name) ? raw.trade_name : (!isGenericBusinessTerm(raw.name) ? raw.name : 'Workspace'));
      const tLegal = !isGenericBusinessTerm(raw.legal_name) ? raw.legal_name : tTrade;

      return {
        gstin,
        trade_name: tTrade,
        legal_name: tLegal,
        state_code: stateCode,
        state_name: settings.state || raw.state || 'State',
        address: raw.address || settings.address || '',
        phone: raw.phone || settings.phone || sessionTenant.phone || '',
        email: raw.email || settings.email || sessionTenant.email || '',
        cin: raw.cin || raw.registration_number || settings.cin || '',
        pan: raw.pan || raw.pan_number || settings.pan || '',
        logo_url: sessionTenant.logo_url || raw.logo_url || null,
        google_review_url: raw.google_review_url || settings.google_review_url || null,
        google_place_id: raw.google_place_id || settings.google_place_id || null,
        google_review_enabled: raw.google_review_enabled !== false && settings.google_review_enabled !== false,
        terms_and_conditions: settings.terms_and_conditions || raw.terms_and_conditions || null,
      };
    }
  } catch (err) {
    console.error('Error resolving active billing GST:', err);
  }
  return null;
}

export function setActiveBillingGst(details: ActiveGstDetails, tenantId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const tid = tenantId || getTenantIdFromStorage();
    let existing: any = {};
    try {
      const raw = localStorage.getItem(`bos_active_billing_gst_details_${tid}`);
      if (raw) existing = JSON.parse(raw);
    } catch {}
    const merged = { ...existing, ...details };
    localStorage.setItem(`bos_active_billing_gst_details_${tid}`, JSON.stringify(merged));
    localStorage.setItem(`bos_active_billing_gstin_${tid}`, details.gstin || existing.gstin || '');
    window.dispatchEvent(new CustomEvent('bos-active-gst-changed', { detail: merged }));
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.error('Error saving active billing GST:', err);
  }
}

export function getActiveReceiptTemplate(): ReceiptTemplate {
  const activeGst = getActiveBillingGst();

  if (typeof window !== 'undefined') {
    try {
      const invTemplatesRaw = localStorage.getItem('businessos_print_templates_v1');
      const userActiveDefaultsRaw = localStorage.getItem('user_active_print_templates_v1');

      if (invTemplatesRaw) {
        const invTemplates = JSON.parse(invTemplatesRaw);
        const activeDefaults = userActiveDefaultsRaw ? JSON.parse(userActiveDefaultsRaw) : {};

        const activeThermalId = activeDefaults.thermal || activeDefaults.invoices;
        let matched = invTemplates.find((t: any) => t.id === activeThermalId);

        if (!matched) {
          matched = invTemplates.find((t: any) => t.category === 'thermal' && t.isDefault) ||
                    invTemplates.find((t: any) => t.category === 'thermal') ||
                    invTemplates.find((t: any) => t.isDefault);
        }

        if (matched) {
          const fields = matched.fields || {};
          return {
            id: matched.id,
            name: matched.name || 'Organization Active Print Template',
            isDefault: true,
            paperSize: matched.paperSize === '58mm' ? '58mm' : '80mm',
            fontDensity: 'normal',
            storeName: activeGst?.trade_name || activeGst?.legal_name || matched.storeName || 'LazyMonkeyAI Store',
            branchName: matched.branchName || '',
            headerTagline: matched.headerTagline || '',
            invoiceTitle: matched.headerTitle || 'TAX INVOICE',
            address: activeGst?.address || matched.storeAddress || '',
            phone: activeGst?.phone || matched.storePhone || '',
            email: activeGst?.email || matched.storeEmail || '',
            gstin: activeGst?.gstin || matched.gstin || '',
            cin: activeGst?.cin || matched.cin || '',
            logoUrl: activeGst?.logo_url || matched.logoUrl || '',

            showLogo: fields.showLogo !== false,
            showStoreAddress: fields.showStoreAddress !== false,
            showTaxId: fields.showTaxSplit !== false,
            showCustomerDetails: fields.showCustomerDetails !== false,
            showItemHSN: fields.showHSN !== false,
            showItemDiscount: fields.showItemDescription !== false,
            showTaxBreakdown: fields.showTaxSplit !== false,
            showLoyaltyPoints: true,
            showPaymentMode: fields.showBankDetails !== false,
            showQrCode: fields.showPaymentQR !== false,
            showDeclaration: Boolean(matched.termsText),
            showFooterNote: Boolean(matched.footerText),

            declarationText: matched.termsText || 'We declare that this invoice shows the actual price of the goods described.',
            footerNote: matched.footerText || 'THANK YOU FOR SHOPPING WITH US!\nVISIT AGAIN',
            qrType: 'einvoice',
          };
        }
      }
    } catch (e) {
      console.error('Error loading inventory active print template:', e);
    }
  }

  const templates = getStoredReceiptTemplates();
  const active = templates.find((t) => t.isDefault) || templates[0] || DEFAULT_RECEIPT_TEMPLATE;

  if (activeGst) {
    return {
      ...active,
      storeName: activeGst.trade_name || activeGst.legal_name || active.storeName,
      address: activeGst.address || active.address,
      phone: activeGst.phone || active.phone,
      email: activeGst.email || active.email,
      gstin: activeGst.gstin || active.gstin,
      cin: activeGst.cin || active.cin,
      logoUrl: activeGst.logo_url || active.logoUrl || '',
      googleReviewUrl: activeGst.google_review_url || active.googleReviewUrl || '',
      showGoogleReviewQR: activeGst.google_review_enabled === true,
    };
  }

  return active;
}

export function getTenantTemplatesKey(tenantId?: string): string {
  if (typeof window === 'undefined') return 'businessos_print_templates_v1';
  let tid = tenantId;
  if (!tid) {
    try {
      const authRaw = localStorage.getItem('bos-auth');
      if (authRaw) {
        const authParsed = JSON.parse(authRaw);
        tid = authParsed?.user?.tenantId || authParsed?.user?.tenant_id || authParsed?.user?.tenantSlug;
      }
      if (!tid) {
        const raw = localStorage.getItem('bos-tenant');
        if (raw) {
          const parsed = JSON.parse(raw);
          tid = parsed?.id;
        }
      }
    } catch {}
  }
  return `businessos_print_templates_v1_${tid || 'default'}`;
}

export function getTenantDefaultsKey(tenantId?: string): string {
  if (typeof window === 'undefined') return 'user_active_print_templates_v1';
  let tid = tenantId;
  if (!tid) {
    try {
      const authRaw = localStorage.getItem('bos-auth');
      if (authRaw) {
        const authParsed = JSON.parse(authRaw);
        tid = authParsed?.user?.tenantId || authParsed?.user?.tenant_id || authParsed?.user?.tenantSlug;
      }
      if (!tid) {
        const raw = localStorage.getItem('bos-tenant');
        if (raw) {
          const parsed = JSON.parse(raw);
          tid = parsed?.id;
        }
      }
    } catch {}
  }
  return `user_active_print_templates_v1_${tid || 'default'}`;
}

export const DEFAULT_BARCODE_TEMPLATES = [
  {
    id: "tpl-bar-mybillbook",
    name: "myBillBook Clean Barcode (50x25mm Dual)",
    category: "barcodes",
    description: "Exact myBillBook standard 50x25mm / 2-up thermal roll barcode tag with centered Business Name, Item Code, Item Name, and SP/MRP pricing.",
    isDefault: true,
    paperSize: "50x25mm",
    layout: "1up",
    barcodeFormat: "Code-128",
    primaryColor: "#000000",
    fontFamily: "Inter, sans-serif",
    textAlign: "center",
    spPrefix: "SP: ",
    mrpPrefix: "MRP: ",
    spBadgeStyle: "none",
    showMrpStrike: false,
    priceLayout: "center_offer",
    themeName: "mybillbook_clean",
    fields: {
      showCompanyName: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: true,
      showCategoryBrand: false,
      showBarcodeGraphic: true,
      showBarcodeText: true,
      showHSN: false,
      showMfgExpDate: false,
      showCustomTagline: false,
    },
    elementSettings: {
      header: { fontSize: 12, fontWeight: "700", textAlign: "center" },
      sku: { fontSize: 10, fontWeight: "600", textAlign: "center" },
      productName: { fontSize: 10, fontWeight: "600", textAlign: "center" },
      priceSp: { fontSize: 10, fontWeight: "700", textAlign: "center" },
      priceMrp: { fontSize: 10, fontWeight: "600", textAlign: "center" },
    }
  },
  {
    id: "tpl-bar-trendy-offer",
    name: "Trendy Retail Tag (Centered SP & MRP)",
    category: "barcodes",
    description: "Apparel & retail dual/single tag with centered Store Name, Product Name, and inline SP & MRP pricing.",
    isDefault: false,
    paperSize: "50x25mm",
    layout: "1up",
    barcodeFormat: "Auto",
    primaryColor: "#0f172a",
    fontFamily: "Inter, sans-serif",
    textAlign: "center",
    spPrefix: "SP: ",
    mrpPrefix: "MRP: ",
    spBadgeStyle: "none",
    showMrpStrike: false,
    priceLayout: "center_offer",
    themeName: "trendy_offer",
    fields: {
      showCompanyName: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: false,
      showCategoryBrand: false,
      showBarcodeGraphic: true,
      showBarcodeText: true,
      showHSN: false,
      showMfgExpDate: false,
      showCustomTagline: false,
    },
  },
  {
    id: "tpl-bar-dual-trendy",
    name: "Trendy Dual-Roll Tag (100x25mm / 2-Up)",
    category: "barcodes",
    description: "Standard 2-across dual thermal roll for TSC, TVS, Xprinter, and Zebra with centered SP & MRP layout.",
    isDefault: false,
    paperSize: "100x25mm",
    layout: "2up",
    barcodeFormat: "Auto",
    primaryColor: "#0f172a",
    fontFamily: "Inter, sans-serif",
    textAlign: "center",
    spPrefix: "SP: ",
    mrpPrefix: "MRP: ",
    spBadgeStyle: "none",
    showMrpStrike: false,
    priceLayout: "center_offer",
    themeName: "trendy_offer",
    fields: {
      showCompanyName: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: false,
      showCategoryBrand: false,
      showBarcodeGraphic: true,
      showBarcodeText: true,
      showHSN: false,
      showMfgExpDate: false,
      showCustomTagline: false,
    },
  },
  {
    id: "tpl-bar-retail-50x25",
    name: "Standard 2x1 Inch Tag (50x25mm / 2\" x 1\")",
    category: "barcodes",
    description: "Compact 2-inch single label roll with Emerald Green SP badge and strikethrough MRP.",
    isDefault: false,
    paperSize: "50x25mm",
    layout: "1up",
    barcodeFormat: "Auto",
    primaryColor: "#0f172a",
    textAlign: "center",
    spPrefix: "SP: ",
    mrpPrefix: "MRP: ",
    spBadgeStyle: "pill",
    showMrpStrike: true,
    priceLayout: "inline",
    fields: {
      showCompanyName: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: true,
      showCategoryBrand: false,
      showBarcodeGraphic: true,
      showBarcodeText: true,
      showHSN: false,
      showMfgExpDate: false,
      showCustomTagline: false,
    },
  },
  {
    id: "tpl-bar-dual-100x25",
    name: "Supermarket Dual-Column Tag (100x25mm / 2-Up)",
    category: "barcodes",
    description: "Standard 2-across thermal roll for Xprinter XP-TT426B, TVS, TSC, and Zebra barcode printers.",
    isDefault: false,
    paperSize: "100x25mm",
    layout: "2up",
    barcodeFormat: "Auto",
    primaryColor: "#1e293b",
    textAlign: "center",
    spPrefix: "SP: ",
    mrpPrefix: "MRP: ",
    showMrpStrike: true,
    priceLayout: "inline",
    fields: {
      showCompanyName: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: true,
      showCategoryBrand: false,
      showBarcodeGraphic: true,
      showHSN: false,
      showMfgExpDate: false,
      showCustomTagline: false,
    },
  },
  {
    id: "tpl-bar-shipping-75x50",
    name: "Standard Shipping & Carton Tag (75x50mm / 3\" x 2\")",
    category: "barcodes",
    description: "High-visibility 3-inch label for outer cartons, dispatch, and parcel tracking.",
    isDefault: false,
    paperSize: "75x50mm",
    layout: "1up",
    barcodeFormat: "Auto",
    primaryColor: "#0f172a",
    textAlign: "center",
    spPrefix: "SP: ",
    mrpPrefix: "MRP: ",
    showMrpStrike: true,
    priceLayout: "inline",
    fields: {
      showCompanyName: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: true,
      showCategoryBrand: false,
      showBarcodeGraphic: true,
      showHSN: true,
      showMfgExpDate: false,
      showCustomTagline: false,
    },
  },
  {
    id: "tpl-bar-pharma-38x25",
    name: "Compact Pharmacy & Cosmetic Tag (38x25mm / 1.5\" x 1\")",
    category: "barcodes",
    description: "High-density micro label for small pharmacy strips, bottles, cosmetics, and hardware.",
    isDefault: false,
    paperSize: "38x25mm",
    layout: "1up",
    barcodeFormat: "Auto",
    primaryColor: "#0f172a",
    textAlign: "center",
    spPrefix: "SP: ",
    mrpPrefix: "MRP: ",
    showMrpStrike: true,
    priceLayout: "inline",
    fields: {
      showCompanyName: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: true,
      showCategoryBrand: false,
      showBarcodeGraphic: true,
      showHSN: false,
      showMfgExpDate: false,
      showCustomTagline: false,
    },
  },
  {
    id: "tpl-bar-cargo-100x75",
    name: "Warehouse Cargo & Pallet Tag (100x75mm / 4\" x 3\")",
    category: "barcodes",
    description: "Large 4-inch industrial label for pallet racks, bins, and cargo tracking.",
    isDefault: false,
    paperSize: "100x75mm",
    layout: "1up",
    barcodeFormat: "Auto",
    primaryColor: "#000000",
    textAlign: "center",
    spPrefix: "SP: ",
    mrpPrefix: "MRP: ",
    showMrpStrike: true,
    priceLayout: "inline",
    fields: {
      showCompanyName: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: true,
      showCategoryBrand: false,
      showBarcodeGraphic: true,
      showHSN: true,
      showMfgExpDate: false,
      showCustomTagline: false,
    },
  },
  {
    id: "tpl-bar-a4-24",
    name: "A4 Sticker Sheet (24-Up / 3x8 Grid)",
    category: "barcodes",
    description: "24 self-adhesive sticker labels per A4 sheet (70mm x 35mm each). Ideal for regular office inkjet/laser printers.",
    isDefault: false,
    paperSize: "A4",
    layout: "a4_24",
    barcodeFormat: "Auto",
    primaryColor: "#0f172a",
    spPrefix: "SP: ",
    mrpPrefix: "MRP: ",
    showMrpStrike: true,
    priceLayout: "inline",
    fields: {
      showCompanyName: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: true,
      showCategoryBrand: true,
      showBarcodeGraphic: true,
      showHSN: true,
      showMfgExpDate: true,
    },
  },
  {
    id: "tpl-bar-a4-40",
    name: "A4 Sticker Sheet (40-Up / 4x10 Grid)",
    category: "barcodes",
    description: "40 sticker labels per A4 sheet (48.5mm x 25.4mm each).",
    isDefault: false,
    paperSize: "A4",
    layout: "a4_40",
    barcodeFormat: "Auto",
    primaryColor: "#0f172a",
    spPrefix: "SP: ",
    mrpPrefix: "MRP: ",
    showMrpStrike: true,
    priceLayout: "inline",
    fields: {
      showCompanyName: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: true,
      showCategoryBrand: true,
      showBarcodeGraphic: true,
      showHSN: false,
      showMfgExpDate: true,
    },
  },
  {
    id: "tpl-bar-a4-65",
    name: "A4 Sticker Sheet (65-Up / 5x13 Grid)",
    category: "barcodes",
    description: "65 compact barcode sticker labels per A4 sheet (38mm x 21.2mm each).",
    isDefault: false,
    paperSize: "A4",
    layout: "a4_65",
    barcodeFormat: "Auto",
    primaryColor: "#0f172a",
    spPrefix: "SP: ",
    mrpPrefix: "MRP: ",
    showMrpStrike: false,
    priceLayout: "inline",
    fields: {
      showCompanyName: false,
      showProductName: true,
      showPrice: true,
      showMRP: false,
      showSKU: true,
      showCategoryBrand: false,
      showBarcodeGraphic: true,
      showHSN: false,
      showMfgExpDate: false,
    },
  },
];

let isSyncingBackendTemplates = false;
let lastSyncTimestamp = 0;

export async function syncPrintTemplatesFromBackend(force: boolean = false): Promise<any[]> {
  if (typeof window === "undefined") return [];
  const now = Date.now();
  if (!force && isSyncingBackendTemplates) return [];
  if (!force && now - lastSyncTimestamp < 15000) return []; // debounce 15s

  isSyncingBackendTemplates = true;
  lastSyncTimestamp = now;

  try {
    const res = await printTemplatesApi.getTemplates();
    if (res && Array.isArray(res.templates) && res.templates.length > 0) {
      const storageKey = getTenantTemplatesKey();
      const existingRaw = localStorage.getItem(storageKey);
      let existing: any[] = [];
      if (existingRaw) {
        try { existing = JSON.parse(existingRaw) || []; } catch {}
      }

      // Merge backend templates with local cache (backend is source of truth for custom templates)
      const templateMap = new Map<string, any>();
      const sanitizeTpl = (t: any) => {
        if (!t || !t.id) return null;
        const copy = { ...t };
        const tname = String(copy.name || "");
        if (copy.id === "tpl-bar-trendy-offer" || tname.includes("Centered Offer") || tname.includes("Offer & MRP")) {
          copy.name = "Trendy Retail Tag (Centered SP & MRP)";
          copy.spPrefix = "SP: ";
          copy.mrpPrefix = "MRP: ";
          copy.priceLayout = "center_offer";
          copy.themeName = "trendy_offer";
        }
        return copy;
      };

      existing.forEach((t) => { 
        const st = sanitizeTpl(t);
        if (st && st.id) templateMap.set(st.id, st); 
      });
      res.templates.forEach((t) => { 
        const st = sanitizeTpl(t);
        if (st && st.id) templateMap.set(st.id, st); 
      });

      const merged = Array.from(templateMap.values());
      localStorage.setItem(storageKey, JSON.stringify(merged));
      localStorage.setItem("businessos_print_templates_v1", JSON.stringify(merged));
      localStorage.setItem("bos_barcode_custom_templates", JSON.stringify(merged.filter((t: any) => t.category === "barcodes" || t.docType === "barcode")));

      // Also sync active map if present
      if (res.active_map) {
        const defaultsKey = getTenantDefaultsKey();
        const curDefRaw = localStorage.getItem(defaultsKey);
        const curDef = curDefRaw ? JSON.parse(curDefRaw) : {};
        const updatedDef = { ...curDef, ...res.active_map };
        if (res.active_map.barcodes) {
          updatedDef.barcode = res.active_map.barcodes;
          localStorage.setItem("bos_active_barcode_template_id", res.active_map.barcodes);
          localStorage.setItem("bos_active_barcode_template_id_default", res.active_map.barcodes);
        }
        if (res.active_map.invoices) {
          updatedDef.invoice = res.active_map.invoices;
          localStorage.setItem("bos_active_invoice_template_id", res.active_map.invoices);
        }
        localStorage.setItem(defaultsKey, JSON.stringify(updatedDef));
        localStorage.setItem("user_active_print_templates_v1", JSON.stringify(updatedDef));
      }

      window.dispatchEvent(new Event("print_templates_updated"));
      window.dispatchEvent(new Event("bos_barcode_template_changed"));
      return merged;
    }
  } catch (err) {
    // If offline or not authenticated yet, ignore gracefully
  } finally {
    isSyncingBackendTemplates = false;
  }
  return [];
}

// Auto-sync once on startup in browser
if (typeof window !== "undefined") {
  setTimeout(() => {
    syncPrintTemplatesFromBackend().catch(() => {});
  }, 1000);
}

export function getAllBarcodeTemplates(): any[] {
  const activeGst = getActiveBillingGst();
  const tenantOrgName = activeGst?.trade_name || activeGst?.legal_name || undefined;

  // Trigger background sync from backend database
  if (typeof window !== "undefined") {
    syncPrintTemplatesFromBackend().catch(() => {});
  }

  const storedMap = new Map<string, any>();

  if (typeof window !== "undefined") {
    try {
      const storageKey = getTenantTemplatesKey();
      const keysToCheck = [
        storageKey,
        "businessos_print_templates_v1",
        "bos_barcode_custom_templates",
        "bos_custom_barcode_templates_v1",
      ];

      for (const k of keysToCheck) {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              parsed.forEach((t: any) => {
                if (t && t.id && (t.category === "barcodes" || t.docType === "barcode" || String(t.id).startsWith("tpl-bar"))) {
                  if (!storedMap.has(t.id) || t.updatedAt || t.elements) {
                    storedMap.set(t.id, t);
                  }
                }
              });
            }
          }
        } catch {}
      }
    } catch {}
  }

  // Combine custom saved templates with default presets
  const combined: any[] = Array.from(storedMap.values());
  DEFAULT_BARCODE_TEMPLATES.forEach((def) => {
    if (!combined.some((t) => t.id === def.id)) {
      combined.push(def);
    }
  });

  return combined.map((t) => ({
    ...t,
    storeName: tenantOrgName || (t.storeName && !t.storeName.toUpperCase().includes("LAZYMONKEY") ? t.storeName : undefined),
  }));
}

export function getActiveBarcodeTemplate(): any {
  const activeGst = getActiveBillingGst();
  const tenantOrgName = activeGst?.trade_name || activeGst?.legal_name || undefined;

  const allTemplates = getAllBarcodeTemplates();

  if (typeof window !== 'undefined') {
    try {
      const defaultsKey = getTenantDefaultsKey();
      const userActiveDefaultsRaw = localStorage.getItem(defaultsKey) || localStorage.getItem('user_active_print_templates_v1');
      const activeDefaults = userActiveDefaultsRaw ? JSON.parse(userActiveDefaultsRaw) : {};

      const activeBarcodeId =
        activeDefaults.barcodes ||
        activeDefaults.barcode ||
        localStorage.getItem('bos_active_barcode_template_id') ||
        localStorage.getItem('bos_active_barcode_template_id_default');

      if (activeBarcodeId) {
        const found = allTemplates.find((t) => t.id === activeBarcodeId);
        if (found) {
          return {
            ...found,
            storeName: tenantOrgName || (found.storeName && !found.storeName.toUpperCase().includes('LAZYMONKEY') ? found.storeName : undefined)
          };
        }
      }

      const defaultTemplate = allTemplates.find((t) => t.isDefault) || allTemplates[0];
      if (defaultTemplate) {
        return {
          ...defaultTemplate,
          storeName: tenantOrgName || (defaultTemplate.storeName && !defaultTemplate.storeName.toUpperCase().includes('LAZYMONKEY') ? defaultTemplate.storeName : undefined)
        };
      }
    } catch (e) {
      console.error('Error loading active barcode template:', e);
    }
  }

  return {
    ...allTemplates[0] || DEFAULT_BARCODE_TEMPLATES[0],
    storeName: tenantOrgName || undefined,
  };
}

export function setActiveBarcodeTemplate(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const defaultsKey = getTenantDefaultsKey();
    const raw = localStorage.getItem(defaultsKey);
    const defaults = raw ? JSON.parse(raw) : {};
    defaults.barcodes = id;
    defaults.barcode = id;
    localStorage.setItem(defaultsKey, JSON.stringify(defaults));
    localStorage.setItem("user_active_print_templates_v1", JSON.stringify(defaults));
    localStorage.setItem("bos_active_barcode_template_id", id);
    localStorage.setItem("bos_active_barcode_template_id_default", id);

    // Also update isDefault in stored templates across all keys
    const storageKey = getTenantTemplatesKey();
    const keysToUpdate = [storageKey, "businessos_print_templates_v1", "bos_barcode_custom_templates"];

    keysToUpdate.forEach((k) => {
      try {
        const rawTpls = localStorage.getItem(k);
        if (rawTpls) {
          const parsed = JSON.parse(rawTpls);
          if (Array.isArray(parsed)) {
            const updated = parsed.map((t: any) => {
              if (t.category === "barcodes" || t.docType === "barcode" || String(t.id).startsWith("tpl-bar")) {
                return { ...t, isDefault: t.id === id };
              }
              return t;
            });
            localStorage.setItem(k, JSON.stringify(updated));
          }
        }
      } catch {}
    });

    // Save active preference to backend database for all users in the organization
    printTemplatesApi.setActiveTemplate(id, "barcodes").catch(() => {});

    window.dispatchEvent(new Event("print_templates_updated"));
    window.dispatchEvent(new Event("bos_barcode_template_changed"));
  } catch (e) {
    console.error("Error setting active barcode template:", e);
  }
}

export function saveBarcodeTemplate(updated: any, setAsDefault: boolean = false): void {
  if (typeof window === "undefined") return;
  try {
    const storageKey = getTenantTemplatesKey();
    const barcodeTemplate = {
      ...updated,
      category: "barcodes",
      docType: "barcode",
      updatedAt: new Date().toISOString(),
      isDefault: setAsDefault ? true : Boolean(updated.isDefault),
    };

    const keysToSync = [
      storageKey,
      "businessos_print_templates_v1",
      "bos_barcode_custom_templates",
    ];

    keysToSync.forEach((k) => {
      try {
        const raw = localStorage.getItem(k);
        let allTemplates: any[] = [];
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) allTemplates = parsed;
          } catch {}
        }

        const existingIdx = allTemplates.findIndex((t: any) => t.id === updated.id);
        if (existingIdx >= 0) {
          allTemplates[existingIdx] = barcodeTemplate;
        } else {
          allTemplates.push(barcodeTemplate);
        }

        if (setAsDefault) {
          allTemplates = allTemplates.map((t: any) => {
            if (t.category === "barcodes" || t.docType === "barcode" || String(t.id).startsWith("tpl-bar")) {
              return { ...t, isDefault: t.id === updated.id };
            }
            return t;
          });
        }

        localStorage.setItem(k, JSON.stringify(allTemplates));
      } catch {}
    });

    if (setAsDefault) {
      const defaultsKey = getTenantDefaultsKey();
      const rawDef = localStorage.getItem(defaultsKey);
      const defaults = rawDef ? JSON.parse(rawDef) : {};
      defaults.barcodes = updated.id;
      defaults.barcode = updated.id;
      localStorage.setItem(defaultsKey, JSON.stringify(defaults));
      localStorage.setItem("user_active_print_templates_v1", JSON.stringify(defaults));
      localStorage.setItem("bos_active_barcode_template_id", updated.id);
      localStorage.setItem("bos_active_barcode_template_id_default", updated.id);
    }

    // Persist directly to backend PostgreSQL database for the whole organization
    printTemplatesApi.saveTemplate(barcodeTemplate, setAsDefault).catch((err) => {
      console.warn("Backend template save sync deferred/offline:", err);
    });

    window.dispatchEvent(new Event("print_templates_updated"));
    window.dispatchEvent(new Event("bos_barcode_template_changed"));
  } catch (e) {
    console.error("Error saving barcode template:", e);
  }
}

export function deleteBarcodeTemplate(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const storageKey = getTenantTemplatesKey();
    const keysToClean = [storageKey, "businessos_print_templates_v1", "bos_barcode_custom_templates"];

    keysToClean.forEach((k) => {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((t: any) => t.id !== id);
            localStorage.setItem(k, JSON.stringify(filtered));
          }
        }
      } catch {}
    });

    // Delete from backend PostgreSQL database for the organization
    printTemplatesApi.deleteTemplate(id, "barcodes").catch(() => {});

    window.dispatchEvent(new Event("print_templates_updated"));
    window.dispatchEvent(new Event("bos_barcode_template_changed"));
  } catch (e) {
    console.error("Error deleting barcode template:", e);
  }
}

export function getActiveInvoicePrintTemplate(): any {
  const activeGst = getActiveBillingGst();

  if (typeof window !== 'undefined') {
    try {
      const storageKey = getTenantTemplatesKey();
      const defaultsKey = getTenantDefaultsKey();
      const invTemplatesRaw = localStorage.getItem(storageKey) || localStorage.getItem('businessos_print_templates_v1');
      const userActiveDefaultsRaw = localStorage.getItem(defaultsKey) || localStorage.getItem('user_active_print_templates_v1');

      if (invTemplatesRaw) {
        const invTemplates = JSON.parse(invTemplatesRaw);
        const activeDefaults = userActiveDefaultsRaw ? JSON.parse(userActiveDefaultsRaw) : {};

        const tid = getTenantIdFromStorage();
        const activeInvoiceId =
          activeDefaults.invoices ||
          activeDefaults.invoice ||
          (tid ? localStorage.getItem(`bos_active_invoice_template_id_${tid}`) : null) ||
          localStorage.getItem('bos_active_invoice_template_id') ||
          localStorage.getItem('bos_default_inv_template_id');

        let matched = invTemplates.find((t: any) => t.id === activeInvoiceId);

        if (!matched) {
          matched = invTemplates.find((t: any) => (t.category === 'invoices' || t.docType === 'invoice') && t.isDefault) ||
                    invTemplates.find((t: any) => t.category === 'invoices' || t.docType === 'invoice') ||
                    invTemplates.find((t: any) => t.id === 'tpl-inv-stylish') ||
                    invTemplates[0];
        }

        if (matched) {
          const isProddatur = matched.storeAddress && (matched.storeAddress.includes('KK Street, Proddatur') || matched.storeAddress.includes('Proddatur, YSR Cuddapah'));
          const isDummyGst = matched.gstin && matched.gstin.includes('37AABCCH694G1Z4');
          const isDummyPhone = matched.storePhone && matched.storePhone.includes('+91 9849344919');

          const cleanAddress = isProddatur ? '' : (matched.storeAddress || '');
          const cleanGstin = isDummyGst ? '' : (matched.gstin || '');
          const cleanPhone = isDummyPhone ? '' : (matched.storePhone || '');

          if (activeGst) {
            return {
              ...matched,
              gstin: activeGst.gstin || cleanGstin,
              storeName: activeGst.trade_name || activeGst.legal_name || matched.storeName,
              storeAddress: activeGst.address || cleanAddress,
              storePhone: activeGst.phone || cleanPhone,
              storeEmail: activeGst.email || matched.storeEmail,
              cin: activeGst.cin || matched.cin,
              logoUrl: activeGst.logo_url || (activeGst.trade_name ? '' : matched.logoUrl) || '',
              signatureUrl: activeGst.signature_url || matched.signatureUrl || matched.signature_url || null,
              stampUrl: activeGst.stamp_url || matched.stampUrl || matched.stamp_url || null,
              signatureTitle: activeGst.signature_title || matched.signatureTitle || matched.signature_title || 'Authorized Signatory',
              signatureCompanyName: activeGst.signature_company_name || matched.signatureCompanyName || `For ${activeGst.trade_name || activeGst.legal_name || matched.storeName || 'Organization'}`,
            };
          }
          return {
            ...matched,
            storeAddress: cleanAddress,
            gstin: cleanGstin,
            storePhone: cleanPhone,
            signatureUrl: matched.signatureUrl || matched.signature_url || null,
            stampUrl: matched.stampUrl || matched.stamp_url || null,
          };
        }
      }
    } catch (e) {
      console.error('Error loading active invoice template:', e);
    }
  }

  const base = {
    id: 'tpl-inv-stylish',
    name: 'Stylish Theme',
    category: 'invoices',
    isDefault: true,
    paperSize: 'A4',
    primaryColor: '#2563eb',
    fontFamily: 'Inter, sans-serif',
    headerTitle: 'TAX INVOICE',
    storeName: activeGst?.trade_name || activeGst?.legal_name || 'Organization',
    storeAddress: activeGst?.address || '',
    storePhone: activeGst?.phone || '',
    gstin: activeGst?.gstin || '',
    logoUrl: activeGst?.logo_url || '',
    footerText: 'Thank you for your business!',
    termsText: '1. Goods once sold will not be taken back.\n2. All disputes subject to local jurisdiction.',
    bankDetails: '',
    fields: {
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
    }
  };

  return base;
}

export function saveReceiptTemplates(templates: ReceiptTemplate[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch (err) {
    console.error('Failed to save receipt templates:', err);
  }
}

export function saveActiveReceiptTemplate(updated: ReceiptTemplate): void {
  const templates = getStoredReceiptTemplates();
  const index = templates.findIndex((t) => t.id === updated.id);
  
  let newTemplates: ReceiptTemplate[];
  if (index >= 0) {
    newTemplates = templates.map((t) => (t.id === updated.id ? { ...updated, isDefault: true } : { ...t, isDefault: false }));
  } else {
    newTemplates = [
      ...templates.map((t) => ({ ...t, isDefault: false })),
      { ...updated, isDefault: true },
    ];
  }
  saveReceiptTemplates(newTemplates);

  // Synchronize with businessos_print_templates_v1 and user_active_print_templates_v1
  if (typeof window !== 'undefined') {
    try {
      const rawActive = localStorage.getItem('user_active_print_templates_v1');
      const activeMap = rawActive ? JSON.parse(rawActive) : {};
      activeMap.thermal = updated.id;
      localStorage.setItem('user_active_print_templates_v1', JSON.stringify(activeMap));

      const rawInv = localStorage.getItem('businessos_print_templates_v1');
      let invList = rawInv ? JSON.parse(rawInv) : [];
      if (!Array.isArray(invList)) invList = [];

      const mappedInvTemplate = {
        id: updated.id,
        name: updated.name,
        category: 'thermal',
        isDefault: true,
        paperSize: updated.paperSize,
        storeName: updated.storeName,
        storeAddress: updated.address,
        storePhone: updated.phone,
        storeEmail: updated.email,
        gstin: updated.gstin,
        cin: updated.cin,
        headerTitle: updated.invoiceTitle,
        footerText: updated.footerNote,
        termsText: updated.declarationText,
        fields: {
          showLogo: updated.showLogo,
          showStoreAddress: updated.showStoreAddress,
          showTaxSplit: updated.showTaxBreakdown,
          showCustomerDetails: updated.showCustomerDetails,
          showProductName: true,
          showPrice: true,
          showMRP: true,
          showSKU: true,
          showHSN: updated.showItemHSN,
          showPartyBalance: true,
          showItemDescription: updated.showItemDiscount,
          showTime: true,
          showPaymentQR: updated.showQrCode,
          showBankDetails: updated.showPaymentMode,
        }
      };

      const existingInvIdx = invList.findIndex((t: any) => t.id === updated.id);
      if (existingInvIdx >= 0) {
        invList[existingInvIdx] = mappedInvTemplate;
      } else {
        invList.push(mappedInvTemplate);
      }
      localStorage.setItem('businessos_print_templates_v1', JSON.stringify(invList));
    } catch (e) {
      console.error('Failed to sync active template with inventory store:', e);
    }
  }
}
