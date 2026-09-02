import { useState, useEffect } from "react";
import React from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, Boxes, Loader2, Eye, Printer, FileText, Receipt } from "lucide-react";
import { inventoryApi } from "../../lib/api-client";
import { toast } from "sonner";
import { GoodsReceivedNoteForm } from "./GoodsReceivedNoteForm";

export function GoodsReceivedNotes() {
  const [grns, setGrns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);

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

  if (isCreateMode || selectedDoc) {
    return (
      <GoodsReceivedNoteForm
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
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Goods Received Notes (GRN)
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
            <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
              <tr>
                <th className="py-4 px-6">GRN Document No</th>
                <th className="py-4 px-6">Linked PO Reference</th>
                <th className="py-4 px-6">Received Items</th>
                <th className="py-4 px-6">QC Inspection Status</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Action</th>
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
                grns.map((grn) => (
                  <tr key={grn.id} className="hover:bg-muted/30 transition-colors">
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
                    <td className="py-4 px-6 text-right space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          window.location.href = `/procurement?tab=vendor_bills&po_id=${grn.purchase_order_id}&grn_id=${grn.id}`;
                        }}
                        className="h-8 gap-1 font-bold rounded-lg text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100"
                        title="Create 3-Way Matched Vendor Bill from this GRN"
                      >
                        <Receipt className="size-3.5 mr-1" /> Log Bill
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSelectedDoc(grn)}
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
