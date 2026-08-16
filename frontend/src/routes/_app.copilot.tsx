import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, Send, Plus, MessageSquare, Trash2, Search, Mic, Paperclip,
  Activity, BarChart3, Settings, Users, Building2, Zap, Bookmark,
  ThumbsUp, ThumbsDown, Copy, RefreshCw, Share, ArrowRight, X, ChevronRight, CheckCircle2
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  suggestedPrompts, aiResponses, companies, branches, healthBreakdown, aiInsights
} from "@/data/mock";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";

export const Route = createFileRoute("/_app/copilot")({
  component: AntigravityPage,
});

interface Msg {
  id: string;
  role: "user" | "ai";
  content: string;
  streaming?: boolean;
  widget?: "sales" | "inventory" | "payroll";
}

const welcomeSuggestions = [
  { title: "Show today's sales", icon: <BarChart3 className="size-4 text-blue-500" /> },
  { title: "Find low stock products", icon: <Activity className="size-4 text-amber-500" /> },
  { title: "Generate purchase order", icon: <Building2 className="size-4 text-green-500" /> },
  { title: "Show payroll summary", icon: <Users className="size-4 text-purple-500" /> },
];

function pickResponse(q: string): { content: string, widget?: "sales" | "inventory" | "payroll" } {
  const lower = q.toLowerCase();
  for (const key of Object.keys(aiResponses)) {
    if (lower.includes(key)) {
      let widget: "sales" | "inventory" | "payroll" | undefined;
      if (key === "today's sales") widget = "sales";
      if (key === "low stock") widget = "inventory";
      if (key === "payroll") widget = "payroll";
      return { content: aiResponses[key], widget };
    }
  }
  return { content: `Here's what I found for **"${q}"**:\n\nI cross-referenced your sales, inventory, finance and HR systems. The data points to a healthy operational picture with **3 areas worth a closer look**:\n\n1. Inventory velocity on top-10 SKUs is +18% week over week\n2. CSAT is holding at 4.7 / 5 across all channels\n3. Two vendor invoices need approval before Friday\n\nWant me to dig into any of these, or draft an action plan?` };
}

