'use client';

import React, { useState, useEffect } from 'react';
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
  Info
} from 'lucide-react';
import {
  ReceiptTemplate,
  DEFAULT_RECEIPT_TEMPLATE,
  getActiveReceiptTemplate,
  saveActiveReceiptTemplate,
  getStoredReceiptTemplates
} from '../../lib/receipt-template-store';
import { toast } from 'sonner';
import { triggerThermalPrint } from '../../lib/print-helper';
import { useCurrency } from "@/hooks/use-currency";

export function ReceiptTemplates() {
    const { currency, formatCurrency } = useCurrency();
  const [template, setTemplate] = useState<ReceiptTemplate>(DEFAULT_RECEIPT_TEMPLATE);
  const [templatesList, setTemplatesList] = useState<ReceiptTemplate[]>([]);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const active = getActiveReceiptTemplate();
    setTemplate(active);
    setTemplatesList(getStoredReceiptTemplates());
  }, []);

  const handleSave = () => {
    saveActiveReceiptTemplate(template);
    setIsSaved(true);
    toast.success('Active Receipt Template saved successfully!');
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleTestPrint = () => {
    saveActiveReceiptTemplate(template);
    triggerThermalPrint();
  };

  const handleResetDefault = () => {
    setTemplate(DEFAULT_RECEIPT_TEMPLATE);
    saveActiveReceiptTemplate(DEFAULT_RECEIPT_TEMPLATE);
    toast.info('Reset to HSPRINTER HS-KH80 80mm default template');
  };

  return (
    <div className="p-6 max-w-[1500px] mx-auto space-y-6 font-sans text-slate-800">
      {/* Top Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">POS Receipt Templates & Thermal Print Setup</h2>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active Printer: HSPRINTER (HS-KH80)
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Customize 80mm thermal receipt headers, GSTIN tax breakdown, loyalty points & QR codes
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleResetDefault}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Default
          </button>
          <button
            onClick={handleTestPrint}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5 text-indigo-600" /> Test Print (80mm)
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> {isSaved ? 'Saved!' : 'Save & Set Active'}
          </button>
        </div>
      </div>

      {/* Main Designer Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Config Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Printer Hardware & Paper Size Config */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <Sliders className="w-4 h-4 text-indigo-600" /> Hardware & Roll Specifications
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Thermal Roll Width</label>
                <select
                  value={template.paperSize}
                  onChange={(e) => setTemplate({ ...template, paperSize: e.target.value as any })}
                  className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="80mm">80mm (HSPRINTER HS-KH80 Standard - 3 Inch)</option>
                  <option value="58mm">58mm (Portable Bluetooth Thermal - 2 Inch)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Font & Line Density</label>
                <select
                  value={template.fontDensity}
                  onChange={(e) => setTemplate({ ...template, fontDensity: e.target.value as any })}
                  className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="normal">Normal Monospace (Standard 48 cols)</option>
                  <option value="compact">Compact Dense (High item count)</option>
                  <option value="large">Large Reader (High legibility)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Store Branding Header Config */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <Building className="w-4 h-4 text-purple-600" /> Store Branding & Header Details
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Store / Business Name *</label>
                <input
                  type="text"
                  value={template.storeName}
                  onChange={(e) => setTemplate({ ...template, storeName: e.target.value })}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Branch / Outlet Name</label>
                <input
                  type="text"
                  value={template.branchName}
                  onChange={(e) => setTemplate({ ...template, branchName: e.target.value })}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Header Banner / Title</label>
                <input
                  type="text"
                  value={template.invoiceTitle}
                  onChange={(e) => setTemplate({ ...template, invoiceTitle: e.target.value })}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Store Tagline / Subtitle</label>
                <input
                  type="text"
                  value={template.headerTagline}
                  onChange={(e) => setTemplate({ ...template, headerTagline: e.target.value })}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">Store Address (Multi-line)</label>
              <textarea
                rows={2}
                value={template.address}
                onChange={(e) => setTemplate({ ...template, address: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">GSTIN / Tax ID</label>
                <input
                  type="text"
                  value={template.gstin}
                  onChange={(e) => setTemplate({ ...template, gstin: e.target.value })}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">CIN / Reg No</label>
                <input
                  type="text"
                  value={template.cin}
                  onChange={(e) => setTemplate({ ...template, cin: e.target.value })}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Phone Number</label>
                <input
                  type="text"
                  value={template.phone}
                  onChange={(e) => setTemplate({ ...template, phone: e.target.value })}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Email Address</label>
                <input
                  type="email"
                  value={template.email}
                  onChange={(e) => setTemplate({ ...template, email: e.target.value })}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Thermal Content Section Toggles */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Thermal Section Toggles
            </h2>

            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { key: 'showStoreAddress', label: 'Show Store Address & Contact' },
                { key: 'showTaxId', label: 'Show GSTIN / Tax Reg No' },
                { key: 'showCustomerDetails', label: 'Show Customer Name & Phone' },
                { key: 'showItemHSN', label: 'Show Item HSN/SAC Code' },
                { key: 'showItemDiscount', label: 'Show Line Item Discount' },
                { key: 'showTaxBreakdown', label: 'Show GST Breakdown (CGST/SGST)' },
                { key: 'showLoyaltyPoints', label: 'Show Loyalty Points Earned' },
                { key: 'showPaymentMode', label: 'Show Payment Mode (Cash/UPI/Card)' },
                { key: 'showQrCode', label: 'Print QR Code (e-Invoice / UPI)' },
                { key: 'showDeclaration', label: 'Show Statutory Declaration' },
                { key: 'showFooterNote', label: 'Show Custom Footer Message' }
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition-colors border border-slate-200/80">
                  <input
                    type="checkbox"
                    checked={(template as any)[key]}
                    onChange={(e) => setTemplate({ ...template, [key]: e.target.checked })}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-semibold text-slate-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Declaration & Footer Notes */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <FileText className="w-4 h-4 text-amber-600" /> Declaration & Footer Note
            </h2>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Declaration Statement</label>
              <textarea
                rows={2}
                value={template.declarationText}
                onChange={(e) => setTemplate({ ...template, declarationText: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Footer Thank You Message</label>
              <textarea
                rows={2}
                value={template.footerNote}
                onChange={(e) => setTemplate({ ...template, footerNote: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Live 80mm Thermal Receipt Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl border border-slate-800 shadow-xl sticky top-20">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="w-4 h-4" /> Live 80mm Thermal Print Preview
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {template.paperSize} Roll Width • HS-KH80 Driver
              </span>
            </div>

            {/* Real-time Rendered Thermal Receipt Component */}
            <div className="bg-white text-black p-4 font-mono text-[11px] leading-tight rounded-xl shadow-inner border border-slate-300 overflow-y-auto max-h-[620px] select-none mx-auto w-full max-w-[300px]">
              {/* Header */}
              <div className="text-center mb-2">
                <h2 className="text-sm font-bold uppercase tracking-tight">{template.storeName}</h2>
                <p className="text-[10px] text-slate-600 font-sans">{template.branchName}</p>
                {template.headerTagline && <p className="text-[9px] italic text-slate-500 mt-0.5">{template.headerTagline}</p>}
                {template.showStoreAddress && (
                  <p className="text-[10px] text-slate-700 whitespace-pre-line mt-1">{template.address}</p>
                )}
                {template.showTaxId && (
                  <p className="text-[9.5px] text-slate-700 mt-1">
                    GSTIN: {template.gstin}<br />
                    CIN: {template.cin}
                  </p>
                )}
                <div className="text-[10px] text-slate-600 mt-0.5">
                  Ph: {template.phone} • {template.email}
                </div>
              </div>

              {/* Title Banner */}
              <div className="text-center font-bold border-y border-black py-1 my-2 text-xs uppercase tracking-wider">
                {template.invoiceTitle}
              </div>

              {/* Metadata */}
              <div className="text-[10px] mb-2 space-y-0.5">
                <div className="flex justify-between">
                  <span>Bill No: INV-20260805-13767</span>
                  <span>Time: 09:24 PM</span>
                </div>
                <div className="flex justify-between">
                  <span>Date: 05 Aug 2026</span>
                  <span>Cashier: Sarah J.</span>
                </div>
                {template.showCustomerDetails && (
                  <div className="border-t border-dotted border-slate-400 pt-0.5 mt-0.5">
                    <span className="font-bold">Customer: Rahul Sharma (+91 9876543210)</span>
                  </div>
                )}
              </div>

              {/* Items Table Header */}
              <div className="flex justify-between font-bold border-y border-black py-1 mb-1 text-[10.5px]">
                <span className="w-1/12 text-left">#</span>
                <span className="w-5/12 text-left pl-0.5">Item Description</span>
                <span className="w-2/12 text-center">Qty</span>
                <span className="w-2/12 text-right">Rate</span>
                <span className="w-2/12 text-right">Amt</span>
              </div>

              {/* Sample Items */}
              <div className="space-y-1 mb-2">
                {[
                  { name: 'AirPods Pro Gen 2', hsn: '8518', qty: 1, rate: 249.99, amt: 249.99 },
                  { name: 'Samsung Galaxy Buds2', hsn: '8518', qty: 2, rate: 149.99, amt: 299.98 },
                  { name: 'L\'Oreal Hair Care Pack', hsn: '3305', qty: 1, rate: 14.99, amt: 14.99 }
                ].map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start text-[10px]">
                    <span className="w-1/12 text-left">{idx + 1}</span>
                    <span className="w-5/12 text-left break-words pr-1">
                      {item.name}
                      {template.showItemHSN && <span className="block text-[8.5px] text-slate-500">HSN:{item.hsn}</span>}
                    </span>
                    <span className="w-2/12 text-center">{item.qty}</span>
                    <span className="w-2/12 text-right">{item.rate.toFixed(2)}</span>
                    <span className="w-2/12 text-right font-bold">{item.amt.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Totals Section */}
              <div className="border-t border-black pt-1">
                <div className="flex justify-between text-[10px]">
                  <span>Subtotal (4 items):</span>
                  <span>{currency.symbol}564.96</span>
                </div>
                {template.showItemDiscount && (
                  <div className="flex justify-between text-[10px]">
                    <span>Discount Savings:</span>
                    <span>-{currency.symbol}24.96</span>
                  </div>
                )}
                {template.showTaxBreakdown && (
                  <>
                    <div className="flex justify-between text-[9.5px] text-slate-600">
                      <span>CGST @9%:</span>
                      <span>{currency.symbol}24.30</span>
                    </div>
                    <div className="flex justify-between text-[9.5px] text-slate-600">
                      <span>SGST @9%:</span>
                      <span>{currency.symbol}24.30</span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-between font-extrabold text-sm border-y-2 border-black py-1 my-2">
                <span>GRAND TOTAL:</span>
                <span>{currency.symbol}588.60</span>
              </div>

              {template.showPaymentMode && (
                <div className="flex justify-between text-[10px] font-bold mb-2">
                  <span>PAYMENT MODE:</span>
                  <span className="uppercase">CASH (FULLY PAID)</span>
                </div>
              )}

              {template.showLoyaltyPoints && (
                <div className="bg-slate-100 p-1 rounded text-[9.5px] text-center mb-2 font-bold">
                  Loyalty Points Earned: +58 Pts | Total Balance: 1,038 Pts
                </div>
              )}

              {template.showDeclaration && (
                <div className="text-[8.5px] text-slate-600 text-justify mb-2 leading-tight border-t border-dashed border-slate-400 pt-1">
                  <span className="font-bold">Declaration:</span> {template.declarationText}
                </div>
              )}

              {template.showQrCode && (
                <div className="flex flex-col items-center my-2 pt-1 border-t border-slate-300">
                  <span className="text-[9px] font-bold mb-0.5">Scan to Verify e-Invoice / UPI Payment</span>
                  <QrCode className="w-16 h-16 text-black" strokeWidth={1.5} />
                </div>
              )}

              {template.showFooterNote && (
                <div className="text-center font-bold text-[9.5px] mt-2 whitespace-pre-line border-t border-black pt-1.5">
                  {template.footerNote}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
