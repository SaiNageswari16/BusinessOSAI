import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Phone,
  PhoneCall,
  Clock,
  User,
  Bot,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Check,
  TrendingUp,
  FileText,
  Calendar,
  Building,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CRMCallLog, CRMCallTurnMessage } from "@/lib/api-client";
import { toast } from "sonner";

interface CallTranscriptModalProps {
  open: boolean;
  onClose: () => void;
  callLog: CRMCallLog | null;
  onCallAgain?: (log: CRMCallLog) => void;
}

export const CallTranscriptModal: React.FC<CallTranscriptModalProps> = ({
  open,
  onClose,
  callLog,
  onCallAgain,
}) => {
  const [copied, setCopied] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState<number | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
    }
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (!open && synthRef.current) {
      synthRef.current.cancel();
      setIsPlayingAudio(false);
      setCurrentPlayingIndex(null);
    }
  }, [open]);

  if (!open || !callLog) return null;

  const transcript: CRMCallTurnMessage[] = Array.isArray(callLog.transcript)
    ? callLog.transcript
    : [];

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, "0")}s`;
  };

  const getSentimentStyle = (sentiment?: string) => {
    const s = sentiment?.toLowerCase() || "";
    if (s.includes("positive") || s.includes("interested") || s.includes("enthusiastic")) {
      return {
        bg: "bg-emerald-500/10 dark:bg-emerald-950/30",
        border: "border-emerald-500/30",
        text: "text-emerald-700 dark:text-emerald-400",
        label: sentiment || "Positive",
      };
    }
    if (s.includes("neutral") || s.includes("inquiry") || s.includes("curious")) {
      return {
        bg: "bg-blue-500/10 dark:bg-blue-950/30",
        border: "border-blue-500/30",
        text: "text-blue-700 dark:text-blue-400",
        label: sentiment || "Neutral / Curious",
      };
    }
    if (s.includes("objection") || s.includes("hesitant") || s.includes("skeptical")) {
      return {
        bg: "bg-amber-500/10 dark:bg-amber-950/30",
        border: "border-amber-500/30",
        text: "text-amber-700 dark:text-amber-400",
        label: sentiment || "Hesitant / Objections",
      };
    }
    if (s.includes("negative") || s.includes("not interested") || s.includes("rejected")) {
      return {
        bg: "bg-rose-500/10 dark:bg-rose-950/30",
        border: "border-rose-500/30",
        text: "text-rose-700 dark:text-rose-400",
        label: sentiment || "Not Interested",
      };
    }
    return {
      bg: "bg-muted/40",
      border: "border-border",
      text: "text-muted-foreground",
      label: sentiment || "Neutral",
    };
  };

  const sentimentStyle = getSentimentStyle(callLog.sentiment);

  const copyTranscriptText = () => {
    const header = `CALL TRANSCRIPT: ${callLog.contact_name} (${callLog.company_name || "N/A"})
Date: ${new Date(callLog.created_at).toLocaleString()}
Duration: ${formatDuration(callLog.duration_seconds)}
Sentiment: ${callLog.sentiment || "Neutral"}
Persona: ${callLog.agent_persona}
Summary: ${callLog.ai_summary || "N/A"}
--------------------------------------------------\n\n`;

    const turns = transcript
      .map(
        (t) =>
          `[${t.role === "agent" ? "AI AGENT" : "CONTACT"} - ${t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : ""}]\n${t.text}\n`
      )
      .join("\n");

    navigator.clipboard.writeText(header + turns);
    setCopied(true);
    toast.success("Call transcript copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTranscript = () => {
    const header = `CALL TRANSCRIPT: ${callLog.contact_name} (${callLog.company_name || "N/A"})
