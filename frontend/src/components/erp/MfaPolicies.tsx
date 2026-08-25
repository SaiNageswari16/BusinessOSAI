import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, ShieldCheck, Plus, Smartphone, Fingerprint, Lock, X, Save, Loader2, AlertCircle, Trash2, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useCurrency } from "@/hooks/use-currency";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

interface Role {
  id: string;
  name: string;
}

interface MfaPolicy {
  id: string;
  role_id: string | null;
  methods: string;
  timeout: string;
  restrict_ip: boolean;
  status: string;
  created_at: string;
}

function MfaPolicyModal({
  policy,
  roles,
  onClose,
  onSaved,
}: {
  policy: MfaPolicy | null;
  roles: Role[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { accessToken } = useAuth();
  const isEdit = !!policy;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    role_id: policy?.role_id ?? "",
    methods: policy?.methods ?? "Authenticator",
    timeout: policy?.timeout ?? "12 hours",
    restrict_ip: policy?.restrict_ip ?? false,
    status: policy?.status ?? "active",
  });

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        role_id: form.role_id || null,
      };
      const url = isEdit
        ? `${API_BASE_URL}/erp/mfa-policies/${policy.id}`
        : `${API_BASE_URL}/erp/mfa-policies`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save MFA policy");
      toast.success(isEdit ? "MFA Policy updated" : "MFA Policy created");
      onSaved();
      onClose();
    } catch (err) {
      console.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg flex items-center gap-2"><Lock className="size-5 text-primary" />{isEdit ? "Configure MFA Policy" : "Add MFA Policy"}</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5">Target Role (or leave blank for Global)</label>
            <select value={form.role_id} onChange={set("role_id")}
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
              <option value="">Global policy (Apply to all roles)</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5">MFA Verification Method *</label>
            <select value={form.methods} onChange={set("methods")} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
              <option value="Authenticator">Authenticator App (TOTP)</option>
              <option value="Biometric">Biometrics (WebAuthn)</option>
              <option value="Authenticator, Biometric">Authenticator & Biometrics</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5">Session Re-auth Timeout</label>
            <select value={form.timeout} onChange={set("timeout")}
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
              <option value="1 hour">1 hour</option>
              <option value="12 hours">12 hours</option>
              <option value="24 hours">24 hours</option>
              <option value="7 days">7 days</option>
              <option value="30 days">30 days</option>
            </select>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <input type="checkbox" id="restrict_ip" checked={form.restrict_ip}
              onChange={(e) => setForm((p) => ({ ...p, restrict_ip: e.target.checked }))}
              className="size-4 rounded" />
            <label htmlFor="restrict_ip" className="text-sm font-medium">Restrict access to trusted IPs only</label>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5">Status</label>
            <select value={form.status} onChange={set("status")}
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="gradient-brand text-white border-0 min-w-[100px]">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <><Save className="size-4 mr-1.5" />Save</>}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export function MfaPolicies() {
    const { currency, formatCurrency } = useCurrency();
  const { accessToken } = useAuth();
  const [policies, setPolicies] = useState<MfaPolicy[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editPolicy, setEditPolicy] = useState<MfaPolicy | null>(null);
  const [deletePolicy, setDeletePolicy] = useState<MfaPolicy | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [pRes, rRes] = await Promise.all([
        fetch(`${API_BASE_URL}/erp/mfa-policies`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch(`${API_BASE_URL}/erp/roles?page=1&page_size=100`, { headers: { Authorization: `Bearer ${accessToken}` } }),
      ]);
      if (!pRes.ok || !rRes.ok) throw new Error("Failed to load MFA metadata");
      const pData = await pRes.json();
      const rData = await rRes.json();
      setPolicies(pData);
      setRoles(rData.items);
    } catch (err) {
      console.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { void load(); }, [load]);

  const handleDelete = async () => {
    if (!deletePolicy || !accessToken) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/erp/mfa-policies/${deletePolicy.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to delete policy");
      toast.success("MFA Policy deleted");
      setDeletePolicy(null);
      void load();
    } catch (err) {
      console.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setDeleting(false);
    }
  };

  const roleMap = Object.fromEntries(roles.map((r) => [r.id, r.name]));

  const filtered = policies.filter((p) => {
    const roleName = p.role_id ? (roleMap[p.role_id] ?? "").toLowerCase() : "global";
    return roleName.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold tracking-tight">MFA Policies</h2>
          <p className="text-xs text-muted-foreground">Configure global authentication rules, timeouts, and device trust.</p>
        </div>
        <Button size="sm" className="h-8 gradient-brand text-white border-0 gap-1.5 text-xs font-semibold" onClick={() => { setEditPolicy(null); setShowModal(true); }}>
          <Plus className="size-3.5" /> Add Policy
        </Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 text-sm rounded-lg border bg-card focus:ring-2 focus:ring-primary/20 outline-none"
            placeholder="Search target role..." />
        </div>
        <Button variant="outline" className="gap-2 h-10" onClick={load}>
          <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-44 rounded-xl border bg-muted/30 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/10 rounded-2xl border border-dashed">
          <ShieldCheck className="size-10 mx-auto mb-3 text-muted-foreground opacity-20" />
          <p className="text-sm text-muted-foreground">No custom MFA policies configured</p>
          <Button size="sm" className="mt-4 gradient-brand text-white border-0" onClick={() => { setEditPolicy(null); setShowModal(true); }}>
            <Plus className="size-4 mr-1" /> Add Policy
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {filtered.map((policy) => (
            <Card key={policy.id} className="p-6 border-t-4 border-t-primary relative group">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1">
                    <ShieldCheck className="size-3" /> Target Role
                  </div>
                  <h3 className="font-bold text-base text-foreground">
                    {policy.role_id ? roleMap[policy.role_id] ?? "Unknown Role" : "Global Policy"}
                  </h3>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${policy.status === "active" ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                    {policy.status}
                  </span>
                  <Button variant="ghost" size="icon" className="size-7 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setDeletePolicy(policy)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1">Allowed Methods</div>
                  <div className="flex items-center gap-2 font-semibold text-xs text-foreground bg-muted p-2 rounded-lg">
                    {policy.methods.includes("Biometric") ? <Fingerprint className="size-4 text-primary" /> : <Smartphone className="size-4 text-primary" />}
                    <span>{policy.methods}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t text-xs">
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-0.5">Session Re-auth</div>
                    <div className="font-semibold flex items-center gap-1"><Lock className="size-3 text-primary" /> {policy.timeout}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-0.5">IP Restrictions</div>
                    <div className="font-semibold">{policy.restrict_ip ? "Strict Only" : "None"}</div>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => { setEditPolicy(policy); setShowModal(true); }}>
                  Configure Rules
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showModal && <MfaPolicyModal policy={editPolicy} roles={roles} onClose={() => setShowModal(false)} onSaved={load} />}
        {deletePolicy && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-card border rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-lg bg-red-500/10 text-red-500 grid place-items-center"><AlertCircle className="size-5" /></div>
                <h3 className="font-bold">Delete MFA Policy</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">Are you sure you want to delete this MFA policy? Access verification for target roles will revert to global defaults.</p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeletePolicy(null)}>Cancel</Button>
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
