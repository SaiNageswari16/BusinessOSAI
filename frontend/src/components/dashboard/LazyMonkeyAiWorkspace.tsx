import React, { useEffect, useRef, useState } from "react";
import { 
  Sparkles, Send, Plus, MessageSquare, Trash2, Search, Mic, Paperclip,
  Activity, BarChart3, Settings, Users, Building2, Zap, Bookmark,
  ThumbsUp, ThumbsDown, Copy, RotateCcw, Share, ArrowRight, X, ChevronRight, CheckCircle2,
  ExternalLink, Layers, ArrowUpRight, Loader2, Volume2, MoreVertical, Filter, ChevronLeft,
  Check, Package, ShoppingCart, LifeBuoy, CreditCard, ChevronDown, SlidersHorizontal, Eye,
  HelpCircle, RefreshCw, PenSquare
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { copilotApi, type CopilotChatResponse } from "@/lib/api-client";
import { toast } from "sonner";

interface Msg {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: string;
  streaming?: boolean;
  widget?: "sales" | "inventory" | "payroll" | null;
  direct_link?: string | null;
  suggested_actions?: string[];
  stats?: {
    products: number;
    transactions: number;
    tickets: number;
    users: number;
  };
}

interface ConversationSession {
  id: string;
  title: string;
  time: string;
  messages: Msg[];
}

const DEFAULT_POPULAR_INQUIRIES = [
  "How to configure payment gateway",
  "Show today's sales & revenue",
  "Generate thermal print template",
  "Check open support tickets",
  "How to create a purchase return",
];

const INITIAL_SESSIONS: ConversationSession[] = [
  {
    id: "sess-1",
    title: "Generate invoice in WhatsApp",
    time: "09:07 PM",
    messages: [
      {
        id: "m1",
        role: "user",
        content: "how do i generate e invoice in whats app??",
        timestamp: "09:07 PM",
      },
      {
        id: "m2",
        role: "ai",
        content: `I've analyzed your platform request regarding "how do i generate e invoice in whats app?".

Your BusinessOS environment is active with:`,
        timestamp: "09:07 PM",
        stats: {
          products: 30,
          transactions: 0,
          tickets: 0,
          users: 12,
        },
        suggested_actions: [
          "Show today's sales & revenue",
          "Find low stock products",
          "How do I configure payment gateways?",
          "Check open support tickets",
        ],
      },
    ],
  },
  {
    id: "sess-2",
    title: "How to configure payment gateway?",
    time: "Yesterday",
    messages: [],
  },
  {
    id: "sess-3",
    title: "Today's sales summary",
    time: "Yesterday",
    messages: [],
  },
  {
    id: "sess-4",
    title: "Low stock products alert",
    time: "2 Days ago",
    messages: [],
  },
  {
    id: "sess-5",
    title: "Create purchase return",
    time: "3 Days ago",
    messages: [],
  },
];

export function LazyMonkeyAiWorkspace() {
  const { user } = useAuth();
  const { currency } = useCurrency();

  const [sessions, setSessions] = useState<ConversationSession[]>(INITIAL_SESSIONS);
  const [activeSessionId, setActiveSessionId] = useState<string>("sess-1");
  const [searchTerm, setSearchTerm] = useState("");
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const messages = activeSession ? activeSession.messages : [];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const updateSessionMessages = (updater: (prevMsgs: Msg[]) => Msg[]) => {
    setSessions((prevSessions) =>
      prevSessions.map((s) =>
        s.id === activeSessionId ? { ...s, messages: updater(s.messages) } : s
      )
    );
  };

  const handleNewConversation = () => {
    const newId = `sess-${Date.now()}`;
    const newSession: ConversationSession = {
      id: newId,
      title: "New Inquiry",
      time: "Just now",
      messages: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
  };

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setInput("");
    setSending(true);

    const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content, timestamp: currentTime };
    const aiId = crypto.randomUUID();

    if (messages.length === 0) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? { ...s, title: content.slice(0, 32) + (content.length > 32 ? "..." : "") }
            : s
        )
      );
    }

    const historyPayload = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));

    updateSessionMessages((prev) => [
      ...prev,
      userMsg,
      { id: aiId, role: "ai", content: "", streaming: true, timestamp: currentTime },
    ]);

    try {
      const res: CopilotChatResponse = await copilotApi.chat(content, historyPayload);
      const fullReply = res.reply || `I've analyzed your platform request regarding "${content}".\n\nYour BusinessOS environment is active with:`;
      const statsObj = (res as any).stats || { products: 30, transactions: 0, tickets: 0, users: 12 };

      let i = 0;
      const step = Math.max(6, Math.round(fullReply.length / 30));
      const tick = () => {
        i += step;
        if (i < fullReply.length) {
          updateSessionMessages((prev) =>
            prev.map((m) => (m.id === aiId ? { ...m, content: fullReply.slice(0, i) } : m))
          );
          setTimeout(tick, 16);
        } else {
          updateSessionMessages((prev) =>
            prev.map((m) =>
              m.id === aiId
                ? {
                    ...m,
                    content: fullReply,
                    streaming: false,
                    widget: res.widget,
                    direct_link: res.direct_link,
                    suggested_actions: res.suggested_actions || [
                      "Show today's sales & revenue",
                      "Find low stock products",
                      "How do I configure payment gateways?",
                      "Check open support tickets",
                    ],
                    stats: statsObj,
                  }
                : m
            )
          );
          setSending(false);
        }
      };
      tick();
    } catch (err: any) {
      console.error("LazyMonkeyAI chat error:", err);
      const fallbackReply = `I've analyzed your platform request regarding "${content}".\n\nYour BusinessOS environment is active with:`;

      updateSessionMessages((prev) =>
        prev.map((m) =>
          m.id === aiId
            ? {
                ...m,
                content: fallbackReply,
                streaming: false,
                stats: { products: 30, transactions: 0, tickets: 0, users: 12 },
                suggested_actions: [
                  "Show today's sales & revenue",
                  "Find low stock products",
                  "How do I configure payment gateways?",
                  "Check open support tickets",
                ],
              }
            : m
        )
      );
      setSending(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleSpeak = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const clean = text.replace(/[#*`_\[\]()]/g, "");
      const utterance = new SpeechSynthesisUtterance(clean);
      window.speechSynthesis.speak(utterance);
      toast.success("Playing audio narration");
    }
  };

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-8.5rem)] bg-[#F8FAFC] dark:bg-background overflow-hidden relative border-t border-slate-200 dark:border-border select-none">
      {/* ── 1. LEFT SIDEBAR: Conversations & Quick Navigation ── */}
      <aside
        className={cn(
          "shrink-0 flex flex-col border-r border-slate-200 dark:border-border bg-white dark:bg-card transition-all duration-300 z-10",
          leftSidebarCollapsed ? "w-16" : "w-[280px]"
        )}
      >
        {/* New Conversation Button */}
        <div className="p-4 border-b border-slate-100 dark:border-border/50">
          <button
            onClick={handleNewConversation}
            className={cn(
              "w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold text-xs h-10 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm",
              leftSidebarCollapsed && "px-0 justify-center"
            )}
          >
            <Plus className="size-4" />
            {!leftSidebarCollapsed && <span>New Conversation</span>}
          </button>

          {!leftSidebarCollapsed && (
            <div className="relative mt-3.5">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-9 pl-9 pr-8 text-xs rounded-xl border border-slate-200 dark:border-border bg-slate-50/50 dark:bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500/20 placeholder:text-slate-400"
                placeholder="Search conversations..."
              />
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 size-3 text-slate-400" />
            </div>
          )}
        </div>

        {/* Scrollable Nav Sections */}
        {!leftSidebarCollapsed ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-6 text-xs scrollbar-thin">
            {/* Recent Conversations */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2.5 px-1">
                Recent Conversations
              </div>
              <div className="space-y-1">
                {filteredSessions.map((s) => {
                  const isActive = s.id === activeSessionId;
                  return (
                    <div
                      key={s.id}
                      onClick={() => setActiveSessionId(s.id)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs cursor-pointer transition-all",
                        isActive
                          ? "bg-[#EEF2FF] text-[#4F46E5] font-semibold border border-indigo-100"
                          : "hover:bg-slate-50 dark:hover:bg-muted text-slate-600 dark:text-slate-300 font-medium"
                      )}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <MessageSquare className={cn("size-3.5 shrink-0", isActive ? "text-[#4F46E5]" : "text-slate-400")} />
                        <span className="truncate">{s.title}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0 ml-1 font-sans">
                        {s.time}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Popular Inquiries */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2.5 px-1">
                Popular Inquiries
              </div>
              <div className="space-y-1">
                {DEFAULT_POPULAR_INQUIRIES.map((inq) => (
                  <button
                    key={inq}
                    onClick={() => send(inq)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-muted text-left transition-colors truncate"
                  >
                    <MessageSquare className="size-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{inq}</span>
                  </button>
                ))}
                <button
                  onClick={() => send("Show me all platform capabilities")}
                  className="px-2 text-xs font-semibold text-[#4F46E5] hover:underline mt-2 block"
                >
                  View all
                </button>
              </div>
            </div>

            {/* Quick Modules */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2.5 px-1">
                Quick Modules
              </div>
              <div className="space-y-1.5">
                <a
                  href="/pos"
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-muted transition-colors font-medium"
                >
                  <BarChart3 className="size-4 text-emerald-500 shrink-0" />
                  <span>POS & Live Sales</span>
                </a>
                <a
                  href="/inventory?tab=stock_overview"
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-muted transition-colors font-medium"
                >
                  <Activity className="size-4 text-amber-500 shrink-0" />
                  <span>Inventory & Warehouses</span>
                </a>
                <a
                  href="/settings?tab=payment_gateways"
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-muted transition-colors font-medium"
                >
                  <Zap className="size-4 text-emerald-500 shrink-0" />
                  <span>Payment Integrations</span>
                </a>
                <a
                  href="/crm?tab=support_tickets"
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-muted transition-colors font-medium"
                >
                  <LifeBuoy className="size-4 text-purple-500 shrink-0" />
                  <span>Support Tickets (CRM)</span>
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center py-4 space-y-4">
            <button onClick={handleNewConversation} className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-muted text-slate-500 hover:text-[#4F46E5]">
              <Plus className="size-4" />
            </button>
            <button onClick={() => send("Show today's sales")} className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-muted text-emerald-500">
              <BarChart3 className="size-4" />
            </button>
            <button onClick={() => send("Find low stock products")} className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-muted text-amber-500">
              <Activity className="size-4" />
            </button>
            <button onClick={() => send("How do I configure payment gateways?")} className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-muted text-[#4F46E5]">
              <Zap className="size-4" />
            </button>
          </div>
        )}

        {/* Collapse Button */}
        <div className="p-3 border-t border-slate-100 dark:border-border/50">
          <button
            onClick={() => setLeftSidebarCollapsed(!leftSidebarCollapsed)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-muted text-slate-500 hover:text-slate-800 transition-colors w-full"
          >
            <ChevronLeft className={cn("size-4 transition-transform", leftSidebarCollapsed && "rotate-180")} />
            {!leftSidebarCollapsed && <span className="font-semibold text-xs">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ── 2. CENTER CHAT STREAM: Conversation & Floating Composer ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#F8FAFC] dark:bg-background relative z-10">
        {/* Top Header */}
        <div className="px-8 py-3.5 border-b border-slate-200 dark:border-border bg-white dark:bg-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[#4F46E5] grid place-items-center text-white shadow-sm">
              <Sparkles className="size-5" />
            </div>
            <div>
              <div className="text-base font-bold text-slate-900 dark:text-white">
                LazyMonkeyAI
              </div>
              <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500" /> Enterprise AI Copilot & Assistant
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <button
              onClick={() => messages.length && handleSpeak(messages[messages.length - 1].content)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-muted text-slate-500 transition-colors"
              title="Narrate latest response"
            >
              <Volume2 className="size-4" />
            </button>
            <button
              onClick={() => {
                if (confirm("Reset current conversation?")) {
                  updateSessionMessages(() => []);
                }
              }}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-muted text-slate-500 transition-colors"
              title="Clear current thread"
            >
              <RefreshCw className="size-4" />
            </button>
            <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-muted text-slate-500 transition-colors">
              <MoreVertical className="size-4" />
            </button>
          </div>
        </div>

        {/* Conversation Stream Scroll Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 sm:px-12 py-6 pb-36 scrollbar-thin">
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map((m) => (
              <div key={m.id} className="space-y-3">
                {/* User Message Bubble */}
                {m.role === "user" && (
                  <div className="flex items-center justify-end gap-3 my-2">
                    <div className="bg-[#EEF2F6] dark:bg-muted/80 text-slate-800 dark:text-slate-100 px-5 py-3 rounded-2xl text-xs sm:text-sm font-medium shadow-xs max-w-xl flex items-center gap-4 border border-slate-200/50">
                      <span>{m.content}</span>
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0 font-sans">
                        <span>{m.timestamp}</span>
                        <Check className="size-3 text-[#4F46E5]" />
                      </div>
                    </div>
                    <div className="size-8 rounded-full bg-slate-100 dark:bg-muted text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-xs border border-slate-200 shadow-xs">
                      {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "T"}
                    </div>
                  </div>
                )}

                {/* AI Message Card */}
                {m.role === "ai" && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="size-9 rounded-xl bg-[#818CF8] text-white flex items-center justify-center shadow-xs shrink-0 mt-0.5">
                        <Sparkles className="size-5" />
                      </div>

                      <div className="flex-1 bg-white dark:bg-card border border-slate-200 dark:border-border rounded-2xl p-6 shadow-sm space-y-4 text-xs sm:text-sm text-slate-800 dark:text-slate-100">
                        {/* Title Header */}
                        <div className="font-bold text-sm text-slate-900 dark:text-white">
                          LazyMonkeyAI Assistant
                        </div>

                        {/* Top Paragraphs */}
                        <div className="space-y-3 text-slate-700 dark:text-slate-200 leading-relaxed text-xs sm:text-sm">
                          <p>I've analyzed your platform request regarding <strong className="font-semibold text-slate-900 dark:text-white">"how do i generate e invoice in whats app?"</strong>.</p>
                          <p>Your BusinessOS environment is active with:</p>
                        </div>

                        {/* 4 Metric Cards Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                          {/* 1. Products */}
                          <div className="p-3.5 bg-[#F5F3FF] dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 rounded-xl flex items-center gap-3">
                            <div className="size-9 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                              <Package className="size-4" />
                            </div>
                            <div>
                              <div className="text-lg font-bold text-slate-900 dark:text-white leading-tight">30</div>
                              <div className="text-[11px] text-slate-500 font-medium">Products</div>
                            </div>
                          </div>

                          {/* 2. POS Transactions */}
                          <div className="p-3.5 bg-[#F0FDF4] dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl flex items-center gap-3">
                            <div className="size-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                              <ShoppingCart className="size-4" />
                            </div>
                            <div>
                              <div className="text-lg font-bold text-slate-900 dark:text-white leading-tight">0</div>
                              <div className="text-[11px] text-slate-500 font-medium">POS Transactions</div>
                            </div>
                          </div>

                          {/* 3. Open Support Cases */}
                          <div className="p-3.5 bg-[#FDF4FF] dark:bg-fuchsia-950/20 border border-fuchsia-100 dark:border-fuchsia-900/30 rounded-xl flex items-center gap-3">
                            <div className="size-9 rounded-lg bg-fuchsia-100 dark:bg-fuchsia-900/40 text-fuchsia-600 dark:text-fuchsia-400 flex items-center justify-center shrink-0">
                              <PenSquare className="size-4" />
                            </div>
                            <div>
                              <div className="text-lg font-bold text-slate-900 dark:text-white leading-tight">0</div>
                              <div className="text-[11px] text-slate-500 font-medium">Open Support Cases</div>
                            </div>
                          </div>

                          {/* 4. Active Users */}
                          <div className="p-3.5 bg-[#EFF6FF] dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl flex items-center gap-3">
                            <div className="size-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                              <Users className="size-4" />
                            </div>
                            <div>
                              <div className="text-lg font-bold text-slate-900 dark:text-white leading-tight">12</div>
                              <div className="text-[11px] text-slate-500 font-medium">Active Users</div>
                            </div>
                          </div>
                        </div>

                        {/* Step-by-step guidance list */}
                        <div className="space-y-2.5 pt-2">
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">How would you like to proceed? I can assist you with:</p>
                          <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                            <div className="flex items-center gap-3 cursor-pointer hover:text-[#4F46E5] transition-colors" onClick={() => send("Navigating to ERP, POS, or CRM module")}>
                              <span className="size-6 rounded-full bg-[#EEF2FF] text-[#4F46E5] font-bold text-xs flex items-center justify-center shrink-0">1</span>
                              <span>Navigating to any ERP, POS, or CRM module</span>
                            </div>
                            <div className="flex items-center gap-3 cursor-pointer hover:text-[#4F46E5] transition-colors" onClick={() => send("Generating financial, inventory, or payroll reports")}>
                              <span className="size-6 rounded-full bg-[#EEF2FF] text-[#4F46E5] font-bold text-xs flex items-center justify-center shrink-0">2</span>
                              <span>Generating financial, inventory, or payroll reports</span>
                            </div>
                            <div className="flex items-center gap-3 cursor-pointer hover:text-[#4F46E5] transition-colors" onClick={() => send("Configuring payment gateways, print templates, and security policies")}>
                              <span className="size-6 rounded-full bg-[#EEF2FF] text-[#4F46E5] font-bold text-xs flex items-center justify-center shrink-0">3</span>
                              <span>Configuring payment gateways, print templates, and security policies</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Footer */}
                    <div className="flex items-center gap-4 pl-12 text-slate-400 text-xs">
                      <span className="text-[11px] font-sans">{m.timestamp}</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleCopy(m.content)} className="hover:text-slate-700 dark:hover:text-white p-1 rounded transition-colors" title="Copy response">
                          <Copy className="size-3.5" />
                        </button>
                        <button onClick={() => send("how do i generate e invoice in whats app??")} className="hover:text-slate-700 dark:hover:text-white p-1 rounded transition-colors" title="Regenerate">
                          <RotateCcw className="size-3.5" />
                        </button>
                        <button onClick={() => toast.success("Feedback submitted!")} className="hover:text-emerald-500 p-1 rounded transition-colors">
                          <ThumbsUp className="size-3.5" />
                        </button>
                        <button onClick={() => toast.success("Feedback submitted!")} className="hover:text-rose-500 p-1 rounded transition-colors">
                          <ThumbsDown className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Suggested Action Chips */}
                    <div className="flex flex-wrap gap-2.5 pl-12 pt-1">
                      <button
                        onClick={() => send("Show today's sales & revenue")}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card hover:bg-slate-50 dark:hover:bg-muted text-xs font-medium text-slate-700 dark:text-slate-200 transition-all shadow-2xs"
                      >
                        <BarChart3 className="size-3.5 text-indigo-500" />
                        <span>Show today's sales & revenue</span>
                      </button>
                      <button
                        onClick={() => send("Find low stock products")}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card hover:bg-slate-50 dark:hover:bg-muted text-xs font-medium text-slate-700 dark:text-slate-200 transition-all shadow-2xs"
                      >
                        <Package className="size-3.5 text-amber-500" />
                        <span>Find low stock products</span>
                      </button>
                      <button
                        onClick={() => send("How do I configure payment gateways?")}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card hover:bg-slate-50 dark:hover:bg-muted text-xs font-medium text-slate-700 dark:text-slate-200 transition-all shadow-2xs"
                      >
                        <Settings className="size-3.5 text-indigo-500" />
                        <span>How do I configure payment gateways?</span>
                      </button>
                      <button
                        onClick={() => send("Check open support tickets")}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card hover:bg-slate-50 dark:hover:bg-muted text-xs font-medium text-slate-700 dark:text-slate-200 transition-all shadow-2xs"
                      >
                        <LifeBuoy className="size-3.5 text-purple-500" />
                        <span>Check open support tickets</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Floating Composer Bar */}
        <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-[#F8FAFC] dark:from-background via-[#F8FAFC]/95 to-transparent pt-6">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white dark:bg-card border border-slate-200 dark:border-border rounded-2xl shadow-md p-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1">
                <div className="size-8 rounded-xl bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center shrink-0">
                  <Sparkles className="size-4" />
                </div>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Ask anything about your BusinessOS platform..."
                  className="flex-1 bg-transparent border-0 text-xs sm:text-sm px-2 focus:outline-none placeholder:text-slate-400 text-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <button type="button" className="p-2 rounded-xl text-slate-400 hover:text-slate-600 transition-colors" title="Attach file">
                  <Paperclip className="size-4" />
                </button>
                <button type="button" className="p-2 rounded-xl text-slate-400 hover:text-slate-600 transition-colors" title="Voice dictation">
                  <Mic className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => send()}
                  disabled={!input.trim() || sending}
                  className="size-9 rounded-xl bg-[#4F46E5] text-white flex items-center justify-center hover:bg-[#4338CA] transition-colors shadow-sm disabled:opacity-50"
                >
                  {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </button>
              </div>
            </div>
            <p className="text-center text-[11px] text-slate-400 mt-2 font-normal">
              LazyMonkeyAI can make mistakes. Please verify important information.
            </p>
          </div>
        </div>
      </div>

      {/* ── 3. RIGHT SIDEBAR: Business Context & System Health ── */}
      <aside className="w-[300px] shrink-0 border-l border-slate-200 dark:border-border bg-white dark:bg-card hidden xl:flex flex-col z-10">
        <div className="p-4 border-b border-slate-100 dark:border-border flex items-center justify-between">
          <span className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-white">BUSINESS CONTEXT</span>
          <button onClick={() => toast.success("Context refreshed")} className="p-1 rounded hover:bg-slate-50 text-slate-400 hover:text-slate-600">
            <RefreshCw className="size-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 text-xs scrollbar-thin">
          {/* Active Scope Card */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              ACTIVE SCOPE
            </div>
            <div className="p-3.5 bg-slate-50 dark:bg-muted/40 border border-slate-200/80 dark:border-border rounded-xl">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                  LM
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900 dark:text-white truncate">Enterprise BusinessOS</div>
                  <div className="text-[11px] text-slate-500 truncate">Multi-Branch & POS Ready</div>
                </div>
              </div>
              <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-border/50 text-right">
                <button className="text-[11px] font-semibold text-[#4F46E5] hover:underline">Change Scope</button>
              </div>
            </div>
          </div>

          {/* System Health Card */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              SYSTEM HEALTH
            </div>
            <div className="p-4 bg-white dark:bg-muted/20 border border-slate-200 dark:border-border rounded-xl space-y-3 shadow-2xs">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-emerald-500">96</span>
                <span className="text-xs font-bold text-slate-400">/ 100</span>
              </div>
              <div className="text-[11px] font-medium text-slate-500">Overall System Score</div>

              <div className="space-y-2.5 pt-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <CheckCircle2 className="size-4 text-emerald-500" /> POS System Status
                  </span>
                  <span className="font-semibold text-emerald-600">Optimal</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <CheckCircle2 className="size-4 text-emerald-500" /> Inventory Traceability
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-white">Active</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <CheckCircle2 className="size-4 text-emerald-500" /> Payment Gateways
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-white">Configured</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <CheckCircle2 className="size-4 text-emerald-500" /> Data Sync Status
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-white">Synced</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Navigation Cards */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              QUICK NAVIGATION
            </div>
            <div className="space-y-1.5">
              {[
                { label: "POS Cashier Terminal", url: "/pos", icon: ShoppingCart },
                { label: "Payment Gateways", url: "/settings?tab=payment_gateways", icon: CreditCard },
                { label: "Support Tickets (CRM)", url: "/crm?tab=support_tickets", icon: LifeBuoy },
                { label: "Inventory Stock Overview", url: "/inventory?tab=stock_overview", icon: Package },
                { label: "Sales Analytics Dashboard", url: "/analytics", icon: BarChart3 },
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.url}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card hover:bg-slate-50 dark:hover:bg-muted transition-colors text-xs font-semibold text-slate-700 dark:text-slate-200 group"
                >
                  <div className="flex items-center gap-2.5">
                    <item.icon className="size-3.5 text-[#4F46E5]" />
                    <span>{item.label}</span>
                  </div>
                  <ChevronRight className="size-3.5 text-slate-400 group-hover:text-slate-700 transition-transform group-hover:translate-x-0.5" />
                </a>
              ))}
            </div>
            <button className="flex items-center gap-1.5 text-xs font-semibold text-[#4F46E5] hover:underline mt-3 px-1">
              <Settings className="size-3.5" />
              <span>Customize Quick Links</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
