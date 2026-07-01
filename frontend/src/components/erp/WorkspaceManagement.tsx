import { useState } from "react";
import { erpWorkspaces } from "@/data/erp-mock";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Laptop, Globe, Clock, Users, Palette, MoreHorizontal } from "lucide-react";

export function WorkspaceManagement() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Workspace Management</h2>
          <p className="text-muted-foreground text-sm mt-1">Configure multi-environment workspaces, UI themes, and localization.</p>
        </div>
        <Button size="sm" className="h-9 gap-2 gradient-brand text-white border-0"><Plus className="size-4" /> Create Workspace</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {erpWorkspaces.map(ws => (
          <Card key={ws.id} className="p-6 hover:shadow-elegant transition-shadow group relative">
            <div className="absolute top-0 right-0 p-4">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal className="size-4" /></Button>
            </div>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="size-12 rounded-xl bg-purple-500/10 text-purple-600 grid place-items-center shadow-sm">
                <Laptop className="size-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg tracking-tight">{ws.name}</h3>
                <p className="text-xs text-muted-foreground">{ws.company} • {ws.branch}</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><Users className="size-4" /> Active Users</div>
                <span className="font-semibold">{ws.users}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><Palette className="size-4" /> Default Theme</div>
                <span className="font-semibold">{ws.theme}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><Globe className="size-4" /> Language</div>
                <span className="font-semibold">{ws.lang}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><Clock className="size-4" /> Timezone</div>
                <span className="font-semibold">{ws.tz}</span>
              </div>
            </div>
            
            <Button variant="outline" className="w-full text-xs h-8">Switch to this Workspace</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
