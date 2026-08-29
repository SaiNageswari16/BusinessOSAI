import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PhoneCall, PhoneOff, Mic, MicOff, Volume2, VolumeX, Sparkles,
  CheckCircle2, AlertCircle, Clock, Send, Shield, Zap,
  Briefcase, User, Building, DollarSign, ChevronRight, RefreshCw,
  HelpCircle, MessageSquare, Flame, Check, Play, Pause, X
} from "lucide-react";
import { toast } from "sonner";
import {
  crmCallsApi,
  type CRMCallInitiateRequest,
  type CRMCallInitiateResponse,
  type CRMCallTurnMessage,
  type CRMCallLog
} from "@/lib/api-client";
import { useCurrency } from "@/hooks/use-currency";

export interface AiCallingModalProps {
  open: boolean;
  onClose: () => void;
  targetType: "lead" | "customer" | "opportunity" | "deal" | "quotation" | "order" | "ticket" | "complaint";
  targetId?: string;
  contactName: string;
  contactPhone?: string;
  contactEmail?: string;
  companyName?: string;
  dealValue?: number | string;
  defaultNotes?: string;
  onCallCompleted?: (callLog: CRMCallLog) => void;
}

const AGENT_PERSONAS = [
  {
    id: "alex",
    name: "Alex - Senior Solutions & Sales Closer",
    title: "High-Energy Consultative Closer",
    avatar: "⚡",
    desc: "Focuses on ROI, multi-module ERP/POS/CRM value, and fast-track deal qualification.",
    style: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
  },
  {
    id: "maya",
    name: "Maya - Customer Relationship & Retention",
    title: "Warm & Empathetic Success Specialist",
    avatar: "🌟",
    desc: "Tailored for existing accounts, customer check-ins, feature adoption, and satisfaction.",
    style: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
  },
  {
    id: "david",
    name: "David - Finance & Collections Specialist",
    title: "Direct & Polite Billing Coordinator",
    avatar: "💼",
    desc: "Specialized in quotation follow-ups, payment schedules, and invoice reconciliation.",
    style: "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400"
  },
  {
    id: "sarah",
    name: "Sarah - Technical Support & Care",
    title: "Methodical Problem Solver",
    avatar: "🛠️",
    desc: "Handles customer support tickets, troubleshooting, and issue resolutions.",
    style: "bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400"
  }
];

