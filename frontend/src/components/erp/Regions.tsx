import { useState } from "react";
import { erpRegions } from "../../data/erp-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, MapPin, Users, TrendingUp, Filter, Plus, MoreHorizontal } from "lucide-react";

export function Regions() {
  const [search, setSearch] = useState("");

  const filtered = erpRegions.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Regions</h2>
          <p className="text-sm text-muted-foreground">Manage enterprise geographic regions.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Add Region</Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30" 
            placeholder="Search regions..." 
          />
        </div>
        <Button variant="outline"><Filter className="size-4 mr-2" /> Filters</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(region => (
          <Card key={region.id} className="p-6 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <MapPin className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold">{region.name}</h3>
                  <p className="text-xs text-muted-foreground">{region.code} • {region.country}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="size-4" /></Button>
            </div>
            
            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Manager</span>
                <span className="font-medium">{region.manager}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Branches</span>
                <span className="font-medium">{region.branches}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4 border-t">
              <div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1"><TrendingUp className="size-3" /> Revenue</div>
                <div className="font-semibold text-sm">{region.revenue}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Users className="size-3" /> Employees</div>
                <div className="font-semibold text-sm">{region.employees}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
