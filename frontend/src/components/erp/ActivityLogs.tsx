import { erpActivityLogs } from "@/data/erp-mock";
import { Activity, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function ActivityLogs() {
  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Activity className="size-6 text-primary" /> Activity Feed</h2>
        <p className="text-muted-foreground text-sm mt-1">Real-time pulse of business operations and user actions.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input 
          className="w-full h-10 pl-10 pr-4 text-sm rounded-lg border bg-card focus:ring-2 focus:ring-primary/20" 
          placeholder="Filter activity feed..." 
        />
      </div>

      <div className="relative pl-6 border-l border-border/50 space-y-8 py-4">
        {erpActivityLogs.slice(0, 15).map((log, i) => (
          <div key={log.id} className="relative">
            <div className="absolute -left-[35px] top-0 p-1 bg-background">
              <Avatar className="size-6 border shadow-sm">
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">{log.avatar}</AvatarFallback>
              </Avatar>
            </div>
            <div className="bg-card border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-1">
                <div className="text-sm font-semibold">{log.user}</div>
                <div className="text-[10px] text-muted-foreground">{log.time}</div>
              </div>
              <div className="text-xs text-muted-foreground">{log.action}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
