import { useState, useEffect } from "react";
import React from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, Package, Loader2, Eye, Printer, FileText } from "lucide-react";
import { inventoryApi } from "../../lib/api-client";
import { toast } from "sonner";

import { PurchaseRequisitionForm } from "./PurchaseRequisitionForm";
import { useCurrency } from "@/hooks/use-currency";

export function PurchaseRequests() {
    const { currency, formatCurrency } = useCurrency();
  const [requests, setRequests] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const prs = await inventoryApi.getPurchaseRequests();
      setRequests(prs || []);
      const prodsRes = await inventoryApi.getProducts();
      setProducts(prodsRes.items || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load purchase requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (isCreateMode || selectedDoc) {
    return (
      <PurchaseRequisitionForm
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
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Purchase Requests (PR)
          </h2>
          <p className="text-sm text-muted-foreground">Manage internal departmental requests for materials and services.</p>
        </div>
        <Button onClick={() => setIsCreateMode(true)} className="gradient-brand text-white border-0 font-semibold rounded-lg shadow-sm">
          <Plus className="size-4 mr-2" /> Raise PR
        </Button>
      </div>

      <Card className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
              <tr>
                <th className="py-4 px-6">PR Number</th>
                <th className="py-4 px-6">Target Vendor / Supplier</th>
                <th className="py-4 px-6">Requested Items</th>
                <th className="py-4 px-6 text-right">Total Amount</th>
                <th className="py-4 px-6">Date Raised</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading purchase requisitions...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    No purchase requests found. Click "+ Raise PR" above to create a new requisition.
                  </td>
                </tr>
              ) : (
                requests.map((req: any) => (
                  <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-4 px-6 font-mono font-bold text-primary">{req.request_number || req.id.slice(0, 8)}</td>
                    <td className="py-4 px-6 font-medium text-foreground">{req.supplier?.name || "General Supplier"}</td>
                    <td className="py-4 px-6 text-muted-foreground">
                      {req.items && req.items.length > 0 ? (
                        <div className="space-y-0.5">
                          {req.items.map((it: any) => (
                            <div key={it.id || it.product_id} className="text-xs font-semibold text-slate-800">
                              • {it.product_name || "Material"} (x{it.quantity})
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span>1 material line item</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right font-extrabold text-foreground">
                      {currency.symbol}{Number(req.total_amount || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="py-4 px-6 text-muted-foreground font-mono text-xs">
                      {req.request_date || req.created_at
                        ? new Date(req.request_date || req.created_at).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : new Date().toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        req.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
                        req.status === 'Pending' || req.status === 'Pending Approval' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
                        'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                      }`}>
                        {req.status || 'Draft'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setSelectedDoc(req)}
                          className="h-8 gap-1.5 font-bold rounded-lg hover:bg-primary/10"
                        >
                          <Eye className="size-4" /> View / Edit Page
                        </Button>
                      </div>
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
