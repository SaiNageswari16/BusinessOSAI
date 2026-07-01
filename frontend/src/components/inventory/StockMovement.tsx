import { useState } from "react";
import { inventoryMovements } from "../../data/inventory-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Filter, ArrowRightLeft, ArrowUpRight, ArrowDownRight, RotateCw, History } from "lucide-react";

export function StockMovement() {
  const [search, setSearch] = useState("");
  const filtered = inventoryMovements.filter(m => m.product.toLowerCase().includes(search.toLowerCase()) || m.ref.toLowerCase().includes(search.toLowerCase()));

  const getIcon = (type: string) => {
    switch (type) {
      case 'Inbound': return <ArrowDownRight className="size-4 text-emerald-500" />;
      case 'Outbound': return <ArrowUpRight className="size-4 text-rose-500" />;
      case 'Transfer': return <ArrowRightLeft className="size-4 text-blue-500" />;
      default: return <RotateCw className="size-4 text-amber-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Stock Movement</h2>
          <p className="text-sm text-muted-foreground">Comprehensive timeline of all inventory transactions.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><History className="size-4 mr-2" /> Export Ledger</Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30" 
            placeholder="Search products or reference..." 
          />
        </div>
        <Button variant="outline"><Filter className="size-4 mr-2" /> Filters</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Date & Time</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4 w-1/3">Product</th>
              <th className="px-6 py-4">Quantity</th>
              <th className="px-6 py-4">Reference</th>
              <th className="px-6 py-4">User</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((mov) => (
              <tr key={mov.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-mono text-xs">{mov.date}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 bg-muted/50 w-fit px-2 py-1 rounded">
                    {getIcon(mov.type)} <span className="font-semibold text-xs">{mov.type}</span>
                  </div>
                </td>
                <td className="px-6 py-4 font-bold">{mov.product}</td>
                <td className="px-6 py-4">
                  <span className={`font-mono font-bold text-base ${mov.qty.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {mov.qty}
                  </span>
                </td>
                <td className="px-6 py-4 text-muted-foreground font-mono text-xs hover:text-primary hover:underline cursor-pointer">{mov.ref}</td>
                <td className="px-6 py-4 text-xs font-medium">{mov.user}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
