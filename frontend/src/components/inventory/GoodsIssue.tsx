import React, { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Filter, Plus, FileDown, MoreHorizontal, Loader2, Trash2 } from "lucide-react";
import { inventoryApi, GoodsIssue as GoodsIssueType } from "../../lib/api-client";

export function GoodsIssue() {
  const [search, setSearch] = useState("");
  const [issues, setIssues] = useState<GoodsIssueType[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIssues = async () => {
    try {
      setLoading(true);
      const res = await inventoryApi.getGoodsIssues();
      setIssues(res);
    } catch (error) {
      console.error("Failed to fetch Goods Issues:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  const handleCreate = async () => {
    const issue_number = window.prompt("Enter Issue Number (e.g. GI-001):");
    if (!issue_number) return;
    const recipient = window.prompt("Enter Recipient Name:");
    const reference_number = window.prompt("Enter Reference Number (e.g. SO-1002):");
    
    try {
      await inventoryApi.createGoodsIssue({
        issue_number,
        recipient,
        reference_number,
      });
      fetchIssues();
    } catch (error) {
      console.error("Failed to create Goods Issue:", error);
      alert("Failed to create. Make sure you have the correct permissions.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this Goods Issue?")) return;
    try {
      await inventoryApi.deleteGoodsIssue(id);
      fetchIssues();
    } catch (error) {
      console.error("Failed to delete Goods Issue:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Goods Issue</h2>
          <p className="text-sm text-muted-foreground">Issue stock from the warehouse for sales, consumption, or transfers.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><FileDown className="size-4 mr-2" /> Export</Button>
          <Button onClick={handleCreate} className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> New Goods Issue</Button>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
            placeholder="Search by Product, Destination, or ID..."
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
                <th className="px-6 py-4">Issue #</th>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Warehouse</th>
                <th className="px-6 py-4">Destination & Reason</th>
                <th className="px-6 py-4">Quantity</th>
                <th className="px-6 py-4">Date & Issued By</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {issues.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                    No Goods Issues found. Create one to get started.
                  </td>
                </tr>
              )}
              {issues.map((gi) => (
                <tr key={gi.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 font-bold">{gi.issue_number}</td>
                  <td className="px-6 py-4 font-medium">-</td>
                  <td className="px-6 py-4">-</td>
                  <td className="px-6 py-4">
                    <div className="font-medium">{gi.recipient || '-'}</div>
                    <div className="text-xs text-muted-foreground">{gi.reference_number || '-'}</div>
                  </td>
                  <td className="px-6 py-4 font-bold">{gi.items?.length || 0} items</td>
                  <td className="px-6 py-4">
                    <div className="font-medium">-</div>
                    <div className="text-xs text-muted-foreground">-</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      gi.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                    }`}>
                      {gi.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(gi.id)} className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10">
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
