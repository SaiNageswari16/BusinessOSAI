import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Send, Users, Sparkles, Smartphone, Plus, Trash2,
  Edit2, Check, CheckCheck, AlertCircle, RefreshCw, Eye, Paperclip,
  X, CheckCircle2, Search, Filter, Phone, UserCheck, Briefcase,
  Layers, ChevronRight, FileText, ArrowRight, Play, Info, Download,
  Upload, Copy, BarChart3, Clock, AlertTriangle, ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import {
  whatsappAutomationApi,
  crmApi,
  type CrmLead,
  type Customer,
  fetchSalesEmployees
} from "@/lib/api-client";
import { useTenant } from "@/contexts/tenant-context";
import { useCurrency } from "@/hooks/use-currency";
import { Button } from "@/components/ui/button";

interface Template {
  id: string;
  name: string;
  category: "Marketing" | "Reminder" | "Festival" | "Announcement" | "Utility" | "Custom";
  body: string;
  media_url?: string;
  media_mime_type?: string;
  media_file_name?: string;
  placeholders: string[];
  created_at?: string;
}

interface CampaignRecord {
  id: string;
  name: string;
  target_audience: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  status: "Completed" | "Partial" | "Failed";
  has_media: boolean;
  created_at: string;
  created_by?: string;
  logs?: Array<{ phone: string; name?: string; status: "SENT" | "FAILED"; error?: string }>;
}

interface AudienceRecipient {
  id: string;
  name: string;
  phone: string;
  category: "lead" | "customer" | "employee" | "custom";
  customData?: Record<string, any>;
}

