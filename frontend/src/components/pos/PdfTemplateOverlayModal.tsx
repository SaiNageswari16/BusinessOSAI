import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  Sliders,
  MoveVertical,
  Eye,
  Settings,
  Sparkles,
  Info,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTenant } from '@/contexts/tenant-context';
import { getTenantTemplatesKey, getTenantDefaultsKey, getActiveBillingGst } from '@/lib/receipt-template-store';
import { PdfStationeryOverlayTemplate, type PdfOverlayLayout } from './invoice-templates/PdfStationeryOverlayTemplate';
import type { FullInvoiceData } from './FullInvoicePrinter';

interface PdfTemplateOverlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (templateId: string) => void;
}

const SAMPLE_INVOICE_DATA: FullInvoiceData = {
  invoice_number: 'INV-2026-0892',
  invoice_date: new Date().toISOString(),
  due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
  po_number: 'PO-99120',
  payment_terms: 'Net 15 Days',
  customerName: 'Acme Retail Enterprises',
  customerCompany: 'Acme Enterprises Pvt Ltd',
  customerGST: '36AAACA1234A1Z5',
  customerBillingAddress: 'Plot 45, Phase 2, Industrial Area, Hyderabad, Telangana - 500034',
  customerShippingAddress: 'Warehouse #3, Logistics Park, Hyderabad, Telangana - 500034',
  customerPhone: '+91 98765 43210',
  customerEmail: 'billing@acme-enterprises.com',
  items: [
    {
      product_name: 'Premium Basmati Rice 25kg (Royal Grain)',
      description: 'Aged 2 years, Extra Long Grain, Batch #B-9021',
      hsn_code: '10063020',
      quantity: 10,
      unit_price: 2450.0,
      mrp: 2700.0,
      discount_type: 'fixed',
      discount_value: 50.0,
      tax_rate: 5,
    },
    {
      product_name: 'Organic Cold Pressed Mustard Oil (15L Tin)',
      description: 'Single press pure kachi ghani mustard seed extract',
      hsn_code: '15149100',
      quantity: 5,
      unit_price: 2150.0,
      mrp: 2300.0,
      discount_type: 'percent',
      discount_value: 2.0,
      tax_rate: 5,
    },
    {
      product_name: 'Whole Spices Combo Pack (Export Quality)',
      description: 'Cardamom 100g, Clove 100g, Cinnamon 200g',
      hsn_code: '09083100',
      quantity: 20,
      unit_price: 680.0,
      mrp: 750.0,
      discount_type: 'percent',
      discount_value: 5.0,
      tax_rate: 12,
    },
  ],
  taxable_value: 47443.0,
  tax_amount: 3416.5,
  cgst_amount: 1708.25,
  sgst_amount: 1708.25,
  grand_total: 50859.5,
  amount_received: 50859.5,
  payment_method: 'UPI / NetBanking',
  payment_status: 'PAID',
};

