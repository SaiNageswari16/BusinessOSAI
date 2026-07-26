import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard, Sparkles, Boxes, ShoppingCart, Users, Calculator,
  Plus, FileText, Settings,
} from "lucide-react";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const go = (to: string) => { onOpenChange(false); navigate({ to }); };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search or jump to anything…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => go("/dashboard")}><LayoutDashboard className="size-4 mr-2" /> Dashboard</CommandItem>
          <CommandItem onSelect={() => go("/copilot")}><Sparkles className="size-4 mr-2" /> AI Copilot</CommandItem>
          <CommandItem onSelect={() => go("/inventory")}><Boxes className="size-4 mr-2" /> Inventory</CommandItem>
          <CommandItem onSelect={() => go("/pos")}><ShoppingCart className="size-4 mr-2" /> Point of Sale</CommandItem>
          <CommandItem onSelect={() => go("/crm")}><Users className="size-4 mr-2" /> CRM</CommandItem>
          <CommandItem onSelect={() => go("/accounting")}><Calculator className="size-4 mr-2" /> Accounting</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Quick actions">
          <CommandItem><Plus className="size-4 mr-2" /> New sales order</CommandItem>
          <CommandItem><FileText className="size-4 mr-2" /> Draft invoice</CommandItem>
          <CommandItem><Plus className="size-4 mr-2" /> Add customer</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Settings">
          <CommandItem onSelect={() => go("/settings")}><Settings className="size-4 mr-2" /> Open settings</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
