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
import { invoicesApi, posApi } from "@/lib/api-client";
import { useTenant } from "@/contexts/tenant-context";
import { useCurrency } from "@/hooks/use-currency";
import { PaginationControl } from "@/components/ui/PaginationControl";

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

export interface SalesReturnRecord {
  id: string;
  return_number: string;
  return_date: string;
  original_invoice_no: string;
  original_invoice_date?: string;
  customer_name: string;
  customer_phone?: string;
  customer_gstin?: string;
  settlement_method: "cash" | "upi" | "store_credit" | "credit_note";
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

export function PosSalesReturns() {
  const { tenant } = useTenant();
  const currentTenantId = (tenant as any)?.raw?.tenant_id || (tenant as any)?.tenant_id || tenant?.id || "default";
  const currentCompanyId = tenant?.id || (tenant as any)?.raw?.id || (tenant as any)?.company_id || "default";
  const { formatCurrency } = useCurrency();

  const storageKey = `pos_sales_returns_${currentTenantId}_${currentCompanyId}`;

  // View state: "register" | "create"
  const [activeTab, setActiveTab] = useState<"register" | "create">("register");
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

  // ── "Create Return" Workflow States ──
  const [searchInvoiceQuery, setSearchInvoiceQuery] = useState("");
  const [isSearchingInvoice, setIsSearchingInvoice] = useState(false);
  const [recentBills, setRecentBills] = useState<any[]>([]);
  const [selectedBill, setSelectedBill] = useState<any | null>(null);
  const [returnItemsState, setReturnItemsState] = useState<Record<string, {
    selected: boolean;
    returned_qty: number;
    reason: string;
    restock_disposition: "restock" | "damaged" | "inspection";
  }>>({});
  const [settlementMethod, setSettlementMethod] = useState<"cash" | "upi" | "store_credit" | "credit_note">("cash");
  const [returnNotes, setReturnNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing returns from localStorage (or pre-seed if empty)
  useEffect(() => {
    try {
      setLoading(true);
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setReturnsList(parsed);
          setLoading(false);
          return;
        }
      }

      // Pre-seed 3 realistic return records for instant presentation
      const initialSeed: SalesReturnRecord[] = [
        {
          id: "ret-seed-1",
          return_number: "SRET-20251011-001",
          return_date: new Date().toISOString().slice(0, 10),
          original_invoice_no: "REC-2025-1042",
          original_invoice_date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
          customer_name: "Rahul Verma",
          customer_phone: "+91 98765 43210",
          customer_gstin: "",
          settlement_method: "cash",
          settlement_status: "COMPLETED",
          subtotal: 1499.00,
          tax_amount: 179.88,
          total_refund: 1678.88,
          restock_count: 1,
          total_items_returned: 1,
          notes: "Item unopened in original box. Verified by manager.",
          cashier_name: "Counter 1",
          created_at: new Date().toISOString(),
          items: [
            {
              id: "item-seed-1",
              product_name: "Wireless Ergonomic Mouse",
              sku: "ACC-MOU-09",
              hsn_code: "84716060",
              purchased_qty: 1,
              returned_qty: 1,
              unit_price: 1499.00,
              tax_rate: 12,
              discount_amount: 0,
              subtotal: 1499.00,
              tax_amount: 179.88,
              total_amount: 1678.88,
              reason: "Customer Changed Mind",
              restock_disposition: "restock",
            },
          ],
        },
        {
          id: "ret-seed-2",
          return_number: "SRET-20251010-002",
          return_date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
          original_invoice_no: "INV-2025-0891",
          original_invoice_date: new Date(Date.now() - 259200000).toISOString().slice(0, 10),
          customer_name: "Apex Retail Solutions",
          customer_phone: "+91 98480 12345",
          customer_gstin: "37AAACG1234F1Z5",
          settlement_method: "credit_note",
          settlement_status: "COMPLETED",
          subtotal: 4200.00,
          tax_amount: 756.00,
          total_refund: 4956.00,
          restock_count: 2,
          total_items_returned: 2,
          notes: "Issued statutory Credit Note CN-2025-004 to client ledger.",
          cashier_name: "Admin",
          created_at: new Date(Date.now() - 86400000).toISOString(),
          items: [
            {
              id: "item-seed-2",
              product_name: "Thermal Barcode Ribbon (Pack of 5)",
              sku: "SUP-RIB-02",
              hsn_code: "96121010",
              purchased_qty: 5,
              returned_qty: 2,
              unit_price: 2100.00,
              tax_rate: 18,
              discount_amount: 0,
              subtotal: 4200.00,
              tax_amount: 756.00,
              total_amount: 4956.00,
              reason: "Wrong Item Delivered / Billed",
              restock_disposition: "restock",
            },
          ],
        },
        {
          id: "ret-seed-3",
          return_number: "SRET-20251009-003",
          return_date: new Date(Date.now() - 172800000).toISOString().slice(0, 10),
          original_invoice_no: "REC-2025-1033",
          original_invoice_date: new Date(Date.now() - 172800000).toISOString().slice(0, 10),
          customer_name: "Sneha Reddy",
          customer_phone: "+91 97000 88991",
          customer_gstin: "",
          settlement_method: "store_credit",
          settlement_status: "COMPLETED",
          subtotal: 890.00,
          tax_amount: 44.50,
          total_refund: 934.50,
          restock_count: 0,
          total_items_returned: 1,
          notes: "Defective stitching. Tagged for vendor return & quarantined.",
          cashier_name: "Floor Register",
          created_at: new Date(Date.now() - 172800000).toISOString(),
          items: [
            {
              id: "item-seed-3",
              product_name: "Cotton Canvas Tote Bag",
              sku: "APP-TOT-05",
              hsn_code: "42022200",
              purchased_qty: 1,
              returned_qty: 1,
              unit_price: 890.00,
              tax_rate: 5,
              discount_amount: 0,
              subtotal: 890.00,
              tax_amount: 44.50,
              total_amount: 934.50,
              reason: "Defective / Damaged Item",
              restock_disposition: "damaged",
            },
          ],
        },
      ];

      localStorage.setItem(storageKey, JSON.stringify(initialSeed));
      setReturnsList(initialSeed);
    } catch (e) {
      console.warn("Sales returns load error:", e);
    } finally {
      setLoading(false);
    }
  }, [storageKey]);

