import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ShieldCheck,
  UserPlus,
  UserX,
  Users,
  RefreshCw,
} from "lucide-react";
import {
  platformService,
  type PlatformAdminRecord,
} from "@/services/platformService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/platform/admins")({
  head: () => ({
    meta: [
      { title: "Control-Plane Admin Users — Platform Super Admin" },
      {
        name: "description",
        content: "Provision and manage platform realm admin accounts.",
      },
    ],
  }),
  component: PlatformAdminsPage,
});

const ROLE_OPTIONS = [
  { value: "super_admin", label: "Super Admin", color: "border-rose-200 bg-rose-50 text-rose-700" },
  { value: "ops_admin", label: "Ops Admin", color: "border-amber-200 bg-amber-50 text-amber-700" },
  { value: "support_admin", label: "Support Admin", color: "border-sky-200 bg-sky-50 text-sky-700" },
  { value: "billing_admin", label: "Billing Admin", color: "border-violet-200 bg-violet-50 text-violet-700" },
];

function roleLabel(role: string) {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
}

function roleColor(role: string) {
  return ROLE_OPTIONS.find((r) => r.value === role)?.color ?? "border-slate-200 bg-slate-100 text-slate-600";
}

function PlatformAdminsPage() {
  const [admins, setAdmins] = useState<PlatformAdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "ops_admin",
  });

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const res = await platformService.getAdmins();
      setAdmins(res.items);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load admins";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await platformService.createAdmin(form);
      toast.success(`Platform admin '${form.email}' provisioned`);
      setModalOpen(false);
      setForm({ email: "", password: "", full_name: "", role: "ops_admin" });
      fetchAdmins();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create admin";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (admin: PlatformAdminRecord, active: boolean) => {
    try {
      await platformService.updateAdmin(admin.id, { is_active: active });
      toast.success(
        active ? `Re-activated '${admin.email}'` : `Deactivated '${admin.email}'`
      );
      fetchAdmins();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update admin";
      toast.error(message);
    }
  };

  const handleRoleChange = async (admin: PlatformAdminRecord, role: string) => {
    try {
      await platformService.updateAdmin(admin.id, { role });
      toast.success(`Role for '${admin.email}' updated to ${roleLabel(role)}`);
      fetchAdmins();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update role";
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Users className="size-6 text-sky-600" />
            Control-Plane Admin Users
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Provision and manage platform realm accounts. Deactivation is the account kill-switch.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAdmins}
            disabled={loading}
            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs h-8 shadow-xs"
          >
            <RefreshCw className={cn("size-3.5 mr-1.5", loading && "animate-spin")} />
            Reload
          </Button>

          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 shadow-xs">
                <UserPlus className="size-3.5 mr-1.5" />
                Provision Admin
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-white border-slate-200 text-slate-900 shadow-xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="size-5 text-sky-600" />
                  New Platform Admin
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  This account gets platform realm access. The action is written to the audit trail.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreate} className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-700 font-medium">Full Name</Label>
                  <Input
                    required
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    placeholder="e.g. Jane Operator"
                    className="bg-white border-slate-200 text-slate-900 text-xs h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-700 font-medium">Email</Label>
                  <Input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="ops@platform.com"
                    className="bg-white border-slate-200 text-slate-900 text-xs h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-700 font-medium">Initial Password</Label>
                  <Input
                    type="password"
                    required
                    minLength={8}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Min 8 characters"
                    className="bg-white border-slate-200 text-slate-900 text-xs h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-700 font-medium">Role</Label>
                  <Select value={form.role} onValueChange={(role) => setForm({ ...form, role })}>
                    <SelectTrigger className="bg-white border-slate-200 text-slate-900 text-xs h-8">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 text-slate-900 shadow-md">
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalOpen(false)}
                    className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs h-8 shadow-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 shadow-xs"
                  >
                    {submitting ? "Provisioning..." : "Provision Admin"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Admins Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-mono">
              <tr>
                <th className="py-3 px-4">Admin & Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Last Login</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {admins.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 text-xs">
                    No platform admin accounts found.
                  </td>
                </tr>
              ) : (
                admins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <div className="font-semibold text-slate-900">{admin.full_name}</div>
                        <div className="text-[10px] font-mono text-slate-500">{admin.email}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Select value={admin.role} onValueChange={(role) => handleRoleChange(admin, role)}>
                        <SelectTrigger className={cn("w-[150px] border text-[11px] h-7 font-mono", roleColor(admin.role), "bg-transparent")}>
                          <SelectValue>{roleLabel(admin.role)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-white border-slate-200 text-slate-900 shadow-md">
                          {ROLE_OPTIONS.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {admin.last_login_at ? new Date(admin.last_login_at).toLocaleString() : "Never"}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-mono",
                          admin.is_active
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-100 text-slate-500"
                        )}
                      >
                        {admin.is_active ? "ACTIVE" : "DEACTIVATED"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(admin, !admin.is_active)}
                        className={cn(
                          "text-xs h-7 gap-1.5",
                          admin.is_active
                            ? "text-rose-700 hover:text-rose-800 hover:bg-rose-50"
                            : "text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                        )}
                      >
                        {admin.is_active ? (
                          <>
                            <UserX className="size-3.5" /> Deactivate
                          </>
                        ) : (
                          <>
                            <UserPlus className="size-3.5" /> Reactivate
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
        <span className="font-semibold text-slate-800">Lockout guard: </span>
        A super admin cannot deactivate their own account. To retire a super admin,
        another active super admin must perform the deactivation — the last-super-admin
        self-lockout is the classic control-plane foot-gun this is built to prevent.
      </div>
    </div>
  );
}
