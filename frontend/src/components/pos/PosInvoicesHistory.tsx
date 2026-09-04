import React, { useState, useEffect } from "react";
import {
  Receipt,
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
  Truck
} from "lucide-react";
import { posApi, invoicesApi, resolveImageUrl } from "@/lib/api-client";
import { FullInvoicePrinter } from "./FullInvoicePrinter";
import { EWayBillModal } from "./EWayBillModal";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { useNavigate } from "@tanstack/react-router";

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
  payment_status: "Paid" | "Partial" | "Unpaid";
  subtotal: number;
  total_tax: number;
  discount_amount?: number;
  grand_total: number;
  amount_received?: number;
  is_printed_thermal?: boolean;
  is_printed_a4?: boolean;
  is_whatsapp_sent?: boolean;
  items?: any[];
  [key: string]: any;
}

export function PosInvoicesHistory() {
  const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();
  const currentTenantId = (tenant as any)?.raw?.tenant_id || (tenant as any)?.tenant_id || tenant?.id || "default";
  const storageKey = `pos_saved_invoices_${currentTenantId}`;

  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<LocalInvoiceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [printFilter, setPrintFilter] = useState<string>("All");

  const handleCollectInSalesInvoice = (inv: LocalInvoiceRecord) => {
    try {
      sessionStorage.setItem("pos_collect_invoice", JSON.stringify(inv));
      window.dispatchEvent(new Event("pos_collect_invoice_trigger"));
    } catch (e) { }
    navigate({ to: "/pos", search: { tab: "sales", collect_id: inv.id } as any });
  };

  // Selected Invoice for Detailed View Drawer & PDF Printer
  const [selectedInvoice, setSelectedInvoice] = useState<LocalInvoiceRecord | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState<boolean>(false);
  const [fullInvoiceModalData, setFullInvoiceModalData] = useState<any>(null);
  const [isFullInvoiceOpen, setIsFullInvoiceOpen] = useState<boolean>(false);
  const [autoPrintFullInvoice, setAutoPrintFullInvoice] = useState<boolean>(false);
  const [ewayBillModalData, setEwayBillModalData] = useState<any | null>(null);
  const [isEwayBillOpen, setIsEwayBillOpen] = useState<boolean>(false);

  // Settlement Modal State
  const [isSettleModalOpen, setIsSettleModalOpen] = useState<boolean>(false);
  const [settlingInvoice, setSettlingInvoice] = useState<LocalInvoiceRecord | null>(null);
  const [settlePaymentMode, setSettlePaymentMode] = useState<string>("Cash");
  const [settleAmount, setSettleAmount] = useState<number | "">("");
  const [isSubmittingSettle, setIsSubmittingSettle] = useState<boolean>(false);

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

  // Load invoices from Backend API (ERP Invoices + POS Transactions) strictly scoped to active tenant
  const loadInvoices = async () => {
    setLoading(true);
    const localRecords: LocalInvoiceRecord[] = [];
    const remoteRecords: LocalInvoiceRecord[] = [];

    try {
      // 1. Gather ONLY active tenant's scoped local storage invoices
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            list.forEach((inv) => {
              if (inv && (inv.id || inv.invoice_number)) {
                if (!inv.tenant_id || inv.tenant_id === currentTenantId || currentTenantId === "default") {
                  localRecords.push(inv);
                }
              }
            });
          }
        }
      } catch (e) {}

      // 2. Fetch remote ERP Invoices from Backend API
      try {
        const apiRes: any = await invoicesApi.listInvoices({ page_size: 100 }).catch(() => null);
        const invoiceItems = apiRes?.items || apiRes?.data?.items || apiRes?.data || (Array.isArray(apiRes) ? apiRes : []);
        if (Array.isArray(invoiceItems) && invoiceItems.length > 0) {
          invoiceItems.forEach((inv: any) => {
            const lines = (inv.lines || []).map((l: any) => ({
              id: l.id,
              product_name: l.product_name || l.item_name || "Item",
              quantity: Number(l.quantity) || 1,
              unit_price: Number(l.unit_price) || 0,
              mrp: Number(l.mrp) || Number(l.unit_price) || 0,
              hsn_code: l.hsn_code || "",
              tax_rate: Number(l.tax_rate) || 0,
              discount_value: Number(l.discount_value) || 0,
            }));

            const linesSubtotal = lines.reduce((s: number, l: any) => s + l.quantity * l.unit_price, 0);
            const linesTax = lines.reduce((s: number, l: any) => s + l.quantity * l.unit_price * (l.tax_rate / 100), 0);
            const calculatedGrandTotal = lines.length > 0 ? linesSubtotal + linesTax : Number(inv.total_amount || 0);

            const finalSubtotal = linesSubtotal > 0 ? linesSubtotal : Number(inv.subtotal) || Number(inv.total_amount) * 0.85;
            const finalTax = linesTax > 0 ? linesTax : Number(inv.tax_amount) || 0;
            const finalGrandTotal = lines.length > 0 ? calculatedGrandTotal : Number(inv.total_amount || 0);

            const rawStatus = String(inv.status || "").toLowerCase();
            const amtPaid = Number(inv.amount_paid) || 0;
            const isPaid = rawStatus === "paid" || amtPaid >= finalGrandTotal - 0.05;
            const isPartial = rawStatus === "partial" || rawStatus === "partially_paid" || (amtPaid > 0 && amtPaid < finalGrandTotal - 0.05);

            remoteRecords.push({
              id: inv.id,
              invoice_number: inv.invoice_number || `INV-${String(inv.id).slice(0, 6).toUpperCase()}`,
              customer_name: inv.customer_name || inv.customer?.name || "Walk-in Customer",
              customer_phone: inv.customer?.phone || inv.customer_phone || "",
              customer_gstin: inv.customer?.tax_number || inv.customer_gstin || "",
              sales_executive: inv.created_by_name || "Sales Executive",
              sales_points_earned: Math.floor(finalGrandTotal / 100),
              invoice_date: inv.invoice_date || new Date().toISOString().slice(0, 10),
              due_date: inv.due_date || "",
              payment_mode: inv.payment_terms || inv.payment_method || "Cash",
              payment_status: isPaid ? "Paid" : isPartial ? "Partial" : "Unpaid",
              subtotal: finalSubtotal,
              total_tax: finalTax,
              discount_amount: Number(inv.discount_amount) || 0,
              grand_total: finalGrandTotal,
              amount_received: isPaid ? finalGrandTotal : amtPaid,
              print_status: "A4 PDF Generated",
              items: lines,
            });
          });
        }
      } catch (e) {
        console.warn("invoicesApi.listInvoices error:", e);
      }

      // 3. Fetch POS transaction checkout history from Backend API
      try {
        const posHist: any = await posApi.getHistory({ limit: 100 }).catch(() => null);
        const posItems = posHist?.items || posHist?.data?.items || posHist?.data || (Array.isArray(posHist) ? posHist : []);
        if (Array.isArray(posItems) && posItems.length > 0) {
          posItems.forEach((tx: any) => {
            const receiptNum = tx.receipt_number || (tx.id ? `REC-${String(tx.id).slice(0, 6).toUpperCase()}` : `REC-${Date.now()}`);
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

            remoteRecords.push({
              id: tx.id,
              invoice_number: receiptNum,
              customer_name: tx.customer?.name || "Walk-in Guest",
              customer_phone: tx.customer?.phone || "",
              customer_gstin: tx.customer?.gst_number || "",
              sales_executive: tx.cashier?.full_name || "POS Cashier",
              sales_points_earned: Math.floor(txGrand / 100),
              invoice_date: tx.created_at ? new Date(tx.created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
              due_date: "",
              payment_mode: tx.payments && tx.payments.length > 0 ? tx.payments.map((p: any) => p.payment_method).join(", ") : "Cash",
              payment_status: isPaid ? "Paid" : isCredit ? "Unpaid" : "Partial",
              subtotal: txSubtotal,
              total_tax: txTax,
              discount_amount: Number(tx.discount_amount) || 0,
              grand_total: txGrand,
              amount_received: isPaid ? txGrand : tx.payments ? tx.payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0) : 0,
              print_status: "Thermal Printed",
              items: txLines,
            });
          });
        }
      } catch (e) {
        console.warn("posApi.getHistory error:", e);
      }

      // Merge local and remote invoice records
      const mergedMap = new Map<string, LocalInvoiceRecord>();
      remoteRecords.forEach((inv) => {
        if (inv && inv.invoice_number) {
          mergedMap.set(inv.invoice_number, inv);
        }
      });

      localRecords.forEach((inv) => {
        if (inv && inv.invoice_number) {
          const remote = mergedMap.get(inv.invoice_number);
          if (remote) {
            if (inv.items && inv.items.length > 0) {
              remote.items = inv.items;
              remote.subtotal = inv.subtotal;
              remote.total_tax = inv.total_tax;
              remote.grand_total = inv.grand_total;
            }
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
          } else {
            mergedMap.set(inv.invoice_number, inv);
          }
        }
      });

      const seenNumbers = new Set<string>();
      const dedupedList: LocalInvoiceRecord[] = [];
      const sorted = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.invoice_date || 0).getTime() - new Date(a.invoice_date || 0).getTime()
      );

      for (const inv of sorted) {
        if (inv.items && inv.items.length > 0) {
          const sub = inv.items.reduce((s: number, it: any) => s + Number(it.quantity || 1) * Number(it.unit_price || 0), 0);
          const tax = inv.items.reduce((s: number, it: any) => s + Number(it.quantity || 1) * Number(it.unit_price || 0) * (Number(it.tax_rate || 0) / 100), 0);
          if (sub > 0) {
            inv.subtotal = sub;
            inv.total_tax = tax;
            inv.grand_total = sub + tax;
            if (inv.payment_status === "Paid") {
              inv.amount_received = inv.grand_total;
            }
          }
        }
        const key = `${inv.invoice_number}`;
        if (!seenNumbers.has(key)) {
          seenNumbers.add(key);
          dedupedList.push(inv);
        }
      }

      setInvoices(dedupedList);
    } catch (err) {
      console.error("Error loading invoice history:", err);
      if (localRecords.length > 0) {
        setInvoices(localRecords);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
    const handleSync = () => loadInvoices();
    window.addEventListener("pos_invoices_updated", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("pos_invoices_updated", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, [currentTenantId]);

  // Update print status of an invoice locally & persist
  const updateInvoicePrintStatus = (invNum: string, newStatus: "Thermal Printed" | "A4 PDF Generated") => {
    setInvoices((prev) => {
      const updated = prev.map((inv) => (inv.invoice_number === invNum ? { ...inv, print_status: newStatus } : inv));
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
  };

  // Open A4 PDF Printer Modal
  const handlePrintA4 = async (inv: LocalInvoiceRecord) => {
    let fullInvRecord = inv;
    if (inv.id && inv.id.length > 20) {
      try {
        const remote: any = await invoicesApi.getInvoice(inv.id);
        if (remote) {
          fullInvRecord = {
            ...inv,
            customer_name: remote.customer_name || remote.customer?.name || inv.customer_name,
            customer_phone: remote.customer_phone || remote.customer?.phone || inv.customer_phone,
            customer_gstin: remote.customer_gstin || remote.customer?.tax_number || inv.customer_gstin,
            subtotal: Number(remote.subtotal) || (Number(remote.total_amount) - Number(remote.tax_amount || 0)),
            total_tax: Number(remote.tax_amount) || 0,
            discount_amount: Number(remote.discount_amount) || 0,
            grand_total: Number(remote.total_amount) || inv.grand_total,
            amount_received: Number(remote.amount_paid) || (String(remote.status).toLowerCase() === "paid" ? Number(remote.total_amount) : inv.amount_received),
            payment_status: String(remote.status).toLowerCase() === "paid" ? "Paid" : inv.payment_status,
            items: (remote.lines && remote.lines.length > 0)
              ? remote.lines.map((l: any) => ({
                id: l.id,
                product_name: l.product_name || l.item_name || "Item",
                quantity: Number(l.quantity) || 1,
                unit_price: Number(l.unit_price) || 0,
                mrp: Number(l.mrp) || Number(l.unit_price) || 0,
                hsn_code: l.hsn_code || "",
                tax_rate: Number(l.tax_rate) || 0,
                discount_value: Number(l.discount_value) || 0,
              }))
              : inv.items,
          };
        }
      } catch (e) {
        console.warn("Could not fetch remote invoice detail, using cached:", e);
      }
    }

    setFullInvoiceModalData({
      invoice_number: fullInvRecord.invoice_number,
      customerName: fullInvRecord.customer_name,
      customerPhone: fullInvRecord.customer_phone,
      customerGST: fullInvRecord.customer_gstin,
      sales_executive: fullInvRecord.sales_executive,
      invoice_date: fullInvRecord.invoice_date,
      due_date: fullInvRecord.due_date,
      payment_method: fullInvRecord.payment_mode,
      payment_status: fullInvRecord.payment_status,
      subtotal: fullInvRecord.subtotal,
      taxable_value: (fullInvRecord as any).taxable_value,
      tax_amount: fullInvRecord.total_tax,
      discount_amount: fullInvRecord.discount_amount,
      grand_total: fullInvRecord.grand_total,
      amount_received: fullInvRecord.payment_status === "Paid" ? fullInvRecord.grand_total : fullInvRecord.amount_received,
      items: fullInvRecord.items,
      gst_type: (fullInvRecord as any).gst_type,
      is_interstate: (fullInvRecord as any).is_interstate,
    });
    setAutoPrintFullInvoice(true);
    setIsFullInvoiceOpen(true);
    updateInvoicePrintStatus(inv.invoice_number, "A4 PDF Generated");
    toast.success(`A4 PDF Invoice generated for ${inv.invoice_number}`);
  };

  // Send invoice PDF to customer's WhatsApp
  const handleSendWhatsApp = async (inv: LocalInvoiceRecord) => {
    toast.loading(`Sending ${inv.invoice_number}...`, { id: `wa-${inv.id}` });
    try {
      const result = await invoicesApi.sendInvoiceToWhatsApp(inv.id);
      if (result.error) {
        toast.error(`WhatsApp send failed: ${result.error}`, { id: `wa-${inv.id}` });
      } else {
        toast.success(`Invoice ${inv.invoice_number} sent via WhatsApp!`, { id: `wa-${inv.id}` });
      }
    } catch (err: any) {
      toast.error(`WhatsApp send failed: ${err.message || "Unknown error"}`, { id: `wa-${inv.id}` });
    }
  };

  // Open Thermal Receipt Printer Window
  const handlePrintThermal = (inv: LocalInvoiceRecord) => {
    const printWindow = window.open("", "_blank", "width=380,height=600");
    if (!printWindow) {
      toast.error("Please allow popups to enable Thermal Receipt printing.");
      return;
    }

    const activeBillingGst = getActiveBillingGst(tenant?.id);
    const orgName = activeBillingGst?.trade_name || activeBillingGst?.legal_name || tenant?.name || "BusinessOS Store";
    const rawLogo = activeBillingGst?.logo_url || tenant?.logo_url || (tenant as any)?.raw?.logo_url || "";
    const orgLogo = resolveImageUrl(rawLogo);
    const orgGstin = activeBillingGst?.gstin || (tenant as any)?.tax_id || (tenant as any)?.gstin || (tenant as any)?.raw?.tax_id || "37AAAAA0000A1Z5";
    const orgAddress = activeBillingGst?.address || (tenant as any)?.address || (tenant as any)?.raw?.address || "Main Branch Store";
    const orgPhone = activeBillingGst?.phone || (tenant as any)?.phone || (tenant as any)?.raw?.phone || "";
    const googleReviewUrl = activeBillingGst?.google_review_url || (tenant as any)?.raw?.google_review_url || (activeBillingGst?.google_place_id ? `https://search.google.com/local/writereview?placeid=${activeBillingGst.google_place_id}` : null);
    const showReviewQR = activeBillingGst?.google_review_enabled !== false && Boolean(googleReviewUrl);

    const itemsHtml = (inv.items || [])
      .map(
        (it) => `
      <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:11px;">
        <span style="flex:1;">${it.product_name} x ${it.quantity}</span>
        <span style="font-weight:bold;">₹${(Number(it.quantity || 1) * Number(it.unit_price || 0)).toFixed(2)}</span>
      </div>
    `
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Thermal Receipt - ${inv.invoice_number}</title>
                  <style>
                    body { font-family: 'Courier New', Courier, monospace; width: 280px; margin: 0 auto; padding: 10px; color: #000; }
                    h2 { text-align: center; margin: 0 0 4px 0; font-size: 16px; }
                    p { text-align: center; margin: 2px 0; font-size: 10px; }
                    .line { border-bottom: 1px dashed #000; margin: 8px 0; }
                    .total { display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin-top: 6px; }
                  </style>
                </head>
                <body>
                  ${orgLogo ? `<div style="text-align:center; margin-bottom: 6px;"><img src="${orgLogo}" alt="${orgName}" style="max-height: 40px; max-width: 140px; object-fit: contain; filter: grayscale(100%) contrast(150%);" /></div>` : ""}
                  <h2>${orgName}</h2>
                  <p>${orgAddress}${orgPhone ? ` · Tel: ${orgPhone}` : ""}</p>
                  <p>GSTIN: ${orgGstin}</p>
                  <p>Sales Invoice #: ${inv.invoice_number}</p>
                  <p>Date: ${inv.invoice_date} | Rep: ${inv.sales_executive || "Admin"}</p>
                  <div class="line"></div>
                  <div style="font-size:11px; margin-bottom:4px;"><b>Customer:</b> ${inv.customer_name} (${inv.customer_phone || "N/A"})</div>
                  <div class="line"></div>
                  ${itemsHtml}
          <div class="line"></div>
          <div style="display:flex; justify-content:space-between; font-size:11px;">
            <span>Subtotal:</span><span>₹${Number(inv.subtotal || 0).toFixed(2)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:11px;">
            <span>GST Tax:</span><span>₹${Number(inv.total_tax || 0).toFixed(2)}</span>
          </div>
          <div class="total">
            <span>GRAND TOTAL:</span>
            <span>₹${Number(inv.grand_total || 0).toFixed(2)}</span>
                  </div>
                  <div style="display:flex; justify-content:space-between; font-size:10px; margin-top:4px;">
                    <span>${inv.payment_status === "Unpaid" ? "Payment Status: Unpaid / Credit" : `Payment Mode: ${inv.payment_mode || "Cash"}`}</span>
                    <span>Paid: ₹${Number(inv.amount_received || 0).toFixed(2)}</span>
                  </div>
          <div class="line"></div>
          <p style="margin-top:10px; font-weight:bold; text-align:center;">*** THANK YOU FOR YOUR BUSINESS ***</p>
          ${showReviewQR && googleReviewUrl ? `
          <div style="text-align:center; margin: 10px 0 6px 0; padding-top: 8px; border-top: 1px dashed #000;">
            <div style="font-size:10px; font-weight:bold; letter-spacing: 2px;">★ ★ ★ ★ ★</div>
            <div style="font-size:9.5px; font-weight:bold; margin-bottom: 4px;">RATE US ON GOOGLE</div>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=0&data=${encodeURIComponent(googleReviewUrl)}" alt="Google Review QR" style="width:75px; height:75px; object-fit:contain; border: 1px solid #000; padding: 2px; margin: 2px auto;" />
            <div style="font-size:8.5px; margin-top:2px;">Scan to share your 5-star review!</div>
          </div>
          ` : ""}
          <script>
            window.onload = function() { window.print(); setTimeout(function(){ window.close(); }, 500); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    updateInvoicePrintStatus(inv.invoice_number, "Thermal Printed");
    toast.success(`Thermal Receipt sent for ${inv.invoice_number}`);
  };

  // Filtered invoices
  const filteredInvoices = invoices.filter((inv) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      inv.invoice_number.toLowerCase().includes(q) ||
      inv.customer_name.toLowerCase().includes(q) ||
      (inv.customer_phone && inv.customer_phone.includes(q)) ||
      (inv.sales_executive && inv.sales_executive.toLowerCase().includes(q));

    const matchesStatus = statusFilter === "All" || inv.payment_status === statusFilter;
    const matchesPrint = printFilter === "All" || inv.print_status === printFilter;

    return matchesSearch && matchesStatus && matchesPrint;
  });

  // Calculate Metrics
  const totalRevenue = invoices.reduce((acc, curr) => acc + curr.grand_total, 0);
  const paidCount = invoices.filter((i) => i.payment_status === "Paid").length;
  const thermalCount = invoices.filter((i) => i.print_status === "Thermal Printed").length;
  const pdfCount = invoices.filter((i) => i.print_status === "A4 PDF Generated").length;

  return (
    <div className="space-y-6 mx-auto min-h-screen pb-24">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Generated Invoices History</h2>
          <p className="text-sm text-muted-foreground mt-1">
            View, track print status, and manage all store sales invoices in real-time
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadInvoices}
            className="bg-white hover:bg-slate-50 text-slate-700 font-semibold px-3 h-8 text-xs rounded-lg shadow-sm border border-slate-200 flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Sales Invoices</span>
            <Receipt className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{invoices.length}</div>
          <div className="text-[11px] text-emerald-600 font-bold mt-1">100% Synced & Logged</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Billed Revenue</span>
            <CreditCard className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{formatCurrency(totalRevenue)}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">Avg Bill: {formatCurrency(invoices.length ? totalRevenue / invoices.length : 0)}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Payment Status</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-slate-900">{paidCount}</span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Paid
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">{invoices.length - paidCount} Unpaid / Credit</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Print Status Breakdown</span>
            <Printer className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200">
              {thermalCount} 🖨️ Thermal
            </span>
            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200">
              {pdfCount} 📄 A4 PDF
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Ready for re-printing anytime</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Invoice #, Customer Name, Phone, Sales Rep..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
            <Filter className="w-3.5 h-3.5" /> Filters:
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Payment Statuses</option>
            <option value="Paid">Paid</option>
            <option value="Partial">Partial</option>
            <option value="Unpaid">Unpaid / Credit</option>
          </select>

          <select
            value={printFilter}
            onChange={(e) => setPrintFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Print Statuses</option>
            <option value="Thermal Printed">Thermal Printed</option>
            <option value="A4 PDF Generated">A4 PDF Generated</option>
            <option value="Pending Print">Pending Print</option>
          </select>
        </div>
      </div>

      {/* Main Invoices Table */}
      <div className="bg-card rounded-2xl border border-border/70 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">Invoice #</th>
                <th className="px-4 py-3 text-left">Date & Time</th>
                <th className="px-4 py-3 text-left">Customer / Party</th>
                <th className="px-4 py-3 text-left">Sales Representative</th>
                <th className="px-4 py-3 text-left">Payment</th>
                <th className="px-4 py-3 text-left">Print Status</th>
                <th className="px-4 py-3 text-right font-bold">Total Amount</th>
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
                filteredInvoices.map((inv) => (
                  <tr key={inv.invoice_number} className="hover:bg-slate-50/80 transition-colors">
                    {/* Invoice Number */}
                    <td className="px-4 py-3 font-mono font-bold text-blue-600 flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-blue-500" />
                      {inv.invoice_number}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex items-center gap-1 text-[11px]">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {inv.invoice_date}
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800">{inv.customer_name}</div>
                      {inv.customer_phone && <div className="text-[10px] text-slate-400">{inv.customer_phone}</div>}
                    </td>

                    {/* Sales Representative */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-slate-800 font-semibold">
                        <User className="w-3 h-3 text-slate-400" />
                        {inv.sales_executive || "Sales Executive"}
                      </div>
                      {inv.sales_points_earned !== undefined && inv.sales_points_earned > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                          <Award className="w-2.5 h-2.5 text-amber-500" /> +{inv.sales_points_earned} Pts
                        </span>
                      )}
                    </td>

                    {/* Payment Mode & Status */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${inv.payment_status === "Paid"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : inv.payment_status === "Partial"
                                  ? "bg-amber-50 text-amber-800 border border-amber-300 font-black"
                                  : "bg-rose-50 text-rose-700 border border-rose-200"
                              }`}
                          >
                            {inv.payment_status === "Partial" ? "Partially Paid" : inv.payment_status}
                          </span>
                          {inv.payment_status !== "Unpaid" && (
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                              {inv.payment_mode || "Cash"}
                            </span>
                          )}
                        </div>
                        {inv.payment_status === "Partial" && (
                          <div className="text-[10px] font-semibold flex items-center gap-1.5 whitespace-nowrap">
                            <span className="text-emerald-700">Paid: {formatCurrency(inv.amount_received || 0)}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-rose-600 font-bold">Due: {formatCurrency(Math.max(0, inv.grand_total - (inv.amount_received || 0)))}</span>
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
                    <td className="px-4 py-3 text-right">
                      <div className="font-black text-slate-900 text-sm">
                        {formatCurrency(inv.grand_total)}
                      </div>
                      {inv.payment_status === "Partial" && (
                        <div className="text-[10px] text-rose-600 font-bold">
                          Due: {formatCurrency(Math.max(0, inv.grand_total - (inv.amount_received || 0)))}
                        </div>
                      )}
                    </td>

                    {/* Action Buttons */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Collect Payment / Settle Button for Unpaid & Partial Invoices */}
                        {inv.payment_status !== "Paid" && (
                          <button
                            title={inv.payment_status === "Partial" ? `Collect Remaining Due (${formatCurrency(Math.max(0, inv.grand_total - (inv.amount_received || 0)))})` : "Open in Sales Invoice & Collect"}
                            onClick={() => handleCollectInSalesInvoice(inv)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1 text-[11px] font-black cursor-pointer animate-pulse whitespace-nowrap"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>
                              {inv.payment_status === "Partial"
                                ? `Collect Due (${formatCurrency(Math.max(0, inv.grand_total - (inv.amount_received || 0)))})`
                                : "Collect"}
                            </span>
                          </button>
                        )}

                        {/* View Details Drawer */}
                        <button
                          title="View Invoice Details"
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setIsDetailDrawerOpen(true);
                          }}
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Send via WhatsApp */}
                        <button
                          title="Send Invoice via WhatsApp"
                          onClick={() => handleSendWhatsApp(inv)}
                          className="p-1.5 text-slate-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors border border-slate-200 flex items-center gap-1 text-[10px] font-bold"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                          <span className="hidden lg:inline">WhatsApp</span>
                        </button>

                        {/* Thermal Print */}
                        <button
                          title="Print Thermal 80mm Receipt"
                          onClick={() => handlePrintThermal(inv)}
                          className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors border border-slate-200 flex items-center gap-1 text-[10px] font-bold"
                        >
                          <Printer className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="hidden lg:inline">Thermal</span>
                        </button>

                        {/* Download / Print A4 PDF */}
                        <button
                          title="Download / Print A4 Tax Invoice PDF"
                          onClick={() => handlePrintA4(inv)}
                          className="p-1.5 text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors border border-slate-200 flex items-center gap-1 text-[10px] font-bold"
                        >
                          <FileText className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="hidden lg:inline">A4 PDF</span>
                        </button>

                        {/* Generate E-Way Bill */}
                        <button
                          title="Generate E-Way Bill (Whitebooks GSP)"
                          onClick={() => {
                            let cachedEwb: any = null;
                            try {
                              const raw = localStorage.getItem(`ewb_${inv.invoice_number}`);
                              if (raw) cachedEwb = JSON.parse(raw);
                            } catch { }

                            setEwayBillModalData({
                              invoice_id: inv.id,
                              invoice_number: inv.invoice_number,
                              invoice_date: inv.invoice_date,
                              total_amount: Number(inv.grand_total || 0),
                              cgst_amount: Number(inv.total_tax || 0) / 2,
                              sgst_amount: Number(inv.total_tax || 0) / 2,
                              to_customer_name: inv.customer_name,
                              to_gstin: inv.customer_gstin || "URP",
                              items: inv.items || [],
                              eway_bill_number: cachedEwb?.eway_bill_number || inv.eway_bill_number,
                              eway_bill_data: cachedEwb,
                            });
                            setIsEwayBillOpen(true);
                          }}
                          className={`p-1.5 rounded-lg transition-colors border flex items-center gap-1 text-[10px] font-bold ${localStorage.getItem(`ewb_${inv.invoice_number}`)
                              ? 'text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100'
                              : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50 border-slate-200'
                            }`}
                        >
                          <Truck className={`w-3.5 h-3.5 ${localStorage.getItem(`ewb_${inv.invoice_number}`) ? 'text-emerald-600' : 'text-blue-600'}`} />
                          <span className="hidden xl:inline">
                            {localStorage.getItem(`ewb_${inv.invoice_number}`) ? 'View E-Way Bill' : 'E-Way Bill'}
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Details Drawer Modal */}
      {isDetailDrawerOpen && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl overflow-y-auto flex flex-col border-l border-slate-200">
            {/* Drawer Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-blue-400" />
                  <h2 className="text-lg font-extrabold">{selectedInvoice.invoice_number}</h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">Generated on {selectedInvoice.invoice_date}</p>
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
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Customer / Billed To</span>
                  <div className="font-extrabold text-slate-900 text-sm">{selectedInvoice.customer_name}</div>
                  <div className="text-xs text-slate-500">{selectedInvoice.customer_phone || "Walk-in Guest"}</div>
                  {selectedInvoice.customer_gstin && (
                    <div className="text-[10px] font-mono text-blue-600 font-bold mt-1">GSTIN: {selectedInvoice.customer_gstin}</div>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Sales Representative</span>
                  <div className="font-extrabold text-slate-900 text-sm">{selectedInvoice.sales_executive}</div>
                  <div className="text-xs text-emerald-600 font-bold mt-1">
                    Points Earned: +{selectedInvoice.sales_points_earned || 0} Pts
                  </div>
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
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> Thermal Print
              </button>
              <button
                onClick={() => handlePrintA4(selectedInvoice)}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5"
              >
                <FileText className="w-4 h-4" /> Download A4 PDF
              </button>
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
                  <h3 className="text-base font-black">Collect Payment & Settle</h3>
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
      <FullInvoicePrinter
        invoice={fullInvoiceModalData}
        isOpen={isFullInvoiceOpen}
        onClose={() => setIsFullInvoiceOpen(false)}
        autoPrint={autoPrintFullInvoice}
      />

      {/* E-Way Bill Generation Modal (Whitebooks GSP) */}
      <EWayBillModal
        isOpen={isEwayBillOpen}
        onClose={() => setIsEwayBillOpen(false)}
        invoiceData={ewayBillModalData}
      />
    </div>
  );
}