Date: ${new Date(callLog.created_at).toLocaleString()}
Duration: ${formatDuration(callLog.duration_seconds)}
Sentiment: ${callLog.sentiment || "Neutral"}
Persona: ${callLog.agent_persona}
Summary: ${callLog.ai_summary || "N/A"}
Action Items: ${callLog.action_items?.join("; ") || "None"}
--------------------------------------------------\n\n`;

    const turns = transcript
      .map(
        (t) =>
          `[${t.role === "agent" ? "AI AGENT" : callLog.contact_name}] ${t.timestamp ? `(${new Date(t.timestamp).toLocaleTimeString()})` : ""}:\n${t.text}\n`
      )
      .join("\n");

    const blob = new Blob([header + turns], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `call_transcript_${callLog.contact_name.replace(/\s+/g, "_")}_${new Date(callLog.created_at).toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Transcript file downloaded");
  };

  // Audio Playback using SpeechSynthesis
  const playFromIndex = (index: number) => {
    if (!synthRef.current || transcript.length === 0) return;

    synthRef.current.cancel();
    setIsPlayingAudio(true);
    setCurrentPlayingIndex(index);

    const playNext = (i: number) => {
      if (i >= transcript.length) {
        setIsPlayingAudio(false);
        setCurrentPlayingIndex(null);
        return;
      }
      setCurrentPlayingIndex(i);
      const turn = transcript[i];
      const utterance = new SpeechSynthesisUtterance(turn.text);
      utterance.rate = playbackSpeed;
      utterance.pitch = turn.role === "agent" ? 1.05 : 0.95;

      utterance.onend = () => {
        playNext(i + 1);
      };
      utterance.onerror = () => {
        setIsPlayingAudio(false);
        setCurrentPlayingIndex(null);
      };
      synthRef.current?.speak(utterance);
    };

    playNext(index);
  };

  const togglePlayback = () => {
    if (isPlayingAudio) {
      synthRef.current?.cancel();
      setIsPlayingAudio(false);
      setCurrentPlayingIndex(null);
    } else {
      playFromIndex(currentPlayingIndex ?? 0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-background border border-border/80 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-muted/20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shrink-0">
              <PhoneCall className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base sm:text-lg text-foreground truncate">
                  {callLog.contact_name}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
                  {callLog.target_type}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${sentimentStyle.bg} ${sentimentStyle.border} ${sentimentStyle.text}`}>
                  {sentimentStyle.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate flex items-center gap-2 mt-0.5">
                {callLog.company_name && (
                  <span className="flex items-center gap-1">
                    <Building className="size-3" /> {callLog.company_name}
                  </span>
                )}
                {callLog.contact_phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="size-3" /> {callLog.contact_phone}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="size-3" /> {formatDuration(callLog.duration_seconds)}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" /> {new Date(callLog.created_at).toLocaleDateString()}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onCallAgain && (
              <button
                onClick={() => {
                  onClose();
                  onCallAgain(callLog);
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <PhoneCall className="size-3.5" />
                Call Again
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* AI Intelligence & Executive Summary Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Summary Box */}
            <div className="md:col-span-2 p-4 rounded-xl bg-gradient-to-br from-indigo-50/50 via-purple-50/30 to-background dark:from-indigo-950/20 dark:via-purple-950/10 dark:to-background border border-indigo-200/50 dark:border-indigo-800/40 space-y-2">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs uppercase tracking-wider">
                <Sparkles className="size-4" />
                AI Call Summary & Key Takeaways
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed">
                {callLog.ai_summary || "Call completed. Discussion focused on requirements and business overview."}
              </p>
              {callLog.action_items && callLog.action_items.length > 0 && (
                <div className="pt-2 border-t border-indigo-200/40 dark:border-indigo-800/30 space-y-1">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Next Action Items:
                  </span>
                  <div className="space-y-1">
                    {callLog.action_items.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-xs text-foreground/80">
                        <CheckCircle2 className="size-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Call Metadata & Score Box */}
            <div className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col justify-between space-y-3">
              <div className="space-y-2.5">
                <div>
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                    AI Agent Persona
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs font-bold text-foreground">
                    <Bot className="size-3.5 text-indigo-500" />
                    <span>{callLog.agent_persona}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                    Call Mode & Channel
                  </span>
                  <div className="mt-0.5 text-xs font-semibold text-foreground">
                    {callLog.call_mode === "livekit_sip" ? "📞 Live SIP VoIP" : "🎙️ Browser AI Voice"}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                    Lead Qualification
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full"
                        style={{ width: `${callLog.qualification_score || 80}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-foreground">
                      {callLog.qualification_score || 80}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Call ID:</span>
                <span className="font-mono text-[10px] truncate max-w-[120px]">{callLog.call_id}</span>
              </div>
            </div>
          </div>

          {/* Transcript Control Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 border border-border">
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlayback}
                disabled={transcript.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
              >
                {isPlayingAudio ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                {isPlayingAudio ? "Pause Playback" : "Listen to Call"}
              </button>

              {isPlayingAudio && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 text-xs font-semibold">
                  <span className="size-2 rounded-full bg-indigo-600 animate-ping" />
                  Playing Turn {(currentPlayingIndex ?? 0) + 1} of {transcript.length}
                </div>
              )}

              <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground ml-2">
                <span>Speed:</span>
                {[1, 1.25, 1.5].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      playbackSpeed === speed
                        ? "bg-foreground text-background"
                        : "bg-muted hover:bg-muted/80 text-foreground"
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={copyTranscriptText}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted/60 text-xs font-semibold text-foreground transition-colors"
              >
                {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy Transcript"}
              </button>

              <button
                onClick={downloadTranscript}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted/60 text-xs font-semibold text-foreground transition-colors"
              >
                <Download className="size-3.5" />
                Download
              </button>
            </div>
          </div>

          {/* Full Multi-Turn Transcript View */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
              <span>Conversation Turns ({transcript.length})</span>
              <span>Timeline</span>
            </div>

            {transcript.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed rounded-xl text-muted-foreground bg-muted/20">
                <FileText className="size-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-semibold">No detailed turn-by-turn transcript recorded for this session.</p>
                <p className="text-xs text-muted-foreground mt-1">Summary and metrics are preserved above.</p>
              </div>
            ) : (
              <div className="space-y-3 font-sans">
                {transcript.map((msg, idx) => {
                  const isAgent = msg.role === "agent";
                  const isCurrentlyPlaying = currentPlayingIndex === idx;

                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-3 ${isAgent ? "justify-start" : "justify-end"}`}
                    >
                      {/* Agent Avatar */}
                      {isAgent && (
                        <div
                          className={`size-8 rounded-xl flex items-center justify-center text-white shrink-0 mt-1 shadow-sm ${
                            isCurrentlyPlaying
                              ? "bg-gradient-to-br from-indigo-500 to-purple-600 ring-2 ring-indigo-500 ring-offset-2 animate-bounce"
                              : "bg-indigo-600"
                          }`}
                        >
                          <Bot className="size-4" />
                        </div>
                      )}

                      {/* Bubble */}
                      <div
                        onClick={() => playFromIndex(idx)}
                        className={`max-w-[82%] sm:max-w-[70%] p-3.5 rounded-2xl cursor-pointer transition-all duration-200 relative group ${
                          isAgent
                            ? `bg-indigo-50/80 dark:bg-indigo-950/40 border ${
                                isCurrentlyPlaying
                                  ? "border-indigo-500 shadow-md ring-2 ring-indigo-500/20"
                                  : "border-indigo-200/60 dark:border-indigo-800/40"
                              } text-foreground rounded-tl-sm`
                            : `bg-muted/80 dark:bg-muted/50 border ${
                                isCurrentlyPlaying
                                  ? "border-emerald-500 shadow-md ring-2 ring-emerald-500/20"
                                  : "border-border"
                              } text-foreground rounded-tr-sm`
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-1 text-[11px]">
                          <span className="font-bold flex items-center gap-1.5">
                            {isAgent ? (
                              <span className="text-indigo-600 dark:text-indigo-400">AI Agent ({callLog.agent_persona})</span>
                            ) : (
                              <span className="text-foreground">{callLog.contact_name}</span>
                            )}
                          </span>

                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground opacity-80">
                            {msg.sentiment && (
                              <span className="px-1.5 py-0.2 rounded bg-background/60 font-medium">
                                {msg.sentiment}
                              </span>
                            )}
                            {msg.timestamp && (
                              <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                            )}
                          </div>
                        </div>

                        <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                          {msg.text}
                        </p>

                        {/* Hover hint */}
                        <div className="absolute right-2 bottom-1 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-muted-foreground flex items-center gap-1">
                          <Volume2 className="size-3" /> Click to play
                        </div>
                      </div>

                      {/* Contact Avatar */}
                      {!isAgent && (
                        <div
                          className={`size-8 rounded-xl flex items-center justify-center text-white shrink-0 mt-1 shadow-sm ${
                            isCurrentlyPlaying
                              ? "bg-gradient-to-br from-emerald-500 to-teal-600 ring-2 ring-emerald-500 ring-offset-2 animate-bounce"
                              : "bg-slate-700 dark:bg-slate-600"
                          }`}
                        >
                          <User className="size-4" />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            Status: <span className="font-bold text-emerald-600 dark:text-emerald-400">{callLog.status}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border bg-background hover:bg-muted/60 text-xs font-semibold text-foreground transition-colors"
            >
              Close
            </button>
            {onCallAgain && (
              <button
                onClick={() => {
                  onClose();
                  onCallAgain(callLog);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md hover:shadow-indigo-500/25 transition-all"
              >
                <PhoneCall className="size-3.5" />
                Initiate New Call
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
