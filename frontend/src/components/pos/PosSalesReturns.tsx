import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  RotateCcw,
  Search,
  Plus,
  Printer,
  Eye,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  Calendar,
  Layers,
  FileText,
  X,
  RefreshCw,
  ShoppingBag,
  DollarSign,
  TrendingDown,
  User,
  Phone,
  ShieldCheck,
  Package,
  Trash2,
  Check,
  ChevronRight,
  ArrowLeft,
  Wallet,
  Receipt,
  CreditCard,
  QrCode,
  Sparkles,
} from "lucide-react";
import { invoicesApi, posApi, salesReturnsApi } from "@/lib/api-client";
import { useTenant } from "@/contexts/tenant-context";
import { useCurrency } from "@/hooks/use-currency";
import { PaginationControl } from "@/components/ui/PaginationControl";
import { StandardVoucherModal, StandardVoucherData } from "./StandardVoucherModal";
import { printThermalVoucher } from "@/lib/print-helper";

export interface SalesReturnItem {
  id: string;
  product_id?: string;
  product_name: string;
  sku?: string;
  hsn_code?: string;
  purchased_qty: number;
  returned_qty: number;
  unit_price: number;
  tax_rate: number;
  discount_amount: number;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  reason: string;
  restock_disposition: "restock" | "damaged" | "inspection";
}

export interface ExchangeProductItem {
  id: string;
  product_id?: string;
  product_name: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount_amount: number;
  total_amount: number;
}

export interface SalesReturnRecord {
  id: string;
  return_number: string;
  return_date: string;
  original_invoice_no: string;
  original_invoice_date?: string;
  customer_name: string;
  customer_phone?: string;
  customer_gstin?: string;
  settlement_method: "cash" | "upi" | "store_credit" | "credit_note" | "exchange";
  settlement_status: "COMPLETED" | "PENDING" | "CREDITED";
  subtotal: number;
  tax_amount: number;
  total_refund: number;
  restock_count: number;
  total_items_returned: number;
  notes?: string;
  cashier_name?: string;
  created_at: string;
  items: SalesReturnItem[];
  // For exchanges
  is_exchange?: boolean;
  credit_note_number?: string;
  debit_note_number?: string;
  exchange_invoice_number?: string;
  exchange_total?: number;
  difference?: number;
  exchange_items?: ExchangeProductItem[];
}

const RETURN_REASONS = [
  "Defective / Damaged Item",
  "Customer Changed Mind",
  "Wrong Size / Fit Mismatch",
  "Wrong Item Delivered / Billed",
  "Quality / Performance Issue",
  "Expired / Shelf-life Issue",
  "Price / Billing Discrepancy",
  "Other",
];

