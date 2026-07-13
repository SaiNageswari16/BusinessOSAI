import { useState, useEffect, useCallback } from "react";
import { notificationTemplatesApi, NotificationTemplate } from "../../lib/api-client";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Search, Plus, Bell, Mail, MessageSquare, Smartphone, Edit2, Trash2, Loader2, CheckCircle } from "lucide-react";

const CHANNELS = ["email", "sms", "in_app"];
const CHANNEL_ICONS: Record<string, React.ElementType> = { email: Mail, sms: Smartphone, in_app: MessageSquare };
const EVENTS = ["user.invite", "leave.approved", "leave.rejected", "payslip.generated", "order.created", "invoice.paid", "alert.system"];

function TemplateDialog({ open, onClose, initial, onSaved }: {
  open: boolean; onClose: () => void; initial?: NotificationTemplate; onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [event, setEvent] = useState(initial?.event ?? EVENTS[0]);
  const [channel, setChannel] = useState(initial?.channel ?? "email");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? ""); setEvent(initial?.event ?? EVENTS[0]);
      setChannel(initial?.channel ?? "email"); setSubject(initial?.subject ?? "");
      setBody(initial?.body ?? ""); setError("");
    }
  }, [open, initial]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setLoading(true); setError("");
    try {
      const data = { name, event, channel, subject: subject || null, body: body || null, is_active: true, status: "active" };
      if (initial) await notificationTemplatesApi.update(initial.id, data);
      else await notificationTemplatesApi.create(data);
      onSaved(); onClose();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to save"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4">{initial ? "Edit" : "Create"} Notification Template</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Name *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Leave Approval Email" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Event</label>
              <select value={event} onChange={e => setEvent(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                {EVENTS.map(ev => <option key={ev}>{ev}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Channel</label>
              <select value={channel} onChange={e => setChannel(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                {CHANNELS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          {channel === "email" && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Subject</label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject line..." />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Body / Message</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={5}
              placeholder="Template body. Use {{variable}} for dynamic content..."
              className="w-full px-3 py-2 text-sm rounded-md border bg-background resize-none font-mono" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1 gradient-brand text-white border-0" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : (initial ? "Update" : "Create")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function NotificationTemplates() {
  const [items, setItems] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NotificationTemplate | undefined>();
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await notificationTemplatesApi.list(page, 20, search || undefined, channelFilter || undefined);
      setItems(res.items); setTotal(res.total);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [page, search, channelFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    setDeleting(id);
    try { await notificationTemplatesApi.delete(id); load(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : "Delete failed"); }
    finally { setDeleting(null); }
  };

  const CHANNEL_COLORS: Record<string, string> = {
    email: "bg-blue-500/10 text-blue-600",
    sms: "bg-green-500/10 text-green-600",
    in_app: "bg-purple-500/10 text-purple-600",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Notification Templates</h2>
          <p className="text-sm text-muted-foreground">Email, SMS, and in-app notification templates. <span className="font-medium text-primary">{total} total</span></p>
        </div>
        <Button className="gradient-brand text-white border-0" onClick={() => { setEditing(undefined); setDialogOpen(true); }}>
          <Plus className="size-4 mr-2" /> Create Template
        </Button>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
            placeholder="Search templates..." />
        </div>
        <select value={channelFilter} onChange={e => { setChannelFilter(e.target.value); setPage(1); }}
          className="h-10 px-3 text-sm rounded-lg border bg-card">
          <option value="">All Channels</option>
          {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading && <div className="flex items-center justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>}
      {error && <div className="p-4 rounded-xl bg-red-500/10 text-red-600 text-sm border border-red-500/20">{error}</div>}

      {!loading && !error && (
        <div className="bg-card border rounded-xl overflow-hidden">
          {items.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Bell className="size-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No templates found</p>
              <p className="text-sm">Create notification templates for automated messaging.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
                <tr>
                  <th className="px-5 py-4 text-left">Template Name</th>
                  <th className="px-5 py-4 text-left">Event</th>
                  <th className="px-5 py-4 text-left">Channel</th>
                  <th className="px-5 py-4 text-left">Status</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map(tpl => {
                  const Icon = CHANNEL_ICONS[tpl.channel] || Bell;
                  return (
                    <tr key={tpl.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`size-8 rounded-lg grid place-items-center ${CHANNEL_COLORS[tpl.channel] || "bg-muted"}`}>
                            <Icon className="size-4" />
                          </div>
                          <div>
                            <p className="font-medium">{tpl.name}</p>
                            {tpl.subject && <p className="text-xs text-muted-foreground truncate max-w-48">{tpl.subject}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs">{tpl.event}</td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${CHANNEL_COLORS[tpl.channel] || "bg-muted"}`}>
                          {tpl.channel}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${tpl.is_active ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                          {tpl.is_active ? <CheckCircle className="size-3" /> : null}{tpl.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(tpl); setDialogOpen(true); }}>
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleDelete(tpl.id)} disabled={deleting === tpl.id}>
                          {deleting === tpl.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <span className="text-sm text-muted-foreground self-center">Page {page}</span>
          <Button variant="outline" size="sm" disabled={items.length < 20} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      <TemplateDialog open={dialogOpen} onClose={() => setDialogOpen(false)} initial={editing} onSaved={load} />
    </div>
  );
}
