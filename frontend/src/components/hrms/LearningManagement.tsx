import React from "react";
import { motion } from "framer-motion";
import { Plus, BookOpen, Award, ClipboardList, CheckCircle, Clock, Star } from "lucide-react";

interface Props { tab?: string; }

const courses = [
  { id: "CRS-001", title: "Leadership Essentials", category: "Soft Skills", instructor: "External – Coursera", duration: "8 hrs", enrolled: 32, completion: 75, status: "Active" },
  { id: "CRS-002", title: "AWS Cloud Practitioner", category: "Technical", instructor: "AWS Training", duration: "12 hrs", enrolled: 10, completion: 60, status: "Active" },
  { id: "CRS-003", title: "Data Privacy & GDPR", category: "Compliance", instructor: "Internal – Legal", duration: "2 hrs", enrolled: 124, completion: 92, status: "Mandatory" },
  { id: "CRS-004", title: "Advanced Excel for Finance", category: "Technical", instructor: "Internal – Finance", duration: "5 hrs", enrolled: 18, completion: 44, status: "Active" },
];

const certificates = [
  { employee: "Kevin Park", cert: "AWS Certified Developer", issuer: "Amazon Web Services", issued: "2026-05-20", expiry: "2029-05-20", status: "Valid" },
  { employee: "Priya Sharma", cert: "SHRM-CP", issuer: "SHRM", issued: "2025-08-10", expiry: "2028-08-10", status: "Valid" },
  { employee: "Aisha Patel", cert: "Google UX Design", issuer: "Google / Coursera", issued: "2024-03-15", expiry: "N/A", status: "Valid" },
  { employee: "Marcus Johnson", cert: "CPA Exam Part 1", issuer: "AICPA", issued: "2023-11-01", expiry: "N/A", status: "Valid" },
];

const assessments = [
  { id: "ASS-001", title: "Q2 Compliance Quiz", course: "Data Privacy & GDPR", dueDate: "2026-07-15", participants: 124, avgScore: 88, status: "Active" },
  { id: "ASS-002", title: "Leadership Self Assessment", course: "Leadership Essentials", dueDate: "2026-07-30", participants: 32, avgScore: 0, status: "Not Started" },
  { id: "ASS-003", title: "Cloud Basics Assessment", course: "AWS Cloud Practitioner", dueDate: "2026-06-30", participants: 10, avgScore: 79, status: "Closed" },
];

export function LearningManagement({ tab = "training" }: Props) {

  if (tab === "courses") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Courses</h1><p className="text-sm text-muted-foreground">Learning catalog — technical, compliance, and soft-skill courses.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Add Course</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courses.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="glass-panel p-6 rounded-xl border border-border/50 hover:shadow-elegant transition-all">
              <div className="flex justify-between items-start mb-3">
                <div className="p-2.5 bg-blue-500/10 rounded-lg"><BookOpen className="size-5 text-blue-500" /></div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.status === "Mandatory" ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-500"}`}>{c.status}</span>
              </div>
              <h3 className="font-bold text-foreground mb-1">{c.title}</h3>
              <p className="text-xs text-muted-foreground mb-1">{c.category} · {c.instructor}</p>
              <p className="text-xs text-muted-foreground mb-4">{c.duration} · {c.enrolled} enrolled</p>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Completion</span><span className="font-semibold text-foreground">{c.completion}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${c.completion}%` }} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (tab === "certificates") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Certificates</h1><p className="text-sm text-muted-foreground">Professional certifications held by employees.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Award className="size-4" /> Upload Certificate</button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Employee</th>
                  <th className="px-6 py-4 font-medium">Certificate</th>
                  <th className="px-6 py-4 font-medium">Issuer</th>
                  <th className="px-6 py-4 font-medium">Issued</th>
                  <th className="px-6 py-4 font-medium">Expiry</th>
                  <th className="px-6 py-4 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((cert, i) => (
                  <motion.tr key={cert.cert} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{cert.employee}</td>
                    <td className="px-6 py-4 font-semibold">{cert.cert}</td>
                    <td className="px-6 py-4 text-muted-foreground">{cert.issuer}</td>
                    <td className="px-6 py-4 text-muted-foreground">{cert.issued}</td>
                    <td className="px-6 py-4 text-muted-foreground">{cert.expiry}</td>
                    <td className="px-6 py-4 text-center"><span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-xs font-medium">{cert.status}</span></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (tab === "assessments") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Assessments</h1><p className="text-sm text-muted-foreground">Quizzes and knowledge checks linked to learning courses.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><ClipboardList className="size-4" /> Create Assessment</button>
        </div>
        <div className="space-y-4">
          {assessments.map((asmnt, i) => (
            <motion.div key={asmnt.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-6 rounded-xl border border-border/50">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono text-xs text-primary">{asmnt.id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${asmnt.status === "Active" ? "bg-emerald-500/10 text-emerald-500" : asmnt.status === "Closed" ? "bg-muted text-muted-foreground" : "bg-amber-500/10 text-amber-500"}`}>{asmnt.status}</span>
                  </div>
                  <p className="font-semibold text-foreground">{asmnt.title}</p>
                  <p className="text-sm text-muted-foreground">Course: {asmnt.course} · Due: {asmnt.dueDate}</p>
                  <p className="text-sm text-muted-foreground">{asmnt.participants} participants</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-foreground">{asmnt.avgScore > 0 ? `${asmnt.avgScore}%` : "—"}</p>
                  <p className="text-xs text-muted-foreground">avg score</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // Default: training overview
  const totalEnrolled = courses.reduce((s, c) => s + c.enrolled, 0);
  const avgCompletion = Math.round(courses.reduce((s, c) => s + c.completion, 0) / courses.length);
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-foreground">Training</h1><p className="text-sm text-muted-foreground">Training overview and upcoming sessions.</p></div>
        <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Schedule Training</button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active Courses", value: courses.length, color: "text-blue-500" },
          { label: "Total Enrolled", value: totalEnrolled, color: "text-foreground" },
          { label: "Avg Completion", value: `${avgCompletion}%`, color: "text-emerald-500" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="glass-panel p-5 rounded-xl border border-border/50 text-center">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>
      <div className="space-y-3">
        {courses.map((c, i) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="glass-panel p-5 rounded-xl border border-border/50 flex items-center gap-4">
            <div className="p-2.5 bg-blue-500/10 rounded-lg flex-shrink-0"><BookOpen className="size-5 text-blue-500" /></div>
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1">
                <p className="font-semibold text-foreground">{c.title}</p>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.status === "Mandatory" ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-500"}`}>{c.status}</span>
              </div>
              <p className="text-xs text-muted-foreground">{c.category} · {c.instructor} · {c.duration}</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${c.completion}%` }} />
                </div>
                <span className="text-xs font-semibold">{c.completion}%</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
