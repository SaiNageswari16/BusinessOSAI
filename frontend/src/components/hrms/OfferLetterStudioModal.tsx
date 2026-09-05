import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, XCircle, Layers, DollarSign, ShieldCheck, Eye, Palette,
  Printer, Download, FileText, FileCheck, Send, CheckCircle, ArrowRight,
  Plus, Trash2, Edit3, Image, Type, Sliders, Building2, Check,
  Calculator, User, Briefcase, Calendar, AlertCircle, AlignLeft, AlignJustify,
  Minus, Maximize2, HelpCircle, Copy, Bookmark, LayoutTemplate, Shield,
  Upload, FileUp, Save, RefreshCw
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Applicant, Offer, employeesApi, companiesApi, designationsApi, departmentsApi, resolveImageUrl, Company, recruitmentApi } from "../../lib/api-client";
import { useCurrency } from "@/hooks/use-currency";
import { useTenant } from "@/contexts/tenant-context";
import { getActiveBillingGst } from "@/lib/receipt-template-store";
import { downloadOfferLetterWordDoc } from "@/lib/offer-letter-doc-utils";
import { parseUploadedOfferDoc, ParsedOfferDoc } from "@/lib/offer-letter-doc-parser";
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
  fontFamily?: string;
  fontSize?: number;
  headingSize?: number;
  lineHeight?: number;
  textAlign?: "left" | "justify";
  marginSize?: "compact" | "normal" | "spacious";
  primaryColor?: string;
  accentColor?: string;
  letterheadStyle?: "corporate" | "modern" | "minimal" | "bordered" | "banner";
  subjectText?: string;
  openingText?: string;
  closingText?: string;
  footerText?: string;
  headerOrgName?: string;
  headerAddress?: string;
  headerEmail?: string;
  headerPhone?: string;
  headerGstin?: string;
  headerCin?: string;
  headerBadgeText?: string;
  logoPosition?: "left" | "center" | "right" | "hidden";
  logoSize?: "small" | "medium" | "large";
}

interface OfferLetterStudioModalProps {
  open: boolean;
  onClose: () => void;
  applicants: Applicant[];
  selectedApplicantId?: string;
  employees?: any[];
  selectedEmployeeId?: string;
  initialTemplateId?: string;
  editingOffer?: Offer | null;
  onOfferSent: () => void;
  showNotification: (msg: string, type?: "success" | "error" | "info") => void;
  handleSaveOfferDocument: (applicantId: string) => void;
  handleSendOfferApi: (offerPayload: any) => Promise<void>;
  handleUpdateOfferApi?: (offerId: string, offerPayload: any) => Promise<void>;
}

// Available standard font families like in Word
export const WORD_FONT_FAMILIES = [
  { id: "calibri", name: "Calibri (Classic Word)", css: "Calibri, 'Segoe UI', Arial, sans-serif" },
  { id: "arial", name: "Arial (Standard Clean)", css: "'Arial', 'Helvetica Neue', sans-serif" },
  { id: "times", name: "Times New Roman (Formal Legal)", css: "'Times New Roman', Times, serif" },
  { id: "georgia", name: "Georgia (Editorial Serif)", css: "'Georgia', serif" },
  { id: "garamond", name: "Garamond (Executive Literary)", css: "'Garamond', 'Georgia', serif" },
  { id: "inter", name: "Inter (Modern Tech UI)", css: "'Inter', -apple-system, sans-serif" },
  { id: "roboto", name: "Roboto (Neutral Clean)", css: "'Roboto', 'Helvetica Neue', sans-serif" },
  { id: "playfair", name: "Playfair Display (Luxury Serif)", css: "'Playfair Display', 'Georgia', serif" },
  { id: "outfit", name: "Outfit (Geometric Contemporary)", css: "'Outfit', sans-serif" },
  { id: "segoe", name: "Segoe UI (Windows Corporate)", css: "'Segoe UI', Tahoma, sans-serif" }
];

