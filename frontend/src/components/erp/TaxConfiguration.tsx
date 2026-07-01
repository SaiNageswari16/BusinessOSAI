import { useState } from "react";
import { erpTaxes } from "../../data/erp-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Calculator, Filter, Plus, Edit2, MoreHorizontal } from "lucide-react";

export function TaxConfiguration() {
  const [search, setSearch] = useState("");
  const filtered = erpTaxes.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tax Configuration</h2>
          <p className="text-sm text-muted-foreground">Manage global tax rates, types, and templates.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Add Tax Rule</Button>
      </div>

      <div className="flex gap-4 items-center mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30" 
            placeholder="Search taxes..." 
          />
        </div>
        <Button variant="outline"><Filter className="size-4 mr-2" /> Filters</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((tax) => (
          <Card key={tax.id} className="p-5 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary/40 group-hover:bg-primary transition-colors" />
            <div className="flex justify-between items-start mb-4 pl-2">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <Calculator className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold">{tax.name}</h3>
                  <p className="text-xs text-muted-foreground">Type: {tax.type}</p>
                </div>
              </div>
              <div className="flex">
                <Button variant="ghost" size="icon" className="h-8 w-8"><Edit2 className="size-4 text-muted-foreground" /></Button>
              </div>
            </div>
            
            <div className="pl-2 space-y-3">
              <div className="flex justify-between items-center bg-muted/30 p-2 rounded text-sm">
                <span className="text-muted-foreground">Total Rate</span>
                <span className="font-bold text-lg text-primary">{tax.rate}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Components</span>
                <span className="font-medium text-foreground">{tax.components}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Status</span>
                <span className={`font-bold ${tax.status === 'Active' ? 'text-emerald-600' : 'text-rose-600'}`}>{tax.status}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
