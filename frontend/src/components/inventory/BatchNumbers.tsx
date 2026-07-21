import { useState } from "react";
import { inventoryBatches } from "../../data/inventory-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Filter, Hash, Edit2, CalendarClock } from "lucide-react";

export function BatchNumbers() {
  const [search, setSearch] = useState("");
  const filtered = inventoryBatches.filter(b => b.batchNo.toLowerCase().includes(search.toLowerCase()) || b.product.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Batch Numbers</h2>
          <p className="text-sm text-muted-foreground">Track inventory lots, manufacturing runs, and expiry cohorts.</p>
        </div>
        <Button className="gradient-brand text-white border-0">Scan Batch</Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30" 
            placeholder="Search batch or product..." 
          />
        </div>
        <Button variant="outline"><Filter className="size-4 mr-2" /> Filters</Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Product</th>
              <th className="px-6 py-4">Batch Number</th>
              <th className="px-6 py-4">Serial Number</th>
              <th className="px-6 py-4">Mfg Date</th>
              <th className="px-6 py-4">Expiry Date</th>
              <th className="px-6 py-4">Warehouse</th>
              <th className="px-6 py-4">Quantity</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((batch) => (
              <tr key={batch.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-bold">{batch.product}</td>
                <td className="px-6 py-4 font-mono font-bold text-primary flex items-center gap-2"><Hash className="size-4" /> {batch.batchNo}</td>
                <td className="px-6 py-4 font-mono text-xs text-muted-foreground">-</td>
                <td className="px-6 py-4 text-xs font-medium">{batch.mfgDate}</td>
                <td className="px-6 py-4 text-xs font-semibold flex items-center gap-1 mt-0.5"><CalendarClock className="size-3 text-rose-500" /> {batch.expDate}</td>
                <td className="px-6 py-4 text-xs font-medium">{batch.warehouse}</td>
                <td className="px-6 py-4 font-bold">{batch.qty}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    batch.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                  }`}>
                    {batch.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><Edit2 className="size-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
