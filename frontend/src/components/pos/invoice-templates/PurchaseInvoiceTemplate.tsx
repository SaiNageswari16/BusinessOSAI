import React from "react";
import { useI18n } from "@/contexts/i18n-context";
import type { FullInvoiceData } from "../FullInvoicePrinter";
import { formatDisplayDate, isInvoiceLineFree } from "@/lib/utils";
import { getActiveBillingGst } from "@/lib/receipt-template-store";

export interface PurchaseInvoiceTemplateProps {
  invoice: FullInvoiceData;
  dynamicStoreName?: string;
  dynamicLogoUrl?: string;
  dynamicAddress?: string;
  dynamicPhone?: string;
  dynamicEmail?: string;
  sellerGstin?: string;
  sellerStateCode?: string;
  dynamicBank?: string;
  currency?: { symbol: string; code: string };
  f?: any;
  template?: any;
}

/**
 * Dedicated Purchase Invoice / Vendor Bill template.
 *
 * Used as the LAST-RESORT layout for purchase documents (doc_type purchase_invoice,
 * PINV, vendor bills): the party blocks read "Supplier / Vendor | Our Company (Purchaser)"
 * and the item grid carries every column from the bill-extraction form —
 * S.NO, ITEM (SKU/barcode + FREE badge), HSN/SAC, UOM, EXP DATE, MRP, SELL PRICE,
 * QTY, RATE, DISC, GST %, AMOUNT (+ per-line tax) and the FREE column.
 *
 * It is selected automatically for purchase docs on the default template, so the
 * sales template selection flow is never affected.
 */