export function PosSalesReturns({ tab }: { tab?: string }) {
  const { tenant } = useTenant();
  const currentTenantId = (tenant as any)?.raw?.tenant_id || (tenant as any)?.tenant_id || tenant?.id || "default";
  const currentCompanyId = tenant?.id || (tenant as any)?.raw?.id || (tenant as any)?.company_id || "default";
  const { formatCurrency } = useCurrency();

  const storageKey = `pos_sales_returns_${currentTenantId}_${currentCompanyId}`;

  // View state: "register" | "return" | "exchange"
  const [activeTab, setActiveTab] = useState<"register" | "return" | "exchange">("register");
  const [returnsList, setReturnsList] = useState<SalesReturnRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters for Register
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "this_week" | "this_month">("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Modal state
  const [selectedReturnSlip, setSelectedReturnSlip] = useState<SalesReturnRecord | null>(null);

  // ── "Create Return / Exchange" Workflow States ──
  const [searchInvoiceQuery, setSearchInvoiceQuery] = useState("");
  const [isSearchingInvoice, setIsSearchingInvoice] = useState(false);
  const [recentBills, setRecentBills] = useState<any[]>([]);
  const [billTypeFilter, setBillTypeFilter] = useState<"all" | "thermal" | "a4">("all");
  const [selectedBill, setSelectedBill] = useState<any | null>(null);
  const [returnItemsState, setReturnItemsState] = useState<
    Record<
      string,
      {
        selected: boolean;
        returned_qty: number;
        reason: string;
        restock_disposition: "restock" | "damaged" | "inspection";
      }
    >
  >({});
  const [settlementMethod, setSettlementMethod] = useState<"cash" | "upi" | "store_credit" | "credit_note">("cash");
  const [returnNotes, setReturnNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Exchange State ──
  const [exchangeItems, setExchangeItems] = useState<ExchangeProductItem[]>([]);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [exchangeSettlementMethod, setExchangeSettlementMethod] = useState<"cash" | "upi" | "card" | "credit_note">("cash");

  // Load existing returns from Backend API (with localStorage cache fallback)
  const loadReturns = async () => {
    try {
      setLoading(true);
      // Try backend first
      const serverRes = await salesReturnsApi.listReturns({ page: 1, page_size: 100 }).catch(() => null);
      if (serverRes && serverRes.items && serverRes.items.length > 0) {
        const mapped: SalesReturnRecord[] = serverRes.items.map((r: any) => ({
          id: r.id,
          return_number: r.return_number,
          return_date: r.return_date || new Date().toISOString().slice(0, 10),
          original_invoice_no: r.original_invoice_number || "Direct Return",
          original_invoice_date: r.return_date,
          customer_name: r.customer_name || "Customer",
          customer_phone: r.customer_phone || "",
          customer_gstin: "",
          settlement_method: (r.settlement_method as any) || "cash",
          settlement_status: "COMPLETED",
          credit_note_number: r.credit_note_number || undefined,
          debit_note_number: r.debit_note_number || undefined,
          subtotal: Number(r.total_amount || 0),
          tax_amount: 0,
          total_refund: Number(r.total_amount || 0),
          restock_count: r.items ? r.items.length : 0,
          total_items_returned: r.items ? r.items.length : 0,
          notes: r.reason,
          cashier_name: "Floor Cashier",
          created_at: r.created_at || new Date().toISOString(),
          items: (r.items || []).map((it: any) => ({
            id: it.id,
            product_id: it.product_id,
            product_name: it.product_name,
            purchased_qty: it.quantity,
            returned_qty: it.quantity,
            unit_price: it.unit_price,
            tax_rate: 0,
            discount_amount: 0,
            subtotal: it.line_total,
            tax_amount: it.tax_amount || 0,
            total_amount: it.line_total,
            reason: r.reason || "Customer Return",
            restock_disposition: "restock",
          })),
        }));
        setReturnsList(mapped);
        localStorage.setItem(storageKey, JSON.stringify(mapped));
        setLoading(false);
        return;
      }

      // Fallback to localStorage only for real user-saved returns (purge any legacy seed data)
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const cleanReturns = parsed.filter(
            (r: any) =>
              !String(r.id || "").startsWith("ret-seed-") &&
              !String(r.return_number || "").startsWith("SR-20251011-001") &&
              !String(r.return_number || "").startsWith("SR-20251010-002") &&
              r.customer_name !== "Rahul Verma" &&
              r.customer_name !== "Apex Retail Solutions"
          );
          if (cleanReturns.length !== parsed.length) {
            localStorage.setItem(storageKey, JSON.stringify(cleanReturns));
          }
          setReturnsList(cleanReturns);
          setLoading(false);
          return;
        }
      }

      setReturnsList([]);
    } catch (e) {
      console.warn("Sales returns load error:", e);
      setReturnsList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReturns();
  }, [storageKey]);

  // Load products catalog for exchanges
  const fetchProductsCatalog = async (search?: string) => {
    setIsSearchingProducts(true);
    try {
      const res: any = await posApi.getProducts({ search, limit: 30 }).catch(() => null);
      if (Array.isArray(res)) {
        setAvailableProducts(res);
      } else if (res?.items) {
        setAvailableProducts(res.items);
      }
    } catch (err) {
      console.warn("Products load error:", err);
    } finally {
      setIsSearchingProducts(false);
    }
  };

  useEffect(() => {
    if (activeTab === "exchange") {
      fetchProductsCatalog();
    }
  }, [activeTab]);

  // Load recent bills when opening create/exchange view
  useEffect(() => {
    if (activeTab === "return" || activeTab === "exchange") {
      fetchRecentBills();
    }
  }, [activeTab]);

  // Preselect bill if return_invoice query param is present
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const retInv = sp.get("return_invoice");
      if (retInv) {
        setSearchInvoiceQuery(retInv);
        setActiveTab("return");
        void handleLookupInvoice(retInv);
      }
    } catch (e) {}
  }, []);

  const fetchRecentBills = async () => {
    try {
      const erpRes: any = await invoicesApi.listInvoices({ page_size: 50 }).catch(() => null);
      const erpList = erpRes?.items || erpRes?.data?.items || (Array.isArray(erpRes) ? erpRes : []);

      const posHist: any = await posApi.getHistory({ limit: 50 }).catch(() => null);
      const posList = Array.isArray(posHist) ? posHist : (posHist?.items || []);

      const mergedBills: any[] = [];
      const matchedPosTxIds = new Set<string>();

      // 1. Process ERP Invoices and link with matching POS transactions
      erpList.forEach((inv: any) => {
        const invNum = String(inv.invoice_number || "").trim();
        const refNum = String(inv.reference_number || "").trim();
        const invNotes = String(inv.notes || "").toLowerCase();

        const matchingPos = posList.find((p: any) => {
          const recNum = String(p.receipt_number || "").trim();
          if (recNum && (recNum.toLowerCase() === refNum.toLowerCase() || recNum.toLowerCase() === invNum.toLowerCase() || invNotes.includes(recNum.toLowerCase()))) {
            return true;
          }
          if (p.id && (p.id === inv.id || p.id === inv.reference_number)) return true;
          return false;
        });

        if (matchingPos) {
          if (matchingPos.id) matchedPosTxIds.add(String(matchingPos.id));
          if (matchingPos.receipt_number) matchedPosTxIds.add(String(matchingPos.receipt_number));
        }

        const isThermal = Boolean(
          inv.print_template_id === "thermal" ||
          inv.template_id === "thermal" ||
          inv.print_status === "Thermal Printed" ||
          refNum.toLowerCase().startsWith("rec-") ||
          invNum.toLowerCase().startsWith("rec-") ||
          matchingPos ||
          invNotes.includes("pos terminal")
        );

        const receiptNo = refNum || (matchingPos ? matchingPos.receipt_number : "") || (isThermal ? invNum : "");
        const erpNo = invNum;

        mergedBills.push({
          ...inv,
          pos_tx: matchingPos,
          is_thermal: isThermal,
          receipt_number: receiptNo,
          erp_invoice_number: erpNo,
          display_number: isThermal && receiptNo ? receiptNo : erpNo,
          secondary_number: isThermal && receiptNo && erpNo && erpNo !== receiptNo ? erpNo : (refNum && refNum !== erpNo ? refNum : undefined),
          sequence_type: isThermal ? "thermal" : "a4",
          customer_name: inv.customer_name || inv.customer?.name || (matchingPos?.customer?.name) || "Walk-in Guest",
          customer_phone: inv.customer_phone || inv.customer?.phone || (matchingPos?.customer?.phone) || "",
          customer_address: inv.billing_address || inv.customer?.address || "",
          total_amount: Number(inv.total_amount || (matchingPos ? matchingPos.total_amount : 0) || 0),
          items: (inv.lines && inv.lines.length > 0) ? inv.lines : (inv.items || matchingPos?.items || []),
        });
      });

      // 2. Add standalone POS transactions that do not have an ERP invoice
      posList.forEach((pos: any) => {
        const pIdStr = String(pos.id || "");
        const pRecStr = String(pos.receipt_number || "");
        if (matchedPosTxIds.has(pIdStr) || (pRecStr && matchedPosTxIds.has(pRecStr))) {
          return;
        }
        const recNum = pRecStr || `REC-${pIdStr.slice(0, 6).toUpperCase()}`;
        mergedBills.push({
          id: pos.id,
          pos_tx: pos,
          is_thermal: true,
          receipt_number: recNum,
          display_number: recNum,
          erp_invoice_number: undefined,
          sequence_type: "thermal",
          customer_name: pos.customer?.name || "Walk-in Guest",
          customer_phone: pos.customer?.phone || "",
          customer_address: pos.customer?.address || "",
          total_amount: Number(pos.total_amount || 0),
          created_at: pos.created_at,
          invoice_date: pos.created_at ? pos.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
          items: pos.items || [],
        });
      });

      setRecentBills(mergedBills);
    } catch (e) {
      console.warn("Could not load recent bills:", e);
    }
  };

  // Search invoice/receipt logic
  const handleLookupInvoice = async (queryText?: string) => {
    const q = (queryText || searchInvoiceQuery).trim();
    if (!q) {
      toast.error("Please enter a Receipt Number, Invoice Number, or Customer Phone");
      return;
    }

    setIsSearchingInvoice(true);
    try {
      let found: any = null;

      // 1. Try real backend lookup endpoint first
      const serverInv = await salesReturnsApi.getInvoiceForReturn(q).catch(() => null);
      if (serverInv && serverInv.id) {
        found = serverInv;
      }

      // 2. Search in invoicesApi
      if (!found) {
        const erpRes: any = await invoicesApi.listInvoices({ search: q }).catch(() => null);
        const invList = erpRes?.items || erpRes?.data || (Array.isArray(erpRes) ? erpRes : []);
        const matched = invList.find(
          (inv: any) =>
            inv.invoice_number?.toLowerCase() === q.toLowerCase() ||
            inv.id?.toLowerCase() === q.toLowerCase() ||
            inv.customer_phone?.includes(q) ||
            inv.customer_name?.toLowerCase().includes(q.toLowerCase())
        );
        if (matched) {
          found = await invoicesApi.getInvoice(matched.id).catch(() => matched);
        }
      }

      // 3. Search in posApi
      if (!found) {
        const posHist: any = await posApi.getHistory({ limit: 200 }).catch(() => []);
        const histList = Array.isArray(posHist) ? posHist : (posHist as any)?.items || [];
        found = histList.find(
          (t: any) =>
            t.receipt_number?.toLowerCase() === q.toLowerCase() ||
            t.id?.toLowerCase() === q.toLowerCase() ||
            t.customer_phone?.includes(q) ||
            t.customer_name?.toLowerCase().includes(q.toLowerCase())
        );
      }

      if (found) {
        selectBillForReturn(found);
        toast.success(`Found Bill: ${found.invoice_number || found.receipt_number || found.id}`);
      } else {
        toast.error(`No matching receipt or invoice found for "${q}"`);
      }
    } catch (e: any) {
      toast.error(`Lookup failed: ${e.message || e}`);
    } finally {
      setIsSearchingInvoice(false);
    }
  };

  const selectBillForReturn = (bill: any) => {
    setSelectedBill(bill);
    const rawItems = bill.items || bill.lines || bill.invoice_items || [];
    const itemMap: Record<string, any> = {};

    if (rawItems.length > 0) {
      rawItems.forEach((it: any, idx: number) => {
        const key = it.id || `item-${idx}`;
        const qty = Number(it.quantity || it.qty || 1);
        itemMap[key] = {
          selected: true,
          returned_qty: qty,
          reason: "Customer Changed Mind",
          restock_disposition: "restock",
        };
      });
    } else {
      const key = "item-0";
      itemMap[key] = {
        selected: true,
        returned_qty: 1,
        reason: "Customer Changed Mind",
        restock_disposition: "restock",
      };
    }
    setReturnItemsState(itemMap);
  };

  // Normalized items of selected bill with authoritative pricing and real names
  const selectedBillNormalizedItems = useMemo(() => {
    if (!selectedBill) return [];
    const raw = selectedBill.items || selectedBill.lines || selectedBill.invoice_items || [];
    if (raw.length === 0) {
      const tot = Number(selectedBill.total_amount || selectedBill.grand_total || selectedBill.total || 0);
      return [
        {
          id: "item-0",
          product_name: selectedBill.invoice_number
            ? `Sale Item (${selectedBill.invoice_number})`
            : "Store Merchandise",
          sku: "",
          hsn_code: "",
          purchased_qty: 1,
          unit_price: tot,
          unit_refund_rate: tot,
          tax_rate: 0,
          discount_amount: 0,
          subtotal: tot,
          line_total: tot,
        },
      ];
    }
    return raw.map((it: any, idx: number) => {
      const pQty = Number(it.quantity || it.qty || 1);
      const pRate = Number(it.unit_price || it.price || it.rate || 0);
      const pTaxRate = (it.tax_rate !== undefined && it.tax_rate !== null)
        ? Number(it.tax_rate)
        : ((it.gst_rate !== undefined && it.gst_rate !== null) ? Number(it.gst_rate) : 0);
      const pDiscount = Number(it.discount_amount || it.discount_value || it.discount || 0);
      
      const rawLineTotal = Number(it.line_total || it.total_amount);
      const pLineTotal = (!isNaN(rawLineTotal) && rawLineTotal > 0)
        ? rawLineTotal
        : Math.max(0, pQty * pRate - pDiscount);

      const unitRefundRate = pQty > 0 ? (pLineTotal / pQty) : pRate;

      return {
        id: it.id || it.product_id || `item-${idx}`,
        product_id: it.product_id,
        product_name: it.product_name || it.item_name || it.name || `Item ${idx + 1}`,
        sku: it.sku || it.product_sku || it.barcode || "",
        hsn_code: it.hsn_code || it.hsn || "",
        batch_number: it.batch_number,
        purchased_qty: pQty,
        unit_price: pRate,
        unit_refund_rate: unitRefundRate,
        tax_rate: pTaxRate,
        discount_amount: pDiscount,
        line_total: pLineTotal,
        subtotal: Number(it.taxable_amount || (pTaxRate > 0 ? (pLineTotal / (1 + pTaxRate / 100)) : pLineTotal)),
      };
    });
  }, [selectedBill]);

  // Compute live return totals — refund strictly matches original billed invoice price
  const returnTotals = useMemo(() => {
    let subtotal = 0;
    let tax_amount = 0;
    let restock_count = 0;
    let total_items = 0;

    selectedBillNormalizedItems.forEach((it) => {
      const state = returnItemsState[it.id];
      if (state && state.selected && state.returned_qty > 0) {
        const itemRefundTotal = Number((it.unit_refund_rate * state.returned_qty).toFixed(2));
        
        let itemTax = 0;
        let itemSubtotal = itemRefundTotal;
        if (it.tax_rate > 0) {
          itemSubtotal = Number((itemRefundTotal / (1 + it.tax_rate / 100)).toFixed(2));
          itemTax = Number((itemRefundTotal - itemSubtotal).toFixed(2));
        }

        subtotal += itemSubtotal;
        tax_amount += itemTax;
        total_items += state.returned_qty;
        if (state.restock_disposition === "restock") {
          restock_count += state.returned_qty;
        }
      }
    });

    const total_refund = Number((subtotal + tax_amount).toFixed(2));
    return {
      subtotal: Number(subtotal.toFixed(2)),
      tax_amount: Number(tax_amount.toFixed(2)),
      total_refund,
      restock_count,
      total_items,
    };
  }, [selectedBillNormalizedItems, returnItemsState]);

  // Compute live exchange totals
  const exchangeTotals = useMemo(() => {
    let total = 0;
    exchangeItems.forEach((it) => {
      total += it.total_amount;
    });
    const returnCredit = returnTotals.total_refund;
    const difference = Number((total - returnCredit).toFixed(2));
    return {
      exchange_total: Number(total.toFixed(2)),
      return_credit: returnCredit,
      difference,
      // If difference > 0, customer pays difference; if < 0, store refunds difference
    };
  }, [exchangeItems, returnTotals]);

  // Add item to exchange list
  const handleAddExchangeItem = (prod: any) => {
    const existing = exchangeItems.find((e) => e.product_id === prod.id);
    const rate = Number(
      prod.selling_price ?? prod.mrp ?? prod.price ?? prod.sale_price ?? prod.retail_price ?? prod.unit_price ?? 0
    );
    const taxRate = Number(
      prod.tax_percent ?? prod.tax_rate ?? prod.gst_rate ?? 0
    );
    const isTaxInclusive = prod.is_tax_inclusive !== false;
    const lineTotal = isTaxInclusive
      ? Number((rate * 1).toFixed(2))
      : Number((rate * (1 + taxRate / 100)).toFixed(2));

    if (existing) {
      setExchangeItems(
        exchangeItems.map((e) => {
          if (e.product_id !== prod.id) return e;
          const newQty = e.quantity + 1;
          const tot = isTaxInclusive
            ? Number((newQty * e.unit_price).toFixed(2))
            : Number((newQty * e.unit_price * (1 + (e.tax_rate || 0) / 100)).toFixed(2));
          return {
            ...e,
            quantity: newQty,
            total_amount: tot,
          };
        })
      );
    } else {
      setExchangeItems([
        ...exchangeItems,
        {
          id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          product_id: prod.id,
          product_name: prod.name || prod.product_name,
          sku: prod.sku || prod.barcode,
          quantity: 1,
          unit_price: rate,
          tax_rate: taxRate,
          discount_amount: 0,
          total_amount: lineTotal,
        },
      ]);
    }
    toast.success(`Added ${prod.name || "Item"} to Exchange (₹${rate.toFixed(2)})`);
  };

  const handleUpdateExchangeItemQty = (id: string, qty: number) => {
    if (qty <= 0) {
      setExchangeItems(exchangeItems.filter((e) => e.id !== id));
      return;
    }
    setExchangeItems(
      exchangeItems.map((e) =>
        e.id === id
          ? {
              ...e,
              quantity: qty,
              total_amount: Number((qty * e.unit_price * (1 + (e.tax_rate || 0) / 100)).toFixed(2)),
            }
          : e
      )
    );
  };

  const handleUpdateExchangeItemRate = (id: string, rate: number) => {
    setExchangeItems(
      exchangeItems.map((e) =>
        e.id === id
          ? {
              ...e,
              unit_price: rate,
              total_amount: Number((e.quantity * rate * (1 + (e.tax_rate || 0) / 100)).toFixed(2)),
            }
          : e
      )
    );
  };

  const handleUpdateExchangeItemTax = (id: string, taxRate: number) => {
    setExchangeItems(
      exchangeItems.map((e) =>
        e.id === id
          ? {
              ...e,
              tax_rate: taxRate,
              total_amount: Number((e.quantity * e.unit_price * (1 + taxRate / 100)).toFixed(2)),
            }
          : e
      )
    );
  };

  // Submit standard sales return
  const handleSubmitReturn = async () => {
    if (!selectedBill) {
      toast.error("Please select a bill or receipt to return");
      return;
    }
    if (returnTotals.total_items === 0) {
      toast.error("Please select at least 1 item to return");
      return;
    }

    setIsSubmitting(true);
    try {
      const returnedItemsList: SalesReturnItem[] = [];
      const apiItems: any[] = [];

      selectedBillNormalizedItems.forEach((it) => {
        const state = returnItemsState[it.id];
        if (state && state.selected && state.returned_qty > 0) {
          const lineTot = Number((it.unit_refund_rate * state.returned_qty).toFixed(2));
          let itemTax = 0;
          let itemSubtotal = lineTot;
          if (it.tax_rate > 0) {
            itemSubtotal = Number((lineTot / (1 + it.tax_rate / 100)).toFixed(2));
            itemTax = Number((lineTot - itemSubtotal).toFixed(2));
          }

          returnedItemsList.push({
            id: `ret-item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            product_id: it.product_id,
            product_name: it.product_name,
            sku: it.sku,
            hsn_code: it.hsn_code,
            purchased_qty: it.purchased_qty,
            returned_qty: state.returned_qty,
            unit_price: it.unit_refund_rate,
            tax_rate: it.tax_rate,
            discount_amount: 0,
            subtotal: itemSubtotal,
            tax_amount: itemTax,
            total_amount: lineTot,
            reason: state.reason,
            restock_disposition: state.restock_disposition,
          });

          apiItems.push({
            product_id: it.product_id,
            product_name: it.product_name,
            sku: it.sku,
            hsn_code: it.hsn_code,
            batch_number: it.batch_number,
            quantity: state.returned_qty,
            unit_price: it.unit_refund_rate,
            tax_rate: it.tax_rate,
            tax_amount: itemTax,
            line_total: lineTot,
            reason: state.reason,
            disposition: state.restock_disposition,
          });
        }
      });

      // 1. Call Backend Sales Returns API (restocks inventory real-time!)
      const backendPayload = {
        original_invoice_id: selectedBill.id,
        original_invoice_number: selectedBill.invoice_number || selectedBill.receipt_number,
        customer_name: selectedBill.customer_name || selectedBill.customer?.name || "Customer",
        customer_phone: selectedBill.customer_phone || selectedBill.phone || "",
        return_date: new Date().toISOString().slice(0, 10),
        settlement_method: settlementMethod,
        reason: returnNotes.trim() || "Customer Return",
        notes: returnNotes.trim() || undefined,
        items: apiItems,
      };

      const serverResult = await salesReturnsApi.createReturn(backendPayload).catch((err: any) => {
        console.warn("Backend return failed, falling back to local:", err);
        return null;
      });

      const returnNumber = serverResult?.return_number || `SR-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

      const newReturnRecord: SalesReturnRecord = {
        id: serverResult?.id || `ret-${Date.now()}`,
        return_number: returnNumber,
        return_date: new Date().toISOString().slice(0, 10),
        original_invoice_no: selectedBill.invoice_number || selectedBill.receipt_number || selectedBill.id,
        original_invoice_date: selectedBill.created_at?.slice(0, 10) || selectedBill.invoice_date || new Date().toISOString().slice(0, 10),
        customer_name: selectedBill.customer_name || selectedBill.customer?.name || "Walk-in Guest",
        customer_phone: selectedBill.customer_phone || selectedBill.phone || "",
        customer_gstin: selectedBill.customer_gstin || selectedBill.gstin || "",
        settlement_method: settlementMethod,
        settlement_status: "COMPLETED",
        credit_note_number: serverResult?.credit_note_number || (settlementMethod === "credit_note" ? `CN-${returnNumber.slice(3)}` : undefined),
        debit_note_number: serverResult?.debit_note_number,
        subtotal: returnTotals.subtotal,
        tax_amount: returnTotals.tax_amount,
        total_refund: returnTotals.total_refund,
        restock_count: returnTotals.restock_count,
        total_items_returned: returnTotals.total_items,
        notes: returnNotes.trim() || undefined,
        cashier_name: "Floor Cashier",
        created_at: new Date().toISOString(),
        items: returnedItemsList,
      };

      const updatedList = [newReturnRecord, ...returnsList];
      setReturnsList(updatedList);
      localStorage.setItem(storageKey, JSON.stringify(updatedList));

      toast.success(
        `Sales Return ${returnNumber} processed! ${returnTotals.restock_count} product(s) added back to inventory.`
      );
      setSelectedReturnSlip(newReturnRecord);

      // Reset
      setSelectedBill(null);
      setSearchInvoiceQuery("");
      setReturnNotes("");
      setActiveTab("register");
    } catch (e: any) {
      toast.error(`Error processing return: ${e.message || e}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit product exchange
  const handleSubmitExchange = async () => {
    if (!selectedBill) {
      toast.error("Please select a bill or receipt for exchange");
      return;
    }
    if (returnTotals.total_items === 0) {
      toast.error("Please select at least 1 returned item");
      return;
    }
    if (exchangeItems.length === 0) {
      toast.error("Please add at least 1 replacement exchange item");
      return;
    }

    setIsSubmitting(true);
    try {
      const returnedItemsList: SalesReturnItem[] = [];
      const apiReturnItems: any[] = [];

      selectedBillNormalizedItems.forEach((it) => {
        const state = returnItemsState[it.id];
        if (state && state.selected && state.returned_qty > 0) {
          const itemSubtotal = Number((it.unit_price * state.returned_qty).toFixed(2));
          const itemTax = Number((itemSubtotal * (it.tax_rate / 100)).toFixed(2));
          const lineTot = Number((itemSubtotal + itemTax).toFixed(2));

          returnedItemsList.push({
            id: `ret-item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            product_id: it.product_id,
            product_name: it.product_name,
            sku: it.sku,
            purchased_qty: it.purchased_qty,
            returned_qty: state.returned_qty,
            unit_price: it.unit_price,
            tax_rate: it.tax_rate,
            discount_amount: 0,
            subtotal: itemSubtotal,
            tax_amount: itemTax,
            total_amount: lineTot,
            reason: state.reason,
            restock_disposition: state.restock_disposition,
          });

          apiReturnItems.push({
            product_id: it.product_id,
            product_name: it.product_name,
            sku: it.sku,
            quantity: state.returned_qty,
            unit_price: it.unit_price,
            tax_rate: it.tax_rate,
            tax_amount: itemTax,
            line_total: lineTot,
            disposition: state.restock_disposition,
          });
        }
      });

      const apiExchangeItems = exchangeItems.map((ex) => ({
        product_id: ex.product_id,
        product_name: ex.product_name,
        quantity: ex.quantity,
        unit_price: ex.unit_price,
        tax_rate: ex.tax_rate,
        discount_amount: ex.discount_amount,
      }));

      // Call Backend Exchange API
      const serverResult = await salesReturnsApi
        .processExchange({
          original_invoice_id: selectedBill.id,
          original_invoice_number: selectedBill.invoice_number || selectedBill.receipt_number,
          customer_name: selectedBill.customer_name || selectedBill.customer?.name || "Customer",
          customer_phone: selectedBill.customer_phone || selectedBill.phone || "",
          settlement_method: exchangeSettlementMethod,
          reason: returnNotes.trim() || "Merchandise Exchange",
          notes: returnNotes.trim() || undefined,
          return_items: apiReturnItems,
          exchange_items: apiExchangeItems,
        })
        .catch((err: any) => {
          console.warn("Backend exchange notice:", err);
          return null;
        });

      const returnNumber = serverResult?.return_number || `EX-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
      const exchangeInvNo = serverResult?.exchange_invoice_number || `INV-EX-${Math.floor(1000 + Math.random() * 9000)}`;

      const newRecord: SalesReturnRecord = {
        id: serverResult?.id || `ret-${Date.now()}`,
        return_number: returnNumber,
        return_date: new Date().toISOString().slice(0, 10),
        original_invoice_no: selectedBill.invoice_number || selectedBill.receipt_number || selectedBill.id,
        original_invoice_date: selectedBill.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        customer_name: selectedBill.customer_name || selectedBill.customer?.name || "Customer",
        customer_phone: selectedBill.customer_phone || selectedBill.phone || "",
        settlement_method: "exchange",
        settlement_status: "COMPLETED",
        subtotal: returnTotals.subtotal,
        tax_amount: returnTotals.tax_amount,
        total_refund: returnTotals.total_refund,
        restock_count: returnTotals.restock_count,
        total_items_returned: returnTotals.total_items,
        notes: returnNotes.trim() || undefined,
        cashier_name: "Floor Cashier",
        created_at: new Date().toISOString(),
        items: returnedItemsList,
        is_exchange: true,
        credit_note_number: serverResult?.credit_note_number,
        debit_note_number: serverResult?.debit_note_number,
        exchange_invoice_number: exchangeInvNo,
        exchange_total: exchangeTotals.exchange_total,
        difference: exchangeTotals.difference,
        exchange_items: [...exchangeItems],
      };

      const updatedList = [newRecord, ...returnsList];
      setReturnsList(updatedList);
      localStorage.setItem(storageKey, JSON.stringify(updatedList));

      toast.success(
        `Exchange processed! Return ${returnNumber} → New Bill ${exchangeInvNo}. Difference: ${formatCurrency(exchangeTotals.difference)}`
      );
      setSelectedReturnSlip(newRecord);

      // Reset
      setSelectedBill(null);
      setExchangeItems([]);
      setReturnNotes("");
      setActiveTab("register");
    } catch (e: any) {
      toast.error(`Error processing exchange: ${e.message || e}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete return record
  const handleDeleteReturn = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to remove this record?")) {
      const updated = returnsList.filter((r) => r.id !== id);
      setReturnsList(updated);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      toast.success("Record removed.");
    }
  };

  // Filtered returns list for Register
  const filteredReturns = useMemo(() => {
    return returnsList.filter((r) => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        r.return_number.toLowerCase().includes(q) ||
        r.original_invoice_no.toLowerCase().includes(q) ||
        r.customer_name.toLowerCase().includes(q) ||
        (r.customer_phone && r.customer_phone.includes(q));

      const matchMethod = methodFilter === "all" || r.settlement_method === methodFilter;

      let matchDate = true;
      if (dateFilter === "today") {
        matchDate = r.return_date === new Date().toISOString().slice(0, 10);
      } else if (dateFilter === "this_week") {
        const d = new Date(r.return_date);
        const now = new Date();
        const diff = (now.getTime() - d.getTime()) / (1000 * 3600 * 24);
        matchDate = diff <= 7;
      } else if (dateFilter === "this_month") {
        const d = new Date(r.return_date);
        const now = new Date();
        matchDate = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }

      return matchSearch && matchMethod && matchDate;
    });
  }, [returnsList, searchTerm, methodFilter, dateFilter]);

  const paginatedReturns = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReturns.slice(start, start + pageSize);
  }, [filteredReturns, currentPage, pageSize]);

  // High-level KPI Stats
  const kpiStats = useMemo(() => {
    const totalCount = returnsList.length;
    const totalRefundVal = returnsList.reduce((s, r) => s + r.total_refund, 0);
    const totalRestocked = returnsList.reduce((s, r) => s + r.restock_count, 0);
    const totalExchanges = returnsList.filter((r) => r.is_exchange || r.settlement_method === "exchange").length;
    return { totalCount, totalRefundVal, totalRestocked, totalExchanges };
  }, [returnsList]);

  const printSlip = () => {
    window.print();
  };

  const handleDirectThermalPrint = (record: SalesReturnRecord) => {
    const voucherData: StandardVoucherData = {
      voucherType: record.is_exchange ? "exchange" : "return",
      voucherNumber: record.return_number,
      voucherDate: record.return_date,
      originalInvoiceNo: record.original_invoice_no,
      originalInvoiceDate: record.original_invoice_date,
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
        name: record.customer_name,
        phone: record.customer_phone,
        gstin: record.customer_gstin,
      },
      items: record.items.map((it) => ({
        product_name: it.product_name,
        sku: it.sku,
        hsn_code: it.hsn_code,
        quantity: it.returned_qty,
        unit_price: it.unit_price,
        tax_rate: it.tax_rate,
        tax_amount: it.tax_amount,
        line_total: it.total_amount,
        reason: it.reason,
        disposition: it.restock_disposition,
      })),
      exchangeItems: record.exchange_items?.map((ex) => ({
        product_name: ex.product_name,
        sku: ex.sku,
        quantity: ex.quantity,
        unit_price: ex.unit_price,
        tax_rate: ex.tax_rate,
        line_total: ex.total_amount,
      })),
      subtotal: record.subtotal,
      taxAmount: record.tax_amount,
      totalAmount: record.total_refund,
      settlementMethod: record.settlement_method,
      creditNoteNumber: record.credit_note_number,
      debitNoteNumber: record.debit_note_number,
      exchangeInvoiceNumber: record.exchange_invoice_number,
      exchangeTotal: record.exchange_total,
      difference: record.difference,
      reason: record.notes,
      notes: record.notes,
      cashierName: record.cashier_name || "Floor Cashier",
      restockedCount: record.restock_count,
    };

    try {
      printThermalVoucher(voucherData, { paperSize: "80mm" }, tenant?.id);
      toast.success(`Thermal receipt sent to printer for ${record.return_number}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to send to thermal printer");
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-full bg-slate-50/50">
      {/* ── Top Header Toolbar ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">Sales Returns & Exchanges</h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                  {returnsList.length} Records
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Process customer returns with automated inventory restocking, issue refunds, GST credit notes, or swap products via live exchange.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === "register" ? (
              <>
                <button
                  onClick={() => {
                    setSelectedBill(null);
                    setActiveTab("return");
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 shadow-sm transition"
                >
                  <RotateCcw className="w-4 h-4" />
                  Process Return
                </button>
                <button
                  onClick={() => {
                    setSelectedBill(null);
                    setExchangeItems([]);
                    setActiveTab("exchange");
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-sm transition"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  Process Exchange
                </button>
              </>
            ) : (
              <button
                onClick={() => setActiveTab("register")}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold transition"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Returns Register
              </button>
            )}
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Records</span>
              <RotateCcw className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-2xl font-black text-slate-900 mt-1">{kpiStats.totalCount}</p>
            <span className="text-[10px] text-slate-400">Returns & Exchanges</span>
          </div>

          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Return Value</span>
              <TrendingDown className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-2xl font-black text-rose-600 mt-1">{formatCurrency(kpiStats.totalRefundVal)}</p>
            <span className="text-[10px] text-slate-400">Merchandise Credited</span>
          </div>

          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Restocked Items</span>
              <Package className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-emerald-600 mt-1">{kpiStats.totalRestocked}</p>
            <span className="text-[10px] text-slate-400">Restored to Inventory Qty</span>
          </div>

          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Exchanges</span>
              <ArrowRightLeft className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-black text-blue-600 mt-1">{kpiStats.totalExchanges}</p>
            <span className="text-[10px] text-slate-400">Direct Product Swaps</span>
          </div>
        </div>
      </div>

      {/* ── Main Body Content ── */}
      <div className="p-6 space-y-6">
        {/* VIEW 1: REGISTER TAB */}
        {activeTab === "register" && (
          <div className="space-y-4">
            {/* Filter toolbar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[260px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search Return #, Invoice #, Customer Name, or Phone..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={dateFilter}
                  onChange={(e) => {
                    setDateFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none"
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="this_week">This Week</option>
                  <option value="this_month">This Month</option>
                </select>

                <select
                  value={methodFilter}
                  onChange={(e) => {
                    setMethodFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none"
                >
                  <option value="all">All Settlement Types</option>
                  <option value="cash">Cash Refund</option>
                  <option value="upi">UPI</option>
                  <option value="store_credit">Store Credit</option>
                  <option value="credit_note">Credit Note</option>
                  <option value="exchange">Exchange</option>
                </select>

                <button
                  onClick={loadReturns}
                  className="p-2 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
                  title="Refresh returns list"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* Returns Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Slip / Date</th>
                      <th className="py-3.5 px-4">Original Bill</th>
                      <th className="py-3.5 px-4">Customer</th>
                      <th className="py-3.5 px-4 text-center">Items</th>
                      <th className="py-3.5 px-4">Settlement Mode</th>
                      <th className="py-3.5 px-4 text-right">Refund / Value</th>
                      <th className="py-3.5 px-4 text-center">Restocked</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedReturns.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <RotateCcw className="w-8 h-8 mx-auto mb-2 opacity-30 text-rose-500" />
                          <p className="font-semibold text-slate-600">No Sales Return records found</p>
                          <p className="text-[11px] mt-0.5">Click "Process Return" or "Process Exchange" to begin.</p>
                        </td>
                      </tr>
                    ) : (
                      paginatedReturns.map((ret) => (
                        <tr
                          key={ret.id}
                          onClick={() => setSelectedReturnSlip(ret)}
                          className="hover:bg-slate-50/80 cursor-pointer transition"
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-mono font-bold text-slate-900">{ret.return_number}</div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3 h-3" />
                              {ret.return_date}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col gap-1 items-start">
                              <span className="font-mono text-indigo-600 bg-indigo-50/60 px-2 py-0.5 rounded font-semibold text-[11px]">
                                {ret.original_invoice_no}
                              </span>
                              {ret.credit_note_number && (
                                <span className="font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-0.5 border border-emerald-200/60">
                                  CN: {ret.credit_note_number}
                                </span>
                              )}
                              {ret.debit_note_number && (
                                <span className="font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-0.5 border border-amber-200/60">
                                  DN: {ret.debit_note_number}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900">{ret.customer_name}</div>
                            {ret.customer_phone && (
                              <div className="text-[11px] text-slate-400 font-mono">{ret.customer_phone}</div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                            {ret.total_items_returned || (ret.items ? ret.items.length : 1)}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                ret.settlement_method === "cash"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : ret.settlement_method === "credit_note"
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : ret.settlement_method === "exchange"
                                  ? "bg-purple-50 text-purple-700 border border-purple-200"
                                  : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                              }`}
                            >
                              {ret.settlement_method === "exchange" && <ArrowRightLeft className="w-2.5 h-2.5" />}
                              {ret.settlement_method.replace("_", " ")}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <span className="font-mono font-bold text-rose-600 text-sm">
                              {formatCurrency(ret.total_refund)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              {ret.restock_count} Restocked
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleDirectThermalPrint(ret)}
                                className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                title="Instant Thermal Print (POS Receipt)"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setSelectedReturnSlip(ret)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                title="View & Print Slip (A4 / Thermal)"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => handleDeleteReturn(ret.id, e)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Remove Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {filteredReturns.length > pageSize && (
                <div className="p-3 border-t border-slate-100 flex justify-end">
                  <PaginationControl
                    currentPage={currentPage}
                    totalPages={Math.ceil(filteredReturns.length / pageSize)}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 2 & 3: PROCESS RETURN OR PROCESS EXCHANGE */}
        {(activeTab === "return" || activeTab === "exchange") && (
          <div className="space-y-6">
            {/* Mode Indicator Banner */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between ${
              activeTab === "exchange"
                ? "bg-indigo-500/10 border-indigo-200 text-indigo-900"
                : "bg-rose-500/10 border-rose-200 text-rose-900"
            }`}>
              <div className="flex items-center gap-3">
                {activeTab === "exchange" ? (
                  <ArrowRightLeft className="w-6 h-6 text-indigo-600" />
                ) : (
                  <RotateCcw className="w-6 h-6 text-rose-600" />
                )}
                <div>
                  <h2 className="text-sm font-bold">
                    {activeTab === "exchange" ? "Merchandise Exchange Mode" : "Merchandise Return & Refund Mode"}
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {activeTab === "exchange"
                      ? "Return customer items, restock them, and issue replacement items with automated net difference settlement."
                      : "Return customer items, automatically restock inventory qty, and issue a refund or GST Credit Note."}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab(activeTab === "exchange" ? "return" : "exchange")}
                  className="px-3 py-1.5 bg-white border rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs transition"
                >
                  Switch to {activeTab === "exchange" ? "Return Only" : "Exchange"}
                </button>
              </div>
            </div>

            {/* Step 1: Lookup Original Invoice / Bill */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Step 1: Select Original Invoice or Bill</h2>
                <p className="text-xs text-slate-500">
                  Search by Invoice Number, POS Receipt Number, or Customer Phone.
                </p>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchInvoiceQuery}
                    onChange={(e) => setSearchInvoiceQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLookupInvoice()}
                    placeholder="Enter Invoice / Receipt Number (e.g. INV-0001, REC-1042) or Phone..."
                    className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleLookupInvoice()}
                  disabled={isSearchingInvoice}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition flex items-center gap-2"
                >
                  {isSearchingInvoice ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  Lookup Bill
                </button>
              </div>

              {/* Recent Bills Pills with Sequence Segregation */}
              {recentBills.length > 0 && !selectedBill && (
                <div className="space-y-2.5 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Or select from recent sales:
                    </div>

                    {/* Sequence Filter Tabs */}
                    <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setBillTypeFilter("all")}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          billTypeFilter === "all" ? "bg-white text-indigo-700 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        All Recent ({recentBills.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setBillTypeFilter("thermal")}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                          billTypeFilter === "thermal" ? "bg-white text-emerald-700 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <span>🧾 Thermal Counter Receipts</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-bold">
                          {recentBills.filter((b) => b.is_thermal).length}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setBillTypeFilter("a4")}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                          billTypeFilter === "a4" ? "bg-white text-blue-700 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <span>📄 Standard A4 Invoices</span>
                        <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full font-bold">
                          {recentBills.filter((b) => !b.is_thermal).length}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {recentBills
                      .filter((b) => {
                        if (billTypeFilter === "thermal") return b.is_thermal;
                        if (billTypeFilter === "a4") return !b.is_thermal;
                        return true;
                      })
                      .slice(0, 15)
                      .map((b) => {
                        const isThermal = Boolean(b.is_thermal);
                        const mainNum = b.display_number || b.receipt_number || b.invoice_number;
                        const secNum = b.secondary_number;
                        const cName = b.customer_name || "Walk-in Guest";
                        const amt = b.total_amount || 0;
                        return (
                          <button
                            key={b.id || mainNum}
                            type="button"
                            onClick={() => selectBillForReturn(b)}
                            className="px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl text-xs font-medium text-slate-700 transition flex items-center gap-2 text-left cursor-pointer shadow-2xs"
                          >
                            {isThermal ? (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                                🧾 REC
                              </span>
                            ) : (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300">
                                📄 INV
                              </span>
                            )}
                            <span className="font-mono font-bold text-slate-900">{mainNum}</span>
                            {secNum && (
                              <span className="text-[10px] text-slate-400 font-mono">({secNum})</span>
                            )}
                            <span className="text-slate-500">• {cName}</span>
                            <span className="font-mono font-bold text-emerald-600">
                              {formatCurrency(Number(amt))}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Selected Bill Banner */}
              {selectedBill && (
                <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-900">
                        Active Bill: {selectedBill.invoice_number || selectedBill.receipt_number || selectedBill.id}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white text-indigo-700 border border-indigo-200">
                        {selectedBill.created_at?.slice(0, 10) || selectedBill.invoice_date || "Today"}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 flex items-center gap-3">
                      <span>Customer: {selectedBill.customer_name || selectedBill.customer?.name || "Walk-in Guest"}</span>
                      {selectedBill.customer_phone && <span>Phone: {selectedBill.customer_phone}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBill(null);
                      setReturnItemsState({});
                    }}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Change Bill
                  </button>
                </div>
              )}
            </div>

            {/* Step 2: Select Items to Return */}
            {selectedBill && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Step 2: Choose Items Being Returned</h2>
                    <p className="text-xs text-slate-500">
                      Check items, adjust returned quantity, select return reason, and set stock condition.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                    Return Value: {formatCurrency(returnTotals.total_refund)}
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-3 w-10 text-center">Return?</th>
                        <th className="py-3 px-3">Product Name & SKU</th>
                        <th className="py-3 px-3 text-center">Sold Qty</th>
                        <th className="py-3 px-3 text-center w-28">Return Qty</th>
                        <th className="py-3 px-3 text-right">Unit Rate</th>
                        <th className="py-3 px-3 text-right">Refund Total</th>
                        <th className="py-3 px-3">Return Reason</th>
                        <th className="py-3 px-3">Inventory Condition</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedBillNormalizedItems.map((it) => {
                        const st = returnItemsState[it.id] || {
                          selected: false,
                          returned_qty: 0,
                          reason: "Customer Changed Mind",
                          restock_disposition: "restock",
                        };

                        const refundRate = it.unit_refund_rate || it.unit_price;
                        const lineTot = Number((refundRate * st.returned_qty).toFixed(2));

                        return (
                          <tr
                            key={it.id}
                            className={`transition ${st.selected ? "bg-rose-50/30" : "opacity-60 bg-white"}`}
                          >
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={st.selected}
                                onChange={(e) => {
                                  setReturnItemsState({
                                    ...returnItemsState,
                                    [it.id]: {
                                      ...st,
                                      selected: e.target.checked,
                                      returned_qty: e.target.checked ? st.returned_qty || it.purchased_qty : 0,
                                    },
                                  });
                                }}
                                className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                              />
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900">{it.product_name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{it.sku}</div>
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-slate-500">
                              {it.purchased_qty}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <input
                                type="number"
                                min={1}
                                max={it.purchased_qty}
                                disabled={!st.selected}
                                value={st.returned_qty}
                                onChange={(e) => {
                                  const val = Math.max(1, Math.min(it.purchased_qty, Number(e.target.value)));
                                  setReturnItemsState({
                                    ...returnItemsState,
                                    [it.id]: { ...st, returned_qty: val },
                                  });
                                }}
                                className="w-20 text-center py-1 text-xs font-bold border border-slate-200 rounded-lg bg-white disabled:bg-slate-100"
                              />
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-semibold">
                              {formatCurrency(refundRate)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-rose-600">
                              {formatCurrency(lineTot)}
                            </td>
                            <td className="py-3 px-3">
                              <select
                                disabled={!st.selected}
                                value={st.reason}
                                onChange={(e) => {
                                  setReturnItemsState({
                                    ...returnItemsState,
                                    [it.id]: { ...st, reason: e.target.value },
                                  });
                                }}
                                className="w-full text-xs py-1 px-2 border border-slate-200 rounded-lg bg-white disabled:bg-slate-100"
                              >
                                {RETURN_REASONS.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 px-3">
                              <select
                                disabled={!st.selected}
                                value={st.restock_disposition}
                                onChange={(e) => {
                                  setReturnItemsState({
                                    ...returnItemsState,
                                    [it.id]: { ...st, restock_disposition: e.target.value as any },
                                  });
                                }}
                                className="w-full text-xs py-1 px-2 border border-slate-200 rounded-lg bg-white font-semibold disabled:bg-slate-100"
                              >
                                <option value="restock">✅ Restock to Inventory</option>
                                <option value="damaged">❌ Damaged / Scrap</option>
                                <option value="inspection">🔍 Quarantine / Inspection</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 flex flex-wrap items-center justify-between text-xs gap-3">
                  <div className="text-slate-600">
                    Selected: <span className="font-bold text-slate-900">{returnTotals.total_items} item(s)</span> (
                    <span className="font-bold text-emerald-600">{returnTotals.restock_count} restoring to inventory</span>)
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      Taxable: <span className="font-mono font-bold">{formatCurrency(returnTotals.subtotal)}</span>
                    </div>
                    <div>
                      Tax Reversal:{" "}
                      <span className="font-mono font-bold text-emerald-600">{formatCurrency(returnTotals.tax_amount)}</span>
                    </div>
                    <div>
                      Return Credit Total:{" "}
                      <span className="font-mono font-black text-rose-600 text-sm">
                        {formatCurrency(returnTotals.total_refund)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3 (FOR EXCHANGE ONLY): Select Replacement / Exchange Items */}
            {selectedBill && activeTab === "exchange" && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Step 3: Add Replacement Items for Exchange</h2>
                    <p className="text-xs text-slate-500">
                      Search inventory catalog and pick the products the customer is taking in exchange.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProductPicker(true);
                      fetchProductsCatalog();
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-sm transition"
                  >
                    <Plus className="w-4 h-4" />
                    Browse Products Catalog
                  </button>
                </div>

                {/* Exchange items table */}
                {exchangeItems.length === 0 ? (
                  <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50/50">
                    <ShoppingBag className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700">No replacement items added yet</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Click "Browse Products Catalog" to choose replacement goods from your store stock.
                    </p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-3">Exchange Product</th>
                          <th className="py-3 px-3 text-center w-24">Qty</th>
                          <th className="py-3 px-3 text-right">Unit Rate</th>
                          <th className="py-3 px-3 text-right">Tax Rate</th>
                          <th className="py-3 px-3 text-right">Total Amount</th>
                          <th className="py-3 px-3 text-center w-12">Remove</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {exchangeItems.map((ex) => (
                          <tr key={ex.id} className="hover:bg-slate-50/50">
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900">{ex.product_name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{ex.sku}</div>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <input
                                type="number"
                                min={1}
                                value={ex.quantity}
                                onChange={(e) => handleUpdateExchangeItemQty(ex.id, Number(e.target.value))}
                                className="w-16 text-center py-1 text-xs font-bold border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                              />
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="inline-flex items-center gap-1 justify-end">
                                <span className="text-slate-400 text-xs">₹</span>
                                <input
                                  type="number"
                                  min={0}
                                  step="any"
                                  value={ex.unit_price}
                                  onChange={(e) => handleUpdateExchangeItemRate(ex.id, parseFloat(e.target.value) || 0)}
                                  className="w-24 text-right py-1 px-2 text-xs font-mono font-bold border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="inline-flex items-center gap-1 justify-end">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step="any"
                                  value={ex.tax_rate}
                                  onChange={(e) => handleUpdateExchangeItemTax(ex.id, parseFloat(e.target.value) || 0)}
                                  className="w-14 text-right py-1 px-1.5 text-xs font-mono text-slate-700 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                                />
                                <span className="text-slate-400 font-bold text-xs">%</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-indigo-600">
                              {formatCurrency(ex.total_amount)}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleUpdateExchangeItemQty(ex.id, 0)}
                                className="p-1 text-slate-400 hover:text-rose-600 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Net Difference Calculator Pill */}
                <div className="bg-slate-900 text-white p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      Exchange Balance Equation
                    </span>
                    <div className="text-xs text-slate-300">
                      New Items Value ({formatCurrency(exchangeTotals.exchange_total)}) − Return Credit (
                      {formatCurrency(exchangeTotals.return_credit)})
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Net Difference</span>
                      <span
                        className={`text-xl font-black font-mono ${
                          exchangeTotals.difference > 0
                            ? "text-rose-400"
                            : exchangeTotals.difference < 0
                            ? "text-emerald-400"
                            : "text-slate-200"
                        }`}
                      >
                        {formatCurrency(Math.abs(exchangeTotals.difference))}
                      </span>
                    </div>

                    <div className="bg-white/10 px-3 py-1.5 rounded-lg text-xs font-bold">
                      {exchangeTotals.difference > 0
                        ? "Customer Pays Difference"
                        : exchangeTotals.difference < 0
                        ? "Refund / Credit Due to Customer"
                        : "Even Swap (Zero Balance)"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Final Step: Settlement & Completion */}
            {selectedBill && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {activeTab === "exchange" ? "Step 4: Complete Exchange & Issue Voucher" : "Step 3: Refund Settlement & Completion"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {activeTab === "exchange"
                      ? "Select payment mode for net difference and finalize the exchange."
                      : "Choose settlement method and finalize merchandise return."}
                  </p>
                </div>

                {activeTab === "return" ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { id: "cash", label: "Cash Refund", desc: "Instant payout from register", icon: DollarSign },
                      { id: "upi", label: "UPI Transfer", desc: "Instant digital payout", icon: QrCode },
                      { id: "store_credit", label: "Store Credit", desc: "Credit customer account", icon: Wallet },
                      { id: "credit_note", label: "GST Credit Note", desc: "Statutory credit voucher", icon: FileText },
                    ].map((m) => {
                      const Icon = m.icon;
                      const isSelected = settlementMethod === m.id;
                      return (
                        <div
                          key={m.id}
                          onClick={() => setSettlementMethod(m.id as any)}
                          className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex items-start gap-3 ${
                            isSelected
                              ? "border-rose-600 bg-rose-50/50 shadow-xs"
                              : "border-slate-200 hover:border-slate-300 bg-white"
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isSelected ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">{m.label}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{m.desc}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between text-xs">
                      <span className="font-semibold text-indigo-900">
                        {exchangeTotals.difference < 0
                          ? `Refund / Credit of ${formatCurrency(Math.abs(exchangeTotals.difference))} due to customer. Select refund mode for left-over balance:`
                          : exchangeTotals.difference > 0
                          ? `Customer balance of ${formatCurrency(exchangeTotals.difference)} to be collected. Select payment mode:`
                          : "Even swap — No net balance to collect or refund."}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { id: "cash", label: "Cash", desc: exchangeTotals.difference < 0 ? "Payout cash at counter" : "Receive cash at counter", icon: DollarSign },
                        { id: "upi", label: "UPI / QR", desc: exchangeTotals.difference < 0 ? "Instant UPI refund" : "Instant UPI payment", icon: QrCode },
                        { id: "card", label: "Card POS", desc: exchangeTotals.difference < 0 ? "Card refund" : "Card swipe payment", icon: CreditCard },
                        { id: "credit_note", label: "Credit Note", desc: "Issue note for left-over balance", icon: FileText },
                      ].map((m) => {
                        const Icon = m.icon;
                        const isSelected = exchangeSettlementMethod === m.id;
                        return (
                          <div
                            key={m.id}
                            onClick={() => setExchangeSettlementMethod(m.id as any)}
                            className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex items-start gap-3 ${
                              isSelected
                                ? "border-indigo-600 bg-indigo-50/50 shadow-xs"
                                : "border-slate-200 hover:border-slate-300 bg-white"
                            }`}
                          >
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900">{m.label}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">{m.desc}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Notes / Cashier Verification Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    placeholder="e.g. Products inspected, barcodes verified, approved by store supervisor."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="text-xs text-slate-500">
                    Real-time inventory restock will trigger immediately upon confirmation.
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("register")}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    {activeTab === "return" ? (
                      <button
                        type="button"
                        disabled={isSubmitting || returnTotals.total_items === 0}
                        onClick={handleSubmitReturn}
                        className="px-6 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 disabled:opacity-50 transition flex items-center gap-2 shadow-sm"
                      >
                        {isSubmitting ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Restocking & Processing...
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            Complete Return ({formatCurrency(returnTotals.total_refund)})
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isSubmitting || returnTotals.total_items === 0 || exchangeItems.length === 0}
                        onClick={handleSubmitExchange}
                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition flex items-center gap-2 shadow-sm"
                      >
                        {isSubmitting ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Processing Exchange & Updating Stock...
                          </>
                        ) : (
                          <>
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            Finalize Exchange Voucher
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Product Picker Modal for Exchanges ── */}
      <AnimatePresence>
        {showProductPicker && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm font-bold">Select Store Merchandise for Exchange</span>
                </div>
                <button
                  onClick={() => setShowProductPicker(false)}
                  className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={productSearchQuery}
                    onChange={(e) => {
                      setProductSearchQuery(e.target.value);
                      fetchProductsCatalog(e.target.value);
                    }}
                    placeholder="Search product name, barcode, or SKU..."
                    className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="p-4 overflow-y-auto space-y-2 flex-1">
                {isSearchingProducts ? (
                  <div className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    <span>Loading products...</span>
                  </div>
                ) : availableProducts.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <span>No products found matching "{productSearchQuery}"</span>
                  </div>
                ) : (
                  availableProducts.map((p) => {
                    const price = Number(
                      p.selling_price ?? p.mrp ?? p.price ?? p.sale_price ?? p.retail_price ?? p.unit_price ?? 0
                    );
                    const taxRate = Number(p.tax_percent ?? p.tax_rate ?? 0);
                    return (
                      <div
                        key={p.id}
                        className="p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 flex items-center justify-between transition"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900">{p.name || p.product_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                            <span>SKU: {p.sku || p.barcode || "N/A"}</span>
                            <span>•</span>
                            <span>Stock: {p.on_hand_stock ?? p.stock ?? p.initial_stock ?? "Available"}</span>
                            {taxRate > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-indigo-500 font-semibold">Tax: {taxRate}%</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-xs text-indigo-600">
                            {formatCurrency(price)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddExchangeItem(p)}
                            className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition"
                          >
                            + Add
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => setShowProductPicker(false)}
                  className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Printable Sales Return / Exchange Slip Modal ── */}
      {/* ── Standardized Printable Sales Return / Exchange Slip Modal ── */}
      <StandardVoucherModal
        isOpen={Boolean(selectedReturnSlip)}
        onClose={() => setSelectedReturnSlip(null)}
        voucher={
          selectedReturnSlip
            ? {
                voucherType: selectedReturnSlip.is_exchange ? "exchange" : "return",
                voucherNumber: selectedReturnSlip.return_number,
                voucherDate: selectedReturnSlip.return_date,
                originalInvoiceNo: selectedReturnSlip.original_invoice_no,
                originalInvoiceDate: selectedReturnSlip.original_invoice_date,
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
                  name: selectedReturnSlip.customer_name,
                  phone: selectedReturnSlip.customer_phone,
                  gstin: selectedReturnSlip.customer_gstin,
                },
                items: selectedReturnSlip.items.map((it) => ({
                  product_name: it.product_name,
                  sku: it.sku,
                  hsn_code: it.hsn_code,
                  quantity: it.returned_qty,
                  unit_price: it.unit_price,
                  tax_rate: it.tax_rate,
                  tax_amount: it.tax_amount,
                  line_total: it.total_amount,
                  reason: it.reason,
                  disposition: it.restock_disposition,
                })),
                exchangeItems: selectedReturnSlip.exchange_items?.map((ex) => ({
                  product_name: ex.product_name,
                  sku: ex.sku,
                  quantity: ex.quantity,
                  unit_price: ex.unit_price,
                  tax_rate: ex.tax_rate,
                  line_total: ex.total_amount,
                })),
                subtotal: selectedReturnSlip.subtotal,
                taxAmount: selectedReturnSlip.tax_amount,
                totalAmount: selectedReturnSlip.total_refund,
                settlementMethod: selectedReturnSlip.settlement_method,
                creditNoteNumber: selectedReturnSlip.credit_note_number,
                debitNoteNumber: selectedReturnSlip.debit_note_number,
                exchangeInvoiceNumber: selectedReturnSlip.exchange_invoice_number,
                exchangeTotal: selectedReturnSlip.exchange_total,
                difference: selectedReturnSlip.difference,
                reason: selectedReturnSlip.notes,
                notes: selectedReturnSlip.notes,
                cashierName: selectedReturnSlip.cashier_name || "Floor Cashier",
                restockedCount: selectedReturnSlip.restock_count,
              }
            : null
        }
      />
    </div>
  );
}
