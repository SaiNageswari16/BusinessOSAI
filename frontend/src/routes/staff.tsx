import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Clock,
  Coffee,
  LogIn,
  LogOut,
  Phone,
  Plus,
  Search,
  Star,
  UserCheck,
  Users,
} from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { KpiCard, PageHeader, Panel } from "@/components/common/PageHeader";
import { StatusBadge, type Tone } from "@/components/common/StatusBadge";
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
  addStaffMember,
  clockInStaff,
  clockOutStaff,
  updateStaffStatus,
  useStaff,
  useStaffShifts,
} from "@/services/orderService";
import type { StaffMember } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/staff")({
  head: () => ({
    meta: [
      { title: "Staff & Shifts — RestaurantOS" },
      {
        name: "description",
        content: "Employee scheduling, attendance, shift tracking, and staff performance.",
      },
      { property: "og:title", content: "Staff & Shifts — RestaurantOS" },
      {
        property: "og:description",
        content: "Employee scheduling, attendance, shift tracking, and staff performance.",
      },
    ],
  }),
  component: StaffPage,
});

const statusTones: Record<StaffMember["status"], Tone> = {
  "On shift": "success",
  Break: "warning",
  Off: "neutral",
  Leave: "critical",
};

const roles = [
  "All",
  "Branch Manager",
  "Head Chef",
  "Tandoor Chef",
  "Captain",
  "Server",
  "Cashier",
  "Line Cook",
  "Host",
] as const;

