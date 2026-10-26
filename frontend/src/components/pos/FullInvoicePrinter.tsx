import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useI18n } from "@/contexts/i18n-context";
import { createPortal } from 'react-dom';
import { Printer, X, Download, FileText, CheckCircle2, Upload, Sparkles, MessageCircle, Mail, Send, Loader2, Sliders, Settings } from 'lucide-react';
import { toast } from "sonner";
import { getActiveInvoicePrintTemplate, setActiveInvoicePrintTemplate, GLOBAL_INVOICE_TEMPLATES, getActiveBillingGst, getOrgPaymentQrSettings, getOrgSignatureSettings, getTenantTemplatesKey, getTenantIdFromStorage, getTenantDefaultsKey } from '../../lib/receipt-template-store';
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { companiesApi, invoicesApi, printTemplatesApi, resolveImageUrl } from "@/lib/api-client";
import { formatDisplayDate, isWalkInParty, formatPartyAddress, isInvoiceLineFree } from "@/lib/utils";
import { generateQRCodeSVG, buildUpiPayUrl } from "@/lib/qr-generator";
import { MargPharmaTemplate } from './invoice-templates/MargPharmaTemplate';
import { FmcgDistributorTemplate } from './invoice-templates/FmcgDistributorTemplate';
import { ParleDistributorTemplate } from './invoice-templates/ParleDistributorTemplate';
import { AgriSeedsTemplate } from './invoice-templates/AgriSeedsTemplate';
import { PdfStationeryOverlayTemplate } from './invoice-templates/PdfStationeryOverlayTemplate';
import { WordInvoiceDocument } from './invoice-templates/WordInvoiceDocument';
import { PdfTemplateOverlayModal } from './PdfTemplateOverlayModal';
import { computeGstBreakdown, extractGstState, INDIAN_GST_STATES } from '@/lib/gst-utils';
import { InvoiceQuickSettingsModal, loadStoredInvoiceSettings } from './InvoiceQuickSettingsModal';
import { PurchaseInvoiceQuickSettingsModal, loadStoredPurchaseInvoiceSettings, PurchaseInvoiceSettings } from '../procurement/PurchaseInvoiceQuickSettingsModal';
import { WordInvoiceStudioModal } from './WordInvoiceStudioModal';
import { RealBarcodeSvg } from '@/lib/barcode-svg';

export const isThermalReceiptId = (id: string | null | undefined): boolean => {
  if (!id) return false;
  const s = String(id).toLowerCase().trim();
  return s === 'thermal' || s === 'pos' || s.startsWith('tpl-thm-') || s.includes('thermal') || s.includes('receipt');
};

const BUILTIN_INVOICE_OPTIONS = [
  { id: 'tpl-word-default', name: 'Custom Word-Designed Invoice', themeName: 'word_studio', isWordTemplate: true, isDefault: true },
  { id: 'tpl-inv-global-stripe', name: 'Stripe Silicon Valley Minimal (Global)', themeName: 'global_stripe', isWordTemplate: true, primaryColor: '#0f172a' },
  { id: 'tpl-inv-global-zurich', name: 'Zurich Swiss International (Global)', themeName: 'global_zurich', isWordTemplate: true, primaryColor: '#dc2626' },
  { id: 'tpl-inv-global-nordic', name: 'Nordic Minimalist Slate (Global)', themeName: 'global_nordic', isWordTemplate: true, primaryColor: '#334155' },
  { id: 'tpl-inv-global-tokyo', name: 'Tokyo Executive Precision (Global)', themeName: 'global_tokyo', isWordTemplate: true, primaryColor: '#1e1b4b' },
  { id: 'tpl-inv-global-singapore', name: 'Singapore Global Trade & Commerce (Global)', themeName: 'global_singapore', isWordTemplate: true, primaryColor: '#0284c7' },
  { id: 'tpl-inv-marg-pharma', name: 'MARG Pharma & Wholesale GST (A4)', themeName: 'marg_pharma' },
  { id: 'tpl-inv-fmcg-distributor', name: 'FMCG / Food Multi-Column GST (A4)', themeName: 'fmcg_distributor' },
  { id: 'tpl-inv-parle-teal', name: 'Parle Brand Teal-Header GST (A4)', themeName: 'parle_teal' },
  { id: 'tpl-inv-agri-seeds', name: 'Agri Seeds, Fertilizer & Pesticides GST (A4)', themeName: 'agri_seeds' },
  { id: 'tpl-inv-stylish', name: 'Stylish Theme (A4)', themeName: 'stylish' },
  { id: 'tpl-inv-luxury', name: 'Luxury Theme (A4)', themeName: 'luxury' },
  { id: 'tpl-inv-tally', name: 'Advanced GST (Tally) Theme (A4)', themeName: 'tally' },
  { id: 'tpl-inv-adv-gst', name: 'Advanced GST Theme (A4)', themeName: 'adv_gst' },
  { id: 'tpl-inv-billbook', name: 'BillBook Theme (A4)', themeName: 'billbook' },
  { id: 'tpl-inv-modern', name: 'Modern Theme (A4)', themeName: 'modern' },
];

export interface FullInvoiceData {
  id?: string;
  doc_type?: string;
  header_title?: string;
  documentTitle?: string;
  place_of_supply?: string;
  po_reference?: string;
  grn_reference?: string;
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  po_number?: string;
  po_date?: string;
  vehicle_number?: string;
  driver_name?: string;
  driver_phone?: string;
  transporter_name?: string;
  transporter_id?: string;
  eway_bill_number?: string;
  eway_bill_date?: string;
  challan_number?: string;
  delivery_challan_number?: string;
  payment_terms?: string;
  print_template_id?: string;
  template_id?: string;
  templateId?: string;
  custom_fields?: Record<string, any> | Array<{ name?: string; key?: string; value?: string }>;
  invoice_custom_fields?: Array<{ id: string; name: string; enabled?: boolean; value?: string }>;
  copy_type?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerCompany?: string;
  customerGST?: string;
  customerPan?: string;
  customerAddress?: string;
  customerBillingAddress?: string;
  customerShippingAddress?: string;
  customerType?: string;
  items?: Array<{
    product_id?: string;
    product_name?: string;
    description?: string;
    custom_note?: string;
    notes?: string;
    sku?: string;
    product_code?: string;
    barcode?: string;
    hsn_code?: string;
    quantity: number;
    unit_price: number;
    mrp?: number;
    selling_price?: number;
    discount_type?: 'percent' | 'fixed';
    discount_value?: number;
    tax_rate?: number;
    subtotal?: number;
    [key: string]: any;
  }>;
  subtotal?: number;
  discount_amount?: number;
  tax_amount?: number;
  taxable_value?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  gst_type?: 'cgst_sgst' | 'igst';
  is_interstate?: boolean;
  additional_charges?: Array<{ name: string; amount: number }>;
  round_off?: number;
  grand_total?: number;
  payment_method?: string;
  payment_status?: string;
  amount_received?: number;
  notes?: string;
  terms?: string;
  [key: string]: any;
}

interface FullInvoicePrinterProps {
  invoice: FullInvoiceData | null;
  isOpen: boolean;
  onClose: () => void;
  autoPrint?: boolean;
  customTemplate?: any;
}

const STATE_GST_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "32": "Kerala", "33": "Tamil Nadu",
  "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh"
};

interface InvoiceErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onReset?: () => void;
}

