import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import {
  hrmsApi,
  type EmployeeItem,
  type DepartmentItem,
  type DesignationItem,
  type TeamItem,
  type DocumentItem,
  type AttendanceRecord,
  type LeaveItem,
  type PayrollItem,
  type RecruitmentOverview,
  type PerformanceItem,
  type ExitItem,
} from '@/services/hrmsApi';

type HrmsCategory =
  | 'Employee Management'
  | 'Attendance'
  | 'Leave'
  | 'Payroll'
  | 'Recruitment'
  | 'Performance'
  | 'Exit Management';

export function HrmsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'employees';

  // State
  const [activeCategory, setActiveCategory] = useState<HrmsCategory>('Employee Management');
  const [activeSubTab, setActiveSubTab] = useState<string>(initialTab);

  // Data States
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [designations, setDesignations] = useState<DesignationItem[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [payroll, setPayroll] = useState<PayrollItem[]>([]);
  const [recruitment, setRecruitment] = useState<RecruitmentOverview | null>(null);
  const [performanceReviews, setPerformanceReviews] = useState<PerformanceItem[]>([]);
  const [exitRequests, setExitRequests] = useState<ExitItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All Departments');
  const [selectedStatus, setSelectedStatus] = useState('All Statuses');

  // Modals
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeItem | null>(null);
  const [selectedQrEmployee, setSelectedQrEmployee] = useState<EmployeeItem | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);

  // Form State for Employee
  const [empFormData, setEmpFormData] = useState({
    code: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    designation: '',
    department: '',
    reporting_manager: '',
    employment_type: 'Full-Time',
    status: 'Active',
    salary: 0,
    gym_branch: '',
  });

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Sync tab with URL
  useEffect(() => {
    if (initialTab) {
      setActiveSubTab(initialTab);
      if (['employees', 'departments', 'designations', 'teams', 'documents', 'profile'].includes(initialTab)) {
        setActiveCategory('Employee Management');
      } else if (initialTab === 'attendance') {
        setActiveCategory('Attendance');
      } else if (initialTab === 'leave') {
        setActiveCategory('Leave');
      } else if (initialTab === 'payroll') {
        setActiveCategory('Payroll');
      } else if (initialTab === 'recruitment') {
        setActiveCategory('Recruitment');
      } else if (initialTab === 'performance') {
        setActiveCategory('Performance');
      } else if (initialTab === 'exit') {
        setActiveCategory('Exit Management');
      }
    }
  }, [initialTab]);

  const switchTab = (cat: HrmsCategory, sub?: string) => {
    setActiveCategory(cat);
    const targetSub = sub || (
      cat === 'Employee Management' ? 'employees' :
      cat === 'Attendance' ? 'attendance' :
      cat === 'Leave' ? 'leave' :
      cat === 'Payroll' ? 'payroll' :
      cat === 'Recruitment' ? 'recruitment' :
      cat === 'Performance' ? 'performance' : 'exit'
    );
    setActiveSubTab(targetSub);
    setSearchParams({ tab: targetSub });
  };

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [empRes, deptRes, desgRes, teamRes, docRes] = await Promise.all([
        hrmsApi.getEmployees(),
        hrmsApi.getDepartments(),
        hrmsApi.getDesignations(),
        hrmsApi.getTeams(),
        hrmsApi.getDocuments(),
      ]);
      setEmployees(empRes || []);
      setDepartments(deptRes || []);
      setDesignations(desgRes || []);
      setTeams(teamRes || []);
      setDocuments(docRes || []);

      // Fetch supplementary modules
      const [attRes, leaveRes, payRes, recRes, perfRes, exitRes] = await Promise.all([
        hrmsApi.getAttendance(),
        hrmsApi.getLeaves(),
        hrmsApi.getPayroll(),
        hrmsApi.getRecruitment(),
        hrmsApi.getPerformance(),
        hrmsApi.getExitRequests(),
      ]);
      setAttendanceLogs(attRes || []);
      setLeaves(leaveRes || []);
      setPayroll(payRes || []);
      setRecruitment(recRes || null);
      setPerformanceReviews(perfRes || []);
      setExitRequests(exitRes || []);
    } catch (err) {
      console.error('Error fetching HRMS data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered Employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      const matchesSearch =
        !searchQuery ||
        e.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.designation.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept =
        selectedDepartment === 'All Departments' || e.department === selectedDepartment;
      const matchesStatus =
        selectedStatus === 'All Statuses' || e.status.toLowerCase() === selectedStatus.toLowerCase();
      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [employees, searchQuery, selectedDepartment, selectedStatus]);

  // Export vCards
  const handleExportVcards = () => {
    if (filteredEmployees.length === 0) {
      triggerToast('No employees available to export.');
      return;
    }
    let vCardContent = '';
    filteredEmployees.forEach((emp) => {
      vCardContent += `BEGIN:VCARD\nVERSION:3.0\nN:${emp.last_name};${emp.first_name};;;\nFN:${emp.full_name}\nTITLE:${emp.designation}\nEMAIL;TYPE=INTERNET,WORK:${emp.email}\nTEL;TYPE=CELL:${emp.phone}\nNOTE:Employee Code: ${emp.code} | Dept: ${emp.department}\nEND:VCARD\n\n`;
    });
    const blob = new Blob([vCardContent], { type: 'text/vcard;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `employees_${new Date().toISOString().slice(0, 10)}.vcf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast('📇 Exported employee contacts to vCard format.');
  };

  // Handle Save Employee
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEmployee) {
        await hrmsApi.updateEmployee(editingEmployee.id, empFormData);
        triggerToast(`Updated employee ${empFormData.first_name}.`);
      } else {
        await hrmsApi.createEmployee(empFormData);
        triggerToast(`Created employee ${empFormData.first_name}.`);
      }
      setIsEmployeeModalOpen(false);
      setEditingEmployee(null);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to save employee');
    }
  };

  // Handle Delete Employee
  const handleDeleteEmployee = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove employee "${name}" from the directory?`)) {
      try {
        await hrmsApi.deleteEmployee(id);
        triggerToast(`Removed ${name} from HRMS.`);
        fetchData();
      } catch (err) {
        alert('Failed to delete employee');
      }
    }
  };

  // Open Edit Employee
  const handleOpenEdit = (emp: EmployeeItem) => {
    setEditingEmployee(emp);
    setEmpFormData({
      code: emp.code,
      first_name: emp.first_name,
      last_name: emp.last_name,
      email: emp.email,
      phone: emp.phone,
      designation: emp.designation,
      department: emp.department,
      reporting_manager: emp.reporting_manager,
      employment_type: emp.employment_type,
      status: emp.status,
      salary: emp.salary,
      gym_branch: emp.gym_branch,
    });
    setIsEmployeeModalOpen(true);
  };

  // Open Create Employee
  const handleOpenCreate = () => {
    setEditingEmployee(null);
    setEmpFormData({
      code: '',
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      designation: designations.length > 0 ? designations[0].title : '',
      department: departments.length > 0 ? departments[0].name : '',
      reporting_manager: '',
      employment_type: 'Full-Time',
      status: 'Active',
      salary: 0,
      gym_branch: '',
    });
    setIsEmployeeModalOpen(true);
  };

  // Handle CSV Bulk Upload
  const handleCsvImport = async () => {
    if (!csvFile) {
      alert('Please select a CSV file to import.');
      return;
    }
    setCsvLoading(true);
    try {
      const text = await csvFile.text();
      const lines = text.split('\n').filter((l) => l.trim() !== '');
      if (lines.length <= 1) {
        alert('CSV file is empty or missing data rows.');
        setCsvLoading(false);
        return;
      }
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      let successCount = 0;
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',').map((c) => c.trim());
        if (row.length === 0) continue;
        const record: Record<string, any> = {};
        headers.forEach((h, idx) => {
          record[h] = row[idx] || '';
        });
        if (record['first_name'] || record['name'] || record['email']) {
          await hrmsApi.createEmployee({
            code: record['code'] || '',
            first_name: record['first_name'] || record['name'] || 'Staff',
            last_name: record['last_name'] || '',
            email: record['email'] || '',
            phone: record['phone'] || '',
            designation: record['designation'] || '',
            department: record['department'] || '',
            reporting_manager: record['reporting_manager'] || '',
            employment_type: record['employment_type'] || 'Full-Time',
            status: record['status'] || 'Active',
            salary: parseFloat(record['salary']) || 0,
          });
          successCount++;
        }
      }
      setIsCsvModalOpen(false);
      setCsvFile(null);
      triggerToast(`Imported ${successCount} employee record(s) from CSV.`);
      fetchData();
    } catch (err: any) {
      alert('Error parsing CSV file: ' + err.message);
    } finally {
      setCsvLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-navy-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-brand-500/30 animate-fade-in">
          <Icon name="check-circle" size={16} className="text-brand-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. TOP HRMS CATEGORY NAVIGATION BAR                           */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-navy-100 rounded-2xl p-2 shadow-sm overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {[
            { id: 'Employee Management', label: 'Employee Management', icon: 'users' },
            { id: 'Attendance', label: 'Attendance', icon: 'clock' },
            { id: 'Leave', label: 'Leave', icon: 'calendar' },
            { id: 'Payroll', label: 'Payroll', icon: 'credit-card' },
            { id: 'Recruitment', label: 'Recruitment', icon: 'briefcase' },
            { id: 'Performance', label: 'Performance', icon: 'target' },
            { id: 'Exit Management', label: 'Exit Management', icon: 'log-out' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => switchTab(cat.id as HrmsCategory)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeCategory === cat.id
                  ? 'bg-purple-50 text-purple-700 border border-purple-200/80 shadow-sm'
                  : 'text-navy-600 hover:text-navy-900 hover:bg-navy-50'
              }`}
            >
              <Icon name={cat.icon} size={15} className={activeCategory === cat.id ? 'text-purple-600' : 'text-navy-400'} />
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. SUB-PILLS (Under Employee Management)                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeCategory === 'Employee Management' && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'employees', label: 'Employees', icon: 'users' },
            { id: 'departments', label: 'Departments', icon: 'building-2' },
            { id: 'designations', label: 'Designations', icon: 'award' },
            { id: 'teams', label: 'Teams', icon: 'users-2' },
            { id: 'documents', label: 'Documents', icon: 'file-text' },
          ].map((sub) => (
            <button
              key={sub.id}
              onClick={() => {
                setActiveSubTab(sub.id);
                setSearchParams({ tab: sub.id });
              }}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeSubTab === sub.id
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'bg-white hover:bg-navy-50 text-navy-600 border border-navy-200/60'
              }`}
            >
              <Icon name={sub.icon} size={14} />
              <span>{sub.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. VIEW: EMPLOYEES DIRECTORY                                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeCategory === 'Employee Management' && activeSubTab === 'employees' && (
        <div className="space-y-5 animate-fade-in">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-navy-900 tracking-tight">Employee Management</h1>
              <p className="text-xs text-navy-500 font-medium">
                {employees.length} active employee directories linked to user login authentication & biometric gates.
              </p>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={handleExportVcards}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-navy-50 text-purple-600 border border-purple-200 transition flex items-center gap-1.5 shadow-sm"
              >
                <Icon name="share-2" size={14} /> Export All vCards
              </button>
              <button
                onClick={() => setIsCsvModalOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-navy-50 text-navy-700 border border-navy-200 transition flex items-center gap-1.5 shadow-sm"
              >
                <Icon name="upload" size={14} /> Bulk Import CSV
              </button>
              <button
                onClick={handleOpenCreate}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition flex items-center gap-1.5 shadow-md shadow-purple-600/20"
              >
                <Icon name="plus" size={15} /> Create Employee User
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-3 rounded-2xl border border-navy-100 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Icon name="search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-400" />
              <input
                type="text"
                placeholder="Search directory..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-navy-50/60 border border-navy-100 text-xs text-navy-900 focus:outline-none focus:border-purple-500 transition"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-3.5 py-2 rounded-xl bg-navy-50/60 border border-navy-100 text-xs font-medium text-navy-700 focus:outline-none focus:border-purple-500"
              >
                <option value="All Departments">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3.5 py-2 rounded-xl bg-navy-50/60 border border-navy-100 text-xs font-medium text-navy-700 focus:outline-none focus:border-purple-500"
              >
                <option value="All Statuses">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="On Leave">On Leave</option>
              </select>
            </div>
          </div>

          {/* Directory Table */}
          <div className="bg-white border border-navy-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-navy-50/50 text-[11px] font-black uppercase text-navy-500 tracking-wider border-b border-navy-100">
                  <tr>
                    <th className="py-3.5 px-4">EMPLOYEE</th>
                    <th className="py-3.5 px-4">CODE</th>
                    <th className="py-3.5 px-4">DESIGNATION</th>
                    <th className="py-3.5 px-4">DEPARTMENT</th>
                    <th className="py-3.5 px-4">EMAIL</th>
                    <th className="py-3.5 px-4">REPORTING MANAGER</th>
                    <th className="py-3.5 px-4">JOINED DATE</th>
                    <th className="py-3.5 px-4">TYPE</th>
                    <th className="py-3.5 px-4">STATUS</th>
                    <th className="py-3.5 px-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50 font-medium text-navy-800">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-navy-400">
                        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        Loading employee directory...
                      </td>
                    </tr>
                  ) : filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-navy-400 font-bold">
                        No employees found. Click "+ Create Employee User" to add your first employee.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-navy-50/40 transition-colors">
                        {/* Employee Column */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-black text-xs shrink-0 border border-purple-200">
                              {emp.initials}
                            </div>
                            <span className="font-bold text-navy-900 leading-tight block uppercase">
                              {emp.full_name}
                            </span>
                          </div>
                        </td>

                        {/* Code */}
                        <td className="py-3.5 px-4 font-mono font-bold text-navy-700">
                          {emp.code}
                        </td>

                        {/* Designation */}
                        <td className="py-3.5 px-4 font-bold text-purple-700 max-w-[180px]">
                          {emp.designation || '--'}
                        </td>

                        {/* Department */}
                        <td className="py-3.5 px-4 text-navy-600">
                          {emp.department || '--'}
                        </td>

                        {/* Email */}
                        <td className="py-3.5 px-4 text-navy-500 font-mono text-[11px]">
                          {emp.email}
                        </td>

                        {/* Reporting Manager */}
                        <td className="py-3.5 px-4 text-navy-700 font-semibold">
                          {emp.reporting_manager || '--'}
                        </td>

                        {/* Joined Date */}
                        <td className="py-3.5 px-4 text-navy-500 font-mono text-[11px]">
                          {emp.joined_date || '--'}
                        </td>

                        {/* Employment Type Badge */}
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-navy-100 text-navy-700">
                            {emp.employment_type}
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              emp.status.toLowerCase() === 'active'
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
                                : 'bg-navy-100 text-navy-500 border border-navy-200/60'
                            }`}
                          >
                            {emp.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setSelectedQrEmployee(emp)}
                              title="View Smart ID Badge"
                              className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 transition"
                            >
                              <Icon name="qr-code" size={15} />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(emp)}
                              title="Edit Employee"
                              className="p-1.5 rounded-lg text-navy-600 hover:bg-navy-100 transition"
                            >
                              <Icon name="edit-3" size={15} />
                            </button>
                            <button
                              onClick={() => handleDeleteEmployee(emp.id, emp.full_name)}
                              title="Delete Employee"
                              className="p-1.5 rounded-lg text-danger-500 hover:bg-danger-50 transition"
                            >
                              <Icon name="trash-2" size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. VIEW: DEPARTMENTS                                          */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeCategory === 'Employee Management' && activeSubTab === 'departments' && (
        <div className="space-y-5 animate-fade-in">
          <div>
            <h2 className="text-xl font-black text-navy-900 tracking-tight">Gym Departments</h2>
            <p className="text-xs text-navy-500">Organizational units across gym floor, management, and fitness coaching.</p>
          </div>

          {departments.length === 0 ? (
            <div className="card p-12 text-center text-navy-400 bg-white border border-navy-100 rounded-2xl">
              No departments configured yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {departments.map((dept) => (
                <div key={dept.id} className="card p-5 bg-white border border-navy-100 rounded-2xl shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-50 text-purple-700 font-mono">
                      {dept.code || 'DEPT'}
                    </span>
                    <span className="text-xs font-bold text-navy-600 flex items-center gap-1">
                      <Icon name="users" size={13} /> {dept.employee_count} Members
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-navy-900">{dept.name}</h4>
                  <p className="text-xs text-navy-500 leading-snug">{dept.description || 'Department unit'}</p>
                  {dept.head_name && (
                    <div className="pt-2 border-t border-navy-50 flex items-center justify-between text-xs">
                      <span className="text-navy-400">Head:</span>
                      <span className="font-bold text-navy-800">{dept.head_name}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. VIEW: DESIGNATIONS                                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeCategory === 'Employee Management' && activeSubTab === 'designations' && (
        <div className="space-y-5 animate-fade-in">
          <div>
            <h2 className="text-xl font-black text-navy-900 tracking-tight">Roles & Designations</h2>
            <p className="text-xs text-navy-500">Graded career tracks for coaches, managers, and administrative staff.</p>
          </div>

          {designations.length === 0 ? (
            <div className="card p-12 text-center text-navy-400 bg-white border border-navy-100 rounded-2xl">
              No designations configured yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {designations.map((desg) => (
                <div key={desg.id} className="card p-5 bg-white border border-navy-100 rounded-2xl shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    {desg.level && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-navy-100 text-navy-700">
                        {desg.level}
                      </span>
                    )}
                    <span className="text-xs font-bold text-navy-600">{desg.employee_count} Assigned</span>
                  </div>
                  <h4 className="text-sm font-bold text-purple-700">{desg.title}</h4>
                  <p className="text-xs text-navy-500">{desg.department}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 6. VIEW: TEAMS                                                */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeCategory === 'Employee Management' && activeSubTab === 'teams' && (
        <div className="space-y-5 animate-fade-in">
          <div>
            <h2 className="text-xl font-black text-navy-900 tracking-tight">Functional Teams</h2>
            <p className="text-xs text-navy-500">Operational units collaborating across specialized fitness tracks.</p>
          </div>

          {teams.length === 0 ? (
            <div className="card p-12 text-center text-navy-400 bg-white border border-navy-100 rounded-2xl">
              No teams created yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map((team) => (
                <div key={team.id} className="card p-5 bg-white border border-navy-100 rounded-2xl shadow-sm space-y-3">
                  <h4 className="text-sm font-bold text-navy-900">{team.name}</h4>
                  <p className="text-xs text-navy-500 leading-snug">{team.description || team.department}</p>
                  {team.lead_name && (
                    <div className="pt-2 border-t border-navy-50 flex items-center justify-between text-xs">
                      <span className="text-navy-400">Team Lead:</span>
                      <span className="font-bold text-purple-700">{team.lead_name}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 7. VIEW: DOCUMENTS                                            */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeCategory === 'Employee Management' && activeSubTab === 'documents' && (
        <div className="space-y-5 animate-fade-in">
          <div>
            <h2 className="text-xl font-black text-navy-900 tracking-tight">Employee Documents</h2>
            <p className="text-xs text-navy-500">Verified KYC identity proofs, trainer certifications, and contracts.</p>
          </div>

          <div className="bg-white border border-navy-100 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-50/50 text-[11px] font-black uppercase text-navy-500 tracking-wider border-b border-navy-100">
                <tr>
                  <th className="py-3.5 px-4">DOCUMENT TITLE</th>
                  <th className="py-3.5 px-4">EMPLOYEE</th>
                  <th className="py-3.5 px-4">TYPE</th>
                  <th className="py-3.5 px-4">FILE SIZE</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-4">UPLOADED DATE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50 font-medium text-navy-800">
                {documents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-navy-400 font-bold">
                      No documents uploaded yet.
                    </td>
                  </tr>
                ) : (
                  documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-navy-50/40">
                      <td className="py-3.5 px-4 font-bold text-navy-900 flex items-center gap-2">
                        <Icon name="file-text" size={15} className="text-purple-600 shrink-0" />
                        {doc.title}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-purple-700">{doc.employee_name || '--'}</td>
                      <td className="py-3.5 px-4">{doc.doc_type || '--'}</td>
                      <td className="py-3.5 px-4 font-mono text-navy-500">{doc.file_size || '--'}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          {doc.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-navy-500">{doc.uploaded_at || '--'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 8. VIEW: ATTENDANCE (Module 2)                                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeCategory === 'Attendance' && (
        <div className="space-y-5 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-navy-900 tracking-tight">Staff Daily Attendance</h2>
              <p className="text-xs text-navy-500">Live biometric punch-in logs and shift hours tracking.</p>
            </div>
          </div>

          <div className="bg-white border border-navy-100 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-50/50 text-[11px] font-black uppercase text-navy-500 tracking-wider border-b border-navy-100">
                <tr>
                  <th className="py-3.5 px-4">EMPLOYEE</th>
                  <th className="py-3.5 px-4">CODE</th>
                  <th className="py-3.5 px-4">DESIGNATION</th>
                  <th className="py-3.5 px-4">DATE</th>
                  <th className="py-3.5 px-4">CHECK-IN</th>
                  <th className="py-3.5 px-4">CHECK-OUT</th>
                  <th className="py-3.5 px-4">HOURS</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-4">NOTES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50 font-medium text-navy-800">
                {attendanceLogs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-navy-400 font-bold">
                      No attendance records for today.
                    </td>
                  </tr>
                ) : (
                  attendanceLogs.map((att) => (
                    <tr key={att.id} className="hover:bg-navy-50/40">
                      <td className="py-3.5 px-4 font-bold text-navy-900">{att.employee_name}</td>
                      <td className="py-3.5 px-4 font-mono font-bold">{att.employee_code}</td>
                      <td className="py-3.5 px-4 text-purple-700 font-semibold">{att.designation || '--'}</td>
                      <td className="py-3.5 px-4 font-mono">{att.date}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">{att.check_in}</td>
                      <td className="py-3.5 px-4 font-mono text-navy-600">{att.check_out}</td>
                      <td className="py-3.5 px-4 font-bold">{att.work_hours} hrs</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            att.status === 'Present'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {att.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-navy-500 text-[11px]">{att.notes || '--'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 9. VIEW: LEAVE MANAGEMENT (Module 3)                          */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeCategory === 'Leave' && (
        <div className="space-y-5 animate-fade-in">
          <div>
            <h2 className="text-xl font-black text-navy-900 tracking-tight">Leave Management</h2>
            <p className="text-xs text-navy-500">Employee leave requests, approvals, and annual tracking.</p>
          </div>

          <div className="bg-white border border-navy-100 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-50/50 text-[11px] font-black uppercase text-navy-500 tracking-wider border-b border-navy-100">
                <tr>
                  <th className="py-3.5 px-4">EMPLOYEE</th>
                  <th className="py-3.5 px-4">LEAVE TYPE</th>
                  <th className="py-3.5 px-4">DURATION</th>
                  <th className="py-3.5 px-4">DAYS</th>
                  <th className="py-3.5 px-4">REASON</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50 font-medium text-navy-800">
                {leaves.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-navy-400 font-bold">
                      No leave applications found.
                    </td>
                  </tr>
                ) : (
                  leaves.map((l) => (
                    <tr key={l.id} className="hover:bg-navy-50/40">
                      <td className="py-3.5 px-4 font-bold text-navy-900">{l.employee_name}</td>
                      <td className="py-3.5 px-4 font-bold text-purple-700">{l.leave_type}</td>
                      <td className="py-3.5 px-4 font-mono">{l.start_date} → {l.end_date}</td>
                      <td className="py-3.5 px-4 font-bold">{l.days} Day(s)</td>
                      <td className="py-3.5 px-4 text-navy-600 max-w-xs">{l.reason || '--'}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            l.status === 'Approved'
                              ? 'bg-emerald-50 text-emerald-700'
                              : l.status === 'Pending'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {l.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {l.status === 'Pending' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={async () => {
                                await hrmsApi.updateLeaveStatus(l.id, { status: 'Approved' });
                                triggerToast(`Approved leave for ${l.employee_name}`);
                                fetchData();
                              }}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition"
                            >
                              Approve
                            </button>
                            <button
                              onClick={async () => {
                                await hrmsApi.updateLeaveStatus(l.id, { status: 'Rejected' });
                                triggerToast(`Rejected leave for ${l.employee_name}`);
                                fetchData();
                              }}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 transition"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-navy-400 text-xs">{l.approved_by || 'Reviewed'}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 10. VIEW: PAYROLL (Module 4)                                   */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeCategory === 'Payroll' && (
        <div className="space-y-5 animate-fade-in">
          <div>
            <h2 className="text-xl font-black text-navy-900 tracking-tight">Staff Payroll & Disbursements</h2>
            <p className="text-xs text-navy-500">Monthly base salary, allowances, deductions, and net payouts.</p>
          </div>

          <div className="bg-white border border-navy-100 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-50/50 text-[11px] font-black uppercase text-navy-500 tracking-wider border-b border-navy-100">
                <tr>
                  <th className="py-3.5 px-4">EMPLOYEE</th>
                  <th className="py-3.5 px-4">MONTH / YEAR</th>
                  <th className="py-3.5 px-4">BASE SALARY</th>
                  <th className="py-3.5 px-4">ALLOWANCES</th>
                  <th className="py-3.5 px-4">DEDUCTIONS</th>
                  <th className="py-3.5 px-4">NET SALARY</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50 font-medium text-navy-800">
                {payroll.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-navy-400 font-bold">
                      No payroll records generated yet.
                    </td>
                  </tr>
                ) : (
                  payroll.map((p) => (
                    <tr key={p.id} className="hover:bg-navy-50/40">
                      <td className="py-3.5 px-4 font-bold text-navy-900">
                        <div>{p.employee_name}</div>
                        <div className="text-[10px] text-navy-400 font-normal">{p.designation}</div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-purple-700">{p.month} {p.year}</td>
                      <td className="py-3.5 px-4 font-mono font-bold">₹{p.base_salary.toLocaleString()}</td>
                      <td className="py-3.5 px-4 font-mono text-emerald-600">+₹{p.allowances.toLocaleString()}</td>
                      <td className="py-3.5 px-4 font-mono text-rose-600">-₹{p.deductions.toLocaleString()}</td>
                      <td className="py-3.5 px-4 font-mono font-black text-navy-900">₹{p.net_salary.toLocaleString()}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.status === 'Paid'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {p.status !== 'Paid' ? (
                          <button
                            onClick={async () => {
                              await hrmsApi.processPayout(p.id, { status: 'Paid' });
                              triggerToast(`Processed payout for ${p.employee_name}`);
                              fetchData();
                            }}
                            className="px-3 py-1 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition shadow-sm"
                          >
                            Disburse
                          </button>
                        ) : (
                          <span className="text-emerald-700 text-xs font-bold flex items-center justify-end gap-1">
                            <Icon name="check-circle" size={13} /> {p.payment_date}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 11. VIEW: RECRUITMENT (Module 5)                              */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeCategory === 'Recruitment' && (
        <div className="space-y-6 animate-fade-in">
          <div>
            <h2 className="text-xl font-black text-navy-900 tracking-tight">Gym Hiring & Recruitment Pipeline</h2>
            <p className="text-xs text-navy-500">Track trainer vacancies and candidate screening stages.</p>
          </div>

          {(recruitment?.jobs || []).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recruitment?.jobs.map((job) => (
                <div key={job.id} className="card p-5 bg-white border border-navy-100 rounded-2xl shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700">
                      {job.department}
                    </span>
                    <span className="text-xs font-bold text-emerald-600">{job.openings} Openings</span>
                  </div>
                  <h4 className="text-base font-bold text-navy-900">{job.title}</h4>
                  {job.salary_range && <div className="text-xs text-navy-600 font-mono font-medium">{job.salary_range}</div>}
                  <div className="pt-2 border-t border-navy-50 flex items-center justify-between text-xs text-navy-500">
                    <span>Experience: {job.experience || '--'}</span>
                    <span className="font-bold text-purple-700">{job.applicant_count} Candidates Applied</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h3 className="text-sm font-black uppercase tracking-wider text-navy-900">Active Candidates Pipeline</h3>
          <div className="bg-white border border-navy-100 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-50/50 text-[11px] font-black uppercase text-navy-500 tracking-wider border-b border-navy-100">
                <tr>
                  <th className="py-3.5 px-4">CANDIDATE NAME</th>
                  <th className="py-3.5 px-4">APPLIED ROLE</th>
                  <th className="py-3.5 px-4">EXPERIENCE</th>
                  <th className="py-3.5 px-4">RATING</th>
                  <th className="py-3.5 px-4">CURRENT STAGE</th>
                  <th className="py-3.5 px-4 text-right">STAGE ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50 font-medium text-navy-800">
                {(recruitment?.applicants || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-navy-400 font-bold">
                      No active applicants in the recruitment pipeline.
                    </td>
                  </tr>
                ) : (
                  recruitment?.applicants.map((app) => (
                    <tr key={app.id} className="hover:bg-navy-50/40">
                      <td className="py-3.5 px-4 font-bold text-navy-900">{app.name}</td>
                      <td className="py-3.5 px-4 font-semibold text-purple-700">{app.job_title}</td>
                      <td className="py-3.5 px-4 font-bold">{app.experience_years} Years</td>
                      <td className="py-3.5 px-4 font-bold text-amber-600 flex items-center gap-1">
                        <Icon name="star" size={13} className="fill-amber-400 text-amber-400" /> {app.rating} / 5.0
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200/60">
                          {app.stage}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <select
                          value={app.stage}
                          onChange={async (e) => {
                            await hrmsApi.updateApplicantStage(app.id, e.target.value);
                            triggerToast(`Moved ${app.name} to ${e.target.value}`);
                            fetchData();
                          }}
                          className="px-2 py-1 rounded-lg bg-navy-50 border border-navy-200 text-xs font-bold text-navy-700 focus:outline-none"
                        >
                          <option value="Applied">Applied</option>
                          <option value="Screening">Screening</option>
                          <option value="Interview">Interview</option>
                          <option value="Offered">Offered</option>
                          <option value="Hired">Hired</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 12. VIEW: PERFORMANCE (Module 6)                              */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeCategory === 'Performance' && (
        <div className="space-y-5 animate-fade-in">
          <div>
            <h2 className="text-xl font-black text-navy-900 tracking-tight">Staff & Trainer Performance Appraisals</h2>
            <p className="text-xs text-navy-500">Quarterly KPI evaluations, client retention ratios, and member reviews.</p>
          </div>

          {performanceReviews.length === 0 ? (
            <div className="card p-12 text-center text-navy-400 bg-white border border-navy-100 rounded-2xl">
              No performance appraisals recorded yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {performanceReviews.map((perf) => (
                <div key={perf.id} className="card p-5 bg-white border border-navy-100 rounded-2xl shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-navy-900">{perf.employee_name}</h4>
                      <span className="text-xs text-purple-700 font-semibold">{perf.designation}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-emerald-600">{perf.score} / 5.0</div>
                      <span className="text-[10px] font-bold text-navy-400 uppercase">{perf.review_period}</span>
                    </div>
                  </div>

                  {perf.kpi_ratings && perf.kpi_ratings.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-navy-50">
                      {perf.kpi_ratings.map((kpi, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="text-navy-600">{kpi.kpi}</span>
                          <span className="font-bold text-navy-900 font-mono">
                            {kpi.achieved} (Target: {kpi.target})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {perf.feedback && (
                    <p className="text-xs text-navy-500 italic bg-navy-50 p-2.5 rounded-xl border border-navy-100">
                      "{perf.feedback}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 13. VIEW: EXIT MANAGEMENT (Module 9)                          */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeCategory === 'Exit Management' && (
        <div className="space-y-5 animate-fade-in">
          <div>
            <h2 className="text-xl font-black text-navy-900 tracking-tight">Exit Management & Handover</h2>
            <p className="text-xs text-navy-500">Employee resignations, equipment handover checklists, and final clearance.</p>
          </div>

          <div className="bg-white border border-navy-100 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-50/50 text-[11px] font-black uppercase text-navy-500 tracking-wider border-b border-navy-100">
                <tr>
                  <th className="py-3.5 px-4">EMPLOYEE</th>
                  <th className="py-3.5 px-4">RESIGNATION DATE</th>
                  <th className="py-3.5 px-4">LAST WORKING DAY</th>
                  <th className="py-3.5 px-4">REASON</th>
                  <th className="py-3.5 px-4">HANDOVER</th>
                  <th className="py-3.5 px-4">SETTLEMENT</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50 font-medium text-navy-800">
                {exitRequests.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-navy-400 font-bold">
                      No exit requests logged.
                    </td>
                  </tr>
                ) : (
                  exitRequests.map((x) => (
                    <tr key={x.id} className="hover:bg-navy-50/40">
                      <td className="py-3.5 px-4 font-bold text-navy-900">{x.employee_name}</td>
                      <td className="py-3.5 px-4 font-mono">{x.resignation_date}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-purple-700">{x.last_working_day}</td>
                      <td className="py-3.5 px-4 text-navy-600 max-w-xs">{x.reason || '--'}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700">
                          {x.handover_status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-navy-100 text-navy-700">
                          {x.settlement_status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700">
                          {x.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={async () => {
                            await hrmsApi.updateExitStatus(x.id, {
                              status: 'Completed',
                              handover_status: 'Completed',
                              settlement_status: 'Cleared',
                            });
                            triggerToast(`Completed clearance and settlement for ${x.employee_name}`);
                            fetchData();
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition"
                        >
                          Clear Settlement
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 14. MODAL: CREATE / EDIT EMPLOYEE USER                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-navy-100 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-navy-100">
              <h3 className="text-base font-bold text-navy-900">
                {editingEmployee ? `Edit Employee (${editingEmployee.code})` : 'Create New Employee User'}
              </h3>
              <button
                onClick={() => setIsEmployeeModalOpen(false)}
                className="p-1 rounded-lg hover:bg-navy-100 text-navy-400"
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-navy-600 font-bold mb-1">Emp Code</label>
                  <input
                    type="text"
                    placeholder="e.g. 001"
                    value={empFormData.code}
                    onChange={(e) => setEmpFormData({ ...empFormData, code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-navy-50 border border-navy-200 text-navy-900 font-mono font-bold focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-navy-600 font-bold mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={empFormData.first_name}
                    onChange={(e) => setEmpFormData({ ...empFormData, first_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-navy-50 border border-navy-200 text-navy-900 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-navy-600 font-bold mb-1">Last Name</label>
                  <input
                    type="text"
                    value={empFormData.last_name}
                    onChange={(e) => setEmpFormData({ ...empFormData, last_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-navy-50 border border-navy-200 text-navy-900 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-navy-600 font-bold mb-1">Work Email *</label>
                  <input
                    type="email"
                    required
                    value={empFormData.email}
                    onChange={(e) => setEmpFormData({ ...empFormData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-navy-50 border border-navy-200 text-navy-900 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-navy-600 font-bold mb-1">Phone</label>
                  <input
                    type="text"
                    value={empFormData.phone}
                    onChange={(e) => setEmpFormData({ ...empFormData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-navy-50 border border-navy-200 text-navy-900 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-navy-600 font-bold mb-1">Designation</label>
                  <input
                    type="text"
                    value={empFormData.designation}
                    onChange={(e) => setEmpFormData({ ...empFormData, designation: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-navy-50 border border-navy-200 text-navy-900 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-navy-600 font-bold mb-1">Department</label>
                  <input
                    type="text"
                    value={empFormData.department}
                    onChange={(e) => setEmpFormData({ ...empFormData, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-navy-50 border border-navy-200 text-navy-900 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-navy-600 font-bold mb-1">Employment Type</label>
                  <select
                    value={empFormData.employment_type}
                    onChange={(e) => setEmpFormData({ ...empFormData, employment_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-navy-50 border border-navy-200 text-navy-900 focus:outline-none focus:border-purple-500"
                  >
                    <option value="Full-Time">Full-Time</option>
                    <option value="Part-Time">Part-Time</option>
                    <option value="Contract">Contract</option>
                    <option value="Intern">Intern</option>
                  </select>
                </div>
                <div>
                  <label className="block text-navy-600 font-bold mb-1">Status</label>
                  <select
                    value={empFormData.status}
                    onChange={(e) => setEmpFormData({ ...empFormData, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-navy-50 border border-navy-200 text-navy-900 focus:outline-none focus:border-purple-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="On Leave">On Leave</option>
                  </select>
                </div>
                <div>
                  <label className="block text-navy-600 font-bold mb-1">Monthly Salary (₹)</label>
                  <input
                    type="number"
                    value={empFormData.salary}
                    onChange={(e) => setEmpFormData({ ...empFormData, salary: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-navy-50 border border-navy-200 text-navy-900 font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-navy-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEmployeeModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-navy-600 hover:bg-navy-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition shadow-md shadow-purple-600/20"
                >
                  {editingEmployee ? 'Save Changes' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 15. MODAL: QR & SMART ID BADGE PREVIEW                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      {selectedQrEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-navy-100 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full">
                SMART ID BADGE
              </span>
              <button
                onClick={() => setSelectedQrEmployee(null)}
                className="p-1 rounded-lg hover:bg-navy-100 text-navy-400"
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-black text-2xl mx-auto shadow-lg shadow-purple-600/30">
              {selectedQrEmployee.initials}
            </div>

            <div>
              <h3 className="text-lg font-black text-navy-900 uppercase tracking-tight">
                {selectedQrEmployee.full_name}
              </h3>
              <p className="text-xs font-bold text-purple-700">{selectedQrEmployee.designation || '--'}</p>
              <p className="text-[11px] text-navy-400">{selectedQrEmployee.department || '--'}</p>
            </div>

            {/* Smart QR SVG representation */}
            <div className="p-4 bg-navy-50 rounded-2xl border border-navy-100 inline-block mx-auto">
              <div className="w-40 h-40 bg-white p-2 rounded-xl shadow-inner flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full text-navy-900 fill-current">
                  <path d="M10 10h30v30h-30zM15 15v20h20v-20zM22 22h6v6h-6zM60 10h30v30h-30zM65 15v20h20v-20zM72 22h6v6h-6zM10 60h30v30h-30zM15 65v20h20v-20zM22 72h6v6h-6zM55 55h10v10h-10zM75 55h15v10h-15zM55 75h10v15h-10zM75 75h15v15h-15zM65 65h10v10h-10z" />
                </svg>
              </div>
              <div className="text-[11px] font-mono font-bold text-navy-600 mt-2">
                EMP ID: #{selectedQrEmployee.code}
              </div>
            </div>

            <button
              onClick={() => {
                triggerToast(`Printing ID Badge for ${selectedQrEmployee.full_name}`);
                setSelectedQrEmployee(null);
              }}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-md shadow-purple-600/20"
            >
              Print Badge
            </button>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 16. MODAL: BULK CSV IMPORT                                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-navy-100 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-navy-100">
              <h3 className="text-base font-bold text-navy-900">Bulk Import Employees (CSV)</h3>
              <button
                onClick={() => setIsCsvModalOpen(false)}
                className="p-1 rounded-lg hover:bg-navy-100 text-navy-400"
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            <div className="border-2 border-dashed border-purple-200 bg-purple-50/50 rounded-2xl p-6 text-center space-y-3">
              <Icon name="upload-cloud" size={32} className="text-purple-600 mx-auto" />
              <div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setCsvFile(e.target.files[0]);
                    }
                  }}
                  className="text-xs text-navy-600 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200"
                />
              </div>
              <p className="text-[11px] text-navy-500">Supported columns: Code, First_Name, Last_Name, Email, Phone, Designation, Department, Salary</p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsCsvModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-navy-600 hover:bg-navy-50 transition"
              >
                Cancel
              </button>
              <button
                disabled={csvLoading || !csvFile}
                onClick={handleCsvImport}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white transition shadow-sm flex items-center gap-1.5"
              >
                {csvLoading ? 'Importing...' : 'Upload & Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