export function PdfTemplateOverlayModal({
  isOpen,
  onClose,
  onSaved,
}: PdfTemplateOverlayModalProps) {
  const { tenant } = useTenant();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [templateName, setTemplateName] = useState('My Scanned Stationery Invoice');
  const [backgroundDataUrl, setBackgroundDataUrl] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // Layout calibration state
  const [headerTopOffsetMm, setHeaderTopOffsetMm] = useState(8);
  const [customerTopOffsetMm, setCustomerTopOffsetMm] = useState(40);
  const [tableTopOffsetMm, setTableTopOffsetMm] = useState(82);
  const [contentPaddingLeftMm, setContentPaddingLeftMm] = useState(10);
  const [contentPaddingRightMm, setContentPaddingRightMm] = useState(10);
  const [hideCompanyHeader, setHideCompanyHeader] = useState(false);
  const [hideFooterTerms, setHideFooterTerms] = useState(false);
  const [showBackgroundInPrint, setShowBackgroundInPrint] = useState(true);
  const [fontSizePt, setFontSizePt] = useState(9.5);

  const activeGst = getActiveBillingGst(tenant?.id);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setBackgroundDataUrl(result);
      setIsProcessingFile(false);
      toast.success(`Loaded "${file.name}" as stationery canvas!`);
    };
    reader.onerror = () => {
      setIsProcessingFile(false);
      toast.error('Failed to read document file.');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name.');
      return;
    }

    if (!backgroundDataUrl) {
      toast.error('Please upload your exact invoice PDF or scan image first.');
      return;
    }

    try {
      const templateId = `tpl-inv-overlay-${Date.now()}`;
      const layout: PdfOverlayLayout = {
        headerTopOffsetMm,
        customerTopOffsetMm,
        tableTopOffsetMm,
        contentPaddingLeftMm,
        contentPaddingRightMm,
        hideCompanyHeader,
        hideFooterTerms,
        showBackgroundInPrint,
        fontSizePt,
      };

      const newTemplate = {
        id: templateId,
        name: templateName.trim(),
        category: 'invoices',
        description: `Exact stationery overlay template using "${fileName || 'uploaded document'}" as canvas.`,
        isDefault: true,
        paperSize: 'A4',
        primaryColor: '#0f172a',
        fontFamily: 'Inter, sans-serif',
        headerTitle: 'TAX INVOICE',
        isPdfStationeryOverlay: true,
        themeName: 'pdf_stationery_overlay',
        pdfBackgroundDataUrl: backgroundDataUrl,
        overlayLayout: layout,
        fields: {
          showLogo: !hideCompanyHeader,
          showHSN: true,
          showTaxSplit: true,
          showBankDetails: !hideFooterTerms,
          showSignature: true,
          showCustomerDetails: true,
          showProductName: true,
          showPrice: true,
          showMRP: true,
          showSKU: true,
          showPartyBalance: true,
          showItemDescription: true,
          showTime: true,
        },
        createdAt: new Date().toISOString(),
      };

      // Save to localStorage scoped for tenant
      const storageKey = getTenantTemplatesKey(tenant?.id);
      const raw = localStorage.getItem(storageKey);
      let list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];

      // Mark others not default if this one is default
      list = list.map((t: any) => (t.category === 'invoices' ? { ...t, isDefault: false } : t));
      list.unshift(newTemplate);

      localStorage.setItem(storageKey, JSON.stringify(list));
      localStorage.setItem('businessos_print_templates_v1', JSON.stringify(list));

      // Update active invoice template pointer
      const defaultsKey = getTenantDefaultsKey(tenant?.id);
      const defaultsRaw = localStorage.getItem(defaultsKey);
      const defaults = defaultsRaw ? JSON.parse(defaultsRaw) : {};
      defaults.invoices = templateId;
      localStorage.setItem(defaultsKey, JSON.stringify(defaults));
      localStorage.setItem('user_active_print_templates_v1', JSON.stringify(defaults));

      if (tenant?.id) {
        localStorage.setItem(`bos_active_invoice_template_id_${tenant.id}`, templateId);
      }
      localStorage.setItem('bos_active_invoice_template_id', templateId);

      window.dispatchEvent(new Event('print_templates_updated'));
      toast.success('Exact PDF stationery template saved & activated successfully!');

      if (onSaved) onSaved(templateId);
      onClose();
    } catch (err) {
      console.error('Error saving PDF overlay template:', err);
      toast.error('Failed to save template.');
    }
  };

  const previewTemplateObject = {
    id: 'preview',
    name: templateName,
    pdfBackgroundDataUrl: backgroundDataUrl,
    overlayLayout: {
      headerTopOffsetMm,
      customerTopOffsetMm,
      tableTopOffsetMm,
      contentPaddingLeftMm,
      contentPaddingRightMm,
      hideCompanyHeader,
      hideFooterTerms,
      showBackgroundInPrint,
      fontSizePt,
    },
  };

  const modalJSX = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-3 md:p-6 overflow-hidden">
      <div className="bg-slate-900 text-white rounded-2xl border border-slate-700 w-full max-w-6xl h-[94vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-white flex items-center gap-2">
                Exact Invoice PDF & Stationery Overlay Creator
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Zero Regeneration • Exact User File
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Upload your exact bill stationery (PDF, PNG, JPG) and calibrate live data placement into the empty spaces.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content: 2-Column Split */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Left Column: Live A4 Visual Canvas Preview */}
          <div className="lg:col-span-7 bg-slate-950 p-4 md:p-6 overflow-y-auto flex flex-col items-center border-r border-slate-800">
            <div className="w-full flex items-center justify-between mb-3 text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                <Eye className="w-4 h-4 text-blue-400" /> Live Interactive A4 Calibrator Preview
              </span>
              <span className="text-[11px] text-slate-500">210mm × 297mm (Standard A4)</span>
            </div>

            {backgroundDataUrl ? (
              <div className="w-full max-w-xl bg-white rounded-lg shadow-2xl overflow-hidden border border-slate-700">
                <PdfStationeryOverlayTemplate
                  invoice={SAMPLE_INVOICE_DATA}
                  dynamicStoreName={activeGst?.trade_name || 'My Business Organization'}
                  dynamicLogoUrl={activeGst?.logo_url || '/Logo.png'}
                  dynamicAddress={activeGst?.address || '123 Commercial Boulevard, City'}
                  dynamicPhone={activeGst?.phone || '+91 98493 44919'}
                  dynamicEmail={activeGst?.email || 'contact@business.com'}
                  sellerGstin={activeGst?.gstin || '36AAACB1234A1Z5'}
                  sellerStateCode={activeGst?.state_code || '36'}
                  currency={{ symbol: '₹', code: 'INR' }}
                  f={{
                    showLogo: !hideCompanyHeader,
                    showHSN: true,
                    showTaxSplit: true,
                    showBankDetails: !hideFooterTerms,
                    showSignature: true,
                    showCustomerDetails: true,
                    showProductName: true,
                    showPrice: true,
                    showMRP: true,
                    showSKU: true,
                    showPartyBalance: true,
                    showItemDescription: true,
                    showTime: true,
                  }}
                  template={previewTemplateObject}
                />
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full max-w-xl aspect-[1/1.414] border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl flex flex-col items-center justify-center p-8 text-center transition-all bg-slate-900/40 hover:bg-slate-900 cursor-pointer group"
              >
                <div className="p-4 bg-blue-600/10 group-hover:bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/20 mb-4 transition-all">
                  <Upload className="w-8 h-8 group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="font-bold text-sm text-white mb-1">Click to Upload Your Exact Invoice PDF or Scanned Bill</h3>
                <p className="text-xs text-slate-400 max-w-xs mb-4">
                  Supports .PDF, .PNG, .JPG, .JPEG scans of your physical stationery, letterhead, or pre-printed bills.
                </p>
                <span className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-600/30">
                  Select File from Computer
                </span>
              </div>
            )}
          </div>

          {/* Right Column: Settings & Fine-Tuning Sliders */}
          <div className="lg:col-span-5 bg-slate-900 p-6 overflow-y-auto space-y-6">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={handleFileUpload}
            />

            {/* Template Info Card */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Template Identification
              </label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Marg Bill Stationery / Pre-printed Letterhead"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {fileName && (
                <div className="flex items-center justify-between p-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs">
                  <span className="text-slate-300 font-medium truncate max-w-[200px] flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                    {fileName}
                  </span>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer text-xs"
                  >
                    Replace File
                  </button>
                </div>
              )}
            </div>

            {/* Calibration Sliders */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-purple-400" /> Offset & Coordinate Calibrator
                </span>
                <span className="text-[11px] text-slate-400">Millimeter (mm) Precision</span>
              </div>

              {/* Header Offset */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Header Top Offset</span>
                  <span className="font-mono font-bold text-blue-400">{headerTopOffsetMm} mm</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="1"
                  value={headerTopOffsetMm}
                  onChange={(e) => setHeaderTopOffsetMm(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              {/* Customer Box Top Offset */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Customer Details (Billed To) Top Offset</span>
                  <span className="font-mono font-bold text-blue-400">{customerTopOffsetMm} mm</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="120"
                  step="1"
                  value={customerTopOffsetMm}
                  onChange={(e) => setCustomerTopOffsetMm(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              {/* Table Top Offset */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Items Table Top Offset</span>
                  <span className="font-mono font-bold text-blue-400">{tableTopOffsetMm} mm</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="160"
                  step="1"
                  value={tableTopOffsetMm}
                  onChange={(e) => setTableTopOffsetMm(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              {/* Left / Right Margins */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Left Margin</span>
                    <span className="font-mono font-bold text-blue-400">{contentPaddingLeftMm} mm</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="30"
                    step="1"
                    value={contentPaddingLeftMm}
                    onChange={(e) => setContentPaddingLeftMm(Number(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Right Margin</span>
                    <span className="font-mono font-bold text-blue-400">{contentPaddingRightMm} mm</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="30"
                    step="1"
                    value={contentPaddingRightMm}
                    onChange={(e) => setContentPaddingRightMm(Number(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Font Size */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Text Font Size</span>
                  <span className="font-mono font-bold text-blue-400">{fontSizePt} pt</span>
                </div>
                <input
                  type="range"
                  min="7.5"
                  max="13"
                  step="0.5"
                  value={fontSizePt}
                  onChange={(e) => setFontSizePt(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Letterhead & Pre-Printed Options */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Pre-Printed Letterhead Options
              </span>

              <label className="flex items-center gap-3 p-2.5 bg-slate-800/60 rounded-xl cursor-pointer hover:bg-slate-800 transition-colors">
                <input
                  type="checkbox"
                  checked={hideCompanyHeader}
                  onChange={(e) => setHideCompanyHeader(e.target.checked)}
                  className="rounded border-slate-600 text-blue-600 focus:ring-blue-500 size-4"
                />
                <div>
                  <span className="text-xs font-semibold text-white block">
                    My stationery already has Company Name & Logo printed
                  </span>
                  <span className="text-[11px] text-slate-400 block">
                    Hides the digital company header so it doesn't double-print over your pre-printed letterhead.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-2.5 bg-slate-800/60 rounded-xl cursor-pointer hover:bg-slate-800 transition-colors">
                <input
                  type="checkbox"
                  checked={hideFooterTerms}
                  onChange={(e) => setHideFooterTerms(e.target.checked)}
                  className="rounded border-slate-600 text-blue-600 focus:ring-blue-500 size-4"
                />
                <div>
                  <span className="text-xs font-semibold text-white block">
                    My stationery already has Terms & Bank Details printed
                  </span>
                  <span className="text-[11px] text-slate-400 block">
                    Hides the footer terms so it fits cleanly into the pre-printed footer box.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-2.5 bg-slate-800/60 rounded-xl cursor-pointer hover:bg-slate-800 transition-colors">
                <input
                  type="checkbox"
                  checked={showBackgroundInPrint}
                  onChange={(e) => setShowBackgroundInPrint(e.target.checked)}
                  className="rounded border-slate-600 text-blue-600 focus:ring-blue-500 size-4"
                />
                <div>
                  <span className="text-xs font-semibold text-white block">
                    Print Background Image on Blank Paper
                  </span>
                  <span className="text-[11px] text-slate-400 block">
                    Keep checked when saving/printing to blank A4 sheets. Uncheck if inserting pre-printed physical stationery into your printer tray.
                  </span>
                </div>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
              <button
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={!backgroundDataUrl || isProcessingFile}
                className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer ${
                  backgroundDataUrl
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 active:scale-95'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" /> Save & Activate Exact PDF Template
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalJSX, document.body);
}
