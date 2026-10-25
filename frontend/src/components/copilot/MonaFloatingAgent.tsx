import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Send, X, Plus, Loader2, Menu, ChevronRight,
  BarChart3, Boxes, Receipt, Users, CreditCard, FileText,
} from "lucide-react";
import { copilotApi, type CopilotChatResponse } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MarkdownFormatter } from "./MarkdownFormatter";

/* ──────────────────────────────────────────────────────────────
   MONA — LazyMonkeyAI Floating Agent
   A small, always-present assistant docked at the bottom-right
   of every dashboard page. It reads the current route and asks
   Mona to give page-relevant answers, formatted cleanly.
   ────────────────────────────────────────────────────────────── */

interface MonaMsg {
  id: string;
  role: "user" | "ai";
  content: string;
  time?: string;
  streaming?: boolean;
  suggested_actions?: string[];
}

// Page-relevant quick actions per route segment (kept local so widget
// works even before the user has typed anything)
const PAGE_PROMPTS: Array<{ match: RegExp; label: string; prompt: string; icon: any }> = [
  { match: /dashboard/i, label: "📊 Show today's sales", prompt: "Show today's sales and revenue summary", icon: BarChart3 },
  { match: /pos/i, label: "🧾 POS transactions", prompt: "Show today's POS counter transactions and register status", icon: Receipt },
  { match: /inventory|warehouse/i, label: "📦 Low-stock items", prompt: "Which products are low on stock or expiring soon?", icon: Boxes },
  { match: /purchase|procurement/i, label: "🧾 Vendor bills", prompt: "Show outstanding vendor bills and payables", icon: FileText },
  { match: /accounting|erp/i, label: "💰 Invoices & GST", prompt: "Show unpaid customer invoices and GST summary", icon: CreditCard },
  { match: /hrms|hr\b/i, label: "👥 Payroll summary", prompt: "Show employee count and payroll summary", icon: Users },
  { match: /crm/i, label: "🎫 Open tickets", prompt: "Show open support tickets and customer pipeline", icon: Sparkles },
  { match: /reports/i, label: "📈 Sales report", prompt: "Generate a sales summary report for the current period", icon: BarChart3 },
  { match: /settings|system/i, label: "⚙️ How to configure?", prompt: "How do I configure this section of the system?", icon: Sparkles },
];

const MONA_WELCOME: MonaMsg = {
  id: "mona-welcome",
  role: "ai",
  content:
    "Hi! I'm **Mona** 🐵 — your LazyMonkeyAI sidekick.\n\nI'm here on every screen. Ask me anything about the module you're looking at, or tap a quick chip below. I'll keep it short, clear, and neat.",
  time: "Just now",
  suggested_actions: ["Show today's sales & revenue", "Find low stock products", "How do I configure payment gateways?"],
};

