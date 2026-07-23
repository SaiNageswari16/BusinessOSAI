import React, { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Plus, Sliders, CheckCircle2, XCircle, Loader2, Trash2 } from "lucide-react";
import { inventoryApi, StockAdjustment as StockAdjustmentType } from "../../lib/api-client";

export function StockAdjustment() {
  const [adjustments, setAdjustments] = useState<StockAdjustmentType[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAdjustments = async () => {
    try {
      setLoading(true);
      const res = await inventoryApi.getStockAdjustments();
      setAdjustments(res);
    } catch (error) {
      console.error("Failed to fetch Stock Adjustments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdjustments();
  }, []);

  const handleCreate = async () => {
    const adjustment_number = window.prompt("Enter Adjustment Number (e.g. ADJ-001):");
    if (!adjustment_number) return;
    const adjustment_type = window.prompt("Enter Adjustment Type (e.g. Damage, Found, Expiry):");
    const quantity_str = window.prompt("Enter Quantity Changed (e.g. -5, 10):");
    const quantity_changed = parseInt(quantity_str || "0");
    
    try {
      await inventoryApi.createStockAdjustment({
        adjustment_number,
        product_id: "51e5b405-71fc-4890-93f3-6d1e5236d7de", // placeholder
        adjustment_type,
        quantity_changed,
        reason: "Test adjustment"
      });
      fetchAdjustments();
    } catch (error) {
      console.error("Failed to create Stock Adjustment:", error);
      alert("Failed to create. Ensure valid input and permissions.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this adjustment?")) return;
    try {
      await inventoryApi.deleteStockAdjustment(id);
      fetchAdjustments();
    } catch (error) {
      console.error("Failed to delete Stock Adjustment:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Stock Adjustment</h2>
          <p className="text-sm text-muted-foreground">Adjust inventory levels due to damage, loss, or auditing.</p>
        </div>
        <Button onClick={handleCreate} className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> New Adjustment</Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden relative min-h-[300px]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Date & Ref</th>
              <th className="px-6 py-4">Reason</th>
              <th className="px-6 py-4">Product</th>
              <th className="px-6 py-4">Qty Diff</th>
              <th className="px-6 py-4">Value Impact</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {adjustments.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                  No Stock Adjustments found. Create one to get started.
                </td>
              </tr>
            )}
            {adjustments.map((adj) => (
              <tr key={adj.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-mono text-xs">-</div>
                  <div className="font-bold text-xs text-primary">{adj.adjustment_number}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="bg-muted px-2 py-1 rounded text-xs font-semibold">{adj.adjustment_type}</span>
                </td>
                <td className="px-6 py-4 font-bold">-</td>
                <td className="px-6 py-4 font-mono font-bold">{adj.quantity_changed}</td>
                <td className="px-6 py-4 font-mono font-medium">-</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    adj.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                  }`}>
                    {adj.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(adj.id)} className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10">
                    <Trash2 className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
