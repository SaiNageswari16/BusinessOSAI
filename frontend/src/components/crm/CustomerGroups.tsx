import React, { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  Trash2,
  Users,
  X,
  UserMinus,
  UserPlus,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { crmGroupsApi, crmCustomersApi, type CustomerGroup, type CustomerGroupMember } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";

const blankGroup = { name: "", description: "", color: "#6366f1", is_active: true };

const PALETTE = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
];

export function CustomerGroups() {
    const { currency, formatCurrency } = useCurrency();
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [membersMap, setMembersMap] = useState<Record<string, CustomerGroupMember[]>>({});
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>(blankGroup);
  const [showAddMember, setShowAddMember] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [allCustomers, setAllCustomers] = useState<{ id: string; name: string }[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const response = await crmGroupsApi.list(1, 100, search || undefined);
      setGroups(response.items);
      setTotal(response.total);
    } catch {
      toast.error("Could not load customer groups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const loadCustomersList = async () => {
    if (allCustomers.length > 0) return;
    try {
      const response = await crmCustomersApi.list(1, 200);
      setAllCustomers(response.items.map((c) => ({ id: c.id, name: c.name })));
    } catch {
      /* ignore */
    }
  };

  const loadMembers = async (groupId: string) => {
    setLoadingMembers(true);
    try {
      const response = await crmGroupsApi.getMembers(groupId, 1, 100);
      setMembersMap((m) => ({ ...m, [groupId]: response.items }));
    } catch {
      toast.error("Could not load members");
    } finally {
      setLoadingMembers(false);
    }
  };

  const toggleExpand = async (groupId: string) => {
    if (expandedId === groupId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(groupId);
    if (!membersMap[groupId]) await loadMembers(groupId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        color: form.color,
        is_active: form.is_active,
      };
      if (editingId) {
        const updated = await crmGroupsApi.update(editingId, payload);
        setGroups((curr) => curr.map((g) => (g.id === editingId ? updated : g)));
        toast.success("Group updated");
      } else {
        const created = await crmGroupsApi.create(payload);
        setGroups((curr) => [created, ...curr]);
        setTotal((t) => t + 1);
        toast.success("Group created");
      }
      setShowForm(false);
      setForm(blankGroup);
      setEditingId(null);
    } catch {
      toast.error(editingId ? "Could not update group" : "Could not create group");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (group: CustomerGroup) => {
    setEditingId(group.id);
    setForm({ name: group.name, description: group.description || "", color: group.color, is_active: group.is_active });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this group? Members will be unassigned.")) return;
    try {
      await crmGroupsApi.delete(id);
      setGroups((curr) => curr.filter((g) => g.id !== id));
      setTotal((t) => t - 1);
      if (expandedId === id) setExpandedId(null);
      toast.success("Group deleted");
    } catch {
      toast.error("Could not delete group");
    }
  };

  const handleToggle = async (group: CustomerGroup) => {
    try {
      const updated = await crmGroupsApi.toggle(group.id, !group.is_active);
      setGroups((curr) => curr.map((g) => (g.id === group.id ? updated : g)));
    } catch {
      toast.error("Could not toggle group");
    }
  };

  const handleAddMembers = async (groupId: string) => {
    if (selectedMembers.length === 0) {
      toast.error("Select at least one customer");
      return;
    }
    try {
      const result = await crmGroupsApi.addMembers(groupId, { customer_ids: selectedMembers });
      await loadMembers(groupId);
      setGroups((curr) => curr.map((g) =>
        g.id === groupId ? { ...g, member_count: g.member_count + result.added } : g
      ));
      setShowAddMember(null);
      setSelectedMembers([]);
      toast.success(`${result.added} customer(s) added`);
    } catch {
      toast.error("Could not add members");
    }
  };

  const handleRemoveMember = async (groupId: string, customerId: string) => {
    try {
      await crmGroupsApi.removeMember(groupId, customerId);
      setMembersMap((m) => ({
        ...m,
        [groupId]: (m[groupId] || []).filter((mem) => mem.customer_id !== customerId),
      }));
      setGroups((curr) => curr.map((g) =>
        g.id === groupId ? { ...g, member_count: g.member_count - 1 } : g
      ));
      toast.success("Member removed");
    } catch {
      toast.error("Could not remove member");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customer Groups</h1>
          <p className="text-sm text-muted-foreground">
            Organize customers into groups for targeted campaigns and reporting.
          </p>
        </div>
        <button
          onClick={() => { setEditingId(null); setForm(blankGroup); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium"
        >
          <Plus className="size-4" /> New Group
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Groups" value={total} />
        <StatCard label="Active Groups" value={groups.filter((g) => g.is_active).length} />
        <StatCard label="Total Members" value={groups.reduce((s, g) => s + g.member_count, 0)} />
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">{editingId ? "Edit Group" : "New Group"}</h3>
            <button type="button" onClick={() => { setShowForm(false); setForm(blankGroup); setEditingId(null); }}>
              <X className="size-5 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Group Name *</label>
              <input required value={form.name as string} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
              <input value={form.description as string} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Color</label>
              <div className="flex gap-2 mt-1.5">
                {PALETTE.map((c) => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                    className={cn("size-7 rounded-full border-2 transition-all", form.color === c ? "border-foreground scale-110" : "border-transparent")}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setShowForm(false); setForm(blankGroup); setEditingId(null); }}
              className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
            <button disabled={saving} className="rounded-md bg-primary px-6 py-2 text-sm text-primary-foreground font-medium">
              {saving ? "Saving…" : editingId ? "Update Group" : "Create Group"}
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-4 glass-panel p-4 rounded-xl border border-border/50">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search groups..."
            className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm" />
        </div>
        <button onClick={() => load()} className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted">
          <RefreshCw className="size-4" />
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">Loading groups…</div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium w-8" />
                  <th className="text-left px-4 py-3 font-medium">Group</th>
                  <th className="text-left px-4 py-3 font-medium">Color</th>
                  <th className="text-left px-4 py-3 font-medium">Members</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {groups.map((group) => {
                  const isExpanded = expandedId === group.id;
                  const groupMembers = membersMap[group.id] || [];
                  return (
                    <React.Fragment key={group.id}>
                      <tr className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <button onClick={() => toggleExpand(group.id)} className="p-1 hover:bg-muted rounded-md">
                            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="size-3 rounded-full" style={{ backgroundColor: group.color }} />
                            <div>
                              <p className="font-medium">{group.name}</p>
                              {group.description && <p className="text-xs text-muted-foreground">{group.description}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block size-4 rounded-full border border-border" style={{ backgroundColor: group.color }} />
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Users className="size-3.5" /> {group.member_count}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => handleToggle(group)}
                            className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                              group.is_active ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
                            {group.is_active ? "Active" : "Inactive"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => handleEdit(group)} className="p-1.5 hover:bg-muted rounded-md" title="Edit">
                              <Plus className="size-3.5 rotate-45" />
                            </button>
                            <button onClick={() => handleDelete(group.id)} className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-md" title="Delete">
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="px-4 py-4 bg-muted/10">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium">Members ({groupMembers.length})</h4>
                                <button
                                  onClick={() => { void loadCustomersList(); setShowAddMember(group.id); setSelectedMembers([]); }}
                                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
                                  <UserPlus className="size-3.5" /> Add Member
                                </button>
                              </div>
                              {showAddMember === group.id && (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-background border border-border">
                                  <select
                                    multiple
                                    value={selectedMembers}
                                    onChange={(e) => {
                                      const values = Array.from(e.target.selectedOptions, (o) => o.value);
                                      setSelectedMembers(values);
                                    }}
                                    className="flex-1 min-h-[100px] rounded-md border border-border bg-background text-sm p-2"
                                  >
                                    {allCustomers.length === 0 && <option value="">Loading customers…</option>}
                                    {allCustomers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                  </select>
                                  <div className="flex flex-col gap-1">
                                    <button type="button" onClick={() => handleAddMembers(group.id)}
                                      className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground">Add</button>
                                    <button type="button" onClick={() => setShowAddMember(null)}
                                      className="px-3 py-1.5 text-xs rounded-md border border-border">Cancel</button>
                                  </div>
                                </div>
                              )}
                              {loadingMembers ? (
                                <p className="text-xs text-muted-foreground">Loading members…</p>
                              ) : groupMembers.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No members yet. Add members above.</p>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {groupMembers.map((m) => (
                                    <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-background border border-border">
                                      <div>
                                        <p className="text-sm font-medium">{m.customer_name || "Unknown"}</p>
                                        {m.customer_email && <p className="text-xs text-muted-foreground">{m.customer_email}</p>}
                                        <p className="text-xs text-muted-foreground mt-0.5">Joined {new Date(m.joined_at).toLocaleDateString()}</p>
                                      </div>
                                      <button onClick={() => handleRemoveMember(group.id, m.customer_id)}
                                        className="p-1 hover:bg-red-500/10 text-red-500 rounded-md">
                                        <UserMinus className="size-4" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {groups.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-16 text-muted-foreground">
                      {search ? "No groups match your search." : "No groups yet. Create your first group to get started."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-panel p-5 rounded-xl border border-border/50">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold flex gap-2 items-center"><Users className="size-5 text-primary" />{value.toLocaleString()}</p>
    </div>
  );
}
