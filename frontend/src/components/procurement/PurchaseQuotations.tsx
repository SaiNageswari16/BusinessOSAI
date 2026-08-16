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
            <Network className="text-primary size-6" /> Request for Quotation (RFQ)
          </h2>
          <p className="text-sm text-muted-foreground">Generate RFQs, compare multi-vendor bids, and award purchase contracts.</p>
        </div>
        <Button onClick={() => setIsCreateMode(true)} className="gradient-brand text-white border-0 font-semibold rounded-lg shadow-sm">
          <Plus className="size-4 mr-2" /> Generate RFQ
        </Button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
          Loading RFQs & quotations...
        </div>
      ) : quotations.length === 0 ? (
        <div className="bg-card border p-8 rounded-xl text-center text-muted-foreground font-semibold shadow-sm">
          No RFQ quotations logged yet. Click "Generate RFQ" to onboard vendor quotes.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {quotations.map((rfq) => (
            <Card key={rfq.id} className="bg-card border p-6 relative overflow-hidden shadow-sm hover:shadow-md transition">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                    <Network className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">
                      {rfq.items && rfq.items[0] ? rfq.items[0].product_name : "Quotation RFQ"}
                    </h3>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">{rfq.quotation_number}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    rfq.status === "Accepted" ? "bg-emerald-500/10 text-emerald-600" : "bg-blue-500/10 text-blue-600"
                  }`}>
                    {rfq.status}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setSelectedDoc(rfq)}
                    className="h-7 px-2 font-bold rounded-lg hover:bg-primary/10"
                  >
                    <Eye className="size-3.5 mr-1" /> View / Edit Page
                  </Button>
                </div>
              </div>

              <div className="bg-muted/40 p-4 rounded-xl border border-dashed flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Supplier Partner</div>
                  <div className="font-bold">{rfq.supplier_name}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-primary mb-1">Quotation Value</div>
                  <div className="font-mono font-bold text-lg text-primary">
                    {currency.symbol}{rfq.total_amount?.toLocaleString("en-IN")}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