export function PurchaseInvoiceTemplate({
  invoice,
  dynamicStoreName = "",
  dynamicLogoUrl = "",
  dynamicAddress = "",
  dynamicPhone = "",
  dynamicEmail = "",
  sellerGstin = "",
  sellerStateCode = "29",
  dynamicBank = "",
  currency = { symbol: "₹", code: "INR" },
  f,
}: PurchaseInvoiceTemplateProps) {
  const { t } = useI18n();
  const activeGst = getActiveBillingGst(undefined) as any;

  // ── Purchaser (our company) ────────────────────────────────────────────
  const orgName =
    dynamicStoreName ||
    (invoice as any).seller_name ||
    (invoice as any).company_name ||
    activeGst?.trade_name ||
    "Our Organization";
  const orgAddress =
    dynamicAddress ||
    (invoice as any).seller_address ||
    (invoice as any).company_address ||
    activeGst?.address ||
    "";
  const orgGstin = sellerGstin || activeGst?.gstin || "";
  const orgPhone = dynamicPhone || (invoice as any).seller_phone || activeGst?.phone || "";
  const orgEmail = dynamicEmail || (invoice as any).seller_email || activeGst?.email || "";

  // ── Supplier / Vendor party ───────────────────────────────────────────
  const supplierName =
    invoice.customerName || invoice.customerCompany || (invoice as any).supplier_name || "Supplier / Vendor";
  const supplierGst = (invoice.customerGST || (invoice as any).customer_gstin || "").toUpperCase();
  const supplierPan = (invoice.customerPan || (invoice as any).supplier_pan || "").toUpperCase();
  const supplierAddress =
    invoice.customerAddress || invoice.customerBillingAddress || (invoice as any).supplier_address || "";
  const supplierPhone = invoice.customerPhone || (invoice as any).supplier_phone || "";
  const supplierEmail = invoice.customerEmail || (invoice as any).supplier_email || "";

  // ── Meta ────────────────────────────────────────────────────────────────
  const billNo = invoice.invoice_number || "—";
  const poRef = (invoice as any).po_number || (invoice as any).po_reference || "";
  const grnRef = (invoice as any).grn_reference || (invoice as any).grn_number || "";
  const billDate = formatDisplayDate(invoice.invoice_date || invoice.created_at);
  const dueDate = invoice.due_date ? formatDisplayDate(invoice.due_date) : "";
  const payStatus = String(invoice.payment_status || (invoice as any).status || "").toUpperCase();

  // ── Line math (mirrors the extraction form: MRP/Sell/QTY/RATE/DISC/GST/AMOUNT + line tax)
  const lines = (invoice.items || []).map((raw: any) => {
    const isFree = isInvoiceLineFree(raw) || Number(raw.unit_price || 0) <= 0.009;
    const qty = Number(raw.quantity || raw.qty || 1);
    const rate = isFree ? 0 : Number(raw.unit_price ?? raw.price ?? 0);
    const mrp = Number(raw.mrp || 0);
    const sell = Number(raw.selling_price || raw.mrp || 0);
    const taxRate = isFree ? 0 : Number(raw.tax_rate ?? raw.tax_percent ?? 0);
    const discType = String(raw.discount_type || "percent").toLowerCase();
    const isAmtDisc = discType === "amount" || discType === "fixed";
    const discRaw = Number(raw.discount_value ?? raw.discount_amount ?? raw.discount ?? 0) || 0;
    const discAmt = isFree ? 0 : isAmtDisc ? Math.min(discRaw, qty * rate) : (qty * rate * Math.min(100, discRaw)) / 100;
    const afterDisc = Math.max(0, qty * rate - discAmt);
    const inclusive = raw.is_tax_inclusive === true;
    const lineTax = isFree ? 0 : inclusive ? afterDisc - afterDisc / (1 + taxRate / 100) : (afterDisc * taxRate) / 100;
    const lineAmount = isFree ? 0 : inclusive ? afterDisc : afterDisc + lineTax;
    return {
      raw,
      isFree,
      qty,
      rate,
      mrp,
      sell,
      taxRate,
      discRaw,
      isAmtDisc,
      lineTax,
      lineAmount,
      uom: raw.selected_uom || raw.uom || raw.measuring_unit || raw.unit || "PCS",
      hsn: raw.hsn_code || raw.hsn || raw.hsn_sac || "",
      batch: raw.batch_number || raw.batch || "",
      expiry: raw.expiry_date || raw.exp_date || "",
      sku: raw.sku || raw.product_code || "",
      barcode: raw.barcode || "",
      name: raw.product_name || raw.name || "Material Item",
    };
  });

  const totalLineTax = lines.reduce((a, l) => a + l.lineTax, 0);
  const totalDisc = lines.reduce((a, l) => a + (l.isFree ? 0 : l.isAmtDisc ? l.discRaw : (l.qty * l.rate * Math.min(100, l.discRaw)) / 100), 0);
  const grandTotal =
    Number(invoice.grand_total || 0) > 0
      ? Number(invoice.grand_total)
      : lines.reduce((a, l) => a + l.lineAmount, 0);
  const amountPaid = Number(invoice.amount_received ?? 0);
  const balanceDue = Math.max(0, grandTotal - amountPaid);
  const statusUpper = String(invoice.payment_status || (invoice as any).status || "").toLowerCase();
  const isPaid = statusUpper === "paid" || (grandTotal > 0 && balanceDue <= 0.01);

  const fmtExp = (v: string) => {
    if (!v || String(v).toLowerCase().includes("dd-mm-yyyy")) return "—";
    const s = String(v).trim().split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split("-");
      return `${d}-${m}-${y}`;
    }
    return s;
  };

  const cols = [
    "w-[4%]", "min-w-[190px]", "w-[9%]", "w-[6%]", "w-[8%]", "w-[7%]", "w-[8%]",
    "w-[6%]", "w-[8%]", "w-[7%]", "w-[6%]", "w-[9%]", "w-[6%]",
  ];

  return (
    <div className="bg-white text-slate-900 w-full max-w-[794px] mx-auto p-6 sm:p-8 text-[10.5px] leading-normal select-text">
      {/* ── Top: Our Company (Purchaser) + Document Title ─────────────────── */}
      <div className="flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {dynamicLogoUrl && !dynamicLogoUrl.includes("/Logo.png") ? (
            <img src={dynamicLogoUrl} alt="logo" className="h-12 w-12 object-contain rounded bg-white" />
          ) : (
            <div className="h-12 w-12 rounded bg-slate-900 text-white flex items-center justify-center font-black text-xl">
              {orgName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-black text-base text-slate-950 leading-tight uppercase tracking-tight truncate">{orgName}</h1>
            {orgAddress && <p className="text-[9.5px] text-slate-600 leading-snug mt-0.5">{orgAddress}</p>}
            <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[9.5px] text-slate-600 mt-0.5 font-medium">
              {orgGstin && <span className="font-mono font-bold text-slate-800">GSTIN: {orgGstin}</span>}
              {orgPhone && <span>Phone: {orgPhone}</span>}
              {orgEmail && <span>{orgEmail}</span>}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="inline-flex items-center gap-1.5">
            <span className="text-[8.5px] font-black uppercase px-2 py-0.5 rounded border border-slate-300 bg-slate-100 text-slate-700 tracking-wider">
              {invoice.copy_type || "ORIGINAL FOR RECIPIENT"}
            </span>
          </div>
          <h2 className="text-lg font-black tracking-tight uppercase text-slate-900 mt-1">
            Purchase Invoice / Vendor Bill
          </h2>
          <div className="flex flex-wrap justify-end gap-x-3 text-[9.5px] text-slate-500 font-medium mt-1">
            <span><span className="text-slate-400 font-bold">Bill No:</span> <span className="font-mono font-bold text-slate-900">{billNo}</span></span>
            {poRef && <span><span className="text-slate-400 font-bold">PO Ref:</span> <span className="font-mono font-bold text-slate-900">{poRef}</span></span>}
            {grnRef && <span><span className="text-slate-400 font-bold">GRN:</span> <span className="font-mono font-bold text-slate-900">{grnRef}</span></span>}
            <span><span className="text-slate-400 font-bold">Date:</span> <span className="font-bold text-slate-900">{billDate}</span></span>
            {dueDate && <span><span className="text-slate-400 font-bold">Due:</span> <span className="font-bold text-slate-900">{dueDate}</span></span>}
            {payStatus && (
              <span className={`px-1.5 py-0.2 rounded-full text-[8px] font-black uppercase ${isPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {payStatus}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Party row: Supplier (left) | Our Company as Purchaser (right) ─── */}
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
            <span className="text-[8.5px] font-black uppercase tracking-widest text-slate-400">Supplier / Vendor Party</span>
          </div>
          <div className="font-black text-slate-950 text-[12px] leading-snug">{supplierName}</div>
          {supplierAddress && <p className="text-[9px] text-slate-600 leading-snug mt-0.5">{supplierAddress}</p>}
          <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[9px] text-slate-600 font-medium mt-1">
            {supplierGst && <span className="font-mono font-bold text-slate-800 bg-white px-1 py-0.5 rounded border border-slate-200">GSTIN: {supplierGst}</span>}
            {supplierPan && <span className="font-mono font-bold text-slate-800 bg-white px-1 py-0.5 rounded border border-slate-200">PAN: {supplierPan}</span>}
            {supplierPhone && <span>Ph: {supplierPhone}</span>}
            {supplierEmail && <span>{supplierEmail}</span>}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            <span className="text-[8.5px] font-black uppercase tracking-widest text-slate-400">Purchaser (Our Organization)</span>
          </div>
          <div className="font-black text-slate-950 text-[12px] leading-snug">{orgName}</div>
          {orgAddress && <p className="text-[9px] text-slate-600 leading-snug mt-0.5">{orgAddress}</p>}
          <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[9px] text-slate-600 font-medium mt-1">
            {orgGstin && <span className="font-mono font-bold text-slate-800 bg-white px-1 py-0.5 rounded border border-slate-200">GSTIN: {orgGstin}</span>}
            {orgPhone && <span>Ph: {orgPhone}</span>}
            {orgEmail && <span>{orgEmail}</span>}
          </div>
        </div>
      </div>

      {/* ── Items: every extracted column ─────────────────────────────────── */}
      <div className="mt-3 overflow-hidden rounded-lg border border-slate-300">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white text-[8.5px] font-black uppercase tracking-wider">
              <th className={cols[0] + " py-2 px-1.5 text-center"}>S.No</th>
              <th className={cols[1] + " py-2 px-2 text-left"}>Item Description &amp; Notes</th>
              <th className={cols[2] + " py-2 px-1.5 text-center"}>HSN/SAC</th>
              <th className={cols[3] + " py-2 px-1.5 text-center"}>UOM</th>
              <th className={cols[4] + " py-2 px-1.5 text-center"}>Exp Date</th>
              <th className={cols[5] + " py-2 px-1.5 text-right"}>MRP</th>
              <th className={cols[6] + " py-2 px-1.5 text-right"}>Sell Price</th>
              <th className={cols[7] + " py-2 px-1.5 text-center"}>Qty</th>
              <th className={cols[8] + " py-2 px-1.5 text-right"}>Rate</th>
              <th className={cols[9] + " py-2 px-1.5 text-center"}>Disc</th>
              <th className={cols[10] + " py-2 px-1.5 text-center"}>GST%</th>
              <th className={cols[11] + " py-2 px-1.5 text-right"}>Amount</th>
              <th className={cols[12] + " py-2 px-1.5 text-center"}>Free</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l, i) => (
              <tr key={i} className={i % 2 === 1 ? "bg-slate-50/50" : "bg-white"}>
                <td className="py-2 px-1.5 text-center font-bold text-slate-400 font-mono">{i + 1}</td>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-900 text-[10.5px]">{l.name}</span>
                    {l.isFree && (
                      <span className="bg-emerald-600 text-white text-[7.5px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">FREE</span>
                    )}
                  </div>
                  {(l.sku || l.barcode) && (
                    <div className="text-[8.5px] text-slate-500 font-mono mt-0.5 flex flex-wrap gap-x-2">
                      {l.sku && <span>SKU: {l.sku}</span>}
                      {l.barcode && <span>Barcode: {l.barcode}</span>}
                      {l.batch && <span>Batch: {l.batch}</span>}
                    </div>
                  )}
                </td>
                <td className="py-2 px-1.5 text-center font-mono text-[9px] text-slate-600">
                  {l.hsn ? <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{l.hsn}</span> : <span className="text-slate-300">—</span>}
                </td>
                <td className="py-2 px-1.5 text-center font-bold text-slate-700 text-[9px] uppercase">{l.uom}</td>
                <td className="py-2 px-1.5 text-center font-mono text-[9px] text-slate-600">{fmtExp(l.expiry)}</td>
                <td className="py-2 px-1.5 text-right font-mono text-[9.5px] text-slate-600">{l.mrp > 0 ? currency.symbol + l.mrp.toFixed(2) : <span className="text-slate-300">—</span>}</td>
                <td className="py-2 px-1.5 text-right font-mono text-[9.5px] text-slate-700 font-semibold">{l.sell > 0 ? currency.symbol + l.sell.toFixed(2) : <span className="text-slate-300">—</span>}</td>
                <td className="py-2 px-1.5 text-center font-extrabold text-slate-900 font-mono text-[10px]">{l.qty}</td>
                <td className="py-2 px-1.5 text-right font-mono text-[9.5px] text-slate-700">{l.isFree ? <span className="text-emerald-700 font-bold">0.00</span> : currency.symbol + l.rate.toFixed(2)}</td>
                <td className="py-2 px-1.5 text-center font-mono text-[9.5px]">
                  {l.isFree || l.discRaw <= 0 ? <span className="text-slate-300">—</span> : (
                    <span className="text-emerald-600 font-bold">{l.isAmtDisc ? currency.symbol + l.discRaw.toFixed(2) : `${l.discRaw}%`}</span>
                  )}
                </td>
                <td className="py-2 px-1.5 text-center font-mono text-[9.5px] text-slate-600">{l.taxRate > 0 ? `${l.taxRate}%` : <span className="text-slate-300">—</span>}</td>
                <td className="py-2 px-1.5 text-right">
                  <span className={`font-mono font-black text-[10.5px] ${l.isFree ? "text-emerald-700" : "text-slate-900"}`}>
                    {currency.symbol}{l.lineAmount.toFixed(2)}
                  </span>
                  {l.lineTax > 0 && <span className="block text-[8px] text-slate-400 font-mono">Tax: {currency.symbol}{l.lineTax.toFixed(2)}</span>}
                </td>
                <td className="py-2 px-1.5 text-center">
                  {l.isFree ? (
                    <span className="bg-emerald-600 text-white text-[7.5px] font-black px-1.5 py-0.5 rounded uppercase">FREE</span>
                  ) : (
                    <span className="text-slate-300 text-[9px]">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100/90 border-t-2 border-slate-300">
              <td colSpan={5} className="py-2 px-2 text-left text-[9px] font-black uppercase text-slate-500">
                Total Items: {lines.length} {lines.length === 1 ? "Line" : "Lines"}
              </td>
              <td colSpan={2} className="py-2 px-1.5 text-center text-[9px] font-black text-slate-600">
                <span className="block text-slate-400 text-[7.5px] uppercase">Total Qty</span>
                {lines.reduce((a, l) => a + l.qty, 0)}
              </td>
              <td colSpan={2} className="py-2 px-1.5 text-center text-[9px] text-slate-600">
                <span className="block text-[7.5px] uppercase text-slate-400">Disc</span>
                {totalDisc > 0 ? `-${currency.symbol}${totalDisc.toFixed(2)}` : "—"}
              </td>
              <td className="py-2 px-1.5 text-right font-black font-mono text-slate-950 text-[10.5px]">{currency.symbol}{totalLineTax.toFixed(2)}<span className="block text-[7.5px] text-slate-400 font-sans uppercase">Tax</span></td>
              <td className="py-2 px-1.5 text-center text-[8px] text-slate-400 font-bold uppercase">Tax {sellerStateCode ? `(${sellerStateCode})` : ""}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Totals + Terms + Signatures ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="space-y-1.5">
          <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Billing Financial Summary</div>
          <div className="space-y-1 text-[10px]">
            <div className="flex justify-between"><span className="text-slate-500">Gross Subtotal</span><span className="font-mono font-bold">{currency.symbol}{(Number(invoice.subtotal || 0) || lines.reduce((a, l) => a + l.qty * l.rate, 0)).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Total Discount</span><span className="font-mono font-bold text-emerald-700">{totalDisc > 0 ? `-${currency.symbol}${totalDisc.toFixed(2)}` : "—"}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Total GST</span><span className="font-mono font-bold">{currency.symbol}{totalLineTax.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Round Off</span><span className="font-mono font-bold">{currency.symbol}{Number(invoice.round_off || 0).toFixed(2)}</span></div>
            <div className="flex justify-between border-t-2 border-slate-900 pt-1.5"><span className="font-black text-[11px]">GRAND TOTAL</span><span className="font-mono font-black text-[12px] text-slate-950">{currency.symbol}{grandTotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Amount Paid / Received</span><span className="font-mono font-bold">{currency.symbol}{amountPaid.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Balance Due</span><span className={`font-mono font-black ${balanceDue > 0 ? "text-rose-700" : "text-emerald-700"}`}>{currency.symbol}{balanceDue.toFixed(2)}</span></div>
          </div>
        </div>
        <div className="space-y-2">
          {(invoice.notes || (f?.showTerms && (invoice.terms || activeGst?.terms_and_conditions))) ? (
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Terms &amp; Conditions</div>
              <p className="text-[9px] text-slate-600 leading-snug whitespace-pre-line">
                {invoice.notes || invoice.terms || activeGst?.terms_and_conditions || ""}
              </p>
            </div>
          ) : null}
          {dynamicBank && (
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Bank / Payment Details</div>
              <p className="text-[9px] text-slate-600 leading-snug break-words">{dynamicBank}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 pt-6 mt-auto">
            <div className="text-center">
              <div className="border-t border-slate-300 pt-1.5 text-[8.5px] font-bold text-slate-500 uppercase tracking-wider">For {orgName}</div>
              <div className="text-[8px] text-slate-400">Authorized Signatory</div>
            </div>
            <div className="text-center">
              <div className="border-t border-slate-300 pt-1.5 text-[8.5px] font-bold text-slate-500 uppercase tracking-wider">Supplier / Vendor</div>
              <div className="text-[8px] text-slate-400">{supplierName}</div>
            </div>
          </div>
        </div>
      </div>

      {isPaid && (
        <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-300 px-3 py-1.5 text-center">
          <span className="text-[9.5px] font-black text-emerald-700 uppercase tracking-widest">✓ Paid in Full — Balance Settled</span>
        </div>
      )}
      <p className="text-[7.5px] text-slate-400 text-center mt-3">{t("pos.generated", "System generated purchase invoice")}{billNo ? ` · ${billNo}` : ""}</p>
    </div>
  );
}
