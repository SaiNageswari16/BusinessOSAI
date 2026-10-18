import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
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
  useCustomers,
  useInventory,
  useMenu,
  useOrders,
  useReservations,
  useStaff,
  useTables,
} from "@/services/orderService";
import { orderTotal } from "@/lib/billing";
import { money } from "@/lib/format";
import { StatusBadge } from "@/components/common/StatusBadge";

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const navigate = useNavigate();
  const orders = useOrders();
  const tables = useTables();
  const menuItems = useMenu();
  const customers = useCustomers();
  const inventory = useInventory();
  const staff = useStaff();
  const reservations = useReservations();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const go = (to: string) => {
    onOpenChange(false);
    navigate({ to });
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search orders, customers, menu, tables, staff…" />
      <CommandList className="max-h-[440px]">
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Orders">
          {orders.map((o) => (
            <CommandItem
              key={o.id}
              value={`${o.id} ${o.customer} ${o.table ?? ""}`}
              onSelect={() => go("/orders")}
            >
              <div className="flex w-full items-center gap-3">
                <span className="font-mono text-xs font-medium">{o.id}</span>
                <span className="truncate text-sm">{o.customer}</span>
                <span className="text-xs text-muted-foreground">{o.table ?? o.type}</span>
                <span className="ml-auto tabular text-xs">{money(orderTotal(o.lines))}</span>
                <StatusBadge status={o.status} />
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Customers">
          {customers.map((c) => (
            <CommandItem key={c.id} value={`${c.name} ${c.phone}`} onSelect={() => go("/crm")}>
              <span>{c.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {c.phone} · {c.tier}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Menu items">
          {menuItems.map((m) => (
            <CommandItem key={m.id} value={`${m.name} ${m.category}`} onSelect={() => go("/menu")}>
              <span>{m.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {m.category} · {money(m.price)}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Tables">
          {tables.map((t) => (
            <CommandItem
              key={t.id}
              value={`table ${t.id} ${t.area}`}
              onSelect={() => go("/operations")}
            >
              <span>Table {t.id}</span>
              <span className="ml-auto">
                <StatusBadge status={t.status} />
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Reservations">
          {reservations.map((r) => (
            <CommandItem
              key={r.id}
              value={`${r.id} ${r.name}`}
              onSelect={() => go("/reservations")}
            >
              <span>{r.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {r.time} · {r.guests} guests
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Staff">
          {staff.map((s) => (
            <CommandItem key={s.id} value={`${s.name} ${s.role}`} onSelect={() => go("/staff")}>
              <span>{s.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">{s.role}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Inventory">
          {inventory.map((i) => (
            <CommandItem
              key={i.id}
              value={`${i.name} ${i.category}`}
              onSelect={() => go("/inventory")}
            >
              <span>{i.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {i.stock} {i.unit} in stock
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
