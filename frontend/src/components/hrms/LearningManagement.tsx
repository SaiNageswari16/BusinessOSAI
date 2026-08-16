import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, BookOpen, Award, ClipboardList, CheckCircle, Clock, Star, XCircle } from "lucide-react";
import { learningApi, employeesApi, LearningCourse, LearningCertificate, LearningAssessment, Employee } from "../../lib/api-client";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useCurrency } from "@/hooks/use-currency";

interface Props { tab?: string; }

export function LearningManagement({ tab = "training" }: Props) {
    const { currency, formatCurrency } = useCurrency();
  const [courses, setCourses] = useState<LearningCourse[]>([]);
  const [certificates, setCertificates] = useState<LearningCertificate[]>([]);
  const [assessments, setAssessments] = useState<LearningAssessment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Modals state
  const [courseOpen, setCourseOpen] = useState(false);
  const [certificateOpen, setCertificateOpen] = useState(false);
  const [assessmentOpen, setAssessmentOpen] = useState(false);

  // Forms state
  const [courseForm, setCourseForm] = useState({
    title: "",
    category: "Technical",
    instructor: "",
    duration: "5 hrs",
    enrolled: 10,
    completion: 0,
    status: "Active"
  });

  const [certificateForm, setCertificateForm] = useState({
    employeeName: "",
    certName: "",
    issuer: "",
    issuedDate: "",
    expiryDate: "N/A",
    status: "Valid"
  });

  const [assessmentForm, setAssessmentForm] = useState({
    title: "",
    courseName: "",
    dueDate: "",
    participants: 12,
    avgScore: 0,
    status: "Active"
  });

  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [cRes, ceRes, aRes, eRes] = await Promise.all([
        learningApi.listCourses(),
        learningApi.listCertificates(),
        learningApi.listAssessments(),
        employeesApi.list(1, 100)
      ]);
      setCourses(cRes.items);
      setCertificates(ceRes.items);
      setAssessments(aRes.items);
      setEmployees(eRes.items);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to load database pipelines.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tab]);

  // Handle course creation
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseForm.title || !courseForm.instructor) {
      showNotification("Please fill in course title and instructor.", "error");
      return;
    }
    try {
      await learningApi.createCourse({
        title: courseForm.title,
        category: courseForm.category,
        instructor: courseForm.instructor,
        duration: courseForm.duration,
        enrolled: Number(courseForm.enrolled),
        completion: Number(courseForm.completion),
        status: courseForm.status
      });
      showNotification("Course curriculum added successfully.");
      setCourseOpen(false);
      setCourseForm({ title: "", category: "Technical", instructor: "", duration: "5 hrs", enrolled: 10, completion: 0, status: "Active" });
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to save course", "error");
    }
  };

  // Handle certification upload
  const handleUploadCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certificateForm.employeeName || !certificateForm.certName || !certificateForm.issuer) {
      showNotification("Please complete all certification fields.", "error");
      return;
    }
    try {
      await learningApi.createCertificate({
        employee_name: certificateForm.employeeName,
        cert_name: certificateForm.certName,
        issuer: certificateForm.issuer,
        issued_date: certificateForm.issuedDate || new Date().toISOString().split('T')[0],
        expiry_date: certificateForm.expiryDate,
        status: certificateForm.status
      });
      showNotification("Certification profile updated.");
      setCertificateOpen(false);
      setCertificateForm({ employeeName: "", certName: "", issuer: "", issuedDate: "", expiryDate: "N/A", status: "Valid" });
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to save certificate", "error");
    }
  };

  // Handle assessment creation
  const handleCreateAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assessmentForm.title || !assessmentForm.courseName || !assessmentForm.dueDate) {
      showNotification("Please specify assessment title, course, and due date.", "error");
      return;
    }
    try {
      await learningApi.createAssessment({
        title: assessmentForm.title,
        course_name: assessmentForm.courseName,
        due_date: assessmentForm.dueDate,
        participants: Number(assessmentForm.participants),
        avg_score: Number(assessmentForm.avgScore),
        status: assessmentForm.status
      });
      showNotification("Quiz/Assessment target published.");
      setAssessmentOpen(false);
      setAssessmentForm({ title: "", courseName: "", dueDate: "", participants: 12, avgScore: 0, status: "Active" });
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to save assessment", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="size-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground font-sans">Contacting database pipelines...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center space-y-4 font-sans text-sm">
        <p className="text-red-500 font-medium">{error}</p>
        <Button onClick={loadData}>Retry Connection</Button>
      </div>
    );
  }

  // Courses
  if (tab === "courses" || tab === "training") {
    return (
      <div className="p-6 space-y-6">
        {notification && (
          <div className={`fixed bottom-4 right-4 px-4 py-2.5 rounded-lg text-white font-sans text-xs shadow-lg z-50 ${notification.type === "error" ? "bg-red-600" : "bg-emerald-600"}`}>
            {notification.message}
          </div>
        )}

        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Courses</h1>
            <p className="text-sm text-muted-foreground font-sans">Learning catalog — technical, compliance, and soft-skill courses.</p>
          </div>
          <button onClick={() => setCourseOpen(true)} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
            <Plus className="size-4" /> Add Course
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courses.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="glass-panel p-6 rounded-xl border border-border/50 hover:shadow-elegant transition-all">
              <div className="flex justify-between items-start mb-3">
                <div className="p-2.5 bg-blue-500/10 rounded-lg"><BookOpen className="size-5 text-blue-500" /></div>
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${c.status === "Mandatory" ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-500"}`}>{c.status}</span>
              </div>
              <h3 className="font-bold text-foreground mb-1">{c.title}</h3>
              <p className="text-xs text-muted-foreground font-semibold mb-1">{c.category} · {c.instructor}</p>
              <p className="text-xs text-muted-foreground font-semibold mb-4">{c.duration} · {c.enrolled} enrolled</p>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground font-bold">
                  <span>Completion</span>
                  <span className="font-bold text-foreground">{c.completion}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${c.completion}%` }} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Add Course Modal */}
        <AnimatePresence>
          {courseOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl p-6 space-y-4 font-sans text-sm">
                <div className="flex justify-between items-center pb-2 border-b border-border">
                  <h3 className="text-base font-bold text-foreground">Launch New Curriculum</h3>
                  <button onClick={() => setCourseOpen(false)}><XCircle className="size-5 text-muted-foreground" /></button>
                </div>
                <form onSubmit={handleCreateCourse} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Course Title</label>
                    <Input value={courseForm.title} onChange={(e) => setCourseForm({...courseForm, title: e.target.value})} placeholder="e.g. AWS Cloud Architecture" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Category</label>
                      <select value={courseForm.category} onChange={(e) => setCourseForm({...courseForm, category: e.target.value})}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none">
                        <option value="Technical">Technical</option>
                        <option value="Soft Skills">Soft Skills</option>
                        <option value="Compliance">Compliance</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Course Status</label>
                      <select value={courseForm.status} onChange={(e) => setCourseForm({...courseForm, status: e.target.value})}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none">
                        <option value="Active">Active</option>
                        <option value="Mandatory">Mandatory</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Instructor / Partner</label>
                      <Input value={courseForm.instructor} onChange={(e) => setCourseForm({...courseForm, instructor: e.target.value})} placeholder="e.g. AWS Training" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Duration (Hours)</label>
                      <Input value={courseForm.duration} onChange={(e) => setCourseForm({...courseForm, duration: e.target.value})} placeholder="e.g. 12 hrs" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setCourseOpen(false)}>Cancel</Button>
                    <Button type="submit">Create Course</Button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Certificates
  if (tab === "certificates") {
    return (
      <div className="p-6 space-y-6">
        {notification && (
          <div className={`fixed bottom-4 right-4 px-4 py-2.5 rounded-lg text-white font-sans text-xs shadow-lg z-50 ${notification.type === "error" ? "bg-red-600" : "bg-emerald-600"}`}>
            {notification.message}
          </div>
        )}

        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Certificates</h1>
            <p className="text-sm text-muted-foreground font-sans">Professional certifications held by employees.</p>
          </div>
          <button onClick={() => setCertificateOpen(true)} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
            <Award className="size-4" /> Upload Certificate
          </button>
        </div>

        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-semibold">Employee</th>
                  <th className="px-6 py-4 font-semibold">Certificate</th>
                  <th className="px-6 py-4 font-semibold">Issuer</th>
                  <th className="px-6 py-4 font-semibold">Issued</th>
                  <th className="px-6 py-4 font-semibold">Expiry</th>
                  <th className="px-6 py-4 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((cert, i) => (
                  <motion.tr key={cert.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-semibold text-foreground">{cert.employee_name}</td>
                    <td className="px-6 py-4 font-bold text-primary">{cert.cert_name}</td>
                    <td className="px-6 py-4 text-muted-foreground font-medium">{cert.issuer}</td>
                    <td className="px-6 py-4 text-muted-foreground font-medium">{cert.issued_date}</td>
                    <td className="px-6 py-4 text-muted-foreground font-medium">{cert.expiry_date}</td>
                    <td className="px-6 py-4 text-center"><span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-xs font-bold">{cert.status}</span></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Upload Certificate Modal */}
        <AnimatePresence>
          {certificateOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl p-6 space-y-4 font-sans text-sm">
                <div className="flex justify-between items-center pb-2 border-b border-border">
                  <h3 className="text-base font-bold text-foreground">Upload Earned Certification</h3>
                  <button onClick={() => setCertificateOpen(false)}><XCircle className="size-5 text-muted-foreground" /></button>
                </div>
                <form onSubmit={handleUploadCertificate} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Select Employee</label>
                    <select value={certificateForm.employeeName} onChange={(e) => setCertificateForm({...certificateForm, employeeName: e.target.value})}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none">
                      <option value="">Choose employee...</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.full_name}>{emp.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Certificate Name</label>
                    <Input value={certificateForm.certName} onChange={(e) => setCertificateForm({...certificateForm, certName: e.target.value})} placeholder="e.g. AWS Certified Developer" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Issuing Authority</label>
                    <Input value={certificateForm.issuer} onChange={(e) => setCertificateForm({...certificateForm, issuer: e.target.value})} placeholder="e.g. Amazon Web Services" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Issued Date</label>
                      <Input type="date" value={certificateForm.issuedDate} onChange={(e) => setCertificateForm({...certificateForm, issuedDate: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Expiry Date</label>
                      <Input value={certificateForm.expiryDate} onChange={(e) => setCertificateForm({...certificateForm, expiryDate: e.target.value})} placeholder="e.g. 2029-05-20 or N/A" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setCertificateOpen(false)}>Cancel</Button>
                    <Button type="submit">Upload Certificate</Button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Assessments
  if (tab === "assessments") {
    return (
      <div className="p-6 space-y-6">
        {notification && (
          <div className={`fixed bottom-4 right-4 px-4 py-2.5 rounded-lg text-white font-sans text-xs shadow-lg z-50 ${notification.type === "error" ? "bg-red-600" : "bg-emerald-600"}`}>
            {notification.message}
          </div>
        )}

        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Assessments</h1>
            <p className="text-sm text-muted-foreground font-sans">Mandatory quizzes and skills evaluations.</p>
          </div>
          <button onClick={() => setAssessmentOpen(true)} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
            <ClipboardList className="size-4" /> Add Assessment
          </button>
        </div>

        <div className="space-y-4">
          {assessments.map((ass, i) => (
            <motion.div key={ass.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-6 rounded-xl border border-border/50 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="px-2 py-0.5 bg-secondary/50 rounded text-xs text-foreground font-semibold">{ass.course_name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${ass.status === "Active" ? "bg-emerald-500/10 text-emerald-500" : ass.status === "Closed" ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground"}`}>{ass.status}</span>
                </div>
                <h3 className="font-bold text-foreground text-base mt-1">{ass.title}</h3>
                <p className="text-xs text-muted-foreground font-semibold">Due Date: {ass.due_date} · {ass.participants} enrolled participants</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">{ass.avg_score > 0 ? `${ass.avg_score}%` : "—"}</p>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase">Average Score</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Add Assessment Modal */}
        <AnimatePresence>
          {assessmentOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl p-6 space-y-4 font-sans text-sm">
                <div className="flex justify-between items-center pb-2 border-b border-border">
                  <h3 className="text-base font-bold text-foreground">Deploy Assessment Quiz</h3>
                  <button onClick={() => setAssessmentOpen(false)}><XCircle className="size-5 text-muted-foreground" /></button>
                </div>
                <form onSubmit={handleCreateAssessment} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Assessment Title</label>
                    <Input value={assessmentForm.title} onChange={(e) => setAssessmentForm({...assessmentForm, title: e.target.value})} placeholder="e.g. Q2 Compliance Quiz" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Course Catalog Target</label>
                      <select value={assessmentForm.courseName} onChange={(e) => setAssessmentForm({...assessmentForm, courseName: e.target.value})}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none">
                        <option value="">Select course...</option>
                        {courses.map(c => (
                          <option key={c.id} value={c.title}>{c.title}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Assessment Status</label>
                      <select value={assessmentForm.status} onChange={(e) => setAssessmentForm({...assessmentForm, status: e.target.value})}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none">
                        <option value="Active">Active</option>
                        <option value="Not Started">Not Started</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Due Date</label>
                      <Input type="date" value={assessmentForm.dueDate} onChange={(e) => setAssessmentForm({...assessmentForm, dueDate: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Participants Count</label>
                      <Input type="number" value={assessmentForm.participants} onChange={(e) => setAssessmentForm({...assessmentForm, participants: Number(e.target.value)})} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setAssessmentOpen(false)}>Cancel</Button>
                    <Button type="submit">Deploy Quiz</Button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return null;
}
