import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { ArrowRightLeft, ShieldAlert } from "lucide-react";

export function PurchaseReturns() {
  const data = [
    { id: 1, retNo: "RET-2026-001", grn: "GRN-2026-112", reason: "Damaged in transit", qty: 2, status: "Pending Debit Note" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Purchase Returns (PRT)</h2>
          <p className="text-sm text-muted-foreground">Manage returns to supplier for replacement or refund.</p>
        </div>
        <Button className="gradient-brand text-white border-0">New Return</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {data.map((ret) => (
          <Card key={ret.id} className="p-6 border-t-4 border-t-rose-500">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-rose-500/10 text-rose-600 grid place-items-center">
                  <ArrowRightLeft className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{ret.retNo}</h3>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5 flex items-center gap-1">Link: {ret.grn}</div>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600`}>
                {ret.status}
              </span>
            </div>

            <div className="bg-muted/40 p-4 rounded-xl border border-dashed flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Return Reason</div>
                <div className="font-bold text-sm flex items-center gap-1.5"><ShieldAlert className="size-3 text-rose-500" /> {ret.reason}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Return Qty</div>
                <div className="font-bold text-lg text-rose-500">{ret.qty}</div>
              </div>
            </div>
            
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="default" size="sm">Generate Debit Note</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
