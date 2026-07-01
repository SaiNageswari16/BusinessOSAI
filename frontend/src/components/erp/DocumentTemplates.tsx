import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Filter, Plus, FileText, Download } from "lucide-react";

const documents = [
  { id: 1, name: "Standard Invoice", type: "PDF", module: "Accounting", lastUpdated: "2 days ago" },
  { id: 2, name: "Enterprise Quotation", type: "PDF", module: "Sales", lastUpdated: "1 week ago" },
  { id: 3, name: "Purchase Order V2", type: "PDF", module: "Procurement", lastUpdated: "3 weeks ago" },
  { id: 4, name: "Offer Letter Template", type: "Word", module: "HRMS", lastUpdated: "1 month ago" },
];

export function DocumentTemplates() {
  const [search, setSearch] = useState("");

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Document Templates</h2>
          <p className="text-sm text-muted-foreground">Manage templates for Invoices, POs, Quotations, and Letters.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Upload Template</Button>
      </div>

      <div className="flex gap-4 items-center mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30" 
            placeholder="Search documents..." 
          />
        </div>
        <Button variant="outline"><Filter className="size-4 mr-2" /> Filters</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {documents.map((doc) => (
          <Card key={doc.id} className="p-1 hover:shadow-md transition-shadow group overflow-hidden">
            <div className="h-32 bg-muted flex items-center justify-center rounded-t-lg relative">
              <FileText className="size-12 text-muted-foreground/30" />
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                <Button variant="default" size="sm" className="shadow-lg">Edit</Button>
                <Button variant="outline" size="sm" className="bg-background shadow-lg"><Download className="size-4" /></Button>
              </div>
            </div>
            <div className="p-4 border-t">
              <h3 className="font-bold text-sm truncate">{doc.name}</h3>
              <div className="flex justify-between items-center mt-2">
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase">{doc.type}</span>
                <span className="text-[10px] text-muted-foreground">{doc.lastUpdated}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
