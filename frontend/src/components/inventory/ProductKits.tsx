import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, Blocks, Layers, Wrench, Trash2 } from "lucide-react";
import { inventoryApi, ProductKit } from "../../lib/api-client";

export function ProductKits() {
  const [data, setData] = useState<ProductKit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await inventoryApi.getProductKits();
      setData(res);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async () => {
    const name = prompt("Enter kit name:");
    if (!name) return;
    const sku = prompt("Enter kit SKU:");
    if (!sku) return;
    const kit_type = prompt("Enter kit type (e.g. Assembly Required):") || "Assembly";

    try {
      await inventoryApi.createProductKit({ 
        name, 
        sku, 
        kit_type,
        items: [] 
      });
      loadData();
    } catch (error) {
      alert("Failed to create kit");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this kit?")) return;
    try {
      await inventoryApi.deleteProductKit(id);
      loadData();
    } catch (error) {
      alert("Failed to delete kit");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Product Kits (BOM)</h2>
          <p className="text-sm text-muted-foreground">Manage Bill of Materials for assembly and kitting.</p>
        </div>
        <Button onClick={handleCreate} className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Create Kit</Button>
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-muted-foreground">Loading kits...</div>
      ) : data.length === 0 ? (
        <div className="p-10 text-center border border-dashed rounded-lg text-muted-foreground">
          No kits found. Create one to get started!
        </div>
      ) : (
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
                    <span className="text-[10px] bg-muted px-2 py-0.5 rounded font-bold uppercase">{kit.type || kit.kit_type}</span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono mt-1">{kit.sku}</div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(kit.id)}><Trash2 className="size-4" /></Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Layers className="size-3.5" /> Bill of Materials</div>
                <div className="bg-muted/30 border border-dashed rounded-lg p-3 space-y-2">
                  {kit.items.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic">No components defined</div>
                  ) : kit.items.map((comp, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-sm font-medium">
                      <Wrench className="size-3 text-muted-foreground" /> {comp.component_name} (x{comp.quantity})
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
