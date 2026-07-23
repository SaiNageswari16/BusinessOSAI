import React, { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, ArrowRight, Truck, MapPin, Loader2, Trash2 } from "lucide-react";
import { inventoryApi, StockMovement as StockMovementType } from "../../lib/api-client";

export function StockTransfer() {
  const [transfers, setTransfers] = useState<StockMovementType[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      const res = await inventoryApi.getStockMovements();
      setTransfers(res);
    } catch (error) {
      console.error("Failed to fetch Stock Transfers:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, []);

  const handleCreate = async () => {
    const movement_number = window.prompt("Enter Transfer Number (e.g. TR-2026-001):");
    if (!movement_number) return;
    const source_location = window.prompt("Enter Source Warehouse:");
    const destination_location = window.prompt("Enter Destination Warehouse:");
    const quantity_str = window.prompt("Enter Quantity to Transfer:");
    const quantity = parseInt(quantity_str || "0");
    
    try {
      await inventoryApi.createStockMovement({
        movement_number,
        product_id: "51e5b405-71fc-4890-93f3-6d1e5236d7de", // placeholder
        source_location,
        destination_location,
        quantity,
        notes: "Stock Transfer"
      });
      fetchTransfers();
    } catch (error) {
      console.error("Failed to create Stock Transfer:", error);
      alert("Failed to create. Ensure valid input and permissions.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this transfer?")) return;
    try {
      await inventoryApi.deleteStockMovement(id);
      fetchTransfers();
    } catch (error) {
      console.error("Failed to delete Stock Transfer:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Stock Transfer</h2>
          <p className="text-sm text-muted-foreground">Move inventory between warehouses and store branches.</p>
        </div>
        <Button onClick={handleCreate} className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> New Transfer</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative min-h-[300px]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-xl">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}
        {transfers.length === 0 && !loading && (
          <div className="col-span-full text-center text-muted-foreground py-12">
            No Stock Transfers found. Create one to get started.
          </div>
        )}
        {transfers.map((tr) => (
          <Card key={tr.id} className="p-6 relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="font-bold text-lg text-primary">{tr.movement_number}</div>
                <div className="text-xs text-muted-foreground">{tr.quantity} items</div>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                tr.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-blue-500/10 text-blue-600'
              }`}>
                {tr.status === 'In Transit' && <Truck className="size-3" />}
                {tr.status}
              </span>
            </div>

            <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-xl border border-dashed">
              <div className="flex-1">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Source</div>
                <div className="text-sm font-semibold flex items-center gap-1.5"><MapPin className="size-3 text-rose-500" /> {tr.source_location}</div>
              </div>
              <div className="bg-background rounded-full p-2 border shadow-sm">
                <ArrowRight className="size-4 text-muted-foreground" />
              </div>
              <div className="flex-1 text-right">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Destination</div>
                <div className="text-sm font-semibold flex items-center justify-end gap-1.5"><MapPin className="size-3 text-emerald-500" /> {tr.destination_location}</div>
              </div>
            </div>
            
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="icon" onClick={() => handleDelete(tr.id)} className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10">
                <Trash2 className="size-4" />
              </Button>
              <Button variant="outline" size="sm">Print DC</Button>
              <Button variant="default" size="sm">Receive Stock</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
