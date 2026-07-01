import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, Blocks, Layers, Wrench } from "lucide-react";

export function ProductKits() {
  const data = [
    { id: 1, name: "IKEA Billy Bookcase Assembly Kit", sku: "KIT-BLL-90", components: ["Wooden Panels (x5)", "Screws (x40)", "Allen Key"], type: "Assembly Required" },
    { id: 2, name: "PC Build Kit Basic", sku: "KIT-PCB-01", components: ["Motherboard", "CPU", "RAM 16GB", "Cabinet"], type: "Manufactured" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Product Kits (BOM)</h2>
          <p className="text-sm text-muted-foreground">Manage Bill of Materials for assembly and kitting.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Create Kit</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {data.map((kit) => (
          <Card key={kit.id} className="p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="size-12 rounded-lg bg-amber-500/10 text-amber-600 grid place-items-center shrink-0">
                <Blocks className="size-6" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-lg leading-tight">{kit.name}</h3>
                  <span className="text-[10px] bg-muted px-2 py-0.5 rounded font-bold uppercase">{kit.type}</span>
                </div>
                <div className="text-xs text-muted-foreground font-mono mt-1">{kit.sku}</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Layers className="size-3.5" /> Bill of Materials</div>
              <div className="bg-muted/30 border border-dashed rounded-lg p-3 space-y-2">
                {kit.components.map((comp, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-sm font-medium">
                    <Wrench className="size-3 text-muted-foreground" /> {comp}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm">Edit BOM</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
