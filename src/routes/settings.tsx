import { createFileRoute } from "@tanstack/react-router";
import { Building2, Check, Moon, RotateCcw, Save, ShieldCheck, Sliders, Sun } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PROFILES } from "@/lib/profiles";
import { BRANCHES, useRestaurantStore } from "@/lib/store";
import type { ProfileId } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  component: SettingsScreen,
});

export function SettingsScreen() {
  const settings = useRestaurantStore((s) => s.settings);
  const staff = useRestaurantStore((s) => s.staff);
  const updateSettings = useRestaurantStore((s) => s.updateSettings);
  const setProfile = useRestaurantStore((s) => s.setProfile);
  const resetDemoData = useRestaurantStore((s) => s.resetDemoData);

  const [restaurantName, setRestaurantName] = useState(settings.restaurant);
  const [gstPct, setGstPct] = useState(String(settings.gstPct));
  const [serviceChargePct, setServiceChargePct] = useState(String(settings.serviceChargePct));
  const [maxDiscountPct, setMaxDiscountPct] = useState(String(settings.maxDiscountPct));

  const activeProfile = PROFILES[settings.profile];

  const handleSaveSettings = () => {
    const gst = Math.max(0, Math.min(28, Number(gstPct) || 5));
    const sc = Math.max(0, Math.min(20, Number(serviceChargePct) || 0));
    const maxDisc = Math.max(0, Math.min(100, Number(maxDiscountPct) || 30));

    updateSettings({
      restaurant: restaurantName.trim() || "Sunrise Restaurant",
      gstPct: gst,
      serviceChargePct: sc,
      maxDiscountPct: maxDisc,
    });
    toast.success("Saved restaurant configuration & tax rules");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Settings"
        title="Restaurant Configuration & Format Profiles"
        subtitle="Adapt RestaurantOS to Fine Dining, Casual Dining, QSR, Cafe, or Cloud Kitchen without losing data"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetDemoData();
                setRestaurantName("Sunrise Restaurant");
                setGstPct("5");
                setServiceChargePct("0");
                setMaxDiscountPct("30");
                toast.success("Restored initial seeded demo state");
              }}
              className="gap-1.5 text-destructive"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Demo Data
            </Button>
            <Button size="sm" onClick={handleSaveSettings} className="gap-1.5">
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
          </>
        }
      />

      {/* Section 1: Restaurant-Type Profile Adaptation */}
      <div className="surface p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold text-foreground">
            Restaurant Format Profile Adaptation
          </h2>
          <p className="text-xs text-muted-foreground">
            Switching format adapts top-navigation modules and service emphasis while preserving all
            existing orders, tables, and kitchen records.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {(Object.keys(PROFILES) as ProfileId[]).map((pid) => {
            const prof = PROFILES[pid];
            const isSelected = settings.profile === pid;
            return (
              <button
                key={pid}
                type="button"
                onClick={() => {
                  setProfile(pid);
                  toast.success(`Activated ${prof.label} profile`);
                }}
                className={cn(
                  "rounded-xl border-2 p-4 text-left transition-all flex flex-col justify-between gap-3",
                  isSelected
                    ? "border-primary bg-primary/8 shadow-xs"
                    : "border-border bg-card hover:border-primary/40",
                )}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground">{prof.label}</span>
                    {isSelected && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                    {prof.blurb}
                  </p>
                </div>

                <div className="space-y-1.5 border-t border-border pt-2.5">
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                    Focus: {prof.focus}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {prof.services.map((srv) => (
                      <Badge key={srv} variant="secondary" className="text-[10px] uppercase">
                        {srv}
                      </Badge>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-semibold text-foreground">
              Enabled Modules for {activeProfile.label}:
            </span>{" "}
            <span className="text-muted-foreground">
              {activeProfile.modules.map((m) => m.toUpperCase()).join(" · ")}
            </span>
          </div>
          <Badge variant="outline">{activeProfile.modules.length} Active Modules</Badge>
        </div>
      </div>

      {/* Section 2: Restaurant & Branch + Tax & Billing Rules */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="surface p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Building2 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Restaurant & Branch Identity</h2>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Restaurant Name</Label>
              <Input
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Active Branch</Label>
              <Select
                value={settings.branch}
                onValueChange={(v) => {
                  updateSettings({ branch: v });
                  toast.success(`Switched branch to ${v}`);
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BRANCHES.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-foreground">Dark Mode Theme</div>
                <div className="text-[11px] text-muted-foreground">
                  Switch high-contrast dark surfaces across POS, Floor Plan & KDS
                </div>
              </div>
              <div className="flex items-center gap-2">
                {settings.dark ? (
                  <Moon className="h-4 w-4 text-primary" />
                ) : (
                  <Sun className="h-4 w-4 text-warning" />
                )}
                <Switch
                  checked={settings.dark}
                  onCheckedChange={(v) => updateSettings({ dark: v })}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="surface p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Sliders className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">
              Tax (GST), Billing & Kitchen Preferences
            </h2>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">GST Rate (%)</Label>
              <Input
                type="number"
                value={gstPct}
                onChange={(e) => setGstPct(e.target.value)}
                className="h-8 text-xs tabular"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Service Charge (%)</Label>
              <Input
                type="number"
                value={serviceChargePct}
                onChange={(e) => setServiceChargePct(e.target.value)}
                className="h-8 text-xs tabular"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max Discount (%)</Label>
              <Input
                type="number"
                value={maxDiscountPct}
                onChange={(e) => setMaxDiscountPct(e.target.value)}
                className="h-8 text-xs tabular"
              />
            </div>
          </div>

          <div className="space-y-3 border-t border-border pt-3 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-foreground">Auto-Print Station KOT Slips</div>
                <div className="text-[11px] text-muted-foreground">
                  Automatically trigger thermal slip print when POS sends order to kitchen
                </div>
              </div>
              <Switch
                checked={settings.printKot}
                onCheckedChange={(v) => updateSettings({ printKot: v })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-foreground">Low-Stock Kitchen Alerts</div>
                <div className="text-[11px] text-muted-foreground">
                  Generate header notifications when recipe consumption drops stock below reorder
                </div>
              </div>
              <Switch
                checked={settings.notifyLowStock}
                onCheckedChange={(v) => updateSettings({ notifyLowStock: v })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Users, Roles & Access Matrix */}
      <div className="surface p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-success" />
          <h2 className="text-sm font-bold text-foreground">Role-Based Access Control (RBAC)</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          {[
            {
              role: "Restaurant Manager",
              access: "Full access: Dashboard, POS, Discounts, Reports, Settings",
              count: staff.filter((s) => s.role.includes("Manager")).length,
            },
            {
              role: "Chefs & Kitchen Brigade",
              access: "Kitchen (KOT, KDS), Menu Availability, Recipe & Wastage",
              count: staff.filter((s) => s.role.includes("Chef")).length,
            },
            {
              role: "Captains & Servers",
              access: "Operations Floor Plan, POS Ordering, Reservations",
              count: staff.filter((s) => s.role.includes("Server") || s.role.includes("Captain"))
                .length,
            },
            {
              role: "Cashier & Store Keeper",
              access: "POS Billing, Order Settlement, Inventory & Purchase Orders",
              count: staff.filter((s) => s.role.includes("Cashier") || s.role.includes("Store"))
                .length,
            },
          ].map((r) => (
            <div key={r.role} className="rounded-xl border border-border bg-muted/25 p-3 space-y-1">
              <div className="flex items-center justify-between font-bold text-foreground">
                <span>{r.role}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {r.count} staff
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">{r.access}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
