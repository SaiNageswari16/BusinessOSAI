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
  Building2,
  Layers,
  FileText,
  X,
  RefreshCw,
  DollarSign,
  Package,
  Trash2,
  Check,
  ChevronRight,
  ArrowLeft,
  Receipt,
  CreditCard,
  Sparkles,
  Tag,
  Boxes,
  ShieldAlert,
  Truck,
  ChevronDown,
  Building,
  ScanBarcode,
} from "lucide-react";
import { inventoryApi } from "@/lib/api-client";
import { useTenant } from "@/contexts/tenant-context";
import { useCurrency } from "@/hooks/use-currency";
import { useStoreLocations } from "@/hooks/use-store-locations";
import { PaginationControl } from "@/components/ui/PaginationControl";
import { StandardVoucherModal, StandardVoucherData } from "../pos/StandardVoucherModal";
import { printThermalVoucher } from "@/lib/print-helper";

export interface PurchaseReturnItem {
  id: string;
  product_id?: string;
  product_name: string;
  sku?: string;
  batch_number?: string;
  purchased_qty: number;
  returned_qty: number;
  unit_cost: number;
  tax_rate: number;
  discount_amount: number;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  reason: string;
  restock_disposition: "deduct_stock" | "damaged" | "inspection";
}

export interface PurchaseExchangeItem {
  id: string;
  product_id?: string;
  product_name: string;
  sku?: string;
  quantity: number;
  unit_cost: number;
  tax_rate: number;
  total_amount: number;
}

export interface PurchaseReturnRecord {
  id: string;
  return_number: string;
  return_date: string;
  original_bill_no: string;
  original_bill_date?: string;
  supplier_id?: string;
  supplier_name: string;
  supplier_phone?: string;
  supplier_gstin?: string;
  settlement_method: "debit_note" | "cash_refund" | "bank_refund" | "exchange";
  settlement_status: "COMPLETED" | "PENDING" | "DEBIT_ISSUED";
  debit_note_number?: string;
  subtotal: number;
  tax_amount: number;
  total_return_value: number;
  total_items_returned: number;
  notes?: string;
  dispatch_location?: string;
  courier_awb?: string;
  created_at: string;
  items: PurchaseReturnItem[];
  // For exchanges
  is_exchange?: boolean;
  exchange_items?: PurchaseExchangeItem[];
  exchange_total?: number;
  difference?: number;
}

const RETURN_REASONS = [
  "Defective / Damaged Stock Received",
  "Wrong Items / Spec Mismatch Delivered",
  "Quality / Performance Issue",
  "Expired / Short Shelf-life Item",
  "Excess Stock / Return to Vendor",
  "Price / Billing Discrepancy",
  "Vendor Recall / Policy Return",
  "Other",
];

