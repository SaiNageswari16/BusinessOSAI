import { useState } from "react";
import { erpCustomFields } from "../../data/erp-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Filter, Plus, Type, ListOrdered, Calendar as CalendarIcon, CheckSquare } from "lucide-react";

export function CustomFields() {
  const [search, setSearch] = useState("");
  const filtered = erpCustomFields.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  const getIcon = (type: string) => {
    switch (type) {
      case 'Text': return <Type className="size-4" />;
      case 'Phone': return <Type className="size-4" />;
      case 'Dropdown': return <ListOrdered className="size-4" />;
      case 'Checkbox': return <CheckSquare className="size-4" />;
      case 'Date': return <CalendarIcon className="size-4" />;
      default: return <Type className="size-4" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Custom Fields</h2>
          <p className="text-sm text-muted-foreground">Add dynamic custom fields across different modules.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Add Custom Field</Button>
      </div>

      <div className="flex gap-4 items-center mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30" 
            placeholder="Search fields..." 
          />
        </div>
        <Button variant="outline"><Filter className="size-4 mr-2" /> Filters</Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Field Name</th>
              <th className="px-6 py-4">Module Attached</th>
              <th className="px-6 py-4">Data Type</th>
              <th className="px-6 py-4">Required</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((field) => (
              <tr key={field.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-bold">{field.name}</td>
                <td className="px-6 py-4">
                  <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-semibold">{field.module}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {getIcon(field.type)} <span>{field.type}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {field.required ? (
                    <span className="text-xs font-bold text-rose-600">Yes</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">No</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    {field.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
