import { useState } from "react";
import { erpBranches, erpCompanies } from "@/data/erp-mock";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Filter, Plus, MapPin, Users, Building2, ExternalLink } from "lucide-react";

export function BranchManagement() {
  const [search, setSearch] = useState("");

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Branch Management</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage physical locations, warehouses, and branch-level settings.</p>
        </div>
        <Button size="sm" className="h-9 gap-2 gradient-brand text-white border-0"><Plus className="size-4" /> Add Branch</Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 text-sm rounded-lg border bg-card focus:ring-2 focus:ring-primary/20" 
            placeholder="Search branches..." 
          />
        </div>
        <Button variant="outline" className="h-10 gap-2"><Filter className="size-4" /> Filters</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {erpBranches.filter(b => b.name.toLowerCase().includes(search.toLowerCase())).map(branch => {
          const company = erpCompanies.find(c => c.id === branch.companyId);
          return (
            <Card key={branch.id} className="overflow-hidden hover:shadow-elegant transition-shadow flex flex-col">
              <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-3">
                  <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center font-bold text-sm shadow-sm">
                    <Building2 className="size-5" />
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${branch.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                    <span className={`size-1.5 rounded-full ${branch.status === 'Active' ? 'bg-emerald-500' : 'bg-muted-foreground'}`}></span>
                    {branch.status}
                  </span>
                </div>
                
                <h3 className="font-bold text-base tracking-tight mb-1">{branch.name}</h3>
                <p className="text-[11px] font-mono text-muted-foreground mb-4">Code: {branch.code} • {company?.name}</p>

                <div className="space-y-2 mb-4">
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0 mt-0.5" /> <span className="line-clamp-2">{branch.address}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="size-3.5 shrink-0" /> <span>{branch.employees} Employees • Head: {branch.manager}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/50 mt-auto">
                  <div>
                    <div className="text-[9px] uppercase font-semibold text-muted-foreground mb-0.5">Monthly Revenue</div>
                    <div className="text-xs font-semibold text-foreground">{branch.revenue}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase font-semibold text-muted-foreground mb-0.5">Warehouse</div>
                    <div className="text-xs font-semibold text-foreground">{branch.warehouse}</div>
                  </div>
                </div>
              </div>
              <div className="bg-muted/30 px-5 py-2.5 border-t flex justify-between items-center">
                <span className="text-[10px] text-muted-foreground">Opened {branch.openingDate}</span>
                <Button variant="link" size="sm" className="h-auto p-0 text-[10px] font-semibold text-primary gap-1">Manage <ExternalLink className="size-3" /></Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
