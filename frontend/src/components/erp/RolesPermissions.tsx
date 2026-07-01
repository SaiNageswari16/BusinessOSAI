import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, ShieldCheck, Users, Edit2, Trash2, Save, X,
  Check, Lock, Unlock, ChevronRight
} from "lucide-react";
import { mockRoles, mockUsers, Role, ALL_PERMISSIONS } from "@/data/mockRbacData";
import { cn } from "@/lib/utils";

const PERMISSION_LABELS: Record<string, string> = {
  "view:dashboard": "View Dashboard",
  "view:copilot": "Access AI Copilot",
  "view:erp": "View ERP / Back Office",
  "view:inventory": "View Inventory",
  "view:warehouse": "View Warehouse",
  "view:procurement": "View Procurement",
  "view:pos": "Use POS Terminal",
  "view:accounting": "View Accounting",
  "view:crm": "View CRM",
  "view:hrms": "View HRMS",
  "view:payroll": "View Payroll",
  "view:reports": "View Reports",
  "view:settings": "Change Settings",
  "manage:users": "Manage Users",
  "manage:roles": "Manage Roles & Permissions",
};

const PERMISSION_GROUPS: { label: string; keys: string[] }[] = [
  { label: "Workspace", keys: ["view:dashboard", "view:copilot"] },
  { label: "Core ERP", keys: ["view:erp", "manage:users", "manage:roles"] },
  { label: "Operations", keys: ["view:inventory", "view:warehouse", "view:procurement", "view:pos"] },
  { label: "Finance", keys: ["view:accounting", "view:payroll"] },
  { label: "Customer & Sales", keys: ["view:crm"] },
  { label: "People", keys: ["view:hrms"] },
  { label: "Intelligence", keys: ["view:reports"] },
  { label: "System", keys: ["view:settings"] },
];

