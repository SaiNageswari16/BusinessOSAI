import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BellRing,
  AlertTriangle,
  Clock,
  DollarSign,
  Send,
  CheckCircle2,
  RefreshCw,
  Mail,
  MessageSquare,
  Smartphone,
  Sliders,
  History,
  ShieldAlert,
  Calendar,
  Layers,
  Sparkles,
  Info,
  Check,
  X,
  ChevronRight,
  TrendingUp,
  FileText
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { useCurrency } from "@/hooks/use-currency";
import { paymentRemindersApi } from "@/lib/api-client";
import { toast } from "sonner";

interface ReminderPolicy {
  id?: string;
  is_enabled: boolean;
  credit_period_days: number;
  pre_due_reminder_days: number[];
  overdue_reminder_frequency_hours: number;
  max_overdue_reminders: number;
  penalty_enabled: boolean;
  penalty_type: string;
  penalty_rate: number;
  penalty_grace_days: number;
  channels: { email: boolean; whatsapp: boolean; sms: boolean };
  email_subject_template?: string;
  email_body_template?: string;
  whatsapp_template?: string;
  sms_template?: string;
}

interface InvoiceReminderItem {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  invoice_date?: string;
  due_date?: string;
  principal_due: number;
  penalty_amount: number;
  total_payable: number;
  status: string;
  days_diff: number;
  last_reminder_sent_at?: string;
  reminder_count: number;
}

interface ReminderLog {
  id: string;
  invoice_id: string;
  customer_name: string;
  recipient_email?: string;
  recipient_phone?: string;
  channel: string;
  reminder_type: string;
  days_relative_to_due: number;
  amount_due: number;
  penalty_applied: number;
  total_payable: number;
  status: string;
  message_body?: string;
  error_message?: string;
  created_at: string;
}

