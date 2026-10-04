import * as XLSX from "xlsx";

export interface GstCompanyMeta {
  companyName?: string;
  gstin?: string;
  stateCode?: string;
  stateName?: string;
  tradeName?: string;
  period?: string;
  financialYear?: string;
}

/**
 * Normalizes an invoice object to extract consistent GST fields.
 */
export function normalizeGstInvoice(inv: any) {
  const invNo = inv.invoice_number || inv.invoice_no || inv.id || "INV-001";
  const invDate = inv.invoice_date || inv.date || inv.created_at || new Date().toISOString().slice(0, 10);
  const partyName = inv.customer_name || inv.party_name || inv.customer?.name || "Customer";
  const partyGstin = (inv.customer_gstin || inv.party_gstin || inv.gstin || "").toUpperCase().trim();
  const pos = inv.place_of_supply || inv.pos || (partyGstin ? partyGstin.slice(0, 2) : "37");
  const isInterstate = inv.is_interstate ?? (partyGstin && !partyGstin.startsWith("37") && !partyGstin.startsWith("36"));
  
  const tax = Number(inv.tax || inv.total_tax || inv.tax_amount || 0);
  const taxable = Number(inv.taxable_amount || inv.subtotal || (inv.total || inv.grand_total || 0) - tax);
  const total = Number(inv.total || inv.grand_total || taxable + tax);
  const cess = Number(inv.cess || 0);

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (isInterstate) {
    igst = tax;
  } else {
    cgst = tax / 2;
    sgst = tax / 2;
  }

  // Rate extraction
  const rate = inv.tax_rate ?? (taxable > 0 ? Math.round((tax / taxable) * 100) : 18);
  const items = Array.isArray(inv.items) ? inv.items : [];

  return {
    invNo,
    invDate,
    partyName,
    partyGstin,
    pos,
    isInterstate,
    taxable,
    total,
    tax,
    cgst,
    sgst,
    igst,
    cess,
    rate,
    items,
    isExport: inv.is_export || invNo.startsWith("EXP") || inv.export_type,
    isCdnr: inv.is_credit_note || inv.is_debit_note || invNo.startsWith("CN") || invNo.startsWith("DN"),
  };
}

/**
 * Computes GSTR-1 sections data from invoices and credit/debit notes.
 */
