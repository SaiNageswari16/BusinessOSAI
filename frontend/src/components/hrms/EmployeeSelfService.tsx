import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { 
  FileText, CreditCard, Clock, Calendar, Bell, CheckSquare, Loader2, 
  MapPin, Fingerprint, Camera, User, QrCode, Download, Share2, Printer, 
  Clipboard, Check, Sparkles, Building, Mail, Phone, Award, Star, 
  BookOpen, GraduationCap, Target, TrendingUp, CheckCircle2, Play, 
  ArrowUpRight, Plus, Trash2, Radio, ShieldCheck, ExternalLink, XCircle 
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useTenant } from "@/contexts/tenant-context";
import { employeesApi, attendanceApi, leavesApi, payrollApi, Employee, AttendanceRecord, EmployeeDocument, LeaveRequest, LeaveBalance, Payslip, EmployeeVCard } from "../../lib/api-client";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useCurrency } from "@/hooks/use-currency";

const formatDate = (dateStr: string | null | undefined, options?: Intl.DateTimeFormatOptions) => {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString(undefined, options);
};

const formatTime = (dateStr: string | null | undefined) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

interface Props { tab?: string; }

const attStatusStyle = (s: string) => {
  switch (s?.toLowerCase()) {
    case "present": return "bg-emerald-500/10 text-emerald-500";
    case "late": return "bg-amber-500/10 text-amber-500";
    case "absent": return "bg-red-500/10 text-red-500";
    case "half day": return "bg-blue-500/10 text-blue-500";
    case "on leave": return "bg-purple-500/10 text-purple-500";
    default: return "bg-muted text-muted-foreground";
  }
};

