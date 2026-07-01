import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, Layers, Edit2 } from "lucide-react";

export function SupplierCategories() {
  const data = [
    { id: 1, name: "Electronics", suppliers: 45, spend: "₹12.5M" },
    { id: 2, name: "Groceries", suppliers: 120, spend: "₹8.2M" },
    { id: 3, name: "Office Supplies", suppliers: 12, spend: "₹450K" },
    { id: 4, name: "Logistics Services", suppliers: 8, spend: "₹2.1M" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Supplier Categories</h2>
          <p className="text-sm text-muted-foreground">Classify your vendor base into manageable groups.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Add Category</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {data.map((cat) => (
          <Card key={cat.id} className="p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-bl-full -z-10 transition-transform group-hover:scale-150" />
            <div className="flex justify-between items-start mb-4">
              <div className="size-10 rounded-lg bg-muted flex items-center justify-center">
                <Layers className="size-5 text-primary" />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8"><Edit2 className="size-4" /></Button>
            </div>
            <h3 className="font-bold text-lg">{cat.name}</h3>
            
            <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t">
              <div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Suppliers</div>
                <div className="font-bold">{cat.suppliers}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Total Spend</div>
                <div className="font-bold text-primary">{cat.spend}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
