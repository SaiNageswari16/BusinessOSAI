'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from "@/contexts/i18n-context";
import { Printer, X, FileText, Download, Share2, Check, RefreshCw, ZoomIn, ZoomOut, MessageCircle, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { generateThermalReceiptHtml, printThermalReceiptInvoice, printHtmlInPage, thermalReceiptHtmlToPdfBase64 } from '@/lib/print-helper';
import { useTenant } from '@/contexts/tenant-context';
import { useCurrency } from '@/hooks/use-currency';
import { getActiveBillingGst } from '@/lib/receipt-template-store';
import { companiesApi, posApi, invoicesApi } from '@/lib/api-client';
import { useWhatsAppStatus } from '@/hooks/use-whatsapp-status';

export interface ThermalReceiptPreviewModalProps {
  invoice: any | null;
  isOpen: boolean;
  onClose: () => void;
  onSwitchToA4?: (invoice: any) => void;
  autoPrint?: boolean;
}

export function ThermalReceiptPreviewModal({
  invoice,
  isOpen,
  onClose,
  onSwitchToA4,
  autoPrint = false,
}: ThermalReceiptPreviewModalProps) {
  const { t } = useI18n();
  const { tenant } = useTenant();
  const { currency, formatCurrency } = useCurrency();
  const [paperSize, setPaperSize] = useState<'80mm' | '58mm'>('80mm');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [resolvedInvoice, setResolvedInvoice] = useState<any>(invoice);
  const { isOnline: isWhatsAppOnline, status: waStatus } = useWhatsAppStatus();

  // Fetch complete backend invoice data (items, HSN, batches, taxes, customer details)
  useEffect(() => {
    if (!invoice) return;
    setResolvedInvoice(invoice);

    const invId = invoice.id || invoice.invoice_id;
    if (invId && typeof invId === 'string' && invId.length > 5) {
      invoicesApi.getInvoice(invId).then((remote: any) => {
        if (remote) {
          setResolvedInvoice((prev: any) => ({
            ...prev,
            ...remote,
            items: remote.items && remote.items.length > 0 ? remote.items : prev?.items,
            customer_name: remote.customer_name || remote.customer?.name || prev?.customer_name,
            customer_phone: remote.customer_phone || remote.customer?.phone || prev?.customer_phone,
            customer_gstin: remote.customer_gstin || remote.customer?.tax_number || remote.customer?.gst_number || prev?.customer_gstin,
            customer_address: remote.billing_address || remote.customer?.billing_address || prev?.customer_address || prev?.customer_billing_address,
            cgst_amount: remote.cgst_amount ?? prev?.cgst_amount,
            sgst_amount: remote.sgst_amount ?? prev?.sgst_amount,
            igst_amount: remote.igst_amount ?? prev?.igst_amount,
            total_tax: remote.tax_amount ?? remote.total_tax ?? prev?.total_tax,
            subtotal: remote.subtotal ?? prev?.subtotal,
            grand_total: remote.total_amount ?? remote.grand_total ?? prev?.grand_total,
            amount_received: remote.amount_paid ?? remote.amount_received ?? prev?.amount_received,
          }));
        }
      }).catch((err) => {
        console.warn("Could not fetch remote invoice for thermal print:", err);
      });
    }
  }, [invoice]);

  const [htmlPreview, setHtmlPreview] = useState<string>(() => {
    if (!invoice) return '';
    try {
      return generateThermalReceiptHtml(invoice, { paperSize: '80mm' }, tenant?.id);
    } catch (e) {
      console.error('Initial thermal preview error:', e);
      return '';
    }
  });
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState<boolean>(false);
  const hasAutoPrintedRef = useRef(false);

  useEffect(() => {
    if (isOpen && resolvedInvoice && autoPrint && !hasAutoPrintedRef.current) {
      hasAutoPrintedRef.current = true;
      const timer = setTimeout(() => {
        handleDirectPrint();
      }, 350);
      return () => clearTimeout(timer);
    }
    if (!isOpen) {
      hasAutoPrintedRef.current = false;
    }
  }, [isOpen, resolvedInvoice, autoPrint]);

  useEffect(() => {
    if (!resolvedInvoice || !isOpen) return;

    // First regenerate with current localStorage data
    try {
      const html = generateThermalReceiptHtml(resolvedInvoice, { paperSize }, tenant?.id);
      setHtmlPreview(html);
    } catch (e) {
      console.error('Failed to generate thermal preview HTML:', e);
    }

    // Then fetch live company data from API and refresh
    companiesApi.list(1, 10).then((res) => {
      if (res?.items && res.items.length > 0) {
        const active = res.items.find((c: any) => c.is_active) || res.items[0];
        if (active && tenant?.id) {
          try {
            localStorage.setItem(`bos_active_company_${tenant.id}`, JSON.stringify(active));
            const existingGstRaw = localStorage.getItem(`bos_active_billing_gst_details_${tenant.id}`);
            const existingGst = existingGstRaw ? JSON.parse(existingGstRaw) : {};
            const merged = {
              ...existingGst,
              ...(active.name ? { trade_name: active.name } : {}),
              ...(active.legal_name ? { legal_name: active.legal_name } : {}),
              ...(active.gstin ? { gstin: active.gstin } : {}),
              ...(active.address ? { address: active.address } : {}),
              ...(active.phone ? { phone: active.phone } : {}),
              ...(active.email ? { email: active.email } : {}),
              ...(active.logo_url ? { logo_url: active.logo_url } : {}),
              ...(active.google_review_url ? { google_review_url: active.google_review_url } : {}),
            };
            localStorage.setItem(`bos_active_billing_gst_details_${tenant.id}`, JSON.stringify(merged));
          } catch {}
          // Re-generate HTML with freshly updated localStorage
          try {
            const freshHtml = generateThermalReceiptHtml(resolvedInvoice, { paperSize }, tenant?.id);
            setHtmlPreview(freshHtml);
          } catch {}
        }
      }
    }).catch(() => {});
  }, [resolvedInvoice, isOpen, paperSize, tenant?.id]);

  if (!isOpen || !invoice) return null;

  const handleDirectPrint = () => {
    setIsPrinting(true);
    try {
      printThermalReceiptInvoice(resolvedInvoice || invoice, { paperSize }, tenant?.id);
      toast.success(t('Thermal print command sent to printer', 'Thermal print command sent to printer'));
    } catch (e: any) {
      toast.error(e?.message || t('Failed to send to printer', 'Failed to send to printer'));
    } finally {
      setTimeout(() => setIsPrinting(false), 500);
    }
  };

  const handleSendWhatsApp = async () => {
    const curInv = resolvedInvoice || invoice;
    let phone = (curInv.customer_phone || curInv.phone || '').trim();
    if (!phone) {
      const input = window.prompt("Enter customer WhatsApp phone number (10 digits):");
      if (!input) return;
      phone = input.trim();
    }
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      toast.error("Please enter a valid 10-digit WhatsApp number.");
      return;
    }
    try {
      setIsSendingWhatsApp(true);
      toast.loading("Preparing & sending thermal receipt via WhatsApp...", { id: `wa-modal-${curInv.id || curInv.invoice_number}` });
      const pdfBase64 = await thermalReceiptHtmlToPdfBase64(htmlPreview, paperSize);
      const res = await posApi.sendThermalReceiptWhatsApp(curInv.id || curInv.invoice_number, pdfBase64, cleanPhone);
      if (res?.success) {
        toast.success(`Thermal receipt sent via WhatsApp to ${cleanPhone}!`, { id: `wa-modal-${curInv.id || curInv.invoice_number}` });
      } else {
        toast.error(`WhatsApp send failed: ${res?.error || 'Unknown error'}`, { id: `wa-modal-${curInv.id || curInv.invoice_number}` });
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to send receipt via WhatsApp", { id: `wa-modal-${curInv.id || curInv.invoice_number}` });
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const invoiceNumber = invoice.invoice_number || invoice.id || 'INV-001';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center shrink-0">
              <Printer className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm text-white tracking-wide">
                  {t('Thermal Receipt Preview', 'Thermal Receipt Preview')}
                </h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-300 font-bold border border-teal-500/30">
                  {invoiceNumber}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {t('In-app POS receipt viewer & direct thermal printing', 'In-app POS receipt viewer & direct thermal printing')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Paper Size Selector */}
            <div className="flex items-center bg-slate-800 rounded-xl p-0.5 border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setPaperSize('80mm')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  paperSize === '80mm'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                80mm (3")
              </button>
              <button
                type="button"
                onClick={() => setPaperSize('58mm')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  paperSize === '58mm'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                58mm (2")
              </button>
            </div>

            {/* Switch to A4 PDF button */}
            {onSwitchToA4 && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSwitchToA4(invoice);
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white rounded-xl text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
                title="Switch to A4 Tax Invoice Format"
              >
                <FileText className="size-3.5" />
                <span>A4 Invoice</span>
              </button>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors cursor-pointer"
              title="Close Preview"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Toolbar & Controls */}
        <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">
              {t('Zoom', 'Zoom')}: {zoomLevel}%
            </span>
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(70, z - 10))}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(100)}
                className="px-1.5 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                title="Reset Zoom"
              >
                100%
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="size-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSendWhatsApp}
              disabled={isSendingWhatsApp}
              title={isWhatsAppOnline ? "WhatsApp is Online & Ready to Send" : "Warning: WhatsApp appears to be Offline"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <MessageCircle className="size-3.5" />
              <span>{isSendingWhatsApp ? t('Sending...', 'Sending...') : t('Send WhatsApp', 'Send WhatsApp')}</span>
              <span
                className={`size-2 rounded-full ring-1 ring-white ${
                  isWhatsAppOnline ? "bg-emerald-300 animate-pulse" : "bg-amber-300"
                }`}
                title={isWhatsAppOnline ? "Online" : "Offline"}
              />
            </button>
            <button
              type="button"
              onClick={handleDirectPrint}
              disabled={isPrinting}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-black shadow-md shadow-teal-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Printer className="size-4" />
              <span>{isPrinting ? t('Printing...', 'Printing...') : t('Print Receipt Now', 'Print Receipt Now')}</span>
            </button>
          </div>
        </div>

        {/* Receipt Preview Canvas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/80 dark:bg-slate-950 flex items-start justify-center">
          <div
            style={{
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease',
            }}
            className="flex justify-center shrink-0"
          >
            {htmlPreview ? (
              <iframe
                srcDoc={htmlPreview}
                className="bg-white rounded-xl shadow-2xl border border-slate-300 overflow-hidden"
                style={{
                  width: paperSize === '58mm' ? '320px' : '400px',
                  height: '680px',
                  border: 'none',
                }}
                title="Thermal Receipt Live Preview"
              />
            ) : (
              <div className="py-12 text-center text-slate-400 font-mono text-xs">
                Generating receipt preview...
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            💡 {t('Tip: Prints silently via attached POS/Thermal printer without opening separate popup windows.', 'Tip: Prints silently via attached POS/Thermal printer without opening separate popup windows.')}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              {t('Close', 'Close')}
            </button>
            <button
              type="button"
              onClick={handleSendWhatsApp}
              disabled={isSendingWhatsApp}
              title={isWhatsAppOnline ? "WhatsApp is Online & Ready to Send" : "Warning: WhatsApp appears to be Offline"}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50"
            >
              <MessageCircle className="size-3.5" />
              <span>{isSendingWhatsApp ? t('Sending...', 'Sending...') : t('Send WhatsApp', 'Send WhatsApp')}</span>
              <span
                className={`size-2 rounded-full ring-1 ring-white ${
                  isWhatsAppOnline ? "bg-emerald-300 animate-pulse" : "bg-amber-300"
                }`}
                title={isWhatsAppOnline ? "Online" : "Offline"}
              />
            </button>
            <button
              type="button"
              onClick={handleDirectPrint}
              disabled={isPrinting}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              <Printer className="size-3.5" />
              <span>{t('Print', 'Print')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
