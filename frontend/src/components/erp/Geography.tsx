import { useState } from "react";
import { erpGeography } from "../../data/erp-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Globe, Filter, Plus, Edit2, MoreHorizontal } from "lucide-react";

export function Geography() {
  const [search, setSearch] = useState("");
  const filtered = erpGeography.filter(g => g.country.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Geography Master</h2>
          <p className="text-sm text-muted-foreground">Manage Countries, States, and Cities mapping.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Add Country</Button>
      </div>

      <div className="flex gap-4 items-center mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30" 
            placeholder="Search countries..." 
          />
        </div>
        <Button variant="outline"><Filter className="size-4 mr-2" /> Filters</Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Country Name</th>
              <th className="px-6 py-4">ISO Code</th>
              <th className="px-6 py-4">Currency</th>
              <th className="px-6 py-4">Phone Code</th>
              <th className="px-6 py-4">States/Provinces</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((geo) => (
              <tr key={geo.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-bold flex items-center gap-2">
                  <Globe className="size-4 text-primary" /> {geo.country}
                </td>
                <td className="px-6 py-4 font-mono">{geo.iso}</td>
                <td className="px-6 py-4">
                  <span className="bg-muted px-2 py-1 rounded text-xs font-mono">{geo.currency}</span>
                </td>
                <td className="px-6 py-4">{geo.phoneCode}</td>
                <td className="px-6 py-4 text-primary font-medium cursor-pointer hover:underline">{geo.states} Configured</td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    {geo.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8"><Edit2 className="size-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="size-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
