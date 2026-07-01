import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { ShieldCheck, CheckCircle2, XCircle } from "lucide-react";

export function PurchaseApprovals() {
  const data = [
    { id: 1, type: "Purchase Order", ref: "PO-2026-8812", by: "Rajesh Kumar", amount: "₹85,50,000", date: "2 Hours ago", status: "Pending My Approval" },
    { id: 2, type: "Purchase Request", ref: "PR-2026-901", by: "IT Dept", amount: "Est. ₹12,50,000", date: "4 Hours ago", status: "Pending My Approval" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">My Approvals</h2>
          <p className="text-sm text-muted-foreground">Multi-level procurement approval workflows.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {data.map((req) => (
          <Card key={req.id} className="p-6 border-t-4 border-t-amber-500">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-amber-500/10 text-amber-600 grid place-items-center">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{req.type}</h3>
                  <div className="text-xs font-mono text-primary font-semibold mt-0.5">{req.ref}</div>
                </div>
              </div>
            </div>
            
            <div className="bg-muted/40 p-4 rounded-xl border border-dashed mb-6 flex justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Requested By</div>
                <div className="font-semibold text-sm">{req.by}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Total Amount</div>
                <div className="font-bold text-sm">{req.amount}</div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"><CheckCircle2 className="size-4 mr-2" /> Approve</Button>
              <Button className="flex-1 bg-rose-500 hover:bg-rose-600 text-white"><XCircle className="size-4 mr-2" /> Reject</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
