import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Search, Plus, Edit2, Trash2, X, Save, Loader2, AlertCircle, Users, Network } from "lucide-react";
import { teamsApi, departmentsApi, type Team, type Department } from "@/lib/api-client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

function TeamFormModal({ team, departments, onClose, onSaved }: {
  team: Team | null; departments: Department[]; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!team;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    department_id: team?.department_id ?? (departments[0]?.id ?? ""),
    name: team?.name ?? "",
    status: team?.status ?? "active",
  });
  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (isEdit) { await teamsApi.update(team.id, form); toast.success("Team updated"); }
      else { await teamsApi.create(form); toast.success("Team created"); }
      onSaved(); onClose();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg flex items-center gap-2"><Users className="size-5 text-primary" />{isEdit ? "Edit Team" : "Add Team"}</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5">Department *</label>
            <select value={form.department_id} onChange={set("department_id")} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1.5">Team Name *</label>
              <input value={form.name} onChange={set("name")} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Frontend Team" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Status</label>
              <select value={form.status} onChange={set("status")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="gradient-brand text-white border-0 min-w-[100px]">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <><Save className="size-4 mr-1.5" />{isEdit ? "Update" : "Create"}</>}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export function Teams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [deleteTeam, setDeleteTeam] = useState<Team | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, dRes] = await Promise.all([teamsApi.list(1, 100), departmentsApi.list(1, 100)]);
      setTeams(tRes.items);
      setDepartments(dRes.items);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, []);

  const filtered = teams.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));

  const handleDelete = async () => {
    if (!deleteTeam) return;
    setDeleting(true);
    try {
      await teamsApi.delete(deleteTeam.id);
      toast.success("Team deleted");
      setDeleteTeam(null);
      void load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setDeleting(false); }
  };

  const deptMap = Object.fromEntries(departments.map((d) => [d.id, d.name]));

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Teams</h2>
          <p className="text-sm text-muted-foreground">Small cross-functional teams within departments.</p>
        </div>
        <Button className="gradient-brand text-white border-0 gap-2" onClick={() => { setEditTeam(null); setShowForm(true); }}>
          <Plus className="size-4" /> Add Team
        </Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30 outline-none"
            placeholder="Search teams..." />
        </div>
        <span className="text-xs text-muted-foreground">{teams.length} teams</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 rounded-xl border bg-muted/30 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Users className="size-10 mx-auto mb-3 text-muted-foreground opacity-20" />
          <p className="text-sm text-muted-foreground">No teams yet</p>
          <Button size="sm" className="mt-4 gradient-brand text-white border-0" onClick={() => { setEditTeam(null); setShowForm(true); }}>
            <Plus className="size-4 mr-1" /> Create Team
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((team) => (
            <Card key={team.id} className="p-4 hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between mb-3">
                <div className="size-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <Users className="size-4" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => { setEditTeam(team); setShowForm(true); }}><Edit2 className="size-3" /></Button>
                  <Button variant="ghost" size="icon" className="size-7 text-red-500" onClick={() => setDeleteTeam(team)}><Trash2 className="size-3" /></Button>
                </div>
              </div>
              <h3 className="font-semibold text-sm mb-1">{team.name}</h3>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                <Network className="size-3" />{deptMap[team.department_id] ?? "—"}
              </div>
              <span className={cn("text-[10px] font-medium", team.status === "active" ? "text-emerald-600" : "text-muted-foreground")}>
                {team.status.charAt(0).toUpperCase() + team.status.slice(1)}
              </span>
            </Card>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <TeamFormModal team={editTeam} departments={departments}
            onClose={() => { setShowForm(false); setEditTeam(null); }} onSaved={load} />
        )}
        {deleteTeam && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-card border rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-lg bg-red-500/10 text-red-500 grid place-items-center"><AlertCircle className="size-5" /></div>
                <h3 className="font-bold">Delete Team</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">Delete <span className="font-semibold text-foreground">{deleteTeam.name}</span>?</p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteTeam(null)}>Cancel</Button>
                <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
                  {deleting ? <Loader2 className="size-4 animate-spin mr-1" /> : <Trash2 className="size-4 mr-1" />} Delete
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
