import { useState, useEffect } from "react";
import React from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, Package, Loader2, Eye, ChevronDown, ChevronUp, Printer, FileText } from "lucide-react";
import { inventoryApi } from "../../lib/api-client";
import { toast } from "sonner";

import { PurchaseRequisitionForm } from "./PurchaseRequisitionForm";

export function PurchaseRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  if (isCreateMode) {
    return (
      <PurchaseRequisitionForm
        onClose={() => setIsCreateMode(false)}
        onSaved={fetchData}
      />
    );
  }

  return (
    <div className="space-y-6 text-foreground">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Package className="text-primary size-6" /> Purchase Requests (PR)
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
            <thead>
              <tr className="bg-muted/50 border-b text-muted-foreground text-xs uppercase font-semibold">
                <th className="py-4 px-6">PR Number</th>
                <th className="py-4 px-6">Target Vendor / Supplier</th>
                <th className="py-4 px-6">Requested Items</th>
                <th className="py-4 px-6 text-right">Total Amount</th>
                <th className="py-4 px-6">Date Raised</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Details</th>
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
                requests.map((req: any) => {
                  const isExpanded = expandedId === req.id;
                  return (
                    <React.Fragment key={req.id}>
                      <tr className={`hover:bg-muted/30 transition-colors ${isExpanded ? "bg-primary/5" : ""}`}>
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
                          ₹{Number(req.total_amount || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="py-4 px-6 text-muted-foreground font-mono text-xs">
                          {req.request_date || (req.created_at ? new Date(req.created_at).toLocaleDateString() : new Date().toLocaleDateString())}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            req.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
                            req.status === 'Pending' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
                            'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                          }`}>
                            {req.status || 'Draft'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => toggleExpand(req.id)}
                            className={`h-8 gap-1.5 font-bold rounded-lg ${isExpanded ? "bg-primary text-white border-primary" : "hover:bg-primary/10"}`}
                          >
                            <Eye className="size-4" />
                            {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                          </Button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={7} className="p-6 border-b border-indigo-100">
                            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                              <div className="flex flex-wrap justify-between items-center gap-3 border-b pb-3">
                                <div>
                                  <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Purchase Request Details</div>
                                  <div className="text-lg font-black text-slate-900 mt-0.5">
                                    {req.request_number || req.id}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500 font-mono">Date Raised: {req.request_date || req.created_at}</span>
                                  <Button size="sm" variant="outline" onClick={() => window.print()} className="h-8 text-xs font-bold rounded-lg">
                                    <Printer className="size-3.5 mr-1" /> Print Voucher
                                  </Button>
                                </div>
                              </div>

                              <div>
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                  <FileText className="size-3.5 text-indigo-500" /> Requested Line Items & Quantities
                                </h4>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                  <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-100 text-slate-600 text-xs uppercase font-bold">
                                      <tr>
                                        <th className="px-4 py-2.5">#</th>
                                        <th className="px-4 py-2.5">Product Name</th>
                                        <th className="px-4 py-2.5 text-center">Requested Quantity</th>
                                        <th className="px-4 py-2.5 text-right">Est. Unit Price (₹)</th>
                                        <th className="px-4 py-2.5 text-right">Subtotal Valuation (₹)</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                      {req.items && req.items.length > 0 ? (
                                        req.items.map((it: any, i: number) => {
                                          const qty = Number(it.quantity) || 1;
                                          const price = Number(it.unit_price) || (req.total_amount ? req.total_amount / req.items.length : 0);
                                          return (
                                            <tr key={i} className="hover:bg-slate-50">
                                              <td className="px-4 py-2 text-xs font-mono font-bold text-slate-400">{i + 1}</td>
                                              <td className="px-4 py-2 font-semibold text-slate-800">{it.product_name || "Material Item"}</td>
                                              <td className="px-4 py-2 text-center font-bold text-indigo-900">{qty} Units</td>
                                              <td className="px-4 py-2 text-right text-slate-600">₹{price.toLocaleString("en-IN")}</td>
                                              <td className="px-4 py-2 text-right font-black text-slate-900">₹{(qty * price).toLocaleString("en-IN")}</td>
                                            </tr>
                                          );
                                        })
                                      ) : (
                                        <tr>
                                          <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                                            No detailed items logged for this request.
                                          </td>
                                        </tr>
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
        </div>
      </Card>
    </div>
  );
}
