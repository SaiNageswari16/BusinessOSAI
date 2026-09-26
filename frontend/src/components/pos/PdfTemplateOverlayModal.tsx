import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  Sliders,
  Eye,
  Type,
  Layout,
  Table as TableIcon,
  Image as ImageIcon,
  CheckSquare,
  Sparkles,
  RotateCcw,
  Printer,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileSpreadsheet,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  Layers,
  ChevronDown,
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
      custom_note: 'Special export grading with moisture control seal',
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
      custom_note: 'AGMARK Grade 1 Certified Tin',
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
      custom_note: 'Packed in vacuum sealed aroma foil pouch',
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

const FONT_OPTIONS = [
  { label: 'Calibri (Word Default)', value: 'Calibri, "Segoe UI", sans-serif' },
  { label: 'Aptos (Modern Word)', value: 'Aptos, "Segoe UI", sans-serif' },
  { label: 'Arial (Clean Sans)', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Times New Roman (Formal)', value: '"Times New Roman", Times, serif' },
  { label: 'Segoe UI (Windows Fluent)', value: '"Segoe UI", Tahoma, sans-serif' },
  { label: 'Georgia (Classic Editorial)', value: 'Georgia, serif' },
  { label: 'Inter (Modern Digital)', value: 'Inter, sans-serif' },
  { label: 'Roboto (Standard)', value: 'Roboto, sans-serif' },
];

const COLOR_SWATCHES = [
  { label: 'Word Blue', value: '#185abd' },
  { label: 'Executive Navy', value: '#0f172a' },
  { label: 'Royal Blue', value: '#2563eb' },
  { label: 'Emerald Green', value: '#059669' },
  { label: 'Crimson Red', value: '#dc2626' },
  { label: 'Deep Indigo', value: '#4f46e5' },
  { label: 'Slate Gray', value: '#475569' },
  { label: 'Amber Bronze', value: '#d97706' },
  { label: 'Charcoal Black', value: '#1e293b' },
];

const PRESETS = [
  {
    name: 'Word 2024 Classic Grid',
    fontFamily: 'Calibri, "Segoe UI", sans-serif',
    primaryColor: '#185abd',
    tableStyle: 'word_grid' as const,
    fontSizePt: 9.5,
    paddingLeftMm: 12,
    paddingRightMm: 12,
    headerTopOffsetMm: 8,
  },
  {
    name: 'Executive Navy Corporate',
    fontFamily: 'Arial, Helvetica, sans-serif',
    primaryColor: '#0f172a',
    tableStyle: 'striped' as const,
    fontSizePt: 9.5,
    paddingLeftMm: 14,
    paddingRightMm: 14,
    headerTopOffsetMm: 10,
  },
  {
    name: 'Modern Minimalist',
    fontFamily: 'Inter, sans-serif',
    primaryColor: '#2563eb',
    tableStyle: 'minimal_clean' as const,
    fontSizePt: 9.0,
    paddingLeftMm: 10,
    paddingRightMm: 10,
    headerTopOffsetMm: 6,
  },
  {
    name: 'Formal Legal / Times',
    fontFamily: '"Times New Roman", Times, serif',
    primaryColor: '#1e293b',
    tableStyle: 'boxed' as const,
    fontSizePt: 10,
    paddingLeftMm: 15,
    paddingRightMm: 15,
    headerTopOffsetMm: 10,
  },
];

type RibbonTab = 'home' | 'layout' | 'table' | 'insert' | 'sections' | 'presets';

export function PdfTemplateOverlayModal({
  isOpen,
  onClose,
  onSaved,
}: PdfTemplateOverlayModalProps) {
  const { tenant } = useTenant();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Ribbon Tab
  const [activeTab, setActiveTab] = useState<RibbonTab>('home');

  // Document Properties
  const [templateName, setTemplateName] = useState('Word Tax Invoice Document');
  const [backgroundDataUrl, setBackgroundDataUrl] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // Typography & Styling (Home Ribbon)
  const [fontFamily, setFontFamily] = useState('Calibri, "Segoe UI", sans-serif');
  const [fontSizePt, setFontSizePt] = useState(9.5);
  const [primaryColor, setPrimaryColor] = useState('#185abd');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [cellPadding, setCellPadding] = useState<'compact' | 'standard' | 'spacious'>('standard');

  // Layout & Margins (Layout Ribbon)
  const [paddingLeftMm, setPaddingLeftMm] = useState(12);
  const [paddingRightMm, setPaddingRightMm] = useState(12);
  const [headerTopOffsetMm, setHeaderTopOffsetMm] = useState(8);
  const [paddingBottomMm, setPaddingBottomMm] = useState(10);
  const [customerTopOffsetMm, setCustomerTopOffsetMm] = useState(40);
  const [tableTopOffsetMm, setTableTopOffsetMm] = useState(82);
  const [hideCompanyHeader, setHideCompanyHeader] = useState(false);
  const [hideFooterTerms, setHideFooterTerms] = useState(false);
  const [showBackgroundInPrint, setShowBackgroundInPrint] = useState(true);

  // Table Design (Table Ribbon)
  const [tableStyle, setTableStyle] = useState<'word_grid' | 'striped' | 'modern_banner' | 'minimal_clean' | 'boxed'>('word_grid');

  // Insert & Watermark (Insert Ribbon)
  const [watermarkText, setWatermarkText] = useState('');
  const [showWatermark, setShowWatermark] = useState(false);

  // Document Fields Toggles (Sections Ribbon)
  const [fields, setFields] = useState({
    showLogo: true,
    showHSN: true,
    showTaxSplit: true,
    showBankDetails: true,
    showSignature: true,
    showCustomerDetails: true,
    showProductName: true,
    showPrice: true,
    showMRP: true,
    showSKU: false,
    showPartyBalance: true,
    showItemDescription: true,
    showTime: true,
  });

  // Canvas Zoom Level
  const [zoomScale, setZoomScale] = useState<number>(0.92);

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
      toast.success(`Loaded letterhead / stationery: "${file.name}"!`);
    };
    reader.onerror = () => {
      setIsProcessingFile(false);
      toast.error('Failed to read file.');
    };
    reader.readAsDataURL(file);
  };

  const handleApplyPreset = (preset: typeof PRESETS[0]) => {
    setFontFamily(preset.fontFamily);
    setPrimaryColor(preset.primaryColor);
    setTableStyle(preset.tableStyle);
    setFontSizePt(preset.fontSizePt);
    setPaddingLeftMm(preset.paddingLeftMm);
    setPaddingRightMm(preset.paddingRightMm);
    setHeaderTopOffsetMm(preset.headerTopOffsetMm);
    toast.info(`Applied preset: "${preset.name}"`);
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name.');
      return;
    }

    try {
      const templateId = `tpl-inv-word-${Date.now()}`;
      const layout: PdfOverlayLayout = {
        headerTopOffsetMm,
        customerTopOffsetMm,
        tableTopOffsetMm,
        contentPaddingLeftMm: paddingLeftMm,
        contentPaddingRightMm: paddingRightMm,
        contentPaddingTopMm: headerTopOffsetMm,
        contentPaddingBottomMm: paddingBottomMm,
        hideCompanyHeader,
        hideFooterTerms,
        showBackgroundInPrint,
        fontSizePt,
        fontFamily,
        primaryColor,
        tableStyle,
        cellPadding,
        watermarkText,
        showWatermark,
      };

      const newTemplate = {
        id: templateId,
        name: templateName.trim(),
        category: 'invoices',
        description: `Microsoft Word formatted invoice document template (${fontFamily.split(',')[0]}).`,
        isDefault: true,
        paperSize: 'A4',
        primaryColor,
        fontFamily,
        headerTitle: 'TAX INVOICE',
        isPdfStationeryOverlay: true,
        themeName: 'pdf_stationery_overlay',
        pdfBackgroundDataUrl: backgroundDataUrl,
        overlayLayout: layout,
        fields,
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
      toast.success('Word invoice template saved & activated successfully!');

      if (onSaved) onSaved(templateId);
      onClose();
    } catch (err) {
      console.error('Error saving Word template:', err);
      toast.error('Failed to save template.');
    }
  };

  const previewTemplateObject = {
    id: 'preview',
    name: templateName,
    pdfBackgroundDataUrl: backgroundDataUrl,
    primaryColor,
    fontFamily,
    overlayLayout: {
      headerTopOffsetMm,
      customerTopOffsetMm,
      tableTopOffsetMm,
      contentPaddingLeftMm: paddingLeftMm,
      contentPaddingRightMm: paddingRightMm,
      contentPaddingTopMm: headerTopOffsetMm,
      contentPaddingBottomMm: paddingBottomMm,
      hideCompanyHeader,
      hideFooterTerms,
      showBackgroundInPrint,
      fontSizePt,
      fontFamily,
      primaryColor,
      tableStyle,
      cellPadding,
      watermarkText,
      showWatermark,
    },
  };

  const toggleField = (key: keyof typeof fields) => {
    setFields((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const modalJSX = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 md:p-4 overflow-hidden font-sans">
      <div className="bg-[#f0f2f5] text-slate-800 rounded-xl border border-slate-300 w-full max-w-[96vw] h-[96vh] flex flex-col overflow-hidden shadow-2xl">
        {/* ── 1. Top Word Title Bar ── */}
        <div className="bg-[#185abd] text-white px-4 py-2 flex items-center justify-between shadow-xs select-none">
          <div className="flex items-center gap-3">
            {/* Word Application Icon */}
            <div className="size-7 bg-white rounded flex items-center justify-center text-[#185abd] font-black text-sm shadow-xs">
              W
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Document Title"
                className="bg-transparent hover:bg-white/10 focus:bg-white focus:text-slate-900 px-2 py-0.5 rounded text-sm font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-blue-300 border border-transparent hover:border-white/20"
              />
              <span className="text-blue-200 text-xs font-normal">
                — Microsoft Word Document Designer
              </span>
              <span className="text-[10px] bg-blue-700/80 text-blue-100 px-2 py-0.5 rounded-full font-medium">
                WYSIWYG Print Ready
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveTemplate}
              className="px-3.5 py-1 bg-white text-[#185abd] hover:bg-blue-50 font-bold text-xs rounded shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Save & Activate
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-blue-100 hover:text-white hover:bg-blue-700/60 rounded transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── 2. Word Ribbon Tabs Header ── */}
        <div className="bg-[#f3f4f6] border-b border-slate-300 px-4 flex items-center gap-1 text-xs select-none">
          <button
            onClick={() => setActiveTab('home')}
            className={`px-3 py-1.5 font-semibold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'home'
                ? 'border-[#185abd] text-[#185abd] bg-white'
                : 'border-transparent text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <Type className="w-3.5 h-3.5" /> Home (Typography)
          </button>
          <button
            onClick={() => setActiveTab('layout')}
            className={`px-3 py-1.5 font-semibold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'layout'
                ? 'border-[#185abd] text-[#185abd] bg-white'
                : 'border-transparent text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <Layout className="w-3.5 h-3.5" /> Page Layout & Margins
          </button>
          <button
            onClick={() => setActiveTab('table')}
            className={`px-3 py-1.5 font-semibold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'table'
                ? 'border-[#185abd] text-[#185abd] bg-white'
                : 'border-transparent text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" /> Table Design
          </button>
          <button
            onClick={() => setActiveTab('insert')}
            className={`px-3 py-1.5 font-semibold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'insert'
                ? 'border-[#185abd] text-[#185abd] bg-white'
                : 'border-transparent text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" /> Letterhead & Watermark
          </button>
          <button
            onClick={() => setActiveTab('sections')}
            className={`px-3 py-1.5 font-semibold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'sections'
                ? 'border-[#185abd] text-[#185abd] bg-white'
                : 'border-transparent text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" /> Document Sections
          </button>
          <button
            onClick={() => setActiveTab('presets')}
            className={`px-3 py-1.5 font-semibold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'presets'
                ? 'border-[#185abd] text-[#185abd] bg-white'
                : 'border-transparent text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> Word Layout Presets
          </button>
        </div>

        {/* ── 3. Word Ribbon Toolbar Content Panel ── */}
        <div className="bg-white border-b border-slate-300 px-6 py-2.5 shadow-2xs select-none">
          {/* HOME TAB: Typography & Color Ribbon */}
          {activeTab === 'home' && (
            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-700">
              {/* Font Family & Size */}
              <div className="flex items-center gap-2 border-r border-slate-200 pr-5">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Font Family</span>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="px-2.5 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {FONT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Size</span>
                  <select
                    value={fontSizePt}
                    onChange={(e) => setFontSizePt(Number(e.target.value))}
                    className="px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value={8}>8 pt</option>
                    <option value={8.5}>8.5 pt</option>
                    <option value={9}>9 pt</option>
                    <option value={9.5}>9.5 pt (Standard)</option>
                    <option value={10}>10 pt</option>
                    <option value={11}>11 pt</option>
                    <option value={12}>12 pt</option>
                  </select>
                </div>
              </div>

              {/* Accent Color Palette */}
              <div className="flex flex-col gap-1 border-r border-slate-200 pr-5">
                <span className="text-[10px] uppercase font-bold text-slate-400">Theme Accent Color</span>
                <div className="flex items-center gap-1.5">
                  {COLOR_SWATCHES.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setPrimaryColor(c.value)}
                      title={c.label}
                      className={`size-6 rounded-full border-2 transition-transform cursor-pointer ${
                        primaryColor === c.value ? 'scale-115 border-slate-900 ring-2 ring-blue-400' : 'border-white hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="size-6 p-0 border-0 rounded cursor-pointer ml-1"
                    title="Custom Color"
                  />
                </div>
              </div>

              {/* Cell Padding */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Cell Spacing</span>
                <div className="flex rounded border border-slate-300 overflow-hidden bg-slate-50">
                  <button
                    onClick={() => setCellPadding('compact')}
                    className={`px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                      cellPadding === 'compact' ? 'bg-[#185abd] text-white' : 'text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Compact
                  </button>
                  <button
                    onClick={() => setCellPadding('standard')}
                    className={`px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                      cellPadding === 'standard' ? 'bg-[#185abd] text-white' : 'text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Standard
                  </button>
                  <button
                    onClick={() => setCellPadding('spacious')}
                    className={`px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                      cellPadding === 'spacious' ? 'bg-[#185abd] text-white' : 'text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Spacious
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* LAYOUT TAB: Page Margins & Calibration Ribbon */}
          {activeTab === 'layout' && (
            <div className="flex flex-wrap items-center gap-8 text-xs text-slate-700">
              {/* Presets */}
              <div className="flex flex-col gap-1 border-r border-slate-200 pr-5">
                <span className="text-[10px] uppercase font-bold text-slate-400">Page Margins Presets</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      setPaddingLeftMm(12);
                      setPaddingRightMm(12);
                      setHeaderTopOffsetMm(8);
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 text-xs font-semibold"
                  >
                    Normal (12mm)
                  </button>
                  <button
                    onClick={() => {
                      setPaddingLeftMm(6);
                      setPaddingRightMm(6);
                      setHeaderTopOffsetMm(5);
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 text-xs font-semibold"
                  >
                    Narrow (6mm)
                  </button>
                  <button
                    onClick={() => {
                      setPaddingLeftMm(20);
                      setPaddingRightMm(20);
                      setHeaderTopOffsetMm(15);
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 text-xs font-semibold"
                  >
                    Wide (20mm)
                  </button>
                </div>
              </div>

              {/* Custom Margin Controls */}
              <div className="flex items-center gap-4 border-r border-slate-200 pr-5">
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="font-semibold text-slate-600">Left Margin:</span>
                    <span className="font-bold text-[#185abd]">{paddingLeftMm} mm</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="30"
                    value={paddingLeftMm}
                    onChange={(e) => setPaddingLeftMm(Number(e.target.value))}
                    className="w-24 accent-[#185abd]"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="font-semibold text-slate-600">Right Margin:</span>
                    <span className="font-bold text-[#185abd]">{paddingRightMm} mm</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="30"
                    value={paddingRightMm}
                    onChange={(e) => setPaddingRightMm(Number(e.target.value))}
                    className="w-24 accent-[#185abd]"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="font-semibold text-slate-600">Top Header Offset:</span>
                    <span className="font-bold text-[#185abd]">{headerTopOffsetMm} mm</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    value={headerTopOffsetMm}
                    onChange={(e) => setHeaderTopOffsetMm(Number(e.target.value))}
                    className="w-28 accent-[#185abd]"
                  />
                </div>
              </div>

              {/* Letterhead Mode Toggles */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hideCompanyHeader}
                    onChange={(e) => setHideCompanyHeader(e.target.checked)}
                    className="rounded text-[#185abd] focus:ring-blue-500 size-3.5"
                  />
                  Pre-printed Letterhead (Hide Digital Header)
                </label>
                <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBackgroundInPrint}
                    onChange={(e) => setShowBackgroundInPrint(e.target.checked)}
                    className="rounded text-[#185abd] focus:ring-blue-500 size-3.5"
                  />
                  Print Background on Blank Paper
                </label>
              </div>
            </div>
          )}

          {/* TABLE TAB: Table Styles & Columns Ribbon */}
          {activeTab === 'table' && (
            <div className="flex flex-wrap items-center gap-8 text-xs text-slate-700">
              {/* Word Table Styles */}
              <div className="flex flex-col gap-1 border-r border-slate-200 pr-5">
                <span className="text-[10px] uppercase font-bold text-slate-400">Word Table Style</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setTableStyle('word_grid')}
                    className={`px-2.5 py-1 rounded border text-xs font-semibold cursor-pointer ${
                      tableStyle === 'word_grid' ? 'bg-[#185abd] text-white border-[#185abd]' : 'bg-slate-50 border-slate-300'
                    }`}
                  >
                    Classic Gridlines
                  </button>
                  <button
                    onClick={() => setTableStyle('striped')}
                    className={`px-2.5 py-1 rounded border text-xs font-semibold cursor-pointer ${
                      tableStyle === 'striped' ? 'bg-[#185abd] text-white border-[#185abd]' : 'bg-slate-50 border-slate-300'
                    }`}
                  >
                    Zebra Striped
                  </button>
                  <button
                    onClick={() => setTableStyle('minimal_clean')}
                    className={`px-2.5 py-1 rounded border text-xs font-semibold cursor-pointer ${
                      tableStyle === 'minimal_clean' ? 'bg-[#185abd] text-white border-[#185abd]' : 'bg-slate-50 border-slate-300'
                    }`}
                  >
                    Minimal Clean
                  </button>
                  <button
                    onClick={() => setTableStyle('boxed')}
                    className={`px-2.5 py-1 rounded border text-xs font-semibold cursor-pointer ${
                      tableStyle === 'boxed' ? 'bg-[#185abd] text-white border-[#185abd]' : 'bg-slate-50 border-slate-300'
                    }`}
                  >
                    Heavy Border Box
                  </button>
                </div>
              </div>

              {/* Table Column Toggles */}
              <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase font-bold text-slate-400">Columns:</span>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fields.showHSN}
                    onChange={() => toggleField('showHSN')}
                    className="size-3.5 text-[#185abd] rounded"
                  />
                  HSN/SAC
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fields.showMRP}
                    onChange={() => toggleField('showMRP')}
                    className="size-3.5 text-[#185abd] rounded"
                  />
                  MRP
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fields.showPrice}
                    onChange={() => toggleField('showPrice')}
                    className="size-3.5 text-[#185abd] rounded"
                  />
                  Rate
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fields.showTaxSplit}
                    onChange={() => toggleField('showTaxSplit')}
                    className="size-3.5 text-[#185abd] rounded"
                  />
                  Tax % Split
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fields.showItemDescription}
                    onChange={() => toggleField('showItemDescription')}
                    className="size-3.5 text-[#185abd] rounded"
                  />
                  Line Item Notes
                </label>
              </div>
            </div>
          )}

          {/* INSERT TAB: Letterhead & Watermark Ribbon */}
          {activeTab === 'insert' && (
            <div className="flex flex-wrap items-center gap-8 text-xs text-slate-700">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={handleFileUpload}
              />

              {/* Upload Stationery */}
              <div className="flex items-center gap-3 border-r border-slate-200 pr-5">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-[#185abd] text-white hover:bg-blue-700 rounded font-semibold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" /> Upload Letterhead / Stationery
                </button>
                {fileName && (
                  <span className="text-[11px] text-slate-600 font-medium truncate max-w-[180px]">
                    {fileName}
                  </span>
                )}
                {backgroundDataUrl && (
                  <button
                    onClick={() => {
                      setBackgroundDataUrl('');
                      setFileName('');
                    }}
                    className="text-red-500 hover:text-red-700 text-xs font-semibold cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>

              {/* Watermark Controls */}
              <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase font-bold text-slate-400">Document Watermark</span>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showWatermark}
                    onChange={(e) => setShowWatermark(e.target.checked)}
                    className="size-3.5 text-[#185abd] rounded"
                  />
                  Enable Watermark
                </label>
                {showWatermark && (
                  <input
                    type="text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    placeholder="e.g. ORIGINAL FOR RECIPIENT, PAID"
                    className="px-2.5 py-1 bg-slate-50 border border-slate-300 rounded text-xs text-slate-800 w-52"
                  />
                )}
              </div>
            </div>
          )}

          {/* SECTIONS TAB: Header, Bank, Terms Toggles */}
          {activeTab === 'sections' && (
            <div className="flex flex-wrap items-center gap-5 text-xs text-slate-700">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fields.showLogo}
                  onChange={() => toggleField('showLogo')}
                  className="size-3.5 text-[#185abd] rounded"
                />
                Company Logo
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fields.showCustomerDetails}
                  onChange={() => toggleField('showCustomerDetails')}
                  className="size-3.5 text-[#185abd] rounded"
                />
                Billed To & Shipped To Box
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fields.showBankDetails}
                  onChange={() => toggleField('showBankDetails')}
                  className="size-3.5 text-[#185abd] rounded"
                />
                Bank Details & Payment QR
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fields.showSignature}
                  onChange={() => toggleField('showSignature')}
                  className="size-3.5 text-[#185abd] rounded"
                />
                Authorized Signatory Block
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!hideFooterTerms}
                  onChange={(e) => setHideFooterTerms(!e.target.checked)}
                  className="size-3.5 text-[#185abd] rounded"
                />
                Terms & Conditions
              </label>
            </div>
          )}

          {/* PRESETS TAB: One-Click Designs */}
          {activeTab === 'presets' && (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 mr-2">Click to Apply:</span>
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => handleApplyPreset(p)}
                  className="px-3 py-1 bg-slate-100 hover:bg-[#185abd] hover:text-white rounded border border-slate-300 text-slate-800 font-semibold transition-colors cursor-pointer"
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── 4. Word Workspace & Interactive Canvas ── */}
        <div className="flex-1 bg-[#eaedf1] overflow-y-auto flex flex-col items-center p-4 md:p-6 relative select-none">
          {/* Document Top Ruler (Word Style) */}
          <div
            className="w-full max-w-[210mm] bg-white border border-slate-300 rounded-t h-5 flex items-center justify-between px-2 text-[8px] text-slate-400 font-mono select-none mb-0.5 shadow-xs"
            style={{ transform: `scale(${zoomScale})`, transformOrigin: 'top center' }}
          >
            <span>| 0 cm</span>
            <span>| 2</span>
            <span>| 4</span>
            <span>| 6</span>
            <span>| 8</span>
            <span>| 10</span>
            <span>| 12</span>
            <span>| 14</span>
            <span>| 16</span>
            <span>| 18</span>
            <span>| 21 cm</span>
          </div>

          {/* Word A4 Page Sheet */}
          <div
            className="w-full max-w-[210mm] min-h-[297mm] bg-white shadow-2xl rounded-sm border border-slate-300 overflow-hidden transition-transform origin-top"
            style={{
              transform: `scale(${zoomScale})`,
              transformOrigin: 'top center',
            }}
          >
            <PdfStationeryOverlayTemplate
              invoice={SAMPLE_INVOICE_DATA}
              dynamicStoreName={activeGst?.trade_name || 'Acme Global Commerce Ltd.'}
              dynamicLogoUrl={activeGst?.logo_url || '/Logo.png'}
              dynamicAddress={activeGst?.address || '123 Commercial Boulevard, Suite 400, Financial District'}
              dynamicPhone={activeGst?.phone || '+91 98493 44919'}
              dynamicEmail={activeGst?.email || 'billing@acme-commerce.com'}
              sellerGstin={activeGst?.gstin || '36AAACB1234A1Z5'}
              sellerStateCode={activeGst?.state_code || '36'}
              dynamicBank="Bank: HDFC Bank Ltd • A/C: 50200012345678 • IFSC: HDFC0001234 • Branch: Financial District"
              currency={{ symbol: '₹', code: 'INR' }}
              f={fields}
              template={previewTemplateObject}
            />
          </div>
        </div>

        {/* ── 5. Word Bottom Status Bar ── */}
        <div className="bg-[#185abd] text-white px-4 py-1.5 flex items-center justify-between text-xs select-none shadow-inner">
          <div className="flex items-center gap-4 text-[11px] text-blue-100">
            <span>Page 1 of 1</span>
            <span>•</span>
            <span>A4 (210 × 297 mm)</span>
            <span>•</span>
            <span className="font-semibold text-white">Word Document Layout Engine</span>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setZoomScale((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))))}
              className="p-1 hover:bg-white/10 rounded cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <input
              type="range"
              min="0.5"
              max="1.4"
              step="0.05"
              value={zoomScale}
              onChange={(e) => setZoomScale(Number(e.target.value))}
              className="w-24 accent-white"
            />
            <button
              onClick={() => setZoomScale((z) => Math.min(1.4, Number((z + 0.1).toFixed(2))))}
              className="p-1 hover:bg-white/10 rounded cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] font-bold w-12 text-center">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={() => setZoomScale(0.92)}
              className="px-2 py-0.5 bg-blue-700 hover:bg-blue-600 rounded text-[10px] font-semibold cursor-pointer"
            >
              Fit Page
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalJSX, document.body);
}
