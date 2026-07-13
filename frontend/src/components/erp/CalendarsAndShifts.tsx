import { useState, useEffect, useCallback } from "react";
import { workCalendarsApi, WorkCalendar } from "../../lib/api-client";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Search, Plus, CalendarDays, Edit2, Trash2, Loader2, Clock, Star } from "lucide-react";

const CALENDAR_TYPES = ["standard", "shift", "flexi"];
const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function CalendarDialog({ open, onClose, initial, onSaved }: {
  open: boolean; onClose: () => void; initial?: WorkCalendar; onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [calendarType, setCalendarType] = useState(initial?.calendar_type ?? "standard");
  const [workingDays, setWorkingDays] = useState<string[]>(initial?.working_days ?? ["Mon","Tue","Wed","Thu","Fri"]);
  const [isDefault, setIsDefault] = useState(initial?.is_default ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? ""); setCalendarType(initial?.calendar_type ?? "standard");
      setWorkingDays(initial?.working_days ?? ["Mon","Tue","Wed","Thu","Fri"]);
      setIsDefault(initial?.is_default ?? false); setError("");
    }
  }, [open, initial]);

  const toggleDay = (day: string) => {
    setWorkingDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setLoading(true); setError("");
    try {
      const data = { name, calendar_type: calendarType, working_days: workingDays, is_default: isDefault, status: "active" };
      if (initial) await workCalendarsApi.update(initial.id, data);
      else await workCalendarsApi.create(data);
      onSaved(); onClose();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to save"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-md p-6 shadow-2xl">
        <h3 className="text-lg font-bold mb-4">{initial ? "Edit" : "Create"} Work Calendar</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Calendar Name *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Standard 5-Day Week" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Calendar Type</label>
            <select value={calendarType} onChange={e => setCalendarType(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
              {CALENDAR_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Working Days</label>
            <div className="flex gap-2 flex-wrap">
              {ALL_DAYS.map(day => (
                <button type="button" key={day} onClick={() => toggleDay(day)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${workingDays.includes(day) ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:border-primary/50"}`}>
                  {day}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{workingDays.length} working days per week</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="cal-default" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="h-4 w-4 rounded" />
            <label htmlFor="cal-default" className="text-sm">Set as default calendar</label>
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

export function CalendarsAndShifts() {
  const [items, setItems] = useState<WorkCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WorkCalendar | undefined>();
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await workCalendarsApi.list(page, 20, search || undefined);
      setItems(res.items); setTotal(res.total);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this calendar?")) return;
    setDeleting(id);
    try { await workCalendarsApi.delete(id); load(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : "Delete failed"); }
    finally { setDeleting(null); }
  };

  const TYPE_COLORS: Record<string, string> = {
    standard: "bg-blue-500/10 text-blue-600",
    shift: "bg-orange-500/10 text-orange-600",
    flexi: "bg-purple-500/10 text-purple-600",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Calendars & Shifts</h2>
          <p className="text-sm text-muted-foreground">Work calendars, shift patterns, and holiday schedules. <span className="font-medium text-primary">{total} total</span></p>
        </div>
        <Button className="gradient-brand text-white border-0" onClick={() => { setEditing(undefined); setDialogOpen(true); }}>
          <Plus className="size-4 mr-2" /> Create Calendar
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
          placeholder="Search calendars..." />
      </div>

      {loading && <div className="flex items-center justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>}
      {error && <div className="p-4 rounded-xl bg-red-500/10 text-red-600 text-sm border border-red-500/20">{error}</div>}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {items.length === 0 ? (
            <div className="col-span-3 text-center py-16 text-muted-foreground">
              <CalendarDays className="size-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No work calendars</p>
              <p className="text-sm">Create calendars to define working days and shift patterns.</p>
            </div>
          ) : items.map(cal => (
            <Card key={cal.id} className="p-5 hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between mb-3">
                <div className={`size-10 rounded-lg grid place-items-center ${TYPE_COLORS[cal.calendar_type] || "bg-muted"}`}>
                  <CalendarDays className="size-5" />
                </div>
                <div className="flex items-center gap-1">
                  {cal.is_default && <Star className="size-4 text-amber-500 fill-amber-500" />}
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${TYPE_COLORS[cal.calendar_type] || "bg-muted"}`}>
                    {cal.calendar_type}
                  </span>
                </div>
              </div>
              <h3 className="font-bold text-base leading-tight mb-1">{cal.name}</h3>

              {cal.working_days && (
                <div className="flex gap-1 flex-wrap mb-2">
                  {ALL_DAYS.map(d => (
                    <span key={d} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cal.working_days?.includes(d) ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground opacity-40"}`}>
                      {d}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                <span className="flex items-center gap-1"><Clock className="size-3" />{cal.shifts?.length ?? 0} shifts</span>
                <span>{cal.holidays?.length ?? 0} holidays</span>
              </div>

              <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="outline" size="sm" onClick={() => { setEditing(cal); setDialogOpen(true); }}>
                  <Edit2 className="size-3.5 mr-1" /> Edit
                </Button>
                <Button variant="outline" size="sm" className="text-red-600" onClick={() => handleDelete(cal.id)} disabled={deleting === cal.id}>
                  {deleting === cal.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <span className="text-sm text-muted-foreground self-center">Page {page}</span>
          <Button variant="outline" size="sm" disabled={items.length < 20} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      <CalendarDialog open={dialogOpen} onClose={() => setDialogOpen(false)} initial={editing} onSaved={load} />
    </div>
  );
}