interface InvoiceErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class InvoiceErrorBoundary extends React.Component<InvoiceErrorBoundaryProps, InvoiceErrorBoundaryState> {
  constructor(props: InvoiceErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): InvoiceErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Invoice Preview Template Error caught by InvoiceErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="p-8 text-center bg-white rounded-2xl border border-rose-200 max-w-lg mx-auto my-12 shadow-xl space-y-4">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h3 className="text-base font-bold text-slate-900">Invoice Layout Notice</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            The active preview encountered an unformatted field in this invoice. You can reset to the standard document layout or print directly.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false });
                if (this.props.onReset) this.props.onReset();
              }}
              className="px-4 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
            >
              Reset to Standard Layout
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all cursor-pointer"
            >
              Print Invoice Directly
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function FullInvoicePrinter({
  isOpen,
  onClose,
  invoice,
  autoPrint = false,
  customTemplate,
}: FullInvoicePrinterProps) {
  const { t } = useI18n();
  const { currency } = useCurrency();
  const { tenant } = useTenant();
  const printContainerRef = useRef<HTMLDivElement>(null);

  const [availableTemplates, setAvailableTemplates] = useState<any[]>(() => {
    if (typeof window === 'undefined') return GLOBAL_INVOICE_TEMPLATES;
    try {
      const tid = tenant?.id || getTenantIdFromStorage();
      const storageKey = getTenantTemplatesKey(tid);
      // Strictly workspace-scoped template list — never fall back to the unsuffixed
      // global key, which holds templates saved by other tenants/workspaces.
      const saved = tid ? localStorage.getItem(storageKey) : null;
      if (saved) {
        const list = JSON.parse(saved);
        if (Array.isArray(list)) {
          const invTpls = list.filter((t: any) => t.category === 'invoices' || t.docType === 'invoice' || t.wordConfig);
          if (invTpls.length > 0) return invTpls;
        }
      }
    } catch {}
    return GLOBAL_INVOICE_TEMPLATES;
  });

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
    if (typeof window === 'undefined') return 'tpl-word-default';
    try {
      const tid = tenant?.id || getTenantIdFromStorage();
      const defaultsKey = getTenantDefaultsKey(tid);
      // Workspace-scoped default keys only — never the unsuffixed global fallback
      const userActiveDefaultsRaw = tid ? localStorage.getItem(defaultsKey) : null;
      let userActiveInvoiceId: string | null = null;
      if (userActiveDefaultsRaw) {
        try {
          const parsed = JSON.parse(userActiveDefaultsRaw);
          userActiveInvoiceId = parsed.invoices || parsed.invoice || null;
        } catch {}
      }
      const savedTplId =
        userActiveInvoiceId ||
        (tid ? localStorage.getItem(`bos_active_invoice_template_id_${tid}`) : null);

      if (savedTplId && !isThermalReceiptId(savedTplId)) {
        return savedTplId;
      }
    } catch {}
    return 'tpl-word-default';
  });
  const [fetchedReviewUrl, setFetchedReviewUrl] = useState<string | null>(null);
  const [invoiceCopyType, setInvoiceCopyType] = useState<string>(invoice?.copy_type || 'ORIGINAL FOR RECIPIENT');
  const [isPdfOverlayModalOpen, setIsPdfOverlayModalOpen] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [liveCompanyData, setLiveCompanyData] = useState<any>(null);
  const [isPurchaseSettingsOpen, setIsPurchaseSettingsOpen] = useState(false);
  const [isSalesSettingsOpen, setIsSalesSettingsOpen] = useState(false);
  const [isWordStudioOpen, setIsWordStudioOpen] = useState(false);
  const [purchaseSettings, setPurchaseSettings] = useState<PurchaseInvoiceSettings>(() => loadStoredPurchaseInvoiceSettings(tenant?.id));
  const [salesSettings, setSalesSettings] = useState<any>(() => loadStoredInvoiceSettings(tenant?.id));

  const isPurchaseDoc = Boolean(
    invoice?.doc_type === 'purchase_invoice' ||
    invoice?.doc_type === 'PO' ||
    invoice?.doc_type === 'PR' ||
    invoice?.doc_type === 'PINV' ||
    invoice?.doc_type === 'vendor_bill' ||
    invoice?.doc_type === 'bill' ||
    invoice?.header_title?.toLowerCase().includes('purchase') ||
    invoice?.documentTitle?.toLowerCase().includes('purchase') ||
    (invoice as any)?.isProcurement
  );

  useEffect(() => {
    const handlePurchaseUpdate = (e: any) => {
      if (e?.detail?.settings) {
        setPurchaseSettings(e.detail.settings);
      } else {
        setPurchaseSettings(loadStoredPurchaseInvoiceSettings(tenant?.id));
      }
    };
    const handleSalesUpdate = () => {
      setSalesSettings(loadStoredInvoiceSettings(tenant?.id));
    };
    window.addEventListener('bos-purchase-settings-updated', handlePurchaseUpdate);
    window.addEventListener('bos-invoice-settings-changed', handlePurchaseUpdate);
    window.addEventListener('storage', handlePurchaseUpdate);
    return () => {
      window.removeEventListener('bos-purchase-settings-updated', handlePurchaseUpdate);
      window.removeEventListener('bos-invoice-settings-changed', handlePurchaseUpdate);
      window.removeEventListener('storage', handlePurchaseUpdate);
    };
  }, [tenant?.id]);

  const handleSendWhatsApp = async () => {
    if (!invoice) return;
    try {
      setIsSendingWhatsApp(true);
      const phone =
        invoice.customerPhone ||
        invoice.customer_phone ||
        invoice.customer?.phone ||
        (invoice as any)?.shipping_address?.phone ||
        (invoice as any)?.billing_address?.phone ||
        (invoice as any)?.phone;

      let targetPhone = phone;
      if (!targetPhone) {
        const input = window.prompt("Enter customer WhatsApp phone number (e.g. 9876543210):");
        if (!input) {
          setIsSendingWhatsApp(false);
          return;
        }
        targetPhone = input.trim();
      }

      let cleanPhone = targetPhone.replace(/[^0-9]/g, '');
      if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;

      const invIdentifier = invoice.id || invoice.invoice_number || (invoice as any)?.proforma_number;
      toast.info(`Sending invoice #${invoice.invoice_number || invIdentifier} via WhatsApp...`);

      let sent = false;
      try {
        const res = await invoicesApi.sendInvoiceToWhatsApp(invIdentifier, cleanPhone);
        if (res?.success) {
          sent = true;
          toast.success(`Invoice sent to ${cleanPhone} via WhatsApp!`);
        }
      } catch (gwErr: any) {
        console.warn("Automated WhatsApp gateway dispatch failed, offering direct WhatsApp:", gwErr);
      }

      if (!sent) {
        const orgName = template?.companyName || template?.storeName || "Our Store";
        const grandTotal = Number(invoice.total_amount || invoice.grand_total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
        const text = encodeURIComponent(
          `Hello ${invoice.customerName || invoice.customer_name || 'Customer'},\n\n` +
          `Thank you for your business! Here is your Tax Invoice from *${orgName}*:\n\n` +
          `📄 *Invoice No:* ${invoice.invoice_number || invIdentifier}\n` +
          `📅 *Date:* ${invoice.invoice_date || new Date().toLocaleDateString('en-IN')}\n` +
          `💰 *Total Amount:* ₹${grandTotal}\n` +
          `💳 *Status:* ${invoice.payment_status || (invoice.balance_due === 0 ? 'Paid' : 'Due')}\n\n` +
          (invoice.balance_due > 0 ? `⚠️ *Balance Due:* ₹${Number(invoice.balance_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n\n` : '') +
          `Please contact us for any assistance.\nRegards,\n*${orgName}*`
        );
        window.open(`https://wa.me/${cleanPhone}?text=${text}`, "_blank");
        toast.success(`Opened WhatsApp chat for ${cleanPhone}!`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to dispatch WhatsApp message");
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const handleSendEmail = async () => {
    if (!invoice) return;
    try {
      setIsSendingEmail(true);
      const email =
        invoice.customerEmail ||
        invoice.customer_email ||
        invoice.customer?.email ||
        (invoice as any)?.shipping_address?.email ||
        (invoice as any)?.billing_address?.email ||
        (invoice as any)?.email;

      let targetEmail = email;
      if (!targetEmail) {
        const input = window.prompt("Enter recipient email address:");
        if (!input) {
          setIsSendingEmail(false);
          return;
        }
        targetEmail = input.trim();
      }

      const invIdentifier = invoice.id || invoice.invoice_number || (invoice as any)?.proforma_number;
      toast.info(`Sending invoice #${invoice.invoice_number || invIdentifier} via Email...`);
      const res = await invoicesApi.sendInvoiceEmail(invIdentifier, targetEmail);
      if (res?.success) {
        toast.success(`Invoice sent to ${targetEmail} via Email!`);
      } else {
        toast.warning(res?.error || "Email status received.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to dispatch email");
    } finally {
      setIsSendingEmail(false);
    }
  };

  useEffect(() => {
    if (invoice?.copy_type) {
      setInvoiceCopyType(invoice.copy_type);
    } else {
      setInvoiceCopyType('ORIGINAL FOR RECIPIENT');
    }
  }, [invoice?.copy_type, isOpen]);

  useEffect(() => {
    const loadTemplates = () => {
      try {
        const storageKey = getTenantTemplatesKey(tenant?.id);
        const saved = localStorage.getItem(storageKey) || localStorage.getItem('businessos_print_templates_v1');
        if (saved) {
          const list = JSON.parse(saved);
          if (Array.isArray(list)) {
            const invTpls = list.filter((t: any) => t.category === 'invoices' || t.docType === 'invoice');
            if (invTpls.length > 0) {
              setAvailableTemplates(invTpls);
            }
          }
        }

        // 1. If this specific invoice has its own stamped template ID, prioritize it (ignoring thermal receipt IDs)!
        const rawInvoiceSpecificTplId =
          invoice?.print_template_id ||
          invoice?.template_id ||
          invoice?.templateId ||
          (invoice as any)?.custom_fields?.print_template_id ||
          (invoice as any)?.custom_fields?.template_id;
        const invoiceSpecificTplId = isThermalReceiptId(rawInvoiceSpecificTplId) ? undefined : rawInvoiceSpecificTplId;

        // Fetch organization templates saved in database for multi-user synchronization across same tenant
        printTemplatesApi.getTemplates('invoices').then((res) => {
          if (res?.templates && Array.isArray(res.templates) && res.templates.length > 0) {
            const backendInvTpls = res.templates.filter((t: any) => t.category === 'invoices' || t.docType === 'invoice' || t.wordConfig);
            if (backendInvTpls.length > 0) {
              setAvailableTemplates((prev) => {
                const map = new Map<string, any>();
                prev.forEach((t) => map.set(t.id, t));
                backendInvTpls.forEach((t: any) => map.set(t.id, { ...(map.get(t.id) || {}), ...t }));
                const merged = Array.from(map.values());
                try {
                  const storageKey = getTenantTemplatesKey(tenant?.id);
                  localStorage.setItem(storageKey, JSON.stringify(merged));
                } catch {}
                return merged;
              });
            }
          }
          if (res?.active_map?.invoices && !invoiceSpecificTplId && !isThermalReceiptId(res.active_map.invoices)) {
            setSelectedTemplateId((prev) => (!prev || isThermalReceiptId(prev) ? res.active_map.invoices : prev));
          }
        }).catch(() => {});

        if (invoiceSpecificTplId) {
          setSelectedTemplateId(invoiceSpecificTplId);
          return;
        }

        // 2. Otherwise restore active selected template across sessions/logins
        const userActiveDefaultsRaw =
          localStorage.getItem(`user_active_print_templates_v1_${tenant?.id}`) ||
          localStorage.getItem('user_active_print_templates_v1');
        let userActiveInvoiceId: string | null = null;
        if (userActiveDefaultsRaw) {
          try {
            const parsed = JSON.parse(userActiveDefaultsRaw);
            userActiveInvoiceId = parsed.invoices || parsed.invoice || null;
          } catch {}
        }

        const savedTplId =
          userActiveInvoiceId ||
          localStorage.getItem(`bos_active_invoice_template_id_${tenant?.id}`);

        if (savedTplId && !isThermalReceiptId(savedTplId)) {
          setSelectedTemplateId(savedTplId);
          invoicesApi.setActivePrintTemplate(savedTplId).catch(() => {});
        } else {
          invoicesApi.getActivePrintTemplate().then((res) => {
            if (res?.active_template?.id && !isThermalReceiptId(res.active_template.id)) {
              setSelectedTemplateId(res.active_template.id);
            }
          }).catch(() => {});
        }

        // 3. Try resolving Google Review URL immediately from localStorage
        const activeCompRaw =
          localStorage.getItem('bos_active_company') ||
          localStorage.getItem(`bos_active_company_${tenant?.id}`) ||
          localStorage.getItem('bos_active_company_default');
        if (activeCompRaw) {
          const parsed = JSON.parse(activeCompRaw);
          if (parsed?.google_review_url) {
            setFetchedReviewUrl(parsed.google_review_url);
          }
        }

        // 4. Fetch fresh organization company data from API – guarantees real-time details
        //    Use the active company (from localStorage bos_active_company_id) NOT the first item.
        //    This prevents cross-workspace bleed (e.g. showing Ameya's details while in iotronics).
        companiesApi.list(1, 100).then((res) => {
          if (res?.items && res.items.length > 0) {
            const activeCompanyId = localStorage.getItem('bos_active_company_id');
            const active = res.items.find((c: any) =>
              (activeCompanyId && (String(c.id) === String(activeCompanyId) || c.id === activeCompanyId)) ||
              (tenant?.id && (String(c.id) === String(tenant.id) || c.id === tenant.id)) ||
              (tenant?.name && c.name?.toLowerCase().trim() === tenant.name?.toLowerCase().trim())
            );
            if (active) {
              // Persist to localStorage so getActiveBillingGst() picks it up next time
              const tid = tenant?.id || getTenantIdFromStorage();
              if (tid) {
                try {
                  const primaryReg = active.gst_registrations?.find((r: any) => r.is_primary) || active.gst_registrations?.[0];
                  const gstinVal = primaryReg?.gstin || active.gst_number || (active as any).gstin || '';
                  const addressVal = primaryReg?.address || active.address || '';

                  localStorage.setItem(`bos_active_company_${tid}_${active.id}`, JSON.stringify(active));
                  localStorage.setItem(`bos_active_company_${tid}`, JSON.stringify(active));
                  localStorage.setItem('bos_active_company', JSON.stringify(active));

                  const merged = {
                    trade_name: active.name || (active as any).trade_name || '',
                    legal_name: active.legal_name || active.name || '',
                    gstin: gstinVal,
                    address: addressVal,
                    phone: active.phone || '',
                    email: active.email || '',
                    logo_url: active.logo_url || null,
                    google_review_url: active.google_review_url || null,
                    google_review_enabled: active.google_review_enabled ?? true,
                  };
                  localStorage.setItem(`bos_active_billing_gst_details_${tid}_${active.id}`, JSON.stringify(merged));
                  localStorage.setItem(`bos_active_billing_gst_details_${tid}`, JSON.stringify(merged));
                } catch {}
              }
              setLiveCompanyData(active);
              if (active.google_review_url) {
                setFetchedReviewUrl(active.google_review_url);
              }
            }
          }
        }).catch(() => {});
      } catch {}
    };

    if (typeof window !== 'undefined' && isOpen) {
      loadTemplates();
      window.addEventListener('print_templates_updated', loadTemplates);
      window.addEventListener('bos_invoice_template_changed', loadTemplates);
      window.addEventListener('bos-tenant-changed', loadTemplates);
      window.addEventListener('storage', loadTemplates);
      return () => {
        window.removeEventListener('print_templates_updated', loadTemplates);
        window.removeEventListener('bos_invoice_template_changed', loadTemplates);
        window.removeEventListener('bos-tenant-changed', loadTemplates);
        window.removeEventListener('storage', loadTemplates);
      };
    }
  }, [isOpen, tenant?.id, tenant?.name, invoice?.invoice_number, invoice?.print_template_id, invoice?.template_id]);

  useEffect(() => {
    if (isOpen && autoPrint && invoice) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoPrint, invoice]);

  if (!isOpen || !invoice) return null;
  if (typeof document === 'undefined') return null;

  // ── Robust Template Resolution: Honor Invoice-Specific Stamped Template ──
  const activeMasterTemplate = getActiveInvoicePrintTemplate(tenant?.id || getTenantIdFromStorage());
  const rawInvoiceSpecificTplId =
    invoice?.print_template_id ||
    invoice?.template_id ||
    invoice?.templateId ||
    (invoice as any)?.custom_fields?.print_template_id ||
    (invoice as any)?.custom_fields?.template_id;
  const invoiceSpecificTplId = isThermalReceiptId(rawInvoiceSpecificTplId) ? undefined : rawInvoiceSpecificTplId;

  const targetTplId = (selectedTemplateId && !isThermalReceiptId(selectedTemplateId))
    ? selectedTemplateId
    : (invoiceSpecificTplId || activeMasterTemplate?.id || 'tpl-word-default');

  // 1. Direct match by ID in availableTemplates
  let resolvedTpl = availableTemplates.find((t) => t.id === targetTplId || t.themeName === targetTplId);

  // 2. Direct match in BUILTIN_INVOICE_OPTIONS
  if (!resolvedTpl && targetTplId) {
    const builtin = BUILTIN_INVOICE_OPTIONS.find((b) => b.id === targetTplId || b.themeName === targetTplId);
    if (builtin) {
      resolvedTpl = availableTemplates.find((t) => (t.themeName && t.themeName === builtin.themeName) || (t.id && t.id.includes(builtin.themeName))) || {
        id: builtin.id,
        name: builtin.name,
        themeName: builtin.themeName,
        category: 'invoices',
        docType: 'invoice',
        paperSize: 'A4',
        orientation: 'portrait',
        primaryColor: builtin.themeName === 'marg_pharma' ? '#e11d48' : builtin.themeName === 'fmcg_distributor' ? '#059669' : builtin.themeName === 'parle_teal' ? '#0f766e' : builtin.themeName === 'agri_seeds' ? '#15803d' : '#4f46e5',
        fields: { showHeader: true, showLogo: true, showCompanyDetails: true, showInvoiceDetails: true, showItemTable: true, showHSN: true, showTaxSplit: true, showBankDetails: true, showSignature: true, showCustomerDetails: true, showTotals: true },
      };
    }
  }

  // 3. Alias / keyword search in availableTemplates
  if (!resolvedTpl && targetTplId) {
    const norm = targetTplId.toLowerCase();
    resolvedTpl = availableTemplates.find((t) => {
      const tNorm = (t.id || '').toLowerCase();
      const nameNorm = (t.name || '').toLowerCase();
      const themeNorm = (t.themeName || '').toLowerCase();
      if (norm.includes('marg') && (tNorm.includes('marg') || themeNorm.includes('marg') || nameNorm.includes('marg'))) return true;
      if (norm.includes('fmcg') && (tNorm.includes('fmcg') || themeNorm.includes('fmcg') || nameNorm.includes('fmcg'))) return true;
      if (norm.includes('parle') && (tNorm.includes('parle') || themeNorm.includes('parle') || nameNorm.includes('parle'))) return true;
      if ((norm.includes('agri') || norm.includes('seed')) && (tNorm.includes('agri') || themeNorm.includes('agri') || nameNorm.includes('agri'))) return true;
      if (norm.includes('luxury') && (tNorm.includes('luxury') || themeNorm.includes('luxury') || nameNorm.includes('luxury'))) return true;
      if (norm.includes('tally') && (tNorm.includes('tally') || themeNorm.includes('tally') || nameNorm.includes('tally'))) return true;
      if (norm.includes('billbook') && (tNorm.includes('billbook') || themeNorm.includes('billbook') || nameNorm.includes('billbook'))) return true;
      if (norm.includes('modern') && (tNorm.includes('modern') || themeNorm.includes('modern') || nameNorm.includes('modern'))) return true;
      if (norm.includes('god') && (tNorm.includes('god') || themeNorm.includes('god') || nameNorm.includes('god'))) return true;
      if (norm.includes('up') && (tNorm.includes('up') || themeNorm.includes('up') || nameNorm.includes('up'))) return true;
      if (norm.includes('stylish') && (tNorm.includes('stylish') || themeNorm.includes('stylish') || nameNorm.includes('stylish'))) return true;
      return false;
    });
  }

  // 4. Synthesized fallback matching the target keyword
  if (!resolvedTpl && targetTplId) {
    const norm = targetTplId.toLowerCase();
    let themeName = (activeMasterTemplate?.themeName || 'word_studio');
    let name = (activeMasterTemplate?.name || 'Custom Word-Designed Invoice');
    if (norm.includes('marg')) { themeName = 'marg_pharma'; name = 'Marg Pharma & Wholesale GST'; }
    else if (norm.includes('fmcg')) { themeName = 'fmcg_distributor'; name = 'FMCG / Food Multi-Column GST'; }
    else if (norm.includes('parle')) { themeName = 'parle_teal'; name = 'Parle Brand Teal-Header GST'; }
    else if (norm.includes('agri') || norm.includes('seed')) { themeName = 'agri_seeds'; name = 'Agri Seeds, Fertilizer & Pesticides GST'; }
    else if (norm.includes('luxury')) { themeName = 'luxury'; name = 'Luxury Theme'; }
    else if (norm.includes('tally')) { themeName = 'tally'; name = 'Advanced GST (Tally)'; }
    else if (norm.includes('billbook')) { themeName = 'billbook'; name = 'BillBook Theme'; }
    else if (norm.includes('modern')) { themeName = 'modern'; name = 'Modern Theme'; }
    else if (norm.includes('god')) { themeName = 'culture_god'; name = 'Shubh Labh Vedic Theme'; }
    else if (norm.includes('up')) { themeName = 'culture_up'; name = 'Uttar Pradesh GST Theme'; }
    else if (norm.includes('stylish')) { themeName = 'stylish'; name = 'Stylish Theme'; }
    else if (norm.includes('word') || norm.includes('studio') || norm === 'tpl-word-default') { themeName = 'word_studio'; name = 'Custom Word-Designed Invoice'; }

    resolvedTpl = {
      id: targetTplId,
      name,
      themeName,
      paperSize: 'A4',
      orientation: 'portrait',
      primaryColor: themeName === 'marg_pharma' ? '#e11d48' : themeName === 'fmcg_distributor' ? '#059669' : themeName === 'parle_teal' ? '#0f766e' : themeName === 'agri_seeds' ? '#15803d' : '#0f172a',
      fields: { showHeader: true, showLogo: true, showCompanyDetails: true, showInvoiceDetails: true, showItemTable: true, showHSN: true, showTaxSplit: true, showBankDetails: true, showSignature: true, showCustomerDetails: true, showTotals: true },
    };
  }

  const baseTemplate = resolvedTpl || activeMasterTemplate || GLOBAL_INVOICE_TEMPLATES[0];
  const template = {
    ...baseTemplate,
    ...(customTemplate || {}),
    fields: {
      ...(baseTemplate?.fields || {}),
      ...(customTemplate?.fields || {}),
    },
  };

  const f = {
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
    ...(template?.fields || {}),
    ...(customTemplate?.fields || {}),
    ...(isWalkInParty(invoice) ? { showPartyBalance: false } : {}),
  };

  const theme =
    template.themeName ||
    (template.name?.toLowerCase().includes('marg') || template.id?.includes('marg') ? 'marg_pharma' :
     template.name?.toLowerCase().includes('fmcg') || template.id?.includes('fmcg') ? 'fmcg_distributor' :
     template.name?.toLowerCase().includes('parle') || template.id?.includes('parle') ? 'parle_teal' :
     template.name?.toLowerCase().includes('agri') || template.id?.includes('agri') || template.name?.toLowerCase().includes('seed') || template.id?.includes('seed') ? 'agri_seeds' :
     template.name?.toLowerCase().includes('luxury') || template.id?.includes('luxury') ? 'luxury' :
     template.name?.toLowerCase().includes('tally') || template.id?.includes('tally') ? 'tally' :
     template.name?.toLowerCase().includes('adv') || template.id?.includes('adv') ? 'adv_gst' :
     template.name?.toLowerCase().includes('billbook') || template.id?.includes('billbook') ? 'billbook' :
     template.name?.toLowerCase().includes('modern') || template.id?.includes('modern') ? 'modern' :
     template.name?.toLowerCase().includes('god') || template.id?.includes('god') ? 'culture_god' :
     'stylish');

  const isMargPharma = theme === 'marg_pharma';
  const isFmcg = theme === 'fmcg_distributor';
  const isParle = theme === 'parle_teal';
  const isAgriSeeds = theme === 'agri_seeds';
  const isPdfOverlay = Boolean(
    theme === 'pdf_stationery_overlay' ||
    template?.themeName === 'pdf_stationery_overlay' ||
    template?.isPdfStationeryOverlay === true ||
    Boolean(template?.pdfBackgroundDataUrl)
  );
  const isWordTemplate = Boolean(
    template?.wordConfig ||
    template?.id?.startsWith('tpl-word-') ||
    template?.id?.startsWith('tpl-inv-global-') ||
    targetTplId === 'tpl-word-default' ||
    targetTplId?.startsWith('tpl-word-') ||
    targetTplId?.startsWith('tpl-inv-global-') ||
    theme === 'word_studio' ||
    template?.themeName === 'word_studio' ||
    template?.themeName?.startsWith('global_') ||
    (template as any)?.isWordTemplate
  );
  const isCustomReplica = isWordTemplate || isMargPharma || isFmcg || isParle || isAgriSeeds || isPdfOverlay;


  const isLuxury = theme === 'luxury';
  const isTally = theme === 'tally';
  const isStylish = theme === 'stylish';
  const isAdvGst = theme === 'adv_gst';
  const isBillBook = theme === 'billbook';
  const isModern = theme === 'modern';
  const isSimple = theme === 'simple';
  const isCultureUp = theme === 'culture_up';
  const isCultureGod = theme === 'culture_god';

  // ── ThemeStore Background Art & Decorative Motifs ──
  const decoId = template.decorativeThemeId || (
    template.themeName === "jain" ? "ts-jain" :
    template.themeName === "maharashtra" ? "ts-maharashtra" :
    template.themeName === "ganesh" ? "ts-ganesh" :
    template.themeName === "hindu_god" ? "ts-hindu-god" :
    template.themeName === "shubh_labh" ? "ts-shubh-labh" :
    template.themeName === "royal_gold" ? "ts-royal-gold" :
    template.themeName === "corporate" ? "ts-corporate" : undefined
  );
  const isJain = decoId === "ts-jain";
  const isMaharashtra = decoId === "ts-maharashtra";
  const isGanesh = decoId === "ts-ganesh";
  const isHinduGod = decoId === "ts-hindu-god";
  const isShubhLabh = decoId === "ts-shubh-labh";
  const isRoyalGold = decoId === "ts-royal-gold";
  const isCorporate = decoId === "ts-corporate";

  const isDecorativeTheme = isJain || isMaharashtra || isGanesh || isHinduGod || isShubhLabh || isRoyalGold || isCultureGod || isCultureUp;

  const primaryColor = template.primaryColor || (isLuxury ? '#b45309' : isTally ? '#0f172a' : isAdvGst ? '#16a34a' : isModern ? '#475569' : '#2563eb');
  const fontFamily = template.fontFamily || (isLuxury || isModern ? 'Outfit, sans-serif' : 'Inter, sans-serif');

  // ── Dynamic Multi-Tenant Organization & Template Data Resolution ─────
  const tenantRaw = (tenant as any)?.raw || {};
  const tenantSettings = (tenant as any)?.settings || tenantRaw?.settings || {};
  const activeBillingGst = getActiveBillingGst(tenant?.id);

  let activeCompFromStorage: any = null;
  try {
    const tid = tenant?.id || getTenantIdFromStorage();
    const raw =
      (tid ? localStorage.getItem(`bos_active_company_${tid}`) : null) ||
      localStorage.getItem('bos_active_company');
    if (raw) {
      const parsed = JSON.parse(raw);
      activeCompFromStorage = parsed?.raw || parsed;
    }
  } catch {}

  const currentOrg = liveCompanyData || activeCompFromStorage || tenantRaw || {};

  const isDummyStoreName = (name?: string | null): boolean => {
    if (!name || typeof name !== 'string') return true;
    const lower = name.trim().toLowerCase();
    return (
      lower.includes('acme') ||
      lower.includes('luxury store') ||
      lower.includes('lazymonkey') ||
      lower.includes('business organization') ||
      lower.includes('default store') ||
      lower.includes('sample store') ||
      lower === 'company' ||
      lower === 'organization' ||
      lower === 'my workspace' ||
      lower === 'main workspace' ||
      lower === 'head office' ||
      lower === 'venatic' ||
      lower === 'businessos store'
    );
  };

  const isDummyAddress = (addr?: string | null): boolean => {
    if (!addr || typeof addr !== 'string') return true;
    const lower = addr.trim().toLowerCase();
    return (
      lower.includes('kk street') ||
      lower.includes('madanapalli') ||
      lower.includes('proddatur') ||
      lower.includes('cuddapah') ||
      lower.includes('123 commercial hub') ||
      lower.includes('royal avenue') ||
      lower.includes('heritage plaza') ||
      lower.includes('sector 18, noida') ||
      lower.includes('state, india') ||
      lower.includes('cauvery block') ||
      lower.includes('national games village')
    );
  };

  const isDummyGstin = (gstin?: string | null): boolean => {
    if (!gstin || typeof gstin !== 'string') return true;
    const clean = gstin.trim().toUpperCase();
    return (
      clean.includes('37AAFFK3904H2ZA') ||
      clean.includes('37AAFCOE694G1Z4') ||
      clean.includes('37AABCCH694G1Z4') ||
      clean.includes('27AABCU9603R1ZM') ||
      clean.includes('29AAACH7489R1ZX') ||
      clean.includes('36AAFCG6041L1Z') ||
      clean === 'GSTIN' ||
      clean === '29ABCDE1234F1Z5'
    );
  };

  const isDummyPhone = (phone?: string | null): boolean => {
    if (!phone || typeof phone !== 'string') return true;
    const clean = phone.replace(/[^0-9]/g, '');
    return clean.includes('9849344919') || clean.includes('0849344919') || clean === '919876543210' || clean === '9876543210';
  };

  const isDummyEmail = (email?: string | null): boolean => {
    if (!email || typeof email !== 'string') return true;
    const clean = email.toLowerCase().trim();
    return clean.includes('venatic.store') || clean.includes('billing@venatic.com') || clean.includes('support@businessos.ai');
  };

  // 1. Store Name / Company Name Resolution
  //    Priority: invoice party name → active workspace company (live API + localStorage) → billing GST → tenant name.
  //    The template's baked-in storeName is never used as a source of truth for the company name —
  //    it may have been saved under a different workspace and is stale.
  const invoiceSellerName =
    (invoice as any)?.seller_name ||
    (invoice as any)?.seller_trade_name ||
    (invoice as any)?.company_name ||
    (invoice as any)?.companyName ||
    (invoice as any)?.store_name ||
    (invoice as any)?.storeName;

  const dynamicStoreName =
    (!isDummyStoreName(invoiceSellerName) ? invoiceSellerName : '') ||
    (!isDummyStoreName(currentOrg?.name) ? currentOrg?.name : '') ||
    (!isDummyStoreName(currentOrg?.trade_name) ? currentOrg?.trade_name : '') ||
    (!isDummyStoreName(activeBillingGst?.trade_name) ? activeBillingGst?.trade_name : '') ||
    (!isDummyStoreName(activeBillingGst?.legal_name) ? activeBillingGst?.legal_name : '') ||
    (!isDummyStoreName(tenant?.name) ? tenant?.name : '') ||
    '';

  // 2. Logo Resolution (Active organization company logo strictly isolated per workspace)
  const invoiceSellerLogo =
    (invoice as any)?.seller_logo_url ||
    (invoice as any)?.seller_logo ||
    (invoice as any)?.company_logo ||
    (invoice as any)?.companyLogo;

  const isTemplateLogoCustom = Boolean(
    template.logoUrl &&
    template.logoUrl.trim() !== '' &&
    !template.logoUrl.includes('default') &&
    !template.logoUrl.includes('/Logo.png') &&
    template.storeName &&
    dynamicStoreName &&
    template.storeName.toLowerCase().trim() === dynamicStoreName.toLowerCase().trim()
  );

  const activeLogo =
    invoiceSellerLogo ||
    currentOrg?.logo_url ||
    activeBillingGst?.logo_url ||
    tenant?.logo_url ||
    tenantRaw?.logo_url ||
    (tenant as any)?.raw?.logo_url ||
    (isTemplateLogoCustom ? template.logoUrl : null) ||
    null;

  const dynamicLogoUrl = resolveImageUrl(activeLogo || '') || '';

  // 3. Address Resolution
  const invoiceSellerAddress =
    (invoice as any)?.seller_address ||
    (invoice as any)?.company_address ||
    (invoice as any)?.companyAddress ||
    (invoice as any)?.store_address ||
    (invoice as any)?.storeAddress ||
    '';

  const tenantAddressFormatted = [
    tenantRaw?.address || tenantSettings?.address,
    tenantRaw?.city || tenantSettings?.city,
    tenantRaw?.state || tenantSettings?.state,
    tenantRaw?.postal_code || tenantSettings?.pincode,
  ].filter(Boolean).join(', ');

  const currentOrgAddress =
    currentOrg?.address ||
    [currentOrg?.city, currentOrg?.state, currentOrg?.country, currentOrg?.pincode || currentOrg?.postal_code].filter(Boolean).join(', ');

  const dynamicAddress =
    (!isDummyAddress(invoiceSellerAddress) ? (typeof invoiceSellerAddress === 'string' ? invoiceSellerAddress : formatPartyAddress(invoiceSellerAddress)) : '') ||
    (!isDummyAddress(currentOrgAddress) ? currentOrgAddress : '') ||
    (!isDummyAddress(activeBillingGst?.address) ? activeBillingGst?.address : '') ||
    (!isDummyAddress(tenantAddressFormatted) ? tenantAddressFormatted : '') ||
    currentOrgAddress ||
    '';

  // 4. Phone Resolution
  const invoiceSellerPhone =
    (invoice as any)?.seller_phone ||
    (invoice as any)?.company_phone ||
    (invoice as any)?.companyPhone ||
    (invoice as any)?.store_phone ||
    (invoice as any)?.storePhone;

  const dynamicPhone =
    (!isDummyPhone(invoiceSellerPhone) ? invoiceSellerPhone : '') ||
    (!isDummyPhone(currentOrg?.phone) ? currentOrg?.phone : '') ||
    (!isDummyPhone(activeBillingGst?.phone) ? activeBillingGst?.phone : '') ||
    (!isDummyPhone(tenantRaw?.phone || tenantSettings?.phone) ? (tenantRaw?.phone || tenantSettings?.phone) : '') ||
    '';

  // 5. Email Resolution
  const invoiceSellerEmail =
    (invoice as any)?.seller_email ||
    (invoice as any)?.company_email ||
    (invoice as any)?.companyEmail ||
    (invoice as any)?.store_email ||
    (invoice as any)?.storeEmail;

  const dynamicEmail =
    (!isDummyEmail(invoiceSellerEmail) ? invoiceSellerEmail : '') ||
    (!isDummyEmail(currentOrg?.email) ? currentOrg?.email : '') ||
    (!isDummyEmail(activeBillingGst?.email) ? activeBillingGst?.email : '') ||
    (!isDummyEmail(tenantRaw?.email || tenantSettings?.email) ? (tenantRaw?.email || tenantSettings?.email) : '') ||
    '';

  // 6. GSTIN Resolution
  const invoiceSellerGstin =
    (invoice as any)?.seller_gstin ||
    (invoice as any)?.seller_gst ||
    (invoice as any)?.gstin ||
    (invoice as any)?.company_gstin ||
    (invoice as any)?.companyGstin;

  const currentOrgGstin =
    currentOrg?.gstin ||
    currentOrg?.gst_number ||
    (currentOrg?.gst_registrations?.find((r: any) => r.is_primary) || currentOrg?.gst_registrations?.[0])?.gstin ||
    '';

  const dynamicGstin =
    (
      (!isDummyGstin(invoiceSellerGstin) ? invoiceSellerGstin : '') ||
      (!isDummyGstin(currentOrgGstin) ? currentOrgGstin : '') ||
      (!isDummyGstin(activeBillingGst?.gstin) ? activeBillingGst?.gstin : '') ||
      (!isDummyGstin(tenantRaw?.gst_number || tenantRaw?.gstin) ? (tenantRaw?.gst_number || tenantRaw?.gstin) : '') ||
      currentOrgGstin ||
      ''
    ).trim().toUpperCase();

  const sellerGstin = dynamicGstin;
  const sellerState = extractGstState(
    sellerGstin,
    dynamicAddress,
    activeBillingGst?.state_name || tenantRaw?.state || tenantSettings?.state
  );
  const sellerStateCode = sellerState.code;

  // 7. Bank Details Resolution
  const dynamicBank = (() => {
    if (invoice?.bank_details && String(invoice.bank_details).trim().length > 3) return invoice.bank_details;
    if (invoice?.bank_account) {
      const b = invoice.bank_account;
      return `Bank: ${b.bank_name || b.name} | A/C: ${b.account_number} | IFSC: ${b.ifsc_code}${b.branch_name ? ` | Branch: ${b.branch_name}` : ""}`;
    }
    if (liveCompanyData?.bank_details && String(liveCompanyData.bank_details).trim().length > 3) return liveCompanyData.bank_details;
    if (liveCompanyData?.bank_name && (liveCompanyData?.bank_account_number || liveCompanyData?.account_number)) {
      return `Bank: ${liveCompanyData.bank_name} | A/C: ${liveCompanyData.bank_account_number || liveCompanyData.account_number} | IFSC: ${liveCompanyData.bank_ifsc || liveCompanyData.ifsc_code || ''} ${liveCompanyData.bank_branch || liveCompanyData.branch_name ? `| Branch: ${liveCompanyData.bank_branch || liveCompanyData.branch_name}` : ''}`;
    }
    if (activeBillingGst?.bank_name && (activeBillingGst?.bank_account_number || activeBillingGst?.bank_ifsc)) {
      return `Bank: ${activeBillingGst.bank_name} | A/C: ${activeBillingGst.bank_account_number || ''} | IFSC: ${activeBillingGst.bank_ifsc || ''}`;
    }
    if (customTemplate?.bankDetails) return customTemplate.bankDetails;
    const rawTplBank = (template.bankDetails || '').trim();
    const isTplDummy = !rawTplBank ||
      rawTplBank.includes('334455667788') ||
      rawTplBank.includes('TEST') ||
      rawTplBank.includes('000405102030') ||
      rawTplBank.includes('000405103000') ||
      rawTplBank.includes('502000492811') ||
      rawTplBank.includes('912010023456') ||
      rawTplBank.includes('SBIN0001234') ||
      rawTplBank.toLowerCase().includes('dummy');

    if (!isTplDummy && rawTplBank.length > 5) return rawTplBank;
    if (tenantRaw?.bank_details) return tenantRaw.bank_details;
    if (tenantSettings?.bank_details) return tenantSettings.bank_details;
    if (tenantRaw?.bank_name && tenantRaw?.account_number) {
      return `Bank: ${tenantRaw.bank_name} | A/C: ${tenantRaw.account_number} | IFSC: ${tenantRaw.ifsc_code || ''} ${tenantRaw.branch_name ? `| Branch: ${tenantRaw.branch_name}` : ''}`;
    }
    return '';
  })();

  const hasRealBank = Boolean(dynamicBank && dynamicBank.length > 3 && (customTemplate?.fields?.showBankDetails ?? f.showBankDetails !== false));

  // Google review resolution - STRICTLY opt-in:
  // Must be explicitly enabled on active billing GST / tenant AND have a real non-dummy URL.
  const rawReviewUrl = fetchedReviewUrl || activeBillingGst?.google_review_url || tenantRaw?.google_review_url || tenantSettings?.google_review_url || null;
  const isDummyReviewUrl = !rawReviewUrl || rawReviewUrl.includes('ChIJN1t_tDeuEmsRUsoyG83frY4') || rawReviewUrl.trim() === '' || rawReviewUrl === 'https://search.google.com/local/writereview';
  const isReviewEnabled = Boolean(activeBillingGst?.google_review_enabled === true || tenantRaw?.google_review_enabled === true);
  const googleReviewUrl = (!isDummyReviewUrl && isReviewEnabled) ? rawReviewUrl : null;
  const showGoogleReview = Boolean(googleReviewUrl && isReviewEnabled);

  // 1. Group / aggregate identical items
  const rawItems = invoice.items || [];
  const items = rawItems.reduce((acc: typeof rawItems, item) => {
    const pId = item.product_id || "";
    const pName = (item.product_name || "").trim().toLowerCase();
    const price = Number(item.unit_price || 0);
    const tax = Number(item.tax_rate || 0);
    const note = (item.custom_note || item.description || item.notes || "").trim();

    const isFree = isInvoiceLineFree(item);
    const existing = acc.find(
      (x) =>
        isInvoiceLineFree(x) === isFree &&
        ((pId && x.product_id === pId && Number(x.unit_price) === price && (x.custom_note || x.description || x.notes || "").trim() === note) ||
        (!pId && (x.product_name || "").trim().toLowerCase() === pName && Number(x.unit_price) === price && Number(x.tax_rate) === tax && (x.custom_note || x.description || x.notes || "").trim() === note))
    );

    if (existing) {
      existing.quantity = Number(existing.quantity || 0) + Number(item.quantity || 0);
      existing.discount_value = Number(existing.discount_value || 0) + Number(item.discount_value || 0);
    } else {
      acc.push({
        ...item,
        description: item.description || item.custom_note || item.notes || '',
        custom_note: item.custom_note || item.description || item.notes || '',
        notes: item.notes || item.custom_note || item.description || '',
      });
    }
    return acc;
  }, []);

  // 2. GST State Detection
  const rawBilling = invoice.customerBillingAddress || invoice.customerAddress || invoice.billing_address || (invoice as any).customer_billing_address;
  const billingAddr = formatPartyAddress(rawBilling) || formatPartyAddress({
    street: typeof rawBilling === 'string' ? rawBilling : (rawBilling?.street || ''),
    city: (invoice as any).billing_city || (invoice as any).city,
    state: invoice.customerState || (invoice as any).billing_state,
    pincode: (invoice as any).billing_pincode || (invoice as any).postal_code,
  }) || (typeof rawBilling === 'string' && rawBilling !== '[object Object]' ? rawBilling : '');

  const rawShipping = invoice.customerShippingAddress || invoice.shipping_address || (invoice as any).customer_shipping_address;
  const shippingAddr = formatPartyAddress(rawShipping) || formatPartyAddress({
    street: typeof rawShipping === 'string' ? rawShipping : (rawShipping?.street || ''),
    city: (invoice as any).shipping_city,
    state: (invoice as any).shipping_state || invoice.customerState,
    pincode: (invoice as any).shipping_pincode,
  }) || (typeof rawShipping === 'string' && rawShipping !== '[object Object]' ? rawShipping : '') || billingAddr;

  const customerState = extractGstState(
    invoice.customerGST,
    shippingAddr || billingAddr,
    invoice.customerState || invoice.shipping_state || invoice.billing_state || invoice.customer_state || invoice.state,
    sellerState
  );

  const isInterState = Boolean(
    invoice.gst_type === 'igst' ||
    invoice.is_interstate === true ||
    (sellerState.code && customerState.code && sellerState.code !== customerState.code)
  );

  // 3. Tax & GST Breakdown Calculation
  const gstBreakdown = computeGstBreakdown(
    items,
    isInterState,
    sellerState,
    customerState
  );

  let calculatedDiscount = 0;
  items.forEach((item) => {
    const qty = Number(item.quantity || 0);
    const price = Number(item.unit_price || 0);
    const discVal = Number(item.discount_value || 0);
    const disc = item.discount_type === 'percent'
      ? (qty * price * discVal / 100)
      : discVal;
    calculatedDiscount += disc;
  });

  const totalTax = Number(
    invoice.tax_amount !== undefined && Number(invoice.tax_amount) > 0
      ? invoice.tax_amount
      : (invoice.cgst_amount || invoice.sgst_amount || invoice.igst_amount
          ? (Number(invoice.cgst_amount || 0) + Number(invoice.sgst_amount || 0) + Number(invoice.igst_amount || 0))
          : gstBreakdown.totalTax)
  );

  const taxableSubtotal = Number(
    invoice.taxable_value !== undefined && Number(invoice.taxable_value) > 0
      ? invoice.taxable_value
      : gstBreakdown.totalTaxable
  );

  const grandTotal = Number(invoice.grand_total !== undefined ? invoice.grand_total : (taxableSubtotal + totalTax));
  const totalDiscount = Number(invoice.discount_amount !== undefined ? invoice.discount_amount : calculatedDiscount);
  const totalQtyBilled = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const dominantTaxRate = gstBreakdown.slabsBreakdown.length > 0 ? gstBreakdown.slabsBreakdown[0].rate : 18;
  const halfTaxRate = dominantTaxRate / 2;

  const cgstAmount = invoice.cgst_amount !== undefined ? Number(invoice.cgst_amount) : gstBreakdown.totalCgst;
  const sgstAmount = invoice.sgst_amount !== undefined ? Number(invoice.sgst_amount) : gstBreakdown.totalSgst;
  const igstAmount = invoice.igst_amount !== undefined ? Number(invoice.igst_amount) : gstBreakdown.totalIgst;

  // ── Payment QR & Paid-in-Full Smart Resolution ────────────────────
  const paymentQrSettings = getOrgPaymentQrSettings(tenant?.id);
  const amountReceived = Number(invoice.amount_received ?? invoice.paid_amount ?? 0);
  const isPaidInFull = Boolean(
    invoice.status?.toUpperCase() === 'PAID' ||
    invoice.payment_status?.toUpperCase() === 'PAID' ||
    (amountReceived > 0 && amountReceived >= (grandTotal - 0.05))
  );
  const balanceDue = isPaidInFull ? 0 : Math.max(0, grandTotal - amountReceived);

  const shouldPrintPaymentQr = Boolean(
    invoice.print_payment_qr !== false &&
    paymentQrSettings.enabled
  );

  const resolvedUpiVpa = (invoice.upi_vpa || paymentQrSettings.vpa || activeBillingGst?.upi_vpa || '').trim();
  const targetAmount = balanceDue > 0 ? balanceDue : grandTotal;
  const upiIntentUrl = resolvedUpiVpa
    ? buildUpiPayUrl({
        vpa: resolvedUpiVpa,
        payeeName: paymentQrSettings.payeeName || dynamicStoreName,
        amount: targetAmount,
        invoiceNumber: invoice.invoice_number || invoice.quote_number || 'INV',
      })
    : '';

  const paymentQrSrc = shouldPrintPaymentQr
    ? (paymentQrSettings.type === 'custom_image' && paymentQrSettings.customImageUrl
        ? paymentQrSettings.customImageUrl
        : (upiIntentUrl ? generateQRCodeSVG(upiIntentUrl, 160) : ''))
    : '';

  const handlePrint = () => {
    const container = printContainerRef.current;
    if (typeof window === 'undefined' || !container) {
      window.print();
      return;
    }

    try {
      // Create isolated printing iframe to prevent background/modal overlay blanking
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.setAttribute('title', 'A4 Invoice Print Frame');
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!doc) {
        window.print();
        return;
      }

      const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style:not(#thermal-print-style-tag)'))
        .map((el) => el.outerHTML)
        .join('\n');

      const invoiceHtml = container.outerHTML.trim();

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${(invoice?.doc_type === 'quotation' || invoice?.invoice_type === 'QUOTATION' || String(invoice?.invoice_number || '').toUpperCase().startsWith('QT-')) ? 'Tax Quotation' : (invoice?.doc_type === 'estimate' || invoice?.invoice_type === 'ESTIMATE_NON_GST' || String(invoice?.invoice_number || '').toUpperCase().startsWith('EST-')) ? 'Tax Estimate' : 'Tax Invoice'} - ${invoice?.invoice_number || 'Document'}</title>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
            ${styles}
            <style>
              @page {
                size: A4 portrait !important;
                margin: 4mm 6mm !important;
              }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                box-sizing: border-box !important;
              }
              html, body {
                width: 100% !important;
                height: auto !important;
                min-height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
                overflow: visible !important;
                display: block !important;
                visibility: visible !important;
              }
              body > * {
                display: block !important;
                visibility: visible !important;
              }
              #a4-invoice-portal {
                display: block !important;
                visibility: visible !important;
                position: static !important;
                width: 100% !important;
                height: auto !important;
                min-height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
                overflow: visible !important;
              }
              #a4-invoice-printable-area {
                display: block !important;
                visibility: visible !important;
                position: static !important;
                width: 100% !important;
                max-width: 100% !important;
                height: auto !important;
                min-height: 0 !important;
                min-height: auto !important;
                margin: 0 auto !important;
                padding: 0 !important;
                background: #ffffff !important;
                box-shadow: none !important;
                border-radius: 0 !important;
                border: none !important;
                overflow: visible !important;
                page-break-after: auto !important;
                break-after: auto !important;
                page-break-inside: auto !important;
                break-inside: auto !important;
              }
              #a4-invoice-printable-area > *:last-child {
                margin-bottom: 0 !important;
                padding-bottom: 0 !important;
              }
              #a4-invoice-printable-area * {
                visibility: visible !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              tr {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .print\\:hidden, .no-print {
                display: none !important;
                visibility: hidden !important;
              }
              .grid { display: grid !important; }
              .grid-cols-2 { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
              .grid-cols-3 { display: grid !important; grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
              .grid-cols-4 { display: grid !important; grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
              .grid-cols-12 { display: grid !important; grid-template-columns: repeat(12, minmax(0, 1fr)) !important; }
              .col-span-7 { grid-column: span 7 / span 7 !important; }
              .col-span-5 { grid-column: span 5 / span 5 !important; }
              .flex { display: flex !important; }
              .border-l { border-left-width: 1px !important; }
            </style>
          </head>
          <body><div id="a4-invoice-portal">${invoiceHtml}</div></body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error("Iframe print error, falling back to window.print:", e);
          document.body.classList.add('printing-a4-invoice');
          window.print();
          setTimeout(() => document.body.classList.remove('printing-a4-invoice'), 1500);
        } finally {
          setTimeout(() => {
            try {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
            } catch {}
          }, 3000);
        }
      }, 450);
    } catch (e) {
      console.warn("Iframe initialization failed, using standard window.print:", e);
      document.body.classList.add('printing-a4-invoice');
      window.print();
      setTimeout(() => document.body.classList.remove('printing-a4-invoice'), 1500);
    }
  };

  const modalJSX = (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait !important; margin: 4mm 6mm !important; }
          html, body { width: 100% !important; height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; background: #ffffff !important; color: #000000 !important; overflow: visible !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body > *:not(#a4-invoice-portal), #root, header, nav, footer, .no-print, [data-no-print] { display: none !important; visibility: hidden !important; }
          #a4-invoice-portal { display: block !important; visibility: visible !important; position: static !important; width: 100% !important; height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; background: #ffffff !important; color: #000000 !important; overflow: visible !important; }
          #a4-invoice-portal > div { display: block !important; position: static !important; width: 100% !important; max-width: none !important; max-height: none !important; height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; background: #ffffff !important; border: none !important; box-shadow: none !important; border-radius: 0 !important; overflow: visible !important; }
          #a4-invoice-portal .print\\:hidden { display: none !important; visibility: hidden !important; }
          #a4-invoice-printable-area { display: block !important; visibility: visible !important; position: static !important; width: 100% !important; max-width: 100% !important; height: auto !important; min-height: 0 !important; min-height: auto !important; margin: 0 auto !important; padding: 0 !important; background: #ffffff !important; box-shadow: none !important; border-radius: 0 !important; border: none !important; overflow: visible !important; page-break-after: auto !important; break-after: auto !important; page-break-inside: auto !important; break-inside: auto !important; }
          #a4-invoice-printable-area > *:last-child { margin-bottom: 0 !important; padding-bottom: 0 !important; }
          #a4-invoice-printable-area * { visibility: visible !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          tr { page-break-inside: avoid !important; break-inside: avoid !important; }
          .grid { display: grid !important; }
          .grid-cols-2 { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .grid-cols-3 { display: grid !important; grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
          .grid-cols-4 { display: grid !important; grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
          .grid-cols-12 { display: grid !important; grid-template-columns: repeat(12, minmax(0, 1fr)) !important; }
          .col-span-7 { grid-column: span 7 / span 7 !important; }
          .col-span-5 { grid-column: span 5 / span 5 !important; }
          .flex { display: flex !important; }
          .border-l { border-left-width: 1px !important; }
        }
      `}</style>

      <div
        id="a4-invoice-portal"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto print:static print:inset-auto print:p-0 print:m-0 print:w-full print:h-auto print:overflow-visible print:bg-white print:backdrop-blur-none"
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[92vh] max-h-[92vh] flex flex-col overflow-hidden print:static print:w-full print:max-w-none print:max-h-none print:h-auto print:overflow-visible print:shadow-none print:border-none print:rounded-none print:m-0 print:p-0 print:bg-white">
          
          <div className="px-6 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-xl">
                <Printer className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  {invoice?.header_title
                    ? `${invoice.header_title} (A4 Format)`
                    : (invoice?.doc_type === 'quotation' || invoice?.invoice_type === 'QUOTATION' || String(invoice?.invoice_number || '').toUpperCase().startsWith('QT-'))
                    ? 'TAX QUOTATION / ESTIMATE (A4 Format)'
                    : (invoice?.doc_type === 'estimate' || invoice?.invoice_type === 'ESTIMATE_NON_GST' || String(invoice?.invoice_number || '').toUpperCase().startsWith('EST-'))
                    ? 'TAX ESTIMATE / ESTIMATE (A4 Format)'
                    : (invoice?.doc_type === 'proforma' || invoice?.invoice_type === 'proforma' || invoice?.invoice_type === 'PROFORMA')
                    ? 'Proforma Invoice Preview (A4 Format)'
                    : 'Tax Invoice Preview (A4 Format)'}
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                    {dynamicStoreName}
                  </span>
                </h3>
                <div className="text-xs text-slate-300 flex flex-wrap items-center gap-2 mt-0.5">
                  <select
                    value={selectedTemplateId || template.id}
                    onChange={(e) => {
                      const newTplId = e.target.value;
                      setSelectedTemplateId(newTplId);
                      setActiveInvoicePrintTemplate(newTplId, tenant?.id);
                      invoicesApi.setActivePrintTemplate(newTplId).catch(() => {});
                      printTemplatesApi.setActiveTemplate(newTplId, 'invoices').catch(() => {});
                      if (invoice) {
                        invoice.print_template_id = newTplId;
                        invoice.template_id = newTplId;
                        try {
                          const tid = tenant?.id || 'default';
                          const posStorageKey = `pos_saved_invoices_${tid}`;
                          const stored = localStorage.getItem(posStorageKey) || localStorage.getItem('pos_saved_invoices');
                          if (stored) {
                            const list = JSON.parse(stored);
                            const updated = list.map((r: any) => {
                              if ((invoice.id && r.id === invoice.id) || (invoice.invoice_number && r.invoice_number === invoice.invoice_number)) {
                                return { ...r, print_template_id: newTplId, template_id: newTplId };
                              }
                              return r;
                            });
                            localStorage.setItem(posStorageKey, JSON.stringify(updated));
                            localStorage.setItem('pos_saved_invoices', JSON.stringify(updated));
                          }
                        } catch {}
                      }
                      toast.success("Applied invoice template across system!");
                    }}
                    className="bg-slate-800 text-blue-300 border border-slate-700 rounded px-2 py-0.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    {(() => {
                      const list = [...availableTemplates];
                      BUILTIN_INVOICE_OPTIONS.forEach((def) => {
                        if (!list.some((t) => t.id === def.id)) {
                          list.push(def as any);
                        }
                      });
                      const builtinIds = new Set(BUILTIN_INVOICE_OPTIONS.map((b) => b.id));
                      const wordTplIds = new Set(BUILTIN_INVOICE_OPTIONS.filter((b) => b.isWordTemplate).map((b) => b.id));
                      const wordTplOrder = new Map<string, number>(
                        BUILTIN_INVOICE_OPTIONS.filter((b) => b.isWordTemplate).map((b, i) => [b.id, i])
                      );
                      const activeId = selectedTemplateId || template.id;
                      const getRank = (t: any): number => {
                        if (t.id === activeId) return 0;          // active first
                        const isUserDesigned = Boolean(t.wordConfig) || !builtinIds.has(t.id);
                        if (isUserDesigned) return 1;             // user-saved next
                        if (wordTplIds.has(t.id)) return 2 + (wordTplOrder.get(t.id) ?? 99); // word studio
                        return 200;                               // built-ins last
                      };
                      list.sort((a, b) => getRank(a) - getRank(b));
                      return list.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} {t.isDefault ? '(Org Default)' : ''}
                        </option>
                      ));
                    })()}
                  </select>

                  <select
                    value={invoiceCopyType}
                    onChange={(e) => setInvoiceCopyType(e.target.value)}
                    className="bg-slate-800 text-purple-300 border border-slate-700 rounded px-2 py-0.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                  >
                    <option value="ORIGINAL FOR RECIPIENT">Original for Recipient</option>
                    <option value="DUPLICATE COPY">Duplicate Copy (Transporter/Record)</option>
                    <option value="TRIPLICATE COPY">Triplicate Copy (Supplier/Record)</option>
                    <option value="OFFICE COPY">Office Record Copy</option>
                    <option value="EXTRA COPY">Extra Copy</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => isPurchaseDoc ? setIsPurchaseSettingsOpen(true) : setIsSalesSettingsOpen(true)}
                className="px-3 py-2 text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                title={isPurchaseDoc ? "Configure Purchase Invoice columns (add/remove), sequence series, terms & layout" : "Configure Sales Invoice columns, series & terms"}
              >
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>{isPurchaseDoc ? "Columns & Settings" : "Invoice Settings"}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsWordStudioOpen(true)}
                className="px-3 py-2 text-xs font-bold bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-400/30 rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                title="Design invoice in visual studio: customize fonts, colors, sections, logo & layout"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                <span>Design Invoice</span>
              </button>
              <button
                onClick={handleSendWhatsApp}
                disabled={isSendingWhatsApp}
                className="px-3 py-2 text-xs font-bold bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                title="Send invoice PDF directly to Customer WhatsApp"
              >
                {isSendingWhatsApp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
                <span>WhatsApp</span>
              </button>
              <button
                onClick={handleSendEmail}
                disabled={isSendingEmail}
                className="px-3 py-2 text-xs font-bold bg-sky-700/80 hover:bg-sky-600 text-white rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                title="Send invoice PDF directly to Customer Email"
              >
                {isSendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                <span>Email</span>
              </button>
              <button
                onClick={() => setIsPdfOverlayModalOpen(true)}
                className="px-3 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                title="Upload your exact scanned invoice or bill PDF and calibrate fields without regenerating"
              >
                <Upload className="w-3.5 h-3.5 text-blue-400" /> Upload Bill PDF
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-600/30 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
                title="Open system print dialog to Save as PDF or print to physical A4 printer"
              >
                <Printer className="w-4 h-4" /> Save as PDF / Print
              </button>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-8 bg-slate-200/80 print:static print:w-full print:h-auto print:overflow-visible print:bg-white print:p-0 print:m-0 flex justify-center">
            <div
              id="a4-invoice-printable-area"
              ref={printContainerRef}
              className={`mx-auto bg-white relative overflow-visible ${
                isWordTemplate
                  ? 'p-0 max-w-[794px] w-full border-0 shadow-none bg-transparent'
                  : isCustomReplica
                  ? 'p-1 md:p-2 max-w-4xl'
                  : 'p-6 md:p-10 max-w-[794px] w-full min-h-[1080px] print:min-h-0 print:h-auto space-y-4 print:space-y-2 shadow-2xl rounded-xl border border-slate-200'
              } text-slate-900 text-xs print:static print:w-full print:max-w-none print:shadow-none print:rounded-none print:border-none print:p-0 print:m-0 print:min-h-0 print:h-auto ${
                !isWordTemplate && !isCustomReplica && isTally ? 'border-2 border-double border-slate-900' : ''
              }`}
              style={{
                fontFamily: fontFamily,
                backgroundColor: isWordTemplate ? "transparent" : template.paperBgColor || (isDecorativeTheme ? "#fffdf5" : "#ffffff"),
                borderTop: !isWordTemplate && !isCustomReplica && (isStylish || isCultureUp || isCultureGod || isJain || isMaharashtra || isGanesh || isHinduGod || isShubhLabh || isRoyalGold) ? `6px solid ${primaryColor}` : undefined,
              }}
            >
              <InvoiceErrorBoundary onReset={() => setSelectedTemplateId('tpl-word-default')}>
                {/* ThemeStore Cultural & Auspicious Header Banners */}
                {!isWordTemplate && isJain && (
                <div className="text-center text-[10px] font-bold tracking-widest text-amber-800 bg-amber-100/70 py-1 rounded border border-amber-300/80 mb-2 shadow-2xs">
                  ॥ ॐ नमो जिनानाम् ॥ अहिंसा परमो धर्मः ॥
                </div>
              )}
              {!isWordTemplate && isMaharashtra && (
                <div className="text-center text-[10px] font-bold tracking-widest text-orange-900 bg-orange-100/80 py-1 rounded border border-orange-300/80 mb-2 shadow-2xs">
                  🚩 ॥ जय भवानी जय शिवाजी ॥ जय महाराष्ट्र ॥ 🚩
                </div>
              )}
              {!isWordTemplate && isGanesh && (
                <div className="text-center text-[10px] font-bold tracking-widest text-amber-900 bg-amber-100/80 py-1 rounded border border-amber-300/80 mb-2 shadow-2xs">
                  🕉️ ॥ श्री गणेशाय नमः ॥ ॐ गं गणपतये नमः ॥ ✨
                </div>
              )}
              {!isWordTemplate && isHinduGod && (
                <div className="text-center text-[10px] font-bold tracking-widest text-red-900 bg-red-100/70 py-1 rounded border border-red-300/80 mb-2 shadow-2xs">
                  🪷 ॥ ॐ नमो भगवते वासुदेवाय ॥ श्री महालक्ष्म्यै नमः ॥ 🪷
                </div>
              )}
              {!isWordTemplate && isShubhLabh && (
                <div className="text-center text-[10px] font-bold tracking-widest text-amber-900 bg-amber-100/70 py-1 rounded border border-amber-300/80 mb-2 shadow-2xs">
                  ✨ ॥ शुभ लाभ ॥ रिद्धि सिद्धि ॥ श्री गणेशाय नमः ॥ ✨
                </div>
              )}
              {!isWordTemplate && isRoyalGold && (
                <div className="text-center text-[10px] font-black tracking-widest text-amber-900 bg-gradient-to-r from-amber-200/60 via-yellow-100/90 to-amber-200/60 py-1 rounded border border-amber-400/80 mb-2 shadow-2xs">
                  👑 ✦ ROYAL HERITAGE {(invoice.doc_type === 'quotation' || invoice.invoice_type === 'QUOTATION' || String(invoice.invoice_number || '').toUpperCase().startsWith('QT-')) ? 'TAX QUOTATION / ESTIMATE' : (invoice.doc_type === 'estimate' || invoice.invoice_type === 'ESTIMATE_NON_GST' || String(invoice.invoice_number || '').toUpperCase().startsWith('EST-')) ? 'TAX ESTIMATE / ESTIMATE' : 'TAX INVOICE'} ✦ 👑
                </div>
              )}
              {!isWordTemplate && isCorporate && (
                <div className="text-center text-[10px] font-bold tracking-widest text-indigo-900 dark:text-indigo-200 bg-indigo-50/80 dark:bg-indigo-950/50 py-1 rounded border border-indigo-200/80 mb-2 shadow-2xs">
                  🏛️ OFFICIAL COMMERCIAL {(invoice.doc_type === 'quotation' || invoice.invoice_type === 'QUOTATION' || String(invoice.invoice_number || '').toUpperCase().startsWith('QT-')) ? 'TAX QUOTATION / ESTIMATE' : (invoice.doc_type === 'estimate' || invoice.invoice_type === 'ESTIMATE_NON_GST' || String(invoice.invoice_number || '').toUpperCase().startsWith('EST-')) ? 'TAX ESTIMATE / ESTIMATE' : 'TAX INVOICE'} · ORIGINAL 🏛️
                </div>
              )}
              {!isWordTemplate && (isCultureGod || isCultureUp) && (
                <div className="text-center text-[11px] font-bold tracking-widest text-amber-800 bg-amber-50 py-1 rounded-md border border-amber-200 mb-1">
                  {isCultureGod ? '॥ श्री गणेशाय नमः ॥ शुभ लाभ ॥' : '॥ गंगा मैया की जय ॥ उत्तर प्रदेश शासन स्वीकृत ॥'}
                </div>
              )}

              {/* Watermark Overlay */}
              {!isWordTemplate && template.showWatermark && (
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden"
                  style={{ opacity: (template.watermarkOpacity || 15) / 100 }}
                >
                  {isGanesh ? (
                    <span className="text-9xl select-none font-bold text-amber-800/40">🕉️</span>
                  ) : isJain ? (
                    <span className="text-9xl select-none font-bold text-amber-800/40">🛕</span>
                  ) : isMaharashtra ? (
                    <span className="text-9xl select-none font-bold text-orange-800/40">🚩</span>
                  ) : isHinduGod ? (
                    <span className="text-9xl select-none font-bold text-red-800/40">🪷</span>
                  ) : isShubhLabh ? (
                    <span className="text-8xl select-none font-black text-amber-800/40 tracking-wider">॥ शुभ लाभ ॥</span>
                  ) : isRoyalGold ? (
                    <span className="text-9xl select-none font-bold text-amber-800/40">👑</span>
                  ) : (
                    <span className="text-5xl font-black uppercase tracking-widest text-slate-900 -rotate-45 whitespace-nowrap">
                      {template.watermarkText || dynamicStoreName || "OFFICIAL"}
                    </span>
                  )}
                </div>
              )}

              {isWordTemplate ? (
                <WordInvoiceDocument
                  invoice={{ ...invoice, copy_type: invoiceCopyType }}
                  wordConfig={template?.wordConfig}
                  dynamicStoreName={dynamicStoreName}
                  dynamicLogoUrl={dynamicLogoUrl}
                  dynamicAddress={dynamicAddress}
                  dynamicPhone={dynamicPhone}
                  dynamicEmail={dynamicEmail}
                  sellerGstin={sellerGstin}
                  sellerStateCode={sellerStateCode}
                  dynamicBank={dynamicBank}
                  currency={currency}
                  f={f}
                  template={template}
                />
              ) : isPdfOverlay ? (
                <PdfStationeryOverlayTemplate
                  invoice={{ ...invoice, copy_type: invoiceCopyType }}
                  dynamicStoreName={dynamicStoreName}
                  dynamicLogoUrl={dynamicLogoUrl}
                  dynamicAddress={dynamicAddress}
                  dynamicPhone={dynamicPhone}
                  dynamicEmail={dynamicEmail}
                  sellerGstin={sellerGstin}
                  sellerStateCode={sellerStateCode}
                  dynamicBank={dynamicBank}
                  currency={currency}
                  f={f}
                  template={template}
                />
              ) : isMargPharma ? (
                <MargPharmaTemplate
                  invoice={{ ...invoice, copy_type: invoiceCopyType }}
                  dynamicStoreName={dynamicStoreName}
                  dynamicLogoUrl={dynamicLogoUrl}
                  dynamicAddress={dynamicAddress}
                  dynamicPhone={dynamicPhone}
                  dynamicEmail={dynamicEmail}
                  sellerGstin={sellerGstin}
                  sellerStateCode={sellerStateCode}
                  currency={currency}
                  f={f}
                />
              ) : isFmcg ? (
                <FmcgDistributorTemplate
                  invoice={{ ...invoice, copy_type: invoiceCopyType }}
                  dynamicStoreName={dynamicStoreName}
                  dynamicLogoUrl={dynamicLogoUrl}
                  dynamicAddress={dynamicAddress}
                  dynamicPhone={dynamicPhone}
                  dynamicEmail={dynamicEmail}
                  sellerGstin={sellerGstin}
                  sellerStateCode={sellerStateCode}
                  currency={currency}
                  f={f}
                />
              ) : isParle ? (
                <ParleDistributorTemplate
                  invoice={{ ...invoice, copy_type: invoiceCopyType }}
                  dynamicStoreName={dynamicStoreName}
                  dynamicLogoUrl={dynamicLogoUrl}
                  dynamicAddress={dynamicAddress}
                  dynamicPhone={dynamicPhone}
                  dynamicEmail={dynamicEmail}
                  sellerGstin={sellerGstin}
                  sellerStateCode={sellerStateCode}
                  currency={currency}
                  f={f}
                />
              ) : isAgriSeeds ? (
                <AgriSeedsTemplate
                  invoice={{ ...invoice, copy_type: invoiceCopyType }}
                  dynamicStoreName={dynamicStoreName}
                  dynamicLogoUrl={dynamicLogoUrl}
                  dynamicAddress={dynamicAddress}
                  dynamicPhone={dynamicPhone}
                  dynamicEmail={dynamicEmail}
                  sellerGstin={sellerGstin}
                  sellerStateCode={sellerStateCode}
                  dynamicBank={dynamicBank}
                  currency={currency}
                  f={f}
                />
              ) : (
                <>
                  <div
                    className={`flex items-start justify-between border-b pb-4 print:pb-2 z-10 relative ${
                      isTally ? 'border-slate-900 border-b-2' : 'border-slate-200'
                    }`}
                    style={(!isTally && !isSimple && !isModern) ? { borderBottom: `2px solid ${primaryColor}` } : {}}
                  >
                    <div className="space-y-1 max-w-[60%]">
                      {f.showLogo && (
                        <div className="flex items-center gap-3 mb-1.5">
                          <img
                            src={dynamicLogoUrl || "/Logo.png"}
                            alt="Organization Logo"
                            className="h-11 max-w-[150px] object-contain rounded-lg shadow-2xs"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = "/Logo.png";
                            }}
                          />
                          <div>
                            <h2 className="font-extrabold text-base text-slate-900 leading-tight">
                              {dynamicStoreName}
                            </h2>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                              Authorized Business Organization
                            </span>
                          </div>
                        </div>
                      )}

                      {!f.showLogo && (
                        <h2 className="font-extrabold text-lg mb-1" style={{ color: primaryColor }}>
                          {dynamicStoreName}
                        </h2>
                      )}

                      {dynamicAddress && (
                        <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                          {dynamicAddress}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-600 font-medium">
                        {dynamicPhone && <span>Ph: {dynamicPhone}</span>}
                        {dynamicEmail && <span>Email: {dynamicEmail}</span>}
                      </div>
                      {sellerGstin && (
                        <p className="text-[11px] font-bold text-slate-900">
                          GSTIN: {sellerGstin}
                        </p>
                      )}
                    </div>

                    <div className="text-right space-y-1">
                      <div className="flex items-center justify-end">
                        <span className="text-[9.5px] font-black uppercase px-2 py-0.5 rounded border border-slate-300 bg-slate-100 text-slate-800 tracking-wider shadow-2xs">
                          {invoiceCopyType || invoice.copy_type || 'ORIGINAL FOR RECIPIENT'}
                        </span>
                      </div>
                      <h1 className="text-xl font-black tracking-tight uppercase" style={{ color: primaryColor }}>
                        {invoice.header_title || (
                          (invoice.doc_type === 'quotation' || invoice.invoice_type === 'QUOTATION' || String(invoice.invoice_number || '').toUpperCase().startsWith('QT-')) ? 'TAX QUOTATION / ESTIMATE' :
                          (invoice.doc_type === 'estimate' || invoice.invoice_type === 'ESTIMATE_NON_GST' || String(invoice.invoice_number || '').toUpperCase().startsWith('EST-')) ? 'TAX ESTIMATE / ESTIMATE' :
                          (invoice.doc_type === 'proforma' || invoice.invoice_type?.toLowerCase() === 'proforma' || invoice.invoice_type === 'PROFORMA' || String(invoice.invoice_number || '').toUpperCase().startsWith('PI-')) ? 'PROFORMA INVOICE' :
                          (template.headerTitle || 'TAX INVOICE')
                        )}
                      </h1>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 inline-block text-right mt-0.5">
                        <p className="text-xs font-bold text-slate-900">
                          {(invoice.doc_type === 'quotation' || invoice.invoice_type === 'QUOTATION' || String(invoice.invoice_number || '').toUpperCase().startsWith('QT-')) ? 'Quote No:' :
                           (invoice.doc_type === 'estimate' || invoice.invoice_type === 'ESTIMATE_NON_GST' || String(invoice.invoice_number || '').toUpperCase().startsWith('EST-')) ? 'Estimate No:' :
                           (invoice.doc_type === 'proforma' || invoice.invoice_type?.toLowerCase() === 'proforma' || invoice.invoice_type === 'PROFORMA' || String(invoice.invoice_number || '').toUpperCase().startsWith('PI-')) ? 'Proforma No:' :
                           'Invoice No:'} {invoice.invoice_number || ((invoice.doc_type === 'quotation' || invoice.invoice_type === 'QUOTATION') ? '#QTN' : (invoice.doc_type === 'proforma' || invoice.invoice_type?.toLowerCase() === 'proforma' || invoice.invoice_type === 'PROFORMA') ? '#PI' : '#INV')}
                        </p>
                        <p className="text-[11px] text-slate-600 font-medium">
                          {(invoice.doc_type === 'quotation' || invoice.invoice_type === 'QUOTATION' || String(invoice.invoice_number || '').toUpperCase().startsWith('QT-')) ? 'Quote Date:' :
                           (invoice.doc_type === 'estimate' || invoice.invoice_type === 'ESTIMATE_NON_GST' || String(invoice.invoice_number || '').toUpperCase().startsWith('EST-')) ? 'Estimate Date:' :
                           'Date:'} {formatDisplayDate(invoice.invoice_date || invoice.created_at || new Date())}
                        </p>
                        {invoice.eway_bill_number && (
                          <div className="mt-1 px-2 py-0.5 bg-emerald-50 border border-emerald-300 rounded text-emerald-800 text-[10px] font-mono font-bold text-right">
                            <span className="font-sans font-extrabold uppercase text-[9px] text-emerald-950">e-Way Bill: </span>
                            {invoice.eway_bill_number}
                          </div>
                        )}
                        {f.showBarcode && invoice.invoice_number && (
                          <div className="mt-1.5 flex flex-col items-end">
                            <div className="bg-white p-1 rounded border border-slate-200 inline-block shadow-2xs">
                              <RealBarcodeSvg
                                code={invoice.invoice_number}
                                format={template.barcodeSymbology || "Code-128"}
                                height={26}
                                displayValue={false}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {f.showCustomerDetails && (() => {
                    const billingAddr = formatPartyAddress({
                      street: invoice.customerBillingAddress || invoice.customerAddress || invoice.billing_address || (invoice as any).customer_billing_address,
                      city: (invoice as any).billing_city || (invoice as any).city,
                      state: invoice.customerState || (invoice as any).billing_state,
                      pincode: (invoice as any).billing_pincode || (invoice as any).postal_code,
                    }) || invoice.customerBillingAddress || invoice.customerAddress || invoice.billing_address || '';
                    const shippingAddr = formatPartyAddress({
                      street: invoice.customerShippingAddress || invoice.shipping_address || (invoice as any).customer_shipping_address,
                      city: (invoice as any).shipping_city,
                      state: (invoice as any).shipping_state || invoice.customerState,
                      pincode: (invoice as any).shipping_pincode,
                    }) || invoice.customerShippingAddress || invoice.shipping_address || billingAddr;

                    return (
                      <div className="space-y-2 z-10 relative">
                        <div
                          className={`grid grid-cols-3 gap-3 print:gap-2 p-3 print:p-2 rounded-xl border ${
                            isModern ? 'bg-slate-50 border-slate-200' :
                            isLuxury ? 'bg-amber-50/40 border-amber-200' :
                            isTally ? 'bg-white border-slate-900' : 'bg-slate-50/80 border-slate-200'
                          }`}
                        >
                          {/* 1. Billed To Column */}
                          <div className="space-y-0.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Billed To (Customer Details)</span>
                            <h4 className="font-bold text-slate-900 text-xs">{invoice.customerName || 'Walk-in Customer'}</h4>
                            {invoice.customerCompany && <p className="text-[10px] font-semibold text-slate-700">{invoice.customerCompany}</p>}
                            {billingAddr ? (
                              <p className="text-[10px] text-slate-600 leading-tight">{billingAddr}</p>
                            ) : (
                              <p className="text-[10px] text-slate-400 italic">No billing address specified</p>
                            )}
                            {invoice.customerPhone && <p className="text-[10px] text-slate-600">Ph: {invoice.customerPhone}</p>}
                            {invoice.customerEmail && <p className="text-[10px] text-slate-600">Email: {invoice.customerEmail}</p>}
                            {invoice.customerGST && <p className="text-[10px] font-bold text-slate-800">GSTIN: {invoice.customerGST}</p>}
                            {invoice.customerPan && <p className="text-[10px] font-semibold text-slate-700">PAN: {invoice.customerPan}</p>}
                          </div>

                          {/* 2. Shipped To Column (Always clearly displayed) */}
                          <div className="space-y-0.5 border-l border-slate-200 pl-3">
                            <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider block flex items-center gap-1">
                              Shipped To (Delivery Destination)
                            </span>
                            <h4 className="font-bold text-slate-900 text-xs">{invoice.customerCompany || invoice.customerName || 'Consignee / Recipient'}</h4>
                            {shippingAddr ? (
                              <p className="text-[10px] text-slate-700 font-medium leading-tight">{shippingAddr}</p>
                            ) : (
                              <p className="text-[10px] text-slate-500 leading-tight">Same as Billing Address</p>
                            )}
                            {invoice.customerPhone && <p className="text-[10px] text-slate-600">Contact: {invoice.customerPhone}</p>}
                            {invoice.customerGST && <p className="text-[10px] font-semibold text-slate-700">GSTIN: {invoice.customerGST}</p>}
                          </div>

                          {/* 3. Place of Supply Column */}
                          <div className="text-right space-y-0.5 flex flex-col justify-between border-l border-slate-200 pl-3">
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Place of Supply</span>
                              <p className="text-[10px] font-bold text-slate-800 mt-0.5">
                                {isInterState ? `${customerState?.name || 'State'} (${customerState?.code || ''}) - Inter-State` : `${sellerState?.name || 'State'} (${sellerState?.code || ''}) - Intra-State`}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Dispatch, Transport, PO, Challan, Terms & Custom Invoice Fields Strip */}
                        {(() => {
                          const storedSettings = loadStoredInvoiceSettings();
                          const resolvedCustomFields: Array<{ name: string; value: string }> = [];

                          if (Array.isArray(invoice.invoice_custom_fields)) {
                            invoice.invoice_custom_fields.forEach((cf: any) => {
                              if (cf && (cf.name || cf.key || cf.label) && cf.enabled !== false) {
                                const fieldKey = String(cf.name || cf.key || cf.label);
                                const rawVal = cf.value !== undefined ? cf.value : (invoice[fieldKey] || invoice[cf.id] || "—");
                                resolvedCustomFields.push({
                                  name: fieldKey,
                                  value: typeof rawVal === 'object' ? JSON.stringify(rawVal) : String(rawVal ?? "—")
                                });
                              }
                            });
                          } else if (invoice.custom_fields && typeof invoice.custom_fields === 'object') {
                            if (Array.isArray(invoice.custom_fields)) {
                              invoice.custom_fields.forEach((cf: any) => {
                                if (cf && (cf.name || cf.key || cf.label)) {
                                  const name = String(cf.name || cf.key || cf.label);
                                  const rawVal = cf.value !== undefined ? cf.value : "—";
                                  resolvedCustomFields.push({
                                    name,
                                    value: typeof rawVal === 'object' ? JSON.stringify(rawVal) : String(rawVal ?? "—")
                                  });
                                }
                              });
                            } else {
                              Object.entries(invoice.custom_fields).forEach(([key, val]) => {
                                if (val !== undefined && val !== null && String(val).trim() !== '') {
                                  const displayVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
                                  resolvedCustomFields.push({ name: String(key), value: displayVal });
                                }
                              });
                            }
                          }

                          if (storedSettings?.invoiceCustomFields && Array.isArray(storedSettings.invoiceCustomFields)) {
                            storedSettings.invoiceCustomFields.forEach((f) => {
                              if (f && f.enabled && f.name && String(f.name).trim() !== "") {
                                const fName = String(f.name).trim();
                                const already = resolvedCustomFields.find(
                                  (x) => String(x.name || "").trim().toLowerCase() === fName.toLowerCase()
                                );
                                if (!already) {
                                  const customFieldsDict = (invoice.custom_fields && typeof invoice.custom_fields === "object" && !Array.isArray(invoice.custom_fields))
                                    ? (invoice.custom_fields as Record<string, any>)
                                    : null;
                                  const val = invoice[f.name] || (f.id ? invoice[f.id] : undefined) || (customFieldsDict ? (customFieldsDict[f.name] || (f.id ? customFieldsDict[f.id] : undefined)) : undefined) || f.value || "—";
                                  const displayVal = typeof val === 'object' ? JSON.stringify(val) : String(val ?? "—");
                                  resolvedCustomFields.push({ name: fName, value: displayVal });
                                }
                              }
                            });
                          }

                          const hasChallan = Boolean(invoice.challan_number || invoice.delivery_challan_number || storedSettings?.showChallanNumber);
                          const hasPaymentTerms = Boolean((storedSettings?.showPaymentTerms !== false || invoice.payment_terms || invoice.due_date) && (invoice.payment_terms || invoice.due_date));
                          const hasDispatchOrMeta = Boolean(
                            invoice.po_number ||
                            invoice.vehicle_number ||
                            invoice.driver_phone ||
                            invoice.driver_name ||
                            invoice.eway_bill_number ||
                            invoice.transporter_name ||
                            hasChallan ||
                            hasPaymentTerms ||
                            resolvedCustomFields.length > 0
                          );

                          if (!hasDispatchOrMeta) return null;

                          return (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-medium">
                              {invoice.po_number && (
                                <div className="space-y-0.5">
                                  <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block">Customer PO / Order Ref</span>
                                  <span className="font-bold text-slate-800 font-mono text-[11px] block">{invoice.po_number}</span>
                                  {invoice.po_date && <span className="text-slate-500 block text-[9px]">PO Date: {formatDisplayDate(invoice.po_date)}</span>}
                                </div>
                              )}
                              {invoice.vehicle_number && (
                                <div className="space-y-0.5">
                                  <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block">Vehicle Number</span>
                                  <span className="font-mono font-extrabold text-slate-900 text-[11px] block">{invoice.vehicle_number}</span>
                                </div>
                              )}
                              {(invoice.driver_phone || invoice.driver_name || invoice.transporter_name) && (
                                <div className="space-y-0.5">
                                  <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block">Transport / Driver</span>
                                  <span className="text-slate-800 font-bold block truncate">{invoice.transporter_name || invoice.driver_name || "Road Logistics"}</span>
                                  {invoice.driver_phone && <span className="text-slate-600 block text-[9px] font-mono">Driver Ph: {invoice.driver_phone}</span>}
                                </div>
                              )}
                              {invoice.eway_bill_number && (
                                <div className="space-y-0.5 bg-emerald-50/80 p-1 rounded-lg border border-emerald-200">
                                  <span className="text-[8.5px] font-black text-emerald-800 uppercase tracking-wider block">e-Way Bill No.</span>
                                  <span className="font-mono font-black text-emerald-950 text-[11px] block">{invoice.eway_bill_number}</span>
                                  {invoice.eway_bill_date && <span className="text-emerald-700 block text-[8.5px]">Generated: {formatDisplayDate(invoice.eway_bill_date)}</span>}
                                </div>
                              )}
                              {hasChallan && (
                                <div className="space-y-0.5">
                                  <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block">Delivery Challan No.</span>
                                  <span className="font-bold text-slate-800 font-mono text-[11px] block">{invoice.challan_number || invoice.delivery_challan_number || "—"}</span>
                                </div>
                              )}
                              {hasPaymentTerms && (
                                <div className="space-y-0.5">
                                  <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block">Payment Terms & Due Date</span>
                                  <span className="font-bold text-slate-800 text-[11px] block">
                                    {invoice.payment_terms || "Due on Receipt"} {invoice.due_date ? `(${formatDisplayDate(invoice.due_date)})` : ""}
                                  </span>
                                </div>
                              )}
                              {resolvedCustomFields.map((cf, idx) => (
                                <div key={idx} className="space-y-0.5">
                                  <span className="text-[8.5px] font-bold text-indigo-500 uppercase tracking-wider block truncate" title={String(cf.name || '')}>{String(cf.name || '')}</span>
                                  <span className="font-bold text-slate-800 text-[11px] block truncate" title={typeof cf.value === 'object' ? JSON.stringify(cf.value) : String(cf.value ?? '')}>
                                    {typeof cf.value === 'object' ? JSON.stringify(cf.value) : String(cf.value ?? '')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}

                  {/* Line Items Table */}
                  {(() => {
                    const hasProcurementColumns = isPurchaseDoc || items.some((it) =>
                      Boolean(it.uom || it.expiry_date || (it as any).exp_date || (it as any).expDate || Number(it.mrp || 0) > 0 || Number(it.selling_price || 0) > 0)
                    );

                    const formatExpDate = (raw: string | undefined | null) => {
                      if (!raw || String(raw).trim() === '' || String(raw).toLowerCase().includes('dd-mm-yyyy')) return '—';
                      try {
                        const s = String(raw).trim().split('T')[0];
                        if (s.includes('-')) {
                          const parts = s.split('-');
                          if (parts.length === 3 && parts[0].length === 4) {
                            return `${parts[2]}-${parts[1]}-${parts[0]}`;
                          }
                        }
                        return s;
                      } catch {
                        return String(raw);
                      }
                    };

                    return (
                      <div className="z-10 relative overflow-x-auto print:overflow-visible rounded-xl border border-slate-200 scrollbar-thin">
                        <table className={`w-full border-collapse text-[11px] print:text-[10px] leading-tight ${isTally ? 'border border-slate-900' : ''}`}>
                          <thead>
                            <tr
                              className="text-white text-left font-bold"
                              style={{ backgroundColor: isSimple ? '#1e293b' : primaryColor }}
                            >
                              <th className="py-2 px-1.5 print:py-1 print:px-1 w-7 text-center">#</th>
                              <th className="py-2 px-2 print:py-1 print:px-1.5 text-left">ITEMS / SERVICES</th>
                              {hasProcurementColumns ? (
                                <>
                                  {(purchaseSettings?.showHsn ?? true) && (
                                    <th className="py-2 px-1.5 print:py-1 print:px-1 text-center whitespace-nowrap">HSN/SAC</th>
                                  )}
                                  {(purchaseSettings?.showUom ?? true) && (
                                    <th className="py-2 px-1.5 print:py-1 print:px-1 text-center whitespace-nowrap">UOM</th>
                                  )}
                                  {(purchaseSettings?.showBatchNo ?? true) && (
                                    <th className="py-2 px-1.5 print:py-1 print:px-1 text-center whitespace-nowrap">BATCH</th>
                                  )}
                                  {(purchaseSettings?.showExpDate ?? true) && (
                                    <th className="py-2 px-1.5 print:py-1 print:px-1 text-center whitespace-nowrap">EXP DATE</th>
                                  )}
                                  {Boolean(purchaseSettings?.showMfgDate) && (
                                    <th className="py-2 px-1.5 print:py-1 print:px-1 text-center whitespace-nowrap">MFG DATE</th>
                                  )}
                                  {Boolean(purchaseSettings?.showMrp) && (
                                    <th className="py-2 px-1.5 print:py-1 print:px-1 text-right whitespace-nowrap">MRP ({currency.symbol})</th>
                                  )}
                                  {Boolean(purchaseSettings?.showSellPrice) && (
                                    <th className="py-2 px-1.5 print:py-1 print:px-1 text-right whitespace-nowrap">SELL PRICE ({currency.symbol})</th>
                                  )}
                                  <th className="py-2 px-1.5 print:py-1 print:px-1 text-center whitespace-nowrap">QTY</th>
                                  {(purchaseSettings?.showRate ?? true) && (
                                    <th className="py-2 px-1.5 print:py-1 print:px-1 text-right whitespace-nowrap">RATE ({currency.symbol})</th>
                                  )}
                                  {(purchaseSettings?.showDiscount ?? true) && (
                                    <th className="py-2 px-1.5 print:py-1 print:px-1 text-right whitespace-nowrap">DISC</th>
                                  )}
                                  {(purchaseSettings?.showGstTax ?? true) && (
                                    <th className="py-2 px-1.5 print:py-1 print:px-1 text-right whitespace-nowrap">GST TAX %</th>
                                  )}
                                  {Boolean(purchaseSettings?.showFreeQty) && (
                                    <th className="py-2 px-1.5 print:py-1 print:px-1 text-center whitespace-nowrap">FREE</th>
                                  )}
                                  {(purchaseSettings?.itemCustomColumns || []).filter(c => c.enabled).map(cc => (
                                    <th key={cc.id} className="py-2 px-1.5 print:py-1 print:px-1 text-center whitespace-nowrap uppercase">
                                      {cc.name}
                                    </th>
                                  ))}
                                  <th className="py-2 px-2 print:py-1 print:px-1.5 text-right whitespace-nowrap">AMOUNT ({currency.symbol})</th>
                                </>
                              ) : (
                                <>
                                  <th className="py-2 px-2 print:py-1 print:px-1.5 text-center">HSN/SAC</th>
                                  <th className="py-2 px-3 print:py-1 print:px-2 text-center">Qty</th>
                                  <th className="py-2 px-3 print:py-1 print:px-2 text-right">Unit Rate</th>
                                  <th className="py-2 px-3 print:py-1 print:px-2 text-right">Discount</th>
                                  {f.showTaxSplit && <th className="py-2 px-3 print:py-1 print:px-2 text-right">Tax Rate</th>}
                                  <th className="py-2 px-3 print:py-1 print:px-2 text-right">Amount</th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${isTally ? 'divide-slate-900' : 'divide-slate-100'} bg-white`}>
                            {items.map((item, idx) => {
                              const isFree = isInvoiceLineFree(item);
                              const qty = Number(item.quantity || 0);
                              const unitPrice = isFree ? 0 : Number(item.unit_price || 0);
                              const originalRate = Number(item.unit_price || 0);
                              const mrpPrice = Number(item.mrp || 0);
                              const sellPrice = Number(item.selling_price || item.mrp || 0);
                              const discVal = isFree ? 0 : Number(item.discount_value || 0);
                              const taxRate = isFree ? 0 : Number(item.tax_rate || 0);
                              const itemSub = isFree ? 0 : qty * unitPrice;
                              const disc = isFree ? 0 : (item.discount_type === 'percent'
                                ? (itemSub * discVal / 100)
                                : discVal);
                              const netAmount = isFree ? 0 : itemSub - disc;
                              const hsnDisplay = item.hsn_code || (item as any).hsn || (item as any).hsn_sac || '—';
                              const uomDisplay = item.selected_uom || item.uom || (item as any).measuring_unit || (item as any).unit || 'Pcs';
                              const batchDisplay = String((item as any).batch_number || (item as any).batch || '').trim();
                              const expDateDisplay = formatExpDate(item.expiry_date || (item as any).exp_date || (item as any).expDate);
                              const mfgDateDisplay = formatExpDate((item as any).mfg_date || (item as any).mfgDate || (item as any).manufacturing_date);

                              if (hasProcurementColumns) {
                                return (
                                  <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/50' : ''}>
                                    <td className="py-2 px-1.5 print:py-1 print:px-1 text-center font-bold text-slate-400">{idx + 1}</td>
                                    <td className="py-2 px-2 print:py-1 print:px-1.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-slate-900">{item.product_name || 'Item'}</span>
                                        {isFree && (
                                          <span className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded uppercase tracking-wider">
                                            FREE
                                          </span>
                                        )}
                                      </div>
                                      {(item.description || item.custom_note || item.notes) && (
                                        <span className="text-[10px] text-slate-600 block mt-0.5 whitespace-pre-line font-normal leading-tight">
                                          {item.description || item.custom_note || item.notes}
                                        </span>
                                      )}
                                      {((f.showSKU && (item.sku || (item as any).product_code)) || (f.showBarcode && (item as any).barcode)) && (
                                        <span className="text-[9px] font-mono text-slate-500 block mt-0.5">
                                          {f.showSKU && (item.sku || (item as any).product_code) && `SKU: ${item.sku || (item as any).product_code} `}
                                          {f.showBarcode && (item as any).barcode && `| Barcode: ${(item as any).barcode}`}
                                        </span>
                                      )}
                                    </td>
                                    {(purchaseSettings?.showHsn ?? true) && (
                                      <td className="py-2 px-1.5 print:py-1 print:px-1 text-center font-mono text-slate-600 text-[10px] whitespace-nowrap">{hsnDisplay}</td>
                                    )}
                                    {(purchaseSettings?.showUom ?? true) && (
                                      <td className="py-2 px-1.5 print:py-1 print:px-1 text-center font-bold text-slate-700 whitespace-nowrap">{uomDisplay}</td>
                                    )}
                                    {(purchaseSettings?.showBatchNo ?? true) && (
                                      <td className="py-2 px-1.5 print:py-1 print:px-1 text-center font-mono text-slate-600 text-[10px] whitespace-nowrap">
                                        {batchDisplay ? <span className="bg-slate-100 px-1 py-0.5 rounded border border-slate-200/50">{batchDisplay}</span> : <span className="text-slate-400">—</span>}
                                      </td>
                                    )}
                                    {(purchaseSettings?.showExpDate ?? true) && (
                                      <td className="py-2 px-1.5 print:py-1 print:px-1 text-center font-mono text-slate-600 text-[10px] whitespace-nowrap">{expDateDisplay}</td>
                                    )}
                                    {Boolean(purchaseSettings?.showMfgDate) && (
                                      <td className="py-2 px-1.5 print:py-1 print:px-1 text-center font-mono text-slate-600 text-[10px] whitespace-nowrap">{mfgDateDisplay}</td>
                                    )}
                                    {Boolean(purchaseSettings?.showMrp) && (
                                      <td className="py-2 px-1.5 print:py-1 print:px-1 text-right font-medium text-slate-700 whitespace-nowrap">
                                        {mrpPrice > 0 ? mrpPrice.toFixed(2) : '—'}
                                      </td>
                                    )}
                                    {Boolean(purchaseSettings?.showSellPrice) && (
                                      <td className="py-2 px-1.5 print:py-1 print:px-1 text-right font-medium text-slate-700 whitespace-nowrap">
                                        {sellPrice > 0 ? sellPrice.toFixed(2) : '—'}
                                      </td>
                                    )}
                                    <td className="py-2 px-1.5 print:py-1 print:px-1 text-center font-extrabold text-slate-900 whitespace-nowrap">{qty}</td>
                                    {(purchaseSettings?.showRate ?? true) && (
                                      <td className="py-2 px-1.5 print:py-1 print:px-1 text-right font-medium text-slate-700 whitespace-nowrap">
                                        {isFree ? (
                                          <span>
                                            {originalRate > 0 && <span className="line-through text-slate-400 mr-1 text-[10px]">{originalRate.toFixed(2)}</span>}
                                            <span className="text-emerald-700 font-bold">0.00</span>
                                          </span>
                                        ) : (
                                          <span>{unitPrice.toFixed(2)}</span>
                                        )}
                                      </td>
                                    )}
                                    {(purchaseSettings?.showDiscount ?? true) && (
                                      <td className="py-2 px-1.5 print:py-1 print:px-1 text-right text-emerald-600 font-semibold whitespace-nowrap">
                                        {isFree ? '—' : (disc > 0 ? (item.discount_type === 'percent' ? `${discVal}%` : `-${disc.toFixed(2)}`) : '0%')}
                                      </td>
                                    )}
                                    {(purchaseSettings?.showGstTax ?? true) && (
                                      <td className="py-2 px-1.5 print:py-1 print:px-1 text-right text-slate-600 font-medium whitespace-nowrap">
                                        {isFree ? '0%' : `${taxRate}%`}
                                      </td>
                                    )}
                                    {Boolean(purchaseSettings?.showFreeQty) && (
                                      <td className="py-2 px-1.5 print:py-1 print:px-1 text-center whitespace-nowrap">
                                        {isFree ? (
                                          <span className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">FREE</span>
                                        ) : (
                                          <span className="text-slate-400">—</span>
                                        )}
                                      </td>
                                    )}
                                    {(purchaseSettings?.itemCustomColumns || []).filter(c => c.enabled).map(cc => {
                                      const val = (item as any)[cc.name] || (item as any)[cc.id] || (item as any)?.custom_fields?.[cc.id] || (item as any)?.custom_fields?.[cc.name] || '—';
                                      return (
                                        <td key={cc.id} className="py-2 px-1.5 print:py-1 print:px-1 text-center font-medium text-slate-700 whitespace-nowrap">
                                          {String(val)}
                                        </td>
                                      );
                                    })}
                                    <td className="py-2 px-2 print:py-1 print:px-1.5 text-right font-bold text-slate-900 whitespace-nowrap">
                                      {isFree ? (
                                        <span className="text-emerald-600 font-extrabold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[10px]">
                                          FREE (0.00)
                                        </span>
                                      ) : (
                                        <span>{currency.symbol}{netAmount.toFixed(2)}</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              }

                              return (
                                <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/50' : ''}>
                                  <td className="py-2 px-3 print:py-1 print:px-2 text-center font-bold text-slate-400">{idx + 1}</td>
                                  <td className="py-2 px-3 print:py-1 print:px-2">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-slate-900">{item.product_name || 'Item'}</span>
                                      {isFree && (
                                        <span className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded uppercase tracking-wider">
                                          FREE
                                        </span>
                                      )}
                                    </div>
                                    {(item.description || item.custom_note || item.notes) && (
                                      <span className="text-[10px] text-slate-600 block mt-0.5 whitespace-pre-line font-normal leading-tight">
                                        {item.description || item.custom_note || item.notes}
                                      </span>
                                    )}
                                    {((f.showSKU && (item.sku || (item as any).product_code)) || (f.showBarcode && (item as any).barcode)) && (
                                      <span className="text-[9px] font-mono text-slate-500 block mt-0.5">
                                        {f.showSKU && (item.sku || (item as any).product_code) && `SKU: ${item.sku || (item as any).product_code} `}
                                        {f.showBarcode && (item as any).barcode && `| Barcode: ${(item as any).barcode}`}
                                      </span>
                                    )}
                                    {(mrpPrice > 0 || sellPrice > 0) && !isFree && (
                                      <span className="text-[9px] text-slate-500">
                                        {mrpPrice > 0 && <span>MRP: {currency.symbol}{mrpPrice.toFixed(2)} </span>}
                                        {sellPrice > 0 && <span>• Sell: {currency.symbol}{sellPrice.toFixed(2)}</span>}
                                      </span>
                                    )}
                                  </td>
                                  {f.showHSN && <td className="py-2 px-3 print:py-1 print:px-2 text-center font-mono text-slate-600 text-[10px]">{hsnDisplay}</td>}
                                  <td className="py-2 px-3 print:py-1 print:px-2 text-center font-extrabold text-slate-800">
                                    <div>
                                      <span>{qty}</span>
                                      {(item.selected_uom || item.uom || (item as any).measuring_unit) && (
                                        <span className="ml-1 text-slate-700 font-bold">
                                          {item.selected_uom || item.uom || (item as any).measuring_unit}
                                        </span>
                                      )}
                                    </div>
                                    {item.secondary_uom ? (
                                      <span className="block text-[8px] font-black uppercase tracking-tight text-indigo-700">
                                        {item.selected_uom === item.secondary_uom ? "(Secondary Unit)" : "(Primary Unit)"}
                                      </span>
                                    ) : (item.selected_uom || item.uom) ? (
                                      <span className="block text-[8px] font-semibold text-slate-500 tracking-tight">
                                        (Primary Unit)
                                      </span>
                                    ) : null}
                                  </td>
                                  <td className="py-2 px-3 print:py-1 print:px-2 text-right font-medium text-slate-700">
                                    {isFree ? (
                                      <span>
                                        {originalRate > 0 && <span className="line-through text-slate-400 mr-1 text-[10px]">{currency.symbol}{originalRate.toFixed(2)}</span>}
                                        <span className="text-emerald-700 font-bold">{currency.symbol}0.00</span>
                                      </span>
                                    ) : (
                                      <span>{currency.symbol}{unitPrice.toFixed(2)}</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 print:py-1 print:px-2 text-right text-emerald-600 font-semibold">
                                    {isFree ? '—' : (disc > 0 ? `-₹${disc.toFixed(2)}` : '—')}
                                  </td>
                                  {f.showTaxSplit && (
                                    <td className="py-2 px-3 print:py-1 print:px-2 text-right text-slate-600 font-medium">
                                      {isFree ? (
                                        <span className="text-slate-400 font-normal">0%</span>
                                      ) : !isInterState ? (
                                        <div>
                                          <span>{taxRate ? `${taxRate}%` : '0%'}</span>
                                          {taxRate > 0 && <span className="text-[9px] text-slate-400 block font-normal leading-none mt-0.5">({(taxRate/2)}%+{(taxRate/2)}%)</span>}
                                        </div>
                                      ) : (
                                        <div>
                                          <span>{taxRate ? `${taxRate}%` : '0%'}</span>
                                          {taxRate > 0 && <span className="text-[9px] text-indigo-500 block font-normal leading-none mt-0.5">IGST</span>}
                                        </div>
                                      )}
                                    </td>
                                  )}
                                  <td className="py-2 px-3 print:py-1 print:px-2 text-right font-bold text-slate-900">
                                    {isFree ? (
                                      <span className="text-emerald-600 font-extrabold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[11px]">
                                        FREE ({currency.symbol}0.00)
                                      </span>
                                    ) : (
                                      <span>{currency.symbol}{netAmount.toFixed(2)}</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot className="border-t-2 border-slate-300 bg-slate-100/90 font-bold text-slate-900">
                            {hasProcurementColumns ? (
                              <tr>
                                <td className="py-2 px-2 print:py-1 print:px-1.5 text-center text-slate-500 font-bold text-[10px]">Total</td>
                                <td className="py-2 px-2.5 print:py-1 print:px-2 font-extrabold text-slate-800 text-[11px]">
                                  Total Items: {items.length} {items.length === 1 ? 'Item' : 'Items'}
                                </td>
                                <td className="py-2 px-2 print:py-1 print:px-1.5 text-center text-slate-400">—</td>
                                <td className="py-2 px-2 print:py-1 print:px-1.5 text-center text-slate-400">—</td>
                                <td className="py-2 px-2 print:py-1 print:px-1.5 text-center text-slate-400">—</td>
                                <td className="py-2 px-2 print:py-1 print:px-1.5 text-right text-slate-400">—</td>
                                <td className="py-2 px-2 print:py-1 print:px-1.5 text-right text-slate-400">—</td>
                                <td className="py-1.5 px-2 print:py-1 print:px-1.5 text-center font-black text-slate-900 bg-slate-200/90">
                                  <span className="text-slate-500 text-[8px] uppercase block font-semibold leading-none">Total Qty</span>
                                  <span className="text-[11px] font-mono">{totalQtyBilled}</span>
                                </td>
                                <td className="py-2 px-2 print:py-1 print:px-1.5 text-right text-slate-400">—</td>
                                <td className="py-2 px-2 print:py-1 print:px-1.5 text-right text-emerald-600 font-bold">
                                  {totalDiscount > 0 ? `-${currency.symbol}${Number(totalDiscount).toFixed(2)}` : '0%'}
                                </td>
                                <td className="py-2 px-2 print:py-1 print:px-1.5 text-right text-slate-400">—</td>
                                <td className="py-2 px-2.5 print:py-1 print:px-2 text-right font-black text-slate-900 text-[11px]">
                                  {currency.symbol}{Number(taxableSubtotal).toFixed(2)}
                                </td>
                              </tr>
                            ) : (
                              <tr>
                                <td className="py-2 px-3 print:py-1 print:px-2 text-center text-slate-500 font-bold text-[10px]">Total</td>
                                <td className="py-2 px-3 print:py-1 print:px-2 font-extrabold text-slate-800 text-[11px]">
                                  Total Items: {items.length} {items.length === 1 ? 'Item' : 'Items'}
                                </td>
                                {f.showHSN && <td className="py-2 px-3 print:py-1 print:px-2 text-center text-slate-400">—</td>}
                                <td className="py-1.5 px-3 print:py-1 print:px-2 text-center font-black text-slate-900 bg-slate-200/90">
                                  <span className="text-slate-500 text-[8px] uppercase block font-semibold leading-none">Total Qty</span>
                                  <span className="text-[11px] font-mono">{totalQtyBilled}</span>
                                </td>
                                <td className="py-2 px-3 print:py-1 print:px-2 text-right text-slate-400">—</td>
                                <td className="py-2 px-3 print:py-1 print:px-2 text-right text-emerald-600 font-bold">
                                  {totalDiscount > 0 ? `-${currency.symbol}${Number(totalDiscount).toFixed(2)}` : '—'}
                                </td>
                                {f.showTaxSplit && <td className="py-2 px-3 print:py-1 print:px-2 text-right text-slate-400">—</td>}
                                <td className="py-2 px-3 print:py-1 print:px-2 text-right font-black text-slate-900 text-[11px]">
                                  {currency.symbol}{Number(taxableSubtotal).toFixed(2)}
                                </td>
                              </tr>
                            )}
                          </tfoot>
                        </table>
                      </div>
                    );
                  })()}

                  {/* GST Tax Breakdown Table (Standard Statutory Compliance) */}
                  {f.showTaxSplit && gstBreakdown.slabsBreakdown.length > 0 && (
                    <div className="z-10 relative overflow-hidden rounded-xl border border-slate-200 mt-2 print:mt-1">
                      <div className="bg-slate-100/90 px-3 py-1.5 print:py-0.5 border-b border-slate-200 flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                          <span>📊 GST Tax Breakdown (Product & Slab Wise)</span>
                          <span className={`text-[8.5px] px-2 py-0.2 rounded font-black uppercase ${isInterState ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'}`}>
                            {isInterState ? 'Inter-State (IGST)' : 'Intra-State (CGST + SGST)'}
                          </span>
                        </span>
                        <span className="text-[9px] text-slate-600 font-medium">
                          Supply: {isInterState ? `${customerState?.name || 'State'} (${customerState?.code || ''})` : `${sellerState?.name || 'State'} (${sellerState?.code || ''})`}
                        </span>
                      </div>
                      <table className="w-full border-collapse text-[10.5px]">
                        <thead>
                          <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                            <th className="py-1.5 px-2.5 print:py-0.5 print:px-2 text-left">HSN / SAC</th>
                            <th className="py-1.5 px-2.5 print:py-0.5 print:px-2 text-right">Taxable Value</th>
                            {!isInterState ? (
                              <>
                                <th className="py-1.5 px-2.5 print:py-0.5 print:px-2 text-right">CGST Rate</th>
                                <th className="py-1.5 px-2.5 print:py-0.5 print:px-2 text-right">CGST Amount</th>
                                <th className="py-1.5 px-2.5 print:py-0.5 print:px-2 text-right">SGST Rate</th>
                                <th className="py-1.5 px-2.5 print:py-0.5 print:px-2 text-right">SGST Amount</th>
                              </>
                            ) : (
                              <>
                                <th className="py-1.5 px-2.5 print:py-0.5 print:px-2 text-right">IGST Rate</th>
                                <th className="py-1.5 px-2.5 print:py-0.5 print:px-2 text-right">IGST Amount</th>
                              </>
                            )}
                            <th className="py-1.5 px-2.5 print:py-0.5 print:px-2 text-right">Total Tax</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {gstBreakdown.slabsBreakdown.map((slab, sIdx) => {
                            const hsnList = Array.from(new Set(gstBreakdown.itemsBreakdown.filter(it => it.taxRate === slab.rate).map(it => it.hsn).filter(Boolean)));
                            const discScale = (gstBreakdown.totalTaxable > 0 && taxableSubtotal < gstBreakdown.totalTaxable)
                              ? (taxableSubtotal / gstBreakdown.totalTaxable)
                              : 1;
                            const slabTaxable = slab.taxableAmount * discScale;
                            const slabCgst = slab.cgstAmount * discScale;
                            const slabSgst = slab.sgstAmount * discScale;
                            const slabIgst = slab.igstAmount * discScale;
                            const slabTotal = slab.totalTax * discScale;
                            return (
                              <tr key={sIdx} className={sIdx % 2 === 1 ? 'bg-slate-50/40' : ''}>
                                <td className="py-1.5 px-2.5 print:py-0.5 print:px-2 font-mono text-slate-700 font-semibold">
                                  {hsnList.slice(0, 3).join(', ') || 'GST Slab'}
                                  <span className="text-[9px] text-slate-500 ml-1 font-sans">({slab.rate}%)</span>
                                </td>
                                <td className="py-1.5 px-2.5 print:py-0.5 print:px-2 text-right font-medium text-slate-800">{currency.symbol}{slabTaxable.toFixed(2)}</td>
                                {!isInterState ? (
                                  <>
                                    <td className="py-1.5 px-2.5 print:py-0.5 print:px-2 text-right text-slate-600">{slab.cgstRate}%</td>
                                    <td className="py-1.5 px-2.5 print:py-0.5 print:px-2 text-right font-medium text-slate-800">{currency.symbol}{slabCgst.toFixed(2)}</td>
                                    <td className="py-1.5 px-2.5 print:py-0.5 print:px-2 text-right text-slate-600">{slab.sgstRate}%</td>
                                    <td className="py-1.5 px-2.5 print:py-0.5 print:px-2 text-right font-medium text-slate-800">{currency.symbol}{slabSgst.toFixed(2)}</td>
                                  </>
                                ) : (
                                  <>
                                    <td className="py-1.5 px-2.5 print:py-0.5 print:px-2 text-right text-slate-600">{slab.igstRate}%</td>
                                    <td className="py-1.5 px-2.5 print:py-0.5 print:px-2 text-right font-medium text-slate-800">{currency.symbol}{slabIgst.toFixed(2)}</td>
                                  </>
                                )}
                                <td className="py-1.5 px-2.5 print:py-0.5 print:px-2 text-right font-bold text-slate-900">{currency.symbol}{slabTotal.toFixed(2)}</td>
                              </tr>
                            );
                          })}
                          <tr className="bg-slate-100/90 font-black text-slate-900 border-t border-slate-200">
                            <td className="py-1.5 px-2.5 print:py-0.5 print:px-2">Total</td>
                            <td className="py-1.5 px-2.5 print:py-0.5 print:px-2 text-right">{currency.symbol}{taxableSubtotal.toFixed(2)}</td>
                            {!isInterState ? (
                              <>
                                <td className="py-1.5 px-2.5 print:py-0.5 print:px-2 text-right">—</td>
                                <td className="py-1.5 px-2.5 print:py-0.5 print:px-2 text-right">{currency.symbol}{cgstAmount.toFixed(2)}</td>
                                <td className="py-1.5 px-2.5 print:py-0.5 print:px-2 text-right">—</td>
                                <td className="py-1.5 px-2.5 print:py-0.5 print:px-2 text-right">{currency.symbol}{sgstAmount.toFixed(2)}</td>
                              </>
                            ) : (
                              <>
                                <td className="py-1.5 px-2.5 print:py-0.5 print:px-2 text-right">—</td>
                                <td className="py-1.5 px-2.5 print:py-0.5 print:px-2 text-right">{currency.symbol}{igstAmount.toFixed(2)}</td>
                              </>
                            )}
                            <td className="py-1.5 px-2.5 print:py-0.5 print:px-2 text-right">{currency.symbol}{totalTax.toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Totals & Bank Details */}
                  <div className="grid grid-cols-12 gap-4 print:gap-2 pt-1 print:pt-0.5 z-10 relative">
                    <div className="col-span-7 space-y-3">
                      {hasRealBank && (
                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-0.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                            Bank & Wire Transfer Details
                          </span>
                          <p className="text-[10px] text-slate-700 font-mono leading-relaxed whitespace-pre-line">
                            {dynamicBank}
                          </p>
                        </div>
                      )}

                      {/* Payment QR and/or Verified Paid Badge */}
                      <div className="space-y-2">
                        {shouldPrintPaymentQr && paymentQrSrc && (
                          <div className="flex items-center gap-3 p-2.5 bg-purple-50/80 border border-purple-200 rounded-xl print:border-slate-300">
                            <div className="p-1 bg-white border border-purple-200 rounded-lg shrink-0 shadow-2xs">
                              <img
                                src={paymentQrSrc}
                                alt="Payment QR"
                                className="size-16 object-contain"
                              />
                            </div>
                            <div className="space-y-0.5 min-w-0">
                              <span className="text-[9px] font-black uppercase tracking-wider text-purple-900 block">
                                {balanceDue > 0 ? '⚡ SCAN TO PAY BALANCE DUE' : '⚡ STORE UPI QR (SCAN TO PAY)'}
                              </span>
                              <span className="text-[13px] font-black text-slate-900 block leading-tight">
                                {currency.symbol}{targetAmount.toFixed(2)}
                              </span>
                              {resolvedUpiVpa && (
                                <span className="text-[9.5px] font-mono text-purple-700 block truncate font-bold">
                                  UPI: {resolvedUpiVpa}
                                </span>
                              )}
                              <span className="text-[8px] text-slate-500 block leading-tight">
                                Scan with GPay, PhonePe, Paytm, BHIM & any UPI app
                              </span>
                            </div>
                          </div>
                        )}

                        {isPaidInFull && grandTotal > 0 && (
                          <div className="flex items-center gap-2.5 p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800">
                            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                            <div className="text-[10.5px]">
                              <strong className="font-black text-emerald-950">✓ PAID IN FULL</strong>
                              <span className="text-emerald-700 ml-1.5 font-medium">
                                · Payment received via {invoice.payment_method || 'Cash / Digital'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Terms & Conditions</span>
                        <p className="text-[9px] text-slate-500 whitespace-pre-line leading-relaxed">
                          {invoice?.terms || activeBillingGst?.terms_and_conditions || template.termsText || '1. Goods once sold will not be taken back.\n2. All disputes subject to local jurisdiction.'}
                        </p>
                      </div>

                      {showGoogleReview && googleReviewUrl && (
                        <div className="flex items-center gap-3 p-2.5 bg-amber-50/70 border border-amber-200/90 rounded-xl print:border-slate-300">
                          <div className="p-1 bg-white border border-amber-200 rounded-lg shrink-0 shadow-2xs">
                            <img
                              src={generateQRCodeSVG(googleReviewUrl, 140)}
                              alt="Google Review QR"
                              className="size-14 object-contain"
                            />
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-0.5 text-amber-500 text-[10.5px] font-black tracking-widest">
                              ★★★★★
                            </div>
                            <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight block">
                              Loved our service? Rate us on Google!
                            </span>
                            <span className="text-[8.5px] text-slate-600 block leading-tight">
                              Scan with your phone camera to share your 5-star review.
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="col-span-5 bg-slate-50 border border-slate-200 p-3 print:p-2 rounded-xl space-y-2 print:space-y-1 text-xs text-slate-700">
                      <div className="flex justify-between items-center py-1 px-2 bg-slate-200/80 rounded-lg border border-slate-300 text-slate-900 font-bold">
                        <span>Total Quantity:</span>
                        <span className="font-mono font-black text-indigo-700 text-xs">{totalQtyBilled} Units ({items.length} Items)</span>
                      </div>

                      <div className="flex justify-between font-semibold text-xs">
                        <span>Taxable Subtotal:</span>
                        <span className="text-slate-900">{currency.symbol}{Number(taxableSubtotal || 0).toFixed(2)}</span>
                      </div>

                      {totalDiscount > 0 && (
                        <div className="flex justify-between text-emerald-600 font-semibold text-xs">
                          <span>Total Savings / Discount:</span>
                          <span>-{currency.symbol}{Number(totalDiscount || 0).toFixed(2)}</span>
                        </div>
                      )}

                      {totalTax > 0 && (
                        <div className="space-y-1 pt-1 border-t border-slate-200/60">
                          {isInterState ? (
                            gstBreakdown.slabsBreakdown.length > 1 ? (
                              <>
                                {gstBreakdown.slabsBreakdown.filter(s => s.totalTax > 0).map((s, idx) => (
                                  <div key={idx} className="flex justify-between text-slate-600 text-[11px] font-medium">
                                    <span>IGST ({s.rate}%):</span>
                                    <span className="font-bold text-slate-800">{currency.symbol}{Number(s.igstAmount || 0).toFixed(2)}</span>
                                  </div>
                                ))}
                                <div className="flex justify-between text-slate-800 text-[11px] font-bold">
                                  <span>Total IGST:</span>
                                  <span>{currency.symbol}{Number(gstBreakdown.totalIgst || 0).toFixed(2)}</span>
                                </div>
                              </>
                            ) : (
                              <div className="flex justify-between text-slate-600 text-[11px] font-medium">
                                <span>IGST ({gstBreakdown.slabsBreakdown[0]?.rate || dominantTaxRate}%):</span>
                                <span className="font-bold text-slate-800">{currency.symbol}{Number(igstAmount || 0).toFixed(2)}</span>
                              </div>
                            )
                          ) : (
                            gstBreakdown.slabsBreakdown.length > 1 ? (
                              <>
                                <div className="flex justify-between text-slate-600 text-[11px] font-medium">
                                  <span>Central GST (CGST):</span>
                                  <span className="font-bold text-slate-800">{currency.symbol}{Number(gstBreakdown.totalCgst || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-slate-600 text-[11px] font-medium">
                                  <span>State GST (SGST):</span>
                                  <span className="font-bold text-slate-800">{currency.symbol}{Number(gstBreakdown.totalSgst || 0).toFixed(2)}</span>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex justify-between text-slate-600 text-[11px] font-medium">
                                  <span>CGST ({gstBreakdown.slabsBreakdown[0]?.cgstRate || halfTaxRate}%):</span>
                                  <span className="font-bold text-slate-800">{currency.symbol}{Number(cgstAmount || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-slate-600 text-[11px] font-medium">
                                  <span>SGST ({gstBreakdown.slabsBreakdown[0]?.sgstRate || halfTaxRate}%):</span>
                                  <span className="font-bold text-slate-800">{currency.symbol}{Number(sgstAmount || 0).toFixed(2)}</span>
                                </div>
                              </>
                            )
                          )}
                        </div>
                      )}

                      {/* Additional Charges (Freight, Packing, etc.) */}
                      {(invoice.additional_charges || []).filter(c => Number(c.amount) > 0).map((charge, idx) => (
                        <div key={idx} className="flex justify-between text-slate-600 text-[11px]">
                          <span>{charge.name}:</span>
                          <span>+{currency.symbol}{Number(charge.amount || 0).toFixed(2)}</span>
                        </div>
                      ))}

                      {/* Round Off */}
                      {invoice.round_off !== undefined && invoice.round_off !== 0 && (
                        <div className="flex justify-between text-slate-500 italic text-[11px]">
                          <span>Round Off:</span>
                          <span>{Number(invoice.round_off || 0) >= 0 ? '+' : ''}{currency.symbol}{Number(invoice.round_off || 0).toFixed(2)}</span>
                        </div>
                      )}

                      <div
                        className="flex justify-between items-center pt-2 border-t-2 border-slate-300 font-black text-xs text-slate-900"
                        style={{ borderColor: primaryColor }}
                      >
                        <span>GRAND TOTAL:</span>
                        <span className="text-sm font-extrabold" style={{ color: primaryColor }}>
                          {currency.symbol}{Number(grandTotal || 0).toFixed(2)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-[11px] font-bold text-slate-700 pt-0.5">
                        <span>Total Billed Qty:</span>
                        <span className="font-extrabold text-slate-900 bg-slate-200/70 px-1.5 py-0.2 rounded text-[10.5px]">
                          {totalQtyBilled} {totalQtyBilled === 1 ? 'Unit' : 'Units'}
                        </span>
                      </div>

                      {/* Amount Received & Balance */}
                      {invoice.amount_received !== undefined && Number(invoice.amount_received) > 0 && (
                        <>
                          <div className="flex justify-between text-slate-600 font-semibold pt-0.5 text-[11px]">
                            <span>Amount Received:</span>
                            <span className="text-emerald-700 font-bold">{currency.symbol}{Number(invoice.amount_received).toFixed(2)}</span>
                          </div>
                          {Number(invoice.amount_received) >= grandTotal - 0.05 ? (
                            <div className="flex justify-between text-emerald-700 font-bold text-[11px]">
                              <span>Payment Status:</span>
                              <span>PAID ({invoice.payment_method || 'Cash'})</span>
                            </div>
                          ) : (
                            <div className="flex justify-between text-red-600 font-bold text-[11px]">
                              <span>Balance Due:</span>
                              <span>{currency.symbol}{Math.max(0, Number(grandTotal || 0) - Number(invoice.amount_received)).toFixed(2)}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Signature & Footer */}
                  {(() => {
                    const sigSettings = getOrgSignatureSettings(tenant?.id) as any;
                    const signatureUrl = sigSettings.showDigitalSignature !== false && sigSettings.show_digital_signature !== false ? (sigSettings.signatureUrl || sigSettings.signature_url || activeBillingGst?.signature_url) : null;
                    const stampUrl = sigSettings.showDigitalStamp !== false && sigSettings.show_digital_stamp !== false ? (sigSettings.stampUrl || sigSettings.stamp_url || activeBillingGst?.stamp_url) : null;
                    const sigTitle = sigSettings.signatureTitle || sigSettings.signature_title || activeBillingGst?.signature_title || "Authorized Signatory";
                    const sigCompany = sigSettings.signatureCompanyName || sigSettings.signature_company_name || activeBillingGst?.trade_name || dynamicStoreName;

                    return (
                      <div className="pt-4 print:pt-2 border-t border-slate-200 flex justify-between items-end z-10 relative">
                        <div className="text-[9px] text-slate-500 max-w-[50%]">
                          <p className="font-semibold text-slate-700">{template.footerText || 'Thank you for your business!'}</p>
                          <p className="mt-0.5">Computer generated invoice. No signature required if authorized.</p>
                        </div>

                        {f.showSignature && (
                          <div className="text-right flex flex-col items-end">
                            <span className="text-[9px] font-bold text-slate-700 uppercase">For {sigCompany}</span>
                            <div className="relative w-36 h-12 print:h-9 flex items-center justify-end my-1 print:my-0.5">
                              {stampUrl && (
                                <img
                                  src={stampUrl}
                                  alt="Seal Stamp"
                                  className="absolute right-4 top-0 max-h-12 max-w-20 object-contain opacity-75 rotate-[-6deg] pointer-events-none"
                                />
                              )}
                              {signatureUrl && (
                                <img
                                  src={signatureUrl}
                                  alt="Signature"
                                  className="relative z-10 max-h-10 max-w-28 object-contain"
                                />
                              )}
                            </div>
                            <span className="text-[9px] font-bold text-slate-600 block uppercase tracking-wider border-t border-slate-300 pt-0.5 min-w-[140px] text-center">
                              {sigTitle}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
              </InvoiceErrorBoundary>
            </div>
          </div>

        </div>
      </div>
    </>
  );

  return createPortal(
    <>
      {modalJSX}
      <PdfTemplateOverlayModal
        isOpen={isPdfOverlayModalOpen}
        onClose={() => setIsPdfOverlayModalOpen(false)}
        onSaved={(newTplId) => {
          setSelectedTemplateId(newTplId);
          try {
            const storageKey = getTenantTemplatesKey(tenant?.id);
            const saved = localStorage.getItem(storageKey);
            if (saved) {
              const list = JSON.parse(saved);
              if (Array.isArray(list)) {
                setAvailableTemplates(list.filter((t: any) => t.category === 'invoices'));
              }
            }
          } catch {}
        }}
      />
      <PurchaseInvoiceQuickSettingsModal
        isOpen={isPurchaseSettingsOpen}
        onClose={() => setIsPurchaseSettingsOpen(false)}
      />
      <InvoiceQuickSettingsModal
        isOpen={isSalesSettingsOpen}
        onClose={() => setIsSalesSettingsOpen(false)}
      />
      <WordInvoiceStudioModal
        isOpen={isWordStudioOpen}
        onClose={() => setIsWordStudioOpen(false)}
        onSaved={() => {
          setSelectedTemplateId('tpl-word-default');
        }}
      />
    </>,
    document.body
  );
}

export type FullInvoicePropsWrapper = FullInvoicePrinterProps;
