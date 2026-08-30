import { useState, useEffect } from "react";
import React from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, Truck, Loader2, Eye, Printer, FileText } from "lucide-react";
import { inventoryApi } from "../../lib/api-client";
import { toast } from "sonner";
import { ProcurementDocumentForm } from "./ProcurementDocumentForm";
import { useCurrency } from "@/hooks/use-currency";

export function PurchaseOrders() {
    const { currency, formatCurrency } = useCurrency();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.getPurchaseOrders();
      setOrders(res || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (isCreateMode || selectedDoc) {
    return (
      <ProcurementDocumentForm
        docType="PO"
        initialData={selectedDoc}
        onClose={() => {
          setIsCreateMode(false);
          setSelectedDoc(null);
        }}
        onSaved={() => {
          setIsCreateMode(false);
          setSelectedDoc(null);
          fetchData();
        }}
      />
    );
  }

  return (
    <div className="space-y-6 text-foreground">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Purchase Orders (PO)
          </h2>
          <p className="text-sm text-muted-foreground">Manage official supplier orders, approvals, and dispatch status.</p>
        </div>
        <Button onClick={() => setIsCreateMode(true)} className="gradient-brand text-white border-0 font-semibold rounded-lg shadow-sm">
          <Plus className="size-4 mr-2" /> Create PO
        </Button>
      </div>

      <Card className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
              <tr>
                <th className="py-4 px-6">PO Number</th>
                <th className="py-4 px-6">Supplier Vendor</th>
                <th className="py-4 px-6">Ordered Items</th>
                <th className="py-4 px-6 text-right font-bold">Total Amount</th>
                <th className="py-4 px-6">Dispatch Status</th>
                <th className="py-4 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading purchase orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    No purchase orders found. Click "+ Create PO" above to issue a new Purchase Order.
                  </td>
                </tr>
              ) : (
                orders.map((po: any) => (
                  <tr key={po.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-4 px-6 font-mono font-bold text-primary">{po.po_number || po.id.slice(0, 8)}</td>
                    <td className="py-4 px-6 font-medium text-foreground">{po.supplier_name || po.supplier?.name || "Global Vendor"}</td>
                    <td className="py-4 px-6 text-muted-foreground">{po.items?.length || 1} material items</td>
                    <td className="py-4 px-6 text-right font-bold text-foreground">
                      {currency.symbol}{po.total_amount?.toLocaleString("en-IN") || 0}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        po.status === 'Sent' || po.status === 'Issued' ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' :
                        po.status === 'Fully Received' || po.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
                        po.status === 'Partially Received' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
                        po.status === 'Billed' ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20' :
                        po.status === 'Cancelled' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' :
                        'bg-slate-500/10 text-slate-600 border border-slate-500/20'
                      }`}>
                        {po.status || 'Draft'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSelectedDoc(po)}
                        className="h-8 gap-1.5 font-bold rounded-lg hover:bg-primary/10"
                      >
                        <Eye className="size-4" /> View / Edit Page
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
