import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Printer,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Building2,
  Calendar,
  Clock,
  User,
  Phone,
  ShieldCheck,
  Package,
  ArrowRightLeft,
  DollarSign,
  QrCode,
  Wallet,
  CreditCard,
} from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

export interface VoucherItem {
  product_name: string;
  sku?: string;
  hsn_code?: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
  tax_amount?: number;
  discount_amount?: number;
  line_total: number;
  reason?: string;
  disposition?: "restock" | "damaged" | "inspection" | string;
}

export interface VoucherExchangeItem {
  product_name: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
  line_total: number;
}

export interface StandardVoucherData {
  voucherType: "return" | "cancellation" | "exchange";
  voucherNumber: string;
  voucherDate: string;
  voucherTime?: string;
  originalInvoiceNo: string;
  originalInvoiceDate?: string;
  // Org details
  organization: {
    name: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    gstin?: string;
    phone?: string;
    email?: string;
    logo_url?: string;
  };
  // Customer details
  customer: {
    name: string;
    phone?: string;
    email?: string;
    gstin?: string;
    address?: string;
  };
  // Items
  items: VoucherItem[];
  exchangeItems?: VoucherExchangeItem[];
  // Financial breakdown
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  settlementMethod: "cash" | "upi" | "store_credit" | "credit_note" | "card" | "exchange" | string;
  creditNoteNumber?: string;
  debitNoteNumber?: string;
  exchangeInvoiceNumber?: string;
  exchangeTotal?: number;
  difference?: number;
  // Reason & Audit
  reason?: string;
  notes?: string;
  cashierName?: string;
  restockedCount?: number;
}

export interface StandardVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucher: StandardVoucherData | null;
}

// Convert numbers to Indian English Words
function numberToWordsINR(amount: number): string {
  const num = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - num) * 100);

  const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertTwoDigits(n: number): string {
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + units[n % 10] : "");
  }

  function convertChunk(n: number): string {
    if (n === 0) return "";
    let str = "";
    if (n >= 100) {
      str += units[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n > 0) {
      str += convertTwoDigits(n);
    }
    return str.trim();
  }

  if (num === 0 && paise === 0) return "Zero Rupees Only";

  let words = "";
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const remainder = num % 1000;

  if (crore > 0) words += convertChunk(crore) + " Crore ";
  if (lakh > 0) words += convertChunk(lakh) + " Lakh ";
  if (thousand > 0) words += convertChunk(thousand) + " Thousand ";
  if (remainder > 0) words += convertChunk(remainder);

  words = words.trim();
  let result = words ? `${words} Rupees` : "";

  if (paise > 0) {
    const paiseWords = convertTwoDigits(paise);
    result += (result ? " and " : "") + `${paiseWords} Paise`;
  }

  return (result + " Only").trim();
}

