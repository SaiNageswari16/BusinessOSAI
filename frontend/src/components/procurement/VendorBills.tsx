import { useState, useEffect } from "react";
import React from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, Receipt, Loader2, Eye, ChevronDown, ChevronUp, Printer, FileText } from "lucide-react";
import { inventoryApi } from "../../lib/api-client";
import { toast } from "sonner";
import { ProcurementDocumentForm } from "./ProcurementDocumentForm";

export function VendorBills() {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.getVendorBills();
      setBills(res || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load vendor bills");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (isCreateMode) {
    return (
      <ProcurementDocumentForm
        docType="PINV"
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
            <Receipt className="text-primary size-6" /> Purchase Invoices & Vendor Bills
          </h2>
          <p className="text-sm text-muted-foreground">Manage supplier purchase invoices linked to POs and GRNs.</p>
        </div>
        <Button onClick={() => setIsCreateMode(true)} className="gradient-brand text-white border-0 font-semibold rounded-lg shadow-sm">
          <Plus className="size-4 mr-2" /> Log Purchase Invoice
        </Button>
      </div>

      <Card className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-muted/50 border-b text-muted-foreground text-xs uppercase font-semibold">
                <th className="py-4 px-6">Bill / Invoice Number</th>
                <th className="py-4 px-6">Linked PO Reference</th>
                <th className="py-4 px-6 text-right font-bold">Invoiced Amount</th>
                <th className="py-4 px-6 text-right">Paid Amount</th>
                <th className="py-4 px-6">Due Date</th>
                <th className="py-4 px-6">Payment Status</th>
                <th className="py-4 px-6 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading purchase invoices...
                  </td>
                </tr>
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    No vendor purchase bills logged yet. Click "+ Log Purchase Invoice" above to create one.
                  </td>
                </tr>
              ) : (
                bills.map((b: any) => {
                  const isExpanded = expandedId === b.id;
                  return (
                    <React.Fragment key={b.id}>
                      <tr className={`hover:bg-muted/30 transition-colors ${isExpanded ? "bg-primary/5" : ""}`}>
                        <td className="py-4 px-6 font-mono font-bold text-primary">{b.bill_number || b.id.slice(0, 8)}</td>
                        <td className="py-4 px-6 font-medium text-foreground">{b.purchase_order_id ? `PO-${b.purchase_order_id.slice(0, 6)}` : "Direct Invoice"}</td>
                        <td className="py-4 px-6 text-right font-bold text-foreground">
                          ₹{b.total_amount?.toLocaleString("en-IN") || 0}
                        </td>
                        <td className="py-4 px-6 text-right font-semibold text-emerald-600">
                          ₹{b.paid_amount?.toLocaleString("en-IN") || 0}
                        </td>
                        <td className="py-4 px-6 text-muted-foreground">
                          {b.due_date ? new Date(b.due_date).toLocaleDateString() : "Net 30"}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            b.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
                            b.status === 'Partial' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
                            'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                          }`}>
                            {b.status || 'Unpaid'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setExpandedId(prev => prev === b.id ? null : b.id)}
                            className={`h-8 gap-1 font-bold rounded-lg ${isExpanded ? "bg-primary text-white border-primary" : "hover:bg-primary/10"}`}
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
                                  <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Purchase Invoice Vendor Bill Details</div>
                                  <div className="text-lg font-black text-slate-900 mt-0.5">{b.bill_number || b.id}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500 font-mono">Invoice Date: {b.created_at || "Today"}</span>
                                  <Button size="sm" variant="outline" onClick={() => window.print()} className="h-8 text-xs font-bold rounded-lg">
                                    <Printer className="size-3.5 mr-1" /> Print Purchase Invoice
                                  </Button>
                                </div>
                              </div>

                              <div>
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                  <FileText className="size-3.5 text-indigo-500" /> Invoiced Line Items Breakdown
                                </h4>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                  <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-100 text-slate-600 text-xs uppercase font-bold">
                                      <tr>
                                        <th className="px-4 py-2.5">#</th>
                                        <th className="px-4 py-2.5">Invoiced Product / Service</th>
                                        <th className="px-4 py-2.5 text-center">Invoiced Qty</th>
                                        <th className="px-4 py-2.5 text-right">Unit Price (₹)</th>
                                        <th className="px-4 py-2.5 text-right">Subtotal (₹)</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                      {b.items && b.items.length > 0 ? (
                                        b.items.map((it: any, i: number) => {
                                          const qty = Number(it.quantity) || 1;
                                          const price = Number(it.unit_price) || 0;
                                          return (
                                            <tr key={i} className="hover:bg-slate-50">
                                              <td className="px-4 py-2 text-xs font-mono font-bold text-slate-400">{i + 1}</td>
                                              <td className="px-4 py-2 font-semibold text-slate-800">{it.product_name || "Purchase Item"}</td>
                                              <td className="px-4 py-2 text-center font-bold text-indigo-900">{qty} Units</td>
                                              <td className="px-4 py-2 text-right text-slate-600">₹{price.toLocaleString("en-IN")}</td>
                                              <td className="px-4 py-2 text-right font-black text-slate-900">₹{(qty * price).toLocaleString("en-IN")}</td>
                                            </tr>
                                          );
                                        })
                                      ) : (
                                        <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Direct Purchase Invoice (₹{(b.total_amount || 0).toLocaleString("en-IN")})</td></tr>
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
