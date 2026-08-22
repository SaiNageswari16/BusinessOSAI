import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, CheckCircle2, XCircle, FileText, Store, MapPin, Mail, Phone, ExternalLink } from "lucide-react";
import { marketplaceApi } from "@/lib/marketplace-api";

interface KycApplication {
  id: string;
  companyName: string;
  applicant: string;
  email: string;
  phone: string;
  country: string;
  taxId: string;
  submittedDate: string;
  documents: string[];
  status: "Verified & Approved" | "Rejected" | "Pending Verification";
}

export function VendorApprovalsKYC() {
  const [applications, setApplications] = useState<KycApplication[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchKycList = async () => {
    try {
      setLoading(true);
      const res = await marketplaceApi.getVendorKyc();
      const list = res.kycRequests || [];
      setApplications(list.map((item: any) => ({
        id: item.vendorId,
        companyName: item.vendorName,
        applicant: item.applicant || item.vendorName,
        email: item.email || `${item.vendorName.toLowerCase().replace(/\s+/g, "")}@example.com`,
        phone: item.phone || "Not Provided",
        country: item.country || "Regional Business Registry",
        taxId: item.taxId || "Not Provided",
        submittedDate: item.submittedDate || "2026-08-15",
        documents: item.documents || [],
        status: item.kycStatus === "Verified" ? "Verified & Approved" : (item.kycStatus === "Rejected" ? "Rejected" : "Pending Verification")
      })));
    } catch (err) {
      console.error("Failed to load KYC requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKycList();
  }, []);

  const handleAction = async (vendorId: string, newStatus: "Verified & Approved" | "Rejected") => {
    try {
      const backendKycStatus = newStatus === "Verified & Approved" ? "Verified" : "Rejected";
      await marketplaceApi.updateVendorKycStatus(vendorId, backendKycStatus);
      setApplications(applications.map(a => a.id === vendorId ? { ...a, status: newStatus } : a));
    } catch (err) {
      console.error("Failed to update KYC status:", err);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Vendor Approvals & KYC Verification</h1>
        <p className="text-sm text-muted-foreground">Review trade licenses, tax identification, and approve onboarding applications.</p>
      </div>

      <div className="space-y-4">
        {applications.map((app) => (
          <motion.div
            key={app.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel p-6 rounded-xl border border-border/50 space-y-4"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    {app.companyName}
                    <span className="text-xs font-mono font-normal text-muted-foreground">({app.id.slice(0, 8)})</span>
                  </h3>
                  <p className="text-xs text-muted-foreground">Submitted on {app.submittedDate}</p>
                </div>
              </div>

              <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                app.status === "Verified & Approved" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" :
                app.status === "Rejected" ? "bg-red-500/10 text-red-600 border border-red-500/20" :
                "bg-amber-500/10 text-amber-600 border border-amber-500/20 animate-pulse"
              }`}>
                {app.status}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Applicant Details</p>
                <p className="font-medium text-foreground">{app.applicant}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="size-3.5" /> {app.email}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="size-3.5" /> {app.phone}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Business & Tax Compliance</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5"><MapPin className="size-3.5" /> {app.country}</p>
                <div className="p-2 rounded-lg bg-background/50 border border-border/50 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground font-medium">TAX / GSTIN:</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-semibold uppercase">
                      {app.taxId.length === 15 ? (app.taxId.startsWith("100") ? "UAE TRN" : "GSTIN") : "TAX ID"}
                    </span>
                  </div>
                  <p className="font-mono font-bold text-foreground text-xs">{app.taxId}</p>
                  {app.taxId.length === 15 && !app.taxId.startsWith("100") && (
                    <p className="text-[10px] text-muted-foreground">
                      PAN: <span className="font-mono font-semibold text-foreground">{app.taxId.slice(2, 12)}</span> • State Code: <span className="font-mono font-semibold text-foreground">{app.taxId.slice(0, 2)}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Submitted Documents</p>
                <div className="space-y-1">
                  {app.documents && app.documents.length > 0 ? (
                    app.documents.map((doc: string, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-xs p-1.5 bg-background/50 rounded border border-border/50">
                        <span className="flex items-center gap-1.5 text-foreground"><FileText className="size-3.5 text-primary" /> {doc}</span>
                        <ExternalLink className="size-3 text-muted-foreground cursor-pointer hover:text-primary" />
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-muted-foreground italic py-1">
                      No documents attached
                    </div>
                  )}
                </div>
              </div>
            </div>

            {app.status === "Pending Verification" && (
              <div className="flex justify-end gap-3 pt-3 border-t border-border/50">
                <button
                  onClick={() => handleAction(app.id, "Rejected")}
                  className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <XCircle className="size-4" /> Reject Application
                </button>
                <button
                  onClick={() => handleAction(app.id, "Verified & Approved")}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <CheckCircle2 className="size-4" /> Verify & Approve Vendor
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
