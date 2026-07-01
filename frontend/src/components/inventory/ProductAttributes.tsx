import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Plus, SlidersHorizontal, Settings2, Trash2 } from "lucide-react";

export function ProductAttributes() {
  const data = [
    { id: 1, name: "Color", options: ["Red", "Blue", "Green", "Black", "White"], module: "Apparel" },
    { id: 2, name: "Size", options: ["S", "M", "L", "XL", "XXL"], module: "Apparel" },
    { id: 3, name: "Storage", options: ["64GB", "128GB", "256GB", "512GB"], module: "Electronics" },
    { id: 4, name: "Flavor", options: ["Chocolate", "Vanilla", "Strawberry"], module: "Grocery" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Product Attributes</h2>
          <p className="text-sm text-muted-foreground">Define master attributes for product variants.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Create Attribute</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {data.map((attr) => (
          <Card key={attr.id} className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <SlidersHorizontal className="size-5 text-primary" />
                <div>
                  <h3 className="font-bold text-lg">{attr.name}</h3>
                  <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded mt-1 inline-block uppercase font-semibold">{attr.module}</span>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8"><Settings2 className="size-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="size-4" /></Button>
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-3 border">
              <div className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Options ({attr.options.length})</div>
              <div className="flex flex-wrap gap-2">
                {attr.options.map((opt, i) => (
                  <span key={i} className="text-xs bg-background border px-2.5 py-1 rounded-full font-medium shadow-sm">
                    {opt}
                  </span>
                ))}
                <button className="text-xs bg-primary/5 text-primary border border-primary/20 border-dashed px-2.5 py-1 rounded-full font-medium hover:bg-primary/10 transition-colors">
                  + Add
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
