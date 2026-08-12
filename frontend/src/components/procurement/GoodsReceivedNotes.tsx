import { useState, useEffect } from "react";
import React from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, Boxes, Loader2, CheckCircle2, ShieldAlert, Eye, ChevronDown, ChevronUp, Printer, FileText } from "lucide-react";
import { inventoryApi } from "../../lib/api-client";
import { toast } from "sonner";
import { GoodsReceivedNoteForm } from "./GoodsReceivedNoteForm";

export function GoodsReceivedNotes() {
  const [grns, setGrns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.getGoodsReceivedNotes();
      setGrns(res || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load GRN logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (isCreateMode) {
    return (
      <GoodsReceivedNoteForm
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
            <Boxes className="text-primary size-6" /> Goods Received Notes (GRN)
          </h2>
          <p className="text-sm text-muted-foreground">Record inward delivered shipments, perform QC, and update stock.</p>
        </div>
        <Button onClick={() => setIsCreateMode(true)} className="gradient-brand text-white border-0 font-semibold rounded-lg shadow-sm">
          <Plus className="size-4 mr-2" /> Log GRN Inward Receipt
        </Button>
      </div>

      <Card className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-muted/50 border-b text-muted-foreground text-xs uppercase font-semibold">
                <th className="py-4 px-6">GRN Document No</th>
                <th className="py-4 px-6">Linked PO Reference</th>
                <th className="py-4 px-6">Received Items</th>
                <th className="py-4 px-6">QC Inspection Status</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                    Loading GRNs...
                  </td>
                </tr>
              ) : grns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-muted-foreground font-semibold">
                    No Goods Received Notes logged yet. Click "+ Log GRN Inward Receipt" to receive stock.
                  </td>
                </tr>
              ) : (
                grns.map((grn) => {
                  const isExpanded = expandedId === grn.id;
                  return (
                    <React.Fragment key={grn.id}>
                      <tr className={`hover:bg-muted/30 transition-colors ${isExpanded ? "bg-primary/5" : ""}`}>
                        <td className="py-4 px-6 font-mono font-bold">
                          <div className="flex items-center gap-2">
                            <Boxes className="size-4 text-primary" />
                            {grn.grn_number}
                          </div>
                        </td>
                        <td className="py-4 px-6 font-mono text-xs text-muted-foreground">{grn.po_number || "Direct Inward"}</td>
                        <td className="py-4 px-6">
                          {grn.items && grn.items.length > 0 ? (
                            <div className="space-y-0.5 text-xs">
                              {grn.items.map((it: any) => (
                                <div key={it.id || it.product_id} className="font-semibold text-slate-800">
                                  • {it.product_name || "Material Item"} (x{it.quantity_received})
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">1 received line item</span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          {grn.items && grn.items.length > 0 ? (
                            <div>
                              <div className="font-bold text-emerald-600">
                                {grn.items[0].quantity_accepted || grn.items[0].quantity_received} Accepted
                              </div>
                              {grn.items[0].quantity_rejected > 0 && (
                                <div className="text-[10px] text-rose-600 font-semibold mt-0.5">
                                  {grn.items[0].quantity_rejected} Rejected / Defective
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-emerald-600 font-bold">Passed Inspection</span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            {grn.status || "Received"}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setExpandedId(prev => prev === grn.id ? null : grn.id)}
                            className={`h-8 gap-1 font-bold rounded-lg ${isExpanded ? "bg-primary text-white border-primary" : "hover:bg-primary/10"}`}
                          >
                            <Eye className="size-4" />
                            {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                          </Button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={6} className="p-6 border-b border-indigo-100">
                            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                              <div className="flex flex-wrap justify-between items-center gap-3 border-b pb-3">
                                <div>
                                  <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Goods Received Note Inward Details</div>
                                  <div className="text-lg font-black text-slate-900 mt-0.5">{grn.grn_number}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500 font-mono">PO Ref: {grn.po_number || "Direct Inward"}</span>
                                  <Button size="sm" variant="outline" onClick={() => window.print()} className="h-8 text-xs font-bold rounded-lg">
                                    <Printer className="size-3.5 mr-1" /> Print GRN Slip
                                  </Button>
                                </div>
                              </div>

                              <div>
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                  <FileText className="size-3.5 text-indigo-500" /> Inward Products & QC Breakdown
                                </h4>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                  <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-100 text-slate-600 text-xs uppercase font-bold">
                                      <tr>
                                        <th className="px-4 py-2.5">#</th>
                                        <th className="px-4 py-2.5">Product Name</th>
                                        <th className="px-4 py-2.5 text-center">Qty Received</th>
                                        <th className="px-4 py-2.5 text-center">Qty Accepted</th>
                                        <th className="px-4 py-2.5 text-center">Qty Rejected</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                      {grn.items && grn.items.length > 0 ? (
                                        grn.items.map((it: any, i: number) => (
                                          <tr key={i} className="hover:bg-slate-50">
                                            <td className="px-4 py-2 text-xs font-mono font-bold text-slate-400">{i + 1}</td>
                                            <td className="px-4 py-2 font-semibold text-slate-800">{it.product_name || "Material Item"}</td>
                                            <td className="px-4 py-2 text-center font-bold text-indigo-900">{it.quantity_received} Units</td>
                                            <td className="px-4 py-2 text-center font-bold text-emerald-600">{it.quantity_accepted || it.quantity_received} Units</td>
                                            <td className="px-4 py-2 text-center font-bold text-rose-600">{it.quantity_rejected || 0} Units</td>
                                          </tr>
                                        ))
                                      ) : (
                                        <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Inward stock delivery logged under GRN {grn.grn_number}.</td></tr>
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
