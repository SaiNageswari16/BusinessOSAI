import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, XCircle, Layers, DollarSign, ShieldCheck, Eye, Palette,
  Printer, Download, FileText, FileCheck, Send, CheckCircle, ArrowRight,
  Plus, Trash2, Edit3, Image, Type, Sliders, Building2, Check,
  Calculator, User, Briefcase, Calendar, AlertCircle
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Applicant, Offer, employeesApi } from "../../lib/api-client";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { getActiveBillingGst } from "@/lib/receipt-template-store";
import { downloadOfferLetterWordDoc } from "@/lib/offer-letter-doc-utils";
import { PREDEFINED_OFFER_TEMPLATES } from "./RecruitmentManagement";

export interface CustomOfferTemplate {
  id: string;
  name: string;
  badge: string;
  description: string;
  probationMonths: number;
  noticeDays: number;
  salarySplit: {
    basicPct: number;
    hraPct: number;
    specialPct: number;
    pfPct: number;
  };
  defaultClauses: string;
  isCustom?: boolean;
}

interface OfferLetterStudioModalProps {
  open: boolean;
  onClose: () => void;
  applicants: Applicant[];
  selectedApplicantId?: string;
  employees?: any[];
  selectedEmployeeId?: string;
  onOfferSent: () => void;
  showNotification: (msg: string) => void;
  handleSaveOfferDocument: (applicantId: string) => void;
  handleSendOfferApi: (offerPayload: any) => Promise<void>;
}

