import { toast } from "sonner";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Filter, ShoppingCart, Download, Printer, Box, CreditCard, Clock, CheckCircle2, RefreshCw, Truck, Store, Building, Tag, UserCheck, ShieldCheck, DollarSign, Award, X, Sparkles, Eye, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { crmSalesOrdersApi, type CrmSalesOrder, inventoryApi, posApi, employeesApi, fetchSalesEmployees } from "@/lib/api-client";
import { useTenant } from "@/contexts/tenant-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface AdditionalChargeItem {
  name: string;
  amount: number;
}

export function SalesOrders() {
  const { tenant } = useTenant();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [orders, setOrders] = useState<CrmSalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCreateProdModalOpen, setIsCreateProdModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [pricingMode, setPricingMode] = useState<"Retail" | "Wholesale">("Retail");
  const [selectedLocation, setSelectedLocation] = useState<string>("Store Main Branch");
  const [salesRep, setSalesRep] = useState<string>("");
  const [salesEmployees, setSalesEmployees] = useState<any[]>([]);
  const [paymentMode, setPaymentMode] = useState<string>("Cash");
  const [dueDate, setDueDate] = useState<string>("");
  
  const [additionalCharges, setAdditionalCharges] = useState<AdditionalChargeItem[]>([
    { name: "Transport & Shipping Charges", amount: 0 }
  ]);
  const [newChargeName, setNewChargeName] = useState("");
  const [newChargeAmount, setNewChargeAmount] = useState<number | "">("");

  const [newProdName, setNewProdName] = useState("");
  const [newProdSku, setNewProdSku] = useState("");
  const [newProdMrp, setNewProdMrp] = useState<number | "">("");
  const [newProdSellingPrice, setNewProdSellingPrice] = useState<number | "">("");
  const [newProdWholesalePrice, setNewProdWholesalePrice] = useState<number | "">("");

  const [newOrder, setNewOrder] = useState({
    order_number: "",
    customer_name: "",
    subtotal: 0,
    total: 0,
    status: "Pending",
    payment_status: "Unpaid"
  });

  useEffect(() => {
    const seq = String(orders.length + 1).padStart(4, "0");
    setNewOrder(prev => ({ ...prev, order_number: `SO-2026-${seq}` }));
  }, [orders.length, isAddModalOpen]);

  const totalChargesAmount = additionalCharges.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const calculatedGrandTotal = (Number(newOrder.subtotal) || 0) + totalChargesAmount;
  const salesPointsEarned = Math.floor(calculatedGrandTotal / 100);

  const handleAddCharge = () => {
    if (!newChargeName.trim() || !newChargeAmount) return;
    setAdditionalCharges(prev => [...prev, { name: newChargeName.trim(), amount: Number(newChargeAmount) }]);
    setNewChargeName("");
    setNewChargeAmount("");
  };

  const handleRemoveCharge = (idx: number) => {
    setAdditionalCharges(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCreateProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) return toast.error("Product name is required!");
    try {
      await posApi.createProduct({
        name: newProdName,
        sku: newProdSku || `SKU-${Date.now()}`,
        mrp: Number(newProdMrp) || 0,
        selling_price: Number(newProdSellingPrice) || Number(newProdMrp) || 0,
        wholesale_price: Number(newProdWholesalePrice) || Number(newProdSellingPrice) || 0,
        stock: 100,
        status: "active"
      });
      toast.success("Product created successfully and available in POS/Sales!");
      setIsCreateProdModalOpen(false);
      setNewProdName("");
      setNewProdSku("");
      setNewProdMrp("");
      setNewProdSellingPrice("");
      setNewProdWholesalePrice("");
    } catch (err: any) {
      toast.error(err.message || "Failed to create product");
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const finalPaymentStatus = paymentMode === "Credit" ? "Unpaid" : newOrder.payment_status;
      await crmSalesOrdersApi.create({
        order_number: newOrder.order_number,
        customer_name: newOrder.customer_name || "Walk-in Customer",
        total: calculatedGrandTotal,
        status: newOrder.status,
        payment_status: finalPaymentStatus,
        customer_id: "00000000-0000-0000-0000-000000000000",
      });
      const selectedEmp = salesEmployees.find(e => e.full_name === salesRep);
      if (selectedEmp && salesPointsEarned > 0) {
        employeesApi.addSalesPoints(selectedEmp.id, salesPointsEarned).then((updatedEmp) => {
          if (updatedEmp) {
            setSalesEmployees(prev => prev.map(e => e.id === updatedEmp.id ? updatedEmp : e));
          }
        }).catch(console.error);
      }
      toast.success(`Sales Order ${newOrder.order_number} created! +${salesPointsEarned} pts awarded to ${salesRep || 'Sales Rep'}.`);
      setIsAddModalOpen(false);
      setNewOrder({ order_number: "", customer_name: "", subtotal: 0, total: 0, status: "Pending", payment_status: "Unpaid" });
      void fetchOrders();
    } catch(err: any) {
      toast.error(err?.message || "Failed to create order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await crmSalesOrdersApi.list();
      setOrders(res || []);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchOrders();
    fetchSalesEmployees()
      .then((emps) => {
        setSalesEmployees(emps);
        if (emps && emps.length > 0) {
          setSalesRep(emps[0].full_name);
        } else {
          setSalesRep("Sales Representative");
        }
      })
      .catch(console.error);
  }, [tenant.id]);

  const filteredOrders = orders.filter(o => {
    return o.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
           o.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShoppingCart className="size-6 text-primary" /> Sales Orders
          </h1>
          <p className="text-sm text-muted-foreground">Manage B2B & Retail customer sales orders, extra charges, and team sales points.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => toast.info('Exporting sales orders list…')} className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors">
            <Download className="size-4" /> Export
          </button>
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
                <Plus className="size-4" /> Create Sales Order
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>Create Sales Order</span>
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => setPricingMode("Retail")}
                      className={`px-2.5 py-1 rounded-md font-bold transition ${pricingMode === "Retail" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}
                    >
                      Retail
                    </button>
                    <button
                      type="button"
                      onClick={() => setPricingMode("Wholesale")}
                      className={`px-2.5 py-1 rounded-md font-bold transition ${pricingMode === "Wholesale" ? "bg-emerald-600 text-white shadow" : "text-slate-500"}`}
                    >
                      Wholesale / B2B
                    </button>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddSubmit} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Order Number (Seq)</Label>
                    <Input required value={newOrder.order_number} onChange={e => setNewOrder({...newOrder, order_number: e.target.value})} placeholder="SO-2026-0001" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Destination / Location</Label>
                    <select
                      value={selectedLocation}
                      onChange={e => setSelectedLocation(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs font-semibold"
                    >
                      <option value="Store Main Branch">Store Main Branch</option>
                      <option value="Central Warehouse">Central Warehouse</option>
                      <option value="Secondary Warehouse">Secondary Warehouse</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Customer Name</Label>
                    <Input value={newOrder.customer_name} onChange={e => setNewOrder({...newOrder, customer_name: e.target.value})} placeholder="e.g. Acme Enterprises / Walk-in" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold flex items-center gap-1">
                      <Award className="size-3.5 text-amber-500" /> Sales Rep / Team Member
                    </Label>
                    <select
                      value={salesRep}
                      onChange={e => setSalesRep(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs font-semibold"
                    >
                      {salesEmployees && salesEmployees.length > 0 ? (
                        salesEmployees.map((emp) => (
                          <option key={emp.id} value={emp.full_name}>
                            {emp.full_name} ({emp.employee_code})
                          </option>
                        ))
                      ) : (
                        <option value="">Select Sales Representative</option>
                      )}
                    </select>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-700">Order Subtotal (₹)</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCreateProdModalOpen(true)}
                      className="h-7 text-[11px] font-bold text-indigo-600 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100"
                    >
                      <Plus className="size-3 mr-1" /> Create New Product Inline
                    </Button>
                  </div>
                  <Input
                    required
                    type="number"
                    min="0"
                    value={newOrder.subtotal}
                    onChange={e => setNewOrder({...newOrder, subtotal: Number(e.target.value)})}
                    placeholder="Subtotal before extra charges"
                  />
                </div>

                <div className="p-3 bg-emerald-50/50 border border-emerald-200/80 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                    <span className="flex items-center gap-1.5">
                      <Truck className="size-4 text-emerald-600" /> Additional Charges (Transport, Freight, etc.)
                    </span>
                    <span className="font-mono text-emerald-700">+₹{totalChargesAmount.toFixed(2)}</span>
                  </div>
                  {additionalCharges.map((ch, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white border border-emerald-100 px-3 py-1.5 rounded-lg text-xs font-semibold">
                      <span className="text-slate-700">{ch.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">₹{ch.amount}</span>
                        <button type="button" onClick={() => handleRemoveCharge(idx)} className="text-rose-500 hover:text-rose-700 p-0.5">
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="flex gap-2 pt-1">
                    <Input
                      value={newChargeName}
                      onChange={e => setNewChargeName(e.target.value)}
                      placeholder="Charge Name (e.g. Freight / Packing)"
                      className="h-8 text-xs bg-white"
                    />
                    <Input
                      type="number"
                      value={newChargeAmount}
                      onChange={e => setNewChargeAmount(e.target.value ? Number(e.target.value) : "")}
                      placeholder="Amount ₹"
                      className="h-8 text-xs w-28 bg-white"
                    />
                    <Button type="button" size="sm" onClick={handleAddCharge} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 shrink-0">
                      Add
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Payment Method</Label>
                    <select
                      value={paymentMode}
                      onChange={e => setPaymentMode(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs font-semibold"
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI / QR">UPI / QR Code</option>
                      <option value="Card">Credit/Debit Card</option>
                      <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                      <option value="Credit">Credit (Pay Later)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Status</Label>
                    <select
                      value={newOrder.status}
                      onChange={e => setNewOrder({...newOrder, status: e.target.value})}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs font-semibold"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Processing">Processing</option>
                      <option value="Shipped">Shipped</option>
                      <option value="Delivered">Delivered</option>
                    </select>
                  </div>
                </div>

                {paymentMode === "Credit" && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
                    <Label className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <Clock className="size-4 text-amber-600" /> Pay Later Due Date
                    </Label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      className="h-9 text-xs bg-white"
                    />
                    <p className="text-[11px] text-amber-700 font-medium">
                      Order will be saved with <span className="font-bold">Unpaid</span> status and logged under Accounts Receivable.
                    </p>
                  </div>
                )}

                <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between text-xs font-bold">
                  <div>
                    <div className="text-slate-400 font-normal">Calculated Grand Total:</div>
                    <div className="text-xl font-bold font-mono text-emerald-400">₹{calculatedGrandTotal.toFixed(2)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-amber-400 flex items-center gap-1 justify-end">
                      <Award className="size-3.5" /> +{salesPointsEarned} Sales Points
                    </div>
                    {(() => {
                      const selectedEmp = salesEmployees.find(e => e.full_name === salesRep);
                      const totalPts = ((selectedEmp?.sales_points || 0) + salesPointsEarned).toFixed(0);
                      return (
                        <div className="text-[10px] text-slate-400 font-normal">
                          {salesRep || 'Sales Rep'} {selectedEmp ? `(Total: ${totalPts} Pts)` : ''}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <DialogFooter className="pt-2">
                  <button type="submit" disabled={isSubmitting} className="flex items-center justify-center gap-2 w-full px-4 py-2.5 gradient-brand text-white rounded-lg text-sm font-bold shadow-md hover:opacity-90 transition-opacity disabled:opacity-50">
                    {isSubmitting ? "Creating Order..." : `Confirm & Save Sales Order (₹${calculatedGrandTotal.toFixed(2)})`}
                  </button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: "Pending Orders", value: orders.filter(o => o.status === 'Pending').length, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Processing", value: orders.filter(o => o.status === 'Processing').length, icon: RefreshCw, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Shipped", value: orders.filter(o => o.status === 'Shipped').length, icon: ShoppingCart, color: "text-indigo-500", bg: "bg-indigo-500/10" },
          { label: "Delivered", value: orders.filter(o => o.status === 'Delivered').length, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Pay Later / Unpaid", value: orders.filter(o => o.payment_status === 'Unpaid').length, icon: CreditCard, color: "text-rose-500", bg: "bg-rose-500/10" },
        ].map((stat, i) => (
          <div key={i} className="glass-panel p-4 rounded-xl border border-border/50 flex flex-col justify-center items-center text-center bg-card">
            <div className={`p-2 rounded-full ${stat.bg} mb-2`}>
              <stat.icon className={`size-5 ${stat.color}`} />
            </div>
            <h3 className="text-2xl font-bold text-foreground">{stat.value}</h3>
            <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 glass-panel p-4 rounded-xl border border-border/50 bg-card">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search orders by number or customer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none"
          />
        </div>
        <button onClick={() => toast.info('Filters applied')} className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors">
          <Filter className="size-4" /> Filter
        </button>
      </div>

      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden bg-card">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading orders…</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border/50">
                <tr>
                  <th className="px-6 py-4">Order ID</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Payment</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground font-medium">
                      No sales orders found. Click "Create Sales Order" to record a new sale.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o) => {
                    const isExpanded = expandedId === o.id;
                    return (
                      <React.Fragment key={o.id}>
                        <tr className={`hover:bg-muted/30 transition-colors ${isExpanded ? "bg-primary/5" : ""}`}>
                          <td className="px-6 py-4 font-mono font-bold text-primary flex items-center gap-2">
                            <Box className="size-4 text-primary" /> {o.order_number}
                          </td>
                          <td className="px-6 py-4 font-medium">{o.customer_name || "Walk-in Customer"}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              o.status === 'Delivered' ? 'bg-emerald-500/10 text-emerald-600' :
                              o.status === 'Shipped' ? 'bg-indigo-500/10 text-indigo-600' :
                              'bg-amber-500/10 text-amber-600'
                            }`}>
                              {o.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              o.payment_status === 'Paid' ? 'bg-emerald-500/10 text-emerald-600' :
                              'bg-rose-500/10 text-rose-600'
                            }`}>
                              {o.payment_status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-bold font-mono">₹{Number(o.total || 0).toFixed(2)}</td>
                          <td className="px-6 py-4 text-right">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => {
                                setNewOrder({
                                  order_number: o.order_number,
                                  customer_name: o.customer_name || "",
                                  subtotal: o.subtotal || 0,
                                  total: o.total || 0,
                                  status: o.status || "Pending",
                                  payment_status: o.payment_status || "Unpaid"
                                });
                                setIsAddModalOpen(true);
                              }}
                              className="h-8 gap-1.5 font-bold rounded-lg hover:bg-primary/10 text-primary border-primary/30"
                            >
                              <Eye className="size-4" /> View / Edit Page
                            </Button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-50/80">
                            <td colSpan={6} className="p-6 border-b border-indigo-100">
                              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                                <div className="flex flex-wrap justify-between items-center gap-3 border-b pb-3">
                                  <div>
                                    <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Sales Order Invoice Details</div>
                                    <div className="text-lg font-black text-slate-900 mt-0.5">{o.order_number}</div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500 font-mono">Customer: {o.customer_name || "Walk-in"}</span>
                                    <Button size="sm" variant="outline" onClick={() => window.print()} className="h-8 text-xs font-bold rounded-lg">
                                      <Printer className="size-3.5 mr-1" /> Print Sales Invoice
                                    </Button>
                                  </div>
                                </div>

                                <div>
                                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <FileText className="size-3.5 text-indigo-500" /> Ordered Items & Pricing Breakdown
                                  </h4>
                                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                      <thead className="bg-slate-100 text-slate-600 text-xs uppercase font-bold">
                                        <tr>
                                          <th className="px-4 py-2.5">#</th>
                                          <th className="px-4 py-2.5">Product Name</th>
                                          <th className="px-4 py-2.5 text-center">Ordered Qty</th>
                                          <th className="px-4 py-2.5 text-right">Unit Price (₹)</th>
                                          <th className="px-4 py-2.5 text-right">Subtotal (₹)</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 bg-white">
                                        {o.items && o.items.length > 0 ? (
                                          o.items.map((it: any, i: number) => {
                                            const qty = Number(it.quantity) || 1;
                                            const price = Number(it.price || it.unit_price) || 0;
                                            return (
                                              <tr key={i} className="hover:bg-slate-50">
                                                <td className="px-4 py-2 text-xs font-mono font-bold text-slate-400">{i + 1}</td>
                                                <td className="px-4 py-2 font-semibold text-slate-800">{it.product_name || it.name || "Sales Product"}</td>
                                                <td className="px-4 py-2 text-center font-bold text-indigo-900">{qty} Units</td>
                                                <td className="px-4 py-2 text-right text-slate-600">₹{price.toFixed(2)}</td>
                                                <td className="px-4 py-2 text-right font-black text-slate-900">₹{(qty * price).toFixed(2)}</td>
                                              </tr>
                                            );
                                          })
                                        ) : (
                                          <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No line items detailed for this sales order.</td></tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
