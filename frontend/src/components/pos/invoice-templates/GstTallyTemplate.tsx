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
 * GST-Tally / myBillBook "Advanced GST" style invoice template.
 * Fully responsive to both A4 and A5 paper sizes (portrait & landscape)
 * driven by user selection in the print modal and template designer.
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
  const isLandscape = orientation === "landscape";
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

  const showItemIndex = f.showItemIndex !== false;
  const showHsn = f.showHSN !== false;
  const showBatch = f.showBatchNumber !== false && (f as any).showBatch !== false;
  const showMfgExp = f.showExpMfgDates !== false && (f as any).showMfgExpDate !== false;
  const showUom = f.showSecondaryUnit !== false && (f as any).showUOM !== false && (f as any).showUom !== false;
  const showQty = f.showItemQty !== false && (f as any).showQuantity !== false;
  const showRate = f.showItemRate !== false && (f as any).showRate !== false;
  const showGstRateCol = f.showGstRateCol !== false && (f as any).showTaxRate !== false;
  const showDiscCol = f.showDiscountCol !== false && (f as any).showDiscount !== false;
  const showAmount = f.showItemAmount !== false;
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

  // Ledger grid filler rows to avoid blank void on A4 and keep balanced lines
  const minRows = isA5 ? (isLandscape ? 4 : 6) : (isLandscape ? 6 : 9);
  const fillerCount = Math.max(0, minRows - items.length);

  // Responsive styling tokens - tuned for optimal single-page packing for <=16 items
  const baseTextClass = isA5 ? "text-[8px] leading-tight p-1.5" : "text-[10px] sm:text-[10.5px] leading-snug p-2 sm:p-3";
  const borderBoxClass = isA5 ? "border border-black/80" : "border-2 border-black";
  const dividerBorderClass = isA5 ? "border-black/60" : "border-black";
  const headerPadClass = isA5 ? "p-1" : "p-1.5 sm:p-2";
  const logoHClass = isA5 ? "h-6 max-w-[65px]" : "h-9 max-w-[95px]";
  const storeNameClass = isA5 ? "text-[10.5px] font-black leading-tight" : "text-sm sm:text-base font-black leading-tight";
  const subTextClass = isA5 ? "text-[7px] leading-tight" : "text-[9px] sm:text-[9.5px] leading-tight";
  const docTitleClass = isA5 ? "text-[11px] font-black tracking-wider" : "text-sm sm:text-base font-black tracking-wider";
  const copyBadgeClass = isA5 ? "text-[6.5px] font-bold px-1 py-0.5" : "text-[8px] font-extrabold px-1.5 py-0.5";
  const metaCellPad = isA5 ? "p-0.5" : "py-0.5 px-1.5";
  const tableHeadClass = isA5 ? "py-1 px-1 text-[8px] font-bold" : "py-1.5 px-1.5 text-[10px] font-black";
  const tableCellPad = isA5 ? "px-1 py-[1.5px]" : "px-1.5 py-1";
  const tableTextClass = isA5 ? "text-[8px]" : "text-[10px]";
  const fillerRowHeight = isA5 ? "h-4" : "h-5";

  return (
    <div
      className={`w-full bg-white text-black ${baseTextClass} font-sans ${borderBoxClass} block print:p-0`}
      style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
    >
      <div>
        {/* ─── TOP 3-BOX HEADER ─── */}
        <div className={`grid grid-cols-12 border-b-2 ${dividerBorderClass}`}>
          {/* Left Box: Seller / Company */}
          {f.showCompanyDetails !== false && (
            <div className={`col-span-4 ${headerPadClass} border-r-2 ${dividerBorderClass} flex flex-col justify-between ${f.showInvoiceDetails !== false ? "" : "col-span-12 border-r-0"}`}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {f.showLogo !== false && dynamicLogoUrl && dynamicLogoUrl !== "/Logo.png" && (
                    <img src={dynamicLogoUrl} alt="Logo" className={`${logoHClass} object-contain`} />
                  )}
                  <div className="min-w-0">
                    <h2 className={`${storeNameClass} uppercase tracking-tight text-slate-900`}>
                      {dynamicStoreName}
                    </h2>
                    <p className={`${subTextClass} text-gray-700 mt-0.5`}>{dynamicAddress}</p>
                  </div>
                </div>
                <div className={`${subTextClass} text-gray-800 space-y-0.5 mt-1`}>
                  {dynamicPhone && <p><span className="font-semibold">Ph:</span> {dynamicPhone}</p>}
                  {dynamicEmail && f.showEmail !== false && <p><span className="font-semibold">Mail:</span> {dynamicEmail}</p>}
                </div>
              </div>
              <div className={`mt-2 pt-1 border-t border-gray-300 ${subTextClass} space-y-0.5`}>
                <p className="font-bold">
                  GSTIN : <span className="font-mono font-black text-slate-900">{sellerGstin || "-"}</span>
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
            <div className={`col-span-4 ${headerPadClass} border-r-2 ${dividerBorderClass} flex flex-col justify-between text-center bg-black/[0.03]`}>
              <div>
                <h1 className={`${docTitleClass} text-slate-900 uppercase`}>
                  {invoice.header_title || (invoice as any).documentTitle || t("TAX INVOICE", "TAX INVOICE")}
                </h1>
                <span className={`${copyBadgeClass} uppercase tracking-wider block mb-1 border border-slate-400 bg-slate-100 rounded inline-block`}>
                  {invoice.copy_type || "ORIGINAL FOR RECIPIENT"}
                </span>
              </div>

              <table className={`w-full text-left ${tableTextClass} border border-black border-collapse bg-transparent font-mono`}>
                <tbody>
                  <tr className="border-b border-black/40">
                    <td className={`${metaCellPad} font-sans font-bold border-r border-black/40 w-[38%]`}>
                      Invoice No
                    </td>
                    <td className={`${metaCellPad} font-bold border-r border-black/40`}>
                      {invoice.invoice_number || "-"}
                    </td>
                    <td className={`${metaCellPad} font-sans font-bold border-r border-black/40 w-[24%]`}>Invoice Date</td>
                    <td className={`${metaCellPad} font-bold`}>{formatDisplayDate(invoice.invoice_date || invoice.created_at || new Date())}</td>
                  </tr>
                  {(showPo || showChallan) && (
                    <tr className="border-b border-black/40">
                      {showPo && (
                        <>
                          <td className={`${metaCellPad} font-sans font-bold border-r border-black/40 w-[38%]`}>PO / Order Ref</td>
                          <td className={`${metaCellPad} font-bold border-r border-black/40`}>
                            {invoice.po_number || invoice.po_reference || "-"}
                          </td>
                        </>
                      )}
                      {showChallan && (
                        <>
                          <td className={`${metaCellPad} font-sans font-bold border-r border-black/40 w-[24%]`}>Challan No</td>
                          <td className={`${metaCellPad} font-bold`}>{invoice.challan_number || invoice.delivery_challan_number || "-"}</td>
                        </>
                      )}
                    </tr>
                  )}
                  <tr>
                    <td className={`${metaCellPad} font-sans font-bold border-r border-black/40 w-[38%]`}>
                      {f.showPaymentDetails !== false ? "Payment Mode" : "Mode"}
                    </td>
                    <td className={`${metaCellPad} font-bold border-r border-black/40`}>
                      {invoice.payment_method || "Cash"}
                    </td>
                    {showEway && (
                      <>
                        <td className={`${metaCellPad} font-sans font-bold border-r border-black/40 w-[24%]`}>e-Way Bill</td>
                        <td className={`${metaCellPad} font-bold ${isA5 ? "text-[7px]" : "text-[9px]"}`}>{invoice.eway_bill_number ? `No: ${invoice.eway_bill_number}` : "-"}</td>
                      </>
                    )}
                  </tr>
                  {showVeh && (
                    <tr>
                      <td className={`${metaCellPad} font-sans font-bold border-r border-black/40 w-[38%]`}>Vehicle No</td>
                      <td className={`${metaCellPad} font-bold border-r border-black/40`}>{invoice.vehicle_number || "-"}</td>
                      {f.showPartyDetails !== false && (
                        <td className={`${metaCellPad} font-sans font-bold w-[24%]`}>
                          {invoice.transporter_name ? "Transporter" : "Transport"}
                        </td>
                      )}
                      <td className={`${metaCellPad} ${isA5 ? "text-[7px]" : "text-[9px]"}`}>
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
              className={`${f.showCompanyDetails === false && f.showInvoiceDetails === false
                ? "col-span-12"
                : f.showCompanyDetails === false || f.showInvoiceDetails === false
                  ? "col-span-6"
                  : "col-span-4"
                } ${headerPadClass} flex flex-col justify-between`}
            >
              <div>
                {showBillTo && (
                  <>
                    <span className={`${subTextClass} font-bold underline block mb-0.5`}>{t("Billed To", "Billed To")} :</span>
                    <h3 className={`font-bold ${isA5 ? "text-[9.5px]" : "text-xs sm:text-sm"} uppercase text-slate-900 leading-tight`}>
                      {invoice.customerName || invoice.customerCompany || "CASH CUSTOMER"}
                    </h3>
                    <p className={`${subTextClass} text-gray-800 mt-0.5 leading-snug`}>
                      {formatPartyAddress(invoice.customerBillingAddress || invoice.customerAddress) || "-"}
                    </p>
                  </>
                )}
                {showShipTo && (
                  <p className={`${subTextClass} text-gray-700 mt-1 leading-snug`}>
                    <span className="font-bold text-slate-900">Shipped To : </span>
                    {invoice.customerShippingAddress || invoice.customerBillingAddress || invoice.customerAddress || "Same as Billed To"}
                  </p>
                )}
                {showPartyPhone && invoice.customerPhone && (
                  <p className={`${subTextClass} text-gray-800 mt-0.5`}>
                    <span className="font-bold">Phone :</span> <span className="font-mono">{invoice.customerPhone}</span>
                  </p>
                )}
              </div>
              <div className={`${subTextClass} space-y-0.5 mt-1 pt-1 border-t border-gray-200`}>
                {showPartyGstin && invoice.customerGST && (
                  <p className="font-bold">
                    {t("Party GSTIN", "Party GSTIN")} : <span className="font-mono font-black text-slate-900">{invoice.customerGST}</span>
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

        {/* ─── ITEM TABLE (Clean Indian GST Ledger Grid) ─── */}
        {f.showItemTable !== false && (
          <div className={`${isA5 ? "min-h-[140px]" : isLandscape ? "min-h-[220px]" : "min-h-[300px]"} print:min-h-0`}>
            <table className={`w-full border-collapse ${tableTextClass}`}>
              <thead>
                <tr className={`bg-slate-100 border-b-2 ${dividerBorderClass} ${tableHeadClass} text-center uppercase`}>
                  {showItemIndex && (
                    <th className={`${tableHeadClass} border-r border-black/40 ${isA5 ? "w-5" : "w-8"}`}>S.No</th>
                  )}
                  {showHsn && (
                    <th className={`${tableHeadClass} border-r border-black/40 ${isA5 ? "w-10" : "w-16"}`}>HSN</th>
                  )}
                  {showBatch && <th className={`${tableHeadClass} border-r border-black/40 text-left ${isA5 ? "w-11" : "w-18"}`}>Batch No</th>}
                  {showMfgExp && !isA5 && (
                    <th className={`${tableHeadClass} border-r border-black/40 text-left w-16`}>Mfg / Exp</th>
                  )}
                  <th className={`${tableHeadClass} border-r border-black/40 text-left font-bold`}>
                    Item Name
                  </th>
                  {showUom && <th className={`${tableHeadClass} border-r border-black/40 text-center ${isA5 ? "w-8" : "w-12"}`}>UOM</th>}
                  {showGstRateCol && <th className={`${tableHeadClass} border-r border-black/40 text-center ${isA5 ? "w-9" : "w-12"}`}>GST %</th>}
                  {showRate && <th className={`${tableHeadClass} border-r border-black/40 text-right ${isA5 ? "w-12" : "w-20"}`}>Rate</th>}
                  {showDiscCol && <th className={`${tableHeadClass} border-r border-black/40 text-right ${isA5 ? "w-10" : "w-14"}`}>Disc</th>}
                  {showQty && <th className={`${tableHeadClass} border-r border-black/40 text-center ${isA5 ? "w-8" : "w-12"}`}>Qty</th>}
                  {showAmount && <th className={`${tableHeadClass} text-right ${isA5 ? "w-14" : "w-24"}`}>Amount</th>}
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
                    <tr key={idx} className={`${idx % 2 === 1 ? "bg-gray-50/50" : "bg-white"} ${freeLine ? "text-red-600" : ""}`}>
                      {showItemIndex && (
                        <td className={`${tableCellPad} border-r border-black/20 text-center font-sans ${isA5 ? "w-5" : "w-8"}`}>
                          {idx + 1}
                        </td>
                      )}
                      {showHsn && (
                        <td className={`${tableCellPad} border-r border-black/20 text-center ${isA5 ? "w-10" : "w-16"}`}>
                          {item.hsn_code || item.sac_code || "-"}
                        </td>
                      )}
                      {showBatch && (
                        <td className={`${tableCellPad} border-r border-black/20 text-left ${isA5 ? "w-11" : "w-18"}`}>
                          {item.batch_no || item.batch_number || item.lot_no || "-"}
                        </td>
                      )}
                      {showMfgExp && !isA5 && (
                        <td className={`${tableCellPad} border-r border-black/20 text-left w-16 text-[9px]`}>
                          {[item.mfg_date, item.exp_date].filter(Boolean).join(" / ") || "-"}
                        </td>
                      )}
                      <td className={`${tableCellPad} border-r border-black/20 text-left`}>
                          <span className={`font-sans font-bold ${isA5 ? "text-[8px]" : "text-[10px]"}`}>
                            {item.product_name || item.name || "-"}
                            {freeLine && <span className="font-black text-red-600"> (FREE)</span>}
                          </span>
                          {(f.showItemDescription !== false && desc) && (
                            <span className={`block ${isA5 ? "text-[7px]" : "text-[9px]"} font-normal text-gray-600 leading-snug mt-0.5`}>{desc}</span>
                          )}
                          {mrp > 0 && f.showMRP !== false && (
                            <span className={`block ${isA5 ? "text-[6.5px]" : "text-[8.5px]"} font-normal text-gray-500`}>MRP {fmt(mrp)}</span>
                          )}
                      </td>
                      {showUom && (
                        <td className={`${tableCellPad} border-r border-black/20 text-center ${isA5 ? "w-8" : "w-12"}`}>{item.selected_uom || item.uom || item.measuring_unit || "PCS"}</td>
                      )}
                      {showGstRateCol && <td className={`${tableCellPad} border-r border-black/20 text-center ${isA5 ? "w-9" : "w-12"}`}>{taxRate}%</td>}
                      {showRate && (
                        <td className={`${tableCellPad} border-r border-black/20 text-right ${isA5 ? "w-12" : "w-20"}`}>
                          {Number.isFinite(rate) ? rate.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                        </td>
                      )}
                      {showDiscCol && (
                        <td className={`${tableCellPad} border-r border-black/20 text-right ${isA5 ? "w-10" : "w-14"}`}>
                          {disc > 0 ? disc.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                        </td>
                      )}
                      {showQty && <td className={`${tableCellPad} border-r border-black/20 text-center font-bold ${isA5 ? "w-8" : "w-12"}`}>{qty}</td>}
                      {showAmount && <td className={`${tableCellPad} text-right font-black ${isA5 ? "w-14" : "w-24"}`}>{fmt(lineAmount)}</td>}
                    </tr>
                  );
                })}

                {/* Vertical ledger filler rows so the invoice fills the sheet cleanly without a giant gap */}
                {Array.from({ length: fillerCount }).map((_, fIdx) => (
                  <tr key={`fill-${fIdx}`} className={`${fillerRowHeight} border-b border-gray-100/80`}>
                    {showItemIndex && <td className={`border-r border-black/20 ${isA5 ? "w-5" : "w-8"}`}>&nbsp;</td>}
                    {showHsn && <td className={`border-r border-black/20 ${isA5 ? "w-10" : "w-16"}`}>&nbsp;</td>}
                    {showBatch && <td className={`border-r border-black/20 ${isA5 ? "w-11" : "w-18"}`}>&nbsp;</td>}
                    {showMfgExp && !isA5 && <td className="border-r border-black/20 w-16">&nbsp;</td>}
                    <td className="border-r border-black/20">&nbsp;</td>
                    {showUom && <td className={`border-r border-black/20 ${isA5 ? "w-8" : "w-12"}`}>&nbsp;</td>}
                    {showGstRateCol && <td className={`border-r border-black/20 ${isA5 ? "w-9" : "w-12"}`}>&nbsp;</td>}
                    {showRate && <td className={`border-r border-black/20 ${isA5 ? "w-12" : "w-20"}`}>&nbsp;</td>}
                    {showDiscCol && <td className={`border-r border-black/20 ${isA5 ? "w-10" : "w-14"}`}>&nbsp;</td>}
                    {showQty && <td className={`border-r border-black/20 ${isA5 ? "w-8" : "w-12"}`}>&nbsp;</td>}
                    {showAmount && <td className={`${isA5 ? "w-14" : "w-24"}`}>&nbsp;</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── ITEMS SOLD / DISCOUNT SUMMARY LINE ─── */}
        {f.showSubtotal !== false && (
          <div className={`flex justify-between items-center border ${dividerBorderClass} mt-1 ${isA5 ? "px-2 py-0.5 text-[8px]" : "px-3 py-1.5 text-[10px]"} font-semibold bg-gray-50/80`}>
            <span>
              {t("Items Sold", "Items Sold")}: <strong className="font-black">{items.length}</strong>
            </span>
            {f.showTaxableAmount !== false && (
              <span>
                {t("Taxable", "Taxable")}: <strong className="font-mono">{fmt(taxableValue)}</strong>
              </span>
            )}
            <span>
              {t("Total Tax", "Total Tax")}: <strong className="font-mono">{fmt(totalTax)}</strong>
            </span>
          </div>
        )}

        {/* ─── BOTTOM SPLIT: GST SUMMARY (left) + TOTALS (right) ─── */}
          <div className={`grid grid-cols-12 gap-0 border-t-2 ${dividerBorderClass} mt-1 avoid-break break-inside-avoid`} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
            {/* Left: HSN / GST Slab Summary */}
            {showTaxSplit && slabRows.length > 0 && (
              <div className={`col-span-5 ${isA5 ? "p-1 text-[7.5px]" : "p-2 text-[9.5px]"} border-r-2 ${dividerBorderClass}`}>
                <table className={`w-full border border-black/60 border-collapse ${isA5 ? "text-[7.5px]" : "text-[9.5px]"}`}>
                  <thead>
                    <tr className="bg-black/10 font-bold uppercase border-b border-black/60">
                      {showHsn && <th className={`${isA5 ? "p-0.5" : "p-1"} border-r border-black/40 text-left`}>HSN/SAC</th>}
                      <th className={`${isA5 ? "p-0.5" : "p-1"} border-r border-black/40 text-right`}>Taxable Amt</th>
                      <th className={`${isA5 ? "p-0.5" : "p-1"} border-r border-black/40 text-right`}>{isInter ? "IGST" : "CGST"}</th>
                      {!isInter && <th className={`${isA5 ? "p-0.5" : "p-1"} border-r border-black/40 text-right`}>SGST</th>}
                      <th className={`${isA5 ? "p-0.5" : "p-1"} text-right`}>Total Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slabRows.map((s, i) => (
                      <tr key={i} className="border-b border-black/20 last:border-b-0">
                        {showHsn && (
                          <td className={`${isA5 ? "p-0.5" : "p-1"} border-r border-black/30 text-center font-semibold`}>{s.rate}% {t("Rate", "Rate")}</td>
                        )}
                        <td className={`${isA5 ? "p-0.5" : "p-1"} border-r border-black/30 text-right font-mono`}>{s.taxable.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className={`${isA5 ? "p-0.5" : "p-1"} border-r border-black/30 text-right font-mono`}>{isInter ? s.igst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : s.cgst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        {!isInter && (
                          <td className={`${isA5 ? "p-0.5" : "p-1"} border-r border-black/30 text-right font-mono`}>{s.sgst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        )}
                        <td className={`${isA5 ? "p-0.5" : "p-1"} text-right font-mono font-semibold`}>{s.tax.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Right: Payment Summary */}
            <div className={`${showTaxSplit && slabRows.length > 0 ? "col-span-7" : "col-span-12"} ${isA5 ? "p-1.5" : "p-2.5"}`}>
              <div className={`flex justify-between ${isA5 ? "text-[8.5px]" : "text-[11px]"} font-semibold items-baseline`}>
                <span className="uppercase tracking-wider font-bold">
                  {isFullyPaid ? "Net Payable" : t("Total", "Total")}
                </span>
                <span className={`font-black ${isA5 ? "text-xs" : "text-base"}`}>{fmt(grandTotal)}</span>
              </div>

              {f.showTaxableAmount !== false && (
                <div className={`flex justify-between ${isA5 ? "text-[7.5px]" : "text-[10px]"} mt-0.5`}>
                  <span>{t("Taxable Amount", "Taxable Amount")}</span>
                  <span className="font-mono">{fmt(taxableValue)}</span>
                </div>
              )}
              {totalDiscount > 0 && (
                <div className={`flex justify-between ${isA5 ? "text-[7.5px]" : "text-[10px]"} mt-0.5`}>
                  <span>{t("Total Discount", "Total Discount")}</span>
                  <span className="font-mono">{fmt(totalDiscount)}</span>
                </div>
              )}
              {showTaxSplit && (
                <div className={`flex justify-between ${isA5 ? "text-[7.5px]" : "text-[10px]"} mt-0.5`}>
                  <span>{isInter ? "IGST" : "CGST"}</span>
                  <span className="font-mono">{fmt(isInter ? igstAmount : cgstAmount)}</span>
                </div>
              )}
              {showTaxSplit && !isInter && (
                <div className={`flex justify-between ${isA5 ? "text-[7.5px]" : "text-[10px]"} mt-0.5`}>
                  <span>SGST</span>
                  <span className="font-mono">{fmt(sgstAmount)}</span>
                </div>
              )}

              {f.showReceivedAmount !== false && amountReceived > 0 && (
                <div className={`flex justify-between ${isA5 ? "text-[7.5px]" : "text-[10px]"} mt-0.5 font-semibold text-emerald-800`}>
                  <span>{t("Received", "Received")}</span>
                  <span className="font-mono">{fmt(amountReceived)}</span>
                </div>
              )}
              {balanceDue > 0 && f.showBalanceAmount !== false && (
                <div className={`flex justify-between ${isA5 ? "text-[8px]" : "text-[10.5px]"} font-bold mt-0.5 text-red-700`}>
                  <span>{t("Balance Due", "Balance Due")}</span>
                  <span className="font-mono font-black">{fmt(balanceDue)}</span>
                </div>
              )}

              {showPartyBalance && (partyPreviousBalance > 0 || partyCurrentBalance > 0) && (
                <div className={`flex justify-between ${isA5 ? "text-[7.5px]" : "text-[10px]"} mt-1 border-t border-dashed border-black/40 pt-0.5`}>
                  <span>{t("Previous Balance", "Previous Balance")}</span>
                  <span className="font-mono">{fmt(partyPreviousBalance)}</span>
                </div>
              )}
              {showPartyBalance && (
                <div className={`flex justify-between ${isA5 ? "text-[7.5px]" : "text-[10px]"} mt-0.5 font-bold`}>
                  <span>{t("Current Balance", "Current Balance")}</span>
                  <span className="font-mono font-black">{fmt(partyCurrentBalance)}</span>
                </div>
              )}

              {f.showYouSaved !== false && totalDiscount > 0 && (
                <div className={`${isA5 ? "text-[7.5px]" : "text-[9.5px]"} text-green-700 font-semibold mt-1`}>
                  You saved {fmt(totalDiscount)} on this invoice!
                </div>
              )}

              {invoice.split_payments && typeof invoice.split_payments === "object" && Object.keys(invoice.split_payments).length > 1 && (
                <div className={`mt-1.5 pt-1 border-t border-dashed border-black/40 ${isA5 ? "text-[7px]" : "text-[9px]"}`}>
                  <span className="font-bold uppercase text-slate-800 block mb-0.5">Payment Split:</span>
                  <div className="space-y-0.5 pl-1">
                    {Object.entries(invoice.split_payments).map(([m, a]) => (
                      <div key={m} className="flex justify-between">
                        <span className="capitalize">{m}:</span>
                        <span className="font-mono font-bold">{fmt(Number(a))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─── ROUND OFF / BANK / DUE AMOUNT STRIP ─── */}
          {(f.showRoundOff !== false || showBank || f.showTcsUgc !== false) && (
            <div className={`grid grid-cols-12 border-t ${dividerBorderClass} ${isA5 ? "text-[7.5px] p-0.5" : "text-[9.5px] p-1.5"} bg-gray-50/40 items-center avoid-break break-inside-avoid`} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
              {f.showRoundOff !== false && (
                <div className="col-span-3 border-r border-black/30 pr-1">
                  <span className="font-bold block">Round Off ({roundedTotal - grandTotal > 0 ? "-" : "+"})</span>
                  <span className="font-mono">{Math.abs(roundOff).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              {(showBank || dynamicBank) && (
                <div className={`px-1 text-right border-r border-black/30 ${f.showRoundOff !== false ? "col-span-6" : "col-span-9"}`}>
                  <span className="font-bold block">Bank : {dynamicBank || activeGst?.bank_details || "-"}</span>
                </div>
              )}
              <div className={`pl-1 text-right ${f.showRoundOff !== false ? "col-span-3" : showBank ? "col-span-3" : "col-span-12"}`}>
                <span className="font-bold uppercase block">
                  {balanceDue > 0 ? "Due Amount" : "All Dues Cleared"}
                </span>
                <span className={`font-mono font-black ${isA5 ? "text-[8.5px]" : "text-[11px]"}`}>{balanceDue > 0 ? fmt(balanceDue) : fmt(0)}</span>
              </div>
            </div>
          )}

          {/* ─── AMOUNT IN WORDS (full width, myBillBook style) ─── */}
          {f.showAmountInWords !== false && (
            <div className={`border-t ${dividerBorderClass} ${isA5 ? "px-2 py-0.5 text-[8px]" : "px-3 py-1.5 text-[10px]"} font-bold bg-gray-50/70 avoid-break break-inside-avoid`} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
              {currency.code === "INR" ? (
                numberToIndianWords(roundedTotal)
              ) : (
                <span>
                  {t("Total Amount in Words", "Total Amount in Words")}: {fmt(grandTotal)} {currency.code}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ─── TERMS / DECLARATION / SIGNATURE (Anchored neatly at bottom) ─── */}
        {(f.showTerms !== false || f.showDeclaration !== false || f.showSignature !== false || f.showThankYou !== false) && (
            <div className={`border-t-2 ${dividerBorderClass} mt-1 pt-1 flex justify-between items-end avoid-break break-inside-avoid`} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
              <div className="w-3/5 space-y-1">
                {f.showTerms !== false && (invoice.terms_text || (invoice as any).terms_and_conditions) && (
                  <p className={`${isA5 ? "text-[7px]" : "text-[9px]"} text-gray-700 whitespace-pre-line leading-relaxed`}>
                    <span className="font-bold uppercase text-slate-900">{t("Terms & Conditions", "Terms & Conditions")}: </span>
                    {(invoice.terms_text || (invoice as any).terms_and_conditions) as string}
                  </p>
                )}
                {f.showDeclaration !== false && (
                  <p className={`${isA5 ? "text-[6.5px]" : "text-[8.5px]"} text-gray-500 italic leading-normal`}>
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
                    <div className={`flex items-end gap-2 ${isA5 ? "min-h-[28px]" : "min-h-[42px]"}`}>
                      {f.showSignature !== false && signatureUrl && (
                        <img src={signatureUrl} alt="Signature" className={`${isA5 ? "h-7 max-w-[70px]" : "h-11 max-w-[110px]"} object-contain`} />
                      )}
                      {f.showSignature !== false && !signatureUrl && (
                        <div className={`${isA5 ? "text-[7px] w-20" : "text-[9px] w-28"} text-gray-400 text-center italic`}>
                          /s/ {sigCompany}
                        </div>
                      )}
                      {stampUrl && f.showSignature !== false && (
                        <img src={stampUrl} alt="Stamp" className={`${isA5 ? "h-7 max-w-[55px]" : "h-11 max-w-[90px]"} object-contain opacity-80`} />
                      )}
                    </div>
                    <div className="text-right border-t border-black/40 w-full pt-0.5">
                      <p className={`${isA5 ? "text-[7.5px]" : "text-[9.5px]"} font-bold text-slate-900`}>{sigTitle}</p>
                      <p className={`${isA5 ? "text-[7px]" : "text-[9px]"} text-gray-600`}>{sigCompany}</p>
                    </div>
                  </>
                )}
                {f.showThankYou !== false && (
                  <p className={`${isA5 ? "text-[7.5px]" : "text-[9.5px]"} font-bold text-gray-700 w-full text-right`}>
                    {invoice.thank_you_note || t("Thank you for your business!", "Thank you for your business!")}
                  </p>
                )}
              </div>
            </div>
      )}
          </div>
        );
}