function StaffPage() {
  const staff = useStaff();
  const shifts = useStaffShifts();
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"All" | StaffMember["status"]>("All");
  const [q, setQ] = useState("");
  const [openAdd, setOpenAdd] = useState(false);
  const [tab, setTab] = useState<"directory" | "shifts">("directory");

  const [form, setForm] = useState({
    name: "",
    role: "Server",
    shift: "12:00–21:00",
    phone: "",
    rating: "4.8",
    hoursWeek: "40",
  });

  const filteredStaff = staff.filter((s) => {
    const matchesRole = roleFilter === "All" || s.role === roleFilter;
    const matchesStatus = statusFilter === "All" || s.status === statusFilter;
    const matchesQuery = `${s.name} ${s.role} ${s.phone}`.toLowerCase().includes(q.toLowerCase());
    return matchesRole && matchesStatus && matchesQuery;
  });

  const onShiftCount = staff.filter((s) => s.status === "On shift").length;
  const onBreakCount = staff.filter((s) => s.status === "Break").length;
  const avgRating = (staff.reduce((s, m) => s + m.rating, 0) / (staff.length || 1)).toFixed(1);

  const handleAddStaff = () => {
    if (!form.name || !form.phone) {
      toast.error("Please enter staff member name and contact phone");
      return;
    }
    addStaffMember({
      name: form.name,
      role: form.role,
      shift: form.shift,
      status: "Off",
      phone: form.phone,
      rating: parseFloat(form.rating) || 4.5,
      hoursWeek: parseInt(form.hoursWeek, 10) || 40,
    });
    toast.success(`${form.name} added to staff team`);
    setOpenAdd(false);
    setForm({
      name: "",
      role: "Server",
      shift: "12:00–21:00",
      phone: "",
      rating: "4.8",
      hoursWeek: "40",
    });
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Human Resources"
        title="Staff & Shifts"
        description={`${staff.length} active team members · Hyderabad Banjara Hills`}
        actions={
          <div className="flex gap-2">
            <div className="flex rounded-md border p-0.5">
              <button
                onClick={() => setTab("directory")}
                className={cn(
                  "rounded px-3 py-1 text-xs",
                  tab === "directory"
                    ? "bg-primary font-medium text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                Team Directory
              </button>
              <button
                onClick={() => setTab("shifts")}
                className={cn(
                  "rounded px-3 py-1 text-xs",
                  tab === "shifts"
                    ? "bg-primary font-medium text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                Shift Schedule
              </button>
            </div>
            <Button onClick={() => setOpenAdd(true)}>
              <Plus className="size-4" /> Add staff
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="On shift right now"
          value={String(onShiftCount)}
          sub={`of ${staff.length} members`}
          icon={<UserCheck />}
        />
        <KpiCard label="On break" value={String(onBreakCount)} icon={<Coffee />} />
        <KpiCard label="Avg team rating" value={`${avgRating} / 5.0`} delta={2.4} icon={<Star />} />
        <KpiCard label="Scheduled shifts today" value={String(shifts.length)} icon={<Clock />} />
      </div>

      {tab === "directory" ? (
        <Panel bodyClass="p-0">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <div className="flex flex-wrap gap-1">
              {(["All", "On shift", "Break", "Off", "Leave"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs transition-colors",
                    statusFilter === st
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {st}{" "}
                  <span className="opacity-75">
                    ({st === "All" ? staff.length : staff.filter((s) => s.status === st).length})
                  </span>
                </button>
              ))}
            </div>

            <div className="relative ml-auto flex w-full flex-wrap gap-2 sm:w-auto">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative w-full sm:w-48">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search staff..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Employee</th>
                  <th className="font-medium">Role</th>
                  <th className="font-medium">Shift timing</th>
                  <th className="font-medium">Status</th>
                  <th className="font-medium">Rating</th>
                  <th className="font-medium">Hours / Wk</th>
                  <th className="px-4 text-right font-medium">Quick actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((member) => (
                  <tr key={member.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{member.name}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="size-3" /> {member.phone}
                      </div>
                    </td>
                    <td className="text-muted-foreground">{member.role}</td>
                    <td className="font-mono text-xs text-muted-foreground">{member.shift}</td>
                    <td>
                      <StatusBadge status={member.status} tone={statusTones[member.status]} />
                    </td>
                    <td>
                      <div className="flex items-center gap-1 font-medium">
                        <Star className="size-3.5 fill-warning text-warning" />
                        <span>{member.rating.toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="font-mono text-xs tabular text-muted-foreground">
                      {member.hoursWeek} hrs
                    </td>
                    <td className="px-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        {member.status !== "On shift" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => {
                              clockInStaff(member.id);
                              toast.success(`${member.name} clocked in`);
                            }}
                          >
                            <LogIn className="size-3 mr-1" /> Clock in
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => {
                                updateStaffStatus(member.id, "Break");
                                toast(`${member.name} is on break`);
                              }}
                            >
                              <Coffee className="size-3 mr-1" /> Break
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-critical hover:bg-critical/10"
                              onClick={() => {
                                clockOutStaff(member.id);
                                toast.success(`${member.name} clocked out`);
                              }}
                            >
                              <LogOut className="size-3 mr-1" /> Clock out
                            </Button>
                          </>
                        )}
                        {member.status === "Break" && (
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              updateStaffStatus(member.id, "On shift");
                              toast.success(`${member.name} resumed shift`);
                            }}
                          >
                            Resume
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredStaff.length && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                      No staff members match the selected criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : (
        <Panel title="Today's Shift Schedule & Attendance" bodyClass="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Shift ID</th>
                  <th className="font-medium">Staff member</th>
                  <th className="font-medium">Role</th>
                  <th className="font-medium">Scheduled slot</th>
                  <th className="font-medium">Clock in</th>
                  <th className="font-medium">Clock out</th>
                  <th className="px-4 text-right font-medium">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((sh) => (
                  <tr key={sh.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-2.5 font-mono text-xs">{sh.id}</td>
                    <td className="font-medium">{sh.staffName}</td>
                    <td className="text-muted-foreground">{sh.role}</td>
                    <td className="font-mono text-xs">{sh.shift}</td>
                    <td className="font-mono text-xs text-muted-foreground">{sh.clockIn ?? "—"}</td>
                    <td className="font-mono text-xs text-muted-foreground">
                      {sh.clockOut ?? "—"}
                    </td>
                    <td className="px-4 text-right">
                      <StatusBadge
                        status={sh.status}
                        tone={
                          sh.status === "On shift"
                            ? "success"
                            : sh.status === "Completed"
                              ? "neutral"
                              : "warning"
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Add Staff Dialog */}
      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Rohini Sharma"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles
                      .filter((r) => r !== "All")
                      .map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Shift timing</Label>
                <Select value={form.shift} onValueChange={(v) => setForm({ ...form, shift: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="07:00–15:00">Morning (07:00–15:00)</SelectItem>
                    <SelectItem value="10:00–18:00">General (10:00–18:00)</SelectItem>
                    <SelectItem value="12:00–21:00">Afternoon (12:00–21:00)</SelectItem>
                    <SelectItem value="16:00–23:30">Evening (16:00–23:30)</SelectItem>
                    <SelectItem value="11:00–23:00">Full day (11:00–23:00)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Phone number</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91 98480 00000"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Weekly Hours</Label>
                <Input
                  type="number"
                  value={form.hoursWeek}
                  onChange={(e) => setForm({ ...form, hoursWeek: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Initial Rating</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="1"
                  max="5"
                  value={form.rating}
                  onChange={(e) => setForm({ ...form, rating: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAdd(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddStaff}>Add Member</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
