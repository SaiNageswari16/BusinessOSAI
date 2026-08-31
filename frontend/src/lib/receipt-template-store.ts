export interface ReceiptTemplate {
  id: string;
  name: string;
  isDefault: boolean;
  paperSize: '80mm' | '58mm';
  fontDensity: 'normal' | 'compact' | 'large';
  storeName: string;
  branchName: string;
  headerTagline: string;
  invoiceTitle: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  cin: string;
  logoUrl?: string;
  
  // Toggle Options
  showLogo: boolean;
  showStoreAddress: boolean;
  showTaxId: boolean;
  showCustomerDetails: boolean;
  showItemHSN: boolean;
  showItemDiscount: boolean;
  showTaxBreakdown: boolean;
  showLoyaltyPoints: boolean;
  showPaymentMode: boolean;
  showQrCode: boolean;
  showDeclaration: boolean;
  showFooterNote: boolean;

  declarationText: string;
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
  storeName: 'LazyMonkeyAI Store',
  branchName: 'Main Branch (BR-100)',
  headerTagline: 'Smart AI Retail & Store Outlet',
  invoiceTitle: 'TAX INVOICE',
  address: '123 Commercial Hub, Main Market Street\nSan Francisco, CA 94103',
  phone: '+1 (555) 019-8273',
  email: 'pos@lazymonkeyai.com',
  gstin: '36AAAAA0000A1Z5',
  cin: 'U74999MH2026PTC123456',
  
  showLogo: true,
  showStoreAddress: true,
  showTaxId: true,
  showCustomerDetails: true,
  showItemHSN: true,
  showItemDiscount: true,
  showTaxBreakdown: true,
  showLoyaltyPoints: true,
  showPaymentMode: true,
  showQrCode: true,
  showDeclaration: true,
  showFooterNote: true,

  declarationText: 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
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
}

export function getTenantIdFromStorage(): string {
  if (typeof window === 'undefined') return 'default';
  try {
    const raw = localStorage.getItem('bos-tenant');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.id) return parsed.id;
    }
  } catch {}
  return 'default';
}

export function getActiveBillingGst(tenantId?: string): ActiveGstDetails | null {
  if (typeof window === 'undefined') return null;
  try {
    const tid = tenantId || getTenantIdFromStorage();

    // 1. Scoped Active Billing GST details for this specific tenant/workspace
    const storedGstRaw = localStorage.getItem(`bos_active_billing_gst_details_${tid}`);
    if (storedGstRaw) {
      const parsed = JSON.parse(storedGstRaw);
      if (parsed && (parsed.trade_name || parsed.gstin || parsed.logo_url)) return parsed;
    }

    // 2. Scoped Active Company in localStorage for this specific tenant
    const activeCompanyRaw = localStorage.getItem(`bos_active_company_${tid}`);
    if (activeCompanyRaw) {
      const comp = JSON.parse(activeCompanyRaw);
      if (comp) {
        const activeReg = comp.gst_registrations?.find((r: any) => r.is_primary) || comp.gst_registrations?.[0];
        const gstin = activeReg?.gstin || comp.gst_number || '';
        const stateCode = activeReg?.state_code || (gstin ? gstin.slice(0, 2) : '29');
        return {
          gstin,
          trade_name: activeReg?.trade_name || comp.name || 'Organization',
          legal_name: comp.legal_name || comp.name || 'Organization',
          state_code: stateCode,
          state_name: activeReg?.state_name || comp.state || 'State',
          address: activeReg?.address || comp.address || '',
          phone: comp.phone || '',
          email: comp.email || '',
          cin: comp.registration_number || '',
          pan: comp.pan_number || '',
          logo_url: comp.logo_url || null,
        };
      }
    }

    // 3. Fallback: Authenticated session tenant from bos-tenant
    const tenantRaw = localStorage.getItem('bos-tenant');
    if (tenantRaw) {
      const tenant = JSON.parse(tenantRaw);
      if (tenant && (tenant.name || tenant.id)) {
        const raw = tenant.raw || {};
        const settings = raw.settings || tenant.settings || {};
        const gstin = raw.gstin || raw.gst_number || settings.gstin || settings.gst_number || '';
        const stateCode = gstin ? gstin.slice(0, 2) : (settings.state_code || raw.state_code || '29');

        return {
          gstin,
          trade_name: tenant.name || raw.name || raw.trade_name || 'Organization',
          legal_name: raw.legal_name || tenant.name || 'Organization',
          state_code: stateCode,
          state_name: settings.state || raw.state || 'State',
          address: raw.address || settings.address || '',
          phone: raw.phone || settings.phone || tenant.phone || '',
          email: raw.email || settings.email || tenant.email || '',
          cin: raw.cin || raw.registration_number || settings.cin || '',
          pan: raw.pan || raw.pan_number || settings.pan || '',
          logo_url: tenant.logo_url || raw.logo_url || null,
        };
      }
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
    localStorage.setItem(`bos_active_billing_gst_details_${tid}`, JSON.stringify(details));
    localStorage.setItem(`bos_active_billing_gstin_${tid}`, details.gstin);
    window.dispatchEvent(new CustomEvent('bos-active-gst-changed', { detail: details }));
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
    };
  }

  return active;
}

