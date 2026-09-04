import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileCheck, Search, ArrowRight, Truck, PackageCheck, FileText, Printer,
  CheckCircle, Plus, Loader2, X, ArrowLeft, Trash2, Box, Layers, CheckSquare, Square, Edit2
} from "lucide-react";
import { Button } from "../ui/button";
import { deliveryChallanApi, invoicesApi, crmApi, inventoryApi, resolveImageUrl } from "../../lib/api-client";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { getActiveBillingGst } from "@/lib/receipt-template-store";

export function DeliveryChallans() {
  const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();
  const [isCreating, setIsCreating] = useState(false);
  const [editingChallanId, setEditingChallanId] = useState<string | null>(null);
  const [challans, setChallans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form dependencies
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [vendorBills, setVendorBills] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Batch Multi-Select Modal State
  const [isMultiModalOpen, setIsMultiModalOpen] = useState(false);
  const [multiSearch, setMultiSearch] = useState("");
  const [multiCategory, setMultiCategory] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  // Voucher state
  const [voucher, setVoucher] = useState({
    invoice_id: "",
    customer_id: "",
    challan_date: new Date().toISOString().split('T')[0],
    transporter_name: "",
    vehicle_number: "",
    waybill_number: "",
    notes: "",
    items: [] as any[]
  });

  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const resChallans = await deliveryChallanApi.getChallans();
      setChallans(resChallans.items || []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDependencies = async () => {
    try {
      const [resCust, resSupp, resInv, resBills, resPOs, resProds] = await Promise.all([
        crmApi.getCustomers(1, 200).catch(() => ({ items: [] })),
        inventoryApi.getSuppliers().catch(() => []),
        invoicesApi.listInvoices({ page_size: 150 }).catch(() => ({ items: [] })),
        inventoryApi.getVendorBills().catch(() => []),
        inventoryApi.getPurchaseOrders().catch(() => []),
        inventoryApi.getProducts({ page_size: 500 }).catch(() => ({ items: [] }))
      ]);
      setCustomers(resCust.items || resCust || []);
      setSuppliers(Array.isArray(resSupp) ? resSupp : []);
      setInvoices(resInv.items || resInv || []);
      setVendorBills(Array.isArray(resBills) ? resBills : []);
      setPurchaseOrders(Array.isArray(resPOs) ? resPOs : []);
      setCatalogProducts(Array.isArray(resProds) ? resProds : (resProds?.items || []));
    } catch (error) {
      console.error("Failed to fetch dependencies", error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchDependencies();
  }, []);

  const allReferences = useMemo(() => {
    const list: any[] = [];

    // 1. Operations Purchase Invoices / Bills
    vendorBills.forEach((b: any) => {
      const linkedPO = purchaseOrders.find((po: any) => po.id === b.purchase_order_id);
      const items = (b.items && b.items.length > 0) ? b.items : (linkedPO?.items || []);
      const docNum = b.bill_number || b.invoice_number || `PB-${String(b.id).slice(0, 6)}`;
      list.push({
        id: b.id,
        doc_number: docNum,
        label: `📄 ${docNum} (Operations Purchase Invoice)`,
        category: "purchase_invoice",
        recipient_id: b.supplier_id || linkedPO?.supplier_id,
        items: items
      });
    });

    // 2. Operations Purchase Orders
    purchaseOrders.forEach((po: any) => {
      const docNum = po.po_number || `PO-${String(po.id).slice(0, 6)}`;
      list.push({
        id: po.id,
        doc_number: docNum,
        label: `📦 ${docNum} (Operations Purchase Order)`,
        category: "purchase_order",
        recipient_id: po.supplier_id,
        items: po.items || []
      });
    });

    // 3. Sales Invoices
    invoices.forEach((inv: any) => {
      const docNum = inv.invoice_number || `INV-${String(inv.id).slice(0, 6)}`;
      list.push({
        id: inv.id,
        doc_number: docNum,
        label: `🧾 ${docNum} (Sales Invoice)`,
        category: "sales_invoice",
        recipient_id: inv.customer_id,
        items: inv.items || inv.lines || []
      });
    });

    return list;
  }, [vendorBills, purchaseOrders, invoices]);

  const handleInvoiceSelect = async (refId: string) => {
    if (!refId) {
      setVoucher(prev => ({ ...prev, invoice_id: "" }));
      return;
    }
    const matched = allReferences.find(r => r.id === refId);
    if (!matched) return;

    let rawItems = matched.items || [];
    if (rawItems.length === 0) {
      if (matched.category === "sales_invoice") {
        try {
          const full = await invoicesApi.getInvoice(refId);
          if (full?.items && full.items.length > 0) rawItems = full.items;
          else if (full?.lines && full.lines.length > 0) rawItems = full.lines;
        } catch (e) {
          console.warn("Could not fetch full invoice line items", e);
        }
      } else if (matched.category === "purchase_invoice") {
        const bill = vendorBills.find(b => b.id === refId);
        if (bill?.purchase_order_id) {
          const linkedPO = purchaseOrders.find(po => po.id === bill.purchase_order_id);
          if (linkedPO?.items && linkedPO.items.length > 0) rawItems = linkedPO.items;
        }
      }
    }

    const items = rawItems.map((it: any) => ({
      product_id: it.product_id || it.id || "",
      product_name: it.product_name || it.item_name || it.name || "Catalog Product",
      quantity: Number(it.quantity || it.received_quantity || it.billed_quantity || it.ordered_quantity) || 1,
      uom: it.uom || it.unit || "Pcs"
    }));

    setVoucher(prev => ({
      ...prev,
      invoice_id: refId,
      customer_id: matched.recipient_id || prev.customer_id,
      items: items.length > 0 ? items : prev.items
    }));

    if (items.length > 0) {
      toast.success(`Auto-filled ${items.length} line item(s) from ${matched.doc_number}!`);
    } else {
      toast.info(`Selected ${matched.doc_number}. You can add items below or use Batch Select.`);
    }
  };

  const handleProductSearch = async (query: string) => {
    setProductSearch(query);
    if (!query) {
      setProducts([]);
      setShowProductDropdown(false);
      return;
    }
    const filtered = catalogProducts.filter(p => 
      p.name.toLowerCase().includes(query.toLowerCase()) || 
      (p.sku && p.sku.toLowerCase().includes(query.toLowerCase()))
    );
    setProducts(filtered);
    setShowProductDropdown(true);
  };

  const addProductLine = (product: any) => {
    const existing = voucher.items.find(i => i.product_id === product.id);
    if (existing) {
      setVoucher({
        ...voucher,
        items: voucher.items.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      });
    } else {
      setVoucher({
        ...voucher,
        items: [...voucher.items, {
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          uom: product.uom || "Pcs"
        }]
      });
    }
    setProductSearch("");
    setShowProductDropdown(false);
  };

  const updateLineQty = (index: number, qty: number) => {
    const newItems = [...voucher.items];
    newItems[index].quantity = qty;
    setVoucher({ ...voucher, items: newItems });
  };

  const removeLine = (index: number) => {
    setVoucher({
      ...voucher,
      items: voucher.items.filter((_, i) => i !== index)
    });
  };

  const distinctCategories = useMemo(() => {
    const set = new Set<string>();
    catalogProducts.forEach(p => { if (p.category) set.add(p.category); });
    return Array.from(set);
  }, [catalogProducts]);

  const filteredMultiProducts = useMemo(() => {
    const q = multiSearch.trim().toLowerCase();
    return catalogProducts.filter(p => {
      const matchCat = !multiCategory || p.category === multiCategory;
      const matchQuery = !q || p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q));
      return matchCat && matchQuery;
    });
  }, [catalogProducts, multiSearch, multiCategory]);

  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedProductIds(new Set(filteredMultiProducts.map(p => p.id)));
  };

  const clearSelection = () => {
    setSelectedProductIds(new Set());
  };

  const handleAddSelectedProducts = () => {
    const prodsToAdd = catalogProducts.filter(p => selectedProductIds.has(p.id));
    const newItems = prodsToAdd.map(p => ({
      product_id: p.id,
      product_name: p.name,
      quantity: 1,
      uom: p.uom || "Pcs"
    }));

    setVoucher(prev => {
      const existingIds = new Set(prev.items.map(it => it.product_id).filter(Boolean));
      const nonDuplicates = newItems.filter(it => !existingIds.has(it.product_id));
      return { ...prev, items: [...prev.items, ...nonDuplicates] };
    });

    toast.success(`Added ${prodsToAdd.length} products to Delivery Challan!`);
    setIsMultiModalOpen(false);
    setSelectedProductIds(new Set());
  };

  const handleEditChallan = (dc: any) => {
    setEditingChallanId(dc.id);
    setVoucher({
      invoice_id: dc.invoice_id || "",
      customer_id: dc.customer_id || "",
      challan_date: dc.challan_date ? new Date(dc.challan_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      transporter_name: dc.transporter_name || "",
      vehicle_number: dc.vehicle_number || "",
      waybill_number: dc.waybill_number || "",
      notes: dc.notes || "",
      items: (dc.items || []).map((it: any) => ({
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: it.quantity,
        uom: it.uom || "Pcs"
      }))
    });
    setIsCreating(true);
  };

  const handleDispatch = async (id: string) => {
    if (!confirm("Are you sure you want to mark this challan as dispatched? This will deduct stock.")) return;
    try {
      await deliveryChallanApi.dispatchChallan(id);
      fetchData();
      toast.success("Challan dispatched successfully!");
    } catch (error) {
      toast.error("Failed to dispatch challan.");
    }
  };

  const handleSubmit = async () => {
    if (voucher.items.length === 0) {
      toast.error("Please add at least one item to dispatch.");
      return;
    }
    setSubmitting(true);
    try {
      const matchedRef = allReferences.find(r => r.id === voucher.invoice_id);
      const matchedRecipient = getCustomerName(voucher.customer_id);

      const payload = {
        ...voucher,
        reference_number: matchedRef?.doc_number || null,
        recipient_name: matchedRecipient !== "General / Walk-in Recipient" ? matchedRecipient : null,
        customer_id: voucher.customer_id || null,
        invoice_id: voucher.invoice_id || null
      };

      if (editingChallanId) {
        await deliveryChallanApi.updateChallan(editingChallanId, payload);
        toast.success("Delivery Challan updated successfully!");
      } else {
        await deliveryChallanApi.createChallan(payload);
        toast.success("Delivery Challan created successfully!");
      }

      setIsCreating(false);
      setEditingChallanId(null);
      setVoucher({
        invoice_id: "", customer_id: "", challan_date: new Date().toISOString().split('T')[0],
        transporter_name: "", vehicle_number: "", waybill_number: "", notes: "", items: []
      });
      fetchData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to save Delivery Challan.");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-slate-100 text-slate-700';
      case 'dispatched': return 'bg-amber-100 text-amber-700';
      case 'delivered': return 'bg-emerald-100 text-emerald-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getCustomerName = (id: string) => {
    if (!id) return "General / Walk-in Recipient";
    const c = customers.find(x => x.id === id);
    if (c) {
      const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
      return c.name || c.company_name || fullName || c.email || c.phone || "Customer";
    }
    const s = suppliers.find(x => x.id === id);
    if (s) {
      return s.supplier_name || s.name || s.contact_person || "Vendor / Supplier";
    }
    return "Recipient";
  };

  const handlePrintChallan = (dc: any) => {
    const printWindow = window.open("", "_blank", "width=850,height=900");
    if (!printWindow) {
      toast.error("Please allow popups to print Delivery Challan.");
      return;
    }

    const activeBillingGst = getActiveBillingGst(tenant?.id);
    const orgName = activeBillingGst?.trade_name || activeBillingGst?.legal_name || tenant?.name || "BusinessOS Store";
    const rawLogo = activeBillingGst?.logo_url || tenant?.logo_url || (tenant as any)?.raw?.logo_url || "";
    const orgLogo = resolveImageUrl(rawLogo);
    const orgGstin = activeBillingGst?.gstin || (tenant as any)?.tax_id || (tenant as any)?.gstin || (tenant as any)?.raw?.tax_id || "37AAAAA0000A1Z5";
    const orgAddress = activeBillingGst?.address || (tenant as any)?.address || (tenant as any)?.raw?.address || "Main Branch";
    const orgPhone = activeBillingGst?.phone || (tenant as any)?.phone || (tenant as any)?.raw?.phone || "";
    const googleReviewUrl = activeBillingGst?.google_review_url || (tenant as any)?.raw?.google_review_url || null;
    const showReviewQR = activeBillingGst?.google_review_enabled !== false && Boolean(googleReviewUrl);

    const recipientName = dc.recipient_name || getCustomerName(dc.customer_id);
    const refDoc = dc.reference_number || allReferences.find(r => r.id === dc.invoice_id)?.doc_number || invoices.find(i => i.id === dc.invoice_id)?.invoice_number || 'N/A';
    const items = dc.items || [];
    const totalUnits = items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0);

    const itemsRows = items.length > 0 ? items.map((it: any, idx: number) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px; font-weight: bold; text-align: center; color: #64748b;">${idx + 1}</td>
        <td style="padding: 10px; font-weight: bold; color: #0f172a;">${it.product_name || it.name || "Item"}</td>
        <td style="padding: 10px; text-align: center; font-weight: 800; color: #0f172a;">${it.quantity || 1}</td>
        <td style="padding: 10px; text-align: center; color: #475569;">${it.uom || "Pcs"}</td>
      </tr>
    `).join('') : `
      <tr>
        <td colspan="4" style="padding: 20px; text-align: center; color: #94a3b8;">General Goods Dispatch</td>
      </tr>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Delivery Challan - ${dc.challan_number}</title>
          <style>
            body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; padding: 24px; color: #0f172a; margin: 0; }
            .header-table { width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 16px; }
            .badge { display: inline-block; padding: 4px 12px; background: #0f172a; color: #fff; font-size: 12px; font-weight: 800; letter-spacing: 1px; border-radius: 4px; text-transform: uppercase; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; padding: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
            .items-table th { background: #f1f5f9; padding: 10px; font-weight: 700; text-align: left; border-bottom: 2px solid #cbd5e1; }
            .footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 30px; font-size: 12px; }
            .sig-box { border-top: 1px solid #94a3b8; padding-top: 6px; text-align: center; margin-top: 50px; font-weight: 700; color: #475569; }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td style="vertical-align: top;">
                ${orgLogo ? `<img src="${orgLogo}" alt="Logo" style="max-height: 48px; max-width: 160px; object-fit: contain; margin-bottom: 6px;" />` : ''}
                <h1 style="font-size: 18px; font-weight: 900; margin: 0; text-transform: uppercase;">${orgName}</h1>
                <p style="font-size: 11px; color: #475569; margin: 2px 0;">${orgAddress}${orgPhone ? ` • Phone: ${orgPhone}` : ''}</p>
                <p style="font-size: 11px; font-weight: 800; color: #0f172a; margin: 2px 0;">GSTIN: ${orgGstin}</p>
              </td>
              <td style="text-align: right; vertical-align: top;">
                <div class="badge">DELIVERY CHALLAN / GATE PASS</div>
                <div style="font-size: 16px; font-weight: 900; margin-top: 6px;">${dc.challan_number}</div>
                <div style="font-size: 11px; color: #64748b;">Date: ${new Date(dc.challan_date).toLocaleDateString()}</div>
                <div style="font-size: 11px; font-weight: 600; color: #0284c7; margin-top: 2px;">Ref: ${refDoc}</div>
              </td>
            </tr>
          </table>

          <div class="meta-grid">
            <div>
              <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">DELIVER TO / CONSIGNEE</div>
              <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px;">${recipientName}</div>
            </div>
            <div>
              <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">DISPATCH & TRANSPORT DETAILS</div>
              <div style="margin-top: 2px;">Transporter: <b>${dc.transporter_name || "Self / Hand Delivery"}</b></div>
              <div>Vehicle No: <b>${dc.vehicle_number || "—"}</b> | Waybill / LR: <b>${dc.waybill_number || "—"}</b></div>
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th>Item Description & Specification</th>
                <th style="width: 100px; text-align: center;">Qty Dispatched</th>
                <th style="width: 80px; text-align: center;">Unit</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
            <tfoot>
              <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid #0f172a;">
                <td colspan="2" style="padding: 10px; text-align: right;">TOTAL DISPATCHED UNITS:</td>
                <td style="padding: 10px; text-align: center; color: #0f172a; font-size: 13px;">${totalUnits}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>

          ${showReviewQR && googleReviewUrl ? `
          <div style="display: flex; align-items: center; gap: 14px; padding: 12px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; margin-top: 14px;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=0&data=${encodeURIComponent(googleReviewUrl)}" alt="Google Review QR" style="width: 65px; height: 65px; object-fit: contain; background: #fff; padding: 3px; border: 1px solid #f59e0b; border-radius: 6px;" />
            <div>
              <div style="color: #f59e0b; font-size: 12px; font-weight: 900; letter-spacing: 2px;">★ ★ ★ ★ ★</div>
              <div style="font-size: 12px; font-weight: 800; color: #78350f; text-transform: uppercase;">Rate our delivery service on Google!</div>
              <div style="font-size: 10px; color: #92400e;">Scan with your phone camera to share your 5-star feedback & prompt delivery confirmation.</div>
            </div>
          </div>
          ` : ''}

          <div class="footer-grid">
            <div>
              <div style="font-size: 10px; font-weight: 700; color: #64748b;">TERMS & DECLARATION:</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
                Goods dispatched as per specifications. Please verify material count upon arrival.
              </div>
              <div class="sig-box" style="margin-top: 40px;">Receiver's Signature & Stamp</div>
            </div>
            <div>
              <div class="sig-box" style="margin-top: 60px;">For ${orgName} (Authorized Signatory)</div>
            </div>
          </div>

          <script>
            window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (isCreating) {
    const totalLines = voucher.items.length;
    const totalUnits = voucher.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

    return (
      <div className="space-y-6 mx-auto">
        <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => { setIsCreating(false); setEditingChallanId(null); }} className="rounded-full hover:bg-slate-100">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-sm ${
                  editingChallanId ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-500'
                }`}>
                  {editingChallanId ? 'EDIT DELIVERY CHALLAN' : 'NEW DELIVERY CHALLAN VOUCHER'}
                </span>
                <span className="text-[10px] font-medium text-slate-400 font-mono">
                  {editingChallanId ? 'Modifying Records' : 'Drafting Mode'}
                </span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-0.5">
                {editingChallanId ? `DC-EDIT-${editingChallanId.slice(0, 8).toUpperCase()}` : `DC-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-XXXX`}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => { setIsCreating(false); setEditingChallanId(null); }} className="px-6 border-slate-200">Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="px-6 bg-purple-700 hover:bg-purple-800 text-white border-0 shadow-md shadow-purple-500/20">
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              {editingChallanId ? 'Save Changes' : 'Post Delivery Challan'}
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase mb-2">
                <FileText className="w-3 h-3 text-rose-400" /> DATE
              </label>
              <input
                type="date"
                value={voucher.challan_date}
                onChange={e => setVoucher({ ...voucher, challan_date: e.target.value })}
                className="w-full h-11 px-4 text-sm font-medium border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all shadow-sm"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase mb-2">
                <Truck className="w-3 h-3 text-rose-400" /> RECIPIENT / PARTY
              </label>
              <select
                value={voucher.customer_id}
                onChange={e => setVoucher({ ...voucher, customer_id: e.target.value })}
                className="w-full h-11 px-4 text-sm font-medium border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all shadow-sm bg-white"
              >
                <option value="">Select Recipient (Customer or Supplier)...</option>
                {customers.length > 0 && (
                  <optgroup label="Customers">
                    {customers.map(c => {
                      const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
                      const dispName = c.name || c.company_name || fullName || c.email || "Customer";
                      return (
                        <option key={c.id} value={c.id}>
                          👤 {dispName} {c.phone ? `(${c.phone})` : ''}
                        </option>
                      );
                    })}
                  </optgroup>
                )}
                {suppliers.length > 0 && (
                  <optgroup label="Suppliers / Vendors">
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>
                        🏢 {s.supplier_name || s.name || 'Vendor'}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase mb-2">
                <FileCheck className="w-3 h-3 text-rose-400" /> SALES / PURCHASE ORDER / INVOICE REF #
              </label>
              <select
                value={voucher.invoice_id}
                onChange={e => handleInvoiceSelect(e.target.value)}
                className="w-full h-11 px-4 text-sm font-medium border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all shadow-sm bg-white"
              >
                <option value="">Select Reference Document (Auto-fills items)...</option>
                {allReferences.filter(r => r.category === 'purchase_invoice').length > 0 && (
                  <optgroup label="Operations Purchase Invoices / Bills">
                    {allReferences.filter(r => r.category === 'purchase_invoice').map(r => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </optgroup>
                )}
                {allReferences.filter(r => r.category === 'purchase_order').length > 0 && (
                  <optgroup label="Operations Purchase Orders (PO)">
                    {allReferences.filter(r => r.category === 'purchase_order').map(r => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </optgroup>
                )}
                {allReferences.filter(r => r.category === 'sales_invoice').length > 0 && (
                  <optgroup label="Sales Invoices">
                    {allReferences.filter(r => r.category === 'sales_invoice').map(r => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase mb-2">
                <Truck className="w-3 h-3 text-rose-400" /> TRANSPORTER NAME
              </label>
              <input
                type="text"
                placeholder="e.g. FedEx / BlueDart / Self"
                value={voucher.transporter_name}
                onChange={e => setVoucher({ ...voucher, transporter_name: e.target.value })}
                className="w-full h-11 px-4 text-sm font-medium border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all shadow-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div>
              <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase mb-2">
                VEHICLE NUMBER
              </label>
              <input
                type="text"
                placeholder="e.g. MH-12-AB-1234"
                value={voucher.vehicle_number}
                onChange={e => setVoucher({ ...voucher, vehicle_number: e.target.value })}
                className="w-full h-11 px-4 text-sm font-medium border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all shadow-sm"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase mb-2">
                WAYBILL / LR NUMBER
              </label>
              <input
                type="text"
                placeholder="e.g. LR-992123"
                value={voucher.waybill_number}
                onChange={e => setVoucher({ ...voucher, waybill_number: e.target.value })}
                className="w-full h-11 px-4 text-sm font-medium border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all shadow-sm"
              />
            </div>
          </div>
          <div className="mt-6">
            <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase mb-2">
              REMARKS / PURPOSE
            </label>
            <input
              type="text"
              placeholder="Add dispatch reason or delivery notes..."
              value={voucher.notes}
              onChange={e => setVoucher({ ...voucher, notes: e.target.value })}
              className="w-full h-11 px-4 text-sm font-medium border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Box className="w-4 h-4 text-rose-500" /> Dispatched Product Items ({voucher.items.length})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Select products and quantities to dispatch from inventory stock.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => setIsMultiModalOpen(true)}
                  className="bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 font-bold text-xs rounded-xl"
                >
                  <Layers className="size-3.5 mr-1.5 text-purple-600" /> + Batch Select Products
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Scan product barcode or search by name to dispatch..."
                  value={productSearch}
                  onChange={e => handleProductSearch(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none shadow-sm"
                />
              </div>
              {showProductDropdown && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {products.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-400 font-medium">No catalog products found.</div>
                  ) : (
                    products.map(p => (
                      <div
                        key={p.id}
                        onClick={() => addProductLine(p)}
                        className="p-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div>
                          <div className="font-semibold text-sm text-slate-800">{p.name}</div>
                          <div className="text-xs text-slate-400">SKU: {p.sku || "N/A"} • Available Stock: {p.stock ?? 0} {p.uom || 'Pcs'}</div>
                        </div>
                        <Button size="sm" variant="ghost" className="h-7 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100">Add</Button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            {voucher.items.length > 0 ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden mt-4">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b">
                    <tr>
                      <th className="px-4 py-3 font-semibold">PRODUCT</th>
                      <th className="px-4 py-3 font-semibold w-32">QUANTITY</th>
                      <th className="px-4 py-3 font-semibold w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {voucher.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-900">{item.product_name}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={e => updateLineQty(idx, Number(e.target.value))}
                              className="w-20 h-9 px-3 text-center border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                            />
                            <span className="text-xs text-slate-500 font-semibold">{item.uom || "Pcs"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button variant="ghost" size="icon" onClick={() => removeLine(idx)} className="h-8 w-8 text-slate-400 hover:text-rose-500 hover:bg-rose-50">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <Box className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-500">No products added yet.</p>
                <p className="text-xs text-slate-400">Select reference above or click "+ Batch Select Products".</p>
              </div>
            )}
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-6 flex flex-col h-full">
            <h3 className="text-sm font-bold text-slate-900 mb-6">Delivery Challan Summary</h3>
            <div className="space-y-4 flex-1">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <span className="text-sm text-slate-500">Total Line Products</span>
                <span className="text-sm font-bold text-slate-900">{totalLines}</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <span className="text-sm text-slate-500">Total Dispatched Units</span>
                <span className="text-sm font-bold text-slate-900">{totalUnits} Units</span>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-slate-200">
              <Button onClick={handleSubmit} disabled={submitting || voucher.items.length === 0} className="w-full h-12 bg-purple-700 hover:bg-purple-800 text-white font-bold text-sm shadow-md shadow-purple-500/20 border-0">
                {submitting ? "Processing..." : editingChallanId ? "Save Changes" : "Post Delivery Challan"}
              </Button>
            </div>
          </div>
        </div>

        {isMultiModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
              <div className="p-5 border-b flex items-center justify-between bg-slate-50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-purple-50 border border-purple-100 text-purple-600">
                    <Layers className="size-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Batch Select Products for Dispatch</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Select multiple catalog products with checkboxes to add to Delivery Challan.</p>
                  </div>
                </div>
                <button type="button" onClick={() => setIsMultiModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition-colors">
                  <X className="size-5" />
                </button>
              </div>
              <div className="p-4 border-b bg-white flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <input type="text" value={multiSearch} onChange={(e) => setMultiSearch(e.target.value)} placeholder="Search products by name or SKU..." className="w-full h-10 pl-10 pr-4 text-xs font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
                {distinctCategories.length > 0 && (
                  <select value={multiCategory} onChange={(e) => setMultiCategory(e.target.value)} className="h-10 px-3 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-purple-500 outline-none w-full sm:w-48">
                    <option value="">All Categories</option>
                    {distinctCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                )}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={selectAllFiltered} className="h-9 px-3 text-xs font-bold rounded-xl">Select All ({filteredMultiProducts.length})</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={clearSelection} className="h-9 px-3 text-xs font-bold text-slate-500 rounded-xl hover:bg-slate-100">Clear</Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
                {filteredMultiProducts.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 text-xs font-semibold">No products found matching your search.</div>
                ) : (
                  filteredMultiProducts.map((prod) => {
                    const isChecked = selectedProductIds.has(prod.id);
                    return (
                      <div key={prod.id} onClick={() => toggleSelectProduct(prod.id)} className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${isChecked ? "bg-purple-50/80 border border-purple-200" : "hover:bg-slate-50"}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="text-purple-600 shrink-0">
                            {isChecked ? <CheckSquare className="size-5 fill-purple-100" /> : <Square className="size-5 text-slate-300" />}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">{prod.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                              <span>SKU: {prod.sku || "—"}</span>
                              <span>• In Stock: {prod.stock ?? 0} {prod.uom || 'Pcs'}</span>
                              {prod.category && <span>• Category: {prod.category}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-black text-slate-900">{formatCurrency(Number(prod.selling_price || prod.mrp) || 0)}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="p-4 border-t bg-slate-50 flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-slate-700">{selectedProductIds.size} Items Selected</span>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsMultiModalOpen(false)} className="rounded-xl text-xs font-bold">Cancel</Button>
                  <Button type="button" onClick={handleAddSelectedProducts} disabled={selectedProductIds.size === 0} className="bg-purple-700 text-white border-0 font-bold text-xs rounded-xl shadow-md">
                    + Add {selectedProductIds.size} Products
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center ">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Delivery Challans</h2>
          <p className="text-sm text-slate-500 mt-1">Manage outward dispatch documents and gate passes.</p>
        </div>
        <Button onClick={() => { setIsCreating(true); setEditingChallanId(null); }} className="bg-purple-700 hover:bg-purple-800 text-white border-0 shadow-sm font-semibold h-11 px-6">
          <Plus className="size-4 mr-2" /> Generate Challan
        </Button>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden min-h-[400px] relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-sm">
            <Loader2 className="size-8 animate-spin text-blue-600" />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 text-slate-500 text-xs font-bold uppercase tracking-wider border-b">
              <tr>
                <th className="px-6 py-5">CHALLAN DETAILS</th>
                <th className="px-6 py-5">CUSTOMER</th>
                <th className="px-6 py-5">TRANSPORT INFO</th>
                <th className="px-6 py-5">STATUS</th>
                <th className="px-6 py-5 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? null : challans.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-20">
                    <Truck className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">No Delivery Challans found.</p>
                  </td>
                </tr>
              ) : (
                challans.map((dc) => (
                  <tr key={dc.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{dc.challan_number}</p>
                          <p className="text-xs text-slate-500">{new Date(dc.challan_date).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-700">{dc.recipient_name || getCustomerName(dc.customer_id)}</div>
                      {(dc.reference_number || dc.invoice_id) && (
                        <p className="text-[11px] text-slate-500 mt-1">
                          Ref: {dc.reference_number || allReferences.find(r => r.id === dc.invoice_id)?.doc_number || invoices.find(i => i.id === dc.invoice_id)?.invoice_number || 'Linked Document'}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {dc.transporter_name || dc.vehicle_number ? (
                        <div className="text-sm text-slate-600">
                          {dc.transporter_name && <p className="font-medium">{dc.transporter_name}</p>}
                          {dc.vehicle_number && <p className="text-xs">{dc.vehicle_number}</p>}
                        </div>
                      ) : <span className="text-xs text-slate-400 italic">N/A</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold capitalize ${getStatusColor(dc.status)}`}>
                        {dc.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditChallan(dc)}
                          className="h-8 px-2.5 text-xs font-bold text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 border-slate-200"
                          title="Edit Delivery Challan"
                        >
                          <Edit2 className="size-3.5 mr-1 text-indigo-600" /> Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePrintChallan(dc)}
                          className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                          title="Print Delivery Challan Voucher"
                        >
                          <Printer className="size-4" />
                        </Button>
                        {dc.status === 'draft' && (
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                            onClick={() => handleDispatch(dc.id)}
                            title="Mark as Dispatched"
                          >
                            <PackageCheck className="size-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