export function MonaFloatingAgent() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [messages, setMessages] = useState<MonaMsg[]>([MONA_WELCOME]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Page context = current pathname + search
  const pageContext = useMemo(() => {
    const path = location.pathname || "/";
    const search = location.searchStr || "";
    return search ? `${path}${search}` : path;
  }, [location.pathname, location.searchStr]);

  // Page-relevant quick chips (first match wins, fallback to generic)
  const chips = useMemo(() => {
    const hit = PAGE_PROMPTS.find((p) => p.match.test(pageContext));
    if (hit) {
      return [hit, ...PAGE_PROMPTS.filter((p) => p !== hit).slice(0, 2)];
    }
    return PAGE_PROMPTS.slice(0, 3);
  }, [pageContext]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  // Persist per-tenant conversation in sessionStorage so it survives route hops but not browser restarts
  useEffect(() => {
    try {
      sessionStorage.setItem("mona_chat", JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("mona_chat");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      }
    } catch {}
  }, []);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setInput("");
    setSending(true);

    const userMsg: MonaMsg = { id: crypto.randomUUID(), role: "user", content, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
    const aiId = crypto.randomUUID();

    setMessages((m) => [...m, userMsg, { id: aiId, role: "ai", content: "", streaming: true }]);

    try {
      const historyPayload = messages.slice(-6).map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.content }));
      const res: CopilotChatResponse = await copilotApi.chat(content, historyPayload, pageContext);
      const reply = res?.reply || "I've got that — here's a quick look. Anything else you'd like to check on this screen?";

      setMessages((m) =>
        m.map((msg) =>
          msg.id === aiId
            ? { ...msg, content: reply, streaming: false, suggested_actions: res?.suggested_actions, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }
            : msg
        )
      );
    } catch (err: any) {
      console.error("Mona chat error:", err);
      setMessages((m) =>
        m.map((msg) =>
          msg.id === aiId
            ? {
                ...msg,
                content: "I couldn't reach the AI engine right now. Check that the backend is running, or try again in a moment.",
                streaming: false,
              }
            : msg
        )
      );
    } finally {
      setSending(false);
    }
  };

  const handleClear = () => {
    setMessages([MONA_WELCOME]);
    setInput("");
  };

  return (
    <>
      {/* ── Docked launcher button (bottom-right, always visible) ── */}
      {!open || collapsed ? (
        <AnimatePresence>
          <motion.button
            key="mona-fab"
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            onClick={() => { setOpen(true); setCollapsed(false); }}
            className="fixed bottom-5 right-5 z-[100] group cursor-pointer"
            aria-label="Open Mona, your LazyMonkeyAI assistant"
          >
            {/* Pulsing ring */}
            <span className="absolute inset-0 rounded-full bg-purple-500/30 animate-ping" />
            <div className="relative size-12 rounded-full bg-gradient-to-br from-purple-600 via-indigo-600 to-teal-500 text-white shadow-xl flex items-center justify-center transition-transform group-hover:scale-105">
              <span className="text-xl">🐵</span>
            </div>
            {/* Hover tooltip */}
            <div className="absolute right-14 top-1/2 -translate-y-1/2 whitespace-nowrap bg-slate-900 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
              Ask Mona 🐵
            </div>
          </motion.button>
        </AnimatePresence>
      ) : null}

      {/* ── Expanded chat panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="mona-panel"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-5 right-5 z-[100] w-[340px] sm:w-[380px] h-[540px] sm:h-[560px] max-h-[calc(100vh-40px)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col"
            role="dialog"
            aria-label="Mona — LazyMonkeyAI Assistant"
          >
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-teal-600 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-full bg-white/20 flex items-center justify-center text-lg">🐵</div>
                <div>
                  <div className="font-bold text-sm leading-tight">Mona <span className="text-[10px] font-medium text-white/70">LazyMonkeyAI</span></div>
                  <div className="text-[10px] text-white/75 flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-300 animate-pulse" />
                    On <span className="font-semibold text-white">{pageContext.split("?")[0]}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={handleClear} className="p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer" title="New conversation">
                  <Plus className="size-4" />
                </button>
                <button onClick={() => setCollapsed(true)} className="p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer" title="Minimize">
                  <ChevronRight className="size-4 -rotate-90" />
                </button>
                <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer" title="Close">
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Page context banner */}
            <div className="px-4 py-1.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700 flex items-center gap-1.5 text-[10px] text-slate-500 shrink-0">
              <Menu className="size-3" />
              <span className="truncate">I'm aware you're on <span className="font-bold text-slate-700 dark:text-slate-200">{pageContext}</span> — answers will match this screen.</span>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50/50 dark:bg-slate-950/30">
              {messages.map((m) => (
                <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs border",
                      m.role === "user"
                        ? "bg-purple-600 text-white border-purple-600 rounded-br-md"
                        : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 rounded-bl-md"
                    )}
                  >
                    {m.role === "ai" && !m.streaming && <MarkdownFormatter text={m.content} />}
                    {m.role === "ai" && m.streaming && (
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Loader2 className="size-3.5 animate-spin text-purple-500" />
                        <span className="text-[11px]">Mona is thinking…</span>
                      </div>
                    )}
                    {m.role === "user" && <p className="whitespace-pre-line">{m.content}</p>}
                    {m.time && (
                      <div className={cn("text-[9px] mt-1", m.role === "user" ? "text-purple-200 text-right" : "text-slate-400")}>{m.time}</div>
                    )}
                  </div>
                </div>
              ))}

              {/* Suggested follow-up chips for the latest AI reply */}
              {(() => {
                const lastAi = [...messages].reverse().find((m) => m.role === "ai" && !m.streaming);
                if (!lastAi?.suggested_actions?.length) return null;
                return (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {lastAi.suggested_actions.map((act) => (
                      <button
                        key={act}
                        onClick={() => send(act)}
                        className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:border-purple-300 transition-colors text-slate-600 dark:text-slate-300 cursor-pointer"
                      >
                        {act}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Quick chips (page-aware) */}
            <div className="px-3 py-1.5 flex items-center gap-1 overflow-x-auto border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 scrollbar-none">
              {chips.map((c) => {
                const Icon = c.icon;
                return (
                  <button
                    key={c.label}
                    onClick={() => send(c.prompt)}
                    className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-purple-100 dark:hover:bg-purple-950/40 hover:text-purple-700 whitespace-nowrap transition-colors shrink-0 cursor-pointer"
                  >
                    <Icon className="size-3" />
                    {c.label}
                  </button>
                );
              })}
            </div>

            {/* Composer */}
            <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              <div className="flex items-end gap-1.5">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={`Ask Mona about ${pageContext.split("?")[0].replace("/", "")}…`}
                  className="flex-1 text-xs px-3 py-2 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border-none outline-none focus:ring-2 focus:ring-purple-400 placeholder:text-slate-400"
                />
                <button
                  onClick={() => send()}
                  disabled={!input.trim() || sending}
                  className="h-9 px-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-teal-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-md hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer"
                >
                  {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                </button>
              </div>
              <div className="text-center mt-1 text-[9px] text-slate-400">
                Mona is your LazyMonkeyAI copilot · {pageContext.split("?")[0]}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
