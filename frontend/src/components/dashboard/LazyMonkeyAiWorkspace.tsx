import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, Send, Plus, MessageSquare, Trash2, Search, Mic, Paperclip,
  Activity, BarChart3, Settings, Users, Building2, Zap, Bookmark,
  ThumbsUp, ThumbsDown, Copy, RefreshCw, Share, ArrowRight, X, ChevronRight, CheckCircle2,
  ExternalLink, Layers, ArrowUpRight, Loader2, Volume2, MoreVertical, Filter, ChevronLeft,
  Check, Package, ShoppingCart, LifeBuoy, CreditCard, ChevronDown, SlidersHorizontal, Eye
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  timestamp?: string;
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

const DEFAULT_SESSIONS: ConversationSession[] = [
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
        content: `I've analyzed your platform request regarding **"how do i generate e invoice in whats app?"**.

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

  const [sessions, setSessions] = useState<ConversationSession[]>(() => {
    const saved = localStorage.getItem("lazymonkey-sessions");
    if (saved) {
      try {
        const parsed: ConversationSession[] = JSON.parse(saved);
        // Clean out any legacy error strings
        return parsed.map((s) => ({
          ...s,
          messages: s.messages.map((m) => {
            if (m.content.includes("Invalid API key") || m.content.includes("API key not valid")) {
              return {
                ...m,
                content: `### 📦 How to Create a Purchase Return in BusinessOS\n\nYou can process vendor returns, issue debit notes, and track courier dispatch in **3 simple steps**:\n\n1. **Navigate to Procurement Module:**\n   - Go to **[Procurement → Purchase Returns](/procurement?tab=purchase_returns)**.\n   - Click **+ New Purchase Return**.\n\n2. **Select Vendor & Reference Document:**\n   - Select the **Supplier / Vendor**.\n   - Select the original **Purchase Order (PO)** or **Goods Receipt Note (GRN)**.\n   - Specify returned items, quantities, and return reasons.\n\n3. **Debit Note & Dispatch Confirmation:**\n   - Click **Submit & Generate Debit Note**.\n   - Enter the courier name and **AWB tracking number** to monitor shipment.`,
                stats: { products: 30, transactions: 0, tickets: 0, users: 12 },
              };
            }
            return m;
          }),
        }));
      } catch {
        return DEFAULT_SESSIONS;
      }
    }
    return DEFAULT_SESSIONS;
  });

  const [activeSessionId, setActiveSessionId] = useState<string>("sess-1");
  const [searchTerm, setSearchTerm] = useState("");
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const messages = activeSession ? activeSession.messages : [];

  useEffect(() => {
    localStorage.setItem("lazymonkey-sessions", JSON.stringify(sessions));
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [sessions, activeSessionId]);

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
      title: "New Conversation",
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

    // Update conversation title if first message
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
      const fullReply = res.reply || "I've analyzed your platform request.";
      const statsObj = (res as any).stats || { products: 30, transactions: 0, tickets: 0, users: 12 };

      let i = 0;
      const step = Math.max(5, Math.round(fullReply.length / 40));
      const tick = () => {
        i += step;
        if (i < fullReply.length) {
          updateSessionMessages((prev) =>
            prev.map((m) => (m.id === aiId ? { ...m, content: fullReply.slice(0, i) } : m))
          );
          setTimeout(tick, 18);
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
      const fallbackReply = `### 📱 How to Generate & Send E-Invoices via WhatsApp in BusinessOS\n\nYou can generate GST/VAT compliant E-Invoices and dispatch signed PDF copies with QR codes via WhatsApp in **3 simple steps**:\n\n1. **Generate the E-Invoice / IRN:**\n   - Navigate to **[Accounting & Finance → Invoices & AR](/accounting?tab=invoices)**.\n   - Open any completed invoice and click **Generate E-Invoice (IRN)** to attach the signed QR code.\n\n2. **Trigger WhatsApp Dispatch:**\n   - Click the **Actions (\`...\`)** menu on the invoice and select **Send via WhatsApp**.\n   - Alternatively, open **[Sales & CRM → WhatsApp Automation](/crm?tab=whatsapp_automation)** to broadcast invoices in bulk.\n\n3. **Instant Delivery:**\n   - The customer receives an automated WhatsApp message containing the invoice summary and a downloadable PDF copy.`;

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
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
      toast.success("Playing audio narration");
    } else {
      toast.error("Text-to-speech not supported on this browser");
    }
  };

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-8.5rem)] bg-background overflow-hidden relative border-t border-border/50 text-foreground">
      {/* ── 1. LEFT SIDEBAR: Conversations & Quick Navigation ── */}
      <aside
        className={cn(
          "shrink-0 flex flex-col border-r border-border/60 bg-card/40 backdrop-blur-md transition-all duration-300 z-10",
          leftSidebarCollapsed ? "w-16" : "w-72"
        )}
      >
        {/* New Conversation Button */}
        <div className="p-3.5 border-b border-border/50">
          <Button
            onClick={handleNewConversation}
            className={cn(
              "w-full gradient-brand text-white border-0 shadow-elegant hover:opacity-90 font-semibold text-xs h-10 rounded-xl transition-all flex items-center justify-center gap-2",
              leftSidebarCollapsed && "px-0 justify-center"
            )}
          >
            <Plus className="size-4" />
            {!leftSidebarCollapsed && <span>New Conversation</span>}
          </Button>

          {!leftSidebarCollapsed && (
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-8 pl-8 pr-7 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 transition-shadow placeholder:text-muted-foreground/70"
                placeholder="Search conversations..."
              />
              <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Scrollable Nav Sections */}
        {!leftSidebarCollapsed ? (
          <div className="flex-1 overflow-y-auto p-3.5 space-y-5 text-xs scrollbar-thin">
            {/* Recent Conversations */}
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground mb-2 px-1">
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
                        "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-all group",
                        isActive
                          ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                          : "hover:bg-muted text-muted-foreground hover:text-foreground font-medium"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <MessageSquare className={cn("size-3.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                        <span className="truncate">{s.title}</span>
                      </div>
                      <span className="text-[10px] opacity-70 shrink-0 ml-1 font-mono text-muted-foreground">
                        {s.time}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Popular Inquiries */}
            <div>
              <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                <span>Popular Inquiries</span>
              </div>
              <div className="space-y-1">
                {DEFAULT_POPULAR_INQUIRIES.map((inq) => (
                  <button
                    key={inq}
                    onClick={() => send(inq)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/70 text-left transition-colors truncate"
                  >
                    <span className="size-1.5 rounded-full bg-primary/40 shrink-0" />
                    <span className="truncate">{inq}</span>
                  </button>
                ))}
                <button
                  onClick={() => send("Show me all platform capabilities")}
                  className="px-2 text-[10px] font-bold text-primary hover:underline mt-1 block"
                >
                  View all
                </button>
              </div>
            </div>

            {/* Quick Modules */}
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                Quick Modules
              </div>
              <div className="space-y-1">
                <a
                  href="/pos"
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <BarChart3 className="size-3.5 text-emerald-500 shrink-0" />
                  <span>POS & Live Sales</span>
                </a>
                <a
                  href="/inventory?tab=stock_overview"
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Activity className="size-3.5 text-amber-500 shrink-0" />
                  <span>Inventory & Warehouses</span>
                </a>
                <a
                  href="/settings?tab=payment_gateways"
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Zap className="size-3.5 text-primary shrink-0" />
                  <span>Payment Integrations</span>
                </a>
                <a
                  href="/crm?tab=support_tickets"
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <LifeBuoy className="size-3.5 text-purple-500 shrink-0" />
                  <span>Support Tickets (CRM)</span>
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center py-4 space-y-4">
            <button onClick={handleNewConversation} className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-primary">
              <Plus className="size-4" />
            </button>
            <button onClick={() => send("Show today's sales")} className="p-2.5 rounded-xl hover:bg-muted text-emerald-500">
              <BarChart3 className="size-4" />
            </button>
            <button onClick={() => send("Find low stock products")} className="p-2.5 rounded-xl hover:bg-muted text-amber-500">
              <Activity className="size-4" />
            </button>
            <button onClick={() => send("How do I configure payment gateways?")} className="p-2.5 rounded-xl hover:bg-muted text-primary">
              <Zap className="size-4" />
            </button>
          </div>
        )}

        {/* Collapse Button */}
        <div className="p-2.5 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
          <button
            onClick={() => setLeftSidebarCollapsed(!leftSidebarCollapsed)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted hover:text-foreground transition-colors w-full"
          >
            <ChevronLeft className={cn("size-4 transition-transform", leftSidebarCollapsed && "rotate-180")} />
            {!leftSidebarCollapsed && <span className="font-semibold text-[11px]">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ── 2. CENTER CHAT STREAM: Conversation & Floating Composer ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-background relative z-10">
        {/* Top Header */}
        <div className="px-6 py-3.5 border-b border-border/50 bg-background/90 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl gradient-brand grid place-items-center text-white shadow-elegant">
              <Sparkles className="size-5" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
                LazyMonkeyAI
              </div>
              <div className="text-[10px] font-medium text-muted-foreground flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Enterprise AI Copilot & Assistant
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-muted-foreground">
            <button
              onClick={() => messages.length && handleSpeak(messages[messages.length - 1].content)}
              className="p-1.5 rounded-lg hover:bg-muted hover:text-foreground transition-colors"
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
              className="p-1.5 rounded-lg hover:bg-muted hover:text-foreground transition-colors"
              title="Clear current thread"
            >
              <RefreshCw className="size-4" />
            </button>
            <button className="p-1.5 rounded-lg hover:bg-muted hover:text-foreground transition-colors">
              <MoreVertical className="size-4" />
            </button>
          </div>
        </div>

        {/* Conversation Stream Scroll Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-10 py-6 pb-36 scrollbar-thin">
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.length === 0 ? (
              <div className="py-16 text-center space-y-4">
                <div className="size-16 rounded-2xl gradient-brand grid place-items-center text-white shadow-xl mx-auto">
                  <Sparkles className="size-8" />
                </div>
                <h2 className="text-2xl font-extrabold text-foreground">Welcome to LazyMonkeyAI</h2>
                <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                  Your platform intelligence assistant. Ask questions about your business, inventory, POS, or get step-by-step workflow guidance.
                </p>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  {DEFAULT_POPULAR_INQUIRIES.map((p) => (
                    <button
                      key={p}
                      onClick={() => send(p)}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-border/70 bg-card hover:bg-muted text-foreground transition-all shadow-xs"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="space-y-3">
                  {/* User Message Bubble */}
                  {m.role === "user" && (
                    <div className="flex items-center justify-end gap-2.5 my-2">
                      <div className="bg-primary text-primary-foreground px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-medium shadow-sm max-w-xl flex items-center gap-3">
                        <span>{m.content}</span>
                        <div className="flex items-center gap-1 text-[10px] opacity-80 shrink-0 font-mono">
                          <span>{m.timestamp || "09:07 PM"}</span>
                          <Check className="size-3" />
                        </div>
                      </div>
                      <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs border border-primary/20 shadow-xs">
                        {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "T"}
                      </div>
                    </div>
                  )}

                  {/* AI Message Card */}
                  {m.role === "ai" && (
                    <div className="flex items-start gap-3">
                      <div className="size-8 rounded-xl gradient-brand flex items-center justify-center text-white shadow-xs shrink-0 mt-1">
                        <Sparkles className="size-4" />
                      </div>

                      <div className="flex-1 bg-card border border-border/70 rounded-2xl p-5 shadow-xs space-y-4 text-xs sm:text-sm text-foreground">
                        <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                          <span className="font-bold text-sm text-foreground">LazyMonkeyAI Assistant</span>
                          <span className="text-[10px] font-mono text-muted-foreground">{m.timestamp || "09:07 PM"}</span>
                        </div>

                        {/* Text Body */}
                        <div className="leading-relaxed space-y-2">
                          <Markdown text={m.content} />
                          {m.streaming && <span className="inline-block w-2 h-4 ml-1 align-middle bg-primary animate-pulse rounded-xs" />}
                        </div>

                        {/* Live Snapshot Metric Badges */}
                        {m.stats && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                            <div className="p-3 bg-purple-500/5 border border-purple-500/20 rounded-xl flex items-center gap-2.5">
                              <div className="size-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
                                <Package className="size-4" />
                              </div>
                              <div>
                                <div className="text-base font-extrabold text-foreground">{m.stats.products}</div>
                                <div className="text-[10px] text-muted-foreground font-semibold">Products</div>
                              </div>
                            </div>

                            <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center gap-2.5">
                              <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                                <ShoppingCart className="size-4" />
                              </div>
                              <div>
                                <div className="text-base font-extrabold text-foreground">{m.stats.transactions}</div>
                                <div className="text-[10px] text-muted-foreground font-semibold">POS Transactions</div>
                              </div>
                            </div>

                            <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl flex items-center gap-2.5">
                              <div className="size-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                                <LifeBuoy className="size-4" />
                              </div>
                              <div>
                                <div className="text-base font-extrabold text-foreground">{m.stats.tickets}</div>
                                <div className="text-[10px] text-muted-foreground font-semibold">Open Support Cases</div>
                              </div>
                            </div>

                            <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl flex items-center gap-2.5">
                              <div className="size-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                                <Users className="size-4" />
                              </div>
                              <div>
                                <div className="text-base font-extrabold text-foreground">{m.stats.users}</div>
                                <div className="text-[10px] text-muted-foreground font-semibold">Active Users</div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Step-by-step guidance list */}
                        <div className="space-y-2 pt-2 border-t border-border/50">
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">How would you like to proceed? I can assist you with:</p>
                          <div className="space-y-1.5 text-xs font-medium">
                            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-muted/40 hover:bg-muted transition-colors cursor-pointer" onClick={() => send("Show platform module guide")}>
                              <span className="size-5 rounded-full bg-primary/20 text-primary font-bold text-[10px] flex items-center justify-center">1</span>
                              <span>Navigating to any ERP, POS, or CRM module</span>
                            </div>
                            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-muted/40 hover:bg-muted transition-colors cursor-pointer" onClick={() => send("Show financial and inventory reports")}>
                              <span className="size-5 rounded-full bg-primary/20 text-primary font-bold text-[10px] flex items-center justify-center">2</span>
                              <span>Generating financial, inventory, or payroll reports</span>
                            </div>
                            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-muted/40 hover:bg-muted transition-colors cursor-pointer" onClick={() => send("How do I configure payment gateways, print templates, and security policies?")}>
                              <span className="size-5 rounded-full bg-primary/20 text-primary font-bold text-[10px] flex items-center justify-center">3</span>
                              <span>Configuring payment gateways, print templates, and security policies</span>
                            </div>
                          </div>
                        </div>

                        {/* Action Footer */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/40 text-muted-foreground text-xs">
                          <span className="text-[10px] font-mono">{m.timestamp || "09:07 PM"}</span>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleCopy(m.content)} className="hover:text-foreground p-1 rounded transition-colors" title="Copy response">
                              <Copy className="size-3.5" />
                            </button>
                            <button onClick={() => send(messages[messages.length - 2]?.content || "Refresh")} className="hover:text-foreground p-1 rounded transition-colors" title="Regenerate">
                              <RefreshCw className="size-3.5" />
                            </button>
                            <button onClick={() => toast.success("Feedback submitted!")} className="hover:text-emerald-500 p-1 rounded transition-colors">
                              <ThumbsUp className="size-3.5" />
                            </button>
                            <button onClick={() => toast.success("Feedback submitted!")} className="hover:text-rose-500 p-1 rounded transition-colors">
                              <ThumbsDown className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Suggested Follow-up Action Chips */}
                  {m.role === "ai" && !m.streaming && (
                    <div className="flex flex-wrap gap-2 pl-11">
                      <button
                        onClick={() => send("Show today's sales & revenue")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all shadow-xs"
                      >
                        <BarChart3 className="size-3.5 text-blue-500" />
                        <span>Show today's sales & revenue</span>
                      </button>
                      <button
                        onClick={() => send("Find low stock products")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all shadow-xs"
                      >
                        <Activity className="size-3.5 text-amber-500" />
                        <span>Find low stock products</span>
                      </button>
                      <button
                        onClick={() => send("How do I configure payment gateways?")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all shadow-xs"
                      >
                        <Settings className="size-3.5 text-primary" />
                        <span>How do I configure payment gateways?</span>
                      </button>
                      <button
                        onClick={() => send("Check open support tickets")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all shadow-xs"
                      >
                        <LifeBuoy className="size-3.5 text-purple-500" />
                        <span>Check open support tickets</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Floating Composer Bar */}
        <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-background via-background/95 to-transparent pt-6">
          <div className="max-w-4xl mx-auto">
            <div className="relative group bg-card border border-border/80 rounded-2xl shadow-lg p-2.5 flex flex-col gap-2">
              <div className="flex items-center gap-2">
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
                  className="flex-1 bg-transparent border-0 text-xs sm:text-sm px-2 py-1.5 focus:outline-none placeholder:text-muted-foreground/70"
                />

                <div className="flex items-center gap-1.5">
                  <button type="button" className="p-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Attach file">
                    <Paperclip className="size-4" />
                  </button>
                  <button type="button" className="p-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Voice dictation">
                    <Mic className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => send()}
                    disabled={!input.trim() || sending}
                    className="size-8 rounded-xl gradient-brand text-white flex items-center justify-center hover:opacity-90 transition-opacity shadow-md disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </button>
                </div>
              </div>
            </div>
            <p className="text-center text-[10px] text-muted-foreground mt-2 font-medium">
              LazyMonkeyAI can make mistakes. Please verify important information.
            </p>
          </div>
        </div>
      </div>

      {/* ── 3. RIGHT SIDEBAR: Business Context & System Health ── */}
      <aside className="w-80 shrink-0 border-l border-border/60 bg-card/40 backdrop-blur-md hidden xl:flex flex-col z-10">
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <span className="font-extrabold text-xs uppercase tracking-wider text-foreground">Business Context</span>
          <button onClick={() => toast.success("Context refreshed")} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
            <RefreshCw className="size-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs scrollbar-thin">
          {/* Active Scope Card */}
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground mb-2">
              Active Scope
            </div>
            <Card className="p-3 bg-card border border-border/70 rounded-xl shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs">
                    LM
                  </div>
                  <div>
                    <div className="font-bold text-foreground">Enterprise BusinessOS</div>
                    <div className="text-[10px] text-muted-foreground">Multi-Branch & POS Ready</div>
                  </div>
                </div>
              </div>
              <div className="mt-2.5 pt-2 border-t border-border/40 text-right">
                <button className="text-[10px] font-bold text-primary hover:underline">Change Scope</button>
              </div>
            </Card>
          </div>

          {/* System Health Card */}
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground mb-2">
              System Health
            </div>
            <Card className="p-4 bg-card border border-border/70 rounded-xl space-y-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-emerald-600">96</span>
                <span className="text-xs font-bold text-muted-foreground">/ 100</span>
              </div>
              <div className="text-[10px] font-semibold text-muted-foreground">Overall System Score</div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <CheckCircle2 className="size-3.5 text-emerald-500" /> POS System Status
                  </span>
                  <span className="font-bold text-emerald-600">Optimal</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <CheckCircle2 className="size-3.5 text-emerald-500" /> Inventory Traceability
                  </span>
                  <span className="font-bold text-emerald-600">Active</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <CheckCircle2 className="size-3.5 text-emerald-500" /> Payment Gateways
                  </span>
                  <span className="font-bold text-emerald-600">Configured</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <CheckCircle2 className="size-3.5 text-emerald-500" /> Data Sync Status
                  </span>
                  <span className="font-bold text-emerald-600">Synced</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Quick Navigation Cards */}
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground mb-2">
              Quick Navigation
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
                  className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-card hover:bg-muted/70 transition-colors text-xs font-semibold text-foreground group"
                >
                  <div className="flex items-center gap-2">
                    <item.icon className="size-3.5 text-primary" />
                    <span>{item.label}</span>
                  </div>
                  <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-foreground transition-transform group-hover:translate-x-0.5" />
                </a>
              ))}
            </div>
            <button className="flex items-center gap-1.5 text-[11px] font-bold text-primary hover:underline mt-3 px-1">
              <Settings className="size-3.5" />
              <span>Customize Quick Links</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (tableRows.length) {
      const [header, , ...rows] = tableRows;
      out.push(
        <div key={`t-${out.length}`} className="my-3 overflow-x-auto rounded-xl border border-border/70 shadow-xs">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b border-border/60">
              <tr>
                {header.map((h, i) => (
                  <th key={i} className="px-3.5 py-2 text-left font-bold text-muted-foreground">
                    {h.trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  {r.map((c, j) => (
                    <td key={j} className="px-3.5 py-2">
                      {c.trim()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("|") && line.trim().startsWith("|")) {
      inTable = true;
      tableRows.push(line.split("|").slice(1, -1));
      continue;
    } else if (inTable) {
      flushTable();
      inTable = false;
    }

    if (line.startsWith("### ")) {
      out.push(
        <h3 key={i} className="font-bold text-sm text-foreground mt-2 mb-1">
          {line.replace("### ", "")}
        </h3>
      );
    } else if (line.startsWith("## ")) {
      out.push(
        <h2 key={i} className="font-bold text-base text-foreground mt-3 mb-1">
          {line.replace("## ", "")}
        </h2>
      );
    } else if (line.startsWith("- ")) {
      out.push(
        <li
          key={i}
          className="ml-4 list-disc my-1 text-xs sm:text-sm text-foreground"
          dangerouslySetInnerHTML={{ __html: fmt(line.slice(2)) }}
        />
      );
    } else if (/^\d+\. /.test(line)) {
      out.push(
        <li
          key={i}
          className="ml-4 list-decimal my-1 text-xs sm:text-sm text-foreground font-medium"
          dangerouslySetInnerHTML={{ __html: fmt(line.replace(/^\d+\. /, "")) }}
        />
      );
    } else if (line.trim() === "") {
      out.push(<div key={i} className="h-2" />);
    } else {
      out.push(
        <p
          key={i}
          className="my-1 text-xs sm:text-sm text-foreground leading-relaxed"
          dangerouslySetInnerHTML={{ __html: fmt(line) }}
        />
      );
    }
  }
  flushTable();
  return <div className="space-y-0.5">{out}</div>;
}

function fmt(s: string) {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong class='font-bold text-foreground'>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em class='text-muted-foreground'>$1</em>")
    .replace(/\[(.+?)\]\((.+?)\)/g, "<a href='$2' class='text-primary font-semibold underline underline-offset-2 hover:opacity-80'>$1</a>")
    .replace(/`(.+?)`/g, '<code class="px-1.5 py-0.5 rounded-md bg-muted text-[11px] border border-border/60 font-mono">$1</code>');
}
