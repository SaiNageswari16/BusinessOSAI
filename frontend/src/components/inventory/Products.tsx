import { useState } from "react";
import { inventoryProducts } from "../../data/inventory-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Filter, Plus, Package, Edit2, MoreHorizontal, Download, Upload, Copy, Archive } from "lucide-react";

export function Products() {
  const [search, setSearch] = useState("");
  const filtered = inventoryProducts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Products</h2>
          <p className="text-sm text-muted-foreground">Manage your master product catalog, SKUs, and stock rules.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><Upload className="size-4 mr-2" /> Import</Button>
          <Button variant="outline"><Download className="size-4 mr-2" /> Export</Button>
          <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Create Product</Button>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30" 
            placeholder="Search by name or SKU..." 
          />
        </div>
        <Button variant="outline"><Filter className="size-4 mr-2" /> Filters</Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Product Details</th>
                <th className="px-6 py-4">SKU / Barcode</th>
                <th className="px-6 py-4">Category & Brand</th>
                <th className="px-6 py-4">Price (MRP)</th>
                <th className="px-6 py-4">Stock Availability</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((product) => (
                <tr key={product.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-muted flex items-center justify-center">
                        <Package className="size-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-bold">{product.name}</div>
                        <div className="text-xs text-muted-foreground">Unit: {product.unit}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-mono font-bold text-xs">{product.sku}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{product.barcode}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-xs">{product.category}</div>
                    <div className="text-xs text-muted-foreground">{product.brand}</div>
                  </td>
                  <td className="px-6 py-4 font-bold">{product.price}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-muted rounded-full h-1.5 max-w-[80px]">
                        <div className="bg-primary h-1.5 rounded-full" style={{ width: `${Math.min(100, (product.stock / 500) * 100)}%` }}></div>
                      </div>
                      <span className="font-bold">{product.stock}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">{product.reserved} Reserved</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      product.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                    }`}>
                      <span className={`size-1.5 rounded-full ${product.status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {product.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><Copy className="size-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><Archive className="size-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary"><Edit2 className="size-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
