import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Phone, User, Plus, X, Send, Check, CheckCheck,
  RefreshCw, LogOut, Search, Sparkles, Smartphone, QrCode, Users,
  MessageCircle, ExternalLink, Loader2, Info, UserPlus,
  Paperclip, FileText, Trash2, Image as ImageIcon
} from "lucide-react";
import { toast } from "sonner";
import { whatsappAutomationApi, crmApi, type CrmLead } from "@/lib/api-client";
import { useCurrency } from "@/hooks/use-currency";

interface ChatMessage {
  id: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
  media?: {
    mimeType: string;
    preview: string;
    fileName: string;
  };
}

interface WhatsAppSession {
  status: string;
  qr: string | null;
  info: any | null;
  owner_name: string;
}

export function WhatsappCampaigns() {
    const { currency, formatCurrency } = useCurrency();
  // Session States
  const [sessions, setSessions] = useState<Record<string, WhatsAppSession>>({});
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [newNumber, setNewNumber] = useState("");
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [loadingStart, setLoadingStart] = useState(false);

  // Chat/Lead States
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessageText, setNewMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loadingChats, setLoadingChats] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeChats, setActiveChats] = useState<any[]>([]);

  // Direct Message States
  const [showDirectMessageModal, setShowDirectMessageModal] = useState(false);
  const [directMessageNumber, setDirectMessageNumber] = useState("");
  const [directMessageName, setDirectMessageName] = useState("");
  const [loadingDirectMessage, setLoadingDirectMessage] = useState(false);

  // Sidebar Tab State
  const [sidebarTab, setSidebarTab] = useState<"leads" | "contacts">("leads");

  // Contact Sync States
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [syncContacts, setSyncContacts] = useState<Array<{ number: string; name: string }>>([]);
  const [selectedSyncNums, setSelectedSyncNums] = useState<Record<string, boolean>>({});
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactSearch, setContactSearch] = useState("");

  // Media sending states
  const [selectedMedia, setSelectedMedia] = useState<{ file: File; preview: string; mimeType: string; fileName: string } | null>(null);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [mediaCaption, setMediaCaption] = useState("");

  // Ref for hidden file input
  const mediaInputRef = useRef<HTMLInputElement>(null);

  // Refs for scroll
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 1. Fetch sessions from backend
  const fetchSessions = async () => {
    try {
      const data = await whatsappAutomationApi.getSessions();
      setSessions(data || {});
      
      // Auto-select first connected session if none selected
      if (data && Object.keys(data).length > 0) {
        const activeIds = Object.keys(data);
        if (!activeSessionId) {
          const connected = activeIds.find(id => data[id].status === "CONNECTED");
          setActiveSessionId(connected || activeIds[0]);
        }
      }
    } catch (e: any) {
      console.warn("Failed to fetch WhatsApp sessions:", e);
    }
  };

  // 2. Fetch leads from database
  const fetchLeads = async () => {
    setLoadingChats(true);
    try {
      const res = await crmApi.getLeads(1, 100);
      if (res && Array.isArray(res.items)) {
        // Filter out leads without phone numbers
        const activeLeads = res.items.filter((l: CrmLead) => !!l.phone);
        setLeads(activeLeads);
      }
    } catch (e) {
      console.error("Failed to load leads:", e);
    } finally {
      setLoadingChats(false);
    }
  };

  const fetchActiveChats = async () => {
    if (!activeSessionId) return;
    const session = sessions[activeSessionId];
    if (!session || session.status !== "CONNECTED") {
      setActiveChats([]);
      return;
    }
    try {
      const res = await whatsappAutomationApi.getActiveChats(activeSessionId);
      if (res && res.success && Array.isArray(res.chats)) {
        setActiveChats(res.chats);
      }
    } catch (e) {
      console.warn("Failed to load active chats:", e);
    }
  };

  // Poll active chats from gateway when connected
  useEffect(() => {
    if (!activeSessionId) {
      setActiveChats([]);
      return;
    }
    void fetchActiveChats();
    const chatPoll = setInterval(() => {
      void fetchActiveChats();
    }, 5000);
    return () => clearInterval(chatPoll);
  }, [activeSessionId, sessions]);

  // Load initial data
  useEffect(() => {
    void fetchSessions();
    void fetchLeads();
    
    // Poll sessions status every 5 seconds
    const interval = setInterval(() => {
      void fetchSessions();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // Load contacts automatically if contacts tab is chosen
  useEffect(() => {
    if (sidebarTab === "contacts") {
      void loadPhoneContacts();
    }
  }, [sidebarTab, activeSessionId]);

  // Poll active chat messages every 4 seconds if a chat is selected
  useEffect(() => {
    if (!activeSessionId || !selectedLead) {
      setChatMessages([]);
      return;
    }

    const loadMessages = async () => {
      try {
        const res = await whatsappAutomationApi.getChatMessages(activeSessionId, selectedLead.phone || "");
        if (res?.success && Array.isArray(res.messages)) {
          setChatMessages(res.messages);
        }
      } catch (e) {
        console.warn("Failed to load chat history:", e);
      }
    };

    void loadMessages();
    const chatInterval = setInterval(() => {
      void loadMessages();
    }, 4000);

    return () => clearInterval(chatInterval);
  }, [activeSessionId, selectedLead]);

  // Scroll to bottom on message change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Handle linking/starting a new session
  const handleLinkDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNum = newNumber.replace(/\D/g, "");
    if (!cleanNum || cleanNum.length < 10) {
      toast.error("Please enter a valid phone number with country code (e.g. 919849617326)");
      return;
    }

    setLoadingStart(true);
    try {
      const res = await whatsappAutomationApi.startSession(cleanNum);
      if (res.success) {
        toast.success("Initializing WhatsApp session. Loading QR Code...");
        setNewNumber("");
        setShowLinkModal(false);
        setActiveSessionId(cleanNum);
        void fetchSessions();
      } else {
        toast.error("Failed to start session: " + res.error);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to initialize device");
    } finally {
      setLoadingStart(false);
    }
  };

  // Handle disconnect / logout
  const handleDisconnect = async (id: string) => {
    if (!confirm(`Are you sure you want to logout and disconnect +${id}?`)) return;
    try {
      toast.info("Disconnecting session...");
      const res = await whatsappAutomationApi.logoutSession(id);
      if (res.success) {
        toast.success("Disconnected successfully.");
        if (activeSessionId === id) setActiveSessionId(null);
        void fetchSessions();
      }
    } catch (e: any) {
      toast.error("Failed to disconnect: " + e.message);
    }
  };

  // Handle sending message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSessionId || !selectedLead || !newMessageText.trim()) return;

    const text = newMessageText.trim();
    setNewMessageText("");
    setSendingMessage(true);

    // Append message locally for snappy UI
    const tempId = `temp-${Date.now()}`;
    const localMsg: ChatMessage = {
      id: tempId,
      body: text,
      fromMe: true,
      timestamp: Math.floor(Date.now() / 1000)
    };
    setChatMessages(prev => [...prev, localMsg]);

    try {
      const res = await whatsappAutomationApi.sendMessage(
        activeSessionId,
        selectedLead.phone || "",
        text
      );
      if (res.success) {
        // Update local message ID and timestamp
        setChatMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: res.message_id, timestamp: res.timestamp } : m));
      } else {
        toast.error("Failed to send WhatsApp message.");
      }
    } catch (e: any) {
      toast.error("Failed to send message: " + (e.detail || e.message));
      // Remove temp message on error
      setChatMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setSendingMessage(false);
    }
  };

  // ── Media handling (images + PDFs) ────────────────────────────────

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/", "application/pdf"];
    if (!allowed.some(prefix => file.type.startsWith(prefix))) {
      toast.error("Only images and PDF files are allowed");
      return;
    }

    if (file.size > 16 * 1024 * 1024) {
      toast.error("File size must be under 16 MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedMedia({
        file,
        preview: reader.result as string,
        mimeType: file.type,
        fileName: file.name,
      });
      setMediaCaption("");
    };
    reader.readAsDataURL(file);

    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const clearSelectedMedia = () => {
    setSelectedMedia(null);
    setMediaCaption("");
  };

  const handleSendMedia = async () => {
    if (!activeSessionId || !selectedLead || !selectedMedia) return;

    setSendingMedia(true);
    try {
      // Strip the dataURL prefix — gateway expects raw base64
      const base64Data = selectedMedia.preview.includes(",")
        ? selectedMedia.preview.split(",")[1]
        : selectedMedia.preview;

      const res = await whatsappAutomationApi.sendMedia(activeSessionId, selectedLead.phone || "", {
        mimeType: selectedMedia.mimeType,
        data: base64Data,
        fileName: selectedMedia.fileName,
        caption: mediaCaption.trim() || undefined,
      });

      if (res.success) {
        // Append sent media message locally
        const now = Math.floor(Date.now() / 1000);
        setChatMessages(prev => [...prev, {
          id: res.message_id || `temp-media-${now}`,
          body: mediaCaption.trim() || selectedMedia.fileName,
          fromMe: true,
          timestamp: res.timestamp || now,
          media: {
            mimeType: selectedMedia.mimeType,
            preview: selectedMedia.preview,
            fileName: selectedMedia.fileName,
          },
        }]);
        toast.success("Media sent successfully!");
        clearSelectedMedia();
      } else {
        toast.error("Failed to send media.");
      }
    } catch (e: any) {
      toast.error("Failed to send media: " + (e.detail || e.message));
    } finally {
      setSendingMedia(false);
    }
  };

  const handleDirectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNum = directMessageNumber.replace(/\D/g, "");
    if (!cleanNum || cleanNum.length < 10) {
      toast.error("Please enter a valid phone number (with country code)");
      return;
    }

    setLoadingDirectMessage(true);
    try {
      let matchedLead = leads.find(l => l.phone?.replace(/\D/g, "") === cleanNum);
      if (!matchedLead) {
        const tempLead: CrmLead = {
          id: `temp-lead-${cleanNum}`,
          tenant_id: "",
          name: directMessageName.trim() || `WhatsApp Guest (+${cleanNum})`,
          phone: cleanNum,
          company_name: null,
          email: null,
          status: "New",
          source: "WhatsApp",
          owner_user_id: null,
          estimated_value: 0,
          last_contact_at: null,
          next_follow_up_at: null,
          notes: null,
          lost_reason: null,
          ai_score: null,
          ai_sentiment: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        setLeads(prev => [tempLead, ...prev]);
        setSelectedLead(tempLead);
      } else {
        setSelectedLead(matchedLead);
      }
      
      setDirectMessageNumber("");
      setDirectMessageName("");
      setShowDirectMessageModal(false);
      toast.success("Chat window loaded!");
    } catch (e: any) {
      toast.error("Failed to start chat: " + e.message);
    } finally {
      setLoadingDirectMessage(false);
    }
  };

  const loadPhoneContacts = async () => {
    if (!activeSessionId) return;
    setLoadingContacts(true);
    setSyncContacts([]);
    try {
      const res = await whatsappAutomationApi.getContacts(activeSessionId);
      if (res.success && Array.isArray(res.contacts)) {
        setSyncContacts(res.contacts);
      }
    } catch (e: any) {
      console.warn("Failed to load phone contacts:", e);
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleImportSingleContact = async (contact: { number: string; name: string }) => {
    if (!activeSessionId) return;
    try {
      toast.loading(`Importing ${contact.name || contact.number} as lead...`);
      const res = await whatsappAutomationApi.syncContacts(activeSessionId, [contact]);
      if (res.success) {
        toast.dismiss();
        toast.success(`${contact.name || contact.number} imported successfully!`);
        await fetchLeads();
      } else {
        toast.error("Import failed: " + (res.error || "Unknown error"));
      }
    } catch (e: any) {
      toast.error("Import failed: " + e.message);
    }
  };

  // Fetch contacts for sync modal
  const handleOpenSyncModal = async () => {
    if (!activeSessionId) return;
    setShowSyncModal(true);
    setLoadingContacts(true);
    setSyncContacts([]);
    setSelectedSyncNums({});
    try {
      const res = await whatsappAutomationApi.getContacts(activeSessionId);
      if (res.success && Array.isArray(res.contacts)) {
        setSyncContacts(res.contacts);
      } else {
        toast.error("Could not fetch contacts: " + (res.error || "Session not connected"));
        setShowSyncModal(false);
      }
    } catch (e: any) {
      toast.error("Failed to load contacts: " + e.message);
      setShowSyncModal(false);
    } finally {
      setLoadingContacts(false);
    }
  };

  // Handle bulk lead import
  const handleImportLeads = async () => {
    if (!activeSessionId) return;
    const selectedList = syncContacts.filter(c => selectedSyncNums[c.number]);
    if (selectedList.length === 0) {
      toast.warning("No contacts selected for import");
      return;
    }

    try {
      toast.loading(`Importing ${selectedList.length} contacts as CRM leads...`);
      const res = await whatsappAutomationApi.syncContacts(activeSessionId, selectedList);
      toast.dismiss();
      if (res.success) {
        toast.success(`Successfully queued import of ${selectedList.length} leads!`);
        setShowSyncModal(false);
        void fetchLeads();
      }
    } catch (e: any) {
      toast.dismiss();
      toast.error("Failed to import leads: " + e.message);
    }
  };

  // Helpers
  const formatTime = (ts: number) => {
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getSessionStatusBadgeColor = (status: string) => {
    switch (status) {
      case "CONNECTED": return "bg-emerald-500 text-white";
      case "QR_READY": return "bg-amber-500 text-white animate-pulse";
      case "INITIALIZING": return "bg-blue-500 text-white animate-pulse";
      default: return "bg-rose-500 text-white";
    }
  };

  // Filter leads based on query
  const filteredLeads = leads.filter(l =>
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.phone?.includes(searchQuery)
  );

  const isConnected = activeSessionId && sessions[activeSessionId]?.status === "CONNECTED";

  const filteredChats = activeChats.filter(chat =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.phone.includes(searchQuery)
  );

  const filteredContacts = syncContacts.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.number.includes(searchQuery)
  );

  // Merge active chats and database leads dynamically
  const mergedChats: any[] = [...filteredChats];
  const activePhones = new Set(filteredChats.map(c => c.phone.replace(/\D/g, "")));
  
  filteredLeads.forEach(lead => {
    if (lead.phone) {
      const cleanLeadPhone = lead.phone.replace(/\D/g, "");
      if (cleanLeadPhone && !activePhones.has(cleanLeadPhone)) {
        // Only display database leads that belong to this activeSessionId or have no session metadata yet
        const leadSessionId = lead.meta?.whatsapp_session_id;
        if (!leadSessionId || leadSessionId === activeSessionId) {
          mergedChats.push({
            id: lead.id,
            name: lead.name,
            phone: cleanLeadPhone,
            unreadCount: 0,
            timestamp: lead.last_contact_at ? Math.floor(new Date(lead.last_contact_at).getTime() / 1000) : 0,
            lastMessage: lead.notes || "",
            isDbLead: true,
            status: lead.status
          });
        }
      }
    }
  });

  // Sort merged list by timestamp desc
  mergedChats.sort((a, b) => {
    const timeA = a.timestamp || 0;
    const timeB = b.timestamp || 0;
    return timeB - timeA;
  });

  const activeSession = activeSessionId ? sessions[activeSessionId] : null;

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-14.5rem)] rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xl">
      
      {/* SIDEBAR: ACTIVE SESSIONS & CHAT LIST */}
      <div className="w-full flex flex-col bg-slate-50 shrink-0">
        
        {/* Device Sync & Active Session Header */}
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <Smartphone className="size-4 text-[#00a884]" /> WhatsApp Link
            </h3>
            <button
              onClick={() => setShowLinkModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#00a884] hover:bg-[#008f72] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="size-3.5" /> Link Device
            </button>
          </div>

          {/* Session Switcher dropdown */}
          {Object.keys(sessions).length > 0 ? (
            <div className="space-y-2">
              <select
                value={activeSessionId || ""}
                onChange={(e) => setActiveSessionId(e.target.value || null)}
                className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none"
              >
                {Object.keys(sessions).map(num => (
                  <option key={num} value={num}>
                    +{num} ({sessions[num].status})
                  </option>
                ))}
              </select>

              {activeSession && (
                <div className="space-y-1.5 p-2.5 rounded-lg bg-slate-100/50 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`size-2.5 rounded-full ${activeSession.status === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                        {activeSession.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {activeSession.status === "CONNECTED" && (
                        <button
                          onClick={handleOpenSyncModal}
                          title="Sync contacts from phone"
                          className="p-1 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded transition-colors cursor-pointer"
                        >
                          <Users className="size-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => activeSessionId && handleDisconnect(activeSessionId)}
                        title="Disconnect session"
                        className="p-1 hover:bg-slate-200 text-rose-500 hover:text-rose-700 rounded transition-colors cursor-pointer"
                      >
                        <LogOut className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  {activeSession.status === "CONNECTED" && activeSession.info && (
                    <div className="text-[10px] text-slate-500 font-semibold flex flex-col gap-0.5 border-t border-slate-100 pt-1.5 mt-1.5">
                      <span className="text-slate-700">Account: {activeSession.info.pushname || "WhatsApp User"}</span>
                      <span className="font-mono text-slate-400">JID: {activeSession.info.wid?.user}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-center">
              <p className="text-[11px] text-slate-500 font-medium">No active WhatsApp connections. Link your device to chat.</p>
            </div>
          )}
        </div>

        {activeSession && activeSession.status !== "CONNECTED" && (
          <div className="p-3 bg-amber-50 border-b border-amber-200 text-amber-900 flex justify-between items-center text-xs shrink-0">
            <div className="flex items-center gap-2">
              <QrCode className="size-4 text-amber-600 animate-pulse shrink-0" />
              <span>
                <strong>Session is {activeSession.status}.</strong> Scan QR to link.
              </span>
            </div>
            {activeSession.qr && (
              <button
                onClick={() => setShowQrModal(true)}
                className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold transition-colors cursor-pointer"
              >
                Scan QR Code
              </button>
            )}
          </div>
        )}

        {/* Chats list search */}
        <div className="p-3 border-b border-slate-200 bg-white flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search chats or leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-slate-300"
            />
          </div>
          <button
            onClick={() => setShowDirectMessageModal(true)}
            title="Start chat with new number"
            className="p-1.5 bg-[#e3fdf5] hover:bg-[#c1fbe2] text-[#00a884] rounded-lg border border-[#c1fbe2] flex items-center justify-center shrink-0 cursor-pointer"
          >
            <Plus className="size-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-white shrink-0">
          <button
            onClick={() => setSidebarTab("leads")}
            className={`flex-1 py-2 text-[11px] font-bold text-center border-b-2 transition-colors cursor-pointer ${
              sidebarTab === "leads"
                ? "border-[#00a884] text-[#00a884]"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Leads / Chats
          </button>
          <button
            onClick={() => setSidebarTab("contacts")}
            className={`flex-1 py-2 text-[11px] font-bold text-center border-b-2 transition-colors cursor-pointer ${
              sidebarTab === "contacts"
                ? "border-[#00a884] text-[#00a884]"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Phone Contacts
          </button>
        </div>

        {/* Chats/Leads scroll area */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 bg-white">
          {sidebarTab === "leads" ? (
            loadingChats ? (
              <div className="p-6 text-center text-slate-500 flex items-center justify-center gap-2 text-xs">
                <Loader2 className="size-4 animate-spin text-slate-400" /> Loading chats...
              </div>
            ) : isConnected ? (
              mergedChats.length > 0 ? (
                mergedChats.map(chat => {
                  const isSelected = selectedLead?.phone === chat.phone;
                  return (
                    <div
                      key={chat.id || chat.phone}
                      onClick={() => setSelectedLead({
                        id: chat.id || `temp-${chat.phone}`,
                        tenant_id: "",
                        name: chat.name,
                        phone: chat.phone,
                        company_name: null,
                        email: null,
                        status: chat.status || "Contacted",
                        source: "WhatsApp",
                        owner_user_id: null,
                        estimated_value: 0,
                        last_contact_at: null,
                        next_follow_up_at: null,
                        notes: null,
                        lost_reason: null,
                        ai_score: null,
                        ai_sentiment: null,
                        created_at: "",
                        updated_at: ""
                      })}
                      className={`p-3 flex items-start gap-3 cursor-pointer transition-colors ${
                        isSelected ? "bg-slate-100 border-l-4 border-[#00a884]" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="size-9 rounded-full bg-[#00a884]/15 text-[#00a884] flex items-center justify-center shrink-0 font-bold text-sm uppercase relative">
                        {chat.name.charAt(0)}
                        {chat.unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 bg-emerald-500 text-white font-bold text-[9px] size-4 rounded-full flex items-center justify-center border border-white">
                            {chat.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <h4 className="font-bold text-xs text-slate-900 truncate">{chat.name}</h4>
                          <span className="text-[9px] text-slate-400">
                            {chat.timestamp ? formatTime(chat.timestamp) : ""}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono truncate">+{chat.phone}</p>
                        {chat.isDbLead ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 uppercase font-semibold">
                            CRM Lead
                          </span>
                        ) : chat.lastMessage && (
                          <p className="text-[10px] text-slate-400 truncate mt-0.5 italic">
                            {chat.lastMessage}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-slate-400 text-xs">No active WhatsApp conversations found. Click '+' to start a new chat.</div>
              )
            ) : filteredLeads.length > 0 ? (
              filteredLeads.map(lead => {
                const isSelected = selectedLead?.id === lead.id;
                return (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className={`p-3 flex items-start gap-3 cursor-pointer transition-colors ${
                      isSelected ? "bg-slate-100 border-l-4 border-[#00a884]" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="size-9 rounded-full bg-[#00a884]/10 text-[#00a884] flex items-center justify-center shrink-0 font-bold text-sm uppercase">
                      {lead.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <h4 className="font-bold text-xs text-slate-900 truncate">{lead.name}</h4>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase">
                          {lead.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono truncate">+{lead.phone}</p>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {lead.company_name || "Individual"}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs">No matching leads found.</div>
            )
          ) : (
            /* Sidebar Tab: Phone Contacts */
            loadingContacts ? (
              <div className="p-6 text-center text-slate-500 flex items-center justify-center gap-2 text-xs">
                <Loader2 className="size-4 animate-spin text-slate-400" /> Loading contacts...
              </div>
            ) : filteredContacts.length > 0 ? (
              filteredContacts.map(contact => {
                const isSelected = selectedLead?.phone === contact.number;
                return (
                  <div
                    key={contact.number}
                    onClick={() => setSelectedLead({
                      id: `temp-contact-${contact.number}`,
                      name: contact.name || `Contact (+${contact.number})`,
                      phone: contact.number,
                      source: "WhatsApp",
                      status: "New",
                      tenant_id: "",
                      company_name: "",
                      email: "",
                      estimated_value: 0,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                    })}
                    className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                      isSelected ? "bg-slate-100 border-l-4 border-[#00a884]" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="size-9 rounded-full bg-[#00a884]/10 text-[#00a884] flex items-center justify-center shrink-0 font-bold text-sm uppercase">
                        {(contact.name || "?").charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs text-slate-900 truncate">{contact.name || contact.number}</h4>
                        <p className="text-[10px] text-slate-500 font-mono">+{contact.number}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleImportSingleContact(contact);
                      }}
                      title="Import as CRM Lead"
                      className="p-1 hover:bg-[#c1fbe2] text-[#00a884] rounded-lg border border-[#c1fbe2] transition-colors shrink-0 cursor-pointer"
                    >
                      <UserPlus className="size-3.5" />
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs">No contacts found in phone book. Try linking device or sync contacts.</div>
            )
          )}
        </div>
      </div>

      {/* ── LIVE CHAT POPUP MODAL ── */}
      <AnimatePresence>
        {selectedLead && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden border border-slate-200 relative"
            >
              {/* Chat Wallpaper Background Overlay */}
              <div className="absolute inset-0 bg-[#efeae2] opacity-[0.97] pointer-events-none" style={{
                backgroundImage: `url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")`,
                backgroundSize: "400px",
                mixBlendMode: "multiply"
              }} />

              {/* Modal Chat Header */}
              <div className="px-4 py-3 bg-[#F0F2F5] border-b border-slate-200 flex justify-between items-center shadow-sm relative z-10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-[#00a884] text-white flex items-center justify-center font-bold text-base uppercase shrink-0">
                    {selectedLead.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm leading-none flex items-center gap-1.5">
                      {selectedLead.name}
                      <span className="inline-block size-2 rounded-full bg-emerald-500" />
                    </h4>
                    <p className="text-[10px] text-slate-500 font-mono mt-1">+{selectedLead.phone}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#e1f3fd] text-sky-700 border border-sky-200 font-bold uppercase">
                    Lead Source: {selectedLead.source}
                  </span>
                  <button
                    onClick={() => setSelectedLead(null)}
                    className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable messages pane */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 relative z-10 bg-transparent">
                {chatMessages.length > 0 ? (
                  chatMessages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.fromMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-xl px-3 py-2 text-xs shadow-sm relative group ${
                          msg.fromMe
                            ? "bg-[#d9fdd3] text-slate-800 rounded-tr-none"
                            : "bg-white text-slate-800 rounded-tl-none"
                        }`}
                      >
                        {/* Media rendering (image or PDF) */}
                        {msg.media && (
                          <div className="mb-1.5">
                            {msg.media.mimeType.startsWith("image/") ? (
                              <img
                                src={msg.media.preview}
                                alt={msg.media.fileName}
                                className="max-w-[250px] max-h-[200px] rounded-lg object-cover cursor-pointer"
                                onClick={() => window.open(msg.media!.preview, "_blank")}
                              />
                            ) : (
                              <a
                                href={msg.media.preview}
                                download={msg.media.fileName}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 bg-white/80 rounded-lg px-3 py-2 border border-slate-200 hover:bg-white transition-colors"
                              >
                                <FileText className="size-8 text-red-500 shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-700 truncate">{msg.media.fileName}</p>
                                  <p className="text-[10px] text-slate-400">PDF Document</p>
                                </div>
                              </a>
                            )}
                          </div>
                        )}
                        {msg.body && (
                          <p className="whitespace-pre-wrap leading-relaxed pr-8">{msg.body}</p>
                        )}
                        {!msg.body && !msg.media && (
                          <p className="text-slate-400 italic">&lt;Media&gt;</p>
                        )}
                        <div className="absolute right-2 bottom-1.5 flex items-center gap-1">
                          <span className="text-[8px] text-slate-400 font-medium">
                            {formatTime(msg.timestamp)}
                          </span>
                          {msg.fromMe && (
                            <CheckCheck className="size-3 text-sky-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500">
                    <MessageSquare className="size-8 text-[#00a884] mb-2 opacity-50" />
                    <p className="text-xs font-semibold">No messages logged yet.</p>
                    <p className="text-[10px] opacity-75">Send a message below to start the conversation!</p>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* ── Selected media preview strip ───────────────────── */}
              {selectedMedia && (
                <div className="px-3 py-2 bg-[#e8f5e9] border-b border-[#00a884]/20 flex items-center gap-3 relative z-10 shrink-0">
                  <div className="size-10 rounded-lg overflow-hidden bg-white border border-slate-200 shrink-0">
                    {selectedMedia.mimeType.startsWith("image/") ? (
                      <img src={selectedMedia.preview} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="size-full flex items-center justify-center">
                        <FileText className="size-5 text-red-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-slate-700 truncate">{selectedMedia.fileName}</p>
                    <p className="text-[10px] text-slate-400">{(selectedMedia.file.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <input
                    type="text"
                    placeholder="Caption (optional)..."
                    value={mediaCaption}
                    onChange={(e) => setMediaCaption(e.target.value)}
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                  />
                  <button
                    type="button"
                    onClick={clearSelectedMedia}
                    className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleSendMedia}
                    disabled={sendingMedia || !activeSessionId || activeSession?.status !== 'CONNECTED'}
                    className="px-3 py-1.5 bg-[#00a884] hover:bg-[#008f72] text-white rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {sendingMedia ? (
                      <span className="flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> Sending...</span>
                    ) : "Send"}
                  </button>
                </div>
              )}

              {/* Message input panel */}
              <form onSubmit={handleSendMessage} className="p-3 bg-[#F0F2F5] border-t border-slate-200 flex items-center gap-2 relative z-10 shrink-0">
                <input
                  ref={mediaInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleMediaSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => mediaInputRef.current?.click()}
                  disabled={!activeSessionId || activeSession?.status !== 'CONNECTED'}
                  className="p-2 hover:bg-slate-200 text-slate-500 rounded-xl transition-colors cursor-pointer disabled:opacity-40 shrink-0"
                  title="Attach image or PDF"
                >
                  {selectedMedia ? (
                    <ImageIcon className="size-4 text-[#00a884]" />
                  ) : (
                    <Paperclip className="size-4" />
                  )}
                </button>
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  disabled={sendingMessage || !activeSessionId || activeSession?.status !== 'CONNECTED'}
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#00a884] disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={sendingMessage || !newMessageText.trim() || !activeSessionId || activeSession?.status !== 'CONNECTED'}
                  className="size-10 rounded-full bg-[#00a884] hover:bg-[#008f72] text-white flex items-center justify-center shadow-md transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {sendingMessage ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4 pl-0.5" />
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── QR CODE MODAL ── */}
      <AnimatePresence>
        {showQrModal && activeSession?.qr && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <QrCode className="size-4 text-[#00a884]" /> Scan QR Code
                </h3>
                <button onClick={() => setShowQrModal(false)} className="text-slate-400 hover:text-slate-900">
                  <X className="size-4" />
                </button>
              </div>
              <div className="p-6 flex flex-col items-center justify-center gap-3">
                <p className="text-xs text-slate-500 text-center">Open WhatsApp on your phone, go to Linked Devices, scan this QR code to connect.</p>
                <div className="bg-white p-2 rounded-lg border shadow-inner">
                  <img src={activeSession.qr} alt="Scan QR Code" className="size-56" />
                </div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold animate-pulse">
                  Waiting for connection...
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── LINK DEVICE MODAL ── */}
      <AnimatePresence>
        {showLinkModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Smartphone className="size-4 text-[#00a884]" /> Link WhatsApp Web Account
                </h3>
                <button onClick={() => setShowLinkModal(false)} className="text-slate-400 hover:text-slate-900">
                  <X className="size-4" />
                </button>
              </div>

              <form onSubmit={handleLinkDevice} className="p-5 space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-blue-800 text-xs flex gap-2">
                  <Info className="size-4 shrink-0 text-blue-600 mt-0.5" />
                  <p>
                    Entering your phone number starts a headless Chromium browser in the gateway. Once scanned, browser state is persisted.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Phone Number (with Country Code)
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="919849617326"
                    value={newNumber}
                    onChange={(e) => setNewNumber(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#00a884] font-bold"
                  />
                  <p className="text-[9px] text-slate-400">Do not include +, spaces, or leading zeros.</p>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowLinkModal(false)}
                    className="flex-1 px-4 py-2 border rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loadingStart}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#00a884] hover:bg-[#008f72] text-white text-xs font-bold rounded-xl shadow-md transition-colors disabled:opacity-50"
                  >
                    {loadingStart ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      "Start Session"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── SYNC CONTACTS MODAL ── */}
      <AnimatePresence>
        {showSyncModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-lg w-full h-[80vh] flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Users className="size-4 text-[#00a884]" /> Sync Phone Contacts as CRM Leads
                </h3>
                <button onClick={() => setShowSyncModal(false)} className="text-slate-400 hover:text-slate-900">
                  <X className="size-4" />
                </button>
              </div>

              {/* Contact list search */}
              <div className="p-3 border-b border-slate-100 bg-white">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search phone contacts..."
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              {/* Select All options */}
              <div className="px-4 py-2 bg-slate-100 flex justify-between items-center text-xs font-semibold text-slate-600">
                <span>Select Contacts to Import</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const all: Record<string, boolean> = {};
                      syncContacts.forEach(c => all[c.number] = true);
                      setSelectedSyncNums(all);
                    }}
                    className="text-[#00a884] hover:underline"
                  >
                    Select All
                  </button>
                  <span>|</span>
                  <button
                    onClick={() => setSelectedSyncNums({})}
                    className="text-rose-500 hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Scrollable checklist list */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 bg-white">
                {loadingContacts ? (
                  <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="size-6 animate-spin text-[#00a884]" />
                    <p className="text-xs">Fetching address book from WhatsApp Web instance...</p>
                  </div>
                ) : syncContacts.length > 0 ? (
                  syncContacts
                    .filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()) || c.number.includes(contactSearch))
                    .map(contact => (
                      <label
                        key={contact.number}
                        className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={!!selectedSyncNums[contact.number]}
                            onChange={(e) => setSelectedSyncNums(prev => ({ ...prev, [contact.number]: e.target.checked }))}
                            className="accent-[#00a884] size-4"
                          />
                          <div>
                            <p className="text-xs font-bold text-slate-900">{contact.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">+{contact.number}</p>
                          </div>
                        </div>
                      </label>
                    ))
                ) : (
                  <div className="p-12 text-center text-slate-400 text-xs">No contacts resolved. Make sure your phone is online.</div>
                )}
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                <button
                  onClick={() => setShowSyncModal(false)}
                  className="flex-1 px-4 py-2 border rounded-xl text-xs font-bold hover:bg-slate-100 bg-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportLeads}
                  disabled={loadingContacts || syncContacts.length === 0}
                  className="flex-1 px-4 py-2 bg-[#00a884] hover:bg-[#008f72] text-white text-xs font-bold rounded-xl shadow-md transition-colors disabled:opacity-50"
                >
                  Import Selected Leads
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── DIRECT MESSAGE (NEW CHAT) MODAL ── */}
      <AnimatePresence>
        {showDirectMessageModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <MessageSquare className="size-4 text-[#00a884]" /> Start Chat (Direct Message)
                </h3>
                <button onClick={() => setShowDirectMessageModal(false)} className="text-slate-400 hover:text-slate-900">
                  <X className="size-4" />
                </button>
              </div>

              <form onSubmit={handleDirectMessage} className="p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Phone Number (with Country Code)
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="919849617326"
                    value={directMessageNumber}
                    onChange={(e) => setDirectMessageNumber(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#00a884]"
                  />
                  <p className="text-[9px] text-slate-400">Include country code (e.g. 91 for India, no spaces or +).</p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Contact Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="E.g. John Doe"
                    value={directMessageName}
                    onChange={(e) => setDirectMessageName(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#00a884]"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowDirectMessageModal(false)}
                    className="flex-1 px-4 py-2 border rounded-xl text-xs font-bold hover:bg-slate-100 bg-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loadingDirectMessage}
                    className="flex-1 px-4 py-2 bg-[#00a884] hover:bg-[#008f72] text-white text-xs font-bold rounded-xl shadow-md transition-colors"
                  >
                    Start Chat
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
    </div>
  );
}
