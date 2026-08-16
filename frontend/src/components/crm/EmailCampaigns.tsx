import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Send, Eye, MousePointer, Users, Mail, Play, Pause, 
  MoreHorizontal, Search, Filter, Sparkles, X, Loader2, Copy,
  CheckCircle, FileText, Inbox, ChevronRight, RefreshCw, Star
} from "lucide-react";
import { cn } from "@/lib/utils";
import { crmCampaignsApi, EmailCampaign, EmailTemplate } from "@/lib/api-client";
import { toast } from "sonner";
import { format } from "date-fns";
import { useCurrency } from "@/hooks/use-currency";

// Standard pre-designed system templates
const standardTemplates = [
  { 
    id: "ST-01",
    name: "Monsoon Promotional Offer", 
    subject: "🌧️ Monsoon Sale Alert: Flat 20% Off Everything!", 
    body_html: `<h1>Monsoon Super Savings!</h1>
<p>Dear Valued Partner,</p>
<p>Beat the rains with our exclusive monsoon discount! Get <strong>20% off</strong> all product categories using the coupon code <strong>RAIN20</strong> at checkout.</p>
<p>This is a limited-time offer valid until the end of the month. Don't miss out on these premium savings!</p>
<hr/>
<p>Best regards,<br/>Sales & Marketing Team<br/>LazyMonkeyAI</p>`,
    preview: "Bold layout for monsoon sales and customer discount offers" 
  },
  { 
    id: "ST-02",
    name: "Corporate Update & Newsletter", 
    subject: "LazyMonkeyAI Newsletter: Q3 Milestones & Feature Updates 🚀", 
    body_html: `<h1>Q3 Corporate Update</h1>
<p>Hello Team,</p>
<p>We are excited to share key updates on our corporate milestones and newest integrations (including our real-time Zoho Recruit integration!).</p>
<ul>
  <li>New real-time email dispatch pipeline</li>
  <li>Automatic PDF template compiling and direct printing</li>
  <li>AI-enhanced copywriting assistant</li>
</ul>
<p>Read the full blog post to learn more about how we are scaling our AI systems this quarter.</p>
<hr/>
<p>Sincerely,<br/>Phani Kumar<br/>Director, Engineering</p>`,
    preview: "Clean, professional newsletter layout with bullet updates" 
  },
  { 
    id: "ST-03",
    name: "Candidate Welcome Letter", 
    subject: "Welcome to LazyMonkeyAI Recruitment: Let's build together! 💼", 
    body_html: `<h1>Welcome to our Talent Network!</h1>
<p>Dear Candidate,</p>
<p>Thank you for submitting your application to join our engineering and delivery team. We have received your resume and are currently matching it against our active roles.</p>
<p>You can track the status of your application directly on our careers portal. Our recruitment managers will reach out to you within 3 business days.</p>
<hr/>
<p>Warm regards,<br/>HR & Talent Acquisition<br/>LazyMonkeyAI</p>`,
    preview: "Simple, welcoming format for candidate applications onboarding" 
  }
];

