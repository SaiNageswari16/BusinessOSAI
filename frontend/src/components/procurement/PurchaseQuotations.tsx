import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, Network, CheckCircle2, ShieldAlert } from "lucide-react";

export function PurchaseQuotations() {
  const data = [
    { id: 1, rfqNo: "RFQ-2026-441", item: "Sony WH-1000XM5 (50 Units)", status: "Comparing", quotes: 3, bestPrice: "₹12,45,000", bestSupplier: "Sony Electronics" },
    { id: 2, rfqNo: "RFQ-2026-440", item: "Office Chairs (15 Units)", status: "Awarded", quotes: 5, bestPrice: "₹45,000", bestSupplier: "IKEA Business" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Purchase Quotations (RFQ)</h2>
          <p className="text-sm text-muted-foreground">Generate RFQs, compare quotes, and award contracts.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Generate RFQ</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {data.map((rfq) => (
          <Card key={rfq.id} className="p-6 relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <Network className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{rfq.item}</h3>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">{rfq.rfqNo}</div>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                rfq.status === 'Awarded' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-blue-500/10 text-blue-600'
              }`}>
                {rfq.status}
              </span>
            </div>

            <div className="bg-muted/40 p-4 rounded-xl border border-dashed flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Quotes Received</div>
                <div className="font-bold text-lg">{rfq.quotes}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-emerald-600 mb-1 flex justify-end items-center gap-1"><CheckCircle2 className="size-3" /> Best Price</div>
                <div className="font-bold text-lg text-emerald-600">{rfq.bestPrice}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{rfq.bestSupplier}</div>
              </div>
            </div>
            
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm">Compare Quotes</Button>
              {rfq.status !== 'Awarded' && <Button variant="default" size="sm">Award PO</Button>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
