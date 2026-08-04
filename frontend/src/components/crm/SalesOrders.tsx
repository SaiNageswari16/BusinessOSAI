import { toast } from "sonner";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Filter, ShoppingCart, Download, Printer, Box, CreditCard, Clock, CheckCircle2, RefreshCw } from "lucide-react";
import { crmSalesOrdersApi, type CrmSalesOrder } from "@/lib/api-client";
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

export function SalesOrders() {
  const { tenant } = useTenant();
  const [searchTerm, setSearchTerm] = useState("");
  const [orders, setOrders] = useState<CrmSalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newOrder, setNewOrder] = useState({ order_number: "", customer_name: "", total: 0, status: "Pending", payment_status: "Unpaid" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await crmSalesOrdersApi.create({
        order_number: newOrder.order_number,
        customer_name: newOrder.customer_name,
        total: newOrder.total,
        status: newOrder.status,
        payment_status: newOrder.payment_status,
        customer_id: "00000000-0000-0000-0000-000000000000",
      });
      toast.success("Order created successfully!");
      setIsAddModalOpen(false);
      setNewOrder({ order_number: "", customer_name: "", total: 0, status: "Pending", payment_status: "Unpaid" });
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
  }, [tenant.id]);

  const filteredOrders = orders.filter(o => {
    return o.order_number.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales Orders</h1>
          <p className="text-sm text-muted-foreground">Track and manage customer orders, integrated with inventory and fulfillment.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => toast.info('Feature coming soon!')} className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors">
            <Download className="size-4" /> Export
          </button>
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
                <Plus className="size-4" /> Create Order
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create Sales Order</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Order Number</Label>
                  <Input required value={newOrder.order_number} onChange={e => setNewOrder({...newOrder, order_number: e.target.value})} placeholder="SO-2026-001" />
                </div>
                <div className="space-y-2">
                  <Label>Customer Name</Label>
                  <Input value={newOrder.customer_name} onChange={e => setNewOrder({...newOrder, customer_name: e.target.value})} placeholder="e.g. Acme Corp" />
                </div>
                <div className="space-y-2">
                  <Label>Total Amount (₹)</Label>
                  <Input required type="number" min="0" value={newOrder.total} onChange={e => setNewOrder({...newOrder, total: Number(e.target.value)})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <select value={newOrder.status} onChange={e => setNewOrder({...newOrder, status: e.target.value})} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                      <option value="Pending">Pending</option>
                      <option value="Processing">Processing</option>
                      <option value="Shipped">Shipped</option>
                      <option value="Delivered">Delivered</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Payment</Label>
                    <select value={newOrder.payment_status} onChange={e => setNewOrder({...newOrder, payment_status: e.target.value})} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                      <option value="Unpaid">Unpaid</option>
                      <option value="Partially Paid">Partially Paid</option>
                      <option value="Paid">Paid</option>
                    </select>
                  </div>
                </div>
                <DialogFooter className="pt-4">
                  <button type="submit" disabled={isSubmitting} className="flex items-center justify-center gap-2 w-full px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                    {isSubmitting ? "Creating..." : "Create Order"}
                  </button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: "Pending", value: "0", icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Processing", value: "1", icon: RefreshCw, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Shipped", value: "0", icon: ShoppingCart, color: "text-indigo-500", bg: "bg-indigo-500/10" },
          { label: "Delivered", value: "4,521", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Unpaid", value: "0", icon: CreditCard, color: "text-red-500", bg: "bg-red-500/10" },
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
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none"
          />
        </div>
        <button onClick={() => toast.info('Feature coming soon!')} className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors">
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
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4">Fulfillment Status</th>
                  <th className="px-6 py-4">Payment Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredOrders.map((order, i) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    key={order.id} 
                    className="hover:bg-muted/50 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <p className="font-semibold text-foreground flex items-center gap-2">
                        <Box className="size-4 text-primary" /> {order.order_number}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {order.items?.items?.length || 0} Items
                      </p>
                    </td>
                    <td className="px-6 py-4 font-medium">{(order as any).customer_name || "Enterprise Customer"}</td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-bold text-foreground text-right">
                      ₹{Number(order.total).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 w-fit ${
                        order.status === 'Pending' ? 'bg-amber-500/10 text-amber-600' :
                        order.status === 'Processing' ? 'bg-blue-500/10 text-blue-600' :
                        order.status === 'Shipped' ? 'bg-indigo-500/10 text-indigo-600' :
                        'bg-emerald-500/10 text-emerald-600'
                      }`}>
                        {order.status === 'Pending' ? <Clock className="size-3" /> :
                         order.status === 'Processing' ? <RefreshCw className="size-3" /> :
                         order.status === 'Shipped' ? <ShoppingCart className="size-3" /> :
                         <CheckCircle2 className="size-3" />}
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                        order.payment_status === 'Paid' ? 'bg-emerald-500/10 text-emerald-600' :
                        order.payment_status === 'Partially Paid' ? 'bg-blue-500/10 text-blue-600' :
                        'bg-red-500/10 text-red-600'
                      }`}>
                        {order.payment_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => toast.info('Feature coming soon!')} className="p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground rounded-md transition-colors" title="Print Invoice">
                          <Printer className="size-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
