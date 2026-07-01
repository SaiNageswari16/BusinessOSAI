import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { AlertTriangle, Clock, CreditCard, ExternalLink } from "lucide-react";

export function PendingPayments() {
  const data = [
    { id: 1, supplier: "Apple India Pvt Ltd", billNo: "INV-APPL-992", amount: "₹85,50,000", dueDate: "2026-08-01", priority: "High" },
    { id: 2, supplier: "Nike India", billNo: "INV-NK-0012", amount: "₹1,20,000", dueDate: "2026-07-02", priority: "Overdue" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Pending Payments</h2>
          <p className="text-sm text-muted-foreground">Manage accounts payable, dues, and vendor aging.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {data.map((pay) => (
          <Card key={pay.id} className={`p-6 border-t-4 ${pay.priority === 'Overdue' ? 'border-t-rose-500' : 'border-t-amber-500'}`}>
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <Clock className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{pay.supplier}</h3>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">{pay.billNo}</div>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                pay.priority === 'Overdue' ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600'
              }`}>
                {pay.priority === 'Overdue' && <AlertTriangle className="size-3" />}
                {pay.priority}
              </span>
            </div>

            <div className="bg-muted/40 p-4 rounded-xl border border-dashed flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1 flex items-center gap-1"><CreditCard className="size-3" /> Amount Due</div>
                <div className={`font-bold text-2xl ${pay.priority === 'Overdue' ? 'text-rose-500' : 'text-foreground'}`}>{pay.amount}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1 flex justify-end items-center gap-1">Due Date</div>
                <div className="font-mono text-sm font-bold">{pay.dueDate}</div>
              </div>
            </div>
            
            <div className="mt-4 flex gap-2">
              <Button variant="default" className="flex-1 gradient-brand border-0">Process Payment</Button>
              <Button variant="outline" size="icon"><ExternalLink className="size-4" /></Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
