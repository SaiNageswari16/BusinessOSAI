import { useState, useEffect } from "react";
import React from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, Network, Loader2, Eye } from "lucide-react";
import { inventoryApi } from "../../lib/api-client";
import { toast } from "sonner";
import { PurchaseQuotationForm } from "./PurchaseQuotationForm";
import { useCurrency } from "@/hooks/use-currency";

export function PurchaseQuotations() {
    const { currency, formatCurrency } = useCurrency();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.getPurchaseQuotations();
      setQuotations(res || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load quotations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (isCreateMode || selectedDoc) {
    return (
      <PurchaseQuotationForm
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
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Network className="text-primary size-6" /> Proforma & Request for Quotation (RFQ)
          </h2>
          <p className="text-sm text-muted-foreground">Generate vendor proformas, compare multi-vendor bids, and award purchase contracts.</p>
        </div>
        <Button onClick={() => setIsCreateMode(true)} className="bg-purple-700 hover:bg-purple-800 text-white border-0 font-semibold rounded-xl shadow-sm h-10 px-5">
          <Plus className="size-4 mr-2" /> Generate Proforma / RFQ
        </Button>
      </div>

      <Card className="bg-card border rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-border text-slate-600 dark:text-slate-300 text-[11px] uppercase font-bold tracking-wider">
              <tr>
                <th className="py-3.5 px-5">RFQ / Quotation #</th>
                <th className="py-3.5 px-5">Date</th>
                <th className="py-3.5 px-5">Supplier Partner</th>
                <th className="py-3.5 px-5">Quotation Items</th>
                <th className="py-3.5 px-5 text-right font-bold">Quotation Value</th>
                <th className="py-3.5 px-5 text-center">Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading Proforma & RFQs...
                  </td>
                </tr>
              ) : quotations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted-foreground font-semibold">
                    No Proforma or RFQ quotations logged yet. Click "+ Generate Proforma / RFQ" above to onboard vendor quotes.
                  </td>
                </tr>
              ) : (
                quotations.map((rfq) => {
                  const itemCount = rfq.items?.length || 1;
                  const firstItemName = rfq.items && rfq.items[0] ? (rfq.items[0].product_name || rfq.items[0].name) : "Quotation RFQ";
                  const dateStr = rfq.quotation_date ? new Date(rfq.quotation_date).toLocaleDateString() : (rfq.created_at ? new Date(rfq.created_at).toLocaleDateString() : "—");

                  return (
                    <tr key={rfq.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-5 font-mono font-bold text-primary">
                        <div className="flex items-center gap-2">
                          <div className="size-7 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                            <Network className="size-3.5" />
                          </div>
                          <span>{rfq.quotation_number || `RFQ-${String(rfq.id).slice(0, 6)}`}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-muted-foreground font-medium">
                        {dateStr}
                      </td>
                      <td className="py-3.5 px-5 font-bold text-foreground">
                        {rfq.supplier_name || rfq.supplier?.name || "Global Vendor"}
                      </td>
                      <td className="py-3.5 px-5 text-muted-foreground">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground truncate max-w-[220px]">{firstItemName}</span>
                          {itemCount > 1 && (
                            <span className="text-[10px] text-muted-foreground font-mono">+{itemCount - 1} more item{itemCount - 1 !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-right font-black text-emerald-600 text-xs">
                        {formatCurrency(rfq.total_amount || 0)}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          rfq.status === "Accepted"
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            : "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                        }`}>
                          {rfq.status || "Received"}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setSelectedDoc(rfq)}
                          className="h-8 px-3 font-bold rounded-xl hover:bg-primary/10 text-primary border-primary/30 text-xs transition-colors"
                          title="Edit this Proforma / RFQ"
                        >
                          <Eye className="size-3.5 mr-1" /> Edit / View
                        </Button>
                      </td>
                    </tr>
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