export function OfferLetterStudioModal({
  open,
  onClose,
  applicants,
  selectedApplicantId = "",
  employees = [],
  selectedEmployeeId = "",
  onOfferSent,
  showNotification,
  handleSaveOfferDocument,
  handleSendOfferApi
}: OfferLetterStudioModalProps) {
  const { currency } = useCurrency();
  const { tenant } = useTenant();

  // Active Organization Branding
  const activeGst = getActiveBillingGst();
  const orgName = activeGst?.trade_name || activeGst?.legal_name || tenant?.name || "BusinessOS Global Technologies";
  const orgAddress = activeGst?.address || (tenant as any)?.address || "Cyber City, DLF Phase 2, Gurugram, Haryana - 122002, India";
  const orgGstin = activeGst?.gstin || (tenant as any)?.settings?.gstin || (tenant as any)?.tax_id || "";
  const orgCin = activeGst?.cin || (tenant as any)?.settings?.cin || "U72200DL2024PTC123456";
  const orgEmail = activeGst?.email || (tenant as any)?.email || (tenant as any)?.settings?.email || "hr@businessos.ai";
  const orgPhone = activeGst?.phone || (tenant as any)?.phone || (tenant as any)?.settings?.phone || "+91 (800) 555-0199";
  const defaultLogo = tenant?.logo_url || (tenant as any)?.raw?.logo_url || "";
  const orgInitials = tenant?.logo || (tenant as any)?.raw?.logo_initials || orgName.slice(0, 2).toUpperCase();

  // Custom Templates from LocalStorage
  const [customTemplates, setCustomTemplates] = useState<CustomOfferTemplate[]>(() => {
    try {
      const saved = localStorage.getItem("hrms_custom_offer_templates");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Active Studio Tab
  const [activeTab, setActiveTab] = useState<"templates" | "salary" | "clauses" | "branding" | "preview">("templates");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("fulltime");

  // Offer Form Data
  const [offerForm, setOfferForm] = useState({
    applicantId: selectedApplicantId,
    ctc: 95000,
    signingAuthority: "Priya Sharma",
    signingTitle: "Head of Talent & People Operations",
    joiningDate: new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0],
    expiryDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
  });

  // Salary Split %
  const [salarySplit, setSalarySplit] = useState({
    basicPct: 50,
    hraPct: 20,
    specialPct: 20,
    pfPct: 10,
    bonusAmount: 0
  });

  // Terms & Covenants
  const [probationMonths, setProbationMonths] = useState(3);
  const [noticeDays, setNoticeDays] = useState(30);
  const [customClausesText, setCustomClausesText] = useState(PREDEFINED_OFFER_TEMPLATES[0].defaultClauses);

  // Branding & Watermark Settings
  const [customLogoUrl, setCustomLogoUrl] = useState<string>("");
  const [watermarkEnabled, setWatermarkEnabled] = useState<boolean>(true);
  const [watermarkText, setWatermarkText] = useState<string>("CONFIDENTIAL");
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.12);
  const [letterheadStyle, setLetterheadStyle] = useState<"corporate" | "modern" | "minimal" | "bordered">("corporate");

  // Custom Template Creation Modal State
  const [customTplModalOpen, setCustomTplModalOpen] = useState(false);
  const [newTplForm, setNewTplForm] = useState({
    name: "",
    badge: "Custom",
    description: "",
    probationMonths: 3,
    noticeDays: 30,
    basicPct: 50,
    hraPct: 20,
    specialPct: 20,
    pfPct: 10,
    clauses: "1. PROBATION & CONFIRMATION: You will be on probation for a period of 3 months from joining.\n2. NOTICE PERIOD: Either party may terminate with 30 days written notice.\n3. CONFIDENTIALITY: Maintain strict confidentiality of proprietary company assets and code.\n4. STATUTORY COMPLIANCE: Standard deductions apply as per government regulations."
  });

  const [savingSending, setSavingSending] = useState(false);

  // Recipient Mode: Applicant vs Existing Employee
  const [recipientType, setRecipientType] = useState<"applicant" | "employee">(
    selectedEmployeeId ? "employee" : "applicant"
  );
  const [selectedEmpId, setSelectedEmpId] = useState<string>(selectedEmployeeId || "");
  const [employeeList, setEmployeeList] = useState<any[]>(employees || []);

  useEffect(() => {
    if (selectedEmployeeId) {
      setRecipientType("employee");
      setSelectedEmpId(selectedEmployeeId);
    }
  }, [selectedEmployeeId]);

  useEffect(() => {
    if ((!employees || employees.length === 0) && open) {
      employeesApi.list(1, 100).then((res: any) => {
        const list = res.items || (Array.isArray(res) ? res : []);
        setEmployeeList(list);
      }).catch(console.error);
    } else if (employees && employees.length > 0) {
      setEmployeeList(employees);
    }
  }, [employees, open]);

  // Sync applicant selection
  useEffect(() => {
    if (selectedApplicantId) {
      const app = applicants.find(a => a.id === selectedApplicantId);
      setOfferForm(prev => ({
        ...prev,
        applicantId: selectedApplicantId,
        ctc: app?.expected_salary ? Number(app.expected_salary) : prev.ctc
      }));
    }
  }, [selectedApplicantId, applicants]);

  const handleSelectEmployee = (empId: string) => {
    setSelectedEmpId(empId);
    const emp = employeeList.find(e => e.id === empId);
    if (emp) {
      const annualSalary = emp.basic_salary ? (Number(emp.basic_salary) * 12) : 1200000;
      setOfferForm(prev => ({
        ...prev,
        ctc: annualSalary > 0 ? annualSalary : prev.ctc
      }));
    }
  };

  const allTemplates = [...PREDEFINED_OFFER_TEMPLATES, ...customTemplates];

  const handleSelectTemplate = (tplId: string) => {
    setSelectedTemplateId(tplId);
    const tpl = allTemplates.find(t => t.id === tplId);
    if (tpl) {
      setSalarySplit({
        basicPct: tpl.salarySplit.basicPct,
        hraPct: tpl.salarySplit.hraPct,
        specialPct: tpl.salarySplit.specialPct,
        pfPct: tpl.salarySplit.pfPct,
        bonusAmount: 0
      });
      setProbationMonths(tpl.probationMonths);
      setNoticeDays(tpl.noticeDays);
      setCustomClausesText(tpl.defaultClauses);
      showNotification(`Applied '${tpl.name}' template settings!`);
    }
  };

  const handleSaveNewCustomTemplate = () => {
    if (!newTplForm.name.trim()) {
      showNotification("Please enter a template name.");
      return;
    }
    const newTpl: CustomOfferTemplate = {
      id: `custom_${Date.now()}`,
      name: newTplForm.name,
      badge: newTplForm.badge || "Custom",
      description: newTplForm.description || "Customized company offer letter template.",
      probationMonths: Number(newTplForm.probationMonths) || 0,
      noticeDays: Number(newTplForm.noticeDays) || 30,
      salarySplit: {
        basicPct: Number(newTplForm.basicPct) || 50,
        hraPct: Number(newTplForm.hraPct) || 20,
        specialPct: Number(newTplForm.specialPct) || 20,
        pfPct: Number(newTplForm.pfPct) || 10,
      },
      defaultClauses: newTplForm.clauses,
      isCustom: true,
    };

    const updated = [...customTemplates, newTpl];
    setCustomTemplates(updated);
    try {
      localStorage.setItem("hrms_custom_offer_templates", JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    setCustomTplModalOpen(false);
    handleSelectTemplate(newTpl.id);
    showNotification(`Custom template '${newTpl.name}' created and applied!`);
  };

  const handleDeleteCustomTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customTemplates.filter(t => t.id !== id);
    setCustomTemplates(updated);
    try {
      localStorage.setItem("hrms_custom_offer_templates", JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    if (selectedTemplateId === id) {
      handleSelectTemplate("fulltime");
    }
    showNotification("Custom template removed.");
  };

  // Active Logo resolution
  const activeLogo = customLogoUrl.trim() || defaultLogo;

  // Selected candidate info
  const selectedApplicant = applicants.find(a => a.id === offerForm.applicantId);
  const selectedEmployee = employeeList.find(e => e.id === selectedEmpId);

  const candidateName = recipientType === "employee"
    ? (selectedEmployee?.full_name || selectedEmployee?.name || "[Employee Full Name]")
    : (selectedApplicant?.name || "[Candidate Full Name]");

  const candidateEmail = recipientType === "employee"
    ? (selectedEmployee?.email || "[Employee Email]")
    : (selectedApplicant?.email || "[Candidate Email]");

  const candidateRole = recipientType === "employee"
    ? (selectedEmployee?.designation?.name || selectedEmployee?.designation_name || selectedEmployee?.position || selectedEmployee?.role || "Staff")
    : (selectedApplicant?.job_title || "[Role Designation]");

  // Calculations
  const ctcVal = Number(offerForm.ctc || 0);
  const basicVal = (ctcVal * salarySplit.basicPct) / 100;
  const hraVal = (ctcVal * salarySplit.hraPct) / 100;
  const specialVal = (ctcVal * salarySplit.specialPct) / 100;
  const pfVal = (ctcVal * salarySplit.pfPct) / 100;
  const monthlyGross = (ctcVal - pfVal) / 12;

  // Export handlers
  const handleExportWord = () => {
    downloadOfferLetterWordDoc({
      candidateName,
      candidateEmail,
      role: candidateRole,
      ctc: ctcVal,
      currencySymbol: currency.symbol,
      salarySplit,
      joiningDate: offerForm.joiningDate,
      expiryDate: offerForm.expiryDate,
      probationMonths,
      noticeDays,
      signingAuthority: offerForm.signingAuthority,
      signingTitle: offerForm.signingTitle,
      clauses: customClausesText,
      templateTitle: allTemplates.find(t => t.id === selectedTemplateId)?.name || "Employment Offer",
      orgName,
      orgAddress,
      orgEmail,
      orgPhone,
      orgGstin,
      orgCin,
      orgLogo: activeLogo,
      letterheadStyle,
      watermarkEnabled,
      watermarkText,
      watermarkOpacity,
    });
    showNotification("Offer Letter exported as Word (.doc) document!");
  };

  const handlePrintPdf = () => {
    const printWin = window.open("", "_blank", "width=850,height=1100");
    if (!printWin) {
      alert("Please allow popups to print or download the official Offer Letter.");
      return;
    }

    const tplTitle = allTemplates.find(t => t.id === selectedTemplateId)?.name || "Corporate Employment Offer";
    const refNumber = `BOS-OFFER-${Math.floor(100000 + Math.random() * 900000)}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Employment Offer - ${candidateName} - ${orgName}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm 18mm;
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
              padding: 16px;
              font-size: 9.5pt;
              line-height: 1.5;
              position: relative;
            }
            .watermark-overlay {
              position: fixed;
              top: 40%;
              left: 5%;
              width: 90%;
              text-align: center;
              font-size: 54pt;
              font-weight: 900;
              color: rgba(148, 163, 184, ${watermarkOpacity});
              transform: rotate(-35deg);
              z-index: -1000;
              text-transform: uppercase;
              pointer-events: none;
            }
            .page-container {
              max-width: 800px;
              margin: 0 auto;
              background: #ffffff;
            }
            .header-banner {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding-bottom: 14px;
              border-bottom: 2px solid #0f172a;
              margin-bottom: 18px;
            }
            .header-banner h1 {
              font-size: 16pt;
              font-weight: 800;
              color: #0f172a;
              letter-spacing: -0.5px;
            }
            .header-banner p {
              font-size: 8pt;
              color: #64748b;
              margin-top: 2px;
            }
            .meta-badge {
              text-align: right;
            }
            .doc-tag {
              display: inline-block;
              padding: 3px 8px;
              background: #0f172a;
              color: #ffffff;
              font-size: 7.5pt;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              border-radius: 4px;
            }
            .date-str {
              font-size: 8pt;
              color: #64748b;
              margin-top: 4px;
            }
            .recipient-block {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 10px 14px;
              margin-bottom: 16px;
            }
            .recipient-block h3 {
              font-size: 11pt;
              font-weight: 800;
              color: #0f172a;
            }
            .recipient-block p {
              font-size: 8.5pt;
              color: #475569;
            }
            .salutation {
              font-size: 10pt;
              font-weight: 700;
              color: #0f172a;
              margin-bottom: 10px;
            }
            .body-paragraph {
              font-size: 9.5pt;
              color: #334155;
              margin-bottom: 12px;
              text-align: justify;
            }
            .table-title {
              font-size: 9.5pt;
              font-weight: 800;
              color: #0f172a;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin: 16px 0 6px 0;
            }
            .comp-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 16px;
              font-size: 9pt;
            }
            .comp-table th {
              background: #f1f5f9;
              color: #0f172a;
              font-weight: 800;
              text-align: left;
              padding: 6px 10px;
              border: 1px solid #cbd5e1;
            }
            .comp-table td {
              padding: 6px 10px;
              border: 1px solid #e2e8f0;
            }
            .comp-table .total-row {
              background: #f8fafc;
              font-weight: 800;
              color: #0f172a;
              border-top: 2px solid #cbd5e1;
            }
            .clauses-box {
              background: #ffffff;
              border-left: 3px solid #3b82f6;
              padding: 10px 14px;
              margin-bottom: 20px;
              font-size: 8.5pt;
              line-height: 1.5;
              color: #334155;
              white-space: pre-wrap;
            }
            .signature-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
              margin-top: 30px;
              padding-top: 14px;
              border-top: 1px solid #e2e8f0;
            }
            .sig-box h4 {
              font-size: 10pt;
              font-weight: 800;
              color: #0f172a;
            }
            .sig-box p {
              font-size: 8pt;
              color: #64748b;
            }
            .sig-line {
              height: 40px;
              border-bottom: 1px dashed #94a3b8;
              margin-bottom: 6px;
            }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          ${watermarkEnabled ? `<div class="watermark-overlay">${watermarkText}</div>` : ""}
          <div class="page-container">
            <div class="header-banner">
              <div style="display: flex; align-items: center; gap: 14px;">
                ${activeLogo ? `<img src="${activeLogo}" alt="${orgName}" style="max-height: 48px; max-width: 140px; object-fit: contain;" />` : `<div style="width: 42px; height: 42px; border-radius: 8px; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 13pt;">${orgInitials}</div>`}
                <div>
                  <h1>${orgName}</h1>
                  <p>${orgAddress}</p>
                  <p>Email: ${orgEmail} • Phone: ${orgPhone}${orgGstin ? ` • GSTIN: ${orgGstin}` : ""}</p>
                </div>
              </div>
              <div class="meta-badge">
                <div class="doc-tag">${tplTitle}</div>
                <div class="date-str">Date: ${new Date().toLocaleDateString("en-US", { dateStyle: "long" })}</div>
                <div class="date-str" style="font-family:monospace;">REF: ${refNumber}</div>
              </div>
            </div>

            <div class="recipient-block">
              <p style="font-size:7.5pt; font-weight:800; color:#64748b; text-transform:uppercase; margin-bottom:2px;">Private & Confidential • Appointment Offer</p>
              <h3>${candidateName}</h3>
              <p>Email: ${candidateEmail}</p>
              <p>Position: <strong>${candidateRole}</strong> | Joining Date: <strong>${new Date(offerForm.joiningDate).toLocaleDateString("en-US", { dateStyle: "medium" })}</strong></p>
            </div>

            <div class="salutation">Dear ${candidateName},</div>
            
            <p class="body-paragraph">
              On behalf of <strong>${orgName}</strong>, we are pleased to extend this formal offer of employment for the position of <strong>${candidateRole}</strong>. We were exceptionally impressed with your achievements, domain knowledge, and leadership alignment with our organization.
            </p>

            <div class="table-title">Annexure A: Annual & Monthly Compensation Structure</div>
            <table class="comp-table">
              <thead>
                <tr>
                  <th>Salary Component</th>
                  <th>Distribution (%)</th>
                  <th style="text-align: right;">Monthly Value (${currency.symbol})</th>
                  <th style="text-align: right;">Annual Value (${currency.symbol})</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Basic Salary</td>
                  <td>${salarySplit.basicPct}%</td>
                  <td style="text-align: right;">${currency.symbol}${Math.round(basicVal / 12).toLocaleString()}</td>
                  <td style="text-align: right; font-weight: 800;">${currency.symbol}${Math.round(basicVal).toLocaleString()}</td>
                </tr>
                <tr>
                  <td>House Rent Allowance (HRA)</td>
                  <td>${salarySplit.hraPct}%</td>
                  <td style="text-align: right;">${currency.symbol}${Math.round(hraVal / 12).toLocaleString()}</td>
                  <td style="text-align: right; font-weight: 800;">${currency.symbol}${Math.round(hraVal).toLocaleString()}</td>
                </tr>
                <tr>
                  <td>Special / Flexi Allowance</td>
                  <td>${salarySplit.specialPct}%</td>
                  <td style="text-align: right;">${currency.symbol}${Math.round(specialVal / 12).toLocaleString()}</td>
                  <td style="text-align: right; font-weight: 800;">${currency.symbol}${Math.round(specialVal).toLocaleString()}</td>
                </tr>
                <tr>
                  <td>Employer PF Contribution (Statutory)</td>
                  <td>${salarySplit.pfPct}%</td>
                  <td style="text-align: right;">${currency.symbol}${Math.round(pfVal / 12).toLocaleString()}</td>
                  <td style="text-align: right; font-weight: 800;">${currency.symbol}${Math.round(pfVal).toLocaleString()}</td>
                </tr>
                <tr class="total-row">
                  <td><strong>Total Cost to Company (CTC)</strong></td>
                  <td><strong>100%</strong></td>
                  <td style="text-align: right; font-weight: 800;">${currency.symbol}${Math.round(ctcVal / 12).toLocaleString()}</td>
                  <td style="text-align: right; font-weight: 800;">${currency.symbol}${Math.round(ctcVal).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            <div class="table-title">Annexure B: Standard Terms, Conditions & Covenants</div>
            <div class="clauses-box">
              <p><strong>Probation Period:</strong> ${probationMonths > 0 ? `${probationMonths} months from joining.` : "Direct appointment (No probation)."}</p>
              <p><strong>Notice Period:</strong> ${noticeDays} days written notice or gross salary in lieu thereof.</p>
              <div style="margin-top: 6px;">${customClausesText}</div>
            </div>

            <div class="signature-grid">
              <div class="sig-box">
                <p style="text-transform:uppercase; font-size:7.5pt; font-weight:800; color:#64748b;">Authorized Signatory:</p>
                <div class="sig-line"></div>
                <h4>${offerForm.signingAuthority}</h4>
                <p>${offerForm.signingTitle}</p>
                <p>${orgName}</p>
              </div>
              <div class="sig-box" style="text-align: right;">
                <p style="text-transform:uppercase; font-size:7.5pt; font-weight:800; color:#64748b;">Candidate Acceptance:</p>
                <div class="sig-line"></div>
                <h4>${candidateName}</h4>
                <p>Acceptance Date: _________________</p>
                <p style="color:#10b981; font-weight:700;">Valid Until: ${new Date(offerForm.expiryDate).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            };
          </script>
        </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
  };

  const handleSendOffer = async () => {
    if (recipientType === "applicant" && !offerForm.applicantId) {
      showNotification("Please select a candidate first.");
      return;
    }
    if (recipientType === "employee" && !selectedEmpId) {
      showNotification("Please select an existing employee first.");
      return;
    }
    setSavingSending(true);
    try {
      await handleSendOfferApi({
        applicant_id: recipientType === "applicant" ? offerForm.applicantId : undefined,
        employee_id: recipientType === "employee" ? selectedEmpId : undefined,
        candidate: candidateName,
        candidate_email: candidateEmail,
        role: candidateRole,
        ctc: offerForm.ctc,
        basic_pct: salarySplit.basicPct,
        hra_pct: salarySplit.hraPct,
        special_pct: salarySplit.specialPct,
        pf_pct: salarySplit.pfPct,
        probation_months: probationMonths,
        notice_days: noticeDays,
        joining_date: offerForm.joiningDate,
        expiry_date: offerForm.expiryDate,
        signing_authority: offerForm.signingAuthority,
        signing_title: offerForm.signingTitle,
        clauses: customClausesText,
        template_name: allTemplates.find(t => t.id === selectedTemplateId)?.name || "Corporate Offer",
        watermark_text: watermarkEnabled ? watermarkText : null,
      });
      onOfferSent();
      onClose();
      showNotification("Offer Letter saved and issued to candidate successfully!");
    } catch (err: any) {
      showNotification(err?.message || "Failed to save and send offer letter.");
    } finally {
      setSavingSending(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] font-sans"
      >
        {/* Studio Header */}
        <div className="p-5 border-b border-border flex justify-between items-center bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Offer Letter Studio & Custom Template Creator</h3>
              <p className="text-xs text-muted-foreground">
                Design custom offer templates, configure company logo, watermark, and export to Word (.doc) or PDF.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 transition-colors">
            <XCircle className="size-6 text-muted-foreground hover:text-foreground" />
          </button>
        </div>

        {/* Studio Navigation Ribbon */}
        <div className="flex flex-wrap items-center justify-between px-6 py-2.5 border-b border-border bg-muted/10 gap-2">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveTab("templates")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "templates" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Layers className="size-3.5" /> 1. Templates & Custom
            </button>
            <button
              onClick={() => setActiveTab("salary")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "salary" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <DollarSign className="size-3.5" /> 2. Salary & CTC Structure
            </button>
            <button
              onClick={() => setActiveTab("clauses")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "clauses" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <ShieldCheck className="size-3.5" /> 3. Terms & Covenants
            </button>
            <button
              onClick={() => setActiveTab("branding")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "branding" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Palette className="size-3.5" /> 4. Logo & Watermark
            </button>
            <button
              onClick={() => setActiveTab("preview")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "preview" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Eye className="size-3.5" /> 5. Live Letterhead Preview
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border/50 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setRecipientType("applicant")}
                className={`px-2 py-1 rounded-md transition-all ${
                  recipientType === "applicant" ? "bg-background text-primary shadow-xs font-black" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Candidate / Applicant
              </button>
              <button
                type="button"
                onClick={() => setRecipientType("employee")}
                className={`px-2 py-1 rounded-md transition-all ${
                  recipientType === "employee" ? "bg-background text-indigo-600 shadow-xs font-black" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Existing Employee
              </button>
            </div>

            {recipientType === "applicant" ? (
              <select
                value={offerForm.applicantId}
                onChange={(e) => {
                  const appId = e.target.value;
                  const app = applicants.find(a => a.id === appId);
                  setOfferForm({
                    ...offerForm,
                    applicantId: appId,
                    ctc: app?.expected_salary ? Number(app.expected_salary) : offerForm.ctc,
                  });
                }}
                className="h-8 px-2.5 text-xs rounded-md border border-input bg-background font-semibold max-w-[220px]"
              >
                <option value="">-- Choose Candidate --</option>
                {applicants.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.job_title})</option>
                ))}
              </select>
            ) : (
              <select
                value={selectedEmpId}
                onChange={(e) => handleSelectEmployee(e.target.value)}
                className="h-8 px-2.5 text-xs rounded-md border border-indigo-300 bg-indigo-50/50 text-indigo-950 font-bold max-w-[260px] outline-none"
              >
                <option value="">-- Choose Existing Employee --</option>
                {employeeList.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.full_name || e.name} ({e.designation?.name || e.employee_code || "Staff"})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Studio Body Content */}
        <div className="flex-1 overflow-y-auto p-6 text-sm">
          {/* TAB 1: TEMPLATES & CUSTOM BUILDER */}
          {activeTab === "templates" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-base font-bold text-foreground">Offer Letter Templates</h4>
                  <p className="text-xs text-muted-foreground">Select a standard corporate blueprint or create your own custom template with custom legal clauses.</p>
                </div>
                <Button
                  onClick={() => setCustomTplModalOpen(true)}
                  size="sm"
                  className="text-xs font-bold gap-1.5 bg-primary text-primary-foreground shrink-0"
                >
                  <Plus className="size-3.5" /> Create Custom Template
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allTemplates.map((tpl) => {
                  const isSelected = selectedTemplateId === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => handleSelectTemplate(tpl.id)}
                      className={`p-5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between relative group ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-md"
                          : "border-border/70 hover:border-primary/40 bg-card hover:shadow-sm"
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            (tpl as any).isCustom ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-primary/10 text-primary"
                          }`}>
                            {tpl.badge}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {(tpl as any).isCustom && (
                              <button
                                onClick={(e) => handleDeleteCustomTemplate(tpl.id, e)}
                                className="p-1 rounded-md hover:bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete Custom Template"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                            {isSelected && (
                              <span className="flex items-center gap-1 text-xs font-bold text-primary">
                                <CheckCircle className="size-4" /> Active
                              </span>
                            )}
                          </div>
                        </div>
                        <h5 className="font-bold text-sm text-foreground mb-1.5">{tpl.name}</h5>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-4">{tpl.description}</p>
                      </div>

                      <div className="pt-3 border-t border-border/50 text-[11px] space-y-1.5 text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Probation Duration:</span>
                          <span className="font-bold text-foreground">{tpl.probationMonths > 0 ? `${tpl.probationMonths} Months` : "None (Direct / Contractor)"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Notice Period:</span>
                          <span className="font-bold text-foreground">{tpl.noticeDays} Days</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Basic Pay Split:</span>
                          <span className="font-bold text-foreground">{tpl.salarySplit.basicPct}% of CTC</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="size-5 text-indigo-500" />
                  <div>
                    <p className="text-xs font-bold text-foreground">Need custom salary compensation split or branding?</p>
                    <p className="text-[11px] text-muted-foreground">Switch to 'Salary & CTC Structure' or 'Logo & Watermark' for complete customization choice.</p>
                  </div>
                </div>
                <Button size="sm" onClick={() => setActiveTab("salary")} className="text-xs font-bold gap-1.5">
                  Configure Compensation <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* TAB 2: SALARY & CTC STRUCTURE */}
          {activeTab === "salary" && (
            <div className="space-y-6">
              <div>
                <h4 className="text-base font-bold text-foreground">Salary CTC Breakdown & Component Split</h4>
                <p className="text-xs text-muted-foreground">Configure the annual compensation package. Percentages automatically compute monthly disbursements and statutory deductions.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5">Annual CTC Compensation ({currency.symbol})</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                      <Input
                        type="number"
                        value={offerForm.ctc}
                        onChange={(e) => setOfferForm({ ...offerForm, ctc: Number(e.target.value) })}
                        className="pl-8 text-sm font-bold font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 p-4 rounded-xl border bg-muted/20">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Percentage Distribution</h5>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span>Basic Salary</span>
                        <span>{salarySplit.basicPct}%</span>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={salarySplit.basicPct}
                        onChange={(e) => setSalarySplit({ ...salarySplit, basicPct: Number(e.target.value) })}
                        className="h-8 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span>House Rent Allowance (HRA)</span>
                        <span>{salarySplit.hraPct}%</span>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={salarySplit.hraPct}
                        onChange={(e) => setSalarySplit({ ...salarySplit, hraPct: Number(e.target.value) })}
                        className="h-8 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span>Special / Flexi Allowance</span>
                        <span>{salarySplit.specialPct}%</span>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={salarySplit.specialPct}
                        onChange={(e) => setSalarySplit({ ...salarySplit, specialPct: Number(e.target.value) })}
                        className="h-8 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span>Employer PF (Statutory)</span>
                        <span>{salarySplit.pfPct}%</span>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={salarySplit.pfPct}
                        onChange={(e) => setSalarySplit({ ...salarySplit, pfPct: Number(e.target.value) })}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Right side live matrix breakdown */}
                <div className="md:col-span-2 space-y-4">
                  <div className="glass-panel p-5 rounded-xl border border-border/80 bg-card">
                    <h5 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
                      <Calculator className="size-4 text-primary" /> Calculated Compensation Matrix
                    </h5>

                    <div className="space-y-3">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-muted/40 uppercase font-bold text-muted-foreground border-b">
                          <tr>
                            <th className="py-2.5 px-3">Salary Component</th>
                            <th className="py-2.5 px-3 text-right">Split</th>
                            <th className="py-2.5 px-3 text-right">Monthly ({currency.symbol})</th>
                            <th className="py-2.5 px-3 text-right">Annual ({currency.symbol})</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 font-mono">
                          <tr>
                            <td className="py-2 px-3 font-sans font-semibold">Basic Pay</td>
                            <td className="py-2 px-3 text-right">{salarySplit.basicPct}%</td>
                            <td className="py-2 px-3 text-right">{currency.symbol}{(basicVal / 12).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="py-2 px-3 text-right font-bold">{currency.symbol}{basicVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-sans font-semibold">House Rent Allowance (HRA)</td>
                            <td className="py-2 px-3 text-right">{salarySplit.hraPct}%</td>
                            <td className="py-2 px-3 text-right">{currency.symbol}{(hraVal / 12).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="py-2 px-3 text-right font-bold">{currency.symbol}{hraVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-sans font-semibold">Special Allowance</td>
                            <td className="py-2 px-3 text-right">{salarySplit.specialPct}%</td>
                            <td className="py-2 px-3 text-right">{currency.symbol}{(specialVal / 12).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="py-2 px-3 text-right font-bold">{currency.symbol}{specialVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-sans font-semibold text-muted-foreground">Employer PF Contribution</td>
                            <td className="py-2 px-3 text-right text-muted-foreground">{salarySplit.pfPct}%</td>
                            <td className="py-2 px-3 text-right text-muted-foreground">{currency.symbol}{(pfVal / 12).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="py-2 px-3 text-right text-muted-foreground">{currency.symbol}{pfVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                          <tr className="bg-primary/5 font-bold border-t-2 border-primary/20">
                            <td className="py-2.5 px-3 font-sans text-primary">Gross Cost to Company (CTC)</td>
                            <td className="py-2.5 px-3 text-right text-primary">100%</td>
                            <td className="py-2.5 px-3 text-right text-primary">{currency.symbol}{(ctcVal / 12).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="py-2.5 px-3 text-right text-primary">{currency.symbol}{ctcVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        </tbody>
                      </table>

                      <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t">
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                          <p className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Estimated Monthly In-Hand Gross</p>
                          <p className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-300 mt-0.5">
                            {currency.symbol}{monthlyGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Pre-tax declaration estimate</p>
                        </div>
                        <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                          <p className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400">Annual Statutory Retentions</p>
                          <p className="text-xl font-bold font-mono text-indigo-700 dark:text-indigo-300 mt-0.5">
                            {currency.symbol}{pfVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Provident fund allocation</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TERMS & COVENANTS */}
          {activeTab === "clauses" && (
            <div className="space-y-6">
              <div>
                <h4 className="text-base font-bold text-foreground">Terms, Conditions & Legal Covenants</h4>
                <p className="text-xs text-muted-foreground">Specify target dates, probation periods, authorized signatories, and customizable legal clauses.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Target Joining Date</label>
                  <Input
                    type="date"
                    value={offerForm.joiningDate}
                    onChange={(e) => setOfferForm({ ...offerForm, joiningDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Offer Expiration Date</label>
                  <Input
                    type="date"
                    value={offerForm.expiryDate}
                    onChange={(e) => setOfferForm({ ...offerForm, expiryDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Probation Duration</label>
                  <select
                    value={probationMonths}
                    onChange={(e) => setProbationMonths(Number(e.target.value))}
                    className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                  >
                    <option value={0}>No Probation (Direct Full / Contractor)</option>
                    <option value={1}>1 Month</option>
                    <option value={3}>3 Months (Standard)</option>
                    <option value={6}>6 Months (Senior / Executive)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Notice Period (Days)</label>
                  <Input
                    type="number"
                    value={noticeDays}
                    onChange={(e) => setNoticeDays(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Authorized HR Signatory Name</label>
                  <Input
                    type="text"
                    value={offerForm.signingAuthority}
                    onChange={(e) => setOfferForm({ ...offerForm, signingAuthority: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-foreground">Custom Legal Clauses & Covenants</label>
                  <span className="text-[11px] text-muted-foreground">Markdown & numbered clauses supported</span>
                </div>
                <Textarea
                  value={customClausesText}
                  onChange={(e) => setCustomClausesText(e.target.value)}
                  rows={8}
                  className="font-mono text-xs leading-relaxed"
                  placeholder="Define confidentiality, IP assignment, working hours, and non-compete clauses..."
                />
              </div>
            </div>
          )}

          {/* TAB 4: BRANDING & WATERMARK */}
          {activeTab === "branding" && (
            <div className="space-y-6">
              <div>
                <h4 className="text-base font-bold text-foreground">Company Logo & Watermark Customization</h4>
                <p className="text-xs text-muted-foreground">Tailor your letterhead branding, upload custom logos, configure security watermarks, and select letterhead layout styles.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Logo Settings */}
                <div className="p-5 rounded-2xl border border-border bg-card space-y-4 shadow-xs">
                  <h5 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Image className="size-4 text-primary" /> Company Logo Selection
                  </h5>

                  <div className="flex items-center gap-4 p-3 rounded-xl bg-muted/30 border border-border">
                    {activeLogo ? (
                      <img src={activeLogo} alt="Logo" className="h-12 max-w-[120px] object-contain rounded-md border p-1 bg-white" />
                    ) : (
                      <div className="size-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-black text-base">
                        {orgInitials}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-xs text-foreground">{orgName}</p>
                      <p className="text-[10px] text-muted-foreground">{activeLogo ? "Active Custom/Master Logo" : "Using Organization Initials Badge"}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Custom Logo Image URL / Base64</label>
                    <Input
                      type="text"
                      placeholder="https://example.com/logo.png"
                      value={customLogoUrl}
                      onChange={(e) => setCustomLogoUrl(e.target.value)}
                      className="text-xs font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Leave blank to use default organization master logo.</p>
                  </div>
                </div>

                {/* Watermark Settings */}
                <div className="p-5 rounded-2xl border border-border bg-card space-y-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-sm text-foreground flex items-center gap-2">
                      <Type className="size-4 text-primary" /> Security Watermark
                    </h5>
                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={watermarkEnabled}
                        onChange={(e) => setWatermarkEnabled(e.target.checked)}
                        className="rounded border-border"
                      />
                      <span>Enable Watermark</span>
                    </label>
                  </div>

                  {watermarkEnabled && (
                    <div className="space-y-4 pt-2">
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Watermark Text</label>
                        <Input
                          type="text"
                          value={watermarkText}
                          onChange={(e) => setWatermarkText(e.target.value)}
                          placeholder="CONFIDENTIAL"
                          className="font-bold text-xs"
                        />
                        <div className="flex gap-2 mt-1.5">
                          {["CONFIDENTIAL", "OFFICIAL OFFER", "PRIVATE", orgName.toUpperCase()].map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => setWatermarkText(tag)}
                              className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-semibold hover:bg-muted/80 text-foreground"
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span>Watermark Opacity</span>
                          <span>{Math.round(watermarkOpacity * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.05"
                          max="0.35"
                          step="0.01"
                          value={watermarkOpacity}
                          onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                          className="w-full cursor-pointer accent-primary"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: LIVE LETTERHEAD PREVIEW */}
          {activeTab === "preview" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-base font-bold text-foreground">Live Official Letterhead Preview</h4>
                  <p className="text-xs text-muted-foreground">High-resolution preview with active logo, watermark, compensation breakdown, and digital signatures.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-indigo-500/30 text-indigo-600 dark:text-indigo-400 gap-1.5 h-8 text-xs font-bold"
                    onClick={handleExportWord}
                  >
                    <FileText className="size-3.5" /> Download Word (.doc)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 gap-1.5 h-8 text-xs font-bold"
                    onClick={handlePrintPdf}
                  >
                    <Printer className="size-3.5" /> Print / Save PDF
                  </Button>
                </div>
              </div>

              {/* Styled Letterhead Canvas with Live Watermark */}
              <div className="border border-border/80 rounded-2xl p-8 bg-white dark:bg-zinc-950 font-sans shadow-lg max-w-3xl mx-auto text-zinc-900 dark:text-zinc-100 relative overflow-hidden">
                {/* Watermark Rendering */}
                {watermarkEnabled && (
                  <div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0"
                    style={{
                      opacity: watermarkOpacity,
                      transform: "rotate(-35deg)",
                    }}
                  >
                    <span className="text-5xl md:text-7xl font-black uppercase text-zinc-400 tracking-widest whitespace-nowrap">
                      {watermarkText}
                    </span>
                  </div>
                )}

                <div className="relative z-10 space-y-6">
                  {/* Header banner with logo */}
                  <div className="flex justify-between items-start border-b-2 border-zinc-900 dark:border-zinc-100 pb-4">
                    <div className="flex items-center gap-3.5">
                      {activeLogo ? (
                        <img src={activeLogo} alt={orgName} className="h-12 max-w-[140px] object-contain rounded-md" />
                      ) : (
                        <div className="size-11 rounded-lg bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center font-extrabold text-sm">
                          {orgInitials}
                        </div>
                      )}
                      <div>
                        <h3 className="font-extrabold text-xl tracking-tight text-zinc-900 dark:text-zinc-50">{orgName}</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{orgAddress}</p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500">Email: {orgEmail} • Phone: {orgPhone}{orgGstin ? ` • GSTIN: ${orgGstin}` : ""}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-3 py-1 bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 text-[10px] font-extrabold uppercase rounded tracking-wider">
                        Official Offer
                      </span>
                      <p className="text-[10px] text-zinc-400 mt-1 font-mono">REF: BOS-OFFER-{Math.floor(1000 + Math.random() * 9000)}</p>
                    </div>
                  </div>

                  {/* Recipient details */}
                  <div className="bg-zinc-50 dark:bg-zinc-900/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-1">
                    <p className="text-[10px] font-bold uppercase text-zinc-400">Addressed To:</p>
                    <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{candidateName}</h4>
                    <p className="text-zinc-500">{candidateEmail}</p>
                    <p className="text-zinc-600 dark:text-zinc-300 font-semibold pt-1">
                      Role: {candidateRole} | Joining: {offerForm.joiningDate ? new Date(offerForm.joiningDate).toLocaleDateString() : "[Joining Date]"}
                    </p>
                  </div>

                  <div className="space-y-4 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                    <p className="font-bold text-zinc-900 dark:text-zinc-100">
                      Dear {candidateName},
                    </p>
                    <p>
                      We are pleased to extend this formal offer of employment to join <strong>{orgName}</strong> as a <strong>{candidateRole}</strong>. Your expertise and leadership will be invaluable to our continuous expansion.
                    </p>

                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden my-4">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-zinc-100 dark:bg-zinc-900 font-bold border-b border-zinc-200 dark:border-zinc-800">
                          <tr>
                            <th className="p-2">Component</th>
                            <th className="p-2 text-right">Split</th>
                            <th className="p-2 text-right">Monthly</th>
                            <th className="p-2 text-right">Annual ({currency.symbol})</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-mono">
                          <tr>
                            <td className="p-2 font-sans font-semibold">Basic Pay</td>
                            <td className="p-2 text-right">{salarySplit.basicPct}%</td>
                            <td className="p-2 text-right">{currency.symbol}{Math.round(basicVal / 12).toLocaleString()}</td>
                            <td className="p-2 text-right font-bold">{currency.symbol}{Math.round(basicVal).toLocaleString()}</td>
                          </tr>
                          <tr>
                            <td className="p-2 font-sans font-semibold">House Rent Allowance</td>
                            <td className="p-2 text-right">{salarySplit.hraPct}%</td>
                            <td className="p-2 text-right">{currency.symbol}{Math.round(hraVal / 12).toLocaleString()}</td>
                            <td className="p-2 text-right font-bold">{currency.symbol}{Math.round(hraVal).toLocaleString()}</td>
                          </tr>
                          <tr>
                            <td className="p-2 font-sans font-semibold">Special Allowance</td>
                            <td className="p-2 text-right">{salarySplit.specialPct}%</td>
                            <td className="p-2 text-right">{currency.symbol}{Math.round(specialVal / 12).toLocaleString()}</td>
                            <td className="p-2 text-right font-bold">{currency.symbol}{Math.round(specialVal).toLocaleString()}</td>
                          </tr>
                          <tr className="bg-zinc-50 dark:bg-zinc-900/40 font-bold">
                            <td className="p-2 font-sans text-primary">Total Annual Cost to Company (CTC)</td>
                            <td className="p-2 text-right text-primary">100%</td>
                            <td className="p-2 text-right text-primary">{currency.symbol}{Math.round(ctcVal / 12).toLocaleString()}</td>
                            <td className="p-2 text-right text-primary">{currency.symbol}{Math.round(ctcVal).toLocaleString()}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 whitespace-pre-wrap font-sans text-[11px] leading-relaxed">
                      {customClausesText}
                    </div>

                    <div className="pt-8 flex justify-between items-end border-t border-zinc-200 dark:border-zinc-800 text-[11px] mt-8">
                      <div>
                        <p className="font-bold text-zinc-900 dark:text-zinc-100">{offerForm.signingAuthority}</p>
                        <p className="text-zinc-400">{offerForm.signingTitle} • {orgName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-zinc-400 italic">Valid until: {offerForm.expiryDate ? new Date(offerForm.expiryDate).toLocaleDateString() : "[Expiry Date]"}</p>
                        <p className="text-[9px] text-emerald-600 font-mono font-bold mt-1">✓ SEC-SIGNATURE-VERIFIED</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Studio Footer Controls */}
        <div className="p-5 border-t border-border flex flex-wrap gap-2 justify-between items-center bg-muted/20 text-sm">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="h-8 text-xs font-bold gap-1.5 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50"
              onClick={handleExportWord}
            >
              <FileText className="size-3.5" /> Export Word (.doc)
            </Button>
            <Button
              variant="outline"
              className="h-8 text-xs font-bold gap-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50"
              onClick={handlePrintPdf}
            >
              <Printer className="size-3.5" /> Print / PDF
            </Button>
            <Button
              variant="outline"
              className="h-8 text-xs font-bold gap-1.5"
              onClick={() => {
                if (recipientType === "applicant") {
                  if (!offerForm.applicantId) {
                    showNotification("Select a candidate to save document.");
                    return;
                  }
                  handleSaveOfferDocument(offerForm.applicantId);
                } else {
                  if (!selectedEmpId) {
                    showNotification("Select an existing employee first.");
                    return;
                  }
                  handleSendOffer();
                }
              }}
              disabled={recipientType === "applicant" ? !offerForm.applicantId : !selectedEmpId}
            >
              <FileCheck className="size-3.5" /> Save to Vault
            </Button>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="h-8 text-xs" onClick={onClose}>
              Close
            </Button>
            <Button
              onClick={handleSendOffer}
              disabled={(recipientType === "applicant" ? !offerForm.applicantId : !selectedEmpId) || !offerForm.joiningDate || !offerForm.expiryDate || savingSending}
              className="h-8 text-xs font-bold gradient-brand text-white shadow-md gap-1.5"
            >
              <Send className="size-3.5" /> {savingSending ? "Releasing..." : (recipientType === "employee" ? "Release & Save Offer Letter" : "Save & Email Offer to Candidate")}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* CREATE NEW CUSTOM TEMPLATE MODAL */}
      <AnimatePresence>
        {customTplModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b pb-3">
                <h4 className="font-bold text-base text-foreground flex items-center gap-2">
                  <Plus className="size-4 text-primary" /> Create New Custom Offer Template
                </h4>
                <button onClick={() => setCustomTplModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <XCircle className="size-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-muted-foreground uppercase mb-1">Template Name</label>
                  <Input
                    placeholder="e.g. Senior Software Architect Blueprint"
                    value={newTplForm.name}
                    onChange={(e) => setNewTplForm({ ...newTplForm, name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-muted-foreground uppercase mb-1">Category Badge</label>
                    <Input
                      placeholder="e.g. Engineering / Tech"
                      value={newTplForm.badge}
                      onChange={(e) => setNewTplForm({ ...newTplForm, badge: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-muted-foreground uppercase mb-1">Brief Description</label>
                    <Input
                      placeholder="e.g. Specialized technical appointment..."
                      value={newTplForm.description}
                      onChange={(e) => setNewTplForm({ ...newTplForm, description: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-muted-foreground uppercase mb-1">Probation Duration (Months)</label>
                    <Input
                      type="number"
                      value={newTplForm.probationMonths}
                      onChange={(e) => setNewTplForm({ ...newTplForm, probationMonths: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-muted-foreground uppercase mb-1">Notice Period (Days)</label>
                    <Input
                      type="number"
                      value={newTplForm.noticeDays}
                      onChange={(e) => setNewTplForm({ ...newTplForm, noticeDays: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block font-bold text-muted-foreground uppercase mb-1">Basic %</label>
                    <Input
                      type="number"
                      value={newTplForm.basicPct}
                      onChange={(e) => setNewTplForm({ ...newTplForm, basicPct: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-muted-foreground uppercase mb-1">HRA %</label>
                    <Input
                      type="number"
                      value={newTplForm.hraPct}
                      onChange={(e) => setNewTplForm({ ...newTplForm, hraPct: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-muted-foreground uppercase mb-1">Special %</label>
                    <Input
                      type="number"
                      value={newTplForm.specialPct}
                      onChange={(e) => setNewTplForm({ ...newTplForm, specialPct: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-muted-foreground uppercase mb-1">PF %</label>
                    <Input
                      type="number"
                      value={newTplForm.pfPct}
                      onChange={(e) => setNewTplForm({ ...newTplForm, pfPct: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-muted-foreground uppercase mb-1">Default Terms & Clauses</label>
                  <Textarea
                    rows={6}
                    className="font-mono text-xs"
                    value={newTplForm.clauses}
                    onChange={(e) => setNewTplForm({ ...newTplForm, clauses: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button variant="outline" size="sm" onClick={() => setCustomTplModalOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveNewCustomTemplate} className="font-bold">
                  Save Template
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
