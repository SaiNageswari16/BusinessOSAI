import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Globe, Shield, Bell, Palette, Database, Check } from "lucide-react";

export function GlobalSettings() {
  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Global Settings</h2>
          <p className="text-muted-foreground text-sm mt-1">Configure system-wide preferences, security, and localization.</p>
        </div>
        <Button size="sm" className="h-9 gap-2 gradient-brand text-white border-0"><Check className="size-4" /> Save Changes</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-1 space-y-1">
          {[
            { id: 'general', icon: Globe, label: 'Localization' },
            { id: 'security', icon: Shield, label: 'Security & MFA' },
            { id: 'notifications', icon: Bell, label: 'Notifications' },
            { id: 'branding', icon: Palette, label: 'Theme & Branding' },
            { id: 'data', icon: Database, label: 'Backup & Retention' }
          ].map((item, idx) => (
            <button key={item.id} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${idx === 0 ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}>
              <item.icon className="size-4" /> {item.label}
            </button>
          ))}
        </div>

        <div className="md:col-span-3 space-y-6">
          <Card className="p-6 space-y-6">
            <h3 className="text-lg font-bold border-b pb-4 mb-4">Localization Settings</h3>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Default Currency</label>
                <Input defaultValue="USD - US Dollar" className="text-sm" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Default Timezone</label>
                <Input defaultValue="UTC (GMT+00:00)" className="text-sm" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">System Language</label>
                <Input defaultValue="English (US)" className="text-sm" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Date Format</label>
                <Input defaultValue="YYYY-MM-DD" className="text-sm" />
              </div>
            </div>

            <h3 className="text-lg font-bold border-b pb-4 mt-8 mb-4">Tax Configuration</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="font-semibold text-sm">Enable GST / VAT Tracking</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Required for Indian, EU, and UK businesses.</div>
                </div>
                <div className="w-10 h-5 bg-primary rounded-full relative">
                  <div className="absolute right-1 top-1 size-3 bg-white rounded-full"></div>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="font-semibold text-sm">Strict Financial Year Locking</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Prevent backdating entries in closed periods.</div>
                </div>
                <div className="w-10 h-5 bg-primary rounded-full relative">
                  <div className="absolute right-1 top-1 size-3 bg-white rounded-full"></div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
