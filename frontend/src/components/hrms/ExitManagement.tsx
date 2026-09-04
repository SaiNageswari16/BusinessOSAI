import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, FileText, Shield, Calculator, Award, Trash2, CheckCircle, Clock, XCircle, AlertTriangle, Printer, Download, Eye } from "lucide-react";
import { exitApi, employeesApi, resolveImageUrl, ExitResignation, ExitClearanceTask, ExitFinalSettlement, ExitExperienceLetter, Employee } from "../../lib/api-client";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { getActiveBillingGst } from "@/lib/receipt-template-store";

interface Props { tab?: string; }

export function ExitManagement({ tab = "resignation" }: Props) {
    const { currency, formatCurrency } = useCurrency();
    const { tenant } = useTenant();
    const activeGst = getActiveBillingGst();
    const orgName = activeGst?.trade_name || activeGst?.legal_name || tenant?.name || "BusinessOS Enterprise";
    const orgAddress = activeGst?.address || tenant?.settings?.address || "100 Innovation Boulevard, Tech District";
    const orgGstin = activeGst?.gstin || tenant?.settings?.gstin || "";
    const orgCin = activeGst?.cin || tenant?.settings?.cin || "";
    const orgEmail = activeGst?.email || tenant?.settings?.email || "hr@businessos.ai";
    const rawLogo = (activeGst as any)?.logo_url || tenant?.logo_url || (tenant as any)?.raw?.logo_url || "";
    const orgLogo = resolveImageUrl(rawLogo);
    const orgInitials = (tenant?.logo_initials || orgName.slice(0, 2)).toUpperCase();

  const [resignations, setResignations] = useState<ExitResignation[]>([]);
  const [clearanceTasks, setClearanceTasks] = useState<ExitClearanceTask[]>([]);
  const [settlements, setSettlements] = useState<ExitFinalSettlement[]>([]);
  const [letters, setLetters] = useState<ExitExperienceLetter[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Modals state
  const [resignOpen, setResignOpen] = useState(false);
  const [settlementOpen, setSettlementOpen] = useState(false);

  // Forms state
  const [resignForm, setResignForm] = useState({
    employeeId: "",
    lastWorkingDay: "",
    reason: "",
    status: "Pending"
  });

  const [settlementForm, setSettlementForm] = useState({
    employeeId: "",
    lastWorkingDay: "",
    salaryAmount: 3500,
    leaveEncashment: 485,
    gratuity: 2800,
    bonus: 1500,
    pf: 8400,
    tax: -1200
  });

  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [rRes, cRes, sRes, lRes, eRes] = await Promise.all([
        exitApi.listResignations(),
        exitApi.listClearance(),
        exitApi.listSettlements(),
        exitApi.listExperienceLetters(),
        employeesApi.list(1, 100)
      ]);
      setResignations(rRes.items);
      setClearanceTasks(cRes.items);
      setSettlements(sRes.items);
      setLetters(lRes.items);
      setEmployees(eRes.items);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to load exit pipeline records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tab]);

  // Handle Resignation Request Filing
  const handleFileResignation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resignForm.employeeId || !resignForm.lastWorkingDay || !resignForm.reason) {
      showNotification("Please select employee and provide resignation details.", "error");
      return;
    }
    const emp = employees.find(x => x.id === resignForm.employeeId);
    try {
      await exitApi.createResignation({
        employee_id: resignForm.employeeId,
        employee_name: emp ? emp.full_name : "Employee",
        department: emp?.department_id ? "Engineering" : "Operations",
        designation: emp?.designation_id ? "Staff" : "UX Designer",
        last_working_day: resignForm.lastWorkingDay,
        reason: resignForm.reason,
        status: resignForm.status
      });

      // Automatically create clearance tasks for the employee
      const tasks = [
        { task: "Laptop & Access Card returned", dept: "IT", assigned: "IT Team" },
        { task: "Expense settlements cleared", dept: "Finance", assigned: "Finance" },
        { task: "Exit interview completed", dept: "HR", assigned: "HR Partner" },
        { task: "KT (Knowledge Transfer) signed off", dept: "Manager", assigned: "Reporting Mgr" }
      ];

      await Promise.all(
        tasks.map(t =>
          exitApi.createClearance({
            employee_id: resignForm.employeeId,
            employee_name: emp ? emp.full_name : "Employee",
            department: t.dept,
            task: t.task,
            status: "Pending",
            assigned_to: t.assigned
          })
        )
      );

      showNotification("Resignation request filed and clearance checklist generated.");
      setResignOpen(false);
      setResignForm({ employeeId: "", lastWorkingDay: "", reason: "", status: "Pending" });
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to submit resignation request.", "error");
    }
  };

  // Process Resignation Status
  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await exitApi.updateResignation(id, { status: newStatus });
      
      // If accepted/completed, create experience letter record automatically
      if (newStatus === "Accepted") {
        await exitApi.createExperienceLetter({
          employee_id: res.employee_id,
          employee_name: res.employee_name,
          designation: res.designation,
          from_date: new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
          to_date: res.last_working_day,
          issued_on: "—",
          status: "Pending"
        });
      }
      
      showNotification(`Resignation updated to ${newStatus}`);
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to update resignation status.", "error");
    }
  };

  // Mark Clearance Task Complete
  const handleToggleClearance = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "Done" ? "Pending" : "Done";
    try {
      await exitApi.updateClearance(id, { status: newStatus });
      showNotification("Clearance task status updated.");
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to update task.", "error");
    }
  };

  // Generate Full & Final Settlement calculation
  const handleCreateSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlementForm.employeeId || !settlementForm.lastWorkingDay) {
      showNotification("Please select employee and last working day.", "error");
      return;
    }
    const emp = employees.find(x => x.id === settlementForm.employeeId);
    try {
      await exitApi.createSettlement({
        employee_id: settlementForm.employeeId,
        employee_name: emp ? emp.full_name : "Employee",
        last_working_day: settlementForm.lastWorkingDay,
        components_json: [
          { item: "Salary for Final Month", amount: Number(settlementForm.salaryAmount) },
          { item: "Leave Encashment (unused leaves)", amount: Number(settlementForm.leaveEncashment) },
          { item: "Gratuity Payout", amount: Number(settlementForm.gratuity) },
          { item: "Pro-rated Annual Bonus", amount: Number(settlementForm.bonus) },
          { item: "Provident Fund Settlement", amount: Number(settlementForm.pf) },
          { item: "TDS Deduction (Final adjustment)", amount: Number(settlementForm.tax) }
        ]
      });
      showNotification("Full & Final (F&F) settlement calculated successfully.");
      setSettlementOpen(false);
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to save settlement.", "error");
    }
  };

  // Issue Experience Letters
  const handleIssueLetter = async (id: string) => {
    try {
      await exitApi.updateExperienceLetter(id, {
        status: "Issued",
        issued_on: new Date().toISOString().split('T')[0]
      });
      showNotification("Experience & Relieving letter issued.");
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to issue letter.", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="size-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground font-sans">Querying database exit pipeline...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center space-y-4 font-sans">
        <AlertTriangle className="size-12 text-red-500 mx-auto" />
        <p className="text-red-500 font-medium">{error}</p>
        <Button onClick={loadData}>Retry Connection</Button>
      </div>
    );
  }

  // Clearance sub-tab
  if (tab === "clearance") {
    const uniqueEmployees = Array.from(new Set(clearanceTasks.map(t => t.employee_name)));

    return (
      <div className="p-6 space-y-6">
        {notification && (
          <div className="fixed bottom-4 right-4 px-4 py-2.5 bg-emerald-600 text-white font-sans text-xs shadow-lg z-50 rounded-lg">
            {notification.message}
          </div>
        )}

        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Clearance Checklists</h2>
          <p className="text-xs text-muted-foreground font-sans">Verify asset recovery and departmental approvals for outgoing staff.</p>
        </div>

        {uniqueEmployees.length === 0 ? (
          <div className="text-center p-12 glass-panel border border-border/50 rounded-xl">
            <Shield className="size-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm font-semibold">No employees currently in exit clearance state.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {uniqueEmployees.map(empName => {
              const tasks = clearanceTasks.filter(t => t.employee_name === empName);
              const doneCount = tasks.filter(t => t.status === "Done").length;
              const percent = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

              return (
                <div key={empName} className="glass-panel p-6 rounded-xl border border-border/50 space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-foreground text-lg">{empName}</h3>
                      <p className="text-xs text-muted-foreground">Department: {tasks[0]?.department || "Engineering"}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-primary">{percent}%</span>
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase">Cleared</p>
                    </div>
                  </div>

                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${percent}%` }} />
                  </div>

                  <div className="space-y-3 pt-2">
                    {tasks.map(t => (
                      <div key={t.id} className="flex items-center justify-between text-sm py-1 border-b border-border/20 last:border-0">
                        <div className="flex items-center gap-3">
                          <button onClick={() => handleToggleClearance(t.id, t.status)} 
                            className={`size-5 rounded-full flex items-center justify-center border transition-all ${t.status === "Done" ? "bg-emerald-500 border-emerald-500" : "border-border hover:bg-muted"}`}>
                            {t.status === "Done" && <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </button>
                          <span className={`${t.status === "Done" ? "text-muted-foreground line-through" : "text-foreground font-semibold"}`}>{t.task}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-muted-foreground font-bold">{t.department} Unit · Admin: {t.assigned_to}</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${t.status === "Done" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>{t.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Final Settlement sub-tab
  if (tab === "final_settlement") {
    return (
      <div className="p-6 space-y-6">
        {notification && (
          <div className="fixed bottom-4 right-4 px-4 py-2.5 bg-emerald-600 text-white font-sans text-xs shadow-lg z-50 rounded-lg">
            {notification.message}
          </div>
        )}

        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Final Settlements (Full & Final)</h2>
            <p className="text-xs text-muted-foreground font-sans">Full and Final (F&F) audit computations for released personnel.</p>
          </div>
          <button onClick={() => setSettlementOpen(true)} className="flex items-center gap-1.5 px-3 h-8 gradient-brand text-white rounded-lg text-xs font-semibold shadow-elegant hover:opacity-90 transition-opacity">
            <Calculator className="size-3.5" /> Compute F&F
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {settlements.map(set => {
            const total = set.components_json.reduce((sum, c) => sum + c.amount, 0);
            return (
              <div key={set.id} className="glass-panel p-6 rounded-xl border border-border/50 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-foreground text-lg">{set.employee_name}</h3>
                      <p className="text-xs text-muted-foreground">Release Date: {new Date(set.last_working_day).toLocaleDateString()}</p>
                    </div>
                    <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-500 rounded text-xs font-bold">Audited</span>
                  </div>

                  <div className="space-y-2 border-t border-b border-border/40 py-3 mb-4">
                    {set.components_json.map((c, i) => (
                      <div key={i} className="flex justify-between text-xs font-medium">
                        <span className="text-muted-foreground">{c.item}</span>
                        <span className={c.amount < 0 ? "text-red-500 font-bold" : "text-foreground font-bold"}>
                          {currency.symbol}{c.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-bold text-foreground text-sm">F&F Settlement Payout:</span>
                  <span className="text-2xl font-bold text-emerald-500">{currency.symbol}{total.toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Compute F&F Modal */}
        <AnimatePresence>
          {settlementOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl p-6 space-y-4 font-sans text-sm">
                <div className="flex justify-between items-center pb-2 border-b border-border">
                  <h3 className="text-base font-bold text-foreground">Calculate Full & Final Settlement</h3>
                  <button onClick={() => setSettlementOpen(false)}><XCircle className="size-5 text-muted-foreground" /></button>
                </div>
                <form onSubmit={handleCreateSettlement} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Select Employee</label>
                    <select value={settlementForm.employeeId} onChange={(e) => setSettlementForm({...settlementForm, employeeId: e.target.value})}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none">
                      <option value="">Choose employee...</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Last Working Day</label>
                      <Input type="date" value={settlementForm.lastWorkingDay} onChange={(e) => setSettlementForm({...settlementForm, lastWorkingDay: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Final Month Salary ({currency.symbol})</label>
                      <Input type="number" value={settlementForm.salaryAmount} onChange={(e) => setSettlementForm({...settlementForm, salaryAmount: Number(e.target.value)})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Leave Encashment ({currency.symbol})</label>
                      <Input type="number" value={settlementForm.leaveEncashment} onChange={(e) => setSettlementForm({...settlementForm, leaveEncashment: Number(e.target.value)})} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Gratuity Benefit ({currency.symbol})</label>
                      <Input type="number" value={settlementForm.gratuity} onChange={(e) => setSettlementForm({...settlementForm, gratuity: Number(e.target.value)})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Annual Performance Bonus ({currency.symbol})</label>
                      <Input type="number" value={settlementForm.bonus} onChange={(e) => setSettlementForm({...settlementForm, bonus: Number(e.target.value)})} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">TDS Tax Deductions ({currency.symbol})</label>
                      <Input type="number" value={settlementForm.tax} onChange={(e) => setSettlementForm({...settlementForm, tax: Number(e.target.value)})} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setSettlementOpen(false)}>Cancel</Button>
                    <Button type="submit">Verify & Save F&F</Button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Print Official Experience Certificate
  const handlePrintExperienceCertificate = (letObj: ExitExperienceLetter) => {
    const printWin = window.open("", "_blank", "width=850,height=1100");
    if (!printWin) {
      alert("Please allow popups to print or download the Experience & Relieving Certificate.");
      return;
    }

    const fromStr = new Date(letObj.from_date).toLocaleDateString("en-IN", { dateStyle: "long" });
    const toStr = new Date(letObj.to_date).toLocaleDateString("en-IN", { dateStyle: "long" });
    const issuedStr = letObj.issued_on && letObj.issued_on !== "—" ? new Date(letObj.issued_on).toLocaleDateString("en-IN", { dateStyle: "long" }) : new Date().toLocaleDateString("en-IN", { dateStyle: "long" });

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Service Certificate & Relieving Letter - ${letObj.employee_name}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 18mm 20mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            }
            body {
              background: #ffffff;
              color: #0f172a;
              padding: 20px;
              font-size: 10pt;
              line-height: 1.6;
            }
            .page-container {
              max-width: 720px;
              margin: 0 auto;
              background: #ffffff;
            }
            .header-banner {
              border-bottom: 2.5px solid #1e1b4b;
              padding-bottom: 16px;
              margin-bottom: 24px;
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .header-banner h1 {
              font-size: 18pt;
              font-weight: 900;
              color: #1e1b4b;
              letter-spacing: -0.5px;
            }
            .header-banner p {
              font-size: 8pt;
              color: #64748b;
              margin-top: 2px;
            }
            .cert-badge {
              text-align: right;
            }
            .cert-badge span {
              display: inline-block;
              background: #1e1b4b;
              color: #ffffff;
              font-size: 8pt;
              font-weight: 800;
              padding: 4px 12px;
              border-radius: 6px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .cert-title {
              text-align: center;
              font-size: 14pt;
              font-weight: 900;
              color: #1e1b4b;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin: 24px 0 20px 0;
              text-decoration: underline;
            }
            .body-text {
              font-size: 10pt;
              color: #334155;
              margin-bottom: 16px;
              text-align: justify;
            }
            .details-box {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 16px;
              margin: 20px 0;
              font-size: 9.5pt;
            }
            .details-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
            }
            .details-grid .item-label {
              font-size: 8pt;
              font-weight: 800;
              color: #64748b;
              text-transform: uppercase;
            }
            .details-grid .item-val {
              font-weight: 700;
              color: #0f172a;
            }
            .signatures-grid {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              margin-top: 50px;
              padding-top: 16px;
              border-top: 1px dashed #cbd5e1;
            }
            .sign-column {
              width: 45%;
            }
            .sign-line {
              height: 45px;
              border-bottom: 1.5px solid #0f172a;
              margin-bottom: 6px;
            }
            .sign-name {
              font-size: 10pt;
              font-weight: 800;
              color: #0f172a;
            }
            .sign-title {
              font-size: 8.5pt;
              color: #64748b;
            }
            .footer-strip {
              margin-top: 40px;
              padding-top: 12px;
              border-top: 1px solid #e2e8f0;
              display: flex;
              justify-content: space-between;
              font-size: 7.5pt;
              color: #94a3b8;
            }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="page-container">
            <div class="header-banner">
              <div style="display: flex; align-items: center; gap: 14px;">
                ${orgLogo ? `<img src="${orgLogo}" alt="${orgName}" style="max-height: 52px; max-width: 150px; object-fit: contain;" />` : `<div style="width: 44px; height: 44px; border-radius: 8px; background: #1e1b4b; color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 14pt;">${orgInitials}</div>`}
                <div>
                  <h1>${orgName}</h1>
                  <p>${orgAddress}</p>
                  <p>Email: ${orgEmail} • Phone: ${orgPhone}${orgGstin ? ` • GSTIN: ${orgGstin}` : ""}</p>
                </div>
              </div>
              <div class="cert-badge">
                <span>Official Work Certificate</span>
                <p style="font-size:8pt; color:#64748b; margin-top:4px;">Date: ${issuedStr}</p>
                <p style="font-size:8pt; font-family:monospace; color:#64748b;">REF: BOS-EXP-${Math.floor(1000 + Math.random() * 9000)}</p>
              </div>
            </div>

            <div class="cert-title">Service Experience & Relieving Certificate</div>

            <p class="body-text" style="font-weight:700; margin-bottom:8px;">TO WHOMSOEVER IT MAY CONCERN</p>

            <p class="body-text">
              This is to certify that <strong>${letObj.employee_name}</strong> was employed with <strong>${orgName}</strong> as a <strong>${letObj.designation}</strong> from <strong>${fromStr}</strong> to <strong>${toStr}</strong>.
            </p>

            <div class="details-box">
              <div class="details-grid">
                <div>
                  <p class="item-label">Employee Name</p>
                  <p class="item-val">${letObj.employee_name}</p>
                </div>
                <div>
                  <p class="item-label">Designation / Role</p>
                  <p class="item-val">${letObj.designation}</p>
                </div>
                <div>
                  <p class="item-label">Date of Joining</p>
                  <p class="item-val">${fromStr}</p>
                </div>
                <div>
                  <p class="item-label">Date of Relieving</p>
                  <p class="item-val">${toStr}</p>
                </div>
              </div>
            </div>

            <p class="body-text">
              During their tenure with us, ${letObj.employee_name} demonstrated commendable dedication, integrity, and technical competence in executing their assigned duties and cross-functional responsibilities.
            </p>

            <p class="body-text">
              All official clearance protocols and handover procedures have been successfully fulfilled. We formally relieve them of their responsibilities as of the close of business hours on <strong>${toStr}</strong> and wish them the very best in their future career endeavors.
            </p>

            <div class="signatures-grid">
              <div class="sign-column">
                <div class="sign-line"></div>
                <div class="sign-name">Authorized Signatory</div>
                <div class="sign-title">Human Resources & People Operations • ${orgName}</div>
              </div>

              <div class="sign-column" style="text-align: right;">
                <div style="height: 45px; display:flex; align-items:flex-end; justify-content:flex-end;">
                  <span style="border: 2px solid #4f46e5; color: #4f46e5; font-size: 7.5pt; font-weight: 800; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">Corporate Verified</span>
                </div>
                <div class="sign-name">Corporate Seal</div>
                <div class="sign-title">${orgName}</div>
              </div>
            </div>

            <div class="footer-strip">
              <div>Verification Hash: SEC-CERT-${Math.floor(100000 + Math.random() * 900000)}</div>
              <div>${orgName} • Confidential Employee Record</div>
            </div>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 300);
            };
          </script>
        </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
  };

  // Experience Letter sub-tab
  if (tab === "experience_letter") {
    return (
      <div className="p-6 space-y-6">
        {notification && (
          <div className="fixed bottom-4 right-4 px-4 py-2.5 bg-emerald-600 text-white font-sans text-xs shadow-lg z-50 rounded-lg">
            {notification.message}
          </div>
        )}

        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Relieving & Experience Letters</h2>
          <p className="text-xs text-muted-foreground font-sans">Generate, preview, and print official work certificates and relieving letters for departing corporate members.</p>
        </div>

        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left font-sans">
              <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4 font-semibold">Employee</th>
                  <th className="px-6 py-4 font-semibold">Designation</th>
                  <th className="px-6 py-4 font-semibold">Tenure</th>
                  <th className="px-6 py-4 font-semibold">Issued Date</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {letters.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground font-semibold">
                      No relieving or experience letters generated yet. 
                      Mark active resignation requests as "Completed" (Relieved) to automatically generate them.
                    </td>
                  </tr>
                ) : (
                  letters.map((letObj, i) => (
                    <motion.tr key={letObj.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.08 }}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 font-semibold text-foreground">{letObj.employee_name}</td>
                      <td className="px-6 py-4 text-muted-foreground font-semibold">{letObj.designation}</td>
                      <td className="px-6 py-4 text-muted-foreground font-semibold">{new Date(letObj.from_date).toLocaleDateString()} to {new Date(letObj.to_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-muted-foreground font-semibold">{letObj.issued_on}</td>
                      <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded text-xs font-bold ${letObj.status === "Issued" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>{letObj.status}</span></td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex gap-2 justify-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 gap-1.5 h-8 text-xs font-bold"
                            onClick={() => handlePrintExperienceCertificate(letObj)}
                          >
                            <Printer className="size-3.5" /> Print Certificate
                          </Button>
                          {letObj.status !== "Issued" ? (
                            <Button size="sm" onClick={() => handleIssueLetter(letObj.id)} className="h-8 text-xs font-bold">
                              Approve & Dispatch
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground font-semibold self-center">Dispatched</span>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Default: resignation requests
  return (
    <div className="space-y-6">
      {notification && (
        <div className="fixed bottom-4 right-4 px-4 py-2.5 bg-emerald-600 text-white font-sans text-xs shadow-lg z-50 rounded-lg">
          {notification.message}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Resignation Requests</h2>
          <p className="text-xs text-muted-foreground font-sans">Process formal resignation applications and set last working days.</p>
        </div>
        <button onClick={() => setResignOpen(true)} className="flex items-center gap-1.5 px-3 h-8 gradient-brand text-white rounded-lg text-xs font-semibold shadow-elegant hover:opacity-90 transition-opacity">
          <Plus className="size-3.5" /> File Resignation
        </button>
      </div>

      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left font-sans">
            <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4 font-semibold">Employee</th>
                <th className="px-6 py-4 font-semibold">Resign Date</th>
                <th className="px-6 py-4 font-semibold">Last Working Day</th>
                <th className="px-6 py-4 font-semibold">Reason</th>
                <th className="px-6 py-4 text-center font-semibold">Status</th>
                <th className="px-6 py-4 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {resignations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground font-semibold">
                    No resignation requests registered. 
                    Click "File Resignation" to submit a new resignation request.
                  </td>
                </tr>
              ) : (
                resignations.map((res, i) => (
                  <motion.tr key={res.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.08 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4"><p className="font-semibold text-foreground">{res.employee_name}</p><p className="text-xs text-muted-foreground font-semibold">{res.department} · {res.designation}</p></td>
                    <td className="px-6 py-4 text-muted-foreground font-medium">{new Date(res.resign_date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-muted-foreground font-medium">{new Date(res.last_working_day).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-xs text-muted-foreground font-semibold max-w-[200px] truncate">{res.reason}</td>
                    <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-bold ${res.status === "Completed" ? "bg-emerald-500/10 text-emerald-500" : res.status === "Accepted" ? "bg-blue-500/10 text-blue-500" : "bg-amber-500/10 text-amber-500"}`}>{res.status}</span></td>
                    <td className="px-6 py-4 text-center">
                      {res.status === "Pending" ? (
                        <div className="flex gap-2 justify-center">
                          <Button size="sm" variant="outline" className="border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10 h-8 text-xs font-bold" onClick={() => handleUpdateStatus(res.id, "Accepted")}>Accept</Button>
                          <Button size="sm" variant="destructive" className="h-8 text-xs font-bold" onClick={() => handleUpdateStatus(res.id, "Rejected")}>Reject</Button>
                        </div>
                      ) : res.status === "Accepted" ? (
                        <Button size="sm" className="h-8 text-xs font-bold" onClick={() => handleUpdateStatus(res.id, "Completed")}>Mark Relieved</Button>
                      ) : (
                        <span className="text-xs text-muted-foreground font-semibold">Processed</span>
                      )}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* File Resignation Modal */}
      <AnimatePresence>
        {resignOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl p-6 space-y-4 font-sans text-sm">
              <div className="flex justify-between items-center pb-2 border-b border-border">
                <h3 className="text-base font-bold text-foreground">File Employee Resignation</h3>
                <button onClick={() => setResignOpen(false)}><XCircle className="size-5 text-muted-foreground" /></button>
              </div>
              <form onSubmit={handleFileResignation} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Select Employee</label>
                  <select value={resignForm.employeeId} onChange={(e) => setResignForm({...resignForm, employeeId: e.target.value})}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none">
                    <option value="">Choose employee...</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Requested Last Working Day</label>
                  <Input type="date" value={resignForm.lastWorkingDay} onChange={(e) => setResignForm({...resignForm, lastWorkingDay: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Reason for Leaving</label>
                  <Textarea value={resignForm.reason} onChange={(e) => setResignForm({...resignForm, reason: e.target.value})} placeholder="Provide resignation context..." rows={3} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setResignOpen(false)}>Cancel</Button>
                  <Button type="submit">Submit Resignation</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
