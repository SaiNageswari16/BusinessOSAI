import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Award,
  CreditCard,
  Gift,
  Mail,
  Phone,
  Plus,
  Search,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
import { ReceiptModal } from "@/components/shared/ReceiptModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inr, orderTotal } from "@/lib/calc";
import { useRestaurantStore } from "@/lib/store";
import type { Customer, Order } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/crm")({
  component: CrmScreen,
});

export function CrmScreen() {
  const navigate = useNavigate();

  const customers = useRestaurantStore((s) => s.customers);
  const orders = useRestaurantStore((s) => s.orders);
  const reservations = useRestaurantStore((s) => s.reservations);
  const settings = useRestaurantStore((s) => s.settings);

  const saveCustomer = useRestaurantStore((s) => s.saveCustomer);
  const adjustCustomerPoints = useRestaurantStore((s) => s.adjustCustomerPoints);
  const setPosCustomer = useRestaurantStore((s) => s.setPosCustomer);
  const clearPosCart = useRestaurantStore((s) => s.clearPosCart);

  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | Customer["tier"]>("all");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id ?? "C1");
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);

  // New / Edit Customer Dialog
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (tierFilter !== "all" && c.tier !== tierFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [customers, tierFilter, searchQuery]);

  const selectedCustomer = useMemo(
    () =>
      customers.find((c) => c.id === selectedCustomerId) ?? filteredCustomers[0] ?? customers[0],
    [customers, filteredCustomers, selectedCustomerId],
  );

  const customerOrders = useMemo(
    () =>
      selectedCustomer
        ? orders
            .filter((o) => o.customerId === selectedCustomer.id && o.status !== "cancelled")
            .sort((a, b) => b.createdAt - a.createdAt)
        : [],
    [orders, selectedCustomer],
  );

  const customerVisits = useMemo(
    () =>
      selectedCustomer
        ? reservations.filter((r) => r.name.toLowerCase() === selectedCustomer.name.toLowerCase())
        : [],
    [reservations, selectedCustomer],
  );

  const lifetimeSpend = useMemo(
    () => customerOrders.reduce((s, o) => s + orderTotal(o, settings.gstPct), 0),
    [customerOrders, settings.gstPct],
  );

  const handleCreateCustomer = () => {
    if (!name.trim() || !phone.trim()) {
      toast.error("Name and phone number are required.");
      return;
    }
    const id = saveCustomer({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || `${name.trim().toLowerCase().replace(/\s+/g, ".")}@mail.in`,
      points: 100,
      tier: "Bronze",
      notes: notes.trim(),
    });
    setSelectedCustomerId(id);
    setModalOpen(false);
    setName("");
    setPhone("");
    setEmail("");
    setNotes("");
    toast.success(`Added ${name} to CRM directory`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb="CRM"
        title="Guest Directory & Loyalty CRM"
        subtitle="Track 28+ guest profiles, lifetime dining spend, order history, seating preferences, and loyalty tiers"
        actions={
          <Button size="sm" onClick={() => setModalOpen(true)} className="gap-1.5">
            <UserPlus className="h-4 w-4" />
            Add Guest Profile
          </Button>
        }
      />

      {/* Filter Bar */}
      <div className="surface p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {(["all", "Gold", "Silver", "Bronze"] as const).map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => setTierFilter(tier)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                tierFilter === tier
                  ? "bg-navy text-navy-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              )}
            >
              {tier === "all" ? `All Guests (${customers.length})` : `${tier} Tier`}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search guest by name, phone, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Main Split: Customer Directory Table + Selected Guest Profile & History */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 items-start">
        <div className="surface overflow-hidden lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase">
                  <th className="py-3 px-4">Guest Name</th>
                  <th className="py-3 px-3">Contact</th>
                  <th className="py-3 px-3">Loyalty Tier</th>
                  <th className="py-3 px-3 text-right">Points</th>
                  <th className="py-3 px-3 text-right">Orders</th>
                  <th className="py-3 px-4 text-right">Lifetime Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCustomers.map((c) => {
                  const custOrds = orders.filter(
                    (o) => o.customerId === c.id && o.status !== "cancelled",
                  );
                  const spend = custOrds.reduce((s, o) => s + orderTotal(o, settings.gstPct), 0);
                  const isSelected = selectedCustomer?.id === c.id;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCustomerId(c.id)}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-muted/40",
                        isSelected && "bg-primary/6",
                      )}
                    >
                      <td className="py-2.5 px-4">
                        <div className="font-bold text-foreground">{c.name}</div>
                        {c.notes && (
                          <div className="text-[10px] text-muted-foreground">{c.notes}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div>{c.phone}</div>
                        <div className="text-[10px] text-muted-foreground">{c.email}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            c.tier === "Gold"
                              ? "border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-300"
                              : c.tier === "Silver"
                                ? "border-slate-400/40 bg-slate-500/15 text-slate-600 dark:text-slate-300"
                                : "border-orange-400/40 bg-orange-500/10 text-orange-600",
                          )}
                        >
                          {c.tier}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold tabular text-ai">
                        {c.points} pts
                      </td>
                      <td className="py-2.5 px-3 text-right tabular">{custOrds.length}</td>
                      <td className="py-2.5 px-4 text-right font-bold tabular">{inr(spend)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Guest Profile, Loyalty & Order History */}
        <div className="surface p-5 space-y-4 sticky top-28">
          {selectedCustomer && (
            <>
              <div className="flex items-start justify-between border-b border-border pb-3.5">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{selectedCustomer.name}</h2>
                  <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3" /> {selectedCustomer.phone}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3 w-3" /> {selectedCustomer.email}
                    </div>
                  </div>
                </div>
                <Badge className="bg-ai text-white gap-1">
                  <Award className="h-3 w-3" /> {selectedCustomer.tier}
                </Badge>
              </div>

              {/* Loyalty & Spend Summary */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-border bg-muted/30 p-2.5">
                  <div className="text-[10px] text-muted-foreground uppercase">Points</div>
                  <div className="mt-0.5 text-base font-extrabold text-ai tabular">
                    {selectedCustomer.points}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-2.5">
                  <div className="text-[10px] text-muted-foreground uppercase">Orders</div>
                  <div className="mt-0.5 text-base font-extrabold tabular">
                    {customerOrders.length}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-2.5">
                  <div className="text-[10px] text-muted-foreground uppercase">Total Spend</div>
                  <div className="mt-0.5 text-base font-extrabold tabular">
                    {inr(lifetimeSpend)}
                  </div>
                </div>
              </div>

              {selectedCustomer.notes && (
                <div className="rounded-lg border border-primary/25 bg-info-soft/50 px-3 py-2 text-xs">
                  <span className="font-semibold text-primary">Guest Preference: </span>
                  <span>{selectedCustomer.notes}</span>
                </div>
              )}

              {/* Loyalty Actions */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs gap-1"
                  onClick={() => {
                    adjustCustomerPoints(selectedCustomer.id, 50);
                    toast.success(`Credited +50 bonus loyalty points to ${selectedCustomer.name}`);
                  }}
                >
                  <Gift className="h-3.5 w-3.5 text-ai" /> +50 Bonus Pts
                </Button>
                <Button
                  size="sm"
                  className="flex-1 text-xs gap-1"
                  onClick={() => {
                    clearPosCart();
                    setPosCustomer(selectedCustomer.id);
                    toast.success(`Started POS order for ${selectedCustomer.name}`);
                    navigate({ to: "/pos" });
                  }}
                >
                  <CreditCard className="h-3.5 w-3.5" /> Start Order in POS
                </Button>
              </div>

              {/* Order History */}
              <div className="space-y-2 border-t border-border pt-3">
                <div className="text-xs font-bold text-foreground">
                  Order History ({customerOrders.length})
                </div>
                {customerOrders.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-3">
                    No recorded orders for this guest yet.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {customerOrders.map((ord) => (
                      <div
                        key={ord.id}
                        onClick={() => setReceiptOrder(ord)}
                        className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs hover:bg-muted/50"
                      >
                        <div>
                          <div className="font-semibold text-foreground">
                            {ord.id} · <span className="uppercase">{ord.type}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {ord.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-bold tabular">
                            {inr(orderTotal(ord, settings.gstPct))}
                          </div>
                          <div className="text-[10px] text-primary">Receipt →</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Visit / Reservation History */}
              {customerVisits.length > 0 && (
                <div className="space-y-1.5 border-t border-border pt-3">
                  <div className="text-xs font-bold text-foreground">
                    Table Reservations ({customerVisits.length})
                  </div>
                  {customerVisits.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between text-xs text-muted-foreground"
                    >
                      <span>
                        {v.date} at {v.time} ({v.party} guests)
                      </span>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {v.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add Guest Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Guest to CRM</DialogTitle>
            <DialogDescription>
              Create a customer profile with automatic loyalty points tracking.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Full Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Anjali Deshmukh"
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-xs">Phone</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98490 12345"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="anjali@mail.in"
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Seating / Dietary Notes</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Prefers terrace seating, Jain options"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreateCustomer}>
              Create Guest Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReceiptModal
        order={receiptOrder}
        open={receiptOrder !== null}
        onOpenChange={(open) => {
          if (!open) setReceiptOrder(null);
        }}
      />
    </div>
  );
}
