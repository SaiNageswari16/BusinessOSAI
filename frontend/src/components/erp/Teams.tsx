import { useState } from "react";
import { erpTeams } from "../../data/erp-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Users, Filter, Plus, Target } from "lucide-react";

export function Teams() {
  const [search, setSearch] = useState("");
  const filtered = erpTeams.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Teams</h2>
          <p className="text-sm text-muted-foreground">Manage organizational teams and their KPIs.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Create Team</Button>
      </div>

      <div className="flex gap-4 items-center mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30" 
            placeholder="Search teams..." 
          />
        </div>
        <Button variant="outline"><Filter className="size-4 mr-2" /> Filters</Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Team Name</th>
              <th className="px-6 py-4">Lead</th>
              <th className="px-6 py-4">Members</th>
              <th className="px-6 py-4">Department</th>
              <th className="px-6 py-4">Branch</th>
              <th className="px-6 py-4">KPI Score</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((team) => (
              <tr key={team.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-medium flex items-center gap-2">
                  <Users className="size-4 text-primary" /> {team.name}
                </td>
                <td className="px-6 py-4">{team.lead}</td>
                <td className="px-6 py-4">{team.members}</td>
                <td className="px-6 py-4">{team.department}</td>
                <td className="px-6 py-4">{team.branch}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Target className="size-3.5 text-primary" />
                    <div className="w-full bg-muted rounded-full h-1.5 max-w-[60px]">
                      <div className="bg-primary h-1.5 rounded-full" style={{ width: team.kpi }}></div>
                    </div>
                    <span className="text-xs font-medium">{team.kpi}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    {team.status}
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
