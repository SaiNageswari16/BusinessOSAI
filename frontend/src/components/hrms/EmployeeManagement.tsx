import React from "react";
import { motion } from "framer-motion";
import { Plus, Search, Filter, Mail, Phone, MapPin, Users, Briefcase, Target, ArrowRight } from "lucide-react";
import { useHrmsData } from "@/hooks/useHrmsData";

interface Props { tab?: string; }

const empStatusStyle = (s: string) => {
  switch (s) {
    case "Active": return "bg-emerald-500/10 text-emerald-500";
    case "On Leave": return "bg-amber-500/10 text-amber-500";
    case "Inactive": return "bg-muted text-muted-foreground";
    default: return "bg-muted text-muted-foreground";
  }
};

export function EmployeeManagement({ tab = "employees" }: Props) {
  const { mockEmployees, mockDepartments, mockHrStats } = useHrmsData();

  if (tab === "departments") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Departments</h1><p className="text-sm text-muted-foreground">Manage organizational departments, budgets, and heads.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Add Department</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockDepartments.map((dept, i) => (
            <motion.div key={dept.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="glass-panel p-6 rounded-xl border border-border/50 hover:shadow-elegant transition-all duration-300 group cursor-pointer">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-primary/10 rounded-xl"><Briefcase className="size-5 text-primary" /></div>
                <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-xs font-medium">{dept.status}</span>
              </div>
              <h3 className="font-bold text-foreground text-lg mb-1 group-hover:text-primary transition-colors">{dept.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">Head: <span className="font-medium text-foreground">{dept.head}</span></p>
              <div className="grid grid-cols-2 gap-3 text-sm border-t border-border/50 pt-4">
                <div><p className="text-muted-foreground text-xs">Employees</p><p className="font-bold text-foreground">{dept.employees}</p></div>
                <div><p className="text-muted-foreground text-xs">Budget</p><p className="font-bold text-foreground">${(dept.budget / 1000).toFixed(0)}K</p></div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><MapPin className="size-3" />{dept.location}</p>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (tab === "designations") {
    const designations = [
      { title: "Chief Executive Officer", department: "Executive", level: "C-Suite", count: 1, minSalary: 280000, maxSalary: 400000 },
      { title: "Marketing Director", department: "Marketing", level: "Director", count: 1, minSalary: 110000, maxSalary: 140000 },
      { title: "Senior Sales Manager", department: "Sales", level: "Senior Manager", count: 3, minSalary: 85000, maxSalary: 110000 },
      { title: "Senior Software Engineer", department: "Engineering", level: "Senior IC", count: 8, minSalary: 120000, maxSalary: 160000 },
      { title: "HR Business Partner", department: "HR", level: "Mid-Level", count: 3, minSalary: 75000, maxSalary: 100000 },
      { title: "Operations Manager", department: "Operations", level: "Manager", count: 2, minSalary: 80000, maxSalary: 105000 },
      { title: "Financial Analyst", department: "Finance", level: "Mid-Level", count: 4, minSalary: 70000, maxSalary: 95000 },
      { title: "Account Executive", department: "Sales", level: "Mid-Level", count: 12, minSalary: 60000, maxSalary: 85000 },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Designations</h1><p className="text-sm text-muted-foreground">Job titles, levels, and salary bands across the organization.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Add Designation</button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Designation</th>
                  <th className="px-6 py-4 font-medium">Department</th>
                  <th className="px-6 py-4 font-medium">Level</th>
                  <th className="px-6 py-4 text-center font-medium">Headcount</th>
                  <th className="px-6 py-4 text-right font-medium">Salary Band</th>
                </tr>
              </thead>
              <tbody>
                {designations.map((d, i) => (
                  <motion.tr key={d.title} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-semibold text-foreground">{d.title}</td>
                    <td className="px-6 py-4 text-muted-foreground">{d.department}</td>
                    <td className="px-6 py-4"><span className="px-2 py-1 bg-secondary/50 rounded-md text-xs">{d.level}</span></td>
                    <td className="px-6 py-4 text-center font-bold text-foreground">{d.count}</td>
                    <td className="px-6 py-4 text-right text-muted-foreground">${(d.minSalary / 1000).toFixed(0)}K – ${(d.maxSalary / 1000).toFixed(0)}K</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (tab === "teams") {
    const teams = [
      { name: "Enterprise Sales", department: "Sales", lead: "James Thompson", members: 8, projects: 3 },
      { name: "Mid-Market Sales", department: "Sales", lead: "Emily Wang", members: 10, projects: 2 },
      { name: "Brand & Growth", department: "Marketing", lead: "Sarah Mitchell", members: 5, projects: 4 },
      { name: "Platform Engineering", department: "Engineering", lead: "Kevin Park", members: 10, projects: 5 },
      { name: "Product Design", department: "Engineering", lead: "Aisha Patel", members: 4, projects: 3 },
      { name: "Supply Chain", department: "Operations", lead: "Daniel Roberts", members: 12, projects: 2 },
      { name: "Warehouse", department: "Operations", lead: "Ravi Kumar", members: 18, projects: 1 },
      { name: "People & Culture", department: "HR", lead: "Priya Sharma", members: 6, projects: 2 },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Teams</h1><p className="text-sm text-muted-foreground">All functional and cross-functional teams across departments.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Create Team</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teams.map((team, i) => (
            <motion.div key={team.name} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="glass-panel p-5 rounded-xl border border-border/50 flex justify-between items-center hover:shadow-elegant transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-indigo-500/10 rounded-lg"><Users className="size-5 text-indigo-500" /></div>
                <div>
                  <h3 className="font-semibold text-foreground">{team.name}</h3>
                  <p className="text-xs text-muted-foreground">{team.department} · Lead: {team.lead}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-foreground">{team.members}</p>
                <p className="text-xs text-muted-foreground">members</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (tab === "documents") {
    const docs = [
      { id: "DOC-001", employee: "James Thompson", type: "Employment Contract", uploadDate: "2021-03-15", expiry: "N/A", status: "Valid" },
      { id: "DOC-002", employee: "Kevin Park", type: "NDA", uploadDate: "2022-01-10", expiry: "2027-01-10", status: "Valid" },
      { id: "DOC-003", employee: "Aisha Patel", type: "Contractor Agreement", uploadDate: "2024-01-15", expiry: "2025-01-14", status: "Expired" },
      { id: "DOC-004", employee: "Daniel Roberts", type: "ID Proof", uploadDate: "2019-05-01", expiry: "2028-03-20", status: "Valid" },
      { id: "DOC-005", employee: "Emily Wang", type: "Maternity Leave Approval", uploadDate: "2026-06-01", expiry: "N/A", status: "Valid" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Employee Documents</h1><p className="text-sm text-muted-foreground">Contracts, agreements, and compliance documents.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Upload Document</button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Doc ID</th>
                  <th className="px-6 py-4 font-medium">Employee</th>
                  <th className="px-6 py-4 font-medium">Document Type</th>
                  <th className="px-6 py-4 font-medium">Upload Date</th>
                  <th className="px-6 py-4 font-medium">Expiry</th>
                  <th className="px-6 py-4 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc, i) => (
                  <motion.tr key={doc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-primary">{doc.id}</td>
                    <td className="px-6 py-4 font-medium text-foreground">{doc.employee}</td>
                    <td className="px-6 py-4 text-muted-foreground">{doc.type}</td>
                    <td className="px-6 py-4 text-muted-foreground">{doc.uploadDate}</td>
                    <td className="px-6 py-4 text-muted-foreground">{doc.expiry}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${doc.status === "Valid" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>{doc.status}</span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (tab === "employee_profile") {
    const emp = mockEmployees[0];
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Employee Profile</h1>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-8 rounded-xl border border-border/50">
          <div className="flex items-start gap-6 mb-6">
            <div className="size-20 rounded-2xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-white text-2xl font-bold shadow-elegant">
              {emp.name.split(" ").map(n => n[0]).join("")}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-foreground">{emp.name}</h2>
              <p className="text-primary font-medium">{emp.designation}</p>
              <p className="text-sm text-muted-foreground">{emp.department} · {emp.team}</p>
              <div className="flex gap-3 mt-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${empStatusStyle(emp.status)}`}>{emp.status}</span>
                <span className="px-2 py-1 bg-secondary/50 rounded-full text-xs font-medium">{emp.employmentType}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-sm">
            {[
              { label: "Employee ID", value: emp.id },
              { label: "Email", value: emp.email },
              { label: "Phone", value: emp.phone },
              { label: "Join Date", value: emp.joinDate },
              { label: "Reports To", value: emp.manager },
              { label: "Location", value: emp.location },
            ].map(f => (
              <div key={f.label}><p className="text-muted-foreground text-xs mb-1">{f.label}</p><p className="font-medium text-foreground">{f.value}</p></div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  // Default: employees list
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground">{mockHrStats.totalEmployees} total · {mockHrStats.activeEmployees} active · {mockHrStats.newJoinees} new this month</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm border border-border/50 hover:bg-muted/80 transition-colors"><Filter className="size-4" /> Filter</button>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Add Employee</button>
        </div>
      </div>
      <div className="flex gap-4 glass-panel p-4 rounded-xl border border-border/50">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input type="text" placeholder="Search by name, ID, department..." className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border/50 rounded-lg text-sm focus:outline-none focus:border-primary/50 transition-colors" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockEmployees.map((emp, i) => (
          <motion.div key={emp.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="glass-panel p-5 rounded-xl border border-border/50 hover:shadow-elegant transition-all duration-300 group cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-gradient-to-br from-primary/80 to-purple-500/80 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {emp.name.split(" ").map(n => n[0]).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">{emp.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ml-2 ${empStatusStyle(emp.status)}`}>{emp.status}</span>
                </div>
                <p className="text-xs text-primary font-medium truncate">{emp.designation}</p>
                <p className="text-xs text-muted-foreground">{emp.department} · {emp.id}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border/50 space-y-1.5">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="size-3" />{emp.email}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><MapPin className="size-3" />{emp.location}</p>
              <p className="text-xs text-muted-foreground">Joined: {emp.joinDate} · <span className="text-foreground font-medium">{emp.employmentType}</span></p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
