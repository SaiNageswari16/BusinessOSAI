import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Plus, Scale, MoreVertical, CheckCircle2 } from "lucide-react";

export function UnitsOfMeasure() {
  const data = [
    { id: 1, name: "Piece", short: "Pcs", type: "Quantity", base: true, ratio: 1 },
    { id: 2, name: "Kilogram", short: "Kg", type: "Weight", base: true, ratio: 1 },
    { id: 3, name: "Gram", short: "g", type: "Weight", base: false, ratio: 0.001 },
    { id: 4, name: "Box (10 Pcs)", short: "Box", type: "Quantity", base: false, ratio: 10 },
    { id: 5, name: "Carton (50 Pcs)", short: "Crt", type: "Quantity", base: false, ratio: 50 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Units of Measure (UoM)</h2>
          <p className="text-sm text-muted-foreground">Manage measurement units and conversion ratios.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Add UoM</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.map((uom) => (
          <Card key={uom.id} className="p-6 relative group overflow-hidden">
            {uom.base && <div className="absolute top-0 right-0 bg-primary text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg flex items-center gap-1"><CheckCircle2 className="size-3" /> BASE UNIT</div>}
            
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Scale className="size-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg leading-tight">{uom.name}</h3>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase">{uom.short}</span>
                  <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium">{uom.type}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t flex justify-between items-center">
              <div className="text-xs text-muted-foreground">
                Conversion Ratio: <span className="font-mono font-bold text-foreground ml-1">x{uom.ratio}</span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="size-4" /></Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
