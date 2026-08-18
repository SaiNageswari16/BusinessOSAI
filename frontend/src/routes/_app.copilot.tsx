import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, Send, Plus, MessageSquare, Trash2, Search, Mic, Paperclip,
  Activity, BarChart3, Settings, Users, Building2, Zap, Bookmark,
  ThumbsUp, ThumbsDown, Copy, RefreshCw, Share, ArrowRight, X, ChevronRight, CheckCircle2,
  ExternalLink, Layers, ArrowUpRight, Loader2
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

export const Route = createFileRoute("/_app/copilot")({
  component: LazyMonkeyAiPage,
});

interface Msg {
  id: string;
  role: "user" | "ai";
  content: string;
  streaming?: boolean;
  widget?: "sales" | "inventory" | "payroll" | null;
  direct_link?: string | null;
  suggested_actions?: string[];
}

const welcomeSuggestions = [
  { title: "Show today's sales & POS orders", icon: <BarChart3 className="size-4 text-blue-500" />, prompt: "Show today's sales and POS order count" },
  { title: "Find low stock products", icon: <Activity className="size-4 text-amber-500" />, prompt: "Which products are low in stock or require replenishment?" },
  { title: "How do I configure Payment Gateways?", icon: <Building2 className="size-4 text-green-500" />, prompt: "How do I configure Razorpay and Stripe payment gateways?" },
  { title: "Show payroll & employee summary", icon: <Users className="size-4 text-purple-500" />, prompt: "Show me employee count and payroll summary" },
];

