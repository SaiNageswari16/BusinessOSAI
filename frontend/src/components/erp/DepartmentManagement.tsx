import { useState } from "react";
import { erpDepartments } from "@/data/erp-mock";
import { Button } from "@/components/ui/button";
import { Search, Plus, MoreHorizontal } from "lucide-react";

export function DepartmentManagement() {
  const [search, setSearch] = useState("");

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Departments</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage organizational departments and functional groups.</p>
        </div>
        <Button size="sm" className="h-9 gap-2 gradient-brand text-white border-0"><Plus className="size-4" /> Add Department</Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input 
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-4 text-sm rounded-lg border bg-card focus:ring-2 focus:ring-primary/20" 
          placeholder="Search departments..." 
        />
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-6 py-3 text-left font-semibold text-muted-foreground">Code</th>
              <th className="px-6 py-3 text-left font-semibold text-muted-foreground">Department Name</th>
              <th className="px-6 py-3 text-left font-semibold text-muted-foreground">Department Head</th>
              <th className="px-6 py-3 text-left font-semibold text-muted-foreground">Employees</th>
              <th className="px-6 py-3 text-left font-semibold text-muted-foreground">Status</th>
              <th className="px-6 py-3 text-right font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {erpDepartments.filter(d => d.name.toLowerCase().includes(search.toLowerCase())).map((dept) => (
              <tr key={dept.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-mono text-xs">{dept.code}</td>
                <td className="px-6 py-4 font-medium">{dept.name}</td>
                <td className="px-6 py-4 text-muted-foreground">{dept.head}</td>
                <td className="px-6 py-4">{dept.employeeCount}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600">
                    {dept.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><MoreHorizontal className="size-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
