'use client';

import React, { useState, useEffect } from 'react';
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
  Bold as BoldIcon
} from 'lucide-react';
import {
  ReceiptTemplate,
  DEFAULT_RECEIPT_TEMPLATE,
  getActiveReceiptTemplate,
  saveActiveReceiptTemplate,
  getStoredReceiptTemplates,
  getActiveBillingGst,
  getActiveBarcodeTemplate,
  saveBarcodeTemplate,
  setActiveBarcodeTemplate
} from '../../lib/receipt-template-store';
import { toast } from 'sonner';
import { triggerThermalPrint } from '../../lib/print-helper';
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { RealBarcodeSvg, printBarcodePopup } from '@/lib/barcode-svg';

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
    { key: 'test_field_1', label: 'Test', enabled: false, fontSize: 22, isBold: false, isCustom: true },
    { key: 'test_field_2', label: 'Test2', enabled: false, fontSize: 22, isBold: false, isCustom: true },
  ] as BarcodeFieldConfig[],
};

export function ReceiptTemplates() {
  const { t } = useI18n();
  const { currency } = useCurrency();
  const { tenant } = useTenant();
  
  // Top Level View Switcher: Thermal vs Barcode Print (like myBillBook)
  const [activeMainTab, setActiveMainTab] = useState<'thermal' | 'barcode'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'thermal_print' || tab === 'thermal_settings' || tab === 'thermal') return 'thermal';
      if (tab === 'barcode_print' || tab === 'barcode_settings' || tab === 'barcode') return 'barcode';
    }
    return 'barcode';
  });
  
  // Thermal Settings State
  const [template, setTemplate] = useState<ReceiptTemplate>(DEFAULT_RECEIPT_TEMPLATE);
  const [isSaved, setIsSaved] = useState(false);
  const [activeThermalSubTab, setActiveThermalSubTab] = useState<'clarity' | 'header' | 'customer' | 'items' | 'totals' | 'terms'>('clarity');

  // Barcode Print Settings State (myBillBook style)
  const [barcodeSettings, setBarcodeSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('bos_barcode_print_settings_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_BARCODE_CONFIG;
  });

  const activeGst = getActiveBillingGst(tenant?.id);
  const businessDisplayName = activeGst?.trade_name || activeGst?.legal_name || tenant?.name || template.storeName || 'I Smart Bazaar';

  useEffect(() => {
    const active = getActiveReceiptTemplate();
    setTemplate(active);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'thermal_print' || tab === 'thermal_settings' || tab === 'thermal') setActiveMainTab('thermal');
      else if (tab === 'barcode_print' || tab === 'barcode_settings' || tab === 'barcode') setActiveMainTab('barcode');
    }
  }, []);

  const handleSave = () => {
    if (activeMainTab === 'thermal') {
      saveActiveReceiptTemplate(template);
      setIsSaved(true);
      toast.success('Thermal Receipt settings saved successfully!');
      setTimeout(() => setIsSaved(false), 3000);
    } else {
      localStorage.setItem('bos_barcode_print_settings_v1', JSON.stringify(barcodeSettings));
      setIsSaved(true);
      toast.success('Barcode print settings saved successfully!');
      setTimeout(() => setIsSaved(false), 3000);
    }
  };

  const handleTestThermalPrint = () => {
    saveActiveReceiptTemplate(template);
    triggerThermalPrint();
  };

  const handleTestBarcodePrint = () => {
    localStorage.setItem('bos_barcode_print_settings_v1', JSON.stringify(barcodeSettings));
    const sampleProduct = {
      product_name: "Item 1",
      barcode: "1234567890",
      sku: "SKU-1001",
      selling_price: 100.0,
      mrp: 100.0,
      format: "Code-128",
      batch_no: "B-101",
      exp_date: "12/2028",
      net_qty: "1 Pc",
    };

    printBarcodePopup({
      items: [{ item: sampleProduct, copies: 2 }],
      template: {
        paperSize: barcodeSettings.labelSize.startsWith('a4') ? 'A4' : '50x25mm',
        layout: barcodeSettings.labelSize.includes('2up') ? '2up' : '1up',
        barcodeFormat: 'Code-128',
        fields: {
          showCompanyName: getBarcodeField('business_name')?.enabled !== false,
          showProductName: getBarcodeField('item_name')?.enabled !== false,
          showPrice: getBarcodeField('selling_price')?.enabled !== false,
          showMRP: getBarcodeField('mrp')?.enabled !== false,
          showSKU: getBarcodeField('item_code')?.enabled !== false,
          showBarcodeGraphic: true,
          showBarcodeText: true,
        }
      },
      orgName: businessDisplayName,
      currencySymbol: currency.symbol,
    });
  };

  const handleResetDefault = () => {
    if (activeMainTab === 'thermal') {
      setTemplate(DEFAULT_RECEIPT_TEMPLATE);
      saveActiveReceiptTemplate(DEFAULT_RECEIPT_TEMPLATE);
      toast.info('Reset thermal receipt to default template');
    } else {
      setBarcodeSettings(DEFAULT_BARCODE_CONFIG);
      localStorage.setItem('bos_barcode_print_settings_v1', JSON.stringify(DEFAULT_BARCODE_CONFIG));
      toast.info('Reset barcode settings to default 50x25mm (2 Labels/Row)');
    }
  };

  const updateThermalField = (key: keyof ReceiptTemplate, val: any) => {
    setTemplate(prev => ({ ...prev, [key]: val }));
  };

  // Barcode Helpers
  const getBarcodeField = (key: string) => {
    return barcodeSettings.fields.find((f: BarcodeFieldConfig) => f.key === key);
  };

  const updateBarcodeField = (key: string, updates: Partial<BarcodeFieldConfig>) => {
    setBarcodeSettings((prev: any) => ({
      ...prev,
      fields: prev.fields.map((f: BarcodeFieldConfig) => f.key === key ? { ...f, ...updates } : f)
    }));
  };

  const updateCustomField = (key: string, updates: Partial<BarcodeFieldConfig>) => {
    setBarcodeSettings((prev: any) => ({
      ...prev,
      customFields: prev.customFields.map((f: BarcodeFieldConfig) => f.key === key ? { ...f, ...updates } : f)
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
      isCustom: true
    };
    setBarcodeSettings((prev: any) => ({
      ...prev,
      customFields: [...(prev.customFields || []), newField]
    }));
  };

  const deleteCustomField = (key: string) => {
    setBarcodeSettings((prev: any) => ({
      ...prev,
      customFields: prev.customFields.filter((f: BarcodeFieldConfig) => f.key !== key)
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
      labelDimensions: dim
    }));
  };

  const dividerBorderClass = template.dividerStyle === 'solid'
    ? 'border-solid'
    : template.dividerStyle === 'dotted'
    ? 'border-dotted'
    : template.dividerStyle === 'double'
    ? 'border-double'
    : 'border-dashed';

  const fontFam = template.fontFamily === 'sans-serif'
    ? '"Segoe UI", -apple-system, BlinkMacSystemFont, "Roboto", "Helvetica Neue", Arial, sans-serif'
    : template.fontFamily === 'clean'
    ? '"Inter", "Segoe UI", -apple-system, sans-serif'
    : '"Consolas", "Courier New", Courier, monospace';

  return (
    <div className="space-y-5 font-sans text-slate-800 pb-12">
      {/* Top Header Matching myBillBook */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 rounded-xl border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              {t("Print Settings", "Print Settings")}
            </h1>
            <span className="bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">
              POS & Label Studio
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("Configure 80mm/58mm thermal receipts, ultra-dark clarity, and custom barcode labels", "Configure 80mm/58mm thermal receipts, ultra-dark clarity, and custom barcode labels")}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleResetDefault}
            className="px-3 h-8 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
          </button>
          <button
            onClick={activeMainTab === 'thermal' ? handleTestThermalPrint : handleTestBarcodePrint}
            className="px-3 h-8 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-card border border-slate-300 dark:border-slate-700 hover:bg-slate-50 rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-purple-600" />
            {activeMainTab === 'thermal' ? 'Test Thermal Print' : 'Test Barcode Print'}
          </button>
          <button
            onClick={handleSave}
            className="px-4 h-8 text-xs font-extrabold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" /> {isSaved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Top Primary Tabs: Thermal Settings vs Barcode Print */}
      <div className="flex border-b border-border/80 gap-8 px-2">
        <button
          onClick={() => setActiveMainTab('thermal')}
          className={`pb-3 text-sm font-bold transition-all relative cursor-pointer flex items-center gap-2 ${
            activeMainTab === 'thermal'
              ? 'text-purple-600 dark:text-purple-400 font-extrabold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Printer className="w-4 h-4" /> Thermal Settings
          {activeMainTab === 'thermal' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveMainTab('barcode')}
          className={`pb-3 text-sm font-bold transition-all relative cursor-pointer flex items-center gap-2 ${
            activeMainTab === 'barcode'
              ? 'text-purple-600 dark:text-purple-400 font-extrabold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ScanBarcode className="w-4 h-4" /> Barcode Print
          {activeMainTab === 'barcode' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 rounded-full" />
          )}
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* VIEW 1: BARCODE PRINT (EXACT MYBILLBOOK SETUP & NEAT BARCODE)     */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {activeMainTab === 'barcode' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Canvas: Real Interactive Dimensional Label Preview (7 cols) */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-border min-h-[580px] space-y-6">
            
            {/* Real Dimensioned Preview Box */}
            <div className="relative flex flex-col items-center justify-center my-6">
              {/* Top Dimension Marker (e.g. 50mm) */}
              <div className="w-[320px] mb-2 relative flex items-center justify-center">
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t border-red-300 dark:border-red-500/60" />
                <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-red-400 h-3" />
                <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-red-400 h-3" />
                <span className="relative z-10 bg-slate-50 dark:bg-slate-900 px-2 text-[11px] font-bold text-red-500 font-mono">
                  {barcodeSettings.labelDimensions.width}mm
                </span>
              </div>

              <div className="flex items-center">
                {/* Real-time Rendered Barcode Label Card */}
                <div
                  className="bg-white text-black p-4 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center select-none transition-all duration-200 w-[320px] min-h-[175px]"
                  style={{
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  {/* Business Name */}
                  {getBarcodeField('business_name')?.enabled && (
                    <div
                      className="text-black uppercase tracking-tight line-clamp-1 w-full"
                      style={{
                        fontSize: `${(getBarcodeField('business_name')?.fontSize || 35) * 0.48}px`,
                        fontWeight: getBarcodeField('business_name')?.isBold ? 900 : 600,
                        lineHeight: 1.15,
                        marginBottom: 4,
                      }}
                    >
                      {businessDisplayName}
                    </div>
                  )}

                  {/* Real Crisp Clean Barcode SVG */}
                  <div className="my-1.5 flex flex-col items-center justify-center w-full">
                    <RealBarcodeSvg
                      value="1234567890"
                      format="Code-128"
                      height={42}
                      fontSize={0}
                      className="max-w-[95%] h-auto mx-auto filter contrast-200"
                    />
                  </div>

                  {/* Item Code */}
                  {getBarcodeField('item_code')?.enabled && (
                    <div
                      className="text-black font-mono tracking-wider w-full"
                      style={{
                        fontSize: `${(getBarcodeField('item_code')?.fontSize || 22) * 0.55}px`,
                        fontWeight: getBarcodeField('item_code')?.isBold ? 800 : 500,
                        lineHeight: 1.2,
                        marginTop: -2,
                        marginBottom: 2,
                      }}
                    >
                      1234567890
                    </div>
                  )}

                  {/* Item Name */}
                  {getBarcodeField('item_name')?.enabled && (
                    <div
                      className="text-black line-clamp-1 w-full"
                      style={{
                        fontSize: `${(getBarcodeField('item_name')?.fontSize || 22) * 0.55}px`,
                        fontWeight: getBarcodeField('item_name')?.isBold ? 800 : 600,
                        lineHeight: 1.2,
                        marginBottom: 3,
                      }}
                    >
                      Item 1
                    </div>
                  )}

                  {/* Price Row: MRP & Selling Price */}
                  <div className="flex items-center justify-center gap-4 text-black w-full pt-0.5">
                    {getBarcodeField('mrp')?.enabled && (
                      <span
                        style={{
                          fontSize: `${(getBarcodeField('mrp')?.fontSize || 22) * 0.55}px`,
                          fontWeight: getBarcodeField('mrp')?.isBold ? 800 : 600,
                        }}
                      >
                        MRP: {currency.symbol}100
                      </span>
                    )}

                    {getBarcodeField('selling_price')?.enabled && (
                      <span
                        style={{
                          fontSize: `${(getBarcodeField('selling_price')?.fontSize || 22) * 0.55}px`,
                          fontWeight: getBarcodeField('selling_price')?.isBold ? 900 : 700,
                        }}
                      >
                        SP: {currency.symbol}100.00
                      </span>
                    )}
                  </div>

                  {/* Optional Extra Fixed / Custom Fields */}
                  {getBarcodeField('hsn_code')?.enabled && (
                    <div className="text-[10px] font-bold text-slate-700 mt-0.5">
                      HSN: 8518
                    </div>
                  )}
                  {getBarcodeField('batch_no')?.enabled && (
                    <div className="text-[9.5px] font-bold text-slate-700 mt-0.5">
                      B: B-101 • Exp: 12/28
                    </div>
                  )}
                  {getBarcodeField('net_qty')?.enabled && (
                    <div className="text-[9.5px] font-bold text-slate-700 mt-0.5">
                      Net Qty: 1 Pc
                    </div>
                  )}
                  {barcodeSettings.customFields?.filter((cf: BarcodeFieldConfig) => cf.enabled).map((cf: BarcodeFieldConfig) => (
                    <div
                      key={cf.key}
                      className="text-black mt-0.5"
                      style={{
                        fontSize: `${(cf.fontSize || 22) * 0.5}px`,
                        fontWeight: cf.isBold ? 800 : 600,
                      }}
                    >
                      {cf.label}: Sample Val
                    </div>
                  ))}
                </div>

                {/* Right Dimension Marker (e.g. 25mm) */}
                <div className="h-[175px] ml-3 relative flex items-center justify-center">
                  <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 border-l border-red-300 dark:border-red-500/60" />
                  <div className="absolute top-0 left-0 right-0 h-[1px] bg-red-400 w-3" />
                  <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-red-400 w-3" />
                  <span className="relative z-10 bg-slate-50 dark:bg-slate-900 py-1 text-[11px] font-bold text-red-500 font-mono [writing-mode:vertical-lr] rotate-180">
                    {barcodeSettings.labelDimensions.height}mm
                  </span>
                </div>
              </div>

              {/* Sub-label info below card */}
              <div className="text-center text-[11px] font-bold text-muted-foreground mt-3">
                {barcodeSettings.labelDimensions.labelsPerRow} Label(s) / Row
              </div>
            </div>

            {/* Bottom Hardware Assistance & Amazon Roll Helper */}
            <div className="w-full max-w-[420px] bg-card p-4 rounded-xl border border-border shadow-xs flex flex-col items-center text-center space-y-2.5">
              <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600">
                <Printer className="w-5 h-5" />
              </div>
              <div className="text-xs text-muted-foreground">
                <a
                  href={`https://www.amazon.in/s?k=thermal+barcode+labels+${barcodeSettings.labelDimensions.width}x${barcodeSettings.labelDimensions.height}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:text-purple-700 font-bold underline inline-flex items-center gap-1"
                >
                  Visit Link to browse Label size paper of {barcodeSettings.labelDimensions.width} x {barcodeSettings.labelDimensions.height}mm dimension on Amazon.in
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Don't know which printer you have?{' '}
                <span className="text-purple-600 font-bold cursor-pointer hover:underline">Contact Support</span>
              </div>
            </div>
          </div>

          {/* Right Panel: Barcode Configuration Controls (5 cols) */}
          <div className="lg:col-span-5 bg-card p-5 rounded-2xl border border-border shadow-xs space-y-5">
            <div>
              <h2 className="text-base font-extrabold text-foreground">Print Settings</h2>
            </div>

            {/* Select Printer Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground block">Select Printer Type</label>
              <div className="grid grid-cols-2 gap-3">
                <label
                  onClick={() => setBarcodeSettings((prev: any) => ({ ...prev, printerType: 'a4', labelSize: 'a4_24' }))}
                  className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                    barcodeSettings.printerType === 'a4'
                      ? 'border-purple-600 bg-purple-50/40 dark:bg-purple-950/20 text-foreground font-bold'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted/40'
                  }`}
                >
                  <span className="text-xs">A4</span>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${barcodeSettings.printerType === 'a4' ? 'border-purple-600' : 'border-border'}`}>
                    {barcodeSettings.printerType === 'a4' && <div className="w-2 h-2 bg-purple-600 rounded-full" />}
                  </div>
                </label>

                <label
                  onClick={() => setBarcodeSettings((prev: any) => ({ ...prev, printerType: 'label', labelSize: '50x25_2up' }))}
                  className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                    barcodeSettings.printerType === 'label'
                      ? 'border-purple-600 bg-purple-50/40 dark:bg-purple-950/20 text-foreground font-bold'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted/40'
                  }`}
                >
                  <span className="text-xs">Label</span>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${barcodeSettings.printerType === 'label' ? 'border-purple-600' : 'border-border'}`}>
                    {barcodeSettings.printerType === 'label' && <div className="w-2 h-2 bg-purple-600 rounded-full" />}
                  </div>
                </label>
              </div>
            </div>

            {/* Label Sizes Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground block">Label Sizes</label>
              <select
                value={barcodeSettings.labelSize}
                onChange={(e) => handleLabelSizeChange(e.target.value)}
                className="w-full h-9 bg-background border border-border rounded-xl px-3 text-xs font-bold text-foreground outline-none focus:ring-1 focus:ring-purple-600"
              >
                {barcodeSettings.printerType === 'label' ? (
                  <>
                    <option value="50x25_2up">50 x 25mm (2 Labels/Row)</option>
                    <option value="38x25_1up">38 x 25mm (1 Label/Row)</option>
                    <option value="50x50_1up">50 x 50mm (1 Label/Row)</option>
                    <option value="100x50_1up">100 x 50mm (Shipping Label)</option>
                  </>
                ) : (
                  <>
                    <option value="a4_24">A4 Sheet (24 labels/sheet - 3x8)</option>
                    <option value="a4_40">A4 Sheet (40 labels/sheet - 4x10)</option>
                    <option value="a4_65">A4 Sheet (65 labels/sheet - 5x13)</option>
                  </>
                )}
              </select>
            </div>

            {/* Show or Hide Details Section */}
            <div className="space-y-3 pt-2 border-t border-border">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-foreground">Show or hide details</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Fixed Columns (Select up to 6 columns to display on the barcode.)</p>
              </div>

              {/* Fixed Columns List with Font Stepper & Bold Button */}
              <div className="space-y-2">
                {barcodeSettings.fields.map((field: BarcodeFieldConfig) => (
                  <div
                    key={field.key}
                    className="flex items-center justify-between p-2 rounded-xl bg-muted/30 border border-border/70 hover:bg-muted/50 transition-colors"
                  >
                    <label className="flex items-center gap-2 cursor-pointer flex-1 mr-2">
                      <input
                        type="checkbox"
                        checked={field.enabled}
                        onChange={(e) => updateBarcodeField(field.key, { enabled: e.target.checked })}
                        className="rounded border-border text-purple-600 focus:ring-purple-600 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-foreground">{field.label}</span>
                    </label>

                    {/* Font Size Stepper [-] [ 22 ] [+] and Bold Toggle [B] */}
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center bg-background border border-border rounded-lg overflow-hidden h-7">
                        <button
                          type="button"
                          onClick={() => updateBarcodeField(field.key, { fontSize: Math.max(14, (field.fontSize || 22) - 2) })}
                          className="px-2 h-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center text-xs font-bold font-mono text-foreground">
                          {field.fontSize || 22}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateBarcodeField(field.key, { fontSize: Math.min(50, (field.fontSize || 22) + 2) })}
                          className="px-2 h-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Bold [B] Toggle */}
                      <button
                        type="button"
                        onClick={() => updateBarcodeField(field.key, { isBold: !field.isBold })}
                        className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center border transition-all cursor-pointer ${
                          field.isBold
                            ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                            : 'bg-background text-muted-foreground border-border hover:bg-muted'
                        }`}
                        title="Toggle Bold"
                      >
                        B
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Fields Section */}
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-foreground">Custom Fields</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Choose item custom field to show on the barcode</p>
                </div>
                <button
                  type="button"
                  onClick={addCustomField}
                  className="px-2.5 py-1 text-[11px] font-bold text-purple-600 hover:text-purple-700 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 rounded-lg border border-purple-200 dark:border-purple-800 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Add Field
                </button>
              </div>

              <div className="space-y-2">
                {barcodeSettings.customFields?.map((cf: BarcodeFieldConfig) => (
                  <div
                    key={cf.key}
                    className="flex items-center justify-between p-2 rounded-xl bg-muted/30 border border-border/70 hover:bg-muted/50 transition-colors"
                  >
                    <label className="flex items-center gap-2 cursor-pointer flex-1 mr-2">
                      <input
                        type="checkbox"
                        checked={cf.enabled}
                        onChange={(e) => updateCustomField(cf.key, { enabled: e.target.checked })}
                        className="rounded border-border text-purple-600 focus:ring-purple-600 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-foreground">{cf.label}</span>
                    </label>

                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center bg-background border border-border rounded-lg overflow-hidden h-7">
                        <button
                          type="button"
                          onClick={() => updateCustomField(cf.key, { fontSize: Math.max(14, (cf.fontSize || 22) - 2) })}
                          className="px-2 h-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center text-xs font-bold font-mono text-foreground">
                          {cf.fontSize || 22}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCustomField(cf.key, { fontSize: Math.min(50, (cf.fontSize || 22) + 2) })}
                          className="px-2 h-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => updateCustomField(cf.key, { isBold: !cf.isBold })}
                        className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center border transition-all cursor-pointer ${
                          cf.isBold
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-background text-muted-foreground border-border hover:bg-muted'
                        }`}
                      >
                        B
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteCustomField(cf.key)}
                        className="w-7 h-7 rounded-lg text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center border border-transparent hover:border-red-200 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* VIEW 2: THERMAL SETTINGS (ULTRA-DARK RECEIPT ENGINE & CONTROLS)   */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {activeMainTab === 'thermal' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Granular Thermal Settings Panel (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Navigation Tabs for Granular Settings */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border overflow-x-auto">
              {[
                { id: 'clarity', label: 'Clarity & Hardware', icon: Sliders },
                { id: 'header', label: 'Store Header', icon: Building },
                { id: 'customer', label: 'Customer & Meta', icon: ShieldCheck },
                { id: 'items', label: 'Item Columns', icon: ShoppingBag },
                { id: 'totals', label: 'Totals & QR', icon: Calculator },
                { id: 'terms', label: 'Terms & Notes', icon: FileText },
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeThermalSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveThermalSubTab(tab.id as any)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-background text-purple-600 dark:text-purple-400 shadow-xs border border-border/80 font-extrabold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground'}`} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* TAB 1: Print Clarity & Hardware */}
            {activeThermalSubTab === 'clarity' && (
              <div className="space-y-4">
                <div className="bg-card p-4 rounded-xl border border-border shadow-xs space-y-3">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/50 pb-2">
                    <Sliders className="w-3.5 h-3.5 text-purple-600" /> Print Density & Ultra-Dark Engine
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-foreground block mb-1">Print Clarity Engine</label>
                      <select
                        value={template.printClarity || 'ultra_dark'}
                        onChange={(e) => updateThermalField('printClarity', e.target.value)}
                        className="w-full h-8 bg-background border border-border rounded-lg px-2.5 text-xs font-bold text-foreground outline-none focus:ring-1 focus:ring-purple-600"
                      >
                        <option value="ultra_dark">★ Ultra-Dark High-Contrast (Deep Black / No Fading)</option>
                        <option value="crisp_mono">Crisp Monospace (Sharp Thermal Edges)</option>
                        <option value="compact">Compact Dense (Maximum Lines)</option>
                        <option value="standard">Standard Default</option>
                      </select>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Enforces heavy font-weight, dark ink stroke emulation, and high-contrast rendering.
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-foreground block mb-1">Receipt Font Family</label>
                      <select
                        value={template.fontFamily || 'monospace'}
                        onChange={(e) => updateThermalField('fontFamily', e.target.value)}
                        className="w-full h-8 bg-background border border-border rounded-lg px-2.5 text-xs font-bold text-foreground outline-none focus:ring-1 focus:ring-purple-600"
                      >
                        <option value="monospace">Monospace (Classic POS Consolas/Courier)</option>
                        <option value="sans-serif">Modern Sans-Serif (Segoe UI/Arial)</option>
                        <option value="clean">Clean Minimal (Inter/Roboto)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-xs font-bold text-foreground block mb-1">Thermal Roll Width</label>
                      <select
                        value={template.paperSize}
                        onChange={(e) => updateThermalField('paperSize', e.target.value)}
                        className="w-full h-8 bg-background border border-border rounded-lg px-2.5 text-xs font-bold text-foreground outline-none focus:ring-1 focus:ring-purple-600"
                      >
                        <option value="80mm">80mm (3-Inch Standard Desktop POS - HSPRINTER / Epson / TVS)</option>
                        <option value="58mm">58mm (2-Inch Portable Bluetooth / Handheld POS)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-foreground block mb-1">Divider Line Style</label>
                      <select
                        value={template.dividerStyle || 'dashed'}
                        onChange={(e) => updateThermalField('dividerStyle', e.target.value)}
                        className="w-full h-8 bg-background border border-border rounded-lg px-2.5 text-xs font-bold text-foreground outline-none focus:ring-1 focus:ring-purple-600"
                      >
                        <option value="dashed">Dashed Lines ( - - - - - )</option>
                        <option value="solid">Solid Black Lines ( ─────── )</option>
                        <option value="dotted">Dotted Lines ( • • • • • )</option>
                        <option value="double">Double Border Lines ( ═══════ )</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Store & Header Branding */}
            {activeThermalSubTab === 'header' && (
              <div className="bg-card p-4 rounded-xl border border-border shadow-xs space-y-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/50 pb-2">
                  <Building className="w-3.5 h-3.5 text-purple-600" /> Store Branding & Header Fields
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">Store / Legal Name *</label>
                    <input
                      type="text"
                      value={template.storeName}
                      onChange={(e) => updateThermalField('storeName', e.target.value)}
                      className="w-full h-8 bg-background border border-border rounded-lg px-2.5 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-purple-600"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">Branch / Outlet Name</label>
                    <input
                      type="text"
                      value={template.branchName}
                      onChange={(e) => updateThermalField('branchName', e.target.value)}
                      className="w-full h-8 bg-background border border-border rounded-lg px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-purple-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">Receipt Header Title</label>
                    <input
                      type="text"
                      value={template.invoiceTitle}
                      onChange={(e) => updateThermalField('invoiceTitle', e.target.value)}
                      className="w-full h-8 bg-background border border-border rounded-lg px-2.5 text-xs font-bold text-purple-700 outline-none focus:ring-1 focus:ring-purple-600"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">Tagline / Subtitle</label>
                    <input
                      type="text"
                      value={template.headerTagline}
                      onChange={(e) => updateThermalField('headerTagline', e.target.value)}
                      className="w-full h-8 bg-background border border-border rounded-lg px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-purple-600"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Store Address (Multi-line)</label>
                  <textarea
                    rows={2}
                    value={template.address}
                    onChange={(e) => updateThermalField('address', e.target.value)}
                    className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-purple-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">GSTIN / Tax ID</label>
                    <input
                      type="text"
                      value={template.gstin}
                      onChange={(e) => updateThermalField('gstin', e.target.value)}
                      className="w-full h-8 bg-background border border-border rounded-lg px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-purple-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">CIN / Registration No</label>
                    <input
                      type="text"
                      value={template.cin}
                      onChange={(e) => updateThermalField('cin', e.target.value)}
                      className="w-full h-8 bg-background border border-border rounded-lg px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-purple-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={template.phone}
                      onChange={(e) => updateThermalField('phone', e.target.value)}
                      className="w-full h-8 bg-background border border-border rounded-lg px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-purple-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">Email Address</label>
                    <input
                      type="email"
                      value={template.email}
                      onChange={(e) => updateThermalField('email', e.target.value)}
                      className="w-full h-8 bg-background border border-border rounded-lg px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-purple-600"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-border/60">
                  <label className="text-xs font-bold text-foreground block mb-2">Header Visibility Toggles</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {[
                      { key: 'showLogo', label: 'Print Logo / Monogram' },
                      { key: 'showStoreName', label: 'Print Store Name' },
                      { key: 'showBranchName', label: 'Print Branch Name' },
                      { key: 'showInvoiceTitle', label: 'Print Header Title Banner' },
                      { key: 'showTagline', label: 'Print Store Tagline' },
                      { key: 'showStoreAddress', label: 'Print Store Address' },
                      { key: 'showStoreContact', label: 'Print Phone & Email' },
                      { key: 'showTaxId', label: 'Print GSTIN / Tax ID' },
                      { key: 'showCin', label: 'Print CIN / Reg No' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors border border-border/60">
                        <input
                          type="checkbox"
                          checked={(template as any)[key] !== false}
                          onChange={(e) => updateThermalField(key as any, e.target.checked)}
                          className="rounded border-border text-purple-600 focus:ring-purple-600 cursor-pointer"
                        />
                        <span className="font-semibold text-foreground text-[11px]">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Customer & Transaction Meta */}
            {activeThermalSubTab === 'customer' && (
              <div className="bg-card p-4 rounded-xl border border-border shadow-xs space-y-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/50 pb-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Customer & Transaction Meta Toggles
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { key: 'showCustomerDetails', label: 'Show Customer Name' },
                    { key: 'showCustomerPhone', label: 'Show Customer Phone' },
                    { key: 'showCustomerAddress', label: 'Show Customer Billing Address' },
                    { key: 'showShippingAddress', label: 'Show Shipping / Delivery Address' },
                    { key: 'showTime', label: 'Show Print Time' },
                    { key: 'showCashier', label: 'Show Cashier Name' },
                    { key: 'showPoNumber', label: 'Show PO Reference Number' },
                    { key: 'showVehicleNumber', label: 'Show Vehicle / Transport Number' },
                    { key: 'showEwayBill', label: 'Show e-Way Bill Number' },
                    { key: 'showChallanNumber', label: 'Show Delivery Challan Number' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors border border-border/60">
                      <input
                        type="checkbox"
                        checked={(template as any)[key] !== false}
                        onChange={(e) => updateThermalField(key as any, e.target.checked)}
                        className="rounded border-border text-purple-600 focus:ring-purple-600 cursor-pointer"
                      />
                      <span className="font-semibold text-foreground text-[11px]">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: Item Table Columns */}
            {activeThermalSubTab === 'items' && (
              <div className="bg-card p-4 rounded-xl border border-border shadow-xs space-y-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/50 pb-2">
                  <ShoppingBag className="w-3.5 h-3.5 text-blue-600" /> Thermal Item Table Column Toggles
                </h3>
                <p className="text-xs text-muted-foreground">
                  Enable or disable individual columns on the receipt table just like invoice customization.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { key: 'showItemIndex', label: 'Column: Item Index (#1, #2...)' },
                    { key: 'showItemName', label: 'Column: Item / Product Name' },
                    { key: 'showItemDescription', label: 'Row: Item Description & Notes' },
                    { key: 'showItemHSN', label: 'Tag: Item HSN/SAC Code' },
                    { key: 'showItemSKU', label: 'Tag: Item SKU / Barcode' },
                    { key: 'showItemQty', label: 'Column: Quantity' },
                    { key: 'showItemUom', label: 'Unit of Measure (UOM/Unit)' },
                    { key: 'showItemRate', label: 'Column: Unit Rate / Price' },
                    { key: 'showItemMrp', label: 'Tag: MRP Comparison' },
                    { key: 'showItemDiscount', label: 'Tag: Item Discount Amount' },
                    { key: 'showItemTax', label: 'Tag: Item Tax Amount' },
                    { key: 'showItemTotal', label: 'Column: Line Total Amount' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors border border-border/60">
                      <input
                        type="checkbox"
                        checked={(template as any)[key] !== false}
                        onChange={(e) => updateThermalField(key as any, e.target.checked)}
                        className="rounded border-border text-purple-600 focus:ring-purple-600 cursor-pointer"
                      />
                      <span className="font-semibold text-foreground text-[11px]">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 5: Totals, Payments & QR */}
            {activeThermalSubTab === 'totals' && (
              <div className="bg-card p-4 rounded-xl border border-border shadow-xs space-y-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/50 pb-2">
                  <Calculator className="w-3.5 h-3.5 text-amber-600" /> Totals, Discounts & QR Settings
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { key: 'showSubtotal', label: 'Show Subtotal' },
                    { key: 'showTotalDiscount', label: 'Show Total Discount Line' },
                    { key: 'showSavingsBanner', label: '★ Show Savings Banner (You Saved ₹X)' },
                    { key: 'showTaxBreakdown', label: 'Show GST Split (CGST / SGST / IGST)' },
                    { key: 'showRoundOff', label: 'Show Round Off Amount' },
                    { key: 'showGrandTotal', label: 'Show Grand Total (Emphasized)' },
                    { key: 'showPaymentMode', label: 'Show Payment Mode (Cash/UPI/Card)' },
                    { key: 'showPaidInFullStamp', label: '★ Show [PAID IN FULL] Stamp' },
                    { key: 'showLoyaltyPoints', label: 'Show Loyalty Points Earned' },
                    { key: 'showQrCode', label: 'Print UPI Payment QR Code' },
                    { key: 'showGoogleReviewQR', label: '★ Print Google Review Feedback QR' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors border border-border/60">
                      <input
                        type="checkbox"
                        checked={(template as any)[key] !== false}
                        onChange={(e) => updateThermalField(key as any, e.target.checked)}
                        className="rounded border-border text-purple-600 focus:ring-purple-600 cursor-pointer"
                      />
                      <span className="font-semibold text-foreground text-[11px]">{label}</span>
                    </label>
                  ))}
                </div>

                {template.showGoogleReviewQR && (
                  <div className="mt-3 pt-3 border-t border-border/60 space-y-1.5">
                    <label className="text-xs font-bold text-foreground block">Google Review URL / Short Link</label>
                    <input
                      type="text"
                      placeholder="e.g. https://g.page/r/.../review or https://search.google.com/local/writereview"
                      value={template.googleReviewUrl || ''}
                      onChange={(e) => updateThermalField('googleReviewUrl', e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-purple-600"
                    />
                  </div>
                )}
              </div>
            )}

            {/* TAB 6: Terms & Conditions, Declaration & Footer */}
            {activeThermalSubTab === 'terms' && (
              <div className="bg-card p-4 rounded-xl border border-border shadow-xs space-y-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/50 pb-2">
                  <FileText className="w-3.5 h-3.5 text-amber-600" /> Terms & Conditions & Footer Notes
                </h3>

                {/* Terms & Conditions Block */}
                <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/60">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={template.showTermsAndConditions !== false}
                        onChange={(e) => updateThermalField('showTermsAndConditions', e.target.checked)}
                        className="rounded border-border text-purple-600 focus:ring-purple-600 cursor-pointer"
                      />
                      <span>Print Terms & Conditions on Thermal Receipt</span>
                    </label>
                    <span className="text-[10px] text-muted-foreground font-semibold">Separate from Declaration</span>
                  </div>
                  
                  {template.showTermsAndConditions !== false && (
                    <textarea
                      rows={4}
                      value={template.termsAndConditionsText || ''}
                      onChange={(e) => updateThermalField('termsAndConditionsText', e.target.value)}
                      placeholder="1. Goods once sold will not be taken back without original bill.&#10;2. Warranty as per manufacturer terms.&#10;3. Disputes subject to local jurisdiction."
                      className="w-full bg-background border border-border rounded-lg p-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-purple-600 font-mono"
                    />
                  )}
                </div>

                {/* Declaration Block */}
                <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/60">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={template.showDeclaration !== false}
                        onChange={(e) => updateThermalField('showDeclaration', e.target.checked)}
                        className="rounded border-border text-purple-600 focus:ring-purple-600 cursor-pointer"
                      />
                      <span>Print Statutory Declaration</span>
                    </label>
                  </div>
                  
                  {template.showDeclaration !== false && (
                    <textarea
                      rows={2}
                      value={template.declarationText || ''}
                      onChange={(e) => updateThermalField('declarationText', e.target.value)}
                      className="w-full bg-background border border-border rounded-lg p-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-purple-600"
                    />
                  )}
                </div>

                {/* Footer Note Block */}
                <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/60">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={template.showFooterNote !== false}
                        onChange={(e) => updateThermalField('showFooterNote', e.target.checked)}
                        className="rounded border-border text-purple-600 focus:ring-purple-600 cursor-pointer"
                      />
                      <span>Print Footer Thank You Note</span>
                    </label>
                  </div>
                  
                  {template.showFooterNote !== false && (
                    <textarea
                      rows={2}
                      value={template.footerNote || ''}
                      onChange={(e) => updateThermalField('footerNote', e.target.value)}
                      className="w-full bg-background border border-border rounded-lg p-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-purple-600"
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live High-Clarity Thermal Receipt Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="bg-slate-950 text-slate-100 p-4 rounded-xl border border-slate-800 shadow-2xl sticky top-20">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" /> High-Clarity Thermal Preview
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {template.paperSize} Roll • {template.printClarity || 'ultra_dark'}
                </span>
              </div>

              {/* Real-time Rendered High-Contrast Thermal Receipt Component */}
              <div
                className="bg-white text-black p-3.5 text-[11px] leading-tight rounded-lg shadow-inner border-2 border-slate-400 overflow-y-auto max-h-[640px] select-none mx-auto w-full max-w-[310px]"
                style={{
                  fontFamily: fontFam,
                  fontWeight: 800,
                  color: '#000000',
                  textShadow: '0 0 0.2px #000000',
                }}
              >
                {/* Header */}
                <div className={`text-center border-b-2 ${dividerBorderClass} border-black pb-2 mb-2`}>
                  {template.showLogo !== false && (
                    <div className="mx-auto h-7 w-7 bg-black text-white font-extrabold flex items-center justify-center text-xs rounded mb-1">
                      {businessDisplayName ? businessDisplayName.substring(0, 2).toUpperCase() : 'IS'}
                    </div>
                  )}
                  {template.showStoreName !== false && (
                    <h4 className="text-sm font-black uppercase tracking-tight text-black">{businessDisplayName}</h4>
                  )}
                  {template.showBranchName !== false && template.branchName && (
                    <p className="text-[10px] text-black font-bold">{template.branchName}</p>
                  )}
                  {template.showTagline !== false && template.headerTagline && (
                    <p className="text-[9px] italic text-black font-bold mt-0.5">{template.headerTagline}</p>
                  )}
                  {template.showStoreAddress !== false && template.address && (
                    <p className="text-[10px] text-black font-bold whitespace-pre-line mt-1">{template.address}</p>
                  )}
                  {template.showStoreContact !== false && (
                    <div className="text-[10px] text-black font-bold mt-0.5">
                      Ph: {template.phone} • {template.email}
                    </div>
                  )}
                  {template.showTaxId !== false && template.gstin && (
                    <p className="text-[10px] font-black text-black mt-1">
                      GSTIN: {template.gstin}
                    </p>
                  )}
                  {template.showCin !== false && template.cin && (
                    <p className="text-[9px] font-bold text-black">
                      CIN: {template.cin}
                    </p>
                  )}
                  {template.showInvoiceTitle !== false && (
                    <div className="font-black border-2 border-black inline-block px-2.5 py-0.5 mt-1.5 text-[11px] uppercase tracking-wider text-black">
                      {template.invoiceTitle}
                    </div>
                  )}
                </div>

                {/* Metadata */}
                <div className={`text-[10px] font-bold border-b-2 ${dividerBorderClass} border-black pb-1.5 mb-1.5 space-y-0.5 text-black`}>
                  <div className="flex justify-between">
                    <span className="font-black">Bill No: INV-20260805-13767</span>
                    <span>Date: 05 Aug 2026</span>
                  </div>
                  <div className="flex justify-between">
                    {template.showTime !== false && <span>Time: 09:24 PM</span>}
                    {template.showCashier !== false && <span>Cashier: Sarah J.</span>}
                  </div>
                  {template.showCustomerDetails !== false && (
                    <div className={`border-t ${dividerBorderClass} border-black pt-1 mt-1 space-y-0.5 text-black`}>
                      <div className="font-black">Customer: Rahul Sharma</div>
                      {template.showCustomerPhone !== false && <div>Phone: +91 9876543210</div>}
                      {template.showCustomerAddress !== false && <div>Bill To: 42 Palm Grove, Phase 2, Hyderabad</div>}
                      {template.showShippingAddress !== false && <div className="font-black">Ship To: 42 Palm Grove, Phase 2, Hyderabad</div>}
                      {template.showPoNumber !== false && <div>PO Ref: PO-98421</div>}
                      {template.showVehicleNumber !== false && <div>Vehicle: TS-09-EA-1234</div>}
                      {template.showEwayBill !== false && <div className="font-black">e-Way Bill: 241098234123</div>}
                      {template.showChallanNumber !== false && <div>Challan No: CH-5432</div>}
                    </div>
                  )}
                </div>

                {/* Items Table */}
                <table className="w-full text-left text-[10px] my-1 font-bold text-black border-collapse">
                  <thead>
                    <tr className="border-b-2 border-black font-black text-[10.5px]">
                      {template.showItemIndex !== false && <th className="pb-1 w-5 text-left text-black">#</th>}
                      {template.showItemName !== false && <th className="pb-1 text-left text-black">ITEM</th>}
                      {template.showItemQty !== false && <th className="pb-1 text-center text-black">QTY</th>}
                      {template.showItemRate !== false && <th className="pb-1 text-right text-black">RATE</th>}
                      {template.showItemTotal !== false && <th className="pb-1 text-right text-black">TOTAL</th>}
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${dividerBorderClass} divide-black`}>
                    {[
                      { name: 'AirPods Pro Gen 2', desc: 'Active Noise Cancelling', sku: 'APP-G2-WHT', hsn: '8518', mrp: 269.99, qty: 1, uom: 'PCS', rate: 249.99, disc: 20.0, tax: 22.5, total: 249.99 },
                      { name: 'Samsung Buds2 Pro', desc: 'Bora Purple Special Ed.', sku: 'SAM-B2P-PRP', hsn: '8518', mrp: 169.99, qty: 2, uom: 'PCS', rate: 149.99, disc: 10.0, tax: 27.0, total: 299.98 },
                      { name: 'L\'Oreal Hair Care', desc: '500ml Salon Pack', sku: 'LOR-HC-500', hsn: '3305', mrp: 19.99, qty: 1, uom: 'BTL', rate: 14.99, disc: 5.0, tax: 2.7, total: 14.99 }
                    ].map((item, idx) => (
                      <tr key={idx} className="text-black">
                        {template.showItemIndex !== false && (
                          <td className="py-1 pr-1 font-black align-top">{idx + 1}</td>
                        )}
                        {template.showItemName !== false && (
                          <td className="py-1 pr-1 font-black align-top">
                            <span className="block leading-tight">{item.name}</span>
                            {template.showItemDescription !== false && (
                              <span className="block text-[8.5px] italic text-black">{item.desc}</span>
                            )}
                            <div className="flex flex-wrap gap-x-1.5 text-[8.5px] font-bold text-black mt-0.5">
                              {template.showItemSKU !== false && <span>SKU:{item.sku}</span>}
                              {template.showItemHSN !== false && <span>HSN:{item.hsn}</span>}
                              {template.showItemMrp !== false && <span>MRP:{currency.symbol}{item.mrp}</span>}
                              {template.showItemDiscount !== false && item.disc > 0 && <span>Disc:-{currency.symbol}{item.disc}</span>}
                              {template.showItemTax !== false && <span>Tax:{currency.symbol}{item.tax}</span>}
                            </div>
                          </td>
                        )}
                        {template.showItemQty !== false && (
                          <td className="py-1 text-center font-black align-top whitespace-nowrap">
                            {item.qty} {template.showItemUom !== false ? item.uom : ''}
                          </td>
                        )}
                        {template.showItemRate !== false && (
                          <td className="py-1 text-right font-black align-top whitespace-nowrap">
                            {item.rate.toFixed(2)}
                          </td>
                        )}
                        {template.showItemTotal !== false && (
                          <td className="py-1 text-right font-black align-top whitespace-nowrap">
                            {item.total.toFixed(2)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div className={`border-t-2 ${dividerBorderClass} border-black pt-1 space-y-0.5 text-[11px] font-bold text-black`}>
                  {template.showSubtotal !== false && (
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span className="font-black">{currency.symbol}564.96</span>
                    </div>
                  )}
                  {template.showTotalDiscount !== false && (
                    <div className="flex justify-between font-black text-black">
                      <span>Discount / Savings:</span>
                      <span>-{currency.symbol}35.00</span>
                    </div>
                  )}
                  {template.showTaxBreakdown !== false && (
                    <>
                      <div className="flex justify-between text-[10px] text-black font-bold">
                        <span>CGST (9%):</span>
                        <span>{currency.symbol}26.10</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-black font-bold">
                        <span>SGST (9%):</span>
                        <span>{currency.symbol}26.10</span>
                      </div>
                    </>
                  )}
                  {template.showRoundOff !== false && (
                    <div className="flex justify-between text-[10px] text-black font-bold">
                      <span>Round Off:</span>
                      <span>+{currency.symbol}0.04</span>
                    </div>
                  )}
                  {template.showGrandTotal !== false && (
                    <div className="flex justify-between font-black text-sm border-t-2 border-black pt-1 mt-1 text-black">
                      <span>TOTAL AMOUNT:</span>
                      <span>{currency.symbol}582.20</span>
                    </div>
                  )}
                </div>

                {/* Payment Mode */}
                {template.showPaymentMode !== false && (
                  <div className={`flex justify-between text-[10px] font-black mt-1.5 border-t ${dividerBorderClass} border-black pt-1 text-black`}>
                    <span>PAYMENT MODE:</span>
                    <span className="uppercase">CASH (PAID)</span>
                  </div>
                )}

                {/* Loyalty Points */}
                {template.showLoyaltyPoints !== false && (
                  <div className="bg-black text-white p-1 text-[9px] text-center my-1 font-black uppercase tracking-wider">
                    ★ Loyalty Points Earned: +58 Pts ★
                  </div>
                )}

                {/* Savings Banner */}
                {template.showSavingsBanner !== false && (
                  <div className={`text-center font-black text-[10px] border-2 ${dividerBorderClass} border-black py-0.5 my-1.5 uppercase text-black`}>
                    ★ YOU SAVED {currency.symbol}35.00 ON THIS ORDER ★
                  </div>
                )}

                {/* Paid Stamp */}
                {template.showPaidInFullStamp !== false && (
                  <div className="text-center font-black text-[10px] border-2 border-black py-1 my-1 uppercase text-black">
                    ★ [✓ PAID IN FULL] ★
                  </div>
                )}

                {/* QR Code */}
                {template.showQrCode !== false && (
                  <div className={`flex flex-col items-center my-1.5 pt-1 border-t ${dividerBorderClass} border-black text-center`}>
                    <QrCode className="w-16 h-16 text-black border-2 border-black p-0.5 my-0.5" strokeWidth={2} />
                    <span className="text-[9px] font-black uppercase text-black">Scan to Pay UPI: ₹582.20</span>
                  </div>
                )}

                {/* Google Review QR */}
                {template.showGoogleReviewQR && (
                  <div className={`flex flex-col items-center my-1.5 pt-1 border-t-2 ${dividerBorderClass} border-black text-center`}>
                    <span className="text-[9.5px] font-black text-black">★ ★ ★ ★ ★ RATE US ON GOOGLE</span>
                    <QrCode className="w-14 h-14 text-black border-2 border-black p-0.5 my-0.5" strokeWidth={2} />
                    <span className="text-[8px] font-bold text-black">Scan to Share Feedback!</span>
                  </div>
                )}

                {/* Terms and Conditions Section */}
                {template.showTermsAndConditions !== false && template.termsAndConditionsText && (
                  <div className={`text-[8.5px] font-bold border-t-2 ${dividerBorderClass} border-black pt-1 mt-1 text-black leading-tight`}>
                    <div className="font-black uppercase text-[9px] tracking-wider mb-0.5 text-center">TERMS & CONDITIONS</div>
                    <div className="whitespace-pre-line text-left pl-0.5">{template.termsAndConditionsText}</div>
                  </div>
                )}

                {/* Statutory Declaration */}
                {template.showDeclaration !== false && template.declarationText && (
                  <div className={`text-[8.5px] font-bold border-t ${dividerBorderClass} border-black pt-1 mt-1 text-center text-black leading-tight`}>
                    <span className="font-black">Declaration: </span>{template.declarationText}
                  </div>
                )}

                {/* Footer Note */}
                {template.showFooterNote !== false && template.footerNote && (
                  <div className={`text-center font-black text-[9.5px] mt-1.5 whitespace-pre-line border-t-2 ${dividerBorderClass} border-black pt-1 text-black uppercase tracking-wider`}>
                    {template.footerNote}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
