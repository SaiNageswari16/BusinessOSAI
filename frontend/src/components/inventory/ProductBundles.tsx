import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Plus, PackagePlus, Box, Edit2 } from "lucide-react";

export function ProductBundles() {
  const data = [
    { id: 1, name: "Work from Home Starter Bundle", sku: "BNDL-WFH-01", price: "₹85,000", items: ["MacBook Air M1", "Logitech Mouse", "Laptop Stand"], stock: 15 },
    { id: 2, name: "Summer Beach Kit", sku: "BNDL-SUM-99", price: "₹2,500", items: ["Sunscreen 50 SPF", "Beach Towel", "Sunglasses"], stock: 42 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Product Bundles</h2>
          <p className="text-sm text-muted-foreground">Manage grouped products sold as a single SKU.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Create Bundle</Button>
      </div>

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
              <Button variant="ghost" size="icon" className="h-8 w-8"><Edit2 className="size-4" /></Button>
            </div>

            <div className="bg-muted/40 rounded-lg p-4 mb-4">
              <div className="text-[10px] uppercase font-bold text-muted-foreground mb-3 flex items-center gap-1.5"><Box className="size-3" /> Bundle Includes</div>
              <ul className="space-y-2">
                {bundle.items.map((item, idx) => (
                  <li key={idx} className="text-sm font-medium flex items-center gap-2 before:content-[''] before:block before:w-1.5 before:h-1.5 before:rounded-full before:bg-primary/50">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <div>
                <div className="text-xs text-muted-foreground">Selling Price</div>
                <div className="font-bold">{bundle.price}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Bundle Stock</div>
                <div className="font-bold text-primary">{bundle.stock} Available</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
