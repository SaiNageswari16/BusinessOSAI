import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Image as ImageIcon, UploadCloud, Link as LinkIcon, Trash2 } from "lucide-react";
import { inventoryApi, ProductImage } from "../../lib/api-client";

export function ProductImages() {
  const [data, setData] = useState<ProductImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await inventoryApi.getProductImages();
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
    const image_url = prompt("Enter image URL:");
    if (!image_url) return;

    try {
      await inventoryApi.createProductImage({ 
        product_id, 
        image_url, 
        is_primary: true,
        display_order: 0
      });
      loadData();
    } catch (error) {
      alert("Failed to create image");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this image?")) return;
    try {
      await inventoryApi.deleteProductImage(id);
      loadData();
    } catch (error) {
      alert("Failed to delete image");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Product Images</h2>
          <p className="text-sm text-muted-foreground">Manage media library and CDN links for product catalog.</p>
        </div>
        <Button onClick={handleCreate} className="gradient-brand text-white border-0"><UploadCloud className="size-4 mr-2" /> Add Image Link</Button>
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-muted-foreground">Loading images...</div>
      ) : data.length === 0 ? (
        <div className="p-10 text-center border border-dashed rounded-lg text-muted-foreground">
          No images found. Add one to get started!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {data.map((img) => (
            <Card key={img.id} className="overflow-hidden group relative">
              <div className="aspect-square bg-muted relative">
                <img src={img.image_url} alt="Product" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button variant="secondary" size="icon" className="h-8 w-8"><LinkIcon className="size-4" /></Button>
                  <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleDelete(img.id)}><Trash2 className="size-4" /></Button>
                </div>
                <div className="absolute top-2 left-2">
                  {img.is_primary && (
                    <span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded shadow-sm font-bold uppercase">Primary</span>
                  )}
                </div>
              </div>
              <div className="p-3 border-t">
                <div className="text-xs font-bold truncate">Product ID: {img.product_id}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1"><ImageIcon className="size-3" /> External Link</div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