export function EmailCampaigns() {
    const { currency, formatCurrency } = useCurrency();
  const [activeTab, setActiveTab] = useState<"campaigns" | "templates">("campaigns");
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [customTemplates, setCustomTemplates] = useState<EmailTemplate[]>([]);

  // Wizard Compose Modal states
  const [showCompose, setShowCompose] = useState(false);
  const [composeStep, setComposeStep] = useState<"compose" | "preview">("compose");
  const [campaignName, setCampaignName] = useState("");
  const [subjectLine, setSubjectLine] = useState("");
  const [targetCategory, setTargetCategory] = useState("employees"); // employees|candidates|customers|others
  const [bodyHtml, setBodyHtml] = useState("");
  const [sendingCampaign, setSendingCampaign] = useState(false);

  // Template Modal
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  // AI Writer Modal states
  const [showAiWriter, setShowAiWriter] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  // Fetch campaigns and custom templates on mount
  const loadData = async () => {
    setLoading(true);
    try {
      const c = await crmCampaignsApi.listEmailCampaigns();
      const t = await crmCampaignsApi.listEmailTemplates();
      setCampaigns(c);
      setCustomTemplates(t);
    } catch {
      toast.error("Failed to load campaigns or templates from backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApplyTemplate = (tpl: { subject?: string | null; body_html: string }) => {
    setSubjectLine(tpl.subject || "");
    setBodyHtml(tpl.body_html);
    toast.success("Template applied to composer!");
  };

  const handleSaveAsTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName || !bodyHtml) return;
    setSavingTemplate(true);
    try {
      const tpl = await crmCampaignsApi.createEmailTemplate({
        name: templateName,
        subject: subjectLine,
        body_html: bodyHtml
      });
      setCustomTemplates([tpl, ...customTemplates]);
      setShowSaveTemplate(false);
      setTemplateName("");
      toast.success(`Template "${tpl.name}" saved for future uses.`);
    } catch {
      toast.error("Failed to save template.");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSendCampaign = async () => {
    if (!campaignName || !subjectLine || !bodyHtml) {
      toast.error("Please fill in the Campaign Name, Subject, and Email Body.");
      return;
    }
    setSendingCampaign(true);
    try {
      // 1. Create campaign draft
      const draft = await crmCampaignsApi.createEmailCampaign({
        name: campaignName,
        subject: subjectLine,
        body_html: bodyHtml,
        target_category: targetCategory
      });

      // 2. Trigger async SMTP send
      toast.info(`Draft created. Triggering dispatch to ${targetCategory}...`);
      const sent = await crmCampaignsApi.sendEmailCampaign(draft.id);
      
      // Update locally
      setCampaigns([sent, ...campaigns.filter(c => c.id !== sent.id)]);
      setShowCompose(false);
      resetComposer();
      toast.success(`Campaign "${sent.name}" dispatched successfully to ${sent.recipient_count} recipients!`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to dispatch email campaign.");
    } finally {
      setSendingCampaign(false);
    }
  };

  const resetComposer = () => {
    setCampaignName("");
    setSubjectLine("");
    setBodyHtml("");
    setTargetCategory("employees");
    setComposeStep("compose");
  };

  // AI Writer Copy Integration
  const handleGenerateCopy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt) return;
    setGenerating(true);
    try {
      const res = await crmCampaignsApi.generateCopy({ prompt, channel: "Email" });
      setBodyHtml(res.copy);
      setShowAiWriter(false);
      setPrompt("");
      toast.success("AI draft added to editor!");
    } catch {
      toast.error("Failed to generate copy");
    } finally {
      setGenerating(false);
    }
  };

  const totals = campaigns.reduce((acc, c) => {
    if (c.status === "Sent") {
      acc.sent += c.recipient_count;
    }
    return acc;
  }, { sent: 0 });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Mail className="size-6 text-primary" /> Email Campaigns
          </h1>
          <p className="text-sm text-muted-foreground">Design, compose, and send rich email campaigns to employees, candidates, and customers.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={() => loadData()}
            className="p-2 border hover:bg-accent rounded-lg text-muted-foreground transition-colors cursor-pointer bg-card"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </button>
          <button 
            onClick={() => setShowAiWriter(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 border hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 dark:text-indigo-400 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            <Sparkles className="size-4 animate-pulse text-indigo-500" />
            AI Writer
          </button>
          <button 
            onClick={() => { resetComposer(); setShowCompose(true); }}
            className="flex items-center justify-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Plus className="size-4" /> Compose Campaign
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Sent Campaign Mails", value: totals.sent.toLocaleString(), icon: Send, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Avg Open Rate", value: "38.5%", icon: Eye, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Avg Click Rate", value: "14.2%", icon: MousePointer, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Active Campaigns", value: campaigns.length.toString(), icon: Inbox, color: "text-purple-500", bg: "bg-purple-500/10" },
        ].map((stat, i) => (
          <div key={i} className="glass-panel p-5 rounded-xl border border-border/50 flex items-center gap-4 bg-card">
            <div className={`p-3 rounded-xl ${stat.bg} shrink-0`}>
              <stat.icon className={`size-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              <h3 className="text-xl font-bold text-foreground mt-0.5">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border/50">
        {(["campaigns", "templates"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors bg-transparent border-none cursor-pointer",
              activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === "campaigns" ? "All Campaigns Logs" : "Email Templates Gallery"}
          </button>
        ))}
      </div>

      {/* Campaigns Logs List */}
      {activeTab === "campaigns" && (
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden bg-card">
          <div className="overflow-x-auto">
            {campaigns.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground space-y-2">
                <Inbox className="size-8 mx-auto text-muted-foreground/50" />
                <p className="text-sm font-medium">No campaign dispatches recorded yet.</p>
                <p className="text-xs">Click Compose Campaign to send your first marketing email.</p>
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border/50">
                  <tr>
                    <th className="px-6 py-4">Campaign Details</th>
                    <th className="px-6 py-4">Subject</th>
                    <th className="px-6 py-4">Recipients Group</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Recipients Count</th>
                    <th className="px-6 py-4 text-right">Sent Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {campaigns.map((c, i) => (
                    <tr key={c.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <FileText className="size-4 text-primary/70" />
                          {c.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground max-w-xs truncate">{c.subject}</td>
                      <td className="px-6 py-4 capitalize font-medium">{c.target_category}</td>
                      <td className="px-6 py-4">
                        <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-fit",
                          c.status === "Sent" ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-500/10 text-slate-600"
                        )}>
                          <div className="size-1.5 rounded-full bg-current" />
                          {c.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium">{c.recipient_count}</td>
                      <td className="px-6 py-4 text-right text-xs text-muted-foreground">
                        {c.sent_at ? format(new Date(c.sent_at), "MMM d, h:mm a") : "Draft"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Templates List */}
      {activeTab === "templates" && (
        <div className="space-y-6">
          {/* Standard Templates */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">System Pre-designed Templates</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {standardTemplates.map((tpl) => (
                <div key={tpl.id} className="glass-panel rounded-xl border border-border/50 overflow-hidden hover:border-primary/20 transition-all p-5 bg-card flex flex-col justify-between">
                  <div>
                    <h4 className="font-semibold text-foreground flex items-center gap-2"><Star className="size-4 text-amber-500 shrink-0" /> {tpl.name}</h4>
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{tpl.preview}</p>
                  </div>
                  <button 
                    onClick={() => { resetComposer(); handleApplyTemplate(tpl); setShowCompose(true); }}
                    className="w-full mt-4 py-2 bg-background border hover:bg-accent transition-colors rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Compose with Template
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Saved Templates */}
          {customTemplates.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Your Saved Custom Templates</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {customTemplates.map((tpl) => (
                  <div key={tpl.id} className="glass-panel rounded-xl border border-border/50 overflow-hidden hover:border-primary/20 transition-all p-5 bg-card flex flex-col justify-between">
                    <div>
                      <h4 className="font-semibold text-foreground">{tpl.name}</h4>
                      <p className="text-xs text-muted-foreground mt-2 truncate">Subject: {tpl.subject || "No default subject"}</p>
                    </div>
                    <button 
                      onClick={() => { resetComposer(); handleApplyTemplate(tpl); setShowCompose(true); }}
                      className="w-full mt-4 py-2 bg-background border hover:bg-accent transition-colors rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Compose with Template
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Google Mail Style Composer Modal */}
      <AnimatePresence>
        {showCompose && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-card border border-border/60 rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-4 bg-muted border-b flex justify-between items-center bg-gradient-to-r from-primary/10 to-indigo-500/10">
                <div className="flex items-center gap-2 text-foreground font-bold">
                  <Mail className="size-4 text-primary" /> New Email Campaign Composer
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setComposeStep(composeStep === "compose" ? "preview" : "compose")}
                    className="text-xs font-semibold text-primary hover:underline bg-transparent border-none cursor-pointer"
                  >
                    {composeStep === "compose" ? "Preview Output" : "Back to Editor"}
                  </button>
                  <button onClick={() => setShowCompose(false)} className="text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer">
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              {composeStep === "compose" ? (
                /* COMPOSE STEP */
                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Campaign Name</label>
                      <input 
                        type="text" 
                        required
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        placeholder="e.g. Q3 Hiring Drive Notice"
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Recipient Category</label>
                      <select
                        value={targetCategory}
                        onChange={(e) => setTargetCategory(e.target.value)}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                      >
                        <option value="employees">All Active Employees (Database)</option>
                        <option value="candidates">New Candidates & Applicants</option>
                        <option value="customers">CRM Customers / Contacts</option>
                        <option value="others">Sandbox (test-recipient@businessos.ai)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Email Subject Line</label>
                    <input 
                      type="text" 
                      required
                      value={subjectLine}
                      onChange={(e) => setSubjectLine(e.target.value)}
                      placeholder="Enter subject header..."
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* HTML Edit Textbox */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-semibold text-muted-foreground">Email Body (HTML / Rich Text format)</label>
                      <button 
                        onClick={() => setShowSaveTemplate(true)}
                        className="text-[11px] text-primary hover:underline bg-transparent border-none cursor-pointer"
                      >
                        Save Current Body as Template
                      </button>
                    </div>
                    <textarea 
                      required
                      rows={10}
                      value={bodyHtml}
                      onChange={(e) => setBodyHtml(e.target.value)}
                      placeholder="<h1>Hello!</h1> <p>Write your mail text here in HTML tags...</p>"
                      className="w-full bg-background border border-border rounded-lg p-3 text-sm focus:outline-none focus:border-primary font-mono resize-none"
                    />
                  </div>
                </div>
              ) : (
                /* PREVIEW STEP */
                <div className="p-5 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-900/40">
                  <div className="bg-white dark:bg-slate-950 p-6 rounded-xl border border-slate-100 max-w-2xl mx-auto min-h-[400px]">
                    <div className="border-b pb-3 mb-4 space-y-1 text-xs">
                      <p className="text-slate-500"><strong className="text-slate-700">Subject:</strong> {subjectLine || "(No subject)"}</p>
                      <p className="text-slate-500"><strong className="text-slate-700">To:</strong> {targetCategory.toUpperCase()} group</p>
                    </div>
                    {/* Rendered HTML Preview */}
                    <div 
                      className="prose prose-sm max-w-none text-slate-800 dark:text-slate-200"
                      dangerouslySetInnerHTML={{ __html: bodyHtml || "<p className='text-muted-foreground'>Email body is empty.</p>" }}
                    />
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="p-4 border-t bg-muted/40 flex justify-between items-center">
                <button 
                  onClick={() => setShowSaveTemplate(true)}
                  className="px-4 py-2 border rounded-lg hover:bg-accent text-sm font-semibold transition-colors cursor-pointer bg-card"
                >
                  Save as Template
                </button>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowCompose(false)}
                    className="px-4 py-2 border rounded-lg hover:bg-accent text-sm font-semibold transition-colors cursor-pointer bg-card"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSendCampaign}
                    disabled={sendingCampaign}
                    className="flex items-center gap-1.5 px-5 py-2 gradient-brand text-white rounded-lg text-sm font-semibold disabled:opacity-60 transition-opacity cursor-pointer border-none"
                  >
                    {sendingCampaign ? (
                      <><Loader2 className="size-4 animate-spin" /> Sending...</>
                    ) : (
                      <><Send className="size-4" /> Send Campaign Now</>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Save Template Modal Overlay */}
      <AnimatePresence>
        {showSaveTemplate && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="bg-card border rounded-2xl shadow-xl max-w-md w-full overflow-hidden p-5"
            >
              <div className="flex justify-between items-center border-b pb-3 mb-4">
                <h3 className="font-bold text-foreground flex items-center gap-1.5"><Star className="size-4 text-primary" /> Save Custom Template</h3>
                <button onClick={() => setShowSaveTemplate(false)} className="text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer">
                  <X className="size-4" />
                </button>
              </div>

              <form onSubmit={handleSaveAsTemplate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Template Name</label>
                  <input 
                    type="text" 
                    required
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g. VIP Promo Template"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={savingTemplate}
                  className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:opacity-90 disabled:opacity-60 transition-opacity cursor-pointer border-none"
                >
                  {savingTemplate ? "Saving..." : "Save Template"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Writer Modal Overlay */}
      <AnimatePresence>
        {showAiWriter && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
            >
              <div className="p-5 border-b bg-gradient-to-r from-indigo-500/10 to-violet-500/10 flex items-center gap-3">
                <div className="size-10 rounded-xl bg-indigo-500/15 flex items-center justify-center">
                  <Sparkles className="size-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-foreground">AI Email Copywriter</h3>
                  <p className="text-xs text-muted-foreground">Draft high-converting copy in seconds using LLMs.</p>
                </div>
                <button onClick={() => { setShowAiWriter(false); setPrompt(""); }} className="text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer">
                  <X className="size-4" />
                </button>
              </div>

              <form onSubmit={handleGenerateCopy} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Monsoon Season / Product Campaign Goal</label>
                  <textarea
                    required
                    rows={4}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Monsoon clothing sale of 20% targeting customers"
                    className="w-full bg-background border border-border rounded-lg p-3 text-sm focus:outline-none resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={generating || !prompt}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60 transition-colors border-none cursor-pointer"
                >
                  {generating ? (
                    <><Loader2 className="size-4 animate-spin" /> Generating Draft...</>
                  ) : (
                    <><Sparkles className="size-4" /> Generate Copy</>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
