import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, MoreHorizontal, Edit2, Trash2, ShieldCheck, Mail,
  Building2, GitBranch, Briefcase, CheckCircle, XCircle, UserPlus, Filter,
  ChevronDown, X, Save
} from "lucide-react";
import { mockUsers, mockRoles, AppUser, ALL_PERMISSIONS } from "@/data/mockRbacData";
import { companies, branches } from "@/data/mock";
import { cn } from "@/lib/utils";

const DEPARTMENTS = ["Engineering", "Sales", "Finance", "HR", "Operations", "Marketing"];

function StatusBadge({ status }: { status: "Active" | "Inactive" }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium",
      status === "Active" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
    )}>
      {status === "Active" ? <CheckCircle className="size-3" /> : <XCircle className="size-3" />}
      {status}
    </span>
  );
}

function UserFormModal({ user, onClose }: { user?: AppUser; onClose: () => void }) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [status, setStatus] = useState<"Active" | "Inactive">(user?.status ?? "Active");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(user?.assignedRoles ?? []);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([companies[0].id]);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);

  const toggleRole = (id: string) =>
    setSelectedRoles(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);

  const toggleDept = (d: string) =>
    setSelectedDepts(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

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
            <h2 className="text-lg font-bold">{user ? "Edit User" : "Create New User"}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Configure identity, roles, and access scope</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition">
            <X className="size-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Identity */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Mail className="size-4 text-primary" /> Identity</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Full Name</label>
                <input
                  className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={name} onChange={e => setName(e.target.value)} placeholder="e.g. John Smith"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Work Email</label>
                <input
                  type="email"
                  className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={email} onChange={e => setEmail(e.target.value)} placeholder="john@company.com"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <div className="flex gap-2">
                {(["Active", "Inactive"] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-sm font-medium border transition",
                      status === s ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"
                    )}
                  >{s}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Role Assignment */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /> Assign Roles</h3>
            <div className="grid grid-cols-2 gap-2">
              {mockRoles.map(role => (
                <label
                  key={role.id}
                  onClick={() => toggleRole(role.id)}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition",
                    selectedRoles.includes(role.id) ? "bg-primary/5 border-primary/40" : "hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "size-4 mt-0.5 rounded border-2 shrink-0 flex items-center justify-center transition",
                    selectedRoles.includes(role.id) ? "bg-primary border-primary" : "border-border"
                  )}>
                    {selectedRoles.includes(role.id) && <div className="size-2 bg-white rounded-sm" />}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{role.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{role.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Company Access */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Building2 className="size-4 text-primary" /> Company Access</h3>
            <div className="flex flex-wrap gap-2">
              {companies.map(c => (
                <button
                  key={c.id}
                  onClick={() =>
                    setSelectedCompanies(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])
                  }
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border transition",
                    selectedCompanies.includes(c.id) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                  )}
                >
                  {c.logo} {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Department Access */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Briefcase className="size-4 text-primary" /> Department Scope</h3>
            <div className="flex flex-wrap gap-2">
              {DEPARTMENTS.map(d => (
                <button
                  key={d}
                  onClick={() => toggleDept(d)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm border transition",
                    selectedDepts.includes(d) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                  )}
                >{d}</button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Leave empty to allow all departments.</p>
          </div>
        </div>

        <div className="p-6 border-t flex justify-end gap-3 sticky bottom-0 bg-card">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border hover:bg-muted text-sm">Cancel</button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:bg-primary/90">
            <Save className="size-4" /> {user ? "Save Changes" : "Create User"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function UserManagement({ tab = "users" }: { tab?: string }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | undefined>(undefined);

  const filtered = mockUsers.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === "All" || u.status === filterStatus;
    const matchRole = filterRole === "All" || u.assignedRoles.includes(filterRole);
    return matchSearch && matchStatus && matchRole;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Create users, assign roles, companies, branches, and departments.</p>
        </div>
        <button
          onClick={() => { setEditUser(undefined); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition"
        >
          <UserPlus className="size-4" /> New User
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Users", value: mockUsers.length, sub: "across all companies" },
          { label: "Active", value: mockUsers.filter(u => u.status === "Active").length, sub: "signed in recently" },
          { label: "Roles Configured", value: mockRoles.length, sub: "permission profiles" },
          { label: "Pending Invites", value: 2, sub: "awaiting response" },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-card rounded-xl border p-4">
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-sm font-medium mt-0.5">{s.label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 h-10 px-3 rounded-xl border bg-background flex-1 min-w-50">
          <Search className="size-4 text-muted-foreground" />
          <input
            className="bg-transparent flex-1 text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search users by name or email..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="h-10 px-3 rounded-xl border bg-background text-sm outline-none"
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="All">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
        <select
          className="h-10 px-3 rounded-xl border bg-background text-sm outline-none"
          value={filterRole} onChange={e => setFilterRole(e.target.value)}
        >
          <option value="All">All Roles</option>
          {mockRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">User</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assigned Roles</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => (
              <motion.tr
                key={u.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="border-b last:border-0 hover:bg-muted/20 transition"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-full gradient-brand text-white text-xs font-bold grid place-items-center shrink-0">
                      {u.avatar}
                    </div>
                    <div>
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.assignedRoles.map(rid => {
                      const role = mockRoles.find(r => r.id === rid);
                      return role ? (
                        <span key={rid} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          {role.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={u.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditUser(u); setShowModal(true); }}
                      className="p-1.5 rounded-lg hover:bg-muted transition text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 className="size-4" />
                    </button>
                    <button className="p-1.5 rounded-lg hover:bg-destructive/10 transition text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <UserFormModal user={editUser} onClose={() => setShowModal(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