export function WhatsappBroadcastCampaigns() {
  const { tenant, activeCompany } = useTenant();
  const { currency, formatCurrency } = useCurrency();

  // Active Tab
  const [activeTab, setActiveTab] = useState<"broadcast" | "templates" | "history">("broadcast");

  // WhatsApp Sessions
  const [sessions, setSessions] = useState<Record<string, any>>({});
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Template Modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateForm, setTemplateForm] = useState<{
    name: string;
    category: Template["category"];
    body: string;
  }>({
    name: "",
    category: "Marketing",
    body: "",
  });

  // Campaign Form State
  const [campaignName, setCampaignName] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [audienceSource, setAudienceSource] = useState<"leads" | "customers" | "employees" | "custom">("leads");

  // Audience Data Lists
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [customNumbersText, setCustomNumbersText] = useState("");
  const [loadingAudience, setLoadingAudience] = useState(false);

  // Selected Recipient IDs
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<Record<string, boolean>>({});
  const [audienceSearch, setAudienceSearch] = useState("");

  // Media Attachment
  const [attachedMedia, setAttachedMedia] = useState<{
    file: File;
    preview: string;
    mimeType: string;
    fileName: string;
    base64: string;
  } | null>(null);

  // Broadcast Progress
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState<{
    total: number;
    sent: number;
    failed: number;
    currentName: string;
    logs: Array<{ phone: string; name: string; status: "SENT" | "FAILED"; error?: string }>;
  } | null>(null);

  // Campaign History
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [selectedCampaignLogs, setSelectedCampaignLogs] = useState<CampaignRecord | null>(null);

  // 1. Fetch Sessions
  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const data = await whatsappAutomationApi.getSessions();
      setSessions(data || {});
      const activeIds = Object.keys(data || {});
      if (activeIds.length > 0) {
        const connected = activeIds.find(id => data[id].status === "CONNECTED");
        setActiveSessionId(connected || activeIds[0]);
      }
    } catch (e) {
      console.warn("Failed to load WhatsApp sessions:", e);
    } finally {
      setLoadingSessions(false);
    }
  };

  // 2. Fetch Templates
  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const data = await whatsappAutomationApi.getTemplates();
      if (Array.isArray(data)) {
        setTemplates(data);
        if (!selectedTemplate && data.length > 0) {
          setSelectedTemplate(data[0]);
          setMessageBody(data[0].body);
        }
      }
    } catch (e) {
      console.warn("Failed to load templates:", e);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // 3. Fetch Campaigns History
  const loadCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const data = await whatsappAutomationApi.getCampaigns();
      if (Array.isArray(data)) {
        setCampaigns(data);
      }
    } catch (e) {
      console.warn("Failed to load campaigns:", e);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  // 4. Fetch Audience Data
  const loadAudienceData = async () => {
    setLoadingAudience(true);
    try {
      // Leads
      try {
        const leadsRes = await crmApi.getLeads(1, 300);
        if (leadsRes?.items) {
          setLeads(leadsRes.items.filter((l: CrmLead) => !!l.phone));
        }
      } catch (err) {
        console.warn("Leads fetch err:", err);
      }

      // Customers
      try {
        const custRes = await crmApi.getCustomers(1, 300);
        if (custRes?.items) {
          setCustomers(custRes.items.filter((c: Customer) => !!c.phone));
        }
      } catch (err) {
        console.warn("Customers fetch err:", err);
      }

      // Employees
      try {
        const empRes = await fetchSalesEmployees();
        if (Array.isArray(empRes)) {
          setEmployees(empRes.filter((e: any) => !!e.phone));
        }
      } catch (err) {
        console.warn("Employees fetch err:", err);
      }
    } finally {
      setLoadingAudience(false);
    }
  };

  useEffect(() => {
    void loadSessions();
    void loadTemplates();
    void loadCampaigns();
    void loadAudienceData();
  }, []);

  // Format active Audience List
  const currentAudienceList = useMemo<AudienceRecipient[]>(() => {
    if (audienceSource === "leads") {
      return leads.map((l) => ({
        id: l.id,
        name: l.name,
        phone: l.phone || "",
        category: "lead",
        customData: {
          amount: l.estimated_value ? formatCurrency(l.estimated_value) : "-",
          status: l.status,
        },
      }));
    }
    if (audienceSource === "customers") {
      return customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone || "",
        category: "customer",
        customData: {
          amount: c.outstanding_balance ? formatCurrency(c.outstanding_balance) : "Rs. 0.00",
          code: c.customer_code,
        },
      }));
    }
    if (audienceSource === "employees") {
      return employees.map((e) => ({
        id: e.id,
        name: e.full_name || e.name || "Employee",
        phone: e.phone || "",
        category: "employee",
        customData: {
          department: e.department || "Staff",
        },
      }));
    }
    if (audienceSource === "custom") {
      // Parse custom numbers text (lines: phone, name or just phone)
      const lines = customNumbersText.split("\n").map((l) => l.trim()).filter(Boolean);
      return lines.map((line, idx) => {
        const parts = line.split(",").map((p) => p.trim());
        const phone = parts[0];
        const name = parts[1] || `Contact ${idx + 1}`;
        return {
          id: `custom-${idx}`,
          name,
          phone,
          category: "custom",
        };
      });
    }
    return [];
  }, [audienceSource, leads, customers, employees, customNumbersText, formatCurrency]);

  // Filtered Audience
  const filteredAudience = useMemo(() => {
    if (!audienceSearch.trim()) return currentAudienceList;
    const q = audienceSearch.toLowerCase();
    return currentAudienceList.filter(
      (r) => r.name.toLowerCase().includes(q) || r.phone.includes(q)
    );
  }, [currentAudienceList, audienceSearch]);

  // Handle Select All / Deselect All
  const handleSelectAll = () => {
    const map: Record<string, boolean> = {};
    filteredAudience.forEach((r) => {
      map[r.id] = true;
    });
    setSelectedRecipientIds(map);
  };

  const handleDeselectAll = () => {
    setSelectedRecipientIds({});
  };

  const handleToggleRecipient = (id: string) => {
    setSelectedRecipientIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const selectedRecipients = useMemo(() => {
    return currentAudienceList.filter((r) => selectedRecipientIds[r.id]);
  }, [currentAudienceList, selectedRecipientIds]);

  // Select Template
  const handleSelectTemplate = (tpl: Template) => {
    setSelectedTemplate(tpl);
    setMessageBody(tpl.body);
  };

  // Insert Placeholder in Textarea
  const insertPlaceholder = (tag: string) => {
    setMessageBody((prev) => `${prev} {{${tag}}}`);
  };

  // File Upload for Media Attachment
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error("File size must be under 15MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const base64Data = base64.split(",")[1] || base64;
      setAttachedMedia({
        file,
        preview: file.type.startsWith("image/") ? base64 : "",
        mimeType: file.type || "application/octet-stream",
        fileName: file.name,
        base64: base64Data,
      });
      toast.success(`Attached ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  // Save / Create Template
  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim()) {
      toast.error("Template name is required");
      return;
    }
    if (!templateForm.body.trim()) {
      toast.error("Message body is required");
      return;
    }

    try {
      const payload = {
        id: editingTemplate?.id,
        name: templateForm.name.trim(),
        category: templateForm.category,
        body: templateForm.body,
        placeholders: ["name", "phone", "company", "amount", "date"],
      };
      await whatsappAutomationApi.saveTemplate(payload);
      toast.success(editingTemplate ? "Template updated successfully" : "Template created successfully");
      setShowTemplateModal(false);
      setEditingTemplate(null);
      setTemplateForm({ name: "", category: "Marketing", body: "" });
      void loadTemplates();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save template");
    }
  };

  // Delete Template
  const handleDeleteTemplate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      await whatsappAutomationApi.deleteTemplate(id);
      toast.success("Template deleted");
      if (selectedTemplate?.id === id) {
        setSelectedTemplate(null);
      }
      void loadTemplates();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete template");
    }
  };

  // Execute Broadcast Campaign
  const handleLaunchBroadcast = async () => {
    if (!activeSessionId) {
      toast.error("Please connect and select an active WhatsApp session first.");
      return;
    }
    const currentStatus = sessions[activeSessionId]?.status;
    if (currentStatus !== "CONNECTED") {
      toast.error(`Selected WhatsApp session (+${activeSessionId}) is not CONNECTED (${currentStatus || "OFFLINE"}).`);
      return;
    }
    if (!messageBody.trim()) {
      toast.error("Please compose a message or pick a template.");
      return;
    }
    if (selectedRecipients.length === 0) {
      toast.error("Please select at least one recipient from the audience list.");
      return;
    }

    const companyName = activeCompany?.name || tenant?.name || "Our Business";
    const name = campaignName.trim() || `Broadcast Campaign - ${new Date().toLocaleDateString()}`;

    setIsBroadcasting(true);
    setBroadcastProgress({
      total: selectedRecipients.length,
      sent: 0,
      failed: 0,
      currentName: "Initiating Broadcast Engine...",
      logs: [],
    });

    try {
      const payload = {
        session_id: activeSessionId,
        campaign_name: name,
        target_audience: audienceSource,
        template_id: selectedTemplate?.id,
        message_body: messageBody,
        media: attachedMedia
          ? {
              mimeType: attachedMedia.mimeType,
              data: attachedMedia.base64,
              fileName: attachedMedia.fileName,
              caption: messageBody,
            }
          : undefined,
        recipients: selectedRecipients.map((r) => ({
          phone: r.phone,
          name: r.name,
          placeholders: {
            amount: r.customData?.amount || "",
            company: companyName,
            ...r.customData,
          },
        })),
      };

      const result = await whatsappAutomationApi.runBroadcast(payload);

      setBroadcastProgress({
        total: result.total_recipients || selectedRecipients.length,
        sent: result.sent_count || 0,
        failed: result.failed_count || 0,
        currentName: "Broadcast Completed!",
        logs: result.logs || [],
      });

      toast.success(
        `Campaign Dispatched! Sent: ${result.sent_count || 0}, Failed: ${result.failed_count || 0}`
      );
      void loadCampaigns();
    } catch (e: any) {
      toast.error(e?.message || "Failed to execute WhatsApp broadcast.");
    } finally {
      setIsBroadcasting(false);
    }
  };

  // Preview Resolved Message with Sample Recipient
  const previewSample = useMemo(() => {
    const sampleRecipient = selectedRecipients[0] || currentAudienceList[0] || {
      name: "Ravi Teja",
      phone: "+91 98765 43210",
      customData: { amount: "Rs. 12,500.00" },
    };
    const compName = activeCompany?.name || tenant?.name || "IoTRONCS Cloud";
    let text = messageBody || "Hello {{name}}, welcome to {{company}}!";
    text = text.replace(/\{\{name\}\}/g, sampleRecipient.name);
    text = text.replace(/\{\{phone\}\}/g, sampleRecipient.phone);
    text = text.replace(/\{\{company\}\}/g, compName);
    text = text.replace(/\{\{amount\}\}/g, sampleRecipient.customData?.amount || "Rs. 0.00");
    text = text.replace(/\{\{date\}\}/g, new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }));
    return { text, recipient: sampleRecipient };
  }, [messageBody, selectedRecipients, currentAudienceList, activeCompany, tenant]);

  const activeSession = activeSessionId ? sessions[activeSessionId] : null;
  const isConnected = activeSession?.status === "CONNECTED";

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ─── Top Header & Summary Stats ─── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-indigo-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold backdrop-blur-md">
              <Sparkles className="size-3.5 animate-pulse text-emerald-400" />
              <span>Enterprise WhatsApp Blast & Campaign Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <MessageSquare className="size-8 text-[#25D366]" />
              WhatsApp Campaigns Studio
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              Design personalized broadcast templates with dynamic placeholders, select target audiences from CRM Leads, Customers, or Employees, and launch high-converting WhatsApp message blasts.
            </p>
          </div>

          {/* Session Indicator Card */}
          <div className="bg-white/10 backdrop-blur-md border border-white/15 p-4 rounded-2xl flex items-center gap-4 shrink-0">
            <div className={`p-3 rounded-xl ${isConnected ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/20 text-amber-400 border border-amber-500/30"}`}>
              <Smartphone className="size-6" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Active WhatsApp Session
              </div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                {activeSessionId ? `+${activeSessionId}` : "No Session Linked"}
                {isConnected ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Online
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full">
                    Offline
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                Owner: {activeSession?.owner_name || "Primary Account"}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10">
          <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
            <div className="text-slate-400 text-xs font-semibold">Total Campaigns</div>
            <div className="text-2xl font-black text-white mt-1">{campaigns.length}</div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
            <div className="text-slate-400 text-xs font-semibold">Broadcast Messages Sent</div>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              {campaigns.reduce((acc, c) => acc + (c.sent_count || 0), 0).toLocaleString()}
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
            <div className="text-slate-400 text-xs font-semibold">Saved Templates</div>
            <div className="text-2xl font-black text-indigo-300 mt-1">{templates.length}</div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
            <div className="text-slate-400 text-xs font-semibold">Available Audience</div>
            <div className="text-2xl font-black text-cyan-300 mt-1">
              {(leads.length + customers.length + employees.length).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Navigation Tabs ─── */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("broadcast")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === "broadcast"
              ? "bg-[#00a884] text-white shadow-lg shadow-emerald-500/20"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Send className="size-4" /> Launch Broadcast
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === "templates"
              ? "bg-[#00a884] text-white shadow-lg shadow-emerald-500/20"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Layers className="size-4" /> Template Studio ({templates.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === "history"
              ? "bg-[#00a884] text-white shadow-lg shadow-emerald-500/20"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <BarChart3 className="size-4" /> Broadcast History & Logs ({campaigns.length})
        </button>
      </div>

      {/* ─── TAB 1: BROADCAST WIZARD ─── */}
      {activeTab === "broadcast" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Form & Audience Selector (8 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Campaign Name & Session Picker */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <FileText className="size-4 text-emerald-600" /> 1. Campaign Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Campaign Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Diwali Mega Blast 2026"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Sender WhatsApp Account
                  </label>
                  <select
                    value={activeSessionId || ""}
                    onChange={(e) => setActiveSessionId(e.target.value)}
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {Object.keys(sessions).map((num) => (
                      <option key={num} value={num}>
                        +{num} ({sessions[num]?.status || "OFFLINE"})
                      </option>
                    ))}
                    {Object.keys(sessions).length === 0 && (
                      <option value="">No linked WhatsApp session</option>
                    )}
                  </select>
                </div>
              </div>
            </div>

            {/* 2. Message Template & Placeholder Composer */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Sparkles className="size-4 text-emerald-600" /> 2. Message Template & Content
                </h3>
                <button
                  onClick={() => {
                    setEditingTemplate(null);
                    setTemplateForm({ name: "", category: "Marketing", body: "" });
                    setShowTemplateModal(true);
                  }}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="size-3.5" /> New Template
                </button>
              </div>

              {/* Template Quick Selection Chips */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => handleSelectTemplate(tpl)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      selectedTemplate?.id === tpl.id
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>

              {/* Dynamic Placeholders Toolbar */}
              <div>
                <div className="text-[11px] font-bold text-slate-500 mb-1.5 flex items-center justify-between">
                  <span>Click to insert dynamic placeholder:</span>
                  <span className="text-slate-400">Replaced automatically per recipient</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { tag: "name", label: "Recipient Name", icon: UserCheck },
                    { tag: "company", label: "Company Name", icon: Briefcase },
                    { tag: "phone", label: "Phone Number", icon: Phone },
                    { tag: "amount", label: "Amount / Balance", icon: Sparkles },
                    { tag: "date", label: "Current Date", icon: Clock },
                  ].map((item) => (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() => insertPlaceholder(item.tag)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Plus className="size-3" />
                      <span>{`{{${item.tag}}}`}</span>
                      <span className="text-[10px] text-indigo-500 font-normal">({item.label})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Textarea */}
              <div>
                <textarea
                  rows={6}
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  placeholder="Type your WhatsApp broadcast message here... You can use formatting like *bold*, _italic_, ~strikethrough~ and {{placeholders}}."
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-3.5 font-sans leading-relaxed focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-y"
                />
                <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1 px-1">
                  <span>Characters: {messageBody.length}</span>
                  <span>WhatsApp formatting supported: *bold*, _italic_</span>
                </div>
              </div>

              {/* Optional Media Attachment */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer border border-slate-300">
                      <Paperclip className="size-3.5" /> Attach Media (Flyer / PDF / Image)
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                    {attachedMedia && (
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                        <Check className="size-3" /> {attachedMedia.fileName}
                        <button
                          onClick={() => setAttachedMedia(null)}
                          className="ml-1 text-slate-400 hover:text-rose-500"
                        >
                          <X className="size-3.5" />
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Target Audience Selection */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Users className="size-4 text-emerald-600" /> 3. Select Target Audience
                </h3>
                <div className="text-xs font-bold text-slate-600">
                  Selected: <span className="text-emerald-600 font-extrabold">{selectedRecipients.length}</span> / {currentAudienceList.length}
                </div>
              </div>

              {/* Source Tabs */}
              <div className="grid grid-cols-4 gap-2 bg-slate-100 p-1 rounded-xl">
                {[
                  { id: "leads", label: `CRM Leads (${leads.length})` },
                  { id: "customers", label: `Customers (${customers.length})` },
                  { id: "employees", label: `Employees (${employees.length})` },
                  { id: "custom", label: "Custom Paste" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setAudienceSource(tab.id as any);
                      setSelectedRecipientIds({});
                    }}
                    className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      audienceSource === tab.id
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {audienceSource === "custom" ? (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Paste Phone Numbers (One per line or phone, name)
                  </label>
                  <textarea
                    rows={5}
                    placeholder={`+919876543210, John Doe\n+919812345678, Jane Smith\n+918765432109`}
                    value={customNumbersText}
                    onChange={(e) => setCustomNumbersText(e.target.value)}
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <div className="flex justify-between items-center text-[11px] text-slate-400">
                    <span>Parsed: {currentAudienceList.length} recipients</span>
                    <button
                      onClick={handleSelectAll}
                      className="font-bold text-emerald-600 hover:underline cursor-pointer"
                    >
                      Select All Parsed
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Search and Bulk Select Actions */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search recipient by name or phone..."
                        value={audienceSearch}
                        onChange={(e) => setAudienceSearch(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 transition-colors cursor-pointer"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold border border-slate-200 transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>

                  {/* Recipient List Scrollbox */}
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50/50">
                    {loadingAudience ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        <RefreshCw className="size-4 animate-spin mx-auto mb-2 text-emerald-600" />
                        Loading audience directory...
                      </div>
                    ) : filteredAudience.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        No recipients found matching search.
                      </div>
                    ) : (
                      filteredAudience.map((r) => {
                        const isSelected = !!selectedRecipientIds[r.id];
                        return (
                          <div
                            key={r.id}
                            onClick={() => handleToggleRecipient(r.id)}
                            className={`flex items-center justify-between p-2.5 text-xs hover:bg-emerald-50/50 transition-colors cursor-pointer ${
                              isSelected ? "bg-emerald-50/80 font-semibold" : ""
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}} // Handled by div onClick
                                className="size-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                              <div>
                                <div className="font-bold text-slate-800">{r.name}</div>
                                <div className="text-[11px] text-slate-500">{r.phone}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              {r.customData?.amount && (
                                <div className="text-[11px] font-bold text-indigo-600">
                                  {r.customData.amount}
                                </div>
                              )}
                              {r.customData?.status && (
                                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                                  {r.customData.status}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Launch Action Button */}
            <div className="pt-2">
              <Button
                onClick={handleLaunchBroadcast}
                disabled={isBroadcasting || selectedRecipients.length === 0 || !isConnected}
                className="w-full py-4 bg-[#00a884] hover:bg-[#008f72] text-white font-extrabold text-base rounded-2xl shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isBroadcasting ? (
                  <>
                    <RefreshCw className="size-5 animate-spin" />
                    Broadcasting Campaign...
                  </>
                ) : (
                  <>
                    <Send className="size-5" />
                    Launch WhatsApp Broadcast Blast ({selectedRecipients.length} Recipients)
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Right Column: Live Smartphone Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="sticky top-6">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Smartphone className="size-4 text-emerald-600" /> Live WhatsApp Smartphone Simulator
                </span>
                <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] border border-emerald-200">
                  Preview Mode
                </span>
              </div>

              {/* Smartphone Frame */}
              <div className="w-full max-w-[340px] mx-auto bg-slate-900 rounded-[40px] p-3 shadow-2xl border-4 border-slate-800 ring-1 ring-slate-950/20">
                {/* Speaker Notch */}
                <div className="w-32 h-4 bg-slate-800 rounded-full mx-auto mb-2 flex items-center justify-center">
                  <div className="size-1.5 rounded-full bg-slate-600" />
                </div>

                {/* Smartphone Screen Content */}
                <div className="rounded-[28px] overflow-hidden bg-[#efeae2] h-[520px] flex flex-col relative border border-slate-300">
                  {/* WhatsApp Chat Header */}
                  <div className="bg-[#008069] text-white px-3 py-2.5 flex items-center justify-between shadow-md shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-full bg-slate-300 flex items-center justify-center text-slate-700 font-bold text-xs">
                        {previewSample.recipient.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs font-bold leading-tight truncate max-w-[140px]">
                          {previewSample.recipient.name}
                        </div>
                        <div className="text-[10px] text-emerald-100 opacity-90">online</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-80 text-xs">
                      <Phone className="size-3.5" />
                      <Sparkles className="size-3.5" />
                    </div>
                  </div>

                  {/* Chat Wallpaper & Message Area */}
                  <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-[radial-gradient(#d1d7db_1px,transparent_1px)] [background-size:16px_16px]">
                    {/* Timestamp Bubble */}
                    <div className="text-center">
                      <span className="text-[9px] font-bold bg-white/80 backdrop-blur-sm text-slate-600 px-2 py-0.5 rounded-md shadow-sm">
                        TODAY
                      </span>
                    </div>

                    {/* Media Preview if attached */}
                    {attachedMedia && (
                      <div className="bg-white rounded-lg p-1.5 shadow-sm max-w-[85%] ml-auto border border-slate-200">
                        {attachedMedia.preview ? (
                          <img
                            src={attachedMedia.preview}
                            alt="Media"
                            className="rounded-md w-full h-32 object-cover"
                          />
                        ) : (
                          <div className="p-3 bg-slate-100 rounded flex items-center gap-2 text-xs font-bold text-slate-700">
                            <FileText className="size-5 text-indigo-600" />
                            <span className="truncate">{attachedMedia.fileName}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* WhatsApp Outgoing Message Bubble */}
                    <div className="bg-[#d9fdd3] text-slate-900 rounded-2xl rounded-tr-sm p-3 shadow-sm max-w-[90%] ml-auto text-xs leading-relaxed space-y-2 border border-[#c1e9be] relative">
                      <div className="whitespace-pre-wrap font-sans text-xs">
                        {previewSample.text}
                      </div>
                      <div className="flex items-center justify-end gap-1 text-[10px] text-slate-500 pt-1">
                        <span>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        <CheckCheck className="size-3.5 text-[#53bdeb]" />
                      </div>
                    </div>
                  </div>

                  {/* WhatsApp Fake Input Bar */}
                  <div className="bg-[#f0f2f5] px-3 py-2 flex items-center gap-2 border-t border-slate-300 shrink-0">
                    <div className="flex-1 bg-white rounded-full px-3 py-1.5 text-[11px] text-slate-400 border border-slate-200">
                      Message
                    </div>
                    <div className="size-7 rounded-full bg-[#00a884] text-white flex items-center justify-center">
                      <Send className="size-3.5" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Broadcast Progress Card (When Active) */}
              {broadcastProgress && (
                <div className="mt-4 bg-white rounded-2xl p-5 border border-emerald-300 shadow-xl space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-emerald-700">
                      <RefreshCw className={`size-3.5 ${isBroadcasting ? "animate-spin" : ""}`} />
                      {broadcastProgress.currentName}
                    </span>
                    <span className="text-slate-600">
                      {broadcastProgress.sent + broadcastProgress.failed} / {broadcastProgress.total}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${
                          broadcastProgress.total > 0
                            ? ((broadcastProgress.sent + broadcastProgress.failed) /
                                broadcastProgress.total) *
                              100
                            : 0
                        }%`,
                      }}
                    />
                  </div>

                  <div className="flex justify-between text-xs font-semibold pt-1">
                    <span className="text-emerald-600 font-bold">
                      ✅ Sent: {broadcastProgress.sent}
                    </span>
                    <span className="text-rose-600 font-bold">
                      ❌ Failed: {broadcastProgress.failed}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: TEMPLATE STUDIO ─── */}
      {activeTab === "templates" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Message Template Library</h2>
              <p className="text-xs text-slate-500">
                Create and manage reusable message templates with customizable placeholders.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingTemplate(null);
                setTemplateForm({ name: "", category: "Marketing", body: "" });
                setShowTemplateModal(true);
              }}
              className="px-4 py-2 bg-[#00a884] hover:bg-[#008f72] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="size-4" /> Create Template
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-emerald-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {tpl.category}
                      </span>
                      <h3 className="font-bold text-slate-900 text-sm mt-1.5">{tpl.name}</h3>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingTemplate(tpl);
                          setTemplateForm({
                            name: tpl.name,
                            category: tpl.category,
                            body: tpl.body,
                          });
                          setShowTemplateModal(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        <Edit2 className="size-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteTemplate(tpl.id, e)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Body Preview */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-sans text-slate-700 whitespace-pre-wrap line-clamp-4 leading-relaxed">
                    {tpl.body}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400">
                    Placeholders: {tpl.placeholders?.join(", ") || "None"}
                  </span>
                  <button
                    onClick={() => {
                      handleSelectTemplate(tpl);
                      setActiveTab("broadcast");
                      toast.success(`Loaded template "${tpl.name}" into Broadcast Studio`);
                    }}
                    className="font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                  >
                    Use in Broadcast <ArrowRight className="size-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB 3: CAMPAIGN HISTORY & LOGS ─── */}
      {activeTab === "history" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Broadcast Campaign History</h2>
              <p className="text-xs text-slate-500">
                Track all previously launched WhatsApp blasts, delivery counts, and audit logs.
              </p>
            </div>
            <button
              onClick={() => void loadCampaigns()}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`size-3.5 ${loadingCampaigns ? "animate-spin" : ""}`} /> Refresh History
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                  <th className="p-4">Campaign Name</th>
                  <th className="p-4">Target Audience</th>
                  <th className="p-4">Recipients</th>
                  <th className="p-4">Sent</th>
                  <th className="p-4">Failed</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Date Dispatched</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      No broadcast campaigns executed yet. Launch your first broadcast above!
                    </td>
                  </tr>
                ) : (
                  campaigns.map((camp) => (
                    <tr key={camp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-bold text-slate-900">{camp.name}</td>
                      <td className="p-4 capitalize text-slate-600 font-semibold">{camp.target_audience}</td>
                      <td className="p-4 font-bold text-slate-800">{camp.total_recipients}</td>
                      <td className="p-4 font-bold text-emerald-600">{camp.sent_count}</td>
                      <td className="p-4 font-bold text-rose-500">{camp.failed_count}</td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            camp.status === "Completed"
                              ? "bg-emerald-100 text-emerald-800"
                              : camp.status === "Partial"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {camp.status}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500">
                        {camp.created_at ? new Date(camp.created_at).toLocaleString() : "-"}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => setSelectedCampaignLogs(camp)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-md text-[11px] cursor-pointer"
                        >
                          View Logs
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── CREATE / EDIT TEMPLATE MODAL ─── */}
      <AnimatePresence>
        {showTemplateModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-4 border border-slate-200"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                  <Sparkles className="size-5 text-emerald-600" />
                  {editingTemplate ? "Edit Template" : "Create New Template"}
                </h3>
                <button
                  onClick={() => setShowTemplateModal(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Template Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Festive Discount 2026"
                    value={templateForm.name}
                    onChange={(e) =>
                      setTemplateForm({ ...templateForm, name: e.target.value })
                    }
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={templateForm.category}
                    onChange={(e) =>
                      setTemplateForm({ ...templateForm, category: e.target.value as any })
                    }
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Marketing">Marketing & Promotions</option>
                    <option value="Reminder">Payment & Balance Reminder</option>
                    <option value="Festival">Festival & Greetings</option>
                    <option value="Announcement">Announcement & Updates</option>
                    <option value="Utility">Utility & Alerts</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Message Body (with Placeholders)
                  </label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {["name", "company", "phone", "amount", "date"].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() =>
                          setTemplateForm((prev) => ({
                            ...prev,
                            body: `${prev.body} {{${t}}}`,
                          }))
                        }
                        className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold border border-slate-200 cursor-pointer"
                      >
                        + {`{{${t}}}`}
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={6}
                    placeholder="Hello {{name}}, we have a special announcement from {{company}}..."
                    value={templateForm.body}
                    onChange={(e) =>
                      setTemplateForm({ ...templateForm, body: e.target.value })
                    }
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-3 font-sans focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  className="px-5 py-2 bg-[#00a884] hover:bg-[#008f72] text-white text-xs font-bold rounded-xl cursor-pointer shadow-md"
                >
                  Save Template
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── CAMPAIGN LOGS MODAL ─── */}
      <AnimatePresence>
        {selectedCampaignLogs && (
          <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 border border-slate-200 max-h-[80vh] flex flex-col"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 shrink-0">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    {selectedCampaignLogs.name} — Execution Logs
                  </h3>
                  <div className="text-xs text-slate-500">
                    Total: {selectedCampaignLogs.total_recipients} | Sent: {selectedCampaignLogs.sent_count} | Failed: {selectedCampaignLogs.failed_count}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCampaignLogs(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {(selectedCampaignLogs.logs || []).map((l, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl text-xs border border-slate-200"
                  >
                    <div>
                      <div className="font-bold text-slate-800">{l.name || "Recipient"}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{l.phone}</div>
                    </div>
                    <div className="text-right">
                      {l.status === "SENT" ? (
                        <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold text-[10px]">
                          ✅ Delivered
                        </span>
                      ) : (
                        <span className="text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full font-bold text-[10px]" title={l.error}>
                          ❌ {l.error || "Failed"}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-100 text-right shrink-0">
                <button
                  onClick={() => setSelectedCampaignLogs(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
