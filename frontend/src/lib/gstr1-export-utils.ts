import * as XLSX from "xlsx";
import { getEffectiveTaxRate } from "./gst-utils";

export interface GstCompanyMeta {
  companyName?: string;
  gstin?: string;
  phone?: string;
  stateCode?: string;
  stateName?: string;
  tradeName?: string;
  period?: string;
  financialYear?: string;
  startDate?: string;
  endDate?: string;
}

const STATE_CODE_MAP: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "28": "Andhra Pradesh",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
};

export function resolveStateDetails(pos: any, gstin: string = ""): { code: string; name: string; formatted: string } {
  let code = "37";
  if (pos) {
    const rawPos = String(pos).trim();
    if (rawPos.length >= 2 && !isNaN(Number(rawPos.slice(0, 2)))) {
      code = rawPos.slice(0, 2);
    } else {
      // Find matching state name
      const entry = Object.entries(STATE_CODE_MAP).find(([_, name]) =>
        name.toLowerCase().includes(rawPos.toLowerCase()) || rawPos.toLowerCase().includes(name.toLowerCase())
      );
      if (entry) code = entry[0];
    }
  } else if (gstin && gstin.length >= 2 && !isNaN(Number(gstin.slice(0, 2)))) {
    code = gstin.slice(0, 2);
  }

  const name = STATE_CODE_MAP[code] || "Andhra Pradesh";
  return {
    code,
    name,
    formatted: `${code}-${name}`,
  };
}

function formatDate(dateVal: any): string {
  if (!dateVal) return "";
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(dateVal);
  }
}

/**
 * Normalizes an invoice object to extract consistent GST fields.
 */
export function normalizeGstInvoice(inv: any) {
  const invNo = inv.invoice_number || inv.invoice_no || inv.id || "INV-001";
  const rawDate = inv.invoice_date || inv.date || inv.created_at || new Date().toISOString().slice(0, 10);
  const invDate = formatDate(rawDate);
  const partyName = inv.customer_name || inv.party_name || inv.customer?.name || "Customer";
  const partyGstin = (inv.customer_gstin || inv.party_gstin || inv.gstin || "").toUpperCase().trim();
  
  const stateInfo = resolveStateDetails(inv.place_of_supply || inv.pos, partyGstin);
  const isInterstate = inv.is_interstate ?? (partyGstin && !partyGstin.startsWith("37") && !partyGstin.startsWith("36"));
  
  const items = Array.isArray(inv.items) ? inv.items : [];
  const rateBreakdowns: Array<{
    rate: number;
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    totalTax: number;
  }> = [];

  const rawInvTax = Number(inv.tax ?? inv.total_tax ?? inv.tax_amount ?? 0);
  const rawInvTotal = Number(inv.total ?? inv.grand_total ?? 0);
  const rawInvTaxable = Number(inv.taxable_amount ?? inv.subtotal ?? 0);
  const rawInvRate = Number(inv.tax_rate ?? inv.tax_percent ?? inv.gst_rate ?? 0);

  if (items.length > 0) {
    const rateMap = new Map<number, { taxable: number; cess: number; tax: number }>();
    items.forEach((it: any) => {
      const itRate = getEffectiveTaxRate(it) || Number(it.tax_rate ?? it.tax_percent ?? it.gst_rate ?? rawInvRate);
      const itQty = Number(it.quantity ?? it.qty ?? 1);
      const itUnitPrice = Number(it.unit_price ?? it.price ?? it.selling_price ?? it.rate ?? 0);
      const itGross = itUnitPrice * itQty;
      const itDiscVal = Number(it.discount_value ?? it.discount ?? it.discount_amount ?? 0);
      const itDisc = it.discount_type === "percent"
        ? (itGross * itDiscVal) / 100
        : Math.min(itDiscVal * itQty, itGross);
      const effectiveGross = Math.max(0, itGross - itDisc);
      const isIncl = it.is_tax_inclusive === true || inv.is_tax_inclusive === true || it.tax_included === true || it.is_inclusive === true;

      let itTaxable = 0;
      let itTax = 0;

      if (it.taxable_amount !== undefined && it.taxable_amount !== null && Number(it.taxable_amount) > 0) {
        itTaxable = Number(it.taxable_amount);
        itTax = (it.tax_amount !== undefined && it.tax_amount !== null) ? Number(it.tax_amount) : (itTaxable * itRate) / 100;
      } else if (it.subtotal !== undefined && it.subtotal !== null && Number(it.subtotal) > 0 && !isIncl) {
        itTaxable = Number(it.subtotal);
        itTax = (it.tax_amount !== undefined && it.tax_amount !== null) ? Number(it.tax_amount) : (itTaxable * itRate) / 100;
      } else if (isIncl && itRate > 0) {
        itTaxable = effectiveGross / (1 + itRate / 100);
        itTax = effectiveGross - itTaxable;
      } else {
        itTaxable = effectiveGross;
        itTax = (effectiveGross * itRate) / 100;
      }

      const itCess = Number(it.cess || 0);
      const cur = rateMap.get(itRate) || { taxable: 0, cess: 0, tax: 0 };
      cur.taxable += itTaxable;
      cur.cess += itCess;
      cur.tax += itTax;
      rateMap.set(itRate, cur);
    });

    rateMap.forEach((val, r) => {
      const lineTax = val.tax > 0 ? val.tax : (val.taxable * r) / 100;
      const lineCgst = isInterstate ? 0 : lineTax / 2;
      const lineSgst = isInterstate ? 0 : lineTax / 2;
      const lineIgst = isInterstate ? lineTax : 0;
      rateBreakdowns.push({
        rate: r,
        taxable: Number(val.taxable.toFixed(2)),
        cgst: Number(lineCgst.toFixed(2)),
        sgst: Number(lineSgst.toFixed(2)),
        igst: Number(lineIgst.toFixed(2)),
        cess: Number(val.cess.toFixed(2)),
        totalTax: Number((lineTax + val.cess).toFixed(2)),
      });
    });
  }

  let finalTaxable = 0;
  let finalTax = 0;
  let finalTotal = 0;
  let finalCess = 0;
  let finalCgst = 0;
  let finalSgst = 0;
  let finalIgst = 0;
  let finalRate = rawInvRate;

  if (rateBreakdowns.length > 0) {
    finalTaxable = rateBreakdowns.reduce((s, r) => s + r.taxable, 0);
    finalTax = rateBreakdowns.reduce((s, r) => s + r.totalTax, 0);
    finalCess = rateBreakdowns.reduce((s, r) => s + r.cess, 0);
    finalCgst = rateBreakdowns.reduce((s, r) => s + r.cgst, 0);
    finalSgst = rateBreakdowns.reduce((s, r) => s + r.sgst, 0);
    finalIgst = rateBreakdowns.reduce((s, r) => s + r.igst, 0);
    finalTotal = rawInvTotal > 0 ? rawInvTotal : Number((finalTaxable + finalTax).toFixed(2));
    finalRate = rateBreakdowns[0].rate;
  } else {
    // Single / Summary Invoice fallback
    if (rawInvTaxable > 0 && rawInvTax > 0) {
      finalTaxable = rawInvTaxable;
      finalTax = rawInvTax;
      finalTotal = rawInvTotal > 0 ? rawInvTotal : finalTaxable + finalTax;
      finalRate = rawInvRate > 0 ? rawInvRate : Math.round((finalTax / finalTaxable) * 100);
    } else if (rawInvTotal > 0 && rawInvRate > 0) {
      finalTaxable = rawInvTotal / (1 + rawInvRate / 100);
      finalTax = rawInvTotal - finalTaxable;
      finalTotal = rawInvTotal;
      finalRate = rawInvRate;
    } else if (rawInvTaxable > 0 && rawInvRate > 0) {
      finalTaxable = rawInvTaxable;
      finalTax = (rawInvTaxable * rawInvRate) / 100;
      finalTotal = finalTaxable + finalTax;
      finalRate = rawInvRate;
    } else {
      finalTaxable = rawInvTaxable > 0 ? rawInvTaxable : rawInvTotal;
      finalTax = rawInvTax;
      finalTotal = rawInvTotal > 0 ? rawInvTotal : finalTaxable + finalTax;
      finalRate = finalTaxable > 0 && finalTax > 0 ? Math.round((finalTax / finalTaxable) * 100) : 0;
    }

    finalCess = Number(inv.cess || 0);
    if (isInterstate) {
      finalIgst = finalTax;
    } else {
      finalCgst = finalTax / 2;
      finalSgst = finalTax / 2;
    }

    rateBreakdowns.push({
      rate: finalRate,
      taxable: Number(finalTaxable.toFixed(2)),
      cgst: Number(finalCgst.toFixed(2)),
      sgst: Number(finalSgst.toFixed(2)),
      igst: Number(finalIgst.toFixed(2)),
      cess: Number(finalCess.toFixed(2)),
      totalTax: Number(finalTax.toFixed(2)),
    });
  }

  return {
    invNo,
    invDate,
    rawDate,
    partyName,
    partyGstin,
    posCode: stateInfo.code,
    posName: stateInfo.name,
    posFormatted: stateInfo.formatted,
    isInterstate,
    taxable: Number(finalTaxable.toFixed(2)),
    total: Number(finalTotal.toFixed(2)),
    tax: Number(finalTax.toFixed(2)),
    cgst: Number(finalCgst.toFixed(2)),
    sgst: Number(finalSgst.toFixed(2)),
    igst: Number(finalIgst.toFixed(2)),
    cess: Number(finalCess.toFixed(2)),
    rate: finalRate,
    items,
    rateBreakdowns,
    isExport: Boolean(inv.is_export || String(invNo).startsWith("EXP") || inv.export_type),
    isCdnr: Boolean(inv.is_credit_note || inv.is_debit_note || String(invNo).startsWith("CN") || String(invNo).startsWith("DN") || inv.document_type === "CREDIT_NOTE" || inv.document_type === "DEBIT_NOTE"),
    isDebitNote: Boolean(inv.is_debit_note || String(invNo).startsWith("DN") || inv.document_type === "DEBIT_NOTE"),
  };
}