  // Load recent bills when opening "create" view for fast selection
  useEffect(() => {
    if (activeTab === "create") {
      fetchRecentBills();
    }
  }, [activeTab]);

  const fetchRecentBills = async () => {
    try {
      const candidates: any[] = [];
      // 1. From posApi
      const posHist: any = await posApi.getHistory({ limit: 50 }).catch(() => null);
      if (Array.isArray(posHist)) {
        candidates.push(...posHist);
      } else if (posHist?.items) {
        candidates.push(...posHist.items);
      }

      // 2. From localStorage pos_saved_invoices
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("pos_saved_invoices")) {
          const item = localStorage.getItem(k);
          if (item) {
            try {
              const parsed = JSON.parse(item);
              if (Array.isArray(parsed)) {
                candidates.push(...parsed);
              }
            } catch (e) {}
          }
        }
      }

      // 3. From ERP invoicesApi
      const erpRes: any = await invoicesApi.listInvoices({ page_size: 30 }).catch(() => null);
      if (erpRes?.items) {
        candidates.push(...erpRes.items);
      } else if (Array.isArray(erpRes)) {
        candidates.push(...erpRes);
      }

      // Deduplicate by receipt / invoice number
      const seen = new Set<string>();
      const uniqueBills: any[] = [];
      candidates.forEach((b) => {
        const num = b.receipt_number || b.invoice_number || b.id;
        if (num && !seen.has(num)) {
          seen.add(num);
          uniqueBills.push(b);
        }
      });

      setRecentBills(uniqueBills.slice(0, 10));
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

      // 1. Search in posApi
      const posHist: any = await posApi.getHistory({ limit: 1000 }).catch(() => []);
      const histList = Array.isArray(posHist) ? posHist : (posHist?.items || []);
      found = histList.find((t: any) =>
        t.receipt_number?.toLowerCase() === q.toLowerCase() ||
        t.id?.toLowerCase() === q.toLowerCase() ||
        t.customer_phone?.includes(q) ||
        t.customer_name?.toLowerCase().includes(q.toLowerCase())
      );

