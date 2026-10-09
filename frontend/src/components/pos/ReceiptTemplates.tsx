'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from "@/contexts/i18n-context";
import {
  FileCheck,
  Printer,
  Sparkles,
  Save,
  RotateCcw,
  CheckCircle2,
  Sliders,
  QrCode,
  Building,
  Phone,
  Mail,
  FileText,
  Eye,
  Check,
  Copy,
  Info,
  Type,
  Layers,
  ShoppingBag,
  Calculator,
  ShieldCheck,
  ScanBarcode,
  ExternalLink,
  Plus,
  Trash2,
  Minus,
  ChevronDown,
  ChevronUp,
  Upload,
  Image as ImageIcon,
  CheckCircle,
  HelpCircle,
  AlertCircle,
  Percent,
  CreditCard,
  MapPin,
  Star,
  PenTool,
  UserCheck,
  Stamp,
  Search,
  Loader2,
} from 'lucide-react';
import {
  ReceiptTemplate,
  DEFAULT_RECEIPT_TEMPLATE,
  getActiveReceiptTemplate,
  saveActiveReceiptTemplate,
  getStoredReceiptTemplates,
  getActiveBillingGst,
  setActiveBillingGst,
  getOrgPaymentQrSettings,
  setOrgPaymentQrSettings,
  getOrgSignatureSettings,
  setOrgSignatureSettings,
  setOrgDocumentPrefixes,
  type ActiveGstDetails,
} from '../../lib/receipt-template-store';
import { toast } from 'sonner';
import { triggerThermalPrint } from '../../lib/print-helper';
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { RealBarcodeSvg, printBarcodePopup } from '@/lib/barcode-svg';
import {
  DEFAULT_INVOICE_SETTINGS,
  loadStoredInvoiceSettings,
  saveStoredInvoiceSettings,
  type InvoiceSettings,
  type InvoiceCustomField,
  type ItemCustomColumn,
} from './InvoiceQuickSettingsModal';
import { WordInvoiceStudioModal } from './WordInvoiceStudioModal';
import { ThermalReceiptPrinter } from './ThermalReceiptPrinter';
import { companiesApi, numberSeriesApi, taxApi, type TaxCode, type Company } from '@/lib/api-client';
import { INDIAN_STATES } from '@/data/indian-states';
import { lookupGstinDetails } from '@/lib/gst-helper';
import { generateQRCodeSVG, buildUpiPayUrl } from '@/lib/qr-generator';

export interface BarcodeFieldConfig {
  key: string;
  label: string;
  enabled: boolean;
  fontSize: number;
  isBold: boolean;
  isCustom?: boolean;
}

export const DEFAULT_BARCODE_CONFIG = {
  printerType: 'label' as 'a4' | 'label',
  labelSize: '50x25_2up',
  labelDimensions: { width: 50, height: 25, labelsPerRow: 2 },
  fields: [
    { key: 'business_name', label: 'Business Name', enabled: true, fontSize: 35, isBold: true },
    { key: 'item_code', label: 'Item Code', enabled: true, fontSize: 22, isBold: true },
    { key: 'item_name', label: 'Item Name', enabled: true, fontSize: 22, isBold: false },
    { key: 'mrp', label: 'MRP', enabled: true, fontSize: 22, isBold: false },
    { key: 'selling_price', label: 'Selling Price', enabled: true, fontSize: 22, isBold: true },
    { key: 'hsn_code', label: 'HSN Code', enabled: false, fontSize: 20, isBold: false },
    { key: 'batch_no', label: 'Batch No / Expiry', enabled: false, fontSize: 20, isBold: false },
    { key: 'net_qty', label: 'Gross / Net Qty', enabled: false, fontSize: 20, isBold: false },
  ] as BarcodeFieldConfig[],
  customFields: [
    { key: 'test_field_1', label: 'Rack No', enabled: false, fontSize: 22, isBold: false, isCustom: true },
  ] as BarcodeFieldConfig[],
};

// Available Thermal Themes
const THERMAL_THEMES = [
  {
    id: 'compact',
    name: 'Compact',
    badge: null,
    description: 'Minimalistic & dense spacing, ideal for standard 58mm/80mm retail roll counters',
    previewBorder: 'border-slate-800',
    headerStyle: 'dense',
    dividerStyle: 'solid',
  },
  {
    id: 'advanced',
    name: 'Advanced',
    badge: 'PRO',
    description: 'Modern aesthetic with full metadata, sub-lines, UPI and Google QR integrations',
    previewBorder: 'border-purple-600',
    headerStyle: 'boxed',
    dividerStyle: 'dashed',
  },
  {
    id: 'simple',
    name: 'Simple',
    badge: null,
    description: 'Clean, legible receipts with clean lines and minimal ink overhead',
    previewBorder: 'border-slate-400',
    headerStyle: 'minimal',
    dividerStyle: 'dotted',
  },
  {
    id: 'classic',
    name: 'Classic',
    badge: null,
    description: 'Traditional POS format with double rules and monospaced typography',
    previewBorder: 'border-slate-600',
    headerStyle: 'classic',
    dividerStyle: 'double',
  },
];

type SettingsTab =
  | 'thermal_receipt'
  | 'invoice_details'
  | 'item_columns'
  | 'tax_finance'
  | 'google_reviews'
  | 'payment_qr'
  | 'signature_stamp'
  | 'barcode';

