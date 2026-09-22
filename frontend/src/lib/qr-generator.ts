import QRCode from "qrcode";

export interface UpiPayOptions {
  vpa: string;
  payeeName?: string;
  amount?: number | string;
  invoiceNumber?: string;
  transactionNote?: string;
}

/**
 * Builds an authentic, NPCI-compliant UPI Intent URI string.
 * Sanitizes VPA, payee name, amount, and note to ensure all UPI apps
 * (Google Pay, PhonePe, Paytm, BHIM, Navi, Cred) can parse and resolve payee details instantly.
 */
export function buildUpiPayUrl({
  vpa,
  payeeName,
  amount,
  invoiceNumber,
  transactionNote,
}: UpiPayOptions): string {
  if (!vpa) return "";

  // 1. Sanitize VPA (trim, remove all spaces/special whitespace)
  let cleanVpa = vpa.trim().replace(/\s+/g, "");

  // Auto-correct common typo: number 1 instead of letter l in @ybl
  if (/@yb1$/i.test(cleanVpa)) {
    cleanVpa = cleanVpa.replace(/@yb1$/i, "@ybl");
  }

  // If VPA doesn't contain '@' or is empty, return empty
  if (!cleanVpa || !cleanVpa.includes("@")) {
    return "";
  }

  // 2. Sanitize Payee Name: Only alphanumeric and spaces, max 50 chars
  let cleanName = (payeeName || "Merchant")
    .trim()
    .replace(/[^a-zA-Z0-9\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);
  if (!cleanName) cleanName = "Merchant";

  // 3. Sanitize Transaction Note: Never include '#', '&', '?' or special characters that corrupt URI params
  let note = transactionNote || (invoiceNumber ? `Invoice ${invoiceNumber}` : "Bill Payment");
  let cleanNote = note
    .replace(/[^a-zA-Z0-9\s-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);

  // 4. Amount parsing (omit if zero to allow manual entry in UPI app, format with 2 decimals if positive)
  const numAmount = typeof amount === "string" ? parseFloat(amount) : Number(amount || 0);

  // 5. Construct URI parameters
  const encodedName = encodeURIComponent(cleanName);
  let upiUri = `upi://pay?pa=${cleanVpa}&pn=${encodedName}`;

  if (numAmount > 0 && !isNaN(numAmount)) {
    upiUri += `&am=${numAmount.toFixed(2)}`;
  }

  if (cleanNote) {
    upiUri += `&tn=${encodeURIComponent(cleanNote)}`;
  }

  upiUri += `&cu=INR`;

  return upiUri;
}

/**
 * Generates an authentic, standards-compliant ISO/IEC 18004 QR Code SVG data URI.
 * Uses exact 1x1 integer grid coordinates to guarantee crisp rendering without subpixel blurring
 * on thermal receipt printers, A4 invoices, and mobile screens.
 */
export function generateQRCodeSVG(text: string, displaySize = 220): string {
  if (!text) return "";
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
    const matrix = qr.modules;
    const matrixSize = matrix.size;
    const margin = 4; // ISO-18004 standard 4-module quiet zone
    const totalSize = matrixSize + margin * 2;

    let path = "";
    for (let r = 0; r < matrixSize; r++) {
      for (let c = 0; c < matrixSize; c++) {
        if (matrix.get(r, c)) {
          path += `M${c + margin},${r + margin}h1v1h-1z `;
        }
      }
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${displaySize}" height="${displaySize}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#ffffff"/><path d="${path}" fill="#000000"/></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  } catch (err) {
    console.error("Failed to generate QR Code SVG:", err);
    return "";
  }
}

/**
 * Generates an authentic ISO-18004 QR Code PNG / Canvas Data URL.
 */
export async function generateQRCodeDataURL(text: string, size = 250): Promise<string> {
  if (!text) return "";
  try {
    return await QRCode.toDataURL(text, {
      margin: 4,
      width: size,
      errorCorrectionLevel: "M",
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });
  } catch (err) {
    console.error("Failed to generate QR Data URL:", err);
    return generateQRCodeSVG(text, size);
  }
}
