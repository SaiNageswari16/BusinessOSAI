/**
 * Utility functions for exporting and printing professional offer letters in Word (.doc) and PDF formats
 * with customizable company logo, watermark, letterhead styling, and compensation matrices.
 */

export interface OfferLetterExportOptions {
  candidateName: string;
  candidateEmail?: string;
  role: string;
  department?: string;
  ctc: number;
  currencySymbol: string;
  salarySplit: {
    basicPct: number;
    hraPct: number;
    specialPct: number;
    pfPct: number;
    bonusAmount?: number;
  };
  joiningDate: string;
  expiryDate: string;
  probationMonths: number;
  noticeDays: number;
  signingAuthority: string;
  signingTitle: string;
  clauses: string;
  templateTitle?: string;
  // Letterhead & Branding
  orgName: string;
  orgAddress: string;
  orgEmail?: string;
  orgPhone?: string;
  orgGstin?: string;
  orgCin?: string;
  orgLogo?: string;
  letterheadStyle?: "corporate" | "modern" | "minimal" | "bordered";
  // Watermark
  watermarkEnabled?: boolean;
  watermarkText?: string;
  watermarkOpacity?: number; // 0.05 - 0.3
}

/**
 * Downloads a formatted Microsoft Word document (.doc) with letterhead, logo, watermark, and tables.
 */
