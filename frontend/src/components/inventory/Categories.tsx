import { useState } from "react";
import { inventoryCategories } from "../../data/inventory-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Filter, Plus, FolderTree, Edit2, ChevronDown } from "lucide-react";

export function Categories() {
  const [search, setSearch] = useState("");
  const filtered = inventoryCategories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Categories</h2>
          <p className="text-sm text-muted-foreground">Manage multi-level product category hierarchies.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Add Category</Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30" 
            placeholder="Search categories..." 
          />
        </div>
        <Button variant="outline"><Filter className="size-4 mr-2" /> Filters</Button>
      </div>

      <div className="space-y-4 max-w-4xl">
        {filtered.map((category) => (
          <Card key={category.id} className="p-4">
            <div className="flex justify-between items-center cursor-pointer">
              <div className="flex items-center gap-3">
                <ChevronDown className="size-4 text-muted-foreground" />
                <FolderTree className="size-5 text-primary" />
                <h3 className="font-bold">{category.name}</h3>
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded font-semibold">{category.count} Products</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">Add Sub-category</Button>
                <Button variant="ghost" size="icon" className="h-8 w-8"><Edit2 className="size-4" /></Button>
              </div>
            </div>
            
            <div className="mt-4 pl-12 space-y-2 border-l ml-3 pb-2">
              {category.sub.map((sub, idx) => (
                <div key={idx} className="flex items-center gap-3 py-2 px-3 hover:bg-muted/30 rounded-lg transition-colors group">
                  <div className="w-4 h-px bg-border" />
                  <span className="font-medium text-sm text-foreground">{sub}</span>
                  <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-6 w-6"><Edit2 className="size-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
