import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Check,
  Coins,
  Plus,
  RefreshCw,
  Scale,
  Wallet,
  X,
} from "lucide-react";
import { Panel } from "@/components/common/PageHeader";
import { StatusBadge, type Tone } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  accountingService,
  type CashFlowSummary,
  type CurrentExchangeRate,
  type ExchangeRate,
  type Expense,
  type ExpenseCategory,
  type Withdrawal,
} from "@/services/accountingService";
import { money } from "@/lib/format";

const withdrawalTone: Record<string, Tone> = {
  pending: "warning",
  approved: "success",
  rejected: "critical",
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Finance-ops settings section: expenses, withdrawals with approve/reject,
 * the exchange-rate book, and the trailing cash-flow summary cards.
 */
export function FinanceOpsSection() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlowSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // expense form state
  const [exCategory, setExCategory] = useState("");
  const [exMode, setExMode] = useState("CASH");
  const [exDate, setExDate] = useState(todayISO());
  const [exAmount, setExAmount] = useState("");
  const [exDesc, setExDesc] = useState("");
  const [exPaidTo, setExPaidTo] = useState("");

  // exchange rate form state
  const [rateFrom, setRateFrom] = useState("USD");
  const [rateTo, setRateTo] = useState("INR");
  const [rateValue, setRateValue] = useState("");
  const [rateDate, setRateDate] = useState(todayISO());
  const [currentRate, setCurrentRate] = useState<CurrentExchangeRate | null>(null);

  const [addWithdrawalOpen, setAddWithdrawalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const [cat, ex, wd, rt, cf] = await Promise.all([
        accountingService.getExpenseCategories().catch(() => [] as ExpenseCategory[]),
        accountingService.getExpenses({ limit: 25 }).catch(() => [] as Expense[]),
        accountingService.getWithdrawals({ limit: 25 }).catch(() => [] as Withdrawal[]),
        accountingService.getExchangeRates({ limit: 25 }).catch(() => []),
        accountingService.getCashFlowSummary(30).catch(() => null),
      ]);
      setCategories(cat);
      setExpenses(ex);
      setWithdrawals(wd);
      setRates(rt);
      setCashFlow(cf);
    } catch (e) {
      console.warn("Accounting service unavailable:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (rateFrom && rateTo) {
      accountingService
        .getCurrentExchangeRate(rateFrom, rateTo)
        .then(setCurrentRate)
        .catch(() => setCurrentRate(null));
    }
  }, [rateFrom, rateTo]);

  // ── Expense entry ──
  const createExpense = async () => {
    const amount = parseFloat(exAmount);
    if (!exCategory || !Number.isFinite(amount) || amount <= 0) {
      toast.error("Pick a category and a positive amount");
      return;
    }
    setBusy(true);
    try {
      await accountingService.createExpense({
        category_id: exCategory,
        payment_mode: exMode,
        date: exDate || null,
        amount,
        description: exDesc.trim() || null,
        paid_to: exPaidTo.trim() || null,
      });
      toast.success("Expense recorded");
      setExAmount("");
      setExDesc("");
      setExPaidTo("");
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to record expense");
    } finally {
      setBusy(false);
    }
  };

  // ── Withdrawals ──
  const actWithdrawal = async (w: Withdrawal, action: "approve" | "reject") => {
    setBusy(true);
    try {
      if (action === "approve") await accountingService.approveWithdrawal(w.id);
      else await accountingService.rejectWithdrawal(w.id);
      toast.success(`Withdrawal ${action === "approve" ? "approved & posted" : "rejected"}`);
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  // ── Exchange rate book ──
  const addRate = async () => {
    const value = parseFloat(rateValue);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a positive rate");
      return;
    }
    setBusy(true);
    try {
      await accountingService.createExchangeRate({
        from_currency: rateFrom,
        to_currency: rateTo,
        rate: value,
        effective_from: rateDate || todayISO(),
      });
      toast.success(`Rate ${rateFrom}/${rateTo} = ${value} added`);
      setRateValue("");
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to add rate");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cash-flow summary cards (30d) */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FlowCard
          label="Inflow (30d)"
          value={cashFlow ? money(Number(cashFlow.inflow)) : "—"}
          icon={<ArrowUpRight />}
          tone="text-success"
        />
        <FlowCard
          label="Outflow (30d)"
          value={cashFlow ? money(Number(cashFlow.outflow)) : "—"}
          icon={<ArrowDownRight />}
          tone="text-critical"
        />
        <FlowCard
          label="Net (30d)"
          value={cashFlow ? money(Number(cashFlow.net)) : "—"}
          icon={<Scale />}
          tone={cashFlow && Number(cashFlow.net) < 0 ? "text-critical" : "text-success"}
        />
        <FlowCard
          label="Wallet balance"
          value={cashFlow ? money(Number(cashFlow.balance)) : "—"}
          icon={<Wallet />}
          tone="text-foreground"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Expense entry + list */}
        <Panel
          title="Expenses"
          subtitle="Record operational spend, then post to the ledger"
          action={
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Category *</Label>
                <Select value={exCategory || "none"} onValueChange={(v) => setExCategory(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={categories.length ? "Select category" : "No categories seeded"} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.length === 0 && <SelectItem value="none">No categories seeded</SelectItem>}
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} · {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Payment mode</Label>
                <Select value={exMode} onValueChange={setExMode}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="CARD">Card</SelectItem>
                    <SelectItem value="BANK">Bank</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Date</Label>
                <Input type="date" value={exDate} onChange={(e) => setExDate(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Amount *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={exAmount}
                  onChange={(e) => setExAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Description</Label>
                <Input value={exDesc} onChange={(e) => setExDesc(e.target.value)} placeholder="e.g. gas refill" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Paid to</Label>
                <Input value={exPaidTo} onChange={(e) => setExPaidTo(e.target.value)} placeholder="vendor / payee" className="h-8 text-xs" />
              </div>
            </div>
            <Button size="sm" disabled={busy} onClick={() => void createExpense()}>
              <Plus className="size-3.5" /> Record expense
            </Button>

            <div className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
              {expenses.length === 0 ? (
                <div className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
                  No expenses recorded in this window.
                </div>
              ) : (
                expenses.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                    <span className="font-mono text-[11px] text-muted-foreground">{e.expense_no}</span>
                    <span className="min-w-0 flex-1 truncate text-xs">
                      {e.description || "—"}{" "}
                      <span className="text-muted-foreground">
                        ({categories.find((c) => c.id === e.category_id)?.code || "?"})
                      </span>
                    </span>
                    <span className="text-[11px] text-muted-foreground">{e.payment_mode}</span>
                    <span className="text-xs font-semibold tabular">{money(Number(e.amount))}</span>
                    <StatusBadge
                      status={e.posted ? "POSTED" : "UNPOSTED"}
                      tone={e.posted ? "success" : "warning"}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </Panel>

        {/* Withdrawals */}
        <Panel
          title="Withdrawals"
          subtitle="Cash-out requests with manager approval"
          action={
            <Button size="sm" variant="outline" onClick={() => setAddWithdrawalOpen(true)}>
              <Plus className="size-3.5" /> Request withdrawal
            </Button>
          }
        >
          <div className="max-h-[460px] space-y-1.5 overflow-y-auto pr-1">
            {withdrawals.length === 0 ? (
              <div className="rounded-md border border-dashed py-8 text-center text-xs text-muted-foreground">
                No withdrawal requests yet.
              </div>
            ) : (
              withdrawals.map((w) => (
                <div key={w.id} className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
                  <Banknote className="size-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold tabular">{money(Number(w.amount))} · {w.method}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {w.date}
                      {w.note ? ` · ${w.note}` : ""}
                    </div>
                  </div>
                  <StatusBadge status={String(w.status).toUpperCase()} tone={withdrawalTone[String(w.status)] ?? "neutral"} />
                  {String(w.status).toLowerCase() === "pending" && (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-success"
                        disabled={busy}
                        onClick={() => void actWithdrawal(w, "approve")}
                      >
                        <Check className="size-3" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-critical"
                        disabled={busy}
                        onClick={() => void actWithdrawal(w, "reject")}
                      >
                        <X className="size-3" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      {/* Exchange rate book */}
      <Panel
        title="Exchange rate book"
        subtitle="Add a rate for a currency pair; the current-rate display shows the latest effective rate"
      >
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          <div className="space-y-2.5 rounded-lg border bg-surface p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Coins className="size-3.5" /> Current rate
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={rateFrom}
                onChange={(e) => setRateFrom(e.target.value.toUpperCase())}
                maxLength={3}
                className="h-8 w-16 font-mono text-xs uppercase"
              />
              <span className="text-xs text-muted-foreground">→</span>
              <Input
                value={rateTo}
                onChange={(e) => setRateTo(e.target.value.toUpperCase())}
                maxLength={3}
                className="h-8 w-16 font-mono text-xs uppercase"
              />
            </div>
            {currentRate ? (
              currentRate.available ? (
                <div className="rounded-lg bg-success/10 p-2 text-center">
                  <div className="text-lg font-bold tabular text-success">
                    1 {currentRate.from_currency} = {currentRate.rate} {currentRate.to_currency}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    effective {String(currentRate.effective_from).slice(0, 10)}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-muted p-2 text-center text-[11px] text-muted-foreground">
                  No rate effective for {currentRate.from_currency}/{currentRate.to_currency} yet.
                </div>
              )
            ) : (
              <div className="rounded-lg bg-muted p-2 text-center text-[11px] text-muted-foreground">
                Loading current rate…
              </div>
            )}

            <div className="border-t pt-2.5">
              <Label className="text-xs font-semibold">Add rate</Label>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <Input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={rateValue}
                  onChange={(e) => setRateValue(e.target.value)}
                  placeholder="rate"
                  className="h-8 text-xs"
                />
                <Input
                  type="date"
                  value={rateDate}
                  onChange={(e) => setRateDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <Button size="sm" variant="outline" className="mt-1.5" disabled={busy} onClick={() => void addRate()}>
                <Plus className="size-3.5" /> Add {rateFrom}/{rateTo}
              </Button>
            </div>
          </div>

          <div className="max-h-[380px] space-y-1.5 overflow-y-auto pr-1">
            {rates.length === 0 ? (
              <div className="rounded-md border border-dashed py-8 text-center text-xs text-muted-foreground">
                No rates in the book yet.
              </div>
            ) : (
              rates.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
                  <span className="font-mono text-xs font-semibold">
                    {r.from_currency}/{r.to_currency}
                  </span>
                  <span className="flex-1 text-[11px] text-muted-foreground">
                    effective {String(r.effective_from).slice(0, 10)}
                    {r.notes ? ` · ${r.notes}` : ""}
                  </span>
                  <span className="text-xs font-bold tabular">{r.rate}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </Panel>

      {/* New withdrawal dialog */}
      <NewWithdrawalDialog
        open={addWithdrawalOpen}
        onClose={() => setAddWithdrawalOpen(false)}
        onCreated={async () => {
          setAddWithdrawalOpen(false);
          await reload();
        }}
      />
    </div>
  );
}

function FlowCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
      </div>
      <div className={`mt-2 text-2xl font-semibold tracking-tight tabular ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

function NewWithdrawalDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a positive withdrawal amount");
      return;
    }
    setSaving(true);
    try {
      await accountingService.createWithdrawal({
        amount: value,
        method: method as never,
        note: note.trim() || null,
        date: date || null,
      });
      toast.success("Withdrawal requested — pending approval");
      onCreated();
      setAmount("");
      setNote("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to request withdrawal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="size-4 text-primary" /> Request withdrawal
          </DialogTitle>
          <DialogDescription>Creates a PENDING withdrawal for manager approval.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2.5 py-2">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Amount *</Label>
            <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="BANK">Bank</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Note</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. petty cash top-up" className="h-8 text-xs" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={saving} onClick={() => void submit()}>
            <Wallet className="size-3.5" /> Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
