import React, { useState, useEffect } from "react";
import { 
  Briefcase, CheckCircle2, AlertCircle, RefreshCw, Unplug, ShieldCheck, HelpCircle, AlertTriangle, Download
} from "lucide-react";
import { inventoryApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function RecruitmentIntegrations() {
  const [status, setStatus] = useState<{
    connected: boolean;
    organization_name?: string;
    connected_at?: string;
    last_sync?: string;
  } | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string; created?: number; updated?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check URL query parameters for success/error redirect status from callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const zohoStatus = params.get("zoho_status");
    if (zohoStatus === "success") {
      setTestResult({ success: true, message: "Zoho Recruit successfully authorized and connected!" });
      // Clean query parameters without reloading
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    } else if (zohoStatus === "error") {
      const msg = params.get("message") || "Authorization failed.";
      setError(`OAuth Error: ${msg}`);
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    }
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await inventoryApi.getZohoStatus();
      setStatus(res);
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch integration status from backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleConnect = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await inventoryApi.connectZoho();
      if (res && res.url) {
        // Redirect browser to Zoho authorization portal
        window.location.href = res.url;
      } else {
        setError("Failed to generate Zoho OAuth URL from server.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.detail || "Error initiating Zoho Recruit connection.");
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Are you sure you want to disconnect Zoho Recruit? Stored authorization tokens will be deleted.")) {
      return;
    }
    setSyncing(true);
    setError(null);
    setTestResult(null);
    try {
      await inventoryApi.disconnectZoho();
      await fetchStatus();
    } catch (err: any) {
      console.error(err);
      setError("Failed to disconnect Zoho Recruit.");
    } finally {
      setSyncing(false);
    }
  };

  const handleTestConnection = async () => {
    setSyncing(true);
    setTestResult(null);
    setError(null);
    try {
      const res = await inventoryApi.testZohoConnection();
      setTestResult({
        success: res.success,
        message: res.message
      });
      if (res.success) {
        // Refresh status to fetch the latest sync timestamp
        const statusRes = await inventoryApi.getZohoStatus();
        setStatus(statusRes);
      }
    } catch (err: any) {
      console.error(err);
      setTestResult({
        success: false,
        message: err?.detail || "Connection test request failed."
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncFromZoho = async () => {
    setSyncing(true);
    setSyncResult(null);
    setError(null);
    try {
      const res = await inventoryApi.syncJobsFromZoho();
      setSyncResult({
        success: res.success,
        message: res.message,
        created: res.created,
        updated: res.updated
      });
      // Refresh Zoho status timestamp
      await fetchStatus();
    } catch (err: any) {
      console.error(err);
      setSyncResult({
        success: false,
        message: err?.detail || "Failed to sync jobs from Zoho Recruit."
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Recruitment Integrations</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Connect and sync your job openings and candidate databases with external recruitment portals.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-3 text-destructive text-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <AlertCircle className="size-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Error:</span> {error}
          </div>
        </div>
      )}

      {testResult && (
        <div className={cn(
          "p-4 border rounded-xl flex items-start gap-3 text-sm animate-in fade-in slide-in-from-top-2 duration-200",
          testResult.success 
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
            : "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
        )}>
          {testResult.success ? (
            <CheckCircle2 className="size-5 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="size-5 shrink-0 mt-0.5" />
          )}
          <div>
            <span className="font-semibold">{testResult.success ? "Success" : "Warning"}:</span> {testResult.message}
          </div>
        </div>
      )}

      {syncResult && (
        <div className={cn(
          "p-4 border rounded-xl flex items-start gap-3 text-sm animate-in fade-in slide-in-from-top-2 duration-200",
          syncResult.success
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
            : "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
        )}>
          {syncResult.success ? (
            <CheckCircle2 className="size-5 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="size-5 shrink-0 mt-0.5" />
          )}
          <div>
            <span className="font-semibold">{syncResult.success ? "Zoho Import Complete" : "Sync Warning"}:</span>{" "}
            {syncResult.message}
            {syncResult.success && syncResult.created !== undefined && (
              <span className="ml-2 text-xs opacity-80">
                ({syncResult.created} new · {syncResult.updated} updated — refresh Job Openings to see them)
              </span>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <RefreshCw className="size-8 text-primary animate-spin" />
          <span className="text-muted-foreground text-sm font-medium">Checking integration status...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Zoho Recruit Card */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-300 relative overflow-hidden group">
            {/* Subtle background glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all duration-300" />
            
            <div className="space-y-4 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                    <Briefcase className="size-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground">Zoho Recruit</h3>
                    <p className="text-xs text-muted-foreground">Applicant Tracking & Job Posting</p>
                  </div>
                </div>
                
                {/* Status Badges */}
                <span className={cn(
                  "px-3 py-1 rounded-full text-xs font-semibold tracking-wide border transition-all duration-300",
                  syncing
                    ? "bg-amber-500/10 border-amber-500/20 text-amber-500 animate-pulse"
                    : status?.connected
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted border-border text-muted-foreground"
                )}>
                  {syncing ? "Syncing..." : status?.connected ? "Connected" : "Disconnected"}
                </span>
              </div>

              <div className="border-t border-border/50 pt-4 space-y-2.5 text-sm text-muted-foreground">
                {status?.connected ? (
                  <>
                    <div className="flex justify-between">
                      <span>Connected Account:</span>
                      <span className="font-semibold text-foreground">{status.organization_name || "Enterprise Portal"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Connected On:</span>
                      <span className="text-foreground">
                        {status.connected_at ? new Date(status.connected_at).toLocaleDateString(undefined, {
                          year: 'numeric', month: 'short', day: 'numeric'
                        }) : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last Sync:</span>
                      <span className="text-foreground">
                        {status.last_sync ? new Date(status.last_sync).toLocaleTimeString(undefined, {
                          hour: '2-digit', minute: '2-digit'
                        }) : "Never"}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground py-2 leading-relaxed">
                    Connect Zoho Recruit to automatically publish job openings from BusinessOS AI and sync applicants back to your candidate master database in real time.
                  </p>
                )}
              </div>
            </div>

            <div className="border-t border-border/50 pt-5 mt-6 flex flex-wrap gap-2 relative">
              {status?.connected ? (
                <>
                  <button
                    onClick={handleTestConnection}
                    disabled={syncing}
                    className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 h-9 px-4 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    <ShieldCheck className="size-4" />
                    Test Connection
                  </button>
                  <button
                    onClick={handleSyncFromZoho}
                    disabled={syncing}
                    className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50"
                    title="Pull all active job openings from Zoho into this platform"
                  >
                    <Download className="size-4" />
                    {syncing ? "Importing..." : "Import from Zoho"}
                  </button>
                  <button
                    onClick={handleConnect}
                    disabled={syncing}
                    className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-xl text-xs font-semibold bg-muted text-foreground hover:bg-muted/80 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    <RefreshCw className="size-4" />
                    Reconnect
                  </button>
                  <button
                    onClick={handleDisconnect}
                    disabled={syncing}
                    className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-xl text-xs font-semibold bg-destructive/10 text-destructive hover:bg-destructive/20 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    <Unplug className="size-4" />
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={syncing}
                  className="w-full inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  <Briefcase className="size-4" />
                  Connect Zoho Recruit
                </button>
              )}
            </div>
          </div>

          {/* Future Provider cards (Naukri, indeed etc) */}
          <div className="bg-card/40 border border-border/50 border-dashed rounded-2xl p-6 flex flex-col justify-between opacity-70">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-muted rounded-xl text-muted-foreground">
                    <HelpCircle className="size-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-muted-foreground">Naukri / Indeed</h3>
                    <p className="text-xs text-muted-foreground">Upcoming Integrations</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold tracking-wide border bg-muted border-border text-muted-foreground">
                  Soon
                </span>
              </div>
              <p className="text-xs text-muted-foreground py-2 leading-relaxed">
                Connect external job boards like Naukri, Indeed, and LinkedIn to sync job postings and applicants globally under one unified recruitment pipeline.
              </p>
            </div>
            <button disabled className="w-full inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold bg-muted text-muted-foreground border border-border mt-6 cursor-not-allowed">
              Configure Integration
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
