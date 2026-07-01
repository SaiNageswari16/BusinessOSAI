import React from "react";
import { motion } from "framer-motion";
import { Plus, Users, Star, Briefcase, CheckCircle, Clock, XCircle, UserPlus, FileText } from "lucide-react";
import { useHrmsData } from "@/hooks/useHrmsData";

interface Props { tab?: string; }

const stageColor = (s: string) => {
  const m: Record<string, string> = {
    Applied: "bg-muted text-muted-foreground",
    Screening: "bg-blue-500/10 text-blue-500",
    Interview: "bg-amber-500/10 text-amber-500",
    Offer: "bg-purple-500/10 text-purple-500",
    Hired: "bg-emerald-500/10 text-emerald-500",
    Rejected: "bg-red-500/10 text-red-500",
  };
  return m[s] || "bg-muted text-muted-foreground";
};

export function RecruitmentManagement({ tab = "job_openings" }: Props) {
  const { mockJobOpenings, mockApplicants } = useHrmsData();

  if (tab === "applicants") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Applicants</h1><p className="text-sm text-muted-foreground">All candidates across active job openings.</p></div>
        </div>
        <div className="grid grid-cols-5 gap-3 text-center">
          {["Applied", "Screening", "Interview", "Offer", "Hired"].map((stage, i) => {
            const count = mockApplicants.filter(a => a.stage === stage).length;
            return (
              <motion.div key={stage} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className="glass-panel p-4 rounded-xl border border-border/50">
                <p className="text-2xl font-bold text-foreground">{count}</p>
                <p className="text-xs text-muted-foreground mt-1">{stage}</p>
              </motion.div>
            );
          })}
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Applicant</th>
                  <th className="px-6 py-4 font-medium">Applied For</th>
                  <th className="px-6 py-4 font-medium">Applied Date</th>
                  <th className="px-6 py-4 font-medium">Experience</th>
                  <th className="px-6 py-4 text-center font-medium">Rating</th>
                  <th className="px-6 py-4 text-center font-medium">Stage</th>
                </tr>
              </thead>
              <tbody>
                {mockApplicants.map((app, i) => (
                  <motion.tr key={app.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground">{app.name}</p>
                      <p className="text-xs text-muted-foreground">{app.email}</p>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{app.jobTitle}</td>
                    <td className="px-6 py-4 text-muted-foreground">{app.appliedDate}</td>
                    <td className="px-6 py-4 text-muted-foreground">{app.experience}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-0.5">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star key={i} className={`size-3 ${i < app.rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`} />
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${stageColor(app.stage)}`}>{app.stage}</span>
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

  if (tab === "interviews") {
    const interviews = [
      { id: "INT-001", candidate: "Nikhil Mehta", jobTitle: "Senior Backend Engineer", interviewerName: "Alex Rivera", date: "2026-07-05", time: "10:00 AM", type: "Technical", mode: "Video Call", status: "Scheduled" },
      { id: "INT-002", candidate: "Tom Wilson", jobTitle: "Sales Account Executive", interviewerName: "James Thompson", date: "2026-07-03", time: "2:30 PM", type: "Final HR", mode: "In-Person", status: "Completed" },
      { id: "INT-003", candidate: "Anjali Singh", jobTitle: "UX / Product Designer", interviewerName: "Aisha Patel", date: "2026-06-28", time: "11:00 AM", type: "Portfolio Review", mode: "Video Call", status: "Completed" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Interviews</h1><p className="text-sm text-muted-foreground">Scheduled and completed candidate interviews.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Schedule Interview</button>
        </div>
        <div className="space-y-4">
          {interviews.map((intvw, i) => (
            <motion.div key={intvw.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className={`glass-panel p-6 rounded-xl border ${intvw.status === "Scheduled" ? "border-blue-500/20 bg-blue-500/5" : "border-border/50"}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${intvw.status === "Scheduled" ? "bg-blue-500/10 text-blue-500" : "bg-emerald-500/10 text-emerald-500"}`}>{intvw.status}</span>
                    <span className="text-xs text-muted-foreground">{intvw.type} · {intvw.mode}</span>
                  </div>
                  <p className="font-semibold text-foreground text-lg">{intvw.candidate}</p>
                  <p className="text-sm text-muted-foreground">{intvw.jobTitle}</p>
                  <p className="text-sm text-muted-foreground mt-1">Interviewer: <span className="font-medium text-foreground">{intvw.interviewerName}</span></p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground">{intvw.date}</p>
                  <p className="text-sm text-muted-foreground">{intvw.time}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (tab === "offer_letters") {
    const offers = [
      { id: "OFR-001", candidate: "Tom Wilson", role: "Sales Account Executive", offerDate: "2026-07-02", ctc: 85000, expiryDate: "2026-07-09", status: "Awaiting Acceptance" },
      { id: "OFR-002", candidate: "Anjali Singh", role: "UX / Product Designer", offerDate: "2026-06-28", ctc: 105000, expiryDate: "2026-07-05", status: "Accepted" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Offer Letters</h1><p className="text-sm text-muted-foreground">Job offers extended to selected candidates.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><FileText className="size-4" /> Create Offer</button>
        </div>
        <div className="space-y-4">
          {offers.map((offer, i) => (
            <motion.div key={offer.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-6 rounded-xl border border-border/50">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-foreground text-lg">{offer.candidate}</p>
                  <p className="text-sm text-muted-foreground">{offer.role} · CTC: ${offer.ctc.toLocaleString()}/yr</p>
                  <p className="text-xs text-muted-foreground mt-1">Offered: {offer.offerDate} · Expires: {offer.expiryDate}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${offer.status === "Accepted" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>{offer.status}</span>
                  <button className="text-primary text-sm hover:underline">Download PDF</button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (tab === "onboarding") {
    const tasks = [
      { task: "Email & System Access Created", assignedTo: "IT", status: "Done", newHire: "Anjali Singh" },
      { task: "Offer Letter Signed", assignedTo: "HR", status: "Done", newHire: "Anjali Singh" },
      { task: "Background Verification", assignedTo: "HR", status: "Done", newHire: "Anjali Singh" },
      { task: "Workstation Setup", assignedTo: "IT", status: "In Progress", newHire: "Anjali Singh" },
      { task: "Department Orientation", assignedTo: "Manager", status: "Pending", newHire: "Anjali Singh" },
      { task: "Policy Training", assignedTo: "HR", status: "Pending", newHire: "Anjali Singh" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Onboarding</h1><p className="text-sm text-muted-foreground">Onboarding checklist and task tracking for new hires.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><UserPlus className="size-4" /> Start Onboarding</button>
        </div>
        <div className="glass-panel p-6 rounded-xl border border-border/50">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Anjali Singh — UX Designer</h3>
              <p className="text-sm text-muted-foreground">Start date: July 7, 2026</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-primary">67%</p>
              <p className="text-xs text-muted-foreground">Complete</p>
            </div>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden mb-6">
            <div className="h-full bg-primary rounded-full" style={{ width: "67%" }} />
          </div>
          <div className="space-y-3">
            {tasks.map((task, i) => (
              <div key={task.task} className="flex items-center gap-3 text-sm">
                <div className={`size-5 rounded-full flex items-center justify-center flex-shrink-0 ${task.status === "Done" ? "bg-emerald-500" : task.status === "In Progress" ? "bg-amber-500" : "border-2 border-muted"}`}>
                  {task.status === "Done" && <CheckCircle className="size-3 text-white" />}
                  {task.status === "In Progress" && <Clock className="size-3 text-white" />}
                </div>
                <span className={`flex-1 ${task.status === "Done" ? "text-muted-foreground line-through" : "text-foreground"}`}>{task.task}</span>
                <span className="text-xs text-muted-foreground">{task.assignedTo}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${task.status === "Done" ? "bg-emerald-500/10 text-emerald-500" : task.status === "In Progress" ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground"}`}>{task.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Default: job_openings
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-foreground">Job Openings</h1><p className="text-sm text-muted-foreground">{mockJobOpenings.filter(j => j.status === "Open").length} active openings · {mockJobOpenings.reduce((s, j) => s + j.applicants, 0)} total applicants</p></div>
        <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Post Job</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mockJobOpenings.map((job, i) => (
          <motion.div key={job.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="glass-panel p-6 rounded-xl border border-border/50 hover:shadow-elegant transition-all duration-300">
            <div className="flex justify-between items-start mb-3">
              <div className="p-2.5 bg-indigo-500/10 rounded-lg"><Briefcase className="size-5 text-indigo-500" /></div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${job.status === "Open" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>{job.status}</span>
            </div>
            <h3 className="font-bold text-foreground text-base mb-1">{job.title}</h3>
            <p className="text-sm text-muted-foreground">{job.department} · {job.location}</p>
            <p className="text-xs text-muted-foreground mt-1">{job.type} · {job.experience}</p>
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-border/50 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground"><Users className="size-4" /> {job.applicants} applicants</div>
              <div className="text-muted-foreground">{job.openings} opening{job.openings > 1 ? "s" : ""}</div>
              <p className="text-xs text-muted-foreground">Posted {job.postedDate}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
