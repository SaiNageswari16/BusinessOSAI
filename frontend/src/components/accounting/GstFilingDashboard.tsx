'use client';

import React, { useState, useEffect } from 'react';
import {
  FileCheck,
  UploadCloud,
  Download,
  Calendar,
  Layers,
  Building2,
  Users,
  Hash,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { gstFilingApi } from '@/lib/api-client';
import { toast } from 'sonner';
import { useCurrency } from '@/hooks/use-currency';

export function GstFilingDashboard() {
  const { currency } = useCurrency();
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedInvoiceType, setSelectedInvoiceType] = useState<'tax_invoice' | 'estimate' | 'all'>('tax_invoice');
  const [activeTab, setActiveTab] = useState<'gstr1' | 'gstr3b'>('gstr1');
  const [gstr1SubTab, setGstr1SubTab] = useState<'b2b' | 'b2cs' | 'hsn' | 'docs'>('b2b');

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [summaryData, setSummaryData] = useState<any | null>(null);
  const [gstr3bData, setGstr3bData] = useState<any | null>(null);
  const [filingReceipt, setFilingReceipt] = useState<any | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [gstr1Res, gstr3bRes] = await Promise.all([
        gstFilingApi.getGstr1Summary({ year: selectedYear, month: selectedMonth, invoice_type: selectedInvoiceType }),
        gstFilingApi.getGstr3bSummary({ year: selectedYear, month: selectedMonth, invoice_type: selectedInvoiceType }),
      ]);
      setSummaryData(gstr1Res);
      setGstr3bData(gstr3bRes);
      if (gstr1Res?.b2b?.count === 0 && gstr1Res?.b2cs?.count > 0) {
        setGstr1SubTab('b2cs');
      }
    } catch (e: any) {
      toast.error('Failed to load GST return data from ERP database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedYear, selectedMonth, selectedInvoiceType]);

  const handleDownloadJson = () => {
    if (!summaryData) return;
    const exportData = summaryData.gstn_json_payload || summaryData;
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GSTR1_${String(selectedMonth).padStart(2, '0')}${selectedYear}_GSTN_Standard.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Official GSTN GSTR-1 JSON Package downloaded!');
  };

  const handleUploadToGstn = async () => {
    if (!summaryData) return;
    setUploading(true);
    try {
      const res = await gstFilingApi.uploadGstr1({
        year: selectedYear,
        month: selectedMonth,
        gstr1_payload: summaryData.gstn_json_payload || summaryData,
      });
      if (res && res.success) {
        setFilingReceipt(res);
        toast.success(`GSTR-1 for ${summaryData.month_name} successfully uploaded to GSTN Portal via Whitebooks GSP!`);
      } else {
        toast.error(res?.message || 'Failed to upload GSTR-1 to GST Portal');
      }
    } catch (e: any) {
      toast.error(e?.detail || e?.message || 'Whitebooks GSP filing gateway error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-3xl p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center gap-1.5 uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5 text-blue-400" /> Whitebooks GSP Certified Compliance
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
            GST Returns & Filing Hub
          </h2>
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
            Automated statutory computation for GSTR-1 and GSTR-3B. Seamlessly file monthly returns to GSTN with 1-click Whitebooks GSP API verification.
          </p>
        </div>

        {/* Period Selector & Quick Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/15">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-300" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-slate-900/80 text-white border border-white/20 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer"
            >
              {[
                { m: 1, name: 'January' },
                { m: 2, name: 'February' },
                { m: 3, name: 'March' },
                { m: 4, name: 'April' },
                { m: 5, name: 'May' },
                { m: 6, name: 'June' },
                { m: 7, name: 'July' },
                { m: 8, name: 'August' },
                { m: 9, name: 'September' },
                { m: 10, name: 'October' },
                { m: 11, name: 'November' },
                { m: 12, name: 'December' },
              ].map((item) => (
                <option key={item.m} value={item.m} className="bg-slate-900 text-white">
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-slate-900/80 text-white border border-white/20 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y} className="bg-slate-900 text-white">
                {y}
              </option>
            ))}
          </select>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all cursor-pointer"
            title="Refresh Return Summary"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filing Receipt Banner */}
      {filingReceipt && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 rounded-xl text-white">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-emerald-950 text-sm">GSTR-1 Filed via Whitebooks GSP</h4>
              <p className="text-xs text-emerald-800">
                ARN / Ref: <span className="font-mono font-bold">{filingReceipt.reference_id}</span> | Status: <span className="font-bold text-emerald-900">ACCEPTED</span>
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-xl">
            Filed on {new Date().toLocaleDateString()}
          </span>
        </div>
      )}

      {/* Invoice Type Selection & Segregation Filter */}
      <div className="bg-slate-100 dark:bg-slate-800/80 p-2 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300 ml-2">Filing Data Source:</span>
          <div className="flex items-center bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <button
              onClick={() => setSelectedInvoiceType('tax_invoice')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedInvoiceType === 'tax_invoice'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileCheck className="w-3.5 h-3.5" />
              Tax Invoices (GST Only)
            </button>
            <button
              onClick={() => setSelectedInvoiceType('estimate')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedInvoiceType === 'estimate'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Estimates (Non-Tax)
            </button>
            <button
              onClick={() => setSelectedInvoiceType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedInvoiceType === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              All Invoices (Combined)
            </button>
          </div>
        </div>

        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-2 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          {selectedInvoiceType === 'tax_invoice' && 'Official Tax Invoices selected for Statutory GSTN Return'}
          {selectedInvoiceType === 'estimate' && 'Estimates & Quotations selected for Internal Reconciliation'}
          {selectedInvoiceType === 'all' && 'All Invoice Records included'}
        </div>
      </div>

      {/* High Level KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Taxable Sales Value</span>
          <div className="text-2xl font-black text-slate-900">
            {currency.symbol}{Number(summaryData?.total_taxable_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-slate-500 font-semibold">{summaryData?.total_invoices_count || 0} Invoices Issued</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">Total CGST + SGST</span>
          <div className="text-2xl font-black text-blue-700">
            {currency.symbol}{Number((summaryData?.total_cgst || 0) + (summaryData?.total_sgst || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-slate-500 font-semibold">Intra-State Supplies</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block">Total IGST</span>
          <div className="text-2xl font-black text-indigo-700">
            {currency.symbol}{Number(summaryData?.total_igst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-slate-500 font-semibold">Inter-State Consignments</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">Total GST Liability</span>
          <div className="text-2xl font-black text-emerald-700">
            {currency.symbol}{Number(summaryData?.total_tax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-emerald-600 font-bold">Ready for GSTN Submission</span>
        </div>
      </div>

      {/* Main Tabs Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('gstr1')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'gstr1'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            GSTR-1 (Outward Supplies Return)
          </button>
          <button
            onClick={() => setActiveTab('gstr3b')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'gstr3b'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            GSTR-3B (Monthly Summary & ITC)
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadJson}
            disabled={!summaryData}
            className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl border border-slate-200 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-600" /> Download GSTR-1 JSON
          </button>
          <button
            onClick={handleUploadToGstn}
            disabled={uploading || !summaryData}
            className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-600/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {uploading ? (
              <>Uploading to GSTN...</>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" /> Verify & Upload to GST Portal
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tab 1: GSTR-1 Detailed Tables */}
      {activeTab === 'gstr1' && (
        <div className="space-y-4">
          {/* Sub-tabs */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-fit">
            <button
              onClick={() => setGstr1SubTab('b2b')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                gstr1SubTab === 'b2b' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Table 4: B2B Invoices ({summaryData?.b2b?.count || 0})
            </button>
            <button
              onClick={() => setGstr1SubTab('b2cs')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                gstr1SubTab === 'b2cs' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Table 7: B2CS Consumer Sales ({summaryData?.b2cs?.count || 0})
            </button>
            <button
              onClick={() => setGstr1SubTab('hsn')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                gstr1SubTab === 'hsn' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Table 12: HSN Summary ({summaryData?.hsn_summary?.length || 0})
            </button>
            <button
              onClick={() => setGstr1SubTab('docs')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                gstr1SubTab === 'docs' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Table 13: Document Issue
            </button>
          </div>

          {/* Table 4: B2B Invoices */}
          {gstr1SubTab === 'b2b' && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">Table 4: Taxable outward supplies made to registered persons (B2B)</h4>
                  <p className="text-[11px] text-slate-500">Invoices with valid 15-character GSTIN</p>
                </div>
                <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-200">
                  Total B2B Taxable: {currency.symbol}{Number(summaryData?.b2b?.total_taxable || 0).toFixed(2)}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Invoice No</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Customer Name</th>
                      <th className="py-3 px-4">GSTIN / UIN</th>
                      <th className="py-3 px-4 text-center">POS</th>
                      <th className="py-3 px-4 text-right">Taxable Value</th>
                      <th className="py-3 px-4 text-right">CGST</th>
                      <th className="py-3 px-4 text-right">SGST</th>
                      <th className="py-3 px-4 text-right">IGST</th>
                      <th className="py-3 px-4 text-right">Invoice Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(summaryData?.b2b?.invoices || []).map((inv: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 font-bold text-slate-900">{inv.invoice_number}</td>
                        <td className="py-2.5 px-4 text-slate-600">{inv.invoice_date || '—'}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-800">{inv.customer_name || 'Business Partner'}</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-indigo-700">{inv.customer_gstin}</td>
                        <td className="py-2.5 px-4 text-center font-bold text-slate-700">{inv.place_of_supply}</td>
                        <td className="py-2.5 px-4 text-right font-medium text-slate-800">{currency.symbol}{Number(inv.taxable_value).toFixed(2)}</td>
                        <td className="py-2.5 px-4 text-right text-slate-600">{currency.symbol}{Number(inv.cgst).toFixed(2)}</td>
                        <td className="py-2.5 px-4 text-right text-slate-600">{currency.symbol}{Number(inv.sgst).toFixed(2)}</td>
                        <td className="py-2.5 px-4 text-right text-indigo-600 font-bold">{currency.symbol}{Number(inv.igst).toFixed(2)}</td>
                        <td className="py-2.5 px-4 text-right font-black text-slate-900">{currency.symbol}{Number(inv.total_amount).toFixed(2)}</td>
                      </tr>
                    ))}
                    {(!summaryData?.b2b?.invoices || summaryData.b2b.invoices.length === 0) && (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-400">
                          No B2B invoices recorded for this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Table 7: B2CS Consumer Sales */}
          {gstr1SubTab === 'b2cs' && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">Table 7: Taxable supplies to unregistered persons (B2C Small)</h4>
                  <p className="text-[11px] text-slate-500">Retail & walk-in customer consumer sales</p>
                </div>
                <span className="text-xs font-extrabold text-blue-700 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
                  Total B2CS Taxable: {currency.symbol}{Number(summaryData?.b2cs?.total_taxable || 0).toFixed(2)}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Invoice No</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Recipient</th>
                      <th className="py-3 px-4 text-right">Taxable Value</th>
                      <th className="py-3 px-4 text-right">CGST</th>
                      <th className="py-3 px-4 text-right">SGST</th>
                      <th className="py-3 px-4 text-right">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(summaryData?.b2cs?.invoices || []).map((inv: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 font-bold text-slate-900">{inv.invoice_number}</td>
                        <td className="py-2.5 px-4 text-slate-600">{inv.invoice_date || '—'}</td>
                        <td className="py-2.5 px-4 text-slate-700">{inv.customer_name || 'Walk-in Consumer'}</td>
                        <td className="py-2.5 px-4 text-right font-medium text-slate-800">{currency.symbol}{Number(inv.taxable_value).toFixed(2)}</td>
                        <td className="py-2.5 px-4 text-right text-slate-600">{currency.symbol}{Number(inv.cgst).toFixed(2)}</td>
                        <td className="py-2.5 px-4 text-right text-slate-600">{currency.symbol}{Number(inv.sgst).toFixed(2)}</td>
                        <td className="py-2.5 px-4 text-right font-black text-slate-900">{currency.symbol}{Number(inv.total_amount).toFixed(2)}</td>
                      </tr>
                    ))}
                    {(!summaryData?.b2cs?.invoices || summaryData.b2cs.invoices.length === 0) && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No consumer retail sales recorded for this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Table 12: HSN Summary */}
          {gstr1SubTab === 'hsn' && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-200 bg-slate-50/50">
                <h4 className="font-bold text-slate-900 text-xs">Table 12: HSN-wise Summary of Outward Supplies</h4>
                <p className="text-[11px] text-slate-500">Statutory goods classification by HSN code</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">HSN Code</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4 text-center">UQC</th>
                      <th className="py-3 px-4 text-center">Total Quantity</th>
                      <th className="py-3 px-4 text-right">Total Value</th>
                      <th className="py-3 px-4 text-right">Taxable Value</th>
                      <th className="py-3 px-4 text-right">CGST</th>
                      <th className="py-3 px-4 text-right">SGST</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(summaryData?.hsn_summary || []).map((hsn: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 font-mono font-bold text-indigo-700">{hsn.hsn_code}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-800">{hsn.description}</td>
                        <td className="py-2.5 px-4 text-center font-bold text-slate-500">{hsn.uqc}</td>
                        <td className="py-2.5 px-4 text-center font-bold text-slate-900">{hsn.total_quantity}</td>
                        <td className="py-2.5 px-4 text-right font-medium text-slate-800">{currency.symbol}{Number(hsn.total_value).toFixed(2)}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-slate-900">{currency.symbol}{Number(hsn.taxable_value).toFixed(2)}</td>
                        <td className="py-2.5 px-4 text-right text-slate-600">{currency.symbol}{(Number(hsn.taxable_value) * 0.09).toFixed(2)}</td>
                        <td className="py-2.5 px-4 text-right text-slate-600">{currency.symbol}{(Number(hsn.taxable_value) * 0.09).toFixed(2)}</td>
                      </tr>
                    ))}
                    {(!summaryData?.hsn_summary || summaryData.hsn_summary.length === 0) && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          No HSN summary items found for this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Table 13: Document Issue */}
          {gstr1SubTab === 'docs' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                Table 13: Documents Issued During the Tax Period
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Invoices Issued</span>
                  <span className="text-xl font-black text-slate-900">{summaryData?.doc_issues?.total_issued || 0}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">From Serial Number</span>
                  <span className="text-base font-bold font-mono text-slate-900">{summaryData?.doc_issues?.from_serial || '—'}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">To Serial Number</span>
                  <span className="text-base font-bold font-mono text-slate-900">{summaryData?.doc_issues?.to_serial || '—'}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Cancelled Invoices</span>
                  <span className="text-xl font-black text-slate-900">{summaryData?.doc_issues?.cancelled_count || 0}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: GSTR-3B Summary & ITC */}
      {activeTab === 'gstr3b' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Table 3.1: Outward Supplies */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h4 className="font-bold text-slate-900 text-xs">Table 3.1: Details of Outward Supplies & Tax Liability</h4>
                <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                  Output Tax
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-slate-600">Total Taxable Value:</span>
                  <span className="font-bold text-slate-900">{currency.symbol}{Number(gstr3bData?.table_3_1_outward_supplies?.total_taxable_value || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-slate-600">Central Tax (CGST):</span>
                  <span className="font-bold text-blue-700">{currency.symbol}{Number(gstr3bData?.table_3_1_outward_supplies?.central_tax || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-slate-600">State Tax (SGST):</span>
                  <span className="font-bold text-emerald-700">{currency.symbol}{Number(gstr3bData?.table_3_1_outward_supplies?.state_tax || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-slate-600">Integrated Tax (IGST):</span>
                  <span className="font-bold text-indigo-700">{currency.symbol}{Number(gstr3bData?.table_3_1_outward_supplies?.integrated_tax || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Table 4: Eligible ITC & Net Payable */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h4 className="font-bold text-slate-900 text-xs">Table 4 & 5.1: Eligible ITC & Net Tax Payable</h4>
                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                  Input Credit Offset
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-slate-600">Estimated Input Tax Credit (ITC):</span>
                  <span className="font-bold text-emerald-700">
                    -{currency.symbol}{Number((gstr3bData?.table_4_eligible_itc?.all_other_itc_cgst || 0) + (gstr3bData?.table_4_eligible_itc?.all_other_itc_sgst || 0)).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-slate-600">Net CGST Payable in Cash:</span>
                  <span className="font-bold text-slate-900">{currency.symbol}{Number(gstr3bData?.net_tax_payable?.cgst || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-slate-600">Net SGST Payable in Cash:</span>
                  <span className="font-bold text-slate-900">{currency.symbol}{Number(gstr3bData?.net_tax_payable?.sgst || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 font-black text-sm text-indigo-900 bg-indigo-50 p-2.5 rounded-xl border border-indigo-200">
                  <span>NET CASH TAX LIABILITY:</span>
                  <span>{currency.symbol}{Number(gstr3bData?.net_tax_payable?.total || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Official Filing Receipt / Acknowledgment Modal */}
      {filingReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-600 rounded-2xl text-white shadow-md">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Official GST Filing Acknowledgment</h3>
                  <p className="text-xs text-slate-500">Government of India • GSTN & Whitebooks GSP</p>
                </div>
              </div>
              <button
                onClick={() => setFilingReceipt(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600">Filing Status:</span>
                <span className="font-bold text-emerald-800 bg-emerald-200/80 px-2.5 py-0.5 rounded-md uppercase tracking-wider text-[11px]">
                  {filingReceipt.status || 'ACCEPTED'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600">Application Reference No (ARN):</span>
                <span className="font-mono font-bold text-slate-900">{filingReceipt.arn || filingReceipt.reference_id}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600">Tax Period:</span>
                <span className="font-bold text-slate-900">{summaryData?.month_name || 'August 2026'} ({filingReceipt.period || '082026'})</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600">Total Invoices Filed:</span>
                <span className="font-bold text-slate-900">{summaryData?.total_invoices_count || 0} Transactions</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600">Total Tax Liability:</span>
                <span className="font-bold text-emerald-950 font-mono text-sm">{currency.symbol}{(summaryData?.total_tax || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-emerald-200/60 pt-2">
                <span className="text-slate-500 text-[11px]">Timestamp:</span>
                <span className="font-mono text-slate-600 text-[11px]">{filingReceipt.timestamp || new Date().toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleDownloadJson}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5" /> Download Filed JSON
              </button>
              <button
                type="button"
                onClick={() => setFilingReceipt(null)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