function RoleFormModal({ role, onClose }: { role?: Role; onClose: () => void }) {
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [selectedPerms, setSelectedPerms] = useState<string[]>(role?.permissions ?? []);

  const toggle = (p: string) =>
    setSelectedPerms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const toggleGroup = (keys: string[]) => {
    const allSelected = keys.every(k => selectedPerms.includes(k));
    if (allSelected) {
      setSelectedPerms(prev => prev.filter(p => !keys.includes(p)));
    } else {
      setSelectedPerms(prev => [...new Set([...prev, ...keys])]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl"
      >
        <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-lg font-bold">{role ? "Edit Role" : "Create New Role"}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Define permissions granted to this role across all portals</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition">
            <X className="size-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Role Name</label>
              <input
                className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Branch Supervisor"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Description</label>
              <input
                className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" /> Module Permissions
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedPerms([...ALL_PERMISSIONS])}
                  className="text-xs text-primary hover:underline"
                >Grant All</button>
                <span className="text-muted-foreground">·</span>
                <button
                  onClick={() => setSelectedPerms([])}
                  className="text-xs text-destructive hover:underline"
                >Revoke All</button>
              </div>
            </div>

            <div className="space-y-4">
              {PERMISSION_GROUPS.map(group => {
                const allSelected = group.keys.every(k => selectedPerms.includes(k));
                const someSelected = group.keys.some(k => selectedPerms.includes(k));
                return (
                  <div key={group.label} className="border rounded-xl overflow-hidden">
                    <div
                      className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer"
                      onClick={() => toggleGroup(group.keys)}
                    >
                      <span className="text-sm font-semibold">{group.label}</span>
                      <div className={cn(
                        "size-5 rounded border-2 flex items-center justify-center transition",
                        allSelected ? "bg-primary border-primary" :
                          someSelected ? "border-primary" : "border-border"
                      )}>
                        {allSelected && <Check className="size-3 text-white" />}
                        {someSelected && !allSelected && <div className="size-2 rounded-sm bg-primary" />}
                      </div>
                    </div>
                    <div className="p-3 grid grid-cols-2 gap-2">
                      {group.keys.map(perm => (
                        <label
                          key={perm}
                          className="flex items-center gap-2 cursor-pointer"
                          onClick={() => toggle(perm)}
                        >
                          <div className={cn(
                            "size-4 rounded border-2 flex items-center justify-center transition shrink-0",
                            selectedPerms.includes(perm) ? "bg-primary border-primary" : "border-border hover:border-primary"
                          )}>
                            {selectedPerms.includes(perm) && <Check className="size-2.5 text-white" />}
                          </div>
                          <span className="text-sm">{PERMISSION_LABELS[perm] || perm}</span>
                          {selectedPerms.includes(perm)
                            ? <Unlock className="size-3 text-emerald-500 ml-auto" />
                            : <Lock className="size-3 text-muted-foreground ml-auto" />
                          }
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-sm text-primary">
            <strong>{selectedPerms.length}</strong> of {ALL_PERMISSIONS.length} permissions granted to this role.
          </div>
        </div>

        <div className="p-6 border-t flex justify-end gap-3 sticky bottom-0 bg-card">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border hover:bg-muted text-sm">Cancel</button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:bg-primary/90">
            <Save className="size-4" /> {role ? "Save Role" : "Create Role"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function RolesPermissions({ tab = "roles" }: { tab?: string }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role>(mockRoles[0]);
  const [showModal, setShowModal] = useState(false);
  const [editRole, setEditRole] = useState<Role | undefined>(undefined);

  const filtered = mockRoles.filter(r =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const usersForRole = (roleId: string) =>
    mockUsers.filter(u => u.assignedRoles.includes(roleId));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Roles & Permissions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure role-based access control. Each role controls which portals and modules a user can access.
          </p>
        </div>
        <button
          onClick={() => { setEditRole(undefined); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition"
        >
          <Plus className="size-4" /> New Role
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roles List */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 h-10 px-3 rounded-xl border bg-background">
            <Search className="size-4 text-muted-foreground" />
            <input
              className="bg-transparent flex-1 text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Search roles..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {filtered.map((role, i) => {
              const assignedCount = usersForRole(role.id).length;
              const isSelected = selectedRole.id === role.id;
              return (
                <motion.button
                  key={role.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => setSelectedRole(role)}
                  className={cn(
                    "w-full text-left p-4 rounded-xl border transition",
                    isSelected ? "bg-primary/5 border-primary/30" : "bg-card hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className={cn("size-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                      <span className={cn("font-semibold text-sm", isSelected && "text-primary")}>{role.name}</span>
                    </div>
                    {isSelected && <ChevronRight className="size-4 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{role.description}</p>
                  <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground">
                    <Users className="size-3" />
                    {assignedCount} user{assignedCount !== 1 ? "s" : ""} assigned
                    · {role.permissions.length} permissions
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Role Detail Panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card border rounded-xl p-5 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold">{selectedRole.name}</h2>
              <p className="text-sm text-muted-foreground">{selectedRole.description}</p>
            </div>
            <button
              onClick={() => { setEditRole(selectedRole); setShowModal(true); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm hover:bg-muted transition"
            >
              <Edit2 className="size-3.5" /> Edit
            </button>
          </div>

          {/* Users with this role */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="text-sm font-semibold">Users with this Role</h3>
            </div>
            <div className="divide-y">
              {usersForRole(selectedRole.id).length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No users assigned to this role yet.</div>
              ) : usersForRole(selectedRole.id).map(u => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="size-8 rounded-full gradient-brand text-white text-xs font-bold grid place-items-center shrink-0">
                    {u.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    u.status === "Active" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
                  )}>{u.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Permissions Granted */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-sm font-semibold">Permissions Granted</h3>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                {selectedRole.permissions.length} / {ALL_PERMISSIONS.length}
              </span>
            </div>
            <div className="p-4 space-y-3">
              {PERMISSION_GROUPS.map(group => {
                const grantedInGroup = group.keys.filter(k => selectedRole.permissions.includes(k));
                if (grantedInGroup.length === 0) return null;
                return (
                  <div key={group.label}>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group.label}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {group.keys.map(perm => {
                        const granted = selectedRole.permissions.includes(perm);
                        return (
                          <span
                            key={perm}
                            className={cn(
                              "text-xs px-2 py-0.5 rounded-full font-medium border",
                              granted
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                : "bg-muted text-muted-foreground line-through opacity-50"
                            )}
                          >
                            {granted ? <span className="inline-flex items-center gap-1"><Check className="size-2.5" />{PERMISSION_LABELS[perm]}</span> : PERMISSION_LABELS[perm]}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <RoleFormModal role={editRole} onClose={() => setShowModal(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
