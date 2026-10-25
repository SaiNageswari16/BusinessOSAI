import React, { useState, useEffect } from 'react';
import { 
  X, 
  Printer, 
  MessageCircle, 
  Mail, 
  Download, 
  FileText, 
  CheckCircle2, 
  Copy, 
  Phone,
  Receipt
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { useCurrency } from '@/hooks/use-currency';
import { useTenant } from '@/contexts/tenant-context';
import { inventoryApi } from '@/lib/api-client';
import { FullInvoicePrinter, FullInvoiceData } from '../pos/FullInvoicePrinter';
import { getActiveBillingGst } from '@/lib/receipt-template-store';
import { formatDisplayDate } from '@/lib/utils';

interface ProcurementShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentData: any;
  docType?: 'PINV' | 'PO' | 'PR';
}

export function ProcurementShareModal({
  isOpen,
  onClose,
  documentData,
  docType = 'PINV'
}: ProcurementShareModalProps) {
  const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();
  const [activeTab, setActiveTab] = useState<'preview' | 'whatsapp' | 'email'>('whatsapp');
  const [isPdfPrinterOpen, setIsPdfPrinterOpen] = useState<boolean>(false);
  const [phoneInput, setPhoneInput] = useState<string>('');
  const [emailInput, setEmailInput] = useState<string>('');
  const [productHsnMap, setProductHsnMap] = useState<Record<string, string>>({});

  // Extract variables safely even when documentData is null
  const docNumber = documentData?.bill_number || documentData?.po_number || documentData?.request_number || documentData?.id?.slice(0, 8) || 'DOC-001';
  const supp = documentData?.supplier;
  const supplierName = documentData?.supplier_name || supp?.name || documentData?.customerName || 'Vendor Partner';
  const supplierPhone = documentData?.supplier_phone || supp?.phone || supp?.contacts?.[0]?.phone || '';
  const supplierEmail = documentData?.supplier_email || supp?.email || supp?.contacts?.[0]?.email || '';
  // Full vendor party details (persisted on the Supplier record / OCR-extracted)
  const supplierGst = (supp?.gst_number || supp?.tax_id || supp?.gstin || '').trim().toUpperCase();
  const supplierPan = (supp?.pan || '').trim().toUpperCase();
  const supplierAddress = [
    supp?.address,
    supp?.city,
    supp?.state,
    supp?.pincode,
  ].filter(Boolean).join(', ').trim() || supp?.address || '';
  const supplierCompany = supp?.company_name || supplierName;
  
  const totalAmount = Number(documentData?.total_amount || documentData?.grand_total || 0);
  const paidAmount = Number(documentData?.paid_amount || documentData?.amount_received || 0);
  const paymentStatus = documentData?.status || (paidAmount >= totalAmount && totalAmount > 0 ? 'Paid' : 'Unpaid');
  // Prefer the bill's own captured line values (item_overrides) when present — they
  // are the EXACT numbers the user entered on this bill. Fall back to the PO lines
  // only when a bill was created without persisted overrides.
  const billItems = documentData?.items || [];
  const overrideItems: any[] = (documentData?.item_overrides && documentData.item_overrides.length > 0)
    ? documentData.item_overrides.map((ov: any) => ({
        product_id: ov.product_id,
        product_name: ov.product_name,
        quantity: ov.quantity,
        unit_price: ov.unit_price,
        tax_percent: ov.tax_percent,
        hsn_code: ov.hsn_code,
        sku: ov.sku,
        uom: ov.uom,
      }))
    : [];
  const items = overrideItems.length > 0 ? overrideItems : billItems;

  // Sync phone and email when documentData changes
  useEffect(() => {
    if (documentData) {
      setPhoneInput(supplierPhone);
      setEmailInput(supplierEmail);
    }
  }, [documentData, supplierPhone, supplierEmail]);

  // Fetch product HSN mapping if missing from any invoice items
  useEffect(() => {
    if (!documentData || !items || items.length === 0) return;
    const missingHsn = items.some((it: any) => !(it.hsn_code || it.hsn || it.hsn_sac || it.product?.hsn_code));
    if (missingHsn) {
      inventoryApi.getProducts({ page_size: 1000 })
        .then((res: any) => {
          const prods = Array.isArray(res) ? res : (res?.items || []);
          const map: Record<string, string> = {};
          prods.forEach((p: any) => {
            if (p.hsn_code) {
              if (p.id) map[String(p.id).toLowerCase()] = p.hsn_code;
              if (p.name) map[String(p.name).trim().toLowerCase()] = p.hsn_code;
              if (p.sku) map[String(p.sku).trim().toLowerCase()] = p.hsn_code;
            }
          });
          setProductHsnMap(map);
        })
        .catch((err) => {
          console.warn('Failed to load inventory products for HSN resolution:', err);
        });
    }
  }, [documentData, items]);

  // Build a merged map of per-line values captured at billing time (item_overrides),
  // keyed by BOTH product_id and product_name (lowercased). These are the exact
  // values the user entered on THIS bill, and they override the PO line values so
  // the rendered document reflects what was actually billed — not the current PO.
  const overridesByProduct = React.useMemo(() => {
    const map: Record<string, any> = {};
    const list = documentData?.item_overrides || [];
    list.forEach((ov: any) => {
      const idKey = ov.product_id ? String(ov.product_id).toLowerCase() : '';
      const nameKey = ov.product_name ? String(ov.product_name).trim().toLowerCase() : '';
      if (idKey) map[idKey] = ov;
      if (nameKey) map[nameKey] = ov;
    });
    return map;
  }, [documentData]);

  // Active Store / Tenant details
  const activeCompanyId = typeof window !== 'undefined' ? localStorage.getItem('bos_active_company_id') : undefined;
  const activeGst = getActiveBillingGst(tenant?.id, activeCompanyId || undefined);

  const isDummyVal = (v?: string | null, type?: 'name' | 'address' | 'gst' | 'phone' | 'email'): boolean => {
    if (!v || typeof v !== 'string') return true;
    const lower = v.toLowerCase().trim();
    if (type === 'name') {
      return lower === 'head office' || lower === 'venatic' || lower === 'businessos store' || lower === 'company' || lower === 'organization' || lower.includes('acme');
    }
    if (type === 'address') {
      return lower.includes('cauvery block') || lower.includes('national games village') || lower.includes('madanapalli') || lower.includes('proddatur');
    }
    if (type === 'gst') {
      return lower.includes('29aaach7489r1zx');
    }
    if (type === 'phone') {
      return lower.includes('9876543210') || lower.includes('919876543210') || lower.includes('9849344919');
    }
    if (type === 'email') {
      return lower.includes('billing@venatic.com') || lower.includes('venatic.store');
    }
    return false;
  };

  let storedComp: any = null;
  try {
    const rawC = (activeCompanyId ? localStorage.getItem(`bos_active_company_${tenant?.id}_${activeCompanyId}`) : null) || localStorage.getItem('bos_active_company');
    if (rawC) storedComp = JSON.parse(rawC);
  } catch {}

  const activeComp = (tenant as any)?.raw || storedComp || (tenant as any) || {};
  const primaryReg = activeComp?.gst_registrations?.find((r: any) => r.is_primary) || activeComp?.gst_registrations?.[0];

  const orgName =
    (!isDummyVal(tenant?.name, 'name') ? tenant?.name : '') ||
    (!isDummyVal(activeComp?.name, 'name') ? activeComp?.name : '') ||
    (!isDummyVal(primaryReg?.trade_name, 'name') ? primaryReg?.trade_name : '') ||
    (!isDummyVal(activeGst?.trade_name, 'name') ? activeGst?.trade_name : '') ||
    (!isDummyVal(activeGst?.legal_name, 'name') ? activeGst?.legal_name : '') ||
    tenant?.name ||
    'Organization';

  const orgGstin =
    (!isDummyVal(primaryReg?.gstin, 'gst') ? primaryReg?.gstin : '') ||
    (!isDummyVal(activeComp?.gst_number || activeComp?.gstin, 'gst') ? (activeComp?.gst_number || activeComp?.gstin) : '') ||
    (!isDummyVal(activeGst?.gstin, 'gst') ? activeGst?.gstin : '') ||
    '';

  const orgAddress =
    (!isDummyVal(primaryReg?.address, 'address') ? primaryReg?.address : '') ||
    (!isDummyVal(activeComp?.address, 'address') ? activeComp?.address : '') ||
    (!isDummyVal(activeGst?.address, 'address') ? activeGst?.address : '') ||
    '';

  const orgPhone =
    (!isDummyVal(activeComp?.phone, 'phone') ? activeComp?.phone : '') ||
    (!isDummyVal(activeGst?.phone, 'phone') ? activeGst?.phone : '') ||
    '';

  const orgEmail =
    (!isDummyVal(activeComp?.email, 'email') ? activeComp?.email : '') ||
    (!isDummyVal(activeGst?.email, 'email') ? activeGst?.email : '') ||
    '';

  const orgLogo =
    (activeComp?.logo_url && !activeComp.logo_url.includes('/Logo.png') ? activeComp.logo_url : null) ||
    (activeGst?.logo_url && !activeGst.logo_url.includes('/Logo.png') ? activeGst.logo_url : null) ||
    (tenant?.logo_url && !tenant.logo_url.includes('/Logo.png') ? tenant.logo_url : null) ||
    null;

  // Place of supply: derive from the supplier's GSTIN state code (2 digits) when
  // available, else fall back to the supplier's state field. This is what GST
  // regulations require for inter-state CGST/SGST vs IGST determination.
  const supplierGstCode = supplierGst.slice(0, 2);
  const supplierStateCode = supplierGstCode.length === 2 && !isNaN(Number(supplierGstCode))
    ? supplierGstCode
    : (supp?.state || activeGst?.state_code || '');

  // Formatted FullInvoiceData for PDF Printer
  const fullInvoiceData: FullInvoiceData = {
    doc_type: 'purchase_invoice',
    header_title: docType === 'PO' ? 'Purchase Order' : (docType === 'PR' ? 'Purchase Requisition' : 'Purchase Invoice & Bill'),
    invoice_number: docNumber,
    po_number: documentData?.po_number || supp?.po_number || '',
    grn_reference: documentData?.grn_number || '',
    invoice_date: documentData?.bill_date || documentData?.order_date || documentData?.created_at || new Date().toISOString(),
    due_date: documentData?.due_date || documentData?.delivery_date,
    place_of_supply: supplierStateCode ? `${supplierStateCode} - ${supp?.state || activeGst?.state_name || 'N/A'}` : undefined,
    seller_name: orgName,
    seller_trade_name: orgName,
    company_name: orgName,
    companyName: orgName,
    store_name: orgName,
    storeName: orgName,
    seller_gstin: orgGstin,
    company_gstin: orgGstin,
    seller_address: orgAddress,
    company_address: orgAddress,
    seller_phone: orgPhone,
    company_phone: orgPhone,
    seller_email: orgEmail,
    company_email: orgEmail,
    seller_logo_url: orgLogo,
    customerName: supplierName,
    customerPhone: phoneInput,
    customerEmail: emailInput,
    customerCompany: supplierCompany,
    customerGST: supplierGst,
    customerPan: supplierPan,
    customerAddress: supplierAddress,
    items: items.map((it: any) => {
      // 1) Look up the bill-level override for this line (exact values as captured
      //    at billing time). Overrides win over PO line values so the document
      //    matches what the user actually entered on this purchase invoice.
      const pName = (it.product_name || it.name || '').trim().toLowerCase();
      const pId = it.product_id ? String(it.product_id).toLowerCase() : '';
      const ov = (pId && overridesByProduct[pId]) || (pName && overridesByProduct[pName]) || null;

      // 2) Resolve HSN with priority: override → PO line → product catalog lookup
      const rawHsn =
        ov?.hsn_code ||
        it.hsn_code ||
        it.hsn ||
        it.hsn_sac ||
        (it as any).hsnCode ||
        it.product?.hsn_code ||
        it.product?.hsn ||
        (pId && productHsnMap[pId]) ||
        (pName && productHsnMap[pName]) ||
        '';

      const hsnCode = typeof rawHsn === 'string' ? rawHsn.trim() : String(rawHsn || '').trim();

      // 3) Resolve numeric fields: override → PO line → 0
      const qty = Number(ov?.quantity ?? it.quantity ?? 1) || 1;
      const unitPrice = Number(ov?.unit_price ?? it.unit_price ?? 0) || 0;
      const taxPct = Number(ov?.tax_percent ?? it.tax_percent ?? 0) || 0;
      const mrp = Number(ov?.mrp ?? it.mrp ?? 0) || 0;
      const sellPrice = Number(ov?.selling_price ?? it.selling_price ?? mrp ?? 0) || 0;
      const isTaxIncl = Boolean(ov?.is_tax_inclusive ?? it.is_tax_inclusive);

      // 4) Compute the line subtotal the same way computeGstBreakdown does:
      //    inclusive → price already includes tax; exclusive → tax added on top
      const grossAfterDisc = Math.max(0, qty * unitPrice);
      const lineTax = isTaxIncl && taxPct > 0 ? (grossAfterDisc - grossAfterDisc / (1 + taxPct / 100)) : grossAfterDisc * (taxPct / 100);
      const lineSubtotal = isTaxIncl ? grossAfterDisc : grossAfterDisc + lineTax;

      return {
        product_id: it.product_id,
        product_name: it.product_name || it.name || 'Material Item',
        hsn_code: hsnCode,
        hsn: hsnCode,
        sku: it.sku || it.product_sku || '',
        barcode: it.barcode || '',
        uom: ov?.uom || it.uom || '',
        mrp,
        selling_price: sellPrice,
        quantity: qty,
        unit_price: unitPrice,
        tax_rate: taxPct,
        is_tax_inclusive: isTaxIncl,
        discount_amount: Number(it.discount_amount ?? 0) || 0,
        discount_type: 'amount',
        subtotal: lineSubtotal,
      };
    }),
    subtotal: Number(documentData?.subtotal || 0) || items.reduce((acc: number, it: any) => {
      const qty = Number(it.quantity) || 1;
      const price = Number(it.unit_price) || 0;
      const rate = Number(it.tax_rate ?? it.tax_percent) || 0;
      const gross = qty * price;
      return acc + (it.is_tax_inclusive ? (gross / (1 + rate / 100)) : gross);
    }, 0),
    tax_amount: Number(documentData?.tax_amount || 0) || items.reduce((acc: number, it: any) => {
      const qty = Number(it.quantity) || 1;
      const price = Number(it.unit_price) || 0;
      const rate = Number(it.tax_rate ?? it.tax_percent) || 0;
      const gross = qty * price;
      return acc + (it.is_tax_inclusive ? (gross - gross / (1 + rate / 100)) : gross * (rate / 100));
    }, 0),
    round_off: Number(documentData?.round_off || 0),
    grand_total: totalAmount,
    amount_received: paidAmount,
    payment_status: paymentStatus,
    payment_method: 'Direct Settlement / Bank Transfer',
    notes: docType === 'PO' ? 'Official Purchase Order' : 'Verified Purchase Invoice & Bill',
  };

  const docTitle = docType === 'PO' ? 'Purchase Order' : (docType === 'PR' ? 'Purchase Requisition' : 'Purchase Invoice & Bill');

  // WhatsApp Message Generator
  const generateWhatsAppMessage = () => {
    const lines = [
      `*${orgName}*`,
      `📄 *${docTitle.toUpperCase()}*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `*Document Number:* ${docNumber}`,
      `*Vendor:* ${supplierName}`,
      `*Date:* ${formatDisplayDate(new Date())}`,
      `*Items Count:* ${items.length} item(s)`,
      documentData?.round_off ? `*Round Off:* ${documentData.round_off >= 0 ? '+' : ''}${currency.symbol}${Number(documentData.round_off).toFixed(2)}` : '',
      `*Total Amount:* ${currency.symbol}${totalAmount.toLocaleString('en-IN')}`,
      `*Payment Status:* ${paymentStatus}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `Thank you for your business!`,
      orgPhone ? `📞 Contact: ${orgPhone}` : ''
    ].filter(Boolean);

    return lines.join('\n');
  };

  const handleSendWhatsApp = async () => {
    const cleanPhone = phoneInput.replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      toast.error('Please enter a valid 10-digit WhatsApp phone number.');
      return;
    }
    // Prefer the backend dispatch: generates the SAME A4 PDF as the print preview
    // and sends it through the WhatsApp gateway with the official caption + audit trail.
    const billId = documentData?.id;
    if (billId) {
      try {
        toast.info(`Sending ${docTitle} PDF to ${supplierName} via WhatsApp...`);
        const res = await inventoryApi.sendVendorBillWhatsApp(String(billId), cleanPhone);
        if (res?.success) {
          toast.success(`Purchase invoice sent to ${cleanPhone} via WhatsApp!`);
          onClose();
          return;
        }
        // Backend failed (e.g. gateway down) — fall through to manual wa.me
        if (res?.detail) toast.warning(String(res.detail));
      } catch (e: any) {
        console.warn('Vendor bill WhatsApp backend dispatch failed, opening manual chat:', e);
      }
    }
    // Fallback: open a manual WhatsApp chat with the plain-text summary
    const message = generateWhatsAppMessage();
    const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
    toast.success(`WhatsApp chat opened for ${supplierName}!`);
  };

  const handleSendEmail = () => {
    if (!emailInput || !emailInput.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }
    const subject = `${docTitle} #${docNumber} from ${orgName}`;
    const body = generateWhatsAppMessage().replace(/\*/g, '');
    const mailtoUrl = `mailto:${emailInput}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
    toast.success(`Email client opened for ${emailInput}!`);
  };

  const copyTextToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  // Safe early exit for render ONLY after all hooks are executed
  if (!isOpen || !documentData) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="p-6 bg-gradient-to-r from-teal-600 via-indigo-600 to-purple-600 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shadow-inner">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-lg tracking-tight leading-tight">{docTitle} Dispatch & PDF</h3>
                <p className="text-white/80 text-xs font-medium mt-0.5 font-mono">{docNumber} • {supplierName}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="size-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Nav Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-2 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('whatsapp')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'whatsapp' 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <MessageCircle className="size-4" /> WhatsApp Dispatch
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('email')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'email' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Mail className="size-4" /> Email Dispatch
            </button>
            <button
              type="button"
              onClick={() => {
                setIsPdfPrinterOpen(true);
              }}
              className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Printer className="size-4 text-teal-400" /> View / Print PDF
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {/* Quick Summary Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">Document Ref</span>
                <span className="font-mono font-bold text-primary">{docNumber}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">Vendor Party</span>
                <span className="font-bold text-foreground truncate block">{supplierName}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">Total Invoiced</span>
                <span className="font-bold text-foreground">{formatCurrency(totalAmount)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium">Status</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                  <CheckCircle2 className="size-3" /> {paymentStatus}
                </span>
              </div>
            </div>

            {/* WhatsApp View */}
            {activeTab === 'whatsapp' && (
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Phone className="size-3.5 text-emerald-600" /> Recipient WhatsApp Mobile Number:
                </label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="e.g. 919876543210" 
                    value={phoneInput} 
                    onChange={(e) => setPhoneInput(e.target.value)}
                    className="font-mono text-sm rounded-xl"
                  />
                  <Button 
                    type="button" 
                    onClick={handleSendWhatsApp}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl gap-1.5 shrink-0 shadow-md"
                  >
                    <MessageCircle className="size-4" /> Send Now
                  </Button>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-[11px] text-emerald-900 dark:text-emerald-300">
                  ⚡ Opens instant WhatsApp chat with pre-formatted invoice breakdown and store branding.
                </div>
              </div>
            )}

            {/* Email View */}
            {activeTab === 'email' && (
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Mail className="size-3.5 text-indigo-600" /> Recipient Vendor Email Address:
                </label>
                <div className="flex gap-2">
                  <Input 
                    type="email"
                    placeholder="vendor@company.com" 
                    value={emailInput} 
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="text-sm rounded-xl"
                  />
                  <Button 
                    type="button" 
                    onClick={handleSendEmail}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl gap-1.5 shrink-0 shadow-md"
                  >
                    <Mail className="size-4" /> Open Email
                  </Button>
                </div>
                <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 text-[11px] text-indigo-900 dark:text-indigo-300">
                  ✉️ Launches default email client with structured document subject, vendor greeting, and complete invoice tally.
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copyTextToClipboard(generateWhatsAppMessage())}
              className="text-xs rounded-xl gap-1.5 font-semibold"
            >
              <Copy className="size-3.5" /> Copy Summary
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="text-xs rounded-xl font-bold"
              >
                Close
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setIsPdfPrinterOpen(true)}
                className="bg-slate-900 hover:bg-black text-white text-xs rounded-xl font-bold gap-1.5 shadow-md"
              >
                <FileText className="size-3.5 text-teal-400" /> Full A4 PDF
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Modal with Template Selection */}
      <FullInvoicePrinter
        invoice={fullInvoiceData}
        isOpen={isPdfPrinterOpen}
        onClose={() => setIsPdfPrinterOpen(false)}
        autoPrint={false}
      />
    </>
  );
}
