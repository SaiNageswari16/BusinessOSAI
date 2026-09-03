import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { payrollApi, Payslip } from "@/lib/api-client";
import { Printer, Download, ArrowLeft, CheckCircle, Clock, ShieldCheck, AlertCircle, Building2, Briefcase, Calendar, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/vault/payslips/$filename")({
  component: VaultPayslipViewerPage,
});

export function VaultPayslipViewerPage() {
  const { filename } = Route.useParams();
  const slipId = (filename || "").replace(/\.pdf$/i, "").trim();

  const [slip, setSlip] = useState<Payslip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tenant / Company details from storage or fallbacks
  const storedTenant = typeof window !== "undefined" ? localStorage.getItem("bos-tenant") : null;
  const parsedTenant = storedTenant ? JSON.parse(storedTenant) : null;
  const orgName = parsedTenant?.name || "BusinessOS Global Enterprises";
  const orgAddress = parsedTenant?.address || parsedTenant?.settings?.address || "100 Innovation Boulevard, Tech Hub";
  const orgGstin = parsedTenant?.tax_id || parsedTenant?.settings?.gstin || "07AAAAA0000A1Z5";
  const orgCin = parsedTenant?.cin || parsedTenant?.settings?.cin || "U72200DL2024PTC123456";
  const orgEmail = parsedTenant?.email || parsedTenant?.settings?.email || "payroll@businessos.ai";
  const orgPhone = parsedTenant?.phone || parsedTenant?.settings?.phone || "+91 98493 44919";
  const orgLogo = parsedTenant?.logo_url || parsedTenant?.raw?.logo_url || "";
  const orgInitials = orgName.slice(0, 2).toUpperCase();

  useEffect(() => {
    async function loadSlip() {
      if (!slipId) {
        setError("Invalid payslip document reference.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        try {
          const res = await payrollApi.getPayslip(slipId);
          setSlip(res);
        } catch {
          const publicRes = await payrollApi.getPublicPayslip(slipId);
          setSlip(publicRes);
        }
      } catch (err: any) {
        setError(err?.message || "Failed to load the requested payslip.");
      } finally {
        setLoading(false);
      }
    }

    loadSlip();
  }, [slipId]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    if (!slip) return;
    const downloadUrl = `/api/v1/hrms/payroll/public/payslips/${slip.id}/download-pdf`;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `Payslip_${(slip.employee_code || "EMP")}_${slip.month}_${slip.year}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest animate-pulse">
          Decrypting & Loading Official Salary Slip...
        </p>
      </div>
    );
  }

  if (error || !slip) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-card border border-border shadow-xl rounded-2xl p-8 text-center space-y-4">
          <div className="size-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertCircle className="size-8" />
          </div>
          <h2 className="text-xl font-black text-foreground">Payslip Unavailable</h2>
          <p className="text-sm text-muted-foreground">
            {error || "The requested salary slip could not be located in the secure compliance vault."}
          </p>
          <div className="pt-4">
            <Link to="/hrms" search={{ tab: "payslips" }}>
              <Button variant="default" className="gradient-brand text-white font-bold w-full">
                <ArrowLeft className="size-4 mr-2" /> Return to HRMS Payslips
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthStr = monthNames[slip.month - 1] || `Month ${slip.month}`;
  const totalDeductions = slip.pf_deduction + slip.esi_deduction + slip.tds_deduction + slip.other_deductions;
  const allowances = slip.hra + slip.other_allowances;

  return (
    <div className="min-h-screen bg-slate-200/70 dark:bg-slate-950 py-6 px-3 sm:px-6 font-sans">
      {/* ─── Top Floating Action Bar (Hidden in Print) ─── */}
      <div className="max-w-[850px] mx-auto mb-6 print:hidden">
        <div className="bg-card/90 backdrop-blur-md border border-border shadow-lg rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/hrms" search={{ tab: "payslips" }}>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 font-bold">
                <ArrowLeft className="size-4" /> HRMS Payroll
              </Button>
            </Link>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-muted/60 rounded-lg text-xs font-mono text-muted-foreground border">
              <ShieldCheck className="size-3.5 text-emerald-500" />
              <span>REF: SLIP-{slip.id.slice(0, 8).toUpperCase()}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              className="h-9 gap-1.5 font-bold hover:bg-muted"
            >
              <Download className="size-4 text-primary" /> Download PDF
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handlePrint}
              className="h-9 gap-1.5 font-bold gradient-brand text-white shadow-md hover:opacity-90"
            >
              <Printer className="size-4" /> Print Payslip
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Formal Printable A4 Document Sheet ─── */}
      <div
        id="payslip-document-content"
        className="max-w-[850px] mx-auto bg-white text-slate-900 border border-slate-300 shadow-2xl rounded-xl p-8 sm:p-14 print:p-0 print:border-none print:shadow-none print:max-w-none print:rounded-none relative overflow-hidden"
      >
        {/* Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.03] rotate-[-25deg] text-9xl font-black text-slate-900">
          CONFIDENTIAL
        </div>

        {/* ─── Company Header Banner ─── */}
        <div className="border-b-2 border-slate-900 pb-6 mb-8 flex justify-between items-start gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3 mb-2">
              {orgLogo ? (
                <img src={orgLogo} alt={orgName} className="h-10 w-auto object-contain" />
              ) : (
                <div className="size-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-base shadow-sm">
                  {orgInitials}
                </div>
              )}
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 leading-none">
                  {orgName}
                </h1>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                  Finance & Payroll Operations Department
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed max-w-md">
              {orgAddress}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 font-medium pt-1">
              <span><strong>GSTIN:</strong> {orgGstin}</span>
              <span><strong>CIN:</strong> {orgCin}</span>
              <span><strong>Email:</strong> {orgEmail}</span>
              <span><strong>Tel:</strong> {orgPhone}</span>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="inline-block bg-slate-900 text-white text-[10px] font-black uppercase px-3 py-1 rounded tracking-widest mb-2">
              Official Payslip
            </span>
            <p className="text-xs font-bold text-slate-700">Period: {monthStr} {slip.year}</p>
            <p className="text-[11px] font-mono text-slate-500">REF: SLIP-{slip.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>

        {/* ─── Employee Details Card ─── */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-8 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-500 font-semibold block text-[10px] uppercase">Employee Name</span>
            <span className="font-bold text-slate-900 text-sm">{slip.employee_name || "Employee"}</span>
          </div>
          <div>
            <span className="text-slate-500 font-semibold block text-[10px] uppercase">Employee Code</span>
            <span className="font-mono font-bold text-slate-900">{slip.employee_code || "EMP-001"}</span>
          </div>
          <div>
            <span className="text-slate-500 font-semibold block text-[10px] uppercase">Payment Status</span>
            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${slip.status === "Paid" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
              {slip.status}
            </span>
          </div>
          <div>
            <span className="text-slate-500 font-semibold block text-[10px] uppercase">Disbursement Mode</span>
            <span className="font-semibold text-slate-900">Direct Bank Transfer</span>
          </div>
        </div>

        {/* ─── Salary Components (Two-Column Earnings & Deductions) ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          {/* Earnings */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-4 py-2.5 font-black text-xs uppercase tracking-wider text-slate-800 border-b border-slate-200 flex justify-between">
              <span>Earnings</span>
              <span>Amount</span>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">Basic Salary</span>
                <span className="font-mono font-bold text-slate-900">₹{slip.basic_salary.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">House Rent Allowance (HRA)</span>
                <span className="font-mono font-bold text-slate-900">₹{slip.hra.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">Special / Other Allowances</span>
                <span className="font-mono font-bold text-slate-900">₹{slip.other_allowances.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="px-4 py-3 flex justify-between bg-emerald-50/50 font-black text-emerald-800">
                <span>Total Gross Earnings</span>
                <span className="font-mono text-sm">₹{slip.gross_salary.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-4 py-2.5 font-black text-xs uppercase tracking-wider text-slate-800 border-b border-slate-200 flex justify-between">
              <span>Deductions</span>
              <span>Amount</span>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">Provident Fund (PF)</span>
                <span className="font-mono font-bold text-slate-900">₹{slip.pf_deduction.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">Employee State Insurance (ESI)</span>
                <span className="font-mono font-bold text-slate-900">₹{slip.esi_deduction.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">TDS / Income Tax</span>
                <span className="font-mono font-bold text-slate-900">₹{slip.tds_deduction.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">Other Deductions</span>
                <span className="font-mono font-bold text-slate-900">₹{slip.other_deductions.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="px-4 py-3 flex justify-between bg-rose-50/50 font-black text-rose-800">
                <span>Total Deductions</span>
                <span className="font-mono text-sm">₹{totalDeductions.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Net Salary Hero Block ─── */}
        <div className="bg-slate-900 text-white rounded-xl p-6 mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">Net Disbursed Take-Home Pay</span>
            <p className="text-xs text-slate-300 mt-1">
              Transferred to registered salary bank account.
            </p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-black text-emerald-400 font-mono tracking-tight">
              ₹{slip.net_salary.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* ─── Legal & Authorization Footer ─── */}
        <div className="border-t border-slate-200 pt-8 grid grid-cols-2 gap-8 text-xs text-slate-600">
          <div>
            <p className="font-bold text-slate-900 mb-1">Important Compliance Notes:</p>
            <p className="text-[11px] leading-relaxed text-slate-500">
              1. This is a computer-generated salary slip and does not require an ink signature.<br />
              2. For any discrepancies in deductions or tax calculation, please contact payroll within 5 business days.<br />
              3. Keep this statement securely for personal income tax filing and proof of income.
            </p>
          </div>
          <div className="text-right flex flex-col justify-end items-end">
            <div className="h-10 border-b border-slate-400 w-44 mb-1"></div>
            <p className="font-bold text-slate-900">Authorized Payroll Signatory</p>
            <p className="text-[10px] text-slate-500 font-mono">{orgName} Compliance Vault</p>
          </div>
        </div>
      </div>
    </div>
  );
}
