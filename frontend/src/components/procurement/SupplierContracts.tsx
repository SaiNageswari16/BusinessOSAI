import { procurementContracts } from "../../data/procurement-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, Briefcase, CalendarClock, Download, Edit2 } from "lucide-react";

export function SupplierContracts() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Supplier Contracts</h2>
          <p className="text-sm text-muted-foreground">Manage SLA terms, pricing agreements, and renewals.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Draft Contract</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {procurementContracts.map((contract) => (
          <Card key={contract.id} className="p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10 transition-transform group-hover:scale-150" />
            
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <Briefcase className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{contract.supplier}</h3>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">{contract.contractNo}</div>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                contract.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
              }`}>
                {contract.status}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6 p-3 bg-muted/40 rounded-lg border border-dashed">
              <div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Start Date</div>
                <div className="font-mono text-sm">{contract.startDate}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1 flex items-center gap-1"><CalendarClock className="size-3 text-rose-500" /> End Date</div>
                <div className="font-mono text-sm">{contract.endDate}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Contract Value</div>
                <div className="font-bold text-primary">{contract.value}</div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <Button variant="outline" size="sm"><Download className="size-4 mr-2" /> PDF Copy</Button>
              <Button variant="ghost" size="icon" className="h-8 w-8"><Edit2 className="size-4" /></Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
