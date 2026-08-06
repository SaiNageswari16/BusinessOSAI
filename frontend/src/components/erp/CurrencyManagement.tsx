import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Search, Plus, Edit2, Trash2, X, Save, Loader2, AlertCircle, DollarSign, Star } from "lucide-react";
import { currenciesApi, type Currency } from "@/lib/api-client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn, AVAILABLE_CURRENCIES, getActiveCurrency, setActiveCurrency } from "@/lib/utils";


function CurrencyFormModal({ currency, onClose, onSaved }: { currency: Currency | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!currency;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: currency?.code ?? "",
    symbol: currency?.symbol ?? "",
    exchange_rate: currency?.exchange_rate ?? 1,
    decimal_places: currency?.decimal_places ?? 2,
    is_default: currency?.is_default ?? false,
    status: currency?.status ?? "active",
  });
  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...form, exchange_rate: Number(form.exchange_rate), decimal_places: Number(form.decimal_places) };
      if (isEdit) { await currenciesApi.update(currency.id, payload); toast.success("Currency updated"); }
      else { await currenciesApi.create(payload); toast.success("Currency added"); }
      onSaved(); onClose();
    } catch (err) { console.error(err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg flex items-center gap-2"><DollarSign className="size-5 text-primary" />{isEdit ? "Edit Currency" : "Add Currency"}</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5">Currency Code *</label>
              <input value={form.code} onChange={set("code")} required disabled={isEdit}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20 font-mono uppercase"
                placeholder="USD" maxLength={10} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Symbol *</label>
              <input value={form.symbol} onChange={set("symbol")} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                placeholder="$" maxLength={5} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Exchange Rate</label>
              <input type="number" step="0.0001" value={form.exchange_rate} onChange={set("exchange_rate")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Decimal Places</label>
              <select value={form.decimal_places} onChange={set("decimal_places")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
                {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
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
            <div className="flex items-center gap-2 self-end pb-1">
              <input type="checkbox" id="is_default" checked={form.is_default}
                onChange={(e) => setForm((p) => ({ ...p, is_default: e.target.checked }))}
                className="size-4 rounded" />
              <label htmlFor="is_default" className="text-sm font-medium">Set as Default</label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="gradient-brand text-white border-0 min-w-[100px]">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <><Save className="size-4 mr-1.5" />{isEdit ? "Update" : "Add"}</>}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export function CurrencyManagement() {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editCurrency, setEditCurrency] = useState<Currency | null>(null);
  const [deleteCurrency, setDeleteCurrency] = useState<Currency | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await currenciesApi.list(1, 100);
      setCurrencies(res.items);
    } catch (err) { console.error(err instanceof Error ? err.message : "Failed"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, []);

  const filtered = currencies.filter((c) =>
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.symbol.includes(search),
  );

  const handleDelete = async () => {
    if (!deleteCurrency) return;
    setDeleting(true);
    try {
      await currenciesApi.delete(deleteCurrency.id);
      toast.success("Currency deleted");
      setDeleteCurrency(null);
      void load();
    } catch (err) { console.error(err instanceof Error ? err.message : "Failed"); }
    finally { setDeleting(false); }
  };

  const [activeCurr, setActiveCurrState] = useState(getActiveCurrency());

  const handleSelectActive = (code: string) => {
    setActiveCurrency(code);
    setActiveCurrState(getActiveCurrency());
    toast.success(`Active application currency changed to ${code}`);
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Currency Management</h2>
          <p className="text-sm text-muted-foreground">Configure currencies and exchange rates for multi-currency support across all receipts and invoices.</p>
        </div>
        <Button className="gradient-brand text-white border-0 gap-2" onClick={() => { setEditCurrency(null); setShowForm(true); }}>
          <Plus className="size-4" /> Add Currency
        </Button>
      </div>

      {/* Global Active Display Currency Switcher */}
      <Card className="p-5 border-emerald-200 dark:border-emerald-800 bg-gradient-to-r from-emerald-50/80 via-teal-50/40 to-background dark:from-emerald-950/40 dark:via-teal-950/20 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-extrabold text-xl shadow-md">
              {activeCurr.symbol}
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Active System Display Currency</div>
              <div className="text-base font-bold flex items-center gap-2">
                <span>{activeCurr.code} ({activeCurr.symbol})</span>
                <span className="text-xs font-normal text-muted-foreground">— All receipts, invoices, POS, & catalog values will format using this currency.</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {AVAILABLE_CURRENCIES.map((c) => (
              <button
                key={c.code}
                onClick={() => handleSelectActive(c.code)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border",
                  activeCurr.code === c.code
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm scale-105"
                    : "bg-card text-foreground hover:bg-muted border-border"
                )}
              >
                <span className="font-extrabold">{c.symbol}</span>
                <span>{c.code}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>


      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-4 text-sm rounded-lg border bg-card focus:ring-2 focus:ring-primary/20 outline-none"
          placeholder="Search currencies..." />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-28 rounded-xl border bg-muted/30 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <DollarSign className="size-10 mx-auto mb-3 text-muted-foreground opacity-20" />
          <p className="text-sm text-muted-foreground">No currencies configured</p>
          <Button size="sm" className="mt-4 gradient-brand text-white border-0" onClick={() => { setEditCurrency(null); setShowForm(true); }}>
            <Plus className="size-4 mr-1" /> Add Currency
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((currency) => (
            <Card key={currency.id} className={cn("p-4 hover:shadow-md transition-shadow group relative", currency.is_default && "border-primary/30 bg-primary/5")}>
              {currency.is_default && (
                <div className="absolute top-2 right-2">
                  <Star className="size-3.5 text-primary fill-primary" />
                </div>
              )}
              <div className="flex items-center gap-2 mb-3">
                <div className="size-9 rounded-lg bg-primary/10 text-primary font-bold text-sm grid place-items-center">
                  {currency.symbol}
                </div>
                <div>
                  <div className="font-bold font-mono">{currency.code}</div>
                  <div className="text-[10px] text-muted-foreground">{currency.decimal_places} decimals</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mb-3">
                Rate: <span className="font-mono font-semibold text-foreground">{currency.exchange_rate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className={cn("text-[10px] font-medium", currency.status === "active" ? "text-emerald-600" : "text-muted-foreground")}>
                  {currency.status.charAt(0).toUpperCase() + currency.status.slice(1)}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="size-6" onClick={() => { setEditCurrency(currency); setShowForm(true); }}><Edit2 className="size-3" /></Button>
                  <Button variant="ghost" size="icon" className="size-6 text-red-500" onClick={() => setDeleteCurrency(currency)}><Trash2 className="size-3" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <CurrencyFormModal currency={editCurrency}
            onClose={() => { setShowForm(false); setEditCurrency(null); }} onSaved={load} />
        )}
        {deleteCurrency && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-card border rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-lg bg-red-500/10 text-red-500 grid place-items-center"><AlertCircle className="size-5" /></div>
                <h3 className="font-bold">Delete Currency</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">Delete <span className="font-semibold font-mono">{deleteCurrency.code}</span>?</p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteCurrency(null)}>Cancel</Button>
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
