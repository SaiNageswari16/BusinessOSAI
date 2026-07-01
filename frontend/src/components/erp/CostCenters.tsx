import { useState } from "react";
import { erpCostCenters } from "@/data/erp-mock";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Plus, CreditCard, MoreHorizontal, TrendingDown } from "lucide-react";

export function CostCenters() {
  const [search, setSearch] = useState("");

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Cost Centers</h2>
          <p className="text-muted-foreground text-sm mt-1">Track department budgets, expenses, and financial allocations.</p>
        </div>
        <Button size="sm" className="h-9 gap-2 gradient-brand text-white border-0"><Plus className="size-4" /> Add Cost Center</Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input 
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-4 text-sm rounded-lg border bg-card focus:ring-2 focus:ring-primary/20" 
          placeholder="Search cost centers..." 
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {erpCostCenters.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.department.toLowerCase().includes(search.toLowerCase())).map(cc => {
          const percentUsed = Math.round((cc.expense / cc.budget) * 100);
          return (
            <Card key={cc.id} className="p-5 hover:shadow-elegant transition-shadow group relative overflow-hidden flex flex-col">
              <div className="absolute top-0 right-0 p-4">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal className="size-4" /></Button>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-lg bg-emerald-500/10 text-emerald-600 grid place-items-center">
                  <CreditCard className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base tracking-tight">{cc.name}</h3>
                  <p className="text-[11px] text-muted-foreground truncate max-w-[150px]">{cc.department}</p>
                </div>
              </div>
              
              <div className="space-y-4 mb-4 flex-1">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Budget Used</span>
                    <span className="font-semibold">{percentUsed}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${percentUsed > 85 ? 'bg-rose-500' : percentUsed > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${percentUsed}%` }} />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-0.5">Budget</div>
                    <div className="font-semibold">${cc.budget.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-0.5">Current Expense</div>
                    <div className="font-semibold">${cc.expense.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t flex justify-between items-center text-xs">
                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                  <TrendingDown className="size-3" /> Within limits
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${cc.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                  {cc.status}
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
