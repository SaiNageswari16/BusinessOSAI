import { useState } from "react";
import { erpApiKeys } from "../../data/erp-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Network, Filter, Plus, Copy, RefreshCw, Key } from "lucide-react";

export function ApiKeys() {
  const [search, setSearch] = useState("");
  const filtered = erpApiKeys.filter(k => k.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">API Keys & Integrations</h2>
          <p className="text-sm text-muted-foreground">Manage webhooks, keys, and 3rd party integration tokens.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Generate API Key</Button>
      </div>

      <div className="flex gap-4 items-center mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30" 
            placeholder="Search API keys..." 
          />
        </div>
        <Button variant="outline"><Filter className="size-4 mr-2" /> Filters</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map((api) => (
          <Card key={api.id} className="p-6">
            <div className="flex justify-between items-start mb-6 border-b pb-4">
              <div className="flex gap-3 items-center">
                <div className="size-10 rounded-xl gradient-brand text-white grid place-items-center">
                  <Network className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{api.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${api.env === 'Production' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                      {api.env}
                    </span>
                    <span className="text-xs text-muted-foreground">{api.service}</span>
                  </div>
                </div>
              </div>
              <span className={`size-2 rounded-full ${api.status === 'Active' ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Secret Key</div>
                <div className="flex bg-muted/50 border rounded-lg overflow-hidden items-center">
                  <code className="px-3 py-2 text-sm font-mono flex-1 text-muted-foreground blur-[2px] select-none">
                    sk_live_xxxxxxxxxxxxxxxxxxxx
                  </code>
                  <Button variant="ghost" className="h-full rounded-none border-l"><Copy className="size-4" /></Button>
                </div>
              </div>

              <div className="flex justify-between text-xs items-end">
                <div className="space-y-1">
                  <div className="text-muted-foreground">Last Used</div>
                  <div className="font-medium">{api.lastUsed}</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-8"><RefreshCw className="size-3 mr-1" /> Roll Key</Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
