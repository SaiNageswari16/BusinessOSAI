import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Phone,
  Plus,
  Search,
  UserCheck,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRestaurantStore } from "@/lib/store";
import type { Reservation } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reservations")({
  component: ReservationsScreen,
});

export function ReservationsScreen() {
  const navigate = useNavigate();

  const reservations = useRestaurantStore((s) => s.reservations);
  const tables = useRestaurantStore((s) => s.tables);
  const createReservation = useRestaurantStore((s) => s.createReservation);
  const updateReservationStatus = useRestaurantStore((s) => s.updateReservationStatus);
  const assignReservationTable = useRestaurantStore((s) => s.assignReservationTable);
  const openPosForTable = useRestaurantStore((s) => s.openPosForTable);

  const [statusFilter, setStatusFilter] = useState<"all" | Reservation["status"]>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // New Reservation Modal
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [resDate, setResDate] = useState(new Date().toISOString().slice(0, 10));
  const [resTime, setResTime] = useState("19:30");
  const [resParty, setResParty] = useState("4");
  const [resTableId, setResTableId] = useState<string>("unassigned");
  const [resStatus, setResStatus] = useState<Reservation["status"]>("confirmed");
  const [resRequest, setResRequest] = useState("");

  const uniqueDates = useMemo(() => {
    const s = new Set(reservations.map((r) => r.date));
    return Array.from(s).sort();
  }, [reservations]);

  const filteredReservations = useMemo(() => {
    return reservations.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (dateFilter !== "all" && r.date !== dateFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.name.toLowerCase().includes(q) ||
          r.phone.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          (r.request.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [reservations, statusFilter, dateFilter, searchQuery]);

  const waitlistReservations = useMemo(
    () => reservations.filter((r) => r.status === "waitlist"),
    [reservations],
  );

  const handleCreateReservation = () => {
    if (!guestName.trim() || !guestPhone.trim()) {
      toast.error("Please enter guest name and contact phone");
      return;
    }
    const id = createReservation({
      name: guestName.trim(),
      phone: guestPhone.trim(),
      date: resDate,
      time: resTime,
      party: Math.max(1, Number(resParty) || 2),
      tableId: resTableId === "unassigned" ? undefined : resTableId,
      status: resStatus,
      request: resRequest.trim(),
    });
    setNewModalOpen(false);
    setGuestName("");
    setGuestPhone("");
    setResRequest("");
    toast.success(`Reservation ${id} created for ${guestName}`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb="Reservations"
        title="Table Reservations & Waitlist Desk"
        subtitle="Manage guest bookings, special occasion requests, table assignments, and walk-in waitlist seating"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setResStatus("waitlist");
                setNewModalOpen(true);
              }}
              className="gap-1.5"
            >
              <Clock className="h-4 w-4 text-warning" />
              Add to Waitlist
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setResStatus("confirmed");
                setNewModalOpen(true);
              }}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              New Reservation
            </Button>
          </>
        }
      />

      {/* Filter & Date Strip */}
      <div className="surface p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            ["all", "booked", "confirmed", "seated", "waitlist", "completed", "cancelled"] as const
          ).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
                statusFilter === st
                  ? "bg-navy text-navy-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              )}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="All Dates" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dates</SelectItem>
              {uniqueDates.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative w-56">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search guest, phone, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Main Split: Reservations Table (Left 2/3) + Waitlist Queue (Right 1/3) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 items-start">
        <div className="surface overflow-hidden lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase">
                  <th className="py-3 px-4">Guest</th>
                  <th className="py-3 px-3">Date & Time</th>
                  <th className="py-3 px-3">Party</th>
                  <th className="py-3 px-3">Assigned Table</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredReservations.map((res) => (
                  <tr key={res.id} className="hover:bg-muted/30">
                    <td className="py-2.5 px-4">
                      <div className="font-bold text-foreground">
                        {res.name}{" "}
                        <span className="font-mono text-[10px] font-normal text-muted-foreground">
                          ({res.id})
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">{res.phone}</div>
                      {res.request && (
                        <div className="mt-0.5 text-[11px] font-medium text-ai">
                          Note: {res.request}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 tabular">
                      <div className="font-semibold">{res.time}</div>
                      <div className="text-[11px] text-muted-foreground">{res.date}</div>
                    </td>
                    <td className="py-2.5 px-3 font-semibold">{res.party} guests</td>
                    <td className="py-2.5 px-3">
                      <Select
                        value={res.tableId ?? "unassigned"}
                        onValueChange={(v) => {
                          assignReservationTable(res.id, v === "unassigned" ? undefined : v);
                          toast.success(
                            v === "unassigned"
                              ? `Unassigned table from ${res.id}`
                              : `Assigned Table ${v} to ${res.name}`,
                          );
                        }}
                      >
                        <SelectTrigger className="h-7 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {tables.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name} ({t.capacity}p · {t.area})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "uppercase text-[10px]",
                          res.status === "confirmed" || res.status === "seated"
                            ? "border-success/40 bg-success-soft text-success"
                            : res.status === "waitlist"
                              ? "border-warning/40 bg-warning-soft text-warning"
                              : res.status === "cancelled"
                                ? "border-destructive/40 bg-danger-soft text-destructive"
                                : "border-primary/30 bg-info-soft text-primary",
                        )}
                      >
                        {res.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        {res.status === "booked" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => {
                              updateReservationStatus(res.id, "confirmed");
                              toast.success(`Confirmed ${res.name}`);
                            }}
                          >
                            Confirm
                          </Button>
                        )}
                        {(res.status === "booked" ||
                          res.status === "confirmed" ||
                          res.status === "waitlist") && (
                          <Button
                            size="sm"
                            className="h-7 px-2.5 text-[11px] gap-1"
                            onClick={() => {
                              const tbl = res.tableId ?? "T2";
                              updateReservationStatus(res.id, "seated", tbl);
                              openPosForTable(tbl);
                              toast.success(`Seated ${res.name} at Table ${tbl}`);
                              navigate({ to: "/pos" });
                            }}
                          >
                            <UserCheck className="h-3 w-3" /> Seat
                          </Button>
                        )}
                        {res.status !== "cancelled" && res.status !== "completed" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px] text-destructive"
                            onClick={() => {
                              updateReservationStatus(res.id, "cancelled");
                              toast.info(`Cancelled ${res.id}`);
                            }}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Active Walk-in Waitlist Panel */}
        <div className="surface p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-sm font-bold text-foreground">Walk-In Waitlist Queue</h2>
              <p className="text-xs text-muted-foreground">
                Assign available tables as soon as covers turn over
              </p>
            </div>
            <Badge className="bg-warning text-white">{waitlistReservations.length} waiting</Badge>
          </div>

          {waitlistReservations.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No guests currently on the waitlist.
            </div>
          ) : (
            <div className="space-y-3">
              {waitlistReservations.map((w, idx) => (
                <div
                  key={w.id}
                  className="rounded-xl border border-warning/30 bg-warning-soft/40 p-3.5 text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">
                      #{idx + 1} · {w.name}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {w.party} guests
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {w.phone} · Quoted slot: {w.time}
                  </div>
                  {w.request && (
                    <div className="text-[11px] italic text-foreground">"{w.request}"</div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      className="h-7 flex-1 text-xs"
                      onClick={() => {
                        const freeTable =
                          tables.find((t) => t.status === "available" && t.capacity >= w.party) ??
                          tables.find((t) => t.status === "available");
                        const targetId = freeTable?.id ?? "T2";
                        updateReservationStatus(w.id, "seated", targetId);
                        openPosForTable(targetId);
                        toast.success(`Seated waitlist guest ${w.name} at Table ${targetId}`);
                        navigate({ to: "/pos" });
                      }}
                    >
                      Assign Free Table & Seat
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Reservation / Waitlist Dialog */}
      <Dialog open={newModalOpen} onOpenChange={setNewModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {resStatus === "waitlist" ? "Add Guest to Waitlist" : "Create Table Reservation"}
            </DialogTitle>
            <DialogDescription>
              Link a table now or assign when the party arrives.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-xs">Guest Name</Label>
                <Input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="e.g. Nitin Reddy"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Phone Number</Label>
                <Input
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="+91 98480 55443"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={resDate}
                  onChange={(e) => setResDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Time</Label>
                <Input
                  type="time"
                  value={resTime}
                  onChange={(e) => setResTime(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Party Size</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={resParty}
                  onChange={(e) => setResParty(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-xs">Assign Table</Label>
                <Select value={resTableId} onValueChange={setResTableId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {tables.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.area} · {t.capacity}p)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Booking Status</Label>
                <Select
                  value={resStatus}
                  onValueChange={(v) => setResStatus(v as Reservation["status"])}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="booked">Booked</SelectItem>
                    <SelectItem value="waitlist">Waitlist</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Special Request / Occasion</Label>
              <Input
                value={resRequest}
                onChange={(e) => setResRequest(e.target.value)}
                placeholder="e.g. Window table, Birthday cake at 8:30pm"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setNewModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreateReservation}>
              Save Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
