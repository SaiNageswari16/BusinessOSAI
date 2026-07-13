import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Filter, Mail, Phone, MapPin, Users, User, Briefcase, Target, Edit2, Trash2, Loader2, Star, Upload, FileText, CheckCircle, AlertTriangle, ArrowRight, ShieldAlert, Key, Clipboard, Check } from "lucide-react";
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
  EmployeeDocument
} from "../../lib/api-client";
import { Card } from "../ui/card";
const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString();
};

import { Button } from "../ui/button";
import { Input } from "../ui/input";

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

  // ─── Render: Departments Tab ─────────────────────────────────────
  if (tab === "departments") {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Multi-Organizational Departments</h1>
          <p className="text-sm text-muted-foreground">Manage departments mapped across parent companies and regional branches.</p>
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
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Designations & Grade Scales</h1>
          <p className="text-sm text-muted-foreground">Standardized seniority levels and designation models.</p>
        </div>
        {loading && <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>}
        {!loading && (
          <div className="glass-panel rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b">
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
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Functional Teams</h1>
          <p className="text-sm text-muted-foreground">Functional project squads mapped across branches.</p>
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
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Compliance Documents</h1>
          <p className="text-sm text-muted-foreground">Manage files, signed NDA contracts, and emergency cards.</p>
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
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Employee Profile Cards</h1>
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
              </motion.div>
            );
          })()
        )}
      </div>
    );
  }

  // ─── Render: Employees Grid (Default) ────────────────────────────
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employee Management</h1>
          <p className="text-sm text-muted-foreground">{total} active employee directories linked to user login authentication.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkDialogOpen(true)}>
            Bulk Import CSV
          </Button>
          <Button className="gradient-brand text-white border-0 animate-pulse-subtle" onClick={() => { setEditingEmployee(null); setAddDialogOpen(true); }}>
            <Plus className="size-4 mr-2" /> Create Employee User
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
                  <div className="size-12 rounded-xl bg-gradient-to-br from-primary/80 to-purple-500/80 flex items-center justify-center text-white font-bold text-sm shrink-0">
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
                
                <div className="flex justify-end gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="outline" size="sm" onClick={() => openEditModal(emp)}>
                    <Edit2 className="size-3 mr-1" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleDeleteEmployee(emp.id)}>
                    <Trash2 className="size-3" />
                  </Button>
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
    </div>
  );
}