export function OfferLetterStudioModal({
  open,
  onClose,
  applicants,
  selectedApplicantId = "",
  employees = [],
  selectedEmployeeId = "",
  initialTemplateId = "fulltime",
  editingOffer = null,
  onOfferSent,
  showNotification,
  handleSaveOfferDocument,
  handleSendOfferApi,
  handleUpdateOfferApi
}: OfferLetterStudioModalProps) {
  const { currency } = useCurrency();
  const { tenant } = useTenant();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  // Available Core ERP Companies / Organizations
  const [companyList, setCompanyList] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");

  // Organization Branding Defaults from Active Billing / Tenant
  const activeGst = getActiveBillingGst();
  const defaultOrgName = activeGst?.trade_name || activeGst?.legal_name || tenant?.name || "BusinessOS Global Technologies";
  const defaultOrgAddress = activeGst?.address || (tenant as any)?.address || "Cyber City, DLF Phase 2, Gurugram, Haryana - 122002, India";
  const defaultOrgGstin = activeGst?.gstin || (tenant as any)?.settings?.gstin || (tenant as any)?.tax_id || "";
  const defaultOrgCin = activeGst?.cin || (tenant as any)?.settings?.cin || "U72200DL2024PTC123456";
  const defaultOrgEmail = activeGst?.email || (tenant as any)?.email || (tenant as any)?.settings?.email || "hr@businessos.ai";
  const defaultOrgPhone = activeGst?.phone || (tenant as any)?.phone || (tenant as any)?.settings?.phone || "+91 (800) 555-0199";
  const defaultLogo = resolveImageUrl(activeGst?.logo_url || tenant?.logo_url || (tenant as any)?.raw?.logo_url || "");
  const defaultOrgInitials = tenant?.logo || (tenant as any)?.raw?.logo_initials || defaultOrgName.slice(0, 2).toUpperCase();

  // Custom Templates from LocalStorage
  const [customTemplates, setCustomTemplates] = useState<CustomOfferTemplate[]>(() => {
    try {
      const saved = localStorage.getItem("hrms_custom_offer_templates");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Listen for storage changes across tabs
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const saved = localStorage.getItem("hrms_custom_offer_templates");
        if (saved) setCustomTemplates(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    };
    window.addEventListener("offer_templates_updated", handleStorageChange);
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("offer_templates_updated", handleStorageChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  // Active Studio Tab
  const [activeTab, setActiveTab] = useState<"templates" | "content" | "headerfooter" | "design" | "watermark" | "preview">("templates");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(initialTemplateId || "fulltime");
  const [justSavedTemplateId, setJustSavedTemplateId] = useState<string | null>(null);

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

  // Header & Letterhead Configuration
  const [headerOrgName, setHeaderOrgName] = useState<string>(defaultOrgName);
  const [headerAddress, setHeaderAddress] = useState<string>(defaultOrgAddress);
  const [headerEmail, setHeaderEmail] = useState<string>(defaultOrgEmail);
  const [headerPhone, setHeaderPhone] = useState<string>(defaultOrgPhone);
  const [headerGstin, setHeaderGstin] = useState<string>(defaultOrgGstin);
  const [headerCin, setHeaderCin] = useState<string>(defaultOrgCin);
  const [headerBadgeText, setHeaderBadgeText] = useState<string>("OFFICIAL OFFER");
  const [logoPosition, setLogoPosition] = useState<"left" | "center" | "right" | "hidden">("left");
  const [logoSize, setLogoSize] = useState<"small" | "medium" | "large">("medium");

  // Footer & Sign-off Configuration
  const [footerText, setFooterText] = useState<string>(`${defaultOrgName} • Private & Confidential Employment Contract`);
  const [footerVerificationEnabled, setFooterVerificationEnabled] = useState<boolean>(true);

  // Word-like Design & Typography Controls
  const [fontFamily, setFontFamily] = useState<string>("Calibri, 'Segoe UI', Arial, sans-serif");
  const [fontSize, setFontSize] = useState<number>(10.5); // Base font size (pt)
  const [headingSize, setHeadingSize] = useState<number>(17); // Heading size (pt)
  const [lineHeight, setLineHeight] = useState<number>(1.45); // Line spacing (1.15, 1.35, 1.45, 1.75)
  const [textAlign, setTextAlign] = useState<"left" | "justify">("left");
  const [marginSize, setMarginSize] = useState<"compact" | "normal" | "spacious">("normal");
  const [primaryColor, setPrimaryColor] = useState<string>("#0f172a");
  const [accentColor, setAccentColor] = useState<string>("#4f46e5");
  const [letterheadStyle, setLetterheadStyle] = useState<"corporate" | "modern" | "minimal" | "bordered" | "banner">("corporate");

  // Direct Editable Body Text
  const [subjectText, setSubjectText] = useState<string>("");
  const [openingText, setOpeningText] = useState<string>("");
  const [closingText, setClosingText] = useState<string>("");

  // Branding & Watermark Settings
  const [customLogoUrl, setCustomLogoUrl] = useState<string>("");
  const [watermarkEnabled, setWatermarkEnabled] = useState<boolean>(true);
  const [watermarkText, setWatermarkText] = useState<string>("CONFIDENTIAL");
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.12);

  // Dedicated Save Template Dialog State
  const [saveModalOpen, setSaveModalOpen] = useState<boolean>(false);
  const [saveModalMode, setSaveModalMode] = useState<"new" | "update">("new");
  const [saveModalName, setSaveModalName] = useState<string>("");
  const [saveModalBadge, setSaveModalBadge] = useState<string>("Custom");
  const [saveModalDescription, setSaveModalDescription] = useState<string>("");
  const [saveModalTargetId, setSaveModalTargetId] = useState<string>("");

  // Word Doc Upload / Import States
  const [isUploadingDoc, setIsUploadingDoc] = useState<boolean>(false);
  const [importedDocBanner, setImportedDocBanner] = useState<{ fileName: string; summary: string } | null>(null);

  // Custom Template Manual Creator State
  const [customTplModalOpen, setCustomTplModalOpen] = useState(false);
  const [editingTplId, setEditingTplId] = useState<string | null>(null);
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
    clauses: "1. PROBATION & CONFIRMATION: You will be on probation for a period of 3 months from joining.\n2. NOTICE PERIOD: Either party may terminate with 30 days written notice.\n3. CONFIDENTIALITY: Maintain strict confidentiality of proprietary company assets and code.\n4. STATUTORY COMPLIANCE: Standard deductions apply as per government regulations.",
    fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif",
    fontSize: 10.5,
    headingSize: 17,
    letterheadStyle: "corporate" as const,
    accentColor: "#4f46e5"
  });

  const [savingSending, setSavingSending] = useState(false);

  // Recipient Mode: Applicant vs Existing Employee vs Direct Custom Candidate
  const [recipientType, setRecipientType] = useState<"applicant" | "employee" | "custom">(() => {
    if (selectedEmployeeId) return "employee";
    if (selectedApplicantId) return "applicant";
    return applicants && applicants.length > 0 ? "applicant" : "custom";
  });
  const [selectedEmpId, setSelectedEmpId] = useState<string>(selectedEmployeeId || "");
  const [employeeList, setEmployeeList] = useState<any[]>(employees || []);

  // Explicit Candidate Details State (allows user override/customization across all modes)
  const [candidateNameInput, setCandidateNameInput] = useState<string>("");
  const [candidateEmailInput, setCandidateEmailInput] = useState<string>("");
  const [candidateRoleInput, setCandidateRoleInput] = useState<string>("");
  const [candidateDepartmentInput, setCandidateDepartmentInput] = useState<string>("");

  // Designations catalog collected dynamically from Core ERP / HRMS Master Designations API, jobs, and employees
  const [designationsList, setDesignationsList] = useState<string[]>([
    "Lead Software Engineer",
    "Senior Full Stack Developer",
    "Frontend Engineer",
    "Backend Architect",
    "DevOps & Cloud Engineer",
    "Product Manager",
    "UI/UX Designer",
    "Data Scientist",
    "Sales Director",
    "Marketing Manager",
    "HR Generalist",
    "Talent Acquisition Specialist",
    "Operations Manager",
    "Business Development Executive",
    "Financial Analyst"
  ]);

  // Departments catalog collected dynamically from Core ERP / HRMS Master Departments API
  const [departmentsList, setDepartmentsList] = useState<string[]>([
    "Engineering",
    "Product & Design",
    "Sales & Marketing",
    "Human Resources",
    "Finance & Accounts",
    "Operations",
    "Customer Success",
    "Administration",
    "Information Technology"
  ]);

  // Hydrate state when editing an existing offer letter
  useEffect(() => {
    if (open && editingOffer) {
      setCandidateNameInput(editingOffer.candidate || "");
      setCandidateEmailInput(editingOffer.candidate_email || "");
      setCandidateRoleInput(editingOffer.role || "");
      if ((editingOffer as any).department) {
        setCandidateDepartmentInput((editingOffer as any).department);
      }
      
      const signerClean = editingOffer.signer_name || "Priya Sharma";
      const signerAuth = signerClean.includes("(") ? signerClean.split("(")[0].trim() : signerClean;
      const signerTitle = signerClean.includes("(") ? signerClean.split("(")[1].replace(")", "").trim() : "Head of Talent & People Operations";

      setOfferForm({
        applicantId: editingOffer.applicant_id || "",
        ctc: Number(editingOffer.ctc) || 95000,
        signingAuthority: signerAuth,
        signingTitle: signerTitle,
        joiningDate: editingOffer.joining_date ? String(editingOffer.joining_date) : new Date().toISOString().split("T")[0],
        expiryDate: editingOffer.expiry_date ? String(editingOffer.expiry_date) : new Date().toISOString().split("T")[0],
      });

      if (editingOffer.employee_id) {
        setRecipientType("employee");
        setSelectedEmpId(editingOffer.employee_id);
      } else if (editingOffer.applicant_id) {
        setRecipientType("applicant");
      } else {
        setRecipientType("custom");
      }

      if (editingOffer.custom_template) {
        try {
          const parsed = typeof editingOffer.custom_template === "string" 
            ? JSON.parse(editingOffer.custom_template)
            : editingOffer.custom_template;
          
          if (parsed.basic_pct !== undefined) {
            setSalarySplit({
              basicPct: Number(parsed.basic_pct) || 50,
              hraPct: Number(parsed.hra_pct) || 20,
              specialPct: Number(parsed.special_pct) || 20,
              pfPct: Number(parsed.pf_pct) || 10,
              bonusAmount: 0
            });
          }
          if (parsed.probation_months !== undefined) setProbationMonths(Number(parsed.probation_months) || 0);
          if (parsed.notice_days !== undefined) setNoticeDays(Number(parsed.notice_days) || 30);
          if (parsed.clauses) setCustomClausesText(parsed.clauses);
          if (parsed.subject) setSubjectText(parsed.subject);
          if (parsed.opening_text) setOpeningText(parsed.opening_text);
          if (parsed.closing_text) setClosingText(parsed.closing_text);
          if (parsed.footer_text) setFooterText(parsed.footer_text);
          if (parsed.org_name) setHeaderOrgName(parsed.org_name);
          if (parsed.org_address) setHeaderAddress(parsed.org_address);
          if (parsed.org_email) setHeaderEmail(parsed.org_email);
          if (parsed.org_phone) setHeaderPhone(parsed.org_phone);
          if (parsed.org_gstin) setHeaderGstin(parsed.org_gstin);
          if (parsed.org_cin) setHeaderCin(parsed.org_cin);
          if (parsed.font_family) setFontFamily(parsed.font_family);
          if (parsed.font_size) setFontSize(Number(parsed.font_size));
          if (parsed.heading_size) setHeadingSize(Number(parsed.heading_size));
          if (parsed.line_height) setLineHeight(Number(parsed.line_height));
          if (parsed.text_align) setTextAlign(parsed.text_align);
          if (parsed.margin_size) setMarginSize(parsed.margin_size);
          if (parsed.primary_color) setPrimaryColor(parsed.primary_color);
          if (parsed.accent_color) setAccentColor(parsed.accent_color);
          if (parsed.letterhead_style) setLetterheadStyle(parsed.letterhead_style);
          if (parsed.logo_position) setLogoPosition(parsed.logo_position);
          if (parsed.logo_size) setLogoSize(parsed.logo_size);
          if (parsed.watermark_text) {
            setWatermarkEnabled(true);
            setWatermarkText(parsed.watermark_text);
          }
        } catch {
          if (typeof editingOffer.custom_template === "string") {
            setCustomClausesText(editingOffer.custom_template);
          }
        }
      }
    }
  }, [open, editingOffer]);

  useEffect(() => {
    if (selectedEmployeeId) {
      setRecipientType("employee");
      setSelectedEmpId(selectedEmployeeId);
      const emp = employeeList.find(e => e.id === selectedEmployeeId);
      if (emp) {
        setCandidateNameInput(emp.full_name || emp.name || "");
        setCandidateEmailInput(emp.email || "");
        setCandidateRoleInput(emp.designation?.name || emp.designation_name || emp.position || emp.role || "Staff");
        setCandidateDepartmentInput(emp.department?.name || emp.department_name || (emp as any).department || "");
      }
    }
  }, [selectedEmployeeId, employeeList]);

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

  // Load available designations and departments from Master ERP/HRMS APIs
  useEffect(() => {
    if (open) {
      Promise.all([
        designationsApi.list(1, 100).catch(() => ({ items: [] })),
        departmentsApi.list(1, 100).catch(() => ({ items: [] })),
        recruitmentApi.listJobs().catch(() => ({ items: [] })),
      ]).then(([desigRes, deptRes, jobsRes]: any) => {
        const serverDesigs = (desigRes?.items || []).map((d: any) => d.name).filter(Boolean);
        const serverDepts = (deptRes?.items || []).map((d: any) => d.name).filter(Boolean);
        const jobTitles = (jobsRes?.items || []).map((j: any) => j.title).filter(Boolean);
        const empRoles = (employeeList || []).map((e: any) => e.designation?.name || e.designation_name || e.position || e.role).filter(Boolean);
        const empDepts = (employeeList || []).map((e: any) => e.department?.name || e.department_name || e.department).filter(Boolean);
        const appRoles = (applicants || []).map((a: any) => a.job_title).filter(Boolean);
        const appDepts = (applicants || []).map((a: any) => (a as any).department).filter(Boolean);

        setDesignationsList(prev => {
          const merged = Array.from(new Set([...serverDesigs, ...jobTitles, ...empRoles, ...appRoles, ...prev]));
          return merged.filter(Boolean).sort((a, b) => a.localeCompare(b));
        });

        setDepartmentsList(prev => {
          const defaultDepts = ["Engineering", "Product & Design", "Sales & Marketing", "Human Resources", "Finance & Accounts", "Operations", "Customer Success", "Administration", "Information Technology"];
          const merged = Array.from(new Set([...serverDepts, ...empDepts, ...appDepts, ...prev, ...defaultDepts]));
          return merged.filter(Boolean).sort((a, b) => a.localeCompare(b));
        });
      }).catch(console.error);
    }
  }, [open, employeeList, applicants]);

  // Load Core ERP Companies / Organizations
  useEffect(() => {
    if (open) {
      companiesApi.list(1, 100).then((res: any) => {
        const list = res.items || (Array.isArray(res) ? res : []);
        setCompanyList(list);
        if (list.length > 0 && !selectedCompanyId) {
          const matched = list.find((c: any) => c.id === tenant?.id || c.name === defaultOrgName || c.legal_name === defaultOrgName) || list[0];
          if (matched) {
            setSelectedCompanyId(matched.id);
            if (!editingOffer && !customLogoUrl && matched.logo_url) {
              setCustomLogoUrl(resolveImageUrl(matched.logo_url));
            }
          }
        }
      }).catch(console.error);
    }
  }, [open, tenant?.id]);

  const handleSelectCompany = (compId: string) => {
    setSelectedCompanyId(compId);
    const comp = companyList.find(c => c.id === compId);
    if (comp) {
      const compName = comp.legal_name || comp.name || "Organization";
      setHeaderOrgName(compName);
      if (comp.address) setHeaderAddress(comp.address);
      if (comp.email) setHeaderEmail(comp.email);
      if (comp.phone) setHeaderPhone(comp.phone);
      const primaryGst = comp.gst_registrations?.find((r: any) => r.is_primary)?.gstin || comp.gst_number || "";
      if (primaryGst) setHeaderGstin(primaryGst);
      if (comp.registration_number) setHeaderCin(comp.registration_number);
      if (comp.logo_url) {
        setCustomLogoUrl(resolveImageUrl(comp.logo_url));
      } else {
        setCustomLogoUrl("");
      }
      showNotification(`Switched to organization "${compName}" and loaded ERP profile & logo.`);
    }
  };

  const handleUploadLogoFile = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showNotification("Please upload a valid image file (PNG, JPG, SVG, WebP).", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setCustomLogoUrl(result);
        showNotification("Custom logo image loaded successfully for this offer letter!");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetToCompanyLogo = () => {
    const comp = companyList.find(c => c.id === selectedCompanyId);
    const compLogo = comp?.logo_url || activeGst?.logo_url || tenant?.logo_url || (tenant as any)?.raw?.logo_url || "";
    setCustomLogoUrl(resolveImageUrl(compLogo));
    showNotification("Restored to official Core ERP Organization Logo.");
  };

  // Sync applicant selection
  useEffect(() => {
    if (selectedApplicantId) {
      const app = applicants.find(a => a.id === selectedApplicantId);
      if (app) {
        setCandidateNameInput(app.name || "");
        setCandidateEmailInput(app.email || "");
        setCandidateRoleInput(app.job_title || "");
        if ((app as any).department) {
          setCandidateDepartmentInput((app as any).department);
        }
        setOfferForm(prev => ({
          ...prev,
          applicantId: selectedApplicantId,
          ctc: app.expected_salary ? Number(app.expected_salary) : prev.ctc
        }));
      }
    }
  }, [selectedApplicantId, applicants]);

  const handleSelectApplicant = (appId: string) => {
    const app = applicants.find(a => a.id === appId);
    setOfferForm(prev => ({
      ...prev,
      applicantId: appId,
      ctc: app?.expected_salary ? Number(app.expected_salary) : prev.ctc
    }));
    if (app) {
      setCandidateNameInput(app.name || "");
      setCandidateEmailInput(app.email || "");
      setCandidateRoleInput(app.job_title || "");
      if ((app as any).department) {
        setCandidateDepartmentInput((app as any).department);
      }
    }
  };

  const handleSelectEmployee = (empId: string) => {
    setSelectedEmpId(empId);
    const emp = employeeList.find(e => e.id === empId);
    if (emp) {
      setCandidateNameInput(emp.full_name || emp.name || "");
      setCandidateEmailInput(emp.email || "");
      setCandidateRoleInput(emp.designation?.name || emp.designation_name || emp.position || emp.role || "Staff");
      setCandidateDepartmentInput(emp.department?.name || emp.department_name || (emp as any).department || "");
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

      if ((tpl as CustomOfferTemplate).fontFamily) setFontFamily((tpl as CustomOfferTemplate).fontFamily!);
      if ((tpl as CustomOfferTemplate).fontSize) setFontSize((tpl as CustomOfferTemplate).fontSize!);
      if ((tpl as CustomOfferTemplate).headingSize) setHeadingSize((tpl as CustomOfferTemplate).headingSize!);
      if ((tpl as CustomOfferTemplate).accentColor) setAccentColor((tpl as CustomOfferTemplate).accentColor!);
      if ((tpl as CustomOfferTemplate).letterheadStyle) setLetterheadStyle((tpl as CustomOfferTemplate).letterheadStyle!);
      if ((tpl as CustomOfferTemplate).subjectText) setSubjectText((tpl as CustomOfferTemplate).subjectText!);
      if ((tpl as CustomOfferTemplate).openingText) setOpeningText((tpl as CustomOfferTemplate).openingText!);
      if ((tpl as CustomOfferTemplate).closingText) setClosingText((tpl as CustomOfferTemplate).closingText!);
      if ((tpl as CustomOfferTemplate).footerText) setFooterText((tpl as CustomOfferTemplate).footerText!);
      if ((tpl as CustomOfferTemplate).headerOrgName) setHeaderOrgName((tpl as CustomOfferTemplate).headerOrgName!);
      if ((tpl as CustomOfferTemplate).headerAddress) setHeaderAddress((tpl as CustomOfferTemplate).headerAddress!);
      if ((tpl as CustomOfferTemplate).headerBadgeText) setHeaderBadgeText((tpl as CustomOfferTemplate).headerBadgeText!);
      if ((tpl as CustomOfferTemplate).logoPosition) setLogoPosition((tpl as CustomOfferTemplate).logoPosition!);
      if ((tpl as CustomOfferTemplate).logoSize) setLogoSize((tpl as CustomOfferTemplate).logoSize!);

      showNotification(`Applied '${tpl.name}' template settings!`);
    }
  };

  // Open the dedicated interactive Save Template Dialog
  const handleOpenSaveTemplateModal = () => {
    const isCustomSelected = customTemplates.some(t => t.id === selectedTemplateId);
    setSaveModalMode(isCustomSelected ? "update" : "new");
    setSaveModalTargetId(isCustomSelected ? selectedTemplateId : "");
    setSaveModalName(candidateRoleInput ? `${candidateRoleInput} Blueprint` : "Corporate Offer Blueprint");
    setSaveModalBadge("Custom");
    setSaveModalDescription(`Created on ${new Date().toLocaleDateString()} with custom typography, header, footer, clauses, and compensation matrix.`);
    setSaveModalOpen(true);
  };

  // Commit Save Template to LocalStorage and State
  const handleConfirmSaveTemplate = () => {
    if (!saveModalName.trim()) {
      showNotification("Please enter a valid template name.", "error");
      return;
    }

    const templateId = (saveModalMode === "update" && saveModalTargetId)
      ? saveModalTargetId
      : `custom_${Date.now()}`;

    const newTpl: CustomOfferTemplate = {
      id: templateId,
      name: saveModalName.trim(),
      badge: saveModalBadge.trim() || "Custom",
      description: saveModalDescription.trim() || `Custom blueprint saved on ${new Date().toLocaleDateString()}`,
      probationMonths: Number(probationMonths) || 0,
      noticeDays: Number(noticeDays) || 30,
      salarySplit: {
        basicPct: Number(salarySplit.basicPct) || 50,
        hraPct: Number(salarySplit.hraPct) || 20,
        specialPct: Number(salarySplit.specialPct) || 20,
        pfPct: Number(salarySplit.pfPct) || 10,
      },
      defaultClauses: customClausesText,
      isCustom: true,
      fontFamily,
      fontSize,
      headingSize,
      lineHeight,
      textAlign,
      marginSize,
      primaryColor,
      accentColor,
      letterheadStyle,
      subjectText,
      openingText,
      closingText,
      footerText,
      headerOrgName,
      headerAddress,
      headerEmail,
      headerPhone,
      headerGstin,
      headerCin,
      headerBadgeText,
      logoPosition,
      logoSize
    };

    let updatedList: CustomOfferTemplate[];
    if (saveModalMode === "update" && saveModalTargetId) {
      updatedList = customTemplates.map(t => t.id === saveModalTargetId ? newTpl : t);
    } else {
      updatedList = [newTpl, ...customTemplates.filter(t => t.id !== newTpl.id)];
    }

    setCustomTemplates(updatedList);
    try {
      localStorage.setItem("hrms_custom_offer_templates", JSON.stringify(updatedList));
      window.dispatchEvent(new Event("offer_templates_updated"));
    } catch (e) {
      console.error("Error saving template to localStorage", e);
    }

    setSelectedTemplateId(newTpl.id);
    setJustSavedTemplateId(newTpl.id);
    setActiveTab("templates");
    setSaveModalOpen(false);
    showNotification(`Template "${newTpl.name}" successfully saved to your template library!`, "success");
  };

  // Word Document Upload & Parsing Handler
  const handleWordDocUpload = async (file: File) => {
    try {
      setIsUploadingDoc(true);
      const parsed = await parseUploadedOfferDoc(file);

      if (parsed.subjectText) setSubjectText(parsed.subjectText);
      if (parsed.openingText) setOpeningText(parsed.openingText);
      if (parsed.clausesText) setCustomClausesText(parsed.clausesText);
      if (parsed.closingText) setClosingText(parsed.closingText);

      if (parsed.signingAuthority) {
        setOfferForm(prev => ({
          ...prev,
          signingAuthority: parsed.signingAuthority!,
          signingTitle: parsed.signingTitle || prev.signingTitle
        }));
      }

      if (parsed.candidateName) setCandidateNameInput(parsed.candidateName);
      if (parsed.candidateRole) setCandidateRoleInput(parsed.candidateRole);
      if (parsed.candidateEmail) setCandidateEmailInput(parsed.candidateEmail);
      if (parsed.extractedCtc) {
        setOfferForm(prev => ({ ...prev, ctc: parsed.extractedCtc! }));
      }

      setImportedDocBanner({
        fileName: file.name,
        summary: `Imported "${file.name}". Subject, salutation, ${parsed.clausesText ? "legal clauses, " : ""}and sign-off extracted.`
      });

      setActiveTab("content");
      showNotification(`Word Document "${file.name}" imported into studio!`);
    } catch (err: any) {
      console.error("Failed to parse Word document:", err);
      showNotification("Could not parse the uploaded document. Please check the file format.", "error");
    } finally {
      setIsUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleOpenCreateCustomTemplate = () => {
    setEditingTplId(null);
    setNewTplForm({
      name: "",
      badge: "Custom",
      description: "",
      probationMonths: probationMonths,
      noticeDays: noticeDays,
      basicPct: salarySplit.basicPct,
      hraPct: salarySplit.hraPct,
      specialPct: salarySplit.specialPct,
      pfPct: salarySplit.pfPct,
      clauses: customClausesText,
      fontFamily: fontFamily,
      fontSize: fontSize,
      headingSize: headingSize,
      letterheadStyle: letterheadStyle,
      accentColor: accentColor
    });
    setCustomTplModalOpen(true);
  };

  const handleOpenEditCustomTemplate = (tpl: CustomOfferTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTplId(tpl.id);
    setNewTplForm({
      name: tpl.name,
      badge: tpl.badge || "Custom",
      description: tpl.description || "",
      probationMonths: tpl.probationMonths || 3,
      noticeDays: tpl.noticeDays || 30,
      basicPct: tpl.salarySplit?.basicPct || 50,
      hraPct: tpl.salarySplit?.hraPct || 20,
      specialPct: tpl.salarySplit?.specialPct || 20,
      pfPct: tpl.salarySplit?.pfPct || 10,
      clauses: tpl.defaultClauses || "",
      fontFamily: tpl.fontFamily || fontFamily,
      fontSize: tpl.fontSize || fontSize,
      headingSize: tpl.headingSize || headingSize,
      letterheadStyle: tpl.letterheadStyle || letterheadStyle,
      accentColor: tpl.accentColor || accentColor
    });
    setCustomTplModalOpen(true);
  };

  const handleSaveNewCustomTemplate = () => {
    if (!newTplForm.name.trim()) {
      showNotification("Please enter a template name.", "error");
      return;
    }
    const newTpl: CustomOfferTemplate = {
      id: editingTplId || `custom_${Date.now()}`,
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
      fontFamily: newTplForm.fontFamily,
      fontSize: newTplForm.fontSize,
      headingSize: newTplForm.headingSize,
      letterheadStyle: newTplForm.letterheadStyle,
      accentColor: newTplForm.accentColor,
      subjectText,
      openingText,
      closingText,
      footerText,
      headerOrgName,
      headerAddress,
      headerEmail,
      headerPhone,
      headerGstin,
      headerCin,
      headerBadgeText,
      logoPosition,
      logoSize
    };

    let updated: CustomOfferTemplate[];
    if (editingTplId) {
      updated = customTemplates.map(t => t.id === editingTplId ? newTpl : t);
    } else {
      updated = [newTpl, ...customTemplates.filter(t => t.id !== newTpl.id)];
    }
    setCustomTemplates(updated);
    try {
      localStorage.setItem("hrms_custom_offer_templates", JSON.stringify(updated));
      window.dispatchEvent(new Event("offer_templates_updated"));
    } catch (e) {
      console.error(e);
    }
    setCustomTplModalOpen(false);
    handleSelectTemplate(newTpl.id);
    setJustSavedTemplateId(newTpl.id);
    setActiveTab("templates");
    showNotification(`Custom template '${newTpl.name}' ${editingTplId ? "updated" : "created"} and applied!`, "success");
  };

  const handleDeleteCustomTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const tpl = customTemplates.find(t => t.id === id);
    const name = tpl?.name || "template";
    if (!window.confirm(`Are you sure you want to delete custom template "${name}"?`)) {
      return;
    }
    const updated = customTemplates.filter(t => t.id !== id);
    setCustomTemplates(updated);
    try {
      localStorage.setItem("hrms_custom_offer_templates", JSON.stringify(updated));
      window.dispatchEvent(new Event("offer_templates_updated"));
    } catch (e) {
      console.error(e);
    }
    if (selectedTemplateId === id) {
      handleSelectTemplate("fulltime");
    }
    showNotification(`Custom template "${name}" removed.`, "info");
  };


  // Active Logo resolution
  const selectedComp = companyList.find(c => c.id === selectedCompanyId);
  const resolvedErpLogo = resolveImageUrl(selectedComp?.logo_url || activeGst?.logo_url || defaultLogo);
  const activeLogo = resolveImageUrl(customLogoUrl.trim()) || resolvedErpLogo;

  // Resolved candidate info
  const selectedApplicant = applicants.find(a => a.id === offerForm.applicantId);
  const selectedEmployee = employeeList.find(e => e.id === selectedEmpId);

  const candidateName = candidateNameInput.trim() || (
    recipientType === "employee"
      ? (selectedEmployee?.full_name || selectedEmployee?.name || "Employee Name")
      : (selectedApplicant?.name || "Candidate Name")
  );

  const candidateEmail = candidateEmailInput.trim() || (
    recipientType === "employee"
      ? (selectedEmployee?.email || "employee@company.com")
      : (selectedApplicant?.email || "candidate@company.com")
  );

  const candidateRole = candidateRoleInput.trim() || (
    recipientType === "employee"
      ? (selectedEmployee?.designation?.name || selectedEmployee?.designation_name || selectedEmployee?.position || selectedEmployee?.role || "Staff")
      : (selectedApplicant?.job_title || "Team Member")
  );

  const candidateDepartment = candidateDepartmentInput.trim() || (
    recipientType === "employee"
      ? (selectedEmployee?.department?.name || selectedEmployee?.department_name || (selectedEmployee as any)?.department || "General")
      : ((selectedApplicant as any)?.department || "General")
  );

  // Calculations
  const ctcVal = Number(offerForm.ctc || 0);
  const basicVal = (ctcVal * salarySplit.basicPct) / 100;
  const hraVal = (ctcVal * salarySplit.hraPct) / 100;
  const specialVal = (ctcVal * salarySplit.specialPct) / 100;
  const pfVal = (ctcVal * salarySplit.pfPct) / 100;
  const monthlyGross = (ctcVal - pfVal) / 12;

  // Dynamic variable substitution helper
  const resolveVars = (text: string) => {
    if (!text) return "";
    return text
      .replace(/\{\{candidate_name\}\}/gi, candidateName)
      .replace(/\{\{candidate_email\}\}/gi, candidateEmail)
      .replace(/\{\{role\}\}/gi, candidateRole)
      .replace(/\{\{designation\}\}/gi, candidateRole)
      .replace(/\{\{department\}\}/gi, candidateDepartment)
      .replace(/\{\{candidate_department\}\}/gi, candidateDepartment)
      .replace(/\{\{company_name\}\}/gi, headerOrgName)
      .replace(/\{\{org_name\}\}/gi, headerOrgName)
      .replace(/\{\{ctc_annual\}\}/gi, `${currency.symbol}${ctcVal.toLocaleString()}`)
      .replace(/\{\{joining_date\}\}/gi, offerForm.joiningDate ? new Date(offerForm.joiningDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "[Joining Date]")
      .replace(/\{\{expiry_date\}\}/gi, offerForm.expiryDate ? new Date(offerForm.expiryDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "[Expiry Date]")
      .replace(/\{\{probation\}\}/gi, probationMonths > 0 ? `${probationMonths} months` : "Direct Appointment")
      .replace(/\{\{notice\}\}/gi, `${noticeDays} days`)
      .replace(/\{\{signatory_name\}\}/gi, offerForm.signingAuthority)
      .replace(/\{\{signatory_title\}\}/gi, offerForm.signingTitle);
  };

  const insertVariable = (variableTag: string, targetField: "subject" | "opening" | "closing" | "clauses" | "footer") => {
    if (targetField === "subject") setSubjectText(prev => `${prev} ${variableTag}`.trim());
    if (targetField === "opening") setOpeningText(prev => `${prev} ${variableTag}`.trim());
    if (targetField === "closing") setClosingText(prev => `${prev} ${variableTag}`.trim());
    if (targetField === "clauses") setCustomClausesText(prev => `${prev}\n${variableTag}`.trim());
    if (targetField === "footer") setFooterText(prev => `${prev} ${variableTag}`.trim());
    showNotification(`Inserted '${variableTag}' tag!`);
  };

  // Resolved dynamic texts
  const resolvedSubject = subjectText ? resolveVars(subjectText) : `Formal Offer of Employment — ${candidateRole}`;
  const resolvedOpening = openingText ? resolveVars(openingText) : `On behalf of <strong>${headerOrgName}</strong>, we are pleased to extend this formal offer of employment for the position of <strong>${candidateRole}</strong>${candidateDepartment && candidateDepartment !== 'General' ? ` in the <strong>${candidateDepartment}</strong> department` : ''}. We were exceptionally impressed with your achievements, domain knowledge, and leadership alignment with our organization.`;
  const resolvedClosing = closingText ? resolveVars(closingText) : `This offer remains valid until <strong>${offerForm.expiryDate ? new Date(offerForm.expiryDate).toLocaleDateString("en-US", { dateStyle: "long" }) : "[Expiry Date]"}</strong>. Please sign and return a duplicate copy of this letter as confirmation of your acceptance.`;
  const resolvedClauses = resolveVars(customClausesText);
  const resolvedFooter = footerText ? resolveVars(footerText) : `${headerOrgName} • Private & Confidential`;

  // Export handlers
  const handleExportWord = () => {
    downloadOfferLetterWordDoc({
      candidateName,
      candidateEmail,
      role: candidateRole,
      department: candidateDepartment,
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
      fontFamily,
      fontSize,
      headingSize,
      lineHeight,
      primaryColor,
      accentColor,
      textAlign,
      marginSize,
      letterheadStyle,
      subjectText: resolvedSubject,
      openingText: resolvedOpening,
      closingText: resolvedClosing,
      footerText: resolvedFooter,
      headerBadgeText: headerBadgeText,
      logoPosition: logoPosition,
      logoSize: logoSize,
      orgName: headerOrgName,
      orgAddress: headerAddress,
      orgEmail: headerEmail,
      orgPhone: headerPhone,
      orgGstin: headerGstin,
      orgCin: headerCin,
      orgLogo: activeLogo,
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

    const marginStyles = {
      compact: "10mm 12mm",
      normal: "16mm 18mm",
      spacious: "22mm 24mm"
    }[marginSize];

    const logoPx = logoSize === "small" ? "36px" : logoSize === "large" ? "64px" : "48px";

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Employment Offer - ${candidateName} - ${headerOrgName}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: ${marginStyles};
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              background: #ffffff;
              color: ${primaryColor};
              font-family: ${fontFamily};
              font-size: ${fontSize}pt;
              line-height: ${lineHeight};
              text-align: ${textAlign};
              position: relative;
            }
            .watermark-overlay {
              position: fixed;
              top: 38%;
              left: 5%;
              width: 90%;
              text-align: center;
              font-size: 56pt;
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
              ${letterheadStyle === "bordered" ? `border: 2px solid ${accentColor}; padding: 24px; border-radius: 8px;` : ""}
            }
            .header-banner {
              display: flex;
              justify-content: ${logoPosition === "center" ? "center" : "space-between"};
              flex-direction: ${logoPosition === "center" ? "column" : "row"};
              text-align: ${logoPosition === "center" ? "center" : "left"};
              align-items: center;
              padding-bottom: 14px;
              border-bottom: 2px solid ${accentColor};
              margin-bottom: 18px;
              ${letterheadStyle === "banner" ? `background: ${primaryColor}; color: #ffffff; padding: 16px 20px; border-radius: 6px;` : ""}
            }
            .header-banner h1 {
              font-size: ${headingSize}pt;
              font-weight: 800;
              color: ${letterheadStyle === "banner" ? "#ffffff" : primaryColor};
              letter-spacing: -0.5px;
            }
            .header-banner p {
              font-size: ${fontSize - 2}pt;
              color: ${letterheadStyle === "banner" ? "#cbd5e1" : "#64748b"};
              margin-top: 2px;
            }
            .meta-badge {
              text-align: ${logoPosition === "center" ? "center" : "right"};
              margin-top: ${logoPosition === "center" ? "8px" : "0"};
            }
            .doc-tag {
              display: inline-block;
              padding: 3px 8px;
              background: ${accentColor};
              color: #ffffff;
              font-size: ${fontSize - 2.5}pt;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              border-radius: 4px;
            }
            .date-str {
              font-size: ${fontSize - 2}pt;
              color: ${letterheadStyle === "banner" ? "#cbd5e1" : "#64748b"};
              margin-top: 4px;
            }
            .recipient-block {
              background: #f8fafc;
              border-left: 4px solid ${accentColor};
              padding: 12px 16px;
              border-radius: 4px;
              margin-bottom: 18px;
            }
            .recipient-block h3 {
              font-size: ${fontSize + 1.5}pt;
              font-weight: 800;
              color: ${primaryColor};
            }
            .recipient-block p {
              font-size: ${fontSize - 1}pt;
              color: #475569;
              margin-top: 2px;
            }
            .salutation {
              font-size: ${fontSize + 0.5}pt;
              font-weight: 700;
              margin-bottom: 8px;
            }
            .body-paragraph {
              margin-bottom: 14px;
              color: ${primaryColor};
            }
            .table-title {
              font-size: ${fontSize + 0.5}pt;
              font-weight: 800;
              color: ${primaryColor};
              border-bottom: 1.5px solid #e2e8f0;
              padding-bottom: 4px;
              margin-top: 18px;
              margin-bottom: 10px;
            }
            .comp-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 14px;
              font-size: ${fontSize - 1}pt;
            }
            .comp-table th {
              background: #f1f5f9;
              border: 1px solid #cbd5e1;
              padding: 6px 10px;
              text-align: left;
              font-weight: 800;
              color: ${primaryColor};
            }
            .comp-table td {
              border: 1px solid #e2e8f0;
              padding: 5px 10px;
              color: #334155;
            }
            .comp-table .total-row {
              background: #eff6ff;
              font-weight: 800;
              color: ${accentColor};
            }
            .clauses-box {
              background: #fcfcfc;
              border-left: 3px solid ${accentColor};
              padding: 10px 14px;
              margin-bottom: 18px;
              font-size: ${fontSize - 1}pt;
              line-height: ${lineHeight};
              color: #334155;
              white-space: pre-wrap;
            }
            .signature-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
              margin-top: 26px;
              padding-top: 14px;
              border-top: 1px solid #e2e8f0;
            }
            .sig-box h4 {
              font-size: ${fontSize + 0.5}pt;
              font-weight: 800;
              color: ${primaryColor};
            }
            .sig-box p {
              font-size: ${fontSize - 2}pt;
              color: #64748b;
            }
            .sig-line {
              height: 36px;
              border-bottom: 1px dashed #94a3b8;
              margin-bottom: 6px;
            }
            .footer-strip {
              margin-top: 24px;
              padding-top: 10px;
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
          ${watermarkEnabled ? `<div class="watermark-overlay">${watermarkText}</div>` : ""}
          <div class="page-container">
            <div class="header-banner">
              <div style="display: flex; align-items: center; gap: 14px; ${logoPosition === 'center' ? 'flex-direction: column;' : ''}">
                ${logoPosition !== 'hidden' ? (activeLogo ? `<img src="${activeLogo}" alt="${headerOrgName}" style="max-height: ${logoPx}; max-width: 160px; object-fit: contain;" />` : `<div style="width: 42px; height: 42px; border-radius: 8px; background: ${accentColor}; color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 13pt;">${defaultOrgInitials}</div>`) : ''}
                <div>
                  <h1>${headerOrgName}</h1>
                  <p>${headerAddress}</p>
                  <p>Email: ${headerEmail} • Phone: ${headerPhone}${headerGstin ? ` • GSTIN: ${headerGstin}` : ""}${headerCin ? ` • CIN: ${headerCin}` : ""}</p>
                </div>
              </div>
              <div class="meta-badge">
                <div class="doc-tag">${headerBadgeText}</div>
                <div class="date-str">Date: ${new Date().toLocaleDateString("en-US", { dateStyle: "long" })}</div>
                <div class="date-str" style="font-family:monospace;">REF: ${refNumber}</div>
              </div>
            </div>

            <div class="recipient-block">
              <p style="font-size:7.5pt; font-weight:800; color:#64748b; text-transform:uppercase; margin-bottom:2px;">Private & Confidential • Appointment Offer</p>
              <h3>${candidateName}</h3>
              <p>Email: ${candidateEmail}</p>
              <p>Position: <strong>${candidateRole}</strong> ${candidateDepartment && candidateDepartment !== 'General' ? ` | Department: <strong>${candidateDepartment}</strong>` : ""} | Joining Date: <strong>${new Date(offerForm.joiningDate).toLocaleDateString("en-US", { dateStyle: "medium" })}</strong></p>
            </div>

            <p style="font-size: ${fontSize + 1}pt; font-weight: 800; margin-bottom: 10px; color: ${primaryColor};">${resolvedSubject}</p>

            <div class="salutation">Dear ${candidateName},</div>
            
            <p class="body-paragraph">${resolvedOpening}</p>

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
              <div style="margin-top: 6px;">${resolvedClauses}</div>
            </div>

            <p class="body-paragraph" style="margin-top: 14px;">${resolvedClosing}</p>

            <div class="signature-grid">
              <div class="sig-box">
                <p style="text-transform:uppercase; font-size:7.5pt; font-weight:800; color:#64748b;">Authorized Signatory:</p>
                <div class="sig-line"></div>
                <h4>${offerForm.signingAuthority}</h4>
                <p>${offerForm.signingTitle}</p>
                <p>${headerOrgName}</p>
              </div>
              <div class="sig-box" style="text-align: right;">
                <p style="text-transform:uppercase; font-size:7.5pt; font-weight:800; color:#64748b;">Candidate Acceptance:</p>
                <div class="sig-line"></div>
                <h4>${candidateName}</h4>
                <p>Acceptance Date: _________________</p>
                <p style="color:${accentColor}; font-weight:700;">Valid Until: ${new Date(offerForm.expiryDate).toLocaleDateString()}</p>
              </div>
            </div>

            <div class="footer-strip">
              <div>${footerVerificationEnabled ? `Secure Verification: BOS-SIGN-${Math.floor(100000 + Math.random() * 900000)}` : ""}</div>
              <div>${resolvedFooter}</div>
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
    if (recipientType === "applicant" && !offerForm.applicantId && !candidateNameInput.trim()) {
      showNotification("Please select an applicant or enter candidate details.");
      return;
    }
    if (recipientType === "employee" && !selectedEmpId) {
      showNotification("Please select an existing employee.");
      return;
    }
    if (!candidateName.trim()) {
      showNotification("Please enter candidate full name.");
      return;
    }
    setSavingSending(true);
    try {
      const payload = {
        applicant_id: (recipientType === "applicant" && offerForm.applicantId) ? offerForm.applicantId : undefined,
        employee_id: (recipientType === "employee" && selectedEmpId) ? selectedEmpId : undefined,
        candidate: candidateName,
        candidate_email: candidateEmail,
        role: candidateRole,
        department: candidateDepartment,
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
        subject: resolvedSubject,
        opening_text: resolvedOpening,
        closing_text: resolvedClosing,
        clauses: customClausesText,
        footer_text: resolvedFooter,
        org_name: headerOrgName,
        org_address: headerAddress,
        org_email: headerEmail,
        org_phone: headerPhone,
        org_gstin: headerGstin,
        org_cin: headerCin,
        org_logo: activeLogo,
        logo_position: logoPosition,
        logo_size: logoSize,
        font_family: fontFamily,
        font_size: fontSize,
        heading_size: headingSize,
        line_height: lineHeight,
        text_align: textAlign,
        margin_size: marginSize,
        primary_color: primaryColor,
        accent_color: accentColor,
        letterhead_style: letterheadStyle,
        template_name: allTemplates.find(t => t.id === selectedTemplateId)?.name || "Corporate Offer",
        watermark_text: watermarkEnabled ? watermarkText : null,
      };

      if (editingOffer && handleUpdateOfferApi) {
        await handleUpdateOfferApi(editingOffer.id, payload);
        onOfferSent();
        onClose();
        showNotification("Offer letter updated and saved successfully!", "success");
      } else {
        await handleSendOfferApi(payload);
        onOfferSent();
        onClose();
        showNotification("Offer Letter saved and generated with full custom parameters!", "success");
      }
    } catch (err: any) {
      showNotification(err?.message || "Failed to save offer letter.", "error");
    } finally {
      setSavingSending(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      {/* Hidden File Input for Word/PDF Docs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.doc,.pdf,.rtf,.txt,.html"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleWordDocUpload(file);
        }}
        className="hidden"
      />

      {/* Hidden File Input for Custom Company Logo */}
      <input
        ref={logoFileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUploadLogoFile(file);
        }}
        className="hidden"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border rounded-2xl w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] font-sans"
      >
        {/* Studio Header */}
        <div className="p-4 sm:p-5 border-b border-border flex justify-between items-center bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                {editingOffer ? `Edit Offer Letter: ${candidateName || "Candidate"}` : "Offer Letter Studio & Custom Template Creator"}
                <span className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full border ${
                  editingOffer ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
                }`}>
                  {editingOffer ? "Editing Mode" : "Word-Like Studio"}
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">
                {editingOffer
                  ? `Editing offer letter parameters for ${candidateName || "candidate"}. Modify compensation, clauses, dates, header/footer, or typography and save changes.`
                  : "Complete design studio: customize Header & Logo, Footer, Salary Split, Legal Clauses, Word Typography, or upload Word/PDF doc & save reusable custom templates."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingDoc}
              className="text-xs font-bold gap-1.5 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50"
            >
              <Upload className="size-3.5" /> {isUploadingDoc ? "Parsing..." : "Upload Doc (.docx / .pdf)"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenSaveTemplateModal}
              className="text-xs font-bold gap-1.5 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-50"
            >
              <Bookmark className="size-3.5" /> Save as Template
            </Button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 transition-colors">
              <XCircle className="size-6 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
        </div>

        {/* Word Document Import Notification Banner */}
        {importedDocBanner && (
          <div className="px-6 py-2.5 bg-indigo-500/10 border-b border-indigo-500/20 flex flex-wrap justify-between items-center text-xs text-indigo-950 dark:text-indigo-200">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-indigo-600" />
              <span>
                <strong>Document Loaded:</strong> {importedDocBanner.summary}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 sm:mt-0">
              <Button
                size="sm"
                variant="outline"
                onClick={handleOpenSaveTemplateModal}
                className="h-7 text-[11px] font-bold border-indigo-500/40 text-indigo-700 bg-white dark:bg-zinc-900 gap-1"
              >
                <Save className="size-3" /> Save this as Template
              </Button>
              <button
                type="button"
                onClick={() => setImportedDocBanner(null)}
                className="text-muted-foreground hover:text-foreground text-xs p-1"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Studio Navigation Ribbon */}
        <div className="flex flex-wrap items-center justify-between px-4 sm:px-6 py-2.5 border-b border-border bg-muted/10 gap-2">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveTab("templates")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "templates" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Layers className="size-3.5" /> 1. Templates
            </button>
            <button
              onClick={() => setActiveTab("content")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "content" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <FileText className="size-3.5" /> 2. Document Content & Salary
            </button>
            <button
              onClick={() => setActiveTab("headerfooter")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "headerfooter" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <LayoutTemplate className="size-3.5" /> 3. Header, Logo & Footer
            </button>
            <button
              onClick={() => setActiveTab("design")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "design" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Sliders className="size-3.5" /> 4. Typography (Word Studio)
            </button>
            <button
              onClick={() => setActiveTab("watermark")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "watermark" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Shield className="size-3.5" /> 5. Security & Watermark
            </button>
            <button
              onClick={() => setActiveTab("preview")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "preview" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Eye className="size-3.5" /> 6. Live Preview
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
                Applicant
              </button>
              <button
                type="button"
                onClick={() => setRecipientType("employee")}
                className={`px-2 py-1 rounded-md transition-all ${
                  recipientType === "employee" ? "bg-background text-indigo-600 shadow-xs font-black" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Employee
              </button>
              <button
                type="button"
                onClick={() => setRecipientType("custom")}
                className={`px-2 py-1 rounded-md transition-all ${
                  recipientType === "custom" ? "bg-background text-amber-600 shadow-xs font-black" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Custom Candidate
              </button>
            </div>

            {recipientType === "applicant" && (
              <select
                value={offerForm.applicantId}
                onChange={(e) => handleSelectApplicant(e.target.value)}
                className="h-8 px-2.5 text-xs rounded-md border border-input bg-background font-semibold max-w-[200px]"
              >
                <option value="">-- Choose Candidate --</option>
                {applicants.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.job_title})</option>
                ))}
              </select>
            )}

            {recipientType === "employee" && (
              <select
                value={selectedEmpId}
                onChange={(e) => handleSelectEmployee(e.target.value)}
                className="h-8 px-2.5 text-xs rounded-md border border-indigo-300 bg-indigo-50/50 text-indigo-950 font-bold max-w-[220px] outline-none"
              >
                <option value="">-- Choose Employee --</option>
                {employeeList.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.full_name || e.name} ({e.designation?.name || e.employee_code || "Staff"})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Candidate Quick Details Bar (Visible across all tabs) */}
        <div className="px-6 py-3 bg-muted/30 border-b border-border/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-muted-foreground mb-0.5">Candidate Full Name *</label>
            <Input
              value={candidateNameInput}
              onChange={(e) => setCandidateNameInput(e.target.value)}
              placeholder="e.g. John Doe"
              className="h-8 text-xs font-semibold bg-background"
            />
          </div>
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-muted-foreground mb-0.5">Candidate Email Address</label>
            <Input
              type="email"
              value={candidateEmailInput}
              onChange={(e) => setCandidateEmailInput(e.target.value)}
              placeholder="e.g. john.doe@example.com"
              className="h-8 text-xs font-semibold bg-background"
            />
          </div>
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-muted-foreground mb-0.5">Position / Job Designation *</label>
            <Input
              value={candidateRoleInput}
              onChange={(e) => setCandidateRoleInput(e.target.value)}
              list="company-designations-list"
              placeholder="e.g. Lead Software Engineer"
              className="h-8 text-xs font-semibold bg-background"
            />
          </div>
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-muted-foreground mb-0.5">Department / Division</label>
            <Input
              value={candidateDepartmentInput}
              onChange={(e) => setCandidateDepartmentInput(e.target.value)}
              list="company-departments-list"
              placeholder="e.g. Engineering / Operations"
              className="h-8 text-xs font-semibold bg-background"
            />
          </div>
        </div>

        {/* Studio Body Content */}
        <div className="flex-1 overflow-y-auto p-6 text-sm">
          {/* TAB 1: TEMPLATES & CUSTOM BLUEPRINTS */}
          {activeTab === "templates" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-base font-bold text-foreground">Offer Letter Templates & Blueprints</h4>
                  <p className="text-xs text-muted-foreground">Select a standard blueprint, upload your existing Word doc, or save custom reusable templates.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    size="sm"
                    variant="outline"
                    disabled={isUploadingDoc}
                    className="text-xs font-bold gap-1.5 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50"
                  >
                    <Upload className="size-3.5" /> Upload Word Doc
                  </Button>
                  <Button
                    onClick={handleOpenSaveTemplateModal}
                    size="sm"
                    variant="outline"
                    className="text-xs font-bold gap-1.5 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-50"
                  >
                    <Bookmark className="size-3.5" /> Save Current as Template
                  </Button>
                  <Button
                    onClick={handleOpenCreateCustomTemplate}
                    size="sm"
                    className="text-xs font-bold gap-1.5 bg-primary text-primary-foreground shrink-0"
                  >
                    <Plus className="size-3.5" /> Create Blank Template
                  </Button>
                </div>
              </div>

              {/* Word Document Drag & Drop / Upload Card */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-4 rounded-xl border-2 border-dashed border-indigo-500/40 bg-indigo-50/20 hover:bg-indigo-50/40 transition-all cursor-pointer flex items-center justify-between gap-4 group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-600 group-hover:scale-105 transition-transform">
                    <FileUp className="size-6" />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-foreground flex items-center gap-2">
                      Upload Word Document (.docx / .doc)
                      <span className="text-[10px] bg-indigo-500 text-white font-black px-1.5 py-0.5 rounded">NEW</span>
                    </h5>
                    <p className="text-xs text-muted-foreground">
                      Click to upload your existing company offer letter. We will parse the Subject, Clauses, Terms & Sign-off so you can save it directly as a template.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 text-xs font-bold border-indigo-500 text-indigo-600 bg-white dark:bg-zinc-900"
                >
                  Choose File
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allTemplates.map((tpl) => {
                  const isSelected = selectedTemplateId === tpl.id;
                  const isCustom = (tpl as any).isCustom;
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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              isCustom ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" : "bg-primary/10 text-primary"
                            }`}>
                              {tpl.badge}
                            </span>
                            {justSavedTemplateId === tpl.id && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500 text-white shadow-xs animate-pulse">
                                ✓ Just Saved
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {isCustom && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenEditCustomTemplate(tpl as CustomOfferTemplate, e)}
                                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                  title="Edit Template"
                                >
                                  <Edit3 className="size-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteCustomTemplate(tpl.id, e)}
                                  className="p-1 rounded hover:bg-rose-100 text-rose-500 transition-colors"
                                  title="Delete Template"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </>
                            )}
                            {isSelected && (
                              <div className="p-1 bg-primary text-primary-foreground rounded-full">
                                <Check className="size-3" />
                              </div>
                            )}
                          </div>
                        </div>
                        <h5 className="font-bold text-sm text-foreground mb-1">{tpl.name}</h5>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{tpl.description}</p>
                      </div>

                      <div className="pt-3 border-t border-border/60 text-[11px] space-y-1 text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Probation:</span>
                          <span className="font-semibold text-foreground">{tpl.probationMonths > 0 ? `${tpl.probationMonths} mo` : "None"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Notice Period:</span>
                          <span className="font-semibold text-foreground">{tpl.noticeDays} days</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Basic / HRA Split:</span>
                          <span className="font-semibold text-foreground">{tpl.salarySplit.basicPct}% / {tpl.salarySplit.hraPct}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: DOCUMENT CONTENT & SALARY */}
          {activeTab === "content" && (
            <div className="space-y-6">
              {/* Dynamic Variables Bar & Word Upload Action */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-amber-500" /> Insert Dynamic Variable Tags (Mail-Merge)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-6 text-[10px] font-bold border-indigo-500/30 text-indigo-600 bg-background gap-1"
                    >
                      <Upload className="size-3" /> Import Word Doc
                    </Button>
                    <span className="text-[11px] text-muted-foreground">Click chips to insert tag</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { tag: "{{candidate_name}}", label: "Candidate Name" },
                    { tag: "{{candidate_email}}", label: "Candidate Email" },
                    { tag: "{{role}}", label: "Designation / Role" },
                    { tag: "{{department}}", label: "Department" },
                    { tag: "{{company_name}}", label: "Company Name" },
                    { tag: "{{ctc_annual}}", label: "Annual CTC" },
                    { tag: "{{joining_date}}", label: "Joining Date" },
                    { tag: "{{expiry_date}}", label: "Offer Expiry" },
                    { tag: "{{probation}}", label: "Probation Period" },
                    { tag: "{{notice}}", label: "Notice Period" },
                    { tag: "{{signatory_name}}", label: "HR Signatory" },
                    { tag: "{{signatory_title}}", label: "Signatory Title" },
                  ].map(v => (
                    <button
                      key={v.tag}
                      type="button"
                      onClick={() => insertVariable(v.tag, "opening")}
                      className="px-2.5 py-1 rounded-md bg-card border border-border text-[11px] font-mono font-semibold hover:border-primary hover:text-primary transition-all flex items-center gap-1 text-foreground shadow-2xs"
                    >
                      <Plus className="size-3 text-primary" /> {v.label} <span className="text-muted-foreground text-[10px]">{v.tag}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject & Opening */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Offer Letter Subject</label>
                  <Input
                    placeholder={`Formal Offer of Employment — ${candidateRole}`}
                    value={subjectText}
                    onChange={(e) => setSubjectText(e.target.value)}
                    className="text-xs font-semibold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
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
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Opening Salutation & Formal Paragraph</label>
                <Textarea
                  rows={4}
                  placeholder={`On behalf of ${headerOrgName}, we are pleased to extend this formal offer of employment for the position of ${candidateRole}. We were exceptionally impressed with your achievements, domain knowledge, and leadership alignment.`}
                  value={openingText}
                  onChange={(e) => setOpeningText(e.target.value)}
                  className="text-xs leading-relaxed"
                />
              </div>

              {/* Salary Structure Matrix */}
              <div className="p-5 rounded-2xl border border-border bg-card space-y-4 shadow-xs">
                <div className="flex justify-between items-center border-b pb-3">
                  <h5 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Calculator className="size-4 text-primary" /> Annual CTC & Compensation Structure (Annexure A)
                  </h5>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">Annual CTC:</span>
                    <Input
                      type="number"
                      value={offerForm.ctc}
                      onChange={(e) => setOfferForm({ ...offerForm, ctc: Number(e.target.value) })}
                      className="w-32 h-8 font-bold font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Basic Salary ({salarySplit.basicPct}%)</label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={salarySplit.basicPct}
                      onChange={(e) => setSalarySplit({ ...salarySplit, basicPct: Number(e.target.value) })}
                      className="font-mono text-xs font-bold"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">{currency.symbol}{Math.round(basicVal).toLocaleString()}/yr</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">HRA ({salarySplit.hraPct}%)</label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={salarySplit.hraPct}
                      onChange={(e) => setSalarySplit({ ...salarySplit, hraPct: Number(e.target.value) })}
                      className="font-mono text-xs font-bold"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">{currency.symbol}{Math.round(hraVal).toLocaleString()}/yr</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Special ({salarySplit.specialPct}%)</label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={salarySplit.specialPct}
                      onChange={(e) => setSalarySplit({ ...salarySplit, specialPct: Number(e.target.value) })}
                      className="font-mono text-xs font-bold"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">{currency.symbol}{Math.round(specialVal).toLocaleString()}/yr</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">PF ({salarySplit.pfPct}%)</label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={salarySplit.pfPct}
                      onChange={(e) => setSalarySplit({ ...salarySplit, pfPct: Number(e.target.value) })}
                      className="font-mono text-xs font-bold"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">{currency.symbol}{Math.round(pfVal).toLocaleString()}/yr</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <p className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Monthly In-Hand Gross</p>
                    <p className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-300 mt-0.5">
                      {currency.symbol}{monthlyGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                    <p className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400">Annual Statutory PF</p>
                    <p className="text-xl font-bold font-mono text-indigo-700 dark:text-indigo-300 mt-0.5">
                      {currency.symbol}{pfVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Terms & Legal Clauses */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-foreground">Terms, Conditions & Legal Covenants (Annexure B)</label>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-semibold">Probation:</span>
                    <select
                      value={probationMonths}
                      onChange={(e) => setProbationMonths(Number(e.target.value))}
                      className="h-7 px-2 text-xs rounded border bg-background"
                    >
                      <option value={0}>No Probation</option>
                      <option value={1}>1 Month</option>
                      <option value={3}>3 Months</option>
                      <option value={6}>6 Months</option>
                    </select>
                    <span className="text-xs text-muted-foreground font-semibold">Notice:</span>
                    <Input
                      type="number"
                      value={noticeDays}
                      onChange={(e) => setNoticeDays(Number(e.target.value))}
                      className="w-16 h-7 text-xs font-mono"
                    />
                  </div>
                </div>
                <Textarea
                  value={customClausesText}
                  onChange={(e) => setCustomClausesText(e.target.value)}
                  rows={8}
                  className="font-mono text-xs leading-relaxed"
                  placeholder="Define confidentiality, IP assignment, working hours, and non-compete clauses..."
                />
              </div>

              {/* Closing Paragraph */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Closing Paragraph & Acceptance Call-to-Action</label>
                <Textarea
                  rows={3}
                  placeholder={`This offer remains valid until ${offerForm.expiryDate ? new Date(offerForm.expiryDate).toLocaleDateString() : "[Expiry Date]"}. Please sign and return a duplicate copy of this letter as confirmation of your acceptance.`}
                  value={closingText}
                  onChange={(e) => setClosingText(e.target.value)}
                  className="text-xs leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* TAB 3: HEADER, LOGO & FOOTER */}
          {activeTab === "headerfooter" && (
            <div className="space-y-6">
              <div>
                <h4 className="text-base font-bold text-foreground">Header, Logo Position & Footer Configuration</h4>
                <p className="text-xs text-muted-foreground">Select an issuing organization from Core ERP to automatically fetch company logo, address, GSTIN, and registration details, or customize manually.</p>
              </div>

              {/* Core ERP Company / Organization Selector */}
              <div className="p-5 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      <Building2 className="size-5" />
                    </div>
                    <div>
                      <h5 className="font-bold text-sm text-foreground">Select Core ERP Issuing Organization</h5>
                      <p className="text-xs text-muted-foreground">Switch organization to automatically load its uploaded company logo and official legal profile.</p>
                    </div>
                  </div>
                  {companyList.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground">Organization:</span>
                      <select
                        value={selectedCompanyId}
                        onChange={(e) => handleSelectCompany(e.target.value)}
                        className="h-8 px-3 text-xs font-bold rounded-lg border border-indigo-500/40 bg-background text-foreground shadow-xs focus:ring-2 focus:ring-indigo-500"
                      >
                        {companyList.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.legal_name || c.name} {c.registration_number ? `(${c.registration_number})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Company Logo Management & Live Preview */}
              <div className="p-5 rounded-2xl border border-border bg-card space-y-5 shadow-xs">
                <div className="flex items-center justify-between border-b pb-3">
                  <h5 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Image className="size-4 text-primary" /> Company Logo & Branding Asset
                  </h5>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => logoFileInputRef.current?.click()}
                      className="text-xs font-bold gap-1.5 border-primary/40 text-primary h-8"
                    >
                      <Upload className="size-3.5" /> Upload Logo File
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleResetToCompanyLogo}
                      className="text-xs font-semibold text-muted-foreground hover:text-foreground h-8 gap-1"
                    >
                      <RefreshCw className="size-3" /> Use Core ERP Logo
                    </Button>
                  </div>
                </div>

                {/* Visual Logo Card */}
                <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl bg-muted/20 border border-border/80">
                  <div className="relative size-24 shrink-0 rounded-xl bg-white border border-border flex items-center justify-center p-2 shadow-xs overflow-hidden">
                    {activeLogo ? (
                      <img
                        src={activeLogo}
                        alt="Company Logo"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center p-1">
                        <Building2 className="size-6 text-muted-foreground/60 mb-1" />
                        <span className="text-[10px] font-black uppercase text-muted-foreground">{defaultOrgInitials}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2 text-center sm:text-left">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <span className="font-bold text-sm text-foreground">{headerOrgName || "Selected Organization"}</span>
                      {activeLogo ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                          <Check className="size-3" /> Logo Loaded
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20">
                          No Logo Image (Using Initials)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {activeLogo
                        ? "This official company logo will be rendered on the letterhead in Live Preview, PDF export, and Word documents."
                        : "No custom logo found for this organization. You can upload an image file (PNG/JPG) above or configure it in Core ERP Company Settings."}
                    </p>
                    {customLogoUrl && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setCustomLogoUrl("")}
                          className="text-[11px] font-bold text-rose-500 hover:text-rose-600 underline"
                        >
                          Clear custom override & revert to organization default
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Logo Alignment & Sizing Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Logo Position / Alignment</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: "left", label: "Left" },
                        { id: "center", label: "Center" },
                        { id: "right", label: "Right" },
                        { id: "hidden", label: "Hidden" },
                      ].map(pos => (
                        <button
                          key={pos.id}
                          type="button"
                          onClick={() => setLogoPosition(pos.id as any)}
                          className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                            logoPosition === pos.id ? "bg-primary text-primary-foreground border-primary shadow-xs" : "hover:bg-muted text-muted-foreground"
                          }`}
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Logo Scaling Size</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "small", label: "Small (36px)" },
                        { id: "medium", label: "Medium (48px)" },
                        { id: "large", label: "Large (64px)" },
                      ].map(sz => (
                        <button
                          key={sz.id}
                          type="button"
                          onClick={() => setLogoSize(sz.id as any)}
                          className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                            logoSize === sz.id ? "bg-primary text-primary-foreground border-primary shadow-xs" : "hover:bg-muted text-muted-foreground"
                          }`}
                        >
                          {sz.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Custom Logo Image URL / Base64 Data</label>
                  <Input
                    type="text"
                    placeholder="Paste image URL (https://...) or upload an image file above"
                    value={customLogoUrl}
                    onChange={(e) => setCustomLogoUrl(e.target.value)}
                    className="text-xs font-mono"
                  />
                </div>
              </div>

              {/* Header Letterhead Fields */}
              <div className="p-5 rounded-2xl border border-border bg-card space-y-4 shadow-xs">
                <h5 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Building2 className="size-4 text-primary" /> Organization Legal Information & Tax Identifiers
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Company / Organization Legal Name</label>
                    <Input
                      value={headerOrgName}
                      onChange={(e) => setHeaderOrgName(e.target.value)}
                      placeholder="e.g. BusinessOS Global Technologies"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Document Header Badge / Tag Text</label>
                    <Input
                      value={headerBadgeText}
                      onChange={(e) => setHeaderBadgeText(e.target.value)}
                      placeholder="e.g. OFFICIAL OFFER / CONFIDENTIAL APPOINTMENT"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Company Address & Registered Office</label>
                  <Input
                    value={headerAddress}
                    onChange={(e) => setHeaderAddress(e.target.value)}
                    placeholder="e.g. Cyber City, DLF Phase 2, Gurugram, Haryana - 122002, India"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Email</label>
                    <Input
                      value={headerEmail}
                      onChange={(e) => setHeaderEmail(e.target.value)}
                      placeholder="hr@company.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Phone</label>
                    <Input
                      value={headerPhone}
                      onChange={(e) => setHeaderPhone(e.target.value)}
                      placeholder="+91-800-555-0199"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">GSTIN (Tax ID)</label>
                    <Input
                      value={headerGstin}
                      onChange={(e) => setHeaderGstin(e.target.value)}
                      placeholder="07AAAAA0000A1Z5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">CIN</label>
                    <Input
                      value={headerCin}
                      onChange={(e) => setHeaderCin(e.target.value)}
                      placeholder="U72200DL2024PTC123456"
                    />
                  </div>
                </div>
              </div>

              {/* Signatures & Footer Notice */}
              <div className="p-5 rounded-2xl border border-border bg-card space-y-4 shadow-xs">
                <h5 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" /> Signatures & Document Footer Notice
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-muted-foreground uppercase">Authorized HR Signatory</label>
                      {employeeList && employeeList.length > 0 && (
                        <select
                          onChange={(e) => {
                            const emp = employeeList.find(x => x.id === e.target.value);
                            if (emp) {
                              const desig = emp.designation?.name || emp.designation_name || emp.position || emp.role || "HR Signatory";
                              setOfferForm(prev => ({
                                ...prev,
                                signingAuthority: emp.full_name || emp.name,
                                signingTitle: desig
                              }));
                              showNotification(`Signatory auto-filled: ${emp.full_name || emp.name} (${desig})`);
                            }
                          }}
                          className="text-[10px] bg-muted/60 text-primary font-bold border border-primary/20 rounded px-1.5 py-0.5 outline-none hover:bg-muted cursor-pointer"
                          defaultValue=""
                        >
                          <option value="" disabled>⚡ Quick Fill from Staff</option>
                          {employeeList.map(e => (
                            <option key={e.id} value={e.id}>
                              {e.full_name || e.name} ({e.designation?.name || e.position || "Staff"})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <Input
                      value={offerForm.signingAuthority}
                      onChange={(e) => setOfferForm({ ...offerForm, signingAuthority: e.target.value })}
                      placeholder="e.g. Priya Sharma"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Signatory Title / Designation</label>
                    <Input
                      value={offerForm.signingTitle}
                      onChange={(e) => setOfferForm({ ...offerForm, signingTitle: e.target.value })}
                      list="signatory-titles-list"
                      placeholder="e.g. Head of Talent & People Operations"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Document Footer Notice / Confidentiality Statement</label>
                  <Input
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    placeholder="e.g. BusinessOS AI • Private & Confidential"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs font-semibold text-foreground">Include Digital Verification Security Stamp on Footer</span>
                  <input
                    type="checkbox"
                    checked={footerVerificationEnabled}
                    onChange={(e) => setFooterVerificationEnabled(e.target.checked)}
                    className="size-4 rounded border-border"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: WORD STUDIO & TYPOGRAPHY DESIGN */}
          {activeTab === "design" && (
            <div className="space-y-6">
              <div>
                <h4 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Sliders className="size-4 text-primary" /> Microsoft Word-Style Typography & Layout Studio
                </h4>
                <p className="text-xs text-muted-foreground">
                  Format typography just like Microsoft Word: Font Family, Body & Heading Font Sizes, Line Spacing, Margins, Palette Colors, and Letterhead Layout.
                </p>
              </div>

              {/* Word Ribbon Toolbar Controls */}
              <div className="p-4 rounded-2xl border border-border bg-card space-y-5 shadow-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Font Family Selector */}
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5 flex items-center gap-1.5">
                      <Type className="size-3.5 text-primary" /> Font Family
                    </label>
                    <select
                      value={fontFamily}
                      onChange={(e) => setFontFamily(e.target.value)}
                      className="w-full h-9 px-3 text-xs rounded-lg border border-input bg-background font-semibold"
                    >
                      {WORD_FONT_FAMILIES.map(f => (
                        <option key={f.id} value={f.css} style={{ fontFamily: f.css }}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Body Font Size */}
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5 flex items-center justify-between">
                      <span>Body Font Size</span>
                      <span className="text-primary font-mono">{fontSize} pt</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setFontSize(prev => Math.max(8, Number((prev - 0.5).toFixed(1))))}
                        className="p-1.5 rounded-md border hover:bg-muted text-muted-foreground"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <select
                        value={fontSize}
                        onChange={(e) => setFontSize(Number(e.target.value))}
                        className="flex-1 h-9 px-2 text-xs rounded-lg border border-input bg-background font-mono text-center font-bold"
                      >
                        {[8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 13].map(sz => (
                          <option key={sz} value={sz}>{sz} pt</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setFontSize(prev => Math.min(14, Number((prev + 0.5).toFixed(1))))}
                        className="p-1.5 rounded-md border hover:bg-muted text-muted-foreground"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Heading Size */}
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5 flex items-center justify-between">
                      <span>Heading Size</span>
                      <span className="text-primary font-mono">{headingSize} pt</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setHeadingSize(prev => Math.max(12, prev - 1))}
                        className="p-1.5 rounded-md border hover:bg-muted text-muted-foreground"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <select
                        value={headingSize}
                        onChange={(e) => setHeadingSize(Number(e.target.value))}
                        className="flex-1 h-9 px-2 text-xs rounded-lg border border-input bg-background font-mono text-center font-bold"
                      >
                        {[14, 15, 16, 17, 18, 20, 22, 24].map(sz => (
                          <option key={sz} value={sz}>{sz} pt</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setHeadingSize(prev => Math.min(26, prev + 1))}
                        className="p-1.5 rounded-md border hover:bg-muted text-muted-foreground"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Line Spacing */}
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Line Spacing</label>
                    <div className="grid grid-cols-4 gap-1">
                      {[
                        { label: "1.15", val: 1.15 },
                        { label: "1.35", val: 1.35 },
                        { label: "1.45", val: 1.45 },
                        { label: "1.75", val: 1.75 }
                      ].map(item => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => setLineHeight(item.val)}
                          className={`py-1.5 text-xs font-bold rounded-md border transition-all ${
                            lineHeight === item.val ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Second Row: Alignment, Margins, Colors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                  {/* Text Alignment */}
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Text Alignment</label>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setTextAlign("left")}
                        className={`flex-1 py-1.5 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                          textAlign === "left" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        <AlignLeft className="size-3.5" /> Left Align
                      </button>
                      <button
                        type="button"
                        onClick={() => setTextAlign("justify")}
                        className={`flex-1 py-1.5 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                          textAlign === "justify" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        <AlignJustify className="size-3.5" /> Justified
                      </button>
                    </div>
                  </div>

                  {/* Margins */}
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Document Margins</label>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: "compact", label: "Compact" },
                        { id: "normal", label: "Normal" },
                        { id: "spacious", label: "Wide" }
                      ].map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setMarginSize(m.id as any)}
                          className={`py-1.5 text-xs font-bold rounded-md border transition-all ${
                            marginSize === m.id ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted text-muted-foreground"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Primary & Accent Color */}
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Primary Text Color</label>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {["#0f172a", "#1e1b4b", "#1e293b", "#09090b"].map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setPrimaryColor(c)}
                            style={{ backgroundColor: c }}
                            className={`size-6 rounded-md border-2 transition-all ${primaryColor === c ? "border-primary scale-110 shadow-xs" : "border-transparent"}`}
                          />
                        ))}
                      </div>
                      <Input
                        type="text"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="h-7 text-xs font-mono w-20 px-1 text-center"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Accent & Brand Color</label>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {["#4f46e5", "#0284c7", "#059669", "#dc2626", "#d97706", "#7c3aed"].map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setAccentColor(c)}
                            style={{ backgroundColor: c }}
                            className={`size-6 rounded-md border-2 transition-all ${accentColor === c ? "border-foreground scale-110 shadow-xs" : "border-transparent"}`}
                          />
                        ))}
                      </div>
                      <Input
                        type="text"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="h-7 text-xs font-mono w-20 px-1 text-center"
                      />
                    </div>
                  </div>
                </div>

                {/* Third Row: Letterhead Presets */}
                <div className="pt-4 border-t">
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Letterhead Style Preset</label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {[
                      { id: "corporate", label: "Corporate Classic", desc: "Dual header with bottom accent line" },
                      { id: "modern", label: "Modern Minimal", desc: "Clean left-aligned contemporary layout" },
                      { id: "minimal", label: "Executive Simple", desc: "Subtle lines and spacious typography" },
                      { id: "bordered", label: "Bordered Certificate", desc: "Enclosed elegant frame design" },
                      { id: "banner", label: "Solid Brand Banner", desc: "High-contrast colored top band" },
                    ].map(styleItem => (
                      <div
                        key={styleItem.id}
                        onClick={() => setLetterheadStyle(styleItem.id as any)}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          letterheadStyle === styleItem.id
                            ? "border-primary bg-primary/5 shadow-xs"
                            : "border-border/60 hover:border-border bg-card"
                        }`}
                      >
                        <p className="font-bold text-xs text-foreground">{styleItem.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{styleItem.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SECURITY & WATERMARK */}
          {activeTab === "watermark" && (
            <div className="space-y-6">
              <div>
                <h4 className="text-base font-bold text-foreground">Security Watermark & Verification</h4>
                <p className="text-xs text-muted-foreground">Configure the security watermark text, opacity, and rotation across the document letterhead.</p>
              </div>

              <div className="p-5 rounded-2xl border border-border bg-card space-y-4 shadow-xs max-w-2xl">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Type className="size-4 text-primary" /> Security Watermark Overlay
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
                      <div className="flex flex-wrap gap-2 mt-2">
                        {["CONFIDENTIAL", "OFFICIAL OFFER", "PRIVATE", headerOrgName.toUpperCase()].map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setWatermarkText(tag)}
                            className="px-2.5 py-1 rounded-md bg-muted text-[11px] font-semibold hover:bg-muted/80 text-foreground"
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
          )}

          {/* TAB 6: LIVE LETTERHEAD PREVIEW */}
          {activeTab === "preview" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-base font-bold text-foreground">Live Official Letterhead Preview</h4>
                  <p className="text-xs text-muted-foreground">High-resolution preview reflecting your custom Header, Logo Position, Footer, Typography, and dynamic variables.</p>
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

              {/* Styled Letterhead Canvas with Live Watermark & Chosen Typography */}
              <div
                style={{
                  fontFamily: fontFamily,
                  fontSize: `${fontSize}pt`,
                  lineHeight: lineHeight,
                  color: primaryColor,
                  textAlign: textAlign,
                }}
                className={`border rounded-2xl bg-white shadow-xl max-w-3xl mx-auto relative overflow-hidden transition-all ${
                  letterheadStyle === "bordered" ? "border-4 border-indigo-200 p-8" : "border-border/80 p-8"
                }`}
              >
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
                  {/* Header banner with customizable logo position */}
                  <div
                    className={`flex ${logoPosition === 'center' ? 'flex-col items-center text-center' : 'justify-between items-start'} pb-4 ${
                      letterheadStyle === "banner"
                        ? "p-4 rounded-xl text-white mb-4"
                        : "border-b-2"
                    }`}
                    style={{
                      borderColor: accentColor,
                      backgroundColor: letterheadStyle === "banner" ? primaryColor : "transparent",
                    }}
                  >
                    <div className={`flex items-center gap-3.5 ${logoPosition === 'center' ? 'flex-col text-center' : ''}`}>
                      {logoPosition !== 'hidden' && (
                        activeLogo ? (
                          <img
                            src={activeLogo}
                            alt={headerOrgName}
                            style={{
                              height: logoSize === "small" ? "36px" : logoSize === "large" ? "64px" : "48px",
                              maxWidth: "160px",
                              objectFit: "contain"
                            }}
                            className="rounded-md"
                          />
                        ) : (
                          <div
                            style={{ backgroundColor: accentColor }}
                            className="size-11 rounded-lg text-white flex items-center justify-center font-extrabold text-sm"
                          >
                            {defaultOrgInitials}
                          </div>
                        )
                      )}
                      <div>
                        <h3
                          style={{ fontSize: `${headingSize}pt`, color: letterheadStyle === "banner" ? "#ffffff" : primaryColor }}
                          className="font-extrabold tracking-tight"
                        >
                          {headerOrgName}
                        </h3>
                        <p className={`text-xs mt-0.5 ${letterheadStyle === "banner" ? "text-zinc-200" : "text-zinc-500"}`}>{headerAddress}</p>
                        <p className={`text-[10px] ${letterheadStyle === "banner" ? "text-zinc-300" : "text-zinc-400"}`}>Email: {headerEmail} • Phone: {headerPhone}{headerGstin ? ` • GSTIN: ${headerGstin}` : ""}{headerCin ? ` • CIN: ${headerCin}` : ""}</p>
                      </div>
                    </div>
                    <div className={`meta-badge ${logoPosition === 'center' ? 'text-center mt-3' : 'text-right'}`}>
                      <span
                        style={{ backgroundColor: accentColor }}
                        className="inline-block px-3 py-1 text-white text-[10px] font-extrabold uppercase rounded tracking-wider"
                      >
                        {headerBadgeText}
                      </span>
                      <p className={`text-[10px] mt-1 font-mono ${letterheadStyle === "banner" ? "text-zinc-300" : "text-zinc-400"}`}>REF: BOS-OFFER-{Math.floor(1000 + Math.random() * 9000)}</p>
                    </div>
                  </div>

                  {/* Recipient details */}
                  <div
                    style={{ borderLeftColor: accentColor }}
                    className="bg-zinc-50 p-4 rounded-xl border-l-4 border border-zinc-200 text-xs space-y-1"
                  >
                    <p className="text-[10px] font-bold uppercase text-zinc-400">Addressed To:</p>
                    <h4 style={{ fontSize: `${fontSize + 1.5}pt` }} className="font-bold text-zinc-900">{candidateName}</h4>
                    <p className="text-zinc-500">{candidateEmail}</p>
                    <p className="text-zinc-600 font-semibold pt-1">
                      Role: {candidateRole} | Joining: {offerForm.joiningDate ? new Date(offerForm.joiningDate).toLocaleDateString() : "[Joining Date]"}
                    </p>
                  </div>

                  {/* Subject */}
                  <div style={{ fontSize: `${fontSize + 1}pt` }} className="font-bold text-zinc-900">
                    {resolvedSubject}
                  </div>

                  <div className="space-y-4 text-xs leading-relaxed text-zinc-700">
                    <p className="font-bold text-zinc-900">
                      Dear {candidateName},
                    </p>
                    <p>
                      {resolvedOpening}
                    </p>

                    <div className="border border-zinc-200 rounded-lg overflow-hidden my-4">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-zinc-100 font-bold border-b border-zinc-200">
                          <tr>
                            <th className="p-2">Component</th>
                            <th className="p-2 text-right">Split</th>
                            <th className="p-2 text-right">Monthly</th>
                            <th className="p-2 text-right">Annual ({currency.symbol})</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 font-mono">
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
                          <tr>
                            <td className="p-2 font-sans font-semibold text-muted-foreground">Employer PF (Statutory)</td>
                            <td className="p-2 text-right text-muted-foreground">{salarySplit.pfPct}%</td>
                            <td className="p-2 text-right text-muted-foreground">{currency.symbol}{Math.round(pfVal / 12).toLocaleString()}</td>
                            <td className="p-2 text-right text-muted-foreground font-bold">{currency.symbol}{Math.round(pfVal).toLocaleString()}</td>
                          </tr>
                          <tr className="bg-zinc-50 font-bold border-t-2">
                            <td style={{ color: accentColor }} className="p-2 font-sans">Total Annual Cost to Company (CTC)</td>
                            <td style={{ color: accentColor }} className="p-2 text-right">100%</td>
                            <td style={{ color: accentColor }} className="p-2 text-right">{currency.symbol}{Math.round(ctcVal / 12).toLocaleString()}</td>
                            <td style={{ color: accentColor }} className="p-2 text-right">{currency.symbol}{Math.round(ctcVal).toLocaleString()}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div
                      style={{ borderLeftColor: accentColor }}
                      className="p-3 bg-zinc-50 rounded-lg border-l-4 border border-zinc-200 whitespace-pre-wrap font-sans text-[11px] leading-relaxed"
                    >
                      {resolvedClauses}
                    </div>

                    <p className="mt-4">
                      {resolvedClosing}
                    </p>

                    <div className="pt-8 flex justify-between items-end border-t border-zinc-200 text-[11px] mt-8">
                      <div>
                        <p className="font-bold text-zinc-900">{offerForm.signingAuthority}</p>
                        <p className="text-zinc-400">{offerForm.signingTitle} • {headerOrgName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-zinc-400 italic">Valid until: {offerForm.expiryDate ? new Date(offerForm.expiryDate).toLocaleDateString() : "[Expiry Date]"}</p>
                        <p style={{ color: accentColor }} className="text-[9px] font-mono font-bold mt-1">✓ SEC-SIGNATURE-VERIFIED</p>
                      </div>
                    </div>

                    {/* Live Footer Preview */}
                    <div className="pt-4 border-t border-zinc-200/80 flex justify-between items-center text-[10px] text-zinc-400">
                      <div>{footerVerificationEnabled ? `Secure Verification: BOS-SIGN-${Math.floor(100000 + Math.random() * 900000)}` : ""}</div>
                      <div>{resolvedFooter}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Studio Footer Controls */}
        <div className="p-4 sm:p-5 border-t border-border flex flex-wrap gap-2 justify-between items-center bg-muted/20 text-sm">
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
              className="h-8 text-xs font-bold gap-1.5 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-50"
              onClick={handleOpenSaveTemplateModal}
            >
              <Bookmark className="size-3.5" /> Save as Template
            </Button>
            <Button
              variant="outline"
              className="h-8 text-xs font-bold gap-1.5"
              onClick={() => {
                if (recipientType === "applicant" && offerForm.applicantId) {
                  handleSaveOfferDocument(offerForm.applicantId);
                } else {
                  handleSendOffer();
                }
              }}
              disabled={!candidateName.trim() || savingSending}
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
              disabled={!candidateName.trim() || !offerForm.joiningDate || !offerForm.expiryDate || savingSending}
              className="h-8 text-xs font-bold gradient-brand text-white shadow-md gap-1.5"
            >
              <Send className="size-3.5" /> {savingSending ? "Saving..." : (editingOffer ? "Save & Update Offer Letter" : "Save & Generate Offer Letter")}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* DEDICATED INTERACTIVE SAVE TEMPLATE MODAL */}
      <AnimatePresence>
        {saveModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4"
            >
              <div className="flex justify-between items-center border-b pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
                    <Bookmark className="size-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-foreground">Save as Custom Template</h4>
                    <p className="text-xs text-muted-foreground">Save current studio configuration as a reusable offer blueprint.</p>
                  </div>
                </div>
                <button onClick={() => setSaveModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <XCircle className="size-5" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                {/* Save Mode Selector (if existing custom templates exist) */}
                {customTemplates.length > 0 && (
                  <div>
                    <label className="block font-bold text-muted-foreground uppercase mb-1.5">Action</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSaveModalMode("new")}
                        className={`p-2 rounded-lg border text-xs font-bold transition-all text-center ${
                          saveModalMode === "new"
                            ? "border-primary bg-primary/10 text-primary shadow-xs"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        + Save as New Template
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSaveModalMode("update");
                          if (!saveModalTargetId && customTemplates.length > 0) {
                            setSaveModalTargetId(customTemplates[0].id);
                            setSaveModalName(customTemplates[0].name);
                          }
                        }}
                        className={`p-2 rounded-lg border text-xs font-bold transition-all text-center ${
                          saveModalMode === "update"
                            ? "border-primary bg-primary/10 text-primary shadow-xs"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        Overwrite Existing
                      </button>
                    </div>
                  </div>
                )}

                {saveModalMode === "update" && (
                  <div>
                    <label className="block font-bold text-muted-foreground uppercase mb-1">Select Existing Template to Overwrite</label>
                    <select
                      value={saveModalTargetId}
                      onChange={(e) => {
                        setSaveModalTargetId(e.target.value);
                        const existing = customTemplates.find(t => t.id === e.target.value);
                        if (existing) {
                          setSaveModalName(existing.name);
                          setSaveModalBadge(existing.badge || "Custom");
                          setSaveModalDescription(existing.description || "");
                        }
                      }}
                      className="w-full h-9 px-3 text-xs rounded-md border bg-background font-semibold"
                    >
                      {customTemplates.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.badge})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-muted-foreground uppercase mb-1">Template Name *</label>
                  <Input
                    placeholder="e.g. Senior Software Engineer Blueprint"
                    value={saveModalName}
                    onChange={(e) => setSaveModalName(e.target.value)}
                    className="text-xs font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-muted-foreground uppercase mb-1">Category / Badge</label>
                    <select
                      value={saveModalBadge}
                      onChange={(e) => setSaveModalBadge(e.target.value)}
                      className="w-full h-9 px-2 text-xs rounded-md border bg-background font-semibold"
                    >
                      <option value="Custom">Custom</option>
                      <option value="Word Import">Word Import</option>
                      <option value="Engineering">Engineering / Tech</option>
                      <option value="Leadership">Leadership / Executive</option>
                      <option value="Sales">Sales & Growth</option>
                      <option value="Contract">Contract / Consultant</option>
                      <option value="Campus">Campus / Internship</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-muted-foreground uppercase mb-1">Description (Optional)</label>
                    <Input
                      placeholder="e.g. Full-time tech offer blueprint..."
                      value={saveModalDescription}
                      onChange={(e) => setSaveModalDescription(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>

                {/* Configuration Summary Card */}
                <div className="p-3 bg-muted/40 rounded-xl border border-border/70 space-y-1.5 text-[11px] text-muted-foreground">
                  <span className="font-bold text-foreground block">Included in this Template Blueprint:</span>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div>✓ Font: <strong className="text-foreground">{fontFamily.split(",")[0].replace(/['"]/g, "")} ({fontSize}pt)</strong></div>
                    <div>✓ Logo Position: <strong className="text-foreground capitalize">{logoPosition} ({logoSize})</strong></div>
                    <div>✓ Salary Matrix: <strong className="text-foreground">{salarySplit.basicPct}% / {salarySplit.hraPct}% / {salarySplit.specialPct}%</strong></div>
                    <div>✓ Notice / Probation: <strong className="text-foreground">{noticeDays}d / {probationMonths}mo</strong></div>
                    <div>✓ Header: <strong className="text-foreground truncate">{headerOrgName}</strong></div>
                    <div>✓ Custom Clauses: <strong className="text-foreground">{customClausesText ? "Included" : "Default"}</strong></div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button variant="outline" size="sm" onClick={() => setSaveModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirmSaveTemplate}
                  className="font-bold gap-1.5 bg-amber-600 hover:bg-amber-700 text-white shadow-md"
                >
                  <Bookmark className="size-3.5" /> {saveModalMode === "update" ? "Overwrite & Save" : "Save Template"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATE / EDIT CUSTOM TEMPLATE MODAL */}
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
                  <Plus className="size-4 text-primary" /> {editingTplId ? "Edit Custom Offer Template" : "Create New Custom Offer Template"}
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

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-muted-foreground uppercase mb-1">Font Family</label>
                    <select
                      value={newTplForm.fontFamily}
                      onChange={(e) => setNewTplForm({ ...newTplForm, fontFamily: e.target.value })}
                      className="w-full h-9 px-2 text-xs rounded-md border bg-background font-semibold"
                    >
                      {WORD_FONT_FAMILIES.map(f => (
                        <option key={f.id} value={f.css}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-muted-foreground uppercase mb-1">Body Font Size</label>
                    <select
                      value={newTplForm.fontSize}
                      onChange={(e) => setNewTplForm({ ...newTplForm, fontSize: Number(e.target.value) })}
                      className="w-full h-9 px-2 text-xs rounded-md border bg-background font-mono"
                    >
                      {[9, 10, 10.5, 11, 12].map(sz => (
                        <option key={sz} value={sz}>{sz} pt</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-muted-foreground uppercase mb-1">Layout Preset</label>
                    <select
                      value={newTplForm.letterheadStyle}
                      onChange={(e) => setNewTplForm({ ...newTplForm, letterheadStyle: e.target.value as any })}
                      className="w-full h-9 px-2 text-xs rounded-md border bg-background font-semibold"
                    >
                      <option value="corporate">Corporate Classic</option>
                      <option value="modern">Modern Minimal</option>
                      <option value="minimal">Executive Simple</option>
                      <option value="bordered">Bordered Certificate</option>
                      <option value="banner">Solid Brand Banner</option>
                    </select>
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
                  {editingTplId ? "Update Template" : "Save Template"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Datalists for Company Designations, Departments & Signatory Titles Auto-Completion */}
      <datalist id="company-designations-list">
        {designationsList.map((d, i) => (
          <option key={i} value={d} />
        ))}
      </datalist>

      <datalist id="company-departments-list">
        {departmentsList.map((d, i) => (
          <option key={i} value={d} />
        ))}
      </datalist>

      <datalist id="signatory-titles-list">
        <option value="Head of Talent & People Operations" />
        <option value="Chief Human Resources Officer (CHRO)" />
        <option value="Director of Human Resources" />
        <option value="VP of People & Culture" />
        <option value="Senior HR Business Partner" />
        <option value="Talent Acquisition Lead" />
        <option value="Managing Director" />
        <option value="Chief Executive Officer (CEO)" />
        <option value="Chief Technology Officer (CTO)" />
        <option value="Director of Engineering" />
        <option value="Vice President - Operations" />
        <option value="Operations Director" />
      </datalist>
    </div>
  );
}

