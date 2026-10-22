import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search, Star, UserCheck, Users } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { useRestaurantStore } from "@/lib/store";
import type { Staff } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/staff")({
  component: StaffScreen,
});

export function StaffScreen() {
  const staff = useRestaurantStore((s) => s.staff);
  const toggleStaffPresent = useRestaurantStore((s) => s.toggleStaffPresent);
  const updateStaffMember = useRestaurantStore((s) => s.updateStaffMember);
  const addStaffMember = useRestaurantStore((s) => s.addStaffMember);

  const [shiftFilter, setShiftFilter] = useState<"all" | Staff["shift"]>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Add Staff Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Server");
  const [shift, setShift] = useState<Staff["shift"]>("Morning");
  const [phone, setPhone] = useState("");
  const [assignment, setAssignment] = useState("Main Hall");

  const filteredStaff = useMemo(() => {
    return staff.filter((s) => {
      if (shiftFilter !== "all" && s.shift !== shiftFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.role.toLowerCase().includes(q) ||
          s.assignment.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [staff, shiftFilter, searchQuery]);

  const presentCount = staff.filter((s) => s.present).length;

  const handleAddStaff = () => {
    if (!name.trim() || !phone.trim()) {
      toast.error("Provide staff member name and phone");
      return;
    }
    addStaffMember({
      name: name.trim(),
      role: role.trim() || "Server",
      shift,
      present: true,
      phone: phone.trim(),
      rating: 4.5,
      assignment,
    });
    setModalOpen(false);
    setName("");
    setPhone("");
    toast.success(`Added ${name} to staff roster`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb="Staff"
        title="Staff Directory, Shifts & Attendance"
        subtitle="Manage kitchen brigadiers, captains, servers, cashiers, delivery riders, and shift attendance"
        actions={
          <Button size="sm" onClick={() => setModalOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add Staff Member
          </Button>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="surface p-4">
          <div className="text-xs text-muted-foreground">Total Roster</div>
          <div className="mt-1 text-2xl font-bold tabular">{staff.length}</div>
        </div>
        <div className="surface p-4">
          <div className="text-xs text-muted-foreground">On Duty (Present)</div>
          <div className="mt-1 text-2xl font-bold text-success tabular">{presentCount}</div>
        </div>
        <div className="surface p-4">
          <div className="text-xs text-muted-foreground">Kitchen Brigade</div>
          <div className="mt-1 text-2xl font-bold tabular">
            {staff.filter((s) => s.role.includes("Chef")).length}
          </div>
        </div>
        <div className="surface p-4">
          <div className="text-xs text-muted-foreground">Floor & Delivery</div>
          <div className="mt-1 text-2xl font-bold tabular">
            {staff.filter((s) => !s.role.includes("Chef")).length}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="surface p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {(["all", "Morning", "Evening", "Night"] as const).map((sh) => (
            <button
              key={sh}
              type="button"
              onClick={() => setShiftFilter(sh)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                shiftFilter === sh
                  ? "bg-navy text-navy-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              )}
            >
              {sh === "all" ? "All Shifts" : `${sh} Shift`}
            </button>
          ))}
        </div>

        <div className="relative w-64">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search staff, role, or station..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Staff Table */}
      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">Assigned Zone</th>
                <th className="py-3 px-3">Shift</th>
                <th className="py-3 px-3">Performance</th>
                <th className="py-3 px-4 text-right">Attendance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredStaff.map((member) => (
                <tr key={member.id} className="hover:bg-muted/30">
                  <td className="py-2.5 px-4">
                    <div className="font-bold text-foreground">
                      {member.name}{" "}
                      <span className="font-mono text-[10px] font-normal text-muted-foreground">
                        ({member.id})
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">{member.phone}</div>
                  </td>
                  <td className="py-2.5 px-3 font-medium">{member.role}</td>
                  <td className="py-2.5 px-3">
                    <Badge variant="secondary" className="text-[10px]">
                      {member.assignment}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-3">
                    <Select
                      value={member.shift}
                      onValueChange={(v) => {
                        updateStaffMember(member.id, { shift: v as Staff["shift"] });
                        toast.success(`Updated ${member.name} shift to ${v}`);
                      }}
                    >
                      <SelectTrigger className="h-7 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Morning">Morning</SelectItem>
                        <SelectItem value="Evening">Evening</SelectItem>
                        <SelectItem value="Night">Night</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="inline-flex items-center gap-1 font-semibold tabular">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {member.rating.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <Switch
                        checked={member.present}
                        onCheckedChange={() => {
                          toggleStaffPresent(member.id);
                          toast.info(
                            `${member.name} marked ${!member.present ? "Present" : "Off Duty"}`,
                          );
                        }}
                      />
                      <span
                        className={cn(
                          "w-14 text-left text-[11px] font-semibold",
                          member.present ? "text-success" : "text-muted-foreground",
                        )}
                      >
                        {member.present ? "Present" : "Absent"}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
            <DialogDescription>Enroll a new team member and assign shift.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Full Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mahesh Goud"
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-xs">Role</Label>
                <Input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="Server / Chef / Captain"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Phone</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 97000 11223"
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-xs">Shift</Label>
                <Select value={shift} onValueChange={(v) => setShift(v as Staff["shift"])}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Morning">Morning</SelectItem>
                    <SelectItem value="Evening">Evening</SelectItem>
                    <SelectItem value="Night">Night</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Assigned Area</Label>
                <Input
                  value={assignment}
                  onChange={(e) => setAssignment(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddStaff}>
              Save Employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
