import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Search, Plus, Edit2, Trash2, X, Save, Loader2, AlertCircle, Briefcase, Building2 } from "lucide-react";
import { designationsApi, companiesApi, type Designation, type Company } from "@/lib/api-client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const LEVEL_OPTIONS = ["C-Suite", "Director", "VP", "Senior Manager", "Manager", "Senior", "Mid", "Junior", "Intern", "Associate"];

function DesignationFormModal({ desig, companies, onClose, onSaved }: {
  desig: Designation | null; companies: Company[]; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!desig;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_id: desig?.company_id ?? (companies[0]?.id ?? ""),
    name: desig?.name ?? "",
    level: desig?.level ?? "",
    status: desig?.status ?? "active",
  });
  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (isEdit) { await designationsApi.update(desig.id, form); toast.success("Designation updated"); }
      else { await designationsApi.create(form); toast.success("Designation created"); }
      onSaved(); onClose();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg flex items-center gap-2"><Briefcase className="size-5 text-primary" />{isEdit ? "Edit Designation" : "Add Designation"}</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5">Company *</label>
            <select value={form.company_id} onChange={set("company_id")} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5">Designation Name *</label>
            <input value={form.name} onChange={set("name")} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Software Engineer" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5">Level</label>
              <select value={form.level} onChange={set("level")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
                <option value="">Select level</option>
                {LEVEL_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
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

const LEVEL_COLORS: Record<string, string> = {
  "C-Suite": "bg-purple-500/10 text-purple-600",
  "Director": "bg-blue-500/10 text-blue-600",
  "VP": "bg-indigo-500/10 text-indigo-600",
  "Senior Manager": "bg-cyan-500/10 text-cyan-600",
  "Manager": "bg-teal-500/10 text-teal-600",
  "Senior": "bg-green-500/10 text-green-600",
  "Mid": "bg-amber-500/10 text-amber-600",
  "Junior": "bg-orange-500/10 text-orange-600",
  "Intern": "bg-rose-500/10 text-rose-600",
};

export function DesignationManagement() {
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editDesig, setEditDesig] = useState<Designation | null>(null);
  const [deleteDesig, setDeleteDesig] = useState<Designation | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, cRes] = await Promise.all([designationsApi.list(1, 100), companiesApi.list(1, 100)]);
      setDesignations(dRes.items);
      setCompanies(cRes.items);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, []);

  const filtered = designations.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.level ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const handleDelete = async () => {
    if (!deleteDesig) return;
    setDeleting(true);
    try {
      await designationsApi.delete(deleteDesig.id);
      toast.success("Designation deleted");
      setDeleteDesig(null);
      void load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setDeleting(false); }
  };

  const companyMap = Object.fromEntries(companies.map((c) => [c.id, c.name]));

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Designation Management</h2>
          <p className="text-muted-foreground text-sm mt-1">Define job titles and seniority levels across your organization.</p>
        </div>
        <Button className="gradient-brand text-white border-0 gap-2" onClick={() => { setEditDesig(null); setShowForm(true); }}>
          <Plus className="size-4" /> Add Designation
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 text-sm rounded-lg border bg-card focus:ring-2 focus:ring-primary/20 outline-none"
            placeholder="Search designations..." />
        </div>
        <span className="text-xs text-muted-foreground self-center">{designations.length} total</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 rounded-xl border bg-muted/30 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Briefcase className="size-10 mx-auto mb-3 text-muted-foreground opacity-20" />
          <p className="text-sm text-muted-foreground">No designations yet</p>
          <Button size="sm" className="mt-4 gradient-brand text-white border-0" onClick={() => { setEditDesig(null); setShowForm(true); }}>
            <Plus className="size-4 mr-1" /> Add Designation
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((desig) => (
            <Card key={desig.id} className="p-4 hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between mb-3">
                <div className="size-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <Briefcase className="size-4" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => { setEditDesig(desig); setShowForm(true); }}><Edit2 className="size-3" /></Button>
                  <Button variant="ghost" size="icon" className="size-7 text-red-500 hover:text-red-600" onClick={() => setDeleteDesig(desig)}><Trash2 className="size-3" /></Button>
                </div>
              </div>
              <h3 className="font-semibold text-sm mb-1">{desig.name}</h3>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                <Building2 className="size-3" />{companyMap[desig.company_id] ?? "—"}
              </div>
              <div className="flex items-center justify-between">
                {desig.level ? (
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", LEVEL_COLORS[desig.level] ?? "bg-muted text-muted-foreground")}>
                    {desig.level}
                  </span>
                ) : <span />}
                <span className={cn("text-[10px] font-medium", desig.status === "active" ? "text-emerald-600" : "text-muted-foreground")}>
                  {desig.status.charAt(0).toUpperCase() + desig.status.slice(1)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <DesignationFormModal desig={editDesig} companies={companies}
            onClose={() => { setShowForm(false); setEditDesig(null); }} onSaved={load} />
        )}
        {deleteDesig && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-card border rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-lg bg-red-500/10 text-red-500 grid place-items-center"><AlertCircle className="size-5" /></div>
                <h3 className="font-bold">Delete Designation</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">Delete <span className="font-semibold text-foreground">{deleteDesig.name}</span>?</p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteDesig(null)}>Cancel</Button>
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
