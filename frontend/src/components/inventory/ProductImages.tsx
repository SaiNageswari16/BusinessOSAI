import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Image as ImageIcon, UploadCloud, Link as LinkIcon, Trash2 } from "lucide-react";

export function ProductImages() {
  const data = [
    { id: 1, product: "Apple iPhone 15", url: "https://images.unsplash.com/photo-1695048133142-1a20484d2569", status: "Primary" },
    { id: 2, product: "Nike Air Force 1", url: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a", status: "Primary" },
    { id: 3, product: "Sony WH-1000XM5", url: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb", status: "Primary" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Product Images</h2>
          <p className="text-sm text-muted-foreground">Manage media library and CDN links for product catalog.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><UploadCloud className="size-4 mr-2" /> Bulk Upload</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {data.map((img) => (
          <Card key={img.id} className="overflow-hidden group relative">
            <div className="aspect-square bg-muted relative">
              <img src={img.url} alt={img.product} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button variant="secondary" size="icon" className="h-8 w-8"><LinkIcon className="size-4" /></Button>
                <Button variant="destructive" size="icon" className="h-8 w-8"><Trash2 className="size-4" /></Button>
              </div>
              <div className="absolute top-2 left-2">
                <span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded shadow-sm font-bold uppercase">{img.status}</span>
              </div>
            </div>
            <div className="p-3 border-t">
              <div className="text-xs font-bold truncate">{img.product}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1"><ImageIcon className="size-3" /> 1200x1200px (WEBP)</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
