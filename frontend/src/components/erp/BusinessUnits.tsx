import { useState } from "react";
import { erpBusinessUnits, erpCompanies } from "@/data/erp-mock";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Plus, Network, MoreHorizontal } from "lucide-react";

export function BusinessUnits() {
  const [search, setSearch] = useState("");

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Business Units</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage strategic business units across your organization.</p>
        </div>
        <Button size="sm" className="h-9 gap-2 gradient-brand text-white border-0"><Plus className="size-4" /> Add Unit</Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input 
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-4 text-sm rounded-lg border bg-card focus:ring-2 focus:ring-primary/20" 
          placeholder="Search business units..." 
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {erpBusinessUnits.filter(u => u.name.toLowerCase().includes(search.toLowerCase())).map(unit => {
          const company = erpCompanies.find(c => c.id === unit.companyId);
          return (
            <Card key={unit.id} className="p-5 hover:shadow-elegant transition-shadow group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal className="size-4" /></Button>
              </div>
              <div className="size-10 rounded-lg bg-blue-500/10 text-blue-600 grid place-items-center mb-4">
                <Network className="size-5" />
              </div>
              <h3 className="font-bold text-base tracking-tight">{unit.name}</h3>
              <p className="text-xs text-muted-foreground mt-1 mb-4">{company?.name}</p>
              
              <div className="pt-4 border-t flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Head: <span className="font-medium text-foreground">{unit.head}</span></span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${unit.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                  {unit.status}
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