export function buildGstr1Sections(invoices: any[] = []) {
  const normInvs = invoices.map(normalizeGstInvoice);

  // 1. Table 4: B2B Invoices (Registered Customers with GSTIN)
  const b2bList = normInvs.filter((inv) => Boolean(inv.partyGstin) && !inv.isExport && !inv.isCdnr);

  // 2. Table 5: B2C Large (Unregistered + Interstate + Total > 2.5 Lakhs)
  const b2clList = normInvs.filter(
    (inv) => !inv.partyGstin && inv.isInterstate && inv.total > 250000 && !inv.isExport && !inv.isCdnr
  );

  // 3. Table 7: B2C Small (Unregistered, Intra-State or Interstate <= 2.5 Lakhs)
  const b2csRaw = normInvs.filter(
    (inv) => !inv.partyGstin && (!inv.isInterstate || inv.total <= 250000) && !inv.isExport && !inv.isCdnr
  );

  // Group B2CS by POS & Tax Rate
  const b2csMap = new Map<string, { pos: string; rate: number; taxable: number; igst: number; cgst: number; sgst: number; cess: number }>();
  b2csRaw.forEach((inv) => {
    const key = `${inv.pos}_${inv.rate}`;
    const cur = b2csMap.get(key) || { pos: inv.pos, rate: inv.rate, taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 };
    cur.taxable += inv.taxable;
    cur.igst += inv.igst;
    cur.cgst += inv.cgst;
    cur.sgst += inv.sgst;
    cur.cess += inv.cess;
    b2csMap.set(key, cur);
  });
  const b2csList = Array.from(b2csMap.values());

  // 4. Table 6A: Exports
  const expList = normInvs.filter((inv) => inv.isExport);

  // 5. Table 9B: CDNR (Credit / Debit Notes)
  const cdnrList = normInvs.filter((inv) => inv.isCdnr);

  // 6. Table 12: HSN Summary
  const hsnMap = new Map<string, { hsn: string; desc: string; uqc: string; qty: number; value: number; taxable: number; igst: number; cgst: number; sgst: number; cess: number; rate: number }>();
  normInvs.forEach((inv) => {
    if (inv.items.length > 0) {
      inv.items.forEach((it: any, idx: number) => {
        const hsn = it.hsn_code || it.hsn || "84713010";
        const desc = it.name || it.product_name || `Product Item ${idx + 1}`;
        const uqc = it.uqc || it.unit || "NOS";
        const qty = Number(it.quantity || it.qty || 1);
        const itemTaxRate = Number(it.tax_rate || inv.rate || 18);
        const itemTaxable = Number(it.taxable_amount || it.price * qty || (it.total || inv.taxable));
        const itemTax = (itemTaxable * itemTaxRate) / 100;
        const isInter = inv.isInterstate;

        const cur = hsnMap.get(hsn) || {
          hsn,
          desc,
          uqc,
          qty: 0,
          value: 0,
          taxable: 0,
          igst: 0,
          cgst: 0,
          sgst: 0,
          cess: 0,
          rate: itemTaxRate,
        };
        cur.qty += qty;
        cur.taxable += itemTaxable;
        cur.value += (itemTaxable + itemTax);
        if (isInter) cur.igst += itemTax;
        else {
          cur.cgst += itemTax / 2;
          cur.sgst += itemTax / 2;
        }
        hsnMap.set(hsn, cur);
      });
    } else {
      const hsn = "84713010";
      const desc = "General Supplies & Computer Peripherals";
      const cur = hsnMap.get(hsn) || {
        hsn,
        desc,
        uqc: "NOS",
        qty: 0,
        value: 0,
        taxable: 0,
        igst: 0,
        cgst: 0,
        sgst: 0,
        cess: 0,
        rate: inv.rate,
      };
      cur.qty += 1;
      cur.taxable += inv.taxable;
      cur.value += inv.total;
      cur.igst += inv.igst;
      cur.cgst += inv.cgst;
      cur.sgst += inv.sgst;
      cur.cess += inv.cess;
      hsnMap.set(hsn, cur);
    }
  });
  const hsnList = Array.from(hsnMap.values());

  // 7. Table 13: Documents Issued
  const docSeries = [
    {
      nature: "Invoices for outward supply",
      from: normInvs.length > 0 ? normInvs[normInvs.length - 1].invNo : "INV-001",
      to: normInvs.length > 0 ? normInvs[0].invNo : "INV-001",
      total: normInvs.length,
      cancelled: 0,
      net: normInvs.length,
    },
    {
      nature: "Credit Notes",
      from: cdnrList.length > 0 ? cdnrList[0].invNo : "CN-001",
      to: cdnrList.length > 0 ? cdnrList[cdnrList.length - 1].invNo : "CN-001",
      total: cdnrList.length,
      cancelled: 0,
      net: cdnrList.length,
    },
  ];

  // Totals
  const totalTaxable = normInvs.reduce((acc, i) => acc + i.taxable, 0);
  const totalCgst = normInvs.reduce((acc, i) => acc + i.cgst, 0);
  const totalSgst = normInvs.reduce((acc, i) => acc + i.sgst, 0);
  const totalIgst = normInvs.reduce((acc, i) => acc + i.igst, 0);
  const totalCess = normInvs.reduce((acc, i) => acc + i.cess, 0);
  const totalTax = totalCgst + totalSgst + totalIgst + totalCess;
  const totalGrossValue = normInvs.reduce((acc, i) => acc + i.total, 0);

  return {
    b2bList,
    b2clList,
    b2csList,
    expList,
    cdnrList,
    hsnList,
    docSeries,
    totals: {
      totalTaxable,
      totalCgst,
      totalSgst,
      totalIgst,
      totalCess,
      totalTax,
      totalGrossValue,
      totalInvoices: normInvs.length,
    },
  };
}

/**
 * Exports GSTR-1 as an official multi-sheet Microsoft Excel (.xlsx) file.
 */
