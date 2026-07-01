import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Filter, Plus, Layers, Edit2, ShieldAlert } from "lucide-react";

export function SubCategories() {
  const [search, setSearch] = useState("");

  const data = [
    { id: 1, name: "Smartphones", parent: "Electronics", items: 450, status: "Active" },
    { id: 2, name: "Laptops", parent: "Electronics", items: 120, status: "Active" },
    { id: 3, name: "Beverages", parent: "Grocery", items: 850, status: "Active" },
    { id: 4, name: "Winter Wear", parent: "Apparel", items: 340, status: "Inactive" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sub Categories</h2>
          <p className="text-sm text-muted-foreground">Manage nested groupings within main categories.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Add Sub-category</Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30" 
            placeholder="Search sub-categories..." 
          />
        </div>
        <Button variant="outline"><Filter className="size-4 mr-2" /> Filters</Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden max-w-5xl">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Sub Category Name</th>
              <th className="px-6 py-4">Parent Category</th>
              <th className="px-6 py-4">Total Products</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map((sub) => (
              <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-bold flex items-center gap-2"><Layers className="size-4 text-primary" /> {sub.name}</td>
                <td className="px-6 py-4 text-muted-foreground">{sub.parent}</td>
                <td className="px-6 py-4 font-mono font-medium">{sub.items}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    sub.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'
                  }`}>
                    {sub.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8"><Edit2 className="size-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
