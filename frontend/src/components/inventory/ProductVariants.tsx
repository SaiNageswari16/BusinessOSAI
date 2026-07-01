import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Plus, Combine, ScanBarcode, Box } from "lucide-react";

export function ProductVariants() {
  const data = [
    { id: 1, parent: "Apple iPhone 15", variant: "128GB / Black", sku: "IP15-128-BLK", stock: 45, price: "₹79,900" },
    { id: 2, parent: "Apple iPhone 15", variant: "256GB / Black", sku: "IP15-256-BLK", stock: 12, price: "₹89,900" },
    { id: 3, parent: "Apple iPhone 15", variant: "128GB / Blue", sku: "IP15-128-BLU", stock: 5, price: "₹79,900" },
    { id: 4, parent: "Nike T-Shirt", variant: "Medium / Red", sku: "NK-TS-M-RED", stock: 120, price: "₹1,499" },
    { id: 5, parent: "Nike T-Shirt", variant: "Large / Red", sku: "NK-TS-L-RED", stock: 80, price: "₹1,499" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Product Variants</h2>
          <p className="text-sm text-muted-foreground">Manage SKUs generated from product attributes.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Combine className="size-4 mr-2" /> Generate Variants</Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Parent Product</th>
              <th className="px-6 py-4">Variant Details</th>
              <th className="px-6 py-4">Variant SKU</th>
              <th className="px-6 py-4">Price</th>
              <th className="px-6 py-4">Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map((v) => (
              <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-bold flex items-center gap-2"><Box className="size-4 text-muted-foreground" /> {v.parent}</td>
                <td className="px-6 py-4">
                  <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-semibold">{v.variant}</span>
                </td>
                <td className="px-6 py-4 font-mono font-medium text-xs flex items-center gap-2">
                  <ScanBarcode className="size-3 text-muted-foreground" /> {v.sku}
                </td>
                <td className="px-6 py-4 font-medium">{v.price}</td>
                <td className="px-6 py-4 font-bold">{v.stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
