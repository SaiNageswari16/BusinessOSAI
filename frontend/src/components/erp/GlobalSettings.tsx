import { useState, useEffect, useCallback } from "react";
import { systemSettingsApi, SystemSetting } from "../../lib/api-client";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Settings, Globe, Shield, Bell, Palette, Database, Check, Loader2 } from "lucide-react";

const CATEGORIES = [
  { id: "general", icon: Globe, label: "Localization" },
  { id: "security", icon: Shield, label: "Security & MFA" },
  { id: "notifications", icon: Bell, label: "Notifications" },
  { id: "branding", icon: Palette, label: "Theme & Branding" },
  { id: "data", icon: Database, label: "Backup & Retention" },
];

const DEFAULT_SETTINGS: { key: string; label: string; category: string; type: "text" | "toggle" | "select"; options?: string[] }[] = [
  { key: "default_currency", label: "Default Currency", category: "general", type: "text" },
  { key: "default_timezone", label: "Default Timezone", category: "general", type: "text" },
  { key: "system_language", label: "System Language", category: "general", type: "text" },
  { key: "date_format", label: "Date Format", category: "general", type: "text" },
  { key: "enable_gst_vat", label: "Enable GST / VAT Tracking", category: "general", type: "toggle" },
  { key: "strict_fy_locking", label: "Strict Financial Year Locking", category: "general", type: "toggle" },
  { key: "mfa_required", label: "Require MFA for all users", category: "security", type: "toggle" },
  { key: "session_timeout_hours", label: "Session Timeout (hours)", category: "security", type: "text" },
  { key: "password_expiry_days", label: "Password Expiry (days)", category: "security", type: "text" },
  { key: "email_notifications", label: "Email Notifications", category: "notifications", type: "toggle" },
  { key: "sms_notifications", label: "SMS Notifications", category: "notifications", type: "toggle" },
  { key: "primary_color", label: "Primary Brand Color", category: "branding", type: "text" },
  { key: "company_logo_url", label: "Company Logo URL", category: "branding", type: "text" },
  { key: "backup_frequency", label: "Backup Frequency", category: "data", type: "select", options: ["daily", "weekly", "monthly"] },
  { key: "data_retention_days", label: "Data Retention (days)", category: "data", type: "text" },
];

export function GlobalSettings() {
  const [activeCategory, setActiveCategory] = useState("general");
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await systemSettingsApi.list();
      setSettings(res);
      // Seed local values from server
      const vals: Record<string, string> = {};
      res.forEach(s => { vals[s.key] = s.value ?? ""; });
      setLocalValues(vals);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to load settings"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true); setSaved(false); setError("");
    const categoryKeys = DEFAULT_SETTINGS.filter(s => s.category === activeCategory).map(s => s.key);
    const toSave = categoryKeys.map(key => ({
      key, value: localValues[key] ?? null, category: activeCategory,
    }));
    try {
      await systemSettingsApi.batchUpdate(toSave);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to save"); }
    finally { setSaving(false); }
  };

  const categorySetting = DEFAULT_SETTINGS.filter(s => s.category === activeCategory);

  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Global Settings</h2>
          <p className="text-muted-foreground text-sm mt-1">Configure system-wide preferences, security, and localization.</p>
        </div>
        <Button size="sm" className="h-9 gap-2 gradient-brand text-white border-0" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {saved ? "Saved!" : "Save Changes"}
        </Button>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-500/10 text-red-600 text-sm border border-red-500/20">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-1 space-y-1">
          {CATEGORIES.map((item, idx) => (
            <button key={item.id} onClick={() => setActiveCategory(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${activeCategory === item.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}>
              <item.icon className="size-4" /> {item.label}
            </button>
          ))}
        </div>

        <div className="md:col-span-3 space-y-6">
          <Card className="p-6 space-y-6">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-primary" /></div>
            ) : (
              <>
                <h3 className="text-lg font-bold border-b pb-4 mb-4">
                  {CATEGORIES.find(c => c.id === activeCategory)?.label} Settings
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  {categorySetting.map(setting => {
                    const val = localValues[setting.key] ?? "";
                    if (setting.type === "toggle") {
                      const isOn = val === "true" || val === "1" || val === "yes";
                      return (
                        <div key={setting.key} className="col-span-2 flex items-center justify-between p-4 border rounded-lg">
                          <div className="font-semibold text-sm">{setting.label}</div>
                          <button type="button" onClick={() => setLocalValues(prev => ({ ...prev, [setting.key]: isOn ? "false" : "true" }))}
                            className={`w-10 h-5 rounded-full relative transition-colors ${isOn ? "bg-primary" : "bg-muted-foreground/30"}`}>
                            <div className={`absolute top-1 size-3 bg-white rounded-full transition-all ${isOn ? "right-1" : "left-1"}`} />
                          </button>
                        </div>
                      );
                    }
                    if (setting.type === "select") {
                      return (
                        <div key={setting.key} className="space-y-2">
                          <label className="text-xs font-semibold text-muted-foreground uppercase">{setting.label}</label>
                          <select value={val} onChange={e => setLocalValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
                            className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                            {setting.options?.map(o => <option key={o}>{o}</option>)}
                          </select>
                        </div>
                      );
                    }
                    return (
                      <div key={setting.key} className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase">{setting.label}</label>
                        <Input value={val} onChange={e => setLocalValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
                          placeholder={`Enter ${setting.label.toLowerCase()}...`} className="text-sm" />
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
