import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileCheck, Search, ArrowRight, Truck, PackageCheck, FileText, Printer,
  CheckCircle, Plus, Loader2, X, ArrowLeft, Trash2, Box
} from "lucide-react";
import { Button } from "../ui/button";
import { deliveryChallanApi, invoicesApi, crmApi, inventoryApi } from "../../lib/api-client";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";

export function DeliveryChallans() {
    const { currency, formatCurrency } = useCurrency();
  const [isCreating, setIsCreating] = useState(false);
  const [challans, setChallans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form dependencies
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);

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
      const [resCust, resInv] = await Promise.all([
        crmApi.getCustomers(1, 200),
        invoicesApi.listInvoices({ page_size: 100 })
      ]);
      setCustomers(resCust.items || resCust || []);
      setInvoices(resInv.items || resInv || []);
    } catch (error) {
      console.error("Failed to fetch dependencies", error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchDependencies();
  }, []);

  const handleProductSearch = async (query: string) => {
    setProductSearch(query);
    if (!query) {
      setProducts([]);
      setShowProductDropdown(false);
      return;
    }
    try {
      const res = await inventoryApi.getProducts({ search: query, page_size: 10 });
      setProducts(res.items || res || []);
      setShowProductDropdown(true);
    } catch (error) {
      console.error("Failed to search products", error);
    }
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
          uom: "pcs"
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
      const payload = {
        ...voucher,
        customer_id: voucher.customer_id || null,
        invoice_id: voucher.invoice_id || null
      };
      await deliveryChallanApi.createChallan(payload);
      toast.success("Delivery Challan created successfully!");
      setIsCreating(false);
      setVoucher({
        invoice_id: "", customer_id: "", challan_date: new Date().toISOString().split('T')[0],
        transporter_name: "", vehicle_number: "", waybill_number: "", notes: "", items: []
      });
      fetchData();
    } catch (error) {
      toast.error("Failed to create Delivery Challan.");
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
    if (!id) return "Unknown Customer";
    const c = customers.find(x => x.id === id);
    return c ? (c.first_name + " " + c.last_name).trim() || c.company_name : "Unknown Customer";
  };

  if (isCreating) {
    // VOUCHER CREATION VIEW
    const totalLines = voucher.items.length;
    const totalUnits = voucher.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

    return (
      <div className="space-y-6 mx-auto">
        <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setIsCreating(false)} className="rounded-full hover:bg-slate-100">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-wider text-rose-500 uppercase bg-rose-50 px-2 py-0.5 rounded-sm">NEW DELIVERY CHALLAN VOUCHER</span>
                <span className="text-[10px] font-medium text-slate-400 font-mono">Drafting Mode</span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-0.5">DC-{new Date().toISOString().split('T')[0].replace(/-/g, '')}-XXXX</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setIsCreating(false)} className="px-6 border-slate-200">Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="px-6 bg-rose-600 hover:bg-rose-700 text-white border-0 shadow-md shadow-rose-500/20">
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Post Delivery Challan
            </Button>
          </div>
        </div>

        {/* HEADER FIELDS */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase mb-2">
                <FileText className="w-3 h-3 text-rose-400" /> DELIVERY CHALLAN DATE
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
                <Truck className="w-3 h-3 text-rose-400" /> RECIPIENT / CUSTOMER
              </label>
              <select
                value={voucher.customer_id}
                onChange={e => setVoucher({ ...voucher, customer_id: e.target.value })}
                className="w-full h-11 px-4 text-sm font-medium border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all shadow-sm bg-white"
              >
                <option value="">Select Customer...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {(c.first_name + " " + c.last_name).trim() || c.company_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase mb-2">
                <FileCheck className="w-3 h-3 text-rose-400" /> SALES ORDER / REF #
              </label>
              <select
                value={voucher.invoice_id}
                onChange={e => setVoucher({ ...voucher, invoice_id: e.target.value })}
                className="w-full h-11 px-4 text-sm font-medium border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all shadow-sm bg-white"
              >
                <option value="">Select Invoice...</option>
                {invoices.map(inv => (
                  <option key={inv.id} value={inv.id}>{inv.invoice_number}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase mb-2">
                <Truck className="w-3 h-3 text-rose-400" /> TRANSPORTER NAME
              </label>
              <input
                type="text"
                placeholder="e.g. FedEx / Self"
                value={voucher.transporter_name}
                onChange={e => setVoucher({ ...voucher, transporter_name: e.target.value })}
                className="w-full h-11 px-4 text-sm font-medium border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all shadow-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div>
              <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase mb-2">
                <Truck className="w-3 h-3 text-slate-400" /> VEHICLE NUMBER
              </label>
              <input
                type="text"
                placeholder="e.g. MH-12-AB-1234"
                value={voucher.vehicle_number}
                onChange={e => setVoucher({ ...voucher, vehicle_number: e.target.value })}
                className="w-full h-11 px-4 text-sm font-medium border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none shadow-sm"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase mb-2">
                <FileText className="w-3 h-3 text-slate-400" /> WAYBILL / LR NUMBER
              </label>
              <input
                type="text"
                placeholder="e.g. LR-992123"
                value={voucher.waybill_number}
                onChange={e => setVoucher({ ...voucher, waybill_number: e.target.value })}
                className="w-full h-11 px-4 text-sm font-medium border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none shadow-sm"
              />
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">REMARKS / PURPOSE</label>
            <input
              type="text"
              placeholder="Add dispatch reason or delivery notes..."
              value={voucher.notes}
              onChange={e => setVoucher({ ...voucher, notes: e.target.value })}
              className="w-full h-11 px-4 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none shadow-sm"
            />
          </div>
        </div>

        {/* ITEMS & SUMMARY */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Box className="w-4 h-4 text-rose-500" /> Dispatched Product Items
                </h3>
                <p className="text-xs text-slate-500 mt-1">Select products and quantities to dispatch from inventory stock.</p>
              </div>
            </div>

            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => handleProductSearch(e.target.value)}
                placeholder="Scan product barcode or search by name to dispatch..."
                className="w-full h-12 pl-11 pr-4 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none shadow-sm"
              />

              {showProductDropdown && products.length > 0 && (
                <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
                  {products.map(p => (
                    <div
                      key={p.id}
                      onClick={() => addProductLine(p)}
                      className="flex items-center justify-between p-3 border-b last:border-0 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <div>
                        <div className="text-sm font-bold text-slate-900">{p.name}</div>
                        <div className="text-xs text-slate-500">SKU: {p.sku} | Stock: {p.initial_stock || 0}</div>
                      </div>
                      <Plus className="w-4 h-4 text-rose-500" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {voucher.items.length > 0 ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">PRODUCT</th>
                      <th className="px-4 py-3 font-semibold w-32">QUANTITY</th>
                      <th className="px-4 py-3 font-semibold w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {voucher.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{item.product_name}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={e => updateLineQty(idx, Number(e.target.value))}
                              className="w-20 h-9 px-3 text-center border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                            />
                            <span className="text-xs text-slate-500 font-semibold">{item.uom}</span>
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
                <p className="text-xs text-slate-400">Search above to add items.</p>
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
              <Button onClick={handleSubmit} disabled={submitting || voucher.items.length === 0} className="w-full h-12 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md shadow-rose-500/20 border-0">
                {submitting ? "Processing..." : "Post Delivery Challan"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // LIST VIEW
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center ">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Delivery Challans</h2>
          <p className="text-sm text-slate-500 mt-1">Manage outward dispatch documents and gate passes.</p>
        </div>
        <Button onClick={() => setIsCreating(true)} className="bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-sm font-semibold h-11 px-6">
          <Plus className="size-4 mr-2" /> Generate Challan
        </Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search challans..."
            className="w-full h-11 pl-10 pr-4 text-sm rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all"
          />
        </div>
        <select className="h-11 px-4 text-sm rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-slate-700 font-medium cursor-pointer">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="dispatched">Dispatched</option>
          <option value="delivered">Delivered</option>
        </select>
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
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-slate-700">
                          {getCustomerName(dc.customer_id)}
                        </div>
                      </div>
                      {dc.invoice_id && (
                        <p className="text-[11px] text-slate-500 mt-1">Ref: {invoices.find(i => i.id === dc.invoice_id)?.invoice_number || 'Linked Invoice'}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {dc.transporter_name || dc.vehicle_number ? (
                        <div className="text-sm text-slate-600">
                          {dc.transporter_name && <p className="font-medium">{dc.transporter_name}</p>}
                          {dc.vehicle_number && <p className="text-xs">{dc.vehicle_number}</p>}
                          {dc.waybill_number && <p className="text-xs text-slate-400">Waybill: {dc.waybill_number}</p>}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Self Pickup / Not Set</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold capitalize ${getStatusColor(dc.status)}`}>
                        {dc.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50">
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
                        <Button variant="ghost" size="sm" className="text-xs font-semibold h-8 text-blue-600 hover:text-blue-700">
                          View <ArrowRight className="ml-1 size-3" />
                        </Button>
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
