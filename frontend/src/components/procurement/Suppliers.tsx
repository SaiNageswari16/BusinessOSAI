import { useState } from "react";
import { procurementSuppliers } from "../../data/procurement-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Filter, Plus, Building2, Edit2, MoreHorizontal, Download, Upload, Eye, Star } from "lucide-react";

export function Suppliers() {
  const [search, setSearch] = useState("");
  const filtered = procurementSuppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Suppliers</h2>
          <p className="text-sm text-muted-foreground">Manage your master supplier list, profiles, and credit limits.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><Upload className="size-4 mr-2" /> Import</Button>
          <Button variant="outline"><Download className="size-4 mr-2" /> Export</Button>
          <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Onboard Supplier</Button>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30" 
            placeholder="Search suppliers or code..." 
          />
        </div>
        <Button variant="outline"><Filter className="size-4 mr-2" /> Filters</Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Supplier Profile</th>
                <th className="px-6 py-4">Supplier Code</th>
                <th className="px-6 py-4">Type & Products</th>
                <th className="px-6 py-4">Credit Limit</th>
                <th className="px-6 py-4">Rating</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-muted flex items-center justify-center">
                        <Building2 className="size-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-bold">{supplier.name}</div>
                        <div className="text-xs text-muted-foreground">{supplier.company}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-mono font-bold text-xs text-primary">{supplier.code}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-xs bg-muted px-2 py-0.5 rounded w-fit mb-1">{supplier.type}</div>
                    <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">{supplier.products}</div>
                  </td>
                  <td className="px-6 py-4 font-bold">{supplier.creditLimit}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 font-bold text-amber-500">
                      <Star className="size-3 fill-amber-500" /> {supplier.rating}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      supplier.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                    }`}>
                      <span className={`size-1.5 rounded-full ${supplier.status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {supplier.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary"><Eye className="size-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><Edit2 className="size-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
