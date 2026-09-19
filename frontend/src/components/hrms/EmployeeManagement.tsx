import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Filter, Mail, Phone, MapPin, Users, User, Briefcase, Target, Edit2, Trash2, Loader2, Star, Upload, FileText, CheckCircle, AlertTriangle, ArrowRight, ShieldAlert, Key, Clipboard, Check, QrCode, Download, Share2, Printer, ExternalLink, Building, Sparkles, Eye } from "lucide-react";
import {
  employeesApi,
  departmentsApi,
  designationsApi,
  teamsApi,
  companiesApi,
  branchesApi,
  recruitmentApi,
  rolesApi,
  Employee,
  Department,
  Designation,
  Team,
  Company,
  Branch,
  Role,
  EmployeeDocument,
  EmployeeVCard
} from "../../lib/api-client";
import { OfferLetterStudioModal } from "./OfferLetterStudioModal";
import { Card } from "../ui/card";
const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString();
};

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";

interface Props { tab?: string; }

const empStatusStyle = (s: string) => {
  switch (s?.toLowerCase()) {
    case "active": return "bg-emerald-500/10 text-emerald-500";
    case "on leave": return "bg-amber-500/10 text-amber-500";
    case "inactive": return "bg-muted text-muted-foreground";
    default: return "bg-muted text-muted-foreground";
  }
};

