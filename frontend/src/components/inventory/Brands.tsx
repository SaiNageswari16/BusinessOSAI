import { useState } from "react";
import { inventoryBrands } from "../../data/inventory-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Filter, Plus, Tags, Edit2, Globe } from "lucide-react";

export function Brands() {
  const [search, setSearch] = useState("");
  const filtered = inventoryBrands.filter(b => b.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Brands</h2>
          <p className="text-sm text-muted-foreground">Manage product brands and manufacturers.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Add Brand</Button>
      </div>

      <div className="flex gap-4 items-center mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30" 
            placeholder="Search brands..." 
          />
        </div>
        <Button variant="outline"><Filter className="size-4 mr-2" /> Filters</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filtered.map((brand) => (
          <Card key={brand.id} className="p-6 hover:shadow-md transition-shadow group overflow-hidden relative">
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-bl-full -z-10 transition-transform group-hover:scale-150" />
            <div className="flex justify-between items-start mb-4">
              <div className="size-12 rounded-xl bg-background border shadow-sm grid place-items-center">
                <Tags className="size-6 text-primary" />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><Edit2 className="size-4" /></Button>
            </div>
            <h3 className="font-bold text-lg">{brand.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">Category: {brand.category}</p>
            
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <Globe className="size-3.5" /> {brand.country}
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                brand.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
              }`}>
                {brand.status}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