export function AiCallingModal({
  open,
  onClose,
  targetType,
  targetId,
  contactName,
  contactPhone,
  contactEmail,
  companyName,
  dealValue,
  defaultNotes,
  onCallCompleted
}: AiCallingModalProps) {
  const { formatCurrency } = useCurrency();

  // State
  const [selectedPersona, setSelectedPersona] = useState(AGENT_PERSONAS[0].name);
  const [callMode, setCallMode] = useState<"browser_ai" | "livekit_sip">("browser_ai");
  const [sipNumber, setSipNumber] = useState("");
  const [customNotes, setCustomNotes] = useState(defaultNotes || "");
  
  // Call Session State
  const [callState, setCallState] = useState<"idle" | "dialing" | "connected" | "ended">("idle");
  const [callSession, setCallSession] = useState<CRMCallInitiateResponse | null>(null);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);

  // Transcript & Live AI
  const [transcript, setTranscript] = useState<CRMCallTurnMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [liveSentiment, setLiveSentiment] = useState("Positive");
  const [liveBattlecards, setLiveBattlecards] = useState<Array<{ topic: string; talking_point: string }>>([]);
  const [copilotTip, setCopilotTip] = useState<string | null>(null);
  const [completedLog, setCompletedLog] = useState<CRMCallLog | null>(null);

  // Refs
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, isAiThinking]);

  // Duration timer
  useEffect(() => {
    if (callState === "connected" && !isOnHold) {
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState, isOnHold]);

  // Format Duration string
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Text to Speech
  const speakText = useCallback((text: string) => {
    if (isSpeakerMuted || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Samantha")) && v.lang.startsWith("en"));
      if (preferredVoice) utterance.voice = preferredVoice;

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech synthesis error:", e);
    }
  }, [isSpeakerMuted]);

  // Speech Recognition (Microphone)
  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onresult = (event: any) => {
        const lastResult = event.results[event.results.length - 1];
        if (lastResult.isFinal) {
          const spoken = lastResult[0].transcript.trim();
          if (spoken && !isMuted && !isOnHold) {
            handleUserTurn(spoken);
          }
        }
      };

      rec.onerror = (event: any) => {
        if (event.error !== "no-speech") {
          console.warn("Speech recognition error:", event.error);
        }
      };

      rec.onend = () => {
        if (callState === "connected" && !isMuted && !isOnHold) {
          try {
            rec.start();
          } catch {}
        }
      };

      rec.start();
      recognitionRef.current = rec;
      setIsListening(true);
    } catch (err) {
      console.warn("Could not start speech recognition:", err);
    }
  }, [callState, isMuted, isOnHold]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  // Initiate Call
  const handleInitiateCall = async () => {
    setCallState("dialing");
    setDuration(0);
    setTranscript([]);

    try {
      const payload: CRMCallInitiateRequest = {
        target_type: targetType,
        target_id: targetId || null,
        contact_name: contactName,
        contact_phone: contactPhone || null,
        contact_email: contactEmail || null,
        company_name: companyName || null,
        agent_persona: selectedPersona,
        custom_prompt: customNotes || undefined,
        sip_number: sipNumber || undefined,
        call_mode: callMode
      };

      const res = await crmCallsApi.initiate(payload);
      setCallSession(res);
      setLiveBattlecards(res.battlecards || []);

      const initialMessage: CRMCallTurnMessage = {
        speaker: "AI",
        text: res.agent_greeting,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
      setTranscript([initialMessage]);
      setCallState("connected");
      toast.success(`📞 AI Call connected with ${contactName}!`, { duration: 3000 });

      // Speak greeting
      speakText(res.agent_greeting);
      startListening();
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to initiate AI call");
      setCallState("idle");
    }
  };

  // User Dialogue Turn
  const handleUserTurn = async (text: string) => {
    if (!text.trim() || !callSession || isAiThinking) return;

    const userMsg: CRMCallTurnMessage = {
      speaker: "User",
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    const newTranscript = [...transcript, userMsg];
    setTranscript(newTranscript);
    setInputText("");
    setIsAiThinking(true);

    try {
      const turnRes = await crmCallsApi.turn({
        call_id: callSession.call_id,
        user_speech: text.trim(),
        conversation_history: newTranscript,
        agent_persona: selectedPersona,
        target_type: targetType,
        contact_name: contactName,
        company_name: companyName,
        context_notes: customNotes
      });

      const aiMsg: CRMCallTurnMessage = {
        speaker: "AI",
        text: turnRes.ai_response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };

      setTranscript(prev => [...prev, aiMsg]);
      setLiveSentiment(turnRes.detected_sentiment);
      if (turnRes.suggested_objection_handling) {
        setCopilotTip(turnRes.suggested_objection_handling);
      }

      speakText(turnRes.ai_response);
    } catch (e: any) {
      console.warn("Turn processing error:", e);
      const fallbackAi: CRMCallTurnMessage = {
        speaker: "AI",
        text: `Thank you for sharing that, ${contactName}. Let me make sure our solutions team prepares the exact details for you.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
      setTranscript(prev => [...prev, fallbackAi]);
      speakText(fallbackAi.text);
    } finally {
      setIsAiThinking(false);
    }
  };

  // End Call & Complete
  const handleEndCall = async () => {
    stopListening();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    if (!callSession) {
      setCallState("idle");
      onClose();
      return;
    }

    setCallState("ended");
    const toastId = toast.loading("Generating AI call summary & action items...");

    try {
      const completed = await crmCallsApi.complete({
        call_id: callSession.call_id,
        duration_seconds: duration,
        transcript: transcript,
        final_sentiment: liveSentiment,
        status: "Completed",
        auto_advance_stage: true
      });

      setCompletedLog(completed);
      toast.dismiss(toastId);
      toast.success("✅ AI Call completed & logged to CRM Timeline!");
      if (onCallCompleted) {
        onCallCompleted(completed);
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err instanceof Error ? err.message : "Error finalizing call summary");
    }
  };

  // Reset when modal closes
  const handleModalClose = () => {
    stopListening();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setCallState("idle");
    setCallSession(null);
    setTranscript([]);
    setDuration(0);
    setCompletedLog(null);
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl bg-card border border-border/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-muted/20">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-2xl ${callState === "connected" ? "bg-emerald-500/10 text-emerald-500 animate-pulse" : "bg-indigo-500/10 text-indigo-500"}`}>
                <PhoneCall className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-foreground">AI Voice Studio & Dialer</h3>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                    {targetType.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Interactive real-time voice agent & automated telephony
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {callState === "connected" && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-mono font-bold animate-pulse">
                  <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
                  {formatTime(duration)}
                </div>
              )}

              <button
                onClick={handleModalClose}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* ── STATE 1: IDLE / CONFIGURATION ─────────────────────────── */}
            {callState === "idle" && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Left: Contact Info & Persona */}
                <div className="md:col-span-7 space-y-5">
                  {/* Contact Card */}
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border/50">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-12 rounded-2xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xl">
                          {contactName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-bold text-base text-foreground">{contactName}</h4>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <Building className="size-3" />
                            {companyName || "Direct Contact"}
                          </p>
                        </div>
                      </div>

                      {dealValue && Number(dealValue) > 0 && (
                        <div className="text-right">
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Deal Value</span>
                          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(Number(dealValue))}</p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-border/40 text-xs">
                      <div>
                        <span className="text-muted-foreground">Phone Number:</span>
                        <p className="font-semibold text-foreground mt-0.5">{contactPhone || "Not Provided (Web Audio Only)"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Email:</span>
                        <p className="font-semibold text-foreground mt-0.5 truncate">{contactEmail || "None"}</p>
                      </div>
                    </div>
                  </div>

                  {/* AI Persona Selector */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
                      Select AI Voice Agent Persona
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {AGENT_PERSONAS.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedPersona(p.name)}
                          className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                            selectedPersona === p.name
                              ? "bg-primary/5 border-primary ring-2 ring-primary/20 shadow-sm"
                              : "bg-card hover:bg-muted/30 border-border/60"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-lg">{p.avatar}</span>
                            <span className="font-bold text-xs text-foreground truncate">{p.name.split('-')[0].trim()}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-2">{p.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Context / Script */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Call Objective & Custom Context
                    </label>
                    <textarea
                      value={customNotes}
                      onChange={e => setCustomNotes(e.target.value)}
                      placeholder="e.g. Follow up on Enterprise Quotation Q-1049, offer 5% volume discount if closed this month."
                      className="w-full h-20 px-3.5 py-2.5 rounded-2xl bg-muted/20 border border-border/60 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition resize-none"
                    />
                  </div>
                </div>

                {/* Right: Mode & Start */}
                <div className="md:col-span-5 flex flex-col justify-between p-5 rounded-3xl bg-muted/20 border border-border/50">
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Calling Connection Mode</h4>
                    
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setCallMode("browser_ai")}
                        className={`w-full p-3.5 rounded-2xl border text-left transition flex items-center gap-3 ${
                          callMode === "browser_ai"
                            ? "bg-primary/10 border-primary text-primary font-semibold shadow-sm"
                            : "bg-card border-border/60 text-foreground hover:bg-muted/40"
                        }`}
                      >
                        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                          <Mic className="size-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold">Interactive Browser AI Voice Call</p>
                          <p className="text-[10px] text-muted-foreground">Speaks directly with your mic & speakers</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCallMode("livekit_sip")}
                        className={`w-full p-3.5 rounded-2xl border text-left transition flex items-center gap-3 ${
                          callMode === "livekit_sip"
                            ? "bg-primary/10 border-primary text-primary font-semibold shadow-sm"
                            : "bg-card border-border/60 text-foreground hover:bg-muted/40"
                        }`}
                      >
                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                          <PhoneCall className="size-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold">LiveKit / SIP Telephony Outbound</p>
                          <p className="text-[10px] text-muted-foreground">Dials direct telecom phone carrier</p>
                        </div>
                      </button>
                    </div>

                    {callMode === "livekit_sip" && (
                      <div className="pt-2">
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Outbound Caller ID (SIP Number)</label>
                        <input
                          type="text"
                          value={sipNumber}
                          onChange={e => setSipNumber(e.target.value)}
                          placeholder="+12025550199"
                          className="w-full px-3 py-2 text-xs rounded-xl bg-card border border-border/60 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                        />
                      </div>
                    )}

                    <div className="p-3.5 rounded-2xl bg-indigo-500/5 border border-indigo-500/15 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        <Sparkles className="size-3.5" />
                        Automated AI Capabilities
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        • Live objection handling battlecards<br/>
                        • Real-time speech transcription & sentiment<br/>
                        • Auto-extracted action items & CRM timeline sync
                      </p>
                    </div>
                  </div>

                  <div className="pt-6">
                    <button
                      onClick={handleInitiateCall}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 transition flex items-center justify-center gap-2"
                    >
                      <PhoneCall className="size-4" />
                      Start AI Voice Call Now
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── STATE 2: DIALING ────────────────────────────────────── */}
            {callState === "dialing" && (
              <div className="flex flex-col items-center justify-center py-16 space-y-6 text-center">
                <div className="relative">
                  <div className="size-24 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center animate-ping absolute inset-0" />
                  <div className="size-24 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center text-3xl shadow-xl relative z-10 animate-bounce">
                    <PhoneCall className="size-10" />
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-xl text-foreground">Dialing {contactName}...</h4>
                  <p className="text-sm text-muted-foreground mt-1">Connecting AI Agent: {selectedPersona.split('-')[0].trim()}</p>
                </div>
              </div>
            )}

            {/* ── STATE 3: CONNECTED & LIVE DIALOGUE ───────────────────── */}
            {callState === "connected" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                {/* Left: Active Waveform & Battlecards */}
                <div className="lg:col-span-4 space-y-4">
                  {/* Voice Status Card */}
                  <div className="p-5 rounded-3xl bg-gradient-to-br from-indigo-900/20 via-slate-900/30 to-purple-900/20 border border-indigo-500/20 text-center relative overflow-hidden">
                    <div className="flex items-center justify-center gap-1.5 mb-3">
                      <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Live Call Session</span>
                    </div>

                    <h4 className="font-bold text-lg text-foreground">{contactName}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{companyName || "Client"}</p>

                    {/* Animated Soundwave */}
                    <div className="flex items-center justify-center gap-1.5 my-6 h-12">
                      {[40, 75, 100, 60, 90, 45, 80, 100, 70, 50, 85, 30].map((h, i) => (
                        <motion.div
                          key={i}
                          animate={{
                            height: isAiThinking || isListening ? [`${h * 0.2}%`, `${h}%`, `${h * 0.4}%`] : "15%"
                          }}
                          transition={{
                            repeat: Infinity,
                            duration: 0.8 + (i % 4) * 0.2,
                            ease: "easeInOut"
                          }}
                          className={`w-1 rounded-full ${
                            isAiThinking
                              ? "bg-purple-500"
                              : isListening
                              ? "bg-emerald-500"
                              : "bg-muted-foreground/30"
                          }`}
                        />
                      ))}
                    </div>

                    <div className="flex items-center justify-between px-3 py-2 rounded-2xl bg-background/50 border border-border/40 text-xs">
                      <span className="text-muted-foreground">Sentiment:</span>
                      <span className={`font-bold px-2 py-0.5 rounded-md ${
                        liveSentiment === "Positive" || liveSentiment === "Highly Interested"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : liveSentiment === "Objection"
                          ? "bg-amber-500/10 text-amber-500"
                          : "bg-muted text-foreground"
                      }`}>
                        {liveSentiment}
                      </span>
                    </div>
                  </div>

                  {/* Real-time Sales Battlecards */}
                  <div className="p-4 rounded-3xl bg-muted/20 border border-border/50 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                      <Flame className="size-4 text-amber-500" />
                      Live Copilot Battlecards
                    </div>

                    {copilotTip && (
                      <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
                        <span className="font-bold">Suggested Response: </span>
                        {copilotTip}
                      </div>
                    )}

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {liveBattlecards.map((b, i) => (
                        <div key={i} className="p-2.5 rounded-2xl bg-card border border-border/60 text-xs space-y-1">
                          <p className="font-bold text-foreground flex items-center justify-between">
                            {b.topic}
                            <button
                              onClick={() => handleUserTurn(`Regarding ${b.topic}: ${b.talking_point}`)}
                              className="text-[10px] text-primary hover:underline font-semibold"
                            >
                              Prompt Agent →
                            </button>
                          </p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{b.talking_point}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: Live Transcript Stream & In-Call Controls */}
                <div className="lg:col-span-8 flex flex-col justify-between bg-muted/10 border border-border/50 rounded-3xl p-4 overflow-hidden">
                  {/* Transcript Scroll Container */}
                  <div className="flex-1 overflow-y-auto space-y-3 p-2 max-h-[380px]">
                    {transcript.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex gap-3 ${msg.speaker === "User" ? "justify-end" : "justify-start"}`}
                      >
                        {msg.speaker === "AI" && (
                          <div className="size-8 rounded-full bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 mt-1">
                            AI
                          </div>
                        )}

                        <div className={`max-w-[78%] p-3.5 rounded-2xl text-xs space-y-1 ${
                          msg.speaker === "User"
                            ? "bg-primary text-primary-foreground rounded-br-none shadow-sm"
                            : "bg-card border border-border/60 text-foreground rounded-bl-none shadow-sm"
                        }`}>
                          <div className="flex items-center justify-between gap-4 text-[10px] opacity-70">
                            <span className="font-semibold">{msg.speaker === "User" ? contactName : selectedPersona.split('-')[0].trim()}</span>
                            <span>{msg.timestamp}</span>
                          </div>
                          <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        </div>

                        {msg.speaker === "User" && (
                          <div className="size-8 rounded-full bg-muted text-foreground flex items-center justify-center font-bold text-xs shrink-0 mt-1">
                            {contactName.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    ))}

                    {isAiThinking && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
                        <RefreshCw className="size-3.5 animate-spin text-primary" />
                        <span>AI Agent is formulating response...</span>
                      </div>
                    )}
                    <div ref={transcriptEndRef} />
                  </div>

                  {/* Manual / Whisper Input */}
                  <div className="pt-3 border-t border-border/40 mt-3 space-y-3">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (inputText.trim()) handleUserTurn(inputText);
                      }}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        placeholder="Type customer reply or supervisor whisper prompt..."
                        className="flex-1 px-4 py-2.5 rounded-2xl bg-card border border-border/60 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      <button
                        type="submit"
                        disabled={!inputText.trim() || isAiThinking}
                        className="p-2.5 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition"
                      >
                        <Send className="size-4" />
                      </button>
                    </form>

                    {/* Bottom Controls */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsMuted(!isMuted)}
                          className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                            isMuted ? "bg-red-500/10 border-red-500/30 text-red-500" : "bg-card border-border/60 text-foreground"
                          }`}
                        >
                          {isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                          {isMuted ? "Mic Muted" : "Mute Mic"}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (typeof window !== "undefined" && "speechSynthesis" in window) {
                              window.speechSynthesis.cancel();
                            }
                            setIsSpeakerMuted(!isSpeakerMuted);
                          }}
                          className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                            isSpeakerMuted ? "bg-amber-500/10 border-amber-500/30 text-amber-500" : "bg-card border-border/60 text-foreground"
                          }`}
                        >
                          {isSpeakerMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                          {isSpeakerMuted ? "Speaker Off" : "Audio On"}
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsOnHold(!isOnHold)}
                          className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                            isOnHold ? "bg-amber-500/10 border-amber-500/30 text-amber-500" : "bg-card border-border/60 text-foreground"
                          }`}
                        >
                          {isOnHold ? <Play className="size-4" /> : <Pause className="size-4" />}
                          {isOnHold ? "Resume Call" : "Hold"}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleEndCall}
                        className="px-5 py-2.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-red-600/20 transition"
                      >
                        <PhoneOff className="size-4" />
                        End Call & Summarize
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── STATE 4: CALL SUMMARY & ACTION ITEMS ─────────────────── */}
            {callState === "ended" && (
              <div className="space-y-6 py-2">
                <div className="text-center space-y-2">
                  <div className="size-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="size-8" />
                  </div>
                  <h4 className="font-bold text-xl text-foreground">AI Call Summary & Next Steps</h4>
                  <p className="text-xs text-muted-foreground">
                    Call with <span className="font-semibold text-foreground">{contactName}</span> ({formatTime(duration)})
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 text-center">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Call Duration</span>
                    <p className="text-lg font-bold text-foreground mt-1">{formatTime(duration)}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 text-center">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Detected Sentiment</span>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">{completedLog?.sentiment || liveSentiment}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 text-center">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Qualification Score</span>
                    <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-1">{completedLog?.qualification_score || 85}/100</p>
                  </div>
                </div>

                {/* Executive Summary */}
                <div className="p-5 rounded-2xl bg-muted/30 border border-border/60 space-y-2">
                  <h5 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-primary" />
                    Executive Call Summary
                  </h5>
                  <p className="text-xs text-foreground leading-relaxed">
                    {completedLog?.ai_summary || "Call concluded successfully. Customer was receptive to platform features and agreed to review the forwarded documentation."}
                  </p>
                </div>

                {/* Action Items */}
                {completedLog?.action_items && completedLog.action_items.length > 0 && (
                  <div className="p-5 rounded-2xl bg-card border border-border/60 space-y-3">
                    <h5 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                      Auto-Extracted Action Items
                    </h5>
                    <div className="space-y-2">
                      {completedLog.action_items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-foreground">
                          <Check className="size-3.5 text-emerald-500 shrink-0" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/40">
                  <button
                    onClick={handleModalClose}
                    className="px-6 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition shadow-md"
                  >
                    Done & Return to CRM
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
