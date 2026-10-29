import React from "react";
import { useI18n } from "@/contexts/i18n-context";
import type { FullInvoiceData } from "../FullInvoicePrinter";
import { numberToIndianWords } from "@/lib/number-to-words";
import { formatDisplayDate, isInvoiceLineFree, formatPartyAddress } from "@/lib/utils";
import { getOrgSignatureSettings, getActiveBillingGst } from "@/lib/receipt-template-store";

interface TemplateProps {
  invoice: FullInvoiceData;
  dynamicStoreName: string;
  dynamicLogoUrl: string;
  dynamicAddress: string;
  dynamicPhone: string;
  dynamicEmail?: string;
  sellerGstin: string;
  sellerStateCode?: string;
  dynamicBank?: string;
  currency: { symbol: string; code: string };
  f?: any;
  paperSize?: "A4" | "A5";
  orientation?: "portrait" | "landscape";
}

/**
 * GST-Tally / myBillBook "Advanced GST" style A4 invoice.
 * Fully dynamic: every section is gated by the template's `f` toggles so the
 * Content / Branding / Settings tabs in the template designer drive it live.
 * Designed to comfortably carry ~15 line items on a single A4 portrait page.
 */
export function GstTallyTemplate({
  invoice,
  dynamicStoreName,
  dynamicLogoUrl,
  dynamicAddress,
  dynamicPhone,
  dynamicEmail,
  sellerGstin,
  sellerStateCode,
  dynamicBank,
  currency,
  f = {},
  paperSize = "A4",
  orientation = "portrait",
}: TemplateProps) {
  const { t } = useI18n();
  const isA5 = paperSize === "A5";
  const items = invoice.items || [];

  const sigSettings = getOrgSignatureSettings() as any;
  const activeGst = getActiveBillingGst() as any;
  const signatureUrl =
    sigSettings.showDigitalSignature !== false && sigSettings.show_digital_signature !== false
      ? sigSettings.signatureUrl || sigSettings.signature_url || activeGst?.signature_url
      : null;
  const stampUrl =
    sigSettings.showDigitalStamp !== false && sigSettings.show_digital_stamp !== false
      ? sigSettings.stampUrl || sigSettings.stamp_url || activeGst?.stamp_url
      : null;
  const sigTitle =
    sigSettings.signatureTitle || sigSettings.signature_title || activeGst?.signature_title || "Authorised Signatory";
  const sigCompany = sigSettings.signatureCompanyName || sigSettings.signature_company_name || dynamicStoreName;

  // ── Totals (prefer computed values on the invoice, else derive from items) ──
  const grandTotal = Number(invoice.grand_total || invoice.total_amount || 0);
  const subtotalBase = Number(invoice.subtotal ?? invoice.taxable_value ?? 0);
  const discountAmount = Number(invoice.discount_amount || 0);
  const taxableValue = Number(
    invoice.taxable_value || (subtotalBase ? subtotalBase - discountAmount : Math.max(grandTotal - (Number(invoice.tax_amount) || 0), 0))
  );
  const cgstAmount = Number(invoice.cgst_amount || 0);
  const sgstAmount = Number(invoice.sgst_amount || 0);
  const igstAmount = Number(invoice.igst_amount || 0);
  const totalTax = Number(invoice.tax_amount || cgstAmount + sgstAmount + igstAmount || 0);
  const totalDiscount = Number(
    invoice.total_discount !== undefined
      ? invoice.total_discount
      : items.reduce((acc: number, it: any) => acc + (Number(it.discount_value) || 0), discountAmount)
  );

  // Derive GST slabs from items when the invoice does not pre-compute them
  const slabs: any[] = Array.isArray(invoice.tax_slabs) ? (invoice.tax_slabs as any[]) : [];
  const isInter = Boolean(invoice.is_interstate || igstAmount > 0);
  const slabMap = new Map<number, { rate: number; taxable: number; cgst: number; sgst: number; igst: number; tax: number }>();
  if (slabs.length > 0) {
    slabs.forEach((s) => {
      const rate = Number(s.rate ?? s.gst_rate ?? 0);
      slabMap.set(rate, { rate, taxable: Number(s.taxable ?? s.taxable_value ?? 0), cgst: Number(s.cgst ?? 0), sgst: Number(s.sgst ?? 0), igst: Number(s.igst ?? 0), tax: Number(s.tax ?? s.total_tax ?? (Number(s.cgst ?? 0) + Number(s.sgst ?? 0) + Number(s.igst ?? 0))) });
    });
  } else {
    items.forEach((item: any) => {
      const qty = Number(item.quantity || 0);
      const rate = Number(item.tax_rate ?? 0);
      const disc = Number(item.discount_value || 0);
      const taxableLine = qty * Number(item.unit_price || 0) - disc;
      const halfTax = (taxableLine * rate) / 100 / 2;
      const row = slabMap.get(rate) || { rate, taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0 };
      row.taxable += taxableLine;
      if (isInter) {
        row.igst += halfTax * 2;
        row.tax += halfTax * 2;
      } else {
        row.cgst += halfTax;
        row.sgst += halfTax;
        row.tax += halfTax * 2;
      }
      slabMap.set(rate, row);
    });
    if (slabMap.size === 0 && taxableValue > 0) {
      slabMap.set(0, { rate: 0, taxable: taxableValue, cgst: 0, sgst: 0, igst: 0, tax: totalTax });
    }
  }
  const slabRows = Array.from(slabMap.values()).sort((a, b) => b.rate - a.rate);

  const roundedTotal = Math.round(grandTotal);
  const roundOff = Math.round(grandTotal * 100) / 100 - grandTotal;
  const amountReceived = Number(invoice.amount_received ?? 0);
  const balanceDue = Number(invoice.balance_due ?? Math.max(grandTotal - amountReceived, 0));
  const isFullyPaid = amountReceived > 0 && balanceDue <= 0.009;

  const partyPreviousBalance = Number(invoice.party_previous_balance ?? 0);
  const partyCurrentBalance = Number(invoice.party_current_balance ?? (partyPreviousBalance + balanceDue));

  const fmt = (n: number) =>
    currency.symbol + (isNaN(n) ? "0.00" : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

  const showHsn = f.showHSN !== false;
  const showBatch = f.showBatchNumber !== false;
  const showMfgExp = f.showExpMfgDates !== false;
  const showUom = f.showItemDescription !== false || f.showSecondaryUnit !== false;
  const showQty = f.showItemQty !== false;
  const showRate = f.showItemRate !== false;
  const showGstRateCol = f.showGstRateCol !== false;
  const showDiscCol = f.showDiscountCol !== false;
  const showTaxSplit = f.showTaxSplit !== false;
  const showPartyBalance = f.showPartyBalance !== false;
  const showBank = f.showBankDetails !== false;
  const showPo = f.showPoNumber !== false;
  const showVeh = f.showVehicleNumber !== false;
  const showEway = f.showEwayBill !== false;
  const showChallan = f.showChallanNumber !== false;
  const showBillTo = f.showBillTo !== false;
  const showShipTo = f.showShipTo !== false;
  const showPos = f.showPlaceOfSupply !== false;
  const showPartyGstin = f.showPartyGstin !== false;
  const showPartyPhone = f.showPartyPhone !== false;

  return (
    <div
      className={`w-full bg-white text-black ${isA5 ? "text-[8px] leading-tight p-1" : "text-[10px] leading-tight p-2.5"} font-sans border border-black/60 print:border-none`}
      style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
    >
      {/* ─── TOP 3-BOX HEADER ─── */}
      <div className="grid grid-cols-12 border-b-2 border-black">
        {/* Left Box: Seller / Company */}
        {f.showCompanyDetails !== false && (
          <div className={`col-span-4 p-2 border-r-2 border-black flex flex-col justify-between ${f.showInvoiceDetails !== false ? "" : "col-span-12 border-r-0"}`}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                {f.showLogo !== false && dynamicLogoUrl && dynamicLogoUrl !== "/Logo.png" && (
                  <img src={dynamicLogoUrl} alt="Logo" className="h-9 max-w-[90px] object-contain" />
                )}
                <div className="min-w-0">
                  <h2 className="font-extrabold text-[13px] uppercase tracking-tight text-slate-900 leading-snug">
                    {dynamicStoreName}
                  </h2>
                  <p className="text-[9px] text-gray-700 leading-snug mt-0.5">{dynamicAddress}</p>
                </div>
              </div>
              <div className="text-[9px] text-gray-800 space-y-0.5 mt-1.5">
                {dynamicPhone && <p>Ph: {dynamicPhone}</p>}
                {dynamicEmail && f.showEmail !== false && <p>Mail: {dynamicEmail}</p>}
              </div>
            </div>
            <div className="mt-2 pt-1 border-t border-gray-300 text-[9px] space-y-0.5">
              <p className="font-bold">
                GSTIN : <span className="font-mono">{sellerGstin || "-"}</span>
              </p>
              {(activeGst?.pan || (invoice as any).seller_pan) && (
                <p>
                  PAN : <span className="font-mono">{(invoice as any).seller_pan || activeGst?.pan}</span>
                </p>
              )}
              {(activeGst?.cin || (invoice as any).seller_cin) && (
                <p>
                  CIN : <span className="font-mono">{(invoice as any).seller_cin || activeGst?.cin}</span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Center Box: Document Title & Invoice Meta */}
        {f.showInvoiceDetails !== false && (
          <div className="col-span-4 p-1.5 border-r-2 border-black flex flex-col justify-between text-center bg-black/[0.04]">
            <div>
              <h1 className="text-[15px] font-black tracking-[0.15em] text-slate-900 uppercase">
                {invoice.header_title || (invoice as any).documentTitle || t("TAX INVOICE", "TAX INVOICE")}
              </h1>
              <span className="text-[8px] font-extrabold tracking-wider uppercase block mb-1 border border-slate-500 bg-slate-100 px-1 py-0.5 rounded inline-block">
                {invoice.copy_type || "ORIGINAL FOR RECIPIENT"}
              </span>
            </div>

            <table className="w-full text-left text-[8px] border border-black border-collapse bg-transparent font-mono">
              <tbody>
                <tr className="border-b border-black/40">
                  <td className="p-0.5 font-sans font-bold border-r border-black/40 w-[38%]">
                    Invoice No
                  </td>
                  <td className="p-0.5 font-bold border-r border-black/40">
                    {invoice.invoice_number || "-"}
                  </td>
                  <td className="p-0.5 font-sans font-bold border-r border-black/40 w-[24%]">Invoice Date</td>
                  <td className="p-0.5 font-bold">{formatDisplayDate(invoice.invoice_date || invoice.created_at || new Date())}</td>
                </tr>
                {(showPo || showChallan) && (
                  <tr className="border-b border-black/40">
                    {showPo && (
                      <>
                        <td className="p-0.5 font-sans font-bold border-r border-black/40 w-[38%]">PO / Order Ref</td>
                        <td className="p-0.5 font-bold border-r border-black/40">
                          {invoice.po_number || invoice.po_reference || "-"}
                        </td>
                      </>
                    )}
                    {showChallan && (
                      <>
                        <td className="p-0.5 font-sans font-bold border-r border-black/40 w-[24%]">Challan No</td>
                        <td className="p-0.5 font-bold">{invoice.challan_number || invoice.delivery_challan_number || "-"}</td>
                      </>
                    )}
                  </tr>
                )}
                <tr>
                  <td className="p-0.5 font-sans font-bold border-r border-black/40 w-[38%]">
                    {f.showPaymentDetails !== false ? "Pymt / Trans Mode" : "Payment Mode"}
                  </td>
                  <td className="p-0.5 font-bold border-r border-black/40">
                    {invoice.payment_method || "Cash"}
                  </td>
                  {showEway && (
                    <>
                      <td className="p-0.5 font-sans font-bold border-r border-black/40 w-[24%]">e-Way Bill</td>
                      <td className="p-0.5 font-bold text-[7.5px]">{invoice.eway_bill_number ? `No: ${invoice.eway_bill_number}` : "-"}</td>
                    </>
                  )}
                </tr>
                {showVeh && (
                  <tr>
                    <td className="p-0.5 font-sans font-bold border-r border-black/40 w-[38%]">Vehicle No</td>
                    <td className="p-0.5 font-bold border-r border-black/40">{invoice.vehicle_number || "-"}</td>
                    {f.showPartyDetails !== false && (
                      <td className="p-0.5 font-sans font-bold w-[24%]">
                        {invoice.transporter_name ? "Transporter" : "Page No"}
                      </td>
                    )}
                    <td className="p-0.5 text-[7.5px]">
                      {invoice.transporter_name || invoice.driver_phone || "Road"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Right Box: Customer / Party */}
        {f.showCustomerDetails !== false && (
          <div
            className={`${
              f.showCompanyDetails === false && f.showInvoiceDetails === false
                ? "col-span-12"
                : f.showCompanyDetails === false || f.showInvoiceDetails === false
                ? "col-span-6"
                : "col-span-4"
            } p-2 flex flex-col justify-between`}
          >
            <div>
              {showBillTo && (
                <>
                  <span className="text-[9px] font-bold underline block mb-0.5">{t("Billed To", "Billed To")} :</span>
                  <h3 className="font-bold text-[10px] uppercase text-slate-900 leading-tight">
                    {invoice.customerName || invoice.customerCompany || "CASH CUSTOMER"}
                  </h3>
                  <p className="text-[8.5px] text-gray-800 leading-snug mt-0.5">
                    {formatPartyAddress(invoice.customerBillingAddress || invoice.customerAddress) || "-"}
                  </p>
                </>
              )}
              {showShipTo && (
                <p className="text-[8.5px] text-gray-700 leading-snug mt-0.5">
                  <span className="font-bold text-slate-900">Shipped To : </span>
                  {invoice.customerShippingAddress || invoice.customerBillingAddress || invoice.customerAddress || "Same as Billed To"}
                </p>
              )}
              {showPartyPhone && invoice.customerPhone && (
                <p className="text-[8.5px] text-gray-800 mt-0.5">
                  <span className="font-bold">Phone :</span> <span className="font-mono">{invoice.customerPhone}</span>
                </p>
              )}
            </div>
            <div className="text-[8.5px] space-y-0.5 mt-1">
              {showPartyGstin && invoice.customerGST && (
                <p className="font-bold">
                  {t("Party GSTIN", "Party GSTIN")} : <span className="font-mono">{invoice.customerGST}</span>
                </p>
              )}
              {f.showPartyPan !== false && invoice.customerPan && (
                <p>
                  PAN : <span className="font-mono">{invoice.customerPan}</span>
                </p>
              )}
              {showPos && invoice.place_of_supply && (
                <p className="font-bold text-blue-900">{t("Place of Supply", "Place of Supply")} : {invoice.place_of_supply}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── ITEM TABLE (dense — carries ~15 lines on one A4 page) ─── */}
      {f.showItemTable !== false && (
        <div className="min-h-[220px] print:min-h-0">
          <table className="w-full border-collapse text-[9px]">
            <thead>
              <tr className="bg-black/10 border-b-2 border-black font-bold text-center uppercase">
                <th className={`py-0.5 px-1 border-r border-black/50 ${isA5 ? "w-4" : "w-6"}`}>{f.showItemIndex !== false ? "S.No" : "#"}</th>
                {showHsn && (
                  <th className={`py-0.5 px-1 border-r border-black/50 ${isA5 ? "w-8" : "w-11"}`}>HSN</th>
                )}
                {showBatch && <th className={`py-0.5 px-1 border-r border-black/50 text-left ${isA5 ? "w-9" : "w-11"}`}>Batch No</th>}
                {showMfgExp && !isA5 && (
                  <th className="py-0.5 px-1 border-r border-black/50 text-left w-10">Mfg / Exp</th>
                )}
                <th className={`py-0.5 px-1 border-r border-black/50 text-left font-semibold ${isA5 ? "w-14" : "w-auto"}`}>
                  Item Name
                </th>
                {showUom && <th className="py-0.5 px-1 border-r border-black/50 text-center w-8">UOM</th>}
                {showGstRateCol && <th className="py-0.5 px-1 border-r border-black/50 text-center w-8">GST %</th>}
                {showRate && <th className={`py-0.5 px-1 border-r border-black/50 text-right ${isA5 ? "w-10" : "w-12"}`}>Rate</th>}
                {showDiscCol && <th className="py-0.5 px-1 border-r border-black/50 text-right w-9">Disc</th>}
                {showQty && <th className="py-0.5 px-1 border-r border-black/50 text-center w-8">Qty</th>}
                <th className="py-0.5 px-1 text-right w-14">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300 font-mono">
              {items.map((item: any, idx: number) => {
                const qty = Number(item.quantity || 1);
                const rate = Number(item.unit_price || 0);
                const disc = Number(item.discount_value || 0);
                const mrp = Number(item.mrp || 0);
                const taxRate = Number(item.tax_rate ?? 0);
                const lineAmount =
                  Number(item.subtotal) ||
                  (qty * rate - disc + ((qty * rate - disc) * taxRate) / 100);
                const freeLine = isInvoiceLineFree(item);
                const desc =
                  item.description || item.custom_note || item.notes || item.brand || item.secondary_uom
                    ? `${[item.brand, item.description, item.custom_note, item.notes, item.secondary_uom].filter(Boolean).join(" · ")}`
                    : "";
                return (
                  <tr key={idx} className={`${idx % 2 === 1 ? "bg-gray-50/60" : "bg-white"} ${freeLine ? "text-red-600" : ""}`}>
                    <td className={`px-1 py-[3px] border-r border-black/20 text-center font-sans ${isA5 ? "w-4" : "w-6"}`}>
                      {idx + 1}
                    </td>
                    {showHsn && (
                      <td className={`px-1 py-[3px] border-r border-black/20 text-center ${isA5 ? "w-8" : "w-11"}`}>
                        {item.hsn_code || item.sac_code || "-"}
                      </td>
                    )}
                    {showBatch && (
                      <td className={`px-1 py-[3px] border-r border-black/20 text-left ${isA5 ? "w-9" : "w-11"}`}>
                        {item.batch_no || item.batch_number || item.lot_no || "-"}
                      </td>
                    )}
                    {showMfgExp && !isA5 && (
                      <td className="px-1 py-[3px] border-r border-black/20 text-left w-10 text-[8px]">
                        {[item.mfg_date, item.exp_date].filter(Boolean).join(" / ") || "-"}
                      </td>
                    )}
                    <td className="px-1 py-[3px] border-r border-black/20 text-left">
                      <span className="font-sans font-semibold">
                        {item.product_name || item.name || "-"}
                        {freeLine && <span className="font-black"> (FREE)</span>}
                      </span>
                      {(f.showItemDescription !== false && desc) && (
                        <span className="block text-[7.5px] font-normal text-gray-600 leading-tight">{desc}</span>
                      )}
                      {mrp > 0 && f.showMRP !== false && (
                        <span className="block text-[7px] font-normal text-gray-500">MRP {fmt(mrp)}</span>
                      )}
                    </td>
                    {showUom && (
                      <td className="px-1 py-[3px] border-r border-black/20 text-center w-8">{item.selected_uom || item.uom || item.measuring_unit || "PCS"}</td>
                    )}
                    {showGstRateCol && <td className="px-1 py-[3px] border-r border-black/20 text-center w-8">{taxRate}%</td>}
                    {showRate && (
                      <td className={`px-1 py-[3px] border-r border-black/20 text-right ${isA5 ? "w-10" : "w-12"}`}>
                        {Number.isFinite(rate) ? rate.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                      </td>
                    )}
                    {showDiscCol && (
                      <td className="px-1 py-[3px] border-r border-black/20 text-right w-9">
                        {disc > 0 ? disc.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                      </td>
                    )}
                    {showQty && <td className="px-1 py-[3px] border-r border-black/20 text-center w-8">{qty}</td>}
                    <td className="px-1 py-[3px] text-right w-14 font-semibold">{fmt(lineAmount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── ITEMS SOLD / DISCOUNT SUMMARY LINE ─── */}
      {f.showSubtotal !== false && (
        <div className="flex justify-between items-center border border-black/60 mt-1 px-2 py-0.5 text-[8.5px] bg-gray-50/60">
          <span className="font-bold">
            {t("Items Sold", "Items Sold")}: {items.length}
          </span>
          {f.showTaxableAmount !== false && (
            <span>
              {t("Taxable", "Taxable")}: {fmt(taxableValue)}
            </span>
          )}
          <span className="font-bold">
            {t("Total Tax", "Total Tax")}: {fmt(totalTax)}
          </span>
        </div>
      )}

      {/* ─── BOTTOM SPLIT: GST SUMMARY (left) + TOTALS (right) ─── */}
      <div className="grid grid-cols-12 gap-0 border-t-2 border-black mt-1.5">
        {/* Left: HSN / GST Slab Summary */}
        {showTaxSplit && slabRows.length > 0 && (
          <div className="col-span-5 p-1.5 border-r-2 border-black/60">
            <table className="w-full border border-black/60 border-collapse text-[8px]">
              <thead>
                <tr className="bg-black/10 font-bold uppercase border-b border-black/60">
                  {showHsn && <th className="p-0.5 border-r border-black/40 text-left">HSN/SAC</th>}
                  <th className="p-0.5 border-r border-black/40 text-right">Taxable Amt</th>
                  <th className="p-0.5 border-r border-black/40 text-right">{isInter ? "IGST" : "CGST"}</th>
                  {!isInter && <th className="p-0.5 border-r border-black/40 text-right">SGST</th>}
                  <th className="p-0.5 text-right">Total Tax</th>
                </tr>
              </thead>
              <tbody>
                {slabRows.map((s, i) => (
                  <tr key={i} className="border-b border-black/20 last:border-b-0">
                    {showHsn && (
                      <td className="p-0.5 border-r border-black/30 text-center font-semibold">{s.rate}% {t("Rate", "Rate")}</td>
                    )}
                    <td className="p-0.5 border-r border-black/30 text-right font-mono">{s.taxable.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="p-0.5 border-r border-black/30 text-right font-mono">{isInter ? s.igst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : s.cgst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    {!isInter && (
                      <td className="p-0.5 border-r border-black/30 text-right font-mono">{s.sgst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    )}
                    <td className="p-0.5 text-right font-mono font-semibold">{s.tax.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Right: Payment Summary */}
        <div className={`${showTaxSplit && slabRows.length > 0 ? "col-span-7" : "col-span-12"} p-1.5`}>
          <div className="flex justify-between text-[9px] font-semibold">
            <span className="uppercase">
              {isFullyPaid ? "Net Payable" : t("Total", "Total")}
            </span>
            <span className="font-black text-[11px]">{fmt(grandTotal)}</span>
          </div>

          {f.showTaxableAmount !== false && (
            <div className="flex justify-between text-[8.5px] mt-0.5">
              <span>{t("Taxable Amount", "Taxable Amount")}</span>
              <span className="font-mono">{fmt(taxableValue)}</span>
            </div>
          )}
          {totalDiscount > 0 && (
            <div className="flex justify-between text-[8.5px] mt-0.5">
              <span>{t("Total Discount", "Total Discount")}</span>
              <span className="font-mono">{fmt(totalDiscount)}</span>
            </div>
          )}
          {showTaxSplit && (
            <div className="flex justify-between text-[8.5px] mt-0.5">
              <span>{isInter ? "IGST" : "CGST"}</span>
              <span className="font-mono">{fmt(isInter ? igstAmount : cgstAmount)}</span>
            </div>
          )}
          {showTaxSplit && !isInter && (
            <div className="flex justify-between text-[8.5px] mt-0.5">
              <span>SGST</span>
              <span className="font-mono">{fmt(sgstAmount)}</span>
            </div>
          )}

          {f.showReceivedAmount !== false && amountReceived > 0 && (
            <div className="flex justify-between text-[8.5px] mt-0.5">
              <span>{t("Received", "Received")}</span>
              <span className="font-mono">{fmt(amountReceived)}</span>
            </div>
          )}
          {balanceDue > 0 && f.showBalanceAmount !== false && (
            <div className="flex justify-between text-[8.5px] font-bold mt-0.5 text-red-700">
              <span>{t("Balance Due", "Balance Due")}</span>
              <span className="font-mono">{fmt(balanceDue)}</span>
            </div>
          )}

          {showPartyBalance && (partyPreviousBalance > 0 || partyCurrentBalance > 0) && (
            <div className="flex justify-between text-[8.5px] mt-0.5 border-t border-dashed border-black/40 pt-0.5">
              <span>{t("Previous Balance", "Previous Balance")}</span>
              <span className="font-mono">{fmt(partyPreviousBalance)}</span>
            </div>
          )}
          {showPartyBalance && (
            <div className="flex justify-between text-[8.5px] mt-0.5 font-bold">
              <span>{t("Current Balance", "Current Balance")}</span>
              <span className="font-mono">{fmt(partyCurrentBalance)}</span>
            </div>
          )}

          {f.showYouSaved !== false && totalDiscount > 0 && (
            <div className="text-[8px] text-green-700 font-semibold mt-0.5">
              You saved {fmt(totalDiscount)} on this invoice!
            </div>
          )}
        </div>
      </div>

      {/* ─── ROUND OFF / BANK / BANK-BALANCE STRIP ─── */}
      {(f.showRoundOff !== false || showBank || f.showTcsUgc !== false) && (
        <div className="grid grid-cols-12 border-t border-black/60 text-[8px]">
          {f.showRoundOff !== false && (
            <div className="col-span-3 p-0.5 border-r border-black/30">
              <span className="font-bold block">Round Off ({roundedTotal - grandTotal > 0 ? "-" : "+"})</span>
              <span className="font-mono">{Math.abs(roundOff).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
          {(showBank || dynamicBank) && (
            <div className={`p-0.5 text-right border-r border-black/30 ${f.showRoundOff !== false ? "col-span-6" : "col-span-9"}`}>
              <span className="font-bold block">Bank : {dynamicBank || activeGst?.bank_details || "-"}</span>
            </div>
          )}
          <div className={`p-0.5 text-right ${f.showRoundOff !== false ? "col-span-3" : showBank ? "col-span-3" : "col-span-12"}`}>
            <span className="font-bold uppercase block">
              {balanceDue > 0 ? "To Be Paid / Due Amount" : "All Dues Cleared"}
            </span>
            <span className="font-mono font-black text-[9px]">{balanceDue > 0 ? fmt(balanceDue) : fmt(0)}</span>
          </div>
        </div>
      )}

      {/* ─── AMOUNT IN WORDS (full width, myBillBook style) ─── */}
      {f.showAmountInWords !== false && (
        <div className="border-t border-black/60 px-2 py-0.5 text-[8.5px] font-bold">
          {currency.code === "INR" ? (
            numberToIndianWords(roundedTotal)
          ) : (
            <span>
              {t("Total Amount in Words", "Total Amount in Words")}: {fmt(grandTotal)} {currency.code}
            </span>
          )}
        </div>
      )}

      {/* ─── TERMS / DECLARATION / SIGNATURE ─── */}
      {(f.showTerms !== false || f.showDeclaration !== false || f.showSignature !== false || f.showThankYou !== false) && (
        <div className="border-t border-black/60 mt-1 pt-1.5 flex justify-between items-end">
          <div className="w-3/5 space-y-1">
            {f.showTerms !== false && (invoice.terms_text || (invoice as any).terms_and_conditions) && (
              <p className="text-[7.5px] text-gray-700 whitespace-pre-line leading-tight">
                <span className="font-bold uppercase">{t("Terms & Conditions", "Terms & Conditions")}: </span>
                {(invoice.terms_text || (invoice as any).terms_and_conditions) as string}
              </p>
            )}
            {f.showDeclaration !== false && (
              <p className="text-[7px] text-gray-500 italic leading-tight">
                {t(
                  "We hereby certify that the particulars of the goods and services shown in this invoice are true and correct to the best of our knowledge and belief.",
                  "We hereby certify that the particulars of the goods and services shown in this invoice are true and correct to the best of our knowledge and belief."
                )}
              </p>
            )}
          </div>

          <div className="w-1/3 flex flex-col items-end gap-1">
            {(f.showSignature !== false || f.showThankYou !== false) && (
              <>
                <div className="flex items-end gap-2 min-h-[34px]">
                  {f.showSignature !== false && signatureUrl && (
                    <img src={signatureUrl} alt="Signature" className="h-8 max-w-[90px] object-contain" />
                  )}
                  {f.showSignature !== false && !signatureUrl && (
                    <div className="text-[8px] text-gray-400 w-24 text-center">
                      /s/ {sigCompany}
                    </div>
                  )}
                  {stampUrl && f.showSignature !== false && (
                    <img src={stampUrl} alt="Stamp" className="h-8 max-w-[70px] object-contain opacity-80" />
                  )}
                </div>
                <div className="text-right border-t border-black/40 w-full pt-0.5">
                  <p className="text-[7.5px] font-bold">{sigTitle}</p>
                  <p className="text-[7px] text-gray-600">{sigCompany}</p>
                </div>
              </>
            )}
            {f.showThankYou !== false && (
              <p className="text-[7.5px] font-bold text-gray-700 w-full text-right">
                {invoice.thank_you_note || t("Thank you for your business!", "Thank you for your business!")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