export function getTenantTemplatesKey(tenantId?: string): string {
  if (typeof window === 'undefined') return 'businessos_print_templates_v1';
  let tid = tenantId;
  if (!tid) {
    try {
      const raw = localStorage.getItem('bos-tenant');
      if (raw) {
        const parsed = JSON.parse(raw);
        tid = parsed?.id;
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
      const raw = localStorage.getItem('bos-tenant');
      if (raw) {
        const parsed = JSON.parse(raw);
        tid = parsed?.id;
      }
    } catch {}
  }
  return `user_active_print_templates_v1_${tid || 'default'}`;
}

export function getActiveBarcodeTemplate(): any {
  if (typeof window !== 'undefined') {
    try {
      const storageKey = getTenantTemplatesKey();
      const defaultsKey = getTenantDefaultsKey();
      const invTemplatesRaw = localStorage.getItem(storageKey) || localStorage.getItem('businessos_print_templates_v1');
      const userActiveDefaultsRaw = localStorage.getItem(defaultsKey) || localStorage.getItem('user_active_print_templates_v1');

      if (invTemplatesRaw) {
        const invTemplates = JSON.parse(invTemplatesRaw);
        const activeDefaults = userActiveDefaultsRaw ? JSON.parse(userActiveDefaultsRaw) : {};

        const activeBarcodeId = activeDefaults.barcodes;
        let matched = invTemplates.find((t: any) => t.id === activeBarcodeId);

        if (!matched) {
          matched = invTemplates.find((t: any) => t.category === 'barcodes' && t.isDefault) ||
                    invTemplates.find((t: any) => t.category === 'barcodes') ||
                    invTemplates.find((t: any) => t.id === 'master-tpl-barcodes-retail');
        }

        if (matched) {
          return matched;
        }
      }
    } catch (e) {
      console.error('Error loading active barcode template:', e);
    }
  }

  return {
    id: 'master-tpl-barcodes-retail',
    name: 'Retail Jewelry & Apparel Tag (2 Inch / 50x25mm)',
    category: 'barcodes',
    paperSize: '50x25mm',
    storeName: 'LAZYMONKEY AI SUPERSTORE',
    primaryColor: '#0f172a',
    fields: {
      showCompanyName: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: true,
      showCategoryBrand: true,
      showBarcodeGraphic: true,
      showHSN: true,
      showMfgExpDate: true
    }
  };
}

export function getActiveInvoicePrintTemplate(): any {
  const activeGst = getActiveBillingGst();

  if (typeof window !== 'undefined') {
    try {
      const storageKey = getTenantTemplatesKey();
      const defaultsKey = getTenantDefaultsKey();
      const invTemplatesRaw = localStorage.getItem(storageKey);
      const userActiveDefaultsRaw = localStorage.getItem(defaultsKey);

      if (invTemplatesRaw) {
        const invTemplates = JSON.parse(invTemplatesRaw);
        const activeDefaults = userActiveDefaultsRaw ? JSON.parse(userActiveDefaultsRaw) : {};

        const activeInvoiceId = activeDefaults.invoices;
        let matched = invTemplates.find((t: any) => t.id === activeInvoiceId);

        if (!matched) {
          matched = invTemplates.find((t: any) => t.category === 'invoices' && t.isDefault) ||
                    invTemplates.find((t: any) => t.category === 'invoices') ||
                    invTemplates.find((t: any) => t.id === 'tpl-inv-stylish');
        }

        if (matched) {
          if (activeGst) {
            return {
              ...matched,
              gstin: activeGst.gstin || matched.gstin,
              storeName: activeGst.trade_name || activeGst.legal_name || matched.storeName,
              storeAddress: activeGst.address || matched.storeAddress,
              storePhone: activeGst.phone || matched.storePhone,
              storeEmail: activeGst.email || matched.storeEmail,
              cin: activeGst.cin || matched.cin,
              logoUrl: activeGst.logo_url || (activeGst.trade_name ? '' : matched.logoUrl) || '',
            };
          }
          return matched;
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
      showBankDetails: false,
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
