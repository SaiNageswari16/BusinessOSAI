import { useState, useEffect, useCallback } from "react";
import { geographyApi, GeographyCountry } from "../../lib/api-client";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Search, Plus, Globe, Edit2, Trash2, Loader2, MapPin } from "lucide-react";

function CountryDialog({ open, onClose, initial, onSaved }: {
  open: boolean; onClose: () => void; initial?: GeographyCountry; onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [isoCode, setIsoCode] = useState(initial?.iso_code ?? "");
  const [phoneCode, setPhoneCode] = useState(initial?.phone_code ?? "");
  const [currencyCode, setCurrencyCode] = useState(initial?.currency_code ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? ""); setIsoCode(initial?.iso_code ?? "");
      setPhoneCode(initial?.phone_code ?? ""); setCurrencyCode(initial?.currency_code ?? "");
      setError("");
    }
  }, [open, initial]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !isoCode.trim()) { setError("Name and ISO code are required"); return; }
    setLoading(true); setError("");
    try {
      const data = { name, iso_code: isoCode.toUpperCase(), phone_code: phoneCode || null, currency_code: currencyCode || null, status: "active" };
      if (initial) await geographyApi.update(initial.id, data);
      else await geographyApi.create(data);
      onSaved(); onClose();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to save"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-md p-6 shadow-2xl">
        <h3 className="text-lg font-bold mb-4">{initial ? "Edit" : "Add"} Country</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Country Name *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. India" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">ISO Code *</label>
              <Input value={isoCode} onChange={e => setIsoCode(e.target.value.toUpperCase())} placeholder="IN" maxLength={3} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Phone Code</label>
              <Input value={phoneCode} onChange={e => setPhoneCode(e.target.value)} placeholder="+91" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Currency</label>
              <Input value={currencyCode} onChange={e => setCurrencyCode(e.target.value.toUpperCase())} placeholder="INR" maxLength={5} />
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1 gradient-brand text-white border-0" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : (initial ? "Update" : "Add Country")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function Geography() {
  const [items, setItems] = useState<GeographyCountry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GeographyCountry | undefined>();
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await geographyApi.list(page, 50, search || undefined);
      setItems(res.items); setTotal(res.total);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this country?")) return;
    setDeleting(id);
    try { await geographyApi.delete(id); load(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : "Delete failed"); }
    finally { setDeleting(null); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Geography</h2>
          <p className="text-sm text-muted-foreground">Countries, states, and cities master data. <span className="font-medium text-primary">{total} countries</span></p>
        </div>
        <Button className="gradient-brand text-white border-0" onClick={() => { setEditing(undefined); setDialogOpen(true); }}>
          <Plus className="size-4 mr-2" /> Add Country
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
          placeholder="Search countries..." />
      </div>

      {loading && <div className="flex items-center justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>}
      {error && <div className="p-4 rounded-xl bg-red-500/10 text-red-600 text-sm border border-red-500/20">{error}</div>}

      {!loading && !error && (
        <div className="bg-card border rounded-xl overflow-hidden">
          {items.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Globe className="size-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No countries configured</p>
              <p className="text-sm">Add countries to manage geography master data.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
                <tr>
                  <th className="px-5 py-4 text-left">Country</th>
                  <th className="px-5 py-4 text-left">ISO Code</th>
                  <th className="px-5 py-4 text-left">Phone Code</th>
                  <th className="px-5 py-4 text-left">Currency</th>
                  <th className="px-5 py-4 text-left">States</th>
                  <th className="px-5 py-4 text-left">Status</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map(country => (
                  <tr key={country.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-lg bg-primary/10 text-primary grid place-items-center">
                          <Globe className="size-4" />
                        </div>
                        <span className="font-medium">{country.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono font-bold">{country.iso_code}</td>
                    <td className="px-5 py-4 text-muted-foreground">{country.phone_code || "—"}</td>
                    <td className="px-5 py-4">
                      {country.currency_code && (
                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-700 rounded text-xs font-bold">{country.currency_code}</span>
                      )}
                      {!country.currency_code && <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="size-3" />
                        <span className="text-xs">{country.states?.length ?? 0} states</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${country.status === "active" ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                        {country.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(country); setDialogOpen(true); }}>
                        <Edit2 className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleDelete(country.id)} disabled={deleting === country.id}>
                        {deleting === country.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {total > 50 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <span className="text-sm text-muted-foreground self-center">Page {page}</span>
          <Button variant="outline" size="sm" disabled={items.length < 50} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      <CountryDialog open={dialogOpen} onClose={() => setDialogOpen(false)} initial={editing} onSaved={load} />
    </div>
  );
}