/**
 * Computes GSTR-1 sections data matching myBillBook schema.
 */
export function buildGstr1Sections(invoices: any[] = []) {
  const normInvs = invoices.map(normalizeGstInvoice);

  // 1. Regular Sales Invoices (Excluding exports and credit/debit notes)
  const salesInvoices = normInvs.filter((inv) => !inv.isExport && !inv.isCdnr);

  // 2. Table 4: B2B Invoices (Registered Customers with GSTIN)
  const b2bList = salesInvoices.filter((inv) => Boolean(inv.partyGstin));

  // 3. Table 5: B2C Large (Unregistered + Interstate + Total > 2.5 Lakhs)
  const b2clList = salesInvoices.filter(
    (inv) => !inv.partyGstin && inv.isInterstate && inv.total > 250000
  );

  // 4. Table 7: B2C Small (Unregistered, Intra-State or Interstate <= 2.5 Lakhs)
  const b2csRaw = salesInvoices.filter(
    (inv) => !inv.partyGstin && (!inv.isInterstate || inv.total <= 250000)
  );

  // Group B2CS by POS & Tax Rate
  const b2csMap = new Map<string, { posFormatted: string; rate: number; taxable: number; cess: number }>();
  b2csRaw.forEach((inv) => {
    inv.rateBreakdowns.forEach((rb) => {
      const key = `${inv.posFormatted}_${rb.rate}`;
      const cur = b2csMap.get(key) || { posFormatted: inv.posFormatted, rate: rb.rate, taxable: 0, cess: 0 };
      cur.taxable += rb.taxable;
      cur.cess += rb.cess;
      b2csMap.set(key, cur);
    });
  });
  const b2csList = Array.from(b2csMap.values()).map((row) => ({
    ...row,
    taxable: Number(row.taxable.toFixed(2)),
    cess: Number(row.cess.toFixed(2)),
  }));

  // 5. Credit & Debit Notes
  const creditNotes = normInvs.filter((inv) => inv.isCdnr && !inv.isDebitNote);
  const debitNotes = normInvs.filter((inv) => inv.isCdnr && inv.isDebitNote);
  const cdnrList = creditNotes.filter((inv) => Boolean(inv.partyGstin));
  const cdnurList = creditNotes.filter((inv) => !inv.partyGstin);

  // 6. HSN Summaries (Separated into B2B and B2C)
  const buildHsnSummary = (invList: typeof normInvs) => {
    const hMap = new Map<string, {
      hsn: string;
      desc: string;
      uqc: string;
      qty: number;
      value: number;
      rate: number;
      taxable: number;
      igst: number;
      cgst: number;
      sgst: number;
      cess: number;
    }>();

    invList.forEach((inv) => {
      if (inv.items.length > 0) {
        inv.items.forEach((it: any, idx: number) => {
          const hsn = String(it.hsn_code || it.hsn || "84713010").trim();
          const desc = it.name || it.product_name || `Item ${idx + 1}`;
          const uqc = String(it.uqc || it.unit || it.selected_uom || "NOS").toUpperCase();
          const qty = Number(it.quantity || it.qty || 1);
          const itemTaxRate = getEffectiveTaxRate(it) || Number(it.tax_rate ?? it.tax_percent ?? it.gst_rate ?? inv.rate);
          const itUnitPrice = Number(it.unit_price ?? it.price ?? it.selling_price ?? it.rate ?? 0);
          const itGross = itUnitPrice * qty;
          const itDiscVal = Number(it.discount_value ?? it.discount ?? it.discount_amount ?? 0);
          const itDisc = it.discount_type === "percent"
            ? (itGross * itDiscVal) / 100
            : Math.min(itDiscVal * qty, itGross);
          const effectiveGross = Math.max(0, itGross - itDisc);
          const isIncl = it.is_tax_inclusive === true || inv.is_tax_inclusive === true || it.tax_included === true || it.is_inclusive === true;

          let itemTaxable = 0;
          let itemTax = 0;
          if (it.taxable_amount !== undefined && it.taxable_amount !== null && Number(it.taxable_amount) > 0) {
            itemTaxable = Number(it.taxable_amount);
            itemTax = (it.tax_amount !== undefined && it.tax_amount !== null) ? Number(it.tax_amount) : (itemTaxable * itemTaxRate) / 100;
          } else if (it.subtotal !== undefined && it.subtotal !== null && Number(it.subtotal) > 0 && !isIncl) {
            itemTaxable = Number(it.subtotal);
            itemTax = (it.tax_amount !== undefined && it.tax_amount !== null) ? Number(it.tax_amount) : (itemTaxable * itemTaxRate) / 100;
          } else if (isIncl && itemTaxRate > 0) {
            itemTaxable = effectiveGross / (1 + itemTaxRate / 100);
            itemTax = effectiveGross - itemTaxable;
          } else {
            itemTaxable = effectiveGross;
            itemTax = (effectiveGross * itemTaxRate) / 100;
          }

          const isInter = inv.isInterstate;

          const key = `${hsn}_${itemTaxRate}`;
          const cur = hMap.get(key) || {
            hsn,
            desc,
            uqc,
            qty: 0,
            value: 0,
            rate: itemTaxRate,
            taxable: 0,
            igst: 0,
            cgst: 0,
            sgst: 0,
            cess: 0,
          };
          cur.qty += qty;
          cur.taxable += itemTaxable;
          cur.value += itemTaxable + itemTax;
          if (isInter) {
            cur.igst += itemTax;
          } else {
            cur.cgst += itemTax / 2;
            cur.sgst += itemTax / 2;
          }
          hMap.set(key, cur);
        });
      } else {
        const hsn = "84713010";
        const desc = "General Supplies & Outward Products";
        const uqc = "NOS";
        const key = `${hsn}_${inv.rate}`;
        const cur = hMap.get(key) || {
          hsn,
          desc,
          uqc,
          qty: 0,
          value: 0,
          rate: inv.rate,
          taxable: 0,
          igst: 0,
          cgst: 0,
          sgst: 0,
          cess: 0,
        };
        cur.qty += 1;
        cur.taxable += inv.taxable;
        cur.value += inv.total;
        cur.igst += inv.igst;
        cur.cgst += inv.cgst;
        cur.sgst += inv.sgst;
        cur.cess += inv.cess;
        hMap.set(key, cur);
      }
    });

    return Array.from(hMap.values()).map((h) => ({
      ...h,
      qty: Number(h.qty.toFixed(2)),
      value: Number(h.value.toFixed(2)),
      taxable: Number(h.taxable.toFixed(2)),
      igst: Number(h.igst.toFixed(2)),
      cgst: Number(h.cgst.toFixed(2)),
      sgst: Number(h.sgst.toFixed(2)),
      cess: Number(h.cess.toFixed(2)),
    }));
  };

  const hsnB2bList = buildHsnSummary(b2bList);
  const hsnB2cList = buildHsnSummary(salesInvoices.filter((i) => !i.partyGstin));
  const hsnList = [...hsnB2bList, ...hsnB2cList];

  const expList = normInvs.filter((inv) => inv.isExport);

  // 7. Documents Series
  const outwardInvoices = salesInvoices;
  const fromInv = outwardInvoices.length > 0 ? outwardInvoices[outwardInvoices.length - 1].invNo : 1;
  const toInv = outwardInvoices.length > 0 ? outwardInvoices[0].invNo : 1;

  const docSeries = [
    {
      nature: "Invoices for outward supply",
      from: fromInv,
      to: toInv,
      total: outwardInvoices.length,
      cancelled: 0,
      net: outwardInvoices.length,
    },
    ...(creditNotes.length > 0
      ? [
          {
            nature: "Credit Note",
            from: creditNotes[creditNotes.length - 1]?.invNo || "CN-001",
            to: creditNotes[0]?.invNo || "CN-001",
            total: creditNotes.length,
            cancelled: 0,
            net: creditNotes.length,
          },
        ]
      : []),
    ...(debitNotes.length > 0
      ? [
          {
            nature: "Debit Note",
            from: debitNotes[debitNotes.length - 1]?.invNo || "DN-001",
            to: debitNotes[0]?.invNo || "DN-001",
            total: debitNotes.length,
            cancelled: 0,
            net: debitNotes.length,
          },
        ]
      : []),
  ];

  const totals = {
    totalTaxable: normInvs.reduce((s, i) => s + i.taxable, 0),
    totalCgst: normInvs.reduce((s, i) => s + i.cgst, 0),
    totalSgst: normInvs.reduce((s, i) => s + i.sgst, 0),
    totalIgst: normInvs.reduce((s, i) => s + i.igst, 0),
    totalCess: normInvs.reduce((s, i) => s + i.cess, 0),
    totalValue: normInvs.reduce((s, i) => s + i.total, 0),
  };

  return {
    salesInvoices,
    b2bList,
    b2clList,
    b2csList,
    expList,
    creditNotes,
    debitNotes,
    cdnrList,
    cdnurList,
    hsnB2bList,
    hsnB2cList,
    hsnList,
    docDetails: {
      fromInv,
      toInv,
      totalInvoices: outwardInvoices.length,
      cancelledInvoices: 0,
      totalCreditNotes: creditNotes.length,
      totalDebitNotes: debitNotes.length,
    },
    docSeries,
    totals,
  };
}

