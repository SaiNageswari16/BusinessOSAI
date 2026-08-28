import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Filter, Mail, Phone, MapPin, Users, User, Briefcase, Target, Edit2, Trash2, Loader2, Star, Upload, FileText, CheckCircle, AlertTriangle, ArrowRight, ShieldAlert, Key, Clipboard, Check, QrCode, Download, Share2, Printer, ExternalLink, Building, Sparkles } from "lucide-react";
import {
  employeesApi,
  departmentsApi,
  designationsApi,
  teamsApi,
  companiesApi,
  branchesApi,
  Employee,
  Department,
  Designation,
  Team,
  Company,
  Branch,
  EmployeeDocument,
  EmployeeVCard
} from "../../lib/api-client";
import { Card } from "../ui/card";
const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString();
};

import { Button } from "../ui/button";
import { Input } from "../ui/input";
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
    company_id: "",
    branch_id: "",
    department_id: "",
    designation_id: "",
    manager_id: "",
    date_of_joining: new Date().toISOString().split("T")[0]
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
      loadEmployees();
    } catch (err: any) {
      setError(err.message || "Delete failed");
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
      company_id: emp.company_id ?? (companies[0]?.id || ""),
      branch_id: emp.branch_id ?? "",
      department_id: emp.department_id ?? "",
      designation_id: emp.designation_id ?? "",
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
    window.URL.revokeObjectURL(url);
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
    const company = vCardData?.company_name || companies[0]?.name || "LazyMonkey AI";
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
              <div class="header-left">
                <h1>${company}</h1>
                <p>Official Digital Employee Identity Pass & Credential Verification</p>
              </div>
              <div class="header-right">
                <span class="badge-org">Verified Corporate Staff</span>
                <div style="font-size: 7.5pt; color: #64748b; margin-top: 4px;">Issued: ${new Date().toLocaleDateString("en-IN", { dateStyle: "medium" })}</div>
              </div>
            </div>

            <div class="card-wrapper">
              <div class="id-badge">
                <div class="badge-top">
                  <h3>${company}</h3>
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

  // ─── Render: Departments Tab ─────────────────────────────────────
  if (tab === "departments") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Multi-Organizational Departments</h2>
          <p className="text-xs text-muted-foreground">Manage departments mapped across parent companies and regional branches.</p>
        </div>
        {loading && <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {departments.length === 0 ? (
              <div className="col-span-3 text-center py-12 text-muted-foreground">No departments configured yet.</div>
            ) : departments.map((dept, i) => {
              const comp = companies.find(c => c.id === dept.company_id);
              const branch = branches.find(b => b.id === dept.branch_id);
              return (
                <motion.div key={dept.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="glass-panel p-6 rounded-xl border hover:shadow-md transition-shadow group bg-card">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-primary/10 rounded-xl"><Briefcase className="size-5 text-primary" /></div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${dept.status === "active" ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>{dept.status}</span>
                  </div>
                  <h3 className="font-bold text-foreground text-lg mb-1">{dept.name}</h3>
                  <p className="text-xs font-mono text-muted-foreground mb-4">Code: {dept.code}</p>
                  
                  <div className="space-y-1.5 text-xs border-t pt-4">
                    <p className="text-muted-foreground flex justify-between"><span>Company:</span> <span className="font-semibold text-foreground truncate max-w-[150px]">{comp ? comp.name : "Parent Org"}</span></p>
                    <p className="text-muted-foreground flex justify-between"><span>Branch Mapping:</span> <span className="font-semibold text-foreground truncate max-w-[150px]">{branch ? branch.name : "HQ Branch"}</span></p>
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
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Designations & Grade Scales</h2>
          <p className="text-xs text-muted-foreground">Standardized seniority levels and designation models.</p>
        </div>
        {loading && <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>}
        {!loading && (
          <div className="glass-panel rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-4">Designation Name</th>
                    <th className="px-6 py-4">Level Mapping</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {designations.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-muted-foreground">No designations configured yet.</td>
                    </tr>
                  ) : designations.map((d, i) => (
                    <tr key={d.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-4 font-semibold text-foreground">{d.name}</td>
                      <td className="px-6 py-4"><span className="px-2 py-1 bg-secondary rounded text-xs">{d.level || "Grade Band"}</span></td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${d.status === "active" ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>{d.status}</span>
                      </td>
                    </tr>
                  ))}
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
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Functional Teams</h2>
          <p className="text-xs text-muted-foreground">Functional project squads mapped across branches.</p>
        </div>
        {loading && <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teams.length === 0 ? (
              <div className="col-span-2 text-center py-12 text-muted-foreground">No teams configured yet.</div>
            ) : teams.map((team, i) => (
              <div key={team.id} className="glass-panel p-5 rounded-xl border flex justify-between items-center hover:shadow-sm bg-card">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-indigo-500/10 rounded-lg"><Users className="size-5 text-indigo-500" /></div>
                  <div>
                    <h3 className="font-semibold text-foreground">{team.name}</h3>
                    <p className="text-xs text-muted-foreground">Manager ID: {team.lead_user_id ? String(team.lead_user_id).slice(0, 8) + "..." : "Not Assigned"}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${team.status === "active" ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>{team.status}</span>
              </div>
            ))}
          </div>
        )}
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
                    {employeeDocuments.map(doc => (
                      <div key={doc.id} className="flex justify-between items-center p-3 bg-muted/40 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <FileText className="size-5 text-primary" />
                          <div>
                            <p className="text-sm font-semibold">{doc.document_name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">Type: {doc.document_type} • Uploaded: {formatDate(doc.upload_date)}</p>
                          </div>
                        </div>
                        <a href={doc.file_path} target="_blank" rel="noreferrer" className="text-xs text-primary font-bold hover:underline">View</a>
                      </div>
                    ))}
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
          <Button className="h-8 text-xs font-semibold gradient-brand text-white border-0 animate-pulse-subtle" onClick={() => { setEditingEmployee(null); setAddDialogOpen(true); }}>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {employees.length === 0 ? (
            <div className="col-span-3 text-center py-16 text-muted-foreground">
              <Users className="size-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No employees registered</p>
              <p className="text-sm">Click "Create Employee User" to register employee profiles.</p>
            </div>
          ) : employees.map((emp, i) => {
            const manager = employees.find(m => m.id === emp.manager_id);
            return (
              <motion.div key={emp.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="glass-panel p-5 rounded-xl border hover:shadow-md transition-shadow bg-card group relative">
                <div className="flex items-start gap-4">
                  <div className="size-12 rounded-xl bg-gradient-to-br from-primary/80 to-purple-500/80 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm">
                    {emp.full_name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold text-foreground truncate leading-tight">{emp.full_name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ml-2 ${empStatusStyle(emp.status)}`}>{emp.status}</span>
                    </div>
                    <p className="text-xs text-primary font-medium truncate mt-0.5">{designations.find(d => d.id === emp.designation_id)?.name || "Designation Not Set"}</p>
                    <p className="text-[10px] text-muted-foreground">{departments.find(d => d.id === emp.department_id)?.name || "Dept Not Assigned"} · {emp.employee_code}</p>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t space-y-1.5 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5 truncate"><Mail className="size-3.5 shrink-0" /> {emp.email}</p>
                  <p className="flex items-center gap-1.5"><User className="size-3.5 shrink-0" /> Reporting Manager: <span className="font-semibold text-foreground truncate">{manager ? manager.full_name : "Org Admin"}</span></p>
                  <p className="flex justify-between items-center text-[10px] text-muted-foreground pt-1">
                    <span>Joined: {formatDate(emp.date_of_joining)}</span>
                    <span className="font-bold text-foreground bg-secondary px-1.5 py-0.5 rounded">{emp.employment_type}</span>
                  </p>
                </div>
                
                <div className="flex justify-between items-center mt-4 pt-3 border-t">
                  <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs text-indigo-600 dark:text-indigo-400 border-indigo-500/30 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-medium" onClick={() => handleOpenVCard(emp)}>
                    <QrCode className="size-3.5 mr-1.5 text-indigo-500" /> vCard & QR
                  </Button>
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={() => openEditModal(emp)}>
                      <Edit2 className="size-3 mr-1" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => handleDeleteEmployee(emp.id)}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
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
    </div>
  );
}
