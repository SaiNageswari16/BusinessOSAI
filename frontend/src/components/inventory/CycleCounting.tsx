import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, RotateCw, Calendar, CheckCircle2 } from "lucide-react";

export function CycleCounting() {
  const data = [
    { id: 1, name: "Daily A-Class Count", schedule: "Daily", nextCount: "Today, 4:00 PM", status: "Active", items: 450 },
    { id: 2, name: "Weekly B-Class Count", schedule: "Weekly", nextCount: "Friday, 10:00 AM", status: "Active", items: 1200 },
    { id: 3, name: "Monthly C-Class Count", schedule: "Monthly", nextCount: "1st of next month", status: "Active", items: 5000 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Cycle Counting</h2>
          <p className="text-sm text-muted-foreground">Automate perpetual inventory counting schedules.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> New Schedule</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.map((cycle) => (
          <Card key={cycle.id} className="p-6 border-t-4 border-t-primary">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <RotateCw className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold">{cycle.name}</h3>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mt-0.5">{cycle.schedule}</div>
                </div>
              </div>
            </div>

            <div className="bg-muted/40 p-3 rounded-lg border border-dashed mb-4 flex justify-between items-center">
              <div>
                <div className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1"><Calendar className="size-3" /> Next Count</div>
                <div className="text-sm font-bold mt-1">{cycle.nextCount}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground font-semibold">Target Items</div>
                <div className="text-sm font-bold mt-1">{cycle.items}</div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="size-3" /> {cycle.status}
              </span>
              <Button variant="ghost" size="sm">Manage</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
