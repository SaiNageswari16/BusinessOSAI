import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Plus, SlidersHorizontal, Settings2, Trash2 } from "lucide-react";
import { inventoryApi, ProductAttribute } from "../../lib/api-client";

export function ProductAttributes() {
  const [data, setData] = useState<ProductAttribute[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await inventoryApi.getProductAttributes();
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
    const name = prompt("Enter attribute name (e.g. Color):");
    if (!name) return;
    const module = prompt("Enter module (e.g. Apparel):") || "General";
    const optionsStr = prompt("Enter options separated by comma (e.g. Red,Blue,Green):");
    if (!optionsStr) return;
    
    const options = optionsStr.split(",").map(o => o.trim()).filter(Boolean);

    try {
      await inventoryApi.createProductAttribute({ name, module, options });
      loadData();
    } catch (error) {
      alert("Failed to create attribute");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this attribute?")) return;
    try {
      await inventoryApi.deleteProductAttribute(id);
      loadData();
    } catch (error) {
      alert("Failed to delete attribute");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Product Attributes</h2>
          <p className="text-sm text-muted-foreground">Define master attributes for product variants.</p>
        </div>
        <Button onClick={handleCreate} className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Create Attribute</Button>
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-muted-foreground">Loading attributes...</div>
      ) : data.length === 0 ? (
        <div className="p-10 text-center border border-dashed rounded-lg text-muted-foreground">
          No attributes found. Create one to get started!
        </div>
      ) : (
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
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(attr.id)}><Trash2 className="size-4" /></Button>
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
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
