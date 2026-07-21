import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Plus, Layers, Edit2, Trash2 } from "lucide-react";
import { inventoryApi, ProductVariant } from "../../lib/api-client";

export function ProductVariants() {
  const [data, setData] = useState<ProductVariant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await inventoryApi.getProductVariants();
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
    const product_id = prompt("Enter product ID (UUID):");
    if (!product_id) return;
    const variant_name = prompt("Enter variant name (e.g. Red Small):");
    if (!variant_name) return;
    const sku = prompt("Enter variant SKU:");
    if (!sku) return;
    const additional_price = prompt("Enter additional price:") || "0";

    try {
      await inventoryApi.createProductVariant({ 
        product_id, 
        variant_name, 
        sku, 
        attributes: { "mock": "value" }, 
        additional_price: parseFloat(additional_price) 
      });
      loadData();
    } catch (error) {
      alert("Failed to create variant");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this variant?")) return;
    try {
      await inventoryApi.deleteProductVariant(id);
      loadData();
    } catch (error) {
      alert("Failed to delete variant");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Product Variants</h2>
          <p className="text-sm text-muted-foreground">Manage specific SKUs generated from product attributes.</p>
        </div>
        <Button onClick={handleCreate} className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Create Variant</Button>
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-muted-foreground">Loading variants...</div>
      ) : data.length === 0 ? (
        <div className="p-10 text-center border border-dashed rounded-lg text-muted-foreground">
          No variants found. Create one to get started!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.map((variant) => (
            <Card key={variant.id} className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-indigo-500/10 text-indigo-600 grid place-items-center">
                    <Layers className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight">{variant.variant_name}</h3>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">{variant.sku}</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(variant.id)}><Trash2 className="size-4" /></Button>
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg p-3 border mb-4">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Attribute Configuration</div>
                <div className="space-y-2">
                  {Object.entries(variant.attributes).map(([key, val], i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="font-medium text-muted-foreground">{key}</span>
                      <span className="font-semibold">{val as string}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t">
                <div>
                  <div className="text-xs text-muted-foreground">Additional Price</div>
                  <div className="font-bold text-emerald-600">+₹{variant.additional_price}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