export function ReceiptTemplates() {
  const { t } = useI18n();
  const { currency } = useCurrency();
  const { tenant } = useTenant();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);
  const stampInputRef = useRef<HTMLInputElement>(null);
  const customQrInputRef = useRef<HTMLInputElement>(null);

  // Active Tab Navigator
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'invoice_details' || tab === 'invoice') return 'invoice_details';
      if (tab === 'item_columns' || tab === 'item') return 'item_columns';
      if (tab === 'tax_finance' || tab === 'tax' || tab === 'gst') return 'tax_finance';
      if (tab === 'google_reviews' || tab === 'reviews') return 'google_reviews';
      if (tab === 'payment_qr' || tab === 'upi') return 'payment_qr';
      if (tab === 'signature_stamp' || tab === 'signature') return 'signature_stamp';
      if (tab === 'barcode_print' || tab === 'barcode_settings' || tab === 'barcode') return 'barcode';
    }
    return 'thermal_receipt';
  });

  // Selected Thermal Theme
  const [selectedTheme, setSelectedTheme] = useState<string>('compact');

  // Thermal Template State
  const [template, setTemplate] = useState<ReceiptTemplate>(() => getActiveReceiptTemplate(tenant?.id));
  const [isSaved, setIsSaved] = useState(false);
  const [isWordStudioOpen, setIsWordStudioOpen] = useState(false);

  // Invoice & ERP Settings State
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>(() => loadStoredInvoiceSettings(tenant?.id));

  // Organization & GST State
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [activeBillingGstLocal, setActiveBillingGstLocal] = useState<ActiveGstDetails | null>(() => getActiveBillingGst(tenant?.id));
  const [gstForm, setGstForm] = useState({
    trade_name: '',
    legal_name: '',
    gstin: '',
    state_name: 'Telangana',
    state_code: '36',
    address: '',
    phone: '',
    email: '',
    pan: '',
    cin: '',
    is_composition: false,
    lut_number: '',
    lut_expiry: '',
    bank_name: '',
    bank_account: '',
    bank_ifsc: '',
    bank_branch: '',
    upi_id: '',
    terms_and_conditions:
      '1. Goods once sold will not be taken back or exchanged.\n2. All disputes are subject to local jurisdiction only.',
  });

  // Google Review QR State
  const [reviewForm, setReviewForm] = useState({
    google_review_enabled: true,
    google_review_url: 'https://search.google.com/local/writereview',
    google_place_id: '',
  });

  // Payment QR State
  const [paymentQrForm, setPaymentQrForm] = useState({
    payment_qr_enabled: true,
    payment_qr_type: 'dynamic_upi' as 'dynamic_upi' | 'razorpay' | 'custom_image',
    payment_qr_custom_image_url: '',
    upi_vpa: '',
    upi_payee_name: '',
  });

  // Signature and Stamp State
  const [signatureForm, setSignatureForm] = useState({
    signature_url: '',
    stamp_url: '',
    signature_title: 'Authorized Signatory',
    signature_company_name: '',
    show_digital_signature: true,
    show_digital_stamp: true,
    signature_alignment: 'right' as 'left' | 'center' | 'right',
  });

  // Tax Slabs State
  const [taxSlabs, setTaxSlabs] = useState<TaxCode[]>([]);
  const [newTaxRate, setNewTaxRate] = useState<string>('18');
  const [newTaxName, setNewTaxName] = useState<string>('GST 18%');
  const [isAddingTax, setIsAddingTax] = useState(false);
  const [isLookingUpGst, setIsLookingUpGst] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);

  // Accordion Expand/Collapse States in Thermal View
  const [expandedSections, setExpandedSections] = useState({
    logo: true,
    invoiceDetails: false,
    customFields: false,
    partyDetails: false,
    itemTable: false,
    customColumns: false,
    miscDetails: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Thermal Custom Header Fields Handlers
  const handleAddThermalCustomField = () => {
    const newField = {
      id: 'th_cf_' + Date.now(),
      name: '',
      value: '',
      enabled: true,
    };
    setTemplate((prev) => ({
      ...prev,
      customFields: [...(prev.customFields || []), newField],
    }));
  };

  const handleUpdateThermalCustomField = (
    id: string,
    patch: Partial<{ name: string; value?: string; enabled: boolean }>
  ) => {
    setTemplate((prev) => ({
      ...prev,
      customFields: (prev.customFields || []).map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
  };

  const handleDeleteThermalCustomField = (id: string) => {
    setTemplate((prev) => ({
      ...prev,
      customFields: (prev.customFields || []).filter((f) => f.id !== id),
    }));
  };

  // Thermal Custom Item Columns Handlers
  const handleAddThermalCustomColumn = () => {
    const newCol = {
      id: 'th_col_' + Date.now(),
      name: '',
      enabled: true,
    };
    setTemplate((prev) => ({
      ...prev,
      customItemColumns: [...(prev.customItemColumns || []), newCol],
    }));
  };

  const handleUpdateThermalCustomColumn = (
    id: string,
    patch: Partial<{ name: string; enabled: boolean }>
  ) => {
    setTemplate((prev) => ({
      ...prev,
      customItemColumns: (prev.customItemColumns || []).map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  };

  const handleDeleteThermalCustomColumn = (id: string) => {
    setTemplate((prev) => ({
      ...prev,
      customItemColumns: (prev.customItemColumns || []).filter((c) => c.id !== id),
    }));
  };

  // Barcode Print Settings State
  const [barcodeSettings, setBarcodeSettings] = useState(() => {
    try {
      const tid = tenant?.id || 'default';
      const saved =
        localStorage.getItem(`bos_barcode_print_settings_v1_${tid}`) ||
        localStorage.getItem('bos_barcode_print_settings_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_BARCODE_CONFIG;
  });

  // Hydrate all data on mount or tenant change
  useEffect(() => {
    const tid = tenant?.id;
    const active = getActiveReceiptTemplate(tid);
    setTemplate(active);
    setInvoiceSettings(loadStoredInvoiceSettings(tid));

    const currentGst = getActiveBillingGst(tid);
    setActiveBillingGstLocal(currentGst);
    if (currentGst) {
      setGstForm((prev) => ({
        ...prev,
        trade_name: currentGst.trade_name || '',
        legal_name: currentGst.legal_name || '',
        gstin: currentGst.gstin || '',
        state_name: currentGst.state_name || 'Telangana',
        state_code: currentGst.state_code || (currentGst.gstin ? currentGst.gstin.slice(0, 2) : '36'),
        address: currentGst.address || '',
        phone: currentGst.phone || '',
        email: currentGst.email || '',
        pan: currentGst.pan || '',
        cin: currentGst.cin || '',
        bank_name: currentGst.bank_name || '',
        bank_account: currentGst.bank_account_number || '',
        bank_ifsc: currentGst.bank_ifsc || '',
        upi_id: currentGst.upi_vpa || '',
        terms_and_conditions: currentGst.terms_and_conditions || prev.terms_and_conditions,
      }));

      setReviewForm({
        google_review_enabled: currentGst.google_review_enabled !== false,
        google_review_url: currentGst.google_review_url || 'https://search.google.com/local/writereview',
        google_place_id: currentGst.google_place_id || '',
      });

      const orgQr = getOrgPaymentQrSettings(tid);
      setPaymentQrForm({
        payment_qr_enabled: orgQr.enabled,
        payment_qr_type: (orgQr.type as any) || 'dynamic_upi',
        payment_qr_custom_image_url: orgQr.customImageUrl || '',
        upi_vpa: orgQr.vpa || currentGst.upi_vpa || currentGst.bank_ifsc || '',
        upi_payee_name: orgQr.payeeName || currentGst.upi_payee_name || currentGst.trade_name || 'Merchant',
      });
    } else {
      const orgQr = getOrgPaymentQrSettings(tid);
      setPaymentQrForm({
        payment_qr_enabled: orgQr.enabled,
        payment_qr_type: (orgQr.type as any) || 'dynamic_upi',
        payment_qr_custom_image_url: orgQr.customImageUrl || '',
        upi_vpa: orgQr.vpa || '',
        upi_payee_name: orgQr.payeeName || 'Merchant',
      });
    }

    const sigSettings = getOrgSignatureSettings(tid);
    if (sigSettings) {
      setSignatureForm({
        signature_url: sigSettings.signatureUrl || '',
        stamp_url: sigSettings.stampUrl || '',
        signature_title: sigSettings.signatureTitle || 'Authorized Signatory',
        signature_company_name: sigSettings.signatureCompanyName || '',
        show_digital_signature: sigSettings.showDigitalSignature !== false,
        show_digital_stamp: sigSettings.showDigitalStamp !== false,
        signature_alignment: (sigSettings.signatureAlignment as any) || 'right',
      });
    }

    // Load Companies
    companiesApi
      .list(1, 50)
      .then((res) => {
        setCompanies(res.items || []);
        if (res.items && res.items.length > 0) {
          const storedComp = localStorage.getItem('bos_active_company');
          let targetComp = res.items[0];
          if (storedComp) {
            try {
              const parsed = JSON.parse(storedComp);
              const found = res.items.find((c) => c.id === parsed.id);
              if (found) targetComp = found;
            } catch {}
          }
          setActiveCompany(targetComp);
        }
      })
      .catch(console.warn);

    // Load Tax Slabs
    taxApi
      .listTaxCodes()
      .then((res: any) => {
        const items = res?.items || (Array.isArray(res) ? res : []);
        setTaxSlabs(items);
      })
      .catch(console.warn);
  }, [tenant?.id]);

  // Handle GSTIN Live Lookup
  const handleLookupGstin = async () => {
    if (!gstForm.gstin || gstForm.gstin.length < 15) {
      toast.error('Please enter a valid 15-character GSTIN to lookup details.');
      return;
    }
    setIsLookingUpGst(true);
    try {
      const res = await lookupGstinDetails(gstForm.gstin.trim().toUpperCase());
      if (res && (res.trade_name || res.legal_name)) {
        setGstForm((prev) => ({
          ...prev,
          trade_name: res.trade_name || res.legal_name || prev.trade_name,
          legal_name: res.legal_name || prev.legal_name,
          state_name: res.state || prev.state_name,
          state_code: res.state_code || prev.state_code,
          address: res.principal_address || prev.address,
          pan: res.pan || prev.pan,
        }));
        toast.success(`Fetched GST profile for ${res.trade_name || res.legal_name}!`);
      } else {
        toast.error('Could not fetch GST details. Please verify GSTIN.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to lookup GSTIN details.');
    } finally {
      setIsLookingUpGst(false);
    }
  };

  // Add new Tax Code Slab
  const handleCreateTaxSlab = async () => {
    const rateNum = parseFloat(newTaxRate);
    if (isNaN(rateNum) || rateNum < 0) {
      toast.error('Please enter a valid tax rate percentage.');
      return;
    }
    setIsAddingTax(true);
    try {
      await taxApi.createTaxCode({
        code: `GST_${rateNum}%`,
        name: newTaxName.trim() || `GST ${rateNum}%`,
        rate: rateNum,
        tax_type: 'gst',
        is_inclusive: false,
        is_active: true,
      });
      toast.success(`GST Slab ${rateNum}% created successfully!`);
      const updated: any = await taxApi.listTaxCodes();
      setTaxSlabs(updated?.items || (Array.isArray(updated) ? updated : []));
      setNewTaxRate('');
      setNewTaxName('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create tax slab.');
    } finally {
      setIsAddingTax(false);
    }
  };

  // Generate Review Link from Place ID
  const handleGenerateReviewLinkFromPlaceId = () => {
    if (!reviewForm.google_place_id.trim()) {
      toast.error('Please enter a Google Place ID first.');
      return;
    }
    const generated = `https://search.google.com/local/writereview?placeid=${reviewForm.google_place_id.trim()}`;
    setReviewForm((prev) => ({ ...prev, google_review_url: generated }));
    toast.success('Generated Google Review Link from Place ID!');
  };

  // Master Comprehensive Save
  const handleSaveAll = async () => {
    setIsSavingAll(true);
    const tid = tenant?.id;
    try {
      // 1. Save Thermal Template
      saveActiveReceiptTemplate(template, tid);

      // 2. Save Invoice Quick Settings
      const cleanedInvoiceSettings: InvoiceSettings = {
        ...invoiceSettings,
        invoiceCustomFields: invoiceSettings.invoiceCustomFields.filter((f) => f.name.trim() !== ''),
        itemCustomColumns: invoiceSettings.itemCustomColumns.filter((c) => c.name.trim() !== ''),
      };
      saveStoredInvoiceSettings(cleanedInvoiceSettings, tid);

      // 3. Save Active GST Profile
      const cleanGst = gstForm.gstin.trim().toUpperCase();
      const detectedStateCode = cleanGst.length >= 2 ? cleanGst.slice(0, 2) : gstForm.state_code;
      const updatedGstDetails: ActiveGstDetails = {
        gstin: cleanGst,
        trade_name: gstForm.trade_name.trim() || activeCompany?.name || 'Organization',
        legal_name: gstForm.legal_name.trim() || activeCompany?.legal_name || gstForm.trade_name.trim(),
        state_code: detectedStateCode,
        state_name: gstForm.state_name,
        address: gstForm.address.trim(),
        phone: gstForm.phone.trim(),
        email: gstForm.email.trim(),
        pan: gstForm.pan.trim() || (cleanGst.length === 15 ? cleanGst.slice(2, 12) : ''),
        cin: gstForm.cin.trim(),
        logo_url: template.logoUrl || activeCompany?.logo_url || undefined,
        google_review_url: reviewForm.google_review_url.trim() || undefined,
        google_place_id: reviewForm.google_place_id.trim() || undefined,
        google_review_enabled: reviewForm.google_review_enabled,
        terms_and_conditions: gstForm.terms_and_conditions.trim() || null,
        payment_qr_enabled: paymentQrForm.payment_qr_enabled,
        payment_qr_type: paymentQrForm.payment_qr_type,
        payment_qr_custom_image_url: paymentQrForm.payment_qr_custom_image_url || null,
        upi_vpa: paymentQrForm.upi_vpa.trim() || gstForm.upi_id.trim() || null,
        upi_payee_name: paymentQrForm.upi_payee_name.trim() || gstForm.trade_name.trim() || null,
        bank_name: gstForm.bank_name.trim() || null,
        bank_account_number: gstForm.bank_account.trim() || null,
        bank_ifsc: gstForm.bank_ifsc.trim() || null,
        signature_url: signatureForm.signature_url || null,
        stamp_url: signatureForm.stamp_url || null,
        signature_title: signatureForm.signature_title.trim() || null,
      };
      setActiveBillingGst(updatedGstDetails, tid);

      // 4. Save Payment QR & Signature Settings
      setOrgPaymentQrSettings(
        {
          payment_qr_enabled: paymentQrForm.payment_qr_enabled,
          payment_qr_type: paymentQrForm.payment_qr_type,
          payment_qr_custom_image_url: paymentQrForm.payment_qr_custom_image_url || null,
          upi_vpa: paymentQrForm.upi_vpa.trim() || gstForm.upi_id.trim() || null,
          upi_payee_name: paymentQrForm.upi_payee_name.trim() || gstForm.trade_name.trim() || null,
          bank_name: gstForm.bank_name.trim() || null,
          bank_account_number: gstForm.bank_account.trim() || null,
          bank_ifsc: gstForm.bank_ifsc.trim() || null,
        },
        tid
      );

      setOrgSignatureSettings(
        {
          signature_url: signatureForm.signature_url || null,
          stamp_url: signatureForm.stamp_url || null,
          signature_title: signatureForm.signature_title.trim() || null,
          signature_company_name: signatureForm.signature_company_name.trim() || null,
          show_digital_signature: signatureForm.show_digital_signature,
          show_digital_stamp: signatureForm.show_digital_stamp,
          signature_alignment: signatureForm.signature_alignment,
        },
        tid
      );

      // 5. Save Org Document Prefixes
      if (cleanedInvoiceSettings.prefix || cleanedInvoiceSettings.quotationPrefix || cleanedInvoiceSettings.receiptPrefix) {
        setOrgDocumentPrefixes(
          {
            invoice_prefix: cleanedInvoiceSettings.prefix || 'INV-',
            quotation_prefix: cleanedInvoiceSettings.quotationPrefix || 'QT-',
            estimate_prefix: cleanedInvoiceSettings.estimatePrefix || 'EST-',
            proforma_prefix: cleanedInvoiceSettings.proformaPrefix || 'PI-',
            credit_note_prefix: cleanedInvoiceSettings.creditNotePrefix || 'CN-',
            debit_note_prefix: cleanedInvoiceSettings.debitNotePrefix || 'DN-',
            receipt_prefix: cleanedInvoiceSettings.receiptPrefix || 'REC-',
            receipt_sequence: cleanedInvoiceSettings.receiptSequenceNumber || 1,
            receipt_padding: cleanedInvoiceSettings.receiptPadding || 5,
          },
          tid
        );
      }

      // 6. Save Barcode Settings
      const barcodeKey = tid ? `bos_barcode_print_settings_v1_${tid}` : 'bos_barcode_print_settings_v1';
      localStorage.setItem(barcodeKey, JSON.stringify(barcodeSettings));

      // 7. Sync to Backend Company & Number Series
      if (activeCompany?.id) {
        try {
          await companiesApi.update(activeCompany.id, {
            name: updatedGstDetails.trade_name,
            legal_name: updatedGstDetails.legal_name,
            gst_number: updatedGstDetails.gstin,
            pan_number: updatedGstDetails.pan,
            address: updatedGstDetails.address,
            phone: updatedGstDetails.phone,
            email: updatedGstDetails.email,
            state: updatedGstDetails.state_name,
            google_review_url: updatedGstDetails.google_review_url || null,
            google_place_id: updatedGstDetails.google_place_id || null,
            google_review_enabled: updatedGstDetails.google_review_enabled,
            terms_and_conditions: updatedGstDetails.terms_and_conditions || null,
          });

          // Sync number series
          const invPadding = cleanedInvoiceSettings.padding ?? 4;
          const targetSeq = Math.max(0, Number(cleanedInvoiceSettings.sequenceNumber || 1) - 1);
          const seriesRes = await numberSeriesApi.list(1, 50, activeCompany.id);
          const seriesList = seriesRes.items || (seriesRes as any).data || [];
          const existingInv = seriesList.find((s) => s.module_name.toLowerCase().includes('invoice'));
          if (existingInv) {
            await numberSeriesApi
              .update(existingInv.id, {
                prefix: cleanedInvoiceSettings.prefix || 'INV-',
                current_number: targetSeq,
                padding: invPadding,
              })
              .catch(console.warn);
          } else {
            await numberSeriesApi
              .create({
                company_id: activeCompany.id,
                module_name: 'invoices',
                prefix: cleanedInvoiceSettings.prefix || 'INV-',
                current_number: targetSeq,
                padding: invPadding,
                status: 'active',
              })
              .catch(console.warn);
          }
        } catch (apiErr) {
          console.warn('Could not sync company / number series to backend:', apiErr);
        }
      }

      // 8. Broadcast live window events
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bos-receipt-template-changed', { detail: template }));
        window.dispatchEvent(new CustomEvent('bos-invoice-settings-changed', { detail: cleanedInvoiceSettings }));
        window.dispatchEvent(new CustomEvent('bos-active-gst-changed', { detail: updatedGstDetails }));
        window.dispatchEvent(new CustomEvent('bos-payment-qr-changed', { detail: paymentQrForm }));
        window.dispatchEvent(new CustomEvent('bos-signature-settings-changed', { detail: signatureForm }));
      }

      setIsSaved(true);
      toast.success('All Template, Invoice, GST & Print settings saved successfully!');
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save settings.');
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleResetDefault = () => {
    if (confirm('Reset all receipt customizations to standard defaults?')) {
      setTemplate(DEFAULT_RECEIPT_TEMPLATE);
      setInvoiceSettings(DEFAULT_INVOICE_SETTINGS);
      saveActiveReceiptTemplate(DEFAULT_RECEIPT_TEMPLATE, tenant?.id);
      saveStoredInvoiceSettings(DEFAULT_INVOICE_SETTINGS, tenant?.id);
      toast.info('Reset to standard default configurations');
    }
  };

  const handleTestThermalPrint = () => {
    saveActiveReceiptTemplate(template, tenant?.id);
    triggerThermalPrint(template.paperSize);
  };

  const handleTestBarcodePrint = () => {
    const tid = tenant?.id || 'default';
    localStorage.setItem(`bos_barcode_print_settings_v1_${tid}`, JSON.stringify(barcodeSettings));
    localStorage.setItem('bos_barcode_print_settings_v1', JSON.stringify(barcodeSettings));
    const sampleProduct = {
      product_name: 'Samsung A30',
      barcode: '1234567890',
      sku: 'SAM-A30-001',
      selling_price: 10000.0,
      mrp: 12000.0,
      hsn_code: '8517',
      batch_no: 'BATCH-A30-01',
      unit: 'Pcs',
    };
    printBarcodePopup(
      sampleProduct,
      1,
      barcodeSettings.labelSize,
      barcodeSettings.printerType,
      barcodeSettings.fields,
      barcodeSettings.customFields,
      businessDisplayName,
      currency.symbol
    );
  };

  const updateThermalField = (key: keyof ReceiptTemplate, val: any) => {
    setTemplate((prev) => ({ ...prev, [key]: val }));
  };

  const handleThemeSelect = (themeId: string) => {
    setSelectedTheme(themeId);
    if (themeId === 'compact') {
      setTemplate((prev) => ({
        ...prev,
        dividerStyle: 'solid',
        printClarity: 'ultra_dark',
        fontFamily: 'monospace',
      }));
    } else if (themeId === 'advanced') {
      setTemplate((prev) => ({
        ...prev,
        dividerStyle: 'dashed',
        printClarity: 'ultra_dark',
        fontFamily: 'clean',
        showTaxBreakdown: true,
        showQrCode: true,
        showGoogleReviewQR: true,
      }));
    } else if (themeId === 'simple') {
      setTemplate((prev) => ({
        ...prev,
        dividerStyle: 'dotted',
        printClarity: 'crisp_mono',
        fontFamily: 'sans-serif',
      }));
    } else if (themeId === 'classic') {
      setTemplate((prev) => ({
        ...prev,
        dividerStyle: 'double',
        printClarity: 'ultra_dark',
        fontFamily: 'monospace',
      }));
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      updateThermalField('logoUrl', dataUrl);
      updateThermalField('showLogo', true);
      toast.success('Logo uploaded successfully');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    updateThermalField('logoUrl', '');
    updateThermalField('showLogo', false);
    toast.info('Logo removed');
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSignatureForm((prev) => ({ ...prev, signature_url: reader.result as string }));
      toast.success('Digital signature uploaded!');
    };
    reader.readAsDataURL(file);
  };

  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSignatureForm((prev) => ({ ...prev, stamp_url: reader.result as string }));
      toast.success('Company stamp uploaded!');
    };
    reader.readAsDataURL(file);
  };

  const handleCustomQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPaymentQrForm((prev) => ({ ...prev, payment_qr_custom_image_url: reader.result as string }));
      toast.success('Custom QR image uploaded!');
    };
    reader.readAsDataURL(file);
  };

  // Barcode Helpers
  const getBarcodeField = (key: string) => {
    return barcodeSettings.fields.find((f: BarcodeFieldConfig) => f.key === key);
  };

  const updateBarcodeField = (key: string, updates: Partial<BarcodeFieldConfig>) => {
    setBarcodeSettings((prev: any) => ({
      ...prev,
      fields: prev.fields.map((f: BarcodeFieldConfig) => (f.key === key ? { ...f, ...updates } : f)),
    }));
  };

  const updateCustomField = (key: string, updates: Partial<BarcodeFieldConfig>) => {
    setBarcodeSettings((prev: any) => ({
      ...prev,
      customFields: prev.customFields.map((f: BarcodeFieldConfig) => (f.key === key ? { ...f, ...updates } : f)),
    }));
  };

  const addCustomField = () => {
    const fieldName = prompt('Enter custom field label (e.g. Rack No, Origin, Wash Care):');
    if (!fieldName) return;
    const newField: BarcodeFieldConfig = {
      key: `custom_${Date.now()}`,
      label: fieldName,
      enabled: true,
      fontSize: 22,
      isBold: false,
      isCustom: true,
    };
    setBarcodeSettings((prev: any) => ({
      ...prev,
      customFields: [...(prev.customFields || []), newField],
    }));
  };

  const deleteCustomField = (key: string) => {
    setBarcodeSettings((prev: any) => ({
      ...prev,
      customFields: prev.customFields.filter((f: BarcodeFieldConfig) => f.key !== key),
    }));
  };

  const handleLabelSizeChange = (val: string) => {
    let dim = { width: 50, height: 25, labelsPerRow: 2 };
    if (val === '38x25_1up') dim = { width: 38, height: 25, labelsPerRow: 1 };
    else if (val === '50x50_1up') dim = { width: 50, height: 50, labelsPerRow: 1 };
    else if (val === '100x50_1up') dim = { width: 100, height: 50, labelsPerRow: 1 };
    else if (val === 'a4_24') dim = { width: 70, height: 37, labelsPerRow: 3 };
    else if (val === 'a4_40') dim = { width: 52.5, height: 29.7, labelsPerRow: 4 };
    else if (val === 'a4_65') dim = { width: 38, height: 21.2, labelsPerRow: 5 };

    setBarcodeSettings((prev: any) => ({
      ...prev,
      labelSize: val,
      labelDimensions: dim,
    }));
  };

  const businessDisplayName =
    gstForm.trade_name ||
    gstForm.legal_name ||
    activeBillingGstLocal?.trade_name ||
    tenant?.name ||
    template.storeName ||
    'I Smart Bazaar';
  const businessAddress =
    gstForm.address ||
    activeBillingGstLocal?.address ||
    template.address ||
    'H.No 4-21, Main Road, Market Area, Hyderabad, Telangana - 500001';
  const businessPhone = gstForm.phone || activeBillingGstLocal?.phone || template.phone || '9876543210';
  const businessGstin = gstForm.gstin || activeBillingGstLocal?.gstin || template.gstin || '36AAAAA0000A1Z5';

  const dividerBorderClass =
    template.dividerStyle === 'solid'
      ? 'border-solid'
      : template.dividerStyle === 'dotted'
      ? 'border-dotted'
      : template.dividerStyle === 'double'
      ? 'border-double'
      : 'border-dashed';

  const fontFam =
    template.fontFamily === 'monospace'
      ? '"Consolas", "Courier New", Courier, monospace'
      : template.fontFamily === 'clean'
      ? '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  const resolvedReviewUrl =
    reviewForm.google_review_url ||
    (reviewForm.google_place_id ? `https://search.google.com/local/writereview?placeid=${reviewForm.google_place_id}` : '');

  const resolvedUpiUrl = paymentQrForm.upi_vpa
    ? buildUpiPayUrl({
        vpa: paymentQrForm.upi_vpa,
        payeeName: paymentQrForm.upi_payee_name || businessDisplayName,
        amount: 10620,
        invoiceNumber: 'INV-1001',
      })
    : '';

  // Sample bill to keep mounted for direct print
  const sampleThermalBill = {
    invoice_number: 'INV-1001',
    created_at: new Date().toISOString(),
    cashier_name: 'Admin',
    customer: {
      name: 'Sample Party',
      phone: '7400417400',
      address: 'No F2, Outer Circle, Connaught Circus, New Delhi - 110001',
      state: 'Delhi',
    },
    items: [
      {
        product_name: 'Samsung A30',
        sku: 'SAM-A30',
        quantity: 1,
        unit: 'Pcs',
        unit_price: 10000,
        mrp: 12000,
        discount_percent: 10,
        tax_rate: 18,
        batch_no: 'BATCH-A30-01',
        expiry_date: '15-11-2027',
      },
      {
        product_name: 'T-Shirt',
        sku: 'TSH-001',
        quantity: 2,
        unit: 'Pcs',
        unit_price: 1000,
        mrp: 1200,
        discount_percent: 10,
        tax_rate: 5,
      },
    ],
    subtotal: 12000,
    discount: 1200,
    tax: 1820,
    round_off: 0,
    total: 12620,
    amount_received: 12620,
    payment_status: 'PAID',
    payment_mode: 'Cash',
  };

  return (
    <div className="space-y-4 font-sans text-slate-800 pb-16">
      {/* Background Thermal Portal to ensure instant high-contrast print anywhere */}
      <ThermalReceiptPrinter bill={sampleThermalBill} customTemplate={template} />

      {/* Hidden file inputs */}
      <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
      <input type="file" ref={sigInputRef} className="hidden" accept="image/*" onChange={handleSignatureUpload} />
      <input type="file" ref={stampInputRef} className="hidden" accept="image/*" onChange={handleStampUpload} />
      <input type="file" ref={customQrInputRef} className="hidden" accept="image/*" onChange={handleCustomQrUpload} />

      {/* ── Top Header Bar ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-card p-4 rounded-2xl border border-slate-200 dark:border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-2xs">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-foreground">
              {t('Print & Invoice Templates', 'Print & Invoice Templates')}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t(
                'Configure thermal roll receipts, invoice numbering, tax slabs, payment UPI QR, signatures, and barcode labels',
                'Configure thermal roll receipts, invoice numbering, tax slabs, payment UPI QR, signatures, and barcode labels'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsWordStudioOpen(true)}
            className="px-3.5 h-9 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:opacity-95 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm shadow-indigo-500/20 cursor-pointer transition-all"
          >
            <Sparkles className="size-3.5 text-amber-300 animate-pulse" />
            <span>🎨 Word-Style Studio</span>
          </button>
          <button
            type="button"
            onClick={handleResetDefault}
            className="px-3 h-9 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
          </button>
          <button
            type="button"
            onClick={activeTab === 'barcode' ? handleTestBarcodePrint : handleTestThermalPrint}
            className="px-3.5 h-9 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-card border border-slate-300 dark:border-slate-700 hover:bg-slate-50 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-purple-600" />
            {activeTab === 'barcode' ? 'Test Barcode Print' : 'Test Thermal Print'}
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSavingAll}
            className="px-5 h-9 text-xs font-extrabold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            {isSavingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isSaved ? 'Saved!' : 'Save All Settings'}
          </button>
        </div>
      </div>

      {/* ── Navigation Tab Bar (8 Rich Settings Tabs) ── */}
      <div className="flex border-b border-slate-200 dark:border-border overflow-x-auto scrollbar-none gap-2 px-1 bg-white dark:bg-card rounded-xl p-1.5 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('thermal_receipt')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'thermal_receipt'
              ? 'bg-purple-600 text-white shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Thermal Receipt (PRO)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('invoice_details')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'invoice_details'
              ? 'bg-purple-600 text-white shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Invoice Details & Prefixes</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('item_columns')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'item_columns'
              ? 'bg-purple-600 text-white shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Item Table Columns</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tax_finance')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'tax_finance'
              ? 'bg-purple-600 text-white shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Tax & GST Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('google_reviews')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'google_reviews'
              ? 'bg-purple-600 text-white shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Star className="w-3.5 h-3.5 text-amber-500" />
          <span>Google Review QR</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('payment_qr')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'payment_qr'
              ? 'bg-purple-600 text-white shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <QrCode className="w-3.5 h-3.5 text-blue-500" />
          <span>Payment QR & Pay</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('signature_stamp')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'signature_stamp'
              ? 'bg-purple-600 text-white shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <PenTool className="w-3.5 h-3.5 text-emerald-500" />
          <span>Signature & Stamp</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('barcode')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'barcode'
              ? 'bg-purple-600 text-white shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ScanBarcode className="w-3.5 h-3.5" />
          <span>Barcode Labels</span>
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* TAB 1: THERMAL RECEIPT (LIVE 2-COLUMN ROLL DESIGNER)              */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {activeTab === 'thermal_receipt' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ── LEFT PANEL: Live Realistic Thermal Paper Roll Preview (7 cols) ── */}
          <div className="lg:col-span-7 flex flex-col items-center justify-start p-6 bg-slate-100 dark:bg-slate-900/60 rounded-2xl border border-border min-h-[640px]">
            <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-purple-600" /> Live Thermal Roll Preview
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">
                {template.paperSize === '58mm' ? '2 inch (58mm)' : '3 inch (80mm)'} Roll • {selectedTheme.toUpperCase()}
              </span>
            </div>

            {/* Realistic Thermal Receipt Paper Roll Card */}
            <div
              id="preview-thermal-paper"
              className={`bg-white text-black p-4 text-[11px] leading-snug rounded-sm shadow-xl border border-slate-300 select-none mx-auto w-full transition-all duration-200 ${
                template.paperSize === '58mm' ? 'max-w-[260px]' : 'max-w-[340px]'
              }`}
              style={{
                fontFamily: fontFam,
                fontWeight: 800,
                color: '#000000',
                boxShadow: '0 12px 28px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                textRendering: 'geometricPrecision',
              }}
            >
              {/* Receipt Header */}
              <div className={`text-center border-b-[1.5px] ${dividerBorderClass} border-black pb-2 mb-1.5`}>
                {template.showLogo !== false &&
                  (template.logoUrl ? (
                    <img
                      src={template.logoUrl}
                      alt="Logo"
                      className="mx-auto max-h-12 max-w-[140px] object-contain mb-1 filter grayscale contrast-200"
                    />
                  ) : (
                    <div className="mx-auto h-7 w-7 bg-black text-white font-black flex items-center justify-center text-xs rounded mb-1">
                      {businessDisplayName ? businessDisplayName.substring(0, 2).toUpperCase() : 'IS'}
                    </div>
                  ))}
                {template.showStoreName !== false && (
                  <h3 className="font-black text-[14px] uppercase tracking-wide text-black">{businessDisplayName}</h3>
                )}
                {template.showBranchName !== false && template.branchName && (
                  <p className="text-[10px] font-bold text-black mt-0.5">{template.branchName}</p>
                )}
                {template.showTagline !== false && template.headerTagline && (
                  <p className="text-[9.5px] font-semibold italic text-black mt-0.5">{template.headerTagline}</p>
                )}
                {template.showStoreAddress !== false && businessAddress && (
                  <p className="text-[10.5px] font-bold mt-0.5 whitespace-pre-line text-black leading-tight">
                    {businessAddress}
                  </p>
                )}
                {template.showStoreContact !== false && businessPhone && (
                  <p className="text-[10.5px] font-black text-black mt-0.5">Phone No : {businessPhone}</p>
                )}
                {template.showTaxId !== false && businessGstin && (
                  <p className="text-[11px] font-black mt-0.5 text-black">GST : {businessGstin}</p>
                )}
                {template.showCin !== false && template.cin && (
                  <p className="text-[9.5px] font-bold text-black">CIN : {template.cin}</p>
                )}

                {/* Dynamic Custom Header Fields in Roll Header */}
                {template.customFields && template.customFields.filter((f) => f.enabled && f.name).length > 0 && (
                  <div className="pt-1 text-[9.5px] font-bold text-black space-y-0.5">
                    {template.customFields
                      .filter((f) => f.enabled && f.name)
                      .map((f) => (
                        <div key={f.id} className="flex justify-center gap-1">
                          <span className="font-bold">{f.name}:</span>
                          <span>{f.value || '-'}</span>
                        </div>
                      ))}
                  </div>
                )}

                {template.showInvoiceTitle !== false && (
                  <div className="font-black text-center mt-1.5 text-[11.5px] uppercase tracking-wider text-black">
                    {template.invoiceTitle || 'TAX INVOICE'}
                  </div>
                )}
              </div>

              {/* Receipt Metadata & Party Details */}
              <div
                className={`text-[10.5px] font-bold border-b-[1.5px] ${dividerBorderClass} border-black py-1 space-y-0.5 text-black leading-tight`}
              >
                <div className="flex justify-between">
                  <span className="font-black">Invoice No : INV-1001</span>
                  <span>Date : 08-10-2026</span>
                </div>
                <div className="flex justify-between">
                  {template.showTime !== false && <span>Time : 04:36 PM</span>}
                  {template.showCashier !== false && <span>Cashier : Admin</span>}
                </div>

                {template.showCustomerDetails !== false && (
                  <div className="space-y-0.5 pt-0.5">
                    <div>
                      <span className="font-bold">Bill To :</span> <span className="font-black">Sample Party</span>
                    </div>
                    {template.showCustomerPhone !== false && <div>Ph : 7400417400</div>}
                    {template.showCustomerAddress !== false && (
                      <div className="whitespace-pre-line">No F2, Outer Circle, Connaught Circus, New Delhi - 110001</div>
                    )}
                    {template.showPlaceOfSupply !== false && <div>Place of Supply : Delhi (07)</div>}
                    {template.showPoNumber && <div>PO Ref : PO-90821</div>}
                    {template.showVehicleNumber && <div>Vehicle : TS-09-EA-1234</div>}
                    {template.showEwayBill && <div className="font-black">e-Way Bill : 241098234123</div>}
                    {template.showChallanNumber && <div>Challan No : CH-5432</div>}
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="my-1">
                <div
                  className={`flex justify-between text-[11px] font-black border-y-[1.5px] ${dividerBorderClass} border-black py-0.5`}
                >
                  <div className="flex items-center gap-1.5">
                    {template.showItemIndex !== false && <span className="w-4 text-left">#</span>}
                    <span className="text-left">Item</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {template.showItemQty !== false && <span className="w-10 text-center">Qty</span>}
                    {template.showItemRate !== false && <span className="w-12 text-right">Rate</span>}
                    {template.showItemTotal !== false && <span className="w-14 text-right">Amt</span>}
                  </div>
                </div>

                <div className={`divide-y ${dividerBorderClass} divide-black/40`}>
                  {[
                    {
                      name: 'Samsung Galaxy A30 (Black)',
                      desc: '4GB RAM / 64GB Storage',
                      sku: 'SAM-A30-BLK',
                      serial: 'SN-982348123',
                      warranty: '1 Year Brand',
                      mrp: 12000,
                      hsn: '8517',
                      disc: '10%',
                      tax: '18%',
                      batch: 'Batch #A30-01',
                      mfg: '15-11-2025',
                      exp: '15-11-2027',
                      qty: '1 Pcs',
                      rate: '10,000',
                      amt: '10,620',
                    },
                    {
                      name: 'Casual Cotton T-Shirt (M)',
                      desc: 'Navy Blue / Round Neck',
                      sku: 'TSH-NVY-M',
                      serial: '',
                      warranty: '',
                      mrp: 1200,
                      hsn: '6109',
                      disc: '10%',
                      tax: '5%',
                      batch: '',
                      mfg: '',
                      exp: '',
                      qty: '2 Pcs',
                      rate: '1,000',
                      amt: '2,000',
                    },
                  ].map((item, idx) => {
                    const chips: string[] = [];
                    if (template.showMrp && item.mrp) chips.push(`MRP:${item.mrp}`);
                    if (template.showItemHsn && item.hsn) chips.push(`HSN:${item.hsn}`);
                    if (template.showDiscount && item.disc) chips.push(`Disc:${item.disc}`);
                    if (template.showTaxRate && item.tax) chips.push(`Tax:${item.tax}`);
                    if (template.showBatchNo && item.batch) chips.push(item.batch);
                    if (template.showExpDate && item.exp) chips.push(`Exp:${item.exp}`);
                    if (template.showItemSku && item.sku) chips.push(`SKU:${item.sku}`);
                    if (template.showItemSerial && item.serial) chips.push(`SN:${item.serial}`);
                    if (template.showItemWarranty && item.warranty) chips.push(`War:${item.warranty}`);

                    // Custom columns values in sample preview
                    if (template.customItemColumns) {
                      template.customItemColumns
                        .filter((c) => c.enabled && c.name)
                        .forEach((c) => {
                          chips.push(`${c.name}: Standard`);
                        });
                    }

                    return (
                      <div key={idx} className="py-1 text-black">
                        <div className="flex justify-between items-start">
                          <div className="flex items-start gap-1.5 flex-1 pr-1">
                            {template.showItemIndex !== false && (
                              <span className="w-4 text-left font-bold">{idx + 1}.</span>
                            )}
                            <div className="flex-1">
                              <div className="font-black text-[11px] leading-tight text-black">{item.name}</div>
                              {template.showItemDescription && item.desc && (
                                <div className="text-[9.5px] italic text-black">{item.desc}</div>
                              )}
                              {chips.length > 0 && (
                                <div className="text-[9px] font-bold text-black flex flex-wrap gap-x-1.5 gap-y-0.5 mt-0.5">
                                  {chips.map((c, ci) => (
                                    <span key={ci} className="bg-black/5 px-0.5 rounded-xs">
                                      {c}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 font-black text-[11px]">
                            {template.showItemQty !== false && (
                              <span className="w-10 text-center">{item.qty}</span>
                            )}
                            {template.showItemRate !== false && (
                              <span className="w-12 text-right">{item.rate}</span>
                            )}
                            {template.showItemTotal !== false && (
                              <span className="w-14 text-right">{item.amt}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Totals & Tax Breakdown */}
              <div
                className={`border-t-[1.5px] ${dividerBorderClass} border-black pt-1 space-y-0.5 text-[11px] font-black text-black`}
              >
                {template.showTotalQty !== false && (
                  <div className="flex justify-between text-[10px]">
                    <span>Total Quantity :</span>
                    <span>3 Pcs</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Sub Total :</span>
                  <span>₹ 12,000.00</span>
                </div>
                {template.showDiscount !== false && (
                  <div className="flex justify-between text-black">
                    <span>Total Discount :</span>
                    <span>- ₹ 1,200.00</span>
                  </div>
                )}
                {template.showTaxBreakdown && (
                  <div className="border-t border-dotted border-black/60 py-0.5 my-0.5 text-[9.5px]">
                    <div className="flex justify-between">
                      <span>CGST (9%) :</span>
                      <span>₹ 910.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SGST (9%) :</span>
                      <span>₹ 910.00</span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between text-[14px] font-black border-t-[1.5px] border-black pt-1 mt-1">
                  <span>TOTAL AMOUNT :</span>
                  <span>₹ 12,620.00</span>
                </div>
                <div className="flex justify-between text-[11px] font-black text-black pt-0.5">
                  <span>Total Billed Qty :</span>
                  <span>3 Units</span>
                </div>
                <div className="text-center font-black text-[11px] uppercase tracking-wide py-0.5 text-black">
                  ★ [✓ PAID IN FULL] (Cash) ★
                </div>
                {template.showTotalSavings && (
                  <div className="text-center text-[10px] font-black uppercase tracking-wide bg-black text-white py-0.5 my-1">
                    *** YOU SAVED ₹ 2,380.00 ***
                  </div>
                )}
              </div>

              {/* Payment QR Code */}
              {template.showQrCode && resolvedUpiUrl && (
                <div className="text-center my-2 border-t border-dotted border-black pt-1.5">
                  <p className="text-[10px] font-black uppercase tracking-wider mb-1">SCAN TO PAY VIA UPI</p>
                  <img
                    src={generateQRCodeSVG(resolvedUpiUrl, 100)}
                    alt="UPI QR Code"
                    className="mx-auto block p-1 bg-white border border-black h-24 w-24 object-contain"
                  />
                  <p className="text-[9px] font-bold mt-0.5">{paymentQrForm.upi_vpa || 'merchant@upi'}</p>
                </div>
              )}

              {/* Google Review QR */}
              {template.showGoogleReviewQR && resolvedReviewUrl && (
                <div className="text-center my-2 border-t border-dotted border-black pt-1.5">
                  <div className="text-[10px] font-black flex items-center justify-center gap-1">
                    <span>⭐⭐⭐⭐⭐ RATE US ON GOOGLE</span>
                  </div>
                  <img
                    src={generateQRCodeSVG(resolvedReviewUrl, 90)}
                    alt="Google Review QR Code"
                    className="mx-auto block p-1 bg-white border border-black mt-1 h-20 w-20 object-contain"
                  />
                </div>
              )}

              {/* Digital Signature & Stamp in Thermal Preview */}
              {(signatureForm.show_digital_signature || signatureForm.show_digital_stamp) && (
                <div className="my-2 pt-2 border-t border-dotted border-black flex justify-between items-end px-1">
                  {signatureForm.show_digital_stamp && signatureForm.stamp_url ? (
                    <img
                      src={signatureForm.stamp_url}
                      alt="Stamp"
                      className="h-9 w-9 object-contain filter grayscale contrast-200"
                    />
                  ) : (
                    <div />
                  )}
                  {signatureForm.show_digital_signature && (
                    <div className="text-right">
                      {signatureForm.signature_url ? (
                        <img
                          src={signatureForm.signature_url}
                          alt="Signature"
                          className="h-6 object-contain ml-auto filter grayscale contrast-200"
                        />
                      ) : (
                        <div className="h-5 text-[8px] italic font-bold text-slate-600 ml-auto flex items-end justify-end">
                          [Sign]
                        </div>
                      )}
                      <p className="text-[8.5px] font-black uppercase tracking-wider pt-0.5">
                        {signatureForm.signature_title || 'Authorized Signatory'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Terms & Footer */}
              <div className={`border-t-[1.5px] ${dividerBorderClass} border-black pt-1 text-center text-[9.5px] font-bold text-black space-y-0.5`}>
                {template.showTermsAndConditions !== false && (
                  <p className="whitespace-pre-line text-left text-[9px] leading-tight">
                    {gstForm.terms_and_conditions || template.termsAndConditionsText}
                  </p>
                )}
                <p className="font-black text-[11px] uppercase tracking-wider pt-1">
                  {template.footerNote || '*** THANK YOU FOR SHOPPING ***'}
                </p>
              </div>
            </div>
          </div>

          {/* ── RIGHT PANEL: Theme Selector & Detailed Thermal Options (5 cols) ── */}
          <div className="lg:col-span-5 space-y-4">
            {/* Theme Picker */}
            <div className="bg-card p-4 rounded-2xl border border-border shadow-xs">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-purple-600" /> Select Thermal Theme
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {THERMAL_THEMES.map((th) => (
                  <div
                    key={th.id}
                    onClick={() => handleThemeSelect(th.id)}
                    className={`p-3 rounded-xl border-2 transition-all cursor-pointer ${
                      selectedTheme === th.id
                        ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/20 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">{th.name}</span>
                      {selectedTheme === th.id && <Check className="w-3.5 h-3.5 text-purple-600" />}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{th.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Paper Size & Font Options */}
            <div className="bg-card p-4 rounded-2xl border border-border shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5 text-purple-600" /> Roll Paper Width & Clarity
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateThermalField('paperSize', '80mm')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                    template.paperSize !== '58mm'
                      ? 'border-purple-600 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600'
                  }`}
                >
                  3 inch (80mm) Roll
                </button>
                <button
                  type="button"
                  onClick={() => updateThermalField('paperSize', '58mm')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                    template.paperSize === '58mm'
                      ? 'border-purple-600 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600'
                  }`}
                >
                  2 inch (58mm) Roll
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Print Contrast</label>
                  <select
                    value={template.printClarity || 'ultra_dark'}
                    onChange={(e) => updateThermalField('printClarity', e.target.value)}
                    className="w-full mt-1 text-xs font-bold border border-slate-200 dark:border-slate-800 bg-background rounded-lg p-2"
                  >
                    <option value="ultra_dark">Ultra Dark (203/300 DPI)</option>
                    <option value="crisp_mono">Crisp High-Contrast</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Divider Style</label>
                  <select
                    value={template.dividerStyle || 'solid'}
                    onChange={(e) => updateThermalField('dividerStyle', e.target.value)}
                    className="w-full mt-1 text-xs font-bold border border-slate-200 dark:border-slate-800 bg-background rounded-lg p-2"
                  >
                    <option value="solid">Solid Line (────)</option>
                    <option value="dashed">Dashed Line (----)</option>
                    <option value="dotted">Dotted Line (....)</option>
                    <option value="double">Double Line (════)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Logo Settings Card */}
            <div className="bg-card p-4 rounded-2xl border border-border shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-purple-600" /> Store Logo
                </span>
                <input
                  type="checkbox"
                  checked={template.showLogo !== false}
                  onChange={(e) => updateThermalField('showLogo', e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4"
                />
              </div>
              {template.showLogo !== false && (
                <div className="mt-3 flex items-center gap-3">
                  {template.logoUrl ? (
                    <img src={template.logoUrl} alt="Logo" className="w-12 h-12 object-contain border rounded-lg p-1 bg-white" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-bold">
                      No Logo
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="px-3 py-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <Upload className="w-3 h-3" /> Upload Logo
                    </button>
                    {template.logoUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="px-2 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Accordion Controls for Header, Custom Fields, Party, Items, Custom Columns, Footer */}
            <div className="space-y-2">
              {/* Accordion 1: Header Details */}
              <div className="border border-border rounded-xl bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('invoiceDetails')}
                  className="w-full px-4 py-3 text-left font-bold text-xs flex justify-between items-center cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-purple-600" /> Store & Header Fields
                  </span>
                  {expandedSections.invoiceDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedSections.invoiceDetails && (
                  <div className="p-4 pt-0 space-y-2 text-xs border-t border-border/50">
                    <label className="flex items-center justify-between py-1">
                      <span>Store Display Name</span>
                      <input
                        type="checkbox"
                        checked={template.showStoreName !== false}
                        onChange={(e) => updateThermalField('showStoreName', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                    <label className="flex items-center justify-between py-1">
                      <span>Branch Name</span>
                      <input
                        type="checkbox"
                        checked={template.showBranchName !== false}
                        onChange={(e) => updateThermalField('showBranchName', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                    <label className="flex items-center justify-between py-1">
                      <span>Address & Location</span>
                      <input
                        type="checkbox"
                        checked={template.showStoreAddress !== false}
                        onChange={(e) => updateThermalField('showStoreAddress', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                    <label className="flex items-center justify-between py-1">
                      <span>Phone & Contact</span>
                      <input
                        type="checkbox"
                        checked={template.showStoreContact !== false}
                        onChange={(e) => updateThermalField('showStoreContact', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                    <label className="flex items-center justify-between py-1">
                      <span>GSTIN / Tax ID</span>
                      <input
                        type="checkbox"
                        checked={template.showTaxId !== false}
                        onChange={(e) => updateThermalField('showTaxId', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                    <label className="flex items-center justify-between py-1">
                      <span>CIN Number</span>
                      <input
                        type="checkbox"
                        checked={template.showCin !== false}
                        onChange={(e) => updateThermalField('showCin', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                    <label className="flex items-center justify-between py-1">
                      <span>Header Tagline</span>
                      <input
                        type="checkbox"
                        checked={template.showTagline !== false}
                        onChange={(e) => updateThermalField('showTagline', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                    <label className="flex items-center justify-between py-1">
                      <span>Invoice Title</span>
                      <input
                        type="checkbox"
                        checked={template.showInvoiceTitle !== false}
                        onChange={(e) => updateThermalField('showInvoiceTitle', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Accordion 2: Dynamic Custom Header Fields (PRO) */}
              <div className="border border-border rounded-xl bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('customFields')}
                  className="w-full px-4 py-3 text-left font-bold text-xs flex justify-between items-center cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Dynamic Header Custom Fields
                  </span>
                  {expandedSections.customFields ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedSections.customFields && (
                  <div className="p-4 pt-0 space-y-3 text-xs border-t border-border/50">
                    <p className="text-[11px] text-muted-foreground">
                      Add arbitrary key-value custom fields to the thermal receipt header (e.g. DL No, FSSAI No, Counter No).
                    </p>
                    <div className="space-y-2">
                      {(template.customFields || []).map((f) => (
                        <div key={f.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border">
                          <input
                            type="checkbox"
                            checked={f.enabled}
                            onChange={(e) => handleUpdateThermalCustomField(f.id, { enabled: e.target.checked })}
                            className="rounded text-purple-600"
                          />
                          <input
                            type="text"
                            placeholder="Field Name (e.g. DL No)"
                            value={f.name}
                            onChange={(e) => handleUpdateThermalCustomField(f.id, { name: e.target.value })}
                            className="flex-1 text-xs p-1.5 bg-background border rounded"
                          />
                          <input
                            type="text"
                            placeholder="Default Value"
                            value={f.value || ''}
                            onChange={(e) => handleUpdateThermalCustomField(f.id, { value: e.target.value })}
                            className="flex-1 text-xs p-1.5 bg-background border rounded"
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteThermalCustomField(f.id)}
                            className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handleAddThermalCustomField}
                      className="w-full py-1.5 px-3 border border-dashed border-purple-400 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Header Custom Field
                    </button>
                  </div>
                )}
              </div>

              {/* Accordion 3: Party & Metadata */}
              <div className="border border-border rounded-xl bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('partyDetails')}
                  className="w-full px-4 py-3 text-left font-bold text-xs flex justify-between items-center cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-purple-600" /> Customer & Metadata Fields
                  </span>
                  {expandedSections.partyDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedSections.partyDetails && (
                  <div className="p-4 pt-0 space-y-2 text-xs border-t border-border/50">
                    <label className="flex items-center justify-between py-1">
                      <span>Customer Details (Name & Phone)</span>
                      <input
                        type="checkbox"
                        checked={template.showCustomerDetails !== false}
                        onChange={(e) => updateThermalField('showCustomerDetails', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                    <label className="flex items-center justify-between py-1">
                      <span>Customer Address</span>
                      <input
                        type="checkbox"
                        checked={template.showCustomerAddress !== false}
                        onChange={(e) => updateThermalField('showCustomerAddress', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                    <label className="flex items-center justify-between py-1">
                      <span>Place of Supply</span>
                      <input
                        type="checkbox"
                        checked={template.showPlaceOfSupply !== false}
                        onChange={(e) => updateThermalField('showPlaceOfSupply', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                    <label className="flex items-center justify-between py-1">
                      <span>Cashier Name</span>
                      <input
                        type="checkbox"
                        checked={template.showCashier !== false}
                        onChange={(e) => updateThermalField('showCashier', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                    <label className="flex items-center justify-between py-1">
                      <span>Date & Time</span>
                      <input
                        type="checkbox"
                        checked={template.showTime !== false}
                        onChange={(e) => updateThermalField('showTime', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                    <label className="flex items-center justify-between py-1">
                      <span>PO Number / Ref</span>
                      <input
                        type="checkbox"
                        checked={template.showPoNumber || false}
                        onChange={(e) => updateThermalField('showPoNumber', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                    <label className="flex items-center justify-between py-1">
                      <span>Vehicle Number</span>
                      <input
                        type="checkbox"
                        checked={template.showVehicleNumber || false}
                        onChange={(e) => updateThermalField('showVehicleNumber', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                    <label className="flex items-center justify-between py-1">
                      <span>e-Way Bill Number</span>
                      <input
                        type="checkbox"
                        checked={template.showEwayBill || false}
                        onChange={(e) => updateThermalField('showEwayBill', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                    <label className="flex items-center justify-between py-1">
                      <span>Challan Number</span>
                      <input
                        type="checkbox"
                        checked={template.showChallanNumber || false}
                        onChange={(e) => updateThermalField('showChallanNumber', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Accordion 4: Item Table Thermal Columns */}
              <div className="border border-border rounded-xl bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('itemTable')}
                  className="w-full px-4 py-3 text-left font-bold text-xs flex justify-between items-center cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-purple-600" /> Item Table Thermal Columns
                  </span>
                  {expandedSections.itemTable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedSections.itemTable && (
                  <div className="p-4 pt-0 space-y-2 text-xs border-t border-border/50">
                    <label className="flex items-center justify-between py-1">
                      <span>Item S.No / Index (#)</span>
                      <input
                        type="checkbox"
                        checked={template.showItemIndex !== false}
                        onChange={(e) => updateThermalField('showItemIndex', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                    <label className="flex items-center justify-between py-1">
                      <span>Item Description</span>
                      <input
                        type="checkbox"
                        checked={template.showItemDescription || false}
                        onChange={(e) => updateThermalField('showItemDescription', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                    <label className="flex items-center justify-between py-1">
                      <span>Item MRP</span>
                      <input
                        type="checkbox"
                        checked={template.showMrp !== false}
                        onChange={(e) => updateThermalField('showMrp', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                    <label className="flex items-center justify-between py-1">
                      <span>HSN / SAC Code</span>
                      <input
                        type="checkbox"
                        checked={template.showItemHsn !== false}
                        onChange={(e) => updateThermalField('showItemHsn', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                    <label className="flex items-center justify-between py-1">
                      <span>Item SKU / Code</span>
                      <input
                        type="checkbox"
                        checked={template.showItemSku || false}
                        onChange={(e) => updateThermalField('showItemSku', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                    <label className="flex items-center justify-between py-1">
                      <span>Serial No / IMEI</span>
                      <input
                        type="checkbox"
                        checked={template.showItemSerial || false}
                        onChange={(e) => updateThermalField('showItemSerial', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                    <label className="flex items-center justify-between py-1">
                      <span>Warranty Details</span>
                      <input
                        type="checkbox"
                        checked={template.showItemWarranty || false}
                        onChange={(e) => updateThermalField('showItemWarranty', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                    <label className="flex items-center justify-between py-1">
                      <span>Discount % / Amount</span>
                      <input
                        type="checkbox"
                        checked={template.showDiscount !== false}
                        onChange={(e) => updateThermalField('showDiscount', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                    <label className="flex items-center justify-between py-1">
                      <span>Tax Rate %</span>
                      <input
                        type="checkbox"
                        checked={template.showTaxRate || false}
                        onChange={(e) => updateThermalField('showTaxRate', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                    <label className="flex items-center justify-between py-1">
                      <span>Batch No & Expiry</span>
                      <input
                        type="checkbox"
                        checked={template.showBatchNo !== false}
                        onChange={(e) => updateThermalField('showBatchNo', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                    <label className="flex items-center justify-between py-1">
                      <span>Tax Breakdown</span>
                      <input
                        type="checkbox"
                        checked={template.showTaxBreakdown !== false}
                        onChange={(e) => updateThermalField('showTaxBreakdown', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Accordion 5: Dynamic Custom Item Columns */}
              <div className="border border-border rounded-xl bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('customColumns')}
                  className="w-full px-4 py-3 text-left font-bold text-xs flex justify-between items-center cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-purple-600" /> Custom Item Columns
                  </span>
                  {expandedSections.customColumns ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedSections.customColumns && (
                  <div className="p-4 pt-0 space-y-3 text-xs border-t border-border/50">
                    <p className="text-[11px] text-muted-foreground">
                      Add business-specific item columns (e.g. Size, Color, Grade, Rack) that render neatly as item chips.
                    </p>
                    <div className="space-y-2">
                      {(template.customItemColumns || []).map((col) => (
                        <div key={col.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border">
                          <input
                            type="checkbox"
                            checked={col.enabled}
                            onChange={(e) => handleUpdateThermalCustomColumn(col.id, { enabled: e.target.checked })}
                            className="rounded text-purple-600"
                          />
                          <input
                            type="text"
                            placeholder="Column Name (e.g. Size, Color)"
                            value={col.name}
                            onChange={(e) => handleUpdateThermalCustomColumn(col.id, { name: e.target.value })}
                            className="flex-1 text-xs p-1.5 bg-background border rounded"
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteThermalCustomColumn(col.id)}
                            className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handleAddThermalCustomColumn}
                      className="w-full py-1.5 px-3 border border-dashed border-purple-400 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Custom Item Column
                    </button>
                  </div>
                )}
              </div>

              {/* Accordion 6: QR Codes, Signatures & Footer Extras */}
              <div className="border border-border rounded-xl bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('miscDetails')}
                  className="w-full px-4 py-3 text-left font-bold text-xs flex justify-between items-center cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-purple-600" /> QR Codes, Signatures & Footer
                  </span>
                  {expandedSections.miscDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedSections.miscDetails && (
                  <div className="p-4 pt-0 space-y-3 text-xs border-t border-border/50">
                    <label className="flex items-center justify-between py-1">
                      <span>Print UPI Payment QR</span>
                      <input
                        type="checkbox"
                        checked={template.showQrCode !== false}
                        onChange={(e) => updateThermalField('showQrCode', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                    <label className="flex items-center justify-between py-1">
                      <span>Print Google Review 5-Star QR</span>
                      <input
                        type="checkbox"
                        checked={template.showGoogleReviewQR !== false}
                        onChange={(e) => updateThermalField('showGoogleReviewQR', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                    <label className="flex items-center justify-between py-1">
                      <span>Total Savings Banner</span>
                      <input
                        type="checkbox"
                        checked={template.showTotalSavings !== false}
                        onChange={(e) => updateThermalField('showTotalSavings', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>
                    <label className="flex items-center justify-between py-1">
                      <span>Print Terms & Conditions</span>
                      <input
                        type="checkbox"
                        checked={template.showTermsAndConditions !== false}
                        onChange={(e) => updateThermalField('showTermsAndConditions', e.target.checked)}
                        className="rounded text-purple-600"
                      />
                    </label>

                    {template.showTermsAndConditions !== false && (
                      <div className="pt-1">
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Terms & Conditions Note (Synced with CoreERP Org Setup):
                        </label>
                        <textarea
                          rows={2}
                          value={gstForm.terms_and_conditions || template.termsAndConditionsText || ''}
                          onChange={(e) => {
                            setGstForm((prev) => ({ ...prev, terms_and_conditions: e.target.value }));
                            updateThermalField('termsAndConditionsText', e.target.value);
                          }}
                          className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-background"
                        />
                      </div>
                    )}

                    <div className="pt-1">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Footer Greeting Note:
                      </label>
                      <input
                        type="text"
                        value={template.footerNote || ''}
                        onChange={(e) => updateThermalField('footerNote', e.target.value)}
                        placeholder="*** THANK YOU FOR SHOPPING ***"
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-background"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* TAB 2: INVOICE DETAILS & PREFIXES                                 */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {activeTab === 'invoice_details' && (
        <div className="bg-white dark:bg-card p-6 rounded-2xl border border-border shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b pb-4 border-slate-100 dark:border-border">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-foreground">Invoice & Document Numbering</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Set custom series prefixes, starting sequence numbers, and zero padding for all sales documents
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Custom Sequence</span>
              <input
                type="checkbox"
                checked={invoiceSettings.customSequenceEnabled}
                onChange={(e) => setInvoiceSettings((prev) => ({ ...prev, customSequenceEnabled: e.target.checked }))}
                className="h-4 w-4 rounded text-purple-600 focus:ring-purple-500"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                  Tax Invoice Series
                </span>
                <span className="text-[10px] font-mono bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200 px-1.5 py-0.5 rounded">
                  {invoiceSettings.prefix || 'INV-'}
                  {String(invoiceSettings.sequenceNumber || 1).padStart(invoiceSettings.padding || 4, '0')}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-600">Prefix</label>
                  <input
                    type="text"
                    value={invoiceSettings.prefix}
                    onChange={(e) => setInvoiceSettings((prev) => ({ ...prev, prefix: e.target.value }))}
                    placeholder="INV-"
                    className="w-full mt-1 text-xs font-bold p-2 border rounded-lg bg-background"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600">Next Seq</label>
                  <input
                    type="number"
                    value={invoiceSettings.sequenceNumber}
                    onChange={(e) =>
                      setInvoiceSettings((prev) => ({ ...prev, sequenceNumber: Number(e.target.value) || 1 }))
                    }
                    className="w-full mt-1 text-xs font-bold p-2 border rounded-lg bg-background"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                  Quotation Series
                </span>
                <span className="text-[10px] font-mono bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200 px-1.5 py-0.5 rounded">
                  {invoiceSettings.quotationPrefix || 'QT-'}
                  {String(invoiceSettings.quotationSequenceNumber || 1).padStart(
                    invoiceSettings.quotationPadding || 4,
                    '0'
                  )}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-600">Prefix</label>
                  <input
                    type="text"
                    value={invoiceSettings.quotationPrefix || 'QT-'}
                    onChange={(e) => setInvoiceSettings((prev) => ({ ...prev, quotationPrefix: e.target.value }))}
                    placeholder="QT-"
                    className="w-full mt-1 text-xs font-bold p-2 border rounded-lg bg-background"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600">Next Seq</label>
                  <input
                    type="number"
                    value={invoiceSettings.quotationSequenceNumber || 1}
                    onChange={(e) =>
                      setInvoiceSettings((prev) => ({ ...prev, quotationSequenceNumber: Number(e.target.value) || 1 }))
                    }
                    className="w-full mt-1 text-xs font-bold p-2 border rounded-lg bg-background"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                  POS Counter Receipt
                </span>
                <span className="text-[10px] font-mono bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 px-1.5 py-0.5 rounded">
                  {invoiceSettings.receiptPrefix || 'REC-'}
                  {String(invoiceSettings.receiptSequenceNumber || 1).padStart(invoiceSettings.receiptPadding || 5, '0')}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-600">Prefix</label>
                  <input
                    type="text"
                    value={invoiceSettings.receiptPrefix || 'REC-'}
                    onChange={(e) => setInvoiceSettings((prev) => ({ ...prev, receiptPrefix: e.target.value }))}
                    placeholder="REC-"
                    className="w-full mt-1 text-xs font-bold p-2 border rounded-lg bg-background"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600">Next Seq</label>
                  <input
                    type="number"
                    value={invoiceSettings.receiptSequenceNumber || 1}
                    onChange={(e) =>
                      setInvoiceSettings((prev) => ({ ...prev, receiptSequenceNumber: Number(e.target.value) || 1 }))
                    }
                    className="w-full mt-1 text-xs font-bold p-2 border rounded-lg bg-background"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-4 border-slate-100 dark:border-border">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3">
              Additional Sales Document Prefixes
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600">Proforma Prefix</label>
                <input
                  type="text"
                  value={invoiceSettings.proformaPrefix || 'PI-'}
                  onChange={(e) => setInvoiceSettings((prev) => ({ ...prev, proformaPrefix: e.target.value }))}
                  className="w-full mt-1 text-xs font-bold p-2 border rounded-lg bg-background"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600">Estimate Prefix</label>
                <input
                  type="text"
                  value={invoiceSettings.estimatePrefix || 'EST-'}
                  onChange={(e) => setInvoiceSettings((prev) => ({ ...prev, estimatePrefix: e.target.value }))}
                  className="w-full mt-1 text-xs font-bold p-2 border rounded-lg bg-background"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600">Credit Note Prefix</label>
                <input
                  type="text"
                  value={invoiceSettings.creditNotePrefix || 'CN-'}
                  onChange={(e) => setInvoiceSettings((prev) => ({ ...prev, creditNotePrefix: e.target.value }))}
                  className="w-full mt-1 text-xs font-bold p-2 border rounded-lg bg-background"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600">Debit Note Prefix</label>
                <input
                  type="text"
                  value={invoiceSettings.debitNotePrefix || 'DN-'}
                  onChange={(e) => setInvoiceSettings((prev) => ({ ...prev, debitNotePrefix: e.target.value }))}
                  className="w-full mt-1 text-xs font-bold p-2 border rounded-lg bg-background"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* TAB 3: ITEM TABLE COLUMNS                                         */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {activeTab === 'item_columns' && (
        <div className="bg-white dark:bg-card p-6 rounded-2xl border border-border shadow-xs space-y-6">
          <div className="border-b pb-4 border-slate-100 dark:border-border">
            <h2 className="text-base font-bold text-slate-900 dark:text-foreground">Item Table & Inventory Columns</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Control visible columns, pricing fields, batch tracking, and custom specifications during invoice entry
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-border">
              <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Pricing & Tax Columns
              </span>
              <label className="flex items-center justify-between p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800/60 cursor-pointer">
                <span className="text-xs font-bold">Show MRP (Maximum Retail Price)</span>
                <input
                  type="checkbox"
                  checked={invoiceSettings.showMrp}
                  onChange={(e) => setInvoiceSettings((prev) => ({ ...prev, showMrp: e.target.checked }))}
                  className="h-4 w-4 rounded text-purple-600"
                />
              </label>
              <label className="flex items-center justify-between p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800/60 cursor-pointer">
                <span className="text-xs font-bold">Show Item Discount (% and Value)</span>
                <input
                  type="checkbox"
                  checked={invoiceSettings.showDiscount}
                  onChange={(e) => setInvoiceSettings((prev) => ({ ...prev, showDiscount: e.target.checked }))}
                  className="h-4 w-4 rounded text-purple-600"
                />
              </label>
              <label className="flex items-center justify-between p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800/60 cursor-pointer">
                <span className="text-xs font-bold">Show HSN / SAC Code</span>
                <input
                  type="checkbox"
                  checked={invoiceSettings.showHsn}
                  onChange={(e) => setInvoiceSettings((prev) => ({ ...prev, showHsn: e.target.checked }))}
                  className="h-4 w-4 rounded text-purple-600"
                />
              </label>
              <label className="flex items-center justify-between p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800/60 cursor-pointer">
                <span className="text-xs font-bold">Show Purchase Price (Internal Margin)</span>
                <input
                  type="checkbox"
                  checked={invoiceSettings.showPurchasePrice}
                  onChange={(e) => setInvoiceSettings((prev) => ({ ...prev, showPurchasePrice: e.target.checked }))}
                  className="h-4 w-4 rounded text-purple-600"
                />
              </label>
            </div>

            <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-border">
              <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Batch, Expiry & Serial Tracking
              </span>
              <label className="flex items-center justify-between p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800/60 cursor-pointer">
                <span className="text-xs font-bold">Show Batch Number</span>
                <input
                  type="checkbox"
                  checked={invoiceSettings.showBatchNo}
                  onChange={(e) => setInvoiceSettings((prev) => ({ ...prev, showBatchNo: e.target.checked }))}
                  className="h-4 w-4 rounded text-purple-600"
                />
              </label>
              <label className="flex items-center justify-between p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800/60 cursor-pointer">
                <span className="text-xs font-bold">Show Expiry Date</span>
                <input
                  type="checkbox"
                  checked={invoiceSettings.showExpDate}
                  onChange={(e) => setInvoiceSettings((prev) => ({ ...prev, showExpDate: e.target.checked }))}
                  className="h-4 w-4 rounded text-purple-600"
                />
              </label>
              <label className="flex items-center justify-between p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800/60 cursor-pointer">
                <span className="text-xs font-bold">Show Manufacturing Date</span>
                <input
                  type="checkbox"
                  checked={invoiceSettings.showMfgDate}
                  onChange={(e) => setInvoiceSettings((prev) => ({ ...prev, showMfgDate: e.target.checked }))}
                  className="h-4 w-4 rounded text-purple-600"
                />
              </label>
              <label className="flex items-center justify-between p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800/60 cursor-pointer">
                <span className="text-xs font-bold">Show Serial No / IMEI</span>
                <input
                  type="checkbox"
                  checked={invoiceSettings.showSerialNo}
                  onChange={(e) => setInvoiceSettings((prev) => ({ ...prev, showSerialNo: e.target.checked }))}
                  className="h-4 w-4 rounded text-purple-600"
                />
              </label>
              <label className="flex items-center justify-between p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800/60 cursor-pointer">
                <span className="text-xs font-bold">Show Warranty Period</span>
                <input
                  type="checkbox"
                  checked={invoiceSettings.showWarranty}
                  onChange={(e) => setInvoiceSettings((prev) => ({ ...prev, showWarranty: e.target.checked }))}
                  className="h-4 w-4 rounded text-purple-600"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* TAB 4: TAX & GST PROFILE                                          */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {activeTab === 'tax_finance' && (
        <div className="bg-white dark:bg-card p-6 rounded-2xl border border-border shadow-xs space-y-6">
          <div className="border-b pb-4 border-slate-100 dark:border-border">
            <h2 className="text-base font-bold text-slate-900 dark:text-foreground">Organization GST Profile & Banking</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Legal billing identity, GSTIN verification, state jurisdiction, bank payout accounts, and GST tax codes
            </p>
          </div>

          {/* GSTIN Lookup Bar */}
          <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/20 rounded-xl border border-indigo-200/80 dark:border-indigo-900 flex flex-col sm:flex-row items-center gap-3">
            <div className="flex-1 w-full">
              <label className="text-xs font-bold text-indigo-950 dark:text-indigo-300">GSTIN Number (15 Digits)</label>
              <input
                type="text"
                value={gstForm.gstin}
                onChange={(e) => setGstForm((prev) => ({ ...prev, gstin: e.target.value.toUpperCase() }))}
                placeholder="36AAAAA0000A1Z5"
                className="w-full mt-1 text-sm font-mono font-bold p-2.5 border rounded-lg bg-white dark:bg-background"
                maxLength={15}
              />
            </div>
            <button
              type="button"
              onClick={handleLookupGstin}
              disabled={isLookingUpGst}
              className="w-full sm:w-auto mt-auto px-4 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              {isLookingUpGst ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>Auto-Lookup GSTIN</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Business Trade Name</label>
              <input
                type="text"
                value={gstForm.trade_name}
                onChange={(e) => setGstForm((prev) => ({ ...prev, trade_name: e.target.value }))}
                placeholder="I Smart Bazaar"
                className="w-full mt-1 text-xs font-bold p-2.5 border rounded-lg bg-background"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Legal Name (As per GST)</label>
              <input
                type="text"
                value={gstForm.legal_name}
                onChange={(e) => setGstForm((prev) => ({ ...prev, legal_name: e.target.value }))}
                placeholder="Smart Bazaar Enterprises Pvt Ltd"
                className="w-full mt-1 text-xs font-bold p-2.5 border rounded-lg bg-background"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">State / Union Territory</label>
              <select
                value={gstForm.state_name}
                onChange={(e) => {
                  const found = INDIAN_STATES.find((s) => s.name === e.target.value);
                  setGstForm((prev) => ({
                    ...prev,
                    state_name: e.target.value,
                    state_code: found?.code || prev.state_code,
                  }));
                }}
                className="w-full mt-1 text-xs font-bold p-2.5 border rounded-lg bg-background"
              >
                {INDIAN_STATES.map((st) => (
                  <option key={st.code} value={st.name}>
                    {st.code} - {st.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Contact Phone Number</label>
              <input
                type="text"
                value={gstForm.phone}
                onChange={(e) => setGstForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="9876543210"
                className="w-full mt-1 text-xs font-bold p-2.5 border rounded-lg bg-background"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Principal Business Address</label>
              <textarea
                rows={2}
                value={gstForm.address}
                onChange={(e) => setGstForm((prev) => ({ ...prev, address: e.target.value }))}
                placeholder="Shop No. 4, Market Complex, Road No. 12, Banjara Hills, Hyderabad, Telangana - 500034"
                className="w-full mt-1 text-xs font-bold p-2.5 border rounded-lg bg-background"
              />
            </div>
          </div>

          {/* Bank Account Details */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-border space-y-3">
            <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Bank Account & IFSC for Invoices
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600">Bank Name</label>
                <input
                  type="text"
                  value={gstForm.bank_name}
                  onChange={(e) => setGstForm((prev) => ({ ...prev, bank_name: e.target.value }))}
                  placeholder="HDFC Bank"
                  className="w-full mt-1 text-xs font-bold p-2 border rounded-lg bg-background"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600">Account Number</label>
                <input
                  type="text"
                  value={gstForm.bank_account}
                  onChange={(e) => setGstForm((prev) => ({ ...prev, bank_account: e.target.value }))}
                  placeholder="50200012345678"
                  className="w-full mt-1 text-xs font-bold p-2 border rounded-lg bg-background"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600">IFSC Code</label>
                <input
                  type="text"
                  value={gstForm.bank_ifsc}
                  onChange={(e) => setGstForm((prev) => ({ ...prev, bank_ifsc: e.target.value.toUpperCase() }))}
                  placeholder="HDFC0001234"
                  className="w-full mt-1 text-xs font-bold p-2 border rounded-lg bg-background"
                />
              </div>
            </div>
          </div>

          {/* Tax Slabs CRUD */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                GST Tax Slabs
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={newTaxRate}
                  onChange={(e) => {
                    setNewTaxRate(e.target.value);
                    setNewTaxName(`GST ${e.target.value}%`);
                  }}
                  placeholder="Rate %"
                  className="w-20 text-xs font-bold p-1.5 border rounded-lg bg-background"
                />
                <button
                  type="button"
                  onClick={handleCreateTaxSlab}
                  disabled={isAddingTax}
                  className="px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Slab
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {taxSlabs.map((t) => (
                <span
                  key={t.id}
                  className="px-2.5 py-1 bg-white dark:bg-card border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-lg shadow-2xs"
                >
                  {t.name} ({t.rate}%)
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* TAB 5: GOOGLE REVIEW QR                                           */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {activeTab === 'google_reviews' && (
        <div className="bg-white dark:bg-card p-6 rounded-2xl border border-border shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b pb-4 border-slate-100 dark:border-border">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-foreground">Google 5-Star Review QR</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Print a scannable 5-star Google review QR code on invoices to collect happy customer feedback
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Enable Review QR</span>
              <input
                type="checkbox"
                checked={reviewForm.google_review_enabled}
                onChange={(e) => setReviewForm((prev) => ({ ...prev, google_review_enabled: e.target.checked }))}
                className="h-4 w-4 rounded text-purple-600 focus:ring-purple-500"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            <div className="md:col-span-8 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Google Place ID</label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    value={reviewForm.google_place_id}
                    onChange={(e) => setReviewForm((prev) => ({ ...prev, google_place_id: e.target.value }))}
                    placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
                    className="flex-1 text-xs font-mono font-bold p-2.5 border rounded-lg bg-background"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateReviewLinkFromPlaceId}
                    className="px-3 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    Generate Link
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Google Review Direct URL</label>
                <input
                  type="text"
                  value={reviewForm.google_review_url}
                  onChange={(e) => setReviewForm((prev) => ({ ...prev, google_review_url: e.target.value }))}
                  placeholder="https://search.google.com/local/writereview?placeid=..."
                  className="w-full mt-1 text-xs font-bold p-2.5 border rounded-lg bg-background"
                />
              </div>
            </div>

            {/* QR Preview */}
            <div className="md:col-span-4 p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-border text-center">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block mb-2">
                Live Review QR Badge
              </span>
              {resolvedReviewUrl ? (
                <div className="p-3 bg-white inline-block rounded-xl border border-slate-200 shadow-xs">
                  <img
                    src={generateQRCodeSVG(resolvedReviewUrl, 130)}
                    alt="Google Review QR"
                    className="mx-auto size-32 object-contain"
                  />
                  <div className="text-[11px] font-black text-amber-500 mt-1">⭐⭐⭐⭐⭐ 5.0 Star</div>
                </div>
              ) : (
                <div className="p-8 text-xs text-muted-foreground">Enter Google URL to generate QR</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* TAB 6: PAYMENT QR & PAY                                           */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {activeTab === 'payment_qr' && (
        <div className="bg-white dark:bg-card p-6 rounded-2xl border border-border shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b pb-4 border-slate-100 dark:border-border">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-foreground">UPI Payment QR & Collections</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Generate real-time scannable dynamic UPI QR codes with invoice amount pre-loaded or static custom QR
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Enable Payment QR</span>
              <input
                type="checkbox"
                checked={paymentQrForm.payment_qr_enabled}
                onChange={(e) => setPaymentQrForm((prev) => ({ ...prev, payment_qr_enabled: e.target.checked }))}
                className="h-4 w-4 rounded text-purple-600 focus:ring-purple-500"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            <div className="md:col-span-8 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">UPI VPA ID (Virtual Payment Address)</label>
                <input
                  type="text"
                  value={paymentQrForm.upi_vpa}
                  onChange={(e) => setPaymentQrForm((prev) => ({ ...prev, upi_vpa: e.target.value.trim() }))}
                  placeholder="merchant@hdfcbank or 9876543210@paytm"
                  className="w-full mt-1 text-xs font-bold p-2.5 border rounded-lg bg-background"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Payee Display Name</label>
                <input
                  type="text"
                  value={paymentQrForm.upi_payee_name}
                  onChange={(e) => setPaymentQrForm((prev) => ({ ...prev, upi_payee_name: e.target.value }))}
                  placeholder="I Smart Bazaar Retail"
                  className="w-full mt-1 text-xs font-bold p-2.5 border rounded-lg bg-background"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">QR Generation Mode</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setPaymentQrForm((prev) => ({ ...prev, payment_qr_type: 'dynamic_upi' }))}
                    className={`p-2.5 text-xs font-bold rounded-lg border transition-all ${
                      paymentQrForm.payment_qr_type === 'dynamic_upi'
                        ? 'border-purple-600 bg-purple-50 text-purple-700'
                        : 'border-slate-200'
                    }`}
                  >
                    Dynamic UPI Intent
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentQrForm((prev) => ({ ...prev, payment_qr_type: 'custom_image' }))}
                    className={`p-2.5 text-xs font-bold rounded-lg border transition-all ${
                      paymentQrForm.payment_qr_type === 'custom_image'
                        ? 'border-purple-600 bg-purple-50 text-purple-700'
                        : 'border-slate-200'
                    }`}
                  >
                    Custom Standee Image
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentQrForm((prev) => ({ ...prev, payment_qr_type: 'razorpay' }))}
                    className={`p-2.5 text-xs font-bold rounded-lg border transition-all ${
                      paymentQrForm.payment_qr_type === 'razorpay'
                        ? 'border-purple-600 bg-purple-50 text-purple-700'
                        : 'border-slate-200'
                    }`}
                  >
                    Razorpay Smart Pay
                  </button>
                </div>
              </div>

              {paymentQrForm.payment_qr_type === 'custom_image' && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => customQrInputRef.current?.click()}
                    className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload Custom QR Image
                  </button>
                </div>
              )}
            </div>

            {/* Live Payment QR Preview */}
            <div className="md:col-span-4 p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-border text-center">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block mb-2">
                Live UPI QR Preview
              </span>
              {resolvedUpiUrl ? (
                <div className="p-3 bg-white inline-block rounded-xl border border-slate-200 shadow-xs">
                  <img
                    src={generateQRCodeSVG(resolvedUpiUrl, 130)}
                    alt="UPI QR Preview"
                    className="mx-auto size-32 object-contain"
                  />
                  <div className="text-[10px] font-bold text-slate-700 mt-1">{paymentQrForm.upi_vpa}</div>
                </div>
              ) : (
                <div className="p-8 text-xs text-muted-foreground">Enter UPI ID to preview QR</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* TAB 7: SIGNATURE & STAMP                                          */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {activeTab === 'signature_stamp' && (
        <div className="bg-white dark:bg-card p-6 rounded-2xl border border-border shadow-xs space-y-6">
          <div className="border-b pb-4 border-slate-100 dark:border-border">
            <h2 className="text-base font-bold text-slate-900 dark:text-foreground">Authorized Signature & Digital Seal</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upload digital signatures and official company stamps to print authenticated invoices
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-border space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Digital Signature
                </span>
                <input
                  type="checkbox"
                  checked={signatureForm.show_digital_signature}
                  onChange={(e) => setSignatureForm((prev) => ({ ...prev, show_digital_signature: e.target.checked }))}
                  className="rounded text-purple-600 h-4 w-4"
                />
              </div>
              <div className="flex items-center gap-3">
                {signatureForm.signature_url ? (
                  <img
                    src={signatureForm.signature_url}
                    alt="Signature"
                    className="w-24 h-14 object-contain border rounded-lg bg-white p-1"
                  />
                ) : (
                  <div className="w-24 h-14 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-xs font-bold">
                    No Signature
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => sigInputRef.current?.click()}
                  className="px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" /> Upload Signature
                </button>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600">Signatory Title</label>
                <input
                  type="text"
                  value={signatureForm.signature_title}
                  onChange={(e) => setSignatureForm((prev) => ({ ...prev, signature_title: e.target.value }))}
                  placeholder="Authorized Signatory"
                  className="w-full mt-1 text-xs font-bold p-2 border rounded-lg bg-background"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-border space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Company Official Stamp
                </span>
                <input
                  type="checkbox"
                  checked={signatureForm.show_digital_stamp}
                  onChange={(e) => setSignatureForm((prev) => ({ ...prev, show_digital_stamp: e.target.checked }))}
                  className="rounded text-purple-600 h-4 w-4"
                />
              </div>
              <div className="flex items-center gap-3">
                {signatureForm.stamp_url ? (
                  <img
                    src={signatureForm.stamp_url}
                    alt="Stamp"
                    className="w-20 h-20 object-contain border rounded-lg bg-white p-1"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-xs font-bold">
                    No Stamp
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => stampInputRef.current?.click()}
                  className="px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" /> Upload Stamp
                </button>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600">Alignment</label>
                <select
                  value={signatureForm.signature_alignment}
                  onChange={(e) => setSignatureForm((prev) => ({ ...prev, signature_alignment: e.target.value as any }))}
                  className="w-full mt-1 text-xs font-bold p-2 border rounded-lg bg-background"
                >
                  <option value="right">Right Aligned (Standard)</option>
                  <option value="left">Left Aligned</option>
                  <option value="center">Centered</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* TAB 8: BARCODE LABELS                                             */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {activeTab === 'barcode' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Preview */}
          <div className="lg:col-span-7 flex flex-col items-center justify-start p-6 bg-slate-100 dark:bg-slate-900/60 rounded-2xl border border-border min-h-[500px]">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <ScanBarcode className="w-4 h-4 text-purple-600" /> Live Barcode Label Preview
            </span>
            <div className="p-4 bg-white border border-slate-300 rounded-lg shadow-md max-w-[280px] w-full text-center text-black">
              {getBarcodeField('business_name')?.enabled && (
                <div className="text-xs font-black uppercase mb-1">{businessDisplayName}</div>
              )}
              {getBarcodeField('item_name')?.enabled && <div className="text-xs font-bold">Samsung A30</div>}
              <div className="my-2 flex justify-center">
                <RealBarcodeSvg value="1234567890" width={1.4} height={38} />
              </div>
              <div className="flex justify-between text-[11px] font-black mt-1">
                {getBarcodeField('mrp')?.enabled && <span>MRP: ₹12,000</span>}
                {getBarcodeField('selling_price')?.enabled && <span>Price: ₹10,000</span>}
              </div>
            </div>
          </div>

          {/* Right Controls */}
          <div className="lg:col-span-5 bg-card p-5 rounded-2xl border border-border space-y-4">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Barcode Label Size & Fields
            </h3>
            <div>
              <label className="text-[11px] font-bold text-slate-600">Label Dimensions</label>
              <select
                value={barcodeSettings.labelSize}
                onChange={(e) => handleLabelSizeChange(e.target.value)}
                className="w-full mt-1 text-xs font-bold p-2.5 border rounded-lg bg-background"
              >
                <option value="50x25_2up">50 x 25 mm (2 per row roll)</option>
                <option value="38x25_1up">38 x 25 mm (1 per row roll)</option>
                <option value="50x50_1up">50 x 50 mm (Square label)</option>
                <option value="100x50_1up">100 x 50 mm (Shipping label)</option>
                <option value="a4_24">A4 Sheet (24 labels per sheet)</option>
                <option value="a4_40">A4 Sheet (40 labels per sheet)</option>
              </select>
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <span className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-300">Visible Fields</span>
              {barcodeSettings.fields.map((f: BarcodeFieldConfig) => (
                <label key={f.key} className="flex items-center justify-between text-xs py-1 cursor-pointer">
                  <span>{f.label}</span>
                  <input
                    type="checkbox"
                    checked={f.enabled}
                    onChange={(e) => updateBarcodeField(f.key, { enabled: e.target.checked })}
                    className="rounded text-purple-600 h-4 w-4"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Word-Style Invoice Studio Modal */}
      {isWordStudioOpen && (
        <WordInvoiceStudioModal
          isOpen={isWordStudioOpen}
          onClose={() => setIsWordStudioOpen(false)}
          onSave={() => {
            setIsWordStudioOpen(false);
            toast.success('Word template saved!');
          }}
        />
      )}
    </div>
  );
}
