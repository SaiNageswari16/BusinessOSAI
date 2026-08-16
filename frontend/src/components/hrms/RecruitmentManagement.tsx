import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Users,
  Star,
  Briefcase,
  CheckCircle,
  Clock,
  XCircle,
  UserPlus,
  FileText,
  Search,
  Filter,
  Trash2,
  Calendar,
  Link as LinkIcon,
  Check,
  AlertTriangle,
  ArrowRight,
  Upload,
  Sparkles,
  Building,
  MapPin,
  Globe,
  CheckSquare,
  Edit2,
  Send,
  Info,
  ExternalLink,
  DollarSign,
  Loader2,
  Mail
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Card } from "../ui/card";
import { Progress } from "../ui/progress";
import { recruitmentApi, employeesApi, inventoryApi, JobOpening, Applicant, Interview, Offer, Onboarding, Employee } from "../../lib/api-client";
import { useCurrency } from "@/hooks/use-currency";

interface Props {
  tab?: string;
}

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
    const { currency, formatCurrency } = useCurrency();
  // ─── Unified Database States ────────────────────────────────────────────────
  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [onboardings, setOnboardings] = useState<Onboarding[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const publicOpenJobs = jobs.filter((j) => j.status === "Open");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Custom toast notification
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showNotification = (message: string, type: "success" | "error" | "info" = "success") => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // ─── Load Data from API ─────────────────────────────────────────────────────
  
  const loadJobs = async () => {
    try {
      const res = await recruitmentApi.listJobs();
      setJobs(res.items);
    } catch (e: any) {
      console.error("Failed to load jobs", e);
      setError(e.message || "Failed to load job openings");
    }
  };

  const loadApplicants = async () => {
    try {
      const res = await recruitmentApi.listApplicants(
        appJobFilter || undefined,
        appStageFilter || undefined,
        appSourceFilter || undefined,
        appSearch || undefined
      );
      setApplicants(res.items);
    } catch (e: any) {
      console.error("Failed to load applicants", e);
    }
  };

  const loadInterviews = async () => {
    try {
      const res = await recruitmentApi.listInterviews();
      setInterviews(res.items);
    } catch (e: any) {
      console.error("Failed to load interviews", e);
    }
  };

  const loadOffers = async () => {
    try {
      const res = await recruitmentApi.listOffers();
      setOffers(res.items);
    } catch (e: any) {
      console.error("Failed to load offers", e);
    }
  };

  const loadOnboardings = async () => {
    try {
      const res = await recruitmentApi.listOnboardings();
      setOnboardings(res.items);
    } catch (e: any) {
      console.error("Failed to load onboardings", e);
    }
  };

  const loadEmployees = async () => {
    try {
      const res = await employeesApi.list(1, 100);
      setEmployees(res.items);
    } catch (e) {
      console.error("Failed to load employees", e);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([
        loadJobs(),
        loadApplicants(),
        loadInterviews(),
        loadOffers(),
        loadOnboardings(),
        loadEmployees()
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [tab]);

  // Trigger reload on filter search
  const [appSearch, setAppSearch] = useState("");
  const [appJobFilter, setAppJobFilter] = useState("");
  const [appSourceFilter, setAppSourceFilter] = useState("");
  const [appStageFilter, setAppStageFilter] = useState("");

  useEffect(() => {
    loadApplicants();
  }, [appJobFilter, appStageFilter, appSourceFilter, appSearch]);

  // ─── Modal & Form States ────────────────────────────────────────────────────
  
  // Job Post Wizard
  const [postJobOpen, setPostJobOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1); // 1: Method selection & parse/gen, 2: Form edit & portal posting
  const [creationMethod, setCreationMethod] = useState<"upload" | "ai" | null>(null);

  // Upload fields
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  // AI Creator fields
  const [aiContext, setAiContext] = useState("");
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiProgressText, setAiProgressText] = useState("");
  const [aiStreamingText, setAiStreamingText] = useState("");

  // Threshold Scores
  const [thresholdScoreVal, setThresholdScoreVal] = useState(70);

  // JD view mode (preview | edit)
  const [jdViewMode, setJdViewMode] = useState<"preview" | "edit">("preview");

  // Edit fields for Job Opening Form (Step 2)
  const [jobForm, setJobForm] = useState({
    id: "",
    title: "",
    department: "Engineering",
    location: "Remote",
    type: "Full-Time",
    experience: "3-5 years",
    openings: 1,
    description: "",
    criteria: "",
    portals: ["Careers Page"]
  });

  const [jobActionType, setJobActionType] = useState<"create" | "edit">("create");

  // Portal post syncing state
  const [syncingPortals, setSyncingPortals] = useState(false);
  const [syncingLog, setSyncingLog] = useState<string[]>([]);

  // Public Careers Portal Simulator
  const [careersPortalOpen, setCareersPortalOpen] = useState(false);
  const [simSelectedJob, setSimSelectedJob] = useState<JobOpening | null>(null);
  const [simCandidate, setSimCandidate] = useState({
    name: "",
    email: "",
    experience: "3 years",
    resumeText: "",
    source: "Careers Page"
  });

  // Applicant Detail View
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [candidateExpectedSalary, setCandidateExpectedSalary] = useState<number | null>(null);
  const [candidateProposedSalary, setCandidateProposedSalary] = useState<number | null>(null);
  const [candidateNewNote, setCandidateNewNote] = useState("");

  useEffect(() => {
    if (selectedApplicant) {
      setCandidateExpectedSalary(selectedApplicant.expected_salary || null);
      setCandidateProposedSalary(selectedApplicant.proposed_salary || null);
      setCandidateNewNote("");
    }
  }, [selectedApplicant]);
  
  // Interview Scheduler
  const [scheduleInterviewOpen, setScheduleInterviewOpen] = useState(false);
  const [interviewForm, setInterviewForm] = useState({
    applicantId: "",
    interviewerName: "Alex Rivera",
    date: "",
    time: "",
    duration: 60,
    type: "Technical",
    mode: "Video Call"
  });
  const [interviewerConflict, setInterviewerConflict] = useState<string | null>(null);

  // Offer Creator
  const [createOfferOpen, setCreateOfferOpen] = useState(false);
  const [offerForm, setOfferForm] = useState({
    applicantId: "",
    ctc: 90000,
    signingAuthority: "Priya Sharma",
    joiningDate: "",
    expiryDate: "",
    customTemplate: ""
  });

  // Onboarding Checklist
  const [selectedOnboardingId, setSelectedOnboardingId] = useState<string | null>(null);
  const [newOnboardingTask, setNewOnboardingTask] = useState("");
  const [newOnboardingAssignee, setNewOnboardingAssignee] = useState("HR");

  // Ref for AI streaming text window to auto-scroll
  const textStreamRef = useRef<HTMLDivElement>(null);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  // Real file upload and server-side PDF/TXT parser
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setUploadingFile(true);
    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Read authorization token
      const token = localStorage.getItem("token") || "";
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      setUploadProgress(45);
      const response = await fetch("/api/v1/hrms/recruitment/parse-file", {
        method: "POST",
        headers,
        body: formData
      });

      setUploadProgress(85);
      if (!response.ok) {
        throw new Error(`Parsing failed: ${response.statusText}`);
      }

      const res = await response.json();
      
      setJobForm({
        id: "",
        title: res.suggested_title,
        department: res.suggested_department,
        location: "Remote",
        type: "Full-Time",
        experience: "3-5 years",
        openings: 1,
        description: res.text || "No details extracted.",
        criteria: res.suggested_criteria,
        portals: ["Careers Page", "LinkedIn"]
      });
      setThresholdScoreVal(75);
      setWizardStep(2);
      showNotification("Document successfully parsed by backend!");
    } catch (err: any) {
      showNotification(err.message || "Failed to parse document", "error");
    } finally {
      setUploadingFile(false);
      setUploadProgress(100);
    }
  };

  // Real AI JD Generation integrated with Backend
  const handleGenerateAiJd = async () => {
    if (!aiContext.trim()) return;

    setGeneratingAi(true);
    setAiProgressText("Connecting to AI service...");
    setAiStreamingText("");

    try {
      // 1. Initiate backend API call immediately
      const apiPromise = recruitmentApi.generateJd(aiContext);

      // 2. Play visual log progress steps
      const logs = [
        "Analyzing role requirements...",
        "Querying Claude AI engine...",
        "Creating enterprise role definition...",
        "Drafting Key Responsibilities checklist...",
        "Formulating technical thresholds & evaluation criteria...",
        "Finalizing professional JD layout..."
      ];

      for (const log of logs) {
        setAiProgressText(log);
        await new Promise((resolve) => setTimeout(resolve, 600));
      }

      setAiProgressText("Assembling JD layouts...");
      const res = await apiPromise;

      // 3. Word-by-word streaming animation of the real generated text
      const generatedJdText = res.description;
      let streamed = "";
      const words = generatedJdText.split(" ");
      const streamBatchSize = Math.max(1, Math.floor(words.length / 35));

      for (let i = 0; i < words.length; i += streamBatchSize) {
        const batch = words.slice(i, i + streamBatchSize).join(" ") + " ";
        streamed += batch;
        setAiStreamingText(streamed);
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      setAiStreamingText(generatedJdText);

      setJobForm((p) => ({
        ...p,
        title: res.title,
        department: res.department,
        criteria: res.criteria,
        description: generatedJdText
      }));
      setThresholdScoreVal(res.threshold_score || 80);
      setWizardStep(2);
    } catch (e: any) {
      console.error("AI Generation failed:", e);
      showNotification(e.message || "Failed to generate job description via AI", "error");
    } finally {
      setGeneratingAi(false);
      setAiProgressText("");
    }
  };

  // Auto-scroll stream text
  useEffect(() => {
    if (textStreamRef.current) {
      textStreamRef.current.scrollTop = textStreamRef.current.scrollHeight;
    }
  }, [aiStreamingText]);

  // Handle Publishing/Posting Job Opening to Backend
  const handlePublishJob = async () => {
    if (!jobForm.title || !jobForm.description) return;

    setSyncingPortals(true);
    setSyncingLog([]);

    const logMessages = [
      "Connecting to Zoho Recruitment API...",
      "Validating schema format on Zoho...",
      "✅ Posted to Zoho Careers portal!",
      "Establishing link with Naukri.com gateway...",
      "Publishing Job Description layout on Naukri...",
      "✅ Posted to Naukri.com board!",
      "Connecting with LinkedIn Enterprise portal...",
      "✅ Published to LinkedIn Job board!",
      "Indexing on Indeed job network...",
      "✅ Published to Indeed!",
      "Generating Company Careers Portal page link...",
      "✅ Online and active on Company Careers page!"
    ];

    // Play visual portal publishing logs
    let logIdx = 0;
    const logInterval = setInterval(() => {
      if (logIdx < logMessages.length) {
        const currentMsg = logMessages[logIdx];
        if (currentMsg.includes("Zoho") && !jobForm.portals.includes("Zoho Careers")) {
          logIdx += 3;
          return;
        }
        if (currentMsg.includes("Naukri") && !jobForm.portals.includes("Naukri.com")) {
          logIdx += 3;
          return;
        }
        if (currentMsg.includes("LinkedIn") && !jobForm.portals.includes("LinkedIn")) {
          logIdx += 2;
          return;
        }
        if (currentMsg.includes("Indeed") && !jobForm.portals.includes("Indeed")) {
          logIdx += 2;
          return;
        }

        setSyncingLog((prev) => [...prev, logMessages[logIdx]]);
        logIdx++;
      } else {
        clearInterval(logInterval);
        completePublishAction();
      }
    }, 200);
  };

  const completePublishAction = async () => {
    try {
      const payloadData = {
        title: jobForm.title,
        department: jobForm.department,
        location: jobForm.location,
        type: jobForm.type,
        experience: jobForm.experience,
        openings: jobForm.openings,
        description: jobForm.description,
        threshold_score: thresholdScoreVal,
        portals: jobForm.portals,
        criteria: jobForm.criteria
      };

      if (jobActionType === "create") {
        await recruitmentApi.createJob(payloadData);
        showNotification("Job opening successfully posted and published!");
      } else {
        await recruitmentApi.updateJob(jobForm.id, payloadData);
        showNotification("Job description updated successfully!");
      }
      
      await loadJobs();
      setPostJobOpen(false);
      setWizardStep(1);
      setCreationMethod(null);
      setAiContext("");
      setUploadedFileName("");
    } catch (e: any) {
      showNotification(e.message || "Failed to publish job opening", "error");
    } finally {
      setSyncingPortals(false);
    }
  };

  // Open Edit Job Modal
  const openEditJob = (job: JobOpening) => {
    setJobForm({
      id: job.id,
      title: job.title,
      department: job.department,
      location: job.location,
      type: job.type,
      experience: job.experience,
      openings: job.openings,
      description: job.description,
      criteria: job.criteria,
      portals: job.portals
    });
    setThresholdScoreVal(job.threshold_score);
    setJobActionType("edit");
    setJdViewMode("preview");
    setWizardStep(2);
    setPostJobOpen(true);
  };

  // Simulation: Apply as candidate from Public Careers Portal
  const handlePublicApply = async () => {
    if (!simSelectedJob || !simCandidate.name || !simCandidate.email || !simCandidate.resumeText) return;

    try {
      await recruitmentApi.applyJob(simSelectedJob.id, {
        name: simCandidate.name,
        email: simCandidate.email,
        experience: simCandidate.experience,
        resume_text: simCandidate.resumeText,
        source: simCandidate.source
      });

      showNotification(`Application submitted successfully for ${simCandidate.name}!`);
      await Promise.all([loadApplicants(), loadJobs()]);

      setSimCandidate({
        name: "",
        email: "",
        experience: "3 years",
        resumeText: "",
        source: "Careers Page"
      });
      setSimSelectedJob(null);
      setCareersPortalOpen(false);
    } catch (e: any) {
      showNotification(e.message || "Failed to submit candidate application", "error");
    }
  };

  // Inject a candidate from LinkedIn / Indeed directly
  const handleInjectSimulatedCandidate = async (source: string) => {
    if (jobs.length === 0) return;
    const targetJob = jobs[Math.floor(Math.random() * jobs.length)];
    
    const names = ["Rohan Roy", "Samantha Vance", "Liam Neeson", "Sofia Vergara", "Devendra Patil"];
    const emails = ["rohan@mail.co", "sam.v@mail.com", "liam@movies.com", "sofia@tv.com", "devendra@tech.in"];
    const experiences = ["3 years", "5 years", "2 years", "4 years", "6 years"];
    const resumes = [
      `Familiar with design systems, creating client deliverables, wireframing workflows, and prototype layouts in Figma. Experienced designer.`,
      `Passionate developer coding backend systems using Python, FastAPI microservices, containerizing with Docker, and designing Postgres schemas.`,
      `Experienced growth marketer auditing SEO keywords, maintaining social handles, and structuring analytics data metrics.`,
      `Professional Sales Lead handling mid-market B2B negotiations, CRM pipeline administration, and contract proposals.`
    ];

    const idx = Math.floor(Math.random() * names.length);
    const resumeText = resumes[Math.floor(Math.random() * resumes.length)];

    try {
      await recruitmentApi.applyJob(targetJob.id, {
        name: names[idx],
        email: emails[idx],
        experience: experiences[idx],
        resume_text: resumeText,
        source: source
      });
      showNotification(`Injected candidate ${names[idx]} via simulated ${source} webhook.`);
      await Promise.all([loadApplicants(), loadJobs()]);
    } catch (e: any) {
      showNotification(e.message || "Failed to inject candidate", "error");
    }
  };

  // Update Applicant Rating
  const handleUpdateRating = async (appId: string, rating: number) => {
    try {
      const res = await recruitmentApi.updateApplicant(appId, { rating });
      await loadApplicants();
      if (selectedApplicant?.id === appId) {
        setSelectedApplicant(res);
      }
      showNotification("Candidate rating updated.");
    } catch (e: any) {
      showNotification(e.message || "Failed to update rating", "error");
    }
  };

  // Progress Applicant Stage
  const handleProgressStage = async (appId: string, stage: Applicant["stage"]) => {
    try {
      const res = await recruitmentApi.updateApplicant(appId, { stage });
      await loadAllData();
      if (selectedApplicant?.id === appId) {
        setSelectedApplicant(res);
      }

      showNotification(`Candidate stage advanced to ${stage}`);

      if (stage === "Interview") {
        setInterviewForm({
          applicantId: appId,
          interviewerName: "Alex Rivera",
          date: new Date().toISOString().split("T")[0],
          time: "10:00",
          duration: 60,
          type: "Technical",
          mode: "Video Call"
        });
        setScheduleInterviewOpen(true);
      } else if (stage === "Offer") {
        setOfferForm({
          applicantId: appId,
          ctc: 95000,
          signingAuthority: "Priya Sharma",
          joiningDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          customTemplate: `Subject: Appointment as [Designation] at Nimbus Retail Group\n\nDear [Candidate],\n\nWe are pleased to offer you a position...`
        });
        setCreateOfferOpen(true);
      }
    } catch (e: any) {
      showNotification(e.message || "Failed to update candidate stage", "error");
    }
  };

  const handleSaveNegotiation = async () => {
    if (!selectedApplicant) return;
    try {
      const res = await recruitmentApi.updateApplicant(selectedApplicant.id, {
        expected_salary: candidateExpectedSalary,
        proposed_salary: candidateProposedSalary
      });
      setSelectedApplicant(res);
      await loadApplicants();
      showNotification("Salary metrics updated successfully.");
    } catch (e: any) {
      showNotification(e.message || "Failed to update salary metrics", "error");
    }
  };

  const handleAddCandidateNote = async () => {
    if (!selectedApplicant || !candidateNewNote.trim()) return;
    try {
      const res = await recruitmentApi.addApplicantNote(selectedApplicant.id, candidateNewNote);
      setSelectedApplicant(res);
      await loadApplicants();
      setCandidateNewNote("");
      showNotification("Timeline log entry added.");
    } catch (e: any) {
      showNotification(e.message || "Failed to add timeline log", "error");
    }
  };

  // ─── Interview Scheduler Overlap Checking ──────────────────────────────────
  
  // Real-time conflict checker calling the backend
  const checkInterviewerConflict = async (interviewer: string, date: string, time: string, duration: number) => {
    if (!interviewer || !date || !time) return;

    try {
      const res = await recruitmentApi.checkOverlap(interviewer, date, time, duration);
      if (res.conflict) {
        setInterviewerConflict(res.detail || "Conflict: Interviewer has an overlap.");
      } else {
        setInterviewerConflict(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    checkInterviewerConflict(
      interviewForm.interviewerName,
      interviewForm.date,
      interviewForm.time,
      interviewForm.duration
    );
  }, [interviewForm.interviewerName, interviewForm.date, interviewForm.time, interviewForm.duration]);

  const handleScheduleInterview = async () => {
    if (!interviewForm.applicantId || !interviewForm.date || !interviewForm.time) return;
    if (interviewerConflict) return;

    try {
      await recruitmentApi.scheduleInterview({
        applicant_id: interviewForm.applicantId,
        interviewer_name: interviewForm.interviewerName,
        date: interviewForm.date,
        time: interviewForm.time,
        duration: interviewForm.duration,
        type: interviewForm.type,
        mode: interviewForm.mode
      });
      showNotification("Interview successfully scheduled!");
      await Promise.all([loadInterviews(), loadApplicants()]);
      setScheduleInterviewOpen(false);
    } catch (e: any) {
      showNotification(e.message || "Failed to schedule interview", "error");
    }
  };

  // Complete Interview Stage
  const handleMarkInterviewCompleted = async (intId: string, decision: "Selected" | "Rejected") => {
    try {
      await recruitmentApi.updateInterview(intId, { status: "Completed" });
      
      const intObj = interviews.find(i => i.id === intId);
      if (intObj) {
        const applicantId = intObj.applicant_id;
        const newStage: Applicant["stage"] = decision === "Selected" ? "Offer" : "Rejected";
        await recruitmentApi.updateApplicant(applicantId, { stage: newStage });
        showNotification(`Interview marked as complete. Candidate moved to ${newStage}.`);
        await loadAllData();

        if (decision === "Selected") {
          setOfferForm({
            applicantId,
            ctc: 100000,
            signingAuthority: "Priya Sharma",
            joiningDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            customTemplate: ""
          });
          setCreateOfferOpen(true);
        }
      }
    } catch (e: any) {
      showNotification(e.message || "Failed to complete interview logs", "error");
    }
  };

  // ─── Offer Letters ──────────────────────────────────────────────────────────
  
  const handleSendOffer = async () => {
    if (!offerForm.applicantId || !offerForm.joiningDate) return;

    try {
      const res = await recruitmentApi.createOffer({
        applicant_id: offerForm.applicantId,
        ctc: offerForm.ctc,
        expiry_date: offerForm.expiryDate,
        joining_date: offerForm.joiningDate,
        signer_name: offerForm.signingAuthority,
        custom_template: offerForm.customTemplate
      });

      showNotification("Offer letter drafted in database.");
      await loadAllData();
      setCreateOfferOpen(false);
      
      // Auto trigger send email simulation
      await handleEmailOffer(res.id);
    } catch (e: any) {
      showNotification(e.message || "Failed to create offer letter", "error");
    }
  };

  const handleEmailOffer = async (offerId: string) => {
    try {
      const res = await recruitmentApi.sendOfferEmail(offerId);
      showNotification(res.message || "Offer letter email forwarded successfully!");
      await loadOffers();
    } catch (e: any) {
      showNotification(e.message || "Failed to forward offer email", "error");
    }
  };

  const handleSimulateOfferResponse = async (ofrId: string, status: "Accepted" | "Declined") => {
    try {
      await recruitmentApi.updateOfferStatus(ofrId, { status });
      showNotification(`Candidate responded with: ${status}!`);
      await loadAllData();
    } catch (e: any) {
      showNotification(e.message || "Failed to register candidate offer response", "error");
    }
  };

  // ─── Onboarding Checklist Management ────────────────────────────────────────
  
  const handleToggleOnboardingTask = async (onbId: string, taskName: string) => {
    const onbObj = onboardings.find(o => o.id === onbId);
    if (!onbObj) return;

    const nextStatusMap: Record<string, "Pending" | "In Progress" | "Done"> = {
      "Pending": "In Progress",
      "In Progress": "Done",
      "Done": "Pending"
    };

    const updatedTasks = onbObj.tasks_json.map(t => {
      if (t.task === taskName) {
        return { ...t, status: nextStatusMap[t.status] };
      }
      return t;
    });

    try {
      await recruitmentApi.updateOnboarding(onbId, { tasks: updatedTasks });
      await loadOnboardings();
    } catch (e: any) {
      showNotification(e.message || "Failed to update onboarding task status", "error");
    }
  };

  const handleAddOnboardingTask = async (onbId: string) => {
    if (!newOnboardingTask.trim()) return;

    const onbObj = onboardings.find(o => o.id === onbId);
    if (!onbObj) return;

    const newTask = {
      task: newOnboardingTask,
      assignedTo: newOnboardingAssignee,
      status: "Pending"
    };

    try {
      await recruitmentApi.updateOnboarding(onbId, { tasks: [...onbObj.tasks_json, newTask] });
      await loadOnboardings();
      setNewOnboardingTask("");
      showNotification("Onboarding checklist task added.");
    } catch (e: any) {
      showNotification(e.message || "Failed to add task", "error");
    }
  };

  const handleDeleteOnboarding = async (onbId: string) => {
    try {
      await recruitmentApi.deleteOnboarding(onbId);
      showNotification("Onboarding checklist deleted.");
      await loadOnboardings();
      if (selectedOnboardingId === onbId) setSelectedOnboardingId(null);
    } catch (e: any) {
      showNotification(e.message || "Failed to delete onboarding profile", "error");
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      await recruitmentApi.deleteJob(jobId);
      showNotification("Job opening closed and removed.");
      await loadJobs();
    } catch (e: any) {
      showNotification(e.message || "Failed to remove job opening", "error");
    }
  };

  const handlePublishToZoho = async (jobId: string) => {
    try {
      showNotification("Publishing Job Opening to Zoho Recruit...", "info");
      await inventoryApi.publishJobToZoho(jobId);
      showNotification("Job opening successfully published to Zoho Recruit!", "success");
      await loadJobs();
    } catch (e: any) {
      console.error(e);
      showNotification(e.message || "Failed to publish job to Zoho Recruit.", "error");
    }
  };

  const handleDownloadJdPdf = (job: JobOpening) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showNotification("Popup blocked! Please allow popups to save/download the JD.", "error");
      return;
    }
    
    const markdownToHtml = (md: string) => {
      return md
        .replace(/# (.*)/g, '<h1 class="text-2xl font-extrabold text-slate-900 border-b pb-3 mb-4 mt-4">$1</h1>')
        .replace(/## (.*)/g, '<h2 class="text-lg font-bold text-slate-800 border-b pb-2 mb-3 mt-6">$1</h2>')
        .replace(/### (.*)/g, '<h3 class="text-md font-bold text-slate-700 mb-2 mt-4">$1</h3>')
        .replace(/\- (.*)/g, '<li class="text-sm text-slate-600 ml-4 mb-1.5 list-disc">$1</li>')
        .replace(/\n\n/g, '<p class="my-3 text-sm text-slate-600 leading-relaxed"></p>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    };

    const formattedDesc = markdownToHtml(job.description || "");

    printWindow.document.write(`
      <html>
        <head>
          <title>${job.title} - Job Description</title>
                  <script src="https://cdn.tailwindcss.com"></script>
                  <style>
                    @media print {
                      body {
                        padding: 0;
                        margin: 0;
                        background: white;
                      }
                      .no-print {
                        display: none;
                      }
                      .page-card {
                        border: none;
                        box-shadow: none;
                        padding: 0;
                        margin: 0;
                      }
                    }
                  </style>
                </head>
                <body class="bg-slate-50 min-h-screen p-6 text-slate-800 antialiased font-sans">
                  <div class="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-100 page-card">
                    <div class="no-print flex justify-between items-center bg-indigo-50 border border-indigo-100 p-4 rounded-xl mb-6">
                      <div class="text-xs text-indigo-700 font-medium">
                        📄 Confirm JD layout details, then click "Print/Save as PDF".
                      </div>
                      <button 
                        onclick="window.print()" 
                        class="bg-indigo-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-indigo-700 active:scale-[0.98] transition-all"
                      >
                        Print / Save PDF
                      </button>
                    </div>
                    
                    <div class="flex justify-between items-start border-b pb-4 mb-6">
                      <div>
                        <span class="text-xs font-bold uppercase tracking-wider text-indigo-600">${job.department} Department</span>
                        <h1 class="text-2xl font-extrabold text-slate-900 mt-1">${job.title}</h1>
                        <p class="text-xs text-slate-500 mt-2">Location: ${job.location} · Job Type: ${job.type} · Experience: ${job.experience}</p>
                      </div>
                      <div class="text-right">
                        <div class="text-xl font-bold text-slate-900">${job.openings}</div>
                        <div class="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Openings</div>
                      </div>
                    </div>
                    
                    <div class="prose max-w-none">
                      ${formattedDesc}
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
    `);
    printWindow.document.close();
  };

  const activeOnboarding = onboardings.find(o => o.id === selectedOnboardingId) || onboardings[0];

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full">
      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-4 right-4 z-50 p-4 rounded-xl border shadow-xl flex items-center gap-3 max-w-sm ${
              notification.type === "error" ? "bg-red-500/10 border-red-500/30 text-red-500" :
              notification.type === "info" ? "bg-blue-500/10 border-blue-500/30 text-blue-500" :
              "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
            }`}
          >
            {notification.type === "error" ? <AlertTriangle className="size-5 flex-shrink-0" /> : <CheckCircle className="size-5 flex-shrink-0" />}
            <span className="text-xs font-semibold">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-3">
          <Loader2 className="size-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Contacting database pipelines...</p>
        </div>
      ) : error ? (
        <div className="p-12 text-center text-red-500 space-y-4">
          <AlertTriangle className="size-12 mx-auto" />
          <p>{error}</p>
          <Button onClick={loadAllData}>Retry Connection</Button>
        </div>
      ) : (
        <>
          {/* TAB 1: JOB OPENINGS */}
          {tab === "job_openings" && (
            <div className="p-6 space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Job Openings</h1>
                  <p className="text-sm text-muted-foreground">
                    {jobs.filter((j) => j.status === "Open").length} active openings · {jobs.reduce((s, j) => s + j.applicants_count, 0)} total applicants
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setCareersPortalOpen(true)} variant="outline" className="border-primary/30 text-primary gap-2 hover:bg-primary/5">
                    <Globe className="size-4" /> Public Careers Portal
                  </Button>
                  <Button onClick={() => { setJobActionType("create"); setJdViewMode("preview"); setJobForm({ id: "", title: "", department: "Engineering", location: "Remote", type: "Full-Time", experience: "3-5 years", openings: 1, description: "", criteria: "", portals: ["Careers Page"] }); setPostJobOpen(true); }} className="gradient-brand text-white gap-2">
                    <Plus className="size-4" /> Post Job
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {jobs.map((job, i) => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-panel p-6 rounded-xl border border-border/50 hover:shadow-elegant transition-all duration-300 group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <div className="p-2.5 bg-indigo-500/10 rounded-lg"><Briefcase className="size-5 text-indigo-500" /></div>
                        <div className="flex gap-1.5 items-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            job.status === "Open" ? "bg-emerald-500/15 text-emerald-500" :
                            job.status === "On Hold" ? "bg-amber-500/15 text-amber-500" : "bg-muted text-muted-foreground"
                          }`}>
                            {job.status}
                          </span>
                          <button onClick={() => handleDeleteJob(job.id)} className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10">
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                      <h3 className="font-bold text-foreground text-lg mb-1 leading-snug">{job.title}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1"><Building className="size-3.5" /> {job.department} · <MapPin className="size-3.5" /> {job.location}</p>
                      <p className="text-xs text-muted-foreground mt-1.5">{job.type} · Exp: {job.experience} · Req Threshold: <span className="font-semibold text-primary">{job.threshold_score}%</span></p>
                      
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {job.criteria ? job.criteria.split(",").filter(Boolean).map(c => (
                          <span key={c} className="text-[10px] bg-muted/65 px-2 py-0.5 rounded border border-border/30 text-muted-foreground font-medium">{c.trim()}</span>
                        )) : null}
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-border/40">
                      <div className="flex justify-between items-center text-xs text-muted-foreground mb-3">
                        <span className="flex items-center gap-1 font-semibold text-foreground"><Users className="size-4" /> {job.applicants_count} applicants</span>
                        <span>{job.openings} opening{job.openings > 1 ? "s" : ""}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[9px] uppercase font-bold text-muted-foreground mr-1">Portals:</span>
                          {job.portals?.map(p => (
                            <span
                              key={p}
                              className="px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-[9px] font-bold text-primary mr-1"
                            >
                              {p}
                            </span>
                          )) || null}
                        </div>

                        <div className="flex items-center gap-2">
                          {job.provider === "zoho" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle className="size-3" /> Zoho Synced
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePublishToZoho(job.id)}
                              className="text-[9px] h-6 px-2 border-indigo-500/30 hover:bg-indigo-500/10 text-indigo-500 font-semibold gap-1"
                            >
                              Publish to Zoho
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDownloadJdPdf(job)}
                            className="text-xs text-muted-foreground gap-1 hover:bg-muted/80"
                          >
                            <FileText className="size-3" /> PDF
                          </Button>

                          <Button size="sm" variant="ghost" onClick={() => openEditJob(job)} className="text-xs text-primary gap-1 group-hover:bg-primary/10 hover:underline">
                            <Edit2 className="size-3" /> Edit JD
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: APPLICANTS */}
          {tab === "applicants" && (
            <div className="p-6 space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Applicants Directory</h1>
                  <p className="text-sm text-muted-foreground">Monitor candidate matching thresholds and progress selection phases.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleInjectSimulatedCandidate("LinkedIn")} className="gap-1 border-indigo-500/30 hover:bg-indigo-500/10">
                    <Sparkles className="size-4 text-indigo-500" /> Inject LinkedIn Candidate
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleInjectSimulatedCandidate("Indeed")} className="gap-1 border-orange-500/30 hover:bg-orange-500/10">
                    <Sparkles className="size-4 text-orange-500" /> Inject Indeed Candidate
                  </Button>
                </div>
              </div>

              {/* Filters grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-muted/15 p-4 rounded-xl border border-border/40">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search candidate name..."
                    value={appSearch}
                    onChange={(e) => setAppSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <select
                  value={appJobFilter}
                  onChange={(e) => setAppJobFilter(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none"
                >
                  <option value="">All Job Openings</option>
                  {jobs.map(j => (
                    <option key={j.id} value={j.id}>{j.title}</option>
                  ))}
                </select>
                <select
                  value={appSourceFilter}
                  onChange={(e) => setAppSourceFilter(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none"
                >
                  <option value="">All Sourcing Portals</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Indeed">Indeed</option>
                  <option value="Naukri.com">Naukri.com</option>
                  <option value="Zoho Careers">Zoho Careers</option>
                  <option value="Careers Page">Careers Page</option>
                </select>
                <select
                  value={appStageFilter}
                  onChange={(e) => setAppStageFilter(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none"
                >
                  <option value="">All Stages</option>
                  <option value="Applied">Applied</option>
                  <option value="Screening">Screening</option>
                  <option value="Interview">Interview</option>
                  <option value="Offer">Offer</option>
                  <option value="Hired">Hired</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              {/* Table */}
              <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
                <table className="w-full text-sm text-left font-sans">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b border-border/40">
                    <tr>
                      <th className="px-6 py-4">Applicant</th>
                      <th className="px-6 py-4">Applied For</th>
                      <th className="px-6 py-4">Match Score</th>
                      <th className="px-6 py-4">Source</th>
                      <th className="px-6 py-4 text-center">Rating</th>
                      <th className="px-6 py-4 text-center">Stage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applicants.map((app) => {
                      const jobObj = jobs.find(j => j.id === app.job_id);
                      const threshold = jobObj?.threshold_score || 70;
                      const scorePassed = app.match_score >= threshold;
                      
                      return (
                        <tr
                          key={app.id}
                          onClick={() => setSelectedApplicant(app)}
                          className="border-b border-border/45 last:border-0 hover:bg-muted/15 cursor-pointer transition-colors"
                        >
                          <td className="px-6 py-4">
                            <p className="font-semibold text-foreground">{app.name}</p>
                            <p className="text-xs text-muted-foreground">{app.email}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-medium text-foreground">{app.job_title}</p>
                            <p className="text-xs text-muted-foreground">Exp: {app.experience}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center justify-center size-8 rounded-full text-xs font-bold ${
                                scorePassed ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-orange-500/10 text-orange-500 border border-orange-500/20"
                              }`}>
                                {app.match_score}%
                              </span>
                              <span className="text-xs text-muted-foreground">(Req: {threshold}%)</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-0.5 rounded-full text-xs bg-muted/50 border border-border/30 text-muted-foreground">{app.source}</span>
                          </td>
                          <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-center gap-0.5">
                              {Array.from({ length: 5 }, (_, idx) => (
                                <Star
                                  key={idx}
                                  onClick={() => handleUpdateRating(app.id, idx + 1)}
                                  className={`size-4 cursor-pointer transition-transform hover:scale-125 ${
                                    idx < app.rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/35"
                                  }`}
                                />
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${stageColor(app.stage)}`}>
                              {app.stage}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: INTERVIEWS */}
          {tab === "interviews" && (
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Interview Calendars</h1>
                  <p className="text-sm text-muted-foreground">Manage candidate sessions and ensure zero scheduling overlaps.</p>
                </div>
                <Button onClick={() => setScheduleInterviewOpen(true)} className="gradient-brand text-white gap-2">
                  <Plus className="size-4" /> Schedule Interview
                </Button>
              </div>

              <div className="space-y-4">
                {interviews.map((intvw) => (
                  <div
                    key={intvw.id}
                    className={`glass-panel p-6 rounded-xl border relative overflow-hidden ${
                      intvw.status === "Scheduled" ? "border-blue-500/35 bg-blue-500/5" : "border-border/50"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            intvw.status === "Scheduled" ? "bg-blue-500/15 text-blue-500" : "bg-emerald-500/15 text-emerald-500"
                          }`}>
                            {intvw.status}
                          </span>
                          <span className="text-xs text-muted-foreground">{intvw.type} · {intvw.mode}</span>
                        </div>
                        <p className="font-bold text-foreground text-lg">{intvw.candidate}</p>
                        <p className="text-sm text-muted-foreground">{intvw.job_title}</p>
                        <p className="text-sm text-muted-foreground mt-1">Interviewer: <span className="font-semibold text-foreground">{intvw.interviewer_name}</span></p>
                        
                        {intvw.meeting_link && intvw.status === "Scheduled" && (
                          <a
                            href={intvw.meeting_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline mt-2 bg-primary/10 px-2 py-1 rounded border border-primary/20"
                          >
                            <LinkIcon className="size-3" /> Connect Google Meet <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground flex items-center gap-1 justify-end"><Calendar className="size-4" /> {intvw.date}</p>
                        <p className="text-sm text-muted-foreground mt-1">{intvw.time} ({intvw.duration} mins)</p>

                        {intvw.status === "Scheduled" && (
                          <div className="flex gap-2 justify-end mt-4">
                            <Button size="sm" variant="outline" className="border-emerald-500/35 text-emerald-500 hover:bg-emerald-500/10" onClick={() => handleMarkInterviewCompleted(intvw.id, "Selected")}>
                              Pass & Offer
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleMarkInterviewCompleted(intvw.id, "Rejected")}>
                              Fail Interview
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: OFFER LETTERS */}
          {tab === "offer_letters" && (
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Offer Correspondence</h1>
                  <p className="text-sm text-muted-foreground">Draft professional credentials, preview legal constructs, forward to email, and trace candidate responses.</p>
                </div>
                <Button onClick={() => setCreateOfferOpen(true)} className="gradient-brand text-white gap-2">
                  <Plus className="size-4" /> Create Offer Letter
                </Button>
              </div>

              <div className="space-y-4">
                {offers.map((offer) => (
                  <div key={offer.id} className="glass-panel p-6 rounded-xl border border-border/50">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            offer.status === "Accepted" ? "bg-emerald-500/15 text-emerald-500" :
                            offer.status === "Declined" ? "bg-red-500/15 text-red-500" : "bg-amber-500/15 text-amber-500"
                          }`}>
                            {offer.status}
                          </span>
                          <span className="text-xs text-muted-foreground">Extended: {offer.offer_date}</span>
                          {offer.email_sent && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 text-[10px] font-bold"><Mail className="size-3" /> Forwarded via Mail</span>
                          )}
                        </div>
                        <h3 className="font-bold text-foreground text-lg">{offer.candidate}</h3>
                        <p className="text-sm text-muted-foreground">{offer.role} · CTC: <span className="font-semibold text-foreground">{currency.symbol}{offer.ctc.toLocaleString()}/yr</span></p>
                        <p className="text-xs text-muted-foreground mt-1">Target Joining: {offer.joining_date} · Expiry: {offer.expiry_date}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {offer.status === "Awaiting Acceptance" && (
                          <>
                            <Button size="sm" variant="outline" className="border-blue-500/40 text-blue-500 hover:bg-blue-500/10 gap-1.5" onClick={() => handleEmailOffer(offer.id)}>
                              <Send className="size-3.5" /> Re-forward Mail
                            </Button>
                            <Button size="sm" variant="outline" className="border-emerald-500/35 text-emerald-500 hover:bg-emerald-500/10" onClick={() => handleSimulateOfferResponse(offer.id, "Accepted")}>
                              Simulate Accept
                            </Button>
                            <Button size="sm" variant="outline" className="border-red-500/35 text-red-500 hover:bg-red-500/10" onClick={() => handleSimulateOfferResponse(offer.id, "Declined")}>
                              Simulate Decline
                            </Button>
                          </>
                        )}
                        {offer.status === "Accepted" && (
                          <Button size="sm" className="gradient-brand text-white gap-1.5" onClick={() => handleProgressStage(offer.applicant_id, "Hired")}>
                            <UserPlus className="size-4" /> Start Onboarding
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: ONBOARDING */}
          {tab === "onboarding" && (
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Onboarding Orchestration</h1>
                  <p className="text-sm text-muted-foreground">Monitor candidate checklist integration, assign compliance tasks, and configure hardware allocations.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-3">
                  <h3 className="font-bold text-sm text-foreground uppercase tracking-wider mb-2">New Hires</h3>
                  {onboardings.map(onb => (
                    <div
                      key={onb.id}
                      onClick={() => setSelectedOnboardingId(onb.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        (selectedOnboardingId === onb.id || (!selectedOnboardingId && activeOnboarding?.id === onb.id))
                          ? "border-primary bg-primary/5 shadow-md"
                          : "border-border hover:bg-muted/15"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-foreground text-sm">{onb.new_hire}</h4>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteOnboarding(onb.id); }}
                          className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">{onb.role}</p>
                      <div className="mt-3 flex items-center justify-between gap-4 text-[11px]">
                        <span className="text-muted-foreground">Start: {onb.start_date}</span>
                        <span className="font-bold text-primary">{onb.progress}% Done</span>
                      </div>
                      <Progress value={onb.progress} className="h-1.5 mt-1.5" />
                    </div>
                  ))}
                </div>

                <div className="lg:col-span-2">
                  {activeOnboarding ? (
                    <div className="glass-panel p-6 rounded-xl border border-border/50 space-y-6">
                      <div className="flex justify-between items-start border-b pb-4 border-border/50">
                        <div>
                          <h3 className="text-lg font-bold text-foreground">{activeOnboarding.new_hire}</h3>
                          <p className="text-xs text-muted-foreground">{activeOnboarding.role} · Joining: {activeOnboarding.start_date}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-3xl font-extrabold text-primary">{activeOnboarding.progress}%</span>
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Integrations Completed</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5"><CheckSquare className="size-4 text-primary" /> Onboarding Checklist</h4>
                        
                        <div className="space-y-2.5">
                          {activeOnboarding.tasks_json.map((task, idx) => (
                            <div
                              key={idx}
                              onClick={() => handleToggleOnboardingTask(activeOnboarding.id, task.task)}
                              className="flex items-center justify-between p-3 rounded-lg border border-border/40 hover:bg-muted/15 cursor-pointer transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`size-5 rounded flex items-center justify-center border ${
                                  task.status === "Done" ? "bg-emerald-500 border-emerald-500 text-white" :
                                  task.status === "In Progress" ? "bg-amber-500 border-amber-500 text-white" : "border-muted-foreground/30 text-transparent"
                                }`}>
                                  {task.status === "Done" && <Check className="size-3" />}
                                  {task.status === "In Progress" && <Clock className="size-3" />}
                                </div>
                                <span className={`text-xs ${task.status === "Done" ? "line-through text-muted-foreground" : "text-foreground font-medium"}`}>
                                  {task.task}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground">{task.assignedTo}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                                  task.status === "Done" ? "bg-emerald-500/10 text-emerald-500" :
                                  task.status === "In Progress" ? "bg-amber-500/10 text-amber-500" : "bg-muted/55 text-muted-foreground"
                                }`}>
                                  {task.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-border/40 space-y-3">
                        <h4 className="font-bold text-xs text-foreground uppercase tracking-wide">Add Custom Onboarding Task</h4>
                        <div className="flex gap-2">
                          <Input
                            type="text"
                            placeholder="e.g. Set up database credentials..."
                            value={newOnboardingTask}
                            onChange={(e) => setNewOnboardingTask(e.target.value)}
                            className="flex-1 text-xs h-9"
                          />
                          <select
                            value={newOnboardingAssignee}
                            onChange={(e) => setNewOnboardingAssignee(e.target.value)}
                            className="rounded-md border border-input bg-background px-3 py-1 text-xs focus-visible:outline-none h-9"
                          >
                            <option value="IT">IT Division</option>
                            <option value="HR">HR Business</option>
                            <option value="Manager">Manager</option>
                            <option value="Security">Security</option>
                          </select>
                          <Button size="sm" onClick={() => handleAddOnboardingTask(activeOnboarding.id)} className="h-9">
                            Add Task
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-20 text-muted-foreground border border-dashed rounded-xl glass-panel">
                      Select a new hire onboarding record to view checklist parameters.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Post Job Modal (with AI and Upload JD Wizards) */}
      <AnimatePresence>
        {postJobOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-border flex justify-between items-center bg-muted/20">
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    {jobActionType === "create" ? "Post New Job Opening" : "Edit Job Opening Details"}
                  </h3>
                  <p className="text-xs text-muted-foreground">Step {wizardStep} of 2</p>
                </div>
                <button onClick={() => setPostJobOpen(false)} className="p-1 rounded hover:bg-muted/40">
                  <XCircle className="size-6 text-muted-foreground hover:text-foreground" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {wizardStep === 1 && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div
                        onClick={() => setCreationMethod("upload")}
                        className={`p-6 rounded-xl border-2 cursor-pointer text-center space-y-3 transition-all ${
                          creationMethod === "upload" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/15"
                        }`}
                      >
                        <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary">
                          <Upload className="size-6" />
                        </div>
                        <h4 className="font-bold text-foreground">Upload Existing JD</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Drag and drop PDF/DOCX job credentials to prefill parameters automatically.
                        </p>
                      </div>

                      <div
                        onClick={() => setCreationMethod("ai")}
                        className={`p-6 rounded-xl border-2 cursor-pointer text-center space-y-3 transition-all ${
                          creationMethod === "ai" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/15"
                        }`}
                      >
                        <div className="size-12 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto text-indigo-500 animate-pulse">
                          <Sparkles className="size-6" />
                        </div>
                        <h4 className="font-bold text-foreground">Create JD using AI</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Provide short roles metadata context and stream an enterprise formatted JD description.
                        </p>
                      </div>
                    </div>

                    <AnimatePresence mode="wait">
                      {creationMethod === "upload" && (
                        <motion.div
                          key="upload"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="border-2 border-dashed border-border rounded-xl p-8 text-center bg-muted/5 relative"
                        >
                          <input
                            type="file"
                            accept=".pdf,.txt,.doc,.docx"
                            onChange={handleFileUpload}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            disabled={uploadingFile}
                          />
                          <Upload className="size-8 mx-auto text-muted-foreground mb-3" />
                          <p className="text-sm font-semibold text-foreground">
                            {uploadedFileName ? `Selected: ${uploadedFileName}` : "Click or Drag & Drop JD file to upload"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">Supports PDF, DOCX, TXT (Max 5MB)</p>

                          {uploadingFile && (
                            <div className="mt-4 max-w-xs mx-auto space-y-2">
                              <p className="text-xs text-primary font-semibold flex items-center gap-1.5 justify-center"><Clock className="size-3 text-primary animate-spin" /> Parsing document with parser engine...</p>
                              <Progress value={uploadProgress} className="h-2" />
                            </div>
                          )}
                        </motion.div>
                      )}

                      {creationMethod === "ai" && (
                        <motion.div
                          key="ai"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="space-y-4"
                        >
                          {/* ── Template Picker ── */}
                          <div>
                            <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">Start from a Template</label>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                {
                                  icon: "⚙️",
                                  label: "Backend Engineer",
                                  prompt: "Senior Backend Engineer with 5+ years experience. Must know Python, FastAPI, PostgreSQL, Docker, AWS Lambda, Redis. Strong background in REST API design, microservices architecture, and CI/CD pipelines. Remote position, salary 110-140k USD."
                                },
                                {
                                  icon: "🎨",
                                  label: "Frontend Developer",
                                  prompt: "Senior Frontend Developer with 4+ years experience in React, TypeScript, TailwindCSS, and Vite. Must have led UI architecture on at least one production SaaS product. Experience with Figma-to-code workflows and state management using Zustand or Redux. Remote-first, equity included."
                                },
                                {
                                  icon: "📊",
                                  label: "Data Scientist",
                                  prompt: "Senior Data Scientist with 5+ years experience. Expertise in Python, pandas, scikit-learn, PyTorch or TensorFlow. Must have built production ML pipelines and worked with large-scale data warehouse systems. Background in A/B testing and feature engineering strongly preferred."
                                },
                                {
                                  icon: "🚀",
                                  label: "Product Manager",
                                  prompt: "Senior Product Manager with 6+ years experience in B2B SaaS products. Must have owned product roadmaps, written detailed PRDs, and led cross-functional teams of engineers and designers. Excellent data-driven decision making using Amplitude or Mixpanel. Onsite Mumbai."
                                },
                                {
                                  icon: "🔐",
                                  label: "DevOps / SRE",
                                  prompt: "DevOps / Site Reliability Engineer with 4+ years experience. Must know Kubernetes, Terraform, GitHub Actions, ArgoCD, Prometheus, and Grafana. Experience with multi-cloud deployments (AWS + GCP) and zero-downtime deployment strategies. Strong scripting in Bash and Python."
                                },
                                {
                                  icon: "🎯",
                                  label: "Sales Executive",
                                  prompt: "Enterprise Sales Executive with 5+ years B2B SaaS sales experience. Must have closed deals above ₹50L ARR and managed CRM pipelines using Salesforce. Excellent communication, negotiation, and demo skills. Comfortable with outbound prospecting and LinkedIn outreach. Mumbai / Delhi."
                                },
                                {
                                  icon: "🧑‍🤝‍🧑",
                                  label: "HR Recruiter",
                                  prompt: "Talent Acquisition Specialist with 3+ years of full-cycle recruitment experience for technical roles. Must have used ATS tools (Zoho Recruit, Lever, or Greenhouse), conducted structured interviews, and collaborated closely with engineering leads. Knowledge of Indian labor law preferred."
                                },
                                {
                                  icon: "📱",
                                  label: "Mobile Developer",
                                  prompt: "React Native Mobile Developer with 4+ years cross-platform app development experience. Must have shipped apps on both iOS and Android App Stores. Proficient in Expo, Redux Toolkit, React Navigation, REST APIs, and push notifications integration. Experience with Apple TestFlight and Play Console."
                                }
                              ].map((t) => (
                                <button
                                  key={t.label}
                                  type="button"
                                  disabled={generatingAi}
                                  onClick={() => setAiContext(t.prompt)}
                                  className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all hover:bg-primary/5 hover:border-primary/30 ${aiContext === t.prompt ? "border-primary/60 bg-primary/10 text-primary" : "border-border/50 bg-muted/10 text-muted-foreground"}`}
                                >
                                  <span className="text-lg leading-none">{t.icon}</span>
                                  <span className="text-[11px] font-semibold">{t.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* ── Context Prompt Input ── */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="block text-xs font-semibold text-muted-foreground">Role Context Prompt</label>
                              {aiContext && (
                                <button
                                  type="button"
                                  onClick={() => setAiContext("")}
                                  className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                            <Textarea
                              placeholder="Describe the role in detail — title, skills, years of experience, salary range, location, company culture, must-haves vs. nice-to-haves..."
                              value={aiContext}
                              onChange={(e) => setAiContext(e.target.value)}
                              rows={4}
                              disabled={generatingAi}
                              className="text-xs"
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">Tip: The more specific you are, the better Claude's output.</p>
                          </div>

                          <Button
                            onClick={handleGenerateAiJd}
                            disabled={generatingAi || !aiContext.trim()}
                            className="gradient-brand text-white w-full gap-2"
                          >
                            <Sparkles className="size-4" /> {generatingAi ? "Generating with Claude AI..." : "Generate Enterprise JD using AI"}
                          </Button>

                          {generatingAi && (
                            <div className="space-y-2 border border-border/80 rounded-xl p-4 bg-muted/10">
                              <p className="text-xs text-indigo-500 font-bold flex items-center gap-1.5">
                                <Sparkles className="size-3.5 text-indigo-500 animate-spin" /> {aiProgressText || "Claude AI processing..."}
                              </p>
                              <div
                                ref={textStreamRef}
                                className="bg-background/90 p-4 border border-border/40 rounded-lg text-xs leading-relaxed max-h-[180px] overflow-y-auto whitespace-pre-wrap font-mono"
                              >
                                {aiStreamingText || "Awaiting Claude AI output..."}
                              </div>
                            </div>
                          )}

                          {!generatingAi && aiStreamingText && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 border border-primary/20 rounded-xl p-5 bg-primary/5 text-left">
                              {/* Header with Generate Again */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs font-bold text-primary">
                                  <Sparkles className="size-4 text-primary" /> Claude AI Generated JD — Review & Edit
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleGenerateAiJd}
                                  disabled={generatingAi}
                                  className="text-[10px] h-7 px-3 gap-1.5 border-primary/30 text-primary hover:bg-primary/10 font-semibold"
                                >
                                  <Sparkles className="size-3" /> Regenerate
                                </Button>
                              </div>

                              {/* Inline quick-edit prompt */}
                              <div className="bg-background/80 border border-border/40 rounded-lg p-3 space-y-2">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Modify prompt & regenerate</p>
                                <Textarea
                                  value={aiContext}
                                  onChange={(e) => setAiContext(e.target.value)}
                                  rows={2}
                                  className="text-xs bg-background"
                                  placeholder="Modify your prompt here and click Regenerate above..."
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                  <label className="block font-semibold text-muted-foreground mb-1.5">Job Title</label>
                                  <Input
                                    type="text"
                                    value={jobForm.title}
                                    onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                                    className="bg-background"
                                  />
                                </div>
                                <div>
                                  <label className="block font-semibold text-muted-foreground mb-1.5">Department</label>
                                  <select
                                    value={jobForm.department}
                                    onChange={(e) => setJobForm({ ...jobForm, department: e.target.value })}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none"
                                  >
                                    <option value="Engineering">Engineering</option>
                                    <option value="Sales">Sales</option>
                                    <option value="Marketing">Marketing</option>
                                    <option value="HR">HR</option>
                                    <option value="Operations">Operations</option>
                                    <option value="Finance">Finance</option>
                                  </select>
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Resume Match Criteria (Keywords)</label>
                                <Input
                                  type="text"
                                  value={jobForm.criteria}
                                  onChange={(e) => setJobForm({ ...jobForm, criteria: e.target.value })}
                                  className="bg-background"
                                  placeholder="e.g. React, Python, SQL"
                                />
                              </div>

                              {/* Markdown Preview/Edit Toggle in inline panel */}
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <label className="block text-xs font-semibold text-muted-foreground">Generated Description</label>
                                  <div className="flex items-center gap-1 bg-muted/30 border border-border/40 rounded-lg p-0.5">
                                    <button
                                      type="button"
                                      onClick={() => setJdViewMode("preview")}
                                      className={`px-2.5 py-0.5 rounded-md text-[10px] font-semibold transition-all ${jdViewMode === "preview" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                                    >
                                      Preview
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setJdViewMode("edit")}
                                      className={`px-2.5 py-0.5 rounded-md text-[10px] font-semibold transition-all ${jdViewMode === "edit" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                                    >
                                      Edit
                                    </button>
                                  </div>
                                </div>
                                {jdViewMode === "preview" ? (
                                  <div
                                    className="border border-border/50 rounded-xl bg-background p-4 text-sm leading-relaxed max-h-[260px] overflow-y-auto"
                                    dangerouslySetInnerHTML={{
                                      __html: (jobForm.description || "")
                                        .replace(/^# (.*)/gm, '<h1 class="text-lg font-extrabold text-foreground border-b border-border pb-2 mt-3 mb-2">$1</h1>')
                                        .replace(/^## (.*)/gm, '<h2 class="text-sm font-bold text-foreground mt-4 mb-1.5 flex items-center gap-1.5"><span class="w-1 h-3.5 bg-primary rounded-full inline-block"></span>$1</h2>')
                                        .replace(/^### (.*)/gm, '<h3 class="text-xs font-bold text-foreground mt-3 mb-1">$1</h3>')
                                        .replace(/^- (.*)/gm, '<li class="ml-4 mb-1 text-xs text-muted-foreground list-disc">$1</li>')
                                        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
                                        .replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs font-mono text-primary">$1</code>')
                                        .replace(/\n\n/g, '<div class="my-2"></div>')
                                        .replace(/\n/g, '<br />')
                                    }}
                                  />
                                ) : (
                                  <Textarea
                                    value={jobForm.description}
                                    onChange={(e) => {
                                      setJobForm({ ...jobForm, description: e.target.value });
                                    }}
                                    rows={12}
                                    className="bg-background text-xs leading-relaxed font-mono"
                                  />
                                )}
                              </div>
                            </motion.div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {wizardStep === 2 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Job Title</label>
                        <Input
                          type="text"
                          value={jobForm.title}
                          onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Department</label>
                        <select
                          value={jobForm.department}
                          onChange={(e) => setJobForm({ ...jobForm, department: e.target.value })}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none"
                        >
                          <option value="Engineering">Engineering</option>
                          <option value="Sales">Sales</option>
                          <option value="Marketing">Marketing</option>
                          <option value="HR">HR</option>
                          <option value="Operations">Operations</option>
                          <option value="Finance">Finance</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Location</label>
                        <Input
                          type="text"
                          value={jobForm.location}
                          onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Experience</label>
                        <Input
                          type="text"
                          value={jobForm.experience}
                          onChange={(e) => setJobForm({ ...jobForm, experience: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Openings Count</label>
                        <Input
                          type="number"
                          value={jobForm.openings}
                          onChange={(e) => setJobForm({ ...jobForm, openings: Number(e.target.value) })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 bg-muted/20 p-4 rounded-xl border border-border/40">
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1 flex items-center gap-1">
                          Minimum Match Threshold
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="50"
                            max="95"
                            value={thresholdScoreVal}
                            onChange={(e) => setThresholdScoreVal(Number(e.target.value))}
                            className="flex-1 accent-primary"
                          />
                          <span className="text-sm font-bold text-primary">{thresholdScoreVal}%</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1">
                          Evaluations Key Terms <span className="text-[10px] text-muted-foreground">(comma separated)</span>
                        </label>
                        <Input
                          type="text"
                          placeholder="e.g. React, TypeScript, Figma"
                          value={jobForm.criteria}
                          onChange={(e) => setJobForm({ ...jobForm, criteria: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-semibold text-muted-foreground">Full Job Description</label>
                        <div className="flex items-center gap-1 bg-muted/30 border border-border/40 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => setJdViewMode("preview")}
                            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${(jdViewMode ?? "preview") === "preview" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => setJdViewMode("edit")}
                            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${jdViewMode === "edit" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                          >
                            Edit Markdown
                          </button>
                        </div>
                      </div>
                      {(jdViewMode ?? "preview") === "preview" ? (
                        <div
                          className="border border-border/50 rounded-xl bg-background p-5 text-sm leading-relaxed max-h-[320px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none"
                          dangerouslySetInnerHTML={{
                            __html: (jobForm.description || "")
                              .replace(/^# (.*)/gm, '<h1 class="text-xl font-extrabold text-foreground border-b border-border pb-2 mt-4 mb-3">$1</h1>')
                              .replace(/^## (.*)/gm, '<h2 class="text-base font-bold text-foreground mt-5 mb-2 flex items-center gap-2"><span class="w-1 h-4 bg-primary rounded-full inline-block"></span>$1</h2>')
                              .replace(/^### (.*)/gm, '<h3 class="text-sm font-bold text-foreground mt-4 mb-1.5">$1</h3>')
                              .replace(/^- (.*)/gm, '<li class="ml-4 mb-1 text-xs text-muted-foreground list-disc">$1</li>')
                              .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
                              .replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs font-mono text-primary">$1</code>')
                              .replace(/\n\n/g, '<div class="my-3"></div>')
                              .replace(/\n/g, '<br />')
                          }}
                        />
                      ) : (
                        <Textarea
                          value={jobForm.description}
                          onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                          rows={12}
                          className="text-xs font-mono leading-relaxed"
                          placeholder="Job description markdown..."
                        />
                      )}
                    </div>

                    <div className="pt-2 border-t border-border">
                      <label className="block text-xs font-bold text-foreground mb-2">Publish & Sync to External Portals</label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                        {["Careers Page", "LinkedIn", "Indeed", "Zoho Careers", "Naukri.com"].map(p => (
                          <label key={p} className="flex items-center gap-2 p-2.5 rounded-lg border border-border/40 hover:bg-muted/15 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={jobForm.portals.includes(p)}
                              onChange={(e) => {
                                const portals = e.target.checked
                                  ? [...jobForm.portals, p]
                                  : jobForm.portals.filter(x => x !== p);
                                setJobForm({ ...jobForm, portals });
                              }}
                              className="accent-primary"
                            />
                            <span className={p === "Zoho Careers" ? "text-primary font-bold" : p === "Naukri.com" ? "text-indigo-500 font-bold" : ""}>{p}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {syncingPortals && (
                      <div className="bg-zinc-950 text-emerald-400 p-4 rounded-xl border border-border/50 text-xs font-mono max-h-[160px] overflow-y-auto space-y-1 mt-4">
                        <p className="text-zinc-500 animate-pulse">// Syncing pipelines active...</p>
                        {syncingLog.map((log, idx) => (
                          <p key={idx}>{log}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-border flex justify-between bg-muted/20">
                <Button
                  variant="outline"
                  onClick={() => setWizardStep(1)}
                  disabled={wizardStep === 1 || syncingPortals}
                >
                  Back
                </Button>
                
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setPostJobOpen(false)} disabled={syncingPortals}>Cancel</Button>
                  
                  {wizardStep === 1 ? (
                    <Button
                      onClick={() => setWizardStep(2)}
                      disabled={!jobForm.title || !creationMethod}
                    >
                      Next: Publish Details
                    </Button>
                  ) : (
                    <Button
                      onClick={handlePublishJob}
                      disabled={syncingPortals || !jobForm.title}
                      className="gradient-brand text-white"
                    >
                      {syncingPortals ? "Publishing..." : "Publish Job Opening"}
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Public Careers Portal Simulator Modal */}
      <AnimatePresence>
        {careersPortalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl w-full max-w-4xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden font-sans"
            >
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5"><Globe className="size-5 text-primary" /> Public Careers Site — Nimbus Retail</h3>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">Preview and test applications. HR credentials are bypassed to simulate candidates.</p>
                </div>
                <button onClick={() => setCareersPortalOpen(false)} className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <XCircle className="size-6 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-5 gap-6">
                <div className="md:col-span-2 space-y-3 border-r border-zinc-200 dark:border-zinc-800 pr-4">
                  <h4 className="font-bold text-zinc-900 dark:text-zinc-200 text-sm uppercase tracking-wider mb-2">Available Jobs ({publicOpenJobs.length})</h4>
                  {publicOpenJobs.map(job => (
                    <div
                      key={job.id}
                      onClick={() => setSimSelectedJob(job)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        simSelectedJob?.id === job.id
                          ? "border-primary bg-primary/5 dark:bg-primary/10 shadow"
                          : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-100/50"
                      }`}
                    >
                      <h5 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm leading-snug">{job.title}</h5>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{job.department} · {job.location}</p>
                      <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded inline-block mt-2">{job.type}</span>
                    </div>
                  ))}
                </div>

                <div className="md:col-span-3 space-y-6">
                  {simSelectedJob ? (
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-snug">{simSelectedJob.title}</h4>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{simSelectedJob.department} · {simSelectedJob.location} · {simSelectedJob.type}</p>
                      </div>

                      <div className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed border-t border-zinc-150 dark:border-zinc-800 pt-3 max-h-[140px] overflow-y-auto whitespace-pre-wrap">
                        {simSelectedJob.description}
                      </div>

                      <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-4">
                        <h5 className="font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-zinc-200 border-b pb-2">Apply for this Role (Simulated Candidate)</h5>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-semibold text-zinc-500 mb-1">Candidate Full Name</label>
                            <Input
                              type="text"
                              value={simCandidate.name}
                              placeholder="e.g. John Doe"
                              onChange={(e) => setSimCandidate({ ...simCandidate, name: e.target.value })}
                              className="h-8 text-xs bg-zinc-50 dark:bg-zinc-900"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-zinc-500 mb-1">Email Address</label>
                            <Input
                              type="email"
                              value={simCandidate.email}
                              placeholder="e.g. johndoe@mail.com"
                              onChange={(e) => setSimCandidate({ ...simCandidate, email: e.target.value })}
                              className="h-8 text-xs bg-zinc-50 dark:bg-zinc-900"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-semibold text-zinc-500 mb-1">Experience years</label>
                            <Input
                              type="text"
                              placeholder="e.g. 4 years"
                              value={simCandidate.experience}
                              onChange={(e) => setSimCandidate({ ...simCandidate, experience: e.target.value })}
                              className="h-8 text-xs bg-zinc-50 dark:bg-zinc-900"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-zinc-500 mb-1">Source Portal</label>
                            <select
                              value={simCandidate.source}
                              onChange={(e) => setSimCandidate({ ...simCandidate, source: e.target.value })}
                              className="flex h-8 w-full rounded-md border border-input bg-zinc-50 dark:bg-zinc-900 px-3 py-1 text-xs focus-visible:outline-none"
                            >
                              <option value="Careers Page">Careers Page</option>
                              <option value="LinkedIn">LinkedIn</option>
                              <option value="Indeed">Indeed</option>
                              <option value="Glassdoor">Glassdoor</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-zinc-500 mb-1">Paste Resume Text / Qualifications</label>
                          <Textarea
                            placeholder="Add core qualifications matching criteria to test the threshold score evaluation..."
                            value={simCandidate.resumeText}
                            onChange={(e) => setSimCandidate({ ...simCandidate, resumeText: e.target.value })}
                            rows={3}
                            className="text-xs bg-zinc-50 dark:bg-zinc-900"
                          />
                        </div>

                        <Button onClick={handlePublicApply} disabled={!simCandidate.name || !simCandidate.email || !simCandidate.resumeText} className="w-full text-xs h-8">
                          Submit Job Application
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-24 text-zinc-400 dark:text-zinc-500">
                      Select a job opening from the list to preview details and test candidate submission.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Applicant Profile Detail Dialog */}
      <AnimatePresence>
        {selectedApplicant && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-sans"
            >
              <div className="p-6 border-b border-border flex justify-between items-center bg-muted/20">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Candidate Profile</h3>
                  <p className="text-xs text-muted-foreground font-semibold">Status: <span className={`px-2 py-0.5 rounded-full font-bold ml-1 ${stageColor(selectedApplicant.stage)}`}>{selectedApplicant.stage}</span></p>
                </div>
                <button onClick={() => setSelectedApplicant(null)} className="p-1 rounded hover:bg-muted/40 transition-colors">
                  <XCircle className="size-6 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
              
              <div className="p-6 space-y-5 overflow-y-auto flex-1 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Full Name</p>
                    <p className="font-semibold text-foreground text-base">{selectedApplicant.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email Address</p>
                    <p className="font-semibold text-foreground">{selectedApplicant.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Target Role</p>
                    <p className="font-semibold text-foreground">{selectedApplicant.job_title}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Experience Profile</p>
                    <p className="font-semibold text-foreground">{selectedApplicant.experience}</p>
                  </div>
                </div>

                <div className="bg-muted/20 p-4 rounded-xl border border-border flex items-center gap-4">
                  <div className={`size-14 rounded-full flex flex-col items-center justify-center text-sm font-bold border-2 ${
                    selectedApplicant.match_score >= (jobs.find(j => j.id === selectedApplicant.job_id)?.threshold_score || 70) 
                      ? "border-emerald-500 bg-emerald-500/5 text-emerald-500" 
                      : "border-orange-500 bg-orange-500/5 text-orange-500"
                  }`}>
                    <span className="text-base leading-none">{selectedApplicant.match_score}%</span>
                    <span className="text-[9px] text-muted-foreground mt-0.5">MATCH</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">Enterprise Criteria Matching Evaluation</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Target Threshold: <span className="font-semibold">{jobs.find(j => j.id === selectedApplicant.job_id)?.threshold_score || 70}%</span> · 
                      Job Criteria terms: <span className="font-semibold">{jobs.find(j => j.id === selectedApplicant.job_id)?.criteria || "N/A"}</span>
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-sm text-foreground mb-1.5 flex items-center gap-1.5"><FileText className="size-4" /> Resume / Cover Text</h4>
                  <div className="bg-muted/15 p-4 rounded-xl border border-border/40 text-xs leading-relaxed max-h-[160px] overflow-y-auto whitespace-pre-wrap">
                    {selectedApplicant.resume_text || "No resume text extracted."}
                  </div>
                </div>

                {/* Salary Negotiations & Timeline Log */}
                <div className="pt-4 border-t border-border space-y-4">
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    <DollarSign className="size-4 text-primary" /> Salary Negotiation Tracking
                  </h4>
                  <div className="grid grid-cols-2 gap-4 bg-muted/15 p-4 rounded-xl border border-border/40">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Expected Salary (CTC)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
                        <Input
                          type="number"
                          value={candidateExpectedSalary || ""}
                          placeholder="e.g. 95000"
                          onChange={(e) => setCandidateExpectedSalary(e.target.value ? Number(e.target.value) : null)}
                          className="pl-7 h-8 text-xs bg-background"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Proposed Salary (CTC)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
                        <Input
                          type="number"
                          value={candidateProposedSalary || ""}
                          placeholder="e.g. 90000"
                          onChange={(e) => setCandidateProposedSalary(e.target.value ? Number(e.target.value) : null)}
                          className="pl-7 h-8 text-xs bg-background"
                        />
                      </div>
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <Button size="sm" onClick={handleSaveNegotiation} className="h-7 text-xs">
                        Save Salary Metrics
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border space-y-4">
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    <Mail className="size-4 text-primary" /> Candidate Communication & Notes Logs
                  </h4>
                  
                  {/* Append log entry */}
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Add note, counter-offer details, or email follow-ups..."
                      value={candidateNewNote}
                      onChange={(e) => setCandidateNewNote(e.target.value)}
                      className="text-xs h-8 flex-1"
                    />
                    <Button size="sm" onClick={handleAddCandidateNote} disabled={!candidateNewNote.trim()} className="h-8 text-xs">
                      Add Log
                    </Button>
                  </div>

                  {/* Vertical Timeline */}
                  <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
                    {selectedApplicant.notes_json && selectedApplicant.notes_json.length > 0 ? (
                      selectedApplicant.notes_json.map((note, index) => (
                        <div key={index} className="flex gap-3 text-xs border-l-2 border-primary/20 pl-3 py-0.5 relative ml-1">
                          <div className="absolute size-2 rounded-full bg-primary left-[-5px] top-1.5" />
                          <div className="flex-1">
                            <div className="flex justify-between items-center text-[10px] text-muted-foreground mb-0.5">
                              <span className="font-semibold text-foreground">{note.author}</span>
                              <span>{new Date(note.date).toLocaleString()}</span>
                            </div>
                            <p className="text-muted-foreground leading-relaxed">{note.text}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground italic text-center py-4">No communication history logged yet.</p>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-border">
                  <h4 className="font-bold text-sm text-foreground mb-3">Hiring Stage Workflow Progression</h4>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={selectedApplicant.stage === "Screening" ? "default" : "outline"}
                      onClick={() => handleProgressStage(selectedApplicant.id, "Screening")}
                    >
                      Screening Complete
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedApplicant.stage === "Interview" ? "default" : "outline"}
                      onClick={() => handleProgressStage(selectedApplicant.id, "Interview")}
                      className="border-amber-500/20 text-amber-500 hover:bg-amber-500/10"
                    >
                      Schedule Interview
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedApplicant.stage === "Offer" ? "default" : "outline"}
                      onClick={() => handleProgressStage(selectedApplicant.id, "Offer")}
                      className="border-purple-500/20 text-purple-500 hover:bg-purple-500/10"
                    >
                      Generate Offer
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedApplicant.stage === "Hired" ? "default" : "outline"}
                      onClick={() => handleProgressStage(selectedApplicant.id, "Hired")}
                      className="border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10"
                    >
                      Start Onboarding
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        handleProgressStage(selectedApplicant.id, "Rejected");
                        setSelectedApplicant(null);
                      }}
                    >
                      Reject Candidate
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Schedule Interview Modal */}
      <AnimatePresence>
        {scheduleInterviewOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl overflow-hidden font-sans"
            >
              <div className="p-6 border-b border-border flex justify-between items-center bg-muted/20">
                <h3 className="text-lg font-bold text-foreground">Schedule Selection Interview</h3>
                <button onClick={() => setScheduleInterviewOpen(false)} className="p-1 rounded hover:bg-muted/40">
                  <XCircle className="size-6 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
              
              <div className="p-6 space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Select Candidate</label>
                  <select
                    value={interviewForm.applicantId}
                    onChange={(e) => setInterviewForm({ ...interviewForm, applicantId: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none"
                  >
                    <option value="">Choose candidate...</option>
                    {applicants.filter(a => a.stage === "Interview" || a.stage === "Applied" || a.stage === "Screening").map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.job_title})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Select Interviewer</label>
                    <select
                      value={interviewForm.interviewerName}
                      onChange={(e) => setInterviewForm({ ...interviewForm, interviewerName: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none"
                    >
                      <option value="">Choose interviewer...</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.full_name}>
                          {emp.full_name} ({emp.employment_type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Session Duration</label>
                    <select
                      value={interviewForm.duration}
                      onChange={(e) => setInterviewForm({ ...interviewForm, duration: Number(e.target.value) })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none"
                    >
                      <option value="30">30 minutes</option>
                      <option value="45">45 minutes</option>
                      <option value="60">60 minutes</option>
                      <option value="90">90 minutes</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Date</label>
                    <Input
                      type="date"
                      value={interviewForm.date}
                      onChange={(e) => setInterviewForm({ ...interviewForm, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Start Time</label>
                    <Input
                      type="time"
                      value={interviewForm.time}
                      onChange={(e) => setInterviewForm({ ...interviewForm, time: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Evaluation Phase</label>
                    <select
                      value={interviewForm.type}
                      onChange={(e) => setInterviewForm({ ...interviewForm, type: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none"
                    >
                      <option value="Technical">Technical Code Interview</option>
                      <option value="System Architecture">System Architecture</option>
                      <option value="HR / General Fit">HR / General Fit</option>
                      <option value="Portfolio Review">Portfolio Review</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Session Mode</label>
                    <select
                      value={interviewForm.mode}
                      onChange={(e) => setInterviewForm({ ...interviewForm, mode: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none"
                    >
                      <option value="Video Call">Video Call (Auto Link)</option>
                      <option value="In-Person">In-Person (HQ Office)</option>
                    </select>
                  </div>
                </div>

                {interviewerConflict && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="bg-red-500/10 text-red-500 border border-red-500/25 p-3 rounded-lg flex gap-2 text-xs items-start"
                  >
                    <AlertTriangle className="size-4 flex-shrink-0 mt-0.5" />
                    <span>{interviewerConflict}</span>
                  </motion.div>
                )}

                <div className="flex gap-2 justify-end pt-4 border-t border-border">
                  <Button variant="outline" onClick={() => setScheduleInterviewOpen(false)}>Cancel</Button>
                  <Button onClick={handleScheduleInterview} disabled={!!interviewerConflict || !interviewForm.applicantId || !interviewForm.date || !interviewForm.time}>
                    Book Selection Call
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Offer Modal */}
      <AnimatePresence>
        {createOfferOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] font-sans"
            >
              <div className="p-6 border-b border-border flex justify-between items-center bg-muted/20">
                <h3 className="text-lg font-bold text-foreground">Draft Corporate Job Offer</h3>
                <button onClick={() => setCreateOfferOpen(false)} className="p-1 rounded hover:bg-muted/40">
                  <XCircle className="size-6 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Select Approved Candidate</label>
                    <select
                      value={offerForm.applicantId}
                      onChange={(e) => setOfferForm({ ...offerForm, applicantId: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none"
                    >
                      <option value="">Choose candidate...</option>
                      {applicants.filter(a => a.stage === "Offer" || a.stage === "Interview").map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.job_title})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Annual CTC Compensation (USD)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                      <Input
                        type="number"
                        value={offerForm.ctc}
                        onChange={(e) => setOfferForm({ ...offerForm, ctc: Number(e.target.value) })}
                        className="pl-8"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Target Joining Date</label>
                      <Input
                        type="date"
                        value={offerForm.joiningDate}
                        onChange={(e) => setOfferForm({ ...offerForm, joiningDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Offer Expiry Date</label>
                      <Input
                        type="date"
                        value={offerForm.expiryDate}
                        onChange={(e) => setOfferForm({ ...offerForm, expiryDate: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Signing HR Authority</label>
                    <Input
                      type="text"
                      value={offerForm.signingAuthority}
                      onChange={(e) => setOfferForm({ ...offerForm, signingAuthority: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5">Custom Offer Template Body</label>
                    <Textarea
                      value={offerForm.customTemplate}
                      placeholder="Customize key offer parameters, salary splits, or bonus declarations..."
                      onChange={(e) => setOfferForm({ ...offerForm, customTemplate: e.target.value })}
                      rows={5}
                      className="text-xs"
                    />
                  </div>
                </div>

                {/* Right side live letterhead preview */}
                <div className="border border-border/80 rounded-xl p-6 bg-white dark:bg-zinc-950 font-serif shadow-inner overflow-y-auto max-h-[450px]">
                  <div className="flex justify-between items-start border-b pb-4 mb-4 border-zinc-200 dark:border-zinc-800">
                    <div>
                      <h4 className="font-bold text-xl text-zinc-900 dark:text-zinc-100 tracking-wide font-sans">Nimbus Retail Group</h4>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-sans mt-0.5">Corporate HQ, San Francisco, California</p>
                    </div>
                    <div className="border-2 border-zinc-900 dark:border-zinc-300 px-2 py-1 text-center font-bold text-xs text-zinc-900 dark:text-zinc-300 font-sans uppercase">
                      Offer Draft
                    </div>
                  </div>

                  <div className="space-y-4 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    <p className="text-right font-sans text-[10px]">{new Date().toLocaleDateString()}</p>
                    
                    <div className="font-sans">
                      <p className="font-semibold text-zinc-800 dark:text-zinc-200">Dear {applicants.find(a => a.id === offerForm.applicantId)?.name || "[Candidate Name]"},</p>
                      <p className="text-zinc-500 text-[10px]">{applicants.find(a => a.id === offerForm.applicantId)?.email || "[Candidate Email]"}</p>
                    </div>

                    <p>
                      Following your successful technical appraisal modules, we are thrilled to extend a formal offer of employment to join Nimbus Retail Group as a <span className="font-bold">{applicants.find(a => a.id === offerForm.applicantId)?.job_title || "[Role Designation]"}</span>.
                    </p>

                    <p>
                      Your annual compensation structure is designed at a base Gross CTC of <span className="font-bold">{currency.symbol}{offerForm.ctc.toLocaleString()} per annum</span>, which will be paid out in equal monthly increments subject to tax declarations.
                    </p>

                    <p>
                      Your estimated joining date is scheduled on <span className="font-bold">{offerForm.joiningDate ? new Date(offerForm.joiningDate).toLocaleDateString() : "[Joining Date]"}</span>. This offer remains valid for review and online acceptance signature until <span className="font-bold">{offerForm.expiryDate ? new Date(offerForm.expiryDate).toLocaleDateString() : "[Expiry Date]"}</span>.
                    </p>

                    {offerForm.customTemplate && (
                      <div className="pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-800 whitespace-pre-wrap font-sans text-[11px] text-zinc-600 dark:text-zinc-400">
                        {offerForm.customTemplate}
                      </div>
                    )}

                    <div className="pt-8 flex justify-between items-end font-sans text-[10px] border-t border-zinc-100 dark:border-zinc-800 mt-8">
                      <div>
                        <p className="font-semibold">{offerForm.signingAuthority}</p>
                        <p className="text-zinc-400">Head of Human Resources</p>
                      </div>
                      <div className="text-right italic text-zinc-400">
                        Secure digital token: BOS-A9-{Math.floor(1000 + Math.random() * 9000)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-border flex gap-2 justify-end bg-muted/20 text-sm">
                <Button variant="outline" onClick={() => setCreateOfferOpen(false)}>Cancel</Button>
                <Button onClick={handleSendOffer} disabled={!offerForm.applicantId || !offerForm.joiningDate || !offerForm.expiryDate}>
                  Create & Email Offer
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
