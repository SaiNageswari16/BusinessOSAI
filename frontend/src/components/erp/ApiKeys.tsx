import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Network, Plus, Copy, RefreshCw, X, Save, Loader2, AlertCircle, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

interface ApiKey {
  id: string;
  name: string;
  service: string;
  env: string;
  secret_key: string;
  status: string;
  last_used_at: string | null;
  created_at: string;
}

function ApiKeyModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { accessToken } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    service: "",
    env: "Production",
    status: "active",
  });
  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/erp/api-keys`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to generate API Key");
      toast.success("API Key generated successfully");
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
          <h2 className="font-bold text-lg flex items-center gap-2"><Network className="size-5 text-primary" />Generate API Key</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5">Key Name *</label>
            <input value={form.name} onChange={set("name")} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Internal Analytics Sync" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5">Service/Target *</label>
            <input value={form.service} onChange={set("service")} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Webhooks / Stripe / Customs API" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5">Environment</label>
              <select value={form.env} onChange={set("env")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
                <option value="Production">Production</option>
                <option value="Sandbox">Sandbox</option>
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
              {saving ? <Loader2 className="size-4 animate-spin" /> : <><Save className="size-4 mr-1.5" />Generate</>}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export function ApiKeys() {
  const { accessToken } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [deleteKey, setDeleteKey] = useState<ApiKey | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/erp/api-keys`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to load API keys");
      const data = await res.json();
      setKeys(data);
    } catch (err) {
      console.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { void load(); }, [load]);

  const handleDelete = async () => {
    if (!deleteKey || !accessToken) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/erp/api-keys/${deleteKey.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to delete key");
      toast.success("API key deleted");
      setDeleteKey(null);
      void load();
    } catch (err) {
      console.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setDeleting(false);
    }
  };

  const copyToClipboard = (val: string) => {
    navigator.clipboard.writeText(val);
    toast.success("API Key copied to clipboard");
  };

  const filtered = keys.filter(
    (k) =>
      k.name.toLowerCase().includes(search.toLowerCase()) ||
      k.service.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">API Keys & Integrations</h2>
          <p className="text-sm text-muted-foreground">Manage active system tokens, webhooks, and 3rd party integrations.</p>
        </div>
        <Button className="gradient-brand text-white border-0 gap-2" onClick={() => setShowModal(true)}>
          <Plus className="size-4" /> Generate API Key
        </Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 text-sm rounded-lg border bg-card focus:ring-2 focus:ring-primary/20 outline-none"
            placeholder="Search API keys..." />
        </div>
        <Button variant="outline" className="gap-2 h-10" onClick={load}>
          <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-36 rounded-xl border bg-muted/30 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/10 rounded-2xl border border-dashed">
          <Network className="size-10 mx-auto mb-3 text-muted-foreground opacity-20" />
          <p className="text-sm text-muted-foreground">No active API keys found</p>
          <Button size="sm" className="mt-4 gradient-brand text-white border-0" onClick={() => setShowModal(true)}>
            <Plus className="size-4 mr-1" /> Generate API Key
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtered.map((api) => (
            <Card key={api.id} className="p-6 relative group">
              <div className="flex justify-between items-start mb-4 border-b pb-3">
                <div className="flex gap-3 items-center">
                  <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
                    <Network className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">{api.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded", api.env === "Production" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700")}>
                        {api.env}
                      </span>
                      <span className="text-xs text-muted-foreground">{api.service}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`size-2 rounded-full mr-2 ${api.status === "active" ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
                  <Button variant="ghost" size="icon" className="size-7 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setDeleteKey(api)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Secret Key</div>
                  <div className="flex bg-muted border rounded-lg overflow-hidden items-center">
                    <code className="px-3 py-1.5 text-xs font-mono flex-1 text-muted-foreground truncate select-all">
                      {api.secret_key}
                    </code>
                    <Button variant="ghost" className="h-full rounded-none border-l hover:bg-muted" onClick={() => copyToClipboard(api.secret_key)}>
                      <Copy className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Created: {new Date(api.created_at).toLocaleDateString()}</span>
                  <span>Last Used: {api.last_used_at ? new Date(api.last_used_at).toLocaleDateString() : "Never"}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showModal && <ApiKeyModal onClose={() => setShowModal(false)} onSaved={load} />}
        {deleteKey && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-card border rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-lg bg-red-500/10 text-red-500 grid place-items-center"><AlertCircle className="size-5" /></div>
                <h3 className="font-bold">Delete API Key</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">Are you sure you want to delete <span className="font-semibold text-foreground font-mono">{deleteKey.name}</span>? Integrations using this token will stop working immediately.</p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteKey(null)}>Cancel</Button>
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
