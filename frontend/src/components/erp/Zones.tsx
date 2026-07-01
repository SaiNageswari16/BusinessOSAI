import { useState } from "react";
import { erpZones, erpRegions } from "../../data/erp-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, MapPin, Network, Filter, Plus } from "lucide-react";

export function Zones() {
  const [search, setSearch] = useState("");
  const filtered = erpZones.filter(z => z.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Zones</h2>
          <p className="text-sm text-muted-foreground">Manage operational zones within regions.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Add Zone</Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30" 
            placeholder="Search zones..." 
          />
        </div>
        <Button variant="outline"><Filter className="size-4 mr-2" /> Filters</Button>
      </div>

      <div className="space-y-4">
        {erpRegions.map(region => {
          const regionZones = filtered.filter(z => z.regionId === region.id);
          if (regionZones.length === 0) return null;
          
          return (
            <Card key={region.id} className="p-6">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b">
                <MapPin className="size-5 text-primary" />
                <h3 className="font-bold text-lg">{region.name}</h3>
                <span className="text-xs bg-muted px-2 py-1 rounded-md">{regionZones.length} Zones</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-8 border-l-2 border-muted ml-2">
                {regionZones.map(zone => (
                  <div key={zone.id} className="bg-muted/30 p-4 rounded-lg border relative">
                    <div className="absolute top-1/2 -left-[18px] w-4 h-0.5 bg-muted" />
                    <div className="flex items-center gap-2 mb-2">
                      <Network className="size-4 text-primary" />
                      <h4 className="font-bold text-sm">{zone.name}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">Manager: <span className="font-medium text-foreground">{zone.manager}</span></p>
                    <p className="text-xs text-muted-foreground">Branches: <span className="font-medium text-foreground">{zone.branches}</span></p>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
