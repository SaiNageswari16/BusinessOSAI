import { useState } from "react";
import { erpBackups } from "../../data/erp-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, DatabaseBackup, Cloud, Download, Clock, Plus, PlayCircle } from "lucide-react";

export function BackupRestore() {
  const [search, setSearch] = useState("");
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Backup & Restore</h2>
          <p className="text-sm text-muted-foreground">Manage database snapshots and automated recovery points.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><DatabaseBackup className="size-4 mr-2" /> Configure Schedule</Button>
          <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Manual Backup Now</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="p-5 flex items-center gap-4">
          <div className="size-12 rounded-full bg-primary/10 text-primary grid place-items-center">
            <Clock className="size-6" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Next Scheduled Backup</div>
            <div className="font-bold text-lg">Today, 02:00 AM</div>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="size-12 rounded-full bg-blue-500/10 text-blue-500 grid place-items-center">
            <Cloud className="size-6" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Cloud Storage Used</div>
            <div className="font-bold text-lg text-blue-600">45.8 GB / 100 GB</div>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="size-12 rounded-full bg-emerald-500/10 text-emerald-500 grid place-items-center">
            <DatabaseBackup className="size-6" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Retention Policy</div>
            <div className="font-bold text-lg text-emerald-600">30 Days</div>
          </div>
        </Card>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Backup Date</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Size</th>
              <th className="px-6 py-4">Location</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {erpBackups.map((backup) => (
              <tr key={backup.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-mono font-medium text-foreground">{backup.date}</td>
                <td className="px-6 py-4 font-bold">{backup.type}</td>
                <td className="px-6 py-4">{backup.size}</td>
                <td className="px-6 py-4 flex items-center gap-2 text-muted-foreground"><Cloud className="size-4" /> {backup.location}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    {backup.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="sm" className="text-primary hover:text-primary"><Download className="size-4 mr-2" /> Download</Button>
                  <Button variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"><PlayCircle className="size-4 mr-2" /> Restore</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
