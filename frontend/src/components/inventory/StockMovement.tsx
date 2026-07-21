import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Filter, ArrowRightLeft, ArrowUpRight, ArrowDownRight, RotateCw, History, Loader2, Plus, Trash2 } from "lucide-react";
import { inventoryApi, StockMovement as StockMovementType } from "../../lib/api-client";

export function StockMovement() {
  const [search, setSearch] = useState("");
  const [movements, setMovements] = useState<StockMovementType[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMovements = async () => {
    try {
      setLoading(true);
      const res = await inventoryApi.getStockMovements();
      setMovements(res);
    } catch (error) {
      console.error("Failed to fetch Stock Movements:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, []);

  const handleCreate = async () => {
    const movement_number = window.prompt("Enter Movement Number (e.g. MOV-001):");
    if (!movement_number) return;
    const source_location = window.prompt("Enter Source Location:");
    const destination_location = window.prompt("Enter Destination Location:");
    
    try {
      await inventoryApi.createStockMovement({
        movement_number,
        product_id: "51e5b405-71fc-4890-93f3-6d1e5236d7de", // placeholder
        source_location,
        destination_location,
        quantity: 10,
        notes: "Test movement"
      });
      fetchMovements();
    } catch (error) {
      console.error("Failed to create Stock Movement:", error);
      alert("Failed to create. Ensure valid input and permissions.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this movement?")) return;
    try {
      await inventoryApi.deleteStockMovement(id);
      fetchMovements();
    } catch (error) {
      console.error("Failed to delete Stock Movement:", error);
    }
  };

  const getIcon = (type: string) => {
    return <ArrowRightLeft className="size-4 text-blue-500" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Stock Movement</h2>
          <p className="text-sm text-muted-foreground">Comprehensive timeline of all inventory transactions.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><History className="size-4 mr-2" /> Export Ledger</Button>
          <Button onClick={handleCreate} className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> New Movement</Button>
        </div>
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

      <Card className="p-0 overflow-hidden relative min-h-[300px]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Date & Time</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4 w-1/3">Product</th>
              <th className="px-6 py-4">Quantity</th>
              <th className="px-6 py-4">From/To</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {movements.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                  No Stock Movements found. Create one to get started.
                </td>
              </tr>
            )}
            {movements.map((mov) => (
              <tr key={mov.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-mono text-xs">{mov.movement_number}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 bg-muted/50 w-fit px-2 py-1 rounded">
                    {getIcon('Transfer')} <span className="font-semibold text-xs">Transfer</span>
                  </div>
                </td>
                <td className="px-6 py-4 font-bold">-</td>
                <td className="px-6 py-4">
                  <span className="font-mono font-bold text-base text-emerald-500">
                    {mov.quantity}
                  </span>
                </td>
                <td className="px-6 py-4 text-muted-foreground font-mono text-xs hover:text-primary hover:underline cursor-pointer">{mov.source_location} &rarr; {mov.destination_location}</td>
                <td className="px-6 py-4 text-xs font-medium">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    mov.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                  }`}>
                    {mov.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(mov.id)} className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10">
                    <Trash2 className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}
