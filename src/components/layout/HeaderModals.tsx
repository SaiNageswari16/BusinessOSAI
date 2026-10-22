import { useNavigate } from "@tanstack/react-router";
import { BookOpen, ClipboardList, LayoutGrid, Monitor, RotateCcw, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { inr } from "@/lib/calc";
import { PROFILES } from "@/lib/profiles";
import { useRestaurantStore } from "@/lib/store";
import type { ProfileId } from "@/lib/types";
import { NAV_ITEMS_CONFIG } from "./nav-config";

interface HeaderModalsProps {
  cmdOpen: boolean;
  onCmdOpenChange: (open: boolean) => void;
  helpOpen: boolean;
  onHelpOpenChange: (open: boolean) => void;
  resetConfirmOpen: boolean;
  onResetConfirmOpenChange: (open: boolean) => void;
}

export function HeaderModals({
  cmdOpen,
  onCmdOpenChange,
  helpOpen,
  onHelpOpenChange,
  resetConfirmOpen,
  onResetConfirmOpenChange,
}: HeaderModalsProps) {
  const navigate = useNavigate();

  const settings = useRestaurantStore((s) => s.settings);
  const tables = useRestaurantStore((s) => s.tables);
  const orders = useRestaurantStore((s) => s.orders);
  const menu = useRestaurantStore((s) => s.menu);
  const customers = useRestaurantStore((s) => s.customers);

  const setProfile = useRestaurantStore((s) => s.setProfile);
  const resetDemoData = useRestaurantStore((s) => s.resetDemoData);
  const openPosForTable = useRestaurantStore((s) => s.openPosForTable);
  const openPosForOrder = useRestaurantStore((s) => s.openPosForOrder);

  const activeProfile = PROFILES[settings.profile];
  const visibleNavItems = NAV_ITEMS_CONFIG.filter((item) =>
    activeProfile.modules.includes(item.key),
  );

  const handleResetDemo = () => {
    resetDemoData();
    onResetConfirmOpenChange(false);
    onHelpOpenChange(false);
    toast.success("Demo data restored to initial Sunrise Restaurant seed state");
  };

  return (
    <>
      {/* Ctrl+K Global Command Palette */}
      <CommandDialog open={cmdOpen} onOpenChange={onCmdOpenChange}>
        <CommandInput placeholder="Search tables (e.g. T1), dishes (e.g. Biryani), orders, guests or jump to screen..." />
        <CommandList>
          <CommandEmpty>No matching screens, tables, menu items, or orders.</CommandEmpty>
          <CommandGroup heading="Navigation">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.key}
                  onSelect={() => {
                    onCmdOpenChange(false);
                    navigate({ to: item.to });
                  }}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <span>Go to {item.label}</span>
                </CommandItem>
              );
            })}
            <CommandItem
              onSelect={() => {
                onCmdOpenChange(false);
                navigate({ to: "/kds" });
              }}
            >
              <Monitor className="mr-2 h-4 w-4 text-warning" />
              <span>Open KDS Kitchen Display System</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Tables — Open in POS">
            {tables.slice(0, 12).map((t) => (
              <CommandItem
                key={t.id}
                onSelect={() => {
                  onCmdOpenChange(false);
                  openPosForTable(t.id);
                  navigate({ to: "/pos" });
                }}
              >
                <LayoutGrid className="mr-2 h-4 w-4" />
                <span>
                  Table {t.name} ({t.area}) — {t.status.toUpperCase()}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Active Orders">
            {orders
              .filter((o) => o.status !== "completed" && o.status !== "cancelled")
              .slice(0, 8)
              .map((o) => (
                <CommandItem
                  key={o.id}
                  onSelect={() => {
                    onCmdOpenChange(false);
                    openPosForOrder(o.id);
                    navigate({ to: "/pos" });
                  }}
                >
                  <ClipboardList className="mr-2 h-4 w-4" />
                  <span>
                    {o.id} ({o.type.toUpperCase()}) {o.tableId ? `· Table ${o.tableId}` : ""} ·{" "}
                    {o.status}
                  </span>
                </CommandItem>
              ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Menu Items">
            {menu.slice(0, 10).map((m) => (
              <CommandItem
                key={m.id}
                onSelect={() => {
                  onCmdOpenChange(false);
                  navigate({ to: "/menu" });
                }}
              >
                <BookOpen className="mr-2 h-4 w-4" />
                <span>
                  {m.name} ({m.category}) — {inr(m.price)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Customers">
            {customers.slice(0, 6).map((c) => (
              <CommandItem
                key={c.id}
                onSelect={() => {
                  onCmdOpenChange(false);
                  navigate({ to: "/crm" });
                }}
              >
                <Users className="mr-2 h-4 w-4" />
                <span>
                  {c.name} ({c.phone}) · {c.tier}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Help & Shortcuts Modal */}
      <Dialog open={helpOpen} onOpenChange={onHelpOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>RestaurantOS — Operations Guide & Shortcuts</DialogTitle>
            <DialogDescription>
              Connected end-to-end POS, Floor Operations, Kitchen (KOT/KDS), Inventory, and CRM.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-xs">
            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1.5">
              <div className="font-semibold text-foreground">Main Restaurant Workflow</div>
              <ol className="list-decimal pl-4 space-y-1 text-muted-foreground">
                <li>
                  Select a table in <strong>Operations</strong> or click <strong>New Order</strong>.
                </li>
                <li>
                  Add dishes, modifiers & add-ons in <strong>POS</strong>, then{" "}
                  <strong>Send to Kitchen (KOT)</strong>.
                </li>
                <li>
                  Track preparation in <strong>Kitchen (KOT / KDS)</strong> from New → Accepted →
                  Preparing → Ready.
                </li>
                <li>
                  Return to the active order in <strong>POS</strong> or <strong>Orders</strong>,
                  generate the GST bill, complete payment, and preview/print the receipt.
                </li>
              </ol>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border p-2.5 flex items-center justify-between">
                <span className="text-muted-foreground">Command Palette</span>
                <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">Ctrl + K</kbd>
              </div>
              <div className="rounded-lg border border-border p-2.5 flex items-center justify-between">
                <span className="text-muted-foreground">Active Profile</span>
                <span className="font-semibold text-foreground">{activeProfile.label}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="font-semibold text-foreground">Switch Restaurant Profile</div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(PROFILES) as ProfileId[]).map((pid) => (
                  <Button
                    key={pid}
                    size="sm"
                    variant={settings.profile === pid ? "default" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => {
                      setProfile(pid);
                      toast.success(`Profile switched to ${PROFILES[pid].label}`);
                    }}
                  >
                    {PROFILES[pid].label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onResetConfirmOpenChange(true)}
              className="gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Demo Data
            </Button>
            <Button variant="outline" size="sm" onClick={() => onHelpOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Demo Data Confirmation Dialog */}
      <Dialog open={resetConfirmOpen} onOpenChange={onResetConfirmOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset RestaurantOS Demo Data?</DialogTitle>
            <DialogDescription>
              This will restore Sunrise Restaurant (Hyderabad Central) to its initial seeded tables,
              orders, KOT tickets, inventory quantities, reservations, and settings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => onResetConfirmOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleResetDemo}>
              Confirm Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
