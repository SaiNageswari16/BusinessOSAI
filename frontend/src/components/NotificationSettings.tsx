import React, { useState, useEffect } from "react";
import { Bell, Smartphone, Globe, Monitor, Target, Save, Loader2, Info } from "lucide-react";
import { liveNotificationsApi } from "@/lib/api-client";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";

export function NotificationSettings() {
    const { currency, formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [pollingInterval, setPollingInterval] = useState(6);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["crm", "hrms", "pos", "inventory", "system"]);

  // Fetch settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const cfg = await liveNotificationsApi.getSettings();
        if (cfg) {
          setEnabled(cfg.enabled);
          setPollingInterval(cfg.polling_interval);
          setSelectedCategories(cfg.categories || []);
        }
      } catch (err) {
        toast.error("Failed to load notification settings from backend.");
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleToggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await liveNotificationsApi.updateSettings({
        enabled,
        categories: selectedCategories,
        polling_interval: pollingInterval,
      });
      toast.success("Notification configurations saved successfully!");
    } catch (err) {
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Bell className="size-6 text-primary" /> System Notification Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure real-time system alerts, notification frequencies, and active modules to stream live dashboard updates.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Global Enable */}
        <div className="glass-panel p-5 rounded-xl border border-border/50 bg-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Global Live Alerts</h3>
              <p className="text-xs text-muted-foreground">Toggle real-time popup toasts and notification badges system-wide.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          <div className="flex items-start gap-2 bg-blue-500/10 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 p-3 rounded-lg text-xs leading-relaxed">
            <Info className="size-4 shrink-0 mt-0.5" />
            <span>Turning this off stops dynamic polling immediately, reducing client-server payload requests to zero.</span>
          </div>
        </div>

        {enabled && (
          <>
            {/* Polling Interval */}
            <div className="glass-panel p-5 rounded-xl border border-border/50 bg-card space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Real-time Polling Speed</h3>
                <p className="text-xs text-muted-foreground">Adjust how frequently the client app pulls new notifications from the database.</p>
              </div>

              <div className="space-y-2">
                <select
                  value={pollingInterval}
                  onChange={(e) => setPollingInterval(Number(e.target.value))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                >
                  <option value={3}>Ultra fast (3 seconds)</option>
                  <option value={6}>Standard (6 seconds) - Recommended</option>
                  <option value={10}>Balanced (10 seconds)</option>
                  <option value={30}>Eco (30 seconds)</option>
                  <option value={60}>Slow (1 minute)</option>
                </select>
                <p className="text-[10px] text-muted-foreground">
                  Shorter intervals provide a more responsive real-time checkout/live dashboard feeling.
                </p>
              </div>
            </div>

            {/* Active Modules Configuration */}
            <div className="glass-panel p-5 rounded-xl border border-border/50 bg-card space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Filter Event Categories</h3>
                <p className="text-xs text-muted-foreground">Choose which system events trigger push notifications.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { id: "pos", label: "POS Orders & Refunds", desc: "Triggers on counter checkout submissions", icon: Smartphone, color: "text-emerald-500", bg: "bg-emerald-500/10" },
                  { id: "crm", label: "CRM Leads & Tickets", desc: "Triggers on new leads and client complaints", icon: Globe, color: "text-blue-500", bg: "bg-blue-500/10" },
                  { id: "hrms", label: "HR Recruitment", desc: "Triggers on job posts and candidate applications", icon: Target, color: "text-amber-500", bg: "bg-amber-500/10" },
                  { id: "inventory", label: "Inventory GRN Operations", desc: "Triggers on committed stock receipts", icon: Monitor, color: "text-purple-500", bg: "bg-purple-500/10" },
                ].map((item) => {
                  const Icon = item.icon;
                  const isChecked = selectedCategories.includes(item.id);
                  return (
                    <div 
                      key={item.id}
                      onClick={() => handleToggleCategory(item.id)}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                        isChecked ? "border-primary bg-primary/[0.03]" : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${item.bg} shrink-0`}>
                        <Icon className={`size-4 ${item.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{item.desc}</p>
                      </div>
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        readOnly
                        className="size-3.5 mt-1 rounded text-primary border-border focus:ring-primary"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Save Bar */}
        <div className="flex justify-end gap-2 pt-2">
          <button 
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 px-5 py-2.5 gradient-brand text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity cursor-pointer border-none shadow-elegant"
          >
            {saving ? (
              <><Loader2 className="size-4 animate-spin" /> Saving Settings...</>
            ) : (
              <><Save className="size-4" /> Save Configurations</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
