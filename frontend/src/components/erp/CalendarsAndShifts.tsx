import { useState } from "react";
import { erpShifts } from "../../data/erp-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Calendar, Filter, Plus, Clock, Sunrise, Sunset, Moon } from "lucide-react";

export function CalendarsAndShifts() {
  const [search, setSearch] = useState("");
  const filtered = erpShifts.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  const getShiftIcon = (name: string) => {
    if (name.includes('Morning')) return <Sunrise className="size-5 text-amber-500" />;
    if (name.includes('Evening')) return <Sunset className="size-5 text-orange-500" />;
    if (name.includes('Night')) return <Moon className="size-5 text-indigo-500" />;
    return <Clock className="size-5 text-primary" />;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Calendars & Shifts</h2>
          <p className="text-sm text-muted-foreground">Manage holidays and shift timings globally.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><Calendar className="size-4 mr-2" /> Holiday Calendar</Button>
          <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Add Shift Template</Button>
        </div>
      </div>

      <div className="flex gap-4 items-center mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30" 
            placeholder="Search shifts..." 
          />
        </div>
        <Button variant="outline"><Filter className="size-4 mr-2" /> Filters</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((shift) => (
          <Card key={shift.id} className="p-6">
            <div className="flex justify-between items-start mb-6 border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-muted grid place-items-center">
                  {getShiftIcon(shift.name)}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{shift.name}</h3>
                  <div className="text-xs text-muted-foreground mt-0.5">Days: {shift.days}</div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                {shift.status}
              </span>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center bg-muted/40 p-3 rounded-lg border border-dashed">
                <div className="text-xs text-muted-foreground font-medium">Working Hours</div>
                <div className="font-mono font-bold text-sm tracking-tight">{shift.hours}</div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1 uppercase font-semibold">Break Time</div>
                  <div className="text-sm font-medium">{shift.break}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1 uppercase font-semibold">Grace Time</div>
                  <div className="text-sm font-medium">{shift.grace}</div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
