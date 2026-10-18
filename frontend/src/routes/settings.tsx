import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Building2,
  CheckCircle2,
  CreditCard,
  MapPin,
  Percent,
  Printer,
  Receipt,
  Save,
  ShieldCheck,
  Store,
  Volume2,
} from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { PageHeader, Panel } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateSettings, useSettings } from "@/services/orderService";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — RestaurantOS" },
      {
        name: "description",
        content:
          "Configure restaurant information, branch options, taxes, KOT printer, and preferences.",
      },
      { property: "og:title", content: "Settings — RestaurantOS" },
      {
        property: "og:description",
        content:
          "Configure restaurant information, branch options, taxes, KOT printer, and preferences.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const settings = useSettings();

  const [form, setForm] = useState({
    name: settings.name,
    tagline: settings.tagline,
    manager: settings.manager,
    currentBranch: settings.currentBranch,
    phone: settings.phone,
    email: settings.email,
    address: settings.address,
    gstin: settings.gstin,
    fssai: settings.fssai,
    taxRate: String(settings.taxRate * 100),
    serviceCharge: String(settings.serviceCharge * 100),
    currencySymbol: settings.currencySymbol,
    autoPrintKOT: settings.autoPrintKOT,
    soundAlerts: settings.soundAlerts,
  });

  const [newBranchName, setNewBranchName] = useState("");

  const handleSave = () => {
    updateSettings({
      name: form.name,
      tagline: form.tagline,
      manager: form.manager,
      currentBranch: form.currentBranch,
      phone: form.phone,
      email: form.email,
      address: form.address,
      gstin: form.gstin,
      fssai: form.fssai,
      taxRate: parseFloat(form.taxRate) / 100 || 0.05,
      serviceCharge: parseFloat(form.serviceCharge) / 100 || 0.05,
      currencySymbol: form.currencySymbol,
      autoPrintKOT: form.autoPrintKOT,
      soundAlerts: form.soundAlerts,
    });
    toast.success("Settings saved successfully", {
      description: "Changes applied across all modules.",
    });
  };

  const handleAddBranch = () => {
    if (!newBranchName.trim()) return;
    if (settings.branches.includes(newBranchName)) {
      toast.error("Branch already exists");
      return;
    }
    updateSettings({
      branches: [...settings.branches, newBranchName.trim()],
    });
    toast.success(`Branch "${newBranchName}" added`);
    setNewBranchName("");
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Configuration"
        title="Restaurant Settings"
        description="Manage restaurant identity, branch locations, tax rules, and POS preferences."
        actions={
          <Button onClick={handleSave}>
            <Save className="size-4 mr-1.5" /> Save changes
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Restaurant Profile */}
        <Panel title="Restaurant Profile & Registration">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Restaurant Business Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tagline / Brand Motto</Label>
              <Input
                value={form.tagline}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>GSTIN</Label>
                <Input
                  value={form.gstin}
                  onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>FSSAI License No.</Label>
                <Input
                  value={form.fssai}
                  onChange={(e) => setForm({ ...form, fssai: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Primary Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Support Email</Label>
                <Input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Headquarters Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
          </div>
        </Panel>

        {/* Taxes & Billing */}
        <Panel title="Taxes & Billing Calculation">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>GST Tax Rate (%)</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={form.taxRate}
                  onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
                />
                <span className="text-[11px] text-muted-foreground">
                  Standard restaurant rate is 5%
                </span>
              </div>
              <div className="space-y-1.5">
                <Label>Service Charge (%)</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={form.serviceCharge}
                  onChange={(e) => setForm({ ...form, serviceCharge: e.target.value })}
                />
                <span className="text-[11px] text-muted-foreground">Applied to Dine-in orders</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Currency Symbol</Label>
                <Input
                  value={form.currencySymbol}
                  onChange={(e) => setForm({ ...form, currencySymbol: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>General Manager</Label>
                <Input
                  value={form.manager}
                  onChange={(e) => setForm({ ...form, manager: e.target.value })}
                />
              </div>
            </div>

            <div className="rounded-lg border p-3.5 space-y-3 bg-surface">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Automatic KOT Printing</div>
                  <div className="text-xs text-muted-foreground">
                    Send kitchen order tickets immediately when an order is punched
                  </div>
                </div>
                <Switch
                  checked={form.autoPrintKOT}
                  onCheckedChange={(v) => setForm({ ...form, autoPrintKOT: v })}
                />
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <div>
                  <div className="text-sm font-medium">Sound Alerts on New Tickets</div>
                  <div className="text-xs text-muted-foreground">
                    Play audio chime on kitchen display when new order arrives
                  </div>
                </div>
                <Switch
                  checked={form.soundAlerts}
                  onCheckedChange={(v) => setForm({ ...form, soundAlerts: v })}
                />
              </div>
            </div>
          </div>
        </Panel>

        {/* Branch Management */}
        <Panel title="Branches & Outlets" className="lg:col-span-2">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-4">
              <div>
                <div className="text-sm font-semibold">Active Operating Branch</div>
                <div className="text-xs text-muted-foreground">
                  Switch the branch profile used for order numbering, taxes, and inventory
                </div>
              </div>
              <Select
                value={form.currentBranch}
                onValueChange={(b) => {
                  setForm({ ...form, currentBranch: b });
                  updateSettings({ currentBranch: b });
                  toast.success(`Switched active branch to ${b}`);
                }}
              >
                <SelectTrigger className="w-64 text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {settings.branches.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">
                Configured Outlets ({settings.branches.length})
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {settings.branches.map((b) => (
                  <div
                    key={b}
                    className="flex items-center justify-between rounded-lg border p-3 bg-card"
                  >
                    <div className="flex items-center gap-2.5">
                      <Store className="size-4 text-primary" />
                      <div>
                        <div className="text-sm font-medium">{b}</div>
                        <div className="text-xs text-muted-foreground">
                          {b === form.currentBranch ? "Currently active" : "Connected outlet"}
                        </div>
                      </div>
                    </div>
                    {b === form.currentBranch && (
                      <span className="text-xs font-semibold text-success flex items-center gap-1">
                        <CheckCircle2 className="size-3.5" /> Active
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Input
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="Add branch location, e.g. Mumbai — Bandra West"
                className="max-w-md text-xs"
              />
              <Button variant="outline" size="sm" onClick={handleAddBranch}>
                Add Outlet
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    </PageContainer>
  );
}
