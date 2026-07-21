import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Plus, PackagePlus, Box, Edit2, Trash2 } from "lucide-react";
import { inventoryApi, ProductBundle } from "../../lib/api-client";

export function ProductBundles() {
  const [data, setData] = useState<ProductBundle[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await inventoryApi.getProductBundles();
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
    const name = prompt("Enter bundle name:");
    if (!name) return;
    const sku = prompt("Enter bundle SKU:");
    if (!sku) return;
    const price = prompt("Enter bundle price:") || "0";

    try {
      await inventoryApi.createProductBundle({ 
        name, 
        sku, 
        price: parseFloat(price),
        items: [] // In a real UI we would select products here
      });
      loadData();
    } catch (error) {
      alert("Failed to create bundle");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this bundle?")) return;
    try {
      await inventoryApi.deleteProductBundle(id);
      loadData();
    } catch (error) {
      alert("Failed to delete bundle");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Product Bundles</h2>
          <p className="text-sm text-muted-foreground">Manage grouped products sold as a single SKU.</p>
        </div>
        <Button onClick={handleCreate} className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Create Bundle</Button>
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-muted-foreground">Loading bundles...</div>
      ) : data.length === 0 ? (
        <div className="p-10 text-center border border-dashed rounded-lg text-muted-foreground">
          No bundles found. Create one to get started!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.map((bundle) => (
            <Card key={bundle.id} className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                    <PackagePlus className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight">{bundle.name}</h3>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">{bundle.sku}</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(bundle.id)}><Trash2 className="size-4" /></Button>
                </div>
              </div>

              <div className="bg-muted/40 rounded-lg p-4 mb-4">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-3 flex items-center gap-1.5"><Box className="size-3" /> Bundle Includes</div>
                <ul className="space-y-2">
                  {bundle.items.length === 0 ? (
                    <li className="text-xs text-muted-foreground italic">No items in bundle</li>
                  ) : bundle.items.map((item, idx) => (
                    <li key={idx} className="text-sm font-medium flex items-center gap-2 before:content-[''] before:block before:w-1.5 before:h-1.5 before:rounded-full before:bg-primary/50">
                      Product ID: {item.product_id} (x{item.quantity})
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex justify-between items-center pt-2 border-t">
                <div>
                  <div className="text-xs text-muted-foreground">Selling Price</div>
                  <div className="font-bold">₹{bundle.price}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
