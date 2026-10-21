/**
 * Enterprise Thermal Receipt Template Service.
 *
 * Implements Petpooja & MyBillBook standard thermal ESC/POS receipts (80mm & 58mm).
 * Fully customizable per Organization / Tenant and persisted as the active print format.
 */

export interface ReceiptTemplate {
  // Identity & Header
  orgName: string;
  tagline: string;
  branchName: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  fssai: string;

  // Print Format
  paperWidth: "80mm" | "58mm";
  fontSize: "compact" | "normal" | "large";
  showLogo: boolean;
  logoUrl?: string;

  // Header & Info Toggles
  showHeaderGreeting: boolean;
  headerGreetingText: string;
  showCustomerInfo: boolean;
  showCustomerGstin: boolean;
  showLoyaltyPoints: boolean;
  loyaltyEarnRatePct: number; // e.g. 5 = 5% of subtotal earned as points

  // Service & Staff Toggles
  showTable: boolean;
  showWaiter: boolean;
  showCashier: boolean;
  showTokenNo: boolean;
  showItemCodes: boolean;
  showItemNotes: boolean;

  // Financial Breakdown
  showTaxBreakup: boolean; // Explicit CGST (2.5%) + SGST (2.5%) rows
  showServiceCharge: boolean;
  showRoundOff: boolean;
  showPaymentMode: boolean;

  // QR Code & Footer
  showQrCode: boolean;
  qrType: "upi" | "feedback" | "none";
  upiId: string;
  footerMessage: string;
  feedbackUrl?: string;
  wifiDetails?: string;
  termsNotice?: string;
}

export const DEFAULT_RECEIPT_TEMPLATE: ReceiptTemplate = {
  orgName: "Spice9 Restaurant & Dining",
  tagline: "Finest Biryani & Coastal Specialties",
  branchName: "Banjara Hills Flagship",
  address: "Road No. 12, Banjara Hills, Hyderabad, Telangana 500034",
  phone: "+91 98765 43210",
  email: "dine@spice9restaurant.com",
  gstin: "36AABCU9603R1ZM",
  fssai: "13622011000452",

  paperWidth: "80mm",
  fontSize: "normal",
  showLogo: false,

  showHeaderGreeting: true,
  headerGreetingText: "ORIGINAL TAX INVOICE",
  showCustomerInfo: true,
  showCustomerGstin: true,
  showLoyaltyPoints: true,
  loyaltyEarnRatePct: 5,

  showTable: true,
  showWaiter: true,
  showCashier: true,
  showTokenNo: true,
  showItemCodes: false,
  showItemNotes: true,

  showTaxBreakup: true,
  showServiceCharge: true,
  showRoundOff: true,
  showPaymentMode: true,

  showQrCode: true,
  qrType: "upi",
  upiId: "spice9@icici",
  footerMessage: "Thank you for dining with us! Visit again.",
  feedbackUrl: "https://g.page/r/spice9/review",
  wifiDetails: "Guest WiFi: Spice9_Free | Pass: spice9dining",
  termsNotice: "Prices are inclusive of applicable taxes. Computer generated invoice.",
};

const STORAGE_KEY_PREFIX = "ros_receipt_template_";

export const receiptTemplateService = {
  getActiveTemplate(orgSlug = "spice9"): ReceiptTemplate {
    if (typeof localStorage === "undefined") return DEFAULT_RECEIPT_TEMPLATE;
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${orgSlug.toLowerCase()}`);
      if (stored) {
        return { ...DEFAULT_RECEIPT_TEMPLATE, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn("Failed to read receipt template from storage:", e);
    }
    return DEFAULT_RECEIPT_TEMPLATE;
  },

  saveActiveTemplate(template: ReceiptTemplate, orgSlug = "spice9"): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(
        `${STORAGE_KEY_PREFIX}${orgSlug.toLowerCase()}`,
        JSON.stringify(template)
      );
    } catch (e) {
      console.error("Failed to save receipt template:", e);
    }
  },
};
