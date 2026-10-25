import React, { useState, useEffect } from "react";
import { useI18n } from "@/contexts/i18n-context";
import {
  Receipt,
  Plus,
  Search,
  Printer,
  FileText,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  Filter,
  RefreshCw,
  Download,
  User,
  Award,
  Calendar,
  CreditCard,
  Building,
  Sparkles,
  X,
  MessageCircle,
  Truck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Pencil,
  XCircle,
  RotateCcw,
  ShieldAlert,
  ChevronDown,
  MoreHorizontal,
  MoreVertical,
  Banknote,
  MapPin,
  Copy,
  Files,
  Mail,
  Send,
  Smartphone,
  Package,
  ShoppingBag,
  UserPlus,
  Wallet,
  Trash2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { posApi, invoicesApi, salesReturnsApi, marketplaceApi, crmQuotationsApi, resolveImageUrl } from "@/lib/api-client";
import { getActiveBillingGst, getOrgPaymentQrSettings, getActiveReceiptTemplate } from "@/lib/receipt-template-store";
import { generateQRCodeSVG, buildUpiPayUrl } from "@/lib/qr-generator";
import { printThermalReceiptInvoice, generateThermalReceiptHtml, thermalReceiptHtmlToPdfBase64 } from "@/lib/print-helper";
import { loadStoredInvoiceSettings, saveStoredInvoiceSettings } from "./InvoiceQuickSettingsModal";
import { FullInvoicePrinter, InvoiceErrorBoundary } from "./FullInvoicePrinter";
import { ThermalReceiptPreviewModal } from "./ThermalReceiptPreviewModal";
import { useWhatsAppStatus } from "@/hooks/use-whatsapp-status";
import { EWayBillModal } from "./EWayBillModal";
import { StandardVoucherModal, StandardVoucherData } from "./StandardVoucherModal";
import { PaginationControl } from "@/components/ui/PaginationControl";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { useAuth } from "@/contexts/auth-context";
import { useRbac } from "@/contexts/rbac-context";
import { useNavigate } from "@tanstack/react-router";
import { formatDisplayDate, formatDisplayDateTime, getTodayDateString, parseSafeDateTimestamp, formatSafeTime } from "@/lib/utils";

interface LocalInvoiceRecord {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_phone?: string;
  customer_gstin?: string;
  sales_executive?: string;
  sales_points_earned?: number;
  invoice_date: string;
  due_date?: string;
  payment_mode: string;
  payment_status: "Paid" | "Partial" | "Unpaid" | "Cancelled" | "Returned" | "Partially Returned" | "Exchanged" | any;
  status?: string;
  cancellation_reason?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  return_info?: any;
  subtotal: number;
  total_tax: number;
  discount_amount?: number;
  grand_total: number;
  amount_received?: number;
  is_printed_thermal?: boolean;
  is_printed_a4?: boolean;
  is_whatsapp_sent?: boolean;
  invoice_type?: string;
  is_credit_note?: boolean;
  display_number?: string;
  secondary_number?: string;
  receipt_number?: string;
  is_thermal?: boolean;
  print_mode?: "thermal" | "a4";
  payments?: any[];
  items?: any[];
  [key: string]: any;
}

export const isThermalDocument = (inv: any): boolean => {
  if (!inv) return false;
  const num = String(inv.invoice_number || inv.receipt_number || inv.display_number || "").toUpperCase().trim();
  const ref = String(inv.reference_number || "").toUpperCase().trim();

  // Standard A4 Invoice prefixes: INV, TAX, SI, BILL, OPN, CN, DN, QT, PI, EST -> always Standard A4 Invoices
  if (
    num.startsWith("INV-") ||
    num.startsWith("INV") ||
    num.startsWith("TAX-") ||
    num.startsWith("SI-") ||
    num.startsWith("BILL-") ||
    num.startsWith("OPN-") ||
    num.startsWith("CN-") ||
    num.startsWith("DN-") ||
    num.startsWith("QT-") ||
    num.startsWith("PI-") ||
    num.startsWith("EST-")
  ) {
    return false;
  }

  // POS Counter Receipts start with REC-, RCPT-, POS-
  if (num.startsWith("REC-") || num.startsWith("RCPT-") || num.startsWith("POS-") || ref.startsWith("REC-")) {
    return true;
  }

  // Explicit thermal template configuration (only if not an INV- or standard invoice series)
  const tpl = String(inv.print_template_id || inv.template_id || inv.receipt_format || "").toLowerCase().trim();
  if (tpl === "thermal" || tpl.startsWith("tpl-thm-")) {
    return true;
  }

  return false;
};

export function PosInvoicesHistory() {
  const { t } = useI18n();
  const { currency, formatCurrency } = useCurrency();
  const { tenant, companiesList = [] } = useTenant();
  const currentTenantId = (tenant as any)?.raw?.tenant_id || (tenant as any)?.tenant_id || tenant?.id || "default";
  const currentCompanyId = tenant?.id || (tenant as any)?.raw?.id || (tenant as any)?.company_id || "default";
  const storageKey = `pos_saved_invoices_${currentTenantId}_${currentCompanyId}`;

  const { user } = useAuth();
  const defaultRepName = user?.name || (user as any)?.fullName || (user?.email ? user.email.split('@')[0] : "Sales Executive");
  const { activeRole } = useRbac();
  const isOrgAdmin = Boolean(
    user?.isTenantOwner ||
    user?.isPlatformAdmin ||
    user?.roles?.some(r => (r.name || "").toLowerCase().includes("admin") || (r.name || "").toLowerCase().includes("owner")) ||
    (activeRole?.name || "").toLowerCase().includes("admin") ||
    (activeRole?.name || "").toLowerCase().includes("owner")
  );

  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<LocalInvoiceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [paymentModeFilter, setPaymentModeFilter] = useState<string>("All");
  const [printFilter, setPrintFilter] = useState<string>("All");
  const [locationFilter, setLocationFilter] = useState<string>("All");
  const [dateFilter, setDateFilter] = useState<string>("All");
  const [salesRepFilter, setSalesRepFilter] = useState<string>("All");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [docTypeFilter, setDocTypeFilter] = useState<string>("All");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "amount_desc" | "amount_asc">("newest");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Reset pagination to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, docTypeFilter, statusFilter, paymentModeFilter, printFilter, locationFilter, salesRepFilter, dateFilter, customStartDate, customEndDate, sortOrder]);

  const handleCollectInSalesInvoice = (inv: LocalInvoiceRecord) => {
    try {
      sessionStorage.setItem("pos_collect_invoice", JSON.stringify(inv));
      window.dispatchEvent(new Event("pos_collect_invoice_trigger"));
    } catch (e) { }
    navigate({ to: "/pos", search: { tab: "sales", collect_id: inv.id } as any });
  };

  const handleEditInvoice = (inv: LocalInvoiceRecord) => {
    if (inv.payment_status === "Cancelled" || inv.status === "cancelled") {
      toast.error("Cancelled invoices cannot be edited.");
      return;
    }
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      sessionStorage.setItem("pos_edit_invoice", JSON.stringify({ ...inv, invoice_date: todayStr }));
      window.dispatchEvent(new Event("pos_edit_invoice_trigger"));
    } catch (e) {
      console.warn("Could not set pos_edit_invoice:", e);
    }
    navigate({ to: "/pos", search: { tab: "sales", edit_id: inv.id || inv.invoice_number } as any });
  };

  // Cancellation State
  const [cancellingInvoice, setCancellingInvoice] = useState<LocalInvoiceRecord | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [cancellationReason, setCancellationReason] = useState<string>("");
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  // Permanent Delete State
  const [deleteTarget, setDeleteTarget] = useState<LocalInvoiceRecord | null>(null);
  const [isDeletingInvoice, setIsDeletingInvoice] = useState<boolean>(false);

  const handleDeleteInvoice = async () => {
    if (!deleteTarget) return;
    setIsDeletingInvoice(true);
    try {
      if (deleteTarget.id) {
        await invoicesApi.deleteInvoice(deleteTarget.id);
      }
      // Clear the local-storage copy too so the list updates immediately
      try {
        const tid = (tenant as any)?.raw?.tenant_id || tenant?.id || "default";
        const cid = (tenant as any)?.raw?.company_id || "default";
        const keys = [`pos_saved_invoices_${tid}_${cid}`, `pos_saved_invoices_${tid}`, "pos_saved_invoices"];
        keys.forEach((k) => {
          const raw = localStorage.getItem(k);
          if (!raw) return;
          const list = JSON.parse(raw);
          const filtered = list.filter((r: any) => !(r.id === deleteTarget.id || r.invoice_number === deleteTarget.invoice_number));
          localStorage.setItem(k, JSON.stringify(filtered));
        });
      } catch {}
      toast.success(`Invoice ${deleteTarget.invoice_number} deleted permanently.`);
      setDeleteTarget(null);
      loadInvoices();
    } catch (err: any) {
      toast.error(err?.detail || err?.message || "Failed to delete invoice");
    } finally {
      setIsDeletingInvoice(false);
    }
  };

  // Standard Voucher Modal State (for Cancellation & Return Vouchers)
  const [activeVoucher, setActiveVoucher] = useState<StandardVoucherData | null>(null);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState<boolean>(false);

  const handleOpenCancellationVoucher = (inv: LocalInvoiceRecord) => {
    setActiveVoucher({
      voucherType: "cancellation",
      voucherNumber: `CNCL-${inv.invoice_number}`,
      voucherDate: inv.cancelled_at ? inv.cancelled_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
      originalInvoiceNo: inv.invoice_number,
      originalInvoiceDate: inv.invoice_date,
      organization: {
        name: tenant?.name || (tenant as any)?.raw?.name || "Business Enterprise",
        address: (tenant as any)?.raw?.address || (tenant as any)?.address || "Store Main Counter • Retail POS",
        city: (tenant as any)?.raw?.city || (tenant as any)?.city,
        state: (tenant as any)?.raw?.state || (tenant as any)?.state,
        pincode: (tenant as any)?.raw?.pincode || (tenant as any)?.pincode,
        gstin: (tenant as any)?.raw?.gst_number || (tenant as any)?.raw?.gstin || (tenant as any)?.gstin,
        phone: (tenant as any)?.raw?.phone || (tenant as any)?.phone,
        email: (tenant as any)?.raw?.email || (tenant as any)?.email,
      },
      customer: {
        name: inv.customer_name || "Walk-in Guest",
        phone: inv.customer_phone,
        gstin: inv.customer_gstin,
        address: inv.customer_billing_address,
      },
      items: (inv.items || []).map((it: any) => ({
        product_name: it.product_name || it.name || "Item",
        sku: it.sku,
        hsn_code: it.hsn_code,
        quantity: Number(it.quantity || 1),
        unit_price: Number(it.unit_price || 0),
        tax_rate: Number(it.tax_rate || 0),
        line_total: Number(it.line_total || Number(it.quantity || 1) * Number(it.unit_price || 0)),
        reason: inv.cancellation_reason || "Invoice Cancelled",
        disposition: "restock",
      })),
      subtotal: inv.subtotal,
      taxAmount: inv.total_tax,
      totalAmount: inv.grand_total,
      settlementMethod: inv.payment_mode || "cash",
      reason: inv.cancellation_reason || "Administrative cancellation",
      notes: "Invoice officially cancelled. Products verified and added back to warehouse stock.",
      cashierName: inv.sales_executive || defaultRepName,
    });
    setIsVoucherModalOpen(true);
  };

  const handleOpenReturnVoucher = (inv: LocalInvoiceRecord) => {
    const retInfo = (inv as any).return_info;
    setActiveVoucher({
      voucherType: "return",
      voucherNumber: retInfo?.return_number || `SR-${inv.invoice_number}`,
      voucherDate: retInfo?.return_date || new Date().toISOString().slice(0, 10),
      originalInvoiceNo: inv.invoice_number,
      originalInvoiceDate: inv.invoice_date,
      organization: {
        name: tenant?.name || (tenant as any)?.raw?.name || "Business Enterprise",
        address: (tenant as any)?.raw?.address || (tenant as any)?.address || "Store Main Counter • Retail POS",
        city: (tenant as any)?.raw?.city || (tenant as any)?.city,
        state: (tenant as any)?.raw?.state || (tenant as any)?.state,
        pincode: (tenant as any)?.raw?.pincode || (tenant as any)?.pincode,
        gstin: (tenant as any)?.raw?.gst_number || (tenant as any)?.raw?.gstin || (tenant as any)?.gstin,
        phone: (tenant as any)?.raw?.phone || (tenant as any)?.phone,
        email: (tenant as any)?.raw?.email || (tenant as any)?.email,
      },
      customer: {
        name: inv.customer_name || "Walk-in Guest",
        phone: inv.customer_phone,
        gstin: inv.customer_gstin,
      },
      items: (retInfo?.items || inv.items || []).map((it: any) => ({
        product_name: it.product_name || it.name || "Item",
        sku: it.sku,
        hsn_code: it.hsn_code,
        quantity: Number(it.returned_qty || it.quantity || 1),
        unit_price: Number(it.unit_price || 0),
        tax_rate: Number(it.tax_rate || 0),
        line_total: Number(it.total_amount || it.line_total || 0),
        reason: it.reason || "Customer Return",
        disposition: "restock",
      })),
      subtotal: retInfo?.subtotal || inv.subtotal,
      taxAmount: retInfo?.tax_amount || inv.total_tax,
      totalAmount: retInfo?.total_refund || inv.grand_total,
      settlementMethod: retInfo?.settlement_method || inv.payment_mode || "cash",
      creditNoteNumber: retInfo?.credit_note_number,
      reason: retInfo?.notes || "Sales return processed",
      cashierName: inv.sales_executive || defaultRepName,
    });
    setIsVoucherModalOpen(true);
  };

  const handleRequestCancelInvoice = (inv: LocalInvoiceRecord) => {
    if (!isOrgAdmin) {
      toast.error("Permission Denied: Only Organization Admins can cancel invoices.");
      return;
    }
    if (inv.payment_status === "Cancelled" || inv.status === "cancelled") {
      toast.error("This invoice has already been cancelled.");
      return;
    }
    setCancellingInvoice(inv);
    setCancellationReason("");
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancellation = async (reopenInSales: boolean = false) => {
    if (!cancellingInvoice) return;
    if (!isOrgAdmin) {
      toast.error("Permission Denied: Only Organization Admins can cancel invoices.");
      return;
    }

    setIsCancelling(true);
    try {
      // 1. Call Backend Cancel API (errors propagate to catch block below)
      const cancelResult = await invoicesApi.cancelInvoice(cancellingInvoice.id || cancellingInvoice.invoice_number, cancellationReason);
      console.log("Backend invoice cancellation result:", cancelResult);

      // 2. Update Local Invoice History in localStorage & in-memory state
      try {
        const stored = localStorage.getItem(storageKey);
        let list = stored ? JSON.parse(stored) : [];
        list = list.map((item: LocalInvoiceRecord) => {
          if (item.id === cancellingInvoice.id || item.invoice_number === cancellingInvoice.invoice_number) {
            return {
              ...item,
              status: "cancelled",
              payment_status: "Cancelled" as any,
              cancellation_reason: cancellationReason || "Cancelled by Admin",
              cancelled_at: new Date().toISOString(),
              cancelled_by: user?.name || "Organization Admin",
            };
          }
          return item;
        });
        localStorage.setItem(storageKey, JSON.stringify(list));
      } catch (e) {}

      // Update in-memory invoices state
      setInvoices((prev) =>
        prev.map((item) => {
          if (item.id === cancellingInvoice.id || item.invoice_number === cancellingInvoice.invoice_number) {
            return {
              ...item,
              status: "cancelled",
              payment_status: "Cancelled" as any,
              cancellation_reason: cancellationReason || "Cancelled by Admin",
              cancelled_at: new Date().toISOString(),
              cancelled_by: user?.name || "Organization Admin",
            };
          }
          return item;
        })
      );
      void loadInvoices();

      // 3. Re-credit Product Stock in localStorage product cache
      try {
        const prodStorageKey = `pos_local_products_${currentTenantId}_${currentCompanyId}`;
        const prodRaw = localStorage.getItem(prodStorageKey);
        if (prodRaw) {
          let prods = JSON.parse(prodRaw);
          if (Array.isArray(prods) && Array.isArray(cancellingInvoice.items)) {
            cancellingInvoice.items.forEach((line: any) => {
              const qty = Number(line.quantity) || 1;
              const match = prods.find((p: any) => 
                (line.product_id && p.id === line.product_id) ||
                (line.sku && p.sku === line.sku) ||
                (line.product_name && p.name && p.name.toLowerCase() === line.product_name.toLowerCase())
              );
              if (match) {
                match.stock = (Number(match.stock) || 0) + qty;
                match.initial_stock = (Number(match.initial_stock) || 0) + qty;
              }
            });
            localStorage.setItem(prodStorageKey, JSON.stringify(prods));
          }
        }
      } catch (err) {
        console.warn("Local stock reversal error:", err);
      }

      // Broadcast update events across all tabs
      window.dispatchEvent(new Event("pos_invoices_updated"));
      window.dispatchEvent(new Event("pos_products_updated"));
      window.dispatchEvent(new Event("inventory_updated"));

      toast.success(`Invoice ${cancellingInvoice.invoice_number} cancelled and items returned to stock.`);

      setIsCancelModalOpen(false);
      const invNum = cancellingInvoice.invoice_number;
      const cancelledCopy = {
        ...cancellingInvoice,
        status: "cancelled",
        payment_status: "Cancelled" as any,
        cancellation_reason: cancellationReason || "Cancelled by Admin",
        cancelled_at: new Date().toISOString(),
      };
      setCancellingInvoice(null);

      // Open official Cancellation Voucher for printing & verification
      handleOpenCancellationVoucher(cancelledCopy);

      // Adjust local invoice settings sequence number if cancelled was the highest active number
      try {
        const s = loadStoredInvoiceSettings();
        if (s && s.sequenceNumber) {
          const digits = (cancellingInvoice.invoice_number || "").match(/\d+/g);
          const lastNum = digits ? parseInt(digits[digits.length - 1], 10) : 0;
          if (lastNum > 0 && s.sequenceNumber === lastNum + 1) {
            saveStoredInvoiceSettings({
              ...s,
              sequenceNumber: lastNum,
            });
          }
        }
      } catch (e) {}

      if (reopenInSales) {
        // Prepare Sales Invoice to be recreated with the exact cancelled invoice number
        const todayStr = new Date().toISOString().slice(0, 10);
        sessionStorage.setItem("pos_recreate_invoice_number", invNum);
        sessionStorage.setItem("pos_recreate_invoice", JSON.stringify({ ...cancellingInvoice, invoice_date: todayStr, is_recreating: true }));
        window.dispatchEvent(new Event("pos_edit_invoice_trigger"));
        navigate({ to: "/pos", search: { tab: "sales", recreate_number: invNum } as any });
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to cancel invoice.");
    } finally {
      setIsCancelling(false);
    }
  };

  // Selected Invoice for Detailed View Drawer & PDF Printer
  const [selectedInvoice, setSelectedInvoice] = useState<LocalInvoiceRecord | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState<boolean>(false);
  const [fullInvoiceModalData, setFullInvoiceModalData] = useState<any>(null);
  const [isFullInvoiceOpen, setIsFullInvoiceOpen] = useState<boolean>(false);
  const [autoPrintFullInvoice, setAutoPrintFullInvoice] = useState<boolean>(false);
  const [thermalReceiptModalData, setThermalReceiptModalData] = useState<any | null>(null);
  const [isThermalReceiptOpen, setIsThermalReceiptOpen] = useState<boolean>(false);
  const [ewayBillModalData, setEwayBillModalData] = useState<any | null>(null);
  const [isEwayBillOpen, setIsEwayBillOpen] = useState<boolean>(false);

  // Settlement Modal State
  const [isSettleModalOpen, setIsSettleModalOpen] = useState<boolean>(false);
  const [settlingInvoice, setSettlingInvoice] = useState<LocalInvoiceRecord | null>(null);
  const [settlePaymentMode, setSettlePaymentMode] = useState<string>("Cash");
  const [settleAmount, setSettleAmount] = useState<number | "">("");
  const [isSubmittingSettle, setIsSubmittingSettle] = useState<boolean>(false);

  // WhatsApp Dialog State
  const [whatsappInvoice, setWhatsappInvoice] = useState<LocalInvoiceRecord | null>(null);
  const [whatsappPhoneInput, setWhatsappPhoneInput] = useState<string>("");
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState<boolean>(false);
  const { isOnline: isWhatsAppOnline, sessionId: activeWhatsAppNumber } = useWhatsAppStatus();

  // Email Dialog State
  const [emailInvoice, setEmailInvoice] = useState<LocalInvoiceRecord | null>(null);
  const [emailAddressInput, setEmailAddressInput] = useState<string>("");
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);

  const handleOpenSettleModal = (inv: LocalInvoiceRecord) => {
    setSettlingInvoice(inv);
    const totalGrand = Number(inv.grand_total || 0);
    const currentReceived = Number(inv.amount_received || 0);
    const due = Math.max(0, totalGrand - currentReceived);
    setSettleAmount(due > 0 ? due : totalGrand);
    setSettlePaymentMode("Cash");
    setIsSettleModalOpen(true);
  };

  const handleConfirmSettlement = async () => {
    if (!settlingInvoice) return;
    const amountToCollect = Number(settleAmount);
    if (!amountToCollect || amountToCollect <= 0) {
      toast.error("Please enter a valid payment amount greater than 0");
      return;
    }

    const currentReceived = Number(settlingInvoice.amount_received || 0);
    const totalGrand = Number(settlingInvoice.grand_total || 0);

    setIsSubmittingSettle(true);
    try {
      if (settlingInvoice.realId || (typeof settlingInvoice.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(settlingInvoice.id))) {
        const invId = settlingInvoice.realId || settlingInvoice.id;
        await invoicesApi.recordPayment(invId, {
          amount: amountToCollect,
          payment_date: new Date().toISOString().split("T")[0],
          payment_method: settlePaymentMode,
        });
      }

      const updatedReceived = currentReceived + amountToCollect;
      const newStatus: "Paid" | "Partial" | "Unpaid" = updatedReceived >= totalGrand - 0.01 ? "Paid" : "Partial";

      const updatedInvoices = invoices.map((inv) => {
        if (inv.id === settlingInvoice.id || (inv.invoice_number && inv.invoice_number === settlingInvoice.invoice_number)) {
          return {
            ...inv,
            amount_received: updatedReceived,
            payment_status: newStatus,
            amount_paid: updatedReceived,
            balance_due: Math.max(0, totalGrand - updatedReceived),
          };
        }
        return inv;
      });

      setInvoices(updatedInvoices);
      try {
        localStorage.setItem(storageKey, JSON.stringify(updatedInvoices));
        window.dispatchEvent(new Event("pos_invoices_updated"));
      } catch (e) {}

      toast.success(`Recorded ${formatCurrency(amountToCollect)} payment for ${settlingInvoice.invoice_number || "invoice"}!`);
      setIsSettleModalOpen(false);
      setSettlingInvoice(null);
      await loadInvoices();
    } catch (err: any) {
      toast.error(err.message || "Failed to record payment settlement");
    } finally {
      setIsSubmittingSettle(false);
    }
  };

  // Load invoices from Backend API (ERP Invoices + POS Transactions) strictly scoped to active tenant & workspace
  const loadInvoices = async () => {
    setLoading(true);
    const localRecords: LocalInvoiceRecord[] = [];
    const remoteRecords: LocalInvoiceRecord[] = [];

    try {
      // 1. Gather all local storage invoices across relevant scoped keys
      const scannedLocalMap = new Map<string, any>();
      try {
        const keysToScan = new Set<string>();
        if (storageKey) keysToScan.add(storageKey);
        if (currentTenantId) {
          if (currentCompanyId && currentCompanyId !== "default") {
            keysToScan.add(`pos_saved_invoices_${currentTenantId}_${currentCompanyId}`);
          } else {
            keysToScan.add(`pos_saved_invoices_${currentTenantId}`);
          }
        }

        keysToScan.forEach((key) => {
          try {
            const raw = localStorage.getItem(key);
            if (raw) {
              const list = JSON.parse(raw);
                list.forEach((inv: any) => {
                  if (inv && (inv.id || inv.invoice_number)) {
                    const numStr = String(inv.invoice_number || inv.id || "").toUpperCase().trim();
                    if (numStr.startsWith("OPN-")) return;
                    const idKey = String(inv.invoice_number || inv.id).toLowerCase().trim();
                    if (!scannedLocalMap.has(idKey)) {
                      scannedLocalMap.set(idKey, inv);
                      localRecords.push(inv);
                    }
                  }
                });
            }
          } catch (e) {}
        });
      } catch (e) {}

      // Check sales returns from localStorage & backend to identify returned invoices
      const returnedMap = new Map<string, any>();
      try {
        const sKey = `pos_sales_returns_${currentTenantId}_${currentCompanyId}`;
        const retRaw = localStorage.getItem(sKey);
        if (retRaw) {
          const retList = JSON.parse(retRaw);
          if (Array.isArray(retList)) {
            retList.forEach((r: any) => {
              if (r.original_invoice_no) {
                returnedMap.set(String(r.original_invoice_no).toLowerCase().trim(), r);
              }
            });
          }
        }
      } catch (e) {}

      try {
        const activeCid = currentCompanyId !== "default" ? currentCompanyId : undefined;
        const srvReturns: any = await salesReturnsApi.listReturns({ page: 1, page_size: 100, company_id: activeCid }).catch(() => null);
        const retItems = srvReturns?.items || srvReturns?.data?.items || (Array.isArray(srvReturns) ? srvReturns : []);
        if (Array.isArray(retItems)) {
          retItems.forEach((r: any) => {
            const originalInv = r.original_invoice_number || r.original_invoice_no;
            if (originalInv) {
              returnedMap.set(String(originalInv).toLowerCase().trim(), {
                return_number: r.return_number,
                return_date: r.return_date,
                original_invoice_no: originalInv,
                subtotal: Number(r.total_amount || 0),
                total_refund: Number(r.total_amount || 0),
                settlement_method: r.settlement_method,
                credit_note_number: r.credit_note_number,
                notes: r.reason,
                items: (r.items || []).map((it: any) => ({
                  product_name: it.product_name,
                  returned_qty: Number(it.returned_qty || 1),
                  unit_price: Number(it.unit_price || 0),
                  total_amount: Number(it.total_amount || 0),
                  reason: it.reason,
                })),
              });
            }
          });
        }
      } catch (e) {}

      // Build index of local records for fast lookup
      const localByNumber = new Map<string, any>();
      const localByRef = new Map<string, any>();
      localRecords.forEach((lr: any) => {
        if (lr && lr.invoice_number) localByNumber.set(String(lr.invoice_number).toLowerCase().trim(), lr);
        if (lr && lr.reference_number) localByRef.set(String(lr.reference_number).toLowerCase().trim(), lr);
        if (lr && lr.receipt_number) localByRef.set(String(lr.receipt_number).toLowerCase().trim(), lr);
      });

      // 2. Fetch remote ERP Invoices & POS transaction history from Backend API in parallel
      let invoiceItems: any[] = [];
      let posItems: any[] = [];
      try {
        const [apiRes, posHist]: [any, any] = await Promise.all([
          invoicesApi.listInvoices({ page_size: 1000 }).catch(() => null),
          posApi.getHistory({ limit: 500 }).catch(() => null),
        ]);
        invoiceItems = apiRes?.items || apiRes?.data?.items || apiRes?.data || (Array.isArray(apiRes) ? apiRes : []);
        posItems = posHist?.items || posHist?.data?.items || posHist?.data || (Array.isArray(posHist) ? posHist : []);
      } catch (e) {
        console.warn("invoicesApi / posApi fetch error:", e);
      }

      // Build index of POS transactions
      const posReceiptMap = new Map<string, any>();
      const matchedPosTxIds = new Set<string>();
      if (Array.isArray(posItems)) {
        posItems.forEach((tx: any) => {
          if (tx.receipt_number) posReceiptMap.set(String(tx.receipt_number).toLowerCase().trim(), tx);
          if (tx.id) posReceiptMap.set(String(tx.id).toLowerCase().trim(), tx);
        });
      }
        if (Array.isArray(invoiceItems) && invoiceItems.length > 0) {
          invoiceItems.forEach((inv: any) => {
            const invNum = String(inv.invoice_number || "").toUpperCase();
            const invType = String(inv.invoice_type || inv.doc_type || "").toUpperCase();
            const isQuote = invType === "QUOTATION" || invNum.startsWith("QT-");
            const isProforma = invType === "PROFORMA" || invNum.startsWith("PI-");
            const resolvedDocType = isQuote ? "quotation" : isProforma ? "proforma" : "tax_invoice";
            const isTaxInclusive = inv.is_tax_inclusive === true || (inv.lines || []).some((l: any) => l.is_tax_inclusive === true);
            const lines = (inv.lines || []).map((l: any) => ({
              id: l.id,
              product_id: l.product_id || "",
              product_name: l.product_name || l.item_name || "Item",
              sku: l.product_sku || l.sku || "",
              quantity: Number(l.quantity) || 1,
              unit_price: Number(l.unit_price) || 0,
              mrp: Number(l.mrp) || Number(l.unit_price) || 0,
              hsn_code: l.hsn_code || "",
              tax_rate: l.tax_rate !== undefined && l.tax_rate !== null ? Number(l.tax_rate) : 0,
              discount_value: Number(l.discount_value) || 0,
              discount_type: l.discount_type || "percent",
              is_tax_inclusive: l.is_tax_inclusive !== undefined ? l.is_tax_inclusive : isTaxInclusive,
            }));

            // Use authoritative totals from backend invoice record
            const rawGrandTotal = Number(inv.total_amount);
            const rawSubtotal = Number(inv.subtotal);
            const rawTax = Number(
              (Number(inv.cgst_amount || 0) + Number(inv.sgst_amount || 0) + Number(inv.igst_amount || 0)) ||
              inv.tax_amount ||
              0
            );

            let finalGrandTotal = !isNaN(rawGrandTotal) && rawGrandTotal > 0 ? rawGrandTotal : 0;
            let finalTax = !isNaN(rawTax) && rawTax >= 0 ? rawTax : 0;
            let finalSubtotal = !isNaN(rawSubtotal) && rawSubtotal > 0 ? rawSubtotal : (finalGrandTotal - finalTax);

            // Fallback calculation only if inv total_amount is completely missing/0
            if (finalGrandTotal === 0 && lines.length > 0) {
              let computedTaxable = 0;
              let computedTax = 0;
              lines.forEach((l: any) => {
                const lineGross = l.quantity * l.unit_price;
                const dAmt = Number(l.discount_value) || 0;
                const effGross = Math.max(0, lineGross - dAmt);
                if (l.is_tax_inclusive) {
                  const taxable = l.tax_rate > 0 ? effGross / (1 + l.tax_rate / 100) : effGross;
                  computedTaxable += taxable;
                  computedTax += (effGross - taxable);
                } else {
                  computedTaxable += effGross;
                  computedTax += (effGross * (l.tax_rate / 100));
                }
              });
              finalSubtotal = Number(computedTaxable.toFixed(2));
              finalTax = Number(computedTax.toFixed(2));
              finalGrandTotal = Number((computedTaxable + computedTax).toFixed(2));
            }

            const rawStatus = String(inv.status || "").toLowerCase();
            const invNumClean = String(inv.invoice_number || "").toLowerCase().trim();
            const hasReturn = returnedMap.has(invNumClean);
            const returnInfo = returnedMap.get(invNumClean);

            const isCancelled = rawStatus === "cancelled" || (inv as any).is_cancelled === true;
            const isReturned = rawStatus === "returned" || hasReturn;
            const isPartiallyReturned = rawStatus === "partially_returned";
            const isExchanged = rawStatus === "exchanged";
            const amtPaid = Number(inv.amount_paid) || 0;
            const isPaid = (rawStatus === "paid" || amtPaid >= finalGrandTotal - 0.05) && !isCancelled && !isReturned && !isExchanged;
            const isPartial = (rawStatus === "partial" || rawStatus === "partially_paid" || (amtPaid > 0 && amtPaid < finalGrandTotal - 0.05)) && !isCancelled && !isReturned && !isExchanged;

            let computedPaymentStatus: any = isCancelled
              ? "Cancelled"
              : isReturned
              ? "Returned"
              : isExchanged
              ? "Exchanged"
              : isPartiallyReturned
              ? "Partially Returned"
              : isPaid
              ? "Paid"
              : isPartial
              ? "Partial"
              : "Unpaid";

            const rawRefNum = String(inv.reference_number || "").toLowerCase().trim();
            const localMatch = localByNumber.get(invNumClean) || localByRef.get(rawRefNum) || (rawRefNum ? localByNumber.get(rawRefNum) : undefined);

            let matchedTx = posReceiptMap.get(rawRefNum) || posReceiptMap.get(invNumClean) || null;
            if (!matchedTx && Array.isArray(posItems)) {
              const invAmt = Number(inv.total_amount || 0);
              const invCust = String(inv.customer_phone || inv.customer_name || "").toLowerCase().trim();
              const invTime = new Date(inv.created_at || inv.invoice_date).getTime();
              matchedTx = posItems.find((tx: any) => {
                const txAmt = Number(tx.total_amount || 0);
                if (Math.abs(invAmt - txAmt) < 0.05 && invAmt > 0) {
                  const txCust = String(tx.customer?.phone || tx.customer?.name || "").toLowerCase().trim();
                  if (invCust && txCust && invCust === txCust) {
                    const txTime = new Date(tx.created_at).getTime();
                    if (Math.abs(invTime - txTime) < 600000) return true;
                  }
                }
                return false;
              });
            }
            if (matchedTx) {
              if (matchedTx.id) matchedPosTxIds.add(String(matchedTx.id).toLowerCase());
              if (matchedTx.receipt_number) matchedPosTxIds.add(String(matchedTx.receipt_number).toLowerCase());
            }

            const isThermal = isThermalDocument(inv);

            const determinedPrintStatus = (localMatch && localMatch.print_status && (isThermal ? localMatch.print_status.includes("Thermal") : !localMatch.print_status.includes("Thermal")))
              ? localMatch.print_status
              : (isThermal ? "Thermal Printed" : "A4 PDF Generated");

            let resolvedPaymentMode = inv.payment_terms || inv.payment_method || "Cash";
            if (inv.payments && Array.isArray(inv.payments) && inv.payments.length > 0) {
              const pMethods = inv.payments.map((p: any) => p.payment_method).filter(Boolean);
              if (pMethods.length > 0) {
                resolvedPaymentMode = Array.from(new Set(pMethods)).map((m: any) => {
                  const s = String(m).trim();
                  if (s.toLowerCase() === "upi") return "UPI";
                  if (s.toLowerCase() === "cod") return "COD";
                  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
                }).join(", ");
              }
            } else if (matchedTx && matchedTx.payments && matchedTx.payments.length > 0) {
              resolvedPaymentMode = matchedTx.payments.map((p: any) => {
                const s = String(p.payment_method || "Cash").trim();
                if (s.toLowerCase() === "upi") return "UPI";
                return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
              }).join(", ");
            } else if (localMatch?.payment_mode) {
              resolvedPaymentMode = localMatch.payment_mode;
            }

            const isCreditNote =
              inv.invoice_type === "credit_note" ||
              invNum.startsWith("CN") ||
              invNum.startsWith("CR-") ||
              (inv as any).document_type === "CREDIT_NOTE";

            const invPayments = Array.isArray(inv.payments) ? inv.payments : [];
            const paymentMethodsFromPayments = invPayments
              .map((p: any) => p.payment_method)
              .filter(Boolean);

            let effectivePaymentMode = inv.payment_terms || inv.payment_method || "";
            if (!effectivePaymentMode && paymentMethodsFromPayments.length > 0) {
              effectivePaymentMode = paymentMethodsFromPayments.join(", ");
            }
            if (!effectivePaymentMode) {
              effectivePaymentMode = isCreditNote ? "Credit Note" : "Cash";
            }

            const posReceiptNumber = matchedTx?.receipt_number || (rawRefNum.startsWith("rec-") ? inv.reference_number : undefined) || (invNumClean.startsWith("rec-") ? inv.invoice_number : undefined) || "";
            const erpInvoiceNumber = inv.invoice_number || `INV-${String(inv.id).slice(0, 6).toUpperCase()}`;
            // In thermal mode, user's counter sequence REC-... is primary, ERP Tax Inv is secondary
            const displayNumber = (isThermal && posReceiptNumber) ? posReceiptNumber : erpInvoiceNumber;
            const secondaryNumber = (isThermal && posReceiptNumber) ? (erpInvoiceNumber !== posReceiptNumber ? erpInvoiceNumber : undefined) : (posReceiptNumber || undefined);

            remoteRecords.push({
              id: inv.id,
              realId: inv.id,
              tenant_id: inv.tenant_id,
              company_id: inv.company_id,
              invoice_number: erpInvoiceNumber,
              reference_number: inv.reference_number || (matchedTx ? matchedTx.receipt_number : undefined),
              receipt_number: posReceiptNumber || undefined,
              display_number: displayNumber,
              secondary_number: secondaryNumber,
              is_thermal: isThermal,
              print_mode: isThermal ? "thermal" : "a4",
              customer_name: inv.customer_name || inv.customer?.name || (matchedTx?.customer?.name) || (localMatch?.customer_name && localMatch.customer_name !== "Walk-in Customer" ? localMatch.customer_name : "") || "Walk-in Customer",
              customer_phone: inv.customer?.phone || inv.customer_phone || (matchedTx?.customer?.phone) || (localMatch?.customer_phone || ""),
              customer_email: inv.customer?.email || inv.customer_email || (matchedTx?.customer?.email) || (localMatch?.customer_email || ""),
              customer_company: inv.customer?.company || inv.customer_company || (localMatch?.customer_company || ""),
              customer_gstin: inv.customer?.tax_number || inv.customer?.gst_number || inv.customer_gstin || (localMatch?.customer_gstin || ""),
              customer_type: inv.customer?.customer_type || inv.customer?.type || inv.customer?.category || inv.customer_type || (inv as any).pricing_mode || undefined,
              customer_billing_address: inv.billing_address || inv.customer?.billing_address || inv.customer_billing_address || "",
              customer_shipping_address: inv.shipping_address || inv.customer?.shipping_address || inv.customer_shipping_address || "",
              sales_executive: inv.sales_rep_name || (inv as any).salesperson_name || (inv as any).salesperson || (inv as any).sales_executive || inv.created_by_name || defaultRepName,
              sales_points_earned: (inv.sales_points_earned !== undefined && inv.sales_points_earned !== null) ? Number(inv.sales_points_earned) : Math.floor(finalGrandTotal / 100),
              invoice_date: inv.invoice_date || (inv.created_at ? new Date(inv.created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)),
              created_at: inv.created_at || (inv.invoice_date ? `${inv.invoice_date}T12:00:00Z` : new Date().toISOString()),
              due_date: inv.due_date || "",
              payment_mode: resolvedPaymentMode,
              payment_status: computedPaymentStatus,
              status: isCancelled ? "cancelled" : isReturned ? "returned" : isExchanged ? "exchanged" : isPartiallyReturned ? "partially_returned" : (inv.status || "paid"),
              cancellation_reason: (inv as any).cancellation_reason || inv.cancellation_reason || (isCancelled ? "Cancelled by Admin" : undefined),
              return_info: returnInfo,
              subtotal: finalSubtotal,
              taxable_value: Number(inv.subtotal) || finalSubtotal,
              total_tax: finalTax,
              cgst_amount: Number(inv.cgst_amount || 0) || (finalTax > 0 ? finalTax / 2 : 0),
              sgst_amount: Number(inv.sgst_amount || 0) || (finalTax > 0 ? finalTax / 2 : 0),
              igst_amount: Number(inv.igst_amount || 0),
              gst_type: Number(inv.igst_amount || 0) > 0 ? "igst" : "cgst_sgst",
              is_interstate: Number(inv.igst_amount || 0) > 0,
              discount_amount: Number(inv.discount_amount) || 0,
              grand_total: finalGrandTotal,
              amount_received: isPaid ? finalGrandTotal : amtPaid,
              print_status: determinedPrintStatus,
              invoice_type: inv.invoice_type || (isCreditNote ? "credit_note" : resolvedDocType),
              is_credit_note: isCreditNote,
              payments: invPayments,
              terms: inv.terms || inv.terms_and_conditions || undefined,
              notes: inv.notes || undefined,
              po_number: inv.po_number || inv.order_number || inv.custom_fields?.po_number || inv.custom_fields?.po_reference || undefined,
              po_date: inv.po_date || inv.custom_fields?.po_date || undefined,
              vehicle_number: inv.vehicle_number || inv.custom_fields?.vehicle_number || inv.custom_fields?.vehicle_no || undefined,
              driver_name: inv.driver_name || inv.custom_fields?.driver_name || undefined,
              driver_phone: inv.driver_phone || inv.custom_fields?.driver_phone || undefined,
              transporter_name: inv.transporter_name || inv.custom_fields?.transporter_name || undefined,
              eway_bill_number: inv.eway_bill_number || inv.custom_fields?.eway_bill_number || inv.custom_fields?.eway_bill_no || undefined,
              eway_bill_date: inv.eway_bill_date || inv.custom_fields?.eway_bill_date || undefined,
              challan_number: inv.challan_number || inv.delivery_challan_number || inv.custom_fields?.challan_number || inv.custom_fields?.challan_no || inv.custom_fields?.delivery_challan || undefined,
              delivery_challan_number: inv.delivery_challan_number || inv.challan_number || inv.custom_fields?.delivery_challan || inv.custom_fields?.challan_number || undefined,
              print_template_id: isThermal ? "thermal" : (inv.print_template_id || inv.template_id || "a4"),
              template_id: isThermal ? "thermal" : (inv.template_id || inv.print_template_id || "a4"),
              is_pos: isThermal,
              receipt_format: isThermal ? "thermal" : undefined,
              custom_fields: inv.custom_fields,
              items: lines,
            });
          });
        }

      // 3. Add standalone POS transactions that do not have an ERP invoice
      if (Array.isArray(posItems) && posItems.length > 0) {
        posItems.forEach((tx: any) => {
          const receiptNum = tx.receipt_number || (tx.id ? `REC-${String(tx.id).slice(0, 6).toUpperCase()}` : `REC-${Date.now()}`);
          const txIdStr = String(tx.id || "").toLowerCase().trim();
          const txRecStr = String(tx.receipt_number || "").toLowerCase().trim();
          if (matchedPosTxIds.has(txIdStr) || (txRecStr && matchedPosTxIds.has(txRecStr))) {
            // Already incorporated into ERP invoice record
            return;
          }
          const txLines = (tx.items || []).map((l: any) => ({
            id: l.id,
            product_name: l.product?.name || l.product_name || "Item",
            quantity: Number(l.quantity) || 1,
            unit_price: Number(l.unit_price) || 0,
            mrp: Number(l.unit_price) || 0,
            discount_value: Number(l.discount) || 0,
            tax_rate: 0,
          }));
          const txSubtotal = Number(tx.subtotal) || Number(tx.total_amount) || 0;
          const txTax = Number(tx.tax_amount) || 0;
          const txGrand = Number(tx.total_amount) || txSubtotal + txTax;
          const isRefund = tx.status === "refunded";
          const isCredit = tx.status === "credit";
          const isPaid = tx.status === "completed" || (!isCredit && !isRefund);

          const txPayments = Array.isArray(tx.payments) ? tx.payments : [];
          const txPaymentMethods = txPayments
            .map((p: any) => p.payment_method)
            .filter(Boolean);

          let posPaymentMode = txPaymentMethods.length > 0 ? txPaymentMethods.join(", ") : (tx.payment_method || "Cash");
          if (isRefund) {
            posPaymentMode = "Credit Note";
          } else if (isCredit) {
            posPaymentMode = "Credit / Due";
          }

          const resolvedPaymentStatus: any = isRefund ? "Returned" : isCredit ? "Unpaid" : isPaid ? "Paid" : "Partial";

          remoteRecords.push({
            id: tx.id,
            realId: tx.id,
            invoice_number: receiptNum,
            reference_number: receiptNum,
            receipt_number: receiptNum,
            display_number: receiptNum,
            secondary_number: undefined,
            is_thermal: true,
            print_mode: "thermal",
            customer_name: tx.customer?.name || "Walk-in Guest",
            customer_phone: tx.customer?.phone || "",
            customer_gstin: tx.customer?.gst_number || "",
            sales_executive: tx.sales_rep_name || tx.cashier?.full_name || defaultRepName || "POS Cashier",
            sales_points_earned: (tx.sales_points_earned !== undefined && tx.sales_points_earned !== null) ? Number(tx.sales_points_earned) : Math.floor(Math.abs(txGrand) / 100),
            invoice_date: tx.created_at ? new Date(tx.created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
            due_date: "",
            payment_mode: posPaymentMode,
            payment_status: resolvedPaymentStatus,
            status: isRefund ? "returned" : isCredit ? "credit" : (tx.status || "completed"),
            subtotal: isRefund ? -Math.abs(txSubtotal) : txSubtotal,
            total_tax: isRefund ? -Math.abs(txTax) : txTax,
            discount_amount: Number(tx.discount_amount) || 0,
            grand_total: isRefund ? -Math.abs(txGrand) : txGrand,
            amount_received: isRefund ? -Math.abs(txGrand) : isPaid ? txGrand : txPayments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0),
            print_status: "Thermal Printed",
            invoice_type: isRefund ? "credit_note" : "tax_invoice",
            is_credit_note: isRefund,
            payments: txPayments,
            print_template_id: "thermal",
            template_id: "thermal",
            items: txLines,
          });
        });
      }

      // Merge local and remote invoice records with robust alias index to eliminate duplicate listings
      const mergedMap = new Map<string, LocalInvoiceRecord>();
      const aliasMap = new Map<string, LocalInvoiceRecord>();

      const registerAlias = (key: any, rec: LocalInvoiceRecord) => {
        if (!key) return;
        aliasMap.set(String(key).toLowerCase().trim(), rec);
      };

      remoteRecords.forEach((inv) => {
        if (inv && inv.invoice_number) {
          mergedMap.set(inv.invoice_number, inv);
          registerAlias(inv.invoice_number, inv);
          if (inv.id) registerAlias(inv.id, inv);
          if ((inv as any).realId) registerAlias((inv as any).realId, inv);
          if ((inv as any).reference_number) registerAlias((inv as any).reference_number, inv);
          if ((inv as any).receipt_number) registerAlias((inv as any).receipt_number, inv);
          if ((inv as any).display_number) registerAlias((inv as any).display_number, inv);
          if ((inv as any).secondary_number) registerAlias((inv as any).secondary_number, inv);
        }
      });

      localRecords.forEach((inv) => {
        if (!inv) return;
        const invNum = inv.invoice_number;
        const refNum = (inv as any).reference_number;
        const recNum = (inv as any).receipt_number;
        const id = inv.id;

        const remote =
          (invNum && aliasMap.get(String(invNum).toLowerCase().trim())) ||
          (refNum && aliasMap.get(String(refNum).toLowerCase().trim())) ||
          (recNum && aliasMap.get(String(recNum).toLowerCase().trim())) ||
          (id && aliasMap.get(String(id).toLowerCase().trim()));

        if (remote) {
          if ((inv as any).print_status) {
            remote.print_status = (inv as any).print_status;
          }
          if ((inv as any).payment_mode) {
            remote.payment_mode = (inv as any).payment_mode;
          }
          if (inv.items && inv.items.length > 0 && (!remote.items || remote.items.length === 0)) {
            remote.items = inv.items;
            remote.subtotal = inv.subtotal;
            remote.total_tax = inv.total_tax;
            remote.grand_total = inv.grand_total;
          }
          const isRemoteThermal = isThermalDocument(remote) || isThermalDocument(inv);
          remote.is_thermal = isRemoteThermal;
          remote.print_mode = isRemoteThermal ? "thermal" : "a4";
          remote.print_status = isRemoteThermal ? "Thermal Printed" : "A4 PDF Generated";
          if ((inv as any).display_number && !(remote as any).display_number) {
            (remote as any).display_number = (inv as any).display_number;
          }
          if ((inv as any).invoice_type) remote.invoice_type = (inv as any).invoice_type;
          if ((inv as any).is_credit_note !== undefined) remote.is_credit_note = (inv as any).is_credit_note;
          if ((inv as any).payments) remote.payments = (inv as any).payments;
          if (inv.customer_name && inv.customer_name !== "Walk-in Customer" && (!remote.customer_name || remote.customer_name === "Walk-in Customer")) {
            remote.customer_name = inv.customer_name;
          }
          if (inv.customer_phone && !remote.customer_phone) {
            remote.customer_phone = inv.customer_phone;
          }
          if ((inv as any).customer_gstin && !(remote as any).customer_gstin) {
            (remote as any).customer_gstin = (inv as any).customer_gstin;
          }
          if ((inv as any).customer_type) (remote as any).customer_type = (inv as any).customer_type;
          if ((inv as any).customer_company) (remote as any).customer_company = (inv as any).customer_company;
          if ((inv as any).customer_email) (remote as any).customer_email = (inv as any).customer_email;
          if ((inv as any).customer_billing_address) (remote as any).customer_billing_address = (inv as any).customer_billing_address;
          if ((inv as any).customer_shipping_address) (remote as any).customer_shipping_address = (inv as any).customer_shipping_address;
          if ((inv as any).cgst_amount !== undefined) (remote as any).cgst_amount = (inv as any).cgst_amount;
          if ((inv as any).sgst_amount !== undefined) (remote as any).sgst_amount = (inv as any).sgst_amount;
          if ((inv as any).igst_amount !== undefined) (remote as any).igst_amount = (inv as any).igst_amount;
          if ((inv as any).gst_type) (remote as any).gst_type = (inv as any).gst_type;
          if ((inv as any).is_interstate !== undefined) (remote as any).is_interstate = (inv as any).is_interstate;
          if ((inv as any).terms) (remote as any).terms = (inv as any).terms;
          if ((inv as any).notes) (remote as any).notes = (inv as any).notes;
          if ((inv as any).print_template_id) (remote as any).print_template_id = (inv as any).print_template_id;
          if ((inv as any).template_id) (remote as any).template_id = (inv as any).template_id;
          if ((inv as any).custom_fields) (remote as any).custom_fields = (inv as any).custom_fields;

          const isCancelled = String(remote.status || "").toLowerCase() === "cancelled" || String(inv.status || "").toLowerCase() === "cancelled" || remote.payment_status === "Cancelled" || inv.payment_status === "Cancelled";
          const cleanInvNum = String(remote.invoice_number || "").toLowerCase().trim();
          const retRecord = returnedMap.get(cleanInvNum) || returnedMap.get(String(inv.invoice_number || "").toLowerCase().trim());
          const isReturned = !!retRecord || String(remote.status || "").toLowerCase() === "returned" || String(inv.status || "").toLowerCase() === "returned" || remote.payment_status === "Returned" || inv.payment_status === "Returned";
          const isPartiallyReturned = String(remote.status || "").toLowerCase() === "partially_returned" || String(inv.status || "").toLowerCase() === "partially_returned" || remote.payment_status === "Partially Returned" || inv.payment_status === "Partially Returned";
          const isExchanged = String(remote.status || "").toLowerCase() === "exchanged" || String(inv.status || "").toLowerCase() === "exchanged" || remote.payment_status === "Exchanged" || inv.payment_status === "Exchanged";

          if (isCancelled) {
            remote.status = "cancelled";
            remote.payment_status = "Cancelled";
            if (inv.cancellation_reason) remote.cancellation_reason = inv.cancellation_reason;
          } else if (isReturned) {
            remote.status = "returned";
            remote.payment_status = "Returned";
            if (retRecord && !remote.return_info) remote.return_info = retRecord;
          } else if (isPartiallyReturned) {
            remote.status = "partially_returned";
            remote.payment_status = "Partially Returned";
            if (retRecord && !remote.return_info) remote.return_info = retRecord;
          } else if (isExchanged) {
            remote.status = "exchanged";
            remote.payment_status = "Exchanged";
          } else {
            const maxPaid = Math.max(Number(inv.amount_received || 0), Number(remote.amount_received || 0));
            if (maxPaid >= remote.grand_total - 0.05 && remote.grand_total > 0) {
              remote.payment_status = "Paid";
              remote.payment_mode = inv.payment_mode || remote.payment_mode || "Cash";
              remote.amount_received = remote.grand_total;
            } else if (maxPaid > 0) {
              remote.payment_status = "Partial";
              remote.payment_mode = inv.payment_mode || remote.payment_mode || "Cash";
              remote.amount_received = maxPaid;
            } else {
              remote.payment_status = remote.payment_status || inv.payment_status || "Unpaid";
            }
          }
        } else if (inv.invoice_number) {
          const cleanInvNum = String(inv.invoice_number || "").toLowerCase().trim();
          const retRecord = returnedMap.get(cleanInvNum);
          if (retRecord) {
            inv.status = "returned";
            inv.payment_status = "Returned";
            inv.return_info = retRecord;
          }
          const isThermal = isThermalDocument(inv);
          (inv as any).is_thermal = isThermal;
          (inv as any).print_mode = isThermal ? "thermal" : "a4";
          (inv as any).display_number = inv.invoice_number;
          inv.print_status = isThermal ? "Thermal Printed" : "A4 PDF Generated";

          mergedMap.set(inv.invoice_number, inv);
          registerAlias(inv.invoice_number, inv);
          if (inv.id) registerAlias(inv.id, inv);
          if ((inv as any).reference_number) registerAlias((inv as any).reference_number, inv);
        }
      });

      const getInvoiceSortTime = (inv: LocalInvoiceRecord): number => {
        if (inv.created_at) {
          const t = parseSafeDateTimestamp(inv.created_at);
          if (t > 0) return t;
        }
        if (inv.updated_at) {
          const t = parseSafeDateTimestamp(inv.updated_at);
          if (t > 0) return t;
        }
        if (inv.timestamp) {
          const t = parseSafeDateTimestamp(inv.timestamp);
          if (t > 0) return t;
        }
        if (inv.invoice_date) {
          const t = parseSafeDateTimestamp(inv.invoice_date);
          if (t > 0) return t;
        }
        return 0;
      };

      const seenAliases = new Set<string>();
      const dedupedList: LocalInvoiceRecord[] = [];
      const sorted = Array.from(mergedMap.values()).sort((a, b) => {
        const timeA = getInvoiceSortTime(a);
        const timeB = getInvoiceSortTime(b);
        if (timeB !== timeA) return timeB - timeA;
        return 0;
      });

      // Identify all parties that have real sales invoices
      const partiesWithRealInvoices = new Set<string>();
      sorted.forEach((inv) => {
        const num = String(inv.invoice_number || "").toUpperCase().trim();
        const isOpn = num.startsWith("OPN-") || inv.invoice_type === "opening_balance";
        if (!isOpn && inv.status !== "cancelled") {
          const cName = String(inv.customer_name || "").toLowerCase().trim();
          if (cName && cName !== "walk-in customer") partiesWithRealInvoices.add(cName);
          if ((inv as any).customer_phone) partiesWithRealInvoices.add(String((inv as any).customer_phone).trim());
        }
      });

      for (const inv of sorted) {
        const invNum = String(inv.invoice_number || "").toUpperCase().trim();
        const isOpn = invNum.startsWith("OPN-") || inv.invoice_type === "opening_balance";
        const cName = String(inv.customer_name || "").toLowerCase().trim();
        const cPhone = String((inv as any).customer_phone || "").trim();
        if (isOpn && (partiesWithRealInvoices.has(cName) || (cPhone && partiesWithRealInvoices.has(cPhone)))) {
          // OPN invoice duplicates existing real sales invoices for this customer - exclude!
          continue;
        }

        const key = String(inv.invoice_number || inv.id).toLowerCase().trim();
        const refKey = (inv as any).reference_number ? String((inv as any).reference_number).toLowerCase().trim() : "";
        const recKey = (inv as any).receipt_number ? String((inv as any).receipt_number).toLowerCase().trim() : "";

        if (seenAliases.has(key) || (refKey && seenAliases.has(refKey)) || (recKey && seenAliases.has(recKey))) {
          continue;
        }

        seenAliases.add(key);
        if (refKey) seenAliases.add(refKey);
        if (recKey) seenAliases.add(recKey);
        if (inv.id) seenAliases.add(String(inv.id).toLowerCase().trim());
        if ((inv as any).realId) seenAliases.add(String((inv as any).realId).toLowerCase().trim());

        if (!inv.grand_total || inv.grand_total === 0) {
          if (inv.items && inv.items.length > 0) {
            let sub = 0;
            let tax = 0;
            inv.items.forEach((it: any) => {
              const qty = Number(it.quantity || 1);
              const price = Number(it.unit_price || 0);
              const dAmt = Number(it.discount_value || 0);
              const rate = Number(it.tax_rate || 0);
              const isIncl = it.is_tax_inclusive === true;
              const gross = Math.max(0, qty * price - dAmt);
              if (isIncl) {
                const base = rate > 0 ? gross / (1 + rate / 100) : gross;
                sub += base;
                tax += (gross - base);
              } else {
                sub += gross;
                tax += (gross * (rate / 100));
              }
            });
            inv.subtotal = Number(sub.toFixed(2));
            inv.total_tax = Number(tax.toFixed(2));
            inv.grand_total = Number((sub + tax).toFixed(2));
            if (inv.payment_status === "Paid") inv.amount_received = inv.grand_total;
          }
        }
        dedupedList.push(inv);
      }

      setInvoices(dedupedList);
    } catch (err: any) {
      console.error("loadInvoices critical failure:", err);
      toast.error("Failed to load invoice history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setInvoices([]);
    loadInvoices();
    const handleSync = () => {
      loadInvoices();
    };
    window.addEventListener("pos_invoices_updated", handleSync);
    window.addEventListener("storage", handleSync);
    window.addEventListener("bos-tenant-changed", handleSync);
    window.addEventListener("bos-company-changed", handleSync);
    return () => {
      window.removeEventListener("pos_invoices_updated", handleSync);
      window.removeEventListener("storage", handleSync);
      window.removeEventListener("bos-tenant-changed", handleSync);
      window.removeEventListener("bos-company-changed", handleSync);
    };
  }, [currentTenantId, currentCompanyId, storageKey]);

  // Update print status of an invoice locally & persist
  const updateInvoicePrintStatus = (invNum: string, newStatus: string) => {
    setInvoices((prev) => {
      const updated = prev.map((inv) =>
        inv.invoice_number === invNum || (inv as any).reference_number === invNum
          ? {
              ...inv,
              print_status: newStatus,
              print_template_id: newStatus === "Thermal Printed" ? "thermal" : (inv.print_template_id || "a4"),
              template_id: newStatus === "Thermal Printed" ? "thermal" : (inv.template_id || "a4"),
            }
          : inv
      );
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
  };

  // Open A4 PDF Printer Modal
  const handlePrintA4 = async (inv: LocalInvoiceRecord, copyType: string = "ORIGINAL FOR RECIPIENT") => {
    let fullInvRecord: any = inv;
    if (inv.id && inv.id.length > 20) {
      try {
        const remote: any = await invoicesApi.getInvoice(inv.id);
        if (remote) {
          const rawGrand = Number(remote.total_amount) || inv.grand_total;
          const rawTax = Number(
            (Number(remote.cgst_amount || 0) + Number(remote.sgst_amount || 0) + Number(remote.igst_amount || 0)) ||
            remote.tax_amount ||
            inv.total_tax ||
            0
          );
          const rawSubtotal = Number(remote.subtotal) || (rawGrand - rawTax);

          fullInvRecord = {
            ...inv,
            customer_name: remote.customer_name || remote.customer?.name || inv.customer_name,
            customer_phone: remote.customer_phone || remote.customer?.phone || inv.customer_phone,
            customer_email: remote.customer_email || remote.customer?.email || (inv as any).customer_email || "",
            customer_company: remote.customer?.company || remote.customer_company || (inv as any).customer_company || "",
            customer_gstin: remote.customer_gstin || remote.customer?.tax_number || remote.customer?.gst_number || inv.customer_gstin,
            customer_type: remote.customer?.customer_type || remote.customer?.type || remote.customer?.category || (inv as any).customer_type || (inv as any).customerType,
            customer_billing_address: remote.billing_address || remote.customer?.billing_address || (inv as any).customer_billing_address || "",
            customer_shipping_address: remote.shipping_address || remote.customer?.shipping_address || (inv as any).customer_shipping_address || "",
            subtotal: (inv as any).subtotal !== undefined ? Number((inv as any).subtotal) : rawSubtotal,
            taxable_value: (inv as any).taxable_value !== undefined ? Number((inv as any).taxable_value) : rawSubtotal,
            total_tax: (inv as any).total_tax !== undefined ? Number((inv as any).total_tax) : rawTax,
            cgst_amount: Number(remote.cgst_amount || 0) || ((inv as any).cgst_amount !== undefined ? Number((inv as any).cgst_amount) : (rawTax > 0 ? rawTax / 2 : 0)),
            sgst_amount: Number(remote.sgst_amount || 0) || ((inv as any).sgst_amount !== undefined ? Number((inv as any).sgst_amount) : (rawTax > 0 ? rawTax / 2 : 0)),
            igst_amount: Number(remote.igst_amount || 0) || ((inv as any).igst_amount !== undefined ? Number((inv as any).igst_amount) : 0),
            gst_type: (Number(remote.igst_amount || 0) > 0 || (inv as any).gst_type === "igst") ? "igst" : "cgst_sgst",
            is_interstate: Number(remote.igst_amount || 0) > 0 || (inv as any).is_interstate === true,
            discount_amount: Number(remote.discount_amount || (inv as any).discount_amount || 0),
            grand_total: Number((inv as any).grand_total || remote.total_amount || rawGrand),
            amount_received: Number(remote.amount_paid) || (String(remote.status).toLowerCase() === "paid" ? rawGrand : inv.amount_received),
            payment_status: String(remote.status).toLowerCase() === "paid" ? "Paid" : inv.payment_status,
            payment_mode: remote.payment_method || remote.payment_terms || inv.payment_mode,
            terms: remote.terms || remote.terms_and_conditions || (inv as any).terms,
            notes: remote.notes || (inv as any).notes,
            po_number: remote.po_number || remote.order_number || (inv as any).po_number || (inv as any).po_reference || remote.custom_fields?.po_number,
            po_date: remote.po_date || (inv as any).po_date,
            vehicle_number: remote.vehicle_number || (inv as any).vehicle_number || remote.custom_fields?.vehicle_number,
            driver_name: remote.driver_name || (inv as any).driver_name,
            driver_phone: remote.driver_phone || (inv as any).driver_phone,
            transporter_name: remote.transporter_name || (inv as any).transporter_name,
            eway_bill_number: remote.eway_bill_number || (inv as any).eway_bill_number || remote.custom_fields?.eway_bill_number,
            eway_bill_date: remote.eway_bill_date || (inv as any).eway_bill_date,
            challan_number: remote.challan_number || remote.delivery_challan_number || (inv as any).challan_number || remote.custom_fields?.challan_number,
            delivery_challan_number: remote.delivery_challan_number || remote.challan_number || (inv as any).delivery_challan_number || remote.custom_fields?.delivery_challan_number,
            custom_fields: remote.custom_fields || (inv as any).custom_fields || remote.metadata || (inv as any).metadata,
            invoice_custom_fields: remote.invoice_custom_fields || (inv as any).invoice_custom_fields || remote.custom_fields || (inv as any).custom_fields,
            metadata: remote.metadata || (inv as any).metadata || remote.custom_fields || (inv as any).custom_fields,
            items: (remote.lines && remote.lines.length > 0)
              ? remote.lines.map((l: any) => ({
                id: l.id,
                product_id: l.product_id,
                product_name: l.product_name || l.item_name || "Item",
                description: l.description || l.custom_note || l.notes || l.note || "",
                custom_note: l.custom_note || l.description || l.notes || l.note || "",
                notes: l.notes || l.custom_note || l.description || l.note || "",
                quantity: Number(l.quantity) || 1,
                unit_price: Number(l.unit_price) || 0,
                mrp: Number(l.mrp) || Number(l.unit_price) || 0,
                hsn_code: l.hsn_code || "",
                tax_rate: Number(l.tax_rate) || 0,
                discount_type: l.discount_type || 'fixed',
                discount_value: Number(l.discount_value) || 0,
                is_tax_inclusive: l.is_tax_inclusive === true,
              }))
              : (inv.items || []).map((it: any) => ({
                ...it,
                description: it.description || it.custom_note || it.notes || it.note || "",
                custom_note: it.custom_note || it.description || it.notes || it.note || "",
                notes: it.notes || it.custom_note || it.description || it.note || "",
              })),
          };
        }
      } catch (e) {
        console.warn("Could not fetch remote invoice detail, using cached:", e);
      }
    }

    const calculatedTax = Number(fullInvRecord.total_tax || 0);
    const isInterState = fullInvRecord.is_interstate === true || fullInvRecord.gst_type === "igst";
    const cgstAmt = fullInvRecord.cgst_amount !== undefined ? Number(fullInvRecord.cgst_amount) : (!isInterState ? calculatedTax / 2 : 0);
    const sgstAmt = fullInvRecord.sgst_amount !== undefined ? Number(fullInvRecord.sgst_amount) : (!isInterState ? calculatedTax / 2 : 0);
    const igstAmt = fullInvRecord.igst_amount !== undefined ? Number(fullInvRecord.igst_amount) : (isInterState ? calculatedTax : 0);

    const custType = fullInvRecord.customer_type || (fullInvRecord as any).customerType || undefined;

    setFullInvoiceModalData({
      invoice_number: fullInvRecord.invoice_number,
      invoice_type: fullInvRecord.invoice_type || "TAX_INVOICE",
      customerName: fullInvRecord.customer_name || 'Walk-in Customer',
      customerPhone: fullInvRecord.customer_phone || '',
      customerEmail: fullInvRecord.customer_email || '',
      customerCompany: fullInvRecord.customer_company || '',
      customerGST: fullInvRecord.customer_gstin || '',
      customerAddress: fullInvRecord.customer_billing_address || fullInvRecord.billing_address || '',
      customerBillingAddress: fullInvRecord.customer_billing_address || fullInvRecord.billing_address || '',
      customerShippingAddress: fullInvRecord.customer_shipping_address || fullInvRecord.shipping_address || '',
      customerType: custType,
      sales_executive: fullInvRecord.sales_executive,
      invoice_date: fullInvRecord.invoice_date,
      due_date: fullInvRecord.due_date,
      payment_method: fullInvRecord.payment_mode || 'Cash',
      payment_status: fullInvRecord.payment_status || 'PAID',
      subtotal: Number(fullInvRecord.subtotal || 0),
      taxable_value: fullInvRecord.taxable_value !== undefined ? Number(fullInvRecord.taxable_value) : Number(fullInvRecord.subtotal || 0),
      tax_amount: calculatedTax,
      cgst_amount: cgstAmt,
      sgst_amount: sgstAmt,
      igst_amount: igstAmt,
      gst_type: isInterState ? 'igst' : 'cgst_sgst',
      is_interstate: isInterState,
      discount_amount: Number(fullInvRecord.discount_amount || 0),
      grand_total: Number(fullInvRecord.grand_total || 0),
      amount_received: fullInvRecord.payment_status === "Paid" ? fullInvRecord.grand_total : (fullInvRecord.amount_received !== undefined ? Number(fullInvRecord.amount_received) : Number(fullInvRecord.grand_total || 0)),
      items: (fullInvRecord.items || []).map((it: any) => ({
        ...it,
        description: it.description || it.custom_note || it.notes || it.note || "",
        custom_note: it.custom_note || it.description || it.notes || it.note || "",
        notes: it.notes || it.custom_note || it.description || it.note || "",
      })),
      terms: fullInvRecord.terms || fullInvRecord.terms_and_conditions,
      notes: fullInvRecord.notes,
      po_number: fullInvRecord.po_number || (fullInvRecord as any)?.po_reference || (fullInvRecord.custom_fields && (fullInvRecord.custom_fields.po_number || fullInvRecord.custom_fields.po_reference)) || (inv as any)?.po_number || (inv as any)?.po_reference || undefined,
      po_date: fullInvRecord.po_date || (fullInvRecord.custom_fields && fullInvRecord.custom_fields.po_date) || (inv as any)?.po_date || undefined,
      vehicle_number: fullInvRecord.vehicle_number || (fullInvRecord as any)?.vehicle_no || (fullInvRecord.custom_fields && (fullInvRecord.custom_fields.vehicle_number || fullInvRecord.custom_fields.vehicle_no)) || (inv as any)?.vehicle_number || (inv as any)?.vehicle_no || undefined,
      driver_name: fullInvRecord.driver_name || (fullInvRecord.custom_fields && fullInvRecord.custom_fields.driver_name) || (inv as any)?.driver_name || undefined,
      driver_phone: fullInvRecord.driver_phone || (fullInvRecord.custom_fields && fullInvRecord.custom_fields.driver_phone) || (inv as any)?.driver_phone || undefined,
      transporter_name: fullInvRecord.transporter_name || (fullInvRecord.custom_fields && fullInvRecord.custom_fields.transporter_name) || (inv as any)?.transporter_name || undefined,
      eway_bill_number: fullInvRecord.eway_bill_number || (fullInvRecord as any)?.eway_bill_no || (fullInvRecord.custom_fields && (fullInvRecord.custom_fields.eway_bill_number || fullInvRecord.custom_fields.eway_bill_no)) || (inv as any)?.eway_bill_number || (inv as any)?.eway_bill_no || undefined,
      eway_bill_date: fullInvRecord.eway_bill_date || (fullInvRecord.custom_fields && fullInvRecord.custom_fields.eway_bill_date) || (inv as any)?.eway_bill_date || undefined,
      challan_number: fullInvRecord.challan_number || fullInvRecord.delivery_challan_number || (fullInvRecord.custom_fields && (fullInvRecord.custom_fields.challan_number || fullInvRecord.custom_fields.delivery_challan_number)) || (inv as any)?.challan_number || (inv as any)?.delivery_challan_number || undefined,
      delivery_challan_number: fullInvRecord.delivery_challan_number || fullInvRecord.challan_number || (fullInvRecord.custom_fields && (fullInvRecord.custom_fields.delivery_challan_number || fullInvRecord.custom_fields.challan_number)) || (inv as any)?.delivery_challan_number || (inv as any)?.challan_number || undefined,
      print_template_id: (() => {
        const rawTpl = fullInvRecord.print_template_id || fullInvRecord.template_id || (fullInvRecord as any).templateId || (fullInvRecord as any)?.custom_fields?.print_template_id || (fullInvRecord as any)?.custom_fields?.template_id || (inv as any)?.print_template_id || (inv as any)?.template_id;
        const s = String(rawTpl || "").toLowerCase().trim();
        if (s && s !== "thermal" && s !== "pos" && !s.startsWith("tpl-thm-") && !s.includes("receipt")) {
          return rawTpl;
        }
        return undefined;
      })(),
      template_id: (() => {
        const rawTpl = fullInvRecord.template_id || fullInvRecord.print_template_id || (fullInvRecord as any).templateId || (fullInvRecord as any)?.custom_fields?.template_id || (inv as any)?.template_id || (inv as any)?.print_template_id;
        const s = String(rawTpl || "").toLowerCase().trim();
        if (s && s !== "thermal" && s !== "pos" && !s.startsWith("tpl-thm-") && !s.includes("receipt")) {
          return rawTpl;
        }
        return undefined;
      })(),
      custom_fields: fullInvRecord.custom_fields || (inv as any).custom_fields || (inv as any).metadata,
      invoice_custom_fields: fullInvRecord.invoice_custom_fields || (inv as any).invoice_custom_fields || (inv as any).metadata,
      metadata: fullInvRecord.metadata || (inv as any).metadata || fullInvRecord.custom_fields || (inv as any).custom_fields,
      payment_terms: fullInvRecord.payment_mode || fullInvRecord.payment_terms,
      copy_type: copyType,
    });
    setAutoPrintFullInvoice(true);
    setIsFullInvoiceOpen(true);
    updateInvoicePrintStatus(inv.invoice_number, copyType === "ORIGINAL FOR RECIPIENT" ? "A4 PDF Generated" : `${copyType} Generated`);
    toast.success(`${copyType === "ORIGINAL FOR RECIPIENT" ? "A4 PDF Invoice" : copyType} generated for ${inv.invoice_number}`);
  };

  // Dispatch WhatsApp PDF Send
  const dispatchWhatsAppSend = async (inv: LocalInvoiceRecord, targetPhone: string) => {
    const cleanedPhone = targetPhone.replace(/[^0-9+]/g, "").trim();
    if (!cleanedPhone || cleanedPhone.length < 7) {
      toast.error("Please enter a valid recipient WhatsApp number (at least 10 digits).");
      return;
    }
    setIsSendingWhatsApp(true);
    toast.loading(`Sending ${inv.invoice_number} to ${cleanedPhone}...`, { id: `wa-${inv.id}` });
    const isThermalInvoice = Boolean(
      (inv.print_status?.includes("Thermal Only") || inv.invoice_number?.toLowerCase().startsWith("rec-") || (inv as any).receipt_number) &&
      !inv.invoice_number?.toUpperCase().startsWith("INV-") &&
      !inv.invoice_number?.toUpperCase().startsWith("TAX-")
    );

    try {
      let sent = false;
      if (isThermalInvoice) {
        try {
          const activePaperSize = (getActiveReceiptTemplate(tenant?.id)?.paperSize || '80mm') as '80mm' | '58mm';
          const thermalHtml = generateThermalReceiptHtml(inv, undefined, tenant?.id);
          const pdfBase64 = await thermalReceiptHtmlToPdfBase64(thermalHtml, activePaperSize);
          if (pdfBase64) {
            const targetTxId = (inv as any).id || (inv as any).receipt_number || (inv as any).invoice_number;
            const posRes = await posApi.sendThermalReceiptWhatsApp(targetTxId, pdfBase64, cleanedPhone);
            if (posRes?.success) {
              sent = true;
            }
          }
        } catch (thermalErr) {
          console.warn("[PosInvoicesHistory] Direct thermal PDF WhatsApp send error, falling back to standard sender:", thermalErr);
        }
      }

      if (!sent) {
        try {
          const result = await invoicesApi.sendInvoiceToWhatsApp(inv.id, cleanedPhone);
          if (result && !result.error) {
            sent = true;
          }
        } catch (gwErr) {
          console.warn("[PosInvoicesHistory] Automated WhatsApp gateway send failed, offering direct link:", gwErr);
        }
      }

      if (!sent) {
        // Fallback: Open WhatsApp direct chat with formatted summary
        const grandTotal = Number(inv.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
        const text = encodeURIComponent(
          `Hello ${inv.customer_name || 'Customer'},\n\n` +
          `Here is your Tax Invoice from our store:\n` +
          `📄 *Invoice No:* ${inv.invoice_number}\n` +
          `📅 *Date:* ${inv.invoice_date}\n` +
          `💰 *Total Amount:* ₹${grandTotal}\n\n` +
          `Thank you for your business!`
        );
        window.open(`https://wa.me/${cleanedPhone}?text=${text}`, "_blank");
        toast.success(`Opened WhatsApp chat for ${cleanedPhone}!`, { id: `wa-${inv.id}` });
      } else {
        toast.success(`Invoice ${inv.invoice_number} sent via WhatsApp to ${cleanedPhone}!`, { id: `wa-${inv.id}` });
      }

      setInvoices((prev) =>
        prev.map((item) =>
          item.id === inv.id || item.invoice_number === inv.invoice_number
            ? { ...item, customer_phone: cleanedPhone, is_whatsapp_sent: true }
            : item
        )
      );
      setWhatsappInvoice(null);
    } catch (err: any) {
      toast.error(`WhatsApp send failed: ${err.message || "Unknown error"}`, { id: `wa-${inv.id}` });
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  // Trigger WhatsApp sending: opens phone dialog if customer phone is not on record
  const handleSendWhatsApp = (inv: LocalInvoiceRecord) => {
    const existingPhone = (inv.customer_phone || (inv as any).phone || "").trim();
    if (existingPhone && existingPhone.length >= 7) {
      dispatchWhatsAppSend(inv, existingPhone);
    } else {
      setWhatsappInvoice(inv);
      setWhatsappPhoneInput("");
    }
  };

  // Dispatch Email PDF Send
  const dispatchEmailSend = async (inv: LocalInvoiceRecord, targetEmail: string) => {
    const cleanedEmail = targetEmail.trim();
    if (!cleanedEmail || !cleanedEmail.includes("@")) {
      toast.error("Please enter a valid recipient email address.");
      return;
    }
    setIsSendingEmail(true);
    toast.loading(`Sending ${inv.invoice_number} to ${cleanedEmail}...`, { id: `email-${inv.id || inv.invoice_number}` });
    try {
      const result = await invoicesApi.sendInvoiceEmail(inv.id || inv.invoice_number, cleanedEmail);
      if (result.error) {
        toast.error(`Email send failed: ${result.error}`, { id: `email-${inv.id || inv.invoice_number}` });
      } else {
        toast.success(`Invoice ${inv.invoice_number} sent via Email to ${cleanedEmail}!`, { id: `email-${inv.id || inv.invoice_number}` });
        setInvoices((prev) =>
          prev.map((item) =>
            item.id === inv.id || item.invoice_number === inv.invoice_number
              ? { ...item, customer_email: cleanedEmail, is_email_sent: true }
              : item
          )
        );
        setEmailInvoice(null);
      }
    } catch (err: any) {
      toast.error(`Email send failed: ${err.message || "Unknown error"}`, { id: `email-${inv.id || inv.invoice_number}` });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Trigger Email sending: opens email dialog if customer email is not on record
  const handleSendEmail = (inv: LocalInvoiceRecord) => {
    const existingEmail = (inv.customer_email || (inv as any).email || "").trim();
    if (existingEmail && existingEmail.includes("@")) {
      dispatchEmailSend(inv, existingEmail);
    } else {
      setEmailInvoice(inv);
      setEmailAddressInput("");
    }
  };

  // Open Thermal Receipt In-App Preview & Print Modal
  const handlePrintThermal = async (inv: LocalInvoiceRecord) => {
    setThermalReceiptModalData(inv);
    setIsThermalReceiptOpen(true);
    updateInvoicePrintStatus(inv.invoice_number, "Thermal Printed");

    if (inv.id) {
      try {
        const remote: any = await invoicesApi.getInvoice(inv.id);
        if (remote) {
          setThermalReceiptModalData((prev: any) => ({
            ...prev,
            ...remote,
            items: remote.items && remote.items.length > 0 ? remote.items : prev?.items,
            customer_name: remote.customer_name || remote.customer?.name || prev?.customer_name,
            customer_phone: remote.customer_phone || remote.customer?.phone || prev?.customer_phone,
            customer_gstin: remote.customer_gstin || remote.customer?.tax_number || remote.customer?.gst_number || prev?.customer_gstin,
            customer_address: remote.billing_address || remote.customer?.billing_address || prev?.customer_address,
          }));
        }
      } catch (e) {
        console.warn("Could not fetch remote invoice for thermal print:", e);
      }
    }
  };

  // Open E-Way Bill Generator / Viewer Modal
  const handleOpenEwayBill = (inv: LocalInvoiceRecord) => {
    let cachedEwb: any = null;
    try {
      const raw = localStorage.getItem(`ewb_${inv.invoice_number}`);
      if (raw) cachedEwb = JSON.parse(raw);
    } catch { }

    const activeBilling = getActiveBillingGst(tenant?.id);
    setEwayBillModalData({
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      total_amount: Number(inv.grand_total || 0),
      cgst_amount: Number(inv.total_tax || 0) / 2,
      sgst_amount: Number(inv.total_tax || 0) / 2,
      from_gstin: activeBilling?.gstin || "",
      from_trade_name: activeBilling?.trade_name || activeBilling?.legal_name || "",
      from_address: activeBilling?.address || "",
      from_city: activeBilling?.state_name || "",
      to_customer_name: inv.customer_name,
      to_gstin: inv.customer_gstin || "URP",
      items: inv.items || [],
      eway_bill_number: cachedEwb?.eway_bill_number || inv.eway_bill_number,
      eway_bill_data: cachedEwb,
    });
    setIsEwayBillOpen(true);
  };

  // Filtered and Sorted invoices
  const filteredInvoices = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).getTime();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

    const matchesDate = (inv: LocalInvoiceRecord) => {
      if (dateFilter === "All") return true;
      const rawDateStr = inv.created_at || inv.invoice_date;
      if (!rawDateStr) return true;
      const invDateTime = parseSafeDateTimestamp(rawDateStr);
      if (!invDateTime) return true;

      if (dateFilter === "today") {
        return invDateTime >= todayStart && invDateTime <= todayEnd;
      }
      if (dateFilter === "yesterday") {
        const yestStart = todayStart - 86400000;
        const yestEnd = todayEnd - 86400000;
        return invDateTime >= yestStart && invDateTime <= yestEnd;
      }
      if (dateFilter === "7days") {
        const start7 = todayStart - 7 * 86400000;
        return invDateTime >= start7 && invDateTime <= todayEnd;
      }
      if (dateFilter === "month") {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0).getTime();
        return invDateTime >= monthStart && invDateTime <= todayEnd;
      }
      if (dateFilter === "custom") {
        if (!customStartDate && !customEndDate) return true;
        const start = customStartDate ? parseSafeDateTimestamp(`${customStartDate}T00:00:00`) : 0;
        const end = customEndDate ? parseSafeDateTimestamp(`${customEndDate}T23:59:59.999`) : Infinity;
        return invDateTime >= start && invDateTime <= end;
      }
      return true;
    };

    const getInvoiceSortTime = (inv: LocalInvoiceRecord): number => {
      if (inv.created_at) {
        const t = parseSafeDateTimestamp(inv.created_at);
        if (t > 0) return t;
      }
      if (inv.updated_at) {
        const t = parseSafeDateTimestamp(inv.updated_at);
        if (t > 0) return t;
      }
      if (inv.timestamp) {
        const t = parseSafeDateTimestamp(inv.timestamp);
        if (t > 0) return t;
      }
      if (inv.invoice_date) {
        const t = parseSafeDateTimestamp(inv.invoice_date);
        if (t > 0) return t;
      }
      return 0;
    };

    const filtered = invoices.filter((inv) => {
      const locStr = (inv.location_name || inv.store_name || inv.location || "").toLowerCase();
      const matchesSearch =
        !q ||
        inv.invoice_number.toLowerCase().includes(q) ||
        Boolean((inv as any).display_number && String((inv as any).display_number).toLowerCase().includes(q)) ||
        Boolean((inv as any).secondary_number && String((inv as any).secondary_number).toLowerCase().includes(q)) ||
        Boolean((inv as any).reference_number && String((inv as any).reference_number).toLowerCase().includes(q)) ||
        Boolean((inv as any).receipt_number && String((inv as any).receipt_number).toLowerCase().includes(q)) ||
        inv.customer_name.toLowerCase().includes(q) ||
        (inv.customer_phone && inv.customer_phone.includes(q)) ||
        (inv.sales_executive && inv.sales_executive.toLowerCase().includes(q)) ||
        locStr.includes(q);

      const isTherm = isThermalDocument(inv);
      const matchesDocType = (() => {
        if (docTypeFilter === "All" || !docTypeFilter) return true;
        if (docTypeFilter === "thermal") return isTherm;
        if (docTypeFilter === "a4") return !isTherm;
        return true;
      })();

      const matchesStatus =
        statusFilter === "All" ||
        inv.payment_status === statusFilter ||
        (statusFilter === "Returned" && (inv.status === "returned" || inv.payment_status === "Returned")) ||
        (statusFilter === "Partially Returned" && (inv.status === "partially_returned" || inv.payment_status === "Partially Returned")) ||
        (statusFilter === "Exchanged" && (inv.status === "exchanged" || inv.payment_status === "Exchanged")) ||
        (statusFilter === "Cancelled" && (inv.status === "cancelled" || inv.payment_status === "Cancelled"));
      const matchesPaymentMode =
        paymentModeFilter === "All" ||
        (() => {
          const mode = String(inv.payment_mode || "").toLowerCase();
          const target = paymentModeFilter.toLowerCase();
          if (target === "cash") {
            return mode.includes("cash") || mode === "cod";
          }
          if (target === "upi") {
            return mode.includes("upi") || mode.includes("qr") || mode.includes("gpay") || mode.includes("phonepe") || mode.includes("paytm");
          }
          if (target === "card") {
            return mode.includes("card") || mode.includes("pos") || mode.includes("debit") || mode.includes("credit card");
          }
          if (target === "wallet") {
            return mode.includes("wallet");
          }
          if (target === "netbanking") {
            return mode.includes("net") || mode.includes("bank") || mode.includes("neft") || mode.includes("rtgs") || mode.includes("imps");
          }
          if (target === "credit note") {
            return mode.includes("credit note") || inv.is_credit_note === true || inv.invoice_type === "credit_note";
          }
          if (target === "credit") {
            return (
              (mode.includes("credit") && !mode.includes("credit note")) ||
              mode.includes("due") ||
              mode.includes("pay later") ||
              mode.includes("pay_later") ||
              inv.payment_status === "Unpaid"
            );
          }
          if (target === "split") {
            return mode.includes("split");
          }
          return mode.includes(target);
        })();

      const matchesPrint = printFilter === "All" || inv.print_status === printFilter;
      const defaultStoreFallback = tenant?.name ? `${tenant.name} (Main Store)` : "Main Store";
      const matchesLocation =
        locationFilter === "All" ||
        (inv.location_name || inv.store_name || inv.location || defaultStoreFallback) === locationFilter;
      const matchesSalesRep =
        salesRepFilter === "All" ||
        (inv.sales_executive || (inv as any).sales_rep_name || "Admin / Cashier").toLowerCase() === salesRepFilter.toLowerCase();
      const dateOk = matchesDate(inv);

      return matchesSearch && matchesStatus && matchesPaymentMode && matchesPrint && matchesLocation && matchesSalesRep && dateOk && matchesDocType;
    });

    return filtered.sort((a, b) => {
      const timeA = getInvoiceSortTime(a);
      const timeB = getInvoiceSortTime(b);

      if (sortOrder === "newest") {
        if (timeB !== timeA) return timeB - timeA;
        return 0;
      }
      if (sortOrder === "oldest") {
        if (timeA !== timeB) return timeA - timeB;
        return 0;
      }
      if (sortOrder === "amount_desc") {
        return Number(b.grand_total || 0) - Number(a.grand_total || 0);
      }
      if (sortOrder === "amount_asc") {
        return Number(a.grand_total || 0) - Number(b.grand_total || 0);
      }
      return 0;
    });
  }, [invoices, searchQuery, docTypeFilter, statusFilter, paymentModeFilter, printFilter, locationFilter, salesRepFilter, dateFilter, customStartDate, customEndDate, sortOrder]);

  const thermalBillsCount = React.useMemo(() => {
    return invoices.filter((inv) => isThermalDocument(inv)).length;
  }, [invoices]);

  const a4BillsCount = React.useMemo(() => {
    return invoices.filter((inv) => !isThermalDocument(inv)).length;
  }, [invoices]);

  // Unique locations for filter
  const uniqueLocations = React.useMemo(() => {
    const set = new Set<string>();
    const defaultStoreFallback = tenant?.name ? `${tenant.name} (Main Store)` : "Main Store";
    invoices.forEach((inv) => {
      const loc = inv.location_name || inv.store_name || inv.location;
      if (loc) set.add(loc);
    });
    if (set.size === 0) set.add(defaultStoreFallback);
    return Array.from(set);
  }, [invoices, tenant?.name]);

  // Unique Sales Representatives & Aggregate Metrics
  const { uniqueSalesReps, salesRepStats } = React.useMemo(() => {
    const repSet = new Set<string>();
    const statsMap = new Map<string, { name: string; totalSales: number; invoiceCount: number; points: number }>();

    invoices.forEach((inv) => {
      // Opening balance records are NOT sales rep sales transactions
      const isOpn = String(inv.invoice_number || "").toUpperCase().trim().startsWith("OPN-") || inv.invoice_type === "opening_balance";
      if (isOpn) return;

      const repName = inv.sales_executive || (inv as any).sales_rep_name || "Admin / Cashier";
      repSet.add(repName);

      const existing = statsMap.get(repName) || { name: repName, totalSales: 0, invoiceCount: 0, points: 0 };
      existing.totalSales += Number(inv.grand_total || 0);
      existing.invoiceCount += 1;
      existing.points += Number(inv.sales_points_earned || 0);
      statsMap.set(repName, existing);
    });

    const statsList = Array.from(statsMap.values()).sort((a, b) => b.totalSales - a.totalSales);
    return { uniqueSalesReps: Array.from(repSet), salesRepStats: statsList };
  }, [invoices]);

  // Paginated slice for current page
  const paginatedInvoices = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, currentPage, pageSize]);

  // Helper to categorize payment method string
  const categorizePayment = (rawMethod: string): "upi" | "bank" | "credit" | "cash" => {
    const m = (rawMethod || "").toLowerCase().trim();
    if (
      (m.includes("credit") && !m.includes("credit note") && !m.includes("credit_note")) ||
      m.includes("due") ||
      m.includes("pay later") ||
      m.includes("pay_later") ||
      m.includes("khata") ||
      m.includes("udhar") ||
      m.includes("net 30") ||
      m.includes("net 15") ||
      m.includes("on account")
    ) {
      return "credit";
    }
    if (
      m.includes("upi") ||
      m.includes("gpay") ||
      m.includes("phonepe") ||
      m.includes("paytm") ||
      m.includes("qr") ||
      m.includes("bhim")
    ) {
      return "upi";
    }
    if (
      m.includes("bank") ||
      m.includes("card") ||
      m.includes("netbanking") ||
      m.includes("razorpay") ||
      m.includes("online") ||
      m.includes("pos_card") ||
      m.includes("transfer") ||
      m.includes("neft") ||
      m.includes("rtgs") ||
      m.includes("cheque")
    ) {
      return "bank";
    }
    return "cash";
  };

  // Helper to identify credit note
  const isCreditNoteInv = (inv: any) => {
    const invNum = String(inv.invoice_number || "").toUpperCase();
    const mode = String(inv.payment_mode || inv.payment_method || inv.payment_terms || "").toLowerCase();
    return (
      inv.is_credit_note === true ||
      inv.invoice_type === "credit_note" ||
      inv.document_type === "CREDIT_NOTE" ||
      invNum.startsWith("CN") ||
      invNum.startsWith("CR-") ||
      (inv as any).isCreditNote === true ||
      mode.includes("credit note")
    );
  };

  // Helper to identify cancelled invoice
  const isCancelledInv = (inv: any) => {
    const s = String(inv.status || "").toLowerCase();
    const ps = String(inv.payment_status || "").toLowerCase();
    return s === "cancelled" || ps === "cancelled" || (inv as any).is_cancelled === true;
  };

  // Helper to identify returned invoice
  const isReturnedInv = (inv: any) => {
    const s = String(inv.status || "").toLowerCase();
    const ps = String(inv.payment_status || "").toLowerCase();
    return s === "returned" || ps === "returned" || Boolean((inv as any).return_info);
  };

  // Total sales invoices count (excluding Credit Notes)
  const totalSalesInvoicesCount = React.useMemo(() => {
    return invoices.filter((inv) => !isCreditNoteInv(inv)).length;
  }, [invoices]);

  // Active sales invoices count (excluding Credit Notes and Cancelled/Returned invoices)
  const activeSalesInvoicesCount = React.useMemo(() => {
    return invoices.filter((inv) => !isCreditNoteInv(inv) && !isCancelledInv(inv) && !isReturnedInv(inv)).length;
  }, [invoices]);

  // Cancelled Invoices count
  const cancelledInvoicesCount = React.useMemo(() => {
    return invoices.filter((inv) => !isCreditNoteInv(inv) && isCancelledInv(inv)).length;
  }, [invoices]);

  // Returned Invoices count
  const returnedInvoicesCount = React.useMemo(() => {
    return invoices.filter((inv) => !isCreditNoteInv(inv) && isReturnedInv(inv)).length;
  }, [invoices]);

  // Calculate Authoritative Billed Revenue from DB sales invoices (deducting/excluding cancelled and returned amounts repaid to customers)
  const { totalRevenue, cancelledTotal, returnedTotal } = React.useMemo(() => {
    let rev = 0;
    let canc = 0;
    let ret = 0;

    invoices.forEach((curr) => {
      if (isCreditNoteInv(curr)) return;
      const amt = Math.abs(Number(curr.grand_total || 0));

      if (isCancelledInv(curr)) {
        canc += amt;
      } else if (isReturnedInv(curr)) {
        ret += amt;
      } else {
        rev += amt;
      }
    });

    return { totalRevenue: rev, cancelledTotal: canc, returnedTotal: ret };
  }, [invoices]);

  // Dynamic Payment Mode & Credit Notes Metrics computed completely from DB invoice records (excluding cancelled repayments)
  const paymentMetrics = React.useMemo(() => {
    let cashTotal = 0;
    let cashCount = 0;
    let upiTotal = 0;
    let upiCount = 0;
    let bankTotal = 0;
    let bankCount = 0;
    let creditTotal = 0;
    let creditCount = 0;
    let creditNotesTotal = 0;
    let creditNotesCount = 0;
    let cancelledCashTotal = 0;
    let cancelledUpiTotal = 0;
    let cancelledBankTotal = 0;

    invoices.forEach((inv) => {
      const mode = String(inv.payment_mode || inv.payment_method || inv.payment_terms || "").toLowerCase();
      const amount = Math.abs(Number(inv.grand_total || 0));

      if (isCreditNoteInv(inv)) {
        creditNotesTotal += amount;
        creditNotesCount += 1;
        return;
      }

      const isCancelled = isCancelledInv(inv);
      const isReturned = isReturnedInv(inv);
      const isPaidStatus = String(inv.payment_status || inv.status || "").toLowerCase() === "paid";
      const received = Math.min(amount, Number(inv.amount_received || inv.amount_paid || 0));
      const remainingDue = isPaidStatus ? 0 : Math.max(0, amount - received);

      // Check authoritative payments array from DB if available
      const payments = Array.isArray(inv.payments) && inv.payments.length > 0 ? inv.payments : null;
      if (payments) {
        const distinctCategories = Array.from(new Set(payments.map((p: any) => categorizePayment(p.payment_method || ""))));

        if (distinctCategories.length === 1 && !mode.includes("split")) {
          // Single payment category for this entire invoice
          const cat = distinctCategories[0];
          if (isCancelled || isReturned) {
            if (cat === "upi") cancelledUpiTotal += amount;
            else if (cat === "bank") cancelledBankTotal += amount;
            else cancelledCashTotal += amount;
            return;
          }

          if (cat === "upi") {
            upiTotal += amount;
            upiCount += 1;
          } else if (cat === "bank") {
            bankTotal += amount;
            bankCount += 1;
          } else if (cat === "credit") {
            if (remainingDue > 0.05) {
              creditTotal += remainingDue;
              creditCount += 1;
            }
          } else {
            cashTotal += amount;
            cashCount += 1;
          }
        } else {
          // Multi-method split payment
          let hasCash = false;
          let hasUpi = false;
          let hasBank = false;
          let hasCredit = false;

          const totalPaidInArray = payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
          const scale = (totalPaidInArray > 0 && amount > 0) ? (amount / totalPaidInArray) : 1;

          payments.forEach((p: any) => {
            const pAmt = Number(p.amount || 0) * scale;
            const cat = categorizePayment(p.payment_method || "");
            if (isCancelled || isReturned) {
              if (cat === "upi") cancelledUpiTotal += pAmt;
              else if (cat === "bank") cancelledBankTotal += pAmt;
              else cancelledCashTotal += pAmt;
              return;
            }

            if (cat === "upi") {
              upiTotal += pAmt;
              hasUpi = true;
            } else if (cat === "bank") {
              bankTotal += pAmt;
              hasBank = true;
            } else if (cat === "credit") {
              if (remainingDue > 0.05) {
                creditTotal += Math.min(pAmt, remainingDue);
                hasCredit = true;
              }
            } else {
              cashTotal += pAmt;
              hasCash = true;
            }
          });

          if (!isCancelled && !isReturned) {
            if (hasCash) cashCount += 1;
            if (hasUpi) upiCount += 1;
            if (hasBank) bankCount += 1;
            if (hasCredit) creditCount += 1;
          }
        }
      } else {
        const cat = categorizePayment(inv.payment_mode || inv.payment_terms || inv.payment_method || "Cash");
        if (isCancelled || isReturned) {
          if (cat === "upi") cancelledUpiTotal += amount;
          else if (cat === "bank") cancelledBankTotal += amount;
          else cancelledCashTotal += amount;
          return;
        }

        if (cat === "upi") {
          upiTotal += amount;
          upiCount += 1;
        } else if (cat === "bank") {
          bankTotal += amount;
          bankCount += 1;
        } else if (cat === "credit") {
          if (remainingDue > 0.05) {
            creditTotal += remainingDue;
            creditCount += 1;
          }
          if (received > 0.05) {
            cashTotal += received;
            cashCount += 1;
          }
        } else {
          cashTotal += amount;
          cashCount += 1;
        }
      }
    });

    return {
      cashTotal,
      cashCount,
      upiTotal,
      upiCount,
      bankTotal,
      bankCount,
      creditTotal,
      creditCount,
      creditNotesTotal,
      creditNotesCount,
      cancelledCashTotal,
      cancelledUpiTotal,
      cancelledBankTotal,
    };
  }, [invoices]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    dateFilter !== "All" ||
    sortOrder !== "newest" ||
    statusFilter !== "All" ||
    paymentModeFilter !== "All" ||
    printFilter !== "All" ||
    locationFilter !== "All" ||
    salesRepFilter !== "All" ||
    customStartDate ||
    customEndDate
  );

  const handleResetFilters = () => {
    setSearchQuery("");
    setDateFilter("All");
    setSortOrder("newest");
    setStatusFilter("All");
    setPaymentModeFilter("All");
    setPrintFilter("All");
    setLocationFilter("All");
    setSalesRepFilter("All");
    setCustomStartDate("");
    setCustomEndDate("");
  };

  return (
    <div className="space-y-6 mx-auto min-h-screen pb-24">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{t("Generated Invoices History", "Generated Invoices History")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("View, track print status, and manage all store sales invoices in real-time", "View, track print status, and manage all store sales invoices in real-time")}</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate({ to: "/reports", search: { tab: "payment_mode_sales" } as any })}
            className="bg-indigo-50/70 hover:bg-indigo-100/80 text-indigo-700 font-bold px-4 h-10 text-xs rounded-full border border-indigo-200/90 flex items-center gap-2 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95"
            title="Open Payment Mode Breakdown & Realization Report"
          >
            <CreditCard className="w-4 h-4 text-indigo-600" />
            <span className="hidden sm:inline">Payment Report</span>
          </button>

          <button
            onClick={loadInvoices}
            title="Refresh Invoices"
            className="bg-white hover:bg-slate-50 text-purple-600 font-medium h-10 w-10 rounded-full shadow-sm border border-slate-200/80 flex items-center justify-center transition-all hover:border-slate-300 active:scale-95 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-purple-600" : "text-purple-600"}`} />
          </button>

          <button
            onClick={() => navigate({ to: "/pos", search: { tab: "sales" } as any })}
            className="bg-gradient-to-r from-purple-600 via-indigo-600 to-teal-600 hover:from-purple-500 hover:to-teal-500 text-white font-bold px-6 h-10 text-sm rounded-full shadow-md hover:shadow-lg shadow-purple-500/25 flex items-center gap-2 hover:opacity-95 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border-0 tracking-wide"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <Receipt className="w-4 h-4" />
            <span className="font-bold">Sales Invoice</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 2xl:grid-cols-8 gap-2.5 sm:gap-3">
        {/* 1. Total Sales Invoices */}
        <div
          onClick={() => navigate({ to: "/reports", search: { tab: "payment_mode_sales" } as any })}
          className="bg-white px-3 py-3 rounded-2xl border border-slate-200/80 shadow-xs hover:border-blue-300 hover:shadow-md transition-all cursor-pointer min-w-0 flex flex-col justify-between h-full"
          title="Click to view detailed report"
        >
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1.5 gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                Total Invoices
              </span>
              <Receipt className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            </div>
            <div className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight whitespace-nowrap">
              {activeSalesInvoicesCount}
            </div>
          </div>
          <div className="text-[10.5px] text-slate-500 font-medium mt-1 whitespace-nowrap">
            {cancelledInvoicesCount > 0 ? (
              <span className="text-rose-600 font-medium">{totalSalesInvoicesCount} Total • {cancelledInvoicesCount} Cancelled</span>
            ) : (
              <span className="text-emerald-600 font-medium">100% Synced</span>
            )}
          </div>
        </div>

        {/* 2. Total Billed Revenue */}
        <div
          onClick={() => navigate({ to: "/reports", search: { tab: "payment_mode_sales" } as any })}
          className="bg-white px-3 py-3 rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer min-w-0 flex flex-col justify-between h-full"
          title="Click to view detailed report"
        >
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1.5 gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                Billed Revenue
              </span>
              <CreditCard className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            </div>
            <div className="text-base sm:text-lg font-semibold text-emerald-700 tracking-tight whitespace-nowrap">
              {formatCurrency(totalRevenue)}
            </div>
          </div>
          <div className="text-[10.5px] text-slate-500 font-medium mt-1 whitespace-nowrap">
            Avg: {formatCurrency(activeSalesInvoicesCount ? totalRevenue / activeSalesInvoicesCount : 0)}
          </div>
        </div>

        {/* 3. Total Cash */}
        <div
          onClick={() => navigate({ to: "/reports", search: { tab: "payment_mode_sales" } as any })}
          className="bg-white px-3 py-3 rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer min-w-0 flex flex-col justify-between h-full"
          title="Click to view cash sales report"
        >
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1.5 gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                Total Cash
              </span>
              <Banknote className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            </div>
            <div className="text-base sm:text-lg font-semibold text-emerald-700 tracking-tight whitespace-nowrap">
              {formatCurrency(paymentMetrics.cashTotal)}
            </div>
          </div>
          <div className="text-[10.5px] text-slate-500 font-medium mt-1 whitespace-nowrap">
            {paymentMetrics.cashCount} Invoices {activeSalesInvoicesCount > 0 ? `(${Math.round((paymentMetrics.cashCount / activeSalesInvoicesCount) * 100)}%)` : ""}
          </div>
        </div>

        {/* 4. Total UPI */}
        <div
          onClick={() => navigate({ to: "/reports", search: { tab: "payment_mode_sales" } as any })}
          className="bg-white px-3 py-3 rounded-2xl border border-slate-200/80 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer min-w-0 flex flex-col justify-between h-full"
          title="Click to view UPI sales report"
        >
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1.5 gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                Total UPI
              </span>
              <Smartphone className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            </div>
            <div className="text-base sm:text-lg font-semibold text-indigo-700 tracking-tight whitespace-nowrap">
              {formatCurrency(paymentMetrics.upiTotal)}
            </div>
          </div>
          <div className="text-[10.5px] text-slate-500 font-medium mt-1 whitespace-nowrap">
            {paymentMetrics.upiCount} Invoices {activeSalesInvoicesCount > 0 ? `(${Math.round((paymentMetrics.upiCount / activeSalesInvoicesCount) * 100)}%)` : ""}
          </div>
        </div>

        {/* 5. Bank / Card */}
        <div
          onClick={() => navigate({ to: "/reports", search: { tab: "payment_mode_sales" } as any })}
          className="bg-white px-3 py-3 rounded-2xl border border-slate-200/80 shadow-xs hover:border-blue-300 hover:shadow-md transition-all cursor-pointer min-w-0 flex flex-col justify-between h-full"
          title="Click to view Bank/Card sales report"
        >
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1.5 gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                Bank / Card
              </span>
              <Building className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            </div>
            <div className="text-base sm:text-lg font-semibold text-blue-700 tracking-tight whitespace-nowrap">
              {formatCurrency(paymentMetrics.bankTotal)}
            </div>
          </div>
          <div className="text-[10.5px] text-slate-500 font-medium mt-1 whitespace-nowrap">
            {paymentMetrics.bankCount} Invoices {activeSalesInvoicesCount > 0 ? `(${Math.round((paymentMetrics.bankCount / activeSalesInvoicesCount) * 100)}%)` : ""}
          </div>
        </div>

        {/* 6. Credit / Due (Pay Later) */}
        <div
          onClick={() => navigate({ to: "/reports", search: { tab: "payment_mode_sales" } as any })}
          className="bg-white px-3 py-3 rounded-2xl border border-slate-200/80 shadow-xs hover:border-purple-300 hover:shadow-md transition-all cursor-pointer min-w-0 flex flex-col justify-between h-full"
          title="Click to view Credit / Due sales report"
        >
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1.5 gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                Credit / Due
              </span>
              <Clock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            </div>
            <div className="text-base sm:text-lg font-semibold text-purple-700 tracking-tight whitespace-nowrap">
              {formatCurrency(paymentMetrics.creditTotal)}
            </div>
          </div>
          <div className="text-[10.5px] text-slate-500 font-medium mt-1 whitespace-nowrap">
            {paymentMetrics.creditCount} Invoices {activeSalesInvoicesCount > 0 ? `(${Math.round((paymentMetrics.creditCount / activeSalesInvoicesCount) * 100)}%)` : ""}
          </div>
        </div>

        {/* 7. Cancelled / Refunded (Amount Returned to Customer) */}
        <div className="bg-white px-3 py-3 rounded-2xl border border-rose-200 shadow-xs hover:border-rose-300 transition-colors bg-gradient-to-b from-rose-50/20 to-white min-w-0 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1.5 gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-rose-700 whitespace-nowrap">
                Cancelled / Repaid
              </span>
              <RotateCcw className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            </div>
            <div className="text-base sm:text-lg font-semibold text-rose-600 tracking-tight whitespace-nowrap">
              {formatCurrency(cancelledTotal)}
            </div>
          </div>
          <div className="text-[10.5px] text-rose-600 font-medium mt-1 whitespace-nowrap">
            {cancelledInvoicesCount} {cancelledInvoicesCount === 1 ? "Invoice" : "Invoices"} Repaid
          </div>
        </div>

        {/* 8. Credit Notes */}
        <div
          onClick={() => navigate({ to: "/reports", search: { tab: "payment_mode_sales" } as any })}
          className="bg-white px-3 py-3 rounded-2xl border border-slate-200/80 shadow-xs hover:border-amber-300 hover:shadow-md transition-all cursor-pointer min-w-0 flex flex-col justify-between h-full"
          title="Click to view Credit Notes report"
        >
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1.5 gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                Credit Notes
              </span>
              <RotateCcw className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            </div>
            <div className="text-base sm:text-lg font-semibold text-amber-700 tracking-tight whitespace-nowrap">
              {formatCurrency(paymentMetrics.creditNotesTotal)}
            </div>
          </div>
          <div className="text-[10.5px] text-slate-500 font-medium mt-1 whitespace-nowrap">
            {paymentMetrics.creditNotesCount} {paymentMetrics.creditNotesCount === 1 ? "Credit Note" : "Credit Notes"}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white px-2.5 py-2 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2">
        {/* Search input - expanded to fill unwanted tab gap */}
        <div className="relative flex-1 min-w-[240px] max-w-sm lg:max-w-md shrink-0 sm:shrink">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search Invoice #, Customer Name, Phone, Sales Rep..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-md pl-8 pr-6 py-1 h-7 text-[11px] font-medium text-slate-800 placeholder-slate-400 outline-none focus:ring-1 focus:ring-blue-500/20 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
              title="Clear search"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </div>

        {/* Filters Row: Compact, adjusted to fit perfectly without any scrolling */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none no-scrollbar min-w-0 max-w-full py-0.5">
          <Filter className="w-3 h-3 text-slate-400 shrink-0 mr-0.5" />

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className={`h-7 px-2 text-[11px] font-medium rounded-md border outline-none cursor-pointer transition-colors shrink-0 focus:ring-1 focus:ring-blue-500/20 ${
              dateFilter !== "All"
                ? "bg-blue-50/90 border-blue-300 text-blue-700 font-semibold"
                : "bg-slate-50/80 hover:bg-slate-100/80 border-slate-200 text-slate-700"
            }`}
          >
            <option value="All">📅 All Time</option>
            <option value="today">Today's Invoices</option>
            <option value="yesterday">Yesterday</option>
            <option value="7days">Last 7 Days</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Date Range...</option>
          </select>

          {/* Custom Date Pickers */}
          {dateFilter === "custom" && (
            <div className="flex items-center gap-1 bg-slate-50/80 border border-slate-200 rounded-md px-1.5 h-7 shrink-0">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-transparent text-[11px] font-medium outline-none text-slate-700"
              />
              <span className="text-slate-400 text-xs">-</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-transparent text-[11px] font-medium outline-none text-slate-700"
              />
            </div>
          )}

          {/* Time & Amount Sorting */}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className={`h-7 px-2 text-[11px] font-medium rounded-md border outline-none cursor-pointer transition-colors shrink-0 focus:ring-1 focus:ring-blue-500/20 ${
              sortOrder !== "newest"
                ? "bg-blue-50/90 border-blue-300 text-blue-700 font-semibold"
                : "bg-slate-50/80 hover:bg-slate-100/80 border-slate-200 text-slate-700"
            }`}
          >
            <option value="newest">⏱️ Newest</option>
            <option value="oldest">⏱️ Oldest</option>
            <option value="amount_desc">💰 High to Low</option>
            <option value="amount_asc">💰 Low to High</option>
          </select>

          {/* Payment Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`h-7 px-2 text-[11px] font-medium rounded-md border outline-none cursor-pointer transition-colors shrink-0 focus:ring-1 focus:ring-blue-500/20 ${
              statusFilter !== "All"
                ? "bg-blue-50/90 border-blue-300 text-blue-700 font-semibold"
                : "bg-slate-50/80 hover:bg-slate-100/80 border-slate-200 text-slate-700"
            }`}
          >
            <option value="All">All Statuses</option>
            <option value="Paid">Paid</option>
            <option value="Partial">Partial</option>
            <option value="Unpaid">Unpaid / Credit</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Returned">Returned</option>
            <option value="Partially Returned">Partially Returned</option>
            <option value="Exchanged">Exchanged</option>
          </select>

          {/* Payment Mode / Method Filter */}
          <select
            value={paymentModeFilter}
            onChange={(e) => setPaymentModeFilter(e.target.value)}
            className={`h-7 px-2 text-[11px] font-medium rounded-md border outline-none cursor-pointer transition-colors shrink-0 focus:ring-1 focus:ring-blue-500/20 ${
              paymentModeFilter !== "All"
                ? "bg-blue-50/90 border-blue-300 text-blue-700 font-semibold"
                : "bg-slate-50/80 hover:bg-slate-100/80 border-slate-200 text-slate-700"
            }`}
          >
            <option value="All">💳 All Modes</option>
            <option value="Cash">💵 Cash</option>
            <option value="UPI">📱 UPI / QR</option>
            <option value="Card">💳 Card / EDC</option>
            <option value="Wallet">👛 Wallet</option>
            <option value="Netbanking">🏦 Net Banking</option>
            <option value="Split">⚖️ Split Payment</option>
            <option value="Credit">⏳ Credit / Pay Later</option>
            <option value="Credit Note">🔄 Credit Note / Return</option>
          </select>

          {/* Sales/Thermal Bills Filter */}
          <select
            value={printFilter}
            onChange={(e) => setPrintFilter(e.target.value)}
            className={`h-7 px-2 text-[11px] font-medium rounded-md border outline-none cursor-pointer transition-colors shrink-0 focus:ring-1 focus:ring-blue-500/20 ${
              printFilter !== "All"
                ? "bg-blue-50/90 border-blue-300 text-blue-700 font-semibold"
                : "bg-slate-50/80 hover:bg-slate-100/80 border-slate-200 text-slate-700"
            }`}
          >
            <option value="All">All Bills</option>
            <option value="Thermal Printed">Thermal Printed</option>
            <option value="A4 PDF Generated">A4 PDF Generated</option>
            <option value="Pending Print">Pending Print</option>
          </select>

          {/* Store / Location Filter */}
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className={`h-7 px-2 text-[11px] font-medium rounded-md border outline-none cursor-pointer transition-colors shrink-0 focus:ring-1 focus:ring-blue-500/20 ${
              locationFilter !== "All"
                ? "bg-blue-50/90 border-blue-300 text-blue-700 font-semibold"
                : "bg-slate-50/80 hover:bg-slate-100/80 border-slate-200 text-slate-700"
            }`}
          >
            <option value="All">📍 All Stores</option>
            {uniqueLocations.map((loc) => (
              <option key={loc} value={loc}>
                📍 {loc}
              </option>
            ))}
          </select>

          {/* Sales Representative Filter */}
          <select
            value={salesRepFilter}
            onChange={(e) => setSalesRepFilter(e.target.value)}
            className={`h-7 px-2 text-[11px] font-medium rounded-md border outline-none cursor-pointer transition-colors shrink-0 focus:ring-1 focus:ring-blue-500/20 ${
              salesRepFilter !== "All"
                ? "bg-blue-50/90 border-blue-300 text-blue-700 font-semibold"
                : "bg-slate-50/80 hover:bg-slate-100/80 border-slate-200 text-slate-700"
            }`}
          >
            <option value="All">👤 All Reps</option>
            {uniqueSalesReps.map((rep) => (
              <option key={rep} value={rep}>
                👤 {rep}
              </option>
            ))}
          </select>

          {/* Reset All Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="h-7 px-2 text-[10.5px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
              title="Reset all filters to default"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Sales Representatives Performance Strip */}
      {salesRepStats.length > 0 && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 rounded-2xl text-white shadow-md border border-slate-800">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-sm text-white">Sales Representatives Volume & Points Breakdown</h3>
              <span className="text-[11px] bg-white/10 text-indigo-200 px-2 py-0.5 rounded-full font-medium">
                {salesRepStats.length} {salesRepStats.length === 1 ? 'Rep' : 'Reps'} Active
              </span>
            </div>
            <button
              onClick={() => navigate({ to: "/reports", search: { tab: "employee_sales_reports" } as any })}
              className="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <span>📊 Full Performance Reports</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {salesRepStats.map((rep) => {
              const isSelected = salesRepFilter.toLowerCase() === rep.name.toLowerCase();
              return (
                <div
                  key={rep.name}
                  onClick={() => setSalesRepFilter(isSelected ? "All" : rep.name)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-indigo-600/30 border-indigo-400 ring-2 ring-indigo-400/50"
                      : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white truncate max-w-[130px]">{rep.name}</span>
                    <span className="text-[10px] font-extrabold bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded-md border border-amber-400/30">
                      ★ {rep.points} Pts
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <div className="text-base font-black text-emerald-400">{formatCurrency(rep.totalSales)}</div>
                    <div className="text-[11px] text-slate-300 font-medium">{rep.invoiceCount} {rep.invoiceCount === 1 ? 'Sale' : 'Sales'}</div>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>{isSelected ? "✓ Filtering by this rep" : "Click to filter invoices"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sequence Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setDocTypeFilter("All")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold ${
              docTypeFilter === "All"
                ? "bg-white text-indigo-700 shadow-2xs font-extrabold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All Bills ({invoices.length})
          </button>
          <button
            type="button"
            onClick={() => setDocTypeFilter("thermal")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 font-bold ${
              docTypeFilter === "thermal"
                ? "bg-white text-emerald-700 shadow-2xs font-extrabold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>🧾 Thermal Counter Receipts (REC-...)</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-black">
              {thermalBillsCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setDocTypeFilter("a4")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 font-bold ${
              docTypeFilter === "a4"
                ? "bg-white text-blue-700 shadow-2xs font-extrabold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>📄 Standard A4 Invoices (INV-...)</span>
            <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full font-black">
              {a4BillsCount}
            </span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="font-bold text-slate-900">{filteredInvoices.length}</span> matching bills
        </div>
      </div>

      {/* Main Invoices Table */}
      <div className="bg-card rounded-2xl border border-border/70 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">Bill / Invoice #</th>
                <th
                  className="px-4 py-3 text-left cursor-pointer select-none hover:text-blue-600 transition-colors"
                  onClick={() => setSortOrder((prev) => (prev === "newest" ? "oldest" : "newest"))}
                  title="Click to sort by Date & Time"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Date & Time</span>
                    {sortOrder === "newest" && <ArrowDown className="w-3.5 h-3.5 text-blue-600" />}
                    {sortOrder === "oldest" && <ArrowUp className="w-3.5 h-3.5 text-blue-600" />}
                    {sortOrder !== "newest" && sortOrder !== "oldest" && <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                  </div>
                </th>
                <th className="px-4 py-3 text-left">Customer / Party</th>
                <th className="px-4 py-3 text-left">Sales Rep & Store / Cashier</th>
                <th className="px-4 py-3 text-left">Payment</th>
                <th className="px-4 py-3 text-left">Sales/Thermal bills</th>
                <th
                  className="px-4 py-3 text-center font-bold cursor-pointer select-none hover:text-blue-600 transition-colors"
                  onClick={() => setSortOrder((prev) => (prev === "amount_desc" ? "amount_asc" : "amount_desc"))}
                  title="Click to sort by Total Amount"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Total Amount</span>
                    {sortOrder === "amount_desc" && <ArrowDown className="w-3.5 h-3.5 text-blue-600" />}
                    {sortOrder === "amount_asc" && <ArrowUp className="w-3.5 h-3.5 text-blue-600" />}
                    {sortOrder !== "amount_desc" && sortOrder !== "amount_asc" && <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                  </div>
                </th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Loading generated invoices history...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Receipt className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    No generated invoices match your filters.
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((inv) => (
                  <tr key={inv.invoice_number} className="hover:bg-slate-50/80 transition-colors">
                    {/* Invoice Number */}
                    <td className="px-4 py-3 font-mono font-bold">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Receipt className={`w-3.5 h-3.5 shrink-0 ${inv.is_thermal ? "text-emerald-500" : "text-blue-500"}`} />
                        <span className={`font-mono font-bold ${inv.is_thermal ? "text-emerald-700" : "text-blue-700"}`}>
                          {(inv as any).display_number || inv.invoice_number}
                        </span>
                        {inv.is_thermal ? (
                          <span className="text-[9px] font-black bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200 shadow-2xs">
                            🧾 Thermal Roll
                          </span>
                        ) : (
                          <span className="text-[9px] font-black bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200 shadow-2xs">
                            📄 Standard A4
                          </span>
                        )}
                        {inv.order_source === "Storefront" && (
                          <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200 shadow-2xs">
                            🌐 Store
                          </span>
                        )}
                        {(inv.converted_from_proforma_number || inv.original_proforma_ref) && (
                          <span className="text-[9px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 shadow-2xs">
                            PI: {inv.converted_from_proforma_number || inv.original_proforma_ref}
                          </span>
                        )}
                      </div>
                      {(inv as any).secondary_number && (
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {inv.is_thermal ? `Tax Inv: ${(inv as any).secondary_number}` : `Counter Ref: ${(inv as any).secondary_number}`}
                        </div>
                      )}
                    </td>

                    {/* Date & Time */}
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex flex-col gap-0.5 text-[11px]">
                        <div className="flex items-center gap-1 font-semibold text-slate-800">
                          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                          {formatDisplayDate(inv.created_at || inv.invoice_date)}
                        </div>
                        {(inv.created_at || inv.invoice_date) && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                            <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            {formatSafeTime(inv.created_at || inv.invoice_date)}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800">{inv.customer_name}</div>
                      {inv.customer_phone && <div className="text-[10px] text-slate-400">{inv.customer_phone}</div>}
                    </td>

                    {/* Sales Representative & Store Location */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs">
                          <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center text-[10px] font-black shrink-0">
                            {(inv.sales_executive || defaultRepName || "P").charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate max-w-[170px]" title={inv.sales_executive || defaultRepName}>
                            {inv.sales_executive || defaultRepName}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-[10.5px] font-medium text-slate-500">
                          <MapPin className="w-3 h-3 text-indigo-500 shrink-0" />
                          <span className="truncate max-w-[160px] font-semibold text-slate-600" title={inv.location_name || inv.store_name || inv.location || tenant?.name || "Main Store"}>
                            {inv.location_name || inv.store_name || inv.location || tenant?.name || "Main Store"}
                          </span>
                        </div>

                        {inv.sales_points_earned !== undefined && inv.sales_points_earned > 0 && (
                          <div>
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                              <Award className="w-2.5 h-2.5 text-amber-500" /> +{inv.sales_points_earned} Pts
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Payment Mode & Status */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              inv.payment_status === "Cancelled" || inv.status === "cancelled"
                                ? "bg-rose-100 text-rose-800 border border-rose-300 font-black"
                                : inv.payment_status === "Returned" || inv.status === "returned"
                                  ? "bg-purple-100 text-purple-800 border border-purple-300 font-black"
                                  : inv.payment_status === "Partially Returned" || inv.status === "partially_returned"
                                    ? "bg-amber-100 text-amber-900 border border-amber-300 font-black"
                                    : inv.payment_status === "Exchanged" || inv.status === "exchanged"
                                      ? "bg-indigo-100 text-indigo-900 border border-indigo-300 font-black"
                                      : inv.payment_status === "Paid"
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        : inv.payment_status === "Partial"
                                          ? "bg-amber-50 text-amber-800 border border-amber-300 font-black"
                                          : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {inv.payment_status === "Cancelled" || inv.status === "cancelled"
                              ? "Cancelled"
                              : inv.payment_status === "Returned" || inv.status === "returned"
                                ? "Returned"
                                : inv.payment_status === "Partially Returned" || inv.status === "partially_returned"
                                  ? "Partially Returned"
                                  : inv.payment_status === "Exchanged" || inv.status === "exchanged"
                                    ? "Exchanged"
                                    : inv.payment_status === "Partial"
                                      ? "Partially Paid"
                                      : inv.payment_status}
                          </span>
                          {inv.payment_status !== "Unpaid" &&
                            inv.payment_status !== "Cancelled" &&
                            inv.status !== "cancelled" &&
                            inv.payment_status !== "Returned" &&
                            inv.status !== "returned" && (
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                              {inv.payment_mode || "Cash"}
                            </span>
                          )}
                        </div>
                        {(inv.payment_status === "Returned" || inv.status === "returned") && (
                          <div className="text-[10px] text-purple-700 font-semibold flex items-center gap-1">
                            <span>📦 Restocked to Inventory</span>
                          </div>
                        )}
                        {(inv.payment_status === "Cancelled" || inv.status === "cancelled") && (
                          <div className="text-[10px] text-rose-600 font-semibold flex items-center gap-1">
                            <span>📦 Restocked to Inventory</span>
                          </div>
                        )}
                        {inv.payment_status === "Partial" && (
                          <div className="text-[10px] font-semibold flex items-center gap-1.5 whitespace-nowrap">
                            <span className="text-emerald-700">Paid: {formatCurrency(inv.amount_received || 0)}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-rose-600 font-bold">Due: {formatCurrency(Math.max(0, inv.grand_total - (inv.amount_received || 0)))}</span>
                          </div>
                        )}
                        {(inv.payment_status === "Cancelled" || inv.status === "cancelled") && inv.cancellation_reason && (
                          <div className="text-[10px] text-rose-600 italic font-medium truncate max-w-[160px]" title={inv.cancellation_reason}>
                            {inv.cancellation_reason}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Print Status */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold ${inv.print_status === "Thermal Printed"
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : inv.print_status === "A4 PDF Generated"
                            ? "bg-indigo-50 text-indigo-800 border border-indigo-200"
                            : "bg-amber-50 text-amber-800 border border-amber-200"
                          }`}
                      >
                        {inv.print_status === "Thermal Printed" && "🖨️ Thermal Printed"}
                        {inv.print_status === "A4 PDF Generated" && "📄 A4 PDF Generated"}
                        {inv.print_status === "Pending Print" && "⏳ Pending Print"}
                      </span>
                    </td>

                    {/* Grand Total */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div
                          className={`font-black text-sm ${
                            inv.payment_status === "Cancelled" || inv.status === "cancelled" || inv.payment_status === "Returned" || inv.status === "returned"
                              ? "line-through text-slate-400"
                              : "text-slate-900"
                          }`}
                        >
                          {formatCurrency(inv.grand_total)}
                        </div>
                        {(inv.payment_status === "Returned" || inv.status === "returned") && (
                          <span className="text-[9px] font-extrabold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200 mt-0.5">
                            Refunded
                          </span>
                        )}
                        {(inv.payment_status === "Cancelled" || inv.status === "cancelled") && (
                          <span className="text-[9px] font-extrabold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200 mt-0.5">
                            Cancelled
                          </span>
                        )}
                        {inv.payment_status === "Partial" && Math.max(0, inv.grand_total - (inv.amount_received || 0)) > 0 ? (
                          <div className="text-[10px] text-rose-600 font-bold">
                            Due: {formatCurrency(Math.max(0, inv.grand_total - (inv.amount_received || 0)))}
                          </div>
                        ) : null}
                      </div>
                    </td>

                    {/* Action Buttons (Quotations Style) */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {/* View Details Drawer */}
                        <button
                          type="button"
                          title="View Details"
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setIsDetailDrawerOpen(true);
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer shrink-0"
                        >
                          <Eye className="size-4" />
                        </button>

                        {/* Collect Cash / Due Button */}
                        {inv.payment_status !== "Paid" && inv.payment_status !== "Cancelled" && inv.status !== "cancelled" && (
                          <button
                            type="button"
                            title={inv.payment_status === "Partial"
                              ? `Collect Due: ${formatCurrency(Math.max(0, inv.grand_total - (inv.amount_received || 0)))}`
                              : `Collect Cash: ${formatCurrency(inv.grand_total)}`
                            }
                            onClick={() => handleCollectInSalesInvoice(inv)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer shrink-0"
                          >
                            <Banknote className="size-4" />
                          </button>
                        )}

                        {/* WhatsApp Quick Action */}
                        <button
                          type="button"
                          title="Send Invoice via WhatsApp"
                          onClick={() => handleSendWhatsApp(inv)}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer shrink-0"
                        >
                          <MessageCircle className="size-4" />
                        </button>

                        {/* Email Quick Action */}
                        <button
                          type="button"
                          title="Send Invoice via Email"
                          onClick={() => handleSendEmail(inv)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer shrink-0"
                        >
                          <Mail className="size-4" />
                        </button>

                        {/* A4 Tax Invoice PDF */}
                        <button
                          type="button"
                          title="View / Print A4 Tax Invoice PDF"
                          onClick={() => handlePrintA4(inv)}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer shrink-0"
                        >
                          <FileText className="size-4" />
                        </button>

                        {/* Thermal Print (80mm) */}
                        <button
                          type="button"
                          title="Print 80mm POS Thermal Receipt"
                          onClick={() => handlePrintThermal(inv)}
                          className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer shrink-0"
                        >
                          <Printer className="size-4" />
                        </button>

                        {/* E-Way Bill */}
                        <button
                          type="button"
                          title={localStorage.getItem(`ewb_${inv.invoice_number}`) ? "View E-Way Bill" : "Generate E-Way Bill"}
                          onClick={() => handleOpenEwayBill(inv)}
                          className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer shrink-0"
                        >
                          <Truck className="size-4" />
                        </button>

                        {/* View Cancellation Voucher */}
                        {(inv.payment_status === "Cancelled" || inv.status === "cancelled") && (
                          <button
                            type="button"
                            title="View & Print Cancellation Slip / Voucher"
                            onClick={() => handleOpenCancellationVoucher(inv)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                          >
                            <FileText className="size-4 text-rose-600" />
                          </button>
                        )}

                        {/* View Return Voucher */}
                        {(inv.payment_status === "Returned" || inv.status === "returned" || inv.payment_status === "Partially Returned" || (inv as any).return_info) && (
                          <button
                            type="button"
                            title="View & Print Sales Return Slip"
                            onClick={() => handleOpenReturnVoucher(inv)}
                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer shrink-0"
                          >
                            <RotateCcw className="size-4 text-purple-600" />
                          </button>
                        )}

                        {/* Edit Invoice */}
                        {inv.payment_status !== "Cancelled" && inv.status !== "cancelled" && inv.payment_status !== "Returned" && inv.status !== "returned" && (
                          <button
                            type="button"
                            title="Edit Invoice"
                            onClick={() => handleEditInvoice(inv)}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer shrink-0"
                          >
                            <Pencil className="size-4" />
                          </button>
                        )}

                        {/* Cancel Invoice */}
                        {inv.payment_status !== "Cancelled" && inv.status !== "cancelled" && (
                          <button
                            type="button"
                            title="Cancel Invoice"
                            onClick={() => handleRequestCancelInvoice(inv)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                          >
                            <XCircle className="size-4" />
                          </button>
                        )}

                        {/* More Options Dropdown Menu (3-dots) */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              title="More Options"
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
                            >
                              <MoreVertical className="size-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52 shadow-xl border-slate-200/80 rounded-xl p-1 bg-white z-50">
                            {/* Quick Collect Cash in Dropdown */}
                            {inv.payment_status !== "Paid" && inv.payment_status !== "Cancelled" && inv.status !== "cancelled" && (
                              <DropdownMenuItem
                                onClick={() => handleCollectInSalesInvoice(inv)}
                                className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg cursor-pointer transition-colors"
                              >
                                <Banknote className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>Collect Due Cash</span>
                              </DropdownMenuItem>
                            )}

                            {/* View Details Drawer */}
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedInvoice(inv);
                                setIsDetailDrawerOpen(true);
                              }}
                              className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-blue-800 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                            >
                              <Eye className="w-4 h-4 text-blue-600 shrink-0" />
                              <span>View Details</span>
                            </DropdownMenuItem>

                            {/* View Cancellation Voucher */}
                            {(inv.payment_status === "Cancelled" || inv.status === "cancelled") && (
                              <DropdownMenuItem
                                onClick={() => handleOpenCancellationVoucher(inv)}
                                className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-700 hover:text-rose-800 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                              >
                                <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                                <span>Cancellation Slip / Voucher</span>
                              </DropdownMenuItem>
                            )}

                            {/* View Sales Return Voucher */}
                            {(inv.payment_status === "Returned" || inv.status === "returned" || inv.payment_status === "Partially Returned" || (inv as any).return_info) && (
                              <DropdownMenuItem
                                onClick={() => handleOpenReturnVoucher(inv)}
                                className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-purple-700 hover:text-purple-800 hover:bg-purple-50 rounded-lg cursor-pointer transition-colors"
                              >
                                <RotateCcw className="w-4 h-4 text-purple-600 shrink-0" />
                                <span>Sales Return Slip / Voucher</span>
                              </DropdownMenuItem>
                            )}

                            {/* Send via WhatsApp */}
                            <DropdownMenuItem
                              onClick={() => handleSendWhatsApp(inv)}
                              className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg cursor-pointer transition-colors"
                            >
                              <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>Send via WhatsApp</span>
                            </DropdownMenuItem>

                            {/* Send via Email */}
                            <DropdownMenuItem
                              onClick={() => handleSendEmail(inv)}
                              className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-blue-700 hover:text-blue-800 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                            >
                              <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                              <span>Send via Email</span>
                            </DropdownMenuItem>

                            {/* Duplicate Copy (A4) */}
                            <DropdownMenuItem
                              onClick={() => handlePrintA4(inv, "DUPLICATE COPY")}
                              className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-purple-700 hover:text-purple-900 hover:bg-purple-50 rounded-lg cursor-pointer transition-colors"
                            >
                              <Copy className="w-4 h-4 text-purple-600 shrink-0" />
                              <span>Duplicate Copy</span>
                            </DropdownMenuItem>

                            {/* Triplicate Copy (A4) */}
                            <DropdownMenuItem
                              onClick={() => handlePrintA4(inv, "TRIPLICATE COPY")}
                              className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors"
                            >
                              <Files className="w-4 h-4 text-indigo-600 shrink-0" />
                              <span>Triplicate Copy</span>
                            </DropdownMenuItem>

                            {/* E-Way Bill */}
                            <DropdownMenuItem
                              onClick={() => handleOpenEwayBill(inv)}
                              className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-blue-800 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                            >
                              <Truck className="w-4 h-4 text-blue-600 shrink-0" />
                              <span>{localStorage.getItem(`ewb_${inv.invoice_number}`) ? "View E-Way Bill" : "Generate E-Way Bill"}</span>
                            </DropdownMenuItem>

                            {/* Cancel Invoice */}
                            {inv.payment_status !== "Cancelled" && inv.status !== "cancelled" && (
                              <>
                                <DropdownMenuSeparator className="my-1 bg-slate-100" />
                                <DropdownMenuItem
                                  onClick={() => handleRequestCancelInvoice(inv)}
                                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                                >
                                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                  <span>Cancel Invoice</span>
                                </DropdownMenuItem>
                              </>
                            )}

                            {/* Permanent Delete */}
                            <DropdownMenuSeparator className="my-1 bg-rose-100" />
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(inv)}
                              className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-700 hover:text-rose-800 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                              <span>Delete Invoice Permanently</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <PaginationControl
          currentPage={currentPage}
          totalPages={Math.max(1, Math.ceil(filteredInvoices.length / pageSize))}
          totalItems={filteredInvoices.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="invoices"
        />
      </div>

      {/* Invoice Details Drawer Modal */}
      {isDetailDrawerOpen && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl overflow-y-auto flex flex-col border-l border-slate-200">
            {/* Drawer Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Receipt className={`w-5 h-5 ${selectedInvoice.is_thermal ? "text-emerald-400" : "text-blue-400"}`} />
                  <h2 className="text-lg font-extrabold">{selectedInvoice.display_number || selectedInvoice.invoice_number}</h2>
                  {selectedInvoice.is_thermal ? (
                    <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                      🧾 Thermal Roll Receipt
                    </span>
                  ) : (
                    <span className="text-[10px] font-black bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">
                      📄 Standard A4 Tax Invoice
                    </span>
                  )}
                </div>
                {selectedInvoice.secondary_number && (
                  <div className="text-xs text-slate-300 font-mono mt-0.5">
                    {selectedInvoice.is_thermal
                      ? `Linked Tax Invoice: ${selectedInvoice.secondary_number}`
                      : `Linked Counter Ref: ${selectedInvoice.secondary_number}`}
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-1">Generated on {formatDisplayDateTime(selectedInvoice.created_at || selectedInvoice.invoice_date)}</p>
              </div>
              <button
                onClick={() => setIsDetailDrawerOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 space-y-6 flex-1">
              {/* Customer & Rep Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Customer / Billed To</span>
                  <div className="font-extrabold text-slate-900 text-sm">{selectedInvoice.customer_name}</div>
                  {selectedInvoice.customer_billing_address && (
                    <div className="text-xs text-slate-600 mt-0.5">{selectedInvoice.customer_billing_address}</div>
                  )}
                  <div className="text-xs text-slate-500 mt-0.5">{selectedInvoice.customer_phone || "Walk-in Guest"}</div>
                  {selectedInvoice.customer_gstin && (
                    <div className="text-[10px] font-mono text-blue-600 font-bold mt-1">GSTIN: {selectedInvoice.customer_gstin}</div>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase text-indigo-500 block mb-1">Shipped To / Destination</span>
                  <div className="font-extrabold text-slate-900 text-sm">{selectedInvoice.customer_name}</div>
                  <div className="text-xs text-slate-700 font-medium mt-0.5">
                    {selectedInvoice.customer_shipping_address || selectedInvoice.customer_billing_address || "Same as Billing Address"}
                  </div>
                  {selectedInvoice.customer_phone && (
                    <div className="text-xs text-slate-500 mt-0.5">Contact: {selectedInvoice.customer_phone}</div>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Sales Representative & Cashier</span>
                  <div className="font-extrabold text-slate-900 text-sm">{selectedInvoice.sales_executive || defaultRepName}</div>
                  <div className="flex items-center gap-1 text-xs text-indigo-600 font-semibold mt-1">
                    <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>Store: {selectedInvoice.location_name || selectedInvoice.store_name || selectedInvoice.location || tenant?.name || "Main Store"}</span>
                  </div>
                  {selectedInvoice.sales_points_earned !== undefined && selectedInvoice.sales_points_earned > 0 && (
                    <div className="text-xs text-emerald-600 font-bold mt-1">
                      Points Earned: +{selectedInvoice.sales_points_earned || 0} Pts
                    </div>
                  )}
                </div>
              </div>

              {/* Line Items Table */}
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-3 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-blue-600" /> Itemized Line Items ({(selectedInvoice.items || []).length})
                </h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-slate-600 font-bold">
                      <tr>
                        <th className="p-2.5">Item Name</th>
                        <th className="p-2.5 text-center">Qty</th>
                        <th className="p-2.5 text-right">Price</th>
                        <th className="p-2.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedInvoice.items || []).map((it, idx) => {
                        const price = Number(it.unit_price || 0);
                        const qty = Number(it.quantity || 1);
                        return (
                          <tr key={idx}>
                            <td className="p-2.5 font-bold text-slate-800">
                              {it.product_name}
                              {it.hsn_code && <span className="block text-[10px] font-mono text-slate-400">HSN: {it.hsn_code}</span>}
                            </td>
                            <td className="p-2.5 text-center font-bold text-slate-700">{qty}</td>
                            <td className="p-2.5 text-right text-slate-600">{currency.symbol}{price.toFixed(2)}</td>
                            <td className="p-2.5 text-right font-bold text-slate-900">
                              {currency.symbol}{(qty * price).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary Financials */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal Amount:</span>
                  <span className="font-bold text-slate-800">{currency.symbol}{Number(selectedInvoice.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>GST Tax Breakdown:</span>
                  <span className="font-bold text-slate-800">+{currency.symbol}{Number(selectedInvoice.total_tax || 0).toFixed(2)}</span>
                </div>
                {Number(selectedInvoice.discount_amount || 0) > 0 && (
                  <div className="flex justify-between text-purple-600 font-bold">
                    <span>Discount Applied:</span>
                    <span>-{currency.symbol}{Number(selectedInvoice.discount_amount || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-200 flex justify-between text-base font-black text-slate-900">
                  <span>Grand Total Amount:</span>
                  <span className="text-blue-600">{currency.symbol}{Number(selectedInvoice.grand_total || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
              {/* Return / Exchange Quick Action */}
              <button
                type="button"
                onClick={() => {
                  setIsDetailDrawerOpen(false);
                  const returnTargetNumber = selectedInvoice.display_number || selectedInvoice.receipt_number || selectedInvoice.invoice_number;
                  navigate({
                    to: "/pos",
                    search: {
                      tab: "sales_return",
                      return_invoice: returnTargetNumber,
                    } as any,
                  });
                }}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer mb-1 transition-all active:scale-[0.99]"
              >
                <RotateCcw className="w-4 h-4 stroke-[2.5]" />
                <span>Process Sales Return / Exchange Against This Bill</span>
              </button>

              {selectedInvoice.payment_status !== "Paid" && (
                <button
                  onClick={() => {
                    setIsDetailDrawerOpen(false);
                    handleCollectInSalesInvoice(selectedInvoice);
                  }}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer mb-1 transition-all"
                >
                  <CreditCard className="w-4 h-4" /> Open & Collect in Sales Invoice
                </button>
              )}
              <button
                onClick={() => handlePrintThermal(selectedInvoice)}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Thermal Print
              </button>
              <button
                onClick={() => handlePrintA4(selectedInvoice, "ORIGINAL FOR RECIPIENT")}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-4 h-4" /> Original A4
              </button>
              <div className="w-full flex items-center gap-2 mt-1">
                <button
                  onClick={() => handleSendWhatsApp(selectedInvoice)}
                  className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> Send WhatsApp
                </button>
                <button
                  onClick={() => handleSendEmail(selectedInvoice)}
                  className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" /> Send Email
                </button>
              </div>
              <div className="w-full flex items-center gap-2 mt-1">
                <button
                  onClick={() => handlePrintA4(selectedInvoice, "DUPLICATE COPY")}
                  className="flex-1 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" /> Duplicate Copy
                </button>
                <button
                  onClick={() => handlePrintA4(selectedInvoice, "TRIPLICATE COPY")}
                  className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Files className="w-3.5 h-3.5" /> Triplicate Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collect / Settle Payment Modal */}
      {isSettleModalOpen && settlingInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-white/20 rounded-xl">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">{t("Collect Payment & Settle", "Collect Payment & Settle")}</h3>
                  <p className="text-xs text-emerald-100 font-medium">Invoice: {settlingInvoice.invoice_number}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsSettleModalOpen(false);
                  setSettlingInvoice(null);
                }}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Customer & Bill Summary Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Customer:</span>
                  <span className="font-bold text-slate-900">{settlingInvoice.customer_name}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Total Bill Amount:</span>
                  <span className="font-bold text-slate-900">{currency.symbol}{Number(settlingInvoice.grand_total || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Already Paid:</span>
                  <span className="font-bold text-slate-600">{currency.symbol}{Number(settlingInvoice.amount_received || 0).toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between text-sm">
                  <span className="font-black text-slate-900">Remaining Balance Due:</span>
                  <span className="font-black text-rose-600">
                    {currency.symbol}{Math.max(0, Number(settlingInvoice.grand_total || 0) - Number(settlingInvoice.amount_received || 0)).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Payment Mode Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Payment Method</label>
                <div className="grid grid-cols-4 gap-2">
                  {["Cash", "UPI", "Card", "Bank Transfer"].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSettlePaymentMode(mode)}
                      className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all text-center ${settlePaymentMode === mode
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount to Settle */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">Amount Collecting ({currency.symbol})</label>
                  <span className="text-[11px] font-semibold text-emerald-700">
                    {Number(settleAmount) < Math.max(0, Number(settlingInvoice.grand_total || 0) - Number(settlingInvoice.amount_received || 0))
                      ? "⚡ Partial Payment Mode"
                      : "✓ Full Payment Mode"}
                  </span>
                </div>
                <div className="relative mb-2">
                  <span className="absolute left-3 top-2.5 text-sm font-bold text-slate-400">{currency.symbol}</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl pl-7 pr-3 py-2 text-base font-black text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    placeholder="0.00"
                  />
                </div>

                {/* Quick Partial Percentage Buttons */}
                {(() => {
                  const due = Math.max(0, Number(settlingInvoice.grand_total || 0) - Number(settlingInvoice.amount_received || 0));
                  if (due <= 0) return null;
                  return (
                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setSettleAmount(Math.round(due * 0.25))}
                        className="py-1 px-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-all border border-slate-200 text-center"
                      >
                        25% ({currency.symbol}{Math.round(due * 0.25)})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettleAmount(Math.round(due * 0.50))}
                        className="py-1 px-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-all border border-slate-200 text-center"
                      >
                        50% ({currency.symbol}{Math.round(due * 0.50)})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettleAmount(Math.round(due * 0.75))}
                        className="py-1 px-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-all border border-slate-200 text-center"
                      >
                        75% ({currency.symbol}{Math.round(due * 0.75)})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettleAmount(due)}
                        className="py-1 px-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-[11px] font-black transition-all border border-emerald-300 text-center"
                      >
                        100% Full
                      </button>
                    </div>
                  );
                })()}
              </div>

              {/* Or Open in Sales Invoice Option */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsSettleModalOpen(false);
                    handleCollectInSalesInvoice(settlingInvoice);
                  }}
                  className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition-all flex items-center justify-center gap-1.5"
                >
                  <Receipt className="w-3.5 h-3.5" /> Open Full Invoice Workspace & Settle
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsSettleModalOpen(false);
                  setSettlingInvoice(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSettlement}
                disabled={isSubmittingSettle || !settleAmount || Number(settleAmount) <= 0}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-black rounded-xl transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                {isSubmittingSettle
                  ? "Recording..."
                  : Number(settleAmount) < Math.max(0, Number(settlingInvoice.grand_total || 0) - Number(settlingInvoice.amount_received || 0))
                    ? `Record Partial (${formatCurrency(Number(settleAmount))})`
                    : "Confirm & Mark as Paid"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full A4 Printable Invoice Modal */}
      <InvoiceErrorBoundary onReset={() => setIsFullInvoiceOpen(false)}>
        <FullInvoicePrinter
          invoice={fullInvoiceModalData}
          isOpen={isFullInvoiceOpen}
          onClose={() => setIsFullInvoiceOpen(false)}
          autoPrint={autoPrintFullInvoice}
        />
      </InvoiceErrorBoundary>

      {/* In-App Thermal POS Receipt Preview & Print Modal */}
      <ThermalReceiptPreviewModal
        invoice={thermalReceiptModalData}
        isOpen={isThermalReceiptOpen}
        onClose={() => setIsThermalReceiptOpen(false)}
        onSwitchToA4={(inv) => handlePrintA4(inv)}
      />

      {/* E-Way Bill Generation Modal (Whitebooks GSP) */}
      <EWayBillModal
        isOpen={isEwayBillOpen}
        onClose={() => setIsEwayBillOpen(false)}
        invoiceData={ewayBillModalData}
      />

      {/* Send Invoice via WhatsApp Modal */}
      {whatsappInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shadow-inner">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-base tracking-tight leading-tight">{t("Send Invoice on WhatsApp", "Send Invoice on WhatsApp")}</h3>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      isWhatsAppOnline ? "bg-emerald-400/30 text-emerald-100 border border-emerald-300/40" : "bg-rose-400/30 text-rose-100 border border-rose-300/40"
                    }`}>
                      {isWhatsAppOnline ? "● Online" : "● Offline"}
                    </span>
                  </div>
                  <p className="text-emerald-100 text-xs font-medium mt-0.5">Instant PDF bill dispatch via connected gateway</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWhatsappInvoice(null)}
                className="size-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Invoice Summary Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Invoice Number</span>
                  <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    {whatsappInvoice.invoice_number}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Customer / Party</span>
                  <span className="font-bold text-slate-800">{whatsappInvoice.customer_name || "Walk-in Guest"}</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                  <span className="text-slate-500 font-medium">Grand Total</span>
                  <span className="font-black text-emerald-700 text-sm">
                    {formatCurrency(Number(whatsappInvoice.grand_total || 0))}
                  </span>
                </div>
              </div>

              {/* Phone input field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Customer's WhatsApp Mobile Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-xs font-bold text-slate-400 select-none">
                    +91
                  </span>
                  <input
                    type="tel"
                    autoFocus
                    placeholder="Enter 10-digit customer phone number"
                    value={whatsappPhoneInput}
                    onChange={(e) => setWhatsappPhoneInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        dispatchWhatsAppSend(whatsappInvoice, whatsappPhoneInput);
                      }
                    }}
                    className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 transition-colors shadow-2xs placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>
                <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-1 font-medium">
                  {isWhatsAppOnline ? (
                    <>
                      <span className="size-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span>WhatsApp Online: Connected account (+{activeWhatsAppNumber || "Gateway"}) will deliver this invoice.</span>
                    </>
                  ) : (
                    <>
                      <span className="size-2 rounded-full bg-rose-500 shrink-0" />
                      <span className="text-rose-600">WhatsApp Offline: Gateway is not connected. Reconnect before sending.</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setWhatsappInvoice(null)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSendingWhatsApp || !whatsappPhoneInput.trim()}
                onClick={() => dispatchWhatsAppSend(whatsappInvoice, whatsappPhoneInput)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-black rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MessageCircle className="w-4 h-4" />
                {isSendingWhatsApp ? "Sending PDF Bill..." : "Send Bill via WhatsApp"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Invoice via Email Modal */}
      {emailInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shadow-inner">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-base tracking-tight leading-tight">{t("Send Invoice via Email", "Send Invoice via Email")}</h3>
                  <p className="text-blue-100 text-xs font-medium mt-0.5">Dispatches official PDF invoice via organization SMTP</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEmailInvoice(null)}
                className="size-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Invoice Summary Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Invoice Number</span>
                  <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    {emailInvoice.invoice_number}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Customer / Party</span>
                  <span className="font-bold text-slate-800">{emailInvoice.customer_name || "Walk-in Guest"}</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                  <span className="text-slate-500 font-medium">Grand Total</span>
                  <span className="font-black text-blue-700 text-sm">
                    {formatCurrency(Number(emailInvoice.grand_total || 0))}
                  </span>
                </div>
              </div>

              {/* Email input field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Customer Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type="email"
                    autoFocus
                    placeholder="e.g. client@example.com"
                    value={emailAddressInput}
                    onChange={(e) => setEmailAddressInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        dispatchEmailSend(emailInvoice, emailAddressInput);
                      }
                    }}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 transition-colors shadow-2xs placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>
                <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                  <Sparkles className="w-3 h-3 text-blue-500" />
                  The PDF will be attached to an email sent using your organization's configured SMTP server.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEmailInvoice(null)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSendingEmail || !emailAddressInput.trim() || !emailAddressInput.includes("@")}
                onClick={() => dispatchEmailSend(emailInvoice, emailAddressInput)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-black rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                {isSendingEmail ? "Sending PDF..." : "Send Invoice Email"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Cancellation Modal (Org Admin) */}
      {isCancelModalOpen && cancellingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-rose-600 to-red-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shadow-inner">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-base tracking-tight leading-tight">Cancel Invoice #{cancellingInvoice.invoice_number}</h3>
                  <p className="text-rose-100 text-xs font-medium mt-0.5">Organization Admin Authorization Required</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isCancelling) {
                    setIsCancelModalOpen(false);
                    setCancellingInvoice(null);
                  }
                }}
                className="size-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Warning Callout */}
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Cancelling this invoice will:</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px] text-rose-800">
                    <li>Mark invoice <strong>{cancellingInvoice.invoice_number}</strong> as <span className="font-semibold text-rose-600">Cancelled</span>.</li>
                    <li>Automatically restore all line item quantities back into product stock inventory.</li>
                    <li>Allow you to re-issue or create a new invoice under the same number <strong>{cancellingInvoice.invoice_number}</strong>.</li>
                  </ul>
                </div>
              </div>

              {/* Invoice Summary */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Customer / Party:</span>
                  <span className="font-bold text-slate-800">{cancellingInvoice.customer_name || "Walk-in Guest"}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Invoice Date:</span>
                  <span className="font-bold text-slate-700">{cancellingInvoice.invoice_date}</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                  <span className="text-slate-500 font-medium">Total Amount:</span>
                  <span className="font-black text-slate-900 text-sm">{formatCurrency(cancellingInvoice.grand_total)}</span>
                </div>
              </div>

              {/* Products to Restock */}
              {cancellingInvoice.items && cancellingInvoice.items.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Products Returned to Stock ({cancellingInvoice.items.length} items):
                  </label>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1.5 max-h-36 overflow-y-auto">
                    {cancellingInvoice.items.map((it: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-200/50 last:border-none">
                        <span className="font-medium text-slate-800 truncate max-w-[240px]">{it.product_name || it.name || "Item"}</span>
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                          +{it.quantity || 1} Restocked
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cancellation Reason */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Cancellation Reason <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="e.g., Customer cancelled order / Price dispute / Data entry mistake"
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-end gap-2">
              <button
                type="button"
                disabled={isCancelling}
                onClick={() => {
                  setIsCancelModalOpen(false);
                  setCancellingInvoice(null);
                }}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
              >
                Keep Invoice
              </button>

              <button
                type="button"
                disabled={isCancelling}
                onClick={() => handleConfirmCancellation(false)}
                className="w-full sm:w-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                <span>{isCancelling ? "Cancelling..." : "Cancel Invoice Only"}</span>
              </button>

              <button
                type="button"
                disabled={isCancelling}
                onClick={() => handleConfirmCancellation(true)}
                className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{isCancelling ? "Processing..." : "Cancel & Re-open in Sales"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standardized Return & Cancellation Voucher Modal with Strict Print Isolation */}
      <StandardVoucherModal
        isOpen={isVoucherModalOpen}
        onClose={() => setIsVoucherModalOpen(false)}
        voucher={activeVoucher}
      />

      {/* Permanent Delete Invoice Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-100 dark:bg-rose-900/40 text-rose-600 rounded-xl">
                <Trash2 className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">Delete Invoice Permanently?</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  <strong>{deleteTarget.invoice_number}</strong> will be removed from this workspace. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl text-[11px] text-rose-700 dark:text-rose-300 space-y-1">
              <p className="font-bold">Warning:</p>
              <p>• All line items, payments, and returns attached to this invoice will also be deleted.</p>
              <p>• Any e-Invoice / IRN already filed for this document cannot be un-filed automatically — verify before proceeding if GST compliance applies.</p>
              <p>• Use <strong>Cancel Invoice</strong> (above) instead of Delete if you only need to void it and keep an audit trail.</p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Keep Invoice
              </button>
              <button
                type="button"
                disabled={isDeletingInvoice}
                onClick={handleDeleteInvoice}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-lg transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {isDeletingInvoice ? "Deleting..." : "Delete Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