function AntigravityPage() {
  const { user } = useAuth();
  const { currency } = useCurrency();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setInput("");
    setSending(true);
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content };
    const aiId = crypto.randomUUID();
    setMessages((m) => [...m, userMsg, { id: aiId, role: "ai", content: "", streaming: true }]);

    const responseData = pickResponse(content);
    const full = responseData.content;
    let i = 0;
    const tick = () => {
      i += Math.max(3, Math.round(full.length / 80));
      setMessages((m) =>
        m.map((msg) => msg.id === aiId ? { ...msg, content: full.slice(0, i) } : msg)
      );
      if (i < full.length) {
        setTimeout(tick, 25);
      } else {
        setMessages((m) => m.map((msg) => msg.id === aiId ? { ...msg, streaming: false, widget: responseData.widget } : msg));
        setSending(false);
      }
    };
    setTimeout(tick, 400);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background overflow-hidden relative">
      {/* Background Effects */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

      {/* Left Sidebar */}
      <aside className="hidden lg:flex w-72 shrink-0 flex-col border-r bg-background/50 backdrop-blur-xl z-10">
        <div className="p-4 border-b border-border/50">
          <Button onClick={() => setMessages([])} className="w-full gradient-brand text-white border-0 shadow-elegant hover:opacity-90 gap-2 h-10 rounded-xl">
            <Plus className="size-4" /> New Conversation
          </Button>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border bg-card focus:ring-2 focus:ring-primary/20 transition-shadow" placeholder="Smart Enterprise Search" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
          {/* History */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">Conversation History</div>
            <div className="space-y-1">
              {["Q2 board pack draft", "Vendor renegotiation strategy", "Stockout risk analysis"].map((c) => (
                <button key={c} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs hover:bg-muted/80 text-left group transition-colors">
                  <MessageSquare className="size-3.5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                  <span className="truncate flex-1 font-medium">{c}</span>
                </button>
              ))}
            </div>
          </div>

          {/* AI Automations & Reports */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">AI Tools</div>
            <div className="space-y-1">
              <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs hover:bg-muted/80 text-left group transition-colors">
                <Zap className="size-3.5 text-amber-500 shrink-0" />
                <span className="truncate flex-1 font-medium">AI Automations</span>
              </button>
              <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs hover:bg-muted/80 text-left group transition-colors">
                <Bookmark className="size-3.5 text-blue-500 shrink-0" />
                <span className="truncate flex-1 font-medium">Favorite Prompts</span>
              </button>
              <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs hover:bg-muted/80 text-left group transition-colors">
                <BarChart3 className="size-3.5 text-emerald-500 shrink-0" />
                <span className="truncate flex-1 font-medium">Saved Reports</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Center Panel - Conversation */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Topbar inside Center */}
        <div className="px-6 py-4 border-b border-border/50 bg-background/80 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl gradient-brand grid place-items-center text-white shadow-elegant">
              <Sparkles className="size-5" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">Antigravity</div>
              <div className="text-[10px] font-medium text-muted-foreground flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Enterprise AI Operating System
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setRightPanelOpen(!rightPanelOpen)} className="lg:hidden">
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {/* Scrollable Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 pb-32">
          <div className="max-w-4xl mx-auto h-full flex flex-col">
            
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500 pb-20">
                <div className="size-16 rounded-2xl gradient-brand grid place-items-center text-white shadow-2xl mb-6 relative">
                  <div className="absolute inset-0 bg-white/20 blur-xl rounded-full" />
                  <Sparkles className="size-8 relative z-10" />
                </div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 text-center">Hello, I'm Antigravity.</h1>
                <p className="text-muted-foreground text-center max-w-lg mb-10 text-sm md:text-base">
                  I analyze your entire business and help you make better decisions. How can I assist you today?
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
                  {welcomeSuggestions.map((s, i) => (
                    <motion.button
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                      key={i} onClick={() => send(s.title)}
                      className="p-4 rounded-xl border bg-card hover:bg-muted/50 hover:border-primary/40 transition-all text-left group shadow-sm flex items-center gap-3"
                    >
                      <div className="size-8 rounded-lg bg-background border flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform">
                        {s.icon}
                      </div>
                      <span className="text-sm font-semibold">{s.title}</span>
                      <ArrowRight className="size-4 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-8 pb-10">
                <AnimatePresence initial={false}>
                  {messages.map((m) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn("flex gap-4", m.role === "user" && "flex-row-reverse")}
                    >
                      <Avatar className="size-10 shrink-0 border shadow-sm">
                        <AvatarFallback className={cn("text-xs font-semibold", m.role === "ai" ? "gradient-brand text-white" : "bg-muted")}>
                          {m.role === "ai" ? <Sparkles className="size-5" /> : user?.avatar ?? "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className={cn("max-w-[85%] flex flex-col gap-2", m.role === "user" && "items-end")}>
                        <div className={cn(
                          "rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-sm",
                          m.role === "ai" ? "bg-card border" : "bg-primary text-primary-foreground",
                        )}>
                          <Markdown text={m.content} />
                          {m.streaming && <span className="inline-block w-2 h-4 ml-1 align-middle bg-primary animate-pulse rounded-sm" />}
                        </div>
                        
                        {/* Interactive Widget Render */}
                        {m.role === "ai" && !m.streaming && m.widget && (
                          <div className="mt-2 w-full">
                            {m.widget === "sales" && (
                              <Card className="p-4 bg-blue-500/5 border-blue-500/20">
                                <div className="flex items-center gap-3 mb-3">
                                  <div className="size-8 rounded-lg bg-blue-500/20 flex items-center justify-center"><BarChart3 className="size-4 text-blue-600" /></div>
                                  <span className="font-bold text-sm">Interactive Sales Report</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="p-3 bg-background rounded-lg border"><div className="text-xs text-muted-foreground mb-1">Gross Revenue</div><div className="text-lg font-bold">{currency.symbol}184,210</div></div>
                                  <div className="p-3 bg-background rounded-lg border"><div className="text-xs text-muted-foreground mb-1">Total Orders</div><div className="text-lg font-bold">412</div></div>
                                </div>
                              </Card>
                            )}
                            {m.widget === "inventory" && (
                              <Card className="p-4 bg-amber-500/5 border-amber-500/20">
                                <div className="flex items-center gap-3 mb-3">
                                  <div className="size-8 rounded-lg bg-amber-500/20 flex items-center justify-center"><Activity className="size-4 text-amber-600" /></div>
                                  <span className="font-bold text-sm">Critical Inventory Alert</span>
                                </div>
                                <div className="space-y-2">
                                  {["Steel Rivets (2 days left)", "Aurora Headphones (3 days left)"].map((item, i) => (
                                    <div key={i} className="flex justify-between items-center p-2 bg-background border rounded-md text-xs font-medium">
                                      <span>{item}</span>
                                      <Button size="sm" variant="outline" className="h-6 text-[10px]">Draft PO</Button>
                                    </div>
                                  ))}
                                </div>
                              </Card>
                            )}
                            {m.widget === "payroll" && (
                              <Card className="p-4 bg-purple-500/5 border-purple-500/20">
                                <div className="flex items-center gap-3 mb-3">
                                  <div className="size-8 rounded-lg bg-purple-500/20 flex items-center justify-center"><Users className="size-4 text-purple-600" /></div>
                                  <span className="font-bold text-sm">June Payroll Summary</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="p-3 bg-background rounded-lg border"><div className="text-xs text-muted-foreground mb-1">Gross Payroll</div><div className="text-lg font-bold">{currency.symbol}2.41M</div></div>
                                  <div className="p-3 bg-background rounded-lg border"><div className="text-xs text-muted-foreground mb-1">Employees</div><div className="text-lg font-bold">348</div></div>
                                </div>
                                <Button className="w-full mt-3 h-8 text-xs gradient-brand text-white border-0 shadow-elegant hover:opacity-90">Approve Payroll Batch</Button>
                              </Card>
                            )}
                          </div>
                        )}

                        {m.role === "ai" && !m.streaming && (
                          <div className="flex items-center gap-3 mt-1 px-1">
                            <span className="text-[10px] text-muted-foreground">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground"><Copy className="size-3" /></Button>
                              <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground"><RefreshCw className="size-3" /></Button>
                              <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-green-500"><ThumbsUp className="size-3" /></Button>
                              <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-red-500"><ThumbsDown className="size-3" /></Button>
                              <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground"><Share className="size-3" /></Button>
                            </div>
                          </div>
                        )}
                        
                        {/* Suggested Follow-ups */}
                        {m.role === "ai" && !m.streaming && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            <button onClick={() => send("Show branch comparison")} className="text-[11px] font-medium px-3 py-1.5 rounded-full border bg-card hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">Show branch comparison</button>
                            <button onClick={() => send("Generate purchase order")} className="text-[11px] font-medium px-3 py-1.5 rounded-full border bg-card hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">Generate purchase order</button>
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

        {/* Composer - Fixed at bottom */}
        <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-background via-background to-transparent pt-10">
          <div className="max-w-4xl mx-auto relative">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-brand-purple/30 rounded-2xl blur opacity-30 group-focus-within:opacity-100 transition duration-500" />
              <Card className="relative p-2 rounded-2xl border-border bg-card/80 backdrop-blur-xl">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Ask Antigravity to analyze data, generate reports, or trigger automations..."
                  rows={1}
                  className="border-0 shadow-none focus-visible:ring-0 resize-none min-h-[52px] max-h-40 text-sm bg-transparent py-3"
                />
                <div className="flex items-center justify-between px-2 pb-1 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:text-foreground"><Paperclip className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:text-foreground"><Mic className="size-4" /></Button>
                  </div>
                  <Button onClick={() => send()} disabled={!input.trim() || sending} size="sm" className="gradient-brand text-white border-0 hover:opacity-90 gap-1.5 rounded-lg px-4 shadow-elegant">
                    <Send className="size-3.5" /> Send
                  </Button>
                </div>
              </Card>
            </div>
            <div className="text-center mt-3 text-[10px] text-muted-foreground">
              Antigravity may produce inaccurate information about people, places, or facts.
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Context & Knowledge */}
      <AnimatePresence>
        {rightPanelOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-l bg-background/50 backdrop-blur-xl shrink-0 flex flex-col z-10 overflow-hidden"
          >
            <div className="p-4 border-b border-border/50 flex justify-between items-center bg-card/50">
              <span className="font-bold text-sm tracking-tight">Business Context</span>
              <Button variant="ghost" size="icon" onClick={() => setRightPanelOpen(false)} className="size-7">
                <X className="size-4" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin">
              {/* Current Context */}
              <div className="space-y-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Active Scope</div>
                <Card className="p-3 bg-card border shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">NR</div>
                    <div>
                      <div className="text-sm font-bold">Nimbus Retail Group</div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Building2 className="size-3" /> All Branches</div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Health Score */}
              <div className="space-y-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Business Health</div>
                <Card className="p-4 bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20">
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-3xl font-black text-emerald-600">92</span>
                    <span className="text-xs font-semibold text-emerald-600 mb-1">/ 100</span>
                  </div>
                  <div className="space-y-1.5 mt-4">
                    {healthBreakdown.slice(0, 3).map(h => (
                      <div key={h.label} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{h.label}</span>
                        <span className="font-semibold">{h.score}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Pending Actions */}
              <div className="space-y-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pending Recommendations</div>
                <div className="space-y-2">
                  {aiInsights.slice(0, 2).map(r => (
                    <Card key={r.id} className="p-3 bg-card border text-sm group hover:border-primary/50 transition-colors cursor-pointer">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="size-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-xs leading-snug">{r.title}</div>
                          <div className="text-[10px] text-muted-foreground mt-1">{r.impact}</div>
                        </div>
                      </div>
                    </Card>
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

// Tiny markdown renderer
function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (tableRows.length) {
      const [header, , ...rows] = tableRows;
      out.push(
        <div key={`t-${out.length}`} className="my-3 overflow-x-auto rounded-xl border shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>{header.map((h, i) => <th key={i} className="px-4 py-2.5 text-left font-semibold text-muted-foreground">{h.trim()}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">{r.map((c, j) => <td key={j} className="px-4 py-2.5">{c.trim()}</td>)}</tr>
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
    if (line.startsWith("- ")) {
      out.push(<li key={i} className="ml-5 list-disc my-1" dangerouslySetInnerHTML={{ __html: fmt(line.slice(2)) }} />);
    } else if (/^\d+\. /.test(line)) {
      out.push(<li key={i} className="ml-5 list-decimal my-1 font-medium" dangerouslySetInnerHTML={{ __html: fmt(line.replace(/^\d+\. /, "")) }} />);
    } else if (line.trim() === "") {
      out.push(<div key={i} className="h-3" />);
    } else {
      out.push(<p key={i} className="my-1.5" dangerouslySetInnerHTML={{ __html: fmt(line) }} />);
    }
  }
  flushTable();
  return <div className="space-y-1">{out}</div>;
}

function fmt(s: string) {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong class='font-bold text-foreground'>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em class='text-muted-foreground'>$1</em>")
    .replace(/`(.+?)`/g, '<code class="px-1.5 py-0.5 rounded-md bg-muted text-[12px] border font-mono">$1</code>');
}
