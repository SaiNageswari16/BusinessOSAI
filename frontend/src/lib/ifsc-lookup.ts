/**
 * Razorpay IFSC Toolkit & RBI Bank Lookup Utility
 * Free public API powered by Razorpay IFSC toolkit (https://ifsc.razorpay.com).
 * Auto-resolves Bank Name, Branch, City, State, Address from IFSC Code.
 */

export interface IfscDetails {
  bank: string;
  ifsc: string;
  branch: string;
  address?: string;
  city?: string;
  district?: string;
  state?: string;
  contact?: string;
  micr?: string;
  upi?: boolean;
  rtgs?: boolean;
  neft?: boolean;
  imps?: boolean;
  bankCode?: string;
  raw?: any;
}

// Well-known Indian Bank 4-letter prefixes for instant fallback/preview
export const BANK_PREFIX_MAP: Record<string, string> = {
  HDFC: "HDFC Bank",
  SBIN: "State Bank of India",
  ICIC: "ICICI Bank",
  UTIB: "Axis Bank",
  KKBK: "Kotak Mahindra Bank",
  PUNB: "Punjab National Bank",
  BARB: "Bank of Baroda",
  CNRB: "Canara Bank",
  UBIN: "Union Bank of India",
  IDIB: "Indian Bank",
  IOBA: "Indian Overseas Bank",
  MAHB: "Bank of Maharashtra",
  BKID: "Bank of India",
  CBIN: "Central Bank of India",
  PSIB: "Punjab & Sind Bank",
  UCOB: "UCO Bank",
  IDFB: "IDFC FIRST Bank",
  INDB: "IndusInd Bank",
  YESB: "Yes Bank",
  FDRL: "Federal Bank",
  SIBL: "South Indian Bank",
  KVBL: "Karur Vysya Bank",
  CSBK: "CSB Bank",
  CIUB: "City Union Bank",
  DCBL: "DCB Bank",
  RBLN: "RBL Bank",
  KARB: "Karnataka Bank",
  TMBL: "Tamilnad Mercantile Bank",
  BDBL: "Bandhan Bank",
  ESFB: "Equitas Small Finance Bank",
  AUBL: "AU Small Finance Bank",
  AIRP: "Airtel Payments Bank",
  PYTM: "Paytm Payments Bank",
  IPOS: "India Post Payments Bank",
};

/**
 * Format raw bank string (e.g. "HDFC BANK" -> "HDFC Bank", "STATE BANK OF INDIA" -> "State Bank of India")
 */
function formatBankName(raw: string, code: string): string {
  if (!raw) return BANK_PREFIX_MAP[code] || "";
  const prefix = code.slice(0, 4).toUpperCase();
  if (BANK_PREFIX_MAP[prefix]) return BANK_PREFIX_MAP[prefix];

  // Capitalize words nicely
  return raw
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length <= 3 && !["and", "for", "the", "of"].includes(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/**
 * Look up official bank and branch details by IFSC code via Razorpay free IFSC API.
 */
export async function lookupIfsc(ifscCode: string, signal?: AbortSignal): Promise<IfscDetails | null> {
  const clean = ifscCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length !== 11) {
    return null;
  }

  const prefix = clean.slice(0, 4);

  try {
    const res = await fetch(`https://ifsc.razorpay.com/${clean}`, {
      method: "GET",
      signal,
    });

    if (res.ok) {
      const data = await res.json();
      if (data && (data.BANK || data.bank)) {
        const rawBank = data.BANK || data.bank || "";
        const branch = data.BRANCH || data.branch || "";
        return {
          bank: formatBankName(rawBank, prefix),
          ifsc: data.IFSC || clean,
          branch: branch.trim(),
          address: data.ADDRESS || data.address || "",
          city: data.CITY || data.city || "",
          district: data.DISTRICT || data.district || "",
          state: data.STATE || data.state || "",
          contact: data.CONTACT || data.contact || "",
          micr: data.MICR || data.micr || "",
          upi: Boolean(data.UPI ?? data.upi),
          rtgs: Boolean(data.RTGS ?? data.rtgs),
          neft: Boolean(data.NEFT ?? data.neft),
          imps: Boolean(data.IMPS ?? data.imps),
          bankCode: data.BANKCODE || prefix,
          raw: data,
        };
      }
    }
  } catch (err: any) {
    if (err.name === "AbortError") return null;
    console.warn("[IFSC Lookup] Remote fetch error, checking prefix fallback:", err);
  }

  // Fallback to recognized prefix if API lookup failed
  if (BANK_PREFIX_MAP[prefix]) {
    return {
      bank: BANK_PREFIX_MAP[prefix],
      ifsc: clean,
      branch: "",
      bankCode: prefix,
    };
  }

  return null;
}