export function EmployeeSelfService({ tab = "ess_attendance" }: Props) {
  const { currency, formatCurrency } = useCurrency();
  const { user } = useAuth();
  const { tenant } = useTenant();
  
  const [emp, setEmp] = useState<Employee | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  
  // My Leaves & Payroll states
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);
  const [myBalances, setMyBalances] = useState<LeaveBalance[]>([]);
  const [myPayslips, setMyPayslips] = useState<Payslip[]>([]);

  // HR Assigned Punch Mode for this employee ("GPS" | "Biometric" | "Face" | "Web")
  const [assignedPunchMethod, setAssignedPunchMethod] = useState<"GPS" | "Biometric" | "Face" | "Web">("GPS");

  // Apply Leave form states
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaveType, setLeaveType] = useState("Annual");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [daysRequested, setDaysRequested] = useState("1");
  const [reason, setReason] = useState("");
  
  // vCard & QR Smart Business Pass State
  const [vCardModalOpen, setVCardModalOpen] = useState(false);
  const [vCardData, setVCardData] = useState<EmployeeVCard | null>(null);
  const [loadingVCard, setLoadingVCard] = useState(false);
  const [vcardCopied, setVcardCopied] = useState(false);

  // Certificate Modal State
  const [certificateModalOpen, setCertificateModalOpen] = useState(false);
  const [selectedCourseForCert, setSelectedCourseForCert] = useState<any>(null);

  // Interactive Tasks State
  const [tasksList, setTasksList] = useState([
    { id: "task-1", task: "Complete Q3 Information Security & ISO Compliance", due: "2026-08-30", priority: "High", category: "Compliance", done: false },
    { id: "task-2", task: "Review & Sign Annual Remote Work Policy Addendum", due: "2026-09-02", priority: "Medium", category: "HR Policy", done: false },
    { id: "task-3", task: "Submit Q3 Milestone Self-Appraisal Review", due: "2026-09-05", priority: "High", category: "Performance", done: true },
    { id: "task-4", task: "Upload Updated Emergency Contact & Bank Account Proof", due: "2026-09-10", priority: "Low", category: "Profile", done: false },
  ]);
  const [taskFilter, setTaskFilter] = useState<"all" | "pending" | "completed">("all");
  const [newTaskInput, setNewTaskInput] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("Medium");

  // Role-Specific Curated & AI Recommended Courses
  const [coursesList, setCoursesList] = useState([
    {
      id: "course-1",
      title: "Advanced Distributed Systems & Scalable Architecture",
      category: "Engineering & Cloud",
      duration: "6 hours 30 mins",
      modules: 8,
      progress: 75,
      level: "Advanced",
      instructor: "Dr. Sarah Chen, Cloud Architect",
      skills: ["Architecture", "Resilience", "APIs"],
      status: "In Progress",
      certificateReady: false,
    },
    {
      id: "course-2",
      title: "Enterprise Data Privacy, GDPR & ISO/IEC 27001 Essentials",
      category: "Compliance & Security",
      duration: "2 hours 45 mins",
      modules: 5,
      progress: 100,
      level: "Mandatory",
      instructor: "Security & Legal Operations Team",
      skills: ["ISO 27001", "GDPR", "Data Governance"],
      status: "Completed",
      certificateReady: true,
      completedDate: "August 20, 2026"
    },
    {
      id: "course-3",
      title: "Modern React & Next.js Performance Optimization",
      category: "Frontend Mastery",
      duration: "8 hours 15 mins",
      modules: 12,
      progress: 30,
      level: "Core Skill",
      instructor: "Elena Rostova, Principal Engineer",
      skills: ["React", "SSR", "Vite/Next.js"],
      status: "In Progress",
      certificateReady: false,
    },
    {
      id: "course-4",
      title: "AI Prompt Engineering & Business Operations Mastery",
      category: "Artificial Intelligence",
      duration: "4 hours 00 mins",
      modules: 6,
      progress: 0,
      level: "AI Recommended",
      instructor: "BusinessOS AI Academy",
      skills: ["LLM Workflows", "Automation", "Copilot"],
      status: "Enrolled",
      certificateReady: false,
    }
  ]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const handleOpenMyVCard = async () => {
    if (!emp) return;
    setVCardModalOpen(true);
    setLoadingVCard(true);
    setVCardData(null);
    try {
      const data = await employeesApi.getVCard(emp.id);
      setVCardData(data);
    } catch (err: any) {
      console.error("Failed to load my vCard:", err);
    } finally {
      setLoadingVCard(false);
    }
  };

  const handleDownloadMyVCard = () => {
    if (!emp && !vCardData) return;
    const empName = vCardData?.full_name || emp?.full_name || "Employee";
    const empCode = vCardData?.employee_code || emp?.employee_code || "EMP";
    const vcardText = vCardData?.vcard_raw || [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `N:${empName};;;;`,
      `FN:${empName}`,
      `ORG:${vCardData?.company_name || "LazyMonkey AI"}`,
      `TITLE:${vCardData?.designation || "Staff"}`,
      `EMAIL;type=INTERNET;type=WORK:${vCardData?.email || emp?.email || ""}`,
      `TEL;type=CELL;type=VOICE:${vCardData?.phone || emp?.phone || ""}`,
      `NOTE:Employee ID: ${empCode}`,
      "URL:https://lazymonkeyai.com",
      "END:VCARD"
    ].join("\r\n");

    const blob = new Blob([vcardText], { type: "text/vcard;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${empName.replace(/\s+/g, "_")}_Contact.vcf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadMyQrImage = () => {
    if (!vCardData?.qr_code_data_url) return;
    const empName = vCardData.full_name || emp?.full_name || "Employee";
    const link = document.createElement("a");
    link.href = vCardData.qr_code_data_url;
    link.download = `${empName.replace(/\s+/g, "_")}_Pass_QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyMyVCardContact = () => {
    if (!vCardData && !emp) return;
    const text = `📇 ${vCardData?.full_name || emp?.full_name}\n🏢 ${vCardData?.company_name || "BusinessOS"}\n💼 ${vCardData?.designation || "Staff"} · ${vCardData?.department || ""}\n🆔 ${vCardData?.employee_code || emp?.employee_code}\n📧 ${vCardData?.email || emp?.email}\n📞 ${vCardData?.phone || emp?.phone || "N/A"}\n🌐 https://businessos.ai`;
    navigator.clipboard.writeText(text);
    setVcardCopied(true);
    setTimeout(() => setVcardCopied(false), 2000);
  };

  const handleShareMyQrCode = async () => {
    if (navigator.share && vCardData) {
      try {
        await navigator.share({
          title: `${vCardData.full_name}'s Corporate Business Card`,
          text: `Contact card for ${vCardData.full_name} (${vCardData.designation || "Staff"} at ${vCardData.company_name || "BusinessOS"}). Scan to save directly to your phone contacts.`,
          url: window.location.origin
        });
      } catch (err) {
        handleCopyMyVCardContact();
      }
    } else {
      handleCopyMyVCardContact();
    }
  };

  const toggleTaskDone = (taskId: string) => {
    setTasksList(prev => prev.map(t => t.id === taskId ? { ...t, done: !t.done } : t));
  };

  const handleAddNewTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskInput.trim()) return;
    const newTask = {
      id: `task-${Date.now()}`,
      task: newTaskInput.trim(),
      due: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
      priority: newTaskPriority,
      category: "Personal Action",
      done: false,
    };
    setTasksList(prev => [newTask, ...prev]);
    setNewTaskInput("");
  };

  const handleDeleteTask = (taskId: string) => {
    setTasksList(prev => prev.filter(t => t.id !== taskId));
  };

  const loadMe = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const meRes = await employeesApi.getMe();
      setEmp(meRes);
      
      // Respect designated punch method configured in backend profile
      if (meRes.punch_method) {
        setAssignedPunchMethod(meRes.punch_method as any);
      } else if (meRes.employment_type?.toLowerCase().includes("remote") || meRes.employment_type?.toLowerCase().includes("contract")) {
        setAssignedPunchMethod("GPS");
      }

      if (meRes?.id) {
        try {
          const attRes = await attendanceApi.list(1, 10, undefined, undefined, meRes.id);
          setAttendance(attRes.items || []);
        } catch (err) {
          console.error("Attendance fetch error:", err);
        }

        try {
          const docsRes = await employeesApi.listDocuments(meRes.id);
          setDocuments(docsRes || []);
        } catch (err) {
          console.error("Docs fetch error:", err);
        }

        try {
          const leavesRes = await leavesApi.list(1, 10, meRes.id);
          setMyLeaves(leavesRes.items || []);
        } catch (err) {
          console.error("Leaves fetch error:", err);
        }

        try {
          const balancesRes = await leavesApi.listBalances(meRes.id);
          setMyBalances(balancesRes || []);
        } catch (err) {
          console.error("Balances fetch error:", err);
        }

        try {
          const payslipsRes = await payrollApi.listPayslips(meRes.id);
          setMyPayslips(payslipsRes.items || []);
        } catch (err) {
          console.error("Payslips fetch error:", err);
        }
      }
    } catch (e: any) {
      console.error("Failed to load ESS profile", e);
      setError("Unable to locate active employee profile for current user.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  // Geolocation clock in
  const handleClockIn = async () => {
    if (!emp) return;
    setLoading(true);
    try {
      let lat = 37.7749, lng = -122.4194;
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            await attendanceApi.checkIn({ 
              latitude: pos.coords.latitude, 
              longitude: pos.coords.longitude, 
              notes: `Clock-In via ${assignedPunchMethod} Verified Punch`, 
              method: assignedPunchMethod 
            });
            loadMe();
          },
          async () => {
            await attendanceApi.checkIn({ 
              latitude: lat, 
              longitude: lng, 
              notes: `Clock-In via ${assignedPunchMethod} Web Punch`, 
              method: assignedPunchMethod 
            });
            loadMe();
          }
        );
      } else {
        await attendanceApi.checkIn({ 
          latitude: lat, 
          longitude: lng, 
          notes: `Clock-In via ${assignedPunchMethod} Web Punch`, 
          method: assignedPunchMethod 
        });
        loadMe();
      }
    } catch (e: any) {
      alert("Clock-in failed: " + e.message);
      setLoading(false);
    }
  };

  // Clock out
  const handleClockOut = async () => {
    if (!emp) return;
    setLoading(true);
    try {
      let lat = 37.7749, lng = -122.4194;
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            await attendanceApi.checkOut({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, notes: `Clock-Out via ${assignedPunchMethod} Verified Punch` });
            loadMe();
          },
          async () => {
            await attendanceApi.checkOut({ latitude: lat, longitude: lng, notes: `Clock-Out via ${assignedPunchMethod} Web Punch` });
            loadMe();
          }
        );
      } else {
        await attendanceApi.checkOut({ latitude: lat, longitude: lng, notes: `Clock-Out via ${assignedPunchMethod} Web Punch` });
        loadMe();
      }
    } catch (e: any) {
      alert("Clock-out failed: " + e.message);
      setLoading(false);
    }
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromDate || !toDate) return;
    try {
      await leavesApi.create({
        leave_type: leaveType,
        from_date: fromDate,
        to_date: toDate,
        days_requested: parseInt(daysRequested) || 1,
        reason: reason || ""
      });
      setLeaveDialogOpen(false);
      setReason("");
      loadMe();
    } catch (err: any) {
      alert("Failed to submit leave: " + err.message);
    }
  };

  // Find today's check-in status
  const todayStr = new Date().toISOString().split("T")[0];
  const todayRecord = attendance.find(r => r.date === todayStr);

  // ─── Render: Performance & Reviews Tab ───────────────────────────
  if (tab === "ess_performance") {
    const kpis = [
      { name: "Sprint Goals & Milestone Deliverables", target: "90%", achieved: "96%", score: 96, color: "bg-emerald-500" },
      { name: "Code Quality & Peer Architecture Review", target: "88%", achieved: "94%", score: 94, color: "bg-blue-500" },
      { name: "Incident SLA & Critical Bug Resolution", target: "95%", achieved: "98%", score: 98, color: "bg-purple-500" },
      { name: "Cross-Functional Mentorship & Knowledge Share", target: "85%", achieved: "92%", score: 92, color: "bg-indigo-500" },
    ];

    const reviews = [
      {
        quarter: "Q2 2026 Mid-Year Review",
        date: "July 12, 2026",
        reviewer: "Marcus Vance (Engineering VP)",
        rating: 4.9,
        badge: "Outstanding Contributor",
        feedback: "Exceptional architecture execution on the core multi-tenant synchronization engine. Consistently exceeds sprint velocity and demonstrates exemplary leadership across the technical team."
      },
      {
        quarter: "Q1 2026 Annual Goal Cycle",
        date: "April 05, 2026",
        reviewer: "Sarah Jenkins (Lead Architect)",
        rating: 4.8,
        badge: "Exceeds Expectations",
        feedback: "High standard of technical craftsmanship and prompt turnaround on critical compliance deadlines. Highly recommend for leadership track."
      }
    ];

    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-20">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Performance & Reviews</h2>
            <p className="text-xs text-muted-foreground">Your performance score, key KPI deliverables, and manager appraisal evaluations.</p>
          </div>
          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full text-xs font-bold border border-emerald-500/20 flex items-center gap-1.5">
            <Award className="size-3.5" /> High Performance Tier
          </span>
        </div>

        {/* Executive Score Card */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-5 border bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-card rounded-2xl flex flex-col justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Overall Appraisal Score</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-black text-foreground">4.85</span>
                <span className="text-sm text-muted-foreground font-semibold">/ 5.0</span>
              </div>
            </div>
            <div className="flex items-center gap-1 mt-3 text-amber-500">
              {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} className="size-4 fill-amber-400 text-amber-400" />
              ))}
              <span className="text-xs font-bold text-foreground ml-1">Top 5%</span>
            </div>
          </Card>

          <Card className="p-5 border bg-card rounded-2xl flex flex-col justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Quarterly Deliverables</p>
              <h3 className="text-3xl font-black text-emerald-500 mt-2">96%</h3>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
              <CheckCircle2 className="size-3.5 text-emerald-500" /> 12 of 12 Milestones Met
            </p>
          </Card>

          <Card className="p-5 border bg-card rounded-2xl flex flex-col justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Incentive Status</p>
              <h3 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-2">100% Eligible</h3>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
              <Sparkles className="size-3.5 text-indigo-500" /> Annual Bonus Tier A
            </p>
          </Card>

          <Card className="p-5 border bg-card rounded-2xl flex flex-col justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Next Appraisal Date</p>
              <h3 className="text-xl font-bold text-foreground mt-2">Oct 15, 2026</h3>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">Q3 Final Performance Cycle</p>
          </Card>
        </div>

        {/* Key Results & KPIs */}
        <Card className="p-6 border rounded-2xl space-y-4">
          <h3 className="font-bold text-base text-foreground flex items-center gap-2">
            <Target className="size-4 text-primary" /> Active KPIs & Deliverables Tracking
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {kpis.map(k => (
              <div key={k.name} className="space-y-2 p-3.5 rounded-xl bg-muted/30 border">
                <div className="flex justify-between items-start text-xs">
                  <span className="font-bold text-foreground max-w-[220px]">{k.name}</span>
                  <span className="font-mono font-bold text-foreground">{k.achieved} <span className="text-[10px] text-muted-foreground font-normal">(Goal: {k.target})</span></span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${k.color}`} style={{ width: `${k.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Manager Appraisal Feedback */}
        <div className="space-y-4">
          <h3 className="font-bold text-base text-foreground flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" /> Appraisal Reviews & Management Feedback
          </h3>
          {reviews.map((r, i) => (
            <motion.div key={r.quarter} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="glass-panel p-6 rounded-2xl border space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-foreground text-sm">{r.quarter}</h4>
                  <p className="text-xs text-muted-foreground">Evaluated by <span className="font-semibold text-foreground">{r.reviewer}</span> • {r.date}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">{r.badge}</span>
                  <span className="font-black text-sm text-amber-500 flex items-center gap-1">
                    <Star className="size-3.5 fill-amber-400" /> {r.rating}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed italic bg-muted/20 p-3.5 rounded-xl border border-border/50">
                "{r.feedback}"
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Render: Suggested Courses Tab ───────────────────────────────
  if (tab === "ess_learning") {
    const handlePrintCertificate = (course: any) => {
      setSelectedCourseForCert(course);
      const printWin = window.open("", "_blank", "width=900,height=650");
      if (!printWin) {
        alert("Please allow popups to generate your Course Certificate.");
        return;
      }
      const empName = emp?.full_name || user?.name || "Corporate Staff";
      const certId = `CERT-${Date.now().toString().slice(-8)}`;
      const companyName = tenant?.name || "BusinessOS AI Global";
      const companyLogo = tenant?.logo_url || tenant?.raw?.logo_url || "";

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Certificate of Completion - ${course.title}</title>
            <style>
              @page { size: landscape; margin: 10mm; }
              * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
              body { background: #ffffff; padding: 25px; color: #0f172a; text-align: center; }
              .cert-border { border: 8px double #4338ca; padding: 36px; border-radius: 12px; max-width: 800px; margin: 0 auto; background: #faf5ff; }
              .cert-title { font-size: 24pt; font-weight: 900; color: #312e81; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px; }
              .cert-sub { font-size: 11pt; color: #6b21a8; font-weight: 600; margin-bottom: 24px; text-transform: uppercase; }
              .cert-name { font-size: 22pt; font-weight: 900; color: #1e1b4b; margin: 16px 0 8px; text-decoration: underline; }
              .cert-desc { font-size: 10.5pt; color: #475569; max-width: 600px; margin: 0 auto 28px; line-height: 1.6; }
              .cert-course { font-size: 14pt; font-weight: 800; color: #4338ca; }
              .cert-footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; padding-top: 20px; border-top: 1.5px solid #cbd5e1; font-size: 9pt; }
              .sign-box { width: 35%; text-align: center; }
              .sign-line { border-bottom: 1.5px solid #0f172a; height: 35px; margin-bottom: 6px; }
            </style>
          </head>
          <body>
            <div class="cert-border">
              <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 14px;">
                ${companyLogo ? `<img src="${companyLogo}" alt="${companyName}" style="max-height: 48px; max-width: 180px; object-fit: contain;" />` : `<div style="font-size: 16pt; font-weight: 900; color: #4338ca; letter-spacing: 1px;">${companyName}</div>`}
              </div>
              <div class="cert-title">Certificate of Completion</div>
              <div class="cert-sub">${companyName} Academy • Verified Professional Credential</div>
              <p style="color:#64748b; font-size:10pt;">This is to proudly certify that</p>
              <div class="cert-name">${empName}</div>
              <div class="cert-desc">
                has successfully fulfilled all curriculum requirements, practical assessments, and masterclass deliverables for
                <div class="cert-course mt-1">${course.title}</div>
              </div>
              <div class="cert-footer">
                <div class="sign-box">
                  <div class="sign-line"></div>
                  <strong>${course.instructor}</strong>
                  <div style="color:#64748b; font-size:8pt;">Course Director & Specialist</div>
                </div>
                <div style="font-family:monospace; font-size:8pt; color:#64748b;">
                  <div>ID: ${certId}</div>
                  <div>Issued: ${course.completedDate || "August 2026"}</div>
                </div>
                <div class="sign-box">
                  <div class="sign-line"></div>
                  <strong>Executive Dean</strong>
                  <div style="color:#64748b; font-size:8pt;">Enterprise Learning Operations</div>
                </div>
              </div>
            </div>
            <script>window.onload = function() { setTimeout(function() { window.print(); }, 300); };</script>
          </body>
        </html>
      `;
      printWin.document.open();
      printWin.document.write(html);
      printWin.document.close();
    };

    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-20">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Suggested Courses & Upskilling</h2>
            <p className="text-xs text-muted-foreground">AI-recommended curriculum, skill pathways, and earned professional certificates.</p>
          </div>
          <span className="px-3 py-1 bg-purple-500/10 text-purple-600 rounded-full text-xs font-bold border border-purple-500/20 flex items-center gap-1.5">
            <Sparkles className="size-3.5" /> AI Recommended for Your Role
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {coursesList.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="glass-panel p-5 rounded-2xl border flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow bg-card">
              <div className="space-y-2.5">
                <div className="flex justify-between items-start gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${c.status === "Completed" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : c.status === "In Progress" ? "bg-blue-500/10 text-blue-600 border border-blue-500/20" : "bg-purple-500/10 text-purple-600 border border-purple-500/20"}`}>
                    {c.level}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-semibold">{c.duration}</span>
                </div>
                
                <h4 className="font-bold text-foreground text-sm leading-snug">{c.title}</h4>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <GraduationCap className="size-3.5 text-primary" /> {c.instructor}
                </p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {c.skills.map(s => (
                    <span key={s} className="px-2 py-0.5 bg-muted text-[10px] font-semibold text-muted-foreground rounded-md">
                      #{s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t">
                <div>
                  <div className="flex justify-between text-xs mb-1 font-semibold">
                    <span className="text-muted-foreground">{c.status} ({c.modules} Modules)</span>
                    <span className="text-foreground">{c.progress}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${c.status === "Completed" ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${c.progress}%` }} />
                  </div>
                </div>

                <div className="flex gap-2">
                  {c.certificateReady ? (
                    <Button 
                      size="sm" 
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5"
                      onClick={() => handlePrintCertificate(c)}
                    >
                      <Award className="size-3.5" /> View & Print Certificate
                    </Button>
                  ) : c.status === "In Progress" ? (
                    <Button 
                      size="sm" 
                      className="w-full gradient-brand text-white font-bold text-xs gap-1.5 border-0"
                      onClick={() => alert(`Resuming module for: ${c.title}`)}
                    >
                      <Play className="size-3.5" /> Continue Learning
                    </Button>
                  ) : (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="w-full font-bold text-xs gap-1.5 border-indigo-500/30 text-indigo-600 hover:bg-indigo-50"
                      onClick={() => alert(`Enrolled in: ${c.title}`)}
                    >
                      <BookOpen className="size-3.5" /> Start Course
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Render: My Leaves Tab ──────────────────────────────────────
  if (tab === "ess_leaves") {
    const leaveColor = (t: string) => {
      if (t === "Annual") return "bg-indigo-500";
      if (t === "Sick") return "bg-rose-500";
      return "bg-amber-500";
    };
    const leaveStatusColor = (s: string) => {
      if (s === "Approved") return "bg-emerald-500/10 text-emerald-500";
      if (s === "Pending") return "bg-amber-500/10 text-amber-500";
      return "bg-red-500/10 text-red-500";
    };
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">My Leaves</h2>
            <p className="text-xs text-muted-foreground">Your leave balances and entitlement stats.</p>
          </div>
          <Button onClick={() => setLeaveDialogOpen(true)} className="h-8 text-xs font-semibold gradient-brand text-white border-0">Apply Leave Request</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {myBalances.length === 0 ? (
            <p className="text-sm text-muted-foreground italic col-span-3">No leave entitlement assigned.</p>
          ) : myBalances.map((l, i) => (
            <motion.div key={l.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="glass-panel p-6 rounded-xl border hover:shadow-sm transition-shadow">
              <h3 className="font-bold text-foreground text-sm uppercase tracking-wider mb-4">{l.leave_type} Leave</h3>
              <div className="grid grid-cols-3 gap-2 text-center text-sm mb-4">
                <div><p className="text-muted-foreground text-xs">Total</p><p className="font-bold text-lg text-foreground">{l.total_days}</p></div>
                <div><p className="text-muted-foreground text-xs">Used</p><p className="font-bold text-lg text-amber-500">{l.used_days}</p></div>
                <div><p className="text-muted-foreground text-xs">Balance</p><p className="font-bold text-lg text-emerald-500">{l.balance}</p></div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${leaveColor(l.leave_type)}`} style={{ width: `${(l.used_days / (l.total_days || 1)) * 100}%` }} />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Leave History List */}
        <div className="glass-panel p-6 rounded-xl border">
          <h3 className="font-bold text-foreground mb-4">Leave Application History</h3>
          <div className="divide-y space-y-3">
            {myLeaves.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-4">No leave applications submitted yet.</p>
            ) : myLeaves.map(req => (
              <div key={req.id} className="flex justify-between items-center py-2 text-xs">
                <div>
                  <p className="font-semibold text-foreground text-sm">{req.leave_type} Leave</p>
                  <p className="text-muted-foreground mt-0.5">{req.from_date} → {req.to_date} ({req.days_requested} days)</p>
                  {req.reason && <p className="text-muted-foreground italic mt-0.5">Reason: {req.reason}</p>}
                </div>
                <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${leaveStatusColor(req.status)}`}>
                  {req.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Leave Dialog */}
        {leaveDialogOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl bg-card border p-6 space-y-4 shadow-2xl">
              <h3 className="font-bold text-lg text-foreground">Apply Leave Request</h3>
              <form onSubmit={handleApplyLeave} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Leave Type</label>
                  <select value={leaveType} onChange={e => setLeaveType(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                    <option>Annual</option>
                    <option>Sick</option>
                    <option>Casual</option>
                    <option>Maternity</option>
                    <option>Unpaid</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">From</label>
                    <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">To</label>
                    <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background" required />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Total Days Requested</label>
                  <input type="number" min="1" value={daysRequested} onChange={e => setDaysRequested(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Reason</label>
                  <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Describe leave reason..." className="w-full p-3 text-sm rounded-md border bg-background h-20 resize-none" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setLeaveDialogOpen(false)} className="px-4 py-2 border rounded-md text-sm">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md text-sm">Submit Request</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Render: My Payroll Tab ──────────────────────────────────────
  if (tab === "ess_payroll") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">My Payroll & Payslips</h2>
          <p className="text-xs text-muted-foreground">Download compensation details and monthly payslips.</p>
        </div>
        <div className="glass-panel p-6 rounded-xl border">
          <h3 className="font-bold text-foreground mb-4">Current Compensation Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Basic Monthly Salary", value: emp?.basic_salary ? `$${emp.basic_salary.toLocaleString()}` : "Not Configured", color: "text-foreground" },
              { label: "Designation Mapped", value: emp ? emp.status : "—", color: "text-primary" },
              { label: "Employment Type", value: emp ? emp.employment_type : "—", color: "text-emerald-500 font-bold" },
            ].map(s => (
              <div key={s.label} className="p-4 bg-muted/40 rounded-xl border">
                <p className="text-xs text-muted-foreground mb-1 uppercase font-bold">{s.label}</p>
                <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Payslips table */}
        <div className="glass-panel p-6 rounded-xl border">
          <h3 className="font-bold text-foreground mb-4">Monthly Payslips</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b">
                <tr>
                  <th className="px-6 py-3 font-medium">Period</th>
                  <th className="px-6 py-3 text-right font-medium">Basic Pay</th>
                  <th className="px-6 py-3 text-right font-medium">Allowances</th>
                  <th className="px-6 py-3 text-right font-medium">Deductions</th>
                  <th className="px-6 py-3 text-right font-medium text-emerald-500">Net Paid</th>
                  <th className="px-6 py-3 text-center font-medium">Status</th>
                  <th className="px-6 py-3 text-center font-medium">Payslip</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {myPayslips.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-6 text-center text-muted-foreground italic">No payslips issued yet.</td></tr>
                ) : myPayslips.map(ps => (
                  <tr key={ps.id} className="hover:bg-muted/5 transition-colors">
                    <td className="px-6 py-4 font-semibold text-foreground">{ps.year}-{ps.month.toString().padStart(2, '0')}</td>
                    <td className="px-6 py-4 text-right font-mono">{currency.symbol}{ps.basic_salary.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-mono text-muted-foreground">{currency.symbol}{(ps.hra + ps.other_allowances).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-mono text-red-400">-{currency.symbol}{(ps.pf_deduction + ps.esi_deduction + ps.tds_deduction + ps.other_deductions).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-emerald-500">{currency.symbol}{ps.net_salary.toLocaleString()}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ps.status === "Paid" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>
                        {ps.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs font-bold text-primary gap-1 border-primary/30 hover:bg-primary/10"
                        onClick={() => {
                          const printWin = window.open("", "_blank", "width=850,height=1000");
                          if (!printWin) {
                            alert("Please allow popups to print your Payslip.");
                            return;
                          }
                          const empName = emp?.full_name || user?.name || "Employee";
                          const empCode = emp?.employee_code || "EMP-001";
                          const companyName = tenant?.name || "BusinessOS AI Global";
                          const companyLogo = tenant?.logo_url || tenant?.raw?.logo_url || "";
                          const periodStr = `${new Date(ps.year, ps.month - 1).toLocaleString('default', { month: 'long' })} ${ps.year}`;

                          const html = `
                            <!DOCTYPE html>
                            <html>
                              <head>
                                <title>Payslip - ${empName} (${periodStr})</title>
                                <style>
                                  @page { size: A4 portrait; margin: 15mm; }
                                  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
                                  body { background: #ffffff; color: #0f172a; padding: 20px; font-size: 9.5pt; }
                                  .container { max-width: 720px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; padding: 24px; }
                                  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 20px; }
                                  .org-info h1 { font-size: 16pt; font-weight: 900; }
                                  .org-info p { font-size: 8pt; color: #64748b; }
                                  .meta-box { text-align: right; }
                                  .meta-box .tag { background: #0f172a; color: white; padding: 4px 10px; font-weight: 800; font-size: 8pt; border-radius: 4px; text-transform: uppercase; }
                                  .emp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e2e8f0; font-size: 8.5pt; }
                                  .sal-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 9pt; }
                                  .sal-table th { background: #f1f5f9; padding: 8px 12px; border: 1px solid #cbd5e1; text-align: left; font-weight: 800; }
                                  .sal-table td { padding: 8px 12px; border: 1px solid #e2e8f0; }
                                  .net-box { background: #ecfdf5; border: 1.5px solid #10b981; border-radius: 8px; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                                  .net-box .label { font-size: 10pt; font-weight: 800; color: #065f46; }
                                  .net-box .val { font-size: 16pt; font-weight: 900; color: #047857; font-family: monospace; }
                                  .footer { text-align: center; font-size: 7.5pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
                                  @media print { body { padding: 0; } .container { border: none; } }
                                </style>
                              </head>
                              <body>
                                <div class="container">
                                  <div class="header">
                                    <div style="display: flex; align-items: center; gap: 14px;">
                                      ${companyLogo ? `<img src="${companyLogo}" alt="${companyName}" style="max-height: 48px; max-width: 140px; object-fit: contain;" />` : `<div style="width: 40px; height: 40px; border-radius: 8px; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 14pt;">${companyName.slice(0, 2).toUpperCase()}</div>`}
                                      <div class="org-info">
                                        <h1>${companyName}</h1>
                                        <p>Official Salary & Compensation Disbursement Statement</p>
                                      </div>
                                    </div>
                                    <div class="meta-box">
                                      <span class="tag">Payslip</span>
                                      <div style="font-size: 8pt; font-weight: bold; margin-top: 4px;">${periodStr}</div>
                                    </div>
                                  </div>

                                  <div class="emp-grid">
                                    <div><strong>Employee Name:</strong> ${empName}</div>
                                    <div><strong>Employee ID:</strong> ${empCode}</div>
                                    <div><strong>Employment Type:</strong> ${emp?.employment_type || "Full-Time"}</div>
                                    <div><strong>Status:</strong> ${ps.status} (Disbursed)</div>
                                  </div>

                                  <table class="sal-table">
                                    <thead>
                                      <tr>
                                        <th>EARNINGS</th>
                                        <th style="text-align:right;">AMOUNT</th>
                                        <th>DEDUCTIONS</th>
                                        <th style="text-align:right;">AMOUNT</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr>
                                        <td>Basic Pay</td>
                                        <td style="text-align:right; font-family:monospace;">${currency.symbol}${ps.basic_salary.toLocaleString()}</td>
                                        <td>Provident Fund (PF)</td>
                                        <td style="text-align:right; font-family:monospace;">${currency.symbol}${ps.pf_deduction.toLocaleString()}</td>
                                      </tr>
                                      <tr>
                                        <td>House Rent Allowance (HRA)</td>
                                        <td style="text-align:right; font-family:monospace;">${currency.symbol}${ps.hra.toLocaleString()}</td>
                                        <td>ESI / Health Insurance</td>
                                        <td style="text-align:right; font-family:monospace;">${currency.symbol}${ps.esi_deduction.toLocaleString()}</td>
                                      </tr>
                                      <tr>
                                        <td>Other Allowances</td>
                                        <td style="text-align:right; font-family:monospace;">${currency.symbol}${ps.other_allowances.toLocaleString()}</td>
                                        <td>TDS / Income Tax</td>
                                        <td style="text-align:right; font-family:monospace;">${currency.symbol}${ps.tds_deduction.toLocaleString()}</td>
                                      </tr>
                                      <tr style="background: #f8fafc; font-weight: 800;">
                                        <td>Gross Earnings</td>
                                        <td style="text-align:right; font-family:monospace;">${currency.symbol}${(ps.basic_salary + ps.hra + ps.other_allowances).toLocaleString()}</td>
                                        <td>Total Deductions</td>
                                        <td style="text-align:right; font-family:monospace; color:#dc2626;">${currency.symbol}${(ps.pf_deduction + ps.esi_deduction + ps.tds_deduction + ps.other_deductions).toLocaleString()}</td>
                                      </tr>
                                    </tbody>
                                  </table>

                                  <div class="net-box">
                                    <div class="label">NET SALARY PAYABLE:</div>
                                    <div class="val">${currency.symbol}${ps.net_salary.toLocaleString()}</div>
                                  </div>

                                  <div class="footer">
                                    This is a system-generated document and does not require a physical signature. Confidential.
                                  </div>
                                </div>
                                <script>window.onload = function() { setTimeout(function() { window.print(); }, 300); };</script>
                              </body>
                            </html>
                          `;
                          printWin.document.open();
                          printWin.document.write(html);
                          printWin.document.close();
                        }}
                      >
                        <Printer className="size-3.5" /> View / Print Payslip
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: My Documents Tab ────────────────────────────────────
  if (tab === "ess_documents") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">My Documents</h2>
          <p className="text-xs text-muted-foreground">Compliance contracts, agreements, and HR policy sign-offs.</p>
        </div>
        <div className="space-y-3">
          {loading && <div className="flex justify-center py-6"><Loader2 className="size-6 animate-spin text-primary" /></div>}
          {!loading && documents.length === 0 ? (
            <p className="text-sm text-muted-foreground italic bg-muted/20 p-4 rounded border text-center">No documents have been uploaded for you yet.</p>
          ) : documents.map((doc, i) => (
            <motion.div key={doc.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className="glass-panel p-4 rounded-xl border flex justify-between items-center hover:bg-muted/10 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg text-red-500"><FileText className="size-5" /></div>
                <div>
                  <p className="font-semibold text-sm text-foreground">{doc.document_name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-mono">Uploaded: {formatDate(doc.upload_date)} • Type: {doc.document_type}</p>
                </div>
              </div>
              <a href={doc.file_path} target="_blank" rel="noreferrer" className="text-xs text-primary font-semibold hover:underline">Download</a>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Render: My Tasks Tab ────────────────────────────────────────
  if (tab === "ess_tasks") {
    const filteredTasks = tasksList.filter(t => {
      if (taskFilter === "pending") return !t.done;
      if (taskFilter === "completed") return t.done;
      return true;
    });

    const pendingCount = tasksList.filter(t => !t.done).length;
    const completedCount = tasksList.filter(t => t.done).length;

    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">My Tasks & Compliance</h2>
            <p className="text-xs text-muted-foreground">Action items, policy sign-offs, and compliance milestones assigned to you.</p>
          </div>
          
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-xl border">
            <button 
              onClick={() => setTaskFilter("all")} 
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${taskFilter === "all" ? "bg-card shadow-xs text-foreground font-bold" : "text-muted-foreground hover:text-foreground"}`}>
              All ({tasksList.length})
            </button>
            <button 
              onClick={() => setTaskFilter("pending")} 
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${taskFilter === "pending" ? "bg-card shadow-xs text-foreground font-bold" : "text-muted-foreground hover:text-foreground"}`}>
              Pending ({pendingCount})
            </button>
            <button 
              onClick={() => setTaskFilter("completed")} 
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${taskFilter === "completed" ? "bg-card shadow-xs text-foreground font-bold" : "text-muted-foreground hover:text-foreground"}`}>
              Completed ({completedCount})
            </button>
          </div>
        </div>

        {/* Add Quick Action Bar */}
        <form onSubmit={handleAddNewTask} className="flex gap-2 p-3 rounded-2xl bg-card border shadow-xs">
          <Input 
            placeholder="Add a new personal task or action item..." 
            value={newTaskInput} 
            onChange={e => setNewTaskInput(e.target.value)} 
            className="text-xs border-muted focus-visible:ring-1"
          />
          <select 
            value={newTaskPriority} 
            onChange={e => setNewTaskPriority(e.target.value)}
            aria-label="New Task Priority"
            className="text-xs bg-muted/40 border border-muted rounded-lg px-2.5 py-1 text-foreground font-semibold">
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <Button type="submit" size="sm" className="gradient-brand text-white font-bold text-xs shrink-0 border-0">
            <Plus className="size-3.5 mr-1" /> Add Task
          </Button>
        </form>

        {/* Task Cards List */}
        <div className="space-y-3">
          {filteredTasks.length === 0 ? (
            <div className="p-8 text-center bg-card rounded-2xl border text-muted-foreground text-xs italic">
              No tasks found in this view.
            </div>
          ) : (
            filteredTasks.map((t, i) => (
              <motion.div 
                key={t.id} 
                initial={{ opacity: 0, y: 8 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: i * 0.04 }}
                className={`p-4 rounded-xl border flex justify-between items-center transition-all ${t.done ? "opacity-60 bg-muted/20 border-border/40" : "bg-card hover:border-primary/40 shadow-xs"}`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <button 
                    type="button" 
                    onClick={() => toggleTaskDone(t.id)}
                    aria-label={`Mark task as ${t.done ? "pending" : "done"}`}
                    className={`size-6 rounded-lg flex items-center justify-center border transition-all cursor-pointer ${t.done ? "bg-emerald-500 border-emerald-500 text-white shadow-xs" : "border-muted-foreground/30 hover:border-primary bg-background"}`}
                  >
                    {t.done && <Check className="size-3.5 stroke-[3]" />}
                  </button>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${t.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {t.task}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                      <span className="font-mono">Due: {formatDate(t.due)}</span>
                      <span>•</span>
                      <span className="text-primary font-medium">{t.category}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 ml-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${t.priority === "High" ? "bg-red-500/10 text-red-600 border border-red-500/20" : t.priority === "Medium" ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" : "bg-muted text-muted-foreground"}`}>
                    {t.priority}
                  </span>
                  <button 
                    onClick={() => handleDeleteTask(t.id)}
                    aria-label="Delete Task"
                    className="size-7 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-600 flex items-center justify-center transition-colors">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ─── Render: Announcements Tab ───────────────────────────────────
  if (tab === "ess_announcements") {
    const announcements = [
      { id: 1, title: "Q3 2026 Strategy All-Hands Meeting", date: "2026-07-01", category: "Event", body: "Join us on July 15 for our corporate strategy meeting. Details and links have been sent via email." },
      { id: 2, title: "Wellness Program: Gym Allowance", date: "2026-06-28", category: "Benefit", body: "Active full-time team members are eligible for up to $50 monthly gym reimbursement starting this quarter." },
    ];
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Announcements</h2>
          <p className="text-xs text-muted-foreground">Official policy announcements and announcements.</p>
        </div>
        <div className="space-y-4">
          {announcements.map((ann, i) => (
            <motion.div key={ann.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="glass-panel p-5 rounded-xl border">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary mt-0.5"><Bell className="size-4" /></div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-foreground text-sm">{ann.title}</h4>
                    <span className="px-2 py-0.5 bg-secondary text-[10px] rounded uppercase font-bold">{ann.category}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-2">{ann.date}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{ann.body}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Render: My Attendance (Default) ─────────────────────────────
  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Hello, {emp?.full_name || user?.name || "Employee"}!</h2>
          <p className="text-xs text-muted-foreground">
            {emp ? `${emp.employment_type} • Code: ${emp.employee_code}` : "Loading self service details..."}
          </p>
        </div>

        {emp && (
          <div className="flex items-center gap-2">
            <Button variant="outline" className="border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 font-semibold text-xs h-9 px-3 shadow-sm" onClick={handleOpenMyVCard}>
              <QrCode className="size-3.5 mr-1.5 text-indigo-500" /> My vCard & QR Pass
            </Button>
            
            {/* Dynamic Clock In/Out button customized to Assigned Punch Method */}
            {!todayRecord?.check_in ? (
              <Button className="gradient-brand text-white border-0 h-9 px-4 text-xs font-semibold shadow-md hover:shadow-lg transition-all" onClick={handleClockIn} disabled={loading}>
                {loading ? <Loader2 className="size-3.5 animate-spin" /> : (
                  assignedPunchMethod === "GPS" ? <MapPin className="size-3.5 mr-1.5" /> :
                  assignedPunchMethod === "Biometric" ? <Fingerprint className="size-3.5 mr-1.5" /> :
                  assignedPunchMethod === "Face" ? <Camera className="size-3.5 mr-1.5" /> :
                  <Clock className="size-3.5 mr-1.5" />
                )}
                Clock In ({assignedPunchMethod})
              </Button>
            ) : !todayRecord?.check_out ? (
              <Button className="bg-red-600 hover:bg-red-700 text-white border-0 h-9 px-4 text-xs font-semibold shadow-md" onClick={handleClockOut} disabled={loading}>
                {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Clock className="size-3.5 mr-1.5" />}
                Clock Out ({assignedPunchMethod})
              </Button>
            ) : (
              <span className="px-4 py-2 bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/20 rounded-lg text-xs flex items-center gap-1.5">
                <Check className="size-3.5" /> Completed Today
              </span>
            )}
          </div>
        )}
      </div>

      {error && <div className="p-3 rounded-lg bg-red-500/10 text-red-600 text-sm border border-red-500/20">{error}</div>}

      {/* ─── HR ASSIGNED PUNCH METHOD POLICY CONTAINER ─── */}
      <Card className="p-5 border bg-gradient-to-r from-primary/5 via-card to-indigo-500/5 rounded-2xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-primary/10 text-primary border border-primary/20">
                HR Authorized Policy
              </span>
              <h4 className="font-bold text-foreground text-sm">
                Designated Punch Method: <span className="text-primary font-black">{assignedPunchMethod === "GPS" ? "GPS Geofence Tracking" : assignedPunchMethod === "Biometric" ? "Hardware Biometric / RFID Keycard" : assignedPunchMethod === "Face" ? "Facial Recognition AI Turnstile" : "Web Portal 1-Click"}</span>
              </h4>
            </div>
            <p className="text-xs text-muted-foreground">
              {assignedPunchMethod === "GPS" ? "Your check-ins are verified against authorized office geofences (San Francisco HQ 150m radius & Oakland Campus)." :
               assignedPunchMethod === "Biometric" ? "Your attendance is captured automatically via physical biometric turnstile terminal (BIO-01 ZKTeco Main Gate)." :
               assignedPunchMethod === "Face" ? "Your presence is verified automatically at building entrance camera scanner (HQ Lobby Cam-1)." :
               "You are authorized for standard browser portal clock-in/out."}
            </p>
          </div>

          {/* Quick Method Simulator Switcher */}
          <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl border text-xs">
            {(["GPS", "Biometric", "Face", "Web"] as const).map(m => (
              <button
                key={m}
                onClick={() => setAssignedPunchMethod(m)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${assignedPunchMethod === m ? "bg-card shadow-xs text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Method-Specific Status Badge */}
        <div className="mt-4 pt-3.5 border-t grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-2.5 rounded-xl bg-card border flex items-center gap-2.5">
            {assignedPunchMethod === "GPS" ? <MapPin className="size-4 text-emerald-500 shrink-0" /> :
             assignedPunchMethod === "Biometric" ? <Fingerprint className="size-4 text-indigo-500 shrink-0" /> :
             assignedPunchMethod === "Face" ? <Camera className="size-4 text-purple-500 shrink-0" /> :
             <Clock className="size-4 text-blue-500 shrink-0" />}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Punch Gateway</p>
              <p className="font-semibold text-foreground">
                {assignedPunchMethod === "GPS" ? "SF HQ (37.7749° N, -122.4194° W)" :
                 assignedPunchMethod === "Biometric" ? "Terminal BIO-01 (Turnstile Gate A)" :
                 assignedPunchMethod === "Face" ? "Tablet Scanner #04 (Lobby Entrance)" :
                 "Web Application Portal"}
              </p>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-card border flex items-center gap-2.5">
            <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Verification Status</p>
              <p className="font-semibold text-emerald-600 flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                {assignedPunchMethod === "GPS" ? "Inside 150m Perimeter" :
                 assignedPunchMethod === "Biometric" ? "Smart NFC #99481 Synced" :
                 assignedPunchMethod === "Face" ? "Biometric ID: 99.2% Confirmed" :
                 "Authorized User Token"}
              </p>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-card border flex items-center gap-2.5">
            <Clock className="size-4 text-amber-500 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Today's Total Hours</p>
              <p className="font-mono font-bold text-foreground">{todayRecord?.hours_worked ? `${todayRecord.hours_worked} hrs` : todayRecord?.check_in ? "In Progress..." : "0.0 hrs"}</p>
            </div>
          </div>
        </div>
      </Card>

      {emp && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-5 md:col-span-1 border bg-card relative overflow-hidden flex flex-col justify-between rounded-2xl">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold mb-2">Today's Presence</p>
              <h3 className="text-2xl font-black mb-1">
                {todayRecord ? todayRecord.status : "Not Clocked In"}
              </h3>
              <p className="text-xs text-muted-foreground">Punch Method: {todayRecord?.method || assignedPunchMethod}</p>
            </div>
            <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">In Time</p>
                <p className="font-mono font-bold">{formatTime(todayRecord?.check_in)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Out Time</p>
                <p className="font-mono font-bold">{formatTime(todayRecord?.check_out)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 md:col-span-2 border bg-card rounded-2xl">
            <h3 className="font-bold text-base mb-4 flex items-center gap-2"><Clock className="size-4 text-primary" /> Recent Attendance History</h3>
            {loading && attendance.length === 0 ? (
              <div className="flex justify-center py-6"><Loader2 className="size-6 animate-spin text-primary" /></div>
            ) : attendance.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-4">No timesheet records recorded in database yet.</p>
            ) : (
              <div className="divide-y max-h-48 overflow-y-auto space-y-2">
                {attendance.map(record => (
                  <div key={record.id} className="flex justify-between items-center py-2 text-xs">
                    <div>
                      <p className="font-semibold">{formatDate(record.date, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                      <p className="text-muted-foreground text-[10px]">Punch Method: {record.method}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      {record.hours_worked && <span className="font-mono text-muted-foreground">{record.hours_worked} hrs</span>}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${attStatusStyle(record.status)}`}>
                        {record.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                    <h3 className="font-bold text-base leading-tight">My Digital vCard</h3>
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
                <span className="font-mono font-bold tracking-wider">{vCardData?.employee_code || emp?.employee_code || "EMP"}</span>
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
                      {(vCardData?.full_name || emp?.full_name || "E").split(" ").map(n => n[0]).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-foreground text-lg truncate">{vCardData?.full_name || emp?.full_name}</h4>
                      <p className="text-xs text-primary font-semibold truncate">
                        {vCardData?.designation || "Corporate Staff"}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {vCardData?.department || "Department"} · {vCardData?.company_name || "LazyMonkey AI"}
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
                          Anyone scanning this with their mobile camera can immediately add your contact details to their phone.
                        </p>
                      </div>

                      {/* Quick QR Action Pills */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleDownloadMyQrImage}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 dark:text-indigo-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border border-indigo-200 dark:border-indigo-800 shadow-xs cursor-pointer"
                        >
                          <Download className="size-3.5" /> Download QR (PNG)
                        </button>
                        <button
                          type="button"
                          onClick={handleShareMyQrCode}
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
                      <a href={`mailto:${vCardData?.email || emp?.email}`} className="font-semibold text-foreground hover:text-primary transition-colors truncate max-w-[180px]">
                        {vCardData?.email || emp?.email}
                      </a>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Phone className="size-3.5 text-emerald-500" /> Mobile / Phone</span>
                      <span className="font-semibold text-foreground font-mono">
                        {vCardData?.phone || emp?.phone || "—"}
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
                        onClick={handleDownloadMyVCard}
                      >
                        <Download className="size-3.5" /> Save .VCF Contact
                      </Button>
                      <Button 
                        variant="outline" 
                        className="h-10 text-xs font-bold flex items-center justify-center gap-2 border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                        onClick={handleDownloadMyQrImage}
                      >
                        <QrCode className="size-3.5 text-indigo-600" /> Export QR Code
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-9 text-xs flex items-center justify-center gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                        onClick={handleShareMyQrCode}
                      >
                        <Share2 className="size-3.5" /> Share Pass
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-9 text-xs flex items-center justify-center gap-1"
                        onClick={handleCopyMyVCardContact}
                      >
                        {vcardCopied ? <Check className="size-3.5 text-emerald-600" /> : <Clipboard className="size-3.5" />}
                        {vcardCopied ? "Copied" : "Copy Info"}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-9 text-xs flex items-center justify-center gap-1"
                        onClick={() => window.print()}
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