/**
 * Exports GSTR-1 as an official multi-sheet Microsoft Excel (.xlsx) file in exact myBillBook structure.
 */
export function downloadGstr1Excel(invoices: any[] = [], meta: GstCompanyMeta = {}) {
  const {
    salesInvoices,
    b2bList,
    b2clList,
    b2csList,
    creditNotes,
    debitNotes,
    cdnrList,
    cdnurList,
    hsnB2bList,
    hsnB2cList,
    docDetails,
  } = buildGstr1Sections(invoices);

  const wb = XLSX.utils.book_new();

  const cName = meta.tradeName || meta.companyName || "I Smart Bazaar";
  const phone = meta.phone || "9849344919";
  const gstin = meta.gstin || "37AAACG1234F1Z5";
  const dateRangeStr = meta.startDate && meta.endDate
    ? `${formatDate(meta.startDate)}-${formatDate(meta.endDate)}`
    : meta.period || `01/04/${new Date().getFullYear()}-${formatDate(new Date())}`;

  // ==========================================
  // SHEET 1: gstr1 (Consolidated Sales, Return & Purchase Return)
  // ==========================================
  const gstr1Rows: any[][] = [];
  gstr1Rows.push([cName]);
  gstr1Rows.push([`Phone No: ${phone}`]);
  gstr1Rows.push([]);
  gstr1Rows.push([]);
  gstr1Rows.push(["GSTR-1"]);
  gstr1Rows.push([`Dated: ${dateRangeStr}`]);
  gstr1Rows.push([]);
  gstr1Rows.push([]);
  gstr1Rows.push([]);
  gstr1Rows.push([]);
  gstr1Rows.push([]);
  gstr1Rows.push([]);
  gstr1Rows.push(["Sales"]);
  gstr1Rows.push(["GSTIN", "Customer Name", "Place of supply", "", "Invoice Details", "", "", "Total Tax%", "Taxable Value", "Amount of Tax", "", "", "", "", ""]);
  gstr1Rows.push([" ", " ", "State Code", "State Name", "Invoice Number", "Invoice Date", "Invoice value", "", "", "Central Tax Amount", "State/UT Tax Amount", "Integrated Tax Amount", "Cess Amt.", "Total Tax Amt.", ""]);

  let sumSalesInvVal = 0;
  let sumSalesTaxable = 0;
  let sumSalesCgst = 0;
  let sumSalesSgst = 0;
  let sumSalesIgst = 0;
  let sumSalesCess = 0;
  let sumSalesTax = 0;

  salesInvoices.forEach((inv) => {
    sumSalesInvVal += inv.total;
    inv.rateBreakdowns.forEach((rb, idx) => {
      sumSalesTaxable += rb.taxable;
      sumSalesCgst += rb.cgst;
      sumSalesSgst += rb.sgst;
      sumSalesIgst += rb.igst;
      sumSalesCess += rb.cess;
      sumSalesTax += rb.totalTax;

      if (idx === 0) {
        gstr1Rows.push([
          inv.partyGstin,
          inv.partyName,
          inv.posCode,
          inv.posName,
          inv.invNo,
          inv.invDate,
          inv.total,
          rb.rate,
          rb.taxable,
          rb.cgst,
          rb.sgst,
          rb.igst,
          rb.cess,
          rb.totalTax,
          "",
        ]);
      } else {
        gstr1Rows.push([
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          rb.rate,
          rb.taxable,
          rb.cgst,
          rb.sgst,
          rb.igst,
          rb.cess,
          rb.totalTax,
          "",
        ]);
      }
    });
  });

  gstr1Rows.push([]);
  gstr1Rows.push([
    "Total",
    "",
    "",
    "",
    "",
    "",
    Number(sumSalesInvVal.toFixed(2)),
    "",
    Number(sumSalesTaxable.toFixed(2)),
    Number(sumSalesCgst.toFixed(2)),
    Number(sumSalesSgst.toFixed(2)),
    Number(sumSalesIgst.toFixed(2)),
    Number(sumSalesCess.toFixed(2)),
    Number(sumSalesTax.toFixed(2)),
    "",
  ]);

  // Blank spacing before Sales Return
  gstr1Rows.push([]);
  gstr1Rows.push([]);
  gstr1Rows.push([]);
  gstr1Rows.push([]);
  gstr1Rows.push(["Sales Return"]);
  gstr1Rows.push(["GSTIN", "Customer Name", "Place of supply", "", "Invoice Details", "", "", "", "Total Tax%", "Taxable Value", "Amount of Tax", "", "", "", ""]);
  gstr1Rows.push([" ", " ", "State Code", "State Name", "Invoice Number", "Invoice Date", "Invoice value", "Invoice Type", "", "", "Central Tax Amount", "State/UT Tax Amount", "Integrated Tax Amount", "Cess Amt.", "Total Tax Amt."]);

  let sumReturnVal = 0;
  let sumReturnTaxable = 0;
  let sumReturnCgst = 0;
  let sumReturnSgst = 0;
  let sumReturnIgst = 0;
  let sumReturnCess = 0;
  let sumReturnTax = 0;

  creditNotes.forEach((cn) => {
    sumReturnVal += cn.total;
    cn.rateBreakdowns.forEach((rb, idx) => {
      sumReturnTaxable += rb.taxable;
      sumReturnCgst += rb.cgst;
      sumReturnSgst += rb.sgst;
      sumReturnIgst += rb.igst;
      sumReturnCess += rb.cess;
      sumReturnTax += rb.totalTax;

      if (idx === 0) {
        gstr1Rows.push([
          cn.partyGstin,
          cn.partyName,
          cn.posCode,
          cn.posName,
          cn.invNo,
          cn.invDate,
          cn.total,
          "Credit Note",
          rb.rate,
          rb.taxable,
          rb.cgst,
          rb.sgst,
          rb.igst,
          rb.cess,
          rb.totalTax,
        ]);
      } else {
        gstr1Rows.push([
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          rb.rate,
          rb.taxable,
          rb.cgst,
          rb.sgst,
          rb.igst,
          rb.cess,
          rb.totalTax,
        ]);
      }
    });
  });

  gstr1Rows.push([]);
  gstr1Rows.push([
    "Total",
    "",
    "",
    "",
    "",
    "",
    Number(sumReturnVal.toFixed(2)),
    "",
    "",
    Number(sumReturnTaxable.toFixed(2)),
    Number(sumReturnCgst.toFixed(2)),
    Number(sumReturnSgst.toFixed(2)),
    Number(sumReturnIgst.toFixed(2)),
    Number(sumReturnCess.toFixed(2)),
    Number(sumReturnTax.toFixed(2)),
  ]);

  // Blank spacing before Purchase Return
  gstr1Rows.push([]);
  gstr1Rows.push([]);
  gstr1Rows.push([]);
  gstr1Rows.push([]);
  gstr1Rows.push(["Purchase Return"]);
  gstr1Rows.push(["GSTIN", "Customer Name", "Place of supply", "", "Invoice Details", "", "", "", "Total Tax%", "Taxable Value", "Amount of Tax", "", "", "", ""]);
  gstr1Rows.push([" ", " ", "State Code", "State Name", "Invoice Number", "Invoice Date", "Invoice value", "Invoice Type", "", "", "Central Tax Amount", "State/UT Tax Amount", "Integrated Tax Amount", "Cess Amt.", "Total Tax Amt."]);

  let sumPRVal = 0;
  let sumPRTaxable = 0;
  let sumPRCgst = 0;
  let sumPRSgst = 0;
  let sumPRIgst = 0;
  let sumPRCess = 0;
  let sumPRTax = 0;

  debitNotes.forEach((dn) => {
    sumPRVal += dn.total;
    dn.rateBreakdowns.forEach((rb, idx) => {
      sumPRTaxable += rb.taxable;
      sumPRCgst += rb.cgst;
      sumPRSgst += rb.sgst;
      sumPRIgst += rb.igst;
      sumPRCess += rb.cess;
      sumPRTax += rb.totalTax;

      if (idx === 0) {
        gstr1Rows.push([
          dn.partyGstin,
          dn.partyName,
          dn.posCode,
          dn.posName,
          dn.invNo,
          dn.invDate,
          dn.total,
          "Debit Note",
          rb.rate,
          rb.taxable,
          rb.cgst,
          rb.sgst,
          rb.igst,
          rb.cess,
          rb.totalTax,
        ]);
      } else {
        gstr1Rows.push([
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          rb.rate,
          rb.taxable,
          rb.cgst,
          rb.sgst,
          rb.igst,
          rb.cess,
          rb.totalTax,
        ]);
      }
    });
  });

  gstr1Rows.push([]);
  gstr1Rows.push([
    "Total",
    "",
    "",
    "",
    "",
    "",
    Number(sumPRVal.toFixed(2)),
    "",
    "",
    Number(sumPRTaxable.toFixed(2)),
    Number(sumPRCgst.toFixed(2)),
    Number(sumPRSgst.toFixed(2)),
    Number(sumPRIgst.toFixed(2)),
    Number(sumPRCess.toFixed(2)),
    Number(sumPRTax.toFixed(2)),
  ]);

  const wsGstr1 = XLSX.utils.aoa_to_sheet(gstr1Rows);
  XLSX.utils.book_append_sheet(wb, wsGstr1, "gstr1");

  // ==========================================
  // SHEET 2: b2b
  // ==========================================
  const b2bTotalInvVal = b2bList.reduce((s, i) => s + i.total, 0);
  const b2bTotalTaxable = b2bList.reduce((s, i) => s + i.taxable, 0);
  const b2bTotalCess = b2bList.reduce((s, i) => s + i.cess, 0);
  const uniqueB2bRecipients = new Set(b2bList.map((i) => i.partyGstin)).size;

  const b2bRows: any[][] = [
    ["Summary For B2B", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["No. of Recipients", "", "No. of Invoices", "", "Total Invoice Value", "", "", "", "", "", "", "Total Taxable", "Total Cess"],
    [uniqueB2bRecipients, "", b2bList.length, "", Number(b2bTotalInvVal.toFixed(2)), "", "", "", "", "", "", Number(b2bTotalTaxable.toFixed(2)), Number(b2bTotalCess.toFixed(2))],
    ["GSTIN/UIN of Recipient", "Receiver Name", "Invoice Number", "Invoice date", "Invoice Value", "Place Of Supply", "Reverse Charge", "Applicable % of Tax Rate", "Invoice Type", "E-Commerce GSTIN", "Rate", "Taxable Value", "Cess Amount"],
  ];
  b2bList.forEach((inv) => {
    inv.rateBreakdowns.forEach((rb) => {
      b2bRows.push([
        inv.partyGstin,
        inv.partyName,
        inv.invNo,
        inv.invDate,
        inv.total,
        inv.posFormatted,
        "N",
        "",
        "Regular",
        "",
        rb.rate,
        rb.taxable,
        rb.cess,
      ]);
    });
  });
  const wsB2b = XLSX.utils.aoa_to_sheet(b2bRows);
  XLSX.utils.book_append_sheet(wb, wsB2b, "b2b");

  // ==========================================
  // SHEET 3: b2cl
  // ==========================================
  const b2clTotalInvVal = b2clList.reduce((s, i) => s + i.total, 0);
  const b2clTotalTaxable = b2clList.reduce((s, i) => s + i.taxable, 0);
  const b2clTotalCess = b2clList.reduce((s, i) => s + i.cess, 0);

  const b2clRows: any[][] = [
    ["Summary For B2CL", "", "", "", "", "", "", "", ""],
    ["No. of Invoices", "", "Total Invoice Value", "", "", "", "Total Taxable Value", "Total Cess", ""],
    [b2clList.length, "", Number(b2clTotalInvVal.toFixed(2)), "", "", "", Number(b2clTotalTaxable.toFixed(2)), Number(b2clTotalCess.toFixed(2)), ""],
    ["Invoice Number", "Invoice date", "Invoice Value", "Place Of Supply", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount", "E-Commerce GSTIN"],
  ];
  b2clList.forEach((inv) => {
    inv.rateBreakdowns.forEach((rb) => {
      b2clRows.push([
        inv.invNo,
        inv.invDate,
        inv.total,
        inv.posFormatted,
        "",
        rb.rate,
        rb.taxable,
        rb.cess,
        "",
      ]);
    });
  });
  const wsB2cl = XLSX.utils.aoa_to_sheet(b2clRows);
  XLSX.utils.book_append_sheet(wb, wsB2cl, "b2cl");

  // ==========================================
  // SHEET 4: b2cs
  // ==========================================
  const b2csTotalTaxable = b2csList.reduce((s, i) => s + i.taxable, 0);
  const b2csTotalCess = b2csList.reduce((s, i) => s + i.cess, 0);

  const b2csRows: any[][] = [
    ["Summary For B2CS", "", "", "", "", "", ""],
    ["", "", "", "", "Total Taxable Value", "Total Cess", ""],
    ["", "", "", "", Number(b2csTotalTaxable.toFixed(2)), Number(b2csTotalCess.toFixed(2)), ""],
    ["Type", "Place Of Supply", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount", "E-Commerce GSTIN"],
  ];
  b2csList.forEach((r) => {
    b2csRows.push([
      "OE",
      r.posFormatted,
      "",
      r.rate,
      r.taxable,
      r.cess,
      "",
    ]);
  });
  const wsB2cs = XLSX.utils.aoa_to_sheet(b2csRows);
  XLSX.utils.book_append_sheet(wb, wsB2cs, "b2cs");

  // ==========================================
  // SHEET 5: cdnr
  // ==========================================
  const cdnrTotalNoteVal = cdnrList.reduce((s, i) => s + i.total, 0);
  const cdnrTotalTaxable = cdnrList.reduce((s, i) => s + i.taxable, 0);
  const cdnrTotalCess = cdnrList.reduce((s, i) => s + i.cess, 0);
  const uniqueCdnrRecipients = new Set(cdnrList.map((i) => i.partyGstin)).size;

  const cdnrRows: any[][] = [
    ["Summary For CDNR", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["No. of Recipients", "No. of Notes", "", "", "", "", "", "Total Note Value", "", "", "Total Taxable Value", "Total Cess", ""],
    [uniqueCdnrRecipients, cdnrList.length, "", "", "", "", "", Number(cdnrTotalNoteVal.toFixed(2)), "", "", Number(cdnrTotalTaxable.toFixed(2)), Number(cdnrTotalCess.toFixed(2)), ""],
    ["GSTIN/UIN of Recipient", "Receiver Name", "Note Number", "Note Date", "Note Type", "Place Of Supply", "Reverse Charge", "Note Supply Type", "Note Value", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount"],
  ];
  cdnrList.forEach((cn) => {
    cn.rateBreakdowns.forEach((rb) => {
      cdnrRows.push([
        cn.partyGstin,
        cn.partyName,
        cn.invNo,
        cn.invDate,
        "C",
        cn.posFormatted,
        "N",
        "Regular",
        cn.total,
        "",
        rb.rate,
        rb.taxable,
        rb.cess,
      ]);
    });
  });
  const wsCdnr = XLSX.utils.aoa_to_sheet(cdnrRows);
  XLSX.utils.book_append_sheet(wb, wsCdnr, "cdnr");

  // ==========================================
  // SHEET 6: cdnur
  // ==========================================
  const cdnurTotalNoteVal = cdnurList.reduce((s, i) => s + i.total, 0);
  const cdnurTotalTaxable = cdnurList.reduce((s, i) => s + i.taxable, 0);
  const cdnurTotalCess = cdnurList.reduce((s, i) => s + i.cess, 0);

  const cdnurRows: any[][] = [
    ["Summary For CDNUR", "", "", "", "", "", "", "", "", ""],
    ["", "No. of Notes/Vouchers", "", "", "", "Total Note Value", "", "", "Total Taxable Value", "Total Cess"],
    ["", cdnurList.length, "", "", "", Number(cdnurTotalNoteVal.toFixed(2)), "", "", Number(cdnurTotalTaxable.toFixed(2)), Number(cdnurTotalCess.toFixed(2))],
    ["UR Type", "Note Number", "Note Date", "Note Type", "Place Of Supply", "Note Value", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount"],
  ];
  cdnurList.forEach((cn) => {
    cn.rateBreakdowns.forEach((rb) => {
      cdnurRows.push([
        "B2CS",
        cn.invNo,
        cn.invDate,
        "C",
        cn.posFormatted,
        cn.total,
        "",
        rb.rate,
        rb.taxable,
        rb.cess,
      ]);
    });
  });
  const wsCdnur = XLSX.utils.aoa_to_sheet(cdnurRows);
  XLSX.utils.book_append_sheet(wb, wsCdnur, "cdnur");

  // ==========================================
  // SHEET 7: exemp
  // ==========================================
  const exempRows: any[][] = [
    ["Summary For Nil rated, exempted and non GST outward supplies (8)", "", "", ""],
    ["", "Total Nil Rated Supplies", "Total Exempted Supplies", "Total Non-GST Supplies"],
    ["", 0.0, 0.0, 0.0],
    ["Description", "Nil Rated Supplies", "Exempted(other than nil rated/non GST supply)", "Non-GST Supplies"],
    ["Inter-State supplies to registered persons", 0.0, 0.0, 0.0],
    ["Intra-State supplies to registered persons", 0.0, 0.0, 0.0],
    ["Inter-State supplies to unregistered persons", 0.0, 0.0, 0.0],
    ["Intra-State supplies to unregistered persons", 0.0, 0.0, 0.0],
  ];
  const wsExemp = XLSX.utils.aoa_to_sheet(exempRows);
  XLSX.utils.book_append_sheet(wb, wsExemp, "exemp");

  // ==========================================
  // SHEET 8: hsn(b2b)
  // ==========================================
  const hsnB2bTotalVal = hsnB2bList.reduce((s, i) => s + i.value, 0);
  const hsnB2bTotalTaxable = hsnB2bList.reduce((s, i) => s + i.taxable, 0);
  const hsnB2bTotalIgst = hsnB2bList.reduce((s, i) => s + i.igst, 0);
  const hsnB2bTotalCgst = hsnB2bList.reduce((s, i) => s + i.cgst, 0);
  const hsnB2bTotalSgst = hsnB2bList.reduce((s, i) => s + i.sgst, 0);
  const hsnB2bTotalCess = hsnB2bList.reduce((s, i) => s + i.cess, 0);

  const hsnB2bRows: any[][] = [
    ["Summary For HSN(12)", "", "", "", "", "", "", "", "", "", ""],
    ["No. of HSN", "", "", "", "Total Value", "", "Total Taxable Value", "Total Integrated Tax", "Total Central Tax", "Total State/UT Tax", "Total Cess"],
    [hsnB2bList.length, "", "", "", Number(hsnB2bTotalVal.toFixed(2)), "", Number(hsnB2bTotalTaxable.toFixed(2)), Number(hsnB2bTotalIgst.toFixed(2)), Number(hsnB2bTotalCgst.toFixed(2)), Number(hsnB2bTotalSgst.toFixed(2)), Number(hsnB2bTotalCess.toFixed(2))],
    ["HSN", "Description", "UQC", "Total Quantity", "Total Value", "Rate", "Taxable Value", "Integrated Tax Amount", "Central Tax Amount", "State/UT Tax Amount", "Cess Amount"],
  ];
  hsnB2bList.forEach((h) => {
    hsnB2bRows.push([
      h.hsn,
      h.desc,
      h.uqc,
      h.qty,
      h.value,
      h.rate,
      h.taxable,
      h.igst,
      h.cgst,
      h.sgst,
      h.cess,
    ]);
  });
  const wsHsnB2b = XLSX.utils.aoa_to_sheet(hsnB2bRows);
  XLSX.utils.book_append_sheet(wb, wsHsnB2b, "hsn(b2b)");

  // ==========================================
  // SHEET 9: hsn(b2c)
  // ==========================================
  const hsnB2cTotalVal = hsnB2cList.reduce((s, i) => s + i.value, 0);
  const hsnB2cTotalTaxable = hsnB2cList.reduce((s, i) => s + i.taxable, 0);
  const hsnB2cTotalIgst = hsnB2cList.reduce((s, i) => s + i.igst, 0);
  const hsnB2cTotalCgst = hsnB2cList.reduce((s, i) => s + i.cgst, 0);
  const hsnB2cTotalSgst = hsnB2cList.reduce((s, i) => s + i.sgst, 0);
  const hsnB2cTotalCess = hsnB2cList.reduce((s, i) => s + i.cess, 0);

  const hsnB2cRows: any[][] = [
    ["Summary For HSN(12)", "", "", "", "", "", "", "", "", "", ""],
    ["No. of HSN", "", "", "", "Total Value", "", "Total Taxable Value", "Total Integrated Tax", "Total Central Tax", "Total State/UT Tax", "Total Cess"],
    [hsnB2cList.length, "", "", "", Number(hsnB2cTotalVal.toFixed(2)), "", Number(hsnB2cTotalTaxable.toFixed(2)), Number(hsnB2cTotalIgst.toFixed(2)), Number(hsnB2cTotalCgst.toFixed(2)), Number(hsnB2cTotalSgst.toFixed(2)), Number(hsnB2cTotalCess.toFixed(2))],
    ["HSN", "Description", "UQC", "Total Quantity", "Total Value", "Rate", "Taxable Value", "Integrated Tax Amount", "Central Tax Amount", "State/UT Tax Amount", "Cess Amount"],
  ];
  hsnB2cList.forEach((h) => {
    hsnB2cRows.push([
      h.hsn,
      h.desc,
      h.uqc,
      h.qty,
      h.value,
      h.rate,
      h.taxable,
      h.igst,
      h.cgst,
      h.sgst,
      h.cess,
    ]);
  });
  const wsHsnB2c = XLSX.utils.aoa_to_sheet(hsnB2cRows);
  XLSX.utils.book_append_sheet(wb, wsHsnB2c, "hsn(b2c)");

  // ==========================================
  // SHEET 10: docs
  // ==========================================
  const docsRows: any[][] = [
    ["Summary of documents issued during the tax period (13)", "", "", "", ""],
    ["", "", "", "Total Number", "Total Cancelled"],
    ["", "", "", docDetails.totalInvoices + docDetails.totalCreditNotes + docDetails.totalDebitNotes, 0],
    ["Nature of Document", "Sr. No. From", "Sr. No. To", "Total Number", "Cancelled"],
    ["Invoices for outward supply", docDetails.fromInv, docDetails.toInv, docDetails.totalInvoices, docDetails.cancelledInvoices],
  ];
  if (docDetails.totalCreditNotes > 0) {
    const fromCn = creditNotes.length > 0 ? creditNotes[creditNotes.length - 1].invNo : "CN-001";
    const toCn = creditNotes.length > 0 ? creditNotes[0].invNo : "CN-001";
    docsRows.push(["Credit Note", fromCn, toCn, docDetails.totalCreditNotes, 0]);
  }
  if (docDetails.totalDebitNotes > 0) {
    const fromDn = debitNotes.length > 0 ? debitNotes[debitNotes.length - 1].invNo : "DN-001";
    const toDn = debitNotes.length > 0 ? debitNotes[0].invNo : "DN-001";
    docsRows.push(["Debit Note", fromDn, toDn, docDetails.totalDebitNotes, 0]);
  }
  const wsDocs = XLSX.utils.aoa_to_sheet(docsRows);
  XLSX.utils.book_append_sheet(wb, wsDocs, "docs");

  // Trigger file download
  const cleanFileName = `GSTR1_${(cName || "Report").replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, cleanFileName);
}

/**
 * Exports GSTR-1 as an official UTF-8 BOM CSV file.
 */
export function downloadGstr1Csv(invoices: any[] = [], meta: GstCompanyMeta = {}) {
  const {
    salesInvoices,
    b2bList,
    b2clList,
    b2csList,
    creditNotes,
    hsnB2bList,
    hsnB2cList,
  } = buildGstr1Sections(invoices);

  const cName = meta.tradeName || meta.companyName || "I Smart Bazaar";
  const gstin = meta.gstin || "37AAACG1234F1Z5";
  const period = meta.period || "Current Period";

  const lines: string[] = [];
  const esc = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;

  lines.push(`"${cName.toUpperCase()} — GSTR-1 OUTWARD SUPPLIES RETURN"`);
  lines.push(`"Legal Name:",${esc(cName)},"GSTIN:",${esc(gstin)},"Period:",${esc(period)},"Exported:",${esc(new Date().toLocaleString())}`);
  lines.push("");

  // Table 4: B2B
  lines.push(`"=== TABLE 4: B2B TAX INVOICES (REGISTERED RECIPIENTS) ==="`);
  lines.push(["GSTIN/UIN of Recipient", "Receiver Name", "Invoice Number", "Invoice date", "Invoice Value", "Place Of Supply", "Reverse Charge", "Rate", "Taxable Value", "Cess Amount"].map(esc).join(","));
  b2bList.forEach((inv) => {
    inv.rateBreakdowns.forEach((rb) => {
      lines.push([inv.partyGstin, inv.partyName, inv.invNo, inv.invDate, inv.total.toFixed(2), inv.posFormatted, "N", rb.rate + "%", rb.taxable.toFixed(2), rb.cess.toFixed(2)].map(esc).join(","));
    });
  });
  lines.push("");

  // Table 5: B2CL
  lines.push(`"=== TABLE 5: B2C LARGE INVOICES (INTERSTATE > 2.5 LAKHS) ==="`);
  lines.push(["Invoice Number", "Invoice date", "Invoice Value", "Place Of Supply", "Rate", "Taxable Value", "Cess Amount"].map(esc).join(","));
  b2clList.forEach((inv) => {
    inv.rateBreakdowns.forEach((rb) => {
      lines.push([inv.invNo, inv.invDate, inv.total.toFixed(2), inv.posFormatted, rb.rate + "%", rb.taxable.toFixed(2), rb.cess.toFixed(2)].map(esc).join(","));
    });
  });
  lines.push("");

  // Table 7: B2CS
  lines.push(`"=== TABLE 7: B2C SMALL SUPPLIES ==="`);
  lines.push(["Type", "Place Of Supply", "Rate", "Taxable Value", "Cess Amount"].map(esc).join(","));
  b2csList.forEach((r) => {
    lines.push(["OE", r.posFormatted, r.rate + "%", r.taxable.toFixed(2), r.cess.toFixed(2)].map(esc).join(","));
  });
  lines.push("");

  // Table 9B: CDNR
  lines.push(`"=== TABLE 9B: CREDIT / DEBIT NOTES (REGISTERED) ==="`);
  lines.push(["GSTIN/UIN of Recipient", "Receiver Name", "Note Number", "Note Date", "Note Type", "Place Of Supply", "Note Value", "Rate", "Taxable Value", "Cess Amount"].map(esc).join(","));
  creditNotes.forEach((cn) => {
    cn.rateBreakdowns.forEach((rb) => {
      lines.push([cn.partyGstin, cn.partyName, cn.invNo, cn.invDate, "C", cn.posFormatted, cn.total.toFixed(2), rb.rate + "%", rb.taxable.toFixed(2), rb.cess.toFixed(2)].map(esc).join(","));
    });
  });
  lines.push("");

  // Table 12: HSN Summary
  lines.push(`"=== TABLE 12: HSN SUMMARY ==="`);
  lines.push(["HSN", "Description", "UQC", "Total Quantity", "Total Value", "Rate", "Taxable Value", "Integrated Tax", "Central Tax", "State/UT Tax", "Cess"].map(esc).join(","));
  [...hsnB2bList, ...hsnB2cList].forEach((h) => {
    lines.push([h.hsn, h.desc, h.uqc, h.qty, h.value.toFixed(2), h.rate + "%", h.taxable.toFixed(2), h.igst.toFixed(2), h.cgst.toFixed(2), h.sgst.toFixed(2), h.cess.toFixed(2)].map(esc).join(","));
  });

  const fullCsv = "\uFEFF" + lines.join("\n");
  const blob = new Blob([fullCsv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `GSTR1_${(cName || "Report").replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * General GST Reports Excel (.xlsx) exporter for any report in the GST Suite.
 */
export function downloadGenericGstReportExcel(
  reportId: string,
  reportName: string,
  data: { invoices: any[]; purchases: any[] },
  meta: GstCompanyMeta = {}
) {
  const wb = XLSX.utils.book_new();
  const cName = meta.companyName || "My Business Organization";
  const gstin = meta.gstin || "37AAACG1234F1Z5";
  const period = meta.period || "Current Period";

  const rows: any[][] = [
    [`BUSINESSOS AI — ${reportName.toUpperCase()}`],
    ["Legal Name:", cName, "GSTIN:", gstin],
    ["Period:", period, "Generated On:", new Date().toLocaleString()],
    [],
  ];

  if (reportId === "gst_sales" || reportId === "b2b_sales" || reportId === "b2c_sales") {
    rows.push(["Invoice No", "Date", "Customer Name", "Customer GSTIN", "POS", "Taxable Value (₹)", "CGST (₹)", "SGST (₹)", "IGST (₹)", "Cess (₹)", "Total Amount (₹)"]);
    data.invoices.forEach((raw) => {
      const inv = normalizeGstInvoice(raw);
      rows.push([inv.invNo, inv.invDate, inv.partyName, inv.partyGstin || "Unregistered", inv.posFormatted, inv.taxable, inv.cgst, inv.sgst, inv.igst, inv.cess, inv.total]);
    });
  } else if (reportId === "gst_purchase" || reportId === "gstr2_purchase") {
    rows.push(["Bill / Inv No", "Bill Date", "Supplier Name", "Supplier GSTIN", "Item Description", "HSN Code", "Qty", "Taxable Value (₹)", "CGST (₹)", "SGST (₹)", "IGST (₹)", "Total Amount (₹)"]);
    data.purchases.forEach((p: any) => {
      rows.push([
        p.invoice_no || p.bill_no || "PUR-001",
        p.date || new Date().toISOString().slice(0, 10),
        p.party_name || p.supplier_name || "Supplier",
        p.party_gstin || "37AAACH5544K1Z0",
        p.item_name || "General Supplies",
        p.hsn_code || "72162100",
        p.qty || 1,
        p.taxable_value || 0,
        p.cgst || 0,
        p.sgst || 0,
        p.igst || 0,
        p.amount || 0,
      ]);
    });
  } else {
    rows.push(["Record #", "Document Reference", "Party / Entity", "Taxable (₹)", "CGST (₹)", "SGST (₹)", "IGST (₹)", "Gross Amount (₹)"]);
    data.invoices.forEach((raw, idx) => {
      const inv = normalizeGstInvoice(raw);
      rows.push([idx + 1, inv.invNo, inv.partyName, inv.taxable, inv.cgst, inv.sgst, inv.igst, inv.total]);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, reportId.slice(0, 31));

  const fileName = `${reportId.toUpperCase()}_${gstin}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * General GST Reports CSV (.csv) exporter for any report in the GST Suite.
 */
export function downloadGenericGstReportCsv(
  reportId: string,
  reportName: string,
  data: { invoices: any[]; purchases: any[] },
  meta: GstCompanyMeta = {}
) {
  const cName = meta.companyName || "My Business Organization";
  const gstin = meta.gstin || "37AAACG1234F1Z5";
  const period = meta.period || "Current Period";

  const esc = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const lines: string[] = [
    `"BUSINESSOS AI — ${reportName.toUpperCase()}"`,
    `"Legal Name:",${esc(cName)},"GSTIN:",${esc(gstin)},"Period:",${esc(period)},"Exported:",${esc(new Date().toLocaleString())}`,
    "",
  ];

  if (reportId === "gst_sales" || reportId === "b2b_sales" || reportId === "b2c_sales") {
    lines.push(["Invoice No", "Date", "Customer Name", "Customer GSTIN", "POS", "Taxable Value (₹)", "CGST (₹)", "SGST (₹)", "IGST (₹)", "Cess (₹)", "Total Amount (₹)"].map(esc).join(","));
    data.invoices.forEach((raw) => {
      const inv = normalizeGstInvoice(raw);
      lines.push([inv.invNo, inv.invDate, inv.partyName, inv.partyGstin || "Unregistered", inv.posFormatted, inv.taxable.toFixed(2), inv.cgst.toFixed(2), inv.sgst.toFixed(2), inv.igst.toFixed(2), inv.cess.toFixed(2), inv.total.toFixed(2)].map(esc).join(","));
    });
  } else if (reportId === "gst_purchase" || reportId === "gstr2_purchase") {
    lines.push(["Bill / Inv No", "Bill Date", "Supplier Name", "Supplier GSTIN", "Item Description", "HSN Code", "Qty", "Taxable Value (₹)", "CGST (₹)", "SGST (₹)", "IGST (₹)", "Total Amount (₹)"].map(esc).join(","));
    data.purchases.forEach((p: any) => {
      lines.push([
        p.invoice_no || p.bill_no || "PUR-001",
        p.date || new Date().toISOString().slice(0, 10),
        p.party_name || p.supplier_name || "Supplier",
        p.party_gstin || "37AAACH5544K1Z0",
        p.item_name || "General Supplies",
        p.hsn_code || "72162100",
        p.qty || 1,
        Number(p.taxable_value || 0).toFixed(2),
        Number(p.cgst || 0).toFixed(2),
        Number(p.sgst || 0).toFixed(2),
        Number(p.igst || 0).toFixed(2),
        Number(p.amount || 0).toFixed(2),
      ].map(esc).join(","));
    });
  } else {
    lines.push(["Record #", "Document Reference", "Party / Entity", "Taxable (₹)", "CGST (₹)", "SGST (₹)", "IGST (₹)", "Gross Amount (₹)"].map(esc).join(","));
    data.invoices.forEach((raw, idx) => {
      const inv = normalizeGstInvoice(raw);
      lines.push([idx + 1, inv.invNo, inv.partyName, inv.taxable.toFixed(2), inv.cgst.toFixed(2), inv.sgst.toFixed(2), inv.igst.toFixed(2), inv.total.toFixed(2)].map(esc).join(","));
    });
  }

  const fullCsv = "\uFEFF" + lines.join("\n");
  const blob = new Blob([fullCsv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${reportId.toUpperCase()}_${gstin}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
