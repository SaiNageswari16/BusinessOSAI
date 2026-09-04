import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { recruitmentApi, Offer, resolveImageUrl } from "@/lib/api-client";
import { Printer, Download, ArrowLeft, CheckCircle, Clock, ShieldCheck, AlertCircle, Building2, Briefcase, Calendar, Award } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/vault/offers/$filename")({
  component: VaultOfferViewerPage,
});

export function VaultOfferViewerPage() {
  const { filename } = Route.useParams();
  const offerId = (filename || "").replace(/\.pdf$/i, "").trim();

  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tenant / Company details from storage or fallbacks
  const storedTenant = typeof window !== "undefined" ? localStorage.getItem("bos-tenant") : null;
  const parsedTenant = storedTenant ? JSON.parse(storedTenant) : null;

  const customData: any = (() => {
    if (!offer?.custom_template) return {};
    try {
      return typeof offer.custom_template === "string" ? JSON.parse(offer.custom_template) : offer.custom_template;
    } catch {
      return {};
    }
  })();

  const orgName = customData.org_name || parsedTenant?.name || "BusinessOS Global Enterprises";
  const orgAddress = customData.org_address || parsedTenant?.address || parsedTenant?.settings?.address || "100 Innovation Boulevard, Tech Hub";
  const orgGstin = customData.org_gstin || parsedTenant?.tax_id || parsedTenant?.settings?.gstin || "07AAAAA0000A1Z5";
  const orgCin = customData.org_cin || parsedTenant?.cin || parsedTenant?.settings?.cin || "U72200DL2024PTC123456";
  const orgEmail = customData.org_email || parsedTenant?.email || parsedTenant?.settings?.email || "hr@businessos.ai";
  const orgPhone = customData.org_phone || parsedTenant?.phone || parsedTenant?.settings?.phone || "+91 98493 44919";
  const orgLogo = resolveImageUrl(customData.org_logo || parsedTenant?.logo_url || parsedTenant?.raw?.logo_url || "");
  const orgInitials = orgName.slice(0, 2).toUpperCase();

  useEffect(() => {
    async function loadOffer() {
      if (!offerId) {
        setError("Invalid offer letter document reference.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Try authenticated fetch first, then public endpoint if auth fails
        try {
          const res = await recruitmentApi.getOffer(offerId);
          setOffer(res);
        } catch {
          const publicRes = await recruitmentApi.getPublicOffer(offerId);
          setOffer(publicRes);
        }
      } catch (err: any) {
        setError(err?.message || "Failed to load the requested offer letter.");
      } finally {
        setLoading(false);
      }
    }

    loadOffer();
  }, [offerId]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    if (!offer) return;
    const downloadUrl = `/api/v1/hrms/recruitment/public/offers/${offer.id}/download-pdf`;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `Official_Offer_Letter_${(offer.candidate || "Employee").replace(/\s+/g, "_")}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportWord = () => {
    if (!offer) return;
    const content = document.getElementById("offer-document-content")?.innerHTML || "";
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Offer Letter - ${offer.candidate}</title>
      <style>
        body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1e293b; line-height: 1.5; }
        table { border-collapse: collapse; width: 100%; margin: 16px 0; }
        th, td { border: 1px solid #cbd5e1; padding: 8px 12px; }
        th { background-color: #f1f5f9; text-align: left; }
      </style>
      </head><body>`;
    const footer = `</body></html>`;
    const blob = new Blob(['\ufeff' + header + content + footer], {
      type: "application/msword",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Offer_Letter_${(offer.candidate || "Employee").replace(/\s+/g, "_")}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest animate-pulse">
          Decrypting & Loading Official Document Vault File...
        </p>
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-card border border-border shadow-xl rounded-2xl p-8 text-center space-y-4">
          <div className="size-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertCircle className="size-8" />
          </div>
          <h2 className="text-xl font-black text-foreground">Document Unavailable</h2>
          <p className="text-sm text-muted-foreground">
            {error || "The requested offer letter document could not be located in the secure compliance vault."}
          </p>
          <div className="pt-4">
            <Link to="/hrms" search={{ tab: "documents" }}>
              <Button variant="default" className="gradient-brand text-white font-bold w-full">
                <ArrowLeft className="size-4 mr-2" /> Return to HRMS Documents
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Calculate Salary Split
  const ctcVal = offer.ctc || 0;
  const basicVal = Math.round((ctcVal * 0.50) / 12);
  const hraVal = Math.round((ctcVal * 0.20) / 12);
  const specialVal = Math.round((ctcVal * 0.20) / 12);
  const pfVal = Math.round((ctcVal * 0.10) / 12);
  const monthlyGross = basicVal + hraVal + specialVal;

  return (
    <div className="min-h-screen bg-slate-200/70 dark:bg-slate-950 py-6 px-3 sm:px-6 font-sans">
      {/* ─── Top Floating Action Bar (Hidden in Print) ─── */}
      <div className="max-w-[850px] mx-auto mb-6 print:hidden">
        <div className="bg-card/90 backdrop-blur-md border border-border shadow-lg rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/hrms" search={{ tab: "documents" }}>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 font-bold">
                <ArrowLeft className="size-4" /> HRMS Vault
              </Button>
            </Link>
            <div className="border-l border-border h-6 mx-1" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-foreground">
                  Official Offer Letter
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {offer.status || "Valid"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                REF: OFFER-{offer.id.slice(0, 8).toUpperCase()} • {offer.candidate}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportWord}
              className="h-9 gap-1.5 font-bold border-border hover:border-primary/50"
            >
              <Download className="size-4 text-blue-600 dark:text-blue-400" /> Download Word
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              className="h-9 gap-1.5 font-bold border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              <Download className="size-4" /> Download PDF
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handlePrint}
              className="h-9 gap-1.5 font-extrabold gradient-brand text-white shadow-md hover:shadow-lg transition-all"
            >
              <Printer className="size-4" /> Print / Save as PDF
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Printable Document Canvas ─── */}
      <div
        id="offer-document-content"
        className="max-w-[850px] mx-auto bg-white text-slate-900 border border-slate-300 shadow-2xl rounded-xl p-8 sm:p-14 print:p-0 print:border-none print:shadow-none print:max-w-none print:rounded-none relative overflow-hidden"
      >
        {/* Subtle Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.03] rotate-[-25deg] text-9xl font-black text-slate-900">
          OFFICIAL
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
                  Talent Acquisition & People Operations
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
              Formal Appointment
            </span>
            <p className="text-xs font-bold text-slate-700">Date: {offer.offer_date || new Date().toISOString().split("T")[0]}</p>
            <p className="text-[11px] font-mono text-slate-500">REF: OFR-{offer.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>

        {/* ─── Candidate Greeting ─── */}
        <div className="mb-6 space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">To:</p>
          <h2 className="text-lg font-black text-slate-900">{offer.candidate}</h2>
          {offer.candidate_email && (
            <p className="text-xs text-slate-600 font-medium">Email: {offer.candidate_email}</p>
          )}
          <p className="text-xs text-slate-600 font-medium">Designation: <strong className="text-slate-900">{offer.role}</strong></p>
        </div>

        {/* ─── Letter Subject & Opening ─── */}
        <div className="mb-6">
          <p className="text-sm font-bold text-slate-900 border-l-4 border-slate-900 pl-3 py-0.5 mb-3">
            Subject: Official Offer of Employment — {offer.role}
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            Dear <strong>{offer.candidate}</strong>,
          </p>
          <p className="text-sm text-slate-700 leading-relaxed mt-2">
            On behalf of <strong>{orgName}</strong>, we are delighted to formally extend this offer of employment for the position of <strong>{offer.role}</strong>. Following our comprehensive discussions, our leadership team is confident that your talent, dedication, and expertise will make a significant impact on our organization.
          </p>
        </div>

        {/* ─── Key Engagement Terms ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Annual Gross CTC</p>
            <p className="text-base font-black text-emerald-600 mt-0.5">₹{ctcVal.toLocaleString("en-IN")}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Target Joining Date</p>
            <p className="text-sm font-bold text-slate-900 mt-0.5">{offer.joining_date || "Mutually Agreed"}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Offer Valid Until</p>
            <p className="text-sm font-bold text-slate-900 mt-0.5">{offer.expiry_date || "7 Days from Issuance"}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Document Status</p>
            <p className="text-sm font-bold text-emerald-700 mt-0.5 flex items-center gap-1">
              <ShieldCheck className="size-3.5" /> Verified Valid
            </p>
          </div>
        </div>

        {/* ─── Detailed Salary Annexure ─── */}
        <div className="my-6">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
            Annexure A: Annual Compensation Breakdown
          </h3>
          <div className="border border-slate-300 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-700">
                  <th className="p-2.5 font-bold">Salary Component</th>
                  <th className="p-2.5 font-bold text-right">Monthly (₹)</th>
                  <th className="p-2.5 font-bold text-right">Annual (₹)</th>
                  <th className="p-2.5 font-bold text-right">Split %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                <tr>
                  <td className="p-2.5 font-semibold">Basic Salary</td>
                  <td className="p-2.5 text-right font-mono">₹{basicVal.toLocaleString("en-IN")}</td>
                  <td className="p-2.5 text-right font-mono">₹{(basicVal * 12).toLocaleString("en-IN")}</td>
                  <td className="p-2.5 text-right text-slate-500">50%</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-semibold">House Rent Allowance (HRA)</td>
                  <td className="p-2.5 text-right font-mono">₹{hraVal.toLocaleString("en-IN")}</td>
                  <td className="p-2.5 text-right font-mono">₹{(hraVal * 12).toLocaleString("en-IN")}</td>
                  <td className="p-2.5 text-right text-slate-500">20%</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-semibold">Special / Personal Allowance</td>
                  <td className="p-2.5 text-right font-mono">₹{specialVal.toLocaleString("en-IN")}</td>
                  <td className="p-2.5 text-right font-mono">₹{(specialVal * 12).toLocaleString("en-IN")}</td>
                  <td className="p-2.5 text-right text-slate-500">20%</td>
                </tr>
                <tr className="text-slate-500 bg-slate-50/50">
                  <td className="p-2.5 font-semibold">Provident Fund (Employer PF Contribution)</td>
                  <td className="p-2.5 text-right font-mono">₹{pfVal.toLocaleString("en-IN")}</td>
                  <td className="p-2.5 text-right font-mono">₹{(pfVal * 12).toLocaleString("en-IN")}</td>
                  <td className="p-2.5 text-right text-slate-500">10%</td>
                </tr>
                <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                  <td className="p-2.5 text-sm">Total Cost to Company (Gross Annual CTC)</td>
                  <td className="p-2.5 text-right font-mono text-sm">₹{Math.round(ctcVal / 12).toLocaleString("en-IN")}</td>
                  <td className="p-2.5 text-right font-mono text-sm text-emerald-700">₹{ctcVal.toLocaleString("en-IN")}</td>
                  <td className="p-2.5 text-right">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-500 italic mt-1.5">
            * Statutory deductions including Professional Tax (PT), Employee PF, and Income Tax (TDS) will be deducted in accordance with applicable statutory laws.
          </p>
        </div>

        {/* ─── Terms & Clauses ─── */}
        <div className="my-6 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
            Terms & Conditions of Employment
          </h3>
          {offer.custom_template ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700 whitespace-pre-line leading-relaxed font-sans">
              {offer.custom_template}
            </div>
          ) : (
            <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
              <p>
                <strong>1. Probation & Confirmation:</strong> You will be on probation for a period of three (3) months from your date of joining. Upon successful evaluation of performance, your appointment will be formally confirmed in writing.
              </p>
              <p>
                <strong>2. Notice Period & Termination:</strong> During probation, either party may terminate the employment contract by giving thirty (30) days notice or salary in lieu thereof. Post-confirmation, the notice period shall be sixty (60) days.
              </p>
              <p>
                <strong>3. Confidentiality & Non-Disclosure:</strong> You shall strictly maintain confidentiality regarding all proprietary information, software codebase, client data, and trade secrets of the Company.
              </p>
              <p>
                <strong>4. Intellectual Property:</strong> Any intellectual property, inventions, designs, or developments created by you during the course of employment shall exclusively belong to {orgName}.
              </p>
            </div>
          )}
        </div>

        {/* ─── Signatures & Verification Block ─── */}
        <div className="mt-12 pt-6 border-t-2 border-slate-300 grid grid-cols-2 gap-8 items-end">
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">For {orgName}:</p>
            <div className="h-12 flex items-end">
              <span className="font-serif italic text-lg text-slate-800 border-b border-slate-400 pb-1 pr-6">
                {offer.signer_name || "Priya Sharma"}
              </span>
            </div>
            <div>
              <p className="text-xs font-black text-slate-900">{offer.signer_name || "Priya Sharma"}</p>
              <p className="text-[11px] text-slate-500">Head of Talent & People Operations</p>
              <p className="text-[10px] text-emerald-600 font-mono flex items-center gap-1 mt-1">
                <CheckCircle className="size-3" /> Digitally Authorized Document
              </p>
            </div>
          </div>

          <div className="space-y-2 border-l border-slate-200 pl-8">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Accepted & Acknowledged by:</p>
            <div className="h-12 border-b border-slate-400 border-dashed" />
            <div>
              <p className="text-xs font-black text-slate-900">{offer.candidate}</p>
              <p className="text-[11px] text-slate-500">Signature of Candidate / Employee</p>
              <p className="text-[10px] text-slate-400 font-mono mt-1">Date: ________________________</p>
            </div>
          </div>
        </div>

        {/* ─── Document Footer ─── */}
        <div className="mt-12 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400">
          Official Appointment Record • Generated securely via {orgName} Compliance Vault • Document ID: {offer.id}
        </div>
      </div>
    </div>
  );
}
