import { useState } from "react";
import { erpLocations } from "../../data/erp-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Map, Filter, Plus, Store, Clock, Maximize2 } from "lucide-react";

export function Locations() {
  const [search, setSearch] = useState("");
  const filtered = erpLocations.filter(l => l.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Physical Locations</h2>
          <p className="text-sm text-muted-foreground">Manage offices, warehouses, stores, and distribution centers.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Add Location</Button>
      </div>

      <div className="flex gap-4 items-center mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30" 
            placeholder="Search locations..." 
          />
        </div>
        <Button variant="outline"><Filter className="size-4 mr-2" /> Filters</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((loc) => (
          <Card key={loc.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <div className="h-24 bg-muted flex items-center justify-center relative">
              <Map className="size-8 text-muted-foreground/30" />
              <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
              <div className="absolute bottom-2 left-4">
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold uppercase backdrop-blur-md">
                  {loc.type}
                </span>
              </div>
            </div>
            
            <div className="p-5 space-y-4">
              <div>
                <h3 className="font-bold text-lg mb-1">{loc.name}</h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Map className="size-3" /> {loc.map}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1"><Clock className="size-3" /> Working Hours</div>
                  <div className="font-semibold text-sm">{loc.hours}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1"><Maximize2 className="size-3" /> Capacity</div>
                  <div className="font-semibold text-sm">{loc.capacity}</div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