export function PaymentReminderHub() {
  const { currency, formatCurrency } = useCurrency();
  const [activeTab, setActiveTab] = useState<"monitor" | "rules" | "logs">("monitor");

  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);

  const [summary, setSummary] = useState<{
    total_pending_balance: number;
    total_penalty_accrued: number;
    total_receivables: number;
    overdue_count: number;
    overdue_amount: number;
    due_today_count: number;
    due_within_7d_count: number;
    invoices: InvoiceReminderItem[];
  }>({
    total_pending_balance: 0,
    total_penalty_accrued: 0,
    total_receivables: 0,
    overdue_count: 0,
    overdue_amount: 0,
    due_today_count: 0,
    due_within_7d_count: 0,
    invoices: [],
  });

  const [policy, setPolicy] = useState<ReminderPolicy>({
    is_enabled: true,
    credit_period_days: 30,
    pre_due_reminder_days: [7, 3, 1, 0],
    overdue_reminder_frequency_hours: 12,
    max_overdue_reminders: 15,
    penalty_enabled: true,
    penalty_type: "percentage",
    penalty_rate: 2.0,
    penalty_grace_days: 0,
    channels: { email: true, whatsapp: true, sms: true },
  });

  const [logs, setLogs] = useState<ReminderLog[]>([]);

  // Modal Send Single Invoice
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceReminderItem | null>(null);
  const [customNote, setCustomNote] = useState("");
  const [sendingSingle, setSendingSingle] = useState(false);

  // Message preview modal
  const [previewLog, setPreviewLog] = useState<ReminderLog | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [summaryData, policyData, logsData] = await Promise.all([
        paymentRemindersApi.getSummary().catch((e) => {
          console.error("Failed getSummary:", e);
          return null;
        }),
        paymentRemindersApi.getPolicy().catch((e) => {
          console.error("Failed getPolicy:", e);
          return null;
        }),
        paymentRemindersApi.getLogs({ limit: 50 }).catch((e) => {
          console.error("Failed getLogs:", e);
          return [];
        }),
      ]);

      if (summaryData) {
        setSummary(summaryData);
      }
      if (policyData) {
        setPolicy(policyData);
      }
      if (logsData) {
        setLogs(logsData);
      }
    } catch (err) {
      console.error("Failed loading payment reminder data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunBatch = async () => {
    setEvaluating(true);
    try {
      const result = await paymentRemindersApi.evaluateBatch();
      toast.success(
        `Reminder Engine Executed: Evaluated ${result.invoices_evaluated} invoices, dispatched ${result.reminders_sent} notifications (${result.penalties_applied} penalties updated).`
      );
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed running reminder evaluation");
    } finally {
      setEvaluating(false);
    }
  };

  const handleSavePolicy = async () => {
    setSavingPolicy(true);
    try {
      await paymentRemindersApi.updatePolicy(policy);
      toast.success("Payment reminder & late penalty policy saved successfully!");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save policy");
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleSendSingleReminder = async () => {
    if (!selectedInvoice) return;
    setSendingSingle(true);
    try {
      await paymentRemindersApi.sendSingleReminder(selectedInvoice.id, {
        custom_note: customNote || undefined,
      });
      toast.success(`Payment reminder sent to ${selectedInvoice.customer_name} across enabled channels!`);
      setSelectedInvoice(null);
      setCustomNote("");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed sending reminder");
    } finally {
      setSendingSingle(false);
    }
  };

  const [focusedTemplate, setFocusedTemplate] = useState<"email_body_template" | "whatsapp_template" | "sms_template">("email_body_template");
  const [previewChannel, setPreviewChannel] = useState<"whatsapp" | "email" | "sms">("email");

  const insertTag = (tag: string) => {
    setPolicy((prev) => ({
      ...prev,
      [focusedTemplate]: (prev[focusedTemplate] || "") + `{${tag}}`,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header & KPI Dashboard */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 p-6 rounded-2xl text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
              <BellRing className="size-4 animate-bounce" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
              Accounts Receivable Automation
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            Payment Reminders & Late Penalty Engine
          </h1>
          <p className="text-xs text-indigo-200/80 mt-1 max-w-2xl">
            Automated multi-channel notifications (Email, WhatsApp, SMS) for PayLater & credit terms with auto-calculated late penalties.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all text-xs font-semibold cursor-pointer flex items-center gap-1.5"
            title="Refresh receivables"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={handleRunBatch}
            disabled={evaluating}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-500 hover:from-amber-400 hover:to-indigo-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className={`size-3.5 ${evaluating ? "animate-spin" : ""}`} />
            {evaluating ? "Evaluating Reminders..." : "⚡ Run Reminder Engine"}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-card/80 backdrop-blur border-border/60 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Receivables</span>
            <span className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <DollarSign className="size-4" />
            </span>
          </div>
          <div className="text-2xl font-black mt-2 text-foreground">
            {formatCurrency(summary.total_receivables || 0)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
            <span>Principal: {formatCurrency(summary.total_pending_balance || 0)}</span>
          </div>
        </Card>

        <Card className="p-4 bg-card/80 backdrop-blur border-red-500/20 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">Overdue Invoices</span>
            <span className="p-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
              <AlertTriangle className="size-4" />
            </span>
          </div>
          <div className="text-2xl font-black mt-2 text-red-600 dark:text-red-400">
            {summary.overdue_count} Bills ({formatCurrency(summary.overdue_amount || 0)})
          </div>
          <div className="text-[11px] text-red-500/80 mt-1">
            Recurrent alerts sent every {policy.overdue_reminder_frequency_hours} hours
          </div>
        </Card>

        <Card className="p-4 bg-card/80 backdrop-blur border-amber-500/20 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Accrued Penalties</span>
            <span className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <TrendingUp className="size-4" />
            </span>
          </div>
          <div className="text-2xl font-black mt-2 text-amber-600 dark:text-amber-400">
            {formatCurrency(summary.total_penalty_accrued || 0)}
          </div>
          <div className="text-[11px] text-amber-600/80 mt-1">
            Rate: {policy.penalty_type === "percentage" ? `${policy.penalty_rate}%` : `${currency.symbol}${policy.penalty_rate}`} late fee
          </div>
        </Card>

        <Card className="p-4 bg-card/80 backdrop-blur border-emerald-500/20 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Upcoming Dues (7d)</span>
            <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Clock className="size-4" />
            </span>
          </div>
          <div className="text-2xl font-black mt-2 text-emerald-600 dark:text-emerald-400">
            {summary.due_within_7d_count + summary.due_today_count} Invoices
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {summary.due_today_count} due today • Pre-due alerts active
          </div>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("monitor")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
            activeTab === "monitor"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="size-4" />
          Live Dues & Overdue Monitor ({summary.invoices.length})
        </button>
        <button
          onClick={() => setActiveTab("rules")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
            activeTab === "rules"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sliders className="size-4" />
          Reminder & Penalty Rules
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
            activeTab === "logs"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="size-4" />
          Notification Audit Logs ({logs.length})
        </button>
      </div>

      {/* Tab 1: Live Due & Overdue Monitor */}
      {activeTab === "monitor" && (
        <Card className="overflow-hidden border-border/70 shadow-sm">
          <div className="p-4 border-b border-border/50 bg-muted/30 flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">
              Outstanding Invoices & PayLater Accounts
            </span>
            <span className="text-[11px] text-muted-foreground">
              Showing active unpaid, partially paid, and overdue records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Status & Dues</th>
                  <th className="py-3 px-4">Principal Due</th>
                  <th className="py-3 px-4">Late Penalty</th>
                  <th className="py-3 px-4">Total Payable</th>
                  <th className="py-3 px-4">Last Reminder</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {summary.invoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted-foreground">
                      No pending or overdue receivables found. All accounts are settled!
                    </td>
                  </tr>
                ) : (
                  summary.invoices.map((inv) => {
                    const isOverdue = inv.days_diff > 0;
                    const isDueToday = inv.days_diff === 0;

                    return (
                      <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 font-bold text-foreground">
                          {inv.invoice_number}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-foreground">{inv.customer_name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {inv.customer_email || inv.customer_phone || "No contact info"}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-foreground">{inv.due_date || "—"}</div>
                          <div className="text-[10px] text-muted-foreground">
                            Inv: {inv.invoice_date || "—"}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {isOverdue ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400">
                              <AlertTriangle className="size-3" />
                              {inv.days_diff}d Overdue
                            </span>
                          ) : isDueToday ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                              <Clock className="size-3" />
                              Due Today
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                              <CheckCircle2 className="size-3" />
                              Due in {Math.abs(inv.days_diff)}d
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-semibold text-foreground">
                          {formatCurrency(inv.principal_due)}
                        </td>
                        <td className="py-3 px-4 font-bold text-red-600 dark:text-red-400">
                          {inv.penalty_amount > 0 ? `+${formatCurrency(inv.penalty_amount)}` : "—"}
                        </td>
                        <td className="py-3 px-4 font-black text-indigo-600 dark:text-indigo-400">
                          {formatCurrency(inv.total_payable)}
                        </td>
                        <td className="py-3 px-4 text-[11px] text-muted-foreground">
                          {inv.last_reminder_sent_at ? (
                            <div>
                              <div>{new Date(inv.last_reminder_sent_at).toLocaleDateString()}</div>
                              <div className="text-[10px] text-indigo-500">Sent {inv.reminder_count}x</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/60">Not sent yet</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/80 text-[11px] font-bold transition-all flex items-center gap-1.5 ml-auto cursor-pointer"
                          >
                            <Send className="size-3 text-indigo-600" />
                            <span>Remind</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 2: Reminder & Penalty Rules */}
      {activeTab === "rules" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* General Policy Settings */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Automated Scheduler & Credit Policy</h3>
                  <p className="text-xs text-muted-foreground">Configure payment deadlines, reminder milestones, and frequency</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policy.is_enabled}
                    onChange={(e) => setPolicy({ ...policy, is_enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Standard Credit / PayLater Period (Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={policy.credit_period_days}
                    onChange={(e) => setPolicy({ ...policy, credit_period_days: Number(e.target.value) })}
                    className="w-full h-9 px-3 text-sm rounded-lg border bg-background text-foreground"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Default payment term applied to credit orders</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Overdue Reminder Frequency (Hours)
                  </label>
                  <select
                    value={policy.overdue_reminder_frequency_hours}
                    onChange={(e) => setPolicy({ ...policy, overdue_reminder_frequency_hours: Number(e.target.value) })}
                    className="w-full h-9 px-3 text-sm rounded-lg border bg-background text-foreground"
                  >
                    <option value={6}>Every 6 Hours (High Urgency)</option>
                    <option value={12}>Every 12 Hours (Twice Daily)</option>
                    <option value={24}>Every 24 Hours (Daily)</option>
                    <option value={48}>Every 48 Hours (Every 2 Days)</option>
                    <option value={72}>Every 72 Hours (Every 3 Days)</option>
                  </select>
                  <p className="text-[10px] text-muted-foreground mt-1">Interval between repeated reminders for overdue accounts</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Pre-due Alert Milestones (Days before due)
                  </label>
                  <input
                    type="text"
                    value={(policy.pre_due_reminder_days || []).join(", ")}
                    onChange={(e) => {
                      const arr = e.target.value
                        .split(",")
                        .map((s) => parseInt(s.trim(), 10))
                        .filter((n) => !isNaN(n));
                      setPolicy({ ...policy, pre_due_reminder_days: arr });
                    }}
                    placeholder="e.g. 7, 3, 1, 0"
                    className="w-full h-9 px-3 text-sm rounded-lg border bg-background text-foreground"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">0 = Due date; comma separated days prior</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Max Overdue Reminders Cap
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={policy.max_overdue_reminders}
                    onChange={(e) => setPolicy({ ...policy, max_overdue_reminders: Number(e.target.value) })}
                    className="w-full h-9 px-3 text-sm rounded-lg border bg-background text-foreground"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Maximum alerts before pausing automated dispatch</p>
                </div>
              </div>
            </Card>

            {/* Overdue Penalty Calculation Settings */}
            <Card className="p-5 space-y-4 border-amber-500/30">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-md bg-amber-500/10 text-amber-600">
                    <TrendingUp className="size-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Late Payment Penalty & Surcharge</h3>
                    <p className="text-xs text-muted-foreground">Automatically add penalty fee when deadline passes</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policy.penalty_enabled}
                    onChange={(e) => setPolicy({ ...policy, penalty_enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-amber-600"></div>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Penalty Fee Type</label>
                  <select
                    value={policy.penalty_type}
                    onChange={(e) => setPolicy({ ...policy, penalty_type: e.target.value })}
                    className="w-full h-9 px-3 text-sm rounded-lg border bg-background text-foreground"
                  >
                    <option value="percentage">Percentage (%) of Balance</option>
                    <option value="daily_percentage">Daily Percentage (% per day overdue)</option>
                    <option value="fixed">Fixed Flat Surcharge Fee</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Penalty Rate / Amount
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={policy.penalty_rate}
                    onChange={(e) => setPolicy({ ...policy, penalty_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full h-9 px-3 text-sm rounded-lg border bg-background text-foreground font-bold"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {policy.penalty_type === "percentage"
                      ? "e.g. 2% on overdue amount"
                      : policy.penalty_type === "daily_percentage"
                      ? "e.g. 0.1% for every day past due"
                      : `e.g. ${currency.symbol}100 flat penalty`}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Grace Period (Days)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={policy.penalty_grace_days}
                    onChange={(e) => setPolicy({ ...policy, penalty_grace_days: parseInt(e.target.value, 10) || 0 })}
                    className="w-full h-9 px-3 text-sm rounded-lg border bg-background text-foreground"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Days before penalty begins accruing</p>
                </div>
              </div>
            </Card>

            {/* Template Editors */}
            <Card className="p-5 space-y-4">
              <div className="border-b pb-3">
                <h3 className="text-sm font-bold text-foreground">Multi-Channel Message Templates</h3>
                <p className="text-xs text-muted-foreground">Customize dynamic messages for Email, WhatsApp, and SMS</p>
              </div>

              {/* Tag Quick Inserters */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs bg-muted/40 p-2.5 rounded-xl border">
                <span className="text-[11px] font-bold text-muted-foreground mr-1">
                  Insert Tag (into {focusedTemplate === "email_body_template" ? "Email" : focusedTemplate === "whatsapp_template" ? "WhatsApp" : "SMS"}):
                </span>
                {[
                  "customer_name",
                  "invoice_number",
                  "due_date",
                  "due_status",
                  "balance_due",
                  "penalty_amount",
                  "total_payable",
                  "company_name",
                  "payment_link",
                ].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => insertTag(tag)}
                    className="px-2 py-1 rounded bg-background border hover:border-indigo-400 text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer"
                  >
                    +{tag}
                  </button>
                ))}
              </div>

              {/* WhatsApp Template */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-foreground">
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="size-3.5 text-emerald-600" />
                    <span>WhatsApp Reminder Template</span>
                  </div>
                  {focusedTemplate === "whatsapp_template" && (
                    <span className="text-[10px] text-emerald-600 font-normal">Active Editor</span>
                  )}
                </div>
                <textarea
                  rows={4}
                  value={policy.whatsapp_template || ""}
                  onFocus={() => {
                    setFocusedTemplate("whatsapp_template");
                    setPreviewChannel("whatsapp");
                  }}
                  onChange={(e) => setPolicy({ ...policy, whatsapp_template: e.target.value })}
                  className="w-full p-3 text-xs rounded-lg border bg-background text-foreground font-mono leading-relaxed"
                />
              </div>

              {/* Email Body Template */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-foreground">
                  <div className="flex items-center gap-1.5">
                    <Mail className="size-3.5 text-blue-600" />
                    <span>Email Body Template</span>
                  </div>
                  {focusedTemplate === "email_body_template" && (
                    <span className="text-[10px] text-blue-600 font-normal">Active Editor</span>
                  )}
                </div>
                <textarea
                  rows={4}
                  value={policy.email_body_template || ""}
                  onFocus={() => {
                    setFocusedTemplate("email_body_template");
                    setPreviewChannel("email");
                  }}
                  onChange={(e) => setPolicy({ ...policy, email_body_template: e.target.value })}
                  className="w-full p-3 text-xs rounded-lg border bg-background text-foreground font-mono leading-relaxed"
                />
              </div>

              {/* SMS Template */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-foreground">
                  <div className="flex items-center gap-1.5">
                    <Smartphone className="size-3.5 text-purple-600" />
                    <span>SMS Notice Template</span>
                  </div>
                  {focusedTemplate === "sms_template" && (
                    <span className="text-[10px] text-purple-600 font-normal">Active Editor</span>
                  )}
                </div>
                <textarea
                  rows={2}
                  value={policy.sms_template || ""}
                  onFocus={() => {
                    setFocusedTemplate("sms_template");
                    setPreviewChannel("sms");
                  }}
                  onChange={(e) => setPolicy({ ...policy, sms_template: e.target.value })}
                  className="w-full p-3 text-xs rounded-lg border bg-background text-foreground font-mono leading-relaxed"
                />
              </div>
            </Card>

            <div className="flex justify-end">
              <button
                onClick={handleSavePolicy}
                disabled={savingPolicy}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-lg hover:bg-primary/90 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Check className="size-4" />
                {savingPolicy ? "Saving Policy..." : "Save Policy Configuration"}
              </button>
            </div>
          </div>

          {/* Right Column: Channels & Preview */}
          <div className="space-y-6">
            <Card className="p-5 space-y-4">
              <h3 className="text-sm font-bold text-foreground border-b pb-2">Active Channels</h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 rounded-xl border bg-muted/20 cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                      <Mail className="size-4" />
                    </span>
                    <div>
                      <div className="text-xs font-bold text-foreground">Email Notifications</div>
                      <div className="text-[10px] text-muted-foreground">Branded HTML invoices & reminders</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={policy.channels?.email ?? true}
                    onChange={(e) =>
                      setPolicy({ ...policy, channels: { ...policy.channels, email: e.target.checked } })
                    }
                    className="size-4 text-primary rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl border bg-muted/20 cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                      <MessageSquare className="size-4" />
                    </span>
                    <div>
                      <div className="text-xs font-bold text-foreground">WhatsApp Direct</div>
                      <div className="text-[10px] text-muted-foreground">Real-time instant chat reminders</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={policy.channels?.whatsapp ?? true}
                    onChange={(e) =>
                      setPolicy({ ...policy, channels: { ...policy.channels, whatsapp: e.target.checked } })
                    }
                    className="size-4 text-primary rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl border bg-muted/20 cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-lg bg-purple-500/10 text-purple-600">
                      <Smartphone className="size-4" />
                    </span>
                    <div>
                      <div className="text-xs font-bold text-foreground">SMS Gateway</div>
                      <div className="text-[10px] text-muted-foreground">Compact urgency SMS alerts</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={policy.channels?.sms ?? true}
                    onChange={(e) =>
                      setPolicy({ ...policy, channels: { ...policy.channels, sms: e.target.checked } })
                    }
                    className="size-4 text-primary rounded"
                  />
                </label>
              </div>
            </Card>

            {/* Live Sample Preview */}
            <Card className="p-5 space-y-3 bg-gradient-to-b from-slate-900 to-indigo-950 text-white border-indigo-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                  <Sparkles className="size-3.5" />
                  <span>Live Render Preview</span>
                </div>
                <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setPreviewChannel("email")}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      previewChannel === "email" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewChannel("whatsapp")}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      previewChannel === "whatsapp" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewChannel("sms")}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      previewChannel === "sms" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    SMS
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-indigo-500/30 text-indigo-100 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                {previewChannel === "email"
                  ? (policy.email_body_template || "")
                      .replace(/\{customer_name\}/g, "John Doe")
                      .replace(/\{invoice_number\}/g, "INV-2026-0891")
                      .replace(/\{invoice_date\}/g, "01 Oct 2026")
                      .replace(/\{due_date\}/g, "15 Oct 2026")
                      .replace(/\{due_status\}/g, "5 Days Overdue")
                      .replace(/\{balance_due\}/g, "5,000.00")
                      .replace(/\{penalty_amount\}/g, "100.00")
                      .replace(/\{total_payable\}/g, "5,100.00")
                      .replace(/\{currency_symbol\}/g, currency.symbol)
                      .replace(/\{company_name\}/g, "Acme Retail")
                      .replace(/\{payment_link\}/g, "https://rzp.io/i/demo_inv891")
                  : previewChannel === "whatsapp"
                  ? (policy.whatsapp_template || "")
                      .replace(/\{customer_name\}/g, "John Doe")
                      .replace(/\{invoice_number\}/g, "INV-2026-0891")
                      .replace(/\{invoice_date\}/g, "01 Oct 2026")
                      .replace(/\{due_date\}/g, "15 Oct 2026")
                      .replace(/\{due_status\}/g, "5 Days Overdue")
                      .replace(/\{balance_due\}/g, "5,000.00")
                      .replace(/\{penalty_amount\}/g, "100.00")
                      .replace(/\{total_payable\}/g, "5,100.00")
                      .replace(/\{currency_symbol\}/g, currency.symbol)
                      .replace(/\{company_name\}/g, "Acme Retail")
                      .replace(/\{payment_link\}/g, "https://rzp.io/i/demo_inv891")
                  : (policy.sms_template || "")
                      .replace(/\{customer_name\}/g, "John Doe")
                      .replace(/\{invoice_number\}/g, "INV-2026-0891")
                      .replace(/\{due_date\}/g, "15 Oct 2026")
                      .replace(/\{due_status\}/g, "5 Days Overdue")
                      .replace(/\{balance_due\}/g, "5,000.00")
                      .replace(/\{penalty_amount\}/g, "100.00")
                      .replace(/\{total_payable\}/g, "5,100.00")
                      .replace(/\{currency_symbol\}/g, currency.symbol)
                      .replace(/\{company_name\}/g, "Acme Retail")
                      .replace(/\{payment_link\}/g, "https://rzp.io/i/demo_inv891")}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 3: Notification Audit Logs */}
      {activeTab === "logs" && (
        <Card className="overflow-hidden border-border/70 shadow-sm">
          <div className="p-4 border-b border-border/50 bg-muted/30 flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">
              Dispatched Reminder History & Delivery Receipts
            </span>
            <span className="text-[11px] text-muted-foreground">
              Real-time audit trail of all email, whatsapp, and sms dispatches
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Channel</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Amount Communicated</th>
                  <th className="py-3 px-4">Late Penalty</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      No reminder logs recorded yet. Run the evaluation engine or trigger a manual reminder!
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 text-[11px] text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">{log.customer_name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {log.recipient_email || log.recipient_phone || "—"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {log.channel === "email" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                            <Mail className="size-3" /> Email
                          </span>
                        ) : log.channel === "whatsapp" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            <MessageSquare className="size-3" /> WhatsApp
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                            <Smartphone className="size-3" /> SMS
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 capitalize font-medium text-foreground">
                        {log.reminder_type?.replace("_", " ")}
                      </td>
                      <td className="py-3 px-4 font-bold text-foreground">
                        {formatCurrency(log.total_payable)}
                      </td>
                      <td className="py-3 px-4 font-bold text-red-600 dark:text-red-400">
                        {log.penalty_applied > 0 ? `+${formatCurrency(log.penalty_applied)}` : "—"}
                      </td>
                      <td className="py-3 px-4">
                        {log.status === "SENT" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            <CheckCircle2 className="size-3" /> Sent
                          </span>
                        ) : log.status === "SIMULATED" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                            <Info className="size-3" /> Queued / Test
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" title={log.error_message || ""}>
                            <AlertTriangle className="size-3" /> Failed
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setPreviewLog(log)}
                          className="px-2 py-1 rounded bg-muted hover:bg-muted/80 text-[10px] font-bold text-foreground cursor-pointer"
                        >
                          View Body
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Send Single Invoice Reminder Modal */}
      <AnimatePresence>
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-4 border-b bg-muted/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600">
                    <Send className="size-4" />
                  </span>
                  <h3 className="font-bold text-sm text-foreground">
                    Send Instant Payment Reminder
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="size-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="bg-muted/30 p-3 rounded-xl border space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Invoice Number:</span>
                    <span className="font-bold text-foreground">{selectedInvoice.invoice_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer:</span>
                    <span className="font-semibold text-foreground">{selectedInvoice.customer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Principal Due:</span>
                    <span className="font-semibold text-foreground">{formatCurrency(selectedInvoice.principal_due)}</span>
                  </div>
                  {selectedInvoice.penalty_amount > 0 && (
                    <div className="flex justify-between text-red-600 dark:text-red-400">
                      <span>Late Penalty Fee:</span>
                      <span className="font-bold">+{formatCurrency(selectedInvoice.penalty_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1 font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                    <span>Total Payable:</span>
                    <span>{formatCurrency(selectedInvoice.total_payable)}</span>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-foreground mb-1">
                    Optional Custom Message Note:
                  </label>
                  <textarea
                    rows={3}
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder="e.g. Please clear balance before Friday to avoid account suspension..."
                    className="w-full p-2.5 rounded-lg border bg-background text-foreground"
                  />
                </div>

                <div className="text-[11px] text-muted-foreground">
                  Will dispatch via enabled channels ({[
                    policy.channels?.email ? "Email" : null,
                    policy.channels?.whatsapp ? "WhatsApp" : null,
                    policy.channels?.sms ? "SMS" : null,
                  ].filter(Boolean).join(", ") || "None"}).
                </div>
              </div>

              <div className="p-4 border-t bg-muted/20 flex justify-end gap-2">
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendSingleReminder}
                  disabled={sendingSingle}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="size-3.5" />
                  {sendingSingle ? "Dispatching..." : "Dispatch Reminder Now"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Message Body Preview Modal */}
      <AnimatePresence>
        {previewLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-4 border-b bg-muted/40 flex items-center justify-between">
                <h3 className="font-bold text-sm text-foreground">
                  Dispatched Message Payload ({previewLog.channel.toUpperCase()})
                </h3>
                <button
                  onClick={() => setPreviewLog(null)}
                  className="size-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="p-5 max-h-[60vh] overflow-y-auto">
                <pre className="p-3.5 rounded-xl bg-muted/60 text-foreground text-xs font-mono whitespace-pre-wrap leading-relaxed border">
                  {previewLog.message_body || "No message body recorded"}
                </pre>
              </div>
              <div className="p-4 border-t bg-muted/20 text-right">
                <button
                  onClick={() => setPreviewLog(null)}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