export function StandardVoucherModal({ isOpen, onClose, voucher }: StandardVoucherModalProps) {
  const { formatCurrency } = useCurrency();

  if (!isOpen || !voucher) return null;

  const isCancel = voucher.voucherType === "cancellation";
  const isExchange = voucher.voucherType === "exchange";

  const handlePrint = () => {
    window.print();
  };

  const getMethodBadge = () => {
    const m = (voucher.settlementMethod || "cash").toLowerCase();
    switch (m) {
      case "cash":
        return { label: "Cash Payout / Refund", icon: DollarSign, color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
      case "upi":
        return { label: "UPI Instant Transfer", icon: QrCode, color: "text-blue-700 bg-blue-50 border-blue-200" };
      case "store_credit":
        return { label: "Store Credit Balance", icon: Wallet, color: "text-purple-700 bg-purple-50 border-purple-200" };
      case "credit_note":
        return { label: "Statutory Credit Note", icon: FileText, color: "text-indigo-700 bg-indigo-50 border-indigo-200" };
      case "card":
        return { label: "Card Refund (POS)", icon: CreditCard, color: "text-sky-700 bg-sky-50 border-sky-200" };
      case "exchange":
        return { label: "Product Exchange Voucher", icon: ArrowRightLeft, color: "text-amber-700 bg-amber-50 border-amber-200" };
      default:
        return { label: m.toUpperCase(), icon: DollarSign, color: "text-slate-700 bg-slate-50 border-slate-200" };
    }
  };

  const methodBadge = getMethodBadge();
  const MethodIcon = methodBadge.icon;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-3 sm:p-5 backdrop-blur-xs">
        {/* Isolated Print Styles — prevents printing modals, backgrounds, toasts or overlays */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden !important;
            }
            #standard-voucher-printable, #standard-voucher-printable * {
              visibility: visible !important;
            }
            #standard-voucher-printable {
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 24px !important;
              background: #ffffff !important;
              color: #0f172a !important;
              box-shadow: none !important;
              border: none !important;
              z-index: 9999999 !important;
              font-size: 11px !important;
            }
            .voucher-no-print, [data-sonner-toaster], .sonner-toast, header, nav, aside {
              display: none !important;
            }
          }
        `}} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 voucher-modal-container"
        >
          {/* Modal Toolbar (hidden during print) */}
          <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between voucher-no-print">
            <div className="flex items-center gap-2">
              {isCancel ? (
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              ) : isExchange ? (
                <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
              ) : (
                <RotateCcw className="w-4 h-4 text-rose-400" />
              )}
              <span className="text-xs font-bold tracking-tight uppercase">
                {isCancel
                  ? "Invoice Cancellation Voucher"
                  : isExchange
                  ? "Merchandise Exchange Voucher"
                  : "Sales Return Slip & Voucher"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Voucher
              </button>
              <button
                onClick={onClose}
                className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════ */}
          {/* PRINTABLE SLIP DOCUMENT BODY                                  */}
          {/* ═════════════════════════════════════════════════════════════ */}
          <div
            id="standard-voucher-printable"
            className="p-6 sm:p-8 overflow-y-auto space-y-4 font-sans text-slate-800 bg-white"
          >
            {/* 1. Official Organization Header */}
            <div className="text-center border-b border-dashed border-slate-300 pb-4">
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 uppercase">
                {voucher.organization.name || "Business Enterprise"}
              </h2>
              {voucher.organization.address && (
                <p className="text-xs text-slate-600 mt-0.5 leading-snug">
                  {voucher.organization.address}
                  {voucher.organization.city ? `, ${voucher.organization.city}` : ""}
                  {voucher.organization.state ? `, ${voucher.organization.state}` : ""}
                  {voucher.organization.pincode ? ` - ${voucher.organization.pincode}` : ""}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-slate-500 mt-1 font-medium">
                {voucher.organization.gstin && (
                  <span className="font-mono">
                    GSTIN: <b>{voucher.organization.gstin}</b>
                  </span>
                )}
                {voucher.organization.phone && (
                  <span>Phone: <b>{voucher.organization.phone}</b></span>
                )}
                {voucher.organization.email && (
                  <span>Email: <b>{voucher.organization.email}</b></span>
                )}
              </div>

              {/* Title Badge Banner */}
              <div className="mt-3">
                <span
                  className={`inline-block px-3.5 py-1 rounded-full font-black text-[11px] tracking-wider uppercase border shadow-2xs ${
                    isCancel
                      ? "bg-rose-50 text-rose-700 border-rose-300"
                      : isExchange
                      ? "bg-purple-50 text-purple-700 border-purple-300"
                      : "bg-indigo-50 text-indigo-700 border-indigo-300"
                  }`}
                >
                  {isCancel
                    ? "Official Invoice Cancellation & Restock Voucher"
                    : isExchange
                    ? "Official Product Exchange & Settlement Voucher"
                    : "Official Sales Return & Refund Voucher"}
                </span>
              </div>
            </div>

            {/* 2. Voucher & Invoice Metadata (Neat 2-Column Grid) */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200 text-xs">
              <div className="space-y-1">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Voucher Reference:</span>
                  <span className="font-mono font-black text-rose-600 text-xs sm:text-sm">
                    {voucher.voucherNumber}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Against Invoice #:</span>
                  <span className="font-mono font-bold text-indigo-700 text-xs">
                    {voucher.originalInvoiceNo}
                  </span>
                </div>
                {voucher.originalInvoiceDate && (
                  <div className="text-[11px] text-slate-500">
                    Orig. Date: <span className="font-medium text-slate-700">{voucher.originalInvoiceDate}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1 text-right">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Voucher Date & Time:</span>
                  <span className="font-semibold text-slate-900">
                    {voucher.voucherDate} {voucher.voucherTime || ""}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Authorized Officer:</span>
                  <span className="font-medium text-slate-700">
                    {voucher.cashierName || "Store Counter"}
                  </span>
                </div>
                {voucher.creditNoteNumber && (
                  <div className="text-[11px] text-indigo-700 font-mono font-bold">
                    Credit Note #: {voucher.creditNoteNumber}
                  </div>
                )}
                {voucher.debitNoteNumber && (
                  <div className="text-[11px] text-amber-700 font-mono font-bold">
                    Debit Note #: {voucher.debitNoteNumber}
                  </div>
                )}
                {voucher.exchangeInvoiceNumber && (
                  <div className="text-[11px] text-purple-700 font-mono font-bold">
                    New Bill #: {voucher.exchangeInvoiceNumber}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Customer / Party Information */}
            <div className="p-3 border border-slate-200 rounded-xl bg-white text-xs">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">
                Customer / Party Details:
              </span>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-bold text-slate-900 text-sm">
                  {voucher.customer.name || "Walk-in Guest"}
                </div>
                {voucher.customer.phone && (
                  <div className="text-slate-600 font-mono font-medium">
                    Phone: {voucher.customer.phone}
                  </div>
                )}
              </div>
              {voucher.customer.gstin && (
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                  GSTIN: <b>{voucher.customer.gstin}</b>
                </div>
              )}
              {voucher.customer.address && (
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Address: {voucher.customer.address}
                </div>
              )}
            </div>

            {/* 4. Products Table (Returned / Cancelled) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <span>{isCancel ? "Cancelled Items (Inventory Restocked)" : "Returned Items (Restocked to Inventory)"}</span>
                <span className="text-emerald-700 font-bold font-mono">
                  {voucher.items.reduce((s, it) => s + it.quantity, 0)} Units Restocked
                </span>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold text-[11px]">
                    <tr>
                      <th className="py-2 px-3">Item Description</th>
                      <th className="py-2 px-2 text-center w-16">HSN</th>
                      <th className="py-2 px-2 text-center w-14">Qty</th>
                      <th className="py-2 px-3 text-right w-20">Rate</th>
                      <th className="py-2 px-2 text-center w-14">GST</th>
                      <th className="py-2 px-3 text-right w-24">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {voucher.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-900">{it.product_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {it.sku ? `SKU: ${it.sku}` : ""}
                            {it.reason ? ` • Reason: ${it.reason}` : ""}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center text-slate-500 font-mono text-[10px]">
                          {it.hsn_code || "—"}
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-slate-800">
                          {it.quantity}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-700">
                          {formatCurrency(it.unit_price)}
                        </td>
                        <td className="py-2 px-2 text-center text-slate-500 text-[10px]">
                          {it.tax_rate ? `${it.tax_rate}%` : "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(it.line_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* If Exchange: Issued New Products Table */}
            {voucher.exchangeItems && voucher.exchangeItems.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
                  Issued Replacement Items
                </div>
                <div className="border border-purple-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-purple-50 border-b border-purple-200 text-purple-900 font-bold text-[11px]">
                      <tr>
                        <th className="py-2 px-3">Replacement Item</th>
                        <th className="py-2 px-2 text-center w-14">Qty</th>
                        <th className="py-2 px-3 text-right w-20">Rate</th>
                        <th className="py-2 px-3 text-right w-24">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-100">
                      {voucher.exchangeItems.map((ex, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-bold text-slate-900">{ex.product_name}</td>
                          <td className="py-2 px-2 text-center font-bold text-slate-800">{ex.quantity}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700">{formatCurrency(ex.unit_price)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-purple-700">
                            {formatCurrency(ex.line_total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 5. Financial & Reversal Summary */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="space-y-1 border-b border-slate-200 pb-2">
                <div className="flex justify-between text-slate-600">
                  <span>Gross Merchandise Value:</span>
                  <span className="font-mono font-semibold">{formatCurrency(voucher.subtotal)}</span>
                </div>
                {voucher.taxAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>GST Output Tax Reversal:</span>
                    <span className="font-mono">{formatCurrency(voucher.taxAmount)}</span>
                  </div>
                )}
                {voucher.exchangeTotal !== undefined && (
                  <div className="flex justify-between text-purple-700 font-medium">
                    <span>Replacement Goods Total:</span>
                    <span className="font-mono">{formatCurrency(voucher.exchangeTotal)}</span>
                  </div>
                )}
              </div>

              {/* Net Payout / Refund */}
              <div className="flex justify-between items-center text-slate-900 font-black text-sm pt-0.5">
                <span>
                  {isCancel
                    ? "Total Cancelled & Refunded:"
                    : isExchange && voucher.difference !== undefined
                    ? voucher.difference > 0
                      ? "Net Balance Collected:"
                      : "Net Balance Refunded:"
                    : "Total Refund Amount:"}
                </span>
                <span className="font-mono text-rose-600 text-base">
                  {formatCurrency(voucher.difference !== undefined ? Math.abs(voucher.difference) : voucher.totalAmount)}
                </span>
              </div>

              {/* Amount in words */}
              <div className="text-[10px] text-slate-500 italic bg-white p-2 rounded border border-slate-200">
                Amount in Words: <b>{numberToWordsINR(voucher.difference !== undefined ? Math.abs(voucher.difference) : voucher.totalAmount)}</b>
              </div>

              {/* Settlement Mode Pill */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span>Settlement Mode:</span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase border ${methodBadge.color}`}>
                    <MethodIcon className="w-3 h-3" />
                    {methodBadge.label}
                  </span>
                </div>

                <div className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  RESTOCKED & VERIFIED
                </div>
              </div>
            </div>

            {/* 6. Remarks / Reason */}
            {voucher.reason && (
              <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50 text-[11px] text-amber-900 space-y-0.5">
                <span className="font-bold block uppercase text-[10px] text-amber-700">
                  {isCancel ? "Cancellation Reason & Notes:" : "Return Reason & Notes:"}
                </span>
                <p className="italic">{voucher.reason}</p>
                {voucher.notes && <p className="text-[10px] text-slate-600">{voucher.notes}</p>}
              </div>
            )}

            {/* Audit Trail Note */}
            <p className="text-[9.5px] text-slate-400 text-center leading-normal">
              * This is a computer-generated voucher issued by {voucher.organization.name}. Item quantities have been restored to store inventory and accounting reversals have been recorded in accordance with statutory compliance.
            </p>

            {/* 7. Signatures & Stamp Blocks */}
            <div className="pt-6 sm:pt-8 flex justify-between items-end border-t border-dashed border-slate-300 text-[11px] text-slate-500">
              <div className="text-center space-y-1">
                <div className="w-32 border-b border-slate-300" />
                <span className="block text-[10px] uppercase font-bold text-slate-400">Customer Signature</span>
              </div>

              <div className="text-center space-y-1">
                <div className="w-36 border-b border-slate-300" />
                <span className="block text-[10px] uppercase font-bold text-slate-400">Store Authorized Signatory</span>
              </div>
            </div>
          </div>

          {/* Modal Footer Controls (hidden during print) */}
          <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 voucher-no-print">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2 text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Voucher
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
