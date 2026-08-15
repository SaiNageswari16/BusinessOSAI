import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileCheck, Search, Filter, ArrowRight, Truck, PackageCheck, FileText, Printer, CheckCircle, Plus, Loader2, X } from "lucide-react";
import { Button } from "../ui/button";
import { deliveryChallanApi, invoicesApi } from "../../lib/api-client";

export function DeliveryChallans() {
  const [challans, setChallans] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    invoice_id: "",
    challan_date: new Date().toISOString().split('T')[0],
    transporter_name: "",
    vehicle_number: "",
    waybill_number: "",
    notes: "",
    items: [{ product_name: "", quantity: 1, uom: "pcs" }]
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resChallans, resInvoices] = await Promise.all([
        deliveryChallanApi.getChallans(),
        invoicesApi.listInvoices()
      ]);
      setChallans(resChallans.items || []);
      setInvoices(resInvoices.items || []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDispatch = async (id: string) => {
    if (!confirm("Are you sure you want to mark this challan as dispatched? This will deduct stock.")) return;
    try {
      await deliveryChallanApi.dispatchChallan(id);
      fetchData();
    } catch (error) {
      alert("Failed to dispatch challan.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await deliveryChallanApi.createChallan(formData);
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      alert("Failed to create Delivery Challan.");
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Delivery Challans</h2>
          <p className="text-sm text-muted-foreground">Manage outward dispatch documents and gate passes.</p>
        </div>
        <Button className="gradient-brand text-white border-0" onClick={() => setIsModalOpen(true)}>
          <Plus className="size-4 mr-2" /> Generate Challan
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search challans..."
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
          />
        </div>
        <select className="h-10 px-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="dispatched">Dispatched</option>
          <option value="delivered">Delivered</option>
        </select>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden relative min-h-[300px]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}
        
        {/* List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Challan Details</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Transport Info</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? null : challans.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground">No Delivery Challans found.</td>
                </tr>
              ) : (
                challans.map((dc) => (
                  <tr key={dc.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-primary">{dc.challan_number}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{dc.challan_date}</div>
                      {dc.invoice_id && <div className="text-xs text-indigo-600 mt-1 font-medium bg-indigo-50 inline-block px-1.5 py-0.5 rounded">Linked to Invoice</div>}
                    </td>
                    <td className="px-6 py-4 font-medium">{dc.customer_name}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{dc.transporter_name || 'N/A'}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 ml-5 font-mono">{dc.vehicle_number}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        dc.status === 'draft' ? 'bg-slate-500/10 text-slate-600'
                        : dc.status === 'dispatched' ? 'bg-amber-500/10 text-amber-600'
                        : 'bg-emerald-500/10 text-emerald-600'
                      }`}>
                        {dc.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" title="Print Challan">
                        <Printer className="size-4" />
                      </Button>
                      {dc.status === 'draft' && (
                        <Button variant="ghost" size="icon" onClick={() => handleDispatch(dc.id)} className="h-8 w-8 text-muted-foreground hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Mark Dispatched">
                          <CheckCircle className="size-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" title="View Details">
                        <ArrowRight className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card w-full max-w-lg rounded-xl shadow-lg border overflow-hidden"
            >
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="font-semibold text-lg">Generate Delivery Challan</h3>
                <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)}>
                  <X className="size-4" />
                </Button>
              </div>
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                <div className="space-y-1.5 mb-4 border-b pb-4">
                  <label className="text-sm font-medium">Link to Sales Invoice (Optional)</label>
                  <select value={formData.invoice_id} onChange={e => setFormData({...formData, invoice_id: e.target.value})} className="w-full h-10 px-3 border rounded-lg bg-card">
                    <option value="">-- No Invoice Selected --</option>
                    {invoices.map(inv => (
                      <option key={inv.id} value={inv.id}>{inv.invoice_number} ({inv.customer_name})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Challan Date</label>
                    <input type="date" required value={formData.challan_date} onChange={e => setFormData({...formData, challan_date: e.target.value})} className="w-full h-10 px-3 border rounded-lg" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Transporter Name</label>
                    <input type="text" required value={formData.transporter_name} onChange={e => setFormData({...formData, transporter_name: e.target.value})} className="w-full h-10 px-3 border rounded-lg" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Vehicle Number</label>
                    <input type="text" required value={formData.vehicle_number} onChange={e => setFormData({...formData, vehicle_number: e.target.value})} className="w-full h-10 px-3 border rounded-lg" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Waybill / LR No.</label>
                    <input type="text" value={formData.waybill_number} onChange={e => setFormData({...formData, waybill_number: e.target.value})} className="w-full h-10 px-3 border rounded-lg" />
                  </div>
                </div>

                <div className="pt-2">
                  <h4 className="text-sm font-semibold mb-2">Items</h4>
                  {formData.items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center mb-2">
                      <input type="text" required placeholder="Product Name" value={item.product_name} onChange={e => {
                        const newItems = [...formData.items];
                        newItems[idx].product_name = e.target.value;
                        setFormData({...formData, items: newItems});
                      }} className="flex-1 h-9 px-3 border rounded-lg text-sm" />
                      <input type="number" required min="1" value={item.quantity} onChange={e => {
                        const newItems = [...formData.items];
                        newItems[idx].quantity = parseFloat(e.target.value);
                        setFormData({...formData, items: newItems});
                      }} className="w-20 h-9 px-3 border rounded-lg text-sm" />
                    </div>
                  ))}
                </div>
                
                <div className="pt-4 flex justify-end gap-2 border-t mt-4">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                  <Button type="submit" className="gradient-brand text-white border-0">Save Challan</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
