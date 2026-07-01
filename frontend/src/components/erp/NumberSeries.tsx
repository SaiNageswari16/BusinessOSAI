import { useState } from "react";
import { erpNumberSeries } from "../../data/erp-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Calculator, Filter, Plus, Hash } from "lucide-react";

export function NumberSeries() {
  const [search, setSearch] = useState("");
  const filtered = erpNumberSeries.filter(t => t.module.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Number Series</h2>
          <p className="text-sm text-muted-foreground">Manage auto-generated document numbering sequences.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Create Series</Button>
      </div>

      <div className="flex gap-4 items-center mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30" 
            placeholder="Search module..." 
          />
        </div>
        <Button variant="outline"><Filter className="size-4 mr-2" /> Filters</Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Module</th>
              <th className="px-6 py-4">Prefix</th>
              <th className="px-6 py-4">Current Value</th>
              <th className="px-6 py-4">Next Preview</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((series) => (
              <tr key={series.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-bold flex items-center gap-2">
                  <Hash className="size-4 text-primary" /> 
                  {series.module}
                </td>
                <td className="px-6 py-4 font-mono font-medium text-muted-foreground">{series.prefix}</td>
                <td className="px-6 py-4 font-mono">{series.current}</td>
                <td className="px-6 py-4">
                  <div className="bg-primary/5 text-primary border border-primary/20 px-2 py-1 inline-flex rounded font-mono text-xs">
                    {series.preview}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    {series.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