export function EmployeeManagement({ tab = "employees" }: Props) {
    const { currency, formatCurrency } = useCurrency();
  // Common state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Data lists
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  
  // Filters & Pagination
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Dialogs
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Temporary password success dialog
  const [successCredentials, setSuccessCredentials] = useState<{ email: string; code: string; tempPass: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // vCard & Digital Business Card QR Modal
  const [vCardModalOpen, setVCardModalOpen] = useState(false);
  const [selectedEmpForVCard, setSelectedEmpForVCard] = useState<Employee | null>(null);
  const [vCardData, setVCardData] = useState<EmployeeVCard | null>(null);
  const [loadingVCard, setLoadingVCard] = useState(false);
  const [vcardCopied, setVcardCopied] = useState(false);

  // Offer Letter Studio for Existing Employees
  const [offerStudioOpen, setOfferStudioOpen] = useState(false);
  const [selectedEmpForOffer, setSelectedEmpForOffer] = useState<Employee | null>(null);

  // Document management
  const [selectedEmpIdForDocs, setSelectedEmpIdForDocs] = useState<string>("");
  const [employeeDocuments, setEmployeeDocuments] = useState<EmployeeDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState("Contract");
  const [filePath, setFilePath] = useState("");
  const [addingDoc, setAddingDoc] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState({
    employee_code: "",
    full_name: "",
    email: "",
    phone: "",
    employment_type: "Full-Time",
    status: "Active",
    basic_salary: "",
    punch_method: "GPS",
    nfc_card_number: "",
    company_id: "",
    branch_id: "",
    department_id: "",
    designation_id: "",
    role_id: "",
    manager_id: "",
    date_of_joining: new Date().toISOString().split("T")[0]
  });

  // Department CRUD State
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptForm, setDeptForm] = useState({
    name: "",
    code: "",
    company_id: "",
    branch_id: "",
    parent_id: "",
    head_user_id: "",
    description: "",
    status: "active"
  });

  // Designation CRUD State
  const [desigModalOpen, setDesigModalOpen] = useState(false);
  const [editingDesig, setEditingDesig] = useState<Designation | null>(null);
  const [desigForm, setDesigForm] = useState({
    name: "",
    code: "",
    level: "L2 - Mid-Level",
    department_id: "",
    reports_to_id: "",
    company_id: "",
    description: "",
    status: "active"
  });

  // Team CRUD State
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamForm, setTeamForm] = useState({
    name: "",
    code: "",
    department_id: "",
    branch_id: "",
    company_id: "",
    lead_employee_id: "",
    member_employee_ids: [] as string[],
    description: "",
    status: "active"
  });

  // Bulk input text
  const [bulkInput, setBulkInput] = useState("");
  const [bulkResult, setBulkResult] = useState<{ message?: string; created_count?: number; skipped_count?: number; errors?: string[] } | null>(null);

  // Load all references for selector filters
  const loadReferenceData = useCallback(async () => {
    try {
      const companiesRes = await companiesApi.list(1, 100);
      setCompanies(companiesRes.items);
      if (companiesRes.items.length > 0 && !formData.company_id) {
        setFormData(p => ({ ...p, company_id: companiesRes.items[0].id }));
      }

      const branchesRes = await branchesApi.list(1, 100);
      setBranches(branchesRes.items);
      
      const deptsRes = await departmentsApi.list(1, 100);
      setDepartments(deptsRes.items);
      
      const desigsRes = await designationsApi.list(1, 100);
      setDesignations(desigsRes.items);
      
      const teamsRes = await teamsApi.list(1, 100);
      setTeams(teamsRes.items);

      const rolesRes = await rolesApi.list(1, 100);
      setRoles(rolesRes.items || (Array.isArray(rolesRes) ? rolesRes : []));
    } catch (e) {
      console.error("Failed to load multi-org reference data", e);
    }
  }, [formData.company_id]);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await employeesApi.list(
        page,
        100, // Load more to map managers locally
        search || undefined,
        undefined,
        deptFilter || undefined,
        statusFilter || undefined
      );
      setEmployees(res.items);
      setTotal(res.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }, [page, search, deptFilter, statusFilter]);

  // Load other tabs data
  const loadDepartmentsTab = useCallback(async () => {
    setLoading(true);
    try {
      const res = await departmentsApi.list(1, 50);
      setDepartments(res.items);
    } catch (e: any) {
      setError(e.message || "Failed to load departments");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDesignationsTab = useCallback(async () => {
    setLoading(true);
    try {
      const res = await designationsApi.list(1, 50);
      setDesignations(res.items);
    } catch (e: any) {
      setError(e.message || "Failed to load designations");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTeamsTab = useCallback(async () => {
    setLoading(true);
    try {
      const res = await teamsApi.list(1, 50);
      setTeams(res.items);
    } catch (e: any) {
      setError(e.message || "Failed to load teams");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  useEffect(() => {
    if (tab === "employees" || tab === "documents" || tab === "employee_profile") loadEmployees();
    else if (tab === "departments") loadDepartmentsTab();
    else if (tab === "designations") loadDesignationsTab();
    else if (tab === "teams") loadTeamsTab();
  }, [tab, loadEmployees, loadDepartmentsTab, loadDesignationsTab, loadTeamsTab]);

  // Load documents when selection changes
  const loadEmployeeDocs = async (empId: string) => {
    if (!empId) return;
    setLoadingDocs(true);
    try {
      const docs = await employeesApi.listDocuments(empId);
      setEmployeeDocuments(docs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (selectedEmpIdForDocs) {
      loadEmployeeDocs(selectedEmpIdForDocs);
    }
  }, [selectedEmpIdForDocs]);

  const handleSaveDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName.trim() || !filePath.trim()) return;
    setAddingDoc(true);
    try {
      await employeesApi.createDocument(selectedEmpIdForDocs, {
        document_name: docName,
        document_type: docType,
        file_path: filePath,
        expiry_date: null,
        status: "Valid"
      });
      setDocName("");
      setFilePath("");
      loadEmployeeDocs(selectedEmpIdForDocs);
    } catch (e: any) {
      alert("Failed to save document: " + e.message);
    } finally {
      setAddingDoc(false);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        basic_salary: formData.basic_salary ? parseFloat(formData.basic_salary) : null,
        company_id: formData.company_id || null,
        branch_id: formData.branch_id || null,
        department_id: formData.department_id || null,
        designation_id: formData.designation_id || null,
        role_id: formData.role_id || null,
        manager_id: formData.manager_id || null
      };
      
      let createdEmp: any;
      if (editingEmployee) {
        createdEmp = await employeesApi.update(editingEmployee.id, payload);
      } else {
        createdEmp = await employeesApi.create(payload);
      }
      
      setAddDialogOpen(false);
      setEditingEmployee(null);
      
      // If temporary password is returned, show success credentials banner
      if (createdEmp?.temporary_password) {
        setSuccessCredentials({
          email: createdEmp.email,
          code: createdEmp.employee_code,
          tempPass: createdEmp.temporary_password
        });
      }
      
      loadEmployees();
    } catch (err: any) {
      setError(err.message || "Failed to save employee");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm("Are you sure you want to delete this employee profile? This will revoke their platform user login account as well.")) return;
    setLoading(true);
    try {
      await employeesApi.delete(id);
      toast.success("Employee profile deleted successfully");
      await loadEmployees();
    } catch (err: any) {
      const msg = err?.detail || err?.message || "Failed to delete employee";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkImport = async () => {
    if (!bulkInput.trim()) return;
    setLoading(true);
    setBulkResult(null);
    try {
      const lines = bulkInput.split("\n").map(l => l.trim()).filter(Boolean);
      const employeesToCreate = [];
      for (const line of lines) {
        const parts = line.split(",").map(p => p.trim());
        if (parts.length >= 3) {
          employeesToCreate.push({
            full_name: parts[0],
            employee_code: parts[1],
            email: parts[2],
            phone: parts[3] || null,
            date_of_joining: parts[4] || new Date().toISOString().split("T")[0],
            employment_type: parts[5] || "Full-Time",
            status: "Active",
            company_id: companies[0]?.id || null,
            branch_id: branches[0]?.id || null
          });
        }
      }
      if (employeesToCreate.length === 0) {
        throw new Error("No valid rows found. Format: Full Name, Code, Email, Phone, JoinDate, EmploymentType");
      }
      const res = await employeesApi.bulkCreate(employeesToCreate);
      setBulkResult(res);
      loadEmployees();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({
      employee_code: emp.employee_code,
      full_name: emp.full_name,
      email: emp.email,
      phone: emp.phone ?? "",
      employment_type: emp.employment_type,
      status: emp.status,
      basic_salary: emp.basic_salary ? String(emp.basic_salary) : "",
      punch_method: emp.punch_method || "GPS",
      nfc_card_number: emp.nfc_card_number ?? "",
      company_id: emp.company_id ?? (companies[0]?.id || ""),
      branch_id: emp.branch_id ?? "",
      department_id: emp.department_id ?? "",
      designation_id: emp.designation_id ?? "",
      role_id: emp.role_id ?? "",
      manager_id: emp.manager_id ?? "",
      date_of_joining: emp.date_of_joining ?? new Date().toISOString().split("T")[0]
    });
    setAddDialogOpen(true);
  };

  const handleCopyPass = () => {
    if (!successCredentials) return;
    navigator.clipboard.writeText(successCredentials.tempPass);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenVCard = async (emp: Employee) => {
    setSelectedEmpForVCard(emp);
    setVCardModalOpen(true);
    setLoadingVCard(true);
    setVCardData(null);
    try {
      const data = await employeesApi.getVCard(emp.id);
      setVCardData(data);
    } catch (err: any) {
      console.error("Failed to load vCard:", err);
    } finally {
      setLoadingVCard(false);
    }
  };

  const buildVCardString = (e: any, compName = "LazyMonkey AI", dName = "", desName = "") => {
    const lines = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `N:${e.full_name || ""};;;;`,
      `FN:${e.full_name || ""}`,
      `ORG:${compName}${dName ? ";" + dName : ""}`,
      `TITLE:${desName || "Staff"}`,
      `EMAIL;type=INTERNET;type=WORK:${e.email || ""}`,
      `TEL;type=CELL;type=VOICE:${e.phone || ""}`,
      `NOTE:Employee ID: ${e.employee_code || ""}`,
      "URL:https://lazymonkeyai.com",
      "END:VCARD"
    ];
    return lines.join("\r\n");
  };

  const handleDownloadVCard = () => {
    if (!selectedEmpForVCard && !vCardData) return;
    const empName = vCardData?.full_name || selectedEmpForVCard?.full_name || "Employee";
    const empCode = vCardData?.employee_code || selectedEmpForVCard?.employee_code || "EMP";
    const vcardText = vCardData?.vcard_raw || buildVCardString(
      selectedEmpForVCard || vCardData,
      vCardData?.company_name || companies[0]?.name || "LazyMonkey AI",
      vCardData?.department || "",
      vCardData?.designation || ""
    );

    const blob = new Blob([vcardText], { type: "text/vcard;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${empCode}_${empName.replace(/\s+/g, "_")}.vcf`;
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
    toast.success(`Downloaded vCard for ${empName}`);
  };

  const handleBulkExportVCards = () => {
    if (!employees || employees.length === 0) {
      toast.error("No employees found to export.");
      return;
    }
    const companyName = companies[0]?.name || "LazyMonkey AI";
    const blocks = employees.map(emp => {
      const dept = departments.find(d => d.id === emp.department_id)?.name || "";
      const desig = designations.find(d => d.id === emp.designation_id)?.name || "";
      return buildVCardString(emp, companyName, dept, desig);
    });

    const bulkText = blocks.join("\r\n\r\n");
    const blob = new Blob([bulkText], { type: "text/vcard;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${companyName.replace(/\s+/g, "_")}_Employees_Directory.vcf`;
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
    toast.success(`Successfully exported ${employees.length} employee vCards!`);
  };

  const handleDownloadQrImage = () => {
    if (!vCardData?.qr_code_data_url) {
      alert("QR code image is not yet available.");
      return;
    }
    const link = document.createElement("a");
    link.href = vCardData.qr_code_data_url;
    link.download = `${(vCardData.full_name || selectedEmpForVCard?.full_name || "Employee").replace(/\s+/g, "_")}_vCard_QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShareQrCode = async () => {
    if (!vCardData) return;
    const shareText = `*${vCardData.full_name}* - Digital Business Card\n${vCardData.designation || ""} | ${vCardData.company_name}\nEmail: ${vCardData.email}\nPhone: ${vCardData.phone || ""}\nEmployee ID: ${vCardData.employee_code}\n🌐 https://lazymonkeyai.com`;

    if (typeof navigator !== "undefined" && navigator.share && vCardData.qr_code_data_url) {
      try {
        const res = await fetch(vCardData.qr_code_data_url);
        const blob = await res.blob();
        const file = new File([blob], `${(vCardData.full_name || "vcard").replace(/\s+/g, "_")}_QR.png`, { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `${vCardData.full_name} - Digital Business Card`,
            text: shareText,
            files: [file],
          });
          return;
        } else {
          await navigator.share({
            title: `${vCardData.full_name} - Digital Business Card`,
            text: shareText,
          });
          return;
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.warn("Share fallback:", err);
        } else {
          return;
        }
      }
    }
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, "_blank");
  };

  const handleCopyVCardContact = () => {
    if (!vCardData) return;
    const text = `📇 ${vCardData.full_name}\n🏢 ${vCardData.company_name}\n💼 ${vCardData.designation || "Staff"} · ${vCardData.department || ""}\n🆔 ${vCardData.employee_code}\n📧 ${vCardData.email}\n📞 ${vCardData.phone || "N/A"}\n🌐 https://lazymonkeyai.com`;
    navigator.clipboard.writeText(text);
    setVcardCopied(true);
    setTimeout(() => setVcardCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    if (!vCardData) return;
    const text = `*${vCardData.full_name}* - Digital Business Card\n${vCardData.designation || ""} | ${vCardData.company_name}\nEmail: ${vCardData.email}\nPhone: ${vCardData.phone || ""}\nEmployee ID: ${vCardData.employee_code}\n🌐 https://lazymonkeyai.com`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handlePrintCard = () => {
    const empName = vCardData?.full_name || selectedEmpForVCard?.full_name || "Employee";
    const empCode = vCardData?.employee_code || selectedEmpForVCard?.employee_code || "EMP-001";
    const designation = vCardData?.designation || designations.find(d => d.id === selectedEmpForVCard?.designation_id)?.name || "Corporate Staff";
    const department = vCardData?.department || departments.find(d => d.id === selectedEmpForVCard?.department_id)?.name || "General Department";
    const activeCompany = companies.find(c => c.id === selectedEmpForVCard?.company_id) || companies[0];
    const company = vCardData?.company_name || activeCompany?.name || "BusinessOS AI";
    const companyLogo = activeCompany?.logo_url || "";
    const email = vCardData?.email || selectedEmpForVCard?.email || "";
    const phone = vCardData?.phone || selectedEmpForVCard?.phone || "N/A";
    const qrUrl = vCardData?.qr_code_data_url || "";
    const initials = empName.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();

    const printWindow = window.open("", "_blank", "width=850,height=1100");
    if (!printWindow) {
      alert("Please allow popups to print Employee Pass.");
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Employee Pass - ${empName} (${empCode})</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm 15mm;
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
              padding: 12px;
            }
            .page-container {
              max-width: 720px;
              margin: 0 auto;
              border: 1px solid #cbd5e1;
              border-radius: 16px;
              padding: 24px;
              background: #ffffff;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 14px;
              margin-bottom: 24px;
            }
            .header-left h1 {
              font-size: 18pt;
              font-weight: 900;
              color: #0f172a;
              letter-spacing: -0.5px;
            }
            .header-left p {
              font-size: 8.5pt;
              color: #64748b;
              font-weight: 600;
              margin-top: 2px;
            }
            .header-right {
              text-align: right;
            }
            .badge-org {
              display: inline-block;
              background: #4f46e5;
              color: #ffffff;
              font-size: 8pt;
              font-weight: 800;
              padding: 4px 12px;
              border-radius: 20px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .card-wrapper {
              display: flex;
              gap: 24px;
              margin-bottom: 24px;
            }
            .id-badge {
              width: 270px;
              flex-shrink: 0;
              border: 2px solid #4f46e5;
              border-radius: 16px;
              overflow: hidden;
              background: #ffffff;
            }
            .badge-top {
              background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
              color: #ffffff;
              padding: 14px;
              text-align: center;
            }
            .badge-top h3 {
              font-size: 11pt;
              font-weight: 800;
            }
            .badge-top span {
              font-size: 7.5pt;
              opacity: 0.9;
              text-transform: uppercase;
            }
            .avatar-box {
              width: 58px;
              height: 58px;
              background: #ffffff;
              color: #4f46e5;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 15pt;
              font-weight: 900;
              margin: -29px auto 6px auto;
              border: 3px solid #ffffff;
              box-shadow: 0 2px 6px rgba(0,0,0,0.15);
            }
            .badge-body {
              padding: 12px;
              text-align: center;
            }
            .badge-name {
              font-size: 12pt;
              font-weight: 900;
              color: #0f172a;
            }
            .badge-desig {
              font-size: 8.5pt;
              font-weight: 700;
              color: #4f46e5;
              margin-top: 2px;
            }
            .badge-code {
              display: inline-block;
              background: #f1f5f9;
              color: #334155;
              font-size: 8pt;
              font-weight: 800;
              padding: 3px 8px;
              border-radius: 6px;
              margin-top: 6px;
              font-family: monospace;
            }
            .badge-qr {
              margin: 10px auto;
              background: #ffffff;
              padding: 6px;
              border: 1px dashed #cbd5e1;
              border-radius: 10px;
              display: inline-block;
            }
            .badge-qr img {
              width: 125px;
              height: 125px;
              display: block;
            }
            .badge-footer-note {
              font-size: 7pt;
              color: #64748b;
              line-height: 1.3;
            }
            .details-panel {
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            .info-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 9pt;
            }
            .info-table tr {
              border-bottom: 1px solid #e2e8f0;
            }
            .info-table td {
              padding: 8px 6px;
            }
            .info-label {
              color: #64748b;
              font-weight: 600;
              width: 38%;
              text-transform: uppercase;
              font-size: 7.5pt;
            }
            .info-val {
              color: #0f172a;
              font-weight: 700;
            }
            .verification-box {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 12px;
              margin-top: 10px;
            }
            .verification-box h4 {
              font-size: 8pt;
              font-weight: 800;
              color: #0f172a;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 3px;
            }
            .verification-box p {
              font-size: 7.5pt;
              color: #64748b;
              line-height: 1.4;
            }
            .sign-row {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              margin-top: 20px;
              padding-top: 14px;
              border-top: 1px dashed #cbd5e1;
            }
            .sign-box {
              text-align: center;
            }
            .sign-line {
              width: 130px;
              border-top: 1px solid #0f172a;
              margin-bottom: 4px;
            }
            .sign-label {
              font-size: 7.5pt;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
            }
            .barcode-strip {
              font-family: monospace;
              font-size: 8pt;
              letter-spacing: 2px;
              color: #334155;
              font-weight: bold;
            }
            @media print {
              body { padding: 0; background: transparent; }
              .page-container { border: none; padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="page-container">
            <div class="header">
              <div class="header-left" style="display: flex; align-items: center; gap: 14px;">
                ${companyLogo ? `<img src="${companyLogo}" alt="${company}" style="max-height: 48px; max-width: 140px; object-fit: contain;" />` : `<div style="width: 42px; height: 42px; border-radius: 8px; background: #4f46e5; color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 14pt;">${activeCompany?.logo_initials || "ORG"}</div>`}
                <div>
                  <h1>${company}</h1>
                  <p>Official Digital Employee Identity Pass & Credential Verification</p>
                </div>
              </div>
              <div class="header-right">
                <span class="badge-org">Verified Corporate Staff</span>
                <div style="font-size: 7.5pt; color: #64748b; margin-top: 4px;">Issued: ${new Date().toLocaleDateString("en-IN", { dateStyle: "medium" })}</div>
              </div>
            </div>

            <div class="card-wrapper">
              <div class="id-badge">
                <div class="badge-top">
                  ${companyLogo ? `<img src="${companyLogo}" alt="${company}" style="max-height: 28px; max-width: 120px; object-fit: contain; filter: brightness(0) invert(1); margin-bottom: 4px;" />` : `<h3>${company}</h3>`}
                  <span>Digital Pass & NFC vCard</span>
                </div>
                <div class="avatar-box">${initials}</div>
                <div class="badge-body">
                  <div class="badge-name">${empName}</div>
                  <div class="badge-desig">${designation}</div>
                  <div class="badge-code">${empCode}</div>
                  
                  <div class="badge-qr">
                    ${qrUrl ? `<img src="${qrUrl}" alt="vCard QR" />` : `<div style="width:125px;height:125px;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:8pt;">QR Code</div>`}
                  </div>
                  <div class="badge-footer-note">Scan with any smartphone camera to instantly save contact details</div>
                </div>
              </div>

              <div class="details-panel">
                <table class="info-table">
                  <tr>
                    <td class="info-label">Full Name</td>
                    <td class="info-val">${empName}</td>
                  </tr>
                  <tr>
                    <td class="info-label">Employee Code</td>
                    <td class="info-val" style="font-family:monospace;">${empCode}</td>
                  </tr>
                  <tr>
                    <td class="info-label">Designation</td>
                    <td class="info-val">${designation}</td>
                  </tr>
                  <tr>
                    <td class="info-label">Department</td>
                    <td class="info-val">${department}</td>
                  </tr>
                  <tr>
                    <td class="info-label">Official Email</td>
                    <td class="info-val">${email || "—"}</td>
                  </tr>
                  <tr>
                    <td class="info-label">Contact Phone</td>
                    <td class="info-val">${phone}</td>
                  </tr>
                  <tr>
                    <td class="info-label">Organization</td>
                    <td class="info-val">${company}</td>
                  </tr>
                </table>

                <div class="verification-box">
                  <h4>Security & Usage Instructions</h4>
                  <p>This digital badge represents valid employment authorization. Keep this card handy during office hours and client engagements. Scanning the QR code automatically transfers verified contact cards (.VCF) into mobile address books.</p>
                </div>
              </div>
            </div>

            <div class="sign-row">
              <div class="sign-box">
                <div class="sign-line"></div>
                <div class="sign-label">Employee Signature</div>
              </div>
              <div style="text-align: center;">
                <div class="barcode-strip">||| | |||| | |||||| || |</div>
                <div style="font-size: 6.5pt; color: #94a3b8; text-transform: uppercase;">ID: ${empCode} · SEC-AUTH-VERIFIED</div>
              </div>
              <div class="sign-box">
                <div class="sign-line"></div>
                <div class="sign-label">Authorized Signatory</div>
              </div>
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

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Department Handlers
  const handleOpenCreateDept = () => {
    setEditingDept(null);
    setDeptForm({
      name: "",
      code: "",
      company_id: companies[0]?.id || "",
      branch_id: "",
      parent_id: "",
      head_user_id: "",
      description: "",
      status: "active"
    });
    setDeptModalOpen(true);
  };

  const handleOpenEditDept = (dept: Department) => {
    setEditingDept(dept);
    setDeptForm({
      name: dept.name,
      code: dept.code,
      company_id: dept.company_id || companies[0]?.id || "",
      branch_id: dept.branch_id || "",
      parent_id: dept.parent_id || "",
      head_user_id: dept.head_user_id || "",
      description: dept.description || "",
      status: dept.status || "active"
    });
    setDeptModalOpen(true);
  };

  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDept) {
        await departmentsApi.update(editingDept.id, deptForm);
        toast.success(`Department '${deptForm.name}' updated!`);
      } else {
        await departmentsApi.create(deptForm);
        toast.success(`Department '${deptForm.name}' created!`);
      }
      setDeptModalOpen(false);
      await loadReferenceData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save department");
    }
  };

  const handleDeleteDept = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete department '${name}'?`)) return;
    try {
      await departmentsApi.delete(id);
      toast.success(`Department '${name}' deleted.`);
      await loadReferenceData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete department");
    }
  };

  // Designation Handlers
  const handleOpenCreateDesig = () => {
    setEditingDesig(null);
    setDesigForm({
      name: "",
      code: "",
      level: "L2 - Mid-Level",
      department_id: departments[0]?.id || "",
      reports_to_id: "",
      company_id: companies[0]?.id || "",
      description: "",
      status: "active"
    });
    setDesigModalOpen(true);
  };

  const handleOpenEditDesig = (desig: Designation) => {
    setEditingDesig(desig);
    setDesigForm({
      name: desig.name,
      code: desig.code || "",
      level: desig.level || "L2 - Mid-Level",
      department_id: desig.department_id || "",
      reports_to_id: desig.reports_to_id || "",
      company_id: desig.company_id || companies[0]?.id || "",
      description: desig.description || "",
      status: desig.status || "active"
    });
    setDesigModalOpen(true);
  };

  const handleSaveDesig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDesig) {
        await designationsApi.update(editingDesig.id, desigForm);
        toast.success(`Designation '${desigForm.name}' updated!`);
      } else {
        await designationsApi.create(desigForm);
        toast.success(`Designation '${desigForm.name}' created!`);
      }
      setDesigModalOpen(false);
      await loadReferenceData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save designation");
    }
  };

  const handleDeleteDesig = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete designation '${name}'?`)) return;
    try {
      await designationsApi.delete(id);
      toast.success(`Designation '${name}' deleted.`);
      await loadReferenceData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete designation");
    }
  };

  // Team Handlers
  const handleOpenCreateTeam = () => {
    setEditingTeam(null);
    setTeamForm({
      name: "",
      code: "",
      department_id: departments[0]?.id || "",
      branch_id: "",
      company_id: companies[0]?.id || "",
      lead_employee_id: "",
      member_employee_ids: [],
      description: "",
      status: "active"
    });
    setTeamModalOpen(true);
  };

  const handleOpenEditTeam = (team: Team) => {
    setEditingTeam(team);
    setTeamForm({
      name: team.name,
      code: team.code || "",
      department_id: team.department_id || "",
      branch_id: team.branch_id || "",
      company_id: team.company_id || companies[0]?.id || "",
      lead_employee_id: team.lead_employee_id || team.lead_user_id || "",
      member_employee_ids: team.member_employee_ids || [],
      description: team.description || "",
      status: team.status || "active"
    });
    setTeamModalOpen(true);
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTeam) {
        await teamsApi.update(editingTeam.id, teamForm);
        toast.success(`Team '${teamForm.name}' updated!`);
      } else {
        await teamsApi.create(teamForm);
        toast.success(`Team '${teamForm.name}' created!`);
      }
      setTeamModalOpen(false);
      await loadReferenceData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save team");
    }
  };

  const handleDeleteTeam = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete team '${name}'?`)) return;
    try {
      await teamsApi.delete(id);
      toast.success(`Team '${name}' deleted.`);
      await loadReferenceData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete team");
    }
  };

  // ─── Render: Departments Tab ─────────────────────────────────────
  if (tab === "departments") {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Multi-Organizational Departments</h2>
            <p className="text-xs text-muted-foreground">Manage organizational hierarchy, parent-child departments, and Department Heads (HODs).</p>
          </div>
          <Button onClick={handleOpenCreateDept} className="h-9 gradient-brand text-white border-0 font-semibold shadow-md">
            <Plus className="size-4 mr-1.5" /> Create Department
          </Button>
        </div>

        {loading && <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {departments.length === 0 ? (
              <div className="col-span-3 text-center py-16 bg-card border rounded-2xl p-6 text-muted-foreground">
                <Briefcase className="size-10 mx-auto mb-2 opacity-40 text-primary" />
                <p className="font-bold text-base text-foreground">No departments created yet</p>
                <p className="text-xs mt-1 mb-4">Create functional divisions (Engineering, HR, Sales, Operations) to group designations and employees.</p>
                <Button onClick={handleOpenCreateDept} size="sm" className="gradient-brand text-white border-0">
                  <Plus className="size-3.5 mr-1" /> Add First Department
                </Button>
              </div>
            ) : departments.map((dept, i) => {
              const comp = companies.find(c => c.id === dept.company_id);
              const branch = branches.find(b => b.id === dept.branch_id);
              const parentDept = departments.find(d => d.id === dept.parent_id);
              const hod = employees.find(e => e.id === dept.head_user_id || e.user_id === dept.head_user_id);
              const deptEmployees = employees.filter(e => e.department_id === dept.id);
              const childDepts = departments.filter(d => d.parent_id === dept.id);

              return (
                <motion.div key={dept.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="glass-panel p-6 rounded-2xl border hover:shadow-lg transition-all group bg-card flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="size-11 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-600 flex items-center justify-center font-bold text-base border border-indigo-500/30">
                          {dept.code || dept.name.slice(0, 3).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground text-base group-hover:text-primary transition-colors">{dept.name}</h3>
                          <span className="text-[11px] font-mono text-muted-foreground">{dept.code}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${dept.status === "active" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-muted text-muted-foreground"}`}>
                          {dept.status}
                        </span>
                      </div>
                    </div>

                    {dept.description && (
                      <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{dept.description}</p>
                    )}

                    <div className="space-y-2 text-xs bg-muted/30 p-3 rounded-xl border mb-4">
                      {parentDept && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Parent Dept:</span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded text-[11px]">
                            {parentDept.name}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Head of Dept (HOD):</span>
                        <span className="font-semibold text-foreground truncate max-w-[140px]">
                          {hod ? hod.full_name : "Not Assigned"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Staff Strength:</span>
                        <span className="font-bold text-foreground">{deptEmployees.length} Members</span>
                      </div>
                      {childDepts.length > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Sub-divisions:</span>
                          <span className="font-bold text-purple-600">{childDepts.length} Sub-departments</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center border-t border-border/50 pt-1.5">
                        <span className="text-muted-foreground">Company / Branch:</span>
                        <span className="font-semibold text-foreground truncate max-w-[140px]">
                          {comp ? comp.name : "HQ"} {branch ? `· ${branch.name}` : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t">
                    <span className="text-[11px] text-muted-foreground">ID: {dept.id.slice(0, 8)}...</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:bg-slate-100" onClick={() => handleOpenEditDept(dept)} title="Edit Department">
                        <Edit2 className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-50" onClick={() => handleDeleteDept(dept.id, dept.name)} title="Delete Department">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── Render: Designations Tab ────────────────────────────────────
  if (tab === "designations") {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Designations & Grade Scales</h2>
            <p className="text-xs text-muted-foreground">Standardized seniority levels, reporting designations, and job titles across departments.</p>
          </div>
          <Button onClick={handleOpenCreateDesig} className="h-9 gradient-brand text-white border-0 font-semibold shadow-md">
            <Plus className="size-4 mr-1.5" /> Create Designation
          </Button>
        </div>

        {loading && <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>}
        {!loading && (
          <div className="bg-card border rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Designation Title</th>
                    <th className="px-6 py-4">Code</th>
                    <th className="px-6 py-4">Seniority / Grade Level</th>
                    <th className="px-6 py-4">Department</th>
                    <th className="px-6 py-4">Reports To (Hierarchical)</th>
                    <th className="px-6 py-4 text-center">Active Employees</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30 font-medium">
                  {designations.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                        <Target className="size-8 mx-auto mb-2 opacity-40 text-primary" />
                        <p className="font-bold text-sm text-foreground">No designations created yet</p>
                        <p className="text-xs mt-1 mb-3">Define corporate titles, salary bands, and hierarchy levels.</p>
                        <Button onClick={handleOpenCreateDesig} size="sm" className="gradient-brand text-white border-0">
                          <Plus className="size-3.5 mr-1" /> Add First Designation
                        </Button>
                      </td>
                    </tr>
                  ) : designations.map((d) => {
                    const dept = departments.find(deptEl => deptEl.id === d.department_id);
                    const reportsToDesig = designations.find(desigEl => desigEl.id === d.reports_to_id);
                    const desigEmps = employees.filter(e => e.designation_id === d.id);

                    return (
                      <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-foreground text-sm">{d.name}</div>
                          {d.description && <div className="text-[11px] text-muted-foreground mt-0.5">{d.description}</div>}
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-slate-700">{d.code || "—"}</td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold">
                            {d.level || "L1 - Associate"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {dept ? (
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-semibold text-xs">
                              {dept.name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">All Departments</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {reportsToDesig ? (
                            <div className="flex items-center gap-1.5 font-bold text-purple-700 dark:text-purple-400">
                              <ArrowRight className="size-3 text-purple-400" />
                              {reportsToDesig.name}
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">Top-Level / Head</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-foreground">
                          {desigEmps.length}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${d.status === "active" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-muted text-muted-foreground"}`}>
                            {d.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:bg-slate-100" onClick={() => handleOpenEditDesig(d)} title="Edit Designation">
                              <Edit2 className="size-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-50" onClick={() => handleDeleteDesig(d.id, d.name)} title="Delete Designation">
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Render: Teams Tab ───────────────────────────────────────────
  if (tab === "teams") {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Functional Squads & Teams</h2>
            <p className="text-xs text-muted-foreground">Organize employees into cross-functional project squads, assign squad leads, and track team strength.</p>
          </div>
          <Button onClick={handleOpenCreateTeam} className="h-9 gradient-brand text-white border-0 font-semibold shadow-md">
            <Plus className="size-4 mr-1.5" /> Create Team
          </Button>
        </div>

        {loading && <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {teams.length === 0 ? (
              <div className="col-span-3 text-center py-16 bg-card border rounded-2xl p-6 text-muted-foreground">
                <Users className="size-10 mx-auto mb-2 opacity-40 text-primary" />
                <p className="font-bold text-base text-foreground">No functional teams created yet</p>
                <p className="text-xs mt-1 mb-4">Create project teams, assign team leads, and add squad members.</p>
                <Button onClick={handleOpenCreateTeam} size="sm" className="gradient-brand text-white border-0">
                  <Plus className="size-3.5 mr-1" /> Add First Team
                </Button>
              </div>
            ) : teams.map((team, i) => {
              const dept = departments.find(d => d.id === team.department_id);
              const lead = employees.find(e => e.id === team.lead_employee_id || e.id === team.lead_user_id || e.user_id === team.lead_user_id);
              const memberIds = team.member_employee_ids || [];
              const squadMembers = employees.filter(e => memberIds.includes(e.id));

              return (
                <motion.div key={team.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="glass-panel p-6 rounded-2xl border hover:shadow-lg transition-all group bg-card flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="size-11 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 text-purple-600 flex items-center justify-center font-bold text-base border border-purple-500/30">
                          {team.code || team.name.slice(0, 3).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground text-base group-hover:text-primary transition-colors">{team.name}</h3>
                          <span className="text-[11px] font-mono text-muted-foreground">{team.code || "SQUAD"}</span>
                        </div>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${team.status === "active" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-muted text-muted-foreground"}`}>
                        {team.status}
                      </span>
                    </div>

                    {team.description && (
                      <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{team.description}</p>
                    )}

                    <div className="space-y-2.5 text-xs bg-muted/30 p-3.5 rounded-xl border mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Department:</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded text-[11px]">
                          {dept ? dept.name : "Cross-Functional"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Team Lead:</span>
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          {lead ? (
                            <>
                              <div className="size-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[9px]">
                                {lead.full_name.charAt(0)}
                              </div>
                              {lead.full_name}
                            </>
                          ) : (
                            "Not Assigned"
                          )}
                        </span>
                      </div>
                      <div className="border-t border-border/50 pt-2">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-muted-foreground">Squad Members:</span>
                          <span className="font-bold text-foreground">{squadMembers.length} Members</span>
                        </div>
                        {squadMembers.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {squadMembers.slice(0, 4).map(m => (
                              <span key={m.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-background border rounded text-[10px] font-semibold text-foreground">
                                {m.full_name}
                              </span>
                            ))}
                            {squadMembers.length > 4 && (
                              <span className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-[10px] font-bold">
                                +{squadMembers.length - 4} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">No members assigned yet</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t">
                    <span className="text-[11px] text-muted-foreground">ID: {team.id.slice(0, 8)}...</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:bg-slate-100" onClick={() => handleOpenEditTeam(team)} title="Edit Team">
                        <Edit2 className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-50" onClick={() => handleDeleteTeam(team.id, team.name)} title="Delete Team">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── Render: Organization Chart (Hierarchy Visualizer) ───────────
  if (tab === "org_chart") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Interactive Organizational Hierarchy</h2>
          <p className="text-xs text-muted-foreground">Visual tree of departments, functional divisions, department heads, and reporting channels.</p>
        </div>

        <div className="space-y-6">
          {companies.map(comp => {
            const compDepts = departments.filter(d => d.company_id === comp.id || !d.company_id);
            const rootDepts = compDepts.filter(d => !d.parent_id);

            return (
              <Card key={comp.id} className="p-6 bg-card border rounded-2xl shadow-sm">
                <div className="flex items-center gap-3 border-b pb-4 mb-6">
                  <div className="size-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-md">
                    {comp.logo_initials || comp.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{comp.name}</h3>
                    <p className="text-xs text-muted-foreground">{compDepts.length} Departments · {employees.length} Total Employees</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {rootDepts.map(dept => {
                    const hod = employees.find(e => e.id === dept.head_user_id || e.user_id === dept.head_user_id);
                    const deptEmps = employees.filter(e => e.department_id === dept.id);
                    const subDepts = compDepts.filter(d => d.parent_id === dept.id);
                    const deptTeams = teams.filter(t => t.department_id === dept.id);

                    return (
                      <div key={dept.id} className="bg-muted/20 border border-border/80 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <div>
                            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Root Department</span>
                            <h4 className="font-bold text-base text-foreground">{dept.name}</h4>
                          </div>
                          <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-600 rounded text-[10px] font-bold">{dept.code}</span>
                        </div>

                        <div className="text-xs space-y-1">
                          <p className="text-muted-foreground flex justify-between">
                            <span>Head of Department:</span>
                            <span className="font-bold text-foreground">{hod ? hod.full_name : "Org Admin"}</span>
                          </p>
                          <p className="text-muted-foreground flex justify-between">
                            <span>Active Members:</span>
                            <span className="font-semibold text-foreground">{deptEmps.length} Employees</span>
                          </p>
                          {deptTeams.length > 0 && (
                            <p className="text-muted-foreground flex justify-between">
                              <span>Functional Squads:</span>
                              <span className="font-semibold text-purple-600">{deptTeams.length} Squads</span>
                            </p>
                          )}
                        </div>

                        {/* Nested Sub-Departments */}
                        {subDepts.length > 0 && (
                          <div className="mt-3 pt-3 border-t space-y-2">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Sub-divisions</span>
                            <div className="space-y-1.5 pl-2 border-l-2 border-indigo-400">
                              {subDepts.map(sub => (
                                <div key={sub.id} className="p-2 bg-background border rounded-lg text-xs flex justify-between items-center">
                                  <span className="font-semibold text-foreground">{sub.name}</span>
                                  <span className="text-[10px] text-muted-foreground font-mono">{sub.code}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Render: Documents Tab ───────────────────────────────────────
  if (tab === "documents") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Compliance Documents</h2>
          <p className="text-xs text-muted-foreground">Manage files, signed NDA contracts, and emergency cards.</p>
        </div>

        <div className="flex gap-4 items-end bg-card p-5 border rounded-xl">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase">Choose Employee Profile</label>
            <select value={selectedEmpIdForDocs} onChange={e => setSelectedEmpIdForDocs(e.target.value)}
              className="w-full h-10 px-3 text-sm rounded-md border bg-background">
              <option value="">-- Choose Employee --</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>)}
            </select>
          </div>
        </div>

        {selectedEmpIdForDocs && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="p-5 lg:col-span-1 h-fit">
              <h3 className="font-bold text-base mb-4 flex items-center gap-2"><Upload className="size-4 text-primary" /> Save Document</h3>
              <form onSubmit={handleSaveDoc} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Document Name</label>
                  <Input value={docName} onChange={e => setDocName(e.target.value)} placeholder="NDA Signed PDF" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Type</label>
                  <select value={docType} onChange={e => setDocType(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                    <option>Contract</option>
                    <option>ID Proof</option>
                    <option>NDA</option>
                    <option>Compliance</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">File Path</label>
                  <Input value={filePath} onChange={e => setFilePath(e.target.value)} placeholder="e.g. /uploads/docs/nda_EMP101.pdf" required />
                </div>
                <Button type="submit" className="w-full gradient-brand text-white border-0" disabled={addingDoc}>
                  {addingDoc ? <Loader2 className="size-4 animate-spin" /> : "Upload Document"}
                </Button>
              </form>
            </Card>

            <div className="lg:col-span-2">
              <Card className="p-5">
                <h3 className="font-bold text-base mb-4 flex items-center gap-2"><FileText className="size-4 text-primary" /> Active Files</h3>
                {loadingDocs ? (
                  <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-primary" /></div>
                ) : employeeDocuments.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic py-4">No documents uploaded for this employee yet.</p>
                ) : (
                  <div className="space-y-3">
                    {employeeDocuments.map(doc => {
                      const normalizedPath = doc.file_path.startsWith("http") || doc.file_path.startsWith("/")
                        ? doc.file_path
                        : `/${doc.file_path}`;
                      const isOfferLetter = doc.document_type === "Offer Letter" || doc.file_path.toLowerCase().includes("offer");
                      const isPayslip = doc.document_type === "Payslip" || doc.file_path.toLowerCase().includes("payslip");

                      return (
                        <div key={doc.id} className="flex justify-between items-center p-3 bg-muted/40 hover:bg-muted/60 transition-colors rounded-lg border">
                          <div className="flex items-center gap-3">
                            <FileText className="size-5 text-primary" />
                            <div>
                              <p className="text-sm font-semibold">{doc.document_name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">
                                Type: {doc.document_type} • Uploaded: {formatDate(doc.upload_date)}
                              </p>
                            </div>
                          </div>

                          {isOfferLetter ? (
                            <a
                              href={normalizedPath}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold gradient-brand text-white shadow hover:opacity-90 transition-all"
                            >
                              <Eye className="size-3.5" /> View & Print Offer
                            </a>
                          ) : isPayslip ? (
                            <a
                              href={normalizedPath}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-indigo-600 text-white shadow hover:bg-indigo-700 transition-all"
                            >
                              <Eye className="size-3.5" /> View & Print Payslip
                            </a>
                          ) : (
                            <a
                              href={normalizedPath}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                            >
                              View <ExternalLink className="size-3" />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Render: Employee Profile Tab ───────────────────────────────
  if (tab === "employee_profile") {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Employee Profile Cards</h2>
        <div className="flex gap-4 items-end bg-card p-5 border rounded-xl">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase">Choose Employee Profile</label>
            <select value={selectedEmpIdForDocs} onChange={e => setSelectedEmpIdForDocs(e.target.value)}
              className="w-full h-10 px-3 text-sm rounded-md border bg-background">
              <option value="">-- Choose Employee --</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>)}
            </select>
          </div>
        </div>

        {selectedEmpIdForDocs && (
          (() => {
            const emp = employees.find(e => e.id === selectedEmpIdForDocs);
            if (!emp) return null;
            const manager = employees.find(m => m.id === emp.manager_id);
            return (
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                className="glass-panel p-8 rounded-xl border max-w-2xl mx-auto shadow-md bg-card">
                <div className="flex items-start gap-6 mb-6">
                  <div className="size-20 rounded-2xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
                    {emp.full_name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-foreground">{emp.full_name}</h2>
                    <p className="text-primary font-medium">{designations.find(d => d.id === emp.designation_id)?.name || "Designation Not Set"}</p>
                    <p className="text-sm text-muted-foreground">Dept: {departments.find(d => d.id === emp.department_id)?.name || "Not Assigned"}</p>
                    <div className="flex gap-3 mt-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${empStatusStyle(emp.status)}`}>{emp.status}</span>
                      <span className="px-2.5 py-0.5 bg-secondary rounded-full text-xs font-medium">{emp.employment_type}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6 text-sm border-t pt-6">
                  <div><p className="text-muted-foreground text-xs uppercase font-bold">Employee ID</p><p className="font-semibold">{emp.employee_code}</p></div>
                  <div><p className="text-muted-foreground text-xs uppercase font-bold">Email</p><p className="font-semibold truncate">{emp.email}</p></div>
                  <div><p className="text-muted-foreground text-xs uppercase font-bold">Phone</p><p className="font-semibold">{emp.phone || "—"}</p></div>
                  <div><p className="text-muted-foreground text-xs uppercase font-bold">Joining Date</p><p className="font-semibold">{formatDate(emp.date_of_joining)}</p></div>
                  <div><p className="text-muted-foreground text-xs uppercase font-bold">Reporting Manager</p><p className="font-semibold text-primary">{manager ? manager.full_name : "Org Admin (No Manager)"}</p></div>
                  <div><p className="text-muted-foreground text-xs uppercase font-bold">Basic Salary</p><p className="font-semibold font-mono">{emp.basic_salary ? `$${emp.basic_salary.toLocaleString()}` : "—"}</p></div>
                </div>

                <div className="mt-6 pt-5 border-t flex justify-end gap-3">
                  <Button 
                    className="gradient-brand text-white font-bold shadow-md hover:shadow-lg transition-all border-0"
                    onClick={() => handleOpenVCard(emp)}
                  >
                    <QrCode className="size-4 mr-2" /> View Digital vCard & QR Pass
                  </Button>
                </div>
              </motion.div>
            );
          })()
        )}
      </div>
    );
  }

  // ─── Render: Employees Grid (Default) ────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Employee Management</h2>
          <p className="text-xs text-muted-foreground">{total} active employee directories linked to user login authentication.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-8 text-xs font-semibold border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 shadow-sm" onClick={handleBulkExportVCards}>
            <QrCode className="size-3.5 mr-1.5 text-indigo-500" /> Export All vCards
          </Button>
          <Button variant="outline" className="h-8 text-xs font-semibold" onClick={() => setBulkDialogOpen(true)}>
            Bulk Import CSV
          </Button>
          <Button className="h-8 text-xs font-semibold gradient-brand text-white border-0 animate-pulse-subtle" onClick={() => {
            setEditingEmployee(null);
            setFormData({
              employee_code: "",
              full_name: "",
              email: "",
              phone: "",
              employment_type: "Full-Time",
              status: "Active",
              basic_salary: "",
              punch_method: "GPS",
              nfc_card_number: "",
              company_id: companies[0]?.id || "",
              branch_id: "",
              department_id: "",
              designation_id: "",
              role_id: "",
              manager_id: "",
              date_of_joining: new Date().toISOString().split("T")[0]
            });
            setAddDialogOpen(true);
          }}>
            <Plus className="size-3.5 mr-1.5" /> Create Employee User
          </Button>
        </div>
      </div>

      {/* CREDENTIALS SUCCESS POPUP */}
      {successCredentials && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-start gap-4 shadow-lg">
          <div className="p-3 bg-emerald-500 text-white rounded-xl"><Key className="size-6 animate-spin-once" /></div>
          <div className="flex-1">
            <h4 className="font-bold text-emerald-800 dark:text-emerald-300 text-base">New Employee Login Created!</h4>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
              A corresponding platform account has been generated in User Management. Provide these login details to the employee:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 bg-background/50 p-3 rounded-lg border border-emerald-500/20 max-w-xl text-xs font-mono">
              <div><p className="text-muted-foreground uppercase text-[9px] font-sans font-bold">Email (Login ID)</p><p className="font-bold select-all truncate">{successCredentials.email}</p></div>
              <div><p className="text-muted-foreground uppercase text-[9px] font-sans font-bold">Employee Code</p><p className="font-bold select-all">{successCredentials.code}</p></div>
              <div>
                <p className="text-muted-foreground uppercase text-[9px] font-sans font-bold">Temporary Password</p>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-600 select-all">{successCredentials.tempPass}</span>
                  <button onClick={handleCopyPass} className="text-[10px] text-primary font-sans hover:underline flex items-center gap-1">
                    {copied ? <Check className="size-3 text-emerald-600" /> : <Clipboard className="size-3" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1.5 font-semibold">
              <ShieldAlert className="size-3.5" /> Forced password modification is enabled. The user must update their password on first login.
            </p>
          </div>
          <button onClick={() => setSuccessCredentials(null)} className="text-emerald-800 hover:text-emerald-950 font-bold text-sm">Dismiss</button>
        </motion.div>
      )}

      <div className="flex gap-4 bg-card p-4 rounded-xl border items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-background focus:outline-none"
            placeholder="Search directory..." />
        </div>
        <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(1); }}
          className="h-10 px-3 text-sm rounded-lg border bg-background">
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-10 px-3 text-sm rounded-lg border bg-background">
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="On Leave">On Leave</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {loading && <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>}
      {error && <div className="p-3 rounded-lg bg-red-500/10 text-red-600 text-sm border border-red-500/20">{error}</div>}

      {!loading && !error && (
        <div className="bg-card border rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-semibold tracking-wider">
                <tr>
                  <th className="px-6 py-4 text-left whitespace-nowrap">Employee</th>
                  <th className="px-6 py-4 text-left whitespace-nowrap">Code</th>
                  <th className="px-6 py-4 text-left whitespace-nowrap">Designation</th>
                  <th className="px-6 py-4 text-left whitespace-nowrap">Department</th>
                  <th className="px-6 py-4 text-left whitespace-nowrap">Email</th>
                  <th className="px-6 py-4 text-left whitespace-nowrap">Reporting Manager</th>
                  <th className="px-6 py-4 text-left whitespace-nowrap">Joined Date</th>
                  <th className="px-6 py-4 text-center whitespace-nowrap">Type</th>
                  <th className="px-6 py-4 text-center whitespace-nowrap">Status</th>
                  <th className="px-6 py-4 text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30 font-medium">
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-16 text-center text-muted-foreground">
                      <Users className="size-10 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold text-sm">No employees registered</p>
                      <p className="text-xs mt-0.5">Click "Create Employee User" to register employee profiles.</p>
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => {
                    const manager = employees.find(m => m.id === emp.manager_id);
                    return (
                      <tr key={emp.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-xl bg-purple-50 text-purple-700 font-bold flex items-center justify-center shrink-0 border border-purple-100">
                              {emp.full_name.split(" ").map(n => n[0]).join("")}
                            </div>
                            <div className="font-bold text-foreground text-sm">{emp.full_name}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-slate-700">{emp.employee_code}</td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-purple-700">
                            {designations.find(d => d.id === emp.designation_id)?.name || "—"}
                          </div>
                          {emp.role_name && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 mt-0.5">
                              <ShieldAlert className="size-2.5" /> {emp.role_name}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {departments.find(d => d.id === emp.department_id)?.name || "—"}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">{emp.email}</td>
                        <td className="px-6 py-4 text-slate-800 font-medium">
                          {manager ? manager.full_name : "Org Admin"}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">{formatDate(emp.date_of_joining)}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {emp.employment_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${empStatusStyle(emp.status)}`}>
                            {emp.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800"
                              onClick={() => {
                                setSelectedEmpForOffer(emp);
                                setOfferStudioOpen(true);
                              }}
                              title="Release / Re-issue Offer Letter"
                            >
                              <FileText className="size-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-purple-700 hover:bg-purple-50" onClick={() => handleOpenVCard(emp)} title="vCard & QR">
                              <QrCode className="size-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:bg-slate-100" onClick={() => openEditModal(emp)} title="Edit">
                              <Edit2 className="size-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-50" onClick={() => handleDeleteEmployee(emp.id)} title="Delete">
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── ADD/EDIT EMPLOYEE DIALOG ──────────────────────────────── */}
      {addDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto bg-card">
            <h3 className="text-lg font-bold mb-4">{editingEmployee ? "Edit" : "Create"} Employee User</h3>
            <form onSubmit={handleCreateEmployee} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Employee Code (Optional)</label>
                  <Input value={formData.employee_code} onChange={e => setFormData(p => ({ ...p, employee_code: e.target.value.toUpperCase() }))} placeholder="Leave blank for auto-gen" disabled={!!editingEmployee} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Full Name *</label>
                  <Input value={formData.full_name} onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))} placeholder="e.g. Aaron Smith" required />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Email Address *</label>
                  <Input type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} placeholder="e.g. aaron@company.com" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Phone Number</label>
                  <Input value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="e.g. +1 555-0199" />
                </div>
              </div>

              {/* Company & Branch Multi-Org Selectors */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Target Company *</label>
                  <select value={formData.company_id} onChange={e => setFormData(p => ({ ...p, company_id: e.target.value }))} className="w-full h-10 px-3 text-sm rounded-md border bg-background" required>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Branch Mapping</label>
                  <select value={formData.branch_id} onChange={e => setFormData(p => ({ ...p, branch_id: e.target.value }))} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                    <option value="">-- Choose Branch --</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Department</label>
                  <select value={formData.department_id} onChange={e => setFormData(p => ({ ...p, department_id: e.target.value }))} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                    <option value="">-- Choose Department --</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Designation</label>
                  <select value={formData.designation_id} onChange={e => setFormData(p => ({ ...p, designation_id: e.target.value }))} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                    <option value="">-- Choose Designation --</option>
                    {designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Core ERP System Role & RBAC Access Permissions */}
              <div className="space-y-1 bg-indigo-50/40 dark:bg-indigo-950/20 p-3 rounded-xl border border-indigo-200 dark:border-indigo-900/50">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase flex items-center gap-1.5">
                    <ShieldAlert className="size-3.5 text-indigo-600" /> Core ERP System Role & Permissions *
                  </label>
                  <span className="text-[10px] text-muted-foreground font-semibold">Defines system permissions</span>
                </div>
                <select
                  value={formData.role_id}
                  onChange={e => setFormData(p => ({ ...p, role_id: e.target.value }))}
                  className="w-full h-10 px-3 text-sm rounded-md border border-indigo-300 dark:border-indigo-800 bg-background font-semibold text-foreground focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">-- Standard Employee (ESS & Profile Access) --</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.description ? `— ${r.description}` : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  The user account linked to this employee will automatically inherit module access and action permissions configured in Core ERP Roles & Permissions.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Reporting Manager</label>
                  <select value={formData.manager_id} onChange={e => setFormData(p => ({ ...p, manager_id: e.target.value }))} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                    <option value="">-- No Reporting Manager (Org Admin) --</option>
                    {employees.filter(e => e.id !== editingEmployee?.id).map(empEl => (
                      <option key={empEl.id} value={empEl.id}>{empEl.full_name} ({empEl.employee_code})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Employment Type</label>
                  <select value={formData.employment_type} onChange={e => setFormData(p => ({ ...p, employment_type: e.target.value }))} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                    <option>Full-Time</option>
                    <option>Part-Time</option>
                    <option>Contract</option>
                    <option>Internship</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Status</label>
                  <select value={formData.status} onChange={e => setFormData(p => ({ ...p, status: e.target.value }))} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                    <option>Active</option>
                    <option>On Leave</option>
                    <option>Inactive</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Basic Salary (USD)</label>
                  <Input type="number" value={formData.basic_salary} onChange={e => setFormData(p => ({ ...p, basic_salary: e.target.value }))} placeholder="e.g. 85000" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">HR Authorized Punch Method</label>
                  <select value={formData.punch_method} onChange={e => setFormData(p => ({ ...p, punch_method: e.target.value }))} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                    <option value="GPS">GPS Geofencing (150m Office Perimeter)</option>
                    <option value="Biometric">Physical Hardware Biometric / Keycard</option>
                    <option value="Face">Facial Recognition AI Turnstile</option>
                    <option value="Web">Web Application 1-Click Punch</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">NFC Badge / Biometric ID (Optional)</label>
                  <Input value={formData.nfc_card_number} onChange={e => setFormData(p => ({ ...p, nfc_card_number: e.target.value }))} placeholder="e.g. NFC-99481" />
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Joining Date</label>
                <Input type="date" value={formData.date_of_joining} onChange={e => setFormData(p => ({ ...p, date_of_joining: e.target.value }))} />
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 gradient-brand text-white border-0">
                  {editingEmployee ? "Update Profile" : "Create Profile & User"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ─── BULK CSV DIALOG ───────────────────────────────────────── */}
      {bulkDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto bg-card">
            <h3 className="text-lg font-bold mb-4">Bulk Import Employees</h3>
            <div className="space-y-3 mb-4 text-xs text-muted-foreground">
              <p>Paste comma-separated values (CSV rows) below. Format:</p>
              <p className="font-mono bg-muted p-2 rounded">Full Name, Code, Email, Phone, JoiningDate, EmploymentType</p>
            </div>
            <textarea value={bulkInput} onChange={e => setBulkInput(e.target.value)} rows={6}
              className="w-full px-3 py-2 text-sm rounded-md border bg-background font-mono resize-none mb-4"
              placeholder="Paste CSV rows here..." />
            
            {bulkResult && (
              <div className={`p-4 rounded-lg text-xs mb-4 ${bulkResult.errors && bulkResult.errors.length > 0 ? "bg-amber-500/10 text-amber-700" : "bg-emerald-500/10 text-emerald-700"}`}>
                <p className="font-bold">{bulkResult.message}</p>
                <p>Imported: {bulkResult.created_count} • Skipped: {bulkResult.skipped_count}</p>
                {bulkResult.errors && bulkResult.errors.map((err, i) => (
                  <p key={i} className="text-red-500 mt-1">• {err}</p>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => { setBulkDialogOpen(false); setBulkResult(null); }}>Close</Button>
              <Button type="button" className="flex-1 gradient-brand text-white border-0" onClick={handleBulkImport}>
                Import Batch
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ─── DIGITAL VCARD & SMART QR BUSINESS CARD MODAL ─────────── */}
      {vCardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-md bg-card rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Modal Header / Branding Bar */}
            <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-primary p-5 text-white">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl">
                    <QrCode className="size-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base leading-tight">Digital Employee vCard</h3>
                    <p className="text-[11px] text-white/80 font-medium">Smart Contact & NFC Business Pass</p>
                  </div>
                </div>
                <button onClick={() => setVCardModalOpen(false)} 
                  className="size-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xs font-bold transition-colors">
                  ✕
                </button>
              </div>

              {/* Floating ID badge */}
              <div className="mt-4 flex items-center justify-between text-[11px] bg-black/20 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10">
                <span className="font-mono font-bold tracking-wider">{vCardData?.employee_code || selectedEmpForVCard?.employee_code || "EMP"}</span>
                <span className="flex items-center gap-1 text-emerald-300 font-semibold">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Verified Corporate ID
                </span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {loadingVCard ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">Generating vCard 3.0 & Scannable QR...</p>
                </div>
              ) : (
                <>
                  {/* Profile Header */}
                  <div className="flex items-center gap-4 pb-4 border-b">
                    <div className="size-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold shadow-md shrink-0">
                      {(vCardData?.full_name || selectedEmpForVCard?.full_name || "E").split(" ").map(n => n[0]).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-foreground text-lg truncate">{vCardData?.full_name || selectedEmpForVCard?.full_name}</h4>
                      <p className="text-xs text-primary font-semibold truncate">
                        {vCardData?.designation || designations.find(d => d.id === selectedEmpForVCard?.designation_id)?.name || "Corporate Staff"}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {vCardData?.department || departments.find(d => d.id === selectedEmpForVCard?.department_id)?.name || "Department"} · {vCardData?.company_name || "LazyMonkey AI"}
                      </p>
                    </div>
                  </div>

                  {/* QR Code Presentation Box */}
                  <div className="flex flex-col items-center justify-center p-4 bg-muted/40 rounded-xl border border-dashed border-indigo-500/30 text-center relative group">
                    <div className="bg-white p-3 rounded-xl shadow-md border border-slate-200">
                      {vCardData?.qr_code_data_url ? (
                        <img 
                          src={vCardData.qr_code_data_url} 
                          alt="Employee Contact vCard QR" 
                          className="size-44 object-contain rounded"
                        />
                      ) : (
                        <div className="size-44 flex items-center justify-center text-muted-foreground text-xs">
                          <QrCode className="size-12 opacity-30 animate-pulse" />
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-3 space-y-2 flex flex-col items-center">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-foreground flex items-center justify-center gap-1.5">
                          <Sparkles className="size-3.5 text-indigo-500" /> Instant Phone Contact Save
                        </p>
                        <p className="text-[11px] text-muted-foreground max-w-[260px] leading-relaxed">
                          Scan with your iPhone or Android camera to add <span className="font-semibold text-foreground">{vCardData?.full_name?.split(" ")[0]}</span> directly to your phone contacts.
                        </p>
                      </div>

                      {/* Quick QR Action Pills */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleDownloadQrImage}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 dark:text-indigo-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border border-indigo-200 dark:border-indigo-800 shadow-xs cursor-pointer"
                        >
                          <Download className="size-3.5" /> Download QR (PNG)
                        </button>
                        <button
                          type="button"
                          onClick={handleShareQrCode}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 dark:text-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border border-emerald-200 dark:border-emerald-800 shadow-xs cursor-pointer"
                        >
                          <Share2 className="size-3.5" /> Share QR
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Contact Summary Details */}
                  <div className="space-y-2 bg-card p-3.5 rounded-xl border text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Mail className="size-3.5 text-indigo-500" /> Work Email</span>
                      <a href={`mailto:${vCardData?.email || selectedEmpForVCard?.email}`} className="font-semibold text-foreground hover:text-primary transition-colors truncate max-w-[180px]">
                        {vCardData?.email || selectedEmpForVCard?.email}
                      </a>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Phone className="size-3.5 text-emerald-500" /> Mobile / Phone</span>
                      <span className="font-semibold text-foreground font-mono">
                        {vCardData?.phone || selectedEmpForVCard?.phone || "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Building className="size-3.5 text-purple-500" /> Organization</span>
                      <span className="font-semibold text-foreground">{vCardData?.company_name || "LazyMonkey AI"}</span>
                    </div>
                  </div>

                  {/* Actions Grid */}
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        className="h-10 gradient-brand text-white font-bold shadow-md hover:shadow-lg transition-all border-0 flex items-center justify-center gap-2 text-xs"
                        onClick={handleDownloadVCard}
                      >
                        <Download className="size-3.5" /> Save .VCF Contact
                      </Button>
                      <Button 
                        variant="outline" 
                        className="h-10 text-xs font-bold flex items-center justify-center gap-2 border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                        onClick={handleDownloadQrImage}
                      >
                        <QrCode className="size-3.5 text-indigo-600" /> Export QR Code
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-9 text-xs flex items-center justify-center gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                        onClick={handleShareQrCode}
                      >
                        <Share2 className="size-3.5" /> Share Pass
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-9 text-xs flex items-center justify-center gap-1"
                        onClick={handleCopyVCardContact}
                      >
                        {vcardCopied ? <Check className="size-3.5 text-emerald-600" /> : <Clipboard className="size-3.5" />}
                        {vcardCopied ? "Copied" : "Copy Info"}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-9 text-xs flex items-center justify-center gap-1"
                        onClick={handlePrintCard}
                      >
                        <Printer className="size-3.5" /> Print Pass
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Offer Letter Studio Modal for Existing Employees */}
      {offerStudioOpen && (
        <OfferLetterStudioModal
          open={offerStudioOpen}
          onClose={() => {
            setOfferStudioOpen(false);
            setSelectedEmpForOffer(null);
          }}
          applicants={[]}
          employees={employees}
          selectedEmployeeId={selectedEmpForOffer?.id}
          onOfferSent={() => {
            toast.success("Offer letter generated and saved to employee's document vault!");
            setOfferStudioOpen(false);
            setSelectedEmpForOffer(null);
          }}
          showNotification={(msg) => toast(msg)}
          handleSaveOfferDocument={async () => {
            toast.success("Document saved to employee vault.");
          }}
          handleSendOfferApi={async (payload) => {
            await recruitmentApi.createOffer({
              employee_id: payload.employee_id,
              applicant_id: payload.applicant_id,
              candidate: payload.candidate,
              candidate_email: payload.candidate_email,
              role: payload.role,
              ctc: payload.ctc,
              expiry_date: payload.expiry_date,
              joining_date: payload.joining_date,
              signer_name: `${payload.signing_authority} (${payload.signing_title})`,
              custom_template: JSON.stringify(payload)
            });
            toast.success(`Offer letter released and saved to ${payload.candidate}'s Document Vault!`);
            setOfferStudioOpen(false);
            setSelectedEmpForOffer(null);
          }}
        />
      )}

      {/* ─── DEPARTMENT CREATE / EDIT MODAL ───────────────────────── */}
      {deptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto bg-card space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2">
                <Briefcase className="size-5 text-primary" />
                <h3 className="text-lg font-bold text-foreground">{editingDept ? "Edit Department" : "Create New Department"}</h3>
              </div>
              <button onClick={() => setDeptModalOpen(false)} className="text-muted-foreground hover:text-foreground text-sm font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveDept} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Department Name *</label>
                  <Input value={deptForm.name} onChange={e => setDeptForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Engineering & Platform" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Dept Code *</label>
                  <Input value={deptForm.code} onChange={e => setDeptForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="e.g. ENG" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Company *</label>
                  <select value={deptForm.company_id} onChange={e => setDeptForm(p => ({ ...p, company_id: e.target.value }))} className="w-full h-10 px-3 text-sm rounded-md border bg-background" required>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Branch Mapping</label>
                  <select value={deptForm.branch_id} onChange={e => setDeptForm(p => ({ ...p, branch_id: e.target.value }))} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                    <option value="">-- All Branches / Global --</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Hierarchy: Parent Department */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Parent Department (Hierarchical Sub-division)</label>
                <select value={deptForm.parent_id} onChange={e => setDeptForm(p => ({ ...p, parent_id: e.target.value }))} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                  <option value="">-- None (Top-Level Division) --</option>
                  {departments.filter(d => d.id !== editingDept?.id).map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>

              {/* Department Head (HOD) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Head of Department (HOD)</label>
                <select value={deptForm.head_user_id} onChange={e => setDeptForm(p => ({ ...p, head_user_id: e.target.value }))} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                  <option value="">-- Assign HOD (Employee) --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.employee_code})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Description</label>
                <Input value={deptForm.description} onChange={e => setDeptForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief summary of department responsibilities" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Status</label>
                <select value={deptForm.status} onChange={e => setDeptForm(p => ({ ...p, status: e.target.value }))} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setDeptModalOpen(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 gradient-brand text-white border-0 font-semibold">
                  {editingDept ? "Update Department" : "Save Department"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ─── DESIGNATION CREATE / EDIT MODAL ──────────────────────── */}
      {desigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto bg-card space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2">
                <Target className="size-5 text-primary" />
                <h3 className="text-lg font-bold text-foreground">{editingDesig ? "Edit Designation" : "Create New Designation"}</h3>
              </div>
              <button onClick={() => setDesigModalOpen(false)} className="text-muted-foreground hover:text-foreground text-sm font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveDesig} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Job Title / Designation *</label>
                  <Input value={desigForm.name} onChange={e => setDesigForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Lead Software Architect" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Grade / Code</label>
                  <Input value={desigForm.code} onChange={e => setDesigForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="e.g. ENG-L5" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Seniority Grade Level</label>
                  <select value={desigForm.level} onChange={e => setDesigForm(p => ({ ...p, level: e.target.value }))} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                    <option value="L1 - Associate / Junior">L1 - Associate / Junior</option>
                    <option value="L2 - Mid-Level">L2 - Mid-Level</option>
                    <option value="L3 - Senior">L3 - Senior</option>
                    <option value="L4 - Staff / Lead">L4 - Staff / Lead</option>
                    <option value="L5 - Principal">L5 - Principal</option>
                    <option value="M1 - Manager / Lead">M1 - Manager / Lead</option>
                    <option value="M2 - Director / VP">M2 - Director / VP</option>
                    <option value="C1 - CXO / Executive">C1 - CXO / Executive</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Department Mapping</label>
                  <select value={desigForm.department_id} onChange={e => setDesigForm(p => ({ ...p, department_id: e.target.value }))} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                    <option value="">-- All Departments --</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Hierarchy: Reports To Designation */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Reporting Designation (Hierarchy Chain)</label>
                <select value={desigForm.reports_to_id} onChange={e => setDesigForm(p => ({ ...p, reports_to_id: e.target.value }))} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                  <option value="">-- Top-Level / Reports to CXO / Board --</option>
                  {designations.filter(d => d.id !== editingDesig?.id).map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.level || "Grade"})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Description</label>
                <Input value={desigForm.description} onChange={e => setDesigForm(p => ({ ...p, description: e.target.value }))} placeholder="Key responsibilities and qualifications" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Status</label>
                <select value={desigForm.status} onChange={e => setDesigForm(p => ({ ...p, status: e.target.value }))} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setDesigModalOpen(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 gradient-brand text-white border-0 font-semibold">
                  {editingDesig ? "Update Designation" : "Save Designation"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ─── TEAM CREATE / EDIT MODAL ─────────────────────────────── */}
      {teamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto bg-card space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2">
                <Users className="size-5 text-primary" />
                <h3 className="text-lg font-bold text-foreground">{editingTeam ? "Edit Team Squad" : "Create Functional Team Squad"}</h3>
              </div>
              <button onClick={() => setTeamModalOpen(false)} className="text-muted-foreground hover:text-foreground text-sm font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveTeam} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Team Name *</label>
                  <Input value={teamForm.name} onChange={e => setTeamForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Core Frontend Squad" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Team Code</label>
                  <Input value={teamForm.code} onChange={e => setTeamForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="e.g. FE-SQUAD" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Department Mapping *</label>
                  <select value={teamForm.department_id} onChange={e => setTeamForm(p => ({ ...p, department_id: e.target.value }))} className="w-full h-10 px-3 text-sm rounded-md border bg-background" required>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Team Lead / Manager</label>
                  <select value={teamForm.lead_employee_id} onChange={e => setTeamForm(p => ({ ...p, lead_employee_id: e.target.value }))} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                    <option value="">-- Assign Team Lead --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.employee_code})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Squad Members Multi-Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase flex items-center justify-between">
                  <span>Assign Squad Members</span>
                  <span className="text-[11px] text-primary font-semibold">{teamForm.member_employee_ids.length} selected</span>
                </label>
                <div className="border rounded-xl p-2.5 max-h-40 overflow-y-auto space-y-1 bg-muted/20">
                  {employees.map(emp => {
                    const isMember = teamForm.member_employee_ids.includes(emp.id);
                    return (
                      <div
                        key={emp.id}
                        onClick={() => {
                          setTeamForm(prev => ({
                            ...prev,
                            member_employee_ids: isMember
                              ? prev.member_employee_ids.filter(id => id !== emp.id)
                              : [...prev.member_employee_ids, emp.id]
                          }));
                        }}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${isMember ? "bg-primary/10 border border-primary/40 font-bold" : "hover:bg-muted"}`}
                      >
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={isMember} onChange={() => {}} className="accent-primary" />
                          <span>{emp.full_name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">({emp.employee_code})</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{designations.find(d => d.id === emp.designation_id)?.name || ""}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Description</label>
                <Input value={teamForm.description} onChange={e => setTeamForm(p => ({ ...p, description: e.target.value }))} placeholder="Squad project goals and mandates" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Status</label>
                <select value={teamForm.status} onChange={e => setTeamForm(p => ({ ...p, status: e.target.value }))} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setTeamModalOpen(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 gradient-brand text-white border-0 font-semibold">
                  {editingTeam ? "Update Team" : "Save Team"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