export function downloadOfferLetterWordDoc(opts: OfferLetterExportOptions) {
  const {
    candidateName,
    candidateEmail,
    role,
    department,
    ctc,
    currencySymbol,
    salarySplit,
    joiningDate,
    expiryDate,
    probationMonths,
    noticeDays,
    signingAuthority,
    signingTitle,
    clauses,
    templateTitle = "Employment Offer & Agreement",
    orgName,
    orgAddress,
    orgEmail,
    orgPhone,
    orgGstin,
    orgCin,
    orgLogo,
    letterheadStyle = "corporate",
    watermarkEnabled = true,
    watermarkText = "CONFIDENTIAL",
    watermarkOpacity = 0.12,
  } = opts;

  const basic = (ctc * salarySplit.basicPct) / 100;
  const hra = (ctc * salarySplit.hraPct) / 100;
  const special = (ctc * salarySplit.specialPct) / 100;
  const pf = (ctc * salarySplit.pfPct) / 100;
  const monthlyGross = (ctc - pf) / 12;

  const formattedJoinDate = joiningDate ? new Date(joiningDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "[Joining Date]";
  const formattedExpiryDate = expiryDate ? new Date(expiryDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "[Expiry Date]";
  const refNumber = `BOS-OFFER-${Math.floor(100000 + Math.random() * 900000)}`;

  const docHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>Offer Letter - ${candidateName}</title>
      <style>
        @page {
          size: 8.5in 11.0in;
          margin: 1.0in 1.0in 1.0in 1.0in;
          mso-header-margin: 0.5in;
          mso-footer-margin: 0.5in;
        }
        body {
          font-family: 'Calibri', 'Arial', sans-serif;
          font-size: 11pt;
          line-height: 1.45;
          color: #1a1a1a;
          position: relative;
        }
        .header-table {
          width: 100%;
          border-bottom: 2pt solid #0f172a;
          padding-bottom: 12pt;
          margin-bottom: 16pt;
        }
        .company-title {
          font-size: 18pt;
          font-weight: bold;
          color: #0f172a;
          margin: 0;
        }
        .company-sub {
          font-size: 9pt;
          color: #64748b;
          margin: 2pt 0 0 0;
        }
        .badge {
          background-color: #0f172a;
          color: #ffffff;
          padding: 4pt 8pt;
          font-size: 9pt;
          font-weight: bold;
          text-align: right;
          border-radius: 3pt;
        }
        .meta-box {
          background-color: #f8fafc;
          border: 1pt solid #e2e8f0;
          padding: 10pt;
          margin-bottom: 14pt;
          border-radius: 4pt;
        }
        table.salary-table {
          width: 100%;
          border-collapse: collapse;
          margin: 12pt 0;
          font-size: 10pt;
        }
        table.salary-table th {
          background-color: #f1f5f9;
          border: 1pt solid #cbd5e1;
          padding: 6pt 8pt;
          text-align: left;
          font-weight: bold;
        }
        table.salary-table td {
          border: 1pt solid #e2e8f0;
          padding: 5pt 8pt;
        }
        .total-row {
          background-color: #e0f2fe;
          font-weight: bold;
        }
        .clause-box {
          background-color: #fcfcfc;
          border-left: 3pt solid #3b82f6;
          padding: 8pt 12pt;
          margin: 12pt 0;
          font-size: 9.5pt;
          line-height: 1.5;
        }
        .watermark {
          position: fixed;
          top: 35%;
          left: 15%;
          width: 70%;
          text-align: center;
          font-size: 52pt;
          font-weight: 900;
          color: rgba(148, 163, 184, ${watermarkOpacity});
          transform: rotate(-35deg);
          z-index: -1000;
          text-transform: uppercase;
          pointer-events: none;
        }
        .sig-table {
          width: 100%;
          margin-top: 30pt;
          border-top: 1pt solid #e2e8f0;
          padding-top: 10pt;
        }
      </style>
    </head>
    <body>
      ${watermarkEnabled ? `<div class="watermark">${watermarkText}</div>` : ""}

      <!-- Header Table -->
      <table class="header-table">
        <tr>
          <td style="vertical-align: middle;">
            ${orgLogo ? `<img src="${orgLogo}" style="max-height: 48pt; max-width: 150pt; margin-bottom: 4pt;" /><br>` : ""}
            <div class="company-title">${orgName}</div>
            <div class="company-sub">${orgAddress}</div>
            <div class="company-sub">Email: ${orgEmail || "hr@" + orgName.toLowerCase().replace(/[^a-z]/g, "") + ".com"} | Phone: ${orgPhone || "+91-800-555-0199"}${orgGstin ? ` | GSTIN: ${orgGstin}` : ""}</div>
          </td>
          <td style="text-align: right; vertical-align: top;">
            <span class="badge">OFFICIAL OFFER</span>
            <div style="font-size: 8.5pt; color: #64748b; margin-top: 4pt; font-family: monospace;">REF: ${refNumber}</div>
            <div style="font-size: 8.5pt; color: #64748b; margin-top: 2pt;">Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</div>
          </td>
        </tr>
      </table>

      <!-- Recipient Block -->
      <div class="meta-box">
        <table style="width: 100%; border: none;">
          <tr>
            <td>
              <span style="font-size: 8pt; font-weight: bold; color: #64748b; text-transform: uppercase;">APPOINTMENT OFFERED TO:</span><br>
              <strong style="font-size: 12pt; color: #0f172a;">${candidateName}</strong><br>
              <span style="color: #475569;">${candidateEmail || ""}</span>
            </td>
            <td style="text-align: right;">
              <span style="font-size: 8pt; font-weight: bold; color: #64748b; text-transform: uppercase;">POSITION & DESIGNATION:</span><br>
              <strong style="font-size: 11pt; color: #0f172a;">${role}</strong><br>
              <span style="color: #475569;">Target Joining: ${formattedJoinDate}</span>
            </td>
          </tr>
        </table>
      </div>

      <p>Dear <strong>${candidateName}</strong>,</p>

      <p>We are delighted to extend to you this formal offer of employment with <strong>${orgName}</strong> for the position of <strong>${role}</strong>${department ? ` in the <strong>${department}</strong> team` : ""}.</p>

      <p>Your performance, capabilities, and professional experience throughout our recruitment process demonstrated exceptional alignment with our core organizational values and forward growth objectives.</p>

      <h3 style="font-size: 12pt; color: #0f172a; border-bottom: 1pt solid #cbd5e1; padding-bottom: 3pt; margin-top: 16pt;">1. Compensation Structure (Annual & Monthly Breakup)</h3>
      <p style="font-size: 10pt; color: #475569;">Your Total Cost to Company (CTC) is agreed at <strong>${currencySymbol}${ctc.toLocaleString()}</strong> per annum, distributed as follows:</p>

      <table class="salary-table">
        <thead>
          <tr>
            <th>Salary Component</th>
            <th style="text-align: right;">Split %</th>
            <th style="text-align: right;">Monthly (${currencySymbol})</th>
            <th style="text-align: right;">Annual (${currencySymbol})</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Basic Salary</td>
            <td style="text-align: right;">${salarySplit.basicPct}%</td>
            <td style="text-align: right;">${currencySymbol}${Math.round(basic / 12).toLocaleString()}</td>
            <td style="text-align: right; font-weight: bold;">${currencySymbol}${Math.round(basic).toLocaleString()}</td>
          </tr>
          <tr>
            <td>House Rent Allowance (HRA)</td>
            <td style="text-align: right;">${salarySplit.hraPct}%</td>
            <td style="text-align: right;">${currencySymbol}${Math.round(hra / 12).toLocaleString()}</td>
            <td style="text-align: right; font-weight: bold;">${currencySymbol}${Math.round(hra).toLocaleString()}</td>
          </tr>
          <tr>
            <td>Special / Flexi Allowance</td>
            <td style="text-align: right;">${salarySplit.specialPct}%</td>
            <td style="text-align: right;">${currencySymbol}${Math.round(special / 12).toLocaleString()}</td>
            <td style="text-align: right; font-weight: bold;">${currencySymbol}${Math.round(special).toLocaleString()}</td>
          </tr>
          <tr>
            <td>Employer Provident Fund (PF) Contribution</td>
            <td style="text-align: right;">${salarySplit.pfPct}%</td>
            <td style="text-align: right;">${currencySymbol}${Math.round(pf / 12).toLocaleString()}</td>
            <td style="text-align: right; font-weight: bold;">${currencySymbol}${Math.round(pf).toLocaleString()}</td>
          </tr>
          <tr class="total-row">
            <td><strong>Total Gross Cost to Company (CTC)</strong></td>
            <td style="text-align: right;"><strong>100%</strong></td>
            <td style="text-align: right;"><strong>${currencySymbol}${Math.round(ctc / 12).toLocaleString()}</strong></td>
            <td style="text-align: right;"><strong>${currencySymbol}${Math.round(ctc).toLocaleString()}</strong></td>
          </tr>
        </tbody>
      </table>

      <div style="background-color: #f0fdf4; border: 1pt solid #bbf7d0; padding: 8pt; border-radius: 4pt; margin-bottom: 12pt; font-size: 9.5pt; color: #166534;">
        <strong>Net Estimated In-Hand Gross:</strong> ${currencySymbol}${Math.round(monthlyGross).toLocaleString()} / month (Subject to applicable professional tax & income tax withholding).
      </div>

      <h3 style="font-size: 12pt; color: #0f172a; border-bottom: 1pt solid #cbd5e1; padding-bottom: 3pt; margin-top: 14pt;">2. Employment Terms & Standard Covenants</h3>
      <div class="clause-box">
        <p><strong>Probation Period:</strong> ${probationMonths > 0 ? `${probationMonths} months from joining date.` : "No probation required (Direct Full Appointment)."}</p>
        <p><strong>Notice Period:</strong> ${noticeDays} days written notice or gross salary in lieu thereof.</p>
        <div style="margin-top: 6pt; white-space: pre-wrap;">${clauses}</div>
      </div>

      <h3 style="font-size: 12pt; color: #0f172a; border-bottom: 1pt solid #cbd5e1; padding-bottom: 3pt; margin-top: 14pt;">3. Acceptance & Expiry</h3>
      <p>This offer remains valid until <strong>${formattedExpiryDate}</strong>. Please sign and return a duplicate copy of this letter as confirmation of your acceptance.</p>

      <!-- Signature Section -->
      <table class="sig-table">
        <tr>
          <td style="vertical-align: top; width: 50%;">
            <div style="font-size: 9pt; color: #64748b; text-transform: uppercase;">Authorized Signatory:</div>
            <div style="margin-top: 25pt; border-bottom: 1pt solid #94a3b8; width: 80%;"></div>
            <strong style="font-size: 11pt; color: #0f172a; display: block; margin-top: 4pt;">${signingAuthority}</strong>
            <span style="font-size: 9pt; color: #64748b;">${signingTitle}</span><br>
            <span style="font-size: 9pt; color: #64748b;">${orgName}</span>
          </td>
          <td style="vertical-align: top; width: 50%; text-align: right;">
            <div style="font-size: 9pt; color: #64748b; text-transform: uppercase;">Candidate Acceptance Signature:</div>
            <div style="margin-top: 25pt; border-bottom: 1pt solid #94a3b8; width: 80%; margin-left: auto;"></div>
            <strong style="font-size: 11pt; color: #0f172a; display: block; margin-top: 4pt;">${candidateName}</strong>
            <span style="font-size: 9pt; color: #64748b;">Date of Acceptance: __________________</span>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob(["\ufeff" + docHtml], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = url;
  downloadLink.download = `Offer_Letter_${candidateName.replace(/[^a-zA-Z0-9]/g, "_")}.doc`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);
}