function LazyMonkeyAiPage() {
  const { user } = useAuth();
  const { currency } = useCurrency();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Msg[]>(() => {
    const saved = localStorage.getItem("lazymonkey-copilot-history");
    if (saved) {
      try { return JSON.parse(saved); } catch { return []; }
    }
    return [];
  });

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem("lazymonkey-copilot-history", JSON.stringify(messages));
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setInput("");
    setSending(true);

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content };
    const aiId = crypto.randomUUID();

    // Prepare history payload for API
    const historyPayload = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));

    setMessages((m) => [...m, userMsg, { id: aiId, role: "ai", content: "", streaming: true }]);

    try {
      const res: CopilotChatResponse = await copilotApi.chat(content, historyPayload);
      const fullReply = res.reply || "I've analyzed your platform request.";

      // Smooth typing animation
      let i = 0;
      const step = Math.max(4, Math.round(fullReply.length / 50));
      const tick = () => {
        i += step;
        if (i < fullReply.length) {
          setMessages((m) =>
            m.map((msg) => msg.id === aiId ? { ...msg, content: fullReply.slice(0, i) } : msg)
          );
          setTimeout(tick, 20);
        } else {
          setMessages((m) =>
            m.map((msg) =>
              msg.id === aiId
                ? {
                    ...msg,
                    content: fullReply,
                    streaming: false,
                    widget: res.widget,
                    direct_link: res.direct_link,
                    suggested_actions: res.suggested_actions,
                  }
                : msg
            )
          );
          setSending(false);
        }
      };
      tick();
    } catch (err: any) {
      console.error("Copilot chat error:", err);
      const fallbackReply = `### 🐵 LazyMonkeyAI Assistant\n\nI processed your request regarding **"${content}"**.\n\nYour ERP environment is active. You can manage your business data using the navigation bar above or ask me about POS, inventory batches, purchase returns, or payment gateways.`;
      setMessages((m) =>
        m.map((msg) =>
          msg.id === aiId
            ? { ...msg, content: fallbackReply, streaming: false }
            : msg
        )
      );
      setSending(false);
    }
  };

  const handleClearHistory = () => {
    if (confirm("Start a new conversation with LazyMonkeyAI?")) {
      setMessages([]);
      localStorage.removeItem("lazymonkey-copilot-history");
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background overflow-hidden relative">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-primary/5 via-brand-purple/5 to-transparent pointer-events-none" />

      {/* Left Sidebar */}
      <aside className="hidden lg:flex w-72 shrink-0 flex-col border-r bg-background/60 backdrop-blur-xl z-10">
        <div className="p-4 border-b border-border/50">
          <Button
            onClick={handleClearHistory}
            className="w-full gradient-brand text-white border-0 shadow-elegant hover:opacity-90 gap-2 h-10 rounded-xl font-semibold"
          >
            <Plus className="size-4" /> New Conversation
          </Button>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              className="w-full h-9 pl-9 pr-3 text-xs rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 transition-shadow"
              placeholder="Search conversations..."
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
          {/* Quick Starters */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5 px-1">
              Popular Inquiries
            </div>
            <div className="space-y-1">
              {[
                "How to configure payment gateways",
                "Show today's sales & revenue",
                "How to create a purchase return",
                "Generate thermal print template",
                "Check open support tickets",
              ].map((c) => (
                <button
                  key={c}
                  onClick={() => send(c)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs hover:bg-muted/80 text-left group transition-colors"
                >
                  <MessageSquare className="size-3.5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                  <span className="truncate flex-1 font-medium">{c}</span>
                </button>
              ))}
            </div>
          </div>

          {/* AI Tools Shortcuts */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5 px-1">
              Platform Modules
            </div>
            <div className="space-y-1">
              <button
                onClick={() => send("Show today's sales")}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs hover:bg-muted/80 text-left group transition-colors"
              >
                <BarChart3 className="size-3.5 text-emerald-500 shrink-0" />
                <span className="truncate flex-1 font-medium">POS & Live Sales</span>
              </button>
              <button
                onClick={() => send("Find low stock products")}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs hover:bg-muted/80 text-left group transition-colors"
              >
                <Activity className="size-3.5 text-amber-500 shrink-0" />
                <span className="truncate flex-1 font-medium">Inventory & Warehouses</span>
              </button>
              <button
                onClick={() => send("How do I configure Payment Gateways?")}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs hover:bg-muted/80 text-left group transition-colors"
              >
                <Zap className="size-3.5 text-primary shrink-0" />
                <span className="truncate flex-1 font-medium">Payment Integrations</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Center Panel - Chat Stream */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Topbar */}
        <div className="px-6 py-4 border-b border-border/50 bg-background/80 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl gradient-brand grid place-items-center text-white shadow-elegant">
              <Sparkles className="size-5" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">LazyMonkeyAI</div>
              <div className="text-[10px] font-medium text-muted-foreground flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Enterprise AI Copilot & Assistant
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            className="lg:hidden"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {/* Scrollable Conversation Stream */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 pb-36">
          <div className="max-w-4xl mx-auto h-full flex flex-col">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500 pb-16">
                <div className="size-16 rounded-2xl gradient-brand grid place-items-center text-white shadow-2xl mb-6 relative">
                  <div className="absolute inset-0 bg-white/20 blur-xl rounded-full" />
                  <Sparkles className="size-8 relative z-10" />
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3 text-center text-foreground">
                  Hello, I'm LazyMonkeyAI.
                </h1>
                <p className="text-muted-foreground text-center max-w-lg mb-8 text-xs sm:text-sm leading-relaxed">
                  Your intelligent enterprise co-pilot. Ask me anything about your platform features, live inventory, sales, or workflow guides.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full max-w-2xl">
                  {welcomeSuggestions.map((s, i) => (
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      key={i}
                      onClick={() => send(s.prompt)}
                      className="p-4 rounded-2xl border border-border/80 bg-card hover:bg-muted/50 hover:border-primary/40 transition-all text-left group shadow-xs flex items-center gap-3.5 cursor-pointer"
                    >
                      <div className="size-9 rounded-xl bg-background border border-border/60 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                        {s.icon}
                      </div>
                      <span className="text-xs sm:text-sm font-semibold text-foreground">{s.title}</span>
                      <ArrowRight className="size-4 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6 pb-6">
                <AnimatePresence initial={false}>
                  {messages.map((m) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn("flex gap-3.5", m.role === "user" && "flex-row-reverse")}
                    >
                      <Avatar className="size-9 shrink-0 border shadow-xs">
                        <AvatarFallback
                          className={cn(
                            "text-xs font-semibold",
                            m.role === "ai" ? "gradient-brand text-white" : "bg-muted text-foreground"
                          )}
                        >
                          {m.role === "ai" ? <Sparkles className="size-4" /> : user?.avatar ?? "U"}
                        </AvatarFallback>
                      </Avatar>

                      <div className={cn("max-w-[88%] sm:max-w-[80%] flex flex-col gap-2", m.role === "user" && "items-end")}>
                        <div
                          className={cn(
                            "rounded-2xl px-5 py-4 text-xs sm:text-sm leading-relaxed shadow-xs",
                            m.role === "ai"
                              ? "bg-card border border-border/80 text-foreground"
                              : "bg-primary text-primary-foreground font-medium"
                          )}
                        >
                          <Markdown text={m.content} />
                          {m.streaming && (
                            <span className="inline-block w-2 h-4 ml-1 align-middle bg-primary animate-pulse rounded-xs" />
                          )}
                        </div>

                        {/* Interactive Widget Render */}
                        {m.role === "ai" && !m.streaming && m.widget && (
                          <div className="mt-1 w-full">
                            {m.widget === "sales" && (
                              <Card className="p-4 bg-blue-500/5 border-blue-500/20 rounded-2xl">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2.5">
                                    <div className="size-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                      <BarChart3 className="size-4 text-blue-600" />
                                    </div>
                                    <span className="font-bold text-xs sm:text-sm">Live POS Transactions Snapshot</span>
                                  </div>
                                  <a
                                    href="/pos?tab=transactions"
                                    className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1"
                                  >
                                    View Terminal <ArrowUpRight className="size-3" />
                                  </a>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="p-3 bg-background rounded-xl border border-border/60">
                                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Active Currency</div>
                                    <div className="text-base font-bold">{currency.code} ({currency.symbol})</div>
                                  </div>
                                  <div className="p-3 bg-background rounded-xl border border-border/60">
                                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">POS Checkout</div>
                                    <div className="text-base font-bold text-emerald-600">Online & Active</div>
                                  </div>
                                </div>
                              </Card>
                            )}

                            {m.widget === "inventory" && (
                              <Card className="p-4 bg-amber-500/5 border-amber-500/20 rounded-2xl">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2.5">
                                    <div className="size-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                                      <Activity className="size-4 text-amber-600" />
                                    </div>
                                    <span className="font-bold text-xs sm:text-sm">Warehouse Stock Alerts</span>
                                  </div>
                                  <a
                                    href="/inventory?tab=stock_overview"
                                    className="text-xs text-amber-600 font-semibold hover:underline flex items-center gap-1"
                                  >
                                    Inventory View <ArrowUpRight className="size-3" />
                                  </a>
                                </div>
                                <p className="text-xs text-muted-foreground mb-2">
                                  Batches and minimum reorder thresholds are actively monitored.
                                </p>
                              </Card>
                            )}
                          </div>
                        )}

                        {/* Direct Deep-link Button */}
                        {m.role === "ai" && !m.streaming && m.direct_link && (
                          <div className="mt-1">
                            <a
                              href={m.direct_link}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all shadow-xs"
                            >
                              <span>Open Module Page</span>
                              <ExternalLink className="size-3" />
                            </a>
                          </div>
                        )}

                        {/* Action buttons footer */}
                        {m.role === "ai" && !m.streaming && (
                          <div className="flex items-center gap-2 mt-1 px-1">
                            <span className="text-[10px] text-muted-foreground">
                              {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleCopy(m.content)}
                                className="size-6 text-muted-foreground hover:text-foreground"
                                title="Copy response"
                              >
                                <Copy className="size-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => send(messages[messages.length - 2]?.content || "Refresh")}
                                className="size-6 text-muted-foreground hover:text-foreground"
                                title="Regenerate"
                              >
                                <RefreshCw className="size-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toast.success("Feedback submitted!")}
                                className="size-6 text-muted-foreground hover:text-emerald-500"
                              >
                                <ThumbsUp className="size-3" />
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Suggested Follow-ups */}
                        {m.role === "ai" && !m.streaming && m.suggested_actions && m.suggested_actions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {m.suggested_actions.map((act) => (
                              <button
                                key={act}
                                onClick={() => send(act)}
                                className="text-[11px] font-medium px-3 py-1 rounded-full border border-border bg-card hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                              >
                                {act}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Composer Input Bar */}
        <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-background via-background to-transparent pt-8">
          <div className="max-w-4xl mx-auto relative">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-brand-purple/30 rounded-2xl blur opacity-30 group-focus-within:opacity-100 transition duration-500" />
              <Card className="relative p-2 rounded-2xl border-border bg-card/90 backdrop-blur-xl shadow-lg">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Ask LazyMonkeyAI to analyze data, explain workflows, or manage ERP..."
                  rows={1}
                  className="border-0 shadow-none focus-visible:ring-0 resize-none min-h-[50px] max-h-36 text-xs sm:text-sm bg-transparent py-2.5"
                />
                <div className="flex items-center justify-between px-2 pb-1 pt-1.5 border-t border-border/50">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Sparkles className="size-3.5 text-primary" />
                    <span className="text-[11px] font-medium">Powered by LazyMonkeyAI</span>
                  </div>
                  <Button
                    onClick={() => send()}
                    disabled={!input.trim() || sending}
                    size="sm"
                    className="gradient-brand text-white border-0 hover:opacity-90 gap-1.5 rounded-xl px-4 shadow-elegant font-semibold h-8 text-xs"
                  >
                    {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Send
                  </Button>
                </div>
              </Card>
            </div>
            <div className="text-center mt-2 text-[10px] text-muted-foreground">
              LazyMonkeyAI provides enterprise operational intelligence across your entire BusinessOS environment.
            </div>
          </div>
        </div>
      </div>

      {/* Right Context Panel */}
      <AnimatePresence>
        {rightPanelOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-l border-border/60 bg-background/60 backdrop-blur-xl shrink-0 flex flex-col z-10 overflow-hidden"
          >
            <div className="p-4 border-b border-border/50 flex justify-between items-center bg-card/50">
              <span className="font-bold text-xs uppercase tracking-wider text-foreground">Business Context</span>
              <Button variant="ghost" size="icon" onClick={() => setRightPanelOpen(false)} className="size-7">
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs scrollbar-thin">
              {/* Tenant Context */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Active Scope
                </div>
                <Card className="p-3 bg-card border border-border/70 rounded-xl shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      LM
                    </div>
                    <div>
                      <div className="font-bold text-foreground">Enterprise BusinessOS</div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Building2 className="size-3" /> Multi-Branch & POS Ready
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Health Score */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  System Intelligence Health
                </div>
                <Card className="p-4 bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20 rounded-xl">
                  <div className="flex items-end gap-1.5 mb-2">
                    <span className="text-3xl font-black text-emerald-600">96</span>
                    <span className="text-xs font-semibold text-emerald-600 mb-1">/ 100</span>
                  </div>
                  <div className="space-y-1.5 mt-3 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">POS System Status</span>
                      <span className="font-semibold text-emerald-600">Optimal</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Inventory Traceability</span>
                      <span className="font-semibold text-foreground">Active</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payment Gateways</span>
                      <span className="font-semibold text-foreground">Configured</span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Quick Navigation Shortcuts */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Quick Navigation
                </div>
                <div className="space-y-1.5">
                  {[
                    { label: "POS Cashier Terminal", url: "/pos" },
                    { label: "Payment Gateways", url: "/settings?tab=payment_gateways" },
                    { label: "Support Tickets (CRM)", url: "/crm?tab=support_tickets" },
                    { label: "Inventory Stock Overview", url: "/inventory?tab=stock_overview" },
                  ].map((s) => (
                    <a
                      key={s.label}
                      href={s.url}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-card hover:bg-muted/60 transition-colors text-[11px] font-semibold text-foreground"
                    >
                      <span>{s.label}</span>
                      <ArrowUpRight className="size-3.5 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

// Markdown Formatter
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
          className="my-1 text-xs sm:text-sm text-foreground"
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