      // 2. Search in localStorage
      if (!found) {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("pos_saved_invoices")) {
            const raw = localStorage.getItem(k);
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                  found = parsed.find((b: any) =>
                    b.receipt_number?.toLowerCase() === q.toLowerCase() ||
                    b.invoice_number?.toLowerCase() === q.toLowerCase() ||
                    b.id?.toLowerCase() === q.toLowerCase() ||
                    b.customer_phone?.includes(q) ||
                    b.customer_name?.toLowerCase().includes(q.toLowerCase())
                  );
                  if (found) break;
                }
              } catch (e) {}
            }
          }
        }
      }

      // 3. Search in ERP invoices
      if (!found) {
        const erpRes: any = await invoicesApi.listInvoices({ search: q }).catch(() => null);
        const invList = erpRes?.items || erpRes?.data || (Array.isArray(erpRes) ? erpRes : []);
        const matched = invList.find((inv: any) =>
          inv.invoice_number?.toLowerCase() === q.toLowerCase() ||
          inv.id?.toLowerCase() === q.toLowerCase() ||
          inv.customer_phone?.includes(q) ||
          inv.customer_name?.toLowerCase().includes(q.toLowerCase())
        );
        if (matched) {
          found = await invoicesApi.getInvoice(matched.id).catch(() => matched);
        }
      }

      if (found) {
        selectBillForReturn(found);
        toast.success(`Found Bill: ${found.receipt_number || found.invoice_number || found.id}`);
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
    // Parse items
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
      // Single item fallback from total
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

  // Normalized items of selected bill
  const selectedBillNormalizedItems = useMemo(() => {
    if (!selectedBill) return [];
    const raw = selectedBill.items || selectedBill.lines || selectedBill.invoice_items || [];
    if (raw.length === 0) {
      const tot = Number(selectedBill.total_amount || selectedBill.grand_total || selectedBill.total || 0);
      return [{
        id: "item-0",
        product_name: selectedBill.receipt_number ? `General Sale (${selectedBill.receipt_number})` : "Store Merchandise",
        sku: "GEN-SKU",
        hsn_code: "9983",
        purchased_qty: 1,
        unit_price: tot > 0 ? tot / 1.18 : 0,
        tax_rate: 18,
        discount_amount: 0,
        subtotal: tot > 0 ? tot / 1.18 : 0,
      }];
    }
    return raw.map((it: any, idx: number) => {
      const qty = Number(it.quantity || it.qty || 1);
      const unitPrice = Number(it.unit_price || it.price || it.rate || 0);
      const taxRate = Number(it.tax_rate || it.gst_rate || 18);
      const discount = Number(it.discount_amount || it.discount || 0);
      const subtotal = Number(it.line_total || it.subtotal || (unitPrice * qty));
      return {
        id: it.id || `item-${idx}`,
        product_name: it.product_name || it.name || it.item_name || `Product #${idx + 1}`,
        sku: it.sku || it.product_sku || it.code || `SKU-${idx + 1}`,
        hsn_code: it.hsn_code || it.hsn || "—",
        purchased_qty: qty,
        unit_price: unitPrice || (subtotal / qty),
        tax_rate: taxRate,
        discount_amount: discount,
        subtotal: subtotal,
      };
    });
  }, [selectedBill]);

  // Compute live return totals
  const returnTotals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    let totalItems = 0;
    let restockCount = 0;

    selectedBillNormalizedItems.forEach((it) => {
      const state = returnItemsState[it.id];
      if (state && state.selected && state.returned_qty > 0) {
        const itemSubtotal = (it.unit_price * state.returned_qty);
        const itemTax = (itemSubtotal * (it.tax_rate / 100));
        subtotal += itemSubtotal;
        tax += itemTax;
        totalItems += state.returned_qty;
        if (state.restock_disposition === "restock") {
          restockCount += state.returned_qty;
        }
      }
    });

    const totalRefund = subtotal + tax;
    return {
      subtotal: Number(subtotal.toFixed(2)),
      tax_amount: Number(tax.toFixed(2)),
      total_refund: Number(totalRefund.toFixed(2)),
      total_items: totalItems,
      restock_count: restockCount,
    };
  }, [selectedBillNormalizedItems, returnItemsState]);

  // Finalize Sales Return
  const handleSubmitReturn = async () => {
    if (!selectedBill) {
      toast.error("Please look up and select a bill first.");
      return;
    }

    if (returnTotals.total_items === 0) {
      toast.error("Please select at least one item to return with quantity greater than 0.");
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const dateCompact = dateStr.replace(/-/g, "");
      const randomSeq = Math.floor(1000 + Math.random() * 9000);
      const returnNumber = `SRET-${dateCompact}-${randomSeq}`;

      const returnedItemsList: SalesReturnItem[] = [];
      selectedBillNormalizedItems.forEach((it) => {
        const state = returnItemsState[it.id];
        if (state && state.selected && state.returned_qty > 0) {
          const itemSubtotal = Number((it.unit_price * state.returned_qty).toFixed(2));
          const itemTax = Number((itemSubtotal * (it.tax_rate / 100)).toFixed(2));
          returnedItemsList.push({
            id: `ret-item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            product_id: it.id,
            product_name: it.product_name,
            sku: it.sku,
            hsn_code: it.hsn_code,
            purchased_qty: it.purchased_qty,
            returned_qty: state.returned_qty,
            unit_price: it.unit_price,
            tax_rate: it.tax_rate,
            discount_amount: 0,
            subtotal: itemSubtotal,
            tax_amount: itemTax,
            total_amount: Number((itemSubtotal + itemTax).toFixed(2)),
            reason: state.reason,
            restock_disposition: state.restock_disposition,
          });
        }
      });

      const newReturnRecord: SalesReturnRecord = {
        id: `ret-${Date.now()}`,
        return_number: returnNumber,
        return_date: dateStr,
        original_invoice_no: selectedBill.receipt_number || selectedBill.invoice_number || selectedBill.id,
        original_invoice_date: selectedBill.created_at?.slice(0, 10) || selectedBill.invoice_date || dateStr,
        customer_name: selectedBill.customer_name || selectedBill.customer?.name || "Walk-in Guest",
        customer_phone: selectedBill.customer_phone || selectedBill.phone || "",
        customer_gstin: selectedBill.customer_gstin || selectedBill.gstin || "",
        settlement_method: settlementMethod,
        settlement_status: "COMPLETED",
        subtotal: returnTotals.subtotal,
        tax_amount: returnTotals.tax_amount,
        total_refund: returnTotals.total_refund,
        restock_count: returnTotals.restock_count,
        total_items_returned: returnTotals.total_items,
        notes: returnNotes.trim() || undefined,
        cashier_name: "Floor Cashier",
        created_at: now.toISOString(),
        items: returnedItemsList,
      };

      // Save to localStorage
      const updatedList = [newReturnRecord, ...returnsList];
      setReturnsList(updatedList);
      localStorage.setItem(storageKey, JSON.stringify(updatedList));

      // Also if settlementMethod is credit_note, persist a Credit Note record into pos_saved_invoices
      if (settlementMethod === "credit_note") {
        try {
          const cnKey = `pos_saved_invoices_${currentTenantId}_${currentCompanyId}`;
          const existingRaw = localStorage.getItem(cnKey) || "[]";
          const existingInvs = JSON.parse(existingRaw);
          const creditNoteRecord = {
            id: `cn-${Date.now()}`,
            invoice_number: `CN-${dateCompact}-${randomSeq}`,
            original_invoice_ref: newReturnRecord.original_invoice_no,
            invoice_type: "CREDIT_NOTE",
            customer_name: newReturnRecord.customer_name,
            customer_phone: newReturnRecord.customer_phone,
            customer_gstin: newReturnRecord.customer_gstin,
            subtotal: newReturnRecord.subtotal,
            tax_amount: newReturnRecord.tax_amount,
            total_amount: newReturnRecord.total_refund,
            status: "ISSUED",
            created_at: now.toISOString(),
            is_credit_note: true,
            is_sales_return: true,
            items: returnedItemsList.map((i) => ({
              item_name: i.product_name,
              hsn_code: i.hsn_code,
              quantity: i.returned_qty,
              unit_price: i.unit_price,
              tax_rate: i.tax_rate,
              taxable_amount: i.subtotal,
              total_amount: i.total_amount,
            })),
          };
          localStorage.setItem(cnKey, JSON.stringify([creditNoteRecord, ...existingInvs]));
        } catch (cnErr) {
          console.warn("Could not save credit note duplicate:", cnErr);
        }
      }

      toast.success(`Sales Return ${returnNumber} processed successfully!`);
      setSelectedReturnSlip(newReturnRecord);
      // Reset form
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

  // Delete return record
  const handleDeleteReturn = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to remove this sales return record?")) {
      const updated = returnsList.filter((r) => r.id !== id);
      setReturnsList(updated);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      toast.success("Sales return record removed.");
    }
  };

  // Filtered returns list for Register
  const filteredReturns = useMemo(() => {
    return returnsList.filter((r) => {
      // Search
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        r.return_number.toLowerCase().includes(q) ||
        r.original_invoice_no.toLowerCase().includes(q) ||
        r.customer_name.toLowerCase().includes(q) ||
        (r.customer_phone && r.customer_phone.includes(q));

      // Method
      const matchMethod = methodFilter === "all" || r.settlement_method === methodFilter;

      // Date
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

  // Paginated items
  const paginatedReturns = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReturns.slice(start, start + pageSize);
  }, [filteredReturns, currentPage, pageSize]);

  // High-level KPI Stats
  const kpiStats = useMemo(() => {
    const totalCount = returnsList.length;
    const totalRefundVal = returnsList.reduce((s, r) => s + r.total_refund, 0);
    const totalRestocked = returnsList.reduce((s, r) => s + r.restock_count, 0);
    const totalTaxReversed = returnsList.reduce((s, r) => s + r.tax_amount, 0);
    return { totalCount, totalRefundVal, totalRestocked, totalTaxReversed };
  }, [returnsList]);

  const printSlip = () => {
    window.print();
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
                  {returnsList.length} Returns
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Process customer merchandise returns, restock inventory, issue refunds, store credits or GST credit notes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === "register" ? (
              <button
                onClick={() => {
                  setSelectedBill(null);
                  setActiveTab("create");
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                Process New Return
              </button>
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
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Returns</span>
              <RotateCcw className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-2xl font-black text-slate-900 mt-1">{kpiStats.totalCount}</p>
            <span className="text-[10px] text-slate-400">Processed Slips</span>
          </div>

          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Refund Value</span>
              <DollarSign className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-2xl font-black text-rose-600 mt-1">{formatCurrency(kpiStats.totalRefundVal)}</p>
            <span className="text-[10px] text-slate-400">Net Refund Outflow</span>
          </div>

          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Items Restocked</span>
              <Package className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-emerald-600 mt-1">{kpiStats.totalRestocked}</p>
            <span className="text-[10px] text-slate-400">Returned to Floor Stock</span>
          </div>

          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tax Reversed</span>
              <ShieldCheck className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-black text-amber-600 mt-1">{formatCurrency(kpiStats.totalTaxReversed)}</p>
            <span className="text-[10px] text-slate-400">GST Output Reversal</span>
          </div>
        </div>
      </div>

      {/* ── Main Body ── */}
      <div className="p-6">
        {activeTab === "register" ? (
          /* ══════════════════ TAB 1: RETURNS REGISTER ══════════════════ */
          <div className="space-y-4">
            {/* Filter bar */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by Return Slip #, Bill #, Customer Name or Mobile..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={dateFilter}
                  onChange={(e: any) => setDateFilter(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="this_week">Past 7 Days</option>
                  <option value="this_month">This Month</option>
                </select>

                <select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Settlement Modes</option>
                  <option value="cash">Cash Refund</option>
                  <option value="upi">UPI Transfer</option>
                  <option value="store_credit">Store Credit</option>
                  <option value="credit_note">Credit Note (GST)</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[11px]">
                    <tr>
                      <th className="px-4 py-3.5">Return Slip #</th>
                      <th className="px-4 py-3.5">Date</th>
                      <th className="px-4 py-3.5">Original Bill #</th>
                      <th className="px-4 py-3.5">Customer</th>
                      <th className="px-4 py-3.5">Items Returned</th>
                      <th className="px-4 py-3.5 text-center">Restock Disposition</th>
                      <th className="px-4 py-3.5 text-center">Settlement Mode</th>
                      <th className="px-4 py-3.5 text-right">Tax Reversal</th>
                      <th className="px-4 py-3.5 text-right">Refund Total</th>
                      <th className="px-4 py-3.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {loading ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                          Loading Sales Returns...
                        </td>
                      </tr>
                    ) : paginatedReturns.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-16 text-center text-slate-400">
                          <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                          <p className="font-semibold text-slate-600">No sales return records found.</p>
                          <p className="text-xs text-slate-400 mt-1">
                            Click &quot;Process New Return&quot; above to issue a customer return slip.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      paginatedReturns.map((ret) => (
                        <tr
                          key={ret.id}
                          onClick={() => setSelectedReturnSlip(ret)}
                          className="hover:bg-slate-50/80 transition cursor-pointer"
                        >
                          <td className="px-4 py-3 font-mono font-bold text-rose-600">
                            {ret.return_number}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{ret.return_date}</td>
                          <td className="px-4 py-3 font-mono font-semibold text-indigo-600">
                            {ret.original_invoice_no}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{ret.customer_name}</div>
                            {ret.customer_phone && (
                              <div className="text-[10px] text-slate-400">{ret.customer_phone}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-slate-800">{ret.total_items_returned} item(s)</span>
                            <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                              {ret.items.map((i) => i.product_name).join(", ")}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {ret.restock_count > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                {ret.restock_count} Restocked
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <AlertTriangle className="w-3 h-3" />
                                Quarantined / Scrapped
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                ret.settlement_method === "cash"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : ret.settlement_method === "credit_note"
                                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                  : ret.settlement_method === "store_credit"
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200"
                              }`}
                            >
                              {ret.settlement_method.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-600">
                            {formatCurrency(ret.tax_amount)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 text-[13px]">
                            {formatCurrency(ret.total_refund)}
                          </td>
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setSelectedReturnSlip(ret)}
                                title="View & Print Return Slip"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => handleDeleteReturn(ret.id, e)}
                                title="Delete Return Slip"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {filteredReturns.length > 0 && (
                <div className="p-3 border-t border-slate-100 bg-slate-50/50">
                  <PaginationControl
                    currentPage={currentPage}
                    pageSize={pageSize}
                    totalItems={filteredReturns.length}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setPageSize}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ══════════════════ TAB 2: CREATE NEW SALES RETURN ══════════════════ */
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Step 1: Lookup Bill */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Step 1: Look Up Original Bill / Invoice</h2>
                  <p className="text-xs text-slate-500">
                    Search for the POS receipt number, ERP tax invoice, or customer mobile number.
                  </p>
                </div>
                {selectedBill && (
                  <button
                    onClick={() => {
                      setSelectedBill(null);
                      setReturnItemsState({});
                    }}
                    className="text-xs font-semibold text-rose-600 hover:underline"
                  >
                    Change Bill
                  </button>
                )}
              </div>

              {!selectedBill ? (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={searchInvoiceQuery}
                        onChange={(e) => setSearchInvoiceQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleLookupInvoice()}
                        placeholder="e.g. REC-2025-1042, INV-2025-0891, or Mobile Number..."
                        className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                      />
                    </div>
                    <button
                      onClick={() => handleLookupInvoice()}
                      disabled={isSearchingInvoice}
                      className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition flex items-center gap-2"
                    >
                      {isSearchingInvoice ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Searching...
                        </>
                      ) : (
                        <>
                          <Search className="w-3.5 h-3.5" />
                          Find Bill
                        </>
                      )}
                    </button>
                  </div>

                  {/* Recent Bills Quick Pick */}
                  {recentBills.length > 0 && (
                    <div className="pt-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Recent Invoices / Receipts
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {recentBills.map((b, idx) => {
                          const num = b.receipt_number || b.invoice_number || b.id;
                          const cust = b.customer_name || b.customer?.name || "Guest";
                          const amt = b.total_amount || b.grand_total || b.total || 0;
                          return (
                            <button
                              key={idx}
                              onClick={() => selectBillForReturn(b)}
                              className="text-left px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 transition text-xs"
                            >
                              <span className="font-mono font-bold text-indigo-600">{num}</span>
                              <span className="text-slate-500 text-[11px] ml-1.5">({cust} • {formatCurrency(amt)})</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Selected Bill Summary Card */
                <div className="bg-indigo-50/60 border border-indigo-200/80 rounded-xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                        <Receipt className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase text-indigo-600 tracking-wider">Original Bill</span>
                          <span className="font-mono font-black text-slate-900 text-sm">
                            {selectedBill.receipt_number || selectedBill.invoice_number || selectedBill.id}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Date: <span className="font-semibold">{selectedBill.created_at?.slice(0, 10) || selectedBill.invoice_date || "Today"}</span> •
                          Customer: <span className="font-semibold">{selectedBill.customer_name || "Walk-in Guest"}</span>
                          {selectedBill.customer_phone ? ` (${selectedBill.customer_phone})` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Original Amount</div>
                      <div className="text-lg font-black text-indigo-700">
                        {formatCurrency(Number(selectedBill.total_amount || selectedBill.grand_total || selectedBill.total || 0))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Line Items Selection */}
            {selectedBill && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Step 2: Select Items & Return Quantities</h2>
                  <p className="text-xs text-slate-500">
                    Check the items being returned, adjust returned quantity, specify reason and restock disposition.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[11px]">
                      <tr>
                        <th className="px-4 py-3 w-10 text-center">Return</th>
                        <th className="px-4 py-3">Item Description</th>
                        <th className="px-4 py-3 text-center">Purchased Qty</th>
                        <th className="px-4 py-3 text-center">Return Qty</th>
                        <th className="px-4 py-3 text-right">Unit Price</th>
                        <th className="px-4 py-3 text-right">Tax Rate</th>
                        <th className="px-4 py-3">Return Reason</th>
                        <th className="px-4 py-3 text-center">Restock Disposition</th>
                        <th className="px-4 py-3 text-right">Refund Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {selectedBillNormalizedItems.map((it) => {
                        const state = returnItemsState[it.id] || {
                          selected: false,
                          returned_qty: 0,
                          reason: "Customer Changed Mind",
                          restock_disposition: "restock",
                        };
                        const itemSub = it.unit_price * state.returned_qty;
                        const itemTax = itemSub * (it.tax_rate / 100);
                        const itemTot = itemSub + itemTax;

                        return (
                          <tr
                            key={it.id}
                            className={state.selected ? "bg-indigo-50/20" : "opacity-60 bg-white"}
                          >
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={state.selected}
                                onChange={(e) => {
                                  setReturnItemsState((prev) => ({
                                    ...prev,
                                    [it.id]: {
                                      ...state,
                                      selected: e.target.checked,
                                      returned_qty: e.target.checked ? (state.returned_qty > 0 ? state.returned_qty : 1) : 0,
                                    },
                                  }));
                                }}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-bold text-slate-900">{it.product_name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                SKU: {it.sku} {it.hsn_code ? `• HSN: ${it.hsn_code}` : ""}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-slate-700">
                              {it.purchased_qty}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="inline-flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white">
                                <button
                                  type="button"
                                  disabled={!state.selected || state.returned_qty <= 1}
                                  onClick={() => {
                                    setReturnItemsState((prev) => ({
                                      ...prev,
                                      [it.id]: {
                                        ...state,
                                        returned_qty: Math.max(1, state.returned_qty - 1),
                                      },
                                    }));
                                  }}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 font-bold"
                                >
                                  -
                                </button>
                                <span className="px-3 py-1 font-bold text-xs min-w-[28px] text-center">
                                  {state.returned_qty}
                                </span>
                                <button
                                  type="button"
                                  disabled={!state.selected || state.returned_qty >= it.purchased_qty}
                                  onClick={() => {
                                    setReturnItemsState((prev) => ({
                                      ...prev,
                                      [it.id]: {
                                        ...state,
                                        returned_qty: Math.min(it.purchased_qty, state.returned_qty + 1),
                                      },
                                    }));
                                  }}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 font-bold"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-slate-700">
                              {formatCurrency(it.unit_price)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-slate-500">
                              {it.tax_rate}%
                            </td>
                            <td className="px-4 py-3">
                              <select
                                disabled={!state.selected}
                                value={state.reason}
                                onChange={(e) => {
                                  setReturnItemsState((prev) => ({
                                    ...prev,
                                    [it.id]: {
                                      ...state,
                                      reason: e.target.value,
                                    },
                                  }));
                                }}
                                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 disabled:opacity-50 focus:ring-1 focus:ring-indigo-500"
                              >
                                {RETURN_REASONS.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <select
                                disabled={!state.selected}
                                value={state.restock_disposition}
                                onChange={(e: any) => {
                                  setReturnItemsState((prev) => ({
                                    ...prev,
                                    [it.id]: {
                                      ...state,
                                      restock_disposition: e.target.value,
                                    },
                                  }));
                                }}
                                className={`text-[11px] font-bold border rounded-lg px-2.5 py-1 disabled:opacity-50 ${
                                  state.restock_disposition === "restock"
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                    : "bg-amber-50 text-amber-800 border-amber-300"
                                }`}
                              >
                                <option value="restock">Restock to Inventory</option>
                                <option value="damaged">Damaged / Scrap</option>
                                <option value="inspection">Quarantine / Inspection</option>
                              </select>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                              {state.selected ? formatCurrency(itemTot) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Summary calculation pill */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-700">Selected for Return:</span>
                    <div className="text-xs text-slate-500">
                      {returnTotals.total_items} items total ({returnTotals.restock_count} returning to inventory)
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Taxable Value</span>
                      <span className="font-mono font-semibold text-slate-700">{formatCurrency(returnTotals.subtotal)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Tax Reversal</span>
                      <span className="font-mono font-semibold text-emerald-600">{formatCurrency(returnTotals.tax_amount)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Net Refund</span>
                      <span className="font-mono font-black text-rose-600 text-sm">{formatCurrency(returnTotals.total_refund)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Refund Settlement & Finalization */}
            {selectedBill && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Step 3: Refund Settlement & Notes</h2>
                  <p className="text-xs text-slate-500">
                    Choose how the refund value is settled with the customer.
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { id: "cash", label: "Cash Refund", desc: "Instant payout from till", icon: DollarSign },
                    { id: "upi", label: "UPI Transfer", desc: "Online instant transfer", icon: QrCode },
                    { id: "store_credit", label: "Store Credit", desc: "Credit customer wallet", icon: Wallet },
                    { id: "credit_note", label: "Credit Note", desc: "GST compliant credit note", icon: FileText },
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSelected = settlementMethod === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => setSettlementMethod(m.id as any)}
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

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Return Notes / Cashier Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    placeholder="e.g. Merchandise inspected, original packaging intact, approved by manager."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="text-xs text-slate-500">
                    A printable return slip and audit trail will be generated immediately.
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("register")}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting || returnTotals.total_items === 0}
                      onClick={handleSubmitReturn}
                      className="px-6 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 disabled:opacity-50 transition flex items-center gap-2 shadow-sm"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Processing Return...
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-3.5 h-3.5" />
                          Complete Return ({formatCurrency(returnTotals.total_refund)})
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Printable Sales Return Slip Modal ── */}
      <AnimatePresence>
        {selectedReturnSlip && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-rose-400" />
                  <span className="text-sm font-bold tracking-tight">Sales Return Slip</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={printSlip}
                    className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print
                  </button>
                  <button
                    onClick={() => setSelectedReturnSlip(null)}
                    className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Printable Slip Content */}
              <div id="sales-return-slip-print" className="p-6 overflow-y-auto space-y-4 text-xs font-sans text-slate-800">
                <div className="text-center border-b border-dashed border-slate-300 pb-3">
                  <h3 className="text-base font-black tracking-tight text-slate-900">
                    {tenant?.name || "Business Organization"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {(tenant as any)?.raw?.address || "Store Main Counter • Retail POS"}
                  </p>
                  {(tenant as any)?.raw?.gst_number && (
                    <p className="text-[10px] font-mono text-slate-500">
                      GSTIN: {(tenant as any)?.raw?.gst_number}
                    </p>
                  )}
                  <div className="mt-2 inline-block px-3 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-full font-bold text-[10px] uppercase tracking-wider">
                    Official Return & Exchange Voucher
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] py-1 border-b border-dashed border-slate-200">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Return Slip No:</span>
                    <span className="font-mono font-bold text-rose-600">{selectedReturnSlip.return_number}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px]">Return Date:</span>
                    <span className="font-semibold">{selectedReturnSlip.return_date}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Against Bill #:</span>
                    <span className="font-mono font-bold text-indigo-600">{selectedReturnSlip.original_invoice_no}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px]">Customer:</span>
                    <span className="font-semibold">{selectedReturnSlip.customer_name}</span>
                  </div>
                </div>

                {/* Items table */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Returned Items
                  </div>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <tr>
                          <th className="px-2.5 py-1.5">Item</th>
                          <th className="px-2 py-1.5 text-center">Qty</th>
                          <th className="px-2 py-1.5 text-right">Rate</th>
                          <th className="px-2.5 py-1.5 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedReturnSlip.items.map((it, idx) => (
                          <tr key={idx}>
                            <td className="px-2.5 py-1.5">
                              <div className="font-bold text-slate-900">{it.product_name}</div>
                              <div className="text-[9px] text-slate-400">
                                Reason: {it.reason} • {it.restock_disposition === "restock" ? "Restocked" : "Scrapped"}
                              </div>
                            </td>
                            <td className="px-2 py-1.5 text-center font-bold">{it.returned_qty}</td>
                            <td className="px-2 py-1.5 text-right font-mono">{formatCurrency(it.unit_price)}</td>
                            <td className="px-2.5 py-1.5 text-right font-mono font-bold">{formatCurrency(it.total_amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Settlement totals */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Taxable Return Value:</span>
                    <span className="font-mono">{formatCurrency(selectedReturnSlip.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600">
                    <span>GST Output Reversal:</span>
                    <span className="font-mono">{formatCurrency(selectedReturnSlip.tax_amount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-1 text-sm">
                    <span>Total Refund Amount:</span>
                    <span className="font-mono text-rose-600">{formatCurrency(selectedReturnSlip.total_refund)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                    <span>Settlement Mode:</span>
                    <span className="font-bold uppercase text-indigo-600">
                      {selectedReturnSlip.settlement_method.replace("_", " ")}
                    </span>
                  </div>
                </div>

                {selectedReturnSlip.notes && (
                  <p className="text-[10px] text-slate-500 italic bg-amber-50/60 p-2 rounded border border-amber-200">
                    Note: {selectedReturnSlip.notes}
                  </p>
                )}

                <div className="pt-6 flex justify-between items-end border-t border-dashed border-slate-300 text-[10px] text-slate-400">
                  <div className="text-center">
                    <div className="w-24 border-b border-slate-300 mb-1" />
                    <span>Customer Signature</span>
                  </div>
                  <div className="text-center">
                    <div className="w-24 border-b border-slate-300 mb-1" />
                    <span>Store Authorized Signatory</span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                <button
                  onClick={() => setSelectedReturnSlip(null)}
                  className="px-4 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-lg transition"
                >
                  Close
                </button>
                <button
                  onClick={printSlip}
                  className="px-4 py-1.5 text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition flex items-center gap-1.5 shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Return Slip
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