export function PurchaseReturns() {
  const { tenant } = useTenant();
  const currentTenantId = (tenant as any)?.raw?.tenant_id || (tenant as any)?.tenant_id || tenant?.id || "default";
  const currentCompanyId = tenant?.id || (tenant as any)?.raw?.id || (tenant as any)?.company_id || "default";
  const { currency, formatCurrency } = useCurrency();
  const { stores, selectedStore } = useStoreLocations();

  const storageKey = `purchase_returns_records_${currentTenantId}_${currentCompanyId}`;

  // View state: "register" | "return" | "exchange"
  const [activeTab, setActiveTab] = useState<"register" | "return" | "exchange">("register");
  const [returnsList, setReturnsList] = useState<PurchaseReturnRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters for Register
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "this_week" | "this_month">("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Modal voucher state
  const [selectedVoucher, setSelectedVoucher] = useState<StandardVoucherData | null>(null);

  // ── "Create Purchase Return / Exchange" Workflow States ──
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [vendorBills, setVendorBills] = useState<any[]>([]);
  const [searchBillQuery, setSearchBillQuery] = useState("");
  const [billFilter, setBillFilter] = useState<"all" | "unpaid" | "paid">("all");
  const [selectedBill, setSelectedBill] = useState<any | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");

  const [returnItemsState, setReturnItemsState] = useState<
    Record<
      string,
      {
        selected: boolean;
        returned_qty: number;
        reason: string;
        restock_disposition: "deduct_stock" | "damaged" | "inspection";
      }
    >
  >({});

  const [returnNumber, setReturnNumber] = useState<string>("");
  const [debitNoteNumber, setDebitNoteNumber] = useState<string>("");
  const [returnDate, setReturnDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [settlementMethod, setSettlementMethod] = useState<"debit_note" | "cash_refund" | "bank_refund">("debit_note");
  const [dispatchLocation, setDispatchLocation] = useState<string>(() => selectedStore || "Main Store");
  const [courierAwb, setCourierAwb] = useState<string>("");
  const [returnNotes, setReturnNotes] = useState<string>("Defective goods returned to vendor. Automated Debit Note issued against supplier ledger.");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Exchange State ──
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [exchangeItems, setExchangeItems] = useState<PurchaseExchangeItem[]>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);

  // Load existing purchase returns from backend API & localStorage fallback
  const loadReturns = async () => {
    try {
      setLoading(true);
      const [backendReturns, suppsRes, billsRes] = await Promise.all([
        inventoryApi.getPurchaseReturns().catch(() => []),
        inventoryApi.getSuppliers().catch(() => []),
        inventoryApi.getVendorBills().catch(() => []),
      ]);

      setSuppliers(suppsRes || []);
      setVendorBills(billsRes || []);

      const suppMap = new Map<string, any>();
      (suppsRes || []).forEach((s: any) => suppMap.set(String(s.id), s));

      const billMap = new Map<string, any>();
      (billsRes || []).forEach((b: any) => {
        billMap.set(String(b.id), b);
        if (b.bill_number) billMap.set(String(b.bill_number).toUpperCase(), b);
      });

      // Parse backend returns
      const mapped: PurchaseReturnRecord[] = (backendReturns || []).map((ret: any) => {
        const suppObj = suppMap.get(String(ret.supplier_id)) || {};
        const matchedBill = billMap.get(String(ret.vendor_bill_id || ret.purchase_order_id)) || {};
        const items = (ret.items || []).map((it: any, idx: number) => ({
          id: it.id || `it-${idx}`,
          product_id: it.product_id,
          product_name: it.product_name || "Returned Material",
          sku: it.sku || "",
          batch_number: it.batch_number || "",
          purchased_qty: Number(it.quantity_returned || 1),
          returned_qty: Number(it.quantity_returned || 1),
          unit_cost: Number(it.unit_cost || it.unit_price || 0),
          tax_rate: Number(it.tax_rate || 0),
          discount_amount: 0,
          subtotal: Number(it.unit_cost || it.unit_price || 0) * Number(it.quantity_returned || 1),
          tax_amount: 0,
          total_amount: Number(it.unit_cost || it.unit_price || 0) * Number(it.quantity_returned || 1),
          reason: ret.reason || "Defective Goods",
          restock_disposition: "deduct_stock" as const,
        }));

        const totalVal = Number(ret.total_amount || 0) || items.reduce((sum: number, it: any) => sum + it.total_amount, 0);

        return {
          id: ret.id,
          return_number: ret.return_number || `PRN-${String(ret.id).slice(0, 8)}`,
          return_date: ret.return_date ? String(ret.return_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
          original_bill_no: ret.po_number || ret.vendor_bill_number || matchedBill.bill_number || "Direct Return",
          supplier_id: ret.supplier_id || suppObj.id,
          supplier_name: ret.supplier_name || suppObj.name || matchedBill.supplier_name || "Target Vendor",
          supplier_phone: suppObj.phone || "",
          supplier_gstin: suppObj.gst_number || "",
          settlement_method: (ret.settlement_method as any) || "debit_note",
          settlement_status: "COMPLETED",
          debit_note_number: ret.debit_note_number || `DN-${String(ret.return_number || "").replace("PRN-", "")}`,
          subtotal: totalVal,
          tax_amount: 0,
          total_return_value: totalVal,
          total_items_returned: items.reduce((s: number, i: any) => s + i.returned_qty, 0) || items.length,
          notes: ret.reason,
          created_at: ret.created_at || new Date().toISOString(),
          items,
        };
      });

      // Merge with localStorage custom records (for instant reactivity & offline)
      let localRecords: PurchaseReturnRecord[] = [];
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          localRecords = JSON.parse(raw);
        }
      } catch (e) {}

      const combinedMap = new Map<string, PurchaseReturnRecord>();
      mapped.forEach((r) => combinedMap.set(r.return_number, r));
      localRecords.forEach((r) => combinedMap.set(r.return_number, r));

      const finalList = Array.from(combinedMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setReturnsList(finalList);
    } catch (err: any) {
      console.warn("Purchase returns load error:", err);
      toast.error(err.message || "Failed to load purchase returns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReturns();
  }, [storageKey]);

  // Load products catalog for exchanges & non-bill items
  useEffect(() => {
    inventoryApi
      .getProducts()
      .then((res: any) => setAvailableProducts(res?.items || (Array.isArray(res) ? res : [])))
      .catch(() => setAvailableProducts([]));
  }, []);

  // Initialize fresh return number & debit note number
  const resetFormState = () => {
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    setReturnNumber(`PRN-2026-${randomSeq}`);
    setDebitNoteNumber(`DN-2026-${randomSeq}`);
    setReturnDate(new Date().toISOString().slice(0, 10));
    setSelectedBill(null);
    setSelectedSupplierId("");
    setReturnItemsState({});
    setExchangeItems([]);
    setSettlementMethod("debit_note");
    setCourierAwb("");
    setReturnNotes("Defective goods returned to vendor. Automated Debit Note issued against supplier ledger.");
  };

  const handleStartReturn = () => {
    resetFormState();
    setActiveTab("return");
  };

  const handleStartExchange = () => {
    resetFormState();
    setActiveTab("exchange");
  };

  // When a purchase bill is clicked, populate line items
  const handleSelectBill = (bill: any) => {
    setSelectedBill(bill);
    if (bill.supplier_id) setSelectedSupplierId(bill.supplier_id);

    const rawItems = bill.items || bill.lines || bill.po_items || [];
    const itemMap: Record<string, any> = {};

    if (rawItems.length > 0) {
      rawItems.forEach((it: any, idx: number) => {
        const key = it.id || `item-${idx}`;
        const qty = Number(it.quantity || it.qty || 1);
        itemMap[key] = {
          selected: true,
          returned_qty: qty,
          reason: "Defective / Damaged Stock Received",
          restock_disposition: "deduct_stock",
        };
      });
    }
    setReturnItemsState(itemMap);
    toast.success(`Selected Purchase Bill #${bill.bill_number} (${bill.supplier_name || "Vendor"})`);
  };

  // Normalized items from the selected purchase bill
  const normalizedBillItems = useMemo(() => {
    if (!selectedBill) return [];
    const raw = selectedBill.items || selectedBill.lines || selectedBill.po_items || [];
    if (raw.length === 0) {
      const tot = Number(selectedBill.total_amount || 0);
      return [
        {
          id: "item-0",
          product_id: undefined,
          product_name: `Purchased Items (${selectedBill.bill_number})`,
          sku: "",
          purchased_qty: 1,
          unit_cost: tot,
          tax_rate: 0,
          batch_number: "",
        },
      ];
    }
    return raw.map((it: any, idx: number) => ({
      id: it.id || `item-${idx}`,
      product_id: it.product_id,
      product_name: it.product_name || it.name || "Purchased Material",
      sku: it.sku || it.hsn_code || "",
      purchased_qty: Number(it.quantity || it.qty || 1),
      unit_cost: Number(it.unit_price || it.rate || it.cost || 0),
      tax_rate: Number(it.tax_percent || it.tax_rate || 0),
      batch_number: it.batch_number || "",
    }));
  }, [selectedBill]);

  // Compute calculated return totals
  const returnFinancialSummary = useMemo(() => {
    let subtotal = 0;
    let taxAmount = 0;
    let totalUnits = 0;

    normalizedBillItems.forEach((it) => {
      const state = returnItemsState[it.id];
      if (state && state.selected && state.returned_qty > 0) {
        const lineSub = state.returned_qty * it.unit_cost;
        const lineTax = lineSub * (it.tax_rate / 100);
        subtotal += lineSub;
        taxAmount += lineTax;
        totalUnits += state.returned_qty;
      }
    });

    const totalReturnValue = subtotal + taxAmount;
    return {
      subtotal: Number(subtotal.toFixed(2)),
      taxAmount: Number(taxAmount.toFixed(2)),
      totalReturnValue: Number(totalReturnValue.toFixed(2)),
      totalUnits,
    };
  }, [normalizedBillItems, returnItemsState]);

  // Exchange replacement totals
  const exchangeReplacementTotal = useMemo(() => {
    return exchangeItems.reduce((acc, it) => acc + (it.quantity * it.unit_cost), 0);
  }, [exchangeItems]);

  const exchangeDifference = useMemo(() => {
    return Number((exchangeReplacementTotal - returnFinancialSummary.totalReturnValue).toFixed(2));
  }, [exchangeReplacementTotal, returnFinancialSummary.totalReturnValue]);

  // Submit Purchase Return
  const handleSubmitPurchaseReturn = async () => {
    if (returnFinancialSummary.totalUnits === 0) {
      toast.error("Please select at least one item to return with a quantity greater than 0.");
      return;
    }

    const selectedSupp = suppliers.find((s) => s.id === selectedSupplierId) || {
      name: selectedBill?.supplier_name || "Vendor",
      id: selectedSupplierId,
    };

    setIsSubmitting(true);
    try {
      const returnItemsPayload: PurchaseReturnItem[] = [];

      normalizedBillItems.forEach((it) => {
        const state = returnItemsState[it.id];
        if (state && state.selected && state.returned_qty > 0) {
          const lineSub = state.returned_qty * it.unit_cost;
          const lineTax = lineSub * (it.tax_rate / 100);
          returnItemsPayload.push({
            id: it.id,
            product_id: it.product_id,
            product_name: it.product_name,
            sku: it.sku,
            batch_number: it.batch_number,
            purchased_qty: it.purchased_qty,
            returned_qty: state.returned_qty,
            unit_cost: it.unit_cost,
            tax_rate: it.tax_rate,
            discount_amount: 0,
            subtotal: Number(lineSub.toFixed(2)),
            tax_amount: Number(lineTax.toFixed(2)),
            total_amount: Number((lineSub + lineTax).toFixed(2)),
            reason: state.reason,
            restock_disposition: state.restock_disposition,
          });
        }
      });

      // Backend API dispatch
      const apiPayload = {
        return_number: returnNumber,
        vendor_bill_id: selectedBill?.id || undefined,
        supplier_id: selectedSupplierId || selectedBill?.supplier_id || undefined,
        supplier_name: selectedSupp.name,
        debit_note_number: debitNoteNumber,
        settlement_method: settlementMethod,
        total_amount: returnFinancialSummary.totalReturnValue,
        reason: `[Resolution: ${settlementMethod.toUpperCase()}] [Bill: ${selectedBill?.bill_number || "Direct"}] [Notes: ${returnNotes}]`,
        items: returnItemsPayload.map((it) => ({
          product_id: it.product_id || availableProducts[0]?.id,
          quantity_returned: it.returned_qty,
        })),
      };

      await inventoryApi.createPurchaseReturn(apiPayload);

      // Save local record for immediate reactivity
      const newRecord: PurchaseReturnRecord = {
        id: `ret-${Date.now()}`,
        return_number: returnNumber,
        return_date: returnDate,
        original_bill_no: selectedBill?.bill_number || "Direct Return",
        original_bill_date: selectedBill?.bill_date,
        supplier_id: selectedSupplierId,
        supplier_name: selectedSupp.name,
        supplier_phone: selectedSupp.phone || "",
        supplier_gstin: selectedSupp.gst_number || "",
        settlement_method: settlementMethod,
        settlement_status: "COMPLETED",
        debit_note_number: debitNoteNumber,
        subtotal: returnFinancialSummary.subtotal,
        tax_amount: returnFinancialSummary.taxAmount,
        total_return_value: returnFinancialSummary.totalReturnValue,
        total_items_returned: returnFinancialSummary.totalUnits,
        notes: returnNotes,
        dispatch_location: dispatchLocation,
        courier_awb: courierAwb,
        created_at: new Date().toISOString(),
        items: returnItemsPayload,
      };

      const updatedList = [newRecord, ...returnsList];
      setReturnsList(updatedList);
      try {
        localStorage.setItem(storageKey, JSON.stringify(updatedList));
      } catch (e) {}

      toast.success(
        `Purchase Return ${returnNumber} processed! Debit Note ${debitNoteNumber} for ${formatCurrency(returnFinancialSummary.totalReturnValue)} issued to ${selectedSupp.name}.`
      );

      // Open voucher preview
      handleOpenVoucher(newRecord);
      setActiveTab("register");
    } catch (err: any) {
      toast.error(err.message || "Failed to process Purchase Return");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Purchase Exchange
  const handleSubmitPurchaseExchange = async () => {
    if (returnFinancialSummary.totalUnits === 0) {
      toast.error("Please select at least one item to return.");
      return;
    }
    if (exchangeItems.length === 0) {
      toast.error("Please add at least one replacement product received from the vendor.");
      return;
    }

    const selectedSupp = suppliers.find((s) => s.id === selectedSupplierId) || {
      name: selectedBill?.supplier_name || "Vendor",
      id: selectedSupplierId,
    };

    setIsSubmitting(true);
    try {
      const returnItemsPayload: PurchaseReturnItem[] = [];

      normalizedBillItems.forEach((it) => {
        const state = returnItemsState[it.id];
        if (state && state.selected && state.returned_qty > 0) {
          const lineSub = state.returned_qty * it.unit_cost;
          returnItemsPayload.push({
            id: it.id,
            product_id: it.product_id,
            product_name: it.product_name,
            sku: it.sku,
            batch_number: it.batch_number,
            purchased_qty: it.purchased_qty,
            returned_qty: state.returned_qty,
            unit_cost: it.unit_cost,
            tax_rate: it.tax_rate,
            discount_amount: 0,
            subtotal: Number(lineSub.toFixed(2)),
            tax_amount: 0,
            total_amount: Number(lineSub.toFixed(2)),
            reason: state.reason,
            restock_disposition: "deduct_stock",
          });
        }
      });

      // Submit return to backend
      await inventoryApi.createPurchaseReturn({
        return_number: returnNumber,
        vendor_bill_id: selectedBill?.id || undefined,
        supplier_id: selectedSupplierId || undefined,
        supplier_name: selectedSupp.name,
        debit_note_number: exchangeDifference < 0 ? debitNoteNumber : undefined,
        settlement_method: "exchange",
        total_amount: returnFinancialSummary.totalReturnValue,
        reason: `[Purchase Exchange] [Returned: ${formatCurrency(returnFinancialSummary.totalReturnValue)}] [Replacement: ${formatCurrency(exchangeReplacementTotal)}] [Diff: ${formatCurrency(exchangeDifference)}]`,
        items: returnItemsPayload.map((it) => ({
          product_id: it.product_id || availableProducts[0]?.id,
          quantity_returned: it.returned_qty,
        })),
      });

      const newRecord: PurchaseReturnRecord = {
        id: `pex-${Date.now()}`,
        return_number: returnNumber,
        return_date: returnDate,
        original_bill_no: selectedBill?.bill_number || "Direct Exchange",
        original_bill_date: selectedBill?.bill_date,
        supplier_id: selectedSupplierId,
        supplier_name: selectedSupp.name,
        supplier_phone: selectedSupp.phone || "",
        supplier_gstin: selectedSupp.gst_number || "",
        settlement_method: "exchange",
        settlement_status: "COMPLETED",
        debit_note_number: exchangeDifference < 0 ? debitNoteNumber : undefined,
        subtotal: returnFinancialSummary.subtotal,
        tax_amount: 0,
        total_return_value: returnFinancialSummary.totalReturnValue,
        total_items_returned: returnFinancialSummary.totalUnits,
        notes: `Exchange swapped. Difference: ${formatCurrency(exchangeDifference)} (${exchangeDifference > 0 ? "Payable to Vendor" : exchangeDifference < 0 ? "Debit Note Issued" : "Even Exchange"}).`,
        dispatch_location: dispatchLocation,
        courier_awb: courierAwb,
        created_at: new Date().toISOString(),
        items: returnItemsPayload,
        is_exchange: true,
        exchange_items: exchangeItems,
        exchange_total: exchangeReplacementTotal,
        difference: exchangeDifference,
      };

      const updatedList = [newRecord, ...returnsList];
      setReturnsList(updatedList);
      try {
        localStorage.setItem(storageKey, JSON.stringify(updatedList));
      } catch (e) {}

      toast.success(
        `Purchase Exchange completed! Difference: ${formatCurrency(exchangeDifference)}. Inventory & Supplier ledger updated.`
      );

      handleOpenVoucher(newRecord);
      setActiveTab("register");
    } catch (err: any) {
      toast.error(err.message || "Failed to process Purchase Exchange");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Convert PurchaseReturnRecord into StandardVoucherData for printing & viewing
  const handleOpenVoucher = (record: PurchaseReturnRecord) => {
    const voucherData: StandardVoucherData = {
      voucherType: record.is_exchange ? "exchange" : "return",
      voucherNumber: record.return_number,
      voucherDate: record.return_date,
      originalInvoiceNo: record.original_bill_no,
      originalInvoiceDate: record.original_bill_date,
      organization: {
        name: (tenant as any)?.trade_name || tenant?.name || "BusinessOS AI Global",
        address: (tenant as any)?.address || "Corporate Headquarters",
        city: (tenant as any)?.city || "Hyderabad",
        state: (tenant as any)?.state || "Telangana",
        pincode: (tenant as any)?.pincode || "500072",
        gstin: (tenant as any)?.gst_number || (tenant as any)?.gstin || "",
        phone: (tenant as any)?.phone || "",
      },
      customer: {
        name: record.supplier_name,
        phone: record.supplier_phone,
        gstin: record.supplier_gstin,
      },
      items: record.items.map((it) => ({
        product_name: it.product_name,
        sku: it.sku,
        quantity: it.returned_qty,
        unit_price: it.unit_cost,
        tax_rate: it.tax_rate,
        tax_amount: it.tax_amount,
        line_total: it.total_amount,
        reason: it.reason,
        disposition: it.restock_disposition,
      })),
      exchangeItems: record.exchange_items?.map((it) => ({
        product_name: it.product_name,
        sku: it.sku,
        quantity: it.quantity,
        unit_price: it.unit_cost,
        tax_rate: it.tax_rate,
        line_total: it.total_amount,
      })),
      subtotal: record.subtotal,
      taxAmount: record.tax_amount,
      totalAmount: record.total_return_value,
      settlementMethod: record.settlement_method,
      debitNoteNumber: record.debit_note_number,
      exchangeTotal: record.exchange_total,
      difference: record.difference,
      notes: record.notes,
      cashierName: "Store Manager",
      restockedCount: record.total_items_returned,
    };

    setSelectedVoucher(voucherData);
  };

  // Filtered returns for the register view
  const filteredReturns = useMemo(() => {
    return returnsList.filter((r) => {
      const matchSearch =
        !searchTerm.trim() ||
        r.return_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.original_bill_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.debit_note_number && r.debit_note_number.toLowerCase().includes(searchTerm.toLowerCase()));

      let matchDate = true;
      if (dateFilter !== "all") {
        const itemDate = new Date(r.created_at);
        const now = new Date();
        if (dateFilter === "today") {
          matchDate = itemDate.toDateString() === now.toDateString();
        } else if (dateFilter === "this_week") {
          const weekAgo = new Date();
          weekAgo.setDate(now.getDate() - 7);
          matchDate = itemDate >= weekAgo;
        } else if (dateFilter === "this_month") {
          matchDate = itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
        }
      }

      let matchMethod = true;
      if (methodFilter !== "all") {
        matchMethod = r.settlement_method === methodFilter;
      }

      return matchSearch && matchDate && matchMethod;
    });
  }, [returnsList, searchTerm, dateFilter, methodFilter]);

  const totalPages = Math.ceil(filteredReturns.length / pageSize) || 1;
  const paginatedReturns = filteredReturns.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Overall KPIs
  const kpis = useMemo(() => {
    const totalRecords = returnsList.length;
    const totalReturnValue = returnsList.reduce((sum, r) => sum + r.total_return_value, 0);
    const totalDeductedUnits = returnsList.reduce((sum, r) => sum + (r.total_items_returned || 0), 0);
    const totalExchanges = returnsList.filter((r) => r.is_exchange || r.settlement_method === "exchange").length;

    return {
      totalRecords,
      totalReturnValue,
      totalDeductedUnits,
      totalExchanges,
    };
  }, [returnsList]);

  // Filtered vendor bills for invoice lookup
  const filteredBills = useMemo(() => {
    return vendorBills.filter((b) => {
      const matchSearch =
        !searchBillQuery.trim() ||
        (b.bill_number && b.bill_number.toLowerCase().includes(searchBillQuery.toLowerCase())) ||
        (b.supplier_name && b.supplier_name.toLowerCase().includes(searchBillQuery.toLowerCase()));

      let matchStatus = true;
      if (billFilter === "unpaid") {
        matchStatus = b.status !== "Paid" && b.status !== "Completed";
      } else if (billFilter === "paid") {
        matchStatus = b.status === "Paid" || b.status === "Completed";
      }
      return matchSearch && matchStatus;
    });
  }, [vendorBills, searchBillQuery, billFilter]);

  return (
    <div className="w-full text-slate-800 space-y-5 pb-12">
      {/* ── View 1: Returns & Exchanges Register ── */}
      {activeTab === "register" && (
        <div className="space-y-5">
          {/* Top Title & Primary Action Buttons */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-600 grid place-items-center shadow-xs">
                  <RotateCcw className="size-5" />
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                  Purchase Returns & Exchanges
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {returnsList.length} Records
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-500 font-normal mt-1">
                Process vendor returns with automated debit note generation, inventory stock deduction, exchange replacement, and AP outstandings balance adjustment.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleStartReturn}
                className="h-10 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs rounded-xl shadow-xs hover:shadow transition-all flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="size-4" />
                <span>Process Return</span>
              </button>

              <button
                type="button"
                onClick={handleStartExchange}
                className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow-xs hover:shadow transition-all flex items-center gap-2 cursor-pointer"
              >
                <ArrowRightLeft className="size-4" />
                <span>Process Exchange</span>
              </button>
            </div>
          </div>

          {/* KPI Header Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Records</span>
                <span className="p-1.5 rounded-lg bg-slate-50 text-slate-500 border border-slate-100">
                  <FileText className="size-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2 font-mono">{kpis.totalRecords}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Returns & Exchanges</div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Return Value</span>
                <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-100">
                  <DollarSign className="size-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-rose-600 mt-2 font-mono">
                {formatCurrency(kpis.totalReturnValue)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Merchandise Credited / Debit Notes</div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Stock Deducted</span>
                <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <Package className="size-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-emerald-600 mt-2 font-mono">
                {kpis.totalDeductedUnits}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Physical Units Returned to Vendors</div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Exchanges</span>
                <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <ArrowRightLeft className="size-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-indigo-600 mt-2 font-mono">
                {kpis.totalExchanges}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Direct Material Swaps</div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <Search className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Return #, Purchase Bill #, Vendor Name, or Reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-none transition"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="h-9 px-3 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="this_week">This Week</option>
                <option value="this_month">This Month</option>
              </select>

              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="h-9 px-3 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
              >
                <option value="all">All Settlement Types</option>
                <option value="debit_note">Debit Note</option>
                <option value="cash_refund">Cash Refund</option>
                <option value="bank_refund">Bank Transfer</option>
                <option value="exchange">Exchange</option>
              </select>

              <button
                type="button"
                onClick={loadReturns}
                className="size-9 grid place-items-center bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 transition shadow-2xs cursor-pointer"
                title="Refresh List"
              >
                <RefreshCw className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Main Table */}
          <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
            {loading ? (
              <div className="py-20 text-center text-slate-400">
                <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-indigo-500" />
                <span className="text-xs font-bold">Loading purchase returns register...</span>
              </div>
            ) : filteredReturns.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <div className="size-12 rounded-2xl bg-rose-50 text-rose-500 grid place-items-center mx-auto border border-rose-100">
                  <RotateCcw className="size-6" />
                </div>
                <h3 className="text-base font-bold text-slate-800">No Purchase Returns Found</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {searchTerm || dateFilter !== "all" || methodFilter !== "all"
                    ? "No records matched your current filters. Try clearing the search term or filters."
                    : "No purchase returns or vendor exchanges recorded yet. Click Process Return to start."}
                </p>
                <button
                  type="button"
                  onClick={handleStartReturn}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="size-3.5" /> Start First Return
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">SLIP / DATE</th>
                      <th className="py-3 px-4">ORIGINAL BILL</th>
                      <th className="py-3 px-4">VENDOR / SUPPLIER</th>
                      <th className="py-3 px-4 text-center">ITEMS</th>
                      <th className="py-3 px-4 text-center">SETTLEMENT MODE</th>
                      <th className="py-3 px-4 text-right">RETURN VALUE</th>
                      <th className="py-3 px-4 text-center">STOCK DEDUCTED</th>
                      <th className="py-3 px-4 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedReturns.map((ret) => (
                      <tr key={ret.id} className="hover:bg-slate-50/70 transition-colors group">
                        {/* Slip / Date */}
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-slate-900">{ret.return_number}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                            <Calendar className="size-3" />
                            <span>{ret.return_date}</span>
                            {ret.debit_note_number && (
                              <span className="px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200 font-mono font-bold text-[9px]">
                                {ret.debit_note_number}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Original Bill */}
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50/70 px-2 py-0.5 rounded border border-indigo-100">
                            {ret.original_bill_no}
                          </span>
                        </td>

                        {/* Vendor */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            <Building2 className="size-3 text-slate-400" />
                            <span>{ret.supplier_name}</span>
                          </div>
                          {ret.supplier_gstin && (
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                              GSTIN: {ret.supplier_gstin}
                            </div>
                          )}
                        </td>

                        {/* Items */}
                        <td className="py-3 px-4 text-center">
                          <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full text-[11px]">
                            {ret.items?.length || 1}
                          </span>
                        </td>

                        {/* Settlement Mode */}
                        <td className="py-3 px-4 text-center">
                          {ret.settlement_method === "debit_note" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 uppercase tracking-wide">
                              Debit Note
                            </span>
                          ) : ret.settlement_method === "exchange" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wide">
                              Exchange
                            </span>
                          ) : ret.settlement_method === "cash_refund" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide">
                              Cash Refund
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wide">
                              Bank Refund
                            </span>
                          )}
                        </td>

                        {/* Return Value */}
                        <td className="py-3 px-4 text-right font-mono font-black text-rose-600 text-sm">
                          {formatCurrency(ret.total_return_value)}
                        </td>

                        {/* Stock Deducted */}
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="size-3" />
                            <span>{ret.total_items_returned || 1} Deducted</span>
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenVoucher(ret)}
                              className="size-7 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 grid place-items-center cursor-pointer transition shadow-2xs"
                              title="View & Print Voucher"
                            >
                              <Printer className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenVoucher(ret)}
                              className="size-7 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 grid place-items-center cursor-pointer transition shadow-2xs"
                              title="View Details"
                            >
                              <Eye className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {filteredReturns.length > pageSize && (
              <div className="p-3 border-t border-slate-100 flex justify-between items-center">
                <span className="text-xs text-slate-400">
                  Showing {(currentPage - 1) * pageSize + 1} to{" "}
                  {Math.min(currentPage * pageSize, filteredReturns.length)} of {filteredReturns.length} records
                </span>
                <PaginationControl
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── View 2: Process Purchase Return & View 3: Process Exchange ── */}
      {(activeTab === "return" || activeTab === "exchange") && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTab("register")}
                className="size-9 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 grid place-items-center cursor-pointer transition shadow-2xs"
                title="Back to Returns Register"
              >
                <ArrowLeft className="size-4" />
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                    {activeTab === "return" ? "Process Purchase Return to Vendor" : "Process Purchase Exchange with Vendor"}
                  </h2>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      activeTab === "return"
                        ? "bg-rose-50 text-rose-700 border border-rose-200"
                        : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                    }`}
                  >
                    {activeTab === "return" ? "Purchase Return & Debit Note" : "Material Exchange & AP Offset"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select a purchase bill to auto-populate items, specify return quantities, and issue an automatic debit note.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Voucher No</span>
                <span className="font-mono text-sm font-black text-slate-900 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                  {returnNumber}
                </span>
              </div>
            </div>
          </div>

          {/* Step 1: Select Original Purchase Invoice / Bill */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                  <span>1.</span> Select Original Purchase Invoice / Bill
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Picking a bill automatically loads its purchased line items, quantities, costs, and tax slabs.
                </p>
              </div>

              {selectedBill && (
                <button
                  type="button"
                  onClick={() => setSelectedBill(null)}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg transition cursor-pointer"
                >
                  Clear Selected Bill
                </button>
              )}
            </div>

            {selectedBill ? (
              <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-indigo-600 text-white grid place-items-center font-bold">
                    <Receipt className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black text-indigo-950">
                        {selectedBill.bill_number}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-indigo-700 border border-indigo-200">
                        {selectedBill.status || "Active Bill"}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5 flex items-center gap-2">
                      <span className="font-bold">{selectedBill.supplier_name || "Vendor"}</span>
                      <span>•</span>
                      <span>Date: {selectedBill.bill_date || "Recent"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Bill Amount</span>
                    <span className="font-mono text-base font-black text-slate-900">
                      {formatCurrency(selectedBill.total_amount || 0)}
                    </span>
                  </div>
                  {selectedBill.balance_due !== undefined && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Balance Due</span>
                      <span className="font-mono text-base font-black text-rose-600">
                        {formatCurrency(selectedBill.balance_due || 0)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                  <div className="relative flex-1">
                    <Search className="size-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search Purchase Invoice # or Vendor Name..."
                      value={searchBillQuery}
                      onChange={(e) => setSearchBillQuery(e.target.value)}
                      className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setBillFilter("all")}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                        billFilter === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      All Bills
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillFilter("unpaid")}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                        billFilter === "unpaid" ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      Unpaid Dues
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillFilter("paid")}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                        billFilter === "paid" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      Paid Bills
                    </button>
                  </div>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100 border border-slate-100 rounded-xl p-1 bg-slate-50/50">
                  {filteredBills.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No matching purchase invoices found.
                    </div>
                  ) : (
                    filteredBills.slice(0, 15).map((b) => (
                      <div
                        key={b.id}
                        onClick={() => handleSelectBill(b)}
                        className="p-2.5 hover:bg-white rounded-lg transition cursor-pointer flex items-center justify-between gap-3 group"
                      >
                        <div className="flex items-center gap-2.5">
                          <Receipt className="size-4 text-indigo-600 shrink-0" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition">
                                {b.bill_number}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">{b.bill_date}</span>
                            </div>
                            <div className="text-[11px] text-slate-600 font-bold flex items-center gap-1.5">
                              <span>{b.supplier_name || "Vendor"}</span>
                              {b.supplier?.gst_number && (
                                <span className="text-[9px] text-slate-400 font-mono">({b.supplier.gst_number})</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="font-mono text-xs font-black text-slate-900 block">
                              {formatCurrency(b.total_amount || 0)}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400">{b.status || "Bill"}</span>
                          </div>
                          <button
                            type="button"
                            className="px-2.5 py-1 bg-indigo-50 group-hover:bg-indigo-600 text-indigo-700 group-hover:text-white rounded-lg text-[11px] font-bold transition cursor-pointer"
                          >
                            Select
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Line Items to Return */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                  <span>2.</span> Returned Items & Dispositions
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Select which items are being returned to the vendor and specify the exact quantity.
                </p>
              </div>

              <span className="text-xs font-bold text-slate-500">
                {returnFinancialSummary.totalUnits} Units Selected
              </span>
            </div>

            {normalizedBillItems.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Please select a purchase bill above to load items.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={normalizedBillItems.every((it) => returnItemsState[it.id]?.selected)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            const updated: any = { ...returnItemsState };
                            normalizedBillItems.forEach((it) => {
                              updated[it.id] = {
                                ...(updated[it.id] || {
                                  reason: "Defective / Damaged Stock Received",
                                  restock_disposition: "deduct_stock",
                                }),
                                selected: checked,
                                returned_qty: checked ? it.purchased_qty : 0,
                              };
                            });
                            setReturnItemsState(updated);
                          }}
                          className="size-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-3">CATALOG PRODUCT & SKU</th>
                      <th className="py-2.5 px-3 text-center">PURCHASED</th>
                      <th className="py-2.5 px-3 text-center">RETURN QTY</th>
                      <th className="py-2.5 px-3 text-right">UNIT COST</th>
                      <th className="py-2.5 px-3 text-right">LINE DEBIT</th>
                      <th className="py-2.5 px-3">REASON FOR RETURN</th>
                      <th className="py-2.5 px-3">STOCK DISPOSITION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {normalizedBillItems.map((it) => {
                      const state = returnItemsState[it.id] || {
                        selected: false,
                        returned_qty: 0,
                        reason: "Defective / Damaged Stock Received",
                        restock_disposition: "deduct_stock",
                      };
                      const lineDebit = state.returned_qty * it.unit_cost;

                      return (
                        <tr
                          key={it.id}
                          className={`transition-colors ${
                            state.selected ? "bg-rose-50/20" : "opacity-60 hover:opacity-100"
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={Boolean(state.selected)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setReturnItemsState((prev) => ({
                                  ...prev,
                                  [it.id]: {
                                    ...state,
                                    selected: checked,
                                    returned_qty: checked ? it.purchased_qty : 0,
                                  },
                                }));
                              }}
                              className="size-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                            />
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-800">{it.product_name}</div>
                            <div className="text-[10px] font-mono text-slate-400">
                              {it.sku ? `SKU: ${it.sku}` : ""}
                              {it.batch_number ? ` • Batch: ${it.batch_number}` : ""}
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-500">
                            {it.purchased_qty}
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              min="1"
                              max={it.purchased_qty}
                              disabled={!state.selected}
                              value={state.returned_qty || ""}
                              onChange={(e) => {
                                const val = Math.max(0, Math.min(it.purchased_qty, parseInt(e.target.value) || 0));
                                setReturnItemsState((prev) => ({
                                  ...prev,
                                  [it.id]: {
                                    ...state,
                                    selected: val > 0,
                                    returned_qty: val,
                                  },
                                }));
                              }}
                              className="w-16 h-7 text-center font-mono font-bold bg-white border border-slate-200 rounded-lg outline-none focus:border-rose-500"
                            />
                          </td>

                          <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-600">
                            {formatCurrency(it.unit_cost)}
                          </td>

                          <td className="py-2.5 px-3 text-right font-mono font-black text-rose-600">
                            {formatCurrency(lineDebit)}
                          </td>

                          <td className="py-2.5 px-3">
                            <select
                              disabled={!state.selected}
                              value={state.reason}
                              onChange={(e) =>
                                setReturnItemsState((prev) => ({
                                  ...prev,
                                  [it.id]: { ...state, reason: e.target.value },
                                }))
                              }
                              className="h-7 px-2 text-[11px] bg-white border border-slate-200 rounded-lg outline-none focus:border-rose-500 max-w-[160px]"
                            >
                              {RETURN_REASONS.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="py-2.5 px-3">
                            <select
                              disabled={!state.selected}
                              value={state.restock_disposition}
                              onChange={(e) =>
                                setReturnItemsState((prev) => ({
                                  ...prev,
                                  [it.id]: { ...state, restock_disposition: e.target.value as any },
                                }))
                              }
                              className="h-7 px-2 text-[11px] bg-white border border-slate-200 rounded-lg outline-none focus:border-rose-500 max-w-[150px]"
                            >
                              <option value="deduct_stock">Deduct from Stock</option>
                              <option value="damaged">Scrap / Written-off</option>
                              <option value="inspection">Supplier Inspection</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* If in Exchange mode: Section for Replacement Products Received */}
          {activeTab === "exchange" && (
            <div className="bg-white p-4 rounded-2xl border border-indigo-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
                <div>
                  <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5 uppercase tracking-wide">
                    <span>3.</span> Replacement Products Received from Vendor
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Select replacement catalog items received from the vendor in swap for returned materials.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowProductPicker(true)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  <span>Add Replacement Item</span>
                </button>
              </div>

              {exchangeItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 bg-indigo-50/30 rounded-xl border border-dashed border-indigo-200">
                  No replacement items added yet. Click "+ Add Replacement Item" to pick replacement goods.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-indigo-50/60 border-b border-indigo-100 text-indigo-900 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-2 px-3">PRODUCT</th>
                        <th className="py-2 px-3 text-center">QUANTITY</th>
                        <th className="py-2 px-3 text-right">UNIT PRICE</th>
                        <th className="py-2 px-3 text-right">LINE TOTAL</th>
                        <th className="py-2 px-3 text-right">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-indigo-50">
                      {exchangeItems.map((ex, idx) => (
                        <tr key={ex.id}>
                          <td className="py-2 px-3 font-bold text-slate-800">{ex.product_name}</td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="number"
                              min="1"
                              value={ex.quantity}
                              onChange={(e) => {
                                const q = Math.max(1, parseInt(e.target.value) || 1);
                                setExchangeItems((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, quantity: q, total_amount: q * item.unit_cost } : item
                                  )
                                );
                              }}
                              className="w-16 h-7 text-center font-mono font-bold bg-white border border-slate-200 rounded-lg outline-none"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-medium">
                            {formatCurrency(ex.unit_cost)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-indigo-700">
                            {formatCurrency(ex.total_amount)}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => setExchangeItems((prev) => prev.filter((_, i) => i !== idx))}
                              className="size-6 text-slate-400 hover:text-rose-600 grid place-items-center cursor-pointer transition"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Financial Settlement & Resolution */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Metadata & Dispatch Details */}
            <div className="lg:col-span-2 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wide block">
                {activeTab === "return" ? "3. Resolution & Supplier AP Settlement" : "4. Exchange Settlement & Notes"}
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Settlement Method</label>
                  {activeTab === "return" ? (
                    <select
                      value={settlementMethod}
                      onChange={(e) => setSettlementMethod(e.target.value as any)}
                      className="w-full h-8 px-2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500"
                    >
                      <option value="debit_note">Debit Note (Deduct from AP)</option>
                      <option value="cash_refund">Cash Refund Received</option>
                      <option value="bank_refund">Bank Transfer Refund</option>
                    </select>
                  ) : (
                    <div className="h-8 px-2 flex items-center text-xs font-bold text-indigo-700 bg-indigo-50 rounded-lg border border-indigo-200">
                      Material Exchange Swap
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Debit Note No</label>
                  <input
                    type="text"
                    value={debitNoteNumber}
                    onChange={(e) => setDebitNoteNumber(e.target.value.toUpperCase())}
                    className="w-full h-8 px-2 text-xs font-mono font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Dispatch Warehouse</label>
                  <input
                    type="text"
                    value={dispatchLocation}
                    onChange={(e) => setDispatchLocation(e.target.value)}
                    className="w-full h-8 px-2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Courier AWB / Tracking No</label>
                  <input
                    type="text"
                    placeholder="e.g. BLUEDART-8932402"
                    value={courierAwb}
                    onChange={(e) => setCourierAwb(e.target.value)}
                    className="w-full h-8 px-2 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Return Notes / Memo</label>
                  <input
                    type="text"
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    className="w-full h-8 px-2 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Financial Summary Card */}
            <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-md flex flex-col justify-between space-y-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Financial Settlement Summary
                </span>

                <div className="mt-3 space-y-2 border-b border-slate-800 pb-3 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Returned Gross Value:</span>
                    <span className="font-mono font-bold">
                      {formatCurrency(returnFinancialSummary.totalReturnValue)}
                    </span>
                  </div>

                  {activeTab === "exchange" && (
                    <>
                      <div className="flex justify-between text-slate-300">
                        <span>Replacement Items Total:</span>
                        <span className="font-mono font-bold text-indigo-400">
                          {formatCurrency(exchangeReplacementTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-800 font-bold">
                        <span>Differential:</span>
                        <span
                          className={`font-mono ${
                            exchangeDifference > 0
                              ? "text-rose-400"
                              : exchangeDifference < 0
                              ? "text-emerald-400"
                              : "text-slate-300"
                          }`}
                        >
                          {exchangeDifference > 0
                            ? `+${formatCurrency(exchangeDifference)} (Payable)`
                            : exchangeDifference < 0
                            ? `-${formatCurrency(Math.abs(exchangeDifference))} (Credit/Debit Note)`
                            : "Even Exchange (₹0.00)"}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-3">
                  <span className="text-[10px] uppercase font-bold text-rose-300 block">
                    {activeTab === "return" ? "Total Debit Note Issued" : "Net Settlement Amount"}
                  </span>
                  <div className="text-2xl font-black font-mono text-white mt-1">
                    {activeTab === "return"
                      ? formatCurrency(returnFinancialSummary.totalReturnValue)
                      : formatCurrency(Math.abs(exchangeDifference))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  disabled={isSubmitting || returnFinancialSummary.totalUnits === 0}
                  onClick={activeTab === "return" ? handleSubmitPurchaseReturn : handleSubmitPurchaseExchange}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : activeTab === "return" ? (
                    <RotateCcw className="size-4" />
                  ) : (
                    <ArrowRightLeft className="size-4" />
                  )}
                  <span>
                    {isSubmitting
                      ? "Processing Return..."
                      : activeTab === "return"
                      ? "Issue Return & Generate Debit Note"
                      : "Issue Exchange & Adjust Accounts"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("register")}
                  className="w-full py-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
                >
                  Cancel & Discard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Picker Modal for Replacement Items in Exchange */}
      {showProductPicker && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Package className="size-4 text-indigo-600" />
                <span>Select Replacement Product from Catalog</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowProductPicker(false)}
                className="size-7 rounded-lg hover:bg-slate-100 grid place-items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="size-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search products by name or SKU..."
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-indigo-500"
              />
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
              {availableProducts
                .filter(
                  (p) =>
                    !productSearchQuery.trim() ||
                    p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
                    (p.sku && p.sku.toLowerCase().includes(productSearchQuery.toLowerCase()))
                )
                .slice(0, 20)
                .map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      const cost = Number(p.purchase_price || p.cost_price || p.price || 100);
                      setExchangeItems((prev) => [
                        ...prev,
                        {
                          id: `ex-${Date.now()}-${p.id}`,
                          product_id: p.id,
                          product_name: p.name,
                          sku: p.sku || "",
                          quantity: 1,
                          unit_cost: cost,
                          tax_rate: Number(p.tax_rate || 0),
                          total_amount: cost,
                        },
                      ]);
                      setShowProductPicker(false);
                      toast.success(`Added replacement product: ${p.name}`);
                    }}
                    className="p-2.5 hover:bg-indigo-50/60 rounded-lg transition cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-800">{p.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {p.sku ? `SKU: ${p.sku}` : "Catalog Item"} • Stock: {p.initial_stock || 0}
                      </div>
                    </div>
                    <span className="font-mono font-bold text-xs text-indigo-700">
                      {formatCurrency(p.purchase_price || p.cost_price || p.price || 0)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Standard Voucher Modal for Return Slips & Debit Notes */}
      {selectedVoucher && (
        <StandardVoucherModal
          isOpen={Boolean(selectedVoucher)}
          onClose={() => setSelectedVoucher(null)}
          voucher={selectedVoucher}
        />
      )}
    </div>
  );
}