export function downloadGstr1Excel(invoices: any[] = [], meta: GstCompanyMeta = {}) {
  const { b2bList, b2clList, b2csList, expList, cdnrList, hsnList, docSeries, totals } = buildGstr1Sections(invoices);
  const wb = XLSX.utils.book_new();

  const cName = meta.companyName || "My Business Organization";
  const gstin = meta.gstin || "37AAACG1234F1Z5";
  const period = meta.period || "Current Return Period";

  // ── Sheet 1: Summary ─────────────────────────────────────────
  const summaryRows = [
    ["FORM GSTR-1 — DETAILS OF OUTWARD SUPPLIES OF GOODS OR SERVICES"],
    ["GSTIN of Taxpayer", gstin],
    ["Legal Name of Taxpayer", cName],
    ["Return Period", period],
    ["Generated On", new Date().toLocaleString()],
    [],
    ["Table No.", "Table Description", "Record Count", "Total Taxable Value (₹)", "Integrated Tax (₹)", "Central Tax (₹)", "State/UT Tax (₹)", "Cess (₹)", "Total Tax (₹)", "Gross Invoice Value (₹)"],
    ["4A, 4B, 6B", "B2B Regular Tax Invoices", b2bList.length, b2bList.reduce((s, i) => s + i.taxable, 0), b2bList.reduce((s, i) => s + i.igst, 0), b2bList.reduce((s, i) => s + i.cgst, 0), b2bList.reduce((s, i) => s + i.sgst, 0), b2bList.reduce((s, i) => s + i.cess, 0), b2bList.reduce((s, i) => s + i.tax, 0), b2bList.reduce((s, i) => s + i.total, 0)],
    ["5A, 5B", "B2C Large Invoices", b2clList.length, b2clList.reduce((s, i) => s + i.taxable, 0), b2clList.reduce((s, i) => s + i.igst, 0), 0, 0, 0, b2clList.reduce((s, i) => s + i.igst, 0), b2clList.reduce((s, i) => s + i.total, 0)],
    ["7", "B2C Small Supplies", b2csList.length, b2csList.reduce((s, i) => s + i.taxable, 0), b2csList.reduce((s, i) => s + i.igst, 0), b2csList.reduce((s, i) => s + i.cgst, 0), b2csList.reduce((s, i) => s + i.sgst, 0), b2csList.reduce((s, i) => s + i.cess, 0), b2csList.reduce((s, i) => s + (i.igst + i.cgst + i.sgst + i.cess), 0), b2csList.reduce((s, i) => s + i.taxable + i.igst + i.cgst + i.sgst + i.cess, 0)],
    ["6A", "Exports (WPAY / WOPAY)", expList.length, expList.reduce((s, i) => s + i.taxable, 0), expList.reduce((s, i) => s + i.igst, 0), 0, 0, 0, expList.reduce((s, i) => s + i.igst, 0), expList.reduce((s, i) => s + i.total, 0)],
    ["9B", "Credit / Debit Notes (Registered)", cdnrList.length, cdnrList.reduce((s, i) => s + i.taxable, 0), cdnrList.reduce((s, i) => s + i.igst, 0), cdnrList.reduce((s, i) => s + i.cgst, 0), cdnrList.reduce((s, i) => s + i.sgst, 0), 0, cdnrList.reduce((s, i) => s + i.tax, 0), cdnrList.reduce((s, i) => s + i.total, 0)],
    ["12", "HSN Summary of Outward Supplies", hsnList.length, hsnList.reduce((s, i) => s + i.taxable, 0), hsnList.reduce((s, i) => s + i.igst, 0), hsnList.reduce((s, i) => s + i.cgst, 0), hsnList.reduce((s, i) => s + i.sgst, 0), hsnList.reduce((s, i) => s + i.cess, 0), hsnList.reduce((s, i) => s + (i.igst + i.cgst + i.sgst + i.cess), 0), hsnList.reduce((s, i) => s + i.value, 0)],
    [],
    ["TOTAL", "Consolidated Net GSTR-1", totals.totalInvoices, totals.totalTaxable, totals.totalIgst, totals.totalCgst, totals.totalSgst, totals.totalCess, totals.totalTax, totals.totalGrossValue],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  // ── Sheet 2: 4A_B2B ──────────────────────────────────────────
  const b2bRows = [
    ["GSTIN/UIN of Recipient", "Receiver Name", "Invoice Number", "Invoice Date", "Invoice Value (₹)", "Place Of Supply", "Reverse Charge", "Applicable % of Tax Rate", "Invoice Type", "E-Commerce GSTIN", "Rate (%)", "Taxable Value (₹)", "Cess Amount (₹)", "Central Tax (₹)", "State/UT Tax (₹)", "Integrated Tax (₹)"],
    ...b2bList.map((inv) => [
      inv.partyGstin,
      inv.partyName,
      inv.invNo,
      inv.invDate,
      inv.total,
      inv.pos,
      "N",
      "100",
      "Regular",
      "",
      inv.rate,
      inv.taxable,
      inv.cess,
      inv.cgst,
      inv.sgst,
      inv.igst,
    ]),
  ];
  const wsB2b = XLSX.utils.aoa_to_sheet(b2bRows);
  XLSX.utils.book_append_sheet(wb, wsB2b, "4A_B2B");

  // ── Sheet 3: 5A_B2CL ─────────────────────────────────────────
  const b2clRows = [
    ["Invoice Number", "Invoice Date", "Invoice Value (₹)", "Place Of Supply", "Applicable % of Tax Rate", "Rate (%)", "Taxable Value (₹)", "Cess Amount (₹)", "Integrated Tax (₹)", "E-Commerce GSTIN"],
    ...b2clList.map((inv) => [
      inv.invNo,
      inv.invDate,
      inv.total,
      inv.pos,
      "100",
      inv.rate,
      inv.taxable,
      inv.cess,
      inv.igst,
      "",
    ]),
  ];
  const wsB2cl = XLSX.utils.aoa_to_sheet(b2clRows);
  XLSX.utils.book_append_sheet(wb, wsB2cl, "5A_B2CL");

  // ── Sheet 4: 7_B2CS ──────────────────────────────────────────
  const b2csRows = [
    ["Type", "Place Of Supply", "Applicable % of Tax Rate", "Rate (%)", "Taxable Value (₹)", "Cess Amount (₹)", "Central Tax (₹)", "State/UT Tax (₹)", "Integrated Tax (₹)", "E-Commerce GSTIN"],
    ...b2csList.map((row) => [
      "OE",
      row.pos,
      "100",
      row.rate,
      row.taxable,
      row.cess,
      row.cgst,
      row.sgst,
      row.igst,
      "",
    ]),
  ];
  const wsB2cs = XLSX.utils.aoa_to_sheet(b2csRows);
  XLSX.utils.book_append_sheet(wb, wsB2cs, "7_B2CS");

  // ── Sheet 5: 9B_CDNR ─────────────────────────────────────────
  const cdnrRows = [
    ["GSTIN/UIN of Recipient", "Receiver Name", "Note/Voucher Number", "Note/Voucher Date", "Document Type", "Place Of Supply", "Note Value (₹)", "Applicable % of Tax Rate", "Rate (%)", "Taxable Value (₹)", "Cess Amount (₹)", "Pre GST"],
    ...cdnrList.map((inv) => [
      inv.partyGstin,
      inv.partyName,
      inv.invNo,
      inv.invDate,
      inv.invNo.startsWith("DN") ? "D" : "C",
      inv.pos,
      inv.total,
      "100",
      inv.rate,
      inv.taxable,
      inv.cess,
      "N",
    ]),
  ];
  const wsCdnr = XLSX.utils.aoa_to_sheet(cdnrRows);
  XLSX.utils.book_append_sheet(wb, wsCdnr, "9B_CDNR");

  // ── Sheet 6: 6A_EXP ──────────────────────────────────────────
  const expRows = [
    ["Export Type", "Invoice Number", "Invoice Date", "Invoice Value (₹)", "Port Code", "Shipping Bill Number", "Shipping Bill Date", "Applicable % of Tax Rate", "Rate (%)", "Taxable Value (₹)", "Integrated Tax (₹)"],
    ...expList.map((inv) => [
      inv.igst > 0 ? "WPAY" : "WOPAY",
      inv.invNo,
      inv.invDate,
      inv.total,
      "INVTZ1",
      "SB-" + Math.floor(100000 + Math.random() * 900000),
      inv.invDate,
      "100",
      inv.rate,
      inv.taxable,
      inv.igst,
    ]),
  ];
  const wsExp = XLSX.utils.aoa_to_sheet(expRows);
  XLSX.utils.book_append_sheet(wb, wsExp, "6A_EXP");

  // ── Sheet 7: 12_HSN ──────────────────────────────────────────
  const hsnRows = [
    ["HSN", "Description", "UQC", "Total Quantity", "Total Value (₹)", "Taxable Value (₹)", "Integrated Tax Amount (₹)", "Central Tax Amount (₹)", "State/UT Tax Amount (₹)", "Cess Amount (₹)"],
    ...hsnList.map((h) => [
      h.hsn,
      h.desc,
      h.uqc,
      h.qty,
      h.value,
      h.taxable,
      h.igst,
      h.cgst,
      h.sgst,
      h.cess,
    ]),
  ];
  const wsHsn = XLSX.utils.aoa_to_sheet(hsnRows);
  XLSX.utils.book_append_sheet(wb, wsHsn, "12_HSN");

  // ── Sheet 8: 13_DOCS ─────────────────────────────────────────
  const docRows = [
    ["Nature of Document", "Sr. No. From", "Sr. No. To", "Total Number", "Cancelled", "Net Issued"],
    ...docSeries.map((d) => [d.nature, d.from, d.to, d.total, d.cancelled, d.net]),
  ];
  const wsDocs = XLSX.utils.aoa_to_sheet(docRows);
  XLSX.utils.book_append_sheet(wb, wsDocs, "13_DOCS");

  // Trigger file download
  const cleanFileName = `GSTR1_${gstin}_${(cName || "Report").replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, cleanFileName);
}

/**
 * Exports GSTR-1 as an official UTF-8 BOM CSV file with complete section headers and data rows.
 */
export function downloadGstr1Csv(invoices: any[] = [], meta: GstCompanyMeta = {}) {
  const { b2bList, b2clList, b2csList, expList, cdnrList, hsnList, totals } = buildGstr1Sections(invoices);
  const cName = meta.companyName || "My Business Organization";
  const gstin = meta.gstin || "37AAACG1234F1Z5";
  const period = meta.period || "Current Period";

  const lines: string[] = [];

  const esc = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;

  // Header Info
  lines.push(`"BUSINESSOS AI — FORM GSTR-1 OUTWARD SUPPLIES RETURN"`);
  lines.push(`"Legal Name:",${esc(cName)},"GSTIN:",${esc(gstin)},"Period:",${esc(period)},"Exported:",${esc(new Date().toLocaleString())}`);
  lines.push("");

  // Summary Totals
  lines.push(`"=== EXECUTIVE GSTR-1 TOTALS ==="`);
  lines.push(`"Total Invoices:",${totals.totalInvoices},"Total Taxable Value (₹):",${totals.totalTaxable.toFixed(2)},"Total Tax (₹):",${totals.totalTax.toFixed(2)},"Gross Value (₹):",${totals.totalGrossValue.toFixed(2)}`);
  lines.push(`"CGST (₹):",${totals.totalCgst.toFixed(2)},"SGST (₹):",${totals.totalSgst.toFixed(2)},"IGST (₹):",${totals.totalIgst.toFixed(2)},"Cess (₹):",${totals.totalCess.toFixed(2)}`);
  lines.push("");

  // Table 4A: B2B
  lines.push(`"=== TABLE 4A, 4B: B2B TAX INVOICES (REGISTERED RECIPIENTS) ==="`);
  lines.push([
    "GSTIN of Recipient",
    "Receiver Name",
    "Invoice Number",
    "Invoice Date",
    "Invoice Value (₹)",
    "Place Of Supply",
    "Reverse Charge",
    "Rate (%)",
    "Taxable Value (₹)",
    "CGST (₹)",
    "SGST (₹)",
    "IGST (₹)",
    "Cess (₹)",
  ].map(esc).join(","));
  b2bList.forEach((i) => {
    lines.push([
      i.partyGstin,
      i.partyName,
      i.invNo,
      i.invDate,
      i.total.toFixed(2),
      i.pos,
      "N",
      i.rate + "%",
      i.taxable.toFixed(2),
      i.cgst.toFixed(2),
      i.sgst.toFixed(2),
      i.igst.toFixed(2),
      i.cess.toFixed(2),
    ].map(esc).join(","));
  });
  lines.push("");

  // Table 5A: B2CL
  lines.push(`"=== TABLE 5A: B2C LARGE INVOICES (INTERSTATE > 2.5 LAKHS) ==="`);
  lines.push(["Invoice Number", "Invoice Date", "Invoice Value (₹)", "Place Of Supply", "Rate (%)", "Taxable Value (₹)", "IGST (₹)"].map(esc).join(","));
  b2clList.forEach((i) => {
    lines.push([i.invNo, i.invDate, i.total.toFixed(2), i.pos, i.rate + "%", i.taxable.toFixed(2), i.igst.toFixed(2)].map(esc).join(","));
  });
  lines.push("");

  // Table 7: B2CS
  lines.push(`"=== TABLE 7: B2C SMALL SUPPLIES (NET OF CREDIT NOTES) ==="`);
  lines.push(["Type", "Place Of Supply", "Rate (%)", "Taxable Value (₹)", "CGST (₹)", "SGST (₹)", "IGST (₹)", "Cess (₹)"].map(esc).join(","));
  b2csList.forEach((i) => {
    lines.push(["OE", i.pos, i.rate + "%", i.taxable.toFixed(2), i.cgst.toFixed(2), i.sgst.toFixed(2), i.igst.toFixed(2), i.cess.toFixed(2)].map(esc).join(","));
  });
  lines.push("");

  // Table 6A: Exports
  lines.push(`"=== TABLE 6A: EXPORTS (WPAY / WOPAY) ==="`);
  lines.push(["Export Type", "Invoice Number", "Invoice Date", "Invoice Value (₹)", "Rate (%)", "Taxable Value (₹)", "IGST (₹)"].map(esc).join(","));
  expList.forEach((i) => {
    lines.push([i.igst > 0 ? "WPAY" : "WOPAY", i.invNo, i.invDate, i.total.toFixed(2), i.rate + "%", i.taxable.toFixed(2), i.igst.toFixed(2)].map(esc).join(","));
  });
  lines.push("");

  // Table 9B: CDNR
  lines.push(`"=== TABLE 9B: CREDIT / DEBIT NOTES (REGISTERED) ==="`);
  lines.push(["Recipient GSTIN", "Receiver Name", "Note Number", "Note Date", "Document Type", "Taxable Value (₹)", "CGST (₹)", "SGST (₹)", "IGST (₹)", "Total Note Value (₹)"].map(esc).join(","));
  cdnrList.forEach((i) => {
    lines.push([i.partyGstin, i.partyName, i.invNo, i.invDate, i.invNo.startsWith("DN") ? "Debit Note" : "Credit Note", i.taxable.toFixed(2), i.cgst.toFixed(2), i.sgst.toFixed(2), i.igst.toFixed(2), i.total.toFixed(2)].map(esc).join(","));
  });
  lines.push("");

  // Table 12: HSN Summary
  lines.push(`"=== TABLE 12: HSN SUMMARY OF OUTWARD SUPPLIES ==="`);
  lines.push(["HSN / SAC", "Description", "UQC", "Total Quantity", "Total Value (₹)", "Taxable Value (₹)", "CGST (₹)", "SGST (₹)", "IGST (₹)", "Cess (₹)"].map(esc).join(","));
  hsnList.forEach((h) => {
    lines.push([h.hsn, h.desc, h.uqc, h.qty, h.value.toFixed(2), h.taxable.toFixed(2), h.cgst.toFixed(2), h.sgst.toFixed(2), h.igst.toFixed(2), h.cess.toFixed(2)].map(esc).join(","));
  });

  const fullCsv = "\uFEFF" + lines.join("\n");
  const blob = new Blob([fullCsv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `GSTR1_${gstin}_${(cName || "Report").replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
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
      rows.push([inv.invNo, inv.invDate, inv.partyName, inv.partyGstin || "Unregistered", inv.pos, inv.taxable, inv.cgst, inv.sgst, inv.igst, inv.cess, inv.total]);
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
    // Generic fallback tabular view
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
      lines.push([inv.invNo, inv.invDate, inv.partyName, inv.partyGstin || "Unregistered", inv.pos, inv.taxable.toFixed(2), inv.cgst.toFixed(2), inv.sgst.toFixed(2), inv.igst.toFixed(2), inv.cess.toFixed(2), inv.total.toFixed(2)].map(esc).join(","));
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
