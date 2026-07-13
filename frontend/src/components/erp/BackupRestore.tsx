import { useState, useEffect, useCallback } from "react";
import { backupApi } from "../../lib/api-client";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Download, Upload, History, Shield, HardDrive, AlertCircle, Loader2, CheckCircle } from "lucide-react";

export function BackupRestore() {
  const [backupStatus, setBackupStatus] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const data = await backupApi.getStatus(); setBackupStatus(data); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to load backup status"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const backups = [
    { name: "Automated Daily Backup", size: "—", date: "Not configured", status: "pending" },
    { name: "Manual Snapshot", size: "—", date: "Never", status: "pending" },
    { name: "Pre-Migration Backup", size: "—", date: "Never", status: "pending" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Backup & Restore</h2>
          <p className="text-sm text-muted-foreground">Data backup management and disaster recovery.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="size-4 mr-2" /> Restore
          </Button>
          <Button className="gradient-brand text-white border-0">
            <Download className="size-4 mr-2" /> Backup Now
          </Button>
        </div>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-500/10 text-red-600 text-sm border border-red-500/20 flex items-center gap-2"><AlertCircle className="size-4" />{error}</div>}

      {loading && <div className="flex items-center justify-center py-8"><Loader2 className="size-8 animate-spin text-primary" /></div>}

      {backupStatus && (
        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-start gap-3">
          <AlertCircle className="size-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-700">Backup Configuration Required</p>
            <p className="text-xs text-muted-foreground mt-1">
              {backupStatus.message as string ?? "Contact your platform administrator to configure automated backups."}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-10 rounded-lg bg-blue-500/10 text-blue-600 grid place-items-center">
              <History className="size-5" />
            </div>
            <div>
              <p className="font-bold">Backup Frequency</p>
              <p className="text-sm text-muted-foreground capitalize">
                {backupStatus?.backup_frequency as string ?? "Not configured"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-10 rounded-lg bg-green-500/10 text-green-600 grid place-items-center">
              <Shield className="size-5" />
            </div>
            <div>
              <p className="font-bold">Retention Period</p>
              <p className="text-sm text-muted-foreground">
                {backupStatus?.retention_days ? `${backupStatus.retention_days} days` : "Not configured"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-10 rounded-lg bg-purple-500/10 text-purple-600 grid place-items-center">
              <HardDrive className="size-5" />
            </div>
            <div>
              <p className="font-bold">Last Backup</p>
              <p className="text-sm text-muted-foreground">
                {backupStatus?.last_backup ? new Date(backupStatus.last_backup as string).toLocaleString() : "Never"}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-bold">Backup History</h3>
          <span className="text-xs text-muted-foreground">No backups yet</span>
        </div>
        <div className="divide-y">
          {backups.map((backup, i) => (
            <div key={i} className="px-5 py-4 flex items-center justify-between hover:bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-muted grid place-items-center">
                  <HardDrive className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">{backup.name}</p>
                  <p className="text-xs text-muted-foreground">{backup.date} • {backup.size}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded font-bold uppercase">
                  {backup.status}
                </span>
                <Button variant="ghost" size="sm" disabled>
                  <Download className="size-3.5 mr-1" /> Download
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-4 bg-muted/30 text-xs text-muted-foreground text-center border-t">
          Automated backup storage is managed by the platform infrastructure team.
          <br />Contact support to enable automated cloud backups for your tenant.
        </div>
      </Card>
    </div>
  );
}
