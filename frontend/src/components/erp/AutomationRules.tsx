import { useState } from "react";
import { erpAutomationRules } from "../../data/erp-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Filter, Plus, Zap, ArrowRight } from "lucide-react";

export function AutomationRules() {
  const [search, setSearch] = useState("");
  const filtered = erpAutomationRules.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Automation Rules</h2>
          <p className="text-sm text-muted-foreground">No-code visual IF/THEN workflow builder.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Create Rule</Button>
      </div>

      <div className="flex gap-4 items-center mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30" 
            placeholder="Search rules..." 
          />
        </div>
        <Button variant="outline"><Filter className="size-4 mr-2" /> Filters</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map((rule) => (
          <Card key={rule.id} className="p-6">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-amber-500/10 text-amber-500 grid place-items-center">
                  <Zap className="size-5" />
                </div>
                <h3 className="font-bold text-lg">{rule.name}</h3>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${rule.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                {rule.status}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex flex-col bg-muted/40 rounded-lg p-4 border border-dashed">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-1">
                  <span className="text-xs bg-primary text-white px-1.5 py-0.5 rounded">IF</span> TRIGGER
                </div>
                <div className="text-sm pl-8 font-medium">{rule.trigger}</div>
              </div>
              
              <div className="flex justify-center -my-3 relative z-10">
                <div className="bg-background border rounded-full p-1"><ArrowRight className="size-4 text-muted-foreground rotate-90" /></div>
              </div>

              <div className="flex flex-col bg-primary/5 rounded-lg p-4 border border-primary/20">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary mb-1">
                  <span className="text-xs bg-primary text-white px-1.5 py-0.5 rounded">THEN</span> ACTION
                </div>
                <div className="text-sm pl-8 font-medium">{rule.action}</div>
              </div>
            </div>
            
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" size="sm" className="text-muted-foreground">Edit Logic</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
