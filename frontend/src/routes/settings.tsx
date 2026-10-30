import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Building2,
  Check,
  CheckCircle2,
  ChefHat,
  CopyPlus,
  FileText,
  Layers,
  Percent,
  Plus,
  Printer,
  QrCode,
  Receipt,
  RefreshCw,
  RotateCcw,
  Save,
  Sliders,
  Sparkles,
  Store,
  Trash2,
  Wallet,
} from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { PageHeader, Panel } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  activateOrgReceiptTemplate,
  deleteOrgReceiptTemplate,
  organizationService,
  resetReceiptTemplate,
  saveReceiptTemplateToBackend,
  switchBranch,
  syncReceiptTemplatesFromBackend,
  updateReceiptTemplate,
  updateSettings,
  useOrgReceiptTemplates,
  useReceiptTemplate,
  useSettings,
  type ReceiptTemplate,
} from "@/services/orderService";
import { getActiveOutlet, getActiveTenant } from "@/lib/auth-tokens";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PrintersSettingsSection } from "@/components/common/PrintersSettings";
import { FinanceOpsSection } from "@/components/common/FinanceOps";
import { SubscriptionsSection } from "@/components/common/Subscriptions";

export const Route = createFileRoute("/settings")({
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search["tab"] === "string" ? search["tab"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Organization & Thermal Receipt Settings — RestaurantOS" },
      {
        name: "description",
        content:
          "Configure per-organization thermal receipts (80mm/58mm ESC/POS), restaurant branches, GST tax rules, and KDS preferences.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const search = Route.useSearch();
  const settings = useSettings();
  const activeTemplate = useReceiptTemplate();
  const savedTemplates = useOrgReceiptTemplates();

  const [mainTab, setMainTab] = useState<string>(search?.tab || "receipts");
  const [editorTab, setEditorTab] = useState<"hardware" | "branding" | "fields" | "taxes" | "footer">("branding");
  const [previewMode, setPreviewMode] = useState<"receipt" | "kot">("receipt");
  const [savingTpl, setSavingTpl] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  useEffect(() => {
    if (search?.tab) {
      setMainTab(search.tab);
    }
  }, [search?.tab]);

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

  useEffect(() => {
    setForm({
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
  }, [settings]);

  const [newBranchName, setNewBranchName] = useState("");

  const handleSaveGeneral = () => {
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
    toast.success("Organization & Outlet settings saved to PostgreSQL", {
      description: "Applied across POS, Kitchen KDS, Billing, and Thermal Receipts.",
    });
  };

  const handleAddBranch = async () => {
    if (!newBranchName.trim()) return;
    if (settings.branches.includes(newBranchName.trim())) {
      toast.error("Branch already exists");
      return;
    }
    const cleanName = newBranchName.trim();
    updateSettings({
      branches: [...settings.branches, cleanName],
    });
    try {
      await organizationService.createOutlet({
        name: cleanName,
        code: cleanName.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() || "OUTLET",
        phone: form.phone,
        address: form.address,
      });
    } catch {
      // Non-blocking if user lacks create-outlet permission
    }
    toast.success(`Branch "${cleanName}" created for this organization`);
    setNewBranchName("");
  };

  const patchTpl = <K extends keyof ReceiptTemplate>(key: K, val: ReceiptTemplate[K]) => {
    updateReceiptTemplate({ [key]: val });
  };

  const handleSaveReceiptToDb = async (asNew = false) => {
    setSavingTpl(true);
    try {
      const title =
        asNew && newPresetName.trim()
          ? newPresetName.trim()
          : activeTemplate.templateName || `${activeTemplate.orgName} (${activeTemplate.paperWidth})`;
      await saveReceiptTemplateToBackend(
        { ...activeTemplate, templateName: title },
        title,
        true,
        asNew
      );
      if (asNew) setNewPresetName("");
      toast.success("Thermal Receipt Template Saved Per Organization!", {
        description: `Persisted "${title}" (${activeTemplate.paperWidth}) in PostgreSQL billing service.`,
      });
    } catch {
      toast.error("Failed to save receipt template");
    } finally {
      setSavingTpl(false);
    }
  };

  const handleCopyOrgProfileToReceipt = () => {
    updateReceiptTemplate({
      orgName: form.name,
      brandName: form.name,
      tagline: form.tagline,
      subtitle: form.tagline,
      branchName: form.currentBranch,
      address: form.address,
      phone: form.phone,
      email: form.email,
      gstin: form.gstin,
      fssai: form.fssai,
    });
    toast.success("Synced Organization Profile into Thermal Receipt Header");
  };

  const activeTenantId = getActiveTenant() || "default-org";
  const activeOutletId = getActiveOutlet() || "default-outlet";

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Per-Organization Configuration"
        title="Restaurant & Thermal Receipt Settings"
        description="Customize 80mm/58mm ESC/POS thermal receipts per organization, manage outlets, and configure POS-to-Kitchen flow."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {mainTab === "receipts" ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.print()}
                  className="gap-1.5"
                >
                  <Printer className="size-4" /> Test Print ({activeTemplate.paperWidth})
                </Button>
                <Button
                  size="sm"
                  disabled={savingTpl}
                  onClick={() => void handleSaveReceiptToDb(false)}
                  className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Save className="size-4" />
                  {savingTpl ? "Saving to DB…" : "Save Org Receipt Template"}
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={handleSaveGeneral} className="gap-1.5">
                <Save className="size-4" /> Save Organization Settings
              </Button>
            )}
          </div>
        }
      />

      <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
          <TabsTrigger value="receipts" className="gap-1.5 text-xs font-semibold">
            <Receipt className="size-3.5" /> Thermal Receipts & KOT
          </TabsTrigger>
          <TabsTrigger value="profile" className="gap-1.5 text-xs font-semibold">
            <Building2 className="size-3.5" /> Organization
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-1.5 text-xs font-semibold">
            <Percent className="size-3.5" /> Taxes & Billing
          </TabsTrigger>
          <TabsTrigger value="printers" className="gap-1.5 text-xs font-semibold">
            <Printer className="size-3.5" /> Printers & Devices
          </TabsTrigger>
          <TabsTrigger value="finance" className="gap-1.5 text-xs font-semibold">
            <Wallet className="size-3.5" /> Finance Ops
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="gap-1.5 text-xs font-semibold">
            <Layers className="size-3.5" /> Subscriptions
          </TabsTrigger>
        </TabsList>

        {/* =====================================================================
            TAB 1: DEDICATED PER-ORGANIZATION THERMAL RECEIPT & KOT STUDIO
           ===================================================================== */}
        <TabsContent value="receipts" className="space-y-6">
          {/* Organization Scope & Saved Presets Bar */}
          <div className="rounded-xl border bg-card p-4 shadow-2xs">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 border border-indigo-200">
                    <Sparkles className="size-3" /> Organization Scoped
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    {activeTemplate.orgName || settings.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    · Branch: <strong className="text-foreground">{settings.currentBranch}</strong>
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    Org: {activeTenantId.slice(0, 8)}… · Outlet: {activeOutletId.slice(0, 8)}…
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Templates are saved per organization in PostgreSQL (<code className="text-[11px]">/api/v1/billing/print-templates</code>) and automatically applied to POS bills, PDFs, and raw ESC/POS printers.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyOrgProfileToReceipt}
                  className="h-8 text-xs gap-1.5"
                >
                  <Building2 className="size-3.5" /> Sync from Org Profile
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void syncReceiptTemplatesFromBackend();
                    toast.success("Reloaded organization templates from PostgreSQL");
                  }}
                  className="h-8 text-xs gap-1.5"
                >
                  <RefreshCw className="size-3.5" /> Sync DB
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    resetReceiptTemplate();
                    toast.info("Reset to default thermal template");
                  }}
                  className="h-8 text-xs gap-1.5 text-muted-foreground"
                >
                  <RotateCcw className="size-3.5" /> Reset Default
                </Button>
              </div>
            </div>

            {/* Saved Organization Templates Library */}
            <div className="mt-4 border-t pt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground mr-1">
                  Saved Org Templates ({savedTemplates.length}):
                </span>
                {savedTemplates.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">
                    Using active org template — click "Save Org Receipt Template" to store named presets in PostgreSQL.
                  </span>
                ) : (
                  savedTemplates.map((st) => (
                    <div
                      key={st.id}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition",
                        st.active
                          ? "border-indigo-600 bg-indigo-50/80 font-bold text-indigo-950"
                          : "bg-background hover:bg-accent"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          void activateOrgReceiptTemplate(st.id);
                          toast.success(`Activated "${st.name}" (${st.paperSize})`);
                        }}
                        className="flex items-center gap-1.5 text-left"
                      >
                        {st.active && <Check className="size-3 text-indigo-600" />}
                        <span>{st.name}</span>
                        <span className="rounded bg-slate-200/80 px-1 py-0.2 font-mono text-[10px] text-slate-700">
                          {st.paperSize}
                        </span>
                      </button>
                      {!st.active && (
                        <button
                          type="button"
                          onClick={() => {
                            void deleteOrgReceiptTemplate(st.id);
                            toast.info(`Deleted template "${st.name}"`);
                          }}
                          className="ml-1 text-slate-400 hover:text-rose-600"
                          title="Delete template"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <Input
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="New preset name (e.g. Counter 58mm)…"
                  className="h-8 w-52 text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!newPresetName.trim() || savingTpl}
                  onClick={() => void handleSaveReceiptToDb(true)}
                  className="h-8 text-xs gap-1 shrink-0"
                >
                  <CopyPlus className="size-3.5" /> Save Preset
                </Button>
              </div>
            </div>
          </div>

          {/* Main Studio Grid: Left Customizer Controls (7 cols) + Right Live Preview (5 cols) */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left Side: Detailed Per-Org Thermal Controls */}
            <div className="lg:col-span-7 space-y-4">
              <Panel
                title="Thermal Receipt & KOT Configuration"
                subtitle="Every toggle and text field is saved per organization and rendered on 80mm/58mm slips."
              >
                <Tabs value={editorTab} onValueChange={(v: any) => setEditorTab(v)} className="space-y-4">
                  <TabsList className="grid grid-cols-5 w-full">
                    <TabsTrigger value="branding" className="text-xs">1. Branding</TabsTrigger>
                    <TabsTrigger value="hardware" className="text-xs">2. Paper & Print</TabsTrigger>
                    <TabsTrigger value="fields" className="text-xs">3. Order & KOT</TabsTrigger>
                    <TabsTrigger value="taxes" className="text-xs">4. GST & Loyalty</TabsTrigger>
                    <TabsTrigger value="footer" className="text-xs">5. QR & Footer</TabsTrigger>
                  </TabsList>

                  {/* 1. BRANDING & TAX HEADER */}
                  <TabsContent value="branding" className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Template Preset Name</Label>
                        <Input
                          value={activeTemplate.templateName || ""}
                          onChange={(e) => patchTpl("templateName", e.target.value)}
                          placeholder="Standard 80mm GST Thermal Slip"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Invoice Banner Heading</Label>
                        <Input
                          value={activeTemplate.headerGreetingText}
                          onChange={(e) => patchTpl("headerGreetingText", e.target.value)}
                          placeholder="ORIGINAL TAX INVOICE"
                          className="h-8 text-xs font-mono uppercase"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Restaurant / Brand Name *</Label>
                        <Input
                          value={activeTemplate.orgName}
                          onChange={(e) => patchTpl("orgName", e.target.value)}
                          placeholder="e.g. Sunrise Restaurant & Bar"
                          className="h-8 text-xs font-semibold"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Tagline / Cuisine Subtitle</Label>
                        <Input
                          value={activeTemplate.tagline}
                          onChange={(e) => patchTpl("tagline", e.target.value)}
                          placeholder="e.g. Authentic Flavours & Hospitality"
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Branch / Outlet Name</Label>
                        <Input
                          value={activeTemplate.branchName}
                          onChange={(e) => patchTpl("branchName", e.target.value)}
                          placeholder="e.g. Banjara Hills Flagship"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Outlet Phone Number</Label>
                        <Input
                          value={activeTemplate.phone}
                          onChange={(e) => patchTpl("phone", e.target.value)}
                          placeholder="+91 40 2335 8899"
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Full Outlet Address (Printed on Header)</Label>
                      <Input
                        value={activeTemplate.address}
                        onChange={(e) => patchTpl("address", e.target.value)}
                        placeholder="Road No. 12, Banjara Hills, Hyderabad, Telangana 500034"
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">GSTIN Registration Number</Label>
                        <Input
                          value={activeTemplate.gstin}
                          onChange={(e) => patchTpl("gstin", e.target.value.toUpperCase())}
                          placeholder="36AABCS1429B1Z1"
                          className="h-8 text-xs font-mono uppercase"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">FSSAI License Number</Label>
                        <Input
                          value={activeTemplate.fssai}
                          onChange={(e) => patchTpl("fssai", e.target.value)}
                          placeholder="13621014000452"
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                      <ToggleCard
                        title="Show Brand Monogram / Logo"
                        desc="Print crest/logo box at the top of the slip"
                        checked={activeTemplate.showLogo}
                        onChange={(v) => patchTpl("showLogo", v)}
                      />
                      <ToggleCard
                        title="Show Tax Invoice Banner"
                        desc="High-contrast ORIGINAL TAX INVOICE bar"
                        checked={activeTemplate.showHeaderGreeting}
                        onChange={(v) => patchTpl("showHeaderGreeting", v)}
                      />
                      <ToggleCard
                        title="Show Store Address & Phone"
                        desc="Print branch location and contact number"
                        checked={activeTemplate.showAddress}
                        onChange={(v) => {
                          patchTpl("showAddress", v);
                          patchTpl("showPhone", v);
                        }}
                      />
                      <ToggleCard
                        title="Show GSTIN & FSSAI Numbers"
                        desc="Mandatory statutory tax & food safety IDs"
                        checked={activeTemplate.showGstin}
                        onChange={(v) => {
                          patchTpl("showGstin", v);
                          patchTpl("showFssai", v);
                        }}
                      />
                    </div>
                  </TabsContent>

                  {/* 2. PAPER WIDTH & HARDWARE SETTINGS */}
                  <TabsContent value="hardware" className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Thermal Roll Paper Width</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => patchTpl("paperWidth", "80mm")}
                          className={cn(
                            "flex flex-col items-start rounded-xl border p-3.5 text-left transition",
                            activeTemplate.paperWidth === "80mm"
                              ? "border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600"
                              : "hover:bg-accent"
                          )}
                        >
                          <div className="flex w-full items-center justify-between">
                            <span className="text-sm font-bold">80mm Standard Roll (3.15")</span>
                            {activeTemplate.paperWidth === "80mm" && (
                              <CheckCircle2 className="size-4 text-indigo-600" />
                            )}
                          </div>
                          <span className="mt-1 text-xs text-muted-foreground">
                            48 characters per line · Ideal for Epson TM-T82, Posiflex, TVS RP3200
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => patchTpl("paperWidth", "58mm")}
                          className={cn(
                            "flex flex-col items-start rounded-xl border p-3.5 text-left transition",
                            activeTemplate.paperWidth === "58mm"
                              ? "border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600"
                              : "hover:bg-accent"
                          )}
                        >
                          <div className="flex w-full items-center justify-between">
                            <span className="text-sm font-bold">58mm Compact Roll (2.28")</span>
                            {activeTemplate.paperWidth === "58mm" && (
                              <CheckCircle2 className="size-4 text-indigo-600" />
                            )}
                          </div>
                          <span className="mt-1 text-xs text-muted-foreground">
                            32 characters per line · Ideal for portable Bluetooth & handheld POS printers
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Typography Density / Font Size</Label>
                        <Select
                          value={activeTemplate.fontSize}
                          onValueChange={(v: "compact" | "normal" | "large") => patchTpl("fontSize", v)}
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="compact">Compact (Paper Saver · 10px)</SelectItem>
                            <SelectItem value="normal">Normal (Standard · 11px)</SelectItem>
                            <SelectItem value="large">Large (High Visibility · 12.5px)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Default Print Output Mode</Label>
                        <Select
                          value={activeTemplate.printMode || "browser_html"}
                          onValueChange={(v: "browser_html" | "backend_pdf" | "escpos_raw") =>
                            patchTpl("printMode", v)
                          }
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="browser_html">Browser Print Dialog (80mm/58mm CSS)</SelectItem>
                            <SelectItem value="backend_pdf">Server Thermal PDF (fpdf2 Engine)</SelectItem>
                            <SelectItem value="escpos_raw">Raw ESC/POS Byte Stream (Port 9100)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <ToggleCard
                        title="Auto-Print Receipt on Settle"
                        desc="Automatically trigger thermal print when bill is paid"
                        checked={Boolean(activeTemplate.autoPrintOnSettle)}
                        onChange={(v) => patchTpl("autoPrintOnSettle", v)}
                      />
                      <ToggleCard
                        title="Auto-Print KOT on Fire"
                        desc="Automatically trigger Kitchen Order Ticket for stations"
                        checked={Boolean(activeTemplate.autoPrintKotOnFire)}
                        onChange={(v) => patchTpl("autoPrintKotOnFire", v)}
                      />
                    </div>
                  </TabsContent>

                  {/* 3. ORDER METADATA & LINE ITEMS */}
                  <TabsContent value="fields" className="space-y-3 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <ToggleCard
                        title="Show Token Number Box"
                        desc="Large bold #Token callout for QSR & takeaway pickup"
                        checked={activeTemplate.showTokenNo}
                        onChange={(v) => patchTpl("showTokenNo", v)}
                      />
                      <ToggleCard
                        title="Show Table Number"
                        desc="Display floor table code (e.g., T1, T4) or Counter"
                        checked={activeTemplate.showTable}
                        onChange={(v) => patchTpl("showTable", v)}
                      />
                      <ToggleCard
                        title="Show Captain / Waiter Name"
                        desc="Print steward/server name assigned to the table"
                        checked={activeTemplate.showWaiter}
                        onChange={(v) => patchTpl("showWaiter", v)}
                      />
                      <ToggleCard
                        title="Show Customer Name & Phone"
                        desc="Print guest name and mobile number on invoice"
                        checked={activeTemplate.showCustomerInfo}
                        onChange={(v) => patchTpl("showCustomerInfo", v)}
                      />
                      <ToggleCard
                        title="Show Customer B2B GSTIN"
                        desc="Display buyer GSTIN for corporate tax credit claims"
                        checked={activeTemplate.showCustomerGstin}
                        onChange={(v) => patchTpl("showCustomerGstin", v)}
                      />
                      <ToggleCard
                        title="Show Item Modifiers & Add-ons"
                        desc="Print chosen variants/add-ons below each dish"
                        checked={activeTemplate.showItemModifiers}
                        onChange={(v) => patchTpl("showItemModifiers", v)}
                      />
                      <ToggleCard
                        title="Show Chef / Spice Notes"
                        desc="Print special instructions (e.g. less spicy, Jain)"
                        checked={activeTemplate.showItemNotes}
                        onChange={(v) => patchTpl("showItemNotes", v)}
                      />
                      <ToggleCard
                        title="Show Cashier / Register Info"
                        desc="Print billing terminal & cashier identifier"
                        checked={activeTemplate.showCashier}
                        onChange={(v) => patchTpl("showCashier", v)}
                      />
                    </div>
                  </TabsContent>

                  {/* 4. GST BREAKDOWN, SERVICE CHARGE & LOYALTY */}
                  <TabsContent value="taxes" className="space-y-3.5 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <ToggleCard
                        title="Split CGST (2.5%) & SGST (2.5%)"
                        desc="Show separate central & state GST rows per Indian GST norms"
                        checked={activeTemplate.showTaxBreakup}
                        onChange={(v) => patchTpl("showTaxBreakup", v)}
                      />
                      <ToggleCard
                        title="Show Service Charge Line"
                        desc="Display Dine-in service charge row when applicable"
                        checked={activeTemplate.showServiceCharge}
                        onChange={(v) => patchTpl("showServiceCharge", v)}
                      />
                      <ToggleCard
                        title="Show Discount Line"
                        desc="Display promotional or loyalty discount deductions"
                        checked={activeTemplate.showDiscountLine}
                        onChange={(v) => patchTpl("showDiscountLine", v)}
                      />
                      <ToggleCard
                        title="Show Round-Off Adjustment"
                        desc="Display nearest-rupee rounding difference"
                        checked={activeTemplate.showRoundOff}
                        onChange={(v) => patchTpl("showRoundOff", v)}
                      />
                      <ToggleCard
                        title="Show Payment Method Stamp"
                        desc="Print '✓ PAID VIA UPI / CARD / CASH' verification bar"
                        checked={activeTemplate.showPaymentMode}
                        onChange={(v) => patchTpl("showPaymentMode", v)}
                      />
                      <ToggleCard
                        title="Show Customer Loyalty Summary"
                        desc="Print points earned on this bill & total reward balance"
                        checked={activeTemplate.showLoyaltyPoints}
                        onChange={(v) => patchTpl("showLoyaltyPoints", v)}
                      />
                    </div>

                    {activeTemplate.showLoyaltyPoints && (
                      <div className="rounded-lg border bg-indigo-50/40 p-3 flex items-center justify-between gap-4">
                        <div>
                          <div className="text-xs font-bold text-indigo-950">
                            Loyalty Reward Earn Rate (% of Subtotal)
                          </div>
                          <div className="text-[11px] text-indigo-700">
                            Points awarded per order and displayed in the receipt loyalty box
                          </div>
                        </div>
                        <Input
                          type="number"
                          min={1}
                          max={25}
                          value={activeTemplate.loyaltyEarnRatePct}
                          onChange={(e) =>
                            patchTpl("loyaltyEarnRatePct", Number(e.target.value) || 5)
                          }
                          className="h-8 w-20 text-xs font-bold text-center bg-white"
                        />
                      </div>
                    )}
                  </TabsContent>

                  {/* 5. UPI QR CODE & FOOTER */}
                  <TabsContent value="footer" className="space-y-3.5 pt-2">
                    <ToggleCard
                      title="Print Dynamic UPI Payment / Feedback QR Code"
                      desc="Embeds scannable UPI QR on both browser thermal slips, PDFs, and ESC/POS GS ( k printers"
                      checked={activeTemplate.showQrCode}
                      onChange={(v) => patchTpl("showQrCode", v)}
                    />

                    {activeTemplate.showQrCode && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border bg-surface p-3">
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold">Merchant UPI VPA ID</Label>
                          <Input
                            value={activeTemplate.upiId}
                            onChange={(e) => patchTpl("upiId", e.target.value)}
                            placeholder="merchant@hdfcbank"
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold">QR Caption Note</Label>
                          <Input
                            value={activeTemplate.qrNote}
                            onChange={(e) => patchTpl("qrNote", e.target.value)}
                            placeholder="Scan & Pay with any UPI App"
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Primary Footer Thank-You Message</Label>
                      <Input
                        value={activeTemplate.footerMessage}
                        onChange={(e) => patchTpl("footerMessage", e.target.value)}
                        placeholder="Thank you for dining with us! Visit again."
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Guest Wi-Fi Credentials Line</Label>
                        <Input
                          value={activeTemplate.wifiDetails || ""}
                          onChange={(e) => patchTpl("wifiDetails", e.target.value)}
                          placeholder="Guest WiFi: Sunrise_Free | Pass: dine123"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Terms & Statutory Declaration</Label>
                        <Input
                          value={activeTemplate.termsNotice || ""}
                          onChange={(e) => patchTpl("termsNotice", e.target.value)}
                          placeholder="Prices inclusive of applicable taxes."
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </Panel>
            </div>

            {/* Right Side: Live Interactive 80mm / 58mm Thermal Slip & KOT Preview */}
            <div className="lg:col-span-5">
              <div className="sticky top-20 rounded-xl border bg-slate-900/95 p-4 text-white shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Live Thermal Preview ({activeTemplate.paperWidth})
                    </span>
                  </div>
                  <div className="flex items-center gap-1 rounded-lg bg-slate-800 p-0.5">
                    <button
                      type="button"
                      onClick={() => setPreviewMode("receipt")}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-[11px] font-semibold transition",
                        previewMode === "receipt"
                          ? "bg-indigo-600 text-white"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      Customer Bill
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode("kot")}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-[11px] font-semibold transition",
                        previewMode === "kot"
                          ? "bg-amber-500 text-slate-950"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      Kitchen KOT
                    </button>
                  </div>
                </div>

                {/* Thermal Roll Paper Canvas */}
                <div className="flex justify-center overflow-x-auto py-2">
                  {previewMode === "receipt" ? (
                    <div
                      id="settings-thermal-receipt-printable"
                      className={cn(
                        "bg-white text-slate-900 font-mono shadow-2xl border border-slate-300 p-4 transition-all select-none",
                        activeTemplate.paperWidth === "80mm" ? "w-[310px]" : "w-[235px]",
                        activeTemplate.fontSize === "compact"
                          ? "text-[10px]"
                          : activeTemplate.fontSize === "large"
                            ? "text-[12px]"
                            : "text-[11px]"
                      )}
                    >
                      {/* Header */}
                      <div className="border-b border-dashed border-slate-400 pb-2.5 text-center space-y-0.5">
                        {activeTemplate.showLogo && (
                          <div className="mx-auto mb-1 grid size-8 place-items-center rounded border border-slate-900 text-xs font-extrabold">
                            {(activeTemplate.orgName || "R").slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="font-extrabold text-sm uppercase tracking-tight">
                          {activeTemplate.orgName}
                        </div>
                        {activeTemplate.tagline && (
                          <div className="text-[10px] text-slate-600">{activeTemplate.tagline}</div>
                        )}
                        {activeTemplate.branchName && (
                          <div className="text-[10px] font-semibold text-slate-700">
                            {activeTemplate.branchName}
                          </div>
                        )}
                        {activeTemplate.showAddress && activeTemplate.address && (
                          <div className="text-[9px] text-slate-500 leading-tight">
                            {activeTemplate.address}
                          </div>
                        )}
                        {activeTemplate.showPhone && activeTemplate.phone && (
                          <div className="text-[10px] font-semibold text-slate-700">
                            Ph: {activeTemplate.phone}
                          </div>
                        )}
                        {activeTemplate.showGstin && activeTemplate.gstin && (
                          <div className="text-[9px] text-slate-600">
                            GSTIN: {activeTemplate.gstin}
                          </div>
                        )}
                        {activeTemplate.showFssai && activeTemplate.fssai && (
                          <div className="text-[9px] text-slate-600">
                            FSSAI: {activeTemplate.fssai}
                          </div>
                        )}
                        {activeTemplate.showHeaderGreeting && (
                          <div className="mt-1.5 bg-slate-900 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                            {activeTemplate.headerGreetingText || "ORIGINAL TAX INVOICE"}
                          </div>
                        )}
                      </div>

                      {/* Token Box */}
                      {activeTemplate.showTokenNo && (
                        <div className="my-1.5 border border-slate-900 py-1 text-center">
                          <div className="text-[8px] uppercase tracking-widest text-slate-500">
                            TOKEN NO
                          </div>
                          <div className="text-base font-extrabold">#108</div>
                        </div>
                      )}

                      {/* Meta */}
                      <div className="grid grid-cols-2 gap-y-0.5 border-b border-dashed border-slate-400 py-2 text-[10px]">
                        <div>
                          <span className="text-slate-500">Inv: </span>
                          <span className="font-bold">BIL-0108</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-500">Date: </span>
                          <span>{new Date().toLocaleDateString("en-IN")}</span>
                        </div>
                        {activeTemplate.showTable && (
                          <div>
                            <span className="text-slate-500">Table: </span>
                            <span className="font-bold">T4 (AC Hall)</span>
                          </div>
                        )}
                        {activeTemplate.showWaiter && (
                          <div className="text-right">
                            <span className="text-slate-500">Capt: </span>
                            <span>Ananya</span>
                          </div>
                        )}
                        {activeTemplate.showCustomerInfo && (
                          <div className="col-span-2 mt-1 border-t border-dotted border-slate-300 pt-1">
                            <div>
                              Guest: <strong className="font-bold">Vikram Sharma</strong> (+91 98490 11223)
                            </div>
                            {activeTemplate.showCustomerGstin && (
                              <div className="text-[9px] text-slate-500">
                                Buyer GSTIN: 36ABCDE1234F1Z5
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Items */}
                      <div className="border-b border-dashed border-slate-400 py-2">
                        <div className="mb-1 flex justify-between border-b border-slate-900 pb-1 text-[10px] font-bold uppercase">
                          <span className="w-6">Qty</span>
                          <span className="flex-1 px-1">Item</span>
                          <span className="w-12 text-right">Rate</span>
                          <span className="w-14 text-right">Amt</span>
                        </div>
                        <div className="space-y-1.5 text-[10px]">
                          <div>
                            <div className="flex justify-between">
                              <span className="w-6 font-bold">2</span>
                              <span className="flex-1 px-1 font-semibold">Hyderabadi Dum Biryani</span>
                              <span className="w-12 text-right tabular">360</span>
                              <span className="w-14 text-right font-bold tabular">720</span>
                            </div>
                            {activeTemplate.showItemModifiers && (
                              <div className="pl-6 text-[9px] italic text-slate-500">
                                + Extra Raita, Double Masala
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex justify-between">
                              <span className="w-6 font-bold">1</span>
                              <span className="flex-1 px-1 font-semibold">Paneer Tikka Angara</span>
                              <span className="w-12 text-right tabular">290</span>
                              <span className="w-14 text-right font-bold tabular">290</span>
                            </div>
                            {activeTemplate.showItemNotes && (
                              <div className="pl-6 text-[9px] italic text-slate-500">
                                Note: Medium spicy, mint chutney
                              </div>
                            )}
                          </div>
                          <div className="flex justify-between">
                            <span className="w-6 font-bold">3</span>
                            <span className="flex-1 px-1 font-semibold">Garlic Butter Naan</span>
                            <span className="w-12 text-right tabular">65</span>
                            <span className="w-14 text-right font-bold tabular">195</span>
                          </div>
                        </div>
                      </div>

                      {/* Totals */}
                      <div className="border-b border-dashed border-slate-400 py-2 space-y-1 text-[10px]">
                        <div className="flex justify-between">
                          <span>Subtotal (6 Items)</span>
                          <span className="tabular">{money(1205)}</span>
                        </div>
                        {activeTemplate.showDiscountLine && (
                          <div className="flex justify-between text-emerald-700 font-medium">
                            <span>Promo Discount (5%)</span>
                            <span className="tabular">− {money(60)}</span>
                          </div>
                        )}
                        {activeTemplate.showTaxBreakup ? (
                          <>
                            <div className="flex justify-between text-slate-600">
                              <span>CGST (2.5%)</span>
                              <span className="tabular">{money(28.63)}</span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                              <span>SGST (2.5%)</span>
                              <span className="tabular">{money(28.63)}</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex justify-between text-slate-600">
                            <span>GST (5%)</span>
                            <span className="tabular">{money(57.25)}</span>
                          </div>
                        )}
                        {activeTemplate.showServiceCharge && (
                          <div className="flex justify-between text-slate-600">
                            <span>Service Charge (5%)</span>
                            <span className="tabular">{money(57.25)}</span>
                          </div>
                        )}
                        {activeTemplate.showRoundOff && (
                          <div className="flex justify-between text-slate-500">
                            <span>Round Off</span>
                            <span className="tabular">+0.50</span>
                          </div>
                        )}
                        <div className="flex justify-between border-t-2 border-slate-900 pt-1.5 text-sm font-extrabold">
                          <span>GRAND TOTAL</span>
                          <span className="tabular">{money(1260)}</span>
                        </div>
                      </div>

                      {/* Paid Stamp */}
                      {activeTemplate.showPaymentMode && (
                        <div className="my-1.5 bg-slate-100 py-1 text-center text-[10px] font-bold">
                          ✓ PAID VIA UPI · {money(1260)}
                        </div>
                      )}

                      {/* Loyalty Box */}
                      {activeTemplate.showLoyaltyPoints && (
                        <div className="my-1.5 rounded border border-dashed border-indigo-300 bg-indigo-50/70 p-1.5 text-center text-[9px] text-indigo-950">
                          <div className="font-bold">⭐ CUSTOMER LOYALTY SUMMARY ⭐</div>
                          <div>
                            Points Earned:{" "}
                            <strong>
                              +{Math.round(1205 * ((activeTemplate.loyaltyEarnRatePct || 5) / 100))} Pts
                            </strong>{" "}
                            · Balance: <strong>340 Pts</strong>
                          </div>
                        </div>
                      )}

                      {/* QR Code */}
                      {activeTemplate.showQrCode && (
                        <div className="border-b border-dashed border-slate-400 py-2 text-center">
                          <div className="mx-auto grid size-16 place-items-center border border-slate-900 bg-white p-1">
                            <QrCode className="size-14 text-slate-900" />
                          </div>
                          <div className="mt-1 text-[8px] font-bold text-slate-700">
                            {activeTemplate.qrNote || "SCAN TO PAY VIA UPI"}
                          </div>
                          <div className="font-mono text-[8px] text-slate-500">
                            {activeTemplate.upiId}
                          </div>
                        </div>
                      )}

                      {/* Footer */}
                      <div className="pt-2 text-center text-[9px] text-slate-600 space-y-0.5">
                        <div className="font-bold text-slate-900">{activeTemplate.footerMessage}</div>
                        {activeTemplate.wifiDetails && <div>{activeTemplate.wifiDetails}</div>}
                        {activeTemplate.termsNotice && (
                          <div className="text-[8px] text-slate-400 pt-0.5">
                            {activeTemplate.termsNotice}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Kitchen KOT Slip Preview */
                    <div
                      id="settings-thermal-receipt-printable"
                      className={cn(
                        "bg-amber-50/95 text-slate-900 font-mono shadow-2xl border-2 border-slate-900 p-4 select-none",
                        activeTemplate.paperWidth === "80mm" ? "w-[310px]" : "w-[235px]"
                      )}
                    >
                      <div className="border-b-2 border-slate-900 pb-2 text-center">
                        <div className="bg-slate-900 text-amber-300 font-extrabold text-xs py-1 uppercase tracking-widest">
                          KITCHEN ORDER TICKET (KOT)
                        </div>
                        <div className="mt-1 text-[10px] font-bold">{activeTemplate.branchName}</div>
                        <div className="mt-1 flex justify-between text-xs font-extrabold">
                          <span>TABLE: T4</span>
                          <span>TOKEN: #108</span>
                        </div>
                      </div>
                      <div className="py-1.5 border-b border-dashed border-slate-500 text-[10px] flex justify-between">
                        <span>Order: ORD-1048 (Dine-in)</span>
                        <span>Capt: Ananya</span>
                      </div>
                      <div className="py-2 space-y-2 text-xs">
                        <div>
                          <div className="flex justify-between font-extrabold">
                            <span>2 x Hyderabadi Dum Biryani</span>
                            <span className="rounded bg-slate-900 px-1 text-[9px] text-white">BIRYANI</span>
                          </div>
                          <div className="pl-4 text-[10px] font-bold text-rose-700">
                            → Extra Raita, Double Masala
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between font-extrabold">
                            <span>1 x Paneer Tikka Angara</span>
                            <span className="rounded bg-slate-900 px-1 text-[9px] text-white">TANDOOR</span>
                          </div>
                          <div className="pl-4 text-[10px] font-bold text-rose-700">
                            → Note: Medium spicy, mint chutney
                          </div>
                        </div>
                        <div className="flex justify-between font-extrabold">
                          <span>3 x Garlic Butter Naan</span>
                          <span className="rounded bg-slate-900 px-1 text-[9px] text-white">TANDOOR</span>
                        </div>
                      </div>
                      <div className="border-t-2 border-slate-900 pt-2 text-center text-[10px] font-bold">
                        TOTAL QTY: 6 ITEMS · FIRED {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* =====================================================================
            TAB 2: ORGANIZATION PROFILE & OUTLET BRANCHES
           ===================================================================== */}
        <TabsContent value="profile" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Restaurant Organization Profile & Registration">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Restaurant Business / Brand Name</Label>
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
                      onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                      className="font-mono uppercase"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>FSSAI License No.</Label>
                    <Input
                      value={form.fssai}
                      onChange={(e) => setForm({ ...form, fssai: e.target.value })}
                      className="font-mono"
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
                  <Label>Headquarters / Outlet Address</Label>
                  <Input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
              </div>
            </Panel>

            <Panel title="Branches & Outlets (Per Organization)">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-4">
                  <div>
                    <div className="text-sm font-semibold">Active Operating Branch</div>
                    <div className="text-xs text-muted-foreground">
                      Switch the outlet profile used for POS orders, tables, KDS, and receipts
                    </div>
                  </div>
                  <Select
                    value={form.currentBranch}
                    onValueChange={(b) => {
                      setForm({ ...form, currentBranch: b });
                      switchBranch(b);
                      toast.success(`Switched active branch to ${b}`);
                    }}
                  >
                    <SelectTrigger className="w-60 text-xs font-medium">
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
                  <div className="grid gap-2">
                    {settings.branches.map((b) => (
                      <div
                        key={b}
                        className="flex items-center justify-between rounded-lg border p-3 bg-card"
                      >
                        <div className="flex items-center gap-2.5">
                          <Store className="size-4 text-primary" />
                          <div>
                            <div className="text-sm font-medium">{b}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {b === settings.currentBranch
                                ? "Currently Active Outlet"
                                : "Standby Branch"}
                            </div>
                          </div>
                        </div>
                        {b === settings.currentBranch ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-medium text-success">
                            <CheckCircle2 className="size-3" /> Active
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setForm({ ...form, currentBranch: b });
                              switchBranch(b);
                            }}
                          >
                            Switch
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Input
                    placeholder="New branch name (e.g., Hyderabad — Gachibowli)"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    className="max-w-md"
                  />
                  <Button variant="secondary" onClick={() => void handleAddBranch()}>
                    <Plus className="size-4 mr-1" /> Add Branch
                  </Button>
                </div>
              </div>
            </Panel>
          </div>
        </TabsContent>

        {/* =====================================================================
            TAB 3: TAXES, BILLING & END-TO-END FLOW
           ===================================================================== */}
        <TabsContent value="billing" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
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
                      Standard Indian restaurant GST is 5% (2.5% CGST + 2.5% SGST)
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
                    <span className="text-[11px] text-muted-foreground">
                      Applied automatically to Dine-in table orders
                    </span>
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
                        Fire kitchen order tickets immediately when a POS order is placed
                      </div>
                    </div>
                    <Switch
                      checked={form.autoPrintKOT}
                      onCheckedChange={(v) => setForm({ ...form, autoPrintKOT: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between border-t pt-3">
                    <div>
                      <div className="text-sm font-medium">Sound Alerts on New Kitchen Tickets</div>
                      <div className="text-xs text-muted-foreground">
                        Play audio chime on KDS when new KOT arrives
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

            <Panel title="Per-Organization Module Flow Status">
              <div className="space-y-3 text-xs">
                {[
                  {
                    title: "Floor Plan & Tables ↔ POS Orders",
                    desc: "Table UUID & display code synced; seating, billing, and cleaning states persisted per outlet in PostgreSQL.",
                  },
                  {
                    title: "POS Orders ↔ Kitchen KDS (KOT)",
                    desc: "Orders auto-generate station KOT tickets and audit logs (Fired → Cooking → Ready → Served).",
                  },
                  {
                    title: "Menu ↔ Recipe BOM ↔ Inventory Stock",
                    desc: "Dishes link to active Recipe BOMs; order creation & bill settlement automatically deduct ingredient stock.",
                  },
                  {
                    title: "Billing ↔ Per-Org Thermal Receipts & Accounting",
                    desc: "Settled bills render 80mm/58mm HTML, fpdf2 PDF, and raw ESC/POS using the organization's active PrintTemplate.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="flex items-start gap-3 rounded-lg border bg-card p-3"
                  >
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    <div>
                      <div className="font-semibold text-foreground">{item.title}</div>
                      <div className="text-muted-foreground mt-0.5">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </TabsContent>

        {/* =====================================================================
            TAB 4: PRINTERS, DEVICES & PRINT QUEUE
           ===================================================================== */}
        <TabsContent value="printers" className="space-y-6">
          <PrintersSettingsSection />
        </TabsContent>

        {/* =====================================================================
            TAB 5: FINANCE OPS (EXPENSES, WITHDRAWALS, FX, CASH FLOW)
           ===================================================================== */}
        <TabsContent value="finance" className="space-y-6">
          <FinanceOpsSection />
        </TabsContent>

        {/* =====================================================================
            TAB 6: SUBSCRIPTIONS (PLAN CARDS + TENANT PLAN)
           ===================================================================== */}
        <TabsContent value="subscriptions" className="space-y-6">
          <SubscriptionsSection />
        </TabsContent>
      </Tabs>

      {/* Print stylesheet for Test Print on the Settings page */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #settings-thermal-receipt-printable, #settings-thermal-receipt-printable * {
            visibility: visible !important;
          }
          #settings-thermal-receipt-printable {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${activeTemplate.paperWidth === "80mm" ? "80mm" : "58mm"} !important;
            margin: 0 !important;
            padding: 4mm !important;
            border: none !important;
            box-shadow: none !important;
          }
          @page {
            size: ${activeTemplate.paperWidth === "80mm" ? "80mm" : "58mm"} auto;
            margin: 0;
          }
        }
      `}</style>
    </PageContainer>
  );
}

function ToggleCard({
  title,
  desc,
  checked,
  onChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-foreground">{title}</div>
        <div className="text-[11px] text-muted-foreground leading-snug">{desc}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
