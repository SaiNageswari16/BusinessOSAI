import React, { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Filter, Plus, FileDown, MoreHorizontal, Loader2, Trash2 } from "lucide-react";
import { inventoryApi, GoodsReceipt as GRNType } from "../../lib/api-client";

export function GoodsReceipt() {
  const [search, setSearch] = useState("");
  const [receipts, setReceipts] = useState<GRNType[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const res = await inventoryApi.getGoodsReceipts();
      setReceipts(res);
    } catch (error) {
      console.error("Failed to fetch GRNs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

  const handleCreate = async () => {
    const receipt_number = window.prompt("Enter Receipt Number (e.g. GRN-001):");
    if (!receipt_number) return;
    const supplier = window.prompt("Enter Supplier Name:");
    const reference_number = window.prompt("Enter PO Number:");
    
    try {
      await inventoryApi.createGoodsReceipt({
        receipt_number,
        supplier,
        reference_number,
      });
      fetchReceipts();
    } catch (error) {
      console.error("Failed to create GRN:", error);
      alert("Failed to create. Make sure you have the correct permissions.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this GRN?")) return;
    try {
      await inventoryApi.deleteGoodsReceipt(id);
      fetchReceipts();
    } catch (error) {
      console.error("Failed to delete GRN:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Goods Receipt (GRN)</h2>
          <p className="text-sm text-muted-foreground">Receive incoming stock from suppliers into warehouses.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><FileDown className="size-4 mr-2" /> Export</Button>
          <Button onClick={handleCreate} className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> New GRN</Button>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
            placeholder="Search by PO, Supplier, or Batch..."
          />
        </div>
        <Button variant="outline"><Filter className="size-4 mr-2" /> Filters</Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto min-h-[300px] relative">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          )}
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold sticky top-0">
              <tr>
                <th className="px-6 py-4">GRN #</th>
                <th className="px-6 py-4">Supplier & PO</th>
                <th className="px-6 py-4">Warehouse</th>
                <th className="px-6 py-4">Batch Details</th>
                <th className="px-6 py-4">Quantity</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {receipts.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    No Goods Receipts found. Create one to get started.
                  </td>
                </tr>
              )}
              {receipts.map((grn) => (
                <tr key={grn.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 font-bold">{grn.receipt_number}</td>
                  <td className="px-6 py-4">
                    <div className="font-medium">{grn.supplier || '-'}</div>
                    <div className="text-xs text-muted-foreground font-mono">{grn.reference_number || '-'}</div>
                  </td>
                  <td className="px-6 py-4">-</td>
                  <td className="px-6 py-4">
                    <div className="font-mono text-xs">-</div>
                    <div className="text-[10px] text-muted-foreground">Mfg: - | Exp: -</div>
                  </td>
                  <td className="px-6 py-4 font-bold">{grn.items?.length || 0} items</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      grn.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                    }`}>
                      {grn.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(grn.id)} className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10">
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
