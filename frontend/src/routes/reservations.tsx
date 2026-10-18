import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Calendar, CheckCircle2, Clock, Plus, Users, Utensils } from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { KpiCard, PageHeader, Panel } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createReservation,
  seatReservation,
  updateReservationStatus,
  useReservations,
  useTables,
} from "@/services/orderService";
import type { Reservation } from "@/lib/types";

export const Route = createFileRoute("/reservations")({
  head: () => ({
    meta: [
      { title: "Reservations — RestaurantOS" },
      {
        name: "description",
        content: "Today's bookings, guest counts, table assignment and walk-in waitlist.",
      },
      { property: "og:title", content: "Reservations — RestaurantOS" },
      {
        property: "og:description",
        content: "Today's bookings, guest counts, table assignment and walk-in waitlist.",
      },
    ],
  }),
  component: Reservations,
});

function Reservations() {
  const navigate = useNavigate();
  const reservations = useReservations();
  const tables = useTables();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState({
    name: "",
    phone: "",
    guests: "2",
    time: "20:00",
    occasion: "",
    table: "none",
  });

  const availableTables = tables.filter((t) => t.status === "Available");

  const setStatus = (id: string, status: Reservation["status"]) => {
    updateReservationStatus(id, status);
    toast.success(`Reservation marked as ${status}`);
  };

  const handleSeat = (r: Reservation) => {
    const tableId = r.table && r.table !== "none" ? r.table : availableTables[0]?.id;
    if (!tableId) {
      toast.error("No table currently available to seat this reservation");
      return;
    }
    seatReservation(r.id, tableId);
    toast.success(`Seated ${r.name} at Table ${tableId}`);
  };

  const sorted = [...reservations].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Bookings & Waitlist"
        title="Reservations"
        description="Today's table bookings and scheduled parties"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4 mr-1.5" /> New reservation
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Bookings today" value={String(reservations.length)} />
        <KpiCard
          label="Covers booked"
          value={String(
            reservations
              .filter((r) => !["Cancelled", "No-show"].includes(r.status))
              .reduce((s, r) => s + r.guests, 0),
          )}
        />
        <KpiCard
          label="Pending arrivals"
          value={String(
            reservations.filter((r) => r.status === "Pending" || r.status === "Confirmed").length,
          )}
        />
        <KpiCard
          label="Seated so far"
          value={String(reservations.filter((r) => r.status === "Seated").length)}
        />
      </div>
      <Panel title="Today's Reservation Timeline" bodyClass="p-0">
        <ul className="divide-y">
          {sorted.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
              <span className="w-14 font-mono text-sm font-semibold tabular">{r.time}</span>
              <div className="min-w-40 flex-1">
                <div className="text-sm font-medium">
                  {r.name}{" "}
                  <span className="font-normal text-muted-foreground">· {r.guests} guests</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.phone}
                  {r.occasion ? ` · ${r.occasion}` : ""}
                  {r.notes ? ` · ${r.notes}` : ""}
                </div>
              </div>
              <span className="w-20 text-xs font-semibold text-foreground">
                {r.table ? `Table ${r.table}` : "Unassigned"}
              </span>
              <StatusBadge status={r.status} />
              <div className="flex gap-1.5">
                {r.status === "Pending" && (
                  <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "Confirmed")}>
                    Confirm
                  </Button>
                )}
                {r.status === "Confirmed" && (
                  <Button size="sm" onClick={() => handleSeat(r)}>
                    Seat table
                  </Button>
                )}
                {r.status === "Seated" && (
                  <Button size="sm" variant="outline" onClick={() => navigate({ to: "/pos" })}>
                    <Utensils className="size-3 mr-1" /> Open POS
                  </Button>
                )}
                {["Pending", "Confirmed"].includes(r.status) && (
                  <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, "Cancelled")}>
                    Cancel
                  </Button>
                )}
              </div>
            </li>
          ))}
          {!sorted.length && (
            <li className="py-12 text-center text-sm text-muted-foreground">
              No reservations found for today.
            </li>
          )}
        </ul>
      </Panel>

      {/* New Reservation Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Reservation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Guest name</Label>
              <Input
                value={d.name}
                onChange={(e) => setD({ ...d, name: e.target.value })}
                placeholder="e.g. Sameer Verma"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone number</Label>
              <Input
                value={d.phone}
                onChange={(e) => setD({ ...d, phone: e.target.value })}
                placeholder="+91 98480 00000"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Guest Count</Label>
                <Input
                  type="number"
                  min={1}
                  value={d.guests}
                  onChange={(e) => setD({ ...d, guests: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Arrival Time</Label>
                <Input
                  type="time"
                  value={d.time}
                  onChange={(e) => setD({ ...d, time: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Occasion</Label>
                <Input
                  value={d.occasion}
                  onChange={(e) => setD({ ...d, occasion: e.target.value })}
                  placeholder="e.g. Birthday"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Assign Table (Optional)</Label>
                <Select value={d.table} onValueChange={(v) => setD({ ...d, table: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Auto / Unassigned</SelectItem>
                    {tables.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.id} ({t.seats} seats · {t.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!d.name || !d.phone) return toast.error("Name and phone number required");
                createReservation({
                  name: d.name,
                  phone: d.phone,
                  guests: Number(d.guests),
                  time: d.time,
                  date: new Date().toISOString().slice(0, 10),
                  table: d.table !== "none" ? d.table : undefined,
                  occasion: d.occasion || undefined,
                });
                setOpen(false);
                setD({
                  name: "",
                  phone: "",
                  guests: "2",
                  time: "20:00",
                  occasion: "",
                  table: "none",
                });
                toast.success("Reservation confirmed and table reserved");
              }}
            >
              Confirm Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
